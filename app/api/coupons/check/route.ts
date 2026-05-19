import { NextRequest, NextResponse } from "next/server";

const MC_API = "https://missioncontrolsdjg-production.up.railway.app";
const MC_KEY = process.env.MC_API_KEY || "";

// Read-only coupon check — used by the funnel to validate a code
// BEFORE submission so the customer sees their bonus applied (or
// gets a clear error). Doesn't redeem; redemption happens in
// /api/lead at submit. Skywalker 2026-05-18 review-reward feature.

export async function GET(req: NextRequest) {
  const code = (req.nextUrl.searchParams.get("code") || "").trim().toUpperCase();
  const email = (req.nextUrl.searchParams.get("email") || "").trim().toLowerCase();
  const phone = (req.nextUrl.searchParams.get("phone") || "").replace(/\D/g, "");
  if (!code) return NextResponse.json({ valid: false, error: "Code required" }, { status: 400 });
  // Bound code length — coupons are TCC-XXXX format (~8 chars). A
  // megabyte string from a script doesn't get to traverse MC.
  if (code.length > 64) return NextResponse.json({ valid: false, error: "Code not found or already used" }, { status: 404 });

  try {
    // MC's GET /api/coupons supports filtering — just pull this one.
    const r = await fetch(`${MC_API}/api/coupons?status=active`, {
      headers: { "x-api-key": MC_KEY },
      cache: "no-store",
    });
    if (!r.ok) return NextResponse.json({ valid: false, error: "Couldn't verify code right now" }, { status: 502 });
    const data = await r.json();
    const c = (data.coupons || []).find((x: { code?: string }) => (x.code || "").toUpperCase() === code);
    if (!c) return NextResponse.json({ valid: false, error: "Code not found or already used" }, { status: 404 });
    if (c.status !== "active") return NextResponse.json({ valid: false, error: `Code is ${c.status}` }, { status: 409 });
    if (c.expiresAt && new Date(c.expiresAt).getTime() < Date.now()) {
      return NextResponse.json({ valid: false, error: "Code has expired" }, { status: 410 });
    }
    // Identity check — only the original recipient can redeem. Either
    // email OR phone must match what the code was issued to.
    const emailMatch = c.email && email && c.email === email;
    const phoneMatch = c.phone && phone && c.phone === phone;
    if (email || phone) {
      if (!emailMatch && !phoneMatch) {
        return NextResponse.json(
          { valid: false, error: "This code belongs to a different customer. Use the email or phone it was issued to." },
          { status: 403 },
        );
      }
    }
    return NextResponse.json({
      valid: true,
      code: c.code,
      value: c.value,
      expiresAt: c.expiresAt,
      // If we can confirm identity match now, surface it; otherwise
      // the client should re-check after the customer fills email/phone.
      identityMatched: !!(emailMatch || phoneMatch),
    });
  } catch (e) {
    // Server-side log only — don't echo error.message to public
    // callers (can include internal hostnames, DNS state, etc.).
    console.warn("[coupons/check] verify failed:", e instanceof Error ? e.message : e);
    return NextResponse.json({ valid: false, error: "Verification failed" }, { status: 502 });
  }
}
