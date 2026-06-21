"use client";

import { useState, useEffect, Suspense, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { SlideOnScrollNav } from "../components/SlideOnScrollNav";
import { HeaderSearch } from "../components/HeaderSearch";
import SiteFooter from "../components/SiteFooter";

interface Lead {
  id: string;
  timestamp: string;
  device?: string;
  model?: string;
  storage?: string;
  condition?: string;
  quote?: string;
  payout?: string;
  status: string;
  statusUpdatedAt?: string;
  payoutProof?: { method?: string; reference?: string; amount?: number; at?: string };
  fedexTracking?: string;
  fedexLabelUrl?: string;
  fedexService?: string;
  shipExpectingLabel?: boolean;
  handoffMethod?: "ship" | "local";
  fedexState?: string;
  fedexEventDesc?: string;
  fedexStateAt?: string;
}

// Pretty-print a recorded payout method for the receipt line.
function payoutMethodLabel(m?: string): string {
  if (!m) return "your chosen method";
  const k = m.toLowerCase().trim();
  const map: Record<string, string> = {
    cashapp: "Cash App", "cash app": "Cash App", cash: "cash",
    zelle: "Zelle", venmo: "Venmo", paypal: "PayPal",
    btc: "Bitcoin", bitcoin: "Bitcoin", ach: "ACH", check: "check",
  };
  return map[k] || m.trim();
}

// Shared funnel glyphs (matches the offer page so both surfaces show
// the same pipeline icons + labels). Skywalker 2026-05-22.
const INBOX_ICON = "M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z";
const TRUCK_ICON = "M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-14L4 7m8 4v10M4 7v10l8 4";
const SEARCH_ICON = "M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z";
const CASH_ICON = "M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z";
const MEETUP_ICON = "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z";

// Two funnels — same split as the offer page. Shipping has a transit
// leg the customer watches from afar; local meetups collapse to a
// single "Met Up" stage in between Submitted and Paid.
const SHIP_PIPELINE = [
  { value: "quote_requested", label: "Submitted", icon: INBOX_ICON },
  { value: "shipped", label: "Shipped", icon: TRUCK_ICON },
  { value: "received", label: "Received", icon: INBOX_ICON },
  { value: "tested", label: "Inspected", icon: SEARCH_ICON },
  { value: "paid", label: "Paid", icon: CASH_ICON },
];

const LOCAL_PIPELINE = [
  { value: "quote_requested", label: "Submitted", icon: INBOX_ICON },
  { value: "received", label: "Met Up", icon: MEETUP_ICON },
  { value: "paid", label: "Paid", icon: CASH_ICON },
];

function pipelineFor(isShip: boolean) {
  return isShip ? SHIP_PIPELINE : LOCAL_PIPELINE;
}

function statusIndex(s: string, isShip: boolean): number {
  if (s === "rejected") return -1;
  const pipeline = pipelineFor(isShip);
  if (s === "met") return pipeline.length - 1;
  // Local funnel has no transit / inspection stage — fold any
  // shipping-only status ("shipped", "received", "tested") onto the
  // in-person "Met Up" stage.
  if (!isShip && (s === "shipped" || s === "tested")) {
    return pipeline.findIndex((p) => p.value === "received");
  }
  return pipeline.findIndex((p) => p.value === s);
}

function timeAgo(iso?: string): string {
  if (!iso) return "";
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.floor(ms / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const d = Math.floor(hr / 24);
  return `${d}d ago`;
}

function ProgressBar({ status, isShip }: { status: string; isShip: boolean }) {
  if (status === "rejected") {
    return (
      <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 my-3">
        <p className="text-red-400 text-sm font-semibold flex items-center gap-2">
          <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg> Issue with this device — please email support@topcashcellular.com
        </p>
      </div>
    );
  }
  const pipeline = pipelineFor(isShip);
  const idx = statusIndex(status, isShip);
  return (
    <div className="my-4">
      <div className="flex items-center justify-between gap-1">
        {pipeline.map((step, i) => {
          const done = i < idx;
          const current = i === idx;
          return (
            <div key={step.value} className="flex-1 flex flex-col items-center gap-1.5 min-w-0">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center transition ${
                done ? "bg-[#00c853] text-[#0a0a0a]" :
                current ? "bg-[#00c853] text-[#0a0a0a] ring-4 ring-[#00c853]/30 animate-pulse" :
                "bg-white/5 border border-white/10 text-[#c5c5c5]"
              }`}>
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d={done ? "M5 13l4 4L19 7" : step.icon} />
                </svg>
              </div>
              <p className={`text-[10px] text-center leading-tight ${
                done || current ? "text-white font-semibold" : "text-[#c5c5c5]"
              }`}>{step.label}</p>
            </div>
          );
        })}
      </div>
      {/* connector line */}
      <div className="relative h-1 bg-white/5 rounded-full -mt-[58px] mx-5 mb-12 -z-10">
        <div className="absolute top-0 left-0 h-full bg-[#00c853] rounded-full transition-all duration-[450ms]" style={{ width: `${idx <= 0 ? 0 : (idx / (pipeline.length - 1)) * 100}%` }} />
      </div>
    </div>
  );
}

// Granular FedEx delivery sub-stages, shown during the in-transit leg
// (between the coarse "Shipped" and "Received" pipeline steps) so the
// customer can watch the package move. States come from /api/track, which
// reads the fedex-poll cron's [FEDEX-EVENT: …] markers. "picked_up" is
// FedEx's PU/IT/AR — i.e. the box is moving.
const DELIVERY_STAGES = [
  { state: "label_created", label: "Label made", icon: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" },
  { state: "picked_up", label: "In transit", icon: TRUCK_ICON },
  { state: "out_for_delivery", label: "Out for delivery", icon: "M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z M15 11a3 3 0 11-6 0 3 3 0 016 0z" },
  { state: "delivered", label: "Delivered", icon: "M5 13l4 4L19 7" },
];

function DeliveryTracker({ state, desc, at }: { state?: string; desc?: string; at?: string }) {
  if (!state) return null;
  if (state === "exception") {
    return (
      <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 mb-3">
        <p className="text-amber-300 text-sm font-semibold mb-1 flex items-center gap-2">
          <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
          Delivery exception
        </p>
        <p className="text-[#dcdcdc] text-xs leading-relaxed">{desc || "FedEx reported a hold or issue with this package."} We&apos;re keeping an eye on it — email <a href="mailto:support@topcashcellular.com" className="underline">support@topcashcellular.com</a> if you have questions.</p>
      </div>
    );
  }
  const idx = DELIVERY_STAGES.findIndex((s) => s.state === state);
  if (idx < 0) return null; // unknown — don't render a misleading tracker
  const delivered = state === "delivered";
  return (
    <div className="bg-white/5 border border-white/10 rounded-xl p-4 mb-3">
      <p className="text-[10px] uppercase tracking-[0.18em] text-[#00c853] font-bold mb-3">Where&apos;s your package?</p>
      <div className="flex items-center justify-between gap-1">
        {DELIVERY_STAGES.map((s, i) => {
          const done = i < idx || delivered;
          const current = i === idx && !delivered;
          return (
            <div key={s.state} className="flex-1 flex flex-col items-center gap-1.5 min-w-0">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center transition ${
                done ? "bg-[#00c853] text-[#0a0a0a]" :
                current ? "bg-[#00c853] text-[#0a0a0a] ring-4 ring-[#00c853]/30 animate-pulse" :
                "bg-white/5 border border-white/10 text-[#c5c5c5]"
              }`}>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d={done ? "M5 13l4 4L19 7" : s.icon} />
                </svg>
              </div>
              <p className={`text-[9px] text-center leading-tight ${done || current ? "text-white font-semibold" : "text-[#c5c5c5]"}`}>{s.label}</p>
            </div>
          );
        })}
      </div>
      {(desc || at) && (
        <p className="text-[#c5c5c5] text-[10px] mt-3 text-center">{desc}{desc && at ? " · " : ""}{at ? timeAgo(at) : ""}</p>
      )}
    </div>
  );
}

function TrackInner() {
  const searchParams = useSearchParams();
  const [contact, setContact] = useState("");
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);

  const lookup = useCallback(async (input: string) => {
    if (!input.trim()) return;
    setLoading(true);
    setError(null);
    setSearched(true);
    const isEmail = input.includes("@");
    try {
      const r = await fetch("/api/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(isEmail ? { email: input } : { phone: input }),
      });
      const d = await r.json();
      if (d.found) {
        setLeads(d.leads || []);
      } else {
        setLeads([]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Lookup failed");
    } finally {
      setLoading(false);
    }
  }, []);

  // Auto-lookup if ?phone= or ?email= passed in URL
  useEffect(() => {
    const p = searchParams.get("phone");
    const e = searchParams.get("email");
    if (p) {
      setContact(p);
      lookup(p);
    } else if (e) {
      setContact(e);
      lookup(e);
    }
  }, [searchParams, lookup]);

  return (
    <main className="min-h-screen flex flex-col bg-[#0a0a0a] text-white">
      <SlideOnScrollNav className="sticky top-0 z-40 bg-[#0a0a0a]/95 backdrop-blur-xl border-b border-white/10">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <span className="w-9 h-9 rounded-xl bg-black border border-white/15 flex items-center justify-center">
              <span className="w-6 h-6 rounded-lg bg-[#00c853] flex items-center justify-center">
                <svg viewBox="0 0 24 24" className="w-3.5 h-5" fill="none" stroke="#fff" strokeWidth="2">
                  <rect x="6" y="2" width="12" height="20" rx="2.5" />
                  <line x1="10" y1="19" x2="14" y2="19" strokeLinecap="round" />
                </svg>
              </span>
            </span>
            <div className="flex flex-col leading-none">
              <span className="text-[14px] font-extrabold tracking-tight text-white">TOP CASH</span>
              <span className="text-[10px] font-bold tracking-[0.2em] text-[#00c853] uppercase">Cellular</span>
            </div>
          </Link>
          <div className="flex items-center gap-3">
            <HeaderSearch className="flex w-40 sm:w-56 md:w-64" />
            <Link href="/" className="text-xs text-[#dcdcdc] hover:text-white whitespace-nowrap">← Home</Link>
          </div>
        </div>
      </SlideOnScrollNav>

      <div className="max-w-2xl mx-auto px-4 pt-10 pb-16">
        <h1 className="text-3xl md:text-4xl font-bold mb-2">Track your trade-in</h1>
        <p className="text-[#dcdcdc] mb-8 text-sm">Enter the phone or email you used when submitting. No password — we'll show you every device you've sold to us and where it stands.</p>

        <form onSubmit={(e) => { e.preventDefault(); lookup(contact); }} className="bg-white/5 border border-white/10 rounded-2xl p-5 mb-6 flex gap-2">
          <input
            type="text"
            value={contact}
            onChange={(e) => setContact(e.target.value)}
            placeholder="Phone or email"
            className="flex-1 px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder:text-[#d4d4d4] focus:outline-none focus:border-[#00c853] transition"
          />
          <button type="submit" disabled={loading || !contact.trim()} className="px-5 py-3 bg-[#00c853] text-[#0a0a0a] rounded-xl text-sm font-semibold hover:bg-[#00e676] cursor-pointer transition disabled:opacity-50 disabled:cursor-not-allowed">
            {loading ? "…" : "Track"}
          </button>
        </form>

        {error && <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 mb-4 text-sm text-red-400">{error}</div>}

        {searched && !loading && leads.length === 0 && !error && (
          <div className="bg-white/5 border border-white/10 rounded-2xl p-8 text-center">
            <svg className="w-7 h-7 text-[#00c853] mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            <p className="text-white font-semibold mb-1">No trade-ins found</p>
            <p className="text-[#dcdcdc] text-sm">Double-check the contact info, or <Link href="/" className="text-[#00c853] hover:underline">start a new quote</Link>.</p>
          </div>
        )}

        {leads.length > 0 && (
          <div className="space-y-4">
            {leads.map((lead) => (
              <div key={lead.id} className="bg-white/5 border border-white/10 rounded-2xl p-5">
                <div className="flex items-start justify-between mb-1">
                  <div>
                    <p className="font-semibold">{lead.model || lead.device || "Trade-in"}</p>
                    <p className="text-[#c5c5c5] text-xs">{[lead.storage, lead.condition].filter(Boolean).join(" · ")}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[#00c853] font-bold text-lg">{lead.quote}</p>
                    <p className="text-[#c5c5c5] text-[10px]">{timeAgo(lead.timestamp)}</p>
                  </div>
                </div>
                <ProgressBar status={lead.status} isShip={lead.handoffMethod === "ship"} />
                {lead.fedexTracking && lead.fedexLabelUrl && (
                  <div className="bg-[#00c853]/10 border border-[#00c853]/30 rounded-xl p-4 mb-3">
                    <p className="text-[10px] uppercase tracking-[0.18em] text-[#00c853] font-bold mb-1">Your FedEx label</p>
                    <p className="text-white text-sm font-mono mb-3 break-all">{lead.fedexTracking}</p>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <a
                        href={lead.fedexLabelUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 px-4 py-2.5 bg-[#00c853] text-[#0a0a0a] rounded-lg text-sm font-semibold text-center hover:bg-[#00e676] transition inline-flex items-center justify-center gap-2"
                      >
                        <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                        Download label (PDF)
                      </a>
                      <a
                        href={`https://www.fedex.com/fedextrack/?trknbr=${encodeURIComponent(lead.fedexTracking)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 px-4 py-2.5 bg-white/5 border border-white/15 text-white rounded-lg text-sm font-semibold text-center hover:bg-white/10 transition"
                      >
                        Track on FedEx →
                      </a>
                    </div>
                    {lead.fedexService && (
                      <p className="text-[#c5c5c5] text-[10px] mt-2">Service: {lead.fedexService}</p>
                    )}
                  </div>
                )}
                {/* Live delivery sub-tracker — only while the package is in
                    transit to us (before staff marks it Received, which the
                    coarse pipeline above then reflects). */}
                {lead.fedexState && lead.fedexTracking && (lead.status === "shipped" || lead.status === "quote_requested") && (
                  <DeliveryTracker state={lead.fedexState} desc={lead.fedexEventDesc} at={lead.fedexStateAt} />
                )}
                {lead.shipExpectingLabel && !lead.fedexTracking && (
                  <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 mb-3">
                    <p className="text-amber-300 text-sm font-semibold mb-1 flex items-center gap-2"><svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-14L4 7m8 4v10M4 7v10l8 4" /></svg> Label is on the way</p>
                    <p className="text-[#dcdcdc] text-xs leading-relaxed">
                      Your shipping label is being prepared. If you don't see it in your email within an hour, reply to <a href="mailto:support@topcashcellular.com" className="underline">support@topcashcellular.com</a> with this lead ID and we'll resend it.
                    </p>
                    <p className="text-[#c5c5c5] text-[10px] font-mono mt-2">Lead ID: {lead.id}</p>
                  </div>
                )}
                {lead.payoutProof && (lead.status === "paid" || lead.status === "met") && (
                  <div className="bg-[#00c853]/[0.06] border border-[#00c853]/40 rounded-xl p-3 mb-3">
                    <p className="text-white text-sm font-bold flex items-center gap-2">
                      <svg className="w-4 h-4 shrink-0 text-[#00c853]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                      Payment sent{lead.payoutProof.amount != null ? ` — $${lead.payoutProof.amount.toLocaleString()}` : ""} via {payoutMethodLabel(lead.payoutProof.method)}
                    </p>
                    {lead.payoutProof.reference && (
                      <p className="text-[#bdbdbd] text-[11px] mt-1">Ref <span className="font-mono text-[#dcdcdc] break-all">{lead.payoutProof.reference}</span></p>
                    )}
                  </div>
                )}
                <p className="text-[#c5c5c5] text-[11px] text-center">
                  {lead.statusUpdatedAt
                    ? `Last update ${timeAgo(lead.statusUpdatedAt)} · ${lead.payout || "TBD"}`
                    : `Submitted · awaiting first update · ${lead.payout || "TBD"}`}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      <SiteFooter />
    </main>
  );
}

export default function TrackPage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-[#0a0a0a]" />}>
      <TrackInner />
    </Suspense>
  );
}
