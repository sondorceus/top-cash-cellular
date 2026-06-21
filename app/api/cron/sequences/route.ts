import { NextRequest, NextResponse } from "next/server";
import { fetchCommsPaged } from "../../../lib/mc-comms";
import { logComm } from "../../../lib/comms-log";
import { SEQUENCES, cumulativeDelayDays, type SeqVars } from "../../../lib/email-sequences";

// Email-sequence engine (ported from its-official-notary's sequences cron).
// Drives multi-touch follow-ups; the only sequence today is abandoned-quote
// recovery — a quote that was given but never progressed gets gentle email
// nudges on ~day 3 and ~day 7 (picking up after the existing 24h reminder).
//
// No DB: enrollment is IMPLICIT (every quote_requested lead) and each send is
// recorded as a [SEQUENCE-SENT: leadId] seq=… step=N marker, so the next step
// is maxSentStep+1 and replays are idempotent — same pattern as the watchdog.
//
// Hard stops (a lead is NOT nudged when): it progressed past quote_requested
// (shipped/received/…/paid/rejected), was deleted, has no email, is an
// internal/test email, was unsubscribed, or all steps already fired.
//
// Auth: Authorization: Bearer ${CRON_SECRET}. Held behind
// CRON_SEQUENCES_ENABLED=1 (notary's pattern) — it emails real customers, so
// it must not fire until the copy is reviewed and the test data is cleared.

const RESEND_KEY = process.env.RESEND_API_KEY || "";
const SITE = "https://topcashcellular.com";
const INTERNAL_EMAILS = (process.env.TCC_INTERNAL_EMAILS || "sondorceus@gmail.com,sellurcell@topcashcells.com")
  .split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
const MC_API = "https://missioncontrolsdjg-production.up.railway.app";
const MC_KEY = process.env.MC_API_KEY || "";
const D = 24 * 60 * 60 * 1000;

const SEQ_SLUG = "abandoned_quote";

function field(body: string, key: string): string {
  return body.match(new RegExp(`(?:^|\\n)${key}:[ \\t]*([^\\n]*)`, "i"))?.[1]?.trim() || "";
}

async function sendEmail(to: string, subject: string, html: string, text: string): Promise<boolean> {
  if (!RESEND_KEY) return false;
  try {
    const { Resend } = await import("resend");
    const resend = new Resend(RESEND_KEY);
    const r = await resend.emails.send({
      from: "Top Cash Cellular <noreply@topcashcellular.com>",
      replyTo: "support@topcashcellular.com",
      to,
      subject,
      html,
      text,
    });
    return !!r?.data?.id;
  } catch {
    return false;
  }
}

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization") || "";
  const secret = process.env.CRON_SECRET;
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (process.env.CRON_SEQUENCES_ENABLED !== "1") {
    return NextResponse.json({ skipped: "disabled — set CRON_SEQUENCES_ENABLED=1 to enable" });
  }
  if (!MC_KEY) return NextResponse.json({ error: "MC not configured" }, { status: 503 });

  const seq = SEQUENCES.find((s) => s.slug === SEQ_SLUG);
  if (!seq || !seq.isActive) return NextResponse.json({ ok: true, skipped: "sequence inactive" });

  // Window must comfortably cover the last step's offset + margin.
  const messages = await fetchCommsPaged({ apiKey: MC_KEY, includeArchive: false, sinceMs: 21 * D, maxPages: 10 });
  // Empty can mean "MC genuinely had no recent messages" (quiet window) OR a
  // transient fetch failure — fetchCommsPaged returns [] for both. Either way
  // there's simply nothing to nudge this run; the cron is idempotent, so the
  // next run catches up. Treat it as a clean no-op, not a 502 false alarm.
  if (messages.length === 0) return NextResponse.json({ ok: true, processed: 0, note: "no recent messages" });

  const now = Date.now();
  const ms = (t?: string) => (t ? new Date(t).getTime() : 0);

  const leads = new Map<string, { ts: string; body: string }>();
  const statusByLead = new Map<string, { status: string; ts: string }>();
  const deleted = new Set<string>();
  const unsub = new Set<string>();
  const maxStepByLead = new Map<string, number>();

  for (const m of messages) {
    const body = m.body;
    if (!body) continue;
    if (/\[NEW BUYBACK LEAD(\b| — \d+ DEVICES\])/i.test(body)) leads.set(m.id, { ts: m.timestamp, body });
    const sm = body.match(/\[STATUS:\s*(\w+)\]\s*\[LEAD:\s*([\w-]+)\]/i);
    if (sm) {
      const lid = sm[2];
      const prev = statusByLead.get(lid);
      if (!prev || m.timestamp > prev.ts) statusByLead.set(lid, { status: sm[1].toLowerCase(), ts: m.timestamp });
    }
    const del = body.match(/\[DELETED-LEAD:\s*([\w-]+)\]/i);
    if (del) deleted.add(del[1]);
    const us = body.match(/\[SEQUENCE-UNSUB:\s*([\w-]+)\]/i);
    if (us) unsub.add(us[1]);
    const ss = body.match(new RegExp(`\\[SEQUENCE-SENT:\\s*([\\w-]+)\\][^\\n]*seq=${SEQ_SLUG}[^\\n]*step=(\\d+)`, "i"));
    if (ss) {
      const lid = ss[1], step = parseInt(ss[2], 10) || 0;
      if (step > (maxStepByLead.get(lid) || 0)) maxStepByLead.set(lid, step);
    }
  }

  let sent = 0, failed = 0, checked = 0;
  for (const [leadId, lead] of leads) {
    // Stop conditions.
    if (deleted.has(leadId) || unsub.has(leadId)) continue;
    const status = statusByLead.get(leadId)?.status || "quote_requested";
    if (status !== "quote_requested") continue; // progressed/closed → not "abandoned"
    const email = field(lead.body, "Email");
    if (!email || INTERNAL_EMAILS.includes(email.toLowerCase())) continue;

    const lastStep = maxStepByLead.get(leadId) || 0;
    const next = seq.steps.find((s) => s.position === lastStep + 1);
    if (!next) continue; // sequence finished for this lead
    checked++;

    // Due only once enough days have passed since the quote was given.
    const dueAt = ms(lead.ts) + cumulativeDelayDays(seq, next.position) * D;
    if (now < dueAt) continue;

    const vars: SeqVars = {
      firstName: (field(lead.body, "Name") || "there").split(/\s+/)[0],
      device: field(lead.body, "Device").split(" — ").slice(-1)[0] || "device",
      quote: field(lead.body, "Quote").replace(/\s*\(clamped from[^)]*\)/i, "").trim(),
      offerUrl: `${SITE}/offer/${leadId}`,
    };

    const ok = await sendEmail(email, next.subject(vars), next.html(vars), next.text(vars));
    if (!ok) { failed++; continue; }
    sent++;

    // Record the send so the next run advances (and never repeats) the step.
    await fetch(`${MC_API}/api/comms`, {
      method: "POST",
      headers: { "x-api-key": MC_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "tcc-admin",
        fromName: "TCC Admin",
        role: "system",
        body: `[SEQUENCE-SENT: ${leadId}] seq=${SEQ_SLUG} step=${next.position} at=${new Date(now).toISOString()}`,
        tags: ["sequence", SEQ_SLUG, `step-${next.position}`],
        priority: "low",
      }),
    }).catch(() => {});
    logComm({ leadId, channel: "email", kind: "sequence", to: email, subject: `${SEQ_SLUG} step ${next.position}` });
  }

  return NextResponse.json({ ok: true, sequence: SEQ_SLUG, checked, sent, failed });
}
