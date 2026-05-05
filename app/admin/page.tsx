"use client";

import { useEffect, useState, useCallback } from "react";

interface Lead {
  id: string;
  timestamp: string;
  name?: string;
  phone?: string;
  email?: string;
  device?: string;
  model?: string;
  storage?: string;
  condition?: string;
  quote?: string;
  payout?: string;
  imei?: string;
  imeiWarnings?: string[];
  photos?: string[];
  status: string;
  statusUpdatedAt?: string;
  latestNote?: string;
  latestNoteAt?: string;
  noteCount?: number;
  duplicateCount?: number;
  duplicateIds?: string[];
}

const STATUS_OPTIONS = [
  { value: "quote_requested", label: "📥 Quote requested", color: "#888" },
  { value: "shipped", label: "📦 Shipped / drop-off", color: "#4fc3f7" },
  { value: "received", label: "📬 Received", color: "#7c4dff" },
  { value: "tested", label: "🔍 Tested", color: "#ff9100" },
  { value: "paid", label: "💵 Paid", color: "#00c853" },
  { value: "rejected", label: "❌ Rejected", color: "#ef5350" },
];

function statusMeta(value: string) {
  return STATUS_OPTIONS.find((s) => s.value === value) || STATUS_OPTIONS[0];
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

export default function AdminPage() {
  const [token, setToken] = useState<string>("");
  const [tokenInput, setTokenInput] = useState<string>("");
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingStatus, setPendingStatus] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [savedFlash, setSavedFlash] = useState<Record<string, { sms: boolean; email: boolean } | null>>({});
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState<string>("");
  const [noteOpenId, setNoteOpenId] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState<string>("");
  const [noteSavingId, setNoteSavingId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkStatus, setBulkStatus] = useState<string>("");
  const [bulkSaving, setBulkSaving] = useState(false);
  const [bulkProgress, setBulkProgress] = useState<{ done: number; total: number } | null>(null);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const runBulkStatus = async (newStatus: string) => {
    if (!token || !newStatus || selectedIds.size === 0) return;
    setBulkSaving(true);
    const ids = Array.from(selectedIds);
    setBulkProgress({ done: 0, total: ids.length });
    try {
      for (let i = 0; i < ids.length; i++) {
        const lead = leads.find((l) => l.id === ids[i]);
        if (!lead) { setBulkProgress({ done: i + 1, total: ids.length }); continue; }
        if (lead.status === newStatus) { setBulkProgress({ done: i + 1, total: ids.length }); continue; }
        try {
          await fetch(`/api/admin/leads/status?token=${encodeURIComponent(token)}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              leadId: lead.id,
              status: newStatus,
              name: lead.name,
              phone: lead.phone,
              email: lead.email,
              device: lead.model || lead.device,
              quote: lead.quote,
              payout: lead.payout,
              rejectionReason: newStatus === "rejected" ? "Bulk update — see operator for details" : undefined,
            }),
          });
          setLeads((cur) => cur.map((l) => (l.id === lead.id ? { ...l, status: newStatus, statusUpdatedAt: new Date().toISOString() } : l)));
        } catch {}
        setBulkProgress({ done: i + 1, total: ids.length });
      }
      setSelectedIds(new Set());
      setBulkStatus("");
    } finally {
      setBulkSaving(false);
      setTimeout(() => setBulkProgress(null), 1500);
    }
  };

  const saveNote = async (lead: Lead) => {
    if (!token || !noteDraft.trim()) return;
    setNoteSavingId(lead.id);
    try {
      const r = await fetch(`/api/admin/leads/note?token=${encodeURIComponent(token)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadId: lead.id, note: noteDraft }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      setLeads((cur) => cur.map((l) => (l.id === lead.id ? { ...l, latestNote: noteDraft.trim(), latestNoteAt: new Date().toISOString(), noteCount: (l.noteCount || 0) + 1 } : l)));
      setNoteDraft("");
      setNoteOpenId(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Note save failed");
    } finally {
      setNoteSavingId(null);
    }
  };
  const [statusFilter, setStatusFilter] = useState<string>("active");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Hydrate token from URL or localStorage
  useEffect(() => {
    if (typeof window === "undefined") return;
    const urlToken = new URLSearchParams(window.location.search).get("token");
    const stored = localStorage.getItem("tcc-admin-token");
    if (urlToken) {
      setToken(urlToken);
      localStorage.setItem("tcc-admin-token", urlToken);
    } else if (stored) {
      setToken(stored);
    }
  }, []);

  const fetchLeads = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(`/api/admin/leads?token=${encodeURIComponent(token)}`, { cache: "no-store" });
      if (r.status === 401) {
        setError("Invalid token");
        setToken("");
        localStorage.removeItem("tcc-admin-token");
        return;
      }
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const d = await r.json();
      setLeads(d.leads || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load leads");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (token) fetchLeads();
  }, [token, fetchLeads]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!tokenInput.trim()) return;
    setToken(tokenInput.trim());
    localStorage.setItem("tcc-admin-token", tokenInput.trim());
  };

  const handleLogout = () => {
    setToken("");
    setLeads([]);
    localStorage.removeItem("tcc-admin-token");
  };

  const matchesSearch = (lead: Lead, q: string): boolean => {
    if (!q) return true;
    const needle = q.toLowerCase();
    const hay = [
      lead.name,
      lead.phone,
      lead.email,
      lead.device,
      lead.model,
      lead.storage,
      lead.condition,
      lead.imei,
      lead.payout,
    ].filter(Boolean).join(" ").toLowerCase();
    return hay.includes(needle);
  };

  // Client-side de-dupe: collapse near-identical lead submissions (same contact +
  // same device + same quote within 24h) into a single row, with a count of
  // earlier duplicates attached to the canonical (newest) lead.
  const dedupeLeads = (list: Lead[]): Lead[] => {
    const sorted = [...list].sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    const dayMs = 24 * 3600 * 1000;
    const groups = new Map<string, Lead & { duplicateCount?: number; duplicateIds?: string[] }>();
    for (const lead of sorted) {
      const contact = (lead.email || lead.phone || "").toLowerCase().replace(/\D/g, "");
      const key = `${contact}|${(lead.model || lead.device || "").toLowerCase()}|${(lead.quote || "").toLowerCase()}`;
      const existing = groups.get(key);
      if (!existing) {
        groups.set(key, { ...lead });
        continue;
      }
      const existingTs = new Date(existing.timestamp).getTime();
      const leadTs = new Date(lead.timestamp).getTime();
      if (Math.abs(existingTs - leadTs) < dayMs) {
        existing.duplicateCount = (existing.duplicateCount || 0) + 1;
        existing.duplicateIds = [...(existing.duplicateIds || []), lead.id];
        // If the older one is "completed" (paid/rejected) and current is also
        // a dupe, prefer keeping that completion status visible — already handled
        // since `existing` is the newest by sort.
      } else {
        // Outside dedup window — treat as separate
        groups.set(`${key}|${lead.id}`, { ...lead });
      }
    }
    return Array.from(groups.values()).sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  };

  const dedupedLeads = dedupeLeads(leads);
  const filteredLeads = dedupedLeads.filter((l) => matchesSearch(l, searchQuery));

  const computeStats = (list: Lead[]) => {
    const now = Date.now();
    const weekAgo = now - 7 * 24 * 3600 * 1000;
    const monthAgo = now - 30 * 24 * 3600 * 1000;
    let thisWeek = 0;
    let thisMonth = 0;
    let paidCount = 0;
    let nonRejectedCount = 0;
    let quoteSum = 0;
    let quoteN = 0;
    const payoutTally: Record<string, number> = {};
    for (const l of list) {
      const ts = new Date(l.timestamp).getTime();
      if (ts >= weekAgo) thisWeek++;
      if (ts >= monthAgo) thisMonth++;
      if (l.status === "paid") paidCount++;
      if (l.status !== "rejected") nonRejectedCount++;
      const dollars = l.quote?.match(/\d+/)?.[0];
      if (dollars) {
        const n = parseInt(dollars, 10);
        if (!isNaN(n) && n > 0) { quoteSum += n; quoteN++; }
      }
      if (l.payout && l.payout !== "TBD") {
        payoutTally[l.payout] = (payoutTally[l.payout] || 0) + 1;
      }
    }
    const avgQuote = quoteN > 0 ? Math.round(quoteSum / quoteN) : 0;
    const conversionRate = nonRejectedCount > 0 ? Math.round((paidCount / nonRejectedCount) * 100) : 0;
    const topPayouts = Object.entries(payoutTally).sort((a, b) => b[1] - a[1]).slice(0, 3);
    return { total: list.length, thisWeek, thisMonth, conversionRate, avgQuote, topPayouts };
  };
  const stats = computeStats(dedupedLeads);

  const saveStatus = async (lead: Lead, newStatus: string, reason?: string) => {
    if (!token || newStatus === lead.status) return;
    setSavingId(lead.id);
    try {
      const r = await fetch(`/api/admin/leads/status?token=${encodeURIComponent(token)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leadId: lead.id,
          status: newStatus,
          name: lead.name,
          phone: lead.phone,
          email: lead.email,
          device: lead.model || lead.device,
          quote: lead.quote,
          payout: lead.payout,
          rejectionReason: newStatus === "rejected" ? reason : undefined,
        }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const d = await r.json();
      setLeads((cur) => cur.map((l) => (l.id === lead.id ? { ...l, status: newStatus, statusUpdatedAt: new Date().toISOString() } : l)));
      setPendingStatus((p) => { const c = { ...p }; delete c[lead.id]; return c; });
      setSavedFlash((s) => ({ ...s, [lead.id]: { sms: !!d.smsSent, email: !!d.emailSent } }));
      setTimeout(() => setSavedFlash((s) => ({ ...s, [lead.id]: null })), 3500);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSavingId(null);
    }
  };

  // Token gate
  if (!token) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-black text-white px-4">
        <form onSubmit={handleLogin} className="w-full max-w-sm bg-white/5 border border-white/10 rounded-2xl p-6">
          <h1 className="text-xl font-bold mb-1">TCC Staff Ops</h1>
          <p className="text-[#888] text-sm mb-5">Enter admin token to continue.</p>
          <input
            type="password"
            value={tokenInput}
            onChange={(e) => setTokenInput(e.target.value)}
            placeholder="admin token"
            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder:text-[#777] focus:outline-none focus:border-[#00c853] focus:ring-4 focus:ring-[#00c853]/10 transition mb-3"
            autoFocus
          />
          {error && <p className="text-[#ef5350] text-xs mb-3">{error}</p>}
          <button type="submit" className="w-full bg-[#00c853] text-white py-3 rounded-xl text-sm font-semibold cursor-pointer hover:bg-[#00e676] transition">
            Sign in
          </button>
        </form>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black text-white">
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">TCC Staff Ops</h1>
            <p className="text-[#888] text-sm">
              {(() => {
                const statusFiltered = filteredLeads.filter((l) => {
                  if (statusFilter === "all") return true;
                  if (statusFilter === "active") return l.status !== "paid" && l.status !== "rejected";
                  if (statusFilter === "completed") return l.status === "paid" || l.status === "rejected";
                  return l.status === statusFilter;
                });
                if (statusFilter === "all" && !searchQuery) {
                  const dupeNote = leads.length !== dedupedLeads.length ? ` (${leads.length - dedupedLeads.length} dupes merged)` : "";
                  return `${dedupedLeads.length} unique lead${dedupedLeads.length === 1 ? "" : "s"}${dupeNote}`;
                }
                const labels: Record<string, string> = { active: "active", completed: "completed", all: "all" };
                const label = labels[statusFilter] || statusFilter.replace("_", " ");
                return `${statusFiltered.length} of ${dedupedLeads.length} · ${label}${searchQuery ? ` · matching "${searchQuery}"` : ""}`;
              })()}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={fetchLeads} disabled={loading} className="px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-sm hover:bg-white/10 transition disabled:opacity-50 cursor-pointer">
              {loading ? "Loading…" : "Refresh"}
            </button>
            <button onClick={handleLogout} className="px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-sm hover:bg-white/10 transition cursor-pointer">
              Sign out
            </button>
          </div>
        </div>

        {leads.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
            <div className="bg-white/5 border border-white/10 rounded-xl p-3">
              <p className="text-[10px] uppercase tracking-wider text-[#666] font-bold">This week</p>
              <p className="text-2xl font-extrabold text-white mt-0.5">{stats.thisWeek}</p>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-xl p-3">
              <p className="text-[10px] uppercase tracking-wider text-[#666] font-bold">This month</p>
              <p className="text-2xl font-extrabold text-white mt-0.5">{stats.thisMonth}</p>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-xl p-3">
              <p className="text-[10px] uppercase tracking-wider text-[#666] font-bold">Total leads</p>
              <p className="text-2xl font-extrabold text-white mt-0.5">{stats.total}</p>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-xl p-3">
              <p className="text-[10px] uppercase tracking-wider text-[#666] font-bold">Conversion</p>
              <p className="text-2xl font-extrabold text-[#00c853] mt-0.5">{stats.conversionRate}%</p>
              <p className="text-[10px] text-[#666] mt-0.5">paid / non-rejected</p>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-xl p-3 col-span-2 md:col-span-1">
              <p className="text-[10px] uppercase tracking-wider text-[#666] font-bold">Avg quote</p>
              <p className="text-2xl font-extrabold text-white mt-0.5">${stats.avgQuote}</p>
              {stats.topPayouts.length > 0 && (
                <p className="text-[10px] text-[#888] mt-0.5 truncate" title={stats.topPayouts.map(([p, n]) => `${p} (${n})`).join(", ")}>
                  Top payout: {stats.topPayouts[0][0]}
                </p>
              )}
            </div>
          </div>
        )}

        {leads.length > 0 && (
          <div className="relative mb-3">
            <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#666]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M10.5 18a7.5 7.5 0 100-15 7.5 7.5 0 000 15z" /></svg>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search name, phone, email, device, IMEI…"
              className="w-full pl-10 pr-10 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder:text-[#777] focus:outline-none focus:border-[#00c853] focus:ring-2 focus:ring-[#00c853]/20 transition"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery("")} aria-label="Clear search" className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-white/10 text-[#aaa] text-xs hover:bg-white/20 cursor-pointer">×</button>
            )}
          </div>
        )}

        {error && <div className="bg-[#ef5350]/10 border border-[#ef5350]/30 rounded-xl p-4 mb-4 text-sm text-[#ef5350]">{error}</div>}

        {leads.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {(() => {
              const isCompleted = (s: string) => s === "paid" || s === "rejected";
              const counts: Record<string, number> = {
                all: filteredLeads.length,
                active: filteredLeads.filter((l) => !isCompleted(l.status)).length,
                completed: filteredLeads.filter((l) => isCompleted(l.status)).length,
              };
              for (const l of filteredLeads) counts[l.status] = (counts[l.status] || 0) + 1;
              const chip = (value: string, label: string, color?: string) => {
                const active = statusFilter === value;
                const count = counts[value] || 0;
                if (value !== "all" && value !== "active" && count === 0) return null;
                return (
                  <button
                    key={value}
                    onClick={() => setStatusFilter(value)}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition flex items-center gap-1.5 cursor-pointer ${
                      active
                        ? "bg-[#00c853] text-white border-[#00c853]"
                        : "bg-white/5 text-[#aaa] border-white/10 hover:bg-white/10"
                    }`}
                    style={active && value !== "all" && value !== "active" && color ? { backgroundColor: color, borderColor: color } : undefined}
                  >
                    <span>{label}</span>
                    <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${active ? "bg-white/20" : "bg-white/10"}`}>{count}</span>
                  </button>
                );
              };
              return (
                <>
                  {chip("active", "🟢 Active")}
                  {STATUS_OPTIONS.filter((o) => o.value !== "paid" && o.value !== "rejected").map((opt) => chip(opt.value, opt.label, opt.color))}
                  <span className="w-px bg-white/10 self-stretch mx-1" aria-hidden />
                  {chip("completed", "✅ Completed")}
                  {chip("paid", "💵 Paid", "#00c853")}
                  {chip("rejected", "❌ Rejected", "#ef5350")}
                  <span className="w-px bg-white/10 self-stretch mx-1" aria-hidden />
                  {chip("all", "All")}
                </>
              );
            })()}
          </div>
        )}

        {leads.length === 0 && !loading && !error && (
          <div className="bg-white/5 border border-white/10 rounded-2xl p-12 text-center">
            <p className="text-[#888]">No leads yet.</p>
          </div>
        )}

        {leads.length > 0 && (
          <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
            <div className="hidden md:grid grid-cols-[auto_1fr_1.4fr_1.6fr_1.4fr_auto] gap-4 px-5 py-3 bg-white/5 text-xs font-semibold text-[#888] uppercase tracking-wider border-b border-white/10 items-center">
              <div className="w-4">
                <input
                  type="checkbox"
                  aria-label="Select all visible"
                  checked={(() => {
                    const visible = filteredLeads.filter((l) => {
                      if (statusFilter === "all") return true;
                      if (statusFilter === "active") return l.status !== "paid" && l.status !== "rejected";
                      if (statusFilter === "completed") return l.status === "paid" || l.status === "rejected";
                      return l.status === statusFilter;
                    });
                    return visible.length > 0 && visible.every((l) => selectedIds.has(l.id));
                  })()}
                  onChange={(e) => {
                    const visible = filteredLeads.filter((l) => {
                      if (statusFilter === "all") return true;
                      if (statusFilter === "active") return l.status !== "paid" && l.status !== "rejected";
                      if (statusFilter === "completed") return l.status === "paid" || l.status === "rejected";
                      return l.status === statusFilter;
                    });
                    if (e.target.checked) setSelectedIds(new Set(visible.map((l) => l.id)));
                    else setSelectedIds(new Set());
                  }}
                  className="cursor-pointer accent-[#00c853]"
                />
              </div>
              <div>Customer</div>
              <div>Contact</div>
              <div>Device</div>
              <div>Quote · Payout</div>
              <div>Status</div>
            </div>
            <ul className="divide-y divide-white/5">
              {filteredLeads.filter((l) => {
                if (statusFilter === "all") return true;
                if (statusFilter === "active") return l.status !== "paid" && l.status !== "rejected";
                if (statusFilter === "completed") return l.status === "paid" || l.status === "rejected";
                return l.status === statusFilter;
              }).map((lead) => {
                const current = pendingStatus[lead.id] ?? lead.status;
                const meta = statusMeta(current);
                return (
                  <li key={lead.id} className={`px-5 py-4 grid md:grid-cols-[auto_1fr_1.4fr_1.6fr_1.4fr_auto] gap-4 items-center hover:bg-white/[0.02] transition ${selectedIds.has(lead.id) ? "bg-[#00c853]/5" : ""}`}>
                    <div className="w-4">
                      <input type="checkbox" aria-label={`Select ${lead.name || lead.id}`} checked={selectedIds.has(lead.id)} onChange={() => toggleSelect(lead.id)} className="cursor-pointer accent-[#00c853]" />
                    </div>
                    <div>
                      <p className="font-semibold text-sm flex items-center gap-1.5 flex-wrap">
                        {lead.name || "—"}
                        {lead.duplicateCount && lead.duplicateCount > 0 && (
                          <span title={`${lead.duplicateCount} earlier submission${lead.duplicateCount === 1 ? "" : "s"} merged into this row`} className="px-1.5 py-0.5 rounded text-[9px] bg-white/10 text-[#888] border border-white/10 font-bold cursor-help">+{lead.duplicateCount} dupe{lead.duplicateCount === 1 ? "" : "s"}</span>
                        )}
                      </p>
                      <p className="text-[#666] text-xs">{timeAgo(lead.timestamp)}</p>
                    </div>
                    <div className="text-xs text-[#aaa] space-y-0.5">
                      {lead.phone && <p>{lead.phone}</p>}
                      {lead.email && <p className="text-[#888] truncate" title={lead.email}>{lead.email}</p>}
                    </div>
                    <div className="text-sm">
                      <p className="font-medium flex items-center gap-2 flex-wrap">
                        {lead.model || lead.device || "—"}
                        {lead.imeiWarnings && lead.imeiWarnings.length > 0 && (
                          <span title={lead.imeiWarnings.join(" · ")} className="px-1.5 py-0.5 rounded text-[10px] bg-yellow-500/15 text-yellow-300 border border-yellow-500/30 font-bold cursor-help">⚠️ IMEI</span>
                        )}
                      </p>
                      <p className="text-[#666] text-xs">
                        {[lead.storage, lead.condition].filter(Boolean).join(" · ")}
                        {lead.imei && <span className="ml-1 text-[#777] font-mono">· {lead.imei.slice(-6)}</span>}
                      </p>
                      {lead.photos && lead.photos.length > 0 && (
                        <div className="flex gap-1 mt-1.5">
                          {lead.photos.slice(0, 3).map((url, i) => (
                            <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="block w-10 h-10 rounded overflow-hidden border border-white/10 hover:border-[#00c853] transition">
                              <img src={url} alt={`Photo ${i + 1}`} className="w-full h-full object-cover" />
                            </a>
                          ))}
                          {lead.photos.length > 3 && (
                            <span className="w-10 h-10 rounded bg-white/5 border border-white/10 flex items-center justify-center text-[10px] text-[#888]">+{lead.photos.length - 3}</span>
                          )}
                        </div>
                      )}
                      {/* Notes */}
                      <div className="mt-1.5">
                        {lead.latestNote && (
                          <div className="text-[11px] text-[#aaa] bg-white/[0.03] border-l-2 border-[#00c853]/40 pl-2 py-1 rounded-sm" title={lead.latestNote}>
                            <span className="text-[9px] uppercase tracking-wider text-[#666] font-bold">Note{lead.noteCount && lead.noteCount > 1 ? ` (${lead.noteCount})` : ""}: </span>
                            <span className="break-words">{lead.latestNote.length > 80 ? lead.latestNote.slice(0, 80) + "…" : lead.latestNote}</span>
                          </div>
                        )}
                        {noteOpenId === lead.id ? (
                          <div className="mt-1.5 space-y-1.5">
                            <textarea
                              value={noteDraft}
                              onChange={(e) => setNoteDraft(e.target.value)}
                              placeholder="Internal note…"
                              rows={2}
                              maxLength={500}
                              autoFocus
                              className="w-full px-2 py-1.5 bg-white/5 border border-white/10 rounded text-xs text-white placeholder:text-[#666] focus:outline-none focus:border-[#00c853] resize-none"
                            />
                            <div className="flex gap-1.5">
                              <button type="button" disabled={!noteDraft.trim() || noteSavingId === lead.id} onClick={() => saveNote(lead)} className="px-2.5 py-1 bg-[#00c853] text-white rounded text-[11px] font-bold hover:bg-[#00e676] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer">{noteSavingId === lead.id ? "Saving…" : "Save"}</button>
                              <button type="button" onClick={() => { setNoteOpenId(null); setNoteDraft(""); }} className="px-2.5 py-1 bg-white/5 border border-white/10 rounded text-[11px] text-[#aaa] hover:bg-white/10 cursor-pointer">Cancel</button>
                            </div>
                          </div>
                        ) : (
                          <button type="button" onClick={() => { setNoteOpenId(lead.id); setNoteDraft(""); }} className="text-[10px] text-[#666] hover:text-[#aaa] transition mt-1 cursor-pointer">+ {lead.latestNote ? "Add another note" : "Add internal note"}</button>
                        )}
                      </div>
                    </div>
                    <div className="text-sm">
                      <p className="font-semibold text-[#00c853]">{lead.quote || "—"}</p>
                      <p className="text-[#666] text-xs">{lead.payout}</p>
                    </div>
                    <div>
                      <select
                        value={current}
                        disabled={savingId === lead.id || rejectingId === lead.id}
                        onChange={(e) => {
                          const v = e.target.value;
                          if (v === "rejected" && lead.status !== "rejected") {
                            setRejectingId(lead.id);
                            setRejectionReason("");
                            setPendingStatus((p) => ({ ...p, [lead.id]: v }));
                            return;
                          }
                          setPendingStatus((p) => ({ ...p, [lead.id]: v }));
                          saveStatus(lead, v);
                        }}
                        className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-[#00c853] cursor-pointer disabled:opacity-60"
                        style={{ borderColor: meta.color + "55" }}
                      >
                        {STATUS_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value} className="bg-black">{opt.label}</option>
                        ))}
                      </select>
                      {savingId === lead.id && (
                        <p className="text-[10px] text-[#888] mt-1">Saving…</p>
                      )}
                      {savedFlash[lead.id] && (
                        <p className="text-[10px] text-[#00c853] mt-1">
                          ✓ Saved{savedFlash[lead.id]!.sms ? " · SMS sent" : ""}{savedFlash[lead.id]!.email ? " · email sent" : ""}
                        </p>
                      )}
                      {rejectingId === lead.id && (
                        <div className="mt-2 p-2.5 bg-red-500/10 border border-red-500/30 rounded-lg space-y-2 max-w-[260px]">
                          <p className="text-[10px] text-red-300 font-bold uppercase tracking-wider">Reason for rejection</p>
                          <select
                            value={rejectionReason}
                            onChange={(e) => setRejectionReason(e.target.value)}
                            className="w-full bg-black/40 border border-white/10 rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:border-red-400 cursor-pointer"
                          >
                            <option value="">— pick a reason —</option>
                            <option>iCloud / Find My is locked</option>
                            <option>Device is blacklisted / reported</option>
                            <option>Damage worse than disclosed</option>
                            <option>Screen previously replaced (non-OEM)</option>
                            <option>Battery health below threshold</option>
                            <option>Device not paid off / financed</option>
                            <option>Different model than quoted</option>
                            <option>Other</option>
                          </select>
                          {rejectionReason === "Other" && (
                            <input
                              type="text"
                              autoFocus
                              placeholder="Type the reason…"
                              onChange={(e) => setRejectionReason(e.target.value)}
                              className="w-full bg-black/40 border border-white/10 rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:border-red-400"
                            />
                          )}
                          <div className="flex gap-1.5">
                            <button
                              type="button"
                              disabled={!rejectionReason.trim() || rejectionReason === "Other"}
                              onClick={() => {
                                saveStatus(lead, "rejected", rejectionReason);
                                setRejectingId(null);
                              }}
                              className="flex-1 px-2 py-1.5 bg-red-500 text-white rounded text-[11px] font-bold hover:bg-red-600 transition disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                            >
                              Confirm
                            </button>
                            <button
                              type="button"
                              onClick={() => { setRejectingId(null); setRejectionReason(""); setPendingStatus((p) => { const c = { ...p }; delete c[lead.id]; return c; }); }}
                              className="px-2 py-1.5 bg-white/5 border border-white/10 rounded text-[11px] text-[#aaa] hover:bg-white/10 transition cursor-pointer"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>

      {/* Bulk-action sticky bar */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-[#0a0a0a]/95 backdrop-blur-xl border-t border-white/10 px-4 py-3 z-40">
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3">
              <p className="text-sm font-semibold text-white">{selectedIds.size} selected</p>
              <button onClick={() => setSelectedIds(new Set())} className="text-xs text-[#888] hover:text-white cursor-pointer">Clear</button>
              {bulkProgress && (
                <p className="text-xs text-[#00c853]">{bulkProgress.done}/{bulkProgress.total} updated</p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <select
                value={bulkStatus}
                disabled={bulkSaving}
                onChange={(e) => setBulkStatus(e.target.value)}
                className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#00c853] cursor-pointer disabled:opacity-50"
              >
                <option value="">Mark selected as…</option>
                {STATUS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value} className="bg-black">{opt.label}</option>
                ))}
              </select>
              <button
                onClick={() => bulkStatus && runBulkStatus(bulkStatus)}
                disabled={!bulkStatus || bulkSaving}
                className="px-4 py-2 bg-[#00c853] text-white rounded-lg text-sm font-semibold hover:bg-[#00e676] cursor-pointer transition disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {bulkSaving ? "Updating…" : "Apply"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
