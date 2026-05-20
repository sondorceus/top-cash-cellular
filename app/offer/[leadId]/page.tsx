"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { REQUOTE_CONDITIONS, REQUOTE_STORAGE, matchTier, requote } from "../../lib/requote";
import { imageForModel } from "../../lib/device-images";

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
  devices?: Array<{ model: string; storage?: string; condition?: string; quote?: number; quantity?: number }>;
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
};

// A device row in the editable Offer-items list (normalized from the
// offer's multi-device array or its single-device fields).
type EditItem = { model: string; storage: string; condition: string; quote: number; quantity: number };

const PIPELINE = [
  { value: "quote_requested", label: "Submitted", icon: "📥" },
  { value: "shipped", label: "Shipped", icon: "📦" },
  { value: "received", label: "Received", icon: "📬" },
  { value: "tested", label: "Inspected", icon: "🔍" },
  { value: "paid", label: "Paid", icon: "💵" },
];

function statusIndex(s: string): number {
  if (s === "rejected") return -1;
  if (s === "met") return 4; // "met" terminates a local handoff at the paid stage
  return PIPELINE.findIndex((p) => p.value === s);
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
    }));
  }
  const q = o.quote ? parseInt(o.quote.replace(/[^0-9]/g, ""), 10) || 0 : 0;
  return [{
    model: o.model || o.device || "Device",
    storage: o.storage || "",
    condition: o.condition || "",
    quote: o.totalPayout != null ? o.totalPayout : q,
    quantity: o.quantity && o.quantity > 0 ? o.quantity : 1,
  }];
}

// A category glyph — fallback for the device thumbnail when there's
// no catalog photo (or the photo fails to load).
function deviceIcon(model: string): string {
  const m = model.toLowerCase();
  if (/macbook|laptop|imac|notebook/.test(m)) return "💻";
  if (/ipad|tablet|galaxy tab|surface/.test(m)) return "📲";
  if (/watch/.test(m)) return "⌚";
  if (/playstation|\bps5\b|\bps4\b|xbox|nintendo|switch/.test(m)) return "🎮";
  if (/airpod|earbud|buds|headphone/.test(m)) return "🎧";
  return "📱";
}

// Device thumbnail — real product photo from the catalog when we have
// one, gracefully falling back to the category glyph.
function DeviceThumb({ model }: { model: string }) {
  const [broken, setBroken] = useState(false);
  const img = imageForModel(model);
  return (
    <div className="w-12 h-12 rounded-lg bg-[rgba(15,15,15,0.6)] border border-white/10 flex items-center justify-center overflow-hidden shrink-0">
      {img && !broken
        ? <img src={img} alt={model} className="w-full h-full object-contain p-1" onError={() => setBroken(true)} />
        : <span className="text-xl">{deviceIcon(model)}</span>}
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
          <p className="text-2xl mb-2">🔍</p>
          <p className="font-bold mb-1">{error || "Offer not found"}</p>
          <Link href="/account" className="text-[#00c853] hover:underline text-sm">← Back to my account</Link>
        </div>
      </main>
    );
  }

  const idx = statusIndex(offer.status);
  const isShip = offer.handoffMethod === "ship";
  const total = offer.totalPayout != null
    ? `$${offer.totalPayout.toLocaleString()}`
    : (offer.quote && /\$/.test(offer.quote) ? offer.quote : (offer.quote ? `$${offer.quote}` : "—"));
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
                const title = `Top Cash Cellular Offer #${offer.id.slice(0, 10).toUpperCase()}`;
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
              className="text-xs font-semibold text-[#dcdcdc] hover:text-white px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition cursor-pointer"
              title="Share this offer link"
            >
              🔗 Share
            </button>
            <button
              type="button"
              onClick={() => { if (typeof window !== "undefined") window.print(); }}
              className="text-xs font-semibold text-[#dcdcdc] hover:text-white px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition cursor-pointer"
              title="Save offer details as PDF via your browser's print dialog"
            >
              ⬇️ Download
            </button>
          </div>
        </div>
        {shareNotice && (
          <div className="mb-3 px-3 py-2 rounded-lg bg-[#00c853]/15 border border-[#00c853]/40 text-[#00c853] text-xs font-semibold text-center">
            ✓ {shareNotice}
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

          {!isCancelled && <StatusPipeline status={offer.status} />}
        </div>

        {/* Big prominent status banner — mirrors IWM's "Awaiting Shipment"
            block. Visual hierarchy: this is what the customer should see
            at a glance, not the pipeline above it. */}
        <StatusBanner status={offer.status} cancelled={isCancelled} isShip={isShip} hasLabel={!!offer.fedexLabelUrl} />

        {/* Manage callout — spells out that the offer is editable, so
            customers know they can fix a mistake. Only while the offer
            is still in the editable window (before it ships). */}
        {canEditItems && (
          <div className="bg-[#00c853]/[0.06] border border-[#00c853]/30 rounded-2xl p-4 mb-5">
            <p className="text-sm font-bold text-white mb-1">✏️ You can still manage this offer</p>
            <p className="text-[#bdbdbd] text-xs leading-relaxed">
              Made a mistake? Right here you can <span className="text-white font-semibold">edit a device</span> — change its condition or storage and the quote updates instantly — <span className="text-white font-semibold">update your phone number</span>, or <span className="text-white font-semibold">cancel the offer</span>. You can do this anytime before your trade ships. All your trades live in <Link href="/account" className="text-[#00c853] font-semibold hover:underline">your account</Link>.
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
                className="flex-1 px-4 py-3 bg-[#00c853] hover:bg-[#00e676] text-[#0a0a0a] rounded-xl text-sm font-extrabold text-center transition"
              >
                🖨️ Print label
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
            <p className="text-amber-200 font-bold text-sm mb-1">⚠️ Label couldn&apos;t be generated</p>
            <p className="text-[#bdbdbd] text-xs leading-relaxed mb-3">{offer.fedexErrorReason || "We couldn't validate your shipping address with FedEx. Email us a corrected address and we'll resend your label."}</p>
            <a href={`mailto:CustomerService@topcashcells.com?subject=${encodeURIComponent("Fix shipping address for offer " + offer.id)}`} className="inline-block px-4 py-2.5 bg-[#00c853] hover:bg-[#00e676] text-[#0a0a0a] rounded-xl text-sm font-bold transition">
              Email us your correction
            </a>
          </div>
        )}
        {isShip && !offer.fedexLabelUrl && offer.fedexErrorKind !== "ADDRESS_INVALID" && (
          <div className="bg-amber-500/10 border border-amber-500/40 rounded-2xl p-5 mb-5">
            <p className="text-amber-200 font-bold text-sm mb-1">📦 Your label is on the way</p>
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
                <p className="text-[#00c853] font-bold text-sm">✓ You&apos;re ready — drop it at any FedEx</p>
                <p className="text-[#bdbdbd] text-[11px] mt-1">Your trade must be received within 21 days of submission.</p>
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
            {itemsSaved && <span className="text-[10px] text-[#00c853] font-semibold">✓ Saved</span>}
          </div>
          <div className="space-y-2">
            {items.map((it, i) => {
              const isEditing = editIdx === i;
              const liveQuote = isEditing
                ? Math.round(requote({
                    originalQuote: it.quote,
                    fromCondition: it.condition, toCondition: draftCondition,
                    fromStorage: it.storage, toStorage: draftStorage,
                  }) * (it.quantity > 0 ? draftQuantity / it.quantity : 1))
                : it.quote;
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
                      <p className="text-[#00c853] font-bold">${it.quote.toLocaleString()}</p>
                      {canEditItems && !isEditing && (
                        <button
                          type="button"
                          onClick={() => {
                            setEditIdx(i);
                            setDraftCondition(matchTier(REQUOTE_CONDITIONS, it.condition)?.label || it.condition || REQUOTE_CONDITIONS[1].label);
                            setDraftStorage(matchTier(REQUOTE_STORAGE, it.storage)?.label || it.storage || "");
                            setDraftQuantity(it.quantity > 0 ? it.quantity : 1);
                            setItemsError("");
                          }}
                          className="text-[10px] text-[#00c853] hover:underline font-bold cursor-pointer"
                        >
                          ✏️ Edit
                        </button>
                      )}
                    </div>
                  </div>

                  {isEditing && (
                    <div className="mt-3 pt-3 border-t border-white/10">
                      {/* Warning — pops the moment the editor opens. */}
                      <div className="bg-amber-500/10 border border-amber-500/40 rounded-lg p-2.5 mb-3 flex items-start gap-2">
                        <span className="text-sm leading-none mt-0.5">⚠️</span>
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
                      <div className="flex items-center justify-between bg-white/[0.04] rounded-lg px-3 py-2 mb-3">
                        <span className="text-[11px] text-[#bdbdbd]">Updated estimate{draftQuantity > 1 ? ` (×${draftQuantity})` : ""}</span>
                        <span className={`font-extrabold ${liveQuote === it.quote ? "text-white" : "text-[#00c853]"}`}>
                          ${liveQuote.toLocaleString()}
                        </span>
                      </div>
                      {itemsError && <p className="text-red-300 text-[11px] font-semibold mb-2">{itemsError}</p>}
                      <div className="flex gap-2">
                        <button
                          type="button"
                          disabled={savingItems}
                          onClick={() => {
                            const next = items.map((row, idx) => idx === i
                              ? { ...row, condition: draftCondition, storage: draftStorage, quantity: draftQuantity, quote: liveQuote }
                              : row);
                            doSaveItems(next);
                          }}
                          className="flex-1 px-3 py-2 bg-[#00c853] hover:bg-[#00e676] text-[#0a0a0a] rounded-lg text-xs font-extrabold cursor-pointer disabled:opacity-50 transition"
                        >
                          {savingItems ? "Saving…" : "Save changes"}
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
            <span className="text-[#00c853] font-extrabold text-lg">${items.reduce((s, it) => s + it.quote, 0).toLocaleString()}</span>
          </div>

          {canEditItems && (
            <p className="text-[#888] text-[11px] mt-2">Spotted a mistake? Edit a device above — your estimate updates instantly.</p>
          )}
          {!isCancelled && offer.status !== "quote_requested" && (
            <p className="text-[#888] text-[11px] mt-2">🔒 Device details lock once your trade is on its way. Need a change? <a href={`mailto:CustomerService@topcashcells.com?subject=${encodeURIComponent("Offer " + offer.id)}`} className="text-[#00c853] hover:underline">Email us</a>.</p>
          )}
        </div>

        {/* Contact info */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-5 mb-5">
          <p className="text-[10px] uppercase tracking-[0.18em] text-[#00c853] font-bold mb-3">Contact info</p>
          {offer.name && <p className="text-sm font-semibold mb-1">{offer.name}</p>}
          {offer.shipAddress && (
            <p className="text-[#bdbdbd] text-xs leading-relaxed">📦 Ships from: {offer.shipAddress}</p>
          )}
          {offer.localSlot && (
            <p className="text-[#bdbdbd] text-xs">🤝 Local meetup · {offer.localSlot}</p>
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
                  ? <p className="text-[#bdbdbd] text-xs">📱 {offer.phone}</p>
                  : !isCancelled && <p className="text-[#888] text-xs">📱 No phone on file</p>}
                {!isCancelled && (
                  <button
                    type="button"
                    onClick={() => { setPhoneDraft(offer.phone || ""); setEditingPhone(true); setPhoneError(""); }}
                    className="text-[10px] text-[#00c853] hover:underline font-bold cursor-pointer"
                  >
                    {offer.phone ? "Edit" : "+ Add phone number"}
                  </button>
                )}
                {phoneSaved && <span className="text-[10px] text-[#00c853] font-semibold">✓ Saved</span>}
              </div>
            )}
            {offer.email && <p className="text-[#bdbdbd] text-xs">✉️ {offer.email}</p>}
          </div>
        </div>

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


            {/* Cancel — a real self-serve action. The signed-in owner
                cancels directly; anyone else is prompted to sign in with
                the offer's own email (no more email-us dead end). */}
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
                <p className="text-red-200 font-bold text-sm mb-2">Cancel offer #{offer.id.slice(0, 10).toUpperCase()}?</p>
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
  let detail = "";
  let tone = "bg-white/5 border-white/10 text-white";
  if (cancelled) {
    title = "↩️ Offer Cancelled";
    detail = "This trade was cancelled. Reach out if you'd like to start a new offer.";
    tone = "bg-red-500/10 border-red-500/40 text-red-200";
  } else if (status === "paid" || status === "met") {
    title = "💵 Paid";
    detail = "Payout sent — thanks for selling with us.";
    tone = "bg-emerald-500/10 border-emerald-500/40 text-emerald-200";
  } else if (status === "tested") {
    title = "🔍 In Inspection";
    detail = "We're verifying your device matches the quote. Payout fires the moment it clears.";
    tone = "bg-amber-500/10 border-amber-500/40 text-amber-200";
  } else if (status === "received") {
    title = "📬 Received";
    detail = "Your package landed in Austin. Inspection happens within 24 hrs of arrival.";
    tone = "bg-violet-500/10 border-violet-500/40 text-violet-200";
  } else if (status === "shipped") {
    title = "📦 Shipped";
    detail = "Your package is on its way. Most arrive within 3-5 business days via FedEx Ground.";
    tone = "bg-sky-500/10 border-sky-500/40 text-sky-200";
  } else if (isShip) {
    title = "⏳ Awaiting Shipment";
    detail = hasLabel
      ? "We're waiting for your offer to be shipped to our warehouse. Print your label below and drop off when you're ready — 21 days from offer creation."
      : "We're waiting on your prepaid label. Check your email — it usually lands within the hour.";
    tone = "bg-[#00c853]/10 border-[#00c853]/40 text-[#00c853]";
  } else {
    title = "🤝 Awaiting Meetup";
    detail = "Watch your texts — we'll confirm a public Austin spot shortly.";
    tone = "bg-[#00c853]/10 border-[#00c853]/40 text-[#00c853]";
  }
  return (
    <div className={`rounded-2xl px-5 py-4 mb-5 border ${tone}`}>
      <p className="font-extrabold text-base mb-1">{title}</p>
      <p className="text-xs leading-relaxed opacity-90">{detail}</p>
    </div>
  );
}

function StatusPipeline({ status }: { status: string }) {
  const idx = statusIndex(status);
  return (
    <div className="pt-2">
      <div className="flex items-center justify-between gap-1">
        {PIPELINE.map((step, i) => {
          const done = i < idx;
          const current = i === idx;
          return (
            <div key={step.value} className="flex-1 flex flex-col items-center gap-1.5 min-w-0">
              <div className={`w-9 h-9 rounded-full flex items-center justify-center text-base transition ${
                done ? "bg-[#00c853] text-[#0a0a0a]" :
                current ? "bg-[#00c853] text-[#0a0a0a] ring-4 ring-[#00c853]/30 animate-pulse" :
                "bg-white/5 border border-white/10 text-[#888]"
              }`}>
                {done ? "✓" : step.icon}
              </div>
              <p className={`text-[9px] text-center leading-tight uppercase tracking-wider ${done || current ? "text-white font-bold" : "text-[#888]"}`}>{step.label}</p>
            </div>
          );
        })}
      </div>
      <div className="relative h-1 bg-white/5 rounded-full -mt-[40px] mx-5 mb-8 -z-10">
        <div className="absolute top-0 left-0 h-full bg-[#00c853] rounded-full transition-all duration-500" style={{ width: `${idx <= 0 ? 0 : (idx / (PIPELINE.length - 1)) * 100}%` }} />
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
