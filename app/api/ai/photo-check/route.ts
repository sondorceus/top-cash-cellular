import { NextRequest, NextResponse } from "next/server";
import { callAI, postAIMarker } from "../../../lib/ai-gateway";
import { safeEqual } from "../../../lib/admin-auth";

// Auth gate. The live photo-check is run INLINE inside /api/lead; this
// standalone HTTP route has no first-party caller, so leaving it open was
// an unauthenticated Sonnet-vision endpoint: anyone could drive ~1¢+
// vision calls with attacker-supplied image URLs AND write [AI-FLAG]
// markers against any leadId. Require the admin token.
const ADMIN_TOKEN = process.env.TCC_ADMIN_TOKEN;
function authed(req: NextRequest): boolean {
  return safeEqual(req.headers.get("x-admin-token"), ADMIN_TOKEN);
}

// AI photo QA — pass a lead's photos + the device the customer
// claimed, get back a structured verdict on whether the photos
// MATCH the claim. Catches the three biggest fraud + mistake
// patterns we see:
//   - Wrong model: customer picks iPhone 17 Pro Max in the funnel
//     but the photo is clearly an iPhone 15.
//   - Screenshot, not actual device: someone shoots their screen
//     to fake a working device.
//   - Undisclosed damage: customer picks "Excellent" but the photo
//     shows visible cracks / dents.
//
// Skywalker 2026-05-19. Runs on Claude Sonnet 4.6 via the Vercel
// AI Gateway — vision-capable, fast, cheap enough to fire on every
// lead with photos (~1¢ each).
//
//   POST /api/ai/photo-check
//   { leadId, model, condition, photos: ["https://...", ...] }
//
// Writes [AI-FLAG] marker to MC when a mismatch is detected so the
// admin row surfaces "🤖 model-mismatch: customer claimed X, photo
// looks like Y" without staff having to open every photo manually.

export async function POST(req: NextRequest) {
  if (!authed(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  let data: { leadId?: string; model?: string; condition?: string; photos?: string[] } = {};
  try { data = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const { leadId, model, condition, photos } = data;
  if (!leadId || !model || !Array.isArray(photos) || photos.length === 0) {
    return NextResponse.json({ error: "leadId + model + photos required" }, { status: 400 });
  }

  // Build the vision prompt. Limit to first 4 photos to keep token
  // costs predictable (vision tokens scale per image).
  const imageItems = photos.slice(0, 4).map((url) => ({
    type: "image_url" as const,
    image_url: { url },
  }));

  const systemPrompt = `You are a device-inspection assistant for Top Cash Cellular, a phone buyback service. The customer submitted a lead claiming a specific device + condition. Inspect the attached photos and return a JSON verdict.

Return STRICT JSON with this shape:
{
  "match": true | false,
  "claimed_model": "<echo back the model the customer picked>",
  "observed_model": "<your best guess at what the photo actually shows, or 'unclear'>",
  "claimed_condition": "<echo back the condition>",
  "observed_condition": "<your read of actual condition: Excellent | Good | Fair | Broken | unclear>",
  "issues": [<short strings flagging specific problems, e.g. "Photo shows iPhone 15, not iPhone 17", "Visible front-glass crack not disclosed", "This appears to be a screenshot, not a physical device">],
  "confidence": "high" | "medium" | "low",
  "recommendation": "approve" | "manual-review" | "reject"
}

Rules:
- If you can't tell (blurry, dark, only shows a box, etc.) — set confidence "low" + recommendation "manual-review".
- A condition discrepancy of one tier is normal photo variance — only flag two-tier discrepancies (e.g. "Excellent" claim but visible cracks → real "Broken").
- Don't flag minor cosmetic stuff the customer might not have noticed (tiny scratches on a Good claim).
- If the photo is clearly a screenshot (you see the OS status bar, UI chrome, screen-recording overlay) — flag it.
- Be concise. Each issue string under 100 chars.`;

  const userPrompt = `Customer claim:
- Model: ${model}
- Condition: ${condition || "(not provided)"}

Inspect the ${photos.length} attached photo(s) and return your JSON verdict.`;

  try {
    const result = await callAI({
      model: "anthropic/claude-sonnet-4-6",
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: [
            { type: "text", text: userPrompt },
            ...imageItems,
          ],
        },
      ],
      json: true,
      maxTokens: 800,
    });
    type Verdict = {
      match?: boolean;
      observed_model?: string;
      observed_condition?: string;
      issues?: string[];
      confidence?: string;
      recommendation?: string;
    };
    const verdict = (result.parsed || {}) as Verdict;
    // Post an [AI-FLAG] marker when something looks off — staff sees it
    // alongside the lead in /admin. Pass-throughs (match=true, no
    // issues) just write an [AI-NOTE] so the audit trail exists but
    // doesn't clutter the alert path.
    const issueCount = verdict.issues?.length || 0;
    const flagged = verdict.match === false || issueCount > 0 || verdict.recommendation === "reject";
    const summary = flagged
      ? `${verdict.recommendation || "review"} · ${verdict.observed_model ? `observed=${verdict.observed_model} vs claimed=${model}` : ""} · ${(verdict.issues || []).join("; ")}`
      : `clean · matches ${model}${verdict.confidence ? ` (${verdict.confidence} confidence)` : ""}`;
    await postAIMarker({
      kind: flagged ? "AI-FLAG" : "AI-NOTE",
      leadId,
      body: `photo-check · ${summary}`,
      tags: ["ai", "photo-check", flagged ? "flagged" : "clean"],
    });
    return NextResponse.json({ ok: true, verdict, flagged, tokens: result.outputTokens });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "AI Gateway failed" },
      { status: 502 },
    );
  }
}
