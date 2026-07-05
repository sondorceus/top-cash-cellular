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

import { NextRequest, NextResponse, after } from "next/server";
import crypto from "crypto";
import { put, list } from "@vercel/blob";
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

// ---- conversational AI brain (typed messages) -----------------------------
// A single plain-text Send-API message.
async function sendText(recipientId: string, text: string, token: string) {
  await fetch(`${GRAPH}?access_token=${encodeURIComponent(token)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ recipient: { id: recipientId }, messaging_type: "RESPONSE", message: { text } }),
  }).catch(() => {});
}

// Per-user conversation memory: the AI brain's compact base64 transcript, stored
// in Vercel Blob keyed by PSID so the bot remembers the device/quote across
// messages. Public blob w/ unguessable store URL (same pattern as the FedEx
// labels) — fine for launch; migrate to private blob when hardening.
async function loadCtx(psid: string): Promise<string> {
  try {
    const { blobs } = await list({ prefix: `msgr-ctx/${psid}.txt`, limit: 1 });
    if (!blobs.length) return "";
    const r = await fetch(blobs[0].url, { cache: "no-store" });
    return r.ok ? await r.text() : "";
  } catch {
    return "";
  }
}
async function saveCtx(psid: string, ctx: string) {
  try {
    await put(`msgr-ctx/${psid}.txt`, ctx, { access: "public", addRandomSuffix: false, allowOverwrite: true, contentType: "text/plain" });
  } catch {
    /* best-effort memory */
  }
}

// Route a typed message to the SAME conversational AI the ManyChat pipe uses
// (/api/msgr-ai) — with per-user memory — then Send-API each reply line. This is
// the continuous back-and-forth ManyChat's one-shot Default Reply couldn't do.
async function aiReply(origin: string, senderId: string, text: string, token: string) {
  type BrainOut = { content?: { messages?: { text?: string }[] }; ctx?: string };
  const secret = process.env.MSGR_BOT_SECRET || "";
  const ctx = await loadCtx(senderId);
  let out: BrainOut | null = null;
  try {
    const r = await fetch(`${origin}/api/msgr-ai?s=${encodeURIComponent(secret)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, ctx }),
    });
    out = (await r.json()) as BrainOut;
  } catch {
    return;
  }
  for (const m of out?.content?.messages ?? []) {
    if (m?.text) await sendText(senderId, m.text, token);
  }
  if (out?.ctx) await saveCtx(senderId, out.ctx);
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
  // Meta demands a fast 200 (it retries + disables slow webhooks). The AI brain
  // takes a few seconds, so ACK immediately and do all the work in after().
  after(async () => {
    for (const entry of data.entry || []) {
      for (const event of entry.messaging || []) {
        const senderId = event?.sender?.id;
        if (!senderId || event.message?.is_echo) continue;
        if (!event.message && !event.postback) continue;
        if (!token) continue;

        // A quick-reply / button TAP carries a ConvoState payload → deterministic
        // funnel brain (lock-in, team handoff, sell menu).
        const tapPayload = event?.message?.quick_reply?.payload ?? event?.postback?.payload;
        if (tapPayload && tapPayload !== "GET_STARTED") {
          const reply = await advance(stateFrom(event), origin);
          if (reply.handoff) notify(reply.handoff.bulk ? "bulk" : "handoff", senderId, reply);
          else if (reply.offer?.hot) notify("hot_lead", senderId, reply);
          await send(senderId, reply, token);
          continue;
        }

        // Free-typed text → conversational AI brain (continuous back-and-forth).
        const typed = typeof event?.message?.text === "string" ? event.message.text.trim() : "";
        if (typed) await aiReply(origin, senderId, typed, token);
      }
    }
  });

  return new NextResponse("ok", { status: 200 });
}
