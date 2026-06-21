import { NextRequest, NextResponse } from "next/server";
import { mailLogo } from "../../lib/email-shell";
import { reportError } from "../../lib/error-report";
import { formatOfferNumber } from "../../lib/offer-number";
import { clientIp, rateLimit, rateLimitResponse } from "../../lib/rate-limit";

const TWILIO_SID = process.env.TWILIO_ACCOUNT_SID || "";
const TWILIO_AUTH = process.env.TWILIO_AUTH_TOKEN || "";
const TWILIO_FROM = process.env.TWILIO_PHONE || "";

// Review-platform links shown in the email footer. TCC has no social
// media, but does have Trustpilot + Yelp. Both env-overridable so the
// exact profile URLs can be set in Vercel without a redeploy — the
// Trustpilot default uses the standard /review/<domain> format, Yelp
// has no predictable slug so it only renders once YELP_URL is set.
// Skywalker 2026-05-19.
const TRUSTPILOT_URL = process.env.TRUSTPILOT_URL || "https://www.trustpilot.com/review/topcashcellular.com";
const YELP_URL = process.env.YELP_URL || "https://www.yelp.com/biz/top-cash-cellular-austin";

async function sendSms(to: string, body: string): Promise<boolean> {
  if (!TWILIO_SID || !TWILIO_AUTH) return false;
  const digits = to.replace(/\D/g, "");
  const e164 = digits.length === 10 ? `+1${digits}` : digits.length === 11 && digits.startsWith("1") ? `+${digits}` : null;
  if (!e164) return false;
  try {
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`, {
      method: "POST",
      headers: {
        "Authorization": "Basic " + Buffer.from(`${TWILIO_SID}:${TWILIO_AUTH}`).toString("base64"),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ To: e164, From: TWILIO_FROM, Body: body }),
    });
    return res.ok;
  } catch { return false; }
}

export async function POST(req: NextRequest) {
  // Rate-limit: this endpoint sends mail (Resend) + SMS (Twilio) to a
  // body-supplied recipient with body-supplied content. Without a cap it's an
  // email/SMS-bomb + phishing relay from our verified domain. Match the
  // public lead route's per-IP budget. (bug fix)
  const rlIp = clientIp(req);
  const rl = rateLimit(`confirm:${rlIp}`, 8, 5 * 60_000);
  if (!rl.ok) return rateLimitResponse(rl.retryAfterMs, "Too many confirmations — please wait a few minutes.");
  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }
  const { name, email, phone, devices, handoffMethod, fedexLabel, leadId } = body;
  let { payout } = body;
  // Coupon bonus ($) applied at submission — surfaced as its own line
  // in the receipt breakdown ("Coupon Bonus +$5"). Optional; 0/absent
  // means no coupon and the line is hidden. Skywalker 2026-05-19.
  const couponBonus = Number(body?.couponBonus) > 0 ? Math.round(Number(body.couponBonus)) : 0;
  // fedexLabel = { tracking, url, service } when /api/lead minted a label.
  // Only ship handoffs get one — local meetups stay on the existing copy.
  //
  // SECURITY: validate the URL is OUR Vercel blob domain before
  // inserting it into the customer email. Without this check an
  // attacker can call /api/confirm with email=victim and
  // fedexLabel.url=http://evil-phish.com/label.pdf, and Resend would
  // send a phishing email from our verified domain. We mint labels to
  // a fixed Vercel blob path (fedex-labels/...pdf); anything else is
  // either tampered or stale. Tracking similarly restricted to the
  // shape FedEx actually returns (digits + a few letters).
  const isVercelBlobUrl = (u: unknown): u is string =>
    typeof u === "string" &&
    /^https:\/\/[a-z0-9]+\.public\.blob\.vercel-storage\.com\/fedex-labels\/[\w.\-/]+\.pdf$/i.test(u);
  const isValidTracking = (t: unknown): t is string =>
    typeof t === "string" && /^[A-Z0-9]{8,30}$/i.test(t);
  const labelUrlOk = !!fedexLabel && isVercelBlobUrl(fedexLabel.url);
  const labelTrackingOk = !!fedexLabel && isValidTracking(fedexLabel.tracking);
  // "mixed" carts contain both ship + local items. For email-section
  // purposes, treat anything that produced a real FedEx label as
  // ship-bearing; mixed adds a parallel local section. isMixed callers
  // should branch on both flags rather than just isShipping.
  const isMixed = handoffMethod === "mixed";
  const isShipping = handoffMethod === "ship" || isMixed;
  const hasLabel = (isShipping || isMixed) && labelUrlOk && labelTrackingOk;
  // Defensive: even if a stale client somehow sent payout="Cash" for a
  // ship handoff, the email should NEVER display "Cash" since we can't
  // mail physical cash. Coerce to "Cash App". Skywalker 2026-05-18.
  if (isShipping && typeof payout === "string" && payout.trim().toLowerCase() === "cash") {
    payout = "Cash App";
  }
  // Single-device fields fall back when no `devices` array is present.
  let { model, storage, condition, quote } = body;
  // Multi-device confirmation — collapse to a single visible "device"
  // row (the headline) and override the offer total. Skywalker 2026-05-17:
  // "when I submit it only shows 1 device on both the page confirmation
  // and on email it should reflect multiple".
  const deviceArr: Array<{ model?: string; storage?: string; condition?: string; quote?: number; quantity?: number }> =
    Array.isArray(devices) ? devices : [];
  const isMulti = deviceArr.length > 1;
  if (isMulti) {
    // d.quote is already the line total (price × qty) — the funnel sends
    // `quote: it.price * it.quantity`. Do NOT multiply by quantity again
    // or the emailed grand total is inflated (e.g. 2× a $100 item → $400).
    quote = deviceArr.reduce((s, d) => s + (Number(d.quote) || 0), 0);
    model = `${deviceArr.length} devices`;
    storage = "Multiple";
    condition = "See list below";
  }
  // Device offer + coupon bonus = offer total. The big headline number
  // shows the TOTAL the customer walks away with; the breakdown rows
  // itemize device subtotal / coupon / free shipping below it.
  const deviceSubtotal = Number(quote) || 0;
  const offerTotal = deviceSubtotal + couponBonus;
  // Pending / manual-quote leads (inquiry-only devices like Intel MacBooks,
  // below-minimum, broken) submit with a $0 total — there is no instant
  // number yet. Without this flag the email/SMS told the customer their
  // device was "locked in" at "$0", which reads as worthless and pushed
  // them toward free recycling. Pending leads instead get a "custom quote
  // coming within the hour" message; staff send the real number via the
  // admin adjust/email actions once they price it.
  const isPending = offerTotal <= 0;

  if (!email && !phone) return NextResponse.json({ ok: false, error: "No contact info" });

  // HTML-escape every customer-controlled field before it enters the email
  // HTML body. Combined with the rate limit above, this neutralizes the
  // injected-markup/phishing vector (the other email routes already escape;
  // confirm was the gap). Subject lines + SMS stay raw (not HTML). (bug fix)
  const esc = (v: unknown) => String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const hName = esc(name || "there");
  const hNameNA = esc(name || "N/A");
  const hModel = esc(model);
  const hStorage = esc(storage || "N/A");
  const hCondition = esc(condition);
  const hPayout = esc(payout);
  const hEmail = esc(email);
  const hPhone = esc(phone);

  let emailSent = false;
  let smsSent = false;

  if (email && process.env.RESEND_API_KEY) {
    // Offer number = the REAL lead id (canonical, matches the done screen
    // + offer page + admin search). Falls back to a timestamp only if the
    // funnel somehow didn't pass a leadId (e.g. MC was down at submit).
    const offerNum = formatOfferNumber(typeof leadId === "string" ? leadId : "") || Date.now().toString(36).toUpperCase();
    const offerDate = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    // Digits-only phone for the /track URL query string. Falls back to
    // empty so the template's `phoneDigits || email` ternary picks email.
    const phoneDigits = phone ? phone.replace(/\D/g, "") : "";
    const htmlEmail = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#13142b;font-family:-apple-system,BlinkMacSystemFont,'SF Pro Display','SF Pro Text','Helvetica Neue',Helvetica,Arial,sans-serif;color:#e6e6e6;-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale">
<!-- Outer wrapper — matches the email card background so on desktop
     (Gmail/Outlook web, Resend preview) the email doesn't sit on a
     gray void with empty side margins. Subtle radial highlight at top
     gives depth on wide viewports. Skywalker 2026-05-19 — "looks good
     on mobile but not on desktop". -->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#13142b;background-image:radial-gradient(ellipse 80% 50% at 50% -10%, rgba(99,102,241,0.22) 0%, transparent 62%)">
<tr><td align="center" style="padding:40px 16px">
<table role="presentation" width="640" cellpadding="0" cellspacing="0" border="0" style="max-width:640px;width:100%;margin:0 auto;border-collapse:separate;background:#13142b;border:1px solid rgba(255,255,255,0.08);border-radius:18px;overflow:hidden;box-shadow:0 24px 60px rgba(0,0,0,0.45)">

<!-- Hero header — green gradient with inset rim light -->
<tr><td style="padding:28px 28px;border-bottom:1px solid rgba(255,255,255,0.12)">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
<tr>
<td style="vertical-align:middle">
<div style="margin:0 0 16px">${mailLogo()}</div>
<div style="font-size:24px;font-weight:800;color:#ffffff;line-height:1.15">${isPending ? "Request received" : "You're locked in"}</div>
</td>
<td style="vertical-align:middle;text-align:right">
<div style="display:inline-block;padding:8px 14px;background:rgba(255,255,255,0.10);border:1px solid rgba(255,255,255,0.18);border-radius:999px;font-size:11px;font-weight:800;color:#ffffff;letter-spacing:0.1em;text-transform:uppercase">Austin, TX</div>
</td>
</tr>
</table>
</td></tr>

<!-- Welcome -->
<tr><td style="padding:28px 28px 12px 28px">
<div style="font-size:18px;font-weight:700;color:#fff;margin-bottom:8px">Hi ${hName},</div>
<div style="font-size:14px;color:#bdbdbd;line-height:1.6">Below is everything you need for a successful trade-in. We'll reach out within the hour to set up pickup.</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:14px">
<tr><td style="font-size:11px;color:#777;letter-spacing:0.1em;text-transform:uppercase">Offer #${offerNum}</td><td style="font-size:11px;color:#777;text-align:right;letter-spacing:0.1em;text-transform:uppercase">${offerDate}</td></tr>
</table>
</td></tr>

<!-- Quote card — glass + left accent rim -->
<tr><td style="padding:6px 28px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.10);border-radius:14px">
<tr><td style="padding:22px 24px;text-align:center;border-bottom:1px solid rgba(255,255,255,0.08)">
${isPending ? `<div style="font-size:10px;color:#00c853;text-transform:uppercase;letter-spacing:0.2em;margin-bottom:6px;font-weight:800">Custom Quote</div>
<div style="font-size:26px;font-weight:800;color:#00c853;line-height:1.2;text-shadow:0 0 18px rgba(0,200,83,0.4)">Coming within the hour</div>
<div style="font-size:11px;color:#888;margin-top:10px;letter-spacing:0.08em;text-transform:uppercase">We'll text or email your offer</div>` : `<div style="font-size:10px;color:#00c853;text-transform:uppercase;letter-spacing:0.2em;margin-bottom:6px;font-weight:800">Locked-In Offer</div>
<div style="font-size:48px;font-weight:800;color:#00c853;line-height:1;text-shadow:0 0 18px rgba(0,200,83,0.4)">$${offerTotal}</div>
<div style="font-size:11px;color:#888;margin-top:10px;letter-spacing:0.08em;text-transform:uppercase">Valid for 14 days</div>`}
</td></tr>
<tr><td style="padding:16px 24px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
${isMulti ? deviceArr.map((d) => `<tr><td style="padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.06)"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="padding:0"><div style="color:#fff;font-size:13px;font-weight:700;line-height:1.3">${esc(d.model || "—")}</div><div style="color:#888;font-size:11px;margin-top:2px">${[esc(d.storage), esc(d.condition)].filter(Boolean).join(" · ")}${d.quantity && d.quantity > 1 ? ` · ×${d.quantity}` : ""}</div></td><td style="text-align:right;padding:0"><div style="color:#00c853;font-size:14px;font-weight:800">$${Number(d.quote) || 0}</div></td></tr></table></td></tr>`).join("") : `
<tr><td style="padding:8px 0;color:#888;font-size:13px;border-bottom:1px solid rgba(255,255,255,0.06)">Device</td><td style="padding:8px 0;color:#fff;font-size:13px;text-align:right;border-bottom:1px solid rgba(255,255,255,0.06);font-weight:600">${hModel}</td></tr>
<tr><td style="padding:8px 0;color:#888;font-size:13px;border-bottom:1px solid rgba(255,255,255,0.06)">Storage</td><td style="padding:8px 0;color:#fff;font-size:13px;text-align:right;border-bottom:1px solid rgba(255,255,255,0.06)">${hStorage}</td></tr>
<tr><td style="padding:8px 0;color:#888;font-size:13px;border-bottom:1px solid rgba(255,255,255,0.06)">Condition</td><td style="padding:8px 0;color:#fff;font-size:13px;text-align:right;border-bottom:1px solid rgba(255,255,255,0.06)">${hCondition}</td></tr>`}
<tr><td style="padding:8px 0;color:#888;font-size:13px;border-bottom:1px solid rgba(255,255,255,0.06)">Payout method</td><td style="padding:8px 0;color:#00c853;font-size:13px;text-align:right;font-weight:700;border-bottom:1px solid rgba(255,255,255,0.06)">${hPayout}</td></tr>
${couponBonus > 0 ? `<tr><td style="padding:8px 0;color:#888;font-size:13px;border-bottom:1px solid rgba(255,255,255,0.06)">🎁 Coupon bonus</td><td style="padding:8px 0;color:#00c853;font-size:13px;text-align:right;font-weight:700;border-bottom:1px solid rgba(255,255,255,0.06)">+$${couponBonus}.00</td></tr>` : ""}
${isShipping ? `<tr><td style="padding:8px 0;color:#888;font-size:13px;border-bottom:1px solid rgba(255,255,255,0.06)">🚚 Prepaid shipping label</td><td style="padding:8px 0;color:#00c853;font-size:13px;text-align:right;font-weight:800;border-bottom:1px solid rgba(255,255,255,0.06)">FREE</td></tr>` : ""}
<tr><td style="padding:12px 0 4px 0;color:#fff;font-size:14px;font-weight:800">Offer total</td><td style="padding:12px 0 4px 0;color:#00c853;font-size:18px;text-align:right;font-weight:800">${isPending ? "Custom quote" : `$${offerTotal}.00`}</td></tr>
</table>
</td></tr>
</table>
</td></tr>

<!-- DEVICE PREPARATION CHECKLIST — checkbox-style, requireds first -->
<tr><td style="padding:28px 28px 8px 28px">
<div style="font-size:13px;color:#fff;font-weight:800;margin-bottom:14px;letter-spacing:-0.01em">Device preparation</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:14px">
<tr><td style="padding:14px 20px;border-bottom:1px solid rgba(255,255,255,0.06)">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
    <tr>
      <td width="28" valign="top" style="padding-right:12px;padding-top:1px"><div style="width:18px;height:18px;border-radius:5px;background:#00c853;color:#0a0a0a;text-align:center;font-weight:800;font-size:13px;line-height:18px">✓</div></td>
      <td valign="top">
        <div style="font-size:10px;letter-spacing:0.14em;text-transform:uppercase;color:#ff6b60;font-weight:800;margin-bottom:3px">Required</div>
        <div style="font-size:13px;color:#fff;font-weight:700;line-height:1.4;margin-bottom:3px">Reset your device + turn off Find My / Activation Lock</div>
        <div style="font-size:11px;color:#a8a8a8;line-height:1.5">Activation-locked devices don't qualify for free return shipping. iPhone: Settings → [your name] → Find My → Find My iPhone → off. Android: Settings → Accounts → remove Google account.</div>
      </td>
    </tr>
  </table>
</td></tr>
<tr><td style="padding:14px 20px;border-bottom:1px solid rgba(255,255,255,0.06)">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
    <tr>
      <td width="28" valign="top" style="padding-right:12px;padding-top:1px"><div style="width:18px;height:18px;border-radius:5px;background:#00c853;color:#0a0a0a;text-align:center;font-weight:800;font-size:13px;line-height:18px">✓</div></td>
      <td valign="top">
        <div style="font-size:10px;letter-spacing:0.14em;text-transform:uppercase;color:#ff6b60;font-weight:800;margin-bottom:3px">Required</div>
        <div style="font-size:13px;color:#fff;font-weight:700;line-height:1.4;margin-bottom:3px">Confirm device is paid off with your carrier</div>
        <div style="font-size:11px;color:#a8a8a8;line-height:1.5">Devices with an outstanding carrier balance can get blacklisted at any time — we'll still buy them, but at a reduced offer (typically 50-75% of quote). Honest answer up front saves both of us a return trip.</div>
      </td>
    </tr>
  </table>
</td></tr>
<tr><td style="padding:14px 20px;border-bottom:1px solid rgba(255,255,255,0.06)">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
    <tr>
      <td width="28" valign="top" style="padding-right:12px;padding-top:1px"><div style="width:18px;height:18px;border-radius:5px;background:rgba(255,255,255,0.10);border:1px solid rgba(255,255,255,0.20);text-align:center;font-weight:800;font-size:13px;line-height:18px;color:#a8a8a8">○</div></td>
      <td valign="top">
        <div style="font-size:10px;letter-spacing:0.14em;text-transform:uppercase;color:#a8a8a8;font-weight:800;margin-bottom:3px">Optional</div>
        <div style="font-size:13px;color:#fff;font-weight:700;line-height:1.4;margin-bottom:3px">Remove SIM, SD card, screen protector, case</div>
        <div style="font-size:11px;color:#a8a8a8;line-height:1.5">We'll wipe these on arrival regardless, but pulling them now means nothing of yours travels with the device.</div>
      </td>
    </tr>
  </table>
</td></tr>
<tr><td style="padding:14px 20px;background:rgba(255,107,96,0.06)">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
    <tr>
      <td valign="top">
        <div style="font-size:12px;color:#ff8088;line-height:1.55"><strong style="color:#ff6b60">Heads up:</strong> if your device arrives still activation-locked or doesn't match the model you submitted, we'll ask you to cover return shipping. Disclose damage or carrier balance up front and we'll work with you.</div>
      </td>
    </tr>
  </table>
</td></tr>
</table>
</td></tr>

<!-- LABEL SECTION (ship only, when a label was minted at submission) -->
${hasLabel ? `
<tr><td style="padding:24px 28px 8px 28px">
<!-- FedEx wordmark — HTML/CSS recreation of the official mark so it
     renders in every email client without external images getting
     blocked. Purple "Fed" + Ground-orange "Ex" matches the FEDEX_GROUND
     service this lead is shipping under. Skywalker 2026-05-19 asked
     for the FedEx logo to appear on the email so customers see the
     real-shipper relationship at a glance. -->
<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:12px"><tr>
  <td style="vertical-align:middle;padding-right:10px">
    <span style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-weight:900;font-size:26px;letter-spacing:-1.5px;line-height:1">
      <span style="color:#4D148C">Fed</span><span style="color:#FF6600">Ex</span>
    </span>
  </td>
  <td style="vertical-align:middle;border-left:1px solid rgba(255,255,255,0.18);padding-left:12px">
    <div style="font-size:10px;color:#00c853;letter-spacing:0.18em;text-transform:uppercase;font-weight:800">Prepaid return label</div>
    <div style="font-size:11px;color:#a8a8a8;margin-top:2px">Generated at submit · billed to TCC</div>
  </td>
</tr></table>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:rgba(255,255,255,0.04);border:1px solid rgba(0,200,83,0.30);border-radius:14px">
<tr><td style="padding:18px 20px">
<div style="font-size:10px;letter-spacing:0.18em;text-transform:uppercase;color:#00c853;font-weight:800;margin-bottom:6px">Tracking</div>
<div style="font-size:16px;color:#fff;font-weight:700;font-family:ui-monospace,SFMono-Regular,monospace">${fedexLabel.tracking}</div>
<div style="font-size:12px;color:#b8b8b8;margin-top:4px">${String(fedexLabel.service || "").replace(/_/g, " ")} · prepaid · drop at any FedEx location</div>
<div style="margin-top:14px;text-align:center">
<a href="${fedexLabel.url}" style="display:inline-block;padding:13px 28px;background:linear-gradient(180deg,#00c853 0%,#00c853 60%,#00a039 100%);color:#0a0a0a;font-weight:800;font-size:14px;text-decoration:none;border-radius:999px;box-shadow:inset 0 1px 0 rgba(255,255,255,0.4),0 4px 14px rgba(0,200,83,0.35)">Download label PDF</a>
</div>
</td></tr>
</table>
${deviceArr.length > 1 ? `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:rgba(255,180,40,0.08);border:1px solid rgba(255,180,40,0.40);border-radius:12px;margin-top:14px">
<tr>
<td valign="top" style="padding:14px 0 14px 16px;width:36px;font-size:22px;line-height:1">📦</td>
<td style="padding:14px 16px 14px 8px">
<div style="font-size:14px;color:#fff;font-weight:800;margin-bottom:4px;line-height:1.3">Pack ALL ${deviceArr.length} devices in ONE box</div>
<div style="font-size:12px;color:#e6c89a;line-height:1.55">
One label covers the entire package — you don&#39;t need ${deviceArr.length} separate boxes or labels. Wrap each device in bubble wrap or clothing, put them all in a single padded box, tape this label on top.
<br/><br/>
<strong style="color:#fff">Box capacity (one FedEx box):</strong> up to ~15 phones, ~5 tablets, or ~2 laptops. We&#39;ll text you the moment your single package arrives.
</div>
</td>
</tr>
</table>` : ``}
</td></tr>

<!-- HOW TO SHIP — 3 visual steps with icons, ship customers only -->
<tr><td style="padding:28px 28px 8px 28px">
<div style="font-size:13px;color:#fff;font-weight:800;margin-bottom:14px;letter-spacing:-0.01em">How to ship in 3 steps</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
<tr>
  <td width="50%" valign="top" style="padding:0 8px 0 0">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:12px">
      <tr><td style="padding:16px 14px;text-align:center">
        <div style="font-size:32px;line-height:1;margin-bottom:8px">🖨️</div>
        <div style="font-size:10px;letter-spacing:0.16em;text-transform:uppercase;color:#00c853;font-weight:800;margin-bottom:4px">Step 1</div>
        <div style="font-size:13px;color:#fff;font-weight:700;line-height:1.3;margin-bottom:6px">Print the label</div>
        <div style="font-size:11px;color:#a8a8a8;line-height:1.5">Any home printer on plain 8.5×11 paper. No special label paper needed.</div>
      </td></tr>
    </table>
  </td>
  <td width="50%" valign="top" style="padding:0 0 0 8px">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:12px">
      <tr><td style="padding:16px 14px;text-align:center">
        <div style="font-size:32px;line-height:1;margin-bottom:8px">📦</div>
        <div style="font-size:10px;letter-spacing:0.16em;text-transform:uppercase;color:#00c853;font-weight:800;margin-bottom:4px">Step 2</div>
        <div style="font-size:13px;color:#fff;font-weight:700;line-height:1.3;margin-bottom:6px">Pack &amp; tape</div>
        <div style="font-size:11px;color:#a8a8a8;line-height:1.5">${(deviceArr.length > 1) ? `All ${deviceArr.length} devices in ONE padded box.` : `Padded mailer or box, wrap in bubble or clothing.`} Tape label to top.</div>
      </td></tr>
    </table>
  </td>
</tr>
<tr><td colspan="2" style="padding:14px 0 0 0">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:12px">
    <tr><td style="padding:16px 18px">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td width="50" valign="middle" style="padding-right:14px"><div style="font-size:32px;line-height:1">🚚</div></td>
          <td valign="middle">
            <div style="font-size:10px;letter-spacing:0.16em;text-transform:uppercase;color:#00c853;font-weight:800;margin-bottom:2px">Step 3</div>
            <div style="font-size:13px;color:#fff;font-weight:700;line-height:1.3;margin-bottom:4px">Drop at any FedEx location</div>
            <div style="font-size:11px;color:#a8a8a8;line-height:1.5">No appointment, no waiting in line — just hand it to the counter or use a self-service drop box. FedEx Office stores stay open late.</div>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</td></tr>
</table>
</td></tr>

<!-- PACKAGING CHECKLIST — ship customers only -->
<tr><td style="padding:24px 28px 8px 28px">
<div style="font-size:13px;color:#fff;font-weight:800;margin-bottom:14px;letter-spacing:-0.01em">Packaging checklist</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:14px">
  <tr><td style="padding:12px 18px;border-bottom:1px solid rgba(255,255,255,0.06)">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
      <td width="26" valign="top" style="padding-right:10px;padding-top:1px"><div style="width:16px;height:16px;border-radius:4px;background:#00c853;color:#0a0a0a;text-align:center;font-weight:800;font-size:11px;line-height:16px">✓</div></td>
      <td valign="top" style="font-size:12px;color:#e6e6e6;line-height:1.55"><strong style="color:#fff">Use a plain box.</strong> Padded mailer or any 6×4×2-ish padded envelope works for phones. ${(deviceArr.length > 1) ? `All ${deviceArr.length} devices fit in ONE box together — saves you a trip and keeps everything together.` : ""}</td>
    </tr></table>
  </td></tr>
  <tr><td style="padding:12px 18px;border-bottom:1px solid rgba(255,255,255,0.06);background:rgba(255,180,0,0.04)">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
      <td width="26" valign="top" style="padding-right:10px;padding-top:1px"><div style="width:16px;height:16px;border-radius:4px;background:#ffb400;color:#1a1100;text-align:center;font-weight:800;font-size:11px;line-height:16px">!</div></td>
      <td valign="top" style="font-size:12px;color:#e6e6e6;line-height:1.55"><strong style="color:#ffd54f">Don't use the original Apple / Samsung / carrier box.</strong> Branded device packaging is a magnet for porch + transit theft. A plain unmarked box keeps it discreet.</td>
    </tr></table>
  </td></tr>
  <tr><td style="padding:12px 18px;border-bottom:1px solid rgba(255,255,255,0.06)">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
      <td width="26" valign="top" style="padding-right:10px;padding-top:1px"><div style="width:16px;height:16px;border-radius:4px;background:#00c853;color:#0a0a0a;text-align:center;font-weight:800;font-size:11px;line-height:16px">✓</div></td>
      <td valign="top" style="font-size:12px;color:#e6e6e6;line-height:1.55"><strong style="color:#fff">Cushion the device.</strong> Bubble wrap, balled-up paper, or even an old t-shirt around it. Filler so nothing rattles. No bag of sand, just snug.</td>
    </tr></table>
  </td></tr>
  <tr><td style="padding:12px 18px;border-bottom:1px solid rgba(255,255,255,0.06)">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
      <td width="26" valign="top" style="padding-right:10px;padding-top:1px"><div style="width:16px;height:16px;border-radius:4px;background:#00c853;color:#0a0a0a;text-align:center;font-weight:800;font-size:11px;line-height:16px">✓</div></td>
      <td valign="top" style="font-size:12px;color:#e6e6e6;line-height:1.55"><strong style="color:#fff">Tape it shut.</strong> All seams, both ends. Packing tape ideally, but masking tape works in a pinch.</td>
    </tr></table>
  </td></tr>
  <tr><td style="padding:12px 18px;border-bottom:1px solid rgba(255,255,255,0.06)">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
      <td width="26" valign="top" style="padding-right:10px;padding-top:1px"><div style="width:16px;height:16px;border-radius:4px;background:#00c853;color:#0a0a0a;text-align:center;font-weight:800;font-size:11px;line-height:16px">✓</div></td>
      <td valign="top" style="font-size:12px;color:#e6e6e6;line-height:1.55"><strong style="color:#fff">Stick the label on flat — barcode visible.</strong> One clear strip of tape over the whole label is best. No bumps, no folds, no tape strips across the barcode itself (FedEx scanners need to read it).</td>
    </tr></table>
  </td></tr>
  <tr><td style="padding:12px 18px">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
      <td width="26" valign="top" style="padding-right:10px;padding-top:1px"><div style="width:16px;height:16px;border-radius:4px;background:#00c853;color:#0a0a0a;text-align:center;font-weight:800;font-size:11px;line-height:16px">✓</div></td>
      <td valign="top" style="font-size:12px;color:#e6e6e6;line-height:1.55"><strong style="color:#fff">Drop within 14 days</strong> to lock in your $${quote} offer. Past that we may need to re-quote based on current market rates.</td>
    </tr></table>
  </td></tr>
</table>
</td></tr>

<!-- HAZMAT NOTE — lithium battery warning, required for any device w/ battery -->
<tr><td style="padding:18px 28px 4px 28px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:rgba(255,180,0,0.06);border:1px solid rgba(255,180,0,0.25);border-left:3px solid #ffb400;border-radius:12px">
  <tr><td style="padding:14px 18px">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr>
        <td width="40" valign="top" style="padding-right:12px"><div style="font-size:24px;line-height:1">🔋</div></td>
        <td valign="top">
          <div style="font-size:12px;color:#ffd54f;font-weight:800;letter-spacing:0.04em;margin-bottom:4px">Battery (lithium) shipping note</div>
          <div style="font-size:11px;color:#e6e6e6;line-height:1.55">Most phones, tablets, and laptops contain lithium batteries. FedEx handles these as "Section II" lithium-ion shipments — your label already covers the proper hazmat marking, no extra paperwork from you. Don't ship a device that's swollen, leaking, or visibly damaged on the battery — reply to this email and we'll arrange safe local pickup instead.</div>
        </td>
      </tr>
    </table>
  </td></tr>
</table>
</td></tr>

<!-- TURNAROUND TIMELINE — ship customers only, sets expectations -->
<tr><td style="padding:24px 28px 8px 28px">
<div style="font-size:13px;color:#fff;font-weight:800;margin-bottom:14px;letter-spacing:-0.01em">When do I get paid?</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:12px">
<tr><td style="padding:6px 18px">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
    <tr>
      <td width="80" valign="middle" style="padding:12px 0;border-bottom:1px solid rgba(255,255,255,0.06)"><div style="font-size:11px;color:#00c853;font-weight:800;letter-spacing:0.05em">Today</div></td>
      <td valign="middle" style="padding:12px 0;border-bottom:1px solid rgba(255,255,255,0.06);font-size:13px;color:#e6e6e6;line-height:1.5">You print + drop the package</td>
    </tr>
    <tr>
      <td width="80" valign="middle" style="padding:12px 0;border-bottom:1px solid rgba(255,255,255,0.06)"><div style="font-size:11px;color:#00c853;font-weight:800;letter-spacing:0.05em">2-5 days</div></td>
      <td valign="middle" style="padding:12px 0;border-bottom:1px solid rgba(255,255,255,0.06);font-size:13px;color:#e6e6e6;line-height:1.5">FedEx Ground transit — we text you when it arrives</td>
    </tr>
    <tr>
      <td width="80" valign="middle" style="padding:12px 0;border-bottom:1px solid rgba(255,255,255,0.06)"><div style="font-size:11px;color:#00c853;font-weight:800;letter-spacing:0.05em">24 hours</div></td>
      <td valign="middle" style="padding:12px 0;border-bottom:1px solid rgba(255,255,255,0.06);font-size:13px;color:#e6e6e6;line-height:1.5">We inspect + confirm the quote (matches what you described = no change)</td>
    </tr>
    <tr>
      <td width="80" valign="middle" style="padding:12px 0"><div style="font-size:11px;color:#00c853;font-weight:800;letter-spacing:0.05em">Same day</div></td>
      <td valign="middle" style="padding:12px 0;font-size:13px;color:#e6e6e6;line-height:1.5">Payment sent via your chosen method — Cash App / Zelle / Bitcoin in minutes</td>
    </tr>
  </table>
</td></tr>
</table>
</td></tr>
` : ''}

<!-- What Happens Next — copy adapts based on shipping vs local -->
<tr><td style="padding:24px 28px 8px 28px">
<div style="font-size:11px;color:#00c853;letter-spacing:0.18em;text-transform:uppercase;font-weight:800;margin-bottom:10px">What happens next</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
<tr>
<td width="40" valign="top" style="padding:8px 0">
<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td style="width:30px;height:30px;background:linear-gradient(180deg,#00c853 0%,#00a039 100%);color:#0a0a0a;border-radius:50%;text-align:center;font-weight:800;font-size:14px;line-height:30px;box-shadow:inset 0 1px 0 rgba(255,255,255,0.4)">1</td></tr></table>
</td>
<td style="padding:8px 0 8px 12px;font-size:14px;color:#e6e6e6;line-height:1.5;vertical-align:middle">${isMixed
  ? "Ship items: print your prepaid label and tape it to a padded box. Local items: we reach out to schedule the meetup."
  : isShipping ? "Print your prepaid label and tape it to a padded box" : "We reach out to schedule a local meetup"}</td>
</tr>
<tr>
<td width="40" valign="top" style="padding:8px 0">
<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td style="width:30px;height:30px;background:linear-gradient(180deg,#00c853 0%,#00a039 100%);color:#0a0a0a;border-radius:50%;text-align:center;font-weight:800;font-size:14px;line-height:30px;box-shadow:inset 0 1px 0 rgba(255,255,255,0.4)">2</td></tr></table>
</td>
<td style="padding:8px 0 8px 12px;font-size:14px;color:#e6e6e6;line-height:1.5;vertical-align:middle">${isMixed
  ? "Drop the FedEx box at any FedEx location and meet us at the booked window for your local items"
  : isShipping ? "Drop at any FedEx location — no appointment needed" : "Quick inspection confirms the quote"}</td>
</tr>
<tr>
<td width="40" valign="top" style="padding:8px 0">
<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td style="width:30px;height:30px;background:linear-gradient(180deg,#00c853 0%,#00a039 100%);color:#0a0a0a;border-radius:50%;text-align:center;font-weight:800;font-size:14px;line-height:30px;box-shadow:inset 0 1px 0 rgba(255,255,255,0.4)">3</td></tr></table>
</td>
<td style="padding:8px 0 8px 12px;font-size:14px;color:#e6e6e6;line-height:1.5;vertical-align:middle">${isMixed
  ? "Ship items pay within 24h after we inspect; local items pay on the spot — Cash App / Zelle / Bitcoin / cash"
  : isShipping ? "We inspect on arrival + pay within 24h via Cash App / Zelle / Bitcoin" : "You get paid on the spot — Cash, Cash App, Zelle, or BTC"}</td>
</tr>
</table>
</td></tr>

<!-- TRACK YOUR TRADE — self-serve status page so customers can check
     where their device is without texting us -->
${(phoneDigits || email) ? `<tr><td style="padding:18px 28px 0 28px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.10);border-radius:14px">
<tr><td style="padding:16px 20px">
<div style="font-size:11px;color:#00c853;font-weight:800;letter-spacing:0.18em;text-transform:uppercase;margin-bottom:6px">Track your trade anytime</div>
<div style="font-size:13px;color:#dcdcdc;line-height:1.55;margin-bottom:12px">Live status, FedEx scans, payout method. Bookmark it — no password needed.</div>
<a href="https://topcashcellular.com/track?${phoneDigits ? `phone=${encodeURIComponent(phoneDigits)}` : `email=${encodeURIComponent(email || "")}`}" style="display:inline-block;padding:10px 22px;background:rgba(0,200,83,0.12);color:#00c853;border:1px solid rgba(0,200,83,0.35);border-radius:999px;text-decoration:none;font-weight:700;font-size:13px">📍 Track your trade →</a>
</td></tr>
</table>
</td></tr>` : ""}

<!-- CTA -->
<tr><td style="padding:18px 28px 6px 28px;text-align:center">
<a href="mailto:support@topcashcellular.com" style="display:inline-block;padding:14px 32px;background:linear-gradient(180deg,#00c853 0%,#00c853 60%,#00a039 100%);color:#0a0a0a;font-weight:800;font-size:14px;text-decoration:none;border-radius:999px;box-shadow:inset 0 1px 0 rgba(255,255,255,0.4),0 4px 14px rgba(0,200,83,0.35)">Reply with questions</a>
</td></tr>

<!-- TRUST STRIP — 3 trust badges, builds confidence before footer -->
<tr><td style="padding:24px 28px 8px 28px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
<tr>
  <td width="33%" valign="top" style="padding:0 4px">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:12px;text-align:center">
      <tr><td style="padding:14px 8px">
        <div style="font-size:24px;line-height:1;margin-bottom:6px">🛡️</div>
        <div style="font-size:11px;color:#fff;font-weight:700;line-height:1.3">$100 insured</div>
        <div style="font-size:10px;color:#888;line-height:1.4;margin-top:2px">In transit, covered</div>
      </td></tr>
    </table>
  </td>
  <td width="33%" valign="top" style="padding:0 4px">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:12px;text-align:center">
      <tr><td style="padding:14px 8px">
        <div style="font-size:24px;line-height:1;margin-bottom:6px">↩️</div>
        <div style="font-size:11px;color:#fff;font-weight:700;line-height:1.3">No-risk return</div>
        <div style="font-size:10px;color:#888;line-height:1.4;margin-top:2px">Don't like the offer? We ship it back free</div>
      </td></tr>
    </table>
  </td>
  <td width="33%" valign="top" style="padding:0 4px">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:12px;text-align:center">
      <tr><td style="padding:14px 8px">
        <div style="font-size:24px;line-height:1;margin-bottom:6px">⭐</div>
        <div style="font-size:11px;color:#fff;font-weight:700;line-height:1.3">Austin-owned</div>
        <div style="font-size:10px;color:#888;line-height:1.4;margin-top:2px">Real people, real reviews</div>
      </td></tr>
    </table>
  </td>
</tr>
</table>
</td></tr>

<!-- Handoff note — adapts to shipping vs local -->
<tr><td style="padding:18px 28px 8px 28px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:rgba(255,255,255,0.04);border:1px solid rgba(0,200,83,0.22);border-radius:12px">
<tr><td style="padding:14px 18px;font-size:13px;color:#e6e6e6;line-height:1.55;text-align:center">
${isShipping
  ? `<strong style=\"color:#00c853\">Wrong address?</strong> Reply to this email within the hour and we'll resend a corrected label. Need help? Just reply to this email — we answer within ~1 hour.`
  : `<strong style=\"color:#00c853\">Austin local?</strong> We meet locally — no shipping. Prefer to ship? Reply and we'll send a prepaid label.`}
</td></tr>
</table>
</td></tr>

<!-- Submission summary -->
<tr><td style="padding:20px 28px 8px 28px">
<div style="font-size:11px;color:#888;letter-spacing:0.18em;text-transform:uppercase;font-weight:700;margin-bottom:10px">Submission summary</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.06);border-radius:12px">
<tr><td style="padding:14px 18px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
<tr><td style="padding:4px 0;color:#888;font-size:12px">Device</td><td style="padding:4px 0;color:#fff;font-size:12px;text-align:right;font-weight:600">${hModel}</td></tr>
<tr><td style="padding:4px 0;color:#888;font-size:12px">Storage</td><td style="padding:4px 0;color:#e6e6e6;font-size:12px;text-align:right">${hStorage}</td></tr>
<tr><td style="padding:4px 0;color:#888;font-size:12px">Condition</td><td style="padding:4px 0;color:#e6e6e6;font-size:12px;text-align:right">${hCondition}</td></tr>
<tr><td style="padding:4px 0;color:#888;font-size:12px">Quote</td><td style="padding:4px 0;color:#00c853;font-size:12px;text-align:right;font-weight:700">$${quote}</td></tr>
<tr><td style="padding:4px 0;color:#888;font-size:12px">Payout</td><td style="padding:4px 0;color:#e6e6e6;font-size:12px;text-align:right">${hPayout}</td></tr>
<tr><td colspan="2" style="padding:6px 0 0"><div style="height:1px;background:rgba(255,255,255,0.06)"></div></td></tr>
<tr><td style="padding:6px 0 4px;color:#888;font-size:12px">Name</td><td style="padding:6px 0 4px;color:#e6e6e6;font-size:12px;text-align:right">${hNameNA}</td></tr>
<tr><td style="padding:4px 0;color:#888;font-size:12px">Email</td><td style="padding:4px 0;color:#e6e6e6;font-size:12px;text-align:right">${hEmail}</td></tr>
${phone ? `<tr><td style="padding:4px 0;color:#888;font-size:12px">Phone</td><td style="padding:4px 0;color:#e6e6e6;font-size:12px;text-align:right">${hPhone}</td></tr>` : ''}
</table>
</td></tr>
</table>
</td></tr>

<!-- Footer -->
<tr><td style="padding:24px 28px 28px 28px">
<div style="height:1px;background:rgba(255,255,255,0.08);margin-bottom:18px"></div>
<div style="text-align:center">
<!-- Referral nudge — the greatest compliment line -->
<div style="font-size:12px;color:#bdbdbd;font-weight:700;margin-bottom:14px">The greatest compliment you can give us is a referral. 💚</div>
<!-- Review platforms — TCC has no socials, just Trustpilot + Yelp -->
<div style="font-size:10px;color:#777;text-transform:uppercase;letter-spacing:0.14em;font-weight:800;margin-bottom:8px">Reviewed us? Tell the world</div>
<div style="margin-bottom:16px">
<a href="${TRUSTPILOT_URL}" style="display:inline-block;margin:0 4px;padding:8px 16px;background:rgba(0,182,122,0.12);border:1px solid rgba(0,182,122,0.4);border-radius:999px;color:#00b67a;text-decoration:none;font-size:12px;font-weight:800">★ Trustpilot</a>
${YELP_URL ? `<a href="${YELP_URL}" style="display:inline-block;margin:0 4px;padding:8px 16px;background:rgba(211,47,47,0.12);border:1px solid rgba(211,47,47,0.4);border-radius:999px;color:#ff6b6b;text-decoration:none;font-size:12px;font-weight:800">★ Yelp</a>` : ""}
</div>
<div style="margin-bottom:8px"><a href="mailto:support@topcashcellular.com" style="color:#00c853;text-decoration:none;font-size:14px;font-weight:700">support@topcashcellular.com</a></div>
<div style="font-size:12px;color:#888;line-height:1.6">Top Cash Cellular · Austin, TX</div>
<div style="font-size:12px;color:#888;line-height:1.6"><a href="https://topcashcellular.com" style="color:#00c853;text-decoration:none">topcashcellular.com</a> · Mon–Sat 8 AM–8 PM CT</div>
<div style="font-size:11px;color:#555;margin-top:10px">© ${new Date().getFullYear()} Top Cash Cellular. All rights reserved.</div>
<div style="font-size:11px;color:#555;margin-top:4px">Questions? Just reply to this email.</div>
</div>
</td></tr>

</table>
</td></tr>
</table>
</body>
</html>`;

    const textFallback = isPending
      ? `Hi ${name || "there"}, we got your request for ${model} (${condition}, ${storage || "N/A"}). Our team is pulling a custom quote and will text or email your offer within the hour. Reply to this email or write to support@topcashcellular.com — Top Cash Cellular, Austin TX`
      : hasLabel
      ? `Hi ${name || "there"}, your $${offerTotal} quote for ${model} is locked. Your prepaid FedEx label is ready — tracking ${fedexLabel.tracking}, download: ${fedexLabel.url}. Print, tape to a padded box, drop at any FedEx location. Top Cash Cellular, Austin TX.`
      : `Hi ${name || "there"}, your $${offerTotal} quote for ${model} (${condition}, ${storage || "N/A"}) is locked for 14 days. We'll contact you within the hour. Reply to this email or write to support@topcashcellular.com — Top Cash Cellular, Austin TX`;

    try {
      const { Resend } = await import("resend");
      const resend = new Resend(process.env.RESEND_API_KEY);
      const result = await resend.emails.send({
        from: "Top Cash Cellular <noreply@topcashcellular.com>",
        replyTo: "support@topcashcellular.com",
        to: email,
        // Offer # in the subject so a customer reply threads against a
        // findable reference — staff paste it into admin search to pull
        // up the exact lead (support-ticket linkage).
        subject: isPending
          ? `We got your request for ${model} — custom quote coming (Offer #${offerNum})`
          : `Your $${offerTotal} quote for ${model} — Offer #${offerNum}`,
        html: htmlEmail,
        text: textFallback,
      });
      emailSent = !!(result?.data?.id);
      // Resend can 200-OK without an id when the API key is invalid
      // or the domain is unverified. Treat no-id as a soft failure.
      if (!emailSent) {
        reportError("confirm.email.no-id", new Error("Resend returned no message id"), {
          customerEmail: email,
          critical: true,
          extra: { quote: String(quote), model: model || "" },
        });
      }
    } catch (err) {
      reportError("confirm.email.send", err, {
        customerEmail: email,
        critical: true,
        extra: { quote: String(quote), model: model || "" },
      });
    }
  }

  if (phone) {
    const smsBody = isPending
      ? `Top Cash Cellular: We got your request for ${model}! Our team will text or email your custom quote within the hour. Questions? Just reply to this text.`
      : hasLabel
      ? `Top Cash Cellular: $${offerTotal} quote locked for ${model}. Your prepaid FedEx label is ready — tracking ${fedexLabel.tracking}. Download: ${fedexLabel.url}`
      : `Top Cash Cellular: Your $${offerTotal} quote for ${model} is locked for 14 days! We'll contact you within the hour. Questions? Just reply to this text.`;
    smsSent = await sendSms(phone, smsBody);
  }

  return NextResponse.json({ ok: true, emailSent, smsSent });
}
