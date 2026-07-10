// Shop grade contract — the single place that decides which condition a
// device we BOUGHT gets listed under when we SELL it.
//
// The buyback side speaks four condition keys (PRICE_TABLE in
// app/data/prices.ts): mint | good | fair | broken. The storefront sells
// three of them. "broken" never lists — those units are parts/scrap and
// exit through Atlas or a parts buyer, never through /shop. A buyer who
// receives a cracked phone from a "refurbished" store charges back, and
// one chargeback costs more than the unit.
//
// Why not copy ItsWorthMore's seven tiers (New, Open Box, Like New,
// Excellent, Very Good, Good, Fair)? Because a grade is a promise, and we
// can only promise what intake actually inspects. TCC intake sorts into
// four buckets, so the store sells four minus one. Inventing a "Like New"
// tier nobody grades consistently is how a refurb store earns its return
// rate — and returns are the line item that decides whether selling direct
// beats eBay at all.
//
// Skywalker 2026-05-19 collapsed Mint + Very Good into a single top tier
// displayed as "Excellent", so the internal `mint` key and the customer-
// facing "Excellent" label denote the same thing. Legacy MC leads still
// carry "Very Good" in the body; those drop to Good, exactly as
// resellMultiplierForCondition() already does in app/lib/resell-estimates.ts.

export type ListingGrade = "excellent" | "good" | "fair";

// Ordered best → worst. Grade is assigned once, at post time, and thereafter
// DISPLAYED on the listing — a buyer never picks it. Skywalker 2026-07-10:
// "I only sell what I have." Used for the admin grade selector and for browse
// filters, never as a variant axis on the product page.
export const LISTING_GRADES: readonly ListingGrade[] = ["excellent", "good", "fair"] as const;

export const GRADE_LABEL: Record<ListingGrade, string> = {
  excellent: "Excellent",
  good: "Good",
  fair: "Fair",
};

// Buyer-facing promise per grade. Deliberately describes *cosmetics only* —
// every grade is fully functional, because a non-functional unit is never
// listed. Keep this wording in sync with /grading-guide: the seller who read
// it on the way in is the same person reading it on the way out.
export const GRADE_BLURB: Record<ListingGrade, string> = {
  excellent: "Looks nearly new. No cracks, no dents, and at most a faint scuff you have to hunt for.",
  good: "Light signs of normal use — minor scratches or small scuffs visible up close. Screen is flawless.",
  fair: "Clearly used. Visible scratches, scuffs, or dings on the frame or back. Screen has no cracks and works perfectly.",
};

/**
 * Map an intake condition string onto the grade we list it under, or null
 * when the unit is not sellable through the storefront.
 *
 * The substring checks below mirror resellMultiplierForCondition() in
 * app/lib/resell-estimates.ts, and the ORDER IS LOAD-BEARING for the same
 * reason it is there: "good" is a substring of "very good", so "very good"
 * must be tested first or every legacy Very Good unit silently lists as
 * Good's better-priced sibling. Broken is tested before everything, since a
 * body like "broken, screen still good" must never reach the Good branch.
 *
 * Returns null for broken/cracked/dead units and for anything we cannot
 * confidently place. Null means "do not list" — never "assume Fair".
 */
export function listingGradeFor(
  condition: string | undefined | null,
  brokenGlass?: "front" | "back" | "both" | null,
): ListingGrade | null {
  const c = (condition || "").toLowerCase().trim();
  if (!c) return null;

  // Broken wins over every other token. brokenGlass being set at all is an
  // independent signal that glass is damaged, even if the condition text
  // forgot to say so.
  if (brokenGlass) return null;
  if (c.includes("broken") || c.includes("crack") || c.includes("dead") || c.includes("won't")) {
    return null;
  }

  // "heav" catches both "heavy" and DJI's "Heavily Used" — the same guard
  // resell-estimates.ts documents.
  if (c.includes("fair") || c.includes("heav")) return "fair";

  // Must precede the bare "good" test. Legacy Very Good lists as Good.
  if (c.includes("very good")) return "good";
  if (c.includes("good") || c.includes("well-maintained") || c.includes("wellmaintained")) return "good";

  // "Excellent" / DJI "Lightly Flown" — the top working tier.
  if (c.includes("excellent") || c.includes("lightly")) return "excellent";

  // mint, sealed, flawless, like-new, pristine — all resolve to Excellent.
  if (
    c.includes("mint") ||
    c.includes("sealed") ||
    c.includes("flawless") ||
    c.includes("like new") ||
    c.includes("like-new") ||
    c.includes("pristine")
  ) {
    return "excellent";
  }

  // Unrecognized. Refuse to guess — an unlisted unit costs nothing, a
  // mis-graded one costs a return plus a review.
  return null;
}

/** True when a unit in this intake condition can be listed on /shop at all. */
export function isSellable(
  condition: string | undefined | null,
  brokenGlass?: "front" | "back" | "both" | null,
): boolean {
  return listingGradeFor(condition, brokenGlass) !== null;
}
