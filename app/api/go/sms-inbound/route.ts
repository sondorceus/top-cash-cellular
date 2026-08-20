// Inbound leg of the seller-SMS loop.
//
// Outbound: /admin/chats → sendSellerSms → the notary project's authed relay,
// which texts the seller over ITS Telnyx number. The seller's REPLY therefore
// lands on the notary project's Telnyx webhook, not here — so before this
// endpoint the console showed only Sonny's half of the negotiation and the
// seller's answers died in a log line (live case: go-fb1-kbcz5osi, 2026-08-20).
//
// The notary webhook POSTs every inbound text here; we find the /go session
// whose newest CONTACT note is that number and append the reply to it. No
// blob token ever crosses repos — the notary side holds only the shared
// relay token, exactly like TCC holds only that token for the outbound leg.
//
// Auth: x-relay-token vs SMS_RELAY_TOKEN — the SAME shared secret that guards
// the outbound relay, already set on both Vercel projects. Unset = fail closed.
import { NextRequest, NextResponse } from "next/server";
import { safeEqual } from "../../../lib/admin-auth";
import { appendChatMsg, findSessionByPhone, readChat } from "../../../lib/gochat-store";

export const dynamic = "force-dynamic";

// Telnyx delivers at-least-once, and the store is append-only with unique
// paths — so a redelivered event would post the seller's text twice. Same
// text into the same session inside this window is treated as that redelivery.
const DUPE_WINDOW_MS = 5 * 60_000;

export async function POST(req: NextRequest) {
  const expect = process.env.SMS_RELAY_TOKEN;
  if (!expect || !safeEqual(req.headers.get("x-relay-token"), expect)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  let body: { from?: unknown; text?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "bad json" }, { status: 400 });
  }
  const from = typeof body.from === "string" ? body.from.trim() : "";
  const text = typeof body.text === "string" ? body.text.trim().slice(0, 1000) : "";
  if (!from || !text) {
    return NextResponse.json({ ok: false, error: "from and text required" }, { status: 400 });
  }

  const sid = await findSessionByPhone(from);
  // No match is normal traffic, not a failure — the notary number is a real
  // business line and most of what hits it has nothing to do with a /go chat.
  if (!sid) return NextResponse.json({ ok: true, matched: false });

  const recent = await readChat(sid, Date.now() - DUPE_WINDOW_MS);
  if (recent.msgs.some((m) => m.role === "user" && m.text === text)) {
    return NextResponse.json({ ok: true, matched: true, sid, duplicate: true });
  }

  // Breadcrumb first so the console reads in order and Sonny can tell this
  // arrived by text rather than in the web chat. Then the reply as the
  // seller's own turn — it IS the seller talking, and every downstream reader
  // (console, handoff context, restore) already understands "user".
  // Appending here does NOT wake the bot (only /api/chat generates replies),
  // so an active takeover stays a takeover.
  await appendChatMsg(sid, "note", `SMS reply from ${from}`);
  await appendChatMsg(sid, "user", text);
  return NextResponse.json({ ok: true, matched: true, sid });
}
