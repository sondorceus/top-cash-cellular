import { NextRequest, NextResponse } from "next/server";
import { fetchCommsPaged } from "../../../lib/mc-comms";
import { logComm } from "../../../lib/comms-log";
import { SEQUENCES, lockUntilLabel, type SeqVars } from "../../../lib/email-sequences";
import { offerUrl } from "../../../lib/offer-link";
import { isNewsletterUnsubbed } from "../../../lib/newsletter-unsub";
import { newsletterUnsubUrl } from "../../../lib/newsletter-token";
import { sequenceEligibility, formatDollars, internalEmails } from "../../../lib/sequence-eligibility";

// Email-sequence engine (ported from its-official-notary's sequences cron).
// Drives multi-touch follow-ups; the only sequence today is abandoned-quote
// recovery — a quote that was given but never progressed gets gentle email
// nudges on ~day 3 and ~day 7 (picking up after the existing 24h reminder).
//
// No DB: enrollment is IMPLICIT (every quote_requested lead) and each send is
// recorded as a [SEQUENCE-SENT: leadId] seq=… step=N marker, so the next step
// is maxSentStep+1 and replays are idempotent — same pattern as the watchdog.
//
// WHO gets a nudge is decided by lib/sequence-eligibility (2026-09-27), the
// same module the staff page reads, so a run that mails nobody says why: the
// response carries `eligible`, `dueNow` and `drops` (reason → count). Sixteen
// enabled daily runs had answered checked:0 with no way to tell "no audience"
// from "broken" — it was no audience: the campaign's leads are phone-only.
//
// ?dry=1 (2026-09-27) computes the same candidate list and returns
// `wouldSend` without Resend or a single MC write; it works with the enable
// flag off (the watchdog's pattern) so the switch can be inspected first. A
// manual GET without it is a real run.
//
// Each real run also leaves ONE line — [SEQUENCE-RUN] seq=… checked=
// eligible= dueNow= sent= failed= at= — so the page can show the last run
// even when nothing was sent (the newest [SEQUENCE-SENT] is June's ship test).
//
// "Unsubscribed" is two things: the per-lead [SEQUENCE-UNSUB] marker (kept;
// nothing writes it yet — the unsubscribe token carries only an address, no
// lead id) AND the durable newsletter opt-out blob, which every nudge checks
// right before Resend and which its own footer link feeds. The mail carries
// List-Unsubscribe headers so Gmail shows the one-click chip. An unreadable
// store skips the lead, never mails it.
//
// Auth: Authorization: Bearer ${CRON_SECRET}. Held behind
// CRON_SEQUENCES_ENABLED=1 (notary's pattern) — it emails real customers.

// Sequential Resend sends plus retried MC marker writes can outlive the plan
// default.
export const maxDuration = 300;

const RESEND_KEY = process.env.RESEND_API_KEY || "";
const MC_API = "https://missioncontrolsdjg-production.up.railway.app";
const MC_KEY = process.env.MC_API_KEY || "";
const D = 24 * 60 * 60 * 1000;

const SEQ_SLUG = "abandoned_quote";

async function sendEmail(to: string, subject: string, html: string, text: string, unsubUrl: string): Promise<boolean> {
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
      // RFC-8058 one-click, https only (2026-09-27) — same as the newsletter.
      headers: {
        "List-Unsubscribe": `<${unsubUrl}>`,
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
      },
    });
    return !!r?.data?.id;
  } catch {
    return false;
  }
}

// One MC marker post; true when MC accepted it. Bounded — MC is one Railway
// box that blips.
async function postMarker(body: string, tags: string[]): Promise<boolean> {
  return fetch(`${MC_API}/api/comms`, {
    method: "POST",
    headers: { "x-api-key": MC_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ from: "tcc-admin", fromName: "TCC Admin", role: "system", body, tags, priority: "low" }),
    signal: AbortSignal.timeout(10_000),
  }).then((r) => r.ok).catch(() => false);
}

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization") || "";
  const secret = process.env.CRON_SECRET;
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const dryRun = req.nextUrl.searchParams.get("dry") === "1";
  if (process.env.CRON_SEQUENCES_ENABLED !== "1" && !dryRun) {
    return NextResponse.json({ skipped: "disabled — set CRON_SEQUENCES_ENABLED=1 to enable (?dry=1 previews without it)" });
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
  if (messages.length === 0) {
    return NextResponse.json({ ok: true, dryRun: dryRun || undefined, sequence: SEQ_SLUG, leads: 0, eligible: 0, dueNow: 0, drops: {}, note: "no recent messages" });
  }

  const now = Date.now();
  const report = sequenceEligibility(messages, { slug: SEQ_SLUG, now, internalEmails: internalEmails() });

  let sent = 0, failed = 0, skippedUnsub = 0, skippedStore = 0;
  const wouldSend: { leadId: string; step: number; dueAt: string }[] = [];
  // The [SEQUENCE-SENT] marker is the only record of a send: an email whose
  // marker didn't land would go out again tomorrow (3-day due window), so a
  // marker miss halts the run — the rest wait for one that can record them.
  let markerDown = false;
  for (const lead of report.leads) {
    const v = lead.verdict;
    if (!v.eligible || !v.dueNow) continue;
    const step = seq.steps.find((s) => s.position === v.step);
    if (!step) continue;

    // The durable newsletter opt-out: the address must be known NOT to have
    // unsubscribed — true skips, and an unreadable store (null) skips as well
    // rather than mail someone who left. Checked on dry runs too (a read), so
    // `wouldSend` is exactly what a real run would mail.
    const optOut = await isNewsletterUnsubbed(lead.email);
    if (optOut !== false) {
      if (optOut === true) skippedUnsub++; else skippedStore++;
      continue;
    }
    if (dryRun) {
      wouldSend.push({ leadId: lead.leadId, step: v.step, dueAt: v.dueAt });
      continue;
    }

    const unsubUrl = newsletterUnsubUrl(lead.email);
    const vars: SeqVars = {
      firstName: lead.firstName,
      device: lead.device,
      // The formatted figure only (2026-09-27) — never the body's raw line.
      quote: formatDollars(lead.quoteNum),
      // Signed (offer-link.ts) — a bare /offer/<id> opens the redacted view.
      offerUrl: offerUrl(lead.leadId),
      unsubUrl,
      lockUntil: lockUntilLabel(lead.lockUntil),
    };

    const ok = await sendEmail(lead.email, step.subject(vars), step.html(vars), step.text(vars), unsubUrl);
    if (!ok) { failed++; continue; }
    sent++;

    // Record the send so the next run advances (and never repeats) the step.
    // Retried with a short backoff and bounded per try — MC blips.
    let marked = false;
    for (let attempt = 0; attempt < 3 && !marked; attempt++) {
      if (attempt > 0) await new Promise((r) => setTimeout(r, 500 * attempt));
      marked = await postMarker(
        `[SEQUENCE-SENT: ${lead.leadId}] seq=${SEQ_SLUG} step=${v.step} at=${new Date(now).toISOString()}`,
        ["sequence", SEQ_SLUG, `step-${v.step}`],
      );
    }
    // Awaited (2026-09-27): floating, the last lead's [COMM-SENT] could be cut
    // off with the function and the admin's comm count came up short.
    await logComm({ leadId: lead.leadId, channel: "email", kind: "sequence", to: lead.email, subject: `${SEQ_SLUG} step ${v.step}` });
    if (!marked) { markerDown = true; break; }
  }

  const summary = {
    ok: true,
    sequence: SEQ_SLUG,
    leads: report.leads.length,
    eligible: report.eligible,
    dueNow: report.dueNow,
    drops: report.drops,
    skippedUnsub,
    skippedStore,
  };
  if (dryRun) return NextResponse.json({ ...summary, dryRun: true, wouldSend });

  // The one-line run record (best-effort, no retry — the page falls back to
  // the newest [SEQUENCE-SENT] when it is missing).
  await postMarker(
    `[SEQUENCE-RUN] seq=${SEQ_SLUG} checked=${report.leads.length} eligible=${report.eligible} dueNow=${report.dueNow} sent=${sent} failed=${failed} at=${new Date(now).toISOString()}`,
    ["sequence", SEQ_SLUG, "run"],
  );
  return NextResponse.json({ ...summary, sent, failed, haltedOnMarker: markerDown || undefined });
}
