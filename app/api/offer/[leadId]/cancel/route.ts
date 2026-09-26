// POST /api/offer/[leadId]/cancel
//
// Customer-side cancel for an offer that hasn't been received yet.
//
// Access model: the leadId is the secret — same as the public offer
// GET route and the edit routes, since the customer reaches this from
// their own private offer link. No sign-in required; the owner gets an
// SMS on cancel, and the status gate below blocks cancelling a trade
// that's already in inspection / paid.
//
// On success: posts [DELETED-LEAD: leadId] reason=customer-cancel
// (same marker the admin trash button uses, so the admin lead parser
// already handles the soft-delete cleanup) + fires an owner SMS so
// staff knows. The offer page re-renders into the "cancelled" state
// via the existing parser path. Skywalker 2026-05-19.

import { NextRequest, NextResponse, after } from "next/server";
import { rateLimit, rateLimitResponse, clientIp } from "../../../../lib/rate-limit";
import { notifyOwnerSms } from "../../../../lib/owner-sms";
import { latestStatus, isDeleted, latestLabelTracking } from "../../../../lib/lead-devices";
import { fetchCommsRead, invalidateCommsMemo } from "../../../../lib/mc-comms";

const MC_API = "https://missioncontrolsdjg-production.up.railway.app";
const MC_KEY = process.env.MC_API_KEY || "";
const TWILIO_SID = process.env.TWILIO_ACCOUNT_SID || "";
const TWILIO_AUTH = process.env.TWILIO_AUTH_TOKEN || "";
const OWNER_PHONE = process.env.OWNER_PHONE || "+15129609256";

function field(body: string, key: string): string | undefined {
  const m = body.match(new RegExp(`(?:^|\\n)${key}:[ \\t]*([^\\n]*)`, "i"));
  return m?.[1]?.trim() || undefined;
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ leadId: string }> }) {
  const { leadId } = await ctx.params;
  if (!leadId || !/^[\w-]+$/.test(leadId)) {
    return NextResponse.json({ error: "Invalid offer id" }, { status: 400 });
  }
  // Throttle — leadId is the only access control; don't let a leaked link
  // flood MC / owner SMS.
  const rl = rateLimit(`offer:${clientIp(req)}`, 20, 60_000);
  if (!rl.ok) return rateLimitResponse(rl.retryAfterMs);
  // Per-lead cap shared by every customer write on this offer (cancel, edit,
  // add, phone, requests). The per-IP bucket is per lambda instance and a
  // link is one leaked string, so a loop from a few addresses could burn
  // MC's per-sender budget and the owner's alert channels. Ten writes in ten
  // minutes is far past what one seller does. 2026-09-25.
  const rlLead = rateLimit(`offer-lead:${leadId}`, 10, 600_000);
  if (!rlLead.ok) return rateLimitResponse(rlLead.retryAfterMs);
  if (!MC_KEY) {
    return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
  }

  // Optional cancellation note from the customer — surfaced to staff
  // so they know why ("changed my mind", "got a better offer", etc.).
  let note = "";
  try {
    const body = await req.json();
    if (typeof body?.note === "string") note = body.note.trim().slice(0, 200);
  } catch { /* note is optional */ }

  // Pull the lead body to verify ownership AND check it's still
  // cancellable (not already received / paid / cancelled). limit=5000
  // (full live cap, was 1000) so an older offer still resolves by id
  // instead of 404'ing once the feed grows past the window.
  // Shared reader — 15 s timeout, no memo (a write must see the feed as it
  // is now). A failed or empty read is "unknown", never "not found": the
  // bare fetch here had no timeout at all and 404'd on a short body.
  // 2026-09-25.
  const read = await fetchCommsRead({ apiKey: MC_KEY, pageSize: 5000, maxPages: 1, includeArchive: false });
  if (!read.complete || read.messages.length === 0) {
    return NextResponse.json({ error: "Mission Control is unavailable — nothing was changed." }, { status: 502 });
  }
  const messages = read.messages;
  const leadMsg = messages.find((m) => m.id === leadId);
  if (!leadMsg?.body) {
    return NextResponse.json({ error: "Offer not found" }, { status: 404 });
  }

  // Confirm it's a real buyback lead (the leadId is the access secret).
  if (!/\[NEW BUYBACK LEAD(\b| — \d+ DEVICES\])/i.test(leadMsg.body)) {
    return NextResponse.json({ error: "Offer not found" }, { status: 404 });
  }

  // Check status — block cancel after received/paid/met. The customer
  // can still email staff at that point but the self-serve path stops
  // here so they don't accidentally cancel a paid trade.
  // Whitelisted, like GET and the items route (lead-devices.latestStatus).
  // This loop took ANY [STATUS: word]: a typo'd staff marker after
  // "received" read as non-terminal here while GET kept showing Received,
  // and the customer could cancel a trade already in hand. 2026-09-25.
  const status = latestStatus(messages, leadId);
  // "shipped" is terminal for self-cancel: the device is already in transit
  // with a minted label, so trashing the lead would orphan an inbound package.
  // Matches the sibling items route's LOCKED set. (bug fix)
  const TERMINAL = new Set(["received", "tested", "paid", "met", "shipped"]);
  if (TERMINAL.has(status)) {
    const phase = status === "paid" || status === "met" ? "paid" : status === "shipped" ? "already on its way to us" : "in inspection";
    return NextResponse.json({
      error: `This offer is ${phase} — please email support@topcashcellular.com to discuss.`,
    }, { status: 409 });
  }

  // Already cancelled?
  // Restore-aware — a lead staff trashed and restored is live again.
  const alreadyCancelled = isDeleted(messages, leadId);
  if (alreadyCancelled) {
    return NextResponse.json({ ok: true, alreadyCancelled: true });
  }

  // Post the cancel marker — same shape the admin trash button uses.
  // The "reason=customer-cancel" tag lets staff differentiate
  // customer-initiated cancels from staff-initiated ones in MC search.
  const cancelBody = `[DELETED-LEAD: ${leadId}] [REASON: customer-cancel${note ? ` · ${note.replace(/[\[\]\n\r]/g, " ")}` : ""}]`;
  const postRes = await fetch(`${MC_API}/api/comms`, {
    method: "POST",
    headers: { "x-api-key": MC_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({
      // Customer-originated posts carry their own MC sender (own 120/min
      // bucket — server.js checkRateLimit keys on `from`): as "topcash-web" a
      // looped offer link could 429 the sender every new lead posts as.
      // Nothing reads these markers by sender; readers key on the marker
      // text. 2026-09-25.
      from: "topcash-customer",
      fromName: "Top Cash Cellular (customer)",
      role: "system",
      body: cancelBody,
      tags: ["cancel", "customer-cancel"],
      priority: "high",
    }),
  });
  if (!postRes.ok) {
    return NextResponse.json({ error: "Couldn't record cancellation — try again shortly." }, { status: 502 });
  }
  // A GET on this instance must not answer from a read taken before this
  // write (the page refetches right away).
  invalidateCommsMemo();

  // Owner SMS so staff sees the cancel land in real time — they may
  // have already booked inspection capacity / printed picking slips.
  // After the response: nothing in it reads the alert's outcome, and the
  // three channels (8 s each) used to hold the customer's click. A minted
  // label is NOT voided here — name its tracking number so staff void it
  // before the package (or the FedEx charge) shows up. 2026-09-25.
  {
    const customerName = field(leadMsg.body, "Name") || "Customer";
    const model = field(leadMsg.body, "Model") || field(leadMsg.body, "Device") || "device";
    const tracking = latestLabelTracking(messages, leadId);
    const text = `❌ CANCEL: ${customerName} cancelled offer ${leadId.slice(0, 10).toUpperCase()} (${model})${note ? ` — "${note}"` : ""}${tracking ? ` — had a FedEx label — tracking ${tracking} — void it.` : ""}`;
    after(() => notifyOwnerSms(text.slice(0, 480)).catch(() => {}));
  }

  return NextResponse.json({ ok: true });
}
