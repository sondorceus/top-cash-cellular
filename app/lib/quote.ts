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

import { list } from "@vercel/blob";
import {
  PRICE_TABLE,
  CARRIER_DEDUCTIONS,
  MIN_OFFER,
  BASE_PRICED_MODELS,
  MANUAL_REVIEW_DEVICES,
} from "../data/prices";
import {
  getResellEstimate,
  resellMultiplierForCondition,
  MARGIN_FLOOR_MULT,
  EBAY_FEE_MULT,
  galaxyPriceDrop,
  GALAXY_DROP_MIN_OFFER,
} from "./resell-estimates";

const BLOB_KEY = "prices/overrides.json";

export type PriceOverrides = {
  priceTable: Record<string, Record<string, Record<string, number>>>;
  carrierDeductions: Record<string, Record<string, number>>;
  baseOverrides: Record<string, number>;
  conditionAdj: Record<string, Record<string, number>>;
  updatedAt?: string;
};

const EMPTY_OVERRIDES: PriceOverrides = {
  priceTable: {},
  carrierDeductions: {},
  baseOverrides: {},
  conditionAdj: {},
};

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

export type QuoteSpec = {
  // PRICE_TABLE / BASE_PRICED_MODELS key, e.g. "ip15pm", "gs25u".
  modelId: string;
  // Human label, e.g. "iPhone 15 Pro Max". Optional but enables the
  // 25%-margin resell guardrail (matched by name in RESELL_ESTIMATES).
  modelLabel?: string;
  // Price-table storage key: "64" | "128" | "256" | "512" | "1tb" | "2tb".
  storage?: string;
  // "sealed" | "mint" (UI: "Excellent") | "good" | "fair" | "broken".
  condition: string;
  // "att" | "tmobile" | "verizon" | "other" | "unlocked".
  carrier?: string;
  // Only meaningful for Verizon (the one carrier we ask the lock question).
  carrierLocked?: boolean;
  // Phones + cellular iPads get the +$25 popular-device bonus.
  isPhone?: boolean;
  // Extra −$30 when a phone is broken with BOTH front + back glass cracked.
  brokenGlass?: "front" | "back" | "both" | null;
};

export type QuoteResult = {
  ok: boolean;
  offer: number | null; // TCC's dollar offer; null when manual/unmatched.
  manualReview: boolean;
  reason?: string;
  source: "price-table" | "base-priced" | "additive" | "unmatched";
  modelId: string;
  breakdown?: {
    cellPrice: number;
    carrierDeduction: number;
    popularBonus: number;
    bothGlassPenalty: number;
    rawQuote: number;
    resellEstimate: number | null;
    marginCap: number | null;
    capped: boolean;
  };
};

// Map common listing-speak to our canonical storage/condition keys so the
// Brain doesn't have to know our exact slugs.
export function normalizeStorage(s: string | undefined): string | undefined {
  if (!s) return undefined;
  const t = s.toLowerCase().replace(/\s|gb/g, "");
  if (t === "1tb" || t === "1024") return "1tb";
  if (t === "2tb" || t === "2048") return "2tb";
  return t; // "64" | "128" | "256" | "512"
}

export function normalizeCondition(c: string | undefined): string {
  const t = (c || "").toLowerCase().trim();
  if (["sealed", "new", "brand new", "nib"].includes(t)) return "sealed";
  if (["mint", "excellent", "like new", "flawless"].includes(t)) return "mint";
  if (["good", "very good"].includes(t)) return "good";
  if (["fair", "ok", "okay", "worn", "rough"].includes(t)) return "fair";
  if (["broken", "cracked", "damaged", "for parts", "not working"].includes(t)) return "broken";
  return t || "good"; // sensible default; caller can flag low confidence
}

// Compute TCC's offer for a single device. Pass `overrides` to batch many
// quotes off one blob read; omit to fetch fresh.
export async function quoteDevice(
  spec: QuoteSpec,
  overrides?: PriceOverrides,
): Promise<QuoteResult> {
  const ov = overrides ?? (await readPriceOverrides());
  const id = spec.modelId;
  const storage = normalizeStorage(spec.storage) ?? "base";
  const cond = normalizeCondition(spec.condition);

  // Devices we never auto-quote regardless of path (vintage/odd SKUs).
  if (MANUAL_REVIEW_DEVICES.has(id)) {
    return { ok: true, offer: null, manualReview: true, reason: "model is flagged manual-review in prices.ts", source: "unmatched", modelId: id };
  }

  // --- PRICE-TABLE PATH (phones, tablets) — fully computed ---
  const cellPrice =
    ov.priceTable?.[id]?.[storage]?.[cond] ?? PRICE_TABLE[id]?.[storage]?.[cond];

  if (cellPrice != null) {
    // Carrier gap (flat $). Verizon is the only carrier with a lock question:
    // unlocked Verizon pays full (gap 0); locked Verizon loses the verizon
    // gap, falling back to the att gap. att/tmobile/other apply directly.
    const carrier = spec.carrier ?? "unlocked";
    let carrierDeduction = 0;
    if (carrier === "verizon") {
      carrierDeduction = spec.carrierLocked
        ? (ov.carrierDeductions?.[id]?.verizon
            ?? CARRIER_DEDUCTIONS[id]?.verizon
            ?? ov.carrierDeductions?.[id]?.att
            ?? CARRIER_DEDUCTIONS[id]?.att
            ?? 0)
        : 0;
    } else if (carrier !== "unlocked") {
      carrierDeduction =
        ov.carrierDeductions?.[id]?.[carrier] ?? CARRIER_DEDUCTIONS[id]?.[carrier] ?? 0;
    }

    const baseQuote = Math.max(0, Math.round(cellPrice - carrierDeduction));
    const popularBonus = spec.isPhone && baseQuote > 0 ? 25 : 0;
    const bothGlassPenalty =
      cond === "broken" && spec.brokenGlass === "both" && baseQuote > 0 ? -30 : 0;
    const rawQuote = Math.max(0, baseQuote + popularBonus + bothGlassPenalty);

    // 25%-margin guardrail — never offer more than 75% of resell value. Only
    // applies when we have a resell comp for the label (matched by name).
    const resell = getResellEstimate(spec.modelLabel);
    const condMult = resellMultiplierForCondition(cond, spec.brokenGlass);
    const estResellNow = resell != null ? Math.round(resell * condMult) : null;
    // resell × eBay-net (−13% FVF) × margin floor — mirror of the funnel cap.
    const marginCap = estResellNow != null ? Math.round(estResellNow * EBAY_FEE_MULT * MARGIN_FLOOR_MULT) : null;
    const capped = marginCap != null && rawQuote > marginCap;
    const cappedQuote = capped ? marginCap! : rawQuote;
    // Galaxy S23+ blanket −$75 (mirror of the funnel). After the cap, floored
    // at MIN_OFFER so it only trims real offers. Skywalker 2026-07-05.
    const galaxyDrop = galaxyPriceDrop(id);
    const finalQuote = (galaxyDrop > 0 && cappedQuote >= GALAXY_DROP_MIN_OFFER)
      ? Math.max(MIN_OFFER, cappedQuote - galaxyDrop)
      : cappedQuote;

    // Below MIN_OFFER (or cap forces it there) → manual review, no auto-offer.
    const needsReview = finalQuote < MIN_OFFER || (marginCap != null && marginCap < MIN_OFFER);

    return {
      ok: true,
      offer: needsReview ? null : finalQuote,
      manualReview: needsReview,
      reason: needsReview ? `quote $${finalQuote} below MIN_OFFER $${MIN_OFFER} or margin floor` : undefined,
      source: "price-table",
      modelId: id,
      breakdown: {
        cellPrice,
        carrierDeduction,
        popularBonus,
        bothGlassPenalty,
        rawQuote,
        resellEstimate: estResellNow,
        marginCap,
        capped,
      },
    };
  }

  // --- ADDITIVE PATH (MacBooks / PC laptops) — needs spec detail (v2) ---
  if (ov.conditionAdj?.[id] !== undefined || hasAdditiveModel(id)) {
    return { ok: true, offer: null, manualReview: true, reason: "MacBook/PC laptop: chip/RAM/storage spec needed to quote (additive path, v2)", source: "additive", modelId: id };
  }

  // --- BASE-PRICED PATH (VR / drones / Garmin) — surface base, review ---
  const baseModel = BASE_PRICED_MODELS[id];
  if (baseModel) {
    const base = ov.baseOverrides?.[id] ?? baseModel.base;
    return { ok: true, offer: null, manualReview: true, reason: `base-priced device (${baseModel.label}); base $${base}, condition multiplier applied manually`, source: "base-priced", modelId: id };
  }

  // --- UNMATCHED ---
  return { ok: true, offer: null, manualReview: true, reason: `no PRICE_TABLE / base-price entry for "${id}"`, source: "unmatched", modelId: id };
}

// Crude additive-model check used only to route to manualReview with a clear
// reason. The full MACBOOK_SPECS / pc-laptop additive computation lands in v2.
function hasAdditiveModel(id: string): boolean {
  return /^(mbp|mba|mac|ln_|hp_|dell_|alien|as_|ac_|sgbk_|lg_)/.test(id);
}
