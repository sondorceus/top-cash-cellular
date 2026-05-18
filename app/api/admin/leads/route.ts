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
  devices?: Array<{
    model: string;
    storage?: string;
    condition?: string;
    quote?: number;
    quantity?: number;
    photos?: string[];
    // Per-device specs surfaced from the indented lines under each
    // device entry in the lead body. Lets staff price each unit in a
    // bundled trade without flying blind.
    carrier?: string;
    connectivity?: string;
    processor?: string;
    memory?: string;
    graphics?: string;
    displayResolution?: string;
    displayGlass?: string;
    batteryHealth?: string;
    charger?: string;
    extras?: string[];
    brokenGlass?: "front" | "back" | "both" | null;
    brokenFunctional?: boolean | null;
    paidOff?: boolean | null;
    imei?: string;
  }>;
  deviceCount?: number;
  totalPayout?: number;
  // Soft-trash metadata. Populated for leads in the Trash view. The
  // hoursToAutoPurge field counts down from 24h since deletedAt.
  // Skywalker 2026-05-17: "next time save my quotes for 24hr".
  deletedAt?: string;
  hoursToAutoPurge?: number;
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
  // Handoff details parsed out of /api/lead's body. Staff needs these to
  // know whether to print a shipping label or text the seller about a
  // meetup. Skywalker 2026-05-17.
  handoffMethod?: "ship" | "local";
  shipAddress?: string;
  shipPackaging?: string;
  localArea?: string;
  localSlot?: string;
  handoffAction?: string;
  // FedEx label info, populated from [LABEL: <leadId>] markers in MC.
  // Surfaces the latest label per lead (regenerate-friendly).
  fedexTracking?: string;
  fedexLabelUrl?: string;
  fedexService?: string;
}

// Includes "met" (in-person handoff terminal) alongside "paid" (digital
// payout terminal) — Skywalker 2026-05-17.
const STATUSES = ["quote_requested", "shipped", "received", "tested", "paid", "met", "rejected"];

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

  // Bumped 300 → 1000 so lead backlog of 100+ stays addressable. Each
  // lead can have status / note / delete / restore comms in addition to
  // the original [NEW BUYBACK LEAD], so 300 was running thin.
  const r = await fetch(`${MC_API}/api/comms?limit=1000`, {
    headers: { "x-api-key": MC_KEY },
    cache: "no-store",
  });
  if (!r.ok) {
    return NextResponse.json({ error: "MC unavailable" }, { status: 502 });
  }
  const data = await r.json();
  const messages: { id: string; body?: string; timestamp: string }[] = data.messages || [];

  // Pass 1: index status updates + notes + soft-deletes + restores by lead id.
  // Status post format:  "[STATUS: <status>] [LEAD: <leadId>]"
  // Note post format:    "[NOTE: <text>] [LEAD: <leadId>]"
  // Delete marker:       "[DELETED-LEAD: <leadId>] [REASON: <opt>]"
  // Restore marker:      "[RESTORED-LEAD: <leadId>]"
  //
  // Trash semantics (Skywalker 2026-05-17 "save my quotes for 24hr"):
  // For each leadId we keep the MOST RECENT delete or restore. If the
  // latest event is a delete and it's within 24h, the lead is "in trash"
  // (recoverable). If the latest is a delete >24h ago, the lead is
  // hard-purged from the feed entirely. If the latest is a restore, the
  // lead is active again.
  const statusByLead = new Map<string, { status: string; timestamp: string }>();
  const notesByLead = new Map<string, { text: string; timestamp: string }[]>();
  // Latest FedEx label per lead. We keep only the most recent so
  // regenerating overrides the prior label on the UI.
  const labelByLead = new Map<string, { tracking: string; url: string; service?: string; timestamp: string }>();
  const deletedAtByLead = new Map<string, string>();  // most-recent deletion timestamp
  const restoredAtByLead = new Map<string, string>(); // most-recent restore timestamp
  for (const m of messages) {
    if (!m.body) continue;
    const dm = m.body.match(/\[DELETED-LEAD:\s*([\w-]+)\]/i);
    if (dm) {
      const id = dm[1];
      const prev = deletedAtByLead.get(id);
      if (!prev || m.timestamp > prev) deletedAtByLead.set(id, m.timestamp);
    }
    const rm = m.body.match(/\[RESTORED-LEAD:\s*([\w-]+)\]/i);
    if (rm) {
      const id = rm[1];
      const prev = restoredAtByLead.get(id);
      if (!prev || m.timestamp > prev) restoredAtByLead.set(id, m.timestamp);
    }
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
    // FedEx label marker: "[LABEL: <leadId>] tracking=X url=Y service=Z"
    const lblMarker = m.body.match(/\[LABEL:\s*([\w-]+)\]/i);
    if (lblMarker && lblMarker[1] === leadId) {
      const t = m.body.match(/tracking=([^\s]+)/i)?.[1];
      const u = m.body.match(/url=([^\s]+)/i)?.[1];
      const sv = m.body.match(/service=([^\s]+)/i)?.[1];
      if (t && u) {
        const prev = labelByLead.get(leadId);
        if (!prev || m.timestamp > prev.timestamp) {
          labelByLead.set(leadId, { tracking: t, url: u, service: sv, timestamp: m.timestamp });
        }
      }
    }
  }

  // Determine each lead's bucket — active / trashed (recoverable) / purged.
  const TRASH_TTL_MS = 24 * 60 * 60 * 1000;
  const nowMs = Date.now();
  const view = (req.nextUrl.searchParams.get("view") || "active").toLowerCase(); // active | trash | all
  function bucketFor(leadId: string): { kind: "active" } | { kind: "trashed"; deletedAt: string; hoursLeft: number } | { kind: "purged" } {
    const delAt = deletedAtByLead.get(leadId);
    const resAt = restoredAtByLead.get(leadId);
    if (!delAt) return { kind: "active" };
    // Restored after the last delete → active again.
    if (resAt && resAt > delAt) return { kind: "active" };
    const ageMs = nowMs - new Date(delAt).getTime();
    if (ageMs >= TRASH_TTL_MS) return { kind: "purged" };
    return { kind: "trashed", deletedAt: delAt, hoursLeft: Math.max(0, Math.round((TRASH_TTL_MS - ageMs) / (60 * 60 * 1000))) };
  }

  // Pass 2: collect leads.
  const leads: AdminLead[] = [];
  for (const m of messages) {
    // Match BOTH the single-device header "[NEW BUYBACK LEAD]" AND
    // the multi-device header "[NEW BUYBACK LEAD — N DEVICES]".
    // Skywalker 2026-05-17: multi-device leads were getting skipped
    // because the literal includes() check missed them.
    if (!m.body || !/\[NEW BUYBACK LEAD(\b| — \d+ DEVICES\])/i.test(m.body)) continue;
    // Bucket the lead. `view` controls which buckets are included:
    //   active (default) → only active leads
    //   trash            → only trashed-within-24h leads (with metadata)
    //   all              → active + trashed
    // Purged (>24h since delete) leads never surface in any view.
    const bucket = bucketFor(m.id);
    if (bucket.kind === "purged") continue;
    if (view === "active" && bucket.kind !== "active") continue;
    if (view === "trash"  && bucket.kind !== "trashed") continue;
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
      // Split the body into lines so we can walk each indented device
      // entry + grab the indented spec lines that follow it (Chip / RAM
      // / Battery / Photos / etc.) until the next numbered device or the
      // "Total payout" footer.
      const bodyLines = m.body.split("\n");
      const deviceLineRe = /^\s{2,4}(\d+)\.\s+([^·\n]+?)(?:\s·\s+([^·\n]+?))?(?:\s·\s+([^·\n$]+?))?(?:\s·\s+\$([0-9,]+))?(?:\s+\(×(\d+)\))?\s*$/;
      const specLineRe = /^\s{4,}([A-Z][^:]+):\s*(.+)$/;
      devices = [];
      let current: NonNullable<AdminLead["devices"]>[number] | null = null;
      const flush = () => { if (current) devices!.push(current); current = null; };
      for (const line of bodyLines) {
        const dm = line.match(deviceLineRe);
        if (dm) {
          flush();
          const [, , dLabel, dStorage, dCondition, dQuoteStr, dQtyStr] = dm;
          current = {
            model: dLabel.trim(),
            storage: dStorage?.trim() || undefined,
            condition: dCondition?.trim() || undefined,
            quote: dQuoteStr ? parseInt(dQuoteStr.replace(/,/g, ""), 10) : undefined,
            quantity: dQtyStr ? parseInt(dQtyStr, 10) : undefined,
          };
          continue;
        }
        if (!current) continue;
        // Footer terminates the per-device block.
        if (/^Total payout:/.test(line)) { flush(); break; }
        const sm = line.match(specLineRe);
        if (!sm) continue;
        const key = sm[1].trim().toLowerCase();
        const val = sm[2].trim();
        switch (key) {
          case "chip":          current.processor = val; break;
          case "ram":           current.memory = val; break;
          case "gpu":           current.graphics = val; break;
          case "display":       current.displayResolution = val; break;
          case "display glass": current.displayGlass = val; break;
          case "battery health":current.batteryHealth = val; break;
          case "charger":       current.charger = val; break;
          case "carrier":       current.carrier = val; break;
          case "connectivity":  current.connectivity = val; break;
          case "imei":          current.imei = val; break;
          case "extras":        current.extras = val.split(",").map((s) => s.trim()).filter(Boolean); break;
          case "balance": {
            const v = val.toLowerCase();
            if (v.includes("not paid")) current.paidOff = false;
            else if (v.includes("fully paid") || v.includes("paid off")) current.paidOff = true;
            break;
          }
          case "broken": {
            const v = val.toLowerCase();
            if (v.includes("not functional")) current.brokenFunctional = false;
            else if (v.includes("still functional")) current.brokenFunctional = true;
            break;
          }
          case "glass": {
            const v = val.toLowerCase();
            if (v.includes("both")) current.brokenGlass = "both";
            else if (v.startsWith("front") || v.includes("front (display)")) current.brokenGlass = "front";
            else if (v.startsWith("back")) current.brokenGlass = "back";
            break;
          }
          case "photos":
            current.photos = val.split(" | ").map((s) => s.trim()).filter(Boolean);
            break;
        }
      }
      flush();
      if (devices.length === 0) devices = undefined;
      const totalMatch = m.body.match(/Total payout:\s*\$([0-9,]+)/);
      if (totalMatch) totalPayout = parseInt(totalMatch[1].replace(/,/g, ""), 10);
    }
    // Handoff method + details. /api/lead writes a header line like
    //   "--- Handoff: SHIPPING ---" or "--- Handoff: LOCAL MEETUP ---"
    // followed by Address/Packaging/Area/Slot/Action lines. Surface the
    // method as a typed enum and each detail as its own field so the
    // admin UI can render them neatly without re-parsing the body.
    let handoffMethod: AdminLead["handoffMethod"] = undefined;
    if (/--- Handoff:\s*SHIPPING/i.test(m.body)) handoffMethod = "ship";
    else if (/--- Handoff:\s*LOCAL MEETUP/i.test(m.body)) handoffMethod = "local";
    const shipAddress = parseField(m.body, "Address");
    const shipPackaging = parseField(m.body, "Packaging");
    const localArea = parseField(m.body, "Area");
    const localSlot = parseField(m.body, "Slot");
    const handoffAction = parseField(m.body, "Action");
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
      deletedAt:        bucket.kind === "trashed" ? bucket.deletedAt : undefined,
      hoursToAutoPurge: bucket.kind === "trashed" ? bucket.hoursLeft : undefined,
      status: status?.status || "quote_requested",
      statusUpdatedAt: status?.timestamp,
      latestNote: latestNote?.text,
      latestNoteAt: latestNote?.timestamp,
      noteCount: notes.length,
      resellEstimate,
      grossMargin,
      marginPercent,
      marginFlag,
      handoffMethod,
      shipAddress,
      shipPackaging,
      localArea,
      localSlot,
      handoffAction,
      fedexTracking: labelByLead.get(m.id)?.tracking,
      fedexLabelUrl: labelByLead.get(m.id)?.url,
      fedexService: labelByLead.get(m.id)?.service,
    });
  }

  leads.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  // Cap raised from 50 → 200 so Skywalker can see the full backlog from
  // the admin without paging. MC returns 300 messages per fetch and most
  // are non-lead chatter, so 200 leaves headroom without breaking the
  // page render.
  return NextResponse.json({ leads: leads.slice(0, 200), count: leads.length });
}
