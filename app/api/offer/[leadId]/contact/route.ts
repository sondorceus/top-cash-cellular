// POST /api/offer/[leadId]/contact
//
// Customer-side contact-info edit. Currently scoped to the phone number
// only — name and email are fixed (email is the account identity).
//
// Access model: the leadId is the secret — same as the public offer
// GET route and the device-edit route, since the customer reaches this
// from their own private offer link. No sign-in required; the owner
// gets an SMS on every change.
//
// On success: posts a [CONTACT-UPDATE: leadId] marker to MC carrying
// the new phone. The offer GET route parses the latest such marker and
// overrides the displayed phone. An owner SMS fires so staff sees the
// change (the FedEx label, if already minted, still has the old phone).
// Skywalker 2026-05-20.

import { NextRequest, NextResponse } from "next/server";
import { rateLimit, rateLimitResponse, clientIp } from "../../../../lib/rate-limit";

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
  // Throttle — leadId is the only access control; don't let a leaked link
  // flood MC / owner SMS.
  const rl = rateLimit(`offer:${clientIp(req)}`, 20, 60_000);
  if (!rl.ok) return rateLimitResponse(rl.retryAfterMs);
  if (!MC_KEY) {
    return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
  }

  // Parse + validate the new phone. Digits-only must be at least 10 —
  // matches the shipping-label guard on the lead form.
  let phone = "";
  try {
    const body = await req.json();
    if (typeof body?.phone === "string") phone = body.phone.trim();
  } catch { /* handled below */ }
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 10 || digits.length > 15) {
    return NextResponse.json({ error: "Enter a valid phone number." }, { status: 400 });
  }
  // Strip characters that would break the MC marker / lead parser.
  const phoneClean = phone.replace(/[\[\]\n\r]/g, " ").trim().slice(0, 40);

  // Pull the lead body to confirm it's a real buyback lead. limit=5000
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

  // Already cancelled? No point editing.
  const cancelled = messages.some((m) => m.body?.includes(`[DELETED-LEAD: ${leadId}]`));
  if (cancelled) {
    return NextResponse.json({ error: "This offer was cancelled." }, { status: 409 });
  }

  // Post the contact-update marker. Human-readable so staff scanning
  // MC see it; the `phone=` token is what the offer GET route parses.
  const updateBody = `[CONTACT-UPDATE: ${leadId}] Customer updated phone — phone=${phoneClean}`;
  const postRes = await fetch(`${MC_API}/api/comms`, {
    method: "POST",
    headers: { "x-api-key": MC_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: "topcash-web",
      fromName: "Customer Contact Update",
      role: "system",
      body: updateBody,
      tags: ["contact-update"],
      priority: "normal",
    }),
  });
  if (!postRes.ok) {
    return NextResponse.json({ error: "Couldn't save the update — try again shortly." }, { status: 502 });
  }

  // Owner SMS — staff may need to reprint a label with the new number.
  if (TWILIO_SID && TWILIO_AUTH) {
    try {
      const e164 = OWNER_PHONE.startsWith("+") ? OWNER_PHONE : `+1${OWNER_PHONE.replace(/\D/g, "")}`;
      const customerName = field(leadMsg.body, "Name") || "Customer";
      const text = `✏️ CONTACT: ${customerName} updated phone on offer ${leadId.slice(0, 10).toUpperCase()} → ${phoneClean}`;
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

  return NextResponse.json({ ok: true, phone: phoneClean });
}
