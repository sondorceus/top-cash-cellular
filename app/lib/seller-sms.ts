// Seller-facing SMS via the notary project's Telnyx number, through its
// authed relay endpoint (POST itsofficialnotarys.com/api/sms/relay). The
// Telnyx key is a sensitive var on THAT Vercel project and never leaves it;
// this side only holds the shared SMS_RELAY_TOKEN.
//
// Sonny 2026-08-19: "we can use that number since its setup and ready."
// The channel is TWO-WAY since 142ce8c: the notary webhook forwards every
// inbound text to /api/go/sms-inbound, which drops the reply into the
// seller's /go thread (and handles STOP / MEET / SHIP keywords). Keep texts
// transactional — about the seller's own quote — the number's carrier
// registration belongs to the notary brand.
//
// Best-effort like owner-sms: never throws, returns false on any failure.
import { put, list } from "@vercel/blob";
import { phoneKey } from "./gochat-store";

const RELAY_URL = "https://itsofficialnotarys.com/api/sms/relay";

/** +1XXXXXXXXXX for a US number in any common shape, else null. Accepts a
 *  contact field that merely CONTAINS a number ("call me at 512-555-1212
 *  after 5") — the lock route's phone check is unanchored, so it does. */
export function toE164(v: string): string | null {
  const m = String(v || "").match(/(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/);
  const d = (m ? m[0] : "").replace(/\D/g, "");
  if (d.length === 10) return `+1${d}`;
  if (d.length === 11 && d.startsWith("1")) return `+${d}`;
  return null;
}

export async function sendSellerSms(to: string, body: string): Promise<boolean> {
  const token = process.env.SMS_RELAY_TOKEN || "";
  const dest = toE164(to);
  if (!token || !dest || !body.trim()) return false;
  if (await optedOutDurably(dest)) return false;
  try {
    const res = await fetch(RELAY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-relay-token": token },
      body: JSON.stringify({ to: dest, body: body.slice(0, 480) }),
      // A hung relay must not hold the caller (the owner alert fan-out and
      // the /go lock route both wait on this).
      signal: AbortSignal.timeout(8_000),
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

// ── Opt-out (STOP) ────────────────────────────────────────────────────────
// A seller who texts STOP is recorded in two places: a session note (so the
// takeover console and the lock route see it without a network hop) and an
// MC marker keyed on the 10-digit number (so the crons, which already load
// the comms window, can skip the number across sessions).
// The WHOLE message must be the keyword — "cancel that, I'll meet instead"
// and "end of day works" are conversation, not opt-outs.
export const STOP_RE = /^\s*(stop|stopall|unsubscribe|cancel|end|quit)\s*[.!]*\s*$/i;
export const SMS_STOP_NOTE = "SMS-STOP";

export function smsOptOutMarker(phone: string): string {
  return `[SMS-OPT-OUT: ${phoneKey(phone) || "unknown"}]`;
}

/** True when any note in the session records a STOP. */
export function notesHaveOptOut(notes: string[]): boolean {
  return notes.some((t) => t.startsWith(SMS_STOP_NOTE));
}

/** True when an [SMS-OPT-OUT: <key>] marker exists for this number. */
export function optedOutIn(messages: { body?: string }[], phone: string): boolean {
  const key = phoneKey(phone);
  if (!key) return false;
  const re = new RegExp(`\\[SMS-OPT-OUT:\\s*${key}\\]`);
  return messages.some((m) => !!m.body && re.test(m.body));
}

// Durable STOP. The marker only lives as long as a cron's comms window
// (21–30 days): a seller who texted STOP once the marker paged out would be
// texted again. One tiny blob per number under sms-optout/<key>/1.json
// outlives every window, and sendSellerSms checks it on EVERY send — one
// list(), zero fetches — so no sender can miss it.
const OPTOUT_PREFIX = "sms-optout/";
const BLOB_OP_MS = 8_000;

/** Record a STOP for good. Best-effort: the session note and the MC marker
 *  are written by the caller regardless. */
export async function markOptedOut(phone: string): Promise<void> {
  const key = phoneKey(phone);
  if (!key) return;
  await put(`${OPTOUT_PREFIX}${key}/1.json`, "{}", {
    access: "public", contentType: "application/json", addRandomSuffix: false, allowOverwrite: true, abortSignal: AbortSignal.timeout(BLOB_OP_MS),
  }).catch(() => {});
}

/** True when the number's opt-out blob exists. A storage hiccup reads as
 *  "not opted out" — a legitimate text is never blocked on the store. */
async function optedOutDurably(phone: string): Promise<boolean> {
  const key = phoneKey(phone);
  if (!key) return false;
  try {
    const { blobs } = await list({ prefix: `${OPTOUT_PREFIX}${key}/`, limit: 1, abortSignal: AbortSignal.timeout(BLOB_OP_MS) });
    return blobs.length > 0;
  } catch {
    return false;
  }
}
