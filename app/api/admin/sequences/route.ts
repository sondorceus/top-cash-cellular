import { NextRequest, NextResponse } from "next/server";
import { safeEqual } from "../../../lib/admin-auth";
import { fetchCommsPaged } from "../../../lib/mc-comms";
import { SEQUENCES, cumulativeDelayDays, type SeqVars } from "../../../lib/email-sequences";

// Read-only admin view of the email-drip sequences (mirrors notary's
// /ops/email-sequences). Shows the configured sequences + steps + timing, and
// recent actual sends pulled from the [SEQUENCE-SENT] markers the cron writes
// to Mission Control. No DB — same data source the cron uses.

const ADMIN_TOKEN = process.env.TCC_ADMIN_TOKEN;
const MC_KEY = process.env.MC_API_KEY || "";

function authed(req: NextRequest): boolean {
  const headerToken = req.headers.get("x-admin-token");
  const queryToken = req.nextUrl.searchParams.get("token");
  return safeEqual(headerToken, ADMIN_TOKEN) || safeEqual(queryToken, ADMIN_TOKEN);
}

// Sample vars so we can render each step's subject for display.
const SAMPLE: SeqVars = {
  firstName: "Alex",
  device: "iPhone 15 Pro",
  quote: "$420",
  offerUrl: "https://topcashcellular.com/offer/sample",
};

export async function GET(req: NextRequest) {
  if (!authed(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sequences = SEQUENCES.map((s) => ({
    slug: s.slug,
    name: s.name,
    isActive: s.isActive,
    enabled: process.env.CRON_SEQUENCES_ENABLED === "1",
    steps: s.steps.map((st) => ({
      position: st.position,
      delayDays: st.delayDays,
      cumulativeDays: cumulativeDelayDays(s, st.position),
      subject: (() => { try { return st.subject(SAMPLE); } catch { return "(subject)"; } })(),
    })),
  }));

  // Recent sends from MC sequence markers (last ~90 days, bounded paging).
  type Send = { leadId: string; seq: string; step: number; at: string };
  const recent: Send[] = [];
  const stepCounts: Record<string, number> = {};
  const reachedLeads = new Set<string>();
  if (MC_KEY) {
    try {
      const msgs = await fetchCommsPaged({ apiKey: MC_KEY, sinceMs: 90 * 24 * 60 * 60 * 1000, maxPages: 6 });
      for (const m of msgs) {
        const body = (m as { body?: string }).body || "";
        const mm = body.match(/\[SEQUENCE-SENT:\s*([\w-]+)\][^\n]*seq=([\w-]+)[^\n]*step=(\d+)[^\n]*?(?:at=([^\s\n]+))?/i);
        if (!mm) continue;
        const leadId = mm[1];
        const seq = mm[2];
        const step = parseInt(mm[3], 10);
        const at = mm[4] || (m as { timestamp?: string }).timestamp || "";
        recent.push({ leadId, seq, step, at });
        stepCounts[`${seq}:${step}`] = (stepCounts[`${seq}:${step}`] || 0) + 1;
        reachedLeads.add(leadId);
      }
    } catch {
      // best-effort — show config even if MC is unreachable
    }
  }
  recent.sort((a, b) => (b.at > a.at ? 1 : -1));

  return NextResponse.json({
    ok: true,
    mcConfigured: !!MC_KEY,
    sequences,
    stepCounts,
    leadsReached: reachedLeads.size,
    totalSends: recent.length,
    recent: recent.slice(0, 40),
  });
}
