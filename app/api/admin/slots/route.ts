import { NextRequest, NextResponse } from "next/server";

// ADMIN slot management — list-all-with-bookings and create. Proxies to
// MC server-side. Gated by x-admin-token / ?token=, which proxy.ts
// auto-injects for any caller carrying a valid Google admin session
// (so the admin UI just needs to be logged in). Direct callers can
// pass the legacy token header for automation. 2026-05-24.

const MC_API = "https://missioncontrolsdjg-production.up.railway.app";
const MC_KEY = process.env.MC_API_KEY || "";
const ADMIN_TOKEN = process.env.TCC_ADMIN_TOKEN || (() => { throw new Error("TCC_ADMIN_TOKEN env required"); })();

function checkAuth(req: NextRequest): boolean {
  const headerToken = req.headers.get("x-admin-token");
  const queryToken = req.nextUrl.searchParams.get("token");
  return headerToken === ADMIN_TOKEN || queryToken === ADMIN_TOKEN;
}

function mcConfigured(): NextResponse | null {
  if (!MC_KEY) {
    return NextResponse.json(
      { error: "MC API key not configured on server." },
      { status: 503 },
    );
  }
  return null;
}

export async function GET(req: NextRequest) {
  if (!checkAuth(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const notReady = mcConfigured(); if (notReady) return notReady;
  try {
    const r = await fetch(`${MC_API}/api/slots`, {
      headers: { "x-api-key": MC_KEY },
      cache: "no-store",
    });
    if (!r.ok) return NextResponse.json({ slots: [], mcStatus: r.status }, { status: 200 });
    const data = await r.json();
    return NextResponse.json({ slots: data.slots || [] });
  } catch (e) {
    return NextResponse.json(
      { slots: [], error: e instanceof Error ? e.message : "MC unreachable" },
      { status: 200 },
    );
  }
}

export async function POST(req: NextRequest) {
  if (!checkAuth(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const notReady = mcConfigured(); if (notReady) return notReady;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const date = typeof body.date === "string" ? body.date : "";
  const time = typeof body.time === "string" ? body.time : "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return NextResponse.json({ error: "date must be YYYY-MM-DD" }, { status: 400 });
  if (!/^\d{2}:\d{2}$/.test(time)) return NextResponse.json({ error: "time must be HH:MM (24hr)" }, { status: 400 });

  const payload = {
    date,
    time,
    label: typeof body.label === "string" ? body.label.replace(/[\[\]]/g, "").slice(0, 80).trim() : undefined,
    capacity: typeof body.capacity === "number" && body.capacity > 0 ? Math.min(20, Math.floor(body.capacity)) : 1,
  };

  try {
    const r = await fetch(`${MC_API}/api/slots`, {
      method: "POST",
      headers: { "x-api-key": MC_KEY, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      cache: "no-store",
    });
    if (!r.ok) {
      const text = await r.text().catch(() => "");
      return NextResponse.json({ error: `MC returned ${r.status}${text ? ` — ${text.slice(0, 200)}` : ""}` }, { status: 502 });
    }
    return NextResponse.json(await r.json());
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "MC unreachable" }, { status: 502 });
  }
}
