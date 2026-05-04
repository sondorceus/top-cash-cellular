"use client";

import { useState, useEffect, Suspense, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

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
}

const PIPELINE = [
  { value: "quote_requested", label: "Quote requested", icon: "📥" },
  { value: "shipped", label: "Shipped / drop-off", icon: "📦" },
  { value: "received", label: "Received", icon: "📬" },
  { value: "tested", label: "Tested", icon: "🔍" },
  { value: "paid", label: "Paid", icon: "💵" },
];

function statusIndex(status: string): number {
  if (status === "rejected") return -1;
  return PIPELINE.findIndex((s) => s.value === status);
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

function ProgressBar({ status }: { status: string }) {
  if (status === "rejected") {
    return (
      <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 my-3">
        <p className="text-red-400 text-sm font-semibold flex items-center gap-2">
          <span>⚠️</span> Issue with this device — please call (877) 549-2056
        </p>
      </div>
    );
  }
  const idx = statusIndex(status);
  return (
    <div className="my-4">
      <div className="flex items-center justify-between gap-1">
        {PIPELINE.map((step, i) => {
          const done = i < idx;
          const current = i === idx;
          return (
            <div key={step.value} className="flex-1 flex flex-col items-center gap-1.5 min-w-0">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center text-base transition ${
                done ? "bg-[#00c853] text-white" :
                current ? "bg-[#00c853] text-white ring-4 ring-[#00c853]/30 animate-pulse" :
                "bg-white/5 border border-white/10 text-[#666]"
              }`}>
                {done ? "✓" : step.icon}
              </div>
              <p className={`text-[10px] text-center leading-tight ${
                done || current ? "text-white font-semibold" : "text-[#666]"
              }`}>{step.label}</p>
            </div>
          );
        })}
      </div>
      {/* connector line */}
      <div className="relative h-1 bg-white/5 rounded-full -mt-[58px] mx-5 mb-12 -z-10">
        <div className="absolute top-0 left-0 h-full bg-[#00c853] rounded-full transition-all duration-500" style={{ width: `${idx <= 0 ? 0 : (idx / (PIPELINE.length - 1)) * 100}%` }} />
      </div>
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
    <main className="min-h-screen bg-[#0a0a0a] text-white">
      <nav className="sticky top-0 z-40 bg-[#0a0a0a]/95 backdrop-blur-xl border-b border-white/10">
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
          <Link href="/" className="text-xs text-[#888] hover:text-white">← Home</Link>
        </div>
      </nav>

      <div className="max-w-2xl mx-auto px-4 pt-10 pb-16">
        <h1 className="text-3xl md:text-4xl font-bold mb-2">Track your trade-in</h1>
        <p className="text-[#888] mb-8 text-sm">Enter the phone or email you used when submitting. No password — we'll show you every device you've sold to us and where it stands.</p>

        <form onSubmit={(e) => { e.preventDefault(); lookup(contact); }} className="bg-white/5 border border-white/10 rounded-2xl p-5 mb-6 flex gap-2">
          <input
            type="text"
            value={contact}
            onChange={(e) => setContact(e.target.value)}
            placeholder="Phone or email"
            className="flex-1 px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder:text-[#777] focus:outline-none focus:border-[#00c853] transition"
          />
          <button type="submit" disabled={loading || !contact.trim()} className="px-5 py-3 bg-[#00c853] text-white rounded-xl text-sm font-semibold hover:bg-[#00e676] cursor-pointer transition disabled:opacity-50 disabled:cursor-not-allowed">
            {loading ? "…" : "Track"}
          </button>
        </form>

        {error && <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 mb-4 text-sm text-red-400">{error}</div>}

        {searched && !loading && leads.length === 0 && !error && (
          <div className="bg-white/5 border border-white/10 rounded-2xl p-8 text-center">
            <p className="text-2xl mb-2">🔍</p>
            <p className="text-white font-semibold mb-1">No trade-ins found</p>
            <p className="text-[#888] text-sm">Double-check the contact info, or <Link href="/" className="text-[#00c853] hover:underline">start a new quote</Link>.</p>
          </div>
        )}

        {leads.length > 0 && (
          <div className="space-y-4">
            {leads.map((lead) => (
              <div key={lead.id} className="bg-white/5 border border-white/10 rounded-2xl p-5">
                <div className="flex items-start justify-between mb-1">
                  <div>
                    <p className="font-semibold">{lead.model || lead.device || "Trade-in"}</p>
                    <p className="text-[#666] text-xs">{[lead.storage, lead.condition].filter(Boolean).join(" · ")}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[#00c853] font-bold text-lg">{lead.quote}</p>
                    <p className="text-[#666] text-[10px]">{timeAgo(lead.timestamp)}</p>
                  </div>
                </div>
                <ProgressBar status={lead.status} />
                <p className="text-[#666] text-[11px] text-center">
                  {lead.statusUpdatedAt
                    ? `Last update ${timeAgo(lead.statusUpdatedAt)} · ${lead.payout || "TBD"}`
                    : `Submitted · awaiting first update · ${lead.payout || "TBD"}`}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
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
