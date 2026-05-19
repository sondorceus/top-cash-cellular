import { NextRequest, NextResponse } from "next/server";

const MC_API = "https://missioncontrolsdjg-production.up.railway.app";
const MC_KEY = process.env.MC_API_KEY || "";
const ADMIN_TOKEN = process.env.TCC_ADMIN_TOKEN || "topcash-admin-2026";

// Live analytics derived from the MC lead feed. Skywalker 2026-05-19
// "ready to go live" — needs an in-admin view of submissions per day /
// hour, top devices, average quote, and where things are sitting in the
// pipeline. Visitor-level analytics (page views, funnel drop-off, hourly
// uniques) live in Vercel Analytics + GA4 — this endpoint focuses on
// what happens AFTER a visitor hits Submit, which is the data we own.

function checkAuth(req: NextRequest): boolean {
  const headerToken = req.headers.get("x-admin-token");
  const queryToken = req.nextUrl.searchParams.get("token");
  return headerToken === ADMIN_TOKEN || queryToken === ADMIN_TOKEN;
}

function parseField(body: string, key: string): string | undefined {
  const re = new RegExp(`(?:^|\\n)${key}:[ \\t]*([^\\n]*)`, "i");
  const m = body.match(re);
  return m?.[1]?.trim() || undefined;
}

function parseQuote(raw: string | undefined): number {
  if (!raw) return 0;
  const m = raw.match(/\d+/);
  return m ? parseInt(m[0], 10) : 0;
}

// Internal-lead identifiers — same source-of-truth as /api/admin/leads.
// Leads matching these are excluded from analytics counts by default so
// Skywalker's testing doesn't skew daily/hourly/avg-quote numbers.
const INTERNAL_IPS = (process.env.TCC_INTERNAL_IPS || "136.49.4.25").split(",").map((s) => s.trim()).filter(Boolean);
const INTERNAL_EMAILS = (process.env.TCC_INTERNAL_EMAILS || "sondorceus@gmail.com,sellurcell@topcashcells.com").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
function isInternalLead(body: string): boolean {
  const ip = parseField(body, "Source-IP");
  if (ip && INTERNAL_IPS.includes(ip)) return true;
  const em = parseField(body, "Email")?.toLowerCase();
  if (em && INTERNAL_EMAILS.includes(em)) return true;
  return false;
}

export async function GET(req: NextRequest) {
  if (!checkAuth(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const r = await fetch(`${MC_API}/api/comms?limit=1000`, {
    headers: { "x-api-key": MC_KEY },
    cache: "no-store",
  });
  if (!r.ok) return NextResponse.json({ error: "MC unavailable" }, { status: 502 });
  const data = await r.json();
  const messages: { id: string; body?: string; timestamp: string }[] = data.messages || [];

  // Status index (for terminal-stage counts in the rollup)
  const statusByLead = new Map<string, { status: string; timestamp: string }>();
  const deletedLeads = new Set<string>();
  for (const m of messages) {
    if (!m.body) continue;
    const sm = m.body.match(/\[STATUS:\s*([\w_]+)\]\s*\[LEAD:\s*([\w-]+)\]/i);
    if (sm) {
      const prev = statusByLead.get(sm[2]);
      if (!prev || m.timestamp > prev.timestamp) {
        statusByLead.set(sm[2], { status: sm[1].toLowerCase(), timestamp: m.timestamp });
      }
    }
    const dm = m.body.match(/\[DELETED-LEAD:\s*([\w-]+)\]/i);
    if (dm) deletedLeads.add(dm[1]);
  }

  // Walk leads, bucket per-hour for the last 7 days
  const now = Date.now();
  const hourly: Record<string, number> = {}; // key: ISO hour (YYYY-MM-DDTHH)
  const dailyCounts: Record<string, number> = {}; // key: YYYY-MM-DD
  const dailyValue: Record<string, number> = {};
  const deviceCounts: Record<string, number> = {}; // device name → count
  const statusCounts: Record<string, number> = {};
  const todayHourly: number[] = Array(24).fill(0); // 0..23 hour bins for "today"
  const yesterdayHourly: number[] = Array(24).fill(0);
  let totalLeads = 0;
  let totalQuote = 0;
  let last24hLeads = 0; let last24hQuote = 0;
  let prev24hLeads = 0;

  const today = new Date(now).toISOString().slice(0, 10);
  const yesterday = new Date(now - 86400000).toISOString().slice(0, 10);

  const internalView = req.nextUrl.searchParams.get("internal") || "hide";
  let internalSkipped = 0;
  for (const m of messages) {
    if (!m.body || !m.body.includes("[NEW BUYBACK LEAD")) continue;
    if (deletedLeads.has(m.id)) continue;
    if (internalView !== "show" && isInternalLead(m.body)) {
      internalSkipped++;
      continue;
    }
    totalLeads++;
    const t = new Date(m.timestamp);
    const ageH = (now - t.getTime()) / 3600000;
    const quote = parseQuote(parseField(m.body, "Quote") || parseField(m.body, "Offer"));
    totalQuote += quote;

    const dayKey = m.timestamp.slice(0, 10);
    const hourKey = m.timestamp.slice(0, 13);
    dailyCounts[dayKey] = (dailyCounts[dayKey] || 0) + 1;
    dailyValue[dayKey] = (dailyValue[dayKey] || 0) + quote;
    hourly[hourKey] = (hourly[hourKey] || 0) + 1;

    if (dayKey === today) todayHourly[t.getUTCHours()] += 1;
    if (dayKey === yesterday) yesterdayHourly[t.getUTCHours()] += 1;
    if (ageH < 24) { last24hLeads++; last24hQuote += quote; }
    else if (ageH < 48) { prev24hLeads++; }

    const device = parseField(m.body, "Device")?.split(" — ")[0] || "Unknown";
    deviceCounts[device] = (deviceCounts[device] || 0) + 1;
    const status = statusByLead.get(m.id)?.status || "quote_requested";
    statusCounts[status] = (statusCounts[status] || 0) + 1;
  }

  // Top devices (descending)
  const topDevices = Object.entries(deviceCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([device, count]) => ({ device, count }));

  // Last 7 days, oldest → newest, so the chart reads left → right
  const days7: { date: string; count: number; quoted: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now - i * 86400000).toISOString().slice(0, 10);
    days7.push({ date: d, count: dailyCounts[d] || 0, quoted: dailyValue[d] || 0 });
  }

  return NextResponse.json({
    summary: {
      totalLeads,
      totalQuote,
      avgQuote: totalLeads > 0 ? Math.round(totalQuote / totalLeads) : 0,
      last24hLeads,
      last24hQuote,
      prev24hLeads,
      trendPct: prev24hLeads > 0 ? Math.round(((last24hLeads - prev24hLeads) / prev24hLeads) * 100) : null,
    },
    todayHourly,           // 24-bin array — hour 0..23 (UTC)
    yesterdayHourly,
    days7,                 // oldest→newest last 7 calendar days
    topDevices,
    statusCounts,
    generatedAt: new Date().toISOString(),
    internalHidden: internalSkipped,
  });
}
