"use client";

// The offer page's device editor — one row's Condition / Storage / Quantity
// drafts and the live re-quote preview. Split out of page.tsx (loaded there
// with next/dynamic, ssr:false) so the pricing engine and the bundled price
// table only download on the first Edit click, not with every receipt view.
// The behaviour is the editor's as it lived in the page, plus two changes of
// the same date: the quantity list stops at the line's current quantity (the
// items route refuses any raise — see the comment at the select), and the
// labels / error text carry their a11y attributes. 2026-09-25.

import { useState } from "react";
import { REQUOTE_CONDITIONS, REQUOTE_STORAGE, matchTier, requote } from "../../lib/requote";
import { PRICE_TABLE } from "../../data/prices";
import skuLabelsJson from "../../data/sku-labels.json";
import { quoteDeviceSync, EMPTY_OVERRIDES, normalizeStorage, canonicalCondition, canonicalCarrier } from "../../lib/quote-engine";

// A device row in the editable Offer-items list (normalized from the
// offer's multi-device array or its single-device fields).
export type EditItem = { model: string; storage: string; condition: string; quote: number; quantity: number; needsReview: boolean };

// Reverse model-label → SKU map so the offer-page re-quote can run the
// pricing engine for the edited condition/storage instead of only scaling
// by tier ratios. Built once.
const SKU_LABELS = skuLabelsJson as Record<string, string>;
const SKU_BY_LABEL: Record<string, string> = Object.fromEntries(
  Object.entries(SKU_LABELS).map(([sku, label]) => [label.toLowerCase().trim(), sku]),
);
// Per-unit re-quote for an edited config, or null when the engine can't
// auto-quote the old or new config (unknown SKU, MacBook, custom/inquiry
// device, manual-review or sub-minimum config) — caller then falls back to
// the ratio re-quote.
//
// Runs the server's own engine (quote-engine.ts: carrier gap, +$25 bonus,
// margin cap, Galaxy drop, IWM ceiling) at the bundled prices the homepage
// shows, then moves the line's CURRENT offer by the engine's step between
// the old and new configs — so what the engine doesn't see (live admin
// overrides, the accessory / promo bonuses, an iPad's cellular or Pencil
// multiplier) carries over: a $ step for phones (flat extras), a ratio for
// everything else (multipliers). Reverting returns the original exactly.
// The old bare-cell lookup skipped the carrier gap and caps: an AT&T
// iPhone 13 Excellent $128 → Good previewed the unlocked $145 and the
// server refused the save ("An edit can only lower your estimate").
function tableRequote(
  modelLabel: string,
  lead: { carrier?: string; carrierLocked?: boolean },
  from: { storage: string; condition: string; perUnit: number },
  toStorage: string,
  toCondition: string,
): number | null {
  const sku = SKU_BY_LABEL[(modelLabel || "").toLowerCase().trim()];
  const row = sku ? PRICE_TABLE[sku] : undefined;
  if (!sku || !row) return null;
  const phone = /^(ip(?!ad)|gs|gz|px|gnote)/.test(sku);
  const carrier = phone ? canonicalCarrier(lead.carrier) : undefined;
  const offer = (storageLabel: string, conditionLabel: string, locked: boolean): number | null => {
    if (!conditionLabel?.trim()) return null;
    // "256 GB" / /go's "256GB"; rows keyed by edition fall back to base.
    const tier = matchTier(REQUOTE_STORAGE, storageLabel)?.id ?? normalizeStorage(storageLabel);
    const storage = tier && row[tier] ? tier : row.base ? "base" : null;
    if (!storage) return null;
    const r = quoteDeviceSync({
      modelId: sku,
      modelLabel: SKU_LABELS[sku],
      storage,
      condition: canonicalCondition(conditionLabel),
      carrier,
      carrierLocked: locked,
      isPhone: phone,
    }, EMPTY_OVERRIDES);
    return !r.manualReview && r.offer != null && r.offer > 0 ? r.offer : null;
  };
  // Verizon's price hangs on the lock answer, and a 17 / 18 Pro's locked gap
  // moves with condition — stepping a LOCKED line by the unlocked step saved
  // an honest 17 Pro Max 2 TB Sealed $1,040 → Excellent edit at $542 (engine:
  // $927). Use the lead's answer; when it doesn't say (a cart line), the
  // state whose old-config price sits strictly nearer the line's offer —
  // unlocked on a tie (a sealed 17 Pro 256 GB prices the same either way)
  // or with no offer to compare. Only Verizon reads the flag.
  let locked = lead.carrierLocked ?? false;
  if (carrier === "verizon" && lead.carrierLocked == null && from.perUnit > 0) {
    const wl = offer(from.storage, from.condition, true);
    const wu = offer(from.storage, from.condition, false);
    locked = wl != null && (wu == null || Math.abs(wl - from.perUnit) < Math.abs(wu - from.perUnit));
  }
  const to = offer(toStorage, toCondition, locked);
  if (to == null) return null;
  // No current offer to anchor on (a manual-review line) — the engine's.
  if (!(from.perUnit > 0)) return to;
  const was = offer(from.storage, from.condition, locked);
  if (was == null) return null;
  // Unrounded: the caller rounds after × quantity, so a $255 ×2 line
  // reverts to $255, not 2 × $128.
  const v = phone ? from.perUnit + (to - was) : from.perUnit * (to / was);
  return v > 0 ? v : null;
}

type Props = {
  item: EditItem;
  // Row index — only for stable label/control ids.
  index: number;
  // The lead's carrier + Verizon lock answer, as the server's line cap reads them.
  lead: { carrier?: string; carrierLocked?: boolean };
  saving: boolean;
  error: string;
  onSave: (next: EditItem) => void;
  onCancel: () => void;
};

export default function EditItemPanel({ item: it, index, lead, saving, error, onSave, onCancel }: Props) {
  // Drafts start from the row — the same normalisation the page's Edit
  // click used to do.
  const [draftCondition, setDraftCondition] = useState(() => matchTier(REQUOTE_CONDITIONS, it.condition)?.label || it.condition || REQUOTE_CONDITIONS[1].label);
  const [draftStorage, setDraftStorage] = useState(() => matchTier(REQUOTE_STORAGE, it.storage)?.label || it.storage || "");
  const [draftQuantity, setDraftQuantity] = useState(it.quantity > 0 ? it.quantity : 1);
  // Functional state when a device is edited to "Broken": true =
  // still works (auto-priced), false = won't power on (manual review),
  // null = not yet answered.
  const [draftFunctional, setDraftFunctional] = useState<boolean | null>(null);

  // Prefer the engine step from this line's own offer (see tableRequote);
  // fall back to ratio scaling when the engine can't answer. Carrier = the
  // lead's, as the server's line cap reads it, with its Verizon lock.
  const liveQuote = (() => {
    const perUnit = tableRequote(
      it.model,
      lead,
      { storage: it.storage, condition: it.condition, perUnit: it.quote / (it.quantity > 0 ? it.quantity : 1) },
      draftStorage,
      draftCondition,
    );
    if (perUnit != null) return Math.round(perUnit * draftQuantity);
    return Math.round(requote({
      originalQuote: it.quote,
      fromCondition: it.condition, toCondition: draftCondition,
      fromStorage: it.storage, toStorage: draftStorage,
    }) * (it.quantity > 0 ? draftQuantity / it.quantity : 1));
  })();
  const draftBroken = matchTier(REQUOTE_CONDITIONS, draftCondition)?.id === "broken";
  // Broken + not functional → no auto price, goes to manual review.
  const draftNeedsReview = draftBroken && draftFunctional === false;
  const condOpts = (() => {
    const labels = REQUOTE_CONDITIONS.map((t) => t.label);
    return draftCondition && !labels.includes(draftCondition) ? [draftCondition, ...labels] : labels;
  })();
  const storeOpts = (() => {
    const labels = REQUOTE_STORAGE.map((t) => t.label);
    return draftStorage && !labels.includes(draftStorage) ? [draftStorage, ...labels] : labels;
  })();
  const condId = `offer-cond-${index}`;
  const storeId = `offer-store-${index}`;
  const qtyId = `offer-qty-${index}`;

  return (
    <div className="mt-3 pt-3 border-t border-white/10">
      {/* Warning — pops the moment the editor opens. */}
      <div className="bg-amber-500/10 border border-amber-500/40 rounded-lg p-2.5 mb-3 flex items-start gap-2">
        <svg aria-hidden="true" className="w-4 h-4 shrink-0 text-amber-300 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
        <p className="text-amber-200/90 text-[11px] leading-relaxed">
          This updates your <span className="font-bold">estimate</span> only. Your final price is confirmed when we inspect the device — change this just to match its real condition.
        </p>
      </div>
      <label htmlFor={condId} className="block text-[10px] font-bold uppercase tracking-wider text-[#888] mb-1">Condition</label>
      <select
        id={condId}
        value={draftCondition}
        onChange={(e) => setDraftCondition(e.target.value)}
        className="w-full px-3 py-2 mb-3 bg-black/40 border border-white/15 rounded-lg text-sm text-white focus:outline-none focus:border-[#00c853]"
      >
        {condOpts.map((c) => <option key={c} value={c}>{c}</option>)}
      </select>
      {/* Broken devices: ask if it still works. Functional →
          auto-priced; not functional → manual review. */}
      {draftBroken && (
        <div className="mb-3">
          <label className="block text-[10px] font-bold uppercase tracking-wider text-[#888] mb-1">Does the device still power on &amp; work?</label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setDraftFunctional(true)}
              className={`px-2.5 py-2 rounded-lg border text-xs font-bold transition cursor-pointer ${draftFunctional === true ? "bg-[#00c853]/15 border-[#00c853]/50 text-white" : "bg-black/40 border-white/15 text-[#bdbdbd] hover:bg-white/5"}`}
            >
              Yes — it works
            </button>
            <button
              type="button"
              onClick={() => setDraftFunctional(false)}
              className={`px-2.5 py-2 rounded-lg border text-xs font-bold transition cursor-pointer ${draftFunctional === false ? "bg-amber-500/20 border-amber-500/60 text-white" : "bg-black/40 border-white/15 text-[#bdbdbd] hover:bg-white/5"}`}
            >
              No — won&apos;t power on
            </button>
          </div>
        </div>
      )}
      {!!it.storage && (
        <>
          <label htmlFor={storeId} className="block text-[10px] font-bold uppercase tracking-wider text-[#888] mb-1">Storage</label>
          <select
            id={storeId}
            value={draftStorage}
            onChange={(e) => setDraftStorage(e.target.value)}
            className="w-full px-3 py-2 mb-3 bg-black/40 border border-white/15 rounded-lg text-sm text-white focus:outline-none focus:border-[#00c853]"
          >
            {storeOpts.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </>
      )}
      {/* Quantity can only come DOWN here: the items route rejects any edit
          that raises the estimate, so the old 1–10 list dead-ended in
          "An edit can only lower your estimate…". Extra units go through
          the funnel's add-to-order flow (the button under the list), which
          trusts a new priced line. Hidden entirely for a single unit. */}
      {it.quantity > 1 && (
        <>
          <label htmlFor={qtyId} className="block text-[10px] font-bold uppercase tracking-wider text-[#888] mb-1">Quantity</label>
          <select
            id={qtyId}
            value={draftQuantity}
            onChange={(e) => setDraftQuantity(parseInt(e.target.value, 10) || 1)}
            className="w-full px-3 py-2 mb-1 bg-black/40 border border-white/15 rounded-lg text-sm text-white focus:outline-none focus:border-[#00c853]"
          >
            {Array.from({ length: it.quantity }, (_, n) => n + 1).map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </>
      )}
      <p className="text-[10px] text-[#888] mb-3">Adding units? Use <span className="text-[#00c853] font-semibold">+ Add another device</span> below — an edit here can only lower the estimate.</p>
      {draftBroken && draftFunctional === null ? (
        <div className="bg-white/[0.04] border border-white/10 rounded-lg px-3 py-2.5 mb-3">
          <p className="text-[11px] text-[#bdbdbd]">Tell us whether the device still works above to see your estimate.</p>
        </div>
      ) : draftNeedsReview ? (
        <div className="bg-amber-500/10 border border-amber-500/40 rounded-lg px-3 py-2.5 mb-3">
          <p className="text-amber-200 text-[11px] leading-relaxed">
            <span className="font-bold">A device that won&apos;t power on can&apos;t be auto-quoted.</span> We inspect these by hand — saving flags your offer for a manual re-quote, and your price is confirmed after we check the device.
          </p>
        </div>
      ) : (
        <div className="flex items-center justify-between bg-white/[0.04] rounded-lg px-3 py-2 mb-3">
          <span className="text-[11px] text-[#bdbdbd]">Updated estimate{draftQuantity > 1 ? ` (×${draftQuantity})` : ""}</span>
          <span className={`font-extrabold ${liveQuote === it.quote ? "text-white" : "text-[#00c853]"}`}>
            ${liveQuote.toLocaleString()}
          </span>
        </div>
      )}
      {error && <p role="alert" className="text-red-300 text-[11px] font-semibold mb-2">{error}</p>}
      <div className="flex gap-2">
        <button
          type="button"
          disabled={saving || (draftBroken && draftFunctional === null)}
          onClick={() => onSave({ ...it, condition: draftCondition, storage: draftStorage, quantity: draftQuantity, quote: draftNeedsReview ? 0 : liveQuote, needsReview: draftNeedsReview })}
          className="flex-1 px-3 py-2 bg-[#00c853] hover:bg-[#00e676] text-[#0a0a0a] rounded-lg text-xs font-extrabold cursor-pointer disabled:opacity-50 transition"
        >
          {saving ? "Saving…" : draftNeedsReview ? "Request manual review" : "Save changes"}
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={onCancel}
          className="px-3 py-2 bg-white/5 border border-white/15 rounded-lg text-xs font-semibold cursor-pointer disabled:opacity-50 transition"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
