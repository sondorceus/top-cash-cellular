// Per-instance memo of the live price overrides. Every reader of
// readPriceOverrides() pays a sequential Blob list() + no-store fetch —
// fine for a bot turn, but /go pays it on every paid ad click and again on
// every chip tap. Same-path blob overwrites are CDN-stale for ~60s anyway
// (see the Vercel-blob staleness note in the admin prices route), so a 60s
// memo adds ZERO staleness beyond what the platform already imposes.
import { readPriceOverrides, type PriceOverrides } from "./quote";

let snap: { v: PriceOverrides; at: number } | null = null;

export async function cachedOverrides(ttlMs = 60_000): Promise<PriceOverrides> {
  if (snap && Date.now() - snap.at < ttlMs) return snap.v;
  const v = await readPriceOverrides();
  snap = { v, at: Date.now() };
  return v;
}
