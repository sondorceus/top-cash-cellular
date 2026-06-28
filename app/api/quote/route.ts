// Internal quote API — the Mission Control lead bot's pricing oracle. Given a
// parsed device spec (or a batch of them), returns TCC's offer using the exact
// same baseline math + live overrides as the customer funnel (see
// app/lib/quote.ts). The Brain parses a Marketplace listing into a spec; this
// endpoint turns the spec into a dollar number. Token-gated — not public.
//
//   POST /api/quote
//   headers: Authorization: Bearer <QUOTE_API_TOKEN | TCC_ADMIN_TOKEN>
//            (or ?token= query param)
//   body:    a single QuoteSpec, or { devices: QuoteSpec[] } for a batch
//
// Single  -> QuoteResult
// Batch   -> { results: QuoteResult[], overridesUpdatedAt }

import { NextRequest, NextResponse } from "next/server";
import { quoteDevice, readPriceOverrides, type QuoteSpec } from "../../lib/quote";

export const dynamic = "force-dynamic";

function authed(req: NextRequest): boolean {
  const expected = process.env.QUOTE_API_TOKEN || process.env.TCC_ADMIN_TOKEN;
  if (!expected) return false; // fail closed if no token configured
  const bearer = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  const qp = req.nextUrl.searchParams.get("token");
  return bearer === expected || qp === expected;
}

function isSpec(x: unknown): x is QuoteSpec {
  return !!x && typeof x === "object" && typeof (x as QuoteSpec).modelId === "string" && typeof (x as QuoteSpec).condition === "string";
}

export async function POST(req: NextRequest) {
  if (!authed(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  // Batch: { devices: [...] } — quote all off ONE override read.
  if (body && typeof body === "object" && Array.isArray((body as { devices?: unknown }).devices)) {
    const specs = (body as { devices: unknown[] }).devices;
    if (specs.length > 200) {
      return NextResponse.json({ error: "max 200 devices per batch" }, { status: 400 });
    }
    const overrides = await readPriceOverrides();
    const results = await Promise.all(
      specs.map((s) =>
        isSpec(s)
          ? quoteDevice(s, overrides)
          : Promise.resolve({ ok: false, offer: null, manualReview: true, reason: "invalid spec (need modelId + condition)", source: "unmatched" as const, modelId: String((s as { modelId?: unknown })?.modelId ?? "") }),
      ),
    );
    return NextResponse.json({ results, overridesUpdatedAt: overrides.updatedAt ?? null });
  }

  // Single device.
  if (!isSpec(body)) {
    return NextResponse.json({ error: "body must be a QuoteSpec (modelId + condition) or { devices: [...] }" }, { status: 400 });
  }
  const result = await quoteDevice(body);
  return NextResponse.json(result);
}
