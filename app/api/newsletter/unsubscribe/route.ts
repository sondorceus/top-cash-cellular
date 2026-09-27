// Customer-facing 1-click unsubscribe. Verifies the HMAC-signed token
// then posts a [NEWSLETTER UNSUB] marker to MC. The subscriber-list
// builder in /api/admin/newsletter checks for that marker and excludes
// matching emails from future broadcasts.
//
// Supports both GET (link click from email — most clients open in a
// new tab) and POST (RFC-8058 "List-Unsubscribe=One-Click" header).
// GET response is a friendly confirmation page.

import { NextRequest, NextResponse } from "next/server";
import { esc as shellEsc } from "../../../lib/email-shell";
import { verifyNewsletterToken } from "../../../lib/newsletter-token";
import { markNewsletterUnsub } from "../../../lib/newsletter-unsub";
import { newsletterPage, tamperedBodyHtml } from "../../../lib/newsletter-page";

const MC_API = "https://missioncontrolsdjg-production.up.railway.app";
const MC_KEY = process.env.MC_API_KEY || "";

async function postUnsubMarker(email: string): Promise<boolean> {
  // Durable copy first (2026-09-26): the blob outlives every comms window
  // (a marker older than the reader's window used to be forgotten and the
  // address mailed again); the marker stays as the audit trail. Either
  // landing counts as recorded — the send route checks the blob. The MC post
  // is bounded (2026-09-27; it had no timeout at all) and a false here means
  // NEITHER landed, which the page now says instead of "You're unsubscribed".
  const durable = await markNewsletterUnsub(email);
  if (!MC_KEY) return durable;
  try {
    const r = await fetch(`${MC_API}/api/comms`, {
      method: "POST",
      headers: { "x-api-key": MC_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "topcash-web",
        fromName: "Top Cash Cellular",
        role: "system",
        body: `[NEWSLETTER UNSUB] email=${email}`,
        tags: ["newsletter", "unsubscribe"],
        priority: "low",
      }),
      signal: AbortSignal.timeout(8_000),
    });
    return r.ok || durable;
  } catch {
    return durable;
  }
}

// done = recorded; bad-token = the link failed verification; not-recorded =
// a good link but neither the blob nor the marker could be written (2026-09-27).
type UnsubOutcome = "done" | "bad-token" | "not-recorded";

function confirmationHtml(email: string, outcome: UnsubOutcome): string {
  const title = outcome === "done" ? "You're unsubscribed" : outcome === "not-recorded" ? "Not saved yet — please try again" : "Couldn't unsubscribe";
  const body = outcome === "done"
    ? `<p>${shellEsc(email)} won't get any more emails from Top Cash Cellular. Changed your mind later? <a href="https://topcashcellular.com" style="color:#00c853;text-decoration:none;font-weight:600">Re-subscribe at our home page</a>.</p>`
    : outcome === "not-recorded"
      ? `<p>Your link is fine, but we couldn't save the opt-out for ${shellEsc(email)} just now. Please tap the link again in a minute, or email <a href="mailto:support@topcashcellular.com" style="color:#00c853;text-decoration:none;font-weight:600">support@topcashcellular.com</a> and we'll remove you by hand.</p>`
      : tamperedBodyHtml("The unsubscribe link");
  // Shared shell (2026-09-27) — the re-subscribe confirmation renders the same page.
  return newsletterPage(title, body);
}

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token") || "";
  const payload = verifyNewsletterToken(token);
  if (!payload) {
    return new NextResponse(confirmationHtml("", "bad-token"), {
      status: 400,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }
  // The page tells the truth (2026-09-27): it used to say "You're
  // unsubscribed" even when nothing had been written anywhere.
  const recorded = await postUnsubMarker(payload.email);
  return new NextResponse(confirmationHtml(payload.email, recorded ? "done" : "not-recorded"), {
    status: recorded ? 200 : 500,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

export async function POST(req: NextRequest) {
  // RFC-8058 One-Click — Gmail/Outlook send `List-Unsubscribe=One-Click`
  // as form-encoded body when the user hits the inbox unsubscribe button.
  // We accept the token from the query string regardless, since some
  // clients still pass it that way.
  const token =
    req.nextUrl.searchParams.get("token") ||
    (await (async () => {
      try {
        const form = await req.formData();
        return String(form.get("token") || "");
      } catch {
        return "";
      }
    })());
  const payload = verifyNewsletterToken(token);
  if (!payload) {
    return NextResponse.json({ ok: false, error: "Invalid token" }, { status: 400 });
  }
  const ok = await postUnsubMarker(payload.email);
  // Non-2xx when nothing landed (2026-09-27) — an honest signal to the
  // mailbox provider's one-click POST instead of a 200 that recorded nothing.
  return NextResponse.json(ok ? { ok, email: payload.email } : { ok, email: payload.email, error: "Could not record the unsubscribe — try again" }, { status: ok ? 200 : 500 });
}
