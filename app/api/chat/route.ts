import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { notifyOwnerSms } from "../../lib/owner-sms";

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
  if (m.match(/where|location|store|address|visit|come in|walk.?in|austin|meet|pickup/)) return "We don't have a walk-in store — we're online-first. You can either meet us at a safe public spot in the Austin area (paid on the spot in ~15 min) or ship it free with a prepaid label. Whichever's easier for you!";
  if (m.match(/ship|mail|send/)) return "Yes, we ship! We send a free prepaid FedEx label — pack it up, drop it off, and we pay same-day after we inspect (usually the next business day after it arrives). No store visit needed.";
  if (m.match(/human|person|talk|call.?back|text.*back|representative|agent|someone/)) return "Absolutely — I can pass your message to our team and they'll get back to you. Just drop your name and the best phone or email to reach you, and we'll text you back shortly!";
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

// Pull a phone number or email out of free text so a visitor who types
// "text me at 512-555-1212" gets a reachable lead even if they never
// fill the optional contact field. Returns "" when nothing looks like
// contact info.
function detectContact(s: string): string {
  const email = s.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/)?.[0];
  if (email) return email;
  const phone = s.match(/(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/)?.[0];
  return phone || "";
}

// Hard bounds — input size + history depth — keep Anthropic cost
// bounded if someone scripts the endpoint. Real chat messages from the
// widget are well under 1KB; a 2KB cap is forgiving without inviting
// abuse. History is the recent turn list we replay for context — 12
// is plenty (~6 exchanges) and matches the widget's UI scroll.
const MAX_MESSAGE_LEN = 2000;
const MAX_HISTORY_LEN = 12;

export async function POST(req: NextRequest) {
  let payload: { message?: unknown; history?: unknown; contact?: unknown; mode?: unknown };
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
  // Optional "text me back" contact the visitor typed into the widget,
  // plus a fallback sniff of the message itself. Either gives staff a
  // way to actually reply to the lead.
  const rawContact = typeof payload.contact === "string" ? payload.contact : "";
  const contact = (sanitizeForMc(rawContact).trim() || detectContact(message)).slice(0, 120);
  // "human" mode = the visitor tapped "Talk to a human", so Theot runs the
  // warm concierge lead-capture flow and the lead is flagged for a real
  // teammate to follow up.
  const isHumanHandoff = payload.mode === "human";
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
        body: `${isHumanHandoff ? "[HUMAN HANDOFF] " : ""}[CHAT LEAD] Visitor${contact ? ` (reply to: ${sanitizeForMc(contact)})` : ""}: "${sanitizeForMc(message)}"`,
        tags: [
          "chat-lead",
          ...(contact ? ["has-contact"] : []),
          ...(isHumanHandoff ? ["human-handoff", "needs-callback"] : []),
        ],
        priority: "high",
      }),
    });
    if (r.ok) {
      const d = await r.json().catch(() => ({}));
      chatLeadId = d?.message?.id || null;
    }
  } catch { /* silent */ }

  // Real-time owner SMS for HOT chat leads, so a visitor asking for a human
  // (or dropping their number) reaches the owner's phone instantly, not just
  // the Mission Control inbox. Deliberately narrow to avoid one text per
  // message: fires (1) the moment a "talk to a human" handoff starts, and
  // (2) any turn where the visitor types a phone/email in this message.
  // Runs in after() so it never delays the chat reply.
  const detectedNow = detectContact(message);
  const handoffStarted = isHumanHandoff && history.length <= 1;
  if (handoffStarted || detectedNow) {
    const snippet = sanitizeForMc(message).slice(0, 200);
    const alert = handoffStarted
      ? `🔥 TopCash chat: a visitor wants to talk to a human.\n"${snippet}"${contact ? `\nReply to: ${contact}` : ""}`
      : `📱 TopCash chat lead left contact: ${detectedNow}\n"${snippet}"`;
    after(() => notifyOwnerSms(alert));
  }

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

  // Shared facts both personas must respect.
  const FACTS = [
    "CRITICAL — we have NO physical store and NO walk-in counter. We are online-first. NEVER tell anyone to 'come to our store', 'visit our location', 'stop by', or 'walk in'. There are exactly two ways to sell: (1) LOCAL — meet us at a safe public spot in the Austin area, inspected and paid on the spot in ~15 min; or (2) SHIP — we send a free prepaid FedEx label and pay same-day after we inspect (usually the next business day after it arrives).",
    "We buy: iPhones 11+, Samsung Galaxy S21+ (incl. Z Fold/Flip), MacBooks M1+, and game consoles (PS4/PS5, Xbox, Switch) — any condition, even cracked or water-damaged (lower offer). Payout: Cash, Cash App, Zelle, or BTC, the customer's choice. For an exact price, point them to the instant quote tool on the homepage (~30 seconds).",
  ];
  // Default assistant vs. the warm concierge lead-capture flow.
  const systemPrompt = isHumanHandoff
    ? [
        "You are Theot, the concierge for Top Cash Cellular (Austin, TX device buyback). The visitor just asked to talk to a human, so a real teammate WILL follow up — your job is to warmly greet them, gather what the team needs, and keep them excited about a great offer. Be warm and human, brief (2-3 sentences), and ask only ONE question at a time.",
        "Be honest: you are the team's assistant and a real person follows up — never claim to literally be a human, but never say you 'can't help' or 'can't pass a message' either.",
        "Collect, conversationally, only what's still missing, in this rough order: (1) what device they're selling (model + storage) and its condition; (2) their name; (3) the best phone number or email for the team to reach them. The moment you have a device AND a way to contact them, confirm warmly by name: 'Perfect, {name} — I've got this to our team and they'll text you a firm offer shortly,' then invite them to grab an instant ballpark from the quote tool on the homepage while they wait.",
        "Build value as you go (mention strong payouts, fast same-day pay, easy local-or-ship). Encourage, never pressure; if they decline to share info, stay friendly and still offer the quote tool.",
        ...FACTS,
      ].join(" ")
    : [
        "You are Theot, the warm, helpful assistant for Top Cash Cellular, a phone & device buyback service based in Austin, TX. Keep replies SHORT (2-3 sentences) and friendly.",
        ...FACTS,
        "YOU CAN RELAY MESSAGES TO THE TEAM. If someone wants a human, asks something you can't fully answer, or wants a callback, NEVER say you can't help or can't pass a message along. Instead, ask for their name and best phone number or email, then confirm: 'Got it — I'll pass this to our team and they'll text you back shortly.' Every message is already logged for the team.",
        "GOAL: gently help them get a quote or leave their device + a phone/email so we can text an offer. Encourage, never pressure, and never require info to keep chatting.",
      ].join(" ");

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
      system: systemPrompt,
      messages,
    });

    const reply = response.content[0].type === "text" ? response.content[0].text : fallbackReply(message, isHumanHandoff, history.length);
    return NextResponse.json({ reply });
  } catch {
    return NextResponse.json({ reply: fallbackReply(message, isHumanHandoff, history.length) });
  }
}

// Picks the right canned reply when Anthropic is unavailable. On the first
// turn of a human handoff we open with the warm concierge greeting; after
// that we defer to the keyword matcher.
function fallbackReply(message: string, isHumanHandoff: boolean, historyLen: number): string {
  if (isHumanHandoff && historyLen <= 1) {
    return "Hey, it's Theot from the Top Cash team 👋 Happy to get a real person on this for you. To start — what device are you looking to sell, and what kind of condition is it in?";
  }
  return smartReply(message);
}
