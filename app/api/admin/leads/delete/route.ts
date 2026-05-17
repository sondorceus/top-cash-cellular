import { NextRequest, NextResponse } from "next/server";

const MC_API = "https://missioncontrolsdjg-production.up.railway.app";
const MC_KEY = process.env.MC_API_KEY || "";
const ADMIN_TOKEN = process.env.TCC_ADMIN_TOKEN || "topcash-admin-2026";

// Soft-delete a lead. MC /api/comms doesn't support DELETE, so we post
// a marker message that the admin GET route filters out. The original
// lead stays in MC for audit, but disappears from the admin feed.
//
// Hard-delete (PII scrub) would require MC server changes — flagged as
// follow-up if Skywalker wants full GDPR-style removal.

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
  let reason = "";
  try {
    const body = await req.json();
    leadId = String(body?.leadId || "").trim();
    reason = String(body?.reason || "").trim();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!leadId) {
    return NextResponse.json({ error: "leadId required" }, { status: 400 });
  }

  // Post the soft-delete marker to MC comms.
  const markerBody = `[DELETED-LEAD: ${leadId}]${reason ? ` [REASON: ${reason}]` : ""}`;
  try {
    const r = await fetch(`${MC_API}/api/comms`, {
      method: "POST",
      headers: { "x-api-key": MC_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "topcash-web",
        fromName: "Top Cash Cellular (admin)",
        role: "system",
        body: markerBody,
        tags: ["lead-deleted"],
        priority: "low",
      }),
    });
    if (!r.ok) {
      return NextResponse.json({ error: "MC unavailable", status: r.status }, { status: 502 });
    }
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "MC error" }, { status: 502 });
  }

  return NextResponse.json({ ok: true, leadId });
}
