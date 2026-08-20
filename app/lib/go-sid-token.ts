// Session-adoption proof for the owner's SMS deep-link (/go?sid=&k=).
//
// Only links minted by the authed admin console carry a valid k, so a random
// attacker-shared /go?sid=… link can never make a victim's browser adopt an
// attacker-readable session (session fixation — the attacker would then poll
// chat-sync and harvest whatever the victim types, phone number included).
// Keyed on TCC_ADMIN_TOKEN — server-only; unset = adoption always denied
// (fail closed, the SMS link degrades to a bare /go).
import { createHmac, timingSafeEqual } from "crypto";

export function sidToken(sid: string): string {
  const key = process.env.TCC_ADMIN_TOKEN || "";
  if (!key) return "";
  return createHmac("sha256", key).update(`gosid:${sid}`).digest("hex").slice(0, 20);
}

export function sidTokenValid(sid: string, k: string): boolean {
  const want = sidToken(sid);
  if (!want || !k || k.length !== want.length) return false;
  try {
    return timingSafeEqual(Buffer.from(k), Buffer.from(want));
  } catch {
    return false;
  }
}
