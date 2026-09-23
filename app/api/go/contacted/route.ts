// GET /api/go/contacted?lead=<mcId>&k=<hmac> — the "✅ Mark contacted" pill in
// the owner's lead-alert email. One tap from the phone records that Sonny
// reached out, as a [LEAD-CONTACTED: <id>] marker on MC: the watchdog stops
// nagging go_unworked for that lead and the comm is the audit line.
// Signed (app/lib/lead-token.ts) because it is a mutating GET reachable
// from an inbox; no admin session on purpose — the console is never open
// while he's texting a seller. NOT a status flip: "contacted" is not one of
// the seven pipeline statuses the track/offer/account pages, the crons and
// the admin parser all enumerate, and a [STATUS: contacted] marker would
// ripple through every one of them (it would silently stop the seller
// reminders, for one).
import { NextRequest, NextResponse } from "next/server";
import { leadTokenValid } from "../../../lib/lead-token";
import { clientIp, rateLimit } from "../../../lib/rate-limit";

const MC_API = "https://missioncontrolsdjg-production.up.railway.app";
const MC_KEY = process.env.MC_API_KEY || "";

function page(title: string, body: string, ok: boolean): NextResponse {
  const html =
    `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title></head>` +
    `<body style="margin:0;background:#0b0b0b;color:#fff;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;">` +
    `<div style="max-width:420px;margin:0 auto;padding:56px 20px;text-align:center;">` +
    `<div style="font-size:44px;">${ok ? "✅" : "⚠️"}</div>` +
    `<h1 style="font-size:22px;margin:14px 0 8px;">${title}</h1>` +
    `<p style="color:#bdbdbd;font-size:15px;line-height:1.5;margin:0 0 22px;">${body}</p>` +
    `<a href="https://topcashcellular.com/admin" style="display:inline-block;padding:11px 18px;border-radius:999px;background:#00c853;color:#000;font-weight:800;text-decoration:none;">Open the admin</a>` +
    `</div></body></html>`;
  return new NextResponse(html, {
    status: ok ? 200 : 400,
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "X-Robots-Tag": "noindex" },
  });
}

export async function GET(req: NextRequest) {
  if (!rateLimit(`gocontacted:${clientIp(req)}`, 30, 10 * 60_000).ok) {
    return page("Slow down", "Too many taps — try again in a few minutes.", false);
  }
  const leadId = (req.nextUrl.searchParams.get("lead") || "").trim();
  const k = (req.nextUrl.searchParams.get("k") || "").trim();
  if (!/^[\w-]{1,64}$/.test(leadId) || !leadTokenValid(leadId, k)) {
    return page("Link not valid", "This mark-contacted link is missing or invalid. Open the lead in the admin instead.", false);
  }
  if (!MC_KEY) return page("Not configured", "Mission Control isn't configured on this deployment.", false);
  // leadId matched [\w-] above, so it is safe inside the HTML below.
  const short = leadId.slice(0, 10).toUpperCase();
  let ok = false;
  try {
    const r = await fetch(`${MC_API}/api/comms`, {
      method: "POST",
      headers: { "x-api-key": MC_KEY, "Content-Type": "application/json" },
      signal: AbortSignal.timeout(10_000),
      body: JSON.stringify({
        from: "tcc-admin",
        fromName: "TCC Admin",
        role: "system",
        body: `[LEAD-CONTACTED: ${leadId}] at=${new Date().toISOString()} via=alert-email\n✅ Sonny reached out to this seller (one tap from the lead alert).`,
        tags: ["lead-contacted"],
        priority: "normal",
      }),
    });
    ok = r.ok;
  } catch {
    ok = false;
  }
  return ok
    ? page(`Marked contacted — #${short}`, "The watchdog will leave this one alone. Flip the real status (shipped / met / paid) in the admin when it moves.", true)
    : page("Couldn't save that", `Mission Control didn't take the marker for #${short}. Tap the link again in a minute.`, false);
}
