import { NextRequest, NextResponse } from "next/server";

const MC_API = "https://missioncontrolsdjg-production.up.railway.app";
const MC_KEY = process.env.MC_API_KEY || "";
const ADMIN_TOKEN = process.env.TCC_ADMIN_TOKEN || "topcash-admin-2026";
const TWILIO_SID = process.env.TWILIO_ACCOUNT_SID || "";
const TWILIO_AUTH = process.env.TWILIO_AUTH_TOKEN || "";
const TWILIO_FROM = process.env.TWILIO_PHONE || "+18775492056";

// "met" = local meetup completed (cash handoff in person). Distinct from
// "paid" which is the digital payout flow. Both terminate the trade and
// both trigger a review-request SMS/email + Trustpilot invite.
const STATUSES = ["quote_requested", "shipped", "received", "tested", "paid", "met", "rejected"];

// Build the review link with name + device prefilled so the customer
// lands on /reviews/new with the form already populated. Used by both
// the SMS and email templates for the "paid" and "met" statuses.
function buildReviewUrl(name?: string, device?: string): string {
  const params = new URLSearchParams();
  if (name) params.set("name", name);
  if (device) params.set("device", device);
  const qs = params.toString();
  return qs ? `https://topcashcellular.com/reviews/new?${qs}` : "https://topcashcellular.com/reviews/new";
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

function smsTemplate(status: string, ctx: { name?: string; device?: string; quote?: string; payout?: string; rejectionReason?: string }): string {
  const dev = ctx.device || "your device";
  const first = ctx.name?.split(" ")[0] || "there";
  switch (status) {
    case "shipped":
      return `Top Cash: Hi ${first}, your prepaid FedEx label is in your inbox. Drop ${dev} at any FedEx location — we'll text you when it arrives. Questions? Email CustomerService@topcashcells.com`;
    case "received":
      return `Top Cash: We got ${dev}, ${first}! Testing now — payout within 24 hrs. Questions? Email CustomerService@topcashcells.com`;
    case "tested":
      return `Top Cash: ${dev} passed inspection ✅ Finalizing your ${ctx.quote || "payout"} via ${ctx.payout || "your chosen method"} now.`;
    case "paid":
      return `Top Cash: ${ctx.quote || "Payment"} sent via ${ctx.payout || "your method"}! Thanks for selling with us, ${first}. Mind leaving a 30-sec review? ${buildReviewUrl(ctx.name, ctx.device)}`;
    case "met":
      return `Top Cash: Thanks for meeting up, ${first}! Hope you're happy with the trade. If you had a smooth experience, mind leaving a quick review? ${buildReviewUrl(ctx.name, ctx.device)}`;
    case "rejected":
      if (ctx.rejectionReason) {
        return `Top Cash: Hi ${first}, we couldn't accept ${dev} — ${ctx.rejectionReason}. Email CustomerService@topcashcells.com if you'd like to discuss.`;
      }
      return `Top Cash: There's an issue with ${dev}, ${first}. Please email CustomerService@topcashcells.com — we'll work it out.`;
    default:
      return `Top Cash: Status update on your ${dev} — ${status}. Email CustomerService@topcashcells.com with questions.`;
  }
}

async function emailStatus(to: string, status: string, ctx: { name?: string; device?: string; quote?: string; payout?: string; rejectionReason?: string }) {
  if (!process.env.RESEND_API_KEY) return false;
  const first = ctx.name?.split(" ")[0] || "there";
  const dev = ctx.device || "your device";
  const subjectMap: Record<string, string> = {
    shipped: `Your shipping label is on the way`,
    received: `We received ${dev}`,
    tested: `${dev} passed inspection`,
    paid: `Payment sent — thanks!`,
    met: `Thanks for the trade — quick review?`,
    rejected: `Issue with ${dev}`,
  };
  const subject = subjectMap[status] || `Status update on your trade-in`;
  const body = smsTemplate(status, ctx);
  try {
    const { Resend } = await import("resend");
    const resend = new Resend(process.env.RESEND_API_KEY);
    const accentLabel = (() => {
      const map: Record<string, string> = {
        shipped: "Label on the way",
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
    const isReviewAsk = status === "paid" || status === "met";
    const reviewUrl = buildReviewUrl(ctx.name, ctx.device);
    const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#e6e6e6">
  <div style="background:#0a0a0a;padding:32px 16px">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;margin:0 auto;border-collapse:separate;border-spacing:0;background:#0f0f0f;border:1px solid rgba(255,255,255,0.08);border-radius:18px;overflow:hidden;box-shadow:0 10px 30px rgba(0,0,0,0.5)">
      <tr>
        <td style="padding:0">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td style="background:linear-gradient(135deg,#00e676 0%,#00a039 100%);padding:24px 28px;border-bottom:1px solid rgba(255,255,255,0.12)">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td style="vertical-align:middle">
                      <div style="font-size:11px;font-weight:800;letter-spacing:0.18em;text-transform:uppercase;color:#0a0a0a;opacity:0.7;margin-bottom:4px">Top Cash Cellular</div>
                      <div style="font-size:22px;font-weight:800;color:#0a0a0a;line-height:1.1">${accentLabel}</div>
                    </td>
                    <td style="vertical-align:middle;text-align:right">
                      <div style="display:inline-block;padding:8px 14px;background:rgba(10,10,10,0.18);border:1px solid rgba(10,10,10,0.22);border-radius:999px;font-size:11px;font-weight:800;color:#0a0a0a;letter-spacing:0.1em;text-transform:uppercase">Austin, TX</div>
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
          <div style="font-size:15px;color:#e6e6e6;line-height:1.65">${body}</div>
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
                  : `<a href="mailto:CustomerService@topcashcells.com" style="display:inline-block;padding:13px 28px;background:linear-gradient(180deg,#00e676 0%,#00c853 60%,#00a039 100%);color:#0a0a0a;font-weight:800;font-size:14px;text-decoration:none;border-radius:999px;box-shadow:inset 0 1px 0 rgba(255,255,255,0.4),0 4px 14px rgba(0,200,83,0.35)">Reply to this email</a>`}
              </td>
            </tr>
          </table>
        </td>
      </tr>
      <tr>
        <td style="padding:0 28px 28px 28px">
          <div style="height:1px;background:rgba(255,255,255,0.08);margin-bottom:18px"></div>
          <div style="font-size:12px;color:#888;line-height:1.6;text-align:center">
            Questions? Reply directly or write to <a href="mailto:CustomerService@topcashcells.com" style="color:#00c853;text-decoration:none;font-weight:600">CustomerService@topcashcells.com</a><br>
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
      replyTo: "CustomerService@topcashcells.com",
      to,
      ...(isReviewAsk ? { bcc: TRUSTPILOT_BCC } : {}),
      subject: `${subject} — Top Cash Cellular`,
      html,
      text: body,
    });
    return !!(r?.data?.id);
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  if (!checkAuth(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { leadId, status, name, phone, email, device, quote, payout, rejectionReason, shipAddress } = body;

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
  if (status === "shipped" && hasFullShipAddress && phone && name) {
    try {
      const labelReq = await fetch(`${new URL(req.url).origin}/api/admin/leads/label?token=${encodeURIComponent(ADMIN_TOKEN)}`, {
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
  const statusBody = `[STATUS: ${status}] [LEAD: ${leadId}]\nDevice: ${device || "—"}\nCustomer: ${name || "—"}\nQuote: ${quote || "—"}\nPayout: ${payout || "—"}${reasonLine}`;
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

  // 2. Fire SMS + email in parallel.
  const ctx = { name, device, quote, payout, rejectionReason };
  const [smsSent, emailSent] = await Promise.all([
    phone ? sendSms(phone, smsTemplate(status, ctx)) : Promise.resolve(false),
    email ? emailStatus(email, status, ctx) : Promise.resolve(false),
  ]);

  return NextResponse.json({ ok: true, mcOk, smsSent, emailSent, status, label: labelResult });
}
