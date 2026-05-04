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

  const saveStatus = async (lead: Lead, newStatus: string) => {
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
            <p className="text-[#888] text-sm">{leads.length} lead{leads.length === 1 ? "" : "s"} · last 50 from MC comms</p>
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

        {error && <div className="bg-[#ef5350]/10 border border-[#ef5350]/30 rounded-xl p-4 mb-4 text-sm text-[#ef5350]">{error}</div>}

        {leads.length === 0 && !loading && !error && (
          <div className="bg-white/5 border border-white/10 rounded-2xl p-12 text-center">
            <p className="text-[#888]">No leads yet.</p>
          </div>
        )}

        {leads.length > 0 && (
          <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
            <div className="hidden md:grid grid-cols-[1fr_1.4fr_1.6fr_1.4fr_auto] gap-4 px-5 py-3 bg-white/5 text-xs font-semibold text-[#888] uppercase tracking-wider border-b border-white/10">
              <div>Customer</div>
              <div>Contact</div>
              <div>Device</div>
              <div>Quote · Payout</div>
              <div>Status</div>
            </div>
            <ul className="divide-y divide-white/5">
              {leads.map((lead) => {
                const current = pendingStatus[lead.id] ?? lead.status;
                const meta = statusMeta(current);
                return (
                  <li key={lead.id} className="px-5 py-4 grid md:grid-cols-[1fr_1.4fr_1.6fr_1.4fr_auto] gap-4 items-center hover:bg-white/[0.02] transition">
                    <div>
                      <p className="font-semibold text-sm">{lead.name || "—"}</p>
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
                    </div>
                    <div className="text-sm">
                      <p className="font-semibold text-[#00c853]">{lead.quote || "—"}</p>
                      <p className="text-[#666] text-xs">{lead.payout}</p>
                    </div>
                    <div>
                      <select
                        value={current}
                        disabled={savingId === lead.id}
                        onChange={(e) => {
                          const v = e.target.value;
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
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>
    </main>
  );
}
