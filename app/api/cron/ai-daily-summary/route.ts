import { NextRequest, NextResponse } from "next/server";
import { callAI, postAIMarker } from "../../../lib/ai-gateway";

// Daily AI summary cron — fires once a morning, reads the last 24h
// of MC comms, generates a 1-paragraph "what happened yesterday"
// digest, posts it back to MC tagged for Skywalker.
//
// Cron schedule: 14:00 UTC (9 AM Central) — registered in vercel.json.
//
// Picks Sonnet because it has to read ~80-150 comms and produce
// human-readable prose. Cost: ~$0.02 per run, ~$7/year.

export const runtime = "nodejs";

const MC_API = "https://missioncontrolsdjg-production.up.railway.app";
const MC_KEY = process.env.MC_API_KEY || "";

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization") || "";
  const secret = process.env.CRON_SECRET;
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // Pull last 24h of comms
  let messages: { id?: string; body?: string; timestamp: string; fromName?: string }[] = [];
  try {
    const r = await fetch(`${MC_API}/api/comms?limit=500`, {
      headers: { "x-api-key": MC_KEY },
      cache: "no-store",
    });
    if (!r.ok) return NextResponse.json({ error: "MC unavailable" }, { status: 502 });
    const data = await r.json();
    messages = Array.isArray(data.messages) ? data.messages : [];
  } catch {
    return NextResponse.json({ error: "MC fetch failed" }, { status: 502 });
  }

  const dayAgoMs = Date.now() - 24 * 60 * 60 * 1000;
  const recent = messages.filter((m) => {
    try { return new Date(m.timestamp).getTime() > dayAgoMs; } catch { return false; }
  });

  // Filter noise — we don't need Claude to read every VERIFIED-OK
  // or status flip. Keep only lead headers + skywalker / powerhouse
  // commentary + AI flags + reviews.
  const interesting = recent.filter((m) => {
    const body = (m.body || "");
    if (!body) return false;
    if (body.includes("VERIFIED-OK")) return false;
    if (body.startsWith("[REMINDER-SENT:")) return false;
    if (body.startsWith("[REVIEW-TOKEN:")) return false;
    if (body.startsWith("[FEDEX-EVENT:") && body.includes("state=unknown")) return false;
    if (body.startsWith("[DELETED-LEAD:")) return false;
    return true;
  });

  if (interesting.length === 0) {
    return NextResponse.json({ ok: true, skipped: true, reason: "no interesting events in last 24h" });
  }

  // Build a compact transcript for Claude — strip MC structural noise,
  // keep author + first 280 chars of each message. Cap at 60 entries
  // to keep prompt under ~10k tokens.
  const transcript = interesting.slice(-60).map((m) => {
    const ts = m.timestamp.slice(11, 16);
    const who = m.fromName || "system";
    const body = (m.body || "").replace(/\s+/g, " ").slice(0, 280);
    return `[${ts}] ${who}: ${body}`;
  }).join("\n");

  const sysPrompt = `You are Powerhouse's reporting agent. Summarize the last 24 hours of Mission Control activity for Skywalker. He runs Top Cash Cellular (phone buyback) + a few other sites.

Return PLAIN MARKDOWN (not JSON). 5-10 lines max. Format:

📊 *Last 24h*

- **Leads:** <count + standout devices/values>
- **Status flow:** <how many moved to received/paid/met etc>
- **Reviews:** <if any came in, name + rating + 1-line>
- **Issues:** <anything flagged, broken, or needing attention>
- **What Skywalker shipped:** <if commits were mentioned, summarize what changed>
- **What Powerhouse shipped:** <my work too>

Rules:
- Be specific (mention exact devices, amounts, customer first names).
- Don't list every event — pick the 3-5 that matter.
- If nothing notable, say so honestly: "Quiet day — N leads, no issues."
- Never include PII (full phone numbers, full emails, addresses) in the summary.`;

  try {
    const result = await callAI({
      model: "anthropic/claude-sonnet-4-6",
      messages: [
        { role: "system", content: sysPrompt },
        { role: "user", content: `Transcript:\n${transcript}` },
      ],
      maxTokens: 800,
      temperature: 0.3,
    });
    // Post the summary back to MC as [AI-SUMMARY]
    await postAIMarker({
      kind: "AI-SUMMARY",
      body: result.text,
      tags: ["ai", "daily-summary"],
    });
    return NextResponse.json({
      ok: true,
      summary: result.text,
      processed: interesting.length,
      tokens: result.outputTokens,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "AI Gateway failed" },
      { status: 502 },
    );
  }
}
