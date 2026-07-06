// TCC Messenger AI — a natural-language layer OVER the same brain the button
// funnel uses. When someone TYPES in Messenger (vs. tapping the funnel buttons),
// ManyChat forwards the message here; Claude answers conversationally and uses
// the REAL quote engine as a tool (never invents a price). It hands structured
// closes (lock it in / talk to team / bulk) back to /api/msgr so the deterministic
// funnel logic — meetup+cash, owner SMS, Spanish handoffs — is reused, not rebuilt.
//
//   POST /api/msgr-ai   header X-Bot-Secret OR ?s=<MSGR_BOT_SECRET>
//   body: { text: string, history?: {role|from, text}[], lang?: "en"|"es" }
//
// Renders ManyChat Dynamic Block v2 (same shape as /api/msgr).

import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { createHmac } from "crypto";
import { put, list, del } from "@vercel/blob";
import { type ConvoState } from "../../lib/msgr-brain";
import { quoteDevice, type QuoteSpec } from "../../lib/quote";
import { PRICE_TABLE } from "../../data/prices";
import { notifyOwnerSms } from "../../lib/owner-sms";

export const dynamic = "force-dynamic";

function authed(req: NextRequest): boolean {
  const expected = process.env.MSGR_BOT_SECRET;
  if (!expected) return false;
  const header = req.headers.get("x-bot-secret")?.trim();
  const qp = req.nextUrl.searchParams.get("s")?.trim();
  return header === expected || qp === expected;
}

// Turn a spoken model name ("iPhone 13 Pro Max", "galaxy s22 ultra", "pixel 8")
// into a REAL price-table slug — by CONSTRUCTING the slug from the name and only
// accepting it if it actually exists in PRICE_TABLE. This means we never quote a
// wrong device: an unknown/miscombined model just returns null → team handoff.
// Covers the whole phone catalog (iPhone 11-17, Galaxy S20-26 + Z Flip/Fold, Pixel 5-10).
const have = (slug: string): boolean => !!PRICE_TABLE[slug];

function nameToSlug(raw: string): { slug: string; label: string } | null {
  const n = " " + raw.toLowerCase().replace(/[^a-z0-9+ ]/g, " ").replace(/\s+/g, " ") + " ";
  const pro = /\bpro\b/.test(n);
  const max = /pro\s*max|\bmax\b/.test(n);
  const plus = /\bplus\b|\+/.test(n);
  const ultra = /\bultra\b/.test(n);
  const fe = /\bfe\b/.test(n);
  const mini = /\bmini\b/.test(n);
  const air = /\bair\b/.test(n);
  const xl = /\bxl\b/.test(n);
  const fold = /\bfold\b/.test(n);
  const aser = /\d+\s*a\b|\b\d+a\b/.test(n);

  // iPhone
  let m = n.match(/i\s*phone\s*(\d{1,2})/) || (/iphone/.test(n) ? n.match(/\b(\d{1,2})\b/) : null);
  if (m) {
    const g = m[1];
    const v = max ? "pm" : pro ? "p" : plus ? "plus" : mini ? "mini" : air ? "air" : /\b\d+\s*e\b|\be\b/.test(n) ? "e" : "";
    if (have("ip" + g + v)) return { slug: "ip" + g + v, label: slugToDisplay("ip" + g + v) };
  }
  // Samsung Galaxy
  if (/galaxy|samsung/.test(n)) {
    let g2 = n.match(/z\s*flip\s*(\d+)/);
    if (g2 && have("gzflip" + g2[1])) return { slug: "gzflip" + g2[1], label: slugToDisplay("gzflip" + g2[1]) };
    g2 = n.match(/z\s*fold\s*(\d+)/);
    if (g2 && have("gzfold" + g2[1])) return { slug: "gzfold" + g2[1], label: slugToDisplay("gzfold" + g2[1]) };
    g2 = n.match(/s\s*(\d{2})/);
    if (g2) {
      const v = ultra ? "u" : plus ? "p" : fe ? "fe" : "";
      if (have("gs" + g2[1] + v)) return { slug: "gs" + g2[1] + v, label: slugToDisplay("gs" + g2[1] + v) };
    }
    // Word-order tolerance: "Samsung Ultra 26" / "galaxy 26 ultra" — people put
    // the variant before the number and skip the S. A real lead typed exactly
    // this on 2026-07-05 and got no quote. Two-digit bound keeps it in the
    // S20-S26 range; have() gates it to real catalog rows either way.
    g2 = n.match(/\b(2\d)\b/);
    if (g2) {
      const v = ultra ? "u" : plus ? "p" : fe ? "fe" : "";
      if (have("gs" + g2[1] + v)) return { slug: "gs" + g2[1] + v, label: slugToDisplay("gs" + g2[1] + v) };
    }
  }
  // Google Pixel
  m = n.match(/pixel\s*(\d+)/);
  if (m) {
    const g = m[1];
    const v = pro && xl ? "pxl" : pro && fold ? "pfold" : pro ? "p" : aser ? "a" : "";
    if (have("px" + g + v)) return { slug: "px" + g + v, label: slugToDisplay("px" + g + v) };
  }
  return null;
}

// Slug → clean display name for the quote text (we control this, so it's accurate).
function slugToDisplay(slug: string): string {
  let m;
  if ((m = slug.match(/^ip(\d+)(pm|p|plus|mini|e|air)?$/))) {
    const v: Record<string, string> = { pm: " Pro Max", p: " Pro", plus: " Plus", mini: " mini", air: " Air" };
    return m[2] === "e" ? `iPhone ${m[1]}e` : `iPhone ${m[1]}${v[m[2] || ""] || ""}`;
  }
  if ((m = slug.match(/^gs(\d+)(u|p|fe)?$/))) {
    const v: Record<string, string> = { u: " Ultra", p: "+", fe: " FE" };
    return `Galaxy S${m[1]}${v[m[2] || ""] || ""}`;
  }
  if ((m = slug.match(/^gzflip(\d+)$/))) return `Galaxy Z Flip ${m[1]}`;
  if ((m = slug.match(/^gzfold(\d+)$/))) return `Galaxy Z Fold ${m[1]}`;
  if ((m = slug.match(/^px(\d+)(pxl|pfold|p|a)?$/))) {
    const v: Record<string, string> = { pxl: " Pro XL", pfold: " Pro Fold", p: " Pro" };
    return m[2] === "a" ? `Pixel ${m[1]}a` : `Pixel ${m[1]}${v[m[2] || ""] || ""}`;
  }
  return slug;
}

type QuoteToolInput = { model?: string; storage?: string; condition?: string; carrier?: string };

// Run the get_quote tool through the real engine — identical to the funnel's path.
async function runQuote(input: QuoteToolInput): Promise<{ ok: boolean; offer?: number; device?: string; slug?: string; reason?: string }> {
  const hit = nameToSlug(input.model || "");
  if (!hit) return { ok: false, reason: "not in the instant catalog — needs a manual quote from the team" };
  const spec: QuoteSpec = {
    modelId: hit.slug,
    modelLabel: hit.label,
    storage: input.storage,
    condition: (input.condition || "good").toLowerCase(),
    carrier: (input.carrier || "unlocked").toLowerCase(),
    isPhone: true,
  };
  const r = await quoteDevice(spec).catch(() => null);
  if (!r || r.offer == null || r.manualReview) {
    return { ok: false, device: hit.label, slug: hit.slug, reason: r?.reason || "no auto-offer; team will quote it" };
  }
  return { ok: true, offer: r.offer, device: hit.label, slug: hit.slug };
}

// ---- IMEI lookup (same Sickw plumbing as /api/imei/check) -------------------
// Lets the AI identify a device when the customer doesn't know their model or
// storage: they dial *#06#, text the 15 digits, and Sickw's Apple/GSMA basic
// info (~$0.05/lookup) returns the model (often with storage) plus Find My and
// blacklist signals. Luhn runs first so typos never reach the paid API.
function luhnValid(num: string): boolean {
  const digits = num.replace(/\D/g, "");
  if (digits.length !== 15) return false;
  let sum = 0;
  for (let i = 0; i < 15; i++) {
    let d = parseInt(digits[i], 10);
    if (i % 2 === 1) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
  }
  return sum % 10 === 0;
}
async function runImeiCheck(input: { imei?: string }): Promise<Record<string, unknown>> {
  const clean = String(input.imei || "").replace(/\D/g, "");
  if (clean.length !== 15 || !luhnValid(clean)) {
    return { ok: false, reason: "not a valid 15-digit IMEI — have them dial *#06# and re-send it" };
  }
  const key = process.env.SICKW_API_KEY || "";
  if (!key) return { ok: false, reason: "lookup unavailable — take the IMEI and notify_team" };
  try {
    const r = await fetch(`https://sickw.com/api.php?format=json&key=${key}&imei=${clean}&service=0`, { cache: "no-store" });
    const data = await r.json();
    if (data.status !== "success" || !data.result) {
      return { ok: false, reason: "lookup failed — take the IMEI and notify_team" };
    }
    const text = String(data.result);
    const get = (label: string) => text.match(new RegExp(`${label}:\\s*([^\\r\\n<]+)`, "i"))?.[1]?.trim() || null;
    const model = get("Model") || get("Model Description");
    const fmiRaw = get("Find My iPhone") || get("FMI Status") || get("iCloud Lock") || get("iCloud Status");
    const blacklistRaw = get("Blacklist Status") || get("Blacklist") || get("GSMA Blacklist");
    const findMyOn = !!fmiRaw && /on|locked|active/i.test(fmiRaw);
    const blacklisted = !!blacklistRaw && /black|locked|reported|stolen/i.test(blacklistRaw);
    // Flags go to the OWNER only — the bot makes no buy/pass decisions and never
    // mentions locks or blacklists to the customer. Sonny decides.
    if (blacklisted || findMyOn) {
      const flags = [blacklisted ? "BLACKLISTED" : "", findMyOn ? "Find My ON" : ""].filter(Boolean).join(" + ");
      after(() => notifyOwnerSms(`⚠️ TCC IMEI flag: ${model || "unknown model"} (${clean}) — ${flags}. Bot is quoting normally; your call.`));
    }
    // The model only learns WHAT the device is.
    return { ok: true, model };
  } catch {
    return { ok: false, reason: "lookup failed — take the IMEI and notify_team" };
  }
}

// Server-side lead intelligence: catch contact info + hot-buying signals in the raw
// message even when the model doesn't call notify_team — so no lead ever slips past
// the owner, and the truly-ready ones get flagged HOT for a fast follow-up.
function detectSignals(text: string): { contact: string; hot: boolean; intent: boolean; imei: string } {
  // IMEI first — a bare 15-digit number is an IMEI, not a phone number.
  const imei = text.match(/\b\d{15}\b/)?.[0] || "";
  const scrubbed = imei ? text.replace(imei, " ") : text;
  const phone = scrubbed.match(/(?:\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}\b/)?.[0]?.trim();
  const email = scrubbed.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i)?.[0];
  const contact = phone || email || "";
  // Bulk / multi-device = big money and the easiest lead to fumble — a real
  // one ("two Samsung ultra 26 ... two iPhones 17") slipped past every regex
  // on 2026-07-05. Quantity words + a device noun, or bulk vocabulary.
  const bulk =
    /\b(?:two|three|four|five|six|\d{1,2})\s+(?:iphones?|samsungs?|galaxys?|pixels?|phones?|devices?|macbooks?|laptops?|ipads?|tablets?|consoles?)\b/i.test(text) ||
    /\b(?:bulk|wholesale|a lot of (?:phones|devices)|several (?:phones|devices))\b/i.test(text);
  // Signals are bilingual — the bot sells in Spanish, so the alert triggers
  // must too (a 2026-07-05 ES lead fired nothing: every regex was English).
  const hot =
    bulk ||
    /\b(today|tonight|asap|right now|need\s+(the\s+)?cash|how soon|urgent|this (morning|afternoon|evening)|meet ?up|can we meet|cash today|where.*(meet|located|you at))\b/i.test(text) ||
    /\b(hoy mismo|ahorita|ya mismo|urgente|necesito (dinero|efectivo|cash)|nos vemos|d[oó]nde (est[aá]n|te veo|los encuentro)|puedo ir hoy)\b/i.test(text);
  const intent =
    /\b(i'?ll take it|let'?s do it|sounds good|it'?s a deal|i'?m in|where do (we|i)|come get it|book it|set it up|when can (we|you)|ready to sell|wanna sell|want to sell it|do it|tell me how much|how much (?:can|do|will|would)?\s*(?:you|u)?\s*(?:offer|give|pay))\b/i.test(text) ||
    /\b(quiero vender|vendo (mi|un|una|el|la)|lo vendo|cu[aá]nto me (das|dan|pagas|pagan|ofreces|ofrecen)|trato hecho|me interesa vender|lo tomo|acepto|de acuerdo)\b/i.test(text);
  return { contact, hot, intent, imei };
}

const SYSTEM = (lang: string) =>
  [
    "You're the guy who buys the phones at Top Cash Cellular, texting leads back on Messenger. TALK EXACTLY LIKE THE OWNER TEXTS. His typography: first letter capitalized, NO ending period, no exclamation marks, barely any commas ('Which one' / 'What area' / 'Would meet north' / 'Yes are you in Austin area'). Say 'I', not 'we' ('I can do 650', 'I can come to you'). Short, direct, warm — almost every reply is ONE line, usually under 12 words. NEVER sound like a bot or an ad: no 'Great question', no 'Perfect!', no feature lists, and NEVER volunteer the 'no fees / no obligation / safe public spot / free shipping' spiel — that reads like a scam and kills leads. Skip emojis mostly (one occasionally is fine).",
    "REAL EXCHANGES FROM THE OWNER — mimic these exactly (tone, length, capitalization): seller: 'Hi, is this available?' → 'Yes, are you still interested?' · seller lists two phones → 'Which one' · vague what-do-you-buy → 'Anything iPads game console etc' · specs unclear → 'Sealed or open box?' / 'You selling multiple?' · making an offer → 'I can do 740 but if it's open it would be 700' · deal forming → 'Are you in Austin area? I can pick up tomorrow or Monday' · not local → 'What area' · setting the spot → 'Would meet north' / 'Give me a location and I can map it'.",
    "LOCATION — NEVER volunteer where we're located. Don't say 'we're local in Austin' unless they ASK where you are or a meetup is actually being set up. When it IS relevant: 'Austin area — I'm out meeting people today, if you can come to me we can get it done today' (if they can't: 'no worries, what area are you in'). Someone asking a price does not need a geography lesson.",
    "FORMATTING — CRITICAL: This is Facebook Messenger. Write PLAIN TEXT only. NO markdown whatsoever: no ** or __ for bold, no # headers, no bullet characters (- or *), no backticks, no brackets around words. Messenger shows all of that as literal ugly characters. Plain sentences, line breaks, and emojis only.",
    "SIMPLE REPLIES — HARD RULE: ONE short message, UNDER 12 WORDS whenever possible, never more than one sentence plus a question. The gold standard is literally: 'hey whats the storage + condition?'. ONE question max. NEVER a numbered list (no 1) 2) 3)), never a paragraph. People skim on their phone — anything long doesn't get read. If your draft is over 15 words, cut it down before sending.",
    "IF THEY'RE UNSURE what model/storage they have: don't interrogate — say 'easiest way: dial *#06# and text me the number that pops up, just to confirm'. ONLY when a message actually contains a 15-digit number, call check_imei: it confirms the exact model (often storage too) — then just confirm condition and quote as normal. If the lookup fails, casually ask for the model from Settings > General > About instead (one short line). check_imei is ONLY for confirming what the device is; you make NO buy/pass decisions off it and NEVER mention locks or blacklists — the owner sees the details and makes every call. If they only have an Apple serial, take it and call notify_team — team decodes it.",
    "NEVER NARRATE YOURSELF: no 'let me check', no mentioning tools/lookups/systems, no correcting your own process ('jumped the gun'), no meta-comments — every reply is just a normal human text to the customer.",
    lang === "es"
      ? "The user is writing in Spanish — reply ENTIRELY in natural Spanish."
      : "Reply in the user's language (if they write Spanish, answer in Spanish).",
    // ---- facts (mirror the button funnel exactly) ----
    "HOW IT WORKS (only if they ASK — answer in UNDER 12 words, like: 'you tell me what you got, i pay cash when we meet 👍'): do NOT explain the whole process or mention shipping unless they say they're out of town (then: 'no worries, we ship free — topcashcellular.com'). No walk-in store, never say 'come to the store'.",
    "WE BUY: iPhones (11+), Samsung Galaxy (S21+, Z Fold/Flip), Google Pixel, MacBooks, and consoles — ANY condition, even cracked (lower offer). Conditions: sealed (new in plastic), like-new, good, fair, broken.",
    "QUOTING — CRITICAL: NEVER make up or estimate a price. To quote, you MUST call the get_quote tool with the model, storage, condition, and carrier. Ask for whatever's missing FIRST (storage? condition? carrier? — unlocked usually pays most), then call the tool. If get_quote says the model isn't in the instant catalog (older/rare device, MacBook, bulk lot), DON'T guess — tell them a team member will price it by hand and call notify_team.",
    "BE EFFICIENT — NEVER REPEAT A QUESTION (the #1 thing that makes us look like a broken bot): read the WHOLE conversation above before replying, and combine everything still missing into ONE natural question (e.g. 'what storage + condition, and is it unlocked?') — never drip one question at a time and NEVER ask for something they already told you. If a spec is even implied (e.g. 'just got it from assurant' ≈ new/sealed), use it, don't re-ask. The instant you can tell model + storage + condition, call get_quote and give the number instead of asking anything more. If you genuinely don't have their answer yet, move the convo forward — don't echo the same line back.",
    "AFTER A QUOTE: give the number the way the owner does — 'i can do 650 cash' — then a soft close like 'let me know' or 'wanna meet up this week?'. When someone wants to proceed, wants a human, gives a phone/email, or has a bulk lot / manual device, call notify_team so a real teammate follows up.",
    "NEVER RE-QUOTE: once you've given a price in this conversation, do NOT repeat it or call get_quote again for the same device unless they ask for the number or change the specs. While they're deciding, just answer what they asked or line up the meetup — repeating the price reads pushy and bot-like.",
    "GRAB THE CLOSE: the moment someone sounds ready ('let's do it', 'where do we meet', gives a number), close like the owner does — qualify the area ('Are you in the Austin area?'), then MEET-ME FIRST (see below), and call notify_team. Don't leave a hot lead hanging.",
    "MEETUPS — HINT THEM TOWARD COMING TO YOU, NEVER FORCE IT: the owner meets a lot of sellers every day, and deals close fastest when they come to him. When the meetup comes up, drop the hint the way he does — his own words: 'I can meet you but I have a lot of people I'm meeting today — if you can come to me it would be best, we can get it done today'. Frame it as THEIR win (get paid today, no waiting on a route slot). It's a hint, said ONCE: if they hesitate, can't travel, or just don't bite, drop it instantly and go 'No worries, what area are you in? I can swing by'. Never make it a condition — a done deal beats a perfect route.",
    "MULTIPLE DEVICES / BULK — BIG MONEY, NEVER LET IT SLIP: the moment someone mentions 2+ devices (or sealed/new-in-box units in any quantity), call notify_team RIGHT AWAY with the full list as the summary — do NOT wait for specs or a quote first, the owner wants every bulk lead on his phone instantly. Then keep the convo normal: work the instant-catalog phone first (ask its specs, quote it), note the rest for the manual quote — one thing at a time so it's not overwhelming. Never price a whole lot yourself.",
    "PRICE PUSHBACK — REAL REBUTTALS IN THE OWNER'S VOICE (each said ONCE, never beg, NEVER raise the number yourself): 'that's way too low' → 'I get it might not seem high but it's right under what these actually resell for — you could get more selling it yourself but you'd be waiting weeks, I pay cash same day'. 'can you add 100/200' → 'I would love to but I only make like 40 to 70 a device after I resell it, and I have to wait for it to sell'. someone else offered more → never badmouth: 'If they can really do that take it — most of those quotes drop when they see the phone. My number is what I actually hand you'. carrier/trade-in pays more → 'trade-in is store credit spread out over months, this is cash in your hand today'. The honest frame behind all of these: margins are thin (40-70 a device), money is fronted, resale takes time — we pay for it with speed and convenience. If they keep pushing after two rebuttals or a real deal is dying over the gap, say 'let me see if there's any room, one sec' and call notify_team — the owner decides exceptions, you never do.",
    "OFF-TOPIC / WEIRD QUESTIONS: you're a busy guy who buys phones, not a chatbot assistant. Unrelated stuff (news, jokes, homework, 'write me a poem', random links) gets ONE short dry line max — 'lol i just buy phones man. got one to sell?' — and nothing more. 'are you a bot?' → 'nah lol. you selling or what'. Never lecture, never explain yourself, never play along past one line.",
    "DON'T CHASE — HARD RULE: if you already asked what they're selling (or any question) and they keep coming back with nothing real — nonsense, one-word dodges, games — NEVER ask the same thing again and never re-open with another 'what do you have'. Say ONCE, firm but cool: 'Let me know when you're ready, I run a real business'. If they STILL send nothing real after that, reply with exactly [NO_REPLY] and nothing else — a real person just stops answering. [NO_REPLY] is also the right reply to obvious spam or trolling. Silence reads human; repeating yourself reads bot.",
    "AFTER A QUOTE OR GOOD ANSWER: just ask casually if they wanna meet up (e.g. 'wanna link up this week?'). Never push, never pitch, never list benefits. If they're in or drop a number, call notify_team.",
    "QUICK ANSWERS (keep them SHORT + casual, like texting): broken? → 'yeah i take broken, just less for it.' how long? → 'like 5 min, cash on the spot.' not sure on condition? → 'just tell me the screen/battery/any cracks, we sort it when we meet.' vs trade-in? → 'usually way more than trade-in, and real cash.' is it legit / a scam? → 'nah, look us up on google 👍'. where are you? → 'Austin area — I'm out meeting people today, if you can come to me we can get it done today'.",
    "CONDITION COACHING (stay honest): if someone underrates their own phone (says 'fair' or 'broken' for what sounds like minor wear), gently double-check — 'is the screen actually cracked, or just light scratches? Good condition pays more' — so they get their best HONEST number. NEVER coach anyone to misrepresent; we verify at the meetup anyway.",
    "LIGHT UPSELL: after a quote, it's fine to ask ONCE if they've got any other old phones, tablets, or laptops lying around — we buy those too. Don't nag.",
    "INSTANT-QUOTE CATALOG (get_quote can price these): iPhone 11 through 17 (all Pro / Pro Max / Plus / mini / e / Air variants), Samsung Galaxy S20 through S26 (incl. +, Ultra, FE) and Galaxy Z Flip / Z Fold (4-7), and Google Pixel 5 through 10 (incl. Pro, a-series, Pro XL, Pro Fold). Anything else — iPads, MacBooks, consoles, watches, or older/other phones — is NOT instant: don't guess, call notify_team for a manual quote.",
  ].join(" ");

const TOOLS = [
  {
    name: "get_quote",
    description: "Get the REAL cash offer for a phone from Top Cash Cellular's pricing engine. Call this for any price question — never guess a price yourself.",
    input_schema: {
      type: "object" as const,
      properties: {
        model: { type: "string", description: "Model as the customer said it, e.g. 'iPhone 14 Pro Max', 'Galaxy S24 Ultra', 'Pixel 9'." },
        storage: { type: "string", description: "Storage: 64, 128, 256, 512, or 1TB." },
        condition: { type: "string", enum: ["sealed", "mint", "good", "fair", "broken"], description: "sealed=new in plastic, mint=like new, good, fair=visible wear, broken=cracked/not working." },
        carrier: { type: "string", enum: ["unlocked", "att", "tmobile", "verizon", "other"] },
      },
      required: ["model", "condition"],
    },
  },
  {
    name: "notify_team",
    description: "Alert a real Top Cash Cellular teammate to follow up. Call when the customer wants to proceed/lock in, asks for a human, gives contact info, or has a device/bulk lot that needs a manual quote.",
    input_schema: {
      type: "object" as const,
      properties: {
        summary: { type: "string", description: "One line: device + what they want, e.g. 'iPhone 13, cracked, wants to sell — bulk of ~10'." },
        contact: { type: "string", description: "Phone or email if given, else empty." },
      },
      required: ["summary"],
    },
  },
  {
    name: "check_imei",
    description:
      "Confirm what a device is from its 15-digit IMEI (customer dials *#06#). Returns the exact model, often with storage. ONLY call when the customer's message actually contains a 15-digit number — never preemptively.",
    input_schema: {
      type: "object" as const,
      properties: {
        imei: { type: "string", description: "The 15-digit IMEI exactly as the customer sent it." },
      },
      required: ["imei"],
    },
  },
];

// ManyChat Dynamic Block v2 render — the AI's text plus optional quick replies
// that hand structured closes back to the deterministic /api/msgr funnel.
// The quoted-followup tag arms/disarms the ManyChat "Quote follow-up" automation
// (tag applied → smart delay → tag-still-there condition → nudge callback here).
// Every quote arms it; every other reply disarms it, so a customer who answered
// never gets nudged. Tag actions only go out on the ManyChat path (psid known).
const FOLLOWUP_TAG = "quoted-followup";
function render(
  texts: string[],
  quickReplies: { caption: string; state: ConvoState }[],
  origin: string,
  secret: string,
  ctx?: string,
  tagAction?: "arm" | "disarm",
) {
  const clip = (s: string) => (Array.from(s).length > 20 ? Array.from(s).slice(0, 20).join("") : s);
  const cb = `${origin}/api/msgr?s=${encodeURIComponent(secret)}`;
  const messages = texts.filter(Boolean).map((t) => ({ type: "text", text: t }));
  const content: Record<string, unknown> = { messages: messages.length ? messages : [{ type: "text", text: "…" }] };
  if (quickReplies.length) {
    content.quick_replies = quickReplies.map((qr) => ({
      type: "dynamic_block_callback",
      caption: clip(qr.caption),
      url: cb,
      method: "post",
      headers: { "X-Bot-Secret": secret },
      payload: { state: qr.state },
    }));
  }
  // ctx = compact base64 conversation memory. Returned two ways: top-level `ctx`
  // (consumed by the owned /api/messenger webhook) AND a ManyChat set_field_value
  // action that writes it to the `ai_ctx` user field (created 2026-07-05), so the
  // next Default-Reply hit carries the transcript back in. The action only fires
  // when the request round-tripped a ctx — a request without one means the caller
  // isn't wired for memory, and set_field_value on an unwired account would be noise.
  const actions: Record<string, unknown>[] = [];
  if (ctx) actions.push({ action: "set_field_value", field_name: "ai_ctx", value: ctx });
  if (tagAction) actions.push({ action: tagAction === "arm" ? "add_tag" : "remove_tag", tag_name: FOLLOWUP_TAG });
  if (actions.length) content.actions = actions;
  return NextResponse.json({ version: "v2", content, ...(ctx ? { ctx } : {}) });
}

type Turn = { role: "user" | "assistant"; content: string };
// Decode the base64 transcript ManyChat round-trips through the ai_ctx custom field.
function decodeCtx(s: unknown): Turn[] {
  if (typeof s !== "string" || !s.trim()) return [];
  // ManyChat's field chip can wrap the value in literal { } — strip them before decoding.
  const clean = s.trim().replace(/^\{([\s\S]*)\}$/, "$1").trim();
  if (!clean || clean === "ai_ctx") return [];
  try {
    const arr = JSON.parse(Buffer.from(clean, "base64").toString("utf8"));
    if (!Array.isArray(arr)) return [];
    return (arr as { r?: string; t?: string }[])
      .map((m) => ({ role: (m.r === "a" ? "assistant" : "user") as "user" | "assistant", content: String(m.t || "").slice(0, 500) }))
      .filter((m) => m.content)
      .slice(-8);
  } catch {
    return [];
  }
}
// Encode turns back to a compact base64 string (capped so the field + body JSON stay small).
function encodeCtx(turns: Turn[]): string {
  let compact = turns.slice(-8).map((m) => ({ r: m.role === "assistant" ? "a" : "u", t: m.content.slice(0, 400) }));
  let json = JSON.stringify(compact);
  while (json.length > 1400 && compact.length > 1) {
    compact = compact.slice(1);
    json = JSON.stringify(compact);
  }
  return Buffer.from(json, "utf8").toString("base64");
}

type AnyBlock = { type: string; text?: string; id?: string; name?: string; input?: unknown };

// ---- burst dedupe (ManyChat path) ------------------------------------------
// ManyChat's 30s reply delay means a burst of messages piles up N delayed
// dynamic-block calls — and every one of them carries the SAME {{Last Text
// Input}} (the newest message), so without a guard the customer gets N copies
// of the same answer. Keyed by {{Contact Id}} round-tripped as `psid`.
//
// IMPORTANT: markers are UNIQUE pathnames read back via list(). Overwriting one
// fixed blob pathname does NOT work here — Vercel Blob overwrites take up to
// ~60s to propagate through the CDN, so a re-read seconds later returns the
// stale copy (verified live: it made the bot drop legitimate replies).
// Marker name: msgr-mc/{psid}/{ts13}-{q|a}-{textHash}-{rand} (empty content).
//   q = request arrived/claimed   a = answered
function textHash(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(16).padStart(8, "0");
}
type Marker = { ts: number; kind: "q" | "a"; hash: string; rand: string };
function parseMarker(pathname: string): Marker | null {
  const m = pathname.match(/\/(\d{13})-(q|a)-([0-9a-f]{8})-([0-9a-z]+)$/);
  return m ? { ts: Number(m[1]), kind: m[2] as "q" | "a", hash: m[3], rand: m[4] } : null;
}
// ts comes from the caller — the SAME value it compares against later; stamping
// Date.now() here instead made every request see its own marker as newer.
async function putMarker(psid: string, kind: "q" | "a", hash: string, rand: string, ts: number) {
  try {
    await put(`msgr-mc/${psid}/${String(ts).padStart(13, "0")}-${kind}-${hash}-${rand}`, ".", {
      access: "public",
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: "text/plain",
    });
  } catch {
    /* best-effort */
  }
}
async function listMarkers(psid: string): Promise<{ mark: Marker; url: string }[]> {
  try {
    const { blobs } = await list({ prefix: `msgr-mc/${psid}/`, limit: 100 });
    return blobs
      .map((b) => ({ mark: parseMarker(b.pathname) as Marker, url: b.url }))
      .filter((x) => x.mark);
  } catch {
    return [];
  }
}
// Markers older than 10 min are noise — delete so list() stays small enough to
// always include the newest ones (ts-prefixed names sort OLDEST first).
async function sweepMarkers(entries: { mark: Marker; url: string }[]) {
  const old = entries.filter((e) => Date.now() - e.mark.ts > 600_000).map((e) => e.url);
  if (old.length) await del(old).catch(() => {});
}
const EMPTY = () => NextResponse.json({ version: "v2", content: { messages: [] } });

// ---- owner mute (ManyChat path) ---------------------------------------------
// The one reliable human-takeover signal for PUBLIC conversations: Sonny taps
// the mute link in his lead SMS and the bot goes silent for that contact.
// (ManyChat's own pause only engages for ManyChat-inbox replies; he usually
// replies from Business Suite, which ManyChat and the bot can't see — and the
// owned webhook's echo detection can't cover public convos until App Review.)
// Marker: msgr-mute/{contactId}/{ts13}-{hours} — newest wins, hours=0 unmutes.
function muteToken(psid: string): string {
  return createHmac("sha256", process.env.MSGR_BOT_SECRET || "").update(`mute:${psid}`).digest("hex").slice(0, 16);
}
async function setMute(psid: string, hours: number) {
  try {
    await put(`msgr-mute/${psid}/${String(Date.now()).padStart(13, "0")}-${hours}`, ".", {
      access: "public",
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: "text/plain",
    });
  } catch {
    /* best-effort */
  }
}
async function isMuted(psid: string): Promise<boolean> {
  try {
    const { blobs } = await list({ prefix: `msgr-mute/${psid}/`, limit: 100 });
    const marks = blobs
      .map((b) => b.pathname.match(/\/(\d{13})-(\d{1,3})$/))
      .filter(Boolean)
      .map((m) => ({ ts: Number((m as RegExpMatchArray)[1]), hours: Number((m as RegExpMatchArray)[2]) }));
    if (!marks.length) return false;
    const newest = marks.reduce((a, b) => (b.ts >= a.ts ? b : a));
    return Date.now() < newest.ts + newest.hours * 3_600_000;
  } catch {
    return false; // fail open — better an extra reply than a silent bot on infra errors
  }
}

// One mute email per conversation, guaranteed: a fixed marker records that the
// owner has been intro-alerted for this contact. Any convo without the marker
// alerts on its NEXT message regardless of content — this back-fills contacts
// whose first message predated the first-contact alert (or got lost). A fixed
// pathname is fine here: CDN staleness at worst duplicates one alert.
async function everAlerted(psid: string): Promise<boolean> {
  try {
    const { blobs } = await list({ prefix: `msgr-alerted/${psid}`, limit: 1 });
    return blobs.length > 0;
  } catch {
    return true; // infra error → assume alerted (avoid alert spam on flaky list())
  }
}
async function markAlerted(psid: string) {
  try {
    await put(`msgr-alerted/${psid}`, ".", { access: "public", addRandomSuffix: false, allowOverwrite: true, contentType: "text/plain" });
  } catch {
    /* best-effort */
  }
}

export async function POST(req: NextRequest) {
  if (!authed(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const secret = process.env.MSGR_BOT_SECRET as string;
  const origin = req.nextUrl.origin;

  // ManyChat's Default Reply dynamic block passes the typed message as a JSON body
  // ({"text":"{{Last Text Input}}"}); read it raw (spaces would break a URL query).
  const rawBody = await req.text().catch(() => "");
  let body: { text?: string; history?: unknown; lang?: string; ctx?: unknown; psid?: unknown } = {};
  try { body = JSON.parse(rawBody); } catch { /* not json */ }
  let text = (typeof body.text === "string" ? body.text : req.nextUrl.searchParams.get("text") || "").slice(0, 1500).trim();
  // ManyChat's field chip wraps the message in literal curly braces (e.g. "{hello}").
  // Strip a single enclosing { } so the AI (and the customer) never see raw brackets.
  text = text.replace(/^\{([\s\S]*)\}$/, "$1").trim();
  // {{Contact Id}} (numeric), chip-brace-stripped; anything non-numeric (unresolved
  // chip, literal field name) means "no id" and the burst dedupe simply stays off.
  const psidRaw = typeof body.psid === "string" ? body.psid.trim().replace(/^\{([\s\S]*)\}$/, "$1").trim() : "";
  const psid = /^\d{3,20}$/.test(psidRaw) ? psidRaw : "";

  // ---- follow-up nudge callback ---------------------------------------------
  // The "Quote follow-up" automation (tag applied → smart delay → tag-check)
  // calls back with {nudge:true, ctx, psid}. One short nudge in the convo's
  // language, appended to memory, and the tag is disarmed either way. No AI
  // call — deterministic, free, and it can't ramble.
  if ((body as { nudge?: unknown }).nudge === true || (body as { nudge?: unknown }).nudge === "true") {
    const turns = decodeCtx(body.ctx);
    const disarmOnly = {
      version: "v2",
      content: { messages: [], actions: [{ action: "remove_tag", tag_name: FOLLOWUP_TAG }] },
    };
    if (!turns.length) return NextResponse.json(disarmOnly); // no memory → don't nudge blind
    if (psid && (await isMuted(psid))) return NextResponse.json(disarmOnly); // owner took over — never nudge into his convo
    const hrN =
      Number(new Intl.DateTimeFormat("en-US", { timeZone: "America/Chicago", hour: "numeric", hour12: false }).format(new Date())) % 24;
    if (hrN < 8 || hrN >= 22) return NextResponse.json(disarmOnly); // no 2am nudges
    const esN = /[áéíóúñ¿¡]|\b(hola|cu[aá]nto|cuesta|vend[eo]|vender|tel[eé]fono|celular|precio|comprar|quiero|gracias|ofrec|me\s+das|por\s+mi|tienes|est[aá]\s)\b/i.test(
      turns.filter((t) => t.role === "user").map((t) => t.content).join(" "),
    );
    const nudgeText = esN ? "¿Sigues interesado? Ando haciendo recogidas hoy si puedes verme, efectivo en mano 💵" : "Still want that cash offer? I'm out doing pickups today if you can meet me 💵";
    const newCtxN = encodeCtx([...turns, { role: "assistant", content: nudgeText }]);
    return NextResponse.json({
      version: "v2",
      content: {
        messages: [{ type: "text", text: nudgeText }],
        actions: [
          { action: "remove_tag", tag_name: FOLLOWUP_TAG },
          { action: "set_field_value", field_name: "ai_ctx", value: newCtxN },
        ],
      },
    });
  }
  if (!text) {
    return render(["hey, tell me what you have and i'll get you a cash offer 👍"], [], origin, secret);
  }
  const rawHistory = Array.isArray(body.history) ? body.history : [];
  const history = rawHistory
    .slice(-10)
    .map((m) => {
      const o = (m || {}) as { role?: string; from?: string; text?: string };
      const role = o.role === "assistant" || o.from === "bot" || o.from === "assistant" ? "assistant" : "user";
      return o.text ? { role: role as "user" | "assistant", content: String(o.text).slice(0, 1000) } : null;
    })
    .filter(Boolean) as { role: "user" | "assistant"; content: string }[];

  // Conversation memory: prefer the base64 ctx round-tripped through the ai_ctx field.
  const ctxHistory = decodeCtx(body.ctx);
  const priorTurns: Turn[] = ctxHistory.length ? ctxHistory : history;

  // Spanish detection must catch accent-LESS typing (most people skip accents on a phone):
  // "cuanto", "telefono", "vendo", etc. — not just the accented forms. STICKY across the
  // conversation: mid-convo Spanish answers are often neutral ("128", "si", "esta bueno"),
  // so once any user turn reads Spanish the whole convo stays Spanish — otherwise the
  // quick-reply captions and fallback lines flip to English right in the middle of a chat.
  const esRe =
    /[áéíóúñ¿¡]|\b(hola|cu[aá]nto|cuesta|vend[eo]|vender|tel[eé]fono|celular|precio|comprar|quiero|gracias|ofrec|me\s+das|por\s+mi|tienes|est[aá]\s)\b/i;
  const userText = [text, ...priorTurns.filter((t) => t.role === "user").map((t) => t.content)].join(" \n ");
  const lang = body.lang === "es" || esRe.test(userText) ? "es" : "en";

  // ── Master on/off + business-hours schedule (server-side; runs 24/7 with the site) ──
  if (process.env.MSGR_AI_ENABLED === "0") {
    // Kill switch ON → bot stays silent; the lead still lands in the ManyChat inbox for a human.
    return NextResponse.json({ version: "v2", content: { messages: [] } });
  }
  const openH = Number(process.env.MSGR_AI_START ?? 0); // default 24/7 (set MSGR_AI_START/END to add hours later)
  const closeH = Number(process.env.MSGR_AI_END ?? 24); // default 24/7  (times are Austin/US-Central)
  const austinHr =
    Number(new Intl.DateTimeFormat("en-US", { timeZone: "America/Chicago", hour: "numeric", hour12: false }).format(new Date())) % 24;
  const openNow = openH >= closeH ? true : austinHr >= openH && austinHr < closeH; // start>=end ⇒ always on
  if (!openNow) {
    // After hours: one short holding line + ping the owner so no overnight lead is lost.
    after(() => notifyOwnerSms(`🌙 After-hours TCC lead: "${text.slice(0, 80)}" — follow up in ManyChat.`));
    return render(
      [
        lang === "es"
          ? "¡hola! ya cerramos por hoy 🌙 dime qué tienes y te paso precio a primera hora 👍"
          : "hey, we're closed for tonight 🌙 tell me what you have and i'll get you a number first thing 👍",
      ],
      [],
      origin,
      secret,
    );
  }

  // Burst dedupe: skip a text we just answered; claim the reply slot for this request.
  const myRand = crypto.randomUUID().slice(0, 8).replace(/-/g, "");
  const myHash = textHash(text);
  const myTs = Date.now();
  if (psid) {
    if (await isMuted(psid)) return EMPTY(); // owner is working this convo — stay silent
    const entries = await listMarkers(psid);
    if (entries.some(({ mark: m }) => m.kind === "a" && m.hash === myHash && myTs - m.ts < 90_000)) return EMPTY();
    await putMarker(psid, "q", myHash, myRand, myTs);
  }

  // ---- run Claude with the quote engine as a tool ----
  let replyText = "";
  let lastQuote: { offer: number; device: string; slug: string } | null = null;
  let teamNotified: { summary: string; contact?: string } | null = null;
  try {
    const Anthropic = (await import("@anthropic-ai/sdk")).default;
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const messages: { role: "user" | "assistant"; content: unknown }[] = [...priorTurns, { role: "user", content: text }];

    for (let round = 0; round < 4; round++) {
      const resp = await client.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 150,
        system: SYSTEM(lang),
        tools: TOOLS as never,
        messages: messages as never,
      });
      const blocks = resp.content as unknown as AnyBlock[];
      if (resp.stop_reason === "tool_use") {
        messages.push({ role: "assistant", content: resp.content });
        const results: unknown[] = [];
        for (const b of blocks) {
          if (b.type !== "tool_use") continue;
          if (b.name === "get_quote") {
            const q = await runQuote((b.input || {}) as QuoteToolInput);
            if (q.ok && q.offer != null) lastQuote = { offer: q.offer, device: q.device || "your device", slug: q.slug || "" };
            results.push({ type: "tool_result", tool_use_id: b.id, content: JSON.stringify(q) });
          } else if (b.name === "notify_team") {
            teamNotified = (b.input || {}) as { summary: string; contact?: string };
            results.push({ type: "tool_result", tool_use_id: b.id, content: JSON.stringify({ ok: true }) });
          } else if (b.name === "check_imei") {
            const chk = await runImeiCheck((b.input || {}) as { imei?: string });
            results.push({ type: "tool_result", tool_use_id: b.id, content: JSON.stringify(chk) });
          }
        }
        messages.push({ role: "user", content: results });
        continue;
      }
      replyText = blocks.filter((b) => b.type === "text").map((b) => b.text).join("\n").trim();
      break;
    }
  } catch {
    replyText = "";
  }
  if (!replyText) {
    // Rare: the model returned no text (API blip / tool-only turn). One plain
    // retry without tools — a real answer beats any canned line.
    try {
      const Anthropic = (await import("@anthropic-ai/sdk")).default;
      const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
      const retry = await client.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 150,
        system: SYSTEM(lang),
        messages: [...priorTurns, { role: "user", content: text }] as never,
      });
      replyText = (retry.content as unknown as AnyBlock[]).filter((b) => b.type === "text").map((b) => b.text).join("\n").trim();
    } catch {
      /* fall through to the canned lines */
    }
  }
  if (!replyText) {
    // Context-aware last resort: mid-conversation, re-asking specs they already
    // gave reads as a broken bot — a human "one sec" holds the thread instead.
    replyText = priorTurns.length
      ? (lang === "es" ? "un momento 👍" : "one sec 👍")
      : (lang === "es" ? "dime qué tienes y te doy una oferta en efectivo 💵" : "tell me what you have and i'll get you a cash offer 💵");
  }

  // The model can choose silence ([NO_REPLY]) for spam/trolls/dead threads —
  // a real person just stops answering instead of re-pitching. If the sentinel
  // leaked into an otherwise-real reply, strip it and send the reply.
  const strippedReply = replyText.replace(/\[NO_?REPLY\]/gi, "").trim();
  const noReply = !strippedReply && /\[NO_?REPLY\]/i.test(replyText);
  if (!noReply && strippedReply !== replyText) replyText = strippedReply || replyText;

  // Stale? A newer request claimed the slot while the AI was running — that newer
  // request answers (it carries the newest {{Last Text Input}}); this one goes silent.
  if (psid) {
    const entries = await listMarkers(psid);
    if (entries.some(({ mark: m }) => m.kind === "q" && (m.ts > myTs || (m.ts === myTs && m.rand !== myRand && m.rand > myRand)))) return EMPTY();
    await putMarker(psid, "a", myHash, myRand, Date.now());
    after(() => sweepMarkers(entries));
  }

  // ---- owner alerts + Spanish translation ------------------------------------
  // Owner SMS fires on ANY real lead signal (AI flagged a handoff, gave a quote,
  // contact info appeared, or hot-buying language). Spanish conversations ALSO
  // get every exchange translated to English and posted to Mission Control —
  // the owner doesn't read Spanish, so without this he can't follow or take
  // over an es convo. One shared after(): translate once, use it in both.
  const sig = detectSignals(text);
  const contact =
    (teamNotified?.contact && teamNotified.contact.replace(/\D/g, "").length >= 5 ? teamNotified.contact : "") || sig.contact;
  // First contact = the owner has never been intro-alerted for this contact
  // (marker-based when we know the psid; prior-turns heuristic otherwise).
  // Every NEW conversation alerts once (with the mute/takeover link) even with
  // zero lead signals — "I got a new client but didn't get the mute email"
  // must never happen again.
  const firstContact = psid ? !(await everAlerted(psid)) : priorTurns.length === 0;
  const alertNeeded = !!(teamNotified || lastQuote || contact || sig.hot || sig.intent || sig.imei || firstContact);
  if (alertNeeded || lang === "es") {
    const isHot = sig.hot || sig.intent || (!!lastQuote && (!!contact || !!teamNotified));
    const what =
      teamNotified?.summary ||
      (lastQuote ? `${lastQuote.device} → $${lastQuote.offer}` : firstContact ? "🆕 new conversation" : "active chat");
    // One-tap mute link: Sonny replies from Business Suite (which neither
    // ManyChat's pause nor the bot can see), so his takeover signal is this
    // link in the alert — tap it and the bot goes silent for this customer.
    const muteLink = psid ? ` 🤫 Take over (mutes bot 24h): https://topcashcellular.com/api/msgr-ai?mute=${psid}&t=${muteToken(psid)}` : "";
    const customerText = text;
    const botText = noReply ? "" : replyText;
    after(async () => {
      // ES → EN translation (one cheap call, reused for MC + the SMS quote).
      let enCust = "";
      let enBot = "";
      if (lang === "es") {
        try {
          const Anthropic = (await import("@anthropic-ai/sdk")).default;
          const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
          const t = await client.messages.create({
            model: "claude-haiku-4-5-20251001",
            max_tokens: 300,
            system:
              'Translate this Spanish Messenger exchange between a seller (CUSTOMER) and a phone buyer (BOT) into natural English. Output EXACTLY two lines and nothing else:\nCUSTOMER: <english>\nBOT: <english, or "(no reply)" if empty>',
            messages: [{ role: "user", content: `CUSTOMER: ${customerText}\nBOT: ${botText || "(no reply)"}` }],
          });
          const flat = (t.content as unknown as AnyBlock[]).filter((b) => b.type === "text").map((b) => b.text).join("\n");
          enCust = flat.match(/CUSTOMER:\s*([^\n]+)/i)?.[1]?.trim() || "";
          enBot = flat.match(/BOT:\s*([^\n]+)/i)?.[1]?.trim() || "";
        } catch {
          /* translation is best-effort — alerts still go out untranslated */
        }
        // Every Spanish exchange lands in Mission Control readable in English.
        const convoTag = psid ? ` #${psid.slice(-6)}` : "";
        await fetch("https://missioncontrolsdjg-production.up.railway.app/api/comms", {
          method: "POST",
          headers: { "x-api-key": process.env.MC_API_KEY || "", "Content-Type": "application/json" },
          body: JSON.stringify({
            from: "tcc-msgr-bot",
            fromName: "TCC Messenger Bot",
            role: "bot",
            tags: ["tcc-msgr-es"],
            body:
              `[ES convo${convoTag}] Customer: "${customerText.slice(0, 300)}"` +
              (enCust ? `\n→ EN: "${enCust.slice(0, 300)}"` : "") +
              `\nBot: ${botText ? `"${botText.slice(0, 300)}"` : "(stayed silent)"}` +
              (enBot && botText ? `\n→ EN: "${enBot.slice(0, 300)}"` : ""),
          }),
        }).catch(() => {});
      }
      if (alertNeeded) {
        const quoted = `"${customerText.slice(0, 55)}"${enCust ? ` (EN: "${enCust.slice(0, 70)}")` : ""}`;
        await notifyOwnerSms(
          `${isHot ? "🔥 HOT" : "💬"} TCC AI lead: ${what}${contact ? ` | 📞 ${contact}` : ""}${sig.imei ? ` | IMEI ${sig.imei}` : ""} | ${quoted}.${muteLink}`,
        );
        if (psid) await markAlerted(psid);
      }
    });
  }

  // Silent turn: no message, no quick replies — but memory still records what
  // they said (so a later real message picks the thread back up) and the
  // follow-up tag disarms (never nudge someone the bot chose to ignore).
  if (noReply) {
    const silentCtx = body.ctx !== undefined ? encodeCtx([...priorTurns, { role: "user", content: text }]) : undefined;
    const actions: Record<string, unknown>[] = [];
    if (silentCtx) actions.push({ action: "set_field_value", field_name: "ai_ctx", value: silentCtx });
    if (psid) actions.push({ action: "remove_tag", tag_name: FOLLOWUP_TAG });
    return NextResponse.json({
      version: "v2",
      content: { messages: [], ...(actions.length ? { actions } : {}) },
      ...(silentCtx ? { ctx: silentCtx } : {}),
    });
  }

  // ---- quick replies hand structured closes back to the deterministic funnel ----
  const es = lang === "es";
  const quickReplies: { caption: string; state: ConvoState }[] = [];
  if (lastQuote) {
    quickReplies.push({
      caption: es ? "🤝 Cerrar trato" : "🤝 Lock it in",
      state: { step: "lock", device_name: lastQuote.device, device_slug: lastQuote.slug, lang: es ? "es" : "en" },
    });
  }
  quickReplies.push({ caption: es ? "💬 Hablar con equipo" : "💬 Talk to our team", state: { step: "team", lang: es ? "es" : "en" } });
  quickReplies.push({ caption: es ? "📱 Menú de venta" : "📱 Sell menu", state: { step: "start", lang: es ? "es" : "en" } });

  // Updated memory: only echo it back once ManyChat is wired to round-trip it (request
  // carries a ctx field). Until then the response stays byte-for-byte the old format — no risk.
  const newCtx =
    body.ctx !== undefined
      ? encodeCtx([...priorTurns, { role: "user", content: text }, { role: "assistant", content: replyText }])
      : undefined;
  return render([replyText], quickReplies, origin, secret, newCtx, psid ? (lastQuote ? "arm" : "disarm") : undefined);
}

export async function GET(req: NextRequest) {
  // Owner mute link (from the lead SMS): ?mute=<contactId>&t=<hmac>[&h=hours]
  // h=24 default; h=0 unmutes. Token is an HMAC of the contact id, so the link
  // only works for that conversation and carries no secrets.
  const mutePsid = req.nextUrl.searchParams.get("mute");
  if (mutePsid && /^\d{3,20}$/.test(mutePsid)) {
    if (req.nextUrl.searchParams.get("t") !== muteToken(mutePsid)) {
      return new NextResponse("forbidden", { status: 403 });
    }
    const hours = Math.max(0, Math.min(168, Number(req.nextUrl.searchParams.get("h") ?? 24) || 0));
    await setMute(mutePsid, hours);
    const on = hours > 0;
    const toggle = `/api/msgr-ai?mute=${mutePsid}&t=${muteToken(mutePsid)}&h=${on ? 0 : 24}`;
    const html =
      `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>TCC bot</title></head>` +
      `<body style="margin:0;background:#13142b;color:#fff;font-family:-apple-system,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;text-align:center;">` +
      `<div style="padding:32px;"><div style="font-size:52px;">${on ? "🤫" : "🤖"}</div>` +
      `<h1 style="font-size:22px;margin:12px 0 6px;">${on ? `Bot muted for ${hours}h` : "Bot resumed"}</h1>` +
      `<p style="color:#a9adc4;font-size:14px;line-height:1.6;margin:0 0 20px;">${on ? "This conversation is all yours — the AI won't reply or nudge this customer." : "The AI will handle this customer's next message again."}</p>` +
      `<a href="${toggle}" style="display:inline-block;background:${on ? "#00c853" : "#ffb400"};color:#0a0a0a;font-weight:800;text-decoration:none;padding:12px 26px;border-radius:999px;font-size:14px;">${on ? "Hand back to the bot" : "Mute again (24h)"}</a></div></body></html>`;
    return new NextResponse(html, { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } });
  }

  return NextResponse.json({ ok: true, service: "tcc-msgr-ai", configured: !!process.env.MSGR_BOT_SECRET && !!process.env.ANTHROPIC_API_KEY });
}
