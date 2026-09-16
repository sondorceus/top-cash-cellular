import { NextRequest, NextResponse } from "next/server";
import { rateLimit, rateLimitResponse, clientIp } from "../../../lib/rate-limit";
import { reviewTokenShapeError, verifyReviewToken } from "../../../lib/review-token";

// Validate a one-use review token for the /reviews/new page. Returns the
// bound lead's name + device + leadId on success, 401 on miss/expired/used.
// The rules live in app/lib/review-token.ts (POST /api/reviews calls them
// directly, so this limiter only ever sees real browsers).
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  const shape = reviewTokenShapeError(token);
  if (shape || !token) {
    return NextResponse.json({ valid: false, error: shape || "Missing token" }, { status: 401 });
  }
  // A valid-shaped token costs a paged archive read — an unauthenticated GET
  // must not be able to loop it.
  const rl = rateLimit(`review-verify:${clientIp(req)}`, 30, 60_000);
  if (!rl.ok) return rateLimitResponse(rl.retryAfterMs);

  const v = await verifyReviewToken(token);
  if (!v.valid) {
    return NextResponse.json({ valid: false, error: v.error }, { status: v.status });
  }
  return NextResponse.json(v);
}
