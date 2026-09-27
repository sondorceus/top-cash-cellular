import { NextRequest, NextResponse } from "next/server";
import { safeEqual } from "../../../lib/admin-auth";
import { fetchCommsPaged, type McMessage } from "../../../lib/mc-comms";
import { SEQUENCES, cumulativeDelayDays, lockUntilLabel, type SeqVars } from "../../../lib/email-sequences";
import { sequenceEligibility } from "../../../lib/sequence-eligibility";

// Read-only admin view of the email-drip sequences (mirrors notary's
// /ops/email-sequences). Shows the configured sequences + steps + timing, and
// recent actual sends pulled from the [SEQUENCE-SENT] markers the cron writes
// to Mission Control. No DB — same data source the cron uses.
//
// 2026-09-27: also the AUDIENCE — lib/sequence-eligibility run over the same
// 21-day window the cron reads — so the page shows how many leads are
// eligible, how many are due today and, per reason, why the rest are not (an
// enabled cron had answered checked:0 for sixteen days with nothing to look
// at). Plus each step's body rendered from the sample vars (the cron's own
// template functions) and the last run, from the cron's one-line
// [SEQUENCE-RUN] marker (else the newest [SEQUENCE-SENT]). Still read-only:
// no pause, no send — the switch is CRON_SEQUENCES_ENABLED, the preview of a
// run is the cron's ?dry=1.

const ADMIN_TOKEN = process.env.TCC_ADMIN_TOKEN;
const MC_KEY = process.env.MC_API_KEY || "";
const D = 24 * 60 * 60 * 1000;
// The cron reads 21 days of the live feed (app/api/cron/sequences); the same
// slice of this route's 90-day read yields the same verdicts.
const AUDIENCE_WINDOW_MS = 21 * D;

function authed(req: NextRequest): boolean {
  // Header only (2026-09-26): a ?token= in the URL put the admin secret in
  // request logs and browser history. proxy.ts sets this header for a Google
  // admin session; server-side callers already send it.
  return safeEqual(req.headers.get("x-admin-token"), ADMIN_TOKEN);
}

// Sample vars so each step can be rendered for display — a lead on day 7 of
// its 14-day lock. Display only; the cron builds the real vars per lead.
function sample(): SeqVars {
  return {
    firstName: "Alex",
    device: "iPhone 15 Pro",
    quote: "$420",
    offerUrl: "https://topcashcellular.com/offer/sample",
    // Every nudge carries the newsletter opt-out link (2026-09-27); display only.
    unsubUrl: "https://topcashcellular.com/api/newsletter/unsubscribe?token=sample",
    lockUntil: lockUntilLabel(new Date(Date.now() + 7 * D).toISOString()),
  };
}

type LastRun = { at: string; kind: "run" | "send"; checked?: number; eligible?: number; dueNow?: number; sent?: number; failed?: number };
type Audience = { windowDays: number; leads: number; eligible: number; dueNow: number; drops: Record<string, number> };

export async function GET(req: NextRequest) {
  if (!authed(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // One MC read (last ~90 days, bounded paging) feeds the sends, the run
  // records and the audience. Best-effort — the config renders even if MC is
  // unreachable (audience null, history empty).
  let msgs: McMessage[] = [];
  if (MC_KEY) {
    try {
      msgs = await fetchCommsPaged({ apiKey: MC_KEY, sinceMs: 90 * D, maxPages: 6 });
    } catch {
      msgs = [];
    }
  }
  const now = Date.now();
  const inWindow = msgs.filter((m) => new Date(m.timestamp).getTime() >= now - AUDIENCE_WINDOW_MS);
  const vars = sample();
  const render = (fn: (v: SeqVars) => string, fallback: string) => {
    try { return fn(vars); } catch { return fallback; }
  };

  const sequences = SEQUENCES.map((s) => {
    let audience: Audience | null = null;
    if (msgs.length > 0) {
      const r = sequenceEligibility(inWindow, { slug: s.slug, now });
      audience = { windowDays: AUDIENCE_WINDOW_MS / D, leads: r.leads.length, eligible: r.eligible, dueNow: r.dueNow, drops: r.drops };
    }
    // The newest run record wins; before the first one, the newest send stands in.
    let newestRun: LastRun | null = null;
    let newestSend: LastRun | null = null;
    const runRe = new RegExp(`\\[SEQUENCE-RUN\\]\\s+seq=${s.slug}\\b([^\\n]*)`, "i");
    const sentRe = new RegExp(`\\[SEQUENCE-SENT:\\s*[\\w-]+\\][^\\n]*seq=${s.slug}\\b[^\\n]*`, "i");
    for (const m of msgs) {
      const body = m.body || "";
      const run = body.match(runRe);
      if (run) {
        const num = (k: string) => { const v = run[1].match(new RegExp(`\\b${k}=(\\d+)`)); return v ? parseInt(v[1], 10) : undefined; };
        const at = run[1].match(/\bat=(\S+)/)?.[1] || m.timestamp;
        if (!newestRun || at > newestRun.at) {
          newestRun = { at, kind: "run", checked: num("checked"), eligible: num("eligible"), dueNow: num("dueNow"), sent: num("sent"), failed: num("failed") };
        }
        continue;
      }
      const sent = body.match(sentRe);
      if (sent) {
        const at = sent[0].match(/\bat=(\S+)/)?.[1] || m.timestamp;
        if (!newestSend || at > newestSend.at) newestSend = { at, kind: "send" };
      }
    }
    return {
      slug: s.slug,
      name: s.name,
      isActive: s.isActive,
      enabled: process.env.CRON_SEQUENCES_ENABLED === "1",
      steps: s.steps.map((st) => ({
        position: st.position,
        delayDays: st.delayDays,
        cumulativeDays: cumulativeDelayDays(s, st.position),
        subject: render(st.subject, "(subject)"),
        // The body preview (2026-09-27) — the same functions the cron mails.
        text: render(st.text, ""),
        html: render(st.html, ""),
      })),
      audience,
      lastRun: newestRun || newestSend,
    };
  });

  // Recent sends from MC sequence markers (all sequences).
  type Send = { leadId: string; seq: string; step: number; at: string };
  const sends: Send[] = [];
  const stepCounts: Record<string, number> = {};
  const reachedLeads = new Set<string>();
  for (const m of msgs) {
    const body = m.body || "";
    const mm = body.match(/\[SEQUENCE-SENT:\s*([\w-]+)\][^\n]*seq=([\w-]+)[^\n]*step=(\d+)[^\n]*?(?:at=([^\s\n]+))?/i);
    if (!mm) continue;
    const leadId = mm[1];
    const seq = mm[2];
    const step = parseInt(mm[3], 10);
    const at = mm[4] || m.timestamp || "";
    sends.push({ leadId, seq, step, at });
    stepCounts[`${seq}:${step}`] = (stepCounts[`${seq}:${step}`] || 0) + 1;
    reachedLeads.add(leadId);
  }
  sends.sort((a, b) => (b.at > a.at ? 1 : -1));

  return NextResponse.json({
    ok: true,
    mcConfigured: !!MC_KEY,
    sequences,
    stepCounts,
    leadsReached: reachedLeads.size,
    totalSends: sends.length,
    recent: sends.slice(0, 40),
  });
}
