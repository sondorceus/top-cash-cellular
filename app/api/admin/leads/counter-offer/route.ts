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
import { mailLogo, mailButton, mailDeviceImg } from "../../../../lib/email-shell";
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

  let body: { leadId?: string; name?: string; phone?: string; email?: string; device?: string; originalQuote?: number; offer?: number; reason?: string; deductions?: Array<{ label?: unknown; amount?: unknown }>; items?: Array<{ device?: unknown; storage?: unknown; quote?: unknown; deductions?: Array<{ label?: unknown; amount?: unknown }> }> };
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

  // Itemized deductions taken during inspection. When staff supplies ≥1
  // line item, the offer becomes an itemized invoice (quoted price minus
  // each deduction) and the final offer is computed HERE from the quote —
  // we never trust a client-sent total against the line items. Sanitize
  // labels (they land in the signed token, the email, and the /counter
  // page) and coerce amounts to non-negative whole dollars.
  const rawDeductions = Array.isArray(body.deductions) ? body.deductions : [];
  const deductions = rawDeductions
    .map((d) => ({
      label: typeof d?.label === "string" ? d.label.replace(/[\[\]\r\n]/g, " ").trim().slice(0, 80) : "",
      amount: typeof d?.amount === "number" && isFinite(d.amount) ? Math.max(0, Math.round(d.amount)) : NaN,
    }))
    .filter((d) => d.label && isFinite(d.amount))
    .slice(0, 15);
  const deductionTotal = deductions.reduce((s, d) => s + d.amount, 0);

  // Multi-device order: one sanitized line per device, each with its own
  // quote + deductions. Grand total = Σ device totals. Takes precedence over
  // the single-device deductions path when there's more than one device.
  const rawItems = Array.isArray(body.items) ? body.items : [];
  const multiItems = rawItems
    .map((it) => ({
      device: typeof it?.device === "string" ? it.device.replace(/[\[\]\r\n]/g, " ").trim().slice(0, 80) : "",
      storage: typeof it?.storage === "string" ? it.storage.replace(/[\[\]\r\n]/g, " ").trim().slice(0, 30) : "",
      quote: typeof it?.quote === "number" && isFinite(it.quote) ? Math.max(0, Math.round(it.quote)) : NaN,
      deductions: (Array.isArray(it?.deductions) ? it.deductions : [])
        .map((d: { label?: unknown; amount?: unknown }) => ({
          label: typeof d?.label === "string" ? d.label.replace(/[\[\]\r\n]/g, " ").trim().slice(0, 80) : "",
          amount: typeof d?.amount === "number" && isFinite(d.amount) ? Math.max(0, Math.round(d.amount)) : NaN,
        }))
        .filter((d) => d.label && isFinite(d.amount))
        .slice(0, 15),
    }))
    .filter((it) => isFinite(it.quote))
    .slice(0, 30);
  const isMulti = multiItems.length > 1;
  const itemsGrandQuote = multiItems.reduce((s, it) => s + it.quote, 0);
  const itemsGrandTotal = multiItems.reduce((s, it) => s + Math.max(0, it.quote - it.deductions.reduce((a, d) => a + d.amount, 0)), 0);

  const isItemized = !isMulti && deductions.length > 0;

  const roundedQuote = isMulti ? itemsGrandQuote : Math.round(originalQuote);
  // Multi ⇒ grand total. Itemized single ⇒ quote − deductions. Otherwise the
  // amount staff typed (plain final invoice or a lump revised offer).
  const finalOffer = isMulti ? itemsGrandTotal : isItemized ? Math.max(0, Math.round(originalQuote) - deductionTotal) : Math.round(offer);

  // A "final invoice" is a plain single-device offer at (or above) the quote
  // with no deductions — confirm & pay, no reason. A reason is required only
  // for a LUMP revised offer (lower price, no line items). Itemized / multi
  // offers explain themselves via their lines.
  const isFinal = !isMulti && !isItemized && finalOffer >= Math.round(originalQuote);
  const reasonText = (reason || "").trim();
  if (!isMulti && !isItemized && !isFinal && !reasonText) {
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
    originalQuote: roundedQuote,
    offer: finalOffer,
    reason: reasonText.slice(0, 500),
    ...(device ? { device: String(device).slice(0, 80) } : {}),
    ...(isItemized ? { deductions } : {}),
    ...(isMulti ? { items: multiItems } : {}),
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
        body: `[COUNTER-OFFER: ${leadId}] type=${isMulti ? "multi-device" : isItemized ? "itemized" : isFinal ? "final-invoice" : "counter"} original=$${roundedQuote} offer=$${finalOffer}${isMulti ? ` items=${multiItems.length} (${multiItems.map((it) => `${it.device || "device"} $${Math.max(0, it.quote - it.deductions.reduce((a, d) => a + d.amount, 0))}`).join("; ").replace(/[[\]\n\r]/g, " ").slice(0, 300)})` : isItemized ? ` deductions=${deductions.map((d) => `${d.label} -$${d.amount}`).join("; ").replace(/[[\]\n\r]/g, " ").slice(0, 300)}` : ` reason=${reasonText.replace(/[[\]\n\r]/g, " ").slice(0, 300)}`}`,
        tags: ["counter-offer", "pending", isMulti ? "multi-device" : isItemized ? "itemized" : isFinal ? "final-invoice" : "counter"],
        priority: "normal",
      }),
    });
  } catch (err) {
    reportError("counter-offer.mc.marker", err, { leadId, critical: false });
  }

  const first = (name || "there").split(" ")[0];
  const dev = device || "your device";
  const diff = roundedQuote - finalOffer;

  let smsSent = false;
  let emailSent = false;

  if (phone) {
    const smsBody = isMulti
      ? `Top Cash: Hi ${first}, here's your itemized offer for all ${multiItems.length} devices. Order total $${finalOffer}. See the full breakdown & approve: ${offerUrl}`
      : isItemized
      ? `Top Cash: Hi ${first}, here's your itemized offer for ${dev}. Quote $${roundedQuote} − $${deductionTotal} in deductions = $${finalOffer}. See the breakdown & approve: ${offerUrl}`
      : isFinal
      ? `Top Cash: Hi ${first}, we inspected ${dev} and it checks out. Final offer $${finalOffer}. Approve it and we pay you: ${offerUrl}`
      : `Top Cash: Hi ${first}, we inspected ${dev}. Original quote $${roundedQuote}, revised offer $${finalOffer} (${reasonText.slice(0, 100)}). Accept or decline: ${offerUrl}`;
    smsSent = await sendSms(phone, smsBody);
    if (!smsSent) {
      reportError("counter-offer.sms.send", new Error("Twilio send failed"), { leadId, critical: false, extra: { phone } });
    }
  }

  if (email && RESEND_KEY) {
    try {
      const { Resend } = await import("resend");
      const resend = new Resend(RESEND_KEY);
      const html = buildCounterOfferEmail({ name: first, device: dev, originalQuote: roundedQuote, offer: finalOffer, reason: reasonText, offerUrl, diff, isFinal, deductions, ...(isMulti ? { items: multiItems } : {}) });
      const itemizedText = deductions.map((d) => `  - ${d.label}: -$${d.amount}`).join("\n");
      const multiText = multiItems.map((it) => {
        const t = Math.max(0, it.quote - it.deductions.reduce((a, d) => a + d.amount, 0));
        const dl = it.deductions.map((d) => `      - ${d.label}: -$${d.amount}`).join("\n");
        return `  ${it.device || "Device"}${it.storage ? ` (${it.storage})` : ""}: quote $${it.quote}${dl ? `\n${dl}` : ""}\n      Device total: $${t}`;
      }).join("\n");
      const r = await resend.emails.send({
        from: "Top Cash Cellular <noreply@topcashcellular.com>",
        replyTo: "support@topcashcellular.com",
        to: [email],
        subject: isMulti
          ? `Your itemized offer — ${multiItems.length} devices — Top Cash Cellular`
          : isItemized
          ? `Your itemized offer for ${dev} — Top Cash Cellular`
          : isFinal
          ? `Your final offer for ${dev} — Top Cash Cellular`
          : `Revised offer for ${dev} — Top Cash Cellular`,
        html,
        text: isMulti
          ? `Hi ${first}, here's your itemized offer for all ${multiItems.length} devices.\n\n${multiText}\n\nOrder total: $${finalOffer}\n\nReview & approve: ${offerUrl}\n\n— Top Cash Cellular`
          : isItemized
          ? `Hi ${first}, here's your itemized offer for ${dev}.\n\nQuoted price: $${roundedQuote}\nDeductions:\n${itemizedText}\nFinal offer: $${finalOffer}\n\nReview & approve: ${offerUrl}\n\n— Top Cash Cellular`
          : isFinal
          ? `Hi ${first}, we inspected ${dev} and it checks out. Final offer: $${finalOffer}.\n\nApprove it and we pay you within 24 hours: ${offerUrl}\n\n— Top Cash Cellular`
          : `Hi ${first}, we inspected ${dev}. Original quote: $${roundedQuote}. Revised offer: $${finalOffer}.\n\nReason: ${reasonText}\n\nAccept or decline: ${offerUrl}\n\n— Top Cash Cellular`,
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

type InvoiceItem = { device?: string; storage?: string; quote: number; deductions?: Array<{ label: string; amount: number }> };
function buildCounterOfferEmail(args: { name: string; device: string; originalQuote: number; offer: number; reason: string; offerUrl: string; diff: number; isFinal: boolean; deductions?: Array<{ label: string; amount: number }>; items?: InvoiceItem[] }): string {
  const { name, device, originalQuote, offer, reason, offerUrl, diff, isFinal, deductions = [], items = [] } = args;
  // Escape customer-submitted name/device and the admin-typed reason before
  // they enter the email HTML (reason previously only stripped <>). (bug fix)
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const nameHtml = esc(name);
  const deviceHtml = esc(device);
  const reasonHtml = esc(reason);
  const isItemized = deductions.length > 0;
  const dedTotal = deductions.reduce((s, d) => s + d.amount, 0);

  // MULTI-DEVICE INVOICE — one receipt listing every device in the order,
  // each with its own quoted price and deductions, down to a grand total.
  if (items.length > 1) {
    const blocks = items.map((it, idx) => {
      const dds = it.deductions ?? [];
      const itTotal = Math.max(0, Math.round(it.quote) - dds.reduce((s, d) => s + d.amount, 0));
      const img = mailDeviceImg(it.device, 46);
      const dedRows = dds.map((d) => `<tr>
<td style="padding:6px 0 6px 12px;font-size:13px;color:#cfcfcf">${esc(d.label)}</td>
<td style="padding:6px 0;font-size:13px;color:#ff8a80;font-weight:700;text-align:right;white-space:nowrap">− $${d.amount}</td>
</tr>`).join("");
      return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top:${idx === 0 ? "0" : "1px solid rgba(255,255,255,0.08)"};padding:0">
<tr>
${img ? `<td width="46" style="width:46px;padding:14px 12px 6px 0;vertical-align:top">${img}</td>` : ""}
<td style="padding:14px 0 6px;vertical-align:top"><div style="font-size:15px;color:#fff;font-weight:700">${esc(it.device || `Device ${idx + 1}`)}${it.storage ? `<span style="color:#8a8a8a;font-weight:400"> · ${esc(it.storage)}</span>` : ""}</div></td>
<td style="padding:14px 0 6px;font-size:14px;color:#bdbdbd;text-align:right;vertical-align:top;white-space:nowrap">$${Math.round(it.quote)}</td>
</tr>
<tr><td colspan="${img ? 3 : 2}" style="padding:0"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${dedRows}
<tr><td style="padding:6px 0 12px 12px;font-size:13px;color:#8a8a8a">Device total</td><td style="padding:6px 0 12px;font-size:15px;color:#00c853;font-weight:800;text-align:right">$${itTotal}</td></tr>
</table></td></tr>
</table>`;
    }).join("");
    const grand = items.reduce((s, it) => s + Math.max(0, Math.round(it.quote) - (it.deductions ?? []).reduce((a, d) => a + d.amount, 0)), 0);
    const cardInner = `${blocks}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top:2px solid rgba(255,255,255,0.14);margin-top:4px">
<tr><td style="padding:14px 0 2px;font-size:15px;color:#fff;font-weight:800">Order total <span style="color:#8a8a8a;font-weight:400">· ${items.length} items</span></td><td style="padding:14px 0 2px;font-size:26px;color:#00c853;font-weight:800;text-align:right">$${grand}</td></tr>
</table>`;
    return emailShell({
      headline: `Your itemized offer — ${items.length} devices`,
      nameHtml,
      introHtml: `We inspected all ${items.length} devices in your order and put together one honest, itemized offer. Here&apos;s the price on each — every deduction spelled out.`,
      cardInner,
      extraBlock: `<tr><td style="padding:14px 28px 0;font-size:12px;color:#8a8a8a;line-height:1.6">One approval pays out the whole order. Questions on any line? Just reply — a real person reads it.</td></tr>`,
      offerUrl,
      ctaLabel: "Approve &amp; get paid →",
      ctaSub: "Approve the itemized offer and we pay you within 24 hours. Not right? Decline and we return your devices free — no questions asked.",
    });
  }

  // ITEMIZED INVOICE — a real receipt-style breakdown: quoted price, each
  // deduction as a line, and the final offer. Used only when staff entered
  // line items; the plain single-line emails handle the no-deduction case.
  if (isItemized) {
    const rows = deductions.map((d) => `<tr>
<td style="padding:9px 0;font-size:14px;color:#e6e6e6;border-bottom:1px solid rgba(255,255,255,0.06)">${esc(d.label)}</td>
<td style="padding:9px 0;font-size:14px;color:#ff8a80;font-weight:700;text-align:right;border-bottom:1px solid rgba(255,255,255,0.06);white-space:nowrap">− $${d.amount}</td>
</tr>`).join("");
    // Product photo + name header, so the invoice reads like a real receipt
    // for THIS device. mailDeviceImg returns "" when the catalog has no
    // image, and the row collapses to just the device name.
    const img = mailDeviceImg(device, 60);
    const deviceHeader = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:14px"><tr>
${img ? `<td width="60" style="width:60px;padding-right:14px;vertical-align:middle">${img}</td>` : ""}
<td style="vertical-align:middle"><div style="font-size:11px;color:#8a8a8a;letter-spacing:0.14em;text-transform:uppercase;font-weight:700">Item</div><div style="font-size:16px;color:#fff;font-weight:700">${deviceHtml}</div></td>
</tr></table>`;
    const invoiceTable = `${deviceHeader}<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
<tr><td style="padding:2px 0 10px;font-size:14px;color:#bdbdbd">Quoted price</td><td style="padding:2px 0 10px;font-size:16px;color:#fff;font-weight:700;text-align:right">$${originalQuote}</td></tr>
<tr><td colspan="2" style="padding:6px 0 4px;font-size:11px;color:#ffb400;letter-spacing:0.14em;text-transform:uppercase;font-weight:800">Deductions at inspection</td></tr>
${rows}
<tr><td style="padding:14px 0 2px;font-size:15px;color:#fff;font-weight:800">Final offer</td><td style="padding:14px 0 2px;font-size:26px;color:#00c853;font-weight:800;text-align:right">$${offer}</td></tr>
</table>`;
    return emailShell({
      headline: "Your itemized offer",
      nameHtml,
      introHtml: `We inspected <strong style="color:#fff">${deviceHtml}</strong> and put together an honest, itemized offer. Here&apos;s exactly how we got to the number — every deduction is spelled out below.`,
      cardInner: invoiceTable,
      extraBlock: `<tr><td style="padding:14px 28px 0;font-size:12px;color:#8a8a8a;line-height:1.6">Total deductions: <strong style="color:#ff8a80">−$${dedTotal}</strong> off the $${originalQuote} quote. Questions on any line? Just reply — a real person reads it.</td></tr>`,
      offerUrl,
      ctaLabel: "Approve &amp; get paid →",
      ctaSub: "Approve the itemized offer and we pay you within 24 hours. Not right? Decline and we return your device free — no questions asked.",
    });
  }

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
  return emailShell({
    headline,
    nameHtml,
    introHtml: intro,
    cardInner: amountBlock,
    extraBlock: reasonBlock,
    offerUrl,
    ctaLabel,
    ctaSub,
  });
}

// Shared brand wrapper for every counter/final/itemized offer email: gold
// header + logo, "Hi <name>", a card holding the offer/invoice, an optional
// extra block (reason or deduction total), the green CTA, and the footer.
function emailShell(a: { headline: string; nameHtml: string; introHtml: string; cardInner: string; extraBlock: string; offerUrl: string; ctaLabel: string; ctaSub: string }): string {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="dark"><meta name="supported-color-schemes" content="dark"></head>
<body style="margin:0;padding:0;background:#13142b;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#e6e6e6">
<div style="background:#13142b;padding:32px 16px">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;margin:0 auto;background:#1b1d39;border:1px solid rgba(255,255,255,0.08);border-radius:18px;overflow:hidden">
<tr><td style="background:#ff9100;background:linear-gradient(135deg,#ffd54f 0%,#ff9100 100%);padding:24px 28px">
<div style="margin:0 0 16px">${mailLogo()}</div>
<div style="font-size:22px;font-weight:800;color:#1a1100;line-height:1.1">${a.headline}</div>
</td></tr>

<tr><td style="padding:28px 28px 8px 28px">
<div style="font-size:16px;color:#fff;font-weight:600;margin-bottom:14px">Hi ${a.nameHtml},</div>
<p style="margin:0 0 16px;font-size:14px;line-height:1.65;color:#e6e6e6">
  ${a.introHtml}
</p>
</td></tr>

<tr><td style="padding:8px 28px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.10);border-radius:14px">
<tr><td style="padding:18px 22px">
${a.cardInner}
</td></tr>
</table>
</td></tr>

${a.extraBlock}

<tr><td style="padding:24px 28px 8px 28px;text-align:center">
${mailButton(a.offerUrl, a.ctaLabel, "green")}
<p style="font-size:11px;color:#888;margin:12px 4px 0;line-height:1.55">${a.ctaSub}</p>
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
