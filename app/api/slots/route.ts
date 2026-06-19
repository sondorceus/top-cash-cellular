import { NextRequest, NextResponse } from "next/server";

// PUBLIC slot listing — surfaces open local-Austin handoff times for the
// customer booking UI. Proxies to MC server-side with the non-public
// MC_API_KEY so the MC key never ships in the client bundle (the prior
// app/lib/slots-store path was reading NEXT_PUBLIC_MC_API_KEY directly
// in the browser, exposing the MC API surface to anyone with DevTools).
// 2026-05-24.

const MC_API = "https://missioncontrolsdjg-production.up.railway.app";
const MC_KEY = process.env.MC_API_KEY || "";

export async function GET(req: NextRequest) {
  if (!MC_KEY) {
    return NextResponse.json(
      { error: "MC API key not configured on server — set MC_API_KEY in Vercel env." },
      { status: 503 },
    );
  }
  const params = new URLSearchParams();
  const open = req.nextUrl.searchParams.get("open");
  const from = req.nextUrl.searchParams.get("from");
  if (open === "true") params.set("open", "true");
  if (from && /^\d{4}-\d{2}-\d{2}$/.test(from)) params.set("from", from);
  try {
    const r = await fetch(`${MC_API}/api/slots?${params}`, {
      headers: { "x-api-key": MC_KEY },
      // Slots can fill up in real-time as customers book — never cache.
      cache: "no-store",
    });
    if (!r.ok) {
      return NextResponse.json({ slots: [], mcStatus: r.status }, { status: 200 });
    }
    const data = await r.json();
    // Project each slot down to the fields the public booking UI needs —
    // NEVER pass MC's raw slot through, which may carry a bookings[] array of
    // other customers' name/phone/email/device (a PII + physical-safety leak
    // on a public, unauthenticated endpoint). `booked` is just the count.
    const slots = (Array.isArray(data.slots) ? data.slots : []).map((s: Record<string, unknown>) => ({
      id: s.id,
      date: s.date,
      time: s.time,
      allDay: s.allDay === true,
      label: s.label,
      capacity: s.capacity,
      booked: typeof s.booked === "number"
        ? s.booked
        : (Array.isArray(s.bookings) ? s.bookings.length : 0),
    }));
    return NextResponse.json({ slots });
  } catch (e) {
    return NextResponse.json(
      { slots: [], error: e instanceof Error ? e.message : "MC unreachable" },
      { status: 200 },
    );
  }
}
