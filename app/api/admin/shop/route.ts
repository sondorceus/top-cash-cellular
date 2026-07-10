import { NextRequest, NextResponse } from "next/server";
import { safeEqual } from "../../../lib/admin-auth";
import {
  readListingsDoc,
  writeListingsDoc,
  newListingId,
  type ShopListing,
  type ListingStatus,
} from "../../../lib/shop-listings";
import { listingGradeFor, LISTING_GRADES, type ListingGrade } from "../../../lib/shop-grades";

// Admin CRUD for shop listings. GET returns the FULL records including
// costCents — that is exactly why GET is gated like every other admin GET
// (the prices route learned this the hard way; see its :231 comment).
//
// Marking a listing sold auto-writes a [SALE: …] message to Mission Control
// in the exact line format app/api/admin/sales parses, so the sale lands in
// the profit page with cost pre-filled from the listing. The hand-typed
// sales ledger stops being a chore the day the shop makes its first sale.

const ADMIN_TOKEN = process.env.TCC_ADMIN_TOKEN;
const MC_API = "https://missioncontrolsdjg-production.up.railway.app";
const MC_KEY = process.env.MC_API_KEY || "";

function checkAuth(req: NextRequest): boolean {
  const headerToken = req.headers.get("x-admin-token");
  const queryToken = req.nextUrl.searchParams.get("token");
  return safeEqual(headerToken, ADMIN_TOKEN) || safeEqual(queryToken, ADMIN_TOKEN);
}

function clean(v: unknown, maxLen = 200): string {
  return String(v ?? "").replace(/[\[\]]/g, "").replace(/[\r\n]+/g, " ").trim().slice(0, maxLen);
}

function cents(v: unknown): number | null {
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n);
}

export async function GET(req: NextRequest) {
  if (!checkAuth(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const doc = await readListingsDoc();
  doc.listings.sort((a, b) => (a.postedAt < b.postedAt ? 1 : -1));
  return NextResponse.json(doc);
}

export async function POST(req: NextRequest) {
  if (!checkAuth(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  let p: Record<string, unknown>;
  try {
    p = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const modelLabel = clean(p.modelLabel, 80);
  const category = clean(p.category, 40) || "Other";
  const familySku = clean(p.familySku, 30) || "ip"; // phone shipping math by default
  const grade = clean(p.grade, 20) as ListingGrade;
  const priceCents = cents(p.priceCents);
  const costCents = cents(p.costCents);

  if (!modelLabel) return NextResponse.json({ error: "modelLabel required" }, { status: 400 });
  if (!LISTING_GRADES.includes(grade)) {
    return NextResponse.json({ error: `grade must be one of ${LISTING_GRADES.join(", ")}` }, { status: 400 });
  }
  // Same refusal the grade contract makes at intake: a broken device never
  // becomes a listing, even via the admin API.
  if (listingGradeFor(grade) === null) {
    return NextResponse.json({ error: "Not a sellable grade" }, { status: 400 });
  }
  if (priceCents == null || priceCents < 100) {
    return NextResponse.json({ error: "priceCents required (min 100 = $1)" }, { status: 400 });
  }

  const batteryPct = (() => {
    const n = Number(p.batteryPct);
    return Number.isFinite(n) && n >= 1 && n <= 100 ? Math.round(n) : undefined;
  })();

  const photos = Array.isArray(p.photos)
    ? (p.photos as unknown[])
        .map((u) => String(u))
        .filter((u) => u.startsWith("https://") && u.length < 500)
        .slice(0, 8)
    : [];

  const now = new Date().toISOString();
  const listing: ShopListing = {
    id: newListingId(),
    modelLabel,
    category,
    familySku,
    storage: clean(p.storage, 20) || undefined,
    color: clean(p.color, 40) || undefined,
    carrier: clean(p.carrier, 30) || "Unlocked",
    grade,
    batteryPct,
    priceCents,
    costCents: costCents ?? undefined,
    photos,
    stockImage: clean(p.stockImage, 200) || undefined,
    notes: clean(p.notes, 400) || undefined,
    status: "listed",
    postedAt: now,
    updatedAt: now,
  };

  const doc = await readListingsDoc();
  doc.listings.push(listing);
  await writeListingsDoc(doc.listings);

  // Audit line in MC so the team feed shows what went up for sale. No cost
  // on this one — comms are broader-visibility than the admin API.
  try {
    await fetch(`${MC_API}/api/comms`, {
      method: "POST",
      headers: { "x-api-key": MC_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "topcash-web",
        fromName: "Top Cash Cellular",
        role: "system",
        body: `[SHOP-POST: ${listing.id}] Listed: ${[modelLabel, listing.storage, listing.color, listing.carrier].filter(Boolean).join(" · ")} — ${grade} — $${(priceCents / 100).toFixed(2)}`,
        tags: ["shop", "posted"],
        priority: "low",
      }),
    });
  } catch {}

  return NextResponse.json({ ok: true, listing });
}

export async function PATCH(req: NextRequest) {
  if (!checkAuth(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  let p: Record<string, unknown>;
  try {
    p = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const id = clean(p.id, 40);
  const doc = await readListingsDoc();
  const listing = doc.listings.find((l) => l.id === id);
  if (!listing) return NextResponse.json({ error: "Listing not found" }, { status: 404 });

  // Field edits — only the safe-to-change set. Model identity fields are
  // fixed at post time; repost if the device was entered wrong.
  const priceCents = p.priceCents !== undefined ? cents(p.priceCents) : undefined;
  if (priceCents !== undefined) {
    if (priceCents == null || priceCents < 100) return NextResponse.json({ error: "Bad priceCents" }, { status: 400 });
    listing.priceCents = priceCents;
  }
  const costCents = p.costCents !== undefined ? cents(p.costCents) : undefined;
  if (costCents !== undefined && costCents != null) listing.costCents = costCents;
  if (p.notes !== undefined) listing.notes = clean(p.notes, 400) || undefined;
  if (p.batteryPct !== undefined) {
    const n = Number(p.batteryPct);
    listing.batteryPct = Number.isFinite(n) && n >= 1 && n <= 100 ? Math.round(n) : undefined;
  }
  if (Array.isArray(p.photos)) {
    listing.photos = (p.photos as unknown[])
      .map((u) => String(u))
      .filter((u) => u.startsWith("https://") && u.length < 500)
      .slice(0, 8);
  }

  let saleLogged = false;
  const nextStatus = p.status !== undefined ? (clean(p.status, 20) as ListingStatus) : undefined;
  if (nextStatus !== undefined) {
    const allowed: ListingStatus[] = ["listed", "on_hold", "sold", "removed"];
    if (!allowed.includes(nextStatus)) return NextResponse.json({ error: "Bad status" }, { status: 400 });

    if (nextStatus === "sold" && listing.status !== "sold") {
      listing.soldAt = new Date().toISOString();
      // Sold price may differ from list (negotiation happens at pickup).
      const soldCents = p.soldPriceCents !== undefined ? cents(p.soldPriceCents) : null;
      const soldPrice = (soldCents ?? listing.priceCents) / 100;
      const cost = (listing.costCents ?? 0) / 100;

      // Ledger write — [SALE: …] in the exact format admin/sales parses.
      // Platform "TCC Shop" separates direct sales from eBay in profit
      // reporting. Fees 0, shipping 0: v1 is cash/Zelle at pickup.
      try {
        const saleId = `sale-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
        const r = await fetch(`${MC_API}/api/comms`, {
          method: "POST",
          headers: { "x-api-key": MC_KEY, "Content-Type": "application/json" },
          body: JSON.stringify({
            from: "tcc-admin",
            fromName: "Top Cash Cellular",
            role: "system",
            body: [
              `[SALE: ${saleId}]`,
              `Device: ${[listing.modelLabel, listing.storage, listing.color].filter(Boolean).join(" ")}`,
              `Platform: TCC Shop`,
              `Sold-Price: ${soldPrice}`,
              `Cost: ${cost}`,
              `Fees: 0`,
              `Shipping: 0`,
              `Sale-Date: ${new Date().toISOString().slice(0, 10)}`,
              `Note: shop listing ${listing.id}`,
            ].join("\n"),
            tags: ["sale"],
            priority: "low",
          }),
        });
        // r.ok alone lies: an unauthenticated MC POST 302s to /login, fetch
        // follows it, and the login page's 200 reads as success. Only a
        // message id proves the ledger write landed — caught live in testing.
        const d = r.ok ? await r.json().catch(() => ({})) : {};
        saleLogged = !!d?.message?.id;
      } catch {}
    }
    if (nextStatus === "listed") {
      // Relisting a fallen-through hold or an un-sold correction.
      listing.soldAt = undefined;
    }
    listing.status = nextStatus;
  }

  listing.updatedAt = new Date().toISOString();
  await writeListingsDoc(doc.listings);
  return NextResponse.json({ ok: true, listing, saleLogged });
}
