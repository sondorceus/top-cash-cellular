"use client";
import { useState, useEffect, useCallback, useRef } from "react";

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

const IPHONE_SERIES = [
  // Bases refreshed 2026-05-11 against the Atlas weekly sheet. Rule:
  // base = (sheet Open / Unlocked / max-storage price - \$175) / max_storage_mult.
  // Net ceiling on each variant lands ~\$150-200 below Atlas's max payout —
  // our margin per device. topPrice mirrors the new base for the legacy
  // marquee display.
  { id: "17", label: "iPhone 17", image: "/iphone17.png", year: "2025", topPrice: 929, variants: [
    { id: "ip17pm", label: "iPhone 17 Pro Max", base: 929, image: "/devices/iphone-17-pro-max-test.png" },
    { id: "ip17p", label: "iPhone 17 Pro", base: 707, image: "/devices/iphone-17-pro-test.png" },
    { id: "ip17air", label: "iPhone 17 Air", base: 489, image: "/devices/iphone-17-air-test.png" },
    { id: "ip17", label: "iPhone 17", base: 428, image: "/devices/iphone-17-test.png" },
    { id: "ip17e", label: "iPhone 17E", base: 212, image: "/iphone17e.png" },
  ]},
  { id: "16", label: "iPhone 16", image: "/iphone16.png", year: "2024", topPrice: 629, variants: [
    { id: "ip16pm", label: "iPhone 16 Pro Max", base: 629, image: "/devices/iphone-16-pro-max-test.png" },
    { id: "ip16p", label: "iPhone 16 Pro", base: 525, image: "/devices/bm/iphone-16-pro.png" },
    { id: "ip16plus", label: "iPhone 16 Plus", base: 324, image: "/devices/iphone-16-plus-test.png" },
    { id: "ip16", label: "iPhone 16", base: 276, image: "/devices/bm/iphone-16.png" },
    { id: "ip16e", label: "iPhone 16E", base: 204, image: "/devices/iphone-16e-test.png" },
  ]},
  { id: "15", label: "iPhone 15", image: "/iphone15.png", year: "2023", topPrice: 290, variants: [
    { id: "ip15pm", label: "iPhone 15 Pro Max", base: 290, image: "/devices/bm/iphone-15-pro-max.png" },
    { id: "ip15p", label: "iPhone 15 Pro", base: 235, image: "/devices/bm/iphone-15-pro.png" },
    { id: "ip15plus", label: "iPhone 15 Plus", base: 180, image: "/devices/bm/iphone-15-plus.png" },
    { id: "ip15", label: "iPhone 15", base: 160, image: "/devices/bm/iphone-15.png" },
  ]},
  { id: "14", label: "iPhone 14", image: "/iphone14.png", year: "2022", topPrice: 170, variants: [
    { id: "ip14pm", label: "iPhone 14 Pro Max", base: 170, image: "/devices/bm/iphone-14-pro-max.png" },
    { id: "ip14p", label: "iPhone 14 Pro", base: 140, image: "/devices/bm/iphone-14-pro.png" },
    { id: "ip14plus", label: "iPhone 14 Plus", base: 110, image: "/devices/bm/iphone-14-plus.png" },
    { id: "ip14", label: "iPhone 14", base: 100, image: "/devices/bm/iphone-14.png" },
  ]},
  { id: "13", label: "iPhone 13", image: "/iphone13.png", year: "2021", topPrice: 130, variants: [
    { id: "ip13pm", label: "iPhone 13 Pro Max", base: 130, image: "/devices/bm/iphone-13-pro-max.png" },
    { id: "ip13p", label: "iPhone 13 Pro", base: 100, image: "/devices/bm/iphone-13-pro.png" },
    { id: "ip13", label: "iPhone 13", base: 75, image: "/devices/bm/iphone-13.png" },
  ]},
  { id: "12", label: "iPhone 12", image: "/iphone12.png", year: "2020", topPrice: 130, variants: [
    { id: "ip12pm", label: "iPhone 12 Pro Max", base: 130, image: "/devices/bm/iphone-12-pro-max.png" },
    { id: "ip12p", label: "iPhone 12 Pro", base: 110, image: "/devices/bm/iphone-12-pro.png" },
    { id: "ip12", label: "iPhone 12", base: 80, image: "/devices/bm/iphone-12.png" },
    { id: "ip12mini", label: "iPhone 12 Mini", base: 60, image: "/devices/bm/iphone-12-mini.png" },
  ]},
  { id: "11", label: "iPhone 11", image: "/iphone11.png", year: "2019", topPrice: 100, variants: [
    { id: "ip11pm", label: "iPhone 11 Pro Max", base: 100, image: "/devices/bm/iphone-11-pro-max.png" },
    { id: "ip11p", label: "iPhone 11 Pro", base: 85, image: "/devices/bm/iphone-11-pro.png" },
    { id: "ip11", label: "iPhone 11", base: 60, image: "/devices/bm/iphone-11.png" },
  ]},
];

// 2026-05-12: Skywalker said 'copy IWM Samsung prices, lower ours by
// $20'. Subtracted $20 from every Samsung base (S / Z / Note) so we
// undercut IWM by an extra $20 on top of the existing IWM-calibrated
// margin. $10 floor so older FE / Flip 3 / Note 9 don't go to zero.
const SAMSUNG_SERIES = [
  { id: "sseries", label: "S Series", year: "Galaxy S20–S26", topPrice: 490, image: "/s-series.png", variants: [
    { id: "gs26u", label: "Galaxy S26 Ultra", base: 490, image: "/devices/gs26u.png" },
    { id: "gs25u", label: "Galaxy S25 Ultra", base: 310, image: "/devices/gs25u.png" },
    { id: "gs24u", label: "Galaxy S24 Ultra", base: 440, image: "/devices/gs24u.png" },
    { id: "gs23u", label: "Galaxy S23 Ultra", base: 280, image: "/devices/gs23u.png" },
    { id: "gs22u", label: "Galaxy S22 Ultra", base: 160, image: "/devices/gs22u.png" },
    { id: "gs21u", label: "Galaxy S21 Ultra", base: 110, image: "/devices/gs21u.png" },
    { id: "gs20u", label: "Galaxy S20 Ultra", base: 60, image: "/devices/gs20u.png" },
    { id: "gs25edge", label: "Galaxy S25 Edge", base: 100, image: "/devices/gs25edge.png" },
    { id: "gs26p", label: "Galaxy S26+", base: 255, image: "/devices/gs26p.png" },
    { id: "gs25p", label: "Galaxy S25+", base: 190, image: "/devices/gs25p.png" },
    { id: "gs24p", label: "Galaxy S24+", base: 220, image: "/devices/gs24p.png" },
    { id: "gs23p", label: "Galaxy S23+", base: 170, image: "/devices/gs23p.png" },
    { id: "gs22p", label: "Galaxy S22+", base: 95, image: "/devices/gs22p.png" },
    { id: "gs21p", label: "Galaxy S21+", base: 45, image: "/devices/gs21p.png" },
    { id: "gs20p", label: "Galaxy S20+", base: 50, image: "/devices/gs20p.png" },
    { id: "gs26", label: "Galaxy S26", base: 180, image: "/devices/gs26.png" },
    { id: "gs25", label: "Galaxy S25", base: 105, image: "/devices/gs25.png" },
    { id: "gs24", label: "Galaxy S24", base: 150, image: "/devices/gs24.png" },
    { id: "gs23", label: "Galaxy S23", base: 100, image: "/devices/gs23.png" },
    { id: "gs22", label: "Galaxy S22", base: 50, image: "/devices/gs22.png" },
    { id: "gs21", label: "Galaxy S21", base: 20, image: "/devices/gs21.png" },
    { id: "gs20", label: "Galaxy S20", base: 15, image: "/devices/gs20.png" },
    { id: "gs25fe", label: "Galaxy S25 FE", base: 75, image: "/devices/gs25fe.png" },
    { id: "gs24fe", label: "Galaxy S24 FE", base: 60, image: "/devices/gs24fe.png" },
    { id: "gs23fe", label: "Galaxy S23 FE", base: 30, image: "/devices/gs23fe.png" },
    { id: "gs21fe", label: "Galaxy S21 FE", base: 10, image: "/devices/gs21fe.png" },
    { id: "gs20fe", label: "Galaxy S20 FE", base: 10, image: "/devices/gs20fe.png" },
  ]},
  { id: "zseries", label: "Z Series", year: "Z Fold + Z Flip + TriFold", topPrice: 1455, image: "/fold-series.webp", variants: [
    { id: "gztrifold", label: "Galaxy Z TriFold", base: 1455, image: "/devices/gztrifold.png" },
    { id: "gzfold7", label: "Galaxy Z Fold 7", base: 610, image: "/devices/gzfold7.png" },
    { id: "gzfold6", label: "Galaxy Z Fold 6", base: 305, image: "/devices/gzfold6.png" },
    { id: "gzfold5", label: "Galaxy Z Fold 5", base: 144, image: "/devices/gzfold5.png" },
    { id: "gzfold4", label: "Galaxy Z Fold 4", base: 56,  image: "/devices/gzfold4.png" },
    { id: "gzfold3", label: "Galaxy Z Fold 3", base: 40,  image: "/devices/gzfold3.png" },
    { id: "gzflip7", label: "Galaxy Z Flip 7", base: 140, image: "/devices/gzflip7.png" },
    { id: "gzflip6", label: "Galaxy Z Flip 6", base: 84,  image: "/devices/gzflip6.png" },
    { id: "gzflip5", label: "Galaxy Z Flip 5", base: 28,  image: "/devices/gzflip5.png" },
    { id: "gzflip4", label: "Galaxy Z Flip 4", base: 20,  image: "/devices/gzflip4.png" },
    { id: "gzflip3", label: "Galaxy Z Flip 3", base: 10,  image: "/devices/gzflip3.png" },
  ]},
  { id: "noteseries", label: "Note Series", year: "Note 9 / 10 / 20", topPrice: 180, image: "/devices/gnote20u.png", variants: [
    { id: "gnote20u", label: "Galaxy Note 20 Ultra 5G", base: 180, image: "/devices/gnote20u.png" },
    { id: "gnote20", label: "Galaxy Note 20 5G", base: 110, image: "/devices/gnote20.png" },
    { id: "gnote10p5g", label: "Galaxy Note 10+ 5G", base: 90, image: "/devices/gnote10p5g.png" },
    { id: "gnote10p", label: "Galaxy Note 10+", base: 70, image: "/devices/gnote10p.png" },
    { id: "gnote10", label: "Galaxy Note 10", base: 50, image: "/devices/gnote10.png" },
    { id: "gnote9", label: "Galaxy Note 9", base: 20, image: "/devices/gnote9.png" },
  ]},
];

const PIXEL_SERIES = [
  { id: "pproseries", label: "Pro Series", year: "Pixel 6 Pro–10 Pro XL", topPrice: 530, image: "/pixel-pro-series.webp", variants: [
    { id: "px10pxl", label: "Pixel 10 Pro XL", base: 530, image: "/devices/px10pxl.webp" },
    { id: "px10p", label: "Pixel 10 Pro", base: 440, image: "/devices/px10p.webp" },
    { id: "px9pxl", label: "Pixel 9 Pro XL", base: 375, image: "/devices/pixel-9-pro-xl.webp" },
    { id: "px9p", label: "Pixel 9 Pro", base: 305, image: "/devices/pixel-9-pro.webp" },
    { id: "px8p", label: "Pixel 8 Pro", base: 240, image: "/devices/pixel-8-pro.webp" },
    { id: "px7p", label: "Pixel 7 Pro", base: 85, image: "/devices/pixel-7-pro.webp" },
    { id: "px6p", label: "Pixel 6 Pro", base: 50, image: "/devices/pixel-6-pro.webp" },
  ]},
  { id: "pstandard", label: "Standard Series", year: "Pixel 5–10 + a-series", topPrice: 325, image: "/pixel-standard-series.webp", variants: [
    { id: "px10", label: "Pixel 10", base: 325, image: "/devices/px10.webp" },
    { id: "px10a", label: "Pixel 10a", base: 145, image: "/devices/px10a.webp" },
    { id: "px9", label: "Pixel 9", base: 185, image: "/devices/pixel-9.webp" },
    { id: "px9a", label: "Pixel 9a", base: 135, image: "/devices/pixel-9a.webp" },
    { id: "px8", label: "Pixel 8", base: 120, image: "/devices/pixel-8.webp" },
    { id: "px8a", label: "Pixel 8a", base: 90, image: "/devices/pixel-8a.webp" },
    { id: "px7", label: "Pixel 7", base: 45, image: "/devices/pixel-7.webp" },
    { id: "px7a", label: "Pixel 7a", base: 10, image: "/devices/pixel-7a.webp" },
    { id: "px6", label: "Pixel 6", base: 40, image: "/devices/pixel-6.webp" },
    { id: "px6a", label: "Pixel 6a", base: 30, image: "/devices/pixel-6a.webp" },
    { id: "px5", label: "Pixel 5", base: 50, image: "/devices/px5.webp" },
    { id: "px5a", label: "Pixel 5a (5G)", base: 30, image: "/devices/px5a.webp" },
  ]},
  { id: "pfoldseries", label: "Fold Series", year: "Pixel Fold lineup", topPrice: 755, image: "/pixel-fold-series.webp", variants: [
    { id: "px10pfold", label: "Pixel 10 Pro Fold", base: 755, image: "/devices/px10pfold.webp" },
    { id: "px9pfold", label: "Pixel 9 Pro Fold", base: 575, image: "/devices/px9pfold.webp" },
    { id: "pxfold", label: "Pixel Fold", base: 280, image: "/devices/pxfold.webp" },
  ]},
];

const MACBOOK_PRO_MODELS = [
  // Bases rebased 2026-05-11 against Atlas Mobile price sheet for MacBook
  // — formula: Atlas's lowest 'Open' variant per model line minus $250
  // (midpoint of Skywalker's $200-$300 rule). Older models (M3, M2 Pro/13,
  // M1 Pro) are NOT on Atlas — left at prior bases pending comp study.
  { id: "mbp16_m5pmax_2026", label: "MacBook Pro 16\" M5 Pro/Max (2026)", base: 1640, image: "/devices/macbook-pro-m4.webp" }, // Atlas $1,890
  { id: "mbp14_m5pmax_2026", label: "MacBook Pro 14\" M5 Pro/Max (2026)", base: 1260, image: "/devices/macbook-pro-m4.webp" }, // Atlas $1,510
  { id: "mbp14_m5_2025", label: "MacBook Pro 14\" M5 (2025)", base: 985, image: "/devices/macbook-pro-m4.webp" }, // Atlas $1,235
  { id: "mbp16m4", label: "MacBook Pro 16\" M4 (2024)", base: 1375, image: "/devices/macbook-pro-m4.webp" }, // Atlas $1,625, was 1200
  { id: "mbp14m4", label: "MacBook Pro 14\" M4 (2024)", base: 725, image: "/devices/macbook-pro-m4.webp" }, // Atlas $975, was 1000 (we were overpaying)
  // Models below NOT on Atlas — bases set against competition ceilings
  // (IWM / Decluttr / Backflip avg ~10-20% above Apple Trade-In) minus
  // \$250 per Skywalker's rule. 2026-05-11.
  { id: "mbp16m3", label: "MacBook Pro 16\" M3 (2023)", base: 800, image: "/devices/macbook-pro-m3.webp" }, // comp ~\$1,050, was 950
  { id: "mbp14m3", label: "MacBook Pro 14\" M3 (2023)", base: 600, image: "/devices/macbook-pro-m3.webp" }, // comp ~\$850, was 800
  { id: "mbp16m2", label: "MacBook Pro 16\" M2 (2023)", base: 570, image: "/devices/macbook-pro-m2.webp" }, // comp ~\$820, was 750
  { id: "mbp14m2", label: "MacBook Pro 14\" M2 (2023)", base: 420, image: "/devices/macbook-pro-m2.webp" }, // comp ~\$670, was 650
  { id: "mbp13m1", label: "MacBook Pro 13\" M1 (2020)", base: 170, image: "/devices/macbook-pro-m1.webp" }, // comp ~\$420, was 400
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
  { id: "mba_m5_2026", label: "MacBook Air M5 (13\" & 15\", 2026)", base: 625, image: "/devices/macbook-air-m3.webp" }, // Atlas avg M5 13/15 - 250
  // Competition-anchored (IWM/Decluttr avg) minus \$250 — Atlas didn't list these.
  { id: "mba15m3", label: "MacBook Air 15\" M3 (2024)", base: 510, image: "/devices/macbook-air-m3.webp" }, // comp ~\$760, was 700
  { id: "mba13m3", label: "MacBook Air 13\" M3 (2024)", base: 345, image: "/devices/macbook-air-m3.webp" }, // comp ~\$595, was 600
  { id: "mba15m2", label: "MacBook Air 15\" M2 (2023)", base: 310, image: "/devices/macbook-air-m2.webp" }, // comp ~\$560, was 550
  { id: "mba13m2", label: "MacBook Air 13\" M2 (2022)", base: 280, image: "/devices/macbook-air-m2.webp" }, // Atlas $530, was 480
  { id: "mba13m1", label: "MacBook Air 13\" M1 (2020)", base: 200, image: "/devices/macbook-air-m1.webp" }, // Atlas $450, was 350
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
  { id: "mbneo13", label: "MacBook Neo 13\" (A18 Pro, 2026)", base: 175 }, // Atlas 256GB $425 - $250
];
const MACBOOK_CLASSIC_MODELS = [
  { id: "mb12_2017", label: "MacBook 12\" (2017)", base: 0, inquiryOnly: true },
  { id: "mb12_2016", label: "MacBook 12\" (2016)", base: 0, inquiryOnly: true },
  { id: "mb12_2015", label: "MacBook 12\" (2015)", base: 0, inquiryOnly: true },
];
// Mirrors IWM's MacBook categories: Pro, Air, Neo (new A-chip line),
// classic 12-inch.
const MACBOOK_SERIES = [
  { id: "mbpro", label: "MacBook Pro", year: "M1–M5", topPrice: 1640, image: "/macbook-pro-series.webp", variants: MACBOOK_PRO_MODELS },
  { id: "mbair", label: "MacBook Air", year: "M1–M5", topPrice: 700, image: "/macbook-air-series.webp", variants: MACBOOK_AIR_MODELS },
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
  { id: "ln_tp_x1_carbon", label: "ThinkPad X1 Carbon", base: 0, inquiryOnly: true, image: "/devices/lenovo-thinkpad-tp_x1-lenovo-thinkpad-x1-carbon.png" },
  { id: "ln_tp_x1_extreme", label: "ThinkPad X1 Extreme", base: 0, inquiryOnly: true, image: "/devices/lenovo-thinkpad-tp_x1-lenovo-thinkpad-x1-extreme.png" },
  { id: "ln_tp_x1_fold", label: "ThinkPad X1 Fold", base: 0, inquiryOnly: true, image: "/devices/lenovo-thinkpad-tp_x1-lenovo-thinkpad-x1-fold.png" },
  { id: "ln_tp_x1_nano", label: "ThinkPad X1 Nano", base: 0, inquiryOnly: true, image: "/devices/lenovo-thinkpad-tp_x1-lenovo-thinkpad-x1-nano.png" },
  { id: "ln_tp_x1_yoga", label: "ThinkPad X1 Yoga", base: 0, inquiryOnly: true, image: "/devices/lenovo-thinkpad-tp_x1-lenovo-thinkpad-x1-yoga.png" },
  { id: "ln_tp_x1_2in1", label: "ThinkPad X1 2-in-1", base: 0, inquiryOnly: true, image: "/devices/lenovo-thinkpad-tp_x1-lenovo-thinkpad-x1-2-in-1.png" },
  { id: "ln_tp_x1_titanium_yoga", label: "ThinkPad X1 Titanium Yoga", base: 0, inquiryOnly: true, image: "/devices/lenovo-thinkpad-tp_x1-lenovo-thinkpad-x1-titanium-yoga.png" },
];
const LENOVO_TP_X13_VARIANTS = [
  { id: "ln_tp_x13", label: "ThinkPad X13", base: 0, inquiryOnly: true, image: "/devices/lenovo-thinkpad-tp_x13-lenovo-thinkpad-x13.png" },
  { id: "ln_tp_x13_yoga", label: "ThinkPad X13 Yoga", base: 0, inquiryOnly: true, image: "/devices/lenovo-thinkpad-tp_x13-lenovo-thinkpad-x13-yoga.png" },
  { id: "ln_tp_x13_2in1", label: "ThinkPad X13 2-in-1", base: 0, inquiryOnly: true, image: "/devices/lenovo-thinkpad-tp_x13-lenovo-thinkpad-x13-2-in-1.png" },
  { id: "ln_tp_x13s", label: "ThinkPad X13s", base: 0, inquiryOnly: true, image: "/devices/lenovo-thinkpad-tp_x13-lenovo-thinkpad-x13s.png" },
];
const LENOVO_TP_X390_VARIANTS = [
  { id: "ln_tp_x390", label: "ThinkPad X390", base: 0, inquiryOnly: true, image: "/devices/ln_tp_x390.png" },
  { id: "ln_tp_x390_yoga", label: "ThinkPad X390 Yoga", base: 0, inquiryOnly: true, image: "/devices/ln_tp_x390_yoga.png" },
];
const LENOVO_TP_X9_VARIANTS = [
  { id: "ln_tp_x9_14", label: "ThinkPad X9 14", base: 0, inquiryOnly: true, image: "/devices/ln_tp_x9_14.png" },
  { id: "ln_tp_x9_15", label: "ThinkPad X9 15", base: 0, inquiryOnly: true, image: "/devices/ln_tp_x9_15.png" },
];
const LENOVO_TP_Z_VARIANTS = [
  { id: "ln_tp_z16", label: "ThinkPad Z16", base: 0, inquiryOnly: true, image: "/devices/lenovo-thinkpad-tp_z-lenovo-thinkpad-z16.png" },
  { id: "ln_tp_z13", label: "ThinkPad Z13", base: 0, inquiryOnly: true, image: "/devices/lenovo-thinkpad-tp_z-lenovo-thinkpad-z13.png" },
];
const LENOVO_TP_P_VARIANTS = [
  { id: "ln_tp_p43", label: "ThinkPad P43", base: 0, inquiryOnly: true, image: "/devices/lenovo-thinkpad-tp_p-lenovo-thinkpad-p43.png" },
  { id: "ln_tp_p50", label: "ThinkPad P50", base: 0, inquiryOnly: true, image: "/devices/lenovo-thinkpad-tp_p-lenovo-thinkpad-p50.png" },
  { id: "ln_tp_p51", label: "ThinkPad P51", base: 0, inquiryOnly: true, image: "/devices/lenovo-thinkpad-tp_p-lenovo-thinkpad-p51.png" },
  { id: "ln_tp_p52", label: "ThinkPad P52", base: 0, inquiryOnly: true, image: "/devices/lenovo-thinkpad-tp_p-lenovo-thinkpad-p52.png" },
  { id: "ln_tp_p53", label: "ThinkPad P53", base: 0, inquiryOnly: true, image: "/devices/lenovo-thinkpad-tp_p-lenovo-thinkpad-p53.png" },
  { id: "ln_tp_p70", label: "ThinkPad P70", base: 0, inquiryOnly: true, image: "/devices/lenovo-thinkpad-tp_p-lenovo-thinkpad-p70.png" },
  { id: "ln_tp_p71", label: "ThinkPad P71", base: 0, inquiryOnly: true, image: "/devices/lenovo-thinkpad-tp_p-lenovo-thinkpad-p71.png" },
  { id: "ln_tp_p72", label: "ThinkPad P72", base: 0, inquiryOnly: true, image: "/devices/lenovo-thinkpad-tp_p-lenovo-thinkpad-p72.png" },
  { id: "ln_tp_p73", label: "ThinkPad P73", base: 0, inquiryOnly: true, image: "/devices/lenovo-thinkpad-tp_p-lenovo-thinkpad-p73.png" },
];
const LENOVO_TP_L_VARIANTS = [
  { id: "ln_tp_l13", label: "ThinkPad L13 Series", base: 0, inquiryOnly: true, image: "/devices/lenovo-thinkpad-tp_l-lenovo-thinkpad-l13-series.png" },
  { id: "ln_tp_l14", label: "ThinkPad L14 Series", base: 0, inquiryOnly: true, image: "/devices/lenovo-thinkpad-tp_l-lenovo-thinkpad-l14-series.png" },
  { id: "ln_tp_l15", label: "ThinkPad L15 Series", base: 0, inquiryOnly: true, image: "/devices/lenovo-thinkpad-tp_l-lenovo-thinkpad-l15-series.png" },
  { id: "ln_tp_l16", label: "ThinkPad L16 Series", base: 0, inquiryOnly: true, image: "/devices/lenovo-thinkpad-tp_l-lenovo-thinkpad-l16-series.png" },
];
const LENOVO_TP_T_VARIANTS = [
  { id: "ln_tp_t", label: "ThinkPad T-Series", base: 0, inquiryOnly: true, image: "/devices/ln_tp_t.png" },
];
const LENOVO_TP_E_VARIANTS = [
  { id: "ln_tp_e14_g7", label: "ThinkPad E14 Gen 7", base: 0, inquiryOnly: true, image: "/devices/ln_tp_e14_g7.png" },
  { id: "ln_tp_e14_g6", label: "ThinkPad E14 Gen 6", base: 0, inquiryOnly: true, image: "/devices/ln_tp_e14_g6.png" },
  { id: "ln_tp_e14_g5", label: "ThinkPad E14 Gen 5", base: 0, inquiryOnly: true, image: "/devices/ln_tp_e14_g5.png" },
  { id: "ln_tp_e15", label: "ThinkPad E15", base: 0, inquiryOnly: true, image: "/devices/ln_tp_e15.png" },
  { id: "ln_tp_e16_g3", label: "ThinkPad E16 Gen 3", base: 0, inquiryOnly: true, image: "/devices/ln_tp_e16_g3.png" },
  { id: "ln_tp_e16_g2", label: "ThinkPad E16 Gen 2", base: 0, inquiryOnly: true, image: "/devices/ln_tp_e16_g2.png" },
  { id: "ln_tp_e16_g1", label: "ThinkPad E16 Gen 1", base: 0, inquiryOnly: true, image: "/devices/ln_tp_e16_g1.png" },
];
const LENOVO_THINKPAD_SUB_SERIES = [
  { id: "ln_tp_x1", label: "ThinkPad X1", year: "Premium ultrabook", topPrice: 0, variants: LENOVO_TP_X1_VARIANTS, inquiryOnly: true, image: "/devices/lenovo-thinkpad-tp_x1-lenovo-thinkpad-x1-carbon.png" },
  { id: "ln_tp_x13", label: "ThinkPad X13", year: "13-inch business", topPrice: 0, variants: LENOVO_TP_X13_VARIANTS, inquiryOnly: true, image: "/devices/lenovo-thinkpad-tp_x13-lenovo-thinkpad-x13.png" },
  { id: "ln_tp_x390", label: "ThinkPad X390", year: "Legacy 13.3-inch", topPrice: 0, variants: LENOVO_TP_X390_VARIANTS, inquiryOnly: true, image: "/devices/ln_tp_x390.png" },
  { id: "ln_tp_x9", label: "ThinkPad X9", year: "Aura Edition", topPrice: 0, variants: LENOVO_TP_X9_VARIANTS, inquiryOnly: true, image: "/devices/ln_tp_x9_14.png" },
  { id: "ln_tp_z", label: "ThinkPad Z", year: "Modern design", topPrice: 0, variants: LENOVO_TP_Z_VARIANTS, inquiryOnly: true, image: "/devices/lenovo-thinkpad-tp_z-lenovo-thinkpad-z16.png" },
  { id: "ln_tp_t_sub", label: "ThinkPad T", year: "Workhorse business", topPrice: 0, variants: LENOVO_TP_T_VARIANTS, inquiryOnly: true, image: "/devices/ln_tp_t.png" },
  { id: "ln_tp_p", label: "ThinkPad P", year: "Mobile workstation", topPrice: 0, variants: LENOVO_TP_P_VARIANTS, inquiryOnly: true, image: "/devices/lenovo-thinkpad-tp_p-lenovo-thinkpad-p51.png" },
  { id: "ln_tp_l", label: "ThinkPad L", year: "Mainstream business", topPrice: 0, variants: LENOVO_TP_L_VARIANTS, inquiryOnly: true, image: "/devices/lenovo-thinkpad-tp_l-lenovo-thinkpad-l14-series.png" },
  { id: "ln_tp_e_sub", label: "ThinkPad E", year: "Essential business", topPrice: 0, variants: LENOVO_TP_E_VARIANTS, inquiryOnly: true, image: "/devices/ln_tp_e14_g7.png" },
];

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
const LENOVO_THINKBOOK_SUB_SERIES = [
  { id: "ln_tb_13", label: "ThinkBook 13", year: "13-inch", topPrice: 0, variants: LENOVO_TB_13_VARIANTS, inquiryOnly: true, image: "/devices/ln_tb_13x.png" },
  { id: "ln_tb_14", label: "ThinkBook 14", year: "14-inch", topPrice: 0, variants: LENOVO_TB_14_VARIANTS, inquiryOnly: true, image: "/devices/lenovo-thinkbook-tb_14-lenovo-thinkbook-14-series.png" },
  { id: "ln_tb_15", label: "ThinkBook 15", year: "15-inch", topPrice: 0, variants: LENOVO_TB_15_VARIANTS, inquiryOnly: true, image: "/devices/ln_tb_15.png" },
  { id: "ln_tb_16", label: "ThinkBook 16", year: "16-inch", topPrice: 0, variants: LENOVO_TB_16_VARIANTS, inquiryOnly: true, image: "/devices/ln_tb_16.png" },
];

const LENOVO_IDEAPAD_VARIANTS = [
  { id: "ln_ideapad_5", label: "IdeaPad 5", base: 0, inquiryOnly: true, image: "/devices/lenovo-ideapad-lenovo-ideapad-5.png" },
  { id: "ln_ideapad_3", label: "IdeaPad 3", base: 0, inquiryOnly: true, image: "/devices/lenovo-ideapad-lenovo-ideapad-3.png" },
  { id: "ln_ideapad_3i", label: "IdeaPad 3i", base: 0, inquiryOnly: true, image: "/devices/lenovo-ideapad-lenovo-ideapad-3i.png" },
  { id: "ln_ideapad_5i_2in1", label: "IdeaPad 5i 2-in-1", base: 0, inquiryOnly: true, image: "/devices/lenovo-ideapad-lenovo-ideapad-5i-2-in-1.png" },
  { id: "ln_ideapad_flex_5", label: "IdeaPad Flex 5", base: 0, inquiryOnly: true, image: "/devices/lenovo-ideapad-lenovo-ideapad-flex-5.png" },
  { id: "ln_ideapad_flex_5i", label: "IdeaPad Flex 5i", base: 0, inquiryOnly: true, image: "/devices/lenovo-ideapad-lenovo-ideapad-flex-5i.png" },
  { id: "ln_ideapad_slim_7", label: "IdeaPad Slim 7", base: 0, inquiryOnly: true, image: "/devices/lenovo-ideapad-lenovo-ideapad-slim-7.png" },
  { id: "ln_ideapad_gaming_3", label: "IdeaPad Gaming 3", base: 0, inquiryOnly: true, image: "/devices/lenovo-ideapad-lenovo-ideapad-gaming-3.png" },
  { id: "ln_ideapad_gaming_3i", label: "IdeaPad Gaming 3i", base: 0, inquiryOnly: true, image: "/devices/lenovo-ideapad-lenovo-ideapad-gaming-3i.png" },
  { id: "ln_ideapad_330s", label: "IdeaPad 330s", base: 0, inquiryOnly: true, image: "/devices/lenovo-ideapad-lenovo-ideapad-330s.png" },
  { id: "ln_ideapad_l340", label: "IdeaPad L340", base: 0, inquiryOnly: true, image: "/devices/lenovo-ideapad-lenovo-ideapad-l340.png" },
  { id: "ln_ideapad_s340", label: "IdeaPad S340", base: 0, inquiryOnly: true, image: "/devices/lenovo-ideapad-lenovo-ideapad-s340.png" },
  { id: "ln_ideapad_s540", label: "IdeaPad S540", base: 0, inquiryOnly: true, image: "/devices/lenovo-ideapad-lenovo-ideapad-s540.png" },
];

const LENOVO_LEGION_VARIANTS = [
  { id: "ln_legion_9i", label: "Legion 9i", base: 0, inquiryOnly: true, image: "/devices/lenovo-legion-lenovo-legion-9i.png" },
  { id: "ln_legion_7", label: "Legion 7", base: 0, inquiryOnly: true, image: "/devices/lenovo-legion-lenovo-legion-7.png" },
  { id: "ln_legion_7i", label: "Legion 7i", base: 0, inquiryOnly: true, image: "/devices/lenovo-legion-lenovo-legion-7i.png" },
  { id: "ln_legion_7_pro", label: "Legion 7 Pro", base: 0, inquiryOnly: true, image: "/devices/lenovo-legion-lenovo-legion-7-pro.png" },
  { id: "ln_legion_7i_pro", label: "Legion 7i Pro", base: 0, inquiryOnly: true, image: "/devices/lenovo-legion-lenovo-legion-7i-pro.png" },
  { id: "ln_legion_slim_7", label: "Legion Slim 7", base: 0, inquiryOnly: true, image: "/devices/lenovo-legion-lenovo-legion-slim-7.png" },
  { id: "ln_legion_slim_7i", label: "Legion Slim 7i", base: 0, inquiryOnly: true, image: "/devices/lenovo-legion-lenovo-legion-slim-7i.png" },
  { id: "ln_legion_5", label: "Legion 5", base: 0, inquiryOnly: true, image: "/devices/lenovo-legion-lenovo-legion-5.png" },
  { id: "ln_legion_5i", label: "Legion 5i", base: 0, inquiryOnly: true, image: "/devices/lenovo-legion-lenovo-legion-5i.png" },
  { id: "ln_legion_5_pro", label: "Legion 5 Pro", base: 0, inquiryOnly: true, image: "/devices/lenovo-legion-lenovo-legion-5-pro.png" },
  { id: "ln_legion_5i_pro", label: "Legion 5i Pro", base: 0, inquiryOnly: true, image: "/devices/lenovo-legion-lenovo-legion-5i-pro.png" },
  { id: "ln_legion_slim_5", label: "Legion Slim 5", base: 0, inquiryOnly: true, image: "/devices/lenovo-legion-lenovo-legion-slim-5.png" },
  { id: "ln_legion_slim_5i", label: "Legion Slim 5i", base: 0, inquiryOnly: true, image: "/devices/lenovo-legion-lenovo-legion-slim-5i.png" },
  { id: "ln_legion_y740", label: "Legion Y740", base: 0, inquiryOnly: true, image: "/devices/lenovo-legion-lenovo-legion-y740.png" },
  { id: "ln_legion_y730", label: "Legion Y730", base: 0, inquiryOnly: true, image: "/devices/lenovo-legion-lenovo-legion-y730.png" },
  { id: "ln_legion_y720", label: "Legion Y720", base: 0, inquiryOnly: true, image: "/devices/lenovo-legion-lenovo-legion-y720.png" },
  { id: "ln_legion_y545", label: "Legion Y545", base: 0, inquiryOnly: true, image: "/devices/lenovo-legion-lenovo-legion-y545.png" },
  { id: "ln_legion_y540", label: "Legion Y540", base: 0, inquiryOnly: true, image: "/devices/lenovo-legion-lenovo-legion-y540.png" },
  { id: "ln_legion_y530", label: "Legion Y530", base: 0, inquiryOnly: true, image: "/devices/lenovo-legion-lenovo-legion-y530.png" },
  { id: "ln_legion_y520", label: "Legion Y520", base: 0, inquiryOnly: true, image: "/devices/lenovo-legion-lenovo-legion-y520.png" },
];

const LENOVO_LOQ_VARIANTS = [
  { id: "ln_loq_15", label: "LOQ 15", base: 0, inquiryOnly: true, image: "/devices/lenovo-loq-lenovo-loq-15.png" },
  { id: "ln_loq_17", label: "LOQ 17", base: 0, inquiryOnly: true, image: "/devices/lenovo-loq-lenovo-loq-17.png" },
];

const LENOVO_SLIM_VARIANTS = [
  { id: "ln_slim_pro_9i", label: "Slim Pro 9i", base: 0, inquiryOnly: true, image: "/devices/lenovo-slim-lenovo-slim-pro-9i.png" },
  { id: "ln_slim_pro_7", label: "Slim Pro 7", base: 0, inquiryOnly: true, image: "/devices/lenovo-slim-lenovo-slim-pro-7.png" },
  { id: "ln_slim_7i_pro_x", label: "Slim 7i Pro X", base: 0, inquiryOnly: true, image: "/devices/lenovo-slim-lenovo-slim-7i-pro-x.png" },
  { id: "ln_slim_7_pro_x", label: "Slim 7 Pro X", base: 0, inquiryOnly: true, image: "/devices/lenovo-slim-lenovo-slim-7-pro-x.png" },
  { id: "ln_slim_7i", label: "Slim 7i", base: 0, inquiryOnly: true, image: "/devices/lenovo-slim-lenovo-slim-7i.png" },
  { id: "ln_slim_7", label: "Slim 7", base: 0, inquiryOnly: true, image: "/devices/lenovo-slim-lenovo-slim-7.png" },
];

const LENOVO_YOGA_VARIANTS = [
  { id: "ln_yoga_9i", label: "Yoga 9i", base: 0, inquiryOnly: true, image: "/devices/lenovo-yoga-lenovo-yoga-9i.png" },
  { id: "ln_yoga_pro_9i", label: "Yoga Pro 9i", base: 0, inquiryOnly: true, image: "/devices/lenovo-yoga-lenovo-yoga-pro-9i.png" },
  { id: "ln_yoga_slim_9i", label: "Yoga Slim 9i", base: 0, inquiryOnly: true, image: "/devices/lenovo-yoga-lenovo-yoga-slim-9i.png" },
  { id: "ln_yoga_book_9i", label: "Yoga Book 9i", base: 0, inquiryOnly: true, image: "/devices/lenovo-yoga-lenovo-yoga-book-9i.png" },
  { id: "ln_yoga_7", label: "Yoga 7", base: 0, inquiryOnly: true, image: "/devices/lenovo-yoga-lenovo-yoga-7.png" },
  { id: "ln_yoga_7i", label: "Yoga 7i", base: 0, inquiryOnly: true, image: "/devices/lenovo-yoga-lenovo-yoga-7i.png" },
  { id: "ln_yoga_pro_7", label: "Yoga Pro 7", base: 0, inquiryOnly: true, image: "/devices/lenovo-yoga-lenovo-yoga-pro-7.png" },
  { id: "ln_yoga_slim_7i", label: "Yoga Slim 7i", base: 0, inquiryOnly: true, image: "/devices/lenovo-yoga-lenovo-yoga-slim-7i.png" },
  { id: "ln_yoga_slim_7x", label: "Yoga Slim 7x", base: 0, inquiryOnly: true, image: "/devices/lenovo-yoga-lenovo-yoga-slim-7x.png" },
  { id: "ln_yoga_6", label: "Yoga 6", base: 0, inquiryOnly: true, image: "/devices/lenovo-yoga-lenovo-yoga-6.png" },
  { id: "ln_yoga_c940", label: "Yoga C940", base: 0, inquiryOnly: true, image: "/devices/lenovo-yoga-lenovo-yoga-c940.png" },
  { id: "ln_yoga_c930", label: "Yoga C930", base: 0, inquiryOnly: true, image: "/devices/lenovo-yoga-lenovo-yoga-c930.png" },
  { id: "ln_yoga_c740", label: "Yoga C740", base: 0, inquiryOnly: true, image: "/devices/lenovo-yoga-lenovo-yoga-c740.png" },
  { id: "ln_yoga_c640", label: "Yoga C640", base: 0, inquiryOnly: true, image: "/devices/lenovo-yoga-lenovo-yoga-c640.png" },
  { id: "ln_yoga_c630", label: "Yoga C630", base: 0, inquiryOnly: true, image: "/devices/lenovo-yoga-lenovo-yoga-c630.png" },
  { id: "ln_yoga_920", label: "Yoga 920", base: 0, inquiryOnly: true, image: "/devices/lenovo-yoga-lenovo-yoga-920.png" },
  { id: "ln_yoga_720", label: "Yoga 720", base: 0, inquiryOnly: true, image: "/devices/lenovo-yoga-lenovo-yoga-720.png" },
  { id: "ln_yoga_710", label: "Yoga 710", base: 0, inquiryOnly: true, image: "/devices/lenovo-yoga-lenovo-yoga-710.png" },
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
  { id: "lenovo_tp_x1", label: "ThinkPad X1", year: "Premium ultrabook", topPrice: 0, variants: LENOVO_TP_X1_VARIANTS, inquiryOnly: true, image: "/devices/lenovo-thinkpad-tp_x1-lenovo-thinkpad-x1-carbon.png" },
  { id: "lenovo_tp_x9", label: "ThinkPad X9", year: "Aura Edition", topPrice: 0, variants: LENOVO_TP_X9_VARIANTS, inquiryOnly: true, image: "/devices/ln_tp_x9_14.png" },
  { id: "lenovo_tp_x13", label: "ThinkPad X13", year: "13-inch business", topPrice: 0, variants: LENOVO_TP_X13_VARIANTS, inquiryOnly: true, image: "/devices/lenovo-thinkpad-tp_x13-lenovo-thinkpad-x13.png" },
  { id: "lenovo_tp_x390", label: "ThinkPad X390", year: "Legacy 13.3-inch", topPrice: 0, variants: LENOVO_TP_X390_VARIANTS, inquiryOnly: true, image: "/devices/ln_tp_x390.png" },
  { id: "lenovo_tp_t", label: "ThinkPad T", year: "Workhorse business", topPrice: 0, variants: LENOVO_TP_T_VARIANTS, inquiryOnly: true, image: "/devices/ln_tp_t.png" },
  { id: "lenovo_tp_p", label: "ThinkPad P", year: "Mobile workstation", topPrice: 0, variants: LENOVO_TP_P_VARIANTS, inquiryOnly: true, image: "/devices/lenovo-thinkpad-tp_p-lenovo-thinkpad-p51.png" },
  { id: "lenovo_tp_l", label: "ThinkPad L", year: "Mainstream business", topPrice: 0, variants: LENOVO_TP_L_VARIANTS, inquiryOnly: true, image: "/devices/lenovo-thinkpad-tp_l-lenovo-thinkpad-l14-series.png" },
  { id: "lenovo_tp_e", label: "ThinkPad E", year: "Essential business", topPrice: 0, variants: LENOVO_TP_E_VARIANTS, inquiryOnly: true, image: "/devices/ln_tp_e14_g7.png" },
  { id: "lenovo_tp_z", label: "ThinkPad Z", year: "Modern design", topPrice: 0, variants: LENOVO_TP_Z_VARIANTS, inquiryOnly: true, image: "/devices/lenovo-thinkpad-tp_z-lenovo-thinkpad-z16.png" },
  { id: "lenovo_thinkbook", label: "ThinkBook", year: "Business mid-range", topPrice: 0, variants: LENOVO_THINKBOOK_VARIANTS, inquiryOnly: true, image: "/devices/ln_tb_14.png" },
  { id: "lenovo_ideapad", label: "IdeaPad", year: "Everyday", topPrice: 0, variants: LENOVO_IDEAPAD_VARIANTS, inquiryOnly: true, image: "/devices/lenovo-ideapad-lenovo-ideapad-5.png" },
  { id: "lenovo_legion", label: "Legion", year: "Gaming", topPrice: 0, variants: LENOVO_LEGION_VARIANTS, inquiryOnly: true, image: "/devices/lenovo-legion-lenovo-legion-5-pro.png" },
  { id: "lenovo_loq", label: "LOQ", year: "Entry gaming", topPrice: 0, variants: LENOVO_LOQ_VARIANTS, inquiryOnly: true, image: "/devices/lenovo-loq-lenovo-loq-15.png" },
  { id: "lenovo_slim", label: "Slim", year: "Slim creator", topPrice: 0, variants: LENOVO_SLIM_VARIANTS, inquiryOnly: true, image: "/devices/lenovo-slim-lenovo-slim-7.png" },
  { id: "lenovo_yoga", label: "Yoga", year: "2-in-1 / convertible", topPrice: 0, variants: LENOVO_YOGA_VARIANTS, inquiryOnly: true, image: "/devices/lenovo-yoga-lenovo-yoga-9i.png" },
];
// Lenovo no longer uses sub-series — kept as empty array so the breadcrumb
// resolver doesn't break when checking against it.
const LENOVO_PC_ALL_SUB_SERIES: { id: string; label: string; variants: { id: string; label: string; base: number }[] }[] = [];

const DELL_MODELS = [
  { id: "dxps17", label: "XPS 17 (2024)", base: 750, image: "/devices/dell-xps.webp" },
  { id: "dxps15", label: "XPS 15 (2024)", base: 620, image: "/devices/dell-xps.webp" },
  { id: "dxps13", label: "XPS 13 (2024)", base: 480, image: "/devices/dell-xps.webp" },
  { id: "dxps15g23", label: "XPS 15 (2023)", base: 500, image: "/devices/dell-xps.webp" },
  { id: "dxps13g23", label: "XPS 13 (2023)", base: 380, image: "/devices/dell-xps.webp" },
  { id: "dlat7440", label: "Latitude 7440", base: 420, image: "/devices/dell-latitude.jpg" },
  { id: "dlat5540", label: "Latitude 5540", base: 300, image: "/devices/dell-latitude.jpg" },
  { id: "dinsp16p", label: "Inspiron 16 Plus", base: 350, image: "/devices/dell-inspiron-15.webp" },
  { id: "dinsp15", label: "Inspiron 15", base: 220, image: "/devices/dell-inspiron-15.webp" },
  { id: "dinsp14", label: "Inspiron 14", base: 200, image: "/devices/dell-inspiron-15.webp" },
];

// Alienware laptop categories restructured 2026-05-06 to mirror itsworthmore.com
// All variants inquiry-only; per-SKU images sourced from IWM product pages
const ALIENWARE_M_SERIES_VARIANTS = [
  { id: "awm18r2", label: "Alienware m18 R2", base: 0, inquiryOnly: true, image: "/devices/alienware-m18.webp" },
  { id: "awm18r1", label: "Alienware m18 R1", base: 0, inquiryOnly: true, image: "/devices/alienware-m18.webp" },
  { id: "awm17r5", label: "Alienware m17 R5 (AMD flagship)", base: 0, inquiryOnly: true, image: "/devices/alienware-m17.webp" },
  { id: "awm16r2", label: "Alienware m16 R2", base: 0, inquiryOnly: true, image: "/devices/alienware-m16.webp" },
  { id: "awm16r1", label: "Alienware m16 R1", base: 0, inquiryOnly: true, image: "/devices/alienware-m16.webp" },
  { id: "awm15r7", label: "Alienware m15 R7", base: 0, inquiryOnly: true, image: "/devices/alienware-m15.webp" },
  { id: "awm15r6", label: "Alienware m15 R6", base: 0, inquiryOnly: true, image: "/devices/alienware-m15.webp" },
  { id: "awm15r5_ryzen", label: "Alienware m15 R5 (Ryzen)", base: 0, inquiryOnly: true, image: "/devices/alienware-m15.webp" },
];
const ALIENWARE_X_SERIES_VARIANTS = [
  { id: "awx17r2", label: "Alienware x17 R2", base: 0, inquiryOnly: true, image: "/devices/alienware-x17.webp" },
  { id: "awx17r1", label: "Alienware x17 R1", base: 0, inquiryOnly: true, image: "/devices/alienware-x17.webp" },
  { id: "awx16r2", label: "Alienware x16 R2", base: 0, inquiryOnly: true, image: "/devices/alienware-x16.webp" },
  { id: "awx16r1", label: "Alienware x16 R1", base: 0, inquiryOnly: true, image: "/devices/alienware-x16.webp" },
  { id: "awx15r2", label: "Alienware x15 R2", base: 0, inquiryOnly: true, image: "/devices/alienware-x15.webp" },
  { id: "awx15r1", label: "Alienware x15 R1", base: 0, inquiryOnly: true, image: "/devices/alienware-x15.webp" },
  { id: "awx14r2", label: "Alienware x14 R2", base: 0, inquiryOnly: true, image: "/devices/alienware-x14.webp" },
  { id: "awx14r1", label: "Alienware x14 R1", base: 0, inquiryOnly: true, image: "/devices/alienware-x14.webp" },
];
const ALIENWARE_AREA_SERIES_VARIANTS = [
  { id: "aw18_a51_2026", label: "Alienware 18 Area-51 (2026)", base: 0, inquiryOnly: true, image: "/devices/alienware-18-area-51.webp" },
  { id: "aw16_a51_2026", label: "Alienware 16 Area-51 (2026)", base: 0, inquiryOnly: true, image: "/devices/alienware-16-area-51.webp" },
  { id: "aw_a51m_r2", label: "Alienware Area-51m R2", base: 0, inquiryOnly: true, image: "/devices/alienware-area-51m.webp" },
  { id: "aw_a51m_r1", label: "Alienware Area-51m R1", base: 0, inquiryOnly: true, image: "/devices/alienware-area-51m.webp" },
];
const ALIENWARE_AURORA_LAPTOP_VARIANTS = [
  { id: "aw16x_aurora_2026", label: "Alienware 16X Aurora (2026)", base: 0, inquiryOnly: true, image: "/devices/alienware-16x-aurora.webp" },
  { id: "aw16_aurora_2026", label: "Alienware 16 Aurora (2026)", base: 0, inquiryOnly: true, image: "/devices/alienware-16-aurora.webp" },
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
  { id: "aw_m_series", label: "M Series", year: "m15 / m16 / m17 / m18", topPrice: 0, variants: ALIENWARE_M_SERIES_VARIANTS, inquiryOnly: true, image: "/devices/aw-cat-m.webp" },
  { id: "aw_x_series", label: "X Series", year: "x14 / x15 / x16 / x17", topPrice: 0, variants: ALIENWARE_X_SERIES_VARIANTS, inquiryOnly: true, image: "/devices/aw-cat-x.webp" },
  { id: "aw_area_series", label: "Area Series", year: "Area-51m / Area-51", topPrice: 0, variants: ALIENWARE_AREA_SERIES_VARIANTS, inquiryOnly: true, image: "/devices/aw-cat-area.webp" },
  { id: "aw_aurora_laptop", label: "Aurora Laptop", year: "2026 — New", topPrice: 0, variants: ALIENWARE_AURORA_LAPTOP_VARIANTS, inquiryOnly: true, image: "/devices/aw-cat-aurora.webp" },
  { id: "aw_17", label: "Alienware 17", year: "Legacy 17\"", topPrice: 0, variants: ALIENWARE_17_VARIANTS, inquiryOnly: true, image: "/devices/aw-cat-17.webp" },
  { id: "aw_15", label: "Alienware 15", year: "Legacy 15\"", topPrice: 0, variants: ALIENWARE_15_VARIANTS, inquiryOnly: true, image: "/devices/aw-cat-15.webp" },
  { id: "aw_13", label: "Alienware 13", year: "Legacy 13\"", topPrice: 0, variants: ALIENWARE_13_VARIANTS, inquiryOnly: true, image: "/devices/aw-cat-13.webp" },
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
  { id: "hp_eb_g1a", label: "EliteBook G1a", base: 0, inquiryOnly: true, image: "/devices/hp-elitebook-eb_std-hp-elitebook-g1a.png" },
  { id: "hp_eb_g1i", label: "EliteBook G1i", base: 0, inquiryOnly: true, image: "/devices/hp-elitebook-eb_std-hp-elitebook-g1i.png" },
  { id: "hp_eb_g1q", label: "EliteBook G1q", base: 0, inquiryOnly: true, image: "/devices/hp-elitebook-eb_std-hp-elitebook-g1q.png" },
  { id: "hp_eb_g11", label: "EliteBook G11", base: 0, inquiryOnly: true, image: "/devices/hp-elitebook-eb_std-hp-elitebook-g11.png" },
  { id: "hp_eb_g10", label: "EliteBook G10", base: 0, inquiryOnly: true, image: "/devices/hp-elitebook-eb_std-hp-elitebook-g10.png" },
  { id: "hp_eb_g9", label: "EliteBook G9", base: 0, inquiryOnly: true, image: "/devices/hp-elitebook-eb_std-hp-elitebook-g9.png" },
  { id: "hp_eb_g8", label: "EliteBook G8", base: 0, inquiryOnly: true, image: "/devices/hp-elitebook-eb_std-hp-elitebook-g8.png" },
  { id: "hp_eb_g7", label: "EliteBook G7", base: 0, inquiryOnly: true, image: "/devices/hp-elitebook-eb_std-hp-elitebook-g7.png" },
  { id: "hp_eb_g6", label: "EliteBook G6", base: 0, inquiryOnly: true, image: "/devices/hp-elitebook-eb_std-hp-elitebook-g6.png" },
  { id: "hp_eb_g5", label: "EliteBook G5", base: 0, inquiryOnly: true, image: "/devices/hp-elitebook-eb_std-hp-elitebook-g5.png" },
  { id: "hp_eb_g4", label: "EliteBook G4", base: 0, inquiryOnly: true, image: "/devices/hp-elitebook-eb_std-hp-elitebook-g4.png" },
];
const HP_ELITEBOOK_ULTRA_VARIANTS = [
  { id: "hp_eb_ultra_g1q", label: "EliteBook Ultra G1q", base: 0, inquiryOnly: true, image: "/devices/hp-elitebook-eb_ultra-hp-elitebook-ultra-g1q.png" },
  { id: "hp_eb_ultra_g1i", label: "EliteBook Ultra G1i", base: 0, inquiryOnly: true, image: "/devices/hp-elitebook-eb_ultra-hp-elitebook-ultra-g1i.png" },
];
const HP_ELITEBOOK_SUB_SERIES = [
  { id: "hp_eb_std", label: "EliteBook", year: "Standard line", topPrice: 0, variants: HP_ELITEBOOK_STD_VARIANTS, inquiryOnly: true, image: "/devices/hp-elitebook-eb_std-hp-elitebook-g1a.png" },
  { id: "hp_eb_ultra", label: "EliteBook Ultra", year: "Premium ultraportable", topPrice: 0, variants: HP_ELITEBOOK_ULTRA_VARIANTS, inquiryOnly: true, image: "/devices/hp-elitebook-eb_ultra-hp-elitebook-ultra-g1q.png" },
];
const HP_ENVY_VARIANTS = [
  { id: "hp_envy_13", label: "Envy 13", base: 0, inquiryOnly: true, image: "/devices/hp-envy-hp-envy-13.png" },
  { id: "hp_envy_15", label: "Envy 15", base: 0, inquiryOnly: true, image: "/devices/hp-envy-hp-envy-15.png" },
  { id: "hp_envy_17", label: "Envy 17", base: 0, inquiryOnly: true, image: "/devices/hp-envy-hp-envy-17.png" },
  { id: "hp_envy_x360", label: "Envy x360", base: 0, inquiryOnly: true, image: "/devices/hp-envy-hp-envy-x360.png" },
];
const HP_OMEN_STD_VARIANTS = [
  { id: "hp_omen_17", label: "OMEN 17", base: 0, inquiryOnly: true, image: "/devices/hp-omen-omen_std-hp-omen-17.png" },
  { id: "hp_omen_16", label: "OMEN 16", base: 0, inquiryOnly: true, image: "/devices/hp-omen-omen_std-hp-omen-16.png" },
  { id: "hp_omen_15", label: "OMEN 15", base: 0, inquiryOnly: true, image: "/devices/hp-omen-omen_std-hp-omen-15.png" },
];
const HP_OMEN_TRANSCEND_VARIANTS = [
  { id: "hp_omen_trans_16", label: "OMEN Transcend 16", base: 0, inquiryOnly: true, image: "/devices/hp-omen-omen_trans-hp-omen-transcend-16.png" },
  { id: "hp_omen_trans_14", label: "OMEN Transcend 14", base: 0, inquiryOnly: true, image: "/devices/hp-omen-omen_trans-hp-omen-transcend-14.png" },
];
const HP_OMEN_MAX_VARIANTS = [
  { id: "hp_omen_max", label: "OMEN Max", base: 0, inquiryOnly: true, image: "/devices/hp_omen_max.png" },
];
const HP_OMEN_SLIM_VARIANTS = [
  { id: "hp_omen_slim", label: "OMEN Slim", base: 0, inquiryOnly: true, image: "/devices/hp_omen_slim.png" },
];
const HP_OMEN_SUB_SERIES = [
  { id: "hp_omen_std_sub", label: "OMEN", year: "Standard gaming", topPrice: 0, variants: HP_OMEN_STD_VARIANTS, inquiryOnly: true, image: "/devices/hp-omen-omen_std-hp-omen-17.png" },
  { id: "hp_omen_max_sub", label: "OMEN Max", year: "Top-tier", topPrice: 0, variants: HP_OMEN_MAX_VARIANTS, inquiryOnly: true, image: "/devices/hp-omen-omen_std-hp-omen-17.png" },
  { id: "hp_omen_slim_sub", label: "OMEN Slim", year: "Slim gaming", topPrice: 0, variants: HP_OMEN_SLIM_VARIANTS, inquiryOnly: true, image: "/devices/hp-omen-omen_std-hp-omen-17.png" },
  { id: "hp_omen_trans_sub", label: "OMEN Transcend", year: "Premium gaming", topPrice: 0, variants: HP_OMEN_TRANSCEND_VARIANTS, inquiryOnly: true, image: "/devices/hp-omen-omen_trans-hp-omen-transcend-16.png" },
];
const HP_OMNIBOOK_VARIANTS = [
  { id: "hp_omni_x", label: "OmniBook X", base: 0, inquiryOnly: true, image: "/devices/hp-omnibook-hp-omnibook-x.png" },
  { id: "hp_omni_x_flip", label: "OmniBook X Flip", base: 0, inquiryOnly: true, image: "/devices/hp-omnibook-hp-omnibook-x-flip.png" },
  { id: "hp_omni_7", label: "OmniBook 7", base: 0, inquiryOnly: true, image: "/devices/hp-omnibook-hp-omnibook-7.png" },
  { id: "hp_omni_7_aero", label: "OmniBook 7 Aero", base: 0, inquiryOnly: true, image: "/devices/hp-omnibook-hp-omnibook-7-aero.png" },
  { id: "hp_omni_7_flip", label: "OmniBook 7 Flip", base: 0, inquiryOnly: true, image: "/devices/hp-omnibook-hp-omnibook-7-flip.png" },
  { id: "hp_omni_3", label: "OmniBook 3", base: 0, inquiryOnly: true, image: "/devices/hp-omnibook-hp-omnibook-3.png" },
];
const HP_PAVILION_VARIANTS = [
  { id: "hp_pav_gaming", label: "Pavilion Gaming", base: 0, inquiryOnly: true, image: "/devices/hp-pavilion-hp-pavilion-gaming.png" },
  { id: "hp_pav_14", label: "Pavilion 14", base: 0, inquiryOnly: true, image: "/devices/hp-pavilion-hp-pavilion-14.png" },
  { id: "hp_pav_15", label: "Pavilion 15", base: 0, inquiryOnly: true, image: "/devices/hp-pavilion-hp-pavilion-15.png" },
  { id: "hp_pav_16", label: "Pavilion 16", base: 0, inquiryOnly: true, image: "/devices/hp-pavilion-hp-pavilion-16.png" },
  { id: "hp_pav_x360", label: "Pavilion x360", base: 0, inquiryOnly: true, image: "/devices/hp-pavilion-hp-pavilion-x360.png" },
];
const HP_PROBOOK_VARIANTS = [
  { id: "hp_pb_g11", label: "ProBook G11", base: 0, inquiryOnly: true, image: "/devices/hp-probook-hp-probook-g11.png" },
  { id: "hp_pb_g10", label: "ProBook G10", base: 0, inquiryOnly: true, image: "/devices/hp-probook-hp-probook-g10.png" },
  { id: "hp_pb_g9", label: "ProBook G9", base: 0, inquiryOnly: true, image: "/devices/hp-probook-hp-probook-g9.png" },
  { id: "hp_pb_g8", label: "ProBook G8", base: 0, inquiryOnly: true, image: "/devices/hp-probook-hp-probook-g8.png" },
  { id: "hp_pb_g7", label: "ProBook G7", base: 0, inquiryOnly: true, image: "/devices/hp-probook-hp-probook-g7.png" },
  { id: "hp_pb_g6", label: "ProBook G6", base: 0, inquiryOnly: true, image: "/devices/hp-probook-hp-probook-g6.png" },
  { id: "hp_pb_g5", label: "ProBook G5", base: 0, inquiryOnly: true, image: "/devices/hp-probook-hp-probook-g5.png" },
];
const HP_SPECTRE_VARIANTS = [
  { id: "hp_spec_13", label: "Spectre x360 13", base: 0, inquiryOnly: true, image: "/devices/hp-spectre-hp-spectre-13-x360.png" },
  { id: "hp_spec_14", label: "Spectre x360 14", base: 0, inquiryOnly: true, image: "/devices/hp-spectre-hp-spectre-14-x360.png" },
  { id: "hp_spec_15", label: "Spectre x360 15", base: 0, inquiryOnly: true, image: "/devices/hp-spectre-hp-spectre-15-x360.png" },
  { id: "hp_spec_16", label: "Spectre x360 16", base: 0, inquiryOnly: true, image: "/devices/hp-spectre-hp-spectre-16-x360.png" },
];
const HP_VICTUS_VARIANTS = [
  { id: "hp_victus_15", label: "Victus 15", base: 0, inquiryOnly: true, image: "/devices/hp_victus_15.png" },
  { id: "hp_victus_16", label: "Victus 16", base: 0, inquiryOnly: true, image: "/devices/hp_victus_16.png" },
];
const HP_ZBOOK_VARIANTS = [
  { id: "hp_zb_g11", label: "ZBook G11", base: 0, inquiryOnly: true, image: "/devices/hp-zbook-hp-zbook-g11.png" },
  { id: "hp_zb_g10", label: "ZBook G10", base: 0, inquiryOnly: true, image: "/devices/hp-zbook-hp-zbook-g10.png" },
  { id: "hp_zb_g9", label: "ZBook G9", base: 0, inquiryOnly: true, image: "/devices/hp-zbook-hp-zbook-g9.png" },
  { id: "hp_zb_g8", label: "ZBook G8", base: 0, inquiryOnly: true, image: "/devices/hp-zbook-hp-zbook-g8.png" },
  { id: "hp_zb_g7", label: "ZBook G7", base: 0, inquiryOnly: true, image: "/devices/hp-zbook-hp-zbook-g7.png" },
  { id: "hp_zb_g6", label: "ZBook G6", base: 0, inquiryOnly: true, image: "/devices/hp-zbook-hp-zbook-g6.png" },
  { id: "hp_zb_g5", label: "ZBook G5", base: 0, inquiryOnly: true, image: "/devices/hp-zbook-hp-zbook-g5.png" },
  { id: "hp_zb_g4", label: "ZBook G4", base: 0, inquiryOnly: true, image: "/devices/hp-zbook-hp-zbook-g4.png" },
];
const HP_NOTEBOOK_VARIANTS = [
  { id: "hp_nb_14", label: "Notebook 14", base: 0, inquiryOnly: true, image: "/devices/hp-notebook-hp-notebook-14.png" },
  { id: "hp_nb_15", label: "Notebook 15", base: 0, inquiryOnly: true, image: "/devices/hp-notebook-hp-notebook-15.png" },
  { id: "hp_nb_17", label: "Notebook 17", base: 0, inquiryOnly: true, image: "/devices/hp-notebook-hp-notebook-17.png" },
];

const HP_PC_SERIES = [
  { id: "hp_elitebook", label: "EliteBook", year: "Premium business", topPrice: 0, subSeries: HP_ELITEBOOK_SUB_SERIES, inquiryOnly: true, image: "/devices/hp-elitebook-eb_std-hp-elitebook-g11.png" },
  { id: "hp_envy", label: "Envy", year: "Mainstream consumer", topPrice: 0, variants: HP_ENVY_VARIANTS, inquiryOnly: true, image: "/devices/hp-envy-hp-envy-x360.png" },
  { id: "hp_omen", label: "OMEN", year: "Gaming", topPrice: 0, subSeries: HP_OMEN_SUB_SERIES, inquiryOnly: true, image: "/devices/hp-omen-omen_std-hp-omen-17.png" },
  { id: "hp_omnibook", label: "OmniBook", year: "AI productivity", topPrice: 0, variants: HP_OMNIBOOK_VARIANTS, inquiryOnly: true, image: "/devices/hp-omnibook-hp-omnibook-x.png" },
  { id: "hp_pavilion", label: "Pavilion", year: "Everyday", topPrice: 0, variants: HP_PAVILION_VARIANTS, inquiryOnly: true, image: "/devices/hp-pavilion-hp-pavilion-15.png" },
  { id: "hp_probook", label: "ProBook", year: "SMB business", topPrice: 0, variants: HP_PROBOOK_VARIANTS, inquiryOnly: true, image: "/devices/hp-probook-hp-probook-g11.png" },
  { id: "hp_spectre", label: "Spectre", year: "Premium consumer", topPrice: 0, variants: HP_SPECTRE_VARIANTS, inquiryOnly: true, image: "/devices/hp-spectre-hp-spectre-14-x360.png" },
  { id: "hp_victus", label: "Victus", year: "Entry gaming", topPrice: 0, variants: HP_VICTUS_VARIANTS, inquiryOnly: true, image: "/devices/hp-spectre-x360.webp" },
  { id: "hp_zbook", label: "ZBook", year: "Mobile workstation", topPrice: 0, variants: HP_ZBOOK_VARIANTS, inquiryOnly: true, image: "/devices/hp-zbook-hp-zbook-g11.png" },
  { id: "hp_notebook", label: "Notebook", year: "Budget", topPrice: 0, variants: HP_NOTEBOOK_VARIANTS, inquiryOnly: true, image: "/devices/hp-notebook-hp-notebook-15.png" },
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
  { id: "sgbk_5", label: "Galaxy Book5", base: 0, inquiryOnly: true, image: "/devices/sgbk4.png" },
  { id: "sgbk_5_360", label: "Galaxy Book5 360", base: 0, inquiryOnly: true, image: "/devices/sgbk4p.png" },
  { id: "sgbk_5_pro", label: "Galaxy Book5 Pro", base: 0, inquiryOnly: true, image: "/devices/sgbk4pro.png" },
  { id: "sgbk_5_pro_360", label: "Galaxy Book5 Pro 360", base: 0, inquiryOnly: true, image: "/devices/sgbk4p.png" },
];
const SAMSUNG_BOOK4_VARIANTS = [
  { id: "sgbk_4", label: "Galaxy Book4", base: 0, inquiryOnly: true, image: "/devices/sgbk4.png" },
  { id: "sgbk_4_360", label: "Galaxy Book4 360", base: 0, inquiryOnly: true, image: "/devices/sgbk4p.png" },
  { id: "sgbk_4_pro", label: "Galaxy Book4 Pro", base: 0, inquiryOnly: true, image: "/devices/sgbk4pro.png" },
  { id: "sgbk_4_pro_360", label: "Galaxy Book4 Pro 360", base: 0, inquiryOnly: true, image: "/devices/sgbk4p.png" },
  { id: "sgbk_4_ultra", label: "Galaxy Book4 Ultra", base: 0, inquiryOnly: true, image: "/devices/sgbk4u.png" },
  { id: "sgbk_4_edge", label: "Galaxy Book4 Edge", base: 0, inquiryOnly: true, image: "/devices/sgbk4pro.png" },
];
const SAMSUNG_BOOK3_VARIANTS = [
  { id: "sgbk_3", label: "Galaxy Book3", base: 0, inquiryOnly: true, image: "/devices/sgbk3.png" },
  { id: "sgbk_3_360", label: "Galaxy Book3 360", base: 0, inquiryOnly: true, image: "/devices/sgbk3p.png" },
  { id: "sgbk_3_pro", label: "Galaxy Book3 Pro", base: 0, inquiryOnly: true, image: "/devices/sgbk3pro.png" },
  { id: "sgbk_3_pro_360", label: "Galaxy Book3 Pro 360", base: 0, inquiryOnly: true, image: "/devices/sgbk3p.png" },
  { id: "sgbk_3_ultra", label: "Galaxy Book3 Ultra", base: 0, inquiryOnly: true, image: "/devices/sgbk3u.png" },
];
const SAMSUNG_BOOK2_VARIANTS = [
  { id: "sgbk_2", label: "Galaxy Book2", base: 0, inquiryOnly: true, image: "/devices/sgbk2.png" },
  { id: "sgbk_2_360", label: "Galaxy Book2 360", base: 0, inquiryOnly: true, image: "/devices/sgbk2p.png" },
  { id: "sgbk_2_pro", label: "Galaxy Book2 Pro", base: 0, inquiryOnly: true, image: "/devices/sgbk2p.png" },
  { id: "sgbk_2_pro_360", label: "Galaxy Book2 Pro 360", base: 0, inquiryOnly: true, image: "/devices/sgbk2p.png" },
];
const SAMSUNG_BOOK1_VARIANTS = [
  { id: "sgbk_1", label: "Galaxy Book", base: 0, inquiryOnly: true, image: "/devices/sgbk2.png" },
  { id: "sgbk_1_pro", label: "Galaxy Book Pro", base: 0, inquiryOnly: true, image: "/devices/sgbk2p.png" },
  { id: "sgbk_1_pro_360", label: "Galaxy Book Pro 360", base: 0, inquiryOnly: true, image: "/devices/sgbk2p.png" },
  { id: "sgbk_1_ion", label: "Galaxy Book Ion", base: 0, inquiryOnly: true, image: "/devices/sgbk2.png" },
  { id: "sgbk_1_flex", label: "Galaxy Book Flex", base: 0, inquiryOnly: true, image: "/devices/sgbk2p.png" },
  { id: "sgbk_1_flex_alpha", label: "Galaxy Book Flex Alpha", base: 0, inquiryOnly: true, image: "/devices/sgbk2p.png" },
  { id: "sgbk_1_flex2_alpha", label: "Galaxy Book Flex2 Alpha", base: 0, inquiryOnly: true, image: "/devices/sgbk2p.png" },
  { id: "sgbk_1_odyssey", label: "Galaxy Book Odyssey", base: 0, inquiryOnly: true, image: "/devices/sgbk2.png" },
];
const SAMSUNG_PC_SERIES = [
  { id: "sgbk_book5", label: "Galaxy Book 5", year: "2025", topPrice: 0, variants: SAMSUNG_BOOK5_VARIANTS, inquiryOnly: true, image: "/devices/sgbk4u.png" },
  { id: "sgbk_book4", label: "Galaxy Book 4", year: "2024", topPrice: 0, variants: SAMSUNG_BOOK4_VARIANTS, inquiryOnly: true, image: "/devices/sgbk4u.png" },
  { id: "sgbk_book3", label: "Galaxy Book 3", year: "2023", topPrice: 0, variants: SAMSUNG_BOOK3_VARIANTS, inquiryOnly: true, image: "/devices/sgbk3u.png" },
  { id: "sgbk_book2", label: "Galaxy Book 2", year: "2022", topPrice: 0, variants: SAMSUNG_BOOK2_VARIANTS, inquiryOnly: true, image: "/devices/sgbk2.png" },
  { id: "sgbk_book1", label: "Galaxy Book", year: "2020–2021", topPrice: 0, variants: SAMSUNG_BOOK1_VARIANTS, inquiryOnly: true, image: "/devices/sgbk2.png" },
];

// LG LAPTOPS — three-level tree mirroring itsworthmore.com.
// IWM splits LG into 3 series (Gram / Gram Pro / Gram SuperSlim) and
// each series into size sub-categories (Gram 14, Gram 16 (2-in-1), etc.).
// Our 24 existing model variants map cleanly into this. Gram Book and
// UltraGear (gaming) aren't on IWM, so they're dropped per the
// comp-mirror request.
const LG_GRAM_14_VARIANTS = [
  { id: "lg_gr14_24", label: "LG Gram 14 (14Z90S, 2024)", base: 0, inquiryOnly: true, image: "/devices/lg_gr14_24.png" },
  { id: "lg_gr14_23", label: "LG Gram 14 (14Z90R, 2023)", base: 0, inquiryOnly: true, image: "/devices/lg_gr14_23.png" },
  { id: "lg_grstyle14", label: "LG Gram Style 14 (14Z90RS, 2023)", base: 0, inquiryOnly: true, image: "/devices/lg_grstyle14.png" },
];
const LG_GRAM_14_2IN1_VARIANTS = [
  { id: "lg_gr14t_24", label: "LG Gram 14 2-in-1 (14T90S, 2024)", base: 0, inquiryOnly: true, image: "/devices/lg_gr14t_24.png" },
  { id: "lg_gr14t_23", label: "LG Gram 14 2-in-1 (14T90R, 2023)", base: 0, inquiryOnly: true, image: "/devices/lg_gr14t_23.png" },
];
const LG_GRAM_15_VARIANTS = [
  { id: "lg_gr15_23", label: "LG Gram 15 (15Z90R, 2023)", base: 0, inquiryOnly: true, image: "/devices/lg_gr15_23.png" },
];
const LG_GRAM_16_VARIANTS = [
  { id: "lg_gr16_24", label: "LG Gram 16 (16Z90S, 2024)", base: 0, inquiryOnly: true, image: "/devices/lg_gr16_24.png" },
  { id: "lg_gr16_23", label: "LG Gram 16 (16Z90R, 2023)", base: 0, inquiryOnly: true, image: "/devices/lg_gr16_23.png" },
  { id: "lg_grstyle16", label: "LG Gram Style 16 (16Z90RS, 2023)", base: 0, inquiryOnly: true, image: "/devices/lg_grstyle16.png" },
];
const LG_GRAM_16_2IN1_VARIANTS = [
  { id: "lg_gr16t_24", label: "LG Gram 16 2-in-1 (16T90S, 2024)", base: 0, inquiryOnly: true, image: "/devices/lg_gr16t_24.png" },
  { id: "lg_gr16t_23", label: "LG Gram 16 2-in-1 (16T90R, 2023)", base: 0, inquiryOnly: true, image: "/devices/lg_gr16t_23.png" },
];
const LG_GRAM_17_VARIANTS = [
  { id: "lg_gr17_24", label: "LG Gram 17 (17Z90S, 2024)", base: 0, inquiryOnly: true, image: "/devices/lg_gr17_24.png" },
  { id: "lg_gr17_23", label: "LG Gram 17 (17Z90R, 2023)", base: 0, inquiryOnly: true, image: "/devices/lg_gr17_23.png" },
];
const LG_GRAM_PRO_16_VARIANTS = [
  { id: "lg_grpro16_25", label: "LG Gram Pro 16 (16Z90TR, 2025)", base: 0, inquiryOnly: true, image: "/devices/lg_grpro16_25.png" },
  { id: "lg_grpro16_24", label: "LG Gram Pro 16 (16Z90SP, 2024)", base: 0, inquiryOnly: true, image: "/devices/lg_grpro16_24.png" },
];
const LG_GRAM_PRO_16_2IN1_VARIANTS = [
  { id: "lg_grpro16t_24", label: "LG Gram Pro 16 2-in-1 (16T90SP, 2024)", base: 0, inquiryOnly: true, image: "/devices/lg_grpro16t_24.png" },
];
const LG_GRAM_PRO_17_VARIANTS = [
  { id: "lg_grpro17_25", label: "LG Gram Pro 17 (17Z90TR, 2025)", base: 0, inquiryOnly: true, image: "/devices/lg_grpro17_25.png" },
  { id: "lg_grpro17_24", label: "LG Gram Pro 17 (17Z90SP, 2024)", base: 0, inquiryOnly: true, image: "/devices/lg_grpro17_24.png" },
];
const LG_GRAM_SUPERSLIM_15_VARIANTS = [
  { id: "lg_grultra15", label: "LG Gram SuperSlim 15 (15Z90RT, 2023)", base: 0, inquiryOnly: true, image: "/devices/lg_grultra15.png" },
];

const LG_GRAM_SUB_SERIES = [
  { id: "lg_gram_14", label: "Gram 14", year: "14-inch", topPrice: 0, variants: LG_GRAM_14_VARIANTS, inquiryOnly: true, image: "/devices/lg_gr14_24.png" },
  { id: "lg_gram_14_2in1", label: "Gram 14 (2-in-1)", year: "14-inch convertible", topPrice: 0, variants: LG_GRAM_14_2IN1_VARIANTS, inquiryOnly: true, image: "/devices/lg_gr14t_24.png" },
  { id: "lg_gram_15", label: "Gram 15", year: "15-inch", topPrice: 0, variants: LG_GRAM_15_VARIANTS, inquiryOnly: true, image: "/devices/lg_gr15_23.png" },
  { id: "lg_gram_16", label: "Gram 16", year: "16-inch", topPrice: 0, variants: LG_GRAM_16_VARIANTS, inquiryOnly: true, image: "/devices/lg_gr16_24.png" },
  { id: "lg_gram_16_2in1", label: "Gram 16 (2-in-1)", year: "16-inch convertible", topPrice: 0, variants: LG_GRAM_16_2IN1_VARIANTS, inquiryOnly: true, image: "/devices/lg_gr16t_24.png" },
  { id: "lg_gram_17", label: "Gram 17", year: "17-inch", topPrice: 0, variants: LG_GRAM_17_VARIANTS, inquiryOnly: true, image: "/devices/lg_gr17_24.png" },
];
const LG_GRAM_PRO_SUB_SERIES = [
  { id: "lg_grampro_16", label: "Gram Pro 16", year: "16-inch", topPrice: 0, variants: LG_GRAM_PRO_16_VARIANTS, inquiryOnly: true, image: "/devices/lg_grpro16_25.png" },
  { id: "lg_grampro_16_2in1", label: "Gram Pro 16 (2-in-1)", year: "16-inch convertible", topPrice: 0, variants: LG_GRAM_PRO_16_2IN1_VARIANTS, inquiryOnly: true, image: "/devices/lg_grpro16t_24.png" },
  { id: "lg_grampro_17", label: "Gram Pro 17", year: "17-inch", topPrice: 0, variants: LG_GRAM_PRO_17_VARIANTS, inquiryOnly: true, image: "/devices/lg_grpro17_25.png" },
];
const LG_GRAM_SUPERSLIM_SUB_SERIES = [
  { id: "lg_superslim_15", label: "Gram SuperSlim 15", year: "Ultra-thin", topPrice: 0, variants: LG_GRAM_SUPERSLIM_15_VARIANTS, inquiryOnly: true, image: "/devices/lg_grultra15.png" },
];

const LG_PC_SERIES = [
  { id: "lg_gram", label: "Gram", year: "Standard ultraportable", topPrice: 0, subSeries: LG_GRAM_SUB_SERIES, inquiryOnly: true, image: "/devices/lg_gr16_24.png" },
  { id: "lg_grampro", label: "Gram Pro", year: "Performance", topPrice: 0, subSeries: LG_GRAM_PRO_SUB_SERIES, inquiryOnly: true, image: "/devices/lg_grpro16_25.png" },
  { id: "lg_superslim", label: "Gram SuperSlim", year: "Ultra-thin", topPrice: 0, subSeries: LG_GRAM_SUPERSLIM_SUB_SERIES, inquiryOnly: true, image: "/devices/lg_grultra15.png" },
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
  { id: "doptiplex7010", label: "OptiPlex 7010", base: 350, image: "/devices/dell-optiplex-tower.webp" },
  { id: "doptiplex5000", label: "OptiPlex 5000", base: 280, image: "/devices/dell-optiplex-sff.webp" },
  { id: "dxps8960", label: "XPS Desktop 8960", base: 500, image: "/devices/dell-xps-8960.webp" },
  { id: "dxps8950", label: "XPS Desktop 8950", base: 380, image: "/devices/dell-xps-8950.webp" },
  { id: "dinsp3030", label: "Inspiron 3030 Desktop", base: 250 },
  { id: "dprecision3680", label: "Precision 3680", base: 550, image: "/devices/dell-optiplex-tower.webp" },
];

const LENOVO_DESKTOP_MODELS = [
  { id: "lnthinkm", label: "ThinkCentre M920", base: 300, image: "/devices/lenovo-thinkcentre-tower.webp" },
  { id: "lnthinkm90q", label: "ThinkCentre M90q Tiny", base: 350, image: "/devices/lenovo-thinkcentre-tiny.webp" },
  { id: "lnlegion5dtwr", label: "Legion Tower 5i", base: 550, image: "/devices/lenovo-thinkcentre-tower.webp" },
  { id: "lnlegion7dtwr", label: "Legion Tower 7i", base: 750, image: "/devices/lenovo-thinkcentre-tower.webp" },
  { id: "lnideactower", label: "IdeaCentre 5i", base: 250, image: "/devices/lenovo-thinkcentre-sff.webp" },
];

const HP_DESKTOP_MODELS = [
  { id: "hpelitedesk", label: "EliteDesk 800 G9", base: 400, image: "/devices/hp-elitedesk-800.webp" },
  { id: "hpprodesk", label: "ProDesk 400 G9", base: 280, image: "/devices/hp-prodesk-400.webp" },
  { id: "hpomendsk", label: "OMEN 45L Desktop", base: 650, image: "/devices/hp-omen-45l.webp" },
  { id: "hpomen40", label: "OMEN 40L Desktop", base: 500, image: "/devices/hp-omen-35l.webp" },
  { id: "hpenvy34", label: "Envy 34 All-in-One", base: 550, image: "/devices/lenovo-ideacentre.webp" },
  { id: "hppav32", label: "Pavilion 32 All-in-One", base: 380, image: "/devices/lenovo-ideacentre.webp" },
];

const ASUS_DESKTOP_MODELS = [
  { id: "asrogstrix", label: "ROG Strix G16CH", base: 700, image: "/devices/asus-rog-desktop.webp" },
  { id: "asroghyper", label: "ROG Hyperion", base: 1200, image: "/devices/asus-rog-desktop.webp" },
  { id: "asrogflow", label: "ROG NUC", base: 500, image: "/devices/asus-rog-desktop.webp" },
  { id: "astufgaming", label: "TUF Gaming Desktop", base: 450, image: "/devices/asus-rog-desktop.webp" },
  { id: "asexperpro", label: "ExpertCenter D5", base: 300, image: "/devices/asus-rog-desktop.webp" },
  { id: "asnuc14", label: "NUC 14 Pro", base: 350, image: "/devices/asus-rog-desktop.webp" },
];

// ASUS LAPTOPS — three-level tree mirroring itsworthmore.com.
// ROG splits into Strix/Zephyrus/Flow sub-series; TUF/ProArt/Vivobook/
// ExpertBook are flat. All inquiry-only (per Skywalker — ASUS pricing
// will be set on a per-quote basis until we have validated comp data).
const ASUS_ROG_STRIX_VARIANTS = [
  { id: "as_rog_strix_scar_18_g835", label: "ROG Strix Scar 18 G835", base: 0, inquiryOnly: true, image: "/devices/asus-rog-republic-of-gamers-strix-scar-18-g835.png" },
  { id: "as_rog_strix_scar_16_g635", label: "ROG Strix Scar 16 G635", base: 0, inquiryOnly: true, image: "/devices/asus-rog-republic-of-gamers-strix-scar-16-g635.png" },
  { id: "as_rog_strix_g16_g615", label: "ROG Strix G16 G615", base: 0, inquiryOnly: true, image: "/devices/asus-rog-republic-of-gamers-strix-g16-g615.png" },
  { id: "as_rog_strix_scar_18_g834", label: "ROG Strix Scar 18 G834", base: 0, inquiryOnly: true, image: "/devices/asus-rog-republic-of-gamers-strix-scar-18-g834.png" },
  { id: "as_rog_strix_g18_g815", label: "ROG Strix G18 G815", base: 0, inquiryOnly: true, image: "/devices/asus-rog-republic-of-gamers-strix-g18-g815.png" },
  { id: "as_rog_strix_scar_16_g634", label: "ROG Strix Scar 16 G634", base: 0, inquiryOnly: true, image: "/devices/asus-rog-republic-of-gamers-strix-scar-16-g634.png" },
  { id: "as_rog_strix_scar_17_g733", label: "ROG Strix Scar 17 G733", base: 0, inquiryOnly: true, image: "/devices/asus-rog-republic-of-gamers-strix-scar-17-g733.png" },
  { id: "as_rog_strix_g18_g814", label: "ROG Strix G18 G814", base: 0, inquiryOnly: true, image: "/devices/asus-rog-republic-of-gamers-strix-g18-g814.png" },
  { id: "as_rog_strix_scar_17_se_g733", label: "ROG Strix Scar 17 SE G733", base: 0, inquiryOnly: true, image: "/devices/asus-rog-republic-of-gamers-strix-scar-17-se-g733.png" },
  { id: "as_rog_strix_g16_g614", label: "ROG Strix G16 G614", base: 0, inquiryOnly: true, image: "/devices/asus-rog-republic-of-gamers-strix-g16-g614.png" },
  { id: "as_rog_strix_g17_g713", label: "ROG Strix G17 G713", base: 0, inquiryOnly: true, image: "/devices/asus-rog-republic-of-gamers-strix-g17-g713.png" },
  { id: "as_rog_strix_scar_15_g533", label: "ROG Strix Scar 15 G533", base: 0, inquiryOnly: true, image: "/devices/asus-rog-republic-of-gamers-strix-scar-15-g533.png" },
  { id: "as_rog_strix_g15_g513", label: "ROG Strix G15 G513", base: 0, inquiryOnly: true, image: "/devices/asus-rog-republic-of-gamers-strix-g15-g513.png" },
  { id: "as_rog_strix_scar_15_g532", label: "ROG Strix Scar 15 G532", base: 0, inquiryOnly: true, image: "/devices/asus-rog-republic-of-gamers-strix-scar-15-g532.png" },
  { id: "as_rog_strix_scar_17_g732", label: "ROG Strix Scar 17 G732", base: 0, inquiryOnly: true, image: "/devices/asus-rog-republic-of-gamers-strix-scar-17-g732.png" },
  { id: "as_rog_strix_g17_g712", label: "ROG Strix G17 G712", base: 0, inquiryOnly: true, image: "/devices/asus-rog-republic-of-gamers-strix-g17-g712.png" },
  { id: "as_rog_strix_g15_g512", label: "ROG Strix G15 G512", base: 0, inquiryOnly: true, image: "/devices/asus-rog-republic-of-gamers-strix-g15-g512.png" },
  { id: "as_rog_strix_g531", label: "ROG Strix G531", base: 0, inquiryOnly: true, image: "/devices/asus-rog-republic-of-gamers-strix-g531.png" },
  { id: "as_rog_strix_g731", label: "ROG Strix G731", base: 0, inquiryOnly: true, image: "/devices/asus-rog-republic-of-gamers-strix-g731.png" },
];
const ASUS_ROG_ZEPHYRUS_VARIANTS = [
  { id: "as_rog_zephyrus_g16_gu605", label: "ROG Zephyrus G16 GU605", base: 0, inquiryOnly: true, image: "/devices/asus-rog-republic-of-gamers-zephyrus-g16-gu605.png" },
  { id: "as_rog_zephyrus_duo_16_gx650", label: "ROG Zephyrus Duo 16 GX650", base: 0, inquiryOnly: true, image: "/devices/asus-rog-republic-of-gamers-zephyrus-duo-16-gx650.png" },
  { id: "as_rog_zephyrus_g14_ga403", label: "ROG Zephyrus G14 GA403", base: 0, inquiryOnly: true, image: "/devices/asus-rog-republic-of-gamers-zephyrus-g14-ga403.png" },
  { id: "as_rog_zephyrus_m16_gu604", label: "ROG Zephyrus M16 GU604", base: 0, inquiryOnly: true, image: "/devices/asus-rog-republic-of-gamers-zephyrus-m16-gu604.png" },
  { id: "as_rog_zephyrus_duo_15_se_gx551", label: "ROG Zephyrus Duo 15 SE GX551", base: 0, inquiryOnly: true, image: "/devices/asus-rog-republic-of-gamers-zephyrus-duo-15-se-gx551.png" },
  { id: "as_rog_zephyrus_g14_ga402", label: "ROG Zephyrus G14 GA402", base: 0, inquiryOnly: true, image: "/devices/asus-rog-republic-of-gamers-zephyrus-g14-ga402.png" },
  { id: "as_rog_zephyrus_g16_ga605", label: "ROG Zephyrus G16 GA605", base: 0, inquiryOnly: true, image: "/devices/asus-rog-republic-of-gamers-zephyrus-g16-ga605.png" },
  { id: "as_rog_zephyrus_g16_gu603", label: "ROG Zephyrus G16 GU603", base: 0, inquiryOnly: true, image: "/devices/asus-rog-republic-of-gamers-zephyrus-g16-gu603.png" },
  { id: "as_rog_zephyrus_duo_15_gx550", label: "ROG Zephyrus Duo 15 GX550", base: 0, inquiryOnly: true, image: "/devices/asus-rog-republic-of-gamers-zephyrus-duo-15-gx550.png" },
  { id: "as_rog_zephyrus_s17_gx703", label: "ROG Zephyrus S17 GX703", base: 0, inquiryOnly: true, image: "/devices/asus-rog-republic-of-gamers-zephyrus-s17-gx703.png" },
  { id: "as_rog_zephyrus_m16_gu603", label: "ROG Zephyrus M16 GU603", base: 0, inquiryOnly: true, image: "/devices/asus-rog-republic-of-gamers-zephyrus-m16-gu603.png" },
  { id: "as_rog_zephyrus_g15_ga503", label: "ROG Zephyrus G15 GA503", base: 0, inquiryOnly: true, image: "/devices/asus-rog-republic-of-gamers-zephyrus-g15-ga503.png" },
  { id: "as_rog_zephyrus_g14_ga401", label: "ROG Zephyrus G14 GA401", base: 0, inquiryOnly: true, image: "/devices/asus-rog-republic-of-gamers-zephyrus-g14-ga401.png" },
  { id: "as_rog_zephyrus_m15_gu502", label: "ROG Zephyrus M15 GU502", base: 0, inquiryOnly: true, image: "/devices/asus-rog-republic-of-gamers-zephyrus-m15-gu502.png" },
  { id: "as_rog_zephyrus_s15_gx502", label: "ROG Zephyrus S15 GX502", base: 0, inquiryOnly: true, image: "/devices/asus-rog-republic-of-gamers-zephyrus-s15-gx502.png" },
  { id: "as_rog_zephyrus_s17_gx701", label: "ROG Zephyrus S17 GX701", base: 0, inquiryOnly: true, image: "/devices/asus-rog-republic-of-gamers-zephyrus-s17-gx701.png" },
  { id: "as_rog_zephyrus_s_gx531", label: "ROG Zephyrus S GX531", base: 0, inquiryOnly: true, image: "/devices/asus-rog-republic-of-gamers-zephyrus-s-gx531.png" },
  { id: "as_rog_zephyrus_g15_ga502", label: "ROG Zephyrus G15 GA502", base: 0, inquiryOnly: true, image: "/devices/asus-rog-republic-of-gamers-zephyrus-g15-ga502.png" },
  { id: "as_rog_zephyrus_m_gm501", label: "ROG Zephyrus M GM501", base: 0, inquiryOnly: true, image: "/devices/asus-rog-republic-of-gamers-zephyrus-m-gm501.png" },
];
const ASUS_ROG_FLOW_VARIANTS = [
  { id: "as_rog_flow_x16_gv601", label: "ROG Flow X16 GV601", base: 0, inquiryOnly: true, image: "/devices/asus-rog-republic-of-gamers-flow-x16-gv601.png" },
  { id: "as_rog_flow_z13_gz302", label: "ROG Flow Z13 GZ302", base: 0, inquiryOnly: true, image: "/devices/asus-rog-republic-of-gamers-flow-z13-gz302.png" },
  { id: "as_rog_flow_z13_acrnm", label: "ROG Flow Z13 ACRNM RMT02 GZ301", base: 0, inquiryOnly: true, image: "/devices/asus-rog-republic-of-gamers-flow-z13-acrnm-rmt02-gz301.png" },
  { id: "as_rog_flow_z13_kjp_gz302", label: "ROG Flow Z13-KJP GZ302", base: 0, inquiryOnly: true, image: "/devices/asus-rog-republic-of-gamers-flow-z13-kjp-gz302.png" },
  { id: "as_rog_flow_z13_gz301", label: "ROG Flow Z13 GZ301", base: 0, inquiryOnly: true, image: "/devices/asus-rog-republic-of-gamers-flow-z13-gz301.png" },
  { id: "as_rog_flow_x13_gv302", label: "ROG Flow X13 GV302", base: 0, inquiryOnly: true, image: "/devices/asus-rog-republic-of-gamers-flow-x13-gv302.png" },
  { id: "as_rog_flow_x13_gv301", label: "ROG Flow X13 GV301", base: 0, inquiryOnly: true, image: "/devices/asus-rog-republic-of-gamers-flow-x13-gv301.png" },
];
const ASUS_ROG_SUB_SERIES = [
  { id: "asus_rog_strix", label: "ROG Strix", year: "Tournament-grade", topPrice: 0, variants: ASUS_ROG_STRIX_VARIANTS, inquiryOnly: true, image: "/devices/asus-rog-strix.webp" },
  { id: "asus_rog_zephyrus", label: "ROG Zephyrus", year: "Slim performance", topPrice: 0, variants: ASUS_ROG_ZEPHYRUS_VARIANTS, inquiryOnly: true, image: "/devices/asus-rog-zephyrus.webp" },
  { id: "asus_rog_flow", label: "ROG Flow", year: "Convertible / 2-in-1", topPrice: 0, variants: ASUS_ROG_FLOW_VARIANTS, inquiryOnly: true, image: "/devices/asus-rog-zephyrus.webp" },
];
const ASUS_TUF_VARIANTS = [
  { id: "as_tuf_a18", label: "TUF A18", base: 0, inquiryOnly: true, image: "/devices/asus-tuf-tuf-a18-laptop.png" },
  { id: "as_tuf_a17", label: "TUF A17", base: 0, inquiryOnly: true, image: "/devices/asus-tuf-tuf-a17-laptop.png" },
  { id: "as_tuf_a16", label: "TUF A16", base: 0, inquiryOnly: true, image: "/devices/asus-tuf-tuf-a16-laptop.png" },
  { id: "as_tuf_a15", label: "TUF A15", base: 0, inquiryOnly: true, image: "/devices/asus-tuf-tuf-a15-laptop.png" },
  { id: "as_tuf_a14", label: "TUF A14", base: 0, inquiryOnly: true, image: "/devices/asus-tuf-tuf-a14-laptop.png" },
  { id: "as_tuf_f17", label: "TUF F17", base: 0, inquiryOnly: true, image: "/devices/asus-tuf-tuf-f17-laptop.png" },
  { id: "as_tuf_f16", label: "TUF F16", base: 0, inquiryOnly: true, image: "/devices/asus-tuf-tuf-f16-laptop.png" },
  { id: "as_tuf_f15", label: "TUF F15", base: 0, inquiryOnly: true, image: "/devices/asus-tuf-tuf-f15-laptop.png" },
];
const ASUS_PROART_VARIANTS = [
  { id: "as_proart_studiobook_pro_16", label: "ProArt Studiobook Pro 16", base: 0, inquiryOnly: true, image: "/devices/asus-proart-proart-studiobook-pro-16.png" },
  { id: "as_proart_studiobook_16", label: "ProArt Studiobook 16", base: 0, inquiryOnly: true, image: "/devices/asus-proart-proart-studiobook-16.png" },
  { id: "as_proart_p16", label: "ProArt P16", base: 0, inquiryOnly: true, image: "/devices/asus-proart-proart-p16.png" },
  { id: "as_proart_px13", label: "ProArt PX13", base: 0, inquiryOnly: true, image: "/devices/asus-proart-proart-px13.png" },
  { id: "as_proart_pz13", label: "ProArt PZ13", base: 0, inquiryOnly: true, image: "/devices/asus-proart-proart-pz13.png" },
];
const ASUS_VIVOBOOK_VARIANTS = [
  { id: "as_vivobook_16", label: "Vivobook 16", base: 0, inquiryOnly: true, image: "/devices/asus-vivobook.webp" },
  { id: "as_vivobook_15", label: "Vivobook 15", base: 0, inquiryOnly: true, image: "/devices/asus-vivobook.webp" },
  { id: "as_vivobook_14", label: "Vivobook 14", base: 0, inquiryOnly: true, image: "/devices/asus-vivobook.webp" },
];
const ASUS_EXPERTBOOK_VARIANTS = [
  { id: "as_expertbook_p1", label: "ExpertBook P1", base: 0, inquiryOnly: true, image: "/devices/asus-expertbook-expertbook-p1.png" },
  { id: "as_expertbook_p5", label: "ExpertBook P5", base: 0, inquiryOnly: true, image: "/devices/asus-expertbook-expertbook-p5.png" },
  { id: "as_expertbook_b9", label: "ExpertBook B9", base: 0, inquiryOnly: true, image: "/devices/asus-expertbook-expertbook-b9.png" },
  { id: "as_expertbook_b5", label: "ExpertBook B5", base: 0, inquiryOnly: true, image: "/devices/asus-expertbook-expertbook-b5.png" },
  { id: "as_expertbook_b3", label: "ExpertBook B3", base: 0, inquiryOnly: true, image: "/devices/asus-expertbook-expertbook-b3.png" },
  { id: "as_expertbook_b2", label: "ExpertBook B2", base: 0, inquiryOnly: true, image: "/devices/asus-expertbook-expertbook-b2.png" },
];
const ASUS_PC_SERIES = [
  { id: "asus_rog", label: "ROG", year: "Republic of Gamers", topPrice: 0, subSeries: ASUS_ROG_SUB_SERIES, inquiryOnly: true, image: "/devices/asus-rog-strix.webp" },
  { id: "asus_tuf", label: "TUF Gaming", year: "The Ultimate Force", topPrice: 0, variants: ASUS_TUF_VARIANTS, inquiryOnly: true, image: "/devices/asus-tuf-gaming.webp" },
  { id: "asus_proart", label: "ProArt", year: "Creator / Studiobook", topPrice: 0, variants: ASUS_PROART_VARIANTS, inquiryOnly: true, image: "/devices/asus-proart-proart-p16.png" },
  { id: "asus_vivobook", label: "Vivobook", year: "Everyday", topPrice: 0, variants: ASUS_VIVOBOOK_VARIANTS, inquiryOnly: true, image: "/devices/asus-vivobook.webp" },
  { id: "asus_expertbook", label: "ExpertBook", year: "Business", topPrice: 0, variants: ASUS_EXPERTBOOK_VARIANTS, inquiryOnly: true, image: "/devices/asus-expertbook-expertbook-b9.png" },
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
  { id: "d_xps_13_9345", label: "XPS 13 9345", base: 0, inquiryOnly: true, image: "/devices/dell-xps-xps_13-13_xps-13-9345.png" },
  { id: "d_xps_13_9340", label: "XPS 13 9340", base: 0, inquiryOnly: true, image: "/devices/dell-xps-xps_13-13_xps-13-9340.png" },
  { id: "d_xps_13_plus_9320", label: "XPS 13 Plus 9320", base: 0, inquiryOnly: true, image: "/devices/dell-xps-xps_13-13_xps-13-plus-9320.png" },
  { id: "d_xps_13_9315", label: "XPS 13 9315", base: 0, inquiryOnly: true, image: "/devices/dell-xps-xps_13-13_xps-13-9315.png" },
  { id: "d_xps_13_9315_2in1", label: "XPS 13 9315 2-in-1", base: 0, inquiryOnly: true, image: "/devices/dell-xps-xps_13-13_xps-13-9315-2-in-1.png" },
  { id: "d_xps_13_9310", label: "XPS 13 9310", base: 0, inquiryOnly: true, image: "/devices/dell-xps-xps_13-13_xps-13-9310.png" },
  { id: "d_xps_13_9310_2in1", label: "XPS 13 9310 2-in-1", base: 0, inquiryOnly: true, image: "/devices/dell-xps-xps_13-13_xps-13-9310-2-in-1.png" },
  { id: "d_xps_13_9305", label: "XPS 13 9305", base: 0, inquiryOnly: true, image: "/devices/dell-xps-xps_13-13_xps-13-9305.png" },
  { id: "d_xps_13_9300", label: "XPS 13 9300", base: 0, inquiryOnly: true, image: "/devices/dell-xps-xps_13-13_xps-13-9300.png" },
  { id: "d_xps_13_7390", label: "XPS 13 7390", base: 0, inquiryOnly: true, image: "/devices/dell-xps-xps_13-13_xps-13-7390.png" },
  { id: "d_xps_13_7390_2in1", label: "XPS 13 7390 2-in-1", base: 0, inquiryOnly: true, image: "/devices/dell-xps-xps_13-13_xps-13-7390-2-in-1.png" },
  { id: "d_xps_13_9380", label: "XPS 13 9380", base: 0, inquiryOnly: true, image: "/devices/dell-xps-xps_13-13_xps-13-9380.png" },
  { id: "d_xps_13_9370", label: "XPS 13 9370", base: 0, inquiryOnly: true, image: "/devices/dell-xps-xps_13-13_xps-13-9370.png" },
  { id: "d_xps_13_9365_2in1", label: "XPS 13 9365 2-in-1", base: 0, inquiryOnly: true, image: "/devices/dell-xps-xps_13-13_xps-13-9365-2-in-1.png" },
  { id: "d_xps_13_9360", label: "XPS 13 9360", base: 0, inquiryOnly: true, image: "/devices/dell-xps-xps_13-13_xps-13-9360.png" },
  { id: "d_xps_13_9350", label: "XPS 13 9350", base: 0, inquiryOnly: true, image: "/devices/dell-xps-xps_13-13_xps-13-9350.png" },
];
const DELL_XPS_14_VARIANTS = [
  { id: "d_xps_14_9440", label: "XPS 14 9440", base: 0, inquiryOnly: true, image: "/devices/dell-xps-xps_14-14_xps-14-9440.png" },
  { id: "d_xps_14_da14260", label: "XPS 14 DA14260", base: 0, inquiryOnly: true, image: "/devices/dell-xps-xps_14-14_xps-14-da14260.png" },
];
const DELL_XPS_15_VARIANTS = [
  { id: "d_xps_15_9530", label: "XPS 15 9530", base: 0, inquiryOnly: true, image: "/devices/dell-xps-xps_15-15_xps-15-9530.png" },
  { id: "d_xps_15_9520", label: "XPS 15 9520", base: 0, inquiryOnly: true, image: "/devices/dell-xps-xps_15-15_xps-15-9520.png" },
  { id: "d_xps_15_9510", label: "XPS 15 9510", base: 0, inquiryOnly: true, image: "/devices/dell-xps-xps_15-15_xps-15-9510.png" },
  { id: "d_xps_15_9500", label: "XPS 15 9500", base: 0, inquiryOnly: true, image: "/devices/dell-xps-xps_15-15_xps-15-9500.png" },
  { id: "d_xps_15_7590", label: "XPS 15 7590", base: 0, inquiryOnly: true, image: "/devices/dell-xps-xps_15-15_xps-15-7590.png" },
  { id: "d_xps_15_9575_2in1", label: "XPS 15 9575 2-in-1", base: 0, inquiryOnly: true, image: "/devices/dell-xps-xps_15-15_xps-15-9575-2-in-1.png" },
  { id: "d_xps_15_9570", label: "XPS 15 9570", base: 0, inquiryOnly: true, image: "/devices/dell-xps-xps_15-15_xps-15-9570.png" },
  { id: "d_xps_15_9560", label: "XPS 15 9560", base: 0, inquiryOnly: true, image: "/devices/dell-xps-xps_15-15_xps-15-9560.png" },
  { id: "d_xps_15_9550", label: "XPS 15 9550", base: 0, inquiryOnly: true, image: "/devices/dell-xps-xps_15-15_xps-15-9550.png" },
];
const DELL_XPS_16_VARIANTS = [
  { id: "d_xps_16_9640", label: "XPS 16 9640", base: 0, inquiryOnly: true, image: "/devices/dell-xps-xps_16-16_xps-16-9640.png" },
  { id: "d_xps_16_da16260", label: "XPS 16 DA16260", base: 0, inquiryOnly: true, image: "/devices/dell-xps-xps_16-16_xps-16-da16260.png" },
];
const DELL_XPS_17_VARIANTS = [
  { id: "d_xps_17_9730", label: "XPS 17 9730", base: 0, inquiryOnly: true, image: "/devices/dell-xps-xps_17-17_xps-17-9730.png" },
  { id: "d_xps_17_9720", label: "XPS 17 9720", base: 0, inquiryOnly: true, image: "/devices/dell-xps-xps_17-17_xps-17-9720.png" },
  { id: "d_xps_17_9710", label: "XPS 17 9710", base: 0, inquiryOnly: true, image: "/devices/dell-xps-xps_17-17_xps-17-9710.png" },
  { id: "d_xps_17_9700", label: "XPS 17 9700", base: 0, inquiryOnly: true, image: "/devices/dell-xps-xps_17-17_xps-17-9700.png" },
];
const DELL_LATITUDE_3000_VARIANTS = [
  { id: "d_lat_3500", label: "Latitude 3500 Series", base: 0, inquiryOnly: true, image: "/devices/dell-latitude-latitude_3000-3000_latitude-3000-15.png" },
  { id: "d_lat_3400", label: "Latitude 3400 Series", base: 0, inquiryOnly: true, image: "/devices/dell-latitude-latitude_3000-3000_latitude-3000-14.png" },
  { id: "d_lat_3300", label: "Latitude 3300 Series", base: 0, inquiryOnly: true, image: "/devices/dell-latitude-latitude_3000-3000_latitude-3000-13.png" },
];
const DELL_LATITUDE_5000_VARIANTS = [
  { id: "d_lat_5500", label: "Latitude 5500 Series", base: 0, inquiryOnly: true, image: "/devices/dell-latitude-latitude_5000-5000_latitude-5000-15.png" },
  { id: "d_lat_5400", label: "Latitude 5400 Series", base: 0, inquiryOnly: true, image: "/devices/dell-latitude-latitude_5000-5000_latitude-5000-14.png" },
  { id: "d_lat_5300", label: "Latitude 5300 Series", base: 0, inquiryOnly: true, image: "/devices/dell-latitude-latitude_5000-5000_latitude-5000-13.png" },
  { id: "d_lat_5200", label: "Latitude 5200 Series", base: 0, inquiryOnly: true, image: "/devices/dell-latitude-latitude_5000-5000_latitude-5000-12.png" },
];
const DELL_LATITUDE_7000_VARIANTS = [
  { id: "d_lat_7600", label: "Latitude 7600 Series", base: 0, inquiryOnly: true, image: "/devices/dell-latitude-latitude_7000-7000_latitude-7000-16.png" },
  { id: "d_lat_7500", label: "Latitude 7500 Series", base: 0, inquiryOnly: true, image: "/devices/dell-latitude-latitude_7000-7000_latitude-7000-15.png" },
  { id: "d_lat_7400", label: "Latitude 7400 Series", base: 0, inquiryOnly: true, image: "/devices/dell-latitude-latitude_7000-7000_latitude-7000-14.png" },
  { id: "d_lat_7300", label: "Latitude 7300 Series", base: 0, inquiryOnly: true, image: "/devices/dell-latitude-latitude_7000-7000_latitude-7000-13.png" },
  { id: "d_lat_7200", label: "Latitude 7200 Series", base: 0, inquiryOnly: true, image: "/devices/dell-latitude-latitude_7000-7000_latitude-7000-12.png" },
];
const DELL_LATITUDE_9000_VARIANTS = [
  { id: "d_lat_9500", label: "Latitude 9500 Series", base: 0, inquiryOnly: true, image: "/devices/dell-latitude-latitude_9000-9000_latitude-9000-15.png" },
  { id: "d_lat_9400", label: "Latitude 9400 Series", base: 0, inquiryOnly: true, image: "/devices/dell-latitude-latitude_9000-9000_latitude-9000-14.png" },
  { id: "d_lat_9300", label: "Latitude 9300 Series", base: 0, inquiryOnly: true, image: "/devices/dell-latitude-latitude_9000-9000_latitude-9000-13.png" },
];
const DELL_INSPIRON_3000_VARIANTS = [
  { id: "d_insp_3700", label: "Inspiron 3700 Series", base: 0, inquiryOnly: true, image: "/devices/dell-inspiron-inspiron_3000-3000_inspiron-3000-17.png" },
  { id: "d_insp_3500", label: "Inspiron 3500 Series", base: 0, inquiryOnly: true, image: "/devices/dell-inspiron-inspiron_3000-3000_inspiron-3000-15.png" },
  { id: "d_insp_3400", label: "Inspiron 3400 Series", base: 0, inquiryOnly: true, image: "/devices/dell-inspiron-inspiron_3000-3000_inspiron-3000-14.png" },
];
const DELL_INSPIRON_5000_VARIANTS = [
  { id: "d_insp_5700", label: "Inspiron 5700 Series", base: 0, inquiryOnly: true, image: "/devices/dell-inspiron-inspiron_5000-5000_inspiron-5000-17.png" },
  { id: "d_insp_5600", label: "Inspiron 5600 Series", base: 0, inquiryOnly: true, image: "/devices/dell-inspiron-inspiron_5000-5000_inspiron-5000-16.png" },
  { id: "d_insp_5500", label: "Inspiron 5500 Series", base: 0, inquiryOnly: true, image: "/devices/dell-inspiron-inspiron_5000-5000_inspiron-5000-15.png" },
  { id: "d_insp_5400", label: "Inspiron 5400 Series", base: 0, inquiryOnly: true, image: "/devices/dell-inspiron-inspiron_5000-5000_inspiron-5000-14.png" },
  { id: "d_insp_5300", label: "Inspiron 5300 Series", base: 0, inquiryOnly: true, image: "/devices/dell-inspiron-inspiron_5000-5000_inspiron-5000-13.png" },
];
const DELL_INSPIRON_7000_VARIANTS = [
  { id: "d_insp_7700", label: "Inspiron 7700 Series", base: 0, inquiryOnly: true, image: "/devices/dell-inspiron-inspiron_7000-7000_inspiron-7000-17.png" },
  { id: "d_insp_7600", label: "Inspiron 7600 Series", base: 0, inquiryOnly: true, image: "/devices/dell-inspiron-inspiron_7000-7000_inspiron-7000-16.png" },
  { id: "d_insp_7500", label: "Inspiron 7500 Series", base: 0, inquiryOnly: true, image: "/devices/dell-inspiron-inspiron_7000-7000_inspiron-7000-15.png" },
  { id: "d_insp_7400", label: "Inspiron 7400 Series", base: 0, inquiryOnly: true, image: "/devices/dell-inspiron-inspiron_7000-7000_inspiron-7000-14.png" },
  { id: "d_insp_7300", label: "Inspiron 7300 Series", base: 0, inquiryOnly: true, image: "/devices/dell-inspiron-inspiron_7000-7000_inspiron-7000-13.png" },
];
const DELL_PRECISION_3000_VARIANTS = [
  { id: "d_prec_3500", label: "Precision 3500 Series", base: 0, inquiryOnly: true, image: "/devices/dell-precision-precision_3000-3000_precision-3000-series-15.png" },
  { id: "d_prec_3400", label: "Precision 3400 Series", base: 0, inquiryOnly: true, image: "/devices/dell-precision-precision_3000-3000_precision-3000-series-14.png" },
];
const DELL_PRECISION_5000_VARIANTS = [
  { id: "d_prec_5560", label: "Precision 5560", base: 0, inquiryOnly: true, image: "/devices/dell-precision-precision_3000-3000_precision-3000-series-15.png" },
  { id: "d_prec_5550", label: "Precision 5550", base: 0, inquiryOnly: true, image: "/devices/dell-precision-precision_3000-3000_precision-3000-series-15.png" },
  { id: "d_prec_5540", label: "Precision 5540", base: 0, inquiryOnly: true, image: "/devices/dell-precision-precision_3000-3000_precision-3000-series-15.png" },
];
const DELL_PRECISION_7000_VARIANTS = [
  { id: "d_prec_7780", label: "Precision 7780", base: 0, inquiryOnly: true, image: "/devices/dell-precision-precision_3000-3000_precision-3000-series-15.png" },
  { id: "d_prec_7770", label: "Precision 7770", base: 0, inquiryOnly: true, image: "/devices/dell-precision-precision_3000-3000_precision-3000-series-15.png" },
  { id: "d_prec_7760", label: "Precision 7760", base: 0, inquiryOnly: true, image: "/devices/dell-precision-precision_3000-3000_precision-3000-series-15.png" },
  { id: "d_prec_7560", label: "Precision 7560", base: 0, inquiryOnly: true, image: "/devices/dell-precision-precision_3000-3000_precision-3000-series-15.png" },
];
const DELL_VOSTRO_3000_VARIANTS = [
  { id: "d_vostro_3535", label: "Vostro 3535", base: 0, inquiryOnly: true, image: "/devices/dell-vostro-vostro_3000-3000_3535.png" },
  { id: "d_vostro_3530", label: "Vostro 3530", base: 0, inquiryOnly: true, image: "/devices/dell-vostro-vostro_3000-3000_3530.png" },
  { id: "d_vostro_3520", label: "Vostro 3520", base: 0, inquiryOnly: true, image: "/devices/dell-vostro-vostro_3000-3000_3520.png" },
  { id: "d_vostro_3510", label: "Vostro 3510", base: 0, inquiryOnly: true, image: "/devices/dell-vostro-vostro_3000-3000_3510.png" },
  { id: "d_vostro_3500", label: "Vostro 3500", base: 0, inquiryOnly: true, image: "/devices/dell-latitude-latitude_3000-3000_latitude-3000-15.png" },
  { id: "d_vostro_3430", label: "Vostro 3430", base: 0, inquiryOnly: true, image: "/devices/dell-vostro-vostro_3000-3000_3430.png" },
  { id: "d_vostro_3420", label: "Vostro 3420", base: 0, inquiryOnly: true, image: "/devices/dell-vostro-vostro_3000-3000_3420.png" },
  { id: "d_vostro_3591", label: "Vostro 3591", base: 0, inquiryOnly: true, image: "/devices/dell-vostro-vostro_3000-3000_3591.png" },
  { id: "d_vostro_3590", label: "Vostro 3590", base: 0, inquiryOnly: true, image: "/devices/dell-vostro-vostro_3000-3000_3590.png" },
];
const DELL_VOSTRO_5000_VARIANTS = [
  { id: "d_vostro_5630", label: "Vostro 5630", base: 0, inquiryOnly: true, image: "/devices/dell-vostro-vostro_5000-5000_5630.png" },
  { id: "d_vostro_5620", label: "Vostro 5620", base: 0, inquiryOnly: true, image: "/devices/dell-vostro-vostro_5000-5000_5620.png" },
  { id: "d_vostro_5590", label: "Vostro 5590", base: 0, inquiryOnly: true, image: "/devices/dell-vostro-vostro_5000-5000_5590.png" },
  { id: "d_vostro_5581", label: "Vostro 5581", base: 0, inquiryOnly: true, image: "/devices/dell-vostro-vostro_5000-5000_5581.png" },
  { id: "d_vostro_5510", label: "Vostro 5510", base: 0, inquiryOnly: true, image: "/devices/dell-vostro-vostro_5000-5000_5510.png" },
  { id: "d_vostro_5502", label: "Vostro 5502", base: 0, inquiryOnly: true, image: "/devices/dell-vostro-vostro_5000-5000_5502.png" },
  { id: "d_vostro_5501", label: "Vostro 5501", base: 0, inquiryOnly: true, image: "/devices/dell-vostro-vostro_5000-5000_5501.png" },
  { id: "d_vostro_5490", label: "Vostro 5490", base: 0, inquiryOnly: true, image: "/devices/dell-vostro-vostro_5000-5000_5490.png" },
  { id: "d_vostro_5410", label: "Vostro 5410", base: 0, inquiryOnly: true, image: "/devices/dell-vostro-vostro_5000-5000_5410.png" },
  { id: "d_vostro_5402", label: "Vostro 5402", base: 0, inquiryOnly: true, image: "/devices/dell-vostro-vostro_5000-5000_5402.png" },
  { id: "d_vostro_5401", label: "Vostro 5401", base: 0, inquiryOnly: true, image: "/devices/dell-vostro-vostro_5000-5000_5401.png" },
  { id: "d_vostro_5301", label: "Vostro 5301", base: 0, inquiryOnly: true, image: "/devices/dell-vostro-vostro_5000-5000_5301.png" },
];
const DELL_VOSTRO_7000_VARIANTS = [
  { id: "d_vostro_7620", label: "Vostro 7620", base: 0, inquiryOnly: true, image: "/devices/dell-vostro-vostro_7000-7000_7620.png" },
  { id: "d_vostro_7590", label: "Vostro 7590", base: 0, inquiryOnly: true, image: "/devices/dell-xps-xps_15-15_xps-15-7590.png" },
  { id: "d_vostro_7510", label: "Vostro 7510", base: 0, inquiryOnly: true, image: "/devices/dell-vostro-vostro_7000-7000_7510.png" },
  { id: "d_vostro_7500", label: "Vostro 7500", base: 0, inquiryOnly: true, image: "/devices/dell-latitude-latitude_7000-7000_latitude-7000-15.png" },
];
const DELL_G3_VARIANTS = [
  { id: "d_g3_3779", label: "G3 3779", base: 0, inquiryOnly: true, image: "/devices/dell-g_series-g3-3779.png" },
  { id: "d_g3_3590", label: "G3 3590", base: 0, inquiryOnly: true, image: "/devices/dell-g_series-g3-3590.png" },
  { id: "d_g3_3579", label: "G3 3579", base: 0, inquiryOnly: true, image: "/devices/dell-g_series-g3-3579.png" },
  { id: "d_g3_3500", label: "G3 3500", base: 0, inquiryOnly: true, image: "/devices/dell-g_series-g3-3500.png" },
];
const DELL_G5_VARIANTS = [
  { id: "d_g5_5590", label: "G5 5590", base: 0, inquiryOnly: true, image: "/devices/dell-g_series-g5-5590.png" },
  { id: "d_g5_5587", label: "G5 5587", base: 0, inquiryOnly: true, image: "/devices/dell-g_series-g5-5587.png" },
  { id: "d_g5_5505_se", label: "G5 5505 SE", base: 0, inquiryOnly: true, image: "/devices/dell-g_series-g5-5505-se.png" },
  { id: "d_g5_5500", label: "G5 5500", base: 0, inquiryOnly: true, image: "/devices/dell-g_series-g5-5500.png" },
];
const DELL_G7_VARIANTS = [
  { id: "d_g7_7790", label: "G7 7790", base: 0, inquiryOnly: true, image: "/devices/d_g7_7790.png" },
  { id: "d_g7_7700", label: "G7 7700", base: 0, inquiryOnly: true, image: "/devices/d_g7_7700.png" },
  { id: "d_g7_7590", label: "G7 7590", base: 0, inquiryOnly: true, image: "/devices/dell-g_series-g7-7590.png" },
  { id: "d_g7_7588", label: "G7 7588", base: 0, inquiryOnly: true, image: "/devices/dell-g_series-g7-7588.png" },
  { id: "d_g7_7500", label: "G7 7500", base: 0, inquiryOnly: true, image: "/devices/dell-g_series-g7-7500.png" },
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
  { id: "d_pro_13_premium_pa13250", label: "Dell Pro 13 Premium PA13250", base: 0, inquiryOnly: true, image: "/devices/d_pro_13_premium_pa13250.png" },
  { id: "d_pro_13_plus_pb13255", label: "Dell Pro 13 Plus PB13255", base: 0, inquiryOnly: true, image: "/devices/d_pro_13_plus_pb13255.png" },
  { id: "d_pro_13_plus_pb13250", label: "Dell Pro 13 Plus PB13250", base: 0, inquiryOnly: true, image: "/devices/d_pro_13_plus_pb13250.png" },
  { id: "d_pro_13_plus_2in1_pb13255", label: "Dell Pro 13 Plus (2-in-1) PB13255", base: 0, inquiryOnly: true, image: "/devices/d_pro_13_plus_2in1_pb13255.png" },
  { id: "d_pro_13_plus_2in1_pb13250", label: "Dell Pro 13 Plus (2-in-1) PB13250", base: 0, inquiryOnly: true, image: "/devices/d_pro_13_plus_2in1_pb13250.png" },
];
const DELL_PRO_14_VARIANTS = [
  { id: "d_pro_14_premium_pa14250", label: "Dell Pro 14 Premium PA14250", base: 0, inquiryOnly: true, image: "/devices/d_pro_14_premium_pa14250.png" },
  { id: "d_pro_14_plus_pb14255", label: "Dell Pro 14 Plus PB14255", base: 0, inquiryOnly: true, image: "/devices/d_pro_14_plus_pb14255.png" },
  { id: "d_pro_14_plus_pb14250", label: "Dell Pro 14 Plus PB14250", base: 0, inquiryOnly: true, image: "/devices/d_pro_14_plus_pb14250.png" },
  { id: "d_pro_14_plus_2in1_pb14255", label: "Dell Pro 14 Plus (2-in-1) PB14255", base: 0, inquiryOnly: true, image: "/devices/d_pro_14_plus_2in1_pb14255.png" },
  { id: "d_pro_14_plus_2in1_pb14250", label: "Dell Pro 14 Plus (2-in-1) PB14250", base: 0, inquiryOnly: true, image: "/devices/d_pro_14_plus_2in1_pb14250.png" },
  { id: "d_pro_14_pc14255", label: "Dell Pro 14 PC14255", base: 0, inquiryOnly: true, image: "/devices/d_pro_14_pc14255.png" },
  { id: "d_pro_14_pc14250", label: "Dell Pro 14 PC14250", base: 0, inquiryOnly: true, image: "/devices/d_pro_14_pc14250.png" },
  { id: "d_pro_14_essential_pv14255", label: "Dell Pro 14 Essential PV14255", base: 0, inquiryOnly: true, image: "/devices/d_pro_14_essential_pv14255.png" },
  { id: "d_pro_14_essential_pv14250", label: "Dell Pro 14 Essential PV14250", base: 0, inquiryOnly: true, image: "/devices/d_pro_14_essential_pv14250.png" },
  { id: "d_pro_max_14_premium_ma14250", label: "Dell Pro Max 14 Premium MA14250", base: 0, inquiryOnly: true, image: "/devices/d_pro_max_14_premium_ma14250.png" },
  { id: "d_pro_max_14_mc14255", label: "Dell Pro Max 14 MC14255", base: 0, inquiryOnly: true, image: "/devices/d_pro_max_14_mc14255.png" },
  { id: "d_pro_max_14_mc14250", label: "Dell Pro Max 14 MC14250", base: 0, inquiryOnly: true, image: "/devices/d_pro_max_14_mc14250.png" },
];
const DELL_PRO_16_VARIANTS = [
  { id: "d_pro_max_16_premium_ma16250", label: "Dell Pro Max 16 Premium MA16250", base: 0, inquiryOnly: true, image: "/devices/d_pro_max_16_premium_ma16250.png" },
  { id: "d_pro_max_16_plus_mb16250", label: "Dell Pro Max 16 Plus MB16250", base: 0, inquiryOnly: true, image: "/devices/d_pro_max_16_plus_mb16250.png" },
  { id: "d_pro_max_16_mc16255", label: "Dell Pro Max 16 MC16255", base: 0, inquiryOnly: true, image: "/devices/d_pro_max_16_mc16255.png" },
  { id: "d_pro_max_16_mc16250", label: "Dell Pro Max 16 MC16250", base: 0, inquiryOnly: true, image: "/devices/d_pro_max_16_mc16250.png" },
  { id: "d_pro_16_plus_pb16255", label: "Dell Pro 16 Plus PB16255", base: 0, inquiryOnly: true, image: "/devices/d_pro_16_plus_pb16255.png" },
  { id: "d_pro_16_plus_pb16250", label: "Dell Pro 16 Plus PB16250", base: 0, inquiryOnly: true, image: "/devices/d_pro_16_plus_pb16250.png" },
  { id: "d_pro_16_pc16255", label: "Dell Pro 16 PC16255", base: 0, inquiryOnly: true, image: "/devices/d_pro_16_pc16255.png" },
  { id: "d_pro_16_pc16250", label: "Dell Pro 16 PC16250", base: 0, inquiryOnly: true, image: "/devices/d_pro_16_pc16250.png" },
];
const DELL_LAT_RUGGED_VARIANTS = [
  { id: "d_lat_rugged_5430", label: "Latitude 5430 Rugged", base: 0, inquiryOnly: true, image: "/devices/d_lat_rugged_5430.png" },
  { id: "d_lat_rugged_7330_extreme", label: "Latitude 7330 Rugged Extreme", base: 0, inquiryOnly: true, image: "/devices/d_lat_rugged_7330_extreme.png" },
];

const DELL_XPS_SUB_SERIES = [
  { id: "dell_xps_13", label: "XPS 13", year: "13-inch", topPrice: 0, variants: DELL_XPS_13_VARIANTS, inquiryOnly: true, image: "/devices/dell-xps.webp" },
  { id: "dell_xps_14", label: "XPS 14", year: "14-inch", topPrice: 0, variants: DELL_XPS_14_VARIANTS, inquiryOnly: true, image: "/devices/dell-xps.webp" },
  { id: "dell_xps_15", label: "XPS 15", year: "15-inch", topPrice: 0, variants: DELL_XPS_15_VARIANTS, inquiryOnly: true, image: "/devices/dell-xps.webp" },
  { id: "dell_xps_16", label: "XPS 16", year: "16-inch", topPrice: 0, variants: DELL_XPS_16_VARIANTS, inquiryOnly: true, image: "/devices/dell-xps.webp" },
  { id: "dell_xps_17", label: "XPS 17", year: "17-inch", topPrice: 0, variants: DELL_XPS_17_VARIANTS, inquiryOnly: true, image: "/devices/dell-xps.webp" },
];
const DELL_LATITUDE_SUB_SERIES = [
  { id: "dell_lat_3000", label: "Latitude 3000", year: "Entry business", topPrice: 0, variants: DELL_LATITUDE_3000_VARIANTS, inquiryOnly: true, image: "/devices/dell-latitude.jpg" },
  { id: "dell_lat_5000", label: "Latitude 5000", year: "Mainstream", topPrice: 0, variants: DELL_LATITUDE_5000_VARIANTS, inquiryOnly: true, image: "/devices/dell-latitude.jpg" },
  { id: "dell_lat_7000", label: "Latitude 7000", year: "Premium", topPrice: 0, variants: DELL_LATITUDE_7000_VARIANTS, inquiryOnly: true, image: "/devices/dell-latitude.jpg" },
  { id: "dell_lat_9000", label: "Latitude 9000", year: "Ultra-premium", topPrice: 0, variants: DELL_LATITUDE_9000_VARIANTS, inquiryOnly: true, image: "/devices/dell-latitude.jpg" },
];
const DELL_INSPIRON_SUB_SERIES = [
  { id: "dell_insp_3000", label: "Inspiron 3000", year: "Essential", topPrice: 0, variants: DELL_INSPIRON_3000_VARIANTS, inquiryOnly: true, image: "/devices/dell-inspiron-15.webp" },
  { id: "dell_insp_5000", label: "Inspiron 5000", year: "Mainstream", topPrice: 0, variants: DELL_INSPIRON_5000_VARIANTS, inquiryOnly: true, image: "/devices/dell-inspiron-15.webp" },
  { id: "dell_insp_7000", label: "Inspiron 7000", year: "Performance", topPrice: 0, variants: DELL_INSPIRON_7000_VARIANTS, inquiryOnly: true, image: "/devices/dell-inspiron-15.webp" },
];
const DELL_PRECISION_SUB_SERIES = [
  { id: "dell_prec_3000", label: "Precision 3000", year: "Entry mobile WS", topPrice: 0, variants: DELL_PRECISION_3000_VARIANTS, inquiryOnly: true, image: "/devices/dell-latitude.jpg" },
  { id: "dell_prec_5000", label: "Precision 5000", year: "Performance mobile", topPrice: 0, variants: DELL_PRECISION_5000_VARIANTS, inquiryOnly: true, image: "/devices/dell-latitude.jpg" },
  { id: "dell_prec_7000", label: "Precision 7000", year: "Ultimate mobile", topPrice: 0, variants: DELL_PRECISION_7000_VARIANTS, inquiryOnly: true, image: "/devices/dell-latitude.jpg" },
];
const DELL_VOSTRO_SUB_SERIES = [
  { id: "dell_vostro_3000", label: "Vostro 3000", year: "Small business", topPrice: 0, variants: DELL_VOSTRO_3000_VARIANTS, inquiryOnly: true, image: "/devices/dell-inspiron-15.webp" },
  { id: "dell_vostro_5000", label: "Vostro 5000", year: "Mid-range", topPrice: 0, variants: DELL_VOSTRO_5000_VARIANTS, inquiryOnly: true, image: "/devices/dell-inspiron-15.webp" },
  { id: "dell_vostro_7000", label: "Vostro 7000", year: "Performance", topPrice: 0, variants: DELL_VOSTRO_7000_VARIANTS, inquiryOnly: true, image: "/devices/dell-inspiron-15.webp" },
];
const DELL_G_SUB_SERIES = [
  { id: "dell_g3", label: "G3", year: "Entry gaming", topPrice: 0, variants: DELL_G3_VARIANTS, inquiryOnly: true, image: "/devices/dell-xps.webp" },
  { id: "dell_g5", label: "G5", year: "Mid gaming", topPrice: 0, variants: DELL_G5_VARIANTS, inquiryOnly: true, image: "/devices/dell-xps.webp" },
  { id: "dell_g7", label: "G7", year: "Performance gaming", topPrice: 0, variants: DELL_G7_VARIANTS, inquiryOnly: true, image: "/devices/dell-xps.webp" },
  { id: "dell_g15", label: "G15", year: "15-inch gaming", topPrice: 0, variants: DELL_G15_VARIANTS, inquiryOnly: true, image: "/devices/dell-xps.webp" },
  { id: "dell_g16", label: "G16", year: "16-inch gaming", topPrice: 0, variants: DELL_G16_VARIANTS, inquiryOnly: true, image: "/devices/dell-xps.webp" },
];
const DELL_PRO_SUB_SERIES = [
  { id: "dell_pro_13", label: "Dell Pro 13", year: "13-inch", topPrice: 0, variants: DELL_PRO_13_VARIANTS, inquiryOnly: true, image: "/devices/dell-xps.webp" },
  { id: "dell_pro_14", label: "Dell Pro 14", year: "14-inch", topPrice: 0, variants: DELL_PRO_14_VARIANTS, inquiryOnly: true, image: "/devices/dell-xps.webp" },
  { id: "dell_pro_16", label: "Dell Pro 16", year: "16-inch", topPrice: 0, variants: DELL_PRO_16_VARIANTS, inquiryOnly: true, image: "/devices/dell-xps.webp" },
];
const DELL_RUGGED_SUB_SERIES = [
  { id: "dell_lat_rugged", label: "Latitude Rugged", year: "Field-tough", topPrice: 0, variants: DELL_LAT_RUGGED_VARIANTS, inquiryOnly: true, image: "/devices/dell-latitude.jpg" },
];
const DELL_PC_SERIES = [
  { id: "dell_xps", label: "XPS", year: "Premium consumer", topPrice: 0, subSeries: DELL_XPS_SUB_SERIES, inquiryOnly: true, image: "/devices/dell-xps.webp" },
  { id: "dell_latitude", label: "Latitude", year: "Business", topPrice: 0, subSeries: DELL_LATITUDE_SUB_SERIES, inquiryOnly: true, image: "/devices/dell-latitude.jpg" },
  { id: "dell_inspiron", label: "Inspiron", year: "Everyday", topPrice: 0, subSeries: DELL_INSPIRON_SUB_SERIES, inquiryOnly: true, image: "/devices/dell-inspiron-15.webp" },
  { id: "dell_precision", label: "Precision", year: "Mobile workstation", topPrice: 0, subSeries: DELL_PRECISION_SUB_SERIES, inquiryOnly: true, image: "/devices/dell-latitude.jpg" },
  { id: "dell_vostro", label: "Vostro", year: "Small-business", topPrice: 0, subSeries: DELL_VOSTRO_SUB_SERIES, inquiryOnly: true, image: "/devices/dell-inspiron-15.webp" },
  { id: "dell_g", label: "G Series", year: "Gaming", topPrice: 0, subSeries: DELL_G_SUB_SERIES, inquiryOnly: true, image: "/devices/dell-xps.webp" },
  { id: "dell_pro", label: "Dell Pro", year: "AI-class business", topPrice: 0, subSeries: DELL_PRO_SUB_SERIES, inquiryOnly: true, image: "/devices/dell-xps.webp" },
  { id: "dell_rugged", label: "Rugged", year: "Field/military", topPrice: 0, subSeries: DELL_RUGGED_SUB_SERIES, inquiryOnly: true, image: "/devices/dell-latitude.jpg" },
];
const DELL_PC_ALL_SUB_SERIES = [
  ...DELL_XPS_SUB_SERIES, ...DELL_LATITUDE_SUB_SERIES, ...DELL_INSPIRON_SUB_SERIES,
  ...DELL_PRECISION_SUB_SERIES, ...DELL_VOSTRO_SUB_SERIES, ...DELL_G_SUB_SERIES,
  ...DELL_PRO_SUB_SERIES, ...DELL_RUGGED_SUB_SERIES,
];

const ALIENWARE_DESKTOP_MODELS = [
  { id: "awaurorar16", label: "Aurora R16", base: 800, image: "/devices/alienware-aurora-r16.webp" },
  { id: "awaurorar15", label: "Aurora R15", base: 600, image: "/devices/alienware-aurora-r15.webp" },
  { id: "awaurorar14", label: "Aurora R14", base: 0, inquiryOnly: true, image: "/devices/alienware-aurora-r14.webp" },
  { id: "awaurorar13", label: "Aurora R13", base: 450, image: "/devices/alienware-aurora-r13.webp" },
  { id: "awaurorar12", label: "Aurora R12", base: 0, inquiryOnly: true, image: "/devices/alienware-aurora-r12.webp" },
  { id: "awaurorar10", label: "Aurora R10", base: 0, inquiryOnly: true, image: "/devices/alienware-aurora-r10.webp" },
  { id: "awarea51desktop", label: "Area-51 Desktop", base: 0, inquiryOnly: true, image: "/devices/alienware-area-51-desktop.webp" },
];

const MSI_DESKTOP_MODELS = [
  { id: "msiinfinity", label: "MEG Trident X2", base: 900, image: "/devices/msi-trident.webp" },
  { id: "msitrident", label: "MAG Trident S5", base: 550, image: "/devices/msi-trident.webp" },
  { id: "msinightblade", label: "MAG Codex 6", base: 650, image: "/devices/msi-codex.webp" },
  { id: "msicodex5", label: "MAG Codex 5", base: 450, image: "/devices/msi-codex.webp" },
  { id: "msipro", label: "PRO DP180", base: 300, image: "/devices/msi-aegis.webp" },
];

const IPAD_SERIES = [
  { id: "ipadpro", label: "iPad Pro", topPrice: 610, image: "/ipadpro.png", variants: [
    { id: "ipadpro13m5", label: "iPad Pro 13\" M5", base: 610, image: "/devices/ipad-pro-13-m5.webp" },
    { id: "ipadpro11m5", label: "iPad Pro 11\" M5", base: 475, image: "/devices/ipad-pro-11-m5.webp" },
    { id: "ipadpro13m4", label: "iPad Pro 13\" M4", base: 500, image: "/devices/ipad-pro-13-m4.webp" },
    { id: "ipadpro11m4", label: "iPad Pro 11\" M4", base: 350, image: "/devices/ipad-pro-11-m4.webp" },
    { id: "ipadpro129g6", label: "iPad Pro 12.9\" 6th Gen", base: 270, image: "/devices/ipad-pro-12-9.webp" },
    { id: "ipadpro11g4", label: "iPad Pro 11\" 4th Gen", base: 225, image: "/devices/ipad-pro-11-4g.webp" },
  ]},
  { id: "ipadair", label: "iPad Air", topPrice: 360, image: "/ipadair.png", variants: [
    { id: "ipadair13m3", label: "iPad Air 13\" M3", base: 360, image: "/devices/ipad-air-13-m3.webp" },
    { id: "ipadair11m3", label: "iPad Air 11\" M3", base: 275, image: "/devices/ipad-air-11-m3.webp" },
    { id: "ipadair13m2", label: "iPad Air 13\" M2", base: 275, image: "/devices/ipad-air-13-m2.webp" },
    { id: "ipadair11m2", label: "iPad Air 11\" M2", base: 200, image: "/devices/ipad-air-11-m2.webp" },
  ]},
  { id: "ipadmini", label: "iPad Mini", topPrice: 225, image: "/ipadmini.png", variants: [
    { id: "ipadmini7", label: "iPad Mini 7th Gen", base: 225, image: "/devices/ipad-mini-7.webp" },
    { id: "ipadmini6", label: "iPad Mini 6th Gen", base: 150, image: "/devices/ipad-mini-6.webp" },
  ]},
  { id: "ipadbase", label: "iPad", topPrice: 150, image: "/ipadbase.png", variants: [
    { id: "ipad10", label: "iPad 10th Gen", base: 150, image: "/devices/ipad-10.webp" },
    { id: "ipad9", label: "iPad 9th Gen", base: 100, image: "/devices/ipad-9.webp" },
  ]},
];

const IPAD_MODELS = IPAD_SERIES.flatMap(s => s.variants);

// Disc vs Digital is no longer a separate model — it's asked at the
// extras step with an 8% multiplier reduction for digital. So PS5
// Standard / Slim each consolidate to one entry.
const PS5_VARIANTS = [
  { id: "ps5pro",  label: "PlayStation 5 Pro (2 TB)",    base: 550, image: "/devices/ps5.webp" },
  { id: "ps5slim", label: "PlayStation 5 Slim (1 TB)",   base: 380, image: "/devices/ps5-slim-disc.webp" },
  { id: "ps5",     label: "PlayStation 5 (825 GB)",      base: 300, image: "/devices/ps5.webp" },
];
const PS4_VARIANTS = [
  { id: "ps4pro", label: "PlayStation 4 Pro", base: 150, image: "/devices/ps4-pro.webp" },
  { id: "ps4", label: "PlayStation 4 (Standard)", base: 100, image: "/devices/ps4.webp" },
  { id: "ps4slim", label: "PlayStation 4 Slim", base: 0, inquiryOnly: true, image: "/devices/ps4-slim.webp" },
];
const SONY_SERIES = [
  { id: "ps5_family", label: "PlayStation 5", year: "Pro · Std · Slim", topPrice: 300, image: "/ps5-series.webp", variants: PS5_VARIANTS },
  { id: "ps4_family", label: "PlayStation 4", year: "Pro · Std · Slim", topPrice: 150, image: "/ps4-series.webp", variants: PS4_VARIANTS },
];
const SONY_MODELS = [...PS5_VARIANTS, ...PS4_VARIANTS];

const MICROSOFT_MODELS = [
  { id: "xsx",  label: "Xbox Series X", base: 280, image: "/devices/xbox-series-x.webp" },
  { id: "xss",  label: "Xbox Series S", base: 150, image: "/devices/xbox-series-s.webp" },
  { id: "xone", label: "Xbox One",      base: 80,  image: "/devices/xbox-one.webp" },
];

const NINTENDO_MODELS = [
  { id: "switch", label: "Nintendo Switch OLED", base: 180, image: "/devices/switch-oled.webp" },
  { id: "switchv2", label: "Nintendo Switch V2", base: 130, image: "/devices/switch-oled.webp" },
  { id: "switchlite", label: "Nintendo Switch Lite", base: 90, image: "/devices/switch-lite.webp" },
];

const CONSOLE_MODELS = [...SONY_MODELS, ...MICROSOFT_MODELS, ...NINTENDO_MODELS];

const APPLEWATCH_MODELS = [
  { id: "awu2", label: "Apple Watch Ultra 2", base: 450, image: "/devices/apple-watch-ultra-2.webp" },
  { id: "awu1", label: "Apple Watch Ultra", base: 350, image: "/devices/apple-watch-ultra.webp" },
  { id: "aws10", label: "Apple Watch Series 10", base: 280, image: "/devices/apple-watch-series-10.webp" },
  { id: "aws9", label: "Apple Watch Series 9", base: 220, image: "/devices/apple-watch-series-9.webp" },
  { id: "aws8", label: "Apple Watch Series 8", base: 170, image: "/devices/apple-watch-series-8.webp" },
  { id: "aws7", label: "Apple Watch Series 7", base: 120, image: "/devices/apple-watch-series-7.webp" },
  { id: "awse2", label: "Apple Watch SE (2nd Gen)", base: 130, image: "/devices/apple-watch-se-2.webp" },
  { id: "awse1", label: "Apple Watch SE (1st Gen)", base: 80, image: "/devices/apple-watch-se-1.webp" },
];

const PIXELWATCH_MODELS = [
  { id: "pw3", label: "Pixel Watch 3", base: 200, image: "/devices/pixel-watch.jpg" },
  { id: "pw2", label: "Pixel Watch 2", base: 130, image: "/devices/pixel-watch.jpg" },
  { id: "pw1", label: "Pixel Watch", base: 80, image: "/devices/pixel-watch.jpg" },
];

const GARMIN_MODELS = [
  { id: "gfenix7", label: "Fenix 7", base: 300 },
  { id: "gfenix7s", label: "Fenix 7S", base: 250 },
  { id: "gepix2", label: "Epix Gen 2", base: 280 },
  { id: "gfr965", label: "Forerunner 965", base: 250 },
  { id: "gfr265", label: "Forerunner 265", base: 180 },
  { id: "gvenu3", label: "Venu 3", base: 220 },
  { id: "gvenu2", label: "Venu 2", base: 130 },
];

const SAMSUNGWATCH_MODELS = [
  { id: "sgwu", label: "Galaxy Watch Ultra", base: 350, image: "/devices/samsung-watch-7.webp" },
  { id: "sgw7", label: "Galaxy Watch 7", base: 150, image: "/devices/samsung-watch-7.webp" },
  { id: "sgw6c", label: "Galaxy Watch 6 Classic", base: 160, image: "/devices/samsung-watch-6-classic.webp" },
  { id: "sgw6", label: "Galaxy Watch 6", base: 110, image: "/devices/samsung-watch-6.webp" },
  { id: "sgw5p", label: "Galaxy Watch 5 Pro", base: 130, image: "/devices/samsung-watch-5-pro.webp" },
  { id: "sgw5", label: "Galaxy Watch 5", base: 80, image: "/devices/samsung-watch-5.webp" },
];

const DJI_MODELS = [
  { id: "djimavic", label: "DJI Mavic" },
  { id: "djiinspire", label: "DJI Inspire" },
  { id: "djiavata", label: "DJI Avata" },
  { id: "djifpv", label: "DJI FPV" },
  { id: "djiair", label: "DJI Air" },
  { id: "djimini", label: "DJI Mini" },
  { id: "djiphantom", label: "DJI Phantom" },
  { id: "djiflip", label: "DJI Flip" },
  { id: "djispark", label: "DJI Spark" },
];

const APPLE_VR_MODELS = [
  { id: "avp1tb", label: "Apple Vision Pro (1TB)", image: "/devices/apple-vision-pro.jpg" },
  { id: "avp512", label: "Apple Vision Pro (512GB)", image: "/devices/apple-vision-pro.jpg" },
  { id: "avp256", label: "Apple Vision Pro (256GB)", image: "/devices/apple-vision-pro.jpg" },
];

const META_VR_MODELS = [
  { id: "mq3512", label: "Meta Quest 3S (512GB)", image: "/devices/meta-quest-3.jpg" },
  { id: "mq3128", label: "Meta Quest 3S (128GB)", image: "/devices/meta-quest-3.jpg" },
  { id: "mq3", label: "Meta Quest 3 (512GB)", image: "/devices/meta-quest-3.jpg" },
  { id: "mq3b", label: "Meta Quest 3 (128GB)", image: "/devices/meta-quest-3.jpg" },
  { id: "mq2256", label: "Meta Quest 2 (256GB)" },
  { id: "mq2128", label: "Meta Quest 2 (128GB)" },
  { id: "mqpro", label: "Meta Quest Pro" },
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
  { id: "stabs11u", label: "Galaxy Tab S11 Ultra", image: "/devices/galaxy-tab-s11-ultra.webp" },
  { id: "stabs11", label: "Galaxy Tab S11", image: "/devices/galaxy-tab-s11.webp" },
  { id: "stabs10u", label: "Galaxy Tab S10 Ultra", image: "/devices/galaxy-tab-s10-ultra.png" },
  { id: "stabs10p", label: "Galaxy Tab S10+", image: "/devices/galaxy-tab-s10-plus.webp" },
  { id: "stabs10fep", label: "Galaxy Tab S10 FE+", image: "/devices/galaxy-tab-s10-fe-plus.webp" },
  { id: "stabs10fe", label: "Galaxy Tab S10 FE", image: "/devices/galaxy-tab-s10-fe.webp" },
  { id: "stabs10l", label: "Galaxy Tab S10 Lite", image: "/devices/galaxy-tab-s10-lite.webp" },
  { id: "stabs9u", label: "Galaxy Tab S9 Ultra", image: "/devices/galaxy-tab-s9-ultra.webp" },
  { id: "stabs9p", label: "Galaxy Tab S9+", image: "/devices/galaxy-tab-s9-plus.webp" },
  { id: "stabs9", label: "Galaxy Tab S9", image: "/devices/galaxy-tab-s9.webp" },
  { id: "stabs9fep", label: "Galaxy Tab S9 FE+", image: "/devices/galaxy-tab-s9-fe-plus.webp" },
  { id: "stabs9fe", label: "Galaxy Tab S9 FE", image: "/devices/galaxy-tab-s9-fe.webp" },
  { id: "stabs8u", label: "Galaxy Tab S8 Ultra", image: "/devices/galaxy-tab-s8-ultra.webp" },
  { id: "stabs8p", label: "Galaxy Tab S8+", image: "/devices/galaxy-tab-s8-plus.webp" },
  { id: "stabs8", label: "Galaxy Tab S8", image: "/devices/galaxy-tab-s8.webp" },
  { id: "stabs7p", label: "Galaxy Tab S7+", image: "/devices/galaxy-tab-s7-plus.webp" },
  { id: "stabs7fe", label: "Galaxy Tab S7 FE", image: "/devices/galaxy-tab-s7-fe.png" },
  { id: "stabs7", label: "Galaxy Tab S7", image: "/devices/galaxy-tab-s7.webp" },
  { id: "stabs6l", label: "Galaxy Tab S6 Lite", image: "/devices/galaxy-tab-s6-lite.webp" },
  { id: "stabs6", label: "Galaxy Tab S6", image: "/devices/galaxy-tab-s6.webp" },
  { id: "stabs5e", label: "Galaxy Tab S5e", image: "/devices/galaxy-tab-s5e.webp" },
  { id: "stabs4", label: "Galaxy Tab S4 10.5", image: "/devices/galaxy-tab-s4-105.webp" },
  { id: "staba9", label: "Galaxy Tab A9+", image: "/devices/galaxy-tab-a9-plus.webp" },
];

const SURFACE_PRO_VARIANTS = [
  { id: "surfpro12_13", label: "Surface Pro 12 13\" (2026)", base: 0, inquiryOnly: true },
  { id: "surfpro12_12", label: "Surface Pro 12 12\" (2026)", base: 0, inquiryOnly: true },
  { id: "surfpro11", label: "Surface Pro 11th Ed (Copilot+ / Snapdragon X)", base: 0, inquiryOnly: true },
  { id: "surfpro10biz", label: "Surface Pro 10 for Business", base: 0, inquiryOnly: true },
  { id: "surfpro9", label: "Surface Pro 9", base: 0, inquiryOnly: true },
  { id: "surfpro8", label: "Surface Pro 8", base: 0, inquiryOnly: true },
  { id: "surfpro7p", label: "Surface Pro 7+", base: 0, inquiryOnly: true },
  { id: "surfpro7", label: "Surface Pro 7", base: 0, inquiryOnly: true },
  { id: "surfpro6", label: "Surface Pro 6", base: 0, inquiryOnly: true },
  { id: "surfpro5_2017", label: "Surface Pro 5 (2017)", base: 0, inquiryOnly: true },
  { id: "surfpro4", label: "Surface Pro 4", base: 0, inquiryOnly: true },
  { id: "surfpro3", label: "Surface Pro 3", base: 0, inquiryOnly: true },
  { id: "surfpro2", label: "Surface Pro 2", base: 0, inquiryOnly: true },
  { id: "surfpro1", label: "Surface Pro (2013)", base: 0, inquiryOnly: true },
];
const SURFACE_GO_VARIANTS = [
  { id: "surfgo4", label: "Surface Go 4 (Business)", base: 0, inquiryOnly: true },
  { id: "surfgo3", label: "Surface Go 3", base: 0, inquiryOnly: true },
  { id: "surfgo2", label: "Surface Go 2", base: 0, inquiryOnly: true },
  { id: "surfgo1", label: "Surface Go (2018)", base: 0, inquiryOnly: true },
];
const SURFACE_X_VARIANTS = [
  { id: "surfprox2020", label: "Surface Pro X (2020 Refresh)", base: 0, inquiryOnly: true },
  { id: "surfprox2019", label: "Surface Pro X (2019)", base: 0, inquiryOnly: true },
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
  { id: "surf_pro", label: "Pro", year: "Flagship", topPrice: 0, variants: SURFACE_PRO_VARIANTS, inquiryOnly: true },
  { id: "surf_go", label: "Go", year: "Compact", topPrice: 0, variants: SURFACE_GO_VARIANTS, inquiryOnly: true },
  { id: "surf_x", label: "Pro X", year: "ARM Ultra-thin", topPrice: 0, variants: SURFACE_X_VARIANTS, inquiryOnly: true },
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
  { id: "legtabg3", label: "Legion Tab Gen 3", base: 0, inquiryOnly: true },
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
  { id: "lenovo_legion", label: "Legion", year: "Gaming", topPrice: 0, variants: LENOVO_LEGION_TAB_VARIANTS, inquiryOnly: true },
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
  { id: "oppad2", label: "OnePlus Pad 2" },
  { id: "oppad", label: "OnePlus Pad" },
];

const GOOGLE_TAB_MODELS = [
  { id: "gpixeltab", label: "Pixel Tablet (256GB)" },
  { id: "gpixeltab128", label: "Pixel Tablet (128GB)" },
];

const CONDITIONS = [
  { id: "brandnew", label: "Brand New", desc: "Factory sealed, never activated", multiplier: 1.15, icon: "🆕", details: ["Still in factory original packaging", "Plastic film still on the device and has not been reapplied", "Device is not activated", "Must come with the original box with matching serial number", "Contains all original accessories"] },
  { id: "flawless", label: "Flawless", desc: "Like new, zero signs of use", multiplier: 1.0, icon: "✨", details: ["Zero scratches, scuffs, or other marks — looks like new", "Display is free of defects such as cracks, dead pixels, white spots, or burn-in", "Original battery above 80% capacity", "Powers on and functions 100% as intended", "Must be paid off and free of any financial obligations"] },
  { id: "verygood", label: "Very Good", desc: "Minimal use, no visible scratches at arm's length", multiplier: 0.95, icon: "💎", details: ["Light scratches or scuffs not visible at arm's length — no dents, dings, or deep scratches", "Display is free of defects such as cracks, dead pixels, white spots, or burn-in", "Original battery above 80% capacity", "Powers on and functions 100% as intended", "Must be paid off and free of any financial obligations"] },
  { id: "good", label: "Good", desc: "Light wear, fully functional", multiplier: 0.88, icon: "👍", details: ["Light to moderate signs of wear — few light scratches and/or dents", "Display is free of defects such as cracks, dead pixels, white spots, or burn-in", "Original battery above 80% capacity", "Powers on and functions 100% as intended", "Must be paid off and free of any financial obligations"] },
  { id: "fair", label: "Fair", desc: "Moderate to heavy wear, functional", multiplier: 0.72, icon: "👌", details: ["Moderate to excessive signs of wear — contains heavy scratches and/or dents", "Display is free of defects such as cracks, dead pixels, white spots, or burn-in", "Original battery above 80% capacity", "Powers on and functions 100% as intended", "Must be paid off and free of any financial obligations"] },
  { id: "broken", label: "Broken", desc: "Cracked, defective, or damaged", multiplier: 0.50, icon: "⚠️", details: ["Functionally defective or broken parts on either screen or body", "Cracked display or damaged housing", "Display defects such as dead pixels, white spots, or burn-in", "Shows no signs of liquid intrusion or water damage"] },
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
  ip17e: ["256"],
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
  asroghyper: ["1tb"],
  asrogflow: ["512", "1tb"],
  astufgaming: ["512", "1tb"],
  asexperpro: ["256", "512"],
  asnuc14: ["256", "512"],
  // Alienware Desktops
  awaurorar16: ["512", "1tb"],
  awaurorar15: ["512", "1tb"],
  awaurorar13: ["512", "1tb"],
  // MSI Desktops
  msiinfinity: ["1tb"],
  msitrident: ["512", "1tb"],
  msinightblade: ["512", "1tb"],
  msicodex5: ["512", "1tb"],
  msipro: ["256", "512"],
  // iPads — Apple's iPad Pro M4 and M5 both ship in 256/512/1TB/2TB
  // (max storage is 2TB on the Pro line). Previously missing 2TB.
  ipadpro13m5: ["256", "512", "1tb", "2tb"],
  ipadpro11m5: ["256", "512", "1tb", "2tb"],
  ipadpro13m4: ["256", "512", "1tb", "2tb"],
  ipadpro11m4: ["256", "512", "1tb", "2tb"],
  ipadpro129g6: ["128", "256", "512", "1tb"],
  ipadpro11g4: ["128", "256", "512", "1tb"],
  ipadair13m3: ["128", "256", "512", "1tb"],
  ipadair11m3: ["128", "256", "512", "1tb"],
  ipadair13m2: ["128", "256", "512", "1tb"],
  ipadair11m2: ["128", "256", "512", "1tb"],
  ipad10: ["64", "256"],
  ipad9: ["64", "256"],
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
  gpixeltab: ["256"],
  gpixeltab128: ["128"],
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
  // Apple family — 'Flawless' becomes 'Pristine' / 'Brand New' becomes 'Sealed in Box'
  iphone: {
    brandnew: { label: "Sealed in Box", desc: "Factory sealed, never activated" },
    flawless: { label: "Pristine", desc: "Like new — zero scratches or marks" },
  },
  ipad: {
    brandnew: { label: "Sealed in Box", desc: "Factory sealed, never activated" },
    flawless: { label: "Pristine", desc: "Like new — zero scratches or marks" },
  },
  macbook: {
    brandnew: { label: "Sealed in Box", desc: "Factory sealed, original packaging" },
    flawless: { label: "Pristine", desc: "Like new — zero wear, all original" },
  },
  apple_desktop: {
    brandnew: { label: "Sealed in Box", desc: "Factory sealed, never plugged in" },
    flawless: { label: "Pristine", desc: "Like new — all original cables + box" },
  },
  applewatch: {
    flawless: { label: "Pristine", desc: "Like new — zero face scratches" },
    broken:   { label: "Cracked or dead", desc: "Cracked face, dead battery, or won't power on" },
  },
  apple_vr: {
    flawless: { label: "Pristine", desc: "Like new — no scuffs on the cover glass" },
  },
  // Samsung family — 'Flawless' becomes 'Mint'
  android: {
    brandnew: { label: "Sealed in Box", desc: "Factory sealed, never activated" },
    flawless: { label: "Mint", desc: "Boxed & untouched — zero marks" },
  },
  samsung_tab: {
    brandnew: { label: "Sealed in Box", desc: "Factory sealed, never activated" },
    flawless: { label: "Mint", desc: "Boxed & untouched" },
  },
  samsung_pc: {
    brandnew: { label: "Sealed in Box", desc: "Factory sealed" },
    flawless: { label: "Mint", desc: "Boxed & untouched" },
  },
  samsungwatch: {
    flawless: { label: "Mint", desc: "Like new — zero face scratches" },
    broken:   { label: "Cracked or dead", desc: "Cracked face, dead battery, or won't power on" },
  },
  // Google family
  pixel: {
    brandnew: { label: "Sealed in Box", desc: "Factory sealed, never activated" },
    flawless: { label: "Pristine", desc: "Like new — zero scratches" },
  },
  pixelwatch: {
    flawless: { label: "Pristine", desc: "Like new — zero face scratches" },
    broken:   { label: "Cracked or dead", desc: "Cracked face, dead battery, or won't power on" },
  },
  google_tab: {
    flawless: { label: "Pristine", desc: "Like new — zero scratches" },
  },
  // Consoles — different vocabulary; the customer thinks about working/broken not flawless/fair
  sony: {
    brandnew: { label: "Sealed in Box", desc: "Factory sealed, never opened" },
    flawless: { label: "Like New", desc: "Boxed, lightly used, no marks" },
    verygood: { label: "Excellent", desc: "Works perfectly, light cosmetic wear" },
    good:     { label: "Good", desc: "Works perfectly, normal wear & tear" },
    fair:     { label: "Fair", desc: "Works, heavy cosmetic wear" },
    broken:   { label: "Disc drive broken / won't power on", desc: "Major hardware fault" },
  },
  microsoft: {
    brandnew: { label: "Sealed in Box", desc: "Factory sealed, never opened" },
    flawless: { label: "Like New", desc: "Boxed, lightly used, no marks" },
    verygood: { label: "Excellent", desc: "Works perfectly, light cosmetic wear" },
    good:     { label: "Good", desc: "Works perfectly, normal wear & tear" },
    fair:     { label: "Fair", desc: "Works, heavy cosmetic wear" },
    broken:   { label: "Disc drive broken / won't power on", desc: "Major hardware fault" },
  },
  nintendo: {
    brandnew: { label: "Sealed in Box", desc: "Factory sealed, never opened" },
    flawless: { label: "Like New", desc: "Boxed, lightly used, no marks" },
    verygood: { label: "Excellent", desc: "Works perfectly, light cosmetic wear" },
    good:     { label: "Good", desc: "Works perfectly, normal wear & tear" },
    fair:     { label: "Fair", desc: "Works, heavy cosmetic wear" },
    broken:   { label: "Joy-Con drift / won't power on", desc: "Major hardware fault" },
  },
  console: {
    brandnew: { label: "Sealed in Box", desc: "Factory sealed, never opened" },
    flawless: { label: "Like New", desc: "Boxed, lightly used" },
    broken:   { label: "Disc drive broken / won't power on" },
  },
  // Drones
  dji: {
    flawless: { label: "Hangar-stored, never flown", desc: "Sealed or unflown — full kit included" },
    verygood: { label: "Lightly Flown", desc: "Under 10 hours, no crashes" },
    good:     { label: "Well-Maintained", desc: "Flown but maintained, no incidents" },
    fair:     { label: "Heavily Used", desc: "200+ hours, cosmetic wear, no crashes" },
    broken:   { label: "Crashed / Motors Broken", desc: "Repair history, motor or shell damage" },
  },
  // Watches not already covered
  garmin: {
    flawless: { label: "Pristine", desc: "Like new — zero scratches" },
    broken:   { label: "Cracked or dead", desc: "Cracked face or won't power on" },
  },
  // VR
  meta_vr: {
    brandnew: { label: "Sealed in Box", desc: "Factory sealed, never paired" },
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

// Combined multiplier: unlocked anything pays the most, big-3 locked
// pays mid, locked-to-other pays the least. 'unlocked' carrier id is
// treated as if the user said No to the lock step.
const carrierMultiplierFor = (carrierId: string | null | undefined, lockId: string | null | undefined): number => {
  if (carrierId === "unlocked") return 1.0;
  if (!lockId) return 1; // not picked yet, no penalty
  if (lockId === "no") return 1.0;
  if (carrierId === "other") return 0.85;
  return 0.95;
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

// Brand New (+15%) only applies to device categories where we have
// real profit margin — laptops / desktops. Phones, tablets, consoles,
// watches etc. can't sustain a +15% bonus on a sealed device. For
// those, the ceiling condition is Flawless (1.0).
const HIGH_MARGIN_DEVICE_TYPES = new Set<string>([
  // Laptops
  "macbook", "samsung_pc", "lenovo", "dell", "alienware", "hp", "acer", "lg_pc", "asus_pc",
  // Desktops
  "apple_desktop", "dell_desktop", "lenovo_desktop", "hp_desktop", "asus_desktop", "alienware_desktop", "msi_desktop",
]);
const isHighMarginType = (dt: string | null | undefined): boolean => !!dt && HIGH_MARGIN_DEVICE_TYPES.has(dt);
const getConditionsFor = (dt: string | null | undefined) => {
  if (isHighMarginType(dt)) return CONDITIONS;
  return CONDITIONS.filter(c => c.id !== "brandnew");
};
const getTopConditionMult = (dt: string | null | undefined): number => {
  return Math.max(...getConditionsFor(dt).map(c => c.multiplier));
};

const getMaxStorageMult = (modelId: string): number => {
  const sids = STORAGE_MAP[modelId];
  if (!sids || sids.length === 0) return 1;
  return Math.max(...sids.map(sid => ALL_STORAGES.find(s => s.id === sid)?.multiplier ?? 1));
};
const getMaxPrice = (m: { id: string; base?: number }, dt?: string | null): number => {
  if (!m.base) return 0;
  return Math.round(m.base * getMaxStorageMult(m.id) * getTopConditionMult(dt) * TOP_CARRIER_MULT);
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
  { q: "What devices do you buy?", a: "We buy iPhones (11 and newer) and Samsung Galaxy phones (S21 and newer), including Z Fold and Z Flip models." },
  { q: "Do I need to factory reset my phone?", a: "Yes, please back up your data and factory reset before selling. We'll walk you through it if you need help." },
];

type Step = "device" | "category" | "brand" | "model" | "processor" | "memory" | "displayglass" | "storage" | "condition" | "batteryhealth" | "charger" | "connectivity" | "carrier" | "carrier-lock" | "extras" | "quote" | "checkout" | "payout" | "contact" | "done" | "inquiry";

// Brand-specific extra questions. A device family can declare a list of
// follow-up questions (disc drive / controllers / hours flown / band
// included / shutter count, etc) that the funnel asks via a single
// generic 'extras' step that advances an index between questions.
// Each option carries a multiplier that folds into the quote alongside
// storage / condition / etc.
type ExtraOption = { id: string; label: string; sub?: string; multiplier: number };
type BrandExtra = { id: string; question: string; helper?: string; options: ExtraOption[] };
const BRAND_EXTRAS: Record<string, BrandExtra[]> = {
  // Consoles — single ask: disc drive yes/no (digital editions trade lower)
  // and how many controllers are in the box.
  sony: [
    { id: "discdrive", question: "Disc drive?", helper: "Digital-only consoles trade for a bit less.", options: [
      { id: "yes",     label: "Yes — has disc drive",    multiplier: 1.00 },
      { id: "digital", label: "No — digital edition",     multiplier: 0.92 },
    ]},
    { id: "ssd", question: "M.2 SSD upgrade installed?", helper: "Base PS5 is 825 GB, Slim 1 TB, Pro 2 TB. Internal M.2 slot adds up to 8 TB more — verified upgrades add a real resale premium.", options: [
      { id: "none",   label: "No — base storage only",        multiplier: 1.00 },
      { id: "1to2tb", label: "Yes — 1 TB or 2 TB M.2 added",  multiplier: 1.05 },
      { id: "4tb",    label: "Yes — 4 TB M.2 added",          multiplier: 1.10 },
      { id: "8tb",    label: "Yes — 8 TB M.2 added (maxed)",  multiplier: 1.15 },
    ]},
    { id: "controllers", question: "Controllers included?", options: [
      { id: "2", label: "2 controllers", multiplier: 1.05 },
      { id: "1", label: "1 controller",  multiplier: 1.00 },
      { id: "0", label: "No controllers", multiplier: 0.92 },
    ]},
  ],
  microsoft: [
    { id: "discdrive", question: "Disc drive?", helper: "Xbox Series S is always digital; Series X comes in both flavors.", options: [
      { id: "yes",     label: "Yes — has disc drive",    multiplier: 1.00 },
      { id: "digital", label: "No — digital edition",     multiplier: 0.92 },
    ]},
    { id: "storage", question: "Storage capacity?", helper: "Series S base is 512 GB. Series X / Series S Carbon Black is 1 TB. The 2 TB option is Series X Galaxy Black Special Edition or any Xbox with a Storage Expansion Card.", options: [
      { id: "512", label: "512 GB",                       multiplier: 0.95 },
      { id: "1tb", label: "1 TB",                         multiplier: 1.00 },
      { id: "2tb", label: "2 TB (Galaxy Black SE / card)", multiplier: 1.15 },
    ]},
    { id: "controllers", question: "Controllers included?", options: [
      { id: "2", label: "2 controllers", multiplier: 1.05 },
      { id: "1", label: "1 controller",  multiplier: 1.00 },
      { id: "0", label: "No controllers", multiplier: 0.92 },
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
  ],
  // Smartwatches — band makes a big resale difference
  applewatch: [
    { id: "band", question: "Band included?", options: [
      { id: "oem",   label: "Yes — original Apple band",   multiplier: 1.05 },
      { id: "third", label: "Yes — 3rd-party band",        multiplier: 1.00 },
      { id: "none",  label: "No band",                     multiplier: 0.90 },
    ]},
  ],
  samsungwatch: [
    { id: "band", question: "Band included?", options: [
      { id: "oem",   label: "Yes — original Samsung band", multiplier: 1.05 },
      { id: "third", label: "Yes — 3rd-party band",        multiplier: 1.00 },
      { id: "none",  label: "No band",                     multiplier: 0.90 },
    ]},
  ],
  pixelwatch: [
    { id: "band", question: "Band included?", options: [
      { id: "oem",   label: "Yes — original Google band",  multiplier: 1.05 },
      { id: "third", label: "Yes — 3rd-party band",        multiplier: 1.00 },
      { id: "none",  label: "No band",                     multiplier: 0.90 },
    ]},
  ],
  garmin: [
    { id: "band", question: "Band included?", options: [
      { id: "oem",   label: "Yes — original Garmin band",  multiplier: 1.05 },
      { id: "third", label: "Yes — 3rd-party band",        multiplier: 1.00 },
      { id: "none",  label: "No band",                     multiplier: 0.90 },
    ]},
  ],
  // VR — accessories matter a lot
  meta_vr: [
    { id: "storage", question: "Storage capacity?", helper: "Quest 3 ships in 128 / 512; Quest 3S in 128 / 256; Quest 2 in 128 / 256.", options: [
      { id: "128", label: "128 GB", multiplier: 1.00 },
      { id: "256", label: "256 GB", multiplier: 1.12 },
      { id: "512", label: "512 GB", multiplier: 1.25 },
    ]},
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
    { id: "storage", question: "Storage capacity?", helper: "Vision Pro ships in 256 / 512 / 1 TB.", options: [
      { id: "256", label: "256 GB", multiplier: 1.00 },
      { id: "512", label: "512 GB", multiplier: 1.10 },
      { id: "1tb", label: "1 TB",   multiplier: 1.22 },
    ]},
    { id: "battery", question: "External battery included?", options: [
      { id: "yes", label: "Yes — original Apple battery", multiplier: 1.00 },
      { id: "no",  label: "No battery",                   multiplier: 0.85 },
    ]},
  ],
};
const getBrandExtras = (dt: string | null | undefined): BrandExtra[] => (dt && BRAND_EXTRAS[dt]) || [];

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
type MacSpecOption = { id: string; label: string; multiplier: number; sub?: string };
type MacSpec = {
  processors: MacSpecOption[];
  memory: MacSpecOption[];
  storage: MacSpecOption[];
  hasNanoGlass?: boolean;
};
const MACBOOK_SPECS: Record<string, MacSpec> = {
  // 2026 16-inch MacBook Pro M5 Pro/Max (Skywalker's example reference).
  mbp16_m5pmax_2026: {
    processors: [
      { id: "m5pro_18_20", label: "M5 Pro", sub: "18-Core CPU / 20-Core GPU", multiplier: 1.00 },
      { id: "m5max_18_32", label: "M5 Max", sub: "18-Core CPU / 32-Core GPU", multiplier: 1.35 },
      { id: "m5max_18_40", label: "M5 Max", sub: "18-Core CPU / 40-Core GPU", multiplier: 1.50 },
    ],
    memory: [
      { id: "48",  label: "48 GB", sub: "Unified Memory",  multiplier: 1.00 },
      { id: "64",  label: "64 GB", sub: "Unified Memory",  multiplier: 1.12 },
      { id: "128", label: "128 GB", sub: "Unified Memory", multiplier: 1.30 },
    ],
    storage: [
      { id: "2tb", label: "2 TB",  sub: "SSD", multiplier: 1.00 },
      { id: "4tb", label: "4 TB",  sub: "SSD", multiplier: 1.25 },
      { id: "8tb", label: "8 TB",  sub: "SSD", multiplier: 1.60 },
    ],
    hasNanoGlass: true,
  },
  // 2026 14-inch MacBook Pro M5 Pro/Max — same chip tiers as the 16,
  // with the 15-16C base Pro chip configurable too. Smaller display, no
  // 8TB SSD option on 14-inch.
  mbp14_m5pmax_2026: {
    processors: [
      { id: "m5pro_15_16", label: "M5 Pro", sub: "15-Core CPU / 16-Core GPU", multiplier: 1.00 },
      { id: "m5pro_18_20", label: "M5 Pro", sub: "18-Core CPU / 20-Core GPU", multiplier: 1.20 },
      { id: "m5max_18_32", label: "M5 Max", sub: "18-Core CPU / 32-Core GPU", multiplier: 1.50 },
      { id: "m5max_18_40", label: "M5 Max", sub: "18-Core CPU / 40-Core GPU", multiplier: 1.70 },
    ],
    memory: [
      { id: "24",  label: "24 GB",  sub: "Unified Memory", multiplier: 1.00 },
      { id: "36",  label: "36 GB",  sub: "Unified Memory", multiplier: 1.10 },
      { id: "48",  label: "48 GB",  sub: "Unified Memory", multiplier: 1.18 },
      { id: "64",  label: "64 GB",  sub: "Unified Memory", multiplier: 1.30 },
      { id: "128", label: "128 GB", sub: "Unified Memory", multiplier: 1.50 },
    ],
    storage: [
      { id: "1tb", label: "1 TB", sub: "SSD", multiplier: 1.00 },
      { id: "2tb", label: "2 TB", sub: "SSD", multiplier: 1.15 },
      { id: "4tb", label: "4 TB", sub: "SSD", multiplier: 1.40 },
      { id: "8tb", label: "8 TB", sub: "SSD", multiplier: 1.75 },
    ],
    hasNanoGlass: true,
  },
  // 2024 16-inch MacBook Pro M4 Pro/Max
  mbp16m4: {
    processors: [
      { id: "m4pro_14_20", label: "M4 Pro", sub: "14-Core CPU / 20-Core GPU", multiplier: 1.00 },
      { id: "m4max_14_32", label: "M4 Max", sub: "14-Core CPU / 32-Core GPU", multiplier: 1.30 },
      { id: "m4max_16_40", label: "M4 Max", sub: "16-Core CPU / 40-Core GPU", multiplier: 1.50 },
    ],
    memory: [
      { id: "24",  label: "24 GB",  sub: "Unified Memory", multiplier: 1.00 },
      { id: "48",  label: "48 GB",  sub: "Unified Memory", multiplier: 1.10 },
      { id: "64",  label: "64 GB",  sub: "Unified Memory", multiplier: 1.20 },
      { id: "128", label: "128 GB", sub: "Unified Memory", multiplier: 1.40 },
    ],
    storage: [
      { id: "512", label: "512 GB", sub: "SSD", multiplier: 0.85 },
      { id: "1tb", label: "1 TB",   sub: "SSD", multiplier: 1.00 },
      { id: "2tb", label: "2 TB",   sub: "SSD", multiplier: 1.18 },
      { id: "4tb", label: "4 TB",   sub: "SSD", multiplier: 1.40 },
      { id: "8tb", label: "8 TB",   sub: "SSD", multiplier: 1.70 },
    ],
    hasNanoGlass: true,
  },
  // 2024 14-inch MacBook Pro M4
  mbp14m4: {
    processors: [
      { id: "m4_10_10",    label: "M4",     sub: "10-Core CPU / 10-Core GPU", multiplier: 1.00 },
      { id: "m4pro_12_16", label: "M4 Pro", sub: "12-Core CPU / 16-Core GPU", multiplier: 1.30 },
      { id: "m4pro_14_20", label: "M4 Pro", sub: "14-Core CPU / 20-Core GPU", multiplier: 1.45 },
      { id: "m4max_14_32", label: "M4 Max", sub: "14-Core CPU / 32-Core GPU", multiplier: 1.70 },
      { id: "m4max_16_40", label: "M4 Max", sub: "16-Core CPU / 40-Core GPU", multiplier: 1.90 },
    ],
    memory: [
      { id: "16",  label: "16 GB",  sub: "Unified Memory", multiplier: 1.00 },
      { id: "24",  label: "24 GB",  sub: "Unified Memory", multiplier: 1.06 },
      { id: "36",  label: "36 GB",  sub: "Unified Memory", multiplier: 1.14 },
      { id: "48",  label: "48 GB",  sub: "Unified Memory", multiplier: 1.20 },
      { id: "64",  label: "64 GB",  sub: "Unified Memory", multiplier: 1.30 },
      { id: "128", label: "128 GB", sub: "Unified Memory", multiplier: 1.50 },
    ],
    storage: [
      { id: "512", label: "512 GB", sub: "SSD", multiplier: 0.85 },
      { id: "1tb", label: "1 TB",   sub: "SSD", multiplier: 1.00 },
      { id: "2tb", label: "2 TB",   sub: "SSD", multiplier: 1.18 },
      { id: "4tb", label: "4 TB",   sub: "SSD", multiplier: 1.40 },
      { id: "8tb", label: "8 TB",   sub: "SSD", multiplier: 1.70 },
    ],
    hasNanoGlass: true,
  },
  // 2023 16-inch MacBook Pro M3 Pro/Max
  mbp16m3: {
    processors: [
      { id: "m3pro_12_18", label: "M3 Pro", sub: "12-Core CPU / 18-Core GPU", multiplier: 1.00 },
      { id: "m3max_14_30", label: "M3 Max", sub: "14-Core CPU / 30-Core GPU", multiplier: 1.30 },
      { id: "m3max_16_40", label: "M3 Max", sub: "16-Core CPU / 40-Core GPU", multiplier: 1.50 },
    ],
    memory: [
      { id: "18",  label: "18 GB",  sub: "Unified Memory", multiplier: 1.00 },
      { id: "36",  label: "36 GB",  sub: "Unified Memory", multiplier: 1.10 },
      { id: "48",  label: "48 GB",  sub: "Unified Memory", multiplier: 1.18 },
      { id: "64",  label: "64 GB",  sub: "Unified Memory", multiplier: 1.28 },
      { id: "96",  label: "96 GB",  sub: "Unified Memory", multiplier: 1.38 },
      { id: "128", label: "128 GB", sub: "Unified Memory", multiplier: 1.50 },
    ],
    storage: [
      { id: "512", label: "512 GB", sub: "SSD", multiplier: 0.85 },
      { id: "1tb", label: "1 TB",   sub: "SSD", multiplier: 1.00 },
      { id: "2tb", label: "2 TB",   sub: "SSD", multiplier: 1.18 },
      { id: "4tb", label: "4 TB",   sub: "SSD", multiplier: 1.40 },
      { id: "8tb", label: "8 TB",   sub: "SSD", multiplier: 1.70 },
    ],
    hasNanoGlass: true,
  },
  // 2023 14-inch MacBook Pro M3 / Pro / Max
  mbp14m3: {
    processors: [
      { id: "m3_8_10",     label: "M3",     sub: "8-Core CPU / 10-Core GPU",  multiplier: 1.00 },
      { id: "m3pro_11_14", label: "M3 Pro", sub: "11-Core CPU / 14-Core GPU", multiplier: 1.25 },
      { id: "m3pro_12_18", label: "M3 Pro", sub: "12-Core CPU / 18-Core GPU", multiplier: 1.40 },
      { id: "m3max_14_30", label: "M3 Max", sub: "14-Core CPU / 30-Core GPU", multiplier: 1.65 },
      { id: "m3max_16_40", label: "M3 Max", sub: "16-Core CPU / 40-Core GPU", multiplier: 1.85 },
    ],
    memory: [
      { id: "8",   label: "8 GB",   sub: "Unified Memory", multiplier: 0.92 },
      { id: "16",  label: "16 GB",  sub: "Unified Memory", multiplier: 1.00 },
      { id: "18",  label: "18 GB",  sub: "Unified Memory", multiplier: 1.04 },
      { id: "24",  label: "24 GB",  sub: "Unified Memory", multiplier: 1.08 },
      { id: "36",  label: "36 GB",  sub: "Unified Memory", multiplier: 1.16 },
      { id: "64",  label: "64 GB",  sub: "Unified Memory", multiplier: 1.30 },
      { id: "96",  label: "96 GB",  sub: "Unified Memory", multiplier: 1.42 },
      { id: "128", label: "128 GB", sub: "Unified Memory", multiplier: 1.55 },
    ],
    storage: [
      { id: "512", label: "512 GB", sub: "SSD", multiplier: 0.85 },
      { id: "1tb", label: "1 TB",   sub: "SSD", multiplier: 1.00 },
      { id: "2tb", label: "2 TB",   sub: "SSD", multiplier: 1.18 },
      { id: "4tb", label: "4 TB",   sub: "SSD", multiplier: 1.40 },
      { id: "8tb", label: "8 TB",   sub: "SSD", multiplier: 1.70 },
    ],
    hasNanoGlass: true,
  },
  // 2023 16-inch MacBook Pro M2 Pro/Max (no nano-texture this gen)
  mbp16m2: {
    processors: [
      { id: "m2pro_12_19", label: "M2 Pro", sub: "12-Core CPU / 19-Core GPU", multiplier: 1.00 },
      { id: "m2max_12_30", label: "M2 Max", sub: "12-Core CPU / 30-Core GPU", multiplier: 1.30 },
      { id: "m2max_12_38", label: "M2 Max", sub: "12-Core CPU / 38-Core GPU", multiplier: 1.45 },
    ],
    memory: [
      { id: "16", label: "16 GB", sub: "Unified Memory", multiplier: 1.00 },
      { id: "32", label: "32 GB", sub: "Unified Memory", multiplier: 1.12 },
      { id: "64", label: "64 GB", sub: "Unified Memory", multiplier: 1.28 },
      { id: "96", label: "96 GB", sub: "Unified Memory", multiplier: 1.40 },
    ],
    storage: [
      { id: "512", label: "512 GB", sub: "SSD", multiplier: 0.85 },
      { id: "1tb", label: "1 TB",   sub: "SSD", multiplier: 1.00 },
      { id: "2tb", label: "2 TB",   sub: "SSD", multiplier: 1.18 },
      { id: "4tb", label: "4 TB",   sub: "SSD", multiplier: 1.40 },
      { id: "8tb", label: "8 TB",   sub: "SSD", multiplier: 1.70 },
    ],
    hasNanoGlass: false,
  },
  // 2023 14-inch MacBook Pro M2 Pro/Max
  mbp14m2: {
    processors: [
      { id: "m2pro_10_16", label: "M2 Pro", sub: "10-Core CPU / 16-Core GPU", multiplier: 1.00 },
      { id: "m2pro_12_19", label: "M2 Pro", sub: "12-Core CPU / 19-Core GPU", multiplier: 1.15 },
      { id: "m2max_12_30", label: "M2 Max", sub: "12-Core CPU / 30-Core GPU", multiplier: 1.40 },
      { id: "m2max_12_38", label: "M2 Max", sub: "12-Core CPU / 38-Core GPU", multiplier: 1.55 },
    ],
    memory: [
      { id: "16", label: "16 GB", sub: "Unified Memory", multiplier: 1.00 },
      { id: "32", label: "32 GB", sub: "Unified Memory", multiplier: 1.12 },
      { id: "64", label: "64 GB", sub: "Unified Memory", multiplier: 1.28 },
      { id: "96", label: "96 GB", sub: "Unified Memory", multiplier: 1.40 },
    ],
    storage: [
      { id: "512", label: "512 GB", sub: "SSD", multiplier: 0.85 },
      { id: "1tb", label: "1 TB",   sub: "SSD", multiplier: 1.00 },
      { id: "2tb", label: "2 TB",   sub: "SSD", multiplier: 1.18 },
      { id: "4tb", label: "4 TB",   sub: "SSD", multiplier: 1.40 },
      { id: "8tb", label: "8 TB",   sub: "SSD", multiplier: 1.70 },
    ],
    hasNanoGlass: false,
  },
  // 2025 14-inch MacBook Pro M5 (base chip line) — Atlas only lists M5
  // Pro/Max variants for this gen but the base M5 is configurable too.
  // No nano glass on the base M5 model.
  mbp14_m5_2025: {
    processors: [
      { id: "m5_10_10",      label: "M5",     sub: "10-Core CPU / 10-Core GPU", multiplier: 1.00 },
      { id: "m5pro_12_16",   label: "M5 Pro", sub: "12-Core CPU / 16-Core GPU", multiplier: 1.25 },
      { id: "m5max_14_32",   label: "M5 Max", sub: "14-Core CPU / 32-Core GPU", multiplier: 1.55 },
    ],
    memory: [
      { id: "16", label: "16 GB", sub: "Unified Memory", multiplier: 1.00 },
      { id: "24", label: "24 GB", sub: "Unified Memory", multiplier: 1.08 },
      { id: "36", label: "36 GB", sub: "Unified Memory", multiplier: 1.20 },
      { id: "48", label: "48 GB", sub: "Unified Memory", multiplier: 1.28 },
    ],
    storage: [
      { id: "512", label: "512 GB", sub: "SSD", multiplier: 0.85 },
      { id: "1tb", label: "1 TB",   sub: "SSD", multiplier: 1.00 },
      { id: "2tb", label: "2 TB",   sub: "SSD", multiplier: 1.20 },
    ],
    hasNanoGlass: false,
  },
  // 2026 MacBook Air M5 — Skywalker has 13 + 15 combined as one catalog
  // entry, so screen size lives on the processor step (M5 chip is the
  // same across sizes; the 15-inch just commands a price premium).
  mba_m5_2026: {
    processors: [
      { id: "m5_13",       label: "M5 (13-inch)", sub: "10-Core CPU / 8-10C GPU",  multiplier: 0.85 },
      { id: "m5_15",       label: "M5 (15-inch)", sub: "10-Core CPU / 10-Core GPU", multiplier: 1.05 },
    ],
    memory: [
      { id: "16", label: "16 GB", sub: "Unified Memory", multiplier: 1.00 },
      { id: "24", label: "24 GB", sub: "Unified Memory", multiplier: 1.10 },
    ],
    storage: [
      { id: "256", label: "256 GB", sub: "SSD", multiplier: 0.85 },
      { id: "512", label: "512 GB", sub: "SSD", multiplier: 1.00 },
      { id: "1tb", label: "1 TB",   sub: "SSD", multiplier: 1.15 },
      { id: "2tb", label: "2 TB",   sub: "SSD", multiplier: 1.35 },
    ],
    hasNanoGlass: false,
  },
  // 2024 MacBook Air 15" M3
  mba15m3: {
    processors: [
      { id: "m3_8_10", label: "M3", sub: "8-Core CPU / 10-Core GPU", multiplier: 1.00 },
    ],
    memory: [
      { id: "8",  label: "8 GB",  sub: "Unified Memory", multiplier: 0.92 },
      { id: "16", label: "16 GB", sub: "Unified Memory", multiplier: 1.00 },
      { id: "24", label: "24 GB", sub: "Unified Memory", multiplier: 1.10 },
    ],
    storage: [
      { id: "256", label: "256 GB", sub: "SSD", multiplier: 0.85 },
      { id: "512", label: "512 GB", sub: "SSD", multiplier: 1.00 },
      { id: "1tb", label: "1 TB",   sub: "SSD", multiplier: 1.15 },
      { id: "2tb", label: "2 TB",   sub: "SSD", multiplier: 1.35 },
    ],
    hasNanoGlass: false,
  },
  // 2024 MacBook Air 13" M3
  mba13m3: {
    processors: [
      { id: "m3_8_8",  label: "M3", sub: "8-Core CPU / 8-Core GPU",  multiplier: 1.00 },
      { id: "m3_8_10", label: "M3", sub: "8-Core CPU / 10-Core GPU", multiplier: 1.05 },
    ],
    memory: [
      { id: "8",  label: "8 GB",  sub: "Unified Memory", multiplier: 0.92 },
      { id: "16", label: "16 GB", sub: "Unified Memory", multiplier: 1.00 },
      { id: "24", label: "24 GB", sub: "Unified Memory", multiplier: 1.10 },
    ],
    storage: [
      { id: "256", label: "256 GB", sub: "SSD", multiplier: 0.85 },
      { id: "512", label: "512 GB", sub: "SSD", multiplier: 1.00 },
      { id: "1tb", label: "1 TB",   sub: "SSD", multiplier: 1.15 },
      { id: "2tb", label: "2 TB",   sub: "SSD", multiplier: 1.35 },
    ],
    hasNanoGlass: false,
  },
  // 2023 MacBook Air 15" M2
  mba15m2: {
    processors: [
      { id: "m2_8_10", label: "M2", sub: "8-Core CPU / 10-Core GPU", multiplier: 1.00 },
    ],
    memory: [
      { id: "8",  label: "8 GB",  sub: "Unified Memory", multiplier: 0.92 },
      { id: "16", label: "16 GB", sub: "Unified Memory", multiplier: 1.00 },
      { id: "24", label: "24 GB", sub: "Unified Memory", multiplier: 1.10 },
    ],
    storage: [
      { id: "256", label: "256 GB", sub: "SSD", multiplier: 0.85 },
      { id: "512", label: "512 GB", sub: "SSD", multiplier: 1.00 },
      { id: "1tb", label: "1 TB",   sub: "SSD", multiplier: 1.15 },
      { id: "2tb", label: "2 TB",   sub: "SSD", multiplier: 1.35 },
    ],
    hasNanoGlass: false,
  },
  // 2022 MacBook Air 13" M2
  mba13m2: {
    processors: [
      { id: "m2_8_8",  label: "M2", sub: "8-Core CPU / 8-Core GPU",  multiplier: 1.00 },
      { id: "m2_8_10", label: "M2", sub: "8-Core CPU / 10-Core GPU", multiplier: 1.05 },
    ],
    memory: [
      { id: "8",  label: "8 GB",  sub: "Unified Memory", multiplier: 0.92 },
      { id: "16", label: "16 GB", sub: "Unified Memory", multiplier: 1.00 },
      { id: "24", label: "24 GB", sub: "Unified Memory", multiplier: 1.10 },
    ],
    storage: [
      { id: "256", label: "256 GB", sub: "SSD", multiplier: 0.85 },
      { id: "512", label: "512 GB", sub: "SSD", multiplier: 1.00 },
      { id: "1tb", label: "1 TB",   sub: "SSD", multiplier: 1.15 },
      { id: "2tb", label: "2 TB",   sub: "SSD", multiplier: 1.35 },
    ],
    hasNanoGlass: false,
  },
  // 2020 MacBook Air 13" M1 — first Apple Silicon Mac, simpler config
  mba13m1: {
    processors: [
      { id: "m1_8_7", label: "M1", sub: "8-Core CPU / 7-Core GPU", multiplier: 1.00 },
      { id: "m1_8_8", label: "M1", sub: "8-Core CPU / 8-Core GPU", multiplier: 1.05 },
    ],
    memory: [
      { id: "8",  label: "8 GB",  sub: "Unified Memory", multiplier: 0.92 },
      { id: "16", label: "16 GB", sub: "Unified Memory", multiplier: 1.00 },
    ],
    storage: [
      { id: "256", label: "256 GB", sub: "SSD", multiplier: 0.85 },
      { id: "512", label: "512 GB", sub: "SSD", multiplier: 1.00 },
      { id: "1tb", label: "1 TB",   sub: "SSD", multiplier: 1.15 },
      { id: "2tb", label: "2 TB",   sub: "SSD", multiplier: 1.35 },
    ],
    hasNanoGlass: false,
  },
  // 2020 MacBook Pro 13" M1 — same chip as Air M1 but with active cooling
  mbp13m1: {
    processors: [
      { id: "m1_8_8", label: "M1", sub: "8-Core CPU / 8-Core GPU", multiplier: 1.00 },
    ],
    memory: [
      { id: "8",  label: "8 GB",  sub: "Unified Memory", multiplier: 0.92 },
      { id: "16", label: "16 GB", sub: "Unified Memory", multiplier: 1.00 },
    ],
    storage: [
      { id: "256", label: "256 GB", sub: "SSD", multiplier: 0.85 },
      { id: "512", label: "512 GB", sub: "SSD", multiplier: 1.00 },
      { id: "1tb", label: "1 TB",   sub: "SSD", multiplier: 1.15 },
      { id: "2tb", label: "2 TB",   sub: "SSD", multiplier: 1.35 },
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
const hasMacSpecs = (modelId: string | undefined | null): boolean => !!modelId && !!MACBOOK_SPECS[modelId];
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
              <div className="flex items-center gap-2 pt-3 border-t border-white/5">
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

export default function Home() {
  const [step, setStep] = useState<Step>("device");
  const [category, setCategory] = useState<"phones" | "tablets" | "computers" | "desktops" | "consoles" | "watches" | "drones" | "vr" | null>(null);
  const [deviceType, setDeviceType] = useState<DeviceType>(null);
  const [selectedSeries, setSelectedSeries] = useState<string | null>(null);
  const [selectedSubSeries, setSelectedSubSeries] = useState<string | null>(null);
  const [carrier, setCarrier] = useState<typeof CARRIERS[0] | null>(null);
  const [carrierLock, setCarrierLock] = useState<typeof CARRIER_LOCKS[0] | null>(null);
  const [page, setPage] = useState<"home" | "about" | "privacy" | "terms" | "grading" | "shipping">("home");
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
  const isNoStorageDevice =
    deviceType === "console" || deviceType === "sony" || deviceType === "microsoft" || deviceType === "nintendo" ||
    deviceType === "applewatch" || deviceType === "pixelwatch" || deviceType === "garmin" || deviceType === "samsungwatch" ||
    deviceType === "apple_vr" || deviceType === "meta_vr" || deviceType === "valve_vr" || deviceType === "psvr" ||
    deviceType === "dji";
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
  // MacBook spec'd flow has 7 steps:
  //   processor -> memory -> storage -> [displayglass?] -> condition
  //   -> batteryhealth -> charger -> quote
  const macSpecFlow = !!(model && hasMacSpecs(model.id));
  const macHasGlassStep = !!(macSpecFlow && model && MACBOOK_SPECS[model.id].hasNanoGlass);
  const funnelTotal = macSpecFlow
    ? (macHasGlassStep ? 7 : 6)
    : isNoStorageDevice
      ? 2
      : isPhoneFlow
        ? (carrierAsksLock ? 5 : 4)
        : isIpadCellular
          ? (carrierAsksLock ? 6 : 5)
          : isIpadFlow
            ? 4
            : 3;
  const funnelStepNum = macSpecFlow ? (
    step === "processor" ? 1 :
    step === "memory" ? 2 :
    step === "storage" ? 3 :
    step === "displayglass" ? 4 :
    step === "condition" ? (macHasGlassStep ? 5 : 4) :
    step === "batteryhealth" ? (macHasGlassStep ? 6 : 5) :
    step === "charger" ? (macHasGlassStep ? 7 : 6) :
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
  const [payout, setPayout] = useState<typeof PAYOUTS[0] | null>(null);
  // MacBook-specific picks (Wave 1). Only used when the picked model
  // has a MACBOOK_SPECS entry; otherwise these stay null and the legacy
  // flow runs unchanged.
  const [processor, setProcessor] = useState<MacSpecOption | null>(null);
  const [memory, setMemory] = useState<MacSpecOption | null>(null);
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

  // Scroll to top whenever step changes (so the new screen starts at the top, not at the button position)
  useEffect(() => {
    if (typeof window === "undefined") return;
    window.scrollTo({ top: 0, behavior: "smooth" });
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
          setStep(s.step);
        }
      }
    } catch {}
  }, []);

  useEffect(() => {
    if (step === "device") { localStorage.removeItem("tcc-session"); return; }
    try {
      localStorage.setItem("tcc-session", JSON.stringify({
        step, deviceType, selectedSeries, model, storage, condition, carrier, quantity, email,
        handoffMethod, shipStreet, shipUnit, shipCity, shipState, shipZip,
        ts: Date.now(),
      }));
    } catch {}
  }, [step, deviceType, selectedSeries, model, storage, condition, carrier, quantity, email, handoffMethod, shipStreet, shipUnit, shipCity, shipState, shipZip]);

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

  // Accessory bonus: +$15 flat when customer confirms all original accessories
  // for "new" tiers (Brand New / Flawless). Skywalker's call.
  const isNewTier = condition?.id === "brandnew" || condition?.id === "flawless";
  const accessoryBonus = isNewTier && accessoriesIncluded ? 15 : 0;
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
  const baseQuote = model && condition && model.base
    ? Math.round(
        model.base
          * storageMultiplier * condition.multiplier * carrierMultiplier
          * connectivityMultiplier * promoMultiplier * couponMultiplier
          * processorMultiplier * memoryMultiplier * displayGlassMultiplier
          * batteryHealthMultiplier * chargerMultiplier * extrasMultiplier
      ) + promoFlatBonus
    : 0;
  const quote = baseQuote + accessoryBonus;
  // Inquiry-only models have no base price (or 0). We still let the
  // user walk the funnel + add to cart; the quote step shows
  // 'Quote pending' instead of a number, and the cart marks the line
  // 'Pending quote'.
  const isPendingQuote = !model?.base;

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
    else if (step === "displayglass") { setStep("storage"); setStorage(null); }
    else if (step === "batteryhealth") { setStep("condition"); setCondition(null); }
    else if (step === "charger") { setStep("batteryhealth"); setBatteryHealth(null); }
    else if (step === "extras") {
      if (extrasIndex > 0) {
        // Back up one question within the extras flow.
        const ex = getBrandExtras(deviceType);
        const prev = ex[extrasIndex - 1];
        if (prev) {
          const next = { ...extras };
          delete next[prev.id];
          setExtras(next);
        }
        setExtrasIndex(extrasIndex - 1);
      } else {
        setStep("condition"); setCondition(null);
      }
    }
    else if (step === "condition") {
      if (model && hasMacSpecs(model.id)) {
        // Mac flow has condition AFTER storage/displayglass — go back accordingly
        if (MACBOOK_SPECS[model.id].hasNanoGlass) { setStep("displayglass"); setDisplayGlass(null); }
        else { setStep("storage"); setStorage(null); }
      } else {
        setStep("model"); setModel(null);
      }
    }
    else if (step === "connectivity") {
      // If this device has brand extras, back through the last question instead
      // of jumping straight to condition.
      const ex = getBrandExtras(deviceType);
      if (ex.length > 0) {
        setExtrasIndex(ex.length - 1);
        setStep("extras"); // keep last answer until they re-pick
      } else {
        setStep("condition"); setCondition(null);
      }
    }
    else if (step === "storage") {
      if (model && hasMacSpecs(model.id)) { setStep("memory"); setMemory(null); }
      else if (deviceType === "ipad") { setStep("connectivity"); setConnectivity(null); }
      else { setStep("condition"); setCondition(null); }
    }
    else if (step === "carrier") { setStep("storage"); setStorage(null); }
    else if (step === "carrier-lock") { setStep("carrier"); setCarrier(null); }
    else if (step === "quote") {
      if (charger) { setStep("charger"); setCharger(null); }
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
    setProcessor(null); setMemory(null); setDisplayGlass(null);
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
            {getBrandExtras(deviceType).filter(q => extras[q.id]).map((q) => (
              <div key={q.id} className="flex items-center justify-between py-1.5">
                <span className="text-[#b8b8b8] text-xs">{q.question.replace(/\?$/, "")}</span>
                <button onClick={() => { setExtrasIndex(getBrandExtras(deviceType).findIndex(x => x.id === q.id)); setStep("extras"); pushHistory("extras"); }} className="inline-flex items-center gap-1.5 text-white text-xs font-extrabold cursor-pointer hover:text-[#00c853] transition">
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
            {isPendingQuote ? (
              <>
                <p className="text-[#b8b8b8] text-sm">Your device will be</p>
                <p className="text-white font-extrabold text-xl mt-1 leading-tight">Quoted via email or text</p>
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
    <aside className="hidden lg:block lg:w-[300px] shrink-0">
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
            ...getBrandExtras(deviceType).map(q => ({
              label: q.question.replace(/\?$/, ""),
              value: extras[q.id]?.label,
              active: step === "extras" && getBrandExtras(deviceType)[extrasIndex]?.id === q.id,
              helpId: null as null,
              show: true,
            })),
            { label: "Connectivity", value: connectivity?.label, active: step === "connectivity", helpId: null       as null,    show: deviceType === "ipad" },
            { label: "Carrier",      value: carrier?.label,      active: step === "carrier",      helpId: "carrier"  as const,   show: isPhoneFlow || isIpadCellular },
            { label: "Carrier Lock", value: carrierLock?.label,  active: step === "carrier-lock", helpId: null       as null,    show: isPhoneFlow || isIpadCellular },
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
    <div key={i} className="flex items-center gap-3 py-2 border-b border-white/5 last:border-0">
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
    <aside className="hidden lg:block lg:w-[300px] shrink-0">
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

  // SEARCH BAR — extracted JSX so it can be rendered inline inside each
  // device-discovery step right above the selection grid (instead of as
  // a separate strip below the nav). Closer to where the eye lands.
  const searchBar = (
    <div className="relative mb-6">
      <input
        type="text"
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Escape") setSearchQuery(""); }}
        placeholder="Search device — iPhone, Galaxy, MacBook..."
        className="w-full pl-10 pr-10 py-3 bg-white/5 border border-white/10 rounded-2xl text-sm text-white placeholder:text-[#d4d4d4] focus:outline-none focus:border-[#00c853] focus:ring-4 focus:ring-[#00c853]/10 transition"
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
                      setModel({ id: h.modelId, label: h.label, base: h.base });
                      setSearchQuery("");
                      setStep("condition");
                      pushHistory("condition");
                    }}
                    className="w-full text-left px-4 py-2.5 hover:bg-white/5 transition flex items-center gap-3 border-b border-white/5 last:border-0 cursor-pointer"
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
          <button onClick={() => { reset(); window.scrollTo({ top: 0, behavior: "smooth" }); }} aria-label="Go to homepage" className="cursor-pointer group tap-press rounded-full shrink-0 bg-white/[0.04] border border-white/10 hover:bg-white/[0.07] pl-1.5 pr-3 py-1 transition">
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
          <div className="hidden lg:flex items-center gap-2 absolute left-1/2 -translate-x-1/2 bg-white/[0.04] border border-white/10 rounded-full px-2 py-1">
            {/* SELL — mega menu, dropdown centered under the trigger */}
            <div className="group relative">
              <button
                onClick={() => { setStep("category"); pushHistory("category"); }}
                className="flex items-center gap-2 px-5 py-2.5 rounded-full text-[15px] font-semibold text-white hover:text-[#00c853] hover:bg-white/5 transition cursor-pointer"
              >
                Sell
                <svg className="w-3 h-3 opacity-60 group-hover:opacity-100 group-hover:rotate-180 transition" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
              </button>
              <div className="invisible opacity-0 group-hover:visible group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 transition-all duration-300 ease-out absolute top-full left-1/2 -translate-x-1/2 pt-3 z-50 w-[560px] max-w-[calc(100vw-2rem)]">
                <div className="bg-[#111] border border-white/10 rounded-2xl shadow-2xl p-4">
                  <p className="text-[#00c853] text-[10px] font-bold uppercase tracking-[0.18em] mb-3 px-2 text-center">Sell your device</p>
                  <div className="grid grid-cols-4 gap-2">
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
                        className="flex flex-col items-center justify-center p-3 rounded-xl bg-white/[0.03] border border-white/5 hover:bg-white/10 hover:border-[#00c853]/40 transition cursor-pointer tap-press"
                      >
                        <CategoryIcon id={cat.id} className="w-7 h-7 mb-1 text-white" />
                        <p className="text-xs font-semibold text-white">{cat.label}</p>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* BULK */}
            <div className="group relative">
              <a
                href="/bulk"
                className="flex items-center gap-2 px-5 py-2.5 rounded-full text-[15px] font-semibold text-white hover:text-[#00c853] hover:bg-white/5 transition cursor-pointer"
              >
                Bulk
                <svg className="w-3 h-3 opacity-60 group-hover:opacity-100 group-hover:rotate-180 transition" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
              </a>
              <div className="invisible opacity-0 group-hover:visible group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 transition-all duration-300 ease-out absolute top-full left-1/2 -translate-x-1/2 pt-3 z-50 w-[260px]">
                <div className="bg-[#111] border border-white/10 rounded-2xl shadow-2xl p-2">
                  <a href="/bulk" className="flex items-start gap-3 px-3 py-2.5 rounded-lg hover:bg-white/5 transition">
                    <span className="text-xl">📦</span>
                    <div>
                      <p className="text-sm font-semibold text-white">Get a bulk quote</p>
                      <p className="text-[11px] text-[#e6e6e6]">10+ devices? Volume pricing.</p>
                    </div>
                  </a>
                  <a href={EMAIL_HREF} className="flex items-start gap-3 px-3 py-2.5 rounded-lg hover:bg-white/5 transition">
                    <span className="text-xl">✉️</span>
                    <div>
                      <p className="text-sm font-semibold text-white">Talk to bulk team</p>
                      <p className="text-[11px] text-[#e6e6e6]">Custom contracts welcome.</p>
                    </div>
                  </a>
                </div>
              </div>
            </div>

            {/* SUPPORT */}
            <div className="group relative">
              <button
                className="flex items-center gap-2 px-5 py-2.5 rounded-full text-[15px] font-semibold text-white hover:text-[#00c853] hover:bg-white/5 transition cursor-pointer"
              >
                Support
                <svg className="w-3 h-3 opacity-60 group-hover:opacity-100 group-hover:rotate-180 transition" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
              </button>
              <div className="invisible opacity-0 group-hover:visible group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 transition-all duration-300 ease-out absolute top-full left-1/2 -translate-x-1/2 pt-3 z-50 w-[280px]">
                <div className="bg-[#111] border border-white/10 rounded-2xl shadow-2xl p-2">
                  <a href="/how-it-works" className="flex items-start gap-3 px-3 py-2.5 rounded-lg hover:bg-white/5 transition">
                    <span className="text-xl">🧭</span>
                    <div>
                      <p className="text-sm font-semibold text-white">How it works</p>
                      <p className="text-[11px] text-[#e6e6e6]">From drawer to dollars in 3 steps.</p>
                    </div>
                  </a>
                  <a href="/faq" className="flex items-start gap-3 px-3 py-2.5 rounded-lg hover:bg-white/5 transition">
                    <span className="text-xl">❓</span>
                    <div>
                      <p className="text-sm font-semibold text-white">FAQ</p>
                      <p className="text-[11px] text-[#e6e6e6]">Common questions, plain answers.</p>
                    </div>
                  </a>
                  <a href="/reviews" className="flex items-start gap-3 px-3 py-2.5 rounded-lg hover:bg-white/5 transition">
                    <span className="text-xl text-[#ffb400]">★</span>
                    <div>
                      <p className="text-sm font-semibold text-white">Reviews</p>
                      <p className="text-[11px] text-[#e6e6e6]">4.9 — read what customers say.</p>
                    </div>
                  </a>
                  <a href={EMAIL_HREF} className="flex items-start gap-3 px-3 py-2.5 rounded-lg hover:bg-white/5 transition">
                    <span className="text-xl">✉️</span>
                    <div>
                      <p className="text-sm font-semibold text-white">Email us</p>
                      <p className="text-[11px] text-[#e6e6e6]">We reply same business day.</p>
                    </div>
                  </a>
                  <a href="tel:+18775492056" className="flex items-start gap-3 px-3 py-2.5 rounded-lg hover:bg-white/5 transition">
                    <span className="text-xl">📞</span>
                    <div>
                      <p className="text-sm font-semibold text-white">Call us</p>
                      <p className="text-[11px] text-[#e6e6e6]">(877) 549-2056</p>
                    </div>
                  </a>
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT: cart + login/name (desktop) | cart + hamburger (mobile) — wrapped in matching pill */}
          <div className="flex items-center gap-1 shrink-0 bg-white/[0.04] border border-white/10 rounded-full px-1.5 py-1">
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
      </nav>

      {/* Search bar JSX is defined as the `searchBar` const above and rendered inline inside each device-discovery step section, right above the selection grid (close to where the eye lands). */}

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
            <div className="border-b border-white/5">
              <button
                onClick={() => setMobileMenuExpanded(mobileMenuExpanded === "sell" ? null : "sell")}
                className="w-full flex items-center justify-between px-5 py-4 hover:bg-white/[0.03] transition tap-press"
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
                      className="flex flex-col items-center justify-center p-3 rounded-xl bg-white/[0.03] border border-white/5 hover:bg-white/10 hover:border-[#00c853]/40 transition cursor-pointer tap-press"
                    >
                      <CategoryIcon id={cat.id} className="w-7 h-7 mb-1 text-white" />
                      <p className="text-[11px] font-semibold text-white">{cat.label}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* BULK section */}
            <div className="border-b border-white/5">
              <button
                onClick={() => setMobileMenuExpanded(mobileMenuExpanded === "bulk" ? null : "bulk")}
                className="w-full flex items-center justify-between px-5 py-4 hover:bg-white/[0.03] transition tap-press"
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
            <div className="border-b border-white/5">
              <button
                onClick={() => setMobileMenuExpanded(mobileMenuExpanded === "support" ? null : "support")}
                className="w-full flex items-center justify-between px-5 py-4 hover:bg-white/[0.03] transition tap-press"
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
              className="w-full flex items-center gap-3 px-5 py-4 hover:bg-white/[0.03] transition tap-press border-b border-white/5"
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
                        <div key={i} className="text-xs bg-white/[0.03] border border-white/5 rounded-lg px-3 py-2">
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
                  <div className="bg-white/[0.03] border border-white/10 rounded-xl p-4 mb-4 text-center">
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
        <div className="bg-[#0a0a0a] border-b border-white/5">
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
                <strong className="text-white">Or have us come to you.</strong> Our mobile tech meets you at Starbucks, your office, or a local Safe Exchange zone — marked vehicle, ETA text, watch the wipe, paid before we walk back to the car.
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
              { num: "4", title: "Bring your ID", body: "Texas DL or US passport. Required by Austin's pawn / secondhand-goods ordinance." },
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
              { n: 2, icon: "📦", title: "Ship free or drop off", body: "Print our prepaid label, or drop off in Austin. We pay shipping. Insured up to $1,000." },
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
            <p className="text-[#e6e6e6] text-sm mb-4">Search by name, or pick a category below</p>
            {searchBar}
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
                        const urls: string[] = [...photoUrls];
                        for (const file of Array.from(files)) {
                          try {
                            const fd = new FormData();
                            fd.append("file", file);
                            const res = await fetch("/api/upload", { method: "POST", body: fd });
                            const data = await res.json();
                            if (data.url) urls.push(data.url);
                          } catch {}
                        }
                        setPhotoUrls(urls);
                        setUploading(false);
                      }} />
                    </label>
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
            {searchBar}
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

            {searchBar}

            {/* iPhone: All variants flat (series intermediate removed) */}
            {deviceType === "iphone" && (
              <>
                <div className="space-y-2">
                  {models.map((m) => {
                    const seriesImg = IPHONE_SERIES.find(s => s.id === selectedSeries);
                    const imgSrc = (m as { image?: string }).image || ({ip17pm:"/iphone17.png",ip17p:"/iphone17.png",ip17air:"/iphone17air.png",ip17:"/iphone17base.png",ip17e:"/iphone17e.png",ip16pm:"/iphone16.png",ip16p:"/iphone16.png",ip16plus:"/iphone16plus.png",ip16:"/iphone16base.png",ip16e:"/iphone16e.png",ip15pm:"/iphone15.png",ip15p:"/iphone15.png",ip15plus:"/iphone15.png",ip15:"/iphone15base.png",ip14pm:"/iphone14.png",ip14p:"/iphone14.png",ip14plus:"/iphone14plus.png",ip14:"/iphone14base.png",ip13pm:"/iphone13.png",ip13p:"/iphone13.png",ip13:"/iphone13base.png",ip12pm:"/iphone12.png",ip12p:"/iphone12.png",ip12:"/iphone12base.png",ip12mini:"/iphone12mini.png",ip11pm:"/iphone11.png",ip11p:"/iphone11.png",ip11:"/iphone11base.png"} as Record<string,string>)[m.id] || (seriesImg as {image?:string})?.image || null;
                    return (
                    <button key={m.id} onClick={() => { setModel(m); setStep("condition"); pushHistory("condition"); }} className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 cursor-pointer transition text-left tap-press">
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
              </>
            )}

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

            {/* Samsung Galaxy: variants of the picked series */}
            {deviceType === "android" && selectedSeries && (() => {
              const ser = SAMSUNG_SERIES.find(s => s.id === selectedSeries);
              return (
                <>
                  <h2 className="text-2xl font-bold mb-1">{ser?.label}</h2>
                  <p className="text-[#e6e6e6] text-sm mb-4">{ser?.year}</p>
                  <div className="space-y-2">
                    {models.map((m) => {
                      const mImage = (m as { image?: string }).image;
                      return (
                        <button key={m.id} onClick={() => { setModel(m); setStep("condition"); pushHistory("condition"); }} className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 cursor-pointer transition text-left tap-press">
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
                </>
              );
            })()}

            {/* Google Pixel: All variants flat */}
            {deviceType === "pixel" && (
              <>
                <div className="space-y-2">
                  {models.map((m) => {
                    const mImage = (m as { image?: string }).image;
                    return (
                    <button key={m.id} onClick={() => { setModel(m); setStep("condition"); pushHistory("condition"); }} className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 cursor-pointer transition text-left tap-press">
                      {mImage ? (
                        <img src={mImage} alt={m.label} loading="lazy" className="w-10 h-10 object-contain shrink-0" />
                      ) : (
                        <div className="w-10 h-10 shrink-0" />
                      )}
                      <p className="font-semibold text-[15px] flex-1">{m.label}</p>
                      <div className="flex items-center gap-2">
                        <span className="text-[#00c853] font-bold text-sm">Get an offer</span>
                        <svg className="w-4 h-4 text-[#e6e6e6]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                      </div>
                    </button>
                  )})}
                </div>
              </>
            )}

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

            {/* MacBook: variants of the picked series */}
            {deviceType === "macbook" && selectedSeries && (() => {
              const ser = MACBOOK_SERIES.find(s => s.id === selectedSeries);
              return (
                <>
                  <h2 className="text-2xl font-bold mb-1">{ser?.label}</h2>
                  <p className="text-[#e6e6e6] text-sm mb-4">{ser?.year}</p>
                  <div className="space-y-2">
                    {models.map((m) => {
                      const inq = !!(m as { inquiryOnly?: boolean }).inquiryOnly;
                      const mImg = (m as { image?: string }).image;
                      return (
                        <button key={m.id} onClick={() => {
                          setModel(m);
                          // Models with a MACBOOK_SPECS entry go through the
                          // new IWM-style flow (processor -> memory -> storage
                          // -> display -> condition -> battery -> charger).
                          // Other models keep the legacy condition-first flow.
                          const next: Step = hasMacSpecs(m.id) ? "processor" : "condition";
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
                </>
              );
            })()}

            {/* iPad: All variants flat */}
            {deviceType === "ipad" && (
              <>
                <div className="space-y-2">
                  {models.map((m) => {
                    const mImg = (m as { image?: string }).image;
                    return (
                      <button key={m.id} onClick={() => { setModel(m); setStep("condition"); pushHistory("condition"); }} className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 cursor-pointer transition text-left tap-press">
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
              </>
            )}

            {/* DJI Drones: No pricing, goes to inquiry */}
            {deviceType === "dji" && (
              <>
                <h2 className="text-2xl font-bold mb-1">Select your drone</h2>
                <p className="text-[#e6e6e6] text-sm mb-6">Choose your DJI model</p>
                <div className="space-y-2">
                  {DJI_MODELS.map((m) => (
                    <button key={m.id} onClick={() => { setModel(m); setStep("condition"); pushHistory("condition"); }} className="w-full flex items-center justify-between px-5 py-4 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 cursor-pointer transition text-left tap-press">
                      <p className="font-semibold text-[15px]">{m.label}</p>
                      <div className="flex items-center gap-2">
                        <span className="text-[#00c853] font-bold text-sm">Get Quote</span>
                        <svg className="w-4 h-4 text-[#e6e6e6]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                      </div>
                    </button>
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
                      <p className="text-[#00c853] font-bold text-xs mt-0.5">Get an offer</p>
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
                        <p className="text-[#00c853] font-bold text-xs mt-0.5">Get an offer</p>
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
                      <p className="text-[#00c853] font-bold text-xs mt-0.5">Get an offer</p>
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
                      <p className="text-[#00c853] font-bold text-xs mt-0.5">Get an offer</p>
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
                      <p className="text-[#00c853] font-bold text-xs mt-0.5">Get an offer</p>
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
                        <p className="text-[#00c853] font-bold text-xs mt-0.5">Get an offer</p>
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
                      <p className="text-[#00c853] font-bold text-xs mt-0.5">Get an offer</p>
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
                      <p className="text-[#00c853] font-bold text-xs mt-0.5">Get an offer</p>
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
                        <p className="text-[#00c853] font-bold text-xs mt-0.5">Get an offer</p>
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
                      <p className="text-[#00c853] font-bold text-xs mt-0.5">Get an offer</p>
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
                      <p className="text-[#00c853] font-bold text-xs mt-0.5">Get an offer</p>
                    </button>
                  ))}
                </div>
              </>
            )}

            {/* Lenovo Tab: All variants flat */}
            {deviceType === "lenovo_tab" && (
              <>
                <div className="space-y-2">
                  {lenovoTabVariants.map((m) => (
                    <button key={m.id} onClick={() => { setModel(m); setStep("condition"); pushHistory("condition"); }} className="w-full flex items-center justify-between px-5 py-4 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 cursor-pointer transition text-left tap-press">
                      <p className="font-semibold text-[15px]">{m.label}</p>
                      <div className="flex items-center gap-2">
                        <span className="text-[#00c853] font-bold text-sm">Get Offer</span>
                        <svg className="w-4 h-4 text-[#e6e6e6]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                      </div>
                    </button>
                  ))}
                </div>
              </>
            )}

            {/* Surface: All variants flat */}
            {deviceType === "surface" && (
              <>
                <div className="space-y-2">
                  {surfaceVariants.map((m) => (
                    <button key={m.id} onClick={() => { setModel(m); setStep("condition"); pushHistory("condition"); }} className="w-full flex items-center justify-between px-5 py-4 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 cursor-pointer transition text-left tap-press">
                      <p className="font-semibold text-[15px]">{m.label}</p>
                      <div className="flex items-center gap-2">
                        <span className="text-[#00c853] font-bold text-sm">Get Offer</span>
                        <svg className="w-4 h-4 text-[#e6e6e6]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                      </div>
                    </button>
                  ))}
                </div>
              </>
            )}

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
                      <p className="text-[#00c853] font-bold text-xs mt-0.5">Get an offer</p>
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
                        setModel(m); setStep("condition"); pushHistory("condition");
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
                        setModel(m); setStep("condition"); pushHistory("condition");
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
            {(deviceType === "apple_vr" || deviceType === "meta_vr" || deviceType === "valve_vr" || deviceType === "psvr" || deviceType === "samsung_tab" || deviceType === "oneplus_tab" || deviceType === "google_tab") && (
              <>
                <h2 className="text-2xl md:text-3xl font-bold mb-1">Select your device</h2>
                <p className="text-[#e6e6e6] text-sm mb-6">Choose your model</p>
                <div className="space-y-2">
                  {(deviceType === "apple_vr" ? APPLE_VR_MODELS : deviceType === "meta_vr" ? META_VR_MODELS : deviceType === "valve_vr" ? VALVE_VR_MODELS : deviceType === "psvr" ? PSVR_MODELS : deviceType === "samsung_tab" ? SAMSUNG_TAB_MODELS : deviceType === "oneplus_tab" ? ONEPLUS_TAB_MODELS : GOOGLE_TAB_MODELS).map((m) => {
                    const mImage = (m as { image?: string }).image;
                    return (
                    <button key={m.id} onClick={() => { setModel(m); setStep("condition"); pushHistory("condition"); }} className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 cursor-pointer transition text-left tap-press">
                      {mImage ? (
                        <img src={mImage} alt={m.label} loading="lazy" className="w-10 h-10 object-contain shrink-0" />
                      ) : (
                        <div className="w-10 h-10 shrink-0" />
                      )}
                      <p className="font-semibold text-[15px] flex-1">{m.label}</p>
                      <div className="flex items-center gap-2">
                        <span className="text-[#00c853] font-bold text-sm">Get Offer</span>
                        <svg className="w-4 h-4 text-[#e6e6e6]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                      </div>
                    </button>
                  )})}
                </div>
              </>
            )}

            {/* Other categories (consoles incl. Sony, watches): Flat model list */}
            {deviceType !== "iphone" && deviceType !== "ipad" && deviceType !== "android" && deviceType !== "pixel" && deviceType !== "dji" && deviceType !== "apple_vr" && deviceType !== "meta_vr" && deviceType !== "valve_vr" && deviceType !== "psvr" && deviceType !== "samsung_tab" && deviceType !== "surface" && deviceType !== "lenovo_tab" && deviceType !== "oneplus_tab" && deviceType !== "google_tab" && category !== "computers" && category !== "desktops" && (
              <>
                <div className="space-y-2">
                  {models.map((m) => {
                    const inq = !!(m as { inquiryOnly?: boolean }).inquiryOnly;
                    return (
                      <button key={m.id} onClick={() => {
                        setModel(m); setStep("condition"); pushHistory("condition");
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
              </>
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
      {/* STEP: PROCESSOR — MacBook only, gated on hasMacSpecs(model) */}
      {step === "processor" && page === "home" && model && hasMacSpecs(model.id) && (
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
              <p className="text-[#b8b8b8] text-xs mb-3">Find this in <span className="text-[#e6e6e6] font-semibold"> Menu &gt; About This Mac</span></p>
              <div className="tcc-selection-frame">
                <div className="space-y-2">
                  {(MACBOOK_SPECS[model.id]?.processors || []).map((p) => (
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

      {/* STEP: MEMORY — MacBook only */}
      {step === "memory" && page === "home" && model && hasMacSpecs(model.id) && (
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
              <p className="text-[#b8b8b8] text-xs mb-3">Find this in <span className="text-[#e6e6e6] font-semibold"> Menu &gt; About This Mac</span></p>
              <div className="tcc-selection-frame">
                <div className="space-y-2">
                  {(MACBOOK_SPECS[model.id]?.memory || []).map((m) => (
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

      {/* STEP: DISPLAY GLASS — MacBook Pro 16/14 only, between storage and condition */}
      {step === "displayglass" && page === "home" && model && hasMacSpecs(model.id) && (
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

      {/* STEP: BATTERY HEALTH — MacBook only, between condition and charger */}
      {step === "batteryhealth" && page === "home" && model && hasMacSpecs(model.id) && (
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
              <p className="text-[#b8b8b8] text-xs mb-3">Check it in <span className="text-[#e6e6e6] font-semibold"> Menu &gt; System Settings &gt; Battery &gt; Battery Health</span></p>
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

      {/* STEP: CHARGER — MacBook only, final step before quote */}
      {step === "charger" && page === "home" && model && hasMacSpecs(model.id) && (
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
                    <button key={c.id} onClick={() => { setCharger(c); setShowConfetti(true); setTimeout(() => setShowConfetti(false), 3000); setStep("quote"); pushHistory("quote"); }} className="tcc-card group w-full flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer text-left">
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
        const list = getBrandExtras(deviceType);
        const q = list[extrasIndex];
        if (!q) {
          // Defensive — shouldn't render in this state because the answer
          // handler routes onward when extrasIndex hits the end. If we do
          // somehow land here, kick to the next step.
          setTimeout(() => {
            const ns: Step = isNoStorageDevice ? "quote" : "storage";
            setStep(ns); pushHistory(ns);
          }, 0);
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
                {q.helper && <p className="text-[#b8b8b8] text-xs mb-3">{q.helper}</p>}
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
                          const nextIdx = extrasIndex + 1;
                          if (nextIdx < list.length) {
                            setExtrasIndex(nextIdx);
                          } else {
                            // All extras answered — route to next funnel step.
                            // iPad has its connectivity step before storage; everything
                            // else with storage goes straight to storage.
                            const ns: Step = isNoStorageDevice
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
                  {(hasMacSpecs(model.id) ? MACBOOK_SPECS[model.id].storage : getStoragesForModel(model.id)).map((s) => (
                    <button
                      key={s.id}
                      onClick={() => {
                        // For MacBooks with a spec block, storage uses the
                        // dedicated MACBOOK_SPECS option list. We park the
                        // chosen option into the existing 'storage' state slot
                        // (cast via unknown so the field shape lines up
                        // enough for selectionPanel rendering).
                        setStorage(s as unknown as typeof ALL_STORAGES[0]);
                        if (hasMacSpecs(model.id)) {
                          const next: Step = MACBOOK_SPECS[model.id].hasNanoGlass ? "displayglass" : "condition";
                          setStep(next); pushHistory(next);
                          return;
                        }
                        const isPhone = deviceType === "iphone" || deviceType === "android" || deviceType === "pixel";
                        const ns: Step = (isPhone || isIpadCellular) ? "carrier" : "quote";
                        if (ns === "quote") { setShowConfetti(true); setTimeout(() => setShowConfetti(false), 3000); }
                        setStep(ns); pushHistory(ns);
                      }}
                      className="tcc-card group w-full flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer text-left"
                    >
                      <div className="flex-1 min-w-0 flex items-center gap-2">
                        <p className="font-extrabold text-[15px] text-white leading-tight">{s.label}</p>
                        {!hasMacSpecs(model.id) && (
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
              Not sure? <button type="button" onClick={() => setConditionHelpId(getConditionsFor(deviceType)[0]?.id || "flawless")} className="text-[#00c853] font-semibold hover:underline cursor-pointer">Help me choose</button>
            </p>
            {stepProgress}
            <div className="tcc-selection-frame">
            <div className="space-y-2">
              {getConditionsFor(deviceType).map((c) => (
                <button
                  key={c.id}
                  onClick={() => {
                    setCondition(c);
                    // MacBook spec'd flow: condition comes AFTER storage (and
                    // displayglass if applicable), so when this fires the next
                    // step is battery health.
                    if (model && hasMacSpecs(model.id)) {
                      setStep("batteryhealth"); pushHistory("batteryhealth");
                      return;
                    }
                    // Brand-specific extras (PS5 disc drive, DJI hours flown,
                    // smartwatch band etc) fire BEFORE the quote so the
                    // pricing reflects them.
                    if (getBrandExtras(deviceType).length > 0) {
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
          <div className="max-w-lg md:max-w-3xl lg:max-w-7xl mx-auto px-4 pt-12 pb-8 lg:flex lg:gap-8 lg:items-start lg:text-left text-center">
            {selectionPanel}
            <div className="flex-1 min-w-0">
            {/* Mobile: IWM-style 'Sell Your X' card (device thumb + editable
                rows + 'Your device is valued at $X' price band) so the
                quote step matches the same selectionPanelMobile pattern
                used on every other funnel step. */}
            {selectionPanelMobile}
            <div className="hidden lg:block mb-2">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#00c853] mb-1">Your offer</p>
              {isPendingQuote ? (
                <>
                  <p className="text-3xl lg:text-4xl font-extrabold text-white mt-1 leading-tight">Quoted via email or text</p>
                  <p className="text-[#c8c8c8] text-sm mt-2 leading-snug max-w-md">This device isn&apos;t on our standard price list. Add it to your box and we&apos;ll email or text you a quote within the hour — no need to wait until pickup.</p>
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
            {quantity > 1 && <p className="text-[#e6e6e6] text-sm mb-2">${quote} each × {quantity}</p>}
            {quantity === 1 && <div className="mb-3" />}

            {/* Accessory bonus — Brand New / Flawless only */}
            {isNewTier && (
              <div className="max-w-md mx-auto mb-4">
                <button
                  type="button"
                  onClick={() => setAccessoriesIncluded((v) => !v)}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl border transition cursor-pointer text-left ${accessoriesIncluded ? "bg-[#00c853]/10 border-[#00c853]/40" : "bg-white/5 border-white/10 hover:bg-white/10"}`}
                >
                  <span className={`w-5 h-5 rounded border-2 flex items-center justify-center text-xs font-bold transition ${accessoriesIncluded ? "bg-[#00c853] border-[#00c853] text-[#0a0a0a]" : "border-white/30 text-transparent"}`}>✓</span>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-white">All original accessories included</p>
                    <p className="text-[11px] text-[#e6e6e6]">Charger, cable, original box{condition?.id === "brandnew" ? ", manuals" : ""}</p>
                  </div>
                  <span className="text-[#00c853] font-bold text-sm whitespace-nowrap">+$15</span>
                </button>
              </div>
            )}

            <div className="bg-[rgba(15,15,15,0.5)] backdrop-blur-[12px] border border-white/12 rounded-2xl p-5 mb-6 text-left shadow-[inset_1px_1px_0_rgba(255,255,255,0.06),0_10px_30px_rgba(0,0,0,0.5)]">
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
            </div>

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

            <div className="mt-6 space-y-3 text-left">
              <div className="flex items-center gap-3"><span className="text-lg">💰</span><span className="text-sm text-[#e5e5e5]">No selling fees</span></div>
              <div className="flex items-center gap-3"><span className="text-lg">🛡️</span><span className="text-sm text-[#e5e5e5]">Zero fraud risk</span></div>
              <div className="flex items-center gap-3"><span className="text-lg">📦</span><span className="text-sm text-[#e5e5e5]">Free shipping via FedEx or UPS</span></div>
              <div className="flex items-center gap-3"><span className="text-lg">⚡</span><span className="text-sm text-[#e5e5e5]">Same-day pickup &amp; 24-hour processing</span></div>
              <div className="flex items-start gap-3">
                <span className="text-lg leading-none">💳</span>
                <div className="flex-1">
                  <p className="text-sm text-[#e5e5e5] mb-2">Get paid your way</p>
                  <div className="flex flex-wrap gap-1.5">
                    <span className="inline-flex items-center px-2 py-1 rounded-md bg-white/10 text-white text-[10px] font-bold">💵 Cash</span>
                    <span className="inline-flex items-center px-2 py-1 rounded-md bg-[#00d54b] text-white text-[10px] font-bold">Cash App</span>
                    <span className="inline-flex items-center px-2 py-1 rounded-md bg-[#6D1ED4] text-white text-[10px] font-bold">Zelle</span>
                    <span className="inline-flex items-center px-2 py-1 rounded-md bg-[#f7931a] text-white text-[10px] font-bold">₿ BTC</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 bg-white/5 border border-white/10 rounded-2xl p-5 text-left">
              <h3 className="text-base font-bold text-white mb-1">The Top Cash Guarantee</h3>
              <p className="text-[#e6e6e6] text-xs mb-4">Your device, your terms. Here&apos;s what we stand behind.</p>
              <div className="space-y-4">
                <div>
                  <p className="text-sm font-semibold text-[#e5e5e5]">🎯 Transparent Pricing</p>
                  <p className="text-xs text-[#e6e6e6] mt-1">What you see is what you get. No surprise deductions, no bait-and-switch. Your quote is based on the condition you select.</p>
                </div>
                <div>
                  <p className="text-sm font-semibold text-[#e5e5e5]">🤝 Honest Inspections</p>
                  <p className="text-xs text-[#e6e6e6] mt-1">If anything differs from your description, we&apos;ll walk you through our findings before adjusting — no silent changes.</p>
                </div>
                <div>
                  <p className="text-sm font-semibold text-[#e5e5e5]">🔄 No Pressure, No Strings</p>
                  <p className="text-xs text-[#e6e6e6] mt-1">Changed your mind? Not happy with the final offer? We&apos;ll return your device — no questions asked.</p>
                </div>
                <div>
                  <p className="text-sm font-semibold text-[#e5e5e5]">⚡ Same-Day Payout</p>
                  <p className="text-xs text-[#e6e6e6] mt-1">Austin local? Get paid on the spot. Cash, Cash App, Zelle, or BTC — your call.</p>
                </div>
              </div>
            </div>

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
      {step === "checkout" && page === "home" && model && condition && (
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
                fetch("/api/lead", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "Guest", phone: "", email, device: deviceType, model: model?.label, storage: storage?.label, condition: condition?.label, carrier: carrier?.label, quote: quote * quantity, payout: "TBD", quantity }) }).catch(() => {});
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
                  await fetch("/api/lead", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: d.name || "Returning Customer", phone: "", email, device: deviceType, model: model?.label, storage: storage?.label, condition: condition?.label, carrier: carrier?.label, quote: quote * quantity, payout: "TBD", quantity }) }).catch(() => {});
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

              {/* Continue with Google */}
              <button
                onClick={() => {
                  if (!email) return;
                  fetch("/api/lead", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "Google User", phone: "", email, device: deviceType, model: model?.label, storage: storage?.label, condition: condition?.label, carrier: carrier?.label, quote: quote * quantity, payout: "TBD", quantity }) }).catch(() => {});
                  setStep("payout"); pushHistory("payout");
                }}
                className="w-full flex items-center justify-center gap-3 bg-white/5 border border-white/10 text-white py-4 rounded-2xl text-base font-semibold cursor-pointer hover:bg-white/10 transition tap-press"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
                Continue With Google
              </button>
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
            {selectionPanel}
            <div className="flex-1 min-w-0">
            <button onClick={handleBack} aria-label="Go back" className="inline-flex items-center gap-2 text-[#00c853] text-sm font-semibold mb-4 px-4 py-2 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 cursor-pointer transition tap-press">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
              Back
            </button>
            {selectionPanelMobile}
            <h2 className="text-2xl font-bold mb-1">How would you like to get paid?</h2>
            <p className="text-[#e6e6e6] text-sm mb-6">Select your preferred payout method</p>
            <div className="grid grid-cols-2 gap-3">
              {PAYOUTS.map((p) => (
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
      {step === "contact" && page === "home" && model && condition && payout && (
        <section className="animate-[fadeIn_0.3s_ease-out]">
          <div className="max-w-lg md:max-w-3xl lg:max-w-7xl mx-auto px-4 pt-6 pb-8 lg:flex lg:gap-8 lg:items-start">
            {selectionPanel}
            <div className="flex-1 min-w-0">
            <button onClick={handleBack} aria-label="Go back" className="inline-flex items-center gap-2 text-[#00c853] text-sm font-semibold mb-4 px-4 py-2 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 cursor-pointer transition tap-press">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
              Back
            </button>
            {selectionPanelMobile}

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
                const handoffPayload = handoffMethod === "ship"
                  ? { method: "ship", address: { street: shipStreet, unit: shipUnit, city: shipCity, state: shipState, zip: shipZip } }
                  : { method: "local" };
                const res = await fetch("/api/lead", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ name, phone, email, device: deviceType, model: model?.label, storage: storage?.label, condition: condition?.label, carrier: carrier?.label, quote: quote * quantity, payout: payout?.label, quantity, photos: photoUrls, imei: imeiInput.replace(/\D/g, "") || undefined, imeiWarnings: imeiState === "warn" ? imeiResult?.warnings : undefined, handoff: handoffPayload }),
                });
                if (!res.ok) throw new Error('Failed');
                if (email || phone) {
                  fetch("/api/confirm", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ name, phone, email, model: model?.label, storage: storage?.label, condition: condition?.label, carrier: carrier?.label, quote: quote * quantity, payout: payout?.label, quantity }),
                  }).catch(() => {});
                }
                localStorage.removeItem("tcc-session"); setStep("done"); pushHistory("done");
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
                    <input required value={shipStreet} onChange={e => setShipStreet(e.target.value)} placeholder="Street address" autoComplete="address-line1" className="w-full px-4 py-3 tcc-input" />
                    <input value={shipUnit} onChange={e => setShipUnit(e.target.value)} placeholder="Apt / Suite (optional)" autoComplete="address-line2" className="w-full px-4 py-3 tcc-input" />
                    <div className="grid grid-cols-3 gap-2">
                      <input required value={shipCity} onChange={e => setShipCity(e.target.value)} placeholder="City" autoComplete="address-level2" className="col-span-2 w-full px-4 py-3 tcc-input" />
                      <input required maxLength={2} value={shipState} onChange={e => setShipState(e.target.value.toUpperCase().slice(0,2))} placeholder="State" autoComplete="address-level1" className="w-full px-4 py-3 tcc-input uppercase" />
                    </div>
                    <input required inputMode="numeric" pattern="\d{5}" maxLength={5} value={shipZip} onChange={e => setShipZip(e.target.value.replace(/\D/g, "").slice(0,5))} placeholder="ZIP" autoComplete="postal-code" className="w-full px-4 py-3 tcc-input" />
                    <p className="text-[#888] text-[11px] leading-relaxed">USPS prepaid label hits {email || "your email"} within the hour. Drop the box at any USPS — we cover return shipping.</p>
                  </div>
                )}

                {handoffMethod === "local" && (
                  <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-[#00c853]/5 border border-[#00c853]/20">
                    <svg className="w-5 h-5 text-[#00c853] shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M3 11l9-8 9 8M5 10v10h14V10"/></svg>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <p className="text-white text-sm font-bold leading-tight">Local meetup</p>
                        <button type="button" onClick={() => setHandoffMethod("ship")} className="text-[11px] text-[#888] hover:text-[#00c853] underline cursor-pointer">Switch to shipping</button>
                      </div>
                      <p className="text-[#bdbdbd] text-xs leading-snug">We&apos;ll text or email you within the hour to coordinate a time and a public spot in Austin you&apos;re comfortable with.</p>
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-[#e6e6e6] mb-1.5 uppercase tracking-wider">Name</label>
                <input type="text" value={name} onChange={(e) => setName(e.target.value)} required minLength={2} maxLength={50} placeholder="Your name" className="w-full px-4 py-3.5 tcc-input text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#e6e6e6] mb-1.5 uppercase tracking-wider">Phone</label>
                <input type="tel" value={phone} onChange={(e) => {
                  const digits = e.target.value.replace(/\D/g, "").slice(0, 10);
                  if (digits.length >= 6) setPhone(`(${digits.slice(0,3)}) ${digits.slice(3,6)}-${digits.slice(6)}`);
                  else if (digits.length >= 3) setPhone(`(${digits.slice(0,3)}) ${digits.slice(3)}`);
                  else setPhone(digits);
                }} required pattern="\(\d{3}\) \d{3}-\d{4}" placeholder="(512) 555-0000" className="w-full px-4 py-3.5 tcc-input text-sm" />
                <p className="text-[#e6e6e6] text-[11px] leading-relaxed mt-1.5">By submitting, you agree to receive SMS updates about your trade-in from Top Cash Cellular. Msg &amp; data rates may apply. Reply STOP to opt out, HELP for help.</p>
              </div>
              {email && <p className="text-[#e6e6e6] text-xs">Email: {email}</p>}
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

              <div>
                <label className="block text-xs font-medium text-[#e6e6e6] mb-1.5 uppercase tracking-wider">
                  Device Photos <span className="normal-case text-[12px]">(optional — up to 3, speeds up payout)</span>
                </label>
                {photoUrls.length < 3 && (
                  <label className={`flex flex-col items-center justify-center w-full h-28 bg-white/5 border-2 border-dashed border-white/15 rounded-xl cursor-pointer hover:bg-white/10 hover:border-[#00c853]/30 transition ${uploading ? "opacity-50 pointer-events-none" : ""}`}>
                    <svg className="w-8 h-8 text-[#d4d4d4] mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                    <span className="text-[#d4d4d4] text-xs">
                      {uploading ? "Uploading…" : photoUrls.length === 0 ? "Tap to add front, back & screen-on photos" : `Add another (${photoUrls.length}/3)`}
                    </span>
                    <input type="file" accept="image/*" capture="environment" multiple className="hidden" onChange={async (e) => {
                      const files = e.target.files;
                      if (!files?.length) return;
                      setUploading(true);
                      const urls: string[] = [...photoUrls];
                      for (const file of Array.from(files)) {
                        if (urls.length >= 3) break;
                        if (file.size > 10 * 1024 * 1024) { alert("Photo must be under 10MB"); continue; }
                        try {
                          const fd = new FormData();
                          fd.append("file", file);
                          const res = await fetch("/api/upload", { method: "POST", body: fd });
                          const data = await res.json();
                          if (data.url) urls.push(data.url);
                        } catch {}
                      }
                      setPhotoUrls(urls);
                      setUploading(false);
                      e.target.value = "";
                    }} />
                  </label>
                )}
                {photoUrls.length > 0 && (
                  <div className="flex gap-2 mt-2 flex-wrap">
                    {photoUrls.map((url, i) => (
                      <div key={i} className="relative">
                        <img src={url} alt={`Device photo ${i + 1}`} className="w-20 h-20 object-cover rounded-lg border border-white/10" />
                        <button type="button" onClick={() => setPhotoUrls(photoUrls.filter((_, j) => j !== i))} aria-label="Remove photo" className="absolute -top-1.5 -right-1.5 w-6 h-6 bg-red-500 rounded-full text-white text-xs font-bold flex items-center justify-center cursor-pointer hover:bg-red-600">×</button>
                      </div>
                    ))}
                  </div>
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
      {step === "done" && page === "home" && model && condition && payout && (
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

            {/* Receipt card — glass + inset rim + green accent line */}
            <div className="tcc-card rounded-2xl p-4 lg:p-6 mb-4 lg:mb-5 text-left relative overflow-hidden">
              <span aria-hidden className="absolute left-0 top-0 bottom-0 w-1" style={{ background: "linear-gradient(180deg, #00e676 0%, #00a039 100%)" }} />
              <div className="flex items-start justify-between gap-3 lg:gap-4 mb-4">
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] uppercase tracking-[0.18em] text-[#00c853] font-bold mb-1">Quoted</p>
                  <p className="font-extrabold text-[16px] lg:text-[18px] text-white leading-tight break-words">{model.label}</p>
                  <p className="text-[#d4d4d4] text-[11px] lg:text-xs mt-1 break-words">{storage?.label} · {getConditionLabel(condition, deviceType).label} · {payout.label}{quantity > 1 ? ` · ×${quantity}` : ''}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-[10px] uppercase tracking-[0.18em] text-[#888] font-bold mb-1">Payout</p>
                  <p className="text-[#00c853] font-extrabold text-2xl lg:text-3xl leading-none" style={{ textShadow: "0 0 18px rgba(0,200,83,0.4)" }}>${quote * quantity}</p>
                </div>
              </div>
              <div className="border-t border-white/10 pt-3 lg:pt-4 flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-[#00c853] text-xs font-bold shrink-0">
                  {name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0 text-sm">
                  <p className="text-white font-semibold truncate">{name}</p>
                  <p className="text-[#a8a8a8] text-xs truncate">{phone}{email ? ` · ${email}` : ''}</p>
                </div>
              </div>
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
                <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-5 reveal" data-stagger="2">
                  <p className="text-xs font-bold uppercase tracking-wider text-[#bdbdbd] mb-1">Apple Trade-In</p>
                  <p className="text-white text-2xl font-bold mb-2">Lowball</p>
                  <ul className="text-[#e6e6e6] text-sm space-y-1 list-disc list-inside">
                    <li>Bottom-of-market quotes</li>
                    <li>Store credit only</li>
                    <li>No cash option</li>
                  </ul>
                </div>
                <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-5 reveal" data-stagger="3">
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
              <div className="grid grid-cols-3 gap-3">
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
                  <div className="bg-[#00c853]/10 border border-[#00c853]/20 rounded-xl p-4">
                    <p className="text-[#00c853] font-semibold text-sm">You&apos;re in! We&apos;ll keep you posted.</p>
                  </div>
                ) : (
                  <form onSubmit={async (e) => {
                    e.preventDefault();
                    if (!newsletterEmail.trim()) return;
                    try {
                      await fetch("/api/lead", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "Newsletter Signup", email: newsletterEmail, phone: "", device: "Newsletter", notes: "Homepage newsletter signup" }) });
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
      {(page === "about" || page === "privacy" || page === "terms" || page === "grading" || page === "shipping") && (
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
                  { num: "3", title: "Get paid instantly", desc: "We verify your device and pay you on the spot. Cash, Cash App, Zelle, or BTC." },
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
                    { tier: "Brand New", icon: "✨", color: "#00c853", desc: "Sealed in the box, never activated. Receipt strongly preferred. We verify the seal and confirm the IMEI is clean. Brand New only applies to computers/laptops/desktops, not phones." },
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
                    { step: "1", title: "Get your quote", body: "Accept the price on our site. We email you a confirmation with a prepaid FedEx or UPS shipping label, insured up to the full quoted value." },
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
          </div>
        </section>
      )}

      {/* FOOTER */}
      <footer className="mt-auto bg-gradient-to-b from-[#0d1f15] via-[#0a1812] to-[#070d0a] text-[#cfcfcf] py-10 relative">
        {/* Green accent stripe at top — signals end-of-page + brand color */}
        <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-transparent via-[#00c853]/60 to-transparent" />
        <div className="max-w-lg md:max-w-3xl lg:max-w-7xl mx-auto px-4">
          <div className="grid grid-cols-2 gap-6 mb-6">
            <div>
              <p className="text-white font-semibold text-xs uppercase tracking-wider mb-3">Company</p>
              <div className="space-y-2">
                <button onClick={() => { setPage("about"); window.scrollTo({ top: 0 }); }} className="block text-xs hover:text-[#00c853] transition cursor-pointer">About Us</button>
                <a href="/reviews" className="block text-xs hover:text-[#00c853] transition">Reviews</a>
                <a href={EMAIL_HREF} className="block text-xs hover:text-[#00c853] transition">Contact</a>
                <a href="/privacy" className="block text-xs hover:text-[#00c853] transition">Privacy Policy</a>
                <button onClick={() => { setPage("terms"); window.scrollTo({ top: 0 }); }} className="block text-xs hover:text-[#00c853] transition cursor-pointer">Terms of Service</button>
              </div>
            </div>
            <div>
              <p className="text-white font-semibold text-xs uppercase tracking-wider mb-3">Process</p>
              <div className="space-y-2">
                <a href="/how-it-works" className="block text-xs hover:text-[#00c853] transition">How It Works</a>
                <button onClick={() => { setPage("grading"); window.scrollTo({ top: 0 }); }} className="block text-xs hover:text-[#00c853] transition cursor-pointer text-left">Grading Guide</button>
                <button onClick={() => { setPage("shipping"); window.scrollTo({ top: 0 }); }} className="block text-xs hover:text-[#00c853] transition cursor-pointer text-left">Shipping &amp; Returns</button>
                <a href="/faq" className="block text-xs hover:text-[#00c853] transition">FAQ</a>
                <p className="text-xs text-[#9a9a9a] pt-2">Austin, TX · Mon–Sat 8 AM–8 PM</p>
              </div>
            </div>
          </div>
          <div className="border-t border-[#00c853]/15 pt-6 text-center">
            <p className="text-[11px] text-[#cfcfcf]/70 mb-3">© 2026 {BRAND}</p>
            <div className="flex items-center justify-center gap-4">
              <a href="/privacy" className="text-[11px] text-[#cfcfcf] hover:text-[#00c853] transition">Privacy Policy</a>
              <span className="text-[11px] text-[#00c853]/40">·</span>
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
                    onClick={() => { setCartOpen(false); setStep("checkout"); pushHistory("checkout"); }}
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

      {/* PROGRESS BAR — shows during flow */}
      {step !== "device" && step !== "done" && page === "home" && (
        <div className="fixed top-[52px] left-0 right-0 z-30 h-1 bg-white/10">
          <div className="h-full bg-[#00c853] transition-all duration-500" style={{ width: `${({category: 8, brand: 15, model: 22, storage: 32, condition: 42, carrier: 52, quote: 62, checkout: 72, payout: 82, contact: 92} as Record<string,number>)[step] ?? 0}%` }} />
        </div>
      )}

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
