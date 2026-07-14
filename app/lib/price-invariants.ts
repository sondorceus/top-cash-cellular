// PRICE-LOGIC INVARIANTS — the single guard that makes condition/storage
// ladder inversions impossible to ship (owner 2026-07-14: "add some type of
// logic that makes [it] impossible to break this … it should give error
// code every time").
//
// Invariants enforced on the RAW quote ladder (cell − carrier gap + bonus):
//   1. CONDITION: sealed ≥ excellent(mint) ≥ good ≥ fair ≥ broken for every
//      (model, storage, carrier config). For iPhones sealed must clear mint
//      by ≥ $10 — the mint-tier accessory bonus (+$10) would otherwise let
//      an Excellent quote beat a Sealed one.
//   2. STORAGE: a bigger tier never quotes below a smaller one for the same
//      (condition, carrier config).
//
// Why raw is sufficient: the two downstream transforms are monotone-
// preserving, so a clean raw ladder stays clean on the live site.
//   - The resell margin cap is min(raw, cap) where cap uses condition
//     multipliers 1.0/1.0/0.8/0.65/0.55 (ordered) and is storage-constant —
//     min() of two ordered ladders is ordered.
//   - applyGalaxyDrop is a flat drop with its own monotone floor
//     (resell-estimates.ts, 2026-07-13).
//
// Enforced at three choke points, so there is no unguarded path to a bad
// price:
//   - next.config.ts: build FAILS on violations → a bad prices.ts can never
//     deploy (Vercel build exits non-zero).
//   - /api/admin/prices POST/DELETE: an override that would create a
//     violation is rejected with HTTP 422 + the violation list, BEFORE the
//     blob is written. DELETE accepts ?force=1 (removing overrides may
//     re-expose a baseline that a later code fix supersedes).
//   - scripts/check-monotonic.mjs: manual/CI runner, exit 1 on violations.

// Zero imports on purpose: this module must load identically under the
// Next build, the admin API route, and plain `node` (scripts) — callers
// inject carrierGapForCondition so we never touch module resolution.
export type GapResolver = (
  modelId: string,
  carrier: string | undefined,
  conditionId: string | undefined,
  verizonLocked: boolean,
  storageId?: string | undefined,
) => { gap: number; manual: boolean } | null;

export type PriceTable = Record<string, Record<string, Record<string, number>>>;
export type CarrierDeductions = Record<string, Record<string, number>>;

export type InvariantViolation = {
  modelId: string;
  storage: string;
  carrier: string;
  message: string;
};

const CONDS = ["sealed", "mint", "good", "fair", "broken"] as const;
const CONDITION_LABEL: Record<string, string> = {
  sealed: "Sealed", mint: "Excellent", good: "Good", fair: "Fair", broken: "Broken",
};
const STORAGE_ORDER = ["base", "32", "64", "128", "256", "512", "1tb", "2tb", "4tb"];

// Phones get carrier configs + the $25 popular bonus. (ip(?!ad) keeps iPads
// out — their connectivity multiplier is uniform and can't invert a ladder.)
const isPhone = (id: string) => /^(ip(?!ad)|gs|gz|px|gnote)/.test(id);
const isIphone = (id: string) => /^ip(?!ad)/.test(id);

const PHONE_CARRIERS = [
  { id: "unlocked", label: "unlocked", locked: false },
  { id: "tmobile", label: "T-Mobile", locked: false },
  { id: "att", label: "AT&T", locked: false },
  { id: "verizon", label: "Verizon-locked", locked: true },
  { id: "other", label: "Other carrier", locked: false },
];
const NON_PHONE_CARRIERS = [{ id: "unlocked", label: "unlocked", locked: false }];

// Raw funnel quote (pre-cap): cell − carrier gap, +$25 phone bonus when the
// docked base is still positive. Returns null for cells that don't exist or
// sealed+locked combos routed to manual review.
function rawOffer(
  pt: PriceTable,
  cd: CarrierDeductions,
  gapResolver: GapResolver,
  id: string,
  storage: string,
  cond: string,
  carrier: string,
  vzLocked: boolean,
): number | null {
  const cell = pt[id]?.[storage]?.[cond];
  if (cell == null) return null;
  const condGap = gapResolver(id, carrier, cond, vzLocked, storage);
  if (condGap?.manual) return null;
  let gap = 0;
  if (condGap != null) gap = condGap.gap;
  else if (carrier === "verizon") gap = vzLocked ? (cd[id]?.verizon ?? cd[id]?.att ?? 0) : 0;
  else if (carrier !== "unlocked") gap = cd[id]?.[carrier] ?? 0;
  const base = Math.max(0, Math.round(cell - gap));
  const bonus = isPhone(id) && base > 0 ? 25 : 0;
  return base + bonus;
}

/**
 * Validate the pricing invariants for the given effective tables. Pass a
 * `models` subset to validate only the models an edit touched (the admin
 * route does this so a one-cell save stays fast).
 */
export function validatePriceInvariants(
  priceTable: PriceTable,
  carrierDeductions: CarrierDeductions,
  gapResolver: GapResolver,
  models?: string[],
): InvariantViolation[] {
  const violations: InvariantViolation[] = [];
  const ids = models && models.length ? models.filter((m) => priceTable[m]) : Object.keys(priceTable);

  for (const id of ids) {
    const storages = Object.keys(priceTable[id])
      .filter((s) => STORAGE_ORDER.includes(s))
      .sort((a, b) => STORAGE_ORDER.indexOf(a) - STORAGE_ORDER.indexOf(b));
    if (storages.length === 0) continue; // additive-spec models (Macs) — not a cell ladder
    const carriers = isPhone(id) ? PHONE_CARRIERS : NON_PHONE_CARRIERS;
    // Sealed must clear Excellent by the mint accessory bonus on iPhones.
    const sealedHeadroom = isIphone(id) ? 10 : 0;

    // 3. ROW COMPLETENESS (phones): every storage row must carry all five
    // conditions. A missing cell doesn't error in the funnel — it silently
    // reroutes that condition to the base×multiplier engine, which prices
    // on a different curve than the neighboring cells (found live: gs23p
    // 128 had only broken+sealed).
    if (isPhone(id)) {
      for (const st of storages) {
        const missing = CONDS.filter((cond) => priceTable[id][st][cond] == null);
        if (missing.length > 0 && missing.length < CONDS.length) {
          violations.push({
            modelId: id, storage: st, carrier: "—",
            message: `${id} ${st}: missing ${missing.join(", ")} cell${missing.length === 1 ? "" : "s"} — incomplete rows silently fall back to multiplier pricing`,
          });
        }
      }
    }

    for (const c of carriers) {
      // 1. condition ladder
      for (const st of storages) {
        let prev: number | null = null;
        let prevCond = "";
        for (const cond of CONDS) {
          const o = rawOffer(priceTable, carrierDeductions, gapResolver, id, st, cond, c.id, c.locked);
          if (o == null) continue;
          // Headroom only applies when sealed actually quotes ($0 vs $0 is
          // two manual-review floors, not an inversion).
          const headroom = prevCond === "sealed" && cond === "mint" && prev != null && prev > 0 ? sealedHeadroom : 0;
          if (prev != null && o > prev - headroom) {
            violations.push({
              modelId: id, storage: st, carrier: c.label,
              message: `${id} ${st} ${c.label}: ${CONDITION_LABEL[cond]} would quote $${o} vs ${CONDITION_LABEL[prevCond]} $${prev}${headroom ? ` (Sealed must clear Excellent by ≥$${headroom} — mint accessory bonus)` : ""} — a better condition must never pay less`,
            });
          }
          prev = o; prevCond = cond;
        }
      }
      // 2. storage ladder
      for (const cond of CONDS) {
        let prev: number | null = null;
        let prevSt = "";
        for (const st of storages) {
          const o = rawOffer(priceTable, carrierDeductions, gapResolver, id, st, cond, c.id, c.locked);
          if (o == null) continue;
          if (prev != null && o < prev) {
            violations.push({
              modelId: id, storage: st, carrier: c.label,
              message: `${id} ${CONDITION_LABEL[cond]} ${c.label}: ${st.toUpperCase()} would quote $${o} vs ${prevSt.toUpperCase()} $${prev} — bigger storage must never pay less`,
            });
          }
          prev = o; prevSt = st;
        }
      }

      // 4. LOCKED ≤ UNLOCKED: a carrier-locked phone must never out-quote
      // the unlocked one. Gaps are normally positive, but the admin shape
      // check allows negative deductions — this catches a stray negative
      // gap (or cond-gap edit) before it pays locked over unlocked.
      if (c.id !== "unlocked") {
        for (const st of storages) {
          for (const cond of CONDS) {
            const locked = rawOffer(priceTable, carrierDeductions, gapResolver, id, st, cond, c.id, c.locked);
            const unlocked = rawOffer(priceTable, carrierDeductions, gapResolver, id, st, cond, "unlocked", false);
            if (locked != null && unlocked != null && locked > unlocked) {
              violations.push({
                modelId: id, storage: st, carrier: c.label,
                message: `${id} ${st} ${CONDITION_LABEL[cond]}: ${c.label} would quote $${locked} vs unlocked $${unlocked} — locked must never pay more than unlocked`,
              });
            }
          }
        }
      }
    }
  }
  return violations;
}
