// /go board data — server-only.
//
// The "up to $X" ceilings are computed from the LIVE engine (quoteDevice at
// sealed / best storage / best secondary option), NOT from
// CATALOG_PRICE_BY_MODEL_ID. Deliberate: the catalog headlines bake in
// funnel bonuses the bot-path quote doesn't grant, so for gs25u/gs24u the
// catalog number sits ABOVE anything the chip flow can return (466 vs 391,
// 355 vs 280 — verified 2026-08-19). A seller who tapped the board and
// answered best-everything would watch the number DROP with no cause —
// the exact "it went down when i engaged" failure /go exists to avoid.
// Engine-derived ceilings are reachable by construction: answer
// sealed + top storage + unlocked (or cellular, or disc) and you land
// exactly on the headline.
//
// 2026-09-11: iPads and consoles joined the deterministic flow. Both were
// already price-table devices (quoteDevice prices them today) — they just
// had no chip flow on /go and dropped into a chat that asked for a phone
// number before showing any number (zero contacts from those tiles in the
// first campaign). Each model declares its own chip STEPS so the client
// walks any category generically; app/go/spec.ts turns the answers into
// the engine call for both /api/go/quote and /api/go/lock.
import { quoteDevice } from "../lib/quote";
import { cachedOverrides } from "../lib/overrides-cache";
import { PRICE_TABLE } from "../data/prices";
import { macCeiling, macOptions } from "../lib/macbook-quote";

export type GoCat = "phone" | "ipad" | "console" | "macbook";
// Chip questions after the model pick, in order.
export type GoStep = "storage" | "condition" | "carrier" | "connectivity" | "disc" | "processor" | "memory" | "extras";
export type GoOpt = { key: string; label: string };

export type BoardModel = {
  id: string;
  label: string;
  img: string;
  cat: GoCat;
  // Picker group: "iPhone 14", "Galaxy S24", "iPad Pro", "PlayStation".
  line: string;
  steps: GoStep[];
  // Console rows are keyed by EDITION, not gigabytes ("base", "carbonblack",
  // "1tb"…) — these are the chip labels for those keys.
  storageLabels?: Record<string, string>;
  // Consoles use the homepage's 4-tier ladder (no "like new" chip); phones
  // and iPads use all 5.
  conditions?: 4 | 5;
  // MacBooks: per-model chip / memory / storage option lists (from
  // MACBOOK_SPECS), filled in by computeBoard.
  options?: { processor: GoOpt[]; memory: GoOpt[]; storage: GoOpt[] };
};

const PHONE_STEPS: GoStep[] = ["storage", "condition", "carrier"];
const IPAD_STEPS: GoStep[] = ["storage", "condition", "connectivity"];
// chip → memory → storage → condition → "anything off?" (battery/charger).
// Nano-texture glass isn't asked (standard assumed, +$50 on the homepage).
const MAC_STEPS: GoStep[] = ["processor", "memory", "storage", "condition", "extras"];
function mac(id: string, label: string, img: string, line: "MacBook Pro" | "MacBook Air"): BoardModel {
  return { id, label, img, cat: "macbook", line, steps: MAC_STEPS };
}

function phone(id: string, label: string, img: string): BoardModel {
  const m = label.match(/^(iPhone|Galaxy)\s+(S?\d+)/);
  return { id, label, img, cat: "phone", line: m ? `${m[1]} ${m[2]}` : label, steps: PHONE_STEPS };
}
function ipad(id: string, label: string, img: string, line: string): BoardModel {
  return { id, label, img, cat: "ipad", line, steps: IPAD_STEPS };
}
function console_(id: string, label: string, img: string, line: string, steps: GoStep[], storageLabels?: Record<string, string>): BoardModel {
  return { id, label, img, cat: "console", line, steps, conditions: 4, ...(storageLabels ? { storageLabels } : {}) };
}

// Every device the guided funnel can quote — newest line first, and within
// a line Pro Max → Pro → Plus/Air → base → e/FE, the order sellers scan.
// Prices are computed, never hardcoded; models the engine can't price
// render nothing (upTo=0 rows are dropped below). Sellers with anything
// not listed (SE, mini flips/folds, Pixels…) hit the "don't see yours?"
// tail card in the picker and type it — the AI intake prices by hand.
export const BOARD_MODELS: BoardModel[] = [
  // iPhone — 17 line
  phone("ip17pm", "iPhone 17 Pro Max", "/devices/iphone-17-pro-max.webp"),
  phone("ip17p", "iPhone 17 Pro", "/devices/iphone-17-pro.webp"),
  phone("ip17air", "iPhone 17 Air", "/devices/iphone-17-air.webp"),
  phone("ip17", "iPhone 17", "/devices/iphone-17.webp"),
  // 16 line
  phone("ip16pm", "iPhone 16 Pro Max", "/devices/iphone-16-pro-max.webp"),
  phone("ip16p", "iPhone 16 Pro", "/devices/iphone-16-pro.webp"),
  phone("ip16plus", "iPhone 16 Plus", "/devices/iphone-16-plus.webp"),
  phone("ip16", "iPhone 16", "/devices/iphone-16.webp"),
  phone("ip16e", "iPhone 16e", "/devices/iphone-16e.webp"),
  // 15 line
  phone("ip15pm", "iPhone 15 Pro Max", "/devices/iphone-15-pro-max.webp"),
  phone("ip15p", "iPhone 15 Pro", "/devices/iphone-15-pro.webp"),
  phone("ip15plus", "iPhone 15 Plus", "/devices/iphone-15-plus.webp"),
  phone("ip15", "iPhone 15", "/devices/iphone-15.webp"),
  // 14 line
  phone("ip14pm", "iPhone 14 Pro Max", "/devices/iphone-14-pro-max.webp"),
  phone("ip14p", "iPhone 14 Pro", "/devices/iphone-14-pro.webp"),
  phone("ip14plus", "iPhone 14 Plus", "/devices/iphone-14-plus.webp"),
  phone("ip14", "iPhone 14", "/devices/iphone-14.webp"),
  // 13 line
  phone("ip13pm", "iPhone 13 Pro Max", "/devices/iphone-13-pro-max.webp"),
  phone("ip13p", "iPhone 13 Pro", "/devices/iphone-13-pro.webp"),
  phone("ip13", "iPhone 13", "/devices/iphone-13.webp"),
  phone("ip13mini", "iPhone 13 mini", "/devices/iphone-13-mini.webp"),
  // 12 line
  phone("ip12pm", "iPhone 12 Pro Max", "/devices/swappa-apple-iphone-12-pro-max.png"),
  phone("ip12p", "iPhone 12 Pro", "/devices/swappa-apple-iphone-12-pro.png"),
  phone("ip12", "iPhone 12", "/devices/swappa-apple-iphone-12.png"),
  phone("ip12mini", "iPhone 12 mini", "/devices/swappa-apple-iphone-12-mini.png"),
  // 11 line
  phone("ip11pm", "iPhone 11 Pro Max", "/devices/swappa-apple-iphone-11-pro-max.png"),
  phone("ip11p", "iPhone 11 Pro", "/devices/swappa-apple-iphone-11-pro.png"),
  phone("ip11", "iPhone 11", "/devices/swappa-apple-iphone-11.png"),
  // Galaxy S — 26 line
  phone("gs26u", "Galaxy S26 Ultra", "/devices/gs26u.webp"),
  phone("gs26p", "Galaxy S26+", "/devices/gs26p.webp"),
  phone("gs26", "Galaxy S26", "/devices/gs26.webp"),
  // 25 line
  phone("gs25u", "Galaxy S25 Ultra", "/devices/gs25u.webp"),
  phone("gs25p", "Galaxy S25+", "/devices/gs25p.webp"),
  phone("gs25edge", "Galaxy S25 Edge", "/devices/gs25edge.webp"),
  phone("gs25", "Galaxy S25", "/devices/gs25.webp"),
  phone("gs25fe", "Galaxy S25 FE", "/devices/gs25fe.webp"),
  // 24 line
  phone("gs24u", "Galaxy S24 Ultra", "/devices/gs24u.webp"),
  phone("gs24p", "Galaxy S24+", "/devices/gs24p.webp"),
  phone("gs24", "Galaxy S24", "/devices/gs24.webp"),
  phone("gs24fe", "Galaxy S24 FE", "/devices/gs24fe.webp"),
  // 23 line
  phone("gs23u", "Galaxy S23 Ultra", "/devices/gs23u.webp"),
  phone("gs23p", "Galaxy S23+", "/devices/gs23p.webp"),
  phone("gs23", "Galaxy S23", "/devices/gs23.webp"),
  phone("gs23fe", "Galaxy S23 FE", "/devices/gs23fe.webp"),
  // 22 line
  phone("gs22u", "Galaxy S22 Ultra", "/devices/gs22u.webp"),
  phone("gs22p", "Galaxy S22+", "/devices/gs22p.webp"),
  phone("gs22", "Galaxy S22", "/devices/gs22.webp"),
  // 21 line
  phone("gs21u", "Galaxy S21 Ultra", "/devices/gs21u.webp"),
  phone("gs21p", "Galaxy S21+", "/devices/gs21p.webp"),
  phone("gs21", "Galaxy S21", "/devices/gs21.webp"),
  phone("gs21fe", "Galaxy S21 FE", "/devices/gs21fe.webp"),
  // 20 line
  phone("gs20u", "Galaxy S20 Ultra", "/devices/gs20u.webp"),
  phone("gs20p", "Galaxy S20+", "/devices/gs20p.webp"),
  phone("gs20", "Galaxy S20", "/devices/gs20.webp"),
  phone("gs20fe", "Galaxy S20 FE", "/devices/gs20fe.webp"),

  // iPad — same ids, labels and art as the homepage funnel (IPAD_SERIES).
  ipad("ipadpro13m5", "iPad Pro 13\" M5", "/devices/ipad-pro-13-m5.webp", "iPad Pro"),
  ipad("ipadpro11m5", "iPad Pro 11\" M5", "/devices/ipad-pro-11-m5.webp", "iPad Pro"),
  ipad("ipadpro13m4", "iPad Pro 13\" M4", "/devices/ipad-pro-13-m4.webp", "iPad Pro"),
  ipad("ipadpro11m4", "iPad Pro 11\" M4", "/devices/ipad-pro-11-m4.webp", "iPad Pro"),
  ipad("ipadpro129g6", "iPad Pro 12.9\" 6th Gen", "/devices/ipad-pro-12-9.webp", "iPad Pro"),
  ipad("ipadpro11g4", "iPad Pro 11\" 4th Gen", "/devices/ipad-pro-11-4g.webp", "iPad Pro"),
  ipad("ipadair13m4", "iPad Air 13\" M4", "/devices/ipad-air-13-m4.webp", "iPad Air"),
  ipad("ipadair11m4", "iPad Air 11\" M4", "/devices/ipad-air-11-m4.webp", "iPad Air"),
  ipad("ipadair13m3", "iPad Air 13\" M3", "/devices/ipad-air-13-m3.webp", "iPad Air"),
  ipad("ipadair11m3", "iPad Air 11\" M3", "/devices/ipad-air-11-m3.webp", "iPad Air"),
  ipad("ipadair13m2", "iPad Air 13\" M2", "/devices/ipad-air-13-m2.webp", "iPad Air"),
  ipad("ipadair11m2", "iPad Air 11\" M2", "/devices/ipad-air-11-m2.webp", "iPad Air"),
  ipad("ipadmini7", "iPad Mini 7th Gen", "/devices/ipad-mini-7.webp", "iPad Mini"),
  ipad("ipadmini6", "iPad Mini 6th Gen", "/devices/ipad-mini-6.webp", "iPad Mini"),
  ipad("ipad11", "iPad 11th Gen", "/devices/ipad-11.webp", "iPad"),
  ipad("ipad10", "iPad 10th Gen", "/devices/ipad-10.webp", "iPad"),
  ipad("ipad9", "iPad 9th Gen", "/devices/ipad-9.webp", "iPad"),

  // Consoles — PRICE_TABLE rows are keyed by edition. Storage is implicit
  // by variant (Skywalker 2026-05-12); only the Xbox Series rows carry real
  // edition keys. The PS5 disc-vs-digital question is the homepage's extras
  // multiplier (digital ×0.92), asked as a chip here. ps4slim has no table
  // row and stays out; nswoled duplicates `switch`.
  console_("ps5pro", "PlayStation 5 Pro", "/devices/ps5pro.webp", "PlayStation", ["condition"]),
  console_("ps5slim", "PlayStation 5 Slim", "/devices/ps5-slim-disc.webp", "PlayStation", ["disc", "condition"]),
  console_("ps5", "PlayStation 5", "/devices/ps5.webp", "PlayStation", ["disc", "condition"]),
  console_("ps4pro", "PlayStation 4 Pro", "/devices/ps4-pro.webp", "PlayStation", ["condition"]),
  console_("ps4", "PlayStation 4", "/devices/ps4.webp", "PlayStation", ["condition"]),
  console_("xsx", "Xbox Series X", "/devices/xbox-series-x.webp", "Xbox", ["storage", "condition"], { "1tb": "1 TB", "2tb": "2 TB" }),
  console_("xss", "Xbox Series S", "/devices/xbox-series-s.webp", "Xbox", ["storage", "condition"], { base: "512 GB (white)", carbonblack: "1 TB carbon black" }),
  console_("xone", "Xbox One", "/devices/xbox-one.webp", "Xbox", ["condition"]),
  console_("nsw2", "Nintendo Switch 2", "/devices/nintendo-switch.webp", "Nintendo", ["condition"]),
  console_("switch", "Nintendo Switch OLED", "/devices/switch-oled.webp", "Nintendo", ["condition"]),
  console_("switchv2", "Nintendo Switch V2", "/devices/nintendo-switch.webp", "Nintendo", ["condition"]),
  console_("switchlite", "Nintendo Switch Lite", "/devices/switch-lite.webp", "Nintendo", ["condition"]),

  // MacBooks — the 16 M-series models whose IWM chip adjustments exist
  // (app/lib/macbook-quote.ts prices them exactly like the homepage's
  // additive path). Intel/legacy models are inquiry-only on the homepage
  // too and stay in the chat path. Labels + art mirror MACBOOK_PRO_MODELS /
  // MACBOOK_AIR_MODELS in app/page.tsx.
  mac("mbp16_m5pmax_2026", "MacBook Pro 16\" M5 (2026)", "/devices/macbook-pro-m4.webp", "MacBook Pro"),
  mac("mbp14_m5pmax_2026", "MacBook Pro 14\" M5 (2026)", "/devices/macbook-pro-m4.webp", "MacBook Pro"),
  mac("mbp14_m5_2025", "MacBook Pro 14\" M5 (2025)", "/devices/macbook-pro-m4.webp", "MacBook Pro"),
  mac("mbp16m4", "MacBook Pro 16\" M4 (2024)", "/devices/macbook-pro-m4.webp", "MacBook Pro"),
  mac("mbp14m4", "MacBook Pro 14\" M4 (2024)", "/devices/macbook-pro-m4.webp", "MacBook Pro"),
  mac("mbp16m3", "MacBook Pro 16\" M3 (2023)", "/devices/macbook-pro-m3.webp", "MacBook Pro"),
  mac("mbp14m3", "MacBook Pro 14\" M3 (2023)", "/devices/macbook-pro-m3.webp", "MacBook Pro"),
  mac("mbp16m2", "MacBook Pro 16\" M2 (2023)", "/devices/macbook-pro-m2.webp", "MacBook Pro"),
  mac("mbp14m2", "MacBook Pro 14\" M2 (2023)", "/devices/macbook-pro-m2.webp", "MacBook Pro"),
  mac("mba_m5_2026", "MacBook Air M5 (13\" & 15\", 2026)", "/devices/macbook-air-m3.webp", "MacBook Air"),
  mac("mba_m4_2025", "MacBook Air M4 (13\" & 15\", 2025)", "/devices/macbook-air-m3.webp", "MacBook Air"),
  mac("mba15m3", "MacBook Air 15\" M3 (2024)", "/devices/macbook-air-m3.webp", "MacBook Air"),
  mac("mba13m3", "MacBook Air 13\" M3 (2024)", "/devices/macbook-air-m3.webp", "MacBook Air"),
  mac("mba15m2", "MacBook Air 15\" M2 (2023)", "/devices/macbook-air-m2.webp", "MacBook Air"),
  mac("mba13m2", "MacBook Air 13\" M2 (2022)", "/devices/macbook-air-m2.webp", "MacBook Air"),
  mac("mba13m1", "MacBook Air 13\" M1 (2020)", "/devices/macbook-air-m1.webp", "MacBook Air"),
];

export const BOARD_IDS = new Set(BOARD_MODELS.map((m) => m.id));
export const BOARD_BY_ID = new Map(BOARD_MODELS.map((m) => [m.id, m]));

export type BoardRow = BoardModel & {
  upTo: number;
  // PRICE_TABLE keys for this model, in display order.
  storages: string[];
  // The storage the ceiling was computed at.
  bestStorage: string;
};

// Homepage-only multipliers the engine doesn't apply (app/page.tsx
// connectivityMultiplier / sony discdrive extras). Mirrored here so a /go
// number matches the number the homepage would show for the same answers.
export const CELLULAR_MULT = 1.15;
export const DIGITAL_MULT = 0.92;
// The popular-device bonus the engine adds for phones (isPhone); the homepage
// gives it to cellular iPads too, AFTER the multiplier.
export const CELLULAR_BONUS = 25;

const STORAGE_ORDER = ["64", "128", "256", "512", "1tb", "2tb", "base", "carbonblack"];

export function storageKeysFor(id: string): string[] {
  return Object.keys(PRICE_TABLE[id] || {}).sort(
    (a, b) => STORAGE_ORDER.indexOf(a) - STORAGE_ORDER.indexOf(b),
  );
}

export async function computeBoard(): Promise<BoardRow[]> {
  // ONE overrides read for the whole board. quoteDevice without the second
  // arg does a Blob list + fetch PER CALL — the board prices ~100 cells per
  // request, which would be ~200 network round-trips of TTFB on every paid
  // click. Passing the snapshot keeps it to a single read.
  const overrides = await cachedOverrides();
  const rows: BoardRow[] = [];
  for (const m of BOARD_MODELS) {
    if (m.cat === "macbook") {
      // Pure arithmetic — no engine call, no table row.
      const o = macOptions(m.id);
      if (!o || !o.processor.length || !o.memory.length || !o.storage.length) continue;
      const upTo = macCeiling(m.id, overrides);
      if (upTo <= 0) continue;
      const opt = (l: { id: string; label: string; sub?: string }, withSub = false): GoOpt => ({ key: l.id, label: withSub && l.sub ? `${l.label} · ${l.sub}` : l.label });
      const topStorage = o.storage.reduce((a, b) => ((b.adj ?? 0) > (a.adj ?? 0) ? b : a), o.storage[0]);
      rows.push({
        ...m,
        upTo,
        storages: o.storage.map((x) => x.id),
        bestStorage: topStorage.id,
        options: {
          processor: o.processor.map((p) => opt(p, true)),
          memory: o.memory.map((x) => opt(x)),
          storage: o.storage.map((x) => opt(x)),
        },
      });
      continue;
    }
    const storages = storageKeysFor(m.id);
    let upTo = 0;
    let bestStorage = storages[storages.length - 1] || "";
    for (const s of storages) {
      const r = await quoteDevice({
        modelId: m.id,
        modelLabel: m.label,
        storage: s,
        condition: "sealed",
        carrier: m.cat === "phone" ? "unlocked" : undefined,
        isPhone: m.cat === "phone",
      }, overrides).catch(() => null);
      if (!r?.offer) continue;
      // The reachable ceiling: cellular for iPads, disc for consoles.
      const offer = m.cat === "ipad" ? Math.round(r.offer * CELLULAR_MULT) + CELLULAR_BONUS : r.offer;
      if (offer > upTo) {
        upTo = offer;
        bestStorage = s;
      }
    }
    // A model with no live engine price would render "up to $0" — a broken
    // promise on an ad landing page. Drop the row instead; the funnel link
    // still covers it.
    if (upTo > 0) rows.push({ ...m, upTo, storages, bestStorage });
  }
  return rows;
}
