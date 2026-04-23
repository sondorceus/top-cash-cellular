import { NextRequest, NextResponse } from "next/server";

const MC_API = "https://missioncontrolsdjg-production.up.railway.app";
const MC_KEY = process.env.MC_API_KEY || "";

const SYSTEM_PROMPTS: Record<string, string> = {
  lead: `You are Theot, an AI assistant on the Top Cash Cellular team. A new buyback lead just came in. Your job:
1. Score it (hot/warm/cold) based on device value and condition
2. Draft a short, friendly follow-up message for Skywalker to send
3. Note any red flags or special handling needed
Keep your response under 200 words. Be direct and actionable.`,

  "work-order": `You are Theot, an AI assistant reviewing a new work order. Check if it's:
1. Clear and actionable (or needs clarification)
2. Has acceptance criteria
3. Has an estimated effort level
Flag any gaps. Keep response under 150 words.`,

  default: `You are Theot, an AI assistant on the Top Cash Cellular team. Process this event and provide a brief, actionable summary. Under 150 words.`,
};

export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-webhook-secret");
  if (secret !== (process.env.WEBHOOK_SECRET || "theot-webhook-2026")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { event, hook, message } = await req.json();
  if (!message?.body) return NextResponse.json({ error: "No message body" }, { status: 400 });

  const matchedTag = (message.tags || []).find((t: string) => SYSTEM_PROMPTS[t]);
  const systemPrompt = SYSTEM_PROMPTS[matchedTag || ""] || SYSTEM_PROMPTS.default;

  let response = "";
  try {
    const Anthropic = (await import("@anthropic-ai/sdk")).default;
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const result = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 300,
      system: systemPrompt,
      messages: [{ role: "user", content: `Event: ${event}\nHook: ${hook}\n\nMessage:\n${message.body}` }],
    });
    response = result.content[0].type === "text" ? result.content[0].text : "Could not process event.";
  } catch (e) {
    response = `[Auto-process failed: ${(e as Error).message}]`;
  }

  if (MC_KEY && response) {
    try {
      await fetch(`${MC_API}/api/comms`, {
        method: "POST",
        headers: { "x-api-key": MC_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: "theot",
          fromName: "Theot",
          role: "assistant",
          body: `[AUTO] ${response}`,
          tags: ["auto-response", event],
          priority: "normal",
        }),
      });
    } catch {}
  }

  return NextResponse.json({ ok: true, response });
}
