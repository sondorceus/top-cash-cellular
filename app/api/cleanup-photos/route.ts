import { NextRequest, NextResponse } from "next/server";
import { list, del } from "@vercel/blob";

// Skywalker 2026-05-17 — photos auto-delete 24h after upload so we
// don't accumulate storage costs and lingering damage shots stay
// off the CDN longer than necessary. Called by Vercel Cron daily
// (see vercel.json), protected by CRON_SECRET so only the platform
// can trigger it (Vercel auto-sends `Authorization: Bearer <secret>`
// on cron-fired requests).
//
// Conservative: 24h is the staff-review SLA — leads we haven't acted
// on by then get re-shot if needed.

export const runtime = "nodejs";

const PHOTO_TTL_MS = 24 * 60 * 60 * 1000;

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization") || "";
  const secret = process.env.CRON_SECRET;
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const cutoff = Date.now() - PHOTO_TTL_MS;
  let deleted = 0;
  let scanned = 0;
  let cursor: string | undefined = undefined;

  try {
    while (true) {
      const page: Awaited<ReturnType<typeof list>> = await list({ cursor, limit: 1000, prefix: "devices/" });
      const toDelete: string[] = [];
      for (const b of page.blobs) {
        scanned++;
        const uploadedAt = new Date(b.uploadedAt).getTime();
        if (uploadedAt < cutoff) toDelete.push(b.url);
      }
      if (toDelete.length > 0) {
        await del(toDelete);
        deleted += toDelete.length;
      }
      if (!page.cursor) break;
      cursor = page.cursor;
    }
    return NextResponse.json({ ok: true, deleted, scanned, ttlHours: 24 });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message, deleted, scanned }, { status: 500 });
  }
}
