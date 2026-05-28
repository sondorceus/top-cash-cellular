import { NextRequest, NextResponse } from "next/server";
import { parseDollarAmount } from "../../../lib/lead-money";

// Saved-quotes / abandoned-cart list for staff re-marketing. These are
// the [QUOTE SAVED] markers /api/lead writes when a customer enters their
// email at the "save this quote for later" box or the account step but
// hasn't completed checkout (no payout method / handoff chosen yet).
// Skywalker 2026-05-28.
//
// We cross-reference completed [NEW BUYBACK LEAD]s by email so a saved
// quote whose owner later finished a real trade is flagged `converted`
// — no point chasing someone who already sold to us.

const MC_API = "https://missioncontrolsdjg-production.up.railway.app";
const MC_KEY = process.env.MC_API_KEY || "";
const ADMIN_TOKEN = process.env.TCC_ADMIN_TOKEN;

function checkAuth(req: NextRequest): boolean {
  const headerToken = req.headers.get("x-admin-token");
  const queryToken = req.nextUrl.searchParams.get("token");
  return headerToken === ADMIN_TOKEN || queryToken === ADMIN_TOKEN;
}

// Same column-0-anchored field parser the admin leads route uses, so an
// empty field doesn't swallow the next line's value.
function parseField(body: string, key: string): string | undefined {
  const m = body.match(new RegExp(`(?:^|\\n)${key}:[ \\t]*([^\\n]*)`, "i"));
  if (!m) return undefined;
  const v = m[1].trim();
  return v || undefined;
}

type SavedQuote = {
  id?: string;
  name?: string;
  email: string;
  device?: string;
  quote: number;
  condition?: string;
  savedAt: string;
  count: number;       // how many times this email+device was saved
  converted: boolean;  // owner later completed a real buyback lead
};

export async function GET(req: NextRequest) {
  if (!checkAuth(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!MC_KEY) return NextResponse.json({ error: "MC not configured" }, { status: 502 });

  let messages: { id?: string; body?: string; timestamp: string }[] = [];
  try {
    const r = await fetch(`${MC_API}/api/comms?limit=1000`, {
      headers: { "x-api-key": MC_KEY },
      cache: "no-store",
    });
    if (!r.ok) return NextResponse.json({ error: "MC unavailable" }, { status: 502 });
    const data = await r.json();
    messages = Array.isArray(data.messages) ? data.messages : [];
  } catch {
    return NextResponse.json({ error: "MC fetch failed" }, { status: 502 });
  }

  // Soft-deleted entries — staff "Dismiss" posts a [DELETED-LEAD: id]
  // marker (the same mechanism /api/admin/leads/delete uses), so a
  // handled / junk saved quote disappears from this list too.
  const deletedIds = new Set<string>();
  for (const m of messages) {
    const dm = m.body?.match(/\[DELETED-LEAD:\s*([\w-]+)\]/i);
    if (dm) deletedIds.add(dm[1]);
  }

  // Pass 1: emails that completed a REAL buyback lead. A real lead has a
  // "--- Handoff:" block or a non-TBD payout (phantom legacy preview-saves
  // have neither — see the filter in /api/admin/leads). Recycle leads
  // count as a conversion too (the device left the customer's hands).
  const convertedEmails = new Set<string>();
  for (const m of messages) {
    if (!m.body || !/\[NEW BUYBACK LEAD(\b| — \d+ DEVICES\])/i.test(m.body)) continue;
    const payoutVal = (parseField(m.body, "Payout") || "").trim().toLowerCase();
    const hasHandoff = /---\s*Handoff:/i.test(m.body);
    const isReal = hasHandoff || (payoutVal !== "" && payoutVal !== "tbd");
    if (!isReal) continue;
    const email = (parseField(m.body, "Email") || "").toLowerCase().trim();
    if (email) convertedEmails.add(email);
  }

  // Pass 2: collect [QUOTE SAVED] markers, deduped by email+device (keep
  // the most recent, count the rest).
  const byKey = new Map<string, SavedQuote>();
  for (const m of messages) {
    if (!m.body || !/^\[QUOTE SAVED\]/im.test(m.body)) continue;
    if (m.id && deletedIds.has(m.id)) continue;
    const email = (parseField(m.body, "Email") || "").toLowerCase().trim();
    if (!email) continue;
    const device = parseField(m.body, "Device");
    // The account-step auto-saves carry placeholder names ("Guest",
    // "Returning Customer", "Google User") — treat those as no-name so
    // the follow-up email doesn't greet "Hi Guest,".
    const rawName = parseField(m.body, "Name");
    const name = rawName && !/^(guest|returning customer|google user|\(not provided yet\))$/i.test(rawName) ? rawName : undefined;
    const condition = parseField(m.body, "Condition");
    const quote = parseDollarAmount(parseField(m.body, "Quote"));
    const key = `${email}|${(device || "").toLowerCase()}`;
    const existing = byKey.get(key);
    if (existing) {
      existing.count += 1;
      // Keep the most-recent metadata.
      if (m.timestamp > existing.savedAt) {
        existing.savedAt = m.timestamp;
        existing.id = m.id;
        existing.name = name || existing.name;
        existing.quote = quote || existing.quote;
        existing.condition = condition || existing.condition;
      }
    } else {
      byKey.set(key, {
        id: m.id,
        name,
        email,
        device,
        quote,
        condition,
        savedAt: m.timestamp,
        count: 1,
        converted: convertedEmails.has(email),
      });
    }
  }

  const quotes = Array.from(byKey.values()).sort((a, b) => (a.savedAt < b.savedAt ? 1 : -1));
  const open = quotes.filter((q) => !q.converted);
  const totals = {
    total: quotes.length,
    open: open.length,
    converted: quotes.length - open.length,
    openValue: open.reduce((s, q) => s + (q.quote || 0), 0),
  };

  return NextResponse.json(
    { quotes, totals, generatedAt: new Date().toISOString() },
    { headers: { "Cache-Control": "no-store" } },
  );
}
