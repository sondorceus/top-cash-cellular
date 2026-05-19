// Per-cell economics resolver. Given a lead's device fields, returns
// what TCC would NET selling that exact unit through each channel —
// Atlas (wholesale, ship only) and eBay (gross × 0.87 − $0.40 − ship).
//
// Used by /api/lead's Theot channel-recommendation auto-fire on every
// new lead (single + multi-device). Centralizes SKU resolution + slug
// normalization so both paths agree on what cell is being priced.
//
// Skywalker 2026-05-19.

import { promises as fs } from "fs";
import path from "path";
import { lookupAtlasResell, type AtlasReference } from "./atlas-lookup";
import { ebayGrossToNet, atlasResellToNet, shippingFor, familyForSku } from "./comp-economics";
import skuLabelsJson from "../data/sku-labels.json";

const SKU_LABELS: Record<string, string> = skuLabelsJson as Record<string, string>;
const LABEL_TO_SKU: Record<string, string> = (() => {
  const out: Record<string, string> = {};
  for (const [sku, lab] of Object.entries(SKU_LABELS)) out[lab.toLowerCase().trim()] = sku;
  return out;
})();

export type EbayCell = { count: number; median?: number; average?: number; min?: number; max?: number };
export type EbayReference = {
  models?: Record<string, { by_cell?: Record<string, Record<string, EbayCell>> }>;
};

// Per-process cache. /api/lead is hot — read each JSON once per cold
// start and pin it. ~250KB each, negligible memory.
let atlasCache: AtlasReference | null = null;
let ebayCache: EbayReference | null = null;
export async function loadCompFiles(): Promise<{ atlas: AtlasReference; ebay: EbayReference }> {
  if (atlasCache && ebayCache) return { atlas: atlasCache, ebay: ebayCache };
  const cwd = process.cwd();
  const [atlasRaw, ebayRaw] = await Promise.all([
    fs.readFile(path.join(cwd, "public", "comps", "atlas-reference.json"), "utf-8").catch(() => "{}"),
    fs.readFile(path.join(cwd, "public", "comps", "ebay-sold.json"), "utf-8").catch(() => "{}"),
  ]);
  try { atlasCache = JSON.parse(atlasRaw); } catch { atlasCache = {}; }
  try { ebayCache = JSON.parse(ebayRaw); } catch { ebayCache = {}; }
  return { atlas: atlasCache!, ebay: ebayCache! };
}

// Funnel label → SKU. Exact match first, fall back to longest-substring
// match so minor punctuation drift ("iPhone 13 mini" vs "iPhone 13 Mini")
// still resolves.
export function resolveSku(modelLabel: string): string | null {
  const key = modelLabel.toLowerCase().trim();
  if (LABEL_TO_SKU[key]) return LABEL_TO_SKU[key];
  let best: { sku: string; len: number } | null = null;
  for (const [lab, sku] of Object.entries(LABEL_TO_SKU)) {
    if (key.includes(lab) || lab.includes(key)) {
      if (!best || lab.length > best.len) best = { sku, len: lab.length };
    }
  }
  return best?.sku || null;
}

// "256GB" / "1 TB" / "256" → "256" / "1tb". Returns null for unparseable.
export function normalizeStorage(raw: string | undefined | null): string | null {
  if (!raw) return null;
  const s = String(raw).toLowerCase().replace(/\s+/g, "");
  if (/^\d+tb$/.test(s)) return s;
  const m = /^(\d+)gb?$/.exec(s);
  if (m) return m[1];
  if (/^\d+$/.test(s)) return s;
  return null;
}

// Funnel condition strings → canonical slug used by Atlas + eBay lookups.
// Mirrors the admin/leads route's normalizer so single + multi paths agree.
export function normalizeCondition(raw: string | undefined | null): string | null {
  if (!raw) return null;
  const k = String(raw).toLowerCase().replace(/[^a-z]/g, "");
  if (k.includes("seal")) return "sealed";
  if (k.includes("excellent") || k.includes("mint") || k.includes("lightlyflown")) return "mint";
  if (k.includes("verygood")) return "verygood";
  if (k.includes("good")) return "good";
  if (k.includes("fair")) return "fair";
  if (k.includes("broken") || k.includes("damage") || k.includes("notfunctional")) return "broken";
  return null;
}

export type CarrierSlug = "att" | "tmobile" | "other";

// Funnel carrier → atlas-lookup slug. null = unlocked.
export function normalizeCarrier(raw: string | undefined | null): CarrierSlug | null {
  if (!raw) return null;
  const k = String(raw).toLowerCase().replace(/[^a-z]/g, "");
  if (k.includes("att") || k.includes("at&t")) return "att";
  if (k.includes("tmobile") || k.includes("tmo")) return "tmobile";
  if (k.includes("verizon")) return "other";
  if (k.includes("unlocked") || !k) return null;
  return "other";
}

export type CellEconomics = {
  sku: string;
  family: string;
  storageSlug: string;
  conditionSlug: string;
  carrierSlug: CarrierSlug | null;
  shipCost: number;
  atlasResell: number | null;
  atlasNet: number | null;
  ebayGross: number | null;
  ebayNet: number | null;
  ebaySamples: number;
};

// Look up Atlas + eBay net for a lead's specific cell. Returns null when
// we can't map the model label to a SKU or when the storage/condition
// strings don't normalize. Returns an object with both nets nullable
// when only one channel has data — caller decides what to do with
// half-coverage cells.
export function lookupCellEconomics(opts: {
  modelLabel: string;
  storage: string | undefined | null;
  condition: string | undefined | null;
  carrier: string | undefined | null;
  atlas: AtlasReference;
  ebay: EbayReference;
}): CellEconomics | null {
  const sku = resolveSku(opts.modelLabel);
  if (!sku) return null;
  const storageSlug = normalizeStorage(opts.storage);
  const conditionSlug = normalizeCondition(opts.condition);
  if (!storageSlug || !conditionSlug) return null;
  const carrierSlug = normalizeCarrier(opts.carrier);
  const family = familyForSku(sku);
  const shipCost = shippingFor(sku);

  // Atlas: lookupAtlasResell handles the per-category column mapping.
  const atlasResell = lookupAtlasResell(opts.atlas, sku, opts.modelLabel, storageSlug, conditionSlug, carrierSlug);
  const atlasNet = atlasResell != null ? atlasResellToNet(atlasResell, sku) : null;

  // eBay: buckets are coarser — sealed / used / broken. Map our slug
  // there before the cell lookup. Fall back to any storage when the
  // exact one isn't represented (take the storage with the most samples).
  const ebayBucket = conditionSlug === "sealed" ? "sealed" : conditionSlug === "broken" ? "broken" : "used";
  const ebayModel = opts.ebay.models?.[sku];
  let ebayGross: number | null = null;
  let ebaySamples = 0;
  if (ebayModel?.by_cell) {
    const exact = ebayModel.by_cell[storageSlug]?.[ebayBucket];
    if (exact?.median) { ebayGross = exact.median; ebaySamples = exact.count || 0; }
    else {
      for (const stor of Object.values(ebayModel.by_cell)) {
        const cell = stor[ebayBucket];
        if (cell?.median && (cell.count || 0) > ebaySamples) {
          ebayGross = cell.median; ebaySamples = cell.count || 0;
        }
      }
    }
  }
  const ebayNet = ebayGross != null ? ebayGrossToNet(ebayGross, sku) : null;

  if (atlasResell == null && ebayGross == null) return null;
  return { sku, family, storageSlug, conditionSlug, carrierSlug, shipCost, atlasResell, atlasNet, ebayGross, ebayNet, ebaySamples };
}
