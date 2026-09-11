// /api/go/lock — the /go chat's "Lock it in". Re-quotes SERVER-SIDE
// (the client's number is never trusted), then records the lead as a
// STANDARD single-device [NEW BUYBACK LEAD] — the exact body format
// /api/lead writes — so a GO lock lands in the real lead system (admin
// feed, analytics, lookup, track, drips, reminders) instead of living
// only in an evictable one-off comm the 5000-cap feed can trim away.
// Unlike the chat route's fire-and-forget fan-out, delivery is AWAITED —
// "locked in." must not render unless at least one alert path actually
// accepted the lead.
//
// 2026-09-11 additions (the retention audit):
//   • PRICE-MOVED GUARD — the client sends the number it showed; if the
//     engine says something else now, we answer {moved:true, offer} BEFORE
//     any lead is written. The old flow posted the lead, then asked the
//     seller to "tap again" — two leads, two owner alerts, one seller.
//   • CONFIRMATION — the page promised "we'll text it to you" three times
//     and never did. A phone contact now gets one transactional text (offer,
//     lock-until date, MEET/SHIP keywords, deep link back to this thread);
//     an email contact gets the same by email. STOP is honored.
//   • Session: / Lock-Until: lines in the lead body so the crons can find
//     the thread and count down the 14-day lock.
//   • carrier "unknown" ("not sure" chip) prices at the AT&T tier and says so
//     in the lead — Sonny's default from the audit; a seller who tapped
//     "other" when they meant "unlocked" was quoted $204 on a $433 phone.
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
import { appendChatMsg, readChat, validSession, validGoSession } from "../../../lib/gochat-store";
import { sendCapiLead } from "../../../lib/meta-capi";
import { sendSellerSms, looksLikePhone, notesHaveOptOut } from "../../../lib/seller-sms";
import { sidToken } from "../../../lib/go-sid-token";
import { mailShell, esc, MAIL } from "../../../lib/email-shell";
import { after } from "next/server";
import { BOARD_MODELS } from "../../../go/board";
import { PRICE_TABLE } from "../../../data/prices";

const MC_API = "https://missioncontrolsdjg-production.up.railway.app";
const MC_KEY = process.env.MC_API_KEY || "";
const RESEND_KEY = process.env.RESEND_API_KEY || "";
const CONDITIONS = new Set(["sealed", "mint", "good", "fair", "broken"]);
const CARRIERS = new Set(["unlocked", "att", "tmobile", "verizon", "other", "unknown"]);
// The published promise: every quoted number holds 14 days.
const LOCK_DAYS = 14;

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
  unknown: "Not sure (priced as carrier-locked)",
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

function lockDateLabel(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "America/Chicago" });
}

// The seller-facing confirmation. One text or one email, about THIS quote
// only — the number they typed into "your number — we text you the quote".
async function sendConfirmation(opts: {
  contact: string; isEmail: boolean; label: string; storage: string; offer: number | null;
  lockUntil: string; sessionId: string;
}): Promise<{ sent: boolean; channel: "sms" | "email" | "none"; reason?: string }> {
  const { contact, isEmail, label, storage, offer, lockUntil, sessionId } = opts;
  const tok = validGoSession(sessionId) ? sidToken(sessionId) : "";
  const link = `https://topcashcellular.com/go${tok ? `?sid=${sessionId}&k=${tok}` : ""}`;
  const dev = `${label} ${STORAGE_DISPLAY[storage] || storage}`;
  const until = lockDateLabel(lockUntil);
  if (!isEmail) {
    if (!looksLikePhone(contact)) return { sent: false, channel: "none", reason: "not a phone" };
    // A seller who texted STOP in this thread must never get another text —
    // the session note is the cheap local check (the cross-session marker is
    // consulted by the crons, which already hold the comms window).
    if (validSession(sessionId)) {
      const state = await readChat(sessionId, 0);
      if (notesHaveOptOut(state.msgs.filter((m) => m.role === "note").map((m) => m.text))) {
        return { sent: false, channel: "sms", reason: "opted out" };
      }
    }
    const body = offer != null
      ? `Top Cash Cellular: your ${dev} offer is locked at $${offer} until ${until}. Reply MEET for a cash meetup in the Austin area or SHIP for a free FedEx label. Your chat: ${link} — Reply STOP to opt out.`
      : `Top Cash Cellular: we're pricing your ${dev} by hand — we'll text you a real offer shortly. Reply MEET if you're in the Austin area or SHIP for a free FedEx label. Your chat: ${link} — Reply STOP to opt out.`;
    return { sent: await sendSellerSms(contact, body), channel: "sms" };
  }
  if (!RESEND_KEY) return { sent: false, channel: "email", reason: "no resend key" };
  try {
    const { Resend } = await import("resend");
    const resend = new Resend(RESEND_KEY);
    const title = offer != null ? `Locked in — $${offer} for your ${esc(dev)}` : `We're pricing your ${esc(dev)} by hand`;
    const intro = offer != null
      ? `That number holds until <strong style="color:${MAIL.ink}">${esc(until)}</strong> if the device matches what you told us. Meet up in the Austin area for cash on the spot, or we send a free FedEx label — your pick. Reply to this email with <strong style="color:${MAIL.ink}">MEET</strong> or <strong style="color:${MAIL.ink}">SHIP</strong>, or pick it back up in your chat.`
      : `We'll send you a real offer shortly. Reply to this email with <strong style="color:${MAIL.ink}">MEET</strong> if you're in the Austin area or <strong style="color:${MAIL.ink}">SHIP</strong> for a free FedEx label, or pick it back up in your chat.`;
    const r = await resend.emails.send({
      from: "Top Cash Cellular <noreply@topcashcellular.com>",
      replyTo: "support@topcashcellular.com",
      to: contact,
      subject: offer != null ? `Your ${dev} offer is locked — $${offer} until ${until}` : `Your ${dev} — we're pricing it by hand`,
      html: mailShell({
        preheader: offer != null ? `$${offer} locked until ${until}` : "a real offer is on the way",
        eyebrow: "Your offer",
        title,
        introHtml: `<span style="color:${MAIL.body}">${intro}</span>`,
        buttonHref: link,
        buttonLabel: "Open my chat",
      }),
      text: offer != null
        ? `Your ${dev} offer is locked at $${offer} until ${until}. Reply MEET for a cash meetup in the Austin area or SHIP for a free FedEx label. Your chat: ${link}`
        : `We're pricing your ${dev} by hand and will send a real offer shortly. Reply MEET if you're in the Austin area or SHIP for a free FedEx label. Your chat: ${link}`,
    });
    return { sent: !r.error, channel: "email", reason: r.error ? String(r.error.message || "resend error") : undefined };
  } catch (e) {
    return { sent: false, channel: "email", reason: e instanceof Error ? e.message : "threw" };
  }
}

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
  // The number the seller is looking at. Optional (older bundles don't send
  // it); when present the engine must agree or no lead is written.
  const quotedOffer = typeof body.quotedOffer === "number" && Number.isFinite(body.quotedOffer) ? Math.round(body.quotedOffer) : null;

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
  // "unknown" = the seller isn't sure about the carrier: priced at the AT&T
  // tier (the middle of the locked gaps) and labeled as such in the lead, so
  // the number goes UP at inspection if it turns out unlocked, never down.
  const engineCarrier = carrier === "unknown" ? "att" : carrier;
  const r = await quoteDevice(
    {
      modelId: model,
      modelLabel: entry.label,
      storage,
      condition,
      carrier: engineCarrier,
      // "locked to a carrier" answered "verizon" = a Verizon-locked phone.
      carrierLocked: carrier === "verizon",
      isPhone: true,
    },
    await cachedOverrides(),
  ).catch(() => null);
  const offer = r && r.offer != null && !r.manualReview ? r.offer : null;

  // PRICE-MOVED GUARD: the engine disagrees with the number on the seller's
  // screen (a live price edit mid-session). Answer with the live number and
  // write NOTHING — the client repaints the card and the lock becomes an
  // explicit second tap on a number they've actually seen.
  if (quotedOffer != null && offer != null && offer !== quotedOffer) {
    return NextResponse.json({ ok: false, moved: true, offer });
  }

  const isEmail = EMAIL_RE.test(contact);
  const specLine = `${entry.label} ${storage} ${condition} ${carrier}`;
  // Funnel deviceType slug — analytics buckets devices on the first half
  // of the "Device: <type> — <model>" line, so GO leads must group with
  // funnel leads ("iphone"/"android"/"pixel"), never a new category.
  const deviceType = model.startsWith("ip") ? "iphone" : model.startsWith("px") ? "pixel" : "android";
  const ua = sanitize(req.headers.get("user-agent") || "unknown");
  const visitorId = sanitize(req.cookies.get("tcc_visitor_id")?.value || "").slice(0, 64);
  const safeIp = sanitize(ip).slice(0, 60);
  const lockUntil = new Date(Date.now() + LOCK_DAYS * 24 * 3600_000).toISOString();
  const hasGoSession = validGoSession(sessionId);

  // Standard single-device lead body — field-for-field the /api/lead
  // shape. Quote: TBD (custom) is the funnel's own no-engine-price
  // convention (manual-review model, or engine down at lock time).
  // SMS opt-in: /go collects a contact for THIS offer only, never
  // marketing consent, so a phone lead is recorded as opted OUT of
  // marketing texts. The transactional texts about this quote (confirmation,
  // one reminder, the lock-expiry note) are what the seller asked for when
  // they typed a number into "we text you the quote"; STOP ends them.
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
    hasGoSession ? `Session: ${sessionId}` : null,
    `Lock-Until: ${lockUntil}`,
    `[ATTEST: yes] Customer affirmed 18+ & legal ownership at submit (IP ${safeIp})`,
    `--- Handoff: TBD (seller picks) ---`,
    `Action: 14-day price lock from /go — seller was texted MEET/SHIP; reach out to arrange an Austin-area meetup or send a free FedEx label, seller's pick.`,
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
      `💰 GO lock: ${specLine}${offer != null ? ` — $${offer}` : " — needs manual quote"}\nReply to: ${contact}${name ? ` (${name})` : ""}\n${hasGoSession ? `https://topcashcellular.com/admin/chats?session=${sessionId}` : "https://topcashcellular.com/admin"}`,
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

  after(async () => {
    // The seller's confirmation — the text the page promised. After the
    // response so a slow relay never delays "locked in.".
    const c = await sendConfirmation({ contact, isEmail, label: entry.label, storage, offer, lockUntil, sessionId });
    if (validSession(sessionId)) {
      void appendChatMsg(
        sessionId,
        "note",
        c.sent
          ? `${c.channel === "sms" ? "SMS" : "Email"} sent to ${contact} (lock confirmation)`
          : `${c.channel === "sms" ? "SMS" : c.channel === "email" ? "Email" : "Confirmation"} ${c.reason === "opted out" ? "skipped" : "FAILED"} to ${contact} (lock confirmation${c.reason ? ` — ${c.reason}` : ""})`,
      );
    }
    // Server-side twin of the client's Lead pixel (same event id → Meta
    // dedupes). The FB in-app webview drops browser events exactly here, at
    // the money moment — this copy survives it. Best-effort.
    // Only when the client sent its dedup id: a client that reached this
    // POST also attempted the pixel, so a server copy WITHOUT the shared id
    // (stale pre-deploy bundle) would double-count, not backfill.
    if (!eventId) return;
    void sendCapiLead({
      eventId,
      sourceUrl: `https://topcashcellular.com/go${src ? `?src=${src}` : ""}`,
      ip: clientIp(req),
      userAgent: req.headers.get("user-agent"),
      contact,
      value: typeof offer === "number" ? offer : null,
      contentName: specLine.slice(0, 90),
      fbp: typeof body.fbp === "string" ? body.fbp : null,
      fbc: typeof body.fbc === "string" ? body.fbc : null,
    });
  });

  return NextResponse.json({ ok: true, offer, lockUntil });
}
