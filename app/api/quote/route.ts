// Internal quote API — the Mission Control lead bot's pricing oracle. Given a
// parsed device spec (or a batch of them), returns TCC's offer using the exact
// same baseline math + live overrides as the customer funnel (see
// app/lib/quote.ts). The Brain parses a Marketplace listing into a spec; this
// endpoint turns the spec into a dollar number. Token-gated — not public.
//
//   POST /api/quote
//   headers: Authorization: Bearer <QUOTE_API_TOKEN | TCC_ADMIN_TOKEN>
//            (or ?token= query param)
//   body:    a single QuoteSpec, or { devices: QuoteSpec[] } for a batch,
//            or { items: [{ model, storage?, carrier?, condition?,
//                           mdm_locked?, faceid_broken? }] } — devices as a
//            PERSON types them, parsed by the site chat's own quote tool
//            (2026-10-14; the caller is Theot's tcc_price tool in Mission
//            Control, bots/tcc-price.js)
//
// Single  -> QuoteResult
// Batch   -> { results: QuoteResult[], overridesUpdatedAt }
// Items   -> { results: (QuoteToolResult & { input })[] }

import { NextRequest, NextResponse } from "next/server";
import { safeEqual } from "../../lib/admin-auth";
import { quoteDevice, canonicalCondition, canonicalCarrier, normalizeStorage, type QuoteSpec } from "../../lib/quote";
import { runQuote, type QuoteToolInput } from "../../lib/sell-tools";
// Last-good overrides (2026-09-26): a failed Blob read used to quote the whole
// batch off the code table as if no overrides existed.
import { cachedOverrides } from "../../lib/overrides-cache";
import { PRICE_TABLE, BASE_PRICED_MODELS, MACBOOK_SPECS } from "../../data/prices";

export const dynamic = "force-dynamic";

function authed(req: NextRequest): boolean {
  const expected = process.env.QUOTE_API_TOKEN || process.env.TCC_ADMIN_TOKEN;
  if (!expected) return false; // fail closed if no token configured
  const bearer = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  const qp = req.nextUrl.searchParams.get("token");
  // Constant-time, same as every other secret check in this codebase — a plain
  // === leaks how many leading characters matched via response timing.
  return safeEqual(bearer, expected) || safeEqual(qp, expected);
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

  // Free-text batch (2026-10-14): { items: [{ model, storage?, carrier?,
  // condition?, mdm_locked?, faceid_broken? }] } — devices the way a person
  // writes them ("iPhone 16 pro max", "1tb", "cricket"). Parsed by the same
  // code the site chat uses (sell-tools.runQuote: nameToSlug +
  // normalizeStorage + canonicalCarrier), so the number is the one the chat
  // and the funnel would show, and nothing is parsed a second way somewhere
  // else. The condition is canonicalised HERE (canonicalCondition: substring
  // match, "good" when unreadable) because the engine's normalizeCondition is
  // an exact-match list and would carry "like new" through as a cell key.
  if (body && typeof body === "object" && Array.isArray((body as { items?: unknown }).items)) {
    const items = (body as { items: unknown[] }).items;
    if (items.length > 60) {
      return NextResponse.json({ error: "max 60 items per batch" }, { status: 400 });
    }
    const results = await Promise.all(
      items.map(async (raw) => {
        const it = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
        const model = typeof it.model === "string" ? it.model : "";
        const input: QuoteToolInput = {
          model,
          storage: it.storage == null || it.storage === "" ? undefined : String(it.storage),
          condition: canonicalCondition(it.condition),
          carrier: typeof it.carrier === "string" ? it.carrier : undefined,
          mdm_locked: it.mdm_locked === true,
          faceid_broken: it.faceid_broken === true,
        };
        // What the engine actually priced, echoed back so the caller can say
        // "cricket → AT&T" instead of guessing how the text was read.
        const echo = {
          model,
          storage: normalizeStorage(input.storage) ?? null,
          condition: input.condition,
          carrier: canonicalCarrier(input.carrier),
        };
        if (!model.trim()) {
          return { ok: false, reason: "no model given", input: echo };
        }
        // One item the engine trips on must not 500 the batch.
        const r = await runQuote(input).catch(() => ({ ok: false, reason: "quote failed" }));
        return { ...r, input: echo };
      }),
    );
    return NextResponse.json({ results });
  }

  // Batch: { devices: [...] } — quote all off ONE override read.
  if (body && typeof body === "object" && Array.isArray((body as { devices?: unknown }).devices)) {
    const specs = (body as { devices: unknown[] }).devices;
    if (specs.length > 200) {
      return NextResponse.json({ error: "max 200 devices per batch" }, { status: 400 });
    }
    const overrides = await cachedOverrides();
    const results = await Promise.all(
      specs.map((s) =>
        isSpec(s)
          // One malformed spec (e.g. a non-string field the engine trips on)
          // must not 500 the whole batch — that item goes to manual review.
          ? quoteDevice(s, overrides).catch(() => ({ ok: false, offer: null, manualReview: true, reason: "quote failed", source: "unmatched" as const, modelId: s.modelId }))
          : Promise.resolve({ ok: false, offer: null, manualReview: true, reason: "invalid spec (need modelId + condition)", source: "unmatched" as const, modelId: String((s as { modelId?: unknown })?.modelId ?? "") }),
      ),
    );
    return NextResponse.json({ results, overridesUpdatedAt: overrides.updatedAt ?? null });
  }

  // Single device.
  if (!isSpec(body)) {
    return NextResponse.json({ error: "body must be a QuoteSpec (modelId + condition) or { devices: [...] }" }, { status: 400 });
  }
  const result = await quoteDevice(body, await cachedOverrides());
  return NextResponse.json(result);
}
