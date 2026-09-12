// Verified-review snapshot for the /go proof row and the site-wide chat —
// moved out of app/go/page.tsx so /api/go/board can serve it too.
import type { GoReviews } from "./go-client";

const MC_API = "https://missioncontrolsdjg-production.up.railway.app";

// Best-effort verified-review pull for the trust section. The reviews API
// is a live proxy to Mission Control, so it must never sit hard on the
// critical path of a paid click: 1.5s timeout, 5-minute module-scope memo,
// and the page renders fine with zero reviews if it fails.
let reviewSnap: { v: GoReviews; at: number } | null = null;
export async function fetchReviews(): Promise<GoReviews> {
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
