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
import { PRICE_TABLE, BASE_PRICED_MODELS, MACBOOK_SPECS } from "../../data/prices";

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

// GET /api/quote?catalog=1 -> the valid SKU slugs the Brain must map a
// listing to. Returned per-path so the LLM knows which devices auto-quote
// (price-table) vs need spec detail (additive) vs are base-priced. Token-gated
// like POST (slugs are low-sensitivity but we keep the surface closed).
export async function GET(req: NextRequest) {
  if (!authed(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (req.nextUrl.searchParams.get("catalog") == null) {
    return NextResponse.json({ error: "GET supports ?catalog=1 only; use POST to quote" }, { status: 400 });
  }
  // Storage keys present per price-table model, so the Brain can pick a valid
  // storage slug ("256","1tb",…) instead of guessing.
  const priceTable: Record<string, string[]> = {};
  for (const [id, storages] of Object.entries(PRICE_TABLE)) {
    priceTable[id] = Object.keys(storages);
  }
  return NextResponse.json({
    // Decoding hints help the LLM map listing text -> our slug.
    hint: "Slugs: ip=iPhone, gs=Galaxy S, gn=Galaxy Note, gz=Galaxy Z, ga=Galaxy A, px=Pixel; suffix p=Pro, pm=Pro Max, u=Ultra, fe=FE. Pick the closest slug + a storage from priceTable[slug] + condition (sealed|mint|good|fair|broken) + carrier (unlocked|att|tmobile|verizon|other).",
    priceTable,                                  // { slug: [storageKeys] } — auto-quotable (phones/tablets)
    additive: Object.keys(MACBOOK_SPECS),        // MacBooks/PCs — need spec detail (manual for now)
    basePriced: Object.keys(BASE_PRICED_MODELS), // VR/drones/Garmin — manual
  });
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
