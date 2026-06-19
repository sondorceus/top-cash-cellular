import { NextRequest, NextResponse } from "next/server";
import { rateLimit, rateLimitResponse, clientIp } from "../../../lib/rate-limit";

const MC_API = "https://missioncontrolsdjg-production.up.railway.app";
const MC_KEY = process.env.MC_API_KEY || "";

// Mask the identity a code is bound to so the customer knows WHICH email
// or phone to use, without exposing the full value to whoever holds the
// code. "sondorceus@gmail.com" → "so•••@gmail.com"; "5125550199" → "•••-•••-0199".
function maskEmail(e?: string): string {
  if (!e || !e.includes("@")) return "";
  const [local, domain] = e.split("@");
  const head = local.slice(0, 2);
  return `${head}•••@${domain}`;
}
function maskPhone(p?: string): string {
  const d = (p || "").replace(/\D/g, "");
  return d.length >= 4 ? `•••-•••-${d.slice(-4)}` : "";
}
function issuedToHint(c: { email?: string; phone?: string }): string {
  return maskEmail(c.email) || maskPhone(c.phone) || "";
}

// Read-only coupon check — used by the funnel to validate a code
// BEFORE submission so the customer sees their bonus applied (or
// gets a clear error). Doesn't redeem; redemption happens in
// /api/lead at submit. Skywalker 2026-05-18 review-reward feature.

export async function GET(req: NextRequest) {
  // Throttle: this validates codes and returns a masked identity hint, so an
  // unthrottled caller could brute-force TCC-XXXX codes and enumerate the
  // masked email/phone bound to each. Rate-limit blunts the guessing.
  const rl = rateLimit(`coupon-check:${clientIp(req)}`, 12, 60_000);
  if (!rl.ok) return rateLimitResponse(rl.retryAfterMs);

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
    const hint = issuedToHint(c);
    if (email || phone) {
      if (!emailMatch && !phoneMatch) {
        return NextResponse.json(
          {
            valid: false,
            error: hint
              ? `This code was issued to ${hint} — use that email or phone to redeem it.`
              : "This code belongs to a different customer. Use the email or phone it was issued to.",
            issuedTo: hint,
          },
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
      // Masked email/phone the code is bound to, so the funnel can tell
      // the customer exactly which contact to enter.
      issuedTo: hint,
    });
  } catch (e) {
    // Server-side log only — don't echo error.message to public
    // callers (can include internal hostnames, DNS state, etc.).
    console.warn("[coupons/check] verify failed:", e instanceof Error ? e.message : e);
    return NextResponse.json({ valid: false, error: "Verification failed" }, { status: 502 });
  }
}
