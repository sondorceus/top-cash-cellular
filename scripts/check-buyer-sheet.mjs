// Buyer-sheet guardrail — checks TCC iPhone quotes against the wholesale
// buyer's price sheet ("Machine purchase quotation", 2026-07-14). Run after
// any iPhone PRICE_TABLE / CARRIER_DEDUCTIONS edit:
//
//   node scripts/check-buyer-sheet.mjs        (exit 1 on violations)
//
// Owner rules (Skywalker 2026-07-14):
//   1. LOCKED offers must stay UNDER the sheet's locked A/B/C/D price —
//      locked phones exit through this buyer. Exception: on 14-family and
//      newer, T-Mobile locked may pay up to $25 OVER the sheet column
//      ("for tmobile we can pay extra 25 on each phone, -35 on att, all
//      newer ones" — T-Mobile units unlock easily and resell better).
//   2. UNLOCKED may exceed the sheet (eBay exit covers it), but never by
//      $150 or more.
//   3. 17 Pro Max (and future higher-tier devices) bid HIGH: used/sealed
//      unlocked offers should land ~$75-85 under the sheet.
//   4. Open-box: Excellent (mint) unlocked offers must stay under the
//      sheet's open-activated prices (sealed − open deduction).
//
// Grade map: mint→A, good→B(+), fair→C, broken→D. Sheet prices use the
// LOWEST color. Update SHEET when a new quotation lands.
//
// Requires Node ≥23.6 (imports .ts data modules via native type stripping).

import { PRICE_TABLE, CARRIER_DEDUCTIONS, CARRIER_GAPS_BY_COND } from "../app/data/prices.ts";
import { RESELL_ESTIMATES, MARGIN_FLOOR_MULT, EBAY_FEE_MULT } from "../app/lib/resell-estimates.ts";
import { SHEET } from "./buyer-sheet-data.mjs";

const BONUS = 25; // popular-phone bonus
const CONDS = ["mint", "good", "fair", "broken"];
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

// Accepted violations — reviewed and left on purpose. key: `${id} ${st} ${lock} ${cond}`
// prefix match on `${id} ` means the whole model is accepted for that lock side.
const ACCEPTED = [
  // Sonny's live locked calibration 2026-07-11 ("170 unlocked / 120 locked")
  // outranks the sheet on the 13 — he moves these at those numbers.
  "ip13 LOCKED",
  // Owner IWM-parity intent (2026-07-12 broken directive); overs are $4-26
  // and the margin cap holds most cells. Revisit if the sheet drops again.
  "ip16 LOCKED", "ip16plus LOCKED",
  // Sealed locked legacy: the sheet pays $35-65 for sealed 11/12-era locked
  // units — cutting quotes that far kills the lead for near-zero volume.
  "ip11 LOCKED sealed", "ip12 LOCKED sealed",
  // 17 Air anchors to ItsWorthMore − $100 (owner 2026-07-14: "we are paying
  // way too low for 17 air — do 100 below itsworth"); the buyer sheet
  // craters on Airs and they exit elsewhere. 1TB used-locked runs over the
  // sheet's locked column by design.
  "ip17air LOCKED",
];
const isAccepted = (id, st, lock, cond) =>
  ACCEPTED.some((a) => `${id} ${lock} ${cond}`.startsWith(a) || `${id} ${lock}`.startsWith(a) && a.split(" ").length === 2);

// ---- The sheet (used A/B/C/D per storage, unlocked + locked, min color; ----
// ---- sealed new prices; open-activated deduction for 16/17 unlocked). ----
// Sheet data lives in scripts/buyer-sheet-data.mjs (shared with drift-report).

// ---- Quote math mirror (funnel path: cell − gap + bonus, margin cap) ----
function getResell(label) {
  // exact/substring with trailing-token guard — simplified: exact key only,
  // since LABELS are written to match RESELL_ESTIMATES keys exactly.
  return RESELL_ESTIMATES[label] ?? null;
}
function offer(id, st, cond, gap) {
  const cell = PRICE_TABLE[id]?.[st]?.[cond];
  if (cell == null) return null;
  const base = Math.max(0, cell - gap);
  const raw = base > 0 ? base + BONUS : 0;
  const r = getResell(LABELS[id]);
  if (r != null) {
    const cap = Math.round(Math.round(r * CMULT[cond]) * EBAY_FEE_MULT * MARGIN_FLOOR_MULT);
    return Math.min(raw, cap);
  }
  return raw;
}
// Models under the T-Mobile +25 / ATT −35 split (14-family and newer).
const TMO_SPLIT = new Set(["ip17pm", "ip17p", "ip17air", "ip17", "ip17e",
  "ip16pm", "ip16p", "ip16plus", "ip16", "ip16e",
  "ip15pm", "ip15p", "ip15plus", "ip15",
  "ip14pm", "ip14p", "ip14plus", "ip14"]);
const TMO_SLACK = 25;

// Returns [{ carrier, gap, slack }] — each carrier checked against
// sheet_lock + its slack.
function lockedGaps(id, cond, st) {
  const cg = CARRIER_GAPS_BY_COND[id];
  const slackTmo = TMO_SPLIT.has(id) ? TMO_SLACK : 0;
  if (cg) {
    if (cond === "sealed") {
      const g = cg.sealedLocked[st];
      return g == null ? null : [{ carrier: "locked", gap: g, slack: 0 }]; // missing tier → manual review
    }
    const t = cond === "broken" ? cg.broken : cg.used;
    return [{ carrier: "att", gap: t.att, slack: 0 }, { carrier: "tmobile", gap: t.tmobile, slack: slackTmo }];
  }
  const d = CARRIER_DEDUCTIONS[id] || {};
  return [{ carrier: "att", gap: d.att ?? 0, slack: 0 }, { carrier: "tmobile", gap: d.tmobile ?? 0, slack: slackTmo }];
}

let fails = 0, warns = 0, ok = 0, accepted = 0;
const fail = (m) => { fails++; console.log("  FAIL " + m); };
const warn = (m) => { warns++; console.log("  warn " + m); };

for (const [id, sh] of Object.entries(SHEET)) {
  if (!PRICE_TABLE[id]) { warn(`${id}: no PRICE_TABLE entry`); continue; }
  // Rule 1+2: used grades
  for (const [st, grades] of Object.entries(sh.un)) {
    CONDS.forEach((cond, i) => {
      const o = offer(id, st, cond, 0);
      if (o == null) return;
      const over = o - grades[i];
      if (over >= 150) fail(`${id} ${st} UNLOCKED ${cond}: $${o} is $${over} over sheet $${grades[i]} (limit <150)`);
      else ok++;
    });
  }
  for (const [st, grades] of Object.entries(sh.lk)) {
    CONDS.forEach((cond, i) => {
      const gaps = lockedGaps(id, cond, st);
      if (!gaps) return;
      for (const { carrier, gap, slack } of gaps) {
        const o = offer(id, st, cond, gap);
        if (o == null) continue;
        if (o > grades[i] + slack) {
          if (isAccepted(id, st, "LOCKED", cond)) { accepted++; continue; }
          fail(`${id} ${st} LOCKED(${carrier}) ${cond}: $${o} over sheet locked $${grades[i]}${slack ? ` (+$${slack} tmo slack)` : ""}`);
        } else ok++;
      }
    });
  }
  // sealed rows
  if (sh.sealedUn) for (const [st, p] of Object.entries(sh.sealedUn)) {
    const o = offer(id, st, "sealed", 0);
    if (o == null) continue;
    const over = o - p;
    if (o > p) fail(`${id} ${st} UNLOCKED sealed: $${o} over sheet sealed $${p}`);
    else ok++;
    // Rule 4: open-box — mint offer must stay under sealed − openDeduct
    const openPrice = p - (sh.openDeduct?.[st] ?? 0);
    const mintOffer = offer(id, st, "mint", 0);
    if (sh.openDeduct && mintOffer != null && mintOffer > openPrice)
      fail(`${id} ${st} UNLOCKED mint (open-box): $${mintOffer} over sheet open-activated $${openPrice}`);
  }
  if (sh.sealedLk) for (const [st, p] of Object.entries(sh.sealedLk)) {
    const gaps = lockedGaps(id, "sealed", st);
    if (!gaps) continue;
    for (const { carrier, gap, slack } of gaps) {
      const o = offer(id, st, "sealed", gap);
      if (o == null) continue;
      if (o > p + slack) {
        if (isAccepted(id, st, "LOCKED", "sealed")) { accepted++; continue; }
        fail(`${id} ${st} LOCKED(${carrier}) sealed: $${o} over sheet sealed-locked $${p}${slack ? ` (+$${slack} tmo slack)` : ""}`);
      } else ok++;
    }
  }
}

// Rule 3: 17PM higher-bid window (sheet − 75..85) on used unlocked
for (const [st, grades] of Object.entries(SHEET.ip17pm.un)) {
  CONDS.forEach((cond, i) => {
    const o = offer("ip17pm", st, cond, 0);
    if (o == null) return;
    const under = grades[i] - o;
    if (under < 75 || under > 85) warn(`ip17pm ${st} ${cond}: $${o} is $${under} under sheet $${grades[i]} (target 75-85)`);
  });
}

console.log(`\nbuyer-sheet check: ${ok} ok, ${accepted} accepted exceptions, ${warns} warnings, ${fails} FAILURES`);
process.exit(fails > 0 ? 1 : 0);
