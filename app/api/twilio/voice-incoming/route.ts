// Twilio webhook for incoming calls. Wire this URL into the Twilio
// Console at:
//   Phone Numbers → Active Numbers → <TCC number> → Voice
//   → "A CALL COMES IN" → POST → https://topcashcellular.com/api/twilio/voice-incoming
//
// Without this endpoint, customers who call the TCC number hit a
// Twilio default "this number is unconfigured" message or silent
// hang-up. This returns TwiML that forwards the call to OWNER_PHONE
// so Skywalker's phone rings. Also posts a [CUSTOMER CALL] marker
// to MC for the call attempt — even if Skywalker doesn't answer,
// the call shows up in admin.

import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

const MC_API = "https://missioncontrolsdjg-production.up.railway.app";
const MC_KEY = process.env.MC_API_KEY || "";
const TWILIO_AUTH = process.env.TWILIO_AUTH_TOKEN || "";
const OWNER_PHONE = process.env.OWNER_PHONE || "+15129609256";

function isValidTwilioSignature(
  url: string,
  params: Record<string, string>,
  header: string | null,
): boolean {
  if (!TWILIO_AUTH) return true; // dev / unconfigured
  if (!header) return false;
  const sortedKeys = Object.keys(params).sort();
  const data = url + sortedKeys.map((k) => `${k}${params[k]}`).join("");
  const expected = crypto.createHmac("sha1", TWILIO_AUTH).update(data).digest("base64");
  const a = Buffer.from(header);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

// Build TwiML that:
//   1. Says a short greeting ("connecting you to Top Cash Cellular")
//      so the caller knows they reached the right place.
//   2. Dials OWNER_PHONE with a 20-second ring timeout.
//   3. If owner doesn't pick up, says a voicemail prompt and records.
//      Recording lands as a Twilio recording URL + the
//      RecordingStatusCallback fires our /api/twilio/voicemail
//      handler (separate, not built yet — left as a future addition).
function twiml(toNumber: string): string {
  const safe = toNumber.replace(/[^+\d]/g, "");
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna">Connecting you to Top Cash Cellular. One moment.</Say>
  <Dial timeout="20" callerId="${safe}" answerOnBridge="true">${safe}</Dial>
  <Say voice="Polly.Joanna">We couldn't reach the line. Please leave a brief message after the tone. We'll text you back today.</Say>
  <Record maxLength="120" playBeep="true" trim="trim-silence" />
  <Say voice="Polly.Joanna">Thanks. We'll be in touch shortly. Goodbye.</Say>
  <Hangup />
</Response>`;
}

export async function POST(req: NextRequest) {
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return new NextResponse(twiml(OWNER_PHONE), { headers: { "Content-Type": "text/xml" } });
  }
  const params: Record<string, string> = {};
  for (const [k, v] of formData.entries()) {
    params[k] = typeof v === "string" ? v : "";
  }

  const proto = req.headers.get("x-forwarded-proto") || "https";
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || "topcashcellular.com";
  const url = `${proto}://${host}/api/twilio/voice-incoming`;
  const sig = req.headers.get("x-twilio-signature");
  if (!isValidTwilioSignature(url, params, sig)) {
    return new NextResponse("Invalid signature", { status: 403 });
  }

  // Marker for the admin lead feed — surfaces inbound calls per
  // customer (matched by phone). Even if owner doesn't answer, the
  // attempt shows up in admin so nobody falls through the cracks.
  const clean = (s: string, max: number) =>
    s.replace(/[\[\]\r\n]+/g, " ").trim().slice(0, max);
  const from = clean(params.From || "", 30);
  const callSid = clean(params.CallSid || "", 40);
  if (MC_KEY && from) {
    try {
      await fetch(`${MC_API}/api/comms`, {
        method: "POST",
        headers: { "x-api-key": MC_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: "topcash-web",
          fromName: "Top Cash Cellular",
          role: "system",
          body: `[CUSTOMER CALL] from=${from} sid=${callSid}`,
          tags: ["voice", "inbound"],
          priority: "high",
        }),
      });
    } catch {
      // Non-fatal — call still routes.
    }
  }

  return new NextResponse(twiml(OWNER_PHONE), {
    status: 200,
    headers: { "Content-Type": "text/xml" },
  });
}
