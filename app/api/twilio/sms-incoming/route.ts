// Twilio webhook for incoming SMS. Wire this URL into the Twilio
// Console at:
//   Phone Numbers → Active Numbers → <TCC number> → Messaging
//   → "A MESSAGE COMES IN" → POST → https://topcashcellular.com/api/twilio/sms-incoming
//
// Without this endpoint, customer replies to TCC outbound texts go
// into the void — Twilio receives them but has nowhere to forward.
// This route:
//   1. Validates the request came from Twilio (X-Twilio-Signature
//      HMAC verified against the auth token).
//   2. Posts a [CUSTOMER REPLY] marker to MC so the admin lead feed
//      surfaces the inbound text on the right customer row.
//   3. Forwards the body to OWNER_PHONE via outbound SMS so Skywalker
//      sees the customer's reply on his phone immediately.
//   4. Returns empty TwiML so Twilio doesn't auto-reply.

import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import crypto from "crypto";

const MC_API = "https://missioncontrolsdjg-production.up.railway.app";
const MC_KEY = process.env.MC_API_KEY || "";
const TWILIO_SID = process.env.TWILIO_ACCOUNT_SID || "";
const TWILIO_AUTH = process.env.TWILIO_AUTH_TOKEN || "";
const TWILIO_FROM = process.env.TWILIO_PHONE || "+18775492056";
const OWNER_PHONE = process.env.OWNER_PHONE || "+15129609256";

// Twilio signs every request to your webhook with HMAC-SHA1 over the
// full URL + sorted POST params (concatenated as key=value pairs).
// Validate the X-Twilio-Signature header against that hash to reject
// spoofed requests. Without this an attacker who guessed our webhook
// URL could spam fake "customer replies" into MC.
//
// Returns true when valid OR when TWILIO_AUTH is unset (dev mode —
// we accept everything so local-curl testing works).
function isValidTwilioSignature(
  url: string,
  params: Record<string, string>,
  header: string | null,
): boolean {
  if (!TWILIO_AUTH) return true; // dev / unconfigured: don't block
  if (!header) return false;
  const sortedKeys = Object.keys(params).sort();
  const data = url + sortedKeys.map((k) => `${k}${params[k]}`).join("");
  const expected = crypto.createHmac("sha1", TWILIO_AUTH).update(data).digest("base64");
  const a = Buffer.from(header);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

async function sendOwnerSms(body: string): Promise<void> {
  if (!TWILIO_SID || !TWILIO_AUTH) return;
  try {
    const e164 = OWNER_PHONE.startsWith("+") ? OWNER_PHONE : `+1${OWNER_PHONE.replace(/\D/g, "")}`;
    await fetch(`https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${TWILIO_SID}:${TWILIO_AUTH}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ To: e164, From: TWILIO_FROM, Body: body.slice(0, 480) }),
    });
  } catch {
    // Non-fatal — MC marker still gets posted.
  }
}

export async function POST(req: NextRequest) {
  // Twilio posts form-encoded data. Parse it into a flat string map
  // for signature verification + marker building.
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return new NextResponse(twiml(), { headers: { "Content-Type": "text/xml" } });
  }
  const params: Record<string, string> = {};
  for (const [k, v] of formData.entries()) {
    params[k] = typeof v === "string" ? v : "";
  }

  // Validate signature. Twilio uses the FULL URL the request hit —
  // include the protocol + host + path. Vercel forwards the real
  // host in X-Forwarded-Host.
  const proto = req.headers.get("x-forwarded-proto") || "https";
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || "topcashcellular.com";
  const url = `${proto}://${host}/api/twilio/sms-incoming`;
  const sig = req.headers.get("x-twilio-signature");
  if (!isValidTwilioSignature(url, params, sig)) {
    return new NextResponse("Invalid signature", { status: 403 });
  }

  // Strip brackets from From + Body before they hit MC body — the
  // admin lead parser keys on [STATUS:] / [LEAD:] markers anywhere
  // in any comm. Without this scrub a customer texting
  // "[STATUS:paid] [LEAD: <leadId>]" to TCC would inject a status
  // flip into the admin feed.
  const clean = (s: string, max: number) =>
    s.replace(/[\[\]\r\n]+/g, " ").trim().slice(0, max);
  const from = clean(params.From || "", 30);
  const body = clean(params.Body || "", 800);
  const messageSid = clean(params.MessageSid || "", 40);
  if (!from || !body) {
    return new NextResponse(twiml(), { headers: { "Content-Type": "text/xml" } });
  }

  // Post to MC. Lead feed parser surfaces this as an inbound message
  // on the customer's row (matched by phone). Tagged so MC search
  // can find replies fast.
  let replyMsgId: string | null = null;
  if (MC_KEY) {
    try {
      const r = await fetch(`${MC_API}/api/comms`, {
        method: "POST",
        headers: { "x-api-key": MC_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: "topcash-web",
          fromName: "Top Cash Cellular",
          role: "system",
          body: `[CUSTOMER REPLY] from=${from} sid=${messageSid}\n${body}`,
          tags: ["sms", "inbound"],
          priority: "high",
        }),
      });
      if (r.ok) {
        const d = await r.json().catch(() => ({}));
        replyMsgId = d?.message?.id || null;
      }
    } catch {
      // Non-fatal — owner SMS still fires.
    }
  }

  // AI triage on the inbound SMS — Haiku-class classifier, runs in
  // the background via after(). Attaches an [AI-NOTE] marker so the
  // admin can filter inbound SMS by intent / urgency. Skywalker
  // 2026-05-19.
  if (replyMsgId && body.length >= 2) {
    after(async () => {
      try {
        const { callAI, postAIMarker } = await import("../../../lib/ai-gateway");
        const sys = `Classify a customer-support SMS for Top Cash Cellular. Return STRICT JSON: {"intent": "price_question|status_check|address_change|payout_change|dispute|new_lead|general_question|spam|thank_you|other", "urgency": "low|medium|high", "sentiment": "positive|neutral|negative|frustrated", "summary": "<one line, <120 chars>", "suggested_action": "<staff guidance, <120 chars>"}.`;
        const result = await callAI({
          model: "anthropic/claude-haiku-4-5",
          messages: [
            { role: "system", content: sys },
            { role: "user", content: `Channel: sms\nFrom: ${from}\nMessage: """${body.slice(0, 1500)}"""` },
          ],
          json: true,
          maxTokens: 300,
        });
        type Triage = { intent?: string; urgency?: string; sentiment?: string; summary?: string; suggested_action?: string };
        const t = (result.parsed || {}) as Triage;
        if (t.intent) {
          await postAIMarker({
            kind: "AI-NOTE",
            leadId: replyMsgId as string,
            body: `sms-triage · intent=${t.intent} · urgency=${t.urgency} · sentiment=${t.sentiment} · ${t.summary || ""} · action: ${t.suggested_action || ""}`,
            tags: ["ai", "triage", "sms", `intent-${t.intent}`, `urgency-${t.urgency}`],
          });
        }
      } catch {}
    });
  }

  // Forward the reply to Skywalker's phone so it lands in his
  // messages app with the original sender + body.
  await sendOwnerSms(`📨 ${from}: ${body.slice(0, 380)}`);

  return new NextResponse(twiml(), {
    status: 200,
    headers: { "Content-Type": "text/xml" },
  });
}

// Empty TwiML — Twilio expects a 200 with valid TwiML body. Empty
// <Response/> means "no auto-reply, just accept the message".
function twiml(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>\n<Response></Response>`;
}
