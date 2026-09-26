// POST /api/offer/[leadId]/append
//
// Self-serve "add another device" — appends one or more NEW devices to
// an existing offer. The customer reaches this from the funnel running
// in "add to order" mode (/?addToOrder=<leadId>): the funnel prices the
// new device exactly the way it prices any quote (incl. live admin
// price overrides + the margin guardrail), then hands the priced line
// here on submit.
//
// 2026-09-26: the signed link's `k` (app/lib/offer-link.ts) is the access
// control for every write here; the id alone gets the redacted read. The
// access-model paragraph below predates that.
// TRUST MODEL — this is the important bit. The leadId is the only access
// control (same as the offer GET / items / cancel routes). So:
//   - The NEW devices' quotes are funnel-computed and TRUSTED, exactly
//     the way /api/lead trusts a brand-new lead's quote. Adding a device
//     is a legitimate increase, so — unlike the items EDIT route — there
//     is no anti-inflation cap here.
//   - The EXISTING devices are NEVER taken from the client. We rebuild
//     the current device list server-side from the lead (mirroring the
//     offer GET route) so a tampered request can't inflate lines that
//     are already on the order.
//
// Editing is allowed only BEFORE the trade ships — once it's marked
// shipped/received/tested/paid/met the order is locked (409), same gate
// as the items route. On success we post a fresh [ITEM-UPDATE: leadId]
// marker carrying the combined device list as JSON; the offer GET +
// admin leads routes apply the latest one.

import { NextRequest, NextResponse, after } from "next/server";
import { parseTotalPayoutLine, parseDollarAmount } from "../../../../lib/lead-money";
import { rateLimit, rateLimitResponse, clientIp } from "../../../../lib/rate-limit";
import { fetchCommsRead, invalidateCommsMemo } from "../../../../lib/mc-comms";
import { offerKeyValid, offerPath } from "../../../../lib/offer-link";
import { getResellEstimate, resellMultiplierForCondition, EBAY_FEE_MULT } from "../../../../lib/resell-estimates";
import { authoritativeLineCap, macSpecUnclaimed } from "../../../../lib/server-quote-cap";
import { readPriceOverrides } from "../../../../lib/quote";
import { notifyOwnerSms } from "../../../../lib/owner-sms";
import { parseOfferBonus, isCustomerLeadPost, nextItemUpdateVersion, latestStatus, isDeleted } from "../../../../lib/lead-devices";

// Server-side quote ceiling per added device — mirrors /api/lead's anti-tamper
// guard so a tampered offer link can't inflate the order total (which flows into
// the admin payout figure + analytics). resell × condition × eBay-net × margin-floor.
const SERVER_MARGIN_FLOOR_MULT = 0.75;
const SERVER_QUOTE_TOLERANCE = 5;
function computeUnitCap(model: unknown, condition: unknown): number | null {
  const r = getResellEstimate(typeof model === "string" ? model : "");
  if (r == null) return null;
  const cm = resellMultiplierForCondition(typeof condition === "string" ? condition : "", null);
  // Mirror the funnel cap incl. the eBay 13% FVF (see /api/lead). (bug fix)
  return Math.round(r * cm * EBAY_FEE_MULT * SERVER_MARGIN_FLOOR_MULT);
}

const MC_API = "https://missioncontrolsdjg-production.up.railway.app";
const MC_KEY = process.env.MC_API_KEY || "";
const TWILIO_SID = process.env.TWILIO_ACCOUNT_SID || "";
const TWILIO_AUTH = process.env.TWILIO_AUTH_TOKEN || "";
const OWNER_PHONE = process.env.OWNER_PHONE || "+15129609256";
// Every write needs the link's `k` (app/lib/offer-link.ts, 2026-09-26): the
// bare id is the public Offer #, so on its own it may only read.
const UNSIGNED_LINK = "This link isn't signed — open your offer from your confirmation e-mail or your account to make changes.";

const LOCKED = new Set(["shipped", "received", "tested", "paid", "met"]);

type Device = { model: string; storage?: string; condition?: string; carrier?: string; quote: number; quantity: number; needsReview?: boolean };

function field(body: string, key: string): string | undefined {
  const m = body.match(new RegExp(`(?:^|\\n)${key}:[ \\t]*([^\\n]*)`, "i"));
  return m?.[1]?.trim() || undefined;
}
// { } too: the marker's human lead-in below carries the added model names
// AHEAD of the JSON, and every [ITEM-UPDATE] reader captures from the first
// "{" on the line — one brace in a name left the whole order's marker
// unparseable (the add silently never applied). 2026-09-25.
function clean(s: unknown, max: number): string {
  return String(s ?? "").replace(/[\[\]{}\n\r\t\u2028\u2029]/g, " ").trim().slice(0, max);
}

// Rebuild the order's CURRENT device list server-side. Resolution order
// mirrors the offer GET route exactly: latest [ITEM-UPDATE] JSON wins;
// otherwise the multi-device "Devices: N" block; otherwise the single
// device described by the lead's Device/Model/Storage/Condition/Quote
// fields. The returned quotes are authoritative (never client-supplied).
function resolveCurrentDevices(
  body: string,
  messages: { body?: string; timestamp: string }[],
  leadId: string,
): Device[] {
  // 1. Latest [ITEM-UPDATE] marker — its JSON is the source of truth.
  let itemUpdate: { devices?: unknown[] } | null = null;
  let itemUpdateAt = "";
  for (const m of messages) {
    if (!m.body || isCustomerLeadPost(m.body)) continue;
    const iu = m.body.match(new RegExp(`\\[ITEM-UPDATE:\\s*${leadId}\\][^\\n]*?(\\{.*\\})`, "i"));
    if (iu && (!itemUpdateAt || m.timestamp > itemUpdateAt)) {
      try {
        const parsed = JSON.parse(iu[1]);
        if (parsed && Array.isArray(parsed.devices)) { itemUpdate = parsed; itemUpdateAt = m.timestamp; }
      } catch { /* ignore malformed marker */ }
    }
  }
  if (itemUpdate?.devices) {
    return (itemUpdate.devices as Record<string, unknown>[]).map((d) => ({
      model: clean(d.model, 80) || "Device",
      storage: d.storage ? clean(d.storage, 30) : undefined,
      condition: d.condition ? clean(d.condition, 30) : undefined,
      quote: Number.isFinite(Number(d.quote)) ? Math.max(0, Math.round(Number(d.quote))) : 0,
      quantity: Number.isFinite(Number(d.quantity)) && Number(d.quantity) > 0 ? Math.round(Number(d.quantity)) : 1,
      needsReview: !!d.needsReview,
    }));
  }

  // 2. Multi-device "Devices: N" block. Same line shape the GET route +
  //    admin parser read: "  1. Model · Storage · Condition · $Quote …".
  //    \n-bounded, not /m — /m also starts lines at U+2028/U+2029.
  if (/(?:^|\n)Devices:[ \t]*(\d+)[ \t]*(?=\r?\n|$)/.test(body)) {
    // Storage/Condition groups exclude `$` so a sparse line's price isn't
    // swallowed into them (→ $0 device); money group accepts cents.
    const re = /^\s{2,4}(\d+)\.\s+([^·\n]+?)(?:\s·\s+([^·\n$]+?))?(?:\s·\s+([^·\n$]+?))?(?:\s·\s+\$([0-9,]+(?:\.\d+)?)(?:\s+total)?)?(?:\s+\(×(\d+)\))?(?:\s·\s+.*)?$/;
    const out: Device[] = [];
    for (const line of body.split("\n")) {
      const dm = line.match(re);
      if (!dm) continue;
      const [, , dLabel, dStorage, dCondition, dQuote, dQty] = dm;
      out.push({
        model: dLabel.trim().slice(0, 80),
        storage: dStorage?.trim().slice(0, 30) || undefined,
        condition: dCondition?.trim().slice(0, 30) || undefined,
        quote: dQuote ? parseInt(dQuote.replace(/,/g, ""), 10) : 0,
        quantity: dQty ? parseInt(dQty, 10) || 1 : 1,
      });
    }
    if (out.length) return out;
  }

  // 3. Single-device lead. Its Quote line includes the coupon/referral
  //    bonus; strip it — the offer GET re-adds [OFFER-BONUS] on top of the
  //    [ITEM-UPDATE] total we post, so leaving it in paid the bonus twice.
  const q = Math.max(0, (parseTotalPayoutLine(body) || parseDollarAmount(field(body, "Quote"))) - parseOfferBonus(body));
  const qtyRaw = field(body, "Quantity");
  const qty = qtyRaw ? parseInt(qtyRaw, 10) || 1 : 1;
  return [{
    model: (field(body, "Model") || field(body, "Device")?.split(" — ")[1] || field(body, "Device") || "Device").slice(0, 80),
    storage: field(body, "Storage"),
    condition: field(body, "Condition"),
    quote: q > 0 ? q : 0,
    quantity: qty > 0 ? qty : 1,
  }];
}

type InDevice = { model?: unknown; storage?: unknown; condition?: unknown; carrier?: unknown; quote?: unknown; quantity?: unknown; needsReview?: unknown; processor?: unknown; memory?: unknown };

export async function POST(req: NextRequest, ctx: { params: Promise<{ leadId: string }> }) {
  const { leadId } = await ctx.params;
  if (!leadId || !/^[\w-]+$/.test(leadId)) {
    return NextResponse.json({ error: "Invalid offer id" }, { status: 400 });
  }
  // Signed-link gate — before the body is trusted and before any MC read, so
  // an unsigned request costs nothing. The key rides in the JSON body (the
  // offer page) or the query (the funnel's add-to-order flow). 2026-09-26.
  let bodyIn: Record<string, unknown> | null = null;
  try {
    const j = await req.json();
    if (j && typeof j === "object" && !Array.isArray(j)) bodyIn = j as Record<string, unknown>;
  } catch { /* no body / not JSON — each field is validated below */ }
  const k = typeof bodyIn?.k === "string" ? bodyIn.k : req.nextUrl.searchParams.get("k");
  if (!offerKeyValid(leadId, k)) {
    return NextResponse.json({ error: UNSIGNED_LINK }, { status: 403 });
  }
  // Rate limit (same guard the sibling offer routes use) — a leaked offer link
  // posts an MC comm + fires an owner SMS, so cap the abuse / Twilio cost.
  const rl = rateLimit(`offer:${clientIp(req)}`, 20, 60_000);
  if (!rl.ok) return rateLimitResponse(rl.retryAfterMs);
  if (!MC_KEY) {
    return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
  }

  // Parse the NEW devices being added (funnel-priced).
  let raw: InDevice[] = [];
  if (Array.isArray(bodyIn?.devices)) raw = bodyIn.devices as InDevice[];
  if (raw.length === 0 || raw.length > 10) {
    return NextResponse.json({ error: "Send 1–10 devices to add." }, { status: 400 });
  }
  const added: Device[] = raw.map((d) => {
    const quote = Math.round(Number(d.quote));
    const quantity = Math.round(Number(d.quantity) || 1);
    const qty = quantity >= 1 && quantity <= 50 ? quantity : 1;
    const safeQuote = Number.isFinite(quote) && quote >= 0 && quote <= 100000 ? quote : 0;
    return {
      model: clean(d.model, 80),
      storage: clean(d.storage, 30) || undefined,
      condition: clean(d.condition, 30) || undefined,
      // Per-line carrier from the funnel add-to-order flow — the funnel
      // KNOWS the added device's carrier. Without it, adding an unlocked
      // phone onto an AT&T-carrier lead clamped the new line against the
      // AT&T ceiling → false clamp + needsReview at add time.
      carrier: clean(d.carrier, 40) || undefined,
      quote: safeQuote,
      quantity: qty,
      needsReview: !!d.needsReview,
    };
  });
  if (added.some((d) => !d.model)) {
    return NextResponse.json({ error: "Every device needs a model." }, { status: 400 });
  }
  // Per-lead cap shared by every customer write on this offer — see the
  // cancel route. After validation so a rejected body doesn't spend it.
  // 2026-09-25.
  const rlLead = rateLimit(`offer-lead:${leadId}`, 10, 600_000);
  if (!rlLead.ok) return rateLimitResponse(rlLead.retryAfterMs);
  // MacBook chip / RAM labels (index-aligned with `added`) — the funnel sends
  // them so the ceiling prices the claimed config; the marker text records
  // them for inspection.
  const specs = raw.map((d) => ({ processor: clean(d.processor, 60), memory: clean(d.memory, 30) }));

  // Pull the lead to verify ownership + that it's still editable. limit=5000
  // (full live cap, was 1000) so an older offer still resolves by id.
  // Shared reader — 15 s timeout, no memo; a failed or empty read is
  // "unknown", never "not found" (the bare fetch had no timeout). 2026-09-25.
  const read = await fetchCommsRead({ apiKey: MC_KEY, pageSize: 5000, maxPages: 1, includeArchive: false });
  if (!read.complete || read.messages.length === 0) {
    return NextResponse.json({ error: "Mission Control is unavailable — nothing was changed." }, { status: 502 });
  }
  const messages = read.messages;
  const leadMsg = messages.find((m) => m.id === leadId);
  if (!leadMsg?.body || !/\[NEW BUYBACK LEAD(\b| — \d+ DEVICES\])/i.test(leadMsg.body)) {
    return NextResponse.json({ error: "Offer not found" }, { status: 404 });
  }

  // Restore-aware — a lead staff trashed and restored is live again.
  const cancelled = isDeleted(messages, leadId);
  if (cancelled) {
    return NextResponse.json({ error: "This offer was cancelled." }, { status: 409 });
  }

  // Status gate — adding locks once the device is on its way. Whitelisted
  // via lead-devices.latestStatus like GET and the items route: this loop
  // took ANY [STATUS: word], so a typo'd staff marker could reopen the gate
  // GET kept shut. 2026-09-25.
  const status = latestStatus(messages, leadId);
  if (LOCKED.has(status)) {
    return NextResponse.json({
      error: "This offer can no longer be changed — your trade is already on its way. Email support@topcashcellular.com to add a device.",
    }, { status: 409 });
  }

  // Anti-tamper: clamp each added line to its AUTHORITATIVE ceiling —
  // quoteDevice() + headroom (same guard as /api/lead), carrier-aware via
  // the lead's carrier field. The old resell-only cap returned null for
  // every resell-exempt SKU (watches, MacBooks, sealed 17PM…), letting a
  // client number up to $100k ride the order total. Legacy resell cap
  // stays as the fallback; lines we can't price at all get flagged for a
  // manual staff re-quote and never trusted into the estimate.
  const leadCarrier = field(leadMsg.body, "Carrier");
  const capOverrides = await readPriceOverrides();
  for (const [i, d] of added.entries()) {
    if (d.needsReview || d.quote <= 0) continue;
    const line = { model: d.model, storage: d.storage, condition: d.condition, carrier: d.carrier || leadCarrier, ...specs[i] };
    const unitCap = (await authoritativeLineCap(line, capOverrides)) ?? computeUnitCap(d.model, d.condition);
    if (unitCap == null) {
      d.needsReview = true;
      continue;
    }
    // No chip/RAM → the MacBook ceiling is the model's top config; a staff
    // re-quote instead of trusting it (the funnel always sends both).
    if (macSpecUnclaimed(line)) d.needsReview = true;
    const lineCap = unitCap * d.quantity;
    if (d.quote > lineCap + SERVER_QUOTE_TOLERANCE) {
      console.warn(`[offer-append] Line over ceiling: ${d.model.slice(0, 60)} submitted=$${d.quote} lineCap=$${lineCap} — clamped.`);
      d.quote = lineCap;
      d.needsReview = true;
    }
  }

  // Rebuild the existing list server-side, then append the new lines.
  const current = resolveCurrentDevices(leadMsg.body, messages, leadId);
  const devices = [...current, ...added];
  if (devices.length > 20) {
    return NextResponse.json({ error: "An order can hold up to 20 devices. Email us to add more." }, { status: 422 });
  }
  // Each device's `quote` is the line total (price × qty) — don't
  // re-multiply, matching the funnel/lead/items convention.
  const total = devices.reduce((s, d) => s + d.quote, 0);
  const anyReview = added.some((d) => d.needsReview);

  // Post the combined item-update marker. Human-readable lead-in for
  // staff scanning MC; the trailing JSON is what the offer GET parses.
  // v2 = device prices exclude the offer bonus (see nextItemUpdateVersion).
  const json = JSON.stringify({ v: nextItemUpdateVersion(messages, leadId), devices, total });
  const addedSummary = added.map((d, i) => {
    const spec = [specs[i]?.processor, specs[i]?.memory].filter(Boolean).join(" / ");
    return `${d.model}${spec ? ` · ${spec}` : ""}${d.condition ? ` (${d.condition})` : ""}`;
  }).join(", ");
  const reviewNote = anyReview ? " ⚠️ A new device needs a manual re-quote." : "";
  const updateBody = `[ITEM-UPDATE: ${leadId}] Customer added ${added.length} device(s): ${clean(addedSummary, 200)} — new estimated total $${total}.${reviewNote} ${json}`;
  const postRes = await fetch(`${MC_API}/api/comms`, {
    method: "POST",
    headers: { "x-api-key": MC_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({
      // Own MC sender bucket for customer-originated posts — see the cancel
      // route. 2026-09-25.
      from: "topcash-customer",
      fromName: "Top Cash Cellular (customer)",
      role: "system",
      body: updateBody,
      tags: anyReview ? ["item-update", "device-added", "needs-review"] : ["item-update", "device-added"],
      priority: "high",
    }),
  });
  if (!postRes.ok) {
    return NextResponse.json({ error: "Couldn't add your device — try again shortly." }, { status: 502 });
  }
  invalidateCommsMemo();

  // Owner SMS so staff knows the order grew (estimate; confirmed at
  // inspection). After the response; nothing in it reads the alert's
  // outcome. 2026-09-25.
  {
    const customerName = field(leadMsg.body, "Name") || "Customer";
    // `total` is the device subtotal; the order figure (what the offer
    // page shows) adds the coupon/referral bonus back.
    const text = `${anyReview ? "⚠️ NEEDS REVIEW — " : ""}ADDED: ${customerName} added ${added.length} device(s) to ${leadId.slice(0, 10).toUpperCase()} → est. $${total + parseOfferBonus(leadMsg.body)}. ${clean(addedSummary, 160)}`;
    after(() => notifyOwnerSms(text.slice(0, 480)).catch(() => {}));
  }

  // The funnel lands on the offer page with this: signed, and `fresh` so the
  // read runs past the API's memo and shows the device just added.
  return NextResponse.json({ ok: true, devices, total, added: added.length, offerPath: offerPath(leadId, { fresh: true }) });
}
