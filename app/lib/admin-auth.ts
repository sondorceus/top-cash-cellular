// Constant-time admin-token comparison. A plain `===` on a secret can leak,
// via response timing, how many leading characters of the provided token
// matched — letting an attacker recover the token byte-by-byte. crypto's
// timingSafeEqual compares in time independent of where the first mismatch is.
// (Admin routes also sit behind the proxy.ts session/allowlist gate; this is
// defense-in-depth for the legacy x-admin-token / ?token path.)
import crypto from "crypto";

export function safeEqual(a: string | null | undefined, b: string | null | undefined): boolean {
  if (typeof a !== "string" || typeof b !== "string" || a.length === 0 || b.length === 0) return false;
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  // Length check is unavoidable (and not secret-leaking on its own); only equal-
  // length buffers can go through timingSafeEqual without throwing.
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}
