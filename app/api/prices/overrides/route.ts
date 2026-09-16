// PUBLIC, read-only view of the owner's live price overrides for the
// homepage funnel. The funnel used to read them from GET /api/admin/prices,
// but that route has been admin-gated since 2026-06-19 (it also returns the
// margin model), so every anonymous visitor got a 401 and was quoted the
// bundled PRICE_TABLE while /api/lead, /api/confirm and /go priced from the
// blob — lowered cells were paid at the old price or clamped as "tamper".
//
// Returns ONLY the four override maps the funnel's quote math reads — no
// margins, history, baselines or Atlas/eBay/IWM references. Every value here
// is already visible to customers as a quote. Lives outside /api/admin/ so
// proxy.ts leaves it alone. Short CDN cache so homepage traffic doesn't pay
// a Blob list() per page load.
import { NextResponse } from "next/server";
import { cachedOverrides } from "../../../lib/overrides-cache";

export const dynamic = "force-dynamic";

export async function GET() {
  const o = await cachedOverrides();
  return NextResponse.json(
    {
      priceTable: o.priceTable,
      carrierDeductions: o.carrierDeductions,
      baseOverrides: o.baseOverrides,
      conditionAdj: o.conditionAdj,
    },
    { headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60" } },
  );
}
