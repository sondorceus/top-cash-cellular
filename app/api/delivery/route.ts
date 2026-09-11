import { NextRequest, NextResponse } from "next/server";
import { notifyOwnerSms } from "../../lib/owner-sms";
import { rateLimit, rateLimitResponse, clientIp } from "../../lib/rate-limit";
import { appendChatMsg, validGoSession } from "../../lib/gochat-store";

const MC_API = "https://missioncontrolsdjg-production.up.railway.app";
const MC_KEY = process.env.MC_API_KEY || "";

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
  // Public, unauthenticated, and fires an owner SMS + MC post per call —
  // throttle it so it can't be looped into an owner-SMS bomb / MC flood.
  const rl = rateLimit(`delivery:${clientIp(req)}`, 8, 60_000);
  if (!rl.ok) return rateLimitResponse(rl.retryAfterMs);

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
  // /go sellers choose right after the lock — the chat session ties the
  // choice to their thread (deep-linkable from the comm, and the reminders
  // cron reads the HANDOFF-CHOICE note to stop nudging). Only ids the /go
  // client can mint are accepted.
  const session = typeof data.session === "string" && validGoSession(data.session) ? data.session : "";

  if (method !== "shipping" && method !== "local") {
    return NextResponse.json({ error: "method must be shipping or local" }, { status: 400 });
  }
  // A contact is required; the name is not — /go collects no name (its lock
  // is one field), and the homepage funnel always sends one anyway.
  if (!phone && !email) {
    return NextResponse.json({ error: "contact required" }, { status: 400 });
  }
  const displayName = name || (session ? "/go seller" : "Seller");

  const lines: string[] = [
    `[DELIVERY OPTION] ${method.toUpperCase()}`,
    `Name: ${displayName}`,
    phone ? `Phone: ${phone}` : null,
    email ? `Email: ${email}` : null,
    model ? `Device: ${model}` : null,
    quote ? `Quote: $${quote}` : null,
    payout ? `Payout: ${payout}` : null,
    session ? `Session: ${session}` : null,
    session ? `Chat: https://topcashcellular.com/admin/chats?session=${session}` : null,
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

  if (session) {
    void appendChatMsg(session, "note", `HANDOFF-CHOICE: ${method === "local" ? "local meetup" : "ship (free label)"} — chosen on /go`);
  }

  const summary = method === "shipping"
    ? `${displayName} chose SHIP ${model || "device"}${address ? ` from ${clean(address?.city, 80) || "?"}, ${clean(address?.state, 2) || "?"} ${clean(address?.zip, 10) || ""}. Send label.` : " — text for the address, then send the label."}`
    : `${displayName} chose LOCAL meetup in ${area || "Austin area"} for ${model || "device"}. Reach out to schedule.`;
  await notifyOwnerSms(`DELIVERY: ${summary}${phone ? ` · ${phone}` : email ? ` · ${email}` : ""}${session ? `\nhttps://topcashcellular.com/admin/chats?session=${session}` : ""}`);

  return NextResponse.json({ ok: true });
}
