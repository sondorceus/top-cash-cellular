"use client";
import { useCallback, useEffect, useMemo, useState } from "react";

// Profit / sales ledger. Each row is one resold device — we log what
// we paid, what we sold it for, and the platform fees + shipping eaten
// — and the page rolls those up into total revenue, cost, fees,
// shipping, profit, and margin. Skywalker 2026-05-24: first sale to
// log is the iPhone 14 on eBay at $155.
//
// Persistence lives on Mission Control via /api/admin/sales (same
// pattern as leads/notes/customers — tagged comms messages). Storage
// rules and retention are whatever MC enforces.

interface Sale {
  id: string;
  device: string;
  platform: string;
  soldPrice: number;
  cost: number;
  fees: number;
  shipping: number;
  saleDate: string;
  leadId?: string;
  note?: string;
  profit: number;
  createdAt: string;
}

interface Totals {
  count: number;
  revenue: number;
  cost: number;
  fees: number;
  shipping: number;
  profit: number;
  marginPct: number;
}

interface Payload { sales: Sale[]; totals: Totals }

// Common platforms — operator can still type "Other" + free-text;
// keep this short so it's not a chore to scroll. eBay first because
// it's where Skywalker's already selling.
const PLATFORMS = ["eBay", "Mercari", "OfferUp", "Facebook Marketplace", "Swappa", "Local cash", "Other"];

type Range = "all" | "30d" | "7d" | "today";

function money(n: number): string {
  // Always show 2dp + thousands separators — this is a finance view,
  // a clean $1,234.50 reads better than $1234.5.
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function todayISO(): string {
  // Local-date YYYY-MM-DD so the date picker doesn't show "yesterday"
  // for evening sales just because the runtime is UTC.
  const d = new Date();
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 10);
}

export default function ProfitPage() {
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [range, setRange] = useState<Range>("all");

  // Add-sale form. We pre-fill the date with "today" but leave cost +
  // sold-price blank so the operator types real numbers instead of
  // accidentally submitting placeholder zeros.
  const [device, setDevice] = useState("");
  const [platform, setPlatform] = useState("eBay");
  const [soldPrice, setSoldPrice] = useState("");
  const [cost, setCost] = useState("");
  const [fees, setFees] = useState("");
  const [shipping, setShipping] = useState("");
  const [saleDate, setSaleDate] = useState(todayISO());
  const [leadId, setLeadId] = useState("");
  const [note, setNote] = useState("");

  const token = useMemo(() => {
    if (typeof window === "undefined") return "";
    return localStorage.getItem("tcc-admin-token") || "";
  }, []);

  const fetchSales = useCallback(async () => {
    try {
      const r = await fetch("/api/admin/sales", { headers: token ? { "x-admin-token": token } : {}, cache: "no-store" });
      if (!r.ok) throw new Error(r.status === 401 ? "Unauthorized — open /admin first to set token." : `HTTP ${r.status}`);
      setData(await r.json());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error");
    }
  }, [token]);

  useEffect(() => { fetchSales(); }, [fetchSales]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!device.trim()) { setError("Device required"); return; }
    if (!soldPrice.trim()) { setError("Sold price required"); return; }
    setBusy(true);
    try {
      const r = await fetch("/api/admin/sales", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { "x-admin-token": token } : {}) },
        body: JSON.stringify({
          device: device.trim(),
          platform,
          soldPrice: Number(soldPrice),
          cost: Number(cost) || 0,
          fees: Number(fees) || 0,
          shipping: Number(shipping) || 0,
          saleDate,
          leadId: leadId.trim() || undefined,
          note: note.trim() || undefined,
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
      // Reset only the fields a typical second sale won't share — keep
      // platform + date because the operator usually logs same-day
      // batches.
      setDevice(""); setSoldPrice(""); setCost(""); setFees(""); setShipping(""); setLeadId(""); setNote("");
      setError(null);
      await fetchSales();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to add sale");
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this sale from the ledger?")) return;
    setBusy(true);
    try {
      const r = await fetch(`/api/admin/sales/${id}`, {
        method: "DELETE",
        headers: token ? { "x-admin-token": token } : {},
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      await fetchSales();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete");
    } finally {
      setBusy(false);
    }
  };

  // Window-filtered view. Range filtering happens client-side so the
  // server stays a thin proxy over MC; the dataset is tiny (one row
  // per resold device, max hundreds).
  const filtered = useMemo(() => {
    if (!data) return { sales: [] as Sale[], totals: emptyTotals() };
    if (range === "all") return data;
    const now = Date.now();
    const cutoffMs = range === "today" ? startOfTodayMs() : (range === "7d" ? now - 7 * 86400000 : now - 30 * 86400000);
    const sales = data.sales.filter((s) => new Date(s.saleDate + "T00:00:00").getTime() >= cutoffMs);
    return { sales, totals: rollupClient(sales) };
  }, [data, range]);

  // Live profit-preview so the operator sees the number form-side
  // before submitting — handy when fees + shipping shave the margin.
  const previewProfit = useMemo(() => {
    const sp = Number(soldPrice) || 0;
    const c = Number(cost) || 0;
    const f = Number(fees) || 0;
    const sh = Number(shipping) || 0;
    return sp - c - f - sh;
  }, [soldPrice, cost, fees, shipping]);

  return (
    <main className="min-h-screen bg-[#0a0a0a] text-white">
      <div className="sticky top-0 z-20 bg-[#0a0a0a]/95 backdrop-blur border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-4 flex-wrap">
          <a href="/admin" className="text-[#888] hover:text-[#00c853] text-xs font-semibold transition" title="Back to leads">← Leads</a>
          <a href="/admin/analytics" className="text-[#888] hover:text-[#00c853] text-xs font-semibold transition">📊 Analytics</a>
          <a href="/admin/customers" className="text-[#888] hover:text-[#00c853] text-xs font-semibold transition">👥 Customers</a>
          <a href="/admin/prices" className="text-[#888] hover:text-[#00c853] text-xs font-semibold transition">💲 Prices</a>
          <h1 className="text-lg font-extrabold tracking-tight">TCC · Profit</h1>
          <div className="flex items-center bg-white/5 border border-white/10 rounded-lg overflow-hidden text-xs font-semibold ml-auto">
            {(["today", "7d", "30d", "all"] as Range[]).map((r) => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={`px-3 py-1.5 transition cursor-pointer ${range === r ? "bg-[#00c853]/15 text-[#00c853]" : "text-[#dcdcdc] hover:bg-white/10"} ${r !== "today" ? "border-l border-white/10" : ""}`}
              >
                {r === "today" ? "Today" : r === "7d" ? "7d" : r === "30d" ? "30d" : "All time"}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* Summary cards. Stacks 2×3 on mobile, 6-wide on desktop —
            margin-% on the far right is the headline number you want
            to glance at first. */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <StatCard label="Sales" value={filtered.totals.count.toString()} tone="ink" />
          <StatCard label="Revenue" value={`$${money(filtered.totals.revenue)}`} tone="ink" />
          <StatCard label="Cost paid" value={`$${money(filtered.totals.cost)}`} tone="ink" />
          <StatCard label="Fees" value={`$${money(filtered.totals.fees)}`} tone="muted" />
          <StatCard label="Shipping" value={`$${money(filtered.totals.shipping)}`} tone="muted" />
          <StatCard
            label="Profit"
            value={`$${money(filtered.totals.profit)}`}
            sub={filtered.totals.revenue > 0 ? `${(filtered.totals.marginPct * 100).toFixed(1)}% margin` : undefined}
            tone={filtered.totals.profit >= 0 ? "good" : "bad"}
          />
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/40 text-red-200 text-sm rounded-lg px-3 py-2">{error}</div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-6">
          {/* Add-sale form */}
          <form onSubmit={handleAdd} className="bg-white/[0.03] border border-white/10 rounded-xl p-4 space-y-3 h-fit">
            <h2 className="text-sm font-bold uppercase tracking-wide text-[#bdbdbd]">Log a sale</h2>
            <Field label="Device">
              <input
                value={device}
                onChange={(e) => setDevice(e.target.value)}
                placeholder="iPhone 14 128GB unlocked"
                className="w-full bg-black/40 border border-white/15 rounded-lg px-3 py-2 text-sm"
                required
              />
            </Field>
            <Field label="Platform">
              <select
                value={platform}
                onChange={(e) => setPlatform(e.target.value)}
                className="w-full bg-black/40 border border-white/15 rounded-lg px-3 py-2 text-sm cursor-pointer"
              >
                {PLATFORMS.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Sold for ($)">
                <input
                  type="number" step="0.01" min="0" inputMode="decimal"
                  value={soldPrice}
                  onChange={(e) => setSoldPrice(e.target.value)}
                  placeholder="155"
                  className="w-full bg-black/40 border border-white/15 rounded-lg px-3 py-2 text-sm"
                  required
                />
              </Field>
              <Field label="Cost paid ($)">
                <input
                  type="number" step="0.01" min="0" inputMode="decimal"
                  value={cost}
                  onChange={(e) => setCost(e.target.value)}
                  placeholder="100"
                  className="w-full bg-black/40 border border-white/15 rounded-lg px-3 py-2 text-sm"
                />
              </Field>
              <Field label="Fees ($)">
                <input
                  type="number" step="0.01" min="0" inputMode="decimal"
                  value={fees}
                  onChange={(e) => setFees(e.target.value)}
                  placeholder="20"
                  className="w-full bg-black/40 border border-white/15 rounded-lg px-3 py-2 text-sm"
                />
              </Field>
              <Field label="Shipping ($)">
                <input
                  type="number" step="0.01" min="0" inputMode="decimal"
                  value={shipping}
                  onChange={(e) => setShipping(e.target.value)}
                  placeholder="8"
                  className="w-full bg-black/40 border border-white/15 rounded-lg px-3 py-2 text-sm"
                />
              </Field>
            </div>
            <Field label="Sale date">
              <input
                type="date"
                value={saleDate}
                onChange={(e) => setSaleDate(e.target.value)}
                className="w-full bg-black/40 border border-white/15 rounded-lg px-3 py-2 text-sm cursor-pointer"
              />
            </Field>
            <Field label="Lead ID (optional)">
              <input
                value={leadId}
                onChange={(e) => setLeadId(e.target.value)}
                placeholder="lead-xxxx — links to the buy"
                className="w-full bg-black/40 border border-white/15 rounded-lg px-3 py-2 text-sm font-mono"
              />
            </Field>
            <Field label="Note (optional)">
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="cracked back; sold as-is"
                className="w-full bg-black/40 border border-white/15 rounded-lg px-3 py-2 text-sm"
                maxLength={240}
              />
            </Field>
            {/* Profit preview — visible before submit so the operator
                isn't surprised by a negative margin after logging. */}
            <div className={`text-sm font-bold flex items-center justify-between border-t border-white/10 pt-3 ${previewProfit >= 0 ? "text-[#00c853]" : "text-red-300"}`}>
              <span>Preview profit</span>
              <span>${money(previewProfit)}</span>
            </div>
            <button
              type="submit"
              disabled={busy}
              className="w-full bg-[#00c853] hover:bg-[#00b34a] disabled:opacity-50 disabled:cursor-not-allowed text-black font-bold py-2 rounded-lg text-sm cursor-pointer transition"
            >
              {busy ? "Saving…" : "+ Add sale"}
            </button>
          </form>

          {/* Sales table */}
          <div className="bg-white/[0.03] border border-white/10 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
              <h2 className="text-sm font-bold uppercase tracking-wide text-[#bdbdbd]">
                Sales <span className="text-[#666] ml-2">({filtered.sales.length})</span>
              </h2>
              <button onClick={fetchSales} className="text-xs text-[#888] hover:text-white cursor-pointer">↻ Refresh</button>
            </div>
            {filtered.sales.length === 0 ? (
              <div className="px-4 py-10 text-center text-sm text-[#666]">
                {data ? "No sales yet in this range. Log your first on the left." : "Loading…"}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="text-[#888] uppercase tracking-wider">
                    <tr className="border-b border-white/10">
                      <th className="text-left px-3 py-2 font-semibold">Date</th>
                      <th className="text-left px-3 py-2 font-semibold">Device</th>
                      <th className="text-left px-3 py-2 font-semibold">Platform</th>
                      <th className="text-right px-3 py-2 font-semibold">Sold</th>
                      <th className="text-right px-3 py-2 font-semibold">Cost</th>
                      <th className="text-right px-3 py-2 font-semibold">Fees</th>
                      <th className="text-right px-3 py-2 font-semibold">Ship</th>
                      <th className="text-right px-3 py-2 font-semibold">Profit</th>
                      <th className="text-right px-3 py-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.sales.map((s) => (
                      <tr key={s.id} className="border-b border-white/5 hover:bg-white/[0.03]">
                        <td className="px-3 py-2 text-[#aaa]">{s.saleDate}</td>
                        <td className="px-3 py-2">
                          <div className="font-semibold">{s.device}</div>
                          {(s.leadId || s.note) && (
                            <div className="text-[10px] text-[#666] mt-0.5">
                              {s.leadId && <span className="font-mono">{s.leadId}</span>}
                              {s.leadId && s.note && <span className="mx-1">·</span>}
                              {s.note}
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-2 text-[#aaa]">{s.platform}</td>
                        <td className="px-3 py-2 text-right">${money(s.soldPrice)}</td>
                        <td className="px-3 py-2 text-right text-[#aaa]">${money(s.cost)}</td>
                        <td className="px-3 py-2 text-right text-[#aaa]">${money(s.fees)}</td>
                        <td className="px-3 py-2 text-right text-[#aaa]">${money(s.shipping)}</td>
                        <td className={`px-3 py-2 text-right font-bold ${s.profit >= 0 ? "text-[#00c853]" : "text-red-300"}`}>
                          ${money(s.profit)}
                        </td>
                        <td className="px-3 py-2 text-right">
                          <button
                            onClick={() => handleDelete(s.id)}
                            disabled={busy}
                            className="text-[#666] hover:text-red-400 cursor-pointer disabled:opacity-50"
                            title="Delete this sale from the ledger"
                          >
                            ✕
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-[11px] font-bold uppercase tracking-wider text-[#888] mb-1">{label}</span>
      {children}
    </label>
  );
}

function StatCard({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone: "ink" | "muted" | "good" | "bad" }) {
  const toneClass =
    tone === "good" ? "text-[#00c853] border-[#00c853]/30 bg-[#00c853]/5" :
    tone === "bad"  ? "text-red-300 border-red-500/30 bg-red-500/5" :
    tone === "muted" ? "text-[#aaa] border-white/10 bg-white/[0.02]" :
    "text-white border-white/10 bg-white/[0.03]";
  return (
    <div className={`rounded-xl border px-3 py-2 ${toneClass}`}>
      <div className="text-[10px] uppercase tracking-wider opacity-70 font-semibold">{label}</div>
      <div className="text-lg font-extrabold tabular-nums leading-tight mt-0.5">{value}</div>
      {sub && <div className="text-[10px] opacity-70 mt-0.5">{sub}</div>}
    </div>
  );
}

function emptyTotals(): Totals {
  return { count: 0, revenue: 0, cost: 0, fees: 0, shipping: 0, profit: 0, marginPct: 0 };
}

// Client-side rollup mirrors the server's so range-filtered totals
// stay consistent without a round-trip.
function rollupClient(sales: Sale[]): Totals {
  const t = emptyTotals();
  t.count = sales.length;
  for (const s of sales) {
    t.revenue += s.soldPrice;
    t.cost += s.cost;
    t.fees += s.fees;
    t.shipping += s.shipping;
    t.profit += s.profit;
  }
  t.marginPct = t.revenue > 0 ? t.profit / t.revenue : 0;
  return t;
}

function startOfTodayMs(): number {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}
