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
  // Pixel
  "Pixel 10 Pro XL": 657, "Pixel 10 Pro": 567, "Pixel 9 Pro XL": 392, "Pixel 9 Pro": 375,
  // Consoles
  "PlayStation 5 Pro": 680, "PlayStation 5 Slim": 310, "PlayStation 5": 347,
  "Xbox Series X": 220, "Xbox Series S": 130,
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
    if (m.includes(key) && (!best || key.length > best.key.length)) {
      best = { key, val };
    }
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
  if (c.includes("fair") || c.includes("heavy")) return 0.65;
  if (c.includes("good") && !c.includes("very")) return 0.80;
  if (c.includes("very good") || c.includes("excellent") || c.includes("light")) return 0.92;
  // mint, sealed, flawless, like-new, pristine — full resell
  return 1.0;
}

/** Target margin floor — we don't pay more than resell × MARGIN_FLOOR */
export const MARGIN_FLOOR_MULT = 0.75; // 25% margin target
