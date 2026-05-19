import { NextRequest, NextResponse } from "next/server";

const MC_API = "https://missioncontrolsdjg-production.up.railway.app";
const MC_KEY = process.env.MC_API_KEY || "";

// Returning-customer lookup. Given a phone OR email, scan recent MC comms
// for past lead submissions matching that contact, and return a summary
// (name, last quote, devices traded). No password — just contact recall.
//
// Past leads are written by /api/lead/route.ts as comms messages with body
// starting "[NEW BUYBACK LEAD]" containing Name/Phone/Email/Device/Quote lines.

interface PastLead {
  name?: string;
  device?: string;
  model?: string;
  storage?: string;
  condition?: string;
  quote?: string;
  payout?: string;
  timestamp: string;
}

function normalizePhone(p: string): string {
  return p.replace(/\D/g, "").replace(/^1/, "");
}

function parseLeadBody(body: string, timestamp: string): PastLead | null {
  if (!body.includes("[NEW BUYBACK LEAD]") && !body.includes("[CHAT LEAD]")) return null;
  const get = (key: string) => {
    // Anchor to line-start; only inline whitespace ([ \t]*) after the key.
    // Avoids \s* (which includes \n) swallowing the next field when value
    // is empty. See app/api/admin/leads/route.ts for full bug context.
    const m = body.match(new RegExp(`(?:^|\\n)${key}:[ \\t]*([^\\n]*)`, "i"));
    if (!m) return undefined;
    const v = m[1].trim();
    return v || undefined;
  };
  return {
    name: get("Name"),
    device: get("Device")?.split(" — ")[0],
    model: get("Device")?.split(" — ")[1],
    storage: get("Storage"),
    condition: get("Condition"),
    quote: get("Quote") || get("Offer"),
    payout: get("Payout"),
    timestamp,
  };
}

export async function POST(req: NextRequest) {
  let payload: { phone?: unknown; email?: unknown };
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const phone = typeof payload.phone === "string" ? payload.phone : "";
  const email = typeof payload.email === "string" ? payload.email : "";
  if (!phone && !email) {
    return NextResponse.json({ error: "Phone or email required" }, { status: 400 });
  }

  const normPhone = phone ? normalizePhone(phone) : "";
  const normEmail = email ? email.toLowerCase().trim() : "";
  // Privacy guard: a too-short normalized phone or email lets the
  // substring match in pass 2 leak OTHER customers' leads (e.g. a phone
  // of "5" matches every lead body containing a 5). Same fix as
  // /api/track. Require a full 10-digit phone or a structurally-valid
  // email before scanning MC comms.
  const phoneOk = !normPhone || normPhone.length >= 10;
  const emailOk = !normEmail || (normEmail.length >= 5 && normEmail.includes("@") && normEmail.indexOf("@") > 0);
  if (!phoneOk || !emailOk) {
    return NextResponse.json({ error: "Enter a full phone number or email address." }, { status: 400 });
  }
  if (!normPhone && !normEmail) {
    return NextResponse.json({ error: "Phone or email required" }, { status: 400 });
  }

  // Pull recent MC comms (last ~500 — enough to cover months of leads)
  const r = await fetch(`${MC_API}/api/comms?limit=500`, {
    headers: { "x-api-key": MC_KEY },
  });
  if (!r.ok) {
    return NextResponse.json({ error: "Lookup service unavailable" }, { status: 502 });
  }
  const data = await r.json();
  const messages: { body?: string; timestamp: string }[] = data.messages || [];

  // Filter messages whose body contains the phone or email
  const matched: PastLead[] = [];
  for (const m of messages) {
    if (!m.body) continue;
    const body = m.body;
    const bodyLower = body.toLowerCase();
    const phoneMatch = normPhone && normalizePhone(body).includes(normPhone);
    const emailMatch = normEmail && bodyLower.includes(normEmail);
    if (!phoneMatch && !emailMatch) continue;
    const lead = parseLeadBody(body, m.timestamp);
    if (lead) matched.push(lead);
  }

  if (matched.length === 0) {
    return NextResponse.json({ found: false });
  }

  // Sort newest first
  matched.sort((a, b) => b.timestamp.localeCompare(a.timestamp));

  return NextResponse.json({
    found: true,
    name: matched[0].name,
    lastQuote: matched[0].quote,
    leadCount: matched.length,
    leads: matched.slice(0, 10), // cap at 10 most recent
  });
}
