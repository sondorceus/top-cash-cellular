// POST /api/offer/[leadId]/items
//
// Customer-side device edit — lets a customer correct a device's
// condition / storage on their offer page before the trade ships,
// with the re-quoted (estimate) total.
//
// 2026-09-26: the signed link's `k` (app/lib/offer-link.ts) is the access
// control for every write here; the id alone gets the redacted read. The
// access-model paragraph below predates that.
// Access model: the leadId is the secret — same trust model as the
// public offer GET route, since the customer reaches this from their
// own private offer link. No sign-in required: an edit only changes a
// customer-facing ESTIMATE (the real price is verified at inspection)
// and the owner gets an SMS on every edit. (Cancel uses the SAME
// leadId-as-secret model — see cancel/route.ts — also no sign-in; the
// owner SMS + the terminal-status gate are its safeguards. An earlier
// comment here claimed cancel required sign-in; it never did.)
//
// Editing is allowed only BEFORE shipping — once the lead is marked
// shipped/received/tested/paid/met it's locked (409). On success it
// posts an [ITEM-UPDATE: leadId] marker carrying the new device list
// as JSON; the offer GET + admin leads routes apply the latest one.
// Skywalker 2026-05-20.

import { NextRequest, NextResponse, after } from "next/server";
import { rateLimit, rateLimitResponse, clientIp } from "../../../../lib/rate-limit";
import { parseTotalPayoutLine, parseDollarAmount } from "../../../../lib/lead-money";
import { fetchCommsRead, invalidateCommsMemo } from "../../../../lib/mc-comms";
import { offerKeyValid } from "../../../../lib/offer-link";
import { notifyOwnerSms } from "../../../../lib/owner-sms";
import { authoritativeLineCap } from "../../../../lib/server-quote-cap";
import { readPriceOverrides } from "../../../../lib/quote";
import {
  field, cleanField, latestStatus, resolveCurrentDevices, devicesTotal, LOCKED_STATUSES, parseOfferBonus, isDeleted,
  nextItemUpdateVersion,
} from "../../../../lib/lead-devices";

const SERVER_QUOTE_TOLERANCE = 5;

const MC_API = "https://missioncontrolsdjg-production.up.railway.app";
const MC_KEY = process.env.MC_API_KEY || "";
const TWILIO_SID = process.env.TWILIO_ACCOUNT_SID || "";
const TWILIO_AUTH = process.env.TWILIO_AUTH_TOKEN || "";
const OWNER_PHONE = process.env.OWNER_PHONE || "+15129609256";
// Every write needs the link's `k` (app/lib/offer-link.ts, 2026-09-26): the
// bare id is the public Offer #, so on its own it may only read.
const UNSIGNED_LINK = "This link isn't signed — open your offer from your confirmation e-mail or your account to make changes.";

type InDevice = { model?: unknown; storage?: unknown; condition?: unknown; carrier?: unknown; quote?: unknown; quantity?: unknown; needsReview?: unknown };

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
  // Throttle — this posts to MC + can fire owner SMS, so a leaked signed link
  // must not be loopable into a MC-flood / owner-SMS bomb.
  const rl = rateLimit(`offer:${clientIp(req)}`, 20, 60_000);
  if (!rl.ok) return rateLimitResponse(rl.retryAfterMs);
  if (!MC_KEY) {
    return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
  }

  // Parse + validate the edited device list.
  let raw: InDevice[] = [];
  if (Array.isArray(bodyIn?.devices)) raw = bodyIn.devices as InDevice[];
  if (raw.length === 0 || raw.length > 10) {
    return NextResponse.json({ error: "Send 1–10 devices." }, { status: 400 });
  }
  const devices = raw.map((d) => {
    const quote = Math.round(Number(d.quote));
    const quantity = Math.round(Number(d.quantity) || 1);
    return {
      model: cleanField(d.model, 80),
      storage: cleanField(d.storage, 30),
      condition: cleanField(d.condition, 30),
      // Per-line carrier (optional). A mixed-carrier cart clamped every
      // line against the LEAD-level carrier — an unlocked line on an AT&T
      // lead capped at the AT&T ceiling → false clamp + needsReview.
      // Client-supplied is fine here: the customer already self-declares
      // carrier at funnel time and inspection is the backstop; a wrong
      // claim only moves the ceiling by the carrier gap.
      carrier: cleanField(d.carrier, 40),
      quote: Number.isFinite(quote) && quote >= 0 && quote <= 100000 ? quote : 0,
      quantity: quantity >= 1 && quantity <= 50 ? quantity : 1,
      // Set by the editor for a broken + non-functional device — it
      // can't be auto-quoted and goes to a manual staff re-quote.
      needsReview: !!d.needsReview,
    };
  });
  if (devices.some((d) => !d.model)) {
    return NextResponse.json({ error: "Every device needs a model." }, { status: 400 });
  }
  // Per-lead cap shared by every customer write on this offer — see the
  // cancel route. After validation so a rejected body doesn't spend it.
  // 2026-09-25.
  const rlLead = rateLimit(`offer-lead:${leadId}`, 10, 600_000);
  if (!rlLead.ok) return rateLimitResponse(rlLead.retryAfterMs);

  // Pull the lead to verify ownership + check it's still editable. limit=5000
  // (full live cap, was 1000) so an older offer still resolves by id.
  // Shared reader — 15 s timeout, no memo; a failed or empty read is
  // "unknown", never "not found" (the bare fetch had no timeout). 2026-09-25.
  const read = await fetchCommsRead({ apiKey: MC_KEY, pageSize: 5000, maxPages: 1, includeArchive: false });
  if (!read.complete || read.messages.length === 0) {
    return NextResponse.json({ error: "Mission Control is unavailable — nothing was changed." }, { status: 502 });
  }
  const messages = read.messages;
  const leadMsg = messages.find((m) => m.id === leadId);
  if (!leadMsg?.body) {
    return NextResponse.json({ error: "Offer not found" }, { status: 404 });
  }

  // Confirm it's a real buyback lead (the leadId is the access secret).
  if (!/\[NEW BUYBACK LEAD(\b| — \d+ DEVICES\])/i.test(leadMsg.body)) {
    return NextResponse.json({ error: "Offer not found" }, { status: 404 });
  }

  // Per-LINE ceiling — the total-only cap let one line inflate inside an
  // unchanged total, and the client editor re-quotes from RAW table cells
  // (no carrier gap / margin cap / galaxy drop), which could restore a
  // $155-500 carrier gap on a condition downgrade. Recompute each line's
  // real ceiling via quoteDevice (same guard as /api/lead), using the
  // lead's carrier; lines we can't price server-side (MacBooks, customs)
  // get flagged for a manual staff re-quote instead of trusting the
  // client's math. Clamping (not rejecting) also unblocks honest
  // downgrades on cap-bound models whose raw cell exceeds the ceiling.
  const leadCarrier = field(leadMsg.body, "Carrier");
  const capOverrides = await readPriceOverrides();
  // The page re-sends EVERY line on an edit. A priced line the customer
  // didn't touch (same model / storage / condition / qty, quote not raised,
  // not already under review) keeps the number on the order — /api/lead or
  // an earlier edit clamped it, allowing a % code / weekly promo this route
  // can't re-check; re-capping it cut an untouched coupon line and flagged
  // the order "customer marked a device broken". Each order line vouches
  // for one submitted line at most.
  const current = resolveCurrentDevices(leadMsg.body, messages, leadId);
  const unmatched = [...current];
  const sameText = (a: string | undefined, b: string | undefined) => (a ?? "") === (b ?? "");
  for (const d of devices) {
    if (d.needsReview || d.quote <= 0) continue;
    const cap = await authoritativeLineCap(
      { model: d.model, storage: d.storage, condition: d.condition, carrier: d.carrier || leadCarrier },
      capOverrides,
    );
    if (cap == null) {
      // Unknown model or a config that prices below MIN_OFFER — never
      // trust the client's number as the estimate.
      d.needsReview = true;
      continue;
    }
    const k = unmatched.findIndex((c) => !c.needsReview && c.model === d.model && sameText(c.storage, d.storage)
      && sameText(c.condition, d.condition) && c.quantity === d.quantity && c.quote > 0 && d.quote <= c.quote);
    if (k >= 0) { unmatched.splice(k, 1); continue; }
    const lineAllowed = cap * d.quantity;
    if (d.quote > lineAllowed + SERVER_QUOTE_TOLERANCE) {
      console.warn(`[offer-items] Line over ceiling: ${d.model.slice(0, 60)} submitted=$${d.quote} lineCap=$${lineAllowed} — clamped.`);
      d.quote = lineAllowed;
      d.needsReview = true;
    }
  }
  // Each device's `quote` is already the line total (price × qty),
  // matching the funnel/lead convention — don't multiply by qty again.
  const total = devices.reduce((s, d) => s + d.quote, 0);

  // Anti-inflation guard. The leadId is the only access control on this
  // endpoint, and the client computes `quote` — so without this anyone
  // with their offer link could POST an inflated quote and raise the
  // estimate the offer page (and the admin total) shows. A genuine edit
  // only ever LOWERS the estimate (the device is worse than quoted), so
  // cap the new total at the order's CURRENT total.
  //
  // The ceiling must be the *current* total, not just the original lead
  // body: a prior edit / added device (resolved from the latest
  // [ITEM-UPDATE] marker) legitimately changes it, and reading only the
  // body would (a) wrongly block edits after a legit add and (b) miss
  // multi-device leads whose only price is in the per-device lines. Take
  // the max across resolved current devices + the body footer/Quote so we
  // never under-estimate the ceiling and falsely reject a lowering edit.
  // The body's Quote / Total-payout figures INCLUDE the coupon/referral
  // bonus, but the [ITEM-UPDATE] marker stores the device SUBTOTAL and the
  // offer GET re-adds the bonus on top — so a ceiling that includes the
  // bonus lets an edit double-count it. Strip it here (the offer GET's
  // shared whole-line parse — a customer-typed copy of the marker used to
  // count here too and zero the ceiling).
  const bodyBonus = parseOfferBonus(leadMsg.body);
  const ceiling = Math.max(
    devicesTotal(current),
    parseTotalPayoutLine(leadMsg.body) - bodyBonus,
    parseDollarAmount(field(leadMsg.body, "Quote")) - bodyBonus,
  );
  if (ceiling > 0 && total > ceiling) {
    return NextResponse.json({
      error: "An edit can only lower your estimate here. If your device is actually a higher tier, reply to your offer email and we'll re-quote it.",
    }, { status: 422 });
  }
  // No price baseline anywhere (inquiry-only / manual-quote lead) — we
  // can't validate the submitted total, so never trust it as the estimate:
  // force a manual staff re-quote instead of silently accepting it.
  const unverifiable = ceiling === 0 && total > 0;

  // Restore-aware — a lead staff trashed and restored is live again.
  const cancelled = isDeleted(messages, leadId);
  if (cancelled) {
    return NextResponse.json({ error: "This offer was cancelled." }, { status: 409 });
  }

  // Status gate — editing locks once the device is on its way. Unknown /
  // typo'd status markers are ignored (latestStatus whitelists), so a
  // stray marker can't open this gate when GET would keep the real status.
  const status = latestStatus(messages, leadId);
  if (LOCKED_STATUSES.has(status)) {
    return NextResponse.json({
      error: "This offer can no longer be edited — your trade is already on its way. Email support@topcashcellular.com if something's wrong.",
    }, { status: 409 });
  }

  // A broken + non-functional device can't be auto-quoted — flag the
  // edit for a manual staff re-quote. (Functional broken devices keep
  // their auto estimate.) Skywalker 2026-05-20. Also flag when we had no
  // baseline to cap the total against (see `unverifiable` above).
  const anyReview = devices.some((d) => d.needsReview) || unverifiable;

  // Post the item-update marker. Human-readable lead-in for staff
  // scanning MC; the trailing JSON is what the offer GET route parses.
  // v2 = device prices exclude the offer bonus (see nextItemUpdateVersion).
  const json = JSON.stringify({ v: nextItemUpdateVersion(messages, leadId), devices, total });
  const reviewNote = devices.some((d) => d.needsReview)
    ? " ⚠️ MANUAL REVIEW NEEDED — customer marked a device broken; re-quote by hand."
    : unverifiable
      ? " ⚠️ MANUAL REVIEW NEEDED — no original quote to verify this edit against; re-quote by hand."
      : "";
  const updateBody = `[ITEM-UPDATE: ${leadId}] Customer edited device specs — new estimated total $${total}.${reviewNote} ${json}`;
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
      tags: anyReview ? ["item-update", "needs-review"] : ["item-update"],
      priority: "high",
    }),
  });
  if (!postRes.ok) {
    return NextResponse.json({ error: "Couldn't save your changes — try again shortly." }, { status: 502 });
  }
  invalidateCommsMemo();

  // Owner alert — the re-quote is an estimate; staff confirm at inspection.
  // After the response; nothing in it reads the alert's outcome. 2026-09-25.
  {
    const customerName = field(leadMsg.body, "Name") || "Customer";
    const summary = devices.map((d) => `${d.model} (${d.condition || "?"}${d.storage ? ", " + d.storage : ""})`).join("; ");
    // `total` is the device subtotal; the order figure (what the offer
    // page shows) adds the coupon/referral bonus back.
    const text = `${anyReview ? "⚠️ NEEDS MANUAL REVIEW — " : ""}EDIT: ${customerName} changed offer ${leadId.slice(0, 10).toUpperCase()} → est. $${total + bodyBonus}. ${summary}`;
    after(() => notifyOwnerSms(text.slice(0, 480)).catch(() => {}));
  }

  return NextResponse.json({ ok: true, devices, total });
}
