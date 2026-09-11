// Server-side MacBook pricing — a faithful port of the homepage funnel's
// additive path (app/page.tsx, `useAdditive` branch, ~5969-6009). Until
// 2026-09-11 that math existed ONLY in the browser: quoteDevice() punts every
// MacBook to manualReview ("additive path, v2"), so no server surface (/go,
// /api/quote, the chat tool) could name a MacBook number.
//
// The formula, dollar for dollar:
//   iwm   = chip.adj + memory.adj + storage.adj + condition + nano + battery + charger
//   offer = max(0, round(iwm × 0.90))
// with MCOND = { sealed:+50, mint:0, good:-110, fair:-220 } (no broken tier →
// manual), battery "poor" = -80, no charger = -50, nano-texture glass = +50
// (not asked on /go; standard glass assumed), admin conditionAdj overrides
// first, then a spec's own condition_adj, then MCOND. The homepage's promo /
// coupon / accessory multipliers are funnel-only and deliberately omitted.
//
// PARITY NOTE: the homepage does NOT consult MANUAL_REVIEW_DEVICES on this
// path (it prices mbp16m4 etc. directly), so neither does this — the /go page
// is the same self-serve funnel, not the bot. Change both or neither.
import { MACBOOK_SPECS, MIN_OFFER, type MacSpecOption } from "../data/prices";
import type { PriceOverrides } from "./quote";

export type MacCondition = "sealed" | "mint" | "good" | "fair";
export type MacBattery = "good" | "poor";
export type MacCharger = "yes" | "no";

const MCOND: Record<MacCondition, number> = { sealed: 50, mint: 0, good: -110, fair: -220 };
const ADDITIVE_MARGIN = 0.9;

export type MacQuoteInput = {
  modelId: string;
  processor: string; // MacSpecOption.id
  memory: string;
  storage: string;
  condition: string; // sealed|mint|good|fair; anything else → manual
  battery?: MacBattery;
  charger?: MacCharger;
  nano?: boolean;
};

export type MacQuoteResult =
  | { ok: true; offer: number; iwm: number }
  | { ok: false; reason: string };

// Only models whose processors carry IWM `adj` values price additively —
// the same test the homepage uses (procAdj != null && hasAdditiveSpecs).
export function macIsAutoQuotable(modelId: string): boolean {
  const s = MACBOOK_SPECS[modelId];
  return !!s && s.processors.some((p) => p.adj != null);
}

function pick(list: MacSpecOption[] | undefined, id: string): MacSpecOption | null {
  return (list || []).find((o) => o.id === id) ?? null;
}

export function macOptions(modelId: string): { processor: MacSpecOption[]; memory: MacSpecOption[]; storage: MacSpecOption[] } | null {
  const s = MACBOOK_SPECS[modelId];
  if (!s) return null;
  return {
    processor: s.processors.filter((p) => p.adj != null && !p.review),
    memory: s.memory.filter((m) => !m.review),
    storage: s.storage.filter((m) => !m.review),
  };
}

export function quoteMacBook(input: MacQuoteInput, overrides?: PriceOverrides | null): MacQuoteResult {
  const spec = MACBOOK_SPECS[input.modelId];
  if (!spec) return { ok: false, reason: "unknown MacBook" };
  const proc = pick(spec.processors, input.processor);
  const mem = pick(spec.memory, input.memory);
  const stor = pick(spec.storage, input.storage);
  if (!proc || proc.adj == null || !mem || !stor) return { ok: false, reason: "bad spec" };
  if (proc.review || mem.review || stor.review) return { ok: false, reason: "spec flagged for manual review" };
  const cond = input.condition;
  // Admin override layer first (the /admin/prices conditionAdj editor), then
  // the spec's scraped condition_adj, then the MacBook-calibrated MCOND.
  // "broken" has no MCOND entry, so it prices only when an admin override or
  // the spec provides a broken adjustment — the homepage's
  // isUnpricedAdditiveBroken behaves the same way; otherwise it's by hand.
  const ovMap = (overrides as { conditionAdj?: Record<string, Record<string, number>> } | null | undefined)?.conditionAdj?.[input.modelId];
  const overrideCond = ovMap && cond in ovMap ? ovMap[cond] : undefined;
  const specCond = spec.condition_adj && cond in spec.condition_adj ? spec.condition_adj[cond] : undefined;
  const mcond = cond in MCOND ? MCOND[cond as MacCondition] : undefined;
  const condAdj = overrideCond ?? specCond ?? mcond;
  if (condAdj === undefined) return { ok: false, reason: "broken MacBooks are priced by hand" };

  const battery = input.battery ?? "good";
  const charger = input.charger ?? "yes";
  const batt = spec.battery_adj ? (spec.battery_adj[battery] ?? spec.battery_adj["poor"] ?? 0) : battery === "poor" ? -80 : 0;
  const chrg = spec.charger_adj ? (spec.charger_adj[charger] ?? spec.charger_adj["no"] ?? 0) : charger === "no" ? -50 : 0;
  const nano = input.nano && spec.hasNanoGlass ? 50 : 0;

  const iwm = proc.adj + (mem.adj ?? 0) + (stor.adj ?? 0) + condAdj + nano + batt + chrg;
  const offer = Math.max(0, Math.round(iwm * ADDITIVE_MARGIN));
  if (offer < MIN_OFFER) return { ok: false, reason: "below the minimum offer" };
  return { ok: true, offer, iwm };
}

// The reachable ceiling for a model: top chip + top memory + top storage,
// sealed, battery fine, charger included. "up to" on the picker card.
export function macCeiling(modelId: string, overrides?: PriceOverrides | null): number {
  const o = macOptions(modelId);
  if (!o || !o.processor.length || !o.memory.length || !o.storage.length) return 0;
  const top = (list: MacSpecOption[]) => list.reduce((a, b) => ((b.adj ?? 0) > (a.adj ?? 0) ? b : a), list[0]);
  const r = quoteMacBook(
    { modelId, processor: top(o.processor).id, memory: top(o.memory).id, storage: top(o.storage).id, condition: "sealed" },
    overrides,
  );
  return r.ok ? r.offer : 0;
}
