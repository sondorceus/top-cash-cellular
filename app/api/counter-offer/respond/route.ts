// Customer-side endpoint hit by the /counter/[token] page Accept and
// Decline buttons. Verifies the HMAC token, posts a [COUNTER-RESPONSE]
// marker to MC, and notifies the owner via SMS so they can flip the
// lead's actual status (paid prep or return-device flow).
//
// Token is single-use in effect: even though we don't burn it, we post
// a marker that the admin page will treat as terminal. A customer who
// re-clicks the accept link after responding just sees a "you've
// already responded" message from the /counter page.

import { NextRequest, NextResponse } from "next/server";
import { verifyCounterToken } from "../../../lib/counter-token";
import { reportError } from "../../../lib/error-report";
import { rateLimit, rateLimitResponse, clientIp } from "../../../lib/rate-limit";
import { notifyOwnerSms } from "../../../lib/owner-sms";
import { fetchCommsPaged } from "../../../lib/mc-comms";

const MC_API = "https://missioncontrolsdjg-production.up.railway.app";
const MC_KEY = process.env.MC_API_KEY || "";

export async function POST(req: NextRequest) {
  // Throttle — this drives a money decision (accept/decline) + owner SMS and,
  // unlike /api/lead and /api/confirm, had no limit. A forwarded token must
  // not be loopable into conflicting responses / an SMS flood.
  const rl = rateLimit(`counter-respond:${clientIp(req)}`, 15, 60_000);
  if (!rl.ok) return rateLimitResponse(rl.retryAfterMs);

  let body: { token?: string; response?: "accept" | "decline"; note?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { token, response, note } = body;
  if (!token) return NextResponse.json({ error: "token required" }, { status: 400 });
  if (response !== "accept" && response !== "decline") {
    return NextResponse.json({ error: "response must be 'accept' or 'decline'" }, { status: 400 });
  }

  const payload = verifyCounterToken(token);
  if (!payload) return NextResponse.json({ error: "Invalid or expired offer link" }, { status: 400 });
  // The id goes into the marker regexes below — the mint route only signs
  // [\w-]+ ids, so anything else is not a token we issued.
  if (!/^[\w-]+$/.test(payload.leadId)) return NextResponse.json({ error: "Invalid or expired offer link" }, { status: 400 });

  // Idempotency + double-response defense. Without this, a customer
  // (or anyone replaying the request) could:
  //   1. Click Accept → owner SMS "ACCEPTED, move to paid prep"
  //   2. Click Decline later → owner SMS "DECLINED, return device free"
  // The two notifications conflict and the staff acts on the second.
  //
  // The response must also answer the offer THIS token carries. Staff can
  // re-mint (a better offer after a decline, a lower one after more
  // inspection), and admin + /offer pair a response with the LATEST
  // [COUNTER-OFFER] only. So:
  //   - a token superseded by a later mint of a different amount is stale
  //     → 409 (an old link could otherwise "accept $200" while admin
  //     records it as the newer $150 offer accepted)
  //   - only responses posted AFTER the latest mint count for idempotency
  //     (a decline of offer #1 no longer blocks accepting re-issued #2, and
  //     an accept of #1 no longer silently swallows the accept of #2)
  //     · same response as the incoming → silently return ok (idempotent)
  //     · different response → refuse + tell the customer to contact staff
  //   - a lead closed (paid/met/rejected) or deleted AFTER this offer went
  //     out takes no answer
  // Paged read (was a single limit=300 slice, which lost the markers after a
  // few days). The token lives 14 days, so its own mint and anything after
  // it sit inside a 15-day window.
  if (MC_KEY) {
    try {
      const messages = await fetchCommsPaged({ apiKey: MC_KEY, includeArchive: true, sinceMs: 15 * 24 * 60 * 60 * 1000, pageSize: 5000, maxPages: 4 });
      const lid = payload.leadId;
      const coRe = new RegExp(`\\[COUNTER-OFFER:\\s*${lid}\\][^\\n]*?offer=\\$?([\\d,]+(?:\\.\\d+)?)`, "i");
      const crRe = new RegExp(`\\[COUNTER-RESPONSE:\\s*${lid}\\][^\\n]*?response=(accept|decline)`, "i");
      const stRe = new RegExp(`\\[STATUS:\\s*(\\w+)\\]\\s*\\[LEAD:\\s*${lid}\\]`, "i");
      const delRe = new RegExp(`\\[DELETED-LEAD:\\s*${lid}\\]`, "i");
      const resRe = new RegExp(`\\[RESTORED-LEAD:\\s*${lid}\\]`, "i");
      let mintTs = "", mintOffer: number | null = null;
      let status = "", statusTs = "";
      let deletedTs = "", restoredTs = "";
      for (const m of messages) {
        if (!m.body) continue;
        const co = m.body.match(coRe);
        if (co && m.timestamp > mintTs) { mintTs = m.timestamp; mintOffer = Math.round(parseFloat(co[1].replace(/,/g, ""))); }
        const st = m.body.match(stRe);
        if (st && m.timestamp > statusTs) { status = st[1].toLowerCase(); statusTs = m.timestamp; }
        if (delRe.test(m.body) && m.timestamp > deletedTs) deletedTs = m.timestamp;
        if (resRe.test(m.body) && m.timestamp > restoredTs) restoredTs = m.timestamp;
      }
      // Stale = a mint AFTER this token was signed carries a different
      // amount. The token's own marker (posted right after signing) always
      // has the token's amount, however slow that post was, and a re-send of
      // the SAME amount pairs to the same money, so the old link stays good.
      // No parsable amount → fall back to time (60s of clock skew).
      const mintMs = mintTs ? Date.parse(mintTs) : NaN;
      const stale = Number.isFinite(mintMs) && (mintOffer != null
        ? mintMs > payload.iat && mintOffer !== payload.offer
        : mintMs > payload.iat + 60_000);
      if (stale) {
        return NextResponse.json({
          error: "We sent you a newer offer for this trade — please use the link in our most recent text or email.",
        }, { status: 409 });
      }
      // Most-recent response to THIS offer: posted after the latest mint and
      // after this token was issued (so a response to an older offer never
      // counts, even when this token's own mint marker failed to post).
      const cutoffMs = Math.max(Number.isFinite(mintMs) ? mintMs : 0, payload.iat - 60_000);
      let prevResponse: "accept" | "decline" | null = null;
      let prevTs = "";
      for (const m of messages) {
        if (!m.body || Date.parse(m.timestamp) < cutoffMs) continue;
        const match = m.body.match(crRe);
        if (!match) continue;
        if (m.timestamp > prevTs) {
          prevTs = m.timestamp;
          prevResponse = match[1].toLowerCase() as "accept" | "decline";
        }
      }
      if (prevResponse === response) {
        return NextResponse.json({ ok: true, response, leadId: payload.leadId, idempotent: true });
      }
      if (prevResponse && prevResponse !== response) {
        return NextResponse.json({
          error: `This offer has already been ${prevResponse === "accept" ? "accepted" : "declined"}. Contact support@topcashcellular.com to change your decision.`,
        }, { status: 409 });
      }
      // Closed/deleted refuses only when that happened AFTER this offer went
      // out. Staff can still send an offer on a lead closed days ago (the
      // mint route's closed check reads only the newest 1000 comms, e.g. a
      // "no-show" rejected lead that came back), and that deliberate offer
      // must stay answerable. "Went out" = its mint marker (or a later
      // same-amount re-send, which `stale` let through), else the token's
      // own clock when that marker never posted.
      const issuedMs = Number.isFinite(mintMs) && mintMs >= payload.iat - 60_000 ? mintMs : payload.iat;
      if (deletedTs && (!restoredTs || restoredTs < deletedTs) && Date.parse(deletedTs) > issuedMs) {
        return NextResponse.json({
          error: "This trade was cancelled. Contact support@topcashcellular.com if that's a mistake.",
        }, { status: 409 });
      }
      if (["paid", "met", "rejected"].includes(status) && Date.parse(statusTs) > issuedMs) {
        return NextResponse.json({
          error: `This trade is already closed (${status}). Contact support@topcashcellular.com if something looks wrong.`,
        }, { status: 409 });
      }
    } catch {
      // Non-fatal — proceed with posting the response if MC lookup fails.
      // Worst case: idempotency not enforced this request, marker is
      // still posted (most-recent-wins on the admin side).
    }
  }

  // Post the response marker. The admin /api/admin/leads route parses
  // [COUNTER-RESPONSE: <leadId>] response=accept|decline to surface
  // the outcome on the lead row.
  //
  // Strip [ and ] from note text before interpolation. Without this a
  // note like `] [STATUS: paid` would close the COUNTER-RESPONSE
  // marker and inject a downstream [STATUS:] / [LEAD:] token that the
  // admin parser would happily honor on this lead.
  const noteText = (note || "").replace(/[\[\]\n\r]/g, " ").slice(0, 300);
  const markerBody = `[COUNTER-RESPONSE: ${payload.leadId}] response=${response} offer=$${payload.offer} original=$${payload.originalQuote}${noteText ? ` note=${noteText}` : ""}`;
  if (MC_KEY) {
    try {
      await fetch(`${MC_API}/api/comms`, {
        method: "POST",
        headers: { "x-api-key": MC_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: "topcash-web",
          fromName: "Top Cash Cellular",
          role: "system",
          body: markerBody,
          tags: ["counter-offer", `response-${response}`],
          priority: "high",
        }),
      });
    } catch (err) {
      reportError("counter-offer.response.marker", err, { leadId: payload.leadId, critical: false });
    }
  }

  // Owner alert so staff acts immediately (accepted = move toward paid;
  // declined = arrange return shipping). Routed through the shared helper —
  // this route used to roll its own Twilio call, which meant NO alert at all
  // with Twilio dead; the helper emails via Resend (and still tries SMS).
  try {
    const verb = response === "accept" ? "ACCEPTED ✅" : "DECLINED ❌";
    await notifyOwnerSms(
      `TCC: Counter-offer ${verb} — Lead ${payload.leadId}, offer $${payload.offer} (was $${payload.originalQuote}). ${response === "accept" ? "Move to paid prep." : "Return device free."}${noteText ? ` Their note: "${noteText.slice(0, 200)}"` : ""}`,
    );
  } catch (err) {
    reportError("counter-offer.response.owner-alert", err, { leadId: payload.leadId, critical: false });
  }

  return NextResponse.json({ ok: true, response, leadId: payload.leadId });
}
