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
  // iPhone 17 family — Atlas Mobile wholesale carrier-gap (NIB Sealed
  // Unlocked − Locked). "Other" = gap + $100 per Skywalker's rule.
  // Verizon and Unlocked: no entry → defaults to $0 deduction.
  ip17pm: { att: 335, tmobile: 335, other: 435 },
  ip17p:  { att: 280, tmobile: 280, other: 380 },
  ip17air: { att: 355, tmobile: 355, other: 455 },
  ip17:   { att: 195, tmobile: 195, other: 295 },
  ip17e:  { att: 200, tmobile: 200, other: 300 },
  // iPhone 16 series
  ip16pm: { att: 120, tmobile: 105, other: 500 },
  ip16p:  { att: 100, tmobile: 90, other: 400 },
  ip16plus: { att: 80, tmobile: 80, other: 300 },
  ip16:   { att: 80, tmobile: 80, other: 300 },
  ip16e:  { att: 50, tmobile: 60, other: 150 },
  // iPhone 15 series
  ip15pm: { att: 100, tmobile: 100, other: 400 },
  ip15p:  { att: 80, tmobile: 80, other: 300 },
  ip15plus: { att: 70, tmobile: 70, other: 250 },
  ip15:   { att: 60, tmobile: 60, other: 200 },
  // iPhone 14 series
  ip14pm: { att: 60, tmobile: 100, other: 200 },
  ip14p:  { att: 50, tmobile: 80, other: 150 },
  ip14plus: { att: 40, tmobile: 60, other: 100 },
  ip14:   { att: 40, tmobile: 80, other: 100 },
  // iPhone 13 series
  ip13pm: { att: 50, tmobile: 80, other: 150 },
  ip13p:  { att: 40, tmobile: 60, other: 100 },
  ip13:   { att: 30, tmobile: 50, other: 70 },
  // Older iPhones — smaller deductions
  ip12pm: { att: 30, tmobile: 40, other: 70 },
  ip12p:  { att: 25, tmobile: 35, other: 50 },
  ip12:   { att: 20, tmobile: 30, other: 50 },
  ip11pm: { att: 20, tmobile: 30, other: 50 },
  ip11p:  { att: 15, tmobile: 25, other: 40 },
  ip11:   { att: 15, tmobile: 20, other: 40 },
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
  ip12mini: { att: 20, tmobile: 30, other: 50 },
  ip13mini: { att: 40, tmobile: 60, other: 100 },
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
  pxfold: { att: 40, tmobile: 60, other: 100 },
};

// Minimum offer threshold — below this we lose money on shipping + processing.
// Devices below this get "Manual review & custom quote" instead of a dollar amount.
export const MIN_OFFER = 25;

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
    "128": { broken: 3, fair: 32, good: 89, mint: 99, sealed: 108 },
    "256": { broken: 13, fair: 41, good: 99, mint: 108, sealed: 117 },
    "64": { broken: 0, fair: 18, good: 62, mint: 76, sealed: 94 },
  },
  ip11p: {
    "256": { broken: 0, fair: 56, good: 108, mint: 122, sealed: 127 },
    "512": { broken: 18, fair: 75, good: 117, mint: 132, sealed: 137 },
    "64": { broken: 0, fair: 37, good: 90, mint: 104, sealed: 113 },
  },
  ip11pm: {
    "256": { fair: 79, good: 137, mint: 151, sealed: 155 },
    "512": { fair: 99, good: 151, mint: 165, sealed: 170 },
    "64": { fair: 61, good: 122, mint: 137, sealed: 141 },
  },
  ip12: {
    "128": { fair: 23, good: 103, mint: 113, sealed: 122 },
    "256": { fair: 41, good: 113, mint: 122, sealed: 132 },
    "64": { fair: 18, good: 89, mint: 99, sealed: 108 },
  },
  ip12mini: {
    "128": { fair: 48, good: 71, mint: 86, sealed: 109 },
    "256": { fair: 52, good: 76, mint: 90, sealed: 114 },
    "64": { fair: 19, good: 43, mint: 57, sealed: 104 },
  },
  ip12p: {
    "128": { fair: 61, good: 137, mint: 151, sealed: 160 },
    "256": { fair: 70, good: 151, mint: 165, sealed: 175 },
    "512": { fair: 70, good: 165, mint: 179, sealed: 189 },
  },
  ip12pm: {
    "128": { fair: 103, good: 184, mint: 198, sealed: 208 },
    "256": { fair: 117, good: 203, mint: 217, sealed: 227 },
    "512": { fair: 117, good: 217, mint: 231, sealed: 241 },
  },
  ip13: {
    "128": { broken: 48, fair: 104, good: 142, mint: 162, sealed: 190, verygood: 152 },
    "256": { broken: 52, fair: 138, good: 176, mint: 195, sealed: 218, verygood: 185 },
    "512": { broken: 57, fair: 147, good: 185, mint: 204, sealed: 238, verygood: 195 },
  },
  ip13mini: {
    "128": { fair: 76, good: 124, mint: 152, sealed: 180, verygood: 133 },
    "256": { fair: 104, good: 152, mint: 180, sealed: 190, verygood: 162 },
    "512": { fair: 124, good: 171, mint: 200, sealed: 195, verygood: 180 },
  },
  ip13p: {
    "128": { broken: 62, fair: 147, good: 204, mint: 233, sealed: 261, verygood: 218 },
    "1tb": { broken: 71, fair: 214, good: 271, mint: 299, sealed: 451, verygood: 285 },
    "256": { broken: 66, fair: 180, good: 238, mint: 266, sealed: 332, verygood: 252 },
    "512": { broken: 68, fair: 204, good: 261, mint: 290, sealed: 404, verygood: 276 },
  },
  ip13pm: {
    "128": { broken: 81, fair: 195, good: 252, mint: 280, sealed: 337, verygood: 266 },
    "1tb": { broken: 95, fair: 261, good: 318, mint: 347, sealed: 408, verygood: 332 },
    "256": { broken: 86, fair: 238, good: 294, mint: 323, sealed: 361, verygood: 309 },
    "512": { broken: 90, fair: 247, good: 304, mint: 332, sealed: 385, verygood: 318 },
  },
  ip14: {
    "128": { broken: 57, fair: 109, good: 152, mint: 176, sealed: 223, verygood: 166 },
    "256": { broken: 62, fair: 142, good: 185, mint: 209, sealed: 247, verygood: 200 },
    "512": { broken: 64, fair: 214, good: 256, mint: 280, sealed: 271, verygood: 271 },
  },
  ip14p: {
    "128": { broken: 119, fair: 180, good: 238, mint: 285, sealed: 314, verygood: 256 },
    "1tb": { broken: 138, fair: 256, good: 314, mint: 361, sealed: 370, verygood: 332 },
    "256": { broken: 128, fair: 209, good: 266, mint: 314, sealed: 337, verygood: 285 },
    "512": { broken: 133, fair: 238, good: 294, mint: 342, sealed: 352, verygood: 314 },
  },
  ip14plus: {
    "128": { broken: 90, fair: 142, good: 180, mint: 209, sealed: 247, verygood: 195 },
    "256": { broken: 95, fair: 180, good: 218, mint: 247, sealed: 294, verygood: 233 },
    "512": { broken: 100, fair: 200, good: 238, mint: 266, sealed: 318, verygood: 252 },
  },
  ip14pm: {
    "128": { broken: 152, fair: 256, good: 314, mint: 361, sealed: 390, verygood: 323 },
    "1tb": { broken: 209, fair: 332, good: 390, mint: 437, sealed: 446, verygood: 399 },
    "256": { broken: 171, fair: 276, good: 332, mint: 380, sealed: 418, verygood: 342 },
    "512": { broken: 190, fair: 304, good: 361, mint: 408, sealed: 428, verygood: 370 },
  },
  ip15: {
    "128": { broken: 95, fair: 204, good: 242, mint: 280, sealed: 328, verygood: 266 },
    "256": { broken: 104, fair: 242, good: 280, mint: 318, sealed: 375, verygood: 304 },
    "512": { broken: 109, fair: 271, good: 309, mint: 347, sealed: 423, verygood: 332 },
  },
  ip15p: {
    "128": { broken: 180, fair: 261, good: 309, mint: 356, sealed: 394, verygood: 328 },
    "1tb": { broken: 228, fair: 375, good: 423, mint: 470, sealed: 513, verygood: 442 },
    "256": { broken: 200, fair: 309, good: 356, mint: 404, sealed: 442, verygood: 375 },
    "512": { broken: 209, fair: 337, good: 385, mint: 432, sealed: 466, verygood: 404 },
  },
  ip15plus: {
    "128": { broken: 138, fair: 228, good: 266, mint: 314, sealed: 361, verygood: 285 },
    "256": { broken: 147, fair: 252, good: 290, mint: 337, sealed: 408, verygood: 309 },
    "512": { broken: 157, fair: 304, good: 342, mint: 390, sealed: 432, verygood: 361 },
  },
  ip15pm: {
    "1tb": { broken: 190, fair: 437, good: 480, mint: 522, sealed: 556, verygood: 504 },
    "256": { broken: 171, fair: 361, good: 404, mint: 446, sealed: 508, verygood: 428 },
    "512": { broken: 180, fair: 394, good: 437, mint: 480, sealed: 532, verygood: 461 },
  },
  ip16: {
    "128": { broken: 171, fair: 309, good: 366, mint: 413, sealed: 451, verygood: 380 },
    "256": { broken: 209, fair: 347, good: 404, mint: 451, sealed: 504, verygood: 418 },
    "512": { broken: 247, fair: 375, good: 432, mint: 480, sealed: 556, verygood: 446 },
  },
  ip16e: {
    "128": { broken: 66, fair: 152, good: 214, mint: 247, sealed: 285, verygood: 228 },
    "256": { broken: 86, fair: 218, good: 280, mint: 314, sealed: 337, verygood: 294 },
    "512": { broken: 104, fair: 266, good: 328, mint: 361, sealed: 390, verygood: 342 },
  },
  ip16p: {
    "128": { broken: 261, fair: 356, good: 437, mint: 484, sealed: 504, verygood: 461 },
    "1tb": { broken: 332, fair: 499, good: 580, mint: 627, sealed: 646, verygood: 603 },
    "256": { broken: 271, fair: 404, good: 484, mint: 532, sealed: 551, verygood: 508 },
    "512": { broken: 309, fair: 442, good: 522, mint: 570, sealed: 598, verygood: 546 },
  },
  ip16plus: {
    "128": { broken: 204, fair: 356, good: 404, mint: 432, sealed: 470, verygood: 418 },
    "256": { broken: 242, fair: 394, good: 442, mint: 470, sealed: 518, verygood: 456 },
    "512": { broken: 280, fair: 428, good: 475, mint: 504, sealed: 565, verygood: 489 },
  },
  ip16pm: {
    "1tb": { broken: 332, fair: 651, good: 712, mint: 741, sealed: 874, verygood: 722 },
    "256": { broken: 266, fair: 518, good: 580, mint: 608, sealed: 684, verygood: 589 },
    "512": { broken: 294, fair: 570, good: 632, mint: 660, sealed: 779, verygood: 641 },
  },
  // iPhone 17 PRICE_TABLE — Atlas Mobile wholesale buy sheet minus $100
  // buffer. Unlocked headlines; per-carrier deductions live in
  // CARRIER_DEDUCTIONS above. Skywalker 2026-05-18 — replaces older
  // numbers that were under-paying on premium (Pro/Pro Max) and
  // over-paying on low-end (17/17e) relative to Atlas + buffer.
  ip17: {
    "256": { broken: 145, fair: 305, good: 460, mint: 490, sealed: 520, verygood: 480 },
    "512": { broken: 195, fair: 370, good: 540, mint: 570, sealed: 660, verygood: 560 },
  },
  ip17air: {
    "1tb": { broken: 215, fair: 375, good: 720, mint: 750, sealed: 810, verygood: 740 },
    "256": { broken: 145, fair: 260, good: 520, mint: 550, sealed: 660, verygood: 540 },
    "512": { broken: 170, fair: 305, good: 620, mint: 650, sealed: 750, verygood: 640 },
  },
  ip17e: {
    "256": { broken: 100, fair: 160, good: 240, mint: 270, sealed: 270, verygood: 260 },
    "512": { broken: 140, fair: 190, good: 280, mint: 310, sealed: 310, verygood: 300 },
  },
  ip17p: {
    "1tb": { broken: 420, fair: 685, good: 980, mint: 1010, sealed: 1190, verygood: 1000 },
    "256": { broken: 350, fair: 550, good: 750, mint: 780, sealed: 900, verygood: 770 },
    "512": { broken: 385, fair: 595, good: 850, mint: 880, sealed: 1010, verygood: 870 },
  },
  ip17pm: {
    "1tb": { broken: 550, fair: 755, good: 1040, mint: 1070, sealed: 1345, verygood: 1060 },
    "256": { broken: 440, fair: 645, good: 850, mint: 880, sealed: 1020, verygood: 870 },
    "2tb": { broken: 595, fair: 820, good: 1140, mint: 1170, sealed: 1600, verygood: 1160 },
    "512": { broken: 485, fair: 690, good: 945, mint: 975, sealed: 1150, verygood: 965 },
  },
  // === SAMSUNG S SERIES (10% below IWM) ===
  gs24: {
    "128": { broken: 50, fair: 117, good: 162, mint: 189, sealed: 216, verygood: 171 },
    "256": { broken: 54, fair: 144, good: 189, mint: 216, sealed: 248, verygood: 198 },
    "512": { fair: 117, good: 162, mint: 189, sealed: 216, verygood: 171 },
  },
  gs24u: {
    "1tb": { broken: 153, fair: 342, good: 423, mint: 468, sealed: 590, verygood: 441 },
    "256": { broken: 135, fair: 270, good: 351, mint: 396, sealed: 432, verygood: 369 },
    "512": { broken: 144, fair: 288, good: 369, mint: 414, sealed: 500, verygood: 387 },
  },
  gs25: {
    "128": { broken: 54, fair: 189, good: 238, mint: 261, sealed: 297, verygood: 248 },
    "256": { broken: 58, fair: 225, good: 274, mint: 297, sealed: 328, verygood: 284 },
    "512": { broken: 54, fair: 189, good: 238, mint: 261, sealed: 297, verygood: 248 },
  },
  gs25p: {
    "256": { broken: 72, fair: 261, good: 306, mint: 360, sealed: 396, verygood: 324 },
    "512": { broken: 81, fair: 315, good: 360, mint: 414, sealed: 441, verygood: 378 },
  },
  gs25u: {
    "1tb": { broken: 153, fair: 486, good: 540, mint: 580, sealed: 603, verygood: 554 },
    "256": { broken: 135, fair: 418, good: 472, mint: 513, sealed: 558, verygood: 486 },
    "512": { broken: 144, fair: 441, good: 495, mint: 536, sealed: 580, verygood: 508 },
  },
  gs26: {
    "256": { broken: 90, fair: 284, good: 356, mint: 405, sealed: 450, verygood: 378 },
    "512": { broken: 99, fair: 306, good: 378, mint: 428, sealed: 477, verygood: 400 },
  },
  gs26p: {
    "256": { broken: 108, fair: 306, good: 387, mint: 450, sealed: 495, verygood: 414 },
    "512": { broken: 117, fair: 342, good: 423, mint: 486, sealed: 540, verygood: 450 },
  },
  gs26u: {
    "1tb": { broken: 144, fair: 468, good: 576, mint: 657, sealed: 720, verygood: 612 },
    "256": { broken: 126, fair: 396, good: 504, mint: 585, sealed: 630, verygood: 540 },
    "512": { broken: 135, fair: 432, good: 540, mint: 621, sealed: 675, verygood: 576 },
  },
  // === SAMSUNG Z SERIES ===
  gzflip5: {
    "256": { broken: 68, fair: 104, good: 148, mint: 176, sealed: 202, verygood: 158 },
    "512": { broken: 72, fair: 117, good: 162, mint: 189, sealed: 248, verygood: 171 },
  },
  gzflip6: {
    "256": { broken: 54, fair: 158, good: 198, mint: 234, sealed: 261, verygood: 216 },
    "512": { broken: 63, fair: 176, good: 216, mint: 252, sealed: 306, verygood: 234 },
  },
  gzflip7: {
    "256": { broken: 45, fair: 292, good: 351, mint: 387, sealed: 423, verygood: 369 },
    "512": { broken: 58, fair: 306, good: 364, mint: 400, sealed: 468, verygood: 382 },
  },
  gzfold5: {
    "1tb": { broken: 50, fair: 248, good: 292, mint: 320, sealed: 364, verygood: 302 },
    "256": { broken: 45, fair: 212, good: 256, mint: 284, sealed: 310, verygood: 266 },
    "512": { broken: 48, fair: 230, good: 274, mint: 302, sealed: 338, verygood: 284 },
  },
  gzfold6: {
    "1tb": { broken: 99, fair: 369, good: 414, mint: 468, sealed: 504, verygood: 450 },
    "256": { broken: 90, fair: 306, good: 351, mint: 405, sealed: 450, verygood: 387 },
    "512": { broken: 94, fair: 342, good: 387, mint: 441, sealed: 477, verygood: 423 },
  },
  gzfold7: {
    "1tb": { broken: 144, fair: 603, good: 693, mint: 738, sealed: 765, verygood: 729 },
    "256": { broken: 135, fair: 540, good: 630, mint: 675, sealed: 711, verygood: 666 },
    "512": { broken: 140, fair: 576, good: 666, mint: 711, sealed: 738, verygood: 702 },
  },
  gztrifold: {
    "1tb": { broken: 189, fair: 945, good: 1395, mint: 1845, sealed: 2138, verygood: 1620 },
    "512": { broken: 180, fair: 900, good: 1350, mint: 1800, sealed: 2070, verygood: 1575 },
  },
  // === PIXEL (10% below IWM) ===
  px10pxl: {
    "1tb": { broken: 126, fair: 378, good: 432, mint: 450, sealed: 477, verygood: 441 },
    "256": { broken: 104, fair: 333, good: 387, mint: 405, sealed: 432, verygood: 396 },
    "512": { broken: 112, fair: 364, good: 418, mint: 436, sealed: 464, verygood: 428 },
  },
  px10p: {
    "128": { broken: 68, fair: 252, good: 315, mint: 360, sealed: 387, verygood: 337 },
    "1tb": { broken: 81, fair: 333, good: 396, mint: 441, sealed: 468, verygood: 418 },
    "256": { broken: 72, fair: 288, good: 351, mint: 396, sealed: 423, verygood: 373 },
    "512": { broken: 76, fair: 319, good: 382, mint: 427, sealed: 454, verygood: 405 },
  },
  px10: {
    "128": { broken: 68, fair: 216, good: 274, mint: 297, sealed: 333, verygood: 288 },
    "256": { broken: 76, fair: 234, good: 292, mint: 315, sealed: 356, verygood: 306 },
  },
  px9pxl: {
    "128": { broken: 68, fair: 189, good: 243, mint: 288, sealed: 315, verygood: 261 },
    "1tb": { broken: 74, fair: 243, good: 297, mint: 342, sealed: 396, verygood: 315 },
    "256": { broken: 72, fair: 207, good: 261, mint: 306, sealed: 351, verygood: 279 },
    "512": { broken: 72, fair: 225, good: 279, mint: 324, sealed: 382, verygood: 297 },
  },
  px9p: {
    "128": { broken: 45, fair: 126, good: 180, mint: 216, sealed: 243, verygood: 189 },
    "1tb": { broken: 50, fair: 194, good: 248, mint: 284, sealed: 324, verygood: 256 },
    "256": { broken: 47, fair: 153, good: 207, mint: 243, sealed: 279, verygood: 216 },
    "512": { broken: 49, fair: 171, good: 225, mint: 261, sealed: 310, verygood: 234 },
  },
  px9: {
    "128": { broken: 40, fair: 112, good: 153, mint: 198, sealed: 225, verygood: 171 },
    "256": { broken: 45, fair: 130, good: 175, mint: 220, sealed: 247, verygood: 193 },
  },
  px8p: {
    "128": { broken: 32, fair: 112, good: 144, mint: 184, sealed: 207, verygood: 162 },
    "1tb": { broken: 36, fair: 148, good: 180, mint: 220, sealed: 274, verygood: 198 },
    "256": { broken: 33, fair: 122, good: 153, mint: 194, sealed: 243, verygood: 171 },
    "512": { broken: 34, fair: 140, good: 171, mint: 212, sealed: 261, verygood: 189 },
  },
  // === CONSOLES (10% below IWM) ===
  ps5pro: {
    "base": { broken: 8, fair: 297, good: 378, mint: 450, sealed: 495, verygood: 414 },
  },
  ps5slim: {
    "base": { broken: 8, fair: 99, good: 171, mint: 225, sealed: 252, verygood: 198 },
  },
  ps5: {
    "base": { broken: 8, fair: 112, good: 180, mint: 238, sealed: 270, verygood: 212 },
  },
  nsw2: {
    "base": { broken: 54, fair: 153, good: 225, mint: 248, sealed: 279 },
  },
  nswoled: {
    "base": { broken: 21, fair: 36, good: 72, mint: 90, sealed: 112 },
  },
  // === AUDIT FIXES — devices that were >15% off with multiplier fallback ===
  gs23u: {
    "1tb": { broken: 33, fair: 212, good: 261, mint: 292, sealed: 310, verygood: 279 },
    "256": { broken: 32, fair: 158, good: 207, mint: 238, sealed: 266, verygood: 225 },
    "512": { broken: 32, fair: 176, good: 225, mint: 256, sealed: 288, verygood: 243 },
  },
  gs22: {
    "128": { broken: 18, fair: 36, good: 58, mint: 72, sealed: 90 },
    "256": { broken: 22, fair: 45, good: 68, mint: 81, sealed: 108 },
  },
  gzflip4: {
    "128": { broken: 14, fair: 9, good: 27, mint: 36, sealed: 50 },
    "256": { broken: 14, fair: 14, good: 32, mint: 40, sealed: 54 },
    "512": { broken: 15, fair: 14, good: 32, mint: 40, sealed: 58 },
  },
  px8: {
    "128": { broken: 22, fair: 68, good: 108, mint: 126, sealed: 166, verygood: 117 },
    "256": { broken: 27, fair: 90, good: 130, mint: 148, sealed: 189, verygood: 140 },
  },
  // === AUDIT ROUND 2 — 5 more devices with >15% multiplier error ===
  gs24p: {
    "256": { broken: 72, fair: 144, good: 198, mint: 230, sealed: 266, verygood: 212 },
    "512": { broken: 81, fair: 180, good: 234, mint: 266, sealed: 310, verygood: 248 },
  },
  gs21: {
    "128": { broken: 9, fair: 18, good: 27, mint: 40, sealed: 68 },
    "256": { broken: 9, fair: 27, good: 36, mint: 50, sealed: 86 },
  },
  px7p: {
    "128": { broken: 22, fair: 45, good: 72, mint: 108, sealed: 135 },
    "256": { broken: 27, fair: 58, good: 86, mint: 122, sealed: 144 },
    "512": { broken: 29, fair: 63, good: 90, mint: 126, sealed: 148 },
  },
  gs20: {
    "base": { broken: 14, fair: 45, good: 58, mint: 68, sealed: 90 },
  },
  // === FULL IWM SCRAPE — all remaining devices ===
  gnote10: {
    "base": { broken: 9, sealed: 99 },
    "brandnew": { fair: 140, good: 162, mint: 171 },
    "broken": { fair: 50, good: 72, mint: 81 },
    "fair": { fair: 81, good: 104, mint: 112 },
    "flawless": { fair: 112, good: 135, mint: 144 },
    "good": { fair: 104, good: 126, mint: 135 },
  },
  gnote10p: {
    "256": { broken: 38, fair: 45, good: 99, mint: 117, sealed: 135 },
    "512": { broken: 47, fair: 54, good: 108, mint: 126, sealed: 158 },
  },
  gnote10p5g: {
    "256": { broken: 36, fair: 45, good: 99, mint: 117, sealed: 135 },
    "512": { broken: 50, fair: 58, good: 112, mint: 130, sealed: 158 },
  },
  gnote20: {
    "128": { fair: 68, good: 81, mint: 90, sealed: 117 },
    "256": { fair: 76, good: 90, mint: 99, sealed: 130 },
  },
  gnote9: {
    "128": { broken: 9, fair: 27, good: 54, mint: 68, sealed: 94 },
    "512": { broken: 18, fair: 36, good: 63, mint: 76, sealed: 113 },
  },
  gs20fe: {
    "128": { broken: 14, fair: 18, good: 32, mint: 40, sealed: 63 },
    "256": { broken: 22, fair: 27, good: 40, mint: 50, sealed: 81 },
  },
  gs20p: {
    "128": { broken: 14, fair: 36, good: 68, mint: 76, sealed: 104 },
    "512": { broken: 15, fair: 58, good: 90, mint: 99, sealed: 130 },
  },
  gs20u: {
    "128": { broken: 14, fair: 68, good: 104, mint: 122, sealed: 148 },
    "256": { broken: 18, fair: 76, good: 112, mint: 130, sealed: 158 },
    "512": { broken: 22, fair: 86, good: 122, mint: 140, sealed: 166 },
  },
  gs21fe: {
    "128": { broken: 9, fair: 22, good: 27, mint: 36, sealed: 54 },
    "256": { broken: 14, fair: 32, good: 36, mint: 45, sealed: 72 },
  },
  gs21p: {
    "128": { broken: 14, fair: 36, good: 54, mint: 63, sealed: 90 },
    "256": { broken: 14, fair: 45, good: 63, mint: 72, sealed: 118 },
  },
  gs21u: {
    "128": { broken: 22, fair: 54, good: 72, mint: 81, sealed: 99 },
    "256": { broken: 24, fair: 63, good: 81, mint: 90, sealed: 108 },
    "512": { broken: 25, fair: 68, good: 86, mint: 94, sealed: 112 },
  },
  gs22p: {
    "128": { broken: 22, fair: 63, good: 86, mint: 99, sealed: 126 },
    "256": { broken: 27, fair: 72, good: 94, mint: 108, sealed: 148 },
  },
  gs22u: {
    "128": { broken: 27, fair: 76, good: 108, mint: 126, sealed: 162 },
    "1tb": { broken: 27, fair: 99, good: 130, mint: 148, sealed: 280 },
    "256": { broken: 27, fair: 90, good: 122, mint: 140, sealed: 204 },
    "512": { broken: 27, fair: 94, good: 126, mint: 144, sealed: 242 },
  },
  gs23: {
    "128": { broken: 22, fair: 72, good: 94, mint: 117, sealed: 153, verygood: 108 },
    "256": { broken: 23, fair: 90, good: 112, mint: 135, sealed: 184, verygood: 126 },
    "512": { broken: 23, fair: 94, good: 117, mint: 140, sealed: 198, verygood: 130 },
  },
  gs23fe: {
    "128": { broken: 14, fair: 32, good: 63, mint: 81, sealed: 90, verygood: 68 },
    "256": { broken: 15, fair: 40, good: 72, mint: 90, sealed: 108, verygood: 76 },
  },
  gs23p: {
    "128": { broken: 72, sealed: 207 },
    "256": { broken: 76, fair: 112, good: 162, mint: 180, sealed: 234, verygood: 171 },
    "512": { broken: 78, fair: 122, good: 171, mint: 189, sealed: 252, verygood: 180 },
  },
  gs24fe: {
    "128": { broken: 22, fair: 72, good: 117, mint: 135, sealed: 171, verygood: 126 },
    "256": { broken: 32, fair: 90, good: 135, mint: 153, sealed: 189, verygood: 144 },
  },
  gs25edge: {
    "256": { broken: 90, fair: 234, good: 279, mint: 315, sealed: 351, verygood: 288 },
    "512": { broken: 99, fair: 256, good: 302, mint: 338, sealed: 382, verygood: 310 },
  },
  gs25fe: {
    "128": { broken: 22, fair: 72, good: 194, mint: 220, sealed: 256, verygood: 202 },
    "256": { broken: 32, fair: 90, good: 212, mint: 238, sealed: 274, verygood: 220 },
    "512": { broken: 22, sealed: 256 },
  },
  gzflip3: {
    "128": { broken: 9, fair: 14, good: 27, mint: 36, sealed: 54 },
    "256": { broken: 14, fair: 22, good: 36, mint: 45, sealed: 68 },
  },
  gzfold3: {
    "256": { broken: 18, fair: 72, good: 108, mint: 126, sealed: 153 },
    "512": { broken: 22, fair: 86, good: 122, mint: 140, sealed: 180 },
  },
  gzfold4: {
    "1tb": { broken: 27, fair: 144, good: 189, mint: 220, sealed: 270, verygood: 202 },
    "256": { broken: 22, fair: 112, good: 158, mint: 189, sealed: 216, verygood: 171 },
    "512": { broken: 25, fair: 130, good: 176, mint: 207, sealed: 243, verygood: 189 },
  },
  ipad10: {
    "256": { broken: 33, fair: 108, good: 144, mint: 171, sealed: 198, verygood: 158 },
    "64": { fair: 63, good: 99, mint: 126, sealed: 153, verygood: 113 },
  },
  ipad9: {
    "256": { fair: 43, good: 76, mint: 86, sealed: 100, verygood: 81 },
    "64": { fair: 28, good: 62, mint: 71, sealed: 90, verygood: 66 },
  },
  ipadair11m2: {
    "128": { broken: 128, fair: 190, good: 242, mint: 276, sealed: 304, verygood: 252 },
    "1tb": { broken: 200, fair: 332, good: 385, mint: 418, sealed: 446, verygood: 394 },
    "256": { broken: 152, fair: 218, good: 271, mint: 304, sealed: 352, verygood: 280 },
    "512": { broken: 176, fair: 276, good: 328, mint: 361, sealed: 399, verygood: 337 },
  },
  ipadair11m3: {
    "128": { broken: 119, fair: 167, good: 225, mint: 270, sealed: 297, verygood: 257 },
    "1tb": { broken: 190, fair: 302, good: 360, mint: 405, sealed: 432, verygood: 392 },
    "256": { broken: 142, fair: 189, good: 248, mint: 293, sealed: 320, verygood: 279 },
    "512": { broken: 166, fair: 234, good: 293, mint: 338, sealed: 365, verygood: 324 },
  },
  ipadair13m2: {
    "128": { broken: 100, fair: 242, good: 290, mint: 337, sealed: 375, verygood: 309 },
    "1tb": { broken: 142, fair: 385, good: 432, mint: 480, sealed: 470, verygood: 451 },
    "256": { broken: 124, fair: 290, good: 337, mint: 385, sealed: 423, verygood: 356 },
    "512": { broken: 133, fair: 337, good: 385, mint: 432, sealed: 446, verygood: 404 },
  },
  ipadmini6: {
    "256": { broken: 40, fair: 133, good: 171, mint: 190, sealed: 195 },
    "64": { broken: 38, fair: 95, good: 133, mint: 152, sealed: 171 },
  },
  ipadmini7: {
    "128": { broken: 57, fair: 171, good: 216, mint: 234, sealed: 261, verygood: 234 },
    "256": { broken: 66, fair: 207, good: 252, mint: 270, sealed: 297, verygood: 270 },
    "512": { broken: 76, fair: 306, good: 351, mint: 369, sealed: 396, verygood: 369 },
  },
  ipadpro11g4: {
    "128": { broken: 95, fair: 252, good: 294, mint: 332, sealed: 361, verygood: 314 },
    "1tb": { broken: 109, fair: 394, good: 437, mint: 475, sealed: 598, verygood: 456 },
    "256": { broken: 100, fair: 299, good: 342, mint: 380, sealed: 408, verygood: 361 },
    "2tb": { broken: 114, fair: 442, good: 484, mint: 522, sealed: 765, verygood: 504 },
    "512": { broken: 104, fair: 323, good: 366, mint: 404, sealed: 456, verygood: 385 },
  },
  ipadpro11m4: {
    "1tb": { broken: 285, fair: 495, good: 549, mint: 585, sealed: 621, verygood: 567 },
    "256": { broken: 190, fair: 360, good: 414, mint: 450, sealed: 486, verygood: 432 },
    "2tb": { broken: 332, fair: 563, good: 617, mint: 653, sealed: 689, verygood: 635 },
    "512": { broken: 238, fair: 405, good: 459, mint: 495, sealed: 531, verygood: 477 },
  },
  ipadpro11m5: {
    "1tb": { broken: 261, fair: 608, good: 656, mint: 712, sealed: 808, verygood: 674 },
    "256": { broken: 166, fair: 466, good: 513, mint: 570, sealed: 618, verygood: 532 },
    "2tb": { broken: 309, fair: 703, good: 750, mint: 808, sealed: 902, verygood: 770 },
    "512": { broken: 214, fair: 513, good: 560, mint: 618, sealed: 665, verygood: 580 },
  },
  ipadpro129g6: {
    "128": { broken: 119, fair: 242, good: 304, mint: 390, sealed: 456, verygood: 342 },
    "1tb": { broken: 152, fair: 352, good: 413, mint: 499, sealed: 598, verygood: 451 },
    "256": { broken: 128, fair: 280, good: 342, mint: 428, sealed: 527, verygood: 380 },
    "2tb": { broken: 166, fair: 394, good: 456, mint: 542, sealed: 646, verygood: 494 },
    "512": { broken: 133, fair: 299, good: 361, mint: 446, sealed: 551, verygood: 399 },
  },
  ipadpro13m4: {
    "1tb": { broken: 238, fair: 518, good: 580, mint: 627, sealed: 788, verygood: 598 },
    "256": { broken: 190, fair: 404, good: 466, mint: 513, sealed: 551, verygood: 484 },
    "2tb": { broken: 261, fair: 622, good: 684, mint: 732, sealed: 978, verygood: 703 },
    "512": { broken: 214, fair: 461, good: 522, mint: 570, sealed: 646, verygood: 542 },
  },
  ipadpro13m5: {
    "1tb": { broken: 332, fair: 738, good: 792, mint: 864, sealed: 900, verygood: 819 },
    "256": { broken: 261, fair: 513, good: 567, mint: 639, sealed: 675, verygood: 594 },
    "2tb": { broken: 356, fair: 873, good: 927, mint: 999, sealed: 1035, verygood: 954 },
    "512": { broken: 285, fair: 603, good: 657, mint: 729, sealed: 765, verygood: 684 },
  },
  px10a: {
    "128": { broken: 45, fair: 99, good: 153, mint: 198, sealed: 225, verygood: 180 },
    "256": { broken: 54, fair: 117, good: 171, mint: 216, sealed: 248, verygood: 198 },
  },
  px5: {
    "base": { broken: 4, fair: 18, good: 32, mint: 40, sealed: 54 },
  },
  px5a: {
    "base": { broken: 27, fair: 22, good: 32, mint: 36, sealed: 50 },
  },
  px6: {
    "128": { broken: 9, fair: 32, good: 45, mint: 58, sealed: 86 },
    "256": { broken: 11, fair: 40, good: 54, mint: 68, sealed: 99 },
  },
  px6p: {
    "128": { broken: 14, fair: 40, good: 68, mint: 81, sealed: 108 },
    "256": { broken: 14, fair: 50, good: 76, mint: 90, sealed: 112 },
    "512": { broken: 14, fair: 54, good: 81, mint: 94, sealed: 117 },
  },
  px7: {
    "128": { broken: 14, fair: 36, good: 51, mint: 63, sealed: 99 },
    "256": { broken: 22, fair: 54, good: 69, mint: 81, sealed: 108 },
  },
  px7a: {
    "base": { broken: 14, fair: 45, good: 63, mint: 72, sealed: 99 },
  },
  px8a: {
    "128": { broken: 18, fair: 72, good: 108, mint: 126, sealed: 162, verygood: 117 },
    "256": { broken: 18, fair: 81, good: 117, mint: 135, sealed: 184, verygood: 126 },
  },
  px9a: {
    "128": { broken: 45, fair: 90, good: 130, mint: 158, sealed: 189, verygood: 140 },
    "256": { broken: 50, fair: 108, good: 148, mint: 176, sealed: 212, verygood: 158 },
  },
  px9pfold: {
    "256": { broken: 99, fair: 292, good: 360, mint: 405, sealed: 450, verygood: 378 },
    "512": { broken: 108, fair: 320, good: 387, mint: 432, sealed: 540, verygood: 405 },
  },
  pxfold: {
    "256": { broken: 32, fair: 90, good: 135, mint: 158, sealed: 202, verygood: 144 },
    "512": { broken: 32, fair: 126, good: 171, mint: 194, sealed: 248, verygood: 180 },
  },
  switch: {
    "base": { broken: 21, fair: 32, good: 54, mint: 81, sealed: 108, verygood: 68 },
  },
  switchlite: {
    "base": { broken: 21, fair: 22, good: 36, mint: 50, sealed: 68 },
  },
  xone: {
    "base": { broken: 21, fair: 54, good: 81, mint: 99, sealed: 117 },
  },

  // === MACBOOKS + WATCHES + REMAINING ===
  awu1: {
    "base": { fair: 36, good: 86, mint: 126, sealed: 144, verygood: 108 },
  },
  awu2: {
    "base": { fair: 90, good: 135, mint: 180, sealed: 216, verygood: 162 },
  },
  awu3: {
    "base": { broken: 45, fair: 171, good: 252, mint: 302, sealed: 338, verygood: 279 },
  },
  mba13m3: {
    "1tb": { fair: 432, good: 540, mint: 648, sealed: 693, verygood: 594 },
    "2tb": { fair: 544, good: 652, mint: 760, sealed: 806, verygood: 706 },
  },
  mba15m3: {
    "1tb": { fair: 472, good: 594, mint: 675, sealed: 729, verygood: 634 },
    "2tb": { fair: 562, good: 684, mint: 765, sealed: 819, verygood: 724 },
  },
  mba_m4_2025: {
    "1tb": { fair: 531, good: 644, mint: 778, sealed: 824, verygood: 711 },
    "2tb": { fair: 711, good: 824, mint: 958, sealed: 1004, verygood: 891 },
  },
  mba_m5_2026: {
    "1tb": { fair: 585, good: 698, mint: 832, sealed: 922, verygood: 765 },
    "2tb": { fair: 900, good: 1012, mint: 1148, sealed: 1238, verygood: 1080 },
    "4tb": { fair: 1350, good: 1462, mint: 1598, sealed: 1688, verygood: 1530 },
  },
  mbp13m1: {
    "2tb": { fair: 468, good: 558, mint: 626, sealed: 675, verygood: 616 },
  },
  mbp14m2: {
    "2tb": { fair: 630, good: 765, mint: 945, sealed: 990, verygood: 855 },
    "4tb": { fair: 810, good: 945, mint: 1125, sealed: 1170, verygood: 1035 },
    "8tb": { fair: 900, good: 1125, mint: 1350, sealed: 1404, verygood: 1215 },
  },
  mbp14m3: {
    "1tb": { fair: 891, good: 981, mint: 1080, sealed: 1107, verygood: 1030 },
    "2tb": { fair: 900, good: 1080, mint: 1215, sealed: 1260, verygood: 1148 },
    "4tb": { fair: 1035, good: 1215, mint: 1395, sealed: 1462, verygood: 1314 },
    "512": { fair: 756, good: 846, mint: 945, sealed: 972, verygood: 896 },
    "8tb": { fair: 2160, good: 2565, mint: 2835, sealed: 2925, verygood: 2700 },
  },
  mbp16_m5pmax_2026: {
    "2tb": { fair: 2340, good: 2475, mint: 2610, sealed: 2745, verygood: 2542 },
  },
  mbp16m2: {
    "2tb": { fair: 1215, good: 1408, mint: 1620, sealed: 1665, verygood: 1521 },
    "4tb": { fair: 1170, good: 1418, mint: 1710, sealed: 1778, verygood: 1575 },
    "8tb": { fair: 1350, good: 1598, mint: 1890, sealed: 1958, verygood: 1755 },
  },
  mbp16m3: {
    "2tb": { fair: 1350, good: 1485, mint: 1665, sealed: 1732, verygood: 1575 },
    "4tb": { fair: 1620, good: 1755, mint: 1935, sealed: 2002, verygood: 1845 },
    "8tb": { fair: 1845, good: 2025, mint: 2295, sealed: 2362, verygood: 2160 },
  },
  mbp16m4: {
    "2tb": { fair: 1935, good: 2070, mint: 2205, sealed: 2295, verygood: 2138 },
  },
  xss: {
    "base": { broken: 21, fair: 54, good: 90, mint: 135, sealed: 158, verygood: 112 },
    "carbonblack": { broken: 43, fair: 86, good: 148, mint: 184, sealed: 220, verygood: 166 },
  },
  aws10: {
    "base": { fair: 23, good: 59, mint: 95, sealed: 117, verygood: 77 },
  },
  aws7: {
    "base": { good: 9, mint: 27, sealed: 40, verygood: 18 },
  },
  aws8: {
    "base": { good: 18, mint: 40, sealed: 63, verygood: 27 },
  },
  aws9: {
    "base": { fair: 14, good: 40, mint: 63, sealed: 81, verygood: 50 },
  },
  awse2: {
    "base": { good: 9, mint: 18, sealed: 40 },
  },
  mba13m2: {
    "1tb": { fair: 310, good: 387, mint: 446, sealed: 482, verygood: 418 },
    "256": { fair: 198, good: 274, mint: 333, sealed: 369, verygood: 306 },
    "2tb": { fair: 356, good: 432, mint: 490, sealed: 526, verygood: 464 },
    "512": { fair: 243, good: 320, mint: 378, sealed: 414, verygood: 351 },
  },
  mba15m2: {
    "1tb": { fair: 374, good: 441, mint: 486, sealed: 513, verygood: 464 },
    "256": { fair: 284, good: 351, mint: 396, sealed: 423, verygood: 374 },
    "2tb": { fair: 464, good: 531, mint: 576, sealed: 603, verygood: 554 },
    "512": { fair: 328, good: 396, mint: 441, sealed: 468, verygood: 418 },
  },
  mbp14_m5_2025: {
    "1tb": { fair: 788, good: 891, mint: 990, sealed: 1058, verygood: 936 },
    "2tb": { fair: 878, good: 981, mint: 1080, sealed: 1148, verygood: 1026 },
    "4tb": { fair: 1102, good: 1206, mint: 1305, sealed: 1372, verygood: 1251 },
    "512": { fair: 652, good: 756, mint: 855, sealed: 922, verygood: 801 },
  },
  mbp14_m5pmax_2026: {
    "1tb": { fair: 788, good: 891, mint: 990, sealed: 1058, verygood: 936 },
    "2tb": { fair: 878, good: 981, mint: 1080, sealed: 1148, verygood: 1026 },
    "4tb": { fair: 1102, good: 1206, mint: 1305, sealed: 1372, verygood: 1251 },
    "512": { fair: 652, good: 756, mint: 855, sealed: 922, verygood: 801 },
  },
  mbp14m4: {
    "1tb": { fair: 765, good: 868, mint: 968, sealed: 1012, verygood: 914 },
    "2tb": { fair: 878, good: 981, mint: 1080, sealed: 1125, verygood: 1026 },
    "512": { fair: 652, good: 756, mint: 855, sealed: 900, verygood: 801 },
  },
  ps4: {
    "base": { broken: 8, fair: 14, good: 27, mint: 45, sealed: 63 },
  },
  ps4pro: {
    "base": { broken: 21, fair: 45, good: 86, mint: 108, sealed: 135 },
  },
  // === WATCHES + DESKTOPS + CONSOLES (IWM scrape) ===
  macminim4p: {
    "1tb": { fair: 626, good: 680, mint: 742, sealed: 788, verygood: 720 },
    "256gb": { fair: 356, good: 410, mint: 472, sealed: 518, verygood: 450 },
    "2tb": { fair: 896, good: 950, mint: 1012, sealed: 1058, verygood: 990 },
    "512gb": { fair: 490, good: 544, mint: 608, sealed: 652, verygood: 585 },
  },
  macprom2u: {
    "1tb": { fair: 2340, good: 2745, mint: 3150, sealed: 3420, verygood: 2970 },
    "2tb": { fair: 2475, good: 2880, mint: 3285, sealed: 3555, verygood: 3105 },
    "4tb": { fair: 2610, good: 3015, mint: 3420, sealed: 3690, verygood: 3240 },
    "8tb": { fair: 2880, good: 3285, mint: 3690, sealed: 3960, verygood: 3510 },
  },
  macstudiom2u: {
    "1tb": { fair: 675, good: 796, mint: 945, sealed: 1012, verygood: 891 },
    "2tb": { fair: 810, good: 932, mint: 1080, sealed: 1148, verygood: 1026 },
    "4tb": { fair: 1080, good: 1202, mint: 1350, sealed: 1418, verygood: 1296 },
    "512gb": { fair: 540, good: 662, mint: 810, sealed: 878, verygood: 756 },
    "8tb": { fair: 1260, good: 1382, mint: 1530, sealed: 1598, verygood: 1476 },
  },
  macstudiom4u: {
    "1tb": { fair: 1665, good: 1822, mint: 1980, sealed: 2115, verygood: 1912 },
    "2tb": { fair: 1890, good: 2048, mint: 2205, sealed: 2340, verygood: 2138 },
    "4tb": { fair: 2160, good: 2318, mint: 2475, sealed: 2610, verygood: 2408 },
    "512gb": { fair: 1440, good: 1598, mint: 1755, sealed: 1890, verygood: 1688 },
    "8tb": { fair: 2520, good: 2678, mint: 2835, sealed: 2970, verygood: 2768 },
  },
  pw1: {
    "base": { fair: 4, good: 9, mint: 18, sealed: 32 },
  },
  imac24m1: {
    "16gbunifiedmemory": { fair: 279, good: 324, mint: 360, sealed: 387, verygood: 342 },
    "1tb": { fair: 306, good: 351, mint: 387, sealed: 414, verygood: 369 },
    "256gb": { fair: 234, good: 279, mint: 315, sealed: 342, verygood: 297 },
    "512gb": { fair: 270, good: 315, mint: 351, sealed: 378, verygood: 333 },
    "8gbunifiedmemory": { fair: 234, good: 279, mint: 315, sealed: 342, verygood: 297 },
  },
  imac24m3: {
    "16gbunifiedmemory": { fair: 261, good: 333, mint: 405, sealed: 450, verygood: 369 },
    "1tb": { fair: 306, good: 378, mint: 450, sealed: 495, verygood: 414 },
    "24gbunifiedmemory": { fair: 306, good: 378, mint: 450, sealed: 495, verygood: 414 },
    "256gb": { fair: 216, good: 288, mint: 360, sealed: 405, verygood: 324 },
    "512gb": { fair: 261, good: 333, mint: 405, sealed: 450, verygood: 369 },
    "8gbunifiedmemory": { fair: 216, good: 288, mint: 360, sealed: 405, verygood: 324 },
  },
  imac24m4: {
    "16gbunifiedmemory": { fair: 315, good: 428, mint: 518, sealed: 585, verygood: 472 },
    "1tb": { fair: 540, good: 652, mint: 742, sealed: 810, verygood: 698 },
    "24gbunifiedmemory": { fair: 495, good: 608, mint: 698, sealed: 765, verygood: 652 },
    "256gb": { fair: 315, good: 428, mint: 518, sealed: 585, verygood: 472 },
    "512gb": { fair: 428, good: 540, mint: 630, sealed: 698, verygood: 585 },
  },
  macminim1: {
    "1tb": { fair: 315, good: 342, mint: 360, sealed: 382, verygood: 351 },
    "256gb": { fair: 248, good: 274, mint: 292, sealed: 315, verygood: 284 },
    "2tb": { fair: 360, good: 387, mint: 405, sealed: 428, verygood: 396 },
    "512gb": { fair: 270, good: 297, mint: 315, sealed: 338, verygood: 306 },
  },
  macminim2: {
    "16gbunifiedmemory": { fair: 243, good: 297, mint: 360, sealed: 396, verygood: 338 },
    "1tb": { fair: 266, good: 320, mint: 382, sealed: 418, verygood: 360 },
    "24gbunifiedmemory": { fair: 288, good: 342, mint: 405, sealed: 441, verygood: 382 },
    "256gb": { fair: 198, good: 252, mint: 315, sealed: 351, verygood: 292 },
    "2tb": { fair: 333, good: 387, mint: 450, sealed: 486, verygood: 428 },
    "512gb": { fair: 230, good: 284, mint: 346, sealed: 382, verygood: 324 },
    "8gbunifiedmemory": { fair: 198, good: 252, mint: 315, sealed: 351, verygood: 292 },
  },
  macminim4: {
    "16gbunifiedmemory": { fair: 356, good: 410, mint: 472, sealed: 518, verygood: 450 },
    "1tb": { fair: 626, good: 680, mint: 742, sealed: 788, verygood: 720 },
    "24gbunifiedmemory": { fair: 536, good: 590, mint: 652, sealed: 698, verygood: 630 },
    "256gb": { fair: 356, good: 410, mint: 472, sealed: 518, verygood: 450 },
    "2tb": { fair: 896, good: 950, mint: 1012, sealed: 1058, verygood: 990 },
    "32gbunifiedmemory": { fair: 716, good: 770, mint: 832, sealed: 878, verygood: 810 },
    "512gb": { fair: 490, good: 544, mint: 608, sealed: 652, verygood: 585 },
  },
  macstudiom2m: {
    "1tb": { fair: 675, good: 796, mint: 945, sealed: 1012, verygood: 891 },
    "2tb": { fair: 810, good: 932, mint: 1080, sealed: 1148, verygood: 1026 },
    "32gbunifiedmemory": { fair: 540, good: 662, mint: 810, sealed: 878, verygood: 756 },
    "4tb": { fair: 1080, good: 1202, mint: 1350, sealed: 1418, verygood: 1296 },
    "512gb": { fair: 540, good: 662, mint: 810, sealed: 878, verygood: 756 },
    "64gbunifiedmemory": { fair: 855, good: 976, mint: 1125, sealed: 1192, verygood: 1071 },
    "8tb": { fair: 1260, good: 1382, mint: 1530, sealed: 1598, verygood: 1476 },
  },
  macstudiom4m: {
    "1tb": { fair: 1665, good: 1822, mint: 1980, sealed: 2115, verygood: 1912 },
    "2tb": { fair: 1890, good: 2048, mint: 2205, sealed: 2340, verygood: 2138 },
    "36gbunifiedmemory": { fair: 1440, good: 1598, mint: 1755, sealed: 1890, verygood: 1688 },
    "4tb": { fair: 2160, good: 2318, mint: 2475, sealed: 2610, verygood: 2408 },
    "512gb": { fair: 1440, good: 1598, mint: 1755, sealed: 1890, verygood: 1688 },
    "8tb": { fair: 2520, good: 2678, mint: 2835, sealed: 2970, verygood: 2768 },
  },
  pw2: {
    "base": { fair: 4, good: 9, mint: 18, sealed: 32 },
  },
  pw3: {
    "pixelwatch3bluetoothwifi": { fair: 4, good: 18, mint: 27, sealed: 54 },
    "pixelwatch3bluetoothwifi4glte": { broken: 4, fair: 9, good: 22, mint: 32, sealed: 58 },
  },
  pw4: {
    "pixelwatch4bluetoothwifi": { fair: 27, good: 72, mint: 108, sealed: 144, verygood: 90 },
    "pixelwatch4bluetoothwifi4glte": { broken: 9, fair: 36, good: 81, mint: 117, sealed: 153, verygood: 99 },
  },
  sgw7: {
    "bluetoothwifi": { good: 9, mint: 18, sealed: 32 },
    "bluetoothwifi4glte": { fair: 4, good: 14, mint: 22, sealed: 36 },
  },
  sgw8: {
    "bluetoothwifi": { fair: 18, good: 45, mint: 63, sealed: 86 },
    "bluetoothwifi4glte": { fair: 27, good: 54, mint: 72, sealed: 94 },
  },
  sgw8c: {
    "bluetoothwifi": { fair: 54, good: 76, mint: 99, sealed: 122, verygood: 90 },
    "bluetoothwifi4glte": { fair: 63, good: 86, mint: 108, sealed: 130, verygood: 99 },
  },
  sgwu: {
    "base": { fair: 22, good: 58, mint: 90, sealed: 112, verygood: 76 },
  },
  sgwu25: {
    "base": { fair: 72, good: 112, mint: 144, sealed: 176, verygood: 130 },
  },
  switchv2: {
    "base": { broken: 21, fair: 32, good: 54, mint: 81, sealed: 108, verygood: 68 },
  },
  xsx: {
    "1tb": { broken: 8, fair: 162, good: 225, mint: 274, sealed: 315, verygood: 252 },
    "2tb": { broken: 8, fair: 252, good: 342, mint: 387, sealed: 428, verygood: 369 },
  },
  // === SAMSUNG TABLETS (10% below IWM) ===
  stabs11u: {
    "256": { broken: 90, fair: 369, good: 468, mint: 513, sealed: 567, verygood: 495 },
    "512": { broken: 99, fair: 423, good: 522, mint: 567, sealed: 621, verygood: 549 },
    "1tb": { broken: 104, fair: 481, good: 580, mint: 625, sealed: 679, verygood: 607 },
  },
  stabs11: {
    "128": { broken: 58, fair: 225, good: 288, mint: 324, sealed: 342, verygood: 306 },
    "256": { broken: 63, fair: 247, good: 310, mint: 346, sealed: 364, verygood: 328 },
    "512": { broken: 68, fair: 270, good: 333, mint: 369, sealed: 387, verygood: 351 },
  },
  stabs10u: {
    "256": { broken: 76, fair: 333, good: 382, mint: 418, sealed: 454, verygood: 400 },
    "512": { broken: 81, fair: 369, good: 418, mint: 454, sealed: 490, verygood: 436 },
    "1tb": { broken: 86, fair: 436, good: 486, mint: 522, sealed: 558, verygood: 504 },
  },
  stabs9: {
    "128": { broken: 22, fair: 121, good: 171, mint: 198, sealed: 225, verygood: 180 },
    "256": { broken: 27, fair: 139, good: 189, mint: 216, sealed: 238, verygood: 198 },
  },
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
  valveidx: { category: "VR — Valve", label: "Valve Index Full Kit", base: 0 },
  valveidxhmd: { category: "VR — Valve", label: "Valve Index Headset Only", base: 0 },
  psvr2: { category: "VR — PlayStation", label: "PlayStation VR2", base: 0 },
  psvr2h: { category: "VR — PlayStation", label: "PlayStation VR2 Horizon Bundle", base: 0 },
  psvr1: { category: "VR — PlayStation", label: "PlayStation VR (Original)", base: 0 },
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
  dji_mini_2: { category: "Drones — DJI", label: "DJI Mini 2", base: 81, image: "/devices/dji_mini_3.png" },
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
  gfenix8pro: { category: "Garmin watches", label: "Fenix 8 Pro", base: 472, image: "/devices/pixel-watch.png" },
  gfenix8solar: { category: "Garmin watches", label: "Fenix 8 Solar", base: 405, image: "/devices/pixel-watch.png" },
  gfenix8amoled: { category: "Garmin watches", label: "Fenix 8 AMOLED", base: 342, image: "/devices/pixel-watch.png" },
  gfenixe: { category: "Garmin watches", label: "Fenix E", base: 202, image: "/devices/pixel-watch.png" },
  gfenix7s: { category: "Garmin watches", label: "Fenix 7S", base: 144, image: "/devices/pixel-watch.png" },
  gfenix7x: { category: "Garmin watches", label: "Fenix 7X", base: 126, image: "/devices/pixel-watch.png" },
  gfenix7: { category: "Garmin watches", label: "Fenix 7", base: 117, image: "/devices/pixel-watch.png" },
  gepixgen2: { category: "Garmin watches", label: "Epix Gen 2", base: 14, image: "/devices/pixel-watch.png" },
  gepixprogen2: { category: "Garmin watches", label: "Epix Pro Gen 2", base: 14, image: "/devices/pixel-watch.png" },
  gforerunner970: { category: "Garmin watches", label: "Forerunner 970", base: 328, image: "/devices/pixel-watch.png" },
  gforerunner965: { category: "Garmin watches", label: "Forerunner 965", base: 212, image: "/devices/pixel-watch.png" },
  gforerunner570: { category: "Garmin watches", label: "Forerunner 570", base: 202, image: "/devices/pixel-watch.png" },
  gforerunner955: { category: "Garmin watches", label: "Forerunner 955", base: 158, image: "/devices/pixel-watch.png" },
  gforerunner955solar: { category: "Garmin watches", label: "Forerunner 955 Solar", base: 158, image: "/devices/pixel-watch.png" },
  gforerunner265: { category: "Garmin watches", label: "Forerunner 265", base: 135, image: "/devices/pixel-watch.png" },
  gforerunner265s: { category: "Garmin watches", label: "Forerunner 265S", base: 135, image: "/devices/pixel-watch.png" },
  gforerunner255: { category: "Garmin watches", label: "Forerunner 255", base: 90, image: "/devices/pixel-watch.png" },
  gforerunner255music: { category: "Garmin watches", label: "Forerunner 255 Music", base: 90, image: "/devices/pixel-watch.png" },
  gforerunner255s: { category: "Garmin watches", label: "Forerunner 255S", base: 90, image: "/devices/pixel-watch.png" },
  gforerunner255smusic: { category: "Garmin watches", label: "Forerunner 255S Music", base: 90, image: "/devices/pixel-watch.png" },
  gforerunner165: { category: "Garmin watches", label: "Forerunner 165", base: 76, image: "/devices/pixel-watch.png" },
  gforerunner165music: { category: "Garmin watches", label: "Forerunner 165 Music", base: 76, image: "/devices/pixel-watch.png" },
  gforerunner945: { category: "Garmin watches", label: "Forerunner 945", base: 72, image: "/devices/pixel-watch.png" },
  gforerunner945lte: { category: "Garmin watches", label: "Forerunner 945 LTE", base: 72, image: "/devices/pixel-watch.png" },
  gforerunner245: { category: "Garmin watches", label: "Forerunner 245", base: 54, image: "/devices/pixel-watch.png" },
  gforerunner245music: { category: "Garmin watches", label: "Forerunner 245 Music", base: 54, image: "/devices/pixel-watch.png" },
  gforerunner745: { category: "Garmin watches", label: "Forerunner 745", base: 36, image: "/devices/pixel-watch.png" },
  gvenu2: { category: "Garmin watches", label: "Venu 2", base: 315, image: "/devices/pixel-watch.png" },
  gvenux1: { category: "Garmin watches", label: "Venu X1", base: 315, image: "/devices/pixel-watch.png" },
  gvenu4: { category: "Garmin watches", label: "Venu 4", base: 198, image: "/devices/pixel-watch.png" },
  gvivoactive6: { category: "Garmin watches", label: "Vivoactive 6", base: 112, image: "/devices/pixel-watch.png" },
  gvivoactive5: { category: "Garmin watches", label: "Vivoactive 5", base: 50, image: "/devices/pixel-watch.png" },
  gvivoactive4: { category: "Garmin watches", label: "Vivoactive 4", base: 27, image: "/devices/pixel-watch.png" },
  gvivoactive4s: { category: "Garmin watches", label: "Vivoactive 4S", base: 27, image: "/devices/pixel-watch.png" },
  ginstincte: { category: "Garmin watches", label: "Instinct E", base: 27, image: "/devices/pixel-watch.png" },
  ginstinct2: { category: "Garmin watches", label: "Instinct 2", base: 9, image: "/devices/pixel-watch.png" },
  ginstinct2s: { category: "Garmin watches", label: "Instinct 2S", base: 9, image: "/devices/pixel-watch.png" },
  ginstinct2x: { category: "Garmin watches", label: "Instinct 2X", base: 9, image: "/devices/pixel-watch.png" },
  ginstinct3: { category: "Garmin watches", label: "Instinct 3", base: 9, image: "/devices/pixel-watch.png" },
  ginstinctcrossover: { category: "Garmin watches", label: "Instinct Crossover", base: 9, image: "/devices/pixel-watch.png" },
  gapproachs70: { category: "Garmin watches", label: "Approach S70", base: 198, image: "/devices/pixel-watch.png" },
  gapproachs50: { category: "Garmin watches", label: "Approach S50", base: 135, image: "/devices/pixel-watch.png" },
  gapproachs62: { category: "Garmin watches", label: "Approach S62", base: 108, image: "/devices/pixel-watch.png" },
  gapproachs44: { category: "Garmin watches", label: "Approach S44", base: 94, image: "/devices/pixel-watch.png" },
  gapproachs42: { category: "Garmin watches", label: "Approach S42", base: 68, image: "/devices/pixel-watch.png" },
  gdescentg2: { category: "Garmin watches", label: "Descent G2", base: 230, image: "/devices/pixel-watch.png" },
  gdescentmk1: { category: "Garmin watches", label: "Descent Mk1", base: 153, image: "/devices/pixel-watch.png" },
  gdescentg1: { category: "Garmin watches", label: "Descent G1", base: 9, image: "/devices/pixel-watch.png" },
  gdescentmk2: { category: "Garmin watches", label: "Descent Mk2", base: 9, image: "/devices/pixel-watch.png" },
  gdescentmk3: { category: "Garmin watches", label: "Descent Mk3", base: 9, image: "/devices/pixel-watch.png" },
  genduro3: { category: "Garmin watches", label: "Enduro 3", base: 369, image: "/devices/pixel-watch.png" },
  genduro2: { category: "Garmin watches", label: "Enduro 2", base: 180, image: "/devices/pixel-watch.png" },
  genduroorig: { category: "Garmin watches", label: "Enduro", base: 81, image: "/devices/pixel-watch.png" },
  gmarqadventurer: { category: "Garmin watches", label: "MARQ Adventurer", base: 135, image: "/devices/pixel-watch.png" },
  gmarqathlete: { category: "Garmin watches", label: "MARQ Athlete", base: 135, image: "/devices/pixel-watch.png" },
  gmarqaviator: { category: "Garmin watches", label: "MARQ Aviator", base: 135, image: "/devices/pixel-watch.png" },
  gmarqcaptain: { category: "Garmin watches", label: "MARQ Captain", base: 135, image: "/devices/pixel-watch.png" },
  gmarqcommander: { category: "Garmin watches", label: "MARQ Commander", base: 135, image: "/devices/pixel-watch.png" },
  gmarqgolfer: { category: "Garmin watches", label: "MARQ Golfer", base: 135, image: "/devices/pixel-watch.png" },
  gquatix6: { category: "Garmin watches", label: "Quatix 6", base: 18, image: "/devices/pixel-watch.png" },
  gquatix7: { category: "Garmin watches", label: "Quatix 7", base: 18, image: "/devices/pixel-watch.png" },
  gquatix8: { category: "Garmin watches", label: "Quatix 8", base: 18, image: "/devices/pixel-watch.png" },
  glily2: { category: "Garmin watches", label: "Lily 2", base: 22, image: "/devices/pixel-watch.png" },
  glily2active: { category: "Garmin watches", label: "Lily 2 Active", base: 22, image: "/devices/pixel-watch.png" },
  glily2classic: { category: "Garmin watches", label: "Lily 2 Classic", base: 22, image: "/devices/pixel-watch.png" },
};


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
  // Per-model IWM condition adjustments. Keys: sealed / mint / verygood
  // / good / fair / broken. When present, the additive math uses these
  // instead of the MacBook-calibrated MCOND constants.
  condition_adj?: Record<string, number>;
  battery_adj?: Record<string, number>;
  charger_adj?: Record<string, number>;
};
export const MACBOOK_SPECS: Record<string, MacSpec> = {
  // 2026 16-inch MacBook Pro M5 Pro/Max (Skywalker's example reference).
  mbp16_m5pmax_2026: {
    processors: [
      { id: "m5pro_18_20", label: "M5 Pro", sub: "18-Core CPU / 20-Core GPU", multiplier: 1.00, adj: 2075 },
      { id: "m5max_18_32", label: "M5 Max", sub: "18-Core CPU / 32-Core GPU", multiplier: 1.35, adj: 2800 },
      { id: "m5max_18_40", label: "M5 Max", sub: "18-Core CPU / 40-Core GPU", multiplier: 1.50, adj: 3150 },
    ],
    memory: [
      { id: "24",  label: "24 GB",  sub: "Unified Memory", multiplier: 1.00, adj: 0 },
      { id: "36",  label: "36 GB",  sub: "Unified Memory", multiplier: 1.08, adj: 200 },
      { id: "48",  label: "48 GB",  sub: "Unified Memory", multiplier: 1.15, adj: 400 },
      { id: "64",  label: "64 GB",  sub: "Unified Memory", multiplier: 1.25, adj: 600 },
      { id: "128", label: "128 GB", sub: "Unified Memory", multiplier: 1.45, adj: 1000 },
    ],
    storage: [
      { id: "1tb", label: "1 TB",  sub: "SSD", multiplier: 1.00, adj: 0 },
      { id: "2tb", label: "2 TB",  sub: "SSD", multiplier: 1.15, adj: 125 },
      { id: "4tb", label: "4 TB",  sub: "SSD", multiplier: 1.40, adj: 400 },
      { id: "8tb", label: "8 TB",  sub: "SSD", multiplier: 1.75, adj: 800 },
    ],
    hasNanoGlass: true,
  },
  // 2026 14-inch MacBook Pro M5 Pro/Max — same chip tiers as the 16,
  // with the 15-16C base Pro chip configurable too. 8TB SSD available
  // on M5 Max only (not M5 Pro).
  mbp14_m5pmax_2026: {
    processors: [
      { id: "m5pro_15_16", label: "M5 Pro", sub: "15-Core CPU / 16-Core GPU", multiplier: 1.00, adj: 1350 },
      { id: "m5pro_18_20", label: "M5 Pro", sub: "18-Core CPU / 20-Core GPU", multiplier: 1.20, adj: 1625 },
      { id: "m5max_18_32", label: "M5 Max", sub: "18-Core CPU / 32-Core GPU", multiplier: 1.50, adj: 2025 },
      { id: "m5max_18_40", label: "M5 Max", sub: "18-Core CPU / 40-Core GPU", multiplier: 1.70, adj: 3150 },
    ],
    memory: [
      { id: "24",  label: "24 GB",  sub: "Unified Memory", multiplier: 1.00, adj: 0 },
      { id: "36",  label: "36 GB",  sub: "Unified Memory", multiplier: 1.10, adj: 200 },
      { id: "48",  label: "48 GB",  sub: "Unified Memory", multiplier: 1.18, adj: 350 },
      { id: "64",  label: "64 GB",  sub: "Unified Memory", multiplier: 1.30, adj: 600 },
      { id: "128", label: "128 GB", sub: "Unified Memory", multiplier: 1.50, adj: 1000 },
    ],
    storage: [
      { id: "1tb", label: "1 TB", sub: "SSD", multiplier: 1.00, adj: 0 },
      { id: "2tb", label: "2 TB", sub: "SSD", multiplier: 1.15, adj: 200 },
      { id: "4tb", label: "4 TB", sub: "SSD", multiplier: 1.40, adj: 600 },
      { id: "8tb", label: "8 TB", sub: "SSD", multiplier: 1.75, adj: 1200 },
    ],
    hasNanoGlass: true,
  },
  // 2024 16-inch MacBook Pro M4 Pro/Max
  mbp16m4: {
    processors: [
      { id: "m4pro_14_20", label: "M4 Pro", sub: "14-Core CPU / 20-Core GPU", multiplier: 1.00, adj: 1475 },
      { id: "m4max_14_32", label: "M4 Max", sub: "14-Core CPU / 32-Core GPU", multiplier: 1.46, adj: 2150 },
      { id: "m4max_16_40", label: "M4 Max", sub: "16-Core CPU / 40-Core GPU", multiplier: 1.69, adj: 2500 },
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
      { id: "1tb", label: "1 TB",   sub: "SSD", multiplier: 1.00, adj: 150 },
      { id: "2tb", label: "2 TB",   sub: "SSD", multiplier: 1.18, adj: 300 },
      { id: "4tb", label: "4 TB",   sub: "SSD", multiplier: 1.40, adj: 600 },
      { id: "8tb", label: "8 TB",   sub: "SSD", multiplier: 1.70, adj: 1000 },
    ],
    hasNanoGlass: true,
  },
  // 2024 14-inch MacBook Pro M4
  mbp14m4: {
    processors: [
      { id: "m4_10_10",    label: "M4",     sub: "10-Core CPU / 10-Core GPU", multiplier: 1.00, adj: 950 },
      { id: "m4pro_12_16", label: "M4 Pro", sub: "12-Core CPU / 16-Core GPU", multiplier: 1.37, adj: 1300 },
      { id: "m4pro_14_20", label: "M4 Pro", sub: "14-Core CPU / 20-Core GPU", multiplier: 1.42, adj: 1350 },
      { id: "m4max_14_32", label: "M4 Max", sub: "14-Core CPU / 32-Core GPU", multiplier: 2.26, adj: 2150 },
      { id: "m4max_16_40", label: "M4 Max", sub: "16-Core CPU / 40-Core GPU", multiplier: 2.47, adj: 2350 },
    ],
    memory: [
      { id: "16",  label: "16 GB",  sub: "Unified Memory", multiplier: 1.00, adj: 0 },
      { id: "24",  label: "24 GB",  sub: "Unified Memory", multiplier: 1.06, adj: 125 },
      { id: "32",  label: "32 GB",  sub: "Unified Memory", multiplier: 1.12, adj: 250 },
      { id: "36",  label: "36 GB",  sub: "Unified Memory", multiplier: 1.14, adj: 250 },
      { id: "48",  label: "48 GB",  sub: "Unified Memory", multiplier: 1.20, adj: 400 },
      { id: "64",  label: "64 GB",  sub: "Unified Memory", multiplier: 1.30, adj: 600 },
      { id: "128", label: "128 GB", sub: "Unified Memory", multiplier: 1.50, adj: 1000 },
    ],
    storage: [
      { id: "512", label: "512 GB", sub: "SSD", multiplier: 0.85, adj: 0 },
      { id: "1tb", label: "1 TB",   sub: "SSD", multiplier: 1.00, adj: 125 },
      { id: "2tb", label: "2 TB",   sub: "SSD", multiplier: 1.18, adj: 250 },
      { id: "4tb", label: "4 TB",   sub: "SSD", multiplier: 1.40, adj: 600 },
      { id: "8tb", label: "8 TB",   sub: "SSD", multiplier: 1.70, adj: 1000 },
    ],
    hasNanoGlass: true,
  },
  // 2023 16-inch MacBook Pro M3 Pro/Max
  mbp16m3: {
    processors: [
      { id: "m3pro_12_18", label: "M3 Pro", sub: "12-Core CPU / 18-Core GPU", multiplier: 1.00, adj: 1150 },
      { id: "m3max_14_30", label: "M3 Max", sub: "14-Core CPU / 30-Core GPU", multiplier: 1.41, adj: 1625 },
      { id: "m3max_16_40", label: "M3 Max", sub: "16-Core CPU / 40-Core GPU", multiplier: 1.54, adj: 1775 },
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
      { id: "8tb", label: "8 TB",   sub: "SSD", multiplier: 1.70, adj: 850 },
    ],
    hasNanoGlass: false,
  },
  // 2023 14-inch MacBook Pro M3 / Pro / Max
  mbp14m3: {
    processors: [
      { id: "m3_8_10",     label: "M3",     sub: "8-Core CPU / 10-Core GPU",  multiplier: 1.00, adj: 630 },
      { id: "m3pro_11_14", label: "M3 Pro", sub: "11-Core CPU / 14-Core GPU", multiplier: 1.43, adj: 900 },
      { id: "m3pro_12_18", label: "M3 Pro", sub: "12-Core CPU / 18-Core GPU", multiplier: 1.51, adj: 950 },
      { id: "m3max_14_30", label: "M3 Max", sub: "14-Core CPU / 30-Core GPU", multiplier: 2.30, adj: 1450 },
      { id: "m3max_16_40", label: "M3 Max", sub: "16-Core CPU / 40-Core GPU", multiplier: 2.70, adj: 1700 },
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
      { id: "1tb", label: "1 TB",   sub: "SSD", multiplier: 1.00, adj: 100 },
      { id: "2tb", label: "2 TB",   sub: "SSD", multiplier: 1.18, adj: 250 },
      { id: "4tb", label: "4 TB",   sub: "SSD", multiplier: 1.40, adj: 500 },
      { id: "8tb", label: "8 TB",   sub: "SSD", multiplier: 1.70, adj: 850 },
    ],
    hasNanoGlass: false,
  },
  // 2023 16-inch MacBook Pro M2 Pro/Max (no nano-texture this gen)
  mbp16m2: {
    processors: [
      { id: "m2pro_12_19", label: "M2 Pro", sub: "12-Core CPU / 19-Core GPU", multiplier: 1.00, adj: 900 },
      { id: "m2max_12_30", label: "M2 Max", sub: "12-Core CPU / 30-Core GPU", multiplier: 1.25, adj: 1125 },
      { id: "m2max_12_38", label: "M2 Max", sub: "12-Core CPU / 38-Core GPU", multiplier: 1.40, adj: 1260 },
    ],
    memory: [
      { id: "16", label: "16 GB", sub: "Unified Memory", multiplier: 1.00, adj: 0 },
      { id: "32", label: "32 GB", sub: "Unified Memory", multiplier: 1.12, adj: 200 },
      { id: "64", label: "64 GB", sub: "Unified Memory", multiplier: 1.28, adj: 500 },
      { id: "96", label: "96 GB", sub: "Unified Memory", multiplier: 1.40, adj: 700 },
    ],
    storage: [
      { id: "512", label: "512 GB", sub: "SSD", multiplier: 0.85, adj: 0 },
      { id: "1tb", label: "1 TB",   sub: "SSD", multiplier: 1.00, adj: 150 },
      { id: "2tb", label: "2 TB",   sub: "SSD", multiplier: 1.18, adj: 300 },
      { id: "4tb", label: "4 TB",   sub: "SSD", multiplier: 1.40, adj: 500 },
      { id: "8tb", label: "8 TB",   sub: "SSD", multiplier: 1.70, adj: 850 },
    ],
    hasNanoGlass: false,
  },
  // 2023 14-inch MacBook Pro M2 Pro/Max
  mbp14m2: {
    processors: [
      { id: "m2pro_10_16", label: "M2 Pro", sub: "10-Core CPU / 16-Core GPU", multiplier: 1.00, adj: 750 },
      { id: "m2pro_12_19", label: "M2 Pro", sub: "12-Core CPU / 19-Core GPU", multiplier: 1.11, adj: 832 },
      { id: "m2max_12_30", label: "M2 Max", sub: "12-Core CPU / 30-Core GPU", multiplier: 1.44, adj: 1080 },
      { id: "m2max_12_38", label: "M2 Max", sub: "12-Core CPU / 38-Core GPU", multiplier: 1.50, adj: 1125 },
    ],
    memory: [
      { id: "16", label: "16 GB", sub: "Unified Memory", multiplier: 1.00, adj: 0 },
      { id: "32", label: "32 GB", sub: "Unified Memory", multiplier: 1.12, adj: 175 },
      { id: "64", label: "64 GB", sub: "Unified Memory", multiplier: 1.28, adj: 450 },
      { id: "96", label: "96 GB", sub: "Unified Memory", multiplier: 1.40, adj: 650 },
    ],
    storage: [
      { id: "512", label: "512 GB", sub: "SSD", multiplier: 0.85, adj: 0 },
      { id: "1tb", label: "1 TB",   sub: "SSD", multiplier: 1.00, adj: 125 },
      { id: "2tb", label: "2 TB",   sub: "SSD", multiplier: 1.18, adj: 250 },
      { id: "4tb", label: "4 TB",   sub: "SSD", multiplier: 1.40, adj: 425 },
      { id: "8tb", label: "8 TB",   sub: "SSD", multiplier: 1.70, adj: 700 },
    ],
    hasNanoGlass: false,
  },
  // 2025 14-inch MacBook Pro M5 (base chip line) — Atlas only lists M5
  // Pro/Max variants for this gen but the base M5 is configurable too.
  // No nano glass on the base M5 model.
  mbp14_m5_2025: {
    processors: [
      { id: "m5_10_10", label: "M5", sub: "10-Core CPU / 10-Core GPU", multiplier: 1.00, adj: 950 },
    ],
    memory: [
      { id: "16", label: "16 GB", sub: "Unified Memory", multiplier: 1.00, adj: 0 },
      { id: "24", label: "24 GB", sub: "Unified Memory", multiplier: 1.08, adj: 125 },
      { id: "32", label: "32 GB", sub: "Unified Memory", multiplier: 1.18, adj: 300 },
    ],
    storage: [
      { id: "512", label: "512 GB", sub: "SSD", multiplier: 0.85, adj: 0 },
      { id: "1tb", label: "1 TB",   sub: "SSD", multiplier: 1.00, adj: 100 },
      { id: "2tb", label: "2 TB",   sub: "SSD", multiplier: 1.20, adj: 200 },
      { id: "4tb", label: "4 TB",   sub: "SSD", multiplier: 1.45, adj: 500 },
    ],
    hasNanoGlass: true,
  },
  // 2026 MacBook Air M5 — Skywalker has 13 + 15 combined as one catalog
  // entry, so screen size lives on the processor step (M5 chip is the
  // same across sizes; the 15-inch just commands a price premium).
  mba_m5_2026: {
    processors: [
      { id: "m5_13",       label: "M5 (13-inch)", sub: "10-Core CPU / 10-Core GPU", multiplier: 0.85, adj: 625 },
      { id: "m5_15",       label: "M5 (15-inch)", sub: "10-Core CPU / 10-Core GPU", multiplier: 1.12, adj: 700 },
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
    hasNanoGlass: false,
  },
  // 2025 MacBook Air M4 — 13" and 15" combined. M4 chip, 16/24/32 GB RAM,
  // 256/512/1TB/2TB storage. Same approach as M5 Air: screen size on processor step.
  mba_m4_2025: {
    processors: [
      { id: "m4_13", label: "M4 (13-inch)", sub: "10-Core CPU / 8-Core GPU",  multiplier: 0.85, adj: 565 },
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
    hasNanoGlass: false,
  },
  // 2024 MacBook Air 15" M3
  mba15m3: {
    processors: [
      { id: "m3_8_10", label: "M3", sub: "8-Core CPU / 10-Core GPU", multiplier: 1.00, adj: 540 },
    ],
    memory: [
      { id: "8",  label: "8 GB",  sub: "Unified Memory", multiplier: 0.92, adj: 0 },
      { id: "16", label: "16 GB", sub: "Unified Memory", multiplier: 1.00, adj: 50 },
      { id: "24", label: "24 GB", sub: "Unified Memory", multiplier: 1.10, adj: 150 },
    ],
    storage: [
      { id: "256", label: "256 GB", sub: "SSD", multiplier: 0.85, adj: 0 },
      { id: "512", label: "512 GB", sub: "SSD", multiplier: 1.00, adj: 50 },
      { id: "1tb", label: "1 TB",   sub: "SSD", multiplier: 1.15, adj: 125 },
      { id: "2tb", label: "2 TB",   sub: "SSD", multiplier: 1.35, adj: 250 },
    ],
    hasNanoGlass: false,
  },
  // 2024 MacBook Air 13" M3
  mba13m3: {
    processors: [
      { id: "m3_8_8",  label: "M3", sub: "8-Core CPU / 8-Core GPU",  multiplier: 1.00, adj: 470 },
      { id: "m3_8_10", label: "M3", sub: "8-Core CPU / 10-Core GPU", multiplier: 1.14, adj: 535 },
    ],
    memory: [
      { id: "8",  label: "8 GB",  sub: "Unified Memory", multiplier: 0.92, adj: 0 },
      { id: "16", label: "16 GB", sub: "Unified Memory", multiplier: 1.00, adj: 50 },
      { id: "24", label: "24 GB", sub: "Unified Memory", multiplier: 1.10, adj: 150 },
    ],
    storage: [
      { id: "256", label: "256 GB", sub: "SSD", multiplier: 0.85, adj: 0 },
      { id: "512", label: "512 GB", sub: "SSD", multiplier: 1.00, adj: 50 },
      { id: "1tb", label: "1 TB",   sub: "SSD", multiplier: 1.15, adj: 125 },
      { id: "2tb", label: "2 TB",   sub: "SSD", multiplier: 1.35, adj: 250 },
    ],
    hasNanoGlass: false,
  },
  // 2023 MacBook Air 15" M2
  mba15m2: {
    processors: [
      { id: "m2_8_10", label: "M2", sub: "8-Core CPU / 10-Core GPU", multiplier: 1.00, adj: 440 },
    ],
    memory: [
      { id: "8",  label: "8 GB",  sub: "Unified Memory", multiplier: 0.92, adj: 0 },
      { id: "16", label: "16 GB", sub: "Unified Memory", multiplier: 1.00, adj: 85 },
      { id: "24", label: "24 GB", sub: "Unified Memory", multiplier: 1.10, adj: 170 },
    ],
    storage: [
      { id: "256", label: "256 GB", sub: "SSD", multiplier: 0.85, adj: 0 },
      { id: "512", label: "512 GB", sub: "SSD", multiplier: 1.00, adj: 50 },
      { id: "1tb", label: "1 TB",   sub: "SSD", multiplier: 1.15, adj: 100 },
      { id: "2tb", label: "2 TB",   sub: "SSD", multiplier: 1.35, adj: 200 },
    ],
    hasNanoGlass: false,
  },
  // 2022 MacBook Air 13" M2
  mba13m2: {
    processors: [
      { id: "m2_8_8",  label: "M2", sub: "8-Core CPU / 8-Core GPU",  multiplier: 1.00, adj: 370 },
      { id: "m2_8_10", label: "M2", sub: "8-Core CPU / 10-Core GPU", multiplier: 1.08, adj: 400 },
    ],
    memory: [
      { id: "8",  label: "8 GB",  sub: "Unified Memory", multiplier: 0.92, adj: 0 },
      { id: "16", label: "16 GB", sub: "Unified Memory", multiplier: 1.00, adj: 50 },
      { id: "24", label: "24 GB", sub: "Unified Memory", multiplier: 1.10, adj: 125 },
    ],
    storage: [
      { id: "256", label: "256 GB", sub: "SSD", multiplier: 0.85, adj: 0 },
      { id: "512", label: "512 GB", sub: "SSD", multiplier: 1.00, adj: 50 },
      { id: "1tb", label: "1 TB",   sub: "SSD", multiplier: 1.15, adj: 125 },
      { id: "2tb", label: "2 TB",   sub: "SSD", multiplier: 1.35, adj: 175 },
    ],
    hasNanoGlass: false,
  },
  // 2020 MacBook Air 13" M1 — first Apple Silicon Mac, simpler config
  mba13m1: {
    processors: [
      { id: "m1_8_7", label: "M1", sub: "8-Core CPU / 7-Core GPU", multiplier: 1.00, adj: 370 },
      { id: "m1_8_8", label: "M1", sub: "8-Core CPU / 8-Core GPU", multiplier: 1.08, adj: 400 },
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
    hasNanoGlass: false,
  },
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
    hasNanoGlass: false,
  },
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
    hasNanoGlass: false,
  },
  // Dell XPS 15 (2024) — IWM additive pricing
  dxps15: {
    processors: [
      { id: "i7_14", label: "Intel Core i7 (14th Gen)", multiplier: 1.00, adj: 620 },
      { id: "i9_14", label: "Intel Core i9 (14th Gen)", multiplier: 1.13, adj: 700 },
    ],
    memory: [
      { id: "16", label: "16 GB", multiplier: 1.00, adj: 0 },
      { id: "32", label: "32 GB", multiplier: 1.06, adj: 40 },
      { id: "64", label: "64 GB", multiplier: 1.16, adj: 100 },
    ],
    storage: [
      { id: "512", label: "512 GB SSD", multiplier: 1.00, adj: 0 },
      { id: "1tb", label: "1 TB SSD", multiplier: 1.06, adj: 40 },
      { id: "2tb", label: "2 TB SSD", multiplier: 1.13, adj: 80 },
    ],
    hasNanoGlass: false,
  },
  // Dell XPS 13 (2024) — IWM additive pricing
  dxps13: {
    processors: [
      { id: "ultra5", label: "Intel Core Ultra 5", multiplier: 1.00, adj: 420 },
      { id: "ultra7", label: "Intel Core Ultra 7", multiplier: 1.19, adj: 500 },
    ],
    memory: [
      { id: "16", label: "16 GB", multiplier: 1.00, adj: 0 },
      { id: "32", label: "32 GB", multiplier: 1.07, adj: 30 },
    ],
    storage: [
      { id: "256", label: "256 GB SSD", multiplier: 1.00, adj: 0 },
      { id: "512", label: "512 GB SSD", multiplier: 1.05, adj: 20 },
      { id: "1tb", label: "1 TB SSD", multiplier: 1.10, adj: 40 },
    ],
    hasNanoGlass: false,
  },
  // Alienware Aurora R16 — gaming desktop, additive pricing
  awaurorar16: {
    processors: [
      { id: "i7_13", label: "Intel Core i7 (13th Gen)", multiplier: 1.00, adj: 340 },
      { id: "i7_14", label: "Intel Core i7 (14th Gen)", multiplier: 1.00, adj: 390 },
      { id: "i9_13", label: "Intel Core i9 (13th Gen)", multiplier: 1.00, adj: 380 },
      { id: "i9_14", label: "Intel Core i9 (14th Gen)", multiplier: 1.00, adj: 490 },
    ],
    memory: [
      { id: "8",  label: "8 GB",  multiplier: 1.00, adj: 0 },
      { id: "16", label: "16 GB", multiplier: 1.00, adj: 25 },
      { id: "32", label: "32 GB", multiplier: 1.00, adj: 50 },
      { id: "64", label: "64 GB", multiplier: 1.00, adj: 100 },
    ],
    storage: [
      { id: "256", label: "256 GB SSD", multiplier: 1.00, adj: 0 },
      { id: "512", label: "512 GB SSD", multiplier: 1.00, adj: 25 },
      { id: "1tb", label: "1 TB SSD",   multiplier: 1.00, adj: 50 },
      { id: "2tb", label: "2 TB SSD",   multiplier: 1.00, adj: 100 },
      { id: "4tb", label: "4 TB SSD",   multiplier: 1.00, adj: 175 },
    ],
    hasNanoGlass: false,
  },
  // Lenovo ThinkPad X1 Carbon Gen 13 (2025) — IWM additive pricing
  ln_tp_x1_carbon: {
    processors: [
      { id: "ultra5", label: "Intel Core Ultra 5", sub: "Gen 13 (2025)", multiplier: 1.00, adj: 380 },
      { id: "ultra7", label: "Intel Core Ultra 7", sub: "Gen 13 (2025)", multiplier: 1.43, adj: 545 },
    ],
    memory: [
      { id: "8",  label: "8 GB",  multiplier: 1.00, adj: 0 },
      { id: "16", label: "16 GB", multiplier: 1.00, adj: 20 },
      { id: "32", label: "32 GB", multiplier: 1.00, adj: 35 },
    ],
    storage: [
      { id: "256", label: "256 GB SSD", multiplier: 1.00, adj: 0 },
      { id: "512", label: "512 GB SSD", multiplier: 1.00, adj: 20 },
      { id: "1tb", label: "1 TB SSD",   multiplier: 1.00, adj: 40 },
      { id: "2tb", label: "2 TB SSD",   multiplier: 1.00, adj: 80 },
    ],
    hasNanoGlass: false,
  },
  // HP OMEN 45L Desktop — gaming desktop, additive pricing
  // ─── HP LAPTOPS — additive pricing from IWM (scraped 2026-05-11) ───
  // EliteBook Standard — business ultrabooks
  hp_eb_g11: {
    processors: [
      { id: "r5_7535u",      label: "AMD Ryzen 5 7535U",       multiplier: 1.00, adj: 230 },
      { id: "r5p_7535u",     label: "AMD Ryzen 5 Pro 7535U",   multiplier: 1.00, adj: 250 },
      { id: "r7_7735u",      label: "AMD Ryzen 7 7735U",       multiplier: 1.00, adj: 290 },
      { id: "r7p_7735u",     label: "AMD Ryzen 7 Pro 7735U",   multiplier: 1.00, adj: 325 },
      { id: "ultra5",        label: "Intel Core Ultra 5",       multiplier: 1.00, adj: 300 },
      { id: "ultra7",        label: "Intel Core Ultra 7",       multiplier: 1.00, adj: 375 },
    ],
    memory: [
      { id: "8",  label: "8 GB",  multiplier: 1.00, adj: 0 },
      { id: "16", label: "16 GB", multiplier: 1.00, adj: 15 },
      { id: "32", label: "32 GB", multiplier: 1.00, adj: 30 },
      { id: "64", label: "64 GB", multiplier: 1.00, adj: 50 },
    ],
    storage: [
      { id: "256", label: "256 GB SSD", multiplier: 1.00, adj: 0 },
      { id: "512", label: "512 GB SSD", multiplier: 1.00, adj: 15 },
      { id: "1tb", label: "1 TB SSD",   multiplier: 1.00, adj: 30 },
      { id: "2tb", label: "2 TB SSD",   multiplier: 1.00, adj: 50 },
    ],
    hasNanoGlass: false,
  },
  hp_eb_g10: {
    processors: [
      { id: "i5_13",     label: "Intel Core i5 (13th Gen)",   multiplier: 1.00, adj: 230 },
      { id: "i7_13",     label: "Intel Core i7 (13th Gen)",   multiplier: 1.00, adj: 265 },
      { id: "r5_7530u",  label: "AMD Ryzen 5 7530U",          multiplier: 1.00, adj: 160 },
      { id: "r5p_7530u", label: "AMD Ryzen 5 Pro 7530U",      multiplier: 1.00, adj: 185 },
      { id: "r7_7730u",  label: "AMD Ryzen 7 7730U",          multiplier: 1.00, adj: 210 },
      { id: "r7p_7730u", label: "AMD Ryzen 7 Pro 7730U",      multiplier: 1.00, adj: 245 },
    ],
    memory: [
      { id: "8",  label: "8 GB",  multiplier: 1.00, adj: 0 },
      { id: "16", label: "16 GB", multiplier: 1.00, adj: 15 },
      { id: "32", label: "32 GB", multiplier: 1.00, adj: 30 },
      { id: "64", label: "64 GB", multiplier: 1.00, adj: 50 },
    ],
    storage: [
      { id: "256", label: "256 GB SSD", multiplier: 1.00, adj: 0 },
      { id: "512", label: "512 GB SSD", multiplier: 1.00, adj: 15 },
      { id: "1tb", label: "1 TB SSD",   multiplier: 1.00, adj: 30 },
      { id: "2tb", label: "2 TB SSD",   multiplier: 1.00, adj: 50 },
    ],
    hasNanoGlass: false,
  },
  hp_eb_g9: {
    processors: [
      { id: "i5_12",     label: "Intel Core i5 (12th Gen)",   multiplier: 1.00, adj: 150 },
      { id: "i7_12",     label: "Intel Core i7 (12th Gen)",   multiplier: 1.00, adj: 190 },
      { id: "r5p_5675u", label: "AMD Ryzen 5 Pro 5675U",      multiplier: 1.00, adj: 120 },
      { id: "r7p_5875u", label: "AMD Ryzen 7 Pro 5875U",      multiplier: 1.00, adj: 165 },
    ],
    memory: [
      { id: "8",  label: "8 GB",  multiplier: 1.00, adj: 0 },
      { id: "16", label: "16 GB", multiplier: 1.00, adj: 15 },
      { id: "32", label: "32 GB", multiplier: 1.00, adj: 30 },
      { id: "64", label: "64 GB", multiplier: 1.00, adj: 50 },
    ],
    storage: [
      { id: "256", label: "256 GB SSD", multiplier: 1.00, adj: 0 },
      { id: "512", label: "512 GB SSD", multiplier: 1.00, adj: 15 },
      { id: "1tb", label: "1 TB SSD",   multiplier: 1.00, adj: 30 },
      { id: "2tb", label: "2 TB SSD",   multiplier: 1.00, adj: 50 },
    ],
    hasNanoGlass: false,
  },
  hp_eb_g8: {
    processors: [
      { id: "i5_11",     label: "Intel Core i5 (11th Gen)",   multiplier: 1.00, adj: 100 },
      { id: "i7_11",     label: "Intel Core i7 (11th Gen)",   multiplier: 1.00, adj: 150 },
      { id: "r5_5600u",  label: "AMD Ryzen 5 5600U",          multiplier: 1.00, adj: 70 },
      { id: "r5p_5650u", label: "AMD Ryzen 5 Pro 5650U",      multiplier: 1.00, adj: 100 },
      { id: "r7_5800u",  label: "AMD Ryzen 7 5800U",          multiplier: 1.00, adj: 95 },
      { id: "r7p_5850u", label: "AMD Ryzen 7 Pro 5850U",      multiplier: 1.00, adj: 120 },
    ],
    memory: [
      { id: "8",  label: "8 GB",  multiplier: 1.00, adj: 0 },
      { id: "16", label: "16 GB", multiplier: 1.00, adj: 15 },
      { id: "32", label: "32 GB", multiplier: 1.00, adj: 30 },
      { id: "64", label: "64 GB", multiplier: 1.00, adj: 50 },
    ],
    storage: [
      { id: "256", label: "256 GB SSD", multiplier: 1.00, adj: 0 },
      { id: "512", label: "512 GB SSD", multiplier: 1.00, adj: 15 },
      { id: "1tb", label: "1 TB SSD",   multiplier: 1.00, adj: 30 },
      { id: "2tb", label: "2 TB SSD",   multiplier: 1.00, adj: 50 },
    ],
    hasNanoGlass: false,
  },
  hp_eb_g7: {
    processors: [
      { id: "i5_10",     label: "Intel Core i5 (10th Gen)",   multiplier: 1.00, adj: 65 },
      { id: "i7_10",     label: "Intel Core i7 (10th Gen)",   multiplier: 1.00, adj: 110 },
      { id: "r3p_4450u", label: "AMD Ryzen 3 Pro 4450U",      multiplier: 1.00, adj: 25 },
      { id: "r5p_4650u", label: "AMD Ryzen 5 Pro 4650U",      multiplier: 1.00, adj: 90 },
      { id: "r7p_4750u", label: "AMD Ryzen 7 Pro 4750U",      multiplier: 1.00, adj: 125 },
    ],
    memory: [
      { id: "8",  label: "8 GB",  multiplier: 1.00, adj: 0 },
      { id: "16", label: "16 GB", multiplier: 1.00, adj: 15 },
      { id: "32", label: "32 GB", multiplier: 1.00, adj: 30 },
      { id: "64", label: "64 GB", multiplier: 1.00, adj: 50 },
    ],
    storage: [
      { id: "256", label: "256 GB SSD", multiplier: 1.00, adj: 0 },
      { id: "512", label: "512 GB SSD", multiplier: 1.00, adj: 15 },
      { id: "1tb", label: "1 TB SSD",   multiplier: 1.00, adj: 30 },
    ],
    hasNanoGlass: false,
  },
  hp_eb_g6: {
    processors: [
      { id: "i5_8",      label: "Intel Core i5 (8th Gen)",    multiplier: 1.00, adj: 75 },
      { id: "i7_8",      label: "Intel Core i7 (8th Gen)",    multiplier: 1.00, adj: 100 },
      { id: "r3p_3300u", label: "AMD Ryzen 3 Pro 3300U",      multiplier: 1.00, adj: 50 },
      { id: "r5p_3500u", label: "AMD Ryzen 5 Pro 3500U",      multiplier: 1.00, adj: 90 },
      { id: "r7p_3700u", label: "AMD Ryzen 7 Pro 3700U",      multiplier: 1.00, adj: 120 },
    ],
    memory: [
      { id: "8",  label: "8 GB",  multiplier: 1.00, adj: 0 },
      { id: "16", label: "16 GB", multiplier: 1.00, adj: 15 },
      { id: "32", label: "32 GB", multiplier: 1.00, adj: 30 },
    ],
    storage: [
      { id: "256", label: "256 GB SSD", multiplier: 1.00, adj: 0 },
      { id: "512", label: "512 GB SSD", multiplier: 1.00, adj: 15 },
      { id: "1tb", label: "1 TB SSD",   multiplier: 1.00, adj: 30 },
      { id: "2tb", label: "2 TB SSD",   multiplier: 1.00, adj: 50 },
    ],
    hasNanoGlass: false,
  },
  hp_eb_g5: {
    processors: [
      { id: "r3p_2300u", label: "AMD Ryzen 3 Pro 2300U",      multiplier: 1.00, adj: 15 },
      { id: "r5p_2500u", label: "AMD Ryzen 5 Pro 2500U",      multiplier: 1.00, adj: 30 },
      { id: "r7p_2700u", label: "AMD Ryzen 7 Pro 2700U",      multiplier: 1.00, adj: 45 },
      { id: "i5_8",      label: "Intel Core i5 (8th Gen)",    multiplier: 1.00, adj: 45 },
      { id: "i7_8",      label: "Intel Core i7 (8th Gen)",    multiplier: 1.00, adj: 70 },
    ],
    memory: [
      { id: "8",  label: "8 GB",  multiplier: 1.00, adj: 0 },
      { id: "16", label: "16 GB", multiplier: 1.00, adj: 15 },
      { id: "32", label: "32 GB", multiplier: 1.00, adj: 30 },
    ],
    storage: [
      { id: "256", label: "256 GB SSD", multiplier: 1.00, adj: 0 },
      { id: "512", label: "512 GB SSD", multiplier: 1.00, adj: 15 },
      { id: "1tb", label: "1 TB SSD",   multiplier: 1.00, adj: 30 },
    ],
    hasNanoGlass: false,
  },
  hp_eb_g4: {
    processors: [
      { id: "i5_7",  label: "Intel Core i5 (7th Gen)",  multiplier: 1.00, adj: 30 },
      { id: "i7_7",  label: "Intel Core i7 (7th Gen)",  multiplier: 1.00, adj: 55 },
      { id: "i5_8",  label: "Intel Core i5 (8th Gen)",  multiplier: 1.00, adj: 50 },
      { id: "i7_8",  label: "Intel Core i7 (8th Gen)",  multiplier: 1.00, adj: 80 },
    ],
    memory: [
      { id: "8",  label: "8 GB",  multiplier: 1.00, adj: 0 },
      { id: "16", label: "16 GB", multiplier: 1.00, adj: 15 },
      { id: "32", label: "32 GB", multiplier: 1.00, adj: 20 },
    ],
    storage: [
      { id: "256", label: "256 GB SSD", multiplier: 1.00, adj: 0 },
      { id: "512", label: "512 GB SSD", multiplier: 1.00, adj: 15 },
    ],
    hasNanoGlass: false,
  },
  // Spectre x360 — premium consumer convertible
  hp_spec_14: {
    processors: [
      { id: "i5_11", label: "Intel Core i5 (11th Gen)",  multiplier: 1.00, adj: 200 },
      { id: "i5_12", label: "Intel Core i5 (12th Gen)",  multiplier: 1.00, adj: 250 },
      { id: "i7_11", label: "Intel Core i7 (11th Gen)",  multiplier: 1.00, adj: 275 },
      { id: "i7_12", label: "Intel Core i7 (12th Gen)",  multiplier: 1.00, adj: 350 },
      { id: "i7_13", label: "Intel Core i7 (13th Gen)",  multiplier: 1.00, adj: 470 },
      { id: "ultra7", label: "Intel Core Ultra 7",        multiplier: 1.00, adj: 500 },
    ],
    memory: [
      { id: "8",  label: "8 GB",  multiplier: 1.00, adj: 0 },
      { id: "16", label: "16 GB", multiplier: 1.00, adj: 15 },
      { id: "32", label: "32 GB", multiplier: 1.00, adj: 30 },
    ],
    storage: [
      { id: "256", label: "256 GB SSD", multiplier: 1.00, adj: 0 },
      { id: "512", label: "512 GB SSD", multiplier: 1.00, adj: 15 },
      { id: "1tb", label: "1 TB SSD",   multiplier: 1.00, adj: 30 },
      { id: "2tb", label: "2 TB SSD",   multiplier: 1.00, adj: 50 },
    ],
    hasNanoGlass: false,
  },
  hp_spec_16: {
    processors: [
      { id: "i7_11", label: "Intel Core i7 (11th Gen)",  multiplier: 1.00, adj: 225 },
      { id: "i7_12", label: "Intel Core i7 (12th Gen)",  multiplier: 1.00, adj: 300 },
      { id: "i7_13", label: "Intel Core i7 (13th Gen)",  multiplier: 1.00, adj: 375 },
      { id: "ultra7", label: "Intel Core Ultra 7",        multiplier: 1.00, adj: 450 },
    ],
    memory: [
      { id: "16", label: "16 GB", multiplier: 1.00, adj: 0 },
      { id: "32", label: "32 GB", multiplier: 1.00, adj: 50 },
    ],
    storage: [
      { id: "512", label: "512 GB SSD", multiplier: 1.00, adj: 0 },
      { id: "1tb", label: "1 TB SSD",   multiplier: 1.00, adj: 50 },
      { id: "2tb", label: "2 TB SSD",   multiplier: 1.00, adj: 100 },
    ],
    hasNanoGlass: false,
  },
  hp_spec_13: {
    processors: [
      { id: "i5_10", label: "Intel Core i5 (10th Gen)",  multiplier: 1.00, adj: 210 },
      { id: "i5_11", label: "Intel Core i5 (11th Gen)",  multiplier: 1.00, adj: 275 },
      { id: "i5_12", label: "Intel Core i5 (12th Gen)",  multiplier: 1.00, adj: 295 },
      { id: "i5_13", label: "Intel Core i5 (13th Gen)",  multiplier: 1.00, adj: 320 },
      { id: "i7_10", label: "Intel Core i7 (10th Gen)",  multiplier: 1.00, adj: 260 },
      { id: "i7_11", label: "Intel Core i7 (11th Gen)",  multiplier: 1.00, adj: 290 },
      { id: "i7_12", label: "Intel Core i7 (12th Gen)",  multiplier: 1.00, adj: 330 },
      { id: "i7_13", label: "Intel Core i7 (13th Gen)",  multiplier: 1.00, adj: 365 },
    ],
    memory: [
      { id: "8",  label: "8 GB",  multiplier: 1.00, adj: 0 },
      { id: "16", label: "16 GB", multiplier: 1.00, adj: 15 },
      { id: "32", label: "32 GB", multiplier: 1.00, adj: 30 },
    ],
    storage: [
      { id: "256", label: "256 GB SSD", multiplier: 1.00, adj: 0 },
      { id: "512", label: "512 GB SSD", multiplier: 1.00, adj: 15 },
      { id: "1tb", label: "1 TB SSD",   multiplier: 1.00, adj: 30 },
      { id: "2tb", label: "2 TB SSD",   multiplier: 1.00, adj: 50 },
    ],
    hasNanoGlass: false,
  },
  hp_spec_15: {
    processors: [
      { id: "i7_7",  label: "Intel Core i7 (7th Gen)",   multiplier: 1.00, adj: 180 },
      { id: "i7_8",  label: "Intel Core i7 (8th Gen)",   multiplier: 1.00, adj: 240 },
      { id: "i7_9",  label: "Intel Core i7 (9th Gen)",   multiplier: 1.00, adj: 280 },
      { id: "i7_10", label: "Intel Core i7 (10th Gen)",  multiplier: 1.00, adj: 325 },
      { id: "i7_11", label: "Intel Core i7 (11th Gen)",  multiplier: 1.00, adj: 340 },
    ],
    memory: [
      { id: "8",  label: "8 GB",  multiplier: 1.00, adj: 0 },
      { id: "16", label: "16 GB", multiplier: 1.00, adj: 15 },
      { id: "32", label: "32 GB", multiplier: 1.00, adj: 30 },
    ],
    storage: [
      { id: "256", label: "256 GB SSD", multiplier: 1.00, adj: 0 },
      { id: "512", label: "512 GB SSD", multiplier: 1.00, adj: 15 },
      { id: "1tb", label: "1 TB SSD",   multiplier: 1.00, adj: 30 },
    ],
    hasNanoGlass: false,
  },
  // ProBook — SMB business laptops
  hp_pb_g11: {
    processors: [
      { id: "ultra5",    label: "Intel Core Ultra 5",      multiplier: 1.00, adj: 280 },
      { id: "ultra7",    label: "Intel Core Ultra 7",      multiplier: 1.00, adj: 350 },
      { id: "r5_7535u",  label: "AMD Ryzen 5 7535U",       multiplier: 1.00, adj: 240 },
      { id: "r7_7735u",  label: "AMD Ryzen 7 7735U",       multiplier: 1.00, adj: 300 },
    ],
    memory: [
      { id: "8",  label: "8 GB",  multiplier: 1.00, adj: 0 },
      { id: "16", label: "16 GB", multiplier: 1.00, adj: 15 },
      { id: "32", label: "32 GB", multiplier: 1.00, adj: 30 },
    ],
    storage: [
      { id: "256", label: "256 GB SSD", multiplier: 1.00, adj: 0 },
      { id: "512", label: "512 GB SSD", multiplier: 1.00, adj: 15 },
      { id: "1tb", label: "1 TB SSD",   multiplier: 1.00, adj: 30 },
    ],
    hasNanoGlass: false,
  },
  hp_pb_g10: {
    processors: [
      { id: "i5_13",     label: "Intel Core i5 (13th Gen)", multiplier: 1.00, adj: 150 },
      { id: "i7_13",     label: "Intel Core i7 (13th Gen)", multiplier: 1.00, adj: 175 },
      { id: "r3_7330u",  label: "AMD Ryzen 3 7330U",        multiplier: 1.00, adj: 145 },
      { id: "r5_7530u",  label: "AMD Ryzen 5 7530U",        multiplier: 1.00, adj: 190 },
      { id: "r7_7730u",  label: "AMD Ryzen 7 7730U",        multiplier: 1.00, adj: 230 },
    ],
    memory: [
      { id: "8",  label: "8 GB",  multiplier: 1.00, adj: 0 },
      { id: "16", label: "16 GB", multiplier: 1.00, adj: 25 },
      { id: "32", label: "32 GB", multiplier: 1.00, adj: 50 },
    ],
    storage: [
      { id: "256", label: "256 GB SSD", multiplier: 1.00, adj: 0 },
      { id: "512", label: "512 GB SSD", multiplier: 1.00, adj: 20 },
      { id: "1tb", label: "1 TB SSD",   multiplier: 1.00, adj: 40 },
    ],
    hasNanoGlass: false,
  },
  hp_pb_g9: {
    processors: [
      { id: "i5_12",     label: "Intel Core i5 (12th Gen)", multiplier: 1.00, adj: 150 },
      { id: "i7_12",     label: "Intel Core i7 (12th Gen)", multiplier: 1.00, adj: 190 },
      { id: "r3_5425u",  label: "AMD Ryzen 3 5425U",        multiplier: 1.00, adj: 60 },
      { id: "r5_5625u",  label: "AMD Ryzen 5 5625U",        multiplier: 1.00, adj: 100 },
      { id: "r7_5825u",  label: "AMD Ryzen 7 5825U",        multiplier: 1.00, adj: 140 },
    ],
    memory: [
      { id: "8",  label: "8 GB",  multiplier: 1.00, adj: 0 },
      { id: "16", label: "16 GB", multiplier: 1.00, adj: 15 },
      { id: "32", label: "32 GB", multiplier: 1.00, adj: 30 },
      { id: "64", label: "64 GB", multiplier: 1.00, adj: 50 },
    ],
    storage: [
      { id: "256", label: "256 GB SSD", multiplier: 1.00, adj: 0 },
      { id: "512", label: "512 GB SSD", multiplier: 1.00, adj: 15 },
      { id: "1tb", label: "1 TB SSD",   multiplier: 1.00, adj: 30 },
    ],
    hasNanoGlass: false,
  },
  hp_pb_g8: {
    processors: [
      { id: "i5_11", label: "Intel Core i5 (11th Gen)",  multiplier: 1.00, adj: 55 },
      { id: "i7_11", label: "Intel Core i7 (11th Gen)",  multiplier: 1.00, adj: 90 },
    ],
    memory: [
      { id: "8",  label: "8 GB",  multiplier: 1.00, adj: 0 },
      { id: "16", label: "16 GB", multiplier: 1.00, adj: 15 },
      { id: "32", label: "32 GB", multiplier: 1.00, adj: 30 },
      { id: "64", label: "64 GB", multiplier: 1.00, adj: 50 },
    ],
    storage: [
      { id: "256", label: "256 GB SSD", multiplier: 1.00, adj: 0 },
      { id: "512", label: "512 GB SSD", multiplier: 1.00, adj: 15 },
      { id: "1tb", label: "1 TB SSD",   multiplier: 1.00, adj: 30 },
    ],
    hasNanoGlass: false,
  },
  hp_pb_g7: {
    processors: [
      { id: "i5_10",    label: "Intel Core i5 (10th Gen)", multiplier: 1.00, adj: 40 },
      { id: "i7_10",    label: "Intel Core i7 (10th Gen)", multiplier: 1.00, adj: 60 },
      { id: "r3_4300u", label: "AMD Ryzen 3 4300U",        multiplier: 1.00, adj: 20 },
      { id: "r5_4500u", label: "AMD Ryzen 5 4500U",        multiplier: 1.00, adj: 40 },
      { id: "r7_4700u", label: "AMD Ryzen 7 4700U",        multiplier: 1.00, adj: 60 },
    ],
    memory: [
      { id: "8",  label: "8 GB",  multiplier: 1.00, adj: 0 },
      { id: "16", label: "16 GB", multiplier: 1.00, adj: 10 },
      { id: "32", label: "32 GB", multiplier: 1.00, adj: 20 },
    ],
    storage: [
      { id: "256", label: "256 GB SSD", multiplier: 1.00, adj: 0 },
      { id: "512", label: "512 GB SSD", multiplier: 1.00, adj: 20 },
    ],
    hasNanoGlass: false,
  },
  // OMEN gaming laptops
  hp_omen_17: {
    processors: [
      { id: "i5_10",    label: "Intel Core i5 (10th Gen)",  multiplier: 1.00, adj: 230 },
      { id: "i5_11",    label: "Intel Core i5 (11th Gen)",  multiplier: 1.00, adj: 300 },
      { id: "i5_12",    label: "Intel Core i5 (12th Gen)",  multiplier: 1.00, adj: 360 },
      { id: "i7_10",    label: "Intel Core i7 (10th Gen)",  multiplier: 1.00, adj: 290 },
      { id: "i7_11",    label: "Intel Core i7 (11th Gen)",  multiplier: 1.00, adj: 350 },
      { id: "i7_12",    label: "Intel Core i7 (12th Gen)",  multiplier: 1.00, adj: 400 },
      { id: "i7_13",    label: "Intel Core i7 (13th Gen)",  multiplier: 1.00, adj: 455 },
      { id: "i7_14",    label: "Intel Core i7 (14th Gen)",  multiplier: 1.00, adj: 515 },
      { id: "i9_12",    label: "Intel Core i9 (12th Gen)",  multiplier: 1.00, adj: 450 },
      { id: "i9_13",    label: "Intel Core i9 (13th Gen)",  multiplier: 1.00, adj: 520 },
      { id: "r_ai5",    label: "AMD Ryzen AI 5 340",        multiplier: 1.00, adj: 450 },
      { id: "r7_8845",  label: "AMD Ryzen 7 8845HS",        multiplier: 1.00, adj: 500 },
      { id: "r_ai7",    label: "AMD Ryzen AI 7 350",        multiplier: 1.00, adj: 525 },
      { id: "r_ai9",    label: "AMD Ryzen AI 9 365",        multiplier: 1.00, adj: 675 },
    ],
    memory: [
      { id: "8",  label: "8 GB",  multiplier: 1.00, adj: 0 },
      { id: "16", label: "16 GB", multiplier: 1.00, adj: 15 },
      { id: "32", label: "32 GB", multiplier: 1.00, adj: 30 },
      { id: "64", label: "64 GB", multiplier: 1.00, adj: 55 },
    ],
    storage: [
      { id: "256", label: "256 GB SSD", multiplier: 1.00, adj: 0 },
      { id: "512", label: "512 GB SSD", multiplier: 1.00, adj: 15 },
      { id: "1tb", label: "1 TB SSD",   multiplier: 1.00, adj: 30 },
    ],
    hasNanoGlass: false,
  },
  hp_omen_16: {
    processors: [
      { id: "r5_4600h", label: "AMD Ryzen 5 4600H",   multiplier: 1.00, adj: 130 },
      { id: "r5_5600h", label: "AMD Ryzen 5 5600H",   multiplier: 1.00, adj: 170 },
      { id: "r5_7640",  label: "AMD Ryzen 5 7640HS",  multiplier: 1.00, adj: 240 },
      { id: "r_ai5",    label: "AMD Ryzen AI 5 340",  multiplier: 1.00, adj: 425 },
      { id: "r7_4800h", label: "AMD Ryzen 7 4800H",   multiplier: 1.00, adj: 190 },
      { id: "r7_5800h", label: "AMD Ryzen 7 5800H",   multiplier: 1.00, adj: 220 },
      { id: "r7_6800h", label: "AMD Ryzen 7 6800H",   multiplier: 1.00, adj: 280 },
      { id: "r7_7840",  label: "AMD Ryzen 7 7840HS",  multiplier: 1.00, adj: 350 },
      { id: "r_ai7",    label: "AMD Ryzen AI 7 350",  multiplier: 1.00, adj: 475 },
    ],
    memory: [
      { id: "8",  label: "8 GB",  multiplier: 1.00, adj: 0 },
      { id: "16", label: "16 GB", multiplier: 1.00, adj: 15 },
      { id: "32", label: "32 GB", multiplier: 1.00, adj: 30 },
      { id: "64", label: "64 GB", multiplier: 1.00, adj: 50 },
    ],
    storage: [
      { id: "256", label: "256 GB SSD", multiplier: 1.00, adj: 0 },
      { id: "512", label: "512 GB SSD", multiplier: 1.00, adj: 15 },
      { id: "1tb", label: "1 TB SSD",   multiplier: 1.00, adj: 30 },
    ],
    hasNanoGlass: false,
  },
  hp_omen_15: {
    processors: [
      { id: "r5_4600h", label: "AMD Ryzen 5 4600H",   multiplier: 1.00, adj: 270 },
      { id: "r5_5600h", label: "AMD Ryzen 5 5600H",   multiplier: 1.00, adj: 330 },
      { id: "r7_4800h", label: "AMD Ryzen 7 4800H",   multiplier: 1.00, adj: 300 },
      { id: "r7_5800h", label: "AMD Ryzen 7 5800H",   multiplier: 1.00, adj: 350 },
      { id: "r7_6800h", label: "AMD Ryzen 7 6800H",   multiplier: 1.00, adj: 390 },
    ],
    memory: [
      { id: "8",  label: "8 GB",  multiplier: 1.00, adj: 0 },
      { id: "16", label: "16 GB", multiplier: 1.00, adj: 15 },
      { id: "32", label: "32 GB", multiplier: 1.00, adj: 30 },
      { id: "64", label: "64 GB", multiplier: 1.00, adj: 50 },
    ],
    storage: [
      { id: "256", label: "256 GB SSD", multiplier: 1.00, adj: 0 },
      { id: "512", label: "512 GB SSD", multiplier: 1.00, adj: 15 },
      { id: "1tb", label: "1 TB SSD",   multiplier: 1.00, adj: 30 },
    ],
    hasNanoGlass: false,
  },
  // Envy — mainstream consumer
  hp_envy_x360: {
    processors: [
      { id: "i5_10",    label: "Intel Core i5 (10th Gen)",  multiplier: 1.00, adj: 135 },
      { id: "i5_11",    label: "Intel Core i5 (11th Gen)",  multiplier: 1.00, adj: 160 },
      { id: "i5_12",    label: "Intel Core i5 (12th Gen)",  multiplier: 1.00, adj: 185 },
      { id: "i5_13",    label: "Intel Core i5 (13th Gen)",  multiplier: 1.00, adj: 180 },
      { id: "r5_4500u", label: "AMD Ryzen 5 4500U",         multiplier: 1.00, adj: 150 },
      { id: "r5_5500u", label: "AMD Ryzen 5 5500U",         multiplier: 1.00, adj: 180 },
      { id: "r5_7530u", label: "AMD Ryzen 5 7530U",         multiplier: 1.00, adj: 200 },
    ],
    memory: [
      { id: "8",  label: "8 GB",  multiplier: 1.00, adj: 0 },
      { id: "16", label: "16 GB", multiplier: 1.00, adj: 15 },
      { id: "32", label: "32 GB", multiplier: 1.00, adj: 30 },
    ],
    storage: [
      { id: "256", label: "256 GB SSD", multiplier: 1.00, adj: 0 },
      { id: "512", label: "512 GB SSD", multiplier: 1.00, adj: 15 },
      { id: "1tb", label: "1 TB SSD",   multiplier: 1.00, adj: 30 },
      { id: "2tb", label: "2 TB SSD",   multiplier: 1.00, adj: 50 },
    ],
    hasNanoGlass: false,
  },
  hp_envy_15: {
    processors: [
      { id: "i5_8",  label: "Intel Core i5 (8th Gen)",   multiplier: 1.00, adj: 50 },
      { id: "i5_9",  label: "Intel Core i5 (9th Gen)",   multiplier: 1.00, adj: 80 },
      { id: "i5_10", label: "Intel Core i5 (10th Gen)",  multiplier: 1.00, adj: 120 },
      { id: "i5_11", label: "Intel Core i5 (11th Gen)",  multiplier: 1.00, adj: 145 },
      { id: "i7_8",  label: "Intel Core i7 (8th Gen)",   multiplier: 1.00, adj: 70 },
      { id: "i7_9",  label: "Intel Core i7 (9th Gen)",   multiplier: 1.00, adj: 115 },
      { id: "i7_10", label: "Intel Core i7 (10th Gen)",  multiplier: 1.00, adj: 140 },
      { id: "i7_11", label: "Intel Core i7 (11th Gen)",  multiplier: 1.00, adj: 165 },
    ],
    memory: [
      { id: "8",  label: "8 GB",  multiplier: 1.00, adj: 0 },
      { id: "16", label: "16 GB", multiplier: 1.00, adj: 15 },
      { id: "32", label: "32 GB", multiplier: 1.00, adj: 30 },
    ],
    storage: [
      { id: "256", label: "256 GB SSD", multiplier: 1.00, adj: 0 },
      { id: "512", label: "512 GB SSD", multiplier: 1.00, adj: 15 },
      { id: "1tb", label: "1 TB SSD",   multiplier: 1.00, adj: 30 },
    ],
    hasNanoGlass: false,
  },
  // ZBook — mobile workstation
  hp_zb_g11: {
    processors: [
      { id: "ultra5",  label: "Intel Core Ultra 5",         multiplier: 1.00, adj: 285 },
      { id: "ultra7",  label: "Intel Core Ultra 7",         multiplier: 1.00, adj: 340 },
      { id: "i7_13",   label: "Intel Core i7 (13th Gen)",   multiplier: 1.00, adj: 875 },
      { id: "i7_14",   label: "Intel Core i7 (14th Gen)",   multiplier: 1.00, adj: 1200 },
      { id: "i9_13",   label: "Intel Core i9 (13th Gen)",   multiplier: 1.00, adj: 1250 },
      { id: "i9_14",   label: "Intel Core i9 (14th Gen)",   multiplier: 1.00, adj: 1315 },
    ],
    memory: [
      { id: "8",   label: "8 GB",   multiplier: 1.00, adj: 0 },
      { id: "16",  label: "16 GB",  multiplier: 1.00, adj: 25 },
      { id: "32",  label: "32 GB",  multiplier: 1.00, adj: 50 },
      { id: "64",  label: "64 GB",  multiplier: 1.00, adj: 100 },
      { id: "128", label: "128 GB", multiplier: 1.00, adj: 150 },
    ],
    storage: [
      { id: "256", label: "256 GB SSD", multiplier: 1.00, adj: 0 },
      { id: "512", label: "512 GB SSD", multiplier: 1.00, adj: 25 },
      { id: "1tb", label: "1 TB SSD",   multiplier: 1.00, adj: 50 },
      { id: "2tb", label: "2 TB SSD",   multiplier: 1.00, adj: 100 },
      { id: "4tb", label: "4 TB SSD",   multiplier: 1.00, adj: 200 },
    ],
    hasNanoGlass: false,
  },
  hp_zb_g10: {
    processors: [
      { id: "r5p_7640",  label: "AMD Ryzen 5 Pro 7640HS",  multiplier: 1.00, adj: 150 },
      { id: "r7p_7840",  label: "AMD Ryzen 7 Pro 7840HS",  multiplier: 1.00, adj: 220 },
      { id: "r9p_7940",  label: "AMD Ryzen 9 Pro 7940HS",  multiplier: 1.00, adj: 265 },
      { id: "i5_13",     label: "Intel Core i5 (13th Gen)", multiplier: 1.00, adj: 190 },
      { id: "i7_13",     label: "Intel Core i7 (13th Gen)", multiplier: 1.00, adj: 235 },
    ],
    memory: [
      { id: "8",  label: "8 GB",  multiplier: 1.00, adj: 0 },
      { id: "16", label: "16 GB", multiplier: 1.00, adj: 25 },
      { id: "32", label: "32 GB", multiplier: 1.00, adj: 50 },
      { id: "64", label: "64 GB", multiplier: 1.00, adj: 75 },
    ],
    storage: [
      { id: "256", label: "256 GB SSD", multiplier: 1.00, adj: 0 },
      { id: "512", label: "512 GB SSD", multiplier: 1.00, adj: 25 },
      { id: "1tb", label: "1 TB SSD",   multiplier: 1.00, adj: 50 },
      { id: "2tb", label: "2 TB SSD",   multiplier: 1.00, adj: 75 },
    ],
    hasNanoGlass: false,
  },
  // HP OMEN Desktop (already existed)
  hpomendsk: {
    processors: [
      { id: "i9_13",     label: "Intel Core i9 (13th Gen)",     multiplier: 1.00, adj: 800 },
      { id: "ultra7_s2", label: "Intel Core Ultra 7 Series 2",  multiplier: 1.00, adj: 825 },
      { id: "ultra9_s2", label: "Intel Core Ultra 9 Series 2",  multiplier: 1.00, adj: 900 },
    ],
    memory: [
      { id: "16", label: "16 GB", multiplier: 1.00, adj: 0 },
      { id: "32", label: "32 GB", multiplier: 1.00, adj: 20 },
      { id: "64", label: "64 GB", multiplier: 1.00, adj: 40 },
    ],
    storage: [
      { id: "512", label: "512 GB SSD", multiplier: 1.00, adj: 0 },
      { id: "1tb", label: "1 TB SSD",   multiplier: 1.00, adj: 20 },
      { id: "2tb", label: "2 TB SSD",   multiplier: 1.00, adj: 40 },
    ],
    hasNanoGlass: false,
  },
};
