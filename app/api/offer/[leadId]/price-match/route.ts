// POST /api/offer/[leadId]/price-match
//
// The "Best Price Guarantee" form on the offer page. Customer says they
// found a higher quote at a competitor — we record it as a marker on
// MC, owner-SMS so staff sees it land, and staff then uses the existing
// counter-offer system to honor or beat. Deliberately human-in-the-loop:
// we don't trust an auto-honor pipeline (it'd be a margin-bleed exploit
// — anyone could paste a fake URL with a wild number).
//
// Access model mirrors /api/offer/[leadId]/cancel — the leadId is the
// secret, no sign-in required. Skywalker 2026-05-22.

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

// Sanitize a free-text field so it can't forge marker brackets / inject
// a fake `\n` line into the marker body that the admin parser reads.
function clean(s: string, max: number): string {
  return s.replace(/[[\]\r\n]+/g, " ").trim().slice(0, max);
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

  let body: { competitor?: unknown; amount?: unknown; url?: unknown; note?: unknown; kind?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  // Two flavors share this endpoint, owner-SMS, and human-in-the-loop
  // honoring:
  //   - "price-match": customer found a higher quote elsewhere (needs a
  //     competitor + their number).
  //   - "counter": customer just isn't happy with our number and wants
  //     to propose their own (no competitor required, note optional).
  const isCounter = body.kind === "counter";
  const competitor = clean(typeof body.competitor === "string" ? body.competitor : "", 60);
  const amount = Math.round(Number(body.amount));
  const url = clean(typeof body.url === "string" ? body.url : "", 240);
  const note = clean(typeof body.note === "string" ? body.note : "", 300);
  if (!isCounter && !competitor) {
    return NextResponse.json({ error: "Tell us where you got the other quote." }, { status: 400 });
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: isCounter ? "Enter the amount you were hoping for." : "Enter the dollar amount they quoted." }, { status: 400 });
  }
  // The URL is optional; if provided, lightly check it looks like a URL
  // before letting it land in the marker. Don't try to "verify" it — a
  // human reviews anyway.
  if (url && !/^https?:\/\//i.test(url)) {
    return NextResponse.json({ error: "If you include a link, it should start with http:// or https://." }, { status: 400 });
  }

  // Verify the lead exists (the leadId is the access secret). limit=5000
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

  // Post the marker. Admin parses this in /api/admin/leads to badge
  // the lead row and surfaces the details so staff can mint a counter
  // through the existing counter-offer flow.
  const at = new Date().toISOString();
  const markerBody = isCounter
    ? `[COUNTER-REQUEST: leadId=${leadId} amount=${amount} at=${at}]${note ? `\nNote: ${note}` : ""}`
    : `[PRICE-MATCH-REQUEST: leadId=${leadId} competitor=${competitor} amount=${amount} at=${at}]${url ? `\nUrl: ${url}` : ""}${note ? `\nNote: ${note}` : ""}`;
  const postRes = await fetch(`${MC_API}/api/comms`, {
    method: "POST",
    headers: { "x-api-key": MC_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: "topcash-web",
      fromName: isCounter ? "Counter-Offer Request" : "Price-Match Request",
      role: "system",
      body: markerBody,
      tags: isCounter ? ["counter-request", "request"] : ["price-match", "request"],
      priority: "high",
    }),
  });
  if (!postRes.ok) {
    return NextResponse.json({ error: "Couldn't record your request — try again shortly." }, { status: 502 });
  }

  // Owner SMS — staff sees it land in real time and can act before the
  // customer goes elsewhere.
  if (TWILIO_SID && TWILIO_AUTH) {
    try {
      const e164 = OWNER_PHONE.startsWith("+") ? OWNER_PHONE : `+1${OWNER_PHONE.replace(/\D/g, "")}`;
      const customerName = field(leadMsg.body, "Name") || "Customer";
      const model = field(leadMsg.body, "Model") || field(leadMsg.body, "Device") || "device";
      const ourQuote = field(leadMsg.body, "Quote") || "";
      const text = isCounter
        ? `💬 COUNTER: ${customerName} (${model}) isn't happy — wants $${amount}${ourQuote ? ` (we quoted ${ourQuote})` : ""}.${note ? ` "${note}"` : ""} Offer ${leadId.slice(0, 10).toUpperCase()}.`
        : `🎯 PRICE-MATCH: ${customerName} (${model}) says ${competitor} quoted $${amount}${ourQuote ? ` — we quoted ${ourQuote}` : ""}. Offer ${leadId.slice(0, 10).toUpperCase()}.`;
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

  return NextResponse.json({ ok: true, at });
}
