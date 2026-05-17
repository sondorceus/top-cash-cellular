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
  carrier?: string;
  quote?: string;
  payout?: string;
  imei?: string;
  imeiWarnings?: string[];
  photos?: string[];
  // Broken-condition detail surfaced from the lead body. Skywalker
  // 2026-05-17 — staff page must show front/back-glass status so the
  // tech knows what damage to expect at handoff.
  brokenGlass?: "front" | "back" | "both" | null;
  brokenFunctional?: boolean | null;
  // Full spec answers from the funnel — surfaced so staff can price
  // accurately without dropping into the body text. Skywalker 2026-05-17.
  processor?: string;
  memory?: string;
  graphics?: string;
  displayResolution?: string;
  displayGlass?: string;
  batteryHealth?: string;
  charger?: string;
  connectivity?: string;
  extras?: string[];
  paidOff?: boolean | null;
  // Multi-device leads — when one lead bundles N items, the indented
  // device block from /api/lead gets parsed here so staff sees each
  // unit without dropping into the raw body. Skywalker 2026-05-17.
  devices?: Array<{ model: string; storage?: string; condition?: string; quote?: number; quantity?: number; photos?: string[] }>;
  deviceCount?: number;
  totalPayout?: number;
  status: string;
  statusUpdatedAt?: string;
  latestNote?: string;
  latestNoteAt?: string;
  noteCount?: number;
  // Margin analysis
  resellEstimate?: number;
  grossMargin?: number;
  marginPercent?: number;
  marginFlag?: string; // "healthy" | "thin" | "low" | "manual"
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

  // Pass 1: index status updates + notes + soft-deletes by lead id.
  // Status post format: "[STATUS: <status>] [LEAD: <leadId>]"
  // Note post format:   "[NOTE: <text>] [LEAD: <leadId>]"
  // Delete marker:      "[DELETED-LEAD: <leadId>] [REASON: <opt>]"
  const statusByLead = new Map<string, { status: string; timestamp: string }>();
  const notesByLead = new Map<string, { text: string; timestamp: string }[]>();
  const deletedLeadIds = new Set<string>();
  for (const m of messages) {
    if (!m.body) continue;
    // Soft-delete marker — collect first so we can skip the corresponding
    // lead in pass 2. Uses its own bracket key (not [LEAD: <id>]) so it
    // doesn't get caught by the status/note loops below.
    const dm = m.body.match(/\[DELETED-LEAD:\s*([\w-]+)\]/i);
    if (dm) deletedLeadIds.add(dm[1]);
    const lm = m.body.match(/\[LEAD:\s*([\w-]+)\]/i);
    if (!lm) continue;
    const leadId = lm[1];
    const sm = m.body.match(/\[STATUS:\s*(\w+)\]/i);
    if (sm && STATUSES.includes(sm[1].toLowerCase())) {
      const existing = statusByLead.get(leadId);
      if (!existing || m.timestamp > existing.timestamp) {
        statusByLead.set(leadId, { status: sm[1].toLowerCase(), timestamp: m.timestamp });
      }
    }
    const nm = m.body.match(/\[NOTE:\s*([^\]]+)\]/i);
    if (nm) {
      const arr = notesByLead.get(leadId) || [];
      arr.push({ text: nm[1].trim(), timestamp: m.timestamp });
      notesByLead.set(leadId, arr);
    }
  }

  // Pass 2: collect leads.
  const leads: AdminLead[] = [];
  for (const m of messages) {
    // Match BOTH the single-device header "[NEW BUYBACK LEAD]" AND
    // the multi-device header "[NEW BUYBACK LEAD — N DEVICES]".
    // Skywalker 2026-05-17: multi-device leads were getting skipped
    // because the literal includes() check missed them.
    if (!m.body || !/\[NEW BUYBACK LEAD(\b| — \d+ DEVICES\])/i.test(m.body)) continue;
    // Skip leads that have been soft-deleted via /api/admin/leads/delete.
    if (deletedLeadIds.has(m.id)) continue;
    const deviceLine = parseField(m.body, "Device");
    const status = statusByLead.get(m.id);
    const photosLine = parseField(m.body, "Photos");
    const photos = photosLine ? photosLine.split(" | ").map((s) => s.trim()).filter(Boolean) : undefined;
    const warningsMatch = m.body.match(/\[IMEI WARNINGS\]\s*([^\n]+)/i);
    const imeiWarnings = warningsMatch ? warningsMatch[1].split(" | ").map((s) => s.trim()).filter(Boolean) : undefined;
    // Parse the broken-condition lines that /api/lead writes into the
    // comms body — "Glass: FRONT|BACK only|BOTH ... cracked" and
    // "Broken: NOT FUNCTIONAL|still functional".
    const glassLine = parseField(m.body, "Glass");
    let brokenGlass: AdminLead["brokenGlass"] = undefined;
    if (glassLine) {
      const g = glassLine.toLowerCase();
      if (g.includes("both")) brokenGlass = "both";
      else if (g.startsWith("front") || g.includes("front (display)")) brokenGlass = "front";
      else if (g.startsWith("back")) brokenGlass = "back";
    }
    const brokenLine = parseField(m.body, "Broken");
    let brokenFunctional: AdminLead["brokenFunctional"] = undefined;
    if (brokenLine) {
      const b = brokenLine.toLowerCase();
      if (b.includes("not functional")) brokenFunctional = false;
      else if (b.includes("still functional")) brokenFunctional = true;
    }
    const extrasLine = parseField(m.body, "Extras");
    const extras = extrasLine ? extrasLine.split(",").map((s) => s.trim()).filter(Boolean) : undefined;
    const balanceLine = parseField(m.body, "Balance");
    let paidOff: AdminLead["paidOff"] = undefined;
    if (balanceLine) {
      const b = balanceLine.toLowerCase();
      if (b.includes("not paid")) paidOff = false;
      else if (b.includes("fully paid") || b.includes("paid off")) paidOff = true;
    }
    // Multi-device parsing — /api/lead writes lines like:
    //   Devices: 3
    //     1. iPhone 17 Pro Max · 256GB · Flawless · $700
    //     2. iPhone 16 · 128GB · Good · $250
    //        Photos: https://... | https://...
    //     3. MacBook Pro 14" M4 · 512GB · Mint · $1000
    //   Total payout: $1950
    let deviceCount: number | undefined = undefined;
    let totalPayout: number | undefined = undefined;
    let devices: AdminLead["devices"] = undefined;
    const devicesHeaderMatch = m.body.match(/^Devices:\s*(\d+)\s*$/m);
    if (devicesHeaderMatch) {
      deviceCount = parseInt(devicesHeaderMatch[1], 10);
      // Lines like "  3. <label> · <storage>? · <condition>? · $<quote>?"
      const deviceLineRe = /^\s{2,4}(\d+)\.\s+([^·\n]+?)(?:\s·\s+([^·\n]+?))?(?:\s·\s+([^·\n$]+?))?(?:\s·\s+\$([0-9,]+))?(?:\s+\(×(\d+)\))?\s*$/gm;
      devices = [];
      let dm: RegExpExecArray | null;
      while ((dm = deviceLineRe.exec(m.body)) !== null) {
        const [, , dLabel, dStorage, dCondition, dQuoteStr, dQtyStr] = dm;
        const idx = devices.length;
        devices.push({
          model: dLabel.trim(),
          storage: dStorage?.trim() || undefined,
          condition: dCondition?.trim() || undefined,
          quote: dQuoteStr ? parseInt(dQuoteStr.replace(/,/g, ""), 10) : undefined,
          quantity: dQtyStr ? parseInt(dQtyStr, 10) : undefined,
        });
        // Look-ahead for the "     Photos: url1 | url2" line that follows.
        const afterLine = m.body.slice(deviceLineRe.lastIndex).split("\n", 1)[0];
        const photosMatch = afterLine.match(/^\s+Photos:\s*(.+)$/);
        if (photosMatch) {
          devices[idx].photos = photosMatch[1].split(" | ").map((s) => s.trim()).filter(Boolean);
        }
      }
      if (devices.length === 0) devices = undefined;
      const totalMatch = m.body.match(/Total payout:\s*\$([0-9,]+)/);
      if (totalMatch) totalPayout = parseInt(totalMatch[1].replace(/,/g, ""), 10);
    }
    const notes = notesByLead.get(m.id) || [];
    notes.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    const latestNote = notes[0];
    // Parse margin data
    const resellStr = parseField(m.body, "Est. resell");
    const resellEstimate = resellStr ? parseInt(resellStr.replace(/[^0-9]/g, "")) || undefined : undefined;
    const grossStr = parseField(m.body, "Gross margin");
    const grossMargin = grossStr ? parseInt(grossStr.replace(/[^0-9-]/g, "")) || undefined : undefined;
    const pctMatch = grossStr?.match(/(\d+)%/);
    const marginPercent = pctMatch ? parseInt(pctMatch[1]) : undefined;
    const marginFlag = m.body.includes("LOW MARGIN") ? "low"
      : m.body.includes("Thin margin") ? "thin"
      : m.body.includes("Healthy margin") ? "healthy"
      : m.body.includes("Manual quote") ? "manual" : undefined;

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
      carrier: parseField(m.body, "Carrier"),
      quote: parseField(m.body, "Quote") || parseField(m.body, "Offer"),
      payout: parseField(m.body, "Payout"),
      imei: parseField(m.body, "IMEI"),
      imeiWarnings,
      photos,
      brokenGlass,
      brokenFunctional,
      processor:         parseField(m.body, "Chip"),
      memory:            parseField(m.body, "RAM"),
      graphics:          parseField(m.body, "GPU"),
      displayResolution: parseField(m.body, "Display"),
      displayGlass:      parseField(m.body, "Display glass"),
      batteryHealth:     parseField(m.body, "Battery health"),
      charger:           parseField(m.body, "Charger"),
      connectivity:      parseField(m.body, "Connectivity"),
      extras,
      paidOff,
      devices,
      deviceCount,
      totalPayout,
      status: status?.status || "quote_requested",
      statusUpdatedAt: status?.timestamp,
      latestNote: latestNote?.text,
      latestNoteAt: latestNote?.timestamp,
      noteCount: notes.length,
      resellEstimate,
      grossMargin,
      marginPercent,
      marginFlag,
    });
  }

  leads.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  return NextResponse.json({ leads: leads.slice(0, 50), count: leads.length });
}
