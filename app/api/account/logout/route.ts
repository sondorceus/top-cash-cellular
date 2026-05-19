// Clears the customer cookie. Doesn't touch tcc_session (admin) — if
// a customer is also signed in with Google, /api/auth/signout handles
// that separately.

import { NextResponse } from "next/server";
import { CUSTOMER_COOKIE_NAME } from "../../../lib/auth";

export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(CUSTOMER_COOKIE_NAME, "", { httpOnly: true, path: "/", maxAge: 0 });
  return res;
}
