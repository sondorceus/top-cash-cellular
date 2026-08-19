// /go board data — server-only.
//
// The board's "up to $X" ceilings are computed from the LIVE engine
// (quoteDevice at sealed / best storage / unlocked), NOT from
// CATALOG_PRICE_BY_MODEL_ID. Deliberate: the catalog headlines bake in
// funnel bonuses the bot-path quote doesn't grant, so for gs25u/gs24u the
// catalog number sits ABOVE anything the chip flow can return (466 vs 391,
// 355 vs 280 — verified 2026-08-19). A seller who tapped the board and
// answered best-everything would watch the number DROP with no cause —
// the exact "it went down when i engaged" failure /go exists to avoid.
// Engine-derived ceilings are reachable by construction: answer
// sealed + top storage + unlocked and you land exactly on the headline.
import { quoteDevice } from "../lib/quote";
import { cachedOverrides } from "../lib/overrides-cache";
import { PRICE_TABLE } from "../data/prices";

// Every phone the guided funnel can quote — newest line first, and within
// a line Pro Max → Pro → Plus/Air → base → e/FE, the order sellers scan.
// Prices are computed, never hardcoded; models the engine can't price
// render nothing (upTo=0 rows are dropped below). Sellers with anything
// not listed (SE, mini flips/folds, Pixels…) hit the "don't see yours?"
// tail card in the carousel and type it — the AI intake prices by hand.
export const BOARD_MODELS: { id: string; label: string; img: string }[] = [
  // iPhone — 17 line
  { id: "ip17pm", label: "iPhone 17 Pro Max", img: "/devices/iphone-17-pro-max.webp" },
  { id: "ip17p", label: "iPhone 17 Pro", img: "/devices/iphone-17-pro.webp" },
  { id: "ip17air", label: "iPhone 17 Air", img: "/devices/iphone-17-air.webp" },
  { id: "ip17", label: "iPhone 17", img: "/devices/iphone-17.webp" },
  // 16 line
  { id: "ip16pm", label: "iPhone 16 Pro Max", img: "/devices/iphone-16-pro-max.webp" },
  { id: "ip16p", label: "iPhone 16 Pro", img: "/devices/iphone-16-pro.webp" },
  { id: "ip16plus", label: "iPhone 16 Plus", img: "/devices/iphone-16-plus.webp" },
  { id: "ip16", label: "iPhone 16", img: "/devices/iphone-16.webp" },
  { id: "ip16e", label: "iPhone 16e", img: "/devices/iphone-16e.webp" },
  // 15 line
  { id: "ip15pm", label: "iPhone 15 Pro Max", img: "/devices/iphone-15-pro-max.webp" },
  { id: "ip15p", label: "iPhone 15 Pro", img: "/devices/iphone-15-pro.webp" },
  { id: "ip15plus", label: "iPhone 15 Plus", img: "/devices/iphone-15-plus.webp" },
  { id: "ip15", label: "iPhone 15", img: "/devices/iphone-15.webp" },
  // 14 line
  { id: "ip14pm", label: "iPhone 14 Pro Max", img: "/devices/iphone-14-pro-max.webp" },
  { id: "ip14p", label: "iPhone 14 Pro", img: "/devices/iphone-14-pro.webp" },
  { id: "ip14plus", label: "iPhone 14 Plus", img: "/devices/iphone-14-plus.webp" },
  { id: "ip14", label: "iPhone 14", img: "/devices/iphone-14.webp" },
  // 13 line
  { id: "ip13pm", label: "iPhone 13 Pro Max", img: "/devices/iphone-13-pro-max.webp" },
  { id: "ip13p", label: "iPhone 13 Pro", img: "/devices/iphone-13-pro.webp" },
  { id: "ip13", label: "iPhone 13", img: "/devices/iphone-13.webp" },
  { id: "ip13mini", label: "iPhone 13 mini", img: "/devices/iphone-13-mini.webp" },
  // 12 line
  { id: "ip12pm", label: "iPhone 12 Pro Max", img: "/devices/swappa-apple-iphone-12-pro-max.png" },
  { id: "ip12p", label: "iPhone 12 Pro", img: "/devices/swappa-apple-iphone-12-pro.png" },
  { id: "ip12", label: "iPhone 12", img: "/devices/swappa-apple-iphone-12.png" },
  { id: "ip12mini", label: "iPhone 12 mini", img: "/devices/swappa-apple-iphone-12-mini.png" },
  // 11 line
  { id: "ip11pm", label: "iPhone 11 Pro Max", img: "/devices/swappa-apple-iphone-11-pro-max.png" },
  { id: "ip11p", label: "iPhone 11 Pro", img: "/devices/swappa-apple-iphone-11-pro.png" },
  { id: "ip11", label: "iPhone 11", img: "/devices/swappa-apple-iphone-11.png" },
  // Galaxy S — 26 line
  { id: "gs26u", label: "Galaxy S26 Ultra", img: "/devices/gs26u.webp" },
  { id: "gs26p", label: "Galaxy S26+", img: "/devices/gs26p.webp" },
  { id: "gs26", label: "Galaxy S26", img: "/devices/gs26.webp" },
  // 25 line
  { id: "gs25u", label: "Galaxy S25 Ultra", img: "/devices/gs25u.webp" },
  { id: "gs25p", label: "Galaxy S25+", img: "/devices/gs25p.webp" },
  { id: "gs25edge", label: "Galaxy S25 Edge", img: "/devices/gs25edge.webp" },
  { id: "gs25", label: "Galaxy S25", img: "/devices/gs25.webp" },
  { id: "gs25fe", label: "Galaxy S25 FE", img: "/devices/gs25fe.webp" },
  // 24 line
  { id: "gs24u", label: "Galaxy S24 Ultra", img: "/devices/gs24u.webp" },
  { id: "gs24p", label: "Galaxy S24+", img: "/devices/gs24p.webp" },
  { id: "gs24", label: "Galaxy S24", img: "/devices/gs24.webp" },
  { id: "gs24fe", label: "Galaxy S24 FE", img: "/devices/gs24fe.webp" },
  // 23 line
  { id: "gs23u", label: "Galaxy S23 Ultra", img: "/devices/gs23u.webp" },
  { id: "gs23p", label: "Galaxy S23+", img: "/devices/gs23p.webp" },
  { id: "gs23", label: "Galaxy S23", img: "/devices/gs23.webp" },
  { id: "gs23fe", label: "Galaxy S23 FE", img: "/devices/gs23fe.webp" },
  // 22 line
  { id: "gs22u", label: "Galaxy S22 Ultra", img: "/devices/gs22u.webp" },
  { id: "gs22p", label: "Galaxy S22+", img: "/devices/gs22p.webp" },
  { id: "gs22", label: "Galaxy S22", img: "/devices/gs22.webp" },
  // 21 line
  { id: "gs21u", label: "Galaxy S21 Ultra", img: "/devices/gs21u.webp" },
  { id: "gs21p", label: "Galaxy S21+", img: "/devices/gs21p.webp" },
  { id: "gs21", label: "Galaxy S21", img: "/devices/gs21.webp" },
  { id: "gs21fe", label: "Galaxy S21 FE", img: "/devices/gs21fe.webp" },
  // 20 line
  { id: "gs20u", label: "Galaxy S20 Ultra", img: "/devices/gs20u.webp" },
  { id: "gs20p", label: "Galaxy S20+", img: "/devices/gs20p.webp" },
  { id: "gs20", label: "Galaxy S20", img: "/devices/gs20.webp" },
  { id: "gs20fe", label: "Galaxy S20 FE", img: "/devices/gs20fe.webp" },
];

export const BOARD_IDS = new Set(BOARD_MODELS.map((m) => m.id));

export type BoardRow = {
  id: string;
  label: string;
  img: string;
  upTo: number;
  // PRICE_TABLE storage keys for this model, ascending ("64" … "2tb").
  storages: string[];
  // The storage the ceiling was computed at — the HOLD's starting spec.
  bestStorage: string;
};

const STORAGE_ORDER = ["64", "128", "256", "512", "1tb", "2tb"];

export async function computeBoard(): Promise<BoardRow[]> {
  // ONE overrides read for the whole board. quoteDevice without the second
  // arg does a Blob list + fetch PER CALL — the board prices ~20 cells per
  // request, which would be ~40 network round-trips of TTFB on every paid
  // click. Passing the snapshot keeps it to a single read.
  const overrides = await cachedOverrides();
  const rows: BoardRow[] = [];
  for (const m of BOARD_MODELS) {
    const storages = Object.keys(PRICE_TABLE[m.id] || {}).sort(
      (a, b) => STORAGE_ORDER.indexOf(a) - STORAGE_ORDER.indexOf(b),
    );
    let upTo = 0;
    let bestStorage = storages[storages.length - 1] || "";
    for (const s of storages) {
      const r = await quoteDevice({
        modelId: m.id,
        modelLabel: m.label,
        storage: s,
        condition: "sealed",
        carrier: "unlocked",
        isPhone: true,
      }, overrides).catch(() => null);
      if (r?.offer && r.offer > upTo) {
        upTo = r.offer;
        bestStorage = s;
      }
    }
    // A model with no live engine price would render "up to $0" — a broken
    // promise on an ad landing page. Drop the row instead; the funnel link
    // still covers it.
    if (upTo > 0) rows.push({ id: m.id, label: m.label, img: m.img, upTo, storages, bestStorage });
  }
  return rows;
}
