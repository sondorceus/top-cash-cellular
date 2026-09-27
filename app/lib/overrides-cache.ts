// Per-instance memo of the live price overrides. Every reader of
// readPriceOverrides() pays a sequential Blob list() + no-store fetch —
// fine for a bot turn, but /go pays it on every paid ad click and again on
// every chip tap. 60 s is the memo; the doc itself is versioned per save
// (app/lib/quote.ts), so a read never sees a CDN-stale copy.
//
// LAST-GOOD SEMANTICS (2026-09-26): a failed read used to come back as EMPTY
// and be memoised for 60 s — the homepage feed then quoted the code table
// while /api/lead capped from the blob, and honest customers were clamped as
// "tamper". Now a failed read never replaces a good snapshot, is retried
// after 5 s, and overridesStatus() says whether what is served is fresh,
// last-good, or nothing at all. Every quoting path and every server cap
// reads through here, so they lag a save by the same ≤60 s.
import { readPriceOverrides } from "./quote";
import { EMPTY_OVERRIDES, type PriceOverrides } from "./quote-engine";

type Snap = { v: PriceOverrides; at: number };
let good: Snap | null = null; // the last SUCCESSFUL read on this instance
let lastFailAt = 0; // 0 = the last attempt succeeded
let inflight: Promise<PriceOverrides | null> | null = null;
const FAIL_RETRY_MS = 5_000;

export type OverridesStatus = {
  updatedAt: string | null;
  // true unless the value served came from a read that succeeded (fresh).
  stale: boolean;
  // "fresh" = last attempt succeeded; "last-good" = serving an older good
  // snapshot after a failed read; "none" = nothing has ever been read here
  // (the value is EMPTY and must not be cached or trusted as "no overrides").
  source: "fresh" | "last-good" | "none";
};

/**
 * The live overrides for quoting. Empty maps mean EITHER "no overrides saved"
 * (a successful read) OR "nothing readable yet on this instance" — check
 * overridesStatus().source === "none" to tell the two apart. Concurrent
 * callers share one Blob read.
 */
export async function cachedOverrides(ttlMs = 60_000): Promise<PriceOverrides> {
  const now = Date.now();
  if (good && now - good.at < ttlMs) return good.v;
  if (lastFailAt && now - lastFailAt < FAIL_RETRY_MS) return good?.v ?? EMPTY_OVERRIDES;
  inflight ??= readPriceOverrides().finally(() => { inflight = null; });
  const v = await inflight;
  if (v) {
    good = { v, at: Date.now() };
    lastFailAt = 0;
    return v;
  }
  lastFailAt = Date.now();
  return good?.v ?? EMPTY_OVERRIDES;
}

/** What the last cachedOverrides() call on this instance actually served. */
export function overridesStatus(): OverridesStatus {
  if (!good) return { updatedAt: null, stale: true, source: "none" };
  const failedSince = lastFailAt > good.at;
  return { updatedAt: good.v.updatedAt ?? null, stale: failedSince, source: failedSince ? "last-good" : "fresh" };
}
