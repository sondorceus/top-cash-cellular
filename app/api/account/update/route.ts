// POST /api/account/update — saves the customer's editable profile
// (name + phone) into the tcc_profile cookie. Must be signed in
// (either auth cookie). MC-independent — works even when Mission
// Control is down. The saved name/phone pre-fill the funnel on the
// customer's next trade and show on /account. Skywalker 2026-05-19.

import { NextRequest, NextResponse } from "next/server";
import { getCustomerSessionFromCookies, signProfile, PROFILE_COOKIE_NAME, COOKIE_MAX_AGE } from "../../../lib/auth";

export async function POST(req: NextRequest) {
  const session = await getCustomerSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "Sign in to update your account." }, { status: 401 });
  }
  let payload: { name?: unknown; phone?: unknown };
  try { payload = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const name = typeof payload.name === "string" ? payload.name.trim().slice(0, 60) : "";
  const phoneRaw = typeof payload.phone === "string" ? payload.phone : "";
  const phoneDigits = phoneRaw.replace(/\D/g, "").slice(0, 10);

  // Name is required (it's what shows on the account + lead). Phone is
  // optional but if present must be a full 10-digit US number.
  if (!name || name.length < 2) {
    return NextResponse.json({ error: "Enter your name." }, { status: 400 });
  }
  if (phoneDigits && phoneDigits.length !== 10) {
    return NextResponse.json({ error: "Phone must be a 10-digit US number." }, { status: 400 });
  }
  // Store phone formatted so the funnel + account display match.
  const phone = phoneDigits.length === 10
    ? `(${phoneDigits.slice(0, 3)}) ${phoneDigits.slice(3, 6)}-${phoneDigits.slice(6)}`
    : undefined;

  const token = signProfile({ name, phone });
  const res = NextResponse.json({ ok: true, name, phone: phone || "" });
  res.cookies.set(PROFILE_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: COOKIE_MAX_AGE,
  });
  return res;
}
