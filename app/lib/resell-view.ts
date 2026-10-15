// The SELL side of a quote, for the people-facing lookups (Theot's tcc_price,
// 2026-10-14): what TCC could GET for the phone, shown next to what the
// website PAYS for it. The admin editor's margin chip already takes the best
// of three channels (buildMarginMap in app/api/admin/prices/route.ts); this
// is the same idea per device and per condition, each as the NET the owner
// would pocket:
//   - Atlas wholesale: the grade this condition sells as, minus shipping
//     (unlocked phones only -- that is what Atlas lists)
//   - eBay sold comps: the gross median for this storage, minus the 13% fee,
//     the fixed fee and shipping; fair/broken units are scaled off the "used"
//     median by the condition multiplier, since eBay has no broken cell
//   - RESELL_ESTIMATES: the private-sale midpoint × the condition multiplier
//     (what the margin cap itself reasons from)
// net_exit is the best of them and names its basis. Nothing here prices a
// quote; it only reads the comps the editor reads.
import { getResellEstimateForModel, resellMultiplierForCondition } from "./resell-estimates";
import { ebayGrossToNet, atlasResellToNet } from "./comp-economics";
import { loadEbayReference, ebayCellFor } from "./ebay-reference";
import { loadAtlasReference, atlasRowFor, atlasGradeFor } from "./atlas-reference";

export type ResellView = {
  estimate: number | null;
  ebay: { storage: string; kind: "used" | "sealed"; median: number; count: number; net: number; scaled: boolean; scraped_at: string | null } | null;
  atlas: { key: string; grade: string; value: number; net: number } | null;
  net_exit: number | null;
  basis: "atlas" | "ebay" | "estimate" | null;
  comps_dated: string | null;
};

const WORKING = new Set(["sealed", "mint", "good"]);

export async function resellViewFor(opts: {
  slug: string;
  label: string;
  storage?: string | null;
  condition: string;
  carrier?: string | null;
}): Promise<ResellView> {
  const cond = String(opts.condition || "good").toLowerCase();
  const mult = resellMultiplierForCondition(cond);
  const goodMult = resellMultiplierForCondition("good");

  const base = getResellEstimateForModel(opts.slug, opts.label);
  const estimate = base != null ? Math.round(base * mult) : null;

  const [ebayRef, atlasRef] = await Promise.all([loadEbayReference(), loadAtlasReference()]);

  let ebay: ResellView["ebay"] = null;
  const cell = ebayCellFor(ebayRef, opts.slug, opts.storage ?? null, cond === "sealed");
  if (cell) {
    const scaled = !WORKING.has(cond);
    const gross = scaled ? cell.median * (mult / goodMult) : cell.median;
    ebay = {
      storage: cell.storage,
      kind: cell.kind,
      median: Math.round(cell.median),
      count: cell.count || 0,
      net: Math.round(ebayGrossToNet(gross, opts.slug)),
      scaled,
      scraped_at: cell.scraped_at,
    };
  }

  let atlas: ResellView["atlas"] = null;
  if (!opts.carrier || opts.carrier === "unlocked") {
    const hit = atlasRowFor(atlasRef, opts.label, opts.storage ?? null);
    if (hit) {
      const grade = atlasGradeFor(cond);
      const value = hit.row[grade];
      if (typeof value === "number" && value > 0) {
        atlas = { key: hit.key, grade, value, net: Math.round(atlasResellToNet(value, opts.slug)) };
      }
    }
  }

  const candidates: Array<[ResellView["basis"], number]> = [];
  if (atlas) candidates.push(["atlas", atlas.net]);
  if (ebay) candidates.push(["ebay", ebay.net]);
  if (estimate != null) candidates.push(["estimate", estimate]);
  let basis: ResellView["basis"] = null;
  let net_exit: number | null = null;
  for (const [b, v] of candidates) {
    if (net_exit == null || v > net_exit) { net_exit = v; basis = b; }
  }

  const dates = [ebay?.scraped_at, atlasRef.scraped_at].filter((d): d is string => !!d).sort();
  return { estimate, ebay, atlas, net_exit, basis, comps_dated: dates[0] ?? null };
}
