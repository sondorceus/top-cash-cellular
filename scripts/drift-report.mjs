// WEEKLY PRICE-DRIFT REPORT — exit-anchored analysis of every iPhone cell
// (stage 1 of exit-anchored pricing, owner-approved 2026-07-14 "do it all").
//
// For each (model, storage, condition) it compares the live funnel offer
// against the freshest EXIT data we hold:
//   - the wholesale buyer sheet (scripts/buyer-sheet-data.mjs) — cash exit
//   - eBay sold net medians (public/comps/ebay-sold.json, weekly scrape)
// and against ItsWorthMore (public/comps/iwm-reference.json) as the
// competitiveness signal (are we getting out-bid?).
//
// Flags:
//   OVERPAY   — offer above the BEST exit (a unit we'd lose money on)
//   UNDERBID  — offer more than $50 under IWM's price for the same cell
//               (leads we lose to IWM for no margin reason)
//   STALE     — comps older than 21 days get a loud header warning
// plus a suggested exit-anchored offer (best exit − tier margin:
// ≥$600→$80, $300-599→$60, <$300→$40) — REPORT ONLY, nothing auto-applies.
//
//   node scripts/drift-report.mjs             (print report)
//   node scripts/drift-report.mjs --post-mc   (also post summary to Mission
//                                              Control; needs MC_API_KEY env)
//
// Runs weekly via .github/workflows/price-drift-weekly.yml after the comp
// refresh workflows, so drift gets REPORTED the week it happens instead of
// discovered on a bad buy. Requires Node ≥23.6.

import { readFileSync } from "fs";
import { PRICE_TABLE, CARRIER_DEDUCTIONS, CARRIER_GAPS_BY_COND } from "../app/data/prices.ts";
import { RESELL_ESTIMATES, MARGIN_FLOOR_MULT, EBAY_FEE_MULT } from "../app/lib/resell-estimates.ts";
import { SHEET } from "./buyer-sheet-data.mjs";

const BONUS = 25;
const CMULT = { sealed: 1.0, mint: 1.0, good: 0.8, fair: 0.65, broken: 0.55 };
const LABELS = {
  ip17pm: "iPhone 17 Pro Max", ip17p: "iPhone 17 Pro", ip17air: "iPhone 17 Air", ip17: "iPhone 17", ip17e: "iPhone 17e",
  ip16pm: "iPhone 16 Pro Max", ip16p: "iPhone 16 Pro", ip16plus: "iPhone 16 Plus", ip16: "iPhone 16", ip16e: "iPhone 16e",
  ip15pm: "iPhone 15 Pro Max", ip15p: "iPhone 15 Pro", ip15plus: "iPhone 15 Plus", ip15: "iPhone 15",
  ip14pm: "iPhone 14 Pro Max", ip14p: "iPhone 14 Pro", ip14plus: "iPhone 14 Plus", ip14: "iPhone 14",
  ip13pm: "iPhone 13 Pro Max", ip13p: "iPhone 13 Pro", ip13mini: "iPhone 13 mini", ip13: "iPhone 13",
  ip12pm: "iPhone 12 Pro Max", ip12p: "iPhone 12 Pro", ip12mini: "iPhone 12 mini", ip12: "iPhone 12",
  ip11pm: "iPhone 11 Pro Max", ip11p: "iPhone 11 Pro", ip11: "iPhone 11",
};
const GRADE_I = { mint: 0, good: 1, fair: 2, broken: 3 };

const readJson = (p) => { try { return JSON.parse(readFileSync(new URL(p, import.meta.url), "utf8")); } catch { return {}; } };
const ebay = readJson("../public/comps/ebay-sold.json");
const iwm = readJson("../public/comps/iwm-reference.json");

const ageDays = (iso) => iso ? Math.round((Date.now() - new Date(iso).getTime()) / 86400000) : null;
const ebayAge = ageDays(ebay.scraped_at), iwmAge = ageDays(iwm.scraped_at);

// Live funnel offer (unlocked): cell + bonus, margin-capped.
function offer(id, st, cond) {
  const cell = PRICE_TABLE[id]?.[st]?.[cond];
  if (cell == null) return null;
  const raw = cell > 0 ? cell + BONUS : 0;
  const r = RESELL_ESTIMATES[LABELS[id]] ?? null;
  if (r != null) return Math.min(raw, Math.round(Math.round(r * CMULT[cond]) * EBAY_FEE_MULT * MARGIN_FLOOR_MULT));
  return raw;
}

// eBay net exit for a cell. eBay buckets: sealed / used (all working
// grades) / broken. Grades share the "used" bucket — treat its net median
// as the exit for mint (a working phone sells at market regardless of our
// grade label; good/fair exits are AT MOST that, so only mint uses it).
function ebayExit(id, st, cond) {
  const cell = ebay.models?.[id]?.by_cell?.[st];
  if (!cell) return null;
  const bucket = cond === "sealed" ? cell.sealed : cond === "broken" ? cell.broken : cond === "mint" ? cell.used : null;
  if (!bucket || (bucket.count ?? 0) < 3) return null;
  return bucket.net_median ?? null;
}

function sheetExit(id, st, cond) {
  const sh = SHEET[id];
  if (!sh) return null;
  if (cond === "sealed") return sh.sealedUn?.[st] ?? null;
  const g = sh.un?.[st];
  return g ? g[GRADE_I[cond]] ?? null : null;
}

function iwmPrice(id, st, cond) {
  // iwm-reference conds: sealed/good/fair/broken (+mint after the parser
  // fix regenerates). Excellent falls back to good (conservative).
  const m = iwm.models?.[id]?.[st];
  if (!m) return null;
  return m[cond === "mint" ? "mint" : cond] ?? (cond === "mint" ? m.good : null) ?? null;
}

const marginFor = (exit) => (exit >= 600 ? 80 : exit >= 300 ? 60 : 40);

const overpays = [], underbids = [];
let cells = 0;
for (const id of Object.keys(SHEET)) {
  if (!PRICE_TABLE[id]) continue;
  for (const st of Object.keys(PRICE_TABLE[id])) {
    for (const cond of ["sealed", "mint", "good", "fair", "broken"]) {
      const o = offer(id, st, cond);
      if (o == null || o === 0) continue;
      cells++;
      const exits = [sheetExit(id, st, cond), ebayExit(id, st, cond)].filter((x) => x != null && x > 0);
      const best = exits.length ? Math.max(...exits) : null;
      if (best != null && o > best) {
        overpays.push({ id, st, cond, offer: o, best, over: o - best, suggest: Math.max(0, best - marginFor(best)) });
      }
      const comp = iwmPrice(id, st, cond);
      if (comp != null && best != null && o < comp - 50 && comp - 50 <= best - marginFor(best)) {
        // We're >$50 under IWM AND could bid up without breaching the exit
        // margin — leads lost for no reason.
        underbids.push({ id, st, cond, offer: o, iwm: comp, best, suggest: best - marginFor(best) });
      }
    }
  }
}
overpays.sort((a, b) => b.over - a.over);
underbids.sort((a, b) => (b.iwm - b.offer) - (a.iwm - a.offer));

const lines = [];
lines.push(`PRICE DRIFT REPORT — ${cells} iPhone cells vs exits`);
lines.push(`comps: eBay ${ebayAge ?? "?"}d old${ebayAge > 21 ? " ⚠️ STALE" : ""}, IWM reference ${iwmAge ?? "?"}d old${iwmAge > 21 ? " ⚠️ STALE (regen: python scripts/audit-prices-vs-iwm.py)" : ""}, buyer sheet 2026-07-14 (update scripts/buyer-sheet-data.mjs on new quote)`);
lines.push("");
lines.push(`OVERPAYS (offer above best exit): ${overpays.length}`);
for (const f of overpays.slice(0, 15))
  lines.push(`  ${LABELS[f.id]} ${f.st.toUpperCase()} ${f.cond}: we pay $${f.offer}, best exit $${f.best} (over $${f.over}) → suggest $${f.suggest}`);
lines.push("");
lines.push(`UNDERBIDS (>$50 under IWM with margin room): ${underbids.length}`);
for (const f of underbids.slice(0, 15))
  lines.push(`  ${LABELS[f.id]} ${f.st.toUpperCase()} ${f.cond}: we pay $${f.offer}, IWM pays $${f.iwm}, exit $${f.best} → could bid $${f.suggest}`);
lines.push("");
lines.push("Suggestions are exit − tier margin (80/60/40). REPORT ONLY — apply via /admin/prices or a prices.ts recab (both are invariant-gated).");

const report = lines.join("\n");
console.log(report);

if (process.argv.includes("--post-mc")) {
  const key = process.env.MC_API_KEY;
  if (!key) {
    console.error("(--post-mc: MC_API_KEY not set, skipping post)");
  } else {
    const summary = `WEEKLY PRICE DRIFT: ${overpays.length} overpay cells, ${underbids.length} underbid cells.\n\n` +
      report.split("\n").slice(0, 40).join("\n");
    const r = await fetch("https://missioncontrolsdjg-production.up.railway.app/api/comms", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": key },
      body: JSON.stringify({ from: "powerhouse", to: "skywalker", type: "update", body: summary }),
    }).catch((e) => ({ ok: false, statusText: String(e) }));
    console.error(r.ok ? "(posted to MC)" : `(MC post failed: ${r.status ?? ""} ${r.statusText ?? ""})`);
  }
}
