import { NextRequest, NextResponse } from "next/server";

const MC_API = "https://missioncontrolsdjg-production.up.railway.app";
const MC_KEY = process.env.MC_API_KEY || "";
const TWILIO_SID = process.env.TWILIO_ACCOUNT_SID || "";
const TWILIO_AUTH = process.env.TWILIO_AUTH_TOKEN || "";
const TWILIO_FROM = process.env.TWILIO_PHONE || "+18775492056";
const OWNER_PHONE = process.env.OWNER_PHONE || "+15129609256";

// Fires after the lead has already been submitted — captures the customer's
// chosen delivery method (ship vs local meetup) and the supporting details
// (mailing address or Austin sub-area). Posts a [DELIVERY] follow-up to MC
// comms so the operator can act, and pings the owner via SMS.
export async function POST(req: NextRequest) {
  const data = await req.json();
  const {
    method, // "shipping" | "local"
    name, phone, email,
    model, quote, payout,
    address, // { street, unit, city, state, zip }
    area,    // string label e.g. "South Austin", "Round Rock"
  } = data;

  if (method !== "shipping" && method !== "local") {
    return NextResponse.json({ error: "method must be shipping or local" }, { status: 400 });
  }
  if (!name || (!phone && !email)) {
    return NextResponse.json({ error: "name + contact required" }, { status: 400 });
  }

  const lines: string[] = [
    `[DELIVERY OPTION] ${method.toUpperCase()}`,
    `Name: ${name}`,
    phone ? `Phone: ${phone}` : null,
    email ? `Email: ${email}` : null,
    model ? `Device: ${model}` : null,
    quote ? `Quote: $${quote}` : null,
    payout ? `Payout: ${payout}` : null,
  ].filter(Boolean) as string[];

  if (method === "shipping" && address) {
    const { street, unit, city, state, zip } = address as Record<string, string>;
    lines.push("--- Shipping Address ---");
    lines.push(`${street}${unit ? `, ${unit}` : ""}`);
    lines.push(`${city}, ${state} ${zip}`);
    lines.push("Action: Generate FedEx prepaid label and email to customer (auto-fires on submit; staff regenerate via /admin if needed).");
  }
  if (method === "local" && area) {
    lines.push(`Meetup area: ${area}`);
    lines.push("Action: Reach out to schedule a local Austin meetup.");
  }

  try {
    await fetch(`${MC_API}/api/comms`, {
      method: "POST",
      headers: { "x-api-key": MC_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "topcash-web",
        fromName: "Top Cash Cellular",
        role: "system",
        body: lines.join("\n"),
        tags: ["lead", "delivery", method],
        priority: "urgent",
      }),
    });
  } catch {}

  if (TWILIO_SID && TWILIO_AUTH) {
    const summary = method === "shipping"
      ? `${name} chose SHIP ${model || "device"} from ${address?.city || "?"}, ${address?.state || "?"} ${address?.zip || ""}. Send label.`
      : `${name} chose LOCAL meetup in ${area || "Austin area"} for ${model || "device"}. Reach out to schedule.`;
    try {
      await fetch(`https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`, {
        method: "POST",
        headers: {
          "Authorization": "Basic " + Buffer.from(`${TWILIO_SID}:${TWILIO_AUTH}`).toString("base64"),
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({ To: OWNER_PHONE, From: TWILIO_FROM, Body: `DELIVERY: ${summary}` }),
      });
    } catch {}
  }

  return NextResponse.json({ ok: true });
}
