// Server-side store for /go site-chat sessions — the layer that makes LIVE
// OWNER TAKEOVER possible (ManyChat-style: Sonny sees a hot chat, jumps in,
// the bot steps aside, and the seller can tell it's a human).
//
// Storage is Vercel Blob, APPEND-ONLY: every message is its own blob under
// gochat/<sessionId>/<ts>-<role>[-<cmd>]-<rand>.json. Unique paths sidestep
// the same-path CDN staleness (~60s) that bit us before — nothing here is
// ever overwritten. Control state (takeover on/off, owner-notified) is
// encoded IN THE PATHNAME, so deriving it costs a list() and ZERO fetches —
// this runs in the critical path of every /api/chat message.
//
// Roles:
//   user  — the seller
//   bot   — AI replies
//   owner — Sonny, sent from /admin/chats (rendered distinctly client-side)
//   note  — milestone breadcrumbs from the guided funnel (quote shown, lock)
//   ctl   — control records; cmd lives in the path: tkon | tkoff | ntf | bnd
import { put, list, del } from "@vercel/blob";

export type ChatRole = "user" | "bot" | "owner" | "note" | "ctl";
export type StoredMsg = { role: Exclude<ChatRole, "ctl">; text: string; ts: number };
export type ChatState = {
  msgs: StoredMsg[];
  takeover: boolean;
  notified: boolean;
  lastTs: number;
  // When the takeover last changed / the owner last spoke — lets callers
  // expire an abandoned takeover instead of muting the bot forever.
  takeoverTs: number;
  lastOwnerTs: number;
  // The oldest record's ts, pathname-derived like lastTs (0 when none) —
  // the legacy-session grace in go-owner keys on it (2026-09-26).
  firstTs: number;
  // A browser has taken this legacy session under that grace (ctl `bnd`) —
  // the next cookie-less one is refused like any other.
  bound: boolean;
};

const SID_RE = /^[a-z0-9_-]{4,32}$/i;
export function validSession(sid: unknown): sid is string {
  return typeof sid === "string" && SID_RE.test(sid);
}
// Strict shape for the PUBLIC /go endpoints (chat-sync): only ids the /go
// client generator can actually mint (go[-src]-<rand>). Blocks arbitrary
// attacker-chosen prefixes from creating junk sessions.
const GO_SID_RE = /^go(-[a-z0-9]{1,10})?-[a-z0-9]{2,12}$/i;
export function validGoSession(sid: unknown): sid is string {
  return typeof sid === "string" && sid.length <= 32 && GO_SID_RE.test(sid);
}

// Every Blob call here is bounded. The store sits on the critical path of
// every chat turn, and Blob calls carried no timeout at all — one stalled
// list() or record fetch held a turn open until the platform's 300 s limit
// (prod, 2026-09-22) while the seller watched typing dots.
const BLOB_OP_MS = 8_000;    // list / put / del
const BLOB_FETCH_MS = 6_000; // one record's content
const deadline = (ms: number) => AbortSignal.timeout(ms);

// A record never changes once written (unique path, never overwritten), so
// one read per instance is enough. Without this a long thread re-fetched
// every record on every turn — a 40-turn chat was ~160 content fetches per
// message, and a lock read the whole thread twice more.
const MSG_CACHE_MAX = 4000;
const msgCache = new Map<string, StoredMsg>();
async function fetchMsg(url: string, role: StoredMsg["role"], ts: number): Promise<StoredMsg | null> {
  const hit = msgCache.get(url);
  if (hit) return hit;
  try {
    const r = await fetch(url, { cache: "no-store", signal: deadline(BLOB_FETCH_MS) });
    const j = await r.json();
    if (!j || typeof j.text !== "string") return null;
    const m: StoredMsg = { role, text: j.text as string, ts };
    if (msgCache.size >= MSG_CACHE_MAX) msgCache.delete(msgCache.keys().next().value as string);
    msgCache.set(url, m);
    return m;
  } catch {
    return null;
  }
}

// `bound` (2026-09-26): the legacy grace was used on this session once.
const CTL_CMD: Record<string, string> = { "takeover:on": "tkon", "takeover:off": "tkoff", notified: "ntf", bound: "bnd" };

// `ts` may be supplied (2026-09-26): the chat route fixes its reply's ts
// before it answers and returns it, so the client can match its own echo
// against the same record arriving through the chat-sync poll.
export async function appendChatMsg(sid: string, role: ChatRole, text: string, ts = Date.now()): Promise<void> {
  if (!validSession(sid)) return;
  const rand = Math.random().toString(36).slice(2, 6);
  const cmd = role === "ctl" ? CTL_CMD[text] || "tkoff" : null;
  const path = cmd
    ? `gochat/${sid}/${ts}-ctl-${cmd}-${rand}.json`
    : `gochat/${sid}/${ts}-${role}-${rand}.json`;
  await put(
    path,
    JSON.stringify({ role, text: cmd ? text : String(text).slice(0, 2000), ts }),
    { access: "public", contentType: "application/json", addRandomSuffix: false, abortSignal: deadline(BLOB_OP_MS) },
  ).catch(() => { /* a dropped chat log must never break the chat itself */ });
}

// ts / role / ctl-cmd are all encoded in the pathname, so state derivation
// and `after` filtering need no content fetches at all.
type Parsed = { ts: number; role: ChatRole; cmd: string | null };
function parsePath(pathname: string): Parsed | null {
  const base = (pathname.split("/").pop() || "").replace(/\.json$/, "");
  const parts = base.split("-");
  const ts = Number(parts[0]);
  const role = parts[1] as ChatRole;
  if (!Number.isFinite(ts)) return null;
  if (role === "ctl") return { ts, role, cmd: parts[2] || null };
  if (role === "user" || role === "bot" || role === "owner" || role === "note") return { ts, role, cmd: null };
  return null;
}

// `cap` bounds CONTENT fetches to the newest N non-ctl records — the chat
// route reads the store every turn and only needs recent history + notes;
// flags (takeover/notified/ts) stay pathname-derived over the FULL record
// list regardless. `noteCap` also keeps the newest N NOTE records from
// before that window (role is in the pathname — no extra list call): on a
// long chat the cap used to drop the early CONTACT/LOCKED/GEO/quote notes,
// which re-fired the lead and hid the lock and the quoted numbers.
export async function readChat(sid: string, after = 0, cap = Infinity, noteCap = 0): Promise<ChatState> {
  const empty: ChatState = { msgs: [], takeover: false, notified: false, lastTs: 0, takeoverTs: 0, lastOwnerTs: 0, firstTs: 0, bound: false };
  if (!validSession(sid)) return empty;
  try {
    // Paginate like listChatSessions does — a single list() silently truncates
    // at the SDK's 1000-blob page, and blobs list OLDEST-first (paths start
    // with the ms timestamp), so truncation would hide the NEWEST records:
    // takeover ctl flags and owner messages. Bounded at 5 pages.
    const blobs: { url: string; pathname: string }[] = [];
    let cursor: string | undefined;
    for (let page = 0; page < 5; page++) {
      const res = await list({ prefix: `gochat/${sid}/`, limit: 1000, cursor, abortSignal: deadline(BLOB_OP_MS) });
      blobs.push(...res.blobs);
      if (!res.hasMore || !res.cursor) break;
      cursor = res.cursor;
    }
    const parsed = blobs
      .map((b) => ({ url: b.url, p: parsePath(b.pathname) }))
      .filter((b): b is { url: string; p: Parsed } => b.p !== null)
      .sort((a, b) => a.p.ts - b.p.ts);
    let takeover = false;
    let notified = false;
    let lastTs = 0;
    let firstTs = 0;
    let bound = false;
    let takeoverTs = 0;
    let lastOwnerTs = 0;
    for (const b of parsed) {
      if (b.p.ts > lastTs) lastTs = b.p.ts;
      if (!firstTs || b.p.ts < firstTs) firstTs = b.p.ts;
      if (b.p.role === "owner" && b.p.ts > lastOwnerTs) lastOwnerTs = b.p.ts;
      if (b.p.role !== "ctl") continue;
      if (b.p.cmd === "tkon") { takeover = true; takeoverTs = b.p.ts; }
      else if (b.p.cmd === "tkoff") { takeover = false; takeoverTs = b.p.ts; }
      if (b.p.cmd === "ntf") notified = true;
      if (b.p.cmd === "bnd") bound = true;
    }
    const records = parsed.filter((b) => b.p.role !== "ctl" && b.p.ts > after);
    const keep = new Set([
      ...records.slice(-(Number.isFinite(cap) ? cap : parsed.length)),
      ...(noteCap > 0 ? records.filter((b) => b.p.role === "note").slice(-noteCap) : []),
    ]);
    const wanted = records.filter((b) => keep.has(b));
    const fetched = await Promise.all(wanted.map((b) => fetchMsg(b.url, b.p.role as StoredMsg["role"], b.p.ts)));
    return { msgs: fetched.filter((m): m is StoredMsg => m !== null), takeover, notified, lastTs, takeoverTs, lastOwnerTs, firstTs, bound };
  } catch {
    return empty;
  }
}

// An abandoned takeover must not mute the bot forever (live case: a seller's
// session ended on takeover:on with zero owner messages after — every message
// they send all week would be swallowed silently). Stale = takeover on and
// the owner hasn't touched the thread (flag or message) in 2 hours.
export const TAKEOVER_STALE_MS = 2 * 3600_000;
export function takeoverStale(state: ChatState, now = Date.now()): boolean {
  if (!state.takeover) return false;
  const lastOwnerActivity = Math.max(state.takeoverTs, state.lastOwnerTs);
  return lastOwnerActivity > 0 && now - lastOwnerActivity > TAKEOVER_STALE_MS;
}

/**
 * Newest-first inbox for /admin/chats. Walks the WHOLE gochat/ tree with
 * cursor pagination (bounded), so the inbox cannot silently truncate at the
 * SDK's 1000-blob page like a single list() would. Sessions idle >30 days
 * are pruned (best-effort, bounded) so the tree stays small and cheap.
 */
// The admin console reloads its inbox every 15 s and the inbound-SMS
// matcher falls back to it — each call walks the whole gochat/ tree (up to
// 20 list pages). A short per-instance memo means a console left open
// doesn't re-walk the tree on every tick; the open thread's own 4 s poll is
// what carries live messages.
const INBOX_MEMO_MS = 20_000;
let inboxSnap: { v: { sid: string; lastTs: number; count: number }[]; at: number } | null = null;

export async function listChatSessions(): Promise<{ sid: string; lastTs: number; count: number }[]> {
  if (inboxSnap && Date.now() - inboxSnap.at < INBOX_MEMO_MS) return inboxSnap.v;
  const v = await walkChatSessions();
  if (v.length) inboxSnap = { v, at: Date.now() };
  return v;
}

async function walkChatSessions(): Promise<{ sid: string; lastTs: number; count: number }[]> {
  try {
    const by = new Map<string, { lastTs: number; count: number; urls: string[] }>();
    let cursor: string | undefined;
    for (let page = 0; page < 20; page++) {
      const res = await list({ prefix: "gochat/", limit: 1000, cursor, abortSignal: deadline(BLOB_OP_MS) });
      for (const b of res.blobs) {
        const parts = b.pathname.split("/");
        if (parts.length < 3) continue;
        const sid = parts[1];
        const p = parsePath(b.pathname);
        if (!p) continue;
        const cur = by.get(sid) || { lastTs: 0, count: 0, urls: [] };
        cur.count++;
        cur.urls.push(b.url);
        if (p.ts > cur.lastTs) cur.lastTs = p.ts;
        by.set(sid, cur);
      }
      if (!res.hasMore || !res.cursor) break;
      cursor = res.cursor;
    }
    // Retention sweep: sessions idle >30 days get deleted (bounded per load
    // so one inbox view never does unbounded work). Fire-and-forget.
    const cutoff = Date.now() - 30 * 24 * 3600_000;
    const stale = [...by.entries()].filter(([, v]) => v.lastTs < cutoff);
    if (stale.length) {
      const urls = stale.flatMap(([, v]) => v.urls).slice(0, 400);
      void del(urls, { abortSignal: deadline(BLOB_OP_MS) }).catch(() => {});
      // Photo blobs live under a SEPARATE prefix (gochat-img/<sid>/) that the
      // message-blob urls above never cover — prune each stale session's
      // photos too, or seller device pics (faces, EXIF, serials) stay public
      // forever and storage grows unbounded. Bounded: only stale sids swept.
      void pruneSessionImages(stale.map(([sid]) => sid).slice(0, 40));
      for (const [sid] of stale) by.delete(sid);
    }
    return [...by.entries()]
      .map(([sid, v]) => ({ sid, lastTs: v.lastTs, count: v.count }))
      .sort((a, b) => b.lastTs - a.lastTs)
      .slice(0, 100);
  } catch {
    return [];
  }
}

// Delete every photo blob for the given (stale) sessions. Best-effort and
// bounded — called from the retention sweep so nothing runs unbounded per load.
async function pruneSessionImages(sids: string[]): Promise<void> {
  for (const sid of sids) {
    if (!validSession(sid)) continue;
    try {
      const { blobs } = await list({ prefix: `gochat-img/${sid}/`, limit: 1000, abortSignal: deadline(BLOB_OP_MS) });
      if (blobs.length) await del(blobs.map((b) => b.url), { abortSignal: deadline(BLOB_OP_MS) });
    } catch { /* a failed prune retries on the next stale sweep */ }
  }
}

// ── Phone → session lookup (INBOUND seller SMS) ──────────────────────────
//
// Sellers reply to the texts /admin/chats sends them, and those replies land
// on the NOTARY project's Telnyx webhook — it owns the number we borrow. That
// webhook hands them back to /api/go/sms-inbound, which needs to know which
// thread the reply belongs to. Match = the newest session that TEXTED that
// 10-digit number (its "SMS sent to …" note) — since 2026-09-26; a typed
// "CONTACT: " note no longer counts, see rememberPhoneSession.
//
// Deliberately bounded (this runs off a webhook): a window of recent sessions,
// and ONLY note-role blobs are fetched — role is pathname-encoded, so
// narrowing to notes costs zero fetches.

/** Last 10 digits, or "" if that's not a phone. Comparison key for contacts. */
export function phoneKey(v: unknown): string {
  const d = String(v ?? "").replace(/\D/g, "");
  return d.length >= 10 ? d.slice(-10) : "";
}

// Phone → session POINTER, written when TCC TEXTS a number from a session
// (lock confirmation, the console's "also text", the reminder cron) — the
// moment a reply becomes expected. Until 2026-09-26 it was written whenever
// a contact landed, including a number merely TYPED into a chat: anyone
// could type a stranger's number and route that stranger's SMS replies (and
// a server-signed deep link into their own thread) to themselves.
// One tiny blob per (number, time) under gochat-phone/<key>/<ts>-<sid>.json:
// unique paths (no CDN-stale overwrites) and the sid rides in the pathname,
// so a lookup is ONE list() with zero fetches. The scan below stayed as the
// fallback, but it only covers the 20 most recent sessions — a seller who
// replies MEET to the day-13 expiry text was outside it (every tile tap
// mints a session now), so their reply silently matched nothing.
export async function rememberPhoneSession(contact: string, sid: string): Promise<void> {
  const key = phoneKey(contact);
  if (!key || !validSession(sid)) return;
  await put(`gochat-phone/${key}/${Date.now()}-${sid}.json`, "{}", {
    access: "public", contentType: "application/json", addRandomSuffix: false, abortSignal: deadline(BLOB_OP_MS),
  }).catch(() => { /* the scan fallback still works */ });
}

// The record that makes a phone→session match legitimate: the note every
// seller-SMS path writes on success ("SMS sent to <contact>…"). A session
// that texted this number from itself is where the reply belongs.
const SMS_SENT_PREFIX = "SMS sent to ";
const PHONE_SHAPE = /(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/;
/** The 10-digit key of an "SMS sent to …" note, or "" for any other note. */
export function smsSentKey(note: string): string {
  if (!note.startsWith(SMS_SENT_PREFIX)) return "";
  // The contact was stored as typed ("call me at 512-555-1212 after 5"), so
  // the number is the first phone-shaped run, not every digit in the line.
  return phoneKey(note.slice(SMS_SENT_PREFIX.length).match(PHONE_SHAPE)?.[0] || "");
}

/** True when the session holds an "SMS sent to" note for this number. Notes
 *  only (role is in the pathname), newest 60 — a chatty thread parks an
 *  "SMS sent to" note per owner text, so the confirmation can sit deep. */
async function textedFrom(sid: string, key: string): Promise<boolean> {
  if (!key || !validSession(sid)) return false;
  const state = await readChat(sid, 0, 1, 60);
  return state.msgs.some((m) => m.role === "note" && smsSentKey(m.text) === key);
}

async function pointerSession(phone: string): Promise<string | null> {
  const key = phoneKey(phone);
  if (!key) return null;
  try {
    const { blobs } = await list({ prefix: `gochat-phone/${key}/`, limit: 100, abortSignal: deadline(BLOB_OP_MS) });
    // Sessions are pruned at 30 days idle; a pointer older than that would
    // resurrect a dead thread (and a "meet"-shaped text from an old seller
    // would post a phantom delivery option). Ignore it and let the scan run.
    const floor = Date.now() - 30 * 24 * 3600_000;
    const pointed: { ts: number; sid: string }[] = [];
    for (const b of blobs) {
      const m = (b.pathname.split("/").pop() || "").match(/^(\d+)-(.+)\.json$/);
      if (!m) continue;
      const ts = Number(m[1]);
      if (Number.isFinite(ts) && ts >= floor && validSession(m[2])) pointed.push({ ts, sid: m[2] });
    }
    // Newest first — and ONLY a session that actually texted this number
    // (2026-09-26): pointers written before that rule, from typed contacts,
    // are still in the store, and one planted from a stranger's chat must
    // never win. The note read also proves the thread still exists (pruned
    // sessions leave their pointer behind). Bounded: 5 candidates.
    for (const p of pointed.sort((a, b) => b.ts - a.ts).slice(0, 5)) {
      if (await textedFrom(p.sid, key)) return p.sid;
    }
    return null;
  } catch {
    return null;
  }
}

/** The numbers one session has TEXTED — its "SMS sent to" notes, newest 40.
 *  Notes only (role is pathname-encoded), so this costs one list plus the
 *  note fetches; a CONTACT note alone is what the seller typed and proves
 *  nothing (2026-09-26). */
async function textedKeysFor(sid: string): Promise<Set<string>> {
  const out = new Set<string>();
  if (!validSession(sid)) return out;
  try {
    const { blobs } = await list({ prefix: `gochat/${sid}/`, limit: 1000, abortSignal: deadline(BLOB_OP_MS) });
    const notes = blobs
      .map((b) => ({ url: b.url, p: parsePath(b.pathname) }))
      .filter((b): b is { url: string; p: Parsed } => b.p !== null && b.p.role === "note")
      .sort((a, b) => b.p.ts - a.p.ts)
      .slice(0, 40);
    const texts = await Promise.all(notes.map((n) => fetchMsg(n.url, "note", n.p.ts).then((m) => m?.text || "")));
    for (const t of texts) { const k = smsSentKey(t); if (k) out.add(k); }
  } catch { /* no notes → no match */ }
  return out;
}

export async function findSessionByPhone(
  phone: string,
  maxAgeMs = 14 * 24 * 3600_000,
  maxSessions = 20,
): Promise<string | null> {
  const want = phoneKey(phone);
  if (!want) return null;
  // Newest verified pointer first — one list plus a note read per candidate.
  const pointed = await pointerSession(phone);
  if (pointed) return pointed;
  const cutoff = Date.now() - maxAgeMs;
  const recent = (await listChatSessions()).filter((s) => s.lastTs >= cutoff).slice(0, maxSessions);
  const texted = await Promise.all(recent.map((s) => textedKeysFor(s.sid)));
  // listChatSessions is newest-first — if a seller has used the number twice,
  // the reply belongs to the thread they're actually mid-negotiation on.
  // A thread that never texted this number is no match, however recent.
  const i = texted.findIndex((keys) => keys.has(want));
  return i === -1 ? null : recent[i].sid;
}
