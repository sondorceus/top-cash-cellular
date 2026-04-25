import { NextRequest, NextResponse } from "next/server";

const MC_API = "https://missioncontrolsdjg-production.up.railway.app";
const MC_KEY = process.env.MC_API_KEY || "";
const TWILIO_SID = process.env.TWILIO_ACCOUNT_SID || "";
const TWILIO_AUTH = process.env.TWILIO_AUTH_TOKEN || "";
const TWILIO_FROM = process.env.TWILIO_PHONE || "+18775492056";
const OWNER_PHONE = process.env.OWNER_PHONE || "+15129609256";

// Lead dedup: track recent submissions to prevent duplicates
const recentLeads = new Map<string, number>();
const DEDUP_WINDOW_MS = 60 * 1000; // 60 seconds

function isDuplicate(email: string, model: string): boolean {
  const key = `${(email || "").toLowerCase()}|${(model || "").toLowerCase()}`;
  const now = Date.now();
  const lastSeen = recentLeads.get(key);
  if (lastSeen && (now - lastSeen) < DEDUP_WINDOW_MS) return true;
  recentLeads.set(key, now);
  // Cleanup old entries every 50 leads
  if (recentLeads.size > 50) {
    for (const [k, t] of recentLeads) {
      if (now - t > DEDUP_WINDOW_MS * 5) recentLeads.delete(k);
    }
  }
  return false;
}

export async function POST(req: NextRequest) {
  const data = await req.json();
  const { name, phone, email, device, model, storage, condition, quote, payout, photos } = data;
  if (!name || (!phone && !email)) return NextResponse.json({ error: "Name and contact info required" }, { status: 400 });

  // Dedup check — skip if same email+model submitted within 60s
  if (isDuplicate(email, model)) {
    return NextResponse.json({ ok: true, deduped: true });
  }

  const photoLines = (photos as string[] | undefined)?.length
    ? [`Photos: ${(photos as string[]).join(" | ")}`]
    : [];

  const leadBody = [
    `[NEW BUYBACK LEAD]`,
    `Name: ${name}`,
    `Phone: ${phone}`,
    email ? `Email: ${email}` : null,
    `Device: ${device} — ${model}`,
    storage ? `Storage: ${storage}` : null,
    `Condition: ${condition}`,
    quote ? `Quote: $${quote}` : `Quote: TBD (custom)`,
    `Payout: ${payout}`,
    ...photoLines,
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
  } catch {}

  if (TWILIO_SID && TWILIO_AUTH) {
    const photoNote = (photos as string[] | undefined)?.length ? ` Photos: ${(photos as string[])[0]}` : "";
    const ownerSms = `NEW LEAD: ${name} wants to sell ${model} (${condition})${quote ? ` for $${quote}` : " — custom quote needed"}. Phone: ${phone || "N/A"} Email: ${email || "N/A"}${photoNote}`;
    try {
      await fetch(`https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`, {
        method: "POST",
        headers: {
          "Authorization": "Basic " + Buffer.from(`${TWILIO_SID}:${TWILIO_AUTH}`).toString("base64"),
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({ To: OWNER_PHONE, From: TWILIO_FROM, Body: ownerSms }),
      });
    } catch {}
  }

  return NextResponse.json({ ok: true });
}
