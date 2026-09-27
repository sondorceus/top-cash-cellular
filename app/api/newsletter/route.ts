import { NextRequest, NextResponse } from "next/server";
import { mailLogo, mailButton, mailPostal, mailPostalText, esc } from "../../lib/email-shell";
import { rateLimit, rateLimitResponse, clientIp } from "../../lib/rate-limit";
import { clearNewsletterUnsub, isNewsletterUnsubbed } from "../../lib/newsletter-unsub";

const MC_API = "https://missioncontrolsdjg-production.up.railway.app";
const MC_KEY = process.env.MC_API_KEY || "";

// Simple in-memory dedup so a user double-clicking Sign Up doesn't trigger
// two welcome emails inside the same warm function instance. 60s window
// keyed on lowercased email.
const recent = new Map<string, number>();
const DEDUP_MS = 60 * 1000;

function isDuplicate(email: string): boolean {
  const key = email.toLowerCase().trim();
  const now = Date.now();
  const seen = recent.get(key);
  if (seen && now - seen < DEDUP_MS) return true;
  recent.set(key, now);
  if (recent.size > 200) {
    for (const [k, t] of recent) if (now - t > DEDUP_MS * 4) recent.delete(k);
  }
  return false;
}

function isValidEmail(email: string): boolean {
  // Disallow brackets explicitly: the old [^\s@]+ class permitted "[" and "]",
  // so an email like "x@e.com][STATUS:paid][LEAD:id" passed validation and
  // injected fake markers into the MC comms body the admin parser reads. (bug fix)
  if (/[\[\]]/.test(email)) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// Double opt-in for an address that opted out earlier (2026-09-27). A bare
// POST used to clear the durable opt-out and mail a welcome — anyone who knew
// an address could re-enroll someone who had unsubscribed. Now the address
// gets ONE short confirmation mail; only the signed link in it (7 days,
// /api/newsletter/resubscribe) clears the record and writes the SIGNUP
// marker. Nothing here touches the store or the roster. An unreadable store
// takes this path too (`unverified`) — safer than assuming "not opted out".
async function sendResubscribeConfirm(email: string, name: string, unverified: boolean): Promise<Response> {
  const key = email.toLowerCase().trim();
  // Two confirmation mails per address per day (per warm instance — see
  // rate-limit.ts), on top of the per-IP cap in POST.
  const rl = rateLimit(`newsletter-resub:${key}`, 2, 24 * 60 * 60 * 1000);
  if (!rl.ok) return rateLimitResponse(rl.retryAfterMs, "We already sent a confirmation link to that address — check your inbox (and spam).");
  const fail = (status: number, error: string) => {
    // Let the same address retry — the 60 s dedupe was recorded before this.
    recent.delete(key);
    return NextResponse.json({ ok: false, error }, { status });
  };
  if (!process.env.RESEND_API_KEY) return fail(503, "We can't send a confirmation email right now — please try again later.");

  const { resubscribeUrl } = await import("../../lib/newsletter-token");
  const confirmUrl = resubscribeUrl(email, name);
  const why = unverified
    ? "this address opted out of our emails before, or we couldn't verify its status just now"
    : "this address opted out of our emails before";
  // Same wrapper and footer as the welcome mail below.
  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="color-scheme" content="dark"><meta name="supported-color-schemes" content="dark"></head><body style="margin:0;padding:0;background:#13142b;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;color:#fff;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#13142b;padding:32px 16px;">
  <tr><td align="center">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:560px;background:#1b1d39;border:1px solid rgba(255,255,255,0.08);border-radius:16px;overflow:hidden;">
      <tr><td style="padding:32px 28px 0;">
        <div style="margin:0 0 16px">${mailLogo()}</div>
        <h1 style="margin:0 0 16px;font-size:24px;line-height:1.25;color:#fff;font-weight:800;">Confirm you want our emails again</h1>
        <p style="margin:0 0 14px;color:#e6e6e6;font-size:15px;line-height:1.5;">Someone — hopefully you — just signed up ${esc(email)} at topcashcellular.com. Because ${why}, we need a quick yes before adding it back.</p>
        <p style="margin:0 0 22px;color:#e6e6e6;font-size:15px;line-height:1.5;">If that was you, tap below. If not, ignore this — nothing changes and you stay unsubscribed.</p>
        <p style="margin:0 0 28px;">${mailButton(confirmUrl, "Yes, sign me up again →", "green")}</p>
      </td></tr>
      <tr><td style="padding:18px 28px 28px;border-top:1px solid rgba(255,255,255,0.06);">
        <p style="margin:0;color:#9a9a9a;font-size:12px;line-height:1.5;">Top Cash Cellular · ${mailPostal()} · <a href="mailto:support@topcashcellular.com" style="color:#00c853;text-decoration:none;">support@topcashcellular.com</a></p>
        <p style="margin:8px 0 0;color:#7a7a7a;font-size:11px;line-height:1.5;">This link works for 7 days and only for this address. No action is needed if you didn't ask for this.</p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;
  const text = `Confirm you want our emails again — Top Cash Cellular

Someone — hopefully you — just signed up ${email} at topcashcellular.com. Because ${why}, we need a quick yes before adding it back.

If that was you, open this link (works for 7 days): ${confirmUrl}

If not, ignore this — nothing changes and you stay unsubscribed.

— Top Cash Cellular · ${mailPostalText()}`;

  try {
    const { Resend } = await import("resend");
    const resend = new Resend(process.env.RESEND_API_KEY);
    const result = await resend.emails.send({
      from: "Top Cash Cellular <noreply@topcashcellular.com>",
      replyTo: "support@topcashcellular.com",
      to: email,
      subject: "Confirm you want our emails again — Top Cash Cellular",
      html,
      text,
    });
    if (!result?.data?.id) return fail(502, "We couldn't send the confirmation email right now — please try again in a minute.");
  } catch {
    return fail(502, "We couldn't send the confirmation email right now — please try again in a minute.");
  }
  return NextResponse.json({ ok: true, confirm: true });
}

export async function POST(req: NextRequest) {
  // Each signup sends a Resend welcome email to the supplied address. The
  // 60s dedup only stops double-clicks on the SAME address; without a
  // per-IP cap an attacker could enumerate addresses (a1@…, a2@…) to
  // mail-bomb arbitrary third parties from our verified domain. Throttle it.
  const rl = rateLimit(`newsletter:${clientIp(req)}`, 5, 60_000);
  if (!rl.ok) return rateLimitResponse(rl.retryAfterMs);

  let email = "";
  let name = "";
  try {
    const data = await req.json();
    email = String(data?.email || "").trim();
    // Optional — keep signup friction low. Strip brackets so it can't
    // inject MC markers downstream, cap at 60 chars.
    name = String(data?.name || "").replace(/[\[\]\r\n]+/g, " ").trim().slice(0, 60);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!isValidEmail(email)) {
    return NextResponse.json({ error: "Valid email required" }, { status: 400 });
  }

  if (isDuplicate(email)) {
    return NextResponse.json({ ok: true, deduped: true });
  }

  // An address that opted out earlier — or whose record can't be read right
  // now — is never re-enrolled by this POST; it gets a confirmation link
  // instead (2026-09-27; see sendResubscribeConfirm).
  const optedOut = await isNewsletterUnsubbed(email);
  if (optedOut !== false) return sendResubscribeConfirm(email, name, optedOut === null);

  let emailSent = false;
  // Resend's verdict when the welcome mail was not accepted (2026-09-27):
  // the SDK returns { error } rather than throwing, so this is the only
  // place the reason (invalid address vs. an outage) is visible.
  let sendErrorName = "";
  // HTML-escape the name before interpolating into the welcome email
  // — defense in depth in case a future subscriber types a name with
  // angle brackets (which most email clients strip anyway).
  const htmlEsc = (s: string) => s
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const safeFirst = htmlEsc(name.split(/\s+/)[0] || "");
  const greeting = safeFirst ? `Hi ${safeFirst},` : "You're on the list.";

  if (process.env.RESEND_API_KEY) {
    // Mint an unsubscribe URL — token-protected via signNewsletterToken
    // (HMAC; verified by /api/newsletter/unsubscribe). 1-click compliant.
    const { newsletterUnsubUrl } = await import("../../lib/newsletter-token");
    const unsubUrl = newsletterUnsubUrl(email);

    const htmlEmail = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="color-scheme" content="dark"><meta name="supported-color-schemes" content="dark"></head><body style="margin:0;padding:0;background:#13142b;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;color:#fff;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#13142b;padding:32px 16px;">
  <tr><td align="center">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:560px;background:#1b1d39;border:1px solid rgba(255,255,255,0.08);border-radius:16px;overflow:hidden;">
      <tr><td style="padding:32px 28px 0;">
        <div style="margin:0 0 16px">${mailLogo()}</div>
        <h1 style="margin:0 0 16px;font-size:24px;line-height:1.25;color:#fff;font-weight:800;">${greeting}</h1>
        <p style="margin:0 0 14px;color:#e6e6e6;font-size:15px;line-height:1.5;">Thanks for signing up. We'll only email when prices move on something you might own, or when we run a real promo — never just for the sake of it.</p>
        <p style="margin:0 0 22px;color:#e6e6e6;font-size:15px;line-height:1.5;">In the meantime, if you've got something gathering dust, grab a quote in under a minute:</p>
        <p style="margin:0 0 28px;">${mailButton("https://topcashcellular.com/", "Get an instant quote →", "green")}</p>
      </td></tr>
      <tr><td style="padding:18px 28px 28px;border-top:1px solid rgba(255,255,255,0.06);">
        <p style="margin:0;color:#9a9a9a;font-size:12px;line-height:1.5;">Top Cash Cellular · ${mailPostal()} · <a href="mailto:support@topcashcellular.com" style="color:#00c853;text-decoration:none;">support@topcashcellular.com</a></p>
        <p style="margin:8px 0 0;color:#7a7a7a;font-size:11px;line-height:1.5;">You're getting this because you signed up at topcashcellular.com. Don't want these? <a href="${unsubUrl}" style="color:#7a7a7a;text-decoration:underline;">Unsubscribe in one click</a>.</p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;
    const textFallback = `${name ? `Hi ${name.split(/\s+/)[0]},` : "You're on the list — Top Cash Cellular."}

Thanks for signing up. We'll only email when prices move on something you might own, or when we run a real promo.

Grab a quote in under a minute: https://topcashcellular.com/

— Top Cash Cellular · ${mailPostalText()}
You're getting this because you signed up at topcashcellular.com.
Unsubscribe: ${unsubUrl}`;

    try {
      const { Resend } = await import("resend");
      const resend = new Resend(process.env.RESEND_API_KEY);
      const result = await resend.emails.send({
        from: "Top Cash Cellular <noreply@topcashcellular.com>",
        replyTo: "support@topcashcellular.com",
        to: email,
        subject: "You're on the list — Top Cash Cellular",
        html: htmlEmail,
        text: textFallback,
      });
      emailSent = !!(result?.data?.id);
      if (!emailSent) sendErrorName = result?.error?.name || "unknown_error";
    } catch {
      sendErrorName = "send_failed";
    }
  }

  // The list only gets an address a welcome mail actually reached
  // (2026-09-27): a Resend-rejected address used to join the roster anyway
  // and be blasted on every send. With no Resend configured there is nothing
  // to reject against, so the marker is still written (welcome=skip).
  if (process.env.RESEND_API_KEY && !emailSent) {
    // Let the same address retry right away — the 60 s dedupe was recorded
    // before the send.
    recent.delete(email.toLowerCase().trim());
    const invalid = /^(validation_error|invalid_parameter|missing_required_field)$/.test(sendErrorName);
    return NextResponse.json(
      { ok: false, error: invalid ? "That email address doesn't look deliverable — check it and try again." : "We couldn't send your welcome email right now — please try again in a minute." },
      { status: invalid ? 400 : 502 },
    );
  }

  // A signup is fresh consent: forget any durable opt-out for the address so
  // the roster and the opt-out store agree (2026-09-27; a re-subscriber used
  // to show as a recipient and be silently skipped on every blast).
  await clearNewsletterUnsub(email);

  if (MC_KEY) {
    try {
      // Marker format: "[NEWSLETTER SIGNUP] email=X name=Y status=..."
      // Parsed by /api/admin/newsletter to build the subscriber list.
      // Keeping email + name as explicit key=value pairs (rather than
      // positional) so we can extend later without breaking the parser.
      await fetch(`${MC_API}/api/comms`, {
        method: "POST",
        headers: { "x-api-key": MC_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: "topcash-web",
          fromName: "Top Cash Cellular",
          role: "system",
          body: `[NEWSLETTER SIGNUP] email=${email}${name ? ` name=${name}` : ""} welcome=${emailSent ? "sent" : "skip"}`,
          tags: ["newsletter", "signup"],
          priority: "normal",
        }),
      });
    } catch {}
  }

  return NextResponse.json({ ok: true, emailSent });
}
