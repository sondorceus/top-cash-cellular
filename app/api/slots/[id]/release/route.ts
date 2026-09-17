import { NextRequest, NextResponse } from "next/server";
import { clientIp, rateLimit, rateLimitResponse } from "../../../../lib/rate-limit";
import { verifySlotRelease } from "../../release-token";

// PUBLIC un-book — gives a meetup window back when the browser that booked
// it never saved its lead (a failed /api/lead, then a different window,
// shipping instead, or the tab closed). U12/U17: the funnel books the slot
// BEFORE the lead POST and MC had no un-book, so every failed save stranded
// a capacity-1 window for good.
//   - only the release token /api/slots/[id]/book minted for THIS slot +
//     booking works, so nobody can free someone else's booking
//   - body is read as text: navigator.sendBeacon posts text/plain
//   - MC 404 (booking already gone, or an MC that predates /unbook) is
//     "nothing to release", not an error — the booking just stays
// 2026-09-16.

const MC_API = "https://missioncontrolsdjg-production.up.railway.app";
const MC_KEY = process.env.MC_API_KEY || "";
const ID_RE = /^[\w-]{1,64}$/;

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  // A browser releases at most what it booked (6 per 10 min); a little slack
  // for a beacon that repeats an in-page release.
  const ip = clientIp(req);
  const rl = rateLimit(`slot-release:${ip}`, 10, 10 * 60_000);
  if (!rl.ok) return rateLimitResponse(rl.retryAfterMs, "Too many requests — please wait a moment.");

  if (!MC_KEY) {
    return NextResponse.json(
      { ok: false, error: "MC API key not configured on server." },
      { status: 503 },
    );
  }

  const { id: rawId } = await ctx.params;
  if (!ID_RE.test(rawId)) {
    return NextResponse.json({ ok: false, error: "Invalid slot id" }, { status: 400 });
  }

  let body: { bookingId?: unknown; token?: unknown };
  try {
    const raw = await req.text();
    if (raw.length > 2000) throw new Error("too large");
    body = JSON.parse(raw);
    if (!body || typeof body !== "object") throw new Error("not an object");
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }
  const bookingId = typeof body.bookingId === "string" ? body.bookingId : "";
  if (!ID_RE.test(bookingId)) {
    return NextResponse.json({ ok: false, error: "Invalid booking id" }, { status: 400 });
  }
  if (!verifySlotRelease(rawId, bookingId, body.token)) {
    return NextResponse.json({ ok: false, error: "Invalid or expired release token" }, { status: 403 });
  }

  try {
    const r = await fetch(`${MC_API}/api/slots/${rawId}/unbook`, {
      method: "POST",
      headers: { "x-api-key": MC_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ bookingId }),
      cache: "no-store",
    });
    if (r.status === 404) return NextResponse.json({ ok: true, released: false });
    if (!r.ok) {
      return NextResponse.json({ ok: false, error: `MC returned ${r.status}` }, { status: 502 });
    }
    const data = await r.json().catch(() => null);
    return NextResponse.json({ ok: true, released: data?.released === true });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "MC unreachable" },
      { status: 502 },
    );
  }
}
