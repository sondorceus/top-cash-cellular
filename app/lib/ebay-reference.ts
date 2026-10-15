// eBay sold comps (public/comps/ebay-sold.json, written by the scraper) as a
// server-side lookup. The admin price editor kept a private copy of this
// loader; it lives here now so /api/quote's resale view (Theot's tcc_price)
// reads the very same file the editor's margin chip reads. Read-only data.
import { promises as fs } from "fs";
import path from "path";

export type EbayCell = {
  count: number;
  average: number;
  median: number;
  net_average?: number;
  net_median?: number;
  min: number;
  max: number;
  rejected_outliers?: number;
};
export type EbayModel = {
  label?: string;
  family?: string;
  scraped_at?: string;
  // by_cell[storageKey]["used" | "sealed"]
  by_cell?: Record<string, Record<string, EbayCell>>;
  unmatched?: number;
  outliers_rejected?: number;
};
export type EbayReference = {
  scraped_at?: string;
  source?: string;
  note?: string;
  models?: Record<string, EbayModel>;
};

let cache: EbayReference | null = null;

export async function loadEbayReference(): Promise<EbayReference> {
  if (cache) return cache;
  try {
    const p = path.join(process.cwd(), "public", "comps", "ebay-sold.json");
    cache = JSON.parse(await fs.readFile(p, "utf-8")) as EbayReference;
  } catch {
    cache = {};
  }
  return cache;
}

export type EbayPick = EbayCell & { storage: string; kind: "used" | "sealed"; scraped_at: string | null };

/**
 * The sold-comps cell for a SKU at a storage key ("256", "1tb"): the "used"
 * cell, or "sealed" when asked. Exact storage only -- a 128 GB question never
 * answers with the 256 GB row -- except when no storage was given, where the
 * best-populated storage stands in and is named in the result.
 */
export function ebayCellFor(
  ref: EbayReference,
  sku: string,
  storage: string | null | undefined,
  sealed = false,
): EbayPick | null {
  const model = ref.models?.[sku];
  const byCell = model?.by_cell;
  if (!byCell) return null;
  const kind: "used" | "sealed" = sealed ? "sealed" : "used";
  const scraped_at = model?.scraped_at || ref.scraped_at || null;
  if (storage) {
    const cell = byCell[storage]?.[kind];
    return cell && typeof cell.median === "number" ? { ...cell, storage, kind, scraped_at } : null;
  }
  let best: EbayPick | null = null;
  for (const [stor, cells] of Object.entries(byCell)) {
    const cell = cells?.[kind];
    if (!cell || typeof cell.median !== "number") continue;
    if (!best || (cell.count || 0) > (best.count || 0)) best = { ...cell, storage: stor, kind, scraped_at };
  }
  return best;
}
