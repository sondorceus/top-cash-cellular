import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { signSession, COOKIE_NAME, COOKIE_MAX_AGE, OAUTH_STATE_COOKIE, isSafeReturnTo } from "../../../../lib/auth";

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "";
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || "";

// Google bounces here with ?code=...&state=...
//   1. Verify state matches what we stashed pre-redirect (CSRF defense).
//   2. Exchange the code for tokens at oauth2.googleapis.com/token.
//   3. Fetch the user profile (email, name, picture).
//   4. Drop our signed session cookie + redirect to returnTo.
function errorRedirect(origin: string, code: string) {
  return NextResponse.redirect(`${origin}/?auth_error=${encodeURIComponent(code)}`);
}

export async function GET(req: NextRequest) {
  const origin = req.nextUrl.origin;
  const code = req.nextUrl.searchParams.get("code");
  const stateParam = req.nextUrl.searchParams.get("state");
  const googleError = req.nextUrl.searchParams.get("error");
  if (googleError) return errorRedirect(origin, googleError);
  if (!code || !stateParam) return errorRedirect(origin, "missing_params");
  if (!CLIENT_ID || !CLIENT_SECRET) return errorRedirect(origin, "not_configured");

  const cookieStore = await cookies();
  const stateCookie = cookieStore.get(OAUTH_STATE_COOKIE)?.value;
  if (!stateCookie) return errorRedirect(origin, "expired_state");
  let storedState: string;
  let returnTo = "/";
  try {
    const parsed = JSON.parse(stateCookie) as { state?: string; returnTo?: string };
    storedState = String(parsed.state || "");
    // Defense-in-depth: even though /api/auth/google validated the
    // returnTo when stashing the cookie, re-validate here against the
    // request origin. If someone forged or tampered the state cookie
    // (e.g. via a same-origin XSS) we still refuse off-domain hops.
    if (parsed.returnTo && isSafeReturnTo(parsed.returnTo, origin)) {
      returnTo = parsed.returnTo;
    }
  } catch {
    return errorRedirect(origin, "invalid_state");
  }
  if (storedState !== stateParam) return errorRedirect(origin, "state_mismatch");
  cookieStore.delete(OAUTH_STATE_COOKIE);

  const redirectUri = `${origin}/api/auth/google/callback`;
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
    cache: "no-store",
  });
  if (!tokenRes.ok) return errorRedirect(origin, "token_exchange");
  const tokens = (await tokenRes.json()) as { access_token?: string };
  if (!tokens.access_token) return errorRedirect(origin, "no_access_token");

  const userRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
    cache: "no-store",
  });
  if (!userRes.ok) return errorRedirect(origin, "userinfo");
  const user = (await userRes.json()) as {
    sub?: string;
    email?: string;
    email_verified?: boolean;
    name?: string;
    picture?: string;
  };
  if (!user.email) return errorRedirect(origin, "no_email");
  // Refuse unverified Gmail addresses — keeps spoofed-claim accounts out
  // of the admin allowlist comparison.
  if (user.email_verified === false) return errorRedirect(origin, "unverified");

  const token = signSession({
    email: user.email,
    name: user.name,
    picture: user.picture,
  });
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: COOKIE_MAX_AGE,
  });
  return NextResponse.redirect(`${origin}${returnTo}`);
}
