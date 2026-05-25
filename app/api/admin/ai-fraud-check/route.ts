import { NextRequest, NextResponse } from "next/server";
import { callAI } from "../../../lib/ai-gateway";

// AI fraud narrative — given a lead's fingerprint (IP, UA, visitor
// history, contact, device claim, prior leads), get a plain-English
// "this looks normal / fishy because X" verdict. Skywalker uses this
// from the admin lead row when a submission triggers his gut.
//
//   POST /api/admin/ai-fraud-check?token=<...>
//   Body: { leadId, name, email, phone, device, condition, quote,
//           sourceIP, sourceUA, visitorId, priorLeads, lifetimeSpend,
//           recentIPLeads: [{ip, count}, ...] }
//
// Returns:
//   { verdict, score (0-100), red_flags, green_flags, recommendation }

const ADMIN_TOKEN = process.env.TCC_ADMIN_TOKEN || (() => { throw new Error("TCC_ADMIN_TOKEN env required"); })();

export async function POST(req: NextRequest) {
  if (req.nextUrl.searchParams.get("token") !== ADMIN_TOKEN && req.headers.get("x-admin-token") !== ADMIN_TOKEN) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  let data: Record<string, unknown> = {};
  try { data = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const sysPrompt = `You are a fraud-risk analyst for Top Cash Cellular, a phone buyback service in Austin, TX. Customers ship/meet to sell their devices to TCC. Risk patterns:

  - Stolen devices (most common): IMEI on blacklist, customer can't provide receipt.
  - Reshipping fraud: same address / IP submitting many leads under different names.
  - Synthetic identity: brand-new email + brand-new phone + brand-new IP, no prior visits.
  - Mismatch: high-value claim (iPhone 17 Pro Max) from low-engagement visitor (first visit, no funnel exploration).
  - Sock-puppet review farming: cluster of leads from same IP across different emails.

Given the lead fingerprint below, return a STRICT JSON risk verdict:
{
  "verdict": "low_risk" | "medium_risk" | "high_risk" | "suspect_fraud",
  "score": <0-100 integer where 100 = highest risk>,
  "red_flags": ["<specific concerns observed>"],
  "green_flags": ["<things that make this look legit>"],
  "recommendation": "approve" | "require_id" | "manual_review" | "reject"
}

Rules:
- A first-time customer is NOT inherently suspicious — most leads are first-time.
- Same IP + multiple leads = normal if same person bringing in multiple devices over weeks. Suspicious if different names + same IP within 24h.
- Returning customer with lifetime spend > $0 from prior trades = strong green flag.
- Very high-value device + zero prior funnel engagement (no funnel_step events, came straight to submit) = mild flag.
- Don't accuse anyone of being a thief from data alone. "Recommendation: require_id" is the strongest tool for high-value first-time customers.`;

  const userPrompt = `Lead fingerprint:
${JSON.stringify(data, null, 2)}

Analyze and return your JSON verdict.`;

  try {
    const result = await callAI({
      model: "anthropic/claude-sonnet-4-6",
      messages: [
        { role: "system", content: sysPrompt },
        { role: "user", content: userPrompt },
      ],
      json: true,
      maxTokens: 500,
    });
    return NextResponse.json({
      ok: true,
      verdict: result.parsed,
      tokens: result.outputTokens,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "AI Gateway failed" },
      { status: 502 },
    );
  }
}
