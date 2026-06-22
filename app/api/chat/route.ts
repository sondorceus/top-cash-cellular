import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { notifyOwnerSms } from "../../lib/owner-sms";
import { clientIp, rateLimit } from "../../lib/rate-limit";

const MC_API = "https://missioncontrolsdjg-production.up.railway.app";
const MC_KEY = process.env.MC_API_KEY || "";

function smartReply(message: string): string {
  const m = message.toLowerCase();
  if (m.match(/price|worth|how much|value|quote|sell.*for/)) return "Use the instant quote tool on the homepage to get an exact price — pick your device, storage, and condition. Takes about 30 seconds. Most phones land between $80 and $580+ depending on the model.";
  if (m.match(/iphone|apple/)) return "We buy iPhones from the 11 and newer. Use the quote tool on the homepage to see what yours is worth — the iPhone 16 Pro Max is up to $580.";
  if (m.match(/samsung|galaxy|android/)) return "We buy Samsung Galaxy S21 and newer, plus the Z Fold and Z Flip. Use the quote tool for an instant price — the Galaxy S24 Ultra is up to $500.";
  if (m.match(/macbook|mac|laptop/)) return "We buy MacBooks — Air and Pro, M1 and newer. A MacBook Pro 16\" M4 is up to $1,200. Use the quote tool for your exact model.";
  if (m.match(/ps[45]|playstation|xbox|switch|console|game/)) return "We buy PS4, PS5, Xbox One, Xbox Series S/X, and Nintendo Switch. A PS5 is up to $300. Check the quote tool for exact pricing.";
  if (m.match(/pay|cashapp|cash app|zelle|btc|bitcoin|cash|money/)) return "We pay by cash, Cash App, Zelle, or BTC. Local Austin pickups are paid same-day, on the spot.";
  if (m.match(/broken|crack|damage|screen/)) return "We buy devices in any condition, including cracked or water-damaged. The offer is lower than a clean device, but we'll still buy it — pick 'Fair' or 'Poor' in the quote tool.";
  if (m.match(/how|work|process|step/)) return "Three steps: use the quote tool for an instant price, we set up a local meetup in Austin (or send a free shipping label), then we inspect and pay you. Local handoffs usually take about 15 minutes.";
  if (m.match(/where|location|store|address|visit|come in|walk.?in|austin|meet|pickup/)) return "We're online-first — no walk-in store. You can meet us at a safe public spot in the Austin area (paid on the spot in about 15 minutes) or ship free with a prepaid label, whichever's easier.";
  if (m.match(/ship|mail|send/)) return "Yes, we ship. We send a free prepaid FedEx label — pack it, drop it off, and we pay same-day after inspection (usually the next business day after it arrives). No store visit needed.";
  if (m.match(/human|person|talk|call.?back|text.*back|representative|agent|someone/)) return "Sure — I can pass your message to our team and they'll get back to you. Leave your name and the best phone or email to reach you, and we'll text you back.";
  if (m.match(/hi|hey|hello|sup|yo|what'?s up/)) return "Welcome to Top Cash Cellular. Got a device to sell? I can help with pricing, how the process works, or any other questions.";
  if (m.match(/thank|thanks|thx|appreciate/)) return "You're welcome. When you're ready, tap 'Get Your Quote' on the homepage — or ask me anything else.";
  if (m.match(/bye|later|done|gtg/)) return "Anytime. When you're ready to sell, use the quote tool or email support@topcashcellular.com.";
  return "I can help with device pricing, how the buyback works, payment methods, or what we buy. Ask something like 'How much is my iPhone 15 Pro worth?' or use the instant quote tool on the homepage.";
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

// Best-effort device summary scraped from the whole conversation so a
// captured lead reads "iPhone 14 Pro, 256gb, cracked" instead of just a
// contact. Heuristic and forgiving — returns "" when nothing matches.
function extractDevice(text: string): string {
  // Collect every brand/model hit and keep the most specific (longest) one,
  // so "iPhone 14 Pro" wins over a bare "iphone" mentioned earlier.
  const brands = text.match(/iphone(?:\s+\d+\s*(?:pro\s*max|pro|plus|mini)?)?|galaxy\s*[a-z]?\s*\d*\s*(?:ultra|plus|fe)?|samsung|pixel\s*\d*|macbook(?:\s+(?:air|pro))?(?:\s+\d{2}")?|ipad(?:\s+(?:pro|air|mini))?|imac|mac\s*mini|playstation\s*\d?|ps[45]|xbox(?:\s+series\s*[sx])?|nintendo\s*switch|switch|apple\s*watch|airpods/gi) || [];
  const brand = brands.map((b) => b.trim()).sort((a, b) => b.length - a.length)[0];
  if (!brand) return "";
  const storage = text.match(/\b\d{2,4}\s?(?:gb|tb)\b/i)?.[0];
  const condition = text.match(/cracked|shattered|broken|water\s*damage|won'?t\s*(?:turn on|boot|charge)|mint|like\s*new|brand\s*new|excellent|good|fair|poor|scratched|dented/i)?.[0];
  return [brand, storage, condition].filter((s): s is string => !!s).map((s) => s.trim().replace(/\s+/g, " ")).join(", ");
}

// Hard bounds — input size + history depth — keep Anthropic cost
// bounded if someone scripts the endpoint. Real chat messages from the
// widget are well under 1KB; a 2KB cap is forgiving without inviting
// abuse. History is the recent turn list we replay for context — 12
// is plenty (~6 exchanges) and matches the widget's UI scroll.
const MAX_MESSAGE_LEN = 2000;
const MAX_HISTORY_LEN = 12;

export async function POST(req: NextRequest) {
  let payload: { message?: unknown; history?: unknown; contact?: unknown; mode?: unknown; sessionId?: unknown };
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const rawMessage = typeof payload.message === "string" ? payload.message : "";
  if (!rawMessage.trim()) {
    return NextResponse.json({ error: "message required" }, { status: 400 });
  }

  // Throttle this public, unauthenticated endpoint BEFORE any costly work
  // (Anthropic tokens, an MC post per message, an owner SMS). On a soft trip
  // we return a friendly 200 so a fast-typing human isn't shown an error,
  // but we skip all the fan-out. ~25 msgs / 5 min is generous for real chat.
  const ip = clientIp(req);
  if (!rateLimit(`chat:${ip}`, 25, 5 * 60_000).ok) {
    return NextResponse.json({ reply: "You're sending messages really fast! Give me a few seconds, then try again 🙂" });
  }
  const message = rawMessage.slice(0, MAX_MESSAGE_LEN);
  // Stable per-conversation id from the widget so all of one chat's leads
  // thread together in Mission Control instead of scattering into N comms.
  const sessionId = (typeof payload.sessionId === "string" ? payload.sessionId : "").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 24);
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

  // Read contact + a rough device summary from the WHOLE conversation, not
  // just this message, so a number typed two turns ago still reaches staff.
  const rawContact = typeof payload.contact === "string" ? payload.contact : "";
  const fieldContact = sanitizeForMc(rawContact).trim();
  const priorUserText = history.filter((m) => m.from === "user").map((m) => m.text).join("  ");
  const userText = `${priorUserText}  ${message}`;
  const contact = (fieldContact || detectContact(userText)).slice(0, 120);
  const deviceSummary = extractDevice(userText);

  // Decide whether THIS turn is worth a Mission Control post. Posting every
  // message buried real leads in chatter; instead we post only on material
  // turns — the opener, a human-handoff start, or the turn a contact first
  // appears — all threaded by sessionId so one chat reads as one lead.
  const contactSeenBefore = !!detectContact(priorUserText);
  const detectedNow = !!detectContact(message);
  const contactJustArrived = !contactSeenBefore && (detectedNow || (!!fieldContact && history.length === 0));
  const isOpener = history.length === 0;
  const handoffStarted = isHumanHandoff && history.length <= 1;
  const material = isOpener || handoffStarted || contactJustArrived;

  // Forward material leads to Mission Control
  let chatLeadId: string | null = null;
  if (material) {
    const sess = sessionId ? `sess:${sessionId} · ` : "";
    const body = contactJustArrived
      ? `[CHAT LEAD ✅] ${sess}${deviceSummary ? `${deviceSummary} · ` : ""}reply to: ${sanitizeForMc(contact)}\n"${sanitizeForMc(message)}"`
      : `${isHumanHandoff ? "[HUMAN HANDOFF] " : ""}[CHAT LEAD] ${sess}Visitor${contact ? ` (reply to: ${sanitizeForMc(contact)})` : ""}: "${sanitizeForMc(message)}"`;
    try {
      const r = await fetch(`${MC_API}/api/comms`, {
        method: "POST",
        headers: { "x-api-key": MC_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: "topcash-web",
          fromName: "Top Cash Cellular Chat",
          role: "system",
          body,
          tags: [
            "chat-lead",
            ...(sessionId ? [`sess-${sessionId}`] : []),
            ...(contact ? ["has-contact"] : []),
            ...(contactJustArrived ? ["lead-complete"] : []),
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
  }

  // Real-time owner SMS for HOT chat leads, so a visitor asking for a human
  // (or dropping their contact) reaches the owner's phone instantly, not just
  // the Mission Control inbox. Same narrow triggers as a material lead post,
  // so it's at most a couple texts per conversation. Runs in after() so it
  // never delays the chat reply.
  if (handoffStarted || contactJustArrived) {
    // Belt-and-suspenders on the SMS fan-out: even within the chat allowance,
    // bound texts to the owner's phone — 3 per IP / 15 min, and a global
    // backstop of 20 / 10 min so distributed abuse still can't bomb it.
    const smsOk = rateLimit(`chat-sms:${ip}`, 3, 15 * 60_000).ok
      && rateLimit("chat-sms:global", 20, 10 * 60_000).ok;
    if (smsOk) {
      const snippet = sanitizeForMc(message).slice(0, 200);
      const alert = handoffStarted
        ? `🔥 TopCash chat: a visitor wants to talk to a human.\n"${snippet}"${contact ? `\nReply to: ${contact}` : ""}`
        : `📱 TopCash chat lead left contact: ${contact}${deviceSummary ? ` (${deviceSummary})` : ""}\n"${snippet}"`;
      after(() => notifyOwnerSms(alert));
    }
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
  // Tone rule applied to BOTH personas: plain, calm, human — like a real
  // small-business owner texting back, not a chirpy AI assistant. Skywalker
  // wants the cheesy/AI-sounding voice gone.
  const TONE = "Tone: plain, calm, and human — like a real small-business owner texting back. NO emojis. No exclamation-heavy hype and no marketing buzzwords ('amazing', 'awesome', 'super', 'great offer', 'exciting', 'happy to help'). Don't gush or oversell. Say it straight.";
  const systemPrompt = isHumanHandoff
    ? [
        "You are Theot, the assistant for Top Cash Cellular (Austin, TX device buyback). The visitor just asked to talk to a human, so a real teammate will follow up — greet them plainly, gather what the team needs, and keep it brief (2-3 sentences). Ask only ONE question at a time.",
        TONE,
        "Be honest: you are the team's assistant and a real person follows up — never claim to literally be a human, but never say you 'can't help' or 'can't pass a message' either.",
        "Collect, conversationally, only what's still missing, in this rough order: (1) what device they're selling (model + storage) and its condition; (2) their name; (3) the best phone number or email for the team to reach them. The moment you have a device AND a way to contact them, confirm by name: 'Thanks, {name} — I've passed this to our team and they'll text you a firm offer shortly,' then mention they can get an instant ballpark from the quote tool on the homepage while they wait.",
        "Be straightforward, not salesy. State the facts (same-day pay, local-or-ship) only if relevant; don't pitch. Never pressure; if they decline to share info, stay helpful and still offer the quote tool.",
        ...FACTS,
      ].join(" ")
    : [
        "You are Theot, the assistant for Top Cash Cellular, a phone & device buyback service in Austin, TX. Keep replies SHORT (2-3 sentences), plain, and helpful.",
        TONE,
        ...FACTS,
        "YOU CAN RELAY MESSAGES TO THE TEAM. If someone wants a human, asks something you can't fully answer, or wants a callback, NEVER say you can't help or can't pass a message along. Instead, ask for their name and best phone number or email, then confirm: 'Got it — I'll pass this to our team and they'll text you back shortly.' Every message is already logged for the team.",
        "GOAL: help them get a quote or leave their device + a phone/email so we can text an offer. Don't pressure, and never require info to keep chatting.",
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
    return "This is Theot from the Top Cash team. I'll get this to a real person for you. To start — what device are you selling, and what condition is it in?";
  }
  return smartReply(message);
}
