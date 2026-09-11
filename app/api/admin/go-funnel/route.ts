// /api/admin/go-funnel — the /go ad funnel, measured from what the page
// actually records: the append-only chat store (app/lib/gochat-store.ts).
//
// Every /go session that did anything server-side has a folder of blobs
// whose PATHNAMES carry the timestamp + role, and whose note-role blobs carry
// the milestones the funnel writes (quote shown / CONTACT / LOCKED /
// HANDOFF-CHOICE / nudges / SMS). So the funnel is one bounded blob walk plus
// note fetches — no pixel, no GA, no Meta login needed, and per ad tag, since
// the session id embeds it (go-<src>-<rand>).
//
//   sessions  — any server activity (quote, chat message, note)
//   quoted    — the engine put a number on screen (chip flow)
//   contact   — a phone/email landed (lock OR chat)
//   locked    — /api/go/lock wrote a lead
//   handoff   — the seller picked meet/ship (chips or MEET/SHIP text)
//
// This is the audit script from 2026-09-11 turned into an endpoint (it found
// 35 / 19 / 11 / 4 for the first three weeks of the fb1 campaign). Bounded:
// 30 days by default (the store prunes idle sessions at 30d anyway), 400
// note fetches per call.
//
// Auth: x-admin-token / ?token= against TCC_ADMIN_TOKEN, like every admin route.
import { NextRequest, NextResponse } from "next/server";
import { list } from "@vercel/blob";
import { safeEqual } from "../../../lib/admin-auth";

export const dynamic = "force-dynamic";

const ADMIN_TOKEN = process.env.TCC_ADMIN_TOKEN;
const MAX_NOTE_FETCHES = 400;
const NOTES_PER_SESSION = 30;

type Session = {
  sid: string;
  src: string;
  first: number;
  last: number;
  user: number;
  bot: number;
  owner: number;
  notes: string[]; // note blob urls, newest first
  quoted: boolean;
  contact: boolean;
  locked: boolean;
  handoff: boolean;
  nudged: boolean;
  optedOut: boolean;
  manual: boolean;
  offer: number | null;
  device: string;
};

function checkAuth(req: NextRequest): boolean {
  const headerToken = req.headers.get("x-admin-token");
  const queryToken = req.nextUrl.searchParams.get("token");
  return safeEqual(headerToken, ADMIN_TOKEN) || safeEqual(queryToken, ADMIN_TOKEN);
}

function dayKey(ts: number): string {
  // America/Chicago calendar day, YYYY-MM-DD — what "yesterday" means to Sonny.
  const p = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Chicago", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date(ts));
  const get = (t: string) => p.find((x) => x.type === t)?.value || "00";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function srcOf(sid: string): string {
  // go-<src>-<rand> → src; go-<rand> → "direct". The src is what the ad's
  // ?src= carried on the FIRST visit that minted this session.
  const m = sid.match(/^go-([a-z0-9]{1,10})-[a-z0-9]{2,12}$/i);
  return m ? m[1].toLowerCase() : "direct";
}

export async function GET(req: NextRequest) {
  if (!checkAuth(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const days = Math.min(60, Math.max(1, Number(req.nextUrl.searchParams.get("days")) || 30));
  const now = Date.now();
  const cutoff = now - days * 24 * 3600_000;

  // 1. Walk the store — pathnames only, zero fetches.
  const by = new Map<string, Session>();
  try {
    let cursor: string | undefined;
    for (let page = 0; page < 20; page++) {
      const res = await list({ prefix: "gochat/", limit: 1000, cursor });
      for (const b of res.blobs) {
        const m = b.pathname.match(/^gochat\/([^/]+)\/(\d+)-(user|bot|owner|note|ctl)(?:-[a-z]+)?-[a-z0-9]+\.json$/);
        if (!m) continue;
        const [, sid, tsRaw, role] = m;
        if (!/^go-/i.test(sid)) continue; // only sessions the /go client minted
        const ts = Number(tsRaw);
        const s = by.get(sid) || {
          sid, src: srcOf(sid), first: ts, last: ts, user: 0, bot: 0, owner: 0, notes: [],
          quoted: false, contact: false, locked: false, handoff: false, nudged: false, optedOut: false, manual: false, offer: null, device: "",
        };
        s.first = Math.min(s.first, ts);
        s.last = Math.max(s.last, ts);
        if (role === "user") s.user++;
        else if (role === "bot") s.bot++;
        else if (role === "owner") s.owner++;
        else if (role === "note") s.notes.push(b.url);
        by.set(sid, s);
      }
      if (!res.hasMore || !res.cursor) break;
      cursor = res.cursor;
    }
  } catch (e) {
    return NextResponse.json({ error: `blob list failed: ${e instanceof Error ? e.message : "?"}` }, { status: 502 });
  }

  // 2. Notes for sessions inside the window, newest sessions first, bounded.
  const sessions = [...by.values()].filter((s) => s.first >= cutoff).sort((a, b) => b.first - a.first);
  let budget = MAX_NOTE_FETCHES;
  for (const s of sessions) {
    if (budget <= 0) break;
    // Note urls are unordered from the walk; the pathname timestamp sorts them.
    const urls = s.notes
      .map((u) => ({ u, ts: Number(u.match(/\/(\d+)-note-/)?.[1] || 0) }))
      .sort((a, b) => b.ts - a.ts)
      .slice(0, NOTES_PER_SESSION)
      .map((x) => x.u);
    budget -= urls.length;
    const texts = await Promise.all(
      urls.map((u) => fetch(u, { cache: "no-store" }).then((r) => r.json()).then((j) => (j && typeof j.text === "string" ? (j.text as string) : "")).catch(() => "")),
    );
    for (const t of texts) {
      if (t.startsWith("quote shown:")) {
        s.quoted = true;
        if (!s.device) s.device = t.slice("quote shown:".length).split("→")[0].trim().slice(0, 60);
      } else if (t.startsWith("QSPEC:")) {
        const offer = Number(t.split("|")[4]);
        if (Number.isFinite(offer) && s.offer == null) s.offer = offer;
      } else if (t.startsWith("CONTACT:")) s.contact = true;
      else if (t.startsWith("LOCKED:")) {
        s.locked = true;
        if (/\(manual\)/.test(t)) s.manual = true;
        const o = Number(t.match(/\$(\d+)/)?.[1]);
        if (Number.isFinite(o)) s.offer = o;
        if (!s.device) s.device = t.slice("LOCKED:".length).split(" — ")[0].replace(/\s*\$\d+.*$/, "").trim().slice(0, 60);
      } else if (t.startsWith("HANDOFF-CHOICE:")) s.handoff = true;
      else if (t.startsWith("HANDOFF")) { if (!s.device) s.device = t.slice(0, 60); }
      else if (/nudged/.test(t)) s.nudged = true;
      else if (t.startsWith("SMS-STOP")) s.optedOut = true;
    }
    s.notes = []; // don't ship urls to the client
  }

  // 3. Roll up.
  type Row = { sessions: number; quoted: number; contact: number; locked: number; handoff: number; nudged: number; owner: number; value: number };
  const blank = (): Row => ({ sessions: 0, quoted: 0, contact: 0, locked: 0, handoff: 0, nudged: 0, owner: 0, value: 0 });
  const add = (r: Row, s: Session) => {
    r.sessions++;
    if (s.quoted) r.quoted++;
    if (s.contact) r.contact++;
    if (s.locked) { r.locked++; r.value += s.offer || 0; }
    if (s.handoff) r.handoff++;
    if (s.nudged) r.nudged++;
    if (s.owner > 0) r.owner++;
  };
  const totals = blank();
  const bySrc: Record<string, Row> = {};
  const byDay: Record<string, Row> = {};
  for (const s of sessions) {
    add(totals, s);
    add((bySrc[s.src] ||= blank()), s);
    add((byDay[dayKey(s.first)] ||= blank()), s);
  }
  // Quote-viewers we cannot reach: the retargeting audience, in numbers.
  const quotedNoContact = sessions.filter((s) => s.quoted && !s.contact).length;
  const quotedNoContactValue = sessions.filter((s) => s.quoted && !s.contact).reduce((a, s) => a + (s.offer || 0), 0);

  return NextResponse.json({
    days,
    generatedAt: new Date(now).toISOString(),
    totals: { ...totals, quotedNoContact, quotedNoContactValue, lockRate: totals.quoted ? Math.round((totals.locked / totals.quoted) * 100) : 0 },
    bySrc,
    byDay: Object.entries(byDay).sort(([a], [b]) => (a < b ? 1 : -1)).map(([day, r]) => ({ day, ...r })),
    sessions: sessions.slice(0, 100).map((s) => ({
      sid: s.sid, src: s.src, first: new Date(s.first).toISOString(), last: new Date(s.last).toISOString(),
      user: s.user, owner: s.owner, quoted: s.quoted, contact: s.contact, locked: s.locked, manual: s.manual,
      handoff: s.handoff, nudged: s.nudged, optedOut: s.optedOut, offer: s.offer, device: s.device,
    })),
    truncated: budget <= 0,
  });
}
