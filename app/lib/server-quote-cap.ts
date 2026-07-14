// AUTHORITATIVE SERVER QUOTE CAP — anti-tamper ceiling for /api/lead.
//
// The old guard capped by RESELL_ESTIMATES × condition multiplier, which is
// null for every resell-EXEMPT SKU (sealed 17 Pro Max, Watch Ultra 2/3, all
// legacy iPhones, most Samsung…). After the 2026-07-14 higher-bid recabs the
// most expensive quotes on the site (17PM up to $1,450) had NO ceiling at
// all — DevTools could post any number (deferred bug hunt #2/#4).
//
// This module instead recomputes the REAL offer server-side through
// quoteDevice() (PRICE_TABLE + live blob overrides — covers every model the
// funnel can price) and allows a headroom margin for funnel-only extras the
// bot baseline omits (mint accessory +$10, tablet extras, cellular-iPad
// connectivity multiplier): allowed = offer + max($60, 10%). Tampering
// under 10% isn't lucrative and inspection is the backstop; everything
// above gets clamped + flagged exactly as before.
//
// Falls back to null when the label can't be resolved or the model routes
// to manual review — callers then try the legacy resell cap, and a still-
// null cap skips the clamp (same behavior as before, but now rare).

import skuLabelsJson from "../data/sku-labels.json";
import { quoteDevice, type PriceOverrides } from "./quote";

const SKU_LABELS = skuLabelsJson as Record<string, string>;

// label (normalized) → model id. sku-labels values are unique (verified);
// PRICE_TABLE ids double as their own aliases so device strings that
// already carry an id resolve too.
const LABEL_TO_ID: Record<string, string> = {};
const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();
for (const [id, label] of Object.entries(SKU_LABELS)) {
  LABEL_TO_ID[norm(label)] = id;
  LABEL_TO_ID[id] = id;
}

export function resolveModelIdFromLabel(label: unknown): string | null {
  if (typeof label !== "string" || !label.trim()) return null;
  return LABEL_TO_ID[norm(label)] ?? null;
}

// Funnel condition labels ("Sealed / Unopened", "Excellent", …) and lead-
// body free text → canonical condition ids. Substring-based on purpose.
export function canonicalCondition(c: unknown): string {
  const t = norm(typeof c === "string" ? c : "");
  if (/seal|brand new|unopened|nib/.test(t)) return "sealed";
  if (/excellent|mint|like new|flawless/.test(t)) return "mint";
  if (/very good|good|well.?maintained/.test(t)) return "good";
  if (/fair|worn|heav|rough/.test(t)) return "fair";
  if (/brok|crack|damag|dead|not working|parts/.test(t)) return "broken";
  return "good";
}

function canonicalCarrier(c: unknown): string {
  const t = norm(typeof c === "string" ? c : "");
  if (/t-?mobile|metro/.test(t)) return "tmobile";
  if (/at&t|att\b|cricket/.test(t)) return "att";
  if (/verizon|visible/.test(t)) return "verizon";
  if (!t || /unlock/.test(t)) return "unlocked";
  return "other";
}

export type LeadLineSpec = {
  model?: unknown;
  condition?: unknown;
  carrier?: unknown;
  carrierLock?: unknown;
  storage?: unknown;
  brokenGlass?: unknown;
};

/**
 * Per-unit ceiling for one lead line, or null when we can't price it
 * server-side. Pass the overrides from ONE readPriceOverrides() call so a
 * multi-device cart doesn't re-read the blob per line.
 */
export async function authoritativeLineCap(line: LeadLineSpec, overrides: PriceOverrides): Promise<number | null> {
  const id = resolveModelIdFromLabel(line.model);
  if (!id) return null;
  const glass = line.brokenGlass === "front" || line.brokenGlass === "back" || line.brokenGlass === "both" ? line.brokenGlass : null;
  const lockTxt = norm(typeof line.carrierLock === "string" ? line.carrierLock : "");
  const carrierLocked = /financ|still locked|^yes/.test(lockTxt) && !/unlock/.test(lockTxt);
  const r = await quoteDevice({
    modelId: id,
    modelLabel: SKU_LABELS[id],
    storage: typeof line.storage === "string" ? line.storage : undefined,
    condition: canonicalCondition(line.condition),
    carrier: canonicalCarrier(line.carrier),
    carrierLocked,
    // Phones + cellular iPads earn the +$25 bonus; granting it to every
    // PRICE_TABLE device only LOOSENS the ceiling by $25 — acceptable
    // inside the headroom, and it can never false-flag an honest quote.
    isPhone: true,
    brokenGlass: glass,
  }, overrides).catch(() => null);
  if (!r || r.offer == null) return null;
  // iPads: the funnel's cellular connectivity multiplier (×1.15) is a
  // funnel-only modifier quoteDevice omits — wider headroom so an honest
  // cellular iPad never gets fraud-flagged.
  const headroomPct = id.startsWith("ipad") ? 0.22 : 0.10;
  return r.offer + Math.max(60, Math.round(r.offer * headroomPct));
}
