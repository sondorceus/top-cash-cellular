// The tap-to-price board + review proof for the SITE-WIDE chat (the /go page
// computes these server-side per request; every other page loads them lazily
// through here when the chat button is first used). One 60s in-memory
// snapshot per lambda — the board is ~100 engine cells.
import { NextResponse } from "next/server";
import { computeBoard, type BoardRow } from "../../../go/board";
import { fetchReviews } from "../../../go/reviews";
import type { GoReviews } from "../../../go/go-client";

export const dynamic = "force-dynamic";
let snap: { rows: BoardRow[]; reviews: GoReviews; at: number } | null = null;

export async function GET() {
  if (!snap || Date.now() - snap.at > 60_000) {
    const [rows, reviews] = await Promise.all([computeBoard(), fetchReviews()]);
    snap = { rows, reviews, at: Date.now() };
  }
  return NextResponse.json({ rows: snap.rows, reviews: snap.reviews }, { headers: { "Cache-Control": "public, max-age=60" } });
}
