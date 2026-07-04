// TCC Messenger bot — Meta Messenger Send API RENDERER (the OWNED transport).
//
// This is Track 2: a direct Meta Messenger webhook that reuses the SAME brain
// as the ManyChat pipe (app/lib/msgr-brain.ts). Once the Meta App has
// `pages_messaging` Advanced Access (App Review) and the ad points here,
// ManyChat can be cancelled — the conversation is identical because both share
// the brain. Until then this coexists harmlessly (ManyChat drives the live ad).
//
//   GET  /api/messenger   → webhook verification (hub.challenge)
//   POST /api/messenger   → message/postback events → brain → Send API reply
//
// Env:
//   MESSENGER_VERIFY_TOKEN  — arbitrary token you also enter in the Meta webhook UI
//   PAGE_ACCESS_TOKEN       — Page token from the Meta App (send messages)
//   MESSENGER_APP_SECRET    — App Secret; when set, X-Hub-Signature-256 is verified
//   MSGR_NOTIFY_URL         — optional: POSTed a JSON blip on handoff / hot lead
//
// Docs: https://developers.facebook.com/docs/messenger-platform

import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { advance, type BotReply, type ConvoState } from "../../lib/msgr-brain";

export const dynamic = "force-dynamic";

const GRAPH = "https://graph.facebook.com/v21.0/me/messages";
// Meta caps quick-reply and button titles at 20 chars.
const clip = (s: string, n = 20) => (Array.from(s).length > n ? Array.from(s).slice(0, n).join("") : s);

// ---- webhook verification (GET) -------------------------------------------
export function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const mode = p.get("hub.mode");
  const token = p.get("hub.verify_token");
  const challenge = p.get("hub.challenge");
  if (mode === "subscribe" && token && token === process.env.MESSENGER_VERIFY_TOKEN) {
    return new NextResponse(challenge ?? "", { status: 200 });
  }
  return new NextResponse("forbidden", { status: 403 });
}

// ---- signature check ------------------------------------------------------
function signatureOk(raw: string, header: string | null): boolean {
  const secret = process.env.MESSENGER_APP_SECRET;
  if (!secret) return true; // not configured → skip (dev/pre-review)
  if (!header?.startsWith("sha256=")) return false;
  const expected = "sha256=" + crypto.createHmac("sha256", secret).update(raw).digest("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(header), Buffer.from(expected));
  } catch {
    return false;
  }
}

// ---- Send API render + send -----------------------------------------------
// Turn a BotReply into Meta message payloads and send them in order.
async function send(recipientId: string, reply: BotReply, token: string) {
  const quickReplies = reply.quickReplies.map((qr) => ({
    content_type: "text",
    title: clip(qr.caption),
    payload: JSON.stringify(qr.state),
  }));

  const payloads: Record<string, unknown>[] = [];
  reply.texts.forEach((text, i) => {
    const isLast = i === reply.texts.length - 1;
    if (isLast && reply.urlButtons?.length) {
      // Last message becomes a button template carrying the CTA URL button(s)...
      payloads.push({
        attachment: {
          type: "template",
          payload: {
            template_type: "button",
            text,
            buttons: reply.urlButtons.map((b) => ({ type: "web_url", title: clip(b.caption), url: b.url })),
          },
        },
        ...(quickReplies.length ? { quick_replies: quickReplies } : {}),
      });
    } else if (isLast && quickReplies.length) {
      payloads.push({ text, quick_replies: quickReplies });
    } else {
      payloads.push({ text });
    }
  });

  for (const message of payloads) {
    await fetch(`${GRAPH}?access_token=${encodeURIComponent(token)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ recipient: { id: recipientId }, messaging_type: "RESPONSE", message }),
    }).catch(() => {});
  }
}

// Fire-and-forget lead alert (handoff / hot offer) to an optional webhook.
function notify(kind: string, recipientId: string, reply: BotReply) {
  const url = process.env.MSGR_NOTIFY_URL;
  if (!url) return;
  fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ kind, recipientId, handoff: reply.handoff, offer: reply.offer, at: new Date().toISOString() }),
  }).catch(() => {});
}

// Decode the ConvoState a user's tap/typed message carries.
function stateFrom(event: Record<string, any>): ConvoState {
  const qrPayload = event?.message?.quick_reply?.payload;
  const pbPayload = event?.postback?.payload;
  const raw = qrPayload ?? pbPayload;
  if (raw && raw !== "GET_STARTED") {
    try {
      const s = JSON.parse(raw);
      if (s && typeof s.step === "string") return s as ConvoState;
    } catch {
      /* not JSON → fall through to a fresh start */
    }
  }
  return { step: "start" };
}

// ---- events (POST) --------------------------------------------------------
export async function POST(req: NextRequest) {
  const raw = await req.text();
  if (!signatureOk(raw, req.headers.get("x-hub-signature-256"))) {
    return new NextResponse("bad signature", { status: 403 });
  }

  const token = process.env.PAGE_ACCESS_TOKEN;
  let data: any;
  try {
    data = JSON.parse(raw);
  } catch {
    return new NextResponse("bad json", { status: 400 });
  }
  if (data?.object !== "page") return new NextResponse("ok", { status: 200 });

  const origin = req.nextUrl.origin;
  for (const entry of data.entry || []) {
    for (const event of entry.messaging || []) {
      const senderId = event?.sender?.id;
      if (!senderId || event.message?.is_echo) continue;
      // Only react to messages / postbacks (ignore delivery/read receipts).
      if (!event.message && !event.postback) continue;

      const reply = await advance(stateFrom(event), origin);
      if (reply.handoff) notify(reply.handoff.bulk ? "bulk" : "handoff", senderId, reply);
      else if (reply.offer?.hot) notify("hot_lead", senderId, reply);
      if (token) await send(senderId, reply, token);
    }
  }
  // Meta requires a fast 200 or it retries/disables the webhook.
  return new NextResponse("ok", { status: 200 });
}
