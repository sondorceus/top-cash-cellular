// Customer email login — magic link. Sets a tcc_customer cookie so the
// customer can open /account and see their history.
//
//   POST { email }  → if the email matches a past lead, EMAIL a signed
//                     sign-in link to it. Never sets a cookie.
//   GET  ?t=TOKEN   → the link itself: verify the token, set the cookie,
//                     redirect to /account.
//   POST { token }  → same check as the link, for a client already holding
//                     a token; returns { ok: true, name, leadCount }.
//
// This used to mint a 30-day session from a typed email alone, and
// /api/account/me then served that email's payout handles, home address
// and lead ids (the only secret on /offer/[leadId]) to whoever typed it.
// Possession of the inbox is now the proof — the same signed-token flow
// /api/track moved to (app/lib/track-token.ts, 30-min TTL).
//
// The cookie is bound to a *separate* name (tcc_customer, not
// tcc_session) so it can never grant admin access — admin gates only look
// at tcc_session. Skywalker 2026-05-19.

import { NextRequest, NextResponse } from "next/server";
import { signCustomerSession, CUSTOMER_COOKIE_NAME, COOKIE_MAX_AGE } from "../../../lib/auth";
import { rateLimit, clientIp } from "../../../lib/rate-limit";
import { makeTrackToken, verifyTrackToken } from "../../../lib/track-token";
import { sendCustomerEmail } from "../../../lib/customer-send";

const MC_API = "https://missioncontrolsdjg-production.up.railway.app";
const MC_KEY = process.env.MC_API_KEY || "";
const SITE = "https://topcashcellular.com";

// `ml: 1` marks a session minted from a verified magic link.
// /api/account/me refuses tcc_customer cookies without it — the ones the
// old raw-email login handed out stay signature-valid for 30 days.
type MagicLinkSession = Parameters<typeof signCustomerSession>[0] & { ml: 1 };

// Count past leads whose OWN parsed Email: field is this email, and take
// the name from the first one. Not a whole-body substring — otherwise an
// email that merely appears in a STRANGER'S lead body (notes, etc.) would
// count their trade as yours (IDOR). Same fix as /api/track + /lookup.
async function findLeads(email: string): Promise<{ name?: string; leadCount: number }> {
  let name: string | undefined;
  let leadCount = 0;
  if (!MC_KEY) return { leadCount };
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
        if (!m.body.includes("[NEW BUYBACK LEAD")) continue;
        const leadEmail = m.body.match(/(?:^|\n)Email:[ \t]*([^\n]*)/i)?.[1]?.trim().toLowerCase() || "";
        if (leadEmail !== email) continue;
        leadCount += 1;
        if (!name) {
          const nm = m.body.match(/(?:^|\n)Name:[ \t]*([^\n]*)/i);
          const v = nm?.[1]?.trim();
          if (v) name = v;
        }
      }
    }
  } catch { /* fall through — no leads found */ }
  return { name, leadCount };
}

// The email a token proves, or null. Email tokens only: a lead's Phone and
// Email lines are both typed by whoever submitted it, so owning a phone
// doesn't prove owning the email this session would be keyed on.
function emailFromToken(token: string): string | null {
  const contact = verifyTrackToken(token);
  return contact && contact.includes("@") ? contact : null;
}

function setSessionCookie(res: NextResponse, email: string, name?: string) {
  const payload: MagicLinkSession = { email, name, via: "email", ml: 1 };
  res.cookies.set(CUSTOMER_COOKIE_NAME, signCustomerSession(payload), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: COOKIE_MAX_AGE,
  });
}

// Magic-link landing. Always redirects to /account; the cookie is set only
// when the token is valid and the email has a past trade, so a bad or
// expired link just shows the sign-in form again.
export async function GET(req: NextRequest) {
  const account = `${req.nextUrl.origin}/account`;
  const noStore = { headers: { "Cache-Control": "no-store" } };
  const rl = rateLimit(`login:${clientIp(req)}`, 8, 60_000);
  if (!rl.ok) return NextResponse.redirect(account, noStore);
  const email = emailFromToken(req.nextUrl.searchParams.get("t") || "");
  if (!email) return NextResponse.redirect(`${account}?link=expired`, noStore);
  const { name, leadCount } = await findLeads(email);
  const res = NextResponse.redirect(account, noStore);
  if (leadCount > 0) setSessionCookie(res, email, name);
  return res;
}

export async function POST(req: NextRequest) {
  // Throttle — cap attempts per IP to blunt scripted probing of known
  // addresses.
  const rl = rateLimit(`login:${clientIp(req)}`, 8, 60_000);
  if (!rl.ok) {
    return NextResponse.json({ error: "Too many attempts — please wait a moment and try again." }, { status: 429 });
  }
  let payload: { email?: unknown; token?: unknown };
  try { payload = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const token = typeof payload.token === "string" ? payload.token : "";
  if (token) {
    const email = emailFromToken(token);
    const claimed = typeof payload.email === "string" ? payload.email.trim().toLowerCase() : "";
    if (!email || (claimed && claimed !== email)) {
      return NextResponse.json({ error: "This sign-in link is invalid or expired. Request a new one.", expired: true }, { status: 401 });
    }
    const { name, leadCount } = await findLeads(email);
    if (leadCount === 0) {
      return NextResponse.json({ found: false, error: "We don't see a past trade for that email — try Guest Checkout instead." }, { status: 404 });
    }
    const res = NextResponse.json({ ok: true, email, name, leadCount });
    setSessionCookie(res, email, name);
    return res;
  }

  const raw = typeof payload.email === "string" ? payload.email.trim() : "";
  const email = raw.toLowerCase();
  if (!email || email.length < 5 || !email.includes("@") || email.indexOf("@") === 0) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }

  // Confirm the email actually appears in at least one past lead before
  // mailing a link — no sign-in mail to random typos / probed addresses.
  const { leadCount } = await findLeads(email);
  if (leadCount === 0) {
    return NextResponse.json({ found: false, error: "We don't see a past trade for that email — try Guest Checkout instead." }, { status: 404 });
  }

  // Sending mail: share /api/track/request's bucket AND config (5 per
  // 15 min — keep in lockstep, see rate-limit.ts) so the two magic-link
  // senders can't be combined to double the inbox-bombing budget.
  // One structurally-valid address only (same test as /api/track/request)
  // — this string becomes the Resend recipient.
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }
  const sendRl = rateLimit(`track-req:${clientIp(req)}`, 5, 15 * 60_000);
  if (!sendRl.ok) {
    return NextResponse.json({ error: "Too many sign-in links requested — please wait a bit and try again." }, { status: 429 });
  }
  const link = `${SITE}/api/account/login?t=${encodeURIComponent(makeTrackToken(email))}`;
  const html = `
    <div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#111">
      <p style="font-size:16px;font-weight:700;margin:0 0 8px">Sign in to your Top Cash Cellular account</p>
      <p style="font-size:14px;color:#444;margin:0 0 20px">Tap the button to open your account and trade history. This secure link expires in 30 minutes.</p>
      <a href="${link}" style="display:inline-block;background:#00c853;color:#0a0a0a;font-weight:700;text-decoration:none;padding:12px 24px;border-radius:10px;font-size:15px">Open my account →</a>
      <p style="font-size:12px;color:#888;margin:20px 0 0">If you didn&rsquo;t request this, you can ignore it — no one can open your account without this link.</p>
    </div>`;
  const sent = await sendCustomerEmail(email, "Your Top Cash Cellular sign-in link", html);
  if (!sent) {
    return NextResponse.json({ error: "Couldn't send the sign-in email — try again, or continue with Google." }, { status: 502 });
  }
  // No session yet. `ok: false` + `error` keeps the current /account form
  // (which renders d.error whenever !d.ok) showing this notice unchanged.
  const notice = "Check your email — we sent you a secure sign-in link (expires in 30 minutes).";
  return NextResponse.json({ ok: false, sent: true, message: notice, error: notice });
}
