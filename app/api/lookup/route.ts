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
    const m = body.match(new RegExp(`${key}:\\s*([^\\n]+)`, "i"));
    return m ? m[1].trim() : undefined;
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
  const { phone, email } = await req.json();
  if (!phone && !email) {
    return NextResponse.json({ error: "Phone or email required" }, { status: 400 });
  }

  const normPhone = phone ? normalizePhone(phone) : "";
  const normEmail = email ? email.toLowerCase().trim() : "";

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
