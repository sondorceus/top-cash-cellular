"use client";
import { useEffect, useState } from "react";

// Analytics dashboard — live lead-side numbers + pointers to the
// visitor-side analytics that live in Vercel + GA4 (those track every
// page view, this only tracks submissions). Skywalker 2026-05-19
// "ready to go live" — needs a single page he can open in the morning
// to see where the business is at.

interface Payload {
  summary: {
    totalLeads: number; totalQuote: number; avgQuote: number;
    last24hLeads: number; last24hQuote: number; prev24hLeads: number;
    trendPct: number | null;
  };
  todayHourly: number[];
  yesterdayHourly: number[];
  days7: { date: string; count: number; quoted: number }[];
  topDevices: { device: string; count: number }[];
  statusCounts: Record<string, number>;
  generatedAt: string;
}

function HourBar({ label, value, max, tone }: { label: string; value: number; max: number; tone: string }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className="flex items-center gap-2 text-[11px] font-mono">
      <span className="w-10 text-right text-[#888]">{label}</span>
      <div className="flex-1 bg-white/[0.04] rounded h-3 relative overflow-hidden">
        <div className={`h-full ${tone}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="w-8 text-right text-white">{value}</span>
    </div>
  );
}

function DayBar({ label, count, quoted, maxCount }: { label: string; count: number; quoted: number; maxCount: number }) {
  const pct = maxCount > 0 ? (count / maxCount) * 100 : 0;
  return (
    <div className="flex items-center gap-2 text-[12px]">
      <span className="w-20 text-[#888]">{label}</span>
      <div className="flex-1 bg-white/[0.04] rounded h-5 relative overflow-hidden">
        <div className="h-full bg-[#00c853]/40" style={{ width: `${pct}%` }} />
      </div>
      <span className="w-10 text-right text-white font-bold">{count}</span>
      <span className="w-20 text-right text-[#aaa] font-mono text-[11px]">${quoted.toLocaleString()}</span>
    </div>
  );
}

export default function AnalyticsPage() {
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);

  useEffect(() => {
    const token = typeof window !== "undefined" ? localStorage.getItem("tcc-admin-token") : null;
    fetch("/api/admin/analytics", { headers: token ? { "x-admin-token": token } : {} })
      .then((r) => {
        if (!r.ok) throw new Error(r.status === 401 ? "Unauthorized — open /admin first to set token." : `HTTP ${r.status}`);
        return r.json();
      })
      .then(setData)
      .catch((e) => setError(e.message));
  }, [refreshTick]);

  // Live auto-refresh every 60s so the dashboard stays fresh during a
  // marketing push without manual reloads.
  useEffect(() => {
    const id = setInterval(() => setRefreshTick((t) => t + 1), 60000);
    return () => clearInterval(id);
  }, []);

  if (error) return <main className="min-h-screen bg-[#0a0a0a] text-white p-8"><p className="text-red-400">{error}</p></main>;
  if (!data) return <main className="min-h-screen bg-[#0a0a0a] text-white p-8"><p className="text-[#888]">Loading…</p></main>;

  const todayMax = Math.max(1, ...data.todayHourly, ...data.yesterdayHourly);
  const day7Max = Math.max(1, ...data.days7.map((d) => d.count));
  const totalToday = data.todayHourly.reduce((s, n) => s + n, 0);
  const totalYesterday = data.yesterdayHourly.reduce((s, n) => s + n, 0);

  return (
    <main className="min-h-screen bg-[#0a0a0a] text-white">
      <div className="sticky top-0 z-20 bg-[#0a0a0a]/95 backdrop-blur border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-4 flex-wrap">
          <a href="/admin" className="text-[#888] hover:text-[#00c853] text-xs font-semibold transition">← Leads</a>
          <a href="/admin/customers" className="text-[#888] hover:text-[#00c853] text-xs font-semibold transition">👥 Customers</a>
          <a href="/admin/prices" className="text-[#888] hover:text-[#00c853] text-xs font-semibold transition">💲 Prices</a>
          <h1 className="text-lg font-extrabold tracking-tight">TCC · Analytics</h1>
          <button
            onClick={() => setRefreshTick((t) => t + 1)}
            className="ml-auto px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/15 text-xs font-semibold cursor-pointer"
            title="Refresh now (also auto-refreshes every 60s)"
          >
            ↻ Refresh
          </button>
          <span className="text-[10px] text-[#666]">auto-refresh 60s</span>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* SUMMARY CARDS */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-white/[0.04] border border-white/10 rounded-xl p-3">
            <p className="text-[11px] text-[#888] uppercase tracking-wider">Last 24h</p>
            <p className="text-2xl font-extrabold text-[#00c853]">{data.summary.last24hLeads}</p>
            <p className="text-[11px] text-[#aaa]">leads · ${data.summary.last24hQuote.toLocaleString()} quoted</p>
            {data.summary.trendPct !== null && (
              <p className={`text-[11px] font-bold mt-1 ${data.summary.trendPct >= 0 ? "text-[#00c853]" : "text-red-400"}`}>
                {data.summary.trendPct >= 0 ? "▲" : "▼"} {Math.abs(data.summary.trendPct)}% vs yesterday
              </p>
            )}
          </div>
          <div className="bg-white/[0.04] border border-white/10 rounded-xl p-3">
            <p className="text-[11px] text-[#888] uppercase tracking-wider">Total leads</p>
            <p className="text-2xl font-extrabold">{data.summary.totalLeads}</p>
            <p className="text-[11px] text-[#aaa]">last 1000 MC msgs scanned</p>
          </div>
          <div className="bg-white/[0.04] border border-white/10 rounded-xl p-3">
            <p className="text-[11px] text-[#888] uppercase tracking-wider">Avg quote</p>
            <p className="text-2xl font-extrabold">${data.summary.avgQuote}</p>
            <p className="text-[11px] text-[#aaa]">per submitted lead</p>
          </div>
          <div className="bg-white/[0.04] border border-white/10 rounded-xl p-3">
            <p className="text-[11px] text-[#888] uppercase tracking-wider">Total quoted</p>
            <p className="text-2xl font-extrabold">${data.summary.totalQuote.toLocaleString()}</p>
            <p className="text-[11px] text-[#aaa]">across all leads</p>
          </div>
        </div>

        {/* TODAY HOURLY */}
        <section className="bg-white/[0.03] border border-white/10 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <h2 className="font-bold text-[15px]">Hourly submissions — today (UTC)</h2>
            <span className="text-[12px] text-[#aaa]">{totalToday} today · {totalYesterday} yesterday</span>
          </div>
          <div className="space-y-1">
            {data.todayHourly.map((v, h) => (
              <HourBar key={h} label={`${String(h).padStart(2,"0")}:00`} value={v} max={todayMax} tone="bg-[#00c853]/60" />
            ))}
          </div>
        </section>

        {/* DAYS 7 */}
        <section className="bg-white/[0.03] border border-white/10 rounded-2xl p-5">
          <h2 className="font-bold text-[15px] mb-3">Last 7 days</h2>
          <div className="space-y-1.5">
            {data.days7.map((d) => (
              <DayBar key={d.date} label={d.date} count={d.count} quoted={d.quoted} maxCount={day7Max} />
            ))}
          </div>
        </section>

        {/* TWO COLUMN: TOP DEVICES + STATUSES */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <section className="bg-white/[0.03] border border-white/10 rounded-2xl p-5">
            <h2 className="font-bold text-[15px] mb-3">Top devices</h2>
            {data.topDevices.length === 0 && <p className="text-[#666] text-sm">No data.</p>}
            <div className="space-y-1.5">
              {data.topDevices.map((d) => (
                <DayBar key={d.device} label={d.device} count={d.count} quoted={0} maxCount={data.topDevices[0]?.count || 1} />
              ))}
            </div>
          </section>
          <section className="bg-white/[0.03] border border-white/10 rounded-2xl p-5">
            <h2 className="font-bold text-[15px] mb-3">Lead pipeline status</h2>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(data.statusCounts).sort((a, b) => b[1] - a[1]).map(([s, n]) => (
                <div key={s} className="flex items-center justify-between bg-black/30 border border-white/5 rounded px-2 py-1.5">
                  <span className="text-[12px] text-[#aaa]">{s.replace(/_/g, " ")}</span>
                  <span className="text-[14px] font-bold">{n}</span>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* VISITOR ANALYTICS POINTERS */}
        <section className="bg-[#00c853]/[0.05] border border-[#00c853]/20 rounded-2xl p-5">
          <h2 className="font-bold text-[15px] mb-2">Visitor-level analytics (page views, funnel drop-off)</h2>
          <p className="text-[13px] text-[#bdbdbd] mb-3 leading-relaxed">
            This page only counts leads that hit the database. For raw visitor counts, page paths,
            traffic sources, and which funnel step customers leave at — open these:
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[12px]">
            <a
              href="https://vercel.com/sondorceus-projects/top-cash-cellular/analytics"
              target="_blank" rel="noreferrer"
              className="flex flex-col gap-1 bg-white/[0.04] hover:bg-white/[0.07] border border-white/10 rounded-lg p-3 transition"
            >
              <span className="font-bold text-white">📈 Vercel Analytics</span>
              <span className="text-[#aaa]">
                Built-in dashboard. Daily / hourly visitors, top pages, top referrers,
                browsers, geos. Zero config.
              </span>
            </a>
            <a
              href="https://analytics.google.com"
              target="_blank" rel="noreferrer"
              className="flex flex-col gap-1 bg-white/[0.04] hover:bg-white/[0.07] border border-white/10 rounded-lg p-3 transition"
            >
              <span className="font-bold text-white">📊 Google Analytics 4</span>
              <span className="text-[#aaa]">
                Property G-8H5VGFLJ71. Realtime users, funnel explorer (set up an
                exploration → Funnel template → use `funnel_step` events), conversion
                tracking, retention.
              </span>
            </a>
          </div>
          <p className="text-[11px] text-[#888] mt-3">
            GA4 funnel events emitted: <code className="text-[#00c853]">funnel_step</code> (every
            step transition with <code>step</code>, <code>device</code>, <code>model</code> params),
            <code className="text-[#00c853]"> funnel_submit</code> (successful lead, with <code>value</code> + <code>currency</code> for revenue tracking).
          </p>
        </section>

        {/* GOOGLE ADS CONVERSION SETUP — Skywalker 2026-05-19: he asked
            me to do this but I can't log into his Ads account. So the
            checklist lives here, in /admin/analytics, where he'll see
            it the next time he opens this page. Three clicks total
            once GA4 + Ads are linked. */}
        <section className="bg-yellow-500/[0.05] border border-yellow-500/30 rounded-2xl p-5">
          <h2 className="font-bold text-[15px] mb-2">⚙️ One-time: count submissions as Google Ads conversions</h2>
          <p className="text-[13px] text-[#bdbdbd] mb-3 leading-relaxed">
            The code is already emitting the right GA4 event on every successful submit
            (<code className="text-[#00c853]">funnel_submit</code> with <code>value</code> +
            <code>currency</code>). To make Google Ads actually count those as conversions
            for campaign optimization, do these 3 clicks once — I can&apos;t log into your
            account but each step is under 60 seconds.
          </p>
          <ol className="space-y-3 text-[13px] text-[#dcdcdc]">
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-yellow-500/20 border border-yellow-500/40 text-yellow-300 text-[11px] font-bold flex items-center justify-center">1</span>
              <div className="flex-1">
                <a href="https://analytics.google.com" target="_blank" rel="noreferrer" className="font-bold text-[#00c853] hover:underline">
                  Open GA4 → Admin → Events
                </a>
                <p className="text-[12px] text-[#888] mt-0.5">
                  Find <code className="text-[#00c853]">funnel_submit</code> in the list (it
                  appears after the first real submission fires). Toggle the right-side
                  switch to <b>Mark as conversion</b>.
                </p>
              </div>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-yellow-500/20 border border-yellow-500/40 text-yellow-300 text-[11px] font-bold flex items-center justify-center">2</span>
              <div className="flex-1">
                <a href="https://ads.google.com" target="_blank" rel="noreferrer" className="font-bold text-[#00c853] hover:underline">
                  Open Google Ads → Tools → Linked accounts → Google Analytics (GA4)
                </a>
                <p className="text-[12px] text-[#888] mt-0.5">
                  Click <b>Link</b> on your G-8H5VGFLJ71 property. Auto-import all events
                  and conversions.
                </p>
              </div>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-yellow-500/20 border border-yellow-500/40 text-yellow-300 text-[11px] font-bold flex items-center justify-center">3</span>
              <div className="flex-1">
                <a href="https://ads.google.com" target="_blank" rel="noreferrer" className="font-bold text-[#00c853] hover:underline">
                  Google Ads → Tools → Conversions → + New → Import → GA4
                </a>
                <p className="text-[12px] text-[#888] mt-0.5">
                  Tick <code className="text-[#00c853]">funnel_submit</code> and finish.
                  Done — every submitted lead now counts as a conversion in Ads with the
                  customer&apos;s quote $ as the value.
                </p>
              </div>
            </li>
          </ol>
          <p className="text-[11px] text-[#888] mt-3">
            Verify it&apos;s working: submit a test lead at <code>topcashcellular.com</code>, wait
            up to 24h, then check Ads → Conversions → recent activity. The submission should
            show up with its $ value attached.
          </p>
        </section>

        <p className="text-[10px] text-[#555] text-center">
          Last refreshed {new Date(data.generatedAt).toLocaleTimeString()}.
          Lead counts are scanned from the most recent 1,000 MC messages.
        </p>
      </div>
    </main>
  );
}
