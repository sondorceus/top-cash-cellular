// POST /api/offer/[leadId]/cancel
//
// Customer-side cancel for an offer that hasn't been received yet.
//
// Access model: the leadId is the secret — same as the public offer
// GET route and the edit routes, since the customer reaches this from
// their own private offer link. No sign-in required; the owner gets an
// SMS on cancel, and the status gate below blocks cancelling a trade
// that's already in inspection / paid.
//
// On success: posts [DELETED-LEAD: leadId] reason=customer-cancel
// (same marker the admin trash button uses, so the admin lead parser
// already handles the soft-delete cleanup) + fires an owner SMS so
// staff knows. The offer page re-renders into the "cancelled" state
// via the existing parser path. Skywalker 2026-05-19.

import { NextRequest, NextResponse } from "next/server";

const MC_API = "https://missioncontrolsdjg-production.up.railway.app";
const MC_KEY = process.env.MC_API_KEY || "";
const TWILIO_SID = process.env.TWILIO_ACCOUNT_SID || "";
const TWILIO_AUTH = process.env.TWILIO_AUTH_TOKEN || "";
const TWILIO_FROM = process.env.TWILIO_PHONE || "";
const OWNER_PHONE = process.env.OWNER_PHONE || "+15129609256";

function field(body: string, key: string): string | undefined {
  const m = body.match(new RegExp(`(?:^|\\n)${key}:[ \\t]*([^\\n]*)`, "i"));
  return m?.[1]?.trim() || undefined;
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ leadId: string }> }) {
  const { leadId } = await ctx.params;
  if (!leadId || !/^[\w-]+$/.test(leadId)) {
    return NextResponse.json({ error: "Invalid offer id" }, { status: 400 });
  }
  if (!MC_KEY) {
    return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
  }

  // Optional cancellation note from the customer — surfaced to staff
  // so they know why ("changed my mind", "got a better offer", etc.).
  let note = "";
  try {
    const body = await req.json();
    if (typeof body?.note === "string") note = body.note.trim().slice(0, 200);
  } catch { /* note is optional */ }

  // Pull the lead body to verify ownership AND check it's still
  // cancellable (not already received / paid / cancelled).
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

  // Check status — block cancel after received/paid/met. The customer
  // can still email staff at that point but the self-serve path stops
  // here so they don't accidentally cancel a paid trade.
  let status = "quote_requested";
  let statusAt = "";
  for (const m of messages) {
    if (!m.body) continue;
    const sm = m.body.match(new RegExp(`\\[STATUS:\\s*(\\w+)\\]\\s*\\[LEAD:\\s*${leadId}\\]`, "i"));
    if (sm) {
      if (!statusAt || m.timestamp > statusAt) {
        status = sm[1].toLowerCase();
        statusAt = m.timestamp;
      }
    }
  }
  // "shipped" is terminal for self-cancel: the device is already in transit
  // with a minted label, so trashing the lead would orphan an inbound package.
  // Matches the sibling items route's LOCKED set. (bug fix)
  const TERMINAL = new Set(["received", "tested", "paid", "met", "shipped"]);
  if (TERMINAL.has(status)) {
    const phase = status === "paid" || status === "met" ? "paid" : status === "shipped" ? "already on its way to us" : "in inspection";
    return NextResponse.json({
      error: `This offer is ${phase} — please email support@topcashcellular.com to discuss.`,
    }, { status: 409 });
  }

  // Already cancelled?
  const alreadyCancelled = messages.some((m) => m.body?.includes(`[DELETED-LEAD: ${leadId}]`));
  if (alreadyCancelled) {
    return NextResponse.json({ ok: true, alreadyCancelled: true });
  }

  // Post the cancel marker — same shape the admin trash button uses.
  // The "reason=customer-cancel" tag lets staff differentiate
  // customer-initiated cancels from staff-initiated ones in MC search.
  const cancelBody = `[DELETED-LEAD: ${leadId}] [REASON: customer-cancel${note ? ` · ${note.replace(/[\[\]\n\r]/g, " ")}` : ""}]`;
  const postRes = await fetch(`${MC_API}/api/comms`, {
    method: "POST",
    headers: { "x-api-key": MC_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: "topcash-web",
      fromName: "Customer Self-Cancel",
      role: "system",
      body: cancelBody,
      tags: ["cancel", "customer-cancel"],
      priority: "high",
    }),
  });
  if (!postRes.ok) {
    return NextResponse.json({ error: "Couldn't record cancellation — try again shortly." }, { status: 502 });
  }

  // Owner SMS so staff sees the cancel land in real time — they may
  // have already booked inspection capacity / printed picking slips.
  if (TWILIO_SID && TWILIO_AUTH) {
    try {
      const e164 = OWNER_PHONE.startsWith("+") ? OWNER_PHONE : `+1${OWNER_PHONE.replace(/\D/g, "")}`;
      const customerName = field(leadMsg.body, "Name") || "Customer";
      const model = field(leadMsg.body, "Model") || field(leadMsg.body, "Device") || "device";
      const text = `❌ CANCEL: ${customerName} cancelled offer ${leadId.slice(0, 10).toUpperCase()} (${model})${note ? ` — "${note}"` : ""}`;
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

  return NextResponse.json({ ok: true });
}
