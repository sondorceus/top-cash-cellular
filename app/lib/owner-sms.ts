// Pings the business owner's phone via Twilio for real-time, high-signal
// events (hot leads, delivery choices). Best-effort by design: silently
// no-ops when Twilio isn't configured and never throws, so a notification
// failure can't break the request that triggered it. Shared by the lead
// notification paths so they stay consistent.
const TWILIO_SID = process.env.TWILIO_ACCOUNT_SID || "";
const TWILIO_AUTH = process.env.TWILIO_AUTH_TOKEN || "";
const TWILIO_FROM = process.env.TWILIO_PHONE || "";
const OWNER_PHONE = process.env.OWNER_PHONE || "+15129609256";

export async function notifyOwnerSms(body: string): Promise<boolean> {
  if (!TWILIO_SID || !TWILIO_AUTH || !TWILIO_FROM) return false;
  try {
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`, {
      method: "POST",
      headers: {
        "Authorization": "Basic " + Buffer.from(`${TWILIO_SID}:${TWILIO_AUTH}`).toString("base64"),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      // Twilio hard-caps a single SMS segment chain; 1500 chars is plenty
      // for an alert and keeps us well clear of the limit.
      body: new URLSearchParams({ To: OWNER_PHONE, From: TWILIO_FROM, Body: body.slice(0, 1500) }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
