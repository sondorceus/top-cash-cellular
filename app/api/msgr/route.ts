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
  return req.headers.get("x-bot-secret")?.trim() === expected;
}

// Render a BotReply into ManyChat Dynamic Block v2 JSON.
function renderManyChat(reply: BotReply, self: string, secret: string) {
  const messages: Record<string, unknown>[] = reply.texts.map((t, i) => {
    const isLast = i === reply.texts.length - 1;
    if (isLast && reply.urlButtons?.length) {
      return {
        type: "text",
        text: t,
        buttons: reply.urlButtons.map((b) => ({
          type: "url",
          caption: b.caption,
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
      caption: qr.caption,
      url: self,
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

  if (reply.retextState) {
    content.external_message_callback = {
      url: self,
      method: "post",
      headers: { "X-Bot-Secret": secret },
      payload: { state: reply.retextState, retext: true },
      timeout: 600,
    };
  }

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
  return renderManyChat(reply, self, secret);
}

// Health check / ManyChat connection test.
export async function GET() {
  return NextResponse.json({ ok: true, service: "tcc-msgr-bot", configured: !!process.env.MSGR_BOT_SECRET });
}
