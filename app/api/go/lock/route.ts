// /api/go/lock — the /go board's "Lock In My Offer". Re-quotes SERVER-SIDE
// (the client's number is never trusted), then records the lead as a
// STANDARD single-device [NEW BUYBACK LEAD] — the exact body format
// /api/lead writes — so a GO lock lands in the real lead system (admin
// feed, analytics, lookup, track, drips, reminders) instead of living
// only in an evictable one-off comm the 5000-cap feed can trim away.
// Unlike the chat route's fire-and-forget fan-out, delivery is AWAITED —
// "locked in." must not render unless at least one alert path actually
// accepted the lead.
//
// Why not POST /api/lead internally: that route hard-requires a name and
// rejects phone-bearing leads without an SMS-marketing opt-in (its TCPA
// gate) — /go collects neither (name optional, one contact field, no
// marketing consent), and fabricating either would poison the audit
// trail. So this follows the same minimal-subset pattern as /api/lead's
// recycle + quote-save handlers: same marker, same line-anchored field
// lines, same tags, parsed by the same admin parser. Two format contracts
// to know before editing the body below (both in app/api/admin/leads):
//   - parseField is line-anchored first-match — customer fields sit ABOVE
//     Quote:/Payout:, hence the newline-stripping sanitize().
//   - the phantom-preview skip drops any lead with a $ quote, Payout: TBD,
//     and NO "--- Handoff:" block — the handoff block below is REQUIRED,
//     not decoration.
import { NextRequest, NextResponse } from "next/server";
import { quoteDevice } from "../../../lib/quote";
import { cachedOverrides } from "../../../lib/overrides-cache";
import { clientIp, rateLimit } from "../../../lib/rate-limit";
import { notifyOwnerSms } from "../../../lib/owner-sms";
import { appendChatMsg, validSession } from "../../../lib/gochat-store";
import { sendCapiLead } from "../../../lib/meta-capi";
import { after } from "next/server";
import { BOARD_MODELS } from "../../../go/board";
import { PRICE_TABLE } from "../../../data/prices";

const MC_API = "https://missioncontrolsdjg-production.up.railway.app";
const MC_KEY = process.env.MC_API_KEY || "";
const CONDITIONS = new Set(["sealed", "mint", "good", "fair", "broken"]);
const CARRIERS = new Set(["unlocked", "att", "tmobile", "verizon", "other"]);

// Display strings for the lead body. The admin margin recompute feeds the
// Condition string through resellMultiplierForCondition()'s substring
// match, so "Fair (some wear)" MUST contain "fair" and the broken tier
// "crack"/"broken" — a bare "some wear" would silently price at the 1.0
// mint tier.
const CONDITION_DISPLAY: Record<string, string> = {
  sealed: "Sealed in box", mint: "Like new", good: "Good",
  fair: "Fair (some wear)", broken: "Cracked / broken",
};
const CARRIER_DISPLAY: Record<string, string> = {
  unlocked: "Unlocked", att: "AT&T", tmobile: "T-Mobile", verizon: "Verizon", other: "Other",
};
const STORAGE_DISPLAY: Record<string, string> = {
  "64": "64GB", "128": "128GB", "256": "256GB", "512": "512GB", "1tb": "1TB", "2tb": "2TB",
};

// Same scrub as /api/lead's cleanField: brackets (the admin parser keys on
// [STATUS:]/[LEAD:] markers anywhere in a comm body) AND newlines/tabs —
// the lead body is line-anchored "Key: value" fields with the customer's
// Name/Phone lines ABOVE the real Quote:/Payout: lines, so a \n inside a
// field could inject a forged first-match "Quote: $99999" line.
function sanitize(s: string): string {
  return s.replace(/[\[\]\n\r\t]/g, " ").slice(0, 200).trim();
}

const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;
const PHONE_RE = /(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/;

export async function POST(req: NextRequest) {
  const ip = clientIp(req);
  // Cheap pre-parse cap only. The REAL per-IP and global budgets are
  // charged after validation passes, so junk POSTs can't burn a legit
  // seller's allowance (the /api/chat convention, which this route
  // originally inverted).
  if (!rateLimit(`golockraw:${ip}`, 30, 10 * 60_000).ok) {
    return NextResponse.json({ ok: false, error: "too many tries — give it a minute" }, { status: 429 });
  }
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "bad json" }, { status: 400 });
  }

  const model = String(body.model || "");
  const entry = BOARD_MODELS.find((m) => m.id === model);
  const storage = String(body.storage || "");
  const condition = String(body.condition || "");
  const carrier = String(body.carrier || "");
  const name = sanitize(String(body.name || "")).slice(0, 80);
  const contact = sanitize(String(body.contact || "")).slice(0, 120);
  const attest = body.attest === true;
  const src = String(body.src || "").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 8);
  const sessionId = String(body.sessionId || "").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 24);
  const eventId = String(body.eventId || "").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 64);

  if (!entry || !Object.hasOwn(PRICE_TABLE[model] || {}, storage) || !CONDITIONS.has(condition) || !CARRIERS.has(carrier)) {
    return NextResponse.json({ ok: false, error: "bad spec" }, { status: 400 });
  }
  if (!EMAIL_RE.test(contact) && !PHONE_RE.test(contact)) {
    return NextResponse.json({ ok: false, error: "we need a real phone or email to reach you" }, { status: 400 });
  }
  if (!attest) {
    return NextResponse.json({ ok: false, error: "attestation required" }, { status: 400 });
  }

  // Validation passed — now charge the real budgets. Per-IP guards one
  // abuser; the "global" bucket is per-lambda-instance (rate-limit.ts is
  // in-process), so it bounds burst-per-instance, NOT a true fleet-wide
  // cap — an honest backstop, not a guarantee.
  if (!rateLimit(`golock:${ip}`, 6, 30 * 60_000).ok || !rateLimit("golock:global", 40, 10 * 60_000).ok) {
    return NextResponse.json({ ok: false, error: "too many tries — give it a minute" }, { status: 429 });
  }

  // Engine is the only price authority — quote fresh at lock time.
  const r = await quoteDevice(
    {
      modelId: model,
      modelLabel: entry.label,
      storage,
      condition,
      carrier,
      // "locked to a carrier" answered "verizon" = a Verizon-locked phone.
      carrierLocked: carrier === "verizon",
      isPhone: true,
    },
    await cachedOverrides(),
  ).catch(() => null);
  const offer = r && r.offer != null && !r.manualReview ? r.offer : null;

  const isEmail = EMAIL_RE.test(contact);
  const specLine = `${entry.label} ${storage} ${condition} ${carrier}`;
  // Funnel deviceType slug — analytics buckets devices on the first half
  // of the "Device: <type> — <model>" line, so GO leads must group with
  // funnel leads ("iphone"/"android"/"pixel"), never a new category.
  const deviceType = model.startsWith("ip") ? "iphone" : model.startsWith("px") ? "pixel" : "android";
  const ua = sanitize(req.headers.get("user-agent") || "unknown");
  const visitorId = sanitize(req.cookies.get("tcc_visitor_id")?.value || "").slice(0, 64);
  const safeIp = sanitize(ip).slice(0, 60);

  // Standard single-device lead body — field-for-field the /api/lead
  // shape. Quote: TBD (custom) is the funnel's own no-engine-price
  // convention (manual-review model, or engine down at lock time).
  // SMS opt-in: /go collects a contact for THIS offer only, never
  // marketing consent, so a phone lead is recorded as opted OUT and the
  // admin status-SMS gate will refuse to market-text it.
  const mcBody = [
    `[NEW BUYBACK LEAD]`,
    `Name: ${name}`,
    `Phone: ${isEmail ? "" : contact}`,
    isEmail ? `Email: ${contact}` : null,
    `Device: ${deviceType} — ${entry.label}`,
    `Storage: ${STORAGE_DISPLAY[storage] || storage}`,
    `Carrier: ${CARRIER_DISPLAY[carrier] || carrier}`,
    `Condition: ${CONDITION_DISPLAY[condition] || condition}`,
    offer != null ? `Quote: $${offer}` : `Quote: TBD (custom)`,
    `Payout: TBD`,
    isEmail ? null : `SMS opt-in: no`,
    `Source: source=go${src ? ` · content=${src}` : ""} · landed=/go${src ? `?src=${src}` : ""}`,
    `Source-IP: ${safeIp}`,
    `Source-UA: ${ua}`,
    visitorId ? `Visitor-ID: ${visitorId}` : null,
    `[ATTEST: yes] Customer affirmed 18+ & legal ownership at submit (IP ${safeIp})`,
    `--- Handoff: TBD (seller picks) ---`,
    `Action: 14-day price lock from the /go board — reach out to arrange an Austin-area meetup or send a free FedEx label, seller's pick.`,
  ].filter(Boolean).join("\n");

  // AWAITED delivery — a lead that vanishes after "locked in." is worse
  // than a visible failure. ok only if at least one path accepted it.
  let mcOk = false;
  try {
    const res = await fetch(`${MC_API}/api/comms`, {
      method: "POST",
      headers: { "x-api-key": MC_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "topcash-web",
        fromName: "Top Cash Cellular",
        role: "system",
        body: mcBody,
        // "lead"+"buyback" is the funnel convention every lead consumer
        // expects; "go-lock" keeps provenance; sess-<id> ties the lead to
        // its /go chat session the way chat leads are tied.
        tags: ["lead", "buyback", "go-lock", ...(sessionId ? [`sess-${sessionId}`] : [])],
        priority: "urgent",
      }),
    });
    mcOk = res.ok;
    if (!res.ok) console.error(`[go/lock] MC post failed: ${res.status}`);
  } catch (e) {
    console.error("[go/lock] MC post threw:", e);
  }
  let smsOk = false;
  try {
    smsOk = await notifyOwnerSms(
      `💰 GO lock: ${specLine}${offer != null ? ` — $${offer}` : " — needs manual quote"}\nReply to: ${contact}${name ? ` (${name})` : ""}\nhttps://topcashcellular.com/admin`,
    );
  } catch (e) {
    console.error("[go/lock] owner alert threw:", e);
  }
  if (!mcOk && !smsOk) {
    return NextResponse.json({ ok: false, error: "couldn't save that — tap it once more" }, { status: 502 });
  }

  // Park the contact + the lock milestone in the chat store so the
  // /admin/chats console can text this seller and the chat brain knows the
  // lock happened. Notes are internal-only — never sent to the seller
  // client — and written HERE (server-side, engine result in hand) so the
  // LOCKED breadcrumb can't be client-forged.
  if (validSession(sessionId)) {
    void appendChatMsg(sessionId, "note", `CONTACT: ${contact}`);
    void appendChatMsg(sessionId, "note", `LOCKED: ${specLine}${offer != null ? ` $${offer}` : " (manual)"} — ${contact.slice(0, 60)}`);
  }

  // Server-side twin of the client's Lead pixel (same event id → Meta
  // dedupes). The FB in-app webview drops browser events exactly here, at
  // the money moment — this copy survives it. Best-effort, after-response.
  after(() => {
    // Only when the client sent its dedup id: a client that reached this
    // POST also attempted the pixel, so a server copy WITHOUT the shared id
    // (stale pre-deploy bundle) would double-count, not backfill.
    if (!eventId) return;
    void sendCapiLead({
      eventId,
      sourceUrl: "https://topcashcellular.com/go",
      ip: clientIp(req),
      userAgent: req.headers.get("user-agent"),
      contact,
      value: typeof offer === "number" ? offer : null,
      contentName: specLine.slice(0, 90),
    });
  });

  return NextResponse.json({ ok: true, offer });
}
