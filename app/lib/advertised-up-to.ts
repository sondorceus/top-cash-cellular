// ADVERTISED "UP TO" — the one function behind every "up to $X" a seller
// reads: /sell/[slug] (title, meta, H1, JSON-LD), the homepage cards,
// series tiles and ticker (getMaxPrice), and the /go board. It asks the
// quote ENGINE for its best reachable offer, so a headline can never promise
// more than a seller can actually be quoted, and every surface shows the
// same number. Marketing only — nothing here changes what a quote pays.
//
// Best config = the options BOTH funnels (homepage and /go) let a seller pick:
//   phones    every storage × condition, unlocked (+$25 popular bonus)
//   iPads     Wi-Fi + Cellular: ×1.15 and +$25 on the raw cell, THEN the
//             margin cap (goQuote's order in app/go/spec.ts = the homepage's)
//   other     PRICE_TABLE rows (consoles = disc edition, watches/drones = the
//             base config): the engine offer across every storage × condition
//   MacBooks  additively priced models: top chip + top RAM + top storage,
//             sealed, standard glass (macCeiling)
// NOT counted — homepage-only or code-only sweeteners: promo and coupon codes,
// the iPhone mint accessory +$10, nano-texture glass (+$50), Apple Watch
// material/size/cellular adds, console controller/edition extras.
// The engine's caps all apply, so a pinned model reads its pin: iPhone 16 Pro
// Max is $600 (NET_PAYOUTS maxOffer), not its $801 1TB sealed cell. That is
// why the old "headline = top sealed cell in PRICE_TABLE" rule is retired.
//
// MANUAL_REVIEW_DEVICES (Z TriFold, Mac Studio, …): quoteDeviceSync hands
// them to a human before any math, but the homepage funnel still SHOWS its
// computed number (the lead is flagged for approval) — so that number is the
// headline, priced with the engine's own caps (tableOfferIgnoringReviewFlag;
// scripts/regen-up-to.ts proves it equals quoteDeviceSync on every other row).
//
// null = no instant number (inquiry-only, no PRICE_TABLE row, below
// MIN_OFFER): pages say "Get a custom quote" instead of printing a price.
//
// The homepage and /sell read the generated snapshot in
// app/data/catalog-prices.ts, taken over the homepage's own storage tiers
// (`npx tsx scripts/regen-up-to.ts --write` after any PRICE_TABLE / cap /
// MacBook spec / STORAGE_MAP change); /go calls this live with the admin
// overrides and shows the lower of that and the snapshot.
import { PRICE_TABLE, MACBOOK_SPECS, MANUAL_REVIEW_DEVICES, MIN_OFFER } from "../data/prices";
import skuLabelsJson from "../data/sku-labels.json";
import { quoteDeviceSync, EMPTY_OVERRIDES, type PriceOverrides } from "./quote-engine";
import { marginCapFor, applyGalaxyDrop, iwmRuleCeiling } from "./resell-estimates";
import { macCeiling, macIsAutoQuotable, macOptions } from "./macbook-quote";

// Homepage-only iPad math the engine doesn't apply (app/page.tsx
// connectivityMultiplier + popular-device bonus). app/go/board.ts re-exports
// these for app/go/spec.ts.
export const CELLULAR_MULT = 1.15;
export const CELLULAR_BONUS = 25;

const SKU_LABELS = skuLabelsJson as Record<string, string>;
const PHONE_ID = /^(ip(?!ad)|gs|gz|px|gnote)/;
// Consoles use the 4-tier ladder on both funnels — there is no "mint" to pick.
const CONSOLE_ID = /^(ps[45]|xs[xs]|xone|switch|nsw)/;
const CONDITIONS = ["sealed", "mint", "good", "fair", "broken"] as const;
const STORAGE_ORDER = ["64", "128", "256", "512", "1tb", "2tb", "4tb", "8tb", "base", "carbonblack"];

export type EngineCeiling = { upTo: number; storage: string; condition: string };
type Opts = {
  overrides?: PriceOverrides;
  label?: string;
  // Only these storage tiers — the ones a funnel lets the seller pick (the
  // homepage's STORAGE_MAP). Ignored when none of them is a row key (rows
  // keyed by edition, "base"). Absent = every row key (/go's options).
  storages?: readonly string[];
};

/** The storage keys of a PRICE_TABLE row, smallest first. */
export function tableStorages(modelId: string): string[] {
  const rank = (s: string) => (STORAGE_ORDER.includes(s) ? STORAGE_ORDER.indexOf(s) : STORAGE_ORDER.length);
  return Object.keys(PRICE_TABLE[modelId] || {}).sort((a, b) => rank(a) - rank(b));
}

/**
 * The engine's unlocked offer for one PRICE_TABLE cell with the manual-review
 * routing skipped — quoteDeviceSync's price-table math, step for step, for the
 * rows it refuses to auto-quote. A cell that doesn't exist prices nothing (the
 * homepage prices a missing sealed cell off base × multipliers, not mint + $45).
 */
export function tableOfferIgnoringReviewFlag(modelId: string, storage: string, condition: string, isPhone: boolean, opts: Opts = {}): number | null {
  const ov = opts.overrides ?? EMPTY_OVERRIDES;
  const cell = ov.priceTable?.[modelId]?.[storage]?.[condition] ?? PRICE_TABLE[modelId]?.[storage]?.[condition];
  if (cell == null) return null;
  const base = Math.max(0, Math.round(cell));
  const raw = base + (isPhone && base > 0 ? 25 : 0);
  const cap = marginCapFor({
    modelId,
    label: opts.label ?? SKU_LABELS[modelId],
    condition,
    carrier: "unlocked",
    storage,
    carrierDeduction: 0,
  });
  const capped = cap != null && raw > cap ? cap : raw;
  const dropped = applyGalaxyDrop(capped, modelId);
  const rule = iwmRuleCeiling({ modelId, storage, condition });
  const final = rule != null ? Math.min(dropped, rule) : dropped;
  return final < MIN_OFFER || (cap != null && cap < MIN_OFFER) ? null : final;
}

// One cell at the best secondary option (unlocked / cellular / disc).
function cellOffer(modelId: string, storage: string, condition: string, opts: Opts): number | null {
  const isPhone = PHONE_ID.test(modelId);
  if (MANUAL_REVIEW_DEVICES.has(modelId)) return tableOfferIgnoringReviewFlag(modelId, storage, condition, isPhone, opts);
  const r = quoteDeviceSync({
    modelId,
    modelLabel: opts.label ?? SKU_LABELS[modelId],
    storage,
    condition,
    carrier: isPhone ? "unlocked" : undefined,
    isPhone,
  }, opts.overrides ?? EMPTY_OVERRIDES);
  if (!modelId.startsWith("ipad")) return r.manualReview ? null : r.offer;
  // Cellular iPad, in goQuote's order: multiplier and bonus on the RAW cell,
  // then the margin cap, then the minimum check.
  const b = r.breakdown;
  if (!b) return null;
  const pre = Math.round(b.rawQuote * CELLULAR_MULT) + CELLULAR_BONUS;
  const capped = b.marginCap != null ? Math.min(pre, b.marginCap) : pre;
  const final = capped + (b.sealedPremium || 0);
  return final < MIN_OFFER || (b.marginCap != null && b.marginCap < MIN_OFFER) ? null : final;
}

/**
 * The best offer the engine can reach for a model, and where (the smallest
 * storage that reaches it). null when no config gets an instant number.
 */
export function engineCeiling(modelId: string, opts: Opts = {}): EngineCeiling | null {
  if (macIsAutoQuotable(modelId)) {
    const upTo = macCeiling(modelId, opts.overrides ?? EMPTY_OVERRIDES);
    const o = macOptions(modelId);
    if (upTo <= 0 || !o?.storage.length) return null;
    const top = o.storage.reduce((a, b) => ((b.adj ?? 0) > (a.adj ?? 0) ? b : a), o.storage[0]);
    return { upTo, storage: top.id, condition: "sealed" };
  }
  const conditions = CONSOLE_ID.test(modelId) ? CONDITIONS.filter((c) => c !== "mint") : CONDITIONS;
  const rowKeys = tableStorages(modelId);
  const picked = opts.storages ? rowKeys.filter((s) => opts.storages!.includes(s)) : [];
  let best: EngineCeiling | null = null;
  for (const storage of picked.length ? picked : rowKeys) {
    for (const condition of conditions) {
      const offer = cellOffer(modelId, storage, condition, opts);
      if (offer != null && offer > (best?.upTo ?? 0)) best = { upTo: offer, storage, condition };
    }
  }
  return best;
}

/** The advertised "up to $X" for a model, or null → "Get a custom quote". */
export function advertisedUpTo(modelId: string, opts: Opts = {}): number | null {
  return engineCeiling(modelId, opts)?.upTo ?? null;
}

/** Every model the engine can price: PRICE_TABLE rows + additive MacBooks. */
export function engineModelIds(): string[] {
  const ids = new Set(Object.keys(PRICE_TABLE));
  for (const id of Object.keys(MACBOOK_SPECS)) if (macIsAutoQuotable(id)) ids.add(id);
  return [...ids].sort();
}
