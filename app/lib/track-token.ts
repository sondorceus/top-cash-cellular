import { createHmac, timingSafeEqual } from "crypto";

// Stateless, signed magic-link tokens for customer order tracking.
//
// TCC is serverless with no database (leads live in Mission Control), so a
// store-a-code OTP would not survive across lambda instances. Instead we
// sign a short-lived HMAC token over the customer's contact and email/SMS
// them a link — possession of the inbox/phone IS the verification. No
// storage required; the signature + expiry are self-contained.
//
// Signed with MC_API_KEY (server-only secret, never bundled) so we don't
// need to provision a new env var.

const SECRET = process.env.MC_API_KEY || "tcc-track-dev-secret";
const TTL_MS = 30 * 60 * 1000; // 30 minutes

function sign(payloadB64: string): string {
  return createHmac("sha256", SECRET).update(payloadB64).digest("base64url");
}

// Normalize so the token a customer requests for "(512) 555-1212" matches
// the same contact however they re-enter it, and emails are case-insensitive.
export function normalizeContact(raw: string): string {
  const s = (raw || "").trim();
  if (s.includes("@")) return s.toLowerCase();
  return s.replace(/\D/g, "").replace(/^1/, ""); // 10-digit US, no country code
}

export function makeTrackToken(contact: string): string {
  const payload = JSON.stringify({ c: normalizeContact(contact), e: Date.now() + TTL_MS });
  const p = Buffer.from(payload).toString("base64url");
  return `${p}.${sign(p)}`;
}

// Returns the normalized contact if the token is valid + unexpired, else null.
export function verifyTrackToken(token: string): string | null {
  const [p, sig] = (token || "").split(".");
  if (!p || !sig) return null;
  const expected = sign(p);
  // Constant-time compare; lengths must match for timingSafeEqual.
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const { c, e } = JSON.parse(Buffer.from(p, "base64url").toString());
    if (!c || typeof e !== "number" || Date.now() > e) return null;
    return c as string;
  } catch {
    return null;
  }
}
