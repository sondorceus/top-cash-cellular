import { NextRequest, NextResponse } from "next/server";

const MC_API = "https://missioncontrolsdjg-production.up.railway.app";
const MC_KEY = process.env.MC_API_KEY || "";
const ADMIN_TOKEN = process.env.TCC_ADMIN_TOKEN || "topcash-admin-2026";

// Admin leads dashboard backend.
// Pulls last ~300 MC comms, extracts [NEW BUYBACK LEAD] messages, joins
// each with its most recent [STATUS: <status>] reply (matched by lead id),
// and returns the 50 most recent leads with current status.

interface AdminLead {
  id: string;
  timestamp: string;
  name?: string;
  phone?: string;
  email?: string;
  device?: string;
  model?: string;
  storage?: string;
  condition?: string;
  quote?: string;
  payout?: string;
  imei?: string;
  imeiWarnings?: string[];
  photos?: string[];
  status: string;
  statusUpdatedAt?: string;
}

const STATUSES = ["quote_requested", "shipped", "received", "tested", "paid", "rejected"];

function parseField(body: string, key: string): string | undefined {
  const m = body.match(new RegExp(`${key}:\\s*([^\\n]+)`, "i"));
  return m ? m[1].trim() : undefined;
}

function checkAuth(req: NextRequest): boolean {
  const headerToken = req.headers.get("x-admin-token");
  const queryToken = req.nextUrl.searchParams.get("token");
  return headerToken === ADMIN_TOKEN || queryToken === ADMIN_TOKEN;
}

export async function GET(req: NextRequest) {
  if (!checkAuth(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const r = await fetch(`${MC_API}/api/comms?limit=300`, {
    headers: { "x-api-key": MC_KEY },
    cache: "no-store",
  });
  if (!r.ok) {
    return NextResponse.json({ error: "MC unavailable" }, { status: 502 });
  }
  const data = await r.json();
  const messages: { id: string; body?: string; timestamp: string }[] = data.messages || [];

  // Pass 1: index status updates by lead id.
  // Status post format: "[STATUS: <status>] [LEAD: <leadId>]"
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

  // Pass 2: collect leads.
  const leads: AdminLead[] = [];
  for (const m of messages) {
    if (!m.body || !m.body.includes("[NEW BUYBACK LEAD]")) continue;
    const deviceLine = parseField(m.body, "Device");
    const status = statusByLead.get(m.id);
    const photosLine = parseField(m.body, "Photos");
    const photos = photosLine ? photosLine.split(" | ").map((s) => s.trim()).filter(Boolean) : undefined;
    const warningsMatch = m.body.match(/\[IMEI WARNINGS\]\s*([^\n]+)/i);
    const imeiWarnings = warningsMatch ? warningsMatch[1].split(" | ").map((s) => s.trim()).filter(Boolean) : undefined;
    leads.push({
      id: m.id,
      timestamp: m.timestamp,
      name: parseField(m.body, "Name"),
      phone: parseField(m.body, "Phone"),
      email: parseField(m.body, "Email"),
      device: deviceLine?.split(" — ")[0],
      model: deviceLine?.split(" — ")[1],
      storage: parseField(m.body, "Storage"),
      condition: parseField(m.body, "Condition"),
      quote: parseField(m.body, "Quote") || parseField(m.body, "Offer"),
      payout: parseField(m.body, "Payout"),
      imei: parseField(m.body, "IMEI"),
      imeiWarnings,
      photos,
      status: status?.status || "quote_requested",
      statusUpdatedAt: status?.timestamp,
    });
  }

  leads.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  return NextResponse.json({ leads: leads.slice(0, 50), count: leads.length });
}
