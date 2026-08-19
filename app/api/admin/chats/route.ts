// Owner console API for live site-chat takeover (ManyChat-style).
//
//   GET  ?token=                 → session inbox, newest first
//   GET  ?token=&session=<sid>   → one thread (all roles) + takeover state
//   POST {session, text?, takeover?} → send an owner message and/or flip
//        takeover on/off. Owner messages reach the seller through the /go
//        client's chat-sync polling within a few seconds.
//
// Auth: same pattern as every other admin route — x-admin-token header or
// ?token= query against TCC_ADMIN_TOKEN.
import { NextRequest, NextResponse } from "next/server";
import { safeEqual } from "../../../lib/admin-auth";
import { appendChatMsg, listChatSessions, readChat, validSession } from "../../../lib/gochat-store";

const ADMIN_TOKEN = process.env.TCC_ADMIN_TOKEN;

function checkAuth(req: NextRequest): boolean {
  const headerToken = req.headers.get("x-admin-token");
  const queryToken = req.nextUrl.searchParams.get("token");
  return safeEqual(headerToken, ADMIN_TOKEN) || safeEqual(queryToken, ADMIN_TOKEN);
}

export async function GET(req: NextRequest) {
  if (!checkAuth(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const sid = req.nextUrl.searchParams.get("session");
  if (sid) {
    if (!validSession(sid)) return NextResponse.json({ error: "bad session" }, { status: 400 });
    // ?after= makes the 4s console poll incremental — idle ticks list the
    // prefix and fetch zero blobs instead of re-downloading the thread.
    const after = Number(req.nextUrl.searchParams.get("after")) || 0;
    const state = await readChat(sid, after);
    return NextResponse.json({ sid, msgs: state.msgs, takeover: state.takeover, lastTs: state.lastTs });
  }
  const sessions = await listChatSessions();
  return NextResponse.json({ sessions });
}

export async function POST(req: NextRequest) {
  if (!checkAuth(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  let body: { session?: unknown; text?: unknown; takeover?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }
  const sid = typeof body.session === "string" ? body.session : "";
  if (!validSession(sid)) return NextResponse.json({ error: "bad session" }, { status: 400 });
  if (typeof body.takeover === "boolean") {
    await appendChatMsg(sid, "ctl", body.takeover ? "takeover:on" : "takeover:off");
  }
  const text = typeof body.text === "string" ? body.text.trim().slice(0, 2000) : "";
  if (text) await appendChatMsg(sid, "owner", text);
  return NextResponse.json({ ok: true });
}
