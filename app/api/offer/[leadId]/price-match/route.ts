// POST /api/offer/[leadId]/price-match
//
// The "Best Price Guarantee" form on the offer page. Customer says they
// found a higher quote at a competitor — we record it as a marker on
// MC, owner-SMS so staff sees it land, and staff then uses the existing
// counter-offer system to honor or beat. Deliberately human-in-the-loop:
// we don't trust an auto-honor pipeline (it'd be a margin-bleed exploit
// — anyone could paste a fake URL with a wild number).
//
// 2026-09-26: the signed link's `k` (app/lib/offer-link.ts) is the access
// control for every write here; the id alone gets the redacted read. The
// access-model paragraph below predates that.
// Access model mirrors /api/offer/[leadId]/cancel — the leadId is the
// secret, no sign-in required. Skywalker 2026-05-22.

import { NextRequest, NextResponse, after } from "next/server";
import { rateLimit, rateLimitResponse, clientIp } from "../../../../lib/rate-limit";
import { notifyOwnerSms } from "../../../../lib/owner-sms";
import { latestStatus, isDeleted } from "../../../../lib/lead-devices";
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

// Sanitize a free-text field so it can't forge marker brackets / inject
// a fake `\n` line into the marker body that the admin parser reads.
function clean(s: string, max: number): string {
  return s.replace(/[[\]\r\n]+/g, " ").trim().slice(0, max);
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

  if (!bodyIn) {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const body: { competitor?: unknown; amount?: unknown; url?: unknown; note?: unknown; kind?: unknown } = bodyIn;
  // Two flavors share this endpoint, owner-SMS, and human-in-the-loop
  // honoring:
  //   - "price-match": customer found a higher quote elsewhere (needs a
  //     competitor + their number).
  //   - "counter": customer just isn't happy with our number and wants
  //     to propose their own (no competitor required, note optional).
  const isCounter = body.kind === "counter";
  const competitor = clean(typeof body.competitor === "string" ? body.competitor : "", 60);
  const amount = Math.round(Number(body.amount));
  const url = clean(typeof body.url === "string" ? body.url : "", 240);
  const note = clean(typeof body.note === "string" ? body.note : "", 300);
  if (!isCounter && !competitor) {
    return NextResponse.json({ error: "Tell us where you got the other quote." }, { status: 400 });
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: isCounter ? "Enter the amount you were hoping for." : "Enter the dollar amount they quoted." }, { status: 400 });
  }
  // The URL is optional; if provided, lightly check it looks like a URL
  // before letting it land in the marker. Don't try to "verify" it — a
  // human reviews anyway.
  if (url && !/^https?:\/\//i.test(url)) {
    return NextResponse.json({ error: "If you include a link, it should start with http:// or https://." }, { status: 400 });
  }
  // Per-lead cap shared by every customer write on this offer — see the
  // cancel route. After validation so a rejected form doesn't spend it.
  // 2026-09-25.
  const rlLead = rateLimit(`offer-lead:${leadId}`, 10, 600_000);
  if (!rlLead.ok) return rateLimitResponse(rlLead.retryAfterMs);

  // Verify the lead exists (the leadId is the access secret). limit=5000
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

  // A cancelled or closed trade takes no request. The page hides the form
  // once an offer is paid or cancelled, but this route accepted one — and
  // fired an owner alert — on any lead. A trade in transit or inspection
  // stays open: the form still shows there, and staff answer through the
  // counter-offer flow. Restore-aware like the other write routes.
  // 2026-09-25.
  if (isDeleted(messages, leadId)) {
    return NextResponse.json({ error: "This offer was cancelled." }, { status: 409 });
  }
  const status = latestStatus(messages, leadId);
  if (status === "paid" || status === "met" || status === "rejected") {
    return NextResponse.json({
      error: "This trade is already closed — please email support@topcashcellular.com to discuss.",
    }, { status: 409 });
  }

  // Post the marker. Admin parses this in /api/admin/leads to badge
  // the lead row and surfaces the details so staff can mint a counter
  // through the existing counter-offer flow.
  const at = new Date().toISOString();
  const markerBody = isCounter
    ? `[COUNTER-REQUEST: leadId=${leadId} amount=${amount} at=${at}]${note ? `\nNote: ${note}` : ""}`
    : `[PRICE-MATCH-REQUEST: leadId=${leadId} competitor=${competitor} amount=${amount} at=${at}]${url ? `\nUrl: ${url}` : ""}${note ? `\nNote: ${note}` : ""}`;
  const postRes = await fetch(`${MC_API}/api/comms`, {
    method: "POST",
    headers: { "x-api-key": MC_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({
      // Own MC sender bucket for customer-originated posts — see the cancel
      // route. The marker text still says which request this is. 2026-09-25.
      from: "topcash-customer",
      fromName: "Top Cash Cellular (customer)",
      role: "system",
      body: markerBody,
      tags: isCounter ? ["counter-request", "request"] : ["price-match", "request"],
      priority: "high",
    }),
  });
  if (!postRes.ok) {
    return NextResponse.json({ error: "Couldn't record your request — try again shortly." }, { status: 502 });
  }
  invalidateCommsMemo();

  // Owner alert — staff sees it land in real time and can act before the
  // customer goes elsewhere. After the response; nothing in it reads the
  // alert's outcome. 2026-09-25.
  {
    const customerName = field(leadMsg.body, "Name") || "Customer";
    const model = field(leadMsg.body, "Model") || field(leadMsg.body, "Device") || "device";
    const ourQuote = field(leadMsg.body, "Quote") || "";
    const text = isCounter
      ? `💬 COUNTER: ${customerName} (${model}) isn't happy — wants $${amount}${ourQuote ? ` (we quoted ${ourQuote})` : ""}.${note ? ` "${note}"` : ""} Offer ${leadId.slice(0, 10).toUpperCase()}.`
      : `🎯 PRICE-MATCH: ${customerName} (${model}) says ${competitor} quoted $${amount}${ourQuote ? ` — we quoted ${ourQuote}` : ""}. Offer ${leadId.slice(0, 10).toUpperCase()}.`;
    after(() => notifyOwnerSms(text.slice(0, 480)).catch(() => {}));
  }

  return NextResponse.json({ ok: true, at });
}
