// Messenger bot coordination signals, shared by every path that talks to a
// customer (/api/msgr funnel, /api/msgr-ai brain, /api/messenger webhook).
//
// SENT MARKERS — the bot's outbound ledger. Every customer-visible text any
// bot path sends is recorded as msgr-sent/{psid}/{ts13}-{hash8} (hash of the
// normalized text). This is what lets the AI look at the REAL Messenger thread
// from Graph and tell "that page message is mine" from "the OWNER typed that
// from Business Suite" — the ctx can't answer that anymore since it now mirrors
// the whole thread. Unique ts-prefixed pathnames + list(), per
// [[reference_vercel_blob_stale_overwrites]]: fixed-path overwrites are
// CDN-stale for ~60s and unusable as read-your-write markers.
//
// DEFER MARKERS — "human has the thread" standdown. msgr-defer/{psid}/{ts13};
// any marker younger than DEFER_MS silences the bot for that customer. Written
// by the owned webhook's echo detection AND by the AI brain's owner-takeover
// detection; read by both before replying.

import { createHash } from "crypto";
import { put, list, del } from "@vercel/blob";

export const DEFER_MS = 60 * 60_000; // 60 min standdown per takeover signal

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();

export function sentHash(text: string): string {
  return createHash("sha256").update(norm(text)).digest("hex").slice(0, 8);
}

// Record customer-visible outbound texts. Best-effort — a missed marker means
// at worst one false owner-takeover standdown (visible: owner gets an alert).
export async function recordOutbound(psid: string, texts: string[]): Promise<void> {
  const clean = texts.map((t) => (t || "").trim()).filter(Boolean);
  if (!psid || !clean.length) return;
  const ts = String(Date.now()).padStart(13, "0");
  await Promise.all(
    clean.map((t) =>
      put(`msgr-sent/${psid}/${ts}-${sentHash(t)}`, ".", {
        access: "public",
        addRandomSuffix: false,
        allowOverwrite: true,
        contentType: "text/plain",
      }).catch(() => {}),
    ),
  );
}

// Hashes of everything the bot sent this customer in the last 48h. Also sweeps
// older markers so the ts-sorted (oldest-first) listing never pushes fresh
// entries out of the 100-item window.
export async function listSentHashes(psid: string): Promise<Set<string>> {
  try {
    const { blobs } = await list({ prefix: `msgr-sent/${psid}/`, limit: 100 });
    const entries = blobs
      .map((b) => ({ m: b.pathname.match(/\/(\d{13})-([0-9a-f]{8})$/), url: b.url }))
      .filter((x) => x.m) as { m: RegExpMatchArray; url: string }[];
    const old = entries.filter((x) => Date.now() - Number(x.m[1]) > 48 * 3_600_000).map((x) => x.url);
    if (old.length) del(old).catch(() => {});
    return new Set(entries.filter((x) => Date.now() - Number(x.m[1]) <= 48 * 3_600_000).map((x) => x.m[2]));
  } catch {
    return new Set(); // fail open: no ledger → takeover detection stays quiet
  }
}

export async function markDefer(psid: string): Promise<void> {
  try {
    await put(`msgr-defer/${psid}/${String(Date.now()).padStart(13, "0")}`, ".", {
      access: "public",
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: "text/plain",
    });
  } catch {
    /* best-effort */
  }
}

export async function deferActive(psid: string): Promise<boolean> {
  try {
    const { blobs } = await list({ prefix: `msgr-defer/${psid}/`, limit: 100 });
    const ts = blobs
      .map((b) => ({ t: Number(b.pathname.match(/\/(\d{13})$/)?.[1] || 0), url: b.url }))
      .filter((x) => x.t);
    if (!ts.length) return false;
    const old = ts.filter((x) => Date.now() - x.t > DEFER_MS * 2).map((x) => x.url);
    if (old.length) del(old).catch(() => {});
    return ts.some((x) => Date.now() - x.t < DEFER_MS);
  } catch {
    return false; // fail open: reply rather than go silent on infra errors
  }
}
