import { NextRequest, NextResponse } from "next/server";
import { callAI } from "../../../lib/ai-gateway";
import { safeEqual } from "../../../lib/admin-auth";

// Auth gate. Production triage is done INLINE via callAI() inside
// /api/chat + /api/twilio/sms-incoming, so this standalone HTTP route
// has no first-party caller — leaving it open was a free, unauthenticated
// LLM-cost endpoint anyone could hammer. Require the admin token.
const ADMIN_TOKEN = process.env.TCC_ADMIN_TOKEN;
function authed(req: NextRequest): boolean {
  return safeEqual(req.headers.get("x-admin-token"), ADMIN_TOKEN);
}

// Inbound-message triage — classify a customer message (chat /
// inbound SMS / email reply) into a routing tag so the admin can
// filter the firehose. Cheap classification, Haiku-class model.
//
//   POST /api/ai/triage
//   { message, channel?: "chat" | "sms" | "email", context?: "..." }
//
// Returns:
//   { intent, urgency, sentiment, suggested_action }
//
// Used inline by /api/chat + /api/twilio/sms-incoming (already
// shipping by Skywalker at 8bf855d) so every inbound has a triage
// tag before it lands in MC.

const INTENTS = [
  "price_question",
  "status_check",
  "address_change",
  "payout_change",
  "dispute",
  "new_lead",
  "general_question",
  "spam",
  "thank_you",
  "other",
] as const;

export async function POST(req: NextRequest) {
  if (!authed(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  let data: { message?: string; channel?: string; context?: string } = {};
  try { data = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const { message, channel = "unknown", context } = data;
  if (!message || message.length < 2) {
    return NextResponse.json({ error: "message required" }, { status: 400 });
  }
  if (message.length > 4000) {
    return NextResponse.json({ error: "message too long" }, { status: 400 });
  }

  const sysPrompt = `You are a customer-support triage classifier for Top Cash Cellular, a phone-buyback service. Given an inbound message, return a STRICT JSON classification.

Return:
{
  "intent": one of [${INTENTS.join(", ")}],
  "urgency": "low" | "medium" | "high",
  "sentiment": "positive" | "neutral" | "negative" | "frustrated",
  "suggested_action": "<short staff guidance, under 120 chars>",
  "summary": "<one-line summary of what the customer wants, under 120 chars>"
}

Rules:
- "high" urgency: customer is angry, threatening reviews/chargeback/legal, or mentioning lost device/missed payment.
- "spam": random/promotional/non-customer text (e.g. "buy crypto here", "click this link").
- "thank_you": pure gratitude with no question, no action needed.
- If asking about pricing on a specific device → price_question.
- If asking where their package is / when they'll get paid → status_check.
- Default to "other" when in doubt — better than misclassifying.`;

  const userPrompt = `Channel: ${channel}
${context ? `Context: ${context}\n` : ""}Message: """${message.slice(0, 3500)}"""`;

  try {
    const result = await callAI({
      model: "anthropic/claude-haiku-4-5",
      messages: [
        { role: "system", content: sysPrompt },
        { role: "user", content: userPrompt },
      ],
      json: true,
      maxTokens: 300,
    });
    return NextResponse.json({
      ok: true,
      triage: result.parsed,
      tokens: result.outputTokens,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "AI Gateway failed" },
      { status: 502 },
    );
  }
}
