// POST /api/offer/[leadId]/contact
//
// Customer-side contact-info edit. Currently scoped to the phone number
// only — name and email are fixed (email is the account identity).
//
// 2026-09-26: the signed link's `k` (app/lib/offer-link.ts) is the access
// control for every write here; the id alone gets the redacted read. The
// access-model paragraph below predates that.
// Access model: the leadId is the secret — same as the public offer
// GET route and the device-edit route, since the customer reaches this
// from their own private offer link. No sign-in required; the owner
// gets an SMS on every change.
//
// On success: posts a [CONTACT-UPDATE: leadId] marker to MC carrying
// the new phone. The offer GET route parses the latest such marker and
// overrides the displayed phone. An owner SMS fires so staff sees the
// change (the FedEx label, if already minted, still has the old phone).
// Skywalker 2026-05-20.

import { NextRequest, NextResponse, after } from "next/server";
import { rateLimit, rateLimitResponse, clientIp } from "../../../../lib/rate-limit";
import { notifyOwnerSms } from "../../../../lib/owner-sms";
import { isDeleted } from "../../../../lib/lead-devices";
import { fetchCommsRead, invalidateCommsMemo } from "../../../../lib/mc-comms";
import { offerKeyValid } from "../../../../lib/offer-link";

const MC_API = "https://missioncontrolsdjg-production.up.railway.app";
const MC_KEY = process.env.MC_API_KEY || "";
const TWILIO_SID = process.env.TWILIO_ACCOUNT_SID || "";
const TWILIO_AUTH = process.env.TWILIO_AUTH_TOKEN || "";
const OWNER_PHONE = process.env.OWNER_PHONE || "+15129609256";
// Every write needs the link's `k` (app/lib/offer-link.ts, 2026-09-26): the
// bare id is the public Offer #, so on its own it may only read.
const UNSIGNED_LINK = "This link isn't signed — open your offer from your confirmation e-mail or your account to make changes.";

function field(body: string, key: string): string | undefined {
  const m = body.match(new RegExp(`(?:^|\\n)${key}:[ \\t]*([^\\n]*)`, "i"));
  return m?.[1]?.trim() || undefined;
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ leadId: string }> }) {
  const { leadId } = await ctx.params;
  if (!leadId || !/^[\w-]+$/.test(leadId)) {
    return NextResponse.json({ error: "Invalid offer id" }, { status: 400 });
  }
  // Signed-link gate — before the body is trusted and before any MC read, so
  // an unsigned request costs nothing. The key rides in the JSON body (the
  // offer page) or the query (the funnel's add-to-order flow). 2026-09-26.
  let bodyIn: Record<string, unknown> | null = null;
  try {
    const j = await req.json();
    if (j && typeof j === "object" && !Array.isArray(j)) bodyIn = j as Record<string, unknown>;
  } catch { /* no body / not JSON — each field is validated below */ }
  const k = typeof bodyIn?.k === "string" ? bodyIn.k : req.nextUrl.searchParams.get("k");
  if (!offerKeyValid(leadId, k)) {
    return NextResponse.json({ error: UNSIGNED_LINK }, { status: 403 });
  }
  // Throttle — don't let a leaked signed link flood MC / owner SMS.
  const rl = rateLimit(`offer:${clientIp(req)}`, 20, 60_000);
  if (!rl.ok) return rateLimitResponse(rl.retryAfterMs);
  if (!MC_KEY) {
    return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
  }

  // Parse + validate the new phone. Digits-only must be at least 10 —
  // matches the shipping-label guard on the lead form.
  let phone = "";
  if (typeof bodyIn?.phone === "string") phone = bodyIn.phone.trim();
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 10 || digits.length > 15) {
    return NextResponse.json({ error: "Enter a valid phone number." }, { status: 400 });
  }
  // Strip characters that would break the MC marker / lead parser.
  const phoneClean = phone.replace(/[\[\]\n\r]/g, " ").trim().slice(0, 40);
  // Per-lead cap shared by every customer write on this offer — see the
  // cancel route. After validation so a typo doesn't spend it. 2026-09-25.
  const rlLead = rateLimit(`offer-lead:${leadId}`, 10, 600_000);
  if (!rlLead.ok) return rateLimitResponse(rlLead.retryAfterMs);

  // Pull the lead body to confirm it's a real buyback lead. limit=5000
  // (full live cap, was 1000) so an older offer still resolves by id.
  // Shared reader — 15 s timeout, no memo; a failed or empty read is
  // "unknown", never "not found" (the bare fetch had no timeout). 2026-09-25.
  const read = await fetchCommsRead({ apiKey: MC_KEY, pageSize: 5000, maxPages: 1, includeArchive: false });
  if (!read.complete || read.messages.length === 0) {
    return NextResponse.json({ error: "Mission Control is unavailable — nothing was changed." }, { status: 502 });
  }
  const messages = read.messages;
  const leadMsg = messages.find((m) => m.id === leadId);
  if (!leadMsg?.body || !/\[NEW BUYBACK LEAD(\b| — \d+ DEVICES\])/i.test(leadMsg.body)) {
    return NextResponse.json({ error: "Offer not found" }, { status: 404 });
  }

  // Already cancelled? No point editing.
  // Restore-aware — a lead staff trashed and restored is live again.
  const cancelled = isDeleted(messages, leadId);
  if (cancelled) {
    return NextResponse.json({ error: "This offer was cancelled." }, { status: 409 });
  }

  // Post the contact-update marker. Human-readable so staff scanning
  // MC see it; the `phone=` token is what the offer GET route parses.
  const updateBody = `[CONTACT-UPDATE: ${leadId}] Customer updated phone — phone=${phoneClean}`;
  const postRes = await fetch(`${MC_API}/api/comms`, {
    method: "POST",
    headers: { "x-api-key": MC_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({
      // Own MC sender bucket for customer-originated posts — see the cancel
      // route. 2026-09-25.
      from: "topcash-customer",
      fromName: "Top Cash Cellular (customer)",
      role: "system",
      body: updateBody,
      tags: ["contact-update"],
      priority: "normal",
    }),
  });
  if (!postRes.ok) {
    return NextResponse.json({ error: "Couldn't save the update — try again shortly." }, { status: 502 });
  }
  invalidateCommsMemo();

  // Owner SMS — staff may need to reprint a label with the new number.
  // After the response; nothing in it reads the alert's outcome. 2026-09-25.
  {
    const customerName = field(leadMsg.body, "Name") || "Customer";
    const text = `✏️ CONTACT: ${customerName} updated phone on offer ${leadId.slice(0, 10).toUpperCase()} → ${phoneClean}`;
    after(() => notifyOwnerSms(text.slice(0, 480)).catch(() => {}));
  }

  return NextResponse.json({ ok: true, phone: phoneClean });
}
