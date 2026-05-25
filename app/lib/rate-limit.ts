// Lightweight per-IP rate limiter for unauthenticated POST endpoints.
//
// Backing store: in-process Map (sliding window of recent hit timestamps).
// On Vercel serverless, this state lives in a single Lambda instance and
// resets on cold start, so the effective ceiling is "per-instance, per-
// window" — still useful to blunt scripted abuse, but NOT a hard global
// cap. For a hard global cap (and to make the lead-dedup table survive
// cold starts), provision Vercel KV or Upstash Redis and swap the
// internal `getHits`/`recordHit` helpers to read/write there.
//
// Added 2026-05-24 after audit found /api/imei/check (Sickw ~$0.05 per
// lookup), /api/upload (Vercel Blob quota), and /api/lead (in-memory
// dedup resets on cold start, duplicate-payout window) had no throttle
// at all.

import type { NextRequest } from "next/server";

type Bucket = { hits: number[]; createdAt: number };

const buckets = new Map<string, Bucket>();
const MAX_BUCKETS = 5000; // soft cap; evict oldest when exceeded

/**
 * Best-effort client IP. Prefers the leftmost x-forwarded-for entry
 * (which is what Vercel injects upstream), then x-real-ip, then "ip".
 * Falls back to "unknown" — every "unknown" caller shares one bucket,
 * which is intentional: it makes unauthenticated, header-stripped
 * abuse rate-limit itself collectively.
 */
export function clientIp(req: NextRequest): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  const xri = req.headers.get("x-real-ip");
  if (xri) return xri.trim();
  return "unknown";
}

/**
 * Check whether `key` is currently over its allowance. If under, record
 * the hit and return `{ ok: true, remaining }`. If over, return
 * `{ ok: false, retryAfterMs }` without recording the hit.
 *
 * `windowMs` is the sliding window. `max` is the number of allowed hits
 * within that window. Same caller key with different (max, windowMs)
 * configs collide — pick a single canonical config per endpoint.
 */
export function rateLimit(key: string, max: number, windowMs: number): { ok: true; remaining: number } | { ok: false; retryAfterMs: number } {
  const now = Date.now();
  const bucket = buckets.get(key) ?? { hits: [], createdAt: now };
  // Drop timestamps outside the window.
  while (bucket.hits.length && now - bucket.hits[0] > windowMs) bucket.hits.shift();
  if (bucket.hits.length >= max) {
    const retryAfterMs = windowMs - (now - bucket.hits[0]);
    return { ok: false, retryAfterMs: Math.max(0, retryAfterMs) };
  }
  bucket.hits.push(now);
  buckets.set(key, bucket);
  // Periodic eviction so a flood of unique IPs doesn't blow memory.
  if (buckets.size > MAX_BUCKETS) {
    const cutoff = now - windowMs * 4;
    for (const [k, b] of buckets) {
      if (b.hits.length === 0 || b.hits[b.hits.length - 1] < cutoff) buckets.delete(k);
    }
  }
  return { ok: true, remaining: max - bucket.hits.length };
}

/**
 * Compose a 429 response body + headers when rateLimit returns ok:false.
 * Keep this consistent across endpoints so clients can implement
 * exponential backoff on a single Retry-After contract.
 */
export function rateLimitResponse(retryAfterMs: number, message = "Too many requests — try again shortly.") {
  const seconds = Math.max(1, Math.ceil(retryAfterMs / 1000));
  return new Response(JSON.stringify({ ok: false, error: message, retryAfterSeconds: seconds }), {
    status: 429,
    headers: {
      "Content-Type": "application/json",
      "Retry-After": String(seconds),
    },
  });
}
