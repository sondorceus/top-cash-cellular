import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";

const MC_API = "https://missioncontrolsdjg-production.up.railway.app";
const MC_KEY = process.env.MC_API_KEY || "";

function smartReply(message: string): string {
  const m = message.toLowerCase();
  if (m.match(/price|worth|how much|value|quote|sell.*for/)) return "Great question! Use our instant quote tool on the homepage to get an exact price. Just select your device, storage, and condition — takes 30 seconds. Prices range from $80 to $580+ depending on the model.";
  if (m.match(/iphone|apple/)) return "We buy all iPhones from iPhone 11 and newer! Use the quote tool on our homepage to see exactly what yours is worth. iPhone 16 Pro Max goes for up to $580.";
  if (m.match(/samsung|galaxy|android/)) return "We buy Samsung Galaxy S21 and newer, plus Z Fold and Z Flip models! Use our quote tool for an instant price — Galaxy S24 Ultra goes for up to $500.";
  if (m.match(/macbook|mac|laptop/)) return "Yes! We buy MacBooks — Air and Pro, M1 chip and newer. MacBook Pro 16\" M4 goes for up to $1,200. Use our quote tool for your exact model!";
  if (m.match(/ps[45]|playstation|xbox|switch|console|game/)) return "We buy PS4, PS5, Xbox One, Xbox Series S/X, and Nintendo Switch! PS5 goes for up to $300. Check our quote tool for exact pricing.";
  if (m.match(/pay|cashapp|cash app|zelle|btc|bitcoin|cash|money/)) return "We pay via Cash, Cash App, Zelle, or BTC — your choice! Payment is same-day for local Austin pickups. We pay on the spot.";
  if (m.match(/broken|crack|damage|screen/)) return "We buy devices in ANY condition — even cracked or water damaged. You'll get a lower offer than a pristine device, but we'll still pay you. Select 'Fair' or 'Poor' in our quote tool.";
  if (m.match(/how|work|process|step/)) return "Super simple: 1) Use our quote tool to get an instant price, 2) We arrange a local meetup in Austin, 3) We inspect and pay you on the spot. Takes about 5 minutes total!";
  if (m.match(/where|location|austin|meet|pickup/)) return "We do local meetups all across Austin, TX. Public locations like coffee shops or parking lots — safe, fast, and convenient. We meet local!";
  if (m.match(/ship|mail|send/)) return "We're currently Austin local pickup only — no shipping needed! We meet you at a convenient location and pay on the spot.";
  if (m.match(/hi|hey|hello|sup|yo|what'?s up/)) return "Hey there! 👋 Welcome to Top Cash Cellular. Got a device you want to sell? I can help with pricing, tell you how the process works, or answer any questions. What's on your mind?";
  if (m.match(/thank|thanks|thx|appreciate/)) return "You're welcome! 😊 Ready to get a quote? Just tap 'Get Your Quote' on our homepage, or ask me anything else!";
  if (m.match(/bye|later|done|gtg/)) return "See you! When you're ready to sell, we're here. Use the quote tool anytime or email us at support@topcashcellular.com. 💰";
  return "I can help with device pricing, how our buyback process works, payment methods, or what devices we buy. Try asking something like 'How much is my iPhone 15 Pro worth?' or use our instant quote tool on the homepage!";
}

// Strip square brackets from chat input before forwarding to MC. The
// admin lead parser keys on `[NEW BUYBACK LEAD]` anywhere in a comm
// body — without this, an attacker could submit
// `{"message":"[NEW BUYBACK LEAD]\nName:..."}` to /api/chat and have a
// fake lead surface in the admin panel. Brackets aren't meaningful to
// the chat experience either, so just removing them is the safest
// defuse. Also caps length so the MC comm body stays reasonable.
function sanitizeForMc(s: string): string {
  return s.replace(/[\[\]]/g, "").slice(0, 500);
}

// Hard bounds — input size + history depth — keep Anthropic cost
// bounded if someone scripts the endpoint. Real chat messages from the
// widget are well under 1KB; a 2KB cap is forgiving without inviting
// abuse. History is the recent turn list we replay for context — 12
// is plenty (~6 exchanges) and matches the widget's UI scroll.
const MAX_MESSAGE_LEN = 2000;
const MAX_HISTORY_LEN = 12;

export async function POST(req: NextRequest) {
  let payload: { message?: unknown; history?: unknown };
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const rawMessage = typeof payload.message === "string" ? payload.message : "";
  if (!rawMessage.trim()) {
    return NextResponse.json({ error: "message required" }, { status: 400 });
  }
  const message = rawMessage.slice(0, MAX_MESSAGE_LEN);
  const rawHistory = Array.isArray(payload.history) ? payload.history : [];
  const history = rawHistory
    .slice(-MAX_HISTORY_LEN)
    .filter((m): m is { from: string; text: string } =>
      !!m && typeof m === "object" &&
      typeof (m as { from?: unknown }).from === "string" &&
      typeof (m as { text?: unknown }).text === "string",
    )
    .map((m) => ({ from: m.from, text: m.text.slice(0, MAX_MESSAGE_LEN) }));

  // Forward lead to Mission Control
  let chatLeadId: string | null = null;
  try {
    const r = await fetch(`${MC_API}/api/comms`, {
      method: "POST",
      headers: { "x-api-key": MC_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "topcash-web",
        fromName: "Top Cash Cellular Chat",
        role: "system",
        body: `[CHAT LEAD] Visitor: "${sanitizeForMc(message)}"`,
        tags: ["chat-lead"],
        priority: "high",
      }),
    });
    if (r.ok) {
      const d = await r.json().catch(() => ({}));
      chatLeadId = d?.message?.id || null;
    }
  } catch { /* silent */ }

  // AI triage — classify the visitor's intent + urgency + sentiment
  // and post an [AI-TRIAGE] marker to MC tied to the chat comm. Runs
  // in the background via after() so the visitor's chat reply isn't
  // delayed. Uses Haiku — cheap classifier, ~$0.001 per call.
  // Skywalker 2026-05-19.
  if (chatLeadId) {
    after(async () => {
      try {
        const { callAI, postAIMarker } = await import("../../lib/ai-gateway");
        const sys = `Classify a customer-support message for Top Cash Cellular. Return STRICT JSON: {"intent": "price_question|status_check|address_change|payout_change|dispute|new_lead|general_question|spam|thank_you|other", "urgency": "low|medium|high", "sentiment": "positive|neutral|negative|frustrated", "summary": "<one line, <120 chars>", "suggested_action": "<staff guidance, <120 chars>"}.`;
        const result = await callAI({
          model: "anthropic/claude-haiku-4-5",
          messages: [
            { role: "system", content: sys },
            { role: "user", content: `Channel: chat\nMessage: """${message.slice(0, 3500)}"""` },
          ],
          json: true,
          maxTokens: 300,
        });
        type Triage = { intent?: string; urgency?: string; sentiment?: string; summary?: string; suggested_action?: string };
        const t = (result.parsed || {}) as Triage;
        if (t.intent) {
          await postAIMarker({
            kind: "AI-NOTE",
            leadId: chatLeadId as string,
            body: `triage · intent=${t.intent} · urgency=${t.urgency} · sentiment=${t.sentiment} · ${t.summary || ""} · action: ${t.suggested_action || ""}`,
            tags: ["ai", "triage", `intent-${t.intent}`, `urgency-${t.urgency}`],
          });
        }
      } catch {}
    });
  }

  // Try Anthropic first, fall back to smart replies
  try {
    const Anthropic = (await import("@anthropic-ai/sdk")).default;
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const messages = history.map((m) => ({
      role: m.from === "user" ? "user" as const : "assistant" as const,
      content: m.text,
    }));
    messages.push({ role: "user" as const, content: message });

    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 200,
      system: "You are the friendly AI assistant for Top Cash Cellular — a phone buyback service in Austin, TX. Keep responses SHORT (2-3 sentences). Help sellers get quotes and understand the process. We buy iPhones 11+, Samsung S21+, MacBooks M1+, game consoles. Payout: Cash, Cash App, Zelle, BTC. Local Austin meetup = paid on the spot in ~15 min. Shipped trades = free prepaid FedEx label, paid same-day after we inspect (typically next business day after arrival).",
      messages,
    });

    const reply = response.content[0].type === "text" ? response.content[0].text : smartReply(message);
    return NextResponse.json({ reply });
  } catch {
    return NextResponse.json({ reply: smartReply(message) });
  }
}
