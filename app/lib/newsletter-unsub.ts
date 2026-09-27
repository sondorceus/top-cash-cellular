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
// The blob path is an HMAC of the lowercased address (the store is public; a
// plain address in a path would be readable by anyone who has seen one photo
// URL). Keyed on NEWSLETTER_HASH_SECRET when set, else the legacy key
// (TCC_ADMIN_TOKEN; unkeyed SHA-256 when neither exists — still not
// reversible). 2026-09-27: the key used to be the admin token alone, so
// rotating it would have orphaned every opt-out on record. Reads now check
// the digest under EVERY configured key (new secret + legacy), writes go
// under the primary only — an env change never loses an existing record.
import { put, list, del } from "@vercel/blob";
import { createHash, createHmac } from "crypto";

const UNSUB_PREFIX = "newsletter-unsub/";
const BLOB_OP_MS = 8_000;

// Digest keys, primary first, deduped (one value set in both envs is not
// checked twice). "" = unkeyed, the pre-key legacy digest.
function digestKeys(): string[] {
  const keys: string[] = [];
  for (const k of [process.env.NEWSLETTER_HASH_SECRET, process.env.TCC_ADMIN_TOKEN]) {
    if (k && !keys.includes(k)) keys.push(k);
  }
  if (keys.length === 0) keys.push("");
  return keys;
}

function digestWith(key: string, scope: string, email: string): string {
  const norm = email.trim().toLowerCase();
  const h = key ? createHmac("sha256", key) : createHash("sha256");
  return h.update(`${scope}:${norm}`).digest("hex").slice(0, 32);
}

// Every digest an address may be recorded under, primary first.
function digests(scope: string, email: string): string[] {
  return digestKeys().map((k) => digestWith(k, scope, email));
}

/** Opaque per-address id for the [NEWSLETTER-SENT] `to=` lists — never the address itself. Primary key. */
export function newsletterEmailHash(email: string): string {
  return digests("nlsent", email)[0];
}

/** Every id an address may have been marked under (primary + legacy) — a key change must not re-mail a retry. */
export function newsletterEmailHashes(email: string): string[] {
  return digests("nlsent", email);
}

/** The blob-path digests an opt-out for this address may live under, primary first. */
export function newsletterUnsubDigests(email: string): string[] {
  return digests("nlunsub", email);
}

/** Record an unsubscribe for good. Best-effort: callers write the comms marker regardless. */
export async function markNewsletterUnsub(email: string): Promise<boolean> {
  const norm = email.trim().toLowerCase();
  if (!norm) return false;
  try {
    await put(`${UNSUB_PREFIX}${newsletterUnsubDigests(norm)[0]}/1.json`, JSON.stringify({ at: new Date().toISOString() }), {
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
 * Checks every candidate digest (2026-09-27) so a record written under the
 * legacy key still counts once NEWSLETTER_HASH_SECRET is introduced.
 */
export async function isNewsletterUnsubbed(email: string): Promise<boolean | null> {
  const norm = email.trim().toLowerCase();
  if (!norm) return null;
  let unreadable = false;
  for (const d of newsletterUnsubDigests(norm)) {
    try {
      const { blobs } = await list({
        prefix: `${UNSUB_PREFIX}${d}/`,
        limit: 1,
        abortSignal: AbortSignal.timeout(BLOB_OP_MS),
      });
      if (blobs.length > 0) return true;
    } catch {
      unreadable = true;
    }
  }
  return unreadable ? null : false;
}

/**
 * Every opt-out digest in the store in one paginated walk (2026-09-27): the
 * send route used to `list()` once per recipient — 100-300 ms each, most of
 * the send budget at a few hundred addresses. null = the store could not be
 * read; a sender aborts rather than mail with an unknown opt-out set.
 */
export async function listNewsletterUnsubDigests(): Promise<Set<string> | null> {
  const out = new Set<string>();
  let cursor: string | undefined;
  try {
    do {
      const page = await list({ prefix: UNSUB_PREFIX, limit: 1000, cursor, abortSignal: AbortSignal.timeout(BLOB_OP_MS) });
      for (const b of page.blobs) {
        const seg = b.pathname.slice(UNSUB_PREFIX.length).split("/")[0];
        if (seg) out.add(seg);
      }
      cursor = page.hasMore ? page.cursor : undefined;
    } while (cursor);
    return out;
  } catch {
    return null;
  }
}

/** Whether an address is in a set from listNewsletterUnsubDigests, under any candidate key. */
export function isUnsubbedIn(digestSet: Set<string>, email: string): boolean {
  return newsletterUnsubDigests(email).some((d) => digestSet.has(d));
}

/**
 * Forget a durable opt-out — a signup is fresh consent (2026-09-27; before
 * this a re-subscriber showed on the roster and was silently skipped on every
 * blast). Removes the record under every candidate key. true when nothing is
 * left (including nothing to remove); false when the store could not be
 * read or written.
 */
export async function clearNewsletterUnsub(email: string): Promise<boolean> {
  const norm = email.trim().toLowerCase();
  if (!norm) return false;
  try {
    for (const d of newsletterUnsubDigests(norm)) {
      const { blobs } = await list({ prefix: `${UNSUB_PREFIX}${d}/`, limit: 10, abortSignal: AbortSignal.timeout(BLOB_OP_MS) });
      if (blobs.length > 0) await del(blobs.map((b) => b.url), { abortSignal: AbortSignal.timeout(BLOB_OP_MS) });
    }
    return true;
  } catch {
    return false;
  }
}
