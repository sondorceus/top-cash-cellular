import { NextRequest, NextResponse } from "next/server";

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

export async function GET() {
  try {
    const r = await fetch(`${MC_API}/api/reviews?limit=200`, {
      headers: { "x-api-key": MC_KEY },
      cache: "no-store",
    });
    const data = await r.json();
    return NextResponse.json({ reviews: data.reviews || [], count: data.count || 0, avg: data.avg || 0 });
  } catch (e) {
    return NextResponse.json({ reviews: [], count: 0, avg: 0, error: String(e) }, { status: 200 });
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  try {
    const r = await fetch(`${MC_API}/api/reviews`, {
      method: "POST",
      headers: { "x-api-key": MC_KEY, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await r.json();
    if (!r.ok) return NextResponse.json({ error: data.error || "Submission failed." }, { status: r.status });
    return NextResponse.json({ ok: true, id: data.review?.id });
  } catch (e) {
    return NextResponse.json({ error: "Network error. Please try again." }, { status: 502 });
  }
}
