import { NextRequest, NextResponse } from "next/server";
import { getTracking } from "../../../lib/fedex";
import { notifyOwnerSms } from "../../../lib/owner-sms";

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

// Flip a lead's status through the admin status route. Unlike a raw
// [STATUS:] marker, this route ALSO fires the customer SMS + email —
// so a FedEx-detected pickup/delivery actually reaches the customer,
// not just the admin board. shipAddress is deliberately omitted: the
// route only auto-generates a FedEx label when shipAddress is present,
// and every lead we poll already has its label.
async function flipStatusWithNotify(
  origin: string,
  leadId: string,
  status: string,
  customer: { name?: string; phone?: string; email?: string; device?: string; quote?: string; payout?: string },
): Promise<{ reached: boolean; mcPersisted: boolean }> {
  const adminToken = process.env.TCC_ADMIN_TOKEN;
  if (!adminToken) return { reached: false, mcPersisted: false };
  try {
    const r = await fetch(`${origin}/api/admin/leads/status?token=${encodeURIComponent(adminToken)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-admin-token": adminToken },
      body: JSON.stringify({ leadId, status, ...customer }),
    });
    if (!r.ok) return { reached: false, mcPersisted: false };
    // The route returns HTTP 200 even when its own [STATUS:] marker post
    // to MC failed — surface mcOk so the caller can back the marker up.
    const d = await r.json().catch(() => ({} as { mcOk?: boolean }));
    return { reached: true, mcPersisted: d?.mcOk === true };
  } catch { return { reached: false, mcPersisted: false }; }
}

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization") || "";
  const secret = process.env.CRON_SECRET;
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const origin = new URL(req.url).origin;

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
  const lastFedexStateByLead = new Map<string, { state: string; code: string; ts: string }>();
  const deletedLeads = new Set<string>();
  // Leads we've already sent a "stalled shipment" alert for, so the
  // watchdog pings the owner once, not every run.
  const staleAlertedLeads = new Set<string>();
  for (const m of messages) {
    if (!m.body) continue;
    const sm = m.body.match(/\[STATUS:\s*([\w_]+)\]\s*\[LEAD:\s*([\w-]+)\]/i);
    if (sm) {
      const prev = statusByLead.get(sm[2]);
      if (!prev || m.timestamp > prev.ts) statusByLead.set(sm[2], { status: sm[1].toLowerCase(), ts: m.timestamp });
    }
    const fm = m.body.match(/\[FEDEX-EVENT:\s*([\w-]+)\s+state=([a-z_]+)(?:\s+code=(\S+))?/i);
    if (fm) {
      const prev = lastFedexStateByLead.get(fm[1]);
      if (!prev || m.timestamp > prev.ts) lastFedexStateByLead.set(fm[1], { state: fm[2].toLowerCase(), code: (fm[3] || "").replace(/\]$/, ""), ts: m.timestamp });
    }
    const dm = m.body.match(/\[DELETED-LEAD:\s*([\w-]+)\]/i);
    if (dm) deletedLeads.add(dm[1]);
    const stm = m.body.match(/\[SHIP-STALE:\s*([\w-]+)\]/i);
    if (stm) staleAlertedLeads.add(stm[1]);
  }

  // Walk lead messages, pick the ship-handoff ones in active states with
  // a tracking number, and skip what we've already processed.
  type Candidate = {
    id: string; tracking: string; status: string; lastState?: string; lastCode?: string;
    labelAt?: string; // timestamp of the [LABEL:] marker — for the stalled-ship watchdog
    // Customer fields parsed from the lead body — needed so a status
    // flip can address the SMS + email to the right person.
    customer: { name?: string; phone?: string; email?: string; device?: string; quote?: string; payout?: string };
  };
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
    const lastCode = lastFedexStateByLead.get(m.id)?.code;
    // Find the lead's tracking number from a [LABEL: leadId] marker.
    // /api/lead writes these immediately after minting.
    let tracking = "";
    let labelAt: string | undefined;
    for (const lm of messages) {
      if (!lm.body) continue;
      const lab = lm.body.match(new RegExp(`\\[LABEL:\\s*${m.id}\\][^\\n]*?tracking=([^\\s\\]]+)`, "i"));
      if (lab) { tracking = lab[1]; labelAt = lm.timestamp; break; }
    }
    if (!tracking) continue;
    candidates.push({
      id: m.id, tracking, status, lastState, lastCode, labelAt,
      customer: {
        name: parseField(m.body, "Name"),
        phone: parseField(m.body, "Phone"),
        email: parseField(m.body, "Email"),
        // The "Device:" line is "<type> — <model>"; the status templates
        // inject this verbatim ("We got Phone — iPhone 15 Pro!"), so take the
        // clean model half like the offer GET + reminders already do.
        device: parseField(m.body, "Device")?.split(" — ").slice(-1)[0]?.trim() || parseField(m.body, "Device"),
        // Strip the internal "(clamped from $X)" tamper note so it can't reach
        // a customer-facing status SMS/email.
        quote: parseField(m.body, "Quote")?.replace(/\s*\(clamped from[^)]*\)/i, "").trim(),
        payout: parseField(m.body, "Payout"),
      },
    });
  }

  // Process up to 25 leads per run — FedEx Track API allows 1 tracking
  // number per call (single-tracking endpoint). 25 × ~500ms ≈ 12s well
  // under Vercel's 60s function ceiling.
  const MAX_PER_RUN = 25;
  const processed: Array<{ leadId: string; tracking: string; before: string; nowState: string; flippedTo?: string; mcPosted: boolean; error?: string }> = [];
  let errorCount = 0;
  for (const c of candidates.slice(0, MAX_PER_RUN)) {
    let result;
    try { result = await getTracking(c.tracking); }
    catch (e) {
      errorCount++;
      processed.push({ leadId: c.id, tracking: c.tracking, before: c.status, nowState: "error", mcPosted: false, error: e instanceof Error ? e.message.slice(0, 200) : "unknown" });
      continue;
    }
    // Small spacing between FedEx API calls — they don't publish a hard
    // per-second cap but politeness beats getting throttled.
    await new Promise((r) => setTimeout(r, 150));
    const newState = result.state;
    // Stalled-ship watchdog — a label that's been sitting for STALE_DAYS with
    // FedEx showing no scan ("unknown") or only "label created" (never picked
    // up) almost always means the customer delivered another way or never
    // dropped the box. Ping the owner ONCE (gated on a [SHIP-STALE:] marker)
    // so the lead doesn't sit silent forever (Pedro: 3 labels, never scanned,
    // no follow-up). Runs even when the state is unchanged. Skywalker 2026-06-19.
    const STALE_DAYS = 4;
    if (
      (newState === "unknown" || newState === "label_created") &&
      c.labelAt && !staleAlertedLeads.has(c.id)
    ) {
      const ageMs = Date.now() - new Date(c.labelAt).getTime();
      if (ageMs > STALE_DAYS * 24 * 60 * 60 * 1000) {
        const days = Math.floor(ageMs / (24 * 60 * 60 * 1000));
        const who = c.customer.name || "A customer";
        await postToMc(`[SHIP-STALE: ${c.id}] Label ${days}d old, FedEx still "${newState}" (no scan). ${who} likely delivered another way or hasn't dropped it off — follow up. tracking=${c.tracking}`);
        await notifyOwnerSms(`📦❓ ${who}'s shipment still hasn't hit FedEx after ${days} days (${c.tracking}). They may have delivered another way or not dropped it off — worth a quick follow-up.`);
        staleAlertedLeads.add(c.id);
      }
    }
    if (c.lastState === newState) {
      // Already reacted to this state. For exceptions we still want to
      // re-alert if FedEx reports a NEW exception code (a different problem),
      // but a persistent same-code exception must not re-ping every run (was
      // spamming up to 12 "FedEx exception" alerts/day per stuck package).
      const sameCode = (c.lastCode || "") === (result.lastEventCode || "");
      if (newState !== "exception" || sameCode) continue;
    }

    // Decide what to do based on (currentStatus, newState). mcMessage goes
    // to the MC board; ownerMsg is the owner's phone SMS (high-signal, named
    // by customer + device so Skywalker knows exactly what's moving — the
    // board ping alone meant shipping events went unnoticed). Skywalker
    // 2026-06-19: "I wasn't notified of shipping or that it was moving."
    let nextStatus: string | undefined;
    let mcMessage: string | undefined;
    let ownerMsg: string | undefined;
    const who = c.customer.name || "A customer";
    const dev = c.customer.device ? ` (${c.customer.device})` : "";
    if (newState === "picked_up" && c.status === "quote_requested") {
      nextStatus = "shipped";
      mcMessage = `📦 Package picked up by customer — ${c.id} tracking=${c.tracking}. Auto-flipped to Shipped.`;
      ownerMsg = `📦 ${who}'s package is on the move${dev} — now in transit to you. FedEx ${c.tracking}.`;
    } else if (newState === "out_for_delivery") {
      mcMessage = `🚚 Out for delivery today — ${c.id} tracking=${c.tracking}. Watch the inbox.`;
      ownerMsg = `🚚 ${who}'s package${dev} is OUT FOR DELIVERY today. FedEx ${c.tracking}.`;
    } else if (newState === "delivered" && c.status !== "received") {
      nextStatus = "received";
      const when = result.deliveredAt ? ` at ${result.deliveredAt}` : "";
      mcMessage = `📬 Package DELIVERED${when} — ${c.id} tracking=${c.tracking}. Auto-flipped to Received. Inspect + test next.`;
      ownerMsg = `📬 ${who}'s package${dev} was DELIVERED${when}. Inspect + test, then pay. FedEx ${c.tracking}.`;
    } else if (newState === "exception") {
      mcMessage = `⚠️ FedEx exception on ${c.id} (${c.tracking}): ${result.lastEventDescription || result.lastEventCode || "unknown"}. Manual check needed.`;
      ownerMsg = `⚠️ FedEx issue on ${who}'s package${dev}: ${result.lastEventDescription || result.lastEventCode || "unknown"}. FedEx ${c.tracking}.`;
    }

    // Persist the state marker so we don't reprocess this on the next run.
    await postToMc(`[FEDEX-EVENT: ${c.id} state=${newState} code=${result.lastEventCode || "-"}] ${result.lastEventDescription || ""}`.trim());

    let mcPosted = false;
    if (mcMessage) {
      mcPosted = await postToMc(mcMessage);
    }
    // Text the owner on every real movement event (best-effort; no-ops if
    // Twilio unconfigured). This is the fix for shipping events going
    // unnoticed — the board ping isn't enough.
    if (ownerMsg) {
      await notifyOwnerSms(ownerMsg);
    }
    if (nextStatus) {
      // Status flip — route through the admin status endpoint so the
      // customer gets the SMS + email, not just a silent board update.
      // The route posts its own [STATUS: ...] marker; if it's unreachable
      // OR it couldn't persist that marker, post a raw one ourselves so
      // the flip still lands on the admin board.
      const flip = await flipStatusWithNotify(origin, c.id, nextStatus, c.customer);
      if (!flip.reached || !flip.mcPersisted) {
        const why = flip.reached ? "marker backup" : "customer notify failed";
        await postToMc(`[STATUS: ${nextStatus}] [LEAD: ${c.id}] auto-flipped by fedex-poll cron (${why})`);
      }
    }
    processed.push({ leadId: c.id, tracking: c.tracking, before: c.status, nowState: newState, flippedTo: nextStatus, mcPosted });
  }

  // Alert MC if the error rate spiked — likely FedEx credentials
  // rotated or their API went down. One ping per run, idempotency
  // not needed (cron is hourly so worst-case 24 alerts/day).
  if (errorCount >= 3 && errorCount === processed.length) {
    await postToMc(`⚠️ FedEx Track API failing — ${errorCount}/${processed.length} calls errored. Check FEDEX_CLIENT_ID / FEDEX_CLIENT_SECRET on Vercel.`);
  }
  return NextResponse.json({
    ok: true,
    candidates: candidates.length,
    processed: processed.length,
    errors: errorCount,
    flippedToShipped: processed.filter((p) => p.flippedTo === "shipped").length,
    flippedToReceived: processed.filter((p) => p.flippedTo === "received").length,
    exceptions: processed.filter((p) => p.nowState === "exception").length,
    details: processed,
    runAt: new Date().toISOString(),
  });
}
