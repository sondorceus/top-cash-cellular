import { NextRequest, NextResponse } from "next/server";

const MC_API = "https://missioncontrolsdjg-production.up.railway.app";
const MC_KEY = process.env.MC_API_KEY || "";

// Customer-facing order-tracking endpoint. Given a phone or email, scan
// recent MC comms for that customer's [NEW BUYBACK LEAD] entries, join
// each with its most recent [STATUS: <status>] [LEAD: <id>] reply, and
// return enriched leads. Public — no auth — identity is the contact itself.

interface TrackedLead {
  id: string;
  timestamp: string;
  device?: string;
  model?: string;
  storage?: string;
  condition?: string;
  quote?: string;
  payout?: string;
  status: string;
  statusUpdatedAt?: string;
}

const STATUSES = ["quote_requested", "shipped", "received", "tested", "paid", "rejected"];

function normalizePhone(p: string): string {
  return p.replace(/\D/g, "").replace(/^1/, "");
}

function parseField(body: string, key: string): string | undefined {
  const m = body.match(new RegExp(`${key}:\\s*([^\\n]+)`, "i"));
  return m ? m[1].trim() : undefined;
}

export async function POST(req: NextRequest) {
  const { phone, email } = await req.json();
  if (!phone && !email) {
    return NextResponse.json({ error: "Phone or email required" }, { status: 400 });
  }

  const normPhone = phone ? normalizePhone(phone) : "";
  const normEmail = email ? email.toLowerCase().trim() : "";

  const r = await fetch(`${MC_API}/api/comms?limit=500`, {
    headers: { "x-api-key": MC_KEY },
    cache: "no-store",
  });
  if (!r.ok) {
    return NextResponse.json({ error: "Tracking service unavailable" }, { status: 502 });
  }
  const data = await r.json();
  const messages: { id: string; body?: string; timestamp: string }[] = data.messages || [];

  // Pass 1: collect status updates by lead id.
  const statusByLead = new Map<string, { status: string; timestamp: string }>();
  for (const m of messages) {
    if (!m.body) continue;
    const sm = m.body.match(/\[STATUS:\s*(\w+)\]/i);
    const lm = m.body.match(/\[LEAD:\s*([\w-]+)\]/i);
    if (sm && lm && STATUSES.includes(sm[1].toLowerCase())) {
      const leadId = lm[1];
      const existing = statusByLead.get(leadId);
      if (!existing || m.timestamp > existing.timestamp) {
        statusByLead.set(leadId, { status: sm[1].toLowerCase(), timestamp: m.timestamp });
      }
    }
  }

  // Pass 2: collect leads matching this contact.
  const leads: TrackedLead[] = [];
  for (const m of messages) {
    if (!m.body) continue;
    const body = m.body;
    if (!body.includes("[NEW BUYBACK LEAD]") && !body.includes("[CHAT LEAD]")) continue;
    const bodyLower = body.toLowerCase();
    const phoneMatch = normPhone && normalizePhone(body).includes(normPhone);
    const emailMatch = normEmail && bodyLower.includes(normEmail);
    if (!phoneMatch && !emailMatch) continue;

    const deviceLine = parseField(body, "Device");
    const status = statusByLead.get(m.id);
    leads.push({
      id: m.id,
      timestamp: m.timestamp,
      device: deviceLine?.split(" — ")[0],
      model: deviceLine?.split(" — ")[1],
      storage: parseField(body, "Storage"),
      condition: parseField(body, "Condition"),
      quote: parseField(body, "Quote") || parseField(body, "Offer"),
      payout: parseField(body, "Payout"),
      status: status?.status || "quote_requested",
      statusUpdatedAt: status?.timestamp,
    });
  }

  if (leads.length === 0) {
    return NextResponse.json({ found: false });
  }

  leads.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  return NextResponse.json({ found: true, leads });
}
