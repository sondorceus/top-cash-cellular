import { NextRequest, NextResponse } from "next/server";
import { getTracking, type TrackingState } from "../../../lib/fedex";

// Hourly FedEx tracking poll — Skywalker 2026-05-19. For every ship-
// handoff lead in quote_requested or shipped status with a tracking
// number, hit the FedEx Track API and auto-flip status when the
// physical package state changes. Removes the manual "did they ship
// yet?" guesswork.
//
// State transitions handled:
//   quote_requested + label_created  → no-op (label not yet picked up)
//   quote_requested + picked_up      → status=shipped + MC ping
//   shipped         + out_for_delivery → MC ping (status stays shipped)
//   shipped         + delivered      → status=received + MC ping
//   * + exception                    → MC ping for staff review (no flip)
//
// Idempotency: each FedEx event we react to writes a marker comm
// `[FEDEX-EVENT: leadId state=X eventCode=Y]` to MC. Before reacting
// we scan recent markers and skip leads whose latest known state
// already matches the current FedEx state. Safe to run hourly.

export const runtime = "nodejs";

const MC_API = "https://missioncontrolsdjg-production.up.railway.app";
const MC_KEY = process.env.MC_API_KEY || "";

type MCMessage = { id?: string; body?: string; timestamp: string };

function parseField(body: string, key: string): string | undefined {
  const re = new RegExp(`(?:^|\\n)${key}:[ \\t]*([^\\n]*)`, "i");
  return body.match(re)?.[1]?.trim() || undefined;
}

async function postToMc(body: string): Promise<boolean> {
  if (!MC_KEY) return false;
  try {
    const r = await fetch(`${MC_API}/api/comms`, {
      method: "POST",
      headers: { "x-api-key": MC_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ from: "powerhouse", fromName: "Powerhouse", body }),
    });
    return r.ok;
  } catch { return false; }
}

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization") || "";
  const secret = process.env.CRON_SECRET;
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // Pull MC comms — need lead bodies, status markers, AND prior fedex-
  // event markers so we don't double-react. 1000 messages covers ~3 days.
  let messages: MCMessage[] = [];
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

  // Index: latest status per lead, latest FEDEX-EVENT state per lead,
  // and the set of deleted lead ids.
  const statusByLead = new Map<string, { status: string; ts: string }>();
  const lastFedexStateByLead = new Map<string, { state: string; ts: string }>();
  const deletedLeads = new Set<string>();
  for (const m of messages) {
    if (!m.body) continue;
    const sm = m.body.match(/\[STATUS:\s*([\w_]+)\]\s*\[LEAD:\s*([\w-]+)\]/i);
    if (sm) {
      const prev = statusByLead.get(sm[2]);
      if (!prev || m.timestamp > prev.ts) statusByLead.set(sm[2], { status: sm[1].toLowerCase(), ts: m.timestamp });
    }
    const fm = m.body.match(/\[FEDEX-EVENT:\s*([\w-]+)\s+state=([a-z_]+)/i);
    if (fm) {
      const prev = lastFedexStateByLead.get(fm[1]);
      if (!prev || m.timestamp > prev.ts) lastFedexStateByLead.set(fm[1], { state: fm[2].toLowerCase(), ts: m.timestamp });
    }
    const dm = m.body.match(/\[DELETED-LEAD:\s*([\w-]+)\]/i);
    if (dm) deletedLeads.add(dm[1]);
  }

  // Walk lead messages, pick the ship-handoff ones in active states with
  // a tracking number, and skip what we've already processed.
  type Candidate = { id: string; tracking: string; status: string; lastState?: string };
  const candidates: Candidate[] = [];
  for (const m of messages) {
    if (!m.body || !m.id) continue;
    if (!/\[NEW BUYBACK LEAD(\b| — \d+ DEVICES\])/i.test(m.body)) continue;
    if (deletedLeads.has(m.id)) continue;
    // Only ship handoffs have tracking. Local meetups are out of scope
    // for this poll. The MC lead body contains "--- Handoff: SHIPPING ---"
    // when /api/lead wrote a ship handoff.
    if (!/--- Handoff: SHIPPING ---/i.test(m.body)) continue;
    // Tracking number is on the [LABEL: leadId] marker, NOT in the lead
    // body. Need to find it.
    const status = statusByLead.get(m.id)?.status || "quote_requested";
    if (["paid", "met", "rejected", "received", "tested"].includes(status)) continue; // terminal or post-receive
    const lastState = lastFedexStateByLead.get(m.id)?.state;
    // Find the lead's tracking number from a [LABEL: leadId] marker.
    // /api/lead writes these immediately after minting.
    let tracking = "";
    for (const lm of messages) {
      if (!lm.body) continue;
      const lab = lm.body.match(new RegExp(`\\[LABEL:\\s*${m.id}\\][^\\n]*?tracking=([^\\s\\]]+)`, "i"));
      if (lab) { tracking = lab[1]; break; }
    }
    if (!tracking) continue;
    candidates.push({ id: m.id, tracking, status, lastState });
  }

  // Process up to 25 leads per run — FedEx Track API allows 1 tracking
  // number per call (single-tracking endpoint). 25 × ~500ms ≈ 12s well
  // under Vercel's 60s function ceiling.
  const MAX_PER_RUN = 25;
  const processed: Array<{ leadId: string; tracking: string; before: string; nowState: string; flippedTo?: string; mcPosted: boolean }> = [];
  for (const c of candidates.slice(0, MAX_PER_RUN)) {
    let result;
    try { result = await getTracking(c.tracking); }
    catch { processed.push({ leadId: c.id, tracking: c.tracking, before: c.status, nowState: "error", mcPosted: false }); continue; }
    const newState = result.state;
    if (c.lastState === newState && newState !== "exception") {
      // Already reacted to this state. Skip silently.
      continue;
    }

    // Decide what to do based on (currentStatus, newState).
    let nextStatus: string | undefined;
    let mcMessage: string | undefined;
    if (newState === "picked_up" && c.status === "quote_requested") {
      nextStatus = "shipped";
      mcMessage = `📦 Package picked up by customer — ${c.id} tracking=${c.tracking}. Auto-flipped to Shipped.`;
    } else if (newState === "out_for_delivery") {
      mcMessage = `🚚 Out for delivery today — ${c.id} tracking=${c.tracking}. Watch the inbox.`;
    } else if (newState === "delivered" && c.status !== "received") {
      nextStatus = "received";
      const when = result.deliveredAt ? ` at ${result.deliveredAt}` : "";
      mcMessage = `📬 Package DELIVERED${when} — ${c.id} tracking=${c.tracking}. Auto-flipped to Received. Inspect + test next.`;
    } else if (newState === "exception") {
      mcMessage = `⚠️ FedEx exception on ${c.id} (${c.tracking}): ${result.lastEventDescription || result.lastEventCode || "unknown"}. Manual check needed.`;
    }

    // Persist the state marker so we don't reprocess this on the next run.
    await postToMc(`[FEDEX-EVENT: ${c.id} state=${newState} code=${result.lastEventCode || "-"}] ${result.lastEventDescription || ""}`.trim());

    let mcPosted = false;
    if (mcMessage) {
      mcPosted = await postToMc(mcMessage);
    }
    if (nextStatus) {
      // Status flip. Post the [STATUS: ...] marker the admin parser reads.
      await postToMc(`[STATUS: ${nextStatus}] [LEAD: ${c.id}] auto-flipped by fedex-poll cron`);
    }
    processed.push({ leadId: c.id, tracking: c.tracking, before: c.status, nowState: newState, flippedTo: nextStatus, mcPosted });
  }

  return NextResponse.json({
    ok: true,
    candidates: candidates.length,
    processed: processed.length,
    flippedToShipped: processed.filter((p) => p.flippedTo === "shipped").length,
    flippedToReceived: processed.filter((p) => p.flippedTo === "received").length,
    exceptions: processed.filter((p) => p.nowState === "exception").length,
    details: processed,
    runAt: new Date().toISOString(),
  });
}
