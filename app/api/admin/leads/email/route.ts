import { NextRequest, NextResponse } from "next/server";
import { logComm } from "../../../../lib/comms-log";

const ADMIN_TOKEN = process.env.TCC_ADMIN_TOKEN;

// Custom email composer — Skywalker 2026-05-18 "I should also be
// able to send custom email there, not just resend. I do like the
// resend idea though." Lets staff send a one-off message to a
// customer from /admin without the canned status templates.
//
// Same Resend backend so deliverability + brand consistency match
// the auto-templates; staff just writes their own subject + body.
// Plain-text body is auto-wrapped in the TCC brand HTML shell
// (header, subject as eyebrow, "Hi {first}," opener, paragraph
// breaks on newlines, signature, footer). Single-line subject is
// the user-facing email subject.
//
// Posts a [COMM-SENT: leadId] marker for the audit trail so the
// admin row's "💬 N · ✉️ M" counter increments.

function checkAuth(req: NextRequest): boolean {
  const headerToken = req.headers.get("x-admin-token");
  const queryToken = req.nextUrl.searchParams.get("token");
  return headerToken === ADMIN_TOKEN || queryToken === ADMIN_TOKEN;
}

type Payload = {
  leadId: string;
  to: string;
  subject: string;
  body: string;
  customerFirstName?: string;
};

// Convert plain-text body to safe HTML paragraphs. Newlines split
// paragraphs, double-newlines also split. Escapes HTML so a customer
// pasting a < or > doesn't break the layout.
function bodyToHtml(text: string): string {
  const esc = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
  // Split on any run of newlines into paragraphs.
  const paragraphs = esc.split(/\n{1,}/).map((p) => p.trim()).filter(Boolean);
  return paragraphs.map((p) => `<p style="margin:0 0 14px;font-size:15px;line-height:1.7;color:#e6e6e6">${p}</p>`).join("\n");
}

function wrap(html: string, opts: { eyebrow: string; first: string; bodyHtml: string }): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;padding:0;background:#13142b;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#e6e6e6">
<div style="background:#13142b;padding:32px 16px"><table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;margin:0 auto;background:#1b1d39;border:1px solid rgba(255,255,255,0.08);border-radius:18px;overflow:hidden;box-shadow:0 10px 30px rgba(0,0,0,0.5)">
<tr><td style="padding:24px 28px"><div style="font-size:11px;font-weight:800;letter-spacing:0.18em;text-transform:uppercase;color:#9aa0bd;margin-bottom:4px">Top Cash Cellular</div><div style="font-size:20px;font-weight:800;color:#ffffff;line-height:1.2">${opts.eyebrow}</div></td></tr>
<tr><td style="padding:28px 28px 8px 28px"><div style="font-size:18px;color:#fff;font-weight:700;margin-bottom:14px">Hi ${opts.first},</div>${opts.bodyHtml}</td></tr>
<tr><td style="padding:8px 28px 24px 28px"><div style="font-size:14px;color:#e6e6e6;line-height:1.6">— The Top Cash Cellular team<br><span style="color:#888;font-size:12px">Austin, TX · a small business · real humans</span></div></td></tr>
<tr><td style="padding:0 28px 28px 28px"><div style="height:1px;background:rgba(255,255,255,0.08);margin-bottom:18px"></div><div style="font-size:12px;color:#888;line-height:1.6;text-align:center">Reply directly or write to <a href="mailto:support@topcashcellular.com" style="color:#00c853;text-decoration:none;font-weight:600">support@topcashcellular.com</a><br><span style="color:#666">Top Cash Cellular · Austin, TX · <a href="https://topcashcellular.com" style="color:#666;text-decoration:none">topcashcellular.com</a></span></div></td></tr>
</table></div></body></html>`;
}

export async function POST(req: NextRequest) {
  if (!checkAuth(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  let payload: Payload;
  try {
    payload = (await req.json()) as Payload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const { leadId, to, subject, body, customerFirstName } = payload;
  if (!leadId) return NextResponse.json({ error: "leadId required" }, { status: 400 });
  if (!to || !/.+@.+\..+/.test(to)) return NextResponse.json({ error: "Valid 'to' email required" }, { status: 400 });
  if (!subject || subject.trim().length < 2) return NextResponse.json({ error: "Subject required" }, { status: 400 });
  if (!body || body.trim().length < 5) return NextResponse.json({ error: "Body required (5+ chars)" }, { status: 400 });
  if (subject.length > 200) return NextResponse.json({ error: "Subject too long (200 char max)" }, { status: 400 });
  if (body.length > 5000) return NextResponse.json({ error: "Body too long (5000 char max)" }, { status: 400 });
  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json({ error: "Email service not configured (RESEND_API_KEY missing)" }, { status: 503 });
  }

  // HTML-escape values that flow into the wrapper template — wrap()
  // inserts `first` and `eyebrow` via raw template literal interpolation,
  // and bodyToHtml() only escapes the body itself. Without this an admin
  // typing `<img onerror>` in the subject or pasting a customer name
  // with HTML chars would render unescaped in the email layout.
  const htmlEsc = (s: string) => s
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  const first = htmlEsc(((customerFirstName || "there").split(" ")[0].trim() || "there").slice(0, 60));
  const cleanSubject = htmlEsc(subject.replace(/[\r\n]+/g, " ").trim().slice(0, 200));
  const html = wrap("", { eyebrow: cleanSubject, first, bodyHtml: bodyToHtml(body.trim()) });

  try {
    const { Resend } = await import("resend");
    const resend = new Resend(process.env.RESEND_API_KEY);
    const r = await resend.emails.send({
      from: "Top Cash Cellular <noreply@topcashcellular.com>",
      replyTo: "support@topcashcellular.com",
      to,
      subject: cleanSubject,
      html,
      text: `Hi ${first},\n\n${body.trim()}\n\n— The Top Cash Cellular team\nAustin, TX`,
    });
    if (!r?.data?.id) {
      return NextResponse.json({ error: "Email service rejected the send" }, { status: 502 });
    }
    // Audit trail — counts toward the comms-sent badge on the lead row.
    logComm({ leadId, channel: "email", kind: "manual", to, subject: cleanSubject });
    return NextResponse.json({ ok: true, emailId: r.data.id });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Email send failed" }, { status: 502 });
  }
}
