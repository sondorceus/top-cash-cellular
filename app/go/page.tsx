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
import GoClient from "./go-client";

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
  const rows = await computeBoard();
  return <GoClient rows={rows} src={src} />;
}
