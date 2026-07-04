// TCC Messenger bot — ManyChat "Dynamic Block v2" RENDERER.
//
// The conversation logic lives in app/lib/msgr-brain.ts (transport-agnostic).
// This route is the thin ManyChat pipe: it authenticates the request, runs the
// brain one step, and renders the abstract BotReply into ManyChat's Dynamic
// Block JSON (quick replies as `dynamic_block_callback`s that carry state).
//
//   POST /api/msgr
//   header: X-Bot-Secret: <MSGR_BOT_SECRET>
//   body:   { state?: ConvoState, retext?: boolean }
//
// See: https://manychat.github.io/dynamic_block_docs/

import { NextRequest, NextResponse } from "next/server";
import { advance, type BotReply, type ConvoState } from "../../lib/msgr-brain";

export const dynamic = "force-dynamic";

function authed(req: NextRequest): boolean {
  const expected = process.env.MSGR_BOT_SECRET;
  if (!expected) return false; // fail closed if unconfigured
  const header = req.headers.get("x-bot-secret")?.trim();
  const qp = req.nextUrl.searchParams.get("s")?.trim();
  return header === expected || qp === expected;
}

// Render a BotReply into ManyChat Dynamic Block v2 JSON.
function renderManyChat(reply: BotReply, self: string, secret: string) {
  // Callback URL carries the secret as a query param too — ManyChat does not
  // reliably forward per-quick-reply `headers` on dynamic_block_callback taps,
  // so the header alone can 401 the callback and dead-end the conversation.
  const cb = `${self}?s=${encodeURIComponent(secret)}`;
  // Messenger caps quick-reply/button titles at 20 chars; over-length titles
  // make the whole message fail to render. Clip defensively.
  const clip = (s: string) => (Array.from(s).length > 20 ? Array.from(s).slice(0, 20).join("") : s);
  const messages: Record<string, unknown>[] = reply.texts.map((t, i) => {
    const isLast = i === reply.texts.length - 1;
    if (isLast && reply.urlButtons?.length) {
      return {
        type: "text",
        text: t,
        buttons: reply.urlButtons.map((b) => ({
          type: "url",
          caption: clip(b.caption),
          url: b.url,
          webview_size: "full",
        })),
      };
    }
    return { type: "text", text: t };
  });

  const content: Record<string, unknown> = { messages };

  if (reply.quickReplies.length) {
    content.quick_replies = reply.quickReplies.map((qr) => ({
      type: "dynamic_block_callback",
      caption: clip(qr.caption),
      url: cb,
      method: "post",
      headers: { "X-Bot-Secret": secret },
      payload: { state: qr.state },
    }));
  }

  const actions: unknown[] = [];
  if (reply.handoff) {
    actions.push({ action: "set_field_value", field_name: "manual", value: true });
    actions.push({ action: "set_field_value", field_name: "manual_reason", value: reply.handoff.reason });
    if (reply.handoff.bulk) actions.push({ action: "add_tag", tag_name: "bulk_lead" });
    actions.push({ action: "add_tag", tag_name: "needs_human" });
  }
  if (reply.offer) {
    actions.push({ action: "set_field_value", field_name: "quote", value: reply.offer.quote });
    actions.push({ action: "set_field_value", field_name: "device_name", value: reply.offer.deviceName });
    if (reply.offer.hot) actions.push({ action: "add_tag", tag_name: "hot_lead" });
  }
  if (actions.length) content.actions = actions;

  // NOTE: intentionally NO external_message_callback. It fired on quick-reply
  // taps in ManyChat (treating a tap as a "message"), which looped the funnel
  // ("almost there" nudge repeating). Taps use the dynamic_block_callback quick
  // replies only; typed messages simply fall through (users tap the buttons).

  return NextResponse.json({ version: "v2", content });
}

export async function POST(req: NextRequest) {
  if (!authed(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: { state?: ConvoState; retext?: boolean } = {};
  try {
    body = await req.json();
  } catch {
    /* empty body = fresh entry */
  }
  const self = `${req.nextUrl.origin}/api/msgr`;
  const secret = process.env.MSGR_BOT_SECRET as string;
  const state: ConvoState = body.state || { step: "start" };

  const reply = await advance(state, req.nextUrl.origin);
  // Typed instead of tapped? Nudge to tap rather than re-asking the whole
  // question (which read as an annoying loop).
  if (body.retext && reply.quickReplies.length) {
    reply.texts = ["👇 Almost there — just tap one of the buttons below to keep going!"];
    reply.urlButtons = undefined;
  }
  return renderManyChat(reply, self, secret);
}

// Health check / ManyChat connection test.
export async function GET() {
  return NextResponse.json({ ok: true, service: "tcc-msgr-bot", configured: !!process.env.MSGR_BOT_SECRET });
}
