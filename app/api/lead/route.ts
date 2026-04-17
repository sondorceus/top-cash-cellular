import { NextRequest, NextResponse } from "next/server";

const MC_API = "https://missioncontrolsdjg-production.up.railway.app";
const MC_KEY = "9b4dce8e03c1d2aaf86d272a2afda99a0157f49abd66450f";

export async function POST(req: NextRequest) {
  const data = await req.json();
  const { name, phone, email, device, model, storage, condition, quote, payout } = data;

  const leadBody = [
    `[NEW BUYBACK LEAD]`,
    `Name: ${name}`,
    `Phone: ${phone}`,
    email ? `Email: ${email}` : null,
    `Device: ${device} — ${model}`,
    storage ? `Storage: ${storage}` : null,
    `Condition: ${condition}`,
    `Quote: $${quote}`,
    `Payout: ${payout}`,
  ].filter(Boolean).join("\n");

  try {
    await fetch(`${MC_API}/api/comms`, {
      method: "POST",
      headers: { "x-api-key": MC_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "topcash-web",
        fromName: "Top Cash Cellular",
        role: "system",
        body: leadBody,
        tags: ["lead", "buyback"],
        priority: "urgent",
      }),
    });
  } catch { /* silent */ }

  return NextResponse.json({ ok: true });
}
