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
import { MODELS, type ConvoState } from "../../lib/msgr-brain";
import { quoteDevice, type QuoteSpec } from "../../lib/quote";
import { notifyOwnerSms } from "../../lib/owner-sms";

export const dynamic = "force-dynamic";

function authed(req: NextRequest): boolean {
  const expected = process.env.MSGR_BOT_SECRET;
  if (!expected) return false;
  const header = req.headers.get("x-bot-secret")?.trim();
  const qp = req.nextUrl.searchParams.get("s")?.trim();
  return header === expected || qp === expected;
}

// Resolve a spoken model name ("iPhone 14 Pro", "s24 ultra") to a real quote slug
// from the SAME catalog the buttons use. Prefer exact, else the longest overlap so
// "14 pro max" beats "14 pro". Returns null → the model isn't in the instant catalog.
function resolveSlug(name: string): { slug: string; label: string } | null {
  const norm = (x: string) => x.toLowerCase().replace(/[^a-z0-9]/g, "");
  const n = norm(name);
  if (!n) return null;
  let best: { slug: string; label: string; len: number } | null = null;
  for (const brand of Object.keys(MODELS)) {
    for (const m of MODELS[brand]) {
      const mn = norm(m.name);
      if (mn === n) return { slug: m.slug, label: m.name };
      if (n.includes(mn) || mn.includes(n)) {
        if (!best || mn.length > best.len) best = { slug: m.slug, label: m.name, len: mn.length };
      }
    }
  }
  return best ? { slug: best.slug, label: best.label } : null;
}

// Catalog string for the system prompt so the model knows what quotes instantly.
function catalogList(): string {
  return Object.values(MODELS)
    .flat()
    .map((m) => m.name)
    .join(", ");
}

type QuoteToolInput = { model?: string; storage?: string; condition?: string; carrier?: string };

// Run the get_quote tool through the real engine — identical to the funnel's path.
async function runQuote(input: QuoteToolInput): Promise<{ ok: boolean; offer?: number; device?: string; slug?: string; reason?: string }> {
  const hit = resolveSlug(input.model || "");
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

const SYSTEM = (lang: string) =>
  [
    "You are the Top Cash Cellular assistant in Facebook Messenger — a LOCAL (Austin, TX) phone, tablet & MacBook buyback. You help people who typed a message instead of tapping the menu buttons. Keep replies SHORT (1-3 sentences), warm, and human — like a real small-business owner texting back. Light emoji ok, never cheesy or over-hyped.",
    lang === "es"
      ? "The user is writing in Spanish — reply ENTIRELY in natural Spanish."
      : "Reply in the user's language (if they write Spanish, answer in Spanish).",
    // ---- facts (mirror the button funnel exactly) ----
    "HOW IT WORKS: We're LOCAL — we meet up at a safe public spot in the Austin area, do a quick 2-minute check, and pay CASH on the spot (also Cash App / Zelle / BTC). No fees, no obligation. If someone is OUT OF TOWN, they can sell on our site topcashcellular.com with a free prepaid shipping label (we pay the day it lands). We have NO walk-in store — never tell anyone to 'come to the store'.",
    "WE BUY: iPhones (11+), Samsung Galaxy (S21+, Z Fold/Flip), Google Pixel, MacBooks, and consoles — ANY condition, even cracked (lower offer). Conditions: sealed (new in plastic), like-new, good, fair, broken.",
    "QUOTING — CRITICAL: NEVER make up or estimate a price. To quote, you MUST call the get_quote tool with the model, storage, condition, and carrier. Ask for whatever's missing FIRST (storage? condition? carrier? — unlocked usually pays most), then call the tool. If get_quote says the model isn't in the instant catalog (older/rare device, MacBook, bulk lot), DON'T guess — tell them a team member will price it by hand and call notify_team.",
    "AFTER A QUOTE: give the number plainly and invite them to lock it in for a local cash meetup. When someone wants to proceed, wants a human, gives a phone/email, or has a bulk lot / manual device, call notify_team so a real teammate follows up.",
    `INSTANT-QUOTE CATALOG (models get_quote can price): ${catalogList()}.`,
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
function render(texts: string[], quickReplies: { caption: string; state: ConvoState }[], origin: string, secret: string) {
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
  return NextResponse.json({ version: "v2", content });
}

type AnyBlock = { type: string; text?: string; id?: string; name?: string; input?: unknown };

export async function POST(req: NextRequest) {
  if (!authed(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const secret = process.env.MSGR_BOT_SECRET as string;
  const origin = req.nextUrl.origin;

  let body: { text?: string; history?: unknown; lang?: string } = {};
  try {
    body = await req.json();
  } catch {
    /* empty */
  }
  const text = (typeof body.text === "string" ? body.text : req.nextUrl.searchParams.get("text") || "").slice(0, 1500).trim();
  if (!text) {
    return render(["Hey! 👋 Tell me what you're selling (model + condition) and I'll get you a cash offer."], [], origin, secret);
  }
  const lang = body.lang === "es" || /[áéíóúñ¿¡]|hola|cuánto|vender|teléfono|precio|gracias/i.test(text) ? "es" : "en";

  const rawHistory = Array.isArray(body.history) ? body.history : [];
  const history = rawHistory
    .slice(-10)
    .map((m) => {
      const o = (m || {}) as { role?: string; from?: string; text?: string };
      const role = o.role === "assistant" || o.from === "bot" || o.from === "assistant" ? "assistant" : "user";
      return o.text ? { role: role as "user" | "assistant", content: String(o.text).slice(0, 1000) } : null;
    })
    .filter(Boolean) as { role: "user" | "assistant"; content: string }[];

  // ---- run Claude with the quote engine as a tool ----
  let replyText = "";
  let lastQuote: { offer: number; device: string; slug: string } | null = null;
  let teamNotified: { summary: string; contact?: string } | null = null;
  try {
    const Anthropic = (await import("@anthropic-ai/sdk")).default;
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const messages: { role: "user" | "assistant"; content: unknown }[] = [...history, { role: "user", content: text }];

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

  // ---- owner SMS when the AI flags a real lead (mirrors the funnel's notifyLead) ----
  if (teamNotified) {
    const sms = `🙋 TCC AI chat: ${teamNotified.summary}${teamNotified.contact ? ` — reply to: ${teamNotified.contact}` : ""}. Jump into ManyChat.`;
    after(() => notifyOwnerSms(sms));
  } else if (lastQuote) {
    const sms = `💰 TCC AI chat quoted ${lastQuote.device} → $${lastQuote.offer}. They're mid-chat in ManyChat 👀`;
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

  return render([replyText], quickReplies, origin, secret);
}

export async function GET() {
  return NextResponse.json({ ok: true, service: "tcc-msgr-ai", configured: !!process.env.MSGR_BOT_SECRET && !!process.env.ANTHROPIC_API_KEY });
}
