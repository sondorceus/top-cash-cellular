import { NextRequest, NextResponse } from "next/server";
import { safeEqual } from "../../../lib/admin-auth";
import { fetchCommsPaged } from "../../../lib/mc-comms";

// =========================================================================
// FedEx LABEL-SPEND TRACKER. Aggregates every [LABEL:] marker's captured
// cost (parsed from the FedEx rating at mint by createReturnLabel) and
// classifies each label by whether FedEx actually SCANNED it — because
// FedEx bills on USE, a label that never got a scan ("unknown" / only
// "label_created", and older than the stale window) was almost certainly
// never charged. So:
//   charged  = FedEx scanned it (picked_up / out_for_delivery / delivered)
//              → a real charge. Summed into chargedTotal.
//   pending  = minted recently, no scan yet → the rate may still become a
//              charge once it's dropped. Summed into pendingTotal.
//   unused   = old + no scan → never entered the network → $0 (free).
// Note: cost is only on labels minted AFTER the cost-capture fix; older
// labels (no cost= on the marker) are counted but flagged unknownCost.
// =========================================================================

const ADMIN_TOKEN = process.env.TCC_ADMIN_TOKEN;
const MC_KEY = process.env.MC_API_KEY || "";

const STALE_DAYS = 4;
const USED_STATES = new Set(["picked_up", "out_for_delivery", "delivered"]);

function checkAuth(req: NextRequest): boolean {
  const headerToken = req.headers.get("x-admin-token");
  const queryToken = req.nextUrl.searchParams.get("token");
  return safeEqual(headerToken, ADMIN_TOKEN) || safeEqual(queryToken, ADMIN_TOKEN);
}

export async function GET(req: NextRequest) {
  if (!checkAuth(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!MC_KEY) return NextResponse.json({ error: "MC not configured" }, { status: 502 });

  const msgs = await fetchCommsPaged({ apiKey: MC_KEY });

  // Latest FedEx delivery state per lead.
  const stateByLead = new Map<string, { state: string; ts: string }>();
  for (const m of msgs) {
    const fm = m.body?.match(/\[FEDEX-EVENT:\s*([\w-]+)\s+state=([a-z_]+)/i);
    if (fm) {
      const prev = stateByLead.get(fm[1]);
      if (!prev || m.timestamp > prev.ts) stateByLead.set(fm[1], { state: fm[2].toLowerCase(), ts: m.timestamp });
    }
  }

  // Latest [LABEL:] marker per lead (with its captured cost).
  const labelByLead = new Map<string, { tracking: string; cost?: number; at: string }>();
  for (const m of msgs) {
    const lm = m.body?.match(/\[LABEL:\s*([\w-]+)\][^\n]*?tracking=([^\s\]]+)/i);
    if (!lm) continue;
    const costM = m.body?.match(/cost=\$?([0-9]+(?:\.[0-9]+)?)/i);
    const cost = costM ? Number(costM[1]) : undefined;
    const prev = labelByLead.get(lm[1]);
    if (!prev || m.timestamp > prev.at) labelByLead.set(lm[1], { tracking: lm[2], cost, at: m.timestamp });
  }

  const now = Date.now();
  type Row = { leadId: string; tracking: string; cost: number | null; at: string; state: string; klass: "charged" | "pending" | "unused" };
  const rows: Row[] = [];
  let chargedTotal = 0, pendingTotal = 0;
  let chargedCount = 0, pendingCount = 0, unusedCount = 0, unknownCostCount = 0;
  const byMonth: Record<string, number> = {};

  for (const [leadId, lab] of labelByLead) {
    const state = stateByLead.get(leadId)?.state || "unknown";
    const ageDays = (now - new Date(lab.at).getTime()) / 86400000;
    let klass: Row["klass"];
    if (USED_STATES.has(state)) klass = "charged";
    else if (ageDays >= STALE_DAYS) klass = "unused";
    else klass = "pending";

    if (lab.cost == null && klass !== "unused") unknownCostCount++;
    const cost = lab.cost ?? 0;
    if (klass === "charged") {
      chargedTotal += cost; chargedCount++;
      const month = lab.at.slice(0, 7); // YYYY-MM
      byMonth[month] = (byMonth[month] || 0) + cost;
    } else if (klass === "pending") {
      pendingTotal += cost; pendingCount++;
    } else {
      unusedCount++;
    }
    rows.push({ leadId, tracking: lab.tracking, cost: lab.cost ?? null, at: lab.at, state, klass });
  }
  rows.sort((a, b) => b.at.localeCompare(a.at));

  const round = (n: number) => Math.round(n * 100) / 100;
  return NextResponse.json({
    summary: {
      chargedTotal: round(chargedTotal),
      pendingTotal: round(pendingTotal),
      totalLabels: labelByLead.size,
      chargedCount,
      pendingCount,
      unusedCount,
      unknownCostCount,
    },
    byMonth: Object.fromEntries(Object.entries(byMonth).map(([k, v]) => [k, round(v)])),
    labels: rows.slice(0, 300),
  });
}
