import { NextRequest, NextResponse } from "next/server";
import { list, del } from "@vercel/blob";
import { safeEqual } from "../../../lib/admin-auth";

// Chat-store retention (2026-09-26). The inbox sweep in gochat-store prunes
// idle sessions, but only the ones its bounded 20-page walk can see (blobs
// list in sid order, so a busy month hides the sessions that sort last, and
// a hidden session is never pruned), and it never touched the phone→session
// pointers or the FedEx label PDFs. This walks each prefix to the END with
// its own cursor, once a day (vercel.json):
//   gochat/<sid>/…        a session idle > 30 days (newest record ts — the
//                          sweep's own rule) — unless a LOCKED note in it is
//                          younger than 90 days: an open trade's thread stays
//   gochat-img/<sid>/…    the photos of a session deleted here, or of one
//                          with no records left, once they are 30 days old
//   gochat-phone/<key>/…  pointers older than 30 days (the matcher ignores
//                          them past that anyway)
//   fedex-labels/*.pdf    label PDFs (name, address, phone) uploaded more
//                          than 90 days ago
// Bounded: at most MAX_DELETES blobs per run, the rest wait for tomorrow;
// a session's records go together or not at all. A prefix walk that hits
// MAX_PAGES deletes nothing under it (a cut-off session would look idle).
// ?dry=1 counts and deletes nothing.
// Auth: CRON_SECRET bearer, like every cron route here.

export const runtime = "nodejs";
export const maxDuration = 300;

const D = 24 * 3600_000;
const IDLE_MS = 30 * D;         // gochat-store's sweep rule
const LOCK_KEEP_MS = 90 * D;    // a LOCKED note younger than this keeps the session
const LABEL_KEEP_MS = 90 * D;
const MAX_DELETES = 2000;
const MAX_PAGES = 200;          // 200k blobs per prefix — a hard stop, reported
const NOTE_FETCH_BUDGET = 400;  // the LOCKED checks are the only content reads
const BLOB_OP_MS = 8_000;
const DEL_CHUNK = 100;

type Rec = { url: string; pathname: string; uploadedAt: Date };
type Sess = { lastTs: number; urls: string[]; notes: { url: string; ts: number }[] };
type Walk = { pages: number; truncated: boolean; error?: string };

const RECORD_RE = /^gochat\/([^/]+)\/(\d+)-(user|bot|owner|note|ctl)(?:-[a-z]+)?-[a-z0-9]+\.json$/;
const IMAGE_RE = /^gochat-img\/([^/]+)\/(\d+)-[a-z0-9]+\.[a-z0-9]+$/i;
const POINTER_RE = /^gochat-phone\/\d{10}\/(\d+)-[^/]+\.json$/;

async function walk(prefix: string, onBlob: (b: Rec) => void): Promise<Walk> {
  let cursor: string | undefined;
  try {
    for (let pages = 1; pages <= MAX_PAGES; pages++) {
      const page = await list({ prefix, limit: 1000, cursor, abortSignal: AbortSignal.timeout(BLOB_OP_MS) });
      for (const b of page.blobs) onBlob(b);
      if (!page.hasMore || !page.cursor) return { pages, truncated: false };
      cursor = page.cursor;
    }
    return { pages: MAX_PAGES, truncated: true };
  } catch (e) {
    return { pages: 0, truncated: true, error: e instanceof Error ? e.message : "list failed" };
  }
}

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || !safeEqual(req.headers.get("authorization"), `Bearer ${secret}`)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const dryRun = req.nextUrl.searchParams.get("dry") === "1";
  const now = Date.now();

  const queue: string[] = [];
  const counts = { records: 0, images: 0, pointers: 0, labels: 0 };
  let capped = false;
  // Takes what fits under MAX_DELETES; allOrNothing = a session's records.
  const enqueue = (urls: string[], kind: keyof typeof counts, allOrNothing = false): number => {
    const room = MAX_DELETES - queue.length;
    if (urls.length > room) {
      capped = true;
      if (allOrNothing) return 0;
    }
    const take = urls.slice(0, Math.max(0, room));
    queue.push(...take);
    counts[kind] += take.length;
    return take.length;
  };

  // 1. Sessions — pathnames only.
  const sessions = new Map<string, Sess>();
  const walks: Record<string, Walk> = {};
  walks.gochat = await walk("gochat/", (b) => {
    const m = b.pathname.match(RECORD_RE);
    if (!m) return;
    const [, sid, tsRaw, role] = m;
    const ts = Number(tsRaw);
    const s = sessions.get(sid) || { lastTs: 0, urls: [], notes: [] };
    s.urls.push(b.url);
    if (ts > s.lastTs) s.lastTs = ts;
    if (role === "note") s.notes.push({ url: b.url, ts });
    sessions.set(sid, s);
  });
  const stale = [...sessions.entries()].filter(([, s]) => s.lastTs < now - IDLE_MS).sort((a, b) => a[1].lastTs - b[1].lastTs);
  const deletedSids = new Set<string>();
  let keptYoungLock = 0;
  let keptUnchecked = 0;
  let noteBudget = NOTE_FETCH_BUDGET;
  if (!walks.gochat.truncated) {
    for (const [sid, s] of stale) {
      if (capped) break;
      // Only a note younger than 90 days can be a LOCKED note that keeps
      // the session — those are the only records whose content is read.
      const young = s.notes.filter((n) => n.ts >= now - LOCK_KEEP_MS);
      if (young.length > noteBudget) { keptUnchecked++; continue; }
      noteBudget -= young.length;
      let verdict: "delete" | "keep" | "unknown" = "delete";
      for (const n of young) {
        const text = await fetch(n.url, { cache: "no-store", signal: AbortSignal.timeout(6_000) })
          .then((r) => r.json())
          .then((j) => (j && typeof j.text === "string" ? (j.text as string) : ""))
          .catch(() => null);
        if (text === null) { verdict = "unknown"; break; } // unreadable → checked again tomorrow
        if (text.startsWith("LOCKED:")) { verdict = "keep"; break; }
      }
      if (verdict === "keep") { keptYoungLock++; continue; }
      if (verdict === "unknown") { keptUnchecked++; continue; }
      if (!enqueue(s.urls, "records", true)) break;
      deletedSids.add(sid);
    }
  }

  // 2. Photos — a deleted session's, or an orphan's once it is 30 days old.
  const images = new Map<string, { urls: string[]; newestTs: number }>();
  walks.images = await walk("gochat-img/", (b) => {
    const m = b.pathname.match(IMAGE_RE);
    if (!m) return;
    const g = images.get(m[1]) || { urls: [], newestTs: 0 };
    g.urls.push(b.url);
    const ts = Number(m[2]);
    if (ts > g.newestTs) g.newestTs = ts;
    images.set(m[1], g);
  });
  if (!walks.gochat.truncated && !walks.images.truncated) {
    for (const [sid, g] of images) {
      if (capped) break;
      const orphan = !sessions.has(sid) && g.newestTs < now - IDLE_MS;
      if (deletedSids.has(sid) || orphan) enqueue(g.urls, "images");
    }
  }

  // 3. Phone→session pointers older than the matcher's own 30-day floor.
  const pointerUrls: string[] = [];
  walks.pointers = await walk("gochat-phone/", (b) => {
    const m = b.pathname.match(POINTER_RE);
    if (m && Number(m[1]) < now - IDLE_MS) pointerUrls.push(b.url);
  });
  if (!walks.pointers.truncated) enqueue(pointerUrls, "pointers");

  // 4. Label PDFs older than 90 days (uploadedAt — the names vary by route).
  const labelUrls: string[] = [];
  walks.labels = await walk("fedex-labels/", (b) => {
    if (/\.pdf$/i.test(b.pathname) && new Date(b.uploadedAt).getTime() < now - LABEL_KEEP_MS) labelUrls.push(b.url);
  });
  if (!walks.labels.truncated) enqueue(labelUrls, "labels");

  // 5. Delete, in chunks; a failed chunk stops the run (the rest wait).
  let deleted = 0;
  const errors: string[] = Object.entries(walks).filter(([, w]) => w.error).map(([k, w]) => `${k}: ${w.error}`);
  if (!dryRun) {
    for (let i = 0; i < queue.length; i += DEL_CHUNK) {
      const chunk = queue.slice(i, i + DEL_CHUNK);
      try {
        await del(chunk, { abortSignal: AbortSignal.timeout(BLOB_OP_MS) });
        deleted += chunk.length;
      } catch (e) {
        errors.push(`del: ${e instanceof Error ? e.message : "failed"} after ${deleted}`);
        break;
      }
    }
  }

  return NextResponse.json({
    ok: errors.length === 0,
    dryRun,
    sessions: { scanned: sessions.size, idle: stale.length, keptYoungLock, keptUnchecked, deleted: deletedSids.size },
    queued: { ...counts, total: queue.length },
    deleted,
    capped,
    walks,
    tookMs: Date.now() - now,
    errors: errors.length ? errors : undefined,
  });
}
