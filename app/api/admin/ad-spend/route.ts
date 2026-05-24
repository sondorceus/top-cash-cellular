import { NextRequest, NextResponse } from "next/server";

// Ad-spend ledger. Same MC-comms pattern as the sales endpoint, but
// every entry costs us money instead of earning us money — net profit
// for the business is `sum(sales.profit) - sum(adSpend.amount)`. We
// keep this on its own endpoint (instead of stuffing both into
// /sales) so the schemas don't drift into one another over time.

const MC_API = "https://missioncontrolsdjg-production.up.railway.app";
const MC_KEY = process.env.MC_API_KEY || "";
const ADMIN_TOKEN = process.env.TCC_ADMIN_TOKEN || "topcash-admin-2026";

function checkAuth(req: NextRequest): boolean {
  const headerToken = req.headers.get("x-admin-token");
  const queryToken = req.nextUrl.searchParams.get("token");
  return headerToken === ADMIN_TOKEN || queryToken === ADMIN_TOKEN;
}

function genId(): string {
  return "ad-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);
}

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function clean(v: unknown, maxLen = 240): string {
  return String(v ?? "").replace(/[\[\]]/g, "").replace(/\s+$/g, "").slice(0, maxLen);
}

export interface AdSpendRecord {
  id: string;
  channel: string;          // "Google Ads", "Meta", "TikTok", etc.
  campaign?: string;
  amount: number;
  spendDate: string;        // ISO date YYYY-MM-DD
  note?: string;
  createdAt: string;
}

interface AdSpendTotals { count: number; total: number }

function parseSpendBody(body: string): Omit<AdSpendRecord, "id" | "createdAt"> | null {
  const get = (key: string) => {
    const re = new RegExp(`(?:^|\\n)${key}:[ \\t]*([^\\n]*)`, "i");
    const m = body.match(re);
    return m?.[1]?.trim();
  };
  const channel = get("Channel");
  if (!channel) return null;
  return {
    channel,
    campaign: get("Campaign") || undefined,
    amount: num(get("Amount")),
    spendDate: get("Spend-Date") || new Date().toISOString().slice(0, 10),
    note: get("Note") || undefined,
  };
}

export async function GET(req: NextRequest) {
  if (!checkAuth(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  let r: Response;
  try {
    r = await fetch(`${MC_API}/api/comms?limit=1000`, {
      headers: { "x-api-key": MC_KEY },
      cache: "no-store",
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "MC unavailable" }, { status: 502 });
  }
  if (!r.ok) return NextResponse.json({ error: `MC HTTP ${r.status}` }, { status: 502 });
  const data = await r.json();
  const messages: { id: string; body?: string; timestamp: string }[] = data.messages || [];

  const deleted = new Set<string>();
  for (const m of messages) {
    if (!m.body) continue;
    const dm = m.body.match(/\[DELETED-AD-SPEND:\s*([\w-]+)\]/i);
    if (dm) deleted.add(dm[1]);
  }

  const byId = new Map<string, { entry: AdSpendRecord; timestamp: string }>();
  for (const m of messages) {
    if (!m.body) continue;
    const sm = m.body.match(/\[AD-SPEND:\s*([\w-]+)\]/i);
    if (!sm) continue;
    const id = sm[1];
    if (deleted.has(id)) continue;
    const parsed = parseSpendBody(m.body);
    if (!parsed) continue;
    const entry: AdSpendRecord = { id, ...parsed, createdAt: m.timestamp };
    const prev = byId.get(id);
    if (!prev || m.timestamp > prev.timestamp) byId.set(id, { entry, timestamp: m.timestamp });
  }

  const entries = Array.from(byId.values())
    .map((v) => v.entry)
    .sort((a, b) => (b.spendDate.localeCompare(a.spendDate)) || (b.createdAt.localeCompare(a.createdAt)));

  const totals: AdSpendTotals = { count: entries.length, total: 0 };
  for (const e of entries) totals.total += e.amount;
  totals.total = Math.round(totals.total * 100) / 100;

  return NextResponse.json({ entries, totals });
}

export async function POST(req: NextRequest) {
  if (!checkAuth(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  let payload: Record<string, unknown>;
  try {
    payload = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const channel = clean(payload.channel, 40);
  if (!channel) {
    return NextResponse.json({ error: "channel required" }, { status: 400 });
  }
  const id = typeof payload.id === "string" && /^[\w-]{4,64}$/.test(payload.id) ? payload.id : genId();
  const campaign = clean(payload.campaign, 80);
  const amount = num(payload.amount);
  const spendDate = (() => {
    const s = clean(payload.spendDate, 10);
    return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : new Date().toISOString().slice(0, 10);
  })();
  const note = clean(payload.note, 240);

  const lines = [
    `[AD-SPEND: ${id}]`,
    `Channel: ${channel}`,
    `Amount: ${amount}`,
    `Spend-Date: ${spendDate}`,
  ];
  if (campaign) lines.push(`Campaign: ${campaign}`);
  if (note) lines.push(`Note: ${note}`);
  const body = lines.join("\n");

  try {
    const r = await fetch(`${MC_API}/api/comms`, {
      method: "POST",
      headers: { "x-api-key": MC_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "tcc-admin",
        fromName: "TCC Admin",
        role: "system",
        body,
        priority: "normal",
      }),
    });
    if (!r.ok) return NextResponse.json({ error: `MC HTTP ${r.status}` }, { status: 502 });
    return NextResponse.json({
      ok: true,
      entry: { id, channel, campaign: campaign || undefined, amount, spendDate, note: note || undefined },
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "MC unavailable" }, { status: 502 });
  }
}
