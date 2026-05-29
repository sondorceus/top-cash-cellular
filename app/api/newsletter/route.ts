import { NextRequest, NextResponse } from "next/server";

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
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function POST(req: NextRequest) {
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

  let emailSent = false;
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
    const { signNewsletterToken } = await import("../../lib/newsletter-token");
    const unsubToken = signNewsletterToken(email);
    const unsubUrl = `https://topcashcellular.com/api/newsletter/unsubscribe?token=${unsubToken}`;

    const htmlEmail = `<!DOCTYPE html>
<html><body style="margin:0;padding:0;background:#0a0a0a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;color:#fff;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#0a0a0a;padding:32px 16px;">
  <tr><td align="center">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:560px;background:#111;border:1px solid rgba(255,255,255,0.08);border-radius:16px;overflow:hidden;">
      <tr><td style="padding:32px 28px 0;">
        <p style="margin:0 0 4px;color:#00c853;font-size:11px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;">Top Cash Cellular</p>
        <h1 style="margin:0 0 16px;font-size:24px;line-height:1.25;color:#fff;font-weight:800;">${greeting}</h1>
        <p style="margin:0 0 14px;color:#e6e6e6;font-size:15px;line-height:1.5;">Thanks for signing up. We'll only email when prices move on something you might own, or when we run a real promo — never just for the sake of it.</p>
        <p style="margin:0 0 22px;color:#e6e6e6;font-size:15px;line-height:1.5;">In the meantime, if you've got something gathering dust, grab a quote in under a minute:</p>
        <p style="margin:0 0 28px;"><a href="https://topcashcellular.com/" style="display:inline-block;background:#00c853;color:#0a0a0a;padding:12px 22px;border-radius:10px;text-decoration:none;font-weight:700;font-size:14px;">Get an instant quote →</a></p>
      </td></tr>
      <tr><td style="padding:18px 28px 28px;border-top:1px solid rgba(255,255,255,0.06);">
        <p style="margin:0;color:#9a9a9a;font-size:12px;line-height:1.5;">Top Cash Cellular · Austin, TX · <a href="mailto:support@topcashcellular.com" style="color:#00c853;text-decoration:none;">support@topcashcellular.com</a></p>
        <p style="margin:8px 0 0;color:#7a7a7a;font-size:11px;line-height:1.5;">Don't want these? <a href="${unsubUrl}" style="color:#7a7a7a;text-decoration:underline;">Unsubscribe in one click</a>.</p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;
    const textFallback = `${name ? `Hi ${name.split(/\s+/)[0]},` : "You're on the list — Top Cash Cellular."}

Thanks for signing up. We'll only email when prices move on something you might own, or when we run a real promo.

Grab a quote in under a minute: https://topcashcellular.com/

— Top Cash Cellular, Austin TX
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
    } catch {}
  }

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
