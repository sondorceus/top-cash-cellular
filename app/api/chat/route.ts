import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { notifyOwnerSms } from "../../lib/owner-sms";
import { clientIp, rateLimit } from "../../lib/rate-limit";
import { SELL_TOOLS, runQuote, runImeiCheck, looksBulk } from "../../lib/sell-tools";
import { appendChatMsg, readChat, validSession } from "../../lib/gochat-store";
import { sendCapiLead } from "../../lib/meta-capi";

const MC_API = "https://missioncontrolsdjg-production.up.railway.app";
const MC_KEY = process.env.MC_API_KEY || "";

// Conversation model. Sonnet-tier because the live rule-following failures
// (re-asking an answered spec, narrating tool use, parroting example lines)
// are ones Haiku keeps making despite HARD-RULE prompts — and this surface
// names real prices, so those failures cost
// money. Env-overridable for instant rollback.
const CHAT_MODEL = process.env.CHAT_AI_MODEL || "claude-sonnet-5";
// Sonnet 5 runs ADAPTIVE THINKING when `thinking` is omitted and would burn
// the whole token budget thinking. Disable explicitly; not sent for haiku,
// where omitting the param IS the off state.
const THINKING_OFF = /sonnet-5|opus-4-[678]/.test(CHAT_MODEL) ? { thinking: { type: "disabled" as const } } : {};
// Tool round-trips per turn. get_quote on several devices in one message is
// the realistic ceiling; 4 leaves room without letting a loop run away.
const MAX_TOOL_ROUNDS = 4;

// Photo messages: the /go upload route stores `IMG::<url>` in the thread and
// the client then posts the same string here so the model can SEE the device.
// The vision URL is validated against OUR EXACT blob store host — the store id
// is parsed from BLOB_READ_WRITE_TOKEN (`vercel_blob_rw_<storeId>_<secret>`),
// NOT a wildcard subdomain: the client supplies the whole history array, so a
// wildcard let an attacker point the model at an image in THEIR own Vercel
// Blob store. If the store id can't be parsed (token missing = uploads are
// broken anyway) no image passes — fail closed.
const BLOB_STORE_ID = (process.env.BLOB_READ_WRITE_TOKEN || "").match(/^vercel_blob_rw_([a-z0-9]+)_/i)?.[1]?.toLowerCase() || "";
const IMG_RE = BLOB_STORE_ID
  ? new RegExp(`^IMG::(https://${BLOB_STORE_ID}\\.public\\.blob\\.vercel-storage\\.com/gochat-img/[a-z0-9_\\-./]+)$`, "i")
  : null;
function imgUrl(t: string): string | null {
  if (!IMG_RE) return null;
  const m = t.match(IMG_RE);
  return m ? m[1] : null;
}
// Detection-safe text: a photo message is `IMG::<url>` whose blob path carries
// a 13-digit ms timestamp — detectContact's phone regex matched THAT as a
// "phone number", firing a junk lead and then permanently blocking the real
// contact from ever being captured (the URL sits in history as contactSeenBefore).
// Strip IMG:: turns to empty before any contact/device scraping.
function detectText(t: string): string {
  return t.startsWith("IMG::") ? "" : t;
}

function smartReply(message: string): string {
  const m = message.toLowerCase();
  if (m.match(/\b(?:\d+|few|couple|several|multiple|bunch)\s+(?:iphones?|phones?|devices?|galaxys?|samsungs?|pixels?)\b/)) return "nice — list what you've got (model, storage, condition for each) and drop your number. we'll text you a real offer for the lot.";
  if (m.match(/financ|payment plan|still owe|owe money|carrier lock|locked to|need cash/)) return "we buy financed and carrier-locked phones all the time — the offer just prices that in, and you get paid the same day. list what you've got (model, storage, condition) and drop your number, and we'll text you a real offer.";
  if (m.match(/price|worth|how much|value|quote|sell.*for/)) return "tell me the model, storage and condition and i'll get you a real number — takes about 30 seconds.";
  if (m.match(/iphone|apple/)) return "we buy iPhones — 11 and newer price instantly, older ones we quote by hand. which one have you got?";
  if (m.match(/samsung|galaxy|android/)) return "we buy Galaxy S20 and newer, plus the Z Fold and Z Flip. which one have you got?";
  if (m.match(/macbook|mac|laptop/)) return "we buy MacBooks — Air and Pro, M1 and newer. which one have you got?";
  if (m.match(/ps[45]|playstation|xbox|switch|console|game/)) return "we buy PS4, PS5, Xbox One, Xbox Series S/X and Switch. which one have you got?";
  if (m.match(/pay|cashapp|cash app|zelle|btc|bitcoin|cash|money/)) return "we pay cash, Cash App, Zelle or BTC — your pick. local austin handoffs get paid on the spot.";
  if (m.match(/broken|crack|damage|screen/)) return "we buy cracked and water-damaged too — the number is lower than a clean one, but we still buy it. just tell us what's wrong with it.";
  if (m.match(/how|work|process|step/)) return "three steps: you get a real number, we meet in the austin area or send you a free shipping label, then we check it and pay you. local handoffs run about 15 minutes.";
  if (m.match(/where|location|store|address|visit|come in|walk.?in|austin|meet|pickup/)) return "we're online-first — no walk-in store. we meet at a public spot in the austin area and pay on the spot, or we send a free prepaid label, whichever is easier.";
  if (m.match(/ship|mail|send/)) return "yes — we send a free prepaid FedEx label. pack it, drop it off, and we pay the same day we inspect it.";
  if (m.match(/human|person|talk|call.?back|text.*back|representative|agent|someone/)) return "sure — drop your name and the best number or email and our team will text you back.";
  if (m.match(/hi|hey|hello|sup|yo|what'?s up/)) return "welcome to top cash. what have you got to sell?";
  if (m.match(/thank|thanks|thx|appreciate/)) return "anytime. whenever you're ready, just tell us what you've got.";
  if (m.match(/bye|later|done|gtg/)) return "anytime. when you're ready, tell us what you've got or email support@topcashcellular.com.";
  return "i can help with pricing, how the buyback works, payment, or what we buy. try something like 'how much is my iPhone 15 Pro worth?'";
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

  const ip = clientIp(req);
  const message = rawMessage.slice(0, MAX_MESSAGE_LEN);
  // A photo turn. `msgImg` is the VALIDATED store URL (vision + label); it's
  // null for a forged/off-store IMG::. `isImgMsg` is the bare prefix: the
  // upload route already stored the real photo blob, and we must NEVER store
  // ANY client IMG:: here — a forged `IMG::https://evil/x.gif` that slipped
  // into the store would render as an external <img>/<a> beacon (or a
  // javascript: href) in the authenticated admin console. So the store guards
  // below key on isImgMsg, and a forged one collapses to a plain label.
  const msgImg = imgUrl(message);
  const isImgMsg = message.startsWith("IMG::");
  const displayMessage = msgImg ? `(sent a photo) ${msgImg}` : isImgMsg ? "(sent a photo)" : message;
  // Stable per-conversation id from the widget so all of one chat's leads
  // thread together in Mission Control instead of scattering into N comms.
  const sessionId = (typeof payload.sessionId === "string" ? payload.sessionId : "").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 24);
  // "human" mode = the visitor tapped "Talk to a human", so Theot runs the
  // warm concierge lead-capture flow and the lead is flagged for a real
  // teammate to follow up.
  const isHumanHandoff = payload.mode === "human";

  // Live-takeover gate — checked BEFORE the AI-path rate limit on purpose:
  // a takeover turn does no Anthropic/MC/SMS work, and dropping a seller's
  // message mid-negotiation with the owner is the one loss this feature
  // cannot afford. It has its own (generous) bucket instead.
  const live = validSession(sessionId) && rateLimit(`chat-gate:${ip}`, 80, 5 * 60_000).ok
    ? await readChat(sessionId, Date.now())
    : null;
  if (live?.takeover) {
    if (!isImgMsg) after(() => { void appendChatMsg(sessionId, "user", message); });
    return NextResponse.json({ takeover: true, reply: null });
  }

  // Throttle the AI path BEFORE any costly work (Anthropic tokens, an MC
  // post per message, an owner SMS). On a soft trip we return a friendly 200
  // so a fast-typing human isn't shown an error, but we skip all the
  // fan-out. ~25 msgs / 5 min is generous for real chat.
  if (!rateLimit(`chat:${ip}`, 25, 5 * 60_000).ok) {
    return NextResponse.json({ reply: "give me a few seconds to catch up, then send that again." });
  }

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
  // detectText() zeroes out IMG:: photo turns so a blob URL's timestamp can't
  // masquerade as a phone number (which fired junk leads AND blocked the real
  // contact forever after).
  const priorUserText = history.filter((m) => m.from === "user").map((m) => detectText(m.text)).join("  ");
  const userText = `${priorUserText}  ${detectText(message)}`;
  const contact = (fieldContact || detectContact(userText)).slice(0, 120);
  const deviceSummary = extractDevice(userText);

  // Decide whether THIS turn is worth a Mission Control post. Posting every
  // message buried real leads in chatter; instead we post only on material
  // turns — the opener, a human-handoff start, or the turn a contact first
  // appears — all threaded by sessionId so one chat reads as one lead.
  const contactSeenBefore = !!detectContact(priorUserText);
  const detectedNow = !!detectContact(detectText(message));
  const contactJustArrived = !contactSeenBefore && (detectedNow || (!!fieldContact && history.length === 0));
  // Park a just-arrived contact in the chat store so the takeover console's
  // "text seller" action can reach this seller. Note-role = internal only.
  if (contactJustArrived && contact && validSession(sessionId)) {
    after(() => { void appendChatMsg(sessionId, "note", `CONTACT: ${contact}`); });
  }
  // Server-side twin of the client's chat-lead pixel (same chatlead-<sid>
  // event id → Meta dedupes; if the in-app webview ate the browser event,
  // this copy still trains the campaign). Once per session by construction —
  // contactJustArrived only fires the turn a contact first appears.
  if (contactJustArrived && contact && sessionId) {
    const capiIp = ip;
    const capiUa = req.headers.get("user-agent");
    after(() => {
      void sendCapiLead({
        eventId: `chatlead-${sessionId}`,
        // /go sessions are "go-..."; anything else is the main-site widget.
        sourceUrl: sessionId.startsWith("go") ? "https://topcashcellular.com/go" : "https://topcashcellular.com/",
        ip: capiIp,
        userAgent: capiUa,
        contact,
        contentName: "chat",
      });
    });
  }
  const isOpener = history.length === 0;
  const handoffStarted = isHumanHandoff && history.length <= 1;
  const material = isOpener || handoffStarted || contactJustArrived;

  // Forward material leads to Mission Control
  let chatLeadId: string | null = null;
  if (material) {
    const sess = sessionId ? `sess:${sessionId} · ` : "";
    const body = contactJustArrived
      ? `[CHAT LEAD ✅] ${sess}${deviceSummary ? `${deviceSummary} · ` : ""}reply to: ${sanitizeForMc(contact)}\n"${sanitizeForMc(displayMessage)}"`
      : `${isHumanHandoff ? "[HUMAN HANDOFF] " : ""}[CHAT LEAD] ${sess}Visitor${contact ? ` (reply to: ${sanitizeForMc(contact)})` : ""}: "${sanitizeForMc(displayMessage)}"`;
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
      const snippet = sanitizeForMc(displayMessage).slice(0, 200);
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
    "We buy: iPhones (11+ price instantly, older ones we quote by hand), Samsung Galaxy S20+ (incl. Z Fold/Flip), MacBooks M1+, and game consoles (PS4/PS5, Xbox, Switch) — any condition, even cracked or water-damaged (lower offer). Payout: Cash, Cash App, Zelle, or BTC, the customer's choice. For an exact price, point them to the instant quote flow (~30 seconds).",
    "PHOTOS: the customer can attach photos of their device (camera button in the chat). When a photo arrives you can SEE it — acknowledge what's visible in one short plain line (cracks, screen damage, wear, or that it looks clean) and use it as the condition when you quote. If their damage description is vague, you may ask them to snap a quick photo. A photo never finalizes anything — condition is still confirmed at inspection, said once and naturally, never as a legal disclaimer.",
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
        "LANGUAGE: reply in the language the customer writes in — natural Spanish for Spanish, same plain register.",
        "Be honest: you are the team's assistant and a real person follows up — never claim to literally be a human, but never say you 'can't help' or 'can't pass a message' either.",
        "Collect, conversationally, only what's still missing, in this rough order: (1) what device they're selling (model + storage) and its condition; (2) their name; (3) the best phone number or email for the team to reach them. The moment you have a device AND a way to contact them, confirm by name: 'Thanks, {name} — I've passed this to our team and they'll text you a firm offer shortly,' then mention they can get an instant ballpark from the instant quote flow while they wait.",
        "Be straightforward, not salesy. State the facts (same-day pay, local-or-ship) only if relevant; don't pitch. Never pressure; if they decline to share info, stay helpful and still offer the quote tool.",
        ...FACTS,
      ].join(" ")
    : [
        "You are Theot, the assistant for Top Cash Cellular, a phone & device buyback service serving Austin, Houston and San Antonio, TX. Keep replies SHORT (2-3 sentences), plain, and helpful. Ask only ONE question at a time.",
        // VOICE: company register — 'we / our team', never the owner's first
        // person. The website is a business; only a DM would text like a
        // person. Sonny 2026-08-19.
        "Speak as the company: 'we' and 'our team', never 'I can do $X' as if you were the owner. Never name the owner to the customer.",
        "LANGUAGE: reply in the language the customer writes in. If they write Spanish, answer in natural Spanish (same plain, calm register — 'te pagamos hoy mismo' energy, not textbook formal). Numbers, device names and the get_quote flow work the same in any language.",
        TONE,
        ...FACTS,

        // ---- QUOTING POLICY (site chat) -------------------------------------
        // This surface DOES name numbers: the funnel already publishes the
        // exact same number to anyone who clicks through, so refusing to say
        // it here is theatre — it just makes the chat worse than the page it
        // sits on. Sonny 2026-08-19.
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
    // Photo turns become VISION content so the model can actually read the
    // device's condition. Only the LAST 3 photos ride as images (cost bound —
    // sellers send several angles); older ones collapse to a text stub so the
    // thread still shows a photo happened.
    const visionSlots = new Set<number>();
    {
      const idxs: number[] = [];
      history.forEach((m, i) => { if (m.from === "user" && imgUrl(m.text)) idxs.push(i); });
      if (msgImg) idxs.push(history.length);
      for (const i of idxs.slice(-3)) visionSlots.add(i);
    }
    const toContent = (i: number, from: string, text: string): unknown => {
      const u = from === "user" ? imgUrl(text) : null;
      if (!u) return text;
      if (!visionSlots.has(i)) return "(the seller sent a photo of the device earlier)";
      return [
        { type: "image", source: { type: "url", url: u } },
        { type: "text", text: "(photo of the seller's device — read the visible condition)" },
      ];
    };
    const messages: Msg[] = history.map((m, i) => ({
      role: m.from === "user" ? "user" as const : "assistant" as const,
      content: toContent(i, m.from, m.text),
    }));
    messages.push({ role: "user", content: toContent(history.length, "user", message) });

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
    // Highest engine offer this turn — used as the Lead event's value when a
    // chat lead completes, so the AI path reports real money to Meta instead
    // of a valueless conversion. Engine-sourced; never estimated.
    let leadValue: number | null = null;

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
            if (leadValue == null || q.offer > leadValue) leadValue = q.offer;
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
          // Owner SMS must be rate-gated exactly like the lead-path SMS: a
          // crafted device PHOTO is model-vision input, so an image telling the
          // model to "call notify_team repeatedly" could otherwise fire up to
          // MAX_TOOL_ROUNDS unthrottled texts per turn straight to Sonny's
          // phone. The MC comm (console, not a buzz) still always posts.
          const notifySmsOk = rateLimit(`chat-sms:${ip}`, 3, 15 * 60_000).ok
            && rateLimit("chat-sms:global", 20, 10 * 60_000).ok;
          after(async () => {
            try {
              await fetch(`${MC_API}/api/comms`, {
                method: "POST",
                headers: { "x-api-key": MC_KEY, "Content-Type": "application/json" },
                body: JSON.stringify({
                  from: "topcash-web",
                  fromName: "Top Cash Cellular Chat",
                  role: "system",
                  body: `[CHAT HANDOFF]${sessionId ? ` sess:${sessionId} ·` : ""} ${sanitizeForMc(summary)}${toolContact ? `\nreply to: ${sanitizeForMc(toolContact)}` : ""}${quotedLines.length ? `\nengine: ${quotedLines.join(" | ")}` : ""}${validSession(sessionId) ? `\ntake over: https://topcashcellular.com/admin/chats?session=${sessionId}` : ""}`,
                  tags: ["chat-lead", "chat-handoff", "needs-callback", ...(isLot ? ["multi-device"] : []), ...(sessionId ? [`sess-${sessionId}`] : [])],
                  priority: "high",
                }),
              });
            } catch { /* silent */ }
            if (notifySmsOk) await notifyOwnerSms(
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

    // Takeover race check: the gate ran before the tool loop, and the loop
    // takes seconds — exactly the window in which Sonny clicks "Take over"
    // from the [CHAT LIVE] ping. If the flag flipped while we were
    // generating, the AI reply is DISCARDED (never stored, never shown):
    // Sonny answers this message, not the bot — and never both.
    if (validSession(sessionId)) {
      const recheck = await readChat(sessionId, Date.now()).catch(() => null);
      if (recheck?.takeover) {
        if (!isImgMsg) after(() => { void appendChatMsg(sessionId, "user", message); });
        return NextResponse.json({ takeover: true, reply: null });
      }
    }

    // Persist the turn for the live console, and fire the ONE-per-session
    // "jump in now" ping the first time an engine quote lands in this chat —
    // a seller standing at a real number is the takeover moment. Gated by a
    // ctl marker (not the model's judgment) plus the global SMS backstop.
    if (validSession(sessionId)) {
      const finalReply = reply;
      const shouldPing = quotedAny && !live?.notified && rateLimit("chat-sms:global", 20, 10 * 60_000).ok;
      after(async () => {
        if (!isImgMsg) await appendChatMsg(sessionId, "user", message); // real photo turns are stored by the upload route; forged IMG:: are dropped
        await appendChatMsg(sessionId, "bot", finalReply);
        if (!shouldPing) return;
        await appendChatMsg(sessionId, "ctl", "notified");
        const link = `https://topcashcellular.com/admin/chats?session=${sessionId}`;
        try {
          await fetch(`${MC_API}/api/comms`, {
            method: "POST",
            headers: { "x-api-key": MC_KEY, "Content-Type": "application/json" },
            body: JSON.stringify({
              from: "topcash-web",
              fromName: "Top Cash Cellular Chat",
              role: "system",
              body: `[CHAT LIVE] sess:${sessionId} · quote on the table — ${sanitizeForMc(quotedLines.join(" | "))}${contact ? `\nreply to: ${sanitizeForMc(contact)}` : ""}\ntake over: ${link}`,
              tags: ["chat-lead", "live-takeover-ready", `sess-${sessionId}`],
              priority: "high",
            }),
          });
        } catch { /* silent */ }
        await notifyOwnerSms(`💬 LIVE TopCash chat — quote on the table: ${quotedLines.join(" | ").slice(0, 180)}${contact ? `\nReply to: ${contact}` : ""}\nTake over: ${link}`);
      });
    }
    // leadCaptured tells the client to fire the Meta Lead pixel. Without it,
    // the AI path (MacBook / iPad / Console / "something else" tiles and every
    // lot seller) produced real leads that the pixel never saw, so the
    // campaign optimized exclusively toward iPhone/Samsung carousel lockers.
    // Fires on the turn a contact FIRST appears, so it's once per session.
    return NextResponse.json({
      reply,
      ...(quotedAny ? { quoted: quotedLines } : {}),
      ...(contactJustArrived ? { leadCaptured: true, ...(leadValue != null ? { leadValue } : {}) } : {}),
    });
  } catch {
    const reply = fallbackReply(message, isHumanHandoff, history.length);
    if (validSession(sessionId)) {
      after(async () => {
        if (!isImgMsg) await appendChatMsg(sessionId, "user", message); // real photo turns are stored by the upload route; forged IMG:: are dropped
        await appendChatMsg(sessionId, "bot", reply);
      });
    }
    // Same signal on the fallback path — the lead still reached MC and Sonny's
    // phone, so Meta should still hear about it.
    return NextResponse.json({ reply, ...(contactJustArrived ? { leadCaptured: true } : {}) });
  }
}

// Picks the right canned reply when Anthropic is unavailable. On the first
// turn of a human handoff we open with the warm concierge greeting; after
// that we defer to the keyword matcher.
function fallbackReply(message: string, isHumanHandoff: boolean, historyLen: number): string {
  if (imgUrl(message)) {
    // AI unavailable on a photo turn — the photo is stored and surfaced to
    // the team either way, so say that plainly and keep the thread moving.
    return "got the photo — our team will take a look. what model is it, and how much storage?";
  }
  if (isHumanHandoff && historyLen <= 1) {
    return "This is Theot from the Top Cash team. I'll get this to a real person for you. To start — what device are you selling, and what condition is it in?";
  }
  return smartReply(message);
}
