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
  "iPhone 15 Pro Max": 525, "iPhone 15 Pro": 550, "iPhone 15": 349, // 15 Pro: eBay used 256 med n=12, 2026-07-12
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
  // iPads — Skipped ALL (TCC pays above Atlas wholesale). An "iPad Air 13\"
  // (M3)": 515 entry lived here 2026-05→07 but was DEAD CODE the whole
  // time: the parenthesized key never matched the funnel label (iPad Air
  // 13" M3), so the cap it promised never applied. Removed 2026-07-25
  // rather than re-keyed — a flat number can't govern a storage/
  // connectivity-configurable device (the 515 base-config comp would have
  // clamped a legit sealed-1TB-cellular quote), same reason the watch
  // entries above came out. If iPad caps come back they need per-config
  // comps and Skywalker's numbers.
  // Consoles — refreshed 2026-07-12 from fresh eBay sold medians (console
  // market ROSE since May: Series X used now ~$450 n=61, PS5 Pro used 2TB
  // ~$775 n=38). ps5slim/nswoled kept at May-19 medians (July scrape
  // returned empty pages for those two queries); PS5 kept (n=2 too weak).
  "PlayStation 5 Pro": 775, "PlayStation 5 Slim": 399, "PlayStation 5": 347,
  "Xbox Series X": 450, "Xbox Series S": 240,
  "Nintendo Switch 2": 413, "Nintendo Switch OLED": 195,
  // MacBooks — none. Six entries (MBP 16/14 M4/M3 1500-700, Air M4/M3
  // 600/450) lived here 2026-05→07 but were DEAD CODE: funnel labels carry
  // " (2024)"-style suffixes the trailing-token guard rejects, so no label
  // ever matched and the caps everyone believed in never fired. Removed
  // 2026-07-25 rather than re-keyed: MacBooks are spec-configurable (an M4
  // Max 16" quotes ~$2.5k+) so a flat per-family cap would silently clamp
  // every high-spec config — the exact watch footgun documented above.
  // The additive path + inspection is the MacBook guard; admin margin
  // chips for MacBooks need per-config comps, not a resurrected flat key.
};

// Exact PRICE_TABLE-id → RESELL_ESTIMATES key. The label matcher below is
// fuzzy by necessity (free-text lead bodies) and has bitten twice (the
// trailing-token guard exists because "iPhone 17 Air" matched "iPhone 17");
// funnel/bot callers know their model id, so they resolve HERE first and
// only fall back to label matching for free-text (2026-07-14).
export const RESELL_MODEL_IDS: Record<string, string> = {
  ip17p: "iPhone 17 Pro", ip17: "iPhone 17",
  ip16pm: "iPhone 16 Pro Max", ip16p: "iPhone 16 Pro", ip16plus: "iPhone 16 Plus", ip16: "iPhone 16",
  ip15pm: "iPhone 15 Pro Max", ip15p: "iPhone 15 Pro", ip15: "iPhone 15",
  ip14pm: "iPhone 14 Pro Max", ip14p: "iPhone 14 Pro", ip14: "iPhone 14",
  ip13pm: "iPhone 13 Pro Max", ip13p: "iPhone 13 Pro", ip13: "iPhone 13",
  gs26u: "Galaxy S26 Ultra", gs25u: "Galaxy S25 Ultra", gs24u: "Galaxy S24 Ultra",
  gs26: "Galaxy S26", gs25: "Galaxy S25",
  px10pxl: "Pixel 10 Pro XL", px10p: "Pixel 10 Pro", px10: "Pixel 10", px10a: "Pixel 10a",
  px9pfold: "Pixel 9 Pro Fold", px9pxl: "Pixel 9 Pro XL", px9p: "Pixel 9 Pro", px9: "Pixel 9",
  px8p: "Pixel 8 Pro", px6a: "Pixel 6a",
  awse2: "Apple Watch SE (2nd Gen)",
  aws7: "Apple Watch Series 7", aws8: "Apple Watch Series 8", aws9: "Apple Watch Series 9",
  awu1: "Apple Watch Ultra",
};

/**
 * Preferred lookup: exact model id first (no fuzzy matching), then the
 * label matcher for anything unmapped. A model id that is deliberately
 * absent from RESELL_ESTIMATES (17 Pro Max, Ultra 2/3 — see comments
 * above) still returns null here because its label won't match either.
 */
export function getResellEstimateForModel(modelId: string | undefined | null, label: string | undefined | null): number | null {
  const key = resellLabelFor(modelId, label);
  return key ? RESELL_ESTIMATES[key] ?? null : null;
}

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
  const key = resellLabelFor(null, modelName);
  return key ? RESELL_ESTIMATES[key] ?? null : null;
}

/**
 * Which RESELL_ESTIMATES key a query resolves to. The matching rules live
 * HERE, in one place, so callers that need the KEY (not just the value —
 * e.g. the consumer-comp check) can never drift from the lookup itself.
 */
export function resellLabelFor(modelId: string | undefined | null, modelName: string | undefined | null): string | null {
  if (modelId) {
    // Exact-id mapping wins and does NOT fall back to fuzzy label matching.
    const mapped = RESELL_MODEL_IDS[modelId];
    if (mapped) return RESELL_ESTIMATES[mapped] != null ? mapped : null;
  }
  if (!modelName) return null;
  const m = modelName.trim();
  if (!m) return null;
  let best: { key: string } | null = null;
  for (const key of Object.keys(RESELL_ESTIMATES)) {
    if (m === key) return key;
    if (!m.includes(key)) continue;
    // Trailing-token guard. A substring key must not match a query that
    // carries a model-distinguishing token BEYOND the key — otherwise
    // "iPhone 17 Air" matches "iPhone 17" (and gets clipped to the wrong,
    // lower resell), "iPhone 16E"/"17E" match "iPhone 16"/"17", etc. Only a
    // bare storage suffix ("256GB") is safe to ignore. Suffix-style keys
    // (" M4", " (M3)") still match because the key reaches the query's end.
    const rest = m.slice(m.indexOf(key) + key.length).trim();
    if (rest !== "" && !/^\d+\s?(gb|tb)$/i.test(rest)) continue;
    if (!best || key.length > best.key.length) best = { key };
  }
  return best ? best.key : null;
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
 * NET WHOLESALE PAYOUTS — what the owner actually RECEIVES per device, split
 * by carrier state because a locked unit sells for materially less.
 *
 * These are NET (money in hand from the wholesale buyer), NOT a Swappa/eBay
 * gross comp — so the cap uses them WITHOUT the EBAY_FEE_MULT haircut.
 * Charging a 13% eBay fee against a channel that never pays one would
 * underquote sellers by that much.
 *
 * A model listed here OVERRIDES its RESELL_ESTIMATES comp above: the owner's
 * real payout beats a scraped median every time. Every entry must be sourced
 * to the owner + date — never estimate one.
 */
export const NET_PAYOUTS: Record<string, { unlocked: number; locked: number }> = {
  // Owner 2026-08-20: "we pay 443 but i get paid 470 … update what i get
  // paid to 470 and 600". The stale $743 Swappa comp implied a $485 ceiling,
  // which left ~6% margin on a locked mint unit and went negative on the
  // good/fair locked cells.
  ip16pm: { unlocked: 600, locked: 470 },
};

/**
 * CONSUMER-COMP HAIRCUT.
 *
 * Some RESELL_ESTIMATES entries are Swappa/eBay medians — what a phone sells
 * for CONSUMER-to-consumer — not what our wholesale exit actually pays. The
 * 16 Pro Max measured that gap exactly: its eBay median said $743 while the
 * owner's real payout is $470. A comp that high sets a ceiling that high,
 * which means overpaying sellers.
 *
 * Owner 2026-08-20: "just reduce by 10-20 dollars on the ones priced a bit
 * too high, use your judgement." So until each model's real payout replaces
 * its comp in NET_PAYOUTS, these take a modest flat trim, scaled inside that
 * $10-20 range so a $137 Pixel isn't cut as hard as a $619 iPhone 17 Pro.
 *
 * Deliberately NOT trimmed:
 *   - NET_PAYOUTS models — those are the owner's real numbers already.
 *   - iPhone 13 family — its comps were BACK-CALCULATED from his own payouts
 *     ("170 unlocked, 120 locked"), so they're already truth, not a scrape.
 *   - Pixels — sourced from Atlas grade_a wholesale, i.e. a real exit price.
 *   - Watches / consoles — PRICE_TABLE sits under the cap, so it never bites.
 */
const CONSUMER_COMP_LABELS = new Set([
  "iPhone 17 Pro", "iPhone 17",
  "iPhone 16 Pro", "iPhone 16 Plus", "iPhone 16",
  "iPhone 15 Pro Max", "iPhone 15 Pro", "iPhone 15",
  "iPhone 14 Pro Max", "iPhone 14 Pro", "iPhone 14",
  "Galaxy S26 Ultra", "Galaxy S25 Ultra", "Galaxy S24 Ultra", "Galaxy S26", "Galaxy S25",
]);

/**
 * The trim, derived from the model's FULL-condition cap (condition multiplier
 * 1.0) rather than the per-cell cap — so it's one constant per model. That
 * matters: subtracting a constant from an ordered ladder keeps it ordered,
 * while a per-cell trim could invert two adjacent conditions at a tier
 * boundary and trip the monotonic invariant gate.
 */
function consumerCompTrim(fullCap: number): number {
  if (fullCap < 250) return 10;
  if (fullCap < 450) return 15;
  return 20;
}

/** A carrier answer counts as LOCKED for payout purposes. Mirrors the
 *  carrier-deduction rule exactly: "verizon" is only locked when the seller
 *  answered the lock question yes — a paid-off Verizon phone is unlocked. */
function isLockedCarrier(carrier?: string | null, carrierLocked?: boolean): boolean {
  const c = (carrier || "unlocked").toLowerCase();
  if (c === "verizon") return !!carrierLocked;
  return c === "att" || c === "tmobile" || c === "other";
}

/**
 * The ONE margin-cap calculation every surface must use — funnel, /go board,
 * chat brain, and the server lead guards — so a phone can never be worth one
 * number on the page and a different one in the chat.
 *
 * Returns null when we have no resell reference for the model; callers then
 * keep the raw PRICE_TABLE quote exactly as before.
 */
export function marginCapFor(opts: {
  modelId?: string | null;
  label?: string | null;
  condition?: string | null;
  brokenGlass?: "front" | "back" | "both" | null;
  carrier?: string | null;
  carrierLocked?: boolean;
}): number | null {
  const condMult = resellMultiplierForCondition(opts.condition ?? undefined, opts.brokenGlass);
  const net = opts.modelId ? NET_PAYOUTS[opts.modelId] : undefined;
  if (net) {
    const base = isLockedCarrier(opts.carrier, opts.carrierLocked) ? net.locked : net.unlocked;
    return Math.round(base * condMult * MARGIN_FLOOR_MULT);
  }
  const resell = getResellEstimateForModel(opts.modelId ?? null, opts.label ?? null);
  if (resell == null) return null;
  const cap = Math.round(Math.round(resell * condMult) * EBAY_FEE_MULT * MARGIN_FLOOR_MULT);
  // Consumer-median comps run high (see CONSUMER_COMP_LABELS). Trim is keyed
  // to the model's full-condition cap so it's constant across the ladder.
  const matched = resellLabelFor(opts.modelId ?? null, opts.label ?? null);
  if (matched && CONSUMER_COMP_LABELS.has(matched)) {
    const fullCap = Math.round(resell * EBAY_FEE_MULT * MARGIN_FLOOR_MULT);
    return Math.max(0, cap - consumerCompTrim(fullCap));
  }
  return cap;
}

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
 * Apply the Galaxy drop with a monotone floor. The raw threshold rule
 * (drop only offers >= $250) paid a better config LESS than a worse one at
 * the boundary — a $268 sealed top config dropped to $193 while a $223 mint
 * mid config kept its full $223. Offers below the threshold keep full
 * value; offers at/above it take the drop but never land below
 * GALAXY_DROP_MIN_OFFER − 1, so the ladder stays nondecreasing.
 * Skywalker-approved 2026-07-13. ALL drop applications must go through
 * this helper — page.tsx funnel, getMaxPrice cards, quote.ts bot.
 */
export const applyGalaxyDrop = (offer: number, modelId?: string | null): number => {
  const gd = galaxyPriceDrop(modelId);
  if (gd <= 0 || offer < GALAXY_DROP_MIN_OFFER) return offer;
  return Math.max(offer - gd, GALAXY_DROP_MIN_OFFER - 1);
};

/**
 * "Pricey only" floor for the Galaxy −$75: only apply the drop when the
 * offer is at least this much, so cheap S23 / FE / Flip5 (a ~$100-160 offer)
 * don't crater to the $25 minimum. Skywalker 2026-07-05.
 */
export const GALAXY_DROP_MIN_OFFER = 250;
