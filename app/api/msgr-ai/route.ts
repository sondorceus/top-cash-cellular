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

// Server-side lead intelligence: catch contact info + hot-buying signals in the raw
// message even when the model doesn't call notify_team — so no lead ever slips past
// the owner, and the truly-ready ones get flagged HOT for a fast follow-up.
function detectSignals(text: string): { contact: string; hot: boolean; intent: boolean } {
  const phone = text.match(/(?:\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}\b/)?.[0]?.trim();
  const email = text.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i)?.[0];
  const contact = phone || email || "";
  const hot =
    /\b(today|tonight|asap|right now|need\s+(the\s+)?cash|how soon|urgent|this (morning|afternoon|evening)|meet ?up|can we meet|cash today|where.*(meet|located|you at))\b/i.test(text);
  const intent =
    /\b(i'?ll take it|let'?s do it|sounds good|it'?s a deal|i'?m in|where do (we|i)|come get it|book it|set it up|when can (we|you)|ready to sell|wanna sell|want to sell it|do it)\b/i.test(text);
  return { contact, hot, intent };
}

const SYSTEM = (lang: string) =>
  [
    "You're a real person who works at Top Cash Cellular — a LOCAL Austin phone/tablet/MacBook buyer — texting leads back on Messenger. TALK LIKE A REAL HUMAN TEXTING: short, casual, chill. Almost every reply is ONE line, usually under 12 words. Contractions always; lowercase is fine. NEVER sound like a bot or an ad: no 'Great question', no 'Perfect!', no 'Totally fair', no feature lists, and NEVER volunteer the 'no fees / no obligation / safe public spot / free shipping' spiel — that reads exactly like a scam and kills leads. Just be a normal guy who buys phones: quick, friendly, straight to the point. Skip emojis mostly (one occasionally is fine). To quote you still need storage + condition + carrier — ask casually in one line, e.g. 'what storage + condition? unlocked?'.",
    "FORMATTING — CRITICAL: This is Facebook Messenger. Write PLAIN TEXT only. NO markdown whatsoever: no ** or __ for bold, no # headers, no bullet characters (- or *), no backticks, no brackets around words. Messenger shows all of that as literal ugly characters. Plain sentences, line breaks, and emojis only.",
    lang === "es"
      ? "The user is writing in Spanish — reply ENTIRELY in natural Spanish."
      : "Reply in the user's language (if they write Spanish, answer in Spanish).",
    // ---- facts (mirror the button funnel exactly) ----
    "HOW IT WORKS (only bring up if they ASK — and then ONE casual line, do NOT recite features): we're local in Austin, meet up somewhere quick, cash in hand. Out-of-towners can ship free via topcashcellular.com. No walk-in store, so never say 'come to the store'.",
    "WE BUY: iPhones (11+), Samsung Galaxy (S21+, Z Fold/Flip), Google Pixel, MacBooks, and consoles — ANY condition, even cracked (lower offer). Conditions: sealed (new in plastic), like-new, good, fair, broken.",
    "QUOTING — CRITICAL: NEVER make up or estimate a price. To quote, you MUST call the get_quote tool with the model, storage, condition, and carrier. Ask for whatever's missing FIRST (storage? condition? carrier? — unlocked usually pays most), then call the tool. If get_quote says the model isn't in the instant catalog (older/rare device, MacBook, bulk lot), DON'T guess — tell them a team member will price it by hand and call notify_team.",
    "BE EFFICIENT — NEVER REPEAT A QUESTION (the #1 thing that makes us look like a broken bot): read the WHOLE conversation above before replying, and combine everything still missing into ONE natural question (e.g. 'what storage + condition, and is it unlocked?') — never drip one question at a time and NEVER ask for something they already told you. If a spec is even implied (e.g. 'just got it from assurant' ≈ new/sealed), use it, don't re-ask. The instant you can tell model + storage + condition, call get_quote and give the number instead of asking anything more. If you genuinely don't have their answer yet, move the convo forward — don't echo the same line back.",
    "AFTER A QUOTE: give the number plainly and invite them to lock it in for a local cash meetup. When someone wants to proceed, wants a human, gives a phone/email, or has a bulk lot / manual device, call notify_team so a real teammate follows up.",
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
  // ctx = compact base64 conversation memory, mapped back to the ManyChat ai_ctx field.
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

export async function POST(req: NextRequest) {
  if (!authed(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const secret = process.env.MSGR_BOT_SECRET as string;
  const origin = req.nextUrl.origin;

  // ManyChat's Default Reply dynamic block passes the typed message as a JSON body
  // ({"text":"{{Last Text Input}}"}); read it raw (spaces would break a URL query).
  const rawBody = await req.text().catch(() => "");
  let body: { text?: string; history?: unknown; lang?: string; ctx?: unknown } = {};
  try { body = JSON.parse(rawBody); } catch { /* not json */ }
  let text = (typeof body.text === "string" ? body.text : req.nextUrl.searchParams.get("text") || "").slice(0, 1500).trim();
  // ManyChat's field chip wraps the message in literal curly braces (e.g. "{hello}").
  // Strip a single enclosing { } so the AI (and the customer) never see raw brackets.
  text = text.replace(/^\{([\s\S]*)\}$/, "$1").trim();
  // TEMP DEBUG: log every inbound hit to Mission Control (survives across serverless instances)
  // so we can see exactly which messages reach the AI. Remove after diagnosis.
  after(() => {
    fetch("https://missioncontrolsdjg-production.up.railway.app/api/comms", {
      method: "POST",
      headers: { "x-api-key": process.env.MC_API_KEY || "", "Content-Type": "application/json" },
      body: JSON.stringify({ from: "msgr-ai-debug", fromName: "MSGR-AI Debug", role: "system", body: `[MSGR-AI HIT] "${text.slice(0, 120)}"`, tags: ["msgr-ai-debug"], priority: "low" }),
    }).catch(() => {});
  });
  if (!text) {
    return render(["Hey! 👋 Tell me what you're selling (model + condition) and I'll get you a cash offer."], [], origin, secret);
  }
  // Spanish detection must catch accent-LESS typing (most people skip accents on a phone):
  // "cuanto", "telefono", "vendo", etc. — not just the accented forms.
  const lang =
    body.lang === "es" ||
    /[áéíóúñ¿¡]|\b(hola|cu[aá]nto|cuesta|vend[eo]|vender|tel[eé]fono|celular|precio|comprar|quiero|gracias|ofrec|me\s+das|por\s+mi|tienes|est[aá]\s)\b/i.test(text)
      ? "es"
      : "en";

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
        max_tokens: 400,
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

  // ---- owner SMS: fire on ANY real lead signal (AI flagged a handoff, gave a quote,
  // contact info appeared, or hot-buying language) — flag the hot ones and always pass
  // the contact + the customer's own words so the owner can jump in with context ----
  const sig = detectSignals(text);
  const contact =
    (teamNotified?.contact && teamNotified.contact.replace(/\D/g, "").length >= 5 ? teamNotified.contact : "") || sig.contact;
  if (teamNotified || lastQuote || contact || sig.hot || sig.intent) {
    const isHot = sig.hot || sig.intent || (!!lastQuote && (!!contact || !!teamNotified));
    const what = teamNotified?.summary || (lastQuote ? `${lastQuote.device} → $${lastQuote.offer}` : "active chat");
    const sms = `${isHot ? "🔥 HOT" : "💬"} TCC AI lead: ${what}${contact ? ` | 📞 ${contact}` : ""} | "${text.slice(0, 55)}". Reply in ManyChat.`;
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
