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

export type Step = "start" | "model" | "storage" | "condition" | "carrier" | "bulk" | "macbook" | "lock" | "ship" | "team";

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
  // "es" = run the whole flow in Spanish. Chosen at the opener, carried on every
  // quick-reply's state so every step adapts. undefined/"en" = English.
  lang?: "en" | "es";
  // Meta PSID, injected at the RENDERER boundary (not by brain steps) so every
  // tap round-trips it — lets /api/msgr record its outbound texts in the
  // msgr-sent ledger the owner-takeover detection reads.
  psid?: string;
};

// Tiny bilingual picker — keeps each step's copy readable inline.
function tx(s: ConvoState, en: string, es: string): string {
  return s.lang === "es" ? es : en;
}

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
    { name: "iPhone 17 Pro Max", slug: "ip17pm" },
    { name: "iPhone 17 Pro", slug: "ip17p" },
    { name: "iPhone 17", slug: "ip17" },
    { name: "iPhone 16 Pro Max", slug: "ip16pm" },
    { name: "iPhone 16 Pro", slug: "ip16p" },
    { name: "iPhone 16", slug: "ip16" },
    { name: "iPhone 15 Pro Max", slug: "ip15pm" },
    { name: "iPhone 15", slug: "ip15" },
    { name: "iPhone 14 Pro Max", slug: "ip14pm" },
    { name: "iPhone 14", slug: "ip14" },
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
  { caption: "🔒 Sealed (new)", value: "sealed" },
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
function askBrand(lang?: "en" | "es"): BotReply {
  const es = lang === "es";
  return {
    texts: [
      es
        ? "¡Hola! 👋 Te doy una oferta real en efectivo en unos 30 segundos — recogida local, efectivo en mano, sin compromiso. 💵"
        : "Hey! 👋 I'll get you a real cash offer in about 30 seconds — local pickup, cash in hand, no obligation. 💵",
      es ? "¿Qué estás vendiendo? Toca uno 👇" : "What are you selling? Tap one 👇",
    ],
    quickReplies: [
      { caption: "📱 iPhone", state: { step: "model", brand: "apple", lang } },
      { caption: "📱 Samsung", state: { step: "model", brand: "samsung", lang } },
      { caption: "🔵 Pixel", state: { step: "model", brand: "google", lang } },
      { caption: "💻 MacBook", state: { step: "macbook", lang } },
      { caption: es ? "📦 Varios (mayoreo)" : "📦 A bunch (bulk)", state: { step: "bulk", lang } },
      es
        ? { caption: "🇺🇸 English", state: { step: "start", lang: "en" } }
        : { caption: "🌎 Español", state: { step: "start", lang: "es" } },
      { caption: es ? "Otra cosa" : "Something else", state: { step: "start", device_slug: "__other__", lang } },
    ],
    retextState: { step: "start", lang },
  };
}

function askModel(brand: "apple" | "samsung" | "google", lang?: "en" | "es"): BotReply {
  const es = lang === "es";
  const list = MODELS[brand] || [];
  const quickReplies = list.map((m) => ({
    caption: m.name,
    state: { step: "storage" as const, brand, device_slug: m.slug, device_name: m.name, lang },
  }));
  quickReplies.push({
    caption: es ? "No aparece" : "Not listed",
    state: { step: "storage", brand, device_slug: "__other__", device_name: "Other device", lang },
  });
  return { texts: [es ? "¡Bien! 👍 ¿Cuál?" : "Nice 👍 Which one?"], quickReplies, retextState: { step: "model", brand, lang } };
}

function askStorage(s: ConvoState): BotReply {
  return {
    texts: [tx(s, `How much storage does your ${s.device_name} have?`, `¿Cuánto almacenamiento tiene tu ${s.device_name}?`)],
    quickReplies: STORAGES.map((g) => ({
      caption: g === "1TB" ? "1 TB" : `${g} GB`,
      state: { ...s, step: "condition" as const, storage: g },
    })),
    retextState: { ...s, step: "storage" },
  };
}

function askCondition(s: ConvoState): BotReply {
  const es = s.lang === "es";
  const caps = es
    ? ["🔒 Sellado", "✨ Como nuevo", "👍 Bueno", "🩹 Regular", "💔 Roto"]
    : CONDITIONS.map((c) => c.caption);
  return {
    texts: [
      tx(s, "What kind of shape is it in? 📱", "¿En qué condición está? 📱"),
      tx(
        s,
        "🔒 Sealed — brand new, still in the plastic\n✨ Like new — no scratches, works perfectly\n👍 Good — light wear, fully working\n🩹 Fair — visible scratches/wear, still works\n💔 Broken — cracked or not working right",
        "🔒 Sellado — nuevo, aún en el plástico\n✨ Como nuevo — sin rayones, funciona perfecto\n👍 Bueno — poco uso, funciona bien\n🩹 Regular — rayones/desgaste, aún funciona\n💔 Roto — quebrado o con fallas",
      ),
    ],
    quickReplies: CONDITIONS.map((c, i) => ({
      caption: caps[i],
      state: { ...s, step: "carrier" as const, condition: c.value },
    })),
    retextState: { ...s, step: "condition" },
  };
}

function askCarrier(s: ConvoState): BotReply {
  // Each carrier QR re-enters step "carrier" with the canonical carrier value
  // stashed in `_carrier` — the brain reads that to compute the offer.
  const es = s.lang === "es";
  const caps = es ? ["🔓 Desbloqueado", "AT&T", "T-Mobile", "Verizon", "Otra"] : CARRIERS.map((c) => c.caption);
  return {
    texts: [
      tx(
        s,
        "Last one — what carrier is it on? 📶 (Unlocked usually pays the most 💵)",
        "Última — ¿en qué compañía está? 📶 (Desbloqueado suele pagar más 💵)",
      ),
    ],
    quickReplies: CARRIERS.map((c, i) => ({
      caption: caps[i],
      state: { ...s, step: "carrier" as const, _carrier: c.value },
    })),
    retextState: { ...s, step: "carrier" },
  };
}

function handToHuman(s: ConvoState, reason: string): BotReply {
  return {
    texts: [
      tx(
        s,
        "Nice — that one I want to price by hand so you get the most for it. 🙌",
        "¡Perfecto! Esa la cotizo a mano para darte lo máximo. 🙌",
      ),
      tx(
        s,
        "A team member will jump in right here shortly. Mind dropping your best number to reach you, just in case?",
        "Un miembro del equipo te atiende aquí en un momento. ¿Me dejas tu mejor número por si acaso?",
      ),
    ],
    quickReplies: [],
    handoff: { reason },
  };
}

// Local close: we don't ship — we meet up and pay cash. Fires a handoff so the
// owner gets an SMS to reach out and set the meetup (see notifyLead in the route).
function handToLocal(s: ConvoState): BotReply {
  return {
    texts: [
      tx(
        s,
        "🤝 Locked in! We meet up local, do a quick 2-min check, and you walk away with cash in hand — no fees, no waiting. 💵",
        "🤝 ¡Cerrado! Nos vemos aquí cerca, revisamos 2 minutos y te vas con efectivo en mano — sin comisiones, sin esperas. 💵",
      ),
      tx(
        s,
        "Someone will text you shortly to set a time. What's the best number to reach you?",
        "Te escribimos pronto para coordinar la hora. ¿Cuál es tu mejor número?",
      ),
    ],
    quickReplies: [],
    handoff: { reason: `LOCK-IN (local meetup): ${s.device_name || "device"} — reach out to schedule + pay cash` },
  };
}

// General "talk to a person" handoff (customer already has a quote / just wants help).
function handToTeam(s: ConvoState): BotReply {
  return {
    texts: [
      tx(
        s,
        "👋 You got it — a team member will jump in right here shortly to help you out.",
        "👋 ¡Claro! Un miembro del equipo te atiende aquí en un momento.",
      ),
      tx(
        s,
        "Mind dropping your best number in case we get disconnected?",
        "¿Me dejas tu mejor número por si se corta la conversación?",
      ),
    ],
    quickReplies: [],
    handoff: { reason: "customer asked to talk to the team" },
  };
}

// Out-of-town close: send them to the site, which DOES ship (free label, pay on arrival).
function handToSite(s: ConvoState, origin: string): BotReply {
  const link = `${origin}/?src=msgr&d=${encodeURIComponent(s.device_slug || "")}`;
  return {
    texts: [
      tx(
        s,
        "🌐 Check out topcashcellular.com — see everything we buy, real reviews, and exactly how it works.",
        "🌐 Visita topcashcellular.com — mira todo lo que compramos, reseñas reales y cómo funciona.",
      ),
      tx(
        s,
        "Out of town? You can sell right there too — free prepaid shipping label, and we pay the day it lands. 👉",
        "¿Estás lejos? También puedes vender ahí — etiqueta de envío prepagada gratis y pagamos el día que llega. 👉",
      ),
    ],
    quickReplies: [{ caption: tx(s, "➕ Sell another", "➕ Vender otro"), state: { step: "start", lang: s.lang } }],
    urlButtons: [{ caption: tx(s, "🌐 Go to our site", "🌐 Ir al sitio"), url: link }],
  };
}

function handToMacBook(s: ConvoState): BotReply {
  return {
    texts: [
      tx(
        s,
        "💻 Nice — MacBooks we price by hand so you get the most for it.",
        "💻 ¡Bien! Las MacBook las cotizamos a mano para darte lo máximo.",
      ),
      tx(
        s,
        "Tell me which MacBook it is (e.g. “MacBook Air M2 2022, 256GB”) plus the condition, and a team member will get you a quote right here. What've you got?",
        "Dime cuál MacBook es (ej. “MacBook Air M2 2022, 256GB”) y su condición, y un miembro del equipo te cotiza aquí mismo. ¿Qué tienes?",
      ),
    ],
    quickReplies: [],
    handoff: { reason: "macbook — manual quote" },
  };
}

function handToBulk(s: ConvoState): BotReply {
  return {
    texts: [
      tx(
        s,
        "📦 Love it — a whole batch! We buy in bulk and pay wholesale rates for lots.",
        "📦 ¡Excelente — un lote completo! Compramos al por mayor y pagamos precio de mayoreo.",
      ),
      tx(
        s,
        "Tell me roughly how many devices and what they are (e.g. “12 iPhones, mix of 12–14, a few Samsungs”) and a team member will put together a lot quote for you. What've you got?",
        "Dime más o menos cuántos equipos y cuáles son (ej. “12 iPhones, entre 12 y 14, unos Samsung”) y un miembro del equipo te arma una cotización por el lote. ¿Qué tienes?",
      ),
    ],
    quickReplies: [],
    handoff: { reason: "bulk/wholesale lot", bulk: true },
  };
}

function prettyCondition(c: string | undefined, es: boolean) {
  const en: Record<string, string> = { sealed: "sealed", mint: "like new", good: "good", fair: "fair", broken: "broken" };
  const sp: Record<string, string> = { sealed: "sellado", mint: "como nuevo", good: "bueno", fair: "regular", broken: "roto" };
  return (es ? sp : en)[c || "good"] || c || (es ? "bueno" : "good");
}
function storagePretty(s?: string) {
  if (!s) return "";
  return s === "1TB" ? "1 TB" : `${s} GB`;
}

// Verizon lock question — a financed/locked Verizon phone is worth ~$80 less,
// so we ask before quoting (skipping it would overpay).
function askVzLock(s: ConvoState): BotReply {
  const es = s.lang === "es";
  return {
    texts: [
      tx(
        s,
        "📶 Quick one for Verizon — is it paid off, or still financed / locked to Verizon?",
        "📶 Rápida sobre Verizon — ¿está pagado, o aún financiado / bloqueado con Verizon?",
      ),
    ],
    quickReplies: [
      { caption: es ? "🔓 Pagado" : "🔓 Paid off", state: { ...s, step: "carrier", _carrier: "verizon", carrierLocked: false } },
      { caption: es ? "🔒 Financiado" : "🔒 Still financed", state: { ...s, step: "carrier", _carrier: "verizon", carrierLocked: true } },
    ],
  };
}

async function presentOffer(s: ConvoState, carrier: string, origin: string): Promise<BotReply> {
  if (!s.device_slug || s.device_slug === "__other__") {
    return handToHuman(s, "model not in quick-quote catalog");
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
    return handToHuman(s, r?.reason || "quote engine returned no auto-offer");
  }

  const es = s.lang === "es";
  return {
    texts: [
      es
        ? `💰 ¡Tu ${s.device_name} (${prettyCondition(s.condition, true)}, ${storagePretty(s.storage)}) vale hasta $${r.offer}!`
        : `💰 Your ${s.device_name} (${prettyCondition(s.condition, false)}, ${storagePretty(s.storage)}) is worth up to $${r.offer}!`,
      es
        ? "Somos locales — efectivo en mano, sin comisiones, sin compromiso 💵 Cierra abajo, o mira el sitio / habla con el equipo. 👇"
        : "We're local — cash on the spot, no fees, no obligation 💵 Lock it in below, or browse the site / chat with the team. 👇",
    ],
    // Messenger caps button titles at 20 chars.
    quickReplies: [
      { caption: es ? "🤝 Cerrar trato" : "🤝 Lock it in", state: { ...s, step: "lock" } },
      { caption: es ? "💬 Hablar con equipo" : "💬 Talk to our team", state: { step: "team", lang: s.lang } },
      { caption: es ? "🌐 Ver el sitio" : "🌐 See our site", state: { ...s, step: "ship" } },
      { caption: es ? "➕ Vender otro" : "➕ Sell another", state: { step: "start", lang: s.lang } },
    ],
    offer: { quote: r.offer, deviceName: s.device_name || "your device", hot: r.offer >= HOT_LEAD_OFFER },
  };
}

// Seed a starting state from a URL param (?seed=), so a static ad button can
// drop someone straight into a device's funnel (menu-first, no "Sell Now" tap).
// apple/samsung/google → that brand's model list; macbook/bulk → their handoff.
export function seedState(seed: string | null | undefined): ConvoState | null {
  switch (seed) {
    case "apple":
    case "samsung":
    case "google":
      return { step: "model", brand: seed };
    case "macbook":
      return { step: "macbook" };
    case "bulk":
      return { step: "bulk" };
    case "human":
      // routes into the start step's "__other__" branch → straight to a human.
      return { step: "start", device_slug: "__other__" };
    default:
      return null;
  }
}

// ---- the state machine ----------------------------------------------------
// `origin` is the site origin (e.g. https://topcashcellular.com) for the CTA link.
export async function advance(state: ConvoState, origin: string): Promise<BotReply> {
  switch (state.step) {
    case "start":
      if (state.device_slug === "__other__") return handToHuman(state, "chose 'something else' / human request");
      return askBrand(state.lang);
    case "bulk":
      return handToBulk(state);
    case "macbook":
      return handToMacBook(state);
    case "lock":
      return handToLocal(state);
    case "ship":
      return handToSite(state, origin);
    case "team":
      return handToTeam(state);
    case "model":
      return state.brand ? askModel(state.brand, state.lang) : askBrand(state.lang);
    case "storage":
      if (!state.device_slug || state.device_slug === "__other__") return handToHuman(state, "model not listed");
      return askStorage(state);
    case "condition":
      return askCondition(state);
    case "carrier":
      if (!state._carrier) return askCarrier(state);
      // Verizon needs the locked/unlocked answer before we can quote right.
      if (state._carrier === "verizon" && state.carrierLocked === undefined) return askVzLock(state);
      return presentOffer(state, state._carrier, origin);
    default:
      return askBrand(state.lang);
  }
}

// Smart bulk: detect a typed "I have 10 17 Pro Max" / "selling 20 iphones" and
// jump straight to the bulk handoff. A single device ("iphone 17 pro max") must
// NOT trigger — so we require a real count (≥2) in a quantity position, never
// just any number (17 is a model). Used by the route on typed input.
export function detectBulkIntent(text: string | undefined): boolean {
  if (!text) return false;
  const t = text.toLowerCase();
  if (/\b(bulk|wholesale|a lot of|lot of|in bulk|whole batch|multiple)\b/.test(t)) return true;
  let m = t.match(/\b(?:have|got|selling|sell|about|around|like|approx)\s+(\d{1,4})\b/);
  if (m && +m[1] >= 2) return true;
  m = t.match(/\b(\d{1,4})\s*(?:x\b|units?|pieces?|phones|iphones|devices|samsungs?|pixels?|macbooks?)/);
  if (m && +m[1] >= 2) return true;
  // "N <2-digit model> pro/max/…" — e.g. "10 17 pro max", "5 15 plus"
  m = t.match(/\b(\d{1,4})\s+\d{2}\s*(?:pro|max|plus|ultra|air|mini|e|fe|s)\b/);
  if (m && +m[1] >= 2) return true;
  return false;
}
