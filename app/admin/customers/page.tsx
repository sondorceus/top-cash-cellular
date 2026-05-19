"use client";
import { useEffect, useMemo, useState } from "react";

// Customers dashboard — aggregated view across all leads, deduped by
// phone-then-email. Skywalker 2026-05-19 "ready to go live" — needs a
// real customer roster, not just a stream of leads.

interface Customer {
  contactKey: string;
  name?: string;
  phone?: string;
  email?: string;
  leadCount: number;
  totalQuoted: number;
  lastDevice?: string;
  lastSubmissionAt: string;
  firstSubmissionAt: string;
  statuses: Record<string, number>;
  latestStatus?: string;
  smsOptIn?: boolean;
  hasReview?: boolean;
}

interface Payload {
  customers: Customer[];
  counts: { totalCustomers: number; totalLeads: number; totalQuoted: number };
  internalHidden?: number;
}

type SortKey = "recent" | "spend" | "leads" | "name" | "first";

function formatDate(iso: string): string {
  try { return new Date(iso).toLocaleDateString(); } catch { return iso; }
}
function daysAgo(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
}

export default function CustomersPage() {
  const [data, setData] = useState<Payload | null>(null);
  const [filter, setFilter] = useState("");
  const [sort, setSort] = useState<SortKey>("recent");
  const [error, setError] = useState<string | null>(null);
  const [showInternal, setShowInternal] = useState<boolean>(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem("tcc-show-internal");
      if (stored === "1") setShowInternal(true);
    } catch {}
  }, []);

  useEffect(() => {
    const token = typeof window !== "undefined" ? localStorage.getItem("tcc-admin-token") : null;
    fetch(`/api/admin/customers?internal=${showInternal ? "show" : "hide"}`, { headers: token ? { "x-admin-token": token } : {} })
      .then((r) => {
        if (!r.ok) throw new Error(r.status === 401 ? "Unauthorized — open /admin first to set token." : `HTTP ${r.status}`);
        return r.json();
      })
      .then(setData)
      .catch((e) => setError(e.message));
  }, [showInternal]);

  const filtered = useMemo(() => {
    if (!data) return [];
    const f = filter.toLowerCase().trim();
    let rows = data.customers;
    if (f) {
      rows = rows.filter((c) =>
        (c.name?.toLowerCase().includes(f)) ||
        (c.phone?.toLowerCase().includes(f)) ||
        (c.email?.toLowerCase().includes(f)) ||
        (c.lastDevice?.toLowerCase().includes(f))
      );
    }
    rows = [...rows];
    if (sort === "recent")  rows.sort((a, b) => b.lastSubmissionAt.localeCompare(a.lastSubmissionAt));
    if (sort === "first")   rows.sort((a, b) => a.firstSubmissionAt.localeCompare(b.firstSubmissionAt));
    if (sort === "spend")   rows.sort((a, b) => b.totalQuoted - a.totalQuoted);
    if (sort === "leads")   rows.sort((a, b) => b.leadCount - a.leadCount);
    if (sort === "name")    rows.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
    return rows;
  }, [data, filter, sort]);

  if (error) {
    return <main className="min-h-screen bg-[#0a0a0a] text-white p-8"><p className="text-red-400">{error}</p></main>;
  }
  if (!data) {
    return <main className="min-h-screen bg-[#0a0a0a] text-white p-8"><p className="text-[#888]">Loading customers…</p></main>;
  }

  return (
    <main className="min-h-screen bg-[#0a0a0a] text-white">
      <div className="sticky top-0 z-20 bg-[#0a0a0a]/95 backdrop-blur border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-4 flex-wrap">
          <a href="/admin" className="text-[#888] hover:text-[#00c853] text-xs font-semibold transition" title="Back to leads">← Leads</a>
          <a href="/admin/analytics" className="text-[#888] hover:text-[#00c853] text-xs font-semibold transition">📊 Analytics</a>
          <a href="/admin/prices" className="text-[#888] hover:text-[#00c853] text-xs font-semibold transition">💲 Prices</a>
          <h1 className="text-lg font-extrabold tracking-tight">TCC · Customers</h1>
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Search name / phone / email / device…"
            className="flex-1 min-w-[200px] px-3 py-1.5 text-sm bg-black/40 border border-white/15 rounded-lg"
          />
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            className="px-3 py-1.5 text-sm bg-black/40 border border-white/15 rounded-lg cursor-pointer"
          >
            <option value="recent">Most recent activity</option>
            <option value="first">Earliest (oldest customer)</option>
            <option value="spend">Highest total $</option>
            <option value="leads">Most leads</option>
            <option value="name">Name A-Z</option>
          </select>
          <button
            onClick={() => {
              const next = !showInternal;
              setShowInternal(next);
              try { localStorage.setItem("tcc-show-internal", next ? "1" : "0"); } catch {}
            }}
            className={`px-3 py-1.5 rounded-lg border text-xs font-semibold cursor-pointer transition ${
              showInternal
                ? "bg-yellow-500/15 border-yellow-500/40 text-yellow-300 hover:bg-yellow-500/25"
                : "bg-white/5 border-white/15 text-[#888] hover:bg-white/10 hover:text-white"
            }`}
            title="Toggle internal/test customer visibility"
          >
            {showInternal
              ? "🔓 Internal: ON"
              : `🔒 Internal hidden${data?.internalHidden ? ` (${data.internalHidden})` : ""}`}
          </button>
        </div>
        <div className="max-w-7xl mx-auto px-4 pb-2 flex items-center gap-4 text-xs text-[#aaa] flex-wrap">
          <span><b className="text-white">{data.counts.totalCustomers}</b> unique customers</span>
          <span><b className="text-white">{data.counts.totalLeads}</b> total leads</span>
          <span><b className="text-white">${data.counts.totalQuoted.toLocaleString()}</b> total quoted</span>
          {filter && <span className="text-[#00c853]">→ showing {filtered.length}</span>}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-4 space-y-2">
        {filtered.map((c) => {
          const isReturning = c.leadCount > 1;
          const days = daysAgo(c.lastSubmissionAt);
          const recencyTone =
            days <= 1   ? "text-[#00c853]" :
            days <= 7   ? "text-yellow-300" :
            days <= 30  ? "text-[#aaa]" :
            "text-[#666]";
          return (
            <div key={c.contactKey} className="bg-white/[0.03] border border-white/10 rounded-xl p-3 hover:bg-white/[0.05] transition">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-[15px] font-bold">{c.name || "Unnamed customer"}</h3>
                    {isReturning && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#00c853]/15 text-[#00c853] border border-[#00c853]/30">
                        ↻ {c.leadCount}x returning
                      </span>
                    )}
                    {c.hasReview && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-yellow-500/15 text-yellow-300 border border-yellow-500/30">
                        ★ reviewed
                      </span>
                    )}
                    {c.smsOptIn === true && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-500/15 text-blue-300 border border-blue-500/30">
                        SMS ✓
                      </span>
                    )}
                  </div>
                  <p className="text-[12px] text-[#888] mt-0.5">
                    {c.phone && <span>{c.phone}</span>}
                    {c.phone && c.email && <span className="mx-2">·</span>}
                    {c.email && <span>{c.email}</span>}
                  </p>
                  <p className="text-[12px] text-[#aaa] mt-1">
                    Last: <span className="text-white">{c.lastDevice || "—"}</span>
                    <span className="mx-2 text-[#555]">·</span>
                    <span className={recencyTone}>{days === 0 ? "today" : days === 1 ? "yesterday" : `${days}d ago`}</span>
                    <span className="mx-2 text-[#555]">·</span>
                    <span className="text-[#888]">latest: {c.latestStatus || "—"}</span>
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[18px] font-extrabold text-[#00c853]">${c.totalQuoted.toLocaleString()}</p>
                  <p className="text-[10px] text-[#888]">total quoted</p>
                  <p className="text-[10px] text-[#888] mt-1">since {formatDate(c.firstSubmissionAt)}</p>
                </div>
              </div>
              {Object.keys(c.statuses).length > 1 && (
                <div className="mt-2 flex items-center gap-1.5 flex-wrap text-[10px] font-mono">
                  {Object.entries(c.statuses).sort((a, b) => b[1] - a[1]).map(([s, n]) => (
                    <span key={s} className="px-1.5 py-0.5 rounded bg-white/[0.04] border border-white/10 text-[#aaa]">
                      {s}: {n}
                    </span>
                  ))}
                </div>
              )}
            </div>
          );
        })}
        {filtered.length === 0 && (
          <p className="text-center text-[#666] py-12">No customers match the filter.</p>
        )}
      </div>
    </main>
  );
}
