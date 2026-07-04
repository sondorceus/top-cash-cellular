// TCC Messenger bot brain — the server-driven conversation behind our
// click-to-Messenger ads. It qualifies a seller (brand → model → storage →
// condition → carrier) and returns TCC's REAL cash offer in-chat, using the
// exact same pricing engine as the customer funnel (app/lib/quote.ts) — no
// drift, no canned ranges.
//
// TRANSPORT: today this speaks ManyChat's "Dynamic Block v2" JSON, so ManyChat
// is a thin pipe (one Dynamic Block node points here). The SAME state machine
// will back a direct Meta Messenger webhook once App Review clears — at which
// point ManyChat can be cancelled and only the render layer changes.
//
// STATELESS: every quick-reply is a `dynamic_block_callback` that carries the
// answers-so-far in its `payload.state`. Each tap POSTs back here with that
// state, we advance one step, and emit the next question. No session store.
//
//   POST /api/msgr
//   header: X-Bot-Secret: <MSGR_BOT_SECRET>
//   body:   { state?: ConvoState, retext?: boolean }   (payload we emitted)
//
// See: https://manychat.github.io/dynamic_block_docs/

import { NextRequest, NextResponse } from "next/server";
import { quoteDevice, type QuoteSpec } from "../../lib/quote";

export const dynamic = "force-dynamic";

// ---- auth -----------------------------------------------------------------
function authed(req: NextRequest): boolean {
  const expected = process.env.MSGR_BOT_SECRET;
  if (!expected) return false; // fail closed if unconfigured
  return req.headers.get("x-bot-secret")?.trim() === expected;
}

// ---- conversation state ---------------------------------------------------
type Step = "start" | "model" | "storage" | "condition" | "carrier" | "bulk";
type ConvoState = {
  step: Step;
  brand?: "apple" | "samsung" | "google";
  device_slug?: string;
  device_name?: string;
  storage?: string;
  condition?: string;
  // Canonical carrier value, stashed on the carrier-choice quick reply so the
  // router knows to compute the offer (vs. still asking the question).
  _carrier?: string;
};

// Offers at/above this get flagged as a hot lead so a human watches the close.
const HOT_LEAD_OFFER = 300;

// ---- device catalog (top marketplace movers; slug = PRICE_TABLE key) ------
// Kept ≤11 per brand (ManyChat quick-reply cap). "Other" routes to a human.
const MODELS: Record<string, { name: string; slug: string }[]> = {
  apple: [
    { name: "iPhone 16 Pro Max", slug: "ip16pm" },
    { name: "iPhone 16 Pro", slug: "ip16p" },
    { name: "iPhone 16", slug: "ip16" },
    { name: "iPhone 15 Pro Max", slug: "ip15pm" },
    { name: "iPhone 15 Pro", slug: "ip15p" },
    { name: "iPhone 15", slug: "ip15" },
    { name: "iPhone 14 Pro Max", slug: "ip14pm" },
    { name: "iPhone 14", slug: "ip14" },
    { name: "iPhone 13 Pro Max", slug: "ip13pm" },
    { name: "iPhone 13", slug: "ip13" },
  ],
  samsung: [
    { name: "Galaxy S24 Ultra", slug: "gs24u" },
    { name: "Galaxy S24+", slug: "gs24p" },
    { name: "Galaxy S24", slug: "gs24" },
    { name: "Galaxy S23 Ultra", slug: "gs23u" },
    { name: "Galaxy S23", slug: "gs23" },
    { name: "Galaxy S25 Ultra", slug: "gs25u" },
    { name: "Galaxy S25", slug: "gs25" },
    { name: "Galaxy Z Flip 6", slug: "gzflip6" },
    { name: "Galaxy Z Fold 6", slug: "gzfold6" },
  ],
  google: [
    { name: "Pixel 9 Pro", slug: "px9p" },
    { name: "Pixel 9", slug: "px9" },
    { name: "Pixel 8 Pro", slug: "px8p" },
    { name: "Pixel 8", slug: "px8" },
  ],
};

const STORAGES = ["128", "256", "512", "1TB"];
const CONDITIONS: { caption: string; value: string }[] = [
  { caption: "✨ Like new", value: "mint" },
  { caption: "👍 Good", value: "good" },
  { caption: "🩹 Fair / wear", value: "fair" },
  { caption: "💔 Broken", value: "broken" },
];
const CARRIERS: { caption: string; value: string }[] = [
  { caption: "🔓 Unlocked", value: "unlocked" },
  { caption: "AT&T", value: "att" },
  { caption: "T-Mobile", value: "tmobile" },
  { caption: "Verizon", value: "verizon" },
  { caption: "Other", value: "other" },
];

// ---- Dynamic Block v2 builders --------------------------------------------
type QR = {
  type: "dynamic_block_callback";
  caption: string;
  url: string;
  method: "post";
  headers: Record<string, string>;
  payload: Record<string, unknown>;
};

function makeQR(self: string, secret: string, caption: string, state: ConvoState): QR {
  return {
    type: "dynamic_block_callback",
    caption,
    url: self,
    method: "post",
    headers: { "X-Bot-Secret": secret },
    payload: { state },
  };
}

function block(
  texts: string[],
  quickReplies: QR[] = [],
  extras: { actions?: unknown[]; buttons?: unknown[]; externalCallback?: { self: string; secret: string; state: ConvoState } } = {},
) {
  const messages: Record<string, unknown>[] = texts.map((t, i) =>
    // Buttons ride on the last text message (Messenger renders them there).
    i === texts.length - 1 && extras.buttons
      ? { type: "text", text: t, buttons: extras.buttons }
      : { type: "text", text: t },
  );
  const content: Record<string, unknown> = { messages };
  if (quickReplies.length) content.quick_replies = quickReplies;
  if (extras.actions?.length) content.actions = extras.actions;
  // Route stray free-text back here so we can nudge them to tap a button.
  if (extras.externalCallback) {
    const { self, secret, state } = extras.externalCallback;
    content.external_message_callback = {
      url: self,
      method: "post",
      headers: { "X-Bot-Secret": secret },
      payload: { state, retext: true },
      timeout: 600,
    };
  }
  return NextResponse.json({ version: "v2", content });
}

// ---- step renderers -------------------------------------------------------
function askBrand(self: string, secret: string) {
  const qrs = [
    makeQR(self, secret, "🍏 Apple", { step: "model", brand: "apple" }),
    makeQR(self, secret, "📱 Samsung", { step: "model", brand: "samsung" }),
    makeQR(self, secret, "🔵 Google", { step: "model", brand: "google" }),
    makeQR(self, secret, "Something else", { step: "start", brand: undefined, device_slug: "__other__" }),
    // Bulk/wholesale lots skip the single-device funnel and go to a human for a lot quote.
    makeQR(self, secret, "📦 I've got a bunch (bulk)", { step: "bulk" }),
  ];
  return block(
    [
      "Hey! 👋 I'll get you a real cash offer in about 30 seconds — whether it's one phone or a whole batch.",
      "First up — what brand? (Or tap “I've got a bunch” if you're selling in bulk.)",
    ],
    qrs,
    { externalCallback: { self, secret, state: { step: "start" } } },
  );
}

function askModel(self: string, secret: string, brand: "apple" | "samsung" | "google") {
  const list = MODELS[brand] || [];
  const qrs = list.map((m) => makeQR(self, secret, m.name, { step: "storage", brand, device_slug: m.slug, device_name: m.name }));
  // 11th slot: not-listed → human.
  qrs.push(makeQR(self, secret, "Not listed", { step: "storage", brand, device_slug: "__other__", device_name: "Other device" }));
  return block(["Got it. Which model?"], qrs, { externalCallback: { self, secret, state: { step: "model", brand } } });
}

function askStorage(self: string, secret: string, s: ConvoState) {
  const qrs = STORAGES.map((g) => makeQR(self, secret, g === "1TB" ? "1 TB" : `${g} GB`, { ...s, step: "condition", storage: g }));
  return block([`How much storage does your ${s.device_name} have?`], qrs, { externalCallback: { self, secret, state: { ...s, step: "storage" } } });
}

function askCondition(self: string, secret: string, s: ConvoState) {
  const qrs = CONDITIONS.map((c) => makeQR(self, secret, c.caption, { ...s, step: "carrier", condition: c.value }));
  return block(["What kind of shape is it in?"], qrs, { externalCallback: { self, secret, state: { ...s, step: "condition" } } });
}

function askCarrier(self: string, secret: string, s: ConvoState) {
  // Each carrier QR re-enters step "carrier" but with the canonical carrier
  // value stashed in `_carrier` — the router reads that to compute the offer.
  const qrs = CARRIERS.map((c) =>
    makeQR(self, secret, c.caption, { ...s, step: "carrier", _carrier: c.value }),
  );
  return block(["Last question — who's the carrier?"], qrs, { externalCallback: { self, secret, state: { ...s, step: "carrier" } } });
}

// Human-handoff terminal (unknown model, or an offer we won't auto-quote).
function handToHuman(reason: string) {
  return block(
    [
      "Nice — that one I want to price by hand so you get the most for it. 🙌",
      "A team member will jump in right here shortly. Mind dropping your best number to reach you, just in case?",
    ],
    [],
    {
      actions: [
        { action: "set_field_value", field_name: "manual", value: true },
        { action: "set_field_value", field_name: "manual_reason", value: reason },
        { action: "add_tag", tag_name: "needs_human" },
      ],
    },
  );
}

// Bulk/wholesale terminal — big lots are priced by hand, so collect what they
// have and route to a human with a bulk tag.
function handToBulk() {
  return block(
    [
      "📦 Love it — a whole batch! We buy in bulk and pay wholesale rates for lots.",
      "Tell me roughly how many devices and what they are (e.g. “12 iPhones, mix of 12–14, a few Samsungs”) and a team member will put together a lot quote for you. What've you got?",
    ],
    [],
    {
      actions: [
        { action: "set_field_value", field_name: "manual", value: true },
        { action: "set_field_value", field_name: "manual_reason", value: "bulk/wholesale lot" },
        { action: "add_tag", tag_name: "bulk_lead" },
        { action: "add_tag", tag_name: "needs_human" },
      ],
    },
  );
}

// ---- final: compute + present the offer -----------------------------------
async function presentOffer(self: string, secret: string, s: ConvoState, carrier: string, origin: string) {
  if (!s.device_slug || s.device_slug === "__other__") {
    return handToHuman("model not in quick-quote catalog");
  }
  const spec: QuoteSpec = {
    modelId: s.device_slug,
    modelLabel: s.device_name,
    storage: s.storage,
    condition: s.condition || "good",
    carrier,
    isPhone: true,
  };
  const r = await quoteDevice(spec).catch(() => null);

  if (!r || r.offer == null || r.manualReview) {
    return handToHuman(r?.reason || "quote engine returned no auto-offer");
  }

  const link = `${origin}/?src=msgr&d=${encodeURIComponent(s.device_slug)}`;
  const hot = r.offer >= HOT_LEAD_OFFER;
  const actions: unknown[] = [
    { action: "set_field_value", field_name: "quote", value: r.offer },
    { action: "set_field_value", field_name: "device_name", value: s.device_name },
  ];
  if (hot) actions.push({ action: "add_tag", tag_name: "hot_lead" });

  const buttons = [
    { type: "url", caption: "🔒 Lock my offer + free label", url: link, webview_size: "full" },
  ];
  const qrs = [
    makeQR(self, secret, "➕ Sell another", { step: "start" }),
    makeQR(self, secret, "💬 Talk to a human", { step: "start", device_slug: "__other__", device_name: "human request" }),
  ];
  return block(
    [
      `💰 Your ${s.device_name} (${prettyCondition(s.condition)}, ${storagePretty(s.storage)}) is worth up to **$${r.offer}**.`,
      "Lock it in below and I'll send a free prepaid shipping label — payment goes out the day it lands. 📦",
    ],
    qrs,
    { actions, buttons },
  );
}

function prettyCondition(c?: string) {
  switch (c) {
    case "mint": return "like new";
    case "good": return "good";
    case "fair": return "fair";
    case "broken": return "broken";
    default: return c || "good";
  }
}
function storagePretty(s?: string) {
  if (!s) return "";
  return s === "1TB" ? "1 TB" : `${s} GB`;
}

// ---- router ---------------------------------------------------------------
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
  const state = body.state || { step: "start" };

  // A stray typed message: gently re-render the current step.
  // (external_message_callback sets retext=true.)
  switch (state.step) {
    case "start":
      if (state.device_slug === "__other__") return handToHuman("chose 'something else' / human request");
      return askBrand(self, secret);
    case "bulk":
      return handToBulk();
    case "model":
      return state.brand ? askModel(self, secret, state.brand) : askBrand(self, secret);
    case "storage":
      if (!state.device_slug || state.device_slug === "__other__") return handToHuman("model not listed");
      return askStorage(self, secret, state);
    case "condition":
      return askCondition(self, secret, state);
    case "carrier": {
      // If a carrier was chosen (_carrier present), compute the offer.
      const carrier = state._carrier;
      if (carrier) return presentOffer(self, secret, state, carrier, req.nextUrl.origin);
      return askCarrier(self, secret, state);
    }
    default:
      return askBrand(self, secret);
  }
}

// Health check / ManyChat connection test.
export async function GET() {
  return NextResponse.json({ ok: true, service: "tcc-msgr-bot", configured: !!process.env.MSGR_BOT_SECRET });
}
