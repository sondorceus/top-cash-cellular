// Admin endpoint to mint a counter-offer. Staff inspects an incoming
// device, finds it doesn't match the customer's description, and would
// rather negotiate than reject outright. Posts a [COUNTER-OFFER] marker
// to MC and sends the customer an SMS + email with a tokenized accept-
// or-decline link.
//
// Before this endpoint, staff only had accept-as-quoted or full reject.
// Loss of margin OR loss of lead — no middle path. This adds the third
// path so we stop forfeiting both. Skywalker 2026-05-19 gap #3.

import { NextRequest, NextResponse } from "next/server";
import { mailLogo, mailButton } from "../../../../lib/email-shell";
import { safeEqual } from "../../../../lib/admin-auth";
import { signCounterToken } from "../../../../lib/counter-token";
import { reportError } from "../../../../lib/error-report";

const MC_API = "https://missioncontrolsdjg-production.up.railway.app";
const MC_KEY = process.env.MC_API_KEY || "";
const ADMIN_TOKEN = process.env.TCC_ADMIN_TOKEN;
const TWILIO_SID = process.env.TWILIO_ACCOUNT_SID || "";
const TWILIO_AUTH = process.env.TWILIO_AUTH_TOKEN || "";
const TWILIO_FROM = process.env.TWILIO_PHONE || "";
const RESEND_KEY = process.env.RESEND_API_KEY || "";

function checkAuth(req: NextRequest): boolean {
  const headerToken = req.headers.get("x-admin-token");
  const queryToken = req.nextUrl.searchParams.get("token");
  return safeEqual(headerToken, ADMIN_TOKEN) || safeEqual(queryToken, ADMIN_TOKEN);
}

async function sendSms(to: string, body: string): Promise<boolean> {
  if (!TWILIO_SID || !TWILIO_AUTH) return false;
  const digits = to.replace(/\D/g, "");
  const e164 = digits.length === 10 ? `+1${digits}` : digits.length === 11 && digits.startsWith("1") ? `+${digits}` : null;
  if (!e164) return false;
  try {
    const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${TWILIO_SID}:${TWILIO_AUTH}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ To: e164, From: TWILIO_FROM, Body: body.slice(0, 480) }),
    });
    return r.ok;
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  if (!checkAuth(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { leadId?: string; name?: string; phone?: string; email?: string; device?: string; originalQuote?: number; offer?: number; reason?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { leadId, name, phone, email, device, originalQuote, offer, reason } = body;
  if (!leadId) return NextResponse.json({ error: "leadId required" }, { status: 400 });
  // Validate the id shape — it's interpolated into the [COUNTER-OFFER: id]
  // MC marker, so a bracket-bearing id could close the marker and forge a
  // [STATUS:]/[LEAD:] flip the admin parser reads back. Same guard the
  // delete/restore routes use.
  if (!/^[\w-]+$/.test(leadId)) return NextResponse.json({ error: "Invalid leadId" }, { status: 400 });
  if (typeof offer !== "number" || offer < 0) return NextResponse.json({ error: "offer (number) required" }, { status: 400 });
  if (typeof originalQuote !== "number") return NextResponse.json({ error: "originalQuote (number) required" }, { status: 400 });
  // A "final invoice" is an offer at (or above) the original quote — the
  // device matched its description, so we're only confirming the agreed
  // price and asking the seller to OK the payout. That needs no "why we
  // revised" reason. A reason is required only when we LOWER the offer (a
  // genuine counter), where the seller deserves the explanation.
  const isFinal = Math.round(offer) >= Math.round(originalQuote);
  const reasonText = (reason || "").trim();
  if (!isFinal && !reasonText) {
    return NextResponse.json({ error: "reason required when lowering the offer" }, { status: 400 });
  }
  if (!phone && !email) return NextResponse.json({ error: "phone or email required to reach customer" }, { status: 400 });

  // Don't send a counter on a lead that's already closed — the customer would
  // get a live accept/decline link for a finished trade. Counters during
  // inspection (shipped/received/tested) are normal and stay allowed. Fails
  // OPEN if MC is unreachable so a transient blip doesn't block staff.
  try {
    const cr = await fetch(`${MC_API}/api/comms?limit=1000`, { headers: { "x-api-key": MC_KEY }, cache: "no-store" });
    if (cr.ok) {
      const cd = await cr.json();
      const msgs: { body?: string; timestamp: string }[] = cd.messages || [];
      let curStatus = "", curAt = "";
      for (const m of msgs) {
        const sm = m.body?.match(new RegExp(`\\[STATUS:\\s*(\\w+)\\]\\s*\\[LEAD:\\s*${leadId}\\]`, "i"));
        if (sm && (!curAt || m.timestamp > curAt)) { curStatus = sm[1].toLowerCase(); curAt = m.timestamp; }
      }
      if (["paid", "met", "rejected"].includes(curStatus)) {
        return NextResponse.json({ error: `Can't send a counter — this lead is already ${curStatus}.` }, { status: 409 });
      }
    }
  } catch { /* MC read failed — allow the counter rather than block staff */ }

  const token = signCounterToken({
    leadId,
    originalQuote: Math.round(originalQuote),
    offer: Math.round(offer),
    reason: reasonText.slice(0, 500),
  });

  const offerUrl = `https://topcashcellular.com/counter/${token}`;

  // Post a marker so the admin lead row knows there's a pending offer.
  // Security: do NOT include the signed token in this marker. MC comms
  // are visible to every agent in the multi-agent system — leaking the
  // token would let any reader replay accept/decline on the customer's
  // behalf. The customer already has the token in their SMS + email;
  // staff can look up the lead status via the marker alone.
  try {
    await fetch(`${MC_API}/api/comms`, {
      method: "POST",
      headers: { "x-api-key": MC_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "topcash-web",
        fromName: "Top Cash Cellular",
        role: "system",
        body: `[COUNTER-OFFER: ${leadId}] type=${isFinal ? "final-invoice" : "counter"} original=$${originalQuote} offer=$${offer} reason=${reasonText.replace(/[[\]\n\r]/g, " ").slice(0, 300)}`,
        tags: ["counter-offer", "pending", isFinal ? "final-invoice" : "counter"],
        priority: "normal",
      }),
    });
  } catch (err) {
    reportError("counter-offer.mc.marker", err, { leadId, critical: false });
  }

  const first = (name || "there").split(" ")[0];
  const dev = device || "your device";
  const diff = originalQuote - offer;

  let smsSent = false;
  let emailSent = false;

  if (phone) {
    const smsBody = isFinal
      ? `Top Cash: Hi ${first}, we inspected ${dev} and it checks out. Final offer $${offer}. Approve it and we pay you: ${offerUrl}`
      : `Top Cash: Hi ${first}, we inspected ${dev}. Original quote $${originalQuote}, revised offer $${offer} (${reasonText.slice(0, 100)}). Accept or decline: ${offerUrl}`;
    smsSent = await sendSms(phone, smsBody);
    if (!smsSent) {
      reportError("counter-offer.sms.send", new Error("Twilio send failed"), { leadId, critical: false, extra: { phone } });
    }
  }

  if (email && RESEND_KEY) {
    try {
      const { Resend } = await import("resend");
      const resend = new Resend(RESEND_KEY);
      const html = buildCounterOfferEmail({ name: first, device: dev, originalQuote, offer, reason: reasonText, offerUrl, diff, isFinal });
      const r = await resend.emails.send({
        from: "Top Cash Cellular <noreply@topcashcellular.com>",
        replyTo: "support@topcashcellular.com",
        to: [email],
        subject: isFinal
          ? `Your final offer for ${dev} — Top Cash Cellular`
          : `Revised offer for ${dev} — Top Cash Cellular`,
        html,
        text: isFinal
          ? `Hi ${first}, we inspected ${dev} and it checks out. Final offer: $${offer}.\n\nApprove it and we pay you within 24 hours: ${offerUrl}\n\n— Top Cash Cellular`
          : `Hi ${first}, we inspected ${dev}. Original quote: $${originalQuote}. Revised offer: $${offer}.\n\nReason: ${reasonText}\n\nAccept or decline: ${offerUrl}\n\n— Top Cash Cellular`,
      });
      emailSent = !!(r?.data?.id);
      if (!emailSent) {
        reportError("counter-offer.email.no-id", new Error("Resend returned no message id"), { leadId, customerEmail: email, critical: false });
      }
    } catch (err) {
      reportError("counter-offer.email.send", err, { leadId, customerEmail: email, critical: false });
    }
  }

  return NextResponse.json({ ok: true, token, offerUrl, smsSent, emailSent });
}

function buildCounterOfferEmail(args: { name: string; device: string; originalQuote: number; offer: number; reason: string; offerUrl: string; diff: number; isFinal: boolean }): string {
  const { name, device, originalQuote, offer, reason, offerUrl, diff, isFinal } = args;
  // Escape customer-submitted name/device and the admin-typed reason before
  // they enter the email HTML (reason previously only stripped <>). (bug fix)
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const nameHtml = esc(name);
  const deviceHtml = esc(device);
  const reasonHtml = esc(reason);
  // Final invoice (offer == quoted price, device matched): confirm & pay,
  // one clean amount, no strikethrough, no "why we revised" block.
  const headline = isFinal ? "Your final offer — ready to pay" : "Revised offer for your trade";
  const intro = isFinal
    ? `We inspected <strong style="color:#fff">${deviceHtml}</strong> and it&apos;s exactly as described — everything checks out. Here&apos;s your final offer. Approve it and we pay you.`
    : `We inspected <strong style="color:#fff">${deviceHtml}</strong> and the condition isn't quite what was described in the original quote. We&apos;d still love to buy it — here&apos;s our honest revised offer.`;
  const amountBlock = isFinal
    ? `<div style="font-size:11px;color:#00c853;letter-spacing:0.16em;text-transform:uppercase;font-weight:800;margin-bottom:4px">Final offer</div>
<div style="font-size:40px;color:#00c853;font-weight:800;line-height:1;margin-bottom:4px">$${offer}</div>
<div style="font-size:12px;color:#a8a8a8">Approve below and we send your payout within 24 hours.</div>`
    : `<div style="font-size:11px;color:#888;letter-spacing:0.16em;text-transform:uppercase;font-weight:700;margin-bottom:4px">Original quote</div>
<div style="font-size:18px;color:#bdbdbd;text-decoration:line-through;font-weight:700;margin-bottom:14px">$${originalQuote}</div>
<div style="font-size:11px;color:#00c853;letter-spacing:0.16em;text-transform:uppercase;font-weight:800;margin-bottom:4px">Revised offer</div>
<div style="font-size:36px;color:#00c853;font-weight:800;line-height:1;margin-bottom:6px">$${offer}</div>
<div style="font-size:12px;color:#a8a8a8">Difference: −$${diff}</div>`;
  const reasonBlock = isFinal ? "" : `<tr><td style="padding:18px 28px 8px 28px">
<div style="font-size:11px;color:#ffb400;letter-spacing:0.18em;text-transform:uppercase;font-weight:800;margin-bottom:8px">Why we revised</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:rgba(255,180,0,0.06);border:1px solid rgba(255,180,0,0.30);border-left:3px solid #ffb400;border-radius:10px">
<tr><td style="padding:14px 18px;font-size:14px;color:#e6e6e6;line-height:1.55">
  ${reasonHtml}
</td></tr>
</table>
</td></tr>`;
  const ctaLabel = isFinal ? "Approve &amp; get paid →" : "Review & respond →";
  const ctaSub = isFinal
    ? "Approve and we pay you within 24 hours. Not right? Decline and we return your device free — no questions asked."
    : "No pressure. Accept the revised offer and we pay you within 24 hours. Decline and we return your device free — no questions asked.";
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="dark"><meta name="supported-color-schemes" content="dark"></head>
<body style="margin:0;padding:0;background:#13142b;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#e6e6e6">
<div style="background:#13142b;padding:32px 16px">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;margin:0 auto;background:#1b1d39;border:1px solid rgba(255,255,255,0.08);border-radius:18px;overflow:hidden">
<tr><td style="background:#ff9100;background:linear-gradient(135deg,#ffd54f 0%,#ff9100 100%);padding:24px 28px">
<div style="margin:0 0 16px">${mailLogo()}</div>
<div style="font-size:22px;font-weight:800;color:#1a1100;line-height:1.1">${headline}</div>
</td></tr>

<tr><td style="padding:28px 28px 8px 28px">
<div style="font-size:16px;color:#fff;font-weight:600;margin-bottom:14px">Hi ${nameHtml},</div>
<p style="margin:0 0 16px;font-size:14px;line-height:1.65;color:#e6e6e6">
  ${intro}
</p>
</td></tr>

<tr><td style="padding:8px 28px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.10);border-radius:14px">
<tr><td style="padding:18px 22px">
${amountBlock}
</td></tr>
</table>
</td></tr>

${reasonBlock}

<tr><td style="padding:24px 28px 8px 28px;text-align:center">
${mailButton(offerUrl, ctaLabel, "green")}
<p style="font-size:11px;color:#888;margin:12px 4px 0;line-height:1.55">${ctaSub}</p>
</td></tr>

<tr><td style="padding:24px 28px 28px 28px">
<div style="height:1px;background:rgba(255,255,255,0.08);margin-bottom:16px"></div>
<div style="font-size:12px;color:#888;line-height:1.6;text-align:center">
  Questions? Reply directly or write to <a href="mailto:support@topcashcellular.com" style="color:#00c853;text-decoration:none;font-weight:600">support@topcashcellular.com</a><br>
  <span style="color:#666">Top Cash Cellular · Austin, TX</span>
</div>
</td></tr>
</table>
</div></body></html>`;
}
