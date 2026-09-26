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
//   • Spec resolution lives in app/go/spec.ts, shared with /api/go/quote —
//     phones, iPads and consoles, one contract, so the two routes can never
//     disagree on a number.
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
import { clientIp, rateLimit } from "../../../lib/rate-limit";
import { notifyOwnerSms } from "../../../lib/owner-sms";
import { appendChatMsg, readChat, validSession, validGoSession, rememberPhoneSession, phoneKey, type StoredMsg } from "../../../lib/gochat-store";
import { sendCapiLead, isTestConversion } from "../../../lib/meta-capi";
import { sendSellerSms, looksLikePhone, notesHaveOptOut, toE164 } from "../../../lib/seller-sms";
import { after } from "next/server";
import { sendLockConfirmationEmail, goChatLink, lockDateLabel, LOCK_DAYS } from "../../../lib/lock-confirmation";
import { resolveGoSpec, goQuote, type GoSpec } from "../../../go/spec";
import { leadSourceLine } from "../../../lib/lead-source";
import { clientGeo, AREA_WORDS } from "../../../lib/geo";
import { MANUAL_REVIEW_DEVICES } from "../../../data/prices";

const MC_API = "https://missioncontrolsdjg-production.up.railway.app";
const MC_KEY = process.env.MC_API_KEY || "";

// MC post 12 s + owner alert 12 s + store notes + the confirmation's
// background tail — a lock never legitimately needs more.
export const maxDuration = 90;

// ONE LEAD PER TAP (2026-09-26). A lost response looks exactly like a lost
// request on a phone, and the retap ran the whole lock again: two leads, two
// owner alerts, two confirmation texts. Two guards, both before any write:
//   • the client's eventId (its Meta dedup id, stable per lock form) — a
//     repeat of an id whose first run wrote a lead gets that run's response
//     back (per instance, like /api/chat's turn map);
//   • a LOCKED note for the same spec AND contact inside the last 10
//     minutes IS this lock — answered from the notes, nothing re-sent —
//     unless it carries a different eventId (an identical second device
//     locked from its own form, "+ i have another one").
const LOCK_MAX = 300;
const locks = new Map<string, Promise<unknown>>();
const LOCK_DEDUPE_MS = 10 * 60_000;

// Same scrub as /api/lead's cleanField: brackets (the admin parser keys on
// [STATUS:]/[LEAD:] markers anywhere in a comm body) AND newlines/tabs —
// the lead body is line-anchored "Key: value" fields with the customer's
// Name/Phone lines ABOVE the real Quote:/Payout: lines, so a \n inside a
// field could inject a forged first-match "Quote: $99999" line.
// U+2028/U+2029 too (same set as /api/lead's cleanField) — JS regexes treat
// them as line breaks, and Next URL-decodes the visitor cookie.
function sanitize(s: string): string {
  return s.replace(/[\[\]\n\r\t\u2028\u2029]/g, " ").slice(0, 200).trim();
}

const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;
const PHONE_RE = /(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/;


// The seller-facing confirmation. One text or one email, about THIS quote
// only — the number they typed into "your number — we text you the quote".
async function sendConfirmation(opts: {
  contact: string; isEmail: boolean; spec: GoSpec; offer: number | null;
  lockUntil: string; sessionId: string;
}): Promise<{ sent: boolean; channel: "sms" | "email" | "none"; reason?: string }> {
  const { contact, isEmail, spec, offer, lockUntil, sessionId } = opts;
  const link = goChatLink(sessionId);
  const dev = spec.storage === "base" && !spec.entry.storageLabels ? spec.entry.label : `${spec.entry.label} ${spec.display.storage}`;
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
  const r = await sendLockConfirmationEmail({ to: contact, dev, offer, lockUntil, sessionId });
  return { sent: r.sent, channel: "email", reason: r.reason };
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
  // The client's per-lock dedup id (also the Meta event id). A repeat of an
  // id that already wrote a lead replays that lead's response instead of
  // running the lock again; a refused run lets the retry through.
  const eventId = String(body.eventId || "").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 64);
  const seen = eventId ? locks.get(eventId) : undefined;
  if (seen) {
    const replay = await seen;
    if (replay) return NextResponse.json(replay);
  }
  const run = handleLock(req, body, ip, eventId);
  if (eventId) {
    if (locks.size >= LOCK_MAX) locks.delete(locks.keys().next().value as string);
    locks.set(eventId, run.then(async (r) => {
      if (!r.ok) return null;
      const j = await r.clone().json();
      return j?.ok ? j : null; // moved:true is a 200 too — not a lead, not replayed
    }).catch(() => null));
  }
  return run;
}

async function handleLock(req: NextRequest, body: Record<string, unknown>, ip: string, eventId: string): Promise<NextResponse> {
  const name = sanitize(String(body.name || "")).slice(0, 80);
  const contact = sanitize(String(body.contact || "")).slice(0, 120);
  const attest = body.attest === true;
  const src = String(body.src || "").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 10);
  const landedPath = String(body.landed || "").replace(/[^a-zA-Z0-9_\-/?=&.]/g, "").slice(0, 80);
  const sessionId = String(body.sessionId || "").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 24);
  // The number the seller is looking at. Optional (older bundles don't send
  // it); when present the engine must agree or no lead is written.
  const quotedOffer = typeof body.quotedOffer === "number" && Number.isFinite(body.quotedOffer) ? Math.round(body.quotedOffer) : null;
  // "won't turn on / parts" chip: not an engine tier (the engine's broken
  // tier assumes the device powers on), so the lead is written with NO
  // number and a hand-quote condition — never a broken-tier price a dead
  // phone can't earn. The client sends condition "broken" so the resolver
  // accepts the spec.
  const parts = body.parts === true;

  const resolved = resolveGoSpec({
    model: body.model, storage: body.storage, condition: body.condition, carrier: body.carrier, opt: body.opt,
    processor: body.processor, memory: body.memory, extras: body.extras,
  });
  if (!resolved.ok) {
    return NextResponse.json({ ok: false, error: "bad spec" }, { status: 400 });
  }
  const spec = resolved.spec;
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

  const PARTS_LABEL = "Won't turn on / parts";
  const specLine = parts ? spec.specLine.replace(/\bbroken\b/, "won't turn on / parts") : spec.specLine;
  // The session's notes, read once: the same-lock guard below, the IMEI
  // lookups the chat ran (they ride on the lead) and whether a GEO note is
  // already on file.
  let notes: StoredMsg[] = [];
  let notesRead = false;
  if (validSession(sessionId)) {
    try { notes = (await readChat(sessionId, 0)).msgs.filter((m) => m.role === "note"); notesRead = true; } catch { /* no notes */ }
  }
  // SAME LOCK TWICE (2026-09-26): a retap after a lost response — or the
  // same eventId landing on another instance — must not write a second
  // lead, alert the owner again or text the seller again. A LOCKED note for
  // this exact spec and contact inside the last 10 minutes IS this lock,
  // unless its LOCK-EVENT note names a different form (an identical second
  // device): answered from the notes, with what the confirmation notes say.
  const reEsc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const sameLock = new RegExp(`^LOCKED: ${reEsc(specLine)} (?:\\$(\\d+)|\\(manual\\)) — ${reEsc(contact.slice(0, 60))}$`);
  const recentLock = [...notes].reverse().find((m) => m.ts >= Date.now() - LOCK_DEDUPE_MS && sameLock.test(m.text));
  if (recentLock) {
    const since = notes.filter((m) => m.ts >= recentLock.ts).map((m) => m.text);
    const priorEvent = since.find((t) => t.startsWith("LOCK-EVENT: "))?.slice("LOCK-EVENT: ".length).trim() || "";
    if (!eventId || !priorEvent || priorEvent === eventId) {
      const priorOffer = Number(recentLock.text.match(sameLock)?.[1] || 0) || null;
      const priorLeadId = [...since].reverse().find((t) => t.startsWith("LEAD-ID: "))?.slice("LEAD-ID: ".length).trim() || null;
      const priorConfirmed: "sms" | "email" | "pending" | "failed" =
        since.some((t) => /^SMS sent to .*\(lock confirmation\)/.test(t)) ? "sms"
          : since.some((t) => /^Email sent to .*\(lock confirmation/.test(t)) ? "email"
            : since.some((t) => /^(SMS|Email|Confirmation) (FAILED|skipped) to .*\(lock confirmation/.test(t)) ? "failed"
              : "pending";
      return NextResponse.json({ ok: true, offer: priorOffer, lockUntil: new Date(recentLock.ts + LOCK_DAYS * 24 * 3600_000).toISOString(), confirmed: priorConfirmed, replayed: true, ...(priorLeadId ? { leadId: priorLeadId } : {}) });
    }
  }

  // Engine is the only price authority — quote fresh at lock time, through
  // the same resolver /api/go/quote used to show the number.
  const offer = parts ? null : await goQuote(spec);

  // PRICE-MOVED GUARD: the engine disagrees with the number on the seller's
  // screen (a live price edit mid-session). Answer with the live number and
  // write NOTHING — the client repaints the card and the lock becomes an
  // explicit second tap on a number they've actually seen.
  if (quotedOffer != null && offer != null && offer !== quotedOffer) {
    // The card is about to repaint with the live number — record it the way
    // /api/go/quote does (server-side, engine result in hand) so the chat
    // brain's quote table, the console and a restored card all show it. The
    // move itself is logged here too; the page used to post it through
    // chat-sync, where any script can write that line. ($quotedOffer is the
    // client's claim — the chat route checks it against the quote notes.)
    if (validGoSession(sessionId)) {
      after(async () => {
        await appendChatMsg(sessionId, "note", `price moved at lock: $${quotedOffer} → $${offer}`);
        await appendChatMsg(sessionId, "note", `quote shown: ${spec.specLine} → $${offer}`);
        await appendChatMsg(sessionId, "note", `QSPEC: ${spec.entry.id}|${spec.storage}|${spec.condition}|${spec.secondary}|${offer}`);
      });
    }
    return NextResponse.json({ ok: false, moved: true, offer });
  }

  // ONE NUMBER, THREE LOCKS A DAY across every session (2026-09-26). The
  // confirmation text below is what makes a phone→session pointer real, so
  // a script locking a stranger's number from many sessions must not get
  // to text it from each of them. Charged here — past the spec, contact and
  // price-moved checks, before anything is written — so a repaint retap
  // spends nothing. Email contacts have no number to cap.
  const lockPhone = phoneKey(toE164(contact) || "");
  if (lockPhone && !rateLimit(`lock-phone:${lockPhone}`, 3, 24 * 60 * 60_000).ok) {
    return NextResponse.json({ ok: false, error: "that number has locked a few quotes today — our team will follow up by text on those" }, { status: 429 });
  }

  const isEmail = EMAIL_RE.test(contact);
  const ua = sanitize(req.headers.get("user-agent") || "unknown");
  const visitorId = sanitize(req.cookies.get("tcc_visitor_id")?.value || "").slice(0, 64);
  const safeIp = sanitize(ip).slice(0, 60);
  const geo = clientGeo(req);
  const lockUntil = new Date(Date.now() + LOCK_DAYS * 24 * 3600_000).toISOString();
  const hasGoSession = validGoSession(sessionId);
  // IMEI lookups the chat already ran for this thread — the accurate
  // identification rides on the lead whatever the chips said. (From the
  // notes read above; no session = nothing to read, and no GEO write.)
  const imeiFacts = notes.filter((m) => m.text.startsWith("IMEI: ")).map((m) => m.text).slice(-3);
  const hasGeoNote = !notesRead || notes.some((m) => m.text.startsWith("GEO: "));

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
    `Device: ${spec.deviceType} — ${spec.entry.label}`,
    `Storage: ${spec.display.storage}`,
    spec.display.secondaryKey ? `${spec.display.secondaryKey}: ${spec.display.secondaryValue}` : null,
    `Condition: ${parts ? `${PARTS_LABEL} — hand quote (the engine prices only devices that power on)` : spec.display.condition}`,
    spec.display.notes ? `Notes: ${spec.display.notes}` : null,
    ...imeiFacts,
    offer != null ? `Quote: $${offer}` : `Quote: TBD (custom)`,
    `Payout: TBD`,
    isEmail ? null : `SMS opt-in: no`,
    leadSourceLine("go", src, landedPath || `/go${src ? `?src=${src}` : ""}`),
    `Location: ${sanitize(geo.label)} (${AREA_WORDS[geo.area]})`,
    `Source-IP: ${safeIp}`,
    `Source-UA: ${ua}`,
    visitorId ? `Visitor-ID: ${visitorId}` : null,
    hasGoSession ? `Session: ${sessionId}` : null,
    `Lock-Until: ${lockUntil}`,
    `[ATTEST: yes] Customer affirmed 18+ & legal ownership at submit (IP ${safeIp})`,
    `--- Handoff: TBD (seller picks) ---`,
    `Action: 14-day price lock from /go — the seller gets a confirmation text/email with MEET/SHIP (delivery status in the session notes); reach out to arrange an Austin-area meetup or send a free FedEx label, seller's pick.`,
    // Same flag /api/lead attaches for MANUAL_REVIEW_DEVICES (high-value
    // MacBooks etc.): the number is shown, the lead is marked for a human
    // check before payout.
    ...(MANUAL_REVIEW_DEVICES.has(spec.entry.id)
      ? ["⚠️ MANUAL REVIEW REQUIRED — high-value device", "Verify: condition matches description, check IMEI/serial, confirm config (chip/RAM/storage)"]
      : []),
  ].filter(Boolean).join("\n");

  // AWAITED delivery — a lead that vanishes after "locked in." is worse
  // than a visible failure. ok only if at least one path accepted it.
  let mcOk = false;
  let leadId: string | null = null;
  try {
    const res = await fetch(`${MC_API}/api/comms`, {
      method: "POST",
      headers: { "x-api-key": MC_KEY, "Content-Type": "application/json" },
      // A stalled MC must not hold "locking…" until the platform timeout —
      // the owner alert below is the fallback path.
      signal: AbortSignal.timeout(12_000),
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
    // The lead's MC id — the label route attaches [LABEL:] markers to it.
    else { try { const j = await res.json(); if (typeof j?.message?.id === "string") leadId = j.message.id; } catch { /* no id, label still mints */ } }
  } catch (e) {
    console.error("[go/lock] MC post threw:", e);
  }
  // The owner alert only DECIDES the response when MC refused the lead; with
  // the lead saved it finishes in the background. Either way the wait is
  // bounded: Twilio, Resend and the relay calls carry no timeout of their
  // own, and a stall used to hold "locking…" until the platform 504 — the
  // seller's retap then wrote a second lead and a second alert.
  const alertP = notifyOwnerSms(
    `💰 GO lock: ${specLine}${offer != null ? ` — $${offer}` : " — needs manual quote"}\n📍 ${geo.label}${geo.area === "metro" ? "" : ` (${AREA_WORDS[geo.area]})`}\nReply to: ${contact}${name ? ` (${name})` : ""}\n${hasGoSession ? `https://topcashcellular.com/admin/chats?session=${sessionId}` : "https://topcashcellular.com/admin"}`,
    // The lead's MC id rides along → the alert email gets the one-tap
    // "✅ Mark contacted" pill (app/lib/lead-token.ts).
    leadId ? { leadId } : undefined,
  ).catch((e) => {
    console.error("[go/lock] owner alert threw:", e);
    return false;
  });
  after(() => alertP);
  let smsOk = false;
  if (!mcOk) {
    let timer: ReturnType<typeof setTimeout> | undefined;
    smsOk = await Promise.race([
      alertP,
      new Promise<boolean>((r) => { timer = setTimeout(() => r(false), 12_000); }),
    ]);
    clearTimeout(timer);
    if (!smsOk) console.error("[go/lock] MC failed and the owner alert did not confirm in time");
  }
  if (!mcOk && !smsOk) {
    return NextResponse.json({ ok: false, error: "couldn't save that — tap it once more" }, { status: 502 });
  }

  // Park the contact + the lock milestone in the chat store so the
  // /admin/chats console can text this seller and the chat brain knows the
  // lock happened. Notes are internal-only — never sent to the seller
  // client — and written HERE (server-side, engine result in hand) so the
  // LOCKED breadcrumb can't be client-forged.
  // AWAITED (one blob round-trip): these notes are what the console, the
  // reminders cron and the funnel card read. A fire-and-forget put can be
  // cut off when the function exits right after the response. (The
  // phone→session pointer the inbound-SMS matcher reads is written below,
  // only once the confirmation text has actually gone out — 2026-09-26.)
  // LOCK-EVENT pairs the lock with the form it came from (the same-lock
  // guard above tells a retap from an identical second device by it).
  if (validSession(sessionId)) {
    await Promise.all([
      appendChatMsg(sessionId, "note", `CONTACT: ${contact}`),
      ...(!hasGeoNote && geo.area !== "unknown" ? [appendChatMsg(sessionId, "note", `GEO: ${geo.label} · area=${geo.area}`)] : []),
      appendChatMsg(sessionId, "note", `LOCKED: ${specLine}${offer != null ? ` $${offer}` : " (manual)"} — ${contact.slice(0, 60)}`),
      ...(eventId ? [appendChatMsg(sessionId, "note", `LOCK-EVENT: ${eventId}`)] : []),
      ...(leadId ? [appendChatMsg(sessionId, "note", `LEAD-ID: ${leadId}`)] : []),
    ]);
  }

  // The seller's confirmation — the text the page promised. Raced against a
  // budget so the locked card can say "we just texted you" only when that
  // is TRUE (the relay has been down for days at a time); the send itself
  // always runs to completion inside after(). 8 s since 2026-09-26 (was
  // 2.5 s): the relay's own ceiling is 8 s, so a send that fails slowly no
  // longer leaves the card on "we'll text you the details shortly" with no
  // email fallback — the 2026-09-23 failure survived on that path.
  const confirmation = sendConfirmation({ contact, isEmail, spec, offer, lockUntil, sessionId });
  const early = await Promise.race<{ sent: boolean; channel: string } | null>([
    confirmation,
    new Promise<null>((r) => setTimeout(() => r(null), 8_000)),
  ]);
  // sms/email = delivered before the response; pending = still in flight;
  // failed = the channel refused (relay down, opted out) — the card must not
  // promise a text in that case.
  const confirmed: "sms" | "email" | "pending" | "failed" =
    early == null ? "pending" : early.sent ? (early.channel === "email" ? "email" : "sms") : "failed";

  after(async () => {
    const c = await confirmation;
    if (validSession(sessionId)) {
      await appendChatMsg(
        sessionId,
        "note",
        c.sent
          ? `${c.channel === "sms" ? "SMS" : "Email"} sent to ${contact} (lock confirmation)`
          : `${c.channel === "sms" ? "SMS" : c.channel === "email" ? "Email" : "Confirmation"} ${c.reason === "opted out" ? "skipped" : "FAILED"} to ${contact} (lock confirmation${c.reason ? ` — ${c.reason}` : ""})`,
      );
      // A text went out from this thread → its replies belong here. The
      // pointer follows the text, never the typed number (2026-09-26).
      if (c.sent && c.channel === "sms") await rememberPhoneSession(contact, sessionId);
    }
    // Server-side twin of the client's Lead pixel (same event id → Meta
    // dedupes). The FB in-app webview drops browser events exactly here, at
    // the money moment — this copy survives it. Best-effort.
    // Only when the client sent its dedup id: a client that reached this
    // POST also attempted the pixel, so a server copy WITHOUT the shared id
    // (stale pre-deploy bundle) would double-count, not backfill.
    if (!eventId) return;
    // Verification runs and the owner's own number are not conversions.
    if (isTestConversion({ src, sessionId, contact })) return;
    await sendCapiLead({
      eventId,
      sourceUrl: `https://topcashcellular.com/go${src ? `?src=${src}` : ""}`,
      ip: clientIp(req),
      userAgent: req.headers.get("user-agent"),
      contact,
      value: typeof offer === "number" ? offer : null,
      contentName: specLine.slice(0, 90),
      fbp: typeof body.fbp === "string" ? body.fbp : null,
      fbc: typeof body.fbc === "string" ? body.fbc : null,
      // Extra match keys (EMQ 7.2 → the documented next keys).
      name: name || null,
      city: geo.city || null,
      region: geo.region || null,
      country: geo.country || null,
      zip: req.headers.get("x-vercel-ip-postal-code"),
      externalId: validSession(sessionId) ? sessionId : null,
    });
  });

  return NextResponse.json({ ok: true, offer, lockUntil, confirmed, ...(leadId ? { leadId } : {}) });
}
