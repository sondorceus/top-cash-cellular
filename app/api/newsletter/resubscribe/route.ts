// Re-subscribe confirmation — the click that undoes an opt-out (2026-09-27).
//
// /api/newsletter used to clear the durable opt-out on any POST naming the
// address, so a third party could re-enroll someone who had unsubscribed. Now
// that POST only mails a signed link here; this GET (a plain link, no JS, the
// same page style as the unsubscribe route) checks the token's scope and
// 7-day age, forgets the opt-out under every key, writes the
// "[NEWSLETTER SIGNUP] … welcome=confirm" marker the roster reads, and says
// so. Idempotent: a second click clears nothing more and adds one SIGNUP
// marker the roster dedupes (newest wins). Either write failing → an honest
// "not saved yet" page, the link still good.

import { NextRequest, NextResponse } from "next/server";
import { esc } from "../../../lib/email-shell";
import { verifyResubscribeToken } from "../../../lib/newsletter-token";
import { clearNewsletterUnsub } from "../../../lib/newsletter-unsub";
import { newsletterPage, tamperedBodyHtml, SUPPORT_LINK_HTML } from "../../../lib/newsletter-page";
import { rateLimit, rateLimitResponse, clientIp } from "../../../lib/rate-limit";

const MC_API = "https://missioncontrolsdjg-production.up.railway.app";
const MC_KEY = process.env.MC_API_KEY || "";

function page(html: string, status: number): NextResponse {
  return new NextResponse(html, { status, headers: { "Content-Type": "text/html; charset=utf-8" } });
}

// Same marker shape /api/newsletter writes, welcome=confirm so the audit
// trail shows the click. No MC key = nothing to write to (as the signup
// route treats it), not a failure.
async function postSignupMarker(email: string, name: string): Promise<boolean> {
  if (!MC_KEY) return true;
  try {
    const r = await fetch(`${MC_API}/api/comms`, {
      method: "POST",
      headers: { "x-api-key": MC_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "topcash-web",
        fromName: "Top Cash Cellular",
        role: "system",
        body: `[NEWSLETTER SIGNUP] email=${email}${name ? ` name=${name}` : ""} welcome=confirm`,
        tags: ["newsletter", "signup", "resubscribe"],
        priority: "normal",
      }),
      signal: AbortSignal.timeout(8_000),
    });
    return r.ok;
  } catch {
    return false;
  }
}

export async function GET(req: NextRequest) {
  // Token-gated already; this only stops a replayed link from spamming markers.
  const rl = rateLimit(`newsletter-resub-confirm:${clientIp(req)}`, 10, 60_000);
  if (!rl.ok) return rateLimitResponse(rl.retryAfterMs);

  const payload = verifyResubscribeToken(req.nextUrl.searchParams.get("token") || "");
  // A signed payload cannot carry brackets or whitespace (the signup route
  // validated the address before signing), but the marker parser is reason
  // enough to check again.
  if (!payload || /[\[\]\s]/.test(payload.email)) {
    return page(newsletterPage("Couldn't confirm", tamperedBodyHtml("The confirmation link")), 400);
  }
  const email = payload.email;
  const name = (payload.name || "").replace(/[\[\]\r\n]+/g, " ").trim().slice(0, 60);

  const cleared = await clearNewsletterUnsub(email);
  const marked = cleared && (await postSignupMarker(email, name));
  if (!cleared || !marked) {
    return page(
      newsletterPage(
        "Not saved yet — please try again",
        `<p>Your link is fine, but we couldn't update the list for ${esc(email)} just now. Please open the link again in a minute, or email ${SUPPORT_LINK_HTML} and we'll add you back by hand.</p>`,
      ),
      500,
    );
  }
  return page(
    newsletterPage(
      "You're back on the list",
      `<p>${esc(email)} will get Top Cash Cellular emails again — price moves and the occasional real promo, never filler. Changed your mind later? Every email has a one-click unsubscribe link.</p>`,
    ),
    200,
  );
}
