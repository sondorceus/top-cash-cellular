// POST /api/offer/[leadId]/items
//
// Customer-side device edit — lets a customer correct a device's
// condition / storage on their offer page before the trade ships,
// with the re-quoted (estimate) total.
//
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

import { NextRequest, NextResponse } from "next/server";
import { parseTotalPayoutLine, parseDollarAmount } from "../../../../lib/lead-money";
import {
  field, cleanField, latestStatus, resolveCurrentDevices, devicesTotal, LOCKED_STATUSES,
} from "../../../../lib/lead-devices";

const MC_API = "https://missioncontrolsdjg-production.up.railway.app";
const MC_KEY = process.env.MC_API_KEY || "";
const TWILIO_SID = process.env.TWILIO_ACCOUNT_SID || "";
const TWILIO_AUTH = process.env.TWILIO_AUTH_TOKEN || "";
const TWILIO_FROM = process.env.TWILIO_PHONE || "";
const OWNER_PHONE = process.env.OWNER_PHONE || "+15129609256";

type InDevice = { model?: unknown; storage?: unknown; condition?: unknown; quote?: unknown; quantity?: unknown; needsReview?: unknown };

export async function POST(req: NextRequest, ctx: { params: Promise<{ leadId: string }> }) {
  const { leadId } = await ctx.params;
  if (!leadId || !/^[\w-]+$/.test(leadId)) {
    return NextResponse.json({ error: "Invalid offer id" }, { status: 400 });
  }
  if (!MC_KEY) {
    return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
  }

  // Parse + validate the edited device list.
  let raw: InDevice[] = [];
  try {
    const body = await req.json();
    if (Array.isArray(body?.devices)) raw = body.devices;
  } catch { /* handled below */ }
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
  // Each device's `quote` is already the line total (price × qty),
  // matching the funnel/lead convention — don't multiply by qty again.
  const total = devices.reduce((s, d) => s + d.quote, 0);

  // Pull the lead to verify ownership + check it's still editable.
  const r = await fetch(`${MC_API}/api/comms?limit=1000`, {
    headers: { "x-api-key": MC_KEY },
    cache: "no-store",
  });
  if (!r.ok) return NextResponse.json({ error: "Couldn't reach service — try again shortly." }, { status: 502 });
  const data = await r.json();
  const messages: { id: string; body?: string; timestamp: string }[] = data.messages || [];
  const leadMsg = messages.find((m) => m.id === leadId);
  if (!leadMsg?.body) {
    return NextResponse.json({ error: "Offer not found" }, { status: 404 });
  }

  // Confirm it's a real buyback lead (the leadId is the access secret).
  if (!/\[NEW BUYBACK LEAD(\b| — \d+ DEVICES\])/i.test(leadMsg.body)) {
    return NextResponse.json({ error: "Offer not found" }, { status: 404 });
  }

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
  const current = resolveCurrentDevices(leadMsg.body, messages, leadId);
  const ceiling = Math.max(
    devicesTotal(current),
    parseTotalPayoutLine(leadMsg.body),
    parseDollarAmount(field(leadMsg.body, "Quote")),
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

  const cancelled = messages.some((m) => m.body?.includes(`[DELETED-LEAD: ${leadId}]`));
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
  const json = JSON.stringify({ v: 1, devices, total });
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
      from: "topcash-web",
      fromName: "Customer Device Edit",
      role: "system",
      body: updateBody,
      tags: anyReview ? ["item-update", "needs-review"] : ["item-update"],
      priority: "high",
    }),
  });
  if (!postRes.ok) {
    return NextResponse.json({ error: "Couldn't save your changes — try again shortly." }, { status: 502 });
  }

  // Owner SMS — the re-quote is an estimate; staff confirm at inspection.
  if (TWILIO_SID && TWILIO_AUTH) {
    try {
      const e164 = OWNER_PHONE.startsWith("+") ? OWNER_PHONE : `+1${OWNER_PHONE.replace(/\D/g, "")}`;
      const customerName = field(leadMsg.body, "Name") || "Customer";
      const summary = devices.map((d) => `${d.model} (${d.condition || "?"}${d.storage ? ", " + d.storage : ""})`).join("; ");
      const text = `${anyReview ? "⚠️ NEEDS MANUAL REVIEW — " : ""}EDIT: ${customerName} changed offer ${leadId.slice(0, 10).toUpperCase()} → est. $${total}. ${summary}`;
      await fetch(`https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`, {
        method: "POST",
        headers: {
          Authorization: `Basic ${Buffer.from(`${TWILIO_SID}:${TWILIO_AUTH}`).toString("base64")}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({ To: e164, From: TWILIO_FROM, Body: text.slice(0, 480) }),
      });
    } catch { /* SMS non-fatal */ }
  }

  return NextResponse.json({ ok: true, devices, total });
}
