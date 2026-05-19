import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { COOKIE_NAME, CUSTOMER_COOKIE_NAME } from "../../../lib/auth";

// POST /api/auth/signout — clears both session cookies (admin
// tcc_session AND customer tcc_customer) so a single signout click
// fully logs the user out. Idempotent — safe to call repeatedly.
export async function POST() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
  cookieStore.delete(CUSTOMER_COOKIE_NAME);
  return NextResponse.json({ ok: true });
}
