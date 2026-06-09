import { NextRequest, NextResponse } from "next/server";
import { safeEqual } from "../../../lib/admin-auth";

// Profit / sales ledger. Mirrors the [NOTE: …] [LEAD: …] pattern other
// admin endpoints use — every sale is one comms message on Mission
// Control, tagged `[SALE: <sale-id>]` with the deal fields below the
// tag. Deletes are tombstones (`[DELETED-SALE: <id>]`) so we never
// destroy MC history.
//
// Why MC instead of a fresh KV / Blob: the entire admin already round-
// trips through MC comms (leads, statuses, notes, customers, analytics)
// — adding a second store just for sales would double the ops surface
// for a feature that lives on the same auth + retention rules.

const MC_API = "https://missioncontrolsdjg-production.up.railway.app";
const MC_KEY = process.env.MC_API_KEY || "";
const ADMIN_TOKEN = process.env.TCC_ADMIN_TOKEN;

function checkAuth(req: NextRequest): boolean {
  const headerToken = req.headers.get("x-admin-token");
  const queryToken = req.nextUrl.searchParams.get("token");
  return safeEqual(headerToken, ADMIN_TOKEN) || safeEqual(queryToken, ADMIN_TOKEN);
}

function genId(): string {
  // Short, URL-safe, sortable-ish — same flavor as the rest of the app.
  return "sale-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);
}

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

// Sanitize anything the operator might type. We need to keep newlines
// for the multi-line body, but kill `[` and `]` so a stray bracket
// can't fake a downstream tag like `[STATUS: ...]`.
function clean(v: unknown, maxLen = 240): string {
  return String(v ?? "").replace(/[\[\]]/g, "").replace(/\s+$/g, "").slice(0, maxLen);
}

export interface SaleRecord {
  id: string;
  device: string;
  platform: string;
  soldPrice: number;
  cost: number;
  fees: number;
  shipping: number;
  saleDate: string;          // ISO date (YYYY-MM-DD)
  leadId?: string;
  note?: string;
  profit: number;            // soldPrice - cost - fees - shipping
  createdAt: string;         // MC message timestamp
}

interface SalesTotals {
  count: number;
  revenue: number;
  cost: number;
  fees: number;
  shipping: number;
  profit: number;
  marginPct: number;         // profit / revenue (0..1), 0 when revenue is 0
}

function parseSaleBody(body: string): Omit<SaleRecord, "id" | "createdAt" | "profit"> | null {
  const get = (key: string) => {
    const re = new RegExp(`(?:^|\\n)${key}:[ \\t]*([^\\n]*)`, "i");
    const m = body.match(re);
    return m?.[1]?.trim();
  };
  const device = get("Device");
  if (!device) return null;
  return {
    device,
    platform: get("Platform") || "Other",
    soldPrice: num(get("Sold-Price")),
    cost: num(get("Cost")),
    fees: num(get("Fees")),
    shipping: num(get("Shipping")),
    saleDate: get("Sale-Date") || new Date().toISOString().slice(0, 10),
    leadId: get("Lead-Id") || undefined,
    note: get("Note") || undefined,
  };
}

function rollup(sales: SaleRecord[]): SalesTotals {
  const t = { count: sales.length, revenue: 0, cost: 0, fees: 0, shipping: 0, profit: 0, marginPct: 0 };
  for (const s of sales) {
    t.revenue += s.soldPrice;
    t.cost += s.cost;
    t.fees += s.fees;
    t.shipping += s.shipping;
    t.profit += s.profit;
  }
  t.marginPct = t.revenue > 0 ? t.profit / t.revenue : 0;
  // Round to 2dp so the wire payload doesn't drag floating-point noise.
  for (const k of ["revenue", "cost", "fees", "shipping", "profit"] as const) {
    t[k] = Math.round(t[k] * 100) / 100;
  }
  t.marginPct = Math.round(t.marginPct * 10000) / 10000;
  return t;
}

export async function GET(req: NextRequest) {
  if (!checkAuth(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  let r: Response;
  try {
    r = await fetch(`${MC_API}/api/comms?limit=5000`, {
      headers: { "x-api-key": MC_KEY },
      cache: "no-store",
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "MC unavailable" }, { status: 502 });
  }
  if (!r.ok) return NextResponse.json({ error: `MC HTTP ${r.status}` }, { status: 502 });
  const data = await r.json();
  const messages: { id: string; body?: string; timestamp: string }[] = data.messages || [];

  // First pass: collect tombstones so we can ignore deleted sales.
  const deleted = new Set<string>();
  for (const m of messages) {
    if (!m.body) continue;
    const dm = m.body.match(/\[DELETED-SALE:\s*([\w-]+)\]/i);
    if (dm) deleted.add(dm[1]);
  }

  // Second pass: keep the LATEST [SALE: id] message per id (so an edit
  // — same id, fresher body — supersedes the original). Sales without
  // an id field are skipped, same as orphan leads in the other endpoints.
  const byId = new Map<string, { sale: SaleRecord; timestamp: string }>();
  for (const m of messages) {
    if (!m.body) continue;
    const sm = m.body.match(/\[SALE:\s*([\w-]+)\]/i);
    if (!sm) continue;
    const id = sm[1];
    if (deleted.has(id)) continue;
    const parsed = parseSaleBody(m.body);
    if (!parsed) continue;
    const profit = +(parsed.soldPrice - parsed.cost - parsed.fees - parsed.shipping).toFixed(2);
    const sale: SaleRecord = { id, ...parsed, profit, createdAt: m.timestamp };
    const prev = byId.get(id);
    if (!prev || m.timestamp > prev.timestamp) byId.set(id, { sale, timestamp: m.timestamp });
  }

  const sales = Array.from(byId.values())
    .map((v) => v.sale)
    // Newest sale-date first; ties broken by createdAt so the most
    // recently logged entry sits on top.
    .sort((a, b) => (b.saleDate.localeCompare(a.saleDate)) || (b.createdAt.localeCompare(a.createdAt)));

  return NextResponse.json({ sales, totals: rollup(sales) });
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
  const device = clean(payload.device, 80);
  if (!device) {
    return NextResponse.json({ error: "device required" }, { status: 400 });
  }
  // Allow caller to supply an id (for edits — same id = same row);
  // otherwise mint one.
  const id = typeof payload.id === "string" && /^[\w-]{4,64}$/.test(payload.id) ? payload.id : genId();
  const platform = clean(payload.platform, 40) || "Other";
  const soldPrice = num(payload.soldPrice);
  const cost = num(payload.cost);
  const fees = num(payload.fees);
  const shipping = num(payload.shipping);
  const saleDate = (() => {
    const s = clean(payload.saleDate, 10);
    return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : new Date().toISOString().slice(0, 10);
  })();
  const leadId = clean(payload.leadId, 60) || "";
  const note = clean(payload.note, 240);

  // Body shape: tag on its own line, then `Key: value` rows. The GET
  // parser keys off line-anchored `KEY:` so the order doesn't matter,
  // only that each field is on its own line.
  const lines = [
    `[SALE: ${id}]`,
    `Device: ${device}`,
    `Platform: ${platform}`,
    `Sold-Price: ${soldPrice}`,
    `Cost: ${cost}`,
    `Fees: ${fees}`,
    `Shipping: ${shipping}`,
    `Sale-Date: ${saleDate}`,
  ];
  if (leadId) lines.push(`Lead-Id: ${leadId}`);
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
    const profit = +(soldPrice - cost - fees - shipping).toFixed(2);
    return NextResponse.json({
      ok: true,
      sale: { id, device, platform, soldPrice, cost, fees, shipping, saleDate, leadId: leadId || undefined, note: note || undefined, profit },
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "MC unavailable" }, { status: 502 });
  }
}
