import { NextRequest, NextResponse } from "next/server";

const MC_API = "https://missioncontrolsdjg-production.up.railway.app";
const MC_KEY = process.env.MC_API_KEY || "";
const ADMIN_TOKEN = process.env.TCC_ADMIN_TOKEN || "topcash-admin-2026";

function checkAuth(req: NextRequest): boolean {
  const headerToken = req.headers.get("x-admin-token");
  const queryToken = req.nextUrl.searchParams.get("token");
  return headerToken === ADMIN_TOKEN || queryToken === ADMIN_TOKEN;
}

// Internal staff note on a lead. Persists by posting [NOTE: <text>] [LEAD: <id>]
// to MC comms — read back by /api/admin/leads when listing.
export async function POST(req: NextRequest) {
  if (!checkAuth(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { leadId, note } = await req.json();
  if (!leadId || !note || typeof note !== "string" || !note.trim()) {
    return NextResponse.json({ error: "leadId and note required" }, { status: 400 });
  }
  const trimmed = note.trim().slice(0, 500);
  const body = `[NOTE: ${trimmed}] [LEAD: ${leadId}]`;
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
    return NextResponse.json({ ok: true, note: trimmed });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "MC unavailable" }, { status: 502 });
  }
}
