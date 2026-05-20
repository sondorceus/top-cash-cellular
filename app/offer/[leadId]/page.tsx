"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";

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
  quote?: string;
  payout?: string;
  handoffMethod?: "ship" | "local";
  shipAddress?: { street?: string; unit?: string; city?: string; state?: string; zip?: string };
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

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/offer/${encodeURIComponent(leadId)}`, { cache: "no-store" })
      .then(async (r) => {
        if (cancelled) return;
        if (r.status === 404) { setError("We couldn't find this offer. Double-check the link."); setOffer(null); return; }
        if (!r.ok) { setError("Couldn't load this offer. Try refreshing."); setOffer(null); return; }
        const data: Offer = await r.json();
        setOffer(data);
      })
      .catch(() => { if (!cancelled) setError("Network error. Try refreshing."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [leadId]);

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

        {/* Hero — offer number, date, status badge, total */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-5 mb-5">
          <div className="flex items-start justify-between flex-wrap gap-3 mb-3">
            <div>
              <p className="text-[10px] text-[#888] uppercase tracking-[0.18em] font-bold mb-1">Offer</p>
              <p className="text-2xl font-extrabold tracking-tight">#{offer.id.slice(0, 10).toUpperCase()}</p>
              <p className="text-[#bdbdbd] text-xs mt-1">{fmtDate(offer.timestamp)}</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-[#888] uppercase tracking-[0.18em] font-bold mb-1">Total payout</p>
              <p className="text-3xl font-extrabold text-[#00c853]">{total}</p>
              {offer.payout && <p className="text-[#bdbdbd] text-xs mt-1">{offer.payout}</p>}
            </div>
          </div>

          {/* Status badge */}
          {isCancelled ? (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3">
              <p className="text-red-300 font-bold text-sm">↩️ Offer cancelled</p>
              <p className="text-red-200/80 text-xs mt-0.5">Reach out to <a href="mailto:CustomerService@topcashcells.com" className="underline">CustomerService@topcashcells.com</a> with any questions.</p>
            </div>
          ) : (
            <StatusPipeline status={offer.status} />
          )}
        </div>

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

        {/* Offer items */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-5 mb-5">
          <p className="text-[10px] uppercase tracking-[0.18em] text-[#00c853] font-bold mb-3">Offer items</p>
          {offer.devices && offer.devices.length > 0 ? (
            <div className="space-y-2">
              {offer.devices.map((d, i) => (
                <div key={i} className="bg-white/[0.03] border border-white/10 rounded-xl p-3 flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold">{d.model}{d.quantity && d.quantity > 1 ? ` ×${d.quantity}` : ""}</p>
                    <p className="text-[11px] text-[#bdbdbd]">{[d.storage, d.condition].filter(Boolean).join(" · ")}</p>
                  </div>
                  {d.quote != null && <p className="text-[#00c853] font-bold">${d.quote.toLocaleString()}</p>}
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-white/[0.03] border border-white/10 rounded-xl p-3 flex items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold">{offer.model || offer.device || "Device"}</p>
                <p className="text-[11px] text-[#bdbdbd]">{[offer.storage, offer.condition, offer.carrier].filter(Boolean).join(" · ")}</p>
              </div>
              {offer.quote && <p className="text-[#00c853] font-bold">{offer.quote.startsWith("$") ? offer.quote : `$${offer.quote}`}</p>}
            </div>
          )}
        </div>

        {/* Contact info */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-5 mb-5">
          <p className="text-[10px] uppercase tracking-[0.18em] text-[#00c853] font-bold mb-3">Contact info</p>
          {offer.name && <p className="text-sm font-semibold mb-1">{offer.name}</p>}
          {offer.shipAddress && (
            <p className="text-[#bdbdbd] text-xs leading-relaxed">
              {offer.shipAddress.street}{offer.shipAddress.unit ? `, ${offer.shipAddress.unit}` : ""}<br />
              {offer.shipAddress.city}, {offer.shipAddress.state} {offer.shipAddress.zip}
            </p>
          )}
          {offer.localSlot && (
            <p className="text-[#bdbdbd] text-xs">🤝 Local meetup · {offer.localSlot}</p>
          )}
          <div className="mt-2 flex flex-col gap-1">
            {offer.phone && <p className="text-[#bdbdbd] text-xs">📱 {offer.phone}</p>}
            {offer.email && <p className="text-[#bdbdbd] text-xs">✉️ {offer.email}</p>}
          </div>
        </div>

        {/* Modify / cancel — placeholder (real workflows route through staff) */}
        {!isPaid && !isCancelled && (
          <div className="bg-white/[0.02] border border-white/8 rounded-2xl p-5 mb-5">
            <p className="text-[10px] uppercase tracking-[0.18em] text-[#888] font-bold mb-2">Need to make a change?</p>
            <p className="text-[#bdbdbd] text-xs mb-3 leading-relaxed">
              You can modify or cancel this offer up until we&apos;ve received it. Email us with your offer number above and we&apos;ll handle it.
            </p>
            <div className="flex flex-col sm:flex-row gap-2">
              <a
                href={`mailto:CustomerService@topcashcells.com?subject=${encodeURIComponent("Modify offer " + offer.id)}`}
                className="flex-1 px-4 py-2.5 bg-white/5 border border-white/15 rounded-xl text-sm font-semibold text-center hover:bg-white/10 transition"
              >
                ✏️ Modify offer
              </a>
              <a
                href={`mailto:CustomerService@topcashcells.com?subject=${encodeURIComponent("Cancel offer " + offer.id)}`}
                className="flex-1 px-4 py-2.5 bg-white/5 border border-red-500/20 text-[#ff8088] rounded-xl text-sm font-semibold text-center hover:bg-red-500/10 transition"
              >
                ✕ Cancel offer
              </a>
            </div>
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
