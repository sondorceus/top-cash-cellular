import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { logComm } from "../../../../lib/comms-log";
import { reportError } from "../../../../lib/error-report";
import { REFERRAL_REFERRER_REWARD } from "../../../../lib/referral";

const MC_API = "https://missioncontrolsdjg-production.up.railway.app";
const MC_KEY = process.env.MC_API_KEY || "";
const ADMIN_TOKEN = process.env.TCC_ADMIN_TOKEN;
const TWILIO_SID = process.env.TWILIO_ACCOUNT_SID || "";
const TWILIO_AUTH = process.env.TWILIO_AUTH_TOKEN || "";
const TWILIO_FROM = process.env.TWILIO_PHONE || "";

// "met" = local meetup completed (cash handoff in person). Distinct from
// "paid" which is the digital payout flow. Both terminate the trade and
// both trigger a review-request SMS/email + Trustpilot invite.
const STATUSES = ["quote_requested", "shipped", "received", "tested", "paid", "met", "rejected"];

// Single-use review token, minted ONLY when admin flips a lead to paid
// or met. Skywalker 2026-05-18 "BE STRICT — random people can't see
// review page. Even if customer checkout, if not marked paid, can't
// review". The token is the customer's ticket to /reviews/new; no
// other path issues one. 60-day TTL keeps stale links from re-opening
// the door long after the trade.
function mintReviewToken(): string {
  return randomBytes(32).toString("hex");
}

async function postReviewTokenMarker(leadId: string, token: string, name?: string, device?: string) {
  const expiresAt = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(); // 60-day TTL
  // Strip `[`, `]`, whitespace, and `·` from name/device — the parallel
  // cron path got this fix in c93ec85. Without it, legacy or admin-
  // supplied name/device with brackets could embed marker fragments
  // into the REVIEW-TOKEN body that the global admin parser then scans.
  const marker = `[REVIEW-TOKEN: ${leadId}] token=${token} expires=${expiresAt}${name ? ` name=${name.replace(/[\[\]\s·]+/g, "_").slice(0, 60)}` : ""}${device ? ` device=${device.replace(/[\[\]\s·]+/g, "_").slice(0, 60)}` : ""}`;
  try {
    await fetch(`${MC_API}/api/comms`, {
      method: "POST",
      headers: { "x-api-key": MC_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "tcc-admin",
        fromName: "TCC Admin",
        role: "system",
        body: marker,
        tags: ["review-token", "minted"],
        priority: "low",
      }),
    });
  } catch {}
}

// True if this lead already minted a review token. Used to avoid minting
// a fresh one (and emailing another review invite) every time staff
// re-flip the lead between paid/met. Best-effort: on lookup failure we
// return false so a legitimate first token still gets minted.
async function leadHasReviewToken(leadId: string): Promise<boolean> {
  if (!MC_KEY) return false;
  try {
    const r = await fetch(`${MC_API}/api/comms?limit=1000`, {
      headers: { "x-api-key": MC_KEY },
      cache: "no-store",
    });
    if (!r.ok) return false;
    const data = await r.json().catch(() => ({}));
    const messages: { body?: string }[] = Array.isArray(data.messages) ? data.messages : [];
    const re = new RegExp(`\\[REVIEW-TOKEN:\\s*${leadId}\\]`, "i");
    return messages.some((m) => !!m.body && re.test(m.body));
  } catch {
    return false;
  }
}

// Referral payout — Skywalker 2026-05-22. When a lead completes (paid
// or met), credit the friend who referred this customer. Best-effort:
// every MC call is wrapped, and any failure returns silently so the
// status update itself never breaks.
//
// Flow: scan MC for THIS lead's [NEW BUYBACK LEAD] message body (its
// MC id === leadId), look for the "Referred-by: <CODE> (<email>)" line
// /api/lead wrote, then — if no [REFERRAL-EARNED:] marker already
// names this referee-lead — post one. The scan-before-post is the
// double-credit guard: re-flipping a lead to paid won't pay twice.
// In-process guard against concurrent double-fires (double-click / quick
// retry of the same paid/met flip). The scan-before-post below already
// stops SEQUENTIAL re-credits, but two requests racing through the scan
// window would both post a [REFERRAL-EARNED] marker and double-pay +
// double-email. Holding the leadId here makes the second concurrent call
// on the same instance bail immediately. (Cross-instance races remain
// possible but are vanishingly rare at this volume; MC has no lock.)
const referralCreditInFlight = new Set<string>();

async function creditReferralIfAny(leadId: string): Promise<void> {
  if (!MC_KEY) return;
  if (referralCreditInFlight.has(leadId)) return;
  referralCreditInFlight.add(leadId);
  try {
    const r = await fetch(`${MC_API}/api/comms?limit=1000`, {
      headers: { "x-api-key": MC_KEY },
      cache: "no-store",
    });
    if (!r.ok) return;
    const data = await r.json().catch(() => ({}));
    const messages: { id?: string; body?: string }[] = Array.isArray(data.messages) ? data.messages : [];

    // Locate this lead's own message + check if it's already credited.
    let leadBody: string | undefined;
    let alreadyCredited = false;
    for (const m of messages) {
      if (!m.body) continue;
      if (m.id === leadId && m.body.includes("[NEW BUYBACK LEAD")) {
        leadBody = m.body;
      }
      // Existing earned marker for this exact referee-lead → stop.
      const em = m.body.match(/\[REFERRAL-EARNED:[^\]]*referee-lead=([\w-]+)/i);
      if (em && em[1] === leadId) alreadyCredited = true;
    }
    if (!leadBody || alreadyCredited) return;

    // Pull the "Referred-by: REF-XXXXXX (email)" line from the body.
    const rb = leadBody.match(/(?:^|\n)Referred-by:[ \t]*(REF-[A-Z0-9]{6})[ \t]*\(([^)]+)\)/i);
    if (!rb) return;
    const code = rb[1].toUpperCase();
    const referrerEmail = rb[2].toLowerCase().trim();
    if (!referrerEmail) return;

    await fetch(`${MC_API}/api/comms`, {
      method: "POST",
      headers: { "x-api-key": MC_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "tcc-admin",
        fromName: "TCC Admin",
        role: "system",
        body: `[REFERRAL-EARNED: referrer=${referrerEmail} amount=${REFERRAL_REFERRER_REWARD} code=${code} referee-lead=${leadId}]`,
        tags: ["referral", "earned"],
        priority: "normal",
      }),
    });

    // Tell the referrer they just earned — best-effort, same fail-soft
    // contract as the marker post above.
    await sendReferralEarnedEmail(referrerEmail);
  } catch {
    // Best-effort — never let a referral-payout hiccup block the
    // status update the admin actually clicked.
  } finally {
    referralCreditInFlight.delete(leadId);
  }
}

// Email the referrer the moment their referral pays out. Best-effort:
// a missing RESEND_API_KEY or a send failure returns silently and
// never blocks the status update. Skywalker 2026-05-22.
async function sendReferralEarnedEmail(to: string): Promise<void> {
  if (!process.env.RESEND_API_KEY) return;
  try {
    const { Resend } = await import("resend");
    const resend = new Resend(process.env.RESEND_API_KEY);
    const reward = `$${REFERRAL_REFERRER_REWARD}`;
    const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#13142b;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#e6e6e6">
  <div style="background:#13142b;padding:32px 16px">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;margin:0 auto;background:#1b1d39;border:1px solid rgba(255,255,255,0.08);border-radius:18px;overflow:hidden">
      <tr><td style="padding:24px 28px">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td style="background:#0e0f22;border:1px solid rgba(255,255,255,0.14);border-radius:999px;padding:9px 18px"><img src="https://topcashcellular.com/logo-wordmark-glass.png" alt="Top Cash Cellular" width="150" style="display:block;width:150px;height:auto;border:0;outline:none" /></td></tr></table>
        <div style="font-size:22px;font-weight:800;color:#ffffff;line-height:1.1">You earned a referral reward</div>
      </td></tr>
      <tr><td style="padding:28px 28px 8px 28px">
        <p style="margin:0 0 16px;font-size:15px;line-height:1.7;color:#e6e6e6">Good news — a friend you referred just completed their trade with us, so your <strong style="color:#fff">${reward} referral reward</strong> is yours.</p>
        <p style="margin:0 0 16px;font-size:15px;line-height:1.7;color:#e6e6e6">Reply to this email to set up your payout, or just mention it on your next trade and we&apos;ll add it on. Thanks for spreading the word — it genuinely helps a small Austin business.</p>
        <div style="font-size:14px;color:#e6e6e6;margin-top:4px">— The Top Cash Cellular team<br><span style="color:#888;font-size:12px">Austin, TX</span></div>
      </td></tr>
      <tr><td style="padding:18px 28px 28px 28px">
        <div style="height:1px;background:rgba(255,255,255,0.08);margin-bottom:16px"></div>
        <div style="font-size:12px;color:#888;line-height:1.6;text-align:center">Questions? <a href="mailto:support@topcashcellular.com" style="color:#00c853;text-decoration:none;font-weight:600">support@topcashcellular.com</a></div>
      </td></tr>
    </table>
  </div>
</body></html>`;
    await resend.emails.send({
      from: "Top Cash Cellular <noreply@topcashcellular.com>",
      replyTo: "support@topcashcellular.com",
      to,
      subject: `You earned a ${reward} referral reward — Top Cash Cellular`,
      html,
      text: `Good news — a friend you referred just completed their trade with Top Cash Cellular, so your ${reward} referral reward is yours. Reply to this email to set up your payout, or mention it on your next trade and we'll add it on. Thanks for spreading the word!`,
    });
  } catch {
    // Best-effort — a failed referral email never blocks anything.
  }
}

// Build the review link with the single-use token + prefilled name +
// device. /reviews/new refuses to render the form without a valid token
// in the URL, so the token IS the access control.
function buildReviewUrl(token: string, name?: string, device?: string): string {
  const params = new URLSearchParams();
  params.set("token", token);
  if (name) params.set("name", name);
  if (device) params.set("device", device);
  return `https://topcashcellular.com/reviews/new?${params.toString()}`;
}

function checkAuth(req: NextRequest): boolean {
  const headerToken = req.headers.get("x-admin-token");
  const queryToken = req.nextUrl.searchParams.get("token");
  return headerToken === ADMIN_TOKEN || queryToken === ADMIN_TOKEN;
}

async function sendSms(to: string, body: string): Promise<boolean> {
  if (!TWILIO_SID || !TWILIO_AUTH) return false;
  const digits = to.replace(/\D/g, "");
  const e164 = digits.length === 10 ? `+1${digits}` : digits.length === 11 && digits.startsWith("1") ? `+${digits}` : null;
  if (!e164) return false;
  try {
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`, {
      method: "POST",
      headers: {
        "Authorization": "Basic " + Buffer.from(`${TWILIO_SID}:${TWILIO_AUTH}`).toString("base64"),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ To: e164, From: TWILIO_FROM, Body: body }),
    });
    return res.ok;
  } catch { return false; }
}

type TemplateCtx = { name?: string; device?: string; quote?: string; payout?: string; rejectionReason?: string; reviewToken?: string; phone?: string; email?: string };

function smsTemplate(status: string, ctx: TemplateCtx): string {
  const dev = ctx.device || "your device";
  const first = ctx.name?.split(" ")[0] || "there";
  // Token-gated review URL — only fires for paid/met where the caller
  // minted a token. Without one, the SMS skips the review CTA entirely.
  const reviewLink = ctx.reviewToken ? buildReviewUrl(ctx.reviewToken, ctx.name, ctx.device) : "";
  // Short tracking link customers can tap from SMS / email to see their
  // device's stage in the pipeline. Skywalker 2026-05-19.
  const trackLink = ctx.phone
    ? `https://topcashcellular.com/track?phone=${encodeURIComponent(ctx.phone)}`
    : ctx.email
    ? `https://topcashcellular.com/track?email=${encodeURIComponent(ctx.email)}`
    : "https://topcashcellular.com/track";
  switch (status) {
    case "shipped":
      return `Top Cash: Hi ${first}, your ${dev} is on its way to us 📦 Most trades reach Austin in 3-5 business days — we'll text you the moment it lands. Track: ${trackLink}`;
    case "received":
      return `Top Cash: We got ${dev}, ${first}! Testing now — payout within 24 hrs. Track: ${trackLink}`;
    case "tested":
      return `Top Cash: ${dev} passed inspection ✅ Finalizing your ${ctx.quote || "payout"} via ${ctx.payout || "your chosen method"} now. Track: ${trackLink}`;
    case "paid":
      return `Top Cash: ${ctx.quote || "Payment"} sent via ${ctx.payout || "your method"}! Thanks for selling with us, ${first}.${reviewLink ? ` Mind leaving a 30-sec review? ${reviewLink}` : ""}`;
    case "met":
      return `Top Cash: Thanks for meeting up, ${first}! Hope you're happy with the trade.${reviewLink ? ` If you had a smooth experience, mind leaving a quick review? ${reviewLink}` : ""}`;
    case "rejected":
      if (ctx.rejectionReason) {
        return `Top Cash: Hi ${first}, we couldn't accept ${dev} — ${ctx.rejectionReason}. Email support@topcashcellular.com if you'd like to discuss.`;
      }
      return `Top Cash: There's an issue with ${dev}, ${first}. Please email support@topcashcellular.com — we'll work it out.`;
    default:
      return `Top Cash: Status update on your ${dev} — ${status}. Email support@topcashcellular.com with questions.`;
  }
}

// Email body builder — paid/met get a multi-paragraph, warm,
// signed-by-a-human body. Other statuses fall back to the short
// SMS-derived copy (already fine for transactional notices).
// Skywalker 2026-05-18 "create a thank you template, sound nice and
// professional, do research".
//
// Pattern researched against Backmarket, Apple, Stripe, ItsWorthMore
// post-sale emails. Common ingredients of the good ones:
//   1. Personal subject — first name + the dollar amount or device
//   2. Acknowledge the SPECIFIC trade (proof we're not a bot)
//   3. The ask, framed as a favor not a demand
//   4. A graceful out ("if something went wrong, tell us FIRST")
//   5. Signed by a person, not a brand
function emailBodyHtml(status: string, ctx: TemplateCtx): string {
  const first = ctx.name?.split(" ")[0] || "there";
  const dev = ctx.device || "your device";
  if (status === "paid") {
    // "Paid" serves both ship + local-digital-payout. Avoid Austin-
    // specific language here so ship customers (often out-of-state)
    // don't think the review is only relevant to Austin locals.
    // Skywalker 2026-05-18: "remove language like Austin unless you
    // wanna do separate review for Austin and shipping — shippers
    // read Austin-only text on review they won't review".
    return `
<p style="margin:0 0 16px;font-size:15px;line-height:1.7;color:#e6e6e6">
  Your trade is wrapped — payment for <strong style="color:#fff">${dev}</strong>${ctx.payout ? ` is on its way via <strong style="color:#fff">${ctx.payout}</strong>` : " is on its way"}. Thanks for trusting a small business with it. We genuinely don&apos;t take it lightly.
</p>
<p style="margin:0 0 16px;font-size:15px;line-height:1.7;color:#e6e6e6">
  One small favor — if your experience was a good one, would you drop a 30-second review? The link below is yours alone, single-use, expires in 60 days. Every honest review helps the next person find us instead of getting lowballed by a faceless website.
</p>
<div style="margin:0 0 4px;font-size:14px;line-height:1.6;color:#dcdcdc;background:rgba(255,180,0,0.06);border:1px solid rgba(255,180,0,0.22);border-left:3px solid #ffb400;border-radius:10px;padding:14px 16px">
  <strong style="color:#fff">If something went sideways</strong> — wrong amount, slow payout, anything off — please hit reply <em>first</em>. We&apos;d rather make it right than read about it. We&apos;re a small team. We&apos;ll answer.
</div>`;
  }
  if (status === "met") {
    // "Met" is always a local handoff in person — Austin language is
    // accurate AND warm here. Keep it.
    return `
<p style="margin:0 0 16px;font-size:15px;line-height:1.7;color:#e6e6e6">
  Cash exchanged, trade done — thanks for meeting up today, ${first}. Hope the handoff felt smooth. We genuinely appreciate every local who picks a small outfit over a faceless website.
</p>
<p style="margin:0 0 16px;font-size:15px;line-height:1.7;color:#e6e6e6">
  One small favor — if today went well, would you drop a 30-second review? The link below is yours alone, single-use, expires in 60 days. It helps the next person find us.
</p>
<div style="margin:0 0 4px;font-size:14px;line-height:1.6;color:#dcdcdc;background:rgba(255,180,0,0.06);border:1px solid rgba(255,180,0,0.22);border-left:3px solid #ffb400;border-radius:10px;padding:14px 16px">
  <strong style="color:#fff">Something off?</strong> Hit reply first — we&apos;d rather make it right than read about it on a review. Small team, real humans, we&apos;ll answer.
</div>`;
  }
  // Other statuses — keep the existing tight transactional copy.
  return `<div style="font-size:15px;color:#e6e6e6;line-height:1.65">${smsTemplate(status, ctx)}</div>`;
}

async function emailStatus(to: string, status: string, ctx: TemplateCtx) {
  if (!process.env.RESEND_API_KEY) return false;
  const first = ctx.name?.split(" ")[0] || "there";
  const dev = ctx.device || "your device";
  // Warmer, more specific subjects on paid/met — the two moments
  // where it matters. Other statuses stay tight + transactional.
  const subjectMap: Record<string, string> = {
    shipped: `Your ${dev} is on its way to us`,
    received: `We received ${dev}`,
    tested: `${dev} passed inspection`,
    paid: `${first}, your ${ctx.quote || "payment"} is out — and a small favor`,
    met: `Thanks for meeting up today, ${first} — quick favor?`,
    rejected: `Issue with ${dev}`,
  };
  const subject = subjectMap[status] || `Status update on your trade-in`;
  const body = smsTemplate(status, ctx);
  try {
    const { Resend } = await import("resend");
    const resend = new Resend(process.env.RESEND_API_KEY);
    const accentLabel = (() => {
      const map: Record<string, string> = {
        shipped: "Package in transit",
        received: "Device received",
        tested: "Inspection passed",
        paid: "Payment sent",
        met: "Thanks for the trade",
        rejected: "Action needed",
      };
      return map[status] || "Status update";
    })();
    // On the two terminal statuses (paid / met) swap the default "Reply
    // to email" CTA for a one-click review button. Links to /reviews/new
    // with name + device prefilled so the customer doesn't have to retype.
    // Review CTA renders only when we minted a token for this lead.
    // Status flips that DON'T grant token access (e.g. paid without a
    // token mint failure) silently swap back to the support CTA.
    const isReviewAsk = (status === "paid" || status === "met") && !!ctx.reviewToken;
    const reviewUrl = ctx.reviewToken ? buildReviewUrl(ctx.reviewToken, ctx.name, ctx.device) : "";
    const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#13142b;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#e6e6e6">
  <div style="background:#13142b;padding:32px 16px">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;margin:0 auto;border-collapse:separate;border-spacing:0;background:#1b1d39;border:1px solid rgba(255,255,255,0.08);border-radius:18px;overflow:hidden;box-shadow:0 10px 30px rgba(0,0,0,0.5)">
      <tr>
        <td style="padding:0">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td style="padding:24px 28px;border-bottom:1px solid rgba(255,255,255,0.12)">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td style="vertical-align:middle">
                      <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td style="background:#0e0f22;border:1px solid rgba(255,255,255,0.14);border-radius:999px;padding:9px 18px"><img src="https://topcashcellular.com/logo-wordmark-glass.png" alt="Top Cash Cellular" width="150" style="display:block;width:150px;height:auto;border:0;outline:none" /></td></tr></table>
                      <div style="font-size:22px;font-weight:800;color:#ffffff;line-height:1.1">${accentLabel}</div>
                    </td>
                    <td style="vertical-align:middle;text-align:right">
                      <div style="display:inline-block;padding:8px 14px;background:rgba(255,255,255,0.10);border:1px solid rgba(255,255,255,0.18);border-radius:999px;font-size:11px;font-weight:800;color:#ffffff;letter-spacing:0.1em;text-transform:uppercase">Austin, TX</div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </td>
      </tr>
      <tr>
        <td style="padding:28px 28px 8px 28px">
          <div style="font-size:18px;color:#fff;font-weight:700;margin-bottom:14px">Hi ${first},</div>
          ${emailBodyHtml(status, ctx)}
        </td>
      </tr>
      <tr>
        <td style="padding:16px 28px 8px 28px">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.10);border-left:3px solid #00c853;border-radius:14px">
            <tr>
              <td style="padding:18px 20px">
                <div style="font-size:10px;letter-spacing:0.18em;text-transform:uppercase;color:#00c853;font-weight:800;margin-bottom:8px">Your trade</div>
                ${ctx.device ? `<div style="font-size:16px;color:#fff;font-weight:700;margin-bottom:4px">${ctx.device}</div>` : ""}
                <div style="font-size:13px;color:#b8b8b8">
                  ${ctx.quote ? `Quote: <span style="color:#00c853;font-weight:700">${ctx.quote}</span>` : ""}
                  ${ctx.quote && ctx.payout ? "  ·  " : ""}
                  ${ctx.payout ? `Payout: <span style="color:#e6e6e6;font-weight:600">${ctx.payout}</span>` : ""}
                </div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
      <tr>
        <td style="padding:24px 28px 20px 28px">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td style="text-align:center">
                ${isReviewAsk
                  ? `<a href="${reviewUrl}" style="display:inline-block;padding:13px 28px;background:linear-gradient(180deg,#ffd54f 0%,#ffb400 60%,#e69900 100%);color:#1a1100;font-weight:800;font-size:14px;text-decoration:none;border-radius:999px;box-shadow:inset 0 1px 0 rgba(255,255,255,0.4),0 4px 14px rgba(255,180,0,0.35)">★ Leave a review</a>`
                  : `<a href="mailto:support@topcashcellular.com" style="display:inline-block;padding:13px 28px;background:linear-gradient(180deg,#00c853 0%,#00c853 60%,#00a039 100%);color:#0a0a0a;font-weight:800;font-size:14px;text-decoration:none;border-radius:999px;box-shadow:inset 0 1px 0 rgba(255,255,255,0.4),0 4px 14px rgba(0,200,83,0.35)">Reply to this email</a>`}
              </td>
            </tr>
          </table>
        </td>
      </tr>
      ${(status === "paid" || status === "met") ? `<tr>
        <td style="padding:8px 28px 24px 28px">
          <div style="font-size:14px;color:#e6e6e6;line-height:1.6">
            — The Top Cash Cellular team<br>
            <span style="color:#888;font-size:12px">Austin, TX · a small business · real humans</span>
          </div>
        </td>
      </tr>` : ""}
      ${status !== "paid" && status !== "met" && status !== "rejected" && (ctx.phone || ctx.email) ? `<tr>
        <td style="padding:0 28px 20px 28px">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.10);border-radius:12px">
            <tr><td style="padding:14px 18px">
              <div style="font-size:11px;color:#00c853;font-weight:800;letter-spacing:0.16em;text-transform:uppercase;margin-bottom:6px">Track your trade anytime</div>
              <div style="font-size:13px;color:#dcdcdc;line-height:1.55">See live status, FedEx tracking, payout method — bookmark this:</div>
              <div style="margin-top:10px"><a href="https://topcashcellular.com/track?${ctx.phone ? `phone=${encodeURIComponent(ctx.phone)}` : `email=${encodeURIComponent(ctx.email || "")}`}" style="display:inline-block;padding:10px 22px;background:rgba(0,200,83,0.12);color:#00c853;border:1px solid rgba(0,200,83,0.35);border-radius:999px;text-decoration:none;font-weight:700;font-size:13px">📍 Track your trade →</a></div>
            </td></tr>
          </table>
        </td>
      </tr>` : ""}
      <tr>
        <td style="padding:0 28px 28px 28px">
          <div style="height:1px;background:rgba(255,255,255,0.08);margin-bottom:18px"></div>
          <div style="font-size:12px;color:#888;line-height:1.6;text-align:center">
            Questions? Reply directly or write to <a href="mailto:support@topcashcellular.com" style="color:#00c853;text-decoration:none;font-weight:600">support@topcashcellular.com</a><br>
            <span style="color:#666">Top Cash Cellular · Austin, TX · <a href="https://topcashcellular.com" style="color:#666;text-decoration:none">topcashcellular.com</a></span>
          </div>
        </td>
      </tr>
    </table>
  </div>
</body>
</html>`;
    // BCC Trustpilot's invite address on the two terminal statuses (paid
    // and met) so they auto-send a review invitation once the customer
    // has either been paid digitally or met in person. Earlier stages
    // are excluded — inviting at received/tested would feel premature.
    const TRUSTPILOT_BCC = "topcashcellular.com+edf80bdc00@invite.trustpilot.com";
    const r = await resend.emails.send({
      from: "Top Cash Cellular <noreply@topcashcellular.com>",
      replyTo: "support@topcashcellular.com",
      to,
      ...(isReviewAsk ? { bcc: TRUSTPILOT_BCC } : {}),
      subject: `${subject} — Top Cash Cellular`,
      html,
      text: body,
    });
    if (!r?.data?.id) {
      reportError("status.email.no-id", new Error("Resend returned no message id"), {
        customerEmail: to,
        critical: true,
        extra: { status, name: ctx.name || "" },
      });
      return false;
    }
    return true;
  } catch (err) {
    reportError("status.email.send", err, {
      customerEmail: to,
      critical: true,
      extra: { status, name: ctx.name || "" },
    });
    return false;
  }
}

export async function POST(req: NextRequest) {
  if (!checkAuth(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const { leadId, status, name, phone, email, device, quote, payout, rejectionReason, shipAddress, payoutConfirmation } = body;

  if (!leadId || !status || !STATUSES.includes(status)) {
    return NextResponse.json({ error: "leadId and valid status required" }, { status: 400 });
  }

  // Auto-fire FedEx label generation when a ship-handoff lead transitions
  // to "shipped". Triple-gated: the lead must be a ship handoff (UI
  // hides the path for local), the status must be "shipped", AND the
  // payload must carry a structured shipAddress with all required
  // fields. Local meetups can never trigger a label generation —
  // Skywalker 2026-05-17 ("only when they click shipping not local").
  let labelResult: { tracking?: string; labelUrl?: string; error?: string } | undefined;
  const hasFullShipAddress =
    shipAddress &&
    typeof shipAddress === "object" &&
    typeof shipAddress.street === "string" && shipAddress.street.trim().length > 0 &&
    typeof shipAddress.city === "string" && shipAddress.city.trim().length > 0 &&
    typeof shipAddress.state === "string" && shipAddress.state.trim().length === 2 &&
    typeof shipAddress.zip === "string" && /^\d{5}/.test(shipAddress.zip);
  if (status === "shipped" && hasFullShipAddress && phone && name && ADMIN_TOKEN) {
    try {
      // Auth via the x-admin-token HEADER only — never the query string.
      // A ?token= in the URL leaks the admin token into access logs and
      // any Referer header. The label route's checkAuth accepts the header.
      const labelReq = await fetch(`${new URL(req.url).origin}/api/admin/leads/label`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-token": ADMIN_TOKEN },
        body: JSON.stringify({
          leadId,
          deviceLabel: device,
          customerEmail: email,
          silent: false, // let the label route send its own dedicated label email
          customer: {
            customerName: name,
            customerPhone: phone,
            customerStreet: shipAddress.street || "",
            customerUnit: shipAddress.unit || undefined,
            customerCity: shipAddress.city || "",
            customerState: shipAddress.state || "",
            customerZip: shipAddress.zip || "",
          },
        }),
      });
      const d = await labelReq.json().catch(() => ({}));
      if (labelReq.ok) {
        labelResult = { tracking: d.tracking, labelUrl: d.labelUrl };
      } else {
        labelResult = { error: d.error || `label HTTP ${labelReq.status}` };
      }
    } catch (e) {
      labelResult = { error: e instanceof Error ? e.message : "label fetch failed" };
    }
  }

  // 1. Persist by posting [STATUS: ...] [LEAD: ...] reply to MC comms.
  const reasonLine = status === "rejected" && rejectionReason ? `\nReason: ${rejectionReason}` : "";
  // Payout confirmation — captured when admin marks "paid" or "met".
  // Format: "method:reference" (e.g. "zelle:CONF-12345", "venmo:@son",
  // "cashapp:$skywalker", "btc:txhash", "cash:in-person-handoff").
  // Cleaned + 200-char capped server-side. Skywalker 2026-05-18 audit
  // trail — no more "did we actually pay them?" bookkeeping holes.
  const payoutConfLine = (status === "paid" || status === "met") && payoutConfirmation && typeof payoutConfirmation === "object"
    ? (() => {
        const pc = payoutConfirmation as { method?: string; reference?: string; note?: string; amount?: number };
        const m = (pc.method || "").toString().slice(0, 40).replace(/[\r\n]+/g, " ").trim();
        const r = (pc.reference || "").toString().slice(0, 120).replace(/[\r\n]+/g, " ").trim();
        const n = (pc.note || "").toString().slice(0, 200).replace(/[\r\n]+/g, " ").trim();
        // Amount actually paid out — often less than the original
        // quote when an in-person inspection downgrades the device.
        // Clamped to 0..100k so a bad client (or bracket-injection
        // attempt) can't post nonsense. Skywalker 2026-05-24.
        const rawAmt = Number(pc.amount);
        const a = Number.isFinite(rawAmt) && rawAmt >= 0 && rawAmt <= 100000 ? Math.round(rawAmt * 100) / 100 : null;
        if (!m && !r && !n && a === null) return "";
        const bits: string[] = [];
        if (m) bits.push(`method=${m}`);
        if (r) bits.push(`ref=${r}`);
        if (a !== null) bits.push(`amount=${a}`);
        if (n) bits.push(`note=${n}`);
        return `\nPayout-confirmation: ${bits.join(" · ")}`;
      })()
    : "";
  // Strip brackets + collapse newlines from each interpolated field so
  // an admin (or attacker with admin token) can't inject a fake
  // `\nPayout-confirmation: method=spoofed` line into the marker, which
  // the admin parser reads back when surfacing payout history.
  const sanitizeMarker = (s: unknown, max: number): string =>
    s === undefined || s === null
      ? ""
      : String(s).replace(/[\[\]\r\n]+/g, " ").trim().slice(0, max);
  const safeStatusDevice = sanitizeMarker(device, 120);
  const safeStatusName = sanitizeMarker(name, 120);
  const safeStatusQuote = sanitizeMarker(quote, 30);
  const safeStatusPayout = sanitizeMarker(payout, 80);
  const statusBody = `[STATUS: ${status}] [LEAD: ${leadId}]\nDevice: ${safeStatusDevice || "—"}\nCustomer: ${safeStatusName || "—"}\nQuote: ${safeStatusQuote || "—"}\nPayout: ${safeStatusPayout || "—"}${reasonLine}${payoutConfLine}`;
  let mcOk = false;
  try {
    const r = await fetch(`${MC_API}/api/comms`, {
      method: "POST",
      headers: { "x-api-key": MC_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "tcc-admin",
        fromName: "TCC Admin",
        role: "system",
        body: statusBody,
        priority: "normal",
      }),
    });
    mcOk = r.ok;
  } catch {}

  // Mint a single-use review token IF this flip is paid/met. The
  // token is the customer's ticket to /reviews/new — no token, no
  // review. Skywalker 2026-05-18 "BE STRICT — random people can't
  // see the review page. Even if customer checkout, if not marked
  // paid, can't review". 60-day TTL, marker persisted to MC so the
  // verify-token endpoint can validate it later.
  let reviewToken: string | undefined;
  if (status === "paid" || status === "met") {
    // Only mint a token the FIRST time a lead completes. Re-flipping
    // paid↔met (or re-saving paid) used to mint a brand-new token each
    // time and email the customer another review invite. Skip if one
    // already exists; their original single-use token still works.
    if (!(await leadHasReviewToken(leadId))) {
      reviewToken = mintReviewToken();
      await postReviewTokenMarker(leadId, reviewToken, name, device);
    }
    // Credit the referrer (if this lead carries a "Referred-by:" line).
    // Best-effort + idempotent — see creditReferralIfAny. A re-flip to
    // paid/met won't double-pay; an MC outage just skips it silently.
    await creditReferralIfAny(leadId);
  }

  // 2. Fire SMS + email in parallel.
  const ctx: TemplateCtx = { name, device, quote, payout, rejectionReason, reviewToken };
  const [smsSent, emailSent] = await Promise.all([
    phone ? sendSms(phone, smsTemplate(status, ctx)) : Promise.resolve(false),
    email ? emailStatus(email, status, ctx) : Promise.resolve(false),
  ]);
  // Audit-trail markers — best-effort, don't block the response.
  if (smsSent && phone) logComm({ leadId, channel: "sms", kind: "status", to: phone, subject: `status=${status}` });
  if (emailSent && email) logComm({ leadId, channel: "email", kind: "status", to: email, subject: `status=${status}` });

  return NextResponse.json({ ok: true, mcOk, smsSent, emailSent, status, label: labelResult });
}
