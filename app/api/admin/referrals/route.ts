import { NextRequest, NextResponse } from "next/server";

// Referral bookkeeping for staff. The referral program has no database —
// everything is MC "marker" messages:
//   [REFERRAL-CODE: code=REF-XXXXXX email=...]            — who owns a code
//   [REFERRAL-EARNED: referrer=... amount=N code=... referee-lead=ID]
//                                                          — a completed referral
//   [REFERRAL-PAID: referrer=... amount=N method=... at=ISO]
//                                                          — a payout this route records
// GET aggregates per referrer (earned / paid / outstanding); POST records
// a payout marker so staff can track who's been paid. Skywalker 2026-05-22.

const MC_API = "https://missioncontrolsdjg-production.up.railway.app";
const MC_KEY = process.env.MC_API_KEY || "";
const ADMIN_TOKEN = process.env.TCC_ADMIN_TOKEN || "topcash-admin-2026";

function checkAuth(req: NextRequest): boolean {
  const headerToken = req.headers.get("x-admin-token");
  const queryToken = req.nextUrl.searchParams.get("token");
  return headerToken === ADMIN_TOKEN || queryToken === ADMIN_TOKEN;
}

type Referrer = {
  email: string;
  code: string;
  earned: number;
  paid: number;
  outstanding: number;
  referralCount: number;
  refereeLeads: string[];
  lastEarnedAt?: string;
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

  // Walk every referral marker once, bucketing by referrer email.
  const byEmail = new Map<string, Referrer>();
  const ensure = (email: string): Referrer => {
    let r = byEmail.get(email);
    if (!r) {
      r = { email, code: "", earned: 0, paid: 0, outstanding: 0, referralCount: 0, refereeLeads: [] };
      byEmail.set(email, r);
    }
    return r;
  };

  for (const m of messages) {
    if (!m.body) continue;
    const cm = m.body.match(/\[REFERRAL-CODE:\s*code=(REF-[A-Z0-9]{6})\s+email=([^\s\]]+)/i);
    if (cm) {
      const r = ensure(cm[2].toLowerCase());
      if (!r.code) r.code = cm[1].toUpperCase();
    }
    const em = m.body.match(/\[REFERRAL-EARNED:\s*referrer=([^\s\]]+)\s+amount=(\d+)(?:\s+code=(REF-[A-Z0-9]{6}))?(?:\s+referee-lead=([\w-]+))?/i);
    if (em) {
      const r = ensure(em[1].toLowerCase());
      r.earned += parseInt(em[2], 10) || 0;
      r.referralCount += 1;
      if (em[3] && !r.code) r.code = em[3].toUpperCase();
      if (em[4]) r.refereeLeads.push(em[4]);
      if (!r.lastEarnedAt || m.timestamp > r.lastEarnedAt) r.lastEarnedAt = m.timestamp;
    }
    const pm = m.body.match(/\[REFERRAL-PAID:\s*referrer=([^\s\]]+)\s+amount=(\d+)/i);
    if (pm) {
      const r = ensure(pm[1].toLowerCase());
      r.paid += parseInt(pm[2], 10) || 0;
    }
  }

  // Only surface referrers who've actually earned — a bare code marker
  // with no completed referral isn't bookkeeping-relevant yet.
  const referrers = Array.from(byEmail.values())
    .filter((r) => r.referralCount > 0)
    .map((r) => ({ ...r, outstanding: Math.max(0, r.earned - r.paid) }))
    .sort((a, b) => b.outstanding - a.outstanding || b.earned - a.earned);

  const totals = referrers.reduce(
    (t, r) => ({ earned: t.earned + r.earned, paid: t.paid + r.paid, outstanding: t.outstanding + r.outstanding }),
    { earned: 0, paid: 0, outstanding: 0 },
  );

  return NextResponse.json(
    { referrers, totals, generatedAt: new Date().toISOString() },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(req: NextRequest) {
  if (!checkAuth(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!MC_KEY) return NextResponse.json({ error: "MC not configured" }, { status: 502 });

  let body: { email?: string; amount?: number; method?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const email = (body.email || "").toLowerCase().trim();
  const amount = Math.round(Number(body.amount));
  // Strip brackets / newlines so a method string can't forge marker fields.
  const method = (body.method || "").toString().replace(/[[\]\r\n]+/g, " ").trim().slice(0, 40);
  if (!email || !/^[^@\s]+@[^@\s]+$/.test(email)) {
    return NextResponse.json({ error: "Valid referrer email required" }, { status: 400 });
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: "Amount must be a positive number" }, { status: 400 });
  }

  const at = new Date().toISOString();
  try {
    const r = await fetch(`${MC_API}/api/comms`, {
      method: "POST",
      headers: { "x-api-key": MC_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "tcc-admin",
        fromName: "TCC Admin",
        role: "system",
        body: `[REFERRAL-PAID: referrer=${email} amount=${amount}${method ? ` method=${method}` : ""} at=${at}]`,
        tags: ["referral", "paid"],
        priority: "normal",
      }),
    });
    if (!r.ok) return NextResponse.json({ error: `MC rejected the payout marker (HTTP ${r.status})` }, { status: 502 });
  } catch {
    return NextResponse.json({ error: "Couldn't reach MC to record the payout" }, { status: 502 });
  }
  return NextResponse.json({ ok: true, email, amount, at });
}
