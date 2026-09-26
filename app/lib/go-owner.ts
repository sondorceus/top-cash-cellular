// The browser↔thread binding for /go (2026-09-26). A session id alone used
// to be the whole key to a thread: chat-sync full=1 returned every line and
// the label URL to anyone holding it, /api/go/label printed a FedEx label
// to any address, confirm-email mailed the offer anywhere. The owner's
// rule: bind the session to the browser that started it, or to a signed
// link. So:
//   • tcc_go_owner = `<sid>.<HMAC-SHA256(TCC_ADMIN_TOKEN, "go-owner:"+sid)>`
//     (32 hex), set by the first request that writes a FRESH session (no
//     records yet): the breadcrumb of the tap that opened it, the first
//     chat turn, a chip quote, a lock — and by any gated route or chat-sync
//     read that a texted link's `k` unlocks (go-sid-token) when the cookie
//     is absent or names another session;
//   • a request OWNS a session when that cookie names it with a valid
//     token, or carries the link's `k`.
// One cookie, the current sid (the widget and /go share it); a new sid
// replaces it. 30 days — the store's own idle rule. Server-only: the key
// never leaves the server, and no key = nothing binds and nothing is owned
// (fail closed, like go-sid-token).
import { createHmac, timingSafeEqual } from "crypto";
import type { NextRequest, NextResponse } from "next/server";
import { sidTokenValid } from "./go-sid-token";

export const OWNER_COOKIE = "tcc_go_owner";
const OWNER_COOKIE_MAX_AGE = 30 * 24 * 3600; // seconds

export function ownerToken(sid: string): string {
  const key = process.env.TCC_ADMIN_TOKEN || "";
  if (!key || !sid) return "";
  return createHmac("sha256", key).update(`go-owner:${sid}`).digest("hex").slice(0, 32);
}

/** Constant-time check of a cookie value (`<sid>.<token>`) against `sid`. */
export function ownerCookieValid(sid: string, value: string | null | undefined): boolean {
  const want = ownerToken(sid);
  if (!want || !value) return false;
  const dot = value.lastIndexOf(".");
  if (dot <= 0) return false;
  const got = value.slice(dot + 1);
  if (value.slice(0, dot) !== sid || got.length !== want.length) return false;
  try {
    return timingSafeEqual(Buffer.from(got), Buffer.from(want));
  } catch {
    return false;
  }
}

/** Bind this browser to `sid`. No signing key → no cookie. */
export function setOwnerCookie(res: NextResponse, sid: string): void {
  const tok = ownerToken(sid);
  if (!tok) return;
  res.cookies.set({
    name: OWNER_COOKIE,
    value: `${sid}.${tok}`,
    httpOnly: true,
    // Same convention as the admin session cookie: Secure everywhere but a
    // plain-http dev server.
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: OWNER_COOKIE_MAX_AGE,
  });
}

/** The request's cookie names `sid` with a valid token, or `k` is the
 *  signed link token for it. */
export function sessionOwned(req: NextRequest, sid: string, k?: string | null): boolean {
  if (ownerCookieValid(sid, req.cookies.get(OWNER_COOKIE)?.value)) return true;
  return typeof k === "string" && k.length > 0 && sidTokenValid(sid, k);
}

/** The cookie is absent or names another session — a request that proves
 *  ownership another way (a fresh session, a link) should set it. */
export function needsBinding(req: NextRequest, sid: string): boolean {
  return !ownerCookieValid(sid, req.cookies.get(OWNER_COOKIE)?.value);
}

/** Proven by the link, and not yet bound to `sid` — set the cookie. */
export function linkBinds(req: NextRequest, sid: string, k?: string | null): boolean {
  return typeof k === "string" && k.length > 0 && sidTokenValid(sid, k) && needsBinding(req, sid);
}

// LEGACY GRACE (2026-09-26). Sessions that predate binding (the deploy at
// BINDING_SINCE) could never have received a cookie: their own sellers'
// browsers read as unbound, and touchSession keeps an active session alive
// for as long as they keep chatting — so a seller mid-flow would have seen
// "open the link from your text" indefinitely. Until the grace ends (those
// sessions age out of the store in 30 days anyway) the first cookie-less
// browser that presents one of them is treated as its owner and bound from
// then on — a `bound` control record marks the take, so the next
// cookie-less browser is refused like any other. That is the pre-change
// exposure, limited to those sessions and dated; a session started after
// BINDING_SINCE gets no grace.
export const BINDING_SINCE = Date.parse("2026-09-26T14:00:00Z");
export const LEGACY_GRACE_UNTIL = Date.parse("2026-10-26T00:00:00Z");
/** `firstTs` = the session's oldest record (ChatState.firstTs, pathname-derived). */
export function legacySession(firstTs: number): boolean {
  return firstTs > 0 && firstTs < BINDING_SINCE && Date.now() < LEGACY_GRACE_UNTIL;
}
