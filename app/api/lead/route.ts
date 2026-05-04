import { NextRequest, NextResponse } from "next/server";

const MC_API = "https://missioncontrolsdjg-production.up.railway.app";
const MC_KEY = process.env.MC_API_KEY || "";
const TWILIO_SID = process.env.TWILIO_ACCOUNT_SID || "";
const TWILIO_AUTH = process.env.TWILIO_AUTH_TOKEN || "";
const TWILIO_FROM = process.env.TWILIO_PHONE || "+18775492056";
const OWNER_PHONE = process.env.OWNER_PHONE || "+15129609256";

// Lead dedup: track recent submissions to prevent duplicates.
// Custom-quote flows (no instant price) get a wider window keyed on
// device-category + email — this catches the case where a user re-submits
// the same kind of device with a tweaked free-text description.
const recentLeads = new Map<string, number>();
const DEDUP_REGULAR_MS = 60 * 1000; // 60s for instant-quote flows
const DEDUP_CUSTOM_MS = 5 * 60 * 1000; // 5min for custom-quote flows

function isDuplicate(email: string, contact: string, device: string, model: string, isCustom: boolean): boolean {
  const e = (email || "").toLowerCase().trim();
  const c = (contact || "").replace(/\D/g, "");
  // For custom flows: key on device-category only (Tablet/Desktop/etc.) so
  // free-text condition tweaks dedupe. For regular flows: key on full model.
  const productKey = isCustom ? (device || "").toLowerCase() : (model || "").toLowerCase();
  const key = `${e || c}|${productKey}|${isCustom ? "custom" : "regular"}`;
  const window = isCustom ? DEDUP_CUSTOM_MS : DEDUP_REGULAR_MS;
  const now = Date.now();
  const lastSeen = recentLeads.get(key);
  if (lastSeen && (now - lastSeen) < window) return true;
  recentLeads.set(key, now);
  if (recentLeads.size > 50) {
    for (const [k, t] of recentLeads) {
      if (now - t > DEDUP_CUSTOM_MS * 2) recentLeads.delete(k);
    }
  }
  return false;
}

export async function POST(req: NextRequest) {
  const data = await req.json();
  const { name, phone, email, device, model, storage, condition, quote, payout, photos } = data;
  if (!name || (!phone && !email)) return NextResponse.json({ error: "Name and contact info required" }, { status: 400 });

  // Dedup check — wider window for custom-quote flows (free-text descriptions)
  const isCustom = !quote || quote === 0 || quote === "0";
  if (isDuplicate(email, phone, device, model, isCustom)) {
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
