// TCC Messenger bot brain — TRANSPORT-AGNOSTIC conversation logic.
//
// This is the single source of truth for the click-to-Messenger sales bot:
// qualify a seller (brand → model → storage → condition → carrier) and return
// TCC's REAL cash offer using the customer funnel's pricing engine
// (app/lib/quote.ts). It also handles bulk/wholesale lots and human handoff.
//
// It knows NOTHING about ManyChat or Meta. `advance(state)` takes the
// answers-so-far and returns an abstract `BotReply` (texts + quick replies +
// optional URL button + handoff/offer metadata). Two thin renderers consume it:
//   • app/api/msgr/route.ts       → ManyChat Dynamic Block v2 (live today)
//   • app/api/messenger/route.ts  → Meta Messenger Send API (owned, post App-Review)
// Same brain, two pipes — so ManyChat can be dropped without touching logic.
//
// STATELESS: every quick reply carries the full answers-so-far in its `state`.
// Renderers encode that into their transport's callback payload; there is no
// server-side session store.

import { quoteDevice, type QuoteSpec } from "./quote";

export type Step = "start" | "model" | "storage" | "condition" | "carrier" | "bulk";

export type ConvoState = {
  step: Step;
  brand?: "apple" | "samsung" | "google";
  device_slug?: string;
  device_name?: string;
  storage?: string;
  condition?: string;
  // Canonical carrier value, stashed on the carrier-choice quick reply so the
  // brain knows to compute the offer (vs. still asking the question).
  _carrier?: string;
};

// The abstract reply. Renderers map these fields to their transport.
export type BotReply = {
  texts: string[];
  quickReplies: { caption: string; state: ConvoState }[];
  // A single call-to-action URL button (the "lock my offer" link).
  urlButtons?: { caption: string; url: string }[];
  // When set, a stray typed message should re-render this state (nudge to tap).
  retextState?: ConvoState;
  // Terminal human handoff (unknown model / no auto-offer / bulk lot).
  handoff?: { reason: string; bulk?: boolean };
  // Present when we computed a real offer.
  offer?: { quote: number; deviceName: string; hot: boolean };
};

// Offers at/above this get flagged as a hot lead so a human watches the close.
export const HOT_LEAD_OFFER = 300;

// ---- device catalog (top marketplace movers; slug = PRICE_TABLE key) ------
// Kept ≤11 per brand (ManyChat quick-reply cap; Meta caps at 13). "Other"/"Not
// listed" route to a human.
export const MODELS: Record<string, { name: string; slug: string }[]> = {
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

// ---- step builders (return BotReply) --------------------------------------
function askBrand(): BotReply {
  return {
    texts: [
      "Hey! 👋 I'll get you a real cash offer in about 30 seconds — whether it's one phone or a whole batch.",
      "First up — what brand? (Or tap “I've got a bunch” if you're selling in bulk.)",
    ],
    quickReplies: [
      { caption: "🍏 Apple", state: { step: "model", brand: "apple" } },
      { caption: "📱 Samsung", state: { step: "model", brand: "samsung" } },
      { caption: "🔵 Google", state: { step: "model", brand: "google" } },
      { caption: "Something else", state: { step: "start", device_slug: "__other__" } },
      { caption: "📦 I've got a bunch (bulk)", state: { step: "bulk" } },
    ],
    retextState: { step: "start" },
  };
}

function askModel(brand: "apple" | "samsung" | "google"): BotReply {
  const list = MODELS[brand] || [];
  const quickReplies = list.map((m) => ({
    caption: m.name,
    state: { step: "storage" as const, brand, device_slug: m.slug, device_name: m.name },
  }));
  quickReplies.push({
    caption: "Not listed",
    state: { step: "storage", brand, device_slug: "__other__", device_name: "Other device" },
  });
  return { texts: ["Got it. Which model?"], quickReplies, retextState: { step: "model", brand } };
}

function askStorage(s: ConvoState): BotReply {
  return {
    texts: [`How much storage does your ${s.device_name} have?`],
    quickReplies: STORAGES.map((g) => ({
      caption: g === "1TB" ? "1 TB" : `${g} GB`,
      state: { ...s, step: "condition" as const, storage: g },
    })),
    retextState: { ...s, step: "storage" },
  };
}

function askCondition(s: ConvoState): BotReply {
  return {
    texts: ["What kind of shape is it in?"],
    quickReplies: CONDITIONS.map((c) => ({
      caption: c.caption,
      state: { ...s, step: "carrier" as const, condition: c.value },
    })),
    retextState: { ...s, step: "condition" },
  };
}

function askCarrier(s: ConvoState): BotReply {
  // Each carrier QR re-enters step "carrier" with the canonical carrier value
  // stashed in `_carrier` — the brain reads that to compute the offer.
  return {
    texts: ["Last question — who's the carrier?"],
    quickReplies: CARRIERS.map((c) => ({
      caption: c.caption,
      state: { ...s, step: "carrier" as const, _carrier: c.value },
    })),
    retextState: { ...s, step: "carrier" },
  };
}

function handToHuman(reason: string): BotReply {
  return {
    texts: [
      "Nice — that one I want to price by hand so you get the most for it. 🙌",
      "A team member will jump in right here shortly. Mind dropping your best number to reach you, just in case?",
    ],
    quickReplies: [],
    handoff: { reason },
  };
}

function handToBulk(): BotReply {
  return {
    texts: [
      "📦 Love it — a whole batch! We buy in bulk and pay wholesale rates for lots.",
      "Tell me roughly how many devices and what they are (e.g. “12 iPhones, mix of 12–14, a few Samsungs”) and a team member will put together a lot quote for you. What've you got?",
    ],
    quickReplies: [],
    handoff: { reason: "bulk/wholesale lot", bulk: true },
  };
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

async function presentOffer(s: ConvoState, carrier: string, origin: string): Promise<BotReply> {
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
  return {
    texts: [
      `💰 Your ${s.device_name} (${prettyCondition(s.condition)}, ${storagePretty(s.storage)}) is worth up to **$${r.offer}**.`,
      "Lock it in below and I'll send a free prepaid shipping label — payment goes out the day it lands. 📦",
    ],
    quickReplies: [
      { caption: "➕ Sell another", state: { step: "start" } },
      { caption: "💬 Talk to a human", state: { step: "start", device_slug: "__other__", device_name: "human request" } },
    ],
    urlButtons: [{ caption: "🔒 Lock my offer + free label", url: link }],
    offer: { quote: r.offer, deviceName: s.device_name || "your device", hot: r.offer >= HOT_LEAD_OFFER },
  };
}

// ---- the state machine ----------------------------------------------------
// `origin` is the site origin (e.g. https://topcashcellular.com) for the CTA link.
export async function advance(state: ConvoState, origin: string): Promise<BotReply> {
  switch (state.step) {
    case "start":
      if (state.device_slug === "__other__") return handToHuman("chose 'something else' / human request");
      return askBrand();
    case "bulk":
      return handToBulk();
    case "model":
      return state.brand ? askModel(state.brand) : askBrand();
    case "storage":
      if (!state.device_slug || state.device_slug === "__other__") return handToHuman("model not listed");
      return askStorage(state);
    case "condition":
      return askCondition(state);
    case "carrier":
      if (state._carrier) return presentOffer(state, state._carrier, origin);
      return askCarrier(state);
    default:
      return askBrand();
  }
}
