import { NextRequest, NextResponse } from "next/server";

const MC_API = "https://missioncontrolsdjg-production.up.railway.app";
const MC_KEY = process.env.MC_API_KEY || "";

// Validate a one-use review token. Returns the bound lead's name +
// device + leadId on success, 401 on miss/expired/used.
// Skywalker 2026-05-18: "BE STRICT — random people can't see the
// review page. Even if customer checkout, if not marked paid, can't
// review."
//
// A token is valid iff ALL of these hold:
//   1. A [REVIEW-TOKEN: <leadId>] token=X expires=ISO marker exists in MC
//   2. The expires timestamp is in the future
//   3. NO [REVIEW-USED: token=X] marker exists yet (single-use)
//   4. The bound lead's most recent status is "paid" OR "met"
//
// Condition (4) is the belt-and-suspenders: even if a token marker
// somehow got minted without a paid/met flip (shouldn't happen, but
// defense in depth), we refuse access unless the lead actually paid.

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (!token || token.length < 32) {
    return NextResponse.json({ valid: false, error: "Missing token" }, { status: 401 });
  }

  let messages: { id?: string; body?: string; timestamp: string }[] = [];
  try {
    const r = await fetch(`${MC_API}/api/comms?limit=1000`, {
      headers: { "x-api-key": MC_KEY },
      cache: "no-store",
    });
    if (!r.ok) {
      return NextResponse.json({ valid: false, error: "Verification service unavailable" }, { status: 502 });
    }
    const data = await r.json();
    messages = Array.isArray(data.messages) ? data.messages : [];
  } catch {
    return NextResponse.json({ valid: false, error: "Verification service unavailable" }, { status: 502 });
  }

  // Find the token-mint marker by the exact token value.
  let tokenLeadId: string | undefined;
  let tokenExpiry: string | undefined;
  let tokenName: string | undefined;
  let tokenDevice: string | undefined;
  for (const m of messages) {
    if (!m.body) continue;
    const head = m.body.match(/\[REVIEW-TOKEN:\s*([\w-]+)\]/i);
    if (!head) continue;
    const tk = m.body.match(/token=([\w]+)/i)?.[1];
    if (tk !== token) continue;
    tokenLeadId = head[1];
    tokenExpiry = m.body.match(/expires=([^\s]+)/i)?.[1];
    tokenName = m.body.match(/name=([^\s]+)/i)?.[1]?.replace(/_/g, " ");
    tokenDevice = m.body.match(/device=([^\s]+)/i)?.[1]?.replace(/_/g, " ");
    break;
  }
  if (!tokenLeadId) {
    return NextResponse.json({ valid: false, error: "Invalid review link" }, { status: 401 });
  }
  if (tokenExpiry && new Date(tokenExpiry).getTime() < Date.now()) {
    return NextResponse.json({ valid: false, error: "This review link has expired" }, { status: 401 });
  }

  // Single-use: refuse if token already redeemed.
  const used = messages.some((m) => m.body && new RegExp(`\\[REVIEW-USED:\\s*${token}\\]`, "i").test(m.body));
  if (used) {
    return NextResponse.json({ valid: false, error: "This review link has already been used" }, { status: 401 });
  }

  // Belt-and-suspenders: the bound lead must be in paid/met status.
  let mostRecentStatus: { status: string; ts: string } | undefined;
  for (const m of messages) {
    if (!m.body) continue;
    const sm = m.body.match(/\[STATUS:\s*(\w+)\]/i);
    const lm = m.body.match(/\[LEAD:\s*([\w-]+)\]/i);
    if (!sm || !lm || lm[1] !== tokenLeadId) continue;
    if (!mostRecentStatus || m.timestamp > mostRecentStatus.ts) {
      mostRecentStatus = { status: sm[1].toLowerCase(), ts: m.timestamp };
    }
  }
  if (!mostRecentStatus || (mostRecentStatus.status !== "paid" && mostRecentStatus.status !== "met")) {
    return NextResponse.json({ valid: false, error: "Review access requires a completed trade" }, { status: 401 });
  }

  return NextResponse.json({
    valid: true,
    leadId: tokenLeadId,
    name: tokenName,
    device: tokenDevice,
  });
}
