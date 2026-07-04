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
import { advance, seedState, type BotReply, type ConvoState } from "../../lib/msgr-brain";

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
  const mkCb = (qr: { caption: string; state: unknown }) => ({
    type: "dynamic_block_callback",
    caption: clip(qr.caption),
    url: cb,
    method: "post",
    headers: { "X-Bot-Secret": secret },
    payload: { state: qr.state },
  });
  const mkUrl = (b: { caption: string; url: string }) => ({
    type: "url",
    caption: clip(b.caption),
    url: b.url,
    webview_size: "full",
  });

  // All tappable options: URL CTA(s) first, then the option callbacks.
  const options = [...(reply.urlButtons ?? []).map(mkUrl), ...reply.quickReplies.map(mkCb)];

  // BIG in-message buttons for short menus (≤6). Messenger button templates hold
  // max 3, so chunk across messages. Long lists (the 11 phone models) stay as
  // quick-reply pills — 11 buttons would be a wall of button-messages.
  const bigButtons = options.length > 0 && options.length <= 6;

  const messages: Record<string, unknown>[] = [];
  if (bigButtons) {
    reply.texts.slice(0, -1).forEach((t) => messages.push({ type: "text", text: t }));
    const lead = reply.texts[reply.texts.length - 1] ?? "Tap one 👇";
    const chunks: unknown[][] = [];
    for (let i = 0; i < options.length; i += 3) chunks.push(options.slice(i, i + 3));
    chunks.forEach((chunk, idx) => {
      messages.push({ type: "text", text: idx === 0 ? lead : "👇", buttons: chunk });
    });
  } else {
    reply.texts.forEach((t, i) => {
      const isLast = i === reply.texts.length - 1;
      messages.push(
        isLast && reply.urlButtons?.length
          ? { type: "text", text: t, buttons: reply.urlButtons.map(mkUrl) }
          : { type: "text", text: t },
      );
    });
  }

  const content: Record<string, unknown> = { messages };
  if (!bigButtons && reply.quickReplies.length) {
    content.quick_replies = reply.quickReplies.map(mkCb);
  }

  // ACTIONS DISABLED: `set_field_value` on custom fields that don't exist in
  // the ManyChat account errors the whole message, so the offer step (the only
  // one with actions) rendered nothing and the funnel dead-ended at carrier.
  // Re-enable once the fields (quote, device_name, manual, manual_reason) + tags
  // are created in ManyChat (via API). Lead-tagging is a nice-to-have; a
  // working quote is not. reply.handoff / reply.offer still drive the copy.

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
  // Fresh entry can be seeded by a static ad button via ?seed=apple|samsung|
  // google|macbook|bulk → drops straight into that device's funnel.
  const seeded = seedState(req.nextUrl.searchParams.get("seed"));
  const state: ConvoState = body.state || seeded || { step: "start" };

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
