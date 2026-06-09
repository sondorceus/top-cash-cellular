// HMAC-signed newsletter unsubscribe tokens. Same shape as
// counter-token.ts but bears just the subscriber email + iat. No
// expiry — unsubscribe should always work, even years later, per
// CAN-SPAM. Verification confirms the token wasn't tampered.

import crypto from "crypto";

// No hardcoded fallback — a public default makes unsubscribe tokens forgeable
// (anyone could unsubscribe arbitrary emails). Precedence preserved so live
// tokens stay valid; throws on first use if no secret is set. (bug fix)
function getSecret(): string {
  const s =
    process.env.TCC_TOKEN_SECRET ||
    process.env.TCC_SESSION_SECRET ||
    process.env.TCC_ADMIN_TOKEN ||
    process.env.NEXTAUTH_SECRET ||
    process.env.MC_API_KEY;
  if (!s) throw new Error("newsletter-token signing secret env required (TCC_ADMIN_TOKEN / NEXTAUTH_SECRET / MC_API_KEY)");
  return s;
}

export type NewsletterPayload = {
  email: string;
  iat: number;
};

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

export function signNewsletterToken(email: string): string {
  const payload: NewsletterPayload = { email: email.toLowerCase().trim(), iat: Date.now() };
  const body = base64url(Buffer.from(JSON.stringify(payload)));
  const sig = base64url(
    crypto.createHmac("sha256", getSecret()).update(body).digest(),
  );
  return `${body}.${sig}`;
}

export function verifyNewsletterToken(token: string | undefined | null): NewsletterPayload | null {
  if (!token || !token.includes(".")) return null;
  const [body, sig] = token.split(".");
  const expected = base64url(
    crypto.createHmac("sha256", getSecret()).update(body).digest(),
  );
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(base64urlDecode(body).toString("utf8")) as NewsletterPayload;
    if (typeof payload.email !== "string" || !payload.email) return null;
    return payload;
  } catch {
    return null;
  }
}
