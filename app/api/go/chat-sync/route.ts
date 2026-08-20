// Client-side sync for the /go chat's LIVE OWNER TAKEOVER.
//
// GET  ?session=&after=  → owner messages newer than `after`, takeover flag,
//   and lastTs (the session's newest stored record). The /go client polls
//   this every few seconds while the chat is open and advances its cursor
//   from lastTs — so idle polls list the prefix and fetch NOTHING.
//
// POST {session, text}   → milestone breadcrumb ("note") from the guided
//   funnel — quote shown / offer locked — so the admin console shows what the
//   seller was doing even though chip taps never hit /api/chat.
//
// Public endpoint, but locked to ids the /go client can actually mint
// (validGoSession) so arbitrary attacker-chosen session prefixes can't
// spray junk into the store. Rate-limited per IP on top.
import { NextRequest, NextResponse } from "next/server";
import { appendChatMsg, readChat, takeoverStale, validGoSession } from "../../../lib/gochat-store";
import { sidTokenValid } from "../../../lib/go-sid-token";
import { clientIp, rateLimit } from "../../../lib/rate-limit";

export async function GET(req: NextRequest) {
  const ip = clientIp(req);
  // 120/min tolerates several CGNAT'd sellers polling at 15/min each; the
  // client also ignores non-ok bodies, so a trip can't flip its UI state.
  if (!rateLimit(`chatsync:${ip}`, 120, 60_000).ok) {
    return NextResponse.json({ msgs: [] }, { status: 429 });
  }
  const sid = req.nextUrl.searchParams.get("session") || "";
  const after = Number(req.nextUrl.searchParams.get("after")) || 0;
  // full=1 → the whole visible thread (user/bot/owner), used ONCE on page
  // load to restore a returning seller's conversation. Notes stay internal —
  // they're owner-console breadcrumbs and can carry contact info.
  const full = req.nextUrl.searchParams.get("full") === "1";
  if (!validGoSession(sid)) return NextResponse.json({ msgs: [], takeover: false, lastTs: 0 });
  // ?k= — the SMS deep-link's adoption proof. When the client asks us to
  // vouch for a ?sid= it found in its URL, only a valid admin-minted token
  // gets adopt:true; everything else tells the client to IGNORE the sid.
  const k = req.nextUrl.searchParams.get("k");
  const adopt = k !== null ? sidTokenValid(sid, k) : undefined;
  if (adopt === false) return NextResponse.json({ msgs: [], takeover: false, lastTs: 0, adopt: false });
  const state = await readChat(sid, after);
  const msgs = state.msgs
    .filter((m) => (full ? m.role !== "note" : m.role === "owner"))
    .map((m) => ({ role: m.role, text: m.text, ts: m.ts }));
  // A takeover Sonny abandoned reads as OFF here — otherwise the client
  // shows "Sonny is with you — live" over dead air all week.
  const takeover = state.takeover && !takeoverStale(state);
  // Un-locked guided quote rehydration: the highest-intent restore moment is
  // a seller coming back to a number they never locked. Raw notes stay
  // internal (they can carry CONTACT:) — this returns only a STRUCTURED
  // pending quote parsed from the client's QSPEC breadcrumb, and only when
  // no lock happened after it.
  let pendingQuote: { model: string; storage: string; condition: string; carrier: string; offer: number } | null = null;
  if (full) {
    const notes = state.msgs.filter((m) => m.role === "note");
    const lastQspec = [...notes].reverse().find((m) => m.text.startsWith("QSPEC: "));
    const lastLock = [...notes].reverse().find((m) => m.text.startsWith("LOCKED:"));
    // 14-day gate mirrors the published price-lock promise — past it the
    // stored number may be stale, so the seller redoes the (30s) flow and
    // gets a fresh engine number instead of a "still good" that isn't.
    const fresh = lastQspec && Date.now() - lastQspec.ts < 14 * 24 * 3600_000;
    if (lastQspec && fresh && (!lastLock || lastQspec.ts > lastLock.ts)) {
      const p = lastQspec.text.slice("QSPEC: ".length).split("|");
      const offer = Number(p[4]);
      if (p.length === 5 && /^[a-z0-9]{2,16}$/i.test(p[0]) && Number.isFinite(offer) && offer > 0) {
        pendingQuote = { model: p[0], storage: p[1], condition: p[2], carrier: p[3], offer };
      }
    }
  }
  return NextResponse.json({ msgs, takeover, lastTs: state.lastTs, ...(adopt ? { adopt: true } : {}), ...(pendingQuote ? { pendingQuote } : {}) });
}

export async function POST(req: NextRequest) {
  const ip = clientIp(req);
  // 30/5min: a multi-device locker writes 2 notes per quote (display + QSPEC)
  // plus LOCKED + nudge breadcrumbs — 10 was droppable by one honest lot.
  if (!rateLimit(`chatnote:${ip}`, 30, 5 * 60_000).ok) {
    return NextResponse.json({ ok: false }, { status: 429 });
  }
  let body: { session?: unknown; text?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  const sid = typeof body.session === "string" ? body.session : "";
  const text = typeof body.text === "string" ? body.text.slice(0, 300) : "";
  if (!validGoSession(sid) || !text.trim()) return NextResponse.json({ ok: false }, { status: 400 });
  // Reserved prefixes may ONLY be written server-side: CONTACT: picks the
  // destination for Sonny's "text the seller" action; quote shown:/QSPEC:/
  // LOCKED:/HANDOFF feed the chat brain's funnel context and restore-time
  // quote rehydration — a client-forged one would put an invented number in
  // the bot's mouth (or on the seller's screen as a "still good" quote).
  if (/^\s*(CONTACT|QSPEC|LOCKED|HANDOFF|quote shown|SMS)\s*[:\s]/i.test(text)) return NextResponse.json({ ok: false }, { status: 400 });
  await appendChatMsg(sid, "note", text);
  return NextResponse.json({ ok: true });
}
