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
  return headerToken === ADMIN_TOKEN || queryToken === ADMIN_TOKEN;
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
  if (!reason || !reason.trim()) return NextResponse.json({ error: "reason required" }, { status: 400 });
  if (!phone && !email) return NextResponse.json({ error: "phone or email required to reach customer" }, { status: 400 });

  const token = signCounterToken({
    leadId,
    originalQuote: Math.round(originalQuote),
    offer: Math.round(offer),
    reason: reason.slice(0, 500),
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
        body: `[COUNTER-OFFER: ${leadId}] original=$${originalQuote} offer=$${offer} reason=${reason.replace(/[[\]\n\r]/g, " ").slice(0, 300)}`,
        tags: ["counter-offer", "pending"],
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
    const smsBody = `Top Cash: Hi ${first}, we inspected ${dev}. Original quote $${originalQuote}, revised offer $${offer} (${reason.slice(0, 100)}). Accept or decline: ${offerUrl}`;
    smsSent = await sendSms(phone, smsBody);
    if (!smsSent) {
      reportError("counter-offer.sms.send", new Error("Twilio send failed"), { leadId, critical: false, extra: { phone } });
    }
  }

  if (email && RESEND_KEY) {
    try {
      const { Resend } = await import("resend");
      const resend = new Resend(RESEND_KEY);
      const html = buildCounterOfferEmail({ name: first, device: dev, originalQuote, offer, reason, offerUrl, diff });
      const r = await resend.emails.send({
        from: "Top Cash Cellular <noreply@topcashcellular.com>",
        replyTo: "support@topcashcellular.com",
        to: [email],
        subject: `Revised offer for ${dev} — Top Cash Cellular`,
        html,
        text: `Hi ${first}, we inspected ${dev}. Original quote: $${originalQuote}. Revised offer: $${offer}.\n\nReason: ${reason}\n\nAccept or decline: ${offerUrl}\n\n— Top Cash Cellular`,
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

function buildCounterOfferEmail(args: { name: string; device: string; originalQuote: number; offer: number; reason: string; offerUrl: string; diff: number }): string {
  const { name, device, originalQuote, offer, reason, offerUrl, diff } = args;
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#e6e6e6">
<div style="background:#0a0a0a;padding:32px 16px">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;margin:0 auto;background:#0f0f0f;border:1px solid rgba(255,255,255,0.08);border-radius:18px;overflow:hidden">
<tr><td style="background:linear-gradient(135deg,#ffd54f 0%,#ff9100 100%);padding:24px 28px">
<div style="font-size:11px;font-weight:800;letter-spacing:0.18em;text-transform:uppercase;color:#1a1100;opacity:0.7;margin-bottom:4px">Top Cash Cellular</div>
<div style="font-size:22px;font-weight:800;color:#1a1100;line-height:1.1">Revised offer for your trade</div>
</td></tr>

<tr><td style="padding:28px 28px 8px 28px">
<div style="font-size:16px;color:#fff;font-weight:600;margin-bottom:14px">Hi ${name},</div>
<p style="margin:0 0 16px;font-size:14px;line-height:1.65;color:#e6e6e6">
  We inspected <strong style="color:#fff">${device}</strong> and the condition isn't quite what was described in the original quote. We&apos;d still love to buy it — here&apos;s our honest revised offer.
</p>
</td></tr>

<tr><td style="padding:8px 28px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.10);border-radius:14px">
<tr><td style="padding:18px 22px">
<div style="font-size:11px;color:#888;letter-spacing:0.16em;text-transform:uppercase;font-weight:700;margin-bottom:4px">Original quote</div>
<div style="font-size:18px;color:#bdbdbd;text-decoration:line-through;font-weight:700;margin-bottom:14px">$${originalQuote}</div>
<div style="font-size:11px;color:#00c853;letter-spacing:0.16em;text-transform:uppercase;font-weight:800;margin-bottom:4px">Revised offer</div>
<div style="font-size:36px;color:#00c853;font-weight:800;line-height:1;margin-bottom:6px">$${offer}</div>
<div style="font-size:12px;color:#a8a8a8">Difference: −$${diff}</div>
</td></tr>
</table>
</td></tr>

<tr><td style="padding:18px 28px 8px 28px">
<div style="font-size:11px;color:#ffb400;letter-spacing:0.18em;text-transform:uppercase;font-weight:800;margin-bottom:8px">Why we revised</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:rgba(255,180,0,0.06);border:1px solid rgba(255,180,0,0.30);border-left:3px solid #ffb400;border-radius:10px">
<tr><td style="padding:14px 18px;font-size:14px;color:#e6e6e6;line-height:1.55">
  ${reason.replace(/[<>]/g, "")}
</td></tr>
</table>
</td></tr>

<tr><td style="padding:24px 28px 8px 28px;text-align:center">
<a href="${offerUrl}" style="display:inline-block;padding:14px 32px;background:linear-gradient(180deg,#00e676 0%,#00c853 60%,#00a039 100%);color:#0a0a0a;font-weight:800;font-size:14px;text-decoration:none;border-radius:999px;box-shadow:inset 0 1px 0 rgba(255,255,255,0.4),0 4px 14px rgba(0,200,83,0.35)">Review &amp; respond →</a>
<p style="font-size:11px;color:#888;margin:12px 4px 0;line-height:1.55">No pressure. Accept the revised offer and we pay you within 24 hours. Decline and we return your device free — no questions asked.</p>
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
