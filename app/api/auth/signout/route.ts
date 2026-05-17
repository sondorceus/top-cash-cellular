import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { COOKIE_NAME } from "../../../lib/auth";

// POST /api/auth/signout — clears the session cookie. Client UI hits this
// when the user clicks the signout button; can also be reached directly
// via curl for debugging. No CSRF token needed (signout is idempotent
// and bounded to the current session).
export async function POST() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
  return NextResponse.json({ ok: true });
}
