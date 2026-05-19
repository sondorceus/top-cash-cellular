// Customer-facing token verification endpoint. The /counter/[token]
// client page calls this to decode the offer payload server-side
// (HMAC secret stays on the server). Returns the payload on success or
// an opaque error on failure — never leaks the secret or partial state.

import { NextRequest, NextResponse } from "next/server";
import { verifyCounterToken } from "../../../lib/counter-token";

export async function POST(req: NextRequest) {
  let body: { token?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const payload = verifyCounterToken(body.token);
  if (!payload) {
    return NextResponse.json({ error: "This offer link is invalid or has expired." }, { status: 400 });
  }

  return NextResponse.json({ ok: true, payload });
}
