// Inbound leg of the seller-SMS loop.
//
// Outbound: /api/go/lock (confirmation), the reminders cron, and /admin/chats
// text sellers through the notary project's authed relay, which uses ITS
// Telnyx number. The seller's REPLY therefore lands on the notary project's
// Telnyx webhook, not here — that webhook POSTs every inbound text to this
// endpoint; we find the /go session whose newest CONTACT note is that number
// and append the reply to it. No blob token ever crosses repos — the notary
// side holds only the shared relay token, exactly like TCC holds only that
// token for the outbound leg.
//
// Keywords (2026-09-11):
//   STOP / UNSUBSCRIBE / CANCEL / END / QUIT → opt-out: SMS-STOP session note
//     + [SMS-OPT-OUT: <10 digits>] MC marker. Every sender checks one of them.
//   MEET / SHIP → the seller's handoff choice, straight from the lock
//     confirmation text: posts a [DELIVERY OPTION] comm (the same shape the
//     homepage funnel writes) + an owner alert + a HANDOFF-CHOICE note, and
//     acks the seller with one short text.
//
// Auth: x-relay-token vs SMS_RELAY_TOKEN — the SAME shared secret that guards
// the outbound relay, already set on both Vercel projects. Unset = fail closed.
import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { safeEqual } from "../../../lib/admin-auth";
import { appendChatMsg, findSessionByPhone, readChat } from "../../../lib/gochat-store";
import { notifyOwnerSms } from "../../../lib/owner-sms";
import { sendSellerSms, smsOptOutMarker, STOP_RE, SMS_STOP_NOTE, notesHaveOptOut } from "../../../lib/seller-sms";

export const dynamic = "force-dynamic";

const MC_API = "https://missioncontrolsdjg-production.up.railway.app";
const MC_KEY = process.env.MC_API_KEY || "";

// Telnyx delivers at-least-once, and the store is append-only with unique
// paths — so a redelivered event would post the seller's text twice. Same
// text into the same session inside this window is treated as that redelivery.
const DUPE_WINDOW_MS = 5 * 60_000;

const MEET_RE = /^\s*(meet|meetup|local|austin)\b/i;
const SHIP_RE = /^\s*(ship|shipping|label|mail)\b/i;

function clean(s: string, max = 200): string {
  return s.replace(/[\[\]\n\r\t]/g, " ").slice(0, max).trim();
}

async function postMc(body: string, tags: string[], priority = "high"): Promise<boolean> {
  if (!MC_KEY) return false;
  try {
    const r = await fetch(`${MC_API}/api/comms`, {
      method: "POST",
      headers: { "x-api-key": MC_KEY, "Content-Type": "application/json" },
      signal: AbortSignal.timeout(5000),
      body: JSON.stringify({ from: "topcash-web", fromName: "Top Cash Cellular", role: "system", body, tags, priority }),
    });
    return r.ok;
  } catch {
    return false;
  }
}

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
  if (!sid) {
    // A STOP from a number we texted but can't map to a session still has to
    // stick: the MC marker is keyed on the number, not the session.
    if (STOP_RE.test(text)) {
      await postMc(`${smsOptOutMarker(from)} texted STOP (no /go session matched)`, ["sms-opt-out"], "low");
      return NextResponse.json({ ok: true, matched: false, optedOut: true });
    }
    return NextResponse.json({ ok: true, matched: false });
  }

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

  if (STOP_RE.test(text)) {
    await appendChatMsg(sid, "note", `${SMS_STOP_NOTE}: ${from} opted out by text`);
    await postMc(`${smsOptOutMarker(from)} sess:${sid} — seller texted STOP; no more texts to this number`, ["sms-opt-out", `sess-${sid}`], "low");
    return NextResponse.json({ ok: true, matched: true, sid, optedOut: true });
  }

  const meet = MEET_RE.test(text);
  const ship = !meet && SHIP_RE.test(text);
  if (meet || ship) {
    // What we know about this seller lives in the session notes the lock
    // route wrote: LOCKED: <spec> $<offer> — <contact>, plus CONTACT:.
    const state = await readChat(sid, 0);
    const notes = state.msgs.filter((m) => m.role === "note").map((m) => m.text);
    // One choice per thread. A later "meet at 5 at the HEB?" in a live
    // negotiation must not re-post a delivery option, re-alert Sonny, or
    // auto-text over him.
    if (notes.some((t) => t.startsWith("HANDOFF-CHOICE:"))) {
      return NextResponse.json({ ok: true, matched: true, sid, handoff: "already-chosen" });
    }
    const ownerActive = state.lastOwnerTs > 0 && Date.now() - state.lastOwnerTs < 24 * 3600_000;
    const locked = [...notes].reverse().find((t) => t.startsWith("LOCKED: ")) || "";
    const specAndOffer = locked.slice("LOCKED: ".length).split(" — ")[0] || "";
    const offer = specAndOffer.match(/\$(\d+)/)?.[1] || "";
    const device = clean(specAndOffer.replace(/\s*\$\d+\s*$/, "").replace(/\s*\(manual\)\s*$/, ""), 100) || "device (see chat)";
    const method = meet ? "local" : "shipping";
    const lines = [
      `[DELIVERY OPTION] ${method.toUpperCase()}`,
      `Name: /go seller`,
      `Phone: ${clean(from, 30)}`,
      `Device: ${device}`,
      offer ? `Quote: $${offer}` : null,
      `Session: ${sid}`,
      meet ? "Meetup area: Austin area (replied MEET by text)" : "Replied SHIP by text — needs a mailing address for the free label",
      meet ? "Action: Reach out to schedule a local Austin meetup." : "Action: text for the address, then generate the FedEx prepaid label from /admin.",
      `Chat: https://topcashcellular.com/admin/chats?session=${sid}`,
    ].filter(Boolean) as string[];
    const posted = await postMc(lines.join("\n"), ["lead", "delivery", method, `sess-${sid}`], "urgent");
    await appendChatMsg(sid, "note", `HANDOFF-CHOICE: ${meet ? "local meetup" : "ship (free label)"} — replied by text${posted ? "" : " (MC POST FAILED)"}`);
    after(() => notifyOwnerSms(
      `${meet ? "📍" : "📦"} GO seller chose ${meet ? "MEETUP" : "SHIP"} — ${device}${offer ? ` $${offer}` : ""} · ${from}\nhttps://topcashcellular.com/admin/chats?session=${sid}`,
    ));
    // The ack is the bot's — never sent into a thread Sonny is actively
    // texting in (he answers himself), never to an opted-out number.
    if (!notesHaveOptOut(notes) && !ownerActive) {
      const ack = meet
        ? "Top Cash Cellular: got it — we'll text you shortly to set up a time and a public spot in the Austin area."
        : "Top Cash Cellular: got it — we'll text you shortly for the address your free FedEx label should go to.";
      const sent = await sendSellerSms(from, ack);
      await appendChatMsg(sid, "note", sent ? `SMS sent to ${from} (handoff ack)` : `SMS FAILED to ${from} (handoff ack)`);
    }
    return NextResponse.json({ ok: true, matched: true, sid, handoff: method });
  }

  return NextResponse.json({ ok: true, matched: true, sid });
}
