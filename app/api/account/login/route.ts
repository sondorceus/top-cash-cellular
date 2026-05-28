// Customer email-only login. POST { email } — verifies the email
// matches at least one past lead in MC, sets a tcc_customer cookie,
// and returns { ok: true, name, leadCount }. From here the customer
// can navigate /account and see their history.
//
// This is intentionally lower-security than the Google-OAuth path:
// no password, just email recall. Anyone who knows your email can
// see your trade history — same trust level as the existing checkout
// returning-customer form. The cookie is bound to a *separate* name
// (tcc_customer, not tcc_session) so it can never grant admin access
// — admin gates only look at tcc_session. Skywalker 2026-05-19.

import { NextRequest, NextResponse } from "next/server";
import { signCustomerSession, CUSTOMER_COOKIE_NAME, COOKIE_MAX_AGE } from "../../../lib/auth";
import { rateLimit, clientIp } from "../../../lib/rate-limit";

const MC_API = "https://missioncontrolsdjg-production.up.railway.app";
const MC_KEY = process.env.MC_API_KEY || "";

export async function POST(req: NextRequest) {
  // Throttle — this mints a 30-day session from an email alone, so cap
  // attempts per IP to blunt scripted probing of known addresses.
  const rl = rateLimit(`login:${clientIp(req)}`, 8, 60_000);
  if (!rl.ok) {
    return NextResponse.json({ error: "Too many attempts — please wait a moment and try again." }, { status: 429 });
  }
  let payload: { email?: unknown };
  try { payload = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const raw = typeof payload.email === "string" ? payload.email.trim() : "";
  const email = raw.toLowerCase();
  if (!email || email.length < 5 || !email.includes("@") || email.indexOf("@") === 0) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }

  // Confirm the email actually appears in at least one past lead body
  // before granting a session. Stops random typos / probing from
  // setting a cookie they can't do anything with.
  let name: string | undefined;
  let leadCount = 0;
  if (MC_KEY) {
    try {
      const r = await fetch(`${MC_API}/api/comms?limit=500`, {
        headers: { "x-api-key": MC_KEY },
        cache: "no-store",
      });
      if (r.ok) {
        const data = await r.json();
        const messages: { body?: string; timestamp: string }[] = data.messages || [];
        for (const m of messages) {
          if (!m.body) continue;
          if (!m.body.toLowerCase().includes(email)) continue;
          if (!m.body.includes("[NEW BUYBACK LEAD")) continue;
          leadCount += 1;
          if (!name) {
            const nm = m.body.match(/(?:^|\n)Name:[ \t]*([^\n]*)/i);
            const v = nm?.[1]?.trim();
            if (v) name = v;
          }
        }
      }
    } catch { /* fall through — no leads found */ }
  }
  if (leadCount === 0) {
    return NextResponse.json({ found: false, error: "We don't see a past trade for that email — try Guest Checkout instead." }, { status: 404 });
  }

  const token = signCustomerSession({ email, name, via: "email" });
  const res = NextResponse.json({ ok: true, email, name, leadCount });
  res.cookies.set(CUSTOMER_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: COOKIE_MAX_AGE,
  });
  return res;
}
