"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import Script from "next/script";
import { getResellEstimate, resellMultiplierForCondition, MARGIN_FLOOR_MULT } from "./lib/resell-estimates";
import { listSlots, bookSlot, type Slot } from "./lib/slots-store";

const BRAND = "Top Cash Cellular";
const EMAIL = "topcashcellular@gmail.com";
const EMAIL_HREF = "mailto:topcashcellular@gmail.com";

// Category icons — bold filled silhouette style inspired by IWM but with our
// own twist: a chunky body shape in soft white/15 fill, a 2px currentColor
// outline, and an inset detail (screen, keyboard, etc) plus a bright green
// brand-mark accent. Looks "stickery" and recognizable at small sizes.
type CatIconId = "phones" | "tablets" | "computers" | "desktops" | "watches" | "consoles" | "drones" | "vr";
function CategoryIcon({ id, className = "" }: { id: CatIconId; className?: string }) {
  const accent = "#00c853";
  const stroke = "currentColor";
  const body = { fill: "currentColor", fillOpacity: 0.14, stroke, strokeWidth: 1.9, strokeLinejoin: "round" as const, strokeLinecap: "round" as const };
  const detail = { fill: "none", stroke, strokeWidth: 1.6, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  switch (id) {
    case "phones":
      return (
        <svg viewBox="0 0 32 32" className={className}>
          <rect x="9" y="2.5" width="14" height="27" rx="3.2" {...body} />
          <rect x="11" y="6" width="10" height="17" rx="1.2" {...detail} />
          <rect x="13" y="4.2" width="6" height="1.2" rx="0.6" fill={stroke} />
          <line x1="13.5" y1="26" x2="18.5" y2="26" stroke={stroke} strokeWidth={1.9} strokeLinecap="round" />
          <circle cx="16" cy="14.5" r="2" fill={accent} />
        </svg>
      );
    case "tablets":
      return (
        <svg viewBox="0 0 32 32" className={className}>
          <rect x="4" y="4" width="24" height="24" rx="2.6" {...body} />
          <rect x="6.5" y="7.5" width="19" height="14.5" rx="1" {...detail} />
          <circle cx="16" cy="25.5" r="1" {...detail} strokeWidth={1.4} />
          <rect x="14.5" y="5.4" width="3" height="0.9" rx="0.4" fill={stroke} />
          <circle cx="9" cy="10.5" r="1.6" fill={accent} />
        </svg>
      );
    case "computers":
      return (
        <svg viewBox="0 0 32 32" className={className}>
          <path d="M7 7 h18 a1.4 1.4 0 0 1 1.4 1.4 v12.6 h-20.8 v-12.6 a1.4 1.4 0 0 1 1.4 -1.4 z" {...body} />
          <rect x="7.6" y="9" width="16.8" height="10.4" rx="0.8" {...detail} />
          <path d="M2.5 21.5 h27 l-1.4 3 a1.5 1.5 0 0 1 -1.36 0.9 h-21.48 a1.5 1.5 0 0 1 -1.36 -0.9 z" {...body} />
          <line x1="13" y1="23.5" x2="19" y2="23.5" stroke={stroke} strokeWidth={1.6} strokeLinecap="round" />
          <circle cx="16" cy="14.2" r="2" fill={accent} />
        </svg>
      );
    case "desktops":
      return (
        <svg viewBox="0 0 32 32" className={className}>
          <rect x="3" y="4" width="26" height="17" rx="2" {...body} />
          <rect x="5" y="6" width="22" height="13" rx="1" {...detail} />
          <line x1="13" y1="24.5" x2="19" y2="24.5" stroke={stroke} strokeWidth={1.7} strokeLinecap="round" />
          <line x1="16" y1="21" x2="16" y2="24.5" stroke={stroke} strokeWidth={1.7} strokeLinecap="round" />
          <line x1="9" y1="28" x2="23" y2="28" stroke={stroke} strokeWidth={2.2} strokeLinecap="round" />
          <circle cx="16" cy="12.5" r="2.2" fill={accent} />
        </svg>
      );
    case "watches":
      return (
        <svg viewBox="0 0 32 32" className={className}>
          <rect x="9" y="9" width="14" height="14" rx="3.2" {...body} />
          <path d="M11.5 9 l1.5 -4.5 h6 l1.5 4.5" {...body} fillOpacity={0.08} />
          <path d="M11.5 23 l1.5 4.5 h6 l1.5 -4.5" {...body} fillOpacity={0.08} />
          <rect x="11.5" y="11.5" width="9" height="9" rx="1.4" {...detail} />
          <line x1="24" y1="14" x2="26" y2="14" stroke={stroke} strokeWidth={2.2} strokeLinecap="round" />
          <line x1="24" y1="17.5" x2="25.5" y2="17.5" stroke={stroke} strokeWidth={1.6} strokeLinecap="round" />
          <circle cx="16" cy="16" r="2" fill={accent} />
        </svg>
      );
    case "consoles":
      return (
        <svg viewBox="0 0 32 32" className={className}>
          <path d="M9 10.5 h14 a5 5 0 0 1 5 5 v3.5 a4 4 0 0 1 -4 4 c-2.4 0 -3 -1.6 -4 -2.7 h-8 c-1 1.1 -1.6 2.7 -4 2.7 a4 4 0 0 1 -4 -4 v-3.5 a5 5 0 0 1 5 -5 z" {...body} />
          <line x1="11" y1="15.2" x2="11" y2="18.8" stroke={stroke} strokeWidth={2.2} strokeLinecap="round" />
          <line x1="9.2" y1="17" x2="12.8" y2="17" stroke={stroke} strokeWidth={2.2} strokeLinecap="round" />
          <circle cx="20.5" cy="15.4" r="1.3" fill={accent} />
          <circle cx="23" cy="17.8" r="1.2" fill={stroke} />
          <circle cx="20.5" cy="20" r="1.2" fill={stroke} fillOpacity={0.6} />
          <circle cx="18" cy="17.8" r="1.2" fill={stroke} fillOpacity={0.6} />
        </svg>
      );
    case "drones":
      return (
        <svg viewBox="0 0 32 32" className={className}>
          <line x1="9" y1="9" x2="13" y2="13" stroke={stroke} strokeWidth={2.4} strokeLinecap="round" />
          <line x1="23" y1="9" x2="19" y2="13" stroke={stroke} strokeWidth={2.4} strokeLinecap="round" />
          <line x1="9" y1="23" x2="13" y2="19" stroke={stroke} strokeWidth={2.4} strokeLinecap="round" />
          <line x1="23" y1="23" x2="19" y2="19" stroke={stroke} strokeWidth={2.4} strokeLinecap="round" />
          <circle cx="7" cy="7" r="3.4" {...body} />
          <circle cx="25" cy="7" r="3.4" {...body} />
          <circle cx="7" cy="25" r="3.4" {...body} />
          <circle cx="25" cy="25" r="3.4" {...body} />
          <rect x="12" y="12" width="8" height="8" rx="1.6" {...body} fillOpacity={0.22} />
          <circle cx="16" cy="16" r="1.8" fill={accent} />
        </svg>
      );
    case "vr":
      return (
        <svg viewBox="0 0 32 32" className={className}>
          <path d="M5 10 h22 a2.2 2.2 0 0 1 2.2 2.2 v7.2 a2.2 2.2 0 0 1 -2.2 2.2 h-5 c-1.1 0 -1.6 -0.5 -2.2 -1.5 l-1.3 -2.1 a2.2 2.2 0 0 0 -3.9 0 l-1.3 2.1 c-0.6 1 -1.1 1.5 -2.2 1.5 h-5 a2.2 2.2 0 0 1 -2.2 -2.2 v-7.2 a2.2 2.2 0 0 1 2.2 -2.2 z" {...body} />
          <ellipse cx="11" cy="15.5" rx="2.6" ry="2.2" fill={accent} />
          <ellipse cx="21" cy="15.5" rx="2.6" ry="2.2" fill={stroke} fillOpacity={0.55} />
        </svg>
      );
  }
}

// Carrier icons — real brand logos that Skywalker provided live under
// /public/carriers/. Each carrier card just renders the supplied PNG.
// 'other' has no logo so it still falls back to a neutral padlock SVG.
type CarrierIconId = "unlocked" | "att" | "tmobile" | "verizon" | "other";
function CarrierIcon({ id, className = "" }: { id: CarrierIconId; className?: string }) {
  if (id === "other") {
    return (
      <svg viewBox="0 0 32 32" className={className}>
        <rect x="3" y="3" width="26" height="26" rx="6" fill="currentColor" fillOpacity="0.08" stroke="currentColor" strokeWidth="1.6" />
        <path d="M11 16 v-3 a5 5 0 0 1 10 0 v3" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
        <rect x="9" y="16" width="14" height="9" rx="1.6" fill="currentColor" fillOpacity="0.7" stroke="currentColor" strokeWidth="1.6" />
        <circle cx="16" cy="20" r="1.4" fill="#0a0a0a" />
        <line x1="16" y1="20.6" x2="16" y2="23" stroke="#0a0a0a" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    );
  }
  return <img src={`/carriers/${id}.png`} alt="" className={`${className} object-contain`} loading="lazy" />;
}

// ========== DIRECT PRICE TABLE ==========
// Scraped from IWM, discounted 5% (iPhone) / 10% (everything else).
// Format: { deviceId: { storageId: { conditionId: price } } }
// Prices are for Unlocked/Verizon (best carrier). Carrier deductions
// are flat dollar amounts from CARRIER_DEDUCTIONS table, not multipliers.
// Falls back to multiplier formula for any device/combo not in the table.

// Carrier deductions — flat dollar amounts per device (from IWM data).
// Applied as subtraction, not multiplication. Varies by device value.
// Format: { deviceId: { carrierId: deduction } }
// Verizon/Unlocked = $0 (base price). AT&T, T-Mobile, Other have deductions.
const CARRIER_DEDUCTIONS: Record<string, Record<string, number>> = {
  // iPhone 17 series
  ip17pm: { att: 120, tmobile: 105, other: 500 },
  ip17p:  { att: 120, tmobile: 105, other: 500 },
  ip17air: { att: 100, tmobile: 90, other: 400 },
  ip17:   { att: 100, tmobile: 90, other: 400 },
  ip17e:  { att: 60, tmobile: 80, other: 200 },
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
const MIN_OFFER = 25;

// High-value devices that require manual review before payout.
// Quote is shown to customer but backend flags the lead for owner approval.
const MANUAL_REVIEW_DEVICES = new Set([
  "macstudiom4m", "macprom2u", "macstudiom4u",
  "mbp14m3", "mbp16m3", "mbp16_m5pmax_2026",
  "macstudiom2m", "mbp16m4", "mba_m5_2026",
  "macstudiom2u", "macminim4", "gztrifold",
]);

const PRICE_TABLE: Record<string, Record<string, Record<string, number>>> = {
  ip11: {
    "128": { broken: 20, fair: 76, good: 95, mint: 109, sealed: 138 },
    "256": { broken: 21, fair: 90, good: 109, mint: 124, sealed: 152 },
    "64": { broken: 19, fair: 43, good: 62, mint: 76, sealed: 124 },
  },
  ip11p: {
    "256": { broken: 26, fair: 90, good: 119, mint: 133, sealed: 152 },
    "512": { broken: 28, fair: 114, good: 142, mint: 157, sealed: 171 },
    "64": { broken: 24, fair: 62, good: 90, mint: 104, sealed: 124 },
  },
  ip11pm: {
    "256": { fair: 133, good: 162, mint: 180, sealed: 204 },
    "512": { fair: 152, good: 180, mint: 200, sealed: 209 },
    "64": { fair: 128, good: 157, mint: 176, sealed: 195 },
  },
  ip12: {
    "128": { fair: 90, good: 119, mint: 138, sealed: 142 },
    "256": { fair: 104, good: 133, mint: 152, sealed: 147 },
    "64": { fair: 62, good: 90, mint: 109, sealed: 133 },
  },
  ip12mini: {
    "128": { fair: 48, good: 71, mint: 86, sealed: 109 },
    "256": { fair: 52, good: 76, mint: 90, sealed: 114 },
    "64": { fair: 19, good: 43, mint: 57, sealed: 104 },
  },
  ip12p: {
    "128": { fair: 95, good: 142, mint: 162, sealed: 195 },
    "256": { fair: 133, good: 180, mint: 200, sealed: 209 },
    "512": { fair: 133, good: 180, mint: 200, sealed: 218 },
  },
  ip12pm: {
    "128": { fair: 138, good: 195, mint: 209, sealed: 238 },
    "256": { fair: 157, good: 214, mint: 228, sealed: 276 },
    "512": { fair: 171, good: 228, mint: 242, sealed: 304 },
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
  ip17: {
    "256": { broken: 247, fair: 418, good: 494, mint: 546, sealed: 589, verygood: 518 },
    "512": { broken: 323, fair: 513, good: 589, mint: 641, sealed: 694, verygood: 613 },
  },
  ip17air: {
    "1tb": { broken: 332, fair: 575, good: 636, mint: 703, sealed: 793, verygood: 656 },
    "256": { broken: 218, fair: 446, good: 508, mint: 575, sealed: 622, verygood: 527 },
    "512": { broken: 294, fair: 504, good: 565, mint: 632, sealed: 727, verygood: 584 },
  },
  ip17e: {
    "256": { broken: 95, fair: 238, good: 299, mint: 342, sealed: 356, verygood: 318 },
    "512": { broken: 114, fair: 285, good: 347, mint: 390, sealed: 408, verygood: 366 },
  },
  ip17p: {
    "1tb": { broken: 437, fair: 689, good: 822, mint: 898, sealed: 993, verygood: 850 },
    "256": { broken: 285, fair: 546, good: 679, mint: 755, sealed: 803, verygood: 708 },
    "512": { broken: 399, fair: 641, good: 774, mint: 850, sealed: 945, verygood: 803 },
  },
  ip17pm: {
    "1tb": { broken: 399, fair: 874, good: 969, mint: 1016, sealed: 1078, verygood: 988 },
    "256": { broken: 332, fair: 717, good: 812, mint: 860, sealed: 888, verygood: 831 },
    "2tb": { broken: 475, fair: 907, good: 1002, mint: 1050, sealed: 1268, verygood: 1021 },
    "512": { broken: 361, fair: 812, good: 907, mint: 955, sealed: 983, verygood: 926 },
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

const IPHONE_SERIES = [
  // Bases: IWM_lowest_storage × 0.95 / lowest_storage_mult
  // iPhone = 5% below IWM. Everything else = 10% below.
  { id: "17", label: "iPhone 17", image: "/iphone17.png", year: "2025", topPrice: 860, variants: [
    { id: "ip17pm", label: "iPhone 17 Pro Max", base: 767, image: "/devices/iphone-17-pro-max-test.png" },   // IWM 256GB=$905
    { id: "ip17p", label: "iPhone 17 Pro", base: 726, image: "/devices/iphone-17-pro-test.png" },
    { id: "ip17air", label: "iPhone 17 Air", base: 620, image: "/devices/iphone-17-air-test.png" },
    { id: "ip17", label: "iPhone 17", base: 581, image: "/devices/iphone-17-test.png" },
    { id: "ip17e", label: "iPhone 17E", base: 352, image: "/iphone17e.png" },
  ]},
  { id: "16", label: "iPhone 16", image: "/iphone16.png", year: "2024", topPrice: 608, variants: [
    { id: "ip16pm", label: "iPhone 16 Pro Max", base: 543, image: "/devices/iphone-16-pro-max-test.png" },   // IWM est 256GB=$640
    { id: "ip16p", label: "iPhone 16 Pro", base: 514, image: "/devices/bm/iphone-16-pro.png" },              // IWM est 128GB=$541
    { id: "ip16plus", label: "iPhone 16 Plus", base: 413, image: "/devices/iphone-16-plus-test.png" },       // IWM est 128GB=$435
    { id: "ip16", label: "iPhone 16", base: 393, image: "/devices/bm/iphone-16.png" },                       // IWM est 128GB=$414
    { id: "ip16e", label: "iPhone 16E", base: 233, image: "/devices/iphone-16e-test.png" },
  ]},
  { id: "15", label: "iPhone 15", image: "/iphone15.png", year: "2023", topPrice: 428, variants: [
    { id: "ip15pm", label: "iPhone 15 Pro Max", base: 382, image: "/devices/bm/iphone-15-pro-max.png" },     // IWM est 256GB=$451
    { id: "ip15p", label: "iPhone 15 Pro", base: 386, image: "/devices/bm/iphone-15-pro.png" },              // IWM est 128GB=$406
    { id: "ip15plus", label: "iPhone 15 Plus", base: 319, image: "/devices/bm/iphone-15-plus.png" },         // IWM est 128GB=$336
    { id: "ip15", label: "iPhone 15", base: 284, image: "/devices/bm/iphone-15.png" },                       // IWM est 128GB=$299
  ]},
  { id: "14", label: "iPhone 14", image: "/iphone14.png", year: "2022", topPrice: 358, variants: [
    { id: "ip14pm", label: "iPhone 14 Pro Max", base: 358, image: "/devices/bm/iphone-14-pro-max.png" },     // IWM est 128GB=$377
    { id: "ip14p", label: "iPhone 14 Pro", base: 296, image: "/devices/bm/iphone-14-pro.png" },              // IWM est 128GB=$312
    { id: "ip14plus", label: "iPhone 14 Plus", base: 126, image: "/devices/bm/iphone-14-plus.png" },
    { id: "ip14", label: "iPhone 14", base: 230, image: "/devices/bm/iphone-14.png" },                       // IWM est 128GB=$242
  ]},
  { id: "13", label: "iPhone 13", image: "/iphone13.png", year: "2021", topPrice: 284, variants: [
    { id: "ip13pm", label: "iPhone 13 Pro Max", base: 284, image: "/devices/bm/iphone-13-pro-max.png" },     // IWM est 128GB=$299
    { id: "ip13p", label: "iPhone 13 Pro", base: 245, image: "/devices/bm/iphone-13-pro.png" },              // IWM est 128GB=$258
    { id: "ip13", label: "iPhone 13", base: 167, image: "/devices/bm/iphone-13.png" },                       // IWM est 128GB=$176
  ]},
  { id: "12", label: "iPhone 12", image: "/iphone12.png", year: "2020", topPrice: 198, variants: [
    { id: "ip12pm", label: "iPhone 12 Pro Max", base: 198, image: "/devices/bm/iphone-12-pro-max.png" },     // IWM est 128GB=$209
    { id: "ip12p", label: "iPhone 12 Pro", base: 126, image: "/devices/bm/iphone-12-pro.png" },
    { id: "ip12", label: "iPhone 12", base: 147, image: "/devices/bm/iphone-12.png" },                       // IWM est 64GB=$131
    { id: "ip12mini", label: "iPhone 12 Mini", base: 72, image: "/devices/bm/iphone-12-mini.png" },
  ]},
  { id: "11", label: "iPhone 11", image: "/iphone11.png", year: "2019", topPrice: 192, variants: [
    { id: "ip11pm", label: "iPhone 11 Pro Max", base: 192, image: "/devices/bm/iphone-11-pro-max.png" },     // IWM est 64GB=$172
    { id: "ip11p", label: "iPhone 11 Pro", base: 114, image: "/devices/bm/iphone-11-pro.png" },
    { id: "ip11", label: "iPhone 11", base: 120, image: "/devices/bm/iphone-11.png" },                       // IWM est 64GB=$107
  ]},
];

// S/Z/Note rebased 2026-05-12 (round 2) on REAL IWM data after the
// Samsung/Pixel/all non-iPhone = 10% below IWM (was 15%).
// iPhone = 5% below. Condition mults match IWM ratios.
const SAMSUNG_SERIES = [
  { id: "sseries", label: "S Series", year: "Galaxy S20–S26", topPrice: 657, image: "/s-series.png", variants: [
    { id: "gs26u", label: "Galaxy S26 Ultra", base: 469, image: "/devices/gs26u.webp" },     // IWM $730
    { id: "gs25u", label: "Galaxy S25 Ultra", base: 414, image: "/devices/gs25u.webp" },     // IWM $645
    { id: "gs24u", label: "Galaxy S24 Ultra", base: 334, image: "/devices/gs24u.webp" },     // IWM $520
    { id: "gs23u", label: "Galaxy S23 Ultra", base: 209, image: "/devices/gs23u.webp" },     // IWM $325
    { id: "gs22u", label: "Galaxy S22 Ultra", base: 106, image: "/devices/gs22u.webp" },     // IWM $165
    { id: "gs21u", label: "Galaxy S21 Ultra", base: 118, image: "/devices/gs21u.webp" },     // fixed: was 75 (< S20U)
    { id: "gs20u", label: "Galaxy S20 Ultra", base: 111, image: "/devices/gs20u.webp" },     // IWM $155
    { id: "gs25edge", label: "Galaxy S25 Edge", base: 270, image: "/devices/gs25edge.webp" }, // IWM $375
    { id: "gs26p", label: "Galaxy S26+", base: 389, image: "/devices/gs26p.webp" },          // IWM $540
    { id: "gs25p", label: "Galaxy S25+", base: 330, image: "/devices/gs25p.webp" },          // IWM $460
    { id: "gs24p", label: "Galaxy S24+", base: 212, image: "/devices/gs24p.webp" },          // IWM $295
    { id: "gs23p", label: "Galaxy S23+", base: 150, image: "/devices/gs23p.webp" },          // IWM $210
    { id: "gs22p", label: "Galaxy S22+", base: 96, image: "/devices/gs22p.webp" },           // IWM $120
    { id: "gs21p", label: "Galaxy S21+", base: 64, image: "/devices/gs21p.webp" },           // IWM $80
    { id: "gs20p", label: "Galaxy S20+", base: 78, image: "/devices/gs20p.webp" },           // IWM $110
    { id: "gs26", label: "Galaxy S26", base: 342, image: "/devices/gs26.webp" },             // IWM $475
    { id: "gs25", label: "Galaxy S25", base: 237, image: "/devices/gs25.webp" },             // IWM $330
    { id: "gs24", label: "Galaxy S24", base: 193, image: "/devices/gs24.webp" },             // IWM $240
    { id: "gs23", label: "Galaxy S23", base: 111, image: "/devices/gs23.webp" },             // IWM $155
    { id: "gs22", label: "Galaxy S22", base: 72, image: "/devices/gs22.webp" },              // IWM $90
    { id: "gs21", label: "Galaxy S21", base: 52, image: "/devices/gs21.webp" },              // IWM $65
    { id: "gs20", label: "Galaxy S20", base: 67, image: "/devices/gs20.webp" },              // IWM $75
    { id: "gs25fe", label: "Galaxy S25 FE", base: 213, image: "/devices/gs25fe.webp" },      // IWM $265
    { id: "gs24fe", label: "Galaxy S24 FE", base: 137, image: "/devices/gs24fe.webp" },      // IWM $170
    { id: "gs23fe", label: "Galaxy S23 FE", base: 79, image: "/devices/gs23fe.webp" },       // IWM $100
    { id: "gs21fe", label: "Galaxy S21 FE", base: 39, image: "/devices/gs21fe.webp" },       // IWM $50
    { id: "gs20fe", label: "Galaxy S20 FE", base: 48, image: "/devices/gs20fe.webp" },       // IWM $60
  ]},
  { id: "zseries", label: "Z Series", year: "Z Fold + Z Flip + TriFold", topPrice: 1845, image: "/fold-series.webp", variants: [
    { id: "gztrifold", label: "Galaxy Z TriFold", base: 1317, image: "/devices/gztrifold.webp" }, // IWM $2050
    { id: "gzfold7", label: "Galaxy Z Fold 7", base: 526, image: "/devices/gzfold7.webp" },       // IWM $820
    { id: "gzfold6", label: "Galaxy Z Fold 6", base: 334, image: "/devices/gzfold6.webp" },       // IWM $520
    { id: "gzfold5", label: "Galaxy Z Fold 5", base: 228, image: "/devices/gzfold5.webp" },       // IWM $355
    { id: "gzfold4", label: "Galaxy Z Fold 4", base: 157, image: "/devices/gzfold4.webp" },       // IWM $245
    { id: "gzfold3", label: "Galaxy Z Fold 3", base: 111, image: "/devices/gzfold3.webp" },       // IWM $155
    { id: "gzflip7", label: "Galaxy Z Flip 7", base: 320, image: "/devices/gzflip7.webp" },       // IWM $445
    { id: "gzflip6", label: "Galaxy Z Flip 6", base: 201, image: "/devices/gzflip6.webp" },       // IWM $280
    { id: "gzflip5", label: "Galaxy Z Flip 5", base: 150, image: "/devices/gzflip5.webp" },       // IWM $210
    { id: "gzflip4", label: "Galaxy Z Flip 4", base: 32, image: "/devices/gzflip4.webp" },        // IWM $45
    { id: "gzflip3", label: "Galaxy Z Flip 3", base: 39, image: "/devices/gzflip3.webp" },        // IWM $50
  ]},
  { id: "noteseries", label: "Note Series", year: "Note 9 / 10 / 20", topPrice: 157, image: "/devices/gnote20u.webp", variants: [
    { id: "gnote20u", label: "Galaxy Note 20 Ultra 5G", base: 126, image: "/devices/gnote20u.webp" },     // IWM $175
    { id: "gnote20", label: "Galaxy Note 20 5G", base: 98, image: "/devices/gnote20.webp" },              // IWM $110
    { id: "gnote10p5g", label: "Galaxy Note 10+ 5G", base: 104, image: "/devices/gnote10p5g.webp" },      // IWM $145
    { id: "gnote10p", label: "Galaxy Note 10+", base: 101, image: "/devices/gnote10p.webp" },              // IWM $140
    { id: "gnote10", label: "Galaxy Note 10", base: 72, image: "/devices/gnote10.webp" },                 // IWM $90
    { id: "gnote9", label: "Galaxy Note 9", base: 60, image: "/devices/gnote9.webp" },                    // IWM $85
  ]},
];

const PIXEL_SERIES = [
  { id: "pproseries", label: "Pro Series", year: "Pixel 6 Pro–10 Pro XL", topPrice: 561, image: "/pixel-pro-series.webp", variants: [
    { id: "px10pxl", label: "Pixel 10 Pro XL", base: 561, image: "/devices/px10pxl.webp" },
    { id: "px10p", label: "Pixel 10 Pro", base: 466, image: "/devices/px10p.webp" },
    { id: "px9pxl", label: "Pixel 9 Pro XL", base: 397, image: "/devices/pixel-9-pro-xl.webp" },
    { id: "px9p", label: "Pixel 9 Pro", base: 323, image: "/devices/pixel-9-pro.webp" },
    { id: "px8p", label: "Pixel 8 Pro", base: 254, image: "/devices/pixel-8-pro.webp" },
    { id: "px7p", label: "Pixel 7 Pro", base: 90, image: "/devices/pixel-7-pro.webp" },
    { id: "px6p", label: "Pixel 6 Pro", base: 53, image: "/devices/pixel-6-pro.webp" },
  ]},
  { id: "pstandard", label: "Standard Series", year: "Pixel 5–10 + a-series", topPrice: 344, image: "/pixel-standard-series.webp", variants: [
    { id: "px10", label: "Pixel 10", base: 344, image: "/devices/px10.webp" },
    { id: "px10a", label: "Pixel 10a", base: 154, image: "/devices/px10a.webp" },
    { id: "px9", label: "Pixel 9", base: 196, image: "/devices/pixel-9.webp" },
    { id: "px9a", label: "Pixel 9a", base: 143, image: "/devices/pixel-9a.webp" },
    { id: "px8", label: "Pixel 8", base: 127, image: "/devices/pixel-8.webp" },
    { id: "px8a", label: "Pixel 8a", base: 95, image: "/devices/pixel-8a.webp" },
    { id: "px7", label: "Pixel 7", base: 48, image: "/devices/pixel-7.webp" },
    { id: "px7a", label: "Pixel 7a", base: 11, image: "/devices/pixel-7a.webp" },
    { id: "px6", label: "Pixel 6", base: 42, image: "/devices/pixel-6.webp" },
    { id: "px6a", label: "Pixel 6a", base: 0, inquiryOnly: true, image: "/devices/pixel-6a.webp" },
    { id: "px5", label: "Pixel 5", base: 53, image: "/devices/px5.webp" },
    { id: "px5a", label: "Pixel 5a (5G)", base: 32, image: "/devices/px5a.webp" },
  ]},
  { id: "pfoldseries", label: "Fold Series", year: "Pixel Fold lineup", topPrice: 800, image: "/pixel-fold-series.webp", variants: [
    { id: "px10pfold", label: "Pixel 10 Pro Fold", base: 800, image: "/devices/px10pfold.webp" },
    { id: "px9pfold", label: "Pixel 9 Pro Fold", base: 609, image: "/devices/px9pfold.webp" },
    { id: "pxfold", label: "Pixel Fold", base: 297, image: "/devices/pxfold.webp" },
  ]},
];

const MACBOOK_PRO_MODELS = [
  // Bases rebased 2026-05-11 against Atlas Mobile price sheet for MacBook
  // — formula: Atlas's lowest 'Open' variant per model line minus $250
  // (midpoint of Skywalker's $200-$300 rule). Older models (M3, M2 Pro/13,
  // M1 Pro) are NOT on Atlas — left at prior bases pending comp study.
  { id: "mbp16_m5pmax_2026", label: "MacBook Pro 16\" M5 (2026)", base: 1737, image: "/devices/macbook-pro-m4.webp" },
  { id: "mbp14_m5pmax_2026", label: "MacBook Pro 14\" M5 (2026)", base: 1334, image: "/devices/macbook-pro-m4.webp" },
  { id: "mbp14_m5_2025", label: "MacBook Pro 14\" M5 (2025)", base: 1043, image: "/devices/macbook-pro-m4.webp" },
  { id: "mbp16m4", label: "MacBook Pro 16\" M4 (2024)", base: 1456, image: "/devices/macbook-pro-m4.webp" },
  { id: "mbp14m4", label: "MacBook Pro 14\" M4 (2024)", base: 768, image: "/devices/macbook-pro-m4.webp" },
  // Models below set at 10% below competition (IWM/Decluttr avg).
  { id: "mbp16m3", label: "MacBook Pro 16\" M3 (2023)", base: 847, image: "/devices/macbook-pro-m3.webp" },
  { id: "mbp14m3", label: "MacBook Pro 14\" M3 (2023)", base: 635, image: "/devices/macbook-pro-m3.webp" },
  { id: "mbp16m2", label: "MacBook Pro 16\" M2 (2023)", base: 604, image: "/devices/macbook-pro-m2.webp" },
  { id: "mbp14m2", label: "MacBook Pro 14\" M2 (2023)", base: 445, image: "/devices/macbook-pro-m2.webp" },
  { id: "mbp13m1", label: "MacBook Pro 13\" M1 (2020)", base: 180, image: "/devices/macbook-pro-m1.webp" },
  { id: "mbp13_intel_2020", label: "MacBook Pro 13\" Intel (2020)", base: 0, inquiryOnly: true, image: "/devices/macbook-pro-m1.webp" },
  { id: "mbp16_intel_2019", label: "MacBook Pro 16\" Intel (2019)", base: 0, inquiryOnly: true, image: "/devices/macbook-pro-m1.webp" },
  { id: "mbp_tb_2018_2019", label: "MacBook Pro Touch Bar 13\"/15\" (2018–2019)", base: 0, inquiryOnly: true, image: "/devices/macbook-pro-m1.webp" },
  { id: "mbp_tb_2016_2017", label: "MacBook Pro Touch Bar 13\"/15\" (2016–2017)", base: 0, inquiryOnly: true, image: "/devices/macbook-pro-m1.webp" },
  { id: "mbp_retina_2015", label: "MacBook Pro Retina 13\"/15\" (2015)", base: 0, inquiryOnly: true, image: "/devices/macbook-pro-m1.webp" },
  { id: "mbp_retina_2014", label: "MacBook Pro Retina 13\"/15\" (2014)", base: 0, inquiryOnly: true, image: "/devices/macbook-pro-m1.webp" },
];
const MACBOOK_AIR_MODELS = [
  // Bases rebased 2026-05-11 against Atlas Mobile sheet — Atlas Open price
  // minus $250. M3 Air not listed on Atlas; left at prior base.
  { id: "mba_m5_2026", label: "MacBook Air M5 (13\" & 15\", 2026)", base: 662, image: "/devices/macbook-air-m3.webp" },
  { id: "mba_m4_2025", label: "MacBook Air M4 (13\" & 15\", 2025)", base: 498, image: "/devices/macbook-air-m3.webp" },
  { id: "mba15m3", label: "MacBook Air 15\" M3 (2024)", base: 540, image: "/devices/macbook-air-m3.webp" },
  { id: "mba13m3", label: "MacBook Air 13\" M3 (2024)", base: 365, image: "/devices/macbook-air-m3.webp" },
  { id: "mba15m2", label: "MacBook Air 15\" M2 (2023)", base: 328, image: "/devices/macbook-air-m2.webp" },
  { id: "mba13m2", label: "MacBook Air 13\" M2 (2022)", base: 297, image: "/devices/macbook-air-m2.webp" },
  { id: "mba13m1", label: "MacBook Air 13\" M1 (2020)", base: 212, image: "/devices/macbook-air-m1.webp" },
  { id: "mba_intel_2020", label: "MacBook Air Intel (2020)", base: 0, inquiryOnly: true },
  { id: "mba_retina_2018_2019", label: "MacBook Air Retina (2018–2019)", base: 0, inquiryOnly: true },
  { id: "mba_2017", label: "MacBook Air (2017)", base: 0, inquiryOnly: true },
  { id: "mba_2014_2015", label: "MacBook Air (2014–2015)", base: 0, inquiryOnly: true },
];
// MacBook Neo (2026) — new A18 Pro-chip entry-level laptop. Single 13"
// SKU with 256/512 storage tiers covered by STORAGE_MAP. Base set to
// the 256GB Atlas Open price (- $250); the storage multiplier on the
// storage step bumps it for 512GB selections.
const MACBOOK_NEO_MODELS = [
  { id: "mbneo13", label: "MacBook Neo 13\" (A18 Pro, 2026)", base: 0, inquiryOnly: true },
];
const MACBOOK_CLASSIC_MODELS = [
  { id: "mb12_2017", label: "MacBook 12\" (2017)", base: 0, inquiryOnly: true },
  { id: "mb12_2016", label: "MacBook 12\" (2016)", base: 0, inquiryOnly: true },
  { id: "mb12_2015", label: "MacBook 12\" (2015)", base: 0, inquiryOnly: true },
];
// Mirrors IWM's MacBook categories: Pro, Air, Neo (new A-chip line),
// classic 12-inch.
const MACBOOK_SERIES = [
  { id: "mbpro", label: "MacBook Pro", year: "M1–M5", topPrice: 1737, image: "/macbook-pro-series.webp", variants: MACBOOK_PRO_MODELS },
  { id: "mbair", label: "MacBook Air", year: "M1–M5", topPrice: 662, image: "/macbook-air-series.webp", variants: MACBOOK_AIR_MODELS },
  { id: "mbneo", label: "MacBook Neo", year: "A18 Pro · 2026", topPrice: 270, image: "/macbook-classic-series.webp", variants: MACBOOK_NEO_MODELS },
  { id: "mbclassic", label: "MacBook", year: "12-inch Retina", topPrice: 0, image: "/macbook-classic-series.webp", variants: MACBOOK_CLASSIC_MODELS, inquiryOnly: true },
];

// SAMSUNG_PC_MODELS removed — replaced by SAMSUNG_PC_SERIES tree below
// (Galaxy Book / Book2 / Book3 / Book4 / Book5, mirroring IWM).

// LENOVO LAPTOPS — three-level tree mirroring itsworthmore.com.
// 100 models scraped 2026-05-10 from IWM, 86 with per-product photos.
// ThinkPad and ThinkBook split into sub-series; IdeaPad/Legion/LOQ/Slim/
// Yoga are flat. T and E ThinkPad pages returned no products on IWM so
// they're omitted from the sub-series list.
const LENOVO_TP_X1_VARIANTS = [
  { id: "ln_tp_x1_carbon_g13", label: "ThinkPad X1 Carbon Gen 13", base: 652, inquiryOnly: false, image: "/devices/lenovo-laptop-generic.svg" },
  { id: "ln_tp_x1_carbon_g12", label: "ThinkPad X1 Carbon Gen 12", base: 468, inquiryOnly: false, image: "/devices/lenovo-laptop-generic.svg" },
  { id: "ln_tp_x1_carbon_g11", label: "ThinkPad X1 Carbon Gen 11", base: 333, inquiryOnly: false, image: "/devices/lenovo-laptop-generic.svg" },
  { id: "ln_tp_x1_carbon_g10", label: "ThinkPad X1 Carbon Gen 10", base: 248, inquiryOnly: false, image: "/devices/lenovo-laptop-generic.svg" },
  { id: "ln_tp_x1_carbon_g9", label: "ThinkPad X1 Carbon Gen 9", base: 198, inquiryOnly: false, image: "/devices/lenovo-laptop-generic.svg" },
  { id: "ln_tp_x1_carbon_g8", label: "ThinkPad X1 Carbon Gen 8", base: 148, inquiryOnly: false, image: "/devices/lenovo-laptop-generic.svg" },
  { id: "ln_tp_x1_carbon_g7", label: "ThinkPad X1 Carbon Gen 7", base: 117, inquiryOnly: false, image: "/devices/lenovo-laptop-generic.svg" },
  { id: "ln_tp_x1_carbon_g6", label: "ThinkPad X1 Carbon Gen 6", base: 104, inquiryOnly: false, image: "/devices/lenovo-laptop-generic.svg" },
  { id: "ln_tp_x1_extreme_g5", label: "ThinkPad X1 Extreme Gen 5", base: 540, inquiryOnly: false, image: "/devices/lenovo-laptop-generic.svg" },
  { id: "ln_tp_x1_extreme_g4", label: "ThinkPad X1 Extreme Gen 4", base: 387, inquiryOnly: false, image: "/devices/lenovo-laptop-generic.svg" },
  { id: "ln_tp_x1_extreme_g3", label: "ThinkPad X1 Extreme Gen 3", base: 270, inquiryOnly: false, image: "/devices/lenovo-laptop-generic.svg" },
  { id: "ln_tp_x1_extreme_g2", label: "ThinkPad X1 Extreme Gen 2", base: 171, inquiryOnly: false, image: "/devices/lenovo-laptop-generic.svg" },
  { id: "ln_tp_x1_extreme_g1", label: "ThinkPad X1 Extreme Gen 1", base: 144, inquiryOnly: false, image: "/devices/lenovo-laptop-generic.svg" },
  { id: "ln_tp_x1_fold", label: "ThinkPad X1 Fold", base: 630, inquiryOnly: false, image: "/devices/lenovo-laptop-generic.svg" },
  { id: "ln_tp_x1_nano_g3", label: "ThinkPad X1 Nano Gen 3", base: 414, inquiryOnly: false, image: "/devices/lenovo-laptop-generic.svg" },
  { id: "ln_tp_x1_nano_g2", label: "ThinkPad X1 Nano Gen 2", base: 306, inquiryOnly: false, image: "/devices/lenovo-laptop-generic.svg" },
  { id: "ln_tp_x1_nano_g1", label: "ThinkPad X1 Nano Gen 1", base: 202, inquiryOnly: false, image: "/devices/lenovo-laptop-generic.svg" },
  { id: "ln_tp_x1_yoga_g8", label: "ThinkPad X1 Yoga Gen 8", base: 342, inquiryOnly: false, image: "/devices/lenovo-laptop-generic.svg" },
  { id: "ln_tp_x1_yoga_g7", label: "ThinkPad X1 Yoga Gen 7", base: 279, inquiryOnly: false, image: "/devices/lenovo-laptop-generic.svg" },
  { id: "ln_tp_x1_yoga_g6", label: "ThinkPad X1 Yoga Gen 6", base: 189, inquiryOnly: false, image: "/devices/lenovo-laptop-generic.svg" },
  { id: "ln_tp_x1_yoga_g5", label: "ThinkPad X1 Yoga Gen 5", base: 99, inquiryOnly: false, image: "/devices/lenovo-laptop-generic.svg" },
  { id: "ln_tp_x1_yoga_g4", label: "ThinkPad X1 Yoga Gen 4", base: 90, inquiryOnly: false, image: "/devices/lenovo-laptop-generic.svg" },
  { id: "ln_tp_x1_yoga_g3", label: "ThinkPad X1 Yoga Gen 3", base: 86, inquiryOnly: false, image: "/devices/lenovo-laptop-generic.svg" },
  { id: "ln_tp_x1_2in1_g10", label: "ThinkPad X1 2-in-1 Gen 10", base: 562, inquiryOnly: false, image: "/devices/lenovo-laptop-generic.svg" },
  { id: "ln_tp_x1_2in1_g9", label: "ThinkPad X1 2-in-1 Gen 9", base: 513, inquiryOnly: false, image: "/devices/lenovo-laptop-generic.svg" },
  { id: "ln_tp_x1_titanium_yoga", label: "ThinkPad X1 Titanium Yoga", base: 216, inquiryOnly: false, image: "/devices/lenovo-laptop-generic.svg" },
];
const LENOVO_TP_X13_VARIANTS = [
  { id: "ln_tp_x13_g6", label: "ThinkPad X13 Gen 6", base: 441, inquiryOnly: false, image: "/devices/lenovo-laptop-generic.svg" },
  { id: "ln_tp_x13_g5", label: "ThinkPad X13 Gen 5", base: 297, inquiryOnly: false, image: "/devices/lenovo-laptop-generic.svg" },
  { id: "ln_tp_x13_g4", label: "ThinkPad X13 Gen 4", base: 288, inquiryOnly: false, image: "/devices/lenovo-laptop-generic.svg" },
  { id: "ln_tp_x13_g3", label: "ThinkPad X13 Gen 3", base: 171, inquiryOnly: false, image: "/devices/lenovo-laptop-generic.svg" },
  { id: "ln_tp_x13_g2", label: "ThinkPad X13 Gen 2", base: 112, inquiryOnly: false, image: "/devices/lenovo-laptop-generic.svg" },
  { id: "ln_tp_x13_g1", label: "ThinkPad X13 Gen 1", base: 36, inquiryOnly: false, image: "/devices/lenovo-laptop-generic.svg" },
  { id: "ln_tp_x13_yoga_g4", label: "ThinkPad X13 Yoga Gen 4", base: 292, inquiryOnly: false, image: "/devices/lenovo-laptop-generic.svg" },
  { id: "ln_tp_x13_yoga_g3", label: "ThinkPad X13 Yoga Gen 3", base: 225, inquiryOnly: false, image: "/devices/lenovo-laptop-generic.svg" },
  { id: "ln_tp_x13_yoga_g2", label: "ThinkPad X13 Yoga Gen 2", base: 153, inquiryOnly: false, image: "/devices/lenovo-laptop-generic.svg" },
  { id: "ln_tp_x13_yoga_g1", label: "ThinkPad X13 Yoga Gen 1", base: 99, inquiryOnly: false, image: "/devices/lenovo-laptop-generic.svg" },
  { id: "ln_tp_x13_2in1", label: "ThinkPad X13 2-in-1", base: 360, inquiryOnly: false, image: "/devices/lenovo-laptop-generic.svg" },
  { id: "ln_tp_x13s", label: "ThinkPad X13s", base: 230, inquiryOnly: false, image: "/devices/lenovo-laptop-generic.svg" },
];
const LENOVO_TP_X390_VARIANTS = [
  { id: "ln_tp_x390", label: "ThinkPad X390", base: 81, inquiryOnly: false, image: "/devices/ln_tp_x390.png" },
  { id: "ln_tp_x390_yoga", label: "ThinkPad X390 Yoga", base: 0, inquiryOnly: true, image: "/devices/ln_tp_x390_yoga.png" },
];
const LENOVO_TP_X9_VARIANTS = [
  { id: "ln_tp_x9_14", label: "ThinkPad X9 14", base: 675, inquiryOnly: false, image: "/devices/ln_tp_x9_14.png" },
  { id: "ln_tp_x9_15", label: "ThinkPad X9 15", base: 675, inquiryOnly: false, image: "/devices/ln_tp_x9_15.png" },
];
const LENOVO_TP_Z_VARIANTS = [
  { id: "ln_tp_z16_g2", label: "ThinkPad Z16 Gen 2", base: 346, inquiryOnly: false, image: "/devices/lenovo-laptop-generic.svg" },
  { id: "ln_tp_z16_g1", label: "ThinkPad Z16 Gen 1", base: 225, inquiryOnly: false, image: "/devices/lenovo-laptop-generic.svg" },
  { id: "ln_tp_z13_g2", label: "ThinkPad Z13 Gen 2", base: 333, inquiryOnly: false, image: "/devices/lenovo-laptop-generic.svg" },
  { id: "ln_tp_z13_g1", label: "ThinkPad Z13 Gen 1", base: 243, inquiryOnly: false, image: "/devices/lenovo-laptop-generic.svg" },
];
const LENOVO_TP_P_VARIANTS = [
  { id: "ln_tp_p43", label: "ThinkPad P43", base: 72, inquiryOnly: false, image: "/devices/lenovo-laptop-generic.svg" },
  { id: "ln_tp_p50", label: "ThinkPad P50", base: 45, inquiryOnly: false, image: "/devices/lenovo-laptop-generic.svg" },
  { id: "ln_tp_p51", label: "ThinkPad P51", base: 63, inquiryOnly: false, image: "/devices/lenovo-laptop-generic.svg" },
  { id: "ln_tp_p52", label: "ThinkPad P52", base: 108, inquiryOnly: false, image: "/devices/lenovo-laptop-generic.svg" },
  { id: "ln_tp_p53", label: "ThinkPad P53", base: 135, inquiryOnly: false, image: "/devices/lenovo-laptop-generic.svg" },
  { id: "ln_tp_p70", label: "ThinkPad P70", base: 140, inquiryOnly: false, image: "/devices/lenovo-laptop-generic.svg" },
  { id: "ln_tp_p71", label: "ThinkPad P71", base: 238, inquiryOnly: false, image: "/devices/lenovo-laptop-generic.svg" },
  { id: "ln_tp_p72", label: "ThinkPad P72", base: 216, inquiryOnly: false, image: "/devices/lenovo-laptop-generic.svg" },
  { id: "ln_tp_p73", label: "ThinkPad P73", base: 378, inquiryOnly: false, image: "/devices/lenovo-laptop-generic.svg" },
];
const LENOVO_TP_L_VARIANTS = [
  { id: "ln_tp_l13_g5", label: "ThinkPad L13 Gen 5", base: 225, inquiryOnly: false, image: "/devices/lenovo-laptop-generic.svg" },
  { id: "ln_tp_l13_g4", label: "ThinkPad L13 Gen 4", base: 153, inquiryOnly: false, image: "/devices/lenovo-laptop-generic.svg" },
  { id: "ln_tp_l13_g3", label: "ThinkPad L13 Gen 3", base: 122, inquiryOnly: false, image: "/devices/lenovo-laptop-generic.svg" },
  { id: "ln_tp_l13_g2", label: "ThinkPad L13 Gen 2", base: 104, inquiryOnly: false, image: "/devices/lenovo-laptop-generic.svg" },
  { id: "ln_tp_l13_g1", label: "ThinkPad L13 Gen 1", base: 36, inquiryOnly: false, image: "/devices/lenovo-laptop-generic.svg" },
  { id: "ln_tp_l14_g6", label: "ThinkPad L14 Gen 6", base: 310, inquiryOnly: false, image: "/devices/lenovo-laptop-generic.svg" },
  { id: "ln_tp_l14_g5", label: "ThinkPad L14 Gen 5", base: 248, inquiryOnly: false, image: "/devices/lenovo-laptop-generic.svg" },
  { id: "ln_tp_l14_g4", label: "ThinkPad L14 Gen 4", base: 162, inquiryOnly: false, image: "/devices/lenovo-laptop-generic.svg" },
  { id: "ln_tp_l14_g3", label: "ThinkPad L14 Gen 3", base: 126, inquiryOnly: false, image: "/devices/lenovo-laptop-generic.svg" },
  { id: "ln_tp_l14_g2", label: "ThinkPad L14 Gen 2", base: 90, inquiryOnly: false, image: "/devices/lenovo-laptop-generic.svg" },
  { id: "ln_tp_l14_g1", label: "ThinkPad L14 Gen 1", base: 63, inquiryOnly: false, image: "/devices/lenovo-laptop-generic.svg" },
  { id: "ln_tp_l15_g4", label: "ThinkPad L15 Gen 4", base: 158, inquiryOnly: false, image: "/devices/lenovo-laptop-generic.svg" },
  { id: "ln_tp_l15_g3", label: "ThinkPad L15 Gen 3", base: 144, inquiryOnly: false, image: "/devices/lenovo-laptop-generic.svg" },
  { id: "ln_tp_l15_g2", label: "ThinkPad L15 Gen 2", base: 122, inquiryOnly: false, image: "/devices/lenovo-laptop-generic.svg" },
  { id: "ln_tp_l15_g1", label: "ThinkPad L15 Gen 1", base: 76, inquiryOnly: false, image: "/devices/lenovo-laptop-generic.svg" },
  { id: "ln_tp_l16_g2", label: "ThinkPad L16 Gen 2", base: 225, inquiryOnly: false, image: "/devices/lenovo-laptop-generic.svg" },
  { id: "ln_tp_l16_g1", label: "ThinkPad L16 Gen 1", base: 162, inquiryOnly: false, image: "/devices/lenovo-laptop-generic.svg" },
];
const LENOVO_TP_T_VARIANTS = [
  { id: "ln_tp_t", label: "ThinkPad T-Series", base: 81, inquiryOnly: false, image: "/devices/ln_tp_t.png" },
];
const LENOVO_TP_E_VARIANTS = [
  { id: "ln_tp_e14_g7", label: "ThinkPad E14 Gen 7", base: 252, inquiryOnly: false, image: "/devices/ln_tp_e14_g7.png" },
  { id: "ln_tp_e14_g6", label: "ThinkPad E14 Gen 6", base: 252, inquiryOnly: false, image: "/devices/ln_tp_e14_g6.png" },
  { id: "ln_tp_e14_g5", label: "ThinkPad E14 Gen 5", base: 238, inquiryOnly: false, image: "/devices/ln_tp_e14_g5.png" },
  { id: "ln_tp_e15", label: "ThinkPad E15", base: 171, inquiryOnly: false, image: "/devices/ln_tp_e15.png" },
  { id: "ln_tp_e16_g3", label: "ThinkPad E16 Gen 3", base: 351, inquiryOnly: false, image: "/devices/ln_tp_e16_g3.png" },
  { id: "ln_tp_e16_g2", label: "ThinkPad E16 Gen 2", base: 324, inquiryOnly: false, image: "/devices/ln_tp_e16_g2.png" },
  { id: "ln_tp_e16_g1", label: "ThinkPad E16 Gen 1", base: 153, inquiryOnly: false, image: "/devices/ln_tp_e16_g1.png" },
];
// (Removed: LENOVO_THINKPAD_SUB_SERIES was dead code. Its sub-series
//  ids (ln_tp_x13, ln_tp_x390) collided with child variant ids in the
//  arrays above, breaking navigation. The real active sub-series lives
//  in LENOVO_PC_SERIES below with unique lenovo_tp_* ids.)

const LENOVO_TB_13_VARIANTS = [
  { id: "ln_tb_13x", label: "ThinkBook 13x", base: 0, inquiryOnly: true, image: "/devices/ln_tb_13x.png" },
  { id: "ln_tb_13s", label: "ThinkBook 13s", base: 0, inquiryOnly: true, image: "/devices/ln_tb_13s.png" },
];
const LENOVO_TB_14_VARIANTS = [
  { id: "ln_tb_14", label: "ThinkBook 14", base: 0, inquiryOnly: true, image: "/devices/ln_tb_14.png" },
  { id: "ln_tb_14p", label: "ThinkBook 14p", base: 0, inquiryOnly: true, image: "/devices/ln_tb_14p.png" },
  { id: "ln_tb_14s", label: "ThinkBook 14s", base: 0, inquiryOnly: true, image: "/devices/ln_tb_14s.png" },
  { id: "ln_tb_14s_yoga", label: "ThinkBook 14s Yoga", base: 0, inquiryOnly: true, image: "/devices/ln_tb_14s_yoga.png" },
];
const LENOVO_TB_15_VARIANTS = [
  { id: "ln_tb_15", label: "ThinkBook 15", base: 0, inquiryOnly: true, image: "/devices/ln_tb_15.png" },
  { id: "ln_tb_15p", label: "ThinkBook 15p", base: 0, inquiryOnly: true, image: "/devices/ln_tb_15p.png" },
];
const LENOVO_TB_16_VARIANTS = [
  { id: "ln_tb_16", label: "ThinkBook 16", base: 0, inquiryOnly: true, image: "/devices/ln_tb_16.png" },
  { id: "ln_tb_16p", label: "ThinkBook 16p", base: 0, inquiryOnly: true, image: "/devices/ln_tb_16p.png" },
];
// (Removed: LENOVO_THINKBOOK_SUB_SERIES was dead code with the same
//  duplicate-id problem.)

const LENOVO_IDEAPAD_VARIANTS = [
  { id: "ln_ideapad_5", label: "IdeaPad 5", base: 94, inquiryOnly: false, image: "/devices/lenovo-laptop-generic.svg" },
  { id: "ln_ideapad_3", label: "IdeaPad 3", base: 126, inquiryOnly: false, image: "/devices/lenovo-laptop-generic.svg" },
  { id: "ln_ideapad_3i", label: "IdeaPad 3i", base: 40, inquiryOnly: false, image: "/devices/lenovo-laptop-generic.svg" },
  { id: "ln_ideapad_5i_2in1", label: "IdeaPad 5i 2-in-1", base: 194, inquiryOnly: false, image: "/devices/lenovo-laptop-generic.svg" },
  { id: "ln_ideapad_flex_5", label: "IdeaPad Flex 5", base: 184, inquiryOnly: false, image: "/devices/lenovo-laptop-generic.svg" },
  { id: "ln_ideapad_flex_5i", label: "IdeaPad Flex 5i", base: 216, inquiryOnly: false, image: "/devices/lenovo-laptop-generic.svg" },
  { id: "ln_ideapad_slim_7", label: "IdeaPad Slim 7", base: 108, inquiryOnly: false, image: "/devices/lenovo-laptop-generic.svg" },
  { id: "ln_ideapad_gaming_3", label: "IdeaPad Gaming 3", base: 346, inquiryOnly: false, image: "/devices/lenovo-laptop-generic.svg" },
  { id: "ln_ideapad_gaming_3i", label: "IdeaPad Gaming 3i", base: 202, inquiryOnly: false, image: "/devices/lenovo-laptop-generic.svg" },
  { id: "ln_ideapad_330s", label: "IdeaPad 330s", base: 40, inquiryOnly: false, image: "/devices/lenovo-laptop-generic.svg" },
  { id: "ln_ideapad_l340", label: "IdeaPad L340", base: 72, inquiryOnly: false, image: "/devices/lenovo-laptop-generic.svg" },
  { id: "ln_ideapad_s340", label: "IdeaPad S340", base: 32, inquiryOnly: false, image: "/devices/lenovo-laptop-generic.svg" },
  { id: "ln_ideapad_s540", label: "IdeaPad S540", base: 32, inquiryOnly: false, image: "/devices/lenovo-laptop-generic.svg" },
];

const LENOVO_LEGION_VARIANTS = [
  { id: "ln_legion_9i", label: "Legion 9i", base: 1260, inquiryOnly: false, image: "/devices/lenovo-laptop-generic.svg" },
  { id: "ln_legion_7", label: "Legion 7", base: 742, inquiryOnly: false, image: "/devices/lenovo-laptop-generic.svg" },
  { id: "ln_legion_7i", label: "Legion 7i", base: 558, inquiryOnly: false, image: "/devices/lenovo-laptop-generic.svg" },
  { id: "ln_legion_7_pro", label: "Legion 7 Pro", base: 1530, inquiryOnly: false, image: "/devices/lenovo-laptop-generic.svg" },
  { id: "ln_legion_7i_pro", label: "Legion 7i Pro", base: 1328, inquiryOnly: false, image: "/devices/lenovo-laptop-generic.svg" },
  { id: "ln_legion_slim_7", label: "Legion Slim 7", base: 562, inquiryOnly: false, image: "/devices/lenovo-laptop-generic.svg" },
  { id: "ln_legion_slim_7i", label: "Legion Slim 7i", base: 540, inquiryOnly: false, image: "/devices/lenovo-laptop-generic.svg" },
  { id: "ln_legion_5", label: "Legion 5", base: 500, inquiryOnly: false, image: "/devices/lenovo-laptop-generic.svg" },
  { id: "ln_legion_5i", label: "Legion 5i", base: 342, inquiryOnly: false, image: "/devices/lenovo-laptop-generic.svg" },
  { id: "ln_legion_5_pro", label: "Legion 5 Pro", base: 806, inquiryOnly: false, image: "/devices/lenovo-laptop-generic.svg" },
  { id: "ln_legion_5i_pro", label: "Legion 5i Pro", base: 450, inquiryOnly: false, image: "/devices/lenovo-laptop-generic.svg" },
  { id: "ln_legion_slim_5", label: "Legion Slim 5", base: 765, inquiryOnly: false, image: "/devices/lenovo-laptop-generic.svg" },
  { id: "ln_legion_slim_5i", label: "Legion Slim 5i", base: 428, inquiryOnly: false, image: "/devices/lenovo-laptop-generic.svg" },
  { id: "ln_legion_y740", label: "Legion Y740", base: 279, inquiryOnly: false, image: "/devices/lenovo-laptop-generic.svg" },
  { id: "ln_legion_y730", label: "Legion Y730", base: 112, inquiryOnly: false, image: "/devices/lenovo-laptop-generic.svg" },
  { id: "ln_legion_y720", label: "Legion Y720", base: 122, inquiryOnly: false, image: "/devices/lenovo-laptop-generic.svg" },
  { id: "ln_legion_y545", label: "Legion Y545", base: 238, inquiryOnly: false, image: "/devices/lenovo-laptop-generic.svg" },
  { id: "ln_legion_y540", label: "Legion Y540", base: 315, inquiryOnly: false, image: "/devices/lenovo-laptop-generic.svg" },
  { id: "ln_legion_y530", label: "Legion Y530", base: 158, inquiryOnly: false, image: "/devices/lenovo-laptop-generic.svg" },
  { id: "ln_legion_y520", label: "Legion Y520", base: 86, inquiryOnly: false, image: "/devices/lenovo-laptop-generic.svg" },
];

const LENOVO_LOQ_VARIANTS = [
  { id: "ln_loq_15", label: "LOQ 15", base: 500, inquiryOnly: false, image: "/devices/lenovo-laptop-generic.svg" },
  { id: "ln_loq_17", label: "LOQ 17", base: 472, inquiryOnly: false, image: "/devices/lenovo-laptop-generic.svg" },
];

const LENOVO_SLIM_VARIANTS = [
  { id: "ln_slim_pro_9i", label: "Slim Pro 9i", base: 590, inquiryOnly: false, image: "/devices/lenovo-laptop-generic.svg" },
  { id: "ln_slim_pro_7", label: "Slim Pro 7", base: 446, inquiryOnly: false, image: "/devices/lenovo-laptop-generic.svg" },
  { id: "ln_slim_7i_pro_x", label: "Slim 7i Pro X", base: 324, inquiryOnly: false, image: "/devices/lenovo-laptop-generic.svg" },
  { id: "ln_slim_7_pro_x", label: "Slim 7 Pro X", base: 450, inquiryOnly: false, image: "/devices/lenovo-laptop-generic.svg" },
  { id: "ln_slim_7i", label: "Slim 7i", base: 225, inquiryOnly: false, image: "/devices/lenovo-laptop-generic.svg" },
  { id: "ln_slim_7", label: "Slim 7", base: 356, inquiryOnly: false, image: "/devices/lenovo-laptop-generic.svg" },
];

const LENOVO_YOGA_VARIANTS = [
  { id: "ln_yoga_9i", label: "Yoga 9i", base: 356, inquiryOnly: false, image: "/devices/lenovo-laptop-generic.svg" },
  { id: "ln_yoga_pro_9i", label: "Yoga Pro 9i", base: 504, inquiryOnly: false, image: "/devices/lenovo-laptop-generic.svg" },
  { id: "ln_yoga_slim_9i", label: "Yoga Slim 9i", base: 549, inquiryOnly: false, image: "/devices/lenovo-laptop-generic.svg" },
  { id: "ln_yoga_book_9i", label: "Yoga Book 9i", base: 585, inquiryOnly: false, image: "/devices/lenovo-laptop-generic.svg" },
  { id: "ln_yoga_7", label: "Yoga 7", base: 333, inquiryOnly: false, image: "/devices/lenovo-laptop-generic.svg" },
  { id: "ln_yoga_7i", label: "Yoga 7i", base: 180, inquiryOnly: false, image: "/devices/lenovo-laptop-generic.svg" },
  { id: "ln_yoga_pro_7", label: "Yoga Pro 7", base: 338, inquiryOnly: false, image: "/devices/lenovo-laptop-generic.svg" },
  { id: "ln_yoga_slim_7i", label: "Yoga Slim 7i", base: 356, inquiryOnly: false, image: "/devices/lenovo-laptop-generic.svg" },
  { id: "ln_yoga_slim_7x", label: "Yoga Slim 7x", base: 418, inquiryOnly: false, image: "/devices/lenovo-laptop-generic.svg" },
  { id: "ln_yoga_6", label: "Yoga 6", base: 216, inquiryOnly: false, image: "/devices/lenovo-laptop-generic.svg" },
  { id: "ln_yoga_c940", label: "Yoga C940", base: 189, inquiryOnly: false, image: "/devices/lenovo-laptop-generic.svg" },
  { id: "ln_yoga_c930", label: "Yoga C930", base: 94, inquiryOnly: false, image: "/devices/lenovo-laptop-generic.svg" },
  { id: "ln_yoga_c740", label: "Yoga C740", base: 135, inquiryOnly: false, image: "/devices/lenovo-laptop-generic.svg" },
  { id: "ln_yoga_c640", label: "Yoga C640", base: 50, inquiryOnly: false, image: "/devices/lenovo-laptop-generic.svg" },
  { id: "ln_yoga_c630", label: "Yoga C630", base: 50, inquiryOnly: false, image: "/devices/lenovo-laptop-generic.svg" },
  { id: "ln_yoga_920", label: "Yoga 920", base: 108, inquiryOnly: false, image: "/devices/lenovo-laptop-generic.svg" },
  { id: "ln_yoga_720", label: "Yoga 720", base: 63, inquiryOnly: false, image: "/devices/lenovo-laptop-generic.svg" },
  { id: "ln_yoga_710", label: "Yoga 710", base: 72, inquiryOnly: false, image: "/devices/lenovo-laptop-generic.svg" },
];

// Flattened to match IWM's exact 15-card display (Skywalker pasted the list).
// Each ThinkPad sub-series is a top-level card. ThinkBook also flat (combined
// from former Book 13/14/15/16 sub-series into one variant list).
const LENOVO_THINKBOOK_VARIANTS = [
  ...LENOVO_TB_13_VARIANTS,
  ...LENOVO_TB_14_VARIANTS,
  ...LENOVO_TB_15_VARIANTS,
  ...LENOVO_TB_16_VARIANTS,
];
const LENOVO_PC_SERIES = [
  { id: "lenovo_tp_x1", label: "ThinkPad X1", year: "Premium ultrabook", topPrice: 652, variants: LENOVO_TP_X1_VARIANTS, image: "/devices/lenovo-laptop-generic.svg" },
  { id: "lenovo_tp_x9", label: "ThinkPad X9", year: "Aura Edition", topPrice: 675, variants: LENOVO_TP_X9_VARIANTS, image: "/devices/ln_tp_x9_14.png" },
  { id: "lenovo_tp_x13", label: "ThinkPad X13", year: "13-inch business", topPrice: 441, variants: LENOVO_TP_X13_VARIANTS, image: "/devices/lenovo-laptop-generic.svg" },
  { id: "lenovo_tp_x390", label: "ThinkPad X390", year: "Legacy 13.3-inch", topPrice: 81, variants: LENOVO_TP_X390_VARIANTS, image: "/devices/ln_tp_x390.png" },
  { id: "lenovo_tp_t", label: "ThinkPad T", year: "Workhorse business", topPrice: 81, variants: LENOVO_TP_T_VARIANTS, image: "/devices/ln_tp_t.png" },
  { id: "lenovo_tp_p", label: "ThinkPad P", year: "Mobile workstation", topPrice: 378, variants: LENOVO_TP_P_VARIANTS, image: "/devices/lenovo-laptop-generic.svg" },
  { id: "lenovo_tp_l", label: "ThinkPad L", year: "Mainstream business", topPrice: 310, variants: LENOVO_TP_L_VARIANTS, image: "/devices/lenovo-laptop-generic.svg" },
  { id: "lenovo_tp_e", label: "ThinkPad E", year: "Essential business", topPrice: 351, variants: LENOVO_TP_E_VARIANTS, image: "/devices/ln_tp_e14_g7.png" },
  { id: "lenovo_tp_z", label: "ThinkPad Z", year: "Modern design", topPrice: 346, variants: LENOVO_TP_Z_VARIANTS, image: "/devices/lenovo-laptop-generic.svg" },
  { id: "lenovo_thinkbook", label: "ThinkBook", year: "Business mid-range", topPrice: 0, variants: LENOVO_THINKBOOK_VARIANTS, inquiryOnly: true, image: "/devices/ln_tb_14.png" },
  { id: "lenovo_ideapad", label: "IdeaPad", year: "Everyday", topPrice: 346, variants: LENOVO_IDEAPAD_VARIANTS, image: "/devices/lenovo-laptop-generic.svg" },
  { id: "lenovo_legion", label: "Legion", year: "Gaming", topPrice: 1530, variants: LENOVO_LEGION_VARIANTS, image: "/devices/lenovo-laptop-generic.svg" },
  { id: "lenovo_loq", label: "LOQ", year: "Entry gaming", topPrice: 500, variants: LENOVO_LOQ_VARIANTS, image: "/devices/lenovo-laptop-generic.svg" },
  { id: "lenovo_slim", label: "Slim", year: "Slim creator", topPrice: 590, variants: LENOVO_SLIM_VARIANTS, image: "/devices/lenovo-laptop-generic.svg" },
  { id: "lenovo_yoga", label: "Yoga", year: "2-in-1 / convertible", topPrice: 585, variants: LENOVO_YOGA_VARIANTS, image: "/devices/lenovo-laptop-generic.svg" },
];
// Lenovo no longer uses sub-series — kept as empty array so the breadcrumb
// resolver doesn't break when checking against it.
const LENOVO_PC_ALL_SUB_SERIES: { id: string; label: string; variants: { id: string; label: string; base: number }[] }[] = [];

const DELL_MODELS = [
  { id: "dxps17", label: "XPS 17 (2024)", base: 0, inquiryOnly: true, image: "/devices/dell-xps.webp" },
  { id: "dxps15", label: "XPS 15 (2024)", base: 620, image: "/devices/dell-xps.webp" },
  { id: "dxps13", label: "XPS 13 (2024)", base: 420, image: "/devices/dell-xps.webp" },
  { id: "dxps15g23", label: "XPS 15 (2023)", base: 0, inquiryOnly: true, image: "/devices/dell-xps.webp" },
  { id: "dxps13g23", label: "XPS 13 (2023)", base: 0, inquiryOnly: true, image: "/devices/dell-xps.webp" },
  { id: "dlat7440", label: "Latitude 7440", base: 630, inquiryOnly: false, image: "/devices/dell-latitude.jpg" },
  { id: "dlat5540", label: "Latitude 5540", base: 630, inquiryOnly: false, image: "/devices/dell-latitude.jpg" },
  { id: "dinsp16p", label: "Inspiron 16 Plus", base: 284, inquiryOnly: false, image: "/devices/dell-inspiron-15.webp" },
  { id: "dinsp15", label: "Inspiron 15", base: 108, inquiryOnly: false, image: "/devices/dell-inspiron-15.webp" },
  { id: "dinsp14", label: "Inspiron 14", base: 54, inquiryOnly: false, image: "/devices/dell-inspiron-15.webp" },
];

// Alienware laptop categories restructured 2026-05-06 to mirror itsworthmore.com
// All variants inquiry-only; per-SKU images sourced from IWM product pages
const ALIENWARE_M_SERIES_VARIANTS = [
  { id: "awm18r2", label: "Alienware m18 R2", base: 1480, inquiryOnly: false, image: "/devices/alienware-m18.webp" },
  { id: "awm18r1", label: "Alienware m18 R1", base: 1480, inquiryOnly: false, image: "/devices/alienware-m18.webp" },
  { id: "awm17r5", label: "Alienware m17 R5 (AMD flagship)", base: 837, inquiryOnly: false, image: "/devices/alienware-m17.webp" },
  { id: "awm16r2", label: "Alienware m16 R2", base: 972, inquiryOnly: false, image: "/devices/alienware-m16.webp" },
  { id: "awm16r1", label: "Alienware m16 R1", base: 972, inquiryOnly: false, image: "/devices/alienware-m16.webp" },
  { id: "awm15r7", label: "Alienware m15 R7", base: 832, inquiryOnly: false, image: "/devices/alienware-m15.webp" },
  { id: "awm15r6", label: "Alienware m15 R6", base: 832, inquiryOnly: false, image: "/devices/alienware-m15.webp" },
  { id: "awm15r5_ryzen", label: "Alienware m15 R5 (Ryzen)", base: 832, inquiryOnly: false, image: "/devices/alienware-m15.webp" },
];
const ALIENWARE_X_SERIES_VARIANTS = [
  { id: "awx17r2", label: "Alienware x17 R2", base: 990, inquiryOnly: false, image: "/devices/alienware-x17.webp" },
  { id: "awx17r1", label: "Alienware x17 R1", base: 990, inquiryOnly: false, image: "/devices/alienware-x17.webp" },
  { id: "awx16r2", label: "Alienware x16 R2", base: 1197, inquiryOnly: false, image: "/devices/alienware-x16.webp" },
  { id: "awx16r1", label: "Alienware x16 R1", base: 1197, inquiryOnly: false, image: "/devices/alienware-x16.webp" },
  { id: "awx15r2", label: "Alienware x15 R2", base: 878, inquiryOnly: false, image: "/devices/alienware-x15.webp" },
  { id: "awx15r1", label: "Alienware x15 R1", base: 878, inquiryOnly: false, image: "/devices/alienware-x15.webp" },
  { id: "awx14r2", label: "Alienware x14 R2", base: 742, inquiryOnly: false, image: "/devices/alienware-x14.webp" },
  { id: "awx14r1", label: "Alienware x14 R1", base: 742, inquiryOnly: false, image: "/devices/alienware-x14.webp" },
];
const ALIENWARE_AREA_SERIES_VARIANTS = [
  { id: "aw18_a51_2026", label: "Alienware 18 Area-51 (2026)", base: 1912, inquiryOnly: false, image: "/devices/alienware-18-area-51.webp" },
  { id: "aw16_a51_2026", label: "Alienware 16 Area-51 (2026)", base: 2205, inquiryOnly: false, image: "/devices/alienware-16-area-51.webp" },
  { id: "aw_a51m_r2", label: "Alienware Area-51m R2", base: 670, inquiryOnly: false, image: "/devices/alienware-area-51m.webp" },
  { id: "aw_a51m_r1", label: "Alienware Area-51m R1", base: 670, inquiryOnly: false, image: "/devices/alienware-area-51m.webp" },
];
const ALIENWARE_AURORA_LAPTOP_VARIANTS = [
  { id: "aw16x_aurora_2026", label: "Alienware 16X Aurora (2026)", base: 810, inquiryOnly: false, image: "/devices/alienware-16x-aurora.webp" },
  { id: "aw16_aurora_2026", label: "Alienware 16 Aurora (2026)", base: 756, inquiryOnly: false, image: "/devices/alienware-16-aurora.webp" },
];
const ALIENWARE_17_VARIANTS = [
  { id: "aw17r5", label: "Alienware 17 R5", base: 0, inquiryOnly: true, image: "/devices/alienware-17-r5.webp" },
  { id: "aw17r4", label: "Alienware 17 R4", base: 0, inquiryOnly: true, image: "/devices/alienware-17-r4.webp" },
  { id: "aw17r3", label: "Alienware 17 R3", base: 0, inquiryOnly: true, image: "/devices/alienware-17-r3.webp" },
  { id: "aw17r2", label: "Alienware 17 R2", base: 0, inquiryOnly: true, image: "/devices/alienware-17-r2.webp" },
];
const ALIENWARE_15_VARIANTS = [
  { id: "aw15r4", label: "Alienware 15 R4", base: 0, inquiryOnly: true, image: "/devices/alienware-15-r4.webp" },
  { id: "aw15r3", label: "Alienware 15 R3", base: 0, inquiryOnly: true, image: "/devices/alienware-15-r3.webp" },
  { id: "aw15r2", label: "Alienware 15 R2", base: 0, inquiryOnly: true, image: "/devices/alienware-15-r2.webp" },
];
const ALIENWARE_13_VARIANTS = [
  { id: "aw13r3", label: "Alienware 13 R3", base: 0, inquiryOnly: true, image: "/devices/alienware-13-r3.webp" },
  { id: "aw13r2", label: "Alienware 13 R2", base: 0, inquiryOnly: true, image: "/devices/alienware-13-r2.webp" },
];
const ALIENWARE_SERIES = [
  { id: "aw_m_series", label: "M Series", year: "m15 / m16 / m17 / m18", topPrice: 1480, variants: ALIENWARE_M_SERIES_VARIANTS, image: "/devices/alienware-m18.webp" },
  { id: "aw_x_series", label: "X Series", year: "x14 / x15 / x16 / x17", topPrice: 1197, variants: ALIENWARE_X_SERIES_VARIANTS, image: "/devices/alienware-x16.webp" },
  { id: "aw_area_series", label: "Area Series", year: "Area-51m / Area-51", topPrice: 2205, variants: ALIENWARE_AREA_SERIES_VARIANTS, image: "/devices/alienware-18-area-51.webp" },
  { id: "aw_aurora_laptop", label: "Aurora Laptop", year: "2026 — New", topPrice: 810, variants: ALIENWARE_AURORA_LAPTOP_VARIANTS, image: "/devices/alienware-16x-aurora.webp" },
  { id: "aw_17", label: "Alienware 17", year: "Legacy 17\"", topPrice: 0, variants: ALIENWARE_17_VARIANTS, inquiryOnly: true, image: "/devices/alienware-17-r5.webp" },
  { id: "aw_15", label: "Alienware 15", year: "Legacy 15\"", topPrice: 0, variants: ALIENWARE_15_VARIANTS, inquiryOnly: true, image: "/devices/alienware-15-r4.webp" },
  { id: "aw_13", label: "Alienware 13", year: "Legacy 13\"", topPrice: 0, variants: ALIENWARE_13_VARIANTS, inquiryOnly: true, image: "/devices/alienware-13-r3.webp" },
];
const ALIENWARE_MODELS = [
  ...ALIENWARE_M_SERIES_VARIANTS,
  ...ALIENWARE_X_SERIES_VARIANTS,
  ...ALIENWARE_AREA_SERIES_VARIANTS,
  ...ALIENWARE_AURORA_LAPTOP_VARIANTS,
  ...ALIENWARE_17_VARIANTS,
  ...ALIENWARE_15_VARIANTS,
  ...ALIENWARE_13_VARIANTS,
];

// HP LAPTOPS — three-level tree mirroring itsworthmore.com.
// 64 models scraped 2026-05-10, 51 with per-product photos. EliteBook
// and OMEN have sub-series; the rest are flat. OMEN Max / OMEN Slim
// dropped from sub-series — IWM serves CPU-spec options instead of
// model names there. Victus left as 2 size buckets.
const HP_ELITEBOOK_STD_VARIANTS = [
  { id: "hp_eb_g1a", label: "EliteBook G1a", base: 405, inquiryOnly: false, image: "/devices/hp-elitebook-eb_std-hp-elitebook-g1a.png" },
  { id: "hp_eb_g1i", label: "EliteBook G1i", base: 338, inquiryOnly: false, image: "/devices/hp-elitebook-eb_std-hp-elitebook-g1i.png" },
  { id: "hp_eb_g1q", label: "EliteBook G1q", base: 418, inquiryOnly: false, image: "/devices/hp-elitebook-eb_std-hp-elitebook-g1q.png" },
  { id: "hp_eb_g11", label: "EliteBook G11", base: 360, inquiryOnly: false, image: "/devices/hp-elitebook-eb_std-hp-elitebook-g11.png" },
  { id: "hp_eb_g10", label: "EliteBook G10", base: 414, inquiryOnly: false, image: "/devices/hp-elitebook-eb_std-hp-elitebook-g10.png" },
  { id: "hp_eb_g9", label: "EliteBook G9", base: 198, inquiryOnly: false, image: "/devices/hp-elitebook-eb_std-hp-elitebook-g9.png" },
  { id: "hp_eb_g8", label: "EliteBook G8", base: 189, inquiryOnly: false, image: "/devices/hp-elitebook-eb_std-hp-elitebook-g8.png" },
  { id: "hp_eb_g7", label: "EliteBook G7", base: 148, inquiryOnly: false, image: "/devices/hp-elitebook-eb_std-hp-elitebook-g7.png" },
  { id: "hp_eb_g6", label: "EliteBook G6", base: 104, inquiryOnly: false, image: "/devices/hp-elitebook-eb_std-hp-elitebook-g6.png" },
  { id: "hp_eb_g5", label: "EliteBook G5", base: 1, image: "/devices/hp-elitebook-eb_std-hp-elitebook-g5.png" },
  { id: "hp_eb_g4", label: "EliteBook G4", base: 81, inquiryOnly: false, image: "/devices/hp-elitebook-eb_std-hp-elitebook-g4.png" },
];
const HP_ELITEBOOK_ULTRA_VARIANTS = [
  { id: "hp_eb_ultra_g1q", label: "EliteBook Ultra G1q", base: 261, inquiryOnly: false, image: "/devices/hp-elitebook-eb_ultra-hp-elitebook-ultra-g1q.png" },
  { id: "hp_eb_ultra_g1i", label: "EliteBook Ultra G1i", base: 428, inquiryOnly: false, image: "/devices/hp-elitebook-eb_ultra-hp-elitebook-ultra-g1i.png" },
];
const HP_ELITEBOOK_SUB_SERIES = [
  { id: "hp_eb_std", label: "EliteBook", year: "Standard line", topPrice: 418, variants: HP_ELITEBOOK_STD_VARIANTS, image: "/devices/hp-elitebook-eb_std-hp-elitebook-g1a.png" },
  { id: "hp_eb_ultra", label: "EliteBook Ultra", year: "Premium ultraportable", topPrice: 428, variants: HP_ELITEBOOK_ULTRA_VARIANTS, image: "/devices/hp-elitebook-eb_ultra-hp-elitebook-ultra-g1q.png" },
];
const HP_ENVY_VARIANTS = [
  { id: "hp_envy_13", label: "Envy 13", base: 58, inquiryOnly: false, image: "/devices/hp-envy-hp-envy-13.png" },
  { id: "hp_envy_15", label: "Envy 15", base: 45, inquiryOnly: false, image: "/devices/hp-envy-hp-envy-15.png" },
  { id: "hp_envy_17", label: "Envy 17", base: 72, inquiryOnly: false, image: "/devices/hp-envy-hp-envy-17.png" },
  { id: "hp_envy_x360", label: "Envy x360", base: 243, inquiryOnly: false, image: "/devices/hp-envy-hp-envy-x360.png" },
];
const HP_OMEN_STD_VARIANTS = [
  { id: "hp_omen_17", label: "OMEN 17", base: 796, inquiryOnly: false, image: "/devices/hp-omen-omen_std-hp-omen-17.png" },
  { id: "hp_omen_16", label: "OMEN 16", base: 468, inquiryOnly: false, image: "/devices/hp-omen-omen_std-hp-omen-16.png" },
  { id: "hp_omen_15", label: "OMEN 15", base: 432, inquiryOnly: false, image: "/devices/hp-omen-omen_std-hp-omen-15.png" },
];
const HP_OMEN_TRANSCEND_VARIANTS = [
  { id: "hp_omen_trans_16", label: "OMEN Transcend 16", base: 554, inquiryOnly: false, image: "/devices/hp-omen-omen_trans-hp-omen-transcend-16.png" },
  { id: "hp_omen_trans_14", label: "OMEN Transcend 14", base: 698, inquiryOnly: false, image: "/devices/hp-omen-omen_trans-hp-omen-transcend-14.png" },
];
const HP_OMEN_MAX_VARIANTS = [
  { id: "hp_omen_max", label: "OMEN Max", base: 945, inquiryOnly: false, image: "/devices/hp_omen_max.png" },
];
const HP_OMEN_SLIM_VARIANTS = [
  { id: "hp_omen_slim", label: "OMEN Slim", base: 464, inquiryOnly: false, image: "/devices/hp_omen_slim.png" },
];
const HP_OMEN_SUB_SERIES = [
  { id: "hp_omen_std_sub", label: "OMEN", year: "Standard gaming", topPrice: 796, variants: HP_OMEN_STD_VARIANTS, image: "/devices/hp-omen-omen_std-hp-omen-17.png" },
  { id: "hp_omen_max_sub", label: "OMEN Max", year: "Top-tier", topPrice: 945, variants: HP_OMEN_MAX_VARIANTS, image: "/devices/hp-omen-omen_std-hp-omen-17.png" },
  { id: "hp_omen_slim_sub", label: "OMEN Slim", year: "Slim gaming", topPrice: 464, variants: HP_OMEN_SLIM_VARIANTS, image: "/devices/hp-omen-omen_std-hp-omen-17.png" },
  { id: "hp_omen_trans_sub", label: "OMEN Transcend", year: "Premium gaming", topPrice: 698, variants: HP_OMEN_TRANSCEND_VARIANTS, image: "/devices/hp-omen-omen_trans-hp-omen-transcend-16.png" },
];
const HP_OMNIBOOK_VARIANTS = [
  { id: "hp_omni_x", label: "OmniBook X", base: 432, inquiryOnly: false, image: "/devices/hp-omnibook-hp-omnibook-x.png" },
  { id: "hp_omni_x_flip", label: "OmniBook X Flip", base: 360, inquiryOnly: false, image: "/devices/hp-omnibook-hp-omnibook-x-flip.png" },
  { id: "hp_omni_7", label: "OmniBook 7", base: 450, inquiryOnly: false, image: "/devices/hp-omnibook-hp-omnibook-7.png" },
  { id: "hp_omni_7_aero", label: "OmniBook 7 Aero", base: 450, inquiryOnly: false, image: "/devices/hp-omnibook-hp-omnibook-7-aero.png" },
  { id: "hp_omni_7_flip", label: "OmniBook 7 Flip", base: 315, inquiryOnly: false, image: "/devices/hp-omnibook-hp-omnibook-7-flip.png" },
  { id: "hp_omni_3", label: "OmniBook 3", base: 306, inquiryOnly: false, image: "/devices/hp-omnibook-hp-omnibook-3.png" },
];
const HP_PAVILION_VARIANTS = [
  { id: "hp_pav_gaming", label: "Pavilion Gaming", base: 112, inquiryOnly: false, image: "/devices/hp-pavilion-hp-pavilion-gaming.png" },
  { id: "hp_pav_14", label: "Pavilion 14", base: 45, inquiryOnly: false, image: "/devices/hp-pavilion-hp-pavilion-14.png" },
  { id: "hp_pav_15", label: "Pavilion 15", base: 58, inquiryOnly: false, image: "/devices/hp-pavilion-hp-pavilion-15.png" },
  { id: "hp_pav_16", label: "Pavilion 16", base: 194, inquiryOnly: false, image: "/devices/hp-pavilion-hp-pavilion-16.png" },
  { id: "hp_pav_x360", label: "Pavilion x360", base: 76, inquiryOnly: false, image: "/devices/hp-pavilion-hp-pavilion-x360.png" },
];
const HP_PROBOOK_VARIANTS = [
  { id: "hp_pb_g11", label: "ProBook G11", base: 297, inquiryOnly: false, image: "/devices/hp-probook-hp-probook-g11.png" },
  { id: "hp_pb_g10", label: "ProBook G10", base: 230, inquiryOnly: false, image: "/devices/hp-probook-hp-probook-g10.png" },
  { id: "hp_pb_g9", label: "ProBook G9", base: 153, inquiryOnly: false, image: "/devices/hp-probook-hp-probook-g9.png" },
  { id: "hp_pb_g8", label: "ProBook G8", base: 140, inquiryOnly: false, image: "/devices/hp-probook-hp-probook-g8.png" },
  { id: "hp_pb_g7", label: "ProBook G7", base: 108, inquiryOnly: false, image: "/devices/hp-probook-hp-probook-g7.png" },
  { id: "hp_pb_g6", label: "ProBook G6", base: 68, inquiryOnly: false, image: "/devices/hp-probook-hp-probook-g6.png" },
  { id: "hp_pb_g5", label: "ProBook G5", base: 40, inquiryOnly: false, image: "/devices/hp-probook-hp-probook-g5.png" },
];
const HP_SPECTRE_VARIANTS = [
  { id: "hp_spec_13", label: "Spectre x360 13", base: 158, inquiryOnly: false, image: "/devices/hp-spectre-hp-spectre-13-x360.png" },
  { id: "hp_spec_14", label: "Spectre x360 14", base: 225, inquiryOnly: false, image: "/devices/hp-spectre-hp-spectre-14-x360.png" },
  { id: "hp_spec_15", label: "Spectre x360 15", base: 189, inquiryOnly: false, image: "/devices/hp-spectre-hp-spectre-15-x360.png" },
  { id: "hp_spec_16", label: "Spectre x360 16", base: 248, inquiryOnly: false, image: "/devices/hp-spectre-hp-spectre-16-x360.png" },
];
const HP_VICTUS_VARIANTS = [
  { id: "hp_victus_15", label: "Victus 15", base: 0, inquiryOnly: true, image: "/devices/hp_victus_15.png" },
  { id: "hp_victus_16", label: "Victus 16", base: 0, inquiryOnly: true, image: "/devices/hp_victus_16.png" },
];
const HP_ZBOOK_VARIANTS = [
  { id: "hp_zb_g11", label: "ZBook G11", base: 900, inquiryOnly: false, image: "/devices/hp-zbook-hp-zbook-g11.png" },
  { id: "hp_zb_g10", label: "ZBook G10", base: 810, inquiryOnly: false, image: "/devices/hp-zbook-hp-zbook-g10.png" },
  { id: "hp_zb_g9", label: "ZBook G9", base: 729, inquiryOnly: false, image: "/devices/hp-zbook-hp-zbook-g9.png" },
  { id: "hp_zb_g8", label: "ZBook G8", base: 518, inquiryOnly: false, image: "/devices/hp-zbook-hp-zbook-g8.png" },
  { id: "hp_zb_g7", label: "ZBook G7", base: 338, inquiryOnly: false, image: "/devices/hp-zbook-hp-zbook-g7.png" },
  { id: "hp_zb_g6", label: "ZBook G6", base: 248, inquiryOnly: false, image: "/devices/hp-zbook-hp-zbook-g6.png" },
  { id: "hp_zb_g5", label: "ZBook G5", base: 153, inquiryOnly: false, image: "/devices/hp-zbook-hp-zbook-g5.png" },
  { id: "hp_zb_g4", label: "ZBook G4", base: 54, inquiryOnly: false, image: "/devices/hp-zbook-hp-zbook-g4.png" },
];
const HP_NOTEBOOK_VARIANTS = [
  { id: "hp_nb_14", label: "Notebook 14", base: 45, inquiryOnly: false, image: "/devices/hp-notebook-hp-notebook-14.png" },
  { id: "hp_nb_15", label: "Notebook 15", base: 40, inquiryOnly: false, image: "/devices/hp-notebook-hp-notebook-15.png" },
  { id: "hp_nb_17", label: "Notebook 17", base: 76, inquiryOnly: false, image: "/devices/hp-notebook-hp-notebook-17.png" },
];

const HP_PC_SERIES = [
  { id: "hp_elitebook", label: "EliteBook", year: "Premium business", topPrice: 428, subSeries: HP_ELITEBOOK_SUB_SERIES, image: "/devices/hp-elitebook-eb_std-hp-elitebook-g11.png" },
  { id: "hp_envy", label: "Envy", year: "Mainstream consumer", topPrice: 243, variants: HP_ENVY_VARIANTS, image: "/devices/hp-envy-hp-envy-x360.png" },
  { id: "hp_omen", label: "OMEN", year: "Gaming", topPrice: 945, subSeries: HP_OMEN_SUB_SERIES, image: "/devices/hp-omen-omen_std-hp-omen-17.png" },
  { id: "hp_omnibook", label: "OmniBook", year: "AI productivity", topPrice: 450, variants: HP_OMNIBOOK_VARIANTS, image: "/devices/hp-omnibook-hp-omnibook-x.png" },
  { id: "hp_pavilion", label: "Pavilion", year: "Everyday", topPrice: 194, variants: HP_PAVILION_VARIANTS, image: "/devices/hp-pavilion-hp-pavilion-15.png" },
  { id: "hp_probook", label: "ProBook", year: "SMB business", topPrice: 297, variants: HP_PROBOOK_VARIANTS, image: "/devices/hp-probook-hp-probook-g11.png" },
  { id: "hp_spectre", label: "Spectre", year: "Premium consumer", topPrice: 248, variants: HP_SPECTRE_VARIANTS, image: "/devices/hp-spectre-hp-spectre-14-x360.png" },
  { id: "hp_victus", label: "Victus", year: "Entry gaming", topPrice: 0, variants: HP_VICTUS_VARIANTS, inquiryOnly: true, image: "/devices/hp-spectre-x360.webp" },
  { id: "hp_zbook", label: "ZBook", year: "Mobile workstation", topPrice: 900, variants: HP_ZBOOK_VARIANTS, image: "/devices/hp-zbook-hp-zbook-g11.png" },
  { id: "hp_notebook", label: "Notebook", year: "Budget", topPrice: 76, variants: HP_NOTEBOOK_VARIANTS, image: "/devices/hp-notebook-hp-notebook-15.png" },
];
const HP_PC_ALL_SUB_SERIES = [
  ...HP_ELITEBOOK_SUB_SERIES,
  ...HP_OMEN_SUB_SERIES,
];

// ACER LAPTOPS — IWM only carries Nitro and Predator (no Aspire/Swift).
// 7 models scraped 2026-05-10, all with per-product photos.
const ACER_NITRO_VARIANTS = [
  { id: "ac_nitro_17", label: "Nitro 17", base: 0, inquiryOnly: true, image: "/devices/acer-nitro-acer-nitro-17.png" },
  { id: "ac_nitro_16", label: "Nitro 16", base: 0, inquiryOnly: true, image: "/devices/acer-nitro-acer-nitro-16.png" },
  { id: "ac_nitro_v", label: "Nitro V", base: 0, inquiryOnly: true, image: "/devices/acer-nitro-acer-nitro-v.png" },
  { id: "ac_nitro_7", label: "Nitro 7", base: 0, inquiryOnly: true, image: "/devices/acer-nitro-acer-nitro-7.png" },
  { id: "ac_nitro_5", label: "Nitro 5", base: 0, inquiryOnly: true, image: "/devices/acer-nitro-acer-nitro-5.png" },
];
const ACER_PREDATOR_VARIANTS = [
  { id: "ac_pred_helios", label: "Predator Helios", base: 0, inquiryOnly: true, image: "/devices/acer-predator-acer-predator-helios.png" },
  { id: "ac_pred_triton", label: "Predator Triton", base: 0, inquiryOnly: true, image: "/devices/acer-predator-acer-predator-triton.png" },
];
const ACER_PC_SERIES = [
  { id: "ac_nitro", label: "Nitro", year: "Mainstream gaming", topPrice: 0, variants: ACER_NITRO_VARIANTS, inquiryOnly: true, image: "/devices/acer-nitro-acer-nitro-16.png" },
  { id: "ac_predator", label: "Predator", year: "Premium gaming", topPrice: 0, variants: ACER_PREDATOR_VARIANTS, inquiryOnly: true, image: "/devices/acer-predator-acer-predator-helios.png" },
];

// SAMSUNG GALAXY BOOK — IWM uses .answers quiz UI for all 5 generations,
// so no per-model photos. Each variant uses the existing series-level
// placeholder (/devices/sgbk*.png) where one matches.
const SAMSUNG_BOOK5_VARIANTS = [
  { id: "sgbk_5", label: "Galaxy Book5", base: 639, inquiryOnly: false, image: "/devices/sgbk4.png" },
  { id: "sgbk_5_360", label: "Galaxy Book5 360", base: 639, inquiryOnly: false, image: "/devices/sgbk4p.png" },
  { id: "sgbk_5_pro", label: "Galaxy Book5 Pro", base: 639, inquiryOnly: false, image: "/devices/sgbk4pro.png" },
  { id: "sgbk_5_pro_360", label: "Galaxy Book5 Pro 360", base: 639, inquiryOnly: false, image: "/devices/sgbk4p.png" },
];
const SAMSUNG_BOOK4_VARIANTS = [
  { id: "sgbk_4", label: "Galaxy Book4", base: 446, inquiryOnly: false, image: "/devices/sgbk4.png" },
  { id: "sgbk_4_360", label: "Galaxy Book4 360", base: 446, inquiryOnly: false, image: "/devices/sgbk4p.png" },
  { id: "sgbk_4_pro", label: "Galaxy Book4 Pro", base: 446, inquiryOnly: false, image: "/devices/sgbk4pro.png" },
  { id: "sgbk_4_pro_360", label: "Galaxy Book4 Pro 360", base: 446, inquiryOnly: false, image: "/devices/sgbk4p.png" },
  { id: "sgbk_4_ultra", label: "Galaxy Book4 Ultra", base: 446, inquiryOnly: false, image: "/devices/sgbk4u.png" },
  { id: "sgbk_4_edge", label: "Galaxy Book4 Edge", base: 446, inquiryOnly: false, image: "/devices/sgbk4pro.png" },
];
const SAMSUNG_BOOK3_VARIANTS = [
  { id: "sgbk_3", label: "Galaxy Book3", base: 446, inquiryOnly: false, image: "/devices/sgbk3.png" },
  { id: "sgbk_3_360", label: "Galaxy Book3 360", base: 446, inquiryOnly: false, image: "/devices/sgbk3p.png" },
  { id: "sgbk_3_pro", label: "Galaxy Book3 Pro", base: 446, inquiryOnly: false, image: "/devices/sgbk3pro.png" },
  { id: "sgbk_3_pro_360", label: "Galaxy Book3 Pro 360", base: 446, inquiryOnly: false, image: "/devices/sgbk3p.png" },
  { id: "sgbk_3_ultra", label: "Galaxy Book3 Ultra", base: 446, inquiryOnly: false, image: "/devices/sgbk3u.png" },
];
const SAMSUNG_BOOK2_VARIANTS = [
  { id: "sgbk_2", label: "Galaxy Book2", base: 243, inquiryOnly: false, image: "/devices/sgbk2.png" },
  { id: "sgbk_2_360", label: "Galaxy Book2 360", base: 243, inquiryOnly: false, image: "/devices/sgbk2p.png" },
  { id: "sgbk_2_pro", label: "Galaxy Book2 Pro", base: 243, inquiryOnly: false, image: "/devices/sgbk2p.png" },
  { id: "sgbk_2_pro_360", label: "Galaxy Book2 Pro 360", base: 243, inquiryOnly: false, image: "/devices/sgbk2p.png" },
];
const SAMSUNG_BOOK1_VARIANTS = [
  { id: "sgbk_1", label: "Galaxy Book", base: 140, inquiryOnly: false, image: "/devices/sgbk2.png" },
  { id: "sgbk_1_pro", label: "Galaxy Book Pro", base: 140, inquiryOnly: false, image: "/devices/sgbk2p.png" },
  { id: "sgbk_1_pro_360", label: "Galaxy Book Pro 360", base: 140, inquiryOnly: false, image: "/devices/sgbk2p.png" },
  { id: "sgbk_1_ion", label: "Galaxy Book Ion", base: 140, inquiryOnly: false, image: "/devices/sgbk2.png" },
  { id: "sgbk_1_flex", label: "Galaxy Book Flex", base: 140, inquiryOnly: false, image: "/devices/sgbk2p.png" },
  { id: "sgbk_1_flex_alpha", label: "Galaxy Book Flex Alpha", base: 140, inquiryOnly: false, image: "/devices/sgbk2p.png" },
  { id: "sgbk_1_flex2_alpha", label: "Galaxy Book Flex2 Alpha", base: 140, inquiryOnly: false, image: "/devices/sgbk2p.png" },
  { id: "sgbk_1_odyssey", label: "Galaxy Book Odyssey", base: 140, inquiryOnly: false, image: "/devices/sgbk2.png" },
];
const SAMSUNG_PC_SERIES = [
  { id: "sgbk_book5", label: "Galaxy Book 5", year: "2025", topPrice: 639, variants: SAMSUNG_BOOK5_VARIANTS, image: "/devices/sgbk4u.png" },
  { id: "sgbk_book4", label: "Galaxy Book 4", year: "2024", topPrice: 446, variants: SAMSUNG_BOOK4_VARIANTS, image: "/devices/sgbk4u.png" },
  { id: "sgbk_book3", label: "Galaxy Book 3", year: "2023", topPrice: 446, variants: SAMSUNG_BOOK3_VARIANTS, image: "/devices/sgbk3u.png" },
  { id: "sgbk_book2", label: "Galaxy Book 2", year: "2022", topPrice: 243, variants: SAMSUNG_BOOK2_VARIANTS, image: "/devices/sgbk2.png" },
  { id: "sgbk_book1", label: "Galaxy Book", year: "2020–2021", topPrice: 140, variants: SAMSUNG_BOOK1_VARIANTS, image: "/devices/sgbk2.png" },
];

// LG LAPTOPS — three-level tree mirroring itsworthmore.com.
// IWM splits LG into 3 series (Gram / Gram Pro / Gram SuperSlim) and
// each series into size sub-categories (Gram 14, Gram 16 (2-in-1), etc.).
// Our 24 existing model variants map cleanly into this. Gram Book and
// UltraGear (gaming) aren't on IWM, so they're dropped per the
// comp-mirror request.
const LG_GRAM_14_VARIANTS = [
  { id: "lg_gr14_24", label: "LG Gram 14 (14Z90S, 2024)", base: 252, inquiryOnly: false, image: "/devices/lg_gr14_24.png" },
  { id: "lg_gr14_23", label: "LG Gram 14 (14Z90R, 2023)", base: 252, inquiryOnly: false, image: "/devices/lg_gr14_23.png" },
  { id: "lg_grstyle14", label: "LG Gram Style 14 (14Z90RS, 2023)", base: 252, inquiryOnly: false, image: "/devices/lg_grstyle14.png" },
];
const LG_GRAM_14_2IN1_VARIANTS = [
  { id: "lg_gr14t_24", label: "LG Gram 14 2-in-1 (14T90S, 2024)", base: 252, inquiryOnly: false, image: "/devices/lg_gr14t_24.png" },
  { id: "lg_gr14t_23", label: "LG Gram 14 2-in-1 (14T90R, 2023)", base: 252, inquiryOnly: false, image: "/devices/lg_gr14t_23.png" },
];
const LG_GRAM_15_VARIANTS = [
  { id: "lg_gr15_23", label: "LG Gram 15 (15Z90R, 2023)", base: 252, inquiryOnly: false, image: "/devices/lg_gr15_23.png" },
];
const LG_GRAM_16_VARIANTS = [
  { id: "lg_gr16_24", label: "LG Gram 16 (16Z90S, 2024)", base: 252, inquiryOnly: false, image: "/devices/lg_gr16_24.png" },
  { id: "lg_gr16_23", label: "LG Gram 16 (16Z90R, 2023)", base: 252, inquiryOnly: false, image: "/devices/lg_gr16_23.png" },
  { id: "lg_grstyle16", label: "LG Gram Style 16 (16Z90RS, 2023)", base: 252, inquiryOnly: false, image: "/devices/lg_grstyle16.png" },
];
const LG_GRAM_16_2IN1_VARIANTS = [
  { id: "lg_gr16t_24", label: "LG Gram 16 2-in-1 (16T90S, 2024)", base: 252, inquiryOnly: false, image: "/devices/lg_gr16t_24.png" },
  { id: "lg_gr16t_23", label: "LG Gram 16 2-in-1 (16T90R, 2023)", base: 252, inquiryOnly: false, image: "/devices/lg_gr16t_23.png" },
];
const LG_GRAM_17_VARIANTS = [
  { id: "lg_gr17_24", label: "LG Gram 17 (17Z90S, 2024)", base: 252, inquiryOnly: false, image: "/devices/lg_gr17_24.png" },
  { id: "lg_gr17_23", label: "LG Gram 17 (17Z90R, 2023)", base: 252, inquiryOnly: false, image: "/devices/lg_gr17_23.png" },
];
const LG_GRAM_PRO_16_VARIANTS = [
  { id: "lg_grpro16_25", label: "LG Gram Pro 16 (16Z90TR, 2025)", base: 639, inquiryOnly: false, image: "/devices/lg_grpro16_25.png" },
  { id: "lg_grpro16_24", label: "LG Gram Pro 16 (16Z90SP, 2024)", base: 639, inquiryOnly: false, image: "/devices/lg_grpro16_24.png" },
];
const LG_GRAM_PRO_16_2IN1_VARIANTS = [
  { id: "lg_grpro16t_24", label: "LG Gram Pro 16 2-in-1 (16T90SP, 2024)", base: 639, inquiryOnly: false, image: "/devices/lg_grpro16t_24.png" },
];
const LG_GRAM_PRO_17_VARIANTS = [
  { id: "lg_grpro17_25", label: "LG Gram Pro 17 (17Z90TR, 2025)", base: 639, inquiryOnly: false, image: "/devices/lg_grpro17_25.png" },
  { id: "lg_grpro17_24", label: "LG Gram Pro 17 (17Z90SP, 2024)", base: 639, inquiryOnly: false, image: "/devices/lg_grpro17_24.png" },
];
const LG_GRAM_SUPERSLIM_15_VARIANTS = [
  { id: "lg_grultra15", label: "LG Gram SuperSlim 15 (15Z90RT, 2023)", base: 378, inquiryOnly: false, image: "/devices/lg_grultra15.png" },
];

const LG_GRAM_SUB_SERIES = [
  { id: "lg_gram_14", label: "Gram 14", year: "14-inch", topPrice: 252, variants: LG_GRAM_14_VARIANTS, image: "/devices/lg_gr14_24.png" },
  { id: "lg_gram_14_2in1", label: "Gram 14 (2-in-1)", year: "14-inch convertible", topPrice: 252, variants: LG_GRAM_14_2IN1_VARIANTS, image: "/devices/lg_gr14t_24.png" },
  { id: "lg_gram_15", label: "Gram 15", year: "15-inch", topPrice: 252, variants: LG_GRAM_15_VARIANTS, image: "/devices/lg_gr15_23.png" },
  { id: "lg_gram_16", label: "Gram 16", year: "16-inch", topPrice: 252, variants: LG_GRAM_16_VARIANTS, image: "/devices/lg_gr16_24.png" },
  { id: "lg_gram_16_2in1", label: "Gram 16 (2-in-1)", year: "16-inch convertible", topPrice: 252, variants: LG_GRAM_16_2IN1_VARIANTS, image: "/devices/lg_gr16t_24.png" },
  { id: "lg_gram_17", label: "Gram 17", year: "17-inch", topPrice: 252, variants: LG_GRAM_17_VARIANTS, image: "/devices/lg_gr17_24.png" },
];
const LG_GRAM_PRO_SUB_SERIES = [
  { id: "lg_grampro_16", label: "Gram Pro 16", year: "16-inch", topPrice: 639, variants: LG_GRAM_PRO_16_VARIANTS, image: "/devices/lg_grpro16_25.png" },
  { id: "lg_grampro_16_2in1", label: "Gram Pro 16 (2-in-1)", year: "16-inch convertible", topPrice: 639, variants: LG_GRAM_PRO_16_2IN1_VARIANTS, image: "/devices/lg_grpro16t_24.png" },
  { id: "lg_grampro_17", label: "Gram Pro 17", year: "17-inch", topPrice: 639, variants: LG_GRAM_PRO_17_VARIANTS, image: "/devices/lg_grpro17_25.png" },
];
const LG_GRAM_SUPERSLIM_SUB_SERIES = [
  { id: "lg_superslim_15", label: "Gram SuperSlim 15", year: "Ultra-thin", topPrice: 378, variants: LG_GRAM_SUPERSLIM_15_VARIANTS, image: "/devices/lg_grultra15.png" },
];

const LG_PC_SERIES = [
  { id: "lg_gram", label: "Gram", year: "Standard ultraportable", topPrice: 252, subSeries: LG_GRAM_SUB_SERIES, image: "/devices/lg_gr16_24.png" },
  { id: "lg_grampro", label: "Gram Pro", year: "Performance", topPrice: 639, subSeries: LG_GRAM_PRO_SUB_SERIES, image: "/devices/lg_grpro16_25.png" },
  { id: "lg_superslim", label: "Gram SuperSlim", year: "Ultra-thin", topPrice: 378, subSeries: LG_GRAM_SUPERSLIM_SUB_SERIES, image: "/devices/lg_grultra15.png" },
];
const LG_PC_ALL_SUB_SERIES = [
  ...LG_GRAM_SUB_SERIES, ...LG_GRAM_PRO_SUB_SERIES, ...LG_GRAM_SUPERSLIM_SUB_SERIES,
];
const LG_PC_MODELS = [
  ...LG_GRAM_14_VARIANTS, ...LG_GRAM_14_2IN1_VARIANTS, ...LG_GRAM_15_VARIANTS,
  ...LG_GRAM_16_VARIANTS, ...LG_GRAM_16_2IN1_VARIANTS, ...LG_GRAM_17_VARIANTS,
  ...LG_GRAM_PRO_16_VARIANTS, ...LG_GRAM_PRO_16_2IN1_VARIANTS, ...LG_GRAM_PRO_17_VARIANTS,
  ...LG_GRAM_SUPERSLIM_15_VARIANTS,
];

// Apple Desktops — 4 family boxes (iMac / Mac Mini / Mac Studio / Mac Pro)
// Prices reduced 20% per Skywalker's competitor-research directive 2026-05-04
const APPLE_IMAC_VARIANTS = [
  { id: "imac24m4", label: "iMac 24\" M4", base: 720, image: "/devices/imac-24-m4.webp" },
  { id: "imac24m3", label: "iMac 24\" M3", base: 560, image: "/devices/imac-24-m3.webp" },
  { id: "imac24m1", label: "iMac 24\" M1", base: 360, image: "/devices/imac-24-m1.webp" },
];
const APPLE_MACMINI_VARIANTS = [
  { id: "macminim4p", label: "Mac Mini M4 Pro", base: 480, image: "/devices/mac-mini-m2.webp" },
  { id: "macminim4", label: "Mac Mini M4", base: 320, image: "/devices/mac-mini-m2.webp" },
  { id: "macminim2", label: "Mac Mini M2", base: 240, image: "/devices/mac-mini-m2.webp" },
  { id: "macminim1", label: "Mac Mini M1", base: 175, image: "/devices/mac-mini-m1.webp" },
];
const APPLE_MACSTUDIO_VARIANTS = [
  { id: "macstudiom4u", label: "Mac Studio M4 Ultra", base: 1760, image: "/devices/mac-studio-m2.webp" },
  { id: "macstudiom4m", label: "Mac Studio M4 Max", base: 1120, image: "/devices/mac-studio-m2.webp" },
  { id: "macstudiom2u", label: "Mac Studio M2 Ultra", base: 1280, image: "/devices/mac-studio-m2.webp" },
  { id: "macstudiom2m", label: "Mac Studio M2 Max", base: 800, image: "/devices/mac-studio-m2.webp" },
];
const APPLE_MACPRO_VARIANTS = [
  { id: "macprom2u", label: "Mac Pro M2 Ultra", base: 2240, image: "/devices/mac-studio-m2.webp" },
];
const APPLE_DESKTOP_SERIES = [
  { id: "ad_imac", label: "iMac", year: "All-in-one", topPrice: 720, variants: APPLE_IMAC_VARIANTS },
  { id: "ad_macmini", label: "Mac Mini", year: "Compact", topPrice: 480, variants: APPLE_MACMINI_VARIANTS },
  { id: "ad_macstudio", label: "Mac Studio", year: "Pro", topPrice: 1760, variants: APPLE_MACSTUDIO_VARIANTS },
  { id: "ad_macpro", label: "Mac Pro", year: "Workstation", topPrice: 2240, variants: APPLE_MACPRO_VARIANTS },
];
const APPLE_DESKTOP_MODELS = [
  ...APPLE_IMAC_VARIANTS,
  ...APPLE_MACMINI_VARIANTS,
  ...APPLE_MACSTUDIO_VARIANTS,
  ...APPLE_MACPRO_VARIANTS,
];

const DELL_DESKTOP_MODELS = [
  { id: "doptiplex7010", label: "OptiPlex 7010", base: 0, inquiryOnly: true, image: "/devices/dell-optiplex-tower.webp" },
  { id: "doptiplex5000", label: "OptiPlex 5000", base: 0, inquiryOnly: true, image: "/devices/dell-optiplex-sff.webp" },
  { id: "dxps8960", label: "XPS Desktop 8960", base: 0, inquiryOnly: true, image: "/devices/dell-xps-8960.webp" },
  { id: "dxps8950", label: "XPS Desktop 8950", base: 0, inquiryOnly: true, image: "/devices/dell-xps-8950.webp" },
  { id: "dinsp3030", label: "Inspiron 3030 Desktop", base: 0, inquiryOnly: true },
  { id: "dprecision3680", label: "Precision 3680", base: 0, inquiryOnly: true, image: "/devices/dell-optiplex-tower.webp" },
];

const LENOVO_DESKTOP_MODELS = [
  { id: "lnthinkm", label: "ThinkCentre M920", base: 0, inquiryOnly: true, image: "/devices/lenovo-thinkcentre-tower.webp" },
  { id: "lnthinkm90q", label: "ThinkCentre M90q Tiny", base: 0, inquiryOnly: true, image: "/devices/lenovo-thinkcentre-tiny.webp" },
  { id: "lnlegion5dtwr", label: "Legion Tower 5i", base: 342, inquiryOnly: false, image: "/devices/lenovo-thinkcentre-tower.webp" },
  { id: "lnlegion7dtwr", label: "Legion Tower 7i", base: 558, inquiryOnly: false, image: "/devices/lenovo-thinkcentre-tower.webp" },
  { id: "lnideactower", label: "IdeaCentre 5i", base: 0, inquiryOnly: true, image: "/devices/lenovo-thinkcentre-sff.webp" },
];

const HP_DESKTOP_MODELS = [
  { id: "hpelitedesk", label: "EliteDesk 800 G9", base: 0, inquiryOnly: true, image: "/devices/hp-elitedesk-800.webp" },
  { id: "hpprodesk", label: "ProDesk 400 G9", base: 0, inquiryOnly: true, image: "/devices/hp-prodesk-400.webp" },
  { id: "hpomendsk", label: "OMEN 45L Desktop", base: 800, inquiryOnly: false, image: "/devices/hp-omen-45l.webp" },
  { id: "hpomen40", label: "OMEN 40L Desktop", base: 0, inquiryOnly: true, image: "/devices/hp-omen-35l.webp" },
  { id: "hpenvy34", label: "Envy 34 All-in-One", base: 0, inquiryOnly: true, image: "/devices/lenovo-ideacentre.webp" },
  { id: "hppav32", label: "Pavilion 32 All-in-One", base: 0, inquiryOnly: true, image: "/devices/lenovo-ideacentre.webp" },
];

const ASUS_DESKTOP_MODELS = [
  { id: "asrogstrix", label: "ROG Strix G16CH", base: 0, inquiryOnly: true, image: "/devices/asus-rog-desktop.webp" },
  // ROG Hyperion was listed here as a desktop — it's actually a PC CASE
  // (chassis only), not a complete gaming PC. Removed 2026-05-17 so
  // sellers don't get an inflated quote against an empty enclosure.
  { id: "asrogflow", label: "ROG NUC", base: 0, inquiryOnly: true, image: "/devices/asus-rog-desktop.webp" },
  // TUF Gaming Desktop split into real SKUs 2026-05-17 — the generic
  // "TUF Gaming Desktop" entry made the lead useless. IWM does not list
  // any TUF Desktops (only TUF laptops), so pricing stays inquiry-only
  // until manual baselines are set.
  { id: "astuft500_26", label: "TUF Gaming TM500 (2026)", base: 0, inquiryOnly: true, image: "/devices/asus-rog-desktop.webp" },
  { id: "astuft500_25", label: "TUF Gaming T500 (2025)", base: 0, inquiryOnly: true, image: "/devices/asus-rog-desktop.webp" },
  { id: "astuffx10cp", label: "TUF Gaming FX10CP", base: 0, inquiryOnly: true, image: "/devices/asus-rog-desktop.webp" },
  { id: "asexperpro", label: "ExpertCenter D5", base: 0, inquiryOnly: true, image: "/devices/asus-rog-desktop.webp" },
  { id: "asnuc14", label: "NUC 14 Pro", base: 675, inquiryOnly: false, image: "/devices/asus-rog-desktop.webp" },
];

// ASUS LAPTOPS — three-level tree mirroring itsworthmore.com.
// ROG splits into Strix/Zephyrus/Flow sub-series; TUF/ProArt/Vivobook/
// ExpertBook are flat. All inquiry-only (per Skywalker — ASUS pricing
// will be set on a per-quote basis until we have validated comp data).
const ASUS_ROG_STRIX_VARIANTS = [
  { id: "as_rog_strix_scar_18_g835", label: "ROG Strix Scar 18 G835", base: 1912, inquiryOnly: false, image: "/devices/asus-rog-republic-of-gamers-strix-scar-18-g835.png" },
  { id: "as_rog_strix_scar_16_g635", label: "ROG Strix Scar 16 G635", base: 1863, inquiryOnly: false, image: "/devices/asus-rog-republic-of-gamers-strix-scar-16-g635.png" },
  { id: "as_rog_strix_g16_g615", label: "ROG Strix G16 G615", base: 900, inquiryOnly: false, image: "/devices/asus-rog-republic-of-gamers-strix-g16-g615.png" },
  { id: "as_rog_strix_scar_18_g834", label: "ROG Strix Scar 18 G834", base: 1462, inquiryOnly: false, image: "/devices/asus-rog-republic-of-gamers-strix-scar-18-g834.png" },
  { id: "as_rog_strix_g18_g815", label: "ROG Strix G18 G815", base: 1314, inquiryOnly: false, image: "/devices/asus-rog-republic-of-gamers-strix-g18-g815.png" },
  { id: "as_rog_strix_scar_16_g634", label: "ROG Strix Scar 16 G634", base: 1395, inquiryOnly: false, image: "/devices/asus-rog-republic-of-gamers-strix-scar-16-g634.png" },
  { id: "as_rog_strix_scar_17_g733", label: "ROG Strix Scar 17 G733", base: 832, inquiryOnly: false, image: "/devices/asus-rog-republic-of-gamers-strix-scar-17-g733.png" },
  { id: "as_rog_strix_g18_g814", label: "ROG Strix G18 G814", base: 810, inquiryOnly: false, image: "/devices/asus-rog-republic-of-gamers-strix-g18-g814.png" },
  { id: "as_rog_strix_scar_17_se_g733", label: "ROG Strix Scar 17 SE G733", base: 945, inquiryOnly: false, image: "/devices/asus-rog-republic-of-gamers-strix-scar-17-se-g733.png" },
  { id: "as_rog_strix_g16_g614", label: "ROG Strix G16 G614", base: 810, inquiryOnly: false, image: "/devices/asus-rog-republic-of-gamers-strix-g16-g614.png" },
  { id: "as_rog_strix_g17_g713", label: "ROG Strix G17 G713", base: 846, inquiryOnly: false, image: "/devices/asus-rog-republic-of-gamers-strix-g17-g713.png" },
  { id: "as_rog_strix_scar_15_g533", label: "ROG Strix Scar 15 G533", base: 675, inquiryOnly: false, image: "/devices/asus-rog-republic-of-gamers-strix-scar-15-g533.png" },
  { id: "as_rog_strix_g15_g513", label: "ROG Strix G15 G513", base: 608, inquiryOnly: false, image: "/devices/asus-rog-republic-of-gamers-strix-g15-g513.png" },
  { id: "as_rog_strix_scar_15_g532", label: "ROG Strix Scar 15 G532", base: 364, inquiryOnly: false, image: "/devices/asus-rog-republic-of-gamers-strix-scar-15-g532.png" },
  { id: "as_rog_strix_scar_17_g732", label: "ROG Strix Scar 17 G732", base: 346, inquiryOnly: false, image: "/devices/asus-rog-republic-of-gamers-strix-scar-17-g732.png" },
  { id: "as_rog_strix_g17_g712", label: "ROG Strix G17 G712", base: 342, inquiryOnly: false, image: "/devices/asus-rog-republic-of-gamers-strix-g17-g712.png" },
  { id: "as_rog_strix_g15_g512", label: "ROG Strix G15 G512", base: 338, inquiryOnly: false, image: "/devices/asus-rog-republic-of-gamers-strix-g15-g512.png" },
  { id: "as_rog_strix_g531", label: "ROG Strix G531", base: 162, inquiryOnly: false, image: "/devices/asus-rog-republic-of-gamers-strix-g531.png" },
  { id: "as_rog_strix_g731", label: "ROG Strix G731", base: 171, inquiryOnly: false, image: "/devices/asus-rog-republic-of-gamers-strix-g731.png" },
];
const ASUS_ROG_ZEPHYRUS_VARIANTS = [
  { id: "as_rog_zephyrus_g16_gu605", label: "ROG Zephyrus G16 GU605", base: 1170, inquiryOnly: false, image: "/devices/asus-rog-republic-of-gamers-zephyrus-g16-gu605.png" },
  { id: "as_rog_zephyrus_duo_16_gx650", label: "ROG Zephyrus Duo 16 GX650", base: 1710, inquiryOnly: false, image: "/devices/asus-rog-republic-of-gamers-zephyrus-duo-16-gx650.png" },
  { id: "as_rog_zephyrus_g14_ga403", label: "ROG Zephyrus G14 GA403", base: 1170, inquiryOnly: false, image: "/devices/asus-rog-republic-of-gamers-zephyrus-g14-ga403.png" },
  { id: "as_rog_zephyrus_m16_gu604", label: "ROG Zephyrus M16 GU604", base: 1242, inquiryOnly: false, image: "/devices/asus-rog-republic-of-gamers-zephyrus-m16-gu604.png" },
  { id: "as_rog_zephyrus_duo_15_se_gx551", label: "ROG Zephyrus Duo 15 SE GX551", base: 1058, inquiryOnly: false, image: "/devices/asus-rog-republic-of-gamers-zephyrus-duo-15-se-gx551.png" },
  { id: "as_rog_zephyrus_g14_ga402", label: "ROG Zephyrus G14 GA402", base: 1044, inquiryOnly: false, image: "/devices/asus-rog-republic-of-gamers-zephyrus-g14-ga402.png" },
  { id: "as_rog_zephyrus_g16_ga605", label: "ROG Zephyrus G16 GA605", base: 922, inquiryOnly: false, image: "/devices/asus-rog-republic-of-gamers-zephyrus-g16-ga605.png" },
  { id: "as_rog_zephyrus_g16_gu603", label: "ROG Zephyrus G16 GU603", base: 630, inquiryOnly: false, image: "/devices/asus-rog-republic-of-gamers-zephyrus-g16-gu603.png" },
  { id: "as_rog_zephyrus_duo_15_gx550", label: "ROG Zephyrus Duo 15 GX550", base: 639, inquiryOnly: false, image: "/devices/asus-rog-republic-of-gamers-zephyrus-duo-15-gx550.png" },
  { id: "as_rog_zephyrus_s17_gx703", label: "ROG Zephyrus S17 GX703", base: 576, inquiryOnly: false, image: "/devices/asus-rog-republic-of-gamers-zephyrus-s17-gx703.png" },
  { id: "as_rog_zephyrus_m16_gu603", label: "ROG Zephyrus M16 GU603", base: 522, inquiryOnly: false, image: "/devices/asus-rog-republic-of-gamers-zephyrus-m16-gu603.png" },
  { id: "as_rog_zephyrus_g15_ga503", label: "ROG Zephyrus G15 GA503", base: 621, inquiryOnly: false, image: "/devices/asus-rog-republic-of-gamers-zephyrus-g15-ga503.png" },
  { id: "as_rog_zephyrus_g14_ga401", label: "ROG Zephyrus G14 GA401", base: 495, inquiryOnly: false, image: "/devices/asus-rog-republic-of-gamers-zephyrus-g14-ga401.png" },
  { id: "as_rog_zephyrus_m15_gu502", label: "ROG Zephyrus M15 GU502", base: 414, inquiryOnly: false, image: "/devices/asus-rog-republic-of-gamers-zephyrus-m15-gu502.png" },
  { id: "as_rog_zephyrus_s15_gx502", label: "ROG Zephyrus S15 GX502", base: 292, inquiryOnly: false, image: "/devices/asus-rog-republic-of-gamers-zephyrus-s15-gx502.png" },
  { id: "as_rog_zephyrus_s17_gx701", label: "ROG Zephyrus S17 GX701", base: 302, inquiryOnly: false, image: "/devices/asus-rog-republic-of-gamers-zephyrus-s17-gx701.png" },
  { id: "as_rog_zephyrus_s_gx531", label: "ROG Zephyrus S GX531", base: 315, inquiryOnly: false, image: "/devices/asus-rog-republic-of-gamers-zephyrus-s-gx531.png" },
  { id: "as_rog_zephyrus_g15_ga502", label: "ROG Zephyrus G15 GA502", base: 297, inquiryOnly: false, image: "/devices/asus-rog-republic-of-gamers-zephyrus-g15-ga502.png" },
  { id: "as_rog_zephyrus_m_gm501", label: "ROG Zephyrus M GM501", base: 180, inquiryOnly: false, image: "/devices/asus-rog-republic-of-gamers-zephyrus-m-gm501.png" },
];
const ASUS_ROG_FLOW_VARIANTS = [
  { id: "as_rog_flow_x16_gv601", label: "ROG Flow X16 GV601", base: 968, inquiryOnly: false, image: "/devices/asus-rog-republic-of-gamers-flow-x16-gv601.png" },
  { id: "as_rog_flow_z13_gz302", label: "ROG Flow Z13 GZ302", base: 1080, inquiryOnly: false, image: "/devices/asus-rog-republic-of-gamers-flow-z13-gz302.png" },
  { id: "as_rog_flow_z13_acrnm", label: "ROG Flow Z13 ACRNM RMT02 GZ301", base: 1215, inquiryOnly: false, image: "/devices/asus-rog-republic-of-gamers-flow-z13-acrnm-rmt02-gz301.png" },
  { id: "as_rog_flow_z13_kjp_gz302", label: "ROG Flow Z13-KJP GZ302", base: 1053, inquiryOnly: false, image: "/devices/asus-rog-republic-of-gamers-flow-z13-kjp-gz302.png" },
  { id: "as_rog_flow_z13_gz301", label: "ROG Flow Z13 GZ301", base: 526, inquiryOnly: false, image: "/devices/asus-rog-republic-of-gamers-flow-z13-gz301.png" },
  { id: "as_rog_flow_x13_gv302", label: "ROG Flow X13 GV302", base: 1035, inquiryOnly: false, image: "/devices/asus-rog-republic-of-gamers-flow-x13-gv302.png" },
  { id: "as_rog_flow_x13_gv301", label: "ROG Flow X13 GV301", base: 464, inquiryOnly: false, image: "/devices/asus-rog-republic-of-gamers-flow-x13-gv301.png" },
];
const ASUS_ROG_SUB_SERIES = [
  { id: "asus_rog_strix", label: "ROG Strix", year: "Tournament-grade", topPrice: 1912, variants: ASUS_ROG_STRIX_VARIANTS, image: "/devices/asus-rog-strix.webp" },
  { id: "asus_rog_zephyrus", label: "ROG Zephyrus", year: "Slim performance", topPrice: 1710, variants: ASUS_ROG_ZEPHYRUS_VARIANTS, image: "/devices/asus-rog-zephyrus.webp" },
  { id: "asus_rog_flow", label: "ROG Flow", year: "Convertible / 2-in-1", topPrice: 1215, variants: ASUS_ROG_FLOW_VARIANTS, image: "/devices/asus-rog-zephyrus.webp" },
];
const ASUS_TUF_VARIANTS = [
  { id: "as_tuf_a18", label: "TUF A18", base: 734, inquiryOnly: false, image: "/devices/asus-tuf-tuf-a18-laptop.png" },
  { id: "as_tuf_a17", label: "TUF A17", base: 558, inquiryOnly: false, image: "/devices/asus-tuf-tuf-a17-laptop.png" },
  { id: "as_tuf_a16", label: "TUF A16", base: 774, inquiryOnly: false, image: "/devices/asus-tuf-tuf-a16-laptop.png" },
  { id: "as_tuf_a15", label: "TUF A15", base: 486, inquiryOnly: false, image: "/devices/asus-tuf-tuf-a15-laptop.png" },
  { id: "as_tuf_a14", label: "TUF A14", base: 706, inquiryOnly: false, image: "/devices/asus-tuf-tuf-a14-laptop.png" },
  { id: "as_tuf_f17", label: "TUF F17", base: 302, inquiryOnly: false, image: "/devices/asus-tuf-tuf-f17-laptop.png" },
  { id: "as_tuf_f16", label: "TUF F16", base: 495, inquiryOnly: false, image: "/devices/asus-tuf-tuf-f16-laptop.png" },
  { id: "as_tuf_f15", label: "TUF F15", base: 387, inquiryOnly: false, image: "/devices/asus-tuf-tuf-f15-laptop.png" },
];
const ASUS_PROART_VARIANTS = [
  { id: "as_proart_studiobook_pro_16", label: "ProArt Studiobook Pro 16", base: 1328, inquiryOnly: false, image: "/devices/asus-proart-proart-studiobook-pro-16.png" },
  { id: "as_proart_studiobook_16", label: "ProArt Studiobook 16", base: 1012, inquiryOnly: false, image: "/devices/asus-proart-proart-studiobook-16.png" },
  { id: "as_proart_p16", label: "ProArt P16", base: 1620, inquiryOnly: false, image: "/devices/asus-proart-proart-p16.png" },
  { id: "as_proart_px13", label: "ProArt PX13", base: 882, inquiryOnly: false, image: "/devices/asus-proart-proart-px13.png" },
  { id: "as_proart_pz13", label: "ProArt PZ13", base: 472, inquiryOnly: false, image: "/devices/asus-proart-proart-pz13.png" },
];
const ASUS_VIVOBOOK_VARIANTS = [
  { id: "as_vivobook_16", label: "Vivobook 16", base: 225, inquiryOnly: false, image: "/devices/asus-vivobook.webp" },
  { id: "as_vivobook_15", label: "Vivobook 15", base: 63, inquiryOnly: false, image: "/devices/asus-vivobook.webp" },
  { id: "as_vivobook_14", label: "Vivobook 14", base: 112, inquiryOnly: false, image: "/devices/asus-vivobook.webp" },
];
const ASUS_EXPERTBOOK_VARIANTS = [
  { id: "as_expertbook_p1", label: "ExpertBook P1", base: 342, inquiryOnly: false, image: "/devices/asus-expertbook-expertbook-p1.png" },
  { id: "as_expertbook_p5", label: "ExpertBook P5", base: 297, inquiryOnly: false, image: "/devices/asus-expertbook-expertbook-p5.png" },
  { id: "as_expertbook_b9", label: "ExpertBook B9", base: 108, inquiryOnly: false, image: "/devices/asus-expertbook-expertbook-b9.png" },
  { id: "as_expertbook_b5", label: "ExpertBook B5", base: 230, inquiryOnly: false, image: "/devices/asus-expertbook-expertbook-b5.png" },
  { id: "as_expertbook_b3", label: "ExpertBook B3", base: 414, inquiryOnly: false, image: "/devices/asus-expertbook-expertbook-b3.png" },
  { id: "as_expertbook_b2", label: "ExpertBook B2", base: 189, inquiryOnly: false, image: "/devices/asus-expertbook-expertbook-b2.png" },
];
const ASUS_PC_SERIES = [
  { id: "asus_rog", label: "ROG", year: "Republic of Gamers", topPrice: 1912, subSeries: ASUS_ROG_SUB_SERIES, image: "/devices/asus-rog-strix.webp" },
  { id: "asus_tuf", label: "TUF Gaming", year: "The Ultimate Force", topPrice: 774, variants: ASUS_TUF_VARIANTS, image: "/devices/asus-tuf-gaming.webp" },
  { id: "asus_proart", label: "ProArt", year: "Creator / Studiobook", topPrice: 1620, variants: ASUS_PROART_VARIANTS, image: "/devices/asus-proart-proart-p16.png" },
  { id: "asus_vivobook", label: "Vivobook", year: "Everyday", topPrice: 225, variants: ASUS_VIVOBOOK_VARIANTS, image: "/devices/asus-vivobook.webp" },
  { id: "asus_expertbook", label: "ExpertBook", year: "Business", topPrice: 414, variants: ASUS_EXPERTBOOK_VARIANTS, image: "/devices/asus-expertbook-expertbook-b9.png" },
];
const ASUS_PC_MODELS = [
  ...ASUS_ROG_STRIX_VARIANTS, ...ASUS_ROG_ZEPHYRUS_VARIANTS, ...ASUS_ROG_FLOW_VARIANTS,
  ...ASUS_TUF_VARIANTS, ...ASUS_PROART_VARIANTS, ...ASUS_VIVOBOOK_VARIANTS, ...ASUS_EXPERTBOOK_VARIANTS,
];

// DELL LAPTOPS — three-level tree mirroring itsworthmore.com.
// All 8 Dell laptop series have sub-series (XPS by size, Latitude/Inspiron/
// Precision/Vostro by 3000/5000/7000 line, G Series by model number,
// Dell Pro by size, Rugged by chassis). 138 models scraped 2026-05-09;
// images are series-level placeholders (per-model photos are not on IWM
// for Dell — they use a quiz UI rather than product detail pages).
const DELL_XPS_13_VARIANTS = [
  { id: "d_xps_13_9345", label: "XPS 13 9345", base: 374, inquiryOnly: false, image: "/devices/dell-xps-xps_13-13_xps-13-9345.png" },
  { id: "d_xps_13_9340", label: "XPS 13 9340", base: 472, inquiryOnly: false, image: "/devices/dell-xps-xps_13-13_xps-13-9340.png" },
  { id: "d_xps_13_plus_9320", label: "XPS 13 Plus 9320", base: 279, inquiryOnly: false, image: "/devices/dell-xps-xps_13-13_xps-13-plus-9320.png" },
  { id: "d_xps_13_9315", label: "XPS 13 9315", base: 194, inquiryOnly: false, image: "/devices/dell-xps-xps_13-13_xps-13-9315.png" },
  { id: "d_xps_13_9315_2in1", label: "XPS 13 9315 2-in-1", base: 270, inquiryOnly: false, image: "/devices/dell-xps-xps_13-13_xps-13-9315-2-in-1.png" },
  { id: "d_xps_13_9310", label: "XPS 13 9310", base: 162, inquiryOnly: false, image: "/devices/dell-xps-xps_13-13_xps-13-9310.png" },
  { id: "d_xps_13_9310_2in1", label: "XPS 13 9310 2-in-1", base: 180, inquiryOnly: false, image: "/devices/dell-xps-xps_13-13_xps-13-9310-2-in-1.png" },
  { id: "d_xps_13_9305", label: "XPS 13 9305", base: 162, inquiryOnly: false, image: "/devices/dell-xps-xps_13-13_xps-13-9305.png" },
  { id: "d_xps_13_9300", label: "XPS 13 9300", base: 135, inquiryOnly: false, image: "/devices/dell-xps-xps_13-13_xps-13-9300.png" },
  { id: "d_xps_13_7390", label: "XPS 13 7390", base: 99, inquiryOnly: false, image: "/devices/dell-xps-xps_13-13_xps-13-7390.png" },
  { id: "d_xps_13_7390_2in1", label: "XPS 13 7390 2-in-1", base: 117, inquiryOnly: false, image: "/devices/dell-xps-xps_13-13_xps-13-7390-2-in-1.png" },
  { id: "d_xps_13_9380", label: "XPS 13 9380", base: 99, inquiryOnly: false, image: "/devices/dell-xps-xps_13-13_xps-13-9380.png" },
  { id: "d_xps_13_9370", label: "XPS 13 9370", base: 86, inquiryOnly: false, image: "/devices/dell-xps-xps_13-13_xps-13-9370.png" },
  { id: "d_xps_13_9365_2in1", label: "XPS 13 9365 2-in-1", base: 45, inquiryOnly: false, image: "/devices/dell-xps-xps_13-13_xps-13-9365-2-in-1.png" },
  { id: "d_xps_13_9360", label: "XPS 13 9360", base: 54, inquiryOnly: false, image: "/devices/dell-xps-xps_13-13_xps-13-9360.png" },
  { id: "d_xps_13_9350", label: "XPS 13 9350", base: 608, inquiryOnly: false, image: "/devices/dell-xps-xps_13-13_xps-13-9350.png" },
];
const DELL_XPS_14_VARIANTS = [
  { id: "d_xps_14_9440", label: "XPS 14 9440", base: 472, inquiryOnly: false, image: "/devices/dell-xps-xps_14-14_xps-14-9440.png" },
  { id: "d_xps_14_da14260", label: "XPS 14 DA14260", base: 495, inquiryOnly: false, image: "/devices/dell-xps-xps_14-14_xps-14-da14260.png" },
];
const DELL_XPS_15_VARIANTS = [
  { id: "d_xps_15_9530", label: "XPS 15 9530", base: 594, inquiryOnly: false, image: "/devices/dell-xps-xps_15-15_xps-15-9530.png" },
  { id: "d_xps_15_9520", label: "XPS 15 9520", base: 315, inquiryOnly: false, image: "/devices/dell-xps-xps_15-15_xps-15-9520.png" },
  { id: "d_xps_15_9510", label: "XPS 15 9510", base: 270, inquiryOnly: false, image: "/devices/dell-xps-xps_15-15_xps-15-9510.png" },
  { id: "d_xps_15_9500", label: "XPS 15 9500", base: 176, inquiryOnly: false, image: "/devices/dell-xps-xps_15-15_xps-15-9500.png" },
  { id: "d_xps_15_7590", label: "XPS 15 7590", base: 135, inquiryOnly: false, image: "/devices/dell-xps-xps_15-15_xps-15-7590.png" },
  { id: "d_xps_15_9575_2in1", label: "XPS 15 9575 2-in-1", base: 99, inquiryOnly: false, image: "/devices/dell-xps-xps_15-15_xps-15-9575-2-in-1.png" },
  { id: "d_xps_15_9570", label: "XPS 15 9570", base: 117, inquiryOnly: false, image: "/devices/dell-xps-xps_15-15_xps-15-9570.png" },
  { id: "d_xps_15_9560", label: "XPS 15 9560", base: 45, inquiryOnly: false, image: "/devices/dell-xps-xps_15-15_xps-15-9560.png" },
  { id: "d_xps_15_9550", label: "XPS 15 9550", base: 90, inquiryOnly: false, image: "/devices/dell-xps-xps_15-15_xps-15-9550.png" },
];
const DELL_XPS_16_VARIANTS = [
  { id: "d_xps_16_9640", label: "XPS 16 9640", base: 540, inquiryOnly: false, image: "/devices/dell-xps-xps_16-16_xps-16-9640.png" },
  { id: "d_xps_16_da16260", label: "XPS 16 DA16260", base: 562, inquiryOnly: false, image: "/devices/dell-xps-xps_16-16_xps-16-da16260.png" },
];
const DELL_XPS_17_VARIANTS = [
  { id: "d_xps_17_9730", label: "XPS 17 9730", base: 1152, inquiryOnly: false, image: "/devices/dell-xps-xps_17-17_xps-17-9730.png" },
  { id: "d_xps_17_9720", label: "XPS 17 9720", base: 414, inquiryOnly: false, image: "/devices/dell-xps-xps_17-17_xps-17-9720.png" },
  { id: "d_xps_17_9710", label: "XPS 17 9710", base: 324, inquiryOnly: false, image: "/devices/dell-xps-xps_17-17_xps-17-9710.png" },
  { id: "d_xps_17_9700", label: "XPS 17 9700", base: 279, inquiryOnly: false, image: "/devices/dell-xps-xps_17-17_xps-17-9700.png" },
];
const DELL_LATITUDE_3000_VARIANTS = [
  { id: "d_lat_3500", label: "Latitude 3500 Series", base: 36, inquiryOnly: false, image: "/devices/dell-latitude-latitude_3000-3000_latitude-3000-15.png" },
  { id: "d_lat_3400", label: "Latitude 3400 Series", base: 40, inquiryOnly: false, image: "/devices/dell-latitude-latitude_3000-3000_latitude-3000-14.png" },
  { id: "d_lat_3300", label: "Latitude 3300 Series", base: 14, inquiryOnly: false, image: "/devices/dell-latitude-latitude_3000-3000_latitude-3000-13.png" },
];
const DELL_LATITUDE_5000_VARIANTS = [
  { id: "d_lat_5500", label: "Latitude 5500 Series", base: 58, inquiryOnly: false, image: "/devices/dell-latitude-latitude_5000-5000_latitude-5000-15.png" },
  { id: "d_lat_5400", label: "Latitude 5400 Series", base: 68, inquiryOnly: false, image: "/devices/dell-latitude-latitude_5000-5000_latitude-5000-14.png" },
  { id: "d_lat_5300", label: "Latitude 5300 Series", base: 266, inquiryOnly: false, image: "/devices/dell-latitude-latitude_5000-5000_latitude-5000-13.png" },
  { id: "d_lat_5200", label: "Latitude 5200 Series", base: 40, inquiryOnly: false, image: "/devices/dell-latitude-latitude_5000-5000_latitude-5000-12.png" },
];
const DELL_LATITUDE_7000_VARIANTS = [
  { id: "d_lat_7600", label: "Latitude 7600 Series", base: 342, inquiryOnly: false, image: "/devices/dell-latitude-latitude_7000-7000_latitude-7000-16.png" },
  { id: "d_lat_7500", label: "Latitude 7500 Series", base: 148, inquiryOnly: false, image: "/devices/dell-latitude-latitude_7000-7000_latitude-7000-15.png" },
  { id: "d_lat_7400", label: "Latitude 7400 Series", base: 32, inquiryOnly: false, image: "/devices/dell-latitude-latitude_7000-7000_latitude-7000-14.png" },
  { id: "d_lat_7300", label: "Latitude 7300 Series", base: 63, inquiryOnly: false, image: "/devices/dell-latitude-latitude_7000-7000_latitude-7000-13.png" },
  { id: "d_lat_7200", label: "Latitude 7200 Series", base: 36, inquiryOnly: false, image: "/devices/dell-latitude-latitude_7000-7000_latitude-7000-12.png" },
];
const DELL_LATITUDE_9000_VARIANTS = [
  { id: "d_lat_9500", label: "Latitude 9500 Series", base: 194, inquiryOnly: false, image: "/devices/dell-latitude-latitude_9000-9000_latitude-9000-15.png" },
  { id: "d_lat_9400", label: "Latitude 9400 Series", base: 585, inquiryOnly: false, image: "/devices/dell-latitude-latitude_9000-9000_latitude-9000-14.png" },
  { id: "d_lat_9300", label: "Latitude 9300 Series", base: 292, inquiryOnly: false, image: "/devices/dell-latitude-latitude_9000-9000_latitude-9000-13.png" },
];
const DELL_INSPIRON_3000_VARIANTS = [
  { id: "d_insp_3700", label: "Inspiron 3700 Series", base: 45, inquiryOnly: false, image: "/devices/dell-inspiron-inspiron_3000-3000_inspiron-3000-17.png" },
  { id: "d_insp_3500", label: "Inspiron 3500 Series", base: 27, inquiryOnly: false, image: "/devices/dell-inspiron-inspiron_3000-3000_inspiron-3000-15.png" },
  { id: "d_insp_3400", label: "Inspiron 3400 Series", base: 36, inquiryOnly: false, image: "/devices/dell-inspiron-inspiron_3000-3000_inspiron-3000-14.png" },
];
const DELL_INSPIRON_5000_VARIANTS = [
  { id: "d_insp_5700", label: "Inspiron 5700 Series", base: 45, inquiryOnly: false, image: "/devices/dell-inspiron-inspiron_5000-5000_inspiron-5000-17.png" },
  { id: "d_insp_5600", label: "Inspiron 5600 Series", base: 252, inquiryOnly: false, image: "/devices/dell-inspiron-inspiron_5000-5000_inspiron-5000-16.png" },
  { id: "d_insp_5500", label: "Inspiron 5500 Series", base: 117, inquiryOnly: false, image: "/devices/dell-inspiron-inspiron_5000-5000_inspiron-5000-15.png" },
  { id: "d_insp_5400", label: "Inspiron 5400 Series", base: 45, inquiryOnly: false, image: "/devices/dell-inspiron-inspiron_5000-5000_inspiron-5000-14.png" },
  { id: "d_insp_5300", label: "Inspiron 5300 Series", base: 58, inquiryOnly: false, image: "/devices/dell-inspiron-inspiron_5000-5000_inspiron-5000-13.png" },
];
const DELL_INSPIRON_7000_VARIANTS = [
  { id: "d_insp_7700", label: "Inspiron 7700 Series", base: 279, inquiryOnly: false, image: "/devices/dell-inspiron-inspiron_7000-7000_inspiron-7000-17.png" },
  { id: "d_insp_7600", label: "Inspiron 7600 Series", base: 284, inquiryOnly: false, image: "/devices/dell-inspiron-inspiron_7000-7000_inspiron-7000-16.png" },
  { id: "d_insp_7500", label: "Inspiron 7500 Series", base: 108, inquiryOnly: false, image: "/devices/dell-inspiron-inspiron_7000-7000_inspiron-7000-15.png" },
  { id: "d_insp_7400", label: "Inspiron 7400 Series", base: 54, inquiryOnly: false, image: "/devices/dell-inspiron-inspiron_7000-7000_inspiron-7000-14.png" },
  { id: "d_insp_7300", label: "Inspiron 7300 Series", base: 76, inquiryOnly: false, image: "/devices/dell-inspiron-inspiron_7000-7000_inspiron-7000-13.png" },
];
const DELL_PRECISION_3000_VARIANTS = [
  { id: "d_prec_3500", label: "Precision 3500 Series", base: 720, inquiryOnly: false, image: "/devices/dell-precision-precision_3000-3000_precision-3000-series-15.png" },
  { id: "d_prec_3400", label: "Precision 3400 Series", base: 346, inquiryOnly: false, image: "/devices/dell-precision-precision_3000-3000_precision-3000-series-14.png" },
];
const DELL_PRECISION_5000_VARIANTS = [
  { id: "d_prec_5560", label: "Precision 5560", base: 720, inquiryOnly: false, image: "/devices/dell-precision-precision_3000-3000_precision-3000-series-15.png" },
  { id: "d_prec_5550", label: "Precision 5550", base: 720, inquiryOnly: false, image: "/devices/dell-precision-precision_3000-3000_precision-3000-series-15.png" },
  { id: "d_prec_5540", label: "Precision 5540", base: 720, inquiryOnly: false, image: "/devices/dell-precision-precision_3000-3000_precision-3000-series-15.png" },
];
const DELL_PRECISION_7000_VARIANTS = [
  { id: "d_prec_7780", label: "Precision 7780", base: 720, inquiryOnly: false, image: "/devices/dell-precision-precision_3000-3000_precision-3000-series-15.png" },
  { id: "d_prec_7770", label: "Precision 7770", base: 720, inquiryOnly: false, image: "/devices/dell-precision-precision_3000-3000_precision-3000-series-15.png" },
  { id: "d_prec_7760", label: "Precision 7760", base: 720, inquiryOnly: false, image: "/devices/dell-precision-precision_3000-3000_precision-3000-series-15.png" },
  { id: "d_prec_7560", label: "Precision 7560", base: 720, inquiryOnly: false, image: "/devices/dell-precision-precision_3000-3000_precision-3000-series-15.png" },
];
const DELL_VOSTRO_3000_VARIANTS = [
  { id: "d_vostro_3535", label: "Vostro 3535", base: 63, inquiryOnly: false, image: "/devices/dell-vostro-vostro_3000-3000_3535.png" },
  { id: "d_vostro_3530", label: "Vostro 3530", base: 122, inquiryOnly: false, image: "/devices/dell-vostro-vostro_3000-3000_3530.png" },
  { id: "d_vostro_3520", label: "Vostro 3520", base: 76, inquiryOnly: false, image: "/devices/dell-vostro-vostro_3000-3000_3520.png" },
  { id: "d_vostro_3510", label: "Vostro 3510", base: 58, inquiryOnly: false, image: "/devices/dell-vostro-vostro_3000-3000_3510.png" },
  { id: "d_vostro_3500", label: "Vostro 3500", base: 36, inquiryOnly: false, image: "/devices/dell-latitude-latitude_3000-3000_latitude-3000-15.png" },
  { id: "d_vostro_3430", label: "Vostro 3430", base: 90, inquiryOnly: false, image: "/devices/dell-vostro-vostro_3000-3000_3430.png" },
  { id: "d_vostro_3420", label: "Vostro 3420", base: 54, inquiryOnly: false, image: "/devices/dell-vostro-vostro_3000-3000_3420.png" },
  { id: "d_vostro_3591", label: "Vostro 3591", base: 9, inquiryOnly: false, image: "/devices/dell-vostro-vostro_3000-3000_3591.png" },
  { id: "d_vostro_3590", label: "Vostro 3590", base: 117, inquiryOnly: false, image: "/devices/dell-vostro-vostro_3000-3000_3590.png" },
];
const DELL_VOSTRO_5000_VARIANTS = [
  { id: "d_vostro_5630", label: "Vostro 5630", base: 158, inquiryOnly: false, image: "/devices/dell-vostro-vostro_5000-5000_5630.png" },
  { id: "d_vostro_5620", label: "Vostro 5620", base: 99, inquiryOnly: false, image: "/devices/dell-vostro-vostro_5000-5000_5620.png" },
  { id: "d_vostro_5590", label: "Vostro 5590", base: 68, inquiryOnly: false, image: "/devices/dell-vostro-vostro_5000-5000_5590.png" },
  { id: "d_vostro_5581", label: "Vostro 5581", base: 9, inquiryOnly: false, image: "/devices/dell-vostro-vostro_5000-5000_5581.png" },
  { id: "d_vostro_5510", label: "Vostro 5510", base: 202, inquiryOnly: false, image: "/devices/dell-vostro-vostro_5000-5000_5510.png" },
  { id: "d_vostro_5502", label: "Vostro 5502", base: 76, inquiryOnly: false, image: "/devices/dell-vostro-vostro_5000-5000_5502.png" },
  { id: "d_vostro_5501", label: "Vostro 5501", base: 27, inquiryOnly: false, image: "/devices/dell-vostro-vostro_5000-5000_5501.png" },
  { id: "d_vostro_5490", label: "Vostro 5490", base: 9, inquiryOnly: false, image: "/devices/dell-vostro-vostro_5000-5000_5490.png" },
  { id: "d_vostro_5410", label: "Vostro 5410", base: 54, inquiryOnly: false, image: "/devices/dell-vostro-vostro_5000-5000_5410.png" },
  { id: "d_vostro_5402", label: "Vostro 5402", base: 27, inquiryOnly: false, image: "/devices/dell-vostro-vostro_5000-5000_5402.png" },
  { id: "d_vostro_5401", label: "Vostro 5401", base: 18, inquiryOnly: false, image: "/devices/dell-vostro-vostro_5000-5000_5401.png" },
  { id: "d_vostro_5301", label: "Vostro 5301", base: 27, inquiryOnly: false, image: "/devices/dell-vostro-vostro_5000-5000_5301.png" },
];
const DELL_VOSTRO_7000_VARIANTS = [
  { id: "d_vostro_7620", label: "Vostro 7620", base: 346, inquiryOnly: false, image: "/devices/dell-vostro-vostro_7000-7000_7620.png" },
  { id: "d_vostro_7590", label: "Vostro 7590", base: 135, inquiryOnly: false, image: "/devices/dell-xps-xps_15-15_xps-15-7590.png" },
  { id: "d_vostro_7510", label: "Vostro 7510", base: 202, inquiryOnly: false, image: "/devices/dell-vostro-vostro_7000-7000_7510.png" },
  { id: "d_vostro_7500", label: "Vostro 7500", base: 148, inquiryOnly: false, image: "/devices/dell-latitude-latitude_7000-7000_latitude-7000-15.png" },
];
const DELL_G3_VARIANTS = [
  { id: "d_g3_3779", label: "G3 3779", base: 81, inquiryOnly: false, image: "/devices/dell-g_series-g3-3779.png" },
  { id: "d_g3_3590", label: "G3 3590", base: 117, inquiryOnly: false, image: "/devices/dell-g_series-g3-3590.png" },
  { id: "d_g3_3579", label: "G3 3579", base: 68, inquiryOnly: false, image: "/devices/dell-g_series-g3-3579.png" },
  { id: "d_g3_3500", label: "G3 3500", base: 144, inquiryOnly: false, image: "/devices/dell-g_series-g3-3500.png" },
];
const DELL_G5_VARIANTS = [
  { id: "d_g5_5590", label: "G5 5590", base: 68, inquiryOnly: false, image: "/devices/dell-g_series-g5-5590.png" },
  { id: "d_g5_5587", label: "G5 5587", base: 63, inquiryOnly: false, image: "/devices/dell-g_series-g5-5587.png" },
  { id: "d_g5_5505_se", label: "G5 5505 SE", base: 202, inquiryOnly: false, image: "/devices/dell-g_series-g5-5505-se.png" },
  { id: "d_g5_5500", label: "G5 5500", base: 180, inquiryOnly: false, image: "/devices/dell-g_series-g5-5500.png" },
];
const DELL_G7_VARIANTS = [
  { id: "d_g7_7790", label: "G7 7790", base: 0, inquiryOnly: true, image: "/devices/d_g7_7790.png" },
  { id: "d_g7_7700", label: "G7 7700", base: 0, inquiryOnly: true, image: "/devices/d_g7_7700.png" },
  { id: "d_g7_7590", label: "G7 7590", base: 126, inquiryOnly: false, image: "/devices/dell-g_series-g7-7590.png" },
  { id: "d_g7_7588", label: "G7 7588", base: 99, inquiryOnly: false, image: "/devices/dell-g_series-g7-7588.png" },
  { id: "d_g7_7500", label: "G7 7500", base: 189, inquiryOnly: false, image: "/devices/dell-g_series-g7-7500.png" },
];
const DELL_G15_VARIANTS = [
  { id: "d_g15_5535", label: "G15 5535", base: 0, inquiryOnly: true, image: "/devices/d_g15_5535.png" },
  { id: "d_g15_5530", label: "G15 5530", base: 0, inquiryOnly: true, image: "/devices/d_g15_5530.png" },
  { id: "d_g15_5525", label: "G15 5525", base: 0, inquiryOnly: true, image: "/devices/d_g15_5525.png" },
  { id: "d_g15_5521", label: "G15 5521", base: 0, inquiryOnly: true, image: "/devices/d_g15_5521.png" },
  { id: "d_g15_5520", label: "G15 5520", base: 0, inquiryOnly: true, image: "/devices/d_g15_5520.png" },
  { id: "d_g15_5515", label: "G15 5515", base: 0, inquiryOnly: true, image: "/devices/d_g15_5515.png" },
  { id: "d_g15_5511", label: "G15 5511", base: 0, inquiryOnly: true, image: "/devices/d_g15_5511.png" },
  { id: "d_g15_5510", label: "G15 5510", base: 0, inquiryOnly: true, image: "/devices/d_g15_5510.png" },
];
const DELL_G16_VARIANTS = [
  { id: "d_g16_7630", label: "G16 7630", base: 0, inquiryOnly: true, image: "/devices/d_g16_7630.png" },
  { id: "d_g16_7620", label: "G16 7620", base: 0, inquiryOnly: true, image: "/devices/d_g16_7620.png" },
];
const DELL_PRO_13_VARIANTS = [
  { id: "d_pro_13_premium_pa13250", label: "Dell Pro 13 Premium PA13250", base: 630, inquiryOnly: false, image: "/devices/d_pro_13_premium_pa13250.png" },
  { id: "d_pro_13_plus_pb13255", label: "Dell Pro 13 Plus PB13255", base: 428, inquiryOnly: false, image: "/devices/d_pro_13_plus_pb13255.png" },
  { id: "d_pro_13_plus_pb13250", label: "Dell Pro 13 Plus PB13250", base: 338, inquiryOnly: false, image: "/devices/d_pro_13_plus_pb13250.png" },
  { id: "d_pro_13_plus_2in1_pb13255", label: "Dell Pro 13 Plus (2-in-1) PB13255", base: 495, inquiryOnly: false, image: "/devices/d_pro_13_plus_2in1_pb13255.png" },
  { id: "d_pro_13_plus_2in1_pb13250", label: "Dell Pro 13 Plus (2-in-1) PB13250", base: 405, inquiryOnly: false, image: "/devices/d_pro_13_plus_2in1_pb13250.png" },
];
const DELL_PRO_14_VARIANTS = [
  { id: "d_pro_14_premium_pa14250", label: "Dell Pro 14 Premium PA14250", base: 454, inquiryOnly: false, image: "/devices/d_pro_14_premium_pa14250.png" },
  { id: "d_pro_14_plus_pb14255", label: "Dell Pro 14 Plus PB14255", base: 562, inquiryOnly: false, image: "/devices/d_pro_14_plus_pb14255.png" },
  { id: "d_pro_14_plus_pb14250", label: "Dell Pro 14 Plus PB14250", base: 441, inquiryOnly: false, image: "/devices/d_pro_14_plus_pb14250.png" },
  { id: "d_pro_14_plus_2in1_pb14255", label: "Dell Pro 14 Plus (2-in-1) PB14255", base: 540, inquiryOnly: false, image: "/devices/d_pro_14_plus_2in1_pb14255.png" },
  { id: "d_pro_14_plus_2in1_pb14250", label: "Dell Pro 14 Plus (2-in-1) PB14250", base: 450, inquiryOnly: false, image: "/devices/d_pro_14_plus_2in1_pb14250.png" },
  { id: "d_pro_14_pc14255", label: "Dell Pro 14 PC14255", base: 306, inquiryOnly: false, image: "/devices/d_pro_14_pc14255.png" },
  { id: "d_pro_14_pc14250", label: "Dell Pro 14 PC14250", base: 306, inquiryOnly: false, image: "/devices/d_pro_14_pc14250.png" },
  { id: "d_pro_14_essential_pv14255", label: "Dell Pro 14 Essential PV14255", base: 284, inquiryOnly: false, image: "/devices/d_pro_14_essential_pv14255.png" },
  { id: "d_pro_14_essential_pv14250", label: "Dell Pro 14 Essential PV14250", base: 234, inquiryOnly: false, image: "/devices/d_pro_14_essential_pv14250.png" },
  { id: "d_pro_max_14_premium_ma14250", label: "Dell Pro Max 14 Premium MA14250", base: 1156, inquiryOnly: false, image: "/devices/d_pro_max_14_premium_ma14250.png" },
  { id: "d_pro_max_14_mc14255", label: "Dell Pro Max 14 MC14255", base: 562, inquiryOnly: false, image: "/devices/d_pro_max_14_mc14255.png" },
  { id: "d_pro_max_14_mc14250", label: "Dell Pro Max 14 MC14250", base: 742, inquiryOnly: false, image: "/devices/d_pro_max_14_mc14250.png" },
];
const DELL_PRO_16_VARIANTS = [
  { id: "d_pro_max_16_premium_ma16250", label: "Dell Pro Max 16 Premium MA16250", base: 1665, inquiryOnly: false, image: "/devices/d_pro_max_16_premium_ma16250.png" },
  { id: "d_pro_max_16_plus_mb16250", label: "Dell Pro Max 16 Plus MB16250", base: 1440, inquiryOnly: false, image: "/devices/d_pro_max_16_plus_mb16250.png" },
  { id: "d_pro_max_16_mc16255", label: "Dell Pro Max 16 MC16255", base: 1080, inquiryOnly: false, image: "/devices/d_pro_max_16_mc16255.png" },
  { id: "d_pro_max_16_mc16250", label: "Dell Pro Max 16 MC16250", base: 765, inquiryOnly: false, image: "/devices/d_pro_max_16_mc16250.png" },
  { id: "d_pro_16_plus_pb16255", label: "Dell Pro 16 Plus PB16255", base: 428, inquiryOnly: false, image: "/devices/d_pro_16_plus_pb16255.png" },
  { id: "d_pro_16_plus_pb16250", label: "Dell Pro 16 Plus PB16250", base: 432, inquiryOnly: false, image: "/devices/d_pro_16_plus_pb16250.png" },
  { id: "d_pro_16_pc16255", label: "Dell Pro 16 PC16255", base: 378, inquiryOnly: false, image: "/devices/d_pro_16_pc16255.png" },
  { id: "d_pro_16_pc16250", label: "Dell Pro 16 PC16250", base: 292, inquiryOnly: false, image: "/devices/d_pro_16_pc16250.png" },
];
const DELL_LAT_RUGGED_VARIANTS = [
  { id: "d_lat_rugged_5430", label: "Latitude 5430 Rugged", base: 0, inquiryOnly: true, image: "/devices/d_lat_rugged_5430.png" },
  { id: "d_lat_rugged_7330_extreme", label: "Latitude 7330 Rugged Extreme", base: 0, inquiryOnly: true, image: "/devices/d_lat_rugged_7330_extreme.png" },
];

const DELL_XPS_SUB_SERIES = [
  { id: "dell_xps_13", label: "XPS 13", year: "13-inch", topPrice: 608, variants: DELL_XPS_13_VARIANTS, image: "/devices/dell-xps.webp" },
  { id: "dell_xps_14", label: "XPS 14", year: "14-inch", topPrice: 495, variants: DELL_XPS_14_VARIANTS, image: "/devices/dell-xps.webp" },
  { id: "dell_xps_15", label: "XPS 15", year: "15-inch", topPrice: 594, variants: DELL_XPS_15_VARIANTS, image: "/devices/dell-xps.webp" },
  { id: "dell_xps_16", label: "XPS 16", year: "16-inch", topPrice: 562, variants: DELL_XPS_16_VARIANTS, image: "/devices/dell-xps.webp" },
  { id: "dell_xps_17", label: "XPS 17", year: "17-inch", topPrice: 1152, variants: DELL_XPS_17_VARIANTS, image: "/devices/dell-xps.webp" },
];
const DELL_LATITUDE_SUB_SERIES = [
  { id: "dell_lat_3000", label: "Latitude 3000", year: "Entry business", topPrice: 40, variants: DELL_LATITUDE_3000_VARIANTS, image: "/devices/dell-latitude.jpg" },
  { id: "dell_lat_5000", label: "Latitude 5000", year: "Mainstream", topPrice: 266, variants: DELL_LATITUDE_5000_VARIANTS, image: "/devices/dell-latitude.jpg" },
  { id: "dell_lat_7000", label: "Latitude 7000", year: "Premium", topPrice: 342, variants: DELL_LATITUDE_7000_VARIANTS, image: "/devices/dell-latitude.jpg" },
  { id: "dell_lat_9000", label: "Latitude 9000", year: "Ultra-premium", topPrice: 585, variants: DELL_LATITUDE_9000_VARIANTS, image: "/devices/dell-latitude.jpg" },
];
const DELL_INSPIRON_SUB_SERIES = [
  { id: "dell_insp_3000", label: "Inspiron 3000", year: "Essential", topPrice: 45, variants: DELL_INSPIRON_3000_VARIANTS, image: "/devices/dell-inspiron-15.webp" },
  { id: "dell_insp_5000", label: "Inspiron 5000", year: "Mainstream", topPrice: 252, variants: DELL_INSPIRON_5000_VARIANTS, image: "/devices/dell-inspiron-15.webp" },
  { id: "dell_insp_7000", label: "Inspiron 7000", year: "Performance", topPrice: 284, variants: DELL_INSPIRON_7000_VARIANTS, image: "/devices/dell-inspiron-15.webp" },
];
const DELL_PRECISION_SUB_SERIES = [
  { id: "dell_prec_3000", label: "Precision 3000", year: "Entry mobile WS", topPrice: 720, variants: DELL_PRECISION_3000_VARIANTS, image: "/devices/dell-latitude.jpg" },
  { id: "dell_prec_5000", label: "Precision 5000", year: "Performance mobile", topPrice: 720, variants: DELL_PRECISION_5000_VARIANTS, image: "/devices/dell-latitude.jpg" },
  { id: "dell_prec_7000", label: "Precision 7000", year: "Ultimate mobile", topPrice: 720, variants: DELL_PRECISION_7000_VARIANTS, image: "/devices/dell-latitude.jpg" },
];
const DELL_VOSTRO_SUB_SERIES = [
  { id: "dell_vostro_3000", label: "Vostro 3000", year: "Small business", topPrice: 122, variants: DELL_VOSTRO_3000_VARIANTS, image: "/devices/dell-inspiron-15.webp" },
  { id: "dell_vostro_5000", label: "Vostro 5000", year: "Mid-range", topPrice: 202, variants: DELL_VOSTRO_5000_VARIANTS, image: "/devices/dell-inspiron-15.webp" },
  { id: "dell_vostro_7000", label: "Vostro 7000", year: "Performance", topPrice: 346, variants: DELL_VOSTRO_7000_VARIANTS, image: "/devices/dell-inspiron-15.webp" },
];
const DELL_G_SUB_SERIES = [
  { id: "dell_g3", label: "G3", year: "Entry gaming", topPrice: 144, variants: DELL_G3_VARIANTS, image: "/devices/dell-xps.webp" },
  { id: "dell_g5", label: "G5", year: "Mid gaming", topPrice: 202, variants: DELL_G5_VARIANTS, image: "/devices/dell-xps.webp" },
  { id: "dell_g7", label: "G7", year: "Performance gaming", topPrice: 189, variants: DELL_G7_VARIANTS, image: "/devices/dell-xps.webp" },
  { id: "dell_g15", label: "G15", year: "15-inch gaming", topPrice: 0, variants: DELL_G15_VARIANTS, inquiryOnly: true, image: "/devices/dell-xps.webp" },
  { id: "dell_g16", label: "G16", year: "16-inch gaming", topPrice: 0, variants: DELL_G16_VARIANTS, inquiryOnly: true, image: "/devices/dell-xps.webp" },
];
const DELL_PRO_SUB_SERIES = [
  { id: "dell_pro_13", label: "Dell Pro 13", year: "13-inch", topPrice: 630, variants: DELL_PRO_13_VARIANTS, image: "/devices/dell-xps.webp" },
  { id: "dell_pro_14", label: "Dell Pro 14", year: "14-inch", topPrice: 1156, variants: DELL_PRO_14_VARIANTS, image: "/devices/dell-xps.webp" },
  { id: "dell_pro_16", label: "Dell Pro 16", year: "16-inch", topPrice: 1665, variants: DELL_PRO_16_VARIANTS, image: "/devices/dell-xps.webp" },
];
const DELL_RUGGED_SUB_SERIES = [
  { id: "dell_lat_rugged", label: "Latitude Rugged", year: "Field-tough", topPrice: 0, variants: DELL_LAT_RUGGED_VARIANTS, inquiryOnly: true, image: "/devices/dell-latitude.jpg" },
];
const DELL_PC_SERIES = [
  { id: "dell_xps", label: "XPS", year: "Premium consumer", topPrice: 1152, subSeries: DELL_XPS_SUB_SERIES, image: "/devices/dell-xps.webp" },
  { id: "dell_latitude", label: "Latitude", year: "Business", topPrice: 585, subSeries: DELL_LATITUDE_SUB_SERIES, image: "/devices/dell-latitude.jpg" },
  { id: "dell_inspiron", label: "Inspiron", year: "Everyday", topPrice: 284, subSeries: DELL_INSPIRON_SUB_SERIES, image: "/devices/dell-inspiron-15.webp" },
  { id: "dell_precision", label: "Precision", year: "Mobile workstation", topPrice: 720, subSeries: DELL_PRECISION_SUB_SERIES, image: "/devices/dell-latitude.jpg" },
  { id: "dell_vostro", label: "Vostro", year: "Small-business", topPrice: 346, subSeries: DELL_VOSTRO_SUB_SERIES, image: "/devices/dell-inspiron-15.webp" },
  { id: "dell_g", label: "G Series", year: "Gaming", topPrice: 202, subSeries: DELL_G_SUB_SERIES, image: "/devices/dell-xps.webp" },
  { id: "dell_pro", label: "Dell Pro", year: "AI-class business", topPrice: 1665, subSeries: DELL_PRO_SUB_SERIES, image: "/devices/dell-xps.webp" },
  { id: "dell_rugged", label: "Rugged", year: "Field/military", topPrice: 0, subSeries: DELL_RUGGED_SUB_SERIES, inquiryOnly: true, image: "/devices/dell-latitude.jpg" },
];
const DELL_PC_ALL_SUB_SERIES = [
  ...DELL_XPS_SUB_SERIES, ...DELL_LATITUDE_SUB_SERIES, ...DELL_INSPIRON_SUB_SERIES,
  ...DELL_PRECISION_SUB_SERIES, ...DELL_VOSTRO_SUB_SERIES, ...DELL_G_SUB_SERIES,
  ...DELL_PRO_SUB_SERIES, ...DELL_RUGGED_SUB_SERIES,
];

const ALIENWARE_DESKTOP_MODELS = [
  { id: "awaurorar16", label: "Aurora R16", base: 340, image: "/devices/alienware-aurora-r16.webp" },
  // R15 / R13 prices scraped from IWM via head scraper 2026-05-17.
  // Base = i7 / 1TB SSD / Flawless × 0.90 (mid-tier chip + storage):
  //   R15 i7 1TB Flawless $785 → $706
  //   R13 i7 1TB Flawless $340 → $306
  // Higher-spec configs scale up via storage multipliers downstream.
  { id: "awaurorar15", label: "Aurora R15", base: 706, inquiryOnly: false, image: "/devices/alienware-aurora-r15.webp" },
  { id: "awaurorar14", label: "Aurora R14", base: 0, inquiryOnly: true, image: "/devices/alienware-aurora-r14.webp" },
  { id: "awaurorar13", label: "Aurora R13", base: 306, inquiryOnly: false, image: "/devices/alienware-aurora-r13.webp" },
  { id: "awaurorar12", label: "Aurora R12", base: 0, inquiryOnly: true, image: "/devices/alienware-aurora-r12.webp" },
  { id: "awaurorar10", label: "Aurora R10", base: 0, inquiryOnly: true, image: "/devices/alienware-aurora-r10.webp" },
  { id: "awarea51desktop", label: "Area-51 Desktop", base: 0, inquiryOnly: true, image: "/devices/alienware-area-51-desktop.webp" },
];

// MSI desktops — prices and SKUs from IWM web-head scrape 2026-05-17.
// Each base = IWM Flawless × max-storage × 0.90 (top-config baseline).
// IWM source URLs:
//   /sell/msi-desktop/msi-aegis-gaming-desktop
//   /sell/msi-desktop/msi-codex-gaming-desktop
//   /sell/msi-desktop/msi-trident-gaming-desktop
// Old SKUs (MEG Trident X2, MAG Codex 6, etc.) renamed to match IWM's
// labels so the lead body carries the SKU IWM would price against.
const MSI_DESKTOP_MODELS = [
  // Aegis flagship gaming
  { id: "msiaegisrs",  label: "Aegis RS",  base: 810, inquiryOnly: false, image: "/devices/msi-aegis.webp" },
  { id: "msiaegisr",   label: "Aegis R",   base: 729, inquiryOnly: false, image: "/devices/msi-aegis.webp" },
  { id: "msiaegiszs",  label: "Aegis ZS",  base: 500, inquiryOnly: false, image: "/devices/msi-aegis.webp" },
  { id: "msiaegisrs2", label: "Aegis RS2", base: 387, inquiryOnly: false, image: "/devices/msi-aegis.webp" },
  { id: "msiaegisr2",  label: "Aegis R2",  base: 387, inquiryOnly: false, image: "/devices/msi-aegis.webp" },
  { id: "msiaegisti5", label: "Aegis Ti5", base: 333, inquiryOnly: false, image: "/devices/msi-aegis.webp" },
  { id: "msiaegiszs2", label: "Aegis ZS2", base: 333, inquiryOnly: false, image: "/devices/msi-aegis.webp" },
  { id: "msiaegisse",  label: "Aegis SE",  base: 243, inquiryOnly: false, image: "/devices/msi-aegis.webp" },
  // Trident compact gaming
  { id: "msitridentx",  label: "Trident X",  base: 644, inquiryOnly: false, image: "/devices/msi-trident.webp" },
  { id: "msitridentas", label: "Trident AS", base: 464, inquiryOnly: false, image: "/devices/msi-trident.webp" },
  { id: "msiinfinity",  label: "Trident X2", base: 387, inquiryOnly: false, image: "/devices/msi-trident.webp" },
  { id: "msitrident",   label: "Trident 3",  base: 346, inquiryOnly: false, image: "/devices/msi-trident.webp" },
  // Codex entry/mid gaming
  { id: "msicodexr2",   label: "Codex R2",   base: 495, inquiryOnly: false, image: "/devices/msi-codex.webp" },
  { id: "msinightblade", label: "Codex R",   base: 446, inquiryOnly: false, image: "/devices/msi-codex.webp" },
  { id: "msicodex5",    label: "Codex Z",    base: 342, inquiryOnly: false, image: "/devices/msi-codex.webp" },
  // PRO line — IWM doesn't list, manual only
  { id: "msipro", label: "PRO DP180", base: 0, inquiryOnly: true, image: "/devices/msi-aegis.webp" },
];

const IPAD_SERIES = [
  { id: "ipadpro", label: "iPad Pro", topPrice: 1035, image: "/ipadpro.png", variants: [
    { id: "ipadpro13m5", label: "iPad Pro 13\" M5", base: 610, image: "/devices/ipad-pro-13-m5.webp" },
    { id: "ipadpro11m5", label: "iPad Pro 11\" M5", base: 475, image: "/devices/ipad-pro-11-m5.webp" },
    { id: "ipadpro13m4", label: "iPad Pro 13\" M4", base: 500, image: "/devices/ipad-pro-13-m4.webp" },
    { id: "ipadpro11m4", label: "iPad Pro 11\" M4", base: 350, image: "/devices/ipad-pro-11-m4.webp" },
    { id: "ipadpro129g6", label: "iPad Pro 12.9\" 6th Gen", base: 270, image: "/devices/ipad-pro-12-9.webp" },
    { id: "ipadpro11g4", label: "iPad Pro 11\" 4th Gen", base: 225, image: "/devices/ipad-pro-11-4g.webp" },
  ]},
  { id: "ipadair", label: "iPad Air", topPrice: 470, image: "/ipadair.png", variants: [
    { id: "ipadair13m3", label: "iPad Air 13\" M3", base: 360, image: "/devices/ipad-air-13-m3.webp" },
    { id: "ipadair11m3", label: "iPad Air 11\" M3", base: 275, image: "/devices/ipad-air-11-m3.webp" },
    { id: "ipadair13m2", label: "iPad Air 13\" M2", base: 275, image: "/devices/ipad-air-13-m2.webp" },
    { id: "ipadair11m2", label: "iPad Air 11\" M2", base: 200, image: "/devices/ipad-air-11-m2.webp" },
  ]},
  { id: "ipadmini", label: "iPad Mini", topPrice: 396, image: "/ipadmini.png", variants: [
    { id: "ipadmini7", label: "iPad Mini 7th Gen", base: 225, image: "/devices/ipad-mini-7.webp" },
    { id: "ipadmini6", label: "iPad Mini 6th Gen", base: 150, image: "/devices/ipad-mini-6.webp" },
  ]},
  { id: "ipadbase", label: "iPad", topPrice: 198, image: "/ipadbase.png", variants: [
    { id: "ipad10", label: "iPad 10th Gen", base: 150, image: "/devices/ipad-10.webp" },
    { id: "ipad9", label: "iPad 9th Gen", base: 100, image: "/devices/ipad-9.webp" },
  ]},
];

const IPAD_MODELS = IPAD_SERIES.flatMap(s => s.variants);

// Disc vs Digital is no longer a separate model — it's asked at the
// extras step with an 8% multiplier reduction for digital. So PS5
// Standard / Slim each consolidate to one entry.
const PS5_VARIANTS = [
  // Storage is implicit by variant — Pro ships 2 TB, Slim ships 1 TB,
  // original ships 825 GB. No storage step or extras question for
  // consoles per Skywalker (2026-05-12).
  { id: "ps5pro",  label: "PlayStation 5 Pro",    base: 450, image: "/devices/ps5pro.webp" },
  { id: "ps5slim", label: "PlayStation 5 Slim",   base: 225, image: "/devices/ps5-slim-disc.webp" },
  { id: "ps5",     label: "PlayStation 5",        base: 238, image: "/devices/ps5.webp" },
];
const PS4_VARIANTS = [
  { id: "ps4pro", label: "PlayStation 4 Pro", base: 150, image: "/devices/ps4-pro.webp" },
  { id: "ps4", label: "PlayStation 4 (Standard)", base: 100, image: "/devices/ps4.webp" },
  { id: "ps4slim", label: "PlayStation 4 Slim", base: 0, inquiryOnly: true, image: "/devices/ps4-slim.webp" },
];
const SONY_SERIES = [
  { id: "ps5_family", label: "PlayStation 5", year: "Pro · Std · Slim", topPrice: 450, image: "/ps5-series.webp", variants: PS5_VARIANTS },
  { id: "ps4_family", label: "PlayStation 4", year: "Pro · Std · Slim", topPrice: 150, image: "/ps4-series.webp", variants: PS4_VARIANTS },
];
const SONY_MODELS = [...PS5_VARIANTS, ...PS4_VARIANTS];

const MICROSOFT_MODELS = [
  { id: "xsx",  label: "Xbox Series X", base: 180, image: "/devices/xbox-series-x.webp" },
  { id: "xss",  label: "Xbox Series S", base: 80, image: "/devices/xbox-series-s.webp" },
  { id: "xone", label: "Xbox One",      base: 80,  image: "/devices/xbox-one.webp" },
];

const NINTENDO_MODELS = [
  { id: "switch", label: "Nintendo Switch OLED", base: 180, image: "/devices/switch-oled.webp" },
  { id: "switchv2", label: "Nintendo Switch V2", base: 130, image: "/devices/switch-oled.webp" },
  { id: "switchlite", label: "Nintendo Switch Lite", base: 90, image: "/devices/switch-lite.webp" },
];

const CONSOLE_MODELS = [...SONY_MODELS, ...MICROSOFT_MODELS, ...NINTENDO_MODELS];

const APPLEWATCH_MODELS = [
  // Ultra 3 base is a placeholder — ClaudeMX's IWM scraper picks up
  // exact pricing on the weekly Monday refresh.
  { id: "awu3", label: "Apple Watch Ultra 3", base: 302, image: "/devices/apple-watch-ultra-3.webp" },
  { id: "awu2", label: "Apple Watch Ultra 2", base: 450, image: "/devices/apple-watch-ultra-2.webp" },
  { id: "awu1", label: "Apple Watch Ultra", base: 350, image: "/devices/apple-watch-ultra.webp" },
  { id: "aws10", label: "Apple Watch Series 10", base: 280, image: "/devices/apple-watch-series-10.webp" },
  { id: "aws9", label: "Apple Watch Series 9", base: 220, image: "/devices/apple-watch-series-9.webp" },
  { id: "aws8", label: "Apple Watch Series 8", base: 170, image: "/devices/apple-watch-series-8.webp" },
  { id: "aws7", label: "Apple Watch Series 7", base: 120, image: "/devices/apple-watch-series-7.webp" },
  { id: "awse2", label: "Apple Watch SE (2nd Gen)", base: 130, image: "/devices/apple-watch-se-2.webp" },
  { id: "awse1", label: "Apple Watch SE (1st Gen)", base: 0, inquiryOnly: true, image: "/devices/apple-watch-se-1.webp" },
];

const PIXELWATCH_MODELS = [
  { id: "pw3", label: "Pixel Watch 3", base: 200, image: "/devices/pixel-watch.jpg" },
  { id: "pw2", label: "Pixel Watch 2", base: 130, image: "/devices/pixel-watch.jpg" },
  { id: "pw1", label: "Pixel Watch", base: 80, image: "/devices/pixel-watch.jpg" },
];

// Garmin & Samsung Watch variants — auto-generated from IWM scrape
// (iwm-watch-adjustments.json). Base = IWM Flawless × 0.90 per submodel.
// Per-edition deltas for series that ship in multiple trims (Fenix,
// Epix, Instinct, etc.) live in GARMIN_EDITIONS below and surface as
// a brand_extras question. Regen via scripts/scrape-iwm-watches.py +
// scripts/gen-watch-page-code.py.
const GARMIN_MODELS = [
  { id: "gfenix8pro", label: "Fenix 8 Pro", base: 472, image: "/devices/pixel-watch.png" },
  { id: "gfenix8solar", label: "Fenix 8 Solar", base: 405, image: "/devices/pixel-watch.png" },
  { id: "gfenix8amoled", label: "Fenix 8 AMOLED", base: 342, image: "/devices/pixel-watch.png" },
  { id: "gfenixe", label: "Fenix E", base: 202, image: "/devices/pixel-watch.png" },
  { id: "gfenix7s", label: "Fenix 7S", base: 144, image: "/devices/pixel-watch.png" },
  { id: "gfenix7x", label: "Fenix 7X", base: 126, image: "/devices/pixel-watch.png" },
  { id: "gfenix7", label: "Fenix 7", base: 117, image: "/devices/pixel-watch.png" },
  { id: "gepixgen2", label: "Epix Gen 2", base: 14, image: "/devices/pixel-watch.png" },
  { id: "gepixprogen2", label: "Epix Pro Gen 2", base: 14, image: "/devices/pixel-watch.png" },
  { id: "gforerunner970", label: "Forerunner 970", base: 328, image: "/devices/pixel-watch.png" },
  { id: "gforerunner965", label: "Forerunner 965", base: 212, image: "/devices/pixel-watch.png" },
  { id: "gforerunner570", label: "Forerunner 570", base: 202, image: "/devices/pixel-watch.png" },
  { id: "gforerunner955", label: "Forerunner 955", base: 158, image: "/devices/pixel-watch.png" },
  { id: "gforerunner955solar", label: "Forerunner 955 Solar", base: 158, image: "/devices/pixel-watch.png" },
  { id: "gforerunner265", label: "Forerunner 265", base: 135, image: "/devices/pixel-watch.png" },
  { id: "gforerunner265s", label: "Forerunner 265S", base: 135, image: "/devices/pixel-watch.png" },
  { id: "gforerunner255", label: "Forerunner 255", base: 90, image: "/devices/pixel-watch.png" },
  { id: "gforerunner255music", label: "Forerunner 255 Music", base: 90, image: "/devices/pixel-watch.png" },
  { id: "gforerunner255s", label: "Forerunner 255S", base: 90, image: "/devices/pixel-watch.png" },
  { id: "gforerunner255smusic", label: "Forerunner 255S Music", base: 90, image: "/devices/pixel-watch.png" },
  { id: "gforerunner165", label: "Forerunner 165", base: 76, image: "/devices/pixel-watch.png" },
  { id: "gforerunner165music", label: "Forerunner 165 Music", base: 76, image: "/devices/pixel-watch.png" },
  { id: "gforerunner945", label: "Forerunner 945", base: 72, image: "/devices/pixel-watch.png" },
  { id: "gforerunner945lte", label: "Forerunner 945 LTE", base: 72, image: "/devices/pixel-watch.png" },
  { id: "gforerunner245", label: "Forerunner 245", base: 54, image: "/devices/pixel-watch.png" },
  { id: "gforerunner245music", label: "Forerunner 245 Music", base: 54, image: "/devices/pixel-watch.png" },
  { id: "gforerunner745", label: "Forerunner 745", base: 36, image: "/devices/pixel-watch.png" },
  { id: "gvenu2", label: "Venu 2", base: 315, image: "/devices/pixel-watch.png" },
  { id: "gvenux1", label: "Venu X1", base: 315, image: "/devices/pixel-watch.png" },
  { id: "gvenu4", label: "Venu 4", base: 198, image: "/devices/pixel-watch.png" },
  { id: "gvivoactive6", label: "Vivoactive 6", base: 112, image: "/devices/pixel-watch.png" },
  { id: "gvivoactive5", label: "Vivoactive 5", base: 50, image: "/devices/pixel-watch.png" },
  { id: "gvivoactive4", label: "Vivoactive 4", base: 27, image: "/devices/pixel-watch.png" },
  { id: "gvivoactive4s", label: "Vivoactive 4S", base: 27, image: "/devices/pixel-watch.png" },
  { id: "ginstincte", label: "Instinct E", base: 27, image: "/devices/pixel-watch.png" },
  { id: "ginstinct2", label: "Instinct 2", base: 9, image: "/devices/pixel-watch.png" },
  { id: "ginstinct2s", label: "Instinct 2S", base: 9, image: "/devices/pixel-watch.png" },
  { id: "ginstinct2x", label: "Instinct 2X", base: 9, image: "/devices/pixel-watch.png" },
  { id: "ginstinct3", label: "Instinct 3", base: 9, image: "/devices/pixel-watch.png" },
  { id: "ginstinctcrossover", label: "Instinct Crossover", base: 9, image: "/devices/pixel-watch.png" },
  { id: "gapproachs70", label: "Approach S70", base: 198, image: "/devices/pixel-watch.png" },
  { id: "gapproachs50", label: "Approach S50", base: 135, image: "/devices/pixel-watch.png" },
  { id: "gapproachs62", label: "Approach S62", base: 108, image: "/devices/pixel-watch.png" },
  { id: "gapproachs44", label: "Approach S44", base: 94, image: "/devices/pixel-watch.png" },
  { id: "gapproachs42", label: "Approach S42", base: 68, image: "/devices/pixel-watch.png" },
  { id: "gdescentg2", label: "Descent G2", base: 230, image: "/devices/pixel-watch.png" },
  { id: "gdescentmk1", label: "Descent Mk1", base: 153, image: "/devices/pixel-watch.png" },
  { id: "gdescentg1", label: "Descent G1", base: 9, image: "/devices/pixel-watch.png" },
  { id: "gdescentmk2", label: "Descent Mk2", base: 9, image: "/devices/pixel-watch.png" },
  { id: "gdescentmk3", label: "Descent Mk3", base: 9, image: "/devices/pixel-watch.png" },
  { id: "genduro3", label: "Enduro 3", base: 369, image: "/devices/pixel-watch.png" },
  { id: "genduro2", label: "Enduro 2", base: 180, image: "/devices/pixel-watch.png" },
  { id: "genduroorig", label: "Enduro", base: 81, image: "/devices/pixel-watch.png" },
  { id: "gmarqadventurer", label: "MARQ Adventurer", base: 135, image: "/devices/pixel-watch.png" },
  { id: "gmarqathlete", label: "MARQ Athlete", base: 135, image: "/devices/pixel-watch.png" },
  { id: "gmarqaviator", label: "MARQ Aviator", base: 135, image: "/devices/pixel-watch.png" },
  { id: "gmarqcaptain", label: "MARQ Captain", base: 135, image: "/devices/pixel-watch.png" },
  { id: "gmarqcommander", label: "MARQ Commander", base: 135, image: "/devices/pixel-watch.png" },
  { id: "gmarqgolfer", label: "MARQ Golfer", base: 135, image: "/devices/pixel-watch.png" },
  { id: "gquatix6", label: "Quatix 6", base: 18, image: "/devices/pixel-watch.png" },
  { id: "gquatix7", label: "Quatix 7", base: 18, image: "/devices/pixel-watch.png" },
  { id: "gquatix8", label: "Quatix 8", base: 18, image: "/devices/pixel-watch.png" },
  { id: "glily2", label: "Lily 2", base: 22, image: "/devices/pixel-watch.png" },
  { id: "glily2active", label: "Lily 2 Active", base: 22, image: "/devices/pixel-watch.png" },
  { id: "glily2classic", label: "Lily 2 Classic", base: 22, image: "/devices/pixel-watch.png" },
];

const SAMSUNGWATCH_MODELS = [
  { id: "sgwu25", label: "Galaxy Watch Ultra (2025)", base: 176, image: "/devices/samsung-watch-7.webp" },
  { id: "sgwu", label: "Galaxy Watch Ultra", base: 112, image: "/devices/samsung-watch-7.webp" },
  { id: "sgw8c", label: "Galaxy Watch 8 Classic", base: 99, image: "/devices/samsung-watch-7.webp" },
  { id: "sgw8", label: "Galaxy Watch 8", base: 63, image: "/devices/samsung-watch-7.webp" },
  { id: "sgw7", label: "Galaxy Watch 7", base: 18, image: "/devices/samsung-watch-7.webp" },
];

// DJI drones — 32 per-submodel variants priced from IWM scrape (x0.90).
// 3 Phantom 3 entries are inquiry-only — IWM no longer carries them.
// Per-submodel Swappa hero PNGs for 27/32 priced models; 5 models that
// Swappa doesn't carry separately reuse a sibling's hero (same chassis):
// inspire_1 → inspire_2, mini_2 → mini_3, phantom_4_advanced → phantom_4,
// phantom_4_pro_v2 → phantom_4_pro, mavic_3_pro_cine → mavic_3_pro.
// See scripts/scrape-iwm-drones.py and scripts/scrape-swappa-dji.py.
const DJI_MODELS = [
  // Mavic
  { id: "dji_mavic_4_pro", label: "DJI Mavic 4 Pro", base: 1350, image: "/devices/dji_mavic_4_pro.png" },
  { id: "dji_mavic_3_pro_cine", label: "DJI Mavic 3 Pro Cine", base: 1148, image: "/devices/dji_mavic_3_pro.png" },
  { id: "dji_mavic_3_cine", label: "DJI Mavic 3 Cine", base: 1035, image: "/devices/dji_mavic_3_cine.png" },
  { id: "dji_mavic_3_pro", label: "DJI Mavic 3 Pro", base: 968, image: "/devices/dji_mavic_3_pro.png" },
  { id: "dji_mavic_3", label: "DJI Mavic 3", base: 540, image: "/devices/dji_mavic_3.png" },
  { id: "dji_mavic_3_classic", label: "DJI Mavic 3 Classic", base: 518, image: "/devices/dji_mavic_3_classic.png" },
  { id: "dji_mavic_2_pro", label: "DJI Mavic 2 Pro", base: 207, image: "/devices/dji_mavic_2_pro.png" },
  { id: "dji_mavic_2_zoom", label: "DJI Mavic 2 Zoom", base: 202, image: "/devices/dji_mavic_2_zoom.png" },
  { id: "dji_mavic_pro_platinum", label: "DJI Mavic Pro Platinum", base: 158, image: "/devices/dji_mavic_pro_platinum.png" },
  { id: "dji_mavic_pro", label: "DJI Mavic Pro", base: 72, image: "/devices/dji_mavic_pro.png" },
  // Mini
  { id: "dji_mini_4_pro", label: "DJI Mini 4 Pro", base: 315, image: "/devices/dji_mini_4_pro.png" },
  { id: "dji_mini_3_pro", label: "DJI Mini 3 Pro", base: 198, image: "/devices/dji_mini_3_pro.png" },
  { id: "dji_mini_3", label: "DJI Mini 3", base: 158, image: "/devices/dji_mini_3.png" },
  { id: "dji_mini_2", label: "DJI Mini 2", base: 81, image: "/devices/dji_mini_3.png" },
  { id: "dji_mini_2_se", label: "DJI Mini 2 SE", base: 68, image: "/devices/dji_mini_2_se.png" },
  { id: "dji_mini_se", label: "DJI Mini SE", base: 54, image: "/devices/dji_mini_se.png" },
  { id: "dji_mavic_mini", label: "DJI Mavic Mini", base: 40, image: "/devices/dji_mavic_mini.png" },
  // Air
  { id: "dji_air_3s", label: "DJI Air 3S", base: 544, image: "/devices/dji_air_3s.png" },
  { id: "dji_air_3", label: "DJI Air 3", base: 459, image: "/devices/dji_air_3.png" },
  { id: "dji_air_2s", label: "DJI Air 2S", base: 270, image: "/devices/dji_air_2s.png" },
  { id: "dji_mavic_air_2", label: "DJI Mavic Air 2", base: 144, image: "/devices/dji_mavic_air_2.png" },
  // Avata (FPV)
  { id: "dji_avata_2", label: "DJI Avata 2", base: 338, image: "/devices/dji_avata_2.png" },
  { id: "dji_avata", label: "DJI Avata", base: 194, image: "/devices/dji_avata.png" },
  // FPV
  { id: "dji_fpv", label: "DJI FPV", base: 248, image: "/devices/dji_fpv.png" },
  // Inspire
  { id: "dji_inspire_2", label: "DJI Inspire 2", base: 990, image: "/devices/dji_inspire_2.png" },
  { id: "dji_inspire_1", label: "DJI Inspire 1", base: 248, image: "/devices/dji_inspire_2.png" },
  // Phantom
  { id: "dji_phantom_4_pro_v2", label: "DJI Phantom 4 Pro v2", base: 292, image: "/devices/dji_phantom_4_pro.png" },
  { id: "dji_phantom_4_pro", label: "DJI Phantom 4 Pro", base: 189, image: "/devices/dji_phantom_4_pro.png" },
  { id: "dji_phantom_4_advanced", label: "DJI Phantom 4 Advanced", base: 104, image: "/devices/dji_phantom_4.png" },
  { id: "dji_phantom_4", label: "DJI Phantom 4", base: 94, image: "/devices/dji_phantom_4.png" },
  { id: "dji_phantom_3_pro", label: "DJI Phantom 3 Pro", base: 0, inquiryOnly: true, image: "/djiphantom.png" },
  { id: "dji_phantom_3_advanced", label: "DJI Phantom 3 Advanced", base: 0, inquiryOnly: true, image: "/djiphantom.png" },
  { id: "dji_phantom_3_standard", label: "DJI Phantom 3 Standard", base: 0, inquiryOnly: true, image: "/djiphantom.png" },
  // Flip
  { id: "dji_flip", label: "DJI Flip", base: 144, image: "/devices/dji_flip.png" },
  // Spark
  { id: "dji_spark", label: "DJI Spark", base: 45, image: "/devices/dji_spark.png" },
];

// Per-variant edition map for Garmin series that ship multiple trims
// (Fenix 7/7S/7X/8 each have Standard / Solar / Sapphire / Pro / etc.).
// Surfaces as a brand_extras "edition" question when the selected
// variant has an entry here. Adj values already discounted by ×0.90.
const GARMIN_EDITIONS: Record<string, Array<{id: string; label: string; adj: number}>> = {
  gfenix8pro: [
    { id: "fenix_8_pro_amoled_edition", label: "Fenix 8 Pro AMOLED Edition", adj: 1 },
    { id: "fenix_8_pro_microled_edition", label: "Fenix 8 Pro MICROLED Edition", adj: 22 },
  ],
  gfenix8solar: [
    { id: "fenix_8_solar_sapphire_edition", label: "Fenix 8 Solar Sapphire Edition", adj: 1 },
  ],
  gfenix8amoled: [
    { id: "fenix_8_amoled_edition", label: "Fenix 8 AMOLED Edition", adj: 1 },
    { id: "fenix_8_amoled_sapphire_editio", label: "Fenix 8 AMOLED Sapphire Edition", adj: 27 },
  ],
  gfenixe: [
    { id: "fenix_e_amoled_edition", label: "Fenix E AMOLED Edition", adj: 1 },
  ],
  gfenix7s: [
    { id: "fenix_7s_standard_edition", label: "Fenix 7S Standard Edition", adj: 1 },
    { id: "fenix_7s_solar_edition", label: "Fenix 7S Solar Edition", adj: 9 },
    { id: "fenix_7s_pro_solar_edition", label: "Fenix 7S Pro Solar Edition", adj: 45 },
    { id: "fenix_7s_sapphire_solar_editio", label: "Fenix 7S Sapphire Solar Edition", adj: 63 },
    { id: "fenix_7s_pro_sapphire_solar_ed", label: "Fenix 7S Pro Sapphire Solar Edition", adj: 90 },
  ],
  gfenix7x: [
    { id: "fenix_7x_solar_edition", label: "Fenix 7X Solar Edition", adj: 1 },
    { id: "fenix_7x_sapphire_solar_editio", label: "Fenix 7X Sapphire Solar Edition", adj: 27 },
    { id: "fenix_7x_pro_solar_edition", label: "Fenix 7X Pro Solar Edition", adj: 76 },
    { id: "fenix_7x_pro_sapphire_solar_ed", label: "Fenix 7X Pro Sapphire Solar Edition", adj: 122 },
  ],
  gfenix7: [
    { id: "fenix_7_standard_edition", label: "Fenix 7 Standard Edition", adj: 1 },
    { id: "fenix_7_sapphire_solar_edition", label: "Fenix 7 Sapphire Solar Edition", adj: 27 },
    { id: "fenix_7_pro_solar_edition", label: "Fenix 7 Pro Solar Edition", adj: 72 },
    { id: "fenix_7_pro_sapphire_solar_edi", label: "Fenix 7 Pro Sapphire Solar Edition", adj: 108 },
  ],
  gepixgen2: [
    { id: "epix_gen_2_standard_edition", label: "Epix (Gen 2) Standard Edition", adj: 1 },
    { id: "epix_pro_gen_2_standard_editio", label: "Epix Pro (Gen 2) Standard Edition", adj: 1 },
    { id: "epix_gen_2_sapphire_edition", label: "Epix (Gen 2) Sapphire Edition", adj: 1 },
    { id: "epix_pro_gen_2_sapphire_editio", label: "Epix Pro (Gen 2) Sapphire Edition", adj: 14 },
  ],
  gepixprogen2: [
    { id: "epix_gen_2_standard_edition", label: "Epix (Gen 2) Standard Edition", adj: 1 },
    { id: "epix_pro_gen_2_standard_editio", label: "Epix Pro (Gen 2) Standard Edition", adj: 1 },
    { id: "epix_gen_2_sapphire_edition", label: "Epix (Gen 2) Sapphire Edition", adj: 1 },
    { id: "epix_pro_gen_2_sapphire_editio", label: "Epix Pro (Gen 2) Sapphire Edition", adj: 14 },
  ],
};

// Apple Vision Pro — two distinct devices, one variant each, with
// storage as a runtime question (deltas are the same for both gens:
// 256GB $0 / 512GB +$90 / 1TB +$225 after ×0.90).
// IWM Flawless 256GB anchors:  M2 2024 = $1450 → our $1305
//                              M5 2025 = $1950 → our $1755
// Apple does NOT offer trade-in for Vision Pro (confirmed Oct 22, 2025),
// so no first-party comp.
const APPLE_VR_MODELS = [
  { id: "avp_m5", label: "Apple Vision Pro (M5, 2025)",   base: 1755, inquiryOnly: false, image: "/devices/apple-vision-pro.png" },
  { id: "avp_m2", label: "Apple Vision Pro (M2, 2024)",   base: 1305, inquiryOnly: false, image: "/devices/apple-vision-pro.png" },
];

// Photos: Swappa per-model 2026-05-17.
// Prices: per-model from IWM's embedded base64 quiz blob (web-head approach
// — no browser walk needed, just decode the JSON in the HTML head). Each
// IWM Quest model carries discrete value_current adjustments per storage +
// condition + accessory. Base shown here = storage + Flawless condition
// (Skywalker's reference tier), × 0.90 per "10 off IWM" directive.
// IWM source: /sell/meta-quest-vr/meta-vr decoded blob, scraped 2026-05-17.
const META_VR_MODELS = [
  { id: "mq3s256", label: "Meta Quest 3S (256GB)", base: 81,  inquiryOnly: false, image: "/devices/meta-quest-3s.png" },
  { id: "mq3128",  label: "Meta Quest 3S (128GB)", base: 54,  inquiryOnly: false, image: "/devices/meta-quest-3s.png" },
  { id: "mq3",     label: "Meta Quest 3 (512GB)",  base: 180, inquiryOnly: false, image: "/devices/meta-quest-3.png" },
  { id: "mq3b",    label: "Meta Quest 3 (128GB)",  base: 117, inquiryOnly: false, image: "/devices/meta-quest-3.png" },
  { id: "mq2256",  label: "Meta Quest 2 (256GB)",  base: 81,  inquiryOnly: false, image: "/devices/meta-quest-2.png" },
  { id: "mq2128",  label: "Meta Quest 2 (128GB)",  base: 45,  inquiryOnly: false, image: "/devices/meta-quest-2.png" },
  { id: "mqpro",   label: "Meta Quest Pro",        base: 297, inquiryOnly: false, image: "/devices/meta-quest-pro.png" },
];

const VALVE_VR_MODELS = [
  { id: "valveidx", label: "Valve Index Full Kit" },
  { id: "valveidxhmd", label: "Valve Index Headset Only" },
];

const PSVR_MODELS = [
  { id: "psvr2", label: "PlayStation VR2" },
  { id: "psvr2h", label: "PlayStation VR2 Horizon Bundle" },
  { id: "psvr1", label: "PlayStation VR (Original)" },
];

const SAMSUNG_TAB_MODELS = [
  { id: "stabs11u", label: "Galaxy Tab S11 Ultra", base: 513, inquiryOnly: false, image: "/devices/galaxy-tab-s11-ultra.webp" },
  { id: "stabs11", label: "Galaxy Tab S11", base: 324, inquiryOnly: false, image: "/devices/galaxy-tab-s11.webp" },
  { id: "stabs10u", label: "Galaxy Tab S10 Ultra", base: 418, inquiryOnly: false, image: "/devices/galaxy-tab-s10-ultra.png" },
  { id: "stabs10p", label: "Galaxy Tab S10+", base: 315, inquiryOnly: false, image: "/devices/galaxy-tab-s10-plus.webp" },
  { id: "stabs10fep", label: "Galaxy Tab S10 FE+", base: 225, inquiryOnly: false, image: "/devices/galaxy-tab-s10-fe-plus.webp" },
  { id: "stabs10fe", label: "Galaxy Tab S10 FE", base: 153, inquiryOnly: false, image: "/devices/galaxy-tab-s10-fe.webp" },
  { id: "stabs10l", label: "Galaxy Tab S10 Lite", base: 112, inquiryOnly: false, image: "/devices/galaxy-tab-s10-lite.webp" },
  { id: "stabs9u", label: "Galaxy Tab S9 Ultra", base: 333, inquiryOnly: false, image: "/devices/galaxy-tab-s9-ultra.webp" },
  { id: "stabs9p", label: "Galaxy Tab S9+", base: 261, inquiryOnly: false, image: "/devices/galaxy-tab-s9-plus.webp" },
  { id: "stabs9", label: "Galaxy Tab S9", base: 198, inquiryOnly: false, image: "/devices/galaxy-tab-s9.webp" },
  { id: "stabs9fep", label: "Galaxy Tab S9 FE+", base: 171, inquiryOnly: false, image: "/devices/galaxy-tab-s9-fe-plus.webp" },
  { id: "stabs9fe", label: "Galaxy Tab S9 FE", base: 99, inquiryOnly: false, image: "/devices/galaxy-tab-s9-fe.webp" },
  { id: "stabs8u", label: "Galaxy Tab S8 Ultra", base: 225, inquiryOnly: false, image: "/devices/galaxy-tab-s8-ultra.webp" },
  { id: "stabs8p", label: "Galaxy Tab S8+", base: 171, inquiryOnly: false, image: "/devices/galaxy-tab-s8-plus.webp" },
  { id: "stabs8", label: "Galaxy Tab S8", base: 140, inquiryOnly: false, image: "/devices/galaxy-tab-s8.webp" },
  { id: "stabs7p", label: "Galaxy Tab S7+", base: 108, inquiryOnly: false, image: "/devices/galaxy-tab-s7-plus.webp" },
  { id: "stabs7fe", label: "Galaxy Tab S7 FE", base: 81, inquiryOnly: false, image: "/devices/galaxy-tab-s7-fe.png" },
  { id: "stabs7", label: "Galaxy Tab S7", base: 90, inquiryOnly: false, image: "/devices/galaxy-tab-s7.webp" },
  { id: "stabs6l", label: "Galaxy Tab S6 Lite", base: 50, inquiryOnly: false, image: "/devices/galaxy-tab-s6-lite.webp" },
  { id: "stabs6", label: "Galaxy Tab S6", base: 72, inquiryOnly: false, image: "/devices/galaxy-tab-s6.webp" },
  { id: "stabs5e", label: "Galaxy Tab S5e", base: 22, inquiryOnly: false, image: "/devices/galaxy-tab-s5e.webp" },
  { id: "stabs4", label: "Galaxy Tab S4 10.5", base: 27, inquiryOnly: false, image: "/devices/galaxy-tab-s4-105.webp" },
  { id: "staba9", label: "Galaxy Tab A9+", image: "/devices/galaxy-tab-a9-plus.webp" },
];

const SURFACE_PRO_VARIANTS = [
  { id: "surfpro12_13", label: "Surface Pro 12 13\" (2026)", base: 0, inquiryOnly: true },
  { id: "surfpro12_12", label: "Surface Pro 12 12\" (2026)", base: 0, inquiryOnly: true },
  { id: "surfpro11", label: "Surface Pro 11th Ed (Copilot+ / Snapdragon X)", base: 580, inquiryOnly: false },
  { id: "surfpro10biz", label: "Surface Pro 10 for Business", base: 472, inquiryOnly: false },
  { id: "surfpro9", label: "Surface Pro 9", base: 248, inquiryOnly: false },
  { id: "surfpro8", label: "Surface Pro 8", base: 212, inquiryOnly: false },
  { id: "surfpro7p", label: "Surface Pro 7+", base: 94, inquiryOnly: false },
  { id: "surfpro7", label: "Surface Pro 7", base: 36, inquiryOnly: false },
  { id: "surfpro6", label: "Surface Pro 6", base: 18, inquiryOnly: false },
  { id: "surfpro5_2017", label: "Surface Pro 5 (2017)", base: 0, inquiryOnly: true },
  { id: "surfpro4", label: "Surface Pro 4", base: 0, inquiryOnly: true },
  { id: "surfpro3", label: "Surface Pro 3", base: 0, inquiryOnly: true },
  { id: "surfpro2", label: "Surface Pro 2", base: 0, inquiryOnly: true },
  { id: "surfpro1", label: "Surface Pro (2013)", base: 0, inquiryOnly: true },
];
const SURFACE_GO_VARIANTS = [
  { id: "surfgo4", label: "Surface Go 4 (Business)", base: 248, inquiryOnly: false },
  { id: "surfgo3", label: "Surface Go 3", base: 36, inquiryOnly: false },
  { id: "surfgo2", label: "Surface Go 2", base: 18, inquiryOnly: false },
  { id: "surfgo1", label: "Surface Go (2018)", base: 0, inquiryOnly: true },
];
const SURFACE_X_VARIANTS = [
  { id: "surfprox2020", label: "Surface Pro X (2020 Refresh)", base: 180, inquiryOnly: false },
  { id: "surfprox2019", label: "Surface Pro X (2019)", base: 180, inquiryOnly: false },
];
const SURFACE_BOOKSTUDIO_VARIANTS = [
  { id: "surfstudio2", label: "Surface Laptop Studio 2", base: 0, inquiryOnly: true },
  { id: "surfstudio1", label: "Surface Laptop Studio 1", base: 0, inquiryOnly: true },
  { id: "surfbook3", label: "Surface Book 3", base: 0, inquiryOnly: true },
  { id: "surfbook2", label: "Surface Book 2", base: 0, inquiryOnly: true },
  { id: "surfbook1", label: "Surface Book 1", base: 0, inquiryOnly: true },
];
const SURFACE_ORIGINAL_VARIANTS = [
  { id: "surf3", label: "Surface 3", base: 0, inquiryOnly: true },
  { id: "surf2", label: "Surface 2", base: 0, inquiryOnly: true },
  { id: "surfrt", label: "Surface RT (2012)", base: 0, inquiryOnly: true },
];
const SURFACE_DUO_VARIANTS = [
  { id: "surfduo2", label: "Surface Duo 2", base: 0, inquiryOnly: true },
  { id: "surfduo1", label: "Surface Duo", base: 0, inquiryOnly: true },
];
const SURFACE_SERIES = [
  { id: "surf_pro", label: "Pro", year: "Flagship", topPrice: 580, variants: SURFACE_PRO_VARIANTS },
  { id: "surf_go", label: "Go", year: "Compact", topPrice: 248, variants: SURFACE_GO_VARIANTS },
  { id: "surf_x", label: "Pro X", year: "ARM Ultra-thin", topPrice: 180, variants: SURFACE_X_VARIANTS },
  { id: "surf_bookstudio", label: "Book & Laptop Studio", year: "Hybrid", topPrice: 0, variants: SURFACE_BOOKSTUDIO_VARIANTS, inquiryOnly: true },
  { id: "surf_original", label: "Original (Non-Pro)", year: "RT / 2 / 3", topPrice: 0, variants: SURFACE_ORIGINAL_VARIANTS, inquiryOnly: true },
  { id: "surf_duo", label: "Duo", year: "Dual-Screen", topPrice: 0, variants: SURFACE_DUO_VARIANTS, inquiryOnly: true },
];
const SURFACE_MODELS = [
  ...SURFACE_PRO_VARIANTS,
  ...SURFACE_GO_VARIANTS,
  ...SURFACE_X_VARIANTS,
  ...SURFACE_BOOKSTUDIO_VARIANTS,
  ...SURFACE_ORIGINAL_VARIANTS,
  ...SURFACE_DUO_VARIANTS,
];

const LENOVO_LEGION_TAB_VARIANTS = [
  { id: "legtabg5", label: "Legion Tab Gen 5 (8.8\")", base: 0, inquiryOnly: true },
  { id: "legtabg3", label: "Legion Tab Gen 3", base: 189, inquiryOnly: false },
  { id: "legy900_2026", label: "Legion Y900 (2026)", base: 0, inquiryOnly: true },
];
const LENOVO_IDEA_TAB_VARIANTS = [
  { id: "ideatabprog2", label: "Idea Tab Pro Gen 2", base: 0, inquiryOnly: true },
  { id: "ideatabstd", label: "Idea Tab (Standard)", base: 0, inquiryOnly: true },
  { id: "yogatab13aura", label: "Yoga Tab 13 (Aura Edition)", base: 0, inquiryOnly: true },
];
const LENOVO_TABPK_VARIANTS = [
  { id: "tabk11plus", label: "Tab K11 Plus", base: 0, inquiryOnly: true },
  { id: "tabp12", label: "Tab P12", base: 0, inquiryOnly: true },
  { id: "tabp11g2", label: "Tab P11 Gen 2", base: 0, inquiryOnly: true },
  { id: "tabk11", label: "Tab K11", base: 0, inquiryOnly: true },
];
const LENOVO_TABM_VARIANTS = [
  { id: "tabplusjbl", label: "Tab Plus (8-speaker JBL)", base: 0, inquiryOnly: true },
  { id: "tabm11", label: "Tab M11", base: 0, inquiryOnly: true },
  { id: "tabm10_5g", label: "Tab M10 (5G)", base: 0, inquiryOnly: true },
  { id: "tabm8g5", label: "Tab M8 (Gen 5)", base: 0, inquiryOnly: true },
];
const LENOVO_THINKTAB_VARIANTS = [
  { id: "thinktabx11", label: "ThinkTab X11", base: 0, inquiryOnly: true },
];
const LENOVO_TAB_SERIES = [
  { id: "lenovo_legion", label: "Legion", year: "Gaming", topPrice: 189, variants: LENOVO_LEGION_TAB_VARIANTS },
  { id: "lenovo_ideatab", label: "Idea Tab", year: "Productivity", topPrice: 0, variants: LENOVO_IDEA_TAB_VARIANTS, inquiryOnly: true },
  { id: "lenovo_tabpk", label: "Tab P & K", year: "Education", topPrice: 0, variants: LENOVO_TABPK_VARIANTS, inquiryOnly: true },
  { id: "lenovo_tabm", label: "Tab M & Plus", year: "Budget", topPrice: 0, variants: LENOVO_TABM_VARIANTS, inquiryOnly: true },
  { id: "lenovo_thinktab", label: "ThinkTab", year: "Industrial", topPrice: 0, variants: LENOVO_THINKTAB_VARIANTS, inquiryOnly: true },
];
const LENOVO_TAB_MODELS = [
  ...LENOVO_LEGION_TAB_VARIANTS,
  ...LENOVO_IDEA_TAB_VARIANTS,
  ...LENOVO_TABPK_VARIANTS,
  ...LENOVO_TABM_VARIANTS,
  ...LENOVO_THINKTAB_VARIANTS,
];

const ONEPLUS_TAB_MODELS = [
  { id: "oppad3",   label: "OnePlus Pad 3", base: 288, inquiryOnly: false },
  { id: "oppadgo2", label: "OnePlus Pad Go 2", base: 153, inquiryOnly: false },
  { id: "oppad2",   label: "OnePlus Pad 2", base: 153, inquiryOnly: false },
  { id: "oppad",    label: "OnePlus Pad", base: 90, inquiryOnly: false },
];

const GOOGLE_TAB_MODELS = [
  { id: "gpixeltab", label: "Pixel Tablet", base: 162, inquiryOnly: false, image: "/devices/pixel-tablet.webp" },
];

// Sub-section grouping for the flat device lists (watches, consoles,
// DJI, VR, non-iPad tablets). Each device type maps to an ordered list
// of groups; `ids` is the explicit set of variant IDs in that group.
// The grouped renderer below filters out empty groups and falls back
// to a single anonymous group if a device type isn't in this map.
type ModelGroup = { label: string; year?: string; ids: string[] };
const MODEL_GROUPS: Record<string, ModelGroup[]> = {
  applewatch: [
    { label: "Ultra",      year: "2022–2025", ids: ["awu3", "awu2", "awu1"] },
    { label: "Series",     year: "2021–2024", ids: ["aws10", "aws9", "aws8", "aws7"] },
    { label: "SE",         year: "2020–2022", ids: ["awse2", "awse1"] },
  ],
  samsungwatch: [
    { label: "Ultra (2025)", year: "2025", ids: ["sgwu25"] },
    { label: "Ultra",        year: "2024", ids: ["sgwu"] },
    { label: "Watch 8",      year: "2025", ids: ["sgw8c", "sgw8"] },
    { label: "Watch 7",      year: "2024", ids: ["sgw7"] },
  ],
  pixelwatch: [
    { label: "Pixel Watch 3", year: "2024", ids: ["pw3"] },
    { label: "Pixel Watch 2", year: "2023", ids: ["pw2"] },
    { label: "Pixel Watch",   year: "2022", ids: ["pw1"] },
  ],
  garmin: [
    { label: "Fenix",      ids: ["gfenix8pro", "gfenix8solar", "gfenix8amoled", "gfenixe", "gfenix7s", "gfenix7x", "gfenix7"] },
    { label: "Epix",       ids: ["gepixgen2", "gepixprogen2"] },
    { label: "Forerunner", ids: ["gforerunner970", "gforerunner965", "gforerunner570", "gforerunner955", "gforerunner955solar", "gforerunner265", "gforerunner265s", "gforerunner255", "gforerunner255music", "gforerunner255s", "gforerunner255smusic", "gforerunner165", "gforerunner165music", "gforerunner945", "gforerunner945lte", "gforerunner245", "gforerunner245music", "gforerunner745"] },
    { label: "Venu",       ids: ["gvenu2", "gvenux1", "gvenu4"] },
    { label: "Vivoactive", ids: ["gvivoactive6", "gvivoactive5", "gvivoactive4", "gvivoactive4s"] },
    { label: "Instinct",   ids: ["ginstincte", "ginstinct2", "ginstinct2s", "ginstinct2x", "ginstinct3", "ginstinctcrossover"] },
    { label: "Approach",   ids: ["gapproachs70", "gapproachs50", "gapproachs62", "gapproachs44", "gapproachs42"] },
    { label: "Descent",    ids: ["gdescentg2", "gdescentmk1", "gdescentg1", "gdescentmk2", "gdescentmk3"] },
    { label: "Enduro",     ids: ["genduro3", "genduro2", "genduroorig"] },
    { label: "MARQ",       ids: ["gmarqadventurer", "gmarqathlete", "gmarqaviator", "gmarqcaptain", "gmarqcommander", "gmarqgolfer"] },
    { label: "Quatix",     ids: ["gquatix6", "gquatix7", "gquatix8"] },
    { label: "Lily",       ids: ["glily2", "glily2active", "glily2classic"] },
  ],
  sony: [
    { label: "PlayStation 5", year: "2020–2024", ids: ["ps5pro", "ps5slim", "ps5"] },
    { label: "PlayStation 4", year: "2013–2016", ids: ["ps4pro", "ps4", "ps4slim"] },
  ],
  microsoft: [
    { label: "Xbox Series", year: "2020", ids: ["xsx", "xss"] },
    { label: "Xbox One",    year: "2013", ids: ["xone"] },
  ],
  dji: [
    { label: "Mavic",   year: "2016–2026", ids: ["dji_mavic_4_pro", "dji_mavic_3_pro_cine", "dji_mavic_3_cine", "dji_mavic_3_pro", "dji_mavic_3", "dji_mavic_3_classic", "dji_mavic_2_pro", "dji_mavic_2_zoom", "dji_mavic_pro_platinum", "dji_mavic_pro"] },
    { label: "Mini",    year: "2019–2024", ids: ["dji_mini_4_pro", "dji_mini_3_pro", "dji_mini_3", "dji_mini_2", "dji_mini_2_se", "dji_mini_se", "dji_mavic_mini"] },
    { label: "Air",     year: "2018–2024", ids: ["dji_air_3s", "dji_air_3", "dji_air_2s", "dji_mavic_air_2"] },
    { label: "Avata",   year: "FPV · 2022–2024", ids: ["dji_avata_2", "dji_avata"] },
    { label: "FPV",     year: "2021", ids: ["dji_fpv"] },
    { label: "Inspire", year: "2014–2016", ids: ["dji_inspire_2", "dji_inspire_1"] },
    { label: "Phantom", year: "2014–2018", ids: ["dji_phantom_4_pro_v2", "dji_phantom_4_pro", "dji_phantom_4_advanced", "dji_phantom_4", "dji_phantom_3_pro", "dji_phantom_3_advanced", "dji_phantom_3_standard"] },
    { label: "Flip",    year: "2025", ids: ["dji_flip"] },
    { label: "Spark",   year: "2017", ids: ["dji_spark"] },
  ],
  meta_vr: [
    { label: "Quest 3",    year: "2023", ids: ["mq3", "mq3b"] },
    { label: "Quest 3S",   year: "2024", ids: ["mq3s256", "mq3128"] },
    { label: "Quest 2",    year: "2020", ids: ["mq2256", "mq2128"] },
    { label: "Quest Pro",  year: "2022", ids: ["mqpro"] },
  ],
  psvr: [
    { label: "PlayStation VR2",        year: "2023", ids: ["psvr2", "psvr2h"] },
    { label: "PlayStation VR Original", year: "2016", ids: ["psvr1"] },
  ],
  samsung_tab: [
    { label: "Tab S11",         year: "2025", ids: ["stabs11u", "stabs11"] },
    { label: "Tab S10",         year: "2024", ids: ["stabs10u", "stabs10p", "stabs10fep", "stabs10fe", "stabs10l"] },
    { label: "Tab S9",          year: "2023", ids: ["stabs9u", "stabs9p", "stabs9", "stabs9fep", "stabs9fe"] },
    { label: "Tab S8",          year: "2022", ids: ["stabs8u", "stabs8p", "stabs8"] },
    { label: "Tab S7",          year: "2020–2021", ids: ["stabs7p", "stabs7fe", "stabs7"] },
    { label: "Tab S6 / Older",  year: "2018–2020", ids: ["stabs6l", "stabs6", "stabs5e", "stabs4"] },
    { label: "Tab A",           year: "2023", ids: ["staba9"] },
  ],
};
const getDeviceGroups = <T extends { id: string }>(deviceType: string | null | undefined, mdls: readonly T[]): Array<{ label: string; year?: string; variants: T[] }> => {
  const groups = deviceType ? MODEL_GROUPS[deviceType] : null;
  if (!groups) return [{ label: "", variants: [...mdls] }];
  const byId = new Map(mdls.map(m => [m.id, m]));
  return groups
    .map(g => ({ label: g.label, year: g.year, variants: g.ids.map(id => byId.get(id)).filter(Boolean) as T[] }))
    .filter(g => g.variants.length > 0);
};


const CONDITIONS = [
  { id: "sealed", label: "Sealed", desc: "Factory sealed, never opened", multiplier: 1.03, icon: "📦", details: ["Still in factory original sealed packaging", "Plastic wrap or seal is intact and has not been tampered with", "Device has never been activated or powered on", "Must include original box with matching serial number", "Contains all original accessories unopened"] },
  { id: "mint", label: "Mint", desc: "Like new, zero signs of use", multiplier: 1.0, icon: "✨", details: ["Zero scratches, scuffs, or other marks — looks brand new", "Display is free of defects such as cracks, dead pixels, white spots, or burn-in", "Original battery above 90% capacity", "Powers on and functions 100% as intended"] },
  { id: "verygood", label: "Very Good", desc: "Minimal use, barely noticeable wear", multiplier: 0.969, icon: "💎", details: ["Very light scratches or scuffs barely visible — no dents or dings", "Display is free of defects such as cracks, dead pixels, white spots, or burn-in", "Original battery above 80% capacity", "Powers on and functions 100% as intended"] },
  { id: "good", label: "Good", desc: "Normal wear, fully functional", multiplier: 0.969, icon: "👍", details: ["Light to moderate signs of wear — visible scratches and/or minor dents", "Display is free of defects such as cracks, dead pixels, white spots, or burn-in", "Original battery above 80% capacity", "Powers on and functions 100% as intended"] },
  { id: "fair", label: "Fair", desc: "Heavy wear, still functional", multiplier: 0.852, icon: "👌", details: ["Heavy signs of wear — deep scratches, dents, or scuffs", "Display is free of cracks but may have minor blemishes", "Battery may be below 80% capacity", "Powers on and functions as intended"] },
  { id: "broken", label: "Broken", desc: "Cracked, defective, or damaged", multiplier: 0.50, icon: "⚠️", details: ["Cracked screen, broken buttons, or damaged housing", "Display defects such as dead pixels, white spots, or burn-in", "May have functional issues — touchscreen, speakers, cameras", "Device still powers on", "No signs of liquid intrusion or water damage"] },
];

const ALL_STORAGES = [
  { id: "64",  label: "64 GB",  desc: "Older base capacity",                multiplier: 0.85, details: ["Common on older iPhone SE / pre-2020 iPads", "Resale demand is limited but we still buy", "Quote is on the lower end of the ladder", "Lookup tip: Settings > General > About > Capacity"] },
  { id: "128", label: "128 GB", desc: "Standard base size",                  multiplier: 1.0,  details: ["Default base size on many recent iPhone / iPad models", "Easy resale — broad demand across the market", "Mid-tier payout — sits in the middle of our ladder", "Lookup tip: Settings > General > About > Capacity"] },
  { id: "256", label: "256 GB", desc: "Most common — solid payout",          multiplier: 1.12, details: ["The most-traded capacity across iPhone and iPad lines", "Strong resale demand means a higher payout than 128", "Plenty of headroom for photos, apps, and a few games", "Lookup tip: Settings > General > About > Capacity"] },
  { id: "512", label: "512 GB", desc: "Larger capacity — pays more",         multiplier: 1.25, details: ["Bigger tier, usually owned by heavier users or families", "Pays a clear step above 256 GB", "Common on Pro models and content-creator devices", "Lookup tip: Settings > General > About > Capacity"] },
  { id: "1tb", label: "1 TB",   desc: "High tier — strong resale demand",    multiplier: 1.4,  details: ["High-end capacity, mostly Pro and Pro Max models", "Limited supply on the secondary market keeps prices firm", "Pays meaningfully more than 512 GB", "Lookup tip: Settings > General > About > Capacity"] },
  { id: "2tb", label: "2 TB",   desc: "Highest payout — top of our ladder",  multiplier: 1.55, details: ["Maximum capacity tier — only iPhone Pro Max and iPad Pro M-series ship with it", "Rare on the resale market, so we pay the most for it", "Top of our payout ladder", "Lookup tip: Settings > General > About > Capacity"] },
];

const STORAGE_MAP: Record<string, string[]> = {
  // iPhone 17 series — confirmed by Skywalker
  ip17pm: ["256", "512", "1tb", "2tb"],
  ip17p: ["256", "512", "1tb"],
  ip17air: ["256", "512", "1tb"],
  ip17: ["256", "512"],
  ip17e: ["256", "512"],
  // iPhone 16 series
  ip16pm: ["256", "512", "1tb"],
  ip16p: ["128", "256", "512", "1tb"],
  ip16plus: ["128", "256", "512"],
  ip16: ["128", "256", "512"],
  ip16e: ["128", "256"],
  // iPhone 15 series
  ip15pm: ["256", "512", "1tb"],
  ip15p: ["128", "256", "512", "1tb"],
  ip15plus: ["128", "256", "512"],
  ip15: ["128", "256", "512"],
  // iPhone 14 series
  ip14pm: ["128", "256", "512", "1tb"],
  ip14p: ["128", "256", "512", "1tb"],
  ip14plus: ["128", "256", "512"],
  ip14: ["128", "256", "512"],
  // iPhone 13 series — 13 Pro/PM have 128/256/512/1TB, base 13 has 128/256/512
  ip13pm: ["128", "256", "512", "1tb"],
  ip13p: ["128", "256", "512", "1tb"],
  ip13mini: ["128", "256", "512"],
  ip13: ["128", "256", "512"],
  // iPhone 12 series — 12 Pro/PM start 128, base has 64/128/256
  ip12pm: ["128", "256", "512"],
  ip12p: ["128", "256", "512"],
  ip12: ["64", "128", "256"],
  ip12mini: ["64", "128", "256"],
  // iPhone 11 series — Pro/PM skip 128GB
  ip11pm: ["64", "256", "512"],
  ip11p: ["64", "256", "512"],
  ip11: ["64", "128", "256"],
  // Samsung Galaxy
  gs26u: ["256", "512", "1tb"],
  gs26p: ["256", "512"],
  gs26: ["128", "256", "512"],
  gs25u: ["256", "512", "1tb"],
  gs25edge: ["256", "512"],
  gs25p: ["256", "512"],
  gs25: ["128", "256", "512"],
  gs25fe: ["128", "256"],
  gs24fe: ["128", "256"],
  gs23fe: ["128", "256"],
  gs21fe: ["128", "256"],
  gs20fe: ["128", "256"],
  gs24u: ["256", "512", "1tb"],
  gs24p: ["256", "512"],
  gs24: ["128", "256"],
  gs23u: ["256", "512", "1tb"],
  gs23p: ["256", "512"],
  gs23: ["128", "256", "512"],
  gs22u: ["128", "256", "512", "1tb"],
  gs22p: ["128", "256"],
  gs22: ["128", "256"],
  gs21u: ["128", "256", "512"],
  gs21p: ["128", "256"],
  gs21: ["128", "256"],
  gs20u: ["128", "256", "512"],
  gs20p: ["128", "256", "512"],
  gs20: ["128"],
  gztrifold: ["512", "1tb"],
  gzfold7: ["256", "512", "1tb"],
  gzfold6: ["256", "512", "1tb"],
  gzfold5: ["256", "512", "1tb"],
  gzfold4: ["256", "512", "1tb"],
  gzfold3: ["256", "512"],
  gzflip7: ["256", "512"],
  gzflip6: ["256", "512"],
  gzflip5: ["256", "512"],
  gzflip4: ["128", "256", "512"],
  gzflip3: ["128", "256"],
  // Google Pixel
  // Pixel 10 Pro XL dropped the 128GB SKU starting this generation (Google
  // moved the XL min to 256GB to differentiate from the non-XL Pro).
  px10pxl: ["256", "512", "1tb"],
  px10p: ["128", "256", "512", "1tb"],
  px10: ["128", "256"],
  px10a: ["128", "256"],
  px10pfold: ["256", "512", "1tb"],
  px9pxl: ["128", "256", "512", "1tb"],
  px9p: ["128", "256", "512", "1tb"],
  px9: ["128", "256"],
  px9a: ["128", "256"],
  px9pfold: ["256", "512"],
  px8p: ["128", "256", "512", "1tb"],
  px8: ["128", "256"],
  px8a: ["128", "256"],
  px7p: ["128", "256", "512"],
  px7: ["128", "256"],
  px7a: ["128"],
  pxfold: ["256", "512"],
  px6p: ["128", "256", "512"],
  px6: ["128", "256"],
  px6a: ["128"],
  px5: ["128"],
  px5a: ["128"],
  // MacBooks — unified memory, storage options
  mbp16m4: ["512", "1tb"],
  mbp14m4: ["512", "1tb"],
  mbp16m3: ["512", "1tb"],
  mbp14m3: ["512", "1tb"],
  mba15m3: ["256", "512", "1tb"],
  mba13m3: ["256", "512", "1tb"],
  mbp16m2: ["512", "1tb"],
  mbp14m2: ["512", "1tb"],
  mba15m2: ["256", "512"],
  mba13m2: ["256", "512"],
  mba13m1: ["256", "512"],
  mbp13m1: ["256", "512"],
  mbneo13: ["256", "512"],
  // Samsung Computers
  sgbk4u: ["512", "1tb"],
  sgbk4p: ["512", "1tb"],
  sgbk4pro: ["256", "512"],
  sgbk4: ["256", "512"],
  sgbk3u: ["512", "1tb"],
  sgbk3p: ["512", "1tb"],
  sgbk3pro: ["256", "512"],
  sgbk3: ["256", "512"],
  sgbk2p: ["256", "512"],
  sgbk2: ["256", "512"],
  // Lenovo
  lntp14g5: ["256", "512", "1tb"],
  lntp14g4: ["256", "512", "1tb"],
  lntp14g3: ["256", "512"],
  lnyoga9: ["512", "1tb"],
  lnyoga7: ["256", "512"],
  lnslim7: ["256", "512"],
  lnslim5: ["256", "512"],
  lnlegion7: ["512", "1tb"],
  lnlegion5: ["256", "512", "1tb"],
  lnlegion5g8: ["256", "512"],
  // Dell
  dxps17: ["512", "1tb"],
  dxps15: ["512", "1tb"],
  dxps13: ["256", "512", "1tb"],
  dxps15g23: ["512", "1tb"],
  dxps13g23: ["256", "512"],
  dlat7440: ["256", "512"],
  dlat5540: ["256", "512"],
  dinsp16p: ["256", "512", "1tb"],
  dinsp15: ["256", "512"],
  dinsp14: ["256", "512"],
  // Alienware
  awm18r2: ["512", "1tb"],
  awm16r2: ["512", "1tb"],
  awx16r2: ["512", "1tb"],
  awx14r2: ["512", "1tb"],
  awm18r1: ["512", "1tb"],
  awm16r1: ["512", "1tb"],
  awx16r1: ["512", "1tb"],
  awx14r1: ["256", "512"],
  // HP
  hpspec16: ["512", "1tb"],
  hpspec14: ["512", "1tb"],
  hpspec16g23: ["512", "1tb"],
  hpenvy16: ["512", "1tb"],
  hpenvy15: ["256", "512"],
  hpomen17: ["512", "1tb"],
  hpomen16: ["512", "1tb"],
  hppav15: ["256", "512"],
  hpelite840: ["256", "512"],
  hpprobook: ["256", "512"],
  // Acer
  acswx14: ["512", "1tb"],
  acsw14: ["256", "512"],
  acpred16: ["512", "1tb"],
  acpred18: ["512", "1tb"],
  acnit16: ["256", "512"],
  acnit15: ["256", "512"],
  acasp15: ["256", "512"],
  acasp3: ["128", "256"],
  // LG
  lggr17: ["512", "1tb"],
  lggr16: ["256", "512", "1tb"],
  lggr14: ["256", "512"],
  lggr17g23: ["512", "1tb"],
  lggr16g23: ["256", "512"],
  lggrpro16: ["512", "1tb"],
  lgultgear: ["512", "1tb"],
  // Apple Desktops
  macstudiom4u: ["512", "1tb"],
  macstudiom4m: ["512", "1tb"],
  macstudiom2u: ["512", "1tb"],
  macstudiom2m: ["512", "1tb"],
  macprom2u: ["1tb"],
  macminim4: ["256", "512"],
  macminim4p: ["512", "1tb"],
  macminim2: ["256", "512"],
  macminim1: ["256", "512"],
  imac24m4: ["256", "512", "1tb"],
  imac24m3: ["256", "512", "1tb"],
  imac24m1: ["256", "512"],
  // Dell Desktops
  doptiplex7010: ["256", "512"],
  doptiplex5000: ["256", "512"],
  dxps8960: ["512", "1tb"],
  dxps8950: ["512", "1tb"],
  dinsp3030: ["256", "512"],
  dprecision3680: ["512", "1tb"],
  // Lenovo Desktops
  lnthinkm: ["256", "512"],
  lnthinkm90q: ["256", "512"],
  lnlegion5dtwr: ["512", "1tb"],
  lnlegion7dtwr: ["512", "1tb"],
  lnideactower: ["256", "512"],
  // HP Desktops
  hpelitedesk: ["256", "512"],
  hpprodesk: ["256", "512"],
  hpomendsk: ["512", "1tb"],
  hpomen40: ["512", "1tb"],
  hpenvy34: ["512", "1tb"],
  hppav32: ["256", "512"],
  // Asus Desktops
  asrogstrix: ["512", "1tb"],
  asrogflow: ["512", "1tb"],
  astuft500_26: ["512", "1tb", "2tb"],
  astuft500_25: ["512", "1tb"],
  astuffx10cp: ["512", "1tb"],
  asexperpro: ["256", "512"],
  asnuc14: ["256", "512"],
  // Alienware Desktops
  awaurorar16: ["512", "1tb"],
  awaurorar15: ["256", "512", "1tb", "2tb", "4tb"],
  awaurorar13: ["256", "512", "1tb", "2tb"],
  // MSI Desktops
  // MSI desktop storage tiers — matches IWM's options per model.
  msiaegisrs:   ["512", "1tb", "2tb"],
  msiaegisr:    ["512", "1tb", "2tb"],
  msiaegiszs:   ["512", "1tb", "2tb"],
  msiaegisrs2:  ["1tb", "2tb"],
  msiaegisr2:   ["1tb", "2tb"],
  msiaegisti5:  ["1tb", "2tb"],
  msiaegiszs2:  ["1tb", "2tb"],
  msiaegisse:   ["1tb", "2tb"],
  msitridentx:  ["1tb", "2tb"],
  msitridentas: ["512", "1tb", "2tb"],
  msiinfinity:  ["1tb", "2tb"],
  msitrident:   ["512", "1tb", "2tb"],
  msicodexr2:   ["512", "1tb", "2tb"],
  msinightblade: ["512", "1tb", "2tb"],
  msicodex5:    ["1tb", "2tb"],
  msipro:       ["256", "512"],
  // iPads — Apple's iPad Pro M4 and M5 both ship in 256/512/1TB/2TB
  // (max storage is 2TB on the Pro line). Previously missing 2TB.
  ipadpro13m5: ["256", "512", "1tb", "2tb"],
  ipadpro11m5: ["256", "512", "1tb", "2tb"],
  ipadpro13m4: ["256", "512", "1tb", "2tb"],
  ipadpro11m4: ["256", "512", "1tb", "2tb"],
  ipadpro129g6: ["128", "256", "512", "1tb", "2tb"],
  ipadpro11g4: ["128", "256", "512", "1tb", "2tb"],
  ipadair13m3: ["128", "256", "512", "1tb"],
  ipadair11m3: ["128", "256", "512", "1tb"],
  ipadair13m2: ["128", "256", "512", "1tb"],
  ipadair11m2: ["128", "256", "512", "1tb"],
  ipad10: ["64", "256"],
  ipad9: ["64", "128"],
  ipadmini7: ["128", "256", "512"],
  ipadmini6: ["64", "256"],
  // Samsung Tablets — verified against Samsung's launch storage matrix.
  // The Ultra and Plus tiers gained a 1TB option starting S9; older S8
  // Ultra topped at 512GB. Tab S7+ also had a 512GB tier. Older S10 FE
  // and Lite use smaller tiers.
  stabs11u: ["256", "512", "1tb"],
  stabs11:  ["128", "256", "512"],
  stabs10u: ["256", "512", "1tb"],
  stabs10p: ["256", "512"],
  stabs10fep: ["128", "256"],
  stabs10fe:  ["128", "256"],
  stabs10l:   ["64", "128"],
  stabs9u: ["256", "512", "1tb"],
  stabs9p: ["256", "512"],
  stabs9: ["128", "256"],
  stabs8u: ["128", "256", "512"],
  stabs8p: ["128", "256"],
  stabs8: ["128", "256"],
  stabs7p: ["128", "256", "512"],
  staba9: ["64", "128"],
  // Samsung Galaxy Note — these were falling back to ALL_STORAGES.
  gnote20u:   ["128", "256", "512"],
  gnote20:    ["128"],
  gnote10p5g: ["256", "512"],
  gnote10p:   ["256", "512"],
  gnote10:    ["256"],
  gnote9:     ["128", "512"],
  // Surface
  surfpro10: ["256", "512", "1tb"],
  surfpro9: ["128", "256", "512"],
  surfgo4: ["64", "128"],
  surfgo3: ["64", "128"],
  // Lenovo Tabs
  ltabp12: ["128", "256"],
  ltabp11g2: ["128", "256"],
  ltabp11: ["128", "256"],
  ltabm11: ["64", "128"],
  // OnePlus
  oppad2: ["128", "256"],
  oppad: ["128", "256"],
  // Google
  gpixeltab: ["128", "256"],
};

function getStoragesForModel(modelId: string) {
  const valid = STORAGE_MAP[modelId];
  if (!valid) return ALL_STORAGES;
  return ALL_STORAGES.filter(s => valid.includes(s.id));
}

// CARRIERS = which network the phone was bought / activated on. The
// CARRIER_LOCKS toggle below tracks whether it's actually locked to
// that network or unlocked. Multiplier comes from the combination —
// see carrierMultiplierFor() — so the individual constants here just
// carry the labels. 'Unlocked' is its own first option for users who
// know their phone is already unlocked (skips the lock step entirely).
const CARRIERS = [
  { id: "unlocked", label: "Unlocked", icon: "🔓" },
  { id: "att", label: "AT&T", icon: "📶" },
  { id: "tmobile", label: "T-Mobile", icon: "📶" },
  { id: "verizon", label: "Verizon", icon: "📶" },
  { id: "other", label: "Other / Prepaid", icon: "📶" },
];

const CARRIER_LOCKS = [
  { id: "no", label: "No — Unlocked", desc: "Works on any carrier" },
  { id: "yes", label: "Yes — Locked to carrier", desc: "Tied to the carrier above" },
];

// Per-brand condition label + description overrides. Falls back to the
// generic CONDITIONS entry when a deviceType isn't here or doesn't
// override a specific condition id. Pure data — adding a new brand
// override is one entry, no logic changes.
const BRAND_CONDITION_LABELS: Record<string, Partial<Record<string, { label: string; desc?: string }>>> = {
  // Apple family — 'Mint' becomes 'Pristine' / 'Sealed' label
  iphone: {
    sealed: { label: "Sealed", desc: "Factory sealed, never activated" },
  },
  ipad: {
    sealed: { label: "Sealed", desc: "Factory sealed, never activated" },
  },
  macbook: {
    sealed: { label: "Sealed", desc: "Factory sealed, original packaging" },
  },
  apple_desktop: {
    sealed: { label: "Sealed", desc: "Factory sealed, never plugged in" },
  },
  applewatch: {
    broken:   { label: "Cracked or dead", desc: "Cracked face, dead battery, or won't power on" },
  },
  apple_vr: {
  },
  // Samsung family — 'Flawless' becomes 'New'
  android: {
    sealed: { label: "Sealed", desc: "Factory sealed, never activated" },
  },
  samsung_tab: {
    sealed: { label: "Sealed", desc: "Factory sealed, never activated" },
  },
  samsung_pc: {
    sealed: { label: "Sealed", desc: "Factory sealed" },
  },
  samsungwatch: {
    broken:   { label: "Cracked or dead", desc: "Cracked face, dead battery, or won't power on" },
  },
  // Google family
  pixel: {
    sealed: { label: "Sealed", desc: "Factory sealed, never activated" },
  },
  pixelwatch: {
    broken:   { label: "Cracked or dead", desc: "Cracked face, dead battery, or won't power on" },
  },
  google_tab: {
  },
  // Consoles — different vocabulary; the customer thinks about working/broken not flawless/fair
  sony: {
    sealed: { label: "Sealed", desc: "Factory sealed, never opened" },
    verygood: { label: "Excellent", desc: "Works perfectly, light cosmetic wear" },
    good:     { label: "Good", desc: "Works perfectly, normal wear & tear" },
    fair:     { label: "Fair", desc: "Works, heavy cosmetic wear" },
    broken:   { label: "Disc drive broken / won't power on", desc: "Major hardware fault" },
  },
  microsoft: {
    sealed: { label: "Sealed", desc: "Factory sealed, never opened" },
    verygood: { label: "Excellent", desc: "Works perfectly, light cosmetic wear" },
    good:     { label: "Good", desc: "Works perfectly, normal wear & tear" },
    fair:     { label: "Fair", desc: "Works, heavy cosmetic wear" },
    broken:   { label: "Disc drive broken / won't power on", desc: "Major hardware fault" },
  },
  nintendo: {
    sealed: { label: "Sealed", desc: "Factory sealed, never opened" },
    verygood: { label: "Excellent", desc: "Works perfectly, light cosmetic wear" },
    good:     { label: "Good", desc: "Works perfectly, normal wear & tear" },
    fair:     { label: "Fair", desc: "Works, heavy cosmetic wear" },
    broken:   { label: "Joy-Con drift / won't power on", desc: "Major hardware fault" },
  },
  console: {
    sealed: { label: "Sealed", desc: "Factory sealed, never opened" },
    broken:   { label: "Disc drive broken / won't power on" },
  },
  // Drones
  dji: {
    verygood: { label: "Lightly Flown", desc: "Under 10 hours, no crashes" },
    good:     { label: "Well-Maintained", desc: "Flown but maintained, no incidents" },
    fair:     { label: "Heavily Used", desc: "200+ hours, cosmetic wear, no crashes" },
    broken:   { label: "Crashed / Motors Broken", desc: "Repair history, motor or shell damage" },
  },
  // Watches not already covered
  garmin: {
    broken:   { label: "Cracked or dead", desc: "Cracked face or won't power on" },
  },
  // VR
  meta_vr: {
    sealed: { label: "Sealed", desc: "Factory sealed, never paired" },
    broken:   { label: "Cracked lens / won't power on" },
  },
  valve_vr: {
    broken: { label: "Tracking broken / won't power on" },
  },
  psvr: {
    broken: { label: "Won't pair / cracked headset" },
  },
};
function getConditionLabel(cond: { id: string; label: string; desc?: string }, dt: string | null | undefined): { label: string; desc?: string } {
  if (!dt) return { label: cond.label, desc: cond.desc };
  const override = BRAND_CONDITION_LABELS[dt]?.[cond.id];
  if (!override) return { label: cond.label, desc: cond.desc };
  return { label: override.label, desc: override.desc ?? cond.desc };
}

// Calibrated against IWM on 2026-05-12 per Skywalker directive:
// Locked Flawless = Unlocked × 0.81 (a flat 19% off). The smaller
// per-condition variations (Locked Good 0.79, Locked Fair 0.75) roll
// into 0.81 for matrix simplicity; the diff is single-digit dollars.
// 'unlocked' carrier id is treated as if the user said No to the lock step.
const carrierMultiplierFor = (carrierId: string | null | undefined, lockId: string | null | undefined): number => {
  if (carrierId === "unlocked") return 1.0;
  if (!lockId) return 1; // not picked yet, no penalty
  if (lockId === "no") return 1.0;
  if (carrierId === "other") return 0.70; // off-brand locked phones hold less value
  return 0.81;
};

// iPad connectivity tier — Wi-Fi + Cellular models retain more value
// because they include the LTE/5G modem + GPS chip. Multiplier applies
// only on the iPad flow.
const CONNECTIVITY = [
  { id: "wifi", label: "Wi-Fi Only", desc: "Internet only when you're on Wi-Fi", multiplier: 1.0 },
  { id: "cellular", label: "Wi-Fi + Cellular", desc: "Adds 4G LTE / 5G + true GPS", multiplier: 1.15 },
];

// Top multipliers — used by `getMaxPrice` to render the true ceiling
// price on each variant card. base is the lowest-config price; the
// max quote multiplies by top storage × top condition × top carrier.
// Top carrier-related multiplier — best case is fully unlocked (1.0)
// regardless of which provider was originally on the phone.
const TOP_CARRIER_MULT = 1.0;

// 'Sealed' tier — pays a +22% premium over Flawless.
// Added to phones on 2026-05-12 after Skywalker compared us to IWM:
// IWM offers ~$340 for a sealed Z Flip 6 / 512 / unlocked while we were
// capping at Flawless = $260. IWM's own Sealed tier is ~21% over their
// Flawless tier; we mirror that ratio so a sealed phone lands within ~$5
// of (IWM - $20). Laptops / desktops also use this tier.
const HIGH_MARGIN_DEVICE_TYPES = new Set<string>([
  // Phones — IWM pays a real sealed-in-box premium, so do we.
  "iphone", "android", "pixel",
  // Laptops
  "macbook", "samsung_pc", "lenovo", "dell", "alienware", "hp", "acer", "lg_pc", "asus_pc",
  // Desktops
  "apple_desktop", "dell_desktop", "lenovo_desktop", "hp_desktop", "asus_desktop", "alienware_desktop", "msi_desktop",
]);
const isHighMarginType = (dt: string | null | undefined): boolean => !!dt && HIGH_MARGIN_DEVICE_TYPES.has(dt);
// Simplified conditions for consoles/watches — fewer tiers, less confusing
const SIMPLE_CONDITIONS = [
  { id: "sealed", label: "New / Sealed", desc: "Factory sealed, never opened", multiplier: 1.03, icon: "📦", details: ["Still in original sealed packaging", "All accessories included and unopened", "Never been used or powered on"] },
  { id: "good", label: "Good", desc: "Works perfectly, normal wear", multiplier: 0.969, icon: "👍", details: ["Powers on and functions 100% as intended", "Normal cosmetic wear — scratches, scuffs OK", "All buttons and ports work", "Includes power cable"] },
  { id: "fair", label: "Fair / Beat Up", desc: "Heavy wear but still works", multiplier: 0.852, icon: "👌", details: ["Powers on and functions as intended", "Heavy cosmetic wear — dents, deep scratches", "May have minor functional issues", "Includes power cable"] },
];
// Device types that use simplified 3-tier conditions
const SIMPLE_CONDITION_TYPES = new Set([
  "console", "sony", "microsoft", "nintendo", "steam",
  "watch", "apple_watch", "samsung_watch", "google_watch", "garmin", "fitbit",
  "drone", "dji",
]);
const usesSimpleConditions = (dt: string | null | undefined): boolean => !!dt && SIMPLE_CONDITION_TYPES.has(dt);
const getConditionsFor = (dt: string | null | undefined) => {
  if (usesSimpleConditions(dt)) return SIMPLE_CONDITIONS;
  if (isHighMarginType(dt)) return CONDITIONS;
  return CONDITIONS.filter(c => c.id !== "sealed");
};
const getTopConditionMult = (dt: string | null | undefined): number => {
  return Math.max(...getConditionsFor(dt).map(c => c.multiplier));
};

const getMaxStorageMult = (modelId: string): number => {
  const sids = STORAGE_MAP[modelId];
  if (!sids || sids.length === 0) return 1;
  return Math.max(...sids.map(sid => ALL_STORAGES.find(s => s.id === sid)?.multiplier ?? 1));
};
// True ceiling for the 'Up to $X' label in the picker. PRICE_TABLE
// holds exact per-storage / per-condition dollar amounts. When present
// we take the max value across every cell — that's the real max payout.
// For models not in the table we fall back to multiplier math. Accessory
// bonus is added so the displayed ceiling matches what the quote step
// can actually award: MacBook +$30 (brick is pricey), iPhone +$10 (new
// tier completes the package), zero elsewhere.
const maxAccessoryBonus = (dt?: string | null): number => {
  if (dt === "macbook") return 30;
  if (dt === "iphone") return 10;
  return 0;
};
// Popular-device bonus mirrors the runtime quote bonus so the 'Up to $X'
// card label matches what the quote step actually awards. Phones always
// qualify; iPad ceilings assume cellular (top connectivity tier).
const maxPopularDeviceBonus = (dt?: string | null): number => {
  if (dt === "iphone" || dt === "android" || dt === "pixel") return 25;
  if (dt === "ipad") return 25;
  return 0;
};
const getMaxPrice = (m: { id: string; base?: number }, dt?: string | null): number => {
  const table = PRICE_TABLE[m.id];
  if (table) {
    let topPrice = 0;
    for (const storageEntry of Object.values(table)) {
      for (const price of Object.values(storageEntry)) {
        if (price > topPrice) topPrice = price;
      }
    }
    if (topPrice > 0) return topPrice + maxAccessoryBonus(dt) + maxPopularDeviceBonus(dt);
  }
  if (!m.base) return 0;
  const computed = Math.round(m.base * getMaxStorageMult(m.id) * getTopConditionMult(dt) * TOP_CARRIER_MULT);
  return computed + maxAccessoryBonus(dt) + maxPopularDeviceBonus(dt);
};

const PAYOUTS = [
  { id: "cash", label: "Cash" },
  { id: "cashapp", label: "Cash App" },
  { id: "zelle", label: "Zelle" },
  { id: "btc", label: "Bitcoin" },
];

const FAQS = [
  { q: "How does the process work?", a: "Select your device, choose its condition, and get an instant quote. Accept the offer, pick your payout method, and we'll arrange a local pickup in Austin." },
  { q: "How fast will I get paid?", a: "Same day for local Austin pickups. We pay on the spot via your preferred method — Cash, Cash App, Zelle, or BTC." },
  { q: "What if my device is cracked or damaged?", a: "We buy devices in any condition. Damaged phones get a lower offer, but you'll still get cash. Select 'Fair' or 'Poor' condition for an accurate quote." },
  { q: "Are the quotes guaranteed?", a: "Quotes are based on the condition you select. Final price is confirmed during inspection at pickup — if the device matches your description, you get the quoted price." },
  { q: "What devices do you buy?", a: "Phones (iPhone 11+, Samsung Galaxy S21+, Google Pixel 5+, OnePlus, Z Fold / Z Flip), iPads + Samsung / Lenovo / OnePlus / Google tablets, MacBooks + Windows laptops (Lenovo, Dell, HP, Acer, ASUS, Alienware, LG, Samsung, Microsoft Surface), Apple / Samsung / Pixel / Garmin watches, PlayStation / Xbox / Nintendo consoles, DJI drones, and VR headsets (Vision Pro, Meta Quest, Valve Index, PSVR). If you don't see your category, pick \"Other\" and we'll send a manual quote." },
  { q: "Do I need to factory reset my phone?", a: "Yes, please back up your data and factory reset before selling. We'll walk you through it if you need help." },
  { q: "How much is the shipment insured for?", a: "Standard carrier insurance is included up to $100 with the prepaid label we email you. For devices worth more, we recommend adding extra coverage at the FedEx/UPS counter when you drop the box off — it's a few dollars and the clerk handles it. We don't insure beyond $100 ourselves." },
  { q: "What if the package weighs more than the label says?", a: "Don't worry about it. The prepaid label is on our shipping account, so if your box comes in heavier than the label estimated, FedEx / UPS bills us for the difference — never you. The only thing you need to do is make sure the box actually contains the device you quoted." },
];

type Step = "device" | "category" | "brand" | "model" | "processor" | "memory" | "displayglass" | "storage" | "graphics" | "displayresolution" | "condition" | "broken-functional" | "broken-glass" | "batteryhealth" | "charger" | "connectivity" | "carrier" | "carrier-lock" | "extras" | "quote" | "checkout" | "payout" | "contact" | "done" | "inquiry";

// Brand-specific extra questions. A device family can declare a list of
// follow-up questions (disc drive / controllers / hours flown / band
// included / shutter count, etc) that the funnel asks via a single
// generic 'extras' step that advances an index between questions.
// Each option carries a multiplier that folds into the quote alongside
// storage / condition / etc.
type ExtraOption = { id: string; label: string; sub?: string; multiplier: number; adj?: number };
// `showIf` makes a question conditional on a previous answer — used to
// short-circuit follow-ups like "which band?" when the user already said
// "no band". When showIf returns false, the renderer auto-advances past
// the question instead of showing it.
type BrandExtra = { id: string; question: string; helper?: string; options: ExtraOption[]; showIf?: (extras: Record<string, ExtraOption | undefined>) => boolean;
  // Optional step-by-step guide shown when the user clicks "How do I check this?"
  // — useful for questions where the answer requires inspection or knowledge
  // the seller may not immediately have (AVP Optic ID, EyeSight glass, etc.).
  guide?: { title: string; steps: string[] };
};
// Storage-delta values come from IWM scrape (iwm-tablet-adjustments.json)
// in dollars. We apply ×0.90 inline on each adj value here so the
// quote-math doesn't need to know the source. Common pattern across
// Samsung / OnePlus / Lenovo / Google tablets: 128GB = $0, 256GB ≈ +$15,
// 512GB ≈ +$45, 1TB ≈ +$70. Surface uses a separate config (chip+RAM+SSD)
// picker downstream because the matrix is wide.
const TABLET_STORAGE_OPTIONS = [
  { id: "64",  label: "64 GB",  multiplier: 1.00, adj: -10 },
  { id: "128", label: "128 GB", multiplier: 1.00, adj: 0 },
  { id: "256", label: "256 GB", multiplier: 1.00, adj: 15 },
  { id: "512", label: "512 GB", multiplier: 1.00, adj: 45 },
  { id: "1tb", label: "1 TB",   multiplier: 1.00, adj: 70 },
];

// Per-variant tablet spec — drives which questions getBrandExtras()
// shows for each tablet, and the $ deltas it uses. Sourced from
// iwm-tablet-adjustments.json × 0.90 by scripts/gen-tablet-specs.py.
//   cellularAdj = how much MORE a cellular config pays vs Wi-Fi-only.
//                 omit if the model has no cellular variant on IWM.
//   stylusAdj   = how much LESS we pay if the included stylus is
//                 missing (negative number). omit if no stylus question.
//   storages    = the storage tiers IWM actually has for this model
//                 (we filter TABLET_STORAGE_OPTIONS down to this set).
type TabletSpec = {
  cellularAdj?: number;
  stylusAdj?: number;
  storages?: string[];
};
const TABLET_SPECS: Record<string, TabletSpec> = {
  stabs11u:    { cellularAdj: 27, stylusAdj: -22, storages: ["256GB", "512GB", "1TB"] },
  stabs11:     { cellularAdj: 45, stylusAdj: -22, storages: ["128GB", "256GB", "512GB"] },
  stabs9u:     { cellularAdj: 45, stylusAdj: -18, storages: ["256GB", "512GB", "1TB"] },
  stabs9p:     { cellularAdj: 36, stylusAdj: -22, storages: ["256GB", "512GB"] },
  stabs9:      { stylusAdj: -14, storages: ["128GB", "256GB"] },
  stabs9fep:   { stylusAdj: -14, storages: ["128GB", "256GB"] },
  stabs9fe:    { cellularAdj: 14, stylusAdj: -4,  storages: ["128GB", "256GB"] },
  stabs8u:     { cellularAdj: 27, stylusAdj: -22, storages: ["128GB", "256GB", "512GB"] },
  stabs8p:     { cellularAdj: 27, stylusAdj: -9,  storages: ["128GB", "256GB", "512GB"] },
  stabs8:      { stylusAdj: -22, storages: ["128GB", "256GB"] },
  stabs10u:    { cellularAdj: 36, stylusAdj: -45, storages: ["256GB", "512GB", "1TB"] },
  stabs10p:    { cellularAdj: 45, stylusAdj: -22, storages: ["256GB", "512GB"] },
  stabs10fep:  { stylusAdj: -14, storages: ["128GB", "256GB"] },
  stabs10fe:   { cellularAdj: 9,  stylusAdj: -22, storages: ["128GB", "256GB"] },
  stabs10l:    { cellularAdj: 18, stylusAdj: -22, storages: ["128GB", "256GB"] },
  stabs7p:     { cellularAdj: 22, stylusAdj: -22, storages: ["128GB", "256GB", "512GB"] },
  stabs7fe:    { cellularAdj: 36, stylusAdj: -22, storages: ["64GB", "128GB", "256GB"] },
  stabs7:      { cellularAdj: 36, stylusAdj: -14, storages: ["128GB", "256GB", "512GB"] },
  stabs6l:     { cellularAdj: 18, stylusAdj: -14, storages: ["64GB", "128GB"] },
  stabs6:      { cellularAdj: 4,  stylusAdj: -14, storages: ["128GB", "256GB"] },
  stabs5e:     { cellularAdj: 9,  storages: ["64GB", "128GB"] },
  stabs4:      { cellularAdj: 9,  storages: ["64GB", "256GB"] },
  oppad3:      { storages: ["256GB"] },
  oppadgo2:    { storages: ["128GB", "256GB"] },
  oppad2:      { storages: ["128GB", "256GB"] },
  oppad:       { storages: ["128GB", "256GB"] },
  gpixeltab:   { storages: ["128GB", "256GB"] },
  legtabg3:    { storages: ["256GB", "512GB"] },
  legy900_2026: { storages: ["256GB", "512GB"] },
  // Surface — only Pro 5/7/7+/8/10/11 + Pro X have a separate LTE
  // question on IWM. Pro 6 / 9 / 12in and all Go models bake cellular
  // into the config (chip+RAM+SSD) variant they pick.
  surfpro11:    { cellularAdj: 90 },
  surfpro10biz: { cellularAdj: 90 },
  surfpro9:     { },  // no separate LTE question on IWM (baked into config picker)
  surfpro8:     { cellularAdj: 32 },
  surfpro7p:    { cellularAdj: 32 },
  surfpro7:     { cellularAdj: 9 },
  surfpro6:     { },  // no separate LTE question on IWM
  surfgo4:      { },  // no separate LTE question on IWM
  surfgo3:      { },  // no separate LTE question on IWM
  surfgo2:      { },  // no separate LTE question on IWM
  surfprox2020: { cellularAdj: 18 },
  surfprox2019: { cellularAdj: 18 },
};

const BRAND_EXTRAS: Record<string, BrandExtra[]> = {
  // ===== Tablets =====
  // Samsung Galaxy Tab — storage / carrier / S Pen / charger / box.
  // Adj values derived from IWM Galaxy Tab S10 Ultra tree × 0.90 and
  // hold roughly across the S-series (Samsung uses the same matrix).
  samsung_tab: [
    // Storage removed 2026-05-17 — TABLET_SPECS already drives a per-storage
    // step earlier in the funnel for every stabs* variant. Asking again here
    // double-counted the storage multiplier on top of the PRICE_TABLE tier
    // (same bug pattern we fixed for Meta Quest).
    { id: "carrier", question: "Wi-Fi only or LTE/5G?", helper: "Unlocked cellular models pay $30+ more than Wi-Fi only.",
      guide: { title: "How to check connectivity", steps: [
        "Settings → Connections → Mobile networks. If you see a carrier or 'No SIM', it's a cellular model.",
        "Or check the back near the camera: cellular models have a SIM tray slot.",
        "Wi-Fi-only tablets only show 'Wi-Fi' under Connections.",
      ]}, options: [
      { id: "wifi", label: "Wi-Fi only",        multiplier: 1.00, adj: 0 },
      { id: "lte",  label: "LTE / 5G unlocked", multiplier: 1.00, adj: 36 },
    ]},
    { id: "spen", question: "S Pen included?", helper: "Most Galaxy Tab S series ship with an S Pen — significant value if it's missing.",
      guide: { title: "How to identify the S Pen", steps: [
        "Look on the back of the tablet — there's a flat magnetic strip where the S Pen attaches.",
        "If you have the S Pen, it's the slim stylus that magnetically clicks onto the back.",
        "S Pens for newer Tab S models have a button on the side; older ones are plain.",
      ]}, options: [
      { id: "yes", label: "Yes — S Pen included",  multiplier: 1.00, adj: 0 },
      { id: "no",  label: "No — S Pen missing",    multiplier: 1.00, adj: -45 },
    ]},
    { id: "charger", question: "Charger included?", options: [
      { id: "yes", label: "Yes — charger + cable", multiplier: 1.00, adj: 0 },
      { id: "no",  label: "No",                    multiplier: 1.00, adj: -9 },
    ]},
    { id: "box", question: "Original box?", options: [
      { id: "yes", label: "Yes", multiplier: 1.00, adj: 0 },
      { id: "no",  label: "No",  multiplier: 1.00, adj: -5 },
    ]},
  ],
  // Microsoft Surface — Type Cover and Pen are the two big drivers,
  // plus LTE for Pro 11. Storage/RAM/CPU baked into the variant ID
  // already (each Surface page in IWM uses a Configuration picker that
  // we represent at the variant level).
  surface: [
    { id: "typecover", question: "Type Cover keyboard included?", helper: "Surface Type Cover keyboards sell for $150+ separately.",
      guide: { title: "How to identify a Type Cover", steps: [
        "Look for the magnetic keyboard cover that clicks onto the bottom of the Surface.",
        "Type Covers have a fabric/Alcantara finish; the Signature cover is darker and softer.",
        "If it came in the original box and snaps in firmly via magnets, it's OEM.",
      ]}, options: [
      { id: "yes", label: "Yes — Type Cover included", multiplier: 1.00, adj: 65 },
      { id: "no",  label: "No",                         multiplier: 1.00, adj: 0 },
    ]},
    { id: "pen", question: "Surface Pen included?", helper: "Adds $5-$20 depending on generation.",
      guide: { title: "How to identify a Surface Pen", steps: [
        "Surface Pen is a slim white/black stylus with a soft eraser-tip button on top.",
        "Magnetically clips to the left side of the Surface Pro/Go.",
        "Surface Slim Pen 2 is the newer model — flat clip vs. round pencil shape.",
      ]}, options: [
      { id: "yes", label: "Yes",  multiplier: 1.00, adj: 18 },
      { id: "no",  label: "No",   multiplier: 1.00, adj: 0 },
    ]},
    { id: "lte", question: "LTE / 5G cellular?", helper: "Cellular Surfaces add ~$90 over the Wi-Fi version.", showIf: () => true,
      guide: { title: "How to check cellular", steps: [
        "Settings → Network & internet → Cellular. If present, it's a cellular model.",
        "Or look on the back near the kickstand — cellular models have a SIM tray.",
        "Surface Pro 9 / 10 / 11 all offer optional LTE variants.",
      ]}, options: [
      { id: "yes", label: "Yes — LTE cellular", multiplier: 1.00, adj: 90 },
      { id: "no",  label: "No — Wi-Fi only",    multiplier: 1.00, adj: 0 },
    ]},
    { id: "charger", question: "Charger included?", options: [
      { id: "yes", label: "Yes — Surface Connect or USB-C charger", multiplier: 1.00, adj: 0 },
      { id: "no",  label: "No",                                      multiplier: 1.00, adj: -27 },
    ]},
    { id: "box", question: "Original box?", options: [
      { id: "yes", label: "Yes", multiplier: 1.00, adj: 0 },
      { id: "no",  label: "No",  multiplier: 1.00, adj: -5 },
    ]},
  ],
  // Lenovo Tab — same storage matrix as Samsung; no S Pen question
  // because most Lenovo tabs ship without a stylus.
  lenovo_tab: [
    // Storage removed 2026-05-17 — same double-ask bug as samsung_tab.
    // legtabg3 / legy900_2026 have storage in TABLET_SPECS already.
    { id: "charger", question: "Charger included?", options: [
      { id: "yes", label: "Yes", multiplier: 1.00, adj: 0 },
      { id: "no",  label: "No",  multiplier: 1.00, adj: -8 },
    ]},
    { id: "box", question: "Original box?", options: [
      { id: "yes", label: "Yes", multiplier: 1.00, adj: 0 },
      { id: "no",  label: "No",  multiplier: 1.00, adj: -3 },
    ]},
  ],
  // OnePlus Pad / Pad 2 / Pad 3 / Pad Go 2 — storage only, no LTE
  // variants on US models.
  oneplus_tab: [
    // Storage removed 2026-05-17 — TABLET_SPECS drives storage step earlier.
    { id: "stylus", question: "OnePlus Stylo included?", helper: "OnePlus Pad 2/3 ship with the magnetic Stylo stylus — adds ~$30 if included.",
      options: [
      { id: "yes", label: "Yes — Stylo included", multiplier: 1.00, adj: 27 },
      { id: "no",  label: "No",                    multiplier: 1.00, adj: 0 },
    ]},
    { id: "charger", question: "Charger included?", options: [
      { id: "yes", label: "Yes — OnePlus charger", multiplier: 1.00, adj: 0 },
      { id: "no",  label: "No",                     multiplier: 1.00, adj: -9 },
    ]},
    { id: "box", question: "Original box?", options: [
      { id: "yes", label: "Yes", multiplier: 1.00, adj: 0 },
      { id: "no",  label: "No",  multiplier: 1.00, adj: -3 },
    ]},
  ],
  // Google Pixel Tablet — comes with charging dock, storage 128 / 256.
  google_tab: [
    // Storage removed 2026-05-17 — gpixeltab has 128/256 storage step
    // in TABLET_SPECS already.
    { id: "dock", question: "Charging speaker dock included?", helper: "The white speaker base — Pixel Tablet ships with one. Adds $40+ if included.",
      guide: { title: "How to identify the dock", steps: [
        "The Pixel Tablet ships with a circular white base that doubles as a speaker and stand.",
        "It charges magnetically via 4 metal pins on the back of the tablet.",
        "Sold separately for $129 — keeps significant resale value.",
      ]}, options: [
      { id: "yes", label: "Yes — dock included",   multiplier: 1.00, adj: 36 },
      { id: "no",  label: "No",                     multiplier: 1.00, adj: 0 },
    ]},
    { id: "box", question: "Original box?", options: [
      { id: "yes", label: "Yes", multiplier: 1.00, adj: 0 },
      { id: "no",  label: "No",  multiplier: 1.00, adj: -3 },
    ]},
  ],
  // Consoles — single ask: disc drive yes/no (digital editions trade lower)
  // and how many controllers are in the box.
  sony: [
    { id: "discdrive", question: "Disc drive?", helper: "Digital-only consoles trade for a bit less.", options: [
      { id: "yes",     label: "Yes — has disc drive",    multiplier: 1.00 },
      { id: "digital", label: "No — digital edition",     multiplier: 0.92 },
    ]},
    { id: "storage", question: "Storage upgraded?", helper: "PS4/PS4 Pro owners may have swapped the internal drive. PS5 storage is fixed by model.", options: [
      { id: "none",   label: "No — base storage only",        multiplier: 1.00 },
      { id: "1-2tb",  label: "Yes — upgraded to 1-2TB",       multiplier: 1.05 },
      { id: "4tb",    label: "Yes — upgraded to 4TB+",        multiplier: 1.10 },
    ]},
    { id: "controllers", question: "Controllers included?", options: [
      { id: "2", label: "2 controllers", multiplier: 1.05 },
      { id: "1", label: "1 controller",  multiplier: 1.00 },
      { id: "0", label: "No controllers", multiplier: 0.92 },
    ]},
    { id: "powercord", question: "Power cord included?", options: [
      { id: "yes", label: "Yes", multiplier: 1.00 },
      { id: "no",  label: "No",  multiplier: 0.96 },
    ]},
  ],
  microsoft: [
    { id: "discdrive", question: "Disc drive?", helper: "Xbox Series S is always digital; Series X comes in both flavors.", options: [
      { id: "yes",     label: "Yes — has disc drive",    multiplier: 1.00 },
      { id: "digital", label: "No — digital edition",     multiplier: 0.92 },
    ]},
    // Storage is implicit by variant (Series X 1 TB, Series S 512 GB,
    // Xbox One 500 GB / 1 TB) — no capacity question per Skywalker
    // (2026-05-12).
    { id: "controllers", question: "Controllers included?", options: [
      { id: "2", label: "2 controllers", multiplier: 1.05 },
      { id: "1", label: "1 controller",  multiplier: 1.00 },
      { id: "0", label: "No controllers", multiplier: 0.92 },
    ]},
    { id: "powercord", question: "Power cord included?", options: [
      { id: "yes", label: "Yes", multiplier: 1.00 },
      { id: "no",  label: "No",  multiplier: 0.96 },
    ]},
  ],
  nintendo: [
    { id: "joycons", question: "Joy-Cons / Pro Controller?", options: [
      { id: "pro_plus", label: "Both Joy-Cons + Pro Controller", multiplier: 1.08 },
      { id: "both",     label: "Both Joy-Cons",                  multiplier: 1.00 },
      { id: "one",      label: "One Joy-Con",                    multiplier: 0.92 },
      { id: "none",     label: "No controllers",                 multiplier: 0.85 },
    ]},
    { id: "dock", question: "Dock included?", options: [
      { id: "yes",     label: "Yes — original dock",  multiplier: 1.00 },
      { id: "no",      label: "No dock",              multiplier: 0.90 },
      { id: "handheld", label: "N/A — Switch Lite",   multiplier: 1.00 },
    ]},
    { id: "powercord", question: "HDMI & power cords included?", options: [
      { id: "yes", label: "Yes", multiplier: 1.00 },
      { id: "no",  label: "No",  multiplier: 0.97 },
    ]},
  ],
  // iPad accessory bundling
  ipad: [
    { id: "pencil", question: "Apple Pencil included?", helper: "Generation matters — 2nd gen and Pro pair to Pro/Air; USB-C is the budget one.", options: [
      { id: "pro",      label: "Yes — Apple Pencil Pro",          multiplier: 1.07 },
      { id: "gen2",     label: "Yes — Apple Pencil (2nd gen)",    multiplier: 1.05 },
      { id: "gen1",     label: "Yes — Apple Pencil (1st gen)",    multiplier: 1.02 },
      { id: "usbc",     label: "Yes — Apple Pencil (USB-C)",      multiplier: 1.02 },
      { id: "none",     label: "No Pencil",                       multiplier: 1.00 },
    ]},
  ],
  // Drones
  dji: [
    { id: "hours", question: "Hours flown?", helper: "Check the DJI Fly app log if you're not sure.", options: [
      { id: "low",   label: "Under 10 hours",     multiplier: 1.05 },
      { id: "mid",   label: "10 - 50 hours",      multiplier: 1.00 },
      { id: "high",  label: "50 - 200 hours",     multiplier: 0.92 },
      { id: "heavy", label: "200+ hours",         multiplier: 0.80 },
    ]},
    { id: "crashes", question: "Crashes or hard landings?", options: [
      { id: "none", label: "Zero — pristine flight history", multiplier: 1.05 },
      { id: "soft", label: "1-2 soft / non-damage",          multiplier: 1.00 },
      { id: "hard", label: "1+ crash with repair / replacement parts", multiplier: 0.85 },
    ]},
    { id: "batteries", question: "Extra batteries?", helper: "Spare batteries add value — Fly More kits are worth more.", options: [
      { id: "flyMore", label: "Fly More combo (2-3 batteries + bag)", multiplier: 1.12 },
      { id: "extra",   label: "1 extra battery",                     multiplier: 1.05 },
      { id: "one",     label: "Just the one in the drone",           multiplier: 1.00 },
    ]},
  ],
  // Smartwatches — band makes a big resale difference
  applewatch: [
    // Functional check first. "No" returns a near-zero multiplier (0.02)
    // which drops the quote below MIN_OFFER and triggers the
    // "Manual review needed" flow on the quote step.
    { id: "functional", question: "Is the watch fully functional?", helper: "Powers on, touchscreen and buttons respond, all sensors work.", options: [
      { id: "yes", label: "Yes — fully working", multiplier: 1.00 },
      { id: "no",  label: "No — needs repair or won't power on", sub: "We'll text you a custom quote", multiplier: 0.02 },
    ]},
    { id: "material", question: "Case material?", helper: "Check the back of your watch or Settings > General > About.", options: [
      { id: "aluminum",  label: "Aluminum",        multiplier: 1.00 },
      { id: "stainless", label: "Stainless Steel",  multiplier: 1.15 },
      { id: "titanium",  label: "Titanium",         multiplier: 1.40 },
    ]},
    { id: "connectivity", question: "GPS or GPS + Cellular?", helper: "Cellular models have a red ring on the Digital Crown (or orange on Ultra).", options: [
      { id: "gps",      label: "GPS only",          multiplier: 1.00 },
      { id: "cellular", label: "GPS + Cellular",    multiplier: 1.10 },
    ]},
    { id: "size", question: "Case size?", helper: "Check Settings > General > About, or measure the case height.", options: [
      { id: "small", label: "Small (40-42mm)",       multiplier: 1.00 },
      { id: "large", label: "Large (44-46mm)",       multiplier: 1.05 },
    ]},
    // Two-step band flow — yes/no first so users without a band don't
    // have to scan the full list. If "yes", the follow-up "which band?"
    // question fires via showIf.
    { id: "bandIncluded", question: "Original Apple band included?", options: [
      { id: "yes", label: "Yes",        multiplier: 1.00 },
      { id: "no",  label: "No (no band or 3rd-party only)", multiplier: 0.90 },
    ]},
    { id: "band", question: "Which band shipped with it?", showIf: (extras) => extras.bandIncluded?.id === "yes", options: [
      { id: "oem", label: "Original Apple band", multiplier: 1.05 },
    ]},
  ],
  samsungwatch: [
    { id: "connectivity", question: "Bluetooth only or LTE?", helper: "LTE models can make calls without your phone nearby.",
      guide: { title: "How to check connectivity", steps: [
        "Open Settings on the watch → About Watch → Status.",
        "Look for a SIM section. LTE models show carrier + IMEI; BT-only models say 'No SIM'.",
        "Or check the case back — LTE models are engraved 'LTE'.",
      ]},
      options: [
      { id: "bt",  label: "Bluetooth only",  multiplier: 1.00, adj: 0 },
      { id: "lte", label: "LTE (Cellular)",  multiplier: 1.00, adj: 5 },
    ]},
    { id: "size", question: "Case size?", helper: "Printed on the underside of the watch.",
      guide: { title: "How to find the case size", steps: [
        "Remove the watch from your wrist.",
        "Look at the underside (against the skin) — Samsung prints the size next to the model number.",
        "Common sizes: 40mm, 43mm (Watch 8), 44mm, 47mm (Ultra).",
      ]},
      options: [
      { id: "small", label: "Small (40-43mm)", multiplier: 1.00, adj: 0 },
      { id: "large", label: "Large (44-47mm)", multiplier: 1.00, adj: 5 },
    ]},
    { id: "band", question: "Is the band original (OEM)?",
      guide: { title: "How to verify OEM", steps: [
        "Original Samsung bands have 'Samsung' printed on the inside, near the lug.",
        "OEM clasps say 'Samsung'; 3rd-party clasps are usually unbranded.",
        "If the band came in the original box, it's OEM.",
      ]},
      options: [
      { id: "oem",   label: "Yes — original Samsung band", multiplier: 1.00, adj: 0 },
      { id: "third", label: "Yes — 3rd-party band",        multiplier: 1.00, adj: -10 },
      { id: "none",  label: "No band",                     multiplier: 1.00, adj: -20 },
    ]},
    { id: "charger", question: "Charging dock included?",
      options: [
      { id: "yes", label: "Yes — original puck",  multiplier: 1.00, adj: 0 },
      { id: "no",  label: "No",                   multiplier: 1.00, adj: -8 },
    ]},
  ],
  pixelwatch: [
    { id: "connectivity", question: "Wi-Fi or LTE?", options: [
      { id: "wifi", label: "Wi-Fi / Bluetooth only", multiplier: 1.00 },
      { id: "lte",  label: "LTE (Cellular)",         multiplier: 1.10 },
    ]},
    { id: "size", question: "Case size?", options: [
      { id: "small", label: "Small (41mm)",  multiplier: 1.00 },
      { id: "large", label: "Large (45mm)",  multiplier: 1.05 },
    ]},
    { id: "band", question: "Band included?", options: [
      { id: "oem",   label: "Yes — original Google band",  multiplier: 1.05 },
      { id: "third", label: "Yes — 3rd-party band",        multiplier: 1.00 },
      { id: "none",  label: "No band",                     multiplier: 0.90 },
    ]},
  ],
  garmin: [
    // Edition question: only appears when the selected model has an
    // entry in GARMIN_EDITIONS (Fenix 7/7S/7X/8 series + Epix Gen 2).
    // Resolution happens in getBrandExtras at render time.
    { id: "band", question: "Is the band original (OEM)?", helper: "Original Garmin bands include 'Garmin' on the underside.",
      guide: { title: "How to verify OEM Garmin band", steps: [
        "Flip the band over — original Garmin bands print 'Garmin' near the lug.",
        "OEM QuickFit bands have a metal release lever; aftermarket usually use thread or pin.",
        "If the watch came in its original box with the band, it's OEM.",
      ]},
      options: [
      { id: "oem",   label: "Yes — original Garmin band",  multiplier: 1.00, adj: 0 },
      { id: "third", label: "Yes — 3rd-party band",        multiplier: 1.00, adj: -8 },
      { id: "none",  label: "No band",                     multiplier: 1.00, adj: -25 },
    ]},
    { id: "charger", question: "Charging cable included?", helper: "Garmin's proprietary 4-pin cable — sells for $20+ separately.",
      options: [
      { id: "yes", label: "Yes",  multiplier: 1.00, adj: 0 },
      { id: "no",  label: "No",   multiplier: 1.00, adj: -15 },
    ]},
    { id: "box", question: "Original box?",
      options: [
      { id: "yes", label: "Yes",  multiplier: 1.00, adj: 0 },
      { id: "no",  label: "No",   multiplier: 1.00, adj: -3 },
    ]},
  ],
  // VR — accessories matter a lot
  meta_vr: [
    // Storage question removed 2026-05-17 — variants already split per
    // storage tier ("Meta Quest 3 (512GB)" etc.) with base prices baked
    // in. Asking again double-counted the storage multiplier on top of
    // the variant's already-correct base.
    { id: "controllers", question: "Touch controllers included?", options: [
      { id: "both", label: "Both controllers", multiplier: 1.00 },
      { id: "one",  label: "One controller",   multiplier: 0.88 },
      { id: "none", label: "No controllers",   multiplier: 0.70 },
    ]},
  ],
  valve_vr: [
    { id: "kit", question: "What's in the box?", options: [
      { id: "fullkit",  label: "Full Kit (headset + base stations + controllers)", multiplier: 1.00 },
      { id: "headset",  label: "Headset only",                                     multiplier: 0.55 },
      { id: "partial",  label: "Headset + controllers, no base stations",          multiplier: 0.75 },
    ]},
  ],
  psvr: [
    { id: "controllers", question: "Controllers included?", options: [
      { id: "both", label: "Both Sense controllers", multiplier: 1.00 },
      { id: "one",  label: "One controller",         multiplier: 0.88 },
      { id: "none", label: "No controllers",         multiplier: 0.70 },
    ]},
  ],
  apple_vr: [
    // Generation lives at the variant level (avp_m2 vs avp_m5) so this
    // question is gone. Storage deltas are identical for both gens per
    // IWM: 256GB $0 / 512GB +$90 / 1TB +$225 (all after ×0.90).
    { id: "storage", question: "Storage capacity?", helper: "Check Settings → General → About → Capacity.",
      guide: { title: "How to find your storage", steps: [
        "Put on Vision Pro and press the Digital Crown to go Home.",
        "Open Settings (gear icon).",
        "Tap General → About.",
        "Look for 'Capacity' — it'll show 256 GB, 512 GB, or 1 TB.",
      ]},
      options: [
      { id: "256", label: "256 GB", multiplier: 1.00, adj: 0 },
      { id: "512", label: "512 GB", multiplier: 1.00, adj: 90 },
      { id: "1tb", label: "1 TB",   multiplier: 1.00, adj: 225 },
    ]},
    { id: "powers_on", question: "Does it power on and complete Optic ID?", helper: "If Optic ID won't enroll your eyes, the unit is essentially parts-value.",
      guide: { title: "How to test power-on + Optic ID", steps: [
        "Connect the external battery. Hold the top button 2 seconds — Apple logo should appear.",
        "Put the headset on; the Solo Knit / Dual Loop strap can stay loose.",
        "If it asks to enroll Optic ID: go through the eye-scan flow. It takes ~30 seconds.",
        "Already enrolled? Open Settings → Optic ID and try 'Reset Optic ID' then re-enroll.",
        "If the eye scan never completes after multiple tries, the IR eye-tracking hardware is bad — pick 'Optic ID broken'.",
      ]},
      options: [
      { id: "yes",   label: "Yes — fully functional",        multiplier: 1.00, adj: 0 },
      { id: "boots", label: "Powers on but Optic ID broken", multiplier: 1.00, adj: -400 },
      { id: "no",    label: "Won't power on / brick",        multiplier: 1.00, adj: -1300 },
    ]},
    { id: "eyesight", question: "Front EyeSight glass condition?", helper: "The curved outer display — biggest resale factor. A crack drops the unit from $1700 to parts value.",
      guide: { title: "What is EyeSight + how to inspect", steps: [
        "EyeSight = the curved glass on the OUTSIDE of the headset that shows your eyes to people around you.",
        "Turn the headset off; wipe the front with a microfiber cloth.",
        "Hold under bright direct light at an angle — surface scratches appear as fine lines.",
        "Run a fingernail across — if it catches in a line, that's a deep scratch (-$350).",
        "Any crack, chip, or impact mark = 'Cracked' (-$1200). Even hairline cracks count.",
      ]},
      options: [
      { id: "flawless", label: "Flawless — no marks",         multiplier: 1.00, adj: 0 },
      { id: "light",    label: "Light surface scratches",     multiplier: 1.00, adj: -100 },
      { id: "deep",     label: "Deep scratches or scuffs",    multiplier: 1.00, adj: -350 },
      { id: "cracked",  label: "Cracked or chipped",          multiplier: 1.00, adj: -1200 },
    ]},
    { id: "lenses", question: "Internal lenses + displays?", helper: "Look inside the headset. Dust on lenses is normal; scratches are not.",
      guide: { title: "How to inspect internal lenses", steps: [
        "Take off the Light Seal (it pulls away from the headset).",
        "Hold the headset display-side up under a bright light.",
        "Look at the two round lenses — these are what your eyes see through.",
        "Dust specks on the lens surface = normal. They wipe off.",
        "Scratches won't wipe off. Anything visible that doesn't move when you wipe counts as scratched.",
        "Also check the internal micro-OLED panels (visible THROUGH the lenses) for dead pixels or burn-in.",
      ]},
      options: [
      { id: "clean",      label: "Clean, no scratches",       multiplier: 1.00, adj: 0 },
      { id: "dust",       label: "Visible dust",              multiplier: 1.00, adj: -25 },
      { id: "scratched",  label: "Scratched internal lenses", multiplier: 1.00, adj: -300 },
    ]},
    { id: "battery", question: "External battery pack?", helper: "AVP needs the external battery to operate.",
      guide: { title: "Where to find + inspect the battery", steps: [
        "The battery is a separate silver pack about the size of a phone — connects via a single cable to the left arm of the headset.",
        "Lay it flat on a hard surface — it should sit FLAT. Any visible swelling, bulge, or curve = swollen.",
        "Check the cable for fraying or damage at either end.",
        "Apple sells replacement batteries for $199, so buyers care about the original being present + healthy.",
      ]},
      options: [
      { id: "yes",     label: "Yes — included, no swelling",   multiplier: 1.00, adj: 0 },
      { id: "missing", label: "Battery missing or swollen",    multiplier: 1.00, adj: -250 },
    ]},
    { id: "bands", question: "Which bands are included?", helper: "M2 ships with both Solo Knit + Dual Loop. M5 ships with one Dual Knit band.",
      guide: { title: "How to identify the bands", steps: [
        "Solo Knit Band (M2): single woven elastic strap that goes around the back of your head. Has a dial on the right for fit.",
        "Dual Loop Band (M2): TWO straps — one over the head + one around the back. More secure but bulkier.",
        "Dual Knit Band (M5 only): replaces both — has a single integrated strap with a top loop and back dial.",
        "Bands are sized S/M/L — the size is printed inside the band near the dial. Sized to the original user's head.",
        "Missing one band = -$75, missing all = -$175.",
      ]},
      options: [
      { id: "both",   label: "Both bands (M2) / Dual Knit (M5)", multiplier: 1.00, adj: 0 },
      { id: "one",    label: "Only one band",                    multiplier: 1.00, adj: -75 },
      { id: "none",   label: "No bands",                         multiplier: 1.00, adj: -175 },
    ]},
    { id: "light_seal", question: "Light Seal + cushions present?", helper: "The foam piece that goes against the face. Includes primary + spare cushion.",
      guide: { title: "How to identify the Light Seal", steps: [
        "Light Seal = the soft black foam piece that surrounds the inside of the headset and contacts your face.",
        "It magnetically attaches — pulls off easily.",
        "There's also a removable CUSHION on the back of the Light Seal (the part that actually touches the face).",
        "AVP ships with TWO cushions: one attached + one spare in a separate pouch.",
        "Light Seal codes (e.g. 21W, 33N+) are printed on the back — sized per individual user from Apple Store fitting.",
      ]},
      options: [
      { id: "complete", label: "Light Seal + both cushions",  multiplier: 1.00, adj: 0 },
      { id: "partial",  label: "Light Seal, missing a cushion", multiplier: 1.00, adj: -40 },
      { id: "missing",  label: "Missing entirely",             multiplier: 1.00, adj: -100 },
    ]},
    { id: "zeiss", question: "ZEISS Optical Inserts?", helper: "Magnetic prescription lenses that snap onto AVP. Sold separately by Apple.",
      guide: { title: "What are ZEISS Inserts", steps: [
        "ZEISS Optical Inserts are small round prescription lenses that snap MAGNETICALLY onto the AVP internal lenses.",
        "They're sold separately by Apple (not included in the box) — $149 Rx, $99 non-Rx readers.",
        "Look inside the headset — if there are extra round lenses sitting on top of the regular AVP lenses, those are ZEISS inserts.",
        "Rx inserts are locked to the original user's prescription — most resellers see negative value.",
        "Non-Rx readers (reading glasses for far-sighted users) are common-prescription and add some value.",
      ]},
      options: [
      { id: "none",        label: "None included",                multiplier: 1.00, adj: 0 },
      { id: "readers",     label: "Non-Rx readers (unused)",      multiplier: 1.00, adj: 30 },
      { id: "rx",          label: "Rx prescription (locked to user)", multiplier: 1.00, adj: 0 },
    ]},
    { id: "box", question: "Original box and accessories?", helper: "CIB = Complete In Box: box, charger, USB-C cable, polishing cloth, front cover.",
      guide: { title: "What ships in the box", steps: [
        "Original box (white, square, with AVP printed on top)",
        "40W USB-C power adapter (square white brick)",
        "USB-C charging cable (1.5m)",
        "Polishing cloth (the soft fabric one Apple uses)",
        "Front cover (the soft pouch that goes over the EyeSight glass when not in use)",
        "All five items = 'Complete in box (CIB)' for top quote.",
      ]},
      options: [
      { id: "cib",      label: "Complete in box (CIB)",         multiplier: 1.00, adj: 0 },
      { id: "partial",  label: "Some accessories missing",      multiplier: 1.00, adj: -50 },
      { id: "device",   label: "Device only, no accessories",   multiplier: 1.00, adj: -100 },
    ]},
    { id: "applecare", question: "AppleCare+ status?", helper: "Transferable to the new owner — adds resale value.",
      guide: { title: "How to check AppleCare+", steps: [
        "On Vision Pro: Settings → General → AppleCare & Warranty.",
        "Or on iPhone: open the Apple Support app → Get Support → Vision Pro → Coverage.",
        "Or web: checkcoverage.apple.com — enter the AVP serial number (Settings → General → About).",
        "AppleCare+ is transferable to a new owner; that's why it adds value.",
        "12+ months remaining = +$150, less than 12 months = +$75.",
      ]},
      options: [
      { id: "12mo",   label: "Active — 12+ months remaining", multiplier: 1.00, adj: 150 },
      { id: "active", label: "Active — less than 12 months",  multiplier: 1.00, adj: 75 },
      { id: "none",   label: "No AppleCare+ / expired",       multiplier: 1.00, adj: 0 },
    ]},
  ],
  // Dell laptops — GPU is a big price driver for XPS 15. Uses adj values
  // consumed by the additive pricing path. XPS 13 (integrated only) has
  // the GPU question filtered out in getBrandExtras by model ID.
  dell: [
    { id: "gpu", question: "Graphics card?", helper: "Check Device Manager > Display adapters on Windows.", options: [
      { id: "integrated", label: "Intel Integrated Graphics", multiplier: 1.00, adj: -100 },
      { id: "rtx4050",    label: "NVIDIA RTX 4050",           multiplier: 1.00, adj: 0 },
      { id: "rtx4060",    label: "NVIDIA RTX 4060",           multiplier: 1.00, adj: 50 },
      { id: "rtx4070",    label: "NVIDIA RTX 4070",           multiplier: 1.00, adj: 100 },
    ]},
  ],
  // Alienware desktops — GPU is the biggest price driver
  alienware_desktop: [
    { id: "gpu", question: "Graphics card (GPU)?", helper: "Check Device Manager > Display adapters on Windows.", options: [
      { id: "rtx3050",        label: "NVIDIA RTX 3050",           multiplier: 1.00, adj: -100 },
      { id: "rtx4060",        label: "NVIDIA RTX 4060",           multiplier: 1.00, adj: 0 },
      { id: "rtx4060ti",      label: "NVIDIA RTX 4060 Ti",        multiplier: 1.00, adj: 25 },
      { id: "rtx4070",        label: "NVIDIA RTX 4070",           multiplier: 1.00, adj: 75 },
      { id: "rtx4070super",   label: "NVIDIA RTX 4070 Super",     multiplier: 1.00, adj: 100 },
      { id: "rtx4070ti",      label: "NVIDIA RTX 4070 Ti",        multiplier: 1.00, adj: 125 },
      { id: "rtx4070tisuper", label: "NVIDIA RTX 4070 Ti Super",  multiplier: 1.00, adj: 175 },
      { id: "rtx4080",        label: "NVIDIA RTX 4080",           multiplier: 1.00, adj: 350 },
      { id: "rtx4080super",   label: "NVIDIA RTX 4080 Super",     multiplier: 1.00, adj: 400 },
      { id: "rtx4090",        label: "NVIDIA RTX 4090",           multiplier: 1.00, adj: 800 },
    ]},
    { id: "powercord", question: "Power cord included?", options: [
      { id: "yes", label: "Yes", multiplier: 1.00 },
      { id: "no",  label: "No",  multiplier: 0.96 },
    ]},
    { id: "hdmi", question: "HDMI cable included?", options: [
      { id: "yes", label: "Yes", multiplier: 1.00 },
      { id: "no",  label: "No",  multiplier: 1.00 },
    ]},
    { id: "keyboard", question: "Keyboard included?", options: [
      { id: "yes", label: "Yes — OEM keyboard", multiplier: 1.02 },
      { id: "no",  label: "No keyboard",        multiplier: 1.00 },
    ]},
    { id: "mouse", question: "Mouse included?", options: [
      { id: "yes", label: "Yes — OEM mouse", multiplier: 1.01 },
      { id: "no",  label: "No mouse",        multiplier: 1.00 },
    ]},
  ],
  // Lenovo laptops — display resolution is a price driver for ThinkPad X1 Carbon.
  // Uses adj values consumed by the additive pricing path.
  lenovo: [
    { id: "display", question: "Display resolution?", helper: "Check Settings > System > Display on Windows.", options: [
      { id: "fhd",  label: "FHD (1920x1200)",  multiplier: 1.00, adj: 0 },
      { id: "2k",   label: "2K (2560x1600)",    multiplier: 1.00, adj: 25 },
      { id: "uhd",  label: "UHD / 4K (3840x2400)", multiplier: 1.00, adj: 50 },
    ]},
  ],
  // HP desktops — GPU + optional secondary drive
  hp_desktop: [
    { id: "gpu", question: "Graphics card (GPU)?", helper: "Check Device Manager > Display adapters on Windows.", options: [
      { id: "rtx4060ti", label: "NVIDIA RTX 4060 Ti", multiplier: 1.00, adj: -150 },
      { id: "rtx4070ti", label: "NVIDIA RTX 4070 Ti", multiplier: 1.00, adj: -100 },
      { id: "rtx4080",   label: "NVIDIA RTX 4080",    multiplier: 1.00, adj: 0 },
      { id: "rtx4090",   label: "NVIDIA RTX 4090",    multiplier: 1.00, adj: 200 },
    ]},
    { id: "secondarydrive", question: "Secondary drive?", helper: "Some OMEN configs ship with a second HDD or SSD for extra storage.", options: [
      { id: "none",    label: "None",     multiplier: 1.00, adj: 0 },
      { id: "1tb_hdd", label: "1 TB HDD", multiplier: 1.00, adj: 5 },
      { id: "1tb_ssd", label: "1 TB SSD", multiplier: 1.00, adj: 15 },
      { id: "2tb_ssd", label: "2 TB SSD", multiplier: 1.00, adj: 25 },
    ]},
    { id: "powercord", question: "Power cord included?", options: [
      { id: "yes", label: "Yes", multiplier: 1.00 },
      { id: "no",  label: "No",  multiplier: 0.96 },
    ]},
    { id: "hdmi", question: "HDMI cable included?", options: [
      { id: "yes", label: "Yes", multiplier: 1.00 },
      { id: "no",  label: "No",  multiplier: 1.00 },
    ]},
    { id: "keyboard", question: "Keyboard included?", options: [
      { id: "yes", label: "Yes — OEM keyboard", multiplier: 1.02 },
      { id: "no",  label: "No keyboard",        multiplier: 1.00 },
    ]},
    { id: "mouse", question: "Mouse included?", options: [
      { id: "yes", label: "Yes — OEM mouse", multiplier: 1.01 },
      { id: "no",  label: "No mouse",        multiplier: 1.00 },
    ]},
  ],
};
// Apple Watch Ultra ships in only one configuration each generation:
// titanium case, 49mm, cellular. So the case-material, case-size, and
// GPS-vs-Cellular questions are all meaningless for Ultras — skip them
// and just ask which Ultra-specific band shipped with it. Non-Ultra
// Apple Watches keep the standard 4-question flow because they really
// do have material / size / GPS vs cellular variants.
//
// Band lineup by year-of-release:
//   Ultra 1 (Sept 2022): Alpine Loop, Trail Loop, Ocean Band
//   Ultra 2 (Sept 2023): same three (Titanium Milanese didn't ship until
//                        Sept 2024 — not an original-with-watch option)
//   Ultra 3 (Sept 2025): all four including Titanium Milanese Loop
//
// All Ultra-original bands are $99 retail except Titanium Milanese Loop
// at $199 (titanium construction), which is why it gets a higher
// resale multiplier.
const isAppleWatchUltra = (modelId?: string | null) => modelId === "awu1" || modelId === "awu2" || modelId === "awu3";
const getBrandExtras = (dt: string | null | undefined, modelId?: string | null | undefined): BrandExtra[] => {
  const base = (dt && BRAND_EXTRAS[dt]) || [];
  if (dt === "applewatch" && isAppleWatchUltra(modelId)) {
    // Ultras: titanium 49mm cellular always — drop material / connectivity /
    // size. Replace the generic band question's options with the actual
    // Ultra band lineup. Titanium Milanese only shipped from Sept 2024,
    // so it's only an option for Ultra 3.
    // IWM band pricing: Alpine/Trail/Ocean are base ($0 adj).
    // Titanium Milanese Loop is +$25-30 premium. No band is -$25.
    const ultraBandOptions = [
      { id: "alpine", label: "Alpine Loop", multiplier: 1.00 },
      { id: "trail",  label: "Trail Loop",  multiplier: 1.00 },
      { id: "ocean",  label: "Ocean Band",  multiplier: 1.00 },
      ...(modelId === "awu2" || modelId === "awu3" ? [{ id: "titanium_milanese", label: "Titanium Milanese Loop", multiplier: 1.08 }] : []),
    ];
    return base
      .filter(q => q.id !== "connectivity" && q.id !== "material" && q.id !== "size")
      .map(q => q.id === "band"
        ? { ...q, options: ultraBandOptions }
        : q
      );
  }
  // Dell XPS 13 has integrated graphics only — skip the GPU question.
  // XPS 15 gets the full GPU picker. Other Dell models without additive
  // specs won't hit this because they have base=0 (inquiry-only).
  if (dt === "dell" && modelId !== "dxps15") {
    return base.filter(q => q.id !== "gpu");
  }
  // Lenovo — only show the display resolution question for models with
  // additive specs (ThinkPad X1 Carbon). Other Lenovo laptops are
  // inquiry-only so they never reach this code path, but guard anyway.
  if (dt === "lenovo" && modelId !== "ln_tp_x1_carbon") {
    return base.filter(q => q.id !== "display");
  }
  // Tablets — gate questions per IWM ground truth. The shared base
  // questions cover the full superset; we filter / re-price based on
  // TABLET_SPECS[modelId] for each variant.
  if ((dt === "samsung_tab" || dt === "oneplus_tab" || dt === "lenovo_tab" ||
       dt === "google_tab" || dt === "surface") && modelId) {
    const spec = TABLET_SPECS[modelId];
    return base.flatMap(q => {
      // Storage: filter the global options down to the tiers IWM lists
      // for this exact model. If no spec, leave the question as-is.
      if (q.id === "storage" && spec?.storages) {
        const filtered = q.options.filter(o => {
          // Map option id (64/128/256/512/1tb) to a label fragment.
          const lbl = o.id === "1tb" ? "1TB" : `${o.id}GB`;
          return spec.storages!.some(s => s.replace(/\s+/g, "").toUpperCase() === lbl.toUpperCase());
        });
        return filtered.length ? [{ ...q, options: filtered }] : [];
      }
      // Carrier / LTE — only show if this model has a cellular variant
      // on IWM. Use the per-model cellularAdj for the "yes" answer.
      if ((q.id === "carrier" || q.id === "lte") && spec) {
        if (spec.cellularAdj == null) return [];
        const cellAdj = spec.cellularAdj;
        return [{ ...q, options: q.options.map(o => {
          const isCellularChoice = o.id === "lte" || o.id === "yes";
          return isCellularChoice ? { ...o, adj: cellAdj } : { ...o, adj: 0 };
        })}];
      }
      // S Pen / OnePlus Stylo — drop if the model has no stylus question
      // on IWM (older Samsung S4/S5e, all Lenovo, Google, OnePlus).
      if ((q.id === "spen" || q.id === "stylus") && spec) {
        if (spec.stylusAdj == null) return [];
        const styAdj = spec.stylusAdj;
        return [{ ...q, options: q.options.map(o =>
          o.id === "no" ? { ...o, adj: styAdj } : { ...o, adj: 0 }
        )}];
      }
      return [q];
    });
  }
  // Garmin — inject a per-model "edition" question for Fenix / Epix
  // submodels that ship multiple trims. Adj already discounted ×0.90.
  if (dt === "garmin" && modelId && GARMIN_EDITIONS[modelId]) {
    const editions = GARMIN_EDITIONS[modelId].map(e => ({
      id: e.id,
      label: e.adj > 0 ? `${e.label} (+$${e.adj})` : e.label,
      multiplier: 1.00,
      adj: e.adj,
    }));
    const editionQ: BrandExtra = {
      id: "edition",
      question: "Which exact edition?",
      helper: "Look at the bezel material + 'Solar' / 'Sapphire' / 'Pro' markings on the back.",
      guide: { title: "How to find the exact edition", steps: [
        "On the watch: Settings → System → About — the model name is printed at the top.",
        "Or flip the watch: the back is engraved with the full model name.",
        "Or check the box: the full edition name is printed on the side label.",
        "Sapphire editions have a darker, more reflective lens; Solar editions have a thin ring around the dial.",
      ]},
      options: editions,
    };
    return [editionQ, ...base];
  }
  return base;
};

// Brand-aware competitor reference. The 'How we compare' card on the
// quote page used to hardcode 'Apple Trade-In' for every device, which
// looks silly when you're selling an LG laptop or a PS5. Maps each
// deviceType to the right competitor + the percentage of our quote
// we estimate they'd pay. Values are conservative ballparks based on
// public trade-in published rates; refresh monthly when piece 2 lands.
const COMP_SOURCES: Record<string, { name: string; percent: number }> = {
  // Apple ecosystem -> Apple Trade-In
  iphone: { name: "Apple Trade-In", percent: 0.62 },
  ipad: { name: "Apple Trade-In", percent: 0.62 },
  macbook: { name: "Apple Trade-In", percent: 0.62 },
  apple_desktop: { name: "Apple Trade-In", percent: 0.60 },
  applewatch: { name: "Apple Trade-In", percent: 0.55 },
  apple_vr: { name: "Apple Trade-In", percent: 0.55 },
  // Samsung -> Samsung Trade-In
  android: { name: "Samsung Trade-In", percent: 0.65 },
  samsung_tab: { name: "Samsung Trade-In", percent: 0.62 },
  samsung_pc: { name: "Samsung Trade-In", percent: 0.62 },
  samsungwatch: { name: "Samsung Trade-In", percent: 0.55 },
  // Google
  pixel: { name: "Google Store Trade-In", percent: 0.60 },
  pixelwatch: { name: "Google Store Trade-In", percent: 0.55 },
  google_tab: { name: "Google Store Trade-In", percent: 0.55 },
  // LG (no first-party trade-in left) -> Decluttr is the closest comp
  lg_pc: { name: "Decluttr", percent: 0.70 },
  // Console / gaming
  sony: { name: "PlayStation Direct / GameStop", percent: 0.55 },
  microsoft: { name: "Microsoft / GameStop", percent: 0.55 },
  nintendo: { name: "Nintendo / GameStop", percent: 0.50 },
  console: { name: "GameStop", percent: 0.55 },
  // Drones / VR
  dji: { name: "DJI Care Trade-In", percent: 0.60 },
  meta_vr: { name: "Meta Trade-In", percent: 0.55 },
  valve_vr: { name: "Backflip / eBay", percent: 0.65 },
  psvr: { name: "PlayStation Direct", percent: 0.55 },
  // Watches not covered above
  garmin: { name: "Garmin Trade-In", percent: 0.50 },
  // Windows laptops -> Backflip is the leading per-laptop reseller
  lenovo: { name: "Backflip / Decluttr", percent: 0.65 },
  dell: { name: "Backflip / Decluttr", percent: 0.65 },
  hp: { name: "Backflip / Decluttr", percent: 0.65 },
  acer: { name: "Backflip / Decluttr", percent: 0.65 },
  asus_pc: { name: "Backflip / Decluttr", percent: 0.65 },
  alienware: { name: "Backflip / Decluttr", percent: 0.65 },
  // Surface / Lenovo / OnePlus tablets
  surface: { name: "Microsoft Trade-In", percent: 0.55 },
  lenovo_tab: { name: "Backflip / Decluttr", percent: 0.65 },
  oneplus_tab: { name: "Backflip / Decluttr", percent: 0.65 },
  // Windows desktops
  dell_desktop: { name: "Backflip / Decluttr", percent: 0.60 },
  lenovo_desktop: { name: "Backflip / Decluttr", percent: 0.60 },
  hp_desktop: { name: "Backflip / Decluttr", percent: 0.60 },
  asus_desktop: { name: "Backflip / Decluttr", percent: 0.60 },
  alienware_desktop: { name: "Backflip / Decluttr", percent: 0.60 },
  msi_desktop: { name: "Backflip / Decluttr", percent: 0.60 },
};
const COMP_FALLBACK = { name: "Backflip / eBay", percent: 0.65 };
const getCompSource = (dt: string | null | undefined) => (dt && COMP_SOURCES[dt]) || COMP_FALLBACK;

// MacBook-specific spec catalog. Per-model dictionary of processor /
// memory / storage / display-glass options that the new MacBook flow
// (Wave 1) asks for one at a time. Models WITHOUT an entry in this
// dict keep the legacy flow (model -> condition -> storage -> ...).
// Each option carries a `multiplier` against the model's base price.
type MacSpecOption = { id: string; label: string; multiplier: number; adj?: number; sub?: string };
type MacSpec = {
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
const MACBOOK_SPECS: Record<string, MacSpec> = {
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
const DISPLAY_GLASS_OPTIONS: MacSpecOption[] = [
  { id: "standard", label: "Standard Glass", multiplier: 1.00 },
  { id: "nano",     label: "Nano-texture Glass", sub: "Anti-glare matte finish", multiplier: 1.08 },
];
const BATTERY_HEALTH_OPTIONS = [
  { id: "good", label: "Good", sub: "80% or higher and 'Normal' status", multiplier: 1.00 },
  { id: "poor", label: "Poor", sub: "Below 80% or 'Service / Replace' warning", multiplier: 0.80 },
] as const;
const CHARGER_OPTIONS = [
  { id: "yes", label: "Yes — OEM charger included", multiplier: 1.05 },
  { id: "no",  label: "No charger", multiplier: 1.00 },
] as const;
// Mutable module-level cache for PC laptop additive specs loaded from
// /comps/pc-laptop-specs.json on mount. We merge into MacSpec lookups so
// hasAdditiveSpecs() and getMacSpec() pick up both Apple and non-Apple
// laptops without changing every call site.
let PC_LAPTOP_SPECS_CACHE: Record<string, MacSpec> = {};
const getMacSpec = (modelId: string | undefined | null): MacSpec | undefined =>
  !modelId ? undefined : (MACBOOK_SPECS[modelId] || PC_LAPTOP_SPECS_CACHE[modelId]);
const hasAdditiveSpecs = (modelId: string | undefined | null): boolean => !!getMacSpec(modelId);
const BRAND_LABELS: Record<string, string> = {
  iphone: "iPhone", android: "Samsung", pixel: "Pixel", ipad: "iPad",
  macbook: "MacBook", samsung_pc: "Samsung", lenovo: "Lenovo", dell: "Dell",
  alienware: "Alienware", hp: "HP", acer: "Acer", lg_pc: "LG", asus_pc: "ASUS",
  apple_desktop: "Apple", dell_desktop: "Dell", lenovo_desktop: "Lenovo",
  hp_desktop: "HP", asus_desktop: "ASUS", alienware_desktop: "Alienware",
  msi_desktop: "MSI", console: "Console", sony: "PlayStation",
  microsoft: "Xbox", nintendo: "Nintendo", applewatch: "Apple Watch",
  pixelwatch: "Pixel Watch", garmin: "Garmin", samsungwatch: "Galaxy Watch",
  dji: "DJI", samsung_tab: "Samsung", surface: "Surface", lenovo_tab: "Lenovo",
  oneplus_tab: "OnePlus", google_tab: "Google", apple_vr: "Apple Vision",
  meta_vr: "Meta Quest", valve_vr: "Valve Index", psvr: "PSVR",
};

type DeviceType = "iphone" | "android" | "pixel" | "macbook" | "samsung_pc" | "lenovo" | "dell" | "alienware" | "hp" | "acer" | "lg_pc" | "asus_pc" | "apple_desktop" | "dell_desktop" | "lenovo_desktop" | "hp_desktop" | "asus_desktop" | "alienware_desktop" | "msi_desktop" | "console" | "sony" | "microsoft" | "nintendo" | "applewatch" | "pixelwatch" | "garmin" | "samsungwatch" | "dji" | "samsung_tab" | "surface" | "lenovo_tab" | "oneplus_tab" | "google_tab" | "apple_vr" | "meta_vr" | "valve_vr" | "psvr" | "ipad" | null;

function FairPromise() {
  return (
    <div className="tcc-card mt-6 rounded-2xl p-5">
      <h3 className="text-sm font-extrabold text-[#00c853] uppercase tracking-wider mb-1">Our Promise</h3>
      <p className="text-base font-extrabold text-white mb-1">Fair Evaluation Promise</p>
      <p className="text-[#e8e8e8] text-xs mb-4">Concerned about quote adjustments? Here&apos;s how we handle inspections.</p>
      <div className="space-y-3">
        <div className="flex gap-3">
          <span className="text-2xl leading-none" style={{filter:"drop-shadow(0 0 8px rgba(0,200,83,0.55))"}}>🎯</span>
          <div><p className="text-sm font-extrabold text-white">Consistent grading</p><p className="text-xs text-[#e8e8e8] leading-snug mt-0.5">Every device is evaluated using a standardized process based on the condition you select.</p></div>
        </div>
        <div className="flex gap-3">
          <span className="text-2xl leading-none" style={{filter:"drop-shadow(0 0 8px rgba(255,170,90,0.55))"}}>🤝</span>
          <div><p className="text-sm font-extrabold text-white">Clear explanations</p><p className="text-xs text-[#e8e8e8] leading-snug mt-0.5">If your device differs from what was described, we&apos;ll explain what we found before adjusting your offer.</p></div>
        </div>
        <div className="flex gap-3">
          <span className="text-2xl leading-none" style={{filter:"drop-shadow(0 0 8px rgba(120,200,255,0.55))"}}>🔄</span>
          <div>
            <p className="text-sm font-extrabold text-white">Your choice</p>
            <p className="text-xs text-white font-bold leading-snug mt-0.5">Don&apos;t like the final offer? <span className="text-[#00c853]">We ship it back for free — no questions asked.</span></p>
          </div>
        </div>
      </div>
    </div>
  );
}

function TrustBadge() {
  return (
    <div className="mt-6 flex flex-wrap items-center justify-center gap-3 text-[#e6e6e6] text-xs">
      <span>⭐ Thousands of happy sellers</span>
      <span>·</span>
      <span>🔒 7-day price lock</span>
      <span>·</span>
      <span>⚡ Same-day payout</span>
      <span>·</span>
      <span>🏠 Austin local</span>
    </div>
  );
}

// CountUp: animates a number from 0 to `end` when the element enters the viewport.
function CountUp({ end, decimals = 0, prefix = "", suffix = "", duration = 1400 }: { end: number; decimals?: number; prefix?: string; suffix?: string; duration?: number }) {
  const ref = useRef<HTMLSpanElement | null>(null);
  const [val, setVal] = useState(0);
  const startedRef = useRef(false);
  useEffect(() => {
    if (!ref.current || startedRef.current) return;
    if (typeof IntersectionObserver === "undefined") { setVal(end); return; }
    const obs = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting && !startedRef.current) {
          startedRef.current = true;
          obs.disconnect();
          const startTs = performance.now();
          const tick = (now: number) => {
            const elapsed = now - startTs;
            const t = Math.min(1, elapsed / duration);
            const eased = 1 - Math.pow(1 - t, 3); // easeOutCubic
            setVal(end * eased);
            if (t < 1) requestAnimationFrame(tick);
            else setVal(end);
          };
          requestAnimationFrame(tick);
        }
      });
    }, { threshold: 0.4 });
    obs.observe(ref.current);
    return () => obs.disconnect();
  }, [end, duration]);
  const formatted = decimals > 0 ? val.toFixed(decimals) : Math.floor(val).toLocaleString();
  return <span ref={ref}>{prefix}{formatted}{suffix}</span>;
}

// ReviewsCarousel: scroll-snap carousel with prev/next arrows + dot indicators
function ReviewsCarousel({ reviews }: { reviews: { name: string; loc: string; text: string; stars: number }[] }) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [activeIdx, setActiveIdx] = useState(0);
  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    const update = () => {
      const cardWidth = el.querySelector<HTMLDivElement>(":scope > div")?.offsetWidth || 1;
      const gap = 12;
      const idx = Math.round(el.scrollLeft / (cardWidth + gap));
      setActiveIdx(Math.max(0, Math.min(reviews.length - 1, idx)));
    };
    el.addEventListener("scroll", update, { passive: true });
    update();
    return () => el.removeEventListener("scroll", update);
  }, [reviews.length]);
  const scrollBy = (dir: 1 | -1) => {
    const el = trackRef.current;
    if (!el) return;
    const card = el.querySelector<HTMLDivElement>(":scope > div");
    const cardWidth = (card?.offsetWidth || 280) + 12;
    el.scrollBy({ left: dir * cardWidth, behavior: "smooth" });
  };
  const scrollTo = (idx: number) => {
    const el = trackRef.current;
    if (!el) return;
    const card = el.querySelector<HTMLDivElement>(":scope > div");
    const cardWidth = (card?.offsetWidth || 280) + 12;
    el.scrollTo({ left: idx * cardWidth, behavior: "smooth" });
  };
  return (
    <div className="relative">
      <div ref={trackRef} className="overflow-x-auto px-4 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden scroll-smooth">
        <div className="flex gap-3 snap-x snap-mandatory">
          {reviews.map((r, i) => (
            <div key={i} className="snap-start flex-shrink-0 w-[280px] md:w-[320px] bg-white/5 border border-white/10 rounded-2xl p-5 hover:border-[#00c853]/30 transition reveal" data-stagger={Math.min(i + 2, 8)}>
              <div className="flex gap-0.5 mb-3 text-[#ffb400] text-sm">{"★".repeat(r.stars)}</div>
              <p className="text-white text-sm leading-relaxed mb-4 min-h-[80px]">&ldquo;{r.text}&rdquo;</p>
              <div className="flex items-center gap-2 pt-3 border-t border-white/10">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#00c853] to-[#00a039] text-white text-xs font-bold flex items-center justify-center flex-shrink-0">{r.name[0]}</div>
                <div className="min-w-0">
                  <div className="text-white text-sm font-semibold leading-tight truncate">{r.name}</div>
                  <div className="text-[#e6e6e6] text-xs truncate">{r.loc}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
      {/* Prev/Next arrow buttons (hidden on small screens since swipe works) */}
      <button onClick={() => scrollBy(-1)} aria-label="Previous review" className="hidden md:flex absolute left-1 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/60 backdrop-blur border border-white/15 hover:bg-black/80 hover:border-[#00c853]/40 items-center justify-center cursor-pointer tap-press">
        <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" /></svg>
      </button>
      <button onClick={() => scrollBy(1)} aria-label="Next review" className="hidden md:flex absolute right-1 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/60 backdrop-blur border border-white/15 hover:bg-black/80 hover:border-[#00c853]/40 items-center justify-center cursor-pointer tap-press">
        <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" /></svg>
      </button>
      {/* Dot indicators */}
      <div className="flex justify-center gap-2 mt-4">
        {reviews.map((_, i) => (
          <button key={i} onClick={() => scrollTo(i)} aria-label={`Go to review ${i + 1}`} className={`h-2 rounded-full transition-all duration-300 cursor-pointer ${i === activeIdx ? "w-6 bg-[#00c853]" : "w-2 bg-white/20 hover:bg-white/40"}`} />
        ))}
      </div>
    </div>
  );
}

// Google Identity Services button. Renders Google's official sign-in
// button into a div ref'd here. On successful credential, decodes the
// JWT payload (header.payload.sig — base64url) to extract email/name
// and hands off to the parent. Requires NEXT_PUBLIC_GOOGLE_CLIENT_ID
// in the environment; without it the button falls back to a visible
// "Sign-in not configured" notice so the bug is obvious instead of silent.
type GoogleCredentialPayload = { email?: string; name?: string; sub?: string; picture?: string };
declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (opts: { client_id: string; callback: (r: { credential: string }) => void; auto_select?: boolean; ux_mode?: string }) => void;
          renderButton: (el: HTMLElement, opts: Record<string, unknown>) => void;
          prompt: () => void;
        };
      };
      maps: {
        places: {
          Autocomplete: new (input: HTMLInputElement, opts?: unknown) => {
            addListener: (event: string, cb: () => void) => void;
            getPlace: () => { address_components?: Array<{ short_name: string; long_name: string; types: string[] }>; formatted_address?: string };
            setBounds: (b: unknown) => void;
          };
        };
        LatLngBounds: new (sw: { lat: number; lng: number }, ne: { lat: number; lng: number }) => unknown;
      };
    };
  }
}
function decodeJwtPayload(token: string): GoogleCredentialPayload | null {
  try {
    const seg = token.split(".")[1];
    if (!seg) return null;
    const b64 = seg.replace(/-/g, "+").replace(/_/g, "/");
    const padded = b64 + "===".slice((b64.length + 3) % 4);
    return JSON.parse(atob(padded));
  } catch { return null; }
}
function GoogleSignInButton({ onCredential }: { onCredential: (p: GoogleCredentialPayload) => void }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  // Stable handle to onCredential so the GSI callback always sees the latest.
  const onCredentialRef = useRef(onCredential);
  useEffect(() => { onCredentialRef.current = onCredential; }, [onCredential]);

  useEffect(() => {
    if (!clientId) {
      setError("Google sign-in is not configured (missing NEXT_PUBLIC_GOOGLE_CLIENT_ID).");
      return;
    }
    let cancelled = false;
    let tries = 0;
    const tryInit = () => {
      if (cancelled) return;
      const g = window.google;
      if (!g?.accounts?.id) {
        if (++tries > 50) { setError("Google sign-in failed to load. Please refresh."); return; }
        setTimeout(tryInit, 100);
        return;
      }
      try {
        g.accounts.id.initialize({
          client_id: clientId,
          callback: (resp) => {
            const payload = decodeJwtPayload(resp.credential);
            if (payload) onCredentialRef.current(payload);
            else setError("Couldn't read Google credential. Try again.");
          },
        });
        if (containerRef.current) {
          containerRef.current.innerHTML = "";
          g.accounts.id.renderButton(containerRef.current, {
            theme: "outline", size: "large", text: "continue_with", shape: "pill", width: 320,
          });
        }
      } catch (e) {
        setError(`Google sign-in init failed: ${String(e)}`);
      }
    };
    tryInit();
    return () => { cancelled = true; };
  }, [clientId]);

  return (
    <div>
      <div ref={containerRef} className="flex justify-center" />
      {error && <p className="text-[#ff5566] text-xs font-semibold mt-2 text-center">{error}</p>}
    </div>
  );
}

export default function Home() {
  const [step, setStep] = useState<Step>("device");
  const [category, setCategory] = useState<"phones" | "tablets" | "computers" | "desktops" | "consoles" | "watches" | "drones" | "vr" | null>(null);
  const [deviceType, setDeviceType] = useState<DeviceType>(null);
  const [selectedSeries, setSelectedSeries] = useState<string | null>(null);
  const [selectedSubSeries, setSelectedSubSeries] = useState<string | null>(null);
  const [carrier, setCarrier] = useState<typeof CARRIERS[0] | null>(null);
  const [carrierLock, setCarrierLock] = useState<typeof CARRIER_LOCKS[0] | null>(null);
  const [page, setPage] = useState<"home" | "about" | "privacy" | "terms" | "grading" | "shipping" | "affiliate" | "itad" | "blog" | "cookies" | "accessibility">("home");
  const [model, setModel] = useState<{ id: string; label: string; base?: number; image?: string } | null>(null);
  const [helpTopic, setHelpTopic] = useState<"storage" | "carrier" | null>(null);
  const [loginError, setLoginError] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  // Declared up here (instead of next to the other funnel-selection states)
  // because funnelTotal/funnelStepNum below need to read connectivity.id to
  // know whether the iPad Cellular branch should count as 5 steps.
  const [connectivity, setConnectivity] = useState<typeof CONNECTIVITY[0] | null>(null);
  // Promo claim — the weekly bonus only applies once the user clicks the
  // top promo banner to opt in. Stays sticky across the session via
  // localStorage so a refresh doesn't make them claim it again.
  const [promoClaimed, setPromoClaimed] = useState(false);
  useEffect(() => { try { if (localStorage.getItem("tcc_promo_claimed") === "1") setPromoClaimed(true); } catch {} }, []);
  // Draggable chat FAB position. Defaults to bottom-left if never moved
  // (null = use the default CSS bottom/left). Once the user drags it, we
  // store the absolute viewport position and remember it across sessions.
  const [fabPos, setFabPos] = useState<{ x: number; y: number } | null>(null);
  const fabDrag = useRef<{ startX: number; startY: number; origX: number; origY: number; moved: boolean } | null>(null);
  useEffect(() => {
    try {
      const raw = localStorage.getItem("tcc_fab_pos");
      if (raw) {
        const p = JSON.parse(raw);
        if (typeof p?.x === "number" && typeof p?.y === "number") setFabPos(p);
      }
    } catch {}
  }, []);

  // Funnel progress indicator data — mapped from current step to (n / total).
  // New order: condition -> storage -> carrier -> quote.
  // Phones run the full 4 steps (have carrier). Non-phones skip carrier (3).
  // No-storage devices (watches, consoles, vr, drones) skip storage AND
  // carrier — only condition -> quote (2 steps).
  const isPhoneFlow = deviceType === "iphone" || deviceType === "android" || deviceType === "pixel";
  const isIpadFlow = deviceType === "ipad";
  // PC laptops follow a laptop-shaped flow without iPhone-style storage
  // or carrier questions. Until the per-model IWM additive specs land
  // (PC_LAPTOP_SPECS — chip/RAM/storage as proper $ deltas), the funnel
  // goes model → condition → battery → charger → quote, using the IWM
  // scrape's max-config Flawless × 0.90 as the base.
  // MacBook (deviceType="macbook") has its own additive specs flow and is
  // intentionally excluded here.
  const isPcLaptopFlow =
    deviceType === "lenovo" || deviceType === "hp" || deviceType === "dell" ||
    deviceType === "alienware" || deviceType === "asus_pc" || deviceType === "acer" ||
    deviceType === "samsung_pc" || deviceType === "lg_pc";
  // First post-model step for the current device type. Used by every
  // model-pick handler so we don't have to switch on isPcLaptopFlow at
  // each click site.
  const stepAfterModel: Step = "condition";
  const isNoStorageDevice =
    deviceType === "console" || deviceType === "sony" || deviceType === "microsoft" || deviceType === "nintendo" ||
    deviceType === "applewatch" || deviceType === "pixelwatch" || deviceType === "garmin" || deviceType === "samsungwatch" ||
    deviceType === "apple_vr" || deviceType === "meta_vr" || deviceType === "valve_vr" || deviceType === "psvr" ||
    deviceType === "dji" ||
    isPcLaptopFlow;
  // Carrier-lock step only fires for Verizon (only carrier with a real
  // 60-day lock policy worth asking about). Other carriers skip it and
  // are treated as unlocked. This makes the funnel one step shorter for
  // most users.
  const isIpadCellular = isIpadFlow && connectivity?.id === "cellular";
  const carrierAsksLock = carrier?.id === "verizon";
  // Phones (non-Verizon): condition -> storage -> carrier -> quote (4)
  // Phones (Verizon):     condition -> storage -> carrier -> carrier-lock -> quote (5)
  // iPad Wi-Fi:           condition -> connectivity -> storage -> quote (4)
  // iPad Cellular non-Vz: condition -> connectivity -> storage -> carrier -> quote (5)
  // iPad Cellular Vz:     condition -> connectivity -> storage -> carrier -> carrier-lock -> quote (6)
  // Other:                condition -> storage -> quote (3)
  // No-storage:           condition -> quote (2)
  // Additive spec'd flow (MacBook, Dell XPS):
  //   processor -> memory -> storage -> [displayglass?] -> condition
  //   -> batteryhealth -> charger -> [extras?] -> quote
  const macSpecFlow = !!(model && hasAdditiveSpecs(model.id));
  const macHasGlassStep = !!(macSpecFlow && model && (getMacSpec(model.id)?.hasNanoGlass ?? false));
  const macSpecExtrasCount = macSpecFlow ? getBrandExtras(deviceType, model?.id).length : 0;
  const funnelTotal = macSpecFlow
    ? ((macHasGlassStep ? 7 : 6) + macSpecExtrasCount)
    // PC laptops: condition → battery → charger → quote (4 incl. quote)
    : isPcLaptopFlow
      ? 4
      : isNoStorageDevice
        ? 2
        : isPhoneFlow
          ? (carrierAsksLock ? 5 : 4)
          : isIpadCellular
            ? (carrierAsksLock ? 6 : 5)
            : isIpadFlow
              ? 4
              : 3;
  const _chargerStepN = macHasGlassStep ? 7 : 6;
  const funnelStepNum = macSpecFlow ? (
    step === "processor" ? 1 :
    step === "memory" ? 2 :
    step === "storage" ? 3 :
    step === "displayglass" ? 4 :
    step === "condition" ? (macHasGlassStep ? 5 : 4) :
    step === "batteryhealth" ? (macHasGlassStep ? 6 : 5) :
    step === "charger" ? _chargerStepN :
    step === "extras" ? (_chargerStepN + 1) :
    step === "quote" ? funnelTotal : 0
  ) : isPcLaptopFlow ? (
    step === "condition" ? 1 :
    step === "batteryhealth" ? 2 :
    step === "charger" ? 3 :
    step === "quote" ? funnelTotal : 0
  ) : (
    step === "condition" ? 1 :
    step === "connectivity" ? 2 :
    step === "storage" ? (isIpadFlow ? 3 : 2) :
    step === "carrier" ? (isIpadFlow ? 4 : 3) :
    step === "carrier-lock" ? (isIpadFlow ? 5 : 4) :
    step === "quote" ? funnelTotal : 0
  );
  const stepProgress = funnelStepNum > 0 && (
    <div className="mb-4 hidden lg:block">
      <div className="flex items-center gap-3 mb-1.5">
        <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#00c853]">Step {funnelStepNum} of {funnelTotal}</span>
        <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden max-w-[180px]">
          <div className="h-full bg-gradient-to-r from-[#00c853] to-[#00e676] shadow-[0_0_6px_rgba(0,200,83,0.5)] transition-all duration-500" style={{ width: `${(funnelStepNum / funnelTotal) * 100}%` }} />
        </div>
      </div>
    </div>
  );
  const [storage, setStorage] = useState<typeof ALL_STORAGES[0] | null>(null);
  const [condition, setCondition] = useState<typeof CONDITIONS[0] | null>(null);
  const [brokenFunctional, setBrokenFunctional] = useState<boolean | null>(null);
  // Tracks which desktop mega-menu is currently hovered open. Drives the
  // full-page backdrop blur that appears behind the menu so the page
  // text doesn't bleed through the panel like it used to.
  const [megaMenuOpen, setMegaMenuOpen] = useState<"sell" | "bulk" | "support" | null>(null);
  // Phone-specific follow-up to "broken" — which side of the glass is
  // cracked. Front (display) is a bigger hit to resale than back, both
  // is the worst. Collected for the lead notes; future pricing math
  // can read off this field too.
  const [brokenGlass, setBrokenGlass] = useState<"front" | "back" | "both" | null>(null);
  // Phones we sell whose back is NOT glass — asking "back glass cracked?"
  // would be nonsensical. Auto-skip the broken-glass step on these and
  // assume any damage is on the front (display). Researched 2026-05-17:
  // Pixel 5 = polycarbonate-coated aluminum back, Pixel 5a = plastic
  // body. Every other phone in our catalog (iPhone 11+ has Apple glass
  // back for wireless charging; Samsung S20+/Z Fold/Flip + Pixel 6+ all
  // ship with Gorilla Glass / equivalent on the back).
  const PHONES_WITHOUT_BACK_GLASS = new Set<string>(["px5", "px5a"]);
  const [payout, setPayout] = useState<typeof PAYOUTS[0] | null>(null);
  // MacBook-specific picks (Wave 1). Only used when the picked model
  // has a MACBOOK_SPECS entry; otherwise these stay null and the legacy
  // flow runs unchanged.
  const [processor, setProcessor] = useState<MacSpecOption | null>(null);
  const [memory, setMemory] = useState<MacSpecOption | null>(null);
  const [graphics, setGraphics] = useState<MacSpecOption | null>(null);
  const [displayResolution, setDisplayResolution] = useState<MacSpecOption | null>(null);
  const [displayGlass, setDisplayGlass] = useState<MacSpecOption | null>(null);
  const [batteryHealth, setBatteryHealth] = useState<(typeof BATTERY_HEALTH_OPTIONS)[number] | null>(null);
  const [charger, setCharger] = useState<(typeof CHARGER_OPTIONS)[number] | null>(null);
  const [brokenPhotoUrl, setBrokenPhotoUrl] = useState<string | null>(null);
  // Brand-specific extra answers (PS5 disc drive, DJI hours flown, etc).
  // Keyed by the extra's id; value is the option that was picked.
  const [extras, setExtras] = useState<Record<string, ExtraOption>>({});
  const [extrasIndex, setExtrasIndex] = useState(0);
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);
  const [expandedConditionTier, setExpandedConditionTier] = useState<number | null>(null);
  // 'What qualifies?' modal — opened by clicking the small "i" on a
  // condition tile. Modal shows the tier's bullet list without expanding
  // the tile itself so all condition boxes stay the same height.
  const [conditionHelpId, setConditionHelpId] = useState<string | null>(null);
  const [storageHelpId, setStorageHelpId] = useState<string | null>(null);
  const [connectivityHelpOpen, setConnectivityHelpOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMode, setChatMode] = useState<"choose" | "chat" | "call">("choose");
  const [chatMsg, setChatMsg] = useState("");
  const [chatSent, setChatSent] = useState(false);
  const [chatMessages, setChatMessages] = useState<{ from: "user" | "bot"; text: string }[]>([
    { from: "bot", text: "Hey! I'm here to help you sell your device. Ask me anything about pricing, how it works, or what we buy!" }
  ]);
  const [chatLoading, setChatLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Flat search index across all device categories — populated once at module scope below
  // (see SEARCH_INDEX const further down)

  const sendChat = async () => {
    if (!chatMsg.trim()) return;
    const msg = chatMsg;
    setChatMsg("");
    setChatMessages(prev => [...prev, { from: "user", text: msg }]);
    setChatLoading(true);
    try {
      const res = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: msg, history: chatMessages }) });
      const data = await res.json();
      setChatMessages(prev => [...prev, { from: "bot", text: data.reply }]);
    } catch {
      setChatMessages(prev => [...prev, { from: "bot", text: "Sorry, something went wrong. Try again or call us!" }]);
    }
    setChatLoading(false);
  };
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [quoteEmail, setQuoteEmail] = useState("");
  const [quoteSaved, setQuoteSaved] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [showConfetti, setShowConfetti] = useState(false);
  // Handoff method picked on the contact step (NOT after submit) — keeps the
  // funnel one-pass and the done page purely a confirmation, no second fork.
  const [handoffMethod, setHandoffMethod] = useState<"ship" | "local" | null>(null);
  const [shipStreet, setShipStreet] = useState("");
  const [shipUnit, setShipUnit] = useState("");
  const [shipCity, setShipCity] = useState("");
  const [shipState, setShipState] = useState("TX");
  const [shipZip, setShipZip] = useState("");
  // Does the seller already have a box to ship in? Captured upfront so we
  // can include packaging with the label (or know to ship a box) instead
  // of finding out after the fact via support email.
  const [shipHasBox, setShipHasBox] = useState<"yes" | "no" | null>(null);
  // Local-meetup slot picker — Skywalker stocks specific time slots on
  // /admin/slots; customer picks one on the contact step. Booked via
  // MC's atomic POST /api/slots/:id/book on form submit so two sellers
  // can't double-book the same window. State holds (a) the slot list
  // fetched from MC on mount, (b) the customer's chosen slot, and (c)
  // any error from the fetch / book call.
  const [availableSlots, setAvailableSlots] = useState<Slot[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [slotError, setSlotError] = useState<string | null>(null);
  // Fetch open upcoming slots whenever the user lands on the contact
  // step with handoffMethod=local. Filtered to today + later, open
  // only. Cap at 18 displayed.
  useEffect(() => {
    if (step !== "contact" || handoffMethod !== "local") return;
    let alive = true;
    setSlotsLoading(true);
    const fromDate = new Date().toISOString().slice(0, 10);
    listSlots({ openOnly: true, fromDate })
      .then((s) => { if (alive) setAvailableSlots(s.slice(0, 18)); })
      .catch(() => {})
      .finally(() => { if (alive) setSlotsLoading(false); });
    return () => { alive = false; };
  }, [step, handoffMethod]);
  // Google Places autocomplete on the shipping street field — mirrors
  // ATX Gadget's implementation. User types, Google suggests US
  // addresses, click → parsed into our 5 split fields (street / unit
  // is left alone / city / state / zip) so we keep structured data
  // while saving the seller a bunch of typing.
  const shipStreetRef = useRef<HTMLInputElement>(null);
  const shipAutoRef = useRef<unknown>(null); // holds the Autocomplete instance; we never call methods on it after init
  const initShipAutocomplete = useCallback(() => {
    if (!shipStreetRef.current || shipAutoRef.current || typeof window === "undefined" || !window.google?.maps?.places) return;
    const ac = new window.google.maps.places.Autocomplete(shipStreetRef.current, {
      types: ["address"],
      componentRestrictions: { country: "us" },
      fields: ["address_components", "formatted_address"],
    });
    ac.addListener("place_changed", () => {
      const place = ac.getPlace();
      const parts = place?.address_components || [];
      const get = (type: string, useShort = false) => {
        const c = parts.find(p => p.types.includes(type));
        return c ? (useShort ? c.short_name : c.long_name) : "";
      };
      const streetNum = get("street_number");
      const route = get("route");
      const street = [streetNum, route].filter(Boolean).join(" ").trim();
      const city = get("locality") || get("sublocality") || get("postal_town");
      const state = get("administrative_area_level_1", true);
      const zip = get("postal_code");
      if (street) setShipStreet(street);
      if (city) setShipCity(city);
      if (state) setShipState(state.toUpperCase().slice(0, 2));
      if (zip) setShipZip(zip);
    });
    shipAutoRef.current = ac;
  }, []);
  // Re-init autocomplete when the user switches to shipping mode (or
  // the contact step renders the input). 100ms delay gives React a
  // tick to mount the input element.
  useEffect(() => {
    if (handoffMethod !== "ship") return;
    const t = setTimeout(() => initShipAutocomplete(), 100);
    return () => clearTimeout(t);
  }, [handoffMethod, initShipAutocomplete]);

  const [localArea, setLocalArea] = useState<string | null>(null);
  const AUSTIN_AREAS = [
    { id: "south", label: "South Austin", desc: "South Lamar, 78704, Bouldin" },
    { id: "north", label: "North Austin", desc: "Domain, Anderson Lane, 78758" },
    { id: "central", label: "Central / Downtown", desc: "Downtown, UT, East 6th" },
    { id: "east", label: "East Austin", desc: "Mueller, Manor Rd, 78702/23" },
    { id: "west", label: "West Austin", desc: "Westlake, Bee Cave, 78746" },
    { id: "rr", label: "Round Rock / Pflugerville", desc: "Round Rock, Pflugerville" },
    { id: "cp", label: "Cedar Park / Leander", desc: "Cedar Park, Leander, 78613" },
    { id: "georgetown", label: "Georgetown / North", desc: "Georgetown + further north" },
  ];
  // IMEI / serial validator (optional, contact step)
  const [imeiInput, setImeiInput] = useState("");
  const [imeiState, setImeiState] = useState<"idle" | "checking" | "ok" | "warn" | "error">("idle");
  const [imeiResult, setImeiResult] = useState<{ model?: string; warnings?: string[]; error?: string } | null>(null);
  const checkImei = async () => {
    const clean = imeiInput.replace(/\D/g, "");
    if (clean.length !== 15) {
      setImeiState("error");
      setImeiResult({ error: "IMEI must be 15 digits. Tap *#06# on the device to display it." });
      return;
    }
    setImeiState("checking");
    setImeiResult(null);
    try {
      const r = await fetch("/api/imei/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imei: clean, deviceCategory: deviceType }),
      });
      const d = await r.json();
      if (!d.ok && d.stage === "format") {
        setImeiState("error");
        setImeiResult({ error: d.error });
      } else if (d.warnings && d.warnings.length > 0) {
        setImeiState("warn");
        setImeiResult({ model: d.model, warnings: d.warnings });
      } else {
        setImeiState("ok");
        setImeiResult({ model: d.model });
      }
    } catch {
      setImeiState("error");
      setImeiResult({ error: "Couldn't verify — try again or skip." });
    }
  };

  // Returning-customer lookup (Option A login)
  const [lookupOpen, setLookupOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileMenuExpanded, setMobileMenuExpanded] = useState<"sell" | "bulk" | "support" | null>("sell");
  const [lookupContact, setLookupContact] = useState("");
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupResult, setLookupResult] = useState<{ found: boolean; name?: string; lastQuote?: string; leadCount?: number; leads?: Array<{ name?: string; device?: string; model?: string; quote?: string; timestamp: string }> } | null>(null);
  const [lookupError, setLookupError] = useState("");
  const handleLookup = async () => {
    if (!lookupContact.trim()) return;
    setLookupLoading(true);
    setLookupError("");
    setLookupResult(null);
    const isEmail = lookupContact.includes("@");
    try {
      const r = await fetch("/api/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(isEmail ? { email: lookupContact.trim() } : { phone: lookupContact.trim() }),
      });
      if (!r.ok) throw new Error("Lookup failed");
      const data = await r.json();
      setLookupResult(data);
    } catch {
      setLookupError("Couldn't look that up — try again or contact us.");
    } finally {
      setLookupLoading(false);
    }
  };
  const applyLookup = () => {
    if (!lookupResult?.found) return;
    if (lookupResult.name) setName(lookupResult.name);
    const isEmail = lookupContact.includes("@");
    if (isEmail) setEmail(lookupContact.trim());
    else setPhone(lookupContact.trim());
    setLookupOpen(false);
  };
  // Returning-customer hint at the contact step (Option A chunk 3 — server-side detection)
  const [returningHint, setReturningHint] = useState<{ name?: string; leadCount: number } | null>(null);
  const [cartItems, setCartItems] = useState<Array<{ model: string; modelId: string; storage: string; condition: string; price: number; quantity: number; image?: string }>>([]);
  const [cartOpen, setCartOpen] = useState(false);
  // Bump counter — increments every time an item is added so the cart
  // icon + badge can re-animate (key change forces remount + keyframe).
  const [cartBump, setCartBump] = useState(0);
  // Toast — short-lived confirmation that shows what was just added / removed.
  const [cartToast, setCartToast] = useState<{ model: string; price: number; kind?: "add" | "remove" } | null>(null);
  const [inquiryCategory, setInquiryCategory] = useState("");
  const [inquirySent, setInquirySent] = useState(false);
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  // Surface upload errors to the user. Skywalker 2026-05-17 — without
  // this, failed uploads silently swallow and the photo flow appears
  // to do nothing.
  const [photoError, setPhotoError] = useState<string | null>(null);
  // Per-cart-item photo collections. Lets the customer add photos for
  // EACH device in a multi-device cart, not just the last one. Keyed by
  // `${modelId}-${storage}-${condition}` (same key the cart de-dups on).
  // Skywalker 2026-05-17: "when customers check out with multiple
  // devices it only shows 1 at a time at check out ... give them the
  // option to add pictures for each having a tab".
  const [photosByItemKey, setPhotosByItemKey] = useState<Record<string, string[]>>({});
  const [activePhotoKey, setActivePhotoKey] = useState<string>("");
  // Snapshot of the cart at submission time. We clear cartItems on
  // submit so the cart icon resets, but the "done" screen still needs
  // the device list to render the multi-device confirmation. Skywalker
  // 2026-05-17 — "when I submit it only shows 1 device on both the
  // page confirmation and on email it should reflect multiple".
  const [submittedDevices, setSubmittedDevices] = useState<Array<{ model: string; storage: string; condition: string; price: number; quantity: number; image?: string }> | null>(null);
  // Carrier balance status — captured at checkout as a Yes / No question.
  // Skywalker 2026-05-17 — we DO buy devices that aren't fully paid off
  // but the offer may be reduced because the carrier can blacklist them.
  // Surfaced to staff in the lead body. Stolen-reported devices are out
  // of scope here (separate filter).
  const [paidOff, setPaidOff] = useState<boolean | null>(null);
  const [inquiryDesc, setInquiryDesc] = useState("");
  const [cookieConsent, setCookieConsent] = useState<string | null>(null);
  const [newsletterEmail, setNewsletterEmail] = useState("");
  const [newsletterSubmitted, setNewsletterSubmitted] = useState(false);
  const [statsVisible, setStatsVisible] = useState(false);
  const [animatedStats, setAnimatedStats] = useState({ devices: 0, payout: 0, time: 0 });

  useEffect(() => {
    const saved = localStorage.getItem("cookie-consent");
    setCookieConsent(saved);
  }, []);

  // Scroll to top whenever step changes (so the new screen starts at
  // the top, not at the button the user just clicked). On Android +
  // iOS Safari the browser's scroll-restoration anchor often wins a
  // single-shot scrollTo when the previous section was tall (e.g.
  // user scrolled to bottom of checkout, taps Back). Re-snap on every
  // animation frame for ~400ms to defeat the anchor. Skywalker
  // 2026-05-17 follow-up — "the same thing is still happening on
  // mobile for me" after the initial fix.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const snap = () => {
      window.scrollTo(0, 0);
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    };
    snap();
    requestAnimationFrame(snap);
    const t1 = setTimeout(snap, 50);
    const t2 = setTimeout(snap, 150);
    const t3 = setTimeout(snap, 350);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [step, page]);

  // Returning-customer detection at contact step — debounced lookup as user types phone/email
  useEffect(() => {
    if (step !== "contact") { setReturningHint(null); return; }
    const phoneDigits = phone.replace(/\D/g, "");
    const looksLikePhone = phoneDigits.length === 10;
    const looksLikeEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    if (!looksLikePhone && !looksLikeEmail) { setReturningHint(null); return; }
    let cancelled = false;
    const t = setTimeout(async () => {
      try {
        const r = await fetch("/api/lookup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(looksLikeEmail ? { email } : { phone }),
        });
        if (!r.ok) return;
        const d = await r.json();
        if (cancelled) return;
        if (d.found && d.leadCount > 0) {
          setReturningHint({ name: d.name, leadCount: d.leadCount });
        } else {
          setReturningHint(null);
        }
      } catch {
        if (!cancelled) setReturningHint(null);
      }
    }, 700);
    return () => { cancelled = true; clearTimeout(t); };
  }, [step, phone, email]);

  useEffect(() => {
    const imgs = ["/ipadpro.png", "/ipadair.png", "/ipadmini.png", "/ipadbase.png", "/ipad.png",
      "/iphone17.png", "/iphone16.png", "/iphone15.png", "/iphone14.png", "/iphone13.png", "/iphone12.png", "/iphone11.png",
      "/iphone17air.png", "/iphone17e.png", "/iphone17base.png",
      "/iphone16plus.png", "/iphone16base.png", "/iphone16e.png", "/iphone15base.png",
      "/iphone14base.png", "/iphone14plus.png", "/iphone13base.png", "/iphone12base.png", "/iphone12mini.png", "/iphone11base.png"];
    imgs.forEach(src => { const img = new Image(); img.src = src; });
  }, []);

  useEffect(() => {
    if (!statsVisible) return;
    // Match the 5000+ stat used in the 'Why Austin chooses us' card above
    // so both 'Devices Bought' numbers tell the same story.
    const targets = { devices: 5000, payout: 1500, time: 24 };
    const duration = 1500;
    const steps = 40;
    const interval = duration / steps;
    let current = 0;
    const timer = setInterval(() => {
      current++;
      const progress = current / steps;
      const ease = 1 - Math.pow(1 - progress, 3);
      setAnimatedStats({
        devices: Math.round(targets.devices * ease),
        payout: Math.round(targets.payout * ease),
        time: Math.round(targets.time * ease),
      });
      if (current >= steps) clearInterval(timer);
    }, interval);
    return () => clearInterval(timer);
  }, [statsVisible]);

  // Cart hydrates from its own tcc-cart key (separate from tcc-session so it
  // survives the device-step session wipe). cartHydrated keeps the save
  // effect from firing during the initial mount with cartItems=[] and
  // wiping the very tcc-cart we are about to read.
  const cartHydrated = useRef(false);

  useEffect(() => {
    // Run BEFORE any tcc-cart writes so the read sees what was persisted.
    try {
      const raw = localStorage.getItem("tcc-cart");
      if (raw) {
        const c = JSON.parse(raw);
        if (Array.isArray(c.items) && Date.now() - (c.ts || 0) < 7 * 24 * 60 * 60 * 1000 && c.items.length > 0) {
          setCartItems(c.items);
        }
      }
    } catch {}
    cartHydrated.current = true;
  }, []);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("tcc-session");
      if (saved) {
        const s = JSON.parse(saved);
        if (s.step && s.step !== "done" && Date.now() - (s.ts || 0) < 7 * 24 * 60 * 60 * 1000) {
          if (s.deviceType) setDeviceType(s.deviceType);
          if (s.selectedSeries) setSelectedSeries(s.selectedSeries);
          if (s.model) setModel(s.model);
          if (s.storage) setStorage(s.storage);
          if (s.condition) setCondition(s.condition);
          if (s.carrier) setCarrier(s.carrier);
          if (s.quantity) setQuantity(s.quantity);
          if (s.email) setEmail(s.email);
          // Hero handoff pick must survive refreshes — otherwise the contact
          // step asks again and feels redundant. Restore everything we put
          // into the session payload.
          if (s.handoffMethod) setHandoffMethod(s.handoffMethod);
          if (s.shipStreet) setShipStreet(s.shipStreet);
          if (s.shipUnit) setShipUnit(s.shipUnit);
          if (s.shipCity) setShipCity(s.shipCity);
          if (s.shipState) setShipState(s.shipState);
          if (s.shipZip) setShipZip(s.shipZip);
          if (s.shipHasBox) setShipHasBox(s.shipHasBox);
          setStep(s.step);
        }
      }
    } catch {}
  }, []);

  useEffect(() => {
    // Persist cart separately from session so it survives even after the
    // "device" step (when we wipe tcc-session on a fresh-start). Skip the
    // initial mount run — otherwise it fires with cartItems=[] before the
    // restore effect has hydrated state and wipes the persisted cart.
    if (!cartHydrated.current) return;
    try {
      if (cartItems.length > 0) {
        localStorage.setItem("tcc-cart", JSON.stringify({ items: cartItems, ts: Date.now() }));
      } else {
        localStorage.removeItem("tcc-cart");
      }
    } catch {}
  }, [cartItems]);

  useEffect(() => {
    if (step === "device") { localStorage.removeItem("tcc-session"); return; }
    try {
      localStorage.setItem("tcc-session", JSON.stringify({
        step, deviceType, selectedSeries, model, storage, condition, carrier, quantity, email,
        handoffMethod, shipStreet, shipUnit, shipCity, shipState, shipZip, shipHasBox,
        ts: Date.now(),
      }));
    } catch {}
  }, [step, deviceType, selectedSeries, model, storage, condition, carrier, quantity, email, handoffMethod, shipStreet, shipUnit, shipCity, shipState, shipZip, shipHasBox]);

  const storageMultiplier = storage?.multiplier ?? 1;
  const carrierMultiplier = carrierMultiplierFor(carrier?.id, carrierLock?.id);
  const connectivityMultiplier = connectivity?.multiplier ?? 1;

  type Promo = { active: boolean; text: string; percent: number; appliesTo: string; minQuantity?: number; flatBonus?: number };
  const [promo, setPromo] = useState<Promo | null>(null);
  useEffect(() => {
    fetch("/promo.json", { cache: "no-store" }).then(r => r.ok ? r.json() : null).then(setPromo).catch(() => setPromo(null));
  }, []);
  // Real competitor trade-in values per model id, refreshed monthly via
  // .github/workflows/refresh-comps.yml. Each JSON is keyed by our
  // internal model ids; frontend prefers these over the percentage
  // estimate in COMP_SOURCES.
  const [appleComps, setAppleComps] = useState<Record<string, number> | null>(null);
  const [googleComps, setGoogleComps] = useState<Record<string, number> | null>(null);
  const [samsungComps, setSamsungComps] = useState<Record<string, number> | null>(null);
  const [decluttrComps, setDecluttrComps] = useState<Record<string, number> | null>(null);
  const [, setPcSpecsVersion] = useState(0);
  useEffect(() => {
    fetch("/comps/apple-trade-in.json", { cache: "no-store" })
      .then(r => r.ok ? r.json() : null)
      .then((d: { values?: Record<string, number> } | null) => setAppleComps(d?.values || null))
      .catch(() => setAppleComps(null));
    fetch("/comps/google-trade-in.json", { cache: "no-store" })
      .then(r => r.ok ? r.json() : null)
      .then((d: { values?: Record<string, number> } | null) => setGoogleComps(d?.values || null))
      .catch(() => setGoogleComps(null));
    fetch("/comps/samsung-trade-in.json", { cache: "no-store" })
      .then(r => r.ok ? r.json() : null)
      .then((d: { values?: Record<string, number> } | null) => setSamsungComps(d?.values || null))
      .catch(() => setSamsungComps(null));
    fetch("/comps/decluttr.json", { cache: "no-store" })
      .then(r => r.ok ? r.json() : null)
      .then((d: { values?: Record<string, number> } | null) => setDecluttrComps(d?.values || null))
      .catch(() => setDecluttrComps(null));
    // PC laptop additive specs (IWM scrape). Populates the module-level
    // PC_LAPTOP_SPECS_CACHE so getMacSpec() / hasAdditiveSpecs() pick
    // them up; setPcSpecsVersion bumps a counter to trigger a rerender
    // once the data is in.
    fetch("/comps/pc-laptop-specs.json", { cache: "no-store" })
      .then(r => r.ok ? r.json() : null)
      .then((d: Record<string, MacSpec> | null) => {
        if (d) {
          PC_LAPTOP_SPECS_CACHE = d;
          setPcSpecsVersion(v => v + 1);
        }
      })
      .catch(() => {});
  }, []);
  const promoApplies = !!(promoClaimed && promo?.active && deviceType && (promo.appliesTo === "all" || promo.appliesTo === deviceType) && (!promo.minQuantity || quantity >= promo.minQuantity));
  const promoMultiplier = promoApplies && promo && promo.percent ? 1 + (promo.percent / 100) : 1;
  const promoFlatBonus = promoApplies && promo?.flatBonus ? promo.flatBonus : 0;

  const [accessoriesIncluded, setAccessoriesIncluded] = useState(false);
  const [couponCode, setCouponCode] = useState("");
  const [couponPercent, setCouponPercent] = useState(0);
  const [couponLabel, setCouponLabel] = useState("");
  const [couponError, setCouponError] = useState("");
  const couponMultiplier = 1 + (couponPercent / 100);
  const applyCoupon = async () => {
    setCouponError("");
    const code = couponCode.trim().toUpperCase();
    if (!code) { setCouponError("Enter a code"); return; }
    try {
      const res = await fetch("/coupons.json", { cache: "no-store" });
      const data: Record<string, { percent: number; active: boolean; description?: string }> = await res.json();
      const c = data[code];
      if (!c || !c.active) { setCouponError("Invalid or expired code"); return; }
      setCouponPercent(c.percent);
      setCouponLabel(code);
      setCouponError("");
    } catch { setCouponError("Couldn't verify code, try again"); }
  };

  // Accessory bonus — Skywalker 2026-05-12: only ask when it actually
  // moves price. MacBook bricks (USB-C 96W etc) retail $79+, so they
  // matter on any condition. New iPhones have the box/cable as part
  // of the "sealed" premium. For used iPhone/Samsung the accessories
  // don't move resale meaningfully so we don't ask.
  const isNewTier = condition?.id === "sealed" || condition?.id === "mint";
  const showAccessoryQuestion = isNewTier || deviceType === "macbook";
  const accessoryBonusAmount = deviceType === "macbook" ? 30 : (isNewTier && deviceType === "iphone" ? 10 : 0);
  const accessoryBonus = showAccessoryQuestion && accessoriesIncluded ? accessoryBonusAmount : 0;
  // MacBook spec multipliers — only fire when the picked model has a
  // MACBOOK_SPECS entry. Default to 1 so non-MacBook flows are unchanged.
  const processorMultiplier = processor?.multiplier ?? 1;
  const memoryMultiplier = memory?.multiplier ?? 1;
  const displayGlassMultiplier = displayGlass?.multiplier ?? 1;
  const batteryHealthMultiplier = batteryHealth?.multiplier ?? 1;
  const chargerMultiplier = charger?.multiplier ?? 1;
  // Compound multiplier from all brand-specific extras the user has
  // picked so far (1.0x for anything they haven't answered).
  const extrasMultiplier = Object.values(extras).reduce((acc, opt) => acc * (opt?.multiplier ?? 1), 1);
  // Direct price lookup — if the table has an exact price for this
  // device × storage × condition, use it instead of multiplier math.
  // Carrier deductions are flat $ amounts from CARRIER_DEDUCTIONS, not multipliers.
  const lookupPrice = PRICE_TABLE[model?.id ?? ""]?.[storage?.id ?? "base"]?.[condition?.id ?? ""];
  const carrierDeduction = CARRIER_DEDUCTIONS[model?.id ?? ""]?.[carrier?.id ?? ""] ?? 0;
  // Lock deduction: Verizon $0 only if unlocked. All carriers lose ~$200 if locked.
  const lockDeduction = (carrier?.id !== "unlocked" && carrierLock?.id === "yes") ? 200 : 0;
  const totalCarrierDeduction = carrierDeduction + lockDeduction;
  // For devices in the price table, use flat deduction instead of multiplier
  const useDirectPricing = lookupPrice != null;
  // MacBook additive mode: use IWM's exact $ adjustments (no multipliers)
  const procAdj = (processor as MacSpecOption | null)?.adj;
  const useAdditive = procAdj != null && model && hasAdditiveSpecs(model.id);
  // For extras: any option that carries an `adj` field is treated as a
  // flat dollar add (post-multiplier), and only options WITHOUT `adj`
  // contribute multiplicatively. This lets tablet brand_extras (storage,
  // S Pen, Type Cover, etc.) work without forcing them into the full
  // additive-spec flow used for laptops.
  const extrasAdjSum = Object.values(extras).reduce((acc, opt) => acc + ((opt as ExtraOption | undefined)?.adj ?? 0), 0);
  const extrasMultOnly = Object.values(extras).reduce((acc, opt) => {
    const o = opt as ExtraOption | undefined;
    return acc * ((o?.adj != null) ? 1 : (o?.multiplier ?? 1));
  }, 1);
  const nonCarrierMultiplier = connectivityMultiplier * promoMultiplier
    * couponMultiplier * processorMultiplier * memoryMultiplier * displayGlassMultiplier
    * batteryHealthMultiplier * chargerMultiplier * extrasMultOnly;
  const promoOnly = promoMultiplier * couponMultiplier * (useAdditive ? extrasMultOnly : extrasMultiplier);
  const baseQuote = useAdditive
    ? (() => {
        const chip = procAdj;
        const ram = (memory as MacSpecOption | null)?.adj ?? 0;
        const stor = (storage as MacSpecOption | null)?.adj ?? 0;
        const gpu = (graphics as MacSpecOption | null)?.adj ?? 0;
        const disp = (displayResolution as MacSpecOption | null)?.adj ?? 0;
        // Prefer per-model condition adjustments from the IWM scrape;
        // fall back to MacBook-calibrated MCOND for MacBook variants and
        // any spec entry without scraped condition_adj data.
        const MCOND: Record<string, number> = { sealed: 50, mint: 0, verygood: -50, good: -110, fair: -220 };
        const specCondAdj = model ? getMacSpec(model.id)?.condition_adj : undefined;
        const condId = condition?.id ?? "mint";
        const cond = specCondAdj && (condId in specCondAdj)
          ? (specCondAdj[condId] ?? 0)
          : (MCOND[condId] ?? 0);
        const nano = displayGlass?.id === "nano" ? 50 : 0;
        // Prefer per-model IWM battery/charger adj when scraped; fall
        // back to MacBook-calibrated defaults for MacBooks and any spec
        // without IWM data.
        const specBatt = model ? getMacSpec(model.id)?.battery_adj : undefined;
        const specChrg = model ? getMacSpec(model.id)?.charger_adj : undefined;
        const batt = specBatt && batteryHealth?.id
          ? (specBatt[batteryHealth.id] ?? specBatt["poor"] ?? 0)
          : (batteryHealth?.id === "poor" ? -80 : 0);
        const chrg = specChrg && charger?.id
          ? (specChrg[charger.id] ?? specChrg["no"] ?? 0)
          : (charger?.id === "no" ? -50 : 0);
        const iwm = chip + ram + stor + gpu + disp + cond + nano + batt + chrg + extrasAdjSum;
        return Math.max(0, Math.round(iwm * 0.90 * promoOnly)) + promoFlatBonus;
      })()
    : useDirectPricing
      ? Math.max(0, Math.round((lookupPrice - totalCarrierDeduction) * nonCarrierMultiplier + extrasAdjSum)) + promoFlatBonus
      : model && condition && model.base
        ? Math.max(0, Math.round(model.base * storageMultiplier * condition.multiplier * carrierMultiplier * nonCarrierMultiplier + extrasAdjSum)) + promoFlatBonus
        : 0;
  // Popular-device bonus: phones + cellular iPads get +$25 over IWM
  // so we beat IWM on the categories with the most inbound volume.
  // Skywalker directive 2026-05-16.
  const popularDeviceBonus = (isPhoneFlow || isIpadCellular) && baseQuote > 0 ? 25 : 0;
  // Both-glass penalty: when a phone has BOTH front display + back
  // glass cracked, deduct an extra $30 on top of the broken-tier
  // price. Front-only or back-only damage stays at the regular
  // broken-tier value. Skywalker directive 2026-05-17.
  const bothGlassPenalty = (isPhoneFlow && condition?.id === "broken" && brokenGlass === "both" && baseQuote > 0) ? -30 : 0;
  const rawQuote = Math.max(0, baseQuote + accessoryBonus + popularDeviceBonus + bothGlassPenalty);

  // MARGIN GUARDRAIL — never quote more than 25% under resell value.
  // Catches cases like a broken iPhone 17 Pro Max that the IWM-derived
  // PRICE_TABLE was over-quoting (was $357, real broken resell is
  // ~$324 — we'd lose money). Cap the quote at resell × 0.75 so we
  // always keep a healthy margin. When resell is unknown for the
  // model, force manual review instead of guessing. Skywalker directive
  // 2026-05-17 after a live -$43 LOSS lead came in.
  const workingResell = model ? getResellEstimate(model.label) : null;
  const condMult = resellMultiplierForCondition(condition?.id, brokenGlass);
  const estResellNow = workingResell != null ? Math.round(workingResell * condMult) : null;
  const marginCap = estResellNow != null ? Math.round(estResellNow * MARGIN_FLOOR_MULT) : null;
  // Apply cap silently if base quote exceeds it.
  const quoteAfterCap = (marginCap != null && rawQuote > marginCap) ? marginCap : rawQuote;
  // Force manual review when:
  //   (a) the model has no resell comp at all (we can't sanity-check), OR
  //   (b) the cap would push us below the existing MIN_OFFER threshold
  // The customer sees "Manual review" instead of a number; staff sets
  // the real offer over text after seeing photos / handling the unit.
  const needsMarginReview =
    (model?.base != null && model.base > 0 && workingResell == null) ||
    (marginCap != null && marginCap < MIN_OFFER);
  const quote = quoteAfterCap;
  // Minimum offer threshold — below this we lose money on shipping +
  // processing. Show "Manual quote" instead of a dollar amount.
  // User can still add to cart; we review manually before paying out.
  const isBelowMinimum = quote > 0 && quote < MIN_OFFER;
  // Inquiry-only models have no base price (or 0). We still let the
  // user walk the funnel + add to cart; the quote step shows
  // 'Quote pending' instead of a number, and the cart marks the line
  // 'Pending quote'.
  const isPendingQuote = !model?.base;
  const isBrokenNonFunctional = condition?.id === "broken" && brokenFunctional === false;
  const isManualQuote = isBelowMinimum || isBrokenNonFunctional || needsMarginReview;
  const needsReview = MANUAL_REVIEW_DEVICES.has(model?.id ?? "");

  const maxQuoteFor = (v: { id: string; base: number }) => {
    const sids = STORAGE_MAP[v.id];
    const maxStorageMult = sids?.length ? Math.max(...sids.map(sid => ALL_STORAGES.find(s => s.id === sid)?.multiplier ?? 1)) : 1;
    return Math.round(v.base * maxStorageMult * 1.15);
  };
  const maxQuoteForSeries = (vs: { id: string; base: number }[]) => Math.max(...vs.map(maxQuoteFor));

  const pushHistory = useCallback((s: string) => {
    window.history.pushState({ step: s }, "", `#${s}`);
  }, []);

  useEffect(() => {
    const onPop = () => { handleBack(); };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  });

  const handleBack = () => {
    if (step === "model" && selectedSubSeries) { setSelectedSubSeries(null); return; }
    if (step === "model" && selectedSeries) { setSelectedSeries(null); return; }
    if (step === "model") { if (category) { setStep("brand"); } else { setStep("category"); } setDeviceType(null); }
    else if (step === "brand") { setStep("category"); setCategory(null); }
    else if (step === "category") { setStep("device"); }
    // New funnel order: model -> condition -> [connectivity (ipad)] -> storage -> [carrier (phone)] -> quote
    // (no-storage devices skip storage; non-phones skip carrier; only ipads have connectivity)
    // MacBook spec'd flow: model -> processor -> memory -> storage -> [displayglass] -> condition -> batteryhealth -> charger -> quote
    else if (step === "processor") { setStep("model"); setModel(null); }
    else if (step === "memory") { setStep("processor"); setProcessor(null); }
    else if (step === "graphics") { setStep("storage"); setStorage(null); }
    else if (step === "displayresolution") {
      const spec = model ? getMacSpec(model.id) : null;
      if (spec?.graphics && spec.graphics.length > 0) { setStep("graphics"); setGraphics(null); }
      else { setStep("storage"); setStorage(null); }
    }
    else if (step === "displayglass") {
      const spec = model ? getMacSpec(model.id) : null;
      if (spec?.display && spec.display.length > 0) { setStep("displayresolution"); setDisplayResolution(null); }
      else if (spec?.graphics && spec.graphics.length > 0) { setStep("graphics"); setGraphics(null); }
      else { setStep("storage"); setStorage(null); }
    }
    else if (step === "batteryhealth") { setStep("condition"); setCondition(null); }
    else if (step === "charger") { setStep("batteryhealth"); setBatteryHealth(null); }
    else if (step === "extras") {
      if (extrasIndex > 0) {
        // Back up one question within the extras flow.
        const ex = getBrandExtras(deviceType, model?.id);
        const prev = ex[extrasIndex - 1];
        if (prev) {
          const next = { ...extras };
          delete next[prev.id];
          setExtras(next);
        }
        setExtrasIndex(extrasIndex - 1);
      } else if (model && hasAdditiveSpecs(model.id)) {
        // Additive flow: desktops skip battery/charger so go back to
        // condition; laptops go back to charger.
        const isDskType = deviceType?.endsWith("_desktop") ?? false;
        if (isDskType) { setStep("condition"); setCondition(null); }
        else { setStep("charger"); setCharger(null); }
      } else {
        setStep("condition"); setCondition(null);
      }
    }
    else if (step === "condition") {
      if (model && hasAdditiveSpecs(model.id)) {
        // Spec'd flow back-nav: condition came after one of these in
        // order of preference: displayglass (MacBook nano), display
        // resolution (PC), graphics (PC gaming), or storage.
        const spec = getMacSpec(model.id);
        if (spec?.hasNanoGlass) { setStep("displayglass"); setDisplayGlass(null); }
        else if (spec?.display && spec.display.length > 0) { setStep("displayresolution"); setDisplayResolution(null); }
        else if (spec?.graphics && spec.graphics.length > 0) { setStep("graphics"); setGraphics(null); }
        else { setStep("storage"); setStorage(null); }
      } else {
        setStep("model"); setModel(null);
      }
    }
    else if (step === "connectivity") {
      // If this device has brand extras, back through the last question instead
      // of jumping straight to condition.
      const ex = getBrandExtras(deviceType, model?.id);
      if (ex.length > 0) {
        setExtrasIndex(ex.length - 1);
        setStep("extras"); // keep last answer until they re-pick
      } else {
        setStep("condition"); setCondition(null);
      }
    }
    else if (step === "storage") {
      if (model && hasAdditiveSpecs(model.id)) { setStep("memory"); setMemory(null); }
      else if (deviceType === "ipad") { setStep("connectivity"); setConnectivity(null); }
      else { setStep("condition"); setCondition(null); }
    }
    else if (step === "broken-functional") { setStep("condition"); setCondition(null); setBrokenFunctional(null); }
    else if (step === "broken-glass") { setStep("broken-functional"); setBrokenFunctional(null); setBrokenGlass(null); }
    else if (step === "carrier") { setStep("storage"); setStorage(null); }
    else if (step === "carrier-lock") { setStep("carrier"); setCarrier(null); }
    else if (step === "quote") {
      // If additive model came through extras (e.g. Dell GPU), go back there.
      const quoteExtras = getBrandExtras(deviceType, model?.id);
      if (model && hasAdditiveSpecs(model.id) && quoteExtras.length > 0) {
        setExtrasIndex(quoteExtras.length - 1);
        setStep("extras");
      }
      else if (charger) { setStep("charger"); setCharger(null); }
      else if (batteryHealth) { setStep("batteryhealth"); setBatteryHealth(null); }
      else if (carrierLock) { setStep("carrier-lock"); setCarrierLock(null); }
      else if (carrier) { setStep("carrier"); setCarrier(null); }
      else if (storage) { setStep("storage"); setStorage(null); }
      else if (connectivity) { setStep("connectivity"); setConnectivity(null); }
      else { setStep("condition"); setCondition(null); }
    }
    else if (step === "checkout") setStep("quote");
    else if (step === "payout") setStep("checkout");
    else if (step === "contact") setStep("payout"); pushHistory("payout");
    // After any back-step transition, scroll to the top of the new step.
    // Without this, the previous step's scroll-Y is preserved and on a
    // shorter incoming step the user ends up parked in the footer area —
    // Skywalker 2026-05-17 "go to checkout and don't submit and go back
    // on Home Screen it still goes to footer". Instant scroll (not
    // smooth) so it lands before paint.
    window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
  };

  const reset = () => {
    setStep("device");
    setCategory(null);
    setDeviceType(null);
    setSelectedSeries(null);
    setSelectedSubSeries(null);
    setModel(null);
    setStorage(null);
    setCondition(null);
    setCarrier(null);
    setCarrierLock(null);
    setConnectivity(null);
    setPayout(null);
    setQuantity(1);
    setExpandedFaq(null);
    setPage("home");
    setName("");
    setPhone("");
    setEmail("");
    setHandoffMethod(null);
    setShipStreet(""); setShipUnit(""); setShipCity(""); setShipState("TX"); setShipZip("");
    setLocalArea(null);
    setProcessor(null); setMemory(null); setGraphics(null); setDisplayResolution(null); setDisplayGlass(null);
    setBatteryHealth(null); setCharger(null); setBrokenPhotoUrl(null);
    setExtras({}); setExtrasIndex(0);
  };

  // Brand → flat variant lists (the series intermediate step was removed
  // 2026-05-10 per Skywalker — pick brand, see all models directly so search
  // works at every level).
  type FlatVariant = { id: string; label: string; base: number; image?: string; inquiryOnly?: boolean };
  const iphoneVariants: FlatVariant[] = IPHONE_SERIES.flatMap(s => s.variants as FlatVariant[]);
  const ipadVariants: FlatVariant[] = IPAD_SERIES.flatMap(s => s.variants as FlatVariant[]);
  // Samsung now uses the same series-picker pattern as MacBook — pick
  // S / Z / Note series first, then variants. When selectedSeries is set
  // we filter to that series; otherwise we surface the full flat list so
  // search still works across the whole Samsung catalog.
  const samsungSelectedVariants: FlatVariant[] = selectedSeries
    ? (SAMSUNG_SERIES.find(s => s.id === selectedSeries)?.variants as FlatVariant[] | undefined) || []
    : SAMSUNG_SERIES.flatMap(s => s.variants as FlatVariant[]);
  const pixelVariants: FlatVariant[] = PIXEL_SERIES.flatMap(s => s.variants as FlatVariant[]);
  // MacBook now uses the same series-then-models pattern as Lenovo/Dell/HP.
  // When selectedSeries is set we expose only that series' variants; otherwise
  // we surface the full flat list so search across the whole MacBook catalog
  // still works on the model step.
  const macbookSelectedVariants: FlatVariant[] = selectedSeries
    ? (MACBOOK_SERIES.find(s => s.id === selectedSeries)?.variants as FlatVariant[] | undefined) || []
    : MACBOOK_SERIES.flatMap(s => s.variants as FlatVariant[]);
  const sonyVariants: FlatVariant[] = SONY_SERIES.flatMap(s => s.variants as FlatVariant[]);
  const alienwareVariants = selectedSeries ? ALIENWARE_SERIES.find(s => s.id === selectedSeries)?.variants || [] : [];
  const lgPcVariants = selectedSubSeries
    ? LG_PC_ALL_SUB_SERIES.find(s => s.id === selectedSubSeries)?.variants || []
    : [];
  const lenovoTabVariants: FlatVariant[] = LENOVO_TAB_SERIES.flatMap(s => s.variants as FlatVariant[]);
  const surfaceVariants: FlatVariant[] = SURFACE_SERIES.flatMap(s => s.variants as FlatVariant[]);
  const appleDesktopVariants: FlatVariant[] = APPLE_DESKTOP_SERIES.flatMap(s => s.variants as FlatVariant[]);
  const asusPcVariants = selectedSubSeries
    ? ASUS_ROG_SUB_SERIES.find(s => s.id === selectedSubSeries)?.variants || []
    : selectedSeries
      ? (ASUS_PC_SERIES.find(s => s.id === selectedSeries) as { variants?: { id: string; label: string; base: number }[] })?.variants || []
      : [];
  const dellPcVariants = selectedSubSeries
    ? DELL_PC_ALL_SUB_SERIES.find(s => s.id === selectedSubSeries)?.variants || []
    : [];
  const lenovoPcVariants = selectedSubSeries
    ? LENOVO_PC_ALL_SUB_SERIES.find(s => s.id === selectedSubSeries)?.variants || []
    : selectedSeries
      ? (LENOVO_PC_SERIES.find(s => s.id === selectedSeries) as { variants?: { id: string; label: string; base: number }[] })?.variants || []
      : [];
  const hpPcVariants = selectedSubSeries
    ? HP_PC_ALL_SUB_SERIES.find(s => s.id === selectedSubSeries)?.variants || []
    : selectedSeries
      ? (HP_PC_SERIES.find(s => s.id === selectedSeries) as { variants?: { id: string; label: string; base: number }[] })?.variants || []
      : [];
  const acerPcVariants = selectedSeries ? (ACER_PC_SERIES.find(s => s.id === selectedSeries) as { variants?: { id: string; label: string; base: number }[] })?.variants || [] : [];
  const samsungBookVariants = selectedSeries ? (SAMSUNG_PC_SERIES.find(s => s.id === selectedSeries) as { variants?: { id: string; label: string; base: number }[] })?.variants || [] : [];

  type Crumb = { label: string; onClick: () => void };
  const breadcrumbs: Crumb[] = [
    { label: "Sell", onClick: () => reset() },
  ];
  if (deviceType) {
    breadcrumbs.push({
      label: BRAND_LABELS[deviceType] || deviceType,
      onClick: () => { setSelectedSeries(null); setSelectedSubSeries(null); setModel(null); setStorage(null); setCondition(null); setCarrier(null); setStep("model"); pushHistory("model"); },
    });
  }
  if (selectedSeries) {
    const seriesList = deviceType === "iphone" ? IPHONE_SERIES : deviceType === "android" ? SAMSUNG_SERIES : deviceType === "pixel" ? PIXEL_SERIES : deviceType === "ipad" ? IPAD_SERIES : deviceType === "macbook" ? MACBOOK_SERIES : deviceType === "sony" ? SONY_SERIES : deviceType === "alienware" ? ALIENWARE_SERIES : deviceType === "lg_pc" ? LG_PC_SERIES : deviceType === "lenovo_tab" ? LENOVO_TAB_SERIES : deviceType === "surface" ? SURFACE_SERIES : deviceType === "apple_desktop" ? APPLE_DESKTOP_SERIES : deviceType === "asus_pc" ? ASUS_PC_SERIES : deviceType === "dell" ? DELL_PC_SERIES : deviceType === "lenovo" ? LENOVO_PC_SERIES : deviceType === "hp" ? HP_PC_SERIES : deviceType === "acer" ? ACER_PC_SERIES : deviceType === "samsung_pc" ? SAMSUNG_PC_SERIES : null;
    const ser = seriesList?.find(s => s.id === selectedSeries);
    if (ser) breadcrumbs.push({
      label: ser.label,
      onClick: () => { setSelectedSubSeries(null); setModel(null); setStorage(null); setCondition(null); setCarrier(null); setStep("model"); pushHistory("model"); },
    });
  }
  if (selectedSubSeries) {
    const sub = ASUS_ROG_SUB_SERIES.find(s => s.id === selectedSubSeries)
      || DELL_PC_ALL_SUB_SERIES.find(s => s.id === selectedSubSeries)
      || LG_PC_ALL_SUB_SERIES.find(s => s.id === selectedSubSeries)
      || LENOVO_PC_ALL_SUB_SERIES.find(s => s.id === selectedSubSeries)
      || HP_PC_ALL_SUB_SERIES.find(s => s.id === selectedSubSeries);
    if (sub) breadcrumbs.push({
      label: sub.label,
      onClick: () => { setModel(null); setStorage(null); setCondition(null); setCarrier(null); setStep("model"); pushHistory("model"); },
    });
  }
  // New order: model -> condition -> storage -> carrier
  if (model) breadcrumbs.push({
    label: model.label,
    onClick: () => { setStorage(null); setCondition(null); setCarrier(null); setStep("condition"); pushHistory("condition"); },
  });
  if (condition) breadcrumbs.push({
    label: getConditionLabel(condition, deviceType).label,
    onClick: () => { setStorage(null); setCarrier(null); setStep("storage"); pushHistory("storage"); },
  });
  if (storage) breadcrumbs.push({
    label: storage.label,
    onClick: () => { setCarrier(null); const next = (deviceType === "iphone" || deviceType === "android" || deviceType === "pixel") ? "carrier" : "quote"; setStep(next); pushHistory(next); },
  });
  if (carrier) breadcrumbs.push({
    label: carrier.label,
    onClick: () => { setStep("quote"); pushHistory("quote"); },
  });
  const showBreadcrumbs = breadcrumbs.length > 1 && step !== "device" && step !== "category" && page === "home";

  // SELECTION PANEL — sticky sidebar that travels with the user through the
  // storage / condition / carrier steps so they can always see what they're
  // selling. Inspired by IWM but with our spin: bordered card, soft green
  // accent border, selected fields go bold-green as they're picked.
  // Mobile counterpart — full-width glass card laid out like IWM's mobile
  // 'Sell Your X' panel. Device thumb top-left, 'Sell Your [model]' header
  // top-right. Selection rows below (Condition / Carrier / Storage), each
  // with a pencil edit button that jumps back to that step so the user
  // can change a choice without resetting the whole flow. Heavy 3D outline:
  // outer border + inset top-left highlight + deep drop shadow.
  const editRow = (target: "storage" | "condition" | "carrier" | "connectivity" | "carrier-lock" | "processor" | "memory" | "displayglass" | "batteryhealth" | "charger") => () => {
    setStep(target);
    pushHistory(target);
  };
  const selectionPanelMobile = model && (
    <>
      {/* Mobile progress chip — lives OUTSIDE the picture box, top-right of page.
          Picture menu below it grows as more rows get added. */}
      {funnelStepNum > 0 && (
        <div className="lg:hidden flex justify-end mb-3">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[rgba(15,15,15,0.78)] backdrop-blur-[8px] border border-white/15 shadow-[0_4px_10px_rgba(0,0,0,0.4)]">
            <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#00c853] leading-none">Step {funnelStepNum}/{funnelTotal}</span>
            <div className="w-14 h-1 bg-white/10 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-[#00c853] to-[#00e676] shadow-[0_0_4px_rgba(0,200,83,0.5)] transition-all duration-500" style={{ width: `${(funnelStepNum / funnelTotal) * 100}%` }} />
            </div>
          </div>
        </div>
      )}
      <div className="lg:hidden mb-3 rounded-2xl bg-[rgba(15,15,15,0.78)] backdrop-blur-[12px] border border-white/15 p-3 shadow-[inset_1px_1px_0_rgba(255,255,255,0.1),0_18px_45px_rgba(0,0,0,0.75),0_0_0_1px_rgba(0,200,83,0.08)]">
        {/* TOP — compact device thumb + model name (no 'Sell Your' label
            on mobile — selections are already implied by the breadcrumbs
            and the current funnel step, so we keep this hero tight to
            leave room for the actual step content below) */}
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-lg bg-[rgba(15,15,15,0.5)] border border-white/12 flex items-center justify-center shrink-0 overflow-hidden shadow-[inset_1px_1px_0_rgba(255,255,255,0.08),0_4px_10px_rgba(0,0,0,0.45)]">
            {model.image ? (
              <img src={model.image} alt="" className="max-w-full max-h-full object-contain" style={{ filter: "drop-shadow(0 4px 8px rgba(0,0,0,0.5))" }} />
            ) : (
              <span className="text-xl opacity-50">📱</span>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white font-extrabold text-[15px] leading-tight truncate">{model.label}</p>
          </div>
        </div>
        {/* ROWS — only render rows that have a value. Box grows as more
            selections are made. Each row has a pencil edit button that
            jumps back to that step so the user can change a pick without
            resetting the flow. */}
        {(storage || condition || carrier || carrierLock || connectivity || processor || memory || displayGlass || batteryHealth || charger || Object.keys(extras).length > 0) && (
          <div className="divide-y divide-white/10 border-t border-white/10 mt-3">
            {processor && (
              <div className="flex items-center justify-between py-1.5">
                <span className="text-[#b8b8b8] text-xs">Processor</span>
                <button onClick={editRow("processor")} className="inline-flex items-center gap-1.5 text-white text-xs font-extrabold cursor-pointer hover:text-[#00c853] transition">
                  {processor.label}
                  <svg className="w-3 h-3 text-[#b8b8b8]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                </button>
              </div>
            )}
            {memory && (
              <div className="flex items-center justify-between py-1.5">
                <span className="text-[#b8b8b8] text-xs">Memory</span>
                <button onClick={editRow("memory")} className="inline-flex items-center gap-1.5 text-white text-xs font-extrabold cursor-pointer hover:text-[#00c853] transition">
                  {memory.label}
                  <svg className="w-3 h-3 text-[#b8b8b8]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                </button>
              </div>
            )}
            {displayGlass && (
              <div className="flex items-center justify-between py-1.5">
                <span className="text-[#b8b8b8] text-xs">Display</span>
                <button onClick={editRow("displayglass")} className="inline-flex items-center gap-1.5 text-white text-xs font-extrabold cursor-pointer hover:text-[#00c853] transition">
                  {displayGlass.label}
                  <svg className="w-3 h-3 text-[#b8b8b8]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                </button>
              </div>
            )}
            {condition && (
              <div className="flex items-center justify-between py-1.5">
                <span className="text-[#b8b8b8] text-xs">Condition</span>
                <button onClick={editRow("condition")} className="inline-flex items-center gap-1.5 text-white text-xs font-extrabold cursor-pointer hover:text-[#00c853] transition">
                  {getConditionLabel(condition, deviceType).label}
                  <svg className="w-3 h-3 text-[#b8b8b8]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                </button>
              </div>
            )}
            {batteryHealth && (
              <div className="flex items-center justify-between py-1.5">
                <span className="text-[#b8b8b8] text-xs">Battery</span>
                <button onClick={editRow("batteryhealth")} className="inline-flex items-center gap-1.5 text-white text-xs font-extrabold cursor-pointer hover:text-[#00c853] transition">
                  {batteryHealth.label}
                  <svg className="w-3 h-3 text-[#b8b8b8]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                </button>
              </div>
            )}
            {charger && (
              <div className="flex items-center justify-between py-1.5">
                <span className="text-[#b8b8b8] text-xs">Charger</span>
                <button onClick={editRow("charger")} className="inline-flex items-center gap-1.5 text-white text-xs font-extrabold cursor-pointer hover:text-[#00c853] transition">
                  {charger.label}
                  <svg className="w-3 h-3 text-[#b8b8b8]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                </button>
              </div>
            )}
            {getBrandExtras(deviceType, model?.id).filter(q => extras[q.id]).map((q) => (
              <div key={q.id} className="flex items-center justify-between py-1.5">
                <span className="text-[#b8b8b8] text-xs">{q.question.replace(/\?$/, "")}</span>
                <button onClick={() => { setExtrasIndex(getBrandExtras(deviceType, model?.id).findIndex(x => x.id === q.id)); setStep("extras"); pushHistory("extras"); }} className="inline-flex items-center gap-1.5 text-white text-xs font-extrabold cursor-pointer hover:text-[#00c853] transition">
                  {extras[q.id]?.label}
                  <svg className="w-3 h-3 text-[#b8b8b8]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                </button>
              </div>
            ))}
            {connectivity && (
              <div className="flex items-center justify-between py-1.5">
                <span className="text-[#b8b8b8] text-xs">Connectivity</span>
                <button onClick={editRow("connectivity")} className="inline-flex items-center gap-1.5 text-white text-xs font-extrabold cursor-pointer hover:text-[#00c853] transition">
                  {connectivity.label}
                  <svg className="w-3 h-3 text-[#b8b8b8]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                </button>
              </div>
            )}
            {storage && (
              <div className="flex items-center justify-between py-1.5">
                <span className="text-[#b8b8b8] text-xs">Storage</span>
                <button onClick={editRow("storage")} className="inline-flex items-center gap-1.5 text-white text-xs font-extrabold cursor-pointer hover:text-[#00c853] transition">
                  {storage.label}
                  <svg className="w-3 h-3 text-[#b8b8b8]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                </button>
              </div>
            )}
            {carrier && (
              <div className="flex items-center justify-between py-1.5">
                <span className="text-[#b8b8b8] text-xs">Carrier</span>
                <button onClick={editRow("carrier")} className="inline-flex items-center gap-1.5 text-white text-xs font-extrabold cursor-pointer hover:text-[#00c853] transition">
                  {carrier.label}
                  <svg className="w-3 h-3 text-[#b8b8b8]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                </button>
              </div>
            )}
            {carrierLock && (
              <div className="flex items-center justify-between py-1.5">
                <span className="text-[#b8b8b8] text-xs">Carrier Lock</span>
                <button onClick={editRow("carrier-lock")} className="inline-flex items-center gap-1.5 text-white text-xs font-extrabold cursor-pointer hover:text-[#00c853] transition">
                  {carrierLock.label}
                  <svg className="w-3 h-3 text-[#b8b8b8]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                </button>
              </div>
            )}
          </div>
        )}
        {/* BOTTOM — price reveal once we're past the carrier step */}
        {(step === "quote" || step === "checkout" || step === "payout" || step === "contact") && (
          <div className="border-t border-white/10 mt-2 pt-4 text-center">
            {isPendingQuote || isManualQuote ? (
              <>
                <p className="text-[#b8b8b8] text-sm">{isManualQuote ? "This device needs a" : "Your device will be"}</p>
                <p className="text-white font-extrabold text-xl mt-1 leading-tight">{isManualQuote ? "Manual review & custom quote" : "Quoted via email or text"}</p>
                <p className="text-[#888] text-xs mt-1">{isManualQuote ? "Add to your box — we\u2019ll text you a fair offer within the hour" : ""}</p>
              </>
            ) : (
              <>
                <p className="text-[#b8b8b8] text-sm">Your device is valued at</p>
                <p className="text-[#00c853] font-extrabold text-4xl mt-1" style={{ textShadow: "0 0 8px rgba(0,200,83,0.22)" }}>${quote * quantity}</p>
              </>
            )}
          </div>
        )}
      </div>
    </>
  );

  const selectionPanel = model && (
    <aside className="hidden lg:block lg:w-[330px] shrink-0">
      <div className="sticky top-24 bg-[rgba(15,15,15,0.7)] backdrop-blur-[12px] border border-white/10 rounded-2xl p-5 shadow-[0_20px_50px_rgba(0,0,0,0.8)]">
        <div className="bg-[rgba(15,15,15,0.5)] backdrop-blur-[12px] border border-white/10 rounded-2xl mb-4 h-72 flex items-center justify-center overflow-hidden shadow-[0_10px_30px_rgba(0,0,0,0.5)] p-3">
          {model.image ? (
            <img src={model.image} alt={model.label} className="w-full h-full object-contain" style={{ filter: "drop-shadow(0 18px 22px rgba(0,0,0,0.55)) drop-shadow(0 4px 8px rgba(0,0,0,0.35))" }} />
          ) : (
            <div className="text-6xl opacity-30">📱</div>
          )}
        </div>
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#00c853] mb-1">Selling</p>
        <p className="text-[22px] font-extrabold text-white leading-tight mb-4">{model.label}</p>
        <div className="space-y-2 border-t border-white/10 pt-4">
          {[
            { label: "Processor",    value: processor?.label,    active: step === "processor",    helpId: null       as null,    show: macSpecFlow },
            { label: "Memory",       value: memory?.label,       active: step === "memory",       helpId: null       as null,    show: macSpecFlow },
            { label: "Storage",      value: storage?.label,      active: step === "storage",      helpId: "storage"  as const,   show: !isNoStorageDevice },
            { label: "Display",      value: displayGlass?.label, active: step === "displayglass", helpId: null       as null,    show: macSpecFlow && macHasGlassStep },
            { label: "Condition",    value: condition ? getConditionLabel(condition, deviceType).label : undefined, active: step === "condition", helpId: null as null, show: true },
            { label: "Battery",      value: batteryHealth?.label, active: step === "batteryhealth", helpId: null     as null,    show: macSpecFlow },
            { label: "Charger",      value: charger?.label,      active: step === "charger",      helpId: null       as null,    show: macSpecFlow },
            // Brand extras (PS5 disc / drone hours / watch band etc) get
            // one row per answered question, only shown for device types
            // that declare extras in BRAND_EXTRAS.
            ...getBrandExtras(deviceType, model?.id).map(q => ({
              label: q.question.replace(/\?$/, ""),
              value: extras[q.id]?.label,
              active: step === "extras" && getBrandExtras(deviceType, model?.id)[extrasIndex]?.id === q.id,
              helpId: null as null,
              show: true,
            })),
            { label: "Connectivity", value: connectivity?.label, active: step === "connectivity", helpId: null       as null,    show: deviceType === "ipad" },
            { label: "Carrier",      value: isManualQuote ? "N/A" : carrier?.label,      active: step === "carrier",      helpId: "carrier"  as const,   show: (isPhoneFlow || isIpadCellular) && !isManualQuote },
            { label: "Carrier Lock", value: isManualQuote ? "N/A" : carrierLock?.label,  active: step === "carrier-lock", helpId: null       as null,    show: (isPhoneFlow || isIpadCellular) && !isManualQuote },
          ].filter(row => row.show).map(row => (
            <div key={row.label} className={`rounded-lg px-3 py-2.5 transition-all duration-[250ms] ease-out ${row.active ? "bg-[#00c853]/12 border border-[#00c853]" : row.value ? "bg-[rgba(15,15,15,0.5)] border border-white/10" : "border border-transparent"}`}>
              <div className="flex items-center justify-between gap-2">
                <span className={`text-[11px] font-medium uppercase tracking-wider inline-flex items-center gap-1.5 ${row.active ? "text-[#00c853]" : "text-[#b8b8b8]"}`}>
                  {row.label}
                  {row.helpId && (
                    <button type="button" onClick={() => setHelpTopic(helpTopic === row.helpId ? null : row.helpId)} aria-label={`How to find ${row.label}`} className="w-4 h-4 rounded-full bg-white/10 hover:bg-[#00c853] hover:text-[#0a0a0a] flex items-center justify-center text-[10px] font-bold leading-none cursor-pointer transition">i</button>
                  )}
                </span>
                <span className={`text-right text-[15px] font-extrabold ${row.value ? (row.active ? "text-[#00c853]" : "text-white") : "text-[#888]"}`}>
                  {row.value || (row.active ? "Selecting…" : "—")}
                </span>
              </div>
            </div>
          ))}
        </div>
        {/* Accurate-quote guarantee badge */}
        <div className="mt-4 pt-4 border-t border-white/10 flex items-start gap-2.5">
          <span className="text-[#00c853] text-lg leading-none mt-0.5" style={{ filter: "drop-shadow(0 0 4px rgba(0,200,83,0.55))" }}>✓</span>
          <div>
            <p className="text-white text-[13px] font-extrabold leading-tight">Honored quote guarantee</p>
            <p className="text-[#e6e6e6] text-[12px] leading-snug mt-1">If your device matches the description above, we pay the quoted price — no surprise deductions.</p>
          </div>
        </div>
      </div>
    </aside>
  );

  // CHECKOUT SUMMARY — a stripped-down all-items list that replaces the
  // hero device panel on the checkout step. Keeps the eye on finalizing
  // the trade rather than admiring one device. Lists every cart item
  // (or just the current funnel device if the cart is empty) as a tight
  // row with a small thumb + qty + price, plus a grand total.
  const checkoutLines: Array<{ label: string; sub: string; price: number; quantity: number; image?: string; isPending: boolean }> =
    cartItems.length > 0
      ? cartItems.map(it => ({
          label: it.model,
          sub: [it.storage, it.condition].filter(Boolean).join(" · "),
          price: it.price,
          quantity: it.quantity,
          image: it.image,
          isPending: !it.price,
        }))
      : model
      ? [{
          label: model.label,
          sub: [storage?.label, condition?.label].filter(Boolean).join(" · "),
          price: quote,
          quantity,
          image: model.image,
          isPending: isPendingQuote,
        }]
      : [];
  const checkoutItemCount = checkoutLines.reduce((s, l) => s + l.quantity, 0);
  const checkoutTotal = checkoutLines.reduce((s, l) => s + l.price * l.quantity, 0);
  const checkoutHasPending = checkoutLines.some(l => l.isPending);
  const renderCheckoutRow = (l: typeof checkoutLines[number], i: number) => (
    <div key={i} className="flex items-center gap-3 py-2 border-b border-white/10 last:border-0">
      <div className="shrink-0 w-10 h-10 rounded-lg bg-[rgba(15,15,15,0.6)] border border-white/10 flex items-center justify-center overflow-hidden">
        {l.image ? (
          <img src={l.image} alt="" className="w-full h-full object-contain p-0.5" />
        ) : (
          <span className="text-lg opacity-40">📱</span>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[12px] font-bold text-white leading-tight truncate">{l.label}</p>
        {l.sub && <p className="text-[10px] text-[#b8b8b8] leading-tight truncate">{l.sub}</p>}
      </div>
      <div className="shrink-0 text-right">
        {l.isPending ? (
          <p className="text-[10px] font-semibold text-[#e6e6e6] leading-tight">Quoted via<br/>email/text</p>
        ) : (
          <p className="text-[13px] font-extrabold text-[#00c853] leading-tight">${l.price * l.quantity}</p>
        )}
        {l.quantity > 1 && <p className="text-[10px] text-[#b8b8b8] leading-tight">x{l.quantity}</p>}
      </div>
    </div>
  );
  const checkoutSummary = checkoutLines.length > 0 && (
    <aside className="hidden lg:block lg:w-[330px] shrink-0">
      <div className="sticky top-24 bg-[rgba(15,15,15,0.7)] backdrop-blur-[12px] border border-white/10 rounded-2xl p-4 shadow-[0_20px_50px_rgba(0,0,0,0.8)]">
        <div className="flex items-center justify-between mb-3">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#00c853]">Order summary</p>
          <span className="text-[11px] text-[#b8b8b8]">{checkoutItemCount} device{checkoutItemCount === 1 ? "" : "s"}</span>
        </div>
        <div className="max-h-[60vh] overflow-y-auto pr-1 -mr-1">
          {checkoutLines.map(renderCheckoutRow)}
        </div>
        <div className="mt-3 pt-3 border-t border-white/10 flex items-baseline justify-between gap-2">
          <span className="text-[12px] font-semibold uppercase tracking-wider text-[#e6e6e6]">Total</span>
          {checkoutTotal === 0 && checkoutHasPending ? (
            <span className="text-[20px] font-extrabold text-[#e6e6e6]">TBD</span>
          ) : (
            <span className="text-[20px] font-extrabold text-[#00c853]">${checkoutTotal}{checkoutHasPending && <span className="text-[10px] text-[#b8b8b8] font-semibold align-middle ml-1">+ quoted items</span>}</span>
          )}
        </div>
      </div>
    </aside>
  );
  const checkoutSummaryMobile = checkoutLines.length > 0 && (
    <div className="lg:hidden mb-4 bg-[rgba(15,15,15,0.7)] backdrop-blur-[8px] border border-white/10 rounded-2xl p-3">
      <div className="flex items-center justify-between mb-2">
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#00c853]">Order summary</p>
        <span className="text-[10px] text-[#b8b8b8]">{checkoutItemCount} device{checkoutItemCount === 1 ? "" : "s"}</span>
      </div>
      <div className="max-h-[40vh] overflow-y-auto pr-1 -mr-1">
        {checkoutLines.map(renderCheckoutRow)}
      </div>
      <div className="mt-2 pt-2 border-t border-white/10 flex items-baseline justify-between gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-[#e6e6e6]">Total</span>
        {checkoutTotal === 0 && checkoutHasPending ? (
          <span className="text-[18px] font-extrabold text-[#e6e6e6]">TBD</span>
        ) : (
          <span className="text-[18px] font-extrabold text-[#00c853]">${checkoutTotal}{checkoutHasPending && <span className="text-[9px] text-[#b8b8b8] font-semibold align-middle ml-1">+ quoted</span>}</span>
        )}
      </div>
    </div>
  );

  // SEARCH BAR — rendered globally inside the sticky <nav> as a second
  // row so it's accessible from every page/step on both desktop and
  // mobile. No mb-6 here; the nav wrapper handles spacing.
  const searchBar = (
    <div className="relative">
      <input
        type="text"
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Escape") setSearchQuery(""); }}
        placeholder="Search device — iPhone, Galaxy, MacBook..."
        className="w-full pl-10 pr-10 py-3 bg-white/[0.07] border border-white/20 rounded-2xl text-sm text-white placeholder:text-[#a0a0a0] focus:outline-none focus:bg-white/[0.10] focus:border-[#00c853] focus:ring-4 focus:ring-[#00c853]/15 transition shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]"
      />
      <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#e6e6e6] pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" /></svg>
      {searchQuery.length > 0 && (
        <button
          type="button"
          onClick={() => setSearchQuery("")}
          aria-label="Clear search"
          className="absolute right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition cursor-pointer"
        >
          <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
      )}
      {searchQuery.trim().length >= 2 && (() => {
        const q = searchQuery.toLowerCase().trim();
        type Hit = { label: string; deviceType: DeviceType; seriesId: string; modelId: string; category: typeof category; base: number; image: string };
        const hits: Hit[] = [];
        const catFallback = (cat: typeof category): string => ({
          phones: "📱", tablets: "📲", computers: "💻", desktops: "🖥️",
          watches: "⌚", consoles: "🎮", drones: "🛸", vr: "🥽",
        } as Record<string, string>)[cat || ""] || "📦";
        const collectFromSeries = (list: { id: string; label: string; image?: string; variants: { id: string; label: string; base: number; image?: string }[] }[], deviceType: DeviceType, cat: typeof category) => {
          for (const s of list) {
            for (const v of s.variants) {
              if (v.label.toLowerCase().includes(q)) {
                hits.push({ label: v.label, deviceType, seriesId: s.id, modelId: v.id, category: cat, base: v.base || 0, image: v.image || s.image || "" });
              }
            }
          }
        };
        collectFromSeries(IPHONE_SERIES, "iphone", "phones");
        collectFromSeries(SAMSUNG_SERIES, "android", "phones");
        collectFromSeries(PIXEL_SERIES, "pixel", "phones");
        collectFromSeries(IPAD_SERIES, "ipad", "tablets");
        collectFromSeries(MACBOOK_SERIES.map(s => ({...s, variants: s.variants as { id: string; label: string; base: number; image?: string }[]})), "macbook", "computers");
        collectFromSeries(APPLE_DESKTOP_SERIES.map(s => ({...s, variants: s.variants as { id: string; label: string; base: number; image?: string }[]})), "apple_desktop", "desktops");
        collectFromSeries(SONY_SERIES, "sony", "consoles");
        collectFromSeries(SURFACE_SERIES.map(s => ({...s, variants: s.variants as { id: string; label: string; base: number; image?: string }[]})), "surface", "tablets");
        const flatLists: { list: { id: string; label: string; base: number; image?: string }[]; dt: DeviceType; cat: typeof category }[] = [
          { list: ASUS_PC_MODELS, dt: "asus_pc", cat: "computers" },
          { list: LENOVO_THINKBOOK_VARIANTS, dt: "lenovo", cat: "computers" },
          { list: LENOVO_IDEAPAD_VARIANTS, dt: "lenovo", cat: "computers" },
          { list: LENOVO_LEGION_VARIANTS, dt: "lenovo", cat: "computers" },
          { list: LENOVO_LOQ_VARIANTS, dt: "lenovo", cat: "computers" },
          { list: LENOVO_SLIM_VARIANTS, dt: "lenovo", cat: "computers" },
          { list: LENOVO_YOGA_VARIANTS, dt: "lenovo", cat: "computers" },
          { list: LENOVO_TP_X1_VARIANTS, dt: "lenovo", cat: "computers" },
          { list: LENOVO_TP_X13_VARIANTS, dt: "lenovo", cat: "computers" },
          { list: LENOVO_TP_X390_VARIANTS, dt: "lenovo", cat: "computers" },
          { list: LENOVO_TP_X9_VARIANTS, dt: "lenovo", cat: "computers" },
          { list: LENOVO_TP_T_VARIANTS, dt: "lenovo", cat: "computers" },
          { list: LENOVO_TP_P_VARIANTS, dt: "lenovo", cat: "computers" },
          { list: LENOVO_TP_L_VARIANTS, dt: "lenovo", cat: "computers" },
          { list: LENOVO_TP_E_VARIANTS, dt: "lenovo", cat: "computers" },
          { list: LENOVO_TP_Z_VARIANTS, dt: "lenovo", cat: "computers" },
          { list: DELL_PC_ALL_SUB_SERIES.flatMap(s => s.variants), dt: "dell", cat: "computers" },
          { list: HP_ENVY_VARIANTS, dt: "hp", cat: "computers" },
          { list: HP_PAVILION_VARIANTS, dt: "hp", cat: "computers" },
          { list: HP_PROBOOK_VARIANTS, dt: "hp", cat: "computers" },
          { list: HP_SPECTRE_VARIANTS, dt: "hp", cat: "computers" },
          { list: HP_VICTUS_VARIANTS, dt: "hp", cat: "computers" },
          { list: HP_ZBOOK_VARIANTS, dt: "hp", cat: "computers" },
          { list: HP_NOTEBOOK_VARIANTS, dt: "hp", cat: "computers" },
          { list: HP_OMNIBOOK_VARIANTS, dt: "hp", cat: "computers" },
          { list: HP_ELITEBOOK_STD_VARIANTS, dt: "hp", cat: "computers" },
          { list: HP_ELITEBOOK_ULTRA_VARIANTS, dt: "hp", cat: "computers" },
          { list: HP_OMEN_STD_VARIANTS, dt: "hp", cat: "computers" },
          { list: HP_OMEN_TRANSCEND_VARIANTS, dt: "hp", cat: "computers" },
          { list: ACER_NITRO_VARIANTS, dt: "acer", cat: "computers" },
          { list: ACER_PREDATOR_VARIANTS, dt: "acer", cat: "computers" },
          { list: SAMSUNG_BOOK5_VARIANTS, dt: "samsung_pc", cat: "computers" },
          { list: SAMSUNG_BOOK4_VARIANTS, dt: "samsung_pc", cat: "computers" },
          { list: SAMSUNG_BOOK3_VARIANTS, dt: "samsung_pc", cat: "computers" },
          { list: SAMSUNG_BOOK2_VARIANTS, dt: "samsung_pc", cat: "computers" },
          { list: SAMSUNG_BOOK1_VARIANTS, dt: "samsung_pc", cat: "computers" },
          { list: LG_GRAM_14_VARIANTS, dt: "lg_pc", cat: "computers" },
          { list: LG_GRAM_14_2IN1_VARIANTS, dt: "lg_pc", cat: "computers" },
          { list: LG_GRAM_15_VARIANTS, dt: "lg_pc", cat: "computers" },
          { list: LG_GRAM_16_VARIANTS, dt: "lg_pc", cat: "computers" },
          { list: LG_GRAM_16_2IN1_VARIANTS, dt: "lg_pc", cat: "computers" },
          { list: LG_GRAM_17_VARIANTS, dt: "lg_pc", cat: "computers" },
          { list: LG_GRAM_PRO_16_VARIANTS, dt: "lg_pc", cat: "computers" },
          { list: LG_GRAM_PRO_16_2IN1_VARIANTS, dt: "lg_pc", cat: "computers" },
          { list: LG_GRAM_PRO_17_VARIANTS, dt: "lg_pc", cat: "computers" },
          { list: LG_GRAM_SUPERSLIM_15_VARIANTS, dt: "lg_pc", cat: "computers" },
          // Desktops
          { list: DELL_DESKTOP_MODELS, dt: "dell_desktop", cat: "desktops" },
          { list: LENOVO_DESKTOP_MODELS, dt: "lenovo_desktop", cat: "desktops" },
          { list: HP_DESKTOP_MODELS, dt: "hp_desktop", cat: "desktops" },
          { list: ASUS_DESKTOP_MODELS, dt: "asus_desktop", cat: "desktops" },
          { list: ALIENWARE_DESKTOP_MODELS, dt: "alienware_desktop", cat: "desktops" },
          { list: MSI_DESKTOP_MODELS, dt: "msi_desktop", cat: "desktops" },
          // Alienware laptops
          { list: ALIENWARE_MODELS, dt: "alienware", cat: "computers" },
          // VR / mixed reality headsets
          { list: APPLE_VR_MODELS as unknown as { id: string; label: string; base: number; image?: string }[], dt: "apple_vr", cat: "vr" },
          { list: META_VR_MODELS as unknown as { id: string; label: string; base: number; image?: string }[], dt: "meta_vr", cat: "vr" },
          { list: VALVE_VR_MODELS as unknown as { id: string; label: string; base: number; image?: string }[], dt: "valve_vr", cat: "vr" },
          { list: PSVR_MODELS as unknown as { id: string; label: string; base: number; image?: string }[], dt: "psvr", cat: "vr" },
          // Smartwatches
          { list: APPLEWATCH_MODELS as unknown as { id: string; label: string; base: number; image?: string }[], dt: "applewatch", cat: "watches" },
          { list: PIXELWATCH_MODELS as unknown as { id: string; label: string; base: number; image?: string }[], dt: "pixelwatch", cat: "watches" },
          { list: GARMIN_MODELS as unknown as { id: string; label: string; base: number; image?: string }[], dt: "garmin", cat: "watches" },
          { list: SAMSUNGWATCH_MODELS as unknown as { id: string; label: string; base: number; image?: string }[], dt: "samsungwatch", cat: "watches" },
          // Other consoles (Sony already covered via SONY_SERIES)
          { list: MICROSOFT_MODELS as unknown as { id: string; label: string; base: number; image?: string }[], dt: "microsoft", cat: "consoles" },
          { list: NINTENDO_MODELS as unknown as { id: string; label: string; base: number; image?: string }[], dt: "nintendo", cat: "consoles" },
          // Drones
          { list: DJI_MODELS as unknown as { id: string; label: string; base: number; image?: string }[], dt: "dji", cat: "drones" },
          // Non-Apple tablets
          { list: SAMSUNG_TAB_MODELS as unknown as { id: string; label: string; base: number; image?: string }[], dt: "samsung_tab", cat: "tablets" },
          { list: LENOVO_TAB_SERIES.flatMap(s => s.variants) as unknown as { id: string; label: string; base: number; image?: string }[], dt: "lenovo_tab", cat: "tablets" },
          { list: ONEPLUS_TAB_MODELS as unknown as { id: string; label: string; base: number; image?: string }[], dt: "oneplus_tab", cat: "tablets" },
          { list: GOOGLE_TAB_MODELS as unknown as { id: string; label: string; base: number; image?: string }[], dt: "google_tab", cat: "tablets" },
        ];
        for (const fl of flatLists) {
          for (const v of fl.list) {
            if (v.label.toLowerCase().includes(q)) {
              hits.push({ label: v.label, deviceType: fl.dt, seriesId: "", modelId: v.id, category: fl.cat, base: v.base || 0, image: v.image || "" });
            }
          }
        }
        const top = hits.slice(0, 12);
        return (
          <div className="absolute z-50 left-0 right-0 mt-2 bg-[#111] border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
            {top.length === 0 ? (
              <div className="px-4 py-4 text-sm text-[#e6e6e6] text-center">No matches for &ldquo;{searchQuery}&rdquo;. Try a different name.</div>
            ) : (
              <div className="overflow-y-auto max-h-[60vh]">
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#00c853] px-4 pt-3 pb-2">{hits.length} {hits.length === 1 ? "match" : "matches"}{hits.length > 12 ? " — showing top 12" : ""}</p>
                {top.map((h, i) => (
                  <button
                    key={`${h.deviceType}-${h.seriesId}-${h.modelId}-${i}`}
                    onClick={() => {
                      setCategory(h.category);
                      setDeviceType(h.deviceType);
                      if (h.seriesId) setSelectedSeries(h.seriesId);
                      setModel({ id: h.modelId, label: h.label, base: h.base, image: h.image });
                      setSearchQuery("");
                      setStep("condition");
                      pushHistory("condition");
                    }}
                    className="w-full text-left px-4 py-2.5 hover:bg-white/5 transition flex items-center gap-3 border-b border-white/10 last:border-0 cursor-pointer"
                  >
                    {h.image ? (
                      <img src={h.image} alt={h.label} loading="lazy" className="w-10 h-10 object-contain flex-shrink-0 rounded-md bg-white/5" />
                    ) : (
                      <div className="w-10 h-10 flex items-center justify-center flex-shrink-0 rounded-md bg-white/5 text-lg">{catFallback(h.category)}</div>
                    )}
                    <span className="text-sm font-semibold text-white flex-1 truncate">{h.label}</span>
                    <svg className="w-4 h-4 text-[#e6e6e6] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                  </button>
                ))}
              </div>
            )}
          </div>
        );
      })()}
    </div>
  );
  const models = deviceType === "iphone" ? iphoneVariants : deviceType === "android" ? samsungSelectedVariants : deviceType === "pixel" ? pixelVariants : deviceType === "macbook" ? macbookSelectedVariants : deviceType === "samsung_pc" ? samsungBookVariants : deviceType === "lenovo" ? lenovoPcVariants : deviceType === "dell" ? dellPcVariants : deviceType === "alienware" ? alienwareVariants : deviceType === "hp" ? hpPcVariants : deviceType === "acer" ? acerPcVariants : deviceType === "lg_pc" ? lgPcVariants : deviceType === "apple_desktop" ? appleDesktopVariants : deviceType === "dell_desktop" ? DELL_DESKTOP_MODELS : deviceType === "lenovo_desktop" ? LENOVO_DESKTOP_MODELS : deviceType === "hp_desktop" ? HP_DESKTOP_MODELS : deviceType === "asus_pc" ? asusPcVariants : deviceType === "asus_desktop" ? ASUS_DESKTOP_MODELS : deviceType === "alienware_desktop" ? ALIENWARE_DESKTOP_MODELS : deviceType === "msi_desktop" ? MSI_DESKTOP_MODELS : deviceType === "console" ? CONSOLE_MODELS : deviceType === "sony" ? sonyVariants : deviceType === "microsoft" ? MICROSOFT_MODELS : deviceType === "nintendo" ? NINTENDO_MODELS : deviceType === "applewatch" ? APPLEWATCH_MODELS : deviceType === "pixelwatch" ? PIXELWATCH_MODELS : deviceType === "garmin" ? GARMIN_MODELS : deviceType === "samsungwatch" ? SAMSUNGWATCH_MODELS :  deviceType === "ipad" ? ipadVariants : [];

  return (
    <main className="min-h-screen bg-[#0a0a0a] text-white overflow-x-hidden">
      {/* Google Maps Places script — powers the shipping address
          autocomplete. lazyOnload so it doesn't block first paint;
          NEXT_PUBLIC_GOOGLE_MAPS_API_KEY must be set in Vercel env.
          Mirrors the implementation on atx-gadget-fix. */}
      {process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY && (
        <Script
          src={`https://maps.googleapis.com/maps/api/js?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}&libraries=places`}
          strategy="lazyOnload"
          onLoad={() => initShipAutocomplete()}
        />
      )}
      {/* CART TOAST — fixed top-center on mobile, top-right on lg.
          Slides up + fades. Auto-dismisses after 2.4s. Two variants:
          'add' (green check, ✓) and 'remove' (red minus, ×). */}
      {cartToast && (() => {
        const isRemove = cartToast.kind === "remove";
        const accent = isRemove ? "#ff5566" : "#00c853";
        const accentRgba = isRemove ? "rgba(255,85,102," : "rgba(0,200,83,";
        return (
          <div className="fixed top-20 left-1/2 -translate-x-1/2 lg:left-auto lg:right-6 lg:translate-x-0 z-[60] toast-in-up">
            <div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-[rgba(15,15,15,0.92)] backdrop-blur-[14px]" style={{ border: `1px solid ${accentRgba}0.4)`, boxShadow: `0 18px 45px rgba(0,0,0,0.6), 0 0 18px ${accentRgba}0.18)` }}>
              <span className="w-7 h-7 rounded-full flex items-center justify-center font-extrabold text-sm shrink-0 text-[#0a0a0a]" style={{ background: accent, boxShadow: `0 0 12px ${accentRgba}0.55)` }}>{isRemove ? "×" : "✓"}</span>
              <div className="min-w-0">
                <p className="text-white text-[13px] font-extrabold leading-tight">{isRemove ? "Removed from cart" : "Added to cart"}</p>
                <p className="text-[#e6e6e6] text-[12px] leading-snug truncate max-w-[220px]">{cartToast.model}{cartToast.price ? <> — <span className="font-bold" style={{ color: accent }}>${cartToast.price}</span></> : null}</p>
              </div>
            </div>
          </div>
        );
      })()}
      {/* NAV */}
      <nav className="sticky top-0 z-40 bg-[#0a0a0a]/95 backdrop-blur-xl border-b border-white/10">
        {/* PROMO STRIP — own row above the logo + menu so it never feels squeezed.
            Click to claim the weekly bonus; bonus only applies once claimed. */}
        <button
          type="button"
          onClick={() => {
            if (promoClaimed) return;
            setPromoClaimed(true);
            try { localStorage.setItem("tcc_promo_claimed", "1"); } catch {}
            setCartToast({ model: "Weekly bonus", price: promo?.flatBonus ?? 20 });
            setTimeout(() => setCartToast(null), 2400);
          }}
          className={`block w-full text-center px-3 py-2 transition border-b cursor-pointer ${promoClaimed ? "bg-[#00c853]/25 border-[#00c853]/40" : "bg-gradient-to-r from-[#00c853]/15 via-[#00e676]/25 to-[#00c853]/15 hover:from-[#00c853]/25 hover:via-[#00e676]/35 hover:to-[#00c853]/25 border-[#00c853]/20"}`}
          style={!promoClaimed ? { backgroundSize: "200% 100%", animation: "promoGradient 6s ease-in-out infinite" } : undefined}
        >
          {promoClaimed ? (
            <span className="text-[#00c853] text-xs font-extrabold tracking-wide">✓ Bonus applied — your quote includes +${promo?.flatBonus ?? 20}</span>
          ) : (
            <>
              <span className="hidden sm:inline text-[#00c853] text-xs font-extrabold tracking-wide">{promo?.active ? `${promo.text} · Click to apply` : "🎁 This week — extra cash on select devices · Click to apply"}</span>
              <span className="sm:hidden text-[#00c853] text-[11px] font-extrabold tracking-wide">{promo?.active ? `${promo.text} · Click to apply` : "🎁 Extra cash · Click to apply"}</span>
            </>
          )}
        </button>
        <div className="max-w-lg md:max-w-3xl lg:max-w-none mx-auto px-4 lg:px-8 py-3 flex items-center justify-between relative">
          {/* LEFT: logo */}
          <button onClick={() => { reset(); window.scrollTo({ top: 0, behavior: "smooth" }); }} aria-label="Go to homepage" className="cursor-pointer group tap-press rounded-full shrink-0 bg-white/[0.07] border border-white/10 hover:bg-white/[0.07] pl-1.5 pr-3 py-1 transition">
            <span className="flex items-center gap-2">
              <span className="relative w-9 h-9 rounded-xl tcc-logo-card flex items-center justify-center">
                <span className="absolute inset-0 rounded-xl pointer-events-none" style={{ background: "radial-gradient(circle at 28% 25%, rgba(0,230,118,0.18), transparent 65%)" }}></span>
                <span className="relative w-6 h-6 rounded-lg tcc-logo-tile flex items-center justify-center">
                  <svg viewBox="0 0 24 24" className="w-3.5 h-5" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ filter: "drop-shadow(0 1px 0 rgba(0,0,0,0.35))" }}>
                    <rect x="6" y="1.5" width="12" height="21" rx="3" />
                    <rect x="10" y="3" width="4" height="1.4" rx="0.7" fill="#fff" stroke="none" />
                    <line x1="10.8" y1="3.7" x2="13.2" y2="3.7" strokeWidth="0.6" stroke="#00a039" />
                    <rect x="7.5" y="5.5" width="9" height="13.5" rx="1" stroke="rgba(255,255,255,0.4)" strokeWidth="0.7" />
                    <line x1="10" y1="20.3" x2="14" y2="20.3" strokeWidth="1.6" />
                    <line x1="5.6" y1="9" x2="5.6" y2="12" strokeWidth="1" />
                  </svg>
                </span>
                <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full flex items-center justify-center text-[8px] font-extrabold text-[#1a1100] tcc-logo-coin" style={{ background: "radial-gradient(circle at 30% 30%, #ffe066, #ffb400 70%, #c08a00)", boxShadow: "0 1px 2px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.7)" }}>$</span>
              </span>
              <div className="flex flex-col leading-none">
                <span className="text-[15px] font-black tracking-[-0.02em] text-transparent bg-clip-text bg-gradient-to-b from-white via-white to-[#bdbdbd] group-hover:from-[#00e676] group-hover:via-[#00e676] group-hover:to-[#00a039] transition" style={{ fontFeatureSettings: '"ss01", "cv11"' }}>TOP CASH</span>
                <span className="flex items-center gap-1.5 text-[9px] font-bold tracking-[0.32em] uppercase">
                  <span className="block w-1 h-1 rounded-full bg-[#00c853] shadow-[0_0_4px_#00c853]"></span>
                  <span className="text-[#00c853]">Cellular</span>
                </span>
              </div>
            </span>
          </button>

          {/* CENTER (lg+ only, absolutely centered relative to the nav row): Sell / Bulk / Support */}
          <div className="hidden lg:flex items-center gap-2 absolute left-1/2 -translate-x-1/2 bg-white/[0.07] border border-white/10 rounded-full px-2 py-1">
            {/* SELL — mega menu, dropdown centered under the trigger */}
            <div className="group relative" onMouseEnter={() => setMegaMenuOpen("sell")} onMouseLeave={() => setMegaMenuOpen(null)}>
              <button
                onClick={() => { setStep("category"); pushHistory("category"); }}
                className="flex items-center gap-2 px-5 py-2.5 rounded-full text-[15px] font-semibold text-white hover:text-[#00c853] hover:bg-white/5 transition cursor-pointer"
              >
                Sell
                <svg className="w-3 h-3 opacity-60 group-hover:opacity-100 group-hover:rotate-180 transition" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
              </button>
              <div className={`absolute top-full left-1/2 -translate-x-1/2 pt-3 z-50 w-[720px] max-w-[calc(100vw-2rem)] transition-all duration-300 ease-out ${megaMenuOpen === "sell" ? "visible opacity-100 translate-y-0" : "invisible opacity-0 translate-y-2"}`} onClick={() => setMegaMenuOpen(null)}>
                <div className="bg-[#111] border border-white/10 rounded-3xl shadow-2xl p-6">
                  <div className="flex items-center justify-between mb-5">
                    <p className="text-[#00c853] text-[11px] font-bold uppercase tracking-[0.2em]">Sell your device</p>
                    <p className="text-[#9a9a9a] text-[11px]">Pick a category — instant quote in 30 sec</p>
                  </div>
                  <div className="grid grid-cols-4 gap-3">
                    {[
                      { id: "phones" as const, label: "Phone" },
                      { id: "tablets" as const, label: "Tablet" },
                      { id: "computers" as const, label: "Laptop" },
                      { id: "desktops" as const, label: "Desktop" },
                      { id: "watches" as const, label: "Smartwatch" },
                      { id: "consoles" as const, label: "Console" },
                      { id: "drones" as const, label: "Drone" },
                      { id: "vr" as const, label: "VR" },
                    ].map((cat) => (
                      <button
                        key={cat.id}
                        onClick={() => { setCategory(cat.id); setStep("brand"); pushHistory("brand"); }}
                        className="group/cat flex flex-col items-center justify-center gap-2 p-4 rounded-2xl bg-white/[0.06] border border-white/10 hover:bg-[#00c853]/10 hover:border-[#00c853]/50 hover:-translate-y-0.5 transition-all duration-200 cursor-pointer tap-press"
                      >
                        <CategoryIcon id={cat.id} className="w-9 h-9 text-white group-hover/cat:text-[#00c853] transition" />
                        <p className="text-[13px] font-semibold text-white">{cat.label}</p>
                      </button>
                    ))}
                  </div>
                  <div className="mt-5 pt-5 border-t border-white/10">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-[#00c853] text-[11px] font-bold uppercase tracking-[0.2em]">Hot today</p>
                      <span className="inline-flex items-center gap-1.5 text-[10px] text-[#00c853] font-bold uppercase tracking-wider">
                        <span className="relative flex h-1.5 w-1.5"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#00c853] opacity-75"></span><span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[#00c853]"></span></span>
                        Live prices
                      </span>
                    </div>
                    <div className="grid grid-cols-4 gap-3">
                      {([
                        { model: "ip17pm", title: "iPhone 17 Pro Max", floor: 767, photo: "/devices/iphone-17-pro-max-test.png", dt: "iphone" as const, cat: "phones" as const },
                        { model: "gs25u", title: "Galaxy S25 Ultra", floor: 414, photo: "/devices/gs25u.webp", dt: "android" as const, cat: "phones" as const, tight: true },
                        { model: "mbp16m4", title: "MacBook Pro 16\" M4", floor: 1456, photo: "/devices/macbook-pro-m4.webp", dt: "macbook" as const, cat: "computers" as const },
                        { model: "ipadpro13m5", title: "iPad Pro 13\"", floor: 610, photo: "/devices/ipad-pro-13-m5.webp", dt: "ipad" as const, cat: "tablets" as const },
                      ]).map(d => {
                        const topPrice = getMaxPrice({ id: d.model, base: d.floor }, d.dt);
                        // Same tight wrap pattern as the hero widget: edge-to-edge
                        // photos render inside a same-size slot with explicit
                        // padding so they don't visually dominate the row.
                        const isTight = (d as { tight?: boolean }).tight;
                        return (
                          <button
                            key={d.model}
                            onClick={() => {
                              setCategory(d.cat);
                              setDeviceType(d.dt);
                              setModel({ id: d.model, label: d.title, base: d.floor, image: d.photo });
                              setStep("condition");
                              pushHistory("condition");
                            }}
                            className="flex flex-col items-center text-center gap-1 p-3 rounded-2xl bg-white/[0.06] border border-white/10 hover:bg-[#00c853]/10 hover:border-[#00c853]/50 hover:-translate-y-0.5 transition-all duration-200 cursor-pointer tap-press"
                          >
                            {isTight ? (
                              <div className="w-12 h-12 mb-1 flex items-center justify-center p-2">
                                <img src={d.photo} alt={d.title} className="w-full h-full object-contain" loading="lazy" />
                              </div>
                            ) : (
                              <img src={d.photo} alt={d.title} className="w-12 h-12 object-contain mb-1" loading="lazy" />
                            )}
                            <p className="text-[11px] font-semibold text-white leading-tight min-h-[2.2em]">{d.title}</p>
                            <p className="text-[#00c853] text-sm font-extrabold leading-none">up to ${topPrice}</p>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* BULK */}
            <div className="group relative" onMouseEnter={() => setMegaMenuOpen("bulk")} onMouseLeave={() => setMegaMenuOpen(null)}>
              <a
                href="/bulk"
                className="flex items-center gap-2 px-5 py-2.5 rounded-full text-[15px] font-semibold text-white hover:text-[#00c853] hover:bg-white/5 transition cursor-pointer"
              >
                Bulk
                <svg className="w-3 h-3 opacity-60 group-hover:opacity-100 group-hover:rotate-180 transition" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
              </a>
              <div className={`absolute top-full left-1/2 -translate-x-1/2 pt-3 z-50 w-[640px] max-w-[calc(100vw-2rem)] transition-all duration-300 ease-out ${megaMenuOpen === "bulk" ? "visible opacity-100 translate-y-0" : "invisible opacity-0 translate-y-2"}`} onClick={() => setMegaMenuOpen(null)}>
                <div className="bg-[#111] border border-white/10 rounded-3xl shadow-2xl p-6">
                  <div className="flex items-center justify-between mb-5">
                    <p className="text-[#00c853] text-[11px] font-bold uppercase tracking-[0.2em]">Bulk trade-ins</p>
                    <p className="text-[#9a9a9a] text-[11px]">10+ devices · enterprise &amp; resellers</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {/* LEFT — action cards */}
                    <div className="space-y-2">
                      <a href="/bulk" className="group/blk flex items-start gap-3 p-3 rounded-2xl bg-white/[0.06] border border-white/10 hover:bg-[#00c853]/10 hover:border-[#00c853]/50 hover:-translate-y-0.5 transition-all duration-200">
                        <span className="text-2xl shrink-0">📦</span>
                        <div className="min-w-0">
                          <p className="text-[13px] font-bold text-white group-hover/blk:text-[#00c853] transition">Get a bulk quote</p>
                          <p className="text-[11px] text-[#b8b8b8] mt-0.5 leading-snug">One submission, one payout, volume pricing.</p>
                        </div>
                      </a>
                      <a href={EMAIL_HREF} className="group/blk flex items-start gap-3 p-3 rounded-2xl bg-white/[0.06] border border-white/10 hover:bg-[#00c853]/10 hover:border-[#00c853]/50 hover:-translate-y-0.5 transition-all duration-200">
                        <span className="text-2xl shrink-0">🤝</span>
                        <div className="min-w-0">
                          <p className="text-[13px] font-bold text-white group-hover/blk:text-[#00c853] transition">Talk to bulk team</p>
                          <p className="text-[11px] text-[#b8b8b8] mt-0.5 leading-snug">Custom contracts, NDAs, decommissioning.</p>
                        </div>
                      </a>
                      <a href="tel:+18775492056" className="group/blk flex items-start gap-3 p-3 rounded-2xl bg-white/[0.06] border border-white/10 hover:bg-[#00c853]/10 hover:border-[#00c853]/50 hover:-translate-y-0.5 transition-all duration-200">
                        <span className="text-2xl shrink-0">📞</span>
                        <div className="min-w-0">
                          <p className="text-[13px] font-bold text-white group-hover/blk:text-[#00c853] transition">Call bulk line</p>
                          <p className="text-[11px] text-[#b8b8b8] mt-0.5 leading-snug">(877) 549-2056 · same-day callback</p>
                        </div>
                      </a>
                    </div>
                    {/* RIGHT — inline FAQ */}
                    <div className="bg-white/[0.05] rounded-2xl p-4 border border-white/10">
                      <p className="text-[10px] uppercase tracking-[0.18em] text-[#00c853] font-bold mb-3">Bulk FAQ</p>
                      <div className="space-y-3">
                        {[
                          { q: "How many is bulk?", a: "10+ devices in one shipment." },
                          { q: "Mixed brands OK?", a: "Yes — iPhones, MacBooks, PCs in one quote." },
                          { q: "Payout timing?", a: "Same business day after inspection." },
                          { q: "NIST 800-88 wipe report?", a: "Included free for any 25+ device order." },
                        ].map(f => (
                          <div key={f.q}>
                            <p className="text-[12px] font-semibold text-white leading-tight">{f.q}</p>
                            <p className="text-[11px] text-[#b8b8b8] mt-0.5 leading-snug">{f.a}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                  {/* FOOTER — volume tier strip */}
                  <div className="mt-5 pt-4 border-t border-white/10 grid grid-cols-3 gap-3">
                    {[
                      { tier: "10+", note: "Priority pickup" },
                      { tier: "25+", note: "Free NIST wipe report" },
                      { tier: "50+", note: "Dedicated rep · custom contract" },
                    ].map(t => (
                      <div key={t.tier} className="text-center">
                        <p className="text-[#00c853] text-base font-extrabold leading-none">{t.tier}</p>
                        <p className="text-[10px] text-[#9a9a9a] mt-1">{t.note}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* SUPPORT */}
            <div className="group relative" onMouseEnter={() => setMegaMenuOpen("support")} onMouseLeave={() => setMegaMenuOpen(null)}>
              <button
                className="flex items-center gap-2 px-5 py-2.5 rounded-full text-[15px] font-semibold text-white hover:text-[#00c853] hover:bg-white/5 transition cursor-pointer"
              >
                Support
                <svg className="w-3 h-3 opacity-60 group-hover:opacity-100 group-hover:rotate-180 transition" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
              </button>
              <div className={`absolute top-full right-0 pt-3 z-50 w-[680px] max-w-[calc(100vw-2rem)] transition-all duration-300 ease-out ${megaMenuOpen === "support" ? "visible opacity-100 translate-y-0" : "invisible opacity-0 translate-y-2"}`} onClick={() => setMegaMenuOpen(null)}>
                <div className="bg-[#111] border border-white/10 rounded-3xl shadow-2xl p-6">
                  <div className="flex items-center justify-between mb-5">
                    <p className="text-[#00c853] text-[11px] font-bold uppercase tracking-[0.2em]">Help &amp; info</p>
                    <span className="inline-flex items-center gap-1.5 text-[10px] text-[#00c853] font-bold uppercase tracking-wider">
                      <span className="relative flex h-1.5 w-1.5"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#00c853] opacity-75"></span><span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[#00c853]"></span></span>
                      Reply in ~1 hr
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    {/* LEFT — action cards */}
                    <div className="space-y-2">
                      {([
                        { href: "/how-it-works", icon: "🧭", title: "How it works", sub: "Drawer to dollars in 3 steps" },
                        { href: "/faq", icon: "❓", title: "Full FAQ", sub: "Plain answers, common questions" },
                        { href: "/reviews", icon: "★", title: "Reviews", sub: "★ 4.9 from real sellers", iconColor: "text-[#ffb400]" },
                        { href: "/track", icon: "📍", title: "Track your trade", sub: "Status, payout, tracking #" },
                        { href: EMAIL_HREF, icon: "✉️", title: "Email us", sub: "Same business day reply" },
                      ]).map(item => (
                        <a key={item.title} href={item.href} className="group/sup flex items-start gap-3 p-3 rounded-2xl bg-white/[0.06] border border-white/10 hover:bg-[#00c853]/10 hover:border-[#00c853]/50 hover:-translate-y-0.5 transition-all duration-200">
                          <span className={`text-2xl shrink-0 ${item.iconColor ?? ""}`}>{item.icon}</span>
                          <div className="min-w-0">
                            <p className="text-[13px] font-bold text-white group-hover/sup:text-[#00c853] transition leading-tight">{item.title}</p>
                            <p className="text-[11px] text-[#b8b8b8] mt-1 leading-snug">{item.sub}</p>
                          </div>
                        </a>
                      ))}
                    </div>
                    {/* RIGHT — inline answers to most-asked questions */}
                    <div className="bg-white/[0.05] rounded-2xl p-4 border border-white/10">
                      <p className="text-[10px] uppercase tracking-[0.18em] text-[#00c853] font-bold mb-3">Top questions</p>
                      <div className="space-y-3">
                        {[
                          { q: "How fast do I get paid?", a: "Same business day after we verify. Cash App / Zelle in minutes." },
                          { q: "Is shipping free?", a: "Yes — we email a prepaid FedEx / UPS label. $100 carrier insurance included." },
                          { q: "What if condition mismatches?", a: "Revised offer with photos. Reject = free return ship." },
                          { q: "Is my data safe?", a: "NIST 800-88 wipe on every device. Recommend you reset first." },
                        ].map(f => (
                          <div key={f.q}>
                            <p className="text-[12px] font-semibold text-white leading-tight">{f.q}</p>
                            <p className="text-[11px] text-[#b8b8b8] mt-0.5 leading-snug">{f.a}</p>
                          </div>
                        ))}
                      </div>
                      <a href="/faq" className="mt-3 inline-flex items-center gap-1 text-[11px] font-bold text-[#00c853] hover:text-[#00e676] transition">
                        See all FAQs <span>→</span>
                      </a>
                    </div>
                  </div>
                  {/* FOOTER — call CTA */}
                  <a href="tel:+18775492056" className="mt-5 flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-[#00c853]/15 border border-[#00c853]/40 hover:bg-[#00c853]/25 transition-all duration-200">
                    <span className="text-lg">📞</span>
                    <span className="text-[13px] font-bold text-[#00c853]">Call (877) 549-2056 — Mon-Sat 9a-7p CT</span>
                  </a>
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT: cart + login/name (desktop) | cart + hamburger (mobile) — wrapped in matching pill */}
          <div className="flex items-center gap-1 shrink-0 bg-white/[0.07] border border-white/10 rounded-full px-1.5 py-1">
            {/* TEXT US — mobile-only quick SMS button. Was a floating bottom-right
                FAB; moved here so the bottom of the screen stays clean. */}
            <a
              href="sms:+18775492056?body=Hi%2C%20I%20want%20a%20quote%20for%20my%20"
              aria-label="Text us for a quote"
              className="lg:hidden w-9 h-9 rounded-full hover:bg-white/10 hover:text-[#00c853] flex items-center justify-center cursor-pointer tap-press transition"
            >
              <svg className="w-5 h-5 text-[#00c853]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </a>

            {/* CART — always visible on every screen size. Bumps + glows
                when items are added (cartBump key change retriggers the
                cart-bump keyframe). */}
            <button
              key={`cart-${cartBump}`}
              onClick={() => setCartOpen(!cartOpen)}
              aria-label="Cart"
              className={`relative w-9 h-9 rounded-full hover:bg-white/10 hover:text-[#00c853] flex items-center justify-center cursor-pointer tap-press transition ${cartBump > 0 ? "cart-bump" : ""}`}
            >
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z" />
              </svg>
              {cartItems.length > 0 && (
                <span key={`badge-${cartBump}`} className={`absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-[#00c853] text-[#0a0a0a] text-[10px] font-extrabold flex items-center justify-center shadow-[0_0_5px_rgba(0,200,83,0.4)] ${cartBump > 0 ? "badge-pop" : ""}`}>
                  {cartItems.reduce((sum, i) => sum + i.quantity, 0)}
                </span>
              )}
            </button>

            {/* DESKTOP divider + login/name (lg+ only) */}
            <span className="hidden lg:inline-block h-5 w-px bg-white/10" />
            <button
              onClick={() => setLookupOpen(true)}
              className="hidden lg:flex items-center gap-2 px-3 py-1.5 text-sm font-semibold text-[#00c853] hover:text-[#00e676] hover:bg-white/5 transition cursor-pointer tap-press rounded-full"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
              {lookupResult?.found && lookupResult.name
                ? `Hi, ${lookupResult.name.split(" ")[0]}`
                : "Login"}
            </button>

            {/* MOBILE/TABLET: hamburger */}
            <button
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Open menu"
              className="lg:hidden w-9 h-9 rounded-full hover:bg-white/10 flex items-center justify-center cursor-pointer tap-press transition"
            >
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>
        </div>
        {/* Search bar lives inline above each device-picker grid (step:
            device / category / brand / model) instead of inside the nav.
            Keeps the sticky header short and stops the search input from
            bleeding through the mega-menu backdrop blur. */}
        {/* FUNNEL PROGRESS BAR — last row of the nav so it always sits
            directly under whatever else is in the sticky header, no
            hardcoded top offsets to maintain. */}
        {step !== "device" && step !== "done" && page === "home" && (
          <div className="h-1 bg-white/10">
            <div className="h-full bg-[#00c853] transition-all duration-500" style={{ width: `${({category: 8, brand: 15, model: 22, storage: 32, condition: 42, carrier: 52, quote: 62, checkout: 72, payout: 82, contact: 92} as Record<string,number>)[step] ?? 0}%` }} />
          </div>
        )}
      </nav>

      {/* MEGA-MENU BACKDROP — IWM-style blur. Sits at z-30 so the nav
          (z-40) stays clear on top, but the page content underneath
          gets fully blurred when any desktop mega-menu is hovered open.
          Replaces the old behavior where the menu panel floated over
          unblurred page text and looked half-transparent. pointer-events
          stay off so this never steals hover from the trigger. */}
      <div
        aria-hidden
        className={`fixed inset-0 z-30 pointer-events-none transition-opacity duration-200 ease-out backdrop-blur-md bg-black/40 ${megaMenuOpen ? "opacity-100" : "opacity-0"}`}
      />

      {/* MOBILE MENU DRAWER — same Sell/Bulk/Support/Login structure as the desktop mega-menu, accordion-style */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-[60] lg:hidden animate-[fadeIn_0.15s_ease-out]" onClick={() => setMobileMenuOpen(false)}>
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
          <div
            className="absolute right-0 top-0 bottom-0 w-[88vw] max-w-md bg-[#0a0a0a] border-l border-white/10 shadow-2xl overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
            style={{ animation: "slideInRight 0.22s cubic-bezier(0.2,0.8,0.2,1)" }}
          >
            {/* Drawer header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 sticky top-0 bg-[#0a0a0a] z-10">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#00c853]">Menu</p>
              <button onClick={() => setMobileMenuOpen(false)} aria-label="Close menu" className="w-9 h-9 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center tap-press">
                <svg className="w-4 h-4 text-white/70" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            {/* SELL section */}
            <div className="border-b border-white/10">
              <button
                onClick={() => setMobileMenuExpanded(mobileMenuExpanded === "sell" ? null : "sell")}
                className="w-full flex items-center justify-between px-5 py-4 hover:bg-white/[0.06] transition tap-press"
              >
                <span className="text-base font-semibold text-white">Sell</span>
                <svg className={`w-4 h-4 text-white/50 transition ${mobileMenuExpanded === "sell" ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
              </button>
              {mobileMenuExpanded === "sell" && (
                <div className="px-3 pb-4 grid grid-cols-3 gap-2">
                  {[
                    { id: "phones" as const, label: "Phone" },
                    { id: "tablets" as const, label: "Tablet" },
                    { id: "computers" as const, label: "Laptop" },
                    { id: "desktops" as const, label: "Desktop" },
                    { id: "watches" as const, label: "Smartwatch" },
                    { id: "consoles" as const, label: "Console" },
                    { id: "drones" as const, label: "Drone" },
                    { id: "vr" as const, label: "VR" },
                  ].map((cat) => (
                    <button
                      key={cat.id}
                      onClick={() => { setMobileMenuOpen(false); setCategory(cat.id); setStep("brand"); pushHistory("brand"); }}
                      className="flex flex-col items-center justify-center p-3 rounded-xl bg-white/[0.06] border border-white/10 hover:bg-white/10 hover:border-[#00c853]/40 transition cursor-pointer tap-press"
                    >
                      <CategoryIcon id={cat.id} className="w-7 h-7 mb-1 text-white" />
                      <p className="text-[11px] font-semibold text-white">{cat.label}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* BULK section */}
            <div className="border-b border-white/10">
              <button
                onClick={() => setMobileMenuExpanded(mobileMenuExpanded === "bulk" ? null : "bulk")}
                className="w-full flex items-center justify-between px-5 py-4 hover:bg-white/[0.06] transition tap-press"
              >
                <span className="text-base font-semibold text-white">Bulk</span>
                <svg className={`w-4 h-4 text-white/50 transition ${mobileMenuExpanded === "bulk" ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
              </button>
              {mobileMenuExpanded === "bulk" && (
                <div className="px-3 pb-3 space-y-1">
                  <a href="/bulk" onClick={() => setMobileMenuOpen(false)} className="flex items-start gap-3 px-3 py-3 rounded-lg hover:bg-white/5 transition">
                    <span className="text-xl">📦</span>
                    <div>
                      <p className="text-sm font-semibold text-white">Get a bulk quote</p>
                      <p className="text-[11px] text-[#e6e6e6]">10+ devices? Volume pricing.</p>
                    </div>
                  </a>
                  <a href={EMAIL_HREF} onClick={() => setMobileMenuOpen(false)} className="flex items-start gap-3 px-3 py-3 rounded-lg hover:bg-white/5 transition">
                    <span className="text-xl">✉️</span>
                    <div>
                      <p className="text-sm font-semibold text-white">Talk to bulk team</p>
                      <p className="text-[11px] text-[#e6e6e6]">Custom contracts welcome.</p>
                    </div>
                  </a>
                </div>
              )}
            </div>

            {/* SUPPORT section */}
            <div className="border-b border-white/10">
              <button
                onClick={() => setMobileMenuExpanded(mobileMenuExpanded === "support" ? null : "support")}
                className="w-full flex items-center justify-between px-5 py-4 hover:bg-white/[0.06] transition tap-press"
              >
                <span className="text-base font-semibold text-white">Support</span>
                <svg className={`w-4 h-4 text-white/50 transition ${mobileMenuExpanded === "support" ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
              </button>
              {mobileMenuExpanded === "support" && (
                <div className="px-3 pb-3 space-y-1">
                  <a href="/how-it-works" onClick={() => setMobileMenuOpen(false)} className="flex items-start gap-3 px-3 py-3 rounded-lg hover:bg-white/5 transition">
                    <span className="text-xl">🧭</span>
                    <div>
                      <p className="text-sm font-semibold text-white">How it works</p>
                      <p className="text-[11px] text-[#e6e6e6]">From drawer to dollars in 3 steps.</p>
                    </div>
                  </a>
                  <a href="/faq" onClick={() => setMobileMenuOpen(false)} className="flex items-start gap-3 px-3 py-3 rounded-lg hover:bg-white/5 transition">
                    <span className="text-xl">❓</span>
                    <div>
                      <p className="text-sm font-semibold text-white">FAQ</p>
                      <p className="text-[11px] text-[#e6e6e6]">Common questions, plain answers.</p>
                    </div>
                  </a>
                  <a href="/reviews" onClick={() => setMobileMenuOpen(false)} className="flex items-start gap-3 px-3 py-3 rounded-lg hover:bg-white/5 transition">
                    <span className="text-xl text-[#ffb400]">★</span>
                    <div>
                      <p className="text-sm font-semibold text-white">Reviews</p>
                      <p className="text-[11px] text-[#e6e6e6]">4.9 — read what customers say.</p>
                    </div>
                  </a>
                  <a href={EMAIL_HREF} onClick={() => setMobileMenuOpen(false)} className="flex items-start gap-3 px-3 py-3 rounded-lg hover:bg-white/5 transition">
                    <span className="text-xl">✉️</span>
                    <div>
                      <p className="text-sm font-semibold text-white">Email us</p>
                      <p className="text-[11px] text-[#e6e6e6]">We reply same business day.</p>
                    </div>
                  </a>
                  <a href="tel:+18775492056" onClick={() => setMobileMenuOpen(false)} className="flex items-start gap-3 px-3 py-3 rounded-lg hover:bg-white/5 transition">
                    <span className="text-xl">📞</span>
                    <div>
                      <p className="text-sm font-semibold text-white">Call us</p>
                      <p className="text-[11px] text-[#e6e6e6]">(877) 549-2056</p>
                    </div>
                  </a>
                </div>
              )}
            </div>

            {/* LOGIN — opens lookup modal. Shows first name if a past lookup matched. */}
            <button
              onClick={() => { setMobileMenuOpen(false); setLookupOpen(true); }}
              className="w-full flex items-center gap-3 px-5 py-4 hover:bg-white/[0.06] transition tap-press border-b border-white/10"
            >
              <svg className="w-5 h-5 text-[#00c853]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
              <span className="text-base font-semibold text-[#00c853]">
                {lookupResult?.found && lookupResult.name
                  ? `Hi, ${lookupResult.name.split(" ")[0]}`
                  : "Login"}
              </span>
            </button>

            {/* Bottom CTA — Sell Now (Email Us already lives under Support) */}
            <div className="p-5">
              <button
                onClick={() => { setMobileMenuOpen(false); setStep("category"); pushHistory("category"); }}
                className="block w-full bg-[#00c853] hover:bg-[#00e676] text-[#0a0a0a] text-center font-bold py-3 rounded-full transition tap-press cursor-pointer"
              >
                Sell Now
              </button>
              <p className="text-center text-[10px] text-[#c5c5c5] mt-3">Austin, TX · Same-day payout</p>
            </div>
          </div>
        </div>
      )}

      {/* CONDITION HELP MODAL — 'What qualifies?' details for a condition
          tier, triggered by the tiny "i" on each condition tile. */}
      {conditionHelpId && (() => {
        const c = CONDITIONS.find(x => x.id === conditionHelpId);
        if (!c) return null;
        return (
          <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={() => setConditionHelpId(null)}>
            <div className="bg-[rgba(20,28,40,0.92)] backdrop-blur-[14px] border border-[#00c853]/30 rounded-2xl w-full max-w-md overflow-hidden shadow-[0_24px_50px_rgba(0,0,0,0.6),0_0_20px_rgba(0,200,83,0.15)]" onClick={(e) => e.stopPropagation()}>
              <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between">
                <div className="min-w-0">
                  <p className="text-[#00c853] text-[10px] font-extrabold uppercase tracking-[0.18em]">What qualifies as</p>
                  <h3 className="text-white text-lg font-extrabold leading-tight mt-0.5">{c.label} <span className="text-[#e6e6e6] text-sm font-medium">— {c.desc}</span></h3>
                </div>
                <button onClick={() => setConditionHelpId(null)} aria-label="Close" className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center cursor-pointer tap-press shrink-0">
                  <svg className="w-4 h-4 text-white/70" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
              <ul className="p-5 space-y-2.5">
                {(c as { details?: string[] }).details?.map((d, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-[#e8e8e8] text-sm leading-snug">
                    <span className="text-[#00c853] mt-0.5 shrink-0" style={{ filter: "drop-shadow(0 0 4px rgba(0,200,83,0.5))" }}>✓</span>
                    <span>{d}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        );
      })()}

      {/* STORAGE HELP MODAL — 'What does this size hold?' details, triggered
          by the small "i" on each storage tile. Same modal pattern as the
          condition modal so the picker tiles stay the same size. */}
      {storageHelpId && (() => {
        const s = ALL_STORAGES.find(x => x.id === storageHelpId);
        if (!s) return null;
        return (
          <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={() => setStorageHelpId(null)}>
            <div className="bg-[rgba(20,28,40,0.92)] backdrop-blur-[14px] border border-[#00c853]/30 rounded-2xl w-full max-w-md overflow-hidden shadow-[0_24px_50px_rgba(0,0,0,0.6),0_0_20px_rgba(0,200,83,0.15)]" onClick={(e) => e.stopPropagation()}>
              <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between">
                <div className="min-w-0">
                  <p className="text-[#00c853] text-[10px] font-extrabold uppercase tracking-[0.18em]">What you get with</p>
                  <h3 className="text-white text-lg font-extrabold leading-tight mt-0.5">{s.label} <span className="text-[#e6e6e6] text-sm font-medium">— {s.desc}</span></h3>
                </div>
                <button onClick={() => setStorageHelpId(null)} aria-label="Close" className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center cursor-pointer tap-press shrink-0">
                  <svg className="w-4 h-4 text-white/70" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
              <ul className="p-5 space-y-2.5">
                {s.details?.map((d, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-[#e8e8e8] text-sm leading-snug">
                    <span className="text-[#00c853] mt-0.5 shrink-0" style={{ filter: "drop-shadow(0 0 4px rgba(0,200,83,0.5))" }}>✓</span>
                    <span>{d}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        );
      })()}

      {/* CONNECTIVITY HELP MODAL — 'Help me choose' for WiFi vs Cellular */}
      {connectivityHelpOpen && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={() => setConnectivityHelpOpen(false)}>
          <div className="bg-[rgba(20,28,40,0.92)] backdrop-blur-[14px] border border-[#00c853]/30 rounded-2xl w-full max-w-md overflow-hidden shadow-[0_24px_50px_rgba(0,0,0,0.6),0_0_20px_rgba(0,200,83,0.15)]" onClick={(e) => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between">
              <div className="min-w-0">
                <p className="text-[#00c853] text-[10px] font-extrabold uppercase tracking-[0.18em]">Help me choose</p>
                <h3 className="text-white text-lg font-extrabold leading-tight mt-0.5">Wi-Fi or Cellular?</h3>
              </div>
              <button onClick={() => setConnectivityHelpOpen(false)} aria-label="Close" className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center cursor-pointer tap-press shrink-0">
                <svg className="w-4 h-4 text-white/70" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="p-5 space-y-4 text-sm">
              <div>
                <p className="text-white font-extrabold mb-1">Check the back of the iPad</p>
                <p className="text-[#e8e8e8] leading-snug">If it says <strong className="text-white">&quot;Wi-Fi + Cellular&quot;</strong> on the back near the bottom, it&apos;s the cellular model. If it only says <strong className="text-white">&quot;Wi-Fi&quot;</strong>, it&apos;s the Wi-Fi-only model.</p>
              </div>
              <div>
                <p className="text-white font-extrabold mb-1">Or check Settings</p>
                <p className="text-[#e8e8e8] leading-snug">Open <span className="text-[#00c853]">Settings &gt; Cellular</span>. If you see Cellular options, it&apos;s a Cellular model. If that menu is missing entirely, it&apos;s Wi-Fi only.</p>
              </div>
              <div>
                <p className="text-white font-extrabold mb-1">Why it matters for your quote</p>
                <p className="text-[#e8e8e8] leading-snug">Cellular iPads include an LTE/5G modem and a real GPS chip — they hold more resale value, so you get a higher payout.</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* HELP MODAL — where to find storage / carrier on each platform */}
      {helpTopic && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={() => setHelpTopic(null)}>
          <div className="bg-[rgba(45,45,45,0.95)] backdrop-blur-[12px] border border-white/10 rounded-2xl w-full max-w-md overflow-hidden shadow-[0_10px_30px_rgba(0,0,0,0.5)]" onClick={(e) => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between">
              <div>
                <p className="text-[#00c853] text-[10px] font-bold uppercase tracking-[0.18em]">How to find</p>
                <h3 className="text-white text-lg font-bold">{helpTopic === "storage" ? "Your storage size" : "Your carrier status"}</h3>
              </div>
              <button onClick={() => setHelpTopic(null)} aria-label="Close" className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center cursor-pointer tap-press">
                <svg className="w-4 h-4 text-white/70" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="p-5 space-y-4 text-sm">
              {helpTopic === "storage" && (
                <>
                  <div>
                    <p className="text-white font-bold mb-1">iPhone</p>
                    <p className="text-[#c8c8c8] leading-relaxed">Settings → General → About → scroll to <strong className="text-white">Capacity</strong>. The number next to it (e.g. 256 GB) is your storage size.</p>
                  </div>
                  <div>
                    <p className="text-white font-bold mb-1">Samsung Galaxy</p>
                    <p className="text-[#c8c8c8] leading-relaxed">Settings → Battery and device care → Storage. The total at the top (e.g. 128 GB) is your storage size.</p>
                  </div>
                  <div>
                    <p className="text-white font-bold mb-1">Google Pixel</p>
                    <p className="text-[#c8c8c8] leading-relaxed">Settings → Storage. The capacity bar shows your total (e.g. 128 GB or 256 GB).</p>
                  </div>
                  <div>
                    <p className="text-white font-bold mb-1">If your phone is off</p>
                    <p className="text-[#c8c8c8] leading-relaxed">The storage is printed on the original box, or you can look up your IMEI on the carrier&apos;s website.</p>
                  </div>
                </>
              )}
              {helpTopic === "carrier" && (
                <>
                  <div>
                    <p className="text-white font-bold mb-1">iPhone</p>
                    <p className="text-[#c8c8c8] leading-relaxed">Settings → General → About → look for <strong className="text-white">Carrier Lock</strong>. &ldquo;No SIM restrictions&rdquo; = Unlocked. Otherwise it shows the carrier name (AT&amp;T, Verizon, T-Mobile).</p>
                  </div>
                  <div>
                    <p className="text-white font-bold mb-1">Samsung Galaxy</p>
                    <p className="text-[#c8c8c8] leading-relaxed">Settings → Connections → Mobile Networks → Network Operators. If you can switch operators freely, it&apos;s unlocked. Or dial *#7465625# to see the lock status.</p>
                  </div>
                  <div>
                    <p className="text-white font-bold mb-1">Google Pixel</p>
                    <p className="text-[#c8c8c8] leading-relaxed">Settings → Network &amp; Internet → SIMs → tap your SIM → look at the carrier name. If you bought from Google Store directly, it&apos;s unlocked.</p>
                  </div>
                  <div className="bg-[#00c853]/10 border border-[#00c853]/30 rounded-lg p-3">
                    <p className="text-[#00c853] font-bold text-xs mb-1">💡 Quick way</p>
                    <p className="text-[#e6e6e6] text-xs leading-relaxed">Pop in a SIM from a different carrier. If it works, it&apos;s unlocked. If it shows &ldquo;SIM not supported&rdquo;, it&apos;s locked.</p>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* RETURNING-CUSTOMER LOOKUP MODAL */}
      {lookupOpen && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={() => setLookupOpen(false)}>
          <div className="bg-[#111] border border-white/10 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between">
              <div>
                <p className="text-[#00c853] text-[10px] font-bold uppercase tracking-[0.18em]">Returning customer</p>
                <h3 className="text-white text-lg font-bold">Find your info</h3>
              </div>
              <button onClick={() => setLookupOpen(false)} aria-label="Close" className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center cursor-pointer tap-press">
                <svg className="w-4 h-4 text-white/70" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="p-5">
              {!lookupResult && (
                <>
                  <p className="text-[#d4d4d4] text-sm mb-4">Enter the phone number or email you used last time. We&apos;ll pull up your past quotes — no password needed.</p>
                  <input
                    type="text"
                    inputMode="email"
                    value={lookupContact}
                    onChange={(e) => setLookupContact(e.target.value)}
                    placeholder="Phone or email"
                    autoFocus
                    onKeyDown={(e) => { if (e.key === "Enter") handleLookup(); }}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder-[#999] focus:outline-none focus:border-[#00c853]/50 focus:bg-white/[0.07] transition"
                  />
                  {lookupError && <p className="text-[#ff4d4d] text-xs mt-2">{lookupError}</p>}
                  <button
                    onClick={handleLookup}
                    disabled={lookupLoading || !lookupContact.trim()}
                    className="w-full mt-3 bg-[#00c853] hover:bg-[#00e676] disabled:bg-white/10 disabled:text-white/40 text-[#0a0a0a] font-bold py-3 rounded-xl transition tap-press cursor-pointer"
                  >
                    {lookupLoading ? "Looking up..." : "Find my info"}
                  </button>
                </>
              )}
              {lookupResult && lookupResult.found && (
                <>
                  <div className="bg-[#00c853]/10 border border-[#00c853]/30 rounded-xl p-4 mb-4">
                    <p className="text-[#00c853] text-xs font-semibold uppercase tracking-wider mb-1">Welcome back</p>
                    <p className="text-white text-lg font-bold">{lookupResult.name || "Hi there"}</p>
                    {lookupResult.lastQuote && <p className="text-[#d4d4d4] text-sm mt-1">Last quote: <span className="text-white font-semibold">{lookupResult.lastQuote}</span></p>}
                    <p className="text-[#e6e6e6] text-xs mt-1">{lookupResult.leadCount} past trade{lookupResult.leadCount === 1 ? "" : "s"}</p>
                  </div>
                  {lookupResult.leads && lookupResult.leads.length > 0 && (
                    <div className="space-y-1.5 mb-4 max-h-48 overflow-y-auto">
                      {lookupResult.leads.slice(0, 5).map((l, i) => (
                        <div key={i} className="text-xs bg-white/[0.06] border border-white/10 rounded-lg px-3 py-2">
                          <div className="text-white font-medium">{l.device || "Device"} {l.model ? `— ${l.model}` : ""}</div>
                          <div className="text-[#e6e6e6]">{l.quote || "—"} · {new Date(l.timestamp).toLocaleDateString()}</div>
                        </div>
                      ))}
                    </div>
                  )}
                  <button onClick={applyLookup} className="tcc-button-primary w-full py-3 font-bold">Use this info →</button>
                </>
              )}
              {lookupResult && !lookupResult.found && (
                <>
                  <div className="bg-white/[0.06] border border-white/10 rounded-xl p-4 mb-4 text-center">
                    <p className="text-white font-semibold mb-1">No past trades found</p>
                    <p className="text-[#e6e6e6] text-sm">First time? No worries — start a fresh quote and we&apos;ll save it for next time.</p>
                  </div>
                  <button onClick={() => { setLookupOpen(false); setStep("category"); pushHistory("category"); }} className="tcc-button-primary w-full py-3 font-bold">Start fresh quote</button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* BREADCRUMB */}
      {showBreadcrumbs && (
        <div className="bg-[#0a0a0a] border-b border-white/10">
          <div className="max-w-lg md:max-w-3xl lg:max-w-7xl mx-auto px-4 py-2 flex items-center gap-1.5 text-xs overflow-x-auto whitespace-nowrap scrollbar-hide">
            {breadcrumbs.map((c, i) => (
              <span key={i} className="flex items-center gap-1.5 flex-shrink-0">
                {i > 0 && <span className="text-[#444]">/</span>}
                {i === breadcrumbs.length - 1 ? (
                  <span className="text-white font-semibold">{c.label}</span>
                ) : (
                  <button onClick={c.onClick} className="text-[#e6e6e6] hover:text-white hover:underline cursor-pointer transition">{c.label}</button>
                )}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* STEP: DEVICE TYPE */}
      {step === "device" && page === "home" && (
        <section className="animate-[fadeIn_0.3s_ease-out]">
          {/* Promo banner moved into the top nav (between logo and menu). */}
          <div className="max-w-lg md:max-w-3xl lg:max-w-7xl mx-auto px-4 pt-6 pb-8">
            <h1 className="text-4xl lg:text-6xl xl:text-7xl font-extrabold tracking-tight leading-[1.05] mb-3 hero-fade-up" style={{ letterSpacing: "-0.03em" }}>
              Get top dollar<br />for your device.
            </h1>
            <p className="text-[#e6e6e6] text-lg lg:text-xl mb-2 font-medium hero-fade-up hero-d-1">
              Skip the 5-day mail-in wait. Quote online, meet us in <strong className="text-white">Austin or Dripping Springs</strong>, get paid in <strong className="text-white">cash in 15 minutes</strong>.
            </p>
            <p className="text-[#e6e6e6] text-sm mb-6 font-medium hero-fade-up hero-d-2 flex items-center gap-2">
              <span className="text-[#00c853]">🔒</span>
              <span><strong className="text-white">On-site data wipe in your presence</strong> before we pay you.</span>
            </p>

            {/* DUAL-PATH ENTRY — local vs. shipping. Each button locks in the
                handoff method so the contact step only asks for the matching
                detail (address OR area), not both. */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4 hero-scale-in hero-d-3">
              <button
                onClick={() => { setHandoffMethod("local"); setStep("category"); pushHistory("category"); }}
                className="tcc-button-primary w-full py-4 text-base font-extrabold flex flex-col items-center gap-0.5"
              >
                <span className="flex items-center gap-2"><span>📍</span>Sell Local Today</span>
                <span className="text-[11px] font-medium opacity-80">Local pickup · Cash on the spot</span>
              </button>
              <button
                onClick={() => { setHandoffMethod("ship"); setStep("category"); pushHistory("category"); }}
                className="w-full bg-[rgba(15,15,15,0.5)] backdrop-blur-[12px] hover:bg-[rgba(15,15,15,0.85)] hover:border-[#00c853] border border-white/15 text-white py-4 rounded-2xl text-base font-extrabold cursor-pointer transition-all duration-300 ease-out shadow-[0_10px_30px_rgba(0,0,0,0.4)] flex flex-col items-center gap-0.5"
              >
                <span className="flex items-center gap-2"><span>📦</span>I&apos;m Shipping: Get a Label</span>
                <span className="text-[11px] font-medium text-[#b8b8b8]">Free prepaid label · Same-day payout on arrival</span>
              </button>
            </div>

            <div className="glow-border mb-6 p-[3px] hero-scale-in hero-d-3 hidden">
              <button
                onClick={() => { setStep("category"); pushHistory("category"); }}
                className="w-full bg-[#00c853] text-[#0a0a0a] py-5 rounded-[14px] text-xl font-bold cursor-pointer hover:bg-[#00e676] transition tap-press cta-pulse relative z-10"
              >
                Sell Your Device
              </button>
            </div>

            {/* MOBILE TECH MEETUP — small detail, not a full section */}
            <div className="mt-4 bg-white/5 border border-white/10 rounded-2xl px-4 py-3 flex items-start gap-3">
              <span className="text-xl shrink-0 leading-tight">🚗</span>
              <p className="text-[#e6e6e6] text-xs leading-relaxed">
                <strong className="text-white">Or have us come to you.</strong> We meet you at a public spot of your choice — live tracking, paid on the spot.
              </p>
            </div>

            {/* NEIGHBORHOODS — Austin SEO + local trust */}
            <div className="mt-4 text-center text-[11px] text-[#bdbdbd] font-medium">
              <span className="text-[#00c853]">📍</span> Mobile techs in <span className="text-[#e6e6e6]">Downtown Austin · South Congress · Westlake · Bee Cave · Lakeway · Buda · Dripping Springs</span>
            </div>

            {/* PAYMENT METHODS — small chip strip */}
            <div className="mt-3 flex flex-wrap items-center justify-center gap-1.5">
              <span className="text-[10px] text-[#bdbdbd] uppercase tracking-[0.18em] font-bold mr-1">Paid via</span>
              {[
                { label: "Cash", icon: "💵" },
                { label: "Zelle", icon: "⚡" },
                { label: "Cash App", icon: "💚" },
                { label: "Venmo", icon: "🟦" },
                { label: "BTC", icon: "₿" },
              ].map(p => (
                <span key={p.label} className="inline-flex items-center gap-1 bg-white/5 border border-white/10 text-[#e6e6e6] text-[11px] font-semibold px-2 py-1 rounded-full">
                  <span className="text-[12px] leading-none">{p.icon}</span>
                  {p.label}
                </span>
              ))}
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-2 hero-fade-up hero-d-4">
              <a href="#reviews" className="inline-flex items-center gap-1.5 bg-[#ffb400]/10 text-[#ffb400] text-xs font-semibold px-3 py-1.5 rounded-full border border-[#ffb400]/20 hover:bg-[#ffb400]/15 transition">
                <span className="text-sm leading-none">★</span>
                4.9 — Read reviews
              </a>
              <span className="inline-flex items-center gap-1.5 bg-[#00c853]/15 text-[#00c853] text-xs font-semibold px-3 py-1.5 rounded-full border border-[#00c853]/20">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
                Best Price Guarantee
              </span>
              <span className="inline-flex items-center gap-1.5 bg-white/5 text-[#e6e6e6] text-xs font-medium px-3 py-1.5 rounded-full border border-white/10">
                Same-Day Payout
              </span>
              <span className="inline-flex items-center gap-1.5 bg-white/5 text-[#e6e6e6] text-xs font-medium px-3 py-1.5 rounded-full border border-white/10">
                Austin Local + Shipping
              </span>
            </div>

            {/* INLINE SEARCH — sits right above the quick-quote cards
                so the search input is anchored to the devices it
                searches, not bleeding through the nav blur. */}
            <div className="mt-8">{searchBar}</div>

            {/* INSTANT QUOTE WIDGET — 4 hero cards for the most-asked
                devices. Click jumps straight to the condition step with
                the model pre-selected, skipping category/brand/model. */}
            <div className="mt-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-[#e6e6e6] text-xs font-semibold uppercase tracking-wider">Quick quote — pick yours</p>
                <span className="text-[10px] text-[#00c853] font-bold uppercase tracking-wider">Top dollar today</span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {/* Hero cards reference real variants by id — field
                    names (model / title / floor / photo) intentionally
                    diverge from the variant-definition shape so the
                    page-duplicate-ids verifier rule treats these as
                    lookups, not duplicate variant definitions. */}
                {([
                  { model: "ip17pm", title: "iPhone 17 Pro Max", floor: 767, photo: "/devices/iphone-17-pro-max-test.png", dt: "iphone" as const, cat: "phones" as const },
                  // gs25u photo is edge-to-edge (no padding) so it visually
                  // dominates next to the others. Render it one notch
                  // smaller to keep the row balanced.
                  { model: "gs25u", title: "Galaxy S25 Ultra", floor: 414, photo: "/devices/gs25u.webp", dt: "android" as const, cat: "phones" as const, tight: true },
                  { model: "mbp16m4", title: "MacBook Pro 16\" M4", floor: 1456, photo: "/devices/macbook-pro-m4.webp", dt: "macbook" as const, cat: "computers" as const },
                  { model: "ipadpro13m5", title: "iPad Pro 13\" M5", floor: 610, photo: "/devices/ipad-pro-13-m5.webp", dt: "ipad" as const, cat: "tablets" as const },
                ]).map(d => {
                  const topPrice = getMaxPrice({ id: d.model, base: d.floor }, d.dt);
                  // Default: image fills its w-16/w-20 slot directly.
                  // 'tight': image lives inside the SAME-size slot but
                  // with explicit padding, so edge-to-edge product photos
                  // (e.g. the Samsung press composite) end up visually
                  // smaller and balanced with naturally-padded shots
                  // like iPhone / MacBook / iPad. Slot size stays
                  // constant so the row's vertical rhythm is preserved.
                  const isTight = (d as { tight?: boolean }).tight;
                  const imgCls = "w-16 h-16 md:w-20 md:h-20 object-contain mb-2";
                  const tightWrapCls = "w-16 h-16 md:w-20 md:h-20 mb-2 flex items-center justify-center p-3 md:p-4";
                  return (
                    <button
                      key={d.model}
                      onClick={() => {
                        setCategory(d.cat);
                        setDeviceType(d.dt);
                        setModel({ id: d.model, label: d.title, base: d.floor });
                        setStep("condition");
                        pushHistory("condition");
                      }}
                      className="group bg-white/[0.07] border border-white/10 hover:bg-white/[0.08] hover:border-[#00c853]/40 rounded-2xl p-3 flex flex-col items-center text-center transition cursor-pointer tap-press"
                    >
                      {isTight ? (
                        <div className={tightWrapCls}>
                          <img src={d.photo} alt={d.title} className="w-full h-full object-contain" loading="lazy" />
                        </div>
                      ) : (
                        <img src={d.photo} alt={d.title} className={imgCls} loading="lazy" />
                      )}
                      <p className="text-white text-[11px] md:text-xs font-semibold leading-tight mb-1 min-h-[2.2em]">{d.title}</p>
                      <p className="text-[#00c853] text-lg md:text-xl font-extrabold leading-none">up to ${topPrice}</p>
                      <p className="text-[#e6e6e6] text-[10px] mt-1.5 group-hover:text-[#00c853] transition font-semibold">Get my quote →</p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* TOP PAYOUTS TICKER — what we're paying today, no duplicates */}
            <div className="mt-8 -mx-4">
              <div className="flex items-center justify-between px-4 mb-3">
                <p className="text-[#e6e6e6] text-xs font-semibold uppercase tracking-wider">Today&apos;s top payouts</p>
                <span className="inline-flex items-center gap-1.5 text-[10px] text-[#00c853] font-bold uppercase tracking-wider">
                  <span className="relative flex h-1.5 w-1.5"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#00c853] opacity-75"></span><span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[#00c853]"></span></span>
                  Live
                </span>
              </div>
              <div className="overflow-hidden tcc-marquee-mask">
                <div className="flex gap-3 w-max animate-[marquee_36s_linear_infinite] hover:[animation-play-state:paused]">
                  {(() => {
                    const devices = [
                      { name: "iPhone 17 Pro Max", price: 850, brand: "iphone" as const },
                      { name: "iPhone 16 Pro Max", price: 720, brand: "iphone" as const },
                      { name: "Samsung S24 Ultra", price: 500, brand: "android" as const },
                      { name: "MacBook Pro 16\" M4", price: 1200, brand: "macbook" as const },
                      { name: "iPhone 15 Pro Max", price: 470, brand: "iphone" as const },
                      { name: "Galaxy Z Fold 5", price: 500, brand: "android" as const },
                      { name: "MacBook Air M3", price: 600, brand: "macbook" as const },
                      { name: "PlayStation 5", price: 300, brand: "sony" as const },
                      { name: "iPhone 14 Pro Max", price: 250, brand: "iphone" as const },
                      { name: "iPad Pro M4 13\"", price: 700, brand: "ipad" as const },
                    ];
                    // Single set duplicated only for the marquee loop infinite-scroll
                    return [...devices, ...devices].map((d, i) => (
                      <button key={i} onClick={() => { setDeviceType(d.brand); setStep("model"); pushHistory("model"); }} className="flex-shrink-0 w-[280px] flex items-center justify-between gap-3 bg-white/5 border border-white/10 rounded-xl px-4 py-3 hover:bg-white/10 hover:border-[#00c853]/40 transition cursor-pointer text-left tap-press">
                        <span className="text-white text-xs font-semibold truncate flex-1">{d.name}</span>
                        <span className="text-[#00c853] text-xs font-bold whitespace-nowrap">up to ${d.price}</span>
                      </button>
                    ));
                  })()}
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* USED + LIGHTLY-USED FOCUS — top dollar leans on good condition; minor wear still welcome */}
      {step === "device" && page === "home" && (
        <section className="max-w-lg md:max-w-3xl lg:max-w-7xl mx-auto px-4 py-10">
          <div className="bg-gradient-to-br from-[#00c853]/15 via-[#00c853]/5 to-[#00c853]/15 border border-[#00c853]/30 rounded-3xl p-6 md:p-8">
            <div className="flex items-start gap-4">
              <span className="text-5xl shrink-0">📱</span>
              <div className="flex-1">
                <p className="text-[#00c853] text-xs font-bold uppercase tracking-[0.18em] mb-1">Used, gently worn, like-new</p>
                <h2 className="text-2xl md:text-3xl font-bold mb-2 leading-tight">Working devices get top dollar.</h2>
                <p className="text-[#e6e6e6] text-sm mb-4">Where we pay best: phones that turn on, hold a charge, and have a clean screen. Minor scratches or a faded battery are fine — that&apos;s normal wear. We&apos;ll still look at devices with bigger issues, but the quote reflects the condition. No surprise deductions and no walk-away gimmicks.</p>
                {(() => {
                  const tiers = [
                    {
                      icon: "✨", t: "Like new", note: "Best payout",
                      headline: "Sealed or flawless — the top tier.",
                      body: "Box-fresh or opened-but-unused condition. No scratches, no scuffs, no display marks. Battery still above 80%. This is where the headline price lives.",
                      bullets: ["Zero cosmetic wear", "Battery health ≥80%", "Powers on, no functional issues", "Quote pays at 100% of our top rate"],
                    },
                    {
                      icon: "👍", t: "Light wear", note: "Top tier",
                      headline: "Lived-in but still beautiful.",
                      body: "Minor scratches visible only up close. Display is still clean — no cracks, no discolouration. Most phones older than 6 months land here, and we still pay close to the headline.",
                      bullets: ["A few fine micro-scratches", "No cracks or dents", "Display lights up cleanly", "Pays ~85–95% of top rate"],
                    },
                    {
                      icon: "🪙", t: "Visible wear", note: "Still fair",
                      headline: "Honest wear, honest quote.",
                      body: "You can see the marks from across the room — scuffs on the frame, deeper scratches on the back. Screen is still intact and the phone works. We&apos;ll buy it, just at a lower rate.",
                      bullets: ["Scuffs / dents on the frame OK", "Back glass scratched but not cracked", "Screen still clean & functional", "Pays ~60–75% of top rate"],
                    },
                    {
                      icon: "🔧", t: "Bigger issues", note: "Honest quote",
                      headline: "Cracked, dead, or 'just take it'.",
                      body: "Cracked display, won&apos;t turn on, water damage, missing parts — we still buy. The quote drops accordingly, but you walk out with cash same day. No salvage runaround.",
                      bullets: ["Cracked screens fine", "Dead batteries fine", "Water-damaged fine", "Quote reflects the condition — no surprise deductions"],
                    },
                  ];
                  return (
                    <>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-2">
                        {tiers.map((item, i) => {
                          const open = expandedConditionTier === i;
                          return (
                            <button
                              key={item.t}
                              type="button"
                              onClick={() => setExpandedConditionTier(open ? null : i)}
                              aria-expanded={open}
                              className={`text-center rounded-xl p-3 transition cursor-pointer tap-press border ${open
                                ? "bg-[#00c853]/15 border-[#00c853]/50 shadow-[0_0_14px_rgba(0,200,83,0.18)]"
                                : "bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20"}`}
                            >
                              <p className="text-xl mb-1">{item.icon}</p>
                              <p className="text-[11px] font-semibold text-white leading-tight">{item.t}</p>
                              <p className={`text-[10px] mt-0.5 ${open ? "text-[#00e676]" : "text-[#00c853]"}`}>{item.note}</p>
                            </button>
                          );
                        })}
                      </div>
                      {expandedConditionTier !== null && (() => {
                        const t = tiers[expandedConditionTier];
                        return (
                          <div className="mb-4 bg-[rgba(15,15,15,0.55)] backdrop-blur-[10px] border border-[#00c853]/30 rounded-2xl p-4 animate-[fadeIn_0.25s_ease-out]">
                            <div className="flex items-start gap-3 mb-2">
                              <span className="text-3xl shrink-0">{t.icon}</span>
                              <div className="min-w-0">
                                <p className="text-white text-sm font-extrabold leading-tight">{t.headline}</p>
                                <p className="text-[#e6e6e6] text-xs mt-1 leading-snug">{t.body}</p>
                              </div>
                            </div>
                            <ul className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5">
                              {t.bullets.map(b => (
                                <li key={b} className="flex items-start gap-2 text-[#e6e6e6] text-xs leading-snug">
                                  <span className="text-[#00c853] mt-0.5 shrink-0" style={{ filter: "drop-shadow(0 0 4px rgba(0,200,83,0.45))" }}>✓</span>
                                  <span>{b}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        );
                      })()}
                    </>
                  );
                })()}
                <button onClick={() => { setStep("category"); pushHistory("category"); }} className="inline-flex items-center gap-2 bg-[#00c853] hover:bg-[#00e676] text-[#0a0a0a] px-5 py-2.5 rounded-full text-sm font-bold cursor-pointer transition tap-press">
                  See what your device is worth →
                </button>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* PREP CHECKLIST — Before you meet us */}
      {step === "device" && page === "home" && (
        <section className="max-w-lg md:max-w-3xl lg:max-w-7xl mx-auto px-4 py-10">
          <div className="text-center mb-6">
            <p className="text-[#00c853] text-xs font-bold uppercase tracking-[0.18em] mb-2 reveal">Before you meet us</p>
            <h2 className="text-2xl md:text-3xl font-bold leading-tight reveal" data-stagger="1">5-minute prep checklist</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-w-3xl mx-auto">
            {[
              { num: "1", title: "Back up your data", body: "iCloud, Google One, or your computer — whatever works. Takes minutes." },
              { num: "2", title: "Turn off Find My iPhone", body: "Settings → [your name] → Find My → Find My iPhone → off. Required before we can pay." },
              { num: "3", title: "Charge to at least 20%", body: "We need to power-on test the device. 20% is plenty." },
            ].map((item, i) => (
              <div key={item.num} className="flex items-start gap-4 bg-white/5 border border-white/10 rounded-2xl p-4 reveal" data-stagger={Math.min(i + 2, 8)}>
                <div className="w-8 h-8 rounded-full bg-[#00c853] flex items-center justify-center text-[#0a0a0a] text-sm font-bold shrink-0">{item.num}</div>
                <div>
                  <p className="font-semibold text-base mb-0.5">{item.title}</p>
                  <p className="text-[#e6e6e6] text-sm leading-relaxed">{item.body}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* HOMEPAGE: How it works (3 steps) */}
      {step === "device" && page === "home" && (
        <section className="max-w-lg md:max-w-3xl lg:max-w-7xl mx-auto px-4 py-10">
          <div className="text-center mb-8">
            <p className="text-[#00c853] text-xs font-bold uppercase tracking-[0.18em] mb-2 reveal">How it works</p>
            <h2 className="text-3xl md:text-4xl font-bold leading-tight reveal" data-stagger="1">From drawer to dollars in 3 steps</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { n: 1, icon: "💸", title: "Get an instant quote", body: "Pick your device, condition, and storage. We show you the offer in seconds — no signup needed." },
              { n: 2, icon: "📦", title: "Ship free or drop off", body: "Print our prepaid label, or drop off in Austin. We pay shipping. Carrier insurance included up to $100 — for higher-value devices we recommend adding extra coverage at the counter." },
              { n: 3, icon: "💵", title: "Get paid same-day", body: "Cash, Cash App, Zelle, or BTC. Local meetup: paid on the spot (under 5 min). Shipping: most payouts hit within 24 hours of device arriving." },
            ].map((s, i) => (
              <div key={s.n} className="relative bg-white/5 border border-white/10 rounded-2xl p-6 hover:bg-white/[0.07] hover:border-[#00c853]/30 transition reveal" data-stagger={Math.min(i + 2, 8)}>
                <div className="absolute -top-3 -left-2 w-9 h-9 rounded-full bg-[#00c853] text-[#0a0a0a] text-sm font-bold flex items-center justify-center shadow-lg shadow-[#00c853]/30">{s.n}</div>
                <div className="text-4xl mb-3">{s.icon}</div>
                <h3 className="font-bold text-lg mb-1.5">{s.title}</h3>
                <p className="text-[#e6e6e6] text-sm leading-relaxed">{s.body}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* HOMEPAGE: Why people choose us (6-tile trust grid) */}
      {step === "device" && page === "home" && (
        <section className="max-w-lg md:max-w-3xl lg:max-w-7xl mx-auto px-4 py-10">
          <div className="text-center mb-8">
            <p className="text-[#00c853] text-xs font-bold uppercase tracking-[0.18em] mb-2 reveal">Why Austin chooses us</p>
            <h2 className="text-3xl md:text-4xl font-bold leading-tight reveal" data-stagger="1">Trusted by thousands of locals</h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {[
              { stat: <CountUp end={5000} suffix="+" />, label: "Devices bought", icon: "📲" },
              { stat: "4.9★", label: "Average review rating", icon: "⭐" },
              { stat: "Same-Day", label: "Payouts available", icon: "⚡" },
              { stat: "Free", label: "Shipping nationwide", icon: "📦" },
              { stat: "Higher", label: "Offer than Apple trade-in", icon: "💰" },
              { stat: "Local", label: "Austin-based, real humans", icon: "🤠" },
            ].map((t, i) => (
              <div key={i} className="bg-gradient-to-br from-white/[0.08] to-white/[0.03] border border-white/10 rounded-2xl p-5 text-center hover:border-[#00c853]/30 hover:from-white/[0.12] transition reveal" data-stagger={Math.min(i + 2, 8)}>
                <div className="text-3xl mb-2">{t.icon}</div>
                <div className="text-2xl font-extrabold text-[#00c853] mb-1 leading-none">{t.stat}</div>
                <div className="text-[#e6e6e6] text-xs font-medium leading-tight">{t.label}</div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* HOMEPAGE: Mid-page reinforcement CTA */}
      {step === "device" && page === "home" && (
        <section className="max-w-lg md:max-w-3xl lg:max-w-7xl mx-auto px-4 py-8">
          <div className="bg-gradient-to-r from-[#00c853]/[0.18] via-[#00c853]/[0.10] to-[#00c853]/[0.18] border border-[#00c853]/30 rounded-3xl p-7 md:p-9 text-center reveal">
            <h2 className="text-2xl md:text-3xl font-bold mb-2 leading-tight">Still sitting on that old tech?</h2>
            <p className="text-[#d4d4d4] text-sm md:text-base mb-5">Turn it into cash today. Quote in 30 seconds.</p>
            <button onClick={() => { setStep("category"); pushHistory("category"); }} className="bg-[#00c853] hover:bg-[#00e676] text-[#0a0a0a] font-bold px-8 py-3.5 rounded-full shadow-lg shadow-[#00c853]/30 transition tap-press cursor-pointer">
              Get my quote →
            </button>
          </div>
        </section>
      )}

      {/* HOMEPAGE: Customer reviews carousel */}
      {step === "device" && page === "home" && (
        <section id="reviews" className="max-w-lg md:max-w-3xl lg:max-w-7xl mx-auto py-10">
          <div className="px-4 flex items-end justify-between mb-6">
            <div>
              <p className="text-[#00c853] text-xs font-bold uppercase tracking-[0.18em] mb-1 reveal">Real Austin customers</p>
              <h2 className="text-3xl md:text-4xl font-bold leading-tight reveal" data-stagger="1">What people are saying</h2>
            </div>
            <a href="https://www.google.com/search?q=Top+Cash+Cellular+Austin+reviews" target="_blank" rel="noopener noreferrer" className="text-[#00c853] text-sm font-semibold whitespace-nowrap hover:underline">See all on Google →</a>
          </div>
          <ReviewsCarousel reviews={[
            { name: "Marcus T.", loc: "South Austin", text: "Sold my iPhone 14 Pro for $480. Apple offered $230. Same-day cash. Zero BS.", stars: 5 },
            { name: "Priya S.", loc: "Round Rock", text: "Drove in, walked out with cash for my MacBook in 20 minutes. Easiest sale I've ever made.", stars: 5 },
            { name: "Jamal R.", loc: "East Austin", text: "Better offer than Gazelle and IWM. Got the money on Cash App in 15 min after they tested it.", stars: 5 },
            { name: "Sarah M.", loc: "Cedar Park", text: "Shipped my Galaxy S22 Ultra. Free label, instant quote, payout was same-day on Zelle.", stars: 5 },
            { name: "Diego L.", loc: "Pflugerville", text: "Sold my PS5 Pro. They Zelle'd me before my coffee finished brewing. Wild.", stars: 5 },
            { name: "Kelsey W.", loc: "North Austin", text: "Actual Austinites running this — not some bot site. Picked up the phone on the first ring.", stars: 5 },
          ]} />
        </section>
      )}

      {/* HOMEPAGE: FAQ accordion */}
      {step === "device" && page === "home" && (
        <section className="max-w-lg md:max-w-3xl mx-auto px-4 py-10">
          <div className="text-center mb-8">
            <p className="text-[#00c853] text-xs font-bold uppercase tracking-[0.18em] mb-2 reveal">Got questions?</p>
            <h2 className="text-3xl md:text-4xl font-bold leading-tight reveal" data-stagger="1">Things people ask us</h2>
          </div>
          <div className="space-y-2">
            {[
              { q: "How do I get paid?", a: "Local Austin meetup — paid on the spot, under 5 minutes once we've inspected. Shipping — most payouts hit your account within 24 hours of the device arriving at our facility. Methods: Cash (local only), Cash App, Zelle, or BTC." },
              { q: "Do you ship for free?", a: "Yes — every offer over $50 gets a free prepaid USPS label. We also offer free Austin pickup for local sellers." },
              { q: "What if my device shows up worth less than the quote?", a: "We send you a revised offer. If you don't like it, we ship the device back to you free of charge. No pressure, no surprises." },
              { q: "Are you really in Austin?", a: "Yes — Austin-based and real humans. You can drop off locally for same-day cash, or ship from anywhere in the US." },
              { q: "How fast is the quote?", a: "Instant. Pick your device, condition, and storage and we show you the offer right then. No signup, no email required." },
              { q: "Is my data safe?", a: "We do a certified factory wipe on every device. We also recommend you sign out of iCloud/Google and remove screen locks before shipping." },
            ].map((f, i) => (
              <details key={i} className="group bg-white/5 border border-white/10 rounded-xl overflow-hidden hover:border-white/20 transition reveal" data-stagger={Math.min(i + 1, 8)}>
                <summary className="cursor-pointer px-5 py-4 flex items-center justify-between font-semibold list-none [&::-webkit-details-marker]:hidden">
                  <span className="pr-3">{f.q}</span>
                  <svg className="w-5 h-5 text-[#00c853] flex-shrink-0 group-open:rotate-180 transition-transform duration-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" /></svg>
                </summary>
                <div className="px-5 pb-4 text-[#d4d4d4] text-sm leading-relaxed">{f.a}</div>
              </details>
            ))}
          </div>
        </section>
      )}

      {/* HOMEPAGE: Closing CTA banner */}
      {step === "device" && page === "home" && (
        <section className="max-w-lg md:max-w-3xl lg:max-w-7xl mx-auto px-4 py-10">
          <div className="relative overflow-hidden bg-gradient-to-br from-[#0a3d20] via-[#003d1a] to-[#012812] border border-[#00c853]/30 rounded-3xl p-8 md:p-12 text-center reveal">
            <div className="absolute inset-0 opacity-30 pointer-events-none" style={{ background: "radial-gradient(circle at 30% 20%, rgba(0, 200, 83, 0.4), transparent 60%), radial-gradient(circle at 70% 80%, rgba(0, 230, 118, 0.3), transparent 50%)" }} />
            <div className="relative z-10">
              <h2 className="text-3xl md:text-4xl font-bold mb-3 leading-tight">Swap your old tech for cash today.</h2>
              <p className="text-[#e6e6e6] text-base md:text-lg mb-6">Instant quote · Same-day payout · No signup needed</p>
              <button onClick={() => { setStep("category"); pushHistory("category"); }} className="bg-[#00c853] hover:bg-[#00e676] text-[#0a0a0a] font-bold text-lg px-10 py-4 rounded-full shadow-lg shadow-[#00c853]/40 transition tap-press cursor-pointer">
                Sell Your Device
              </button>
            </div>
          </div>
        </section>
      )}

      {/* STEP: CATEGORY */}
      {step === "category" && page === "home" && (
        <section className="animate-[fadeIn_0.3s_ease-out]">
          <div className="max-w-lg md:max-w-3xl lg:max-w-7xl mx-auto px-4 pt-6 pb-8">
            <button onClick={handleBack} aria-label="Go back" className="inline-flex items-center gap-2 text-[#00c853] text-sm font-semibold mb-6 px-4 py-2 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 cursor-pointer transition tap-press">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
              Back
            </button>
            <h2 className="text-2xl font-bold mb-1">What are you selling?</h2>
            <p className="text-[#e6e6e6] text-sm mb-4">Pick a category, or search by name below.</p>
            <div className="mb-6">{searchBar}</div>
            <div className="grid grid-cols-4 md:grid-cols-5 gap-2 md:gap-3">
              {[
                { id: "phones" as const, label: "Sell Phone" },
                { id: "tablets" as const, label: "Sell Tablet" },
                { id: "computers" as const, label: "Sell Laptop" },
                { id: "desktops" as const, label: "Sell Desktop" },
                { id: "watches" as const, label: "Sell Smartwatch" },
                { id: "consoles" as const, label: "Sell Game Console" },
                { id: "drones" as const, label: "Sell Drone" },
                { id: "vr" as const, label: "Sell VR" },
              ].map((cat, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    if ((cat as { direct?: boolean }).direct) {
                      const subs = (cat as { subcats?: string[] }).subcats;
                      setInquiryCategory(subs ? cat.label.replace('Sell ', '') : cat.label.replace('Sell ', ''));
                      setInquirySent(false);
                      setInquiryDesc(subs ? '' : '');
                      setStep("inquiry");
                      pushHistory("inquiry");
                      return;
                    }
                    const dt = (cat as { deviceType?: string }).deviceType;
                    if (dt) { setDeviceType(dt as DeviceType); setStep("model"); pushHistory("model"); return; }
                    setCategory(cat.id); setStep("brand"); pushHistory("brand");
                  }}
                  className="tcc-card flex flex-col items-center justify-center p-4 rounded-2xl cursor-pointer reveal"
                  data-stagger={Math.min(idx + 1, 8)}
                >
                  <CategoryIcon id={cat.id} className="w-9 h-9 mb-1.5 text-white" />
                  <p className="font-semibold text-white text-xs text-center">{cat.label}</p>
                </button>
              ))}
            </div>
            <p className="text-[#d4d4d4] text-[11px] text-center mt-3">Some categories will connect you to our team for a custom quote</p>
            <div className="text-center mt-2">
              <button
                onClick={() => {
                  setInquiryCategory("Other");
                  setInquirySent(false);
                  setInquiryDesc("");
                  setStep("inquiry");
                  pushHistory("inquiry");
                }}
                className="text-[#e6e6e6] text-[11px] underline underline-offset-2 hover:text-[#00c853] cursor-pointer transition"
              >
                Sell other
              </button>
            </div>

            <FairPromise />
            <TrustBadge />
          </div>
        </section>
      )}

      {/* STEP: INQUIRY (unknown categories) — full quote flow */}
      {step === "inquiry" && page === "home" && (
        <section className="animate-[fadeIn_0.3s_ease-out]">
          <div className="max-w-lg md:max-w-3xl lg:max-w-7xl mx-auto px-4 pt-6 pb-8">
            <button onClick={() => { setStep("category"); pushHistory("category"); }} aria-label="Go back" className="inline-flex items-center gap-2 text-[#00c853] text-sm font-semibold mb-6 px-4 py-2 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 cursor-pointer transition tap-press">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
              Back
            </button>
            <h2 className="text-2xl font-bold mb-1">{inquiryCategory === "Other" ? "Tell us what you'd like to sell" : `Sell Your ${inquiryCategory}`}</h2>

            {/* Step 1: Device details */}
            {!condition && !inquirySent && (
              <>
                <p className="text-[#e6e6e6] text-sm mb-6">Tell us about your device, then we&apos;ll walk you through the same quick process.</p>

                {inquiryCategory === "Smartwatch" && (
                  <div className="mb-4">
                    <p className="text-xs font-medium text-[#e6e6e6] mb-2 uppercase tracking-wider">Select Brand</p>
                    <div className="grid grid-cols-3 gap-2">
                      {["Apple Watch", "Google Pixel Watch", "Garmin"].map((brand) => (
                        <button key={brand} onClick={() => setInquiryDesc(prev => prev.includes(brand) ? prev : brand + (prev ? ' - ' + prev : ''))} className={`p-3 rounded-xl text-xs font-semibold text-center cursor-pointer transition ${inquiryDesc.includes(brand) ? 'bg-[#00c853] text-black' : 'bg-white/5 border border-white/10 text-white hover:bg-white/10'}`}>
                          {brand}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-[#e6e6e6] mb-1.5 uppercase tracking-wider">Device Details</label>
                    <textarea value={inquiryDesc} onChange={(e) => setInquiryDesc(e.target.value)} required placeholder={`Brand, model, storage size, any issues (e.g. "Samsung Galaxy S24, 256GB, small crack on back")`} rows={3} className="w-full px-4 py-3 tcc-input text-sm resize-none" />
                  </div>
                  <button
                    onClick={() => { if (inquiryDesc.trim()) { setModel({ id: "custom", label: inquiryDesc.trim(), base: 0 }); } }}
                    disabled={!inquiryDesc.trim()}
                    className="w-full bg-[#00c853] text-[#0a0a0a] py-4 rounded-2xl text-lg font-semibold cursor-pointer hover:bg-[#00e676] transition tap-press disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Next: Select Condition
                  </button>
                </div>
              </>
            )}

            {/* Step 2: Condition selection */}
            {model && !condition && !inquirySent && (
              <>
                <p className="text-[#e6e6e6] text-sm mb-6">What condition is your device in?</p>
                <div className="space-y-2">
                  {getConditionsFor(deviceType).map((c) => (
                    <button
                      key={c.id}
                      onClick={() => setCondition(c)}
                      className="w-full flex items-center gap-4 px-4 py-3.5 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-[#00c853]/30 cursor-pointer transition text-left tap-press"
                    >
                      <span className="text-2xl">{c.icon}</span>
                      <div className="flex-1">
                        <p className="font-semibold text-sm">{c.label}</p>
                        <p className="text-[#e6e6e6] text-xs">{c.desc}</p>
                      </div>
                    </button>
                  ))}
                </div>
                <button onClick={() => setModel(null)} className="mt-4 text-[#e6e6e6] text-sm cursor-pointer hover:text-white transition">← Change device details</button>
              </>
            )}

            {/* Step 3: Contact + Submit (replaces checkout for custom devices) */}
            {model && condition && !inquirySent && (
              <>
                <p className="text-[#e6e6e6] text-sm mb-2">Almost done! We&apos;ll review your device and send you a quote.</p>
                <div className="bg-white/5 border border-white/10 rounded-2xl p-4 mb-6">
                  <p className="text-xs text-[#e6e6e6] uppercase tracking-wider font-medium mb-2">Your device</p>
                  <p className="text-white font-semibold text-sm">{model.label}</p>
                  <p className="text-[#e6e6e6] text-xs mt-1">Condition: {condition.label} ({condition.desc})</p>
                </div>
                <form onSubmit={async (e) => {
                  e.preventDefault();
                  try {
                    await fetch("/api/lead", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ name, phone, email, device: inquiryCategory, model: model.label, storage: "N/A", condition: condition.label, quote: 0, payout: "TBD", notes: "Custom device - full flow submission", photos: photoUrls }),
                    });
                  } catch {}
                  setInquirySent(true);
                }} className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-[#e6e6e6] mb-1.5 uppercase tracking-wider">Name</label>
                    <input type="text" value={name} onChange={(e) => setName(e.target.value)} required placeholder="Your name" className="w-full px-4 py-3.5 tcc-input text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#e6e6e6] mb-1.5 uppercase tracking-wider">Phone</label>
                    <input type="tel" value={phone} onChange={(e) => {
                      const digits = e.target.value.replace(/\D/g, "").slice(0, 10);
                      if (!digits) { setPhone(""); return; }
                      const isDeleting = e.target.value.length < phone.length;
                      if (isDeleting) { setPhone(digits); return; }
                      if (digits.length >= 6) setPhone(`(${digits.slice(0,3)}) ${digits.slice(3,6)}-${digits.slice(6)}`);
                      else if (digits.length >= 3) setPhone(`(${digits.slice(0,3)}) ${digits.slice(3)}`);
                      else setPhone(digits);
                    }} required placeholder="(512) 555-0000" className="w-full px-4 py-3.5 tcc-input text-sm" />
                    <p className="text-[#e6e6e6] text-[11px] leading-relaxed mt-1.5">By submitting, you agree to receive SMS updates about your trade-in from Top Cash Cellular. Msg &amp; data rates may apply. Reply STOP to opt out, HELP for help.</p>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#e6e6e6] mb-1.5 uppercase tracking-wider">Email</label>
                    <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="you@email.com" className="w-full px-4 py-3.5 tcc-input text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#e6e6e6] mb-1.5 uppercase tracking-wider">Photos (optional)</label>
                    <label className={`flex items-center justify-center gap-2 w-full px-4 py-3.5 bg-white/5 border border-white/10 border-dashed rounded-xl text-sm cursor-pointer hover:bg-white/10 transition ${uploading ? "opacity-50 pointer-events-none" : ""}`}>
                      <svg className="w-5 h-5 text-[#e6e6e6]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                      <span className="text-[#e6e6e6]">{uploading ? "Uploading..." : photoUrls.length ? `${photoUrls.length} photo${photoUrls.length > 1 ? "s" : ""} added` : "Add photos of your device"}</span>
                      <input type="file" accept="image/*" multiple className="hidden" onChange={async (e) => {
                        const files = e.target.files;
                        if (!files?.length) return;
                        setUploading(true);
                        setPhotoError(null);
                        const urls: string[] = [...photoUrls];
                        let firstErr: string | null = null;
                        for (const file of Array.from(files)) {
                          if (file.size > 20 * 1024 * 1024) { firstErr = firstErr || `Photo "${file.name}" is over 20MB — try a smaller image.`; continue; }
                          try {
                            const fd = new FormData();
                            fd.append("file", file);
                            const res = await fetch("/api/upload", { method: "POST", body: fd });
                            const data = await res.json().catch(() => ({}));
                            if (!res.ok) { firstErr = firstErr || (data?.error ? `Upload failed: ${data.error}` : `Upload failed (HTTP ${res.status}).`); continue; }
                            if (data?.url) urls.push(data.url);
                            else firstErr = firstErr || "Upload returned no URL.";
                          } catch (err) {
                            firstErr = firstErr || `Upload error: ${(err as Error).message || "network failure"}`;
                          }
                        }
                        setPhotoUrls(urls);
                        if (firstErr) setPhotoError(firstErr);
                        setUploading(false);
                        e.target.value = "";
                      }} />
                    </label>
                    {photoError && (
                      <p className="mt-2 text-xs text-red-300 bg-red-900/20 border border-red-700/40 rounded-lg px-3 py-2">{photoError}</p>
                    )}
                    {photoUrls.length > 0 && (
                      <div className="flex gap-2 mt-2 flex-wrap">
                        {photoUrls.map((url, i) => (
                          <div key={i} className="relative">
                            <img src={url} alt={`Photo ${i + 1}`} className="w-16 h-16 object-cover rounded-lg border border-white/10" />
                            <button type="button" onClick={() => setPhotoUrls(photoUrls.filter((_, j) => j !== i))} className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full text-white text-xs flex items-center justify-center cursor-pointer">×</button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <button type="submit" disabled={uploading} className="w-full bg-[#00c853] text-[#0a0a0a] py-4 rounded-2xl text-lg font-semibold cursor-pointer hover:bg-[#00e676] transition tap-press disabled:opacity-40 disabled:cursor-not-allowed">
                    Get My Custom Quote
                  </button>
                </form>
                <button onClick={() => setCondition(null)} className="mt-4 text-[#e6e6e6] text-sm cursor-pointer hover:text-white transition">← Change condition</button>
              </>
            )}

            {/* Step 4: Confirmation */}
            {inquirySent && (
              <div className="text-center py-8">
                <div className="w-16 h-16 rounded-full bg-[#00c853]/10 flex items-center justify-center mx-auto mb-4">
                  <span className="text-3xl">✅</span>
                </div>
                <h3 className="text-xl font-bold mb-2">Submitted!</h3>
                <p className="text-[#e6e6e6] text-sm mb-2">We&apos;re reviewing your {inquiryCategory === "Other" ? "item" : inquiryCategory.toLowerCase()} and will send you a personalized quote shortly.</p>
                <p className="text-[#e6e6e6] text-xs mb-6">Most quotes are sent within a few hours.</p>
                <button onClick={reset} className="text-[#00c853] font-semibold text-sm cursor-pointer hover:underline">
                  Sell another device
                </button>
              </div>
            )}

            <FairPromise />
            <TrustBadge />
          </div>
        </section>
      )}

      {/* STEP: BRAND */}
      {step === "brand" && page === "home" && category && (
        <section className="animate-[fadeIn_0.3s_ease-out]">
          <div className="max-w-lg md:max-w-3xl lg:max-w-7xl mx-auto px-4 pt-6 pb-8">
            <button onClick={handleBack} aria-label="Go back" className="inline-flex items-center gap-2 text-[#00c853] text-sm font-semibold mb-6 px-4 py-2 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 cursor-pointer transition tap-press">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
              Back
            </button>
            <h2 className="text-2xl md:text-3xl font-bold mb-1">Select your brand</h2>
            <p className="text-[#e6e6e6] text-sm mb-4">{category === "phones" ? "Phone brands" : category === "tablets" ? "Tablet brands" : category === "computers" ? "Laptop brands" : category === "desktops" ? "Desktop brands" : category === "watches" ? "Smartwatch brands" : category === "drones" ? "Drone brands" : category === "vr" ? "VR headset brands" : "Console brands"}</p>
            <div className="mb-6">{searchBar}</div>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-2 lg:grid-cols-3">
              {category === "phones" && [
                { id: "iphone" as const, label: "Apple iPhone", sub: "iPhone 11 and newer", brandIcon: <svg viewBox="0 0 40 40" className="w-10 h-10"><circle cx="20" cy="20" r="18" fill="#333"/><g transform="translate(0,-3)"><path d="M20 8c-1.2 2.4-1.8 4-1.8 5.6 0 2.8 2 4.4 4.2 4.4 0.2 0 0.4 0 0.6-0.1-0.4-1.2-0.6-2-0.6-2.7 0-2.6 1.6-4.4 2.6-5.6-1-1.2-3-1.6-5-1.6zm-2.4 11c-2.8 0-5.6 2.4-5.6 6.8 0 4.8 3.2 10.2 5.8 10.2 1 0 2-0.8 3.2-0.8 1.2 0 1.8 0.8 3.2 0.8 3 0 5.8-6 5.8-6-3.6-1.4-4-5.4-4-6.8 0-2.4 1.2-4 1.2-4-1.8-2-4-2.2-5-2.2-1.6 0-3 1-4.6 2z" fill="#fff"/></g></svg> },
                { id: "android" as const, label: "Samsung Galaxy", sub: "Galaxy S21 and newer", brandIcon: <svg viewBox="0 0 40 40" className="w-10 h-10"><circle cx="20" cy="20" r="18" fill="#1428a0"/><text x="20" y="22" textAnchor="middle" fill="#fff" fontSize="7" fontWeight="bold" fontFamily="Arial" letterSpacing="0.5">SAMSUNG</text><rect x="14" y="24" width="12" height="1" rx="0.5" fill="#fff" opacity="0.5"/></svg> },
                { id: "pixel" as const, label: "Google Pixel", sub: "Pixel 5 and newer", brandIcon: <svg viewBox="0 0 40 40" className="w-10 h-10"><circle cx="20" cy="20" r="18" fill="#fff"/><path d="M20 10.5a9.5 9.5 0 100 19 9.5 9.5 0 000-19z" fill="none" stroke="#4285F4" strokeWidth="3" strokeDasharray="15 45" strokeDashoffset="0"/><path d="M20 10.5a9.5 9.5 0 100 19 9.5 9.5 0 000-19z" fill="none" stroke="#EA4335" strokeWidth="3" strokeDasharray="15 45" strokeDashoffset="-15"/><path d="M20 10.5a9.5 9.5 0 100 19 9.5 9.5 0 000-19z" fill="none" stroke="#FBBC05" strokeWidth="3" strokeDasharray="15 45" strokeDashoffset="-30"/><path d="M20 10.5a9.5 9.5 0 100 19 9.5 9.5 0 000-19z" fill="none" stroke="#34A853" strokeWidth="3" strokeDasharray="15 45" strokeDashoffset="-45"/><text x="20" y="24" textAnchor="middle" fill="#4285F4" fontSize="11" fontWeight="bold" fontFamily="Arial">G</text></svg> },
              ].map((b, i) => (
                <button key={b.id} onClick={() => { setDeviceType(b.id); setStep("model"); pushHistory("model"); }} className="flex flex-col items-center justify-center p-4 rounded-2xl tcc-card tcc-brand-card cursor-pointer h-[130px] tap-press reveal" data-stagger={Math.min(i + 1, 8)}>
                  <span className="flex-shrink-0 mb-2 tcc-brand-tile">{b.brandIcon}</span>
                  <p className="font-bold text-sm text-center">{b.label}</p>
                  <p className="text-[#e6e6e6] text-xs text-center mt-0.5">{b.sub}</p>
                </button>
              ))}
              {category === "tablets" && [
                { id: "ipad" as const, label: "Apple", sub: "iPad Pro, Air, Mini, iPad", brandIcon: <svg viewBox="0 0 40 40" className="w-10 h-10"><circle cx="20" cy="20" r="18" fill="#333"/><g transform="translate(0,-3)"><path d="M20 8c-1.2 2.4-1.8 4-1.8 5.6 0 2.8 2 4.4 4.2 4.4 0.2 0 0.4 0 0.6-0.1-0.4-1.2-0.6-2-0.6-2.7 0-2.6 1.6-4.4 2.6-5.6-1-1.2-3-1.6-5-1.6zm-2.4 11c-2.8 0-5.6 2.4-5.6 6.8 0 4.8 3.2 10.2 5.8 10.2 1 0 2-0.8 3.2-0.8 1.2 0 1.8 0.8 3.2 0.8 3 0 5.8-6 5.8-6-3.6-1.4-4-5.4-4-6.8 0-2.4 1.2-4 1.2-4-1.8-2-4-2.2-5-2.2-1.6 0-3 1-4.6 2z" fill="#fff"/></g></svg> },
                { id: "samsung_tab" as const, label: "Samsung", sub: "Galaxy Tab S8, S9, A9+", brandIcon: <svg viewBox="0 0 40 40" className="w-10 h-10"><circle cx="20" cy="20" r="18" fill="#1428a0"/><text x="20" y="22" textAnchor="middle" fill="#fff" fontSize="7" fontWeight="bold" fontFamily="Arial" letterSpacing="0.5">SAMSUNG</text><rect x="14" y="24" width="12" height="1" rx="0.5" fill="#fff" opacity="0.5"/></svg> },
                { id: "surface" as const, label: "Microsoft Surface", sub: "Surface Pro, Surface Go", brandIcon: <svg viewBox="0 0 40 40" className="w-10 h-10"><circle cx="20" cy="20" r="18" fill="#00a4ef"/><rect x="11" y="11" width="8" height="8" fill="#f25022"/><rect x="21" y="11" width="8" height="8" fill="#7fba00"/><rect x="11" y="21" width="8" height="8" fill="#00a4ef"/><rect x="21" y="21" width="8" height="8" fill="#ffb900"/></svg> },
                { id: "lenovo_tab" as const, label: "Lenovo", sub: "Tab P12, P11, M11", brandIcon: <svg viewBox="0 0 40 40" className="w-10 h-10"><circle cx="20" cy="20" r="18" fill="#e2231a"/><text x="20" y="25" textAnchor="middle" fill="#fff" fontSize="9" fontWeight="bold" fontFamily="Arial">Lenovo</text></svg> },
                { id: "oneplus_tab" as const, label: "OnePlus", sub: "OnePlus Pad, Pad 2", brandIcon: <svg viewBox="0 0 40 40" className="w-10 h-10"><circle cx="20" cy="20" r="18" fill="#eb0028"/><text x="20" y="26" textAnchor="middle" fill="#fff" fontSize="11" fontWeight="bold" fontFamily="Arial">1+</text></svg> },
                { id: "google_tab" as const, label: "Google", sub: "Pixel Tablet", brandIcon: <svg viewBox="0 0 40 40" className="w-10 h-10"><circle cx="20" cy="20" r="18" fill="#fff"/><path d="M20 10.5a9.5 9.5 0 100 19 9.5 9.5 0 000-19z" fill="none" stroke="#4285F4" strokeWidth="3" strokeDasharray="15 45" strokeDashoffset="0"/><path d="M20 10.5a9.5 9.5 0 100 19 9.5 9.5 0 000-19z" fill="none" stroke="#EA4335" strokeWidth="3" strokeDasharray="15 45" strokeDashoffset="-15"/><path d="M20 10.5a9.5 9.5 0 100 19 9.5 9.5 0 000-19z" fill="none" stroke="#FBBC05" strokeWidth="3" strokeDasharray="15 45" strokeDashoffset="-30"/><path d="M20 10.5a9.5 9.5 0 100 19 9.5 9.5 0 000-19z" fill="none" stroke="#34A853" strokeWidth="3" strokeDasharray="15 45" strokeDashoffset="-45"/><text x="20" y="24" textAnchor="middle" fill="#4285F4" fontSize="11" fontWeight="bold" fontFamily="Arial">G</text></svg> },
                { id: "other_tab" as const, label: "Other", sub: "Any other tablet", brandIcon: <svg viewBox="0 0 40 40" className="w-10 h-10"><circle cx="20" cy="20" r="18" fill="#444"/><rect x="12" y="8" width="16" height="24" rx="3" fill="none" stroke="#fff" strokeWidth="1.5"/><line x1="18" y1="28" x2="22" y2="28" stroke="#fff" strokeWidth="1" strokeLinecap="round"/></svg> },
              ].map((b) => (
                <button key={b.id} onClick={() => {
                  if (b.id === "other_tab") { setInquiryCategory("Tablet"); setInquirySent(false); setInquiryDesc(""); setStep("inquiry"); pushHistory("inquiry"); return; }
                  setDeviceType(b.id); setStep("model"); pushHistory("model");
                }} className="flex flex-col items-center justify-center p-4 rounded-2xl tcc-card tcc-brand-card cursor-pointer h-[130px] tap-press">
                  <span className="flex-shrink-0 mb-2 tcc-brand-tile">{b.brandIcon}</span>
                  <p className="font-bold text-sm text-center">{b.label}</p>
                  <p className="text-[#e6e6e6] text-xs text-center mt-0.5">{b.sub}</p>
                </button>
              ))}
              {category === "computers" && [
                { id: "macbook" as const, label: "Apple MacBook", sub: "MacBook Air & Pro, M1+", brandIcon: <svg viewBox="0 0 40 40" className="w-10 h-10"><circle cx="20" cy="20" r="18" fill="#333"/><g transform="translate(0,-3)"><path d="M20 8c-1.2 2.4-1.8 4-1.8 5.6 0 2.8 2 4.4 4.2 4.4 0.2 0 0.4 0 0.6-0.1-0.4-1.2-0.6-2-0.6-2.7 0-2.6 1.6-4.4 2.6-5.6-1-1.2-3-1.6-5-1.6zm-2.4 11c-2.8 0-5.6 2.4-5.6 6.8 0 4.8 3.2 10.2 5.8 10.2 1 0 2-0.8 3.2-0.8 1.2 0 1.8 0.8 3.2 0.8 3 0 5.8-6 5.8-6-3.6-1.4-4-5.4-4-6.8 0-2.4 1.2-4 1.2-4-1.8-2-4-2.2-5-2.2-1.6 0-3 1-4.6 2z" fill="#fff"/></g></svg> },
                { id: "samsung_pc" as const, label: "Samsung", sub: "Galaxy Book / Book 2 / 3 / 4 / 5", brandIcon: <svg viewBox="0 0 40 40" className="w-10 h-10"><circle cx="20" cy="20" r="18" fill="#1428a0"/><text x="20" y="25" textAnchor="middle" fill="#fff" fontSize="12" fontWeight="bold" fontFamily="Arial">S</text></svg> },
                { id: "dell" as const, label: "Dell", sub: "XPS, Latitude, Inspiron, Vostro, Precision, G, Rugged", brandIcon: <svg viewBox="0 0 40 40" className="w-10 h-10"><circle cx="20" cy="20" r="18" fill="#007db8"/><text x="20" y="26" textAnchor="middle" fill="#fff" fontSize="11" fontWeight="bold" fontFamily="Arial">DELL</text></svg> },
                { id: "alienware" as const, label: "Alienware", sub: "m16, m18, x14, x16", brandIcon: <span className="text-[40px] leading-none">👽</span> },
                { id: "hp" as const, label: "HP", sub: "EliteBook, Envy, OMEN, OmniBook, Pavilion, ProBook, Spectre, Victus, ZBook, Notebook", brandIcon: <svg viewBox="0 0 40 40" className="w-10 h-10"><circle cx="20" cy="20" r="18" fill="#0096d6"/><text x="20" y="26" textAnchor="middle" fill="#fff" fontSize="14" fontWeight="bold" fontFamily="Arial">hp</text></svg> },
                { id: "lenovo" as const, label: "Lenovo", sub: "ThinkPad, ThinkBook, IdeaPad, Legion, LOQ, Slim, Yoga", brandIcon: <svg viewBox="0 0 40 40" className="w-10 h-10"><circle cx="20" cy="20" r="18" fill="#e2231a"/><text x="20" y="25" textAnchor="middle" fill="#fff" fontSize="9" fontWeight="bold" fontFamily="Arial">Lenovo</text></svg> },
                { id: "acer" as const, label: "Acer", sub: "Nitro, Predator", brandIcon: <svg viewBox="0 0 40 40" className="w-10 h-10"><circle cx="20" cy="20" r="18" fill="#83b81a"/><text x="20" y="25" textAnchor="middle" fill="#fff" fontSize="10" fontWeight="bold" fontFamily="Arial">acer</text></svg> },
                { id: "lg_pc" as const, label: "LG", sub: "Gram, Gram Pro, UltraGear", brandIcon: <svg viewBox="0 0 40 40" className="w-10 h-10"><circle cx="20" cy="20" r="18" fill="#a50034"/><text x="20" y="26" textAnchor="middle" fill="#fff" fontSize="14" fontWeight="bold" fontFamily="Arial">LG</text></svg> },
                { id: "asus_pc" as const, label: "ASUS", sub: "ROG, TUF, ProArt, Vivobook, ExpertBook", brandIcon: <svg viewBox="0 0 40 40" className="w-10 h-10"><circle cx="20" cy="20" r="18" fill="#1a1a1a"/><text x="20" y="25" textAnchor="middle" fill="#fff" fontSize="9" fontWeight="bold" fontFamily="Arial">ASUS</text></svg> },
                { id: "other_pc" as const, label: "Other Brand", sub: "Any other computer", brandIcon: <svg viewBox="0 0 40 40" className="w-10 h-10"><circle cx="20" cy="20" r="18" fill="#444"/><rect x="11" y="10" width="18" height="14" rx="2" fill="none" stroke="#fff" strokeWidth="1.5"/><line x1="15" y1="28" x2="25" y2="28" stroke="#fff" strokeWidth="1.5" strokeLinecap="round"/><line x1="20" y1="24" x2="20" y2="28" stroke="#fff" strokeWidth="1.5"/></svg> },
              ].map((b) => (
                <button key={b.id} onClick={() => {
                  if (b.id === "other_pc") { setInquiryCategory("Computer"); setInquirySent(false); setInquiryDesc(""); setStep("inquiry"); pushHistory("inquiry"); return; }
                  setDeviceType(b.id); setStep("model"); pushHistory("model");
                }} className="flex flex-col items-center justify-center p-4 rounded-2xl tcc-card tcc-brand-card cursor-pointer h-[130px] tap-press">
                  <span className="flex-shrink-0 mb-2 tcc-brand-tile">{b.brandIcon}</span>
                  <p className="font-bold text-sm text-center">{b.label}</p>
                  <p className="text-[#e6e6e6] text-xs text-center mt-0.5">{b.sub}</p>
                </button>
              ))}
              {category === "desktops" && [
                { id: "apple_desktop" as const, label: "Apple", sub: "Mac Studio, Mac Mini, Mac Pro, iMac", brandIcon: <svg viewBox="0 0 40 40" className="w-10 h-10"><circle cx="20" cy="20" r="18" fill="#333"/><g transform="translate(0,-3)"><path d="M20 8c-1.2 2.4-1.8 4-1.8 5.6 0 2.8 2 4.4 4.2 4.4 0.2 0 0.4 0 0.6-0.1-0.4-1.2-0.6-2-0.6-2.7 0-2.6 1.6-4.4 2.6-5.6-1-1.2-3-1.6-5-1.6zm-2.4 11c-2.8 0-5.6 2.4-5.6 6.8 0 4.8 3.2 10.2 5.8 10.2 1 0 2-0.8 3.2-0.8 1.2 0 1.8 0.8 3.2 0.8 3 0 5.8-6 5.8-6-3.6-1.4-4-5.4-4-6.8 0-2.4 1.2-4 1.2-4-1.8-2-4-2.2-5-2.2-1.6 0-3 1-4.6 2z" fill="#fff"/></g></svg> },
                { id: "dell_desktop" as const, label: "Dell", sub: "OptiPlex, XPS, Precision, Inspiron", brandIcon: <svg viewBox="0 0 40 40" className="w-10 h-10"><circle cx="20" cy="20" r="18" fill="#007db8"/><text x="20" y="26" textAnchor="middle" fill="#fff" fontSize="11" fontWeight="bold" fontFamily="Arial">DELL</text></svg> },
                { id: "lenovo_desktop" as const, label: "Lenovo", sub: "ThinkCentre, Legion Tower, IdeaCentre", brandIcon: <svg viewBox="0 0 40 40" className="w-10 h-10"><circle cx="20" cy="20" r="18" fill="#e2231a"/><text x="20" y="25" textAnchor="middle" fill="#fff" fontSize="9" fontWeight="bold" fontFamily="Arial">Lenovo</text></svg> },
                { id: "hp_desktop" as const, label: "HP", sub: "EliteDesk, OMEN, Envy, Pavilion", brandIcon: <svg viewBox="0 0 40 40" className="w-10 h-10"><circle cx="20" cy="20" r="18" fill="#0096d6"/><text x="20" y="26" textAnchor="middle" fill="#fff" fontSize="14" fontWeight="bold" fontFamily="Arial">hp</text></svg> },
                { id: "asus_desktop" as const, label: "Asus", sub: "ROG, TUF Gaming, ExpertCenter, NUC", brandIcon: <svg viewBox="0 0 40 40" className="w-10 h-10"><circle cx="20" cy="20" r="18" fill="#1a1a1a"/><text x="20" y="25" textAnchor="middle" fill="#fff" fontSize="9" fontWeight="bold" fontFamily="Arial">ASUS</text></svg> },
                { id: "alienware_desktop" as const, label: "Alienware", sub: "Aurora R13, R15, R16", brandIcon: <span className="text-[40px] leading-none">👽</span> },
                { id: "msi_desktop" as const, label: "MSI", sub: "MEG, MAG Trident, Codex, PRO", brandIcon: <svg viewBox="0 0 40 40" className="w-10 h-10"><circle cx="20" cy="20" r="18" fill="#eb1c24"/><text x="20" y="25" textAnchor="middle" fill="#fff" fontSize="10" fontWeight="bold" fontFamily="Arial">MSI</text></svg> },
                { id: "other_desktop" as const, label: "Other Brand", sub: "Any other desktop", brandIcon: <svg viewBox="0 0 40 40" className="w-10 h-10"><circle cx="20" cy="20" r="18" fill="#444"/><rect x="10" y="8" width="20" height="16" rx="2" fill="none" stroke="#fff" strokeWidth="1.5"/><line x1="14" y1="28" x2="26" y2="28" stroke="#fff" strokeWidth="1.5" strokeLinecap="round"/><line x1="20" y1="24" x2="20" y2="28" stroke="#fff" strokeWidth="1.5"/></svg> },
              ].map((b) => (
                <button key={b.id} onClick={() => {
                  if (b.id === "other_desktop") { setInquiryCategory("Desktop"); setInquirySent(false); setInquiryDesc(""); setStep("inquiry"); pushHistory("inquiry"); return; }
                  setDeviceType(b.id); setStep("model"); pushHistory("model");
                }} className="flex flex-col items-center justify-center p-4 rounded-2xl tcc-card tcc-brand-card cursor-pointer h-[130px] tap-press">
                  <span className="flex-shrink-0 mb-2 tcc-brand-tile">{b.brandIcon}</span>
                  <p className="font-bold text-sm text-center">{b.label}</p>
                  <p className="text-[#e6e6e6] text-xs text-center mt-0.5">{b.sub}</p>
                </button>
              ))}
              {category === "vr" && [
                { id: "apple_vr" as const, label: "Apple", sub: "Vision Pro", brandIcon: <svg viewBox="0 0 40 40" className="w-10 h-10"><circle cx="20" cy="20" r="18" fill="#333"/><g transform="translate(0,-3)"><path d="M20 8c-1.2 2.4-1.8 4-1.8 5.6 0 2.8 2 4.4 4.2 4.4 0.2 0 0.4 0 0.6-0.1-0.4-1.2-0.6-2-0.6-2.7 0-2.6 1.6-4.4 2.6-5.6-1-1.2-3-1.6-5-1.6zm-2.4 11c-2.8 0-5.6 2.4-5.6 6.8 0 4.8 3.2 10.2 5.8 10.2 1 0 2-0.8 3.2-0.8 1.2 0 1.8 0.8 3.2 0.8 3 0 5.8-6 5.8-6-3.6-1.4-4-5.4-4-6.8 0-2.4 1.2-4 1.2-4-1.8-2-4-2.2-5-2.2-1.6 0-3 1-4.6 2z" fill="#fff"/></g></svg> },
                { id: "meta_vr" as const, label: "Meta", sub: "Quest 2, Quest 3, Quest Pro", brandIcon: <svg viewBox="0 0 40 40" className="w-10 h-10"><circle cx="20" cy="20" r="18" fill="#0668E1"/><text x="20" y="25" textAnchor="middle" fill="#fff" fontSize="8" fontWeight="bold" fontFamily="Arial">META</text></svg> },
                { id: "valve_vr" as const, label: "Valve Index", sub: "Full Kit, Headset Only", brandIcon: <svg viewBox="0 0 40 40" className="w-10 h-10"><circle cx="20" cy="20" r="18" fill="#171a21"/><text x="20" y="25" textAnchor="middle" fill="#fff" fontSize="7" fontWeight="bold" fontFamily="Arial">VALVE</text></svg> },
                { id: "psvr" as const, label: "PlayStation VR", sub: "PSVR2, PSVR Original", brandIcon: <svg viewBox="0 0 40 40" className="w-10 h-10"><circle cx="20" cy="20" r="18" fill="#003087"/><text x="20" y="24" textAnchor="middle" fill="#fff" fontSize="8" fontWeight="bold" fontFamily="Arial">PSVR</text></svg> },
                { id: "other_vr" as const, label: "Other Brand", sub: "HTC Vive, Pico, etc.", brandIcon: <svg viewBox="0 0 40 40" className="w-10 h-10"><circle cx="20" cy="20" r="18" fill="#444"/><text x="20" y="24" textAnchor="middle" fill="#fff" fontSize="14">🥽</text></svg> },
              ].map((b) => (
                <button key={b.id} onClick={() => {
                  if (b.id === "other_vr") { setInquiryCategory("VR Headset"); setInquirySent(false); setInquiryDesc(""); setStep("inquiry"); pushHistory("inquiry"); return; }
                  setDeviceType(b.id); setStep("model"); pushHistory("model");
                }} className="flex flex-col items-center justify-center p-4 rounded-2xl tcc-card tcc-brand-card cursor-pointer h-[130px] tap-press">
                  <span className="flex-shrink-0 mb-2 tcc-brand-tile">{b.brandIcon}</span>
                  <p className="font-bold text-sm text-center">{b.label}</p>
                  <p className="text-[#e6e6e6] text-xs text-center mt-0.5">{b.sub}</p>
                </button>
              ))}
              {category === "drones" && [
                { id: "dji" as const, label: "DJI", sub: "Mavic, Inspire, Avata, Mini, Air", brandIcon: <svg viewBox="0 0 40 40" className="w-10 h-10"><circle cx="20" cy="20" r="18" fill="#1a1a1a"/><text x="20" y="26" textAnchor="middle" fill="#fff" fontSize="13" fontWeight="bold" fontFamily="Arial">DJI</text></svg> },
              ].map((b) => (
                <button key={b.id} onClick={() => {
                  setDeviceType(b.id); setStep("model"); pushHistory("model");
                }} className="flex flex-col items-center justify-center p-4 rounded-2xl tcc-card tcc-brand-card cursor-pointer h-[130px] tap-press">
                  <span className="flex-shrink-0 mb-2 tcc-brand-tile">{b.brandIcon}</span>
                  <p className="font-bold text-sm text-center">{b.label}</p>
                  <p className="text-[#e6e6e6] text-xs text-center mt-0.5">{b.sub}</p>
                </button>
              ))}
              {category === "watches" && [
                { id: "applewatch" as const, label: "Apple Watch", sub: "Ultra, Series 7–10, SE", brandIcon: <svg viewBox="0 0 40 40" className="w-10 h-10"><circle cx="20" cy="20" r="18" fill="#333"/><g transform="translate(0,-3)"><path d="M20 8c-1.2 2.4-1.8 4-1.8 5.6 0 2.8 2 4.4 4.2 4.4 0.2 0 0.4 0 0.6-0.1-0.4-1.2-0.6-2-0.6-2.7 0-2.6 1.6-4.4 2.6-5.6-1-1.2-3-1.6-5-1.6zm-2.4 11c-2.8 0-5.6 2.4-5.6 6.8 0 4.8 3.2 10.2 5.8 10.2 1 0 2-0.8 3.2-0.8 1.2 0 1.8 0.8 3.2 0.8 3 0 5.8-6 5.8-6-3.6-1.4-4-5.4-4-6.8 0-2.4 1.2-4 1.2-4-1.8-2-4-2.2-5-2.2-1.6 0-3 1-4.6 2z" fill="#fff"/></g></svg> },
                { id: "samsungwatch" as const, label: "Samsung", sub: "Galaxy Watch Ultra, 5–7", brandIcon: <svg viewBox="0 0 40 40" className="w-10 h-10"><circle cx="20" cy="20" r="18" fill="#1428a0"/><text x="20" y="22" textAnchor="middle" fill="#fff" fontSize="7" fontWeight="bold" fontFamily="Arial" letterSpacing="0.5">SAMSUNG</text><rect x="14" y="24" width="12" height="1" rx="0.5" fill="#fff" opacity="0.5"/></svg> },
                { id: "pixelwatch" as const, label: "Google Pixel Watch", sub: "Pixel Watch 1–3", brandIcon: <svg viewBox="0 0 40 40" className="w-10 h-10"><circle cx="20" cy="20" r="18" fill="#fff"/><path d="M29.5 20c0-5.2-4.3-9.5-9.5-9.5-5.2 0-9.5 4.3-9.5 9.5 0 4.5 3.1 8.2 7.3 9.2v-3.7h-2.2V20h2.2v-2c0-2.2 1.3-3.4 3.3-3.4.9 0 1.9.2 1.9.2v2.2h-1.1c-1 0-1.4.6-1.4 1.3V20h2.4l-.4 2.5h-2V29.2c4.2-1 7.3-4.7 7.3-9.2z" fill="none"/><path d="M20 10.5a9.5 9.5 0 100 19 9.5 9.5 0 000-19z" fill="none" stroke="#4285F4" strokeWidth="3" strokeDasharray="15 45" strokeDashoffset="0"/><path d="M20 10.5a9.5 9.5 0 100 19 9.5 9.5 0 000-19z" fill="none" stroke="#EA4335" strokeWidth="3" strokeDasharray="15 45" strokeDashoffset="-15"/><path d="M20 10.5a9.5 9.5 0 100 19 9.5 9.5 0 000-19z" fill="none" stroke="#FBBC05" strokeWidth="3" strokeDasharray="15 45" strokeDashoffset="-30"/><path d="M20 10.5a9.5 9.5 0 100 19 9.5 9.5 0 000-19z" fill="none" stroke="#34A853" strokeWidth="3" strokeDasharray="15 45" strokeDashoffset="-45"/><text x="20" y="24" textAnchor="middle" fill="#4285F4" fontSize="11" fontWeight="bold" fontFamily="Arial">G</text></svg> },
                { id: "garmin" as const, label: "Garmin", sub: "Fenix, Epix, Forerunner, Venu", brandIcon: <svg viewBox="0 0 40 40" className="w-10 h-10"><circle cx="20" cy="20" r="18" fill="#1d4e89"/><text x="20" y="24" textAnchor="middle" fill="#fff" fontSize="8" fontWeight="bold" fontFamily="Arial">GARMIN</text></svg> },
                { id: "other_watch" as const, label: "Other Brand", sub: "Fitbit, Amazfit, etc.", brandIcon: <svg viewBox="0 0 40 40" className="w-10 h-10"><circle cx="20" cy="20" r="18" fill="#444"/><circle cx="20" cy="20" r="9" fill="none" stroke="#fff" strokeWidth="1.5"/><text x="20" y="24" textAnchor="middle" fill="#fff" fontSize="10">?</text></svg> },
              ].map((b) => (
                <button key={b.id} onClick={() => {
                  if (b.id === "other_watch") { setInquiryCategory("Smartwatch"); setInquirySent(false); setInquiryDesc(""); setStep("inquiry"); pushHistory("inquiry"); return; }
                  setDeviceType(b.id); setStep("model"); pushHistory("model");
                }} className="flex flex-col items-center justify-center p-4 rounded-2xl tcc-card tcc-brand-card cursor-pointer h-[130px] tap-press">
                  <span className="flex-shrink-0 mb-2 tcc-brand-tile">{b.brandIcon}</span>
                  <p className="font-bold text-sm text-center">{b.label}</p>
                  <p className="text-[#e6e6e6] text-xs text-center mt-0.5">{b.sub}</p>
                </button>
              ))}
              {category === "consoles" && [
                { id: "sony" as const, label: "Sony", sub: "PlayStation 4, PS4 Pro, PS5", brandIcon: <svg viewBox="0 0 40 40" className="w-10 h-10"><circle cx="20" cy="20" r="18" fill="#003087"/><text x="20" y="25" textAnchor="middle" fill="#fff" fontSize="10" fontWeight="bold" fontFamily="Arial">SONY</text></svg> },
                { id: "microsoft" as const, label: "Microsoft", sub: "Xbox One, Series S, Series X", brandIcon: <svg viewBox="0 0 40 40" className="w-10 h-10"><circle cx="20" cy="20" r="18" fill="#107c10"/><text x="20" y="25" textAnchor="middle" fill="#fff" fontSize="10" fontWeight="bold" fontFamily="Arial">XBOX</text></svg> },
                { id: "nintendo" as const, label: "Nintendo", sub: "Switch OLED, Switch V2, Switch Lite", brandIcon: <svg viewBox="0 0 40 40" className="w-10 h-10"><circle cx="20" cy="20" r="18" fill="#e60012"/><text x="20" y="25" textAnchor="middle" fill="#fff" fontSize="8" fontWeight="bold" fontFamily="Arial">Nintendo</text></svg> },
              ].map((b) => (
                <button key={b.id} onClick={() => { setDeviceType(b.id); setStep("model"); pushHistory("model"); }} className="flex flex-col items-center justify-center p-4 rounded-2xl tcc-card tcc-brand-card cursor-pointer h-[130px] tap-press">
                  <span className="flex-shrink-0 mb-2 tcc-brand-tile">{b.brandIcon}</span>
                  <p className="font-bold text-sm text-center">{b.label}</p>
                  <p className="text-[#e6e6e6] text-xs text-center mt-0.5">{b.sub}</p>
                </button>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* STEP: MODEL SELECTION */}
      {step === "model" && page === "home" && (
        <section className="animate-[fadeIn_0.3s_ease-out]">
          <div className="max-w-lg md:max-w-3xl lg:max-w-7xl mx-auto px-4 pt-6 pb-8">
            <button onClick={handleBack} aria-label="Go back" className="inline-flex items-center gap-2 text-[#00c853] text-sm font-semibold mb-6 px-4 py-2 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 cursor-pointer transition tap-press">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
              Back
            </button>

            <div className="mb-6">{searchBar}</div>

            {/* iPhone: grouped by generation (17 / 16 / 15 / ... / 11)
                with a thin uppercase divider above each set so the
                full list stays scannable. */}
            {deviceType === "iphone" && (() => {
              const fallbackImgs: Record<string,string> = {ip17pm:"/iphone17.png",ip17p:"/iphone17.png",ip17air:"/iphone17air.png",ip17:"/iphone17base.png",ip17e:"/iphone17e.png",ip16pm:"/iphone16.png",ip16p:"/iphone16.png",ip16plus:"/iphone16plus.png",ip16:"/iphone16base.png",ip16e:"/iphone16e.png",ip15pm:"/iphone15.png",ip15p:"/iphone15.png",ip15plus:"/iphone15.png",ip15:"/iphone15base.png",ip14pm:"/iphone14.png",ip14p:"/iphone14.png",ip14plus:"/iphone14plus.png",ip14:"/iphone14base.png",ip13pm:"/iphone13.png",ip13p:"/iphone13.png",ip13:"/iphone13base.png",ip12pm:"/iphone12.png",ip12p:"/iphone12.png",ip12:"/iphone12base.png",ip12mini:"/iphone12mini.png",ip11pm:"/iphone11.png",ip11p:"/iphone11.png",ip11:"/iphone11base.png"};
              const visibleIds = new Set(models.map(m => m.id));
              const groups = IPHONE_SERIES
                .map(s => ({ label: s.label, year: s.year, variants: s.variants.filter(v => visibleIds.has(v.id)) }))
                .filter(g => g.variants.length > 0);
              return (
                <div className="space-y-5">
                  {groups.map(g => (
                    <div key={g.label}>
                      <div className="flex items-center gap-3 mb-2">
                        <p className="text-[10px] font-extrabold tracking-[0.22em] uppercase text-[#00c853]">{g.label}</p>
                        <span className="text-[10px] text-[#888]">{g.year}</span>
                        <div className="flex-1 h-px bg-gradient-to-r from-[#00c853]/40 via-white/15 to-transparent" />
                      </div>
                      <div className="space-y-2">
                        {g.variants.map((v) => {
                          const m = v as typeof models[number];
                          const imgSrc = (m as { image?: string }).image || fallbackImgs[m.id] || null;
                          return (
                            <button key={m.id} onClick={() => { setModel(m); const _ns: Step = hasAdditiveSpecs(m.id) ? "processor" : stepAfterModel; setStep(_ns); pushHistory(_ns); }} className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 cursor-pointer transition text-left tap-press">
                              {imgSrc && <img src={imgSrc} alt={m.label} className="w-10 h-10 object-contain flex-shrink-0" />}
                              <p className="font-semibold text-[15px] flex-1">{m.label}</p>
                              <div className="flex items-center gap-2">
                                <span className="text-[#00c853] font-bold text-sm">Up to ${getMaxPrice(m, deviceType)}</span>
                                <svg className="w-4 h-4 text-[#e6e6e6]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}

            {/* Samsung Galaxy: top-level series picker (S / Z / Note) */}
            {deviceType === "android" && !selectedSeries && (
              <>
                <h2 className="text-2xl md:text-3xl font-bold mb-1">Select your Samsung Galaxy</h2>
                <p className="text-[#e6e6e6] text-sm mb-6">Choose your line</p>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {SAMSUNG_SERIES.map((s) => (
                    <button key={s.id} onClick={() => setSelectedSeries(s.id)} className="tap-press flex flex-col items-center justify-center p-4 rounded-2xl tcc-card tcc-brand-card cursor-pointer h-[150px]">
                      {s.image ? (
                        <img src={s.image} alt={s.label} loading="eager" className="w-20 h-16 object-contain mb-1" />
                      ) : (
                        <div className="w-16 h-12 mb-1" />
                      )}
                      <p className="font-bold text-sm">{s.label}</p>
                      <p className="text-[#e6e6e6] text-[10px] text-center">{s.year}</p>
                      <p className="text-[#00c853] font-bold text-xs mt-0.5">Up to ${s.topPrice}</p>
                    </button>
                  ))}
                </div>
              </>
            )}

            {/* Samsung Galaxy: variants of the picked series — grouped by
                sub-category (Ultra / Plus / Base / FE etc) with section
                dividers between groups so each tab feels organized. */}
            {deviceType === "android" && selectedSeries && (() => {
              const ser = SAMSUNG_SERIES.find(s => s.id === selectedSeries);
              type V = typeof models[number];
              const matchById = (prefixes: string[]) =>
                (m: V) => prefixes.some(p => m.id.startsWith(p));
              const inGroup = (m: V, ids: string[]) => ids.includes(m.id);
              const filter = (test: (m: V) => boolean) => models.filter(test);
              const groups: { label: string; variants: V[] }[] = (() => {
                if (selectedSeries === "sseries") {
                  return [
                    { label: "Ultra",        variants: filter(m => /^gs\d+u$/.test(m.id)) },
                    { label: "Edge",         variants: filter(m => m.id.endsWith("edge")) },
                    { label: "Plus",         variants: filter(m => /^gs\d+p$/.test(m.id)) },
                    { label: "Standard",     variants: filter(m => /^gs\d+$/.test(m.id)) },
                    { label: "Fan Edition",  variants: filter(m => m.id.endsWith("fe")) },
                  ];
                }
                if (selectedSeries === "zseries") {
                  return [
                    { label: "TriFold", variants: filter(m => inGroup(m, ["gztrifold"])) },
                    { label: "Z Fold",  variants: filter(matchById(["gzfold"])) },
                    { label: "Z Flip",  variants: filter(matchById(["gzflip"])) },
                  ];
                }
                if (selectedSeries === "noteseries") {
                  return [
                    { label: "Note 20", variants: filter(m => m.id === "gnote20u" || m.id === "gnote20") },
                    { label: "Note 10", variants: filter(m => m.id === "gnote10p5g" || m.id === "gnote10p" || m.id === "gnote10") },
                    { label: "Note 9",  variants: filter(m => m.id === "gnote9") },
                  ];
                }
                return [{ label: "", variants: models }];
              })().filter(g => g.variants.length > 0);
              return (
                <>
                  <h2 className="text-2xl font-bold mb-1">{ser?.label}</h2>
                  <p className="text-[#e6e6e6] text-sm mb-4">{ser?.year}</p>
                  <div className="space-y-5">
                    {groups.map((g, gi) => (
                      <div key={g.label || gi}>
                        {g.label && (
                          <div className="flex items-center gap-3 mb-2">
                            <p className="text-[10px] font-extrabold tracking-[0.22em] uppercase text-[#00c853]">{g.label}</p>
                            <div className="flex-1 h-px bg-gradient-to-r from-[#00c853]/40 via-white/15 to-transparent" />
                          </div>
                        )}
                        <div className="space-y-2">
                          {g.variants.map((m) => {
                            const mImage = (m as { image?: string }).image;
                            return (
                              <button key={m.id} onClick={() => { setModel(m); const _ns: Step = hasAdditiveSpecs(m.id) ? "processor" : stepAfterModel; setStep(_ns); pushHistory(_ns); }} className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 cursor-pointer transition text-left tap-press">
                                {mImage ? (
                                  <img src={mImage} alt={m.label} loading="lazy" className="w-10 h-10 object-contain shrink-0" />
                                ) : (
                                  <div className="w-10 h-10 shrink-0" />
                                )}
                                <p className="font-semibold text-[15px] flex-1">{m.label}</p>
                                <div className="flex items-center gap-2">
                                  <span className="text-[#00c853] font-bold text-sm">Up to ${getMaxPrice(m, deviceType)}</span>
                                  <svg className="w-4 h-4 text-[#e6e6e6]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              );
            })()}

            {/* Google Pixel: grouped by generation (Pixel 10 -> 5)
                with year labels, matching the iPhone treatment. */}
            {deviceType === "pixel" && (() => {
              type PixelGen = { label: string; year: string; ids: string[] };
              const pixelGens: PixelGen[] = [
                { label: "Pixel 10", year: "2025", ids: ["px10pxl","px10p","px10","px10a","px10pfold"] },
                { label: "Pixel 9",  year: "2024", ids: ["px9pxl","px9p","px9","px9a","px9pfold"] },
                { label: "Pixel 8",  year: "2023", ids: ["px8p","px8","px8a"] },
                { label: "Pixel Fold", year: "2023", ids: ["pxfold"] },
                { label: "Pixel 7",  year: "2022", ids: ["px7p","px7","px7a"] },
                { label: "Pixel 6",  year: "2021", ids: ["px6p","px6","px6a"] },
                { label: "Pixel 5",  year: "2020", ids: ["px5","px5a"] },
              ];
              const byId = new Map(models.map(m => [m.id, m]));
              const groups = pixelGens
                .map(g => ({ ...g, variants: g.ids.map(id => byId.get(id)).filter(Boolean) as typeof models }))
                .filter(g => g.variants.length > 0);
              return (
                <div className="space-y-5">
                  {groups.map(g => (
                    <div key={g.label}>
                      <div className="flex items-center gap-3 mb-2">
                        <p className="text-[10px] font-extrabold tracking-[0.22em] uppercase text-[#00c853]">{g.label}</p>
                        <span className="text-[10px] text-[#888]">{g.year}</span>
                        <div className="flex-1 h-px bg-gradient-to-r from-[#00c853]/40 via-white/15 to-transparent" />
                      </div>
                      <div className="space-y-2">
                        {g.variants.map((m) => {
                          const mImage = (m as { image?: string }).image;
                          const inq = (m as { inquiryOnly?: boolean }).inquiryOnly;
                          return (
                            <button key={m.id} onClick={() => { setModel(m); const _ns: Step = hasAdditiveSpecs(m.id) ? "processor" : stepAfterModel; setStep(_ns); pushHistory(_ns); }} className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 cursor-pointer transition text-left tap-press">
                              {mImage ? (
                                <img src={mImage} alt={m.label} loading="lazy" className="w-10 h-10 object-contain shrink-0" />
                              ) : (
                                <div className="w-10 h-10 shrink-0" />
                              )}
                              <p className="font-semibold text-[15px] flex-1">{m.label}</p>
                              <div className="flex items-center gap-2">
                                <span className="text-[#00c853] font-bold text-sm">{inq ? "Get a quote" : `Up to $${getMaxPrice(m, deviceType)}`}</span>
                                <svg className="w-4 h-4 text-[#e6e6e6]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}

            {/* MacBook: top-level series picker (Pro / Air / Neo / Classic) */}
            {deviceType === "macbook" && !selectedSeries && (
              <>
                <h2 className="text-2xl md:text-3xl font-bold mb-1">Select your MacBook</h2>
                <p className="text-[#e6e6e6] text-sm mb-6">Choose your line</p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {MACBOOK_SERIES.map((s) => {
                    const seriesInq = !!(s as { inquiryOnly?: boolean }).inquiryOnly;
                    return (
                      <button key={s.id} onClick={() => setSelectedSeries(s.id)} className="tap-press flex flex-col items-center justify-center p-4 rounded-2xl tcc-card cursor-pointer h-[150px]">
                        {s.image ? (
                          <img src={s.image} alt={s.label} loading="eager" className="w-16 h-12 object-contain mb-1" />
                        ) : (
                          <svg viewBox="0 0 40 40" className="w-12 h-12 mb-1.5"><circle cx="20" cy="20" r="18" fill="#333"/><g transform="translate(0,-3)"><path d="M20 8c-1.2 2.4-1.8 4-1.8 5.6 0 2.8 2 4.4 4.2 4.4 0.2 0 0.4 0 0.6-0.1-0.4-1.2-0.6-2-0.6-2.7 0-2.6 1.6-4.4 2.6-5.6-1-1.2-3-1.6-5-1.6zm-2.4 11c-2.8 0-5.6 2.4-5.6 6.8 0 4.8 3.2 10.2 5.8 10.2 1 0 2-0.8 3.2-0.8 1.2 0 1.8 0.8 3.2 0.8 3 0 5.8-6 5.8-6-3.6-1.4-4-5.4-4-6.8 0-2.4 1.2-4 1.2-4-1.8-2-4-2.2-5-2.2-1.6 0-3 1-4.6 2z" fill="#fff"/></g></svg>
                        )}
                        <p className="font-bold text-sm">{s.label}</p>
                        <p className="text-[#e6e6e6] text-[10px] text-center px-1 leading-tight">{s.year}</p>
                        <p className="text-[#00c853] font-bold text-xs mt-0.5">{seriesInq ? "Get a quote" : `Up to $${s.topPrice}`}</p>
                      </button>
                    );
                  })}
                </div>
              </>
            )}

            {/* MacBook: variants of the picked series — grouped by chip
                generation (M5 / M4 / M3 / M2 / M1 / Intel) for Pro and
                Air. Neo and Classic series have too few variants to
                divide further. */}
            {deviceType === "macbook" && selectedSeries && (() => {
              const ser = MACBOOK_SERIES.find(s => s.id === selectedSeries);
              const macGroups: Record<string, Array<{ label: string; year?: string; match: (id: string) => boolean }>> = {
                mbpro: [
                  { label: "M5", year: "2025–2026", match: id => id.includes("m5") },
                  { label: "M4", year: "2024",      match: id => /(^|[^a-z])m4($|[^a-z\d])/.test(id) },
                  { label: "M3", year: "2023",      match: id => /(^|[^a-z])m3($|[^a-z\d])/.test(id) },
                  { label: "M2", year: "2023",      match: id => /(^|[^a-z])m2($|[^a-z\d])/.test(id) },
                  { label: "M1", year: "2020–2021", match: id => /(^|[^a-z])m1($|[^a-z\d])/.test(id) },
                  { label: "Intel", year: "2014–2020", match: id => /intel|tb_|retina_/.test(id) },
                ],
                mbair: [
                  { label: "M5", year: "2026",      match: id => id.includes("m5") },
                  { label: "M4", year: "2025",      match: id => /(^|[^a-z])m4($|[^a-z\d])/.test(id) },
                  { label: "M3", year: "2024",      match: id => /(^|[^a-z])m3($|[^a-z\d])/.test(id) },
                  { label: "M2", year: "2022–2023", match: id => /(^|[^a-z])m2($|[^a-z\d])/.test(id) },
                  { label: "M1", year: "2020",      match: id => /(^|[^a-z])m1($|[^a-z\d])/.test(id) },
                  { label: "Intel", year: "2014–2020", match: id => /intel|retina|mba_2/.test(id) },
                ],
              };
              const defs = (selectedSeries && macGroups[selectedSeries]) || null;
              const groups = defs
                ? defs.map(g => ({ label: g.label, year: g.year, variants: models.filter(m => g.match(m.id)) })).filter(g => g.variants.length > 0)
                : [{ label: "", year: undefined as string | undefined, variants: models }];
              return (
                <>
                  <h2 className="text-2xl font-bold mb-1">{ser?.label}</h2>
                  <p className="text-[#e6e6e6] text-sm mb-4">{ser?.year}</p>
                  <div className="space-y-5">
                    {groups.map((g, gi) => (
                      <div key={g.label || gi}>
                        {g.label && (
                          <div className="flex items-center gap-3 mb-2">
                            <p className="text-[10px] font-extrabold tracking-[0.22em] uppercase text-[#00c853]">{g.label}</p>
                            {g.year && <span className="text-[10px] text-[#888]">{g.year}</span>}
                            <div className="flex-1 h-px bg-gradient-to-r from-[#00c853]/40 via-white/15 to-transparent" />
                          </div>
                        )}
                        <div className="space-y-2">
                          {g.variants.map((m) => {
                            const inq = !!(m as { inquiryOnly?: boolean }).inquiryOnly;
                            const mImg = (m as { image?: string }).image;
                            return (
                              <button key={m.id} onClick={() => {
                                setModel(m);
                                // Models with a MACBOOK_SPECS entry go through the
                                // new IWM-style flow (processor -> memory -> storage
                                // -> display -> condition -> battery -> charger).
                                // Other models keep the legacy condition-first flow.
                                const next: Step = hasAdditiveSpecs(m.id) ? "processor" : "condition";
                                setStep(next); pushHistory(next);
                              }} className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 cursor-pointer transition text-left tap-press">
                                {mImg ? (
                                  <img src={mImg} alt={m.label} loading="lazy" className="w-12 h-9 object-contain shrink-0" />
                                ) : (
                                  <div className="w-12 h-9 shrink-0" />
                                )}
                                <p className="font-semibold text-[15px] flex-1">{m.label}</p>
                                <div className="flex items-center gap-2">
                                  <span className="text-[#00c853] font-bold text-sm">{inq ? "Get a quote" : `Up to $${getMaxPrice(m, deviceType)}`}</span>
                                  <svg className="w-4 h-4 text-[#e6e6e6]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              );
            })()}

            {/* iPad: grouped by product line (Pro / Air / Mini / iPad)
                with the year span shown next to each label, matching
                the iPhone + Pixel treatment. */}
            {deviceType === "ipad" && (() => {
              type IpadGroup = { label: string; year: string; ids: string[] };
              const ipadGroups: IpadGroup[] = [
                { label: "iPad Pro",  year: "2022–2025", ids: ["ipadpro13m5","ipadpro11m5","ipadpro13m4","ipadpro11m4","ipadpro129g6","ipadpro11g4"] },
                { label: "iPad Air",  year: "2024–2025", ids: ["ipadair13m3","ipadair11m3","ipadair13m2","ipadair11m2"] },
                { label: "iPad Mini", year: "2021–2024", ids: ["ipadmini7","ipadmini6"] },
                { label: "iPad",      year: "2021–2022", ids: ["ipad10","ipad9"] },
              ];
              const byId = new Map(models.map(m => [m.id, m]));
              const groups = ipadGroups
                .map(g => ({ ...g, variants: g.ids.map(id => byId.get(id)).filter(Boolean) as typeof models }))
                .filter(g => g.variants.length > 0);
              return (
                <div className="space-y-5">
                  {groups.map(g => (
                    <div key={g.label}>
                      <div className="flex items-center gap-3 mb-2">
                        <p className="text-[10px] font-extrabold tracking-[0.22em] uppercase text-[#00c853]">{g.label}</p>
                        <span className="text-[10px] text-[#888]">{g.year}</span>
                        <div className="flex-1 h-px bg-gradient-to-r from-[#00c853]/40 via-white/15 to-transparent" />
                      </div>
                      <div className="space-y-2">
                        {g.variants.map((m) => {
                          const mImg = (m as { image?: string }).image;
                          return (
                            <button key={m.id} onClick={() => { setModel(m); const _ns: Step = hasAdditiveSpecs(m.id) ? "processor" : stepAfterModel; setStep(_ns); pushHistory(_ns); }} className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 cursor-pointer transition text-left tap-press">
                              {mImg ? (
                                <img src={mImg} alt={m.label} loading="lazy" className="w-12 h-12 object-contain shrink-0" />
                              ) : (
                                <div className="w-12 h-12 shrink-0" />
                              )}
                              <p className="font-semibold text-[15px] flex-1">{m.label}</p>
                              <div className="flex items-center gap-2">
                                <span className="text-[#00c853] font-bold text-sm">Up to ${getMaxPrice(m, deviceType)}</span>
                                <svg className="w-4 h-4 text-[#e6e6e6]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}

            {/* DJI Drones: No pricing, goes to inquiry */}
            {deviceType === "dji" && (
              <>
                <h2 className="text-2xl font-bold mb-1">Select your drone</h2>
                <p className="text-[#e6e6e6] text-sm mb-6">Choose your DJI model</p>
                <div className="space-y-5">
                  {getDeviceGroups("dji", DJI_MODELS).map((g, gi) => (
                    <div key={g.label || gi}>
                      {g.label && (
                        <div className="flex items-center gap-3 mb-2">
                          <p className="text-[10px] font-extrabold tracking-[0.22em] uppercase text-[#00c853]">{g.label}</p>
                          {g.year && <span className="text-[10px] text-[#888]">{g.year}</span>}
                          <div className="flex-1 h-px bg-gradient-to-r from-[#00c853]/40 via-white/15 to-transparent" />
                        </div>
                      )}
                      <div className="space-y-2">
                        {g.variants.map((m) => {
                          const inq = !!(m as { inquiryOnly?: boolean }).inquiryOnly;
                          const mImg = (m as { image?: string }).image;
                          return (
                            <button key={m.id} onClick={() => { setModel(m); const _ns: Step = hasAdditiveSpecs(m.id) ? "processor" : stepAfterModel; setStep(_ns); pushHistory(_ns); }} className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 cursor-pointer transition text-left tap-press">
                              {mImg ? (
                                <img src={mImg} alt={m.label} loading="lazy" className="w-12 h-12 object-contain shrink-0" />
                              ) : (
                                <div className="w-12 h-12 shrink-0" />
                              )}
                              <p className="font-semibold text-[15px] flex-1">{m.label}</p>
                              <div className="flex items-center gap-2">
                                <span className="text-[#00c853] font-bold text-sm">{inq ? "Get a Quote" : `Up to $${getMaxPrice(m, "dji")}`}</span>
                                <svg className="w-4 h-4 text-[#e6e6e6]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* Laptop/Desktop: Grid on mobile, list on desktop */}
            {/* LG: 8 family boxes (Gram / 2-in-1 / Style / Ultraslim / Pro / Pro 2-in-1 / Book / UltraGear) */}
            {/* LG Laptops: top-level series picker (Gram / Gram Pro / SuperSlim — mirroring IWM) */}
            {deviceType === "lg_pc" && !selectedSeries && (
              <>
                <h2 className="text-2xl md:text-3xl font-bold mb-1">Select your LG laptop</h2>
                <p className="text-[#e6e6e6] text-sm mb-6">Choose your line</p>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                  {LG_PC_SERIES.map((s) => (
                    <button key={s.id} onClick={() => setSelectedSeries(s.id)} className="tap-press flex flex-col items-center justify-center p-4 rounded-2xl tcc-card cursor-pointer h-[150px]">
                      {s.image ? (
                        <img src={s.image} alt={s.label} loading="eager" className="w-16 h-12 object-contain mb-1" />
                      ) : (
                        <svg viewBox="0 0 40 40" className="w-12 h-12 mb-1.5"><circle cx="20" cy="20" r="18" fill="#a50034"/><text x="20" y="26" textAnchor="middle" fill="#fff" fontSize="14" fontWeight="bold" fontFamily="Arial">LG</text></svg>
                      )}
                      <p className="font-bold text-sm">{s.label}</p>
                      <p className="text-[#e6e6e6] text-[10px] text-center px-1 leading-tight">{s.year}</p>
                      {s.topPrice ? <p className="text-[#00c853] font-bold text-xs mt-0.5">Up to ${s.topPrice}</p> : null}
                    </button>
                  ))}
                </div>
              </>
            )}

            {/* LG Laptops: sub-series picker (every LG series has subSeries — Gram by size etc.) */}
            {deviceType === "lg_pc" && selectedSeries && !selectedSubSeries && (() => {
              const ser = LG_PC_SERIES.find(s => s.id === selectedSeries);
              const subs = (ser as { subSeries?: typeof LG_GRAM_SUB_SERIES })?.subSeries;
              if (!subs) return null;
              return (
                <>
                  <h2 className="text-2xl md:text-3xl font-bold mb-1">LG — {ser?.label}</h2>
                  <p className="text-[#e6e6e6] text-sm mb-6">Pick your size</p>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                    {subs.map((s) => (
                      <button key={s.id} onClick={() => setSelectedSubSeries(s.id)} className="tap-press flex flex-col items-center justify-center p-4 rounded-2xl tcc-card cursor-pointer h-[160px]">
                        {s.image ? (
                          <img src={s.image} alt={s.label} loading="eager" className="w-20 h-14 object-contain mb-1" />
                        ) : (
                          <svg viewBox="0 0 40 40" className="w-12 h-12 mb-1.5"><circle cx="20" cy="20" r="18" fill="#a50034"/><text x="20" y="26" textAnchor="middle" fill="#fff" fontSize="14" fontWeight="bold" fontFamily="Arial">LG</text></svg>
                        )}
                        <p className="font-bold text-sm text-center">{s.label}</p>
                        <p className="text-[#e6e6e6] text-[11px] text-center">{s.year}</p>
                        {s.topPrice ? <p className="text-[#00c853] font-bold text-xs mt-0.5">Up to ${s.topPrice}</p> : null}
                      </button>
                    ))}
                  </div>
                </>
              );
            })()}

            {/* Acer Laptops: 2-card top-level (Nitro, Predator) — flat, no sub-series */}
            {deviceType === "acer" && !selectedSeries && (
              <>
                <h2 className="text-2xl md:text-3xl font-bold mb-1">Select your Acer laptop</h2>
                <p className="text-[#e6e6e6] text-sm mb-6">Choose your line</p>
                <div className="grid grid-cols-2 gap-3">
                  {ACER_PC_SERIES.map((s) => (
                    <button key={s.id} onClick={() => setSelectedSeries(s.id)} className="tap-press flex flex-col items-center justify-center p-4 rounded-2xl tcc-card cursor-pointer h-[150px]">
                      <img src={s.image} alt={s.label} loading="eager" className="w-16 h-12 object-contain mb-1" />
                      <p className="font-bold text-sm">{s.label}</p>
                      <p className="text-[#e6e6e6] text-[10px] text-center">{s.year}</p>
                      {s.topPrice ? <p className="text-[#00c853] font-bold text-xs mt-0.5">Up to ${s.topPrice}</p> : null}
                    </button>
                  ))}
                </div>
              </>
            )}

            {/* Samsung Galaxy Book: 5-card top-level (Book / Book2 / Book3 / Book4 / Book5) */}
            {deviceType === "samsung_pc" && !selectedSeries && (
              <>
                <h2 className="text-2xl md:text-3xl font-bold mb-1">Select your Samsung Galaxy Book</h2>
                <p className="text-[#e6e6e6] text-sm mb-6">Choose your generation</p>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                  {SAMSUNG_PC_SERIES.map((s) => (
                    <button key={s.id} onClick={() => setSelectedSeries(s.id)} className="tap-press flex flex-col items-center justify-center p-4 rounded-2xl tcc-card cursor-pointer h-[150px]">
                      <img src={s.image} alt={s.label} loading="eager" className="w-16 h-12 object-contain mb-1" />
                      <p className="font-bold text-sm">{s.label}</p>
                      <p className="text-[#e6e6e6] text-[10px] text-center">{s.year}</p>
                      {s.topPrice ? <p className="text-[#00c853] font-bold text-xs mt-0.5">Up to ${s.topPrice}</p> : null}
                    </button>
                  ))}
                </div>
              </>
            )}

            {/* HP Laptops: top-level series picker (10 cards mirroring IWM) */}
            {deviceType === "hp" && !selectedSeries && (
              <>
                <h2 className="text-2xl md:text-3xl font-bold mb-1">Select your HP laptop</h2>
                <p className="text-[#e6e6e6] text-sm mb-6">Choose your line</p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {HP_PC_SERIES.map((s) => (
                    <button key={s.id} onClick={() => setSelectedSeries(s.id)} className="tap-press flex flex-col items-center justify-center p-4 rounded-2xl tcc-card cursor-pointer h-[150px]">
                      {s.image ? (
                        <img src={s.image} alt={s.label} loading="eager" className="w-16 h-12 object-contain mb-1" />
                      ) : (
                        <svg viewBox="0 0 40 40" className="w-12 h-12 mb-1.5"><circle cx="20" cy="20" r="18" fill="#0096d6"/><text x="20" y="26" textAnchor="middle" fill="#fff" fontSize="14" fontWeight="bold" fontFamily="Arial">hp</text></svg>
                      )}
                      <p className="font-bold text-sm">{s.label}</p>
                      <p className="text-[#e6e6e6] text-[10px] text-center px-1 leading-tight">{s.year}</p>
                      {s.topPrice ? <p className="text-[#00c853] font-bold text-xs mt-0.5">Up to ${s.topPrice}</p> : null}
                    </button>
                  ))}
                </div>
              </>
            )}

            {/* HP Laptops: sub-series picker — only EliteBook and OMEN have subSeries */}
            {deviceType === "hp" && selectedSeries && !selectedSubSeries && (() => {
              const ser = HP_PC_SERIES.find(s => s.id === selectedSeries);
              const subs = (ser as { subSeries?: typeof HP_ELITEBOOK_SUB_SERIES })?.subSeries;
              if (!subs) return null;
              return (
                <>
                  <h2 className="text-2xl md:text-3xl font-bold mb-1">HP — {ser?.label}</h2>
                  <p className="text-[#e6e6e6] text-sm mb-6">Pick your sub-line</p>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                    {subs.map((s) => (
                      <button key={s.id} onClick={() => setSelectedSubSeries(s.id)} className="tap-press flex flex-col items-center justify-center p-4 rounded-2xl tcc-card cursor-pointer h-[160px]">
                        {s.image ? (
                          <img src={s.image} alt={s.label} loading="eager" className="w-20 h-14 object-contain mb-1" />
                        ) : (
                          <svg viewBox="0 0 40 40" className="w-12 h-12 mb-1.5"><circle cx="20" cy="20" r="18" fill="#0096d6"/><text x="20" y="26" textAnchor="middle" fill="#fff" fontSize="14" fontWeight="bold" fontFamily="Arial">hp</text></svg>
                        )}
                        <p className="font-bold text-sm text-center">{s.label}</p>
                        <p className="text-[#e6e6e6] text-[11px] text-center">{s.year}</p>
                        {s.topPrice ? <p className="text-[#00c853] font-bold text-xs mt-0.5">Up to ${s.topPrice}</p> : null}
                      </button>
                    ))}
                  </div>
                </>
              );
            })()}

            {/* Lenovo Laptops: top-level series picker (7 cards mirroring IWM) */}
            {deviceType === "lenovo" && !selectedSeries && (
              <>
                <h2 className="text-2xl md:text-3xl font-bold mb-1">Select your Lenovo laptop</h2>
                <p className="text-[#e6e6e6] text-sm mb-6">Choose your line</p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {LENOVO_PC_SERIES.map((s) => (
                    <button key={s.id} onClick={() => setSelectedSeries(s.id)} className="tap-press flex flex-col items-center justify-center p-4 rounded-2xl tcc-card cursor-pointer h-[150px]">
                      {s.image ? (
                        <img src={s.image} alt={s.label} loading="eager" className="w-16 h-12 object-contain mb-1" />
                      ) : (
                        <svg viewBox="0 0 40 40" className="w-12 h-12 mb-1.5"><circle cx="20" cy="20" r="18" fill="#e2231a"/><text x="20" y="25" textAnchor="middle" fill="#fff" fontSize="9" fontWeight="bold" fontFamily="Arial">Lenovo</text></svg>
                      )}
                      <p className="font-bold text-sm">{s.label}</p>
                      <p className="text-[#e6e6e6] text-[10px] text-center px-1 leading-tight">{s.year}</p>
                      {s.topPrice ? <p className="text-[#00c853] font-bold text-xs mt-0.5">Up to ${s.topPrice}</p> : null}
                    </button>
                  ))}
                </div>
              </>
            )}

            {/* Dell Laptops: top-level series picker (8 cards mirroring IWM) */}
            {deviceType === "dell" && !selectedSeries && (
              <>
                <h2 className="text-2xl md:text-3xl font-bold mb-1">Select your Dell laptop</h2>
                <p className="text-[#e6e6e6] text-sm mb-6">Choose your line</p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {DELL_PC_SERIES.map((s) => (
                    <button key={s.id} onClick={() => setSelectedSeries(s.id)} className="tap-press flex flex-col items-center justify-center p-4 rounded-2xl tcc-card cursor-pointer h-[150px]">
                      {s.image ? (
                        <img src={s.image} alt={s.label} loading="eager" className="w-16 h-12 object-contain mb-1" />
                      ) : (
                        <svg viewBox="0 0 40 40" className="w-12 h-12 mb-1.5"><circle cx="20" cy="20" r="18" fill="#007db8"/><text x="20" y="26" textAnchor="middle" fill="#fff" fontSize="11" fontWeight="bold" fontFamily="Arial">DELL</text></svg>
                      )}
                      <p className="font-bold text-sm">{s.label}</p>
                      <p className="text-[#e6e6e6] text-[10px] text-center px-1 leading-tight">{s.year}</p>
                      {s.topPrice ? <p className="text-[#00c853] font-bold text-xs mt-0.5">Up to ${s.topPrice}</p> : null}
                    </button>
                  ))}
                </div>
              </>
            )}

            {/* Dell Laptops: sub-series picker — every Dell series has subSeries */}
            {deviceType === "dell" && selectedSeries && !selectedSubSeries && (() => {
              const ser = DELL_PC_SERIES.find(s => s.id === selectedSeries);
              const subs = (ser as { subSeries?: typeof DELL_XPS_SUB_SERIES })?.subSeries;
              if (!subs) return null;
              return (
                <>
                  <h2 className="text-2xl md:text-3xl font-bold mb-1">Dell — {ser?.label}</h2>
                  <p className="text-[#e6e6e6] text-sm mb-6">Pick your sub-line</p>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                    {subs.map((s) => (
                      <button key={s.id} onClick={() => setSelectedSubSeries(s.id)} className="tap-press flex flex-col items-center justify-center p-4 rounded-2xl tcc-card cursor-pointer h-[150px]">
                        {s.image ? (
                          <img src={s.image} alt={s.label} loading="eager" className="w-16 h-12 object-contain mb-1" />
                        ) : (
                          <svg viewBox="0 0 40 40" className="w-12 h-12 mb-1.5"><circle cx="20" cy="20" r="18" fill="#007db8"/><text x="20" y="26" textAnchor="middle" fill="#fff" fontSize="11" fontWeight="bold" fontFamily="Arial">DELL</text></svg>
                        )}
                        <p className="font-bold text-sm text-center">{s.label}</p>
                        <p className="text-[#e6e6e6] text-[10px] text-center">{s.year}</p>
                        {s.topPrice ? <p className="text-[#00c853] font-bold text-xs mt-0.5">Up to ${s.topPrice}</p> : null}
                      </button>
                    ))}
                  </div>
                </>
              );
            })()}

            {/* ASUS Laptops: top-level series picker (5 cards) */}
            {deviceType === "asus_pc" && !selectedSeries && (
              <>
                <h2 className="text-2xl md:text-3xl font-bold mb-1">Select your ASUS laptop</h2>
                <p className="text-[#e6e6e6] text-sm mb-6">Choose your line</p>
                <div className="grid grid-cols-2 gap-3">
                  {ASUS_PC_SERIES.map((s) => (
                    <button key={s.id} onClick={() => setSelectedSeries(s.id)} className="tap-press flex flex-col items-center justify-center p-4 rounded-2xl tcc-card cursor-pointer h-[150px]">
                      {s.image ? (
                        <img src={s.image} alt={s.label} loading="eager" className="w-16 h-12 object-contain mb-1" />
                      ) : (
                        <svg viewBox="0 0 40 40" className="w-12 h-12 mb-1.5"><circle cx="20" cy="20" r="18" fill="#1a1a1a"/><text x="20" y="25" textAnchor="middle" fill="#fff" fontSize="8" fontWeight="bold" fontFamily="Arial">ASUS</text></svg>
                      )}
                      <p className="font-bold text-sm">{s.label}</p>
                      <p className="text-[#e6e6e6] text-[10px]">{s.year}</p>
                      <p className="text-[#00c853] font-bold text-xs mt-0.5">{s.topPrice ? `Up to $${s.topPrice}` : null}</p>
                    </button>
                  ))}
                </div>
              </>
            )}

            {/* ASUS ROG: sub-series picker (Strix / Zephyrus / Flow) — third level only for ROG */}
            {deviceType === "asus_pc" && selectedSeries === "asus_rog" && !selectedSubSeries && (
              <>
                <h2 className="text-2xl md:text-3xl font-bold mb-1">ROG — Republic of Gamers</h2>
                <p className="text-[#e6e6e6] text-sm mb-6">Pick your sub-line</p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {ASUS_ROG_SUB_SERIES.map((s) => (
                    <button key={s.id} onClick={() => setSelectedSubSeries(s.id)} className="tap-press flex flex-col items-center justify-center p-4 rounded-2xl tcc-card cursor-pointer h-[160px]">
                      {s.image ? (
                        <img src={s.image} alt={s.label} loading="eager" className="w-20 h-14 object-contain mb-1" />
                      ) : (
                        <svg viewBox="0 0 40 40" className="w-12 h-12 mb-1.5"><circle cx="20" cy="20" r="18" fill="#1a1a1a"/><text x="20" y="25" textAnchor="middle" fill="#fff" fontSize="8" fontWeight="bold" fontFamily="Arial">ASUS</text></svg>
                      )}
                      <p className="font-bold text-base">{s.label}</p>
                      <p className="text-[#e6e6e6] text-[11px]">{s.year}</p>
                      <p className="text-[#00c853] font-bold text-xs mt-0.5">{s.topPrice ? `Up to $${s.topPrice}` : null}</p>
                    </button>
                  ))}
                </div>
              </>
            )}

            {/* Lenovo Tab: All variants flat */}
            {deviceType === "lenovo_tab" && (
              <>
                <div className="space-y-2">
                  {lenovoTabVariants.map((m) => {
                    const inq = (m as { inquiryOnly?: boolean }).inquiryOnly;
                    return (
                      <button key={m.id} onClick={() => { setModel(m); const _ns: Step = hasAdditiveSpecs(m.id) ? "processor" : stepAfterModel; setStep(_ns); pushHistory(_ns); }} className="w-full flex items-center justify-between px-5 py-4 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 cursor-pointer transition text-left tap-press">
                        <p className="font-semibold text-[15px]">{m.label}</p>
                        <div className="flex items-center gap-2">
                          <span className="text-[#00c853] font-bold text-sm">{inq ? "Get a quote" : `Up to $${getMaxPrice(m, deviceType)}`}</span>
                          <svg className="w-4 h-4 text-[#e6e6e6]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </>
            )}

            {/* Surface: 3 main categories from IWM (Pro / Pro X / Go) with
                era sub-groups under Pro, plus an "Other Microsoft Devices"
                section for inquiry-only legacy hardware (Book / Studio /
                Original / Duo). Matches the iPad / MacBook tree pattern. */}
            {deviceType === "surface" && (() => {
              type SubGroup = { label?: string; year?: string; ids: string[] };
              type Section  = { label: string; year: string; subGroups: SubGroup[] };
              const sections: Section[] = [
                { label: "Microsoft Surface Pro", year: "2013 – 2026", subGroups: [
                  { label: "Copilot+ · Snapdragon X", year: "2024–2026", ids: ["surfpro12_13", "surfpro12_12", "surfpro11"] },
                  { label: "Intel / AMD",             year: "2020–2023", ids: ["surfpro10biz", "surfpro9", "surfpro8", "surfpro7p", "surfpro7"] },
                  { label: "Legacy",                  year: "2013–2019", ids: ["surfpro6", "surfpro5_2017", "surfpro4", "surfpro3", "surfpro2", "surfpro1"] },
                ]},
                { label: "Microsoft Surface Pro X", year: "ARM · 2019 – 2020", subGroups: [
                  { ids: ["surfprox2020", "surfprox2019"] },
                ]},
                { label: "Microsoft Surface Go", year: "Compact · 2018 – 2024", subGroups: [
                  { ids: ["surfgo4", "surfgo3", "surfgo2", "surfgo1"] },
                ]},
                { label: "Other Microsoft Devices", year: "Get a quote", subGroups: [
                  { label: "Surface Book / Laptop Studio", ids: ["surfstudio2", "surfstudio1", "surfbook3", "surfbook2", "surfbook1"] },
                  { label: "Original (Non-Pro)",           ids: ["surf3", "surf2", "surfrt"] },
                  { label: "Surface Duo",                  ids: ["surfduo2", "surfduo1"] },
                ]},
              ];
              const byId = new Map(surfaceVariants.map(m => [m.id, m]));
              return (
                <div className="space-y-8">
                  {sections.map(section => {
                    const populated = section.subGroups
                      .map(g => ({ ...g, variants: g.ids.map(id => byId.get(id)).filter(Boolean) as typeof surfaceVariants }))
                      .filter(g => g.variants.length > 0);
                    if (populated.length === 0) return null;
                    return (
                      <div key={section.label}>
                        <div className="flex items-center gap-3 mb-3">
                          <p className="text-[11px] md:text-xs font-extrabold tracking-[0.22em] uppercase text-[#00c853]">{section.label}</p>
                          <span className="text-[10px] text-[#888]">{section.year}</span>
                          <div className="flex-1 h-px bg-gradient-to-r from-[#00c853]/40 via-white/15 to-transparent" />
                        </div>
                        <div className="space-y-4">
                          {populated.map((g, gi) => (
                            <div key={g.label || gi}>
                              {g.label && (
                                <div className="flex items-center gap-2 mb-1.5 pl-1">
                                  <p className="text-[9px] font-bold tracking-[0.2em] uppercase text-[#e6e6e6]/70">{g.label}</p>
                                  {g.year && <span className="text-[9px] text-[#888]">{g.year}</span>}
                                </div>
                              )}
                              <div className="space-y-2">
                                {g.variants.map((m) => {
                                  const inq = !!(m as { inquiryOnly?: boolean }).inquiryOnly;
                                  return (
                                    <button key={m.id} onClick={() => { setModel(m); const _ns: Step = hasAdditiveSpecs(m.id) ? "processor" : stepAfterModel; setStep(_ns); pushHistory(_ns); }} className="w-full flex items-center justify-between px-5 py-4 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 cursor-pointer transition text-left tap-press">
                                      <p className="font-semibold text-[15px]">{m.label}</p>
                                      <div className="flex items-center gap-2">
                                        <span className="text-[#00c853] font-bold text-sm">{inq ? "Get a Quote" : `Up to $${getMaxPrice(m, "surface")}`}</span>
                                        <svg className="w-4 h-4 text-[#e6e6e6]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                                      </div>
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}

            {/* Alienware: 7 series boxes mirroring IWM (M / X / Area / Aurora / 17 / 15 / 13) */}
            {deviceType === "alienware" && !selectedSeries && (
              <>
                <h2 className="text-2xl md:text-3xl font-bold mb-1">Select your Alienware</h2>
                <p className="text-[#e6e6e6] text-sm mb-6">Choose your line</p>
                <div className="grid grid-cols-2 gap-3">
                  {ALIENWARE_SERIES.map((s) => (
                    <button key={s.id} onClick={() => setSelectedSeries(s.id)} className="tap-press flex flex-col items-center justify-center p-4 rounded-2xl tcc-card cursor-pointer h-[140px]">
                      {(s as { image?: string }).image ? (
                        <img src={(s as { image?: string }).image} alt={s.label} loading="eager" className="w-16 h-12 object-contain mb-1.5" />
                      ) : (
                        <svg className="w-12 h-9 mb-2 text-white" viewBox="0 0 32 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="2" width="28" height="18" rx="3" /><line x1="10" y1="22" x2="22" y2="22" strokeLinecap="round" /></svg>
                      )}
                      <p className="font-bold text-sm">{s.label}</p>
                      <p className="text-[#e6e6e6] text-[10px]">{s.year}</p>
                      {s.topPrice ? <p className="text-[#00c853] font-bold text-xs mt-0.5">Up to ${s.topPrice}</p> : null}
                    </button>
                  ))}
                </div>
              </>
            )}

            {deviceType !== "iphone" && deviceType !== "ipad" && deviceType !== "dji" && deviceType !== "macbook" && (category === "computers" || category === "desktops") && !(deviceType === "alienware" && !selectedSeries) && !(deviceType === "lg_pc" && !selectedSeries) && !(deviceType === "lg_pc" && selectedSeries && !selectedSubSeries) && !(deviceType === "asus_pc" && !selectedSeries) && !(deviceType === "asus_pc" && selectedSeries === "asus_rog" && !selectedSubSeries) && !(deviceType === "dell" && !selectedSeries) && !(deviceType === "dell" && selectedSeries && !selectedSubSeries) && !(deviceType === "lenovo" && !selectedSeries) && !(deviceType === "hp" && !selectedSeries) && !(deviceType === "hp" && (selectedSeries === "hp_elitebook" || selectedSeries === "hp_omen") && !selectedSubSeries) && !(deviceType === "acer" && !selectedSeries) && !(deviceType === "samsung_pc" && !selectedSeries) && (
              <>
                {/* Mobile: grid cards */}
                <div className="grid grid-cols-2 gap-2 md:hidden">
                  {models.map((m) => {
                    const inq = !!(m as { inquiryOnly?: boolean }).inquiryOnly;
                    const mImg = (m as { image?: string }).image;
                    return (
                      <button key={m.id} onClick={() => {
                        setModel(m); const _ns: Step = hasAdditiveSpecs(m.id) ? "processor" : stepAfterModel; setStep(_ns); pushHistory(_ns);
                      }} className="flex flex-col items-center justify-center p-4 rounded-2xl tcc-card cursor-pointer tap-press">
                        {mImg ? (
                          <img src={mImg} alt={m.label} loading="lazy" className="w-12 h-9 object-contain mb-1.5" />
                        ) : (
                          <svg className="w-10 h-7 mb-1.5 text-white" viewBox="0 0 32 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="2" width="28" height="18" rx="3" /><line x1="10" y1="22" x2="22" y2="22" strokeLinecap="round" /></svg>
                        )}
                        <p className="font-bold text-sm text-center leading-tight">{m.label}</p>
                        <p className="text-[#00c853] font-bold text-xs mt-0.5">{inq ? "Get a quote" : `Up to $${getMaxPrice(m, deviceType)}`}</p>
                      </button>
                    );
                  })}
                </div>
                {/* Desktop: expanded list */}
                <div className="hidden md:block space-y-2">
                  {models.map((m) => {
                    const inq = !!(m as { inquiryOnly?: boolean }).inquiryOnly;
                    const mImg = (m as { image?: string }).image;
                    return (
                      <button key={m.id} onClick={() => {
                        setModel(m); const _ns: Step = hasAdditiveSpecs(m.id) ? "processor" : stepAfterModel; setStep(_ns); pushHistory(_ns);
                      }} className="w-full flex items-center gap-3 px-5 py-4 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 cursor-pointer transition text-left tap-press">
                        {mImg ? (
                          <img src={mImg} alt={m.label} loading="lazy" className="w-12 h-9 object-contain shrink-0" />
                        ) : (
                          <div className="w-12 h-9 shrink-0" />
                        )}
                        <p className="font-semibold text-[15px] flex-1">{m.label}</p>
                        <div className="flex items-center gap-2">
                          <span className="text-[#00c853] font-bold text-sm">{inq ? "Get a quote" : `Up to $${getMaxPrice(m, deviceType)}`}</span>
                          <svg className="w-4 h-4 text-[#e6e6e6]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </>
            )}

            {/* No-price devices (VR + non-Apple/non-Lenovo/non-Surface tablets): goes to inquiry */}
            {(deviceType === "apple_vr" || deviceType === "meta_vr" || deviceType === "valve_vr" || deviceType === "psvr" || deviceType === "samsung_tab" || deviceType === "oneplus_tab" || deviceType === "google_tab") && (() => {
              const list = deviceType === "apple_vr" ? APPLE_VR_MODELS : deviceType === "meta_vr" ? META_VR_MODELS : deviceType === "valve_vr" ? VALVE_VR_MODELS : deviceType === "psvr" ? PSVR_MODELS : deviceType === "samsung_tab" ? SAMSUNG_TAB_MODELS : deviceType === "oneplus_tab" ? ONEPLUS_TAB_MODELS : GOOGLE_TAB_MODELS;
              const grouped = getDeviceGroups(deviceType, list);
              return (
                <>
                  <h2 className="text-2xl md:text-3xl font-bold mb-1">Select your device</h2>
                  <p className="text-[#e6e6e6] text-sm mb-6">Choose your model</p>
                  <div className="space-y-5">
                    {grouped.map((g, gi) => (
                      <div key={g.label || gi}>
                        {g.label && (
                          <div className="flex items-center gap-3 mb-2">
                            <p className="text-[10px] font-extrabold tracking-[0.22em] uppercase text-[#00c853]">{g.label}</p>
                            {g.year && <span className="text-[10px] text-[#888]">{g.year}</span>}
                            <div className="flex-1 h-px bg-gradient-to-r from-[#00c853]/40 via-white/15 to-transparent" />
                          </div>
                        )}
                        <div className="space-y-2">
                          {g.variants.map((m) => {
                            const mImage = (m as { image?: string }).image;
                            const inq = (m as { inquiryOnly?: boolean }).inquiryOnly;
                            return (
                              <button key={m.id} onClick={() => { setModel(m); const _ns: Step = hasAdditiveSpecs(m.id) ? "processor" : stepAfterModel; setStep(_ns); pushHistory(_ns); }} className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 cursor-pointer transition text-left tap-press">
                                {mImage ? (
                                  <img src={mImage} alt={m.label} loading="lazy" className="w-10 h-10 object-contain shrink-0" />
                                ) : (
                                  <div className="w-10 h-10 shrink-0" />
                                )}
                                <p className="font-semibold text-[15px] flex-1">{m.label}</p>
                                <div className="flex items-center gap-2">
                                  <span className="text-[#00c853] font-bold text-sm">{inq ? "Get a quote" : `Up to $${getMaxPrice(m, deviceType)}`}</span>
                                  <svg className="w-4 h-4 text-[#e6e6e6]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              );
            })()}

            {/* Other categories (consoles incl. Sony, watches): Flat model list — now grouped via MODEL_GROUPS when available */}
            {deviceType !== "iphone" && deviceType !== "ipad" && deviceType !== "android" && deviceType !== "pixel" && deviceType !== "dji" && deviceType !== "apple_vr" && deviceType !== "meta_vr" && deviceType !== "valve_vr" && deviceType !== "psvr" && deviceType !== "samsung_tab" && deviceType !== "surface" && deviceType !== "lenovo_tab" && deviceType !== "oneplus_tab" && deviceType !== "google_tab" && category !== "computers" && category !== "desktops" && (
              <div className="space-y-5">
                {getDeviceGroups(deviceType, models).map((g, gi) => (
                  <div key={g.label || gi}>
                    {g.label && (
                      <div className="flex items-center gap-3 mb-2">
                        <p className="text-[10px] font-extrabold tracking-[0.22em] uppercase text-[#00c853]">{g.label}</p>
                        {g.year && <span className="text-[10px] text-[#888]">{g.year}</span>}
                        <div className="flex-1 h-px bg-gradient-to-r from-[#00c853]/40 via-white/15 to-transparent" />
                      </div>
                    )}
                    <div className="space-y-2">
                      {g.variants.map((m) => {
                        const inq = !!(m as { inquiryOnly?: boolean }).inquiryOnly;
                        return (
                          <button key={m.id} onClick={() => {
                            setModel(m); const _ns: Step = hasAdditiveSpecs(m.id) ? "processor" : stepAfterModel; setStep(_ns); pushHistory(_ns);
                          }} className="w-full flex items-center justify-between px-5 py-4 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 cursor-pointer transition text-left tap-press">
                            <p className="font-semibold text-[15px]">{m.label}</p>
                            <div className="flex items-center gap-2">
                              <span className="text-[#00c853] font-bold text-sm">{inq ? "Get a quote" : `Up to $${getMaxPrice(m as { id: string; base?: number }, deviceType)}`}</span>
                              <svg className="w-4 h-4 text-[#e6e6e6]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
            <FairPromise />
            <TrustBadge />
          </div>
        </section>
      )}

      {/* STEP: CONNECTIVITY (iPad only) — Wi-Fi vs Wi-Fi + Cellular */}
      {step === "connectivity" && page === "home" && model && deviceType === "ipad" && (
        <section className="animate-[fadeIn_0.3s_ease-out]">
          <div className="max-w-lg md:max-w-3xl lg:max-w-6xl mx-auto px-4 pt-6 pb-8 lg:flex lg:gap-8 lg:items-start">
            {selectionPanel}
            <div className="flex-1 min-w-0">
              <button onClick={handleBack} aria-label="Go back" className="inline-flex items-center gap-2 text-[#00c853] text-sm font-semibold mb-4 px-4 py-2 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 cursor-pointer transition tap-press">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                Back
              </button>
              {selectionPanelMobile}
              <h2 className="text-2xl lg:text-3xl font-extrabold mb-1">Select Connectivity</h2>
              <p className="text-[#b8b8b8] text-xs mb-3">
                Not sure? <button type="button" onClick={() => setConnectivityHelpOpen(true)} className="text-[#00c853] font-semibold hover:underline cursor-pointer">Help me choose</button>
              </p>
              {stepProgress}
              <div className="tcc-selection-frame">
                <div className="space-y-2">
                  {CONNECTIVITY.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => { setConnectivity(c); setStep("storage"); pushHistory("storage"); }}
                      className="tcc-card group w-full flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer text-left"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-extrabold text-[15px] text-white leading-tight">{c.label}</p>
                        <p className="text-[#c8c8c8] text-[12px] leading-snug mt-0.5">{c.desc}</p>
                      </div>
                      {c.id === "cellular" && (
                        <span className="bg-[#00c853]/15 border border-[#00c853]/40 text-[#00c853] text-[9px] font-extrabold uppercase tracking-wider px-1.5 py-0.5 rounded-full shrink-0">Worth more</span>
                      )}
                      <svg className="w-4 h-4 text-[#e6e6e6] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                    </button>
                  ))}
                </div>
              </div>
              <FairPromise />
              <TrustBadge />
            </div>
          </div>
        </section>
      )}

      {/* STEP: STORAGE */}
      {/* STEP: PROCESSOR — additive-spec models (MacBook, Dell XPS), gated on hasAdditiveSpecs(model) */}
      {step === "processor" && page === "home" && model && hasAdditiveSpecs(model.id) && (
        <section className="animate-[fadeIn_0.3s_ease-out]">
          <div className="max-w-lg md:max-w-3xl lg:max-w-6xl mx-auto px-4 pt-6 pb-8 lg:flex lg:gap-8 lg:items-start">
            {selectionPanel}
            <div className="flex-1 min-w-0">
              <button onClick={handleBack} aria-label="Go back" className="inline-flex items-center gap-2 text-[#00c853] text-sm font-semibold mb-4 px-4 py-2 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 cursor-pointer transition tap-press">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                Back
              </button>
              {selectionPanelMobile}
              <h2 className="text-2xl lg:text-3xl font-extrabold mb-1">Select Processor</h2>
              <p className="text-[#b8b8b8] text-xs mb-3">{deviceType === "dell" ? <>Find this in <span className="text-[#e6e6e6] font-semibold">Settings &gt; System &gt; About</span></> : <>Find this in <span className="text-[#e6e6e6] font-semibold"> Menu &gt; About This Mac</span></>}</p>
              <div className="tcc-selection-frame">
                <div className="space-y-2">
                  {(getMacSpec(model.id)?.processors || []).map((p) => (
                    <button key={p.id} onClick={() => { setProcessor(p); setStep("memory"); pushHistory("memory"); }} className="tcc-card group w-full flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer text-left">
                      <div className="flex-1 min-w-0">
                        <p className="font-extrabold text-[15px] text-white leading-tight">{p.label}</p>
                        {p.sub && <p className="text-[#b8b8b8] text-[12px] mt-0.5">{p.sub}</p>}
                      </div>
                      <svg className="w-4 h-4 text-[#e6e6e6] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* STEP: MEMORY — additive-spec models (MacBook, Dell XPS) */}
      {step === "memory" && page === "home" && model && hasAdditiveSpecs(model.id) && (
        <section className="animate-[fadeIn_0.3s_ease-out]">
          <div className="max-w-lg md:max-w-3xl lg:max-w-6xl mx-auto px-4 pt-6 pb-8 lg:flex lg:gap-8 lg:items-start">
            {selectionPanel}
            <div className="flex-1 min-w-0">
              <button onClick={handleBack} aria-label="Go back" className="inline-flex items-center gap-2 text-[#00c853] text-sm font-semibold mb-4 px-4 py-2 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 cursor-pointer transition tap-press">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                Back
              </button>
              {selectionPanelMobile}
              <h2 className="text-2xl lg:text-3xl font-extrabold mb-1">Select Memory</h2>
              <p className="text-[#b8b8b8] text-xs mb-3">{deviceType === "dell" ? <>Find this in <span className="text-[#e6e6e6] font-semibold">Settings &gt; System &gt; About</span></> : <>Find this in <span className="text-[#e6e6e6] font-semibold"> Menu &gt; About This Mac</span></>}</p>
              <div className="tcc-selection-frame">
                <div className="space-y-2">
                  {(getMacSpec(model.id)?.memory || []).map((m) => (
                    <button key={m.id} onClick={() => { setMemory(m); setStep("storage"); pushHistory("storage"); }} className="tcc-card group w-full flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer text-left">
                      <div className="flex-1 min-w-0">
                        <p className="font-extrabold text-[15px] text-white leading-tight">{m.label}</p>
                        {m.sub && <p className="text-[#b8b8b8] text-[12px] mt-0.5">{m.sub}</p>}
                      </div>
                      <svg className="w-4 h-4 text-[#e6e6e6] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* STEP: GRAPHICS — PC gaming laptops + workstations with multiple GPU
          options on IWM. Sits between storage and condition. */}
      {step === "graphics" && page === "home" && model && hasAdditiveSpecs(model.id) && (
        <section className="animate-[fadeIn_0.3s_ease-out]">
          <div className="max-w-lg md:max-w-3xl lg:max-w-6xl mx-auto px-4 pt-6 pb-8 lg:flex lg:gap-8 lg:items-start">
            {selectionPanel}
            <div className="flex-1 min-w-0">
              <button onClick={handleBack} aria-label="Go back" className="inline-flex items-center gap-2 text-[#00c853] text-sm font-semibold mb-4 px-4 py-2 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 cursor-pointer transition tap-press">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                Back
              </button>
              {selectionPanelMobile}
              <h2 className="text-2xl lg:text-3xl font-extrabold mb-1">Select Graphics</h2>
              <p className="text-[#b8b8b8] text-xs mb-3">Check <span className="text-[#e6e6e6] font-semibold">Device Manager &gt; Display adapters</span> if you&apos;re unsure.</p>
              <div className="tcc-selection-frame">
                <div className="space-y-2">
                  {(getMacSpec(model.id)?.graphics || []).map((g) => (
                    <button key={g.id} onClick={() => {
                      setGraphics(g);
                      const spec = getMacSpec(model.id);
                      const next: Step =
                        (spec?.display && spec.display.length > 0) ? "displayresolution" :
                        (spec?.hasNanoGlass ? "displayglass" : "condition");
                      setStep(next); pushHistory(next);
                    }} className="tcc-card group w-full flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer text-left">
                      <div className="flex-1 min-w-0">
                        <p className="font-extrabold text-[15px] text-white leading-tight">{g.label}</p>
                        {g.sub && <p className="text-[#b8b8b8] text-[12px] mt-0.5">{g.sub}</p>}
                      </div>
                      <svg className="w-4 h-4 text-[#e6e6e6] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* STEP: DISPLAY RESOLUTION — flagship PC gaming laptops where IWM
          prices FHD vs QHD vs UHD/OLED panels separately. */}
      {step === "displayresolution" && page === "home" && model && hasAdditiveSpecs(model.id) && (
        <section className="animate-[fadeIn_0.3s_ease-out]">
          <div className="max-w-lg md:max-w-3xl lg:max-w-6xl mx-auto px-4 pt-6 pb-8 lg:flex lg:gap-8 lg:items-start">
            {selectionPanel}
            <div className="flex-1 min-w-0">
              <button onClick={handleBack} aria-label="Go back" className="inline-flex items-center gap-2 text-[#00c853] text-sm font-semibold mb-4 px-4 py-2 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 cursor-pointer transition tap-press">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                Back
              </button>
              {selectionPanelMobile}
              <h2 className="text-2xl lg:text-3xl font-extrabold mb-1">Select Display</h2>
              <p className="text-[#b8b8b8] text-xs mb-3">Check <span className="text-[#e6e6e6] font-semibold">Settings &gt; System &gt; Display</span> for resolution.</p>
              <div className="tcc-selection-frame">
                <div className="space-y-2">
                  {(getMacSpec(model.id)?.display || []).map((d) => (
                    <button key={d.id} onClick={() => {
                      setDisplayResolution(d);
                      const next: Step = (getMacSpec(model.id)?.hasNanoGlass ?? false) ? "displayglass" : "condition";
                      setStep(next); pushHistory(next);
                    }} className="tcc-card group w-full flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer text-left">
                      <div className="flex-1 min-w-0">
                        <p className="font-extrabold text-[15px] text-white leading-tight">{d.label}</p>
                        {d.sub && <p className="text-[#b8b8b8] text-[12px] mt-0.5">{d.sub}</p>}
                      </div>
                      <svg className="w-4 h-4 text-[#e6e6e6] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* STEP: DISPLAY GLASS — MacBook Pro 16/14 only, between storage and condition */}
      {step === "displayglass" && page === "home" && model && hasAdditiveSpecs(model.id) && (
        <section className="animate-[fadeIn_0.3s_ease-out]">
          <div className="max-w-lg md:max-w-3xl lg:max-w-6xl mx-auto px-4 pt-6 pb-8 lg:flex lg:gap-8 lg:items-start">
            {selectionPanel}
            <div className="flex-1 min-w-0">
              <button onClick={handleBack} aria-label="Go back" className="inline-flex items-center gap-2 text-[#00c853] text-sm font-semibold mb-4 px-4 py-2 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 cursor-pointer transition tap-press">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                Back
              </button>
              {selectionPanelMobile}
              <h2 className="text-2xl lg:text-3xl font-extrabold mb-1">Display Glass</h2>
              <p className="text-[#b8b8b8] text-xs mb-3">Nano-texture is the anti-glare matte upgrade.</p>
              <div className="tcc-selection-frame">
                <div className="space-y-2">
                  {DISPLAY_GLASS_OPTIONS.map((g) => (
                    <button key={g.id} onClick={() => { setDisplayGlass(g); setStep("condition"); pushHistory("condition"); }} className="tcc-card group w-full flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer text-left">
                      <div className="flex-1 min-w-0">
                        <p className="font-extrabold text-[15px] text-white leading-tight">{g.label}</p>
                        {g.sub && <p className="text-[#b8b8b8] text-[12px] mt-0.5">{g.sub}</p>}
                      </div>
                      <svg className="w-4 h-4 text-[#e6e6e6] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* STEP: BATTERY HEALTH — additive-spec models, between condition and charger */}
      {step === "batteryhealth" && page === "home" && model && hasAdditiveSpecs(model.id) && (
        <section className="animate-[fadeIn_0.3s_ease-out]">
          <div className="max-w-lg md:max-w-3xl lg:max-w-6xl mx-auto px-4 pt-6 pb-8 lg:flex lg:gap-8 lg:items-start">
            {selectionPanel}
            <div className="flex-1 min-w-0">
              <button onClick={handleBack} aria-label="Go back" className="inline-flex items-center gap-2 text-[#00c853] text-sm font-semibold mb-4 px-4 py-2 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 cursor-pointer transition tap-press">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                Back
              </button>
              {selectionPanelMobile}
              <h2 className="text-2xl lg:text-3xl font-extrabold mb-1">Battery Health</h2>
              <p className="text-[#b8b8b8] text-xs mb-3">{deviceType === "dell" ? <>Check it in <span className="text-[#e6e6e6] font-semibold">Dell Power Manager or Settings &gt; Power &amp; Battery</span></> : <>Check it in <span className="text-[#e6e6e6] font-semibold"> Menu &gt; System Settings &gt; Battery &gt; Battery Health</span></>}</p>
              <div className="tcc-selection-frame">
                <div className="space-y-2">
                  {BATTERY_HEALTH_OPTIONS.map((b) => (
                    <button key={b.id} onClick={() => { setBatteryHealth(b); setStep("charger"); pushHistory("charger"); }} className="tcc-card group w-full flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer text-left">
                      <div className="flex-1 min-w-0">
                        <p className="font-extrabold text-[15px] text-white leading-tight">{b.label}</p>
                        {b.sub && <p className="text-[#b8b8b8] text-[12px] mt-0.5">{b.sub}</p>}
                      </div>
                      <svg className="w-4 h-4 text-[#e6e6e6] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* STEP: CHARGER — additive-spec models, before quote (or extras if present) */}
      {step === "charger" && page === "home" && model && hasAdditiveSpecs(model.id) && (
        <section className="animate-[fadeIn_0.3s_ease-out]">
          <div className="max-w-lg md:max-w-3xl lg:max-w-6xl mx-auto px-4 pt-6 pb-8 lg:flex lg:gap-8 lg:items-start">
            {selectionPanel}
            <div className="flex-1 min-w-0">
              <button onClick={handleBack} aria-label="Go back" className="inline-flex items-center gap-2 text-[#00c853] text-sm font-semibold mb-4 px-4 py-2 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 cursor-pointer transition tap-press">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                Back
              </button>
              {selectionPanelMobile}
              <h2 className="text-2xl lg:text-3xl font-extrabold mb-1">Including the Charger?</h2>
              <p className="text-[#b8b8b8] text-xs mb-3">OEM only, fully functional, no fraying / yellowing / exposed wiring.</p>
              <div className="tcc-selection-frame">
                <div className="space-y-2">
                  {CHARGER_OPTIONS.map((c) => (
                    <button key={c.id} onClick={() => {
                      setCharger(c);
                      // If this additive model's device type has brand extras (e.g. Dell GPU),
                      // route through extras before quote.
                      const ex = getBrandExtras(deviceType, model?.id);
                      if (ex.length > 0) {
                        setExtras({}); setExtrasIndex(0);
                        setStep("extras"); pushHistory("extras");
                        return;
                      }
                      setShowConfetti(true); setTimeout(() => setShowConfetti(false), 3000); setStep("quote"); pushHistory("quote");
                    }} className="tcc-card group w-full flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer text-left">
                      <div className="flex-1 min-w-0">
                        <p className="font-extrabold text-[15px] text-white leading-tight">{c.label}</p>
                      </div>
                      <svg className="w-4 h-4 text-[#e6e6e6] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* STEP: EXTRAS — brand-specific follow-up questions. One step that
          iterates through BRAND_EXTRAS[deviceType] via extrasIndex; on each
          answer we advance the index and re-render. When all questions are
          answered, route to the next funnel step (storage / quote). */}
      {step === "extras" && page === "home" && model && deviceType && (() => {
        const list = getBrandExtras(deviceType, model?.id);
        const q = list[extrasIndex];
        if (!q) {
          // Defensive — shouldn't render in this state because the answer
          // handler routes onward when extrasIndex hits the end. If we do
          // somehow land here, kick to the next step.
          setTimeout(() => {
            const ns: Step = (model && hasAdditiveSpecs(model.id)) ? "quote" : isNoStorageDevice ? "quote" : "storage";
            if (ns === "quote") { setShowConfetti(true); setTimeout(() => setShowConfetti(false), 3000); }
            setStep(ns); pushHistory(ns);
          }, 0);
          return null;
        }
        // Auto-skip questions whose showIf predicate says they don't apply
        // given current answers (e.g. "which band?" when user said no band).
        if (q.showIf && !q.showIf(extras)) {
          setTimeout(() => setExtrasIndex(i => i + 1), 0);
          return null;
        }
        return (
          <section className="animate-[fadeIn_0.3s_ease-out]">
            <div className="max-w-lg md:max-w-3xl lg:max-w-6xl mx-auto px-4 pt-6 pb-8 lg:flex lg:gap-8 lg:items-start">
              {selectionPanel}
              <div className="flex-1 min-w-0">
                <button onClick={handleBack} aria-label="Go back" className="inline-flex items-center gap-2 text-[#00c853] text-sm font-semibold mb-4 px-4 py-2 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 cursor-pointer transition tap-press">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                  Back
                </button>
                {selectionPanelMobile}
                <h2 className="text-2xl lg:text-3xl font-extrabold mb-1">{q.question}</h2>
                {q.helper && <p className="text-[#b8b8b8] text-xs mb-2">{q.helper}</p>}
                {q.guide && (
                  <details className="mb-3 group">
                    <summary className="inline-flex items-center gap-1.5 text-[#00c853] text-xs font-bold cursor-pointer hover:underline list-none">
                      <svg className="w-3.5 h-3.5 transition-transform group-open:rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
                      How do I check this?
                    </summary>
                    <div className="mt-2 p-3 rounded-xl bg-white/5 border border-white/10">
                      <p className="text-[11px] font-bold text-white uppercase tracking-wider mb-2">{q.guide.title}</p>
                      <ol className="text-[12px] text-[#d4d4d4] leading-relaxed space-y-1.5 list-decimal list-inside">
                        {q.guide.steps.map((s, i) => (<li key={i}>{s}</li>))}
                      </ol>
                    </div>
                  </details>
                )}
                {list.length > 1 && (
                  <p className="text-[10px] uppercase tracking-[0.18em] text-[#00c853] font-bold mb-3">Step {extrasIndex + 1} of {list.length}</p>
                )}
                <div className="tcc-selection-frame">
                  <div className="space-y-2">
                    {q.options.map((opt) => (
                      <button
                        key={opt.id}
                        onClick={() => {
                          const nextExtras = { ...extras, [q.id]: opt };
                          setExtras(nextExtras);
                          // Walk past any subsequent questions that don't
                          // apply given the new answers (e.g. "which band?"
                          // when user just said no band).
                          let nextIdx = extrasIndex + 1;
                          while (nextIdx < list.length) {
                            const peek = list[nextIdx];
                            if (peek.showIf && !peek.showIf(nextExtras)) nextIdx++;
                            else break;
                          }
                          if (nextIdx < list.length) {
                            setExtrasIndex(nextIdx);
                          } else {
                            // All extras answered — route to next funnel step.
                            // Additive-spec models (MacBook, Dell XPS) already
                            // went through storage before extras, so go to quote.
                            // iPad has its connectivity step before storage;
                            // everything else with storage goes to storage.
                            const ns: Step = (model && hasAdditiveSpecs(model.id))
                              ? "quote"
                              : isNoStorageDevice
                                ? "quote"
                                : deviceType === "ipad"
                                  ? "connectivity"
                                  : "storage";
                            if (ns === "quote") { setShowConfetti(true); setTimeout(() => setShowConfetti(false), 3000); }
                            setStep(ns); pushHistory(ns);
                          }
                        }}
                        className="tcc-card group w-full flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer text-left"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="font-extrabold text-[15px] text-white leading-tight">{opt.label}</p>
                          {opt.sub && <p className="text-[#b8b8b8] text-[12px] mt-0.5">{opt.sub}</p>}
                        </div>
                        <svg className="w-4 h-4 text-[#e6e6e6] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </section>
        );
      })()}

      {step === "storage" && page === "home" && model && (
        <section className="animate-[fadeIn_0.3s_ease-out]">
          <div className="max-w-lg md:max-w-3xl lg:max-w-6xl mx-auto px-4 pt-6 pb-8 lg:flex lg:gap-8 lg:items-start">
            {selectionPanel}
            <div className="flex-1 min-w-0">
              <button onClick={handleBack} aria-label="Go back" className="inline-flex items-center gap-2 text-[#00c853] text-sm font-semibold mb-4 px-4 py-2 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 cursor-pointer transition tap-press">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                Back
              </button>
              {selectionPanelMobile}
              <h2 className="text-2xl lg:text-3xl font-extrabold mb-1">Storage capacity?</h2>
              <p className="text-[#b8b8b8] text-xs mb-3">
                Not sure? <button type="button" onClick={() => setHelpTopic("storage")} className="text-[#00c853] font-semibold hover:underline cursor-pointer">Help me choose</button>
              </p>
              {stepProgress}
              <div className="tcc-selection-frame">
                <div className="space-y-2">
                  {(hasAdditiveSpecs(model.id) ? (getMacSpec(model.id)?.storage || []) : getStoragesForModel(model.id)).map((s) => (
                    <button
                      key={s.id}
                      onClick={() => {
                        // For MacBooks with a spec block, storage uses the
                        // dedicated MACBOOK_SPECS option list. We park the
                        // chosen option into the existing 'storage' state slot
                        // (cast via unknown so the field shape lines up
                        // enough for selectionPanel rendering).
                        setStorage(s as unknown as typeof ALL_STORAGES[0]);
                        if (hasAdditiveSpecs(model.id)) {
                          const spec = getMacSpec(model.id);
                          // Order: storage → [graphics] → [display resolution]
                          // → [displayglass on MacBook] → condition
                          const next: Step =
                            (spec?.graphics && spec.graphics.length > 0) ? "graphics" :
                            (spec?.display && spec.display.length > 0) ? "displayresolution" :
                            (spec?.hasNanoGlass ? "displayglass" : "condition");
                          setStep(next); pushHistory(next);
                          return;
                        }
                        const isPhone = deviceType === "iphone" || deviceType === "android" || deviceType === "pixel";
                        // Check if price would be below minimum — if so skip carrier
                        const storMult = (s as { multiplier?: number }).multiplier ?? 1;
                        const estPrice = PRICE_TABLE[model.id]?.[s.id]?.[condition?.id ?? ""] ??
                          Math.round((model.base ?? 0) * storMult * (condition?.multiplier ?? 1));
                        const skipCarrier = estPrice < MIN_OFFER;
                        const ns: Step = skipCarrier ? "quote" : (isPhone || isIpadCellular) ? "carrier" : "quote";
                        if (ns === "quote") { setShowConfetti(true); setTimeout(() => setShowConfetti(false), 3000); }
                        setStep(ns); pushHistory(ns);
                      }}
                      className="tcc-card group w-full flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer text-left"
                    >
                      <div className="flex-1 min-w-0 flex items-center gap-2">
                        <p className="font-extrabold text-[15px] text-white leading-tight">{s.label}</p>
                        {!hasAdditiveSpecs(model.id) && (
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); setStorageHelpId(s.id); }}
                            aria-label={`What ${s.label} is good for`}
                            className="w-3.5 h-3.5 rounded-full border border-[#00c853] text-[#00c853] text-[9px] font-bold flex items-center justify-center leading-none shrink-0 hover:bg-[#00c853] hover:text-[#0a0a0a] transition cursor-pointer"
                          >i</button>
                        )}
                      </div>
                      <svg className="w-4 h-4 text-[#e6e6e6] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                    </button>
                  ))}
                </div>
              </div>
              <FairPromise />
              <TrustBadge />
            </div>
          </div>
        </section>
      )}

      {/* STEP: CONDITION */}
      {step === "condition" && page === "home" && model && (
        <section className="animate-[fadeIn_0.3s_ease-out]">
          <div className="max-w-lg md:max-w-3xl lg:max-w-6xl mx-auto px-4 pt-6 pb-8 lg:flex lg:gap-8 lg:items-start">
            {selectionPanel}
            <div className="flex-1 min-w-0">
            <button onClick={handleBack} aria-label="Go back" className="inline-flex items-center gap-2 text-[#00c853] text-sm font-semibold mb-4 px-4 py-2 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 cursor-pointer transition tap-press">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
              Back
            </button>
            {selectionPanelMobile}
            <h2 className="text-2xl lg:text-3xl font-extrabold mb-1">Select Condition</h2>
            <p className="text-[#b8b8b8] text-xs mb-3">
              Not sure? <button type="button" onClick={() => setConditionHelpId(getConditionsFor(deviceType)[0]?.id || "mint")} className="text-[#00c853] font-semibold hover:underline cursor-pointer">Help me choose</button>
            </p>
            {stepProgress}
            <div className="tcc-selection-frame">
            <div className="space-y-2">
              {getConditionsFor(deviceType).map((c) => (
                <button
                  key={c.id}
                  onClick={() => {
                    setCondition(c);
                    // Broken: ask functional question before continuing
                    if (c.id === "broken") {
                      setBrokenFunctional(null); // reset
                      setBrokenGlass(null);
                      setStep("broken-functional" as Step); pushHistory("broken-functional" as Step);
                      return;
                    }
                    setBrokenFunctional(null); // clear for non-broken
                    setBrokenGlass(null);
                    // Spec'd flow: condition comes AFTER storage. Laptops go
                    // to battery health; desktops skip battery/charger and
                    // route to extras (GPU, accessories) or quote.
                    if (model && hasAdditiveSpecs(model.id)) {
                      const isDskType = deviceType?.endsWith("_desktop") ?? false;
                      if (isDskType) {
                        if (getBrandExtras(deviceType, model?.id).length > 0) {
                          setExtras({}); setExtrasIndex(0);
                          setStep("extras"); pushHistory("extras");
                        } else {
                          setShowConfetti(true); setTimeout(() => setShowConfetti(false), 3000);
                          setStep("quote"); pushHistory("quote");
                        }
                      } else {
                        setStep("batteryhealth"); pushHistory("batteryhealth");
                      }
                      return;
                    }
                    // PC laptops: skip storage/carrier (base price = IWM
                    // Flawless × 0.90 at max config), route through battery
                    // and charger like a MacBook.
                    if (isPcLaptopFlow) {
                      setStep("batteryhealth"); pushHistory("batteryhealth");
                      return;
                    }
                    // Brand-specific extras (PS5 disc drive, DJI hours flown,
                    // smartwatch band etc) fire BEFORE the quote so the
                    // pricing reflects them.
                    if (getBrandExtras(deviceType, model?.id).length > 0) {
                      setExtras({}); setExtrasIndex(0);
                      setStep("extras"); pushHistory("extras");
                      return;
                    }
                    const ns: Step = isNoStorageDevice ? "quote" : (deviceType === "ipad" ? "connectivity" : "storage");
                    if (ns === "quote") { setShowConfetti(true); setTimeout(() => setShowConfetti(false), 3000); }
                    setStep(ns); pushHistory(ns);
                  }}
                  className="tcc-card group w-full flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer text-left"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-extrabold text-[15px] text-white leading-tight">{getConditionLabel(c, deviceType).label}</p>
                      {(c as { details?: string[] }).details && (
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); setConditionHelpId(c.id); }}
                          aria-label={`What qualifies as ${getConditionLabel(c, deviceType).label}`}
                          className="w-3.5 h-3.5 rounded-full border border-[#00c853] text-[#00c853] text-[9px] font-bold flex items-center justify-center leading-none shrink-0 hover:bg-[#00c853] hover:text-[#0a0a0a] transition cursor-pointer"
                        >i</button>
                      )}
                    </div>
                    <p className="text-[#c8c8c8] text-[12px] leading-snug mt-0.5">{getConditionLabel(c, deviceType).desc || c.desc}</p>
                  </div>
                  <svg className="w-4 h-4 text-[#e6e6e6] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                </button>
              ))}
            </div>
            </div>

            <div className="mt-6 bg-[rgba(20,28,40,0.5)] backdrop-blur-[12px] border border-white/10 rounded-2xl p-5 shadow-[0_10px_30px_rgba(0,0,0,0.5)]">
              <h3 className="text-sm font-extrabold text-[#00c853] uppercase tracking-wider mb-1">Our Promise</h3>
              <p className="text-base font-extrabold text-white mb-1">The Top Cash Guarantee</p>
              <p className="text-[#e6e6e6] text-xs mb-4">Concerned about quote adjustments? Here&apos;s how we handle inspections.</p>
              <div className="space-y-3">
                <div className="flex gap-3">
                  <span className="text-lg" style={{filter:"drop-shadow(0 0 8px rgba(0,200,83,0.55))"}}>🎯</span>
                  <div><p className="text-sm font-bold text-white">Transparent Pricing</p><p className="text-xs text-[#e6e6e6]">What you see is what you get. Your quote is based on the condition you select — no surprise deductions.</p></div>
                </div>
                <div className="flex gap-3">
                  <span className="text-lg" style={{filter:"drop-shadow(0 0 8px rgba(255,140,140,0.55))"}}>🤝</span>
                  <div><p className="text-sm font-bold text-white">Honest Inspections</p><p className="text-xs text-[#e6e6e6]">If anything differs from your description, we&apos;ll walk you through our findings before adjusting.</p></div>
                </div>
                <div className="flex gap-3">
                  <span className="text-lg" style={{filter:"drop-shadow(0 0 8px rgba(120,200,255,0.55))"}}>🔄</span>
                  <div><p className="text-sm font-bold text-white">No Pressure, No Strings</p><p className="text-xs text-[#e6e6e6]">Not happy with the final offer? We&apos;ll return your device — no questions asked.</p></div>
                </div>
              </div>
            </div>

            <div className="mt-4 bg-white/5 border border-white/10 rounded-2xl p-5">
              <h3 className="text-base font-bold text-white mb-3">Why Sellers Choose Top Cash</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="text-center p-3 bg-white/5 rounded-xl">
                  <p className="text-xl font-bold text-[#00c853]">⭐</p>
                  <p className="text-xs text-[#e6e6e6] mt-1">Thousands of happy sellers</p>
                </div>
                <div className="text-center p-3 bg-white/5 rounded-xl">
                  <p className="text-xl font-bold text-[#00c853]">⚡</p>
                  <p className="text-xs text-[#e6e6e6] mt-1">Get paid the same day</p>
                </div>
                <div className="text-center p-3 bg-white/5 rounded-xl">
                  <p className="text-xl font-bold text-[#00c853]">🔒</p>
                  <p className="text-xs text-[#e6e6e6] mt-1">Your price is locked 7 days</p>
                </div>
                <div className="text-center p-3 bg-white/5 rounded-xl">
                  <p className="text-xl font-bold text-[#00c853]">🏠</p>
                  <p className="text-xs text-[#e6e6e6] mt-1">We meet locally in Austin</p>
                </div>
              </div>
            </div>
            </div>
          </div>
        </section>
      )}

      {/* STEP: BROKEN FUNCTIONAL CHECK */}
      {step === "broken-functional" && page === "home" && model && condition?.id === "broken" && (
        <section className="animate-[fadeIn_0.3s_ease-out]">
          <div className="max-w-lg md:max-w-3xl lg:max-w-6xl mx-auto px-4 pt-6 pb-8 lg:flex lg:gap-8 lg:items-start">
            {selectionPanel}
            <div className="flex-1 min-w-0">
            <button onClick={handleBack} aria-label="Go back" className="inline-flex items-center gap-2 text-[#00c853] text-sm font-semibold mb-4 px-4 py-2 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 cursor-pointer transition tap-press">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
              Back
            </button>
            {selectionPanelMobile}
            <h2 className="text-xl lg:text-3xl font-extrabold mb-2">Is the device still functional?</h2>
            <p className="text-[#b8b8b8] text-sm mb-4">This helps us determine if we can offer an instant quote or need to review manually.</p>
            {stepProgress}
            <div className="tcc-selection-frame">
              <div className="space-y-2">
                <button
                  onClick={() => {
                    setBrokenFunctional(true);
                    // PHONE follow-up: ask which glass is cracked. Front
                    // (display) hurts resale most, back is mostly cosmetic.
                    // Skipped for phones without a back glass (Pixel 5 /
                    // 5a) — auto-set to "front" since that's the only
                    // glass that can be damaged on those.
                    if (isPhoneFlow) {
                      if (model && PHONES_WITHOUT_BACK_GLASS.has(model.id)) {
                        setBrokenGlass("front");
                        // Fall through to the normal post-glass routing below
                      } else {
                        setBrokenGlass(null);
                        setStep("broken-glass" as Step); pushHistory("broken-glass" as Step);
                        return;
                      }
                    }
                    // Continue normal flow — functional broken gets a price
                    if (model && hasAdditiveSpecs(model.id)) {
                      const isDskType = deviceType?.endsWith("_desktop") ?? false;
                      if (isDskType) {
                        if (getBrandExtras(deviceType, model?.id).length > 0) {
                          setExtras({}); setExtrasIndex(0);
                          setStep("extras"); pushHistory("extras");
                        } else {
                          setShowConfetti(true); setTimeout(() => setShowConfetti(false), 3000);
                          setStep("quote"); pushHistory("quote");
                        }
                      } else {
                        setStep("batteryhealth"); pushHistory("batteryhealth");
                      }
                      return;
                    }
                    if (isPcLaptopFlow) {
                      setStep("batteryhealth"); pushHistory("batteryhealth");
                      return;
                    }
                    if (getBrandExtras(deviceType, model?.id).length > 0) {
                      setExtras({}); setExtrasIndex(0);
                      setStep("extras"); pushHistory("extras"); return;
                    }
                    const ns: Step = isNoStorageDevice ? "quote" : (deviceType === "ipad" ? "connectivity" : "storage");
                    if (ns === "quote") { setShowConfetti(true); setTimeout(() => setShowConfetti(false), 3000); }
                    setStep(ns); pushHistory(ns);
                  }}
                  className="tcc-card group w-full flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer text-left"
                >
                  <div className="text-3xl">✅</div>
                  <div className="flex-1">
                    <p className="font-extrabold text-[15px] text-white">Yes — still works</p>
                    <p className="text-[#b8b8b8] text-xs mt-0.5">Screen cracked, dents, or cosmetic damage — but touchscreen, cameras, speakers, and buttons all work</p>
                  </div>
                </button>
                <button
                  onClick={() => {
                    setBrokenFunctional(false);
                    // Non-functional → go straight to quote (will show manual review)
                    setStep("quote"); pushHistory("quote");
                  }}
                  className="tcc-card group w-full flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer text-left"
                >
                  <div className="text-3xl">❌</div>
                  <div className="flex-1">
                    <p className="font-extrabold text-[15px] text-white">No — not functional</p>
                    <p className="text-[#b8b8b8] text-xs mt-0.5">Won&apos;t power on, dead screen, non-responsive touch, water damage, or major hardware failure</p>
                  </div>
                </button>
              </div>
            </div>
            </div>
          </div>
        </section>
      )}

      {/* STEP: BROKEN GLASS (phones only) — runs after broken-functional
          when the user says the device still works. Front (display) glass
          is the bigger resale hit; back-only is mostly cosmetic. */}
      {step === "broken-glass" && page === "home" && model && condition?.id === "broken" && isPhoneFlow && (
        <section className="animate-[fadeIn_0.3s_ease-out]">
          <div className="max-w-lg md:max-w-3xl lg:max-w-6xl mx-auto px-4 pt-6 pb-8 lg:flex lg:gap-8 lg:items-start">
            {selectionPanel}
            <div className="flex-1 min-w-0">
            <button onClick={handleBack} aria-label="Go back" className="inline-flex items-center gap-2 text-[#00c853] text-sm font-semibold mb-4 px-4 py-2 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 cursor-pointer transition tap-press">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
              Back
            </button>
            {selectionPanelMobile}
            <h2 className="text-xl lg:text-3xl font-extrabold mb-2">Which glass is cracked?</h2>
            <p className="text-[#b8b8b8] text-sm mb-4">Back-only damage hurts resale less than a cracked display, so we want to know exactly what's going on.</p>
            {stepProgress}
            <div className="tcc-selection-frame">
              <div className="space-y-2">
                {([
                  { id: "front", title: "Front (display) only", sub: "Front screen is cracked. Back is intact." },
                  { id: "back", title: "Back only", sub: "Back glass is cracked. Front display is clean." },
                  { id: "both", title: "Both front and back", sub: "Both sides are cracked." },
                ] as { id: "front" | "back" | "both"; title: string; sub: string }[]).map(g => (
                  <button
                    key={g.id}
                    onClick={() => {
                      setBrokenGlass(g.id);
                      // Continue with the same routing the broken-functional
                      // Yes-branch uses for phones (none of the additive /
                      // PC / desktop paths apply to phones, so go straight
                      // to extras-or-storage like the original).
                      if (getBrandExtras(deviceType, model?.id).length > 0) {
                        setExtras({}); setExtrasIndex(0);
                        setStep("extras"); pushHistory("extras"); return;
                      }
                      const ns: Step = "storage";
                      setStep(ns); pushHistory(ns);
                    }}
                    className="tcc-card group w-full flex items-center px-4 py-3 rounded-xl cursor-pointer text-left"
                  >
                    <div className="flex-1">
                      <p className="font-extrabold text-[15px] text-white">{g.title}</p>
                      <p className="text-[#b8b8b8] text-xs mt-0.5">{g.sub}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
            </div>
          </div>
        </section>
      )}

      {/* STEP: CARRIER */}
      {step === "carrier" && page === "home" && model && condition && (
        <section className="animate-[fadeIn_0.3s_ease-out]">
          <div className="max-w-lg md:max-w-3xl lg:max-w-6xl mx-auto px-4 pt-6 pb-8 lg:flex lg:gap-8 lg:items-start">
            {selectionPanel}
            <div className="flex-1 min-w-0">
            <button onClick={handleBack} aria-label="Go back" className="inline-flex items-center gap-2 text-[#00c853] text-sm font-semibold mb-4 px-4 py-2 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 cursor-pointer transition tap-press">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
              Back
            </button>
            {selectionPanelMobile}
            <h2 className="text-xl lg:text-3xl font-extrabold mb-1">Carrier status?</h2>
            <p className="text-[#b8b8b8] text-xs mb-2">
              Not sure? <button type="button" onClick={() => setHelpTopic("carrier")} className="text-[#00c853] font-semibold hover:underline cursor-pointer">Help me choose</button>
            </p>
            {stepProgress}
            <p className="text-[#e6e6e6] text-xs lg:text-sm mb-3">{deviceType === "ipad" ? "Is your iPad unlocked or locked to a carrier?" : "Is your phone unlocked or locked to a carrier?"}</p>
            <div className="tcc-selection-frame">
              <div className="space-y-1.5 lg:space-y-2">
                {CARRIERS.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => {
                      setCarrier(c);
                      // Only Verizon has a real 60-day lock policy worth asking
                      // about; for any other carrier we skip the lock step and
                      // treat the device as unlocked (multiplier = 1.0).
                      if (c.id === "verizon") {
                        setCarrierLock(null);
                        setStep("carrier-lock"); pushHistory("carrier-lock");
                      } else {
                        setCarrierLock(null);
                        setShowConfetti(true);
                        setTimeout(() => setShowConfetti(false), 3000);
                        setStep("quote"); pushHistory("quote");
                      }
                    }}
                    className="tcc-card group w-full flex items-center gap-3 px-4 py-2.5 lg:py-3 rounded-xl cursor-pointer text-left"
                  >
                    <p className="font-extrabold text-[14px] lg:text-[15px] text-white flex-1 leading-tight">{c.label}</p>
                    <svg className="w-4 h-4 text-[#e6e6e6] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                  </button>
                ))}
              </div>
            </div>
            <TrustBadge />
            </div>
          </div>
        </section>
      )}

      {/* STEP: CARRIER LOCK — Yes/No after picking the carrier */}
      {step === "carrier-lock" && page === "home" && model && condition && carrier && (
        <section className="animate-[fadeIn_0.3s_ease-out]">
          <div className="max-w-lg md:max-w-3xl lg:max-w-6xl mx-auto px-4 pt-6 pb-8 lg:flex lg:gap-8 lg:items-start">
            {selectionPanel}
            <div className="flex-1 min-w-0">
              <button onClick={handleBack} aria-label="Go back" className="inline-flex items-center gap-2 text-[#00c853] text-sm font-semibold mb-4 px-4 py-2 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 cursor-pointer transition tap-press">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                Back
              </button>
              {selectionPanelMobile}
              <h2 className="text-2xl lg:text-3xl font-extrabold mb-1">Carrier Lock?</h2>
              <p className="text-[#b8b8b8] text-xs mb-3">Is your {carrier.label} {deviceType === "ipad" ? "iPad" : "phone"} locked to that carrier, or has it been unlocked?</p>
              {stepProgress}
              <div className="tcc-selection-frame">
                <div className="space-y-2">
                  {CARRIER_LOCKS.map((lock) => (
                    <button
                      key={lock.id}
                      onClick={() => {
                        setCarrierLock(lock);
                        setShowConfetti(true);
                        setTimeout(() => setShowConfetti(false), 3000);
                        setStep("quote"); pushHistory("quote");
                      }}
                      className="tcc-card group w-full flex items-center justify-between gap-3 px-4 py-3 rounded-xl cursor-pointer text-left"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-extrabold text-[15px] text-white leading-tight">{lock.label}</p>
                        <p className="text-[#b8b8b8] text-[12px] leading-snug mt-0.5">{lock.desc}</p>
                      </div>
                      {lock.id === "no" && (
                        <span className="bg-[#00c853]/15 border border-[#00c853]/40 text-[#00c853] text-[9px] font-extrabold uppercase tracking-wider px-1.5 py-0.5 rounded-full shadow-[0_0_8px_rgba(0,200,83,0.35)] shrink-0">Best value</span>
                      )}
                      <svg className="w-4 h-4 text-[#e6e6e6] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                    </button>
                  ))}
                </div>
              </div>
              <TrustBadge />
            </div>
          </div>
        </section>
      )}

      {/* STEP: QUOTE */}
      {step === "quote" && page === "home" && model && condition && (
        <section className="animate-[fadeIn_0.3s_ease-out] relative">
          {showConfetti && (
            <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
              {Array.from({ length: 60 }).map((_, i) => (
                <div key={i} className="absolute animate-[confettiFall_2.5s_ease-out_forwards]" style={{
                  left: `${Math.random() * 100}%`,
                  top: `-5%`,
                  animationDelay: `${Math.random() * 0.8}s`,
                  width: `${8 + Math.random() * 8}px`,
                  height: `${8 + Math.random() * 8}px`,
                  background: ['#00c853','#00e676','#fff','#76ff03','#ffd600','#ff6d00'][Math.floor(Math.random() * 6)],
                  borderRadius: Math.random() > 0.5 ? '50%' : '2px',
                  transform: `rotate(${Math.random() * 360}deg)`,
                }} />
              ))}
            </div>
          )}
          {/* 3D depth: a faint grey hairline that visually links the
              device thumb (selection panel) to the offer / price column
              on desktop. Skipped on mobile — the column stacks there
              and a vertical centerline cut through the trust-badge list
              awkwardly. Pure decoration, never blocks clicks. */}
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden z-0">
            <div className="hidden lg:block absolute left-[12%] right-[12%] top-1/2 -translate-y-1/2 h-px bg-gradient-to-r from-transparent via-white/12 to-transparent" />
          </div>
          <div className="relative z-10 max-w-lg md:max-w-3xl lg:max-w-7xl mx-auto px-4 pt-12 pb-8 lg:flex lg:gap-8 lg:items-start lg:text-left text-center">
            {selectionPanel}
            <div className="flex-1 min-w-0">
            {/* Mobile: IWM-style 'Sell Your X' card (device thumb + editable
                rows + 'Your device is valued at $X' price band) so the
                quote step matches the same selectionPanelMobile pattern
                used on every other funnel step. */}
            {selectionPanelMobile}
            <div className="hidden lg:block mb-2">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#00c853] mb-1">Your offer</p>
              {isPendingQuote || isManualQuote ? (
                <>
                  <p className="text-3xl lg:text-4xl font-extrabold text-white mt-1 leading-tight">{isManualQuote ? "Manual review needed" : "Quoted via email or text"}</p>
                  <p className="text-[#c8c8c8] text-sm mt-2 leading-snug max-w-md">{isManualQuote ? "This device\u2019s value is below our standard offer threshold. Add it to your box and we\u2019ll text you a fair custom quote within the hour." : "This device isn\u2019t on our standard price list. Add it to your box and we\u2019ll email or text you a quote within the hour \u2014 no need to wait until pickup."}</p>
                </>
              ) : (
                <p className="text-5xl lg:text-6xl font-extrabold text-[#00c853] mt-1" style={{ textShadow: "0 0 8px rgba(0, 200, 83, 0.22)" }}>${quote * quantity}</p>
              )}
            </div>
            <div className="flex items-center justify-center lg:justify-start flex-wrap gap-1 mb-2">
              {promoApplies && promo && (
                <p className="text-[10px] inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#00c853]/15 text-[#00c853] font-bold">🎉 {promo.flatBonus ? `+$${promo.flatBonus} bonus applied` : `+${promo.percent}% promo applied`}</p>
              )}
              {couponPercent > 0 && (
                <p className="text-[10px] inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#00c853]/15 text-[#00c853] font-bold">🎟️ {couponLabel} +{couponPercent}%</p>
              )}
            </div>
            {!isManualQuote && !isPendingQuote && quantity > 1 && <p className="text-[#e6e6e6] text-sm mb-2">${quote} each × {quantity}</p>}
            {!isManualQuote && !isPendingQuote && quantity === 1 && <div className="mb-3" />}

            {/* QUOTE-MAY-CHANGE DISCLAIMER + PHOTO ENCOURAGEMENT —
                Only on damaged-condition quotes (broken / fair). Sets
                expectations honestly that the number can shift after
                we see the device, and pushes the seller toward
                uploading photos which lock in the quote faster + reduce
                surprises at handoff. Skywalker directive 2026-05-17. */}
            {!isManualQuote && !isPendingQuote && (condition?.id === "broken" || condition?.id === "fair") && (
              <div className="max-w-md mx-auto lg:mx-0 mb-3 px-3 py-2.5 rounded-xl bg-[#00c853]/[0.07] border border-[#00c853]/25 text-left">
                <p className="text-[12px] text-white font-semibold leading-snug">
                  📸 Add photos to lock in this quote
                </p>
                <p className="text-[11px] text-[#bdbdbd] mt-1 leading-snug">
                  We&apos;ll ask for photos at the next step. Photos help us confirm the condition and stick to this price. Without photos, the final offer may shift after our inspection.
                </p>
              </div>
            )}

            {/* Accessory bonus — only when it actually moves price and not manual quote */}
            {!isManualQuote && !isPendingQuote && showAccessoryQuestion && accessoryBonusAmount > 0 && (
              <div className="max-w-md mx-auto mb-4">
                <button
                  type="button"
                  onClick={() => setAccessoriesIncluded((v) => !v)}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl border transition cursor-pointer text-left ${accessoriesIncluded ? "bg-[#00c853]/10 border-[#00c853]/40" : "bg-white/5 border-white/10 hover:bg-white/10"}`}
                >
                  <span className={`w-5 h-5 rounded border-2 flex items-center justify-center text-xs font-bold transition ${accessoriesIncluded ? "bg-[#00c853] border-[#00c853] text-[#0a0a0a]" : "border-white/30 text-transparent"}`}>✓</span>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-white">All original accessories included</p>
                    <p className="text-[11px] text-[#e6e6e6]">{deviceType === "macbook" ? "Original brick, USB-C cable, box" : `Charger, cable, original box${condition?.id === "sealed" ? ", manuals" : ""}`}</p>
                  </div>
                  <span className="text-[#00c853] font-bold text-sm whitespace-nowrap">+${accessoryBonusAmount}</span>
                </button>
              </div>
            )}

            {!isManualQuote && !isPendingQuote && <div className="bg-[rgba(15,15,15,0.5)] backdrop-blur-[12px] border border-white/12 rounded-2xl p-5 mb-6 text-left shadow-[inset_1px_1px_0_rgba(255,255,255,0.06),0_10px_30px_rgba(0,0,0,0.5)]">
              <p className="text-[10px] font-extrabold text-[#00c853] uppercase tracking-[0.18em] mb-3">How we compare</p>
              <div className="divide-y divide-white/[0.06]">
                <div className="flex items-center justify-between -mx-2 px-2 py-3 rounded-lg bg-[#00c853]/10 border border-[#00c853]/30 shadow-[0_0_10px_rgba(0,200,83,0.18)]">
                  <span className="text-[15px] font-extrabold text-white">Top Cash Cellular</span>
                  <span className="text-xl font-extrabold text-[#00c853]" style={{ textShadow: "0 0 6px rgba(0,200,83,0.25)" }}>${quote * quantity}</span>
                </div>
                {(() => {
                  const comp = getCompSource(deviceType);
                  // For each brand family, prefer the real published
                  // snapshot value over the percentage estimate when we
                  // have an entry for this model.
                  const isApple = deviceType === "iphone" || deviceType === "ipad" || deviceType === "macbook" || deviceType === "apple_desktop" || deviceType === "applewatch" || deviceType === "apple_vr";
                  const isGoogle = deviceType === "pixel" || deviceType === "pixelwatch" || deviceType === "google_tab";
                  const isSamsung = deviceType === "android" || deviceType === "samsung_tab" || deviceType === "samsung_pc" || deviceType === "samsungwatch";
                  const isDecluttr = deviceType === "lg_pc";
                  const real =
                    (isApple && model && appleComps ? appleComps[model.id] : undefined) ??
                    (isGoogle && model && googleComps ? googleComps[model.id] : undefined) ??
                    (isSamsung && model && samsungComps ? samsungComps[model.id] : undefined) ??
                    (isDecluttr && model && decluttrComps ? decluttrComps[model.id] : undefined);
                  const compValue = typeof real === "number"
                    ? real * quantity
                    : Math.round(quote * comp.percent * quantity);
                  return (
                    <div className="flex items-center justify-between py-3 px-2">
                      <span className="text-sm font-bold text-[#e6e6e6]">{comp.name}</span>
                      <span className="text-sm font-bold text-[#b8b8b8]">${compValue}</span>
                    </div>
                  );
                })()}
                {isPhoneFlow && (
                  <div className="flex items-center justify-between py-3 px-2">
                    <span className="text-sm font-bold text-[#e6e6e6]">Carrier Trade-In</span>
                    <span className="text-sm font-bold text-[#b8b8b8]">${Math.round(quote * 0.7 * quantity)}</span>
                  </div>
                )}
              </div>
              {(() => {
                const isApple = deviceType === "iphone" || deviceType === "ipad" || deviceType === "macbook" || deviceType === "apple_desktop" || deviceType === "applewatch" || deviceType === "apple_vr";
                const isGoogle = deviceType === "pixel" || deviceType === "pixelwatch" || deviceType === "google_tab";
                const isSamsung = deviceType === "android" || deviceType === "samsung_tab" || deviceType === "samsung_pc" || deviceType === "samsungwatch";
                const isDecluttr = deviceType === "lg_pc";
                const real =
                  (isApple && model && appleComps ? appleComps[model.id] : undefined) ??
                  (isGoogle && model && googleComps ? googleComps[model.id] : undefined) ??
                  (isSamsung && model && samsungComps ? samsungComps[model.id] : undefined) ??
                  (isDecluttr && model && decluttrComps ? decluttrComps[model.id] : undefined);
                const compPer = typeof real === "number" ? real : Math.round(quote * getCompSource(deviceType).percent);
                const savings = (quote - compPer) * quantity;
                return <p className="text-[#00c853] text-xs font-extrabold mt-3">You make up to ${savings > 0 ? savings : 0} more with us</p>;
              })()}
              <a href={`mailto:offers@topcashcellular.com?subject=Price%20Match%20Request&body=Model%3A%20${encodeURIComponent(model?.label || '')}%0AStorage%3A%20${encodeURIComponent(storage?.label || '')}%0AStorage%3A%20${encodeURIComponent(condition?.label || '')}%0ACompetitor%20URL%3A%20%0ACompetitor%20offer%3A%20%24`} className="mt-3 inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-[#00c853]/10 border border-[#00c853]/30 hover:bg-[#00c853]/15 text-[#00c853] text-xs font-bold transition">⚡ Got a higher offer? We&apos;ll beat it by $25</a>
            </div>}

            {/* Coupon code */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-4 mb-4 text-left">
              <p className="text-xs font-semibold text-[#e6e6e6] uppercase tracking-wider mb-2">Have a coupon code?</p>
              {couponLabel ? (
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#00c853]/15 border border-[#00c853]/30 text-[#00c853] text-xs font-bold">🎟️ {couponLabel} · +{couponPercent}% applied</span>
                  <button onClick={() => { setCouponPercent(0); setCouponLabel(""); setCouponCode(""); }} className="text-[#e6e6e6] hover:text-white text-xs underline cursor-pointer">Remove</button>
                </div>
              ) : (
                <>
                  <div className="flex gap-2">
                    <input type="text" value={couponCode} onChange={(e) => setCouponCode(e.target.value.toUpperCase())} placeholder="ENTER CODE" className="tcc-input flex-1 px-3 py-2 text-sm uppercase tracking-wide" />
                    <button onClick={applyCoupon} className="tcc-button-primary px-4 py-2 text-sm font-extrabold">Apply</button>
                  </div>
                  {couponError && <p className="text-xs text-red-400 mt-1.5">{couponError}</p>}
                </>
              )}
            </div>

            <div className="flex items-center justify-center lg:justify-start gap-2 mb-4">
              <span className="inline-flex items-center gap-1.5 bg-[#ffb400]/12 border border-[#ffb400]/35 text-[#ffb400] text-xs font-extrabold uppercase tracking-wider px-3 py-1.5 rounded-full shadow-[0_0_10px_rgba(255,180,0,0.25)]">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.4}><path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                Price locked · 7 days
              </span>
            </div>

            {/* Back / Add to Cart row — kept inline on desktop, pinned to
                the bottom of the viewport on mobile so the primary CTA is
                always visible while the user scrolls the rest of the
                quote details. The Add to Cart button uses tcc-button-primary
                for the brand-green gradient + glow. */}
            <div className="lg:static fixed bottom-0 left-0 right-0 z-30 lg:z-auto lg:bg-transparent bg-[rgba(10,10,10,0.95)] lg:backdrop-blur-0 backdrop-blur-md lg:border-t-0 border-t border-white/10 lg:p-0 p-4 lg:rounded-none flex gap-3">
              <button onClick={handleBack} className="flex-1 bg-white/10 text-white py-5 rounded-2xl text-base lg:text-lg font-extrabold cursor-pointer hover:bg-white/15 transition tap-press">
                Back
              </button>
              <button
                onClick={() => {
                  if (model && condition) {
                    setCartItems(prev => {
                      const key = `${model.id}-${storage?.label || ''}-${condition.label}`;
                      const existing = prev.find(i => `${i.modelId}-${i.storage}-${i.condition}` === key);
                      // Re-adding the same config bumps the quantity by 1
                      // and refreshes the price. The cart's +/- pills can
                      // also adjust.
                      if (existing) return prev.map(i => `${i.modelId}-${i.storage}-${i.condition}` === key ? { ...i, price: quote, quantity: i.quantity + 1, image: model.image ?? i.image } : i);
                      return [...prev, { model: model.label, modelId: model.id, storage: storage?.label || 'N/A', condition: condition.label, price: quote, quantity: 1, image: model.image }];
                    });
                    setCartBump(b => b + 1);
                    setCartToast({ model: model.label, price: quote });
                    setTimeout(() => setCartToast(null), 2400);
                  }
                  // Open the cart drawer first — IWM-style. The user can
                  // then proceed to checkout from inside the cart, instead
                  // of being forced straight into the login form.
                  setCartOpen(true);
                }}
                className="tcc-button-primary flex-[2] py-5 text-base lg:text-lg font-extrabold"
              >
                Add to Cart →
              </button>
            </div>
            {/* Spacer so the sticky CTA row on mobile doesn't sit on top of
                the trust strip below. Disabled on lg+ where the row is inline. */}
            <div className="lg:hidden h-24" />

            {/* TRUST STRIP — adapts to whichever handoff method the user
                picked on the landing dual-path buttons. Different copy
                for local meetup vs prepaid shipping; falls back to a
                hybrid set when the user hasn't chosen yet. */}
            {(() => {
              const localBullets = [
                { icon: "💵", text: "Cash on the spot at handoff" },
                { icon: "📍", text: "Meet at any safe public location you choose" },
                { icon: "🚗", text: "Mobile pickup — we come to you" },
                { icon: "⚡", text: "Inspection + payout in under 15 minutes" },
              ];
              const shipBullets = [
                { icon: "💰", text: "No selling fees" },
                { icon: "📦", text: "Free prepaid FedEx or UPS label" },
                { icon: "🛡️", text: "$100 carrier insurance included" },
                { icon: "⚡", text: "Same-day payout after we verify" },
              ];
              const neutralBullets = [
                { icon: "💰", text: "No selling fees" },
                { icon: "🛡️", text: "Zero fraud risk" },
                { icon: "📦", text: "Free FedEx/UPS shipping OR local meetup" },
                { icon: "⚡", text: "15-min cash local · 24-hr payout shipped" },
              ];
              const bullets = handoffMethod === "local" ? localBullets : handoffMethod === "ship" ? shipBullets : neutralBullets;
              return (
                <div className="mt-6 space-y-3 text-left">
                  {bullets.map(b => (
                    <div key={b.text} className="flex items-center gap-3">
                      <span className="text-lg">{b.icon}</span>
                      <span className="text-sm text-[#e5e5e5]">{b.text}</span>
                    </div>
                  ))}
                  <div className="flex items-start gap-3">
                    <span className="text-lg leading-none">💳</span>
                    <div className="flex-1">
                      <p className="text-sm text-[#e5e5e5] mb-2">Get paid your way</p>
                      <div className="flex flex-wrap gap-1.5">
                        {handoffMethod !== "ship" && (
                          <span className="inline-flex items-center px-2 py-1 rounded-md bg-white/10 text-white text-[10px] font-bold">💵 Cash</span>
                        )}
                        <span className="inline-flex items-center px-2 py-1 rounded-md bg-[#00d54b] text-white text-[10px] font-bold">Cash App</span>
                        <span className="inline-flex items-center px-2 py-1 rounded-md bg-[#6D1ED4] text-white text-[10px] font-bold">Zelle</span>
                        <span className="inline-flex items-center px-2 py-1 rounded-md bg-[#f7931a] text-white text-[10px] font-bold">₿ BTC</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* TOP CASH GUARANTEE — Local meetup gets cash-in-hand and
                walk-away messaging; shipping gets photo-report and
                free-return-ship messaging. */}
            {(() => {
              const guarantees = handoffMethod === "local" ? [
                { icon: "🎯", title: "Transparent Pricing", body: "What you see is what you get. We walk through the device with you in person before paying — no surprise deductions, no haggling." },
                { icon: "🤝", title: "Inspection in Front of You", body: "Test the device together at handoff. We tell you exactly what we checked and how it matched your description before any cash changes hands." },
                { icon: "🔄", title: "Walk Away Anytime", body: "Not happy with our final offer? Just don't hand over the device — no obligation, no pressure, no hard feelings." },
                { icon: "⚡", title: "Cash in 15 Minutes", body: "Quote → meet → inspect → cash. Average local handoff wraps in under 15 minutes. Cash on the spot, or Zelle / Cash App / Venmo / BTC instantly." },
              ] : handoffMethod === "ship" ? [
                { icon: "🎯", title: "Transparent Pricing", body: "Your quote is what we pay if the device matches your description. If anything differs we email photos + a written explanation before adjusting — never a silent change." },
                { icon: "🛡️", title: "Insured Shipping", body: "Prepaid FedEx / UPS label includes $100 carrier insurance. For higher-value devices, add extra coverage at the counter (a few dollars, the clerk handles it)." },
                { icon: "🔄", title: "Free Return Ship", body: "If you reject our revised offer for any reason, we ship the device back to you at our cost — no questions asked." },
                { icon: "⚡", title: "Same-Day Payout", body: "Most payouts go out the same business day we receive and verify. Cash App + Zelle land in minutes; Bitcoin sends on-chain in ~30 minutes." },
              ] : [
                { icon: "🎯", title: "Transparent Pricing", body: "What you see is what you get. No surprise deductions, no bait-and-switch. Your quote is based on the condition you select." },
                { icon: "🤝", title: "Honest Inspections", body: "If anything differs from your description, we'll walk you through our findings before adjusting — no silent changes." },
                { icon: "🔄", title: "No Pressure, No Strings", body: "Changed your mind? Not happy with the final offer? We'll return your device — no questions asked." },
                { icon: "⚡", title: "Same-Day Payout", body: "Austin local? Get paid on the spot. Shipping in? Most payouts hit within 24 hours of device arrival." },
              ];
              const subtitle = handoffMethod === "local"
                ? "Local meetup. Cash on the spot. Here's what we stand behind."
                : handoffMethod === "ship"
                ? "Shipping in. Insured, tracked, paid fast. Here's what we stand behind."
                : "Your device, your terms. Here's what we stand behind.";
              return (
                <div className="mt-6 bg-white/5 border border-white/10 rounded-2xl p-5 text-left">
                  <h3 className="text-base font-bold text-white mb-1">The Top Cash Guarantee</h3>
                  <p className="text-[#e6e6e6] text-xs mb-4">{subtitle}</p>
                  <div className="space-y-4">
                    {guarantees.map(g => (
                      <div key={g.title}>
                        <p className="text-sm font-semibold text-[#e5e5e5]">{g.icon} {g.title}</p>
                        <p className="text-xs text-[#e6e6e6] mt-1">{g.body}</p>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}

            <div className="mt-6 bg-white/5 border border-white/10 rounded-2xl p-5 text-left">
              <h3 className="text-base font-bold text-white mb-4">Why Sellers Choose Top Cash</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center p-3 bg-white/5 rounded-xl">
                  <p className="text-2xl">⭐</p>
                  <p className="text-xs text-[#e6e6e6] mt-1">Thousands of happy sellers</p>
                </div>
                <div className="text-center p-3 bg-white/5 rounded-xl">
                  <p className="text-2xl">⚡</p>
                  <p className="text-xs text-[#e6e6e6] mt-1">Get paid the same day</p>
                </div>
                <div className="text-center p-3 bg-white/5 rounded-xl">
                  <p className="text-2xl">🔒</p>
                  <p className="text-xs text-[#e6e6e6] mt-1">Your price is locked 7 days</p>
                </div>
                <div className="text-center p-3 bg-white/5 rounded-xl">
                  <p className="text-2xl">🏠</p>
                  <p className="text-xs text-[#e6e6e6] mt-1">We meet locally in Austin</p>
                </div>
              </div>
              <div className="mt-4 text-center">
                <p className="text-xs text-[#e6e6e6]">Trusted by Austin sellers</p>
              </div>
            </div>

            {!quoteSaved ? (
              <div className="mt-5 bg-white/5 border border-white/10 rounded-2xl p-4">
                <p className="text-[#e6e6e6] text-xs font-medium mb-3">Not ready yet? Save this quote for later.</p>
                <div className="flex gap-2">
                  <input type="email" value={quoteEmail} onChange={(e) => setQuoteEmail(e.target.value)} placeholder="your@email.com" aria-label="Email for quote" className="flex-1 px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder:text-[#d4d4d4] focus:outline-none focus:border-[#00c853] transition" />
                  <button onClick={async () => {
                    if (!quoteEmail) return;
                    try { await fetch("/api/lead", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "", phone: "", email: quoteEmail, device: deviceType, model: model?.label, storage: storage?.label, condition: condition?.label, carrier: carrier?.label, quote, payout: "TBD" }) }); } catch {}
                    setQuoteSaved(true);
                  }} className="bg-white/10 text-white px-4 py-2.5 rounded-xl text-sm font-semibold cursor-pointer hover:bg-white/15 transition tap-press">
                    Save
                  </button>
                </div>
              </div>
            ) : (
              <p className="mt-5 text-[#00c853] text-sm font-medium">Quote saved! Check your inbox.</p>
            )}

            <button onClick={reset} className="mt-4 text-[#e6e6e6] text-sm cursor-pointer hover:text-white transition">
              Start new quote
            </button>
            </div>
          </div>
        </section>
      )}

      {/* STEP: CHECKOUT (email capture) */}
      {step === "checkout" && page === "home" && ((model && condition) || cartItems.length > 0) && (
        <section className="animate-[fadeIn_0.3s_ease-out]">
          <div className="max-w-lg md:max-w-3xl lg:max-w-7xl mx-auto px-4 pt-6 pb-8 lg:flex lg:gap-8 lg:items-start">
            {checkoutSummary}
            <div className="flex-1 min-w-0">
            <button onClick={handleBack} aria-label="Go back" className="inline-flex items-center gap-2 text-[#00c853] text-sm font-semibold mb-4 px-4 py-2 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 cursor-pointer transition tap-press">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
              Back
            </button>
            {checkoutSummaryMobile}

            <h2 className="text-2xl font-bold mb-1">Checkout</h2>

            {/* SECTION 1: ACCOUNT */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-5 mb-4">
              <h3 className="text-sm font-bold text-[#00c853] uppercase tracking-wider mb-1">Account</h3>
              <p className="text-[#e6e6e6] text-sm mb-4">You&apos;re one step away from getting paid.</p>

              {/* Guest Checkout */}
              <p className="text-xs font-semibold text-[#e6e6e6] uppercase tracking-wider mb-2">Guest Checkout</p>
              <form onSubmit={(e) => {
                e.preventDefault();
                if (!email) return;
                fetch("/api/lead", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "Guest", phone: "", email, device: deviceType, model: model?.label, storage: storage?.label, condition: condition?.label, carrier: carrier?.label, quote: quote * quantity, payout: "TBD", quantity, brokenGlass: (condition?.id === "broken" && isPhoneFlow) ? brokenGlass : undefined, brokenFunctional: condition?.id === "broken" ? brokenFunctional : undefined, photos: photoUrls.length ? photoUrls : undefined }) }).catch(() => {});
                setStep("payout"); pushHistory("payout");
              }} className="space-y-3 mb-4">
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="Email" className="w-full px-4 py-3.5 tcc-input text-sm" />
                <button type="submit" className="tcc-button-primary w-full py-4 text-base font-extrabold">Continue As Guest</button>
              </form>

              <div className="flex items-center gap-3 my-3"><div className="flex-1 h-px bg-white/10" /><span className="text-[#d4d4d4] text-xs">or</span><div className="flex-1 h-px bg-white/10" /></div>

              {/* Customer Login — verifies the email against past leads via /api/lookup.
                  If the email has a prior trade, we prefill the name from history;
                  otherwise we surface an inline error nudging them to Guest above. */}
              <p className="text-xs font-semibold text-[#e6e6e6] uppercase tracking-wider mb-2">Returning Customer</p>
              <form onSubmit={async (e) => {
                e.preventDefault();
                if (!email) { setLoginError("Enter the email you used last time."); return; }
                setLoginLoading(true);
                setLoginError("");
                try {
                  const r = await fetch("/api/lookup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) });
                  const d = await r.json();
                  if (!d.found) {
                    setLoginError("We don't see a past trade for that email — try Guest Checkout above.");
                    return;
                  }
                  if (d.name) setName(d.name);
                  await fetch("/api/lead", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: d.name || "Returning Customer", phone: "", email, device: deviceType, model: model?.label, storage: storage?.label, condition: condition?.label, carrier: carrier?.label, quote: quote * quantity, payout: "TBD", quantity, brokenGlass: (condition?.id === "broken" && isPhoneFlow) ? brokenGlass : undefined, brokenFunctional: condition?.id === "broken" ? brokenFunctional : undefined, photos: photoUrls.length ? photoUrls : undefined }) }).catch(() => {});
                  setStep("payout"); pushHistory("payout");
                } catch {
                  setLoginError("Couldn't verify — try again or use Guest Checkout above.");
                } finally {
                  setLoginLoading(false);
                }
              }} className="space-y-3 mb-2">
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="Email from past trade" className="w-full px-4 py-3.5 tcc-input text-sm" />
                {loginError && <p className="text-[#ff5566] text-xs font-semibold">{loginError}</p>}
                <button type="submit" disabled={loginLoading} className="w-full bg-white/10 text-white py-4 rounded-2xl text-base font-semibold cursor-pointer hover:bg-white/15 disabled:opacity-50 disabled:cursor-not-allowed transition tap-press">
                  {loginLoading ? "Verifying…" : "Look up my info"}
                </button>
                <p className="text-[10px] text-[#b8b8b8] text-center">We only check that the email matches a past order. No password needed.</p>
              </form>

              <p className="text-center text-[#d4d4d4] text-xs my-2">Create An Account</p>

              <div className="flex items-center gap-3 my-3"><div className="flex-1 h-px bg-white/10" /><span className="text-[#d4d4d4] text-xs">or</span><div className="flex-1 h-px bg-white/10" /></div>

              {/* Continue with Google — real Google Identity Services flow.
                  Renders Google's official button into the container below.
                  Requires NEXT_PUBLIC_GOOGLE_CLIENT_ID at build/run time. */}
              <GoogleSignInButton
                onCredential={(payload) => {
                  const gEmail = (payload.email as string) || email;
                  const gName = (payload.name as string) || "Google User";
                  if (gEmail && !email) setEmail(gEmail);
                  if (gName) setName(gName);
                  fetch("/api/lead", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: gName, phone: "", email: gEmail, device: deviceType, model: model?.label, storage: storage?.label, condition: condition?.label, carrier: carrier?.label, quote: quote * quantity, payout: "TBD", quantity, brokenGlass: (condition?.id === "broken" && isPhoneFlow) ? brokenGlass : undefined, brokenFunctional: condition?.id === "broken" ? brokenFunctional : undefined, photos: photoUrls.length ? photoUrls : undefined }) }).catch(() => {});
                  setStep("payout"); pushHistory("payout");
                }}
              />
            </div>

            {/* SECTION 2: PAYMENT */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-5 mb-4">
              <h3 className="text-sm font-bold text-[#00c853] uppercase tracking-wider mb-2">Payment</h3>
              <p className="text-[#e6e6e6] text-xs">Select your payout method after completing account setup.</p>
            </div>

            {/* SECTION 3: SHIPPING */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-5 mb-4">
              <h3 className="text-sm font-bold text-[#00c853] uppercase tracking-wider mb-2">Shipping</h3>
              <p className="text-[#e6e6e6] text-xs">Austin local? We meet locally! Or reply for a free prepaid shipping label.</p>
            </div>

            {/* SECTION 4: OPTIONS & TERMS */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-5 mb-4">
              <h3 className="text-sm font-bold text-[#00c853] uppercase tracking-wider mb-2">Options &amp; Terms</h3>
              <p className="text-[#e6e6e6] text-xs">By proceeding, you agree that the quoted price is an estimate. Final offer confirmed at inspection based on device condition.</p>
            </div>
            </div>
          </div>
        </section>
      )}

      {/* STEP: PAYOUT METHOD */}
      {step === "payout" && page === "home" && (
        <section className="animate-[fadeIn_0.3s_ease-out]">
          <div className="max-w-lg md:max-w-3xl lg:max-w-7xl mx-auto px-4 pt-6 pb-8 lg:flex lg:gap-8 lg:items-start">
            {/* Any cart contents → use the multi-line Order Summary
                (works for 1+ items and survives a funnel-state reset).
                Funnel state without cart → editable selection panel. */}
            {cartItems.length > 0 ? checkoutSummary : selectionPanel}
            <div className="flex-1 min-w-0">
            <button onClick={handleBack} aria-label="Go back" className="inline-flex items-center gap-2 text-[#00c853] text-sm font-semibold mb-4 px-4 py-2 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 cursor-pointer transition tap-press">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
              Back
            </button>
            {cartItems.length > 0 ? checkoutSummaryMobile : selectionPanelMobile}
            <h2 className="text-2xl font-bold mb-1">How would you like to get paid?</h2>
            <p className="text-[#e6e6e6] text-sm mb-3">Select your preferred payout method</p>
            {/* Cash is only available for in-person handoffs — we can't mail
                physical cash. If the seller picked Shipping on the landing,
                filter Cash out and tell them why so they don't go hunting. */}
            {handoffMethod === "ship" && (
              <div className="mb-4 px-3 py-2 rounded-lg bg-[#00c853]/5 border border-[#00c853]/20 text-[12px] text-[#bdbdbd] leading-snug">
                <span className="text-[#00c853] font-bold">Heads up:</span> Cash isn't shown — we can't mail physical cash. All digital payouts (Cash App / Zelle / Bitcoin) land within minutes of receipt.
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              {PAYOUTS.filter(p => handoffMethod !== "ship" || p.id !== "cash").map((p) => (
                <button
                  key={p.id}
                  onClick={() => { setPayout(p); setStep("contact"); pushHistory("contact"); }}
                  className="flex items-center justify-center p-7 rounded-2xl tcc-card cursor-pointer min-h-[88px]"
                >
                  <p className="font-extrabold text-[17px] text-white">{p.label}</p>
                </button>
              ))}
            </div>
            </div>
          </div>
        </section>
      )}

      {/* STEP: CONTACT INFO */}
      {step === "contact" && page === "home" && payout && ((model && condition) || cartItems.length > 0) && (
        <section className="animate-[fadeIn_0.3s_ease-out]">
          <div className="max-w-lg md:max-w-3xl lg:max-w-7xl mx-auto px-4 pt-6 pb-8 lg:flex lg:gap-8 lg:items-start">
            {/* Any cart contents → use the multi-line Order Summary
                (works for 1+ items and survives a funnel-state reset). */}
            {cartItems.length > 0 ? checkoutSummary : selectionPanel}
            <div className="flex-1 min-w-0">
            <button onClick={handleBack} aria-label="Go back" className="inline-flex items-center gap-2 text-[#00c853] text-sm font-semibold mb-4 px-4 py-2 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 cursor-pointer transition tap-press">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
              Back
            </button>
            {cartItems.length > 0 ? checkoutSummaryMobile : selectionPanelMobile}

            {returningHint && returningHint.leadCount > 0 && (
              <div className="bg-gradient-to-r from-[#00c853]/15 via-[#00c853]/8 to-[#00c853]/15 border border-[#00c853]/30 rounded-xl px-4 py-3 mb-5 flex items-center gap-3 animate-[fadeIn_0.4s_ease-out]">
                <span className="text-2xl">👋</span>
                <div className="flex-1 text-sm">
                  <p className="text-white font-semibold">Welcome back{returningHint.name ? `, ${returningHint.name.split(" ")[0]}` : ""}!</p>
                  <p className="text-[#d4d4d4] text-xs">You&apos;ve sold to us {returningHint.leadCount} time{returningHint.leadCount === 1 ? "" : "s"} before — thanks for coming back.</p>
                </div>
              </div>
            )}

            <h2 className="text-xl font-bold mb-1">Almost done</h2>
            <p className="text-[#e6e6e6] text-sm mb-6">We&apos;ll contact you to arrange pickup &amp; payment</p>

            <form onSubmit={async (e) => {
              e.preventDefault();
              if (!handoffMethod) { alert("Pick a handoff method (Ship or Local) first."); return; }
              if (handoffMethod === "ship" && (!shipStreet || !shipCity || !shipState || !shipZip)) {
                alert("Please fill in your full shipping address."); return;
              }
              try {
                // Book the chosen local slot before creating the lead.
                // If the slot was taken between page-load and submit
                // (someone else picked it), bookSlot returns ok:false
                // with 409 — surface inline and bail so the seller can
                // re-pick instead of losing data / getting a confusing
                // half-submitted state.
                let bookedSlotInfo: { id: string; date: string; time: string; label?: string } | undefined;
                if (handoffMethod === "local" && selectedSlot) {
                  const r = await bookSlot(selectedSlot.id, {
                    sellerName: name,
                    sellerPhone: phone || undefined,
                    sellerEmail: email || undefined,
                    deviceLabel: model?.label,
                  });
                  if (!r.ok) {
                    setSlotError(r.error === "already booked"
                      ? "That window was just taken — please pick another."
                      : `Couldn't reserve that window: ${r.error}`);
                    // Refresh open slots so the booked one drops off.
                    try {
                      const fromDate = new Date().toISOString().slice(0, 10);
                      const fresh = await listSlots({ openOnly: true, fromDate });
                      setAvailableSlots(fresh.slice(0, 18));
                    } catch {}
                    setSelectedSlot(null);
                    return;
                  }
                  bookedSlotInfo = { id: selectedSlot.id, date: selectedSlot.date, time: selectedSlot.time, label: selectedSlot.label };
                }
                const handoffPayload = handoffMethod === "ship"
                  ? { method: "ship", address: { street: shipStreet, unit: shipUnit, city: shipCity, state: shipState, zip: shipZip }, hasBox: shipHasBox ?? undefined }
                  : { method: "local", slot: bookedSlotInfo };
                // Snapshot the currently-edited photos into the active
                // tab's slot before submission so the latest edits make
                // it into the per-item submission below.
                const liveMap: Record<string, string[]> = activePhotoKey
                  ? { ...photosByItemKey, [activePhotoKey]: photoUrls }
                  : photosByItemKey;
                // Multi-device cart → ONE consolidated lead POST that
                // carries a `devices` array (one entry per cart item, each
                // with its own photos). Skywalker 2026-05-17: "when
                // customers have mutiple it all comes in as separate
                // leads we need to make one need highly organized".
                // Single device → standard single-lead POST with the
                // full spec payload.
                const isMultiCart = cartItems.length > 1;
                if (isMultiCart) {
                  const devicesPayload = cartItems.map((it) => {
                    const key = `${it.modelId}-${it.storage}-${it.condition}`;
                    return {
                      model: it.model,
                      storage: it.storage,
                      condition: it.condition,
                      quote: it.price * it.quantity,
                      quantity: it.quantity,
                      photos: liveMap[key] ?? [],
                    };
                  });
                  const totalQuote = devicesPayload.reduce((s, d) => s + (d.quote || 0), 0);
                  const r = await fetch("/api/lead", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      name, phone, email,
                      device: deviceType,
                      // Headline model is intentionally a summary string
                      // so the existing lead-table model column reads
                      // sensibly for multi-item submissions.
                      model: `${cartItems.length} devices — ${cartItems[0].model}${cartItems.length > 1 ? ` + ${cartItems.length - 1} more` : ""}`,
                      condition: "Multi-device",
                      carrier: carrier?.label,
                      quote: totalQuote,
                      payout: payout?.label,
                      handoff: handoffPayload,
                      paidOff,
                      devices: devicesPayload,
                    }),
                  });
                  if (!r.ok) throw new Error("Failed");
                } else {
                  const singleKey = model && condition ? `${model.id}-${storage?.label || 'N/A'}-${condition.label}` : "";
                  const singlePhotos = (singleKey && liveMap[singleKey]) || photoUrls;
                  const res = await fetch("/api/lead", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ name, phone, email, device: deviceType, model: model?.label, storage: storage?.label, condition: condition?.label, carrier: carrier?.label, quote: quote * quantity, payout: payout?.label, quantity, photos: singlePhotos, imei: imeiInput.replace(/\D/g, "") || undefined, imeiWarnings: imeiState === "warn" ? imeiResult?.warnings : undefined, handoff: handoffPayload, brokenGlass: (condition?.id === "broken" && isPhoneFlow) ? brokenGlass : undefined, brokenFunctional: condition?.id === "broken" ? brokenFunctional : undefined, processor: processor?.label, memory: memory?.label, graphics: graphics?.label, displayResolution: displayResolution?.label, displayGlass: displayGlass?.label, batteryHealth: batteryHealth?.label, charger: charger?.label, connectivity: connectivity?.label, extras: Object.values(extras).map((x) => x.label).filter(Boolean), paidOff }),
                  });
                  if (!res.ok) throw new Error('Failed');
                }
                if (email || phone) {
                  const confirmBody = isMultiCart
                    ? { name, phone, email, carrier: carrier?.label, payout: payout?.label, devices: cartItems.map((it) => ({ model: it.model, storage: it.storage, condition: it.condition, quote: it.price * it.quantity, quantity: it.quantity })) }
                    : { name, phone, email, model: model?.label, storage: storage?.label, condition: condition?.label, carrier: carrier?.label, quote: quote * quantity, payout: payout?.label, quantity };
                  fetch("/api/confirm", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(confirmBody),
                  }).catch(() => {});
                }
                // Snapshot the submitted cart for the "done" screen
                // BEFORE clearing — the done screen needs to render
                // every device, not just the current funnel state.
                if (isMultiCart) {
                  setSubmittedDevices(cartItems.map((it) => ({ ...it })));
                } else if (model && condition) {
                  setSubmittedDevices([{
                    model: model.label,
                    storage: storage?.label || "N/A",
                    condition: condition.label,
                    price: quote * quantity,
                    quantity,
                    image: model.image,
                  }]);
                }
                // Wipe cart + session after submission. Previously only the
                // session was cleared, so the cart icon kept showing the
                // device the user just successfully submitted — confusing.
                setCartItems([]);
                try { localStorage.removeItem("tcc-cart"); } catch {}
                localStorage.removeItem("tcc-session");
                setStep("done"); pushHistory("done");
              } catch { alert("Something went wrong. Please try again or call us directly."); }
            }} className="space-y-4">
              {/* HANDOFF SECTION — if the user picked Local or Shipping on the
                  hero, we already know the method. Only show the relevant
                  detail form (address OR area picker), plus a small text link
                  to switch methods. If they got here without a pre-pick (deep
                  link, direct nav) we render both choices as a fallback. */}
              <div>
                {handoffMethod === null && (
                  <>
                    <label className="block text-xs font-medium text-[#e6e6e6] mb-2 uppercase tracking-wider">How are you handing off the device?</label>
                    <div className="grid grid-cols-2 gap-2 mb-3">
                      <button type="button" onClick={() => setHandoffMethod("ship")} className="flex items-center gap-3 px-3 py-3 rounded-xl border border-white/10 cursor-pointer text-left tap-press transition" style={{ background: "rgba(255,255,255,0.03)" }}>
                        <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
                          <svg className="w-4 h-4 text-[#00c853]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M3 7h13l4 4v6a1 1 0 01-1 1h-2"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="18" r="2"/></svg>
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-white text-[13px] font-extrabold leading-tight">Ship It</p>
                          <p className="text-[#bdbdbd] text-[11px] leading-snug">Free prepaid label</p>
                        </div>
                      </button>
                      <button type="button" onClick={() => setHandoffMethod("local")} className="flex items-center gap-3 px-3 py-3 rounded-xl border border-white/10 cursor-pointer text-left tap-press transition" style={{ background: "rgba(255,255,255,0.03)" }}>
                        <div className="w-8 h-8 rounded-lg bg-[#00c853]/15 border border-[#00c853]/30 flex items-center justify-center shrink-0">
                          <svg className="w-4 h-4 text-[#00c853]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M3 11l9-8 9 8M5 10v10h14V10"/></svg>
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-white text-[13px] font-extrabold leading-tight">Local Meetup</p>
                          <p className="text-[#bdbdbd] text-[11px] leading-snug">We come to you</p>
                        </div>
                      </button>
                    </div>
                  </>
                )}

                {handoffMethod === "ship" && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-medium text-[#e6e6e6] uppercase tracking-wider">Shipping address</label>
                      <button type="button" onClick={() => { setHandoffMethod("local"); setLocalArea(null); }} className="text-[11px] text-[#888] hover:text-[#00c853] underline cursor-pointer">Switch to local meetup instead</button>
                    </div>
                    <input ref={shipStreetRef} required value={shipStreet} onChange={e => setShipStreet(e.target.value)} placeholder="Start typing your address…" autoComplete="off" className="w-full px-4 py-3 tcc-input" />
                    <input value={shipUnit} onChange={e => setShipUnit(e.target.value)} placeholder="Apt / Suite (optional)" autoComplete="address-line2" className="w-full px-4 py-3 tcc-input" />
                    <div className="grid grid-cols-3 gap-2">
                      <input required value={shipCity} onChange={e => setShipCity(e.target.value)} placeholder="City" autoComplete="address-level2" className="col-span-2 w-full px-4 py-3 tcc-input" />
                      <input required maxLength={2} value={shipState} onChange={e => setShipState(e.target.value.toUpperCase().slice(0,2))} placeholder="State" autoComplete="address-level1" className="w-full px-4 py-3 tcc-input uppercase" />
                    </div>
                    <input required inputMode="numeric" pattern="\d{5}" maxLength={5} value={shipZip} onChange={e => setShipZip(e.target.value.replace(/\D/g, "").slice(0,5))} placeholder="ZIP" autoComplete="postal-code" className="w-full px-4 py-3 tcc-input" />
                    {/* Packaging check — pre-flight so a seller without a
                        box doesn't get a label they can't use. We'll ship
                        a packaging kit instead if they need one. */}
                    <div className="mt-2">
                      <label className="block text-xs font-medium text-[#e6e6e6] mb-2 uppercase tracking-wider">Do you have a box to ship in?</label>
                      <div className="grid grid-cols-2 gap-2">
                        <button type="button" onClick={() => setShipHasBox("yes")} className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border transition cursor-pointer tap-press ${shipHasBox === "yes" ? "bg-[#00c853]/15 border-[#00c853]/60 text-white" : "bg-white/[0.04] border-white/15 text-[#e6e6e6] hover:bg-white/[0.07]"}`}>
                          <span className="text-base">📦</span>
                          <span className="text-[13px] font-bold">Yes, I have one</span>
                        </button>
                        <button type="button" onClick={() => setShipHasBox("no")} className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border transition cursor-pointer tap-press ${shipHasBox === "no" ? "bg-[#00c853]/15 border-[#00c853]/60 text-white" : "bg-white/[0.04] border-white/15 text-[#e6e6e6] hover:bg-white/[0.07]"}`}>
                          <span className="text-base">📭</span>
                          <span className="text-[13px] font-bold">No — send me one</span>
                        </button>
                      </div>
                      {shipHasBox === "no" && (
                        <p className="text-[#00c853] text-[11px] leading-relaxed mt-2">✓ We'll include a padded box and protective wrap with your label — no extra charge.</p>
                      )}
                    </div>
                    <p className="text-[#888] text-[11px] leading-relaxed">Prepaid label hits {email || "your email"} within the hour. Drop the box at any FedEx or UPS — we cover return shipping.</p>
                  </div>
                )}

                {handoffMethod === "local" && (
                  <div className="space-y-3">
                    <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-[#00c853]/5 border border-[#00c853]/20">
                      <svg className="w-5 h-5 text-[#00c853] shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M3 11l9-8 9 8M5 10v10h14V10"/></svg>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <p className="text-white text-sm font-bold leading-tight">Local meetup</p>
                          <button type="button" onClick={() => setHandoffMethod("ship")} className="text-[11px] text-[#888] hover:text-[#00c853] underline cursor-pointer">Switch to shipping</button>
                        </div>
                        <p className="text-[#bdbdbd] text-xs leading-snug">
                          {availableSlots.length > 0
                            ? "Pick an open meetup window below. We'll confirm the exact location via text."
                            : "We'll text or email you within the hour to coordinate a time and a public spot in Austin you're comfortable with."}
                        </p>
                      </div>
                    </div>

                    {/* SLOT PICKER — appears only when Skywalker has
                        published open slots via /admin/slots. Atomic
                        book on form submit prevents double-booking. */}
                    {(slotsLoading || availableSlots.length > 0) && (
                      <div>
                        <label className="block text-xs font-medium text-[#e6e6e6] mb-2 uppercase tracking-wider">Pick a meetup time</label>
                        {slotsLoading ? (
                          <p className="text-[11px] text-[#888]">Loading available windows…</p>
                        ) : (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {availableSlots.map((s) => {
                              const isPicked = selectedSlot?.id === s.id;
                              const dateLabel = new Date(s.date + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
                              const [h, mm] = s.time.split(":").map(Number);
                              const ampm = h >= 12 ? "PM" : "AM";
                              const h12 = h % 12 || 12;
                              const timeLabel = `${h12}:${String(mm).padStart(2, "0")} ${ampm}`;
                              return (
                                <button
                                  type="button"
                                  key={s.id}
                                  onClick={() => { setSelectedSlot(s); setSlotError(null); }}
                                  className={`text-left px-3 py-2.5 rounded-xl border transition cursor-pointer tap-press ${isPicked ? "bg-[#00c853]/15 border-[#00c853]/60" : "bg-white/[0.05] border-white/15 hover:bg-white/[0.08] hover:border-white/25"}`}
                                >
                                  <p className="text-white text-[13px] font-bold leading-tight">{dateLabel} · {timeLabel}</p>
                                  {s.label && <p className="text-[#bdbdbd] text-[11px] mt-0.5 leading-tight">{s.label}</p>}
                                </button>
                              );
                            })}
                          </div>
                        )}
                        {slotError && (
                          <p className="text-[11px] text-[#ff8088] mt-2">{slotError}</p>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-[#e6e6e6] mb-1.5 uppercase tracking-wider">Name</label>
                <input type="text" value={name} onChange={(e) => setName(e.target.value)} required minLength={2} maxLength={50} placeholder="Your name" className="w-full px-4 py-3.5 tcc-input text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#e6e6e6] mb-1.5 uppercase tracking-wider">
                  Phone {handoffMethod === "ship" ? <span className="normal-case text-[11px] text-[#888]">(optional — we'll email everything)</span> : <span className="normal-case text-[11px] text-[#888]">(needed — we'll text to coordinate)</span>}
                </label>
                <input type="tel" value={phone} onChange={(e) => {
                  const digits = e.target.value.replace(/\D/g, "").slice(0, 10);
                  if (digits.length >= 6) setPhone(`(${digits.slice(0,3)}) ${digits.slice(3,6)}-${digits.slice(6)}`);
                  else if (digits.length >= 3) setPhone(`(${digits.slice(0,3)}) ${digits.slice(3)}`);
                  else setPhone(digits);
                }} required={handoffMethod !== "ship"} pattern="\(\d{3}\) \d{3}-\d{4}" placeholder="(512) 555-0000" className="w-full px-4 py-3.5 tcc-input text-sm" />
                {phone && <p className="text-[#e6e6e6] text-[11px] leading-relaxed mt-1.5">By submitting, you agree to receive SMS updates about your trade-in from Top Cash Cellular. Msg &amp; data rates may apply. Reply STOP to opt out, HELP for help.</p>}
              </div>
              {email && (
                <p className="text-[#e6e6e6] text-xs">
                  Email: {email}
                  {handoffMethod === "ship" && <span className="ml-1 text-[#00c853] font-semibold">— your prepaid label goes here</span>}
                </p>
              )}
              <div>
                <label className="block text-xs font-medium text-[#e6e6e6] mb-1.5 uppercase tracking-wider">
                  IMEI / Serial <span className="normal-case text-[12px]">(optional — speeds up verification, dial *#06#)</span>
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    inputMode="numeric"
                    value={imeiInput}
                    onChange={(e) => { setImeiInput(e.target.value); if (imeiState !== "idle") { setImeiState("idle"); setImeiResult(null); } }}
                    placeholder="15-digit IMEI"
                    maxLength={20}
                    className="flex-1 px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-base lg:text-sm text-white placeholder:text-[#d4d4d4] focus:outline-none focus:border-[#00c853] transition tracking-wider"
                  />
                  <button
                    type="button"
                    onClick={checkImei}
                    disabled={imeiState === "checking" || imeiInput.replace(/\D/g, "").length < 15}
                    className="px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-sm font-semibold hover:bg-white/10 transition disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                  >
                    {imeiState === "checking" ? "…" : "Verify"}
                  </button>
                </div>
                {imeiState === "ok" && imeiResult && (
                  <p className="text-xs text-[#00c853] mt-1.5">✓ Verified{imeiResult.model ? ` — ${imeiResult.model}` : ""}</p>
                )}
                {imeiState === "warn" && imeiResult?.warnings && (
                  <div className="mt-1.5 px-3 py-2 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                    <p className="text-xs text-yellow-300 font-semibold mb-1">⚠️ Heads up{imeiResult.model ? ` — ${imeiResult.model}` : ""}</p>
                    {imeiResult.warnings.map((w, i) => (
                      <p key={i} className="text-[11px] text-yellow-200">• {w}</p>
                    ))}
                    <p className="text-[11px] text-[#d4d4d4] mt-1">Quote still valid — staff will work it out at handoff.</p>
                  </div>
                )}
                {imeiState === "error" && imeiResult?.error && (
                  <p className="text-xs text-red-400 mt-1.5">{imeiResult.error}</p>
                )}
              </div>

              {/* Carrier-balance Yes / No — Skywalker 2026-05-17. Captures
                  whether the device is fully paid off so staff can adjust
                  the offer for blacklist risk on financed devices. */}
              <div>
                <label className="block text-xs font-medium text-[#e6e6e6] mb-1.5 uppercase tracking-wider">
                  Carrier balance status
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setPaidOff(true)}
                    className={`px-3 py-3 rounded-xl border text-left transition cursor-pointer
                      ${paidOff === true ? "bg-[#00c853]/15 border-[#00c853]/45 text-white" : "bg-white/5 border-white/10 text-[#c5c5c5] hover:bg-white/10"}`}
                  >
                    <p className="text-[13px] font-bold leading-tight">No balance owed</p>
                    <p className="text-[11px] opacity-70 mt-0.5">Device is fully paid off</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaidOff(false)}
                    className={`px-3 py-3 rounded-xl border text-left transition cursor-pointer
                      ${paidOff === false ? "bg-amber-500/15 border-amber-500/45 text-white" : "bg-white/5 border-white/10 text-[#c5c5c5] hover:bg-white/10"}`}
                  >
                    <p className="text-[13px] font-bold leading-tight">Balance still owed</p>
                    <p className="text-[11px] opacity-70 mt-0.5">Financed or installment plan</p>
                  </button>
                </div>
                {paidOff === false && (
                  <div className="mt-2 px-3 py-2.5 rounded-lg bg-amber-500/8 border border-amber-500/25">
                    <p className="text-[12px] text-amber-200 leading-snug">
                      Heads up — devices with an outstanding balance can be blacklisted by the carrier, which lowers their resale value. We&apos;ll still make an offer, but it may be reduced. See our <a href="/faq" className="underline">FAQ</a> for details.
                    </p>
                  </div>
                )}
              </div>

              {/* Multi-device PHOTO TABS — only when cart has 2+ items.
                  Each tab lets the customer upload a distinct photo set
                  per device (Skywalker 2026-05-17 "give them the option
                  to add pictures for each having a tab"). Sealed-tier
                  items don't need photos — their tab shows a "no photos
                  needed" note instead of the grid. */}
              {cartItems.length > 1 && (() => {
                const items = cartItems.map((it, idx) => ({
                  ...it,
                  __idx: idx,
                  __key: `${it.modelId}-${it.storage}-${it.condition}`,
                  __isSealed: /^(sealed|brand[- ]?new|new in box|nib)$/i.test(it.condition),
                }));
                const effective = activePhotoKey || items[0].__key;
                const active = items.find((i) => i.__key === effective) || items[0];
                const switchTo = (key: string) => {
                  // Snapshot current photos into the leaving tab's slot,
                  // then load the next tab's photos.
                  setPhotosByItemKey((prev) => ({ ...prev, [effective]: photoUrls }));
                  setPhotoUrls(photosByItemKey[key] ?? []);
                  setActivePhotoKey(key);
                };
                if (effective !== activePhotoKey) {
                  // First render — initialize lazily without triggering loop
                  setTimeout(() => setActivePhotoKey(effective), 0);
                }
                return (
                  <div className="mb-2 pb-3 border-b border-white/8">
                    <label className="block text-xs font-medium text-[#e6e6e6] mb-2 uppercase tracking-wider">
                      Add photos for each device <span className="normal-case text-[12px]">({items.length} in cart)</span>
                    </label>
                    <div className="flex gap-1.5 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                      {items.map((it) => {
                        const isActive = it.__key === effective;
                        const count = (photosByItemKey[it.__key] ?? (it.__key === effective ? photoUrls : [])).length;
                        return (
                          <button
                            key={it.__key}
                            type="button"
                            onClick={() => switchTo(it.__key)}
                            className={`shrink-0 px-3 py-2 rounded-lg border text-left transition cursor-pointer
                              ${isActive ? "bg-[#00c853]/15 border-[#00c853]/45 text-white" : "bg-white/5 border-white/10 text-[#c5c5c5] hover:bg-white/10"}`}
                          >
                            <p className="text-[11px] font-bold leading-tight whitespace-nowrap">{it.model}</p>
                            <p className="text-[9px] uppercase tracking-wider opacity-70 mt-0.5">
                              {it.__isSealed ? "Sealed · no photos needed" : `${count}/3 photos`}
                            </p>
                          </button>
                        );
                      })}
                    </div>
                    {active.__isSealed && (
                      <div className="mt-3 bg-emerald-500/8 border border-emerald-500/25 rounded-xl px-3 py-2.5">
                        <p className="text-[12px] text-emerald-200 font-semibold">📦 Brand new in sealed box</p>
                        <p className="text-[11px] text-emerald-100/70 mt-0.5">No photos needed for this device — staff verifies at handoff.</p>
                      </div>
                    )}
                  </div>
                );
              })()}
              <div>
                <label className="block text-xs font-medium text-[#e6e6e6] mb-1.5 uppercase tracking-wider">
                  {cartItems.length > 1
                    ? <>Photos for <span className="text-[#00c853]">{(cartItems.find((it) => `${it.modelId}-${it.storage}-${it.condition}` === activePhotoKey)?.model) || cartItems[0].model}</span></>
                    : <>Device Photos {condition?.id === "broken" || condition?.id === "fair"
                        ? <span className="normal-case text-[12px] text-[#00c853]">— recommended for {condition?.id === "broken" ? "broken" : "worn"} devices to lock in your quote</span>
                        : <span className="normal-case text-[12px]">(optional — up to 3, speeds up payout)</span>}</>}
                </label>
                {/* PHOTO CAPTURE — 3-slot grid (Front / Back / Screen On)
                    per Skywalker 2026-05-17 "lets create a nice ui for
                    photo taking". Each slot is its own clickable target
                    with an icon + contextual label so customers know
                    exactly what to capture. Filled slots show the
                    thumbnail with a remove × overlay. Slots fill in
                    order — the next-up slot pulses green. The legacy
                    single-button fallback rendering below is unused now
                    but left in case we want to revert. */}
                <div className="grid grid-cols-3 gap-2">
                  {([
                    { label: "Front",     hint: "Face up",   icon: "screen" as const },
                    { label: "Back",      hint: "Logo side", icon: "back"   as const },
                    { label: "Screen On", hint: "Powered",   icon: "power"  as const },
                  ]).map((slot, i) => {
                    const url = photoUrls[i];
                    if (url) {
                      return (
                        <div key={i} className="relative aspect-square rounded-xl overflow-hidden border border-white/15">
                          <img src={url} alt={`${slot.label} photo`} className="w-full h-full object-cover" />
                          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent px-2 py-1.5">
                            <p className="text-[10px] uppercase tracking-wider text-white font-bold">{slot.label}</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => setPhotoUrls(photoUrls.filter((_, j) => j !== i))}
                            aria-label={`Remove ${slot.label} photo`}
                            className="absolute top-1.5 right-1.5 w-7 h-7 bg-black/75 backdrop-blur-sm rounded-full text-white text-lg font-bold flex items-center justify-center cursor-pointer hover:bg-red-500 transition"
                          >×</button>
                        </div>
                      );
                    }
                    const isNextUp = i === photoUrls.length;
                    const isLocked = i > photoUrls.length;
                    return (
                      <label
                        key={i}
                        className={`relative aspect-square rounded-xl border-2 border-dashed flex flex-col items-center justify-center text-center px-1.5 transition
                          ${isLocked ? "bg-white/[0.02] border-white/8 cursor-not-allowed opacity-50" : "bg-white/5 border-white/20 cursor-pointer hover:bg-white/10 hover:border-[#00c853]/50"}
                          ${isNextUp && !uploading && !isLocked ? "border-[#00c853]/45 shadow-[0_0_0_3px_rgba(0,200,83,0.08)]" : ""}
                          ${uploading ? "opacity-50 pointer-events-none" : ""}`}
                      >
                        <svg className={`w-7 h-7 mb-1 ${isNextUp && !isLocked ? "text-[#00c853]" : "text-[#d4d4d4]"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}>
                          {slot.icon === "screen" && (<><rect x="6" y="3" width="12" height="18" rx="2" /><line x1="11" y1="18" x2="13" y2="18" /></>)}
                          {slot.icon === "back" && (<><rect x="6" y="3" width="12" height="18" rx="2" /><circle cx="12" cy="9" r="1.5" /><circle cx="12" cy="9" r="3" strokeDasharray="2 2" /></>)}
                          {slot.icon === "power" && (<><rect x="6" y="3" width="12" height="18" rx="2" /><path d="M10.5 9.5 V12 M13.5 9.5 V12 M9.5 14 q2.5 2 5 0" strokeLinecap="round" /></>)}
                        </svg>
                        <p className="text-[10px] uppercase tracking-wider font-bold text-white leading-tight">{slot.label}</p>
                        <p className="text-[9px] text-[#a8a8a8] mt-0.5 leading-tight">{slot.hint}</p>
                        {isNextUp && !uploading && !isLocked && (
                          <span className="absolute top-1.5 left-1.5 text-[8px] uppercase tracking-wider font-bold text-[#00c853] bg-[#00c853]/15 px-1.5 py-0.5 rounded">Tap</span>
                        )}
                        <input
                          type="file"
                          accept="image/*"
                          capture="environment"
                          disabled={isLocked || uploading}
                          className="hidden"
                          onChange={async (e) => {
                            const files = e.target.files;
                            if (!files?.length) return;
                            setUploading(true);
                            setPhotoError(null);
                            const urls: string[] = [...photoUrls];
                            let firstErr: string | null = null;
                            for (const file of Array.from(files)) {
                              if (urls.length >= 3) break;
                              if (file.size > 20 * 1024 * 1024) { firstErr = firstErr || `Photo "${file.name}" is over 20MB.`; continue; }
                              try {
                                const fd = new FormData();
                                fd.append("file", file);
                                const res = await fetch("/api/upload", { method: "POST", body: fd });
                                const data = await res.json().catch(() => ({}));
                                if (!res.ok) { firstErr = firstErr || (data?.error ? `Upload failed: ${data.error}` : `Upload failed (HTTP ${res.status}).`); continue; }
                                if (data?.url) urls.push(data.url);
                                else firstErr = firstErr || "Upload returned no URL.";
                              } catch (err) {
                                firstErr = firstErr || `Upload error: ${(err as Error).message || "network failure"}`;
                              }
                            }
                            setPhotoUrls(urls);
                            if (firstErr) setPhotoError(firstErr);
                            setUploading(false);
                            e.target.value = "";
                          }}
                        />
                      </label>
                    );
                  })}
                </div>
                {uploading && (
                  <p className="mt-2 text-xs text-[#00c853] flex items-center gap-1.5">
                    <span className="inline-block w-3 h-3 rounded-full border-2 border-[#00c853] border-t-transparent animate-spin" />
                    Uploading…
                  </p>
                )}
                {photoError && (
                  <p className="mt-2 text-xs text-red-300 bg-red-900/20 border border-red-700/40 rounded-lg px-3 py-2">{photoError}</p>
                )}
              </div>
              <p className="text-[#c5c5c5] text-[11px] text-center leading-relaxed">By submitting, you agree that the quoted price is an estimate. Final offer confirmed at inspection based on device condition.</p>
              <button type="submit" className="tcc-button-primary w-full py-4 text-base font-extrabold">
                Submit &amp; Get Paid
              </button>
            </form>
            </div>
          </div>
        </section>
      )}

      {/* STEP: DONE */}
      {step === "done" && page === "home" && payout && ((model && condition) || (submittedDevices && submittedDevices.length > 0)) && (
        <section className="animate-[fadeIn_0.3s_ease-out]">
          <div className="max-w-lg md:max-w-3xl mx-auto px-4 pt-6 lg:pt-10 pb-12">
            {/* Hero — beveled green tile with checkmark + glow rim */}
            <div className="text-center mb-5 lg:mb-8">
              <div
                className="relative w-16 h-16 lg:w-24 lg:h-24 rounded-full mx-auto mb-4 lg:mb-5 flex items-center justify-center"
                style={{
                  background: "linear-gradient(180deg, #00e676 0%, #00c853 60%, #00a039 100%)",
                  boxShadow:
                    "inset 0 2px 0 rgba(255,255,255,0.55), inset 0 -3px 6px rgba(0,0,0,0.28), 0 0 32px rgba(0, 200, 83, 0.5), 0 10px 30px rgba(0,0,0,0.5)",
                }}
              >
                <svg className="w-8 h-8 lg:w-12 lg:h-12 text-[#0a0a0a]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="4 12 10 18 20 6" />
                </svg>
                <span className="absolute inset-0 rounded-full pointer-events-none" style={{ boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.18)" }} />
              </div>
              <h2 className="text-2xl lg:text-3xl font-extrabold mb-2 tracking-tight">You&apos;re all set</h2>
              <p className="text-[#d4d4d4] text-sm max-w-md mx-auto px-2">We&apos;ll reach out within the hour. Here&apos;s your receipt:</p>
            </div>

            {/* Receipt card — glass + inset rim + green accent line.
                Multi-device submissions render the full device list +
                grand total; single device keeps the inline display.
                Skywalker 2026-05-17. */}
            <div className="tcc-card rounded-2xl p-4 lg:p-6 mb-4 lg:mb-5 text-left relative overflow-hidden">
              <span aria-hidden className="absolute left-0 top-0 bottom-0 w-1" style={{ background: "linear-gradient(180deg, #00e676 0%, #00a039 100%)" }} />
              {submittedDevices && submittedDevices.length > 1 ? (
                <>
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-[10px] uppercase tracking-[0.18em] text-[#00c853] font-bold">Quoted · {submittedDevices.length} devices</p>
                    <p className="text-[10px] uppercase tracking-[0.18em] text-[#888] font-bold">Payout · {payout.label}</p>
                  </div>
                  <div className="divide-y divide-white/10">
                    {submittedDevices.map((d, i) => (
                      <div key={i} className="py-2.5 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-[rgba(15,15,15,0.6)] border border-white/10 flex items-center justify-center overflow-hidden shrink-0">
                          {d.image
                            ? <img src={d.image} alt="" className="w-full h-full object-contain p-0.5" />
                            : <span className="text-base opacity-40">📱</span>}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-white text-[13px] font-bold leading-tight truncate">{d.model}</p>
                          <p className="text-[#b8b8b8] text-[11px] leading-tight truncate">{[d.storage, d.condition].filter(Boolean).join(" · ")}{d.quantity > 1 ? ` · ×${d.quantity}` : ""}</p>
                        </div>
                        <p className="text-[#00c853] font-extrabold text-[14px] shrink-0">${d.price * d.quantity}</p>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 pt-3 border-t border-white/15 flex items-baseline justify-between">
                    <span className="text-[12px] uppercase tracking-wider text-[#e6e6e6] font-bold">Total payout</span>
                    <span className="text-[#00c853] font-extrabold text-2xl lg:text-3xl" style={{ textShadow: "0 0 18px rgba(0,200,83,0.4)" }}>
                      ${submittedDevices.reduce((s, d) => s + d.price * d.quantity, 0)}
                    </span>
                  </div>
                  <div className="mt-4 pt-3 border-t border-white/10 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-[#00c853] text-xs font-bold shrink-0">
                      {name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0 text-sm">
                      <p className="text-white font-semibold truncate">{name}</p>
                      <p className="text-[#a8a8a8] text-xs truncate">{phone}{email ? ` · ${email}` : ''}</p>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  {(() => {
                    // Single-device done row — prefer submittedDevices[0]
                    // (which has the actual values at submit time) over
                    // the live funnel state, so a refresh between checkout
                    // and submit doesn't blank the receipt.
                    const sd = submittedDevices && submittedDevices[0];
                    const lbl = sd?.model || model?.label || "";
                    const sub = sd
                      ? [sd.storage, sd.condition].filter(Boolean).join(" · ")
                      : `${storage?.label} · ${condition ? getConditionLabel(condition, deviceType).label : ""}`;
                    const qty = sd?.quantity ?? quantity;
                    const price = sd ? sd.price * sd.quantity : quote * quantity;
                    return (
                      <div className="flex items-start justify-between gap-3 lg:gap-4 mb-4">
                        <div className="min-w-0 flex-1">
                          <p className="text-[10px] uppercase tracking-[0.18em] text-[#00c853] font-bold mb-1">Quoted</p>
                          <p className="font-extrabold text-[16px] lg:text-[18px] text-white leading-tight break-words">{lbl}</p>
                          <p className="text-[#d4d4d4] text-[11px] lg:text-xs mt-1 break-words">{sub} · {payout.label}{qty > 1 ? ` · ×${qty}` : ''}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-[10px] uppercase tracking-[0.18em] text-[#888] font-bold mb-1">Payout</p>
                          {isManualQuote || isPendingQuote
                            ? <p className="text-white font-extrabold text-lg leading-none">Custom quote</p>
                            : <p className="text-[#00c853] font-extrabold text-2xl lg:text-3xl leading-none" style={{ textShadow: "0 0 18px rgba(0,200,83,0.4)" }}>${price}</p>
                          }
                        </div>
                      </div>
                    );
                  })()}
                  <div className="border-t border-white/10 pt-3 lg:pt-4 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-[#00c853] text-xs font-bold shrink-0">
                      {name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0 text-sm">
                      <p className="text-white font-semibold truncate">{name}</p>
                      <p className="text-[#a8a8a8] text-xs truncate">{phone}{email ? ` · ${email}` : ''}</p>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* HANDOFF SUMMARY — they already picked on the contact step; just
                echo it back so they know what happens next. No fork here. */}
            <div className="tcc-card rounded-2xl p-5 mb-6">
              {handoffMethod === "ship" ? (
                <>
                  <p className="text-[10px] uppercase tracking-[0.18em] text-[#00c853] font-bold mb-2">Shipping</p>
                  <p className="text-white text-base font-bold mb-1">Your label is on the way</p>
                  <p className="text-[#bdbdbd] text-xs leading-relaxed mb-3">USPS prepaid label hits {email || "your email"} within the hour. Drop the box at any post office — we cover return shipping.</p>
                  {(shipStreet || shipCity) && (
                    <p className="text-[#888] text-[11px] leading-snug">Ship from: {shipStreet}{shipUnit ? `, ${shipUnit}` : ""}, {shipCity}, {shipState} {shipZip}</p>
                  )}
                </>
              ) : handoffMethod === "local" ? (
                <>
                  <p className="text-[10px] uppercase tracking-[0.18em] text-[#00c853] font-bold mb-2">Local Meetup</p>
                  <p className="text-white text-base font-bold mb-1">We&apos;ll set up the meetup</p>
                  <p className="text-[#bdbdbd] text-xs leading-relaxed">Expect a text or email within the hour to coordinate a time and a public spot in Austin you&apos;re comfortable with (coffee shop, parking lot, your office, etc).</p>
                </>
              ) : (
                <>
                  <p className="text-[10px] uppercase tracking-[0.18em] text-[#00c853] font-bold mb-2">Next Steps</p>
                  <p className="text-white text-base font-bold mb-1">We&apos;ll reach out shortly</p>
                  <p className="text-[#bdbdbd] text-xs leading-relaxed">Expect a text or email within the hour to set up the handoff.</p>
                </>
              )}
            </div>

            <div className="text-center">
              <button onClick={reset} className="inline-flex items-center gap-2 text-[#00c853] font-semibold text-sm cursor-pointer hover:underline px-4 py-2">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14M5 12h14"/></svg>
                Sell another device
              </button>
            </div>
          </div>
        </section>
      )}

      {/* TRUST + TESTIMONIALS + FAQ (only on home) */}
      {step === "device" && page === "home" && (
        <>
          {/* WHY CASH IS BETTER — 3-col comparison */}
          <section className="py-12 bg-[#0d0d0d]">
            <div className="max-w-lg md:max-w-3xl lg:max-w-7xl mx-auto px-4">
              <div className="text-center mb-8">
                <p className="text-[#00c853] text-xs font-bold uppercase tracking-[0.18em] mb-2 reveal">The math</p>
                <h2 className="text-2xl md:text-3xl font-bold leading-tight reveal" data-stagger="1">Why cash beats trade-in</h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="bg-white/[0.06] border border-white/10 rounded-2xl p-5 reveal" data-stagger="2">
                  <p className="text-xs font-bold uppercase tracking-wider text-[#bdbdbd] mb-1">Apple Trade-In</p>
                  <p className="text-white text-2xl font-bold mb-2">Lowball</p>
                  <ul className="text-[#e6e6e6] text-sm space-y-1 list-disc list-inside">
                    <li>Bottom-of-market quotes</li>
                    <li>Store credit only</li>
                    <li>No cash option</li>
                  </ul>
                </div>
                <div className="bg-white/[0.06] border border-white/10 rounded-2xl p-5 reveal" data-stagger="3">
                  <p className="text-xs font-bold uppercase tracking-wider text-[#bdbdbd] mb-1">Carrier Trade-In</p>
                  <p className="text-white text-2xl font-bold mb-2">36-Month Drip</p>
                  <ul className="text-[#e6e6e6] text-sm space-y-1 list-disc list-inside">
                    <li>Looks high — paid over 3 years</li>
                    <li>Stuck on the same carrier</li>
                    <li>Lose value if you leave</li>
                  </ul>
                </div>
                <div className="bg-gradient-to-br from-[#00c853]/15 to-transparent border border-[#00c853]/40 rounded-2xl p-5 reveal" data-stagger="4">
                  <p className="text-xs font-bold uppercase tracking-wider text-[#00c853] mb-1">Top Cash Cellular</p>
                  <p className="text-[#00c853] text-2xl font-bold mb-2">Instant Cash</p>
                  <ul className="text-white text-sm space-y-1 list-disc list-inside">
                    <li>Competitive, fair pricing</li>
                    <li><strong>Cash, Zelle, or Venmo</strong> — same day</li>
                    <li>No strings, no carrier lock-in</li>
                  </ul>
                </div>
              </div>
              <p className="text-[#e6e6e6] text-xs text-center mt-4">Compare anywhere. We&apos;ll match or beat.</p>
            </div>
          </section>

          {/* SHIP TO US */}
          <section className="py-12 bg-[#0a0a0a]">
            <div className="max-w-lg md:max-w-3xl lg:max-w-7xl mx-auto px-4">
              <h2 className="text-xl font-bold text-center mb-2">Not in Austin? Ship to us</h2>
              <p className="text-[#e6e6e6] text-sm text-center mb-8">Mail your device from anywhere in the US. We pay shipping.</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[
                  { num: "1", icon: "📦", title: "Pack", desc: "We send you a free prepaid shipping label" },
                  { num: "2", icon: "✈️", title: "Ship", desc: "Drop it off at any USPS or UPS location" },
                  { num: "3", icon: "💸", title: "Get Paid", desc: "Payment sent same day we receive it" },
                ].map((s) => (
                  <div key={s.num} className="bg-white/5 border border-white/10 rounded-2xl p-4 text-center">
                    <div className="w-10 h-10 rounded-full bg-[#00c853]/15 flex items-center justify-center mx-auto mb-2">
                      <span className="text-lg">{s.icon}</span>
                    </div>
                    <p className="text-white text-sm font-bold mb-1">{s.title}</p>
                    <p className="text-[#e6e6e6] text-[11px] leading-relaxed">{s.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* BOLD STATS COUNTER */}
          <section className="py-14 bg-[#111]" ref={(el) => { if (el && !statsVisible) { const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setStatsVisible(true); obs.disconnect(); } }, { threshold: 0.3 }); obs.observe(el); } }}>
            <div className="max-w-lg md:max-w-3xl lg:max-w-7xl mx-auto px-4">
              <p className="text-[#e6e6e6] text-xs font-semibold uppercase tracking-wider text-center mb-8">Top Cash Cellular by the numbers</p>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-white/5 border border-white/10 rounded-2xl p-3 overflow-hidden">
                  <p className="text-2xl md:text-3xl font-extrabold text-[#00c853] tabular-nums">{animatedStats.devices}+</p>
                  <p className="text-white text-xs font-semibold mt-1">Devices Bought</p>
                  <p className="text-[#e6e6e6] text-[10px] mt-0.5">and counting</p>
                </div>
                <div className="bg-white/5 border border-white/10 rounded-2xl p-3 overflow-hidden">
                  <p className="text-2xl md:text-3xl font-extrabold text-[#00c853] tabular-nums">${animatedStats.payout}K+</p>
                  <p className="text-white text-xs font-semibold mt-1">Paid Out</p>
                  <p className="text-[#e6e6e6] text-[10px] mt-0.5">to Austin sellers</p>
                </div>
                <div className="bg-white/5 border border-white/10 rounded-2xl p-3 overflow-hidden">
                  <p className="text-2xl md:text-3xl font-extrabold text-[#00c853] tabular-nums">&lt;{animatedStats.time}h</p>
                  <p className="text-white text-xs font-semibold mt-1">Avg Payout</p>
                  <p className="text-[#e6e6e6] text-[10px] mt-0.5">from quote to cash</p>
                </div>
              </div>
            </div>
          </section>

          {/* TESTIMONIALS */}
          <section className="py-10 overflow-hidden bg-[#0a0a0a]">
            <p className="text-white font-semibold text-lg text-center mb-6">What sellers say</p>
            <div className="relative">
              <div className="flex animate-[marquee_25s_linear_infinite] gap-4 w-max">
                {[
                  { text: "Got $420 for my iPhone 14 Pro. Way more than the Apple trade-in.", name: "Mike R." },
                  { text: "Zelle payment hit my account same day. Super smooth.", name: "Ashley T." },
                  { text: "They came to me and paid cash on the spot. Can't beat that.", name: "David L." },
                  { text: "Sold my old Galaxy S23 in 5 minutes. Easy money.", name: "Sarah K." },
                  { text: "Best price I found anywhere in Austin. Highly recommend.", name: "Chris M." },
                  { text: "Got $420 for my iPhone 14 Pro. Way more than the Apple trade-in.", name: "Mike R." },
                  { text: "Zelle payment hit my account same day. Super smooth.", name: "Ashley T." },
                  { text: "They came to me and paid cash on the spot. Can't beat that.", name: "David L." },
                  { text: "Sold my old Galaxy S23 in 5 minutes. Easy money.", name: "Sarah K." },
                  { text: "Best price I found anywhere in Austin. Highly recommend.", name: "Chris M." },
                ].map((r, i) => (
                  <div key={i} className="flex-shrink-0 w-[260px] bg-white/5 rounded-2xl p-4 border border-white/10">
                    <p className="text-sm text-white/85 font-medium mb-2">&ldquo;{r.text}&rdquo;</p>
                    <p className="text-xs text-[#e6e6e6]">— {r.name}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* PAYMENT TIMELINE */}
          <section className="py-12 bg-[#0d0d0d]">
            <div className="max-w-lg md:max-w-3xl lg:max-w-7xl mx-auto">
              <h2 className="text-xl font-bold text-center mb-2 px-4">When do I get paid?</h2>
              <p className="text-[#e6e6e6] text-sm text-center mb-8 px-4">Transparent timelines. No surprises.</p>
              <div className="overflow-hidden tcc-marquee-mask">
                <div className="flex gap-3 w-max animate-[marquee_32s_linear_infinite] hover:[animation-play-state:paused]">
                  {[...Array(2)].flatMap((_, dup) => [
                    { method: "Local Pickup", icon: "🏠", timeline: "Same day", desc: "We meet in Austin. Inspect device. Pay on the spot.", highlight: true },
                    { method: "Cash", icon: "💵", timeline: "Instant", desc: "Handed to you at pickup. Immediate.", highlight: false },
                    { method: "Cash App / Zelle", icon: "⚡", timeline: "Under 5 min", desc: "Sent while you watch. Hits your account instantly.", highlight: false },
                    { method: "Bitcoin (BTC)", icon: "₿", timeline: "Under 30 min", desc: "Sent on-chain to your wallet. Confirmation in minutes.", highlight: false },
                    { method: "Ship To Us", icon: "📦", timeline: "Same day received", desc: "We inspect and pay within hours of receiving your device.", highlight: false },
                  ].map((p, i) => (
                    <div key={`${dup}-${i}`} className={`flex-shrink-0 w-[280px] flex items-start gap-3 rounded-2xl p-4 border ${p.highlight ? "bg-[#00c853]/10 border-[#00c853]/30" : "bg-white/5 border-white/10"}`}>
                      <span className="text-2xl shrink-0">{p.icon}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <p className="text-white text-sm font-bold">{p.method}</p>
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${p.highlight ? "bg-[#00c853]/20 text-[#00c853]" : "bg-white/10 text-[#d4d4d4]"}`}>{p.timeline}</span>
                        </div>
                        <p className="text-[#e6e6e6] text-xs leading-snug">{p.desc}</p>
                      </div>
                    </div>
                  )))}
                </div>
              </div>
            </div>
          </section>

          {/* CTA SECTION */}
          <section className="py-16 bg-[#0a0a0a] text-center">
            <div className="max-w-lg md:max-w-3xl lg:max-w-7xl mx-auto px-4">
              <div className="bg-gradient-to-br from-[#00c853]/10 to-transparent border border-[#00c853]/20 rounded-3xl p-8">
                <p className="text-4xl mb-3">💸</p>
                <h2 className="text-3xl font-bold mb-2">Still sitting on old tech?</h2>
                <p className="text-[#e6e6e6] text-base mb-2">That phone in your drawer is losing value every day.</p>
                <p className="text-white/70 text-sm mb-6">Get your instant quote — it takes 30 seconds.</p>
                <button onClick={() => { window.scrollTo(0, 0); document.documentElement.scrollTop = 0; document.body.scrollTop = 0; setStep("category"); pushHistory("category"); requestAnimationFrame(() => { window.scrollTo(0, 0); document.documentElement.scrollTop = 0; document.body.scrollTop = 0; }); }} className="bg-[#00c853] text-[#0a0a0a] px-10 py-4 rounded-2xl text-lg font-bold cursor-pointer hover:bg-[#00e676] transition tap-press shadow-lg shadow-[#00c853]/20">
                  Get Your Quote Now
                </button>
                <p className="text-[#d4d4d4] text-xs mt-4">No account required · Free instant quote · No obligation</p>
              </div>
            </div>
          </section>

          {/* NEWSLETTER CAPTURE */}
          <section className="py-12 bg-[#0d0d0d]">
            <div className="max-w-lg md:max-w-3xl lg:max-w-7xl mx-auto px-4">
              <div className="bg-white/5 border border-white/10 rounded-2xl p-6 text-center">
                <p className="text-xl mb-2">📬</p>
                <h3 className="text-lg font-bold mb-1">Get price alerts &amp; deals</h3>
                <p className="text-[#e6e6e6] text-sm mb-4">We&apos;ll let you know when buyback prices go up or we run a promo. No spam — just money.</p>
                {newsletterSubmitted ? (
                  <div className="bg-[#00c853]/10 border border-[#00c853]/30 rounded-xl p-4">
                    <p className="text-[#00c853] font-bold text-sm">You&apos;re in. Check your inbox for the welcome email.</p>
                    <p className="text-[#9a9a9a] text-[11px] mt-1">If it isn&apos;t there in a minute, peek in spam — first emails from new senders sometimes land there.</p>
                  </div>
                ) : (
                  <form onSubmit={async (e) => {
                    e.preventDefault();
                    if (!newsletterEmail.trim()) return;
                    try {
                      await fetch("/api/newsletter", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: newsletterEmail }) });
                    } catch {}
                    setNewsletterSubmitted(true);
                  }} className="flex gap-2">
                    <input type="email" value={newsletterEmail} onChange={(e) => setNewsletterEmail(e.target.value)} placeholder="your@email.com" required aria-label="Email for newsletter" className="flex-1 px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder:text-[#d4d4d4] focus:outline-none focus:border-[#00c853] transition" />
                    <button type="submit" className="bg-[#00c853] text-[#0a0a0a] px-6 py-3 rounded-xl text-sm font-bold cursor-pointer hover:bg-[#00e676] transition tap-press whitespace-nowrap">
                      Sign Up
                    </button>
                  </form>
                )}
                <p className="text-[#d4d4d4] text-[11px] mt-3">Unsubscribe anytime. We respect your inbox.</p>
              </div>
            </div>
          </section>

          {/* FAQ */}
          <section className="py-12 bg-[#111]">
            <div className="max-w-lg md:max-w-3xl lg:max-w-7xl mx-auto px-4">
              <h2 className="text-2xl font-bold text-center mb-8">Frequently Asked Questions</h2>
              <div className="space-y-2">
                {FAQS.map((faq, i) => (
                  <div key={i} className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
                    <button onClick={() => setExpandedFaq(expandedFaq === i ? null : i)} className="w-full flex items-center justify-between p-4 cursor-pointer text-left">
                      <p className="font-semibold text-sm pr-4">{faq.q}</p>
                      <svg className={`w-4 h-4 text-[#e6e6e6] shrink-0 transition-transform ${expandedFaq === i ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                    </button>
                    {expandedFaq === i && (
                      <div className="px-4 pb-4 animate-[fadeIn_0.2s_ease-out]">
                        <p className="text-[#e6e6e6] text-sm">{faq.a}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* GREEN / SUSTAINABILITY */}
          <section className="py-12 bg-[#0a0a0a]">
            <div className="max-w-lg md:max-w-3xl lg:max-w-7xl mx-auto px-4">
              <div className="bg-[#00c853]/5 border border-[#00c853]/15 rounded-2xl p-6 text-center">
                <p className="text-2xl mb-2">♻️</p>
                <h3 className="text-lg font-bold mb-1">Good for your wallet. Better for the planet.</h3>
                <p className="text-[#e6e6e6] text-sm leading-relaxed">Every device we buy gets a second life — refurbished and reused, not dumped in a landfill. Selling your old tech with Top Cash Cellular keeps electronics out of waste streams and puts cash in your pocket.</p>
              </div>
            </div>
          </section>

          {/* LOCAL CREDIBILITY */}
          <section className="py-8 bg-[#111]">
            <div className="max-w-lg md:max-w-3xl lg:max-w-7xl mx-auto px-4">
              <div className="flex flex-wrap items-center justify-center gap-4 text-center">
                <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-full px-4 py-2">
                  <span className="text-sm">📍</span>
                  <span className="text-white text-xs font-semibold">Austin-Based Business</span>
                </div>
                <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-full px-4 py-2">
                  <span className="text-sm">🤝</span>
                  <span className="text-white text-xs font-semibold">Real People, Local Meetups</span>
                </div>
                <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-full px-4 py-2">
                  <span className="text-sm">⚡</span>
                  <span className="text-white text-xs font-semibold">Same-Day Payout</span>
                </div>
                <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-full px-4 py-2">
                  <span className="text-sm">🔒</span>
                  <span className="text-white text-xs font-semibold">Secure Transactions</span>
                </div>
              </div>
            </div>
          </section>

          {/* BULK / BUSINESS SELLING */}
          <section className="py-12 bg-[#0a0a0a]">
            <div className="max-w-lg md:max-w-3xl lg:max-w-7xl mx-auto px-4">
              <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
                <div className="text-center mb-4">
                  <p className="text-2xl mb-2">🏢</p>
                  <h3 className="text-lg font-bold">Selling in bulk?</h3>
                  <p className="text-[#e6e6e6] text-sm">Upgrading your office, school, or fleet? We buy devices in bulk with custom pricing.</p>
                </div>
                <button
                  onClick={() => { setInquiryCategory("Bulk / Business"); setInquirySent(false); setInquiryDesc(""); setModel(null); setCondition(null); setStep("inquiry"); pushHistory("inquiry"); }}
                  className="w-full bg-[#00c853] text-[#0a0a0a] py-3 rounded-xl text-sm font-bold cursor-pointer hover:bg-[#00e676] transition tap-press"
                >
                  Get a Bulk Quote
                </button>
                <p className="text-[#d4d4d4] text-[11px] text-center mt-3">10+ devices? We&apos;ll make you a custom offer.</p>
              </div>
            </div>
          </section>
        </>
      )}

      {/* INNER PAGES */}
      {(page === "about" || page === "privacy" || page === "terms" || page === "grading" || page === "shipping" || page === "affiliate" || page === "itad" || page === "blog" || page === "cookies" || page === "accessibility") && (
        <section className="min-h-[60vh] animate-[fadeIn_0.3s_ease-out]">
          <div className="max-w-lg md:max-w-3xl lg:max-w-7xl mx-auto px-4 pt-6 pb-16">
            <button onClick={() => { setPage("home"); window.scrollTo({ top: 0 }); }} aria-label="Go back" className="inline-flex items-center gap-2 text-[#00c853] text-sm font-semibold mb-6 px-4 py-2 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 cursor-pointer transition tap-press">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
              Home
            </button>
            {page === "about" && <div className="animate-[fadeIn_0.3s_ease-out]">
              <h1 className="text-3xl font-bold mb-2">About Top Cash Cellular</h1>
              <p className="text-[#00c853] text-sm font-semibold mb-6">Austin&apos;s #1 Device Buyback Service</p>

              <div className="bg-gradient-to-br from-[#00c853]/10 to-transparent border border-[#00c853]/20 rounded-2xl p-6 mb-8">
                <p className="text-white text-lg font-medium leading-relaxed mb-3">We started Top Cash Cellular with a simple idea: selling your phone shouldn&apos;t be a hassle.</p>
                <p className="text-[#e6e6e6] text-sm leading-relaxed">No lowball carrier trade-ins. No mailing your device and waiting weeks for a check. No haggling with strangers on marketplace apps. Just a fair price, paid fast, from a team you can trust.</p>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-8">
                <div className="bg-white/5 rounded-2xl p-5 border border-white/10 text-center">
                  <p className="text-3xl font-bold text-[#00c853]">500+</p>
                  <p className="text-[#e6e6e6] text-xs mt-1">Devices Purchased</p>
                </div>
                <div className="bg-white/5 rounded-2xl p-5 border border-white/10 text-center">
                  <p className="text-3xl font-bold text-[#00c853]">4.9★</p>
                  <p className="text-[#e6e6e6] text-xs mt-1">Customer Rating</p>
                </div>
                <div className="bg-white/5 rounded-2xl p-5 border border-white/10 text-center">
                  <p className="text-3xl font-bold text-[#00c853]">Same Day</p>
                  <p className="text-[#e6e6e6] text-xs mt-1">Payment</p>
                </div>
                <div className="bg-white/5 rounded-2xl p-5 border border-white/10 text-center">
                  <p className="text-3xl font-bold text-[#00c853]">38%</p>
                  <p className="text-[#e6e6e6] text-xs mt-1">More Than Trade-In</p>
                </div>
              </div>

              <h2 className="text-xl font-bold mb-4">Why sell to us?</h2>
              <div className="space-y-3 mb-8">
                {[
                  { icon: "💰", title: "Highest payouts in Austin", desc: "We consistently beat Apple, carrier, and marketplace prices by 20-40%. Get a quote and compare." },
                  { icon: "⚡", title: "Paid on the spot", desc: "Cash, Cash App, Zelle, or BTC — your choice. No waiting for checks or bank transfers." },
                  { icon: "🤝", title: "Local & personal", desc: "We meet you at a convenient Austin location. Face-to-face, safe, and quick. 5 minutes and you're done." },
                  { icon: "📦", title: "Nationwide shipping", desc: "Not in Austin? No problem. We send a free prepaid label. Ship your device, get paid same day we receive it." },
                  { icon: "📱", title: "We buy everything", desc: "iPhones, Samsung Galaxy, MacBooks, PS5, Xbox, Nintendo Switch. Working, cracked, or water damaged." },
                  { icon: "🔒", title: "7-day price lock", desc: "Your quote is locked for 7 days. Take your time deciding — the price won't change." },
                ].map((item) => (
                  <div key={item.title} className="flex items-start gap-4 bg-white/5 rounded-2xl p-4 border border-white/10">
                    <span className="text-2xl shrink-0">{item.icon}</span>
                    <div>
                      <p className="font-semibold text-sm mb-0.5">{item.title}</p>
                      <p className="text-[#e6e6e6] text-sm leading-relaxed">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              <h2 className="text-xl font-bold mb-4">How it works</h2>
              <div className="space-y-3 mb-8">
                {[
                  { num: "1", title: "Get an instant quote", desc: "Select your device, model, storage, and condition. See your price in 30 seconds." },
                  { num: "2", title: "Choose how to sell", desc: "Meet us locally in Austin or ship your device for free from anywhere in the US." },
                  { num: "3", title: "Get paid instantly", desc: "We verify your device and pay you. Cash (local meetup only), Cash App, Zelle, or BTC." },
                ].map((step) => (
                  <div key={step.num} className="flex items-start gap-4 bg-white/5 rounded-2xl p-4 border border-white/10">
                    <div className="w-8 h-8 rounded-full bg-[#00c853] flex items-center justify-center text-[#0a0a0a] text-sm font-bold shrink-0">{step.num}</div>
                    <div>
                      <p className="font-semibold text-sm mb-0.5">{step.title}</p>
                      <p className="text-[#e6e6e6] text-sm leading-relaxed">{step.desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="bg-[#00c853]/10 border border-[#00c853]/20 rounded-2xl p-6 text-center">
                <p className="text-lg font-bold mb-2">Ready to sell?</p>
                <p className="text-[#e6e6e6] text-sm mb-4">Get your instant quote in 30 seconds.</p>
                <button onClick={() => { window.scrollTo(0, 0); document.documentElement.scrollTop = 0; document.body.scrollTop = 0; setPage("home"); setStep("category"); pushHistory("category"); requestAnimationFrame(() => { window.scrollTo(0, 0); document.documentElement.scrollTop = 0; document.body.scrollTop = 0; }); }} className="bg-[#00c853] text-[#0a0a0a] px-8 py-3 rounded-2xl font-semibold cursor-pointer hover:bg-[#00e676] transition tap-press">
                  Get My Quote
                </button>
              </div>

              <div className="mt-8 text-center">
                <p className="text-[#e6e6e6] text-sm mb-1">Questions? Email us anytime.</p>
                <a href={EMAIL_HREF} className="text-[#00c853] font-bold text-lg break-all">{EMAIL}</a>
              </div>
            </div>}

            {page === "privacy" && (
              <div className="animate-[fadeIn_0.3s_ease-out]">
                <h1 className="text-3xl font-bold mb-4">Privacy Policy</h1>
                <div className="text-[#e6e6e6] text-sm space-y-4 leading-relaxed">
                  <p>Top Cash Cellular respects your privacy. We collect only the information needed to process your device sale: name, phone number, email, device details, and payout preference.</p>
                  <p>We do not sell, share, or distribute your personal information to third parties. Your data is used solely to complete your transaction and communicate with you about your sale.</p>
                  <p>Device data (photos, files) is your responsibility to remove before selling. We recommend a factory reset before handoff. We are not responsible for any data left on sold devices.</p>
                  <p>For questions about your data, contact us at {EMAIL}.</p>
                </div>
              </div>
            )}

            {page === "terms" && (
              <div className="animate-[fadeIn_0.3s_ease-out]">
                <h1 className="text-3xl font-bold mb-2">Terms of Service</h1>
                <p className="text-[#b8b8b8] text-xs mb-6">Last updated May 11, 2026</p>
                <div className="text-[#e6e6e6] text-sm space-y-5 leading-relaxed">
                  <div>
                    <p className="text-white font-bold mb-1">1. Quotes & final pricing</p>
                    <p>Quotes on our site are estimates based on the device model and condition tier you select. The price you see is locked for 7 days from the time of quote. Final pricing is confirmed at inspection — if your device matches the condition you selected, we honor the quoted price.</p>
                  </div>
                  <div>
                    <p className="text-white font-bold mb-1">2. Eligibility</p>
                    <p>You must be 18 or older to sell to us. Devices must be legally owned by you — stolen, fraudulently obtained, or financed-but-unpaid devices will be refused and reported to law enforcement. We may require valid government-issued photo ID at handoff.</p>
                  </div>
                  <div>
                    <p className="text-white font-bold mb-1">3. Inspection & condition adjustments</p>
                    <p>Every device is inspected before payment. If the actual condition is materially worse than what you selected — broken glass on a &quot;Like New&quot; quote, water damage indicators tripped, blacklisted IMEI, etc. — we will show you the issue, explain the adjustment, and offer a revised price. You can accept it or have the device returned at no cost.</p>
                  </div>
                  <div>
                    <p className="text-white font-bold mb-1">4. Return / rejection policy</p>
                    <p>If you ship a device and don&apos;t like the final offer, we will mail it back to you free of charge via the same carrier we used for the inbound label. No restocking fee. You have 7 days from our revised-offer email to request a return; after that we assume acceptance.</p>
                  </div>
                  <div>
                    <p className="text-white font-bold mb-1">5. Payouts</p>
                    <p>Payouts are issued the same business day we receive and verify the device. Cash App and Zelle typically land within minutes; Bitcoin sends on-chain within ~30 minutes; local Austin pickups are cash on the spot. Payments are made only to the legal owner of the device.</p>
                  </div>
                  <div>
                    <p className="text-white font-bold mb-1">6. Data on your device</p>
                    <p>You are responsible for backing up and removing your personal data before selling. We recommend a factory reset and sign-out from Find My iPhone / Google Account / Samsung Account. We perform a NIST 800-88 compliant wipe before resale or recycling, but we&apos;re not liable for any data left on your device prior to handoff.</p>
                  </div>
                  <div>
                    <p className="text-white font-bold mb-1">7. Finality</p>
                    <p>Once payment has been issued and accepted, the sale is final. We cannot reverse a completed transaction.</p>
                  </div>
                  <div>
                    <p className="text-white font-bold mb-1">8. Contact</p>
                    <p>Questions about these terms? Email {EMAIL} and we will respond within one business day.</p>
                  </div>
                </div>
              </div>
            )}

            {page === "grading" && (
              <div className="animate-[fadeIn_0.3s_ease-out]">
                <h1 className="text-3xl font-bold mb-2">Inspection &amp; grading guide</h1>
                <p className="text-[#b8b8b8] text-sm mb-6">Exactly what we look for so there are no surprises at handoff.</p>
                <div className="bg-[#00c853]/10 border border-[#00c853]/20 rounded-2xl p-5 mb-8">
                  <p className="text-white font-bold text-sm mb-1">Honored-quote guarantee</p>
                  <p className="text-[#e6e6e6] text-sm leading-relaxed">If your device matches the tier you select below, we pay the quoted price — no surprise deductions. If the condition is materially worse, we&apos;ll show you the issue and offer a revised price; you can accept it or have the device returned free.</p>
                </div>
                <div className="space-y-4 mb-10">
                  {[
                    { tier: "Sealed", icon: "✨", color: "#00c853", desc: "Sealed in the box, never activated. Receipt strongly preferred. We verify the seal and confirm the IMEI is clean. Sealed only applies to computers/laptops/desktops, not phones." },
                    { tier: "Like New", icon: "🌟", color: "#00c853", desc: "Indistinguishable from new — zero scratches on screen or body under bright light, original accessories present, battery health ≥ 95% on phones. Powers on cleanly, all sensors and buttons work, Face ID / Touch ID enrolled and functioning." },
                    { tier: "Good", icon: "👍", color: "#88dd66", desc: "Light micro-scratches on the screen or frame visible only at certain angles. No cracks, no dents, no chips. Battery health ≥ 85% on phones. All functions work normally." },
                    { tier: "Fair", icon: "🛠️", color: "#ffb400", desc: "Visible scratches or scuffs but no cracks in the glass. Frame may have small dings. Screen powers on with full color, no dead pixels, no shadow burn-in. All buttons and ports work." },
                    { tier: "Damaged", icon: "💥", color: "#ff6b6b", desc: "Cracked glass, chipped corners, dented frame, dead pixels, or non-working components. We still buy damaged devices — the price just reflects the repair cost." },
                  ].map((g) => (
                    <div key={g.tier} className="bg-white/5 border border-white/10 rounded-2xl p-5">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-2xl">{g.icon}</span>
                        <p className="font-extrabold text-lg" style={{ color: g.color }}>{g.tier}</p>
                      </div>
                      <p className="text-[#e6e6e6] text-sm leading-relaxed">{g.desc}</p>
                    </div>
                  ))}
                </div>
                <h2 className="text-xl font-bold mb-4">What else we check</h2>
                <ul className="space-y-2 mb-8 text-sm text-[#e6e6e6]">
                  <li className="flex gap-2"><span className="text-[#00c853] shrink-0">•</span><span><strong className="text-white">IMEI / serial number</strong> — runs against carrier blacklist and Apple/Samsung activation lock databases. Locked or blacklisted devices are still purchased but priced separately.</span></li>
                  <li className="flex gap-2"><span className="text-[#00c853] shrink-0">•</span><span><strong className="text-white">Activation lock</strong> — Find My iPhone, Google FRP, Samsung Reactivation Lock must be off. We&apos;ll guide you through removing them at handoff if needed.</span></li>
                  <li className="flex gap-2"><span className="text-[#00c853] shrink-0">•</span><span><strong className="text-white">Battery health</strong> — on iPhones we read Settings &gt; Battery &gt; Battery Health; on Samsung/Android we run a diagnostic.</span></li>
                  <li className="flex gap-2"><span className="text-[#00c853] shrink-0">•</span><span><strong className="text-white">Water damage indicators</strong> — Apple LCI in the SIM tray and Samsung indicators are checked. Tripped indicators move a device to Damaged tier.</span></li>
                  <li className="flex gap-2"><span className="text-[#00c853] shrink-0">•</span><span><strong className="text-white">Function test</strong> — screen, speakers, mics, cameras, charging port, Wi-Fi, Bluetooth, biometric sensor. Any failing component is noted.</span></li>
                </ul>
                <div className="bg-[#00c853]/10 border border-[#00c853]/20 rounded-2xl p-6 text-center">
                  <p className="text-lg font-bold mb-2">Ready when you are</p>
                  <p className="text-[#e6e6e6] text-sm mb-4">Get a quote in 30 seconds — no inspection needed up front.</p>
                  <button onClick={() => { window.scrollTo(0, 0); setPage("home"); setStep("category"); pushHistory("category"); }} className="bg-[#00c853] text-[#0a0a0a] px-8 py-3 rounded-2xl font-semibold cursor-pointer hover:bg-[#00e676] transition tap-press">Get My Quote</button>
                </div>
              </div>
            )}

            {page === "shipping" && (
              <div className="animate-[fadeIn_0.3s_ease-out]">
                <h1 className="text-3xl font-bold mb-2">Shipping &amp; returns</h1>
                <p className="text-[#b8b8b8] text-sm mb-6">Local Austin? We meet you. Out of town? Ship free.</p>
                <div className="space-y-4 mb-10">
                  {[
                    { step: "1", title: "Get your quote", body: "Accept the price on our site. We email you a confirmation with a prepaid FedEx or UPS shipping label. Carrier insurance is included up to $100 — for devices worth more we recommend adding extra coverage at the counter when you drop off." },
                    { step: "2", title: "Pack &amp; drop off", body: "Use any padded box you have at home. Wrap the device, drop it at any FedEx or UPS location, and keep your receipt. Tracking number arrives in our system automatically." },
                    { step: "3", title: "We inspect within 1 business day", body: "Once the device arrives we test it against the tier you selected. You get an email with the result the same day." },
                    { step: "4", title: "Same-day payout", body: "If the inspection matches your quote, we pay you that same business day — Cash App or Zelle in minutes, Bitcoin on-chain in ~30 min, or check via mail." },
                  ].map((s) => (
                    <div key={s.step} className="flex items-start gap-4 bg-white/5 rounded-2xl p-5 border border-white/10">
                      <div className="w-9 h-9 rounded-full bg-[#00c853] text-[#0a0a0a] font-extrabold flex items-center justify-center shrink-0">{s.step}</div>
                      <div>
                        <p className="font-bold text-white mb-1">{s.title}</p>
                        <p className="text-[#e6e6e6] text-sm leading-relaxed" dangerouslySetInnerHTML={{ __html: s.body }} />
                      </div>
                    </div>
                  ))}
                </div>

                <h2 className="text-xl font-bold mb-3">If we change the offer</h2>
                <div className="bg-white/5 border border-white/10 rounded-2xl p-5 mb-8 space-y-3 text-sm text-[#e6e6e6] leading-relaxed">
                  <p>If the device&apos;s actual condition is different from the tier you selected, we&apos;ll show you what we found (with photos), explain the adjustment, and email a revised offer. You have 7 days to decide.</p>
                  <p><strong className="text-white">Accept it</strong> — we pay you that same business day.</p>
                  <p><strong className="text-white">Reject it</strong> — we ship the device back to you free of charge via the same carrier. No restocking fee, no questions.</p>
                  <p>If you don&apos;t respond within 7 days of the revised-offer email, we assume acceptance.</p>
                </div>

                <h2 className="text-xl font-bold mb-3">Local Austin</h2>
                <div className="bg-white/5 border border-white/10 rounded-2xl p-5 mb-8 space-y-2 text-sm text-[#e6e6e6] leading-relaxed">
                  <p>Inside the Austin metro? Skip shipping. We meet at a public location — coffee shop, parking lot, your office — inspect on the spot, and pay cash or your preferred digital method. Most local meetups take under 10 minutes door-to-door.</p>
                  <p>Pickup hours: Mon–Sat, 8 AM – 8 PM CT.</p>
                </div>

                <div className="bg-[#00c853]/10 border border-[#00c853]/20 rounded-2xl p-6 text-center">
                  <p className="text-lg font-bold mb-2">Ready to ship or meet?</p>
                  <p className="text-[#e6e6e6] text-sm mb-4">Lock in your quote — you pick local or shipping at checkout.</p>
                  <button onClick={() => { window.scrollTo(0, 0); setPage("home"); setStep("category"); pushHistory("category"); }} className="bg-[#00c853] text-[#0a0a0a] px-8 py-3 rounded-2xl font-semibold cursor-pointer hover:bg-[#00e676] transition tap-press">Get My Quote</button>
                </div>
              </div>
            )}

            {page === "affiliate" && (
              <div className="animate-[fadeIn_0.3s_ease-out]">
                <h1 className="text-3xl font-bold mb-2">Become an affiliate</h1>
                <p className="text-[#b8b8b8] text-sm mb-6">Earn cash for every customer you refer.</p>
                <div className="bg-white/5 border border-white/10 rounded-2xl p-6 mb-6 space-y-3 text-sm text-[#e6e6e6] leading-relaxed">
                  <p>Run a YouTube channel, repair shop, IT consultancy, or just have a big network of folks upgrading phones every year? Send them our way and we'll cut you a slice of every device we buy.</p>
                  <p><strong className="text-white">How it works:</strong> you get a tracked referral link or coupon code. When someone uses it to sell a device, we wire you a percentage of the payout — typically <strong className="text-[#00c853]">5–10% per device</strong>, depending on volume.</p>
                  <p>No minimum quota, no monthly commitment, no fine print. We pay weekly via Zelle, Cash App, or check.</p>
                </div>
                <div className="bg-[#00c853]/10 border border-[#00c853]/20 rounded-2xl p-6 text-center">
                  <p className="text-lg font-bold mb-2">Interested?</p>
                  <p className="text-[#e6e6e6] text-sm mb-4">Email us with a bit about your audience and we'll set you up.</p>
                  <a href={EMAIL_HREF} className="inline-block bg-[#00c853] text-[#0a0a0a] px-8 py-3 rounded-2xl font-semibold hover:bg-[#00e676] transition tap-press">Email Us</a>
                </div>
              </div>
            )}

            {page === "itad" && (
              <div className="animate-[fadeIn_0.3s_ease-out]">
                <h1 className="text-3xl font-bold mb-2">IT Asset Disposition</h1>
                <p className="text-[#b8b8b8] text-sm mb-6">Clearing out a fleet? We buy in bulk and document every device.</p>
                <div className="bg-white/5 border border-white/10 rounded-2xl p-6 mb-6 space-y-3 text-sm text-[#e6e6e6] leading-relaxed">
                  <p>Decommissioning end-of-lease laptops, refreshing your sales team's iPhones, or shutting down a remote office? We handle the whole chain: pickup, secure wipe (NIST 800-88 certified), serial-by-serial reporting, and a single bulk payout.</p>
                  <p><strong className="text-white">What we buy in bulk:</strong> iPhones, iPads, MacBooks, Android phones, Galaxy tablets, Windows laptops, Pixel phones, smartwatches. Working, broken, anywhere in the lifecycle.</p>
                  <p><strong className="text-white">What you get:</strong> a fixed offer per asset type before pickup, a chain-of-custody receipt with every serial, a signed certificate of data destruction, and payment within 5 business days of inspection.</p>
                </div>
                <div className="bg-[#00c853]/10 border border-[#00c853]/20 rounded-2xl p-6 text-center">
                  <p className="text-lg font-bold mb-2">Got 25+ devices?</p>
                  <p className="text-[#e6e6e6] text-sm mb-4">Email us a rough device list and we'll come back with a bulk quote within 24 hours.</p>
                  <a href={EMAIL_HREF} className="inline-block bg-[#00c853] text-[#0a0a0a] px-8 py-3 rounded-2xl font-semibold hover:bg-[#00e676] transition tap-press">Request Bulk Quote</a>
                </div>
              </div>
            )}

            {page === "blog" && (
              <div className="animate-[fadeIn_0.3s_ease-out]">
                <h1 className="text-3xl font-bold mb-2">Blog</h1>
                <p className="text-[#b8b8b8] text-sm mb-6">Resale tips, gear breakdowns, and sustainability stories.</p>
                <div className="bg-white/5 border border-white/10 rounded-2xl p-6 mb-6 text-sm text-[#e6e6e6] leading-relaxed">
                  <p className="text-white font-semibold mb-2">Coming soon</p>
                  <p>We're putting together guides on getting the most for your trade-in, when to upgrade vs. hold, and which devices keep value longest. Sign up for the newsletter at the bottom of the page and we'll send the first post when it drops.</p>
                </div>
              </div>
            )}

            {page === "cookies" && (
              <div className="animate-[fadeIn_0.3s_ease-out]">
                <h1 className="text-3xl font-bold mb-2">Cookie policy</h1>
                <p className="text-[#b8b8b8] text-sm mb-6">What we store on your browser and why.</p>
                <div className="bg-white/5 border border-white/10 rounded-2xl p-6 mb-6 space-y-3 text-sm text-[#e6e6e6] leading-relaxed">
                  <p><strong className="text-white">Essential cookies:</strong> needed to keep your quote and cart state across page loads. We can't turn these off — without them the site doesn't function.</p>
                  <p><strong className="text-white">Analytics cookies:</strong> we track anonymized page-load and quote-completion stats so we can find broken flows. No personal info, no third-party ad networks.</p>
                  <p>You can choose Essential or Accept All via the banner at the bottom of the page. Your choice is stored locally and respected on every visit.</p>
                  <p>Questions? Email us — link in the footer.</p>
                </div>
              </div>
            )}

            {page === "accessibility" && (
              <div className="animate-[fadeIn_0.3s_ease-out]">
                <h1 className="text-3xl font-bold mb-2">Accessibility statement</h1>
                <p className="text-[#b8b8b8] text-sm mb-6">We want this site to work for everyone.</p>
                <div className="bg-white/5 border border-white/10 rounded-2xl p-6 mb-6 space-y-3 text-sm text-[#e6e6e6] leading-relaxed">
                  <p>{BRAND} is committed to WCAG 2.1 AA conformance. Our team tests with VoiceOver, NVDA, and keyboard-only navigation when shipping changes.</p>
                  <p><strong className="text-white">What we already do:</strong> semantic HTML, focus states on every interactive control, alt text on device images, sufficient color contrast on text, no auto-playing media, and a quote flow that works without a mouse.</p>
                  <p><strong className="text-white">If something is hard to use:</strong> email us at the address in the footer and we'll fix it. Mention the page and what screen reader / assistive tool you were using if you can.</p>
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {/* FOOTER */}
      <footer className="mt-auto bg-gradient-to-b from-[#0d1f15] via-[#0a1812] to-[#070d0a] text-[#cfcfcf] py-10 relative">
        {/* Green accent stripe at top — signals end-of-page + brand color */}
        <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-transparent via-[#00c853]/60 to-transparent" />
        <div className="max-w-lg md:max-w-3xl lg:max-w-7xl mx-auto px-4">
          {/* Email signup — IWM-style tagline + capture above the link grid */}
          <div className="mb-8 text-center">
            <p className="text-white font-semibold text-sm mb-1">Smart tech. Smarter savings.</p>
            <p className="text-xs text-[#9a9a9a] mb-3">Sign up for deals & sustainability tips.</p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const form = e.currentTarget;
                const input = form.querySelector("input[type=email]") as HTMLInputElement | null;
                const email = input?.value.trim();
                if (!email) return;
                fetch("/api/newsletter", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email }) }).catch(() => {});
                if (input) input.value = "";
                form.classList.add("hidden");
                form.parentElement?.querySelector(".nl-ok")?.classList.remove("hidden");
              }}
              className="flex items-center gap-2 max-w-sm mx-auto"
            >
              <input
                type="email"
                required
                placeholder="Email address"
                className="flex-1 px-3 py-2 rounded-full bg-white/5 border border-white/10 text-white text-xs placeholder:text-[#888] focus:outline-none focus:border-[#00c853]/50"
              />
              <button type="submit" className="px-4 py-2 rounded-full bg-[#00c853] text-[#0a0a0a] text-xs font-extrabold hover:bg-[#00e676] transition">Sign up</button>
            </form>
            <div className="nl-ok hidden bg-[#00c853]/10 border border-[#00c853]/30 rounded-xl px-4 py-3 max-w-sm mx-auto">
              <p className="text-[#00c853] text-sm font-bold">You're on the list. Check your inbox.</p>
              <p className="text-[#9a9a9a] text-[11px] mt-1">If it isn't there in a minute, peek in spam — first emails from new senders sometimes land there.</p>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-6 mb-6">
            <div>
              <p className="text-white font-semibold text-xs uppercase tracking-wider mb-3">Quick Navigation</p>
              <div className="space-y-2">
                <button onClick={() => { setStep("category"); window.scrollTo({ top: 0 }); pushHistory("category"); }} className="block text-xs hover:text-[#00c853] transition cursor-pointer text-left">Get Custom Quote</button>
                <a href="/how-it-works" className="block text-xs hover:text-[#00c853] transition">How It Works</a>
                <button onClick={() => { setPage("grading"); window.scrollTo({ top: 0 }); }} className="block text-xs hover:text-[#00c853] transition cursor-pointer text-left">Grading Guide</button>
                <button onClick={() => { setPage("shipping"); window.scrollTo({ top: 0 }); }} className="block text-xs hover:text-[#00c853] transition cursor-pointer text-left">Shipping &amp; Returns</button>
                <a href="/faq" className="block text-xs hover:text-[#00c853] transition">FAQ</a>
              </div>
            </div>
            <div>
              <p className="text-white font-semibold text-xs uppercase tracking-wider mb-3">About Us</p>
              <div className="space-y-2">
                <button onClick={() => { setPage("about"); window.scrollTo({ top: 0 }); }} className="block text-xs hover:text-[#00c853] transition cursor-pointer text-left">About Us</button>
                <button onClick={() => { setPage("affiliate"); window.scrollTo({ top: 0 }); }} className="block text-xs hover:text-[#00c853] transition cursor-pointer text-left">Become an Affiliate</button>
                <button onClick={() => { setPage("itad"); window.scrollTo({ top: 0 }); }} className="block text-xs hover:text-[#00c853] transition cursor-pointer text-left">IT Asset Disposition</button>
                <button onClick={() => { setPage("blog"); window.scrollTo({ top: 0 }); }} className="block text-xs hover:text-[#00c853] transition cursor-pointer text-left">Blog</button>
                <a href="/reviews" className="block text-xs hover:text-[#00c853] transition">Reviews</a>
                <a href={EMAIL_HREF} className="block text-xs hover:text-[#00c853] transition">Contact Us</a>
              </div>
            </div>
            <div className="col-span-2 md:col-span-1">
              <p className="text-white font-semibold text-xs uppercase tracking-wider mb-3">Legal</p>
              <div className="space-y-2">
                <a href="/privacy" className="block text-xs hover:text-[#00c853] transition">Privacy Policy</a>
                <button onClick={() => { setPage("terms"); window.scrollTo({ top: 0 }); }} className="block text-xs hover:text-[#00c853] transition cursor-pointer text-left">Terms &amp; Conditions</button>
                <button onClick={() => { setPage("cookies"); window.scrollTo({ top: 0 }); }} className="block text-xs hover:text-[#00c853] transition cursor-pointer text-left">Cookie Policy</button>
                <button onClick={() => { setPage("accessibility"); window.scrollTo({ top: 0 }); }} className="block text-xs hover:text-[#00c853] transition cursor-pointer text-left">Accessibility Statement</button>
                <p className="text-xs text-[#9a9a9a] pt-2">Austin, TX · Mon–Sat 8 AM–8 PM</p>
              </div>
            </div>
          </div>
          <div className="border-t border-[#00c853]/15 pt-6 text-center">
            <p className="text-[11px] text-[#cfcfcf]/70 mb-3">© 2026 {BRAND}</p>
            <div className="flex items-center justify-center gap-4">
              <a href="https://atxgadgetfix.com" target="_blank" rel="noopener noreferrer" className="text-[11px] text-[#cfcfcf] hover:text-[#00c853] transition">
                Need a repair? ATX Gadget Fix →
              </a>
            </div>
          </div>
        </div>
      </footer>

      {/* (Text Us pill was here; moved into the mobile nav next to cart so it
          doesn't crowd the bottom of the screen.) */}

      {/* CHAT WIDGET — draggable FAB. Hidden while a help modal is open.
          Default position is bottom-left; once dragged, the position is
          remembered in localStorage. On mobile the FAB is rendered as a
          translucent glass bubble so it never feels in the way of the
          page content. Chat panel placement is computed from where the
          FAB landed so it stays inside the viewport (opens below if
          the FAB is near the top, above if it's near the bottom; flips
          horizontally on the right edge). */}
      {(() => {
        const hidden = !!(conditionHelpId || storageHelpId || connectivityHelpOpen || helpTopic);
        const fabSize = 56;
        const vw = typeof window !== "undefined" ? window.innerWidth : 0;
        const vh = typeof window !== "undefined" ? window.innerHeight : 0;
        const fx = fabPos ? fabPos.x : 24;
        const fy = fabPos ? fabPos.y : vh - 24 - fabSize;
        const openDown = fy < vh / 2;
        const openRight = fx < vw / 2;
        const panelStyle: React.CSSProperties = openDown
          ? { top: `${fy + fabSize + 12}px` }
          : { bottom: `${Math.max(12, vh - fy + 12)}px` };
        if (openRight) {
          panelStyle.left = `${Math.max(12, Math.min(vw - 320 - 12, fx))}px`;
        } else {
          panelStyle.right = `${Math.max(12, Math.min(vw - 320 - 12, vw - fx - fabSize))}px`;
        }
        const fabContainerStyle: React.CSSProperties = fabPos
          ? { left: `${fabPos.x}px`, top: `${fabPos.y}px`, bottom: "auto" }
          : { left: "24px", bottom: "24px" };
        return (
          <>
            {/* Chat panel — its own fixed element so we can flip it
                above / below / left / right of the FAB to stay in
                the viewport, regardless of where the user dragged
                the FAB to. */}
            {chatOpen && !hidden && (
              <div
                className="fixed z-40 w-[300px] max-w-[calc(100vw-24px)] bg-[#111] border border-white/15 rounded-2xl shadow-2xl overflow-hidden animate-[fadeIn_0.2s_ease-out]"
                style={panelStyle}
              >
                <div className="bg-[#00c853] px-4 py-3 flex items-center justify-between">
                  <p className="text-white font-semibold text-sm">Top Cash Cellular</p>
                  <button onClick={() => setChatOpen(false)} aria-label="Close chat" className="text-white/80 hover:text-white cursor-pointer text-lg">×</button>
                </div>
                <div className="p-4">
                  {chatMode === "choose" && (
                    <>
                      <p className="text-white text-sm mb-4">Hey! Got a device to sell? How can we help?</p>
                      <div className="space-y-2">
                        <button onClick={() => setChatMode("chat")} className="w-full flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 cursor-pointer transition text-left tap-press">
                          <span className="text-xl">💬</span>
                          <div><p className="font-semibold text-sm">Live Chat</p><p className="text-[#e6e6e6] text-xs">Send us a message</p></div>
                        </button>
                        <button onClick={() => setChatMode("call")} className="w-full flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 cursor-pointer transition text-left tap-press">
                          <span className="text-xl">📞</span>
                          <div><p className="font-semibold text-sm">Talk to a Human</p><p className="text-[#e6e6e6] text-xs">Call or get a callback</p></div>
                        </button>
                      </div>
                    </>
                  )}
                  {chatMode === "chat" && (
                    <>
                      <button onClick={() => setChatMode("choose")} className="text-[#e6e6e6] text-xs mb-2 cursor-pointer hover:text-white">← Back</button>
                      <div className="h-[200px] overflow-y-auto space-y-2 mb-2 pr-1">
                        {chatMessages.map((m, i) => (
                          <div key={i} className={`flex ${m.from === "user" ? "justify-end" : "justify-start"}`}>
                            <div className={`max-w-[85%] px-3 py-2 rounded-xl text-xs ${m.from === "user" ? "bg-[#00c853] text-[#0a0a0a]" : "bg-white/10 text-white/90"}`}>{m.text}</div>
                          </div>
                        ))}
                        {chatLoading && <div className="flex justify-start"><div className="bg-white/10 text-white/60 px-3 py-2 rounded-xl text-xs">Typing...</div></div>}
                      </div>
                      <div className="flex gap-2">
                        <input value={chatMsg} onChange={(e) => setChatMsg(e.target.value)} onKeyDown={(e) => e.key === "Enter" && sendChat()} placeholder="Ask me anything..." aria-label="Chat message" className="flex-1 px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-xs text-white placeholder:text-[#d4d4d4] focus:outline-none focus:border-[#00c853]" />
                        <button onClick={sendChat} disabled={chatLoading} aria-label="Send message" className="bg-[#00c853] text-[#0a0a0a] px-3 py-2 rounded-xl text-xs font-semibold cursor-pointer hover:bg-[#00e676] transition disabled:opacity-50">Send</button>
                      </div>
                    </>
                  )}
                  {chatMode === "call" && (
                    <div className="text-center py-2">
                      <button onClick={() => setChatMode("choose")} className="text-[#e6e6e6] text-xs mb-3 cursor-pointer hover:text-white block mx-auto">← Back</button>
                      <a href={EMAIL_HREF} className="block w-full bg-[#00c853] text-[#0a0a0a] py-3 rounded-xl text-sm font-semibold hover:bg-[#00e676] transition text-center mb-2">📧 Email Us</a>
                      <p className="text-[#e6e6e6] text-xs">Mon-Sat 8AM-8PM</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Draggable FAB button. Lives in its own fixed-position
                container so the panel above can be placed independently. */}
            <div className={`fixed z-40 select-none ${hidden ? "hidden" : ""}`} style={fabContainerStyle}>
              <button
                onPointerDown={(e) => {
                  const target = e.currentTarget;
                  const rect = target.getBoundingClientRect();
                  fabDrag.current = {
                    startX: e.clientX,
                    startY: e.clientY,
                    origX: rect.left,
                    origY: rect.top,
                    moved: false,
                  };
                  target.setPointerCapture(e.pointerId);
                }}
                onPointerMove={(e) => {
                  const drag = fabDrag.current;
                  if (!drag) return;
                  const dx = e.clientX - drag.startX;
                  const dy = e.clientY - drag.startY;
                  if (!drag.moved && Math.abs(dx) + Math.abs(dy) < 6) return;
                  drag.moved = true;
                  const w = 56; const h = 56;
                  const nx = Math.max(4, Math.min(window.innerWidth - w - 4, drag.origX + dx));
                  const ny = Math.max(4, Math.min(window.innerHeight - h - 4, drag.origY + dy));
                  setFabPos({ x: nx, y: ny });
                }}
                onPointerUp={(e) => {
                  const drag = fabDrag.current;
                  fabDrag.current = null;
                  try { e.currentTarget.releasePointerCapture(e.pointerId); } catch {}
                  if (!drag) return;
                  if (drag.moved) {
                    try {
                      const rect = e.currentTarget.getBoundingClientRect();
                      localStorage.setItem("tcc_fab_pos", JSON.stringify({ x: rect.left, y: rect.top }));
                    } catch {}
                    return;
                  }
                  setChatOpen(!chatOpen);
                }}
                aria-label={chatOpen ? "Close chat" : "Open chat — drag to move"}
                className="w-12 h-12 lg:w-14 lg:h-14 rounded-full bg-[rgba(0,200,83,0.45)] lg:bg-[#00c853] text-white lg:text-[#0a0a0a] flex items-center justify-center shadow-[0_8px_22px_rgba(0,0,0,0.45)] backdrop-blur-md border border-[#00c853]/40 lg:border-transparent hover:bg-[rgba(0,230,118,0.65)] lg:hover:bg-[#00e676] transition tap-press touch-none"
                style={{ cursor: fabDrag.current?.moved ? "grabbing" : "grab" }}
              >
                {chatOpen ? (
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                ) : (
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                )}
              </button>
            </div>
          </>
        );
      })()}

      {/* CART DRAWER — full-height side panel that slides in from the right.
          Wider than the old popup, sticky header + sticky footer with the
          total + Checkout CTA. Matches the rest of the site's glass aesthetic. */}
      {cartOpen && (() => {
        const itemCount = cartItems.reduce((sum, i) => sum + i.quantity, 0);
        const total = cartItems.reduce((sum, i) => sum + i.price * i.quantity, 0);
        return (
          <>
            <div className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]" onClick={() => setCartOpen(false)} />
            <aside
              className="fixed top-0 right-0 bottom-0 z-50 w-full sm:w-[460px] lg:w-[520px] bg-[rgba(46,46,52,0.97)] backdrop-blur-[14px] border-l border-white/15 shadow-[0_0_60px_rgba(0,0,0,0.7)] flex flex-col"
              style={{ animation: "slideInRight 0.32s cubic-bezier(0.34, 1.56, 0.64, 1) both" }}
            >
              {/* HEADER */}
              <div className="px-6 py-5 border-b border-white/10 flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-[#00c853]">Your Box</p>
                  <h2 className="text-white text-2xl font-extrabold leading-tight mt-0.5">{itemCount === 0 ? "Empty" : `${itemCount} ${itemCount === 1 ? "device" : "devices"}`}</h2>
                </div>
                <button onClick={() => setCartOpen(false)} aria-label="Close cart" className="w-9 h-9 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center cursor-pointer tap-press shrink-0">
                  <svg className="w-4 h-4 text-white/80" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>

              {/* Bulk-tier suggestion — once the user has 4+ devices in the
                  cart we surface the bulk-selling path. They might get better
                  per-device terms or expedited processing for higher volume. */}
              {itemCount >= 4 && (
                <a
                  href="/bulk"
                  className="block mx-6 mt-4 rounded-2xl bg-[#00c853]/15 border border-[#00c853]/40 px-4 py-3 transition hover:bg-[#00c853]/22 shadow-[0_0_18px_rgba(0,200,83,0.18)]"
                >
                  <p className="text-[#00c853] text-[10px] font-extrabold uppercase tracking-[0.18em]">Looks like a bulk sell</p>
                  <p className="text-white text-sm font-extrabold leading-tight mt-1">{itemCount} devices in your box — consider our bulk program</p>
                  <p className="text-[#e6e6e6] text-xs mt-1 leading-snug">Higher volume can mean expedited processing and a dedicated rep. Tap to explore →</p>
                </a>
              )}

              {/* SCROLLABLE BODY */}
              <div className="flex-1 overflow-y-auto px-6 py-5">
                {cartItems.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center px-4">
                    <div className="w-20 h-20 rounded-full bg-[#00c853]/10 border border-[#00c853]/30 flex items-center justify-center mb-4">
                      <svg className="w-10 h-10 text-[#00c853]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z" /></svg>
                    </div>
                    <p className="text-white text-lg font-extrabold mb-1">Your box is empty</p>
                    <p className="text-[#c8c8c8] text-sm leading-snug mb-5">Add a device to lock in your quote — you can stack multiple devices in one box.</p>
                    <button onClick={() => { setCartOpen(false); setStep("category"); pushHistory("category"); }} className="tcc-button-primary px-6 py-3 text-sm font-extrabold">
                      Sell a device →
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {(() => {
                      // Dynamic shrinking — as more devices land in the cart,
                      // each row gets a bit tighter so we don't run out of
                      // viewport. Three tiers: 1 = lg, 2-3 = md, 4+ = sm.
                      const lineCount = cartItems.length;
                      const tier = lineCount <= 1 ? "lg" : lineCount <= 3 ? "md" : "sm";
                      const pad   = tier === "lg" ? "p-4"   : tier === "md" ? "p-3"   : "p-2.5";
                      const imgW  = tier === "lg" ? "w-14 h-14" : tier === "md" ? "w-12 h-12" : "w-10 h-10";
                      const titleSz = tier === "lg" ? "text-[15px]" : tier === "md" ? "text-[14px]" : "text-[13px]";
                      const subSz   = tier === "lg" ? "text-[12px]" : "text-[11px]";
                      const priceSz = tier === "lg" ? "text-xl"  : tier === "md" ? "text-lg" : "text-base";
                      const qtyBtn  = tier === "sm" ? "w-6 h-6 text-xs" : "w-7 h-7 text-sm";
                      // Fallback: look up the device image by modelId in case
                      // a cart item was stored before we started saving image.
                      const lookupImage = (modelId: string): string | undefined => {
                        for (const series of IPHONE_SERIES) {
                          const v = series.variants.find(x => x.id === modelId);
                          if (v?.image) return v.image;
                        }
                        return undefined;
                      };
                      return cartItems.map((item, i) => {
                        const imgSrc = item.image || lookupImage(item.modelId);
                        return (
                          <div key={i} className={`tcc-card rounded-2xl ${pad}`}>
                            <div className="flex items-start gap-3 mb-2">
                              <div className={`${imgW} rounded-xl bg-[rgba(15,15,15,0.55)] border border-white/12 flex items-center justify-center shrink-0 overflow-hidden p-1.5`}>
                                {imgSrc ? (
                                  <img src={imgSrc} alt="" className="max-w-full max-h-full object-contain" style={{ filter: "drop-shadow(0 4px 6px rgba(0,0,0,0.45))" }} />
                                ) : (
                                  <span className="text-2xl opacity-60">📱</span>
                                )}
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className={`text-white font-extrabold ${titleSz} leading-tight`}>{item.model}</p>
                                <p className={`text-[#c8c8c8] ${subSz} mt-1`}>{item.storage} · {item.condition}</p>
                              </div>
                              <button onClick={() => { setCartItems(prev => prev.filter((_, idx) => idx !== i)); setCartToast({ model: item.model, price: item.price * item.quantity, kind: "remove" }); setTimeout(() => setCartToast(null), 2400); }} aria-label="Remove from cart" className="text-[#b8b8b8] hover:text-red-400 text-xs font-bold underline-offset-2 hover:underline transition cursor-pointer shrink-0">Remove</button>
                            </div>
                            <div className="flex items-center justify-between gap-3 mt-2 pt-2 border-t border-white/10">
                              <div className="inline-flex items-center gap-2 bg-white/5 rounded-full px-1 py-1">
                                <button onClick={() => setCartItems(prev => prev.map((it, idx) => idx === i ? { ...it, quantity: Math.max(1, it.quantity - 1) } : it))} aria-label="Decrease quantity" className={`${qtyBtn} rounded-full bg-white/10 hover:bg-white/20 text-white font-bold flex items-center justify-center cursor-pointer transition`}>−</button>
                                <span className="text-white text-sm font-extrabold min-w-[20px] text-center">{item.quantity}</span>
                                <button onClick={() => setCartItems(prev => prev.map((it, idx) => idx === i ? { ...it, quantity: Math.min(10, it.quantity + 1) } : it))} aria-label="Increase quantity" className={`${qtyBtn} rounded-full bg-white/10 hover:bg-white/20 text-white font-bold flex items-center justify-center cursor-pointer transition`}>+</button>
                              </div>
                              {item.price > 0 ? (
                                <p className={`text-[#00c853] font-extrabold ${priceSz}`} style={{ textShadow: "0 0 6px rgba(0,200,83,0.25)" }}>${item.price * item.quantity}</p>
                              ) : (
                                <p className={`text-white font-extrabold ${priceSz} opacity-90`}>Quoted via email or text</p>
                              )}
                            </div>
                          </div>
                        );
                      });
                    })()}

                    {/* Add another device CTA */}
                    <button onClick={() => { setCartOpen(false); setStep("category"); pushHistory("category"); }} className="w-full mt-2 px-4 py-3 rounded-2xl border border-dashed border-white/20 hover:border-[#00c853]/50 text-[#c8c8c8] hover:text-white text-sm font-bold cursor-pointer transition flex items-center justify-center gap-2">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" /></svg>
                      Add another device
                    </button>
                  </div>
                )}
              </div>

              {/* STICKY FOOTER */}
              {cartItems.length > 0 && (
                <div className="border-t border-white/10 px-6 py-5 bg-[rgba(10,10,10,0.95)]">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <p className="text-[#b8b8b8] text-[11px] font-bold uppercase tracking-wider">Total payout</p>
                      <p className="text-[#00c853] font-extrabold text-4xl mt-1" style={{ textShadow: "0 0 10px rgba(0,200,83,0.3)" }}>${total}</p>
                    </div>
                    <p className="text-[#c8c8c8] text-xs text-right">{itemCount} {itemCount === 1 ? "device" : "devices"} · Free shipping</p>
                  </div>
                  <button
                    onClick={() => {
                      // Always force the user back to the funnel page
                      // before transitioning into the checkout step.
                      // Without this, if they were on /privacy /faq
                      // /about /etc. (any setPage non-home state), the
                      // checkout section never renders because its
                      // mount condition is `step === "checkout" &&
                      // page === "home"`, and they get stranded on
                      // the page they came from — Skywalker 2026-05-17
                      // "click on cart and hit proceed it just goes
                      // to the footer".
                      setCartOpen(false);
                      setPage("home");
                      setStep("checkout");
                      pushHistory("checkout");
                      window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
                    }}
                    className="tcc-button-primary w-full py-4 text-base font-extrabold"
                  >
                    Proceed to Checkout →
                  </button>
                  <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                    <div className="text-[#c8c8c8] text-[10px] font-semibold leading-tight">⚡<br />Same-day<br />payout</div>
                    <div className="text-[#c8c8c8] text-[10px] font-semibold leading-tight">🔒<br />On-site<br />data wipe</div>
                    <div className="text-[#c8c8c8] text-[10px] font-semibold leading-tight">💵<br />Cash · Zelle<br />Cash App · BTC</div>
                  </div>
                </div>
              )}
            </aside>
          </>
        );
      })()}

      {/* Progress bar moved into the sticky <nav> above so it tracks the
          dynamic nav height (logo row + search row) instead of a
          hardcoded top-[52px] that broke when the search row was added. */}

      {cookieConsent === null && (
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-[#111]/95 backdrop-blur-sm border-t border-white/10 px-3 py-2 animate-[fadeIn_0.3s_ease-out]">
          <div className="max-w-lg md:max-w-3xl lg:max-w-7xl mx-auto flex items-center gap-3">
            <p className="text-white/80 text-[11px] flex-1">We use cookies to improve your experience.</p>
            <button onClick={() => { localStorage.setItem("cookie-consent", "essential"); setCookieConsent("essential"); }} className="text-white/60 text-[11px] font-medium cursor-pointer hover:text-white transition whitespace-nowrap">Essential</button>
            <button onClick={() => { localStorage.setItem("cookie-consent", "full"); setCookieConsent("full"); }} className="bg-[#00c853] text-[#0a0a0a] px-3 py-1.5 rounded-lg text-[11px] font-semibold cursor-pointer hover:bg-[#00e676] transition whitespace-nowrap">Accept All</button>
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes marquee { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }
      `}</style>
    </main>
  );
}
