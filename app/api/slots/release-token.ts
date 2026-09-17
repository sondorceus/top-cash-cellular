// HMAC release token for ONE meetup-slot booking (U12/U17 follow-up).
//
// /api/slots/[id]/book hands it only to the browser that made the booking;
// /api/slots/[id]/release un-books only when the token names that exact
// slot + booking and hasn't expired — so a stranger who guesses or scrapes a
// booking id can't free someone else's window. Stateless like
// app/lib/counter-token.ts (TCC has no DB). Not a route: colocated helper.
//
// The "slot-release:" prefix is signed in, so these signatures never verify
// as another token kind that shares the secret (session, counter,
// newsletter) and those never verify here.

import { createHmac, timingSafeEqual } from "crypto";

// Same precedence as counter-token.ts, and no public fallback: a known
// default would let anyone mint release tokens.
function getSecret(): string {
  const s = process.env.TCC_TOKEN_SECRET || process.env.TCC_SESSION_SECRET || process.env.TCC_ADMIN_TOKEN || process.env.NEXTAUTH_SECRET || process.env.MC_API_KEY;
  if (!s) throw new Error("slot-release signing secret env required (TCC_ADMIN_TOKEN / NEXTAUTH_SECRET / MC_API_KEY)");
  return s;
}

// A hold only needs releasing while the customer is still on the checkout.
// Past this the booking simply stays (staff clear it on /admin/slots).
export const SLOT_RELEASE_TTL_MS = 6 * 60 * 60 * 1000;

// Both ids are route-checked to [\w-] (no ":"), so the joined string is
// unambiguous.
const ID_RE = /^[\w-]{1,64}$/;

function sig(slotId: string, bookingId: string, exp: number): string {
  return createHmac("sha256", getSecret())
    .update(`slot-release:${slotId}:${bookingId}:${exp}`)
    .digest("base64url");
}

export function signSlotRelease(slotId: string, bookingId: string, now = Date.now()): string {
  if (!ID_RE.test(slotId) || !ID_RE.test(bookingId)) throw new Error("bad slot/booking id");
  const exp = now + SLOT_RELEASE_TTL_MS;
  return `${exp.toString(36)}.${sig(slotId, bookingId, exp)}`;
}

export function verifySlotRelease(slotId: string, bookingId: string, token: unknown, now = Date.now()): boolean {
  if (typeof token !== "string" || token.length > 128) return false;
  if (!ID_RE.test(slotId) || !ID_RE.test(bookingId)) return false;
  const parts = token.split(".");
  if (parts.length !== 2 || !/^[0-9a-z]{1,12}$/.test(parts[0])) return false;
  const exp = parseInt(parts[0], 36);
  if (!Number.isSafeInteger(exp) || exp < now) return false;
  const got = Buffer.from(parts[1]);
  const want = Buffer.from(sig(slotId, bookingId, exp));
  return got.length === want.length && timingSafeEqual(got, want);
}
