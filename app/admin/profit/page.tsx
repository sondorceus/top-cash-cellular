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

// Subset of the /api/admin/leads response we actually need for the
// auto-fill: device label + payout. The leads endpoint returns the
// full AdminLead shape with dozens more fields; we keep this narrow
// so a leads-schema change doesn't break the lookup.
interface LeadLite {
  id: string;
  name?: string;
  device?: string;
  model?: string;
  storage?: string;
  carrier?: string;
  payout?: string;
  totalPayout?: number;
}

// Common platforms — operator can still type "Other" + free-text;
// keep this short so it's not a chore to scroll. eBay first because
// it's where Skywalker's already selling.
const PLATFORMS = ["eBay", "Mercari", "OfferUp", "Facebook Marketplace", "Swappa", "Local cash", "Other"];

// Ad channels — same shape as platforms. Google + Meta first because
// they're where most TCC ad budget goes.
const AD_CHANNELS = ["Google Ads", "Meta (Facebook/Instagram)", "TikTok Ads", "X / Twitter", "Reddit", "Local print", "Other"];

// Sub-channel options per channel. We pay weekly per channel, but
// inside Google/Meta the spend usually splits across product placements
// — this lets the operator tag each entry so the per-channel rollup
// can break Google into Search vs PMax vs Display, etc. Free-text
// "Other" is still acceptable for one-offs the dropdown doesn't cover.
const AD_SUB_CHANNELS: Record<string, string[]> = {
  "Google Ads":                ["Search", "Performance Max", "Display", "YouTube", "Shopping", "Local Services", "Demand Gen", "Other"],
  "Meta (Facebook/Instagram)": ["Facebook Feed", "Instagram Feed", "Reels", "Stories", "Marketplace", "Advantage+", "Other"],
  "TikTok Ads":                ["In-Feed", "Spark Ads", "Top View", "Other"],
  "X / Twitter":               ["Promoted Posts", "Trends", "Other"],
  "Reddit":                    ["Promoted Posts", "Conversation Ads", "Other"],
  "Local print":               ["Newspaper", "Flyer", "Mailer", "Other"],
  "Other":                     [],
};

interface AdEntry {
  id: string;
  channel: string;
  subChannel?: string;
  campaign?: string;
  amount: number;
  spendDate: string;
  note?: string;
  createdAt: string;
}

interface AdTotals { count: number; total: number }
interface AdPayload { entries: AdEntry[]; totals: AdTotals }

type Range = "all" | "30d" | "7d" | "today" | "custom";

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
  // Inclusive custom date range (YYYY-MM-DD). Default both to today
  // so picking "Custom" with no further input narrows to a known
  // window instead of returning everything by accident.
  const [customFrom, setCustomFrom] = useState<string>(todayISO());
  const [customTo, setCustomTo] = useState<string>(todayISO());

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

  // Edit-mode: when we're updating an existing sale instead of
  // creating one, this holds the sale's id so POST re-uses it (the
  // server treats the latest [SALE: id] message as authoritative).
  const [editingId, setEditingId] = useState<string | null>(null);

  // Lead auto-fill: cache the lead roster on first lookup. Mission
  // Control caps comms responses at 300 messages so the leads list
  // tops out around 200 — cheap to keep in memory.
  const [leadIndex, setLeadIndex] = useState<Map<string, LeadLite> | null>(null);
  const [leadMatch, setLeadMatch] = useState<{ status: "idle" | "loading" | "matched" | "miss"; lead?: LeadLite }>({ status: "idle" });

  // Ad-spend ledger state — mirrors the sales side but with a flatter
  // schema (one number per row, no per-row margin math).
  const [adData, setAdData] = useState<AdPayload | null>(null);
  const [adChannel, setAdChannel] = useState("Google Ads");
  const [adSubChannel, setAdSubChannel] = useState("");
  const [adCampaign, setAdCampaign] = useState("");
  const [adAmount, setAdAmount] = useState("");
  const [adDate, setAdDate] = useState(todayISO());
  const [adNote, setAdNote] = useState("");
  const [adBusy, setAdBusy] = useState(false);
  const [adEditingId, setAdEditingId] = useState<string | null>(null);

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

  const fetchAdSpend = useCallback(async () => {
    try {
      const r = await fetch("/api/admin/ad-spend", { headers: token ? { "x-admin-token": token } : {}, cache: "no-store" });
      if (!r.ok) throw new Error(r.status === 401 ? "Unauthorized — open /admin first to set token." : `HTTP ${r.status}`);
      setAdData(await r.json());
    } catch (e) {
      // Don't clobber the page error if sales loaded fine — surface
      // ad-spend issues only when we're sure they matter.
      setError(e instanceof Error ? e.message : "Network error");
    }
  }, [token]);

  useEffect(() => { fetchAdSpend(); }, [fetchAdSpend]);

  // Lazy-load the leads list the first time the operator touches the
  // Lead-ID input. We don't pull it eagerly because most form-fills
  // skip the leadId (cash buys, one-offs) and the leads endpoint is
  // ~50–80ms over the wire.
  const ensureLeadIndex = useCallback(async () => {
    if (leadIndex) return leadIndex;
    try {
      const r = await fetch("/api/admin/leads", { headers: token ? { "x-admin-token": token } : {}, cache: "no-store" });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j = await r.json();
      const idx = new Map<string, LeadLite>();
      for (const l of (j.leads || []) as LeadLite[]) idx.set(l.id, l);
      setLeadIndex(idx);
      return idx;
    } catch {
      return null;
    }
  }, [leadIndex, token]);

  // When leadId changes, look up the lead. Debounce 250ms so we don't
  // thrash the index check on every keystroke. Only fires when the
  // typed string matches the lead-… shape — random text leaves the
  // form alone.
  useEffect(() => {
    const id = leadId.trim();
    if (!id) { setLeadMatch({ status: "idle" }); return; }
    if (!/^lead-[\w-]+$/i.test(id)) { setLeadMatch({ status: "miss" }); return; }
    setLeadMatch({ status: "loading" });
    const t = setTimeout(async () => {
      const idx = await ensureLeadIndex();
      if (!idx) { setLeadMatch({ status: "miss" }); return; }
      const lead = idx.get(id);
      if (!lead) { setLeadMatch({ status: "miss" }); return; }
      setLeadMatch({ status: "matched", lead });
      // Only auto-fill empty fields — don't trample what the operator
      // already typed. If device or cost is set, the operator already
      // made a deliberate choice and overriding would feel rude.
      setDevice((prev) => prev || formatLeadDevice(lead));
      setCost((prev) => prev || formatLeadCost(lead));
    }, 250);
    return () => clearTimeout(t);
  }, [leadId, ensureLeadIndex]);

  const resetForm = () => {
    setDevice(""); setSoldPrice(""); setCost(""); setFees(""); setShipping("");
    setLeadId(""); setNote(""); setEditingId(null); setLeadMatch({ status: "idle" });
  };

  const loadForEdit = (s: Sale) => {
    setEditingId(s.id);
    setDevice(s.device);
    setPlatform(s.platform);
    setSoldPrice(String(s.soldPrice));
    setCost(String(s.cost));
    setFees(String(s.fees));
    setShipping(String(s.shipping));
    setSaleDate(s.saleDate);
    setLeadId(s.leadId || "");
    setNote(s.note || "");
    setError(null);
    // Scroll the form into view on mobile where the table is above
    // the fold and the form is below.
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  };

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
          // When editing, supplying the same id replaces the row —
          // server treats latest [SALE: id] as authoritative.
          ...(editingId ? { id: editingId } : {}),
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
      resetForm();
      setError(null);
      await fetchSales();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to add sale");
    } finally {
      setBusy(false);
    }
  };

  const resetAdForm = () => {
    setAdSubChannel(""); setAdCampaign(""); setAdAmount(""); setAdNote(""); setAdEditingId(null);
  };

  const loadAdForEdit = (a: AdEntry) => {
    setAdEditingId(a.id);
    setAdChannel(a.channel);
    setAdSubChannel(a.subChannel || "");
    setAdCampaign(a.campaign || "");
    setAdAmount(String(a.amount));
    setAdDate(a.spendDate);
    setAdNote(a.note || "");
    if (typeof window !== "undefined") {
      // Scroll to the ad-spend form below the sales table — it has
      // its own DOM id so we don't have to chase a ref.
      document.getElementById("ad-spend-form")?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  };

  const handleAddAdSpend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adChannel.trim()) { setError("Channel required"); return; }
    if (!adAmount.trim()) { setError("Amount required"); return; }
    setAdBusy(true);
    try {
      const r = await fetch("/api/admin/ad-spend", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { "x-admin-token": token } : {}) },
        body: JSON.stringify({
          ...(adEditingId ? { id: adEditingId } : {}),
          channel: adChannel,
          subChannel: adSubChannel.trim() || undefined,
          campaign: adCampaign.trim() || undefined,
          amount: Number(adAmount),
          spendDate: adDate,
          note: adNote.trim() || undefined,
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
      resetAdForm();
      setError(null);
      await fetchAdSpend();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to add spend");
    } finally {
      setAdBusy(false);
    }
  };

  const handleDeleteAdSpend = async (id: string) => {
    if (!confirm("Delete this ad-spend entry?")) return;
    setAdBusy(true);
    try {
      const r = await fetch(`/api/admin/ad-spend/${id}`, {
        method: "DELETE",
        headers: token ? { "x-admin-token": token } : {},
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      await fetchAdSpend();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete");
    } finally {
      setAdBusy(false);
    }
  };

  const exportCSV = () => {
    // Client-side download so we don't burn a serverless invocation
    // on what's essentially `JSON.stringify(filtered.sales)` rotated
    // into a CSV. The currently-selected range is what gets exported
    // — matches the visible totals at the top of the page.
    const header = ["sale_id", "date", "device", "platform", "sold_price", "cost", "fees", "shipping", "profit", "lead_id", "note"];
    const escape = (v: unknown) => {
      const s = String(v ?? "");
      // Quote fields containing comma, quote, or newline; double internal quotes.
      return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const rows = filtered.sales.map((s) => [
      s.id, s.saleDate, s.device, s.platform,
      s.soldPrice.toFixed(2), s.cost.toFixed(2), s.fees.toFixed(2), s.shipping.toFixed(2),
      s.profit.toFixed(2), s.leadId || "", s.note || "",
    ].map(escape).join(","));
    const csv = [header.join(","), ...rows].join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `tcc-sales-${todayISO()}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
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
    if (range === "custom") {
      // Inclusive bounds — saleDate strings compare lexicographically
      // since they're zero-padded YYYY-MM-DD, no Date math required.
      const lo = customFrom <= customTo ? customFrom : customTo;
      const hi = customFrom <= customTo ? customTo : customFrom;
      const sales = data.sales.filter((s) => s.saleDate >= lo && s.saleDate <= hi);
      return { sales, totals: rollupClient(sales) };
    }
    const now = Date.now();
    const cutoffMs = range === "today" ? startOfTodayMs() : (range === "7d" ? now - 7 * 86400000 : now - 30 * 86400000);
    const sales = data.sales.filter((s) => new Date(s.saleDate + "T00:00:00").getTime() >= cutoffMs);
    return { sales, totals: rollupClient(sales) };
  }, [data, range, customFrom, customTo]);

  // Live profit-preview so the operator sees the number form-side
  // before submitting — handy when fees + shipping shave the margin.
  const previewProfit = useMemo(() => {
    const sp = Number(soldPrice) || 0;
    const c = Number(cost) || 0;
    const f = Number(fees) || 0;
    const sh = Number(shipping) || 0;
    return sp - c - f - sh;
  }, [soldPrice, cost, fees, shipping]);

  // Range-filtered ad spend, matching the sales filter window so the
  // headline "Net profit" card actually compares like-for-like.
  const filteredAd = useMemo(() => {
    if (!adData) return { entries: [] as AdEntry[], total: 0 };
    if (range === "all") return { entries: adData.entries, total: adData.totals.total };
    let entries: AdEntry[];
    if (range === "custom") {
      const lo = customFrom <= customTo ? customFrom : customTo;
      const hi = customFrom <= customTo ? customTo : customFrom;
      entries = adData.entries.filter((a) => a.spendDate >= lo && a.spendDate <= hi);
    } else {
      const now = Date.now();
      const cutoffMs = range === "today" ? startOfTodayMs() : (range === "7d" ? now - 7 * 86400000 : now - 30 * 86400000);
      entries = adData.entries.filter((a) => new Date(a.spendDate + "T00:00:00").getTime() >= cutoffMs);
    }
    const total = entries.reduce((acc, a) => acc + a.amount, 0);
    return { entries, total: Math.round(total * 100) / 100 };
  }, [adData, range, customFrom, customTo]);

  const netProfit = useMemo(
    () => Math.round((filtered.totals.profit - filteredAd.total) * 100) / 100,
    [filtered.totals.profit, filteredAd.total],
  );

  // Current ISO week (Mon 00:00 → Sun 23:59 local). Independent of
  // the range toggle — the weekly footer is meant as a quick "what
  // did I net this week, after everything?" pulse that doesn't
  // change when the user is exploring other ranges.
  const weekRange = useMemo(() => {
    const now = new Date();
    const day = now.getDay();              // 0=Sun, 1=Mon, … 6=Sat
    const daysFromMon = (day + 6) % 7;     // Mon→0, Sun→6
    const mon = new Date(now);
    mon.setHours(0, 0, 0, 0);
    mon.setDate(mon.getDate() - daysFromMon);
    const sun = new Date(mon);
    sun.setDate(sun.getDate() + 6);
    const iso = (d: Date) => {
      const off = d.getTimezoneOffset();
      return new Date(d.getTime() - off * 60000).toISOString().slice(0, 10);
    };
    return { fromISO: iso(mon), toISO: iso(sun), label: `${iso(mon)} → ${iso(sun)}` };
  }, []);

  // Sales + ad spend bucketed into the current week, then rolled up
  // into "net this week" (sales profit minus ad spend after fees +
  // shipping already deducted inside sale.profit).
  const thisWeek = useMemo(() => {
    const lo = weekRange.fromISO;
    const hi = weekRange.toISO;
    const sales = (data?.sales || []).filter((s) => s.saleDate >= lo && s.saleDate <= hi);
    const ads = (adData?.entries || []).filter((a) => a.spendDate >= lo && a.spendDate <= hi);
    let revenue = 0, cost = 0, fees = 0, shipping = 0, salesProfit = 0;
    for (const s of sales) {
      revenue += s.soldPrice; cost += s.cost; fees += s.fees; shipping += s.shipping; salesProfit += s.profit;
    }
    const adSpend = ads.reduce((acc, a) => acc + a.amount, 0);
    const net = salesProfit - adSpend;
    const r2 = (n: number) => Math.round(n * 100) / 100;
    return {
      salesCount: sales.length,
      adCount: ads.length,
      revenue: r2(revenue), cost: r2(cost), fees: r2(fees), shipping: r2(shipping),
      salesProfit: r2(salesProfit), adSpend: r2(adSpend), net: r2(net),
    };
  }, [data, adData, weekRange]);

  // Per-day series for the chart — only built when the active range
  // actually spans more than one day (today/custom-same-day fall
  // back to the table). Days with zero activity (no sale + no spend)
  // are dropped so a 30d window with 4 sales doesn't render 26
  // empty bars.
  const dailySeries = useMemo(() => {
    if (range === "today") return [];
    const days = new Map<string, { date: string; salesProfit: number; adSpend: number }>();
    for (const s of filtered.sales) {
      const row = days.get(s.saleDate) || { date: s.saleDate, salesProfit: 0, adSpend: 0 };
      row.salesProfit += s.profit;
      days.set(s.saleDate, row);
    }
    for (const a of filteredAd.entries) {
      const row = days.get(a.spendDate) || { date: a.spendDate, salesProfit: 0, adSpend: 0 };
      row.adSpend += a.amount;
      days.set(a.spendDate, row);
    }
    return Array.from(days.values())
      .map((r) => ({ ...r, net: Math.round((r.salesProfit - r.adSpend) * 100) / 100 }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [filtered.sales, filteredAd.entries, range]);

  // Per-platform rollup over the filtered set — count / revenue /
  // profit / margin per platform, sorted by profit descending so the
  // best-performing channel sits left.
  const platformBreakdown = useMemo(() => {
    const map = new Map<string, { platform: string; count: number; revenue: number; profit: number }>();
    for (const s of filtered.sales) {
      const k = s.platform || "Other";
      const cur = map.get(k) || { platform: k, count: 0, revenue: 0, profit: 0 };
      cur.count += 1;
      cur.revenue += s.soldPrice;
      cur.profit += s.profit;
      map.set(k, cur);
    }
    return Array.from(map.values())
      .map((row) => ({ ...row, marginPct: row.revenue > 0 ? row.profit / row.revenue : 0 }))
      .sort((a, b) => b.profit - a.profit);
  }, [filtered.sales]);

  return (
    <main className="min-h-screen bg-[#0a0a0a] text-white">
      <div className="sticky top-0 z-20 bg-[#0a0a0a]/95 backdrop-blur border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-4 flex-wrap">
          <a href="/admin" className="text-[#888] hover:text-[#00c853] text-xs font-semibold transition" title="Back to leads">← Leads</a>
          <a href="/admin/analytics" className="text-[#888] hover:text-[#00c853] text-xs font-semibold transition">📊 Analytics</a>
          <a href="/admin/customers" className="text-[#888] hover:text-[#00c853] text-xs font-semibold transition">👥 Customers</a>
          <a href="/admin/prices" className="text-[#888] hover:text-[#00c853] text-xs font-semibold transition">💲 Prices</a>
          <h1 className="text-lg font-extrabold tracking-tight">TCC · Profit</h1>
          <div className="flex items-center gap-2 ml-auto flex-wrap">
            <div className="flex items-center bg-white/5 border border-white/10 rounded-lg overflow-hidden text-xs font-semibold">
              {(["today", "7d", "30d", "all", "custom"] as Range[]).map((r, i) => (
                <button
                  key={r}
                  onClick={() => setRange(r)}
                  className={`px-3 py-1.5 transition cursor-pointer ${range === r ? "bg-[#00c853]/15 text-[#00c853]" : "text-[#dcdcdc] hover:bg-white/10"} ${i > 0 ? "border-l border-white/10" : ""}`}
                >
                  {r === "today" ? "Today" : r === "7d" ? "7d" : r === "30d" ? "30d" : r === "all" ? "All time" : "Custom"}
                </button>
              ))}
            </div>
            {/* Date pickers — surfaced only when Custom is active so
                the header stays uncluttered for the common-case
                presets. Inclusive YYYY-MM-DD lex compare in filtered. */}
            {range === "custom" && (
              <div className="flex items-center gap-1.5 text-xs">
                <input
                  type="date"
                  value={customFrom}
                  onChange={(e) => setCustomFrom(e.target.value)}
                  className="bg-black/40 border border-white/15 rounded-lg px-2 py-1.5 text-white cursor-pointer"
                  aria-label="From date"
                />
                <span className="text-[#666]">→</span>
                <input
                  type="date"
                  value={customTo}
                  onChange={(e) => setCustomTo(e.target.value)}
                  className="bg-black/40 border border-white/15 rounded-lg px-2 py-1.5 text-white cursor-pointer"
                  aria-label="To date"
                />
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* Summary cards. Stacks 2×4 on mobile, 4-wide on tablet,
            8-wide on desktop — Net profit (right-most) is the
            headline; Sales profit + Ad spend feed into it. */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
          <StatCard label="Sales" value={filtered.totals.count.toString()} tone="ink" />
          <StatCard label="Revenue" value={`$${money(filtered.totals.revenue)}`} tone="ink" />
          <StatCard label="Cost paid" value={`$${money(filtered.totals.cost)}`} tone="ink" />
          <StatCard label="Fees" value={`$${money(filtered.totals.fees)}`} tone="muted" />
          <StatCard label="Shipping" value={`$${money(filtered.totals.shipping)}`} tone="muted" />
          <StatCard
            label="Sales profit"
            value={`$${money(filtered.totals.profit)}`}
            sub={filtered.totals.revenue > 0 ? `${(filtered.totals.marginPct * 100).toFixed(1)}% margin` : undefined}
            tone={filtered.totals.profit >= 0 ? "good" : "bad"}
          />
          <StatCard
            label="Marketing cost"
            value={`$${money(filteredAd.total)}`}
            sub={filteredAd.entries.length > 0 ? `${filteredAd.entries.length} ${filteredAd.entries.length === 1 ? "entry" : "entries"} · paid weekly, not per-sale` : "paid weekly, not per-sale"}
            tone="muted"
          />
          <StatCard
            label="Net profit"
            value={`$${money(netProfit)}`}
            sub={filtered.totals.revenue > 0 ? `${((netProfit / filtered.totals.revenue) * 100).toFixed(1)}% of revenue` : undefined}
            tone={netProfit >= 0 ? "good" : "bad"}
          />
        </div>

        {/* Per-day bar chart — only when the range spans more than
            today and there's at least one day with activity. Sales-
            profit bars stack green, ad-spend bars red, net is the
            number to the right. Pure inline SVG — no chart library. */}
        {dailySeries.length > 1 && (() => {
          const maxAbs = dailySeries.reduce((m, r) => Math.max(m, Math.abs(r.salesProfit), Math.abs(r.adSpend), Math.abs(r.net)), 0) || 1;
          return (
            <div className="bg-white/[0.03] border border-white/10 rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="text-[11px] font-bold uppercase tracking-wider text-[#888]">By day</div>
                <div className="text-[10px] text-[#666]">
                  <span className="inline-block w-2 h-2 bg-[#00c853] rounded-sm align-middle mr-1"></span>sales profit
                  <span className="inline-block w-2 h-2 bg-red-400 rounded-sm align-middle ml-3 mr-1"></span>ad spend
                </div>
              </div>
              <div className="space-y-1.5">
                {dailySeries.map((r) => (
                  <div key={r.date} className="grid grid-cols-[70px_1fr_90px] items-center gap-2 text-[11px]">
                    <div className="text-[#aaa] font-mono">{r.date.slice(5)}</div>
                    <div className="relative h-5 bg-white/[0.02] rounded-sm overflow-hidden flex items-center">
                      {r.salesProfit > 0 && (
                        <div
                          className="h-full bg-[#00c853]/70"
                          style={{ width: `${(r.salesProfit / maxAbs) * 100}%` }}
                          title={`Sales profit: $${money(r.salesProfit)}`}
                        />
                      )}
                      {r.adSpend > 0 && (
                        <div
                          className="h-full bg-red-400/70"
                          style={{ width: `${(r.adSpend / maxAbs) * 100}%` }}
                          title={`Ad spend: $${money(r.adSpend)}`}
                        />
                      )}
                    </div>
                    <div className={`text-right font-bold tabular-nums ${r.net >= 0 ? "text-[#00c853]" : "text-red-300"}`}>
                      ${money(r.net)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })()}

        {/* Per-platform breakdown — only shown when there are at
            least two platforms with sales, since a single-platform
            row would just restate the main summary. */}
        {platformBreakdown.length >= 2 && (
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-[#888] mb-2">By platform</div>
            <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
              {platformBreakdown.map((p) => (
                <div
                  key={p.platform}
                  className={`flex-none min-w-[150px] rounded-xl border px-3 py-2 ${p.profit >= 0 ? "border-white/10 bg-white/[0.03]" : "border-red-500/30 bg-red-500/5"}`}
                >
                  <div className="text-[11px] font-bold text-white truncate" title={p.platform}>{p.platform}</div>
                  <div className="text-[10px] text-[#888] mt-0.5">{p.count} sale{p.count === 1 ? "" : "s"} · ${money(p.revenue)}</div>
                  <div className={`text-sm font-extrabold tabular-nums mt-1 ${p.profit >= 0 ? "text-[#00c853]" : "text-red-300"}`}>
                    ${money(p.profit)}
                    <span className="text-[10px] font-semibold opacity-70 ml-1">{(p.marginPct * 100).toFixed(0)}%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {error && (
          <div className="bg-red-500/10 border border-red-500/40 text-red-200 text-sm rounded-lg px-3 py-2">{error}</div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-6">
          {/* Add-sale form */}
          <form onSubmit={handleAdd} className="bg-white/[0.03] border border-white/10 rounded-xl p-4 space-y-3 h-fit">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold uppercase tracking-wide text-[#bdbdbd]">
                {editingId ? "Edit sale" : "Log a sale"}
              </h2>
              {editingId && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="text-[10px] font-bold text-[#888] hover:text-white px-2 py-1 border border-white/10 rounded cursor-pointer"
                >Cancel edit</button>
              )}
            </div>
            {editingId && (
              <div className="text-[10px] text-[#888] font-mono break-all bg-black/40 border border-white/10 rounded px-2 py-1">
                Editing {editingId}
              </div>
            )}
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
                placeholder="lead-xxxx — auto-fills device + cost"
                className="w-full bg-black/40 border border-white/15 rounded-lg px-3 py-2 text-sm font-mono"
              />
              {/* Match feedback — tells the operator we found the
                  lead and what we pre-filled. Stays silent until the
                  user starts typing a lead-… id. */}
              {leadMatch.status === "loading" && (
                <div className="text-[10px] text-[#888] mt-1">looking up…</div>
              )}
              {leadMatch.status === "matched" && leadMatch.lead && (
                <div className="text-[10px] text-[#00c853] mt-1">
                  ✓ {leadMatch.lead.name || "lead"} · {formatLeadDevice(leadMatch.lead) || "unspecified device"} · ${formatLeadCost(leadMatch.lead) || "0"}
                </div>
              )}
              {leadMatch.status === "miss" && leadId.trim() && (
                <div className="text-[10px] text-[#888] mt-1">no matching lead</div>
              )}
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
              {busy ? "Saving…" : editingId ? "Save changes" : "+ Add sale"}
            </button>
          </form>

          {/* Sales table */}
          <div className="bg-white/[0.03] border border-white/10 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between gap-2">
              <h2 className="text-sm font-bold uppercase tracking-wide text-[#bdbdbd]">
                Sales <span className="text-[#666] ml-2">({filtered.sales.length})</span>
              </h2>
              <div className="flex items-center gap-3">
                <button
                  onClick={exportCSV}
                  disabled={filtered.sales.length === 0}
                  className="text-xs text-[#888] hover:text-white cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                  title="Download a CSV of the currently visible range"
                >↓ Export CSV</button>
                <button onClick={fetchSales} className="text-xs text-[#888] hover:text-white cursor-pointer">↻ Refresh</button>
              </div>
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
                        <td className="px-3 py-2 text-right whitespace-nowrap">
                          <button
                            onClick={() => loadForEdit(s)}
                            disabled={busy}
                            className={`mr-2 cursor-pointer disabled:opacity-50 ${editingId === s.id ? "text-[#00c853]" : "text-[#666] hover:text-white"}`}
                            title="Edit this sale"
                          >
                            ✎
                          </button>
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

        {/* AD-SPEND ledger — its own form + table below sales. Same
            range filter applies, totals feed the "Ad spend" + "Net
            profit" cards at the top. */}
        <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-6">
          <form id="ad-spend-form" onSubmit={handleAddAdSpend} className="bg-white/[0.03] border border-white/10 rounded-xl p-4 space-y-3 h-fit">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold uppercase tracking-wide text-[#bdbdbd]">
                {adEditingId ? "Edit marketing cost" : "Log marketing cost"}
              </h2>
              {adEditingId && (
                <button
                  type="button"
                  onClick={resetAdForm}
                  className="text-[10px] font-bold text-[#888] hover:text-white px-2 py-1 border border-white/10 rounded cursor-pointer"
                >Cancel edit</button>
              )}
            </div>
            {adEditingId && (
              <div className="text-[10px] text-[#888] font-mono break-all bg-black/40 border border-white/10 rounded px-2 py-1">
                Editing {adEditingId}
              </div>
            )}
            <Field label="Channel">
              <select
                value={adChannel}
                onChange={(e) => {
                  setAdChannel(e.target.value);
                  // Clearing the sub-channel on channel switch avoids
                  // sending "Performance Max" with a Meta entry, etc.
                  setAdSubChannel("");
                }}
                className="w-full bg-black/40 border border-white/15 rounded-lg px-3 py-2 text-sm cursor-pointer"
              >
                {AD_CHANNELS.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </Field>
            {(AD_SUB_CHANNELS[adChannel]?.length ?? 0) > 0 && (
              <Field label="Sub-channel (optional)">
                <select
                  value={adSubChannel}
                  onChange={(e) => setAdSubChannel(e.target.value)}
                  className="w-full bg-black/40 border border-white/15 rounded-lg px-3 py-2 text-sm cursor-pointer"
                >
                  <option value="">— none —</option>
                  {AD_SUB_CHANNELS[adChannel].map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </Field>
            )}
            <Field label="Campaign (optional)">
              <input
                value={adCampaign}
                onChange={(e) => setAdCampaign(e.target.value)}
                placeholder="iPhone Buy-Back · Austin"
                className="w-full bg-black/40 border border-white/15 rounded-lg px-3 py-2 text-sm"
                maxLength={80}
              />
            </Field>
            <Field label="Amount ($)">
              <input
                type="number" step="0.01" min="0" inputMode="decimal"
                value={adAmount}
                onChange={(e) => setAdAmount(e.target.value)}
                placeholder="50"
                className="w-full bg-black/40 border border-white/15 rounded-lg px-3 py-2 text-sm"
                required
              />
            </Field>
            <Field label="Spend date">
              <input
                type="date"
                value={adDate}
                onChange={(e) => setAdDate(e.target.value)}
                className="w-full bg-black/40 border border-white/15 rounded-lg px-3 py-2 text-sm cursor-pointer"
              />
            </Field>
            <Field label="Note (optional)">
              <input
                value={adNote}
                onChange={(e) => setAdNote(e.target.value)}
                placeholder="weekly budget bump"
                className="w-full bg-black/40 border border-white/15 rounded-lg px-3 py-2 text-sm"
                maxLength={240}
              />
            </Field>
            <button
              type="submit"
              disabled={adBusy}
              className="w-full bg-yellow-500 hover:bg-yellow-400 disabled:opacity-50 disabled:cursor-not-allowed text-black font-bold py-2 rounded-lg text-sm cursor-pointer transition"
            >
              {adBusy ? "Saving…" : adEditingId ? "Save changes" : "+ Add marketing cost"}
            </button>
          </form>

          <div className="bg-white/[0.03] border border-white/10 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
              <h2 className="text-sm font-bold uppercase tracking-wide text-[#bdbdbd]">
                Marketing cost <span className="text-[#666] ml-2">({filteredAd.entries.length})</span>
              </h2>
              <button onClick={fetchAdSpend} className="text-xs text-[#888] hover:text-white cursor-pointer">↻ Refresh</button>
            </div>
            {filteredAd.entries.length === 0 ? (
              <div className="px-4 py-10 text-center text-sm text-[#666]">
                {adData ? "No marketing cost logged in this range." : "Loading…"}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="text-[#888] uppercase tracking-wider">
                    <tr className="border-b border-white/10">
                      <th className="text-left px-3 py-2 font-semibold">Date</th>
                      <th className="text-left px-3 py-2 font-semibold">Channel</th>
                      <th className="text-left px-3 py-2 font-semibold">Campaign</th>
                      <th className="text-right px-3 py-2 font-semibold">Amount</th>
                      <th className="text-right px-3 py-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAd.entries.map((a) => (
                      <tr key={a.id} className="border-b border-white/5 hover:bg-white/[0.03]">
                        <td className="px-3 py-2 text-[#aaa]">{a.spendDate}</td>
                        <td className="px-3 py-2 font-semibold">
                          {a.channel}
                          {a.subChannel && <span className="text-[10px] text-[#888] font-normal ml-1">· {a.subChannel}</span>}
                        </td>
                        <td className="px-3 py-2 text-[#aaa]">
                          {a.campaign || <span className="text-[#555]">—</span>}
                          {a.note && <div className="text-[10px] text-[#666] mt-0.5">{a.note}</div>}
                        </td>
                        <td className="px-3 py-2 text-right font-bold text-red-300">−${money(a.amount)}</td>
                        <td className="px-3 py-2 text-right whitespace-nowrap">
                          <button
                            onClick={() => loadAdForEdit(a)}
                            disabled={adBusy}
                            className={`mr-2 cursor-pointer disabled:opacity-50 ${adEditingId === a.id ? "text-yellow-300" : "text-[#666] hover:text-white"}`}
                            title="Edit this entry"
                          >
                            ✎
                          </button>
                          <button
                            onClick={() => handleDeleteAdSpend(a.id)}
                            disabled={adBusy}
                            className="text-[#666] hover:text-red-400 cursor-pointer disabled:opacity-50"
                            title="Delete"
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

        {/* WEEKLY NET PROFIT — always shown, independent of the
            range toggle. Anchors the page so Skywalker has a
            constant "what did I net this week, after everything?"
            number without re-selecting the Custom range each visit.
            Ad-spend is meant to be entered weekly in this view, but
            the math works the same whether entries are daily or
            weekly — they get bucketed into the current Mon→Sun
            window either way. */}
        <div className={`rounded-2xl border p-5 ${thisWeek.net >= 0 ? "bg-[#00c853]/8 border-[#00c853]/30" : "bg-red-500/8 border-red-500/30"}`}>
          <div className="flex items-baseline justify-between gap-3 flex-wrap">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-[#888]">This week · net profit</div>
              <div className="text-[10px] text-[#666] font-mono mt-0.5">{weekRange.label}</div>
            </div>
            <div className={`text-3xl font-extrabold tabular-nums ${thisWeek.net >= 0 ? "text-[#00c853]" : "text-red-300"}`}>
              ${money(thisWeek.net)}
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 mt-4 text-[11px]">
            <WeekStat label="Sales" value={thisWeek.salesCount.toString()} />
            <WeekStat label="Revenue" value={`$${money(thisWeek.revenue)}`} />
            <WeekStat label="Cost paid" value={`$${money(thisWeek.cost)}`} />
            <WeekStat label="Fees" value={`$${money(thisWeek.fees)}`} sub />
            <WeekStat label="Shipping" value={`$${money(thisWeek.shipping)}`} sub />
            <WeekStat label="Sales profit" value={`$${money(thisWeek.salesProfit)}`} tone={thisWeek.salesProfit >= 0 ? "good" : "bad"} />
            <WeekStat label={`Ad spend (${thisWeek.adCount})`} value={`−$${money(thisWeek.adSpend)}`} tone="bad" />
          </div>
        </div>
      </div>
    </main>
  );
}

function WeekStat({ label, value, sub, tone }: { label: string; value: string; sub?: boolean; tone?: "good" | "bad" }) {
  const toneClass =
    tone === "good" ? "text-[#00c853]" :
    tone === "bad"  ? "text-red-300" :
    sub             ? "text-[#aaa]"   :
    "text-white";
  return (
    <div className="bg-black/20 border border-white/5 rounded-lg px-2.5 py-1.5">
      <div className="text-[9px] uppercase tracking-wider text-[#888] font-semibold truncate">{label}</div>
      <div className={`text-sm font-bold tabular-nums leading-tight mt-0.5 ${toneClass}`}>{value}</div>
    </div>
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

// Compose a human-readable device string from the lead's pieces. We
// fall back from device → model so the badge isn't empty when one of
// them is missing.
function formatLeadDevice(l: LeadLite): string {
  const parts = [l.device || l.model, l.storage, l.carrier].filter(Boolean);
  return parts.join(" ").trim();
}

// Pull a numeric payout from the lead. `totalPayout` is already a
// number (multi-device sum); `payout` is a free-text "$155" string —
// strip everything but digits + dot to handle either shape.
function formatLeadCost(l: LeadLite): string {
  if (typeof l.totalPayout === "number" && l.totalPayout > 0) return l.totalPayout.toFixed(2);
  if (l.payout) {
    const n = Number(String(l.payout).replace(/[^0-9.]/g, ""));
    if (Number.isFinite(n) && n > 0) return n.toFixed(2);
  }
  return "";
}
