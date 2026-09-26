// GET /api/offer/[leadId] — single-offer detail for the customer-facing
// /offer/[leadId] page. Returns parsed lead body + status pipeline +
// FedEx label + tracking. Public — the leadId itself (a UUID-shaped MC
// message id) is the secret. Follows the same trust model as FedEx
// tracking-number links. Skywalker 2026-05-19.

import { NextRequest, NextResponse, after } from "next/server";
import { referralCodeForEmail, referralLinkForCode, referralCodeMarker, hasReferralCodeMarker } from "../../../lib/referral";
import { field, DEVICE_LINE_RE, OFFER_STATUSES, parseOfferBonus, isCustomerLeadPost } from "../../../lib/lead-devices";
import { canonicalCarrier, carrierLockedFromText } from "../../../lib/quote-engine";
import { fetchCommsRead } from "../../../lib/mc-comms";

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
  // limit=5000 (full live cap, was 1000): the offer is resolved by id from
  // this slice, so an older offer 404'd once the feed grew past the window.
  // 5000 is MC's live cap — covers an offer's full life at current volume.
  // (If offers ever need to resolve from the trimmed archive, add
  // includeArchive — see app/lib/mc-comms.ts.) memoMs: every open of a
  // receipt link paid this ~5000-message read; a seller re-tapping, or the
  // page's own reloads, now share it for 15 s.
  const read = await fetchCommsRead({ apiKey: MC_KEY, pageSize: 5000, maxPages: 1, includeArchive: false, memoMs: 15_000 });
  if (!read.complete) return NextResponse.json({ error: "Offer service unavailable" }, { status: 502 });
  const messages: { id: string; body?: string; timestamp: string }[] = read.messages;
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
  // Customer-visible payout proof — parsed from the freshest paid/met
  // [STATUS] message's "Payout-confirmation:" line. Surfaces the method,
  // reference (Zelle conf #, BTC txhash, Cash App receipt, …) and the
  // amount actually sent so a remote customer can self-confirm a transfer
  // landed instead of emailing "did I get paid?". The internal staff `note`
  // is deliberately NOT surfaced.
  let payoutMethod = "";
  let payoutRef = "";
  let payoutAmount: number | null = null;
  // The lead id is constant for the request — these were six `new RegExp`
  // per message (30,000 compilations per receipt view), and every marker
  // below names the id literally, so a message without it is skipped first.
  const RE_CONTACT = new RegExp(`\\[CONTACT-UPDATE:\\s*${leadId}\\][^\\n]*phone=([^\\n]+)`, "i");
  const RE_ITEMS = new RegExp(`\\[ITEM-UPDATE:\\s*${leadId}\\][^\\n]*?(\\{.*\\})`, "i");
  const RE_STATUS = new RegExp(`\\[STATUS:\\s*(\\w+)\\]\\s*\\[LEAD:\\s*${leadId}\\]`, "i");
  const RE_COUNTER = new RegExp(`\\[COUNTER-OFFER:\\s*${leadId}\\][^\\n]*?offer=\\$?([\\d,]+(?:\\.\\d+)?)`, "i");
  const RE_COUNTER_RESP = new RegExp(`\\[COUNTER-RESPONSE:\\s*${leadId}\\][^\\n]*?response=(accept|decline)`, "i");
  const RE_ADJUSTED = new RegExp(`\\[QUOTE ADJUSTED:\\s*\\$?([\\d,]+(?:\\.\\d+)?)\\]\\s*\\[LEAD:\\s*${leadId}\\]`, "i");
  for (const m of messages) {
    // Staff/system markers are their own posts; one inside a customer lead
    // body (this lead's or another's) is forged — see isCustomerLeadPost.
    if (!m.body || !m.body.includes(leadId) || isCustomerLeadPost(m.body)) continue;
    const cu = m.body.match(RE_CONTACT);
    if (cu && (!phoneOverrideAt || m.timestamp > phoneOverrideAt)) {
      phoneOverride = cu[1].trim();
      phoneOverrideAt = m.timestamp;
    }
    const iu = m.body.match(RE_ITEMS);
    if (iu && (!itemUpdateAt || m.timestamp > itemUpdateAt)) {
      try {
        const parsed = JSON.parse(iu[1]);
        if (parsed && Array.isArray(parsed.devices)) { itemUpdate = parsed; itemUpdateAt = m.timestamp; }
      } catch { /* ignore malformed marker */ }
    }
    const sm = m.body.match(RE_STATUS);
    if (sm && (OFFER_STATUSES as readonly string[]).includes(sm[1].toLowerCase())) {
      if (!statusAt || m.timestamp > statusAt) {
        status = sm[1].toLowerCase();
        statusAt = m.timestamp;
        // Re-parse payout proof from THIS freshest status message (a later
        // status flip with no payout line should clear a stale proof).
        payoutMethod = ""; payoutRef = ""; payoutAmount = null;
        if (status === "paid" || status === "met") {
          const pc = m.body.match(/Payout-confirmation:\s*([^\n]+)/i)?.[1] || "";
          payoutMethod = pc.match(/method=([^·\n]+?)(?:\s*·|$)/i)?.[1]?.trim() || "";
          payoutRef = pc.match(/ref=([^·\n]+?)(?:\s*·|$)/i)?.[1]?.trim() || "";
          const am = pc.match(/amount=([\d.]+)/i)?.[1];
          payoutAmount = am && Number.isFinite(Number(am)) ? Number(am) : null;
        }
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
    const co = m.body.match(RE_COUNTER);
    if (co && (!counterOfferAt || m.timestamp > counterOfferAt)) {
      counterOfferAmt = Math.round(parseFloat(co[1].replace(/,/g, "")));
      counterOfferAt = m.timestamp;
    }
    const cr = m.body.match(RE_COUNTER_RESP);
    if (cr && (!counterRespAt || m.timestamp > counterRespAt)) {
      counterRespAccept = cr[1].toLowerCase() === "accept";
      counterRespAt = m.timestamp;
    }
    // Staff quote adjustment at inspection: "[QUOTE ADJUSTED: $N] [LEAD: id]".
    const qa = m.body.match(RE_ADJUSTED);
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
  // \n-bounded, not /m — /m also starts lines at U+2028/U+2029 (lead-money).
  const headerMatch = body.match(/(?:^|\n)Devices:[ \t]*(\d+)[ \t]*(?=\r?\n|$)/);
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
    // \n only — /m also splits at U+2028/U+2029 (see lead-money).
    const totalMatch = body.match(/(?:^|\n)Total payout:[ \t]*\$([0-9,]+(?:\.\d+)?)/);
    if (totalMatch) totalPayout = Math.round(parseFloat(totalMatch[1].replace(/,/g, "")));
  }

  // Coupon ($) + referral credit recorded at submit. Surfaced as its own
  // line on the offer page (not baked into a device price) and preserved
  // across device edits — the marker lives in the IMMUTABLE original body,
  // so an [ITEM-UPDATE] (which carries only device lines) can't strip it.
  // Shared whole-line parse — a customer-typed copy of the marker inside
  // another line must not add a bonus here.
  let bonus = parseOfferBonus(body);

  // Cancellation / deletion check — staff can soft-delete leads.
  const cancelled = messages.some((m) => !isCustomerLeadPost(m.body) && !!m.body?.includes(`[DELETED-LEAD: ${leadId}]`));

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
    // The [ITEM-UPDATE] marker stores only the edited device subtotal, so
    // re-add the bonus on top — otherwise a customer edit silently drops the
    // coupon/referral credit from their total.
    const editedSubtotal = Number.isFinite(Number(itemUpdate.total))
      ? Number(itemUpdate.total)
      : devices.reduce((s, d) => s + (d.quote || 0), 0);
    totalPayout = editedSubtotal + bonus;
  }

  // Resolve the FINAL negotiated payout. An accepted counter-offer or a
  // staff quote adjustment supersedes the original/edited total — whichever
  // is most recent wins. This is the number the customer agreed to; without
  // it the offer page keeps showing the pre-negotiation figure.
  let offerRevised: { amount: number; kind: "counter" | "adjusted" } | undefined;
  // An accept only counts for the LATEST counter-offer when it was posted at
  // or after that mint (same pairing as the admin leads route). An accept of
  // an earlier offer must not be shown as agreement to a re-issued one.
  if (counterRespAccept === true && counterOfferAmt != null && counterRespAt >= counterOfferAt) {
    offerRevised = { amount: counterOfferAmt, kind: "counter" };
  }
  if (quoteAdjustedAmt != null && (!offerRevised || quoteAdjustedAt > counterRespAt)) {
    offerRevised = { amount: quoteAdjustedAmt, kind: "adjusted" };
  }
  if (offerRevised && offerRevised.amount >= 0) {
    totalPayout = offerRevised.amount;
    // A negotiated counter-offer / staff adjustment is the final agreed
    // number — it already reflects everything, so don't add a separate
    // bonus line on top of it.
    bonus = 0;
  }

  // Refer-a-friend — the customer's own share code is deterministic
  // from their email (referralCodeForEmail), so we can surface it on the
  // offer page (a happy post-sale moment) without a login. leadId is the
  // secret here, same trust model as the rest of this payload.
  const customerEmail = field(body, "Email");
  const referralCode = customerEmail ? referralCodeForEmail(customerEmail) : undefined;
  const referralLink = referralCode ? referralLinkForCode(referralCode) : undefined;
  // /api/lead resolves a friend's code ONLY through a [REFERRAL-CODE:] marker
  // in its newest-5000 scan, and nothing posted one for a code shown here
  // (only the logged-in /api/referral dashboard did) — so the friend was
  // shown "$10 added", the server silently dropped it, and this customer
  // was never credited. Register the code whenever it's shown and the marker
  // isn't in this same newest-5000 window (which also re-posts one that has
  // aged out). After the response, so the page never waits on it.
  // (The page hides the link on a cancelled/rejected offer — skip those.)
  if (referralCode && customerEmail && !cancelled && status !== "rejected" && !hasReferralCodeMarker(messages, referralCode)) {
    const marker = referralCodeMarker(referralCode, customerEmail);
    if (marker) {
      after(async () => {
        try {
          await fetch(`${MC_API}/api/comms`, {
            method: "POST",
            headers: { "x-api-key": MC_KEY, "Content-Type": "application/json" },
            body: JSON.stringify({
              from: "topcash-web",
              fromName: "Top Cash Cellular",
              role: "system",
              body: marker,
              tags: ["referral", "code"],
              priority: "low",
            }),
          });
        } catch { /* best-effort — the next view retries */ }
      });
    }
  }

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
    // Verizon lock state for the edit preview — Verizon is the one carrier
    // whose price hangs on it. Homepage leads carry a "Carrier lock:" line;
    // /go's carrier chip IS the lock (its "Verizon" = locked to Verizon) and
    // its leads (the ones with Lock-Until:) carry none. Undefined = the lead
    // doesn't say (multi-device carts).
    carrierLocked: (() => {
      const lock = field(body, "Carrier lock");
      if (lock) return carrierLockedFromText(lock);
      return field(body, "Lock-Until") ? canonicalCarrier(field(body, "Carrier")) !== "unlocked" : undefined;
    })(),
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
    // Coupon/referral credit shown as its own offer-page line. `totalPayout`
    // already includes it; the page renders the device subtotal + this line
    // so the two reconcile and an edit can't strip the credit.
    bonus: bonus > 0 ? bonus : undefined,
    // Present when a counter-offer was accepted or staff adjusted the quote at
    // inspection — lets the page show "revised offer" context, and guarantees
    // the headline total above reflects the agreed number.
    offerRevised,
    status: cancelled ? "rejected" : status,
    statusAt,
    // Customer-visible payout receipt — present once a lead is paid/met and
    // staff recorded a confirmation. Lets the customer self-verify the
    // transfer (method + reference + amount + when) without contacting us.
    payoutProof: !cancelled && (status === "paid" || status === "met") && (payoutMethod || payoutRef || payoutAmount != null)
      ? {
          method: payoutMethod || undefined,
          reference: payoutRef || undefined,
          amount: payoutAmount ?? undefined,
          at: statusAt || undefined,
        }
      : undefined,
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
