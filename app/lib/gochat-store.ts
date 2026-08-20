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
//   ctl   — control records; cmd lives in the path: tkon | tkoff | ntf
import { put, list, del } from "@vercel/blob";

export type ChatRole = "user" | "bot" | "owner" | "note" | "ctl";
export type StoredMsg = { role: Exclude<ChatRole, "ctl">; text: string; ts: number };
export type ChatState = {
  msgs: StoredMsg[];
  takeover: boolean;
  notified: boolean;
  lastTs: number;
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

const CTL_CMD: Record<string, string> = { "takeover:on": "tkon", "takeover:off": "tkoff", notified: "ntf" };

export async function appendChatMsg(sid: string, role: ChatRole, text: string): Promise<void> {
  if (!validSession(sid)) return;
  const ts = Date.now();
  const rand = Math.random().toString(36).slice(2, 6);
  const cmd = role === "ctl" ? CTL_CMD[text] || "tkoff" : null;
  const path = cmd
    ? `gochat/${sid}/${ts}-ctl-${cmd}-${rand}.json`
    : `gochat/${sid}/${ts}-${role}-${rand}.json`;
  await put(
    path,
    JSON.stringify({ role, text: cmd ? text : String(text).slice(0, 2000), ts }),
    { access: "public", contentType: "application/json", addRandomSuffix: false },
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

export async function readChat(sid: string, after = 0): Promise<ChatState> {
  const empty: ChatState = { msgs: [], takeover: false, notified: false, lastTs: 0 };
  if (!validSession(sid)) return empty;
  try {
    const { blobs } = await list({ prefix: `gochat/${sid}/`, limit: 1000 });
    const parsed = blobs
      .map((b) => ({ url: b.url, p: parsePath(b.pathname) }))
      .filter((b): b is { url: string; p: Parsed } => b.p !== null)
      .sort((a, b) => a.p.ts - b.p.ts);
    let takeover = false;
    let notified = false;
    let lastTs = 0;
    for (const b of parsed) {
      if (b.p.ts > lastTs) lastTs = b.p.ts;
      if (b.p.role !== "ctl") continue;
      if (b.p.cmd === "tkon") takeover = true;
      else if (b.p.cmd === "tkoff") takeover = false;
      if (b.p.cmd === "ntf") notified = true;
    }
    const wanted = parsed.filter((b) => b.p.role !== "ctl" && b.p.ts > after);
    const fetched = await Promise.all(
      wanted.map((b) =>
        fetch(b.url, { cache: "no-store" })
          .then((r) => r.json())
          .then((j) => (j && typeof j.text === "string" ? { role: b.p.role as StoredMsg["role"], text: j.text as string, ts: b.p.ts } : null))
          .catch(() => null),
      ),
    );
    return { msgs: fetched.filter((m): m is StoredMsg => m !== null), takeover, notified, lastTs };
  } catch {
    return empty;
  }
}

/**
 * Newest-first inbox for /admin/chats. Walks the WHOLE gochat/ tree with
 * cursor pagination (bounded), so the inbox cannot silently truncate at the
 * SDK's 1000-blob page like a single list() would. Sessions idle >30 days
 * are pruned (best-effort, bounded) so the tree stays small and cheap.
 */
export async function listChatSessions(): Promise<{ sid: string; lastTs: number; count: number }[]> {
  try {
    const by = new Map<string, { lastTs: number; count: number; urls: string[] }>();
    let cursor: string | undefined;
    for (let page = 0; page < 20; page++) {
      const res = await list({ prefix: "gochat/", limit: 1000, cursor });
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
      void del(urls).catch(() => {});
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
      const { blobs } = await list({ prefix: `gochat-img/${sid}/`, limit: 1000 });
      if (blobs.length) await del(blobs.map((b) => b.url));
    } catch { /* a failed prune retries on the next stale sweep */ }
  }
}
