import { NextResponse } from "next/server";
import { getServerSession, isAdminEmail } from "../../../lib/auth";

// GET /api/auth/me — returns the current user (or { authenticated: false })
// for client UI that needs to render the user's name/picture or branch
// admin vs customer state. Cheap, cache-disabled.
export async function GET() {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ authenticated: false }, {
      headers: { "Cache-Control": "no-store" },
    });
  }
  return NextResponse.json(
    {
      authenticated: true,
      email: session.email,
      name: session.name,
      picture: session.picture,
      isAdmin: isAdminEmail(session.email),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
