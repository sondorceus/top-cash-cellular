import { NextRequest, NextResponse } from "next/server";
import { cashtagFormatValid, normalizeCashtag } from "../../../lib/payout-verify";

// Best-effort Cash App $cashtag existence check.
//
// This is a SCRAPE of cash.app's public profile pages — there's no
// documented Cash App API. Empirically (probed 2026-05-22) the public
// page at https://cash.app/$<tag>:
//   * Real / public profile (e.g. $sarah, $test, $mike) → HTTP 200
//     and an <title>Pay $<Tag> on Cash App</title>.
//   * Unknown / restricted / private handle (e.g. $zzqxnonexistent999,
//     and curiously also $jack, $cashapp, $john) → HTTP 404 and
//     <title>Cash App - Page Not Found</title>.
// Detection keys on BOTH the 404 status AND the literal "Page Not Found"
// title so a future page-shape change doesn't accidentally start
// returning "found" for everything.
//
// CRITICAL: false "not_found" results would block real customers, so any
// error / timeout / unexpected response falls through to status:
// "unknown" — the funnel treats "unknown" the same as "not_found" (amber
// warn, no block). The only hard block for Cash App is bad FORMAT.

// In-process cache for verified handles. Each scrape costs us a Cloudflare
// round-trip + ~500ms, and the funnel debounce-fires on every keystroke
// after the format check passes; this de-dupes within a session.
type CachedResult = { status: "found" | "not_found" | "unknown"; at: number };
const TTL_MS = 5 * 60 * 1000; // 5 minutes — handles don't blink in/out
const MAX_ENTRIES = 200;
const cache = new Map<string, CachedResult>();

function cacheGet(key: string): CachedResult["status"] | null {
  const hit = cache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > TTL_MS) {
    cache.delete(key);
    return null;
  }
  return hit.status;
}

function cacheSet(key: string, status: CachedResult["status"]): void {
  // Never cache "unknown" — transient failures should be re-tried, not
  // pinned to a stale negative.
  if (status === "unknown") return;
  if (cache.size >= MAX_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest) cache.delete(oldest);
  }
  cache.set(key, { status, at: Date.now() });
}

// Short timeout — cash.app normally responds in <1s. A 5s ceiling keeps
// the funnel snappy when Cloudflare is being slow; we'd rather show
// "unknown" than freeze the keystroke loop.
const SCRAPE_TIMEOUT_MS = 5000;

export async function GET(req: NextRequest) {
  const rawTag = req.nextUrl.searchParams.get("tag") || "";
  // normalizeCashtag trims + ensures the leading $ so a customer who
  // pasted "sarah" still gets validated correctly. The format check
  // then guards against junk.
  const tag = normalizeCashtag(rawTag);

  if (!tag) {
    return NextResponse.json({ status: "invalid", reason: "tag required" }, { status: 400 });
  }
  if (!cashtagFormatValid(tag)) {
    return NextResponse.json({
      status: "invalid",
      reason: "A Cash App handle looks like $yourname — letters/numbers only.",
    });
  }

  // Cache key is the canonical lowercase form; cash.app treats cashtags
  // case-insensitively on the URL.
  const cacheKey = tag.toLowerCase();
  const cached = cacheGet(cacheKey);
  if (cached) {
    return NextResponse.json({ status: cached, cached: true });
  }

  // Wrap absolutely everything below in try/catch so a thrown exception
  // can never bubble up as a false "not_found".
  try {
    // AbortController for the timeout — fetch + signal is the standard
    // Web API shape, no Node-only types.
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), SCRAPE_TIMEOUT_MS);
    let resp: Response;
    try {
      // URL-encode the $ as %24 — some intermediaries strip raw $ from
      // the path, and cash.app accepts %24 (verified empirically).
      const url = `https://cash.app/%24${encodeURIComponent(tag.slice(1))}`;
      resp = await fetch(url, {
        method: "GET",
        redirect: "follow",
        signal: controller.signal,
        cache: "no-store",
        headers: {
          // Looks like a real browser — bare server requests get
          // filtered before they reach the profile route.
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.5",
        },
      });
    } finally {
      clearTimeout(timer);
    }

    // Detection logic, derived empirically (see file header).
    // Found:    status 200 + title starts with "Pay $"
    // NotFound: status 404 + title contains "Page Not Found"
    // Anything else (5xx, 403, 200 with weird title, …) → unknown.
    const status = resp.status;

    // Read enough of the body to inspect the title. cash.app's title is
    // in the first ~200 bytes of the HTML, but we read a few KB to be
    // safe against future markup changes. Capped to defend against a
    // huge / streaming response from a misbehaving upstream.
    let body = "";
    try {
      const reader = resp.body?.getReader();
      if (reader) {
        const decoder = new TextDecoder("utf-8");
        let total = 0;
        const MAX = 16 * 1024; // 16KB is plenty for the <head>
        while (total < MAX) {
          const { done, value } = await reader.read();
          if (done) break;
          if (value) {
            body += decoder.decode(value, { stream: true });
            total += value.byteLength;
          }
        }
        try { await reader.cancel(); } catch {}
      } else {
        body = await resp.text();
      }
    } catch {
      // Body read failed mid-stream — treat as unknown, never as a
      // negative.
      return NextResponse.json({ status: "unknown" });
    }

    const titleMatch = body.match(/<title>([^<]+)<\/title>/i);
    const title = titleMatch ? titleMatch[1].trim() : "";

    if (status === 200 && /^Pay \$/i.test(title)) {
      cacheSet(cacheKey, "found");
      return NextResponse.json({ status: "found" });
    }
    if (status === 404 && /page not found/i.test(title)) {
      cacheSet(cacheKey, "not_found");
      return NextResponse.json({ status: "not_found" });
    }
    // Anything else — page-shape changed, Cloudflare interstitial,
    // soft-blocked, etc. Don't guess.
    return NextResponse.json({ status: "unknown" });
  } catch {
    // Timeout, network error, DNS failure, abort, anything — always
    // unknown, never not_found. Never throws.
    return NextResponse.json({ status: "unknown" });
  }
}
