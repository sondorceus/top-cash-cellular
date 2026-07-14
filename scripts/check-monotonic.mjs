// CLI runner for the price-logic invariants (app/lib/price-invariants.ts).
// The same validator gates the build (next.config.ts) and the admin price
// editor (/api/admin/prices), so this is the manual/CI face of the guard:
//
//   node scripts/check-monotonic.mjs        (exit 1 on violations)
//
// Validates the RAW ladder (cell − gap + bonus). Stricter than what a
// customer can see — the resell cap and Galaxy drop are monotone-preserving,
// so raw-clean ⇒ live-clean, and raw violations are caught even while a cap
// happens to mask them. Requires Node ≥23.6 (native .ts type stripping).

import { PRICE_TABLE, CARRIER_DEDUCTIONS, carrierGapForCondition } from "../app/data/prices.ts";
import { validatePriceInvariants } from "../app/lib/price-invariants.ts";

const violations = validatePriceInvariants(PRICE_TABLE, CARRIER_DEDUCTIONS, carrierGapForCondition);
for (const v of violations) console.log("  FAIL " + v.message);
console.log(`\nprice invariants: ${violations.length === 0 ? "CLEAN" : violations.length + " violations"} across ${Object.keys(PRICE_TABLE).length} models`);
process.exit(violations.length > 0 ? 1 : 0);
