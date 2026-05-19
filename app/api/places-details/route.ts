import { NextRequest, NextResponse } from "next/server";

// Server-side proxy for Google Places API (New) Place Details. Pairs
// with /api/places-autocomplete. Given a placeId returned from the
// autocomplete proxy, fetch the address components and return a
// flattened { street, city, state, zip, formattedAddress } shape that
// the funnel can drop straight into its split fields.

const GOOGLE_API_KEY = process.env.GOOGLE_MAPS_SERVER_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "";

type AddressComponent = {
  types?: string[];
  longText?: string;
  shortText?: string;
};

export async function POST(req: NextRequest) {
  let body: { placeId?: string; sessionToken?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad JSON" }, { status: 400 });
  }
  const placeId = (body.placeId || "").trim();
  if (!placeId) return NextResponse.json({ error: "placeId required" }, { status: 400 });
  // Bound placeId length. Real Google place IDs are < 100 chars; an
  // unbounded value lets someone push a megabyte string at us, which
  // we'd then URL-encode and forward — that's billed.
  if (placeId.length > 200) return NextResponse.json({ error: "Invalid placeId" }, { status: 400 });
  if (!GOOGLE_API_KEY) return NextResponse.json({ error: "Server missing GOOGLE key" }, { status: 500 });

  const url = new URL(`https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`);
  if (body.sessionToken) url.searchParams.set("sessionToken", body.sessionToken);

  try {
    const r = await fetch(url.toString(), {
      method: "GET",
      headers: {
        "X-Goog-Api-Key": GOOGLE_API_KEY,
        "X-Goog-FieldMask": "addressComponents,formattedAddress",
      },
    });
    if (!r.ok) {
      const errText = await r.text().catch(() => "");
      console.warn(`[places-details] Google ${r.status}:`, errText.slice(0, 300));
      return NextResponse.json({ error: "Address lookup unavailable" }, { status: 200 });
    }
    const data: { addressComponents?: AddressComponent[]; formattedAddress?: string } = await r.json();
    const parts: AddressComponent[] = data.addressComponents || [];
    const get = (type: string, useShort = false): string => {
      const c = parts.find((p) => p.types?.includes(type));
      return c ? (useShort ? c.shortText : c.longText) || "" : "";
    };
    const streetNum = get("street_number");
    const route = get("route");
    const street = [streetNum, route].filter(Boolean).join(" ").trim();
    const city = get("locality") || get("sublocality") || get("postal_town");
    const state = get("administrative_area_level_1", true);
    const zip = get("postal_code");
    return NextResponse.json({
      street,
      city,
      state: state ? state.toUpperCase().slice(0, 2) : "",
      zip,
      formattedAddress: data.formattedAddress || "",
    });
  } catch (e) {
    console.warn(`[places-details] network:`, e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "Address lookup unavailable" }, { status: 200 });
  }
}
