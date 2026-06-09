import { NextRequest, NextResponse } from "next/server";
import { safeEqual } from "../../../lib/admin-auth";
import { callAI } from "../../../lib/ai-gateway";

// AI pricing sanity check — given a device + storage + condition +
// our proposed payout, ask Claude to second-guess based on the
// current resale market (eBay sold + Swappa + dealer wholesale).
//
// Returns a verdict on whether the payout is RIGHT / TIGHT / RISKY
// + a suggested alternative. Skywalker uses this from /admin/prices
// when a per-cell margin chip looks suspicious (e.g. the mbp13m1
// -82% margin that fell out of the loss-risk review on 2026-05-19).
//
//   GET /api/admin/ai-price-check?token=<TCC_ADMIN_TOKEN>
//        &model=iPhone+17+Pro+Max&storage=256&condition=Excellent
//        &carrier=Unlocked&payout=712
//
// Reads as a one-shot since admin uses it interactively. Uses Sonnet
// for solid reasoning without Opus pricing.

const ADMIN_TOKEN = process.env.TCC_ADMIN_TOKEN;

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams;
  if (!safeEqual(q.get("token"), ADMIN_TOKEN)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const model = q.get("model");
  const storage = q.get("storage");
  const condition = q.get("condition");
  const carrier = q.get("carrier") || "Unlocked";
  const payoutStr = q.get("payout");
  const payout = payoutStr ? parseInt(payoutStr, 10) : NaN;
  if (!model || !storage || !condition || !Number.isFinite(payout)) {
    return NextResponse.json({ error: "model + storage + condition + payout required" }, { status: 400 });
  }

  const sysPrompt = `You are a buyback pricing analyst. Given a device variant and a proposed buyback payout, judge whether the payout is sustainable for the operator (Top Cash Cellular — Austin, TX phone buyback). They resell to: Atlas Mobile wholesale, eBay direct, and Swappa retail. Their target margin floor is 15% off Atlas grade_a.

Return STRICT JSON:
{
  "verdict": "underpriced" | "fair" | "tight" | "overpriced",
  "suggested_min": <int>,
  "suggested_target": <int>,
  "suggested_max": <int>,
  "rationale": "<one paragraph, plain English, why>",
  "comp_sources": ["<list of channels you considered, e.g. 'eBay sold Q1 2026', 'Atlas grade_a', 'Swappa mid'>"]
}

Reasoning rules:
- Suggested_target = what you'd pay if optimizing for 20% margin
- Suggested_max = absolute ceiling before margin goes red
- Suggested_min = floor below which the device isn't worth processing (lost on shipping + handling)
- If you don't have reliable comps in your training, say so in rationale and set confidence-flavored language. Don't make up specific eBay prices you can't verify.`;

  const userPrompt = `Device: ${model}
Storage: ${storage}
Condition: ${condition}
Carrier-lock: ${carrier}
Our proposed payout: $${payout}

Sanity check this payout.`;

  try {
    const result = await callAI({
      model: "anthropic/claude-sonnet-4-6",
      messages: [
        { role: "system", content: sysPrompt },
        { role: "user", content: userPrompt },
      ],
      json: true,
      maxTokens: 600,
    });
    return NextResponse.json({
      ok: true,
      verdict: result.parsed,
      raw: result.parsed ? undefined : result.text,
      tokens: result.outputTokens,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "AI Gateway failed" },
      { status: 502 },
    );
  }
}
