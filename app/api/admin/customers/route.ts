import { NextRequest, NextResponse } from "next/server";
import { parseDollarAmount, parseTotalPayoutLine } from "../../../lib/lead-money";

const MC_API = "https://missioncontrolsdjg-production.up.railway.app";
const MC_KEY = process.env.MC_API_KEY || "";
const ADMIN_TOKEN = process.env.TCC_ADMIN_TOKEN || (() => { throw new Error("TCC_ADMIN_TOKEN env required"); })();

// Customer-aggregation backend. Scans recent MC comms for [NEW BUYBACK
// LEAD] entries, dedupes them by normalized phone OR lowercased email,
// and rolls up per-customer stats (total leads, total $ quoted, last
// device, last submission, statuses they've passed through).
//
// Same data source as /api/admin/leads — we just collapse the lead view
// into a customer view. No customer DB; everything is computed live from
// the MC feed at request time. Fine until we're north of ~5k leads.

interface CustomerRow {
  contactKey: string;          // canonical identity used for dedup
  name?: string;               // most recent name on file
  phone?: string;
  email?: string;
  leadCount: number;           // total leads from this customer
  totalQuoted: number;         // sum of all quote dollars
  lastDevice?: string;         // most-recent device label
  lastSubmissionAt: string;    // ISO timestamp of most-recent lead
  firstSubmissionAt: string;   // ISO timestamp of earliest lead
  statuses: Record<string, number>; // count by status (paid / met / quote_requested / ...)
  latestStatus?: string;       // status of most-recent lead
  smsOptIn?: boolean;          // most-recent opt-in disposition
  hasReview?: boolean;         // whether at least one lead earned a review
}

function checkAuth(req: NextRequest): boolean {
  const headerToken = req.headers.get("x-admin-token");
  const queryToken = req.nextUrl.searchParams.get("token");
  return headerToken === ADMIN_TOKEN || queryToken === ADMIN_TOKEN;
}

function parseField(body: string, key: string): string | undefined {
  // Anchored to line start, inline whitespace only — same pattern as
  // /api/admin/leads to avoid the regex-bleed bug Skywalker caught on
  // 2026-05-18 where empty fields swallowed the next line's content.
  const re = new RegExp(`(?:^|\\n)${key}:[ \\t]*([^\\n]*)`, "i");
  const m = body.match(re);
  if (!m) return undefined;
  const v = m[1]?.trim();
  return v || undefined;
}

function normalizePhone(p: string | undefined): string {
  if (!p) return "";
  return p.replace(/\D/g, "").replace(/^1/, "");
}

// Money parsers now live in app/lib/lead-money.ts so all 5 sites stay
// in sync (analytics, customers, leads, admin UI, AI summary). Re-exporting
// these locals would be a maintenance trap — call sites use the import.

// Internal identifiers — exclude Skywalker's own testing from the
// customer roster by default. Same source-of-truth as
// /api/admin/leads + /api/admin/analytics.
const INTERNAL_IPS = (process.env.TCC_INTERNAL_IPS || "136.49.4.25").split(",").map((s) => s.trim()).filter(Boolean);
const INTERNAL_EMAILS = (process.env.TCC_INTERNAL_EMAILS || "sondorceus@gmail.com,sellurcell@topcashcells.com").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
function isInternalLead(body: string): boolean {
  const ip = parseField(body, "Source-IP");
  if (ip && INTERNAL_IPS.includes(ip)) return true;
  const em = parseField(body, "Email")?.toLowerCase();
  if (em && INTERNAL_EMAILS.includes(em)) return true;
  return false;
}

export async function GET(req: NextRequest) {
  if (!checkAuth(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const r = await fetch(`${MC_API}/api/comms?limit=1000`, {
    headers: { "x-api-key": MC_KEY },
    cache: "no-store",
  });
  if (!r.ok) {
    return NextResponse.json({ error: "MC unavailable" }, { status: 502 });
  }
  const data = await r.json();
  const messages: { id: string; body?: string; timestamp: string }[] = data.messages || [];

  // Pass 1: index status updates by lead id (so we can attribute each
  // lead's terminal status to its customer roll-up). Status messages have
  // bodies like "[STATUS: paid] [LEAD: leadId]".
  //
  // Trash semantics: a lead is considered "deleted" only if its most
  // recent delete/restore marker is a [DELETED-LEAD:]. Skywalker's flow
  // is trash → restore → trash → restore — without honoring the
  // RESTORED marker the customer rollup permanently loses any lead
  // that was ever trashed even once. Same logic as /api/admin/leads.
  const statusByLead = new Map<string, { status: string; timestamp: string }>();
  const reviewLeads = new Set<string>();
  type Tomb = { deleted: boolean; timestamp: string };
  const tombByLead = new Map<string, Tomb>();
  for (const m of messages) {
    if (!m.body) continue;
    const sm = m.body.match(/\[STATUS:\s*([\w_]+)\]\s*\[LEAD:\s*([\w-]+)\]/i);
    if (sm) {
      const prev = statusByLead.get(sm[2]);
      if (!prev || m.timestamp > prev.timestamp) {
        statusByLead.set(sm[2], { status: sm[1].toLowerCase(), timestamp: m.timestamp });
      }
    }
    const rm = m.body.match(/\[REVIEW-LEFT:\s*([\w-]+)\]/i);
    if (rm) reviewLeads.add(rm[1]);
    const dm = m.body.match(/\[DELETED-LEAD:\s*([\w-]+)\]/i);
    if (dm) {
      const prev = tombByLead.get(dm[1]);
      if (!prev || m.timestamp > prev.timestamp) tombByLead.set(dm[1], { deleted: true, timestamp: m.timestamp });
    }
    const restoreM = m.body.match(/\[RESTORED-LEAD:\s*([\w-]+)\]/i);
    if (restoreM) {
      const prev = tombByLead.get(restoreM[1]);
      if (!prev || m.timestamp > prev.timestamp) tombByLead.set(restoreM[1], { deleted: false, timestamp: m.timestamp });
    }
  }
  const deletedLeads = new Set(Array.from(tombByLead.entries()).filter(([, t]) => t.deleted).map(([id]) => id));

  // Pass 2: walk lead messages, dedup into per-customer rows.
  const internalView = req.nextUrl.searchParams.get("internal") || "hide";
  let internalSkipped = 0;
  const customers = new Map<string, CustomerRow>();
  for (const m of messages) {
    if (!m.body || !m.body.includes("[NEW BUYBACK LEAD")) continue;
    if (deletedLeads.has(m.id)) continue;
    // Recycle-only leads are $0 by definition — they belong on the leads
    // page (with their ♻ chip) but they pollute customer totals if we
    // count them as a "lead with a quote." /analytics already filters
    // these; matching here keeps the two rollups in agreement.
    if ((parseField(m.body, "Recycle-only") || "").toLowerCase() === "yes") continue;
    if (internalView !== "show" && isInternalLead(m.body)) {
      internalSkipped++;
      continue;
    }
    const phoneRaw = parseField(m.body, "Phone");
    const emailRaw = parseField(m.body, "Email")?.toLowerCase();
    const phoneN = normalizePhone(phoneRaw);
    // Identity preference: phone first, then email. A customer who
    // submits once with phone and once with email-only stays separate
    // (no way to link without an account). That's accepted noise.
    const contactKey = phoneN ? `p:${phoneN}` : (emailRaw ? `e:${emailRaw}` : "");
    if (!contactKey) continue;
    const name = parseField(m.body, "Name");
    const device = parseField(m.body, "Device");
    // Prefer multi-device `Total payout:` when present (since the
    // Quote field on those bodies is blank or "—"), else fall back
    // to the single-device Quote/Offer field. Without this the
    // customer rollup understates the totals every time a customer
    // submits more than one device. Skywalker 2026-05-24.
    const totalFromBody = parseTotalPayoutLine(m.body);
    const quote = totalFromBody > 0
      ? totalFromBody
      : parseDollarAmount(parseField(m.body, "Quote") || parseField(m.body, "Offer"));
    const smsRaw = parseField(m.body, "SMS opt-in")?.toLowerCase();
    const smsOptIn = smsRaw === "yes" ? true : smsRaw === "no" ? false : undefined;
    const status = statusByLead.get(m.id)?.status || "quote_requested";

    let row = customers.get(contactKey);
    if (!row) {
      row = {
        contactKey,
        name,
        phone: phoneRaw,
        email: emailRaw,
        leadCount: 0,
        totalQuoted: 0,
        firstSubmissionAt: m.timestamp,
        lastSubmissionAt: m.timestamp,
        statuses: {},
        smsOptIn,
        hasReview: false,
      };
      customers.set(contactKey, row);
    }
    row.leadCount += 1;
    row.totalQuoted += quote;
    // Most-recent fields win on timestamp order
    if (m.timestamp >= row.lastSubmissionAt) {
      row.lastSubmissionAt = m.timestamp;
      row.lastDevice = device;
      row.latestStatus = status;
      if (name) row.name = name;
      if (phoneRaw) row.phone = phoneRaw;
      if (emailRaw) row.email = emailRaw;
      if (smsOptIn !== undefined) row.smsOptIn = smsOptIn;
    }
    if (m.timestamp < row.firstSubmissionAt) {
      row.firstSubmissionAt = m.timestamp;
    }
    row.statuses[status] = (row.statuses[status] || 0) + 1;
    if (reviewLeads.has(m.id)) row.hasReview = true;
  }

  const out = Array.from(customers.values()).sort(
    (a, b) => b.lastSubmissionAt.localeCompare(a.lastSubmissionAt),
  );
  return NextResponse.json({
    customers: out,
    counts: {
      totalCustomers: out.length,
      totalLeads: out.reduce((s, c) => s + c.leadCount, 0),
      totalQuoted: out.reduce((s, c) => s + c.totalQuoted, 0),
    },
    internalHidden: internalSkipped,
  });
}
