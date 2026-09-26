// Admin endpoint that sends a newsletter blast.
//
// Flow:
//   1. POST { subject, body, includeLeads?, dryRun? }
//   2. Fetch the subscriber list (same source as /api/admin/newsletter).
//   3. For each subscriber: wrap body in TCC HTML shell, interpolate
//      {firstName} → recipient's first name (or "there" fallback).
//   4. Send via Resend, throttled to ~10 req/sec to stay under provider
//      rate limit and to avoid spam-flagging.
//   5. Post a [NEWSLETTER-SENT] marker to MC with subject + counts +
//      send-id (Date.now hex) so admin can audit history later.
//
// `dryRun: true` returns the recipient list + preview HTML without
// hitting Resend — Skywalker can sanity-check the preview before
// committing.
//
// 2026-09-26 — send safety:
//   • recipients come from the FULL archive-paged history (the newest-2000
//     slice forgot old unsubscribes), and the durable opt-out blob is
//     checked per recipient, failing closed;
//   • batches of 25 with a pause, inside a 300 s function budget, stopping
//     early with a resume count instead of dying mid-list;
//   • one "[NEWSLETTER-SENT: <sendId>] batch=N to=<hash>,…" marker per batch
//     (hashes, never addresses) so a retry with the same client-minted
//     sendId skips everyone already mailed;
//   • `testOnly: true` mails OWNER_EMAIL alone.

import { NextRequest, NextResponse } from "next/server";
import { mailLogo } from "../../../../lib/email-shell";
import { safeEqual } from "../../../../lib/admin-auth";
import { signNewsletterToken } from "../../../../lib/newsletter-token";
import { fetchCommsRead, type McMessage } from "../../../../lib/mc-comms";
import { isNewsletterUnsubbed, newsletterEmailHash } from "../../../../lib/newsletter-unsub";

// A blast can run for minutes — the default function budget cut long sends
// off mid-list with no resume (2026-09-26).
export const maxDuration = 300;

const MC_API = "https://missioncontrolsdjg-production.up.railway.app";
const MC_KEY = process.env.MC_API_KEY || "";
const ADMIN_TOKEN = process.env.TCC_ADMIN_TOKEN;
const RESEND_KEY = process.env.RESEND_API_KEY || "";

function checkAuth(req: NextRequest): boolean {
  // Header only (2026-09-26): a ?token= in the URL put the admin secret in
  // request logs and browser history. proxy.ts sets this header for a Google
  // admin session; server-side callers already send it.
  return safeEqual(req.headers.get("x-admin-token"), ADMIN_TOKEN);
}

type Payload = {
  subject?: string;
  body?: string;
  preheader?: string;
  includeLeads?: boolean;
  dryRun?: boolean;
  // Client-minted per composed blast; a retry re-uses it (2026-09-26).
  sendId?: string;
  // Mail OWNER_EMAIL only — nothing else goes out (2026-09-26).
  testOnly?: boolean;
};

type Subscriber = {
  email: string;
  name?: string;
  signedUpAt: string;
  source?: "signup" | "lead" | "imported";
};

// Convert plain-text body to safe HTML paragraphs. Same pattern as
// /api/admin/leads/email — escape entities, split on blank lines for
// paragraphs, single newlines become <br>.
function bodyToHtml(text: string): string {
  const esc = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
  return esc
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map(
      (p) =>
        `<p style="margin:0 0 14px;font-size:15px;line-height:1.7;color:#e6e6e6">${p.replace(/\n/g, "<br>")}</p>`,
    )
    .join("\n");
}

function htmlEsc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function wrap(opts: {
  subject: string;
  preheader?: string;
  first: string;
  bodyHtml: string;
  unsubUrl: string;
}): string {
  // Preheader is the hidden snippet email clients show in the inbox
  // preview row — set it explicitly or it falls back to the first
  // visible line of body.
  const preheaderBlock = opts.preheader
    ? `<div style="display:none;max-height:0;overflow:hidden;font-size:1px;line-height:1px;color:#0a0a0a;opacity:0">${htmlEsc(opts.preheader)}</div>`
    : "";
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="dark"><meta name="supported-color-schemes" content="dark"></head>
<body style="margin:0;padding:0;background:#13142b;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#e6e6e6">
${preheaderBlock}
<div style="background:#13142b;padding:32px 16px">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;margin:0 auto;background:#1b1d39;border:1px solid rgba(255,255,255,0.08);border-radius:18px;overflow:hidden;box-shadow:0 10px 30px rgba(0,0,0,0.5)">
<tr><td style="padding:24px 28px">
<div style="margin:0 0 16px">${mailLogo()}</div>
<div style="font-size:20px;font-weight:800;color:#ffffff;line-height:1.2">${htmlEsc(opts.subject)}</div>
</td></tr>
<tr><td style="padding:28px 28px 8px 28px"><div style="font-size:18px;color:#fff;font-weight:700;margin-bottom:14px">Hi ${htmlEsc(opts.first)},</div>${opts.bodyHtml}</td></tr>
<tr><td style="padding:8px 28px 24px 28px">
<div style="font-size:14px;color:#e6e6e6;line-height:1.6">— The Top Cash Cellular team<br><span style="color:#888;font-size:12px">Austin, TX · a small business · real humans</span></div>
</td></tr>
<tr><td style="padding:18px 28px 28px;border-top:1px solid rgba(255,255,255,0.06)">
<div style="font-size:12px;color:#888;line-height:1.6;text-align:center">
Reply directly or write to <a href="mailto:support@topcashcellular.com" style="color:#00c853;text-decoration:none;font-weight:600">support@topcashcellular.com</a><br>
<span style="color:#666">Top Cash Cellular · Austin, TX · <a href="https://topcashcellular.com" style="color:#666;text-decoration:none">topcashcellular.com</a></span>
</div>
<div style="margin-top:10px;font-size:11px;color:#666;text-align:center">
<a href="${opts.unsubUrl}" style="color:#666;text-decoration:underline">Unsubscribe in one click</a> · You're getting this because you signed up at topcashcellular.com.
</div>
</td></tr>
</table>
</div></body></html>`;
}

// Inline implementation rather than importing — keeps the send route
// independent of /api/admin/newsletter so a failure in one doesn't
// break the other.
async function fetchSubscribers(includeLeads: boolean): Promise<{ subscribers: Subscriber[]; messages: McMessage[] }> {
  // Full history, archive included, no memo (2026-09-26): the recipient
  // list is authoritative for a blast, so an incomplete read throws (the
  // caller answers 502) instead of mailing a shorter list. The same
  // messages carry the [NEWSLETTER-SENT] markers the dedupe reads.
  const read = await fetchCommsRead({ apiKey: MC_KEY, pageSize: 5000, maxPages: 6, includeArchive: true, memoMs: 0 });
  if (!read.complete || read.messages.length === 0) throw new Error("MC read incomplete");
  const messages = read.messages;
  const signups = new Map<string, Subscriber>();
  const unsubAt = new Map<string, string>();
  for (const m of messages) {
    if (!m.body) continue;
    if (m.body.startsWith("[NEWSLETTER SIGNUP]")) {
      const emailM = m.body.match(/email=([^\s]+)/);
      const nameM = m.body.match(/name=([^=]+?)(?=\s+welcome=|\s*$)/);
      const email = emailM ? emailM[1].toLowerCase().trim() : null;
      if (!email) continue;
      const name = nameM ? nameM[1].trim() : "";
      const prev = signups.get(email);
      if (!prev || m.timestamp > prev.signedUpAt) {
        signups.set(email, {
          email,
          name: name || prev?.name,
          signedUpAt: m.timestamp,
          source: "signup",
        });
      }
      continue;
    }
    if (m.body.startsWith("[NEWSLETTER UNSUB]")) {
      const emailM = m.body.match(/email=([^\s]+)/);
      const email = emailM ? emailM[1].toLowerCase().trim() : null;
      if (!email) continue;
      const prev = unsubAt.get(email);
      if (!prev || m.timestamp > prev) unsubAt.set(email, m.timestamp);
      continue;
    }
    if (includeLeads && /\[NEW BUYBACK LEAD(\b| — \d+ DEVICES\])/i.test(m.body)) {
      const emailM = m.body.match(/(?:^|\n)Email:[ \t]*([^\s\n]+)/i);
      const nameM = m.body.match(/(?:^|\n)Name:[ \t]*([^\n]+)/i);
      const email = emailM ? emailM[1].toLowerCase().trim() : null;
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) continue;
      const name = nameM ? nameM[1].trim() : "";
      const prev = signups.get(email);
      if (!prev || (prev.source === "lead" && m.timestamp > prev.signedUpAt)) {
        signups.set(email, {
          email,
          name: name || prev?.name,
          signedUpAt: m.timestamp,
          source: "lead",
        });
      } else if (name && !prev.name) {
        signups.set(email, { ...prev, name });
      }
    }
  }
  const out: Subscriber[] = [];
  for (const [, sub] of signups) {
    const unsub = unsubAt.get(sub.email);
    if (unsub && unsub > sub.signedUpAt) continue;
    out.push(sub);
  }
  return { subscribers: out, messages };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function personalize(bodyText: string, first: string): string {
  return bodyText
    .replace(/\{firstName\}/g, first)
    .replace(/\{first_name\}/g, first)
    .replace(/\{name\}/g, first);
}

// One comms line; bounded so a hung MC can't eat the send budget.
async function postMarker(body: string): Promise<void> {
  if (!MC_KEY) return;
  try {
    await fetch(`${MC_API}/api/comms`, {
      method: "POST",
      headers: { "x-api-key": MC_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ from: "tcc-admin", fromName: "TCC Admin", role: "system", body, tags: ["newsletter", "sent"], priority: "low" }),
      signal: AbortSignal.timeout(10_000),
    });
  } catch {}
}

export async function POST(req: NextRequest) {
  if (!checkAuth(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!RESEND_KEY) {
    return NextResponse.json({ error: "RESEND_API_KEY not configured" }, { status: 503 });
  }
  let payload: Payload;
  try {
    payload = (await req.json()) as Payload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const subject = (payload.subject || "").trim();
  const bodyText = (payload.body || "").trim();
  const preheader = (payload.preheader || "").trim().slice(0, 120);
  const includeLeads = !!payload.includeLeads;
  const dryRun = !!payload.dryRun;
  if (subject.length < 3) return NextResponse.json({ error: "Subject too short" }, { status: 400 });
  if (subject.length > 200) return NextResponse.json({ error: "Subject too long (200 max)" }, { status: 400 });
  if (bodyText.length < 30) return NextResponse.json({ error: "Body too short (30+ chars)" }, { status: 400 });
  if (bodyText.length > 20000) return NextResponse.json({ error: "Body too long (20k max)" }, { status: 400 });

  // "Send a test to me" (2026-09-26): one copy to OWNER_EMAIL, nothing else
  // — no subscriber read, no markers, no dedupe. The only way to see the
  // real rendering in an inbox before it goes to everyone.
  if (payload.testOnly === true) {
    const ownerEmail = (process.env.OWNER_EMAIL || "").trim();
    if (!ownerEmail) {
      return NextResponse.json({ error: "OWNER_EMAIL is not configured — nowhere to send the test." }, { status: 400 });
    }
    const first = "there";
    const unsubUrl = `https://topcashcellular.com/api/newsletter/unsubscribe?token=${signNewsletterToken(ownerEmail)}`;
    const personalizedBody = personalize(bodyText, first);
    const testSubject = `[TEST] ${subject}`;
    const html = wrap({ subject: testSubject, preheader, first, bodyHtml: bodyToHtml(personalizedBody), unsubUrl });
    try {
      const { Resend } = await import("resend");
      const resend = new Resend(RESEND_KEY);
      const r = await resend.emails.send({
        from: "Top Cash Cellular <noreply@topcashcellular.com>",
        replyTo: "support@topcashcellular.com",
        to: ownerEmail,
        subject: testSubject,
        html,
        text: `Hi ${first},\n\n${personalizedBody}\n\n— The Top Cash Cellular team\nAustin, TX`,
      });
      if (!r?.data?.id) return NextResponse.json({ error: "Resend returned no id for the test send" }, { status: 502 });
    } catch (e) {
      return NextResponse.json({ error: e instanceof Error ? e.message : "Test send failed" }, { status: 502 });
    }
    return NextResponse.json({ ok: true, testOnly: true, to: ownerEmail });
  }

  let subscribers: Subscriber[];
  let feed: McMessage[];
  try {
    ({ subscribers, messages: feed } = await fetchSubscribers(includeLeads));
  } catch {
    return NextResponse.json({ error: "Couldn't load the subscriber list from Mission Control (incomplete read) — nothing was sent. Try again." }, { status: 502 });
  }
  if (subscribers.length === 0) {
    return NextResponse.json({ ok: false, error: "No subscribers yet" }, { status: 400 });
  }

  // The client mints one id per composed blast and re-uses it on a retry,
  // so recipients already marked under it are skipped. A missing or
  // malformed id gets a fresh server one (older clients).
  const sendId = typeof payload.sendId === "string" && /^[\w-]{6,64}$/.test(payload.sendId)
    ? payload.sendId
    : `n${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

  // Dry-run: render preview for the first recipient + return list.
  if (dryRun) {
    const sample = subscribers[0];
    const first = (sample?.name?.split(/\s+/)[0] || "there").slice(0, 60);
    const unsubUrl = `https://topcashcellular.com/api/newsletter/unsubscribe?token=${signNewsletterToken(sample.email)}`;
    const bodyHtml = bodyToHtml(personalize(bodyText, first));
    const html = wrap({ subject, preheader, first, bodyHtml, unsubUrl });
    return NextResponse.json({
      ok: true,
      dryRun: true,
      sendId,
      count: subscribers.length,
      previewRecipient: sample.email,
      previewHtml: html,
    });
  }

  // Recipients already mailed under this sendId, from the per-batch
  // "[NEWSLETTER-SENT: <id>] batch=N to=<hash>,<hash>,…" markers below.
  const alreadySent = new Set<string>();
  const sentRe = new RegExp(`\\[NEWSLETTER-SENT:\\s*${sendId}\\][^\\n]*?\\bto=([\\w,]+)`, "i");
  for (const m of feed) {
    const sm = m.body?.match(sentRe);
    if (sm) for (const h of sm[1].split(",")) if (h) alreadySent.add(h);
  }

  // Real send. Resend's default tier is ~10 req/sec — 100 ms between sends
  // inside a batch, a pause between batches of 25, and a soft deadline so
  // the response (with the resume count) always lands inside maxDuration.
  const { Resend } = await import("resend");
  const resend = new Resend(RESEND_KEY);
  const BATCH = 25;
  const BATCH_PAUSE_MS = 500;
  const softDeadline = Date.now() + 270_000;
  let sent = 0, failed = 0, skippedAlreadySent = 0, skippedUnsub = 0, skippedBlobError = 0, batches = 0;
  let partial = false;
  let index = 0;
  const failures: { email: string; error: string }[] = [];
  while (index < subscribers.length) {
    if (Date.now() > softDeadline) { partial = true; break; }
    const batch = subscribers.slice(index, index + BATCH);
    index += BATCH;
    batches += 1;
    const batchHashes: string[] = [];
    for (const sub of batch) {
      const hash = newsletterEmailHash(sub.email);
      if (alreadySent.has(hash)) { skippedAlreadySent += 1; continue; }
      // Durable opt-out check per recipient, failing CLOSED: an unreadable
      // store skips the address rather than risk mailing someone who left.
      const unsub = await isNewsletterUnsubbed(sub.email);
      if (unsub === true) { skippedUnsub += 1; continue; }
      if (unsub === null) { skippedBlobError += 1; continue; }
      const first = (sub.name?.split(/\s+/)[0] || "there").slice(0, 60);
      const unsubUrl = `https://topcashcellular.com/api/newsletter/unsubscribe?token=${signNewsletterToken(sub.email)}`;
      const personalizedBody = personalize(bodyText, first);
      const html = wrap({ subject, preheader, first, bodyHtml: bodyToHtml(personalizedBody), unsubUrl });
      const text = `Hi ${first},\n\n${personalizedBody}\n\n— The Top Cash Cellular team\nAustin, TX\n\nUnsubscribe: ${unsubUrl}`;
      try {
        // Set List-Unsubscribe + List-Unsubscribe-Post per RFC-8058
        // so Gmail/Outlook show the inbox 1-click unsubscribe button.
        const r = await resend.emails.send({
          from: "Top Cash Cellular <noreply@topcashcellular.com>",
          replyTo: "support@topcashcellular.com",
          to: sub.email,
          subject,
          html,
          text,
          headers: {
            "List-Unsubscribe": `<${unsubUrl}>, <mailto:unsubscribe@topcashcellular.com?subject=unsubscribe>`,
            "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
          },
        });
        if (r?.data?.id) {
          sent += 1;
          batchHashes.push(hash);
          alreadySent.add(hash);
        } else {
          failed += 1;
          failures.push({ email: sub.email, error: "Resend returned no id" });
        }
      } catch (e) {
        failed += 1;
        failures.push({ email: sub.email, error: e instanceof Error ? e.message : "send failed" });
      }
      await sleep(100);
    }
    // Per-batch marker: hashes only (never addresses). Failures are not
    // marked, so a retry reaches them again.
    if (batchHashes.length > 0) {
      await postMarker(`[NEWSLETTER-SENT: ${sendId}] batch=${batches} to=${batchHashes.join(",")}`);
    }
    if (index < subscribers.length) await sleep(BATCH_PAUSE_MS);
  }
  const remaining = partial ? subscribers.length - index : 0;

  // Summary marker. Keep subject in the body so admin send-history can show
  // what went out; "=" is stripped from it so the dedupe's `to=` scan can't
  // pick up subject text.
  await postMarker(
    `[NEWSLETTER-SENT: ${sendId}] subject=${subject.replace(/[\[\]\r\n=]+/g, " ").slice(0, 200)} sent=${sent} failed=${failed} alreadySent=${skippedAlreadySent} unsubscribed=${skippedUnsub} storeErrors=${skippedBlobError} totalSubscribers=${subscribers.length} includeLeads=${includeLeads}${partial ? ` partial=1 remaining=${remaining}` : ""}`,
  );

  return NextResponse.json({
    ok: true,
    sendId,
    count: subscribers.length,
    sent,
    failed,
    skippedAlreadySent,
    skippedUnsub,
    skippedBlobError,
    batches,
    partial,
    remaining,
    failures: failures.slice(0, 20), // truncate for response size
  });
}
