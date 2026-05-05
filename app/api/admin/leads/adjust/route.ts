import { NextRequest, NextResponse } from "next/server";

const MC_API = "https://missioncontrolsdjg-production.up.railway.app";
const MC_KEY = process.env.MC_API_KEY || "";
const ADMIN_TOKEN = process.env.TCC_ADMIN_TOKEN || "topcash-admin-2026";
const TWILIO_SID = process.env.TWILIO_ACCOUNT_SID || "";
const TWILIO_AUTH = process.env.TWILIO_AUTH_TOKEN || "";
const TWILIO_FROM = process.env.TWILIO_PHONE || "+18775492056";

// Quote-adjustment endpoint. Used at handoff when in-person inspection differs
// from the customer's self-graded quote. Doesn't change the lead status — just
// records a new offer + reason and notifies the customer.

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

async function emailAdjust(to: string, name: string | undefined, device: string | undefined, newQuote: number, reason: string) {
  if (!process.env.RESEND_API_KEY) return false;
  const first = name?.split(" ")[0] || "there";
  const dev = device || "your device";
  try {
    const { Resend } = await import("resend");
    const resend = new Resend(process.env.RESEND_API_KEY);
    const html = `<!DOCTYPE html><html><body style="margin:0;padding:24px;background:#0a0a0a;font-family:-apple-system,BlinkMacSystemFont,sans-serif">
<table width="600" style="max-width:600px;margin:0 auto;background:#111;border:1px solid #222;border-radius:12px;padding:24px">
<tr><td>
<div style="font-size:22px;font-weight:800;color:#00c853;margin-bottom:8px">💰 Top Cash Cellular</div>
<div style="font-size:14px;color:#888;margin-bottom:20px">Austin's #1 Device Buyback</div>
<div style="font-size:18px;color:#fff;font-weight:700;margin-bottom:12px">Hi ${first},</div>
<div style="font-size:15px;color:#ccc;line-height:1.6;margin-bottom:16px">After in-person inspection, we adjusted the offer for ${dev}.</div>
<div style="background:#1a1a2e;border:1px solid #333;border-radius:10px;padding:16px;margin-bottom:16px;text-align:center">
<div style="font-size:12px;color:#888;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px">Updated Offer</div>
<div style="font-size:36px;font-weight:800;color:#00c853">$${newQuote}</div>
</div>
<div style="font-size:14px;color:#aaa;line-height:1.5;margin-bottom:16px"><strong style="color:#fff">Reason:</strong> ${reason}</div>
<div style="font-size:13px;color:#888;border-top:1px solid #222;padding-top:16px">
Questions? Call <a href="tel:+18775492056" style="color:#00c853">(877) 549-2056</a> or just reply to this email.
</div>
</td></tr></table></body></html>`;
    const text = `Top Cash Cellular: After in-person inspection, we've adjusted your offer for ${dev} to $${newQuote}. Reason: ${reason}. Questions? Call (877) 549-2056 or reply to this email.`;
    const r = await resend.emails.send({
      from: "Top Cash Cellular <topcash@resend.dev>",
      replyTo: "topcashcellular@gmail.com",
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
  const body = await req.json();
  const { leadId, newQuote, reason, name, phone, email, device } = body;
  if (!leadId || !newQuote || !reason || typeof newQuote !== "number") {
    return NextResponse.json({ error: "leadId, newQuote (number), and reason required" }, { status: 400 });
  }

  // Persist to MC comms.
  const adjustBody = `[QUOTE ADJUSTED: $${newQuote}] [LEAD: ${leadId}]\nReason: ${reason}\nDevice: ${device || "—"}\nCustomer: ${name || "—"}`;
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
  const smsBody = `Top Cash: Hi ${first}, your offer for ${dev} was adjusted to $${newQuote} — ${reason}. Reply or call (877) 549-2056 with questions.`;

  const [smsSent, emailSent] = await Promise.all([
    phone ? sendSms(phone, smsBody) : Promise.resolve(false),
    email ? emailAdjust(email, name, device, newQuote, reason) : Promise.resolve(false),
  ]);

  return NextResponse.json({ ok: true, mcOk, smsSent, emailSent, newQuote, reason });
}
