// /go spec resolver — server-only. ONE place that turns the chip answers
// into the engine call, so /api/go/quote and /api/go/lock can never disagree
// (the lock route's price-moved guard compares the two numbers).
//
// Phones: carrier as before ("unknown" = the "not sure" chip, priced at the
// floor of the locked tiers). iPads: `opt` is connectivity (wifi|cellular) —
// cellular gets the homepage's ×1.15 and the +$25 bonus, applied to the raw
// cell BEFORE the margin cap and the minimum check, in the homepage's order.
// Consoles: `opt` is disc|digital|na — digital gets the homepage's ×0.92,
// again before the cap; console labels are passed to the engine so the
// resell margin cap applies exactly as it does on the homepage. MacBooks:
// processor + memory + storage option ids and an `extras` answer
// (battery/charger), priced by the homepage's additive math ported to
// app/lib/macbook-quote.ts.
import { quoteDevice, type QuoteSpec } from "../lib/quote";
import { cachedOverrides } from "../lib/overrides-cache";
import { PRICE_TABLE, MIN_OFFER } from "../data/prices";
import { BOARD_BY_ID, CELLULAR_BONUS, CELLULAR_MULT, DIGITAL_MULT, type BoardModel } from "./board";
import { quoteMacBook, macOptions, type MacBattery, type MacCharger } from "../lib/macbook-quote";

export const GO_CONDITIONS = new Set(["sealed", "mint", "good", "fair", "broken"]);
export const GO_CARRIERS = new Set(["unlocked", "att", "tmobile", "verizon", "other", "unknown"]);
const CONNECTIVITY = new Set(["wifi", "cellular"]);
const DISC = new Set(["disc", "digital", "na"]);
// MacBook "anything off with it?": ok | batt (below 80% / service warning) |
// chrg (no charger) | both.
const EXTRAS = new Set(["ok", "batt", "chrg", "both"]);

// Display strings for the lead body. The admin margin recompute feeds the
// Condition string through resellMultiplierForCondition()'s substring
// match, so "Fair (some wear)" MUST contain "fair" and the broken tier
// "crack"/"broken" — a bare "some wear" would silently price at the 1.0
// mint tier.
export const CONDITION_DISPLAY: Record<string, string> = {
  sealed: "Sealed in box", mint: "Like new", good: "Good",
  fair: "Fair (some wear)", broken: "Cracked / broken",
};
export const CARRIER_DISPLAY: Record<string, string> = {
  unlocked: "Unlocked", att: "AT&T", tmobile: "T-Mobile", verizon: "Verizon", other: "Other",
  unknown: "Not sure (priced as carrier-locked)",
};
export const STORAGE_DISPLAY: Record<string, string> = {
  "64": "64GB", "128": "128GB", "256": "256GB", "512": "512GB", "1tb": "1TB", "2tb": "2TB", "4tb": "4TB", "8tb": "8TB",
};

export type GoSpec = {
  entry: BoardModel;
  storage: string;
  condition: string;
  // carrier (phone) | connectivity (ipad) | disc (console) | proc+mem+extras (macbook)
  secondary: string;
  quote: QuoteSpec;
  mult: number;
  bonus: number;
  mac?: { processor: string; memory: string; battery: MacBattery; charger: MacCharger };
  // "iPad Air 11\" M3 256 mint cellular" — notes, CAPI, owner alert.
  specLine: string;
  display: {
    storage: string;
    condition: string;
    secondaryKey: "Carrier" | "Connectivity" | "Edition" | "Chip" | null;
    secondaryValue: string;
    notes?: string;
  };
  // Lead-body bucket ("Device: <type> — <label>"); analytics groups on it.
  deviceType: string;
};

export type GoSpecInput = {
  model?: unknown; storage?: unknown; condition?: unknown; carrier?: unknown; opt?: unknown;
  processor?: unknown; memory?: unknown; extras?: unknown;
};

export function resolveGoSpec(input: GoSpecInput): { ok: true; spec: GoSpec } | { ok: false; error: string } {
  const model = String(input.model || "");
  const entry = BOARD_BY_ID.get(model);
  if (!entry) return { ok: false, error: "unknown model" };
  const storage = String(input.storage || "");
  const condition = String(input.condition || "");
  if (!GO_CONDITIONS.has(condition)) return { ok: false, error: "bad spec" };
  const condDisplay = CONDITION_DISPLAY[condition] || condition;

  if (entry.cat === "macbook") {
    const o = macOptions(model);
    const processor = String(input.processor || "");
    const memory = String(input.memory || "");
    const extras = String(input.extras || "ok");
    const p = o?.processor.find((x) => x.id === processor);
    const m = o?.memory.find((x) => x.id === memory);
    const s = o?.storage.find((x) => x.id === storage);
    if (!o || !p || !m || !s || !EXTRAS.has(extras)) return { ok: false, error: "bad spec" };
    const battery: MacBattery = extras === "batt" || extras === "both" ? "poor" : "good";
    const charger: MacCharger = extras === "chrg" || extras === "both" ? "no" : "yes";
    const procLabel = p.sub ? `${p.label} (${p.sub})` : p.label;
    const notes = [battery === "poor" ? "battery below 80% / service warning" : "", charger === "no" ? "no charger" : ""].filter(Boolean).join(", ");
    return {
      ok: true,
      spec: {
        entry, storage, condition, secondary: `${processor}+${memory}+${extras}`,
        quote: { modelId: model, modelLabel: entry.label, storage, condition },
        mult: 1,
        bonus: 0,
        mac: { processor, memory, battery, charger },
        specLine: `${entry.label} ${p.label} ${m.label} ${s.label} ${condition}${extras !== "ok" ? ` ${extras}` : ""}`,
        display: { storage: s.label, condition: condDisplay, secondaryKey: "Chip", secondaryValue: `${procLabel} · ${m.label}`, ...(notes ? { notes } : {}) },
        deviceType: "macbook",
      },
    };
  }

  // Object.hasOwn: a truthy in-lookup would accept inherited keys
  // ("constructor", "__proto__", …) as storage names.
  if (!Object.hasOwn(PRICE_TABLE[model] || {}, storage)) return { ok: false, error: "bad spec" };
  const storageDisplay = entry.storageLabels?.[storage] ?? STORAGE_DISPLAY[storage] ?? (storage === "base" ? "Standard" : storage);
  const base = { modelId: model, modelLabel: entry.label, storage, condition };

  if (entry.cat === "phone") {
    // Phones read `carrier`; `opt` is the other categories' field (the
    // client sends both shapes across bundle versions).
    const carrier = String(input.carrier ?? input.opt ?? "");
    if (!GO_CARRIERS.has(carrier)) return { ok: false, error: "bad spec" };
    return {
      ok: true,
      spec: {
        entry, storage, condition, secondary: carrier,
        quote: {
          ...base,
          // "unknown" = the seller isn't sure: priced at the AT&T tier (the
          // middle of the locked gaps). The floor tier ("other" — prepaid
          // carriers) was tried and turned a $450 16 Pro Max into $98, which
          // loses the seller outright; instead the on-page note says plainly
          // that unlocked/AT&T/T-Mobile hold or rise at inspection and prepaid
          // carriers come in lower (review 2026-09-11).
          carrier: carrier === "unknown" ? "att" : carrier,
          // "locked to a carrier" answered "verizon" = a Verizon-locked phone.
          carrierLocked: carrier === "verizon",
          isPhone: true,
        },
        mult: 1,
        bonus: 0,
        specLine: `${entry.label} ${storage} ${condition} ${carrier}`,
        display: { storage: storageDisplay, condition: condDisplay, secondaryKey: "Carrier", secondaryValue: CARRIER_DISPLAY[carrier] || carrier },
        deviceType: model.startsWith("ip") ? "iphone" : model.startsWith("px") ? "pixel" : "android",
      },
    };
  }
  // Non-phones read `opt`; older bundles sent it as `carrier`.
  const secondary = String(input.opt ?? input.carrier ?? "");
  if (entry.cat === "ipad") {
    if (!CONNECTIVITY.has(secondary)) return { ok: false, error: "bad spec" };
    const cellular = secondary === "cellular";
    return {
      ok: true,
      spec: {
        entry, storage, condition, secondary,
        // isPhone false: the +$25 is added in goQuote AFTER the ×1.15, the
        // homepage's order (multiplier, then popular-device bonus, then cap).
        quote: { ...base, isPhone: false },
        mult: cellular ? CELLULAR_MULT : 1,
        bonus: cellular ? CELLULAR_BONUS : 0,
        specLine: `${entry.label} ${storage} ${condition} ${secondary}`,
        display: { storage: storageDisplay, condition: condDisplay, secondaryKey: "Connectivity", secondaryValue: cellular ? "Wi-Fi + Cellular" : "Wi-Fi only" },
        deviceType: "ipad",
      },
    };
  }
  // console
  const disc = entry.steps.includes("disc") ? secondary : "na";
  if (!DISC.has(disc)) return { ok: false, error: "bad spec" };
  const digital = disc === "digital";
  return {
    ok: true,
    spec: {
      entry, storage, condition, secondary: disc,
      quote: { ...base, isPhone: false },
      mult: digital ? DIGITAL_MULT : 1,
      bonus: 0,
      specLine: `${entry.label}${storage === "base" ? "" : ` ${storage}`} ${condition}${disc === "na" ? "" : ` ${disc}`}`,
      display: {
        storage: storageDisplay,
        condition: condDisplay,
        secondaryKey: disc === "na" ? null : "Edition",
        secondaryValue: digital ? "Digital (no disc drive)" : "Disc",
      },
      deviceType: "console",
    },
  };
}

// The engine call, with the category multiplier/bonus applied. null = no
// instant number (manual review, below the minimum, engine down).
export async function goQuote(spec: GoSpec): Promise<number | null> {
  const overrides = await cachedOverrides();
  if (spec.entry.cat === "macbook") {
    if (!spec.mac) return null;
    const r = quoteMacBook({ modelId: spec.entry.id, ...spec.mac, storage: spec.storage, condition: spec.condition }, overrides);
    return r.ok ? r.offer : null;
  }
  const r = await quoteDevice(spec.quote, overrides).catch(() => null);
  if (!r) return null;
  if (spec.entry.cat === "phone") {
    return r.offer != null && !r.manualReview ? r.offer : null;
  }
  // iPads / consoles: rebuild the homepage's order from the engine's own
  // breakdown — multiplier and bonus on the RAW cell, THEN the margin cap,
  // THEN the minimum check. Applying the multiplier to the engine's already
  // capped/min-checked offer under-quoted every capped PS5 cell by $12-21
  // and sent a $35 broken cellular iPad to manual review (review 2026-09-11).
  const b = r.breakdown;
  if (!b) return null;
  const pre = Math.round(b.rawQuote * spec.mult) + spec.bonus;
  const capped = b.marginCap != null ? Math.min(pre, b.marginCap) : pre;
  const final = capped + (b.sealedPremium || 0);
  if (final < MIN_OFFER || (b.marginCap != null && b.marginCap < MIN_OFFER)) return null;
  return final;
}
