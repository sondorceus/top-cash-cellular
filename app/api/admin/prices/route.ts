import { NextRequest, NextResponse } from "next/server";
import { PRICE_TABLE, CARRIER_DEDUCTIONS } from "../../../data/prices";
import { put, list } from "@vercel/blob";

// Price-editor backend. Stores admin overrides as a single JSON document
// on Vercel Blob (we already use Blob for FedEx labels, so no new infra).
//
//   GET  /api/admin/prices         → public; returns { baseline, overrides }
//                                    so the admin UI can render the full grid
//                                    AND so the customer funnel can fetch
//                                    overrides on mount and merge at lookup.
//   POST /api/admin/prices         → auth required; takes { priceTable,
//                                    carrierDeductions } (sparse overrides
//                                    only) and persists them to Blob.
//
// Auth is the same token used by /api/admin/leads (TCC_ADMIN_TOKEN env, or
// fallback "topcash-admin-2026"). Pass via ?token= or x-admin-token header.

const ADMIN_TOKEN = process.env.TCC_ADMIN_TOKEN || "topcash-admin-2026";
const BLOB_KEY = "prices/overrides.json";

function checkAuth(req: NextRequest): boolean {
  const headerToken = req.headers.get("x-admin-token");
  const queryToken = req.nextUrl.searchParams.get("token");
  return headerToken === ADMIN_TOKEN || queryToken === ADMIN_TOKEN;
}

type OverridesShape = {
  priceTable: Record<string, Record<string, Record<string, number>>>;
  carrierDeductions: Record<string, Record<string, number>>;
  updatedAt?: string;
};

async function readOverrides(): Promise<OverridesShape> {
  const empty: OverridesShape = { priceTable: {}, carrierDeductions: {} };
  try {
    const { blobs } = await list({ prefix: BLOB_KEY, limit: 5 });
    const found = blobs.find((b) => b.pathname === BLOB_KEY);
    if (!found) return empty;
    const r = await fetch(found.url, { cache: "no-store" });
    if (!r.ok) return empty;
    const d = await r.json();
    return {
      priceTable: d.priceTable || {},
      carrierDeductions: d.carrierDeductions || {},
      updatedAt: d.updatedAt,
    };
  } catch {
    return empty;
  }
}

// Sparse deep-merge: prefer overlay value, fall back to base. Only used for
// the admin GET response so the editor can show the effective (post-merge)
// table without re-deriving it on the client.
function deepMerge<T>(base: T, overlay: Partial<T>): T {
  if (typeof base !== "object" || base === null) return (overlay as T) ?? base;
  if (typeof overlay !== "object" || overlay === null) return base;
  const out: Record<string, unknown> = { ...(base as Record<string, unknown>) };
  for (const k of Object.keys(overlay)) {
    const ov = (overlay as Record<string, unknown>)[k];
    const bv = (base as Record<string, unknown>)[k];
    if (ov && typeof ov === "object" && !Array.isArray(ov)) {
      out[k] = deepMerge(bv ?? {}, ov as Partial<unknown>);
    } else {
      out[k] = ov;
    }
  }
  return out as T;
}

export async function GET() {
  const overrides = await readOverrides();
  return NextResponse.json({
    baseline: {
      priceTable: PRICE_TABLE,
      carrierDeductions: CARRIER_DEDUCTIONS,
    },
    overrides,
    effective: {
      priceTable: deepMerge(PRICE_TABLE, overrides.priceTable),
      carrierDeductions: deepMerge(CARRIER_DEDUCTIONS, overrides.carrierDeductions),
    },
  });
}

export async function POST(req: NextRequest) {
  if (!checkAuth(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  let body: { priceTable?: OverridesShape["priceTable"]; carrierDeductions?: OverridesShape["carrierDeductions"] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad JSON" }, { status: 400 });
  }

  // Read current overrides + merge in the partial update
  const current = await readOverrides();
  const merged: OverridesShape = {
    priceTable: deepMerge(current.priceTable, body.priceTable || {}),
    carrierDeductions: deepMerge(current.carrierDeductions, body.carrierDeductions || {}),
    updatedAt: new Date().toISOString(),
  };

  // Write back to Blob (overwrite, no random suffix so we have a stable URL)
  await put(BLOB_KEY, JSON.stringify(merged, null, 2), {
    access: "public",
    contentType: "application/json",
    addRandomSuffix: false,
    allowOverwrite: true,
  });

  const overrideModels = Object.keys(merged.priceTable).length;
  const carrierOverrides = Object.keys(merged.carrierDeductions).length;
  return NextResponse.json({
    ok: true,
    overrideModels,
    carrierOverrides,
    updatedAt: merged.updatedAt,
  });
}
