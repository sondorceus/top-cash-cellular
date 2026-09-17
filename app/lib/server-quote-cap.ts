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
import { quoteDevice, normalizeStorage, canonicalCondition, canonicalCarrier, carrierLockedFromText, type PriceOverrides } from "./quote";
import { PRICE_TABLE, MANUAL_REVIEW_DEVICES, type MacSpecOption } from "../data/prices";
import { macIsAutoQuotable, macOptions, quoteMacBook } from "./macbook-quote";
import { BOARD_MODELS } from "../go/board";
import { iwmRuleCeiling } from "./resell-estimates";

const SKU_LABELS = skuLabelsJson as Record<string, string>;

// label (normalized) → model id. sku-labels values are unique (verified —
// scripts/check-bot-parity.ts fails the build otherwise); PRICE_TABLE ids
// double as their own aliases so device strings that already carry an id
// resolve too.
const LABEL_TO_ID: Record<string, string> = {};
const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();
for (const [id, label] of Object.entries(SKU_LABELS)) {
  LABEL_TO_ID[norm(label)] = id;
  LABEL_TO_ID[id] = id;
}
// /go leads carry the board's label, which can differ from the homepage one
// ("PlayStation 4" vs "PlayStation 4 (Standard)") — an unresolved /go line
// had no ceiling and forced every offer-page edit into manual review. Board
// labels only fill gaps; they never re-point a label sku-labels already owns.
for (const m of BOARD_MODELS) {
  const k = norm(m.label);
  if (!(k in LABEL_TO_ID)) LABEL_TO_ID[k] = m.id;
}

export function resolveModelIdFromLabel(label: unknown): string | null {
  if (typeof label !== "string" || !label.trim()) return null;
  return LABEL_TO_ID[norm(label)] ?? null;
}

// Lead label → condition / carrier id mapping lives in quote-engine.ts (the
// offer page's edit preview uses the same one).
export { canonicalCondition };

export type LeadLineSpec = {
  model?: unknown;
  condition?: unknown;
  carrier?: unknown;
  carrierLock?: unknown;
  storage?: unknown;
  brokenGlass?: unknown;
  // MacBook chip / RAM as the funnel labels them ("M4 Pro", "24 GB") — the
  // additive cap prices THIS config (see macBookLineCap).
  processor?: unknown;
  memory?: unknown;
};

/**
 * Per-unit ceiling for one lead line, or null when we can't price it
 * server-side. Pass the overrides from ONE readPriceOverrides() call so a
 * multi-device cart doesn't re-read the blob per line.
 */
export async function authoritativeLineCap(line: LeadLineSpec, overrides: PriceOverrides): Promise<number | null> {
  const id = resolveModelIdFromLabel(line.model);
  if (!id) return null;
  if (MANUAL_REVIEW_DEVICES.has(id)) return null;
  // Additively priced MacBooks: the homepage (useAdditive) and /go price
  // chip + RAM + storage, but their PRICE_TABLE rows are stale BASE-CHIP
  // leftovers — capping from them clamped an honest M4 Max 2TB ($2,880) to
  // $1,216 and flagged it as tampering. Ceiling = the chip + memory the
  // customer claimed at their storage/condition (nano glass on, battery
  // fine, charger in); lines without a resolvable chip/RAM get the TOP
  // config — callers flag those (macSpecUnclaimed).
  if (macIsAutoQuotable(id)) return macBookLineCap(id, line, overrides);
  const glass = line.brokenGlass === "front" || line.brokenGlass === "back" || line.brokenGlass === "both" ? line.brokenGlass : null;
  const carrierLocked = carrierLockedFromText(line.carrierLock);
  const cond = canonicalCondition(line.condition);
  const quoteAt = (storage: string | undefined, condition = cond, unlocked = false) => quoteDevice({
    modelId: id,
    modelLabel: SKU_LABELS[id],
    storage,
    condition,
    carrier: unlocked ? "unlocked" : canonicalCarrier(line.carrier),
    carrierLocked: unlocked ? false : carrierLocked,
    // Phones + cellular iPads earn the +$25 bonus; granting it to every
    // PRICE_TABLE device only LOOSENS the ceiling by $25 — acceptable
    // inside the headroom, and it can never false-flag an honest quote.
    isPhone: true,
    brokenGlass: glass,
  }, overrides).catch(() => null);
  const storageTxt = typeof line.storage === "string" && line.storage.trim() ? line.storage : undefined;
  const r = await quoteAt(storageTxt);
  let offer = r?.offer ?? null;
  // Storage that matched no cell meant NO ceiling — a hand-posted lead could
  // drop the field ("iPhone 17 Pro Max", no storage), garble it ("2 TB
  // (unlocked)") or name a tier the row lacks, and post any price. Fall back
  // to the model's best cell for this condition/carrier, a ceiling no honest
  // config of the model can exceed, when:
  //  - the text is there but isn't a tier (also /go's edition chips,
  //    "Standard" / "512 GB (white)"), or a tier no phone funnel offers
  //    ("4 TB"), or
  //  - it's missing on a phone / iPad — every funnel asks their storage.
  //    Consoles, watches etc. are priced without it (xsx has no base row:
  //    the homepage prices it off base × extras, which cells can't bound).
  //    The homepage cart's "N/A" for those devices counts as missing, not
  //    garbled — a cell ceiling clamped honest DJI Fly More / Garmin
  //    edition cart lines and flagged the whole cart.
  // A clean tier a non-phone row lacks still gets no ceiling.
  const phoneLike = /^(ip|gs|gz|px|gnote)/.test(id);
  const given = !!storageTxt && !/^(n\/?a|none|-+)$/i.test(storageTxt.trim());
  const tier = normalizeStorage(storageTxt) ?? "";
  const funnelTier = phoneLike ? PHONE_TIERS.has(tier) : /^\d+(tb)?$/.test(tier);
  const unparsed = given ? !funnelTier : phoneLike;
  // A phone funnel tier with no cell ("128 GB" on the 256-up iPhone Duo row
  // — the homepage offers all six tiers to models missing from its
  // STORAGE_MAP) is priced off base × multipliers with NO flat carrier gap,
  // capped only by the IWM rule. So bound it by the best UNLOCKED cell for
  // the condition, or that rule ceiling when higher (a tier above the row's
  // top: Fold 8 2 TB); broken there is a manual quote whose number still
  // posts — bound it by the best sealed cell.
  const offRow = given && funnelTier && phoneLike;
  if (r && r.offer == null && r.source !== "price-table" && (unparsed || offRow)) {
    const keys = new Set([...Object.keys(PRICE_TABLE[id] ?? {}), ...Object.keys(overrides.priceTable?.[id] ?? {})]);
    for (const k of keys) {
      const alt = offRow ? await quoteAt(k, cond === "broken" ? "sealed" : cond, true) : await quoteAt(k);
      if (alt?.offer != null && (offer == null || alt.offer > offer)) offer = alt.offer;
    }
    const rule = offRow && cond !== "broken" ? iwmRuleCeiling({ modelId: id, storage: tier, condition: cond }) : null;
    if (rule != null && (offer == null || rule > offer)) offer = rule;
  }
  if (offer == null) return null;
  // iPads: the funnel stacks funnel-only multipliers quoteDevice omits —
  // cellular ×1.15 and Apple Pencil Pro ×1.07 (app/page.tsx CONNECTIVITY /
  // BRAND_EXTRAS.ipad), asked even on sealed units. 22% missed the top
  // sealed 13" M5 2TB cellular + Pencil Pro by $6 and fraud-flagged it; the
  // headroom now covers the whole stack (+1 absorbs the funnel's rounding).
  const headroom = id.startsWith("ipad")
    ? Math.round(offer * (IPAD_FUNNEL_STACK - 1)) + 1
    : Math.round(offer * 0.10);
  return offer + Math.max(60, headroom);
}

// Top of the iPad funnel's multiplier stack: cellular × Apple Pencil Pro.
const IPAD_FUNNEL_STACK = 1.15 * 1.07;
// The storage tiers the phone / iPad funnels offer (homepage ALL_STORAGES,
// /go rows) — the only keys phone and iPad rows carry besides a few
// legacy "base" rows.
const PHONE_TIERS = new Set(["64", "128", "256", "512", "1tb", "2tb"]);
// The homepage's MacBook accessory bonus (accessoryBonusAmount).
const MAC_ACCESSORY_BONUS = 30;

const topOption = (list: MacSpecOption[]) => list.reduce((a, b) => ((b.adj ?? 0) > (a.adj ?? 0) ? b : a), list[0]);

// The priced option a funnel label names, or null. Chip labels repeat across
// core counts ("M4 Pro" = 12- and 14-core), so the priciest match bounds it.
function claimedOption(list: MacSpecOption[], label: unknown): MacSpecOption | null {
  const t = typeof label === "string" ? norm(label) : "";
  const hits = t ? list.filter((o) => norm(o.label) === t) : [];
  return hits.length ? topOption(hits) : null;
}

/**
 * True for an auto-priced MacBook line whose chip or RAM label is missing or
 * unknown — its ceiling assumed the model's top config, far above a base
 * machine's price. The funnel always sends both, so callers flag these for a
 * hand check instead of trusting that ceiling.
 */
export function macSpecUnclaimed(line: LeadLineSpec): boolean {
  const id = resolveModelIdFromLabel(line.model);
  if (!id || MANUAL_REVIEW_DEVICES.has(id) || !macIsAutoQuotable(id)) return false;
  const o = macOptions(id);
  if (!o) return false;
  return !claimedOption(o.processor, line.processor) || !claimedOption(o.memory, line.memory);
}

function macBookLineCap(id: string, line: LeadLineSpec, overrides: PriceOverrides): number | null {
  const o = macOptions(id);
  if (!o || !o.processor.length || !o.memory.length || !o.storage.length) return null;
  // Storage the customer chose, by id or label ("2 TB" → "2tb"); anything
  // unrecognized takes the top tier (a looser ceiling, never a false flag).
  const want = normalizeStorage(typeof line.storage === "string" ? line.storage : undefined);
  const storage = (want && o.storage.find((s) => s.id === want || normalizeStorage(s.label) === want)) || topOption(o.storage);
  // Same for chip + RAM: the top-config ceiling let a base machine post a
  // Max-chip price unflagged, so price the config the lead claims — a
  // tamperer then has to write a false chip into the lead, which inspection
  // catches. No/unknown label (offer-page edits, /api/confirm) → top.
  const topProc = topOption(o.processor), topMem = topOption(o.memory);
  const processor = claimedOption(o.processor, line.processor) || topProc;
  const memory = claimedOption(o.memory, line.memory) || topMem;
  const cond = canonicalCondition(line.condition);
  const priced = (p: MacSpecOption, m: MacSpecOption) => {
    const at = (condition: string) => quoteMacBook({
      modelId: id,
      processor: p.id,
      memory: m.id,
      storage: storage.id,
      condition,
      nano: true,
    }, overrides);
    const r = at(cond);
    // Unpriced broken goes to review, but the homepage still submits its
    // number — computed at the MINT adjustment (MCOND has no broken key). So
    // bound it by the sealed ceiling rather than leave the line uncapped.
    return !r.ok && cond === "broken" ? at("sealed") : r;
  };
  let r = priced(processor, memory);
  // A claimed config that can't be priced (under MIN_OFFER) must not drop
  // the ceiling altogether — bound it by the top config instead.
  if (!r.ok && (processor !== topProc || memory !== topMem)) r = priced(topProc, topMem);
  if (!r.ok) return null;
  return r.offer + MAC_ACCESSORY_BONUS + Math.max(60, Math.round(r.offer * 0.10));
}
