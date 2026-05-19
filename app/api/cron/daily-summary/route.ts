import { NextRequest, NextResponse } from "next/server";

// Daily morning summary email — runs once a day via Vercel cron at
// ~9am CT and emails the owner a single-page dashboard of yesterday's
// activity: new leads, paid customers, shipped packages, total
// revenue, top devices. Owner can run the business without logging
// into /admin every morning.
//
// Auth: Authorization: Bearer ${CRON_SECRET} — same pattern as the
// existing /api/cron/reminders endpoint. Vercel cron sends this
// header automatically.
//
// Skywalker 2026-05-19 gap audit, item #5.

const MC_API = "https://missioncontrolsdjg-production.up.railway.app";
const MC_KEY = process.env.MC_API_KEY || "";
const RESEND_KEY = process.env.RESEND_API_KEY || "";
const OWNER_EMAIL = process.env.OWNER_EMAIL || "CustomerService@topcashcells.com";

// Internal/test addresses that the digest should skip when counting
// "real" leads. Skywalker submits a lot of test leads from his own
// email; counting them inflates the morning numbers.
const INTERNAL_EMAILS = (process.env.TCC_INTERNAL_EMAILS ||
  "sondorceus@gmail.com,sellurcell@topcashcells.com")
  .split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);

type Msg = { id?: string; body?: string; timestamp: string };

function parseField(body: string, field: string): string | null {
  const re = new RegExp(`^${field}:\\s*(.+)$`, "im");
  const m = body.match(re);
  return m ? m[1].trim() : null;
}

function parseQuoteDollars(quote: string | null): number {
  if (!quote) return 0;
  const m = quote.replace(/,/g, "").match(/\$?\s*(\d+)/);
  return m ? parseInt(m[1], 10) : 0;
}

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization") || "";
  const secret = process.env.CRON_SECRET;
  const queryToken = req.nextUrl.searchParams.get("token");
  // Allow manual trigger via ?token= for testing — same secret either way.
  const ok = secret && (auth === `Bearer ${secret}` || queryToken === secret);
  if (!ok) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  if (!MC_KEY) return NextResponse.json({ error: "MC_API_KEY not configured" }, { status: 500 });

  let messages: Msg[] = [];
  try {
    const r = await fetch(`${MC_API}/api/comms?limit=1000`, {
      headers: { "x-api-key": MC_KEY },
      cache: "no-store",
    });
    if (!r.ok) throw new Error(`MC ${r.status}`);
    const j = await r.json();
    const arr = j.messages || j;
    if (Array.isArray(arr)) messages = arr;
  } catch (e) {
    return NextResponse.json({ error: `MC fetch failed: ${e instanceof Error ? e.message : "?"}` }, { status: 502 });
  }

  // Bucket by window. Yesterday = last full UTC day. Week = last 7 days.
  const nowMs = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;
  const yesterdayStart = nowMs - dayMs;
  const weekStart = nowMs - 7 * dayMs;

  // Counts + revenue, all-time + windows. "leads" = NEW BUYBACK LEAD posts.
  // "status flips" = [STATUS: paid|met|shipped|received|tested] posts.
  type DayBucket = {
    newLeads: number;
    paid: number;
    shipped: number;
    received: number;
    rejected: number;
    revenue: number;
    deviceTally: Record<string, number>;
  };
  const day: DayBucket = { newLeads: 0, paid: 0, shipped: 0, received: 0, rejected: 0, revenue: 0, deviceTally: {} };
  const week: DayBucket = { newLeads: 0, paid: 0, shipped: 0, received: 0, rejected: 0, revenue: 0, deviceTally: {} };
  let allTimeRevenue = 0;
  let allTimePaid = 0;

  // Track lead → email to filter internal addresses
  const leadEmail: Map<string, string> = new Map();
  const leadQuote: Map<string, number> = new Map();
  const leadDevice: Map<string, string> = new Map();

  for (const m of messages) {
    if (!m.body || !m.timestamp || !m.id) continue;
    const ts = new Date(m.timestamp).getTime();
    if (isNaN(ts)) continue;
    const isNewLead = /\[NEW BUYBACK LEAD(\b| — \d+ DEVICES\])/i.test(m.body);
    const statusMatch = m.body.match(/\[STATUS:\s*(\w+)\][^\n]*\[LEAD:\s*([^\]]+)\]/i);
    if (isNewLead) {
      const email = (parseField(m.body, "Email") || "").toLowerCase();
      const device = parseField(m.body, "Device") || "—";
      const model = device.includes("—") ? device.split("—").slice(-1)[0].trim() : device;
      const quote = parseQuoteDollars(parseField(m.body, "Quote"));
      const isInternal = INTERNAL_EMAILS.includes(email);
      leadEmail.set(m.id, email);
      leadQuote.set(m.id, quote);
      leadDevice.set(m.id, model);
      if (!isInternal) {
        if (ts >= yesterdayStart) {
          day.newLeads++;
          day.deviceTally[model] = (day.deviceTally[model] || 0) + 1;
        }
        if (ts >= weekStart) {
          week.newLeads++;
          week.deviceTally[model] = (week.deviceTally[model] || 0) + 1;
        }
      }
    } else if (statusMatch) {
      const status = statusMatch[1].toLowerCase();
      const leadId = statusMatch[2].trim();
      const email = leadEmail.get(leadId) || "";
      const quote = leadQuote.get(leadId) || 0;
      if (INTERNAL_EMAILS.includes(email)) continue;
      const isPaid = status === "paid" || status === "met";
      if (isPaid) {
        allTimePaid++;
        allTimeRevenue += quote;
      }
      const bump = (b: DayBucket) => {
        if (isPaid) { b.paid++; b.revenue += quote; }
        else if (status === "shipped") b.shipped++;
        else if (status === "received") b.received++;
        else if (status === "rejected") b.rejected++;
      };
      if (ts >= yesterdayStart) bump(day);
      if (ts >= weekStart) bump(week);
    }
  }

  // Top 3 devices by lead count (yesterday)
  const topDevices = Object.entries(day.deviceTally)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([model, n]) => `${model} (${n})`)
    .join(" · ") || "—";

  // HTML email — quick scannable digest, mobile-friendly width.
  const html = buildDigestHtml({ day, week, topDevices, allTimeRevenue, allTimePaid });
  const subject = `📊 Top Cash daily — ${day.newLeads} new · ${day.paid} paid · $${day.revenue.toLocaleString()} (24h)`;

  // Send via Resend if configured. If not, return the payload so the
  // operator can preview/debug.
  if (!RESEND_KEY) {
    return NextResponse.json({
      sent: false,
      reason: "RESEND_API_KEY not configured",
      preview: { subject, day, week, topDevices, allTimeRevenue, allTimePaid },
    });
  }
  try {
    const { Resend } = await import("resend");
    const resend = new Resend(RESEND_KEY);
    const r = await resend.emails.send({
      from: "Top Cash Cellular <noreply@topcashcellular.com>",
      to: [OWNER_EMAIL],
      subject,
      html,
    });
    return NextResponse.json({
      sent: true,
      to: OWNER_EMAIL,
      messageId: r.data?.id || null,
      day, week,
    });
  } catch (e) {
    return NextResponse.json({
      sent: false,
      error: e instanceof Error ? e.message : "send failed",
      day, week,
    }, { status: 502 });
  }
}

function buildDigestHtml(args: {
  day: { newLeads: number; paid: number; shipped: number; received: number; rejected: number; revenue: number };
  week: { newLeads: number; paid: number; shipped: number; received: number; rejected: number; revenue: number };
  topDevices: string;
  allTimeRevenue: number;
  allTimePaid: number;
}): string {
  const { day, week, topDevices, allTimeRevenue, allTimePaid } = args;
  const stat = (label: string, value: string, color = "#fff") => `
    <td style="padding:14px 8px;text-align:center;border-right:1px solid rgba(255,255,255,0.06)">
      <div style="font-size:22px;font-weight:800;color:${color};line-height:1.1">${value}</div>
      <div style="font-size:10px;color:#888;text-transform:uppercase;letter-spacing:0.12em;margin-top:4px">${label}</div>
    </td>`;
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#e6e6e6">
<div style="background:#0a0a0a;padding:32px 16px">
<table role="presentation" width="640" cellpadding="0" cellspacing="0" border="0" style="max-width:640px;margin:0 auto;background:#0f0f0f;border:1px solid rgba(255,255,255,0.08);border-radius:18px;overflow:hidden;box-shadow:0 10px 30px rgba(0,0,0,0.5)">
<tr><td style="background:linear-gradient(135deg,#00e676 0%,#00a039 100%);padding:24px 28px">
<div style="font-size:11px;font-weight:800;letter-spacing:0.18em;text-transform:uppercase;color:#0a0a0a;opacity:0.7;margin-bottom:4px">Top Cash Cellular — Daily Digest</div>
<div style="font-size:24px;font-weight:800;color:#0a0a0a;line-height:1.1">${new Date().toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric", timeZone: "America/Chicago" })}</div>
</td></tr>

<tr><td style="padding:24px 24px 8px 24px">
<div style="font-size:11px;color:#00c853;font-weight:800;letter-spacing:0.18em;text-transform:uppercase;margin-bottom:10px">Last 24 hours</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:12px">
<tr>
${stat("New leads", String(day.newLeads), "#fff")}
${stat("Paid", String(day.paid), "#00c853")}
${stat("Shipped", String(day.shipped), "#4fc3f7")}
${stat("Revenue", `$${day.revenue.toLocaleString()}`, "#00c853")}
</tr>
</table>
${topDevices !== "—" ? `<p style="margin:12px 4px 0;font-size:12px;color:#a0a0a0">Top devices: <span style="color:#dcdcdc">${topDevices}</span></p>` : ""}
</td></tr>

<tr><td style="padding:24px 24px 8px 24px">
<div style="font-size:11px;color:#00c853;font-weight:800;letter-spacing:0.18em;text-transform:uppercase;margin-bottom:10px">Last 7 days</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:12px">
<tr>
${stat("Leads", String(week.newLeads), "#fff")}
${stat("Paid", String(week.paid), "#00c853")}
${stat("Shipped", String(week.shipped), "#4fc3f7")}
${stat("Revenue", `$${week.revenue.toLocaleString()}`, "#00c853")}
</tr>
</table>
</td></tr>

<tr><td style="padding:24px 24px 8px 24px">
<div style="font-size:11px;color:#888;font-weight:800;letter-spacing:0.18em;text-transform:uppercase;margin-bottom:10px">All-time</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:12px">
<tr>
${stat("Paid customers", String(allTimePaid), "#fff")}
${stat("Lifetime revenue", `$${allTimeRevenue.toLocaleString()}`, "#00c853")}
</tr>
</table>
</td></tr>

<tr><td style="padding:24px 28px 28px 28px;text-align:center">
<a href="https://topcashcellular.com/admin" style="display:inline-block;padding:13px 28px;background:linear-gradient(180deg,#00e676 0%,#00c853 60%,#00a039 100%);color:#0a0a0a;font-weight:800;font-size:14px;text-decoration:none;border-radius:999px;box-shadow:inset 0 1px 0 rgba(255,255,255,0.4),0 4px 14px rgba(0,200,83,0.35)">Open admin dashboard →</a>
<p style="margin:16px 4px 0;font-size:11px;color:#666;line-height:1.5">Internal test emails (${INTERNAL_EMAILS.join(", ")}) are filtered out of these numbers.<br>Override via TCC_INTERNAL_EMAILS env var.</p>
</td></tr>
</table>
</div></body></html>`;
}
