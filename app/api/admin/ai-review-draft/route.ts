import { NextRequest, NextResponse } from "next/server";
import { callAI } from "../../../lib/ai-gateway";

// Trustpilot / Google review response drafter — given a customer
// review (rating + body) and optional context about the lead, draft
// a personalized reply in TCC's voice. Skywalker copies, edits if
// needed, pastes into Trustpilot.
//
//   GET /api/admin/ai-review-draft?token=<...>&rating=5
//        &body=<encoded review text>&device=iPhone+17+Pro&name=Steve
//
// Returns:
//   { draft, tone, key_points }
//
// Sonnet for solid voice + tone control. Cheap enough to run for
// every review without breaking the bank.

const ADMIN_TOKEN = process.env.TCC_ADMIN_TOKEN || "topcash-admin-2026";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams;
  if (q.get("token") !== ADMIN_TOKEN) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const ratingRaw = q.get("rating");
  const body = q.get("body");
  if (!body || !ratingRaw) {
    return NextResponse.json({ error: "rating + body required" }, { status: 400 });
  }
  const rating = parseInt(ratingRaw, 10);
  if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
    return NextResponse.json({ error: "rating must be 1-5" }, { status: 400 });
  }
  const device = q.get("device") || undefined;
  const customerName = q.get("name") || undefined;

  const sysPrompt = `You write public review responses for Top Cash Cellular, an Austin, TX phone buyback service run by a small team. Voice: warm, direct, slightly informal — like a real person, not a brand. Never corporate. Always sign off "— The Top Cash team".

Given a customer review + their context, draft a response. Return JSON:
{
  "draft": "<the full response, ready to paste, under 600 chars>",
  "tone": "thank_you" | "address_concern" | "apology_and_fix" | "gentle_push_back",
  "key_points": ["<the 2-3 things your draft acknowledges or commits to>"]
}

Rules:
- 5-star: thank them by name, mention something specific (device or experience), invite back. Short.
- 4-star: thank, acknowledge any soft criticism, name what we'd do differently next time. No defensive language.
- 3-star: take responsibility for whatever went wrong, offer a fix (e.g. "DM us, we'll make it right"), no excuses.
- 1-2 star: apologize FIRST. Don't argue the facts publicly. Offer a direct contact (CustomerService@topcashcells.com) and commit to a specific follow-up. Never reveal private lead details.
- Never promise specific money amounts.
- Never quote internal pricing numbers.
- If their review has obviously false claims (e.g. "they stole my phone"), respond calmly: acknowledge the frustration, deny only the factually-false part, redirect to private contact.`;

  const userPrompt = `Review rating: ${rating} stars
Customer name: ${customerName || "(not provided)"}
Device they sold: ${device || "(not provided)"}

Review text:
"""${body.slice(0, 2000)}"""

Draft our response.`;

  try {
    const result = await callAI({
      model: "anthropic/claude-sonnet-4-6",
      messages: [
        { role: "system", content: sysPrompt },
        { role: "user", content: userPrompt },
      ],
      json: true,
      maxTokens: 500,
      temperature: 0.5, // a little more creative voice
    });
    return NextResponse.json({ ok: true, response: result.parsed, tokens: result.outputTokens });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "AI Gateway failed" },
      { status: 502 },
    );
  }
}
