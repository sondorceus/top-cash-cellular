// Shared TCC quote helper — the single source of truth for "what would we
// pay for this device". Reproduces the customer funnel's BASELINE quote math
// (app/page.tsx ~5749-5885) so the marketplace lead bot quotes the exact same
// number the funnel would show — no drift.
//
// Scope (v1): the price-table path (phones + tablets) is fully computed —
// that's the bulk of marketplace volume and the math is exact. MacBooks / PC
// laptops (additive-spec path) and simple base-priced devices (VR / drones /
// Garmin) need spec detail a cold listing rarely has, so they return
// manualReview=true with the matched base info instead of a guessed number.
// The additive path is a planned v2 once the phone path is proven live.
//
// Funnel-only modifiers are intentionally OMITTED here (promo/coupon codes,
// accessory bonuses, extras adjustments, connectivity multipliers) — a cold
// Marketplace listing carries none of them. This is the clean baseline offer.
//
// The math itself lives in quote-engine.ts (no I/O, so the offer page can
// bundle it); this module adds the live Blob overrides read and re-exports
// the engine so server code keeps importing from here.

import { list } from "@vercel/blob";
import { EMPTY_OVERRIDES, quoteDeviceSync, type PriceOverrides, type QuoteSpec, type QuoteResult } from "./quote-engine";

export {
  quoteDeviceSync,
  normalizeStorage,
  normalizeCondition,
  canonicalCondition,
  canonicalCarrier,
  carrierLockedFromText,
  type PriceOverrides,
  type QuoteSpec,
  type QuoteResult,
} from "./quote-engine";

const BLOB_KEY = "prices/overrides.json";

// Read Skywalker's live price overrides from Vercel Blob — same source the
// admin editor writes to and the funnel reads, so bot quotes reflect edits
// within seconds, no redeploy. (Mirrors readOverrides() in
// app/api/admin/prices/route.ts; kept as a standalone read to avoid coupling
// the bot to the admin route's request handlers.)
export async function readPriceOverrides(): Promise<PriceOverrides> {
  try {
    const { blobs } = await list({ prefix: BLOB_KEY, limit: 5 });
    const found = blobs.find((b) => b.pathname === BLOB_KEY);
    if (!found) return EMPTY_OVERRIDES;
    const r = await fetch(found.url, { cache: "no-store" });
    if (!r.ok) return EMPTY_OVERRIDES;
    const d = await r.json();
    return {
      priceTable: d.priceTable || {},
      carrierDeductions: d.carrierDeductions || {},
      baseOverrides: d.baseOverrides || {},
      conditionAdj: d.conditionAdj || {},
      updatedAt: d.updatedAt,
    };
  } catch {
    return EMPTY_OVERRIDES;
  }
}

// Compute TCC's offer for a single device. Pass `overrides` to batch many
// quotes off one blob read; omit to fetch fresh.
export async function quoteDevice(
  spec: QuoteSpec,
  overrides?: PriceOverrides,
): Promise<QuoteResult> {
  const ov = overrides ?? (await readPriceOverrides());
  return quoteDeviceSync(spec, ov);
}
