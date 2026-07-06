// POST /api/offer/[leadId]/append
//
// Self-serve "add another device" — appends one or more NEW devices to
// an existing offer. The customer reaches this from the funnel running
// in "add to order" mode (/?addToOrder=<leadId>): the funnel prices the
// new device exactly the way it prices any quote (incl. live admin
// price overrides + the margin guardrail), then hands the priced line
// here on submit.
//
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

import { NextRequest, NextResponse } from "next/server";
import { parseTotalPayoutLine, parseDollarAmount } from "../../../../lib/lead-money";
import { rateLimit, rateLimitResponse, clientIp } from "../../../../lib/rate-limit";
import { getResellEstimate, resellMultiplierForCondition, EBAY_FEE_MULT } from "../../../../lib/resell-estimates";
import { notifyOwnerSms } from "../../../../lib/owner-sms";

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

const LOCKED = new Set(["shipped", "received", "tested", "paid", "met"]);

type Device = { model: string; storage?: string; condition?: string; quote: number; quantity: number; needsReview?: boolean };

function field(body: string, key: string): string | undefined {
  const m = body.match(new RegExp(`(?:^|\\n)${key}:[ \\t]*([^\\n]*)`, "i"));
  return m?.[1]?.trim() || undefined;
}
function clean(s: unknown, max: number): string {
  return String(s ?? "").replace(/[\[\]\n\r\t]/g, " ").trim().slice(0, max);
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
    if (!m.body) continue;
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
  if (/^Devices:\s*\d+\s*$/m.test(body)) {
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

  // 3. Single-device lead.
  const q = parseTotalPayoutLine(body) || parseDollarAmount(field(body, "Quote"));
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

type InDevice = { model?: unknown; storage?: unknown; condition?: unknown; quote?: unknown; quantity?: unknown; needsReview?: unknown };

export async function POST(req: NextRequest, ctx: { params: Promise<{ leadId: string }> }) {
  const { leadId } = await ctx.params;
  if (!leadId || !/^[\w-]+$/.test(leadId)) {
    return NextResponse.json({ error: "Invalid offer id" }, { status: 400 });
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
  try {
    const body = await req.json();
    if (Array.isArray(body?.devices)) raw = body.devices;
  } catch { /* handled below */ }
  if (raw.length === 0 || raw.length > 10) {
    return NextResponse.json({ error: "Send 1–10 devices to add." }, { status: 400 });
  }
  const added: Device[] = raw.map((d) => {
    const quote = Math.round(Number(d.quote));
    const quantity = Math.round(Number(d.quantity) || 1);
    const qty = quantity >= 1 && quantity <= 50 ? quantity : 1;
    let safeQuote = Number.isFinite(quote) && quote >= 0 && quote <= 100000 ? quote : 0;
    let review = !!d.needsReview;
    // Anti-tamper: clamp a known model's line total to its resell-based ceiling
    // (× qty). Unknown models can't be verified, so flag them for a manual
    // re-quote rather than auto-trusting the client number into the payout.
    const unitCap = computeUnitCap(d.model, d.condition);
    if (unitCap == null) {
      review = true;
    } else {
      const lineCap = unitCap * qty;
      if (safeQuote > lineCap + SERVER_QUOTE_TOLERANCE) {
        safeQuote = lineCap;
        review = true;
      }
    }
    return {
      model: clean(d.model, 80),
      storage: clean(d.storage, 30) || undefined,
      condition: clean(d.condition, 30) || undefined,
      quote: safeQuote,
      quantity: qty,
      needsReview: review,
    };
  });
  if (added.some((d) => !d.model)) {
    return NextResponse.json({ error: "Every device needs a model." }, { status: 400 });
  }

  // Pull the lead to verify ownership + that it's still editable. limit=5000
  // (full live cap, was 1000) so an older offer still resolves by id.
  const r = await fetch(`${MC_API}/api/comms?limit=5000`, {
    headers: { "x-api-key": MC_KEY },
    cache: "no-store",
  });
  if (!r.ok) return NextResponse.json({ error: "Couldn't reach service — try again shortly." }, { status: 502 });
  const data = await r.json();
  const messages: { id: string; body?: string; timestamp: string }[] = data.messages || [];
  const leadMsg = messages.find((m) => m.id === leadId);
  if (!leadMsg?.body || !/\[NEW BUYBACK LEAD(\b| — \d+ DEVICES\])/i.test(leadMsg.body)) {
    return NextResponse.json({ error: "Offer not found" }, { status: 404 });
  }

  const cancelled = messages.some((m) => m.body?.includes(`[DELETED-LEAD: ${leadId}]`));
  if (cancelled) {
    return NextResponse.json({ error: "This offer was cancelled." }, { status: 409 });
  }

  // Status gate — adding locks once the device is on its way.
  let status = "quote_requested";
  let statusAt = "";
  for (const m of messages) {
    if (!m.body) continue;
    const sm = m.body.match(new RegExp(`\\[STATUS:\\s*(\\w+)\\]\\s*\\[LEAD:\\s*${leadId}\\]`, "i"));
    if (sm && (!statusAt || m.timestamp > statusAt)) {
      status = sm[1].toLowerCase();
      statusAt = m.timestamp;
    }
  }
  if (LOCKED.has(status)) {
    return NextResponse.json({
      error: "This offer can no longer be changed — your trade is already on its way. Email support@topcashcellular.com to add a device.",
    }, { status: 409 });
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
  const json = JSON.stringify({ v: 1, devices, total });
  const addedSummary = added.map((d) => `${d.model}${d.condition ? ` (${d.condition})` : ""}`).join(", ");
  const reviewNote = anyReview ? " ⚠️ A new device needs a manual re-quote." : "";
  const updateBody = `[ITEM-UPDATE: ${leadId}] Customer added ${added.length} device(s): ${clean(addedSummary, 200)} — new estimated total $${total}.${reviewNote} ${json}`;
  const postRes = await fetch(`${MC_API}/api/comms`, {
    method: "POST",
    headers: { "x-api-key": MC_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: "topcash-web",
      fromName: "Customer Added Device",
      role: "system",
      body: updateBody,
      tags: anyReview ? ["item-update", "device-added", "needs-review"] : ["item-update", "device-added"],
      priority: "high",
    }),
  });
  if (!postRes.ok) {
    return NextResponse.json({ error: "Couldn't add your device — try again shortly." }, { status: 502 });
  }

  // Owner SMS so staff knows the order grew (estimate; confirmed at
  // inspection).
  {
    try {
      const customerName = field(leadMsg.body, "Name") || "Customer";
      const text = `${anyReview ? "⚠️ NEEDS REVIEW — " : ""}ADDED: ${customerName} added ${added.length} device(s) to ${leadId.slice(0, 10).toUpperCase()} → est. $${total}. ${clean(addedSummary, 160)}`;
      await notifyOwnerSms(text.slice(0, 480));
    } catch { /* SMS non-fatal */ }
  }

  return NextResponse.json({ ok: true, devices, total, added: added.length });
}
