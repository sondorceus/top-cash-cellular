// HMAC-signed counter-offer tokens. Same shape as session tokens
// (app/lib/auth.ts) but bearing a counter-offer payload instead of a
// session. Used so the customer-facing /counter/[token] page can verify
// the offer hasn't been tampered with without a database round-trip.
//
// Token expires 14 days from mint. If a customer doesn't respond by
// then, staff has to remint or move on. 14d is long enough to cover a
// vacation but short enough to bound stale state.

import crypto from "crypto";

const SECRET = process.env.TCC_TOKEN_SECRET || process.env.TCC_SESSION_SECRET || process.env.TCC_ADMIN_TOKEN || "topcash-counter-fallback";
const TTL_MS = 14 * 24 * 60 * 60 * 1000;

export type CounterPayload = {
  leadId: string;
  // Original quote and the new offer, both whole-dollar integers.
  originalQuote: number;
  offer: number;
  // Free-text rationale the staff entered, shown verbatim to customer.
  reason: string;
  // Issued-at + expiry, ms epoch.
  iat: number;
  exp: number;
};

function base64url(buf: Buffer): string {
  return buf.toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function base64urlDecode(s: string): Buffer {
  const pad = s.length % 4 ? 4 - (s.length % 4) : 0;
  return Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat(pad), "base64");
}

export function signCounterToken(input: Omit<CounterPayload, "iat" | "exp">): string {
  const now = Date.now();
  const full: CounterPayload = {
    ...input,
    iat: now,
    exp: now + TTL_MS,
  };
  const body = base64url(Buffer.from(JSON.stringify(full)));
  const sig = base64url(crypto.createHmac("sha256", SECRET).update(body).digest());
  return `${body}.${sig}`;
}

export function verifyCounterToken(token: string | undefined | null): CounterPayload | null {
  if (!token || !token.includes(".")) return null;
  const [body, sig] = token.split(".");
  const expected = base64url(crypto.createHmac("sha256", SECRET).update(body).digest());
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(base64urlDecode(body).toString("utf8")) as CounterPayload;
    if (typeof payload.exp !== "number" || payload.exp < Date.now()) return null;
    if (!payload.leadId || typeof payload.offer !== "number") return null;
    return payload;
  } catch {
    return null;
  }
}
