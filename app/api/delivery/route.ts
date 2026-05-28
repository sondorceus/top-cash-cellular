import { NextRequest, NextResponse } from "next/server";

const MC_API = "https://missioncontrolsdjg-production.up.railway.app";
const MC_KEY = process.env.MC_API_KEY || "";
const TWILIO_SID = process.env.TWILIO_ACCOUNT_SID || "";
const TWILIO_AUTH = process.env.TWILIO_AUTH_TOKEN || "";
const TWILIO_FROM = process.env.TWILIO_PHONE || "";
const OWNER_PHONE = process.env.OWNER_PHONE || "+15129609256";

// Fires after the lead has already been submitted — captures the customer's
// chosen delivery method (ship vs local meetup) and the supporting details
// (mailing address or Austin sub-area). Posts a [DELIVERY] follow-up to MC
// comms so the operator can act, and pings the owner via SMS.

// Strip square brackets + bound length on every customer-supplied
// field before interpolating into the MC comm body. The admin lead
// parser keys on `[NEW BUYBACK LEAD]` and `[STATUS:]` markers anywhere
// in any comm body — without this sanitization an attacker hitting
// /api/delivery with `name: "[NEW BUYBACK LEAD]\nName: Fake..."` would
// spoof a lead into the admin panel. Same defuse pattern as /api/chat.
function clean(s: unknown, max = 200): string {
  if (typeof s !== "string") return "";
  return s.replace(/[\[\]]/g, "").slice(0, max);
}

export async function POST(req: NextRequest) {
  let data: Record<string, unknown>;
  try {
    data = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const method = typeof data.method === "string" ? data.method : "";
  const name = clean(data.name, 100);
  const phone = clean(data.phone, 30);
  const email = clean(data.email, 200);
  const model = clean(data.model, 100);
  const quote = clean(data.quote, 20);
  const payout = clean(data.payout, 80);
  const address = (typeof data.address === "object" && data.address) ? data.address as Record<string, unknown> : null;
  const area = clean(data.area, 80);

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
    const street = clean(address.street, 120);
    const unit = clean(address.unit, 40);
    const city = clean(address.city, 80);
    const state = clean(address.state, 2);
    const zip = clean(address.zip, 10);
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
      ? `${name} chose SHIP ${model || "device"} from ${clean(address?.city, 80) || "?"}, ${clean(address?.state, 2) || "?"} ${clean(address?.zip, 10) || ""}. Send label.`
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
