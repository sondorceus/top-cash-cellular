// Owner console API for live site-chat takeover (ManyChat-style).
//
//   GET                          → session inbox, newest first
//   GET  ?session=<sid>          → one thread (all roles) + takeover state
//   POST {session, text?, takeover?} → send an owner message and/or flip
//        takeover on/off. Owner messages reach the seller through the /go
//        client's chat-sync polling within a few seconds.
//
// Auth: x-admin-token header against TCC_ADMIN_TOKEN (proxy.ts injects it
// for a Google admin session). The ?token= query form went 2026-09-26.
import { NextRequest, NextResponse } from "next/server";
import { safeEqual } from "../../../lib/admin-auth";
import { appendChatMsg, listChatSessions, readChat, validSession, rememberPhoneSession } from "../../../lib/gochat-store";
import { sidToken } from "../../../lib/go-sid-token";
import { sendSellerSms, looksLikePhone, notesHaveOptOut } from "../../../lib/seller-sms";

const ADMIN_TOKEN = process.env.TCC_ADMIN_TOKEN;

// Header only (2026-09-26): the console sends x-admin-token (or the proxy
// injects it from the Google session) and Theot sends the header too — a
// ?token= in the URL only ever landed the secret in request logs.
function checkAuth(req: NextRequest): boolean {
  return safeEqual(req.headers.get("x-admin-token"), ADMIN_TOKEN);
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
  let body: { session?: unknown; text?: unknown; takeover?: unknown; sms?: unknown };
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
  // sms:true — ALSO text the message to the seller's stored contact (the
  // CONTACT note the lock/chat paths park). Owner-initiated only: Sonny
  // decides when a text goes out, the system never does. One-way channel —
  // the Telnyx number's replies land on the notary webhook, so the text
  // points the seller back at their /go chat.
  let smsSent = false;
  if (text && body.sms === true) {
    const state = await readChat(sid, 0);
    const contactNote = [...state.msgs].reverse().find((m) => m.role === "note" && m.text.startsWith("CONTACT: "));
    const contact = contactNote ? contactNote.text.slice("CONTACT: ".length).trim() : "";
    const optedOut = notesHaveOptOut(state.msgs.filter((m) => m.role === "note").map((m) => m.text));
    if (optedOut) {
      // The seller texted STOP — the message still lands in the web chat,
      // the text does not go out. Surfaced in the console as a note.
      await appendChatMsg(sid, "note", "SMS skipped — seller opted out by texting STOP");
    } else if (contact && looksLikePhone(contact)) {
      // ?sid=&k= lets the /go client adopt THIS session in whatever browser
      // the SMS opens (the seller's original session id lives in the Meta
      // in-app webview's localStorage — a bare /go link dumped them into a
      // fresh empty thread and their replies never reached this console).
      // k is the HMAC adoption proof only this authed route can mint; the
      // client ignores ?sid= links without a valid one (session fixation).
      const kTok = sidToken(sid);
      smsSent = await sendSellerSms(contact, `${text}\n\n— Top Cash Cellular · reply in your chat: https://topcashcellular.com/go${kTok ? `?sid=${sid}&k=${kTok}` : ""}`);
      await appendChatMsg(sid, "note", smsSent ? `SMS sent to ${contact}` : `SMS FAILED to ${contact}`);
      // The reply to this text belongs in this thread: the phone→session
      // pointer follows the text that went out (2026-09-26), so the inbound
      // matcher finds this session even when the lock's own text failed.
      if (smsSent) await rememberPhoneSession(contact, sid);
    } else {
      await appendChatMsg(sid, "note", "SMS skipped — no phone number on file for this session");
    }
  }
  return NextResponse.json({ ok: true, smsSent });
}
