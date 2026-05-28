"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import Image from "next/image";
import { REQUOTE_CONDITIONS, REQUOTE_STORAGE, matchTier, requote } from "../../lib/requote";
import { imageForModel } from "../../lib/device-images";
import { formatOfferNumber } from "../../lib/offer-number";
import { PRICE_TABLE } from "../../data/prices";
import skuLabelsJson from "../../data/sku-labels.json";

// Reverse model-label → SKU map so the offer-page re-quote can hit the
// absolute PRICE_TABLE (the funnel's source of truth) for the edited
// condition/storage instead of only scaling by tier ratios. Built once.
const SKU_BY_LABEL: Record<string, string> = Object.fromEntries(
  Object.entries(skuLabelsJson as Record<string, string>).map(([sku, label]) => [label.toLowerCase().trim(), sku]),
);
// Absolute per-unit price for an edited config, or null when the table
// can't answer (unknown SKU, custom/inquiry device, or a $0/broken cell)
// — caller then falls back to the ratio re-quote. The >0 guard keeps a
// broken/manual edit on the existing path (never surfaces a bare $0).
function tableRequote(modelLabel: string, storageLabel: string, conditionLabel: string): number | null {
  const sku = SKU_BY_LABEL[(modelLabel || "").toLowerCase().trim()];
  if (!sku) return null;
  const storeId = matchTier(REQUOTE_STORAGE, storageLabel)?.id ?? "base";
  const condId = matchTier(REQUOTE_CONDITIONS, conditionLabel)?.id;
  if (!condId) return null;
  const v = PRICE_TABLE[sku]?.[storeId]?.[condId] ?? PRICE_TABLE[sku]?.["base"]?.[condId];
  return typeof v === "number" && v > 0 ? v : null;
}

// /offer/[leadId] — the customer's offer-management page. Shown right
// after submit (replaces the bare "done" screen), linked from the
// account dashboard, and bookmarkable. Mirrors the IWM offer page
// pattern: prep checklist, print label, status, summary, contact.
// Skywalker 2026-05-19.
//
// Read-only for now. Modify / cancel / add-another-device require
// destructive admin-side workflows that aren't built — we surface a
// "Contact us to modify" CTA instead so the customer can email
// support@topcashcells.com.

type Offer = {
  found: boolean;
  id: string;
  timestamp: string;
  name?: string;
  phone?: string;
  email?: string;
  device?: string;
  model?: string;
  storage?: string;
  condition?: string;
  carrier?: string;
  quantity?: number;
  quote?: string;
  payout?: string;
  handoffMethod?: "ship" | "local";
  shipAddress?: string;
  localSlot?: string;
  devices?: Array<{ model: string; storage?: string; condition?: string; quote?: number; quantity?: number; needsReview?: boolean }>;
  deviceCount?: number;
  totalPayout?: number;
  status: string;
  statusAt?: string;
  fedexTracking?: string;
  fedexLabelUrl?: string;
  fedexService?: string;
  fedexErrorKind?: string;
  fedexErrorReason?: string;
  cancelled?: boolean;
  // Set when a customer edit marked a device broken — flagged for a
  // manual staff re-quote; the shown amounts are estimates only.
  needsReview?: boolean;
};

// A device row in the editable Offer-items list (normalized from the
// offer's multi-device array or its single-device fields).
type EditItem = { model: string; storage: string; condition: string; quote: number; quantity: number; needsReview: boolean };

// Shared funnel glyphs (Heroicons outline paths).
const INBOX_ICON = "M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z";
const TRUCK_ICON = "M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-14L4 7m8 4v10M4 7v10l8 4";
const SEARCH_ICON = "M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z";
const CASH_ICON = "M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z";
const MEETUP_ICON = "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z";

// Two funnels. Shipping has a transit leg the customer watches from
// afar (Shipped → Received); a local meetup has none — you hand the
// device over in person, so the funnel collapses to a single Met Up
// stage between Submitted and Paid. Skywalker 2026-05-22.
const SHIP_PIPELINE = [
  { value: "quote_requested", label: "Submitted", icon: INBOX_ICON },
  { value: "shipped", label: "Shipped", icon: TRUCK_ICON },
  { value: "received", label: "Received", icon: INBOX_ICON },
  { value: "tested", label: "Inspected", icon: SEARCH_ICON },
  { value: "paid", label: "Paid", icon: CASH_ICON },
];

// Local meetup funnel — three stages. "Met Up" is the in-person
// handoff (we inspect + pay cash on the spot); "met" is its terminal
// status, the local twin of "paid".
const LOCAL_PIPELINE = [
  { value: "quote_requested", label: "Submitted", icon: INBOX_ICON },
  { value: "received", label: "Met Up", icon: MEETUP_ICON },
  { value: "paid", label: "Paid", icon: CASH_ICON },
];

function pipelineFor(isShip: boolean) {
  return isShip ? SHIP_PIPELINE : LOCAL_PIPELINE;
}

// Map a backend status to its stage index in the relevant funnel.
// Statuses outside a funnel fold onto the nearest stage: "met"
// terminates either flow at Paid; for a local lead a "shipped" marker
// (used for a drop-off handoff) sits at the Met Up stage.
function statusIndex(s: string, isShip: boolean): number {
  if (s === "rejected") return -1;
  const pipeline = pipelineFor(isShip);
  if (s === "met") return pipeline.length - 1;
  // The local funnel has no transit or inspection stage — fold any
  // shipping-only status ("shipped", "received", "tested") onto the
  // in-person "Met Up" stage.
  if (!isShip && (s === "shipped" || s === "tested")) {
    return pipeline.findIndex((p) => p.value === "received");
  }
  return pipeline.findIndex((p) => p.value === s);
}

function fmtDate(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }) + ", " +
         d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

// Normalize an offer into the editable device list — multi-device
// offers map straight across; single-device offers become one row.
function buildItems(o: Offer): EditItem[] {
  if (o.devices && o.devices.length > 0) {
    return o.devices.map((d) => ({
      model: d.model || "Device",
      storage: d.storage || "",
      condition: d.condition || "",
      quote: typeof d.quote === "number" ? d.quote : 0,
      quantity: d.quantity && d.quantity > 0 ? d.quantity : 1,
      needsReview: !!d.needsReview,
    }));
  }
  const q = o.quote ? parseInt(o.quote.replace(/[^0-9]/g, ""), 10) || 0 : 0;
  return [{
    model: o.model || o.device || "Device",
    storage: o.storage || "",
    condition: o.condition || "",
    quote: o.totalPayout != null ? o.totalPayout : q,
    quantity: o.quantity && o.quantity > 0 ? o.quantity : 1,
    needsReview: false,
  }];
}

// A category glyph — fallback for the device thumbnail when there's
// no catalog photo (or the photo fails to load). Returns a Heroicons
// outline SVG path, wrapped in <svg> at the render site.
function deviceIcon(model: string): string {
  const m = model.toLowerCase();
  if (/macbook|laptop|imac|notebook/.test(m)) return "M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z";
  if (/ipad|tablet|galaxy tab|surface/.test(m)) return "M9 17.25h6M7.5 3.75h9a2.25 2.25 0 012.25 2.25v12a2.25 2.25 0 01-2.25 2.25h-9A2.25 2.25 0 015.25 18V6A2.25 2.25 0 017.5 3.75z";
  if (/watch/.test(m)) return "M12 8v4l2 2m-2-9.5V3m0 18v-1.5M16.5 6.5l1-3h-11l1 3m9 11l1 3h-11l1-3M19 12a7 7 0 11-14 0 7 7 0 0114 0z";
  if (/playstation|\bps5\b|\bps4\b|xbox|nintendo|switch/.test(m)) return "M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z M21 12a9 9 0 11-18 0 9 9 0 0118 0z";
  if (/airpod|earbud|buds|headphone/.test(m)) return "M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v3a3 3 0 01-3 3z";
  return "M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h5m0-16h2a2 2 0 012 2v0M11 5v16m0 0h2a2 2 0 002-2v0M15 13l3-3m0 0l3 3m-3-3v8";
}

// Device thumbnail — real product photo from the catalog when we have
// one, gracefully falling back to the category glyph.
function DeviceThumb({ model }: { model: string }) {
  const [broken, setBroken] = useState(false);
  const img = imageForModel(model);
  return (
    <div className="w-12 h-12 rounded-lg bg-[rgba(15,15,15,0.6)] border border-white/10 flex items-center justify-center overflow-hidden shrink-0">
      {img && !broken
        ? <Image src={img} alt={model} width={256} height={256} className="w-full h-full object-contain p-1" onError={() => setBroken(true)} />
        : <svg className="w-6 h-6 text-[#00c853]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d={deviceIcon(model)} />
          </svg>}
    </div>
  );
}

// Local-storage backed checklist state — per-lead so multiple offers
// in the same browser each keep their own progress.
function useChecklist(leadId: string, keys: string[]) {
  const storageKey = `tcc-checklist-${leadId}`;
  const [state, setState] = useState<Record<string, boolean>>({});
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) setState(JSON.parse(raw));
    } catch {}
  }, [storageKey]);
  const toggle = (k: string) => {
    setState((prev) => {
      const next = { ...prev, [k]: !prev[k] };
      try { localStorage.setItem(storageKey, JSON.stringify(next)); } catch {}
      return next;
    });
  };
  const allChecked = keys.every((k) => state[k]);
  return { state, toggle, allChecked };
}

export default function OfferPage({ params }: { params: Promise<{ leadId: string }> }) {
  const { leadId } = use(params);
  const [offer, setOffer] = useState<Offer | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [shareNotice, setShareNotice] = useState("");
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState("");
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false);
  const [cancelNote, setCancelNote] = useState("");
  // Price-match request — "Best Price Guarantee" customer-facing form.
  // Posts a [PRICE-MATCH-REQUEST:] MC marker for staff review; staff
  // honors via the existing counter-offer flow. Skywalker 2026-05-22.
  const [pmOpen, setPmOpen] = useState(false);
  const [pmCompetitor, setPmCompetitor] = useState("");
  const [pmAmount, setPmAmount] = useState("");
  const [pmUrl, setPmUrl] = useState("");
  const [pmNote, setPmNote] = useState("");
  const [pmSubmitting, setPmSubmitting] = useState(false);
  const [pmError, setPmError] = useState("");
  const [pmSubmitted, setPmSubmitted] = useState(false);
  // Phone-number editing — the only contact field the customer can
  // change themselves (name stays fixed; email is the account identity).
  const [editingPhone, setEditingPhone] = useState(false);
  const [phoneDraft, setPhoneDraft] = useState("");
  const [phoneSaving, setPhoneSaving] = useState(false);
  const [phoneError, setPhoneError] = useState("");
  const [phoneSaved, setPhoneSaved] = useState(false);
  // Editable device list (Offer items). Initialized from the offer once
  // it loads; edits re-quote by delta and persist via /api/offer/.../items.
  const [items, setItems] = useState<EditItem[]>([]);
  const [editIdx, setEditIdx] = useState<number | null>(null);
  const [draftCondition, setDraftCondition] = useState("");
  const [draftStorage, setDraftStorage] = useState("");
  const [draftQuantity, setDraftQuantity] = useState(1);
  // Functional state when a device is edited to "Broken": true =
  // still works (auto-priced), false = won't power on (manual review),
  // null = not yet answered.
  const [draftFunctional, setDraftFunctional] = useState<boolean | null>(null);
  const [savingItems, setSavingItems] = useState(false);
  const [itemsError, setItemsError] = useState("");
  const [itemsSaved, setItemsSaved] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/offer/${encodeURIComponent(leadId)}`, { cache: "no-store" })
      .then(async (r) => {
        if (cancelled) return;
        if (r.status === 404) { setError("We couldn't find this offer. Double-check the link."); setOffer(null); return; }
        // 502 means MC is briefly unavailable — soften the message so
        // the customer doesn't think their offer is lost.
        if (r.status === 502 || r.status === 503) { setError("Our offer service is briefly unavailable — refresh in a moment. Your offer is safe."); setOffer(null); return; }
        if (!r.ok) { setError("Couldn't load this offer. Try refreshing."); setOffer(null); return; }
        const data: Offer = await r.json();
        setOffer(data);
        setItems(buildItems(data));
      })
      .catch(() => { if (!cancelled) setError("Network error. Try refreshing."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [leadId]);

  const doCancel = async () => {
    setCancelling(true);
    setCancelError("");
    try {
      const r = await fetch(`/api/offer/${encodeURIComponent(leadId)}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: cancelNote.trim() || undefined }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        setCancelError(d.error || "Couldn't cancel — try again or email us.");
        return;
      }
      // Optimistic update so the page reflects cancellation immediately.
      setOffer((prev) => prev ? { ...prev, status: "rejected", cancelled: true } : prev);
      setCancelConfirmOpen(false);
    } catch {
      setCancelError("Network error — try again.");
    } finally {
      setCancelling(false);
    }
  };

  // Submit a price-match request. Staff sees the marker land in MC +
  // gets an owner SMS; the actual price adjustment is human-in-the-loop
  // via the existing counter-offer flow.
  const doPriceMatch = async () => {
    const amount = parseInt(pmAmount.replace(/[^0-9]/g, ""), 10);
    if (!pmCompetitor.trim()) { setPmError("Where did you find the better quote?"); return; }
    if (!amount || amount <= 0) { setPmError("Enter the dollar amount they quoted."); return; }
    if (pmUrl.trim() && !/^https?:\/\//i.test(pmUrl.trim())) {
      setPmError("If you include a link, it should start with http:// or https://.");
      return;
    }
    setPmSubmitting(true);
    setPmError("");
    try {
      const r = await fetch(`/api/offer/${encodeURIComponent(leadId)}/price-match`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          competitor: pmCompetitor.trim(),
          amount,
          url: pmUrl.trim() || undefined,
          note: pmNote.trim() || undefined,
        }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setPmError(d.error || "Couldn't send your request — try again."); return; }
      setPmSubmitted(true);
    } catch {
      setPmError("Network error — try again.");
    } finally {
      setPmSubmitting(false);
    }
  };

  // Save an edited phone number. Owner-gated server-side, same as cancel.
  const doSaveContact = async () => {
    const digits = phoneDraft.replace(/\D/g, "");
    if (digits.length < 10) { setPhoneError("Enter a 10-digit phone number."); return; }
    setPhoneSaving(true);
    setPhoneError("");
    try {
      const r = await fetch(`/api/offer/${encodeURIComponent(leadId)}/contact`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: phoneDraft.trim() }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        setPhoneError(d.error || "Couldn't save — try again or email us.");
        return;
      }
      setOffer((prev) => prev ? { ...prev, phone: phoneDraft.trim() } : prev);
      setEditingPhone(false);
      setPhoneSaved(true);
      setTimeout(() => setPhoneSaved(false), 2500);
    } catch {
      setPhoneError("Network error — try again.");
    } finally {
      setPhoneSaving(false);
    }
  };

  // Persist an edited device list. Owner-gated + before-shipping-gated
  // server-side; on success the offer total reflects the new estimate.
  const doSaveItems = async (next: EditItem[]) => {
    setSavingItems(true);
    setItemsError("");
    try {
      const r = await fetch(`/api/offer/${encodeURIComponent(leadId)}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ devices: next }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        setItemsError(d.error || "Couldn't save your changes — try again or email us.");
        return;
      }
      const saved: EditItem[] = Array.isArray(d.devices) ? d.devices : next;
      const total = typeof d.total === "number"
        ? d.total
        : saved.reduce((s, it) => s + it.quote * it.quantity, 0);
      setItems(saved);
      setOffer((prev) => prev ? { ...prev, devices: saved, totalPayout: total } : prev);
      setEditIdx(null);
      setItemsSaved(true);
      setTimeout(() => setItemsSaved(false), 2500);
    } catch {
      setItemsError("Network error — try again.");
    } finally {
      setSavingItems(false);
    }
  };

  // Checklist (only meaningful for ship leads). Hooks must run unconditionally,
  // so we always compute them — just hide the section when not shipping.
  const prepKeys = ["reset", "sim", "responsibility"];
  const packagingKeys = ["box", "padding", "taped"];
  const labelKeys = ["flat", "barcode"];
  const prep = useChecklist(leadId, prepKeys);
  const pack = useChecklist(leadId, packagingKeys);
  const lbl = useChecklist(leadId, labelKeys);

  if (loading) {
    return (
      <main className="min-h-screen bg-[#0a0a0a] text-white flex items-center justify-center">
        <p className="text-[#888] text-sm">Loading your offer…</p>
      </main>
    );
  }
  if (error || !offer) {
    return (
      <main className="min-h-screen bg-[#0a0a0a] text-white">
        <div className="max-w-2xl mx-auto px-4 py-12 text-center">
          <svg className="w-8 h-8 text-[#00c853] mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <p className="font-bold mb-1">{error || "Offer not found"}</p>
          <Link href="/account" className="text-[#00c853] hover:underline text-sm">← Back to my account</Link>
        </div>
      </main>
    );
  }

  const isShip = offer.handoffMethod === "ship";
  // A device with no price (quote <= 0) needs a manual quote, same as a
  // flagged review — never show "$0" as though it were a real offer.
  const itemNeedsReview = (it: { needsReview?: boolean; quote?: number }) =>
    !!it.needsReview || (it.quote ?? 0) <= 0;
  const total = (offer.needsReview || (offer.devices ?? []).some(itemNeedsReview))
    ? "Manual review"
    : (offer.totalPayout != null
        ? `$${offer.totalPayout.toLocaleString()}`
        : (offer.quote && /\$/.test(offer.quote) ? offer.quote : (offer.quote ? `$${offer.quote}` : "—")));
  const isPaid = offer.status === "paid" || offer.status === "met";
  const isCancelled = offer.cancelled || offer.status === "rejected";
  // Devices are editable by anyone on this offer's private link, up
  // until the trade ships. Editing only changes a customer-facing
  // estimate (final price is set at inspection), so no sign-in gate.
  const canEditItems = offer.status === "quote_requested" && !isCancelled;

  return (
    <main className="min-h-screen bg-[#0a0a0a] text-white">
      <div className="max-w-3xl mx-auto px-4 py-8 lg:py-10">
        <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
          <Link href="/account" className="inline-flex items-center gap-1 text-[#00c853] text-sm font-semibold">
            ← Back to my account
          </Link>
          {/* Quick actions row — Share copies the offer link (or uses
              Web Share if available); Download opens print dialog so the
              customer can save the page as PDF for their records.
              Skywalker 2026-05-19. */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                const url = typeof window !== "undefined" ? window.location.href : "";
                const title = `Top Cash Cellular Offer #${formatOfferNumber(offer.id)}`;
                if (typeof navigator !== "undefined" && navigator.share) {
                  navigator.share({ title, url }).catch(() => {});
                  return;
                }
                if (typeof navigator !== "undefined" && navigator.clipboard) {
                  navigator.clipboard.writeText(url).then(() => {
                    setShareNotice("Link copied to clipboard");
                    setTimeout(() => setShareNotice(""), 2000);
                  }).catch(() => {});
                }
              }}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#dcdcdc] hover:text-white px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition cursor-pointer"
              title="Share this offer link"
            >
              <svg className="w-4 h-4 text-[#00c853]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 010 5.656l-3 3a4 4 0 01-5.656-5.656l1.5-1.5m6.656-2.828a4 4 0 015.656 0l-1.5 1.5m-7.656 3.656a4 4 0 005.656 0l3-3a4 4 0 00-5.656-5.656l-1.5 1.5" /></svg>
              Share
            </button>
            <button
              type="button"
              onClick={() => { if (typeof window !== "undefined") window.print(); }}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#dcdcdc] hover:text-white px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition cursor-pointer"
              title="Save offer details as PDF via your browser's print dialog"
            >
              <svg className="w-4 h-4 text-[#00c853]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
              Download
            </button>
          </div>
        </div>
        {shareNotice && (
          <div className="mb-3 px-3 py-2 rounded-lg bg-[#00c853]/15 border border-[#00c853]/40 text-[#00c853] text-xs font-semibold flex items-center justify-center gap-1.5">
            <svg className="w-4 h-4 text-[#00c853]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            {shareNotice}
          </div>
        )}

        {/* "A copy has been sent" confirmation line — mirrors IWM's
            post-submit reassurance. Only shows when we have the email. */}
        {offer.email && !isCancelled && (
          <p className="text-center text-[#bdbdbd] text-xs mb-4">
            A copy of this information has been sent to <span className="text-white font-semibold">{offer.email}</span>
          </p>
        )}

        {/* Hero — offer number, date, payout total */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-5 mb-3">
          <div className="flex items-start justify-between flex-wrap gap-3 mb-3">
            <div>
              <p className="text-[10px] text-[#888] uppercase tracking-[0.18em] font-bold mb-1">Offer</p>
              <p className="text-2xl font-extrabold tracking-tight">#{offer.id.slice(0, 10).toUpperCase()}</p>
              <p className="text-[#bdbdbd] text-xs mt-1">{fmtDate(offer.timestamp)}</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-[#888] uppercase tracking-[0.18em] font-bold mb-1">Total payout</p>
              <p className="text-3xl font-extrabold text-[#00c853]">{total}</p>
              {offer.payout && <p className="text-[#bdbdbd] text-xs mt-1">Payout via {offer.payout}</p>}
            </div>
          </div>

          {!isCancelled && <StatusPipeline status={offer.status} isShip={isShip} />}
        </div>

        {/* Big prominent status banner — mirrors IWM's "Awaiting Shipment"
            block. Visual hierarchy: this is what the customer should see
            at a glance, not the pipeline above it. */}
        <StatusBanner status={offer.status} cancelled={isCancelled} isShip={isShip} hasLabel={!!offer.fedexLabelUrl} />

        {/* Live-tracking reassurance — ship leads get an SMS + email at
            every FedEx movement (the fedex-poll cron), so tell them up
            front they don't need to keep checking. Skywalker 2026-05-22. */}
        {isShip && !isPaid && !isCancelled && (
          <div className="bg-[#00c853]/[0.06] border border-[#00c853]/30 rounded-2xl p-4 mb-5 flex items-start gap-2.5">
            <svg className="w-5 h-5 shrink-0 text-[#00c853] mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
            </svg>
            <p className="text-[#bdbdbd] text-xs leading-relaxed">
              <span className="text-white font-semibold">Live tracking — no need to check back.</span> We&apos;ll text and email you each time your package moves: picked up, in transit, and delivered to our Austin warehouse.
            </p>
          </div>
        )}

        {/* Manual-review banner — a customer edit set a device to a
            broken condition; the price is re-quoted by hand. */}
        {offer.needsReview && (
          <div className="bg-amber-500/10 border border-amber-500/40 rounded-2xl p-4 mb-5">
            <p className="text-amber-200 font-bold text-sm mb-1 flex items-center gap-1.5">
              <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              Your edit needs a manual review
            </p>
            <p className="text-amber-200/80 text-xs leading-relaxed">You marked a device as broken. Broken devices are re-quoted by hand — our team confirms the price after inspecting it, so the amounts below are estimates only.</p>
          </div>
        )}

        {/* Manage callout — spells out that the offer is editable, so
            customers know they can fix a mistake. Only while the offer
            is still in the editable window (before it ships). */}
        {canEditItems && (
          <div className="bg-[#00c853]/[0.06] border border-[#00c853]/30 rounded-2xl p-4 mb-5">
            <p className="text-sm font-bold text-white mb-1">You can still manage this offer</p>
            <p className="text-[#bdbdbd] text-xs leading-relaxed">
              Made a mistake? Right here you can <span className="text-white font-semibold">edit a device</span> — change its condition or storage and the quote updates instantly — <span className="text-white font-semibold">update your phone number</span>, or <span className="text-white font-semibold">cancel the offer</span>. You can do this anytime before {isShip ? "your trade ships" : "your meetup"}. All your trades live in <Link href="/account" className="text-[#00c853] font-semibold hover:underline">your account</Link>.
            </p>
          </div>
        )}

        {/* Print Label + tracking — ship leads only */}
        {isShip && offer.fedexLabelUrl && (
          <div className="bg-[#00c853]/8 border border-[#00c853]/40 rounded-2xl p-5 mb-5">
            <p className="text-[10px] uppercase tracking-[0.18em] text-[#00c853] font-bold mb-2">Your FedEx label</p>
            <p className="text-white text-sm font-mono mb-1 break-all">{offer.fedexTracking}</p>
            {offer.fedexService && <p className="text-[#bdbdbd] text-[11px] mb-3">{offer.fedexService.replace(/_/g, " ")}</p>}
            <div className="flex flex-col sm:flex-row gap-2">
              <a
                href={offer.fedexLabelUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-3 bg-[#00c853] hover:bg-[#00e676] text-[#0a0a0a] rounded-xl text-sm font-extrabold text-center transition"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                Print label
              </a>
              <a
                href={`https://www.fedex.com/fedextrack/?trknbr=${encodeURIComponent(offer.fedexTracking || "")}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 px-4 py-3 bg-white/5 border border-white/15 hover:bg-white/10 text-white rounded-xl text-sm font-semibold text-center transition"
              >
                Track on FedEx →
              </a>
            </div>
          </div>
        )}
        {isShip && !offer.fedexLabelUrl && offer.fedexErrorKind === "ADDRESS_INVALID" && (
          <div className="bg-amber-500/10 border border-amber-500/40 rounded-2xl p-5 mb-5">
            <p className="text-amber-200 font-bold text-sm mb-1 flex items-center gap-1.5">
              <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              Label couldn&apos;t be generated
            </p>
            <p className="text-[#bdbdbd] text-xs leading-relaxed mb-3">{offer.fedexErrorReason || "We couldn't validate your shipping address with FedEx. Email us a corrected address and we'll resend your label."}</p>
            <a href={`mailto:CustomerService@topcashcells.com?subject=${encodeURIComponent("Fix shipping address for offer " + offer.id)}`} className="inline-block px-4 py-2.5 bg-[#00c853] hover:bg-[#00e676] text-[#0a0a0a] rounded-xl text-sm font-bold transition">
              Email us your correction
            </a>
          </div>
        )}
        {isShip && !offer.fedexLabelUrl && offer.fedexErrorKind !== "ADDRESS_INVALID" && (
          <div className="bg-amber-500/10 border border-amber-500/40 rounded-2xl p-5 mb-5">
            <p className="text-amber-200 font-bold text-sm mb-1 flex items-center gap-1.5">
              <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-14L4 7m8 4v10M4 7v10l8 4" />
              </svg>
              Your label is on the way
            </p>
            <p className="text-[#bdbdbd] text-xs leading-relaxed">We had a brief hiccup generating the prepaid label. Your trade is saved — we&apos;ll email the label as soon as it&apos;s ready (usually within an hour).</p>
          </div>
        )}

        {/* Shipping prep checklist — ship leads only, before label drop-off */}
        {isShip && !isPaid && !isCancelled && (
          <div className="bg-white/5 border border-white/10 rounded-2xl p-5 mb-5">
            <p className="text-[10px] uppercase tracking-[0.18em] text-[#00c853] font-bold mb-3">Shipping checklist</p>
            <p className="text-[#bdbdbd] text-sm mb-4">Quick walkthrough before you drop off — we won&apos;t check, but it keeps your payout on schedule.</p>

            <ChecklistGroup
              num={1}
              title="Device prep"
              items={[
                { key: "reset", label: "Reset the device — or turn off Find My / Activation Lock", required: true, state: prep.state, toggle: prep.toggle },
                { key: "sim",   label: "Remove any SIM or SD cards (keep these — we don't need them)", required: false, state: prep.state, toggle: prep.toggle },
                { key: "responsibility", label: "I understand: if the device shows up activation-locked, account-locked, or as a model we don't accept, return shipping is on me.", required: true, state: prep.state, toggle: prep.toggle },
              ]}
            />

            <ChecklistGroup
              num={2}
              title="Packaging"
              items={[
                { key: "box", label: "Boxed up — any plain padded mailer or unmarked box works for phones; bigger trades use any unmarked box", required: true, state: pack.state, toggle: pack.toggle },
                { key: "padding", label: "Padded inside so it doesn't rattle (newspaper, bubble wrap, clothes)", required: true, state: pack.state, toggle: pack.toggle },
                { key: "taped", label: "Sealed shut with tape", required: true, state: pack.state, toggle: pack.toggle },
              ]}
            />

            <ChecklistGroup
              num={3}
              title="Shipping label"
              items={[
                { key: "flat", label: "Label is flat against the box (no wrinkles, no folds across the barcode)", required: true, state: lbl.state, toggle: lbl.toggle },
                { key: "barcode", label: "Barcode is fully visible and legible", required: true, state: lbl.state, toggle: lbl.toggle },
              ]}
            />

            {prep.allChecked && pack.allChecked && lbl.allChecked && (
              <div className="mt-4 px-4 py-3 rounded-xl bg-[#00c853]/15 border border-[#00c853]/40 text-center">
                <p className="text-[#00c853] font-bold text-sm flex items-center justify-center gap-1.5">
                  <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  You&apos;re ready — drop it at any FedEx
                </p>
                <p className="text-[#bdbdbd] text-[11px] mt-1">Your trade must be received within 14 days of submission.</p>
              </div>
            )}
          </div>
        )}

        {/* Offer items — editable before shipping. Editing re-quotes by
            delta (app/lib/requote); the figure is an estimate, the final
            price is confirmed at inspection. */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-5 mb-5">
          <div className="flex items-center justify-between gap-2 mb-3">
            <p className="text-[10px] uppercase tracking-[0.18em] text-[#00c853] font-bold">Offer items</p>
            {itemsSaved && <span className="inline-flex items-center gap-1 text-[10px] text-[#00c853] font-semibold"><svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>Saved</span>}
          </div>
          <div className="space-y-2">
            {items.map((it, i) => {
              const isEditing = editIdx === i;
              const liveQuote = isEditing
                ? (() => {
                    // Prefer the absolute table (matches the funnel exactly);
                    // fall back to ratio scaling when the table can't answer.
                    const perUnit = tableRequote(it.model, draftStorage, draftCondition);
                    if (perUnit != null) return Math.round(perUnit * draftQuantity);
                    return Math.round(requote({
                      originalQuote: it.quote,
                      fromCondition: it.condition, toCondition: draftCondition,
                      fromStorage: it.storage, toStorage: draftStorage,
                    }) * (it.quantity > 0 ? draftQuantity / it.quantity : 1));
                  })()
                : it.quote;
              const draftBroken = isEditing && matchTier(REQUOTE_CONDITIONS, draftCondition)?.id === "broken";
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
              return (
                <div key={i} className="bg-white/[0.03] border border-white/10 rounded-xl p-3">
                  <div className="flex items-center gap-3">
                    <DeviceThumb model={it.model} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold">{it.model}{it.quantity > 1 ? ` ×${it.quantity}` : ""}</p>
                      <p className="text-[11px] text-[#bdbdbd]">{[it.storage, it.condition].filter(Boolean).join(" · ") || "—"}</p>
                    </div>
                    <div className="text-right shrink-0">
                      {itemNeedsReview(it)
                        ? <p className="text-amber-300 font-bold text-xs inline-flex items-center gap-1"><svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>Manual review</p>
                        : <p className="text-[#00c853] font-bold">${it.quote.toLocaleString()}</p>}
                      {canEditItems && !isEditing && (
                        <button
                          type="button"
                          onClick={() => {
                            setEditIdx(i);
                            setDraftCondition(matchTier(REQUOTE_CONDITIONS, it.condition)?.label || it.condition || REQUOTE_CONDITIONS[1].label);
                            setDraftStorage(matchTier(REQUOTE_STORAGE, it.storage)?.label || it.storage || "");
                            setDraftQuantity(it.quantity > 0 ? it.quantity : 1);
                            setDraftFunctional(null);
                            setItemsError("");
                          }}
                          className="text-[10px] text-[#00c853] hover:underline font-bold cursor-pointer"
                        >
                          Edit
                        </button>
                      )}
                    </div>
                  </div>

                  {isEditing && (
                    <div className="mt-3 pt-3 border-t border-white/10">
                      {/* Warning — pops the moment the editor opens. */}
                      <div className="bg-amber-500/10 border border-amber-500/40 rounded-lg p-2.5 mb-3 flex items-start gap-2">
                        <svg className="w-4 h-4 shrink-0 text-amber-300 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                        <p className="text-amber-200/90 text-[11px] leading-relaxed">
                          This updates your <span className="font-bold">estimate</span> only. Your final price is confirmed when we inspect the device — change this just to match its real condition.
                        </p>
                      </div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-[#888] mb-1">Condition</label>
                      <select
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
                          <label className="block text-[10px] font-bold uppercase tracking-wider text-[#888] mb-1">Storage</label>
                          <select
                            value={draftStorage}
                            onChange={(e) => setDraftStorage(e.target.value)}
                            className="w-full px-3 py-2 mb-3 bg-black/40 border border-white/15 rounded-lg text-sm text-white focus:outline-none focus:border-[#00c853]"
                          >
                            {storeOpts.map((s) => <option key={s} value={s}>{s}</option>)}
                          </select>
                        </>
                      )}
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-[#888] mb-1">Quantity</label>
                      <select
                        value={draftQuantity}
                        onChange={(e) => setDraftQuantity(parseInt(e.target.value, 10) || 1)}
                        className="w-full px-3 py-2 mb-3 bg-black/40 border border-white/15 rounded-lg text-sm text-white focus:outline-none focus:border-[#00c853]"
                      >
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => <option key={n} value={n}>{n}</option>)}
                      </select>
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
                      {itemsError && <p className="text-red-300 text-[11px] font-semibold mb-2">{itemsError}</p>}
                      <div className="flex gap-2">
                        <button
                          type="button"
                          disabled={savingItems || (draftBroken && draftFunctional === null)}
                          onClick={() => {
                            const next = items.map((row, idx) => idx === i
                              ? { ...row, condition: draftCondition, storage: draftStorage, quantity: draftQuantity, quote: draftNeedsReview ? 0 : liveQuote, needsReview: draftNeedsReview }
                              : row);
                            doSaveItems(next);
                          }}
                          className="flex-1 px-3 py-2 bg-[#00c853] hover:bg-[#00e676] text-[#0a0a0a] rounded-lg text-xs font-extrabold cursor-pointer disabled:opacity-50 transition"
                        >
                          {savingItems ? "Saving…" : draftNeedsReview ? "Request manual review" : "Save changes"}
                        </button>
                        <button
                          type="button"
                          disabled={savingItems}
                          onClick={() => { setEditIdx(null); setItemsError(""); }}
                          className="px-3 py-2 bg-white/5 border border-white/15 rounded-lg text-xs font-semibold cursor-pointer disabled:opacity-50 transition"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="mt-3 pt-3 border-t border-white/15 flex items-baseline justify-between">
            <span className="text-[11px] uppercase tracking-wider text-[#e6e6e6] font-bold">Total</span>
            {items.some(itemNeedsReview)
              ? <span className="text-amber-300 font-extrabold text-sm inline-flex items-center gap-1"><svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>Manual review</span>
              : <span className="text-[#00c853] font-extrabold text-lg">${items.reduce((s, it) => s + it.quote, 0).toLocaleString()}</span>}
          </div>

          {canEditItems && (
            <p className="text-[#888] text-[11px] mt-2">Spotted a mistake? Edit a device above — your estimate updates instantly.</p>
          )}
          {!isCancelled && offer.status !== "quote_requested" && (
            <p className="text-[#888] text-[11px] mt-2 flex items-start gap-1.5"><svg className="w-4 h-4 shrink-0 text-[#00c853]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg><span>Device details lock once your trade is on its way. Need a change? <a href={`mailto:CustomerService@topcashcells.com?subject=${encodeURIComponent("Offer " + offer.id)}`} className="text-[#00c853] hover:underline">Email us</a>.</span></p>
          )}
        </div>

        {/* Contact info */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-5 mb-5">
          <p className="text-[10px] uppercase tracking-[0.18em] text-[#00c853] font-bold mb-3">Contact info</p>
          {offer.name && <p className="text-sm font-semibold mb-1">{offer.name}</p>}
          {offer.shipAddress && (
            <p className="text-[#bdbdbd] text-xs leading-relaxed flex items-start gap-1.5"><svg className="w-4 h-4 shrink-0 text-[#00c853]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-14L4 7m8 4v10M4 7v10l8 4" /></svg><span>Ships from: {offer.shipAddress}</span></p>
          )}
          {offer.localSlot && (
            <p className="text-[#bdbdbd] text-xs flex items-center gap-1.5"><svg className="w-4 h-4 shrink-0 text-[#00c853]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg><span>Local meetup · {offer.localSlot}</span></p>
          )}
          <div className="mt-2 flex flex-col gap-1.5">
            {/* Phone — editable by the signed-in owner. Name and email
                stay fixed (email is the account identity). */}
            {editingPhone ? (
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center gap-2">
                  <input
                    type="tel"
                    inputMode="tel"
                    value={phoneDraft}
                    onChange={(e) => setPhoneDraft(e.target.value.slice(0, 20))}
                    placeholder="Phone number"
                    className="flex-1 px-3 py-1.5 bg-black/40 border border-white/15 rounded-lg text-xs text-white placeholder:text-[#888] focus:outline-none focus:border-[#00c853]"
                  />
                  <button
                    type="button"
                    onClick={doSaveContact}
                    disabled={phoneSaving}
                    className="px-3 py-1.5 bg-[#00c853] hover:bg-[#00e676] text-[#0a0a0a] rounded-lg text-xs font-bold cursor-pointer disabled:opacity-50 transition"
                  >
                    {phoneSaving ? "Saving…" : "Save"}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setEditingPhone(false); setPhoneError(""); }}
                    disabled={phoneSaving}
                    className="px-2.5 py-1.5 bg-white/5 border border-white/10 rounded-lg text-xs text-[#d4d4d4] hover:bg-white/10 cursor-pointer disabled:opacity-50 transition"
                  >
                    Cancel
                  </button>
                </div>
                {phoneError && <p className="text-red-300 text-[11px] font-semibold">{phoneError}</p>}
              </div>
            ) : (
              <div className="flex items-center gap-2 flex-wrap">
                {offer.phone
                  ? <p className="text-[#bdbdbd] text-xs flex items-center gap-1.5"><svg className="w-4 h-4 shrink-0 text-[#00c853]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg><span>{offer.phone}</span></p>
                  : !isCancelled && <p className="text-[#888] text-xs flex items-center gap-1.5"><svg className="w-4 h-4 shrink-0 text-[#00c853]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg><span>No phone on file</span></p>}
                {!isCancelled && (
                  <button
                    type="button"
                    onClick={() => { setPhoneDraft(offer.phone || ""); setEditingPhone(true); setPhoneError(""); }}
                    className="text-[10px] text-[#00c853] hover:underline font-bold cursor-pointer"
                  >
                    {offer.phone ? "Edit" : "+ Add phone number"}
                  </button>
                )}
                {phoneSaved && <span className="inline-flex items-center gap-1 text-[10px] text-[#00c853] font-semibold"><svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>Saved</span>}
              </div>
            )}
            {offer.email && <p className="text-[#bdbdbd] text-xs flex items-center gap-1.5"><svg className="w-4 h-4 shrink-0 text-[#00c853]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg><span>{offer.email}</span></p>}
          </div>
        </div>

        {/* Best Price Guarantee — customer-facing price-match form.
            Submitting posts a [PRICE-MATCH-REQUEST:] marker to MC and
            owner-SMSes staff; the honoring itself runs through the
            existing counter-offer flow. Skywalker 2026-05-22. */}
        {!isPaid && !isCancelled && (
          <div className="bg-white/[0.02] border border-white/8 rounded-2xl p-5 mb-5">
            {pmSubmitted ? (
              <div className="text-center">
                <p className="text-[10px] uppercase tracking-[0.18em] text-[#00c853] font-bold mb-1">Best Price Guarantee</p>
                <p className="text-sm font-bold text-white mb-1">Got it — we&apos;ll review and get back to you.</p>
                <p className="text-[#bdbdbd] text-xs leading-relaxed">A real person checks every request, usually same business day. We&apos;ll reach out by text or email with our response.</p>
              </div>
            ) : !pmOpen ? (
              <button
                type="button"
                onClick={() => setPmOpen(true)}
                className="w-full flex items-start justify-between gap-3 text-left cursor-pointer group"
              >
                <div className="min-w-0">
                  <p className="text-[10px] uppercase tracking-[0.18em] text-[#00c853] font-bold mb-1">Best Price Guarantee</p>
                  <p className="text-sm font-bold text-white mb-1">Found a better quote elsewhere?</p>
                  <p className="text-[#bdbdbd] text-xs leading-relaxed">Tell us where — we aim to match or beat any honest comparable quote.</p>
                </div>
                <svg className="w-5 h-5 shrink-0 text-[#00c853] mt-1 transition-transform group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
              </button>
            ) : (
              <>
                <p className="text-[10px] uppercase tracking-[0.18em] text-[#00c853] font-bold mb-1">Best Price Guarantee</p>
                <p className="text-sm font-bold text-white mb-3">Submit a competitor quote</p>
                <div className="space-y-3">
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-[#888] mb-1">Where did you get the quote?</label>
                    <input
                      type="text"
                      value={pmCompetitor}
                      onChange={(e) => setPmCompetitor(e.target.value.slice(0, 60))}
                      placeholder="ItsWorthMore, Gazelle, Swappa, Backmarket…"
                      className="w-full px-3 py-2 bg-black/40 border border-white/15 rounded-lg text-sm text-white placeholder:text-[#777] focus:outline-none focus:border-[#00c853]"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-[#888] mb-1">Their quote ($)</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={pmAmount}
                      onChange={(e) => setPmAmount(e.target.value.replace(/[^0-9]/g, "").slice(0, 6))}
                      placeholder="e.g. 425"
                      className="w-full px-3 py-2 bg-black/40 border border-white/15 rounded-lg text-sm text-white placeholder:text-[#777] focus:outline-none focus:border-[#00c853]"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-[#888] mb-1">Link to their quote <span className="text-[#666] normal-case font-normal">(optional)</span></label>
                    <input
                      type="url"
                      value={pmUrl}
                      onChange={(e) => setPmUrl(e.target.value.slice(0, 240))}
                      placeholder="https://…"
                      className="w-full px-3 py-2 bg-black/40 border border-white/15 rounded-lg text-sm text-white placeholder:text-[#777] focus:outline-none focus:border-[#00c853]"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-[#888] mb-1">Anything else? <span className="text-[#666] normal-case font-normal">(optional)</span></label>
                    <textarea
                      value={pmNote}
                      onChange={(e) => setPmNote(e.target.value.slice(0, 300))}
                      placeholder="e.g. condition we matched, screenshot details"
                      rows={2}
                      className="w-full px-3 py-2 bg-black/40 border border-white/15 rounded-lg text-sm text-white placeholder:text-[#777] focus:outline-none focus:border-[#00c853] resize-none"
                    />
                  </div>
                  {pmError && <p className="text-red-300 text-[11px] font-semibold">{pmError}</p>}
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={doPriceMatch}
                      disabled={pmSubmitting}
                      className="flex-1 px-3 py-2.5 bg-[#00c853] hover:bg-[#00e676] text-[#0a0a0a] rounded-lg text-sm font-extrabold cursor-pointer disabled:opacity-50 transition"
                    >
                      {pmSubmitting ? "Sending…" : "Submit for review"}
                    </button>
                    <button
                      type="button"
                      onClick={() => { setPmOpen(false); setPmError(""); }}
                      disabled={pmSubmitting}
                      className="px-3 py-2.5 bg-white/5 border border-white/15 rounded-lg text-sm font-semibold cursor-pointer disabled:opacity-50 transition"
                    >
                      Cancel
                    </button>
                  </div>
                  <p className="text-[10px] text-[#666] leading-relaxed">A real person reviews every request — no auto-honored numbers. We&apos;ll match or beat any honest comparable quote we can verify.</p>
                </div>
              </>
            )}
          </div>
        )}

        {/* Modify your trade-in — header section. Item-edit + add-item
            modals will come later; for now the modify path routes
            through email-staff. The cancel path is real (auth-gated)
            for signed-in owners. */}
        {!isPaid && !isCancelled && (
          <div className="bg-white/[0.02] border border-white/8 rounded-2xl p-5 mb-5">
            <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-[0.18em] text-[#888] font-bold mb-1">Cancel this offer</p>
                <p className="text-[#bdbdbd] text-xs leading-relaxed">
                  Changed your mind? You can cancel anytime before we receive your device. To edit a device, use the Offer items above.
                </p>
              </div>
            </div>


            {/* Cancel — a real self-serve action, open to anyone on the
                offer's private link (leadId is the secret; staff get an
                SMS on cancel). No sign-in required. */}
            {!cancelConfirmOpen ? (
              <button
                type="button"
                onClick={() => setCancelConfirmOpen(true)}
                className="w-full px-4 py-2.5 bg-red-500/10 border border-red-500/30 text-[#ff8088] rounded-xl text-sm font-bold hover:bg-red-500/15 transition cursor-pointer"
              >
                ✕ Cancel this offer
              </button>
            ) : (
              <div className="bg-red-500/10 border border-red-500/40 rounded-xl p-4">
                <p className="text-red-200 font-bold text-sm mb-2">Cancel offer #{formatOfferNumber(offer.id)}?</p>
                <p className="text-red-200/80 text-[11px] mb-3">{isShip ? "Your shipping label will stop working. You can always start a new offer from the home page." : "Your meetup slot will be released. You can always start a new offer."}</p>
                <textarea
                  value={cancelNote}
                  onChange={(e) => setCancelNote(e.target.value.slice(0, 200))}
                  placeholder="Reason (optional) — helps us improve"
                  rows={2}
                  className="w-full px-3 py-2 mb-3 bg-black/40 border border-white/10 rounded-lg text-xs text-white placeholder:text-[#888] focus:outline-none focus:border-red-400 resize-none"
                />
                {cancelError && (
                  <p className="text-red-300 text-[11px] font-semibold mb-2">{cancelError}</p>
                )}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={doCancel}
                    disabled={cancelling}
                    className="flex-1 px-3 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg text-xs font-extrabold cursor-pointer disabled:opacity-50 transition"
                  >
                    {cancelling ? "Cancelling…" : "Yes, cancel my offer"}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setCancelConfirmOpen(false); setCancelError(""); }}
                    disabled={cancelling}
                    className="px-3 py-2 bg-white/5 border border-white/15 rounded-lg text-xs font-semibold cursor-pointer disabled:opacity-50 transition"
                  >
                    Keep offer
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="text-center pt-2 pb-8">
          <Link href="/" className="inline-block bg-[#00c853] hover:bg-[#00e676] text-[#0a0a0a] px-6 py-3 rounded-2xl font-extrabold transition">
            + Sell another device
          </Link>
        </div>
      </div>
    </main>
  );
}

// Big prominent status banner under the pipeline. Mirrors the IWM
// "Awaiting Shipment" callout — one strong sentence telling the
// customer exactly where their offer stands right now.
function StatusBanner({ status, cancelled, isShip, hasLabel }: { status: string; cancelled: boolean; isShip: boolean; hasLabel: boolean }) {
  let title = "";
  let iconPath = "";
  let detail = "";
  let tone = "bg-white/5 border-white/10 text-white";
  if (cancelled) {
    title = "Offer Cancelled";
    iconPath = "M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15";
    detail = "This trade was cancelled. Reach out if you'd like to start a new offer.";
    tone = "bg-red-500/10 border-red-500/40 text-red-200";
  } else if (status === "paid" || status === "met") {
    title = "Paid";
    iconPath = "M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z";
    detail = "Payout sent — thanks for selling with us.";
    tone = "bg-emerald-500/10 border-emerald-500/40 text-emerald-200";
  } else if (status === "tested") {
    title = "In Inspection";
    iconPath = "M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z";
    detail = "We're verifying your device matches the quote. Payout fires the moment it clears.";
    tone = "bg-amber-500/10 border-amber-500/40 text-amber-200";
  } else if (status === "received") {
    if (isShip) {
      title = "Received";
      iconPath = INBOX_ICON;
      detail = "Your package landed in Austin. Inspection happens within 24 hrs of arrival.";
    } else {
      title = "Met Up";
      iconPath = MEETUP_ICON;
      detail = "Thanks for meeting us — your device is in hand and headed straight to inspection.";
    }
    tone = "bg-violet-500/10 border-violet-500/40 text-violet-200";
  } else if (status === "shipped") {
    if (isShip) {
      title = "Shipped";
      iconPath = TRUCK_ICON;
      detail = "Your package is on its way. Most arrive within 3-5 business days via FedEx Ground.";
    } else {
      // A local lead marked "shipped" — used as a drop-off / arranged-
      // handoff marker, since a meetup never actually ships.
      title = "Meetup Confirmed";
      iconPath = MEETUP_ICON;
      detail = "Your meetup is set — see you soon. We inspect your device and pay you cash on the spot.";
    }
    tone = "bg-sky-500/10 border-sky-500/40 text-sky-200";
  } else if (isShip) {
    title = "Awaiting Shipment";
    iconPath = "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z";
    detail = hasLabel
      ? "We're waiting for your offer to be shipped to our warehouse. Print your label below and drop off when you're ready — 14 days from offer creation."
      : "We're waiting on your prepaid label. Check your email — it usually lands within the hour.";
    tone = "bg-[#00c853]/10 border-[#00c853]/40 text-[#00c853]";
  } else {
    title = "Awaiting Meetup";
    iconPath = "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z";
    detail = "Watch your texts — we'll confirm a public Austin spot shortly.";
    tone = "bg-[#00c853]/10 border-[#00c853]/40 text-[#00c853]";
  }
  return (
    <div className={`rounded-2xl px-5 py-4 mb-5 border ${tone}`}>
      <p className="font-extrabold text-base mb-1 flex items-center gap-2">
        <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d={iconPath} /></svg>
        {title}
      </p>
      <p className="text-xs leading-relaxed opacity-90">{detail}</p>
    </div>
  );
}

function StatusPipeline({ status, isShip }: { status: string; isShip: boolean }) {
  const pipeline = pipelineFor(isShip);
  const idx = statusIndex(status, isShip);
  return (
    <div className="pt-2">
      <div className="flex items-center justify-between gap-1">
        {pipeline.map((step, i) => {
          const done = i < idx;
          const current = i === idx;
          return (
            <div key={step.value} className="flex-1 flex flex-col items-center gap-1.5 min-w-0">
              <div className={`w-9 h-9 rounded-full flex items-center justify-center transition ${
                done ? "bg-[#00c853] text-[#0a0a0a]" :
                current ? "bg-[#00c853] text-[#0a0a0a] ring-4 ring-[#00c853]/30 animate-pulse" :
                "bg-white/5 border border-white/10 text-[#888]"
              }`}>
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d={done ? "M5 13l4 4L19 7" : step.icon} />
                </svg>
              </div>
              <p className={`text-[9px] text-center leading-tight uppercase tracking-wider ${done || current ? "text-white font-bold" : "text-[#888]"}`}>{step.label}</p>
            </div>
          );
        })}
      </div>
      <div className="relative h-1 bg-white/5 rounded-full -mt-[40px] mx-5 mb-8 -z-10">
        <div className="absolute top-0 left-0 h-full bg-[#00c853] rounded-full transition-all duration-[450ms]" style={{ width: `${idx <= 0 ? 0 : (idx / (pipeline.length - 1)) * 100}%` }} />
      </div>
    </div>
  );
}

function ChecklistGroup({ num, title, items }: {
  num: number;
  title: string;
  items: Array<{ key: string; label: string; required: boolean; state: Record<string, boolean>; toggle: (k: string) => void }>;
}) {
  return (
    <div className="mb-4 last:mb-0">
      <div className="flex items-center gap-2 mb-2">
        <span className="w-6 h-6 rounded-full bg-[#00c853]/20 text-[#00c853] text-xs font-bold flex items-center justify-center">{num}</span>
        <p className="text-sm font-bold">{title}</p>
      </div>
      <div className="space-y-2 pl-8">
        {items.map((it) => (
          <label key={it.key} className="flex items-start gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={!!it.state[it.key]}
              onChange={() => it.toggle(it.key)}
              className="mt-0.5 w-4 h-4 shrink-0 rounded border-white/25 bg-white/5 accent-[#00c853] cursor-pointer"
            />
            <span className={`text-[12px] leading-relaxed ${it.state[it.key] ? "text-[#888] line-through" : "text-[#dcdcdc]"}`}>
              {it.required ? "" : <span className="text-[10px] uppercase tracking-wider text-[#888] mr-1">Optional ·</span>}
              {it.label}
            </span>
          </label>
        ))}
      </div>
    </div>
  );
}
