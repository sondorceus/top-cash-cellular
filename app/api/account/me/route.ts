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

import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import {
  getCustomerSessionFromCookies, getProfileFromCookies,
  verifyCustomerSession, CUSTOMER_COOKIE_NAME,
} from "../../../lib/auth";
import { isCustomerLeadPost } from "../../../lib/lead-devices";
import { fetchCommsRead } from "../../../lib/mc-comms";
import { rateLimit, clientIp } from "../../../lib/rate-limit";
import { offerPath } from "../../../lib/offer-link";

const MC_KEY = process.env.MC_API_KEY || "";

type Trade = {
  id: string;
  // The signed offer link (app/lib/offer-link.ts) — a bare /offer/<id> opens
  // the redacted view; the account is a verified inbox, so its links carry
  // the customer's key. 2026-09-26.
  offerPath: string;
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

export async function GET(req: NextRequest) {
  // getCustomerSessionFromCookies only accepts a Google tcc_session or a
  // tcc_customer cookie with the magic-link mark (`ml`, set by
  // /api/account/login). Cookies from the old login minted a session from a
  // typed email alone and stay signature-valid for 30 days — they read as
  // signed out, and are cleared here so the customer re-verifies through
  // the emailed link.
  const session = await getCustomerSessionFromCookies();
  if (!session) {
    const cookieStore = await cookies();
    // No valid Google session here, so a signature-valid customer cookie
    // that still got refused is an unmarked (old) one.
    const stale = !!verifyCustomerSession(cookieStore.get(CUSTOMER_COOKIE_NAME)?.value);
    const res = NextResponse.json(stale ? { authenticated: false, reverify: true } : { authenticated: false }, {
      headers: { "Cache-Control": "no-store" },
    });
    if (stale) res.cookies.set(CUSTOMER_COOKIE_NAME, "", { httpOnly: true, path: "/", maxAge: 0 });
    return res;
  }
  const email = session.email.toLowerCase();
  // Editable profile overlay — when the customer has saved a name /
  // phone from the account-edit form, those win over the auth-cookie
  // name. MC-independent so it always resolves.
  const profile = await getProfileFromCookies();
  const displayName = profile?.name || session.name;

  // The same paged one-year window that sign-in (/api/account/login) and
  // /api/track search. The old newest-800 slice is only a few days of the
  // shared feed (/api/track notes 500 ≈ 1–2 days), so a customer the link
  // had just signed in could land on "No trades yet". When MC can't be read
  // (it restarts on every deploy) — not at all, or only its newer pages
  // (!complete: an older trade may sit on the page that failed) — that is
  // "unavailable", not "no trades" (the feed is never empty): keep the
  // customer signed in and say so (tradesUnavailable) instead of a short or
  // empty history, or the old { error } body that /account read as signed out.
  const unavailable = (status: number, headers: Record<string, string> = {}) => NextResponse.json({
    authenticated: true,
    email: session.email,
    name: displayName,
    phone: profile?.phone,
    via: session.via,
    tradesUnavailable: true,
    trades: [],
    summary: { total: 0, paid: 0, openCount: 0 },
  }, { status, headers: { "Cache-Control": "no-store", ...headers } });
  // Each call is up to 6 × 5000-message archive reads on the shared MC, and
  // any Google account gets a session — throttle per IP and per account
  // (a session works from many IPs). /account calls this on load, after
  // Continue and from "Try again"; a throttled customer stays signed in
  // and sees the "try again in a minute" state.
  const rl = rateLimit(`account-me:${clientIp(req)}`, 10, 60_000);
  const rlEmail = rl.ok ? rateLimit(`account-me:${email}`, 10, 60_000) : rl;
  if (!rlEmail.ok) {
    return unavailable(429, { "Retry-After": String(Math.max(1, Math.ceil(rlEmail.retryAfterMs / 1000))) });
  }
  const read = MC_KEY
    // memoMs: /account calls this on load, after Continue and on retry —
    // one six-page read serves all of them.
    ? await fetchCommsRead({ apiKey: MC_KEY, includeArchive: true, sinceMs: 365 * 24 * 60 * 60 * 1000, pageSize: 5000, maxPages: 6, memoMs: 20_000 })
    : { messages: [], complete: false };
  const messages: { id: string; body?: string; timestamp: string }[] = read.messages;
  if (!read.complete || messages.length === 0) return unavailable(503);

  // Pass 1: collect lead messages whose body mentions this customer's
  // email (case-insensitive). Pass 2: pick the most-recent status per
  // lead so the trade list shows live state.
  const trades: Trade[] = [];
  type PayoutProof = { method?: string; reference?: string; amount?: number; at?: string };
  const statusByLead = new Map<string, { status: string; at: string; payoutProof?: PayoutProof }>();
  const labelByLead = new Map<string, string>();
  for (const m of messages) {
    // Status/label markers are their own posts — never read them out of a
    // customer's lead body (see isCustomerLeadPost).
    if (!m.body || isCustomerLeadPost(m.body)) continue;
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
      offerPath: offerPath(m.id),
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
