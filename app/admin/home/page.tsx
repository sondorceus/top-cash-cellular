"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

// Admin Home — the landing overview for the whole backend. One glance:
// today's volume, open pipeline, money, latest leads, then jump anywhere.
// Read-only; every number links to the page that owns it.

interface Analytics {
  summary: {
    totalLeads: number;
    totalQuote: number;
    avgQuote: number;
    last24hLeads: number;
    last24hQuote: number;
    prev24hLeads: number;
    trendPct: number | null;
  };
  days7: { date: string; count: number; quoted: number }[];
  topDevices: { device: string; count: number }[];
  statusCounts: Record<string, number>;
}

interface HomeLead {
  id: string;
  timestamp: string;
  name?: string;
  phone?: string;
  email?: string;
  device?: string;
  model?: string;
  quote?: string;
  status: string;
}

interface SalesTotals {
  count: number;
  revenue: number;
  profit: number;
  marginPct: number;
}

const STATUS_META: Record<string, { label: string; tone: string }> = {
  quote_requested: { label: "quoted", tone: "info" },
  label_created: { label: "label out", tone: "info" },
  shipped: { label: "shipped", tone: "warn" },
  received: { label: "received", tone: "warn" },
  tested: { label: "tested", tone: "warn" },
  met: { label: "met", tone: "on" },
  paid: { label: "paid", tone: "on" },
  rejected: { label: "rejected", tone: "bad" },
};

const PIPELINE_ORDER = ["quote_requested", "shipped", "received", "tested", "met", "paid"];

const QUICK_LINKS: { href: string; ico: string; name: string; desc: string }[] = [
  { href: "/admin", ico: "◉", name: "Leads", desc: "pipeline & actions" },
  { href: "/admin/customers", ico: "⬡", name: "Customers", desc: "roster & history" },
  { href: "/admin/analytics", ico: "≡", name: "Analytics", desc: "volume & trends" },
  { href: "/admin/prices", ico: "◇", name: "Prices", desc: "quote engine grid" },
  { href: "/admin/profit", ico: "⊙", name: "Profit", desc: "resale ledger" },
  { href: "/admin/referrals", ico: "✳", name: "Referrals", desc: "earned & payouts" },
  { href: "/admin/sequences", ico: "✉", name: "Sequences", desc: "email drips" },
  { href: "/admin/newsletter", ico: "◨", name: "Newsletter", desc: "subscribers & sends" },
  { href: "/admin/saved-quotes", ico: "◫", name: "Saved quotes", desc: "abandoned offers" },
  { href: "/admin/slots", ico: "◷", name: "Slots", desc: "ATX meetup times" },
];

function timeAgo(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "now";
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

function fmtQuote(q?: string): string {
  if (!q) return "—";
  const t = q.trim();
  // Only prefix $ for plain numbers — "TBD (custom)" etc. pass through.
  return /^\d/.test(t) ? `$${t}` : t;
}

function fmtMoney(n: number): string {
  const abs = Math.round(Math.abs(n)).toLocaleString();
  return n < 0 ? `-$${abs}` : `$${abs}`;
}

function dayLabel(iso: string): string {
  return new Date(iso + "T12:00:00Z").toLocaleDateString([], { weekday: "narrow" });
}

export default function AdminHomePage() {
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [activeLeads, setActiveLeads] = useState<HomeLead[] | null>(null);
  const [sales, setSales] = useState<SalesTotals | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string>("");
  const [leadsOpen, setLeadsOpen] = useState(false);

  const refresh = useCallback(async () => {
    const token = typeof window !== "undefined" ? localStorage.getItem("tcc-admin-token") : null;
    const headers: Record<string, string> = token ? { "x-admin-token": token } : {};
    const get = (url: string) => fetch(url, { headers, cache: "no-store" });
    const [a, l, s] = await Promise.allSettled([
      get("/api/admin/analytics"),
      get("/api/admin/leads?view=active"),
      get("/api/admin/sales"),
    ]);
    let unauthorized = false;
    let reached = false;
    if (a.status === "fulfilled" && a.value.ok) {
      setAnalytics(await a.value.json());
      reached = true;
    } else if (a.status === "fulfilled" && a.value.status === 401) unauthorized = true;
    if (l.status === "fulfilled" && l.value.ok) {
      const d = await l.value.json();
      setActiveLeads(d.leads || []);
      reached = true;
    }
    if (s.status === "fulfilled" && s.value.ok) {
      const d = await s.value.json();
      if (d.totals) setSales(d.totals);
      reached = true;
    }
    if (unauthorized && !reached) setError("unauthorized");
    else if (!reached) setError("unreachable");
    else {
      setError(null);
      setUpdatedAt(new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }));
    }
  }, []);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 60_000);
    return () => clearInterval(id);
  }, [refresh]);

  const hr = new Date().getHours();
  const word = hr < 5 ? "Up late" : hr < 12 ? "Good morning" : hr < 18 ? "Good afternoon" : "Good evening";
  const dateLine = new Date().toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" });

  const sum = analytics?.summary;
  const trend =
    sum && sum.trendPct !== null
      ? `${sum.trendPct >= 0 ? "▲" : "▼"} ${Math.abs(sum.trendPct)}% vs prior day`
      : "—";
  const maxDay = analytics ? Math.max(1, ...analytics.days7.map((d) => d.count)) : 1;
  const maxDevice = analytics?.topDevices.length ? analytics.topDevices[0].count : 1;

  return (
    <div className="tadm-wrap">
      <div className="tadm-greet">
        <h1>{word}, Sonny</h1>
        <div className="sub" suppressHydrationWarning>
          <span>{dateLine}</span>
          {error === "unauthorized" ? (
            <span className="tadm-chip"><span className="dot bad" />sign in on <Link href="/admin" style={{ color: "var(--tadm-info)" }}>Leads</Link></span>
          ) : error ? (
            <span className="tadm-chip"><span className="dot bad" />feed unreachable</span>
          ) : updatedAt ? (
            <span className="tadm-chip"><span className="dot on" />live · updated {updatedAt}</span>
          ) : (
            <span className="tadm-chip"><span className="dot" />syncing…</span>
          )}
        </div>
      </div>

      <div className="tadm-tiles">
        <Link href="/admin" className="tadm-tile">
          <div className="num">{sum ? sum.last24hLeads : "—"}</div>
          <div className="lbl">leads · 24h</div>
          <div className="sub">{sum ? trend : ""}</div>
        </Link>
        <Link href="/admin" className="tadm-tile">
          <div className="num">{sum ? `$${sum.last24hQuote.toLocaleString()}` : "—"}</div>
          <div className="lbl">quoted · 24h</div>
          <div className="sub">{sum ? `avg $${sum.avgQuote.toLocaleString()} per lead` : ""}</div>
        </Link>
        <Link href="/admin" className="tadm-tile">
          <div className="num">{activeLeads ? activeLeads.length : "—"}</div>
          <div className="lbl">open pipeline</div>
          <div className="sub">{sum ? `${sum.totalLeads.toLocaleString()} leads all-time` : ""}</div>
        </Link>
        <Link href="/admin/profit" className="tadm-tile">
          <div className={`num ${sales && sales.profit >= 0 ? "green" : ""}`} style={sales && sales.profit < 0 ? { color: "var(--tadm-warn)" } : undefined}>
            {sales ? fmtMoney(sales.profit) : "—"}
          </div>
          <div className="lbl">resale profit</div>
          <div className="sub">{sales ? `${Math.round(sales.marginPct)}% margin · ${sales.count} sales` : ""}</div>
        </Link>
      </div>

      {analytics && (
        <div className="tadm-card" style={{ marginTop: 10 }}>
          <h3>Pipeline</h3>
          <div className="tadm-strip">
            {PIPELINE_ORDER.map((key, i) => (
              <span key={key} style={{ display: "contents" }}>
                {i > 0 && <span className="sep">▸</span>}
                <span className="stage">
                  {STATUS_META[key].label} <b>{analytics.statusCounts[key] || 0}</b>
                </span>
              </span>
            ))}
            {(analytics.statusCounts.rejected || 0) > 0 && (
              <>
                <span className="sep">·</span>
                <span className="stage">rejected <b>{analytics.statusCounts.rejected}</b></span>
              </>
            )}
          </div>
        </div>
      )}

      <div className={`tadm-card tadm-peek ${leadsOpen ? "open" : ""}`} style={{ marginTop: 10 }}>
        <h3>
          Latest leads
          <Link className="right" href="/admin" style={{ color: "var(--tadm-dim)", fontWeight: 600 }}>
            open all →
          </Link>
        </h3>
        <div className="p-body">
          <div className="tadm-rows">
            {activeLeads === null ? (
              <div className="tadm-empty pulse">loading leads…</div>
            ) : activeLeads.length === 0 ? (
              <div className="tadm-empty">no open leads — pipeline is clear</div>
            ) : (
              activeLeads.slice(0, 12).map((l) => {
                const meta = STATUS_META[l.status] || { label: l.status, tone: "off" };
                return (
                  <Link key={l.id} href="/admin" className="tadm-row">
                    <span className="main">
                      {l.name || l.phone || l.email || "—"}{" "}
                      <span className="dim">· {l.model || l.device || "device n/a"}</span>
                    </span>
                    <span className="money">{fmtQuote(l.quote)}</span>
                    <span className={`tadm-pill ${meta.tone}`}>{meta.label}</span>
                    <span className="meta">{timeAgo(l.timestamp)}</span>
                  </Link>
                );
              })
            )}
          </div>
        </div>
        {activeLeads && activeLeads.length > 4 && (
          <button className="p-toggle" onClick={() => setLeadsOpen((v) => !v)}>
            {leadsOpen ? "▴ collapse" : "▾ show all"}
          </button>
        )}
      </div>

      <div className="tadm-cols2">
        <div className="tadm-card">
          <h3>Last 7 days</h3>
          {analytics ? (
            <>
              <div className="tadm-bars">
                {analytics.days7.map((d, i) => (
                  <div
                    key={d.date}
                    className={`b ${i === analytics.days7.length - 1 ? "hot" : ""}`}
                    style={{ height: `${Math.max(4, Math.round((d.count / maxDay) * 100))}%` }}
                    title={`${d.date}: ${d.count} leads · $${d.quoted.toLocaleString()}`}
                  />
                ))}
              </div>
              <div className="tadm-bar-lbls">
                {analytics.days7.map((d) => (
                  <span key={d.date}>{dayLabel(d.date)}</span>
                ))}
              </div>
            </>
          ) : (
            <div className="tadm-empty pulse">loading…</div>
          )}
        </div>
        <div className="tadm-card">
          <h3>Top devices</h3>
          {analytics ? (
            analytics.topDevices.slice(0, 6).map((d) => (
              <div key={d.device} className="tadm-hbar">
                <span className="n">{d.device}</span>
                <span className="track">
                  <span className="fill" style={{ width: `${Math.round((d.count / maxDevice) * 100)}%`, display: "block" }} />
                </span>
                <span className="c">{d.count}</span>
              </div>
            ))
          ) : (
            <div className="tadm-empty pulse">loading…</div>
          )}
        </div>
      </div>

      <div className="tadm-card" style={{ marginTop: 10, background: "none", border: "none", padding: "6px 0 0" }}>
        <h3>Everything else</h3>
        <div className="tadm-links">
          {QUICK_LINKS.map((q) => (
            <Link key={q.href} href={q.href} className="tadm-link">
              <span className="ico">{q.ico}</span>
              <span className="t">
                <b>{q.name}</b>
                <span>{q.desc}</span>
              </span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
