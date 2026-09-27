// Vercel AI Gateway client — single function to call any LLM via the
// unified endpoint Skywalker set up at AI_GATEWAY_API_KEY on
// 2026-05-19. Used by every /api/ai/* + /api/admin/ai-* route.
//
// Picks model per task tier so we don't burn Opus tokens on jobs
// that Haiku-class models handle fine. Costs roll up at
// vercel.com → top-cash-cellular → AI.

const GATEWAY = "https://ai-gateway.vercel.sh/v1/chat/completions";

export type AIModel =
  | "anthropic/claude-haiku-4-5"      // cheap + fast — triage, classification, summaries
  | "anthropic/claude-sonnet-4-6"     // workhorse — vision, drafts, fraud narrative
  | "anthropic/claude-opus-4-8"       // expensive — reserve for hard reasoning
  | "openai/gpt-5-nano"               // alternative cheap fallback
  | "openai/gpt-5";                   // alternative workhorse

export type AIMessage = {
  role: "system" | "user" | "assistant";
  content: string | Array<
    | { type: "text"; text: string }
    | { type: "image_url"; image_url: { url: string } }
  >;
};

export type AIRequest = {
  model: AIModel;
  messages: AIMessage[];
  maxTokens?: number;
  temperature?: number;
  // JSON-mode — when true, instruct the model to return strict JSON
  // and parse it on this side. Helpful for classifier-style tasks.
  json?: boolean;
};

export type AIResult = {
  text: string;
  inputTokens?: number;
  outputTokens?: number;
  model: string;
  /** Parsed JSON when AIRequest.json was set + parsing succeeded. */
  parsed?: unknown;
};

// DIRECT ANTHROPIC FIRST (2026-09-26). The gateway's free tier stopped
// serving these models ("Free tier users do not have access to this model",
// 403) — the last [AI-SUMMARY] landed on 2026-08-08, and every gateway-backed
// job (daily digest, lead triage, photo check, fraud/price/review drafts)
// has failed silently since. The chat's own Anthropic key works (the seller
// chat runs on it), so an anthropic/* request goes straight to the Anthropic
// API on the same model family the chat uses; the gateway remains the path
// for non-Anthropic models and the fallback when the direct call fails.
const DIRECT_MODEL: Record<string, string> = {
  "anthropic/claude-haiku-4-5": "claude-haiku-4-5-20251001",
  "anthropic/claude-sonnet-4-6": process.env.CHAT_AI_MODEL || "claude-sonnet-5",
  "anthropic/claude-opus-4-8": "claude-opus-5-5",
};

async function callAnthropicDirect(req: AIRequest, model: string): Promise<AIResult> {
  const Anthropic = (await import("@anthropic-ai/sdk")).default;
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, timeout: 30_000, maxRetries: 1 });
  // OpenAI-style messages → Anthropic: system lines become the system
  // prompt; image_url parts become URL image blocks.
  const system = req.messages
    .filter((m) => m.role === "system")
    .map((m) => (typeof m.content === "string" ? m.content : m.content.map((p) => (p.type === "text" ? p.text : "")).join("\n")))
    .join("\n\n");
  const jsonHint = req.json ? "\n\nRespond with a single strict JSON object and nothing else." : "";
  type Block = { type: "text"; text: string } | { type: "image"; source: { type: "url"; url: string } };
  const messages = req.messages
    .filter((m) => m.role !== "system")
    .map((m) => ({
      role: m.role as "user" | "assistant",
      content: typeof m.content === "string"
        ? m.content
        : m.content.map((p): Block => (p.type === "text" ? { type: "text", text: p.text } : { type: "image", source: { type: "url", url: p.image_url.url } })),
    }));
  // No `temperature`: the Claude 5 family rejects it ("`temperature` is
  // deprecated for this model", 400) — the chat route sends none either.
  const res = await client.messages.create({
    model,
    max_tokens: req.maxTokens ?? 1024,
    ...(system || jsonHint ? { system: `${system}${jsonHint}`.trim() } : {}),
    messages,
  });
  const text = res.content.map((b) => (b.type === "text" ? b.text : "")).join("").trim();
  let parsed: unknown;
  if (req.json) {
    try { parsed = JSON.parse(text.replace(/^```(?:json)?\s*|\s*```$/g, "")); } catch { /* caller falls back */ }
  }
  return { text, inputTokens: res.usage?.input_tokens, outputTokens: res.usage?.output_tokens, model: res.model || model, parsed };
}

export async function callAI(req: AIRequest): Promise<AIResult> {
  const direct = DIRECT_MODEL[req.model];
  if (direct && process.env.ANTHROPIC_API_KEY) {
    try {
      return await callAnthropicDirect(req, direct);
    } catch (e) {
      // Fall through to the gateway only when one is configured; otherwise
      // the real error surfaces to the caller.
      if (!process.env.AI_GATEWAY_API_KEY) throw e;
      console.warn(`[ai] direct Anthropic call failed (${e instanceof Error ? e.message : "?"}) — trying the gateway`);
    }
  }
  const key = process.env.AI_GATEWAY_API_KEY;
  if (!key) {
    throw new Error("AI_GATEWAY_API_KEY not set");
  }
  const r = await fetch(GATEWAY, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: req.model,
      messages: req.messages,
      max_tokens: req.maxTokens ?? 1024,
      temperature: req.temperature ?? 0.3,
      ...(req.json
        ? { response_format: { type: "json_object" } }
        : {}),
    }),
    cache: "no-store",
    // Bounded: a stalled gateway call in a background triage held the chat
    // function open to the platform limit.
    signal: AbortSignal.timeout(30_000),
  });
  if (!r.ok) {
    const body = await r.text().catch(() => "");
    throw new Error(`AI Gateway ${r.status}: ${body.slice(0, 300)}`);
  }
  type GatewayResponse = {
    choices?: Array<{ message?: { content?: string } }>;
    usage?: { prompt_tokens?: number; completion_tokens?: number };
    model?: string;
  };
  const data = (await r.json()) as GatewayResponse;
  const text = data.choices?.[0]?.message?.content ?? "";
  let parsed: unknown;
  if (req.json) {
    try { parsed = JSON.parse(text); } catch { /* swallow, caller can fall back */ }
  }
  return {
    text,
    inputTokens: data.usage?.prompt_tokens,
    outputTokens: data.usage?.completion_tokens,
    model: data.model || req.model,
    parsed,
  };
}

// Convenience: post an [AI-FLAG] / [AI-NOTE] marker to MC so admin
// surfaces the AI verdict alongside the lead. Same pattern as other
// markers (status, deletions, etc.).
const MC_API = "https://missioncontrolsdjg-production.up.railway.app";
const MC_KEY = process.env.MC_API_KEY || "";
export async function postAIMarker(opts: {
  kind: "AI-FLAG" | "AI-NOTE" | "AI-SUMMARY";
  leadId?: string;
  body: string;
  tags?: string[];
  // Optional sender override. Default sender is Powerhouse (the TCC
  // coder agent). Theot signs channel-recommendation markers via
  // `signAs: { from: "theot", fromName: "Theot" }` so the lead row
  // reads as her advisory call. Never use from:openclaw.
  signAs?: { from: string; fromName: string };
}): Promise<boolean> {
  if (!MC_KEY) return false;
  // Strip [ ] from the body — same defense the lead route uses to
  // stop markers inside markers.
  const cleanBody = opts.body.replace(/[\[\]]/g, "").slice(0, 2000);
  const prefix = opts.leadId ? `[${opts.kind}: ${opts.leadId}] ` : `[${opts.kind}] `;
  const from = opts.signAs?.from || "powerhouse";
  const fromName = opts.signAs?.fromName || "Powerhouse";
  try {
    const r = await fetch(`${MC_API}/api/comms`, {
      method: "POST",
      headers: { "x-api-key": MC_KEY, "Content-Type": "application/json" },
      signal: AbortSignal.timeout(10_000),
      body: JSON.stringify({
        from,
        fromName,
        role: "system",
        body: prefix + cleanBody,
        tags: opts.tags || ["ai", opts.kind.toLowerCase()],
        priority: "low",
      }),
    });
    return r.ok;
  } catch { return false; }
}
