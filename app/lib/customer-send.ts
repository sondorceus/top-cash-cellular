// Customer-facing SMS (Twilio) + email (Resend) sends. Mirrors the proven
// patterns in owner-sms.ts and the admin email routes, but addressed to the
// customer instead of the owner. Best-effort: no-ops (returns false) when the
// provider isn't configured and never throws, so a send failure can't break
// the request that triggered it.

const TWILIO_SID = process.env.TWILIO_ACCOUNT_SID || "";
const TWILIO_AUTH = process.env.TWILIO_AUTH_TOKEN || "";
const TWILIO_FROM = process.env.TWILIO_PHONE || "";
const RESEND_KEY = process.env.RESEND_API_KEY || "";

// `to` must be E.164 (e.g. +15125551212).
export async function sendCustomerSms(to: string, body: string): Promise<boolean> {
  if (!TWILIO_SID || !TWILIO_AUTH || !TWILIO_FROM || !to) return false;
  try {
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`, {
      method: "POST",
      headers: {
        "Authorization": "Basic " + Buffer.from(`${TWILIO_SID}:${TWILIO_AUTH}`).toString("base64"),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ To: to, From: TWILIO_FROM, Body: body.slice(0, 1500) }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function sendCustomerEmail(to: string, subject: string, html: string): Promise<boolean> {
  if (!RESEND_KEY || !to) return false;
  try {
    const { Resend } = await import("resend");
    const resend = new Resend(RESEND_KEY);
    const r = await resend.emails.send({
      from: "Top Cash Cellular <noreply@topcashcellular.com>",
      replyTo: "support@topcashcellular.com",
      to,
      subject,
      html,
    });
    return !r.error;
  } catch {
    return false;
  }
}
