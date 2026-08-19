// /go — the paid-ads landing page. One job: a cold Meta/Google click on a
// phone sees a real number in the server HTML (zero taps, zero JS, zero
// model call), then either taps their device into the deterministic chip
// flow (the HOLD) or types into the chat.
//
// Deliberately NOT the homepage: no nav, no sections, no funnel import.
// The board + chips run without the AI; the model only wakes when someone
// types a sentence. Ads keep spending even if the chat is down.
import type { Metadata } from "next";
import { computeBoard } from "./board";
import GoClient, { type GoReviews } from "./go-client";

const MC_API = "https://missioncontrolsdjg-production.up.railway.app";

// Best-effort verified-review pull for the trust section. The reviews API
// is a live proxy to Mission Control, so it must never sit hard on the
// critical path of a paid click: 1.5s timeout, 5-minute module-scope memo,
// and the page renders fine with zero reviews if it fails.
let reviewSnap: { v: GoReviews; at: number } | null = null;
async function fetchReviews(): Promise<GoReviews> {
  if (reviewSnap && Date.now() - reviewSnap.at < 5 * 60_000) return reviewSnap.v;
  const empty: GoReviews = { avg: 0, count: 0, top: [] };
  const key = process.env.MC_API_KEY || "";
  if (!key) return empty;
  try {
    const r = await fetch(`${MC_API}/api/reviews?limit=100`, {
      headers: { "x-api-key": key },
      cache: "no-store",
      signal: AbortSignal.timeout(1500),
    });
    const d = await r.json();
    const all = (d.reviews || []) as { name?: string; rating?: number; body?: string; device?: string; city?: string; verified?: boolean }[];
    const verified = all.filter((x) => x.verified && (x.rating || 0) >= 4 && (x.body || "").trim().length >= 25);
    // Deterministic pick: prefer reviews that name a device (reads more
    // real), then longer text, capped for the card.
    verified.sort((x, y) => Number(!!y.device) - Number(!!x.device) || (y.body || "").length - (x.body || "").length);
    const top = verified.slice(0, 3).map((x) => ({
      name: (x.name || "verified seller").slice(0, 40),
      body: (x.body || "").slice(0, 160),
      device: (x.device || "").slice(0, 40),
      city: (x.city || "").slice(0, 30),
    }));
    const v: GoReviews = { avg: Math.round((d.avg || 0) * 10) / 10, count: d.count || 0, top };
    reviewSnap = { v, at: Date.now() };
    return v;
  } catch {
    return empty;
  }
}

// The board must re-price when the table changes, and this page is tiny —
// render it fresh per request.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Get Paid for Your Phone Today | Top Cash Cellular",
  description:
    "See what we're paying for iPhones and Galaxys right now. Real numbers up front — same-day cash in the Austin area, or a free prepaid shipping label from anywhere.",
  // Ad landing page — keep it out of the index so it never competes with
  // the SEO pages and can be reworded per-campaign without SEO fallout.
  robots: { index: false, follow: false },
};

export default async function GoPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const sp = await searchParams;
  const rawSrc = typeof sp.src === "string" ? sp.src : typeof sp.utm_source === "string" ? sp.utm_source : "";
  const src = rawSrc.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 8);
  // ?v=lot — the bulk/liquidation-seller variant. Same page, same engine;
  // the headline, chips, and composer speak to someone with a LOT of
  // phones who needs cash, and a jump pill sits above the board. Ads for
  // that audience use /go?v=lot&src=…; message match without a second page.
  const variant = sp.v === "lot" ? "lot" : "std";
  const [rows, reviews] = await Promise.all([computeBoard(), fetchReviews()]);
  return <GoClient rows={rows} src={src} reviews={reviews} variant={variant} />;
}
