import { NextRequest, NextResponse } from "next/server";

const MC_API = "https://missioncontrolsdjg-production.up.railway.app";
const MC_KEY = process.env.MC_API_KEY || "";
const TWILIO_SID = process.env.TWILIO_ACCOUNT_SID || "";
const TWILIO_AUTH = process.env.TWILIO_AUTH_TOKEN || "";
const TWILIO_FROM = process.env.TWILIO_PHONE || "+18775492056";
const OWNER_PHONE = process.env.OWNER_PHONE || "+15129609256";
const OWNER_EMAIL = process.env.OWNER_EMAIL || "CustomerService@topcashcells.com";

export type Review = {
  id: string;
  name: string;
  rating: number;
  title?: string;
  body: string;
  device?: string;
  city?: string;
  createdAt: string;
  // ✓ Verified Seller — true means the submission came through the
  // token gate after a Paid/Met flip, or staff manually verified the
  // entry (PATCH /api/reviews via MC). Display layer renders a badge.
  verified?: boolean;
};

export async function GET() {
  try {
    const r = await fetch(`${MC_API}/api/reviews?limit=200`, {
      headers: { "x-api-key": MC_KEY },
      cache: "no-store",
    });
    const data = await r.json();
    return NextResponse.json({ reviews: data.reviews || [], count: data.count || 0, avg: data.avg || 0 });
  } catch (e) {
    return NextResponse.json({ reviews: [], count: 0, avg: 0, error: String(e) }, { status: 200 });
  }
}

// Direct owner notification — SMS to Skywalker's phone + email to the
// customer-service inbox. Fired in parallel with MC's [NEW CUSTOMER
// REVIEW] comms message (which gets evicted after 200 newer comms).
// Skywalker 2026-05-18 "make sure they get the review link, it goes
// to the site, AND notify us". Best-effort: failures here don't
// break the review submission.
async function notifyOwner(review: { name: string; rating: number; body: string; device?: string; city?: string; title?: string }) {
  const stars = "★".repeat(review.rating) + "☆".repeat(5 - review.rating);
  const lowRating = review.rating <= 3;
  const subject = `${lowRating ? "⚠️ LOW " : ""}★ New ${review.rating}/5 review from ${review.name} — Top Cash`;
  const excerpt = review.body.slice(0, 140) + (review.body.length > 140 ? "…" : "");
  const ownerSms = `${lowRating ? "⚠️ LOW " : ""}TopCash review ${stars} from ${review.name}${review.device ? ` (${review.device})` : ""}: "${excerpt}"`;

  // SMS — wraps the Twilio call so a single bad call doesn't break the
  // email send. Owner phone is hardcoded fallback above.
  if (TWILIO_SID && TWILIO_AUTH) {
    try {
      await fetch(`https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`, {
        method: "POST",
        headers: {
          "Authorization": "Basic " + Buffer.from(`${TWILIO_SID}:${TWILIO_AUTH}`).toString("base64"),
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({ To: OWNER_PHONE, From: TWILIO_FROM, Body: ownerSms.slice(0, 480) }),
      });
    } catch {}
  }

  // Email — full review body + a link to /reviews so Skywalker can
  // open + delete (if it's spam) in one click.
  if (process.env.RESEND_API_KEY) {
    try {
      const { Resend } = await import("resend");
      const resend = new Resend(process.env.RESEND_API_KEY);
      const accent = lowRating ? "#ff5566" : "#ffb400";
      const html = `<!doctype html><html><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;background:#0a0a0a;color:#e6e6e6;margin:0;padding:32px 16px"><div style="max-width:600px;margin:0 auto;background:#0f0f0f;border:1px solid rgba(255,255,255,0.08);border-radius:18px;overflow:hidden"><div style="background:linear-gradient(135deg,${accent} 0%,#b07900 100%);padding:24px 28px;color:#1a1100"><div style="font-size:11px;font-weight:800;letter-spacing:0.18em;text-transform:uppercase;opacity:0.7;margin-bottom:4px">Top Cash Cellular · Owner alert</div><div style="font-size:22px;font-weight:800;line-height:1.1">${lowRating ? "⚠️ Low-rating review" : "★ New customer review"}</div></div><div style="padding:28px"><div style="font-size:32px;color:${accent};line-height:1;margin-bottom:8px">${stars}</div><p style="font-size:18px;color:#fff;font-weight:700;margin:0 0 6px">${review.name}${review.city ? ` <span style="font-weight:400;color:#888">· ${review.city}</span>` : ""}</p>${review.device ? `<p style="font-size:13px;color:#888;margin:0 0 14px">Sold: ${review.device}</p>` : ""}${review.title ? `<p style="font-size:16px;color:#fff;font-weight:700;margin:0 0 8px">${review.title}</p>` : ""}<p style="font-size:15px;line-height:1.6;color:#e6e6e6;margin:0 0 22px;white-space:pre-wrap">${review.body}</p><div style="text-align:center"><a href="https://topcashcellular.com/reviews" style="display:inline-block;padding:12px 24px;background:linear-gradient(180deg,#00e676 0%,#00c853 60%,#00a039 100%);color:#0a0a0a;font-weight:800;font-size:13px;text-decoration:none;border-radius:999px">View all reviews</a></div></div></div></body></html>`;
      const text = `${subject}\n\n${stars}\n${review.name}${review.city ? ` · ${review.city}` : ""}\n${review.device ? `Sold: ${review.device}\n` : ""}${review.title ? `\n${review.title}\n` : ""}\n${review.body}\n\nhttps://topcashcellular.com/reviews`;
      await resend.emails.send({
        from: "Top Cash Cellular <noreply@topcashcellular.com>",
        replyTo: "CustomerService@topcashcells.com",
        to: OWNER_EMAIL,
        subject,
        html,
        text,
      });
    } catch {}
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const token = String(body.token || "").trim();

  // STRICT GATE — Skywalker 2026-05-18 "BE STRICT. Random people can't
  // see review page. Even if customer checkout, if not marked paid,
  // can't review". Token is required. Token must verify (in-paid/met
  // status + not expired + not previously used). No token, no review.
  if (!token || token.length < 32) {
    return NextResponse.json({ error: "Review submissions require a verified link from your trade confirmation email." }, { status: 401 });
  }
  let verification: { valid?: boolean; leadId?: string; error?: string };
  try {
    const origin = new URL(req.url).origin;
    const v = await fetch(`${origin}/api/reviews/verify-token?token=${encodeURIComponent(token)}`, { cache: "no-store" });
    verification = await v.json();
    if (!v.ok || !verification.valid) {
      return NextResponse.json({ error: verification.error || "Invalid or expired review link" }, { status: 401 });
    }
  } catch {
    return NextResponse.json({ error: "Could not verify review link. Try again in a moment." }, { status: 502 });
  }

  try {
    // Stamp verified:true + the leadId on the upstream payload. The
    // caller has already validated the token + lead-is-paid-or-met
    // via /api/reviews/verify-token, so we have a trustworthy
    // leadId in `verification`. MC trusts the payload because the
    // call uses MC_API_KEY. Token-gated submissions land with the
    // verified badge AND attribute to the right lead in /admin.
    const r = await fetch(`${MC_API}/api/reviews`, {
      method: "POST",
      headers: { "x-api-key": MC_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ ...body, verified: true, leadId: verification.leadId }),
    });
    const data = await r.json();
    if (!r.ok) return NextResponse.json({ error: data.error || "Submission failed." }, { status: r.status });

    // Burn the token — post a [REVIEW-USED: token=X] marker so this
    // token can never submit again. The verify-token endpoint refuses
    // any submission once this marker exists.
    fetch(`${MC_API}/api/comms`, {
      method: "POST",
      headers: { "x-api-key": MC_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "tcc-admin",
        fromName: "TCC Admin",
        role: "system",
        body: `[REVIEW-USED: ${token}] leadId=${verification.leadId || ""} reviewId=${data.review?.id || ""}`,
        tags: ["review-token", "used"],
        priority: "low",
      }),
    }).catch(() => {});

    // Fire owner notification after MC accepts the review. Don't await —
    // customer should see thank-you immediately, owner notif can land in
    // the background. Resolves to undefined on error (caught inside).
    notifyOwner({
      name: String(body.name || "").trim(),
      rating: Number(body.rating) || 0,
      body: String(body.body || "").trim(),
      device: body.device ? String(body.device).trim() : undefined,
      city: body.city ? String(body.city).trim() : undefined,
      title: body.title ? String(body.title).trim() : undefined,
    }).catch(() => {});
    return NextResponse.json({ ok: true, id: data.review?.id });
  } catch (e) {
    return NextResponse.json({ error: "Network error. Please try again." }, { status: 502 });
  }
}
