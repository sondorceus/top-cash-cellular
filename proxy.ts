import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest, isAdminEmail } from "./app/lib/auth";

// Top Cash Cellular auth proxy (Next 16's renamed middleware). Two jobs:
//
// 1) Gate /admin/* — anyone visiting without a valid Google session whose
//    email is in the admin allowlist gets bounced to /api/auth/google
//    with returnTo set so they land back on the page they wanted.
//
// 2) For /api/admin/* — if the request has a valid Google admin session,
//    inject the legacy x-admin-token header server-side so every existing
//    admin API route's token check keeps working unchanged. This way
//    Skywalker logs in once via Google and the whole admin surface lights
//    up without per-route auth refactors. Direct curl callers can still
//    use the legacy header/query param to bypass.
//
// Runs on the Node runtime (Next 16 default for proxy) so we get the
// node `crypto` module for HMAC session verification.
export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // /admin page gate — three outcomes:
  //   1. /admin/forbidden is the not-authorized landing page; always
  //      allow through so we don't infinite-loop a signed-in non-admin
  //      back to Google.
  //   2. Not signed in at all → bounce to Google sign-in with returnTo
  //      so the user lands back where they wanted.
  //   3. Signed in but email not on the allowlist → send to the
  //      forbidden page instead of re-running auth (which would just
  //      authenticate them as the same non-admin email again).
  if (pathname.startsWith("/admin")) {
    if (pathname === "/admin/forbidden") return NextResponse.next();
    const session = getSessionFromRequest(req);
    if (!session) {
      const url = new URL("/api/auth/google", req.url);
      url.searchParams.set("returnTo", pathname);
      return NextResponse.redirect(url);
    }
    if (!isAdminEmail(session.email)) {
      return NextResponse.redirect(new URL("/admin/forbidden", req.url));
    }
    return NextResponse.next();
  }

  // /api/admin/* — translate Google session → legacy admin token so the
  // existing route handlers (which check x-admin-token) accept the call.
  if (pathname.startsWith("/api/admin/")) {
    const session = getSessionFromRequest(req);
    if (session && isAdminEmail(session.email)) {
      const headers = new Headers(req.headers);
      // Use the same legacy token the routes already expect. Routes can
      // continue to check this header without knowing anything about
      // Google sessions.
      headers.set("x-admin-token", process.env.TCC_ADMIN_TOKEN || "topcash-admin-2026");
      return NextResponse.next({ request: { headers } });
    }
    // No session — let the route's own check handle it (might still
    // pass via direct token header for curl/automation use).
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  // Match the gated pages + the admin API surface. Static assets and
  // public routes (home, /faq, etc.) are skipped entirely.
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};
