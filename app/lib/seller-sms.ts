// Seller-facing SMS via the notary project's Telnyx number, through its
// authed relay endpoint (POST itsofficialnotarys.com/api/sms/relay). The
// Telnyx key is a sensitive var on THAT Vercel project and never leaves it;
// this side only holds the shared SMS_RELAY_TOKEN.
//
// Sonny 2026-08-19: "we can use that number since its setup and ready."
// ONE-WAY channel by design — replies to the number land on the notary's
// inbound webhook, not here. Write texts that don't invite a reply (point
// the seller back at their /go chat instead). Keep it transactional; the
// number's carrier registration belongs to the notary brand.
//
// Best-effort like owner-sms: never throws, returns false on any failure.

const RELAY_URL = "https://itsofficialnotarys.com/api/sms/relay";

export async function sendSellerSms(to: string, body: string): Promise<boolean> {
  const token = process.env.SMS_RELAY_TOKEN || "";
  if (!token || !to || !body.trim()) return false;
  try {
    const res = await fetch(RELAY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-relay-token": token },
      body: JSON.stringify({ to, body: body.slice(0, 480) }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** Loose US phone detector for stored contacts (skips emails). */
export function looksLikePhone(contact: string): boolean {
  return !contact.includes("@") && contact.replace(/\D/g, "").length >= 10;
}
