import { NextRequest, NextResponse } from "next/server";

// Server-side proxy for Google Places API (New) Autocomplete.
//
// Why: we built our own dropdown UI for the shipping address field
// instead of using Google's <gmp-place-autocomplete> Web Component.
// The web component triggers a fullscreen takeover on mobile focus
// that Skywalker hated. By going through this proxy we get the same
// suggestion data, render our own inline dropdown, and keep the
// Google API key off the client.
//
// The same NEXT_PUBLIC_GOOGLE_MAPS_API_KEY works server-to-server
// without sending a Referer (verified 2026-05-18) since its only
// restrictions are HTTP referrer + API allowlist, and Google's
// referrer check is permissive when no Referer header is present
// from a server-context call.

const GOOGLE_API_KEY = process.env.GOOGLE_MAPS_SERVER_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "";

export async function POST(req: NextRequest) {
  let body: { input?: string; sessionToken?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad JSON" }, { status: 400 });
  }
  const input = (body.input || "").trim();
  if (input.length < 2) return NextResponse.json({ suggestions: [] });
  if (!GOOGLE_API_KEY) return NextResponse.json({ error: "Server missing GOOGLE key" }, { status: 500 });

  const payload: Record<string, unknown> = {
    input,
    includedRegionCodes: ["us"],
    languageCode: "en",
  };
  if (body.sessionToken) payload.sessionToken = body.sessionToken;

  try {
    const r = await fetch("https://places.googleapis.com/v1/places:autocomplete", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": GOOGLE_API_KEY,
        "X-Goog-FieldMask": "suggestions.placePrediction.placeId,suggestions.placePrediction.text",
      },
      body: JSON.stringify(payload),
    });
    if (!r.ok) {
      const errText = await r.text().catch(() => "");
      return NextResponse.json({ suggestions: [], error: `Google ${r.status}`, detail: errText.slice(0, 300) }, { status: 200 });
    }
    type GoogleSuggestion = { placePrediction?: { placeId?: string; text?: { text?: string } } };
    const data: { suggestions?: GoogleSuggestion[] } = await r.json();
    const suggestions = (data.suggestions || [])
      .map((s) => ({
        placeId: s.placePrediction?.placeId || "",
        text: s.placePrediction?.text?.text || "",
      }))
      .filter((s) => s.placeId && s.text);
    return NextResponse.json({ suggestions });
  } catch (e) {
    return NextResponse.json({ suggestions: [], error: (e as Error).message }, { status: 200 });
  }
}
