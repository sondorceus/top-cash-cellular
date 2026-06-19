// GET /api/offer/[leadId] — single-offer detail for the customer-facing
// /offer/[leadId] page. Returns parsed lead body + status pipeline +
// FedEx label + tracking. Public — the leadId itself (a UUID-shaped MC
// message id) is the secret. Follows the same trust model as FedEx
// tracking-number links. Skywalker 2026-05-19.

import { NextRequest, NextResponse } from "next/server";
import { referralCodeForEmail, referralLinkForCode } from "../../../lib/referral";
import { field, DEVICE_LINE_RE, OFFER_STATUSES } from "../../../lib/lead-devices";

const MC_API = "https://missioncontrolsdjg-production.up.railway.app";
const MC_KEY = process.env.MC_API_KEY || "";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ leadId: string }> }) {
  const { leadId } = await ctx.params;
  if (!leadId || !/^[\w-]+$/.test(leadId)) {
    return NextResponse.json({ error: "Invalid offer id" }, { status: 400 });
  }
  if (!MC_KEY) {
    return NextResponse.json({ error: "Offer service unavailable" }, { status: 503 });
  }
  const r = await fetch(`${MC_API}/api/comms?limit=1000`, {
    headers: { "x-api-key": MC_KEY },
    cache: "no-store",
  });
  if (!r.ok) return NextResponse.json({ error: "Offer service unavailable" }, { status: 502 });
  const data = await r.json();
  const messages: { id: string; body?: string; timestamp: string }[] = data.messages || [];
  const leadMsg = messages.find((m) => m.id === leadId);
  if (!leadMsg?.body) {
    return NextResponse.json({ found: false }, { status: 404 });
  }
  const body = leadMsg.body;
  if (!/\[NEW BUYBACK LEAD(\b| — \d+ DEVICES\])/i.test(body)) {
    return NextResponse.json({ found: false }, { status: 404 });
  }

  // Parse the status + label markers tied to this lead.
  let status = "quote_requested";
  let statusAt = "";
  let fedexTracking = "";
  let fedexLabelUrl = "";
  let fedexService = "";
  let fedexErrorKind = "";
  let fedexErrorReason = "";
  // Customer-edited phone — the latest [CONTACT-UPDATE] marker wins.
  let phoneOverride = "";
  let phoneOverrideAt = "";
  // Customer-edited devices — the latest [ITEM-UPDATE] marker wins.
  let itemUpdate: { devices: Array<{ model?: unknown; storage?: unknown; condition?: unknown; quote?: unknown; quantity?: unknown; needsReview?: unknown }>; total?: unknown } | null = null;
  let itemUpdateAt = "";
  // Inspection-time price revisions. Without resolving these here, a customer
  // who accepts a revised counter-offer — or whose quote staff adjusted at
  // inspection — keeps seeing the ORIGINAL payout on their offer page.
  let counterOfferAmt: number | null = null;
  let counterOfferAt = "";
  let counterRespAccept: boolean | null = null;
  let counterRespAt = "";
  let quoteAdjustedAmt: number | null = null;
  let quoteAdjustedAt = "";
  for (const m of messages) {
    if (!m.body) continue;
    const cu = m.body.match(new RegExp(`\\[CONTACT-UPDATE:\\s*${leadId}\\][^\\n]*phone=([^\\n]+)`, "i"));
    if (cu && (!phoneOverrideAt || m.timestamp > phoneOverrideAt)) {
      phoneOverride = cu[1].trim();
      phoneOverrideAt = m.timestamp;
    }
    const iu = m.body.match(new RegExp(`\\[ITEM-UPDATE:\\s*${leadId}\\][^\\n]*?(\\{.*\\})`, "i"));
    if (iu && (!itemUpdateAt || m.timestamp > itemUpdateAt)) {
      try {
        const parsed = JSON.parse(iu[1]);
        if (parsed && Array.isArray(parsed.devices)) { itemUpdate = parsed; itemUpdateAt = m.timestamp; }
      } catch { /* ignore malformed marker */ }
    }
    const sm = m.body.match(new RegExp(`\\[STATUS:\\s*(\\w+)\\]\\s*\\[LEAD:\\s*${leadId}\\]`, "i"));
    if (sm && (OFFER_STATUSES as readonly string[]).includes(sm[1].toLowerCase())) {
      if (!statusAt || m.timestamp > statusAt) {
        status = sm[1].toLowerCase();
        statusAt = m.timestamp;
      }
    }
    if (m.body.includes(`[LABEL: ${leadId}]`)) {
      const t = m.body.match(/tracking=([^\s]+)/i)?.[1];
      const u = m.body.match(/url=([^\s]+)/i)?.[1];
      const sv = m.body.match(/service=([^\s]+)/i)?.[1];
      if (t && u) { fedexTracking = t; fedexLabelUrl = u; if (sv) fedexService = sv; }
    }
    if (m.body.includes(`[LABEL-FAILED: ${leadId}]`)) {
      const k = m.body.match(/kind=([^\s]+)/i)?.[1];
      const reason = m.body.match(/reason=(.+)$/im)?.[1]?.trim();
      if (!fedexTracking) {
        fedexErrorKind = k || "";
        fedexErrorReason = reason || "";
      }
    }
    // Staff counter-offer + the customer's accept/decline. Decimal/comma-safe
    // (same parse as the admin leads route).
    const co = m.body.match(new RegExp(`\\[COUNTER-OFFER:\\s*${leadId}\\][^\\n]*?offer=\\$?([\\d,]+(?:\\.\\d+)?)`, "i"));
    if (co && (!counterOfferAt || m.timestamp > counterOfferAt)) {
      counterOfferAmt = Math.round(parseFloat(co[1].replace(/,/g, "")));
      counterOfferAt = m.timestamp;
    }
    const cr = m.body.match(new RegExp(`\\[COUNTER-RESPONSE:\\s*${leadId}\\][^\\n]*?response=(accept|decline)`, "i"));
    if (cr && (!counterRespAt || m.timestamp > counterRespAt)) {
      counterRespAccept = cr[1].toLowerCase() === "accept";
      counterRespAt = m.timestamp;
    }
    // Staff quote adjustment at inspection: "[QUOTE ADJUSTED: $N] [LEAD: id]".
    const qa = m.body.match(new RegExp(`\\[QUOTE ADJUSTED:\\s*\\$?([\\d,]+(?:\\.\\d+)?)\\]\\s*\\[LEAD:\\s*${leadId}\\]`, "i"));
    if (qa && (!quoteAdjustedAt || m.timestamp > quoteAdjustedAt)) {
      quoteAdjustedAmt = Math.round(parseFloat(qa[1].replace(/,/g, "")));
      quoteAdjustedAt = m.timestamp;
    }
  }

  // Parse handoff method + address + slot from the lead body. The lead
  // body writes a header marker — "--- Handoff: SHIPPING ---" or
  // "--- Handoff: LOCAL MEETUP ---" — NOT a plain "Handoff:" field. The
  // old field(body,"Handoff") match never hit, so handoffMethod was
  // always undefined and every offer fell through to the local-meetup
  // banner. Match the real marker (same as the admin leads parser).
  // Skywalker 2026-05-20.
  const handoffMethod: "ship" | "local" | undefined =
    /---\s*Handoff:\s*SHIPPING/i.test(body) ? "ship" :
    /---\s*Handoff:\s*LOCAL MEETUP/i.test(body) ? "local" : undefined;
  // Ship leads store the address as one "Address: ..." line.
  const shipAddress = handoffMethod === "ship" ? field(body, "Address") : undefined;
  // Strip the staff-only "(id=...)" tail so the customer sees a clean
  // "Fri, May 29 · Any time" instead of a raw MC slot id. Also repair the
  // legacy "12:undefined AM" / "NaN:.." times that older leads baked into
  // their body (all-day slots whose empty time printed as undefined) so
  // those existing offers read cleanly without a re-submit.
  const localSlotRaw = handoffMethod === "local" ? field(body, "Slot") : undefined;
  const localSlot = localSlotRaw
    ? localSlotRaw
        .replace(/\s*\(id=[^)]*\)\s*$/, "")
        .replace(/\d{0,2}:?(?:undefined|NaN)(?:\s*[AP]M)?/gi, "Any time")
        .trim()
    : undefined;

  // Multi-device parsing — same shape /api/admin/leads emits, simplified.
  let devices: Array<{ model: string; storage?: string; condition?: string; quote?: number; quantity?: number }> | undefined;
  let deviceCount: number | undefined;
  let totalPayout: number | undefined;
  const headerMatch = body.match(/^Devices:\s*(\d+)\s*$/m);
  if (headerMatch) {
    deviceCount = parseInt(headerMatch[1], 10) || undefined;
    const lines = body.split("\n");
    // Per-device line: "  1. Model · Storage · Condition · $Quote[ total][ (×N)][ · 🤝 LOCAL]"
    // The trailing handoff tag (· 🤝 LOCAL / · 📦 SHIP) and the " total"
    // suffix used to break the old anchored regex, so multi-device offers
    // collapsed to a single generic "N devices" row with no per-device
    // photos. Tolerate both: consume " total", the (×N) tag, and any
    // trailing " · ..." segment after the quote.
    devices = [];
    for (const line of lines) {
      const dm = line.match(DEVICE_LINE_RE);
      if (!dm) continue;
      const [, , dLabel, dStorage, dCondition, dQuote, dQty] = dm;
      devices.push({
        model: dLabel.trim(),
        storage: dStorage?.trim(),
        condition: dCondition?.trim(),
        quote: dQuote ? parseInt(dQuote.replace(/,/g, ""), 10) : undefined,
        quantity: dQty ? parseInt(dQty, 10) : undefined,
      });
    }
    const totalMatch = body.match(/^Total payout:\s*\$([0-9,]+(?:\.\d+)?)/m);
    if (totalMatch) totalPayout = Math.round(parseFloat(totalMatch[1].replace(/,/g, "")));
  }

  // Cancellation / deletion check — staff can soft-delete leads.
  const cancelled = messages.some((m) => m.body?.includes(`[DELETED-LEAD: ${leadId}]`));

  // Apply a customer device edit (latest [ITEM-UPDATE]) as an override
  // of the parsed device list + total.
  if (itemUpdate) {
    devices = itemUpdate.devices.map((d) => ({
      model: String(d.model ?? "Device"),
      storage: d.storage ? String(d.storage) : undefined,
      condition: d.condition ? String(d.condition) : undefined,
      quote: Number.isFinite(Number(d.quote)) ? Number(d.quote) : undefined,
      quantity: Number.isFinite(Number(d.quantity)) ? Number(d.quantity) : undefined,
      needsReview: !!d.needsReview,
    }));
    deviceCount = devices.length;
    totalPayout = Number.isFinite(Number(itemUpdate.total))
      ? Number(itemUpdate.total)
      : devices.reduce((s, d) => s + (d.quote || 0), 0);
  }

  // Resolve the FINAL negotiated payout. An accepted counter-offer or a
  // staff quote adjustment supersedes the original/edited total — whichever
  // is most recent wins. This is the number the customer agreed to; without
  // it the offer page keeps showing the pre-negotiation figure.
  let offerRevised: { amount: number; kind: "counter" | "adjusted" } | undefined;
  if (counterRespAccept === true && counterOfferAmt != null) {
    offerRevised = { amount: counterOfferAmt, kind: "counter" };
  }
  if (quoteAdjustedAmt != null && (!offerRevised || quoteAdjustedAt > counterRespAt)) {
    offerRevised = { amount: quoteAdjustedAmt, kind: "adjusted" };
  }
  if (offerRevised && offerRevised.amount >= 0) {
    totalPayout = offerRevised.amount;
  }

  // Refer-a-friend — the customer's own share code is deterministic
  // from their email (referralCodeForEmail), so we can surface it on the
  // offer page (a happy post-sale moment) without a login. leadId is the
  // secret here, same trust model as the rest of this payload.
  const customerEmail = field(body, "Email");
  const referralCode = customerEmail ? referralCodeForEmail(customerEmail) : undefined;
  const referralLink = referralCode ? referralLinkForCode(referralCode) : undefined;

  return NextResponse.json({
    found: true,
    id: leadId,
    timestamp: leadMsg.timestamp,
    name: field(body, "Name"),
    phone: phoneOverride || field(body, "Phone"),
    email: customerEmail,
    referralCode,
    referralLink,
    device: field(body, "Device"),
    // The lead body has no standalone "Model:" line — the model is the
    // second half of the "Device: <type> — <model>" line. Parse it out
    // so the offer page gets a clean model name (needed for the device
    // photo lookup and a tidy display).
    model: field(body, "Model") || field(body, "Device")?.split(" — ")[1]?.trim(),
    storage: field(body, "Storage"),
    condition: field(body, "Condition"),
    carrier: field(body, "Carrier"),
    // Single-device unit count (the "Quantity:" line). Multi-device
    // leads carry per-device counts instead, so this stays undefined
    // for them.
    quantity: (() => {
      const q = field(body, "Quantity");
      const n = q ? parseInt(q, 10) : NaN;
      return Number.isFinite(n) && n > 0 ? n : undefined;
    })(),
    // Strip the internal tamper note — the lead body writes
    // "Quote: $500 (clamped from $700)" on a clamp, and this string is shown
    // to the customer as their payout. Never leak the fraud-flag language.
    quote: field(body, "Quote")?.replace(/\s*\(clamped from[^)]*\)/i, "").trim(),
    payout: field(body, "Payout"),
    handoffMethod,
    shipAddress,
    localSlot,
    devices,
    deviceCount,
    totalPayout,
    // Present when a counter-offer was accepted or staff adjusted the quote at
    // inspection — lets the page show "revised offer" context, and guarantees
    // the headline total above reflects the agreed number.
    offerRevised,
    status: cancelled ? "rejected" : status,
    statusAt,
    fedexTracking: fedexTracking || undefined,
    fedexLabelUrl: fedexLabelUrl || undefined,
    fedexService: fedexService || undefined,
    fedexErrorKind: fedexErrorKind || undefined,
    fedexErrorReason: fedexErrorReason || undefined,
    cancelled,
    // True when a customer edit flagged a device for manual review
    // (broken + won't power on) — it can't be auto-quoted.
    needsReview: !!itemUpdate && (itemUpdate.devices || []).some((d) => !!d.needsReview),
  }, { headers: { "Cache-Control": "no-store" } });
}
