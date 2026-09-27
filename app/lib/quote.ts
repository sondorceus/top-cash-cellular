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
  EMPTY_OVERRIDES,
  type PriceOverrides,
  type QuoteSpec,
  type QuoteResult,
} from "./quote-engine";

// WHERE THE LIVE OVERRIDES LIVE (2026-09-26). Every save writes a NEW pathname,
// prices/overrides-v<ISO ts, colons → "-">.json, and readers take the
// lexicographically newest one. A fresh URL is never served stale by the Blob
// CDN, whereas the old single-path overwrite (prices/overrides.json) stayed
// stale for ~60 s — long enough that a July-12 clear-all was re-run five times
// against a doc it had already removed. The legacy path is still read when no
// versioned doc exists. Only /api/admin/prices writes; every quoting path
// reads through here (or app/lib/overrides-cache.ts on top of it).
export const LEGACY_OVERRIDES_KEY = "prices/overrides.json";
export const OVERRIDES_VERSION_PREFIX = "prices/overrides-v";
const VERSION_RE = /^prices\/overrides-v[0-9TZ.\-]+\.json$/;

/** The pathname a doc written at `at` gets — ISO order == lexicographic order. */
export function versionedOverridesPathname(at: Date = new Date()): string {
  return `${OVERRIDES_VERSION_PREFIX}${at.toISOString().replace(/:/g, "-")}.json`;
}

export type OverridesBlobRef = { pathname: string; url: string; uploadedAt: string };

/** Every versioned overrides doc, newest pathname first. THROWS on a failed list(). */
export async function listOverridesVersions(timeoutMs = 8_000): Promise<OverridesBlobRef[]> {
  const { blobs } = await list({ prefix: OVERRIDES_VERSION_PREFIX, limit: 100, abortSignal: AbortSignal.timeout(timeoutMs) });
  return blobs
    .filter((b) => VERSION_RE.test(b.pathname))
    .map((b) => ({ pathname: b.pathname, url: b.url, uploadedAt: b.uploadedAt.toISOString() }))
    .sort((a, b) => (a.pathname < b.pathname ? 1 : a.pathname > b.pathname ? -1 : 0));
}

// A stored doc → the four maps (+ stamps). Anything that isn't an object map
// reads as empty rather than crashing a quote. Always FRESH objects — the admin
// route mutates the doc it read, and a shared EMPTY constant must never be it.
function parseOverridesDoc(d: Record<string, unknown>): PriceOverrides {
  const map = <T>(v: unknown): T => (v && typeof v === "object" && !Array.isArray(v) ? (v as T) : ({} as T));
  return {
    priceTable: map<PriceOverrides["priceTable"]>(d.priceTable),
    carrierDeductions: map<PriceOverrides["carrierDeductions"]>(d.carrierDeductions),
    baseOverrides: map<PriceOverrides["baseOverrides"]>(d.baseOverrides),
    conditionAdj: map<PriceOverrides["conditionAdj"]>(d.conditionAdj),
    updatedAt: typeof d.updatedAt === "string" ? d.updatedAt : undefined,
    updatedBy: typeof d.updatedBy === "string" ? d.updatedBy : undefined,
  };
}

export type OverridesDoc = { overrides: PriceOverrides; pathname: string | null };

/**
 * The live overrides doc. `pathname: null` = no doc exists (empty maps, a
 * SUCCESSFUL read). Returns null — never empty maps — when the read FAILED
 * (list / fetch / JSON / timeout / missing token): until 2026-09-26 every
 * failure read as "no overrides", was memoised for 60 s, and put the funnel
 * on the code table while /api/lead capped from the blob, so honest customers
 * were clamped as "tamper". Callers decide what a failure means for them.
 */
export async function readOverridesDoc(): Promise<OverridesDoc | null> {
  try {
    // Bounded: this read sits under every quote, and a stalled Blob call
    // held the caller open with no limit at all.
    const versions = await listOverridesVersions();
    let ref: OverridesBlobRef | undefined = versions[0];
    if (!ref) {
      const { blobs } = await list({ prefix: LEGACY_OVERRIDES_KEY, limit: 5, abortSignal: AbortSignal.timeout(8_000) });
      const legacy = blobs.find((b) => b.pathname === LEGACY_OVERRIDES_KEY);
      if (!legacy) return { overrides: { priceTable: {}, carrierDeductions: {}, baseOverrides: {}, conditionAdj: {} }, pathname: null };
      ref = { pathname: legacy.pathname, url: legacy.url, uploadedAt: legacy.uploadedAt.toISOString() };
    }
    const r = await fetch(ref.url, { cache: "no-store", signal: AbortSignal.timeout(6_000) });
    if (!r.ok) return null;
    const d: unknown = await r.json();
    if (!d || typeof d !== "object" || Array.isArray(d)) return null;
    return { overrides: parseOverridesDoc(d as Record<string, unknown>), pathname: ref.pathname };
  } catch {
    return null;
  }
}

// Read Skywalker's live price overrides from Vercel Blob — the same doc the
// admin editor writes, so bot quotes reflect edits within seconds, no
// redeploy. null = the read failed (see readOverridesDoc); empty maps = no
// overrides saved. Quoting paths should prefer cachedOverrides()
// (app/lib/overrides-cache.ts), which keeps the last good doc across failures.
export async function readPriceOverrides(): Promise<PriceOverrides | null> {
  const doc = await readOverridesDoc();
  return doc ? doc.overrides : null;
}

// Compute TCC's offer for a single device. Pass `overrides` to batch many
// quotes off one blob read; omit to fetch fresh (a failed fetch prices from
// the code table, as before 2026-09-26).
export async function quoteDevice(
  spec: QuoteSpec,
  overrides?: PriceOverrides | null,
): Promise<QuoteResult> {
  const ov = overrides ?? (await readPriceOverrides()) ?? EMPTY_OVERRIDES;
  return quoteDeviceSync(spec, ov);
}
