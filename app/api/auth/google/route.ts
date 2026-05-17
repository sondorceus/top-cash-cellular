import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import crypto from "crypto";
import { OAUTH_STATE_COOKIE } from "../../../lib/auth";

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "";

// Kicks off the Google OAuth dance.
// GET /api/auth/google?returnTo=/admin
//   1. Generate a random state token (CSRF defense).
//   2. Stash {state, returnTo} in a short-lived HTTP-only cookie.
//   3. Redirect to Google's authorize URL with the state.
// Google will bounce back to /api/auth/google/callback with ?code&state.
export async function GET(req: NextRequest) {
  if (!CLIENT_ID) {
    return NextResponse.json(
      { error: "GOOGLE_CLIENT_ID env not set on Vercel — sign-in disabled." },
      { status: 503 },
    );
  }
  // Sanity-bound the returnTo so an attacker can't bounce a victim to
  // an off-domain URL via the OAuth callback. Path-only, no schemes.
  const raw = req.nextUrl.searchParams.get("returnTo") || "/";
  const returnTo = raw.startsWith("/") && !raw.startsWith("//") ? raw : "/";
  const state = crypto.randomBytes(16).toString("hex");

  const cookieStore = await cookies();
  cookieStore.set(OAUTH_STATE_COOKIE, JSON.stringify({ state, returnTo }), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 600, // 10 min — plenty for the user to pick an account.
  });

  const redirectUri = `${req.nextUrl.origin}/api/auth/google/callback`;
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email profile",
    state,
    access_type: "online",
    prompt: "select_account",
  });
  return NextResponse.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
}
