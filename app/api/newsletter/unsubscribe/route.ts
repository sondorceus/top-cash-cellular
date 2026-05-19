// Customer-facing 1-click unsubscribe. Verifies the HMAC-signed token
// then posts a [NEWSLETTER UNSUB] marker to MC. The subscriber-list
// builder in /api/admin/newsletter checks for that marker and excludes
// matching emails from future broadcasts.
//
// Supports both GET (link click from email — most clients open in a
// new tab) and POST (RFC-8058 "List-Unsubscribe=One-Click" header).
// GET response is a friendly confirmation page.

import { NextRequest, NextResponse } from "next/server";
import { verifyNewsletterToken } from "../../../lib/newsletter-token";

const MC_API = "https://missioncontrolsdjg-production.up.railway.app";
const MC_KEY = process.env.MC_API_KEY || "";

async function postUnsubMarker(email: string): Promise<boolean> {
  if (!MC_KEY) return false;
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
    });
    return r.ok;
  } catch {
    return false;
  }
}

function confirmationHtml(email: string, success: boolean): string {
  const title = success ? "You're unsubscribed" : "Couldn't unsubscribe";
  const body = success
    ? `<p>${email} won't get any more emails from Top Cash Cellular. Changed your mind later? <a href="https://topcashcellular.com" style="color:#00c853;text-decoration:none;font-weight:600">Re-subscribe at our home page</a>.</p>`
    : `<p>The unsubscribe link looks tampered or expired. Email <a href="mailto:CustomerService@topcashcells.com" style="color:#00c853;text-decoration:none;font-weight:600">CustomerService@topcashcells.com</a> and we'll handle it manually.</p>`;
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title></head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#e6e6e6">
<div style="min-height:100vh;display:flex;align-items:center;justify-content:center;padding:32px 16px">
<div style="max-width:520px;width:100%;background:#0f0f0f;border:1px solid rgba(255,255,255,0.08);border-radius:18px;overflow:hidden;text-align:center">
<div style="background:${success ? "linear-gradient(135deg,#00e676 0%,#00a039 100%)" : "linear-gradient(135deg,#ff5252 0%,#a31515 100%)"};padding:24px 28px;color:#0a0a0a">
<div style="font-size:11px;font-weight:800;letter-spacing:0.18em;text-transform:uppercase;opacity:0.7;margin-bottom:4px">Top Cash Cellular</div>
<div style="font-size:22px;font-weight:800;line-height:1.1">${title}</div>
</div>
<div style="padding:28px;font-size:15px;line-height:1.6;color:#dcdcdc">
${body}
</div>
<div style="padding:18px 28px 24px;border-top:1px solid rgba(255,255,255,0.06);font-size:12px;color:#888">
Top Cash Cellular · Austin, TX
</div>
</div>
</div></body></html>`;
}

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token") || "";
  const payload = verifyNewsletterToken(token);
  if (!payload) {
    return new NextResponse(confirmationHtml("", false), {
      status: 400,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }
  await postUnsubMarker(payload.email);
  return new NextResponse(confirmationHtml(payload.email, true), {
    status: 200,
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
  return NextResponse.json({ ok, email: payload.email });
}
