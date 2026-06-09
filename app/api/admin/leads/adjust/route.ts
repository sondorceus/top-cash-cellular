import { NextRequest, NextResponse } from "next/server";
import { safeEqual } from "../../../../lib/admin-auth";
import { logComm } from "../../../../lib/comms-log";

const MC_API = "https://missioncontrolsdjg-production.up.railway.app";
const MC_KEY = process.env.MC_API_KEY || "";
const ADMIN_TOKEN = process.env.TCC_ADMIN_TOKEN;
const TWILIO_SID = process.env.TWILIO_ACCOUNT_SID || "";
const TWILIO_AUTH = process.env.TWILIO_AUTH_TOKEN || "";
const TWILIO_FROM = process.env.TWILIO_PHONE || "";

// Quote-adjustment endpoint. Used at handoff when in-person inspection differs
// from the customer's self-graded quote. Doesn't change the lead status — just
// records a new offer + reason and notifies the customer.

function checkAuth(req: NextRequest): boolean {
  const headerToken = req.headers.get("x-admin-token");
  const queryToken = req.nextUrl.searchParams.get("token");
  return safeEqual(headerToken, ADMIN_TOKEN) || safeEqual(queryToken, ADMIN_TOKEN);
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

// Escape any value that lands in the customer-facing email HTML. Lead
// fields (name/device) are customer-submitted and `reason` is admin-typed —
// without escaping, markup in any of them renders live in the recipient's
// inbox. Mirrors the helper the other email routes use.
function htmlEsc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

async function emailAdjust(to: string, name: string | undefined, device: string | undefined, newQuote: number, reason: string) {
  if (!process.env.RESEND_API_KEY) return false;
  const first = name?.split(" ")[0] || "there";
  const dev = device || "your device";
  // HTML-escaped variants for the email body only; subject/text stay raw.
  const firstHtml = htmlEsc(first);
  const devHtml = htmlEsc(dev);
  const reasonHtml = htmlEsc(reason);
  try {
    const { Resend } = await import("resend");
    const resend = new Resend(process.env.RESEND_API_KEY);
    const html = `<!DOCTYPE html><html><body style="margin:0;padding:24px;background:#13142b;font-family:-apple-system,BlinkMacSystemFont,sans-serif">
<table width="600" style="max-width:600px;margin:0 auto;background:#1b1d39;border:1px solid #222;border-radius:12px;padding:24px">
<tr><td>
<div style="font-size:22px;font-weight:800;color:#00c853;margin-bottom:8px">💰 Top Cash Cellular</div>
<div style="font-size:14px;color:#888;margin-bottom:20px">Austin's #1 Device Buyback</div>
<div style="font-size:18px;color:#fff;font-weight:700;margin-bottom:12px">Hi ${firstHtml},</div>
<div style="font-size:15px;color:#ccc;line-height:1.6;margin-bottom:16px">After in-person inspection, we adjusted the offer for ${devHtml}.</div>
<div style="background:#13142b;border:1px solid #333;border-radius:10px;padding:16px;margin-bottom:16px;text-align:center">
<div style="font-size:12px;color:#888;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px">Updated Offer</div>
<div style="font-size:36px;font-weight:800;color:#00c853">$${newQuote}</div>
</div>
<div style="font-size:14px;color:#aaa;line-height:1.5;margin-bottom:16px"><strong style="color:#fff">Reason:</strong> ${reasonHtml}</div>
<div style="font-size:13px;color:#888;border-top:1px solid #222;padding-top:16px">
Questions? Just reply to this email or write to <a href="mailto:support@topcashcellular.com" style="color:#00c853">support@topcashcellular.com</a>.
</div>
</td></tr></table></body></html>`;
    const text = `Top Cash Cellular: After in-person inspection, we've adjusted your offer for ${dev} to $${newQuote}. Reason: ${reason}. Questions? Reply to this email or write to support@topcashcellular.com.`;
    const r = await resend.emails.send({
      from: "Top Cash Cellular <noreply@topcashcellular.com>",
      replyTo: "support@topcashcellular.com",
      to,
      subject: `Updated offer for ${dev} — Top Cash Cellular`,
      html,
      text,
    });
    return !!(r?.data?.id);
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  if (!checkAuth(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const { leadId, newQuote, reason, name, phone, email, device } = body;
  // newQuote must be a non-negative number — but DON'T use `!newQuote`, which
  // rejects a legitimate $0 adjusted offer (device worth nothing / recycle).
  if (!leadId || !reason || typeof newQuote !== "number" || !Number.isFinite(newQuote) || newQuote < 0) {
    return NextResponse.json({ error: "leadId, newQuote (number ≥ 0), and reason required" }, { status: 400 });
  }
  if (!/^[\w-]{1,64}$/.test(String(leadId))) {
    return NextResponse.json({ error: "Invalid leadId" }, { status: 400 });
  }

  // Sanitize each field that lands in the MC marker body — strip
  // brackets and collapse newlines so an admin (or anyone with a
  // leaked admin token) can't inject `\nPayout-confirmation:` or
  // `[STATUS: paid] [LEAD: victimId]` via reason/name/device. The
  // numeric newQuote is type-checked above.
  const safeReason = String(reason).replace(/[\[\]\r\n]+/g, " ").trim().slice(0, 300);
  const safeDevice = (device == null ? "" : String(device)).replace(/[\[\]\r\n]+/g, " ").trim().slice(0, 120);
  const safeName = (name == null ? "" : String(name)).replace(/[\[\]\r\n]+/g, " ").trim().slice(0, 120);

  // Persist to MC comms.
  const adjustBody = `[QUOTE ADJUSTED: $${newQuote}] [LEAD: ${leadId}]\nReason: ${safeReason}\nDevice: ${safeDevice || "—"}\nCustomer: ${safeName || "—"}`;
  let mcOk = false;
  try {
    const r = await fetch(`${MC_API}/api/comms`, {
      method: "POST",
      headers: { "x-api-key": MC_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ from: "tcc-admin", fromName: "TCC Admin", role: "system", body: adjustBody, priority: "normal" }),
    });
    mcOk = r.ok;
  } catch {}

  const first = name?.split(" ")[0] || "there";
  const dev = device || "your device";
  const smsBody = `Top Cash: Hi ${first}, your offer for ${dev} was adjusted to $${newQuote} — ${reason}. Reply or email support@topcashcellular.com with questions.`;

  const [smsSent, emailSent] = await Promise.all([
    phone ? sendSms(phone, smsBody) : Promise.resolve(false),
    email ? emailAdjust(email, name, device, newQuote, reason) : Promise.resolve(false),
  ]);
  if (smsSent && phone) logComm({ leadId, channel: "sms", kind: "adjust", to: phone, subject: `adjusted to $${newQuote}` });
  if (emailSent && email) logComm({ leadId, channel: "email", kind: "adjust", to: email, subject: `adjusted to $${newQuote}` });

  return NextResponse.json({ ok: true, mcOk, smsSent, emailSent, newQuote, reason });
}
