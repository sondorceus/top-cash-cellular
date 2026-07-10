// Shop pricing — what we list a unit for, and what we actually pocket.
//
// This is the sell-side twin of app/lib/quote.ts. quote.ts answers "what do
// we pay a customer for this device"; this answers "what do we sell it for,
// and does that clear our margin given what we paid".
//
// It reuses comp-economics.ts for the fee/shipping math instead of restating
// it, so the direct-vs-eBay comparison is apples to apples. The ONLY new fee
// here is the payment processor: eBay's 13% FVF is replaced by Stripe's
// ~2.9% + 30¢. That difference is the entire financial case for the store.
//
// Override without a code change (mirrors comp-economics.ts):
//   TCC_STRIPE_PCT    — processor % (default 0.029)
//   TCC_STRIPE_FIXED  — processor fixed fee (default $0.30)
//   TCC_SHOP_MARGIN   — target gross margin on a direct sale (default 0.25)
//
// UNITS: everything in this module is DOLLARS, because comp-economics.ts is
// dollars and mixing the two silently is how you ship a 100× pricing bug. The
// database stores integer CENTS. Convert at the boundary with toCents/fromCents
// below — never by hand.

import { shippingFor, ebayGrossToNet, EBAY_FVF_RATE } from "./comp-economics";
import { getResellEstimate, resellMultiplierForCondition, MARGIN_FLOOR_MULT } from "./resell-estimates";
import type { ListingGrade } from "./shop-grades";

const STRIPE_PCT = parseFloat(process.env.TCC_STRIPE_PCT || "0.029");
const STRIPE_FIXED = parseFloat(process.env.TCC_STRIPE_FIXED || "0.30");
const TARGET_MARGIN = parseFloat(process.env.TCC_SHOP_MARGIN || "0.25");

/**
 * What fraction of a direct sale survives the processor — the sell-side
 * analogue of EBAY_FEE_MULT (0.87) in resell-estimates.ts.
 *
 * NOT WIRED INTO quote.ts, deliberately. Swapping the buyback cap from
 * EBAY_FEE_MULT to this would raise every cap-bound offer by ~11%, which is
 * the strongest strategic reason to own the storefront — but it is a live
 * change to what customers get paid, and those never move without Skywalker's
 * explicit go-ahead. Exposed here so the change is a one-line diff when he
 * calls it, and so nobody has to re-derive the number.
 */
export const DIRECT_FEE_MULT = 1 - STRIPE_PCT; // ≈ 0.971 vs eBay's 0.87

export const toCents = (dollars: number): number => Math.round(dollars * 100);
export const fromCents = (cents: number): number => cents / 100;

/**
 * Gross direct sale price → cash in TCC's pocket.
 * net = gross × (1 − stripe%) − stripeFixed − outbound shipping
 *
 * Shipping is charged to us, not the buyer: ItsWorthMore ships free and so
 * must we. Baking it into net (rather than pretending the buyer pays it) is
 * the only way the margin number means anything.
 */
export function directGrossToNet(gross: number, sku: string): number {
  const net = gross * (1 - STRIPE_PCT) - STRIPE_FIXED - shippingFor(sku);
  return Math.max(0, net);
}

/**
 * The lowest price we can list at and still clear `targetMargin` on a unit
 * that cost us `cost`. Solves for list:
 *
 *   list×(1−p) − f − ship − cost  ≥  margin × list
 *   list×(1 − p − margin)         ≥  cost + f + ship
 *   list                          ≥  (cost + f + ship) / (1 − p − margin)
 *
 * Returns null when the target margin is unreachable at any price — i.e.
 * margin ≥ 1 − p, where the fee eats the margin before shipping even lands.
 * A null here is a config error, not a pricing outcome.
 */
export function minListForMargin(cost: number, sku: string, targetMargin: number = TARGET_MARGIN): number | null {
  const denom = 1 - STRIPE_PCT - targetMargin;
  if (denom <= 0) return null;
  return (cost + STRIPE_FIXED + shippingFor(sku)) / denom;
}

/** Side-by-side net on the same gross price. Direct always wins on fees; the
 *  real cost of direct is traffic and returns, which this cannot see. */
export function channelDelta(gross: number, sku: string): { directNet: number; ebayNet: number; delta: number } {
  const directNet = directGrossToNet(gross, sku);
  const ebayNet = ebayGrossToNet(gross, sku);
  return { directNet, ebayNet, delta: directNet - ebayNet };
}

export type ListingSuggestion = {
  /** Estimated market price for this model at this grade. Null = unknown. */
  marketPrice: number | null;
  /** Lowest price clearing the target margin against what we paid. */
  minListPrice: number | null;
  /** What to actually list at, rounded to a .99 price point. Null = manual. */
  suggestedPrice: number | null;
  netAtSuggested: number | null;
  profitAtSuggested: number | null;
  /** Realised gross margin at suggestedPrice, e.g. 0.31 = 31%. */
  marginAtSuggested: number | null;
  /** True when market price will not clear the target margin — we overpaid. */
  belowTargetMargin: boolean;
  /** True when we have no resell comp and a human must set the price. */
  needsManualPrice: boolean;
  reason: string;
};

/**
 * Suggest a listing price for one physical unit.
 *
 * The market price is anchored to RESELL_ESTIMATES, which is what a working
 * unit fetches at the most common storage tier, scaled by the grade
 * multiplier. We list AT market, never above it — a used phone priced over
 * comps does not sell, it just ages and depreciates.
 *
 * So the margin target is a *diagnostic*, not an input to the price. When
 * market < minListForMargin, that is not a signal to raise the price; it is a
 * signal that we paid too much for this unit and should either accept the thin
 * margin or exit it through Atlas. belowTargetMargin surfaces exactly that.
 *
 * getResellEstimate() returns null for models deliberately omitted from
 * RESELL_ESTIMATES (iPhone 17 Pro Max and friends, kept out so the buyback cap
 * cannot claw back their sealed offers). Those units have no comp anchor here
 * either, so they route to manual pricing rather than to a guess.
 */
export function suggestListing(opts: {
  modelLabel: string;
  sku: string;
  grade: ListingGrade;
  costPaid: number;
  targetMargin?: number;
}): ListingSuggestion {
  const { modelLabel, sku, grade, costPaid } = opts;
  const targetMargin = opts.targetMargin ?? TARGET_MARGIN;

  const minListPrice = minListForMargin(costPaid, sku, targetMargin);

  // Reuse the buyback condition multiplier rather than duplicating the table.
  // The grade strings are chosen to substring-match it exactly: "excellent"
  // → 1.0, "good" → 0.80, "fair" → 0.65. One table, one place to change it.
  const resell = getResellEstimate(modelLabel);
  if (resell == null) {
    return {
      marketPrice: null,
      minListPrice,
      suggestedPrice: null,
      netAtSuggested: null,
      profitAtSuggested: null,
      marginAtSuggested: null,
      belowTargetMargin: false,
      needsManualPrice: true,
      reason: `No resell comp for "${modelLabel}" — price this unit by hand.`,
    };
  }

  const marketPrice = resell * resellMultiplierForCondition(grade);
  const suggestedPrice = charmPrice(marketPrice);
  const netAtSuggested = directGrossToNet(suggestedPrice, sku);
  const profitAtSuggested = netAtSuggested - costPaid;
  const marginAtSuggested = suggestedPrice > 0 ? profitAtSuggested / suggestedPrice : 0;
  const belowTargetMargin = minListPrice != null && suggestedPrice < minListPrice;

  return {
    marketPrice,
    minListPrice,
    suggestedPrice,
    netAtSuggested,
    profitAtSuggested,
    marginAtSuggested,
    belowTargetMargin,
    needsManualPrice: false,
    reason: belowTargetMargin
      ? `Market ($${suggestedPrice.toFixed(0)}) is under the $${minListPrice!.toFixed(0)} needed for ${Math.round(targetMargin * 100)}% margin — we paid $${costPaid.toFixed(0)}. Listing here yields ${Math.round(marginAtSuggested * 100)}%.`
      : `Clears target at ${Math.round(marginAtSuggested * 100)}% margin ($${profitAtSuggested.toFixed(0)} net on a $${costPaid.toFixed(0)} unit).`,
  };
}

/** Round to the nearest .99 below market — $268.40 → $267.99. Never rounds up
 *  past market, so the charm price can't push us off comp. Floors at $9.99. */
function charmPrice(p: number): number {
  const floored = Math.max(10, Math.floor(p));
  return floored - 0.01;
}

// Re-exported so admin surfaces can show "eBay would net X, we net Y" without
// importing from two modules and getting the fee rates out of sync.
export { EBAY_FVF_RATE, MARGIN_FLOOR_MULT };
export const STRIPE_PCT_RATE = STRIPE_PCT;
export const STRIPE_FIXED_FEE = STRIPE_FIXED;
export const SHOP_TARGET_MARGIN = TARGET_MARGIN;
