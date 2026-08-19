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
import { appendChatMsg, readChat, validGoSession } from "../../../lib/gochat-store";
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
  const state = await readChat(sid, after);
  const msgs = state.msgs
    .filter((m) => (full ? m.role !== "note" : m.role === "owner"))
    .map((m) => ({ role: m.role, text: m.text, ts: m.ts }));
  return NextResponse.json({ msgs, takeover: state.takeover, lastTs: state.lastTs });
}

export async function POST(req: NextRequest) {
  const ip = clientIp(req);
  if (!rateLimit(`chatnote:${ip}`, 10, 5 * 60_000).ok) {
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
  // CONTACT: notes are what the console's "also text the seller" action
  // reads to pick the destination number, and the newest one wins — so they
  // may ONLY be written server-side (lock route / chat route). Accepting one
  // here would let anyone who knows a session id redirect Sonny's text to a
  // number of their choosing.
  if (/^\s*CONTACT\s*:/i.test(text)) return NextResponse.json({ ok: false }, { status: 400 });
  await appendChatMsg(sid, "note", text);
  return NextResponse.json({ ok: true });
}
