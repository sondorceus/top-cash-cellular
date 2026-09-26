// Durable newsletter unsubscribes + per-recipient send bookkeeping.
//
// The [NEWSLETTER UNSUB] comms marker is the audit record, but a marker only
// lives as long as the feed window a reader pages through; the send route
// used to rebuild its recipient list from the newest 2,000 messages, so an
// unsubscribe older than that was forgotten and the address was mailed
// again. One tiny blob per address under newsletter-unsub/<key>/1.json
// outlives every window (the seller-sms opt-out pattern), and the send route
// checks it for EVERY recipient before Resend is called — failing CLOSED
// when the store can't be read. 2026-09-26.
//
// The blob path is an HMAC of the lowercased address keyed on TCC_ADMIN_TOKEN
// (the store is public; a plain address in a path would be readable by
// anyone who has seen one photo URL). No key configured → unkeyed SHA-256,
// still not reversible.
import { put, list } from "@vercel/blob";
import { createHash, createHmac } from "crypto";

const UNSUB_PREFIX = "newsletter-unsub/";
const BLOB_OP_MS = 8_000;

function digest(scope: string, email: string): string {
  const norm = email.trim().toLowerCase();
  const key = process.env.TCC_ADMIN_TOKEN || "";
  const h = key ? createHmac("sha256", key) : createHash("sha256");
  return h.update(`${scope}:${norm}`).digest("hex").slice(0, 32);
}

/** Opaque per-address id for the [NEWSLETTER-SENT] `to=` lists — never the address itself. */
export function newsletterEmailHash(email: string): string {
  return digest("nlsent", email);
}

/** Record an unsubscribe for good. Best-effort: callers write the comms marker regardless. */
export async function markNewsletterUnsub(email: string): Promise<boolean> {
  const norm = email.trim().toLowerCase();
  if (!norm) return false;
  try {
    await put(`${UNSUB_PREFIX}${digest("nlunsub", norm)}/1.json`, JSON.stringify({ at: new Date().toISOString() }), {
      access: "public",
      contentType: "application/json",
      addRandomSuffix: false,
      allowOverwrite: true,
      abortSignal: AbortSignal.timeout(BLOB_OP_MS),
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * true = unsubscribed, false = not, null = the store could not be read.
 * Senders treat null as "do not mail" (fail closed) and count the skip.
 */
export async function isNewsletterUnsubbed(email: string): Promise<boolean | null> {
  const norm = email.trim().toLowerCase();
  if (!norm) return null;
  try {
    const { blobs } = await list({
      prefix: `${UNSUB_PREFIX}${digest("nlunsub", norm)}/`,
      limit: 1,
      abortSignal: AbortSignal.timeout(BLOB_OP_MS),
    });
    return blobs.length > 0;
  } catch {
    return null;
  }
}
