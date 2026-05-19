// Customer-side endpoint hit by the /counter/[token] page Accept and
// Decline buttons. Verifies the HMAC token, posts a [COUNTER-RESPONSE]
// marker to MC, and notifies the owner via SMS so they can flip the
// lead's actual status (paid prep or return-device flow).
//
// Token is single-use in effect: even though we don't burn it, we post
// a marker that the admin page will treat as terminal. A customer who
// re-clicks the accept link after responding just sees a "you've
// already responded" message from the /counter page.

import { NextRequest, NextResponse } from "next/server";
import { verifyCounterToken } from "../../../lib/counter-token";
import { reportError } from "../../../lib/error-report";

const MC_API = "https://missioncontrolsdjg-production.up.railway.app";
const MC_KEY = process.env.MC_API_KEY || "";
const TWILIO_SID = process.env.TWILIO_ACCOUNT_SID || "";
const TWILIO_AUTH = process.env.TWILIO_AUTH_TOKEN || "";
const TWILIO_FROM = process.env.TWILIO_PHONE || "+18775492056";
const OWNER_PHONE = process.env.OWNER_PHONE || "+15129609256";

export async function POST(req: NextRequest) {
  let body: { token?: string; response?: "accept" | "decline"; note?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { token, response, note } = body;
  if (!token) return NextResponse.json({ error: "token required" }, { status: 400 });
  if (response !== "accept" && response !== "decline") {
    return NextResponse.json({ error: "response must be 'accept' or 'decline'" }, { status: 400 });
  }

  const payload = verifyCounterToken(token);
  if (!payload) return NextResponse.json({ error: "Invalid or expired offer link" }, { status: 400 });

  // Idempotency + double-response defense. Without this, a customer
  // (or anyone replaying the request) could:
  //   1. Click Accept → owner SMS "ACCEPTED, move to paid prep"
  //   2. Click Decline later → owner SMS "DECLINED, return device free"
  // The two notifications conflict and the staff acts on the second.
  // Query MC for the most recent [COUNTER-RESPONSE: leadId] marker for
  // this lead. If found:
  //   - same response as the incoming → silently return ok (idempotent)
  //   - different response → refuse + tell the customer to contact staff
  if (MC_KEY) {
    try {
      const r = await fetch(`${MC_API}/api/comms?limit=300`, {
        headers: { "x-api-key": MC_KEY },
        cache: "no-store",
      });
      if (r.ok) {
        const data = await r.json();
        const messages: { body?: string; timestamp: string }[] = data.messages || [];
        // Find the most-recent COUNTER-RESPONSE for this lead.
        let prevResponse: "accept" | "decline" | null = null;
        let prevTs = "";
        const wanted = `[COUNTER-RESPONSE: ${payload.leadId}]`;
        for (const m of messages) {
          if (!m.body || !m.body.includes(wanted)) continue;
          const match = m.body.match(/response=(accept|decline)/i);
          if (!match) continue;
          if (m.timestamp > prevTs) {
            prevTs = m.timestamp;
            prevResponse = match[1].toLowerCase() as "accept" | "decline";
          }
        }
        if (prevResponse === response) {
          return NextResponse.json({ ok: true, response, leadId: payload.leadId, idempotent: true });
        }
        if (prevResponse && prevResponse !== response) {
          return NextResponse.json({
            error: `This offer has already been ${prevResponse === "accept" ? "accepted" : "declined"}. Contact CustomerService@topcashcells.com to change your decision.`,
          }, { status: 409 });
        }
      }
    } catch {
      // Non-fatal — proceed with posting the response if MC lookup fails.
      // Worst case: idempotency not enforced this request, marker is
      // still posted (most-recent-wins on the admin side).
    }
  }

  // Post the response marker. The admin /api/admin/leads route parses
  // [COUNTER-RESPONSE: <leadId>] response=accept|decline to surface
  // the outcome on the lead row.
  //
  // Strip [ and ] from note text before interpolation. Without this a
  // note like `] [STATUS: paid` would close the COUNTER-RESPONSE
  // marker and inject a downstream [STATUS:] / [LEAD:] token that the
  // admin parser would happily honor on this lead.
  const noteText = (note || "").replace(/[\[\]\n\r]/g, " ").slice(0, 300);
  const markerBody = `[COUNTER-RESPONSE: ${payload.leadId}] response=${response} offer=$${payload.offer} original=$${payload.originalQuote}${noteText ? ` note=${noteText}` : ""}`;
  if (MC_KEY) {
    try {
      await fetch(`${MC_API}/api/comms`, {
        method: "POST",
        headers: { "x-api-key": MC_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: "topcash-web",
          fromName: "Top Cash Cellular",
          role: "system",
          body: markerBody,
          tags: ["counter-offer", `response-${response}`],
          priority: "high",
        }),
      });
    } catch (err) {
      reportError("counter-offer.response.marker", err, { leadId: payload.leadId, critical: false });
    }
  }

  // Owner SMS so staff acts immediately (accepted = move toward paid;
  // declined = arrange return shipping).
  if (TWILIO_SID && TWILIO_AUTH) {
    try {
      const verb = response === "accept" ? "ACCEPTED" : "DECLINED";
      const e164 = OWNER_PHONE.startsWith("+") ? OWNER_PHONE : `+1${OWNER_PHONE.replace(/\D/g, "")}`;
      const smsBody = `TCC: Counter-offer ${verb} — Lead ${payload.leadId}, offer $${payload.offer} (was $${payload.originalQuote}). ${response === "accept" ? "Move to paid prep." : "Return device free."}${noteText ? ` Note: ${noteText.slice(0, 120)}` : ""}`;
      await fetch(`https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`, {
        method: "POST",
        headers: {
          Authorization: `Basic ${Buffer.from(`${TWILIO_SID}:${TWILIO_AUTH}`).toString("base64")}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({ To: e164, From: TWILIO_FROM, Body: smsBody.slice(0, 480) }),
      });
    } catch (err) {
      reportError("counter-offer.response.owner-sms", err, { leadId: payload.leadId, critical: false });
    }
  }

  return NextResponse.json({ ok: true, response, leadId: payload.leadId });
}
