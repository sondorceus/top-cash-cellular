import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getServerSession, isAdminEmail, verifyCustomerSession, CUSTOMER_COOKIE_NAME } from "../../../lib/auth";

// GET /api/auth/me — returns the current user (or { authenticated: false })
// for client UI that needs to render the user's name/picture or branch
// admin vs customer state. Cheap, cache-disabled.
//
// Two cookie sources, in priority order:
//   1. tcc_session  — Google-verified, can grant admin
//   2. tcc_customer — email-only, customer dashboard only (never admin)
// Whichever is present wins; isAdmin only ever true for the first.
export async function GET() {
  const session = await getServerSession();
  if (session) {
    return NextResponse.json(
      {
        authenticated: true,
        email: session.email,
        name: session.name,
        picture: session.picture,
        isAdmin: isAdminEmail(session.email),
        via: "google",
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  }
  const cookieStore = await cookies();
  const cust = verifyCustomerSession(cookieStore.get(CUSTOMER_COOKIE_NAME)?.value);
  if (cust) {
    return NextResponse.json(
      {
        authenticated: true,
        email: cust.email,
        name: cust.name,
        picture: undefined,
        isAdmin: false,
        via: cust.via,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  }
  return NextResponse.json({ authenticated: false }, {
    headers: { "Cache-Control": "no-store" },
  });
}
