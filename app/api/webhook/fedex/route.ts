import { NextRequest, NextResponse } from "next/server";
import { getTracking } from "../../../lib/fedex";
import { notifyOwnerSms } from "../../../lib/owner-sms";
import { safeEqual } from "../../../lib/admin-auth";

// =========================================================================
// REAL-TIME FedEx TRACKING WEBHOOK.
// FedEx's standard REST API is poll-only, so this is the integration point
// for a PUSH source so movement reaches us instantly instead of waiting for
// the 30-min fedex-poll cron. Feed it from any of:
//   - a tracking aggregator that does webhooks (AfterShip / EasyPost / Shippo)
//   - FedEx's eventNotificationDetail emails routed through an email→webhook
//     relay (SendGrid Inbound Parse, Cloudflare Email Worker, Zapier, …)
//   - a FedEx enterprise webhook, if the account has one
// The push only needs to tell us WHICH tracking number changed — we then
// call the FedEx Track API ourselves to confirm the real state, so a spoofed
// POST can never move a lead. Mirrors the fedex-poll decision tree, reacting
// to one shipment immediately. The cron stays as the reliable backstop.
//
// Secure with FEDEX_WEBHOOK_SECRET (?secret=… or x-webhook-secret header).
// =========================================================================

const MC_API = "https://missioncontrolsdjg-production.up.railway.app";
const MC_KEY = process.env.MC_API_KEY || "";

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

function parseField(body: string, key: string): string | undefined {
  const re = new RegExp(`(?:^|\\n)${key}:[ \\t]*([^\\n]*)`, "i");
  return body.match(re)?.[1]?.trim() || undefined;
}

// Pull a tracking number out of whatever shape the push source sends.
function extractTracking(payload: unknown): string {
  const b = (payload ?? {}) as Record<string, unknown>;
  const nested = (k1: string, k2: string) => {
    const o = b[k1];
    return o && typeof o === "object" ? (o as Record<string, unknown>)[k2] : undefined;
  };
  const cands: unknown[] = [
    b.tracking, b.trackingNumber, b.tracking_number,
    nested("trackingNumberInfo", "trackingNumber"),
    nested("data", "tracking_number"),
    nested("msg", "tracking_number"),
  ];
  for (const c of cands) {
    if (typeof c === "string" && c.trim()) return c.trim().replace(/[^A-Za-z0-9-]/g, "");
  }
  return "";
}

export async function POST(req: NextRequest) {
  const secret = process.env.FEDEX_WEBHOOK_SECRET;
  const provided = req.nextUrl.searchParams.get("secret") || req.headers.get("x-webhook-secret") || "";
  if (!secret || !safeEqual(provided, secret)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  let payload: unknown;
  try { payload = await req.json(); } catch { return NextResponse.json({ error: "invalid json" }, { status: 400 }); }
  const tracking = extractTracking(payload);
  if (!tracking) return NextResponse.json({ error: "no tracking number in payload" }, { status: 400 });

  // Confirm the REAL state with FedEx — never trust the payload's status.
  const result = await getTracking(tracking);
  const newState = result.state;

  // Find the lead this tracking belongs to, its status, and the last state
  // we already reacted to (so repeat pushes are idempotent).
  let messages: { id: string; body?: string; timestamp: string }[] = [];
  try {
    const r = await fetch(`${MC_API}/api/comms?limit=1000`, { headers: { "x-api-key": MC_KEY }, cache: "no-store" });
    if (r.ok) { const d = await r.json(); messages = Array.isArray(d.messages) ? d.messages : []; }
  } catch {}

  let leadId = "";
  for (const m of messages) {
    if (!m.body) continue;
    const lab = m.body.match(new RegExp(`\\[LABEL:\\s*([\\w-]+)\\][^\\n]*?tracking=${tracking}\\b`, "i"));
    if (lab) { leadId = lab[1]; break; }
  }
  if (!leadId) return NextResponse.json({ ok: true, tracking, state: newState, note: "no matching lead" });

  let status = "quote_requested", lastState = "", leadBody = "", statusTs = "", evtTs = "";
  for (const m of messages) {
    if (!m.body) continue;
    const sm = m.body.match(new RegExp(`\\[STATUS:\\s*([\\w_]+)\\]\\s*\\[LEAD:\\s*${leadId}\\]`, "i"));
    if (sm && m.timestamp > statusTs) { status = sm[1].toLowerCase(); statusTs = m.timestamp; }
    const fm = m.body.match(new RegExp(`\\[FEDEX-EVENT:\\s*${leadId}\\s+state=([a-z_]+)`, "i"));
    if (fm && m.timestamp > evtTs) { lastState = fm[1].toLowerCase(); evtTs = m.timestamp; }
    if (m.id === leadId) leadBody = m.body;
  }
  if (["paid", "met", "rejected", "received", "tested"].includes(status)) {
    return NextResponse.json({ ok: true, tracking, leadId, state: newState, note: "lead already past receive" });
  }
  // Idempotent: a repeat push for a state we already handled does nothing.
  if (lastState === newState && newState !== "exception") {
    return NextResponse.json({ ok: true, tracking, leadId, state: newState, note: "no change since last event" });
  }

  const customer = {
    name: parseField(leadBody, "Name"),
    phone: parseField(leadBody, "Phone"),
    email: parseField(leadBody, "Email"),
    device: parseField(leadBody, "Device")?.split(" — ").slice(-1)[0]?.trim(),
    quote: parseField(leadBody, "Quote")?.replace(/\s*\(clamped from[^)]*\)/i, "").trim(),
    payout: parseField(leadBody, "Payout"),
  };
  const who = customer.name || "A customer";
  const dev = customer.device ? ` (${customer.device})` : "";

  // Decide what to do — mirrors fedex-poll's tree.
  let nextStatus: string | undefined, mcMessage: string | undefined, ownerMsg: string | undefined;
  if (newState === "picked_up" && status === "quote_requested") {
    nextStatus = "shipped";
    mcMessage = `📦 [webhook] Package picked up — ${leadId} tracking=${tracking}. Auto-flipped to Shipped.`;
    ownerMsg = `📦 ${who}'s package is on the move${dev} — now in transit to you. FedEx ${tracking}.`;
  } else if (newState === "out_for_delivery") {
    mcMessage = `🚚 [webhook] Out for delivery — ${leadId} tracking=${tracking}.`;
    ownerMsg = `🚚 ${who}'s package${dev} is OUT FOR DELIVERY today. FedEx ${tracking}.`;
  } else if (newState === "delivered" && status !== "received") {
    nextStatus = "received";
    const when = result.deliveredAt ? ` at ${result.deliveredAt}` : "";
    mcMessage = `📬 [webhook] DELIVERED${when} — ${leadId} tracking=${tracking}. Auto-flipped to Received.`;
    ownerMsg = `📬 ${who}'s package${dev} was DELIVERED${when}. Inspect + test, then pay. FedEx ${tracking}.`;
  } else if (newState === "exception") {
    mcMessage = `⚠️ [webhook] FedEx exception — ${leadId} (${tracking}): ${result.lastEventDescription || result.lastEventCode || "unknown"}.`;
    ownerMsg = `⚠️ FedEx issue on ${who}'s package${dev}: ${result.lastEventDescription || result.lastEventCode || "unknown"}. FedEx ${tracking}.`;
  }

  await postToMc(`[FEDEX-EVENT: ${leadId} state=${newState} code=${result.lastEventCode || "-"}] ${result.lastEventDescription || ""}`.trim());
  if (mcMessage) await postToMc(mcMessage);
  if (ownerMsg) await notifyOwnerSms(ownerMsg);

  let flippedTo: string | undefined;
  if (nextStatus) {
    const origin = new URL(req.url).origin;
    const adminToken = process.env.TCC_ADMIN_TOKEN;
    if (adminToken) {
      try {
        await fetch(`${origin}/api/admin/leads/status?token=${encodeURIComponent(adminToken)}`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-admin-token": adminToken },
          body: JSON.stringify({ leadId, status: nextStatus, ...customer }),
        });
        flippedTo = nextStatus;
      } catch { /* the cron backstop will flip it on the next run */ }
    }
  }
  return NextResponse.json({ ok: true, tracking, leadId, state: newState, flippedTo });
}
