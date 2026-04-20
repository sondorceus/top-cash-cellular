import { NextRequest, NextResponse } from "next/server";

const MC_API = "https://missioncontrolsdjg-production.up.railway.app";
const MC_KEY = process.env.MC_API_KEY || "";
const TWILIO_SID = process.env.TWILIO_ACCOUNT_SID || "";
const TWILIO_AUTH = process.env.TWILIO_AUTH_TOKEN || "";
const TWILIO_FROM = process.env.TWILIO_PHONE || "+18775492056";

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

export async function POST(req: NextRequest) {
  const { name, email, phone, model, storage, condition, quote, payout } = await req.json();

  if (!email && !phone) return NextResponse.json({ ok: false, error: "No contact info" });

  let emailSent = false;
  let smsSent = false;

  if (email && process.env.RESEND_API_KEY) {
    const emailBody = `Hi ${name || "there"},

Thanks for choosing Top Cash Cellular! Here's your quote summary:

📱 Device: ${model}
💾 Storage: ${storage || "N/A"}
✨ Condition: ${condition}
💰 Your Quote: $${quote}
💳 Payout Method: ${payout}

🔒 Your price is locked for 7 days.

Next steps:
• Austin local? We'll contact you within the hour to arrange pickup & payment.
• Shipping? Reply to this email and we'll send you a free prepaid label.

Questions? Call us at (877) 549-2056 or reply to this email.

— Top Cash Cellular
Austin, TX`;

    try {
      const { Resend } = await import("resend");
      const resend = new Resend(process.env.RESEND_API_KEY);
      await resend.emails.send({
        from: "Top Cash Cellular <noreply@topcashcellular.com>",
        to: email,
        subject: `Your $${quote} quote for ${model} — Top Cash Cellular`,
        text: emailBody,
      });
      emailSent = true;
    } catch {}
  }

  if (phone) {
    const smsBody = `Top Cash Cellular: Your $${quote} quote for ${model} is locked for 7 days! We'll contact you within the hour. Questions? Call (877) 549-2056`;
    smsSent = await sendSms(phone, smsBody);
  }

  const status = [
    emailSent ? "EMAIL SENT" : null,
    smsSent ? "SMS SENT" : null,
    !emailSent && !smsSent ? "NO CONFIRMATION SENT" : null,
  ].filter(Boolean).join(" + ");

  try {
    await fetch(`${MC_API}/api/comms`, {
      method: "POST",
      headers: { "x-api-key": MC_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "topcash-web",
        fromName: "Top Cash Cellular",
        role: "system",
        body: `[QUOTE CONFIRMATION — ${status}]\nTo: ${name} <${email || "no email"}> | ${phone || "no phone"}\nDevice: ${model} | ${storage} | ${condition}\nQuote: $${quote} | Payout: ${payout}`,
        tags: ["confirmation", "lead"],
        priority: "normal",
      }),
    });
  } catch {}

  return NextResponse.json({ ok: true, emailSent, smsSent });
}
