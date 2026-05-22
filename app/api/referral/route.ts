// GET /api/referral — the logged-in customer's referral dashboard data.
// Skywalker 2026-05-22 referral program.
//
// Authenticates exactly like /api/account/me (tcc_session Google
// cookie OR tcc_customer email cookie — getCustomerSessionFromCookies
// handles both). Returns the caller's deterministic referral code,
// their share link, total dollars earned, and how many friends they've
// referred — all derived by scanning MC comm markers, since there's no
// database.
//
// On first call for a customer we also POST a [REFERRAL-CODE:] marker
// so the lead route can later resolve code → owner email. The code
// itself is deterministic (SHA-256 of the email) so it doesn't NEED
// storing — the marker exists purely as a reverse-lookup index.

import { NextResponse } from "next/server";
import { getCustomerSessionFromCookies } from "../../lib/auth";
import { referralCodeForEmail, referralLinkForCode } from "../../lib/referral";

const MC_API = "https://missioncontrolsdjg-production.up.railway.app";
const MC_KEY = process.env.MC_API_KEY || "";

type MCMessage = { id?: string; body?: string; timestamp: string };

export async function GET() {
  const session = await getCustomerSessionFromCookies();
  if (!session) {
    return NextResponse.json({ authenticated: false }, {
      headers: { "Cache-Control": "no-store" },
    });
  }
  const email = session.email.toLowerCase().trim();
  const code = referralCodeForEmail(email);
  const link = referralLinkForCode(code);

  // Without MC we can still hand the customer their code + link (both
  // are deterministic, no lookup needed) — just no earnings stats and
  // no marker post. Fail soft so the dashboard still renders.
  if (!MC_KEY) {
    return NextResponse.json({
      authenticated: true,
      code,
      link,
      earned: 0,
      referralCount: 0,
    }, { headers: { "Cache-Control": "no-store" } });
  }

  // Pull recent MC comms. 1000 covers months of referral activity —
  // same limit the fedex-poll + account routes use.
  let messages: MCMessage[] = [];
  try {
    const r = await fetch(`${MC_API}/api/comms?limit=1000`, {
      headers: { "x-api-key": MC_KEY },
      cache: "no-store",
    });
    if (r.ok) {
      const data = await r.json();
      messages = Array.isArray(data.messages) ? data.messages : [];
    }
  } catch {
    // MC unreachable — still return the code + link so the customer
    // can share; earnings just show as 0 until MC recovers.
  }

  // Scan once for: (a) whether this customer's [REFERRAL-CODE:] marker
  // already exists, and (b) every [REFERRAL-EARNED:] crediting them.
  let codeMarkerExists = false;
  let earned = 0;
  let referralCount = 0;
  for (const m of messages) {
    if (!m.body) continue;
    // The owning marker — matched on this exact code.
    const cm = m.body.match(/\[REFERRAL-CODE:\s*code=(REF-[A-Z0-9]{6})\s+email=([^\s\]]+)/i);
    if (cm && cm[1].toUpperCase() === code) {
      codeMarkerExists = true;
    }
    // Earned markers crediting this referrer.
    const em = m.body.match(/\[REFERRAL-EARNED:\s*referrer=([^\s\]]+)\s+amount=(\d+)/i);
    if (em && em[1].toLowerCase() === email) {
      earned += parseInt(em[2], 10) || 0;
      referralCount += 1;
    }
  }

  // First time this customer hit the page → post their code marker so
  // future referee leads can resolve the code back to this email.
  // Best-effort: a failed post just means we retry on the next visit.
  if (!codeMarkerExists) {
    try {
      await fetch(`${MC_API}/api/comms`, {
        method: "POST",
        headers: { "x-api-key": MC_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: "topcash-web",
          fromName: "Top Cash Cellular",
          role: "system",
          body: `[REFERRAL-CODE: code=${code} email=${email}]`,
          tags: ["referral", "code"],
          priority: "low",
        }),
      });
    } catch {}
  }

  return NextResponse.json({
    authenticated: true,
    code,
    link,
    earned,
    referralCount,
  }, { headers: { "Cache-Control": "no-store" } });
}
