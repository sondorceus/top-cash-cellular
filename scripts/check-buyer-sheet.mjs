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
const SHEET = {
  ip17pm: { un: { "256": [860, 820, 670, 420], "512": [990, 950, 800, 550], "1tb": [1090, 1010, 900, 650], "2tb": [1190, 1110, 1000, 750] },
    lk: { "256": [740, 700, 620, 370], "512": [860, 820, 740, 490], "1tb": [960, 920, 840, 590], "2tb": [1080, 1040, 960, 710] },
    sealedUn: { "256": 970, "512": 1175, "1tb": 1355, "2tb": 1505 }, sealedLk: { "256": 780, "512": 920, "1tb": 1030, "2tb": 1115 },
    openDeduct: { "256": 100, "512": 100, "1tb": 120, "2tb": 150 } },
  ip17p: { un: { "256": [810, 770, 620, 450], "512": [910, 870, 720, 550], "1tb": [1030, 990, 820, 650] },
    lk: { "256": [630, 590, 530, 330], "512": [780, 740, 640, 440], "1tb": [880, 840, 640, 540] },
    sealedUn: { "256": 925, "512": 1110, "1tb": 1245 }, sealedLk: { "256": 693, "512": 815, "1tb": 915 },
    openDeduct: { "256": 100, "512": 100, "1tb": 120 } },
  ip17air: { un: { "256": [520, 480, 400, 200], "512": [570, 530, 450, 300], "1tb": [670, 630, 520, 400] },
    lk: { "256": [360, 320, 240, 160], "512": [440, 400, 290, 210], "1tb": [490, 450, 340, 260] },
    sealedUn: { "256": 750, "512": 865, "1tb": 965 }, sealedLk: { "256": 415, "512": 495, "1tb": 555 },
    openDeduct: { "256": 100, "512": 100, "1tb": 200 } },
  ip17: { un: { "256": [530, 490, 410, 260], "512": [620, 580, 500, 350] },
    lk: { "256": [400, 360, 260, 160], "512": [500, 460, 360, 260] },
    sealedUn: { "256": 625, "512": 735 }, sealedLk: { "256": 450, "512": 610 }, openDeduct: { "256": 60, "512": 60 } },
  ip17e: { un: { "256": [300, 260, 210, 140], "512": [350, 310, 260, 200] },
    lk: { "256": [220, 180, 140, 80], "512": [300, 260, 220, 160] },
    sealedUn: { "256": 445, "512": 515 }, sealedLk: { "256": 250, "512": 320 }, openDeduct: { "256": 60, "512": 60 } },
  ip16pm: { un: { "256": [625, 585, 485, 335], "512": [665, 625, 525, 375], "1tb": [705, 665, 565, 425] },
    lk: { "256": [545, 505, 425, 225], "512": [595, 555, 475, 275], "1tb": [645, 605, 525, 325] },
    sealedUn: { "256": 855, "512": 985, "1tb": 1075 }, sealedLk: { "256": 685, "512": 755, "1tb": 855 },
    openDeduct: { "256": 100, "512": 100, "1tb": 100 } },
  ip16p: { un: { "128": [525, 485, 385, 235], "256": [565, 525, 425, 275], "512": [585, 545, 445, 295], "1tb": [605, 565, 465, 315] },
    lk: { "128": [405, 365, 305, 205], "256": [465, 425, 365, 265], "512": [515, 475, 415, 315], "1tb": [535, 495, 435, 335] },
    sealedUn: { "128": 685, "256": 785, "512": 885, "1tb": 945 }, sealedLk: { "128": 455, "256": 565, "512": 665, "1tb": 745 },
    openDeduct: { "128": 100, "256": 100, "512": 100, "1tb": 100 } },
  ip16plus: { un: { "128": [425, 385, 285, 185], "256": [455, 425, 315, 215], "512": [485, 455, 345, 245] },
    lk: { "128": [305, 265, 215, 165], "256": [355, 315, 265, 215], "512": [385, 345, 295, 245] },
    sealedUn: { "128": 480, "256": 560, "512": 630 }, sealedLk: { "128": 365, "256": 465, "512": 565 },
    openDeduct: { "128": 80, "256": 80, "512": 80 } },
  ip16: { un: { "128": [395, 355, 255, 155], "256": [425, 385, 285, 185], "512": [455, 415, 315, 215] },
    lk: { "128": [285, 245, 195, 145], "256": [325, 285, 235, 185], "512": [355, 315, 265, 215] },
    sealedUn: { "128": 455, "256": 515, "512": 575 }, sealedLk: { "128": 320, "256": 390, "512": 450 },
    openDeduct: { "128": 80, "256": 80, "512": 80 } },
  ip16e: { un: { "128": [265, 235, 175, 135], "256": [275, 245, 185, 145], "512": [305, 275, 215, 175] },
    lk: { "128": [135, 105, 75, 45], "256": [155, 125, 95, 65], "512": [175, 145, 115, 85] },
    sealedUn: { "128": 305, "256": 365, "512": 425 }, sealedLk: { "128": 170, "256": 250, "512": 310 },
    openDeduct: { "128": 50, "256": 50, "512": 50 } },
  ip15pm: { un: { "256": [465, 425, 365, 265], "512": [495, 455, 395, 295], "1tb": [525, 485, 425, 325] },
    lk: { "256": [365, 335, 275, 175], "512": [395, 365, 305, 205], "1tb": [425, 395, 335, 235] },
    sealedLk: { "256": 455, "512": 525, "1tb": 585 } },
  ip15p: { un: { "128": [365, 325, 265, 165], "256": [385, 345, 285, 185], "512": [405, 365, 305, 205], "1tb": [425, 385, 325, 225] },
    lk: { "128": [265, 235, 175, 125], "256": [305, 275, 215, 165], "512": [325, 295, 235, 185], "1tb": [345, 315, 255, 205] },
    sealedLk: { "128": 355, "256": 405, "512": 455, "1tb": 505 } },
  ip15plus: { un: { "128": [305, 265, 205, 125], "256": [325, 285, 225, 145], "512": [345, 305, 245, 165] },
    lk: { "128": [225, 185, 135, 85], "256": [255, 215, 165, 115], "512": [285, 245, 195, 145] },
    sealedLk: { "128": 300, "256": 340, "512": 435 } },
  ip15: { un: { "128": [265, 225, 175, 125], "256": [295, 255, 205, 155], "512": [325, 285, 235, 185] },
    lk: { "128": [205, 165, 115, 65], "256": [225, 185, 135, 85], "512": [245, 205, 155, 105] },
    sealedLk: { "128": 250, "256": 310, "512": 360 } },
  ip14pm: { un: { "128": [345, 305, 255, 155], "256": [365, 325, 275, 175], "512": [385, 345, 295, 195], "1tb": [405, 365, 315, 215] },
    lk: { "128": [255, 215, 165, 105], "256": [275, 235, 185, 125], "512": [295, 255, 205, 145], "1tb": [315, 275, 225, 165] } },
  ip14p: { un: { "128": [275, 235, 185, 105], "256": [295, 255, 205, 125], "512": [315, 275, 225, 145], "1tb": [335, 295, 245, 165] },
    lk: { "128": [235, 195, 145, 85], "256": [255, 215, 165, 105], "512": [275, 235, 185, 125], "1tb": [295, 255, 205, 145] } },
  ip14plus: { un: { "128": [205, 165, 115, 85], "256": [225, 185, 135, 105], "512": [245, 205, 155, 115] },
    lk: { "128": [145, 115, 85, 45], "256": [155, 125, 95, 55], "512": [165, 135, 105, 65] } },
  ip14: { un: { "128": [185, 145, 95, 55], "256": [205, 165, 115, 75], "512": [225, 185, 135, 95] },
    lk: { "128": [125, 95, 65, 35], "256": [145, 115, 85, 55], "512": [155, 125, 95, 65] }, sealedLk: { "128": 165 } },
  ip13pm: { un: { "128": [255, 235, 155, 115], "256": [275, 255, 175, 145], "512": [295, 275, 195, 165], "1tb": [305, 285, 205, 175] },
    lk: { "128": [205, 175, 145, 85], "256": [215, 185, 155, 95], "512": [225, 195, 165, 105], "1tb": [235, 205, 175, 115] } },
  ip13p: { un: { "128": [225, 185, 145, 105], "256": [245, 205, 165, 125], "512": [265, 225, 185, 145], "1tb": [285, 245, 205, 165] },
    lk: { "128": [145, 125, 85, 55], "256": [155, 135, 95, 65], "512": [165, 145, 105, 75], "1tb": [175, 155, 115, 85] } },
  ip13: { un: { "128": [140, 120, 80, 60], "256": [160, 140, 100, 70], "512": [170, 150, 110, 90] },
    lk: { "128": [90, 70, 50, 20], "256": [100, 80, 60, 30], "512": [110, 90, 70, 40] }, sealedLk: { "128": 150 } },
  ip13mini: { un: { "128": [110, 90, 60, 10], "256": [120, 100, 70, 20], "512": [130, 110, 80, 30] },
    lk: { "128": [50, 40, 10, 5], "256": [55, 45, 15, 5], "512": [60, 50, 20, 5] } },
  ip12pm: { un: { "128": [180, 160, 120, 50], "256": [200, 180, 140, 70], "512": [220, 200, 160, 90] },
    lk: { "128": [90, 70, 50, 10], "256": [100, 80, 60, 20], "512": [110, 90, 70, 30] } },
  ip12p: { un: { "128": [140, 120, 90, 50], "256": [160, 150, 110, 70], "512": [180, 160, 130, 90] },
    lk: { "128": [70, 50, 30, 10], "256": [80, 60, 40, 20], "512": [90, 70, 50, 30] } },
  ip12: { un: { "64": [90, 70, 50, 20], "128": [110, 90, 70, 40], "256": [120, 100, 80, 50] },
    lk: { "64": [40, 30, 20, 5], "128": [50, 40, 30, 10], "256": [60, 50, 40, 20] }, sealedLk: { "64": 65 } },
  ip12mini: { un: { "64": [70, 50, 30, 10], "128": [80, 60, 40, 20], "256": [90, 70, 50, 30] },
    lk: { "64": [30, 20, 5, 5], "128": [40, 30, 10, 5], "256": [50, 40, 20, 10] } },
  ip11pm: { un: { "64": [120, 100, 60, 20], "256": [130, 110, 70, 40], "512": [140, 120, 80, 50] },
    lk: { "64": [60, 40, 20, 10], "256": [70, 50, 30, 20], "512": [80, 60, 40, 30] } },
  ip11p: { un: { "64": [110, 90, 50, 10], "256": [120, 100, 60, 20], "512": [130, 110, 70, 30] },
    lk: { "64": [40, 20, 5, 5], "256": [50, 30, 10, 5], "512": [60, 40, 20, 10] } },
  ip11: { un: { "64": [65, 45, 25, 5], "128": [75, 55, 35, 10], "256": [85, 65, 45, 20] },
    lk: { "64": [40, 20, 5, 5], "128": [50, 30, 10, 5], "256": [60, 40, 20, 10] }, sealedLk: { "64": 35, "128": 35 } },
};

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
