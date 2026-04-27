import { NextRequest, NextResponse } from "next/server";
import { put, list } from "@vercel/blob";

const MC_API = "https://missioncontrolsdjg-production.up.railway.app";
const MC_KEY = process.env.MC_API_KEY || "";

export type Review = {
  id: string;
  name: string;
  rating: number;
  title?: string;
  body: string;
  device?: string;
  city?: string;
  createdAt: string;
};

const recentSubmits = new Map<string, number>();
const DEDUP_WINDOW_MS = 60 * 1000;

function isDuplicate(name: string, body: string): boolean {
  const key = `${(name || "").toLowerCase()}|${(body || "").slice(0, 50).toLowerCase()}`;
  const now = Date.now();
  const last = recentSubmits.get(key);
  if (last && now - last < DEDUP_WINDOW_MS) return true;
  recentSubmits.set(key, now);
  if (recentSubmits.size > 50) {
    for (const [k, t] of recentSubmits) {
      if (now - t > DEDUP_WINDOW_MS * 5) recentSubmits.delete(k);
    }
  }
  return false;
}

export async function GET() {
  try {
    const { blobs } = await list({ prefix: "reviews/" });
    const reviews = await Promise.all(
      blobs.map(async (b) => {
        try {
          const r = await fetch(b.url, { cache: "no-store" });
          return (await r.json()) as Review;
        } catch {
          return null;
        }
      })
    );
    const sorted = reviews
      .filter((r): r is Review => !!r)
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    return NextResponse.json({ reviews: sorted });
  } catch (e) {
    return NextResponse.json({ reviews: [], error: String(e) }, { status: 200 });
  }
}

export async function POST(req: NextRequest) {
  const data = await req.json();
  const name = String(data.name || "").trim().slice(0, 60);
  const rating = Math.max(1, Math.min(5, Number(data.rating) || 0));
  const title = String(data.title || "").trim().slice(0, 100) || undefined;
  const body = String(data.body || "").trim().slice(0, 1000);
  const device = String(data.device || "").trim().slice(0, 80) || undefined;
  const city = String(data.city || "").trim().slice(0, 60) || undefined;

  if (!name || !rating || !body) {
    return NextResponse.json({ error: "Name, rating, and review text are required." }, { status: 400 });
  }
  if (body.length < 10) {
    return NextResponse.json({ error: "Please share a bit more about your experience (at least 10 characters)." }, { status: 400 });
  }

  if (isDuplicate(name, body)) {
    return NextResponse.json({ ok: true, deduped: true });
  }

  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const review: Review = {
    id,
    name,
    rating,
    title,
    body,
    device,
    city,
    createdAt: new Date().toISOString(),
  };

  await put(`reviews/${id}.json`, JSON.stringify(review), {
    access: "public",
    contentType: "application/json",
    addRandomSuffix: false,
  });

  try {
    const stars = "*".repeat(rating) + "-".repeat(5 - rating);
    const isLowRating = rating <= 3;
    await fetch(`${MC_API}/api/comms`, {
      method: "POST",
      headers: { "x-api-key": MC_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "topcash-web",
        fromName: "Top Cash Cellular",
        role: "system",
        body: [
          `[NEW CUSTOMER REVIEW]${isLowRating ? " ⚠️ LOW RATING" : ""}`,
          `Name: ${name}${city ? ` (${city})` : ""}`,
          `Rating: ${stars} (${rating}/5)`,
          title ? `Title: ${title}` : null,
          device ? `Device sold: ${device}` : null,
          ``,
          body,
        ].filter(Boolean).join("\n"),
        tags: isLowRating ? ["review", "low-rating"] : ["review"],
        priority: isLowRating ? "urgent" : "normal",
      }),
    });
  } catch {}

  return NextResponse.json({ ok: true, id });
}
