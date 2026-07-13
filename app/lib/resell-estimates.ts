// Shared resell-value estimates and margin helpers used by both the
// client quote calculation (app/page.tsx) and the server lead-margin
// analysis (app/api/lead/route.ts).
//
// Sources: Swappa mid (avg sale) + PriceCharting for consoles, scraped
// 2026-05-12 onward. Values represent WORKING resell value at the most
// common storage tier. Condition multipliers scale them down for
// damaged devices; brokenGlass adds extra deductions on broken phones.

export const RESELL_ESTIMATES: Record<string, number> = {
  // iPhones — Swappa mid price (actual listings)
  // iPhone 17 Pro Max intentionally OMITTED (2026-07-05): it's a manually-
  // priced SKU whose sealed offers run a deliberate ~$250 flat profit (sub-25%
  // margin) to stay competitive — a resell entry here would let the margin cap
  // claw those sealed offers back to resell × 0.75. See [[resell-cap-footgun]].
  "iPhone 17 Pro": 949, "iPhone 17": 695,
  // 16-family refreshed 2026-07-12 from fresh eBay used medians (16PM 256
  // n=28, 16 Plus 128 n=40, 16 Pro 256 n=6) — raises the broken/mint caps
  // so the owner's IWM-parity broken cells can breathe.
  "iPhone 16 Pro Max": 743, "iPhone 16 Pro": 640, "iPhone 16 Plus": 515, "iPhone 16": 520,
  "iPhone 15 Pro Max": 525, "iPhone 15 Pro": 528, "iPhone 15": 349,
  "iPhone 14 Pro Max": 417, "iPhone 14 Pro": 358, "iPhone 14": 268,
  // 13-family recalibrated 2026-07-11 (Skywalker-approved): the May comps were
  // stale-low and the margin cap was squashing good-condition offers to
  // $110/$140/$176 while Sonny actually pays ~$170 for a good 13 (his live
  // correction in the Damian thread: "170 unlocked, 120 locked"). Backed out
  // of his real payouts at the 25%-margin + eBay-net formula.
  "iPhone 13 Pro Max": 460, "iPhone 13 Pro": 400, "iPhone 13": 330,
  // Samsung
  "Galaxy S26 Ultra": 927, "Galaxy S25 Ultra": 714, "Galaxy S24 Ultra": 544,
  "Galaxy S26": 741, "Galaxy S25": 372,
  // Pixel — Atlas grade_a unlocked (working condition wholesale exit) where it
  // beats TCC max payout × 1.33 ($-margin headroom). Pixel 10a is the lead
  // catalyst (Rose's live lead at 21:01 on 2026-05-18 was tripping the old
  // unknown-resell trigger). Older Pixels (5-9a) are skipped because TCC's
  // PRICE_TABLE pays above Atlas's wholesale floor — adding them would
  // silently cap legit quotes downward; flagged for pricing review instead.
  "Pixel 10 Pro XL": 657, "Pixel 10 Pro": 567, "Pixel 10": 315, "Pixel 10a": 265,
  "Pixel 9 Pro Fold": 585, "Pixel 9 Pro XL": 392, "Pixel 9 Pro": 375, "Pixel 9": 210,
  "Pixel 8 Pro": 225,
  "Pixel 6a": 45,
  // Apple Watches — Atlas grade_a_hso. Skipped: Series 10/11, Ultra 2/3.
  // These intentionally pay above Atlas wholesale to stay competitive with
  // IWM, so listing a resell here would make the margin guard (resell ×
  // 0.75) SILENTLY cap the quote below its own PRICE_TABLE value — e.g. a
  // mint Ultra 3 ($302) capped to $270. (Ultra 2/3 carried 245/360 from a
  // 2026-05-19 edit; removed 2026-07-05 after it re-broke the quote — a
  // resell entry can't distinguish "show admin margin" from "cap the
  // funnel", and the funnel underpay is the worse failure.) Series 7/8/9
  // and SE stay listed: their PRICE_TABLE sits well under resell × 0.75,
  // so the cap never bites and admin still gets a margin chip.
  "Apple Watch SE (2nd Gen)": 70,
  "Apple Watch Series 7": 80, "Apple Watch Series 8": 100, "Apple Watch Series 9": 115,
  "Apple Watch Ultra": 200,
  // iPads — Skipped most (TCC pays above Atlas wholesale). Only the M3 13"
  // Air has enough margin headroom for a safe cap.
  "iPad Air 13\" (M3)": 515,
  // Consoles — refreshed 2026-07-12 from fresh eBay sold medians (console
  // market ROSE since May: Series X used now ~$450 n=61, PS5 Pro used 2TB
  // ~$775 n=38). ps5slim/nswoled kept at May-19 medians (July scrape
  // returned empty pages for those two queries); PS5 kept (n=2 too weak).
  "PlayStation 5 Pro": 775, "PlayStation 5 Slim": 399, "PlayStation 5": 347,
  "Xbox Series X": 450, "Xbox Series S": 240,
  "Nintendo Switch 2": 413, "Nintendo Switch OLED": 195,
  // MacBook
  "MacBook Pro 16\" M4": 1500, "MacBook Pro 14\" M4": 1000, "MacBook Pro 16\" M3": 1100,
  "MacBook Pro 14\" M3": 700, "MacBook Air M4": 600, "MacBook Air M3": 450,
};

/**
 * Look up a working-condition resell estimate by model label. Returns
 * null when the model isn't in our table — callers should treat null as
 * "unknown" and either force manual review or fall back to a heuristic.
 *
 * Matching strategy: exact match wins, then longest substring match
 * (so "iPhone 16" doesn't accidentally match "iPhone 16 Pro Max", and
 * "iPhone 16 Pro Max 256GB" still matches "iPhone 16 Pro Max").
 */
export function getResellEstimate(modelName: string | undefined | null): number | null {
  if (!modelName) return null;
  const m = modelName.trim();
  if (!m) return null;
  let best: { key: string; val: number } | null = null;
  for (const [key, val] of Object.entries(RESELL_ESTIMATES)) {
    if (m === key) return val;
    if (!m.includes(key)) continue;
    // Trailing-token guard. A substring key must not match a query that
    // carries a model-distinguishing token BEYOND the key — otherwise
    // "iPhone 17 Air" matches "iPhone 17" (and gets clipped to the wrong,
    // lower resell), "iPhone 16E"/"17E" match "iPhone 16"/"17", etc. Only a
    // bare storage suffix ("256GB") is safe to ignore. Suffix-style keys
    // (" M4", " (M3)") still match because the key reaches the query's end.
    const rest = m.slice(m.indexOf(key) + key.length).trim();
    if (rest !== "" && !/^\d+\s?(gb|tb)$/i.test(rest)) continue;
    if (!best || key.length > best.key.length) best = { key, val };
  }
  return best ? best.val : null;
}

/**
 * Condition multiplier on resell value. For broken phones the
 * brokenGlass field further depresses the multiplier:
 *   - front-only:  display replacement needed, glass kit fits, common repair
 *   - back-only:   mostly cosmetic, easy glass swap, retains more value
 *   - both:        two repairs, much lower parts-resale value
 */
export function resellMultiplierForCondition(condition: string | undefined, brokenGlass?: "front" | "back" | "both" | null): number {
  const c = (condition || "").toLowerCase();
  if (c.includes("broken") || c.includes("crack") || c.includes("dead") || c.includes("won't")) {
    // Raised 0.30/0.40/0.22 → 0.55/0.60/0.40 (Skywalker-approved 2026-07-12).
    // The old 0.30 modeled a parts-only exit, but our broken tier is
    // cracked-BUT-FUNCTIONAL (non-functional units go to manual quote), and a
    // working cracked flagship resells far above 30% of working value — IWM
    // pays $300+ for a broken 17 Pro the old cap squashed to $186, silently
    // overriding the owner's own PRICE_TABLE broken cells on every 14–17 Pro.
    // Broken cells are now IWM×0.90-derived (2026-07-12 recab), so the cap is
    // a drift guardrail again, not the price-setter.
    if (brokenGlass === "both") return 0.40;
    if (brokenGlass === "back") return 0.60;
    return 0.55; // front-only or unspecified
  }
  // "heav" catches both "heavy" and DJI's "Heavily Used" (heavily ≠ heavy
  // as a substring — easy to miss; checked it).
  if (c.includes("fair") || c.includes("heav")) return 0.65;
  // Skywalker 2026-05-19 collapsed Mint+VG into a single "Excellent" tier
  // (= old Mint multiplier 1.0). Legacy MC leads with "Very Good" in the
  // body drop to Good (0.80) per the new pricing intent. Order matters —
  // verygood must be checked before plain "good" since "good" is a
  // substring of "verygood".
  if (c.includes("very good")) return 0.80;
  if (c.includes("good") || c.includes("well-maintained") || c.includes("wellmaintained")) return 0.80;
  // "Excellent" / "Lightly Flown" — new top working-condition tier.
  if (c.includes("excellent") || c.includes("lightly")) return 1.0;
  // mint, sealed, flawless, like-new, pristine — full resell
  return 1.0;
}

/** Target margin floor — we don't pay more than resell × MARGIN_FLOOR */
export const MARGIN_FLOOR_MULT = 0.75; // 25% margin target

/**
 * eBay final-value-fee haircut. TCC resells on eBay, so the resell comps
 * (Swappa/retail-ish gross) overstate what we actually NET — eBay takes 13%.
 * We apply this to the resell value BEFORE the margin floor so the cap is
 * "25% margin on the eBay-NET price" and we can never quote over what eBay
 * would net us. Skywalker 2026-07-05 — interim flat 13% buffer until the
 * eBay-sold scraper is fixed and we can cap against live eBay-net directly.
 * (Simplified to the 13% FVF only — no per-order fixed fee / shipping.)
 */
export const EBAY_FEE_MULT = 0.87; // 1 − 0.13 eBay FVF

/**
 * Galaxy S23-and-up blanket price cut. Skywalker 2026-07-05: "Atlas doesn't
 * really buy Galaxy" — so trim the whole S23+ lineup by a flat $75 off the
 * LIVE offer (applied after the margin cap, since these SKUs are cap-bound
 * and a price-table cut alone wouldn't move the offer). Covers Galaxy
 * S23–S26 (all variants: base / +/ Ultra / FE / Edge) and Z Flip/Fold 5–7.
 * Returns the dollars to subtract, floored to MIN_OFFER by the caller.
 */
export const galaxyPriceDrop = (modelId?: string | null): number =>
  (!!modelId && (/^gs2[3-6]/.test(modelId) || /^gz(flip|fold)[5-7]$/.test(modelId))) ? 75 : 0;

/**
 * "Pricey only" floor for the Galaxy −$75: only apply the drop when the
 * offer is at least this much, so cheap S23 / FE / Flip5 (a ~$100-160 offer)
 * don't crater to the $25 minimum. Skywalker 2026-07-05.
 */
export const GALAXY_DROP_MIN_OFFER = 250;
