import { NextRequest, NextResponse } from "next/server";

const MC_API = "https://missioncontrolsdjg-production.up.railway.app";
const MC_KEY = process.env.MC_API_KEY || process.env.NEXT_PUBLIC_MC_API_KEY || "";
const ADMIN_TOKEN = process.env.TCC_ADMIN_TOKEN || "topcash-admin-2026";

// Restore a soft-trashed lead. Mirrors /api/admin/leads/delete — posts
// a `[RESTORED-LEAD: <id>]` marker comm to MC. The admin GET route
// reads the most-recent delete/restore for each lead and treats a
// restore as un-trashing if it's newer than the delete.
//
// Skywalker 2026-05-17: "save my quotes for 24hr".

function checkAuth(req: NextRequest): boolean {
  const headerToken = req.headers.get("x-admin-token");
  const queryToken = req.nextUrl.searchParams.get("token");
  return headerToken === ADMIN_TOKEN || queryToken === ADMIN_TOKEN;
}

export async function POST(req: NextRequest) {
  if (!checkAuth(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  let leadId = "";
  try {
    const body = await req.json();
    leadId = String(body?.leadId || "").trim();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!leadId) {
    return NextResponse.json({ error: "leadId required" }, { status: 400 });
  }
  // Only accept MC-generated leadId shape — keeps the [RESTORED-LEAD: ...]
  // marker free of injected `[STATUS:] [LEAD:]` payloads.
  if (!/^[\w-]{1,64}$/.test(leadId)) {
    return NextResponse.json({ error: "Invalid leadId" }, { status: 400 });
  }
  if (!MC_KEY) {
    return NextResponse.json(
      { error: "MC API key not configured on Vercel — set MC_API_KEY (server) or NEXT_PUBLIC_MC_API_KEY (public)." },
      { status: 503 },
    );
  }

  const markerBody = `[RESTORED-LEAD: ${leadId}]`;
  try {
    const r = await fetch(`${MC_API}/api/comms`, {
      method: "POST",
      headers: { "x-api-key": MC_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "topcash-web",
        fromName: "Top Cash Cellular (admin)",
        role: "system",
        body: markerBody,
        tags: ["lead-restored"],
        priority: "low",
      }),
    });
    if (!r.ok) {
      const body = await r.text().catch(() => "");
      return NextResponse.json(
        { error: `MC returned ${r.status}${body ? ` — ${body.slice(0, 200)}` : ""}` },
        { status: 502 },
      );
    }
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "MC error" }, { status: 502 });
  }
  return NextResponse.json({ ok: true, leadId });
}
