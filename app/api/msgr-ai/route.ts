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
    return {
      ok: true,
      model,
      findMyOn: !!fmiRaw && /on|locked|active/i.test(fmiRaw),
      blacklisted: !!blacklistRaw && /black|locked|reported|stolen/i.test(blacklistRaw),
    };
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
  const hot =
    /\b(today|tonight|asap|right now|need\s+(the\s+)?cash|how soon|urgent|this (morning|afternoon|evening)|meet ?up|can we meet|cash today|where.*(meet|located|you at))\b/i.test(text);
  const intent =
    /\b(i'?ll take it|let'?s do it|sounds good|it'?s a deal|i'?m in|where do (we|i)|come get it|book it|set it up|when can (we|you)|ready to sell|wanna sell|want to sell it|do it)\b/i.test(text);
  return { contact, hot, intent, imei };
}

const SYSTEM = (lang: string) =>
  [
    "You're a real person who works at Top Cash Cellular — a LOCAL Austin phone/tablet/MacBook buyer — texting leads back on Messenger. TALK LIKE A REAL HUMAN TEXTING: short, casual, chill. Almost every reply is ONE line, usually under 12 words. Contractions always; lowercase is fine. NEVER sound like a bot or an ad: no 'Great question', no 'Perfect!', no 'Totally fair', no feature lists, and NEVER volunteer the 'no fees / no obligation / safe public spot / free shipping' spiel — that reads exactly like a scam and kills leads. Just be a normal guy who buys phones: quick, friendly, straight to the point. Skip emojis mostly (one occasionally is fine). To quote you still need storage + condition + carrier — ask casually in one line, e.g. 'what storage + condition? unlocked?'.",
    "FORMATTING — CRITICAL: This is Facebook Messenger. Write PLAIN TEXT only. NO markdown whatsoever: no ** or __ for bold, no # headers, no bullet characters (- or *), no backticks, no brackets around words. Messenger shows all of that as literal ugly characters. Plain sentences, line breaks, and emojis only.",
    "SIMPLE REPLIES — HARD RULE: ONE short message, UNDER 12 WORDS whenever possible, never more than one sentence plus a question. The gold standard is literally: 'hey whats the storage + condition?'. ONE question max. NEVER a numbered list (no 1) 2) 3)), never a paragraph. People skim on their phone — anything long doesn't get read. If your draft is over 15 words, cut it down before sending.",
    "IF THEY'RE UNSURE what model/storage they have: don't interrogate — say 'easiest way: dial *#06# and text me the number that pops up'. The moment they send a 15-digit number, call check_imei: it gives you the exact model (often storage too), so just confirm condition and quote. If check_imei says blacklisted → politely pass (we can't buy reported lost/stolen devices). If Find My/iCloud is ON → still quote, just add they'll need to turn it off before payout. If they only have an Apple serial (Settings > General > About), take it and call notify_team — team decodes it.",
    lang === "es"
      ? "The user is writing in Spanish — reply ENTIRELY in natural Spanish."
      : "Reply in the user's language (if they write Spanish, answer in Spanish).",
    // ---- facts (mirror the button funnel exactly) ----
    "HOW IT WORKS (only if they ASK — answer in UNDER 12 words, like: 'we're local in austin, quick meetup, cash on the spot 👍'): do NOT explain the whole process or mention shipping unless they say they're out of town (then: 'no worries, we ship free — topcashcellular.com'). No walk-in store, never say 'come to the store'.",
    "WE BUY: iPhones (11+), Samsung Galaxy (S21+, Z Fold/Flip), Google Pixel, MacBooks, and consoles — ANY condition, even cracked (lower offer). Conditions: sealed (new in plastic), like-new, good, fair, broken.",
    "QUOTING — CRITICAL: NEVER make up or estimate a price. To quote, you MUST call the get_quote tool with the model, storage, condition, and carrier. Ask for whatever's missing FIRST (storage? condition? carrier? — unlocked usually pays most), then call the tool. If get_quote says the model isn't in the instant catalog (older/rare device, MacBook, bulk lot), DON'T guess — tell them a team member will price it by hand and call notify_team.",
    "BE EFFICIENT — NEVER REPEAT A QUESTION (the #1 thing that makes us look like a broken bot): read the WHOLE conversation above before replying, and combine everything still missing into ONE natural question (e.g. 'what storage + condition, and is it unlocked?') — never drip one question at a time and NEVER ask for something they already told you. If a spec is even implied (e.g. 'just got it from assurant' ≈ new/sealed), use it, don't re-ask. The instant you can tell model + storage + condition, call get_quote and give the number instead of asking anything more. If you genuinely don't have their answer yet, move the convo forward — don't echo the same line back.",
    "AFTER A QUOTE: give the number plainly and invite them to lock it in for a local cash meetup. When someone wants to proceed, wants a human, gives a phone/email, or has a bulk lot / manual device, call notify_team so a real teammate follows up.",
    "NEVER RE-QUOTE: once you've given a price in this conversation, do NOT repeat it or call get_quote again for the same device unless they ask for the number or change the specs. While they're deciding, just answer what they asked or line up the meetup — repeating the price reads pushy and bot-like.",
    "GRAB THE CLOSE: the moment someone sounds ready ('let's do it', 'where do we meet', gives a number), get them to a real handoff — ask their availability or best number for a quick local meetup and call notify_team. Don't leave a hot lead hanging.",
    "MULTIPLE DEVICES: if they list more than one, handle the instant-catalog phone first (ask its specs, quote it), and note any others (MacBook, iPad, older phone, console) for a manual quote via notify_team — one thing at a time so it's not overwhelming.",
    "PRICE PUSHBACK / COMPETITOR OFFERS: never invent a higher number and never badmouth another buyer. If they say it's too low or someone offered more, say our number's solid but you'll have a teammate take a look to see if there's any room — then call notify_team. Our price is honest; the team handles exceptions.",
    "AFTER A QUOTE OR GOOD ANSWER: just ask casually if they wanna meet up (e.g. 'wanna link up this week?'). Never push, never pitch, never list benefits. If they're in or drop a number, call notify_team.",
    "QUICK ANSWERS (keep them SHORT + casual, like texting): broken? → 'yeah we take broken, just less for it.' how long? → 'like 5 min, cash on the spot.' not sure on condition? → 'just tell me the screen/battery/any cracks, we sort it when we meet.' vs trade-in? → 'usually way more than trade-in, and real cash.' is it legit / a scam? → 'nah we're local, look us up on google 👍'.",
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
      "Identify a device from its 15-digit IMEI (customer dials *#06#). Returns the exact model (often with storage), whether Find My/iCloud lock is on, and whether it's blacklisted. Call the moment a customer sends a 15-digit number.",
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
function render(texts: string[], quickReplies: { caption: string; state: ConvoState }[], origin: string, secret: string, ctx?: string) {
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
  if (ctx) {
    content.actions = [{ action: "set_field_value", field_name: "ai_ctx", value: ctx }];
  }
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
  // TEMP DEBUG: log every inbound hit to Mission Control (survives across serverless instances)
  // so we can see exactly which messages reach the AI. Remove after diagnosis.
  after(() => {
    fetch("https://missioncontrolsdjg-production.up.railway.app/api/comms", {
      method: "POST",
      headers: { "x-api-key": process.env.MC_API_KEY || "", "Content-Type": "application/json" },
      body: JSON.stringify({ from: "msgr-ai-debug", fromName: "MSGR-AI Debug", role: "system", body: `[MSGR-AI HIT${body.ctx !== undefined ? " +ctx" : ""}] "${text.slice(0, 120)}"`, tags: ["msgr-ai-debug"], priority: "low" }),
    }).catch(() => {});
  });
  if (!text) {
    return render(["Hey! 👋 Tell me what you're selling (model + condition) and I'll get you a cash offer."], [], origin, secret);
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
          ? "¡Hola! Ya cerramos por hoy 🌙 dime qué vendes y te paso precio a primera hora 👍"
          : "Hey! We're closed for tonight 🌙 tell me what you're selling and I'll have a cash number for you first thing 👍",
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
    replyText = lang === "es"
      ? "¡Con gusto te ayudo! Dime el modelo y la condición y te doy una oferta. 💵"
      : "Happy to help! Tell me the model and condition and I'll get you a cash offer. 💵";
  }
  if (!replyText) {
    replyText = lang === "es"
      ? "¿Qué modelo es y en qué condición está? Te doy la oferta en efectivo. 💵"
      : "What model is it and what condition? I'll get you the cash offer. 💵";
  }

  // Stale? A newer request claimed the slot while the AI was running — that newer
  // request answers (it carries the newest {{Last Text Input}}); this one goes silent.
  if (psid) {
    const entries = await listMarkers(psid);
    if (entries.some(({ mark: m }) => m.kind === "q" && (m.ts > myTs || (m.ts === myTs && m.rand !== myRand && m.rand > myRand)))) return EMPTY();
    await putMarker(psid, "a", myHash, myRand, Date.now());
    after(() => sweepMarkers(entries));
  }

  // ---- owner SMS: fire on ANY real lead signal (AI flagged a handoff, gave a quote,
  // contact info appeared, or hot-buying language) — flag the hot ones and always pass
  // the contact + the customer's own words so the owner can jump in with context ----
  const sig = detectSignals(text);
  const contact =
    (teamNotified?.contact && teamNotified.contact.replace(/\D/g, "").length >= 5 ? teamNotified.contact : "") || sig.contact;
  if (teamNotified || lastQuote || contact || sig.hot || sig.intent || sig.imei) {
    const isHot = sig.hot || sig.intent || (!!lastQuote && (!!contact || !!teamNotified));
    const what = teamNotified?.summary || (lastQuote ? `${lastQuote.device} → $${lastQuote.offer}` : "active chat");
    const sms = `${isHot ? "🔥 HOT" : "💬"} TCC AI lead: ${what}${contact ? ` | 📞 ${contact}` : ""}${sig.imei ? ` | IMEI ${sig.imei}` : ""} | "${text.slice(0, 55)}". Reply in ManyChat.`;
    after(() => notifyOwnerSms(sms));
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
  return render([replyText], quickReplies, origin, secret, newCtx);
}

export async function GET(req: NextRequest) {
  // TEMP DEBUG: ?peek=1 reads the MC hit-log server-side (where MC_API_KEY works) so we can
  // see exactly which messages reached the AI, from anywhere. Remove after diagnosis.
  if (req.nextUrl.searchParams.get("peek")) {
    try {
      const r = await fetch("https://missioncontrolsdjg-production.up.railway.app/api/comms?limit=60", {
        headers: { "x-api-key": process.env.MC_API_KEY || "" },
        cache: "no-store",
      });
      const d = (await r.json()) as { messages?: { body?: string; timestamp?: string }[] };
      const hits = (d.messages || [])
        .filter((m) => (m.body || "").includes("MSGR-AI HIT"))
        .slice(0, 15)
        .map((m) => ({ at: m.timestamp, body: m.body }));
      return NextResponse.json({ hitCount: hits.length, hits });
    } catch (e) {
      return NextResponse.json({ error: String(e) });
    }
  }
  return NextResponse.json({ ok: true, service: "tcc-msgr-ai", configured: !!process.env.MSGR_BOT_SECRET && !!process.env.ANTHROPIC_API_KEY });
}
