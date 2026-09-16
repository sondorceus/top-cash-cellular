import { NextRequest, NextResponse } from "next/server";
import { lookupImei } from "../../../lib/imei-lookup";
import { clientIp, rateLimit, rateLimitResponse } from "../../../lib/rate-limit";
import { getSessionFromRequest, isAdminEmail } from "../../../lib/auth";

// "Couldn't run" is never "clean". Before this, a Sickw failure (e.g.
// "Error B01: Low Balance!") came back as ok:true with no warnings and the
// funnel showed "✓ Verified" — a Find My-locked or blacklisted phone looked
// checked. The warning makes every client (old bundles included) show a
// heads-up, and the funnel carries it to the lead as an IMEI warning.
const UNCHECKED_WARNING = "IMEI lock/blacklist check couldn't run — we'll verify it at handoff.";
// Sickw services that carry the lock / blacklist answer (lib/imei-lookup:
// 61 = Apple FMI + blacklist, 54 = blacklist for everything else). A failed
// info-only call (92 / 1 / 42) still leaves the lock check done.
const INFO_ONLY_SERVICES = new Set(["92", "1", "42"]);

// Sickw IMEI/serial check.
// Free TAC validation runs first (Luhn + length); if that passes, we hit
// Sickw's paid lookup for blacklist + iCloud-lock signals.
// Sickw lookups go through lib/imei-lookup (cheap per-brand services, ~$0.14/iPhone;
// service 0 was $1.80 a check and drained the balance — 2026-09-12).
// Service 0 = "Apple Basic Info" (cheapest, ~$0.05). Other services give
// more detail at higher cost. We use 0 because it returns enough for
// our blacklist+iCloud-lock signal.

const SICKW_KEY = process.env.SICKW_API_KEY || "";

// In-process cache keyed on `imei|category`. Sickw bills per lookup
// (~$0.05) and this endpoint is unauthenticated, so a script firing
// the same Luhn-valid IMEI N times costs N × $0.05. The funnel's UX
// also re-checks when the customer scrubs back and re-confirms, which
// adds incidental dup cost. Cache results for 1h. Bounded to 500
// entries — at ~200 bytes each that's ~100KB, fine for a serverless
// instance; oldest entries get evicted FIFO when the cap is hit.
type CachedResult = { body: Record<string, unknown>; at: number };
const TTL_MS = 60 * 60 * 1000;
const MAX_ENTRIES = 500;
const sickwCache = new Map<string, CachedResult>();

function cacheGet(key: string): Record<string, unknown> | null {
  const hit = sickwCache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > TTL_MS) {
    sickwCache.delete(key);
    return null;
  }
  return hit.body;
}

function cacheSet(key: string, body: Record<string, unknown>): void {
  if (sickwCache.size >= MAX_ENTRIES) {
    const oldest = sickwCache.keys().next().value;
    if (oldest) sickwCache.delete(oldest);
  }
  sickwCache.set(key, { body, at: Date.now() });
}

function luhnValid(num: string): boolean {
  const digits = num.replace(/\D/g, "");
  if (digits.length !== 15) return false;
  let sum = 0;
  for (let i = 0; i < 15; i++) {
    let d = parseInt(digits[i], 10);
    if (i % 2 === 1) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
  }
  return sum % 10 === 0;
}

export async function POST(req: NextRequest) {
  // Rate limit: 10 IMEI lookups per IP per minute. Sickw charges ~$0.05
  // per lookup and this route is unauthenticated; without the limit a
  // script could burn $100s per minute. The 1-hour in-process cache
  // below absorbs same-IMEI re-hits; this limit covers distinct-IMEI
  // floods. 2026-05-24.
  const ip = clientIp(req);
  const rl = rateLimit(`imei:${ip}`, 10, 60_000);
  if (!rl.ok) return rateLimitResponse(rl.retryAfterMs, "Too many IMEI lookups — slow down.");

  let payload: { imei?: unknown; deviceCategory?: unknown };
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }
  const imei = typeof payload.imei === "string" ? payload.imei : "";
  const deviceCategory = typeof payload.deviceCategory === "string" ? payload.deviceCategory : "";
  if (!imei) {
    return NextResponse.json({ ok: false, error: "IMEI required" }, { status: 400 });
  }
  const clean = imei.replace(/\D/g, "");

  // Stage 1: free format check (Luhn + 15-digit). Catches typos.
  if (clean.length !== 15) {
    return NextResponse.json({
      ok: false,
      stage: "format",
      error: "IMEI must be 15 digits. Tap *#06# on the device to display it.",
    });
  }
  if (!luhnValid(clean)) {
    return NextResponse.json({
      ok: false,
      stage: "format",
      error: "That doesn't look like a valid IMEI — please double-check.",
    });
  }

  // Sickw's own error text (billing state included) is for staff only: the
  // admin device-correction panel shows it; anonymous callers never see it.
  const staff = (() => {
    try { return isAdminEmail(getSessionFromRequest(req)?.email); } catch { return false; }
  })();
  // stage "format-only" = only the Luhn check ran (no key, or the lookup
  // failed). Same shape the funnel keys on; never cached.
  const unchecked = (why: string) => {
    console.error(`[imei/check] ${clean} lookup did not run: ${why}`);
    return NextResponse.json({ ok: true, stage: "format-only", imei: clean, warnings: [UNCHECKED_WARNING], ...(staff ? { sickwError: why } : {}) });
  };

  // Stage 2: Sickw lookup (paid).
  if (!SICKW_KEY) return unchecked("no SICKW_API_KEY");

  // Same (imei, category) within the last hour returns the cached
  // result without paying Sickw again.
  const cacheKey = `${clean}|${deviceCategory.toLowerCase()}`;
  const cached = cacheGet(cacheKey);
  if (cached) {
    return NextResponse.json({ ...cached, cached: true });
  }

  try {
    const lk = await lookupImei(clean);
    // lk.ok only says the brand call named a model; the sub-calls may still
    // have answered (and a missing model with a lock answer is still a
    // check). Nothing at all came back = the check didn't run.
    if (!lk.ok && !lk.model && !lk.fmiRaw && !lk.blacklistRaw) {
      return unchecked(lk.error || "lookup failed");
    }
    // PARTIAL: a sub-call failed (lookupImei lists them as "61:error …;
    // 92:threw …"). Unless every failure is an info-only service, the lock /
    // blacklist answer is missing — its false flags mean "unknown", not
    // "clean". Anything unparseable counts as missing.
    const failedServices = lk.error ? lk.error.split(";").map((f) => f.trim().split(":")[0]) : [];
    const partial = !!lk.error;
    const lockUnchecked = partial && !(failedServices.length > 0 && failedServices.every((s) => INFO_ONLY_SERVICES.has(s)));
    const model = lk.model || null;
    const fmiOn = lk.fmiOn;
    const blacklisted = lk.blacklisted;
    const warnings: string[] = [];
    if (fmiOn) warnings.push("Find My / iCloud lock is ON — must be turned off before payout.");
    if (blacklisted) warnings.push("Device is blacklisted — typically reported lost or stolen.");
    if (lockUnchecked) {
      console.error(`[imei/check] ${clean} partial lookup: ${lk.error}`);
      warnings.push(UNCHECKED_WARNING);
    }

    // Light cross-check vs the device category the customer picked.
    if (deviceCategory && model) {
      const lc = model.toLowerCase();
      const cat = String(deviceCategory).toLowerCase();
      if (cat === "samsung" && !/samsung|galaxy/.test(lc)) warnings.push(`IMEI returns "${model}" but you selected Samsung.`);
      if (cat === "iphone" && !/iphone/.test(lc)) warnings.push(`IMEI returns "${model}" but you selected iPhone.`);
    }

    const result = {
      ok: warnings.length === 0,
      // "partial" = the lock/blacklist answer is missing (always with the
      // warning above, so no client reads it as verified).
      stage: lockUnchecked ? ("partial" as const) : ("full" as const),
      imei: clean,
      model,
      fmiOn,
      blacklisted,
      warnings,
    };
    // A result with any failed sub-call is never cached: a transient Sickw
    // failure must be retried, not pinned as this IMEI's answer for an hour.
    if (partial) {
      return NextResponse.json({ ...result, ...(staff ? { sickwError: lk.error } : {}) });
    }
    // Cache successful Sickw responses only — transient failures
    // should be re-tried (not pinned to a stale "format-only" hit).
    // Also dropped the `raw` field: it leaked Sickw's response text
    // (warranty info, activation date, original carrier) to the
    // unauthenticated client, which both wastes Skywalker's per-
    // lookup spend and exposes Sickw's response surface to anyone
    // probing the endpoint. The UI uses model/fmiOn/blacklisted/
    // warnings, not raw.
    cacheSet(cacheKey, result);
    return NextResponse.json(result);
  } catch (e) {
    return unchecked(e instanceof Error ? e.message : "unknown");
  }
}
