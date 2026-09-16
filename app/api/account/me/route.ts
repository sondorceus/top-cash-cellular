// GET /api/account/me — returns the logged-in customer's identity +
// their trade history (open + past). Accepts either the admin
// tcc_session cookie (Google-verified) or a customer-only tcc_customer
// cookie minted from a verified magic link (see /api/account/login).
//
// Trade list is tagged with current status (parsed from the same
// [STATUS: ...] markers admin/leads uses) so the customer sees if a trade
// is in flight, paid, or returned. It carries payout handles, addresses
// and lead ids, so it is only ever served to a verified owner.
// Skywalker 2026-05-19.

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  getCustomerSessionFromCookies, getProfileFromCookies, getServerSession,
  verifyCustomerSession, CUSTOMER_COOKIE_NAME, type CustomerSessionPayload,
} from "../../../lib/auth";

const MC_API = "https://missioncontrolsdjg-production.up.railway.app";
const MC_KEY = process.env.MC_API_KEY || "";

type Trade = {
  id: string;
  timestamp: string;
  device?: string;
  model?: string;
  storage?: string;
  condition?: string;
  quote?: string;
  payout?: string;
  status: string;
  statusAt?: string;
  // Payout receipt — present once paid/met (parsed from the status
  // marker's Payout-confirmation line). Internal staff note excluded.
  payoutProof?: { method?: string; reference?: string; amount?: number; at?: string };
  handoffMethod?: "ship" | "local";
  fedexTracking?: string;
  // Address used on this trade — surfaced so /account can show a
  // dedup'd "Addresses" section (one entry per unique street+zip).
  address?: { street?: string; unit?: string; city?: string; state?: string; zip?: string };
};

const STATUSES = ["quote_requested", "shipped", "received", "tested", "paid", "met", "rejected"];

function parseField(body: string, key: string): string | undefined {
  const m = body.match(new RegExp(`(?:^|\\n)${key}:[ \\t]*([^\\n]*)`, "i"));
  if (!m) return undefined;
  return m[1].trim() || undefined;
}

export async function GET() {
  const session = await getCustomerSessionFromCookies();
  if (!session) {
    return NextResponse.json({ authenticated: false }, {
      headers: { "Cache-Control": "no-store" },
    });
  }
  // Without a Google tcc_session, the tcc_customer cookie must carry the
  // magic-link mark (`ml`, set by /api/account/login). Cookies from the old
  // login minted a session from a typed email alone and stay signature-
  // valid for 30 days — treat them as signed out (and clear them) so the
  // customer re-verifies through the emailed link.
  if (!(await getServerSession())) {
    const cookieStore = await cookies();
    const cust = verifyCustomerSession(cookieStore.get(CUSTOMER_COOKIE_NAME)?.value) as
      (CustomerSessionPayload & { ml?: unknown }) | null;
    if (!cust || cust.ml !== 1) {
      const res = NextResponse.json({ authenticated: false, reverify: true }, {
        headers: { "Cache-Control": "no-store" },
      });
      res.cookies.set(CUSTOMER_COOKIE_NAME, "", { httpOnly: true, path: "/", maxAge: 0 });
      return res;
    }
  }
  const email = session.email.toLowerCase();
  // Editable profile overlay — when the customer has saved a name /
  // phone from the account-edit form, those win over the auth-cookie
  // name. MC-independent so it always resolves.
  const profile = await getProfileFromCookies();
  const displayName = profile?.name || session.name;
  if (!MC_KEY) {
    // Customer is recognized but we can't pull their trades without
    // MC. Return identity + empty list so the dashboard still renders.
    return NextResponse.json({
      authenticated: true,
      email: session.email,
      name: displayName,
      phone: profile?.phone,
      via: session.via,
      trades: [],
      summary: { total: 0, paid: 0, openCount: 0 },
    }, { headers: { "Cache-Control": "no-store" } });
  }

  // Pull recent MC comms. 800 covers months of history per customer.
  const r = await fetch(`${MC_API}/api/comms?limit=800`, {
    headers: { "x-api-key": MC_KEY },
    cache: "no-store",
  });
  if (!r.ok) {
    return NextResponse.json({ error: "Trade history unavailable" }, { status: 502 });
  }
  const data = await r.json();
  const messages: { id: string; body?: string; timestamp: string }[] = data.messages || [];

  // Pass 1: collect lead messages whose body mentions this customer's
  // email (case-insensitive). Pass 2: pick the most-recent status per
  // lead so the trade list shows live state.
  const trades: Trade[] = [];
  type PayoutProof = { method?: string; reference?: string; amount?: number; at?: string };
  const statusByLead = new Map<string, { status: string; at: string; payoutProof?: PayoutProof }>();
  const labelByLead = new Map<string, string>();
  for (const m of messages) {
    if (!m.body) continue;
    const body = m.body;
    // Status marker
    const sm = body.match(/\[STATUS:\s*(\w+)\]\s*\[LEAD:\s*([\w-]+)\]/i);
    if (sm && STATUSES.includes(sm[1].toLowerCase())) {
      const lid = sm[2];
      const prev = statusByLead.get(lid);
      if (!prev || m.timestamp > prev.at) {
        const st = sm[1].toLowerCase();
        // Parse the customer-safe payout receipt off the freshest paid/met
        // status message (drop the internal `note=` field).
        let payoutProof: PayoutProof | undefined;
        if (st === "paid" || st === "met") {
          const pc = body.match(/Payout-confirmation:\s*([^\n]+)/i)?.[1] || "";
          const method = pc.match(/method=([^·\n]+?)(?:\s*·|$)/i)?.[1]?.trim();
          const reference = pc.match(/ref=([^·\n]+?)(?:\s*·|$)/i)?.[1]?.trim();
          const am = pc.match(/amount=([\d.]+)/i)?.[1];
          const amount = am && Number.isFinite(Number(am)) ? Number(am) : undefined;
          if (method || reference || amount != null) payoutProof = { method, reference, amount, at: m.timestamp };
        }
        statusByLead.set(lid, { status: st, at: m.timestamp, payoutProof });
      }
    }
    // FedEx label marker
    const lblm = body.match(/\[LABEL:\s*([\w-]+)\]\s*tracking=([^\s]+)/i);
    if (lblm) {
      const lid = lblm[1];
      labelByLead.set(lid, lblm[2]);
    }
  }
  for (const m of messages) {
    if (!m.body) continue;
    if (!m.body.includes("[NEW BUYBACK LEAD")) continue;
    // Match the lead's OWN parsed Email: field, not a whole-body substring —
    // a substring hit on a stranger's lead body would expose their trade
    // (IDOR). Same fix as /api/track, /api/lookup, /api/account/login.
    if (((parseField(m.body, "Email") || "").toLowerCase().trim()) !== email) continue;
    const handoffLine = parseField(m.body, "Handoff")?.toLowerCase();
    const handoffMethod: "ship" | "local" | undefined =
      handoffLine?.includes("ship") ? "ship" :
      handoffLine?.includes("local") ? "local" : undefined;
    const status = statusByLead.get(m.id);
    const street = parseField(m.body, "Street");
    const city = parseField(m.body, "City");
    const state = parseField(m.body, "State");
    const zip = parseField(m.body, "Zip") || parseField(m.body, "ZIP");
    trades.push({
      id: m.id,
      timestamp: m.timestamp,
      device: parseField(m.body, "Device"),
      model: parseField(m.body, "Model"),
      storage: parseField(m.body, "Storage"),
      condition: parseField(m.body, "Condition"),
      quote: parseField(m.body, "Quote"),
      payout: parseField(m.body, "Payout"),
      status: status?.status || "quote_requested",
      statusAt: status?.at,
      payoutProof: status?.payoutProof,
      handoffMethod,
      fedexTracking: labelByLead.get(m.id),
      address: (street && city && state && zip)
        ? { street, unit: parseField(m.body, "Unit"), city, state, zip }
        : undefined,
    });
  }
  // Sort newest first
  trades.sort((a, b) => b.timestamp.localeCompare(a.timestamp));

  const FINISHED = new Set(["paid", "met", "rejected"]);
  const openCount = trades.filter(t => !FINISHED.has(t.status)).length;
  const paid = trades.filter(t => t.status === "paid" || t.status === "met")
    .reduce((sum, t) => sum + (parseInt(String(t.quote || "0").replace(/[^0-9]/g, ""), 10) || 0), 0);

  return NextResponse.json({
    authenticated: true,
    email: session.email,
    name: displayName,
    phone: profile?.phone,
    via: session.via,
    trades,
    summary: {
      total: trades.length,
      paid,
      openCount,
    },
  }, { headers: { "Cache-Control": "no-store" } });
}
