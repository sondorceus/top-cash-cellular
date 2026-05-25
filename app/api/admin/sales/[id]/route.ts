import { NextRequest, NextResponse } from "next/server";

// Tombstone a sale. Same pattern as the lead-delete route: a
// `[DELETED-SALE: <id>]` message on MC comms causes the GET endpoint
// to hide the corresponding [SALE: <id>] rows. The original messages
// stay in MC for audit; the ledger view just stops showing them.

const MC_API = "https://missioncontrolsdjg-production.up.railway.app";
const MC_KEY = process.env.MC_API_KEY || "";
const ADMIN_TOKEN = process.env.TCC_ADMIN_TOKEN || (() => { throw new Error("TCC_ADMIN_TOKEN env required"); })();

function checkAuth(req: NextRequest): boolean {
  const headerToken = req.headers.get("x-admin-token");
  const queryToken = req.nextUrl.searchParams.get("token");
  return headerToken === ADMIN_TOKEN || queryToken === ADMIN_TOKEN;
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!checkAuth(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await ctx.params;
  if (!id || !/^[\w-]{4,64}$/.test(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }
  try {
    const r = await fetch(`${MC_API}/api/comms`, {
      method: "POST",
      headers: { "x-api-key": MC_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "tcc-admin",
        fromName: "TCC Admin",
        role: "system",
        body: `[DELETED-SALE: ${id}]`,
        priority: "normal",
      }),
    });
    if (!r.ok) return NextResponse.json({ error: `MC HTTP ${r.status}` }, { status: 502 });
    return NextResponse.json({ ok: true, id });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "MC unavailable" }, { status: 502 });
  }
}
