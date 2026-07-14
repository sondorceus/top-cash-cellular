// =========================================================================
// PRICE DATA
// =========================================================================
// Extracted from app/page.tsx 2026-05-18 so the admin UI (/admin/prices)
// and API routes can read/write the price grid without parsing the React
// component. The customer funnel imports these constants directly; an
// admin can override individual cells via /api/admin/prices, which writes
// to Vercel Blob — the funnel merges those overrides at request time.
// =========================================================================

export const CARRIER_DEDUCTIONS: Record<string, Record<string, number>> = {
  // 2026-07-14 buyer-sheet recab (Skywalker-approved): gaps on 16e, 15/14/13
  // (except ip13), 12 and 11 families raised so every LOCKED offer lands at
  // least $15 under the wholesale buyer sheet's locked A/B/C/D prices —
  // locked phones exit through that sheet, and the old $15-60 gaps had us
  // quoting up to $146 OVER it (worst: locked mint 16e 512, $321 vs $175).
  // The gap absorbs the unlocked-over-sheet allowance too, so low storage
  // tiers land deeper under the sheet than $15 — a flat per-model gap can't
  // fit every tier; hand-tune per-cell via /admin/prices where volume
  // justifies it. Many locked legacy broken/fair cells now fall under
  // MIN_OFFER → manual review, matching the sheet's $5-30 reality there.
  // Checker: scripts/check-buyer-sheet.mjs. ip13 intentionally untouched
  // (Sonny's live locked calibration 2026-07-11).
  //
  // T-MOBILE/ATT SPLIT (Skywalker 2026-07-14, "for tmobile we can pay extra
  // 25 on each phone, -35 on att, all newer ones"): every 14-family-and-newer
  // model quotes T-Mobile locked $25 ABOVE its sheet-derived baseline
  // (T-Mobile units unlock easily; the buyer sheet itself pays a T-Mobile
  // premium on new stock) and AT&T locked $35 BELOW it — implemented as
  // tmobile = base−25, att = base+35. The checker allows T-Mobile up to $25
  // over the sheet's locked column on these models.
  // iPhone 17 family — Atlas Mobile wholesale carrier-gap (NIB Sealed
  // Unlocked − Locked). "Other" = gap + $100 per Skywalker's rule.
  // Verizon and Unlocked: no entry → defaults to $0 deduction.
  // ip17pm/ip17p stay zeroed here — their gaps are CONDITION-DEPENDENT and
  // live in CARRIER_GAPS_BY_COND below (Skywalker 2026-07-12: zeroed flat
  // gaps meant a T-Mobile broken 17PM paid the full unlocked $342 while
  // IWM pays $300 locked).
  ip17pm: { att: 0, tmobile: 0, other: 0 },
  ip17p:  { att: 0, tmobile: 0, other: 0 },
  // ip17air zeroed 2026-07-14 (owner: "we are paying way too low for 17
  // air — do 100 below itsworth for the air"). The old flat 355 gap was
  // sized on the SEALED Atlas gap and crushed used-locked Airs to $170-330
  // while IWM pays $380-540 locked. Condition-dependent gaps mirroring
  // IWM's own carrier deltas live in CARRIER_GAPS_BY_COND below.
  ip17air: { att: 0, tmobile: 0, other: 0 },
  ip17:   { att: 230, tmobile: 170, other: 295 },
  ip17e:  { att: 235, tmobile: 175, other: 300 },
  // iPhone 16 series
  ip16pm: { att: 155, tmobile: 80, other: 500 },
  ip16p:  { att: 135, tmobile: 65, other: 400 },
  ip16plus: { att: 115, tmobile: 55, other: 300 },
  ip16:   { att: 115, tmobile: 55, other: 300 },
  ip16e:  { att: 246, tmobile: 186, other: 311 },
  // iPhone 15 series
  ip15pm: { att: 135, tmobile: 75, other: 400 },
  ip15p:  { att: 178, tmobile: 118, other: 243 },
  ip15plus: { att: 168, tmobile: 108, other: 233 },
  ip15:   { att: 176, tmobile: 116, other: 241 },
  // iPhone 14 series
  ip14pm: { att: 171, tmobile: 111, other: 236 },
  ip14p:  { att: 124, tmobile: 64, other: 189 },
  ip14plus: { att: 165, tmobile: 105, other: 230 },
  ip14:   { att: 193, tmobile: 133, other: 258 },
  // iPhone 13 series
  ip13pm: { att: 112, tmobile: 112, other: 212 },
  ip13p:  { att: 116, tmobile: 116, other: 216 },
  // ip13 att raised over tmobile 2026-07-11 — Sonny: "ATT and Verizon are a
  // bit lower right now because of locking issues" (verizon-locked falls back
  // to the att gap). T-Mobile 50 lands his exact $120 locked number.
  ip13:   { att: 55, tmobile: 50, other: 70 },
  // Older iPhones — buyer-sheet locked prices crater on these (a locked
  // 12 Pro Max B-grade is $80 there), hence the big gaps.
  ip12pm: { att: 166, tmobile: 166, other: 266 },
  ip12p:  { att: 151, tmobile: 151, other: 251 },
  ip12:   { att: 124, tmobile: 124, other: 224 },
  ip11pm: { att: 151, tmobile: 151, other: 251 },
  ip11p:  { att: 135, tmobile: 135, other: 235 },
  ip11:   { att: 106, tmobile: 106, other: 206 },
  // Samsung S series
  gs26u:  { att: 90, tmobile: 125, other: 200 },
  gs25u:  { att: 90, tmobile: 125, other: 200 },
  gs24u:  { att: 80, tmobile: 100, other: 150 },
  gs23u:  { att: 50, tmobile: 70, other: 100 },
  gs26p:  { att: 80, tmobile: 100, other: 150 },
  gs25p:  { att: 70, tmobile: 100, other: 150 },
  gs26:   { att: 60, tmobile: 80, other: 100 },
  gs25:   { att: 50, tmobile: 70, other: 100 },
  gs24:   { att: 40, tmobile: 50, other: 80 },
  // Samsung Z series
  gzfold7: { att: 80, tmobile: 100, other: 200 },
  gzfold6: { att: 60, tmobile: 80, other: 150 },
  gzflip7: { att: 50, tmobile: 70, other: 100 },
  gzflip6: { att: 40, tmobile: 50, other: 80 },
  // Galaxy Note series
  gnote10:    { att: 40, tmobile: 60, other: 100 },
  gnote10p:   { att: 40, tmobile: 60, other: 100 },
  gnote10p5g: { att: 40, tmobile: 60, other: 100 },
  gnote20:    { att: 20, tmobile: 30, other: 50 },
  gnote9:     { att: 20, tmobile: 30, other: 50 },
  // Galaxy S20 series
  gs20:   { att: 20, tmobile: 30, other: 50 },
  gs20fe: { att: 20, tmobile: 30, other: 50 },
  gs20p:  { att: 20, tmobile: 30, other: 50 },
  gs20u:  { att: 40, tmobile: 60, other: 100 },
  // Galaxy S21 series
  gs21:   { att: 20, tmobile: 30, other: 50 },
  gs21fe: { att: 20, tmobile: 30, other: 50 },
  gs21p:  { att: 20, tmobile: 30, other: 50 },
  gs21u:  { att: 20, tmobile: 30, other: 50 },
  // Galaxy S22 series
  gs22:   { att: 20, tmobile: 30, other: 50 },
  gs22p:  { att: 20, tmobile: 30, other: 50 },
  gs22u:  { att: 40, tmobile: 60, other: 100 },
  // Galaxy S23 series
  gs23:   { att: 40, tmobile: 60, other: 100 },
  gs23fe: { att: 20, tmobile: 30, other: 50 },
  gs23p:  { att: 40, tmobile: 60, other: 100 },
  // Galaxy S24/S25 additions
  gs24fe: { att: 40, tmobile: 60, other: 100 },
  gs24p:  { att: 40, tmobile: 60, other: 100 },
  gs25edge: { att: 60, tmobile: 80, other: 150 },
  gs25fe: { att: 40, tmobile: 60, other: 100 },
  // Galaxy Z Flip older
  gzflip3: { att: 20, tmobile: 30, other: 50 },
  gzflip4: { att: 20, tmobile: 30, other: 50 },
  gzflip5: { att: 40, tmobile: 60, other: 100 },
  // Galaxy Z Fold older
  gzfold3: { att: 40, tmobile: 60, other: 100 },
  gzfold4: { att: 40, tmobile: 60, other: 100 },
  gzfold5: { att: 40, tmobile: 60, other: 100 },
  gztrifold: { att: 100, tmobile: 120, other: 400 },
  // iPhone mini models
  ip12mini: { att: 99, tmobile: 99, other: 199 },
  ip13mini: { att: 165, tmobile: 165, other: 265 },
  // Pixel 10 series
  px10:    { att: 40, tmobile: 60, other: 100 },
  px10a:   { att: 40, tmobile: 60, other: 100 },
  px10p:   { att: 60, tmobile: 80, other: 150 },
  px10pxl: { att: 60, tmobile: 80, other: 150 },
  // Pixel older models
  px5:  { att: 20, tmobile: 30, other: 50 },
  px5a: { att: 20, tmobile: 30, other: 50 },
  px6:  { att: 20, tmobile: 30, other: 50 },
  px6p: { att: 20, tmobile: 30, other: 50 },
  px7:  { att: 20, tmobile: 30, other: 50 },
  px7a: { att: 20, tmobile: 30, other: 50 },
  px7p: { att: 40, tmobile: 60, other: 100 },
  px8:  { att: 40, tmobile: 60, other: 100 },
  px8a: { att: 40, tmobile: 60, other: 100 },
  px8p: { att: 40, tmobile: 60, other: 100 },
  px9:  { att: 40, tmobile: 60, other: 100 },
  px9a: { att: 40, tmobile: 60, other: 100 },
  px9p: { att: 40, tmobile: 60, other: 100 },
  px9pfold: { att: 60, tmobile: 80, other: 150 },
  px9pxl: { att: 40, tmobile: 60, other: 100 },
  pxfold: { att: 40, tmobile: 60, other: 100 } };

// Condition-dependent carrier gaps for models where one flat number can't
// work (Skywalker 2026-07-12). The 17 Pro/Pro Max flat gaps were zeroed for
// the sealed unlocked-Atlas play, which silently paid FULL unlocked price
// for locked units in every condition — a T-Mobile broken 17PM quoted $342
// vs IWM's $300, and a locked 2TB sealed quoted $1250 against Atlas's $1090
// locked exit (a guaranteed loss). Gaps below mirror IWM's live per-section
// carrier deltas (scraped 2026-07-12):
//   used  = flawless/good/fair sections; broken = broken section.
// Sealed + locked uses PER-STORAGE gaps (sealedLocked): the Atlas NIB locked
// sheet doesn't scale with storage the way unlocked does, so the gap runs
// $190 (256GB) to $410 (2TB) on the 17PM. Each gap is sized so the locked
// sealed OFFER = Atlas NIB locked − $250 — the same flat-profit play the
// unlocked sealed ladder runs against the unlocked sheet (owner 2026-07-12:
// "we can get a price for it" — was briefly manual-review). A storage tier
// missing from sealedLocked still falls back to manual review. "Other"
// carrier docks the sealed gap + $100 (owner's other = gap + $100 rule).
// Verizon: unlocked pays full; locked falls back to the att gap (same rule
// as CARRIER_DEDUCTIONS).
export type CondCarrierGaps = {
  used: Record<string, number>;
  broken: Record<string, number>;
  // storage id -> $ gap for att/tmobile/verizon-locked on SEALED units.
  sealedLocked: Record<string, number>;
};
export const CARRIER_GAPS_BY_COND: Record<string, CondCarrierGaps> = {
  ip17pm: {
    used: { att: 155, tmobile: 80, other: 500 },
    broken: { att: 135, tmobile: 50, other: 250 },
    // With the 2026-07-14 sheet−80 sealed cells (865/1070/1250/1400) these
    // gaps land locked-sealed offers at 700/900/955/1015 — under the buyer
    // sheet's locked sealed (780/920/1030/1115 min-color) by 80/20/75/100.
    sealedLocked: { "256": 190, "512": 195, "1tb": 320, "2tb": 410 },
  },
  // ip17air (owner 2026-07-14: Air anchors to ItsWorthMore − $100, NOT the
  // buyer sheet — the sheet craters on Airs and they exit elsewhere). Gaps
  // mirror IWM's live carrier deltas (scraped 2026-07-14: used AT&T −100
  // −100 unlock-question, T-Mobile −125 −100; broken −50/−75 + −50; sealed
  // −50/−75 + −300) with the standing tmo +25 / att −35 split applied.
  // Unlocked cells already sit within $100 of IWM (mint −45/−5/+20 by
  // tier) so they stay put; these gaps land locked offers at IWM−20 to
  // IWM−80 — well inside the owner's floor. 1TB used-locked runs slightly
  // over the buyer sheet's locked column: accepted (see checker).
  ip17air: {
    used: { att: 235, tmobile: 200, other: 450 },
    broken: { att: 135, tmobile: 100, other: 150 },
    sealedLocked: { "256": 390, "512": 390, "1tb": 390 },
  },
  ip17p: {
    used: { att: 185, tmobile: 50, other: 450 },
    broken: { att: 85, tmobile: 50, other: 200 },
    // unlocked sealed offers 610/665/720 − gaps = 450/580/670
    // = Atlas NIB locked (700/830/920) − $250.
    sealedLocked: { "256": 160, "512": 85, "1tb": 50 },
  },
};

// Resolve the carrier gap for a (model, carrier, condition, storage).
// Returns null when the model has no condition-dependent entry (callers
// fall back to the flat CARRIER_DEDUCTIONS). `manual: true` means don't
// auto-quote this combo (sealed+locked on a storage tier with no gap).
export function carrierGapForCondition(
  modelId: string,
  carrier: string | undefined,
  conditionId: string | undefined,
  verizonLocked: boolean,
  storageId?: string | undefined,
): { gap: number; manual: boolean } | null {
  const m = CARRIER_GAPS_BY_COND[modelId];
  if (!m) return null;
  const c = carrier === "verizon" ? (verizonLocked ? "att" : "unlocked") : (carrier || "unlocked");
  if (c === "unlocked") return { gap: 0, manual: false };
  if (conditionId === "sealed") {
    const g = storageId != null ? m.sealedLocked[storageId] : undefined;
    if (g === undefined) return { gap: 0, manual: true };
    return { gap: c === "other" ? g + 100 : g, manual: false };
  }
  const tier = conditionId === "broken" ? m.broken : m.used;
  return { gap: tier[c] ?? tier.att ?? 0, manual: false };
}

// Minimum offer threshold — below this we lose money on shipping + processing.
// Devices below this get "Manual review & custom quote" instead of a dollar amount.
export const MIN_OFFER = 25;

// Sealed (brand-new, unopened) devices resell as new and TCC always pays a flat
// premium over a like-new (mint) unit for them (owner rule 2026-07-06: "always
// an extra 40-50 for sealed"). The per-cell `sealed` column in PRICE_TABLE is
// inconsistent (deltas over mint ranged −7 to +465), so the engine ignores it
// and derives sealed = mint price + SEALED_PREMIUM, guaranteed past the resell
// margin cap. Midpoint of the owner's 40-50 range.
export const SEALED_PREMIUM = 45;

// High-value devices that require manual review before payout.
// Quote is shown to customer but backend flags the lead for owner approval.
export const MANUAL_REVIEW_DEVICES = new Set([
  "macstudiom4m", "macprom2u", "macstudiom4u",
  "mbp14m3", "mbp16m3", "mbp16_m5pmax_2026",
  "macstudiom2m", "mbp16m4", "mba_m5_2026",
  "macstudiom2u", "macminim4", "gztrifold",
]);

export const PRICE_TABLE: Record<string, Record<string, Record<string, number>>> = {
  ip11: {
    "128": { broken: 1, fair: 72, good: 90, mint: 104, sealed: 130 },
    "256": { broken: 1, fair: 86, good: 104, mint: 117, sealed: 144 },
    "64": { broken: 1, fair: 40, good: 58, mint: 72, sealed: 117 } },
  ip11p: {
    "256": { broken: 1, fair: 86, good: 112, mint: 126, sealed: 162 },
    "512": { broken: 2, fair: 108, good: 135, mint: 148, sealed: 180 },
    "64": { broken: 1, fair: 58, good: 86, mint: 99, sealed: 135 } },
  ip11pm: {
    "256": { broken: 17, fair: 126, good: 153, mint: 171, sealed: 220 },
    "512": { broken: 20, fair: 144, good: 171, mint: 189, sealed: 225 },
    "64": { broken: 15, fair: 122, good: 148, mint: 166, sealed: 212 } },
  ip12: {
    "128": { broken: 22, fair: 86, good: 112, mint: 130, sealed: 153 },
    "256": { broken: 23, fair: 99, good: 126, mint: 144, sealed: 158 },
    "64": { broken: 20, fair: 58, good: 86, mint: 104, sealed: 144 } },
  ip12mini: {
    "128": { broken: 1, fair: 63, good: 86, mint: 99, sealed: 112 },
    "256": { broken: 1, fair: 68, good: 90, mint: 104, sealed: 117 },
    "64": { broken: 1, fair: 36, good: 58, mint: 72, sealed: 108 } },
  ip12p: {
    "128": { broken: 20, fair: 90, good: 135, mint: 153, sealed: 207 },
    "256": { broken: 25, fair: 126, good: 171, mint: 189, sealed: 220 },
    "512": { broken: 26, fair: 126, good: 171, mint: 189, sealed: 230 } },
  ip12pm: {
    "128": { broken: 38, fair: 130, good: 184, mint: 198, sealed: 252 },
    "256": { broken: 40, fair: 148, good: 202, mint: 216, sealed: 288 },
    "512": { broken: 43, fair: 162, good: 216, mint: 230, sealed: 315 } },
  // ip13 recalibrated 2026-07-11 to Sonny's live payouts (he corrected a bot
  // quote to "170 unlocked / 120 locked" for a good one — Damian thread):
  // good 128 + the $25 phone bonus lands exactly on $170 unlocked / $120
  // T-Mobile. Resell comp raised in lockstep so the margin cap clears.
  ip13: {
    "128": { broken: 20, fair: 115, good: 145, mint: 158, sealed: 190 },
    "256": { broken: 25, fair: 122, good: 152, mint: 165, sealed: 218 },
    "512": { broken: 29, fair: 128, good: 160, mint: 173, sealed: 238 } },
  ip13mini: {
    "128": { broken: 20, fair: 76, good: 124, mint: 137, sealed: 180 },
    "256": { broken: 25, fair: 104, good: 152, mint: 165, sealed: 190 },
    "512": { broken: 26, fair: 124, good: 171, mint: 185, sealed: 215 } },
  ip13p: {
    "128": { broken: 33, fair: 128, good: 192, mint: 194, sealed: 217 },
    "1tb": { broken: 43, fair: 158, good: 230, mint: 232, sealed: 255 },
    "256": { broken: 38, fair: 141, good: 209, mint: 211, sealed: 234 },
    "512": { broken: 40, fair: 158, good: 221, mint: 224, sealed: 247 } },
  ip13pm: {
    "128": { broken: 51, fair: 162, good: 230, mint: 232, sealed: 255 },
    "1tb": { broken: 65, fair: 230, good: 277, mint: 279, sealed: 305 },
    "256": { broken: 56, fair: 175, good: 247, mint: 249, sealed: 273 },
    "512": { broken: 61, fair: 192, good: 264, mint: 266, sealed: 289 } },
  ip14: {
    "128": { broken: 29, fair: 104, good: 144, mint: 166, sealed: 212 },
    "256": { broken: 33, fair: 135, good: 176, mint: 198, sealed: 234 },
    "512": { broken: 35, fair: 202, good: 243, mint: 266, sealed: 256 } },
  ip14p: {
    "128": { broken: 87, fair: 184, good: 238, mint: 284, sealed: 306 },
    "1tb": { broken: 105, fair: 256, good: 310, mint: 356, sealed: 360 },
    "256": { broken: 97, fair: 212, good: 266, mint: 310, sealed: 328 },
    "512": { broken: 101, fair: 238, good: 292, mint: 338, sealed: 342 } },
  ip14plus: {
    "128": { broken: 61, fair: 135, good: 171, mint: 198, sealed: 234 },
    "256": { broken: 65, fair: 171, good: 207, mint: 234, sealed: 279 },
    "512": { broken: 69, fair: 189, good: 225, mint: 252, sealed: 302 } },
  ip14pm: {
    "128": { broken: 119, fair: 248, good: 302, mint: 351, sealed: 378 },
    "1tb": { broken: 173, fair: 320, good: 374, mint: 423, sealed: 432 },
    "256": { broken: 137, fair: 266, good: 320, mint: 369, sealed: 405 },
    "512": { broken: 155, fair: 292, good: 346, mint: 396, sealed: 414 } },
  ip15: {
    "128": { broken: 65, fair: 194, good: 230, mint: 215, sealed: 310 },
    "256": { broken: 74, fair: 230, good: 266, mint: 232, sealed: 356 },
    "512": { broken: 79, fair: 256, good: 292, mint: 249, sealed: 400 } },
  ip15p: {
    "128": { broken: 146, fair: 266, good: 310, mint: 283, sealed: 392 },
    "1tb": { broken: 191, fair: 374, good: 418, mint: 334, sealed: 504 },
    "256": { broken: 164, fair: 310, good: 356, mint: 300, sealed: 436 },
    "512": { broken: 173, fair: 338, good: 382, mint: 317, sealed: 459 } },
  ip15plus: {
    "128": { broken: 105, fair: 216, good: 252, mint: 232, sealed: 378 },
    "256": { broken: 115, fair: 238, good: 274, mint: 249, sealed: 423 },
    "512": { broken: 123, fair: 288, good: 324, mint: 266, sealed: 446 } },
  ip15pm: {
    "1tb": { broken: 155, fair: 414, good: 472, mint: 394, sealed: 544 },
    "256": { broken: 137, fair: 342, good: 400, mint: 360, sealed: 500 },
    "512": { broken: 146, fair: 374, good: 432, mint: 376, sealed: 522 } },
  ip16: {
    // 128 broken: owner's exact number 2026-07-12 ("I can pay 158 for
    // standard 128gb") — offer $158 = cell 133 + $25 bonus.
    "128": { broken: 133, fair: 292, good: 346, mint: 317, sealed: 464 },
    "256": { broken: 173, fair: 328, good: 382, mint: 338, sealed: 513 },
    "512": { broken: 209, fair: 356, good: 410, mint: 355, sealed: 562 } },
  ip16e: {
    // Sealed + 128/256 mint trimmed 2026-07-14: buyer-sheet check had sealed
    // offers $5-26 OVER the sheet's sealed unlocked (305/365/425) and mint
    // over the open-activated price (sealed − 50) — new/open-box stock
    // wholesales through that sheet, so those must stay under ("we have to
    // make sure we still under them"). Offers now land $5 under.
    "128": { broken: 38, fair: 144, good: 202, mint: 225, sealed: 275 },
    "256": { broken: 56, fair: 207, good: 266, mint: 285, sealed: 335 },
    "512": { broken: 74, fair: 252, good: 310, mint: 346, sealed: 395 } },
  ip16p: {
    // Broken to IWM-parity targets (owner 2026-07-12, same directive as
    // 16PM). Offers pin at the broken margin cap (~$230 on the fresh $640
    // eBay comp) and climb automatically if the comp rises.
    "128": { broken: 250, fair: 338, good: 414, mint: 419, sealed: 477 },
    // 1TB sealed capped down from 646 → 478 (= resell $638 × MARGIN_FLOOR_MULT 0.75)
    // to stop bait-and-switch: runtime clipped 646 silently. 2026-05-24.
    "1tb": { broken: 325, fair: 472, good: 549, mint: 470, sealed: 612 },
    "256": { broken: 260, fair: 382, good: 459, mint: 440, sealed: 522 },
    "512": { broken: 300, fair: 418, good: 495, mint: 457, sealed: 567 } },
  ip16plus: {
    // Broken to IWM-parity targets (owner 2026-07-12). Fresh $515 eBay comp
    // (n=40) lifts the broken cap to ~$185 — offers rise from the old $153.
    "128": { broken: 190, fair: 338, good: 382, mint: 355, sealed: 446 },
    "256": { broken: 230, fair: 374, good: 418, mint: 381, sealed: 490 },
    "512": { broken: 270, fair: 405, good: 450, mint: 406, sealed: 536 } },
  ip16pm: {
    // 1TB sealed capped 874 → 540 (= resell $721 × 0.75 MARGIN_FLOOR). 2026-05-24.
    // Broken raised to IWM PARITY (owner 2026-07-12: "I can go higher on
    // broken price for 16 pro max") — cells target IWM's 250/280/320 offers.
    // The 512/1TB pin at the margin cap (~259 on the May $721 resell comp)
    // until a fresh 16PM working comp raises it; they climb automatically.
    "1tb": { broken: 295, fair: 644, good: 684, mint: 568, sealed: 801 },
    "256": { broken: 225, fair: 518, good: 558, mint: 521, sealed: 621 },
    "512": { broken: 255, fair: 567, good: 608, mint: 542, sealed: 711 } },
  // iPhone 17 PRICE_TABLE — Atlas Mobile wholesale buy sheet minus $100
  // buffer. Unlocked headlines; per-carrier deductions live in
  // CARRIER_DEDUCTIONS above. Skywalker 2026-05-18 — replaces older
  // numbers that were under-paying on premium (Pro/Pro Max) and
  // over-paying on low-end (17/17e) relative to Atlas + buffer.
  ip17: {
    "256": { broken: 209, fair: 396, good: 459, mint: 453, sealed: 558 },
    "512": { broken: 281, fair: 486, good: 549, mint: 521, sealed: 657 } },
  // ip17air anchors to ITSWORTHMORE − $100 as a floor (owner 2026-07-14),
  // not the buyer sheet. Unlocked offers already clear that floor at every
  // cell (IWM 2026-07-14: mint 605/665/740, good 535/595/670, fair
  // 470/530/605, broken 230/310/350, sealed 695/805/875) so cells are
  // unchanged; the fix was the locked side (CARRIER_GAPS_BY_COND).
  ip17air: {
    "1tb": { broken: 290, fair: 544, good: 603, mint: 735, sealed: 788 },
    "256": { broken: 182, fair: 423, good: 482, mint: 535, sealed: 626 },
    "512": { broken: 254, fair: 477, good: 536, mint: 635, sealed: 724 } },
  ip17e: {
    "256": { broken: 65, fair: 225, good: 284, mint: 255, sealed: 374 },
    "512": { broken: 83, fair: 270, good: 328, mint: 295, sealed: 423 } },
  ip17p: {
    // Custom flat pricing (Skywalker, 2026-06): 17 Pro Max ladder minus $40 (excellent OFFER
    // $580 = base 555 + $25 bonus); +$55/tier; no carrier penalty. Broken left unchanged.
    "1tb": { broken: 389, fair: 625, good: 645, mint: 650, sealed: 695 },
    "256": { broken: 245, fair: 515, good: 535, mint: 540, sealed: 585 },
    "512": { broken: 353, fair: 570, good: 590, mint: 595, sealed: 640 } },
  ip17pm: {
    // HIGHER-BID ladder (Skywalker 2026-07-14): used offers target the
    // wholesale buyer sheet minus a flat $80 ("with the 17 pro max and
    // higher devices 75-85 below is fine") — his exit for these is that
    // sheet, cash, no fees, so thin flat margin at volume beats losing the
    // unit. cell = sheet grade − 80 − $25 popular bonus. Grades map
    // mint→A / good→B / fair→C / broken→D (sheet 2026-07-14, 2.pdf).
    // SEALED moved to the same sheet−80 rule (was the 2026-07-05
    // Atlas-NIB−$250 play, whose cells would have sat BELOW the new mint —
    // a sealed unit must never quote under an Excellent one). Sheet sealed
    // unlocked 970/1175/1355/1505 → offers 890/1095/1275/1425. Open-box
    // check: MINT offers (780/910/1010/1110) stay under the sheet's
    // open-activated prices (870/1075/1235/1355), and locked-sealed lands
    // under page-1 sealed via the existing sealedLocked gaps (thinnest:
    // 512 at $20 under). ip17pm stays OUT of RESELL_ESTIMATES so
    // none of this is clawed back by the margin cap. Locked used lands
    // ~sheet lock − 80 via CARRIER_GAPS_BY_COND.
    "1tb": { broken: 545, fair: 795, good: 905, mint: 985, sealed: 1250 },
    "256": { broken: 315, fair: 565, good: 715, mint: 755, sealed: 865 },
    "2tb": { broken: 645, fair: 895, good: 1005, mint: 1085, sealed: 1400 },
    "512": { broken: 445, fair: 695, good: 845, mint: 885, sealed: 1070 } },
  // === SAMSUNG S SERIES (10% below IWM) ===
  gs24: {
    "128": { broken: 25, fair: 117, good: 162, mint: 189, sealed: 216 },
    "256": { broken: 29, fair: 144, good: 189, mint: 216, sealed: 248 },
    "512": { fair: 117, good: 162, mint: 189, sealed: 216 } },
  gs24u: {
    "1tb": { broken: 97, fair: 360, good: 432, mint: 477, sealed: 598 },
    "256": { broken: 87, fair: 288, good: 360, mint: 405, sealed: 441 },
    "512": { broken: 92, fair: 306, good: 378, mint: 423, sealed: 508 } },
  gs25: {
    "128": { broken: 29, fair: 189, good: 238, mint: 261, sealed: 297 },
    "256": { broken: 33, fair: 225, good: 274, mint: 297, sealed: 328 },
    "512": { broken: 29, fair: 189, good: 238, mint: 261, sealed: 297 } },
  gs25p: {
    "256": { broken: 47, fair: 261, good: 306, mint: 360, sealed: 396 },
    "512": { broken: 56, fair: 315, good: 360, mint: 414, sealed: 441 } },
  gs25u: {
    "1tb": { broken: 128, fair: 486, good: 540, mint: 580, sealed: 603 },
    "256": { broken: 110, fair: 410, good: 464, mint: 504, sealed: 558 },
    "512": { broken: 119, fair: 441, good: 495, mint: 536, sealed: 580 } },
  gs26: {
    // S26 has no real 128GB tier — mirror 256 so mislabeled "128gb" listings still price right.
    "128": { broken: 65, fair: 284, good: 356, mint: 405, sealed: 450 },
    "256": { broken: 65, fair: 284, good: 356, mint: 405, sealed: 450 },
    "512": { broken: 74, fair: 306, good: 378, mint: 428, sealed: 477 } },
  gs26p: {
    "128": { broken: 83, fair: 306, good: 387, mint: 450, sealed: 495 },
    "256": { broken: 83, fair: 306, good: 387, mint: 450, sealed: 495 },
    "512": { broken: 92, fair: 342, good: 423, mint: 486, sealed: 540 } },
  gs26u: {
    "1tb": { broken: 119, fair: 500, good: 590, mint: 680, sealed: 742 },
    "128": { broken: 101, fair: 428, good: 518, mint: 608, sealed: 652 },
    "256": { broken: 101, fair: 428, good: 518, mint: 608, sealed: 652 },
    "512": { broken: 110, fair: 464, good: 554, mint: 644, sealed: 698 } },
  // === SAMSUNG Z SERIES ===
  gzflip5: {
    "256": { broken: 2, fair: 104, good: 148, mint: 176, sealed: 202 },
    "512": { broken: 7, fair: 117, good: 162, mint: 189, sealed: 248 } },
  gzflip6: {
    "256": { broken: 29, fair: 158, good: 202, mint: 238, sealed: 261 },
    "512": { broken: 38, fair: 176, good: 220, mint: 256, sealed: 306 } },
  gzflip7: {
    "256": { broken: 38, fair: 292, good: 351, mint: 387, sealed: 423 },
    "512": { broken: 51, fair: 306, good: 364, mint: 400, sealed: 468 } },
  gzfold5: {
    "1tb": { broken: 25, fair: 248, good: 292, mint: 320, sealed: 364 },
    "256": { broken: 20, fair: 212, good: 256, mint: 284, sealed: 310 },
    "512": { broken: 23, fair: 230, good: 274, mint: 302, sealed: 338 } },
  gzfold6: {
    "1tb": { broken: 74, fair: 369, good: 414, mint: 468, sealed: 504 },
    "256": { broken: 65, fair: 306, good: 351, mint: 405, sealed: 450 },
    "512": { broken: 69, fair: 342, good: 387, mint: 441, sealed: 477 } },
  gzfold7: {
    "1tb": { broken: 119, fair: 603, good: 693, mint: 738, sealed: 765 },
    "256": { broken: 110, fair: 540, good: 630, mint: 675, sealed: 711 },
    "512": { broken: 115, fair: 576, good: 666, mint: 711, sealed: 738 } },
  gztrifold: {
    "1tb": { broken: 164, fair: 945, good: 1395, mint: 1845, sealed: 2138 },
    "512": { broken: 155, fair: 900, good: 1350, mint: 1800, sealed: 2070 } },
  // === PIXEL (10% below IWM) ===
  px10pxl: {
    "1tb": { broken: 87, fair: 360, good: 414, mint: 450, sealed: 477 },
    "256": { broken: 65, fair: 315, good: 369, mint: 405, sealed: 432 },
    "512": { broken: 74, fair: 346, good: 400, mint: 436, sealed: 464 } },
  px10p: {
    "128": { broken: 43, fair: 225, good: 292, mint: 338, sealed: 369 },
    "1tb": { broken: 56, fair: 315, good: 382, mint: 428, sealed: 468 },
    "256": { broken: 47, fair: 270, good: 338, mint: 382, sealed: 428 },
    "512": { broken: 51, fair: 292, good: 360, mint: 405, sealed: 446 } },
  px10: {
    "128": { broken: 20, fair: 148, good: 207, mint: 248, sealed: 292 },
    "256": { broken: 29, fair: 166, good: 225, mint: 266, sealed: 315 } },
  px9pxl: {
    "128": { broken: 43, fair: 189, good: 243, mint: 288, sealed: 315 },
    "1tb": { broken: 49, fair: 243, good: 297, mint: 342, sealed: 396 },
    "256": { broken: 47, fair: 207, good: 261, mint: 306, sealed: 351 },
    "512": { broken: 47, fair: 225, good: 279, mint: 324, sealed: 382 } },
  px9p: {
    "128": { broken: 20, fair: 126, good: 180, mint: 216, sealed: 261 },
    "1tb": { broken: 25, fair: 194, good: 248, mint: 284, sealed: 342 },
    "256": { broken: 22, fair: 153, good: 207, mint: 243, sealed: 297 },
    "512": { broken: 24, fair: 171, good: 225, mint: 261, sealed: 328 } },
  px9: {
    "128": { broken: 15, fair: 112, good: 153, mint: 198, sealed: 225 },
    "256": { broken: 20, fair: 130, good: 171, mint: 216, sealed: 248 } },
  px8p: {
    "128": { broken: 7, fair: 112, good: 144, mint: 184, sealed: 207 },
    "1tb": { broken: 11, fair: 148, good: 180, mint: 220, sealed: 274 },
    "256": { broken: 8, fair: 122, good: 153, mint: 194, sealed: 243 },
    "512": { broken: 9, fair: 140, good: 171, mint: 212, sealed: 261 } },
  // === CONSOLES (10% below IWM) ===
  ps5pro: {
    "base": { broken: 8, fair: 432, good: 513, mint: 585, sealed: 621 } },
  ps5slim: {
    "base": { broken: 8, fair: 234, good: 284, mint: 338, sealed: 369 } },
  ps5: {
    "base": { broken: 8, fair: 234, good: 306, mint: 360, sealed: 396 } },
  nsw2: {
    "base": { broken: 45, fair: 162, good: 207, mint: 252, sealed: 288 } },
  nswoled: {
    "base": { broken: 21, fair: 45, good: 90, mint: 126, sealed: 148 } },
  // === AUDIT FIXES — devices that were >15% off with multiplier fallback ===
  gs23u: {
    "1tb": { broken: 8, fair: 212, good: 261, mint: 292, sealed: 310 },
    "256": { broken: 7, fair: 158, good: 207, mint: 238, sealed: 266 },
    "512": { broken: 7, fair: 176, good: 225, mint: 256, sealed: 288 } },
  gs22: {
    "128": { broken: 1, fair: 36, good: 58, mint: 72, sealed: 117 },
    "256": { broken: 1, fair: 45, good: 68, mint: 81, sealed: 135 } },
  gzflip4: {
    "128": { broken: 1, fair: 9, good: 27, mint: 36, sealed: 50 },
    "256": { broken: 1, fair: 14, good: 32, mint: 40, sealed: 54 },
    "512": { broken: 1, fair: 14, good: 32, mint: 40, sealed: 58 } },
  px8: {
    "128": { broken: 1, fair: 68, good: 108, mint: 126, sealed: 166 },
    "256": { broken: 2, fair: 90, good: 130, mint: 148, sealed: 189 } },
  // === AUDIT ROUND 2 — 5 more devices with >15% multiplier error ===
  gs24p: {
    "256": { broken: 47, fair: 144, good: 198, mint: 230, sealed: 266 },
    "512": { broken: 56, fair: 171, good: 225, mint: 256, sealed: 310 } },
  gs21: {
    "128": { broken: 1, fair: 27, good: 36, mint: 50, sealed: 94 },
    "256": { broken: 1, fair: 36, good: 45, mint: 58, sealed: 112 } },
  px7p: {
    "128": { broken: 1, fair: 45, good: 72, mint: 108, sealed: 153 },
    "256": { broken: 2, fair: 58, good: 86, mint: 122, sealed: 162 },
    "512": { broken: 4, fair: 63, good: 90, mint: 126, sealed: 166 } },
  gs20: {
    "base": { broken: 1, fair: 45, good: 58, mint: 68, sealed: 99 } },
  // === FULL IWM SCRAPE — all remaining devices ===
  gnote10: {
    // Note 10 is 256GB-only. Prices = live IWM payout × 0.90 (house rule),
    // scraped 2026-06-19: Broken $10 / Fair $45 / Good $70 / Flawless $80 /
    // Brand New $110. mint=Flawless, sealed=Brand New. (Replaces a malformed
    // entry whose inner keys were condition grades, not storage tiers, so
    // every Note 10 quote was silently falling back to the multiplier path.)
    "256": { broken: 9, fair: 50, good: 72, mint: 81, sealed: 112 } },
  gnote10p: {
    "256": { broken: 13, fair: 45, good: 99, mint: 117, sealed: 148 },
    "512": { broken: 32, fair: 54, good: 108, mint: 126, sealed: 172 } },
  gnote10p5g: {
    "256": { broken: 20, fair: 45, good: 99, mint: 117, sealed: 153 },
    "512": { broken: 29, fair: 58, good: 112, mint: 130, sealed: 176 } },
  gnote20: {
    "128": { broken: 1, fair: 68, good: 81, mint: 90, sealed: 117 },
    "256": { broken: 2, fair: 76, good: 90, mint: 99, sealed: 130 } },
  gnote9: {
    "128": { broken: 1, fair: 27, good: 54, mint: 68, sealed: 113 },
    "512": { broken: 1, fair: 36, good: 63, mint: 76, sealed: 132 } },
  gs20fe: {
    "128": { broken: 1, fair: 22, good: 36, mint: 45, sealed: 90 },
    "256": { broken: 1, fair: 32, good: 45, mint: 54, sealed: 108 } },
  gs20p: {
    "128": { broken: 1, fair: 36, good: 68, mint: 76, sealed: 104 },
    "512": { broken: 1, fair: 58, good: 90, mint: 99, sealed: 130 } },
  gs20u: {
    "128": { broken: 1, fair: 68, good: 104, mint: 122, sealed: 184 },
    "256": { broken: 1, fair: 76, good: 112, mint: 130, sealed: 194 },
    "512": { broken: 2, fair: 86, good: 122, mint: 140, sealed: 202 } },
  gs21fe: {
    "128": { broken: 1, fair: 22, good: 27, mint: 36, sealed: 54 },
    "256": { broken: 1, fair: 32, good: 36, mint: 45, sealed: 72 } },
  gs21p: {
    "128": { broken: 1, fair: 36, good: 54, mint: 63, sealed: 117 },
    "256": { broken: 1, fair: 45, good: 63, mint: 72, sealed: 145 } },
  gs21u: {
    "128": { broken: 1, fair: 54, good: 72, mint: 81, sealed: 126 },
    "256": { broken: 1, fair: 63, good: 81, mint: 90, sealed: 135 },
    "512": { broken: 1, fair: 68, good: 86, mint: 94, sealed: 140 } },
  gs22p: {
    "128": { broken: 2, fair: 63, good: 86, mint: 99, sealed: 171 },
    "256": { broken: 7, fair: 72, good: 94, mint: 108, sealed: 194 } },
  gs22u: {
    "128": { broken: 2, fair: 76, good: 108, mint: 126, sealed: 162 },
    "1tb": { broken: 2, fair: 99, good: 130, mint: 148, sealed: 280 },
    "256": { broken: 2, fair: 90, good: 122, mint: 140, sealed: 204 },
    "512": { broken: 2, fair: 94, good: 126, mint: 144, sealed: 242 } },
  gs23: {
    "128": { broken: 1, fair: 63, good: 90, mint: 108, sealed: 162 },
    "256": { broken: 1, fair: 81, good: 108, mint: 126, sealed: 194 },
    "512": { broken: 1, fair: 86, good: 112, mint: 130, sealed: 207 } },
  gs23fe: {
    "128": { broken: 1, fair: 32, good: 63, mint: 81, sealed: 108 },
    "256": { broken: 1, fair: 40, good: 72, mint: 90, sealed: 126 } },
  gs23p: {
    "128": { broken: 20, sealed: 198 },
    "256": { broken: 25, fair: 90, good: 126, mint: 144, sealed: 225 },
    "512": { broken: 26, fair: 99, good: 135, mint: 153, sealed: 243 } },
  gs24fe: {
    "128": { broken: 2, fair: 72, good: 117, mint: 135, sealed: 189 },
    "256": { broken: 11, fair: 90, good: 135, mint: 153, sealed: 207 } },
  gs25edge: {
    "256": { broken: 65, fair: 234, good: 279, mint: 315, sealed: 351 },
    "512": { broken: 74, fair: 256, good: 302, mint: 338, sealed: 382 } },
  gs25fe: {
    "128": { broken: 11, fair: 72, good: 194, mint: 220, sealed: 274 },
    "256": { broken: 20, fair: 90, good: 212, mint: 238, sealed: 292 },
    // 512GB filled in 2026-05-24 — previously only had broken/sealed which
    // returned undefined for fair/good/mint and crashed quote generation.
    // Interpolated from the 256GB row + a ~10% storage uplift.
    "512": { broken: 11, fair: 9, good: 230, mint: 256, sealed: 274 } },
  gzflip3: {
    "128": { broken: 1, fair: 14, good: 27, mint: 36, sealed: 58 },
    "256": { broken: 1, fair: 22, good: 36, mint: 45, sealed: 72 } },
  gzfold3: {
    "256": { broken: 1, fair: 72, good: 108, mint: 126, sealed: 153 },
    "512": { broken: 2, fair: 86, good: 122, mint: 140, sealed: 180 } },
  gzfold4: {
    "1tb": { broken: 2, fair: 144, good: 189, mint: 220, sealed: 270 },
    "256": { broken: 1, fair: 112, good: 158, mint: 189, sealed: 216 },
    "512": { broken: 1, fair: 130, good: 176, mint: 207, sealed: 243 } },
  ipad11: {
    "128": { broken: 32, fair: 81, good: 112, mint: 135, sealed: 162 },
    "256": { broken: 45, fair: 117, good: 148, mint: 171, sealed: 207 },
    "512": { broken: 58, fair: 171, good: 202, mint: 225, sealed: 297 } },
  ipad10: {
    "256": { broken: 32, fair: 99, good: 135, mint: 162, sealed: 198 },
    "64": { broken: 22, fair: 63, good: 99, mint: 126, sealed: 153 } },
  ipad9: {
    "256": { broken: 13, fair: 40, good: 72, mint: 81, sealed: 94 },
    "64": { broken: 9, fair: 27, good: 58, mint: 68, sealed: 86 } },
  ipadair11m2: {
    "128": { broken: 72, fair: 166, good: 212, mint: 243, sealed: 270 },
    "1tb": { broken: 108, fair: 302, good: 346, mint: 378, sealed: 405 },
    "256": { broken: 81, fair: 194, good: 238, mint: 270, sealed: 315 },
    "512": { broken: 94, fair: 248, good: 292, mint: 324, sealed: 360 } },
  ipadair11m3: {
    "128": { broken: 76, fair: 158, good: 216, mint: 261, sealed: 288 },
    "1tb": { broken: 90, fair: 274, good: 333, mint: 378, sealed: 423 },
    "256": { broken: 81, fair: 166, good: 225, mint: 270, sealed: 310 },
    "512": { broken: 86, fair: 212, good: 270, mint: 315, sealed: 356 } },
  ipadair13m2: {
    "128": { broken: 94, fair: 230, good: 274, mint: 320, sealed: 356 },
    "1tb": { broken: 135, fair: 364, good: 410, mint: 454, sealed: 446 },
    "256": { broken: 117, fair: 274, good: 320, mint: 364, sealed: 400 },
    "512": { broken: 126, fair: 320, good: 364, mint: 410, sealed: 423 } },
  ipadair13m3: {
    "128": { broken: 135, fair: 252, good: 306, mint: 360, sealed: 387 },
    "1tb": { broken: 158, fair: 364, good: 418, mint: 472, sealed: 612 },
    "256": { broken: 144, fair: 270, good: 324, mint: 378, sealed: 432 },
    "512": { broken: 148, fair: 302, good: 356, mint: 410, sealed: 522 } },
  ipadair11m4: {
    "128": { broken: 112, fair: 184, good: 252, mint: 297, sealed: 324 },
    "1tb": { broken: 180, fair: 328, good: 396, mint: 441, sealed: 504 },
    "256": { broken: 135, fair: 220, good: 288, mint: 333, sealed: 369 },
    "512": { broken: 158, fair: 256, good: 324, mint: 369, sealed: 414 } },
  ipadair13m4: {
    "128": { broken: 135, fair: 306, good: 382, mint: 423, sealed: 450 },
    "1tb": { broken: 189, fair: 450, good: 526, mint: 567, sealed: 675 },
    "256": { broken: 153, fair: 342, good: 418, mint: 459, sealed: 495 },
    "512": { broken: 171, fair: 378, good: 454, mint: 495, sealed: 585 } },
  ipadmini6: {
    "256": { broken: 38, fair: 126, good: 162, mint: 180, sealed: 184 },
    "64": { broken: 36, fair: 90, good: 126, mint: 144, sealed: 162 } },
  ipadmini7: {
    "128": { broken: 54, fair: 162, good: 207, mint: 225, sealed: 252 },
    "256": { broken: 63, fair: 198, good: 243, mint: 261, sealed: 297 },
    "512": { broken: 72, fair: 252, good: 297, mint: 315, sealed: 387 } },
  ipadpro11g4: {
    "128": { broken: 90, fair: 238, good: 279, mint: 315, sealed: 342 },
    "1tb": { broken: 104, fair: 374, good: 414, mint: 450, sealed: 567 },
    "256": { broken: 94, fair: 284, good: 324, mint: 360, sealed: 387 },
    "2tb": { broken: 108, fair: 418, good: 459, mint: 495, sealed: 724 },
    "512": { broken: 99, fair: 306, good: 346, mint: 382, sealed: 432 } },
  ipadpro11m4: {
    "1tb": { broken: 148, fair: 486, good: 536, mint: 572, sealed: 698 },
    "256": { broken: 135, fair: 351, good: 400, mint: 436, sealed: 472 },
    "2tb": { broken: 158, fair: 554, good: 603, mint: 639, sealed: 788 },
    "512": { broken: 144, fair: 418, good: 468, mint: 504, sealed: 518 } },
  ipadpro11m5: {
    "1tb": { broken: 248, fair: 549, good: 603, mint: 657, sealed: 747 },
    "256": { broken: 158, fair: 414, good: 468, mint: 522, sealed: 567 },
    "2tb": { broken: 292, fair: 639, good: 693, mint: 747, sealed: 837 },
    "512": { broken: 202, fair: 459, good: 513, mint: 567, sealed: 612 } },
  ipadpro129g6: {
    "128": { broken: 112, fair: 220, good: 270, mint: 351, sealed: 414 },
    "1tb": { broken: 144, fair: 324, good: 374, mint: 454, sealed: 549 },
    "256": { broken: 122, fair: 256, good: 306, mint: 387, sealed: 482 },
    "2tb": { broken: 158, fair: 364, good: 414, mint: 495, sealed: 594 },
    "512": { broken: 126, fair: 274, good: 324, mint: 405, sealed: 504 } },
  ipadpro13m4: {
    "1tb": { broken: 225, fair: 490, good: 540, mint: 585, sealed: 747 },
    "256": { broken: 180, fair: 382, good: 432, mint: 477, sealed: 522 },
    "2tb": { broken: 248, fair: 590, good: 639, mint: 684, sealed: 927 },
    "512": { broken: 202, fair: 436, good: 486, mint: 531, sealed: 612 } },
  ipadpro13m5: {
    "1tb": { broken: 315, fair: 729, good: 783, mint: 855, sealed: 900 },
    "256": { broken: 248, fair: 513, good: 567, mint: 639, sealed: 675 },
    "2tb": { broken: 338, fair: 783, good: 837, mint: 909, sealed: 1035 },
    "512": { broken: 270, fair: 558, good: 612, mint: 684, sealed: 765 } },
  px10a: {
    "128": { broken: 2, fair: 99, good: 153, mint: 198, sealed: 234 },
    "256": { broken: 11, fair: 117, good: 171, mint: 216, sealed: 256 } },
  px5: {
    "base": { broken: 1, fair: 18, good: 32, mint: 40, sealed: 54 } },
  px5a: {
    // broken was 27 — ABOVE fair (22), so claiming worse condition paid more.
    // Lowered to 6 to restore the ladder, derived from the Pixel-family
    // broken/fair ratio (px5 4/18, px6 9/32 ≈ 0.22-0.28 × fair 22). Confirm. (bug fix)
    "base": { broken: 2, fair: 22, good: 45, mint: 54, sealed: 72 } },
  px6: {
    "128": { broken: 1, fair: 32, good: 45, mint: 58, sealed: 99 },
    "256": { broken: 1, fair: 40, good: 54, mint: 68, sealed: 112 } },
  px6p: {
    "128": { broken: 1, fair: 40, good: 68, mint: 81, sealed: 108 },
    "256": { broken: 1, fair: 50, good: 76, mint: 90, sealed: 112 },
    "512": { broken: 1, fair: 54, good: 81, mint: 94, sealed: 117 } },
  px7: {
    "128": { broken: 1, fair: 36, good: 45, mint: 63, sealed: 112 },
    "256": { broken: 1, fair: 45, good: 54, mint: 72, sealed: 122 } },
  px7a: {
    "base": { broken: 1, fair: 45, good: 63, mint: 72, sealed: 112 } },
  px8a: {
    "128": { broken: 1, fair: 72, good: 108, mint: 126, sealed: 176 },
    "256": { broken: 1, fair: 81, good: 117, mint: 135, sealed: 198 } },
  px9a: {
    "128": { broken: 20, fair: 90, good: 130, mint: 158, sealed: 202 },
    "256": { broken: 25, fair: 108, good: 148, mint: 176, sealed: 225 } },
  px9pfold: {
    "256": { broken: 74, fair: 292, good: 360, mint: 405, sealed: 450 },
    "512": { broken: 83, fair: 320, good: 387, mint: 432, sealed: 540 } },
  pxfold: {
    "256": { broken: 7, fair: 90, good: 135, mint: 158, sealed: 202 },
    "512": { broken: 7, fair: 126, good: 171, mint: 194, sealed: 248 } },
  switch: {
    // The "switch" variant card IS the OLED (label "Nintendo Switch OLED",
    // switch-oled.webp, base from IWM switch-oled) — but this row held plain
    // Switch money, underpaying OLED sellers ~30% vs IWM. Mirrors the
    // (card-less) nswoled row = fresh IWM switch-oled x 0.90. 2026-07-13.
    "base": { broken: 21, fair: 45, good: 90, mint: 126, sealed: 148 } },
  switchlite: {
    "base": { broken: 21, fair: 9, good: 27, mint: 36, sealed: 58 } },
  xone: {
    "base": { broken: 9, fair: 18, good: 31, mint: 49, sealed: 67 } },

  // === MACBOOKS + WATCHES + REMAINING ===
  // Apple Watch — IWM Flawless × 0.85 (watches run at 85%, tighter margin
  // than the 90% used elsewhere — Skywalker 2026-07-05). Base = aluminum /
  // GPS / smallest-case config; titanium / cellular / 46mm / band adds live
  // in APPLE_WATCH_SPECS (also × 0.85). Series 11 / SE 3 added 2026-07-05.
  awu1: {
    "base": { fair: 36, good: 86, mint: 126, sealed: 144 } },
  awu2: {
    "base": { fair: 90, good: 135, mint: 180, sealed: 216 } },
  awu3: {
    "base": { broken: 43, fair: 171, good: 252, mint: 302, sealed: 338 } },
  aws11: {
    "base": { fair: 126, good: 176, mint: 216, sealed: 252 } },
  awse3: {
    "base": { fair: 41, good: 64, mint: 82, sealed: 104 } },
  mba13m3: {
    "1tb": { fair: 320, good: 418, mint: 518, sealed: 562 },
    "2tb": { fair: 432, good: 531, mint: 630, sealed: 675 } },
  mba15m3: {
    "1tb": { fair: 342, good: 441, mint: 540, sealed: 585 },
    "2tb": { fair: 410, good: 508, mint: 608, sealed: 652 } },
  mba_m4_2025: {
    "1tb": { fair: 432, good: 531, mint: 630, sealed: 675 },
    "2tb": { fair: 544, good: 644, mint: 742, sealed: 788 } },
  mba_m5_2026: {
    "1tb": { fair: 544, good: 644, mint: 742, sealed: 788 },
    "2tb": { fair: 634, good: 734, mint: 832, sealed: 878 },
    "4tb": { fair: 837, good: 936, mint: 1035, sealed: 1080 } },
  mbp13m1: {
    "2tb": { fair: 468, good: 558, mint: 626, sealed: 675 } },
  mbp14m2: {
    "2tb": { fair: 544, good: 644, mint: 742, sealed: 788 },
    "4tb": { fair: 680, good: 778, mint: 878, sealed: 922 },
    "8tb": { fair: 860, good: 958, mint: 1058, sealed: 1102 } },
  mbp14m3: {
    "1tb": { fair: 387, good: 486, mint: 585, sealed: 630 },
    "2tb": { fair: 477, good: 576, mint: 675, sealed: 720 },
    "4tb": { fair: 747, good: 846, mint: 945, sealed: 990 },
    "512": { fair: 342, good: 441, mint: 540, sealed: 585 },
    "8tb": { fair: 1242, good: 1341, mint: 1440, sealed: 1485 } },
  mbp16_m5pmax_2026: {
    "2tb": { fair: 1782, good: 1881, mint: 1980, sealed: 2025 } },
  mbp16m2: {
    "2tb": { fair: 702, good: 801, mint: 900, sealed: 945 },
    "4tb": { fair: 927, good: 1026, mint: 1125, sealed: 1170 },
    "8tb": { fair: 1107, good: 1206, mint: 1305, sealed: 1350 } },
  mbp16m3: {
    "2tb": { fair: 927, good: 1026, mint: 1125, sealed: 1170 },
    "4tb": { fair: 1152, good: 1251, mint: 1350, sealed: 1395 },
    "8tb": { fair: 1692, good: 1791, mint: 1890, sealed: 1935 } },
  mbp16m4: {
    "2tb": { fair: 1490, good: 1588, mint: 1688, sealed: 1732 } },
  xss: {
    "base": { broken: 22, fair: 82, good: 136, mint: 181, sealed: 208 },
    "carbonblack": { broken: 22, fair: 100, good: 163, mint: 208, sealed: 239 } },
  // Apple Watch Series 7-10 / SE 2 — IWM Flawless × 0.85 (see Ultra note above).
  aws10: {
    "base": { fair: 68, good: 117, mint: 158, sealed: 194 } },
  aws7: {
    "base": { good: 28, mint: 46, sealed: 59 } },
  aws8: {
    "base": { good: 37, mint: 59, sealed: 82 } },
  aws9: {
    "base": { fair: 45, good: 76, mint: 104, sealed: 130 } },
  awse2: {
    "base": { good: 25, mint: 34, sealed: 57 } },
  mba13m2: {
    "1tb": { fair: 194, good: 292, mint: 392, sealed: 436 },
    "256": { fair: 126, good: 225, mint: 324, sealed: 369 },
    "2tb": { fair: 261, good: 360, mint: 459, sealed: 504 },
    "512": { fair: 148, good: 248, mint: 346, sealed: 392 } },
  mba15m2: {
    "1tb": { fair: 320, good: 418, mint: 518, sealed: 562 },
    "256": { fair: 252, good: 351, mint: 450, sealed: 495 },
    "2tb": { fair: 410, good: 508, mint: 608, sealed: 652 },
    "512": { fair: 274, good: 374, mint: 472, sealed: 518 } },
  mbp14_m5_2025: {
    "1tb": { fair: 882, good: 981, mint: 1080, sealed: 1125 },
    "2tb": { fair: 1017, good: 1116, mint: 1215, sealed: 1260 },
    "4tb": { fair: 1242, good: 1341, mint: 1440, sealed: 1485 },
    "512": { fair: 792, good: 891, mint: 990, sealed: 1035 } },
  mbp14_m5pmax_2026: {
    "1tb": { fair: 1062, good: 1161, mint: 1260, sealed: 1305 },
    "2tb": { fair: 1197, good: 1296, mint: 1395, sealed: 1440 },
    "4tb": { fair: 1422, good: 1521, mint: 1620, sealed: 1665 } },
  mbp14m4: {
    "1tb": { fair: 770, good: 868, mint: 968, sealed: 1012 },
    "2tb": { fair: 882, good: 981, mint: 1080, sealed: 1125 },
    "512": { fair: 657, good: 756, mint: 855, sealed: 900 } },
  ps4: {
    "base": { broken: 8, fair: 31, good: 63, mint: 81, sealed: 108 } },
  ps4pro: {
    "base": { broken: 21, fair: 40, good: 72, mint: 90, sealed: 108 } },
  // === WATCHES + DESKTOPS + CONSOLES (IWM scrape) ===
  macminim4p: {
    "1tb": { fair: 626, good: 680, mint: 742, sealed: 788 },
    "256": { fair: 356, good: 410, mint: 472, sealed: 518 },
    "2tb": { fair: 896, good: 950, mint: 1012, sealed: 1058 },
    "512": { fair: 490, good: 544, mint: 608, sealed: 652 } },
  macprom2u: {
    "1tb": { fair: 2340, good: 2745, mint: 3150, sealed: 3420 },
    "2tb": { fair: 2475, good: 2880, mint: 3285, sealed: 3555 },
    "4tb": { fair: 2610, good: 3015, mint: 3420, sealed: 3690 },
    "8tb": { fair: 2880, good: 3285, mint: 3690, sealed: 3960 } },
  macstudiom2u: {
    "1tb": { fair: 675, good: 796, mint: 945, sealed: 1012 },
    "2tb": { fair: 810, good: 932, mint: 1080, sealed: 1148 },
    "4tb": { fair: 1080, good: 1202, mint: 1350, sealed: 1418 },
    "512": { fair: 540, good: 662, mint: 810, sealed: 878 },
    "8tb": { fair: 1260, good: 1382, mint: 1530, sealed: 1598 } },
  macstudiom4u: {
    "1tb": { fair: 1665, good: 1822, mint: 1980, sealed: 2115 },
    "2tb": { fair: 1890, good: 2048, mint: 2205, sealed: 2340 },
    "4tb": { fair: 2160, good: 2318, mint: 2475, sealed: 2610 },
    "512": { fair: 1440, good: 1598, mint: 1755, sealed: 1890 },
    "8tb": { fair: 2520, good: 2678, mint: 2835, sealed: 2970 } },
  pw1: {
    "base": { fair: 4, good: 9, mint: 18, sealed: 32 } },
  imac24m1: {
    "16gbunifiedmemory": { fair: 279, good: 324, mint: 360, sealed: 387 },
    "1tb": { fair: 306, good: 351, mint: 387, sealed: 414 },
    "256": { fair: 234, good: 279, mint: 315, sealed: 342 },
    "512": { fair: 270, good: 315, mint: 351, sealed: 378 },
    "8gbunifiedmemory": { fair: 234, good: 279, mint: 315, sealed: 342 } },
  imac24m3: {
    "16gbunifiedmemory": { fair: 261, good: 333, mint: 405, sealed: 450 },
    "1tb": { fair: 306, good: 378, mint: 450, sealed: 495 },
    "24gbunifiedmemory": { fair: 306, good: 378, mint: 450, sealed: 495 },
    "256": { fair: 216, good: 288, mint: 360, sealed: 405 },
    "512": { fair: 261, good: 333, mint: 405, sealed: 450 },
    "8gbunifiedmemory": { fair: 216, good: 288, mint: 360, sealed: 405 } },
  imac24m4: {
    "16gbunifiedmemory": { fair: 315, good: 428, mint: 518, sealed: 585 },
    "1tb": { fair: 540, good: 652, mint: 742, sealed: 810 },
    "24gbunifiedmemory": { fair: 495, good: 608, mint: 698, sealed: 765 },
    "256": { fair: 315, good: 428, mint: 518, sealed: 585 },
    "512": { fair: 428, good: 540, mint: 630, sealed: 698 } },
  macminim1: {
    "1tb": { fair: 315, good: 342, mint: 360, sealed: 382 },
    "256": { fair: 248, good: 274, mint: 292, sealed: 315 },
    "2tb": { fair: 360, good: 387, mint: 405, sealed: 428 },
    "512": { fair: 270, good: 297, mint: 315, sealed: 338 } },
  macminim2: {
    "16gbunifiedmemory": { fair: 243, good: 297, mint: 360, sealed: 396 },
    "1tb": { fair: 266, good: 320, mint: 382, sealed: 418 },
    "24gbunifiedmemory": { fair: 288, good: 342, mint: 405, sealed: 441 },
    "256": { fair: 198, good: 252, mint: 315, sealed: 351 },
    "2tb": { fair: 333, good: 387, mint: 450, sealed: 486 },
    "512": { fair: 230, good: 284, mint: 346, sealed: 382 },
    "8gbunifiedmemory": { fair: 198, good: 252, mint: 315, sealed: 351 } },
  macminim4: {
    "16gbunifiedmemory": { fair: 356, good: 410, mint: 472, sealed: 518 },
    "1tb": { fair: 626, good: 680, mint: 742, sealed: 788 },
    "24gbunifiedmemory": { fair: 536, good: 590, mint: 652, sealed: 698 },
    "256": { fair: 356, good: 410, mint: 472, sealed: 518 },
    "2tb": { fair: 896, good: 950, mint: 1012, sealed: 1058 },
    "32gbunifiedmemory": { fair: 716, good: 770, mint: 832, sealed: 878 },
    "512": { fair: 490, good: 544, mint: 608, sealed: 652 } },
  macstudiom2m: {
    "1tb": { fair: 675, good: 796, mint: 945, sealed: 1012 },
    "2tb": { fair: 810, good: 932, mint: 1080, sealed: 1148 },
    "32gbunifiedmemory": { fair: 540, good: 662, mint: 810, sealed: 878 },
    "4tb": { fair: 1080, good: 1202, mint: 1350, sealed: 1418 },
    "512": { fair: 540, good: 662, mint: 810, sealed: 878 },
    "64gbunifiedmemory": { fair: 855, good: 976, mint: 1125, sealed: 1192 },
    "8tb": { fair: 1260, good: 1382, mint: 1530, sealed: 1598 } },
  macstudiom4m: {
    "1tb": { fair: 1665, good: 1822, mint: 1980, sealed: 2115 },
    "2tb": { fair: 1890, good: 2048, mint: 2205, sealed: 2340 },
    "36gbunifiedmemory": { fair: 1440, good: 1598, mint: 1755, sealed: 1890 },
    "4tb": { fair: 2160, good: 2318, mint: 2475, sealed: 2610 },
    "512": { fair: 1440, good: 1598, mint: 1755, sealed: 1890 },
    "8tb": { fair: 2520, good: 2678, mint: 2835, sealed: 2970 } },
  pw2: {
    "base": { fair: 4, good: 9, mint: 18, sealed: 32 } },
  pw3: {
    "pixelwatch3bluetoothwifi": { fair: 9, good: 24, mint: 32, sealed: 60 },
    "pixelwatch3bluetoothwifi4glte": { broken: 10, fair: 14, good: 28, mint: 37, sealed: 64 } },
  pw4: {
    "pixelwatch4bluetoothwifi": { fair: 37, good: 82, mint: 118, sealed: 154 },
    "pixelwatch4bluetoothwifi4glte": { broken: 19, fair: 46, good: 91, mint: 127, sealed: 163 } },
  sgw7: {
    "bluetoothwifi": { good: 14, mint: 24, sealed: 37 },
    "bluetoothwifi4glte": { fair: 10, good: 19, mint: 28, sealed: 41 } },
  sgw8: {
    "bluetoothwifi": { fair: 23, good: 50, mint: 68, sealed: 92 },
    "bluetoothwifi4glte": { fair: 32, good: 59, mint: 77, sealed: 100 } },
  sgw8c: {
    "bluetoothwifi": { fair: 54, good: 76, mint: 99, sealed: 122 },
    "bluetoothwifi4glte": { fair: 63, good: 86, mint: 108, sealed: 130 } },
  sgwu: {
    "base": { fair: 22, good: 58, mint: 90, sealed: 112 } },
  sgwu25: {
    "base": { fair: 72, good: 112, mint: 144, sealed: 176 } },
  switchv2: {
    "base": { broken: 21, fair: 32, good: 50, mint: 76, sealed: 104 } },
  xsx: {
    "1tb": { broken: 13, fair: 266, good: 342, mint: 410, sealed: 454 },
    "2tb": { broken: 13, fair: 346, good: 400, mint: 477, sealed: 522 } },
  // === SAMSUNG TABLETS (10% below IWM) ===
  stabs11u: {
    "1tb": { broken: 104, fair: 450, good: 549, mint: 594, sealed: 680 },
    "256": { broken: 90, fair: 369, good: 468, mint: 513, sealed: 567 },
    "512": { broken: 99, fair: 414, good: 513, mint: 558, sealed: 621 } },
  stabs11: {
    "128": { broken: 58, fair: 225, good: 288, mint: 324, sealed: 342 },
    "256": { broken: 63, fair: 243, good: 306, mint: 342, sealed: 364 },
    "512": { broken: 68, fair: 261, good: 324, mint: 360, sealed: 387 } },
  stabs10u: {
    "1tb": { broken: 86, fair: 405, good: 454, mint: 490, sealed: 522 },
    "256": { broken: 76, fair: 333, good: 382, mint: 418, sealed: 454 },
    "512": { broken: 81, fair: 378, good: 428, mint: 464, sealed: 490 } },
  stabs9: {
    "128": { broken: 22, fair: 140, good: 189, mint: 216, sealed: 243 },
    "256": { broken: 27, fair: 162, good: 212, mint: 238, sealed: 256 } },
  // === Baked absolute per-condition tables (VR / Drones / Garmin) ===
  // Auto-generated from BASE_PRICED_MODELS base x universal condition
  // multipliers (sealed 1.03 / mint 1.0 / good .969 / fair .852 / broken .5)
  // to retire the runtime multiplier path for these niche devices — same
  // numbers, now sourced from the absolute table like the rest of the funnel.
  // Skywalker 2026-05-28 (option C). Real per-condition IWM data = follow-up.
  avp_m5: { base: { sealed: 1845, mint: 1755, good: 1485, fair: 1080, broken: 0 } },
  avp_m2: { base: { sealed: 1395, mint: 1305, good: 1080, fair: 675, broken: 0 } },
  mq3s256: { base: { sealed: 99, mint: 81, good: 58, fair: 36, broken: 0 } },
  mq3128: { base: { sealed: 72, mint: 54, good: 32, fair: 9, broken: 0 } },
  mq3: { base: { sealed: 202, mint: 180, good: 153, fair: 126, broken: 0 } },
  mq3b: { base: { sealed: 140, mint: 117, good: 90, fair: 63, broken: 0 } },
  mq2256: { base: { sealed: 99, mint: 81, good: 68, fair: 50, broken: 0 } },
  mq2128: { base: { sealed: 63, mint: 45, good: 32, fair: 14, broken: 0 } },
  mqpro: { base: { sealed: 324, mint: 297, good: 270, fair: 198, broken: 0 } },
  dji_mavic_4_pro: { base: { sealed: 1440, mint: 1350, good: 1238, fair: 1012, broken: 0 } },
  dji_mavic_3_pro_cine: { base: { sealed: 1305, mint: 1148, good: 945, fair: 810, broken: 0 } },
  dji_mavic_3_cine: { base: { sealed: 1125, mint: 1035, good: 900, fair: 630, broken: 0 } },
  dji_mavic_3_pro: { base: { sealed: 1125, mint: 968, good: 855, fair: 630, broken: 0 } },
  dji_mavic_3: { base: { sealed: 585, mint: 540, good: 450, fair: 360, broken: 0 } },
  dji_mavic_3_classic: { base: { sealed: 585, mint: 518, good: 450, fair: 369, broken: 0 } },
  dji_mavic_2_pro: { base: { sealed: 252, mint: 207, good: 162, fair: 99, broken: 0 } },
  dji_mavic_2_zoom: { base: { sealed: 248, mint: 202, good: 158, fair: 90, broken: 0 } },
  dji_mavic_pro_platinum: { base: { sealed: 198, mint: 158, good: 122, fair: 76, broken: 0 } },
  dji_mavic_pro: { base: { sealed: 108, mint: 72, good: 50, fair: 22, broken: 0 } },
  dji_mini_4_pro: { base: { sealed: 405, mint: 315, good: 270, fair: 202, broken: 0 } },
  dji_mini_3_pro: { base: { sealed: 243, mint: 198, good: 166, fair: 90, broken: 0 } },
  dji_mini_3: { base: { sealed: 189, mint: 158, good: 117, fair: 72, broken: 0 } },
  dji_mini_2: { base: { sealed: 104, mint: 81, good: 36, fair: 27, broken: 0 } },
  dji_mini_2_se: { base: { sealed: 108, mint: 68, good: 40, fair: 18, broken: 0 } },
  dji_mini_se: { base: { sealed: 68, mint: 54, good: 36, fair: 14, broken: 0 } },
  dji_mavic_mini: { base: { sealed: 63, mint: 40, good: 22, fair: 9, broken: 0 } },
  dji_air_3s: { base: { sealed: 608, mint: 544, good: 490, fair: 382, broken: 0 } },
  dji_air_3: { base: { sealed: 522, mint: 459, good: 414, fair: 333, broken: 0 } },
  dji_air_2s: { base: { sealed: 315, mint: 270, good: 225, fair: 135, broken: 0 } },
  dji_mavic_air_2: { base: { sealed: 180, mint: 144, good: 99, fair: 45, broken: 0 } },
  dji_avata_2: { base: { sealed: 400, mint: 338, good: 288, fair: 216, broken: 0 } },
  dji_avata: { base: { sealed: 238, mint: 194, good: 148, fair: 90, broken: 0 } },
  dji_fpv: { base: { sealed: 315, mint: 248, good: 202, fair: 130, broken: 0 } },
  dji_inspire_2: { base: { sealed: 1058, mint: 990, good: 900, fair: 742, broken: 0 } },
  dji_inspire_1: { base: { sealed: 292, mint: 248, good: 225, fair: 158, broken: 0 } },
  dji_phantom_4_pro_v2: { base: { sealed: 338, mint: 292, good: 256, fair: 202, broken: 0 } },
  dji_phantom_4_pro: { base: { sealed: 216, mint: 189, good: 148, fair: 104, broken: 0 } },
  dji_phantom_4_advanced: { base: { sealed: 140, mint: 104, good: 63, fair: 18, broken: 0 } },
  dji_phantom_4: { base: { sealed: 135, mint: 94, good: 54, fair: 22, broken: 0 } },
  dji_flip: { base: { sealed: 180, mint: 144, good: 104, fair: 32, broken: 0 } },
  dji_spark: { base: { sealed: 68, mint: 45, good: 22, fair: 14, broken: 0 } },
  gfenix8pro: { base: { sealed: 500, mint: 472, good: 428, fair: 387, broken: 0 } },
  gfenix8solar: { base: { sealed: 432, mint: 405, good: 364, fair: 320, broken: 0 } },
  gfenix8amoled: { base: { sealed: 369, mint: 342, good: 284, fair: 198, broken: 0 } },
  gfenixe: { base: { sealed: 230, mint: 202, good: 180, fair: 144, broken: 0 } },
  gfenix7s: { base: { sealed: 171, mint: 144, good: 108, fair: 72, broken: 0 } },
  gfenix7x: { base: { sealed: 153, mint: 126, good: 90, fair: 40, broken: 0 } },
  gfenix7: { base: { sealed: 135, mint: 117, good: 81, fair: 36, broken: 0 } },
  gepixgen2: { base: { sealed: 14, mint: 14, good: 14, fair: 12, broken: 7 } },
  gepixprogen2: { base: { sealed: 14, mint: 14, good: 14, fair: 12, broken: 7 } },
  gforerunner970: { base: { sealed: 328, mint: 306, good: 279, fair: 207, broken: 0 } },
  gforerunner965: { base: { sealed: 212, mint: 189, good: 166, fair: 99, broken: 0 } },
  gforerunner570: { base: { sealed: 202, mint: 180, good: 158, fair: 94, broken: 0 } },
  gforerunner955: { base: { sealed: 158, mint: 135, good: 117, fair: 68, broken: 0 } },
  gforerunner955solar: { base: { sealed: 158, mint: 135, good: 117, fair: 68, broken: 0 } },
  gforerunner265: { base: { sealed: 135, mint: 117, good: 99, fair: 63, broken: 0 } },
  gforerunner265s: { base: { sealed: 135, mint: 117, good: 99, fair: 63, broken: 0 } },
  gforerunner255: { base: { sealed: 90, mint: 76, good: 63, fair: 32, broken: 0 } },
  gforerunner255music: { base: { sealed: 90, mint: 76, good: 63, fair: 32, broken: 0 } },
  gforerunner255s: { base: { sealed: 90, mint: 76, good: 63, fair: 32, broken: 0 } },
  gforerunner255smusic: { base: { sealed: 90, mint: 76, good: 63, fair: 32, broken: 0 } },
  gforerunner165: { base: { sealed: 76, mint: 63, good: 50, fair: 22, broken: 0 } },
  gforerunner165music: { base: { sealed: 76, mint: 63, good: 50, fair: 22, broken: 0 } },
  gforerunner945: { base: { sealed: 72, mint: 54, good: 40, fair: 18, broken: 0 } },
  gforerunner945lte: { base: { sealed: 72, mint: 54, good: 40, fair: 18, broken: 0 } },
  gforerunner245: { base: { sealed: 54, mint: 40, good: 27, fair: 9, broken: 0 } },
  gforerunner245music: { base: { sealed: 54, mint: 40, good: 27, fair: 9, broken: 0 } },
  gforerunner745: { base: { sealed: 36, mint: 22, good: 14, fair: 4, broken: 0 } },
  gvenu2: { base: { sealed: 315, mint: 270, good: 243, fair: 189, broken: 0 } },
  gvenux1: { base: { sealed: 315, mint: 270, good: 243, fair: 189, broken: 0 } },
  gvenu4: { base: { sealed: 225, mint: 198, good: 171, fair: 135, broken: 0 } },
  gvivoactive6: { base: { sealed: 112, mint: 90, good: 72, fair: 40, broken: 0 } },
  gvivoactive5: { base: { sealed: 50, mint: 36, good: 22, fair: 9, broken: 0 } },
  gvivoactive4: { base: { sealed: 27, mint: 18, good: 9, fair: 0, broken: 0 } },
  gvivoactive4s: { base: { sealed: 27, mint: 18, good: 9, fair: 0, broken: 0 } },
  ginstincte: { base: { sealed: 28, mint: 27, good: 26, fair: 23, broken: 14 } },
  ginstinct2: { base: { sealed: 9, mint: 9, good: 9, fair: 8, broken: 4 } },
  ginstinct2s: { base: { sealed: 9, mint: 9, good: 9, fair: 8, broken: 4 } },
  ginstinct2x: { base: { sealed: 9, mint: 9, good: 9, fair: 8, broken: 4 } },
  ginstinct3: { base: { sealed: 9, mint: 9, good: 9, fair: 8, broken: 4 } },
  ginstinctcrossover: { base: { sealed: 9, mint: 9, good: 9, fair: 8, broken: 4 } },
  gapproachs70: { base: { sealed: 198, mint: 180, good: 162, fair: 99, broken: 0 } },
  gapproachs50: { base: { sealed: 135, mint: 117, good: 99, fair: 63, broken: 0 } },
  gapproachs62: { base: { sealed: 108, mint: 90, good: 72, fair: 40, broken: 0 } },
  gapproachs44: { base: { sealed: 94, mint: 81, good: 68, fair: 22, broken: 0 } },
  gapproachs42: { base: { sealed: 68, mint: 54, good: 36, fair: 14, broken: 0 } },
  gdescentg2: { base: { sealed: 230, mint: 207, good: 189, fair: 135, broken: 0 } },
  gdescentmk1: { base: { sealed: 153, mint: 135, good: 117, fair: 63, broken: 0 } },
  gdescentg1: { base: { sealed: 9, mint: 9, good: 9, fair: 8, broken: 4 } },
  gdescentmk2: { base: { sealed: 9, mint: 9, good: 9, fair: 8, broken: 4 } },
  gdescentmk3: { base: { sealed: 9, mint: 9, good: 9, fair: 8, broken: 4 } },
  genduro3: { base: { sealed: 369, mint: 333, good: 306, fair: 252, broken: 0 } },
  genduro2: { base: { sealed: 180, mint: 162, good: 144, fair: 90, broken: 0 } },
  genduroorig: { base: { sealed: 81, mint: 63, good: 45, fair: 22, broken: 0 } },
  gmarqadventurer: { base: { sealed: 171, mint: 135, good: 81, fair: 9, broken: 0 } },
  gmarqathlete: { base: { sealed: 171, mint: 135, good: 81, fair: 9, broken: 0 } },
  gmarqaviator: { base: { sealed: 171, mint: 135, good: 81, fair: 9, broken: 0 } },
  gmarqcaptain: { base: { sealed: 171, mint: 135, good: 81, fair: 9, broken: 0 } },
  gmarqcommander: { base: { sealed: 171, mint: 135, good: 81, fair: 9, broken: 0 } },
  gmarqgolfer: { base: { sealed: 171, mint: 135, good: 81, fair: 9, broken: 0 } },
  gquatix6: { base: { sealed: 19, mint: 18, good: 17, fair: 15, broken: 9 } },
  gquatix7: { base: { sealed: 19, mint: 18, good: 17, fair: 15, broken: 9 } },
  gquatix8: { base: { sealed: 19, mint: 18, good: 17, fair: 15, broken: 9 } },
  glily2: { base: { sealed: 23, mint: 22, good: 21, fair: 19, broken: 11 } },
  glily2active: { base: { sealed: 23, mint: 22, good: 21, fair: 19, broken: 11 } },
  glily2classic: { base: { sealed: 23, mint: 22, good: 21, fair: 19, broken: 11 } },
};

// =========================================================================
// BASE-PRICED MODELS — VR / Drones / Garmin / etc.
// =========================================================================
// Models that use a single `base` price (no storage × condition matrix).
// The customer funnel pulls model.base from its hardcoded variant arrays;
// runtime overrides from /api/admin/prices (baseOverrides field) can swap
// the displayed price without a redeploy. Editor groups these by category.

export type BasePricedModel = {
  category: string;
  label: string;
  base: number;
  inquiryOnly?: boolean;
  image?: string;
};

export const BASE_PRICED_MODELS: Record<string, BasePricedModel> = {
  avp_m5: { category: "VR — Apple", label: "Apple Vision Pro (M5, 2025)", base: 1755, image: "/devices/apple-vision-pro.png" },
  avp_m2: { category: "VR — Apple", label: "Apple Vision Pro (M2, 2024)", base: 1305, image: "/devices/apple-vision-pro.png" },
  mq3s256: { category: "VR — Meta", label: "Meta Quest 3S (256GB)", base: 81, image: "/devices/meta-quest-3s.png" },
  mq3128: { category: "VR — Meta", label: "Meta Quest 3S (128GB)", base: 54, image: "/devices/meta-quest-3s.png" },
  mq3: { category: "VR — Meta", label: "Meta Quest 3 (512GB)", base: 180, image: "/devices/meta-quest-3.png" },
  mq3b: { category: "VR — Meta", label: "Meta Quest 3 (128GB)", base: 117, image: "/devices/meta-quest-3.png" },
  mq2256: { category: "VR — Meta", label: "Meta Quest 2 (256GB)", base: 81, image: "/devices/meta-quest-2.png" },
  mq2128: { category: "VR — Meta", label: "Meta Quest 2 (128GB)", base: 45, image: "/devices/meta-quest-2.png" },
  mqpro: { category: "VR — Meta", label: "Meta Quest Pro", base: 297, image: "/devices/meta-quest-pro.png" },
  // VR headsets without firm auto-pricing — route to inquiry instead of
  // quoting "$0" to the customer. Matches the DJI Phantom 3 pattern
  // below. 2026-05-24.
  valveidx: { category: "VR — Valve", label: "Valve Index Full Kit", base: 0, inquiryOnly: true },
  valveidxhmd: { category: "VR — Valve", label: "Valve Index Headset Only", base: 0, inquiryOnly: true },
  psvr2: { category: "VR — PlayStation", label: "PlayStation VR2", base: 0, inquiryOnly: true },
  psvr2h: { category: "VR — PlayStation", label: "PlayStation VR2 Horizon Bundle", base: 0, inquiryOnly: true },
  psvr1: { category: "VR — PlayStation", label: "PlayStation VR (Original)", base: 0, inquiryOnly: true },
  dji_mavic_4_pro: { category: "Drones — DJI", label: "DJI Mavic 4 Pro", base: 1350, image: "/devices/dji_mavic_4_pro.png" },
  dji_mavic_3_pro_cine: { category: "Drones — DJI", label: "DJI Mavic 3 Pro Cine", base: 1148, image: "/devices/dji_mavic_3_pro.png" },
  dji_mavic_3_cine: { category: "Drones — DJI", label: "DJI Mavic 3 Cine", base: 1035, image: "/devices/dji_mavic_3_cine.png" },
  dji_mavic_3_pro: { category: "Drones — DJI", label: "DJI Mavic 3 Pro", base: 968, image: "/devices/dji_mavic_3_pro.png" },
  dji_mavic_3: { category: "Drones — DJI", label: "DJI Mavic 3", base: 540, image: "/devices/dji_mavic_3.png" },
  dji_mavic_3_classic: { category: "Drones — DJI", label: "DJI Mavic 3 Classic", base: 518, image: "/devices/dji_mavic_3_classic.png" },
  dji_mavic_2_pro: { category: "Drones — DJI", label: "DJI Mavic 2 Pro", base: 207, image: "/devices/dji_mavic_2_pro.png" },
  dji_mavic_2_zoom: { category: "Drones — DJI", label: "DJI Mavic 2 Zoom", base: 202, image: "/devices/dji_mavic_2_zoom.png" },
  dji_mavic_pro_platinum: { category: "Drones — DJI", label: "DJI Mavic Pro Platinum", base: 158, image: "/devices/dji_mavic_pro_platinum.png" },
  dji_mavic_pro: { category: "Drones — DJI", label: "DJI Mavic Pro", base: 72, image: "/devices/dji_mavic_pro.png" },
  dji_mini_4_pro: { category: "Drones — DJI", label: "DJI Mini 4 Pro", base: 315, image: "/devices/dji_mini_4_pro.png" },
  dji_mini_3_pro: { category: "Drones — DJI", label: "DJI Mini 3 Pro", base: 198, image: "/devices/dji_mini_3_pro.png" },
  dji_mini_3: { category: "Drones — DJI", label: "DJI Mini 3", base: 158, image: "/devices/dji_mini_3.png" },
  dji_mini_2: { category: "Drones — DJI", label: "DJI Mini 2", base: 81, image: "/devices/dji_mini_2_se.png" },
  dji_mini_2_se: { category: "Drones — DJI", label: "DJI Mini 2 SE", base: 68, image: "/devices/dji_mini_2_se.png" },
  dji_mini_se: { category: "Drones — DJI", label: "DJI Mini SE", base: 54, image: "/devices/dji_mini_se.png" },
  dji_mavic_mini: { category: "Drones — DJI", label: "DJI Mavic Mini", base: 40, image: "/devices/dji_mavic_mini.png" },
  dji_air_3s: { category: "Drones — DJI", label: "DJI Air 3S", base: 544, image: "/devices/dji_air_3s.png" },
  dji_air_3: { category: "Drones — DJI", label: "DJI Air 3", base: 459, image: "/devices/dji_air_3.png" },
  dji_air_2s: { category: "Drones — DJI", label: "DJI Air 2S", base: 270, image: "/devices/dji_air_2s.png" },
  dji_mavic_air_2: { category: "Drones — DJI", label: "DJI Mavic Air 2", base: 144, image: "/devices/dji_mavic_air_2.png" },
  dji_avata_2: { category: "Drones — DJI", label: "DJI Avata 2", base: 338, image: "/devices/dji_avata_2.png" },
  dji_avata: { category: "Drones — DJI", label: "DJI Avata", base: 194, image: "/devices/dji_avata.png" },
  dji_fpv: { category: "Drones — DJI", label: "DJI FPV", base: 248, image: "/devices/dji_fpv.png" },
  dji_inspire_2: { category: "Drones — DJI", label: "DJI Inspire 2", base: 990, image: "/devices/dji_inspire_2.png" },
  dji_inspire_1: { category: "Drones — DJI", label: "DJI Inspire 1", base: 248, image: "/devices/dji_inspire_2.png" },
  dji_phantom_4_pro_v2: { category: "Drones — DJI", label: "DJI Phantom 4 Pro v2", base: 292, image: "/devices/dji_phantom_4_pro.png" },
  dji_phantom_4_pro: { category: "Drones — DJI", label: "DJI Phantom 4 Pro", base: 189, image: "/devices/dji_phantom_4_pro.png" },
  dji_phantom_4_advanced: { category: "Drones — DJI", label: "DJI Phantom 4 Advanced", base: 104, image: "/devices/dji_phantom_4.png" },
  dji_phantom_4: { category: "Drones — DJI", label: "DJI Phantom 4", base: 94, image: "/devices/dji_phantom_4.png" },
  dji_phantom_3_pro: { category: "Drones — DJI", label: "DJI Phantom 3 Pro", base: 0, inquiryOnly: true, image: "/devices/dji_phantom_3.png" },
  dji_phantom_3_advanced: { category: "Drones — DJI", label: "DJI Phantom 3 Advanced", base: 0, inquiryOnly: true, image: "/devices/dji_phantom_3.png" },
  dji_phantom_3_standard: { category: "Drones — DJI", label: "DJI Phantom 3 Standard", base: 0, inquiryOnly: true, image: "/devices/dji_phantom_3.png" },
  dji_flip: { category: "Drones — DJI", label: "DJI Flip", base: 144, image: "/devices/dji_flip.png" },
  dji_spark: { category: "Drones — DJI", label: "DJI Spark", base: 45, image: "/devices/dji_spark.png" },
  gfenix8pro: { category: "Garmin watches", label: "Fenix 8 Pro", base: 472, image: "/devices/garmin-watch.png" },
  gfenix8solar: { category: "Garmin watches", label: "Fenix 8 Solar", base: 405, image: "/devices/garmin-watch.png" },
  gfenix8amoled: { category: "Garmin watches", label: "Fenix 8 AMOLED", base: 342, image: "/devices/garmin-watch.png" },
  gfenixe: { category: "Garmin watches", label: "Fenix E", base: 202, image: "/devices/garmin-watch.png" },
  gfenix7s: { category: "Garmin watches", label: "Fenix 7S", base: 144, image: "/devices/gfenix7s.png" },
  gfenix7x: { category: "Garmin watches", label: "Fenix 7X", base: 126, image: "/devices/gfenix7.png" },
  gfenix7: { category: "Garmin watches", label: "Fenix 7", base: 117, image: "/devices/gfenix7.png" },
  gepixgen2: { category: "Garmin watches", label: "Epix Gen 2", base: 14, image: "/devices/garmin-watch.png" },
  gepixprogen2: { category: "Garmin watches", label: "Epix Pro Gen 2", base: 14, image: "/devices/garmin-watch.png" },
  gforerunner970: { category: "Garmin watches", label: "Forerunner 970", base: 328, image: "/devices/garmin-watch.png" },
  gforerunner965: { category: "Garmin watches", label: "Forerunner 965", base: 212, image: "/devices/garmin-watch.png" },
  gforerunner570: { category: "Garmin watches", label: "Forerunner 570", base: 202, image: "/devices/garmin-watch.png" },
  gforerunner955: { category: "Garmin watches", label: "Forerunner 955", base: 158, image: "/devices/garmin-watch.png" },
  gforerunner955solar: { category: "Garmin watches", label: "Forerunner 955 Solar", base: 158, image: "/devices/garmin-watch.png" },
  gforerunner265: { category: "Garmin watches", label: "Forerunner 265", base: 135, image: "/devices/garmin-watch.png" },
  gforerunner265s: { category: "Garmin watches", label: "Forerunner 265S", base: 135, image: "/devices/garmin-watch.png" },
  gforerunner255: { category: "Garmin watches", label: "Forerunner 255", base: 90, image: "/devices/garmin-watch.png" },
  gforerunner255music: { category: "Garmin watches", label: "Forerunner 255 Music", base: 90, image: "/devices/garmin-watch.png" },
  gforerunner255s: { category: "Garmin watches", label: "Forerunner 255S", base: 90, image: "/devices/garmin-watch.png" },
  gforerunner255smusic: { category: "Garmin watches", label: "Forerunner 255S Music", base: 90, image: "/devices/garmin-watch.png" },
  gforerunner165: { category: "Garmin watches", label: "Forerunner 165", base: 76, image: "/devices/garmin-watch.png" },
  gforerunner165music: { category: "Garmin watches", label: "Forerunner 165 Music", base: 76, image: "/devices/garmin-watch.png" },
  gforerunner945: { category: "Garmin watches", label: "Forerunner 945", base: 72, image: "/devices/garmin-watch.png" },
  gforerunner945lte: { category: "Garmin watches", label: "Forerunner 945 LTE", base: 72, image: "/devices/garmin-watch.png" },
  gforerunner245: { category: "Garmin watches", label: "Forerunner 245", base: 54, image: "/devices/garmin-watch.png" },
  gforerunner245music: { category: "Garmin watches", label: "Forerunner 245 Music", base: 54, image: "/devices/garmin-watch.png" },
  gforerunner745: { category: "Garmin watches", label: "Forerunner 745", base: 36, image: "/devices/garmin-watch.png" },
  gvenu2: { category: "Garmin watches", label: "Venu 2", base: 315, image: "/devices/gvenu2.png" },
  gvenux1: { category: "Garmin watches", label: "Venu X1", base: 315, image: "/devices/gvenu3.png" },
  gvenu4: { category: "Garmin watches", label: "Venu 4", base: 198, image: "/devices/gvenu3.png" },
  gvivoactive6: { category: "Garmin watches", label: "Vivoactive 6", base: 112, image: "/devices/garmin-watch.png" },
  gvivoactive5: { category: "Garmin watches", label: "Vivoactive 5", base: 50, image: "/devices/garmin-watch.png" },
  gvivoactive4: { category: "Garmin watches", label: "Vivoactive 4", base: 27, image: "/devices/garmin-watch.png" },
  gvivoactive4s: { category: "Garmin watches", label: "Vivoactive 4S", base: 27, image: "/devices/garmin-watch.png" },
  ginstincte: { category: "Garmin watches", label: "Instinct E", base: 27, image: "/devices/garmin-watch.png" },
  ginstinct2: { category: "Garmin watches", label: "Instinct 2", base: 9, image: "/devices/garmin-watch.png" },
  ginstinct2s: { category: "Garmin watches", label: "Instinct 2S", base: 9, image: "/devices/garmin-watch.png" },
  ginstinct2x: { category: "Garmin watches", label: "Instinct 2X", base: 9, image: "/devices/garmin-watch.png" },
  ginstinct3: { category: "Garmin watches", label: "Instinct 3", base: 9, image: "/devices/garmin-watch.png" },
  ginstinctcrossover: { category: "Garmin watches", label: "Instinct Crossover", base: 9, image: "/devices/garmin-watch.png" },
  gapproachs70: { category: "Garmin watches", label: "Approach S70", base: 198, image: "/devices/garmin-watch.png" },
  gapproachs50: { category: "Garmin watches", label: "Approach S50", base: 135, image: "/devices/garmin-watch.png" },
  gapproachs62: { category: "Garmin watches", label: "Approach S62", base: 108, image: "/devices/garmin-watch.png" },
  gapproachs44: { category: "Garmin watches", label: "Approach S44", base: 94, image: "/devices/garmin-watch.png" },
  gapproachs42: { category: "Garmin watches", label: "Approach S42", base: 68, image: "/devices/garmin-watch.png" },
  gdescentg2: { category: "Garmin watches", label: "Descent G2", base: 230, image: "/devices/garmin-watch.png" },
  gdescentmk1: { category: "Garmin watches", label: "Descent Mk1", base: 153, image: "/devices/garmin-watch.png" },
  gdescentg1: { category: "Garmin watches", label: "Descent G1", base: 9, image: "/devices/garmin-watch.png" },
  gdescentmk2: { category: "Garmin watches", label: "Descent Mk2", base: 9, image: "/devices/garmin-watch.png" },
  gdescentmk3: { category: "Garmin watches", label: "Descent Mk3", base: 9, image: "/devices/garmin-watch.png" },
  genduro3: { category: "Garmin watches", label: "Enduro 3", base: 369, image: "/devices/garmin-watch.png" },
  genduro2: { category: "Garmin watches", label: "Enduro 2", base: 180, image: "/devices/garmin-watch.png" },
  genduroorig: { category: "Garmin watches", label: "Enduro", base: 81, image: "/devices/garmin-watch.png" },
  gmarqadventurer: { category: "Garmin watches", label: "MARQ Adventurer", base: 135, image: "/devices/garmin-watch.png" },
  gmarqathlete: { category: "Garmin watches", label: "MARQ Athlete", base: 135, image: "/devices/garmin-watch.png" },
  gmarqaviator: { category: "Garmin watches", label: "MARQ Aviator", base: 135, image: "/devices/garmin-watch.png" },
  gmarqcaptain: { category: "Garmin watches", label: "MARQ Captain", base: 135, image: "/devices/garmin-watch.png" },
  gmarqcommander: { category: "Garmin watches", label: "MARQ Commander", base: 135, image: "/devices/garmin-watch.png" },
  gmarqgolfer: { category: "Garmin watches", label: "MARQ Golfer", base: 135, image: "/devices/garmin-watch.png" },
  gquatix6: { category: "Garmin watches", label: "Quatix 6", base: 18, image: "/devices/garmin-watch.png" },
  gquatix7: { category: "Garmin watches", label: "Quatix 7", base: 18, image: "/devices/garmin-watch.png" },
  gquatix8: { category: "Garmin watches", label: "Quatix 8", base: 18, image: "/devices/garmin-watch.png" },
  glily2: { category: "Garmin watches", label: "Lily 2", base: 22, image: "/devices/garmin-watch.png" },
  glily2active: { category: "Garmin watches", label: "Lily 2 Active", base: 22, image: "/devices/garmin-watch.png" },
  glily2classic: { category: "Garmin watches", label: "Lily 2 Classic", base: 22, image: "/devices/garmin-watch.png" } };


// =========================================================================
// MACBOOK SPECS (additive: chip × RAM × storage × display × condition adj)
// =========================================================================
// Extracted from app/page.tsx 2026-05-18. Customer funnel imports these
// types + the MACBOOK_SPECS map. Admin /admin/prices reads them to power
// the per-MacBook spec editor.

export type MacSpecOption = { id: string; label: string; multiplier: number; adj?: number; sub?: string };
export type MacSpec = {
  processors: MacSpecOption[];
  memory: MacSpecOption[];
  storage: MacSpecOption[];
  // Optional graphics step (gaming laptops, workstations). PC laptops
  // surface this between storage and condition when populated; MacBooks
  // never have it.
  graphics?: MacSpecOption[];
  // Optional display-resolution step (FHD / QHD / OLED on flagships).
  // Sits between graphics and displayglass.
  display?: MacSpecOption[];
  hasNanoGlass?: boolean;
  // Per-model IWM condition adjustments. Keys: sealed / mint / good /
  // fair / broken. (Skywalker 2026-05-19 collapsed verygood into the
  // mint→good gap — see CONDITIONS in app/page.tsx.) When present, the
  // additive math uses these instead of the MacBook-calibrated MCOND.
  condition_adj?: Record<string, number>;
  battery_adj?: Record<string, number>;
  charger_adj?: Record<string, number>;
};
export const MACBOOK_SPECS: Record<string, MacSpec> = {
  // 2026 16-inch MacBook Pro M5 Pro/Max (Skywalker's example reference).
  mbp16_m5pmax_2026: {
    processors: [
      { id: "m5pro_18_20", label: "M5 Pro", sub: "18-Core CPU / 20-Core GPU", multiplier: 1.00, adj: 1900 },
      { id: "m5max_18_32", label: "M5 Max", sub: "18-Core CPU / 32-Core GPU", multiplier: 1.35, adj: 2900 },
      { id: "m5max_18_40", label: "M5 Max", sub: "18-Core CPU / 40-Core GPU", multiplier: 1.50, adj: 3200 },
    ],
    memory: [
      { id: "24",  label: "24 GB",  sub: "Unified Memory", multiplier: 1.00, adj: 0 },
      { id: "36",  label: "36 GB",  sub: "Unified Memory", multiplier: 1.08, adj: 200 },
      { id: "48",  label: "48 GB",  sub: "Unified Memory", multiplier: 1.15, adj: 350 },
      { id: "64",  label: "64 GB",  sub: "Unified Memory", multiplier: 1.25, adj: 600 },
      { id: "128", label: "128 GB", sub: "Unified Memory", multiplier: 1.45, adj: 800 },
    ],
    storage: [
      { id: "1tb", label: "1 TB",  sub: "SSD", multiplier: 1.00, adj: 0 },
      { id: "2tb", label: "2 TB",  sub: "SSD", multiplier: 1.15, adj: 300 },
      { id: "4tb", label: "4 TB",  sub: "SSD", multiplier: 1.40, adj: 600 },
      { id: "8tb", label: "8 TB",  sub: "SSD", multiplier: 1.75, adj: 1500 },
    ],
    hasNanoGlass: true },
  // 2026 14-inch MacBook Pro M5 Pro/Max — same chip tiers as the 16,
  // with the 15-16C base Pro chip configurable too. 8TB SSD available
  // on M5 Max only (not M5 Pro).
  mbp14_m5pmax_2026: {
    processors: [
      { id: "m5pro_15_16", label: "M5 Pro", sub: "15-Core CPU / 16-Core GPU", multiplier: 1.00, adj: 1400 },
      { id: "m5pro_18_20", label: "M5 Pro", sub: "18-Core CPU / 20-Core GPU", multiplier: 1.20, adj: 1600 },
      { id: "m5max_18_32", label: "M5 Max", sub: "18-Core CPU / 32-Core GPU", multiplier: 1.50, adj: 2300 },
      { id: "m5max_18_40", label: "M5 Max", sub: "18-Core CPU / 40-Core GPU", multiplier: 1.70, adj: 3000 },
    ],
    memory: [
      { id: "24",  label: "24 GB",  sub: "Unified Memory", multiplier: 1.00, adj: 0 },
      { id: "36",  label: "36 GB",  sub: "Unified Memory", multiplier: 1.10, adj: 200 },
      { id: "48",  label: "48 GB",  sub: "Unified Memory", multiplier: 1.18, adj: 200 },
      { id: "64",  label: "64 GB",  sub: "Unified Memory", multiplier: 1.30, adj: 250 },
      { id: "128", label: "128 GB", sub: "Unified Memory", multiplier: 1.50, adj: 750 },
    ],
    storage: [
      { id: "1tb", label: "1 TB", sub: "SSD", multiplier: 1.00, adj: 0 },
      { id: "2tb", label: "2 TB", sub: "SSD", multiplier: 1.15, adj: 150 },
      { id: "4tb", label: "4 TB", sub: "SSD", multiplier: 1.40, adj: 400 },
      { id: "8tb", label: "8 TB", sub: "SSD", multiplier: 1.75, adj: 1100 },
    ],
    hasNanoGlass: true },
  // 2024 16-inch MacBook Pro M4 Pro/Max
  mbp16m4: {
    processors: [
      { id: "m4pro_14_20", label: "M4 Pro", sub: "14-Core CPU / 20-Core GPU", multiplier: 1.00, adj: 1475 },
      { id: "m4max_14_32", label: "M4 Max", sub: "14-Core CPU / 32-Core GPU", multiplier: 1.46, adj: 1950 },
      { id: "m4max_16_40", label: "M4 Max", sub: "16-Core CPU / 40-Core GPU", multiplier: 1.69, adj: 2200 },
    ],
    memory: [
      { id: "24",  label: "24 GB",  sub: "Unified Memory", multiplier: 1.00, adj: 0 },
      { id: "36",  label: "36 GB",  sub: "Unified Memory", multiplier: 1.06, adj: 200 },
      { id: "48",  label: "48 GB",  sub: "Unified Memory", multiplier: 1.12, adj: 400 },
      { id: "64",  label: "64 GB",  sub: "Unified Memory", multiplier: 1.22, adj: 600 },
      { id: "128", label: "128 GB", sub: "Unified Memory", multiplier: 1.42, adj: 1000 },
    ],
    storage: [
      { id: "512", label: "512 GB", sub: "SSD", multiplier: 0.85, adj: 0 },
      { id: "1tb", label: "1 TB",   sub: "SSD", multiplier: 1.00, adj: 200 },
      { id: "2tb", label: "2 TB",   sub: "SSD", multiplier: 1.18, adj: 400 },
      { id: "4tb", label: "4 TB",   sub: "SSD", multiplier: 1.40, adj: 600 },
      { id: "8tb", label: "8 TB",   sub: "SSD", multiplier: 1.70, adj: 1000 },
    ],
    hasNanoGlass: true },
  // 2024 14-inch MacBook Pro M4
  mbp14m4: {
    processors: [
      { id: "m4_10_10",    label: "M4",     sub: "10-Core CPU / 10-Core GPU", multiplier: 1.00, adj: 950 },
      { id: "m4pro_12_16", label: "M4 Pro", sub: "12-Core CPU / 16-Core GPU", multiplier: 1.37, adj: 1200 },
      { id: "m4pro_14_20", label: "M4 Pro", sub: "14-Core CPU / 20-Core GPU", multiplier: 1.42, adj: 1250 },
      { id: "m4max_14_32", label: "M4 Max", sub: "14-Core CPU / 32-Core GPU", multiplier: 2.26, adj: 1775 },
      { id: "m4max_16_40", label: "M4 Max", sub: "16-Core CPU / 40-Core GPU", multiplier: 2.47, adj: 2150 },
    ],
    memory: [
      { id: "16",  label: "16 GB",  sub: "Unified Memory", multiplier: 1.00, adj: 0 },
      { id: "24",  label: "24 GB",  sub: "Unified Memory", multiplier: 1.06, adj: 125 },
      { id: "32",  label: "32 GB",  sub: "Unified Memory", multiplier: 1.12, adj: 250 },
      { id: "36",  label: "36 GB",  sub: "Unified Memory", multiplier: 1.14, adj: 250 },
      { id: "48",  label: "48 GB",  sub: "Unified Memory", multiplier: 1.20, adj: 300 },
      { id: "64",  label: "64 GB",  sub: "Unified Memory", multiplier: 1.30, adj: 400 },
      { id: "128", label: "128 GB", sub: "Unified Memory", multiplier: 1.50, adj: 800 },
    ],
    storage: [
      { id: "512", label: "512 GB", sub: "SSD", multiplier: 0.85, adj: 0 },
      { id: "1tb", label: "1 TB",   sub: "SSD", multiplier: 1.00, adj: 125 },
      { id: "2tb", label: "2 TB",   sub: "SSD", multiplier: 1.18, adj: 250 },
      { id: "4tb", label: "4 TB",   sub: "SSD", multiplier: 1.40, adj: 600 },
      { id: "8tb", label: "8 TB",   sub: "SSD", multiplier: 1.70, adj: 1000 },
    ],
    hasNanoGlass: true },
  // 2023 16-inch MacBook Pro M3 Pro/Max
  mbp16m3: {
    processors: [
      { id: "m3pro_12_18", label: "M3 Pro", sub: "12-Core CPU / 18-Core GPU", multiplier: 1.00, adj: 1000 },
      { id: "m3max_14_30", label: "M3 Max", sub: "14-Core CPU / 30-Core GPU", multiplier: 1.41, adj: 1600 },
      { id: "m3max_16_40", label: "M3 Max", sub: "16-Core CPU / 40-Core GPU", multiplier: 1.54, adj: 1800 },
    ],
    memory: [
      { id: "18",  label: "18 GB",  sub: "Unified Memory", multiplier: 1.00, adj: 0 },
      { id: "36",  label: "36 GB",  sub: "Unified Memory", multiplier: 1.10, adj: 200 },
      { id: "48",  label: "48 GB",  sub: "Unified Memory", multiplier: 1.18, adj: 350 },
      { id: "64",  label: "64 GB",  sub: "Unified Memory", multiplier: 1.28, adj: 500 },
      { id: "96",  label: "96 GB",  sub: "Unified Memory", multiplier: 1.38, adj: 700 },
      { id: "128", label: "128 GB", sub: "Unified Memory", multiplier: 1.50, adj: 1000 },
    ],
    storage: [
      { id: "512", label: "512 GB", sub: "SSD", multiplier: 0.85, adj: 0 },
      { id: "1tb", label: "1 TB",   sub: "SSD", multiplier: 1.00, adj: 125 },
      { id: "2tb", label: "2 TB",   sub: "SSD", multiplier: 1.18, adj: 250 },
      { id: "4tb", label: "4 TB",   sub: "SSD", multiplier: 1.40, adj: 500 },
      { id: "8tb", label: "8 TB",   sub: "SSD", multiplier: 1.70, adj: 1100 },
    ],
    hasNanoGlass: false },
  // 2023 14-inch MacBook Pro M3 / Pro / Max
  mbp14m3: {
    processors: [
      { id: "m3_8_10",     label: "M3",     sub: "8-Core CPU / 10-Core GPU",  multiplier: 1.00, adj: 600 },
      { id: "m3pro_11_14", label: "M3 Pro", sub: "11-Core CPU / 14-Core GPU", multiplier: 1.43, adj: 850 },
      { id: "m3pro_12_18", label: "M3 Pro", sub: "12-Core CPU / 18-Core GPU", multiplier: 1.51, adj: 925 },
      { id: "m3max_14_30", label: "M3 Max", sub: "14-Core CPU / 30-Core GPU", multiplier: 2.30, adj: 1200 },
      { id: "m3max_16_40", label: "M3 Max", sub: "16-Core CPU / 40-Core GPU", multiplier: 2.70, adj: 1500 },
    ],
    memory: [
      { id: "8",   label: "8 GB",   sub: "Unified Memory", multiplier: 0.92, adj: 0 },
      { id: "16",  label: "16 GB",  sub: "Unified Memory", multiplier: 1.00, adj: 150 },
      { id: "18",  label: "18 GB",  sub: "Unified Memory", multiplier: 1.04, adj: 175 },
      { id: "24",  label: "24 GB",  sub: "Unified Memory", multiplier: 1.08, adj: 225 },
      { id: "36",  label: "36 GB",  sub: "Unified Memory", multiplier: 1.16, adj: 350 },
      { id: "48",  label: "48 GB",  sub: "Unified Memory", multiplier: 1.22, adj: 450 },
      { id: "64",  label: "64 GB",  sub: "Unified Memory", multiplier: 1.30, adj: 600 },
      { id: "96",  label: "96 GB",  sub: "Unified Memory", multiplier: 1.42, adj: 800 },
      { id: "128", label: "128 GB", sub: "Unified Memory", multiplier: 1.55, adj: 1000 },
    ],
    storage: [
      { id: "512", label: "512 GB", sub: "SSD", multiplier: 0.85, adj: 0 },
      { id: "1tb", label: "1 TB",   sub: "SSD", multiplier: 1.00, adj: 50 },
      { id: "2tb", label: "2 TB",   sub: "SSD", multiplier: 1.18, adj: 150 },
      { id: "4tb", label: "4 TB",   sub: "SSD", multiplier: 1.40, adj: 450 },
      { id: "8tb", label: "8 TB",   sub: "SSD", multiplier: 1.70, adj: 1000 },
    ],
    hasNanoGlass: false },
  // 2023 16-inch MacBook Pro M2 Pro/Max (no nano-texture this gen)
  mbp16m2: {
    processors: [
      { id: "m2pro_12_19", label: "M2 Pro", sub: "12-Core CPU / 19-Core GPU", multiplier: 1.00, adj: 750 },
      { id: "m2max_12_30", label: "M2 Max", sub: "12-Core CPU / 30-Core GPU", multiplier: 1.25, adj: 1200 },
      { id: "m2max_12_38", label: "M2 Max", sub: "12-Core CPU / 38-Core GPU", multiplier: 1.40, adj: 1300 },
    ],
    memory: [
      { id: "16", label: "16 GB", sub: "Unified Memory", multiplier: 1.00, adj: 0 },
      { id: "32", label: "32 GB", sub: "Unified Memory", multiplier: 1.12, adj: 175 },
      { id: "64", label: "64 GB", sub: "Unified Memory", multiplier: 1.28, adj: 200 },
      { id: "96", label: "96 GB", sub: "Unified Memory", multiplier: 1.40, adj: 400 },
    ],
    storage: [
      { id: "512", label: "512 GB", sub: "SSD", multiplier: 0.85, adj: 0 },
      { id: "1tb", label: "1 TB",   sub: "SSD", multiplier: 1.00, adj: 125 },
      { id: "2tb", label: "2 TB",   sub: "SSD", multiplier: 1.18, adj: 250 },
      { id: "4tb", label: "4 TB",   sub: "SSD", multiplier: 1.40, adj: 500 },
      { id: "8tb", label: "8 TB",   sub: "SSD", multiplier: 1.70, adj: 700 },
    ],
    hasNanoGlass: false },
  // 2023 14-inch MacBook Pro M2 Pro/Max
  mbp14m2: {
    processors: [
      { id: "m2pro_10_16", label: "M2 Pro", sub: "10-Core CPU / 16-Core GPU", multiplier: 1.00, adj: 675 },
      { id: "m2pro_12_19", label: "M2 Pro", sub: "12-Core CPU / 19-Core GPU", multiplier: 1.11, adj: 725 },
      { id: "m2max_12_30", label: "M2 Max", sub: "12-Core CPU / 30-Core GPU", multiplier: 1.44, adj: 950 },
      { id: "m2max_12_38", label: "M2 Max", sub: "12-Core CPU / 38-Core GPU", multiplier: 1.50, adj: 1000 },
    ],
    memory: [
      { id: "16", label: "16 GB", sub: "Unified Memory", multiplier: 1.00, adj: 0 },
      { id: "32", label: "32 GB", sub: "Unified Memory", multiplier: 1.12, adj: 150 },
      { id: "64", label: "64 GB", sub: "Unified Memory", multiplier: 1.28, adj: 250 },
      { id: "96", label: "96 GB", sub: "Unified Memory", multiplier: 1.40, adj: 450 },
    ],
    storage: [
      { id: "512", label: "512 GB", sub: "SSD", multiplier: 0.85, adj: 0 },
      { id: "1tb", label: "1 TB",   sub: "SSD", multiplier: 1.00, adj: 50 },
      { id: "2tb", label: "2 TB",   sub: "SSD", multiplier: 1.18, adj: 150 },
      { id: "4tb", label: "4 TB",   sub: "SSD", multiplier: 1.40, adj: 300 },
      { id: "8tb", label: "8 TB",   sub: "SSD", multiplier: 1.70, adj: 500 },
    ],
    hasNanoGlass: false },
  // 2025 14-inch MacBook Pro M5 (base chip line) — Atlas only lists M5
  // Pro/Max variants for this gen but the base M5 is configurable too.
  // No nano glass on the base M5 model.
  mbp14_m5_2025: {
    processors: [
      { id: "m5_10_10", label: "M5", sub: "10-Core CPU / 10-Core GPU", multiplier: 1.00, adj: 1100 },
    ],
    memory: [
      { id: "16", label: "16 GB", sub: "Unified Memory", multiplier: 1.00, adj: 0 },
      { id: "24", label: "24 GB", sub: "Unified Memory", multiplier: 1.08, adj: 150 },
      { id: "32", label: "32 GB", sub: "Unified Memory", multiplier: 1.18, adj: 300 },
    ],
    storage: [
      { id: "512", label: "512 GB", sub: "SSD", multiplier: 0.85, adj: 0 },
      { id: "1tb", label: "1 TB",   sub: "SSD", multiplier: 1.00, adj: 100 },
      { id: "2tb", label: "2 TB",   sub: "SSD", multiplier: 1.20, adj: 250 },
      { id: "4tb", label: "4 TB",   sub: "SSD", multiplier: 1.45, adj: 500 },
    ],
    hasNanoGlass: true },
  // 2026 MacBook Air M5 — Skywalker has 13 + 15 combined as one catalog
  // entry, so screen size lives on the processor step (M5 chip is the
  // same across sizes; the 15-inch just commands a price premium).
  mba_m5_2026: {
    processors: [
      { id: "m5_13",       label: "M5 (13-inch)", sub: "10-Core CPU / 10-Core GPU", multiplier: 0.85, adj: 750 },
      { id: "m5_15",       label: "M5 (15-inch)", sub: "10-Core CPU / 10-Core GPU", multiplier: 1.12, adj: 825 },
    ],
    memory: [
      { id: "16", label: "16 GB", sub: "Unified Memory", multiplier: 1.00, adj: 0 },
      { id: "24", label: "24 GB", sub: "Unified Memory", multiplier: 1.10, adj: 75 },
      { id: "32", label: "32 GB", sub: "Unified Memory", multiplier: 1.22, adj: 175 },
    ],
    storage: [
      { id: "512", label: "512 GB", sub: "SSD", multiplier: 1.00, adj: 0 },
      { id: "1tb", label: "1 TB",   sub: "SSD", multiplier: 1.15, adj: 75 },
      { id: "2tb", label: "2 TB",   sub: "SSD", multiplier: 1.35, adj: 175 },
      { id: "4tb", label: "4 TB",   sub: "SSD", multiplier: 1.60, adj: 400 },
    ],
    hasNanoGlass: false },
  // 2025 MacBook Air M4 — 13" and 15" combined. M4 chip, 16/24/32 GB RAM,
  // 256/512/1TB/2TB storage. Same approach as M5 Air: screen size on processor step.
  mba_m4_2025: {
    processors: [
      { id: "m4_13", label: "M4 (13-inch)", sub: "10-Core CPU / 8-Core GPU",  multiplier: 0.85, adj: 575 },
      { id: "m4_15", label: "M4 (15-inch)", sub: "10-Core CPU / 10-Core GPU", multiplier: 1.06, adj: 600 },
    ],
    memory: [
      { id: "16", label: "16 GB", sub: "Unified Memory", multiplier: 1.00, adj: 0 },
      { id: "24", label: "24 GB", sub: "Unified Memory", multiplier: 1.10, adj: 75 },
      { id: "32", label: "32 GB", sub: "Unified Memory", multiplier: 1.22, adj: 150 },
    ],
    storage: [
      { id: "256", label: "256 GB", sub: "SSD", multiplier: 0.85, adj: 0 },
      { id: "512", label: "512 GB", sub: "SSD", multiplier: 1.00, adj: 50 },
      { id: "1tb", label: "1 TB",   sub: "SSD", multiplier: 1.15, adj: 125 },
      { id: "2tb", label: "2 TB",   sub: "SSD", multiplier: 1.35, adj: 250 },
    ],
    hasNanoGlass: false },
  // 2024 MacBook Air 15" M3
  mba15m3: {
    processors: [
      { id: "m3_8_10", label: "M3", sub: "8-Core CPU / 10-Core GPU", multiplier: 1.00, adj: 525 },
    ],
    memory: [
      { id: "8",  label: "8 GB",  sub: "Unified Memory", multiplier: 0.92, adj: 0 },
      { id: "16", label: "16 GB", sub: "Unified Memory", multiplier: 1.00, adj: 50 },
      { id: "24", label: "24 GB", sub: "Unified Memory", multiplier: 1.10, adj: 125 },
    ],
    storage: [
      { id: "256", label: "256 GB", sub: "SSD", multiplier: 0.85, adj: 0 },
      { id: "512", label: "512 GB", sub: "SSD", multiplier: 1.00, adj: 25 },
      { id: "1tb", label: "1 TB",   sub: "SSD", multiplier: 1.15, adj: 75 },
      { id: "2tb", label: "2 TB",   sub: "SSD", multiplier: 1.35, adj: 150 },
    ],
    hasNanoGlass: false },
  // 2024 MacBook Air 13" M3
  mba13m3: {
    processors: [
      { id: "m3_8_8",  label: "M3", sub: "8-Core CPU / 8-Core GPU",  multiplier: 1.00, adj: 450 },
      { id: "m3_8_10", label: "M3", sub: "8-Core CPU / 10-Core GPU", multiplier: 1.14, adj: 510 },
    ],
    memory: [
      { id: "8",  label: "8 GB",  sub: "Unified Memory", multiplier: 0.92, adj: 0 },
      { id: "16", label: "16 GB", sub: "Unified Memory", multiplier: 1.00, adj: 50 },
      { id: "24", label: "24 GB", sub: "Unified Memory", multiplier: 1.10, adj: 125 },
    ],
    storage: [
      { id: "256", label: "256 GB", sub: "SSD", multiplier: 0.85, adj: 0 },
      { id: "512", label: "512 GB", sub: "SSD", multiplier: 1.00, adj: 25 },
      { id: "1tb", label: "1 TB",   sub: "SSD", multiplier: 1.15, adj: 125 },
      { id: "2tb", label: "2 TB",   sub: "SSD", multiplier: 1.35, adj: 250 },
    ],
    hasNanoGlass: false },
  // 2023 MacBook Air 15" M2
  mba15m2: {
    processors: [
      { id: "m2_8_10", label: "M2", sub: "8-Core CPU / 10-Core GPU", multiplier: 1.00, adj: 500 },
    ],
    memory: [
      { id: "8",  label: "8 GB",  sub: "Unified Memory", multiplier: 0.92, adj: 0 },
      { id: "16", label: "16 GB", sub: "Unified Memory", multiplier: 1.00, adj: 50 },
      { id: "24", label: "24 GB", sub: "Unified Memory", multiplier: 1.10, adj: 100 },
    ],
    storage: [
      { id: "256", label: "256 GB", sub: "SSD", multiplier: 0.85, adj: 0 },
      { id: "512", label: "512 GB", sub: "SSD", multiplier: 1.00, adj: 25 },
      { id: "1tb", label: "1 TB",   sub: "SSD", multiplier: 1.15, adj: 75 },
      { id: "2tb", label: "2 TB",   sub: "SSD", multiplier: 1.35, adj: 175 },
    ],
    hasNanoGlass: false },
  // 2022 MacBook Air 13" M2
  mba13m2: {
    processors: [
      { id: "m2_8_8",  label: "M2", sub: "8-Core CPU / 8-Core GPU",  multiplier: 1.00, adj: 360 },
      { id: "m2_8_10", label: "M2", sub: "8-Core CPU / 10-Core GPU", multiplier: 1.08, adj: 385 },
    ],
    memory: [
      { id: "8",  label: "8 GB",  sub: "Unified Memory", multiplier: 0.92, adj: 0 },
      { id: "16", label: "16 GB", sub: "Unified Memory", multiplier: 1.00, adj: 50 },
      { id: "24", label: "24 GB", sub: "Unified Memory", multiplier: 1.10, adj: 100 },
    ],
    storage: [
      { id: "256", label: "256 GB", sub: "SSD", multiplier: 0.85, adj: 0 },
      { id: "512", label: "512 GB", sub: "SSD", multiplier: 1.00, adj: 25 },
      { id: "1tb", label: "1 TB",   sub: "SSD", multiplier: 1.15, adj: 75 },
      { id: "2tb", label: "2 TB",   sub: "SSD", multiplier: 1.35, adj: 150 },
    ],
    hasNanoGlass: false },
  // 2020 MacBook Air 13" M1 — first Apple Silicon Mac, simpler config
  mba13m1: {
    processors: [
      { id: "m1_8_7", label: "M1", sub: "8-Core CPU / 7-Core GPU", multiplier: 1.00, adj: 240 },
      { id: "m1_8_8", label: "M1", sub: "8-Core CPU / 8-Core GPU", multiplier: 1.08, adj: 290 },
    ],
    memory: [
      { id: "8",  label: "8 GB",  sub: "Unified Memory", multiplier: 0.92, adj: 0 },
      { id: "16", label: "16 GB", sub: "Unified Memory", multiplier: 1.00, adj: 20 },
    ],
    storage: [
      { id: "256", label: "256 GB", sub: "SSD", multiplier: 0.85, adj: 0 },
      { id: "512", label: "512 GB", sub: "SSD", multiplier: 1.00, adj: 20 },
      { id: "1tb", label: "1 TB",   sub: "SSD", multiplier: 1.15, adj: 40 },
      { id: "2tb", label: "2 TB",   sub: "SSD", multiplier: 1.35, adj: 75 },
    ],
    hasNanoGlass: false },
  // 2020 MacBook Pro 13" M1 — same chip as Air M1 but with active cooling
  mbp13m1: {
    processors: [
      { id: "m1_8_8", label: "M1", sub: "8-Core CPU / 8-Core GPU", multiplier: 1.00 },
    ],
    memory: [
      { id: "8",  label: "8 GB",  sub: "Unified Memory", multiplier: 0.92, adj: 0 },
      { id: "16", label: "16 GB", sub: "Unified Memory", multiplier: 1.00, adj: 50 },
    ],
    storage: [
      { id: "256", label: "256 GB", sub: "SSD", multiplier: 0.85, adj: 0 },
      { id: "512", label: "512 GB", sub: "SSD", multiplier: 1.00, adj: 50 },
      { id: "1tb", label: "1 TB",   sub: "SSD", multiplier: 1.15, adj: 125 },
      { id: "2tb", label: "2 TB",   sub: "SSD", multiplier: 1.35, adj: 175 },
    ],
    hasNanoGlass: false },
  // 2026 MacBook Neo 13" — entry-level A18 Pro chip
  mbneo13: {
    processors: [
      { id: "a18pro", label: "A18 Pro", sub: "iPhone-class chip", multiplier: 1.00 },
    ],
    memory: [
      { id: "8", label: "8 GB", sub: "Unified Memory", multiplier: 1.00 },
    ],
    storage: [
      { id: "256", label: "256 GB", sub: "SSD", multiplier: 0.85 },
      { id: "512", label: "512 GB", sub: "SSD", multiplier: 1.05 },
    ],
    hasNanoGlass: false },
  // ---- Intel / legacy MacBooks (inquiry-only, base 0) ----
  // These carry NO `adj` fields on purpose: base price is 0 so the funnel
  // routes them to the pending/manual-quote screen (isPendingQuote), but
  // having a spec entry makes hasAdditiveSpecs() true so the funnel still
  // collects chip / RAM / storage. Without this the funnel skipped straight
  // to condition and staff got a lead with no config — Skywalker's "all the
  // important meat are missing" again, this time for older MacBooks.
  // Options are real Apple build-to-order configs; multiplier kept 1.00
  // since base 0 makes the math moot (no auto-price is ever shown).
  mbp16_intel_2019: {
    processors: [
      { id: "i7_6c", label: "Intel Core i7", sub: "6-Core 2.6GHz", multiplier: 1.00 },
      { id: "i9_8c", label: "Intel Core i9", sub: "8-Core 2.3GHz", multiplier: 1.00 },
      { id: "i9_8c_24", label: "Intel Core i9", sub: "8-Core 2.4GHz", multiplier: 1.00 },
    ],
    memory: [
      { id: "16", label: "16 GB", sub: "DDR4", multiplier: 1.00 },
      { id: "32", label: "32 GB", sub: "DDR4", multiplier: 1.00 },
      { id: "64", label: "64 GB", sub: "DDR4", multiplier: 1.00 },
    ],
    storage: [
      { id: "512", label: "512 GB", sub: "SSD", multiplier: 1.00 },
      { id: "1tb", label: "1 TB", sub: "SSD", multiplier: 1.00 },
      { id: "2tb", label: "2 TB", sub: "SSD", multiplier: 1.00 },
      { id: "4tb", label: "4 TB", sub: "SSD", multiplier: 1.00 },
      { id: "8tb", label: "8 TB", sub: "SSD", multiplier: 1.00 },
    ],
    hasNanoGlass: false },
  mbp13_intel_2020: {
    processors: [
      { id: "i5_8c", label: "Intel Core i5", sub: "Quad-Core 8th Gen 1.4GHz", multiplier: 1.00 },
      { id: "i7_8c", label: "Intel Core i7", sub: "Quad-Core 8th Gen 1.7GHz", multiplier: 1.00 },
      { id: "i5_10c", label: "Intel Core i5", sub: "Quad-Core 10th Gen 2.0GHz", multiplier: 1.00 },
      { id: "i7_10c", label: "Intel Core i7", sub: "Quad-Core 10th Gen 2.3GHz", multiplier: 1.00 },
    ],
    memory: [
      { id: "8", label: "8 GB", multiplier: 1.00 },
      { id: "16", label: "16 GB", multiplier: 1.00 },
      { id: "32", label: "32 GB", multiplier: 1.00 },
    ],
    storage: [
      { id: "256", label: "256 GB", sub: "SSD", multiplier: 1.00 },
      { id: "512", label: "512 GB", sub: "SSD", multiplier: 1.00 },
      { id: "1tb", label: "1 TB", sub: "SSD", multiplier: 1.00 },
      { id: "2tb", label: "2 TB", sub: "SSD", multiplier: 1.00 },
      { id: "4tb", label: "4 TB", sub: "SSD", multiplier: 1.00 },
    ],
    hasNanoGlass: false },
  mbp_tb_2018_2019: {
    processors: [
      { id: "i5", label: "Intel Core i5", multiplier: 1.00 },
      { id: "i7", label: "Intel Core i7", multiplier: 1.00 },
      { id: "i9", label: "Intel Core i9", sub: "15-inch only", multiplier: 1.00 },
    ],
    memory: [
      { id: "8", label: "8 GB", multiplier: 1.00 },
      { id: "16", label: "16 GB", multiplier: 1.00 },
      { id: "32", label: "32 GB", multiplier: 1.00 },
    ],
    storage: [
      { id: "256", label: "256 GB", sub: "SSD", multiplier: 1.00 },
      { id: "512", label: "512 GB", sub: "SSD", multiplier: 1.00 },
      { id: "1tb", label: "1 TB", sub: "SSD", multiplier: 1.00 },
      { id: "2tb", label: "2 TB", sub: "SSD", multiplier: 1.00 },
      { id: "4tb", label: "4 TB", sub: "SSD", multiplier: 1.00 },
    ],
    hasNanoGlass: false },
  mbp_tb_2016_2017: {
    processors: [
      { id: "i5", label: "Intel Core i5", multiplier: 1.00 },
      { id: "i7", label: "Intel Core i7", multiplier: 1.00 },
    ],
    memory: [
      { id: "8", label: "8 GB", multiplier: 1.00 },
      { id: "16", label: "16 GB", multiplier: 1.00 },
    ],
    storage: [
      { id: "256", label: "256 GB", sub: "SSD", multiplier: 1.00 },
      { id: "512", label: "512 GB", sub: "SSD", multiplier: 1.00 },
      { id: "1tb", label: "1 TB", sub: "SSD", multiplier: 1.00 },
      { id: "2tb", label: "2 TB", sub: "SSD", multiplier: 1.00 },
    ],
    hasNanoGlass: false },
  mbp_retina_2015: {
    processors: [
      { id: "i5", label: "Intel Core i5", multiplier: 1.00 },
      { id: "i7", label: "Intel Core i7", multiplier: 1.00 },
    ],
    memory: [
      { id: "8", label: "8 GB", multiplier: 1.00 },
      { id: "16", label: "16 GB", multiplier: 1.00 },
    ],
    storage: [
      { id: "128", label: "128 GB", sub: "SSD", multiplier: 1.00 },
      { id: "256", label: "256 GB", sub: "SSD", multiplier: 1.00 },
      { id: "512", label: "512 GB", sub: "SSD", multiplier: 1.00 },
      { id: "1tb", label: "1 TB", sub: "SSD", multiplier: 1.00 },
    ],
    hasNanoGlass: false },
  mbp_retina_2014: {
    processors: [
      { id: "i5", label: "Intel Core i5", multiplier: 1.00 },
      { id: "i7", label: "Intel Core i7", multiplier: 1.00 },
    ],
    memory: [
      { id: "8", label: "8 GB", multiplier: 1.00 },
      { id: "16", label: "16 GB", multiplier: 1.00 },
    ],
    storage: [
      { id: "128", label: "128 GB", sub: "SSD", multiplier: 1.00 },
      { id: "256", label: "256 GB", sub: "SSD", multiplier: 1.00 },
      { id: "512", label: "512 GB", sub: "SSD", multiplier: 1.00 },
      { id: "1tb", label: "1 TB", sub: "SSD", multiplier: 1.00 },
    ],
    hasNanoGlass: false },
  mba_intel_2020: {
    processors: [
      { id: "i3", label: "Intel Core i3", sub: "Dual-Core 10th Gen", multiplier: 1.00 },
      { id: "i5", label: "Intel Core i5", sub: "Quad-Core 10th Gen", multiplier: 1.00 },
      { id: "i7", label: "Intel Core i7", sub: "Quad-Core 10th Gen", multiplier: 1.00 },
    ],
    memory: [
      { id: "8", label: "8 GB", multiplier: 1.00 },
      { id: "16", label: "16 GB", multiplier: 1.00 },
    ],
    storage: [
      { id: "256", label: "256 GB", sub: "SSD", multiplier: 1.00 },
      { id: "512", label: "512 GB", sub: "SSD", multiplier: 1.00 },
      { id: "1tb", label: "1 TB", sub: "SSD", multiplier: 1.00 },
      { id: "2tb", label: "2 TB", sub: "SSD", multiplier: 1.00 },
    ],
    hasNanoGlass: false },
  mba_retina_2018_2019: {
    processors: [
      { id: "i5", label: "Intel Core i5", sub: "Dual-Core", multiplier: 1.00 },
    ],
    memory: [
      { id: "8", label: "8 GB", multiplier: 1.00 },
      { id: "16", label: "16 GB", multiplier: 1.00 },
    ],
    storage: [
      { id: "128", label: "128 GB", sub: "SSD", multiplier: 1.00 },
      { id: "256", label: "256 GB", sub: "SSD", multiplier: 1.00 },
      { id: "512", label: "512 GB", sub: "SSD", multiplier: 1.00 },
      { id: "1tb", label: "1 TB", sub: "SSD", multiplier: 1.00 },
      { id: "1_5tb", label: "1.5 TB", sub: "SSD", multiplier: 1.00 },
    ],
    hasNanoGlass: false },
  mba_2017: {
    processors: [
      { id: "i5", label: "Intel Core i5", multiplier: 1.00 },
      { id: "i7", label: "Intel Core i7", multiplier: 1.00 },
    ],
    memory: [
      { id: "8", label: "8 GB", multiplier: 1.00 },
    ],
    storage: [
      { id: "128", label: "128 GB", sub: "SSD", multiplier: 1.00 },
      { id: "256", label: "256 GB", sub: "SSD", multiplier: 1.00 },
      { id: "512", label: "512 GB", sub: "SSD", multiplier: 1.00 },
    ],
    hasNanoGlass: false },
  mba_2014_2015: {
    processors: [
      { id: "i5", label: "Intel Core i5", multiplier: 1.00 },
      { id: "i7", label: "Intel Core i7", multiplier: 1.00 },
    ],
    memory: [
      { id: "4", label: "4 GB", multiplier: 1.00 },
      { id: "8", label: "8 GB", multiplier: 1.00 },
    ],
    storage: [
      { id: "128", label: "128 GB", sub: "SSD", multiplier: 1.00 },
      { id: "256", label: "256 GB", sub: "SSD", multiplier: 1.00 },
      { id: "512", label: "512 GB", sub: "SSD", multiplier: 1.00 },
    ],
    hasNanoGlass: false },
  mb12_2017: {
    processors: [
      { id: "m3", label: "Intel Core m3", multiplier: 1.00 },
      { id: "i5", label: "Intel Core i5", multiplier: 1.00 },
      { id: "i7", label: "Intel Core i7", multiplier: 1.00 },
    ],
    memory: [
      { id: "8", label: "8 GB", multiplier: 1.00 },
      { id: "16", label: "16 GB", multiplier: 1.00 },
    ],
    storage: [
      { id: "256", label: "256 GB", sub: "SSD", multiplier: 1.00 },
      { id: "512", label: "512 GB", sub: "SSD", multiplier: 1.00 },
    ],
    hasNanoGlass: false },
  mb12_2016: {
    processors: [
      { id: "m3", label: "Intel Core m3", multiplier: 1.00 },
      { id: "m5", label: "Intel Core m5", multiplier: 1.00 },
      { id: "m7", label: "Intel Core m7", multiplier: 1.00 },
    ],
    memory: [
      { id: "8", label: "8 GB", multiplier: 1.00 },
    ],
    storage: [
      { id: "256", label: "256 GB", sub: "SSD", multiplier: 1.00 },
      { id: "512", label: "512 GB", sub: "SSD", multiplier: 1.00 },
    ],
    hasNanoGlass: false },
  mb12_2015: {
    processors: [
      { id: "m3", label: "Intel Core m3", multiplier: 1.00 },
      { id: "m5", label: "Intel Core m5", multiplier: 1.00 },
      { id: "m7", label: "Intel Core m7", multiplier: 1.00 },
    ],
    memory: [
      { id: "8", label: "8 GB", multiplier: 1.00 },
    ],
    storage: [
      { id: "256", label: "256 GB", sub: "SSD", multiplier: 1.00 },
      { id: "512", label: "512 GB", sub: "SSD", multiplier: 1.00 },
    ],
    hasNanoGlass: false }, };
