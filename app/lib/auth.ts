import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import crypto from "crypto";

// Session cookie name — read by proxy.ts (route gating), the /api/admin/*
// routes (as an auth alternative to the legacy admin token), and the
// /admin client to render the logged-in user. Bump COOKIE_VERSION if the
// payload shape ever changes so old cookies are rejected gracefully.
export const COOKIE_NAME = "tcc_session";
export const COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days, in seconds
export const OAUTH_STATE_COOKIE = "tcc_oauth_state";

// Customer-facing session cookie. Separate from tcc_session so that
// email-only logins (no Google verification) can't accidentally grant
// admin access — admin gates only look at tcc_session. This cookie is
// purely for the customer's /account dashboard recognition + trade
// history view, and can be set after a successful /api/lookup match
// (email or phone), a Google sign-in, or any other future auth path.
// Skywalker 2026-05-19.
export const CUSTOMER_COOKIE_NAME = "tcc_customer";

// Default admin allowlist. Overridable via ADMIN_GOOGLE_EMAILS env (comma-
// separated). Skywalker 2026-05-17: only sondorceus@gmail.com to start.
const DEFAULT_ADMIN_EMAILS = ["sondorceus@gmail.com"];

export type SessionPayload = {
  email: string;
  name?: string;
  picture?: string;
  iat: number; // ms
  exp: number; // ms
};

function getSecret(): string {
  // NEXTAUTH_SECRET is the conventional name even though we're not using
  // NextAuth — keeps the env name familiar for future migration. Falls
  // back to MC_API_KEY in dev so things don't 500 if envs aren't set
  // locally; production MUST set NEXTAUTH_SECRET.
  return process.env.NEXTAUTH_SECRET || process.env.MC_API_KEY || "dev-only-fallback";
}

function base64url(buf: Buffer | string): string {
  return Buffer.from(buf)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function base64urlDecode(s: string): Buffer {
  const pad = s.length % 4 ? 4 - (s.length % 4) : 0;
  return Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat(pad), "base64");
}

export function signSession(payload: Omit<SessionPayload, "iat" | "exp">): string {
  const now = Date.now();
  const full: SessionPayload = {
    ...payload,
    iat: now,
    exp: now + COOKIE_MAX_AGE * 1000,
  };
  const body = base64url(JSON.stringify(full));
  const sig = base64url(crypto.createHmac("sha256", getSecret()).update(body).digest());
  return `${body}.${sig}`;
}

export function verifySession(token: string | undefined | null): SessionPayload | null {
  if (!token || !token.includes(".")) return null;
  const [body, sig] = token.split(".");
  const expected = base64url(crypto.createHmac("sha256", getSecret()).update(body).digest());
  // Constant-time compare to defeat timing side-channels.
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(base64urlDecode(body).toString("utf8")) as SessionPayload;
    if (typeof payload.exp !== "number" || payload.exp < Date.now()) return null;
    if (typeof payload.email !== "string" || !payload.email) return null;
    return payload;
  } catch {
    return null;
  }
}

export async function getServerSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  return verifySession(cookieStore.get(COOKIE_NAME)?.value);
}

export function getSessionFromRequest(req: NextRequest): SessionPayload | null {
  return verifySession(req.cookies.get(COOKIE_NAME)?.value);
}

export function getAdminEmails(): string[] {
  const env = process.env.ADMIN_GOOGLE_EMAILS;
  const list = env
    ? env.split(",").map((e) => e.trim().toLowerCase()).filter(Boolean)
    : DEFAULT_ADMIN_EMAILS.map((e) => e.toLowerCase());
  return list;
}

export function isAdminEmail(email: string | undefined | null): boolean {
  if (!email) return false;
  return getAdminEmails().includes(email.toLowerCase());
}

// Validate a returnTo path captured from a URL query string before
// using it as a redirect target. Defends against open-redirect attacks
// where an attacker dangles a phish via `?returnTo=//evil.com` or
// `?returnTo=/\evil.com` (some user agents normalize the backslash).
// Parsing the value against our own origin and re-checking the
// resulting URL.origin is the bulletproof form — it handles every
// browser-normalization edge case (\ vs /, %2f, https:evil.com, etc.)
// rather than us racing the spec.
// Customer session payload + helpers — separate from admin SessionPayload
// so the two cookie types can't be confused. `via` records how the
// customer authenticated, in case we ever want to limit what email-
// only sessions can do (today they can access /account; that's it).
export type CustomerSessionPayload = {
  email: string;
  name?: string;
  via: "email" | "google";
  iat: number;
  exp: number;
};

export function signCustomerSession(payload: Omit<CustomerSessionPayload, "iat" | "exp">): string {
  const now = Date.now();
  const full: CustomerSessionPayload = { ...payload, iat: now, exp: now + COOKIE_MAX_AGE * 1000 };
  const body = base64url(JSON.stringify(full));
  const sig = base64url(crypto.createHmac("sha256", getSecret()).update(body).digest());
  return `${body}.${sig}`;
}

export function verifyCustomerSession(token: string | undefined | null): CustomerSessionPayload | null {
  if (!token || !token.includes(".")) return null;
  const [body, sig] = token.split(".");
  const expected = base64url(crypto.createHmac("sha256", getSecret()).update(body).digest());
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(base64urlDecode(body).toString("utf8")) as CustomerSessionPayload;
    if (typeof payload.exp !== "number" || payload.exp < Date.now()) return null;
    if (typeof payload.email !== "string" || !payload.email) return null;
    if (payload.via !== "email" && payload.via !== "google") return null;
    return payload;
  } catch {
    return null;
  }
}

// Server-side customer recognition. Prefers the stronger tcc_session
// (Google-verified) when both cookies exist — falls back to the
// email-only tcc_customer cookie. Either grants /account access.
export async function getCustomerSessionFromCookies(): Promise<{ email: string; name?: string; via: "email" | "google" } | null> {
  const cookieStore = await cookies();
  const admin = verifySession(cookieStore.get(COOKIE_NAME)?.value);
  if (admin) return { email: admin.email, name: admin.name, via: "google" };
  const cust = verifyCustomerSession(cookieStore.get(CUSTOMER_COOKIE_NAME)?.value);
  if (cust) return { email: cust.email, name: cust.name, via: cust.via };
  return null;
}

// Customer profile cookie — editable display prefs (name, phone) the
// customer manages from /account → Account Info. Deliberately SEPARATE
// from the auth cookies: works for both email-login and Google
// customers, survives a re-login, and carries zero auth weight (it
// can't grant anything — it's just remembered contact info that
// pre-fills the funnel + shows on the account page). Skywalker
// 2026-05-19 — the "account edit button".
export const PROFILE_COOKIE_NAME = "tcc_profile";

export type CustomerProfile = {
  name?: string;
  phone?: string;
  updatedAt: number;
};

export function signProfile(profile: Omit<CustomerProfile, "updatedAt">): string {
  const full: CustomerProfile = { ...profile, updatedAt: Date.now() };
  const body = base64url(JSON.stringify(full));
  const sig = base64url(crypto.createHmac("sha256", getSecret()).update(body).digest());
  return `${body}.${sig}`;
}

export function verifyProfile(token: string | undefined | null): CustomerProfile | null {
  if (!token || !token.includes(".")) return null;
  const [body, sig] = token.split(".");
  const expected = base64url(crypto.createHmac("sha256", getSecret()).update(body).digest());
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    return JSON.parse(base64urlDecode(body).toString("utf8")) as CustomerProfile;
  } catch {
    return null;
  }
}

export async function getProfileFromCookies(): Promise<CustomerProfile | null> {
  const cookieStore = await cookies();
  return verifyProfile(cookieStore.get(PROFILE_COOKIE_NAME)?.value);
}

export function isSafeReturnTo(returnTo: string | undefined | null, origin: string): boolean {
  if (!returnTo || typeof returnTo !== "string") return false;
  if (!returnTo.startsWith("/")) return false;
  try {
    const url = new URL(returnTo, origin);
    return url.origin === origin;
  } catch {
    return false;
  }
}
