import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { notifyOwnerSms } from "../../lib/owner-sms";
import { clientIp, rateLimit } from "../../lib/rate-limit";
import { SELL_TOOLS, runQuote, runImeiCheck, looksBulk } from "../../lib/sell-tools";

const MC_API = "https://missioncontrolsdjg-production.up.railway.app";
const MC_KEY = process.env.MC_API_KEY || "";

// Conversation model. Sonnet-tier for the same reason /api/msgr-ai is: the
// live rule-following failures (re-asking an answered spec, narrating tool
// use, parroting example lines) are ones Haiku keeps making despite HARD-RULE
// prompts — and this surface now names real prices, so those failures cost
// money. Env-overridable for instant rollback.
const CHAT_MODEL = process.env.CHAT_AI_MODEL || "claude-sonnet-5";
// Sonnet 5 runs ADAPTIVE THINKING when `thinking` is omitted and would burn
// the whole token budget thinking. Disable explicitly; not sent for haiku,
// where omitting the param IS the off state.
const THINKING_OFF = /sonnet-5|opus-4-[678]/.test(CHAT_MODEL) ? { thinking: { type: "disabled" as const } } : {};
// Tool round-trips per turn. get_quote on several devices in one message is
// the realistic ceiling; 4 leaves room without letting a loop run away.
const MAX_TOOL_ROUNDS = 4;

function smartReply(message: string): string {
  const m = message.toLowerCase();
  if (m.match(/\b(?:\d+|few|couple|several|multiple|bunch)\s+(?:iphones?|phones?|devices?|galaxys?|samsungs?|pixels?)\b/)) return "nice — list what you've got (model, storage, condition for each) and drop your number. we'll text you a real offer for the lot.";
  if (m.match(/price|worth|how much|value|quote|sell.*for/)) return "Use the instant quote tool on the homepage to get an exact price — pick your device, storage, and condition. Takes about 30 seconds.";
  if (m.match(/iphone|apple/)) return "We buy iPhones from the 11 and newer. Use the quote tool on the homepage to see what yours is worth.";
  if (m.match(/samsung|galaxy|android/)) return "We buy Samsung Galaxy S21 and newer, plus the Z Fold and Z Flip. Use the quote tool for an instant price.";
  if (m.match(/macbook|mac|laptop/)) return "We buy MacBooks — Air and Pro, M1 and newer. Use the quote tool for your exact model.";
  if (m.match(/ps[45]|playstation|xbox|switch|console|game/)) return "We buy PS4, PS5, Xbox One, Xbox Series S/X, and Nintendo Switch. Check the quote tool for exact pricing.";
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
        "You are Theot, the assistant for Top Cash Cellular, a phone & device buyback service serving Austin, Houston and San Antonio, TX. Keep replies SHORT (2-3 sentences), plain, and helpful. Ask only ONE question at a time.",
        // VOICE: company register — 'we / our team', never the owner's first
        // person. This is the OPPOSITE of /api/msgr-ai, where the bot texts as
        // Sonny himself ('i can do 650 cash'). A DM feels like a person; the
        // website is a business. Sonny 2026-08-19.
        "Speak as the company: 'we' and 'our team', never 'I can do $X' as if you were the owner. Never name the owner to the customer.",
        TONE,
        ...FACTS,

        // ---- QUOTING POLICY (site chat) -------------------------------------
        // This is the OPPOSITE of /api/msgr-ai, and deliberately so. Typed
        // Messenger never quotes: no structured condition flow, and a number in
        // a DM becomes an anchor the owner has to honour or walk back. On our
        // own site the funnel already publishes the exact same number to anyone
        // who clicks through, so refusing to say it here is theatre — it just
        // makes the chat worse than the page it sits on. Sonny 2026-08-19.
        "PRICING — you DO give real prices here, but ONLY ones that came back from the get_quote tool. NEVER invent, estimate, round, or 'ballpark' a number, and never quote from memory or from anything in this prompt. If get_quote did not return a number, you do not have a number.",
        "SINGLE DEVICE: once you have model + condition (ask for storage and carrier if the model needs them), call get_quote and tell them the number plainly — 'your 13 Pro 256 comes out to $430'. Then offer to lock it in. That is a normal close and you can do it yourself.",
        "MULTIPLE DEVICES (2 or more): quote each one with its own get_quote call and give them a running total, then STOP SHORT OF CLOSING. Call notify_team with the full itemized list and tell them our team will confirm the package. Do NOT promise a package price, a bundle discount, or any number above the sum of the individual quotes — bulk pricing is the owner's call, not yours.",
        "NOT IN THE INSTANT CATALOG: if get_quote comes back with no offer (older iPhones, Intel/legacy MacBooks, tablets, watches, consoles, anything unusual), say it needs a real set of eyes on it, call notify_team, and take their contact. Never guess a number for these — some of them are deliberately manual-quote.",
        "WHOLESALE/VENDOR: someone pitching to SELL us a lot, or asking to buy FROM us, goes straight to notify_team with their details. No quote.",
        "CONDITION HONESTY: every quote is what we pay if the device matches what they described, confirmed at inspection. Say that naturally once, when you first give a number — not as a legal disclaimer and not on every message. Never say 'no obligation' or 'no hidden fees'; it reads like a scam.",

        "TOOL USE IS INVISIBLE. Never mention tool names, never write stage directions like *checking*, never say you're 'looking it up' or 'running that'. Just answer.",
        "YOU CAN RELAY MESSAGES TO THE TEAM. If someone wants a human, asks something you can't fully answer, or wants a callback, NEVER say you can't help. Ask for their name and best phone number or email, call notify_team, and confirm plainly that our team will text them back.",
        "GOAL: get them a real number, or get their device details plus a phone/email so we can text them an offer. Don't pressure, and never require info to keep chatting.",
      ].join(" ");

  // Try Anthropic first, fall back to smart replies
  try {
    const Anthropic = (await import("@anthropic-ai/sdk")).default;
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    // Structural types — this codebase keeps the SDK as a dynamic import and
    // never pulls in its type namespace, so the conversation is typed locally
    // and cast at the call site (same pattern as the tools array).
    type Msg = { role: "user" | "assistant"; content: unknown };
    const messages: Msg[] = history.map((m) => ({
      role: m.from === "user" ? "user" as const : "assistant" as const,
      content: m.text,
    }));
    messages.push({ role: "user", content: message });

    // Server-side backstop for the multi-device routing rule. The prompt tells
    // the model to hand 2+ device lots to Sonny rather than closing them, but
    // the rule must not depend on the model choosing to comply — so we detect
    // the lot ourselves and re-state the constraint as a system instruction.
    const isLot = looksBulk(userText);

    // One cache breakpoint on the system block caches tools+system together
    // (render order is tools → system), so the tool round-trip re-reads the
    // prefix from cache seconds later instead of re-paying for it.
    const system = [
      {
        type: "text" as const,
        text: systemPrompt + (isLot ? "\n\nTHIS CONVERSATION IS A MULTI-DEVICE LOT. Quote each device individually and give a running total, then hand off to our team via notify_team. Do NOT close, do NOT name a package price." : ""),
        cache_control: { type: "ephemeral" as const },
      },
    ];

    let reply = "";
    let quotedAny = false;
    const quotedLines: string[] = [];

    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      const response = await client.messages.create({
        model: CHAT_MODEL,
        max_tokens: 400,
        system,
        tools: SELL_TOOLS as never,
        messages: messages as never,
        ...THINKING_OFF,
      });

      const textParts = response.content.filter((b) => b.type === "text");
      if (textParts.length) reply = textParts.map((b) => (b as { text: string }).text).join(" ").trim();

      const toolUses = response.content.filter((b) => b.type === "tool_use") as Array<{
        type: "tool_use"; id: string; name: string; input: Record<string, unknown>;
      }>;
      if (!toolUses.length) break;

      messages.push({ role: "assistant", content: response.content });
      const results: Array<{ type: "tool_result"; tool_use_id: string; content: string }> = [];

      for (const tu of toolUses) {
        let out: unknown;
        if (tu.name === "get_quote") {
          const q = await runQuote(tu.input);
          if (q.ok && q.offer != null) {
            quotedAny = true;
            quotedLines.push(`${q.device}${tu.input.storage ? ` ${tu.input.storage}` : ""} ${tu.input.condition || ""} — $${q.offer}`);
          }
          out = q;
        } else if (tu.name === "check_imei") {
          out = await runImeiCheck(tu.input as { imei?: string });
        } else if (tu.name === "notify_team") {
          // The site chat's owner alert rides the SAME MC comms + owner-SMS
          // path the rest of this route uses, so a chat handoff shows up
          // exactly where every other TCC lead does.
          const summary = String(tu.input.summary || "").slice(0, 900);
          const toolContact = String(tu.input.contact || contact || "").slice(0, 120);
          after(async () => {
            try {
              await fetch(`${MC_API}/api/comms`, {
                method: "POST",
                headers: { "x-api-key": MC_KEY, "Content-Type": "application/json" },
                body: JSON.stringify({
                  from: "topcash-web",
                  fromName: "Top Cash Cellular Chat",
                  role: "system",
                  body: `[CHAT HANDOFF]${sessionId ? ` sess:${sessionId} ·` : ""} ${sanitizeForMc(summary)}${toolContact ? `\nreply to: ${sanitizeForMc(toolContact)}` : ""}${quotedLines.length ? `\nengine: ${quotedLines.join(" | ")}` : ""}`,
                  tags: ["chat-lead", "chat-handoff", "needs-callback", ...(isLot ? ["multi-device"] : []), ...(sessionId ? [`sess-${sessionId}`] : [])],
                  priority: "high",
                }),
              });
            } catch { /* silent */ }
            await notifyOwnerSms(
              `${isLot ? "📦" : "💬"} TopCash chat${isLot ? " LOT" : ""}: ${summary.slice(0, 220)}${toolContact ? `\nReply to: ${toolContact}` : ""}${quotedLines.length ? `\nEngine: ${quotedLines.join(" | ")}` : ""}`,
            );
          });
          out = { ok: true, note: "team notified" };
        } else {
          out = { ok: false, reason: "unknown tool" };
        }
        results.push({ type: "tool_result", tool_use_id: tu.id, content: JSON.stringify(out) });
      }
      messages.push({ role: "user", content: results });
    }

    if (!reply) reply = fallbackReply(message, isHumanHandoff, history.length);
    return NextResponse.json({ reply, ...(quotedAny ? { quoted: quotedLines } : {}) });
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
