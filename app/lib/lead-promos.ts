// QUOTE-STEP BONUSES A LEAD LINE MAY CARRY — the % coupon codes
// (public/coupons.json) and the weekly promo (public/promo.json).
//
// The homepage funnel folds both into a device's price only where they fit
// under the margin cap and IWM rule (owner 2026-09-16: no paying above the
// rule), and tags the line (promoCode / weeklyPromo) only when they added
// money. /api/lead then widens THAT line's tamper ceiling by exactly what
// these files allow for that device — never by a client-sent percent,
// amount or device type, so a forged code or claim widens nothing.
//
// The JSON is bundled from the same public/ files the funnel fetches, so both
// sides read one deployment's terms (and a protected preview can't fail a
// self-fetch and false-flag every promo lead).

import couponsJson from "../../public/coupons.json";
import promoJson from "../../public/promo.json";
import { resolveModelIdFromLabel, type LeadLineSpec } from "./server-quote-cap";
import { canonicalCondition, normalizeStorage } from "./quote-engine";
import { iwmRuleCeiling, marginCapFor } from "./resell-estimates";
import { macIsAutoQuotable } from "./macbook-quote";

export type CouponTable = Record<string, { percent?: unknown; active?: unknown } | undefined>;
export type WeeklyPromo = { active?: unknown; percent?: unknown; flatBonus?: unknown; appliesTo?: unknown; minQuantity?: unknown };
export type PromoCode = { code: string; percent: number };
export type PromoTerms = { percent: number; flatBonus: number };
export type PromoLine = { model?: unknown; quantity?: unknown; weeklyPromo?: unknown } | null | undefined;

const COUPONS = couponsJson as CouponTable;
const PROMO = promoJson as WeeklyPromo;

// Defense in depth against a bad file edit — never widen a cap past these.
const MAX_PERCENT = 50;
const MAX_FLAT = 200;

const percentOf = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.min(n, MAX_PERCENT) : 0;
};

/** The active % code the customer typed, per coupons.json — else null. */
export function validPromoCode(code: unknown, table: CouponTable = COUPONS): PromoCode | null {
  if (typeof code !== "string") return null;
  const clean = code.trim().toUpperCase();
  if (!clean || clean.length > 40 || !Object.prototype.hasOwnProperty.call(table, clean)) return null;
  const row = table[clean];
  const percent = percentOf(row?.percent);
  return row?.active === true && percent > 0 ? { code: clean, percent } : null;
}

// promo.json `appliesTo` names a funnel device type. Decide a line's type
// from its MODEL (sku id), not the client's deviceType, so an iPhone-only
// promo can't widen a Galaxy line. A type missing here gets no widening —
// its models have no sku row, so no server ceiling to trip either.
const TYPE_BY_ID: Array<[string, RegExp]> = [
  ["iphone", /^ip(?!ad)/],
  ["ipad", /^ipad/],
  ["android", /^(gs\d|gz|gnote)/],
  ["pixel", /^px/],
  ["macbook", /^mb[ap]/],
  ["apple_desktop", /^(imac|macmini|macstudio|macpro)/],
  ["applewatch", /^aw/],
  ["pixelwatch", /^pw\d/],
  ["samsungwatch", /^sgw/],
  ["garmin", /^g(approach|descent|enduro|epix|fenix|forerunner|instinct|lily|marq|quatix|venu|vivoactive)/],
  ["dji", /^dji_/],
  ["samsung_tab", /^stabs/],
  ["apple_vr", /^avp/],
  ["meta_vr", /^mq/],
  ["sony", /^ps\d/],
  ["microsoft", /^x(one|ss|sx)/],
  ["nintendo", /^(switch|nsw)/],
];
// Labels outside sku-labels that the legacy resell cap still prices.
const TYPE_BY_LABEL: Array<[string, RegExp]> = [
  ["iphone", /^iphone\b/i],
  ["pixel", /^pixel \d/i],
];
const CONSOLE_TYPES = new Set(["sony", "microsoft", "nintendo"]);

export function promoDeviceType(model: unknown): string | null {
  const id = resolveModelIdFromLabel(model);
  if (id) return TYPE_BY_ID.find(([, re]) => re.test(id))?.[0] ?? null;
  if (typeof model !== "string") return null;
  return TYPE_BY_LABEL.find(([, re]) => re.test(model.trim()))?.[0] ?? null;
}

function promoCovers(appliesTo: unknown, model: unknown): boolean {
  if (appliesTo === "all") return true;
  if (typeof appliesTo !== "string") return false;
  const type = promoDeviceType(model);
  return !!type && (type === appliesTo || (appliesTo === "console" && CONSOLE_TYPES.has(type)));
}

/**
 * Weekly-promo terms the server honours for each line of ONE order (index-
 * aligned with `lines`), or null. A line needs the funnel's claim
 * (`weeklyPromo: true`), an active promo that covers its model, and — when
 * promo.json sets minQuantity — that many covered devices in the order.
 */
export function weeklyPromoTerms(lines: PromoLine[], promo: WeeklyPromo = PROMO): (PromoTerms | null)[] {
  const percent = percentOf(promo.percent);
  const flatN = Number(promo.flatBonus);
  const flatBonus = Number.isFinite(flatN) && flatN > 0 ? Math.min(Math.round(flatN), MAX_FLAT) : 0;
  const live = promo.active === true && (percent > 0 || flatBonus > 0);
  const covered = lines.map((l) => live && !!l && promoCovers(promo.appliesTo, l.model));
  const qty = (q: unknown) => Math.min(50, Math.max(1, Math.round(Number(q) || 1)));
  const coveredQty = lines.reduce((s, l, i) => s + (covered[i] ? qty(l?.quantity) : 0), 0);
  const minQ = Number(promo.minQuantity);
  const enough = !(Number.isFinite(minQ) && minQ > 1) || coveredQty >= minQ;
  return lines.map((l, i) => (covered[i] && enough && l?.weeklyPromo === true ? { percent, flatBonus } : null));
}

/**
 * How far the funnel lets quote-step bonuses lift one line (per unit). The
 * page prices them INSIDE the margin cap and the IWM rule, so where either
 * exists the line can't pass them (`room`). The % code only lifts up to
 * such a ceiling (owner 2026-09-16: no paying above the rule): an additive
 * MacBook (its formula IS IWM × 0.90) or a line with no ceiling gets no
 * code (`codeFits: false`), and the weekly promo keeps its full terms
 * there, as on the page. A label we can't resolve keeps the full terms.
 *
 * Looser than the page on purpose (unlocked and locked exits, the costliest
 * cracked-glass tier, best storage when none is given) so an honest line is
 * never under-roomed; a forged code or claim only buys room up to where
 * the page itself could have reached.
 */
export type PromoRoom = { codeFits: boolean; room: number | null };
export function promoRoom(line: LeadLineSpec): PromoRoom {
  const id = resolveModelIdFromLabel(line.model);
  if (!id) return { codeFits: true, room: null };
  if (macIsAutoQuotable(id)) return { codeFits: false, room: null };
  const tier = normalizeStorage(typeof line.storage === "string" ? line.storage : undefined);
  const storage = tier && /^\d+(tb)?$/.test(tier) ? tier : undefined;
  const condition = canonicalCondition(line.condition);
  const brokenGlass = line.brokenGlass === "front" || line.brokenGlass === "both" ? line.brokenGlass : "back";
  const label = typeof line.model === "string" ? line.model : null;
  const margin = (carrier: string) => marginCapFor({ modelId: id, label, condition, brokenGlass, carrier, carrierLocked: false, storage, carrierDeduction: 0 });
  const rule = iwmRuleCeiling({ modelId: id, storage, condition });
  // The rule and the margin cap both bind the page; the unlocked / locked
  // caps are alternatives, so take the looser of those.
  const caps = [margin("unlocked"), margin("att")].filter((n): n is number => n != null);
  const cap = caps.length ? Math.max(...caps) : null;
  if (rule == null && cap == null) return { codeFits: false, room: null };
  return { codeFits: true, room: rule != null && cap != null ? Math.min(rule, cap) : (rule ?? cap) };
}

/**
 * A per-unit tamper ceiling widened by the bonuses validated for the line:
 * the funnel multiplies the base by (1 + promo%) × (1 + code%) and adds the
 * promo's flat dollars, so the ceiling gets the same room — no more, and
 * never past `fit.room` (see promoRoom).
 */
export function widenUnitCap(unitCap: number, code: PromoCode | null, weekly: PromoTerms | null, fit?: PromoRoom): number {
  const pct = fit && !fit.codeFits ? 0 : (code?.percent ?? 0);
  const mult = (1 + pct / 100) * (1 + (weekly?.percent ?? 0) / 100);
  const widened = Math.round(unitCap * mult) + (weekly?.flatBonus ?? 0);
  return fit?.room != null ? Math.min(widened, Math.max(unitCap, fit.room)) : widened;
}

/** Staff-facing wording for validated weekly-promo terms. */
export function describeWeeklyPromo(t: PromoTerms): string {
  const parts: string[] = [];
  if (t.percent > 0) parts.push(`+${t.percent}%`);
  if (t.flatBonus > 0) parts.push(`+$${t.flatBonus}`);
  return parts.join(" & ");
}
