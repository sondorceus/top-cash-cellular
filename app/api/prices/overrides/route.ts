// PUBLIC, read-only view of the owner's live price overrides for the
// homepage funnel. The funnel used to read them from GET /api/admin/prices,
// but that route has been admin-gated since 2026-06-19 (it also returns the
// margin model), so every anonymous visitor got a 401 and was quoted the
// bundled PRICE_TABLE while /api/lead, /api/confirm and /go priced from the
// blob — lowered cells were paid at the old price or clamped as "tamper".
//
// Returns ONLY the four override maps the funnel's quote math reads — no
// margins, history, baselines or Atlas/eBay/IWM references — plus, since
// 2026-09-26, the doc's updatedAt (the funnel stamps its lead with it so
// /api/lead can tell a stale quote from a tampered one) and `upTo`, the
// engine's live "up to $X" per model (the homepage cards take the lower of
// their static catalog headline and this, so a lowered override can't leave a
// card promising more than the funnel pays). Every value here is already
// visible to customers as a quote; updatedBy never leaves the server. Lives
// outside /api/admin/ so proxy.ts leaves it alone. Short CDN cache so
// homepage traffic doesn't pay a Blob list() per page load.
//
// 503 + no-store when this instance has NEITHER a fresh read nor a last-good
// snapshot: an empty 200 there used to be cached and read as "no overrides".
import { NextResponse } from "next/server";
import { cachedOverrides, overridesStatus } from "../../../lib/overrides-cache";
import { engineCeiling, engineModelIds } from "../../../lib/advertised-up-to";
import type { PriceOverrides } from "../../../lib/quote-engine";

export const dynamic = "force-dynamic";

// "Up to" per model with the live overrides — the same engineCeiling() the
// /go board runs. Memoised per overrides snapshot (cachedOverrides hands back
// the same object until a re-read succeeds), so it costs one pass per minute.
let upToMemo: { for: PriceOverrides; v: Record<string, number> } | null = null;
function liveUpTo(o: PriceOverrides): Record<string, number> {
  if (upToMemo && upToMemo.for === o) return upToMemo.v;
  const v: Record<string, number> = {};
  for (const id of engineModelIds()) {
    const c = engineCeiling(id, { overrides: o });
    if (c && c.upTo > 0) v[id] = c.upTo;
  }
  upToMemo = { for: o, v };
  return v;
}

export async function GET() {
  const o = await cachedOverrides();
  if (overridesStatus().source === "none") {
    return NextResponse.json(
      { error: "price overrides unavailable" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
  return NextResponse.json(
    {
      priceTable: o.priceTable,
      carrierDeductions: o.carrierDeductions,
      baseOverrides: o.baseOverrides,
      conditionAdj: o.conditionAdj,
      updatedAt: o.updatedAt ?? null,
      upTo: liveUpTo(o),
    },
    { headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60" } },
  );
}
