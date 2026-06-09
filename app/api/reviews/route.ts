import { NextRequest, NextResponse } from "next/server";

const MC_API = "https://missioncontrolsdjg-production.up.railway.app";
const MC_KEY = process.env.MC_API_KEY || "";
const TWILIO_SID = process.env.TWILIO_ACCOUNT_SID || "";
const TWILIO_AUTH = process.env.TWILIO_AUTH_TOKEN || "";
const TWILIO_FROM = process.env.TWILIO_PHONE || "";
const OWNER_PHONE = process.env.OWNER_PHONE || "+15129609256";
const OWNER_EMAIL = process.env.OWNER_EMAIL || "support@topcashcellular.com";

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
  // Customer-controlled review fields get interpolated into the owner
  // alert email HTML — escape them so a review can't inject markup/links
  // into the owner's inbox.
  const esc = (s: unknown) => String(s ?? "").replace(/[<>&]/g, (ch) => (ch === "<" ? "&lt;" : ch === ">" ? "&gt;" : "&amp;"));
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
      const html = `<!doctype html><html><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;background:#13142b;color:#e6e6e6;margin:0;padding:32px 16px"><div style="max-width:600px;margin:0 auto;background:#1b1d39;border:1px solid rgba(255,255,255,0.08);border-radius:18px;overflow:hidden"><div style="background:linear-gradient(135deg,${accent} 0%,#b07900 100%);padding:24px 28px;color:#1a1100"><div style="font-size:11px;font-weight:800;letter-spacing:0.18em;text-transform:uppercase;opacity:0.7;margin-bottom:4px">Top Cash Cellular · Owner alert</div><div style="font-size:22px;font-weight:800;line-height:1.1">${lowRating ? "⚠️ Low-rating review" : "★ New customer review"}</div></div><div style="padding:28px"><div style="font-size:32px;color:${accent};line-height:1;margin-bottom:8px">${stars}</div><p style="font-size:18px;color:#fff;font-weight:700;margin:0 0 6px">${esc(review.name)}${review.city ? ` <span style="font-weight:400;color:#888">· ${esc(review.city)}</span>` : ""}</p>${review.device ? `<p style="font-size:13px;color:#888;margin:0 0 14px">Sold: ${esc(review.device)}</p>` : ""}${review.title ? `<p style="font-size:16px;color:#fff;font-weight:700;margin:0 0 8px">${esc(review.title)}</p>` : ""}<p style="font-size:15px;line-height:1.6;color:#e6e6e6;margin:0 0 22px;white-space:pre-wrap">${esc(review.body)}</p><div style="text-align:center"><a href="https://topcashcellular.com/reviews" style="display:inline-block;padding:12px 24px;background:linear-gradient(180deg,#00c853 0%,#00c853 60%,#00a039 100%);color:#0a0a0a;font-weight:800;font-size:13px;text-decoration:none;border-radius:999px">View all reviews</a></div></div></div></body></html>`;
      const text = `${subject}\n\n${stars}\n${review.name}${review.city ? ` · ${review.city}` : ""}\n${review.device ? `Sold: ${review.device}\n` : ""}${review.title ? `\n${review.title}\n` : ""}\n${review.body}\n\nhttps://topcashcellular.com/reviews`;
      await resend.emails.send({
        from: "Top Cash Cellular <noreply@topcashcellular.com>",
        replyTo: "support@topcashcellular.com",
        to: OWNER_EMAIL,
        subject,
        html,
        text,
      });
    } catch {}
  }
}

// Customer-side coupon email — fires the moment the review is stored
// AND the coupon is minted. Skywalker 2026-05-18 "$25 added to
// whatever device they sell in the future". Best-effort: failures
// don't break submission; customer also sees the code on
// /reviews/thank-you and the code is bound to their email so they
// can always email us to retrieve it.
async function mailCoupon(opts: { to: string; firstName: string; code: string; value: number; expiresAt: string }) {
  if (!process.env.RESEND_API_KEY) return false;
  try {
    const { Resend } = await import("resend");
    const resend = new Resend(process.env.RESEND_API_KEY);
    const expDate = new Date(opts.expiresAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
    const subject = `Your $${opts.value} thank-you coupon — ${opts.code}`;
    const html = `<!doctype html><html><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;background:#13142b;color:#e6e6e6;margin:0;padding:32px 16px">
<div style="max-width:600px;margin:0 auto;background:#1b1d39;border:1px solid rgba(255,255,255,0.08);border-radius:18px;overflow:hidden;box-shadow:0 10px 30px rgba(0,0,0,0.5)">
  <div style="background:linear-gradient(135deg,#ffd54f 0%,#ffb400 60%,#e69900 100%);padding:24px 28px;color:#1a1100">
    <img src="https://topcashcellular.com/logo-wordmark-glass.png" alt="Top Cash Cellular" width="150" style="display:block;width:150px;height:auto;border:0;outline:none;margin:0" />
    <div style="font-size:22px;font-weight:800;line-height:1.1">Thanks for the review — here's $${opts.value} for next time</div>
  </div>
  <div style="padding:28px">
    <p style="margin:0 0 14px;font-size:16px;color:#fff;font-weight:700">Hi ${opts.firstName},</p>
    <p style="margin:0 0 18px;font-size:15px;line-height:1.7;color:#e6e6e6">Genuinely appreciate you taking 30 seconds to share your experience. As a small thanks, here's a $${opts.value} bonus you can apply to your next trade with us — no minimum, no fine print, just $${opts.value} added to whatever device you sell next.</p>
    <div style="background:rgba(255,180,0,0.08);border:2px dashed rgba(255,180,0,0.5);border-radius:14px;padding:22px;margin:0 0 20px;text-align:center">
      <div style="font-size:10px;letter-spacing:0.2em;text-transform:uppercase;color:#ffd54f;font-weight:800;margin-bottom:8px">Your code</div>
      <div style="font-size:28px;font-family:ui-monospace,'SF Mono',monospace;font-weight:800;color:#fff;letter-spacing:0.12em">${opts.code}</div>
      <div style="font-size:12px;color:#bdbdbd;margin-top:10px">Expires ${expDate} · One use · Bound to ${opts.to}</div>
    </div>
    <p style="margin:0 0 14px;font-size:14px;line-height:1.65;color:#dcdcdc">Just paste this code when you're checking out your next trade — we'll add $${opts.value} to whatever your offer is. The code only works with the email above, so it can't be passed around (we'd rather give YOU a fresh one next time than reward a stranger).</p>
    <div style="text-align:center;margin:24px 0 8px"><a href="https://topcashcellular.com" style="display:inline-block;padding:13px 28px;background:linear-gradient(180deg,#00c853 0%,#00c853 60%,#00a039 100%);color:#0a0a0a;font-weight:800;font-size:14px;text-decoration:none;border-radius:999px">Get a quote →</a></div>
    <p style="margin:18px 0 0;font-size:14px;color:#e6e6e6;line-height:1.6">— The Top Cash Cellular team<br><span style="color:#888;font-size:12px">Austin, TX · a small business · real humans</span></p>
    <div style="margin:24px 0 0;padding-top:18px;border-top:1px solid rgba(255,255,255,0.08);font-size:12px;color:#888;line-height:1.6;text-align:center">Lost this email? Reply or write to <a href="mailto:support@topcashcellular.com" style="color:#00c853;text-decoration:none;font-weight:600">support@topcashcellular.com</a> and we'll resend.</div>
  </div>
</div></body></html>`;
    const text = `Hi ${opts.firstName},\n\nThanks for the review — here's $${opts.value} added to your next trade.\n\nYour code: ${opts.code}\nExpires: ${expDate}\nOne use · Bound to ${opts.to}\n\nPaste it at checkout next time you sell to us and we'll add $${opts.value} to whatever your offer is.\n\nGet a quote: https://topcashcellular.com\n\n— The Top Cash Cellular team\nAustin, TX`;
    const r = await resend.emails.send({
      from: "Top Cash Cellular <noreply@topcashcellular.com>",
      replyTo: "support@topcashcellular.com",
      to: opts.to,
      subject,
      html,
      text,
    });
    return !!(r?.data?.id);
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const token = String(body.token || "").trim();

  // STRICT GATE — Skywalker 2026-05-18 "BE STRICT. Random people can't
  // see review page. Even if customer checkout, if not marked paid,
  // can't review". Token is required. Token must verify (in-paid/met
  // status + not expired + not previously used). No token, no review.
  if (!token || token.length < 32) {
    return NextResponse.json({ error: "Review submissions require a verified link from your trade confirmation email." }, { status: 401 });
  }
  let verification: { valid?: boolean; leadId?: string; error?: string; email?: string; phone?: string; name?: string };
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

  // One review reward per completed trade. A single lead can accrue more
  // than one review token (staff flipping paid→met, or re-flipping, mints
  // a fresh token each time) and the coupon mint only de-dupes by reviewId
  // — so without this gate a customer could submit a review off each token
  // and collect a $25 code every time. If this lead already has a reward
  // coupon, refuse the duplicate submission. Best-effort: if the lookup
  // fails we fall through rather than block a legitimate first review.
  if (verification.leadId) {
    try {
      const cc = await fetch(`${MC_API}/api/coupons`, { headers: { "x-api-key": MC_KEY }, cache: "no-store" });
      if (cc.ok) {
        const cj = await cc.json();
        const already = (cj.coupons || []).find(
          (c: { leadId?: string; status?: string }) => c.leadId === verification.leadId && c.status !== "revoked",
        );
        if (already) {
          return NextResponse.json(
            { error: "You've already submitted a review for this trade — thank you! Your reward code was emailed to you." },
            { status: 409 },
          );
        }
      }
    } catch { /* non-fatal — allow the first review through */ }
  }

  // Clamp rating to an integer 1-5 before it's stored or rendered. An
  // out-of-range value skews the public average on /reviews and throws a
  // RangeError inside "★".repeat() in notifyOwner (which, being caught,
  // silently drops the owner alert for that review). (bug fix)
  const safeRating = Math.max(1, Math.min(5, Math.round(Number(body.rating) || 0)));

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
      body: JSON.stringify({ ...body, rating: safeRating, verified: true, leadId: verification.leadId }),
    });
    const data = await r.json();
    if (!r.ok) return NextResponse.json({ error: data.error || "Submission failed." }, { status: r.status });

    // Burn the token — post a [REVIEW-USED: token=X] marker so this
    // token can never submit again. The verify-token endpoint refuses
    // any submission once this marker exists. AWAIT it (was fire-and-
    // forget) so the marker is durably posted before we return — a
    // sequential retry/double-click then sees it and is blocked. (Truly
    // concurrent submits still need MC-side atomic single-use; noted.) (bug fix)
    await fetch(`${MC_API}/api/comms`, {
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

    // Mint the $25 review-reward coupon. Bound to the customer's
    // email + phone (from the verified lead) so it can't be sold.
    // Skywalker 2026-05-18 "$25 added to whatever device they sell in
    // the future". MC's POST /api/coupons de-dupes by reviewId so a
    // retry never mints twice. We DO await so we can include the
    // code in the response — the /reviews/thank-you page shows it.
    let coupon: { code?: string; value?: number; expiresAt?: string } | undefined;
    try {
      const cr = await fetch(`${MC_API}/api/coupons`, {
        method: "POST",
        headers: { "x-api-key": MC_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({
          reviewId: data.review?.id,
          leadId: verification.leadId,
          name: String(body.name || verification.name || "").trim(),
          email: verification.email,
          phone: verification.phone,
          value: 25,
        }),
      });
      if (cr.ok) {
        const cd = await cr.json();
        if (cd?.coupon?.code) {
          coupon = { code: cd.coupon.code, value: cd.coupon.value, expiresAt: cd.coupon.expiresAt };
          // Send the coupon to the customer via email — best-effort.
          // Owner-side notify already fired separately above.
          if (verification.email) {
            mailCoupon({
              to: verification.email,
              firstName: (verification.name || body.name || "there").split(" ")[0],
              code: coupon.code as string,
              value: coupon.value || 25,
              expiresAt: coupon.expiresAt as string,
            }).catch(() => {});
          }
        }
      }
    } catch {}

    return NextResponse.json({ ok: true, id: data.review?.id, coupon });
  } catch (e) {
    return NextResponse.json({ error: "Network error. Please try again." }, { status: 502 });
  }
}
