// BOT/FUNNEL PARITY GATE — asserts the marketplace-bot quote engine
// (app/lib/quote.ts, used by msgr-ai and lead tooling) produces EXACTLY the
// number the customer funnel would show for the same device spec.
//
// Why this exists: the two engines implement "the same" math independently,
// and they drifted — after the 2026-07-14 sealed recabs the bot quoted a
// sealed 17 Pro Max 1TB $220 under the funnel (it still derived sealed =
// mint + premium while the funnel reads the sealed cell). This sweep makes
// that class of drift a build failure instead of a discovery.
//
// Runs in `prebuild` via tsx (quote.ts uses Next-style extensionless
// imports plain node can't load): npm run build fails → deploy fails.
//
// Scope: every phone in PRICE_TABLE × storage × condition × carrier config,
// funnel core math (cell − gap + bonus − penalties, margin cap, galaxy
// drop, MIN_OFFER manual-review) vs quoteDevice() with empty overrides.
// Skipped combos (intentional divergence): rows without a sealed cell
// (bot's mint+premium fallback serves watches/tablets the funnel prices
// via multipliers).

import { readFileSync } from "fs";
import { PRICE_TABLE, MIN_OFFER, carrierGapForCondition, CARRIER_DEDUCTIONS, MANUAL_REVIEW_DEVICES } from "../app/data/prices";
import {
  getResellEstimate, resellMultiplierForCondition,
  MARGIN_FLOOR_MULT, EBAY_FEE_MULT, applyGalaxyDrop,
} from "../app/lib/resell-estimates";
import { quoteDevice, type PriceOverrides } from "../app/lib/quote";

const EMPTY: PriceOverrides = { priceTable: {}, carrierDeductions: {}, baseOverrides: {}, conditionAdj: {} };

// Funnel labels straight from page.tsx model definitions — resell-cap
// matching must behave exactly like the live site.
const pageSrc = readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");
const LABELS: Record<string, string> = {};
for (const m of pageSrc.matchAll(/id:\s*"([^"]+)",\s*label:\s*"([^"]+)"/g)) {
  if (!(m[1] in LABELS)) LABELS[m[1]] = m[2];
}

const CONDS = ["sealed", "mint", "good", "fair", "broken"] as const;
const CARRIERS = [
  { id: "unlocked", locked: false },
  { id: "tmobile", locked: false },
  { id: "att", locked: false },
  { id: "verizon", locked: true },
  { id: "other", locked: false },
];
const isPhone = (id: string) => /^(ip(?!ad)|gs|gz|px|gnote)/.test(id);

// Funnel-core replica (bot scope: no promos/coupons/accessories).
function funnelOffer(id: string, st: string, cond: string, carrier: string, vzLocked: boolean):
  { offer: number | null; manual: boolean } | null {
  const cell = PRICE_TABLE[id]?.[st]?.[cond];
  if (cell == null) return null; // skip — bot fallback paths are intentional
  const condGap = carrierGapForCondition(id, carrier, cond, vzLocked, st);
  if (condGap?.manual) return { offer: null, manual: true };
  let gap = 0;
  if (condGap != null) gap = condGap.gap;
  else if (carrier === "verizon") gap = vzLocked ? (CARRIER_DEDUCTIONS[id]?.verizon ?? CARRIER_DEDUCTIONS[id]?.att ?? 0) : 0;
  else if (carrier !== "unlocked") gap = CARRIER_DEDUCTIONS[id]?.[carrier] ?? 0;
  const base = Math.max(0, Math.round(cell - gap));
  const bonus = base > 0 ? 25 : 0;
  const raw = Math.max(0, base + bonus);
  const resell = getResellEstimate(LABELS[id]);
  const condMult = resellMultiplierForCondition(cond, null);
  const est = resell != null ? Math.round(resell * condMult) : null;
  const cap = est != null ? Math.round(est * EBAY_FEE_MULT * MARGIN_FLOOR_MULT) : null;
  const capped = cap != null && raw > cap ? cap : raw;
  const final = applyGalaxyDrop(capped, id);
  const manual = final < MIN_OFFER || (cap != null && cap < MIN_OFFER);
  return { offer: manual ? null : final, manual };
}

async function main() {
  let checked = 0;
  const mismatches: string[] = [];
  for (const id of Object.keys(PRICE_TABLE)) {
    if (!isPhone(id)) continue;
    // MANUAL_REVIEW_DEVICES: bot hands these to a human by design while
    // the funnel shows a flagged quote — intentional divergence.
    if (MANUAL_REVIEW_DEVICES.has(id)) continue;
    const label = LABELS[id];
    if (!label) continue;
    for (const st of Object.keys(PRICE_TABLE[id])) {
      for (const cond of CONDS) {
        const expected = funnelOffer(id, st, cond, "unlocked", false);
        if (expected == null) continue; // no cell — intentional divergence
        for (const c of CARRIERS) {
          const exp = funnelOffer(id, st, cond, c.id, c.locked);
          if (exp == null) continue;
          const bot = await quoteDevice({
            modelId: id, modelLabel: label, storage: st, condition: cond,
            carrier: c.id, carrierLocked: c.locked, isPhone: true,
          }, EMPTY);
          checked++;
          const botOffer = bot.manualReview ? null : bot.offer;
          if (botOffer !== exp.offer) {
            mismatches.push(`${id} ${st} ${cond} ${c.id}${c.locked ? "(locked)" : ""}: bot $${botOffer ?? "manual"} vs funnel $${exp.offer ?? "manual"}`);
          }
        }
      }
    }
  }
  for (const m of mismatches.slice(0, 20)) console.log("  MISMATCH " + m);
  if (mismatches.length > 20) console.log(`  …and ${mismatches.length - 20} more`);
  console.log(`\nbot/funnel parity: ${mismatches.length === 0 ? "CLEAN" : mismatches.length + " MISMATCHES"} (${checked} specs compared)`);
  process.exit(mismatches.length > 0 ? 1 : 0);
}

main();
