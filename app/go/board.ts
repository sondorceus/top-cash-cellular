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

// Six recognizable, high-payout phones. Edit freely — prices are computed,
// never hardcoded here.
export const BOARD_MODELS: { id: string; label: string; img: string }[] = [
  { id: "ip17pm", label: "iPhone 17 Pro Max", img: "/devices/iphone-17-pro-max.webp" },
  { id: "ip16pm", label: "iPhone 16 Pro Max", img: "/devices/iphone-16-pro-max.webp" },
  { id: "gs25u", label: "Galaxy S25 Ultra", img: "/devices/gs25u.webp" },
  { id: "ip15pm", label: "iPhone 15 Pro Max", img: "/devices/iphone-15-pro-max.webp" },
  { id: "gs24u", label: "Galaxy S24 Ultra", img: "/devices/gs24u.webp" },
  { id: "ip14pm", label: "iPhone 14 Pro Max", img: "/devices/iphone-14-pro-max.webp" },
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
