// Full-site quote-logic monotonicity check (owner 2026-07-14: "we are
// paying more on excellent than sealed … go through the entire site and
// fix logic mismatches").
//
// Replays the funnel's exact quote math for EVERY PRICE_TABLE model ×
// storage × carrier config and asserts two invariants a customer can see:
//
//   1. CONDITION ladder: sealed ≥ excellent(mint) ≥ good ≥ fair ≥ broken
//      for the same storage + carrier.
//   2. STORAGE ladder: a bigger storage tier never quotes BELOW a smaller
//      one for the same condition + carrier.
//
// Math mirrored from app/page.tsx: offer = cell − carrier gap (+$25 phone
// bonus), capped at resell × condMult × 0.87 × 0.75 (labels resolved from
// page.tsx model definitions, matching via the real getResellEstimate),
// then applyGalaxyDrop. Sealed+locked tiers with no per-storage gap are
// manual-review → skipped. Run after any pricing edit:
//
//   node scripts/check-monotonic.mjs        (exit 1 on violations)

import { readFileSync } from "fs";
import { PRICE_TABLE, CARRIER_DEDUCTIONS, carrierGapForCondition } from "../app/data/prices.ts";
import { getResellEstimate, resellMultiplierForCondition, MARGIN_FLOOR_MULT, EBAY_FEE_MULT, applyGalaxyDrop } from "../app/lib/resell-estimates.ts";

// id → customer-facing label, straight from page.tsx model definitions so
// resell-cap matching behaves exactly like the live funnel.
const pageSrc = readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");
const LABELS = {};
for (const m of pageSrc.matchAll(/id:\s*"([^"]+)",\s*label:\s*"([^"]+)"/g)) {
  if (!(m[1] in LABELS)) LABELS[m[1]] = m[2];
}

const CONDS = ["sealed", "mint", "good", "fair", "broken"];
const STORAGE_ORDER = ["base", "32", "64", "128", "256", "512", "1tb", "2tb", "4tb"];
const isPhone = (id) => /^(ip(?!ad)|gs|gz|px|gnote)/.test(id);
// Carrier variants only exist for devices with a carrier question (phones;
// the funnel's carrier step). Everything else quotes unlocked-only —
// running fake carrier configs on a MacBook just multiplies noise.
const CARRIERS_PHONE = [
  { id: "unlocked", label: "unlocked" },
  { id: "tmobile", label: "T-Mobile" },
  { id: "att", label: "AT&T" },
  { id: "verizon", label: "Verizon-locked", locked: true },
  { id: "other", label: "Other" },
];
const CARRIERS_OTHER = [{ id: "unlocked", label: "unlocked" }];

// offer() mirrors the funnel; returns null for manual-review combos.
function offer(id, st, cond, carrier, vzLocked) {
  const cell = PRICE_TABLE[id]?.[st]?.[cond];
  if (cell == null) return null;
  const condGap = carrierGapForCondition(id, carrier, cond, !!vzLocked, st);
  if (condGap?.manual) return null;
  let gap = 0;
  if (condGap != null) gap = condGap.gap;
  else if (carrier === "verizon") gap = vzLocked ? (CARRIER_DEDUCTIONS[id]?.verizon ?? CARRIER_DEDUCTIONS[id]?.att ?? 0) : 0;
  else if (carrier !== "unlocked") gap = CARRIER_DEDUCTIONS[id]?.[carrier] ?? 0;
  const base = Math.max(0, Math.round(cell - gap));
  const bonus = isPhone(id) && base > 0 ? 25 : 0;
  const raw = Math.max(0, base + bonus);
  const resell = getResellEstimate(LABELS[id]);
  const condMult = resellMultiplierForCondition(cond, null);
  const cap = resell != null ? Math.round(Math.round(resell * condMult) * EBAY_FEE_MULT * MARGIN_FLOOR_MULT) : null;
  const capped = cap != null && raw > cap ? cap : raw;
  return applyGalaxyDrop(capped, id);
}

let fails = 0;
const fail = (m) => { fails++; console.log("  FAIL " + m); };

for (const id of Object.keys(PRICE_TABLE)) {
  // Only rank keys that are REAL storage tiers — additive-spec models
  // (Macs) mix RAM/config keys ("32gbunifiedmemory") into the same map and
  // those aren't a ladder the customer walks.
  const storages = Object.keys(PRICE_TABLE[id])
    .filter((s) => STORAGE_ORDER.includes(s))
    .sort((a, b) => STORAGE_ORDER.indexOf(a) - STORAGE_ORDER.indexOf(b));
  if (storages.length === 0) continue;
  for (const c of isPhone(id) ? CARRIERS_PHONE : CARRIERS_OTHER) {
    // 1. condition ladder per storage
    for (const st of storages) {
      let prev = null, prevCond = null;
      for (const cond of CONDS) {
        const o = offer(id, st, cond, c.id, c.locked);
        if (o == null) continue;
        if (prev != null && o > prev)
          fail(`${id} ${st} ${c.label}: ${cond} $${o} > ${prevCond} $${prev} (better condition pays less)`);
        prev = o; prevCond = cond;
      }
    }
    // 2. storage ladder per condition
    for (const cond of CONDS) {
      let prev = null, prevSt = null;
      for (const st of storages) {
        const o = offer(id, st, cond, c.id, c.locked);
        if (o == null) continue;
        if (prev != null && o < prev)
          fail(`${id} ${cond} ${c.label}: ${st} $${o} < ${prevSt} $${prev} (bigger storage pays less)`);
        prev = o; prevSt = st;
      }
    }
  }
}

console.log(`\nmonotonic check: ${fails === 0 ? "CLEAN" : fails + " violations"} across ${Object.keys(PRICE_TABLE).length} models`);
process.exit(fails > 0 ? 1 : 0);
