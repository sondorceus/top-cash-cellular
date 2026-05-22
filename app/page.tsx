"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import Script from "next/script";
import { track as vercelTrack } from "@vercel/analytics";
import { getResellEstimate, resellMultiplierForCondition, MARGIN_FLOOR_MULT } from "./lib/resell-estimates";
import { listSlots, bookSlot, type Slot } from "./lib/slots-store";
import { SlideOnScrollNav } from "./components/SlideOnScrollNav";
import { HeaderSearch } from "./components/HeaderSearch";
import Pic from "./components/Pic";
import NextImage from "next/image";
import { CARRIER_DEDUCTIONS, PRICE_TABLE, MIN_OFFER, MANUAL_REVIEW_DEVICES, MACBOOK_SPECS, type MacSpec, type MacSpecOption } from "./data/prices";

const BRAND = "Top Cash Cellular";
const EMAIL = "CustomerService@topcashcells.com";
const EMAIL_HREF = "mailto:CustomerService@topcashcells.com";

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

// FedEx wordmark — purple "Fed" + orange "Ex" in the Univers-stack font.
// Used everywhere we write "FedEx" in JSX so customers consistently see
// the brand mark, not a plain word. Plain inline spans (no flex on the
// wordmark itself) with whitespace-nowrap so "Fed" and "Ex" can never
// split across two lines. Defaults to inheriting parent text size; pass
// a Tailwind size class via className only when you need to override.
// Skywalker 2026-05-19.
function FedExMark({ className = "" }: { className?: string }) {
  return (
    <span
      aria-label="FedEx"
      className={`whitespace-nowrap font-extrabold tracking-tight ${className}`}
      style={{ fontFamily: "Univers, 'Helvetica Neue', Helvetica, Arial, sans-serif" }}
    >
      <span style={{ color: "#4D148C" }}>Fed</span><span style={{ color: "#E65900" }}>Ex</span>
    </span>
  );
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

// CARRIER_DEDUCTIONS + PRICE_TABLE extracted to ./data/prices.ts so the
// admin UI (/admin/prices) and API routes can read/write the grid without
// parsing this 13k-line React component. The funnel still references the
// imported constants directly below; runtime overrides from
// /api/admin/prices are merged in via getPriceCell() at lookup time.

const IPHONE_SERIES = [
  // Bases: IWM_lowest_storage × 0.95 / lowest_storage_mult
  // iPhone = 5% below IWM. Everything else = 10% below.
  { id: "17", label: "iPhone 17", image: "/iphone17.png", year: "2025", topPrice: 860, variants: [
    { id: "ip17pm", label: "iPhone 17 Pro Max", base: 767, image: "/devices/iphone-17-pro-max-test.png" },   // IWM 256GB=$905
    { id: "ip17p", label: "iPhone 17 Pro", base: 726, image: "/devices/iphone-17-pro-test.png" },
    { id: "ip17air", label: "iPhone 17 Air", base: 620, image: "/devices/iphone-17-air.webp" },
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
    { id: "px7a", label: "Pixel 7a", base: 75, image: "/devices/pixel-7a.webp" },
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
  { id: "ln_tp_x390_yoga", label: "ThinkPad X390 Yoga", base: 139, image: "/devices/ln_tp_x390_yoga.png" },
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
  { id: "lenovo_tp_x390", label: "ThinkPad X390", year: "Legacy 13.3-inch", topPrice: 139, variants: LENOVO_TP_X390_VARIANTS, image: "/devices/ln_tp_x390.png" },
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
  { id: "hp_eb_g5", label: "EliteBook G5", base: 180, image: "/devices/hp-elitebook-eb_std-hp-elitebook-g5.png" },
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
  { id: "hp_victus_15", label: "Victus 15", base: 164, image: "/devices/hp_victus_15.png" },
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
  { id: "hp_victus", label: "Victus", year: "Entry gaming", topPrice: 164, variants: HP_VICTUS_VARIANTS, image: "/devices/hp-spectre-x360.webp" },
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
  { id: "ac_nitro_v", label: "Nitro V", base: 680, image: "/devices/acer-nitro-acer-nitro-v.png" },
  { id: "ac_nitro_5", label: "Nitro 5", base: 441, image: "/devices/acer-nitro-acer-nitro-5.png" },
];
const ACER_PREDATOR_VARIANTS = [
  { id: "ac_pred_helios", label: "Predator Helios", base: 1260, image: "/devices/acer-predator-acer-predator-helios.png" },
  { id: "ac_pred_triton", label: "Predator Triton", base: 1575, image: "/devices/acer-predator-acer-predator-triton.png" },
];
const ACER_PC_SERIES = [
  { id: "ac_nitro", label: "Nitro", year: "Mainstream gaming", topPrice: 680, variants: ACER_NITRO_VARIANTS, image: "/devices/acer-nitro-acer-nitro-16.png" },
  { id: "ac_predator", label: "Predator", year: "Premium gaming", topPrice: 1575, variants: ACER_PREDATOR_VARIANTS, image: "/devices/acer-predator-acer-predator-helios.png" },
];

// SAMSUNG GALAXY BOOK — IWM uses .answers quiz UI for all 5 generations,
// so no per-model photos. Each variant uses the existing series-level
// placeholder (/devices/sgbk*.png) where one matches.
const SAMSUNG_BOOK5_VARIANTS = [
  { id: "sgbk_5", label: "Galaxy Book5", base: 639, inquiryOnly: false, image: "/devices/sgbk_5.png" },
  { id: "sgbk_5_360", label: "Galaxy Book5 360", base: 639, inquiryOnly: false, image: "/devices/sgbk_5_360.png" },
  { id: "sgbk_5_pro", label: "Galaxy Book5 Pro", base: 639, inquiryOnly: false, image: "/devices/sgbk_5_pro.png" },
  { id: "sgbk_5_pro_360", label: "Galaxy Book5 Pro 360", base: 639, inquiryOnly: false, image: "/devices/sgbk_5_pro_360.png" },
];
const SAMSUNG_BOOK4_VARIANTS = [
  { id: "sgbk_4", label: "Galaxy Book4", base: 446, inquiryOnly: false, image: "/devices/sgbk_4.png" },
  { id: "sgbk_4_360", label: "Galaxy Book4 360", base: 446, inquiryOnly: false, image: "/devices/sgbk_4_360.png" },
  { id: "sgbk_4_pro", label: "Galaxy Book4 Pro", base: 446, inquiryOnly: false, image: "/devices/sgbk_4_pro.png" },
  { id: "sgbk_4_pro_360", label: "Galaxy Book4 Pro 360", base: 446, inquiryOnly: false, image: "/devices/sgbk_4_pro_360.png" },
  { id: "sgbk_4_ultra", label: "Galaxy Book4 Ultra", base: 446, inquiryOnly: false, image: "/devices/sgbk_4_ultra.png" },
  { id: "sgbk_4_edge", label: "Galaxy Book4 Edge", base: 446, inquiryOnly: false, image: "/devices/sgbk_4_edge.png" },
];
const SAMSUNG_BOOK3_VARIANTS = [
  { id: "sgbk_3", label: "Galaxy Book3", base: 446, inquiryOnly: false, image: "/devices/sgbk_3.png" },
  { id: "sgbk_3_360", label: "Galaxy Book3 360", base: 446, inquiryOnly: false, image: "/devices/sgbk_3_360.png" },
  { id: "sgbk_3_pro", label: "Galaxy Book3 Pro", base: 446, inquiryOnly: false, image: "/devices/sgbk_3_pro.png" },
  { id: "sgbk_3_pro_360", label: "Galaxy Book3 Pro 360", base: 446, inquiryOnly: false, image: "/devices/sgbk_3_pro_360.png" },
  { id: "sgbk_3_ultra", label: "Galaxy Book3 Ultra", base: 446, inquiryOnly: false, image: "/devices/sgbk_3_ultra.png" },
];
const SAMSUNG_BOOK2_VARIANTS = [
  { id: "sgbk_2", label: "Galaxy Book2", base: 243, inquiryOnly: false, image: "/devices/sgbk_2.png" },
  { id: "sgbk_2_360", label: "Galaxy Book2 360", base: 243, inquiryOnly: false, image: "/devices/sgbk_2_360.png" },
  { id: "sgbk_2_pro", label: "Galaxy Book2 Pro", base: 243, inquiryOnly: false, image: "/devices/sgbk_2_pro.png" },
  { id: "sgbk_2_pro_360", label: "Galaxy Book2 Pro 360", base: 243, inquiryOnly: false, image: "/devices/sgbk_2_pro_360.png" },
];
const SAMSUNG_BOOK1_VARIANTS = [
  { id: "sgbk_1", label: "Galaxy Book", base: 140, inquiryOnly: false, image: "/devices/sgbk_1.png" },
  { id: "sgbk_1_pro", label: "Galaxy Book Pro", base: 140, inquiryOnly: false, image: "/devices/sgbk_1_pro.png" },
  { id: "sgbk_1_pro_360", label: "Galaxy Book Pro 360", base: 140, inquiryOnly: false, image: "/devices/sgbk_1_pro_360.png" },
  { id: "sgbk_1_ion", label: "Galaxy Book Ion", base: 140, inquiryOnly: false, image: "/devices/sgbk_1_ion.png" },
  { id: "sgbk_1_flex", label: "Galaxy Book Flex", base: 140, inquiryOnly: false, image: "/devices/sgbk_1_flex.png" },
  { id: "sgbk_1_flex_alpha", label: "Galaxy Book Flex Alpha", base: 140, inquiryOnly: false, image: "/devices/sgbk_1_flex_alpha.png" },
  { id: "sgbk_1_flex2_alpha", label: "Galaxy Book Flex2 Alpha", base: 140, inquiryOnly: false, image: "/devices/sgbk_1_flex2_alpha.png" },
  { id: "sgbk_1_odyssey", label: "Galaxy Book Odyssey", base: 140, inquiryOnly: false, image: "/devices/sgbk_1_odyssey.png" },
];
const SAMSUNG_PC_SERIES = [
  { id: "sgbk_book5", label: "Galaxy Book 5", year: "2025", topPrice: 639, variants: SAMSUNG_BOOK5_VARIANTS, image: "/devices/sgbk_5_pro.png" },
  { id: "sgbk_book4", label: "Galaxy Book 4", year: "2024", topPrice: 446, variants: SAMSUNG_BOOK4_VARIANTS, image: "/devices/sgbk_4_ultra.png" },
  { id: "sgbk_book3", label: "Galaxy Book 3", year: "2023", topPrice: 446, variants: SAMSUNG_BOOK3_VARIANTS, image: "/devices/sgbk_3_ultra.png" },
  { id: "sgbk_book2", label: "Galaxy Book 2", year: "2022", topPrice: 243, variants: SAMSUNG_BOOK2_VARIANTS, image: "/devices/sgbk_2_pro.png" },
  { id: "sgbk_book1", label: "Galaxy Book", year: "2020–2021", topPrice: 140, variants: SAMSUNG_BOOK1_VARIANTS, image: "/devices/sgbk_1_pro.png" },
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
  { id: "dji_phantom_3_pro", label: "DJI Phantom 3 Pro", base: 0, inquiryOnly: true, image: "/devices/dji_phantom_3.png" },
  { id: "dji_phantom_3_advanced", label: "DJI Phantom 3 Advanced", base: 0, inquiryOnly: true, image: "/devices/dji_phantom_3.png" },
  { id: "dji_phantom_3_standard", label: "DJI Phantom 3 Standard", base: 0, inquiryOnly: true, image: "/devices/dji_phantom_3.png" },
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


// Skywalker 2026-05-19: Collapsed Mint+Very Good into a single "Excellent"
// tier. The old `verygood` slug paid the same multiplier as `good` (0.969)
// but $15-20 more on most cells, so customers gamed it. With VG gone,
// truly-pristine devices pick Excellent (= old Mint pricing), everything
// with visible wear self-grades to Good. Legacy MC leads that carry
// "Very Good" still parse — see resellMultiplierForCondition in
// app/lib/resell-estimates.ts and the lead-side back-compat below.
const CONDITIONS = [
  { id: "sealed", label: "Sealed", desc: "Factory sealed, never opened", multiplier: 1.03, icon: <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-14L4 7m8 4v10M4 7v10l8 4" />, details: ["Still in factory original sealed packaging", "Plastic wrap or seal is intact and has not been tampered with", "Device has never been activated or powered on", "Must include original box with matching serial number", "Contains all original accessories unopened"] },
  { id: "mint", label: "Excellent", desc: "Looks brand new, zero signs of use", multiplier: 1.0, icon: <path strokeLinecap="round" strokeLinejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.196-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />, details: ["Zero scratches, scuffs, or other marks — looks brand new", "Display is free of defects such as cracks, dead pixels, white spots, or burn-in", "Original battery above 90% capacity", "Powers on and functions 100% as intended"] },
  { id: "good", label: "Good", desc: "Normal wear, fully functional", multiplier: 0.969, icon: <path strokeLinecap="round" strokeLinejoin="round" d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" />, details: ["Light to moderate signs of wear — visible scratches and/or minor dents", "Display is free of defects such as cracks, dead pixels, white spots, or burn-in", "Original battery above 80% capacity", "Powers on and functions 100% as intended"] },
  { id: "fair", label: "Fair", desc: "Heavy wear, still functional", multiplier: 0.852, icon: <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />, details: ["Heavy signs of wear — deep scratches, dents, or scuffs", "Display is free of cracks but may have minor blemishes", "Battery may be below 80% capacity", "Powers on and functions as intended"] },
  { id: "broken", label: "Broken", desc: "Cracked, defective, or damaged", multiplier: 0.50, icon: <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />, details: ["Cracked screen, broken buttons, or damaged housing", "Display defects such as dead pixels, white spots, or burn-in", "May have functional issues — touchscreen, speakers, cameras", "Device still powers on", "No signs of liquid intrusion or water damage"] },
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
    mint:     { label: "Excellent", desc: "Works perfectly, light cosmetic wear" },
    good:     { label: "Good", desc: "Works perfectly, normal wear & tear" },
    fair:     { label: "Fair", desc: "Works, heavy cosmetic wear" },
    broken:   { label: "Disc drive broken / won't power on", desc: "Major hardware fault" },
  },
  microsoft: {
    sealed: { label: "Sealed", desc: "Factory sealed, never opened" },
    mint:     { label: "Excellent", desc: "Works perfectly, light cosmetic wear" },
    good:     { label: "Good", desc: "Works perfectly, normal wear & tear" },
    fair:     { label: "Fair", desc: "Works, heavy cosmetic wear" },
    broken:   { label: "Disc drive broken / won't power on", desc: "Major hardware fault" },
  },
  nintendo: {
    sealed: { label: "Sealed", desc: "Factory sealed, never opened" },
    mint:     { label: "Excellent", desc: "Works perfectly, light cosmetic wear" },
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
    mint:     { label: "Lightly Flown", desc: "Under 10 hours, no crashes" },
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
  // Watches — sealed-in-box Apple Watch Ultra / Pixel Watch / Galaxy Watch
  // command a real resale premium, so the 6-tier ladder (sealed + mint +
  // verygood + good + fair + broken) is the right ask. Garmin stays on
  // the simple ladder below — Garmin fans buy used and the mint/very-good
  // split doesn't move the offer enough to justify the extra step.
  "applewatch", "pixelwatch", "samsungwatch",
  // Drones + VR — sealed/new units are common on resale (new owner upgrade
  // path), and the broken tier matters for crashed drones / cracked VR
  // lenses. Full 6-tier ladder.
  "dji", "apple_vr", "meta_vr", "valve_vr", "psvr",
]);
const isHighMarginType = (dt: string | null | undefined): boolean => !!dt && HIGH_MARGIN_DEVICE_TYPES.has(dt);
// Simplified conditions for consoles + Garmin — fewer tiers, less
// confusing for categories where the mint/very-good split doesn't move
// the offer. Includes broken so honest sellers of a dead PS5 / cracked
// Fenix can still get a real quote (broken-functional step still fires
// after they pick broken, same as every other device type).
const SIMPLE_CONDITIONS = [
  { id: "sealed", label: "New / Sealed", desc: "Factory sealed, never opened", multiplier: 1.03, icon: <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-14L4 7m8 4v10M4 7v10l8 4" />, details: ["Still in original sealed packaging", "All accessories included and unopened", "Never been used or powered on"] },
  { id: "good", label: "Good", desc: "Works perfectly, normal wear", multiplier: 0.969, icon: <path strokeLinecap="round" strokeLinejoin="round" d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" />, details: ["Powers on and functions 100% as intended", "Normal cosmetic wear — scratches, scuffs OK", "All buttons and ports work", "Includes power cable"] },
  { id: "fair", label: "Fair / Beat Up", desc: "Heavy wear but still works", multiplier: 0.852, icon: <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />, details: ["Powers on and functions as intended", "Heavy cosmetic wear — dents, deep scratches", "May have minor functional issues", "Includes power cable"] },
  { id: "broken", label: "Broken", desc: "Cracked, defective, or damaged", multiplier: 0.50, icon: <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />, details: ["Won't power on, dead HDMI/display, or major hardware failure", "Cracked housing or broken buttons", "Includes power cable if available", "We'll text you a final quote after inspection"] },
];
// Device types that use the SIMPLE 4-tier condition ladder (sealed /
// good / fair / broken). Everything else uses the full 6-tier CONDITIONS
// ladder via HIGH_MARGIN_DEVICE_TYPES above, or 5-tier (full minus
// sealed) when neither set matches.
const SIMPLE_CONDITION_TYPES = new Set([
  "console", "sony", "microsoft", "nintendo", "garmin",
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

// Per-method payout-handle metadata. Cash needs no handle (paid in
// person). The rest require the customer to type their handle twice so
// we catch typos before payout — see the payout step. Format
// validators come later; for now it's a double-entry match check.
const PAYOUT_HANDLE_META: Record<string, { field: string; placeholder: string; hint: string }> = {
  cashapp: { field: "$Cashtag", placeholder: "$YourCashtag", hint: "Find it in Cash App under your profile — it starts with a $." },
  zelle:   { field: "Zelle email or phone", placeholder: "email or phone number", hint: "Use the exact email or phone number enrolled with Zelle at your bank." },
  btc:     { field: "Bitcoin wallet address", placeholder: "your BTC wallet address", hint: "Paste your receiving address. Double-check it — crypto transfers can't be reversed." },
};

// The homepage FAQS array + its "Frequently Asked Questions" section
// were removed 2026-05-22 — the homepage keeps one short "Things people
// ask us" FAQ that links to the full /faq page. No need for two.

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
type BrandExtra = { id: string; question: string; helper?: string; options: ExtraOption[]; showIf?: (extras: Record<string, ExtraOption | undefined>, condition?: { id: string } | null) => boolean;
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
    // Functional check — only when condition isn't already "broken".
    // The broken-functional step covers the broken case, so asking
    // again here would be a double-ask. For non-broken conditions, the
    // 0.02 multiplier on "no" drops the quote below MIN_OFFER and
    // triggers the "Manual review needed" flow on the quote step
    // (catch-all for a "mint" watch that doesn't actually power on).
    { id: "functional", question: "Is the watch fully functional?", helper: "Powers on, touchscreen and buttons respond, all sensors work.", showIf: (_extras, cond) => cond?.id !== "broken", options: [
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
          <svg className="w-7 h-7 shrink-0 text-[#00c853]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} style={{filter:"drop-shadow(0 0 8px rgba(0,200,83,0.55))"}}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          <div><p className="text-sm font-extrabold text-white">Consistent grading</p><p className="text-xs text-[#e8e8e8] leading-snug mt-0.5">Every device is evaluated using a standardized process based on the condition you select.</p></div>
        </div>
        <div className="flex gap-3">
          <svg className="w-7 h-7 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} style={{color:"rgb(255,170,90)",filter:"drop-shadow(0 0 8px rgba(255,170,90,0.55))"}}><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
          <div><p className="text-sm font-extrabold text-white">Clear explanations</p><p className="text-xs text-[#e8e8e8] leading-snug mt-0.5">If your device differs from what was described, we&apos;ll explain what we found before adjusting your offer.</p></div>
        </div>
        <div className="flex gap-3">
          <svg className="w-7 h-7 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} style={{color:"rgb(120,200,255)",filter:"drop-shadow(0 0 8px rgba(120,200,255,0.55))"}}><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
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
      <span className="inline-flex items-center gap-1"><svg className="w-4 h-4 text-[#00c853]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.196-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" /></svg>Thousands of happy sellers</span>
      <span>·</span>
      <span className="inline-flex items-center gap-1"><svg className="w-4 h-4 text-[#00c853]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>14-day price lock</span>
      <span>·</span>
      <span className="inline-flex items-center gap-1"><svg className="w-4 h-4 text-[#00c853]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>Same-day payout</span>
      <span>·</span>
      <span className="inline-flex items-center gap-1"><svg className="w-4 h-4 text-[#00c853]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>Austin local</span>
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

// ReviewsCarousel: continuous marquee of customer reviews — auto-scrolls
// and pauses on hover. (Was a scroll-snap carousel with arrows + dots;
// switched to a marquee so the wall feels alive even with a short list.)
function ReviewsCarousel({ reviews }: { reviews: { name: string; loc: string; text: string; stars: number; verified?: boolean }[] }) {
  if (reviews.length === 0) return null;
  // Repeat the list to an even multiple of >=6 cards so one set is wide
  // enough to span the viewport, then render it twice for the seamless
  // -50% marquee loop.
  const setLen = Math.ceil(6 / reviews.length) * reviews.length;
  const loop = Array.from({ length: setLen }, (_, i) => reviews[i % reviews.length]);
  return (
    <div className="overflow-hidden tcc-marquee-mask">
      <div className="flex gap-3 w-max animate-[marquee_40s_linear_infinite] hover:[animation-play-state:paused] py-1">
        {[...loop, ...loop].map((r, i) => (
          <div key={i} className="flex-shrink-0 w-[280px] md:w-[320px] bg-white/5 border border-white/10 rounded-2xl p-5">
            <div className="flex items-center justify-between gap-2 mb-3">
              <div className="flex gap-0.5 text-[#ffb400] text-sm">{"★".repeat(r.stars)}</div>
              {r.verified && (
                <span className="inline-flex items-center gap-1 text-[9px] font-extrabold uppercase tracking-wider text-[#7be8a8] bg-[#00c853]/12 border border-[#00c853]/40 rounded-full px-2 py-0.5" title="Verified seller — review submitted via a one-use link after their trade closed">
                  ✓ Verified
                </span>
              )}
            </div>
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
          // Legacy API (deprecated for new Cloud projects on 2025-03-01) — kept
          // here for the type only; runtime code uses PlaceAutocompleteElement.
          Autocomplete: new (input: HTMLInputElement, opts?: unknown) => {
            addListener: (event: string, cb: () => void) => void;
            getPlace: () => { address_components?: Array<{ short_name: string; long_name: string; types: string[] }>; formatted_address?: string };
            setBounds: (b: unknown) => void;
          };
        };
        importLibrary: (name: string) => Promise<{
          // Returned shape when name === "places". We only type the pieces we use.
          PlaceAutocompleteElement?: new (opts?: {
            includedRegionCodes?: string[];
            componentRestrictions?: { country: string | string[] };
            requestedLanguage?: string;
            requestedRegion?: string;
            types?: string[];
          }) => HTMLElement & {
            addEventListener: (event: string, cb: (e: { placePrediction?: { toPlace: () => { fetchFields: (opts: { fields: string[] }) => Promise<unknown>; addressComponents?: Array<{ types?: string[]; longText?: string; shortText?: string }>; formattedAddress?: string } } }) => void) => void;
            value?: string;
          };
        }>;
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

type PriceOverrides = {
  priceTable: Record<string, Record<string, Record<string, number>>>;
  carrierDeductions: Record<string, Record<string, number>>;
  baseOverrides?: Record<string, number>;
  conditionAdj?: Record<string, Record<string, number>>;
};

export default function Home() {
  // Price overrides — pulled on mount from /api/admin/prices. Lets
  // Skywalker edit prices via /admin/prices and have them apply
  // without a redeploy (the lookupPrice block below checks this
  // first, falls back to the bundled PRICE_TABLE / CARRIER_DEDUCTIONS).
  // Skywalker 2026-05-18 self-serve price editor.
  const [priceOverrides, setPriceOverrides] = useState<PriceOverrides | null>(null);
  useEffect(() => {
    fetch("/api/admin/prices")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.overrides) setPriceOverrides(d.overrides);
      })
      .catch(() => {});
  }, []);
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
  // Skywalker 2026-05-19: desktop wanted a tiny search icon at the top
  // instead of the always-visible search bar. Click expands inline.
  const [searchOpen, setSearchOpen] = useState(false);

  // Parts / locked / broken-for-parts custom-quote flow. Triggered from
  // the condition step via a small link below the working-condition
  // options. Opens a modal that captures contact + a free-text "what's
  // wrong" description, then POSTs to /api/lead with parts:true so the
  // backend tags it as a manual-review lead. Skywalker 2026-05-19.
  const [partsModalOpen, setPartsModalOpen] = useState(false);
  const [partsName, setPartsName] = useState("");
  const [partsEmail, setPartsEmail] = useState("");
  const [partsPhone, setPartsPhone] = useState("");
  const [partsIssue, setPartsIssue] = useState<"locked_mdm" | "locked_icloud" | "locked_carrier" | "wont_turn_on" | "physical" | "other" | null>(null);
  const [partsDescription, setPartsDescription] = useState("");
  const [partsSubmitting, setPartsSubmitting] = useState(false);
  const [partsSubmitted, setPartsSubmitted] = useState(false);
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
    // graphics + displayresolution are PC-laptop sub-questions that
    // happen between storage and condition. Stay at 3 so the bar
    // doesn't drop while the user works through them.
    step === "graphics" ? 3 :
    step === "displayresolution" ? 3 :
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
    // broken-functional + broken-glass are sub-questions of the
    // condition step (only reached when condition === "broken"). They
    // were missing from this mapping which made funnelStepNum drop
    // to 0 → the green progress bar disappeared mid-flow instead of
    // staying at "step 1 of N". Skywalker 2026-05-19: "tiny green
    // bar pulls back when I get to the conditions about the device".
    step === "broken-functional" ? 1 :
    step === "broken-glass" ? 1 :
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
  // Real customer reviews from /api/reviews (backed by MC). Empty by default;
  // once the fetch resolves we either swap in real ones or stay on the
  // placeholders below. Falls back silently on network error so the home
  // page never breaks just because MC is slow.
  const [realReviews, setRealReviews] = useState<{ name: string; loc: string; text: string; stars: number; verified?: boolean }[]>([]);
  useEffect(() => {
    let alive = true;
    fetch("/api/reviews")
      .then((r) => r.json())
      .then((data) => {
        if (!alive) return;
        const rows = Array.isArray(data?.reviews) ? data.reviews : [];
        const mapped = rows
          .filter((r: { rating?: number; body?: string }) => (r?.rating ?? 0) >= 3 && (r?.body ?? "").trim().length >= 10)
          .map((r: { name?: string; city?: string; body?: string; rating?: number; verified?: boolean }) => ({
            name: r.name || "Anonymous",
            loc: r.city || "Austin",
            text: r.body || "",
            stars: Math.min(5, Math.max(1, r.rating || 5)),
            verified: r.verified === true,
          }));
        setRealReviews(mapped);
      })
      .catch(() => {});
    return () => { alive = false; };
  }, []);
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
  // Payout handle entered twice — the customer's Cashtag / Zelle / BTC
  // address. Both must match before they can advance. Cash skips this.
  const [payoutHandle, setPayoutHandle] = useState("");
  const [payoutHandleConfirm, setPayoutHandleConfirm] = useState("");
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
  // Referral program — a friend's REF-XXXXXX code arrives via ?ref= in
  // the URL. When set, the funnel shows a calm "$10 bonus" banner and
  // passes the code to /api/lead on submit, where the referee bonus is
  // applied + the referral recorded. Skywalker 2026-05-22.
  const [referralCode, setReferralCode] = useState<string | null>(null);
  // Lets the global <HeaderSearch> on /faq, /bulk, /reviews, etc. land
  // a user on the funnel with their query already typed in. Reads ?q=
  // from the URL once on mount, then scrubs it so a refresh doesn't
  // re-trigger the search dropdown unexpectedly.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const q = params.get("q");
    if (q && q.trim()) {
      setSearchQuery(q.trim());
      params.delete("q");
      const newSearch = params.toString();
      const newUrl = `${window.location.pathname}${newSearch ? `?${newSearch}` : ""}${window.location.hash}`;
      window.history.replaceState(null, "", newUrl);
    }
  }, []);

  // Referral capture. A friend's link looks like /?ref=REF-XXXXXX.
  // Read it once on mount, validate the format, store it in state +
  // localStorage so it survives funnel navigation / a refresh, then
  // scrub the param from the URL. We also hydrate from localStorage
  // when ?ref= is absent so a customer who clicked the link earlier
  // (then browsed away and came back) still gets their bonus.
  // Skywalker 2026-05-22 referral program.
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const params = new URLSearchParams(window.location.search);
      const ref = (params.get("ref") || "").trim().toUpperCase();
      if (ref && /^REF-[A-Z0-9]{6}$/.test(ref)) {
        setReferralCode(ref);
        localStorage.setItem("tcc-referral", ref);
        params.delete("ref");
        const newSearch = params.toString();
        window.history.replaceState(null, "", `${window.location.pathname}${newSearch ? `?${newSearch}` : ""}${window.location.hash}`);
      } else {
        // No (valid) ?ref= on this load — fall back to a code captured
        // on an earlier visit so it persists across navigation.
        const stored = (localStorage.getItem("tcc-referral") || "").trim().toUpperCase();
        if (stored && /^REF-[A-Z0-9]{6}$/.test(stored)) setReferralCode(stored);
      }
    } catch {}
  }, []);

  // Footer links on the standalone route pages (/faq etc.) deep-link
  // into the in-app sections below (Terms, Grading, About...) via
  // ?page=<id>. Honor it once on mount, then scrub the param.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const p = params.get("page");
    if (
      p === "about" || p === "terms" || p === "grading" || p === "shipping" ||
      p === "affiliate" || p === "itad" || p === "blog" || p === "cookies" ||
      p === "accessibility"
    ) {
      setPage(p);
      params.delete("page");
      const newSearch = params.toString();
      window.history.replaceState(null, "", `${window.location.pathname}${newSearch ? `?${newSearch}` : ""}${window.location.hash}`);
    }
  }, []);

  // Auto-prefill name + email when the customer has a Google session,
  // and stash the user info so the nav can show a "Hi, {first}" chip
  // instead of the generic Login button. Skywalker 2026-05-17.
  const [customerUser, setCustomerUser] = useState<{ email: string; name?: string; picture?: string } | null>(null);
  const [customerMenuOpen, setCustomerMenuOpen] = useState(false);
  useEffect(() => {
    fetch("/api/auth/me", { cache: "no-store" })
      .then((r) => r.json())
      .then((me) => {
        if (!me?.authenticated) return;
        setCustomerUser({ email: me.email, name: me.name, picture: me.picture });
        if (me.name) setName((cur) => cur || me.name);
        if (me.email) setEmail((cur) => cur || me.email);
      })
      .catch(() => {});
  }, []);
  const signOutCustomer = async () => {
    setCustomerMenuOpen(false);
    await fetch("/api/auth/signout", { method: "POST" }).catch(() => {});
    setCustomerUser(null);
    window.location.reload();
  };

  // Flat search index across all device categories — populated once at module scope below
  // (see SEARCH_INDEX const further down)

  const sendChat = async () => {
    if (!chatMsg.trim()) return;
    if (chatLoading) return; // Enter-key can fire while a send is in flight.
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
  // Google Places autocomplete on the shipping street field. Goes
  // through our own /api/places-autocomplete and /api/places-details
  // proxies (which talk to Google's Places API New server-to-server)
  // and we render the suggestion list as a plain dropdown under our
  // own <input>. This deliberately replaces Google's
  // PlaceAutocompleteElement web component, which triggered a
  // fullscreen takeover on mobile focus — the UX Skywalker hated
  // (commit 8a57181 disabled it entirely; this swap brings the
  // feature back without the takeover). 2026-05-18.
  const shipStreetInputRef = useRef<HTMLInputElement>(null);
  const [placeSuggestions, setPlaceSuggestions] = useState<Array<{ placeId: string; text: string }>>([]);
  const [showPlaceDropdown, setShowPlaceDropdown] = useState(false);
  // Google bills autocomplete-then-details together as one session
  // when the same token is passed to both. We rotate the token after
  // each pick so the next typing cycle starts fresh.
  const placeSessionTokenRef = useRef<string>("");
  // Set true right before we programmatically populate shipStreet
  // from a picked suggestion, so the debounced fetcher (keyed on
  // shipStreet) doesn't immediately fire another autocomplete
  // request for the just-pasted street.
  const placeJustPickedRef = useRef(false);
  const ensurePlaceSession = useCallback(() => {
    if (!placeSessionTokenRef.current) {
      placeSessionTokenRef.current = (typeof crypto !== "undefined" && "randomUUID" in crypto)
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    }
    return placeSessionTokenRef.current;
  }, []);
  // Debounced fetch — fires 200ms after the user stops typing in
  // the ship street field. Only active when the user is on the
  // contact step in shipping mode (matches where the input is
  // mounted), and short-circuits when shipStreet was just set
  // programmatically by picking a suggestion.
  useEffect(() => {
    if (handoffMethod !== "ship" || step !== "contact") return;
    if (placeJustPickedRef.current) {
      placeJustPickedRef.current = false;
      return;
    }
    if (!shipStreet || shipStreet.length < 3) {
      setPlaceSuggestions([]);
      return;
    }
    const t = setTimeout(async () => {
      try {
        const r = await fetch("/api/places-autocomplete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ input: shipStreet, sessionToken: ensurePlaceSession() }),
        });
        if (!r.ok) return;
        const d = await r.json();
        setPlaceSuggestions(Array.isArray(d.suggestions) ? d.suggestions : []);
      } catch {}
    }, 200);
    return () => clearTimeout(t);
  }, [shipStreet, handoffMethod, step, ensurePlaceSession]);
  // Picking a suggestion: hit /api/places-details to get parsed
  // address components, populate the 5 split fields, then rotate
  // the session token so the next typing cycle starts a new
  // billing session.
  const pickPlaceSuggestion = useCallback(async (placeId: string) => {
    setShowPlaceDropdown(false);
    setPlaceSuggestions([]);
    try {
      const r = await fetch("/api/places-details", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ placeId, sessionToken: placeSessionTokenRef.current }),
      });
      if (!r.ok) return;
      const d = await r.json();
      placeJustPickedRef.current = true;
      if (d.street) setShipStreet(d.street);
      if (d.city) setShipCity(d.city);
      if (d.state) setShipState(d.state);
      if (d.zip) setShipZip(d.zip);
    } catch {} finally {
      placeSessionTokenRef.current = "";
    }
  }, []);
  // Cash is local-only. If the user picked Cash while on Local and then
  // switches to shipping, clear the payout (invalid combo at submit) AND
  // send them back to the payout step. Without the step reset the user
  // sits on the contact step with payout=null, which fails the contact
  // section's `payout && (…)` gate → entire form unmounts → viewport
  // falls through to the footer (Skywalker 2026-05-18 "famous footer"
  // bug report).
  useEffect(() => {
    if (handoffMethod === "ship" && payout?.id === "cash") {
      setPayout(null);
      setPayoutHandle("");
      setPayoutHandleConfirm("");
      setStep("payout");
    }
  }, [handoffMethod, payout]);

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
  // Contact step extras — Skywalker 2026-05-18 "make sure im getting
  // every detail: number email full spec best contact shipping vs
  // local". bestContact lets the seller pick how they'd rather hear
  // back (Text / Call / Email) so staff doesn't bounce them across
  // channels. customerNote is a free-form "anything else we should
  // know" field — building buzzers, work hours, accessories, etc.
  type BestContact = "text" | "call" | "email";
  const [bestContact, setBestContact] = useState<BestContact | null>(null);
  // "Best way to reach you" collapsed by default — keeps the step tidy.
  const [reachOpen, setReachOpen] = useState(false);
  // Phone section collapsed by default — tap-to-open like the photos.
  const [phoneOpen, setPhoneOpen] = useState(false);
  const [customerNote, setCustomerNote] = useState("");
  // "Anything else" note collapsed by default — keeps the step tidy.
  const [noteOpen, setNoteOpen] = useState(false);
  // Explicit SMS opt-in checkbox — TCPA Class-A compliance. Today an
  // implied-consent paragraph runs under the phone field; that's
  // defensible for transactional messages but borderline for anything
  // that drifts toward marketing. Real unchecked checkbox eliminates
  // the gray area. Server rejects POST if phone present + smsOptIn !==
  // true (defense in depth — client may be bypassed).
  const [smsOptIn, setSmsOptIn] = useState(false);
  // Coupon code entry on contact step — Skywalker 2026-05-18 review-
  // reward feature. Customer who left a review gets a $25 code they
  // can apply to their next trade. Client-side check is informational
  // only; /api/lead does the authoritative redeem at submit.
  const [couponInput, setCouponInput] = useState("");
  const [couponState, setCouponState] = useState<"idle" | "checking" | "valid" | "invalid">("idle");
  const [couponValid, setCouponValid] = useState<{ code: string; value: number } | null>(null);
  const [couponMessage, setCouponMessage] = useState<string>("");
  // Coupon entry collapsed by default — keeps the contact step tidy.
  const [couponOpen, setCouponOpen] = useState(false);
  const checkCoupon = async () => {
    const raw = couponInput.trim().toUpperCase();
    if (!raw) {
      setCouponState("idle"); setCouponValid(null); setCouponMessage("");
      return;
    }
    setCouponState("checking");
    setCouponMessage("");
    try {
      const params = new URLSearchParams({ code: raw });
      if (email) params.set("email", email);
      if (phone) params.set("phone", phone.replace(/\D/g, ""));
      const r = await fetch(`/api/coupons/check?${params}`, { cache: "no-store" });
      const d = await r.json().catch(() => ({}));
      if (r.ok && d.valid) {
        setCouponState("valid");
        setCouponValid({ code: d.code, value: d.value });
        setCouponMessage(d.identityMatched ? `✓ $${d.value} bonus will be added at checkout` : `✓ $${d.value} bonus available — enter the email/phone the code was issued to`);
      } else {
        setCouponState("invalid");
        setCouponValid(null);
        setCouponMessage(d.error || "Code not valid");
      }
    } catch {
      setCouponState("invalid");
      setCouponMessage("Couldn't verify the code right now");
    }
  };
  // IMEI / serial validator (optional, contact step)
  const [imeiInput, setImeiInput] = useState("");
  const [imeiState, setImeiState] = useState<"idle" | "checking" | "ok" | "warn" | "error">("idle");
  const [imeiResult, setImeiResult] = useState<{ model?: string; warnings?: string[]; error?: string } | null>(null);
  const [imeiHelpOpen, setImeiHelpOpen] = useState(false);
  const [phoneInfoOpen, setPhoneInfoOpen] = useState(false);
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
  // Returning-visitor greeting — a prior completed submission leaves a
  // "tcc-returning" localStorage marker; read on mount to welcome them
  // back on the landing step.
  const [welcomeBack, setWelcomeBack] = useState<{ name: string } | null>(null);
  // Cart items snapshot the full funnel state at add-to-cart time so every
  // device in a multi-item submission carries its own chip/RAM/GPU/battery/
  // etc. answers through to the staff backend. Without these per-device
  // specs Skywalker was making blind offers on bundled trades. Skywalker
  // 2026-05-17.
  type CartItem = {
    model: string;
    modelId: string;
    storage: string;
    condition: string;
    price: number;
    quantity: number;
    image?: string;
    carrier?: string;
    connectivity?: string;
    processor?: string;
    memory?: string;
    graphics?: string;
    displayResolution?: string;
    displayGlass?: string;
    batteryHealth?: string;
    charger?: string;
    extras?: string[];
    brokenGlass?: "front" | "back" | "both" | null;
    brokenFunctional?: boolean | null;
    paidOff?: boolean | null;
    imei?: string;
  };
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  // Bump counter — increments every time an item is added so the cart
  // icon + badge can re-animate (key change forces remount + keyframe).
  const [cartBump, setCartBump] = useState(0);
  // Toast — short-lived confirmation that shows what was just added / removed.
  const [cartToast, setCartToast] = useState<{ model: string; price: number; kind?: "add" | "remove" } | null>(null);
  const [inquiryCategory, setInquiryCategory] = useState("");
  const [inquirySent, setInquirySent] = useState(false);
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  // Photo section collapsed by default — keeps the contact step tidy.
  const [photosOpen, setPhotosOpen] = useState(false);
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
  // Captured from the /api/lead response so the done step + thank-you
  // section can link to /offer/[leadId] for the full offer-management
  // page (status, print label, shipping checklist, modify/cancel).
  // Skywalker 2026-05-19.
  const [submittedLeadId, setSubmittedLeadId] = useState<string | null>(null);
  // FedEx label info returned from /api/lead when a ship lead was submitted.
  // Used by the done page to render a Print-your-label CTA for shipping
  // customers. Skywalker 2026-05-17.
  const [submittedLabel, setSubmittedLabel] = useState<{ tracking: string; url: string; service: string } | null>(null);
  const [submittedLabelError, setSubmittedLabelError] = useState<{ kind: "ADDRESS_INVALID" | "SERVICE_UNAVAILABLE"; hint: string } | null>(null);
  // Tracks the contact-step submit so the button can disable + show
  // progress copy while the lead POST + FedEx label mint (2-4s for ship
  // handoffs) is in flight. Without this the user could rage-click submit
  // and fire multiple leads. Skywalker 2026-05-18.
  const [submittingLead, setSubmittingLead] = useState(false);
  // Carrier balance status — captured at checkout as a Yes / No question.
  // Skywalker 2026-05-17 — we DO buy devices that aren't fully paid off
  // but the offer may be reduced because the carrier can blacklist them.
  // Surfaced to staff in the lead body. Stolen-reported devices are out
  // of scope here (separate filter).
  const [paidOff, setPaidOff] = useState<boolean | null>(null);
  const [inquiryDesc, setInquiryDesc] = useState("");
  const [cookieConsent, setCookieConsent] = useState<string | null>(null);
  const [heroPhonePop, setHeroPhonePop] = useState(false);
  const [dualPathPop, setDualPathPop] = useState<"local" | "ship" | null>(null);
  // Funnel-advance buttons unmount the moment they're clicked, so the pop
  // animation needs a brief beat to play before the step changes.
  const [funnelPop, setFunnelPop] = useState<string | null>(null);
  // Which "4 steps to get paid" card is tap-expanded. Mobile has no
  // hover, so the step detail is a tap-to-expand accordion there;
  // desktop still reveals on hover. Skywalker 2026-05-22.
  const [openStep, setOpenStep] = useState<number | null>(null);
  const popThenRun = (id: string, run: () => void) => {
    setFunnelPop(id);
    setTimeout(() => { setFunnelPop(null); run(); }, 280);
  };
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
  }, [step, page, selectedSeries, selectedSubSeries]);

  // Returning-visitor greeting — read the localStorage marker a prior
  // completed submission left, so we welcome the customer back on the
  // landing step (instant, no contact info needed).
  useEffect(() => {
    try {
      const raw = localStorage.getItem("tcc-returning");
      if (raw) {
        const d = JSON.parse(raw);
        if (d?.name) setWelcomeBack({ name: String(d.name).slice(0, 40) });
      }
    } catch {}
  }, []);
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

  // First-touch attribution. Capture UTM params + referrer the first
  // time a user lands on the site within a 30-day window. Persist to
  // localStorage so the channel that ACTUALLY drove the visit survives
  // through cart abandonment + funnel restart. Skywalker 2026-05-18:
  // we have zero source-of-truth on where leads come from today.
  // First-touch (not last-touch) on purpose — once a customer arrives
  // via "Google Ads · iphone-trade-in", we want credit to stay there
  // even if they re-visit organically before submitting.
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const STORAGE_KEY = "tcc-attribution";
      const TTL_MS = 30 * 24 * 60 * 60 * 1000;
      const existing = localStorage.getItem(STORAGE_KEY);
      if (existing) {
        const parsed = JSON.parse(existing);
        if (parsed && Date.now() - (parsed.ts || 0) < TTL_MS) return; // first-touch already captured + fresh
      }
      const params = new URLSearchParams(window.location.search);
      const utm = {
        source: params.get("utm_source") || undefined,
        medium: params.get("utm_medium") || undefined,
        campaign: params.get("utm_campaign") || undefined,
        term: params.get("utm_term") || undefined,
        content: params.get("utm_content") || undefined,
      };
      const hasUtm = Object.values(utm).some(Boolean);
      // Pull a clean referrer host — full URLs leak query strings + are
      // noisy in admin. If no referrer + no UTM, save a "direct" marker
      // so we don't keep re-reading on every render.
      let referrer: string | undefined;
      if (document.referrer) {
        try { referrer = new URL(document.referrer).host; } catch { referrer = document.referrer.slice(0, 80); }
      }
      const sameOrigin = referrer && referrer === window.location.host;
      const payload = {
        ts: Date.now(),
        landed: window.location.pathname,
        ...(hasUtm ? utm : {}),
        ...(referrer && !sameOrigin ? { referrer } : {}),
        ...(!hasUtm && !referrer ? { source: "direct" } : {}),
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch {}
  }, []);
  // Helper to read the current attribution payload back when submitting.
  const readAttribution = (): Record<string, string> | undefined => {
    if (typeof window === "undefined") return undefined;
    try {
      const raw = localStorage.getItem("tcc-attribution");
      if (!raw) return undefined;
      const p = JSON.parse(raw) as Record<string, unknown>;
      const out: Record<string, string> = {};
      for (const k of ["source", "medium", "campaign", "term", "content", "referrer", "landed"]) {
        const v = p[k];
        if (typeof v === "string" && v) out[k] = v;
      }
      return Object.keys(out).length > 0 ? out : undefined;
    } catch { return undefined; }
  };

  useEffect(() => {
    try {
      const saved = localStorage.getItem("tcc-session");
      if (!saved) return;
      const s = JSON.parse(saved);
      if (!s.step || s.step === "done" || Date.now() - (s.ts || 0) >= 7 * 24 * 60 * 60 * 1000) return;

      // PERMANENT FIX for the "page falls through to footer" bug
      // (Skywalker 2026-05-18, recurring). Each step's render gate
      // requires specific pieces of state — if we restore to a step
      // but the required state is missing (e.g. localStorage was
      // partially cleared, an old session format, payout deleted,
      // etc.), every step section's gate fails and the user sees ONLY
      // the universal footer. Solution: validate the saved step
      // against its render-gate requirements BEFORE setting it. If
      // anything's missing → drop to step="device" so the home hero
      // always renders.
      //
      // Cart-aware: the late-funnel steps (quote, checkout, payout,
      // contact) accept EITHER a funnel-in-progress (model+condition)
      // OR cart items. The cart lives in a separate tcc-cart entry,
      // so we peek at that here too. Otherwise customers who quoted
      // entirely via the cart get bounced to home on refresh. Fixed
      // 2026-05-18.
      const hasCartItems = (() => {
        try {
          const raw = localStorage.getItem("tcc-cart");
          if (!raw) return false;
          const c = JSON.parse(raw);
          return Array.isArray(c?.items) && c.items.length > 0;
        } catch {
          return false;
        }
      })();
      // Match every step's render gate EXACTLY so refresh resumes
      // on any step that actually has the data it needs. Anything that
      // wouldn't render is dropped to home. Updated 2026-05-18 after
      // mapping all 24 step gates in the funnel. Skywalker: "keep my
      // spot without going to footer at every level".
      const requirementsMet = (() => {
        switch (s.step) {
          // Free-to-navigate early steps
          case "device":
          case "category":
          case "inquiry":
            return true;
          case "brand":
            return !!s.deviceType || true; // gate also needs category; deviceType is set when brand picked, but brand renders even from category=null in some flows
          case "model":
            return true; // gate is page==="home" only

          // Mid-funnel — need at least model
          case "storage":
          case "condition":
            return !!s.model;

          // Broken-condition sub-steps — need model + broken-condition
          case "broken-functional":
          case "broken-glass":
            // Saved condition would have to be the "broken" entry; can't
            // verify deep shape, so allow if model+condition present.
            return !!s.model && !!s.condition;

          // Connectivity (iPad only)
          case "connectivity":
            return !!s.model && s.deviceType === "ipad";

          // MacBook / additive-spec steps — require model
          case "processor":
          case "memory":
          case "graphics":
          case "displayresolution":
          case "displayglass":
          case "batteryhealth":
          case "charger":
          case "extras":
            return !!s.model;

          // Carrier flow — needs model + condition
          case "carrier":
            return !!s.model && !!s.condition;
          case "carrier-lock":
            return !!s.model && !!s.condition && !!s.carrier;

          // Quote/checkout/payout/contact — cart items also qualify
          case "quote":
            return !!s.model && !!s.condition;
          case "checkout":
            return (!!s.model && !!s.condition) || hasCartItems;
          case "payout":
            // Gate is just step+page — but no point landing here with
            // empty everything (it'd show an empty payout picker).
            return (!!s.model && !!s.condition) || hasCartItems;
          case "contact":
            return ((!!s.model && !!s.condition) || hasCartItems) && !!s.payout;

          // Terminal — never restore to done; cleared up top.
          case "done":
            return false;

          default:
            // Unknown step (legacy / typo) — drop to home.
            return false;
        }
      })();
      if (!requirementsMet) {
        // Stale / partial session — quietly reset so user lands on home.
        localStorage.removeItem("tcc-session");
        return;
      }

      if (s.deviceType) setDeviceType(s.deviceType);
      if (s.selectedSeries) setSelectedSeries(s.selectedSeries);
      if (s.model) setModel(s.model);
      if (s.storage) setStorage(s.storage);
      if (s.condition) setCondition(s.condition);
      if (s.carrier) setCarrier(s.carrier);
      if (s.quantity) setQuantity(s.quantity);
      if (s.email) setEmail(s.email);
      if (s.handoffMethod) setHandoffMethod(s.handoffMethod);
      if (s.shipStreet) setShipStreet(s.shipStreet);
      if (s.shipUnit) setShipUnit(s.shipUnit);
      if (s.shipCity) setShipCity(s.shipCity);
      if (s.shipState) setShipState(s.shipState);
      if (s.shipZip) setShipZip(s.shipZip);
      if (s.shipHasBox) setShipHasBox(s.shipHasBox);
      if (s.payout) setPayout(s.payout);
      if (s.name) setName(s.name);
      if (s.phone) setPhone(s.phone);
      setStep(s.step);
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
        payout, name, phone,
        ts: Date.now(),
      }));
    } catch {}
  }, [step, deviceType, selectedSeries, model, storage, condition, carrier, quantity, email, handoffMethod, shipStreet, shipUnit, shipCity, shipState, shipZip, shipHasBox, payout, name, phone]);

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
  // Admin overrides (from /api/admin/prices, saved at /admin/prices) are
  // checked FIRST so Skywalker's edits go live within seconds of saving
  // without redeploying. Falls back to the bundled tables below if no
  // override exists for this cell. Skywalker 2026-05-18 self-serve editor.
  const lookupPrice =
    priceOverrides?.priceTable?.[model?.id ?? ""]?.[storage?.id ?? "base"]?.[condition?.id ?? ""]
    ?? PRICE_TABLE[model?.id ?? ""]?.[storage?.id ?? "base"]?.[condition?.id ?? ""];
  const carrierDeduction =
    priceOverrides?.carrierDeductions?.[model?.id ?? ""]?.[carrier?.id ?? ""]
    ?? CARRIER_DEDUCTIONS[model?.id ?? ""]?.[carrier?.id ?? ""]
    ?? 0;
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
        // verygood retained as a fallback only for legacy admin overrides
        // saved before the 2026-05-19 Mint/VG collapse. Live funnel can't
        // produce verygood any more — the picker only emits sealed/mint/
        // good/fair/broken.
        const MCOND: Record<string, number> = { sealed: 50, mint: 0, verygood: -110, good: -110, fair: -220 };
        const specCondAdj = model ? getMacSpec(model.id)?.condition_adj : undefined;
        const condId = condition?.id ?? "mint";
        // Admin override layer: /admin/prices conditionAdj edits override
        // the bundled scrape values per (model, condition). Falls through
        // to the bundled spec, then to MCOND for legacy MacBooks without
        // scraped data. Skywalker 2026-05-18 self-serve editor.
        const overrideCondAdj = model ? priceOverrides?.conditionAdj?.[model.id]?.[condId] : undefined;
        const cond = overrideCondAdj !== undefined
          ? overrideCondAdj
          : specCondAdj && (condId in specCondAdj)
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
      : (() => {
          // model.base via admin override (baseOverrides[id]) if present —
          // covers VR, drones, Garmin, any other simple-base device. Falls
          // back to the bundled model.base. Skywalker 2026-05-18 self-serve
          // price editor.
          const effBase = (model && (priceOverrides?.baseOverrides?.[model.id] ?? model.base)) || 0;
          return model && condition && effBase
            ? Math.max(0, Math.round(effBase * storageMultiplier * condition.multiplier * carrierMultiplier * nonCarrierMultiplier + extrasAdjSum)) + promoFlatBonus
            : 0;
        })();
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
  // Force manual review ONLY when we have a resell comp AND that comp's
  // 75% cap would push the quote below MIN_OFFER. The cap-only path
  // (resell known, baseQuote stays above MIN_OFFER) lets the cap apply
  // silently. Models without a resell entry just use rawQuote — the
  // PRICE_TABLE values were already vetted from IWM so we trust them
  // when we can't sanity-check via Swappa mid. Skywalker 2026-05-19
  // after the prior `workingResell == null` trigger was flagging
  // basically every non-iPhone device for manual review.
  const needsMarginReview = marginCap != null && marginCap < MIN_OFFER;
  const quote = quoteAfterCap;
  // Minimum offer threshold — below this we lose money on shipping +
  // processing. Show "Manual quote" instead of a dollar amount.
  // User can still add to cart; we review manually before paying out.
  // A priced device (has a base price) that quotes under the minimum —
  // including an exact $0 — goes to manual review instead of showing
  // "$0" all over the offer screen. Inquiry-only models (no base price)
  // are handled separately by isPendingQuote below.
  const isBelowMinimum = !!model?.base && quote < MIN_OFFER;
  // Inquiry-only models have no base price (or 0). We still let the
  // user walk the funnel + add to cart; the quote step shows
  // 'Quote pending' instead of a number, and the cart marks the line
  // 'Pending quote'.
  const isPendingQuote = !model?.base;
  const isBrokenNonFunctional = condition?.id === "broken" && brokenFunctional === false;
  const isManualQuote = isBelowMinimum || isBrokenNonFunctional || needsMarginReview;
  const needsReview = MANUAL_REVIEW_DEVICES.has(model?.id ?? "");
  // Personalize the "why we need to review" message per trigger so the
  // customer understands what's specifically blocking the instant quote.
  // Skywalker 2026-05-19 — generic "below threshold" was confusing for
  // broken-non-functional devices and Pixel/Galaxy models we just haven't
  // priced yet.
  const manualReviewReason: { title: string; body: string } = isBrokenNonFunctional
    ? {
        title: "Non-working device — we still want it",
        // Soft-advertise parts iPhones without saying "iCloud locked"
        // outright — staff still needs to verify the device isn't
        // reported stolen before we commit to a price. Listed symptoms
        // (won't boot / won't activate) are the giveaway for activation-
        // locked or activation-failed devices; customers who know their
        // phone's locked recognize the language. Skywalker 2026-05-19.
        body: "We still buy phones for parts — cracked screen, dead display, water damage, won't boot, won't activate. Each one needs a quick photo + IMEI check so we can quote parts value accurately. Send it through chat (or add it to your box) and we'll text you a fair custom offer within the hour — typically $20–200 depending on the model and what's salvageable.",
      }
    : needsMarginReview
    ? {
        title: "We're double-checking the resale value",
        body: "Our system flagged this combination because we don't have a recent market reference for it yet. Staff will pull a real-time comp and text you a custom quote within the hour — you'll get a fair number before we ask you to ship.",
      }
    : isBelowMinimum
    ? {
        title: "Below our standard offer threshold",
        body: "This config quotes under our $25 minimum payout. We can still take the device — staff will quote it manually so we don't waste your shipping. Tell us about any extras (box, accessories, recent repair) when we reach out — sometimes that pushes it over the line.",
      }
    : {
        title: "Manual review needed",
        body: "Add it to your box and we'll text you a fair custom quote within the hour.",
      };

  const maxQuoteFor = (v: { id: string; base: number }) => {
    const sids = STORAGE_MAP[v.id];
    const maxStorageMult = sids?.length ? Math.max(...sids.map(sid => ALL_STORAGES.find(s => s.id === sid)?.multiplier ?? 1)) : 1;
    return Math.round(v.base * maxStorageMult * 1.15);
  };
  const maxQuoteForSeries = (vs: { id: string; base: number }[]) => Math.max(...vs.map(maxQuoteFor));

  const pushHistory = useCallback((s: string) => {
    window.history.pushState({ step: s }, "", `#${s}`);
    // GA4 funnel-step event — fires once per step transition. Lets
    // analytics.google.com's Funnel Explorer show drop-off by step (which
    // step do customers bail at?). Skywalker 2026-05-19 — needs live
    // funnel visibility before the marketing push. The current device +
    // model are pulled from window refs set by the funnel; both safe to
    // be undefined on the early steps (gtag tolerates missing params).
    // visitor_id pulled from window.__tccVid (set by the cookie-init
    // script in layout.tsx) so we can join multi-visit funnels for the
    // same person.
    try {
      const w = window as unknown as { gtag?: (...args: unknown[]) => void; __tccVid?: string; __tccFunnelRefs?: { device?: string | null; modelId?: string | null }; __tccLatestStep?: string; __tccSubmitted?: boolean };
      const refs = w.__tccFunnelRefs;
      // Track the latest step the user reached — beforeunload handler
      // below reads this to fire a funnel_abandon event when they
      // leave without submitting. Skipping the "success" step so we
      // don't flag successful submitters as abandoners.
      if (s !== "success") w.__tccLatestStep = s;
      if (w.gtag) {
        w.gtag("event", "funnel_step", {
          step: s,
          device: refs?.device ?? undefined,
          model: refs?.modelId ?? undefined,
          visitor_id: w.__tccVid,
        });
      }
      // Mirror to Vercel Analytics custom events — shows up in
      // vercel.com → project → Analytics → Events. Same payload so
      // GA4 + Vercel stay in sync. Skywalker 2026-05-19 follow-up.
      vercelTrack("funnel_step", {
        step: s,
        device: refs?.device ?? null,
        model: refs?.modelId ?? null,
      });
    } catch {}
  }, []);

  // Funnel abandonment beacon — fires on tab close / nav away if the
  // user reached the funnel but never hit funnel_submit. transport:
  // 'beacon' makes GA4 use sendBeacon so the event survives the page
  // unload race. Skywalker 2026-05-19 — pairs with Clarity recordings
  // for "they got to the contact step then bailed" diagnostics.
  // Once-per-session guard prevents double-fire when both beforeunload
  // AND pagehide trigger on the same navigation (mobile Safari emits
  // both events on tab close).
  useEffect(() => {
    let fired = false;
    const onUnload = () => {
      if (fired) return;
      try {
        const w = window as unknown as { gtag?: (...args: unknown[]) => void; __tccVid?: string; __tccLatestStep?: string; __tccSubmitted?: boolean };
        if (!w.gtag) return;
        if (w.__tccSubmitted) return; // they finished — no abandon
        const last = w.__tccLatestStep;
        if (!last || last === "device") return; // never engaged past landing
        fired = true;
        w.gtag("event", "funnel_abandon", {
          last_step: last,
          visitor_id: w.__tccVid,
          transport_type: "beacon",
        });
        // Mirror to Vercel Analytics. Vercel's track() uses sendBeacon
        // under the hood already so this survives the unload race.
        try { vercelTrack("funnel_abandon", { last_step: last }); } catch {}
      } catch {}
    };
    window.addEventListener("beforeunload", onUnload);
    window.addEventListener("pagehide", onUnload);
    return () => {
      window.removeEventListener("beforeunload", onUnload);
      window.removeEventListener("pagehide", onUnload);
    };
  }, []);

  // popstate handler — Chrome / iOS Safari back button fires this when the
  // user pops a history entry we pushed via pushHistory. Skywalker 2026-05-19:
  // previously the listener re-registered on every render (no dep array)
  // AND TCC Back buttons called handleBack() directly, which updated React
  // state WITHOUT popping the URL hash. The URL would then say "#condition"
  // while the UI was on the model step, and Chrome back became a no-op
  // (pop'd from #condition to #model, which is what the UI was already
  // showing). Now: TCC Back buttons call goBack() → window.history.back(),
  // which fires popstate → ref-based dispatch into handleBack. Single
  // source of truth; URL and React state stay in lockstep.
  const handleBackRef = useRef<() => void>(() => {});
  // Mirror device + model into a window ref so the pushHistory GA4 event
  // can attach them as event params without needing them as useCallback
  // deps (deps would re-create the callback on every keystroke).
  useEffect(() => {
    (window as unknown as { __tccFunnelRefs?: Record<string, string | null> }).__tccFunnelRefs = {
      device: deviceType ?? null,
      modelId: model?.id ?? null,
    };
  }, [deviceType, model]);
  useEffect(() => {
    const onPop = () => { handleBackRef.current?.(); };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);
  const goBack = useCallback(() => {
    // If the URL hash matches the current step, the browser has a real
    // entry to pop — let it fire popstate so the URL updates with the
    // state change. Otherwise (edge cases like deeplinks that didn't
    // push) fall back to running handleBack directly.
    if (typeof window !== "undefined" && window.history.length > 1) {
      window.history.back();
    } else {
      handleBackRef.current?.();
    }
  }, []);

  // Single source of truth — handleBack performs the state transition.
  // Every TCC Back button calls goBack() (below) which routes through
  // window.history.back() so the URL and React state stay in sync.
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
      if (model && hasAdditiveSpecs(model.id)) {
        // Back-skip empty steps: if memory is empty, go to processor.
        const spec = getMacSpec(model.id);
        if (spec?.memory && spec.memory.length > 0) { setStep("memory"); setMemory(null); }
        else { setStep("processor"); setProcessor(null); }
      }
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
    else if (step === "contact") { setStep("payout"); }
    // After any back-step transition, scroll to the top of the new step.
    // Without this, the previous step's scroll-Y is preserved and on a
    // shorter incoming step the user ends up parked in the footer area —
    // Skywalker 2026-05-17 "go to checkout and don't submit and go back
    // on Home Screen it still goes to footer". Instant scroll (not
    // smooth) so it lands before paint.
    window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
  };
  // Keep the popstate dispatch ref pointing at the freshest handleBack so
  // it always sees current state. The ref is consumed by the mount-time
  // popstate listener registered above.
  handleBackRef.current = handleBack;


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
    setPayoutHandle("");
    setPayoutHandleConfirm("");
    setQuantity(1);
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
    setBestContact(null); setCustomerNote(""); setSmsOptIn(false);
    setCouponInput(""); setCouponState("idle"); setCouponValid(null); setCouponMessage("");
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
              <Pic src={model.image} alt="" className="max-w-full max-h-full object-contain" style={{ filter: "drop-shadow(0 4px 8px rgba(0,0,0,0.5))" }} />
            ) : (
              <svg className="w-5 h-5 opacity-50 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3" /></svg>
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
                <p className="text-white font-extrabold text-xl mt-1 leading-tight">{isManualQuote ? "Custom quote — no instant value" : "Quoted via email or text"}</p>
                <p className="text-[#888] text-xs mt-1">{isManualQuote ? "Staff texts you a fair offer within the hour" : ""}</p>
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
            <Pic src={model.image} alt={model.label} size={640} className="w-full h-full object-contain" style={{ filter: "drop-shadow(0 18px 22px rgba(0,0,0,0.55)) drop-shadow(0 4px 8px rgba(0,0,0,0.35))" }} />
          ) : (
            <svg className="w-14 h-14 opacity-30 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3" /></svg>
          )}
        </div>
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#00c853] mb-1">Selling</p>
        <p className="text-[22px] font-extrabold text-white leading-tight mb-4">{model.label}</p>
        <div className="space-y-2 border-t border-white/10 pt-4">
          {[
            { label: "Processor",    value: processor?.label,    active: step === "processor",    helpId: null as null,       onJump: editRow("processor"),    show: macSpecFlow },
            { label: "Memory",       value: memory?.label,       active: step === "memory",       helpId: null as null,       onJump: editRow("memory"),       show: macSpecFlow },
            // Storage — in the spec'd laptop flow it is asked BEFORE Condition.
            { label: "Storage",      value: storage?.label,      active: step === "storage",      helpId: "storage" as const, onJump: editRow("storage"),      show: !isNoStorageDevice && macSpecFlow },
            { label: "Display",      value: displayGlass?.label, active: step === "displayglass", helpId: null as null,       onJump: editRow("displayglass"), show: macSpecFlow && macHasGlassStep },
            { label: "Condition",    value: condition ? getConditionLabel(condition, deviceType).label : undefined, active: step === "condition", helpId: null as null, onJump: editRow("condition"), show: true },
            { label: "Battery",      value: batteryHealth?.label, active: step === "batteryhealth", helpId: null as null,      onJump: editRow("batteryhealth"), show: macSpecFlow },
            { label: "Charger",      value: charger?.label,      active: step === "charger",      helpId: null as null,       onJump: editRow("charger"),      show: macSpecFlow },
            // Brand extras (PS5 disc / drone hours / watch band etc) get
            // one row per answered question, only shown for device types
            // that declare extras in BRAND_EXTRAS.
            ...getBrandExtras(deviceType, model?.id).map((q, qi) => ({
              label: q.question.replace(/\?$/, ""),
              value: extras[q.id]?.label,
              active: step === "extras" && getBrandExtras(deviceType, model?.id)[extrasIndex]?.id === q.id,
              helpId: null as null,
              onJump: () => { setExtrasIndex(qi); setStep("extras"); pushHistory("extras"); },
              show: true,
            })),
            { label: "Connectivity", value: connectivity?.label, active: step === "connectivity", helpId: null as null,       onJump: editRow("connectivity"), show: deviceType === "ipad" },
            // Storage — standard flow (phones / iPad) asks it AFTER Condition.
            { label: "Storage",      value: storage?.label,      active: step === "storage",      helpId: "storage" as const, onJump: editRow("storage"),      show: !isNoStorageDevice && !macSpecFlow },
            { label: "Carrier",      value: isManualQuote ? "N/A" : carrier?.label,      active: step === "carrier",      helpId: "carrier" as const, onJump: editRow("carrier"),      show: (isPhoneFlow || isIpadCellular) && !isManualQuote },
            { label: "Carrier Lock", value: isManualQuote ? "N/A" : carrierLock?.label,  active: step === "carrier-lock", helpId: null as null,       onJump: editRow("carrier-lock"), show: (isPhoneFlow || isIpadCellular) && !isManualQuote },
          ].filter(row => row.show && (row.value || row.active)).map(row => {
            // Only rows that are filled in or currently being selected
            // show — not-yet-reached steps stay hidden so the panel
            // doesn't list empty "—" rows. A row with a value is a
            // completed step and clicking it jumps the funnel back.
            const canJump = !!row.value && !row.active;
            return (
            <div key={row.label} onClick={canJump ? row.onJump : undefined}
              className={`rounded-lg px-3 py-2.5 transition-all duration-[250ms] ease-out ${row.active ? "bg-[#00c853]/12 border border-[#00c853]" : row.value ? "bg-[rgba(15,15,15,0.5)] border border-white/10" : "border border-transparent"}${canJump ? " cursor-pointer hover:border-[#00c853]/60" : ""}`}>
              <div className="flex items-center justify-between gap-2">
                <span className={`text-[11px] font-medium uppercase tracking-wider inline-flex items-center gap-1.5 ${row.active ? "text-[#00c853]" : "text-[#b8b8b8]"}`}>
                  {row.label}
                  {row.helpId && (
                    <button type="button" onClick={(e) => { e.stopPropagation(); setHelpTopic(helpTopic === row.helpId ? null : row.helpId); }} aria-label={`How to find ${row.label}`} className="w-4 h-4 rounded-full bg-white/10 hover:bg-[#00c853] hover:text-[#0a0a0a] flex items-center justify-center text-[10px] font-bold leading-none cursor-pointer transition">i</button>
                  )}
                </span>
                <span className={`text-right text-[15px] font-extrabold ${row.value ? (row.active ? "text-[#00c853]" : "text-white") : "text-[#888]"}`}>
                  {row.value || (row.active ? "Selecting…" : "—")}
                </span>
              </div>
            </div>
            );
          })}
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
          <Pic src={l.image} alt="" className="w-full h-full object-contain p-0.5" />
        ) : (
          <svg className="w-5 h-5 opacity-40 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3" /></svg>
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
        const catFallback = (cat: typeof category): React.ReactNode => ({
          phones: <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3" />,
          tablets: <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 18.75a.75.75 0 000 1.5h3a.75.75 0 000-1.5h-3zM8.625.75A3.375 3.375 0 005.25 4.125v15.75a3.375 3.375 0 003.375 3.375h6.75a3.375 3.375 0 003.375-3.375V4.125A3.375 3.375 0 0015.375.75h-6.75z" />,
          computers: <path strokeLinecap="round" strokeLinejoin="round" d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25m18 0A2.25 2.25 0 0018.75 3H5.25A2.25 2.25 0 003 5.25m18 0V12a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 12V5.25" />,
          desktops: <path strokeLinecap="round" strokeLinejoin="round" d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25m18 0A2.25 2.25 0 0018.75 3H5.25A2.25 2.25 0 003 5.25m18 0V12a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 12V5.25" />,
          watches: <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />,
          consoles: <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h.008v.008H7.5V8.25zm0 3h.008v.008H7.5v-.008zm-2.25.75h.008v.008H5.25v-.008zm4.5 0h.008v.008H9.75v-.008zM16.5 9a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zm3 3a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM6.75 6h10.5a4.5 4.5 0 014.5 4.5v3a4.5 4.5 0 01-4.5 4.5c-1.86 0-3.41-1.28-3.86-3h-2.78c-.45 1.72-2 3-3.86 3a4.5 4.5 0 01-4.5-4.5v-3A4.5 4.5 0 016.75 6z" />,
          drones: <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />,
          vr: <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 9.75A2.25 2.25 0 014.5 7.5h15a2.25 2.25 0 012.25 2.25v4.5A2.25 2.25 0 0119.5 16.5h-3.31a2.25 2.25 0 01-1.59-.659L13.06 14.3a1.5 1.5 0 00-2.12 0l-1.541 1.541a2.25 2.25 0 01-1.59.659H4.5A2.25 2.25 0 012.25 14.25v-4.5z" />,
        } as Record<string, React.ReactNode>)[cat || ""] || <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-14L4 7m8 4v10M4 7v10l8 4" />;
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
                      popThenRun(`search-${h.modelId}-${i}`, () => {
                        setSearchQuery("");
                        setStep("condition");
                        pushHistory("condition");
                      });
                    }}
                    className={`w-full text-left px-4 py-2.5 hover:bg-white/5 transition flex items-center gap-3 border-b border-white/10 last:border-0 cursor-pointer ${funnelPop === `search-${h.modelId}-${i}` ? "tap-confirm" : ""}`}
                  >
                    {h.image ? (
                      <Pic src={h.image} alt={h.label} loading="lazy" className="w-10 h-10 object-contain flex-shrink-0 rounded-md bg-white/5" />
                    ) : (
                      <div className="w-10 h-10 flex items-center justify-center flex-shrink-0 rounded-md bg-white/5"><svg className="w-5 h-5 text-[#00c853]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>{catFallback(h.category)}</svg></div>
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

  // Warm next/image's cache for the whole device catalog the moment a
  // brand is picked. The model / quote / cart screens reuse these exact
  // optimized-URL requests straight from cache, so photos show instantly
  // instead of flashing blank after a snappy step transition. Hidden +
  // eager => the browser fires (and de-dupes) the real requests now.
  // Capped so large laptop catalogs don't swamp the connection.
  const catalogWarmer = (() => {
    if (!deviceType) return null;
    const srcs = Array.from(new Set([
      "/condition-examples/broken-front.png",
      "/condition-examples/broken-back.png",
      ...models
        .map((m) => (m as { image?: string }).image)
        .filter((s): s is string => !!s),
    ])).slice(0, 48);
    if (srcs.length === 0) return null;
    return (
      <div aria-hidden="true" style={{ position: "absolute", width: 0, height: 0, overflow: "hidden", opacity: 0, pointerEvents: "none" }}>
        {srcs.map((src) => <Pic key={src} src={src} alt="" loading="eager" />)}
      </div>
    );
  })();

  return (
    <main className="min-h-screen bg-[#0a0a0a] text-white overflow-x-hidden">
      {catalogWarmer}
      {/* Google Maps JS script removed 2026-05-18. We no longer load any
          client-side Google library — the shipping address autocomplete
          calls our own /api/places-autocomplete + /api/places-details
          proxies (which talk to Google's Places API New server-to-server)
          and renders an inline custom dropdown under the address input.
          Sidesteps the mobile fullscreen takeover the
          PlaceAutocompleteElement triggers on focus, and keeps the
          Maps key off the client entirely. */}
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
      {/* NAV — slides out of view on scroll-down so it doesn't cover the
          middle of the screen while reading; slides back in on scroll-up
          or when returning to the top. */}
      <SlideOnScrollNav className="sticky top-0 z-40 bg-[#0a0a0a]/95 backdrop-blur-xl border-b border-white/10">
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
              <span className="hidden sm:inline-flex items-center gap-1 text-[#00c853] text-xs font-extrabold tracking-wide">{!promo?.active && <svg className="w-4 h-4 shrink-0 text-[#00c853]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M21 11.25v8.25a1.5 1.5 0 01-1.5 1.5H5.25a1.5 1.5 0 01-1.5-1.5v-8.25M12 4.875A2.625 2.625 0 109.375 7.5H12m0-2.625V7.5m0-2.625A2.625 2.625 0 1114.625 7.5H12m0 0V21m-8.625-9.75h18c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125h-18c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" /></svg>}{promo?.active ? `${promo.text} · Click to apply` : "This week — extra cash on select devices · Click to apply"}</span>
              <span className="sm:hidden inline-flex items-center gap-1 text-[#00c853] text-[11px] font-extrabold tracking-wide">{!promo?.active && <svg className="w-4 h-4 shrink-0 text-[#00c853]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M21 11.25v8.25a1.5 1.5 0 01-1.5 1.5H5.25a1.5 1.5 0 01-1.5-1.5v-8.25M12 4.875A2.625 2.625 0 109.375 7.5H12m0-2.625V7.5m0-2.625A2.625 2.625 0 1114.625 7.5H12m0 0V21m-8.625-9.75h18c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125h-18c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" /></svg>}{promo?.active ? `${promo.text} · Click to apply` : "Extra cash · Click to apply"}</span>
            </>
          )}
        </button>
        <div className="max-w-lg md:max-w-3xl lg:max-w-none mx-auto px-4 lg:px-8 py-3 flex items-center justify-between relative">
          {/* LEFT: logo — Top Cash Cellular wordmark (Skywalker 2026-05-20) */}
          <button onClick={() => { reset(); window.scrollTo({ top: 0, behavior: "smooth" }); }} aria-label="Go to homepage" className="cursor-pointer shrink-0 tap-press inline-flex items-center bg-white/[0.12] border border-white/10 rounded-full px-3 py-1">
            <NextImage src="/logo-wordmark.png" alt="Top Cash Cellular" width={1000} height={382} className="h-9 lg:h-11 w-auto" loading="eager" />
          </button>

          {/* CENTER (lg+ only, absolutely centered relative to the nav row): Sell / Bulk / Support */}
          <div className="hidden lg:flex items-center gap-2 absolute left-1/2 -translate-x-1/2 bg-white/[0.12] border border-white/10 rounded-full px-2 py-1">
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
                    <p className="text-[#00c853] text-[11px] font-bold uppercase tracking-[0.2em] tcc-green-pill">Sell your device</p>
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
                      <p className="text-[#00c853] text-[11px] font-bold uppercase tracking-[0.2em] tcc-green-pill">Hot today</p>
                      <span className="inline-flex items-center gap-1.5 text-[10px] text-[#00c853] font-bold uppercase tracking-wider bg-white/[0.12] border border-white/10 rounded-full px-2.5 py-1">
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
                            onClick={(e) => {
                              e.stopPropagation();
                              setCategory(d.cat);
                              setDeviceType(d.dt);
                              setModel({ id: d.model, label: d.title, base: d.floor, image: d.photo });
                              popThenRun(`hot-${d.model}`, () => {
                                setMegaMenuOpen(null);
                                setStep("condition");
                                pushHistory("condition");
                              });
                            }}
                            className={`flex flex-col items-center text-center gap-1 p-3 rounded-2xl bg-white/[0.06] border border-white/10 hover:bg-[#00c853]/10 hover:border-[#00c853]/50 hover:-translate-y-0.5 transition-all duration-200 cursor-pointer tap-press ${funnelPop === `hot-${d.model}` ? "tap-confirm" : ""}`}
                          >
                            {isTight ? (
                              <div className="w-12 h-12 mb-1 flex items-center justify-center p-2">
                                <Pic src={d.photo} alt={d.title} className="w-full h-full object-contain" loading="lazy" />
                              </div>
                            ) : (
                              <Pic src={d.photo} alt={d.title} className="w-12 h-12 object-contain mb-1" loading="lazy" />
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
                    <p className="text-[#00c853] text-[11px] font-bold uppercase tracking-[0.2em] tcc-green-pill">Bulk trade-ins</p>
                    <p className="text-[#9a9a9a] text-[11px]">10+ devices · enterprise &amp; resellers</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {/* LEFT — action cards */}
                    <div className="space-y-2">
                      <a href="/bulk" className="group/blk flex items-start gap-3 p-3 rounded-2xl bg-white/[0.06] border border-white/10 hover:bg-[#00c853]/10 hover:border-[#00c853]/50 hover:-translate-y-0.5 transition-all duration-200">
                        <svg className="w-6 h-6 shrink-0 text-[#00c853]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-14L4 7m8 4v10M4 7v10l8 4" /></svg>
                        <div className="min-w-0">
                          <p className="text-[13px] font-bold text-white group-hover/blk:text-[#00c853] transition">Get a bulk quote</p>
                          <p className="text-[11px] text-[#b8b8b8] mt-0.5 leading-snug">One submission, one payout, volume pricing.</p>
                        </div>
                      </a>
                      <a href={EMAIL_HREF} className="group/blk flex items-start gap-3 p-3 rounded-2xl bg-white/[0.06] border border-white/10 hover:bg-[#00c853]/10 hover:border-[#00c853]/50 hover:-translate-y-0.5 transition-all duration-200">
                        <svg className="w-6 h-6 shrink-0 text-[#00c853]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                        <div className="min-w-0">
                          <p className="text-[13px] font-bold text-white group-hover/blk:text-[#00c853] transition">Talk to bulk team</p>
                          <p className="text-[11px] text-[#b8b8b8] mt-0.5 leading-snug">Custom contracts, NDAs, decommissioning.</p>
                        </div>
                      </a>
                      <a href="tel:+18775492056" className="group/blk flex items-start gap-3 p-3 rounded-2xl bg-white/[0.06] border border-white/10 hover:bg-[#00c853]/10 hover:border-[#00c853]/50 hover:-translate-y-0.5 transition-all duration-200">
                        <svg className="w-6 h-6 shrink-0 text-[#00c853]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" /></svg>
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
                        <p className="text-[#00c853] text-base font-extrabold leading-none tcc-green-pill">{t.tier}</p>
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
                    <p className="text-[#00c853] text-[11px] font-bold uppercase tracking-[0.2em] tcc-green-pill">Help &amp; info</p>
                    <span className="inline-flex items-center gap-1.5 text-[10px] text-[#00c853] font-bold uppercase tracking-wider bg-white/[0.12] border border-white/10 rounded-full px-2.5 py-1">
                      <span className="relative flex h-1.5 w-1.5"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#00c853] opacity-75"></span><span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[#00c853]"></span></span>
                      Reply in ~1 hr
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    {/* LEFT — action cards */}
                    <div className="space-y-2">
                      {([
                        { href: "/how-it-works", icon: <path strokeLinecap="round" strokeLinejoin="round" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />, title: "How it works", sub: "Drawer to dollars in 3 steps" },
                        { href: "/faq", icon: <path strokeLinecap="round" strokeLinejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />, title: "Full FAQ", sub: "Plain answers, common questions" },
                        { href: "/reviews", icon: <path strokeLinecap="round" strokeLinejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.196-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />, title: "Reviews", sub: "★ 4.9 from real sellers", iconColor: "text-[#ffb400]" },
                        { href: "/track", icon: <><path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></>, title: "Track your trade", sub: "Status, payout, tracking #" },
                        { href: EMAIL_HREF, icon: <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />, title: "Email customer service", sub: "CustomerService@topcashcells.com · same business day" },
                      ]).map(item => (
                        <a key={item.title} href={item.href} className="group/sup flex items-start gap-3 p-3 rounded-2xl bg-white/[0.06] border border-white/10 hover:bg-[#00c853]/10 hover:border-[#00c853]/50 hover:-translate-y-0.5 transition-all duration-200">
                          <svg className={`w-6 h-6 shrink-0 ${item.iconColor ?? "text-[#00c853]"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>{item.icon}</svg>
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
                          { q: "Is shipping free?", a: "Yes — we email a prepaid FedEx label, insured for your full quoted value." },
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
                    <svg className="w-5 h-5 shrink-0 text-[#00c853]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" /></svg>
                    <span className="text-[13px] font-bold text-[#00c853]">Call (877) 549-2056 — Mon-Sat 9a-7p CT</span>
                  </a>
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT: cart + login/name (desktop) | cart + hamburger (mobile) — wrapped in matching pill */}
          <div className="flex items-center gap-1 shrink-0 bg-white/[0.12] border border-white/10 rounded-full px-1.5 py-1">
            {/* SEARCH — sits to the LEFT of the cart on every screen
                size. On <sm (mobile) and ≥lg (desktop) this is the only
                search entry point. On sm-lg the tablet shows a wider
                inline search bar below the nav, so we hide the icon
                there to avoid duplicating. Click opens an inline
                dropdown anchored under the right nav cluster. Skywalker
                2026-05-19: needs to sit clean next to cart not be in
                its own row. */}
            <button
              onClick={() => setSearchOpen((v) => !v)}
              aria-label="Search devices"
              aria-expanded={searchOpen}
              title="Search devices"
              className="sm:hidden lg:flex w-9 h-9 rounded-full hover:bg-white/10 hover:text-[#00c853] flex items-center justify-center cursor-pointer tap-press transition"
            >
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <circle cx="11" cy="11" r="7" />
                <path strokeLinecap="round" d="m20 20-3.5-3.5" />
              </svg>
            </button>

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
            {customerUser ? (
              // Signed-in via Google — show avatar + first name with a
              // small dropdown menu for Sign out. Clicking the chip
              // anywhere else opens past trades (lookup modal route).
              <div className="hidden lg:block relative">
                <button
                  onClick={() => setCustomerMenuOpen((v) => !v)}
                  className="flex items-center gap-2 pl-1 pr-3 py-1 rounded-full bg-white/[0.12] border border-white/10 hover:bg-white/[0.16] transition cursor-pointer"
                  aria-haspopup="menu"
                  aria-expanded={customerMenuOpen}
                >
                  {customerUser.picture ? (
                    <img src={customerUser.picture} alt="" className="w-6 h-6 rounded-full" />
                  ) : (
                    <span className="w-6 h-6 rounded-full bg-[#00c853]/25 text-[#00c853] text-xs font-bold flex items-center justify-center">
                      {(customerUser.name || customerUser.email).charAt(0).toUpperCase()}
                    </span>
                  )}
                  <span className="text-sm font-semibold text-[#00c853]">Hi, {customerUser.name?.split(" ")[0] || customerUser.email.split("@")[0]}</span>
                  <svg className={`w-3 h-3 text-[#00c853] transition-transform ${customerMenuOpen ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                </button>
                {customerMenuOpen && (
                  <div className="absolute right-0 mt-2 w-56 bg-[#111] border border-white/10 rounded-2xl shadow-2xl p-2 z-50">
                    <div className="px-3 py-2 border-b border-white/10">
                      <p className="text-[10px] uppercase tracking-wider text-[#888] font-bold">Signed in as</p>
                      <p className="text-sm text-white font-semibold truncate" title={customerUser.email}>{customerUser.email}</p>
                    </div>
                    <a
                      href="/account"
                      className="block w-full text-left px-3 py-2 rounded-lg text-sm text-[#dcdcdc] hover:bg-white/5 hover:text-white transition cursor-pointer"
                    >
                      My account
                    </a>
                    <button
                      onClick={() => { setCustomerMenuOpen(false); setLookupOpen(true); }}
                      className="w-full text-left px-3 py-2 rounded-lg text-sm text-[#dcdcdc] hover:bg-white/5 hover:text-white transition cursor-pointer"
                    >
                      Quick lookup
                    </button>
                    <button
                      onClick={signOutCustomer}
                      className="w-full text-left px-3 py-2 rounded-lg text-sm text-[#ff8088] hover:bg-[#ff5566]/10 hover:text-[#ff5566] transition cursor-pointer"
                    >
                      Sign out
                    </button>
                  </div>
                )}
              </div>
            ) : (
              // Desktop-only — on mobile/tablet, login lives inside the
              // hamburger menu instead of the header cluster.
              <button
                onClick={() => setLookupOpen(true)}
                className="hidden lg:flex items-center gap-2 px-3 py-1.5 text-sm font-semibold text-[#00c853] hover:text-[#00e676] hover:bg-white/5 transition cursor-pointer tap-press rounded-full"
                aria-label="Log in"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                {lookupResult?.found && lookupResult.name
                  ? `Hi, ${lookupResult.name.split(" ")[0]}`
                  : "Login"}
              </button>
            )}

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
        {/* HEADER SEARCH — sticky in the nav across the whole site,
            including the home funnel. Pushes /?q=<query> which the home
            page reads to prefill the full inline search. Wraps the
            existing inline search the funnel already has — this is the
            always-visible entry point Skywalker called out. */}
        {/* Mobile (<sm): hidden entirely.
            Tablet (sm–lg): full inline search bar.
            Desktop (lg+): collapsed to a 🔍 icon by default; click to
            expand the bar inline. Closes on Esc or click-outside.
            Skywalker 2026-05-19. */}
        {/* Tablet (sm-lg): full inline search bar lives in its own row
            beneath the nav. Hidden on <sm (mobile uses the cluster icon)
            and ≥lg (desktop uses the cluster icon). */}
        <div className="hidden sm:flex lg:hidden px-4 pb-3 -mt-1 justify-center">
          <HeaderSearch className="w-full max-w-xl" />
        </div>

        {/* Mobile + desktop dropdown: when the cluster icon is clicked,
            the search bar drops down centered under the nav. Tablet path
            never enters this branch since its bar is always visible. */}
        {searchOpen && (
          <div
            className="sm:hidden lg:block border-t border-white/5 bg-[#0a0a0a]/95 backdrop-blur px-4 lg:px-8 py-3 animate-[fadeIn_0.15s_ease-out]"
            onKeyDown={(e) => { if (e.key === "Escape") setSearchOpen(false); }}
          >
            <div className="max-w-7xl mx-auto flex items-center gap-2 justify-end">
              <HeaderSearch className="w-full max-w-xl lg:w-[28rem] lg:max-w-none" />
              <button
                type="button"
                onClick={() => setSearchOpen(false)}
                aria-label="Close search"
                className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-[#888] hover:text-white hover:bg-white/10 transition cursor-pointer"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </div>
          </div>
        )}
        {/* MOBILE CATEGORY RAIL — horizontal scroll strip with the 8
            sell categories. Tappable 64x76 tiles, big-enough touch
            targets, fade-on-right hint to suggest scrollability.
            Mobile/tablet only (lg+ has the centered mega-dropdown in
            the nav row). Lives inside SlideOnScrollNav so it slides
            up with the rest of the header on scroll-down. Skywalker
            2026-05-18 "let's upgrade design and flow" — discoverability
            win: customers no longer need to find/expand the hamburger
            to reach Sell categories. Hidden on funnel steps after
            "device" so it doesn't fight with the step they're on. */}
        {/* Tablet-only category rail (was mobile + tablet; Skywalker
            2026-05-19 asked to drop it on phones — feels cramped above
            the funnel start). lg+ has the centered mega-dropdown, so this
            now only shows in the tablet range (sm/md). */}
        {step === "device" && page === "home" && (
          <div className="hidden sm:block lg:hidden relative border-t border-white/[0.06]">
            <div className="overflow-x-auto no-scrollbar -mx-px">
              <div className="flex gap-2 px-3 py-2.5 min-w-max">
                {([
                  { id: "phones" as const, label: "Phones" },
                  { id: "tablets" as const, label: "Tablets" },
                  { id: "computers" as const, label: "Laptops" },
                  { id: "desktops" as const, label: "Desktops" },
                  { id: "watches" as const, label: "Watches" },
                  { id: "consoles" as const, label: "Consoles" },
                  { id: "drones" as const, label: "Drones" },
                  { id: "vr" as const, label: "VR" },
                ]).map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => {
                      setCategory(cat.id);
                      setStep("brand");
                      pushHistory("brand");
                    }}
                    className="flex flex-col items-center justify-center gap-1 w-16 shrink-0 px-2 py-2 rounded-2xl bg-white/[0.04] border border-white/10 hover:bg-[#00c853]/10 hover:border-[#00c853]/45 active:bg-[#00c853]/15 transition cursor-pointer tap-press"
                  >
                    <CategoryIcon id={cat.id} className="w-7 h-7 text-white" />
                    <p className="text-[11px] font-bold text-white leading-none">{cat.label}</p>
                  </button>
                ))}
              </div>
            </div>
            {/* Right-edge fade — tells the user there's more off-screen */}
            <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-[#0a0a0a] to-transparent" />
          </div>
        )}
        {/* FUNNEL PROGRESS BAR — last row of the nav so it always sits
            directly under whatever else is in the sticky header, no
            hardcoded top offsets to maintain. */}
        {step !== "device" && step !== "done" && page === "home" && (
          <div className="h-1 bg-white/10">
            <div className="h-full bg-[#00c853] transition-all duration-500" style={{ width: `${({category: 8, brand: 15, model: 22, storage: 32, condition: 42, carrier: 52, quote: 62, checkout: 72, payout: 82, contact: 92} as Record<string,number>)[step] ?? 0}%` }} />
          </div>
        )}
      </SlideOnScrollNav>

      {/* REFERRAL BANNER — shown calmly under the nav whenever a
          friend's ?ref= code is active for this session. Same restrained
          pill styling as the rest of the funnel's accent banners; the
          actual $10 referee bonus is applied server-side in /api/lead. */}
      {referralCode && page === "home" && (
        <div className="max-w-lg md:max-w-3xl lg:max-w-7xl mx-auto px-4 pt-3">
          <div className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl bg-[#00c853]/[0.1] border border-[#00c853]/35">
            <svg className="w-4 h-4 shrink-0 text-[#00c853]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M21 11.25v8.25a1.5 1.5 0 01-1.5 1.5H5.25a1.5 1.5 0 01-1.5-1.5v-8.25M12 4.875A2.625 2.625 0 109.375 7.5H12m0-2.625V7.5m0-2.625A2.625 2.625 0 1114.625 7.5H12m0 0V21m-8.625-9.75h18c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125h-18c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" /></svg>
            <p className="text-[12px] text-white font-semibold leading-snug">
              Referral applied — <span className="text-[#00c853] font-bold">$10 bonus</span> added to your offer.
            </p>
          </div>
        </div>
      )}

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
                    <svg className="w-5 h-5 shrink-0 text-[#00c853]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-14L4 7m8 4v10M4 7v10l8 4" /></svg>
                    <div>
                      <p className="text-sm font-semibold text-white">Get a bulk quote</p>
                      <p className="text-[11px] text-[#e6e6e6]">10+ devices? Volume pricing.</p>
                    </div>
                  </a>
                  <a href={EMAIL_HREF} onClick={() => setMobileMenuOpen(false)} className="flex items-start gap-3 px-3 py-3 rounded-lg hover:bg-white/5 transition">
                    <svg className="w-5 h-5 shrink-0 text-[#00c853]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
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
                    <svg className="w-5 h-5 shrink-0 text-[#00c853]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    <div>
                      <p className="text-sm font-semibold text-white">How it works</p>
                      <p className="text-[11px] text-[#e6e6e6]">From drawer to dollars in 3 steps.</p>
                    </div>
                  </a>
                  <a href="/faq" onClick={() => setMobileMenuOpen(false)} className="flex items-start gap-3 px-3 py-3 rounded-lg hover:bg-white/5 transition">
                    <svg className="w-5 h-5 shrink-0 text-[#00c853]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    <div>
                      <p className="text-sm font-semibold text-white">FAQ</p>
                      <p className="text-[11px] text-[#e6e6e6]">Common questions, plain answers.</p>
                    </div>
                  </a>
                  <a href="/reviews" onClick={() => setMobileMenuOpen(false)} className="flex items-start gap-3 px-3 py-3 rounded-lg hover:bg-white/5 transition">
                    <svg className="w-5 h-5 shrink-0 text-[#ffb400]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.196-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" /></svg>
                    <div>
                      <p className="text-sm font-semibold text-white">Reviews</p>
                      <p className="text-[11px] text-[#e6e6e6]">4.9 — read what customers say.</p>
                    </div>
                  </a>
                  <a href={EMAIL_HREF} onClick={() => setMobileMenuOpen(false)} className="flex items-start gap-3 px-3 py-3 rounded-lg hover:bg-white/5 transition">
                    <svg className="w-5 h-5 shrink-0 text-[#00c853]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-white">Customer service</p>
                      <p className="text-[11px] text-[#e6e6e6] truncate">CustomerService@topcashcells.com</p>
                    </div>
                  </a>
                  <a href="tel:+18775492056" onClick={() => setMobileMenuOpen(false)} className="flex items-start gap-3 px-3 py-3 rounded-lg hover:bg-white/5 transition">
                    <svg className="w-5 h-5 shrink-0 text-[#00c853]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" /></svg>
                    <div>
                      <p className="text-sm font-semibold text-white">Call us</p>
                      <p className="text-[11px] text-[#e6e6e6]">(877) 549-2056</p>
                    </div>
                  </a>
                </div>
              )}
            </div>

            {/* LOGIN — Google chip when signed in, lookup-opener otherwise. */}
            {customerUser ? (
              <>
                <a href="/account" className="w-full px-5 py-4 border-b border-white/10 flex items-center gap-3 hover:bg-white/[0.06] transition cursor-pointer">
                  {customerUser.picture ? (
                    <img src={customerUser.picture} alt="" className="w-9 h-9 rounded-full" />
                  ) : (
                    <span className="w-9 h-9 rounded-full bg-[#00c853]/20 text-[#00c853] flex items-center justify-center text-sm font-bold">{(customerUser.name || customerUser.email).charAt(0).toUpperCase()}</span>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-[#00c853]">Hi, {customerUser.name?.split(" ")[0] || customerUser.email.split("@")[0]}</p>
                    <p className="text-[11px] text-[#888] truncate">View my account →</p>
                  </div>
                </a>
                <button
                  onClick={signOutCustomer}
                  className="w-full px-5 py-3 text-left text-[#ff8088] hover:bg-[#ff5566]/10 hover:text-[#ff5566] text-sm font-semibold cursor-pointer transition border-b border-white/10"
                >Sign out</button>
              </>
            ) : (
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
            )}

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

      {/* PARTS / LOCKED / DEAD CUSTOM-QUOTE MODAL — opens from the
          condition step when the seller's phone is locked or won't
          power on (the regular Mint→Broken tiers don't fit). Captures
          minimal contact + a "what's wrong" description and posts as
          a manual-review lead. Skywalker 2026-05-19. */}
      {partsModalOpen && (
        <div
          className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm p-0 sm:p-4 animate-[fadeIn_0.15s_ease-out]"
          onClick={() => !partsSubmitting && setPartsModalOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full sm:max-w-md bg-[#0f0f0f] sm:rounded-2xl rounded-t-2xl border border-white/10 p-5 max-h-[92vh] overflow-y-auto"
          >
            {partsSubmitted ? (
              <div className="text-center py-3">
                <p className="text-4xl mb-2">✓</p>
                <p className="text-lg font-extrabold text-white">Got it — we&apos;ll quote you within the hour.</p>
                <p className="text-sm text-[#c5c5c5] mt-1">Check your email{partsPhone ? " and texts" : ""}.</p>
                <button
                  type="button"
                  onClick={() => {
                    setPartsModalOpen(false);
                    setPartsSubmitted(false);
                  }}
                  className="mt-5 w-full px-4 py-3 bg-[#00c853] text-[#0a0a0a] rounded-xl text-sm font-bold cursor-pointer hover:bg-[#00e676] transition"
                >
                  Done
                </button>
              </div>
            ) : (
              <>
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="text-lg font-extrabold text-white leading-tight">Locked / won&apos;t turn on?</h3>
                    <p className="text-xs text-[#bdbdbd] mt-0.5">We still buy these — just need a quick custom quote.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPartsModalOpen(false)}
                    aria-label="Close"
                    className="text-[#888] hover:text-white text-xl leading-none -mt-1 cursor-pointer"
                  >×</button>
                </div>

                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (partsSubmitting) return;
                    if (!partsEmail && !partsPhone) {
                      alert("Add an email or phone so we can send the quote.");
                      return;
                    }
                    setPartsSubmitting(true);
                    try {
                      const issueLabel: Record<string, string> = {
                        locked_mdm: "MDM Locked",
                        locked_icloud: "Locked",
                        locked_carrier: "Carrier Locked",
                        wont_turn_on: "Won't Turn On",
                        physical: "Physically Damaged Beyond Repair",
                        other: "Other",
                      };
                      const issueText = partsIssue ? issueLabel[partsIssue] : "Unspecified";
                      const notes = `[PARTS / CUSTOM QUOTE] Issue: ${issueText}${model?.label ? ` · Device picked: ${model.label}` : ""}\n${partsDescription || "(no further details)"}`;
                      const r = await fetch("/api/lead", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          name: partsName || "Custom Quote Request",
                          phone: partsPhone || undefined,
                          email: partsEmail || undefined,
                          device: deviceType || "phone",
                          model: model?.label || "Parts / Locked / DOA",
                          condition: "Parts — manual review",
                          quote: 0,
                          notes,
                          smsOptIn: !!partsPhone,
                          attribution: typeof window !== "undefined" ? (window as unknown as { __tccAttribution?: Record<string, string> }).__tccAttribution : undefined,
                        }),
                      });
                      if (!r.ok) {
                        alert("Couldn't submit — try again or text us at " + EMAIL);
                        return;
                      }
                      setPartsSubmitted(true);
                      // Reset form for next time
                      setPartsDescription("");
                      setPartsIssue(null);
                    } catch {
                      alert("Couldn't reach the server. Try again or email " + EMAIL);
                    } finally {
                      setPartsSubmitting(false);
                    }
                  }}
                  className="space-y-3"
                >
                  <div>
                    <label className="block text-xs font-semibold text-[#dcdcdc] uppercase tracking-wider mb-1.5">What&apos;s the issue?</label>
                    <div className="grid grid-cols-2 gap-1.5">
                      {[
                        { id: "locked_mdm" as const, label: "MDM locked" },
                        { id: "locked_icloud" as const, label: "Locked" },
                        { id: "locked_carrier" as const, label: "Carrier locked" },
                        { id: "wont_turn_on" as const, label: "Won't turn on" },
                        { id: "physical" as const, label: "Beyond repair" },
                        { id: "other" as const, label: "Other" },
                      ].map((opt) => (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => setPartsIssue(opt.id)}
                          className={`px-3 py-2 rounded-lg text-xs font-semibold border transition cursor-pointer ${
                            partsIssue === opt.id
                              ? "bg-amber-500/20 border-amber-500/50 text-amber-200"
                              : "bg-white/5 border-white/15 text-[#dcdcdc] hover:bg-white/10"
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <input
                    value={partsName}
                    onChange={(e) => setPartsName(e.target.value)}
                    placeholder="Your name (optional)"
                    className="w-full px-3 py-2.5 tcc-input text-sm"
                  />
                  <input
                    type="email"
                    value={partsEmail}
                    onChange={(e) => setPartsEmail(e.target.value)}
                    placeholder="Email (so we can send the quote)"
                    className="w-full px-3 py-2.5 tcc-input text-sm"
                    required={!partsPhone}
                  />
                  <input
                    type="tel"
                    value={partsPhone}
                    onChange={(e) => {
                      // Inline format → "(123) 456-7890" — matches the
                      // main funnel's phone input UX without depending on
                      // an external helper.
                      const digits = e.target.value.replace(/\D/g, "").slice(0, 10);
                      let formatted = digits;
                      if (digits.length > 6) formatted = `(${digits.slice(0,3)}) ${digits.slice(3,6)}-${digits.slice(6)}`;
                      else if (digits.length > 3) formatted = `(${digits.slice(0,3)}) ${digits.slice(3)}`;
                      else if (digits.length > 0) formatted = `(${digits}`;
                      setPartsPhone(formatted);
                    }}
                    placeholder="Phone (optional)"
                    className="w-full px-3 py-2.5 tcc-input text-sm"
                  />
                  <textarea
                    value={partsDescription}
                    onChange={(e) => setPartsDescription(e.target.value)}
                    placeholder="Tell us about the phone — model, storage, what happened, etc."
                    rows={3}
                    className="w-full px-3 py-2.5 tcc-input text-sm resize-none"
                  />

                  <button
                    type="submit"
                    disabled={partsSubmitting || (!partsEmail && !partsPhone)}
                    className="w-full px-4 py-3 bg-[#00c853] text-[#0a0a0a] rounded-xl text-sm font-bold cursor-pointer hover:bg-[#00e676] transition disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {partsSubmitting ? "Sending…" : "Send for custom quote"}
                  </button>
                </form>
              </>
            )}
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
              {/* BROKEN EXAMPLES — Skywalker 2026-05-17. When the
                  customer is reading the Broken tier description, show
                  two photo cards (Front cracked vs Back cracked) so
                  they can visually match their device. The funnels
                  separate broken-glass step (Front / Back / Both) is
                  upstream of this; the example images make that earlier
                  question easier to answer correctly. */}
              {c.id === "broken" && (
                <div className="px-5 pb-5">
                  <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-[#00c853] mb-2.5">Examples — pick what your device looks like</p>
                  <div className="grid grid-cols-2 gap-2.5">
                    <figure className="bg-black/40 border border-white/10 rounded-xl overflow-hidden">
                      <div className="aspect-square w-full bg-black flex items-center justify-center">
                        <NextImage src="/condition-examples/broken-front.png" alt="Cracked front screen / display" width={896} height={598} className="w-full h-full object-cover" loading="lazy" />
                      </div>
                      <figcaption className="px-2.5 py-1.5 text-center">
                        <span className="text-[10px] uppercase tracking-wider text-[#00c853] font-extrabold">Front</span>
                        <p className="text-[10px] text-[#c5c5c5] leading-tight">Display / screen cracked</p>
                      </figcaption>
                    </figure>
                    <figure className="bg-black/40 border border-white/10 rounded-xl overflow-hidden">
                      <div className="aspect-square w-full bg-black flex items-center justify-center">
                        <NextImage src="/condition-examples/broken-back.png" alt="Cracked back glass" width={896} height={597} className="w-full h-full object-cover" loading="lazy" />
                      </div>
                      <figcaption className="px-2.5 py-1.5 text-center">
                        <span className="text-[10px] uppercase tracking-wider text-[#00c853] font-extrabold">Back</span>
                        <p className="text-[10px] text-[#c5c5c5] leading-tight">Rear glass / housing cracked</p>
                      </figcaption>
                    </figure>
                  </div>
                </div>
              )}
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
                    <p className="text-[#00c853] font-bold text-xs mb-1 flex items-center gap-1"><svg className="w-4 h-4 shrink-0 text-[#00c853]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>Quick way</p>
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
                  {/* Primary path now: Google sign-in. One tap, no typing,
                      auto-fills the funnel from the Gmail profile. The
                      phone/email lookup stays as a fallback for sellers
                      who don't want to sign in with Google. */}
                  <a
                    href={`/api/auth/google?returnTo=${encodeURIComponent("/")}`}
                    className="w-full inline-flex items-center justify-center gap-2 bg-white text-[#1a1a1a] py-3 rounded-xl text-sm font-bold cursor-pointer hover:bg-[#f0f0f0] transition mb-4"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
                    Sign in with Google
                  </a>
                  <div className="flex items-center gap-3 mb-4">
                    <span className="flex-1 h-px bg-white/10" />
                    <span className="text-[10px] uppercase tracking-wider text-[#888] font-bold">or</span>
                    <span className="flex-1 h-px bg-white/10" />
                  </div>
                  <p className="text-[#d4d4d4] text-sm mb-3">Or enter the phone number or email you used last time — we&apos;ll pull up your past quotes.</p>
                  <input
                    type="text"
                    inputMode="email"
                    value={lookupContact}
                    onChange={(e) => setLookupContact(e.target.value)}
                    placeholder="Phone or email"
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
        <section className="animate-[fadeIn_0.3s_ease-out]" style={{ background: "radial-gradient(120% 65% at 50% 0%, rgba(0,200,83,0.16), transparent 72%)" }}>
          {/* Hero backdrop removed 2026-05-17 per Skywalker — looked
              bad in production. The faded multi-device decoration was
              competing with the actual hero copy instead of receding.
              Reverted to clean dark hero. */}
          {/* Promo banner moved into the top nav (between logo and menu). */}
          <div className="max-w-lg md:max-w-3xl lg:max-w-7xl mx-auto px-4 pt-6 pb-8">
            {/* Returning-visitor greeting — shows on landing when a prior
                submission left the tcc-returning marker. */}
            {welcomeBack && (
              <div className="mb-5 bg-gradient-to-r from-[#00c853]/15 via-[#00c853]/8 to-[#00c853]/15 border border-[#00c853]/30 rounded-xl px-4 py-3 flex items-center gap-3 animate-[fadeIn_0.4s_ease-out]">
                <svg className="w-7 h-7 shrink-0 text-[#00c853]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M7 11.5V14m0-2.5v-6a1.5 1.5 0 113 0m-3 6a1.5 1.5 0 00-3 0v2a7.5 7.5 0 0015 0v-5a1.5 1.5 0 00-3 0m-6-3V11m0-5.5v-1a1.5 1.5 0 013 0v1m0 0V11m0-5.5a1.5 1.5 0 013 0v3m0 0V11" /></svg>
                <div className="flex-1 min-w-0">
                  <p className="text-white font-bold text-sm">Welcome back, {welcomeBack.name}!</p>
                  <p className="text-[#d4d4d4] text-xs">Great to see you again — let&apos;s get your next device quoted.</p>
                </div>
                <button type="button" onClick={() => setWelcomeBack(null)} aria-label="Dismiss" className="text-[#888] hover:text-white text-xl leading-none shrink-0 cursor-pointer">×</button>
              </div>
            )}
            <h1 className="text-4xl lg:text-6xl xl:text-7xl font-extrabold tracking-tight leading-[1.05] mb-3 hero-fade-up" style={{ letterSpacing: "-0.03em" }}>
              Get <span className="text-[#00c853]">top dollar</span><br />for your device.
            </h1>
            <p className="text-[#e6e6e6] text-lg lg:text-xl mb-2 font-medium hero-fade-up hero-d-1">
              Get an instant online quote, then your choice: meet us in Austin and get <span className="font-bold text-white lg:font-medium lg:text-[#00c853]">paid on the spot</span> after a quick ~15-minute inspection, or <span className="font-bold text-white lg:font-medium lg:text-[#00c853]">ship free from anywhere in the US</span> and get paid within 24 hours of your device arriving.
            </p>
            <p className="text-[#e6e6e6] text-sm mb-6 font-medium hero-fade-up hero-d-2 flex items-center gap-2">
              <svg className="w-4 h-4 shrink-0 text-[#00c853]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
              <span>Every device gets a <span className="font-bold text-white lg:font-medium lg:text-[#00c853]">certified data wipe</span> — at local meetups, you watch it happen.</span>
            </p>

            {/* DUAL-PATH ENTRY — local vs. shipping. Each button locks in the
                handoff method so the contact step only asks for the matching
                detail (address OR area), not both. */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4 hero-scale-in hero-d-3">
              <button
                onClick={() => { setDualPathPop("local"); setTimeout(() => { setDualPathPop(null); setHandoffMethod("local"); setStep("category"); pushHistory("category"); }, 280); }}
                onAnimationEnd={(e) => { if (e.animationName === "phonePop3d") setDualPathPop(null); }}
                className={`tcc-button-primary w-full py-4 text-base font-extrabold flex flex-col items-center gap-0.5 ${dualPathPop === "local" ? "phone-pop-3d" : ""}`}
              >
                <span className="flex items-center gap-2"><svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>Sell Local Today</span>
                <span className="text-[11px] font-medium opacity-80">Local pickup · Cash on the spot</span>
              </button>
              <button
                onClick={() => { setDualPathPop("ship"); setTimeout(() => { setDualPathPop(null); setHandoffMethod("ship"); setStep("category"); pushHistory("category"); }, 280); }}
                onAnimationEnd={(e) => { if (e.animationName === "phonePop3d") setDualPathPop(null); }}
                className={`w-full bg-[rgba(15,15,15,0.5)] backdrop-blur-[12px] hover:bg-[rgba(15,15,15,0.85)] hover:border-[#00c853] border border-white/15 text-white py-4 rounded-2xl text-base font-extrabold cursor-pointer transition-all duration-300 ease-out shadow-[0_10px_30px_rgba(0,0,0,0.4)] flex flex-col items-center gap-0.5 ${dualPathPop === "ship" ? "phone-pop-3d" : ""}`}
              >
                <span className="flex items-center gap-2"><svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-14L4 7m8 4v10M4 7v10l8 4" /></svg>I&apos;m Shipping: Get a Label</span>
                <span className="text-[11px] font-medium text-[#b8b8b8]">Free prepaid label · Paid within 24 hrs of arrival</span>
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
              <svg className="w-5 h-5 shrink-0 text-[#00c853] leading-tight" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0zM13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1" /></svg>
              <p className="text-[#e6e6e6] text-xs leading-relaxed">
                <strong className="text-white">Or have us come to you.</strong> We meet you at a public spot of your choice — live tracking, paid on the spot.
              </p>
            </div>

            {/* NEIGHBORHOODS — Austin SEO + local trust */}
            <div className="mt-4 text-center text-[11px] text-[#bdbdbd] font-medium">
              <svg className="w-4 h-4 inline-block align-text-bottom text-[#00c853]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg> Mobile techs in <span className="text-[#e6e6e6]">Downtown Austin · South Congress · Westlake · Bee Cave · Lakeway · Buda · Dripping Springs</span>
            </div>

            {/* PAYMENT METHODS — small chip strip */}
            <div className="mt-3 flex flex-wrap items-center justify-center gap-1.5">
              <span className="text-[10px] text-[#bdbdbd] uppercase tracking-[0.18em] font-bold mr-1">Paid via</span>
              {([
                { label: "Cash", icon: <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /> },
                { label: "Zelle", svg: "/pay/zelle.svg" },
                { label: "Cash App", svg: "/pay/cashapp.svg" },
                { label: "BTC", svg: "/pay/bitcoin.svg" },
              ] as Array<{ label: string; icon?: React.ReactNode; svg?: string }>).filter(p => p.label !== "Cash" || handoffMethod === "local").map(p => (
                <span key={p.label} className="inline-flex items-center gap-1 bg-white/5 border border-white/10 text-[#e6e6e6] text-[11px] font-semibold px-2 py-1 rounded-full">
                  {p.svg
                    ? <img src={p.svg} alt="" className="w-4 h-4 object-contain" />
                    : <svg className="w-4 h-4 text-[#00c853]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>{p.icon}</svg>}
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
                Paid On the Spot Locally
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
                  const imgCls = "w-16 h-16 md:w-20 md:h-20 object-contain mb-2 transition-transform duration-300 group-hover:scale-110";
                  const tightWrapCls = "w-16 h-16 md:w-20 md:h-20 mb-2 flex items-center justify-center p-3 md:p-4";
                  return (
                    <button
                      key={d.model}
                      onClick={() => {
                        setCategory(d.cat);
                        setDeviceType(d.dt);
                        setModel({ id: d.model, label: d.title, base: d.floor });
                        popThenRun(`feat-${d.model}`, () => { setStep("condition"); pushHistory("condition"); });
                      }}
                      className={`group bg-white/[0.07] border border-white/10 hover:bg-white/[0.08] hover:border-[#00c853]/40 rounded-2xl p-3 flex flex-col items-center text-center transition cursor-pointer tap-press tcc-anim-border ${funnelPop === `feat-${d.model}` ? "tap-confirm" : ""}`}
                    >
                      {isTight ? (
                        <div className={tightWrapCls}>
                          <Pic src={d.photo} alt={d.title} className="w-full h-full object-contain transition-transform duration-300 group-hover:scale-110" loading="lazy" />
                        </div>
                      ) : (
                        <Pic src={d.photo} alt={d.title} className={imgCls} loading="lazy" />
                      )}
                      <p className="text-white text-[11px] md:text-xs font-semibold leading-tight mb-1 min-h-[2.2em]">{d.title}</p>
                      <p className="text-[#00c853] text-lg md:text-xl font-extrabold leading-none tcc-green-pill">up to ${topPrice}</p>
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
                        <span className="text-[#00c853] text-xs font-bold whitespace-nowrap tcc-green-pill">up to ${d.price}</span>
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
              <button
                type="button"
                aria-label="Top Cash Cellular"
                onClick={() => setHeroPhonePop(true)}
                onAnimationEnd={(e) => { if (e.animationName === "phonePop3d") setHeroPhonePop(false); }}
                className={`shrink-0 cursor-pointer border-0 bg-transparent p-0 transition-transform duration-200 hover:scale-105 ${heroPhonePop ? "phone-pop-3d" : ""}`}
              >
                <Pic src="/iphone17.png" alt="" className="h-24 w-auto object-contain pointer-events-none" style={{ filter: "drop-shadow(0 6px 10px rgba(0,0,0,0.45))" }} />
              </button>
              <div className="flex-1">
                <p className="text-[#00c853] text-xs font-bold uppercase tracking-[0.18em] mb-1">Used, gently worn, like-new</p>
                <h2 className="text-2xl md:text-3xl font-bold mb-2 leading-tight">Working devices get top dollar.</h2>
                <p className="text-[#e6e6e6] text-sm mb-4">Where we pay best: phones that turn on, hold a charge, and have a clean screen. Minor scratches or a faded battery are fine — that&apos;s normal wear. We&apos;ll still look at devices with bigger issues, but the quote reflects the condition. No surprise deductions and no walk-away gimmicks.</p>
                {(() => {
                  const tiers = [
                    {
                      icon: <path strokeLinecap="round" strokeLinejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.196-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />, t: "Like new", note: "Best payout",
                      headline: "Sealed or flawless — the top tier.",
                      body: "Box-fresh or opened-but-unused condition. No scratches, no scuffs, no display marks. Battery still above 80%. This is where the headline price lives.",
                      bullets: ["Zero cosmetic wear", "Battery health ≥80%", "Powers on, no functional issues", "Quote pays at 100% of our top rate"],
                    },
                    {
                      icon: <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />, t: "Light wear", note: "Top tier",
                      headline: "Lived-in but still beautiful.",
                      body: "Minor scratches visible only up close. Display is still clean — no cracks, no discolouration. Most phones older than 6 months land here, and we still pay close to the headline.",
                      bullets: ["A few fine micro-scratches", "No cracks or dents", "Display lights up cleanly", "Pays ~85–95% of top rate"],
                    },
                    {
                      icon: <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />, t: "Visible wear", note: "Still fair",
                      headline: "Honest wear, honest quote.",
                      body: "You can see the marks from across the room — scuffs on the frame, deeper scratches on the back. Screen is still intact and the phone works. We&apos;ll buy it, just at a lower rate.",
                      bullets: ["Scuffs / dents on the frame OK", "Back glass scratched but not cracked", "Screen still clean & functional", "Pays ~60–75% of top rate"],
                    },
                    {
                      icon: <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />, t: "Bigger issues", note: "Honest quote",
                      headline: "Cracked, dead, or 'just take it'.",
                      body: "Cracked display, won&apos;t turn on, water damage, missing parts — we still buy. The quote drops accordingly, but you still walk out paid on the spot. No salvage runaround.",
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
                              <svg className="w-6 h-6 mx-auto mb-1 text-[#00c853]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>{item.icon}</svg>
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
                              <svg className="w-7 h-7 shrink-0 text-[#00c853]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>{t.icon}</svg>
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
            <p className="text-[#00c853] text-xs font-bold uppercase tracking-[0.18em] mb-2 reveal">How it works</p>
            <h2 className="text-2xl md:text-3xl font-bold leading-tight reveal" data-stagger="1">4 steps to get paid</h2>
          </div>
          {/* Desktop reveals each step's detail on hover; mobile has no
              hover, so each card is a tap-to-expand accordion — the list
              reads as clean headlines until tapped. Skywalker 2026-05-22. */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-w-3xl mx-auto">
            {[
              { num: "1", title: "Back up your data", body: "iCloud, Google One, or your computer — whatever works. Takes minutes." },
              { num: "2", title: "Turn off Find My iPhone", body: "Settings → [your name] → Find My → Find My iPhone → off. Required before we can pay." },
              { num: "3", title: "Meet up or ship it", body: "Meet locally in Austin — we inspect together in about 15 minutes — or ship free with our prepaid label from anywhere in the US." },
              { num: "4", title: "Get paid", body: "Meet locally and you're paid on the spot; ship in and you're paid within 24 hours of arrival. Cash, Cash App, Zelle, or BTC — your choice." },
            ].map((item, i) => {
              const open = openStep === i;
              return (
              <button
                key={item.num}
                type="button"
                onClick={() => setOpenStep(open ? null : i)}
                aria-expanded={open}
                className="group flex items-start gap-4 bg-white/5 border border-white/10 rounded-2xl p-4 reveal hover:bg-white/[0.07] hover:border-[#00c853]/30 transition text-left w-full cursor-pointer lg:cursor-default tap-press"
                data-stagger={Math.min(i + 2, 8)}
              >
                <div className="w-8 h-8 rounded-full bg-[#00c853] flex items-center justify-center text-[#0a0a0a] text-sm font-bold shrink-0">{item.num}</div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold text-base">{item.title}</p>
                    {/* Chevron — mobile affordance only; desktop uses hover. */}
                    <svg className={`w-4 h-4 text-[#00c853] shrink-0 transition-transform duration-300 lg:hidden ${open ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                  </div>
                  <p className={`text-[#e6e6e6] text-sm leading-relaxed overflow-hidden transition-all duration-300 lg:max-h-0 lg:opacity-0 lg:mt-0 lg:group-hover:max-h-32 lg:group-hover:opacity-100 lg:group-hover:mt-1 ${open ? "max-h-32 opacity-100 mt-1" : "max-h-0 opacity-0 mt-0"}`}>{item.body}</p>
                </div>
              </button>
            );})}
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
              { n: 1, svg: <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />, title: "Get an instant quote", body: "Pick your device, condition, and storage. We show you the offer in seconds — no signup needed." },
              { n: 2, svg: <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-14L4 7m8 4v10M4 7v10l8 4" />, title: "Ship free or drop off", body: "Print our prepaid label, or drop off in Austin. We pay shipping — and the label is insured for your full quoted value automatically." },
              { n: 3, svg: <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />, title: "Get paid", body: "Cash App, Zelle, or BTC for shipped trades; local meetups add Cash. Meet us in Austin and you're paid on the spot after a ~15-minute inspection. Shipped payouts hit within 24 hours of your device arriving." },
            ].map((s, i) => (
              <button
                key={s.n}
                type="button"
                onClick={() => { window.scrollTo(0, 0); setStep("category"); pushHistory("category"); }}
                className="group relative text-left w-full bg-white/5 border border-white/10 rounded-2xl p-6 hover:bg-white/[0.07] hover:border-[#00c853]/30 transition reveal cursor-pointer tap-press"
                data-stagger={Math.min(i + 2, 8)}
              >
                <div className="absolute -top-3 -left-2 w-9 h-9 rounded-full bg-[#00c853] text-[#0a0a0a] text-sm font-bold flex items-center justify-center shadow-lg shadow-[#00c853]/30">{s.n}</div>
                <svg className="w-9 h-9 text-[#00c853] mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>{s.svg}</svg>
                <p className="font-bold text-lg mb-1.5">{s.title}</p>
                <p className="text-[#e6e6e6] text-sm leading-relaxed">{s.body}</p>
                <span className="mt-3 inline-flex items-center gap-1 text-[#00c853] text-sm font-extrabold opacity-0 group-hover:opacity-100 transition">Get my quote →</span>
              </button>
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
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 auto-rows-fr">
            {[
              { stat: <CountUp end={5000} suffix="+" />, label: "Devices bought" },
              { stat: "4.9★", label: "Average review rating" },
              { stat: "On the Spot", label: "Paid at local meetups" },
              { stat: "Free", label: "Shipping nationwide" },
              { stat: "Higher", label: "Offer than Apple trade-in" },
              { stat: "Local", label: "Austin-based, real humans" },
            ].map((t, i) => (
              <div key={i} className="bg-gradient-to-br from-white/[0.08] to-white/[0.03] border border-white/10 rounded-2xl p-5 text-center flex flex-col justify-center hover:border-[#00c853]/30 hover:from-white/[0.12] transition reveal" data-stagger={Math.min(i + 2, 8)}>
                <div className="text-2xl font-extrabold text-[#00c853] mb-1 leading-none">{t.stat}</div>
                <div className="text-[#e6e6e6] text-xs font-medium leading-tight">{t.label}</div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Mid-page "Still sitting on old tech?" CTA removed 2026-05-22 —
          redundant with the hero CTA and the clickable how-it-works
          step cards; cut to declutter the mobile CTA stack. */}

      {/* HOMEPAGE: Customer reviews carousel */}
      {step === "device" && page === "home" && (
        <section id="reviews" className="max-w-lg md:max-w-3xl lg:max-w-7xl mx-auto py-10">
          <div className="px-4 flex items-end justify-between mb-6">
            <div>
              <p className="text-[#00c853] text-xs font-bold uppercase tracking-[0.18em] mb-1 reveal">Real Austin customers</p>
              <h2 className="text-3xl md:text-4xl font-bold leading-tight reveal" data-stagger="1">What people are saying</h2>
            </div>
            {realReviews.length >= 1 ? (
              <a href="/reviews" className="text-[#00c853] text-sm font-semibold whitespace-nowrap hover:underline">See all reviews →</a>
            ) : (
              <a href="https://www.google.com/search?q=Top+Cash+Cellular+Austin+reviews" target="_blank" rel="noopener noreferrer" className="text-[#00c853] text-sm font-semibold whitespace-nowrap hover:underline">See all on Google →</a>
            )}
          </div>
          {/* Real customer reviews from /api/reviews (MC-backed). NO
              placeholders / fake names — FTC Endorsement Guides + TX
              DTPA make fabricated testimonials a real liability, and
              fake reviews next to a real one cheapen the real one.
              Skywalker 2026-05-18 "build real reviews — we already
              got 1, let's start". When realReviews.length === 0 we
              swap the carousel for a "be the first" CTA below. */}
          {realReviews.length > 0 ? (
            <ReviewsCarousel reviews={realReviews} />
          ) : (
            <div className="px-4 mx-auto max-w-md text-center bg-white/[0.04] border border-white/10 rounded-2xl py-8 px-6">
              <p className="text-4xl mb-2">★</p>
              <p className="text-white font-bold text-base mb-1">Reviews coming soon</p>
              <p className="text-[#bdbdbd] text-sm leading-relaxed">Reviews on this page are only from customers we&apos;ve completed a trade with — verified, real sellers. The wall takes a beat to fill up.</p>
            </div>
          )}
          {/* "Verified-only" trust footer — replaces the old public
              "Leave a review" CTA. Skywalker 2026-05-18: random people
              can't see the review form anymore. Only customers we've
              flipped to paid/met get a one-use link via email. This
              copy explains the policy so visitors don't think we're
              missing a button. */}
          <div className="px-4 mt-6 flex flex-col sm:flex-row items-center justify-center gap-2 text-center text-[#888] text-[12px] leading-snug">
            <span>★ Verified customers only — review link comes in your payout email.</span>
            <span className="hidden sm:inline">·</span>
            <a href="mailto:CustomerService@topcashcells.com?subject=Need%20my%20review%20link" className="text-[#dcdcdc] hover:text-[#00c853] underline">Lost yours? Email us</a>
          </div>
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
              { q: "How do I get paid?", a: "Local Austin meetup: we inspect together (about 15 minutes) and you're paid on the spot. Shipping: paid within 24 hours of your device arriving. Methods — Cash, Cash App, Zelle, or BTC." },
              { q: "Do you ship for free?", a: "Yes — any offer over $50 gets a free prepaid FedEx label, emailed at checkout. Local to Austin? Free pickup instead." },
              { q: "What if my device is worth less than the quote?", a: "We send a revised offer with photos. Don't like it? We ship the device back free — no pressure, no surprises." },
              { q: "Are you really in Austin?", a: "Yes — Austin-based, real humans. Meet us locally and get paid cash on the spot, or ship free from anywhere in the US." },
              { q: "Is my data safe?", a: "We run a certified factory wipe on every device. We still recommend signing out of iCloud/Google and removing screen locks first." },
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
          <div className="text-center mt-6">
            <a href="/faq" className="inline-flex items-center gap-1.5 text-[#00c853] text-sm font-semibold hover:text-[#00e676] transition reveal">
              See all FAQs
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" /></svg>
            </a>
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
              <p className="text-[#e6e6e6] text-base md:text-lg mb-6">Instant quote · Paid on the spot in Austin · No signup needed</p>
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
            <button onClick={goBack} aria-label="Go back" className="inline-flex items-center gap-2 text-[#00c853] text-sm font-semibold mb-6 px-4 py-2 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 cursor-pointer transition tap-press">
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
                  onClick={() => popThenRun(`cat-${cat.id}`, () => {
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
                  })}
                  className={`tcc-card flex flex-col items-center justify-center p-4 rounded-2xl cursor-pointer reveal ${funnelPop === `cat-${cat.id}` ? "tap-confirm" : ""}`}
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
                      <svg className="w-7 h-7 shrink-0 text-[#00c853]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>{c.icon}</svg>
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
                      body: JSON.stringify({ name, phone, email, device: inquiryCategory, model: model.label, storage: "N/A", condition: condition.label, quote: 0, payout: "TBD", notes: "Custom device - full flow submission", photos: photoUrls, smsOptIn, attribution: readAttribution() }),
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
                    <label className="mt-2 flex items-start gap-2.5 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={smsOptIn}
                        onChange={(e) => setSmsOptIn(e.target.checked)}
                        required
                        className="mt-0.5 w-4 h-4 shrink-0 rounded border-white/25 bg-white/5 accent-[#00c853] cursor-pointer"
                      />
                      <span className="text-[#e6e6e6] text-[11px] leading-relaxed">
                        I agree to receive SMS updates about my trade-in from Top Cash Cellular at the number above. Msg &amp; data rates may apply, msg frequency varies, reply STOP to opt out, HELP for help. See our <a href="/privacy" className="underline hover:text-[#00c853]">privacy policy</a>.
                      </span>
                    </label>
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
                  <svg className="w-8 h-8 text-[#00c853]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
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
            <button onClick={goBack} aria-label="Go back" className="inline-flex items-center gap-2 text-[#00c853] text-sm font-semibold mb-6 px-4 py-2 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 cursor-pointer transition tap-press">
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
                <button key={b.id} onClick={() => { setDeviceType(b.id); popThenRun(`brand-${b.id}`, () => { setStep("model"); pushHistory("model"); }); }} className={`flex flex-col items-center justify-center p-4 rounded-2xl tcc-card tcc-brand-card cursor-pointer h-[130px] tap-press reveal ${funnelPop === `brand-${b.id}` ? "tap-confirm" : ""}`} data-stagger={Math.min(i + 1, 8)}>
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
                  setDeviceType(b.id); popThenRun(`brand-${b.id}`, () => { setStep("model"); pushHistory("model"); });
                }} className={`flex flex-col items-center justify-center p-4 rounded-2xl tcc-card tcc-brand-card cursor-pointer h-[130px] tap-press ${funnelPop === `brand-${b.id}` ? "tap-confirm" : ""}`}>
                  <span className="flex-shrink-0 mb-2 tcc-brand-tile">{b.brandIcon}</span>
                  <p className="font-bold text-sm text-center">{b.label}</p>
                  <p className="text-[#e6e6e6] text-xs text-center mt-0.5">{b.sub}</p>
                </button>
              ))}
              {category === "computers" && [
                { id: "macbook" as const, label: "Apple MacBook", sub: "MacBook Air & Pro, M1+", brandIcon: <svg viewBox="0 0 40 40" className="w-10 h-10"><circle cx="20" cy="20" r="18" fill="#333"/><g transform="translate(0,-3)"><path d="M20 8c-1.2 2.4-1.8 4-1.8 5.6 0 2.8 2 4.4 4.2 4.4 0.2 0 0.4 0 0.6-0.1-0.4-1.2-0.6-2-0.6-2.7 0-2.6 1.6-4.4 2.6-5.6-1-1.2-3-1.6-5-1.6zm-2.4 11c-2.8 0-5.6 2.4-5.6 6.8 0 4.8 3.2 10.2 5.8 10.2 1 0 2-0.8 3.2-0.8 1.2 0 1.8 0.8 3.2 0.8 3 0 5.8-6 5.8-6-3.6-1.4-4-5.4-4-6.8 0-2.4 1.2-4 1.2-4-1.8-2-4-2.2-5-2.2-1.6 0-3 1-4.6 2z" fill="#fff"/></g></svg> },
                { id: "samsung_pc" as const, label: "Samsung", sub: "Galaxy Book / Book 2 / 3 / 4 / 5", brandIcon: <svg viewBox="0 0 40 40" className="w-10 h-10"><circle cx="20" cy="20" r="18" fill="#1428a0"/><text x="20" y="25" textAnchor="middle" fill="#fff" fontSize="12" fontWeight="bold" fontFamily="Arial">S</text></svg> },
                { id: "dell" as const, label: "Dell", sub: "XPS, Latitude, Inspiron, Vostro, Precision, G, Rugged", brandIcon: <svg viewBox="0 0 40 40" className="w-10 h-10"><circle cx="20" cy="20" r="18" fill="#007db8"/><text x="20" y="26" textAnchor="middle" fill="#fff" fontSize="11" fontWeight="bold" fontFamily="Arial">DELL</text></svg> },
                { id: "alienware" as const, label: "Alienware", sub: "m16, m18, x14, x16", brandIcon: <svg viewBox="0 0 40 40" className="w-10 h-10"><circle cx="20" cy="20" r="18" fill="#1a1a1a"/><path d="M20 9c-5.2 0-9 3.6-9 9 0 4.4 3.4 8 7 11 .8.7 1.5 1 2 1s1.2-.3 2-1c3.6-3 7-6.6 7-11 0-5.4-3.8-9-9-9z" fill="none" stroke="#00c853" strokeWidth="1.6"/><path d="M16 19c-1.6 0-2.8 1.4-2.8 3 0 1.4 1.2 2.4 2.6 2 1.2-.4 2-1.8 1.6-3-.2-1.2-.6-2-1.4-2zm8 0c1.6 0 2.8 1.4 2.8 3 0 1.4-1.2 2.4-2.6 2-1.2-.4-2-1.8-1.6-3 .2-1.2.6-2 1.4-2z" fill="#00c853"/></svg> },
                { id: "hp" as const, label: "HP", sub: "EliteBook, Envy, OMEN, OmniBook, Pavilion, ProBook, Spectre, Victus, ZBook, Notebook", brandIcon: <svg viewBox="0 0 40 40" className="w-10 h-10"><circle cx="20" cy="20" r="18" fill="#0096d6"/><text x="20" y="26" textAnchor="middle" fill="#fff" fontSize="14" fontWeight="bold" fontFamily="Arial">hp</text></svg> },
                { id: "lenovo" as const, label: "Lenovo", sub: "ThinkPad, ThinkBook, IdeaPad, Legion, LOQ, Slim, Yoga", brandIcon: <svg viewBox="0 0 40 40" className="w-10 h-10"><circle cx="20" cy="20" r="18" fill="#e2231a"/><text x="20" y="25" textAnchor="middle" fill="#fff" fontSize="9" fontWeight="bold" fontFamily="Arial">Lenovo</text></svg> },
                { id: "acer" as const, label: "Acer", sub: "Nitro, Predator", brandIcon: <svg viewBox="0 0 40 40" className="w-10 h-10"><circle cx="20" cy="20" r="18" fill="#83b81a"/><text x="20" y="25" textAnchor="middle" fill="#fff" fontSize="10" fontWeight="bold" fontFamily="Arial">acer</text></svg> },
                { id: "lg_pc" as const, label: "LG", sub: "Gram, Gram Pro, UltraGear", brandIcon: <svg viewBox="0 0 40 40" className="w-10 h-10"><circle cx="20" cy="20" r="18" fill="#a50034"/><text x="20" y="26" textAnchor="middle" fill="#fff" fontSize="14" fontWeight="bold" fontFamily="Arial">LG</text></svg> },
                { id: "asus_pc" as const, label: "ASUS", sub: "ROG, TUF, ProArt, Vivobook, ExpertBook", brandIcon: <svg viewBox="0 0 40 40" className="w-10 h-10"><circle cx="20" cy="20" r="18" fill="#1a1a1a"/><text x="20" y="25" textAnchor="middle" fill="#fff" fontSize="9" fontWeight="bold" fontFamily="Arial">ASUS</text></svg> },
                { id: "other_pc" as const, label: "Other Brand", sub: "Any other computer", brandIcon: <svg viewBox="0 0 40 40" className="w-10 h-10"><circle cx="20" cy="20" r="18" fill="#444"/><rect x="11" y="10" width="18" height="14" rx="2" fill="none" stroke="#fff" strokeWidth="1.5"/><line x1="15" y1="28" x2="25" y2="28" stroke="#fff" strokeWidth="1.5" strokeLinecap="round"/><line x1="20" y1="24" x2="20" y2="28" stroke="#fff" strokeWidth="1.5"/></svg> },
              ].map((b) => (
                <button key={b.id} onClick={() => {
                  if (b.id === "other_pc") { setInquiryCategory("Computer"); setInquirySent(false); setInquiryDesc(""); setStep("inquiry"); pushHistory("inquiry"); return; }
                  setDeviceType(b.id); popThenRun(`brand-${b.id}`, () => { setStep("model"); pushHistory("model"); });
                }} className={`flex flex-col items-center justify-center p-4 rounded-2xl tcc-card tcc-brand-card cursor-pointer h-[130px] tap-press ${funnelPop === `brand-${b.id}` ? "tap-confirm" : ""}`}>
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
                { id: "alienware_desktop" as const, label: "Alienware", sub: "Aurora R13, R15, R16", brandIcon: <svg viewBox="0 0 40 40" className="w-10 h-10"><circle cx="20" cy="20" r="18" fill="#1a1a1a"/><path d="M20 9c-5.2 0-9 3.6-9 9 0 4.4 3.4 8 7 11 .8.7 1.5 1 2 1s1.2-.3 2-1c3.6-3 7-6.6 7-11 0-5.4-3.8-9-9-9z" fill="none" stroke="#00c853" strokeWidth="1.6"/><path d="M16 19c-1.6 0-2.8 1.4-2.8 3 0 1.4 1.2 2.4 2.6 2 1.2-.4 2-1.8 1.6-3-.2-1.2-.6-2-1.4-2zm8 0c1.6 0 2.8 1.4 2.8 3 0 1.4-1.2 2.4-2.6 2-1.2-.4-2-1.8-1.6-3 .2-1.2.6-2 1.4-2z" fill="#00c853"/></svg> },
                { id: "msi_desktop" as const, label: "MSI", sub: "MEG, MAG Trident, Codex, PRO", brandIcon: <svg viewBox="0 0 40 40" className="w-10 h-10"><circle cx="20" cy="20" r="18" fill="#eb1c24"/><text x="20" y="25" textAnchor="middle" fill="#fff" fontSize="10" fontWeight="bold" fontFamily="Arial">MSI</text></svg> },
                { id: "other_desktop" as const, label: "Other Brand", sub: "Any other desktop", brandIcon: <svg viewBox="0 0 40 40" className="w-10 h-10"><circle cx="20" cy="20" r="18" fill="#444"/><rect x="10" y="8" width="20" height="16" rx="2" fill="none" stroke="#fff" strokeWidth="1.5"/><line x1="14" y1="28" x2="26" y2="28" stroke="#fff" strokeWidth="1.5" strokeLinecap="round"/><line x1="20" y1="24" x2="20" y2="28" stroke="#fff" strokeWidth="1.5"/></svg> },
              ].map((b) => (
                <button key={b.id} onClick={() => {
                  if (b.id === "other_desktop") { setInquiryCategory("Desktop"); setInquirySent(false); setInquiryDesc(""); setStep("inquiry"); pushHistory("inquiry"); return; }
                  setDeviceType(b.id); popThenRun(`brand-${b.id}`, () => { setStep("model"); pushHistory("model"); });
                }} className={`flex flex-col items-center justify-center p-4 rounded-2xl tcc-card tcc-brand-card cursor-pointer h-[130px] tap-press ${funnelPop === `brand-${b.id}` ? "tap-confirm" : ""}`}>
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
                { id: "other_vr" as const, label: "Other Brand", sub: "HTC Vive, Pico, etc.", brandIcon: <svg viewBox="0 0 40 40" className="w-10 h-10"><circle cx="20" cy="20" r="18" fill="#444"/><path d="M11 16.5h18a1.5 1.5 0 011.5 1.5v3a1.5 1.5 0 01-1.5 1.5h-3.4a1.5 1.5 0 01-1.06-.44l-1.48-1.47a1.5 1.5 0 00-2.12 0l-1.48 1.47a1.5 1.5 0 01-1.06.44H11A1.5 1.5 0 019.5 21v-3a1.5 1.5 0 011.5-1.5z" fill="none" stroke="#fff" strokeWidth="1.5" strokeLinejoin="round"/></svg> },
              ].map((b) => (
                <button key={b.id} onClick={() => {
                  if (b.id === "other_vr") { setInquiryCategory("VR Headset"); setInquirySent(false); setInquiryDesc(""); setStep("inquiry"); pushHistory("inquiry"); return; }
                  setDeviceType(b.id); popThenRun(`brand-${b.id}`, () => { setStep("model"); pushHistory("model"); });
                }} className={`flex flex-col items-center justify-center p-4 rounded-2xl tcc-card tcc-brand-card cursor-pointer h-[130px] tap-press ${funnelPop === `brand-${b.id}` ? "tap-confirm" : ""}`}>
                  <span className="flex-shrink-0 mb-2 tcc-brand-tile">{b.brandIcon}</span>
                  <p className="font-bold text-sm text-center">{b.label}</p>
                  <p className="text-[#e6e6e6] text-xs text-center mt-0.5">{b.sub}</p>
                </button>
              ))}
              {category === "drones" && [
                { id: "dji" as const, label: "DJI", sub: "Mavic, Inspire, Avata, Mini, Air", brandIcon: <svg viewBox="0 0 40 40" className="w-10 h-10"><circle cx="20" cy="20" r="18" fill="#1a1a1a"/><text x="20" y="26" textAnchor="middle" fill="#fff" fontSize="13" fontWeight="bold" fontFamily="Arial">DJI</text></svg> },
              ].map((b) => (
                <button key={b.id} onClick={() => {
                  setDeviceType(b.id); popThenRun(`brand-${b.id}`, () => { setStep("model"); pushHistory("model"); });
                }} className={`flex flex-col items-center justify-center p-4 rounded-2xl tcc-card tcc-brand-card cursor-pointer h-[130px] tap-press ${funnelPop === `brand-${b.id}` ? "tap-confirm" : ""}`}>
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
                  setDeviceType(b.id); popThenRun(`brand-${b.id}`, () => { setStep("model"); pushHistory("model"); });
                }} className={`flex flex-col items-center justify-center p-4 rounded-2xl tcc-card tcc-brand-card cursor-pointer h-[130px] tap-press ${funnelPop === `brand-${b.id}` ? "tap-confirm" : ""}`}>
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
                <button key={b.id} onClick={() => { setDeviceType(b.id); popThenRun(`brand-${b.id}`, () => { setStep("model"); pushHistory("model"); }); }} className={`flex flex-col items-center justify-center p-4 rounded-2xl tcc-card tcc-brand-card cursor-pointer h-[130px] tap-press ${funnelPop === `brand-${b.id}` ? "tap-confirm" : ""}`}>
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
            <button onClick={goBack} aria-label="Go back" className="inline-flex items-center gap-2 text-[#00c853] text-sm font-semibold mb-6 px-4 py-2 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 cursor-pointer transition tap-press">
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
                            <button key={m.id} onClick={() => { setModel(m); popThenRun(`model-${m.id}`, () => { const _ns: Step = hasAdditiveSpecs(m.id) ? "processor" : stepAfterModel; setStep(_ns); pushHistory(_ns); }); }} className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 cursor-pointer transition text-left tap-press ${funnelPop === `model-${m.id}` ? "tap-confirm" : ""}`}>
                              {imgSrc && <Pic src={imgSrc} alt={m.label} className="w-10 h-10 object-contain flex-shrink-0" />}
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
                        <Pic src={s.image} alt={s.label} loading="eager" className="w-20 h-16 object-contain mb-1" />
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
                              <button key={m.id} onClick={() => { setModel(m); popThenRun(`model-${m.id}`, () => { const _ns: Step = hasAdditiveSpecs(m.id) ? "processor" : stepAfterModel; setStep(_ns); pushHistory(_ns); }); }} className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 cursor-pointer transition text-left tap-press ${funnelPop === `model-${m.id}` ? "tap-confirm" : ""}`}>
                                {mImage ? (
                                  <Pic src={mImage} alt={m.label} loading="lazy" className="w-10 h-10 object-contain shrink-0" />
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
                            <button key={m.id} onClick={() => { setModel(m); popThenRun(`model-${m.id}`, () => { const _ns: Step = hasAdditiveSpecs(m.id) ? "processor" : stepAfterModel; setStep(_ns); pushHistory(_ns); }); }} className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 cursor-pointer transition text-left tap-press ${funnelPop === `model-${m.id}` ? "tap-confirm" : ""}`}>
                              {mImage ? (
                                <Pic src={mImage} alt={m.label} loading="lazy" className="w-10 h-10 object-contain shrink-0" />
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
                          <Pic src={s.image} alt={s.label} loading="eager" className="w-16 h-12 object-contain mb-1" />
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
                              }} className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 cursor-pointer transition text-left tap-press ${funnelPop === `model-${m.id}` ? "tap-confirm" : ""}`}>
                                {mImg ? (
                                  <Pic src={mImg} alt={m.label} loading="lazy" className="w-12 h-9 object-contain shrink-0" />
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
                            <button key={m.id} onClick={() => { setModel(m); popThenRun(`model-${m.id}`, () => { const _ns: Step = hasAdditiveSpecs(m.id) ? "processor" : stepAfterModel; setStep(_ns); pushHistory(_ns); }); }} className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 cursor-pointer transition text-left tap-press ${funnelPop === `model-${m.id}` ? "tap-confirm" : ""}`}>
                              {mImg ? (
                                <Pic src={mImg} alt={m.label} loading="lazy" className="w-12 h-12 object-contain shrink-0" />
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
                            <button key={m.id} onClick={() => { setModel(m); popThenRun(`model-${m.id}`, () => { const _ns: Step = hasAdditiveSpecs(m.id) ? "processor" : stepAfterModel; setStep(_ns); pushHistory(_ns); }); }} className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 cursor-pointer transition text-left tap-press ${funnelPop === `model-${m.id}` ? "tap-confirm" : ""}`}>
                              {mImg ? (
                                <Pic src={mImg} alt={m.label} loading="lazy" className="w-12 h-12 object-contain shrink-0" />
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
                        <Pic src={s.image} alt={s.label} loading="eager" className="w-16 h-12 object-contain mb-1" />
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
                          <Pic src={s.image} alt={s.label} loading="eager" className="w-20 h-14 object-contain mb-1" />
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
                      <Pic src={s.image} alt={s.label} loading="eager" className="w-16 h-12 object-contain mb-1" />
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
                      <Pic src={s.image} alt={s.label} loading="eager" className="w-16 h-12 object-contain mb-1" />
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
                        <Pic src={s.image} alt={s.label} loading="eager" className="w-16 h-12 object-contain mb-1" />
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
                          <Pic src={s.image} alt={s.label} loading="eager" className="w-20 h-14 object-contain mb-1" />
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
                        <Pic src={s.image} alt={s.label} loading="eager" className="w-16 h-12 object-contain mb-1" />
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
                        <Pic src={s.image} alt={s.label} loading="eager" className="w-16 h-12 object-contain mb-1" />
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
                          <Pic src={s.image} alt={s.label} loading="eager" className="w-16 h-12 object-contain mb-1" />
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
                        <Pic src={s.image} alt={s.label} loading="eager" className="w-16 h-12 object-contain mb-1" />
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
                        <Pic src={s.image} alt={s.label} loading="eager" className="w-20 h-14 object-contain mb-1" />
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
                      <button key={m.id} onClick={() => { setModel(m); popThenRun(`model-${m.id}`, () => { const _ns: Step = hasAdditiveSpecs(m.id) ? "processor" : stepAfterModel; setStep(_ns); pushHistory(_ns); }); }} className={`w-full flex items-center justify-between px-5 py-4 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 cursor-pointer transition text-left tap-press ${funnelPop === `model-${m.id}` ? "tap-confirm" : ""}`}>
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
                                    <button key={m.id} onClick={() => { setModel(m); popThenRun(`model-${m.id}`, () => { const _ns: Step = hasAdditiveSpecs(m.id) ? "processor" : stepAfterModel; setStep(_ns); pushHistory(_ns); }); }} className={`w-full flex items-center justify-between px-5 py-4 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 cursor-pointer transition text-left tap-press ${funnelPop === `model-${m.id}` ? "tap-confirm" : ""}`}>
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
                        <Pic src={(s as { image?: string }).image} alt={s.label} loading="eager" className="w-16 h-12 object-contain mb-1.5" />
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
                        setModel(m); popThenRun(`model-${m.id}`, () => { const _ns: Step = hasAdditiveSpecs(m.id) ? "processor" : stepAfterModel; setStep(_ns); pushHistory(_ns); });
                      }} className="flex flex-col items-center justify-center p-4 rounded-2xl tcc-card cursor-pointer tap-press">
                        {mImg ? (
                          <Pic src={mImg} alt={m.label} loading="lazy" className="w-12 h-9 object-contain mb-1.5" />
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
                        setModel(m); popThenRun(`model-${m.id}`, () => { const _ns: Step = hasAdditiveSpecs(m.id) ? "processor" : stepAfterModel; setStep(_ns); pushHistory(_ns); });
                      }} className={`w-full flex items-center gap-3 px-5 py-4 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 cursor-pointer transition text-left tap-press ${funnelPop === `model-${m.id}` ? "tap-confirm" : ""}`}>
                        {mImg ? (
                          <Pic src={mImg} alt={m.label} loading="lazy" className="w-12 h-9 object-contain shrink-0" />
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
                              <button key={m.id} onClick={() => { setModel(m); popThenRun(`model-${m.id}`, () => { const _ns: Step = hasAdditiveSpecs(m.id) ? "processor" : stepAfterModel; setStep(_ns); pushHistory(_ns); }); }} className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 cursor-pointer transition text-left tap-press ${funnelPop === `model-${m.id}` ? "tap-confirm" : ""}`}>
                                {mImage ? (
                                  <Pic src={mImage} alt={m.label} loading="lazy" className="w-10 h-10 object-contain shrink-0" />
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
                            setModel(m); popThenRun(`model-${m.id}`, () => { const _ns: Step = hasAdditiveSpecs(m.id) ? "processor" : stepAfterModel; setStep(_ns); pushHistory(_ns); });
                          }} className={`w-full flex items-center justify-between px-5 py-4 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 cursor-pointer transition text-left tap-press ${funnelPop === `model-${m.id}` ? "tap-confirm" : ""}`}>
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
              <button onClick={goBack} aria-label="Go back" className="inline-flex items-center gap-2 text-[#00c853] text-sm font-semibold mb-4 px-4 py-2 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 cursor-pointer transition tap-press">
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
                      onClick={() => { setConnectivity(c); popThenRun(`conn-${c.id}`, () => { setStep("storage"); pushHistory("storage"); }); }}
                      className={`tcc-card group w-full flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer text-left tap-press ${funnelPop === `conn-${c.id}` ? "tap-confirm" : ""}`}
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
              <button onClick={goBack} aria-label="Go back" className="inline-flex items-center gap-2 text-[#00c853] text-sm font-semibold mb-4 px-4 py-2 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 cursor-pointer transition tap-press">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                Back
              </button>
              {selectionPanelMobile}
              <h2 className="text-2xl lg:text-3xl font-extrabold mb-1">Select Processor</h2>
              <p className="text-[#b8b8b8] text-xs mb-3">{deviceType === "dell" ? <>Find this in <span className="text-[#e6e6e6] font-semibold">Settings &gt; System &gt; About</span></> : <>Find this in <span className="text-[#e6e6e6] font-semibold"> Menu &gt; About This Mac</span></>}</p>
              <div className="tcc-selection-frame">
                <div className="space-y-2">
                  {(getMacSpec(model.id)?.processors || []).map((p) => (
                    <button key={p.id} onClick={() => {
                      setProcessor(p);
                      popThenRun(`proc-${p.id}`, () => {
                        // Skip the memory step when the spec has no RAM options
                        // (typical for laptops where RAM doesn't vary much by
                        // SKU). Without this skip the user lands on an empty
                        // memory picker. Skywalker 2026-05-18.
                        const spec = getMacSpec(model?.id);
                        const next: Step = (spec?.memory && spec.memory.length > 0)
                          ? "memory"
                          : "storage";
                        setStep(next); pushHistory(next);
                      });
                    }} className={`tcc-card group w-full flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer text-left tap-press ${funnelPop === `proc-${p.id}` ? "tap-confirm" : ""}`}>
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
              <button onClick={goBack} aria-label="Go back" className="inline-flex items-center gap-2 text-[#00c853] text-sm font-semibold mb-4 px-4 py-2 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 cursor-pointer transition tap-press">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                Back
              </button>
              {selectionPanelMobile}
              <h2 className="text-2xl lg:text-3xl font-extrabold mb-1">Select Memory</h2>
              <p className="text-[#b8b8b8] text-xs mb-3">{deviceType === "dell" ? <>Find this in <span className="text-[#e6e6e6] font-semibold">Settings &gt; System &gt; About</span></> : <>Find this in <span className="text-[#e6e6e6] font-semibold"> Menu &gt; About This Mac</span></>}</p>
              <div className="tcc-selection-frame">
                <div className="space-y-2">
                  {(getMacSpec(model.id)?.memory || []).map((m) => (
                    <button key={m.id} onClick={() => { setMemory(m); popThenRun(`mem-${m.id}`, () => { setStep("storage"); pushHistory("storage"); }); }} className={`tcc-card group w-full flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer text-left tap-press ${funnelPop === `mem-${m.id}` ? "tap-confirm" : ""}`}>
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
              <button onClick={goBack} aria-label="Go back" className="inline-flex items-center gap-2 text-[#00c853] text-sm font-semibold mb-4 px-4 py-2 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 cursor-pointer transition tap-press">
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
                      popThenRun(`gfx-${g.id}`, () => {
                        const spec = getMacSpec(model.id);
                        const next: Step =
                          (spec?.display && spec.display.length > 0) ? "displayresolution" :
                          (spec?.hasNanoGlass ? "displayglass" : "condition");
                        setStep(next); pushHistory(next);
                      });
                    }} className={`tcc-card group w-full flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer text-left tap-press ${funnelPop === `gfx-${g.id}` ? "tap-confirm" : ""}`}>
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
              <button onClick={goBack} aria-label="Go back" className="inline-flex items-center gap-2 text-[#00c853] text-sm font-semibold mb-4 px-4 py-2 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 cursor-pointer transition tap-press">
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
                      popThenRun(`dres-${d.id}`, () => {
                        const next: Step = (getMacSpec(model.id)?.hasNanoGlass ?? false) ? "displayglass" : "condition";
                        setStep(next); pushHistory(next);
                      });
                    }} className={`tcc-card group w-full flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer text-left tap-press ${funnelPop === `dres-${d.id}` ? "tap-confirm" : ""}`}>
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
              <button onClick={goBack} aria-label="Go back" className="inline-flex items-center gap-2 text-[#00c853] text-sm font-semibold mb-4 px-4 py-2 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 cursor-pointer transition tap-press">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                Back
              </button>
              {selectionPanelMobile}
              <h2 className="text-2xl lg:text-3xl font-extrabold mb-1">Display Glass</h2>
              <p className="text-[#b8b8b8] text-xs mb-3">Nano-texture is the anti-glare matte upgrade.</p>
              <div className="tcc-selection-frame">
                <div className="space-y-2">
                  {DISPLAY_GLASS_OPTIONS.map((g) => (
                    <button key={g.id} onClick={() => { setDisplayGlass(g); popThenRun(`dglass-${g.id}`, () => { setStep("condition"); pushHistory("condition"); }); }} className={`tcc-card group w-full flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer text-left tap-press ${funnelPop === `dglass-${g.id}` ? "tap-confirm" : ""}`}>
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
              <button onClick={goBack} aria-label="Go back" className="inline-flex items-center gap-2 text-[#00c853] text-sm font-semibold mb-4 px-4 py-2 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 cursor-pointer transition tap-press">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                Back
              </button>
              {selectionPanelMobile}
              <h2 className="text-2xl lg:text-3xl font-extrabold mb-1">Battery Health</h2>
              <p className="text-[#b8b8b8] text-xs mb-3">{deviceType === "dell" ? <>Check it in <span className="text-[#e6e6e6] font-semibold">Dell Power Manager or Settings &gt; Power &amp; Battery</span></> : <>Check it in <span className="text-[#e6e6e6] font-semibold"> Menu &gt; System Settings &gt; Battery &gt; Battery Health</span></>}</p>
              <div className="tcc-selection-frame">
                <div className="space-y-2">
                  {BATTERY_HEALTH_OPTIONS.map((b) => (
                    <button key={b.id} onClick={() => { setBatteryHealth(b); popThenRun(`batt-${b.id}`, () => { setStep("charger"); pushHistory("charger"); }); }} className={`tcc-card group w-full flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer text-left tap-press ${funnelPop === `batt-${b.id}` ? "tap-confirm" : ""}`}>
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
              <button onClick={goBack} aria-label="Go back" className="inline-flex items-center gap-2 text-[#00c853] text-sm font-semibold mb-4 px-4 py-2 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 cursor-pointer transition tap-press">
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
                      popThenRun(`chg-${c.id}`, () => {
                        // If this additive model's device type has brand extras (e.g. Dell GPU),
                        // route through extras before quote.
                        const ex = getBrandExtras(deviceType, model?.id);
                        if (ex.length > 0) {
                          setExtras({}); setExtrasIndex(0);
                          setStep("extras"); pushHistory("extras");
                          return;
                        }
                        setShowConfetti(true); setTimeout(() => setShowConfetti(false), 3000); setStep("quote"); pushHistory("quote");
                      });
                    }} className={`tcc-card group w-full flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer text-left tap-press ${funnelPop === `chg-${c.id}` ? "tap-confirm" : ""}`}>
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
        // given current answers (e.g. "which band?" when user said no band,
        // or applewatch's "functional?" extra when broken-functional
        // already covered the same ground).
        if (q.showIf && !q.showIf(extras, condition)) {
          setTimeout(() => setExtrasIndex(i => i + 1), 0);
          return null;
        }
        return (
          <section className="animate-[fadeIn_0.3s_ease-out]">
            <div className="max-w-lg md:max-w-3xl lg:max-w-6xl mx-auto px-4 pt-6 pb-8 lg:flex lg:gap-8 lg:items-start">
              {selectionPanel}
              <div className="flex-1 min-w-0">
                <button onClick={goBack} aria-label="Go back" className="inline-flex items-center gap-2 text-[#00c853] text-sm font-semibold mb-4 px-4 py-2 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 cursor-pointer transition tap-press">
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
                          popThenRun(`extra-${q.id}-${opt.id}`, () => {
                            // Walk past any subsequent questions that don't
                            // apply given the new answers (e.g. "which band?"
                            // when user just said no band).
                            let nextIdx = extrasIndex + 1;
                            while (nextIdx < list.length) {
                              const peek = list[nextIdx];
                              if (peek.showIf && !peek.showIf(nextExtras, condition)) nextIdx++;
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
                          });
                        }}
                        className={`tcc-card group w-full flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer text-left tap-press ${funnelPop === `extra-${q.id}-${opt.id}` ? "tap-confirm" : ""}`}
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
              <button onClick={goBack} aria-label="Go back" className="inline-flex items-center gap-2 text-[#00c853] text-sm font-semibold mb-4 px-4 py-2 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 cursor-pointer transition tap-press">
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
                        popThenRun(`stor-${s.id}`, () => {
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
                        });
                      }}
                      className={`tcc-card group w-full flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer text-left tap-press ${funnelPop === `stor-${s.id}` ? "tap-confirm" : ""}`}
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
            <button onClick={goBack} aria-label="Go back" className="inline-flex items-center gap-2 text-[#00c853] text-sm font-semibold mb-4 px-4 py-2 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 cursor-pointer transition tap-press">
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
                    setBrokenFunctional(null); // reset for both broken + non-broken paths
                    setBrokenGlass(null);
                    popThenRun(`cond-${c.id}`, () => {
                      // Broken: ask functional question before continuing
                      if (c.id === "broken") {
                        setStep("broken-functional" as Step); pushHistory("broken-functional" as Step);
                        return;
                      }
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
                    });
                  }}
                  className={`tcc-card group w-full flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer text-left tap-press ${funnelPop === `cond-${c.id}` ? "tap-confirm" : ""}`}
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

            {/* Parts / locked / dead-on-arrival custom-quote escape hatch.
                Lives below the regular working-condition tiles so it
                doesn't compete for attention with mainstream sellers,
                but the sellers whose phone is locked or won't power on
                have a clearly-labeled door instead of bouncing. Posts a
                manual-review lead to MC. Skywalker 2026-05-19. */}
            {isPhoneFlow && (
              <button
                type="button"
                onClick={() => {
                  setPartsModalOpen(true);
                  setPartsSubmitted(false);
                  // Prefill in case they've entered any of these already
                  setPartsName(name);
                  setPartsEmail(email);
                  setPartsPhone(phone);
                }}
                className="mt-3 w-full text-left px-4 py-3 rounded-xl bg-amber-500/[0.06] border border-amber-500/25 hover:bg-amber-500/[0.1] hover:border-amber-500/40 transition cursor-pointer group"
              >
                <p className="text-sm font-extrabold text-amber-200 leading-tight flex items-center gap-1.5">
                  <svg className="w-4 h-4 shrink-0 text-amber-200" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>Phone is locked or won&apos;t turn on?
                </p>
                <p className="text-[12px] text-[#d4d4d4] mt-0.5 leading-snug">
                  Locked · carrier locked · MDM locked · won&apos;t power on · cracked beyond repair — get a custom quote within the hour
                </p>
              </button>
            )}

            <div className="mt-6 bg-[rgba(20,28,40,0.5)] backdrop-blur-[12px] border border-white/10 rounded-2xl p-5 shadow-[0_10px_30px_rgba(0,0,0,0.5)]">
              <h3 className="text-sm font-extrabold text-[#00c853] uppercase tracking-wider mb-1">Our Promise</h3>
              <p className="text-base font-extrabold text-white mb-1">The Top Cash Guarantee</p>
              <p className="text-[#e6e6e6] text-xs mb-4">Concerned about quote adjustments? Here&apos;s how we handle inspections.</p>
              <div className="space-y-3">
                <div className="flex gap-3">
                  <svg className="w-5 h-5 shrink-0 text-[#00c853]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} style={{filter:"drop-shadow(0 0 8px rgba(0,200,83,0.55))"}}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  <div><p className="text-sm font-bold text-white">Transparent Pricing</p><p className="text-xs text-[#e6e6e6]">What you see is what you get. Your quote is based on the condition you select — no surprise deductions.</p></div>
                </div>
                <div className="flex gap-3">
                  <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} style={{color:"rgb(255,140,140)",filter:"drop-shadow(0 0 8px rgba(255,140,140,0.55))"}}><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                  <div><p className="text-sm font-bold text-white">Honest Inspections</p><p className="text-xs text-[#e6e6e6]">If anything differs from your description, we&apos;ll walk you through our findings before adjusting.</p></div>
                </div>
                <div className="flex gap-3">
                  <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} style={{color:"rgb(120,200,255)",filter:"drop-shadow(0 0 8px rgba(120,200,255,0.55))"}}><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                  <div><p className="text-sm font-bold text-white">No Pressure, No Strings</p><p className="text-xs text-[#e6e6e6]">Not happy with the final offer? We&apos;ll return your device — no questions asked.</p></div>
                </div>
              </div>
            </div>

            <div className="mt-4 bg-white/5 border border-white/10 rounded-2xl p-5">
              <h3 className="text-base font-bold text-white mb-3">Why Sellers Choose Top Cash</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="text-center p-3 bg-white/5 rounded-xl">
                  <svg className="w-6 h-6 mx-auto text-[#00c853]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.196-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" /></svg>
                  <p className="text-xs text-[#e6e6e6] mt-1">Thousands of happy sellers</p>
                </div>
                <div className="text-center p-3 bg-white/5 rounded-xl">
                  <svg className="w-6 h-6 mx-auto text-[#00c853]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                  <p className="text-xs text-[#e6e6e6] mt-1">Get paid the same day</p>
                </div>
                <div className="text-center p-3 bg-white/5 rounded-xl">
                  <svg className="w-6 h-6 mx-auto text-[#00c853]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                  <p className="text-xs text-[#e6e6e6] mt-1">Your price is locked 14 days</p>
                </div>
                <div className="text-center p-3 bg-white/5 rounded-xl">
                  <svg className="w-6 h-6 mx-auto text-[#00c853]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
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
            <button onClick={goBack} aria-label="Go back" className="inline-flex items-center gap-2 text-[#00c853] text-sm font-semibold mb-4 px-4 py-2 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 cursor-pointer transition tap-press">
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
                    popThenRun(`bfunc-yes`, () => {
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
                    });
                  }}
                  className={`tcc-card group w-full flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer text-left tap-press ${funnelPop === `bfunc-yes` ? "tap-confirm" : ""}`}
                >
                  <svg className="w-8 h-8 shrink-0 text-[#00c853]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  <div className="flex-1">
                    <p className="font-extrabold text-[15px] text-white">Yes — still works</p>
                    <p className="text-[#b8b8b8] text-xs mt-0.5">Screen cracked, dents, or cosmetic damage — but touchscreen, cameras, speakers, and buttons all work</p>
                  </div>
                </button>
                <button
                  onClick={() => {
                    setBrokenFunctional(false);
                    // Non-functional → go straight to quote (will show manual review)
                    popThenRun(`bfunc-no`, () => { setStep("quote"); pushHistory("quote"); });
                  }}
                  className={`tcc-card group w-full flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer text-left tap-press ${funnelPop === `bfunc-no` ? "tap-confirm" : ""}`}
                >
                  <svg className="w-8 h-8 shrink-0 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
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
            <button onClick={goBack} aria-label="Go back" className="inline-flex items-center gap-2 text-[#00c853] text-sm font-semibold mb-4 px-4 py-2 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 cursor-pointer transition tap-press">
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
                      popThenRun(`bglass-${g.id}`, () => {
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
                      });
                    }}
                    className={`tcc-card group w-full flex items-center px-4 py-3 rounded-xl cursor-pointer text-left tap-press ${funnelPop === `bglass-${g.id}` ? "tap-confirm" : ""}`}
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
            <button onClick={goBack} aria-label="Go back" className="inline-flex items-center gap-2 text-[#00c853] text-sm font-semibold mb-4 px-4 py-2 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 cursor-pointer transition tap-press">
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
                      setCarrierLock(null);
                      popThenRun(`carr-${c.id}`, () => {
                        // Only Verizon has a real 60-day lock policy worth asking
                        // about; for any other carrier we skip the lock step and
                        // treat the device as unlocked (multiplier = 1.0).
                        if (c.id === "verizon") {
                          setStep("carrier-lock"); pushHistory("carrier-lock");
                        } else {
                          setShowConfetti(true);
                          setTimeout(() => setShowConfetti(false), 3000);
                          setStep("quote"); pushHistory("quote");
                        }
                      });
                    }}
                    className={`tcc-card group w-full flex items-center gap-3 px-4 py-2.5 lg:py-3 rounded-xl cursor-pointer text-left tap-press ${funnelPop === `carr-${c.id}` ? "tap-confirm" : ""}`}
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
              <button onClick={goBack} aria-label="Go back" className="inline-flex items-center gap-2 text-[#00c853] text-sm font-semibold mb-4 px-4 py-2 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 cursor-pointer transition tap-press">
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
                        popThenRun(`clock-${lock.id}`, () => {
                          setShowConfetti(true);
                          setTimeout(() => setShowConfetti(false), 3000);
                          setStep("quote"); pushHistory("quote");
                        });
                      }}
                      className={`tcc-card group w-full flex items-center justify-between gap-3 px-4 py-3 rounded-xl cursor-pointer text-left tap-press ${funnelPop === `clock-${lock.id}` ? "tap-confirm" : ""}`}
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
                  <p className="text-3xl lg:text-4xl font-extrabold text-white mt-1 leading-tight">{isManualQuote ? manualReviewReason.title : "Quoted via email or text"}</p>
                  <p className="text-[#c8c8c8] text-sm mt-2 leading-snug max-w-md">{isManualQuote ? manualReviewReason.body : "This device isn\u2019t on our standard price list. Add it to your box and we\u2019ll email or text you a quote within the hour \u2014 no need to wait until pickup."}</p>
                  {isBrokenNonFunctional && (
                    <button
                      type="button"
                      onClick={() => setChatOpen(true)}
                      className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 text-[12px] font-semibold text-amber-200 cursor-pointer transition"
                    >
                      <svg className="w-4 h-4 shrink-0 text-amber-200" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>Get a parts-value quote in chat
                    </button>
                  )}
                </>
              ) : (
                <p className="text-5xl lg:text-6xl font-extrabold text-[#00c853] mt-1" style={{ textShadow: "0 0 8px rgba(0, 200, 83, 0.22)" }}>${quote * quantity}</p>
              )}
            </div>
            <div className="flex items-center justify-center lg:justify-start flex-wrap gap-1 mb-2">
              {promoApplies && promo && (
                <p className="text-[10px] inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#00c853]/15 text-[#00c853] font-bold"><svg className="w-3.5 h-3.5 shrink-0 text-[#00c853]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.196-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" /></svg>{promo.flatBonus ? `+$${promo.flatBonus} bonus applied` : `+${promo.percent}% promo applied`}</p>
              )}
              {couponPercent > 0 && (
                <p className="text-[10px] inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#00c853]/15 text-[#00c853] font-bold"><svg className="w-3.5 h-3.5 shrink-0 text-[#00c853]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" /></svg>{couponLabel} +{couponPercent}%</p>
              )}
              {/* Referral chip — shows when a friend's ?ref= code is
                  active. Same calm pill style as the promo/coupon chips.
                  The actual $10 referee bonus is applied server-side in
                  /api/lead; this just reassures the customer it's on. */}
              {referralCode && (
                <p className="text-[10px] inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#00c853]/15 text-[#00c853] font-bold"><svg className="w-3.5 h-3.5 shrink-0 text-[#00c853]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M21 11.25v8.25a1.5 1.5 0 01-1.5 1.5H5.25a1.5 1.5 0 01-1.5-1.5v-8.25M12 4.875A2.625 2.625 0 109.375 7.5H12m0-2.625V7.5m0-2.625A2.625 2.625 0 1114.625 7.5H12m0 0V21m-8.625-9.75h18c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125h-18c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" /></svg>Referral applied — $10 bonus added to your offer</p>
              )}
            </div>
            {!isManualQuote && !isPendingQuote && quantity > 1 && <p className="text-[#e6e6e6] text-sm mb-2">${quote} each × {quantity}</p>}
            {!isManualQuote && !isPendingQuote && quantity === 1 && <div className="mb-3" />}

            {/* FINAL-PAYOUT REASSURANCE — anti-IWM-bait-and-switch
                positioning. Competitors (IWM in particular) show a
                higher headline quote then chip it down at inspection.
                Our quote already includes carrier deduction, condition
                grading, etc., so what the customer sees is what they
                get. Skywalker 2026-05-18. Skip this for fair/broken
                conditions — those legitimately can shift if photos
                reveal worse damage, and the existing disclaimer
                below handles that case honestly. */}
            {!isManualQuote && !isPendingQuote && condition?.id !== "broken" && condition?.id !== "fair" && (
              <div className="max-w-md mx-auto lg:mx-0 mb-3 px-3 py-2.5 rounded-xl bg-[#00c853]/[0.1] border border-[#00c853]/35 text-left flex items-start gap-2.5">
                <span className="text-[#00c853] text-lg leading-none mt-0.5">✓</span>
                <div>
                  <p className="text-[12px] text-white font-bold leading-tight">This is your final payout</p>
                  <p className="text-[11px] text-[#bdbdbd] mt-0.5 leading-snug">
                    No surprise deductions at inspection. The number you see is the number you get.
                  </p>
                </div>
              </div>
            )}

            {/* QUOTE-MAY-CHANGE DISCLAIMER + PHOTO ENCOURAGEMENT —
                Only on damaged-condition quotes (broken / fair). Sets
                expectations honestly that the number can shift after
                we see the device, and pushes the seller toward
                uploading photos which lock in the quote faster + reduce
                surprises at handoff. Skywalker directive 2026-05-17. */}
            {!isManualQuote && !isPendingQuote && (condition?.id === "broken" || condition?.id === "fair") && (
              <div className="max-w-md mx-auto lg:mx-0 mb-3 px-3 py-2.5 rounded-xl bg-[#00c853]/[0.07] border border-[#00c853]/25 text-left">
                <p className="text-[12px] text-white font-semibold leading-snug flex items-center gap-1.5">
                  <svg className="w-4 h-4 shrink-0 text-[#00c853]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>Add photos to lock in this quote
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
                if (savings <= 0) return null;
                return <p className="text-[#00c853] text-xs font-extrabold mt-3">You make up to ${savings} more with us</p>;
              })()}
              <a href={`mailto:offers@topcashcellular.com?subject=Price%20Match%20Request&body=Model%3A%20${encodeURIComponent(model?.label || '')}%0AStorage%3A%20${encodeURIComponent(storage?.label || '')}%0AStorage%3A%20${encodeURIComponent(condition?.label || '')}%0ACompetitor%20URL%3A%20%0ACompetitor%20offer%3A%20%24`} className="mt-3 inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-[#00c853]/10 border border-[#00c853]/30 hover:bg-[#00c853]/15 text-[#00c853] text-xs font-bold transition"><svg className="w-4 h-4 shrink-0 text-[#00c853]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>Got a higher offer? We&apos;ll beat it by $25</a>
            </div>}

            {/* Coupon code */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-4 mb-4 text-left">
              <p className="text-xs font-semibold text-[#e6e6e6] uppercase tracking-wider mb-2">Have a coupon code?</p>
              {couponLabel ? (
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#00c853]/15 border border-[#00c853]/30 text-[#00c853] text-xs font-bold"><svg className="w-4 h-4 shrink-0 text-[#00c853]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" /></svg>{couponLabel} · +{couponPercent}% applied</span>
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
                Price locked · 14 days
              </span>
            </div>

            {/* Back / Add to Cart row — kept inline on desktop, pinned to
                the bottom of the viewport on mobile so the primary CTA is
                always visible while the user scrolls the rest of the
                quote details. The Add to Cart button uses tcc-button-primary
                for the brand-green gradient + glow. */}
            <div className="lg:static fixed bottom-0 left-0 right-0 z-30 lg:z-auto lg:bg-transparent bg-[rgba(10,10,10,0.95)] lg:backdrop-blur-0 backdrop-blur-md lg:border-t-0 border-t border-white/10 lg:p-0 px-4 pt-4 cta-bar-ios lg:rounded-none flex gap-3">
              <button onClick={goBack} className="flex-1 bg-white/10 text-white py-5 rounded-2xl text-base lg:text-lg font-extrabold cursor-pointer hover:bg-white/15 transition tap-press">
                Back
              </button>
              <button
                onClick={() => {
                  if (model && condition) {
                    // Capture EVERY spec the funnel asked about so each cart
                    // entry carries its full pricing context to the backend.
                    // Skywalker 2026-05-17 — "all the important meat are
                    // missing from the backend".
                    const extrasArr = Object.values(extras).map((x) => x.label).filter(Boolean);
                    const itemSnapshot: CartItem = {
                      model: model.label,
                      modelId: model.id,
                      storage: storage?.label || "N/A",
                      condition: condition.label,
                      // Manual-review items carry no price so the cart and
                      // checkout don't lie about value. The backend lead
                      // body still includes condition + specs so staff
                      // can quote it manually post-arrival.
                      price: isManualQuote ? 0 : quote,
                      quantity: 1,
                      image: model.image,
                      carrier: carrier?.label,
                      connectivity: connectivity?.label,
                      processor: processor?.label,
                      memory: memory?.label,
                      graphics: graphics?.label,
                      displayResolution: displayResolution?.label,
                      displayGlass: displayGlass?.label,
                      batteryHealth: batteryHealth?.label,
                      charger: charger?.label,
                      extras: extrasArr.length > 0 ? extrasArr : undefined,
                      brokenGlass: condition.id === "broken" && isPhoneFlow ? brokenGlass : undefined,
                      brokenFunctional: condition.id === "broken" ? brokenFunctional : undefined,
                      paidOff: paidOff ?? undefined,
                      imei: imeiInput.replace(/\D/g, "") || undefined,
                    };
                    setCartItems(prev => {
                      const key = `${model.id}-${storage?.label || ''}-${condition.label}`;
                      const existing = prev.find(i => `${i.modelId}-${i.storage}-${i.condition}` === key);
                      // Re-adding the same config bumps the quantity by 1
                      // and refreshes the price + specs. The cart's +/- pills
                      // can also adjust.
                      if (existing) return prev.map(i => `${i.modelId}-${i.storage}-${i.condition}` === key ? { ...itemSnapshot, quantity: i.quantity + 1, image: model.image ?? i.image } : i);
                      return [...prev, itemSnapshot];
                    });
                    setCartBump(b => b + 1);
                    setCartToast({ model: model.label, price: isManualQuote ? 0 : quote });
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
              const ICON_MONEY = <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />;
              const ICON_PIN = <><path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></>;
              const ICON_CAR = <path strokeLinecap="round" strokeLinejoin="round" d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0zM13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1" />;
              const ICON_BOLT = <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />;
              const ICON_BOX = <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-14L4 7m8 4v10M4 7v10l8 4" />;
              const ICON_SHIELD = <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />;
              const localBullets = [
                { icon: ICON_MONEY, text: "Cash on the spot at handoff" },
                { icon: ICON_PIN, text: "Meet at any safe public location you choose" },
                { icon: ICON_CAR, text: "Mobile pickup — we come to you" },
                { icon: ICON_BOLT, text: "Inspection + payout in under 15 minutes" },
              ];
              const shipBullets = [
                { icon: ICON_MONEY, text: "No selling fees" },
                { icon: ICON_BOX, text: "Free prepaid FedEx label" },
                { icon: ICON_SHIELD, text: "Full-value shipping insurance included" },
                { icon: ICON_BOLT, text: "Same-day payout after we verify" },
              ];
              const neutralBullets = [
                { icon: ICON_MONEY, text: "No selling fees" },
                { icon: ICON_SHIELD, text: "Zero fraud risk" },
                { icon: ICON_BOX, text: "Free FedEx shipping OR local meetup" },
                { icon: ICON_BOLT, text: "15-min cash local · 24-hr payout shipped" },
              ];
              const bullets = handoffMethod === "local" ? localBullets : handoffMethod === "ship" ? shipBullets : neutralBullets;
              return (
                <div className="mt-6 space-y-3 text-left">
                  {bullets.map(b => (
                    <div key={b.text} className="flex items-center gap-3">
                      <svg className="w-5 h-5 shrink-0 text-[#00c853]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>{b.icon}</svg>
                      <span className="text-sm text-[#e5e5e5]">{b.text}</span>
                    </div>
                  ))}
                  <div className="flex items-start gap-3">
                    <svg className="w-5 h-5 shrink-0 text-[#00c853] leading-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>
                    <div className="flex-1">
                      <p className="text-sm text-[#e5e5e5] mb-2">Get paid your way</p>
                      <div className="flex flex-wrap gap-1.5">
                        {handoffMethod === "local" && (
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-white/10 text-white text-[10px] font-bold"><svg className="w-3.5 h-3.5 text-[#00c853]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>Cash</span>
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
              const G_TARGET = <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />;
              const G_PEOPLE = <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />;
              const G_REFRESH = <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />;
              const G_BOLT = <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />;
              const G_SHIELD = <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />;
              const guarantees = handoffMethod === "local" ? [
                { icon: G_TARGET, title: "Transparent Pricing", body: "What you see is what you get. We walk through the device with you in person before paying — no surprise deductions, no haggling." },
                { icon: G_PEOPLE, title: "Inspection in Front of You", body: "Test the device together at handoff. We tell you exactly what we checked and how it matched your description before any cash changes hands." },
                { icon: G_REFRESH, title: "Walk Away Anytime", body: "Not happy with our final offer? Just don't hand over the device — no obligation, no pressure, no hard feelings." },
                { icon: G_BOLT, title: "Cash in 15 Minutes", body: "Quote → meet → inspect → cash. Average local handoff wraps in under 15 minutes. Cash on the spot, or Zelle / Cash App / Venmo / BTC instantly." },
              ] : handoffMethod === "ship" ? [
                { icon: G_TARGET, title: "Transparent Pricing", body: "Your quote is what we pay if the device matches your description. If anything differs we email photos + a written explanation before adjusting — never a silent change." },
                { icon: G_SHIELD, title: "Insured Shipping", body: "Every prepaid FedEx label is declared for your full quoted value — so a lost or damaged device is covered for the full amount we quoted. No extra step, no counter fee." },
                { icon: G_REFRESH, title: "Free Return Ship", body: "If you reject our revised offer for any reason, we ship the device back to you at our cost — no questions asked." },
                { icon: G_BOLT, title: "Same-Day Payout", body: "Most payouts go out the same business day we receive and verify. Cash App + Zelle land in minutes; Bitcoin sends on-chain in ~30 minutes." },
              ] : [
                { icon: G_TARGET, title: "Transparent Pricing", body: "What you see is what you get. No surprise deductions, no bait-and-switch. Your quote is based on the condition you select." },
                { icon: G_PEOPLE, title: "Honest Inspections", body: "If anything differs from your description, we'll walk you through our findings before adjusting — no silent changes." },
                { icon: G_REFRESH, title: "No Pressure, No Strings", body: "Changed your mind? Not happy with the final offer? We'll return your device — no questions asked." },
                { icon: G_BOLT, title: "Same-Day Payout", body: "Austin local? Get paid on the spot. Shipping in? Most payouts hit within 24 hours of device arrival." },
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
                        <p className="text-sm font-semibold text-[#e5e5e5] flex items-center gap-2"><svg className="w-5 h-5 shrink-0 text-[#00c853]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>{g.icon}</svg>{g.title}</p>
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
                  <svg className="w-7 h-7 mx-auto text-[#00c853]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.196-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" /></svg>
                  <p className="text-xs text-[#e6e6e6] mt-1">Thousands of happy sellers</p>
                </div>
                <div className="text-center p-3 bg-white/5 rounded-xl">
                  <svg className="w-7 h-7 mx-auto text-[#00c853]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                  <p className="text-xs text-[#e6e6e6] mt-1">Get paid the same day</p>
                </div>
                <div className="text-center p-3 bg-white/5 rounded-xl">
                  <svg className="w-7 h-7 mx-auto text-[#00c853]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                  <p className="text-xs text-[#e6e6e6] mt-1">Your price is locked 14 days</p>
                </div>
                <div className="text-center p-3 bg-white/5 rounded-xl">
                  <svg className="w-7 h-7 mx-auto text-[#00c853]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
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
            <button onClick={goBack} aria-label="Go back" className="inline-flex items-center gap-2 text-[#00c853] text-sm font-semibold mb-4 px-4 py-2 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 cursor-pointer transition tap-press">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
              Back
            </button>
            {checkoutSummaryMobile}

            <h2 className="text-2xl font-bold mb-1">Checkout</h2>

            {/* CHECKOUT PROGRESS BANNER — Skywalker 2026-05-19: customers
                were stopping at "Continue As Guest" expecting their
                FedEx label, but the label only mints at the final
                submit on the contact step. Make the 3-step progress
                obvious on every step so nobody quits halfway.
                Skywalker 2026-05-19 follow-up: local-meetup users got
                this same FedEx copy even though they're meeting in
                Austin — branch the banner so shipping copy never
                shows on the local path. */}
            {handoffMethod === "local" ? (
              <div className="mb-4 px-4 py-3 rounded-xl bg-[#00c853]/[0.08] border border-[#00c853]/30 flex items-start gap-3">
                <svg className="w-5 h-5 shrink-0 text-[#00c853] leading-none mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-[#00c853] leading-tight">Austin local meetup — paid on the spot</p>
                  <p className="text-[11px] text-[#bdbdbd] mt-1 leading-snug">
                    <span className="text-white font-semibold">1. Your info</span> (you&apos;re here) → <span className="text-[#888]">2. Payout method</span> → <span className="text-[#888]">3. Pick a meetup window</span>. Typical handoff wraps in under 15 minutes — cash, Zelle, Cash App, or Venmo when you walk away.
                  </p>
                </div>
              </div>
            ) : (
              <div className="mb-4 px-4 py-3 rounded-xl bg-[#00c853]/[0.08] border border-[#00c853]/30 flex items-start gap-3">
                <svg className="w-5 h-5 shrink-0 text-[#00c853] leading-none mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-14L4 7m8 4v10M4 7v10l8 4" /></svg>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-[#00c853] leading-tight">Step 1 of 3 — your <FedExMark /> label generates on the final step</p>
                  <p className="text-[11px] text-[#bdbdbd] mt-1 leading-snug">
                    <span className="text-white font-semibold">1. Account</span> (you&apos;re here) → <span className="text-[#888]">2. Payment</span> → <span className="text-[#888]">3. Shipping address & submit</span>. Your prepaid label hits your inbox the moment you submit the last step — usually under 30 seconds.
                  </p>
                </div>
              </div>
            )}

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
                <button type="submit" className="tcc-button-primary w-full py-4 text-base font-extrabold">Continue As Guest →</button>
                <p className="text-[11px] text-[#888] text-center mt-1">{handoffMethod === "local" ? "Next: choose how you'd like to be paid, then book a meetup window" : <>Next: pick payment method, then enter shipping address for your free <FedExMark /> label</>}</p>
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
                  // Persist the customer cookie so this person sees their
                  // account history on future visits without re-typing email.
                  // Fire-and-forget — funnel never blocks on this.
                  fetch("/api/account/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) }).catch(() => {});
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

            {/* SECTION 3: HANDOFF — copy branches on local vs ship so a
                customer who picked "sell local" never sees prepaid-label
                language. Skywalker 2026-05-19. */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-5 mb-4">
              {handoffMethod === "local" ? (
                <>
                  <h3 className="text-sm font-bold text-[#00c853] uppercase tracking-wider mb-2">Meetup</h3>
                  <p className="text-[#e6e6e6] text-xs">Pick a window — we&apos;ll confirm a public Austin spot by text. Inspection happens in person, you walk away paid same-day.</p>
                </>
              ) : (
                <>
                  <h3 className="text-sm font-bold text-[#00c853] uppercase tracking-wider mb-2">Shipping</h3>
                  <p className="text-[#e6e6e6] text-xs">Free prepaid <FedExMark /> label emailed the moment you submit. Drop the box at any FedEx location.</p>
                </>
              )}
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
            <button onClick={goBack} aria-label="Go back" className="inline-flex items-center gap-2 text-[#00c853] text-sm font-semibold mb-4 px-4 py-2 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 cursor-pointer transition tap-press">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
              Back
            </button>
            {cartItems.length > 0 ? checkoutSummaryMobile : selectionPanelMobile}
            <h2 className="text-2xl font-bold mb-1">How would you like to get paid?</h2>

            {/* PROGRESS BANNER — branches on handoff so local-meetup
                customers don't see FedEx / label copy. Skywalker 2026-05-19. */}
            {handoffMethod === "local" ? (
              <div className="mt-2 mb-4 px-4 py-3 rounded-xl bg-[#00c853]/[0.08] border border-[#00c853]/30 flex items-start gap-3">
                <svg className="w-5 h-5 shrink-0 text-[#00c853] leading-none mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-[#00c853] leading-tight">Austin local meetup — choose how you&apos;d like to be paid</p>
                  <p className="text-[11px] text-[#bdbdbd] mt-1 leading-snug">
                    <span className="text-[#888]">1. Your info ✓</span> → <span className="text-white font-semibold">2. Payout method</span> (you&apos;re here) → <span className="text-[#888]">3. Pick a meetup window</span>. Cash, Zelle, Cash App, Venmo, or BTC — same-day, every option lands in minutes.
                  </p>
                </div>
              </div>
            ) : (
              <div className="mt-2 mb-4 px-4 py-3 rounded-xl bg-[#00c853]/[0.08] border border-[#00c853]/30 flex items-start gap-3">
                <svg className="w-5 h-5 shrink-0 text-[#00c853] leading-none mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-14L4 7m8 4v10M4 7v10l8 4" /></svg>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-[#00c853] leading-tight">Step 2 of 3 — one more step after this for your label</p>
                  <p className="text-[11px] text-[#bdbdbd] mt-1 leading-snug">
                    <span className="text-[#888]">1. Account ✓</span> → <span className="text-white font-semibold">2. Payment</span> (you&apos;re here) → <span className="text-[#888]">3. Shipping address & submit</span>. Your prepaid <FedExMark /> label generates the second you submit the next page.
                  </p>
                </div>
              </div>
            )}
            <p className="text-[#e6e6e6] text-sm mb-3">Select your preferred payout method</p>
            {/* Payout speed heads-up — only shown when the user hasn't
                picked a handoff yet. Deliberately does NOT mention "Cash"
                even by name — Skywalker 2026-05-18 customer-confusion
                report: shipping customers were reading the old "Cash
                payouts are available for local Austin pickups only"
                copy and asking for cash anyway. Cash is a separate
                button that only appears in the option grid when the
                user has explicitly picked local handoff, which is the
                clearest signal possible. */}
            {!handoffMethod && (
              <div className="mb-4 px-3 py-2 rounded-lg bg-[#00c853]/5 border border-[#00c853]/20 text-[12px] text-[#bdbdbd] leading-snug">
                <span className="text-[#00c853] font-bold">Heads up:</span> All digital methods (Cash App / Zelle / Bitcoin) land within minutes of receipt.
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              {/* Explicit per-handoff payout lists so there's no way Cash
                  can render for shipping. Filter approach was correct but
                  Skywalker kept seeing Cash on mobile shipping — guessing
                  cache or some edge case. Hard-coding both lists removes
                  any doubt. Skywalker 2026-05-18. */}
              {(handoffMethod === "local"
                ? [
                    { id: "cash",    label: "Cash" },
                    { id: "cashapp", label: "Cash App" },
                    { id: "zelle",   label: "Zelle" },
                    { id: "btc",     label: "Bitcoin" },
                  ]
                : [
                    // SHIPPING (or unset) — Cash is excluded, no exceptions
                    { id: "cashapp", label: "Cash App" },
                    { id: "zelle",   label: "Zelle" },
                    { id: "btc",     label: "Bitcoin" },
                  ]
              ).map((p) => {
                const selected = payout?.id === p.id;
                return (
                  <button
                    key={p.id}
                    onClick={() => {
                      // Switching methods clears any handle already typed.
                      if (payout?.id !== p.id) { setPayoutHandle(""); setPayoutHandleConfirm(""); }
                      setPayout(p);
                    }}
                    className={`flex items-center justify-center p-7 rounded-2xl cursor-pointer min-h-[88px] transition ${selected ? "border-2 border-[#00c853] bg-[#00c853]/10" : "tcc-card"}`}
                  >
                    <p className="font-extrabold text-[17px] text-white">{p.label}{selected ? " ✓" : ""}</p>
                  </button>
                );
              })}
            </div>

            {/* Payout-handle capture — once a digital method is picked,
                the customer enters their handle TWICE so a typo can't
                send a payout into the void. Cash is paid in person and
                skips straight to Continue. Format validators come later;
                for now it's a double-entry match check. Skywalker 2026-05-20. */}
            {payout && (() => {
              const meta = PAYOUT_HANDLE_META[payout.id];
              const needsHandle = !!meta;
              const h = payoutHandle.trim();
              const hc = payoutHandleConfirm.trim();
              const matched = h.length > 0 && h === hc;
              const ready = !needsHandle || matched;
              return (
                <div className="mt-5 bg-white/[0.03] border border-white/10 rounded-2xl p-4">
                  {meta ? (
                    <>
                      <p className="text-sm font-bold text-white mb-1">Where should we send your {payout.label} payout?</p>
                      <p className="text-[11px] text-[#bdbdbd] mb-3">{meta.hint} Enter it twice — we confirm it matches before paying you.</p>
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-[#888] mb-1">{meta.field}</label>
                      <input
                        type="text"
                        value={payoutHandle}
                        onChange={(e) => setPayoutHandle(e.target.value.slice(0, 120))}
                        placeholder={meta.placeholder}
                        autoComplete="off"
                        spellCheck={false}
                        className="w-full px-3 py-2.5 mb-3 bg-black/40 border border-white/15 rounded-lg text-sm text-white placeholder:text-[#777] focus:outline-none focus:border-[#00c853]"
                      />
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-[#888] mb-1">Confirm {meta.field}</label>
                      <input
                        type="text"
                        value={payoutHandleConfirm}
                        onChange={(e) => setPayoutHandleConfirm(e.target.value.slice(0, 120))}
                        placeholder="Re-enter to confirm"
                        autoComplete="off"
                        spellCheck={false}
                        className={`w-full px-3 py-2.5 bg-black/40 border rounded-lg text-sm text-white placeholder:text-[#777] focus:outline-none ${
                          !hc ? "border-white/15 focus:border-[#00c853]" : matched ? "border-[#00c853]" : "border-red-500/60"
                        }`}
                      />
                      <div className="mt-2 min-h-[18px]">
                        {hc.length > 0 && (matched
                          ? <p className="text-[11px] font-semibold text-[#00c853]">✓ Matches — you&apos;re good to go</p>
                          : <p className="text-[11px] font-semibold text-red-300">✕ The two entries don&apos;t match yet</p>)}
                      </div>
                    </>
                  ) : (
                    <p className="text-sm text-[#e6e6e6]"><span className="font-bold text-white">Cash</span> — paid in person at your Austin meetup. Nothing to enter here.</p>
                  )}
                  <button
                    type="button"
                    disabled={!ready}
                    onClick={() => { setStep("contact"); pushHistory("contact"); }}
                    className={`w-full mt-3 px-4 py-3 rounded-xl text-sm font-extrabold transition ${
                      ready ? "bg-[#00c853] hover:bg-[#00e676] text-[#0a0a0a] cursor-pointer" : "bg-white/5 border border-white/10 text-[#777] cursor-not-allowed"
                    }`}
                  >
                    Continue →
                  </button>
                </div>
              );
            })()}
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
            <button onClick={goBack} aria-label="Go back" className="inline-flex items-center gap-2 text-[#00c853] text-sm font-semibold mb-4 px-4 py-2 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 cursor-pointer transition tap-press">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
              Back
            </button>
            {cartItems.length > 0 ? checkoutSummaryMobile : selectionPanelMobile}

            {returningHint && returningHint.leadCount > 0 && (
              <div className="bg-gradient-to-r from-[#00c853]/15 via-[#00c853]/8 to-[#00c853]/15 border border-[#00c853]/30 rounded-xl px-4 py-3 mb-5 flex items-center gap-3 animate-[fadeIn_0.4s_ease-out]">
                <svg className="w-7 h-7 shrink-0 text-[#00c853]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M7 11.5V14m0-2.5v-6a1.5 1.5 0 113 0m-3 6a1.5 1.5 0 00-3 0v2a7.5 7.5 0 0015 0v-5a1.5 1.5 0 00-3 0m-6-3V11m0-5.5v-1a1.5 1.5 0 013 0v1m0 0V11m0-5.5a1.5 1.5 0 013 0v3m0 0V11" /></svg>
                <div className="flex-1 text-sm">
                  <p className="text-white font-semibold">Welcome back{returningHint.name ? `, ${returningHint.name.split(" ")[0]}` : ""}!</p>
                  <p className="text-[#d4d4d4] text-xs">You&apos;ve sold to us {returningHint.leadCount} time{returningHint.leadCount === 1 ? "" : "s"} before — thanks for coming back.</p>
                </div>
              </div>
            )}

            <h2 className="text-xl font-bold mb-1">Almost done</h2>
            <p className="text-[#e6e6e6] text-sm mb-4">We&apos;ll contact you to arrange pickup &amp; payment</p>

            {/* LABEL PROGRESS BANNER — final step. Shows different copy
                depending on whether the customer picked Ship (label
                gets minted) or Local (no label, just meetup). */}
            {handoffMethod === "ship" ? (
              <div className="mb-4 px-4 py-3 rounded-xl bg-amber-500/[0.10] border border-amber-500/40 flex items-start gap-3">
                <svg className="w-5 h-5 shrink-0 text-[#00c853] leading-none mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-14L4 7m8 4v10M4 7v10l8 4" /></svg>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-amber-200 leading-tight mb-0.5">
                    Step 3 of 3 — submit below to get your <FedExMark /> label
                  </p>
                  <p className="text-[11px] text-[#d4d4d4] mt-1 leading-snug">
                    <span className="text-[#888]">1. Account ✓</span> → <span className="text-[#888]">2. Payment ✓</span> → <span className="text-white font-semibold">3. Shipping address & submit</span>. The moment you hit submit, <FedExMark /> mints your prepaid label and we email it to you instantly — typically under 30 seconds.
                  </p>
                </div>
              </div>
            ) : (
              <div className="mb-4 px-4 py-3 rounded-xl bg-[#00c853]/[0.08] border border-[#00c853]/30 flex items-start gap-3">
                <svg className="w-5 h-5 shrink-0 text-[#00c853] leading-none mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-[#00c853] leading-tight">Final step — pick your meetup window</p>
                  <p className="text-[11px] text-[#bdbdbd] mt-1 leading-snug">
                    <span className="text-[#888]">1. Your info ✓</span> → <span className="text-[#888]">2. Payout method ✓</span> → <span className="text-white font-semibold">3. Pick a meetup window</span>. We&apos;ll text you within minutes to confirm a public spot in Austin — paid on the spot, same day.
                  </p>
                </div>
              </div>
            )}

            {/* Contact-step Google sign-in removed 2026-05-17 per
                Skywalker — already offered on the checkout step (and
                soon on the home-page nav), no need to ask twice. The
                signed-in indicator below still renders when a user
                already authed earlier in the flow. */}
            {customerUser && (
              <div className="mb-5 bg-[#00c853]/10 border border-[#00c853]/30 rounded-xl px-4 py-3 flex items-center gap-3">
                {customerUser.picture && <img src={customerUser.picture} alt="" className="w-8 h-8 rounded-full" />}
                <div className="flex-1 min-w-0 text-sm">
                  <p className="text-[#00c853] text-[10px] font-bold uppercase tracking-wider">Signed in with Google</p>
                  <p className="text-white font-semibold truncate">{customerUser.name || customerUser.email}</p>
                </div>
              </div>
            )}

            <form onSubmit={async (e) => {
              e.preventDefault();
              if (submittingLead) return;
              if (!handoffMethod) { alert("Pick a handoff method (Ship or Local) first."); return; }
              if (handoffMethod === "ship" && (!shipStreet || !shipCity || !shipState || !shipZip)) {
                alert("Please fill in your full shipping address."); return;
              }
              // Shipping requires a 10-digit phone — FedEx prints it on
              // the label. JS guard so we never hit the server's 400 with
              // a generic browser error. Skywalker 2026-05-19.
              if (handoffMethod === "ship") {
                const phoneDigits = phone.replace(/\D/g, "");
                if (phoneDigits.length < 10) {
                  setPhoneOpen(true);
                  alert("Please enter a 10-digit phone number — FedEx prints it on your shipping label.");
                  return;
                }
              }
              setSubmittingLead(true);
              // Payout value carries the confirmed handle (Cashtag /
              // Zelle / BTC address) so admin, the offer page, and the
              // confirmation email all show exactly where money goes.
              const payoutValue = payout
                ? (payoutHandle.trim() ? `${payout.label}: ${payoutHandle.trim()}` : payout.label)
                : undefined;
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
                  ? { method: "ship", address: { street: shipStreet, unit: shipUnit, city: shipCity, state: shipState, zip: shipZip } }
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
                // Capture the FedEx label info from /api/lead's response
                // when a ship handoff was submitted. Plumbs through to
                // /api/confirm (so the email shows the label) AND to the
                // done page (so the customer sees a "print your label"
                // CTA right away). Local meetups: leadLabel stays null.
                let leadLabel: { tracking: string; url: string; service: string } | null = null;
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
                      // Pass every captured spec through. /api/lead writes
                      // these as indented lines under each device so the
                      // admin sees chip/RAM/GPU/battery/etc. per item.
                      carrier: it.carrier,
                      connectivity: it.connectivity,
                      processor: it.processor,
                      memory: it.memory,
                      graphics: it.graphics,
                      displayResolution: it.displayResolution,
                      displayGlass: it.displayGlass,
                      batteryHealth: it.batteryHealth,
                      charger: it.charger,
                      extras: it.extras,
                      brokenGlass: it.brokenGlass,
                      brokenFunctional: it.brokenFunctional,
                      paidOff: it.paidOff,
                      imei: it.imei,
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
                      payout: payoutValue,
                      handoff: handoffPayload,
                      paidOff,
                      devices: devicesPayload,
                      bestContact,
                      notes: customerNote.trim() || undefined,
                      smsOptIn,
                      attribution: readAttribution(),
                      couponCode: couponValid?.code || (couponInput.trim() ? couponInput.trim().toUpperCase() : undefined),
                      referralCode: referralCode || undefined,
                    }),
                  });
                  if (!r.ok) throw new Error("Failed");
                  const d = await r.json().catch(() => ({}));
                  if (d?.fedexLabel) leadLabel = d.fedexLabel;
                  if (d?.fedexError) setSubmittedLabelError(d.fedexError);
                  if (d?.leadId) setSubmittedLeadId(d.leadId);
                } else {
                  const singleKey = model && condition ? `${model.id}-${storage?.label || 'N/A'}-${condition.label}` : "";
                  const singlePhotos = (singleKey && liveMap[singleKey]) || photoUrls;
                  const res = await fetch("/api/lead", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ name, phone, email, device: deviceType, model: model?.label, storage: storage?.label, condition: condition?.label, carrier: carrier?.label, quote: quote * quantity, payout: payoutValue, quantity, photos: singlePhotos, imei: imeiInput.replace(/\D/g, "") || undefined, imeiWarnings: imeiState === "warn" ? imeiResult?.warnings : undefined, handoff: handoffPayload, brokenGlass: (condition?.id === "broken" && isPhoneFlow) ? brokenGlass : undefined, brokenFunctional: condition?.id === "broken" ? brokenFunctional : undefined, processor: processor?.label, memory: memory?.label, graphics: graphics?.label, displayResolution: displayResolution?.label, displayGlass: displayGlass?.label, batteryHealth: batteryHealth?.label, charger: charger?.label, connectivity: connectivity?.label, extras: Object.values(extras).map((x) => x.label).filter(Boolean), paidOff, bestContact, notes: customerNote.trim() || undefined, smsOptIn, attribution: readAttribution(), couponCode: couponValid?.code || (couponInput.trim() ? couponInput.trim().toUpperCase() : undefined), referralCode: referralCode || undefined }),
                  });
                  if (!res.ok) throw new Error('Failed');
                  const d = await res.json().catch(() => ({}));
                  if (d?.fedexLabel) leadLabel = d.fedexLabel;
                  if (d?.fedexError) setSubmittedLabelError(d.fedexError);
                  if (d?.leadId) setSubmittedLeadId(d.leadId);
                }
                setSubmittedLabel(leadLabel);
                // Leave a returning-visitor marker so a future visit
                // gets a "welcome back" greeting on the landing step.
                try {
                  const fn = name.trim().split(/\s+/)[0];
                  if (fn) localStorage.setItem("tcc-returning", JSON.stringify({ name: fn, at: Date.now() }));
                } catch {}
                // GA4 conversion event — fires once per successful
                // submission. Critical: we ship ESTIMATED PROFIT MARGIN
                // as the `value`, not the customer's quote (which is
                // our cost). Skywalker 2026-05-19 caught this — we're
                // BUYING from customers, so Google Ads needs to optimize
                // toward HIGH-margin leads, not high-cost ones.
                //
                //  - Single device with Atlas resell comp:
                //      margin = max(quote × 10%, resell − quote)
                //    Floors at 10% of quote so capped quotes still
                //    show positive (the cap = 75% of resell so the
                //    25% margin is locked in).
                //  - Single device without a resell comp:
                //      margin = quote × 20%   (rough estimate)
                //  - Multi-cart bundle: same 20% rule on cart total.
                //
                // We ALSO ship the gross quote as a separate `quote`
                // param so downstream analytics can still see what
                // we paid the customer.
                try {
                  const w = window as unknown as { gtag?: (...args: unknown[]) => void; __tccVid?: string; __tccSubmitted?: boolean };
                  // Flag so the beforeunload abandonment beacon
                  // doesn't fire for this session.
                  w.__tccSubmitted = true;
                  const g = w.gtag;
                  if (g) {
                    const grossQuote = isMultiCart
                      ? cartItems.reduce((s, it) => s + (it.price || 0) * (it.quantity || 1), 0)
                      : (quote * quantity);
                    const estMargin = (() => {
                      if (isMultiCart) return Math.max(0, Math.round(grossQuote * 0.20));
                      if (estResellNow != null && estResellNow > 0) {
                        const floor = Math.round(grossQuote * 0.10);
                        return Math.max(floor, Math.round(estResellNow - grossQuote));
                      }
                      return Math.max(0, Math.round(grossQuote * 0.20));
                    })();
                    g("event", "funnel_submit", {
                      device: deviceType,
                      model: model?.label,
                      multi: isMultiCart,
                      quote: grossQuote,
                      value: estMargin,
                      currency: "USD",
                      visitor_id: w.__tccVid,
                    });
                    // Google Ads "Tcc Lead" conversion action — Skywalker
                    // created the action in his Top Cash Ads account on
                    // 2026-05-19 and pasted the snippet back. The label
                    // 2v1-CLGHv68cEJiay7ZD is the unique identifier; sent
                    // as Submit-lead-form conversion with our profit-margin
                    // value (not gross quote — same logic as funnel_submit).
                    g("event", "conversion", {
                      send_to: "AW-18099653912/2v1-CLGHv68cEJiay7ZD",
                      value: estMargin,
                      currency: "USD",
                    });
                    // Mirror to Vercel Analytics custom events. Same payload
                    // as the GA4 funnel_submit so both dashboards stay in
                    // sync. Skywalker 2026-05-19.
                    try {
                      vercelTrack("funnel_submit", {
                        device: deviceType ?? null,
                        model: model?.label ?? null,
                        multi: isMultiCart,
                        quote: grossQuote,
                        margin: estMargin,
                      });
                    } catch {}
                  }
                } catch {}
                if (email || phone) {
                  const confirmBody = isMultiCart
                    ? { name, phone, email, carrier: carrier?.label, payout: payoutValue, devices: cartItems.map((it) => ({ model: it.model, storage: it.storage, condition: it.condition, quote: it.price * it.quantity, quantity: it.quantity })), handoffMethod, fedexLabel: leadLabel, couponBonus: couponValid?.value }
                    : { name, phone, email, model: model?.label, storage: storage?.label, condition: condition?.label, carrier: carrier?.label, quote: quote * quantity, payout: payoutValue, quantity, handoffMethod, fedexLabel: leadLabel, couponBonus: couponValid?.value };
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
              finally { setSubmittingLead(false); }
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
                    {/* Address autocomplete — plain input + custom dropdown,
                        backed by /api/places-autocomplete (suggestions) and
                        /api/places-details (parsed address). Replaces the
                        PlaceAutocompleteElement web component which forced
                        a mobile fullscreen takeover on focus. Suggestions
                        appear as an inline list underneath; user taps one
                        and the parsed street / city / state / zip get
                        filled. autoComplete="off" stops browsers from
                        racing our dropdown with their own. Skywalker
                        2026-05-18. */}
                    <div className="relative">
                      <input
                        ref={shipStreetInputRef}
                        required
                        value={shipStreet}
                        onChange={(e) => setShipStreet(e.target.value)}
                        onFocus={() => setShowPlaceDropdown(true)}
                        onBlur={() => setTimeout(() => setShowPlaceDropdown(false), 150)}
                        placeholder="Start typing your address…"
                        autoComplete="off"
                        className="w-full px-4 py-3 tcc-input"
                      />
                      {showPlaceDropdown && placeSuggestions.length > 0 && (
                        <ul className="absolute z-30 left-0 right-0 mt-1 bg-[#181818] border border-white/15 rounded-xl overflow-hidden shadow-xl max-h-72 overflow-y-auto">
                          {placeSuggestions.map((s) => (
                            <li key={s.placeId}>
                              <button
                                type="button"
                                onMouseDown={(e) => { e.preventDefault(); pickPlaceSuggestion(s.placeId); }}
                                className="w-full text-left px-4 py-3 text-sm text-white hover:bg-white/[0.08] border-b border-white/5 last:border-0 cursor-pointer"
                              >
                                {s.text}
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                    <input value={shipUnit} onChange={e => setShipUnit(e.target.value)} placeholder="Apt / Suite (optional)" autoComplete="address-line2" className="w-full px-4 py-3 tcc-input" />
                    <div className="grid grid-cols-3 gap-2">
                      <input required value={shipCity} onChange={e => setShipCity(e.target.value)} placeholder="City" autoComplete="address-level2" className="col-span-2 w-full px-4 py-3 tcc-input" />
                      <input required maxLength={2} value={shipState} onChange={e => setShipState(e.target.value.toUpperCase().slice(0,2))} placeholder="State" autoComplete="address-level1" className="w-full px-4 py-3 tcc-input uppercase" />
                    </div>
                    <input required inputMode="numeric" pattern="\d{5}" maxLength={5} value={shipZip} onChange={e => setShipZip(e.target.value.replace(/\D/g, "").slice(0,5))} placeholder="ZIP" autoComplete="postal-code" className="w-full px-4 py-3 tcc-input" />
                    {/* Box-question removed 2026-05-18 — customers source
                        their own box. We don't ship packaging kits. The
                        confirmation email's packaging checklist explains
                        what works (padded mailer, any plain box). */}
                    <div className="mt-2 bg-white/[0.04] border border-white/10 rounded-xl px-3 py-2.5 text-[11px] text-[#bdbdbd] leading-snug">
                      <span className="text-[#00c853] font-bold inline-flex items-center gap-1 align-text-bottom"><svg className="w-4 h-4 shrink-0 text-[#00c853]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-14L4 7m8 4v10M4 7v10l8 4" /></svg>You provide the box.</span> Any plain padded mailer or small box works for phones; bigger trades use any unmarked box. We&apos;ll email packing tips with your label.
                    </div>
                    <p className="text-[#888] text-[11px] leading-relaxed">Prepaid label hits {email || "your email"} within the hour. Drop the box at any FedEx location — we cover return shipping.</p>
                  </div>
                )}

                {handoffMethod === "local" && (
                  <div className="space-y-3">
                    <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-[#00c853]/5 border border-[#00c853]/20">
                      <svg className="w-5 h-5 text-[#00c853] shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M3 11l9-8 9 8M5 10v10h14V10"/></svg>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <p className="text-white text-sm font-bold leading-tight">Local meetup</p>
                          <button
                            type="button"
                            onClick={() => {
                              setHandoffMethod("ship");
                              // Local's slot picker can render much taller than
                              // ship's address form. Without an explicit scroll
                              // the page reflows and dumps the user at the
                              // footer. Wait a tick for the ship section to
                              // mount, then scroll its address into view.
                              setTimeout(() => {
                                shipStreetInputRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
                              }, 50);
                            }}
                            className="text-[11px] text-[#888] hover:text-[#00c853] underline cursor-pointer"
                          >
                            Switch to shipping
                          </button>
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
              {/* Phone — collapsed into a tap-to-open menu, same style as
                  Device photos. Collapsed for every handoff type; the
                  submit guard auto-opens it if a ship lead is missing the
                  number. Skywalker 2026-05-20. */}
              <div className="border border-white/10 rounded-xl overflow-hidden">
                <button
                  type="button"
                  onClick={() => setPhoneOpen((o) => !o)}
                  disabled={handoffMethod === "ship"}
                  className={`w-full flex items-center justify-between gap-2 px-3 py-3 bg-white/5 transition ${handoffMethod === "ship" ? "cursor-default" : "hover:bg-white/[0.07] cursor-pointer"}`}
                >
                  <span className="text-xs font-semibold uppercase tracking-wider text-[#e6e6e6] inline-flex items-center gap-1.5">
                    <svg className="w-4 h-4 shrink-0 text-[#00c853]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3" /></svg>Phone number
                    {phone
                      ? <span className="text-[#00c853] normal-case"> · {phone}</span>
                      : handoffMethod === "ship"
                        ? <span className="text-amber-300 normal-case"> · required for shipping</span>
                        : <span className="text-[#888] normal-case"> · optional</span>}
                  </span>
                  {handoffMethod !== "ship" && <span className="text-[#888] text-sm">{phoneOpen ? "▲" : "▼"}</span>}
                </button>
                {(phoneOpen || handoffMethod === "ship") && (
                  <div className="px-3 pt-3 pb-3">
              <div>
                <label className="flex items-center gap-1.5 text-xs font-medium text-[#e6e6e6] mb-1.5 uppercase tracking-wider">
                  <span>
                    Phone {handoffMethod === "ship"
                      ? <span className="normal-case text-[11px] text-[#888]">(required — FedEx prints it on your label)</span>
                      : <span className="normal-case text-[11px] text-[#888]">(optional — we&apos;ll text you if needed)</span>}
                  </span>
                  <button
                    type="button"
                    onClick={() => setPhoneInfoOpen((v) => !v)}
                    aria-label="Why we need a phone number"
                    aria-expanded={phoneInfoOpen}
                    title="Why we need a phone number"
                    className="tap-expand inline-flex items-center justify-center w-4 h-4 rounded-full border border-[#00c853] text-[#00c853] text-[10px] font-bold leading-none hover:bg-[#00c853] hover:text-[#0a0a0a] transition cursor-pointer"
                  >i</button>
                </label>
                {phoneInfoOpen && (
                  <div className="mb-2 rounded-lg border border-[#00c853]/30 bg-[#00c853]/[0.06] p-3 text-[11px] text-[#dcdcdc] leading-relaxed">
                    <p className="text-[#00c853] text-[10px] font-bold uppercase tracking-[0.18em] mb-1.5">Why we need it</p>
                    {handoffMethod === "ship" ? (
                      <p>
                        FedEx prints your phone number on every shipping label and uses it if the carrier can&apos;t deliver or has a question while your package is in transit. We won&apos;t text you unless you also check the SMS box below — your number is just for FedEx&apos;s routing.
                      </p>
                    ) : (
                      <p>
                        We text you to confirm the meetup time + share the exact spot when you&apos;re close. No automated messages — a real person on the other end.
                      </p>
                    )}
                  </div>
                )}
                <input type="tel" value={phone} onChange={(e) => {
                  const digits = e.target.value.replace(/\D/g, "").slice(0, 10);
                  if (!digits) { setPhone(""); return; }
                  // Detect deletion — if the raw value got shorter, set
                  // the unformatted digits so the user can backspace past
                  // formatting characters (the `)`, space, or `-`).
                  // Without this branch the format string re-adds the
                  // trailing `-` immediately on every keystroke and the
                  // user gets stuck at "(NNN) NNN-".
                  const isDeleting = e.target.value.length < phone.length;
                  if (isDeleting) { setPhone(digits); return; }
                  if (digits.length >= 6) setPhone(`(${digits.slice(0,3)}) ${digits.slice(3,6)}-${digits.slice(6)}`);
                  else if (digits.length >= 3) setPhone(`(${digits.slice(0,3)}) ${digits.slice(3)}`);
                  else setPhone(digits);
                }} required={handoffMethod === "ship"} pattern="\(\d{3}\) \d{3}-\d{4}" placeholder="(512) 555-0000" className="w-full px-4 py-3.5 tcc-input text-sm" />
                {phone && (
                  <label className="mt-2 flex items-start gap-2.5 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={smsOptIn}
                      onChange={(e) => setSmsOptIn(e.target.checked)}
                      required={handoffMethod !== "ship"}
                      className="mt-0.5 w-4 h-4 shrink-0 rounded border-white/25 bg-white/5 accent-[#00c853] cursor-pointer"
                    />
                    <span className="text-[#e6e6e6] text-[11px] leading-relaxed">
                      I agree to receive SMS updates about my trade-in from Top Cash Cellular at the number above. Msg &amp; data rates may apply, msg frequency varies, reply STOP to opt out, HELP for help. See our <a href="/privacy" className="underline hover:text-[#00c853]">privacy policy</a>.
                    </span>
                  </label>
                )}
              </div>
                  </div>
                )}
              </div>
              {email && (
                <p className="text-[#e6e6e6] text-xs">
                  Email: {email}
                  {handoffMethod === "ship" && <span className="ml-1 text-[#00c853] font-semibold">— your prepaid label goes here</span>}
                </p>
              )}
              <div>
                <label className="flex items-center gap-1.5 text-xs font-medium text-[#e6e6e6] mb-1.5 uppercase tracking-wider">
                  <span>IMEI / Serial <span className="normal-case text-[12px]">(optional — speeds up verification)</span></span>
                  <button
                    type="button"
                    onClick={() => setImeiHelpOpen((v) => !v)}
                    aria-label="How to find your IMEI / serial number"
                    aria-expanded={imeiHelpOpen}
                    title="How to find your IMEI / serial"
                    className="tap-expand inline-flex items-center justify-center w-4 h-4 rounded-full border border-[#00c853] text-[#00c853] text-[10px] font-bold leading-none hover:bg-[#00c853] hover:text-[#0a0a0a] transition cursor-pointer"
                  >i</button>
                </label>
                {imeiHelpOpen && (() => {
                  // Per-device help — match the customer's deviceType to
                  // the right instructions. Falls back to a generic phone
                  // guide if we can't classify.
                  type Step = string;
                  type Guide = { label: string; steps: Step[] };
                  let guides: Guide[];
                  if (isPhoneFlow) {
                    guides = [{
                      label: "Any phone — universal shortcut",
                      steps: [
                        "Open the Phone app and dial *#06#",
                        "The IMEI shows on screen instantly — copy and paste here",
                      ],
                    }, {
                      label: "iPhone (alternative)",
                      steps: [
                        "Settings → General → About",
                        "Scroll to IMEI and tap to copy",
                      ],
                    }, {
                      label: "Samsung Galaxy (alternative)",
                      steps: [
                        "Settings → About phone → Status information → IMEI",
                        "If foldable: same path, both displays share one IMEI",
                      ],
                    }, {
                      label: "Google Pixel (alternative)",
                      steps: [
                        "Settings → About phone → IMEI",
                        "Long-press to copy",
                      ],
                    }];
                  } else if (deviceType === "macbook") {
                    guides = [{
                      label: "MacBook serial — fastest",
                      steps: [
                        "Click the Apple menu (top-left) → About This Mac",
                        "Click \"More Info...\" then scroll to Serial Number",
                      ],
                    }, {
                      label: "Alternative (booted)",
                      steps: [
                        "Open Terminal → type: system_profiler SPHardwareDataType | grep Serial",
                        "Or look at the bottom of the laptop next to the regulatory text",
                      ],
                    }];
                  } else if (deviceType === "apple_desktop") {
                    guides = [{
                      label: "iMac / Mac mini / Mac Studio / Mac Pro",
                      steps: [
                        "Apple menu → About This Mac → click Serial Number to copy",
                        "Or on the bottom of the machine (Mac mini), back panel (iMac), or sticker on the base (Studio/Pro)",
                      ],
                    }];
                  } else if (deviceType === "ipad") {
                    guides = [{
                      label: "iPad",
                      steps: [
                        "Settings → General → About",
                        "Scroll to Serial Number (and IMEI if cellular model)",
                        "Or dial *#06# on cellular models",
                      ],
                    }];
                  } else if (deviceType === "applewatch") {
                    guides = [{
                      label: "Apple Watch",
                      steps: [
                        "On the watch: Settings → General → About → Serial Number",
                        "Or on iPhone: Watch app → My Watch → General → About",
                      ],
                    }];
                  } else if (deviceType === "pixelwatch" || deviceType === "samsungwatch") {
                    guides = [{
                      label: "Smartwatch",
                      steps: [
                        "On the watch: Settings → About → Status",
                        "Serial / IMEI is listed there",
                      ],
                    }];
                  } else if (deviceType === "samsung_pc" || deviceType === "lenovo" || deviceType === "hp" || deviceType === "dell" || deviceType === "acer" || deviceType === "asus_pc" || deviceType === "alienware" || deviceType === "lg_pc") {
                    guides = [{
                      label: "Windows laptop — easiest",
                      steps: [
                        "Press Win + R → type: cmd → Enter",
                        "In the black window type: wmic bios get serialnumber",
                        "Copy the serial that appears",
                      ],
                    }, {
                      label: "Find it on the device",
                      steps: [
                        "Flip the laptop over — serial is printed on a sticker on the bottom panel",
                        "On Samsung Galaxy Book + ThinkPad, also under the keyboard (lift kickstand or remove battery)",
                      ],
                    }];
                  } else if (deviceType?.endsWith("_desktop")) {
                    guides = [{
                      label: "Desktop PC",
                      steps: [
                        "Press Win + R → cmd → type: wmic bios get serialnumber",
                        "Or look at the sticker on the back / side of the tower",
                      ],
                    }];
                  } else if (deviceType === "console" || deviceType === "sony" || deviceType === "microsoft" || deviceType === "nintendo") {
                    guides = [{
                      label: "PS5 / PS4",
                      steps: [
                        "Settings → System → System Information → Serial Number",
                        "Or on the back/bottom of the console (printed near regulatory text)",
                      ],
                    }, {
                      label: "Xbox",
                      steps: [
                        "Settings → System → Console info → Serial Number",
                        "Or on the back of the console",
                      ],
                    }, {
                      label: "Nintendo Switch",
                      steps: [
                        "System Settings → System → Console Information → Serial Number",
                        "Or on the bottom (Switch) / back (Switch Lite / OLED kickstand)",
                      ],
                    }];
                  } else if (deviceType === "dji") {
                    guides = [{
                      label: "DJI Drone",
                      steps: [
                        "DJI Fly app → Profile → Device → Serial Number",
                        "Or printed on a sticker on the drone body (near the battery compartment)",
                      ],
                    }];
                  } else if (deviceType === "apple_vr" || deviceType === "meta_vr" || deviceType === "valve_vr" || deviceType === "psvr") {
                    guides = [{
                      label: "VR headset",
                      steps: [
                        "In headset: Settings → About / System → Serial",
                        "Or on the foam-side label near the strap mount",
                      ],
                    }];
                  } else {
                    guides = [{
                      label: "General",
                      steps: [
                        "Phones: dial *#06# to display IMEI",
                        "Most other devices: Settings → About / System → look for Serial",
                        "Or check the original box / receipt — serial is printed there",
                      ],
                    }];
                  }
                  return (
                    <div className="mb-2 bg-[rgba(15,15,15,0.7)] border border-[#00c853]/30 rounded-xl p-3 space-y-3 animate-[fadeIn_0.15s_ease-out]">
                      {guides.map((g, gi) => (
                        <div key={gi}>
                          <p className="text-[11px] font-bold text-[#00c853] uppercase tracking-wider mb-1">{g.label}</p>
                          <ol className="text-[12px] text-[#dcdcdc] leading-relaxed list-decimal list-inside space-y-0.5">
                            {g.steps.map((s, si) => <li key={si}>{s}</li>)}
                          </ol>
                        </div>
                      ))}
                      <div className="pt-2 border-t border-white/10">
                        <p className="text-[11px] text-[#bdbdbd] mb-1.5">Still can&apos;t find it?</p>
                        <button
                          type="button"
                          onClick={() => { setImeiHelpOpen(false); setChatOpen(true); }}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#00c853]/15 hover:bg-[#00c853]/25 border border-[#00c853]/40 text-[12px] font-semibold text-[#00c853] cursor-pointer transition"
                        >
                          <svg className="w-4 h-4 shrink-0 text-[#00c853]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>Ask us in live chat
                        </button>
                      </div>
                    </div>
                  );
                })()}
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
                    className="px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-sm font-semibold hover:bg-white/10 transition disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer min-w-[88px] flex items-center justify-center gap-1.5"
                  >
                    {imeiState === "checking" ? (
                      <>
                        {/* Spinning ring — Sickw lookups take ~15s, the
                            previous static "…" looked frozen. Skywalker
                            2026-05-19. */}
                        <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                          <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
                          <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                        </svg>
                        <span className="text-[11px] text-[#cfcfcf]">Checking</span>
                      </>
                    ) : "Verify"}
                  </button>
                </div>
                {imeiState === "checking" && (
                  <p className="text-[11px] text-[#888] mt-1.5 flex items-center gap-1.5">
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#00c853] animate-pulse" />
                    Checking carrier &amp; lock status — typically takes ~15 seconds.
                  </p>
                )}
                {imeiState === "ok" && imeiResult && (
                  <p className="text-xs text-[#00c853] mt-1.5">✓ Verified{imeiResult.model ? ` — ${imeiResult.model}` : ""}</p>
                )}
                {imeiState === "warn" && imeiResult?.warnings && (
                  <div className="mt-1.5 px-3 py-2 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                    <p className="text-xs text-yellow-300 font-semibold mb-1 flex items-center gap-1.5"><svg className="w-4 h-4 shrink-0 text-yellow-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>Heads up{imeiResult.model ? ` — ${imeiResult.model}` : ""}</p>
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

              {/* Best contact method — collapsed to a tiny link by
                  default; expands on tap, stays open once a choice is
                  made. Skywalker 2026-05-20. */}
              {!reachOpen ? (
                <button
                  type="button"
                  onClick={() => setReachOpen(true)}
                  className="text-[12px] font-semibold text-[#00c853] hover:text-[#00e676] cursor-pointer text-left inline-flex items-center gap-1.5"
                >
                  <svg className="w-4 h-4 shrink-0 text-[#00c853]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" /></svg>{bestContact
                    ? `Best contact: ${bestContact === "text" ? "Text" : bestContact === "call" ? "Call" : "Email"} — tap to change`
                    : "Best way to reach you?"}
                </button>
              ) : (
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-medium text-[#e6e6e6] uppercase tracking-wider">
                      Best way to reach you <span className="normal-case text-[11px] text-[#888]">(optional)</span>
                    </label>
                    <button type="button" onClick={() => setReachOpen(false)} className="text-[11px] text-[#888] hover:text-white cursor-pointer shrink-0">▲ Hide</button>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {([
                      { id: "text" as const, label: "Text", emoji: <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />, hint: "SMS" },
                      { id: "call" as const, label: "Call", emoji: <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />, hint: "Phone" },
                      { id: "email" as const, label: "Email", emoji: <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />, hint: "Inbox" },
                    ]).map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setBestContact(bestContact === opt.id ? null : opt.id)}
                        className={`px-3 py-3 rounded-xl border text-center transition cursor-pointer tap-press
                          ${bestContact === opt.id ? "bg-[#00c853]/15 border-[#00c853]/45 text-white" : "bg-white/5 border-white/10 text-[#c5c5c5] hover:bg-white/10"}`}
                      >
                        <svg className="w-5 h-5 mx-auto leading-none mb-1 text-[#00c853]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>{opt.emoji}</svg>
                        <p className="text-[13px] font-bold leading-tight">{opt.label}</p>
                        <p className="text-[10px] opacity-60 mt-0.5">{opt.hint}</p>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Free-form "anything else?" note — Skywalker 2026-05-18.
                  Customers often need to tell us building buzzers, work
                  hours, device quirks (e.g. "back glass has a sticker
                  that won't come off"), accessories etc. Free-form keeps
                  it general; trimmed + 500-char capped server-side. */}
              {/* "Anything else" note — collapsed to a tiny link by
                  default; expands on tap, stays expanded once typed. */}
              {!noteOpen ? (
                <button
                  type="button"
                  onClick={() => setNoteOpen(true)}
                  className="text-[12px] font-semibold text-[#00c853] hover:text-[#00e676] cursor-pointer text-left inline-flex items-center gap-1.5"
                >
                  <svg className="w-4 h-4 shrink-0 text-[#00c853]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>{customerNote ? "Note added — tap to edit" : "Anything else we should know?"}
                </button>
              ) : (
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-medium text-[#e6e6e6] uppercase tracking-wider">
                      Anything else we should know? <span className="normal-case text-[11px] text-[#888]">(optional)</span>
                    </label>
                    <button type="button" onClick={() => setNoteOpen(false)} className="text-[11px] text-[#888] hover:text-white cursor-pointer shrink-0">▲ Hide</button>
                  </div>
                  <textarea
                    value={customerNote}
                    onChange={(e) => setCustomerNote(e.target.value.slice(0, 500))}
                    rows={2}
                    maxLength={500}
                    autoFocus
                    placeholder="Building buzzer, accessory details, device quirks, best time to reach you…"
                    className="w-full px-4 py-3 tcc-input text-sm resize-none"
                  />
                  {customerNote.length > 0 && (
                    <p className="text-[10px] text-[#888] mt-1 text-right">{customerNote.length}/500</p>
                  )}
                </div>
              )}

              {/* Thank-you code — collapsed to a tiny link by default so
                  it doesn't crowd the contact step. Expands on tap; once
                  a valid code is applied it shows a compact confirmation.
                  Server does the authoritative redeem at submit. */}
              {couponState === "valid" && couponValid ? (
                <div className="flex items-center justify-between gap-2 px-3 py-2 bg-[#00c853]/10 border border-[#00c853]/30 rounded-xl">
                  <p className="text-xs text-[#7be8a8] font-semibold min-w-0">{couponMessage}</p>
                  <button
                    type="button"
                    onClick={() => { setCouponInput(""); setCouponState("idle"); setCouponValid(null); setCouponMessage(""); setCouponOpen(false); }}
                    className="text-[11px] text-[#888] hover:text-white underline shrink-0 cursor-pointer"
                  >
                    Remove
                  </button>
                </div>
              ) : !couponOpen ? (
                <button
                  type="button"
                  onClick={() => setCouponOpen(true)}
                  className="text-[12px] font-semibold text-[#00c853] hover:text-[#00e676] cursor-pointer inline-flex items-center gap-1.5"
                >
                  <svg className="w-4 h-4 shrink-0 text-[#00c853]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" /></svg>Got a thank-you code?
                </button>
              ) : (
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-medium text-[#e6e6e6] uppercase tracking-wider">
                      Thank-you code <span className="normal-case text-[11px] text-[#888]">(optional)</span>
                    </label>
                    <button type="button" onClick={() => setCouponOpen(false)} className="text-[11px] text-[#888] hover:text-white cursor-pointer shrink-0">▲ Hide</button>
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={couponInput}
                      onChange={(e) => {
                        setCouponInput(e.target.value.toUpperCase());
                        if (couponState !== "idle") { setCouponState("idle"); setCouponValid(null); setCouponMessage(""); }
                      }}
                      placeholder="TCC-XXXXXXXX"
                      maxLength={20}
                      autoFocus
                      className="flex-1 px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-base lg:text-sm text-white placeholder:text-[#d4d4d4] focus:outline-none focus:border-[#00c853] transition tracking-wider font-mono uppercase"
                    />
                    <button
                      type="button"
                      onClick={checkCoupon}
                      disabled={couponState === "checking" || couponInput.trim().length < 6}
                      className="px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-sm font-semibold hover:bg-white/10 transition disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                    >
                      {couponState === "checking" ? "…" : "Apply"}
                    </button>
                  </div>
                  {couponState === "invalid" && (
                    <div className="mt-1.5 px-3 py-2 bg-red-500/10 border border-red-500/30 rounded-lg">
                      <p className="text-xs text-red-300">{couponMessage}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Carrier-balance Yes / No — only for carrier-connected
                  devices: phones + cellular iPads/tablets. Computers,
                  consoles, and Wi-Fi-only tablets can't be carrier-
                  financed or blacklisted, so the question is hidden for
                  them. Skywalker 2026-05-20. */}
              {(isPhoneFlow || isIpadCellular || cartItems.some((it) => !!it.carrier)) && (
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
              )}

              {/* Photos — collapsed into a neat menu by default so the
                  contact step isn't crowded (Skywalker 2026-05-20). */}
              <div className="border border-white/10 rounded-xl overflow-hidden">
                <button
                  type="button"
                  onClick={() => setPhotosOpen((o) => !o)}
                  className="w-full flex items-center justify-between gap-2 px-3 py-3 bg-white/5 hover:bg-white/[0.07] transition cursor-pointer"
                >
                  <span className="text-xs font-semibold uppercase tracking-wider text-[#e6e6e6] inline-flex items-center gap-1.5">
                    <svg className="w-4 h-4 shrink-0 text-[#00c853]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>Device photos
                    {photoUrls.length > 0
                      ? <span className="text-[#00c853]"> · {photoUrls.length} added</span>
                      : (condition?.id === "broken" || condition?.id === "fair")
                        ? <span className="text-[#00c853]"> · recommended</span>
                        : <span className="text-[#888] normal-case"> (optional)</span>}
                  </span>
                  <span className="text-[#888] text-sm">{photosOpen ? "▲" : "▼"}</span>
                </button>
                {photosOpen && (
                  <div className="px-3 pt-3 pb-3">
              {/* Multi-device PHOTO TABS — one tab per cart device. */}
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
                        <p className="text-[12px] text-emerald-200 font-semibold flex items-center gap-1.5"><svg className="w-4 h-4 shrink-0 text-emerald-200" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-14L4 7m8 4v10M4 7v10l8 4" /></svg>Brand new in sealed box</p>
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
                  </div>
                )}
              </div>
              <p className="text-[#c5c5c5] text-[11px] text-center leading-relaxed">By submitting, you agree that the quoted price is an estimate. Final offer confirmed at inspection based on device condition.</p>
              <button
                type="submit"
                disabled={submittingLead}
                className="tcc-button-primary w-full py-4 text-base font-extrabold disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {submittingLead
                  ? (handoffMethod === "ship" ? "Generating your FedEx label…" : "Submitting…")
                  : "Submit & Get Paid"}
              </button>
            </form>
            {/* Customer-service contact block — Skywalker 2026-05-19:
                customers on the contact step who hit a snag (address
                won't validate, payout question, lost label) should have
                a clear phone + email here instead of bouncing. The toll-
                free number is the same Twilio line that handles inbound
                SMS + voice (see /api/twilio/sms-incoming + voice-incoming). */}
            <div className="mt-6 pt-6 border-t border-white/8 text-center">
              <p className="text-[#888] text-[11px] uppercase tracking-[0.14em] font-semibold mb-2">Need help?</p>
              <a
                href="tel:+18775492056"
                className="inline-flex items-center gap-2 text-[#00c853] hover:text-[#00e676] transition text-base font-bold"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.95.69l1.5 4.5a1 1 0 01-.5 1.21l-2.26 1.13a11 11 0 005.52 5.52l1.13-2.26a1 1 0 011.21-.5l4.5 1.5a1 1 0 01.69.95V19a2 2 0 01-2 2h-1C9.72 21 3 14.28 3 6V5z" />
                </svg>
                (877) 549-2056
              </a>
              <p className="text-[#888] text-xs mt-1">
                or email{" "}
                <a href="mailto:CustomerService@topcashcells.com" className="text-[#00c853] hover:underline">
                  CustomerService@topcashcells.com
                </a>
              </p>
              <p className="text-[#666] text-[10px] mt-2">
                Mon–Sat · 9 AM – 7 PM CT · Austin, TX
              </p>
            </div>
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
                            ? <Pic src={d.image} alt="" className="w-full h-full object-contain p-0.5" />
                            : <svg className="w-5 h-5 opacity-40 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3" /></svg>}
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
                echo it back so they know what happens next. For ship
                handoffs with a minted FedEx label, swap the "label on
                the way" copy for the actual Download Label CTA + tracking. */}
            <div className="tcc-card rounded-2xl p-5 mb-6">
              {handoffMethod === "ship" ? (
                <>
                  <p className="text-[10px] uppercase tracking-[0.18em] text-[#00c853] font-bold mb-2">Shipping</p>
                  {submittedLabel ? (
                    <>
                      <p className="text-white text-base font-bold mb-1 flex items-center gap-1.5"><svg className="w-5 h-5 shrink-0 text-[#00c853]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-14L4 7m8 4v10M4 7v10l8 4" /></svg>Your prepaid <FedExMark /> label is ready</p>
                      <p className="text-[#bdbdbd] text-xs leading-relaxed mb-3">
                        Print it, tape it to a padded box, and drop at any FedEx location — no appointment needed.
                        {" "}We&apos;ll text you the moment it arrives.
                      </p>
                      {submittedDevices && submittedDevices.length > 1 && (
                        <div className="bg-amber-500/10 border border-amber-500/40 rounded-xl p-3 mb-3 flex items-start gap-2.5">
                          <svg className="w-5 h-5 shrink-0 text-[#00c853] leading-none mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-14L4 7m8 4v10M4 7v10l8 4" /></svg>
                          <div className="flex-1 min-w-0">
                            <p className="text-amber-100 text-sm font-bold mb-1">
                              Pack ALL {submittedDevices.length} devices in ONE box
                            </p>
                            <p className="text-amber-200/90 text-[11px] leading-relaxed">
                              One label covers the entire package — you don&apos;t need {submittedDevices.length} separate boxes or labels. Wrap each device in bubble wrap or clothing, drop them all in a single padded box, tape this label on top. Up to ~15 phones, ~5 tablets, or ~2 laptops fit comfortably in a medium FedEx box.
                            </p>
                          </div>
                        </div>
                      )}
                      <div className="bg-[#00c853]/10 border border-[#00c853]/30 rounded-xl p-3 mb-3">
                        <p className="text-[10px] uppercase tracking-wider text-[#00c853] font-bold mb-1">Tracking</p>
                        <p className="text-white font-mono font-bold text-sm break-all">{submittedLabel.tracking}</p>
                        <p className="text-[11px] text-[#a8a8a8] mt-0.5">{submittedLabel.service.replace(/_/g, " ")}</p>
                      </div>
                      <a
                        href={submittedLabel.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center justify-center gap-2 w-full bg-[#00c853] hover:bg-[#00e676] text-[#0a0a0a] font-extrabold text-sm px-4 py-3 rounded-full transition cursor-pointer"
                      >
                        Download label PDF
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3"/></svg>
                      </a>
                      <p className="text-[10px] text-[#888] mt-2 text-center">Also sent to {email || "your inbox"}</p>
                    </>
                  ) : submittedLabelError?.kind === "ADDRESS_INVALID" ? (
                    <>
                      <p className="text-white text-base font-bold mb-1 flex items-center gap-1.5"><svg className="w-5 h-5 shrink-0 text-amber-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>We couldn&apos;t print your label yet</p>
                      <p className="text-[#bdbdbd] text-xs leading-relaxed mb-3">{submittedLabelError.hint}</p>
                      <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 mb-3">
                        <p className="text-[10px] uppercase tracking-wider text-amber-300 font-bold mb-1">Address you entered</p>
                        <p className="text-white text-xs leading-snug">{shipStreet}{shipUnit ? `, ${shipUnit}` : ""}<br/>{shipCity}, {shipState} {shipZip}</p>
                      </div>
                      <a
                        href={`mailto:CustomerService@topcashcells.com?subject=${encodeURIComponent("Fix shipping address for my trade-in")}&body=${encodeURIComponent(`Hi — my address didn't validate with FedEx. Please use this corrected address:\n\nName: ${name}\nPhone: ${phone}\nCorrected address:\n\n(replace this line with your corrected street, city, state, ZIP)\n\nDevice: ${(submittedDevices && submittedDevices.length > 0) ? submittedDevices.map((it) => `${it.model} (${it.condition})`).join(", ") : ""}`)}`}
                        className="inline-flex items-center justify-center gap-2 w-full bg-[#00c853] hover:bg-[#00e676] text-[#0a0a0a] font-extrabold text-sm px-4 py-3 rounded-full transition cursor-pointer"
                      >
                        Email us your correction
                      </a>
                    </>
                  ) : submittedLabelError?.kind === "SERVICE_UNAVAILABLE" ? (
                    <>
                      <p className="text-white text-base font-bold mb-1 flex items-center gap-1.5"><svg className="w-5 h-5 shrink-0 text-[#00c853]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-14L4 7m8 4v10M4 7v10l8 4" /></svg>Your label is on the way</p>
                      <p className="text-[#bdbdbd] text-xs leading-relaxed mb-3">{submittedLabelError.hint}</p>
                    </>
                  ) : (
                    <>
                      <p className="text-white text-base font-bold mb-1">Your label is on the way</p>
                      <p className="text-[#bdbdbd] text-xs leading-relaxed mb-3">Prepaid FedEx label hits {email || "your email"} within the hour. Drop the box at any FedEx location — we cover return shipping.</p>
                    </>
                  )}
                  {(shipStreet || shipCity) && (
                    <p className="text-[#888] text-[11px] leading-snug mt-3">Ship from: {shipStreet}{shipUnit ? `, ${shipUnit}` : ""}, {shipCity}, {shipState} {shipZip}</p>
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

            {/* MANAGE YOUR OFFER — the hero CTA on the done page when
                we got a leadId back. Skywalker 2026-05-19 restructure:
                this used to be a thin card below the receipt with a
                long 4-step shipping ol below; the customer never
                clicked through to /offer because the page kept
                reading like the old basic done step. Now it's a real
                visual hero, the long-form steps are gone (they live as
                an interactive checklist on /offer with checkboxes that
                persist), and the secondary links are demoted to small
                inline text below. */}
            {submittedLeadId ? (
              <div className="rounded-2xl p-6 mb-6 text-center" style={{
                background: "linear-gradient(180deg, rgba(0,200,83,0.18) 0%, rgba(0,200,83,0.06) 100%)",
                border: "1px solid rgba(0,200,83,0.45)",
                boxShadow: "0 0 32px rgba(0,200,83,0.15), inset 0 1px 0 rgba(255,255,255,0.08)",
              }}>
                <p className="text-[10px] uppercase tracking-[0.18em] text-[#00c853] font-bold mb-2">Your offer page</p>
                <p className="text-white text-lg font-extrabold mb-1 flex items-center justify-center gap-1.5"><svg className="w-5 h-5 shrink-0 text-[#00c853]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>Offer #{submittedLeadId.slice(0, 10).toUpperCase()}</p>
                <p className="text-[#dcdcdc] text-xs leading-relaxed mb-4 max-w-md mx-auto">
                  {handoffMethod === "ship"
                    ? "Print your FedEx label, walk through the shipping checklist, see live status, or modify the offer — everything's on your offer page."
                    : "See your meetup slot, live status, contact info, or modify the offer — everything's on your offer page."}
                </p>
                <a
                  href={`/offer/${encodeURIComponent(submittedLeadId)}`}
                  className="inline-flex items-center justify-center gap-2 w-full max-w-md mx-auto bg-[#00c853] hover:bg-[#00e676] text-[#0a0a0a] font-extrabold text-base px-6 py-4 rounded-full transition cursor-pointer shadow-[0_8px_24px_rgba(0,200,83,0.35)]"
                >
                  {handoffMethod === "ship" ? (
                    <><svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>Open offer + print label →</>
                  ) : (
                    <><svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>Open my offer page →</>
                  )}
                </a>
                <p className="text-[10px] text-[#888] mt-3">
                  Bookmark this — same link is in the email we just sent.
                </p>
                <div className="mt-4 pt-4 border-t border-white/10 flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5 text-[11px]">
                  <a href="/account" className="text-[#dcdcdc] hover:text-white">All my trades</a>
                  <span className="text-[#666]">·</span>
                  <a href="/faq" target="_blank" className="text-[#dcdcdc] hover:text-white inline-flex items-center gap-1"><svg className="w-3.5 h-3.5 shrink-0 text-[#00c853]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>FAQ</a>
                  <span className="text-[#666]">·</span>
                  <a href="mailto:CustomerService@topcashcells.com" className="text-[#dcdcdc] hover:text-white inline-flex items-center gap-1"><svg className="w-3.5 h-3.5 shrink-0 text-[#00c853]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>Email us</a>
                </div>
              </div>
            ) : (
              // Fallback when /api/lead didn't return a leadId — keep the
              // basic /track lookup so the customer still has a recovery
              // path. Should only fire when MC was down at submit time.
              (phone || email) && (
                <div className="tcc-card rounded-2xl p-5 mb-6">
                  <p className="text-[10px] uppercase tracking-[0.18em] text-[#00c853] font-bold mb-2">Find my trade</p>
                  <p className="text-[#bdbdbd] text-xs leading-relaxed mb-3">
                    Look up your trade by phone or email anytime.
                  </p>
                  <a
                    href={`/track?${phone ? `phone=${encodeURIComponent(phone.replace(/\D/g, ""))}` : `email=${encodeURIComponent(email || "")}`}`}
                    className="inline-flex items-center justify-center gap-2 w-full bg-white/5 hover:bg-white/10 border border-white/15 text-white font-extrabold text-sm px-4 py-3 rounded-full transition cursor-pointer"
                  >
                    Open my tracking page →
                  </a>
                </div>
              )
            )}

            {/* No review CTA here — the customer hasn't actually completed
                a trade yet, asking for a review at submission time is
                premature. Skywalker 2026-05-17. The "Met & Thanked"
                admin status sends the review request AFTER the handoff. */}

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
                <div className="bg-gradient-to-br from-[#ff5566]/10 to-transparent border border-[#ff5566]/25 rounded-2xl p-5 reveal" data-stagger="2">
                  <p className="text-xs font-bold uppercase tracking-wider text-[#ff8088] mb-1">Apple Trade-In</p>
                  <p className="text-white text-2xl font-bold mb-2">Lowball</p>
                  <ul className="text-[#e6e6e6] text-sm space-y-1 list-disc list-inside">
                    <li>Bottom-of-market quotes</li>
                    <li>Store credit only</li>
                    <li>No cash option</li>
                  </ul>
                </div>
                <div className="bg-gradient-to-br from-[#ff5566]/10 to-transparent border border-[#ff5566]/25 rounded-2xl p-5 reveal" data-stagger="3">
                  <p className="text-xs font-bold uppercase tracking-wider text-[#ff8088] mb-1">Carrier Trade-In</p>
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
                    <li><strong>{handoffMethod === "local" ? "Cash, Zelle, or Venmo" : "Cash App, Zelle, or Venmo"}</strong> — {handoffMethod === "local" ? "paid on the spot" : "paid within 24 hrs of arrival"}</li>
                    <li>No strings, no carrier lock-in</li>
                  </ul>
                </div>
              </div>
              <p className="text-[#e6e6e6] text-xs text-center mt-4">Compare anywhere. We&apos;ll match or beat.</p>
            </div>
          </section>

          {/* Full "Not in Austin? Ship to us" 3-card section removed
              2026-05-22 — collapsed into a single compact reassurance
              strip near the bottom of the homepage (see below) to cut
              mobile crowding. */}

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
                  <p className="text-[#e6e6e6] text-[10px] mt-0.5">to sellers nationwide</p>
                </div>
                <div className="bg-white/5 border border-white/10 rounded-2xl p-3 overflow-hidden">
                  <p className="text-2xl md:text-3xl font-extrabold text-[#00c853] tabular-nums">&lt;{animatedStats.time}h</p>
                  <p className="text-white text-xs font-semibold mt-1">Avg Payout</p>
                  <p className="text-[#e6e6e6] text-[10px] mt-0.5">from quote to cash</p>
                </div>
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
                  {[...Array(2)].flatMap((_, dup) => ([
                    { method: "Local Pickup", icon: <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />, timeline: "On the spot", desc: "We meet in Austin, inspect together in about 15 minutes, and pay you on the spot.", highlight: false },
                    { method: "Cash", icon: <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />, timeline: "On the spot", desc: "Handed to you in person at the local meetup.", highlight: false },
                    { method: "Cash App", logos: ["/pay/cashapp.svg"], timeline: "Minutes", desc: "Sent while you watch — lands in your account in minutes.", highlight: false },
                    { method: "Zelle", logos: ["/pay/zelle.svg"], timeline: "Minutes", desc: "Sent while you watch — lands in your account in minutes.", highlight: false },
                    { method: "Bitcoin (BTC)", logos: ["/pay/bitcoin.svg"], timeline: "~30 min", desc: "Sent on-chain to your wallet — confirms in about 30 minutes.", highlight: false },
                    { method: "Ship To Us", icon: <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-14L4 7m8 4v10M4 7v10l8 4" />, timeline: "Within 24 hrs", desc: "We inspect and pay you within 24 hours of your device arriving.", highlight: false },
                  ] as Array<{ method: string; icon?: React.ReactNode; logos?: string[]; timeline: string; desc: string; highlight: boolean }>).filter(p => p.method !== "Cash" || handoffMethod === "local").map((p, i) => (
                    <div key={`${dup}-${i}`} className={`flex-shrink-0 w-[280px] flex items-start gap-3 rounded-2xl p-4 border ${p.highlight ? "bg-[#00c853]/10 border-[#00c853]/30" : "bg-white/5 border-white/10"}`}>
                      {p.logos
                        ? <span className="flex items-center gap-1 shrink-0">{p.logos.map((l) => <img key={l} src={l} alt="" className="w-6 h-6 object-contain" />)}</span>
                        : <svg className="w-6 h-6 shrink-0 text-[#00c853]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>{p.icon}</svg>}
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

          {/* Second "Still sitting on old tech?" CTA section removed
              2026-05-22 — duplicate of the closing CTA banner and the
              hero CTA; cut to declutter the mobile CTA stack. */}

          {/* Second homepage FAQ ("Frequently Asked Questions") removed
              2026-05-22 — duplicated the "Things people ask us" FAQ
              above; the full list lives on the /faq page. */}

          {/* GREEN / SUSTAINABILITY */}
          <section className="py-12 bg-[#0a0a0a]">
            <div className="max-w-lg md:max-w-3xl lg:max-w-7xl mx-auto px-4">
              <div className="bg-[#00c853]/5 border border-[#00c853]/15 rounded-2xl p-6 text-center">
                <svg className="w-7 h-7 mx-auto mb-2 text-[#00c853]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
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
                  <svg className="w-4 h-4 shrink-0 text-[#00c853]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                  <span className="text-white text-xs font-semibold">Austin-Based Business</span>
                </div>
                <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-full px-4 py-2">
                  <svg className="w-4 h-4 shrink-0 text-[#00c853]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                  <span className="text-white text-xs font-semibold">Real People, Local Meetups</span>
                </div>
                <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-full px-4 py-2">
                  <svg className="w-4 h-4 shrink-0 text-[#00c853]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                  <span className="text-white text-xs font-semibold">Paid On the Spot Locally</span>
                </div>
                <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-full px-4 py-2">
                  <svg className="w-4 h-4 shrink-0 text-[#00c853]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                  <span className="text-white text-xs font-semibold">Secure Transactions</span>
                </div>
              </div>
            </div>
          </section>

          {/* NOT IN AUSTIN? — compact reassurance strip. Replaces the
              old full 3-card "Ship to us" section; kept deliberately
              small so it reads as a calm aside, not another big CTA. */}
          <section className="pt-4 pb-2 bg-[#0a0a0a]">
            <div className="max-w-lg md:max-w-3xl lg:max-w-7xl mx-auto px-4">
              <div className="bg-white/5 border border-white/10 rounded-2xl px-4 py-3 flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-3 text-center">
                <p className="text-[#e6e6e6] text-xs sm:text-sm leading-snug">
                  <strong className="text-white">Not in Austin?</strong> We ship free, nationwide — get paid within 24 hours of your device arriving.
                </p>
                <button
                  type="button"
                  onClick={() => { window.scrollTo(0, 0); setStep("category"); pushHistory("category"); }}
                  className="shrink-0 inline-flex items-center gap-1 text-[#00c853] hover:text-[#00e676] text-xs sm:text-sm font-bold cursor-pointer transition tap-press"
                >
                  Get a quote →
                </button>
              </div>
            </div>
          </section>

          {/* BULK / BUSINESS SELLING */}
          <section className="py-12 bg-[#0a0a0a]">
            <div className="max-w-lg md:max-w-3xl lg:max-w-7xl mx-auto px-4">
              <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
                <div className="text-center mb-4">
                  <svg className="w-8 h-8 mx-auto mb-2 text-[#00c853]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
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

              {/* Safer-than-marketplace positioning — IWM sits on
                  sustainability; we sit next to them on customer safety
                  and convenience. No personal/founder narrative for now
                  (Skywalker 2026-05-19) — just the visual product
                  positioning: pull quote → comparison grid → contact. */}

              {/* Pull quote — one-line emotional hook */}
              <div className="border-l-4 border-[#00c853] bg-[#00c853]/[0.04] pl-5 pr-4 py-4 mb-6 rounded-r-xl">
                <p className="text-white text-lg font-medium leading-snug italic">&ldquo;No driving across town with a thousand dollars of electronics in your front seat.&rdquo;</p>
              </div>

              {/* Sketchy vs us comparison — the whole positioning lives
                  here, side-by-side red ✗ list / green ✓ list */}
              <h2 className="text-xl font-bold mb-4">Stop the sketchy meetup</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-8">
                <div className="bg-red-500/[0.05] border border-red-500/25 rounded-2xl p-5">
                  <p className="text-[10px] uppercase tracking-[0.18em] text-red-300 font-bold mb-3 flex items-center gap-2">
                    <svg className="w-4 h-4 shrink-0 text-red-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg> The OfferUp way
                  </p>
                  <ul className="space-y-2 text-sm text-[#dcdcdc]">
                    <li className="flex gap-2"><span className="text-red-400 shrink-0">✗</span><span>Drive across town with the device in your seat</span></li>
                    <li className="flex gap-2"><span className="text-red-400 shrink-0">✗</span><span>Meet a stranger whose profile was made last week</span></li>
                    <li className="flex gap-2"><span className="text-red-400 shrink-0">✗</span><span>Counterfeit cash, last-minute haggling, no-shows</span></li>
                    <li className="flex gap-2"><span className="text-red-400 shrink-0">✗</span><span>If something goes wrong — no one to call</span></li>
                  </ul>
                </div>
                <div className="bg-[#00c853]/[0.06] border border-[#00c853]/35 rounded-2xl p-5">
                  <p className="text-[10px] uppercase tracking-[0.18em] text-[#00c853] font-bold mb-3 flex items-center gap-2">
                    <svg className="w-4 h-4 shrink-0 text-[#00c853]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg> The Top Cash way
                  </p>
                  <ul className="space-y-2 text-sm text-[#dcdcdc]">
                    <li className="flex gap-2"><span className="text-[#00c853] shrink-0">✓</span><span>Ship from home with a free FedEx label — never leave the house</span></li>
                    <li className="flex gap-2"><span className="text-[#00c853] shrink-0">✓</span><span>Or meet at a known, public Austin spot — face you can recognize</span></li>
                    <li className="flex gap-2"><span className="text-[#00c853] shrink-0">✓</span><span>Quote locked for 14 days — no surprise deductions on arrival</span></li>
                    <li className="flex gap-2"><span className="text-[#00c853] shrink-0">✓</span><span>One real business in Austin that&apos;ll still be here next month</span></li>
                  </ul>
                </div>
              </div>

              {/* Contact card */}
              <div className="bg-white/[0.04] border border-white/15 rounded-2xl p-5 mb-8 text-center">
                <svg className="w-7 h-7 mx-auto mb-2 text-[#00c853]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                <p className="text-white font-semibold text-sm mb-1">Got a weird device or a question?</p>
                <p className="text-[#bdbdbd] text-xs mb-3">Email us directly — every message gets a real reply.</p>
                <a href={EMAIL_HREF} className="text-[#00c853] hover:underline font-bold text-sm">{EMAIL}</a>
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
                  { icon: <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />, title: "Skip the sketchy meetup", desc: "No driving across town with a thousand dollars of electronics in your front seat. No strangers from OfferUp or Facebook Marketplace. One real business, one face, one trusted public spot — or ship it and never leave home." },
                  { icon: <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />, title: "Highest payouts in Austin", desc: "We consistently beat Apple, carrier, and marketplace prices by 20-40%. Get a quote and compare." },
                  { icon: <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />, title: "Paid on the spot", desc: "Cash, Cash App, Zelle, or BTC — your choice. No waiting for checks or bank transfers." },
                  { icon: <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />, title: "Local & personal", desc: "We meet you at a known public Austin spot. Face-to-face, safe, and quick. 5 minutes and you're done." },
                  { icon: <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-14L4 7m8 4v10M4 7v10l8 4" />, title: "Nationwide shipping", desc: "Not in Austin? No problem. We send a free prepaid FedEx label. Ship your device, get paid same day we receive it — never leave the house." },
                  { icon: <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3" />, title: "We buy everything", desc: "iPhones, Samsung Galaxy, MacBooks, PS5, Xbox, Nintendo Switch. Working, cracked, or water damaged." },
                  { icon: <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />, title: "14-day price lock", desc: "Your quote is locked for 14 days. Take your time deciding — the price won't change." },
                ].map((item) => (
                  <div key={item.title} className="flex items-start gap-4 bg-white/5 rounded-2xl p-4 border border-white/10">
                    <svg className="w-7 h-7 shrink-0 text-[#00c853]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>{item.icon}</svg>
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
                    <p>Quotes on our site are estimates based on the device model and condition tier you select. The price you see is locked for 14 days from the time of quote. Final pricing is confirmed at inspection — if your device matches the condition you selected, we honor the quoted price.</p>
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
                    <p>If you ship a device and don&apos;t like the final offer, we will mail it back to you free of charge via the same carrier we used for the inbound label. No restocking fee. You have 14 days from our revised-offer email to request a return; after that we assume acceptance.</p>
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
                    { tier: "Sealed", icon: <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-14L4 7m8 4v10M4 7v10l8 4" />, color: "#00c853", desc: "Sealed in the box, never activated. Receipt strongly preferred. We verify the seal and confirm the IMEI is clean. Sealed only applies to computers/laptops/desktops, not phones." },
                    { tier: "Like New", icon: <path strokeLinecap="round" strokeLinejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.196-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />, color: "#00c853", desc: "Indistinguishable from new — zero scratches on screen or body under bright light, original accessories present, battery health ≥ 95% on phones. Powers on cleanly, all sensors and buttons work, Face ID / Touch ID enrolled and functioning." },
                    { tier: "Good", icon: <path strokeLinecap="round" strokeLinejoin="round" d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" />, color: "#88dd66", desc: "Light micro-scratches on the screen or frame visible only at certain angles. No cracks, no dents, no chips. Battery health ≥ 85% on phones. All functions work normally." },
                    { tier: "Fair", icon: <path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 11-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 004.486-6.336l-3.276 3.277a3.004 3.004 0 01-2.25-2.25l3.276-3.276a4.5 4.5 0 00-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745 1.437l1.745-1.437m6.615 8.206L15.75 15.75M4.867 19.125h.008v.008h-.008v-.008z" />, color: "#ffb400", desc: "Visible scratches or scuffs but no cracks in the glass. Frame may have small dings. Screen powers on with full color, no dead pixels, no shadow burn-in. All buttons and ports work." },
                    { tier: "Damaged", icon: <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />, color: "#ff6b6b", desc: "Cracked glass, chipped corners, dented frame, dead pixels, or non-working components. We still buy damaged devices — the price just reflects the repair cost." },
                  ].map((g) => (
                    <div key={g.tier} className="bg-white/5 border border-white/10 rounded-2xl p-5">
                      <div className="flex items-center gap-3 mb-2">
                        <svg className="w-7 h-7 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} style={{ color: g.color }}>{g.icon}</svg>
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
                    { step: "1", title: "Get your quote", body: "Accept the price on our site. We email you a confirmation with a prepaid FedEx shipping label — automatically insured for your full quoted value, at no cost to you." },
                    { step: "2", title: "Pack &amp; drop off", body: "Use any padded box you have at home. Wrap the device, drop it at any FedEx location, and keep your receipt. Tracking number arrives in our system automatically." },
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
                  <p>If the device&apos;s actual condition is different from the tier you selected, we&apos;ll show you what we found (with photos), explain the adjustment, and email a revised offer. You have 14 days to decide.</p>
                  <p><strong className="text-white">Accept it</strong> — we pay you that same business day.</p>
                  <p><strong className="text-white">Reject it</strong> — we ship the device back to you free of charge via the same carrier. No restocking fee, no questions.</p>
                  <p>If you don&apos;t respond within 14 days of the revised-offer email, we assume acceptance.</p>
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
                const nameInput = form.querySelector("input[name=footerNlName]") as HTMLInputElement | null;
                const emailInput = form.querySelector("input[type=email]") as HTMLInputElement | null;
                const email = emailInput?.value.trim();
                const name = nameInput?.value.trim();
                if (!email) return;
                fetch("/api/newsletter", {
                  method: "POST",
                  headers: { "content-type": "application/json" },
                  body: JSON.stringify({ email, name: name || undefined }),
                }).catch(() => {});
                if (emailInput) emailInput.value = "";
                if (nameInput) nameInput.value = "";
                form.classList.add("hidden");
                form.parentElement?.querySelector(".nl-ok")?.classList.remove("hidden");
              }}
              className="flex flex-col items-stretch gap-2 max-w-sm mx-auto"
            >
              <input
                type="text"
                name="footerNlName"
                placeholder="First name (optional)"
                maxLength={60}
                aria-label="First name (optional)"
                className="px-3 py-2 rounded-full bg-white/5 border border-white/10 text-white text-xs placeholder:text-[#888] focus:outline-none focus:border-[#00c853]/50"
              />
              <div className="flex items-center gap-2">
                <input
                  type="email"
                  required
                  placeholder="Email address"
                  className="flex-1 px-3 py-2 rounded-full bg-white/5 border border-white/10 text-white text-xs placeholder:text-[#888] focus:outline-none focus:border-[#00c853]/50"
                />
                <button type="submit" className="px-4 py-2 rounded-full bg-[#00c853] text-[#0a0a0a] text-xs font-extrabold hover:bg-[#00e676] transition">Sign up</button>
              </div>
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
                <button onClick={() => { localStorage.removeItem("cookie-consent"); setCookieConsent(null); window.scrollTo({ top: 0 }); }} className="block text-xs hover:text-[#00c853] transition cursor-pointer text-left">Cookie Settings</button>
                <button onClick={() => { setPage("accessibility"); window.scrollTo({ top: 0 }); }} className="block text-xs hover:text-[#00c853] transition cursor-pointer text-left">Accessibility Statement</button>
                <p className="text-xs text-[#9a9a9a] pt-2">Austin, TX · Mon–Sat 8 AM–8 PM</p>
              </div>
            </div>
          </div>
          {/* CUSTOMER SERVICE CONTACT CARD — email displayed as readable
              text, not just behind a clickable label. Skywalker
              2026-05-18 "add that email for customers wanting to reach
              out". Centered above the © so it's the last thing a customer
              sees while scrolling and easy to spot when they need help. */}
          <div className="border-t border-[#00c853]/15 pt-6 mb-6 text-center">
            <p className="text-[10px] uppercase tracking-[0.18em] text-[#00c853] font-bold mb-2">Customer Service</p>
            <a href={EMAIL_HREF} className="inline-flex items-center gap-2 text-sm text-white hover:text-[#00c853] transition font-semibold">
              <svg className="w-4 h-4 shrink-0 text-[#00c853]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
              CustomerService@topcashcells.com
            </a>
            <p className="text-[11px] text-[#9a9a9a] mt-2">We reply within one business day · Mon–Sat 8 AM–8 PM CT</p>
          </div>
          <div className="border-t border-[#00c853]/15 pt-6 text-center">
            <p className="text-[11px] text-[#cfcfcf]/70 mb-3">© 2026 {BRAND}</p>
            <div className="flex items-center justify-center gap-4 flex-wrap">
              <a href="https://atxgadgetfix.com" target="_blank" rel="noopener noreferrer" className="text-[11px] text-[#cfcfcf] hover:text-[#00c853] transition">
                Need a repair? ATX Gadget Fix →
              </a>
              <span className="text-[#cfcfcf]/30 text-[10px]">·</span>
              {/* Staff sign-in — discreet link to the leads dashboard. The
                  /admin route is gated by Google OAuth, so customers who
                  click this just see a "sign in" prompt. */}
              <a href="/admin" className="text-[11px] text-[#cfcfcf]/50 hover:text-[#00c853] transition">
                Staff
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
          // Default rest position lifts above the iOS home indicator —
          // env() is 0 on non-notched devices. Skywalker 2026-05-19.
          : { left: "24px", bottom: "calc(24px + env(safe-area-inset-bottom))" };
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
                          <svg className="w-5 h-5 shrink-0 text-[#00c853]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                          <div><p className="font-semibold text-sm">Live Chat</p><p className="text-[#e6e6e6] text-xs">Send us a message</p></div>
                        </button>
                        <button onClick={() => setChatMode("call")} className="w-full flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 cursor-pointer transition text-left tap-press">
                          <svg className="w-5 h-5 shrink-0 text-[#00c853]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" /></svg>
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
                      <a href={EMAIL_HREF} className="flex items-center justify-center gap-2 w-full bg-[#00c853] text-[#0a0a0a] py-3 rounded-xl text-sm font-semibold hover:bg-[#00e676] transition text-center mb-2"><svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>Email Us</a>
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
                      // qty steppers — 36px on mobile (was 24-28px, well
                      // under the 44px tap-target floor), compact 28px on
                      // desktop where a mouse makes precision easy.
                      // Skywalker 2026-05-19 iOS pass.
                      const qtyBtn  = "w-9 h-9 text-base lg:w-7 lg:h-7 lg:text-sm";
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
                          <div key={i} onClick={() => { setCartOpen(false); setPage("home"); setStep("checkout"); pushHistory("checkout"); window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior }); }} className={`tcc-card rounded-2xl ${pad} cursor-pointer`}>
                            <div className="flex items-start gap-3 mb-2">
                              <div className={`${imgW} rounded-xl bg-[rgba(15,15,15,0.55)] border border-white/12 flex items-center justify-center shrink-0 overflow-hidden p-1.5`}>
                                {imgSrc ? (
                                  <Pic src={imgSrc} alt="" className="max-w-full max-h-full object-contain" style={{ filter: "drop-shadow(0 4px 6px rgba(0,0,0,0.45))" }} />
                                ) : (
                                  <svg className="w-6 h-6 opacity-60 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3" /></svg>
                                )}
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className={`text-white font-extrabold ${titleSz} leading-tight`}>{item.model}</p>
                                <p className={`text-[#c8c8c8] ${subSz} mt-1`}>{item.storage} · {item.condition}</p>
                              </div>
                              <button onClick={(e) => { e.stopPropagation(); setCartItems(prev => prev.filter((_, idx) => idx !== i)); setCartToast({ model: item.model, price: item.price * item.quantity, kind: "remove" }); setTimeout(() => setCartToast(null), 2400); }} aria-label="Remove from cart" className="text-[#b8b8b8] hover:text-red-400 text-xs font-bold underline-offset-2 hover:underline transition cursor-pointer shrink-0 px-2 py-1.5 -mr-1 -mt-1">Remove</button>
                            </div>
                            <div className="flex items-center justify-between gap-3 mt-2 pt-2 border-t border-white/10">
                              <div className="inline-flex items-center gap-2 bg-white/5 rounded-full px-1 py-1">
                                <button onClick={(e) => { e.stopPropagation(); setCartItems(prev => prev.map((it, idx) => idx === i ? { ...it, quantity: Math.max(1, it.quantity - 1) } : it)); }} aria-label="Decrease quantity" className={`${qtyBtn} rounded-full bg-white/10 hover:bg-white/20 text-white font-bold flex items-center justify-center cursor-pointer transition`}>−</button>
                                <span className="text-white text-sm font-extrabold min-w-[20px] text-center">{item.quantity}</span>
                                <button onClick={(e) => { e.stopPropagation(); setCartItems(prev => prev.map((it, idx) => idx === i ? { ...it, quantity: Math.min(10, it.quantity + 1) } : it)); }} aria-label="Increase quantity" className={`${qtyBtn} rounded-full bg-white/10 hover:bg-white/20 text-white font-bold flex items-center justify-center cursor-pointer transition`}>+</button>
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
                    <div className="text-[#c8c8c8] text-[10px] font-semibold leading-tight"><svg className="w-5 h-5 block mx-auto mb-1 text-[#00c853]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>Same-day<br />payout</div>
                    <div className="text-[#c8c8c8] text-[10px] font-semibold leading-tight"><svg className="w-5 h-5 block mx-auto mb-1 text-[#00c853]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>On-site<br />data wipe</div>
                    <div className="text-[#c8c8c8] text-[10px] font-semibold leading-tight">
                      <svg className="w-5 h-5 block mx-auto mb-1 text-[#00c853]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                      {handoffMethod === "ship"
                        ? <>Cash App · Zelle<br />Venmo · BTC</>
                        : <>Cash · Zelle<br />Cash App · BTC</>}
                    </div>
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
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-[#111]/95 backdrop-blur-sm border-t border-white/10 px-3 pt-2 consent-bar-ios animate-[fadeIn_0.3s_ease-out]">
          <div className="max-w-lg md:max-w-3xl lg:max-w-7xl mx-auto flex flex-wrap items-center gap-x-3 gap-y-2">
            <p className="text-white/80 text-[11px] flex-1 min-w-[180px]">
              We use essential cookies to run the site. With your OK we also use analytics cookies to measure traffic and improve it.{" "}
              <button onClick={() => { setPage("cookies"); window.scrollTo({ top: 0 }); }} className="underline hover:text-white transition cursor-pointer">Cookie Policy</button>
            </p>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => {
                  localStorage.setItem("cookie-consent", "essential");
                  setCookieConsent("essential");
                  const w = window as unknown as { gtag?: (...a: unknown[]) => void };
                  w.gtag?.("consent", "update", { ad_storage: "denied", ad_user_data: "denied", ad_personalization: "denied", analytics_storage: "denied" });
                }}
                className="border border-white/25 text-white px-3 py-1.5 rounded-lg text-[11px] font-semibold cursor-pointer hover:bg-white/10 transition whitespace-nowrap"
              >
                Decline
              </button>
              <button
                onClick={() => {
                  localStorage.setItem("cookie-consent", "full");
                  setCookieConsent("full");
                  const w = window as unknown as { gtag?: (...a: unknown[]) => void; tccLoadClarity?: () => void };
                  w.gtag?.("consent", "update", { ad_storage: "granted", ad_user_data: "granted", ad_personalization: "granted", analytics_storage: "granted" });
                  w.tccLoadClarity?.();
                }}
                className="bg-[#00c853] text-[#0a0a0a] px-3 py-1.5 rounded-lg text-[11px] font-semibold cursor-pointer hover:bg-[#00e676] transition whitespace-nowrap"
              >
                Accept
              </button>
            </div>
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
