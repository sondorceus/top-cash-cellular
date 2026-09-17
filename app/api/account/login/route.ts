// Customer email login — magic link. Sets a tcc_customer cookie so the
// customer can open /account and see their history.
//
//   POST { email }  → if the email matches a past lead, EMAIL a signed
//                     sign-in link to it. Never sets a cookie.
//   GET  ?t=TOKEN   → the link itself: verify the token and bounce to
//                     /account?confirm=TOKEN. Never sets a cookie.
//   POST { token }  → the "Sign in as <full email>?" Continue button on
//                     /account: verify the token, set the cookie; returns
//                     { ok: true, name, leadCount }.
//
// Why the confirm step (R9, login CSRF): the link used to sign in whichever
// browser opened it. An attacker could request a link for THEIR OWN email
// and text it to a victim — the victim's browser became the attacker's
// session, and the homepage funnel then pre-filled the attacker's email
// into the victim's trade. Now a person has to see which account and press
// Continue, and that POST must come from our own page (isSameOriginPost) so
// a cross-site form can't press it for them. Mail scanners that pre-fetch
// the GET no longer sign anything in either.
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
import { fetchCommsRead } from "../../../lib/mc-comms";

const MC_KEY = process.env.MC_API_KEY || "";
const LOOKUP_DOWN = "We couldn't check your trades just now — please try again in a minute.";
const SITE = "https://topcashcellular.com";

// `ml: 1` marks a session minted from a verified magic link.
// getCustomerSessionFromCookies (so /api/account/me, /api/referral,
// /api/account/update) and /api/auth/me refuse tcc_customer cookies without
// it — the ones the old raw-email login handed out stay signature-valid for
// 30 days.
type MagicLinkSession = Parameters<typeof signCustomerSession>[0] & { ml: 1 };

// Count past leads whose OWN parsed Email: field is this email, and take
// the name from the first one. Not a whole-body substring — otherwise an
// email that merely appears in a STRANGER'S lead body (notes, etc.) would
// count their trade as yours (IDOR). Same fix as /api/track + /lookup.
//
// Same paged one-year window as /api/track: the newest-500 slice could lose
// the trade between mailing a link and the tap. `failed` = MC couldn't be
// read (it restarts on every deploy) — not the same as "no trade". A read
// that lost a page part-way counts as failed too: an older trade may be on
// the page that errored.
async function findLeads(email: string): Promise<{ name?: string; leadCount: number; failed?: boolean }> {
  let name: string | undefined;
  let leadCount = 0;
  if (!MC_KEY) return { leadCount, failed: true };
  const { messages, complete } = await fetchCommsRead({ apiKey: MC_KEY, includeArchive: true, sinceMs: 365 * 24 * 60 * 60 * 1000, pageSize: 5000, maxPages: 6 });
  if (!complete || messages.length === 0) return { leadCount, failed: true };
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

// Login-CSRF guard for every POST here (minting a session or mailing a
// link). A cross-site <form enctype="text/plain"> needs no CORS preflight
// and req.json() still parses its body, so without this any page could
// press Continue with the attacker's own valid token. Browsers send
// Sec-Fetch-Site on fetches (Chrome 76+, Firefox 90+, Safari 16.4+); older
// ones still send Origin on a POST. Neither header = no browser page we can
// vouch for → refuse (the only caller is /account, a same-origin fetch).
function isSameOriginPost(req: NextRequest): boolean {
  const site = req.headers.get("sec-fetch-site");
  if (site) return site === "same-origin";
  const origin = req.headers.get("origin");
  if (!origin || origin === "null") return false;
  const host = req.headers.get("host") || req.nextUrl.host;
  try { return new URL(origin).host === host; } catch { return false; }
}

// Magic-link landing. Always redirects to /account and never sets the
// cookie: a valid token goes to the confirm prompt (?confirm=TOKEN, which
// /account moves out of the address bar), anything else says why
// (?link=…) instead of silently showing the form again. The trade lookup
// (retry / notrade) runs on Continue, so a scanner's pre-fetch costs no
// MC read.
export async function GET(req: NextRequest) {
  const account = `${req.nextUrl.origin}/account`;
  const noStore = { headers: { "Cache-Control": "no-store" } };
  const rl = rateLimit(`login:${clientIp(req)}`, 8, 60_000);
  if (!rl.ok) return NextResponse.redirect(`${account}?link=retry`, noStore);
  const token = req.nextUrl.searchParams.get("t") || "";
  if (!emailFromToken(token)) return NextResponse.redirect(`${account}?link=expired`, noStore);
  return NextResponse.redirect(`${account}?confirm=${encodeURIComponent(token)}`, noStore);
}

export async function POST(req: NextRequest) {
  // Before the throttle, so a hostile page can't burn a victim's bucket.
  if (!isSameOriginPost(req)) {
    return NextResponse.json({ error: "Open the sign-in link from your email again to continue.", crossSite: true }, { status: 403 });
  }
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

  // The confirm prompt's Continue — the only path that sets the cookie.
  const token = typeof payload.token === "string" ? payload.token : "";
  if (token) {
    const email = emailFromToken(token);
    const claimed = typeof payload.email === "string" ? payload.email.trim().toLowerCase() : "";
    if (!email || (claimed && claimed !== email)) {
      return NextResponse.json({ error: "This sign-in link is invalid or expired. Request a new one.", expired: true }, { status: 401 });
    }
    const { name, leadCount, failed } = await findLeads(email);
    if (failed) return NextResponse.json({ error: LOOKUP_DOWN }, { status: 503 });
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
  const { leadCount, failed } = await findLeads(email);
  if (failed) return NextResponse.json({ error: LOOKUP_DOWN }, { status: 503 });
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
