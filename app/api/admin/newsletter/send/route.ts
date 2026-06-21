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

import { NextRequest, NextResponse } from "next/server";
import { mailLogo } from "../../../../lib/email-shell";
import { safeEqual } from "../../../../lib/admin-auth";
import { signNewsletterToken } from "../../../../lib/newsletter-token";

const MC_API = "https://missioncontrolsdjg-production.up.railway.app";
const MC_KEY = process.env.MC_API_KEY || "";
const ADMIN_TOKEN = process.env.TCC_ADMIN_TOKEN;
const RESEND_KEY = process.env.RESEND_API_KEY || "";

function checkAuth(req: NextRequest): boolean {
  const headerToken = req.headers.get("x-admin-token");
  const queryToken = req.nextUrl.searchParams.get("token");
  return safeEqual(headerToken, ADMIN_TOKEN) || safeEqual(queryToken, ADMIN_TOKEN);
}

type Payload = {
  subject?: string;
  body?: string;
  preheader?: string;
  includeLeads?: boolean;
  dryRun?: boolean;
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
async function fetchSubscribers(includeLeads: boolean): Promise<Subscriber[]> {
  const r = await fetch(`${MC_API}/api/comms?limit=2000`, {
    headers: { "x-api-key": MC_KEY },
    cache: "no-store",
  });
  if (!r.ok) throw new Error(`MC ${r.status}`);
  const data = await r.json();
  const messages: { body?: string; timestamp: string }[] = data.messages || [];
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
  return out;
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

  let subscribers: Subscriber[];
  try {
    subscribers = await fetchSubscribers(includeLeads);
  } catch {
    return NextResponse.json({ error: "Failed to load subscribers" }, { status: 502 });
  }
  if (subscribers.length === 0) {
    return NextResponse.json({ ok: false, error: "No subscribers yet" }, { status: 400 });
  }

  // Mint a send-id so admin history can group sends and we can later
  // attribute opens/clicks per send.
  const sendId = `n${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

  // Dry-run: render preview for the first recipient + return list.
  if (dryRun) {
    const sample = subscribers[0];
    const first = (sample?.name?.split(/\s+/)[0] || "there").slice(0, 60);
    const unsubUrl = `https://topcashcellular.com/api/newsletter/unsubscribe?token=${signNewsletterToken(sample.email)}`;
    const bodyHtml = bodyToHtml(
      bodyText.replace(/\{firstName\}/g, first).replace(/\{first_name\}/g, first),
    );
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

  // Real send. Resend's default tier is ~10 req/sec — throttle to
  // 100ms between sends (10/s) to stay safely under. Sequential to
  // keep concurrency simple; for our subscriber sizes this is fine.
  const { Resend } = await import("resend");
  const resend = new Resend(RESEND_KEY);
  let sent = 0;
  let failed = 0;
  const failures: { email: string; error: string }[] = [];
  for (const sub of subscribers) {
    const first = (sub.name?.split(/\s+/)[0] || "there").slice(0, 60);
    const unsubUrl = `https://topcashcellular.com/api/newsletter/unsubscribe?token=${signNewsletterToken(sub.email)}`;
    const personalizedBody = bodyText
      .replace(/\{firstName\}/g, first)
      .replace(/\{first_name\}/g, first)
      .replace(/\{name\}/g, first);
    const html = wrap({
      subject,
      preheader,
      first,
      bodyHtml: bodyToHtml(personalizedBody),
      unsubUrl,
    });
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
      if (r?.data?.id) sent += 1;
      else {
        failed += 1;
        failures.push({ email: sub.email, error: "Resend returned no id" });
      }
    } catch (e) {
      failed += 1;
      failures.push({ email: sub.email, error: e instanceof Error ? e.message : "send failed" });
    }
    // Throttle.
    await new Promise((r) => setTimeout(r, 100));
  }

  // Audit marker. Keep subject in the body so admin send-history can
  // show what went out. Counts let us spot delivery problems.
  if (MC_KEY) {
    try {
      await fetch(`${MC_API}/api/comms`, {
        method: "POST",
        headers: { "x-api-key": MC_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: "tcc-admin",
          fromName: "TCC Admin",
          role: "system",
          body: `[NEWSLETTER-SENT: ${sendId}] subject=${subject.replace(/[\[\]\r\n]+/g, " ").slice(0, 200)} sent=${sent} failed=${failed} totalSubscribers=${subscribers.length} includeLeads=${includeLeads}`,
          tags: ["newsletter", "sent"],
          priority: "low",
        }),
      });
    } catch {}
  }

  return NextResponse.json({
    ok: true,
    sendId,
    count: subscribers.length,
    sent,
    failed,
    failures: failures.slice(0, 20), // truncate for response size
  });
}
