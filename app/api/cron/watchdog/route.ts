import { NextRequest, NextResponse } from "next/server";
import { fetchCommsPaged } from "../../../lib/mc-comms";
import { notifyOwnerSms } from "../../../lib/owner-sms";

// Operational watchdog — catches the SILENT, money/trust-losing failures the
// customer reminder cron can't, because they happen on the OPS side after a
// trade is already in motion:
//   • received_unpaid   — device in our hands 2+ days, customer still unpaid
//   • tested_unpaid      — tested 1+ day ago, payout never sent
//   • shipped_unreceived — package shipped 7+ days ago, never arrived (lost?)
//   • label_unshipped    — customer got a label 4+ days ago, never shipped
//   • counter_norespond  — counter-offer sent 3+ days ago, no accept/decline
//
// Ports the notary watchdog's re-alert-suppression idea to TCC's MC model:
// each alert writes a [WATCHDOG-ALERT: leadId] cat=… marker, and we re-nag a
// given (lead, category) only after its cooldown elapses — so a trade stuck
// over a weekend doesn't bury the owner in identical emails. Adapted by
// ClaudeMX from its-official-notary's app/api/cron/watchdog. 2026-06-19.
//
// Auth: Authorization: Bearer ${CRON_SECRET} (same as the other crons).

const RESEND_KEY = process.env.RESEND_API_KEY || "";
const OWNER_EMAIL = process.env.OWNER_EMAIL || "support@topcashcellular.com";
const MC_API = "https://missioncontrolsdjg-production.up.railway.app";
const MC_KEY = process.env.MC_API_KEY || "";
const INTERNAL_EMAILS = (process.env.TCC_INTERNAL_EMAILS || "sondorceus@gmail.com,sellurcell@topcashcells.com")
  .split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);

const H = 60 * 60 * 1000;
const D = 24 * H;

type Cat = "received_unpaid" | "tested_unpaid" | "shipped_unreceived" | "label_unshipped" | "counter_norespond";

// Per-category: how long a trade sits in this state before it's flagged, the
// re-nag cooldown, whether it warrants an owner SMS (not just the email), and
// a human label for the digest.
const RULES: Record<Cat, { staleMs: number; cooldownMs: number; urgent: boolean; label: string }> = {
  received_unpaid:    { staleMs: 2 * D, cooldownMs: 1 * D, urgent: true,  label: "Received, not paid" },
  tested_unpaid:      { staleMs: 1 * D, cooldownMs: 1 * D, urgent: true,  label: "Tested, not paid" },
  shipped_unreceived: { staleMs: 7 * D, cooldownMs: 2 * D, urgent: false, label: "Shipped, never arrived" },
  label_unshipped:    { staleMs: 4 * D, cooldownMs: 2 * D, urgent: false, label: "Got label, never shipped" },
  counter_norespond:  { staleMs: 3 * D, cooldownMs: 2 * D, urgent: false, label: "Counter sent, no reply" },
};

function field(body: string, key: string): string {
  return body.match(new RegExp(`(?:^|\\n)${key}:[ \\t]*([^\\n]*)`, "i"))?.[1]?.trim() || "";
}

function esc(s: string): string {
  return s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c] || c));
}

type Flag = { leadId: string; cat: Cat; name: string; device: string; quote: string; ageDays: number };

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization") || "";
  const secret = process.env.CRON_SECRET;
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  // Held until explicitly enabled (same as notary shipped its watchdog) so it
  // can't surprise the owner with alerts before thresholds are tuned / the
  // pre-launch test data is cleared. Flip TCC_WATCHDOG_ENABLED=1 to activate.
  if (process.env.TCC_WATCHDOG_ENABLED !== "1") {
    return NextResponse.json({ skipped: "disabled — set TCC_WATCHDOG_ENABLED=1 to enable" });
  }
  if (!MC_KEY) return NextResponse.json({ error: "MC not configured" }, { status: 503 });

  // 30-day operational window covers every non-terminal trade with margin.
  const messages = await fetchCommsPaged({ apiKey: MC_KEY, includeArchive: false, sinceMs: 30 * D, maxPages: 10 });
  if (messages.length === 0) return NextResponse.json({ error: "MC unavailable" }, { status: 502 });

  const now = Date.now();
  const ms = (t?: string) => (t ? new Date(t).getTime() : 0);

  // Reconstruct per-lead operational state from the marker stream.
  const leads = new Map<string, { ts: string; body: string }>();
  const statusByLead = new Map<string, { status: string; ts: string }>();
  const labelAtByLead = new Map<string, string>();
  const counterAtByLead = new Map<string, string>();
  const counterRespByLead = new Map<string, string>();
  const deleted = new Set<string>();
  // (leadId|cat) -> latest watchdog-alert timestamp, for cooldown.
  const alertedAt = new Map<string, string>();

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
    const lab = body.match(/\[LABEL:\s*([\w-]+)\]/i);
    if (lab && m.timestamp > (labelAtByLead.get(lab[1]) || "")) labelAtByLead.set(lab[1], m.timestamp);
    const co = body.match(/\[COUNTER-OFFER:\s*([\w-]+)\]/i);
    if (co && m.timestamp > (counterAtByLead.get(co[1]) || "")) counterAtByLead.set(co[1], m.timestamp);
    const cr = body.match(/\[COUNTER-RESPONSE:\s*([\w-]+)\]/i);
    if (cr && m.timestamp > (counterRespByLead.get(cr[1]) || "")) counterRespByLead.set(cr[1], m.timestamp);
    const del = body.match(/\[DELETED-LEAD:\s*([\w-]+)\]/i);
    if (del) deleted.add(del[1]);
    const wa = body.match(/\[WATCHDOG-ALERT:\s*([\w-]+)\][^\n]*cat=(\w+)/i);
    if (wa) {
      const k = `${wa[1]}|${wa[2]}`;
      if (m.timestamp > (alertedAt.get(k) || "")) alertedAt.set(k, m.timestamp);
    }
  }

  const flags: Flag[] = [];
  for (const [leadId, lead] of leads) {
    if (deleted.has(leadId)) continue;
    if (INTERNAL_EMAILS.includes(field(lead.body, "Email").toLowerCase())) continue;

    const status = statusByLead.get(leadId)?.status || "quote_requested";
    const statusTs = statusByLead.get(leadId)?.ts || lead.ts;
    if (["paid", "met", "rejected"].includes(status)) continue; // closed — nothing to chase

    const consider: Array<{ cat: Cat; since: number }> = [];
    if (status === "received") consider.push({ cat: "received_unpaid", since: ms(statusTs) });
    if (status === "tested") consider.push({ cat: "tested_unpaid", since: ms(statusTs) });
    if (status === "shipped") consider.push({ cat: "shipped_unreceived", since: ms(statusTs) });
    if (status === "quote_requested" && labelAtByLead.has(leadId)) {
      consider.push({ cat: "label_unshipped", since: ms(labelAtByLead.get(leadId)) });
    }
    if (counterAtByLead.has(leadId) && !counterRespByLead.has(leadId)) {
      consider.push({ cat: "counter_norespond", since: ms(counterAtByLead.get(leadId)) });
    }

    for (const { cat, since } of consider) {
      const rule = RULES[cat];
      if (!since || now - since < rule.staleMs) continue;            // not stale yet
      const last = ms(alertedAt.get(`${leadId}|${cat}`));
      if (last && now - last < rule.cooldownMs) continue;            // re-nag cooldown
      flags.push({
        leadId,
        cat,
        name: field(lead.body, "Name") || "Customer",
        device: field(lead.body, "Device").split(" — ").slice(-1)[0] || "device",
        quote: field(lead.body, "Quote").replace(/\s*\(clamped from[^)]*\)/i, "").trim(),
        ageDays: Math.floor((now - since) / D),
      });
    }
  }

  if (flags.length === 0) {
    return NextResponse.json({ ok: true, flagged: 0 });
  }

  // Build the digest, grouped by category (urgent first).
  const order: Cat[] = ["received_unpaid", "tested_unpaid", "shipped_unreceived", "label_unshipped", "counter_norespond"];
  const byCat = new Map<Cat, Flag[]>();
  for (const f of flags) (byCat.get(f.cat) || byCat.set(f.cat, []).get(f.cat)!).push(f);

  const sections = order.filter((c) => byCat.has(c)).map((c) => {
    const rows = byCat.get(c)!.map((f) =>
      `<li style="margin:4px 0">#${esc(f.leadId.slice(0, 10).toUpperCase())} — ${esc(f.name)} · ${esc(f.device)}${f.quote ? ` · ${esc(f.quote)}` : ""} <span style="color:#888">(${f.ageDays}d)</span></li>`,
    ).join("");
    return `<div style="margin:0 0 18px"><div style="font-weight:700;color:#fff;margin-bottom:6px">${RULES[c].urgent ? "🔴 " : ""}${esc(RULES[c].label)} (${byCat.get(c)!.length})</div><ul style="margin:0;padding-left:18px;color:#cfcfcf;font-size:14px">${rows}</ul></div>`;
  }).join("");

  const html = `<!doctype html><html><body style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;background:#13142b;color:#e6e6e6;margin:0;padding:28px 16px"><div style="max-width:600px;margin:0 auto;background:#1b1d39;border:1px solid rgba(255,255,255,0.08);border-radius:16px;padding:26px"><div style="font-size:20px;font-weight:800;color:#fff;margin-bottom:4px">⏰ Watchdog: ${flags.length} stalled trade${flags.length === 1 ? "" : "s"}</div><div style="font-size:13px;color:#9aa;margin-bottom:20px">Trades sitting too long in an open state. Re-nags are cooldown-suppressed.</div>${sections}</div></body></html>`;

  let emailSent = false;
  if (RESEND_KEY) {
    try {
      const { Resend } = await import("resend");
      const resend = new Resend(RESEND_KEY);
      const r = await resend.emails.send({
        from: "Top Cash Cellular <noreply@topcashcellular.com>",
        to: [OWNER_EMAIL],
        subject: `⏰ ${flags.length} stalled trade${flags.length === 1 ? "" : "s"} need attention`,
        html,
      });
      emailSent = !!r?.data?.id;
    } catch { /* non-fatal */ }
  }

  // One concise SMS only when money/trust-urgent categories fired.
  const urgent = flags.filter((f) => RULES[f.cat].urgent);
  let smsSent = false;
  if (urgent.length > 0) {
    const lead = urgent[0];
    smsSent = await notifyOwnerSms(
      `⏰ TCC watchdog: ${urgent.length} unpaid trade${urgent.length === 1 ? "" : "s"} need payout. e.g. ${lead.name} (${lead.device}) — ${RULES[lead.cat].label.toLowerCase()} ${lead.ageDays}d. Check the board.`,
    );
  }

  // Record each alert so the cooldown suppresses the next run.
  await Promise.all(flags.map((f) =>
    fetch(`${MC_API}/api/comms`, {
      method: "POST",
      headers: { "x-api-key": MC_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "tcc-admin",
        fromName: "TCC Admin",
        role: "system",
        body: `[WATCHDOG-ALERT: ${f.leadId}] cat=${f.cat} ageDays=${f.ageDays} at=${new Date(now).toISOString()}`,
        tags: ["watchdog", f.cat, ...(RULES[f.cat].urgent ? ["urgent"] : [])],
        priority: RULES[f.cat].urgent ? "high" : "normal",
      }),
    }).catch(() => {}),
  ));

  return NextResponse.json({
    ok: true,
    flagged: flags.length,
    byCategory: Object.fromEntries(order.filter((c) => byCat.has(c)).map((c) => [c, byCat.get(c)!.length])),
    emailSent,
    smsSent,
  });
}
