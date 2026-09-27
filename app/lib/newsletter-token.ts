// HMAC-signed newsletter unsubscribe tokens. Same shape as
// counter-token.ts but bears just the subscriber email + iat. No
// expiry — unsubscribe should always work, even years later, per
// CAN-SPAM. Verification confirms the token wasn't tampered.

import crypto from "crypto";

// No hardcoded fallback — a public default makes unsubscribe tokens forgeable
// (anyone could unsubscribe arbitrary emails). Precedence preserved so live
// tokens stay valid; throws on first use if no secret is set. (bug fix)
//
// Every configured secret in the cascade, first = the one that signs
// (2026-09-27). Verification tries them all: the link in a delivered mail is
// signed with whatever was first at send time, so rotating the admin token
// (or adding TCC_TOKEN_SECRET above it) used to turn every link already in
// an inbox into "tampered or expired". Deduped; empty = fail closed.
function secretCandidates(): string[] {
  const out: string[] = [];
  for (const s of [
    process.env.TCC_TOKEN_SECRET,
    process.env.TCC_SESSION_SECRET,
    process.env.TCC_ADMIN_TOKEN,
    process.env.NEXTAUTH_SECRET,
    process.env.MC_API_KEY,
  ]) {
    if (s && !out.includes(s)) out.push(s);
  }
  return out;
}

function getSecret(): string {
  const [s] = secretCandidates();
  if (!s) throw new Error("newsletter-token signing secret env required (TCC_TOKEN_SECRET / TCC_ADMIN_TOKEN / NEXTAUTH_SECRET / MC_API_KEY)");
  return s;
}

export type NewsletterPayload = {
  email: string;
  iat: number;
  // Scope (2026-09-27). Absent = unsubscribe, the only kind before. A
  // "resubscribe" token is minted for an address that opted out earlier and is
  // accepted by verifyResubscribeToken alone; verifyNewsletterToken refuses it,
  // so neither link can stand in for the other.
  action?: "resubscribe";
  // First name typed on the form, carried so the confirmed SIGNUP marker keeps it.
  name?: string;
};

// A re-subscribe link is good for a week; the unsubscribe link never expires.
export const RESUBSCRIBE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function base64url(buf: Buffer): string {
  return buf
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function base64urlDecode(s: string): Buffer {
  const pad = s.length % 4 ? 4 - (s.length % 4) : 0;
  return Buffer.from(
    s.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat(pad),
    "base64",
  );
}

function sign(payload: NewsletterPayload): string {
  const body = base64url(Buffer.from(JSON.stringify(payload)));
  const sig = base64url(
    crypto.createHmac("sha256", getSecret()).update(body).digest(),
  );
  return `${body}.${sig}`;
}

export function signNewsletterToken(email: string): string {
  return sign({ email: email.toLowerCase().trim(), iat: Date.now() });
}

/** The one-click unsubscribe link for an address — one place builds it (2026-09-27). */
export function newsletterUnsubUrl(email: string): string {
  return `https://topcashcellular.com/api/newsletter/unsubscribe?token=${signNewsletterToken(email)}`;
}

// Re-subscribe confirmation (2026-09-27): a bare signup POST must not undo an
// opt-out — a third party could re-enroll someone who left — so the address
// gets ONE mail with this link and only the click clears the record.
export function signResubscribeToken(email: string, name?: string): string {
  const payload: NewsletterPayload = { email: email.toLowerCase().trim(), iat: Date.now(), action: "resubscribe" };
  const n = (name || "").trim().slice(0, 60);
  if (n) payload.name = n;
  return sign(payload);
}

export function resubscribeUrl(email: string, name?: string): string {
  return `https://topcashcellular.com/api/newsletter/resubscribe?token=${signResubscribeToken(email, name)}`;
}

// Signature + shape only; the scoped verifiers below decide what it may do.
function verifySigned(token: string | undefined | null): NewsletterPayload | null {
  if (!token || !token.includes(".")) return null;
  const [body, sig] = token.split(".");
  const a = Buffer.from(sig);
  // Any configured secret may have signed it (2026-09-27); none configured →
  // nothing verifies. Constant-time per candidate.
  let matched = false;
  for (const secret of secretCandidates()) {
    const expected = base64url(crypto.createHmac("sha256", secret).update(body).digest());
    const b = Buffer.from(expected);
    if (a.length === b.length && crypto.timingSafeEqual(a, b)) { matched = true; break; }
  }
  if (!matched) return null;
  try {
    const payload = JSON.parse(base64urlDecode(body).toString("utf8")) as NewsletterPayload;
    if (typeof payload.email !== "string" || !payload.email) return null;
    return payload;
  } catch {
    return null;
  }
}

/** Unsubscribe links only — a resubscribe token is refused here (2026-09-27). */
export function verifyNewsletterToken(token: string | undefined | null): NewsletterPayload | null {
  const p = verifySigned(token);
  return p && p.action === undefined ? p : null;
}

/** Re-subscribe confirmations only: the right scope and at most 7 days old (2026-09-27). */
export function verifyResubscribeToken(token: string | undefined | null): NewsletterPayload | null {
  const p = verifySigned(token);
  if (!p || p.action !== "resubscribe") return null;
  if (typeof p.iat !== "number" || !Number.isFinite(p.iat) || Date.now() - p.iat > RESUBSCRIBE_TTL_MS) return null;
  return p;
}
