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

import { createHash, createHmac } from "crypto";
import { put, list, del } from "@vercel/blob";

// 2h standdown per takeover signal — was 60 min; Sonny liked the feature and
// asked for the longer window (2026-07-11): his convos often run past an hour.
export const DEFER_MS = 120 * 60_000;

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

// Hashes of everything the bot sent this customer in the last 48h, plus the
// timestamp of the newest send — owner-takeover detection needs both (a page
// message can only be a live human if it's NEWER than the bot's newest send;
// the CTM ad greeting and Meta's canned ice-breaker replies all land BEFORE
// the bot's first reply and are never in this ledger). Also sweeps older
// markers so the ts-sorted (oldest-first) listing never pushes fresh entries
// out of the 100-item window.
export async function listSentLedger(psid: string): Promise<{ hashes: Set<string>; newestTs: number }> {
  try {
    const { blobs } = await list({ prefix: `msgr-sent/${psid}/`, limit: 100 });
    const entries = blobs
      .map((b) => ({ m: b.pathname.match(/\/(\d{13})-([0-9a-f]{8})$/), url: b.url }))
      .filter((x) => x.m) as { m: RegExpMatchArray; url: string }[];
    const old = entries.filter((x) => Date.now() - Number(x.m[1]) > 48 * 3_600_000).map((x) => x.url);
    if (old.length) del(old).catch(() => {});
    const live = entries.filter((x) => Date.now() - Number(x.m[1]) <= 48 * 3_600_000);
    return {
      hashes: new Set(live.map((x) => x.m[2])),
      newestTs: live.reduce((max, x) => Math.max(max, Number(x.m[1])), 0),
    };
  } catch {
    return { hashes: new Set(), newestTs: 0 }; // fail open: no ledger → takeover detection stays quiet
  }
}
export async function listSentHashes(psid: string): Promise<Set<string>> {
  return (await listSentLedger(psid)).hashes;
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

// "Who is who" for owner alerts: resolve the sender's real profile name from
// the page inbox (the direct /{psid} profile read is blocked in DEV mode, the
// conversations lookup works). Best-effort — callers fall back to a contact #.
export async function senderName(psid: string): Promise<string> {
  const token = process.env.PAGE_ACCESS_TOKEN || "";
  if (!token) return "";
  try {
    const r = await fetch(
      `https://graph.facebook.com/v21.0/me/conversations?user_id=${encodeURIComponent(psid)}&fields=participants&access_token=${encodeURIComponent(token)}`,
      { cache: "no-store" },
    );
    const j = (await r.json().catch(() => null)) as { data?: { participants?: { data?: { name?: string; id?: string }[] } }[] } | null;
    return j?.data?.[0]?.participants?.data?.find((p) => p.id === psid)?.name || "";
  } catch {
    return "";
  }
}

// Signed token for the one-tap owner mute link (/api/msgr-ai?mute=<psid>&t=<hmac>)
// — HMAC of the contact id, so a link only works for that one conversation.
export function muteToken(psid: string): string {
  return createHmac("sha256", process.env.MSGR_BOT_SECRET || "").update(`mute:${psid}`).digest("hex").slice(0, 16);
}

// ---- blob-backed conversation memory (msgr-ctx/{psid}/{ts13}.txt) -----------
// The owned webhook has always kept its deep transcript here; the ManyChat path
// now writes it too, so a returning lead's history survives ManyChat's shallow
// 8-turn ai_ctx field — with the Graph thread read as the richer source when
// the page token is healthy, and this as the fallback when it isn't (the token
// died 2026-07-15 and the bot forgot a lead's whole prior deal — Rick Dee came
// back after 9 days asking "you remember what price you gave me?" and the bot
// had nothing). Unique ts-prefixed pathnames, newest wins — same CDN-staleness
// rule as every other marker here.
export async function loadCtxBlob(psid: string): Promise<string> {
  try {
    const { blobs } = await list({ prefix: `msgr-ctx/${psid}/`, limit: 100 });
    const entries = blobs
      .map((b) => ({ ts: Number(b.pathname.match(/\/(\d{13})\.txt$/)?.[1] || 0), url: b.url }))
      .filter((x) => x.ts)
      .sort((a, b) => b.ts - a.ts);
    if (!entries.length) return "";
    // Sweep all but the newest 3 so the ts-sorted (oldest-first) listing never
    // pushes the newest entry out of the 100-item window.
    const old = entries.slice(3).map((x) => x.url);
    if (old.length) del(old).catch(() => {});
    const r = await fetch(entries[0].url, { cache: "no-store" });
    return r.ok ? await r.text() : "";
  } catch {
    return "";
  }
}
export async function saveCtxBlob(psid: string, ctx: string): Promise<void> {
  try {
    await put(`msgr-ctx/${psid}/${String(Date.now()).padStart(13, "0")}.txt`, ctx, {
      access: "public",
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: "text/plain",
    });
  } catch {
    /* best-effort memory */
  }
}
