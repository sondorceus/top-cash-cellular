import { NextRequest, NextResponse } from "next/server";
import { clientIp, rateLimit, rateLimitResponse } from "../../../../lib/rate-limit";
import { signSlotRelease } from "../../release-token";

// PUBLIC slot booking — customer reserves a local-Austin handoff time.
// Proxies to MC with the server-side MC_API_KEY, plus enforces:
//   - per-IP rate limit (cheap protection vs scripted slot-flooding)
//   - id pattern lock (no marker-injection into MC URLs)
//   - body field length caps (no oversized writes to MC comms)
//   - input sanitization (strip `[` and `]` from customer-controlled
//     strings — same defense in /api/lead, since MC comms parse marker
//     brackets globally)
// 2026-05-24.
// The reply carries a release token for this booking so the same browser
// can give the window back if its lead never saves (see ../release).

const MC_API = "https://missioncontrolsdjg-production.up.railway.app";
const MC_KEY = process.env.MC_API_KEY || "";

function cleanField(v: unknown, max: number): string {
  if (v === null || v === undefined) return "";
  return String(v).replace(/[\[\]]/g, "").slice(0, max).trim();
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  // 6 bookings per IP per 10 min — covers a customer who picks a slot,
  // changes their mind, picks another; rejects scripted slot-grabbing.
  const ip = clientIp(req);
  const rl = rateLimit(`slot-book:${ip}`, 6, 10 * 60_000);
  if (!rl.ok) return rateLimitResponse(rl.retryAfterMs, "Too many booking attempts — please wait a moment.");

  if (!MC_KEY) {
    return NextResponse.json(
      { ok: false, error: "MC API key not configured on server." },
      { status: 503 },
    );
  }

  const { id: rawId } = await ctx.params;
  // MC slot ids are short opaque tokens — restrict to safe chars so the
  // value can't smuggle a `/`, `?`, or marker characters into the URL.
  if (!/^[\w-]{1,64}$/.test(rawId)) {
    return NextResponse.json({ ok: false, error: "Invalid slot id" }, { status: 400 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const sellerName = cleanField(body.sellerName, 120);
  if (!sellerName) {
    return NextResponse.json({ ok: false, error: "sellerName required" }, { status: 400 });
  }
  const payload = {
    sellerName,
    sellerPhone: cleanField(body.sellerPhone, 30) || undefined,
    sellerEmail: cleanField(body.sellerEmail, 200) || undefined,
    deviceLabel: cleanField(body.deviceLabel, 120) || undefined,
    // No caller-supplied leadRef: MC's /book now answers a repeated leadRef
    // with the booking it already holds, so a public leadRef would let a
    // stranger fetch someone else's booking (and a release token for it).
    // The funnel never sent one.
  };

  try {
    const r = await fetch(`${MC_API}/api/slots/${rawId}/book`, {
      method: "POST",
      headers: { "x-api-key": MC_KEY, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      cache: "no-store",
    });
    if (r.status === 409) {
      return NextResponse.json({ ok: false, error: "already booked" }, { status: 409 });
    }
    if (!r.ok) {
      return NextResponse.json({ ok: false, error: `MC returned ${r.status}` }, { status: 502 });
    }
    const data = await r.json();
    const bookingId: unknown = data?.booking?.id;
    // Echo only what this caller sent, plus the id/time. Token only for a
    // booking MC just made for this request (never an `existing` one).
    let releaseToken: string | undefined;
    if (typeof bookingId === "string" && data?.existing !== true) {
      try { releaseToken = signSlotRelease(rawId, bookingId); } catch {}
    }
    return NextResponse.json({
      ok: true,
      booking: { ...payload, id: bookingId, bookedAt: data?.booking?.bookedAt, releaseToken },
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "MC unreachable" },
      { status: 502 },
    );
  }
}
