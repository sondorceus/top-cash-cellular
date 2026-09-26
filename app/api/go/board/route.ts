// The tap-to-price board + review proof for the SITE-WIDE chat (the /go page
// computes these server-side per request; every other page loads them lazily
// through here when the chat button is first used). One 60s in-memory
// snapshot per lambda — the board is ~100 engine cells.
import { NextRequest, NextResponse } from "next/server";
import { clientGeo } from "../../../lib/geo";
import { computeBoard, type BoardRow } from "../../../go/board";
import { fetchReviews } from "../../../go/reviews";
import type { GoReviews } from "../../../go/go-client";

export const dynamic = "force-dynamic";
type Snap = { rows: BoardRow[]; reviews: GoReviews; at: number };
let snap: Snap | null = null;
// Requests that arrive while the snapshot is being rebuilt share the one
// rebuild instead of each pricing ~100 cells and calling MC themselves.
let inflight: Promise<Snap> | null = null;

export async function GET(req: NextRequest) {
  if (!snap || Date.now() - snap.at > 60_000) {
    inflight ??= Promise.all([computeBoard(), fetchReviews()])
      .then(([rows, reviews]) => (snap = { rows, reviews, at: Date.now() }))
      .finally(() => { inflight = null; });
    await inflight;
  }
  if (!snap) return NextResponse.json({ rows: [], reviews: { avg: 0, count: 0, top: [] }, area: clientGeo(req).area }, { status: 503 });
  // area: the visitor's Vercel geo, so the site-wide widget's handoff chips
  // match the /go page's (label first outside Austin, no meetup outside TX —
  // review 2026-09-23). Per visitor, hence private (the browser still keeps
  // its own copy for a minute; the 60s snapshot above covers the server).
  return NextResponse.json(
    { rows: snap.rows, reviews: snap.reviews, area: clientGeo(req).area },
    { headers: { "Cache-Control": "private, max-age=60" } },
  );
}
