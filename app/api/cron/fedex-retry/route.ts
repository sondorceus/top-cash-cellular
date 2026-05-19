// GET /api/cron/fedex-retry — scheduled retry of SERVICE_UNAVAILABLE
// label failures. Vercel cron pings every 30 min (see vercel.json).
// Skips ADDRESS_INVALID failures (customer has to fix and re-submit).
// Caps each lead at 5 retries — past that we give up and post a
// [LABEL-ABANDONED] marker so staff sees the dead-end and reaches out.
// Skywalker 2026-05-19.

import { NextRequest, NextResponse } from "next/server";
import { retryFedexLabel } from "../../../lib/fedex-retry";

const MC_API = "https://missioncontrolsdjg-production.up.railway.app";
const MC_KEY = process.env.MC_API_KEY || "";
const CRON_SECRET = process.env.CRON_SECRET || "";
const MAX_RETRIES = 5;

export async function GET(req: NextRequest) {
  // Vercel cron sets `Authorization: Bearer ${CRON_SECRET}` automatically
  // when the env is set. Allow ?secret= as fallback for manual runs.
  const auth = req.headers.get("authorization") || "";
  const querySecret = req.nextUrl.searchParams.get("secret") || "";
  if (CRON_SECRET && auth !== `Bearer ${CRON_SECRET}` && querySecret !== CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!MC_KEY) {
    return NextResponse.json({ error: "MC not configured" }, { status: 503 });
  }

  // Pull recent MC comms — look for [LABEL-FAILED: leadId] markers
  // that haven't been resolved by a later [LABEL: leadId] success.
  const r = await fetch(`${MC_API}/api/comms?limit=1000`, {
    headers: { "x-api-key": MC_KEY },
    cache: "no-store",
  });
  if (!r.ok) return NextResponse.json({ error: "MC unreachable" }, { status: 502 });
  const data = await r.json();
  const messages: { body?: string; timestamp: string }[] = data.messages || [];

  // Index per-lead: last fail time, last success time, retry count
  // (number of [LABEL-FAILED] markers regardless of kind), last kind.
  type Slot = { lastFail: string; lastSuccess: string; retryCount: number; lastKind: string };
  const byLead = new Map<string, Slot>();
  for (const m of messages) {
    if (!m.body) continue;
    const fail = m.body.match(/\[LABEL-FAILED:\s*([\w-]+)\]\s*kind=(\w+)/i);
    if (fail) {
      const lid = fail[1];
      const slot = byLead.get(lid) || { lastFail: "", lastSuccess: "", retryCount: 0, lastKind: "" };
      slot.retryCount += 1;
      if (m.timestamp > slot.lastFail) { slot.lastFail = m.timestamp; slot.lastKind = fail[2]; }
      byLead.set(lid, slot);
      continue;
    }
    const success = m.body.match(/\[LABEL:\s*([\w-]+)\]/i);
    if (success) {
      const lid = success[1];
      const slot = byLead.get(lid) || { lastFail: "", lastSuccess: "", retryCount: 0, lastKind: "" };
      if (m.timestamp > slot.lastSuccess) slot.lastSuccess = m.timestamp;
      byLead.set(lid, slot);
    }
  }

  // Build the retry queue: unresolved + transient + under retry cap.
  const queue: string[] = [];
  const skipped: { leadId: string; reason: string }[] = [];
  for (const [leadId, slot] of byLead) {
    if (slot.lastSuccess && slot.lastSuccess > slot.lastFail) continue; // resolved
    if (!slot.lastFail) continue; // never failed
    if (slot.lastKind === "ADDRESS_INVALID") { skipped.push({ leadId, reason: "address_invalid" }); continue; }
    if (slot.retryCount >= MAX_RETRIES) { skipped.push({ leadId, reason: "max_retries" }); continue; }
    queue.push(leadId);
  }

  const results: Array<{ leadId: string; ok: boolean; kind?: string; tracking?: string }> = [];
  for (const leadId of queue) {
    const res = await retryFedexLabel(leadId);
    if (res.ok) {
      results.push({ leadId, ok: true, tracking: res.label.tracking });
    } else {
      results.push({ leadId, ok: false, kind: res.kind });
      // After hitting MAX_RETRIES on this round (current attempt = retryCount+1),
      // post a one-time [LABEL-ABANDONED] marker so staff sees the dead-end.
      const slot = byLead.get(leadId);
      if (slot && slot.retryCount + 1 >= MAX_RETRIES) {
        try {
          await fetch(`${MC_API}/api/comms`, {
            method: "POST",
            headers: { "x-api-key": MC_KEY, "Content-Type": "application/json" },
            body: JSON.stringify({
              from: "topcash-web",
              fromName: "Top Cash Cellular",
              role: "system",
              body: `[LABEL-ABANDONED: ${leadId}] retries=${slot.retryCount + 1} kind=${res.kind || "?"} reason=auto-retry exhausted; staff must mint manually or contact customer`,
              tags: ["fedex-label", "abandoned"],
              priority: "high",
            }),
          });
        } catch {}
      }
    }
  }

  return NextResponse.json({
    ok: true,
    attempted: queue.length,
    succeeded: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok).length,
    skipped: skipped.length,
    results,
  });
}
