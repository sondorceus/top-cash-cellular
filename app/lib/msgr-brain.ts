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

export type Step = "start" | "model" | "storage" | "condition" | "carrier" | "bulk" | "macbook";

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
  // Verizon only: is the phone still financed/locked to Verizon? Undefined =
  // not yet asked. A locked Verizon phone is worth ~$80 less, so we must ask.
  carrierLocked?: boolean;
  // iPhone generation chosen (Apple uses a 2-step: generation → model) so the
  // whole lineup fits without hitting the 11-button cap.
  gen?: string;
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

// Apple 2-step picker (generation → model) — keeps the whole iPhone lineup
// under the 11-button cap. caption = short button label; name = full label for
// the quote. Slugs must exist in PRICE_TABLE.
const APPLE_GENS = ["iPhone 17", "iPhone 16", "iPhone 15", "iPhone 14", "iPhone 13"];
const APPLE_BY_GEN: Record<string, { caption: string; name: string; slug: string }[]> = {
  "iPhone 17": [
    { caption: "17 Pro Max", name: "iPhone 17 Pro Max", slug: "ip17pm" },
    { caption: "17 Pro", name: "iPhone 17 Pro", slug: "ip17p" },
    { caption: "17 Air", name: "iPhone 17 Air", slug: "ip17air" },
    { caption: "17", name: "iPhone 17", slug: "ip17" },
    { caption: "17e", name: "iPhone 17e", slug: "ip17e" },
  ],
  "iPhone 16": [
    { caption: "16 Pro Max", name: "iPhone 16 Pro Max", slug: "ip16pm" },
    { caption: "16 Pro", name: "iPhone 16 Pro", slug: "ip16p" },
    { caption: "16 Plus", name: "iPhone 16 Plus", slug: "ip16plus" },
    { caption: "16", name: "iPhone 16", slug: "ip16" },
    { caption: "16e", name: "iPhone 16e", slug: "ip16e" },
  ],
  "iPhone 15": [
    { caption: "15 Pro Max", name: "iPhone 15 Pro Max", slug: "ip15pm" },
    { caption: "15 Pro", name: "iPhone 15 Pro", slug: "ip15p" },
    { caption: "15 Plus", name: "iPhone 15 Plus", slug: "ip15plus" },
    { caption: "15", name: "iPhone 15", slug: "ip15" },
  ],
  "iPhone 14": [
    { caption: "14 Pro Max", name: "iPhone 14 Pro Max", slug: "ip14pm" },
    { caption: "14 Pro", name: "iPhone 14 Pro", slug: "ip14p" },
    { caption: "14 Plus", name: "iPhone 14 Plus", slug: "ip14plus" },
    { caption: "14", name: "iPhone 14", slug: "ip14" },
  ],
  "iPhone 13": [
    { caption: "13 Pro Max", name: "iPhone 13 Pro Max", slug: "ip13pm" },
    { caption: "13 Pro", name: "iPhone 13 Pro", slug: "ip13p" },
    { caption: "13", name: "iPhone 13", slug: "ip13" },
    { caption: "13 mini", name: "iPhone 13 mini", slug: "ip13mini" },
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
      "Hey! 👋 I'll get you a real cash offer in about 30 seconds.",
      "What are you selling? Tap one 👇",
    ],
    quickReplies: [
      { caption: "📱 iPhone", state: { step: "model", brand: "apple" } },
      { caption: "📱 Samsung", state: { step: "model", brand: "samsung" } },
      { caption: "🔵 Pixel", state: { step: "model", brand: "google" } },
      { caption: "💻 MacBook", state: { step: "macbook" } },
      { caption: "📦 A bunch (bulk)", state: { step: "bulk" } },
      { caption: "Something else", state: { step: "start", device_slug: "__other__" } },
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

// Apple step 1: which generation. Step 2 (askAppleModel) then lists that gen's
// specific models — full iPhone lineup without the 11-button cap.
function askAppleGen(): BotReply {
  return {
    texts: ["Got it — which iPhone? 📱"],
    quickReplies: APPLE_GENS.map((g) => ({
      caption: g,
      state: { step: "model" as const, brand: "apple" as const, gen: g },
    })),
    retextState: { step: "model", brand: "apple" },
  };
}

function askAppleModel(gen: string): BotReply {
  const list = APPLE_BY_GEN[gen] || [];
  const quickReplies = list.map((m) => ({
    caption: m.caption,
    state: { step: "storage" as const, brand: "apple" as const, gen, device_slug: m.slug, device_name: m.name },
  }));
  quickReplies.push({
    caption: "Not sure",
    state: { step: "storage", brand: "apple", gen, device_slug: "__other__", device_name: `Other ${gen}` },
  });
  return { texts: [`Which ${gen}?`], quickReplies, retextState: { step: "model", brand: "apple", gen } };
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

function handToMacBook(): BotReply {
  return {
    texts: [
      "💻 Nice — MacBooks we price by hand so you get the most for it.",
      "Tell me which MacBook it is (e.g. “MacBook Air M2 2022, 256GB”) plus the condition, and a team member will get you a quote right here. What've you got?",
    ],
    quickReplies: [],
    handoff: { reason: "macbook — manual quote" },
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

// Verizon lock question — a financed/locked Verizon phone is worth ~$80 less,
// so we ask before quoting (skipping it would overpay).
function askVzLock(s: ConvoState): BotReply {
  return {
    texts: ["📶 Quick one for Verizon — is it paid off, or still financed / locked to Verizon?"],
    quickReplies: [
      { caption: "🔓 Paid off", state: { ...s, step: "carrier", _carrier: "verizon", carrierLocked: false } },
      { caption: "🔒 Still financed", state: { ...s, step: "carrier", _carrier: "verizon", carrierLocked: true } },
    ],
  };
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
    carrierLocked: s.carrierLocked,
    isPhone: true,
  };
  const r = await quoteDevice(spec).catch(() => null);
  if (!r || r.offer == null || r.manualReview) {
    return handToHuman(r?.reason || "quote engine returned no auto-offer");
  }

  const link = `${origin}/?src=msgr&d=${encodeURIComponent(s.device_slug)}`;
  return {
    texts: [
      `💰 Your ${s.device_name} (${prettyCondition(s.condition)}, ${storagePretty(s.storage)}) is worth up to $${r.offer}!`,
      "Tap below to lock it in — free prepaid shipping label, and payment goes out the day it lands. 📦",
    ],
    quickReplies: [
      { caption: "➕ Sell another", state: { step: "start" } },
      { caption: "💬 Talk to a human", state: { step: "start", device_slug: "__other__", device_name: "human request" } },
    ],
    // Messenger caps button titles at 20 chars — keep it short or the whole
    // quote message fails to render (funnel dead-ends at carrier).
    urlButtons: [{ caption: "🔒 Lock my offer", url: link }],
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
    case "macbook":
      return handToMacBook();
    case "model":
      if (!state.brand) return askBrand();
      // Apple: generation first, then the specific model.
      if (state.brand === "apple") return state.gen ? askAppleModel(state.gen) : askAppleGen();
      return askModel(state.brand);
    case "storage":
      if (!state.device_slug || state.device_slug === "__other__") return handToHuman("model not listed");
      return askStorage(state);
    case "condition":
      return askCondition(state);
    case "carrier":
      if (!state._carrier) return askCarrier(state);
      // Verizon needs the locked/unlocked answer before we can quote right.
      if (state._carrier === "verizon" && state.carrierLocked === undefined) return askVzLock(state);
      return presentOffer(state, state._carrier, origin);
    default:
      return askBrand();
  }
}
