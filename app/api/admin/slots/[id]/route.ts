import { NextRequest, NextResponse } from "next/server";
import { safeEqual } from "../../../../lib/admin-auth";

// ADMIN slot removal. Same auth + proxy pattern as ../route.ts.
// 2026-05-24.

const MC_API = "https://missioncontrolsdjg-production.up.railway.app";
const MC_KEY = process.env.MC_API_KEY || "";
const ADMIN_TOKEN = process.env.TCC_ADMIN_TOKEN;

function checkAuth(req: NextRequest): boolean {
  const headerToken = req.headers.get("x-admin-token");
  const queryToken = req.nextUrl.searchParams.get("token");
  return safeEqual(headerToken, ADMIN_TOKEN) || safeEqual(queryToken, ADMIN_TOKEN);
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!checkAuth(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!MC_KEY) {
    return NextResponse.json(
      { error: "MC API key not configured on server." },
      { status: 503 },
    );
  }
  const { id } = await ctx.params;
  if (!/^[\w-]{1,64}$/.test(id)) {
    return NextResponse.json({ error: "Invalid slot id" }, { status: 400 });
  }
  try {
    const r = await fetch(`${MC_API}/api/slots/${id}`, {
      method: "DELETE",
      headers: { "x-api-key": MC_KEY },
      cache: "no-store",
    });
    if (!r.ok && r.status !== 404) {
      return NextResponse.json({ error: `MC returned ${r.status}` }, { status: 502 });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "MC unreachable" }, { status: 502 });
  }
}
