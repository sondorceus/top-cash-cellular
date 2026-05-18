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
  // FedEx label info — only ship-handoff leads. Parsed from the
  // [LABEL: leadId] marker that /api/lead writes to MC when a label
  // is minted at submission time. Skywalker 2026-05-17 #2 "lost-
  // label recovery" — customers who lose the email need a way to
  // self-serve.
  fedexTracking?: string;
  fedexLabelUrl?: string;
  fedexService?: string;
  // True for ship-handoff leads that should have a label but the
  // marker is missing — surfaces a "label is on the way / contact
  // staff" message so the customer doesn't see silence.
  shipExpectingLabel?: boolean;
}

const STATUSES = ["quote_requested", "shipped", "received", "tested", "paid", "rejected"];

function normalizePhone(p: string): string {
  return p.replace(/\D/g, "").replace(/^1/, "");
}

function parseField(body: string, key: string): string | undefined {
  // Anchor to line-start; only inline whitespace after the key. Avoids
  // \s* (which includes \n) swallowing the next field when the value
  // is empty. See app/api/admin/leads/route.ts for full bug context.
  const m = body.match(new RegExp(`(?:^|\\n)${key}:[ \\t]*([^\\n]*)`, "i"));
  if (!m) return undefined;
  const v = m[1].trim();
  return v || undefined;
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
  // Pass 1.5: collect FedEx label info by lead id (most recent wins).
  const labelByLead = new Map<string, { tracking: string; url: string; service?: string; timestamp: string }>();
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
    // [LABEL: leadId] tracking=... url=... service=...
    const labelHead = m.body.match(/\[LABEL:\s*([\w-]+)\]/i);
    if (labelHead) {
      const leadId = labelHead[1];
      const tracking = m.body.match(/tracking=([^\s\n]+)/i)?.[1];
      const url = m.body.match(/url=([^\s\n]+)/i)?.[1];
      const service = m.body.match(/service=([^\s\n]+)/i)?.[1];
      if (tracking && url) {
        const existing = labelByLead.get(leadId);
        if (!existing || m.timestamp > existing.timestamp) {
          labelByLead.set(leadId, { tracking, url, service, timestamp: m.timestamp });
        }
      }
    }
  }

  // Pass 2: collect leads matching this contact.
  const leads: TrackedLead[] = [];
  for (const m of messages) {
    if (!m.body) continue;
    const body = m.body;
    // Match single-device "[NEW BUYBACK LEAD]" AND multi-device
    // "[NEW BUYBACK LEAD — N DEVICES]" (Skywalker 2026-05-17 fix —
    // same literal-substring bug that hid multi-device leads from
    // the admin feed; cddb81e was the parallel admin fix).
    const isBuyback = /\[NEW BUYBACK LEAD(\b| — \d+ DEVICES\])/i.test(body);
    const isChat = body.includes("[CHAT LEAD]");
    if (!isBuyback && !isChat) continue;
    const bodyLower = body.toLowerCase();
    const phoneMatch = normPhone && normalizePhone(body).includes(normPhone);
    const emailMatch = normEmail && bodyLower.includes(normEmail);
    if (!phoneMatch && !emailMatch) continue;

    const deviceLine = parseField(body, "Device");
    const status = statusByLead.get(m.id);
    const label = labelByLead.get(m.id);
    // Ship-handoff leads include "Handoff: Ship via FedEx" (or
    // "Shipping" in the multi-device summary). Used to flag the
    // "label expected but not posted yet" state so customers don't
    // get silence.
    const isShipHandoff = /handoff:\s*ship/i.test(body) || /handoff:\s*shipping/i.test(body);
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
      fedexTracking: label?.tracking,
      fedexLabelUrl: label?.url,
      fedexService: label?.service,
      shipExpectingLabel: isShipHandoff && !label,
    });
  }

  if (leads.length === 0) {
    return NextResponse.json({ found: false });
  }

  leads.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  return NextResponse.json({ found: true, leads });
}
