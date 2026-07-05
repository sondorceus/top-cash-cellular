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
  "iPhone 17 Pro Max": 1081, "iPhone 17 Pro": 949, "iPhone 17": 695,
  "iPhone 16 Pro Max": 721, "iPhone 16 Pro": 638, "iPhone 16 Plus": 428, "iPhone 16": 520,
  "iPhone 15 Pro Max": 525, "iPhone 15 Pro": 528, "iPhone 15": 349,
  "iPhone 14 Pro Max": 417, "iPhone 14 Pro": 358, "iPhone 14": 268,
  "iPhone 13 Pro Max": 338, "iPhone 13 Pro": 268, "iPhone 13": 211,
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
  // Consoles — Xbox values refreshed 2026-05-19 to match current eBay
  // sold (Series X has held steady at ~$300+; Series S at ~$180+).
  // Skywalker caught the old 220/130 numbers flagging both consoles
  // as loss-risk on /admin/prices when they're actually fine margins.
  "PlayStation 5 Pro": 680, "PlayStation 5 Slim": 310, "PlayStation 5": 347,
  "Xbox Series X": 320, "Xbox Series S": 180,
  "Nintendo Switch 2": 370, "Nintendo Switch OLED": 180,
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
    if (brokenGlass === "both") return 0.22;
    if (brokenGlass === "back") return 0.40;
    return 0.30; // front-only or unspecified
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
