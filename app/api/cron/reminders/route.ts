import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";

// Hourly reminder cron — Skywalker 2026-05-18 "remind 24hr after they
// get quote to meet/respond/ship, make custom depending on shipping
// or meeting, and another for review 24hr if marked paid".
//
// Two reminder kinds, both idempotent via [REMINDER-SENT: leadId]
// markers persisted to MC. The cron is safe to run every hour — it
// only fires reminders for the specific 24-48h aging window AND will
// not double-fire for the same lead.
//
// QUOTE REMINDER (fired once, 24-48h after submission, only if still
// in quote_requested status):
//   • ship handoff → "Your label is in your inbox, drop at FedEx"
//   • local handoff → "Ready to meet? Reply with time + spot"
//   • no handoff set → "Quote still locked, come back when ready"
//
// REVIEW REMINDER (fired once, 24-48h after paid/met flip, only if
// the customer hasn't already submitted a review):
//   • Yellow review CTA with the token URL minted by the status route
//
// Auth: CRON_SECRET on the Authorization header. Vercel auto-sends
// this on cron-fired requests. Manual hits get 401.

export const runtime = "nodejs";

const MC_API = "https://missioncontrolsdjg-production.up.railway.app";
const MC_KEY = process.env.MC_API_KEY || "";
const TWILIO_SID = process.env.TWILIO_ACCOUNT_SID || "";
const TWILIO_AUTH = process.env.TWILIO_AUTH_TOKEN || "";
const TWILIO_FROM = process.env.TWILIO_PHONE || "";
const RESEND_KEY = process.env.RESEND_API_KEY || "";

// 24-48 hour aging window. Reminders only fire once per lead per kind.
const REMIND_AFTER_MS = 24 * 60 * 60 * 1000;
const REMIND_UNTIL_MS = 48 * 60 * 60 * 1000;

async function sendSms(to: string, body: string): Promise<boolean> {
  if (!TWILIO_SID || !TWILIO_AUTH) return false;
  const digits = to.replace(/\D/g, "");
  const e164 = digits.length === 10 ? `+1${digits}` : digits.length === 11 && digits.startsWith("1") ? `+${digits}` : null;
  if (!e164) return false;
  try {
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`, {
      method: "POST",
      headers: {
        "Authorization": "Basic " + Buffer.from(`${TWILIO_SID}:${TWILIO_AUTH}`).toString("base64"),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ To: e164, From: TWILIO_FROM, Body: body }),
    });
    return res.ok;
  } catch { return false; }
}

async function sendEmail(to: string, subject: string, html: string, text: string): Promise<boolean> {
  if (!RESEND_KEY) return false;
  try {
    const { Resend } = await import("resend");
    const resend = new Resend(RESEND_KEY);
    const r = await resend.emails.send({
      from: "Top Cash Cellular <noreply@topcashcellular.com>",
      replyTo: "CustomerService@topcashcells.com",
      to,
      subject,
      html,
      text,
    });
    return !!(r?.data?.id);
  } catch {
    return false;
  }
}

function parseField(body: string, key: string): string | undefined {
  // Anchor to line-start; only inline whitespace after the key. Avoids
  // \s* (which includes \n) swallowing the next field when the value
  // is empty. See app/api/admin/leads/route.ts for full bug context.
  const m = body.match(new RegExp(`(?:^|\\n)${key}:[ \\t]*([^\\n]*)`, "i"));
  if (!m) return undefined;
  const v = m[1].trim();
  return v || undefined;
}

async function logReminderSent(leadId: string, kind: "quote" | "review") {
  const marker = `[REMINDER-SENT: ${leadId}] kind=${kind} at=${new Date().toISOString()}`;
  try {
    await fetch(`${MC_API}/api/comms`, {
      method: "POST",
      headers: { "x-api-key": MC_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "tcc-admin",
        fromName: "TCC Admin",
        role: "system",
        body: marker,
        tags: ["reminder-sent", kind],
        priority: "low",
      }),
    });
  } catch {}
}

// Email template wrapper — keeps the visual identity consistent across
// the three reminder variants. accentColor sets the header gradient.
function wrapEmail(opts: { title: string; bodyHtml: string; ctaHref?: string; ctaLabel?: string; accent?: string }): string {
  const accent = opts.accent || "#00c853";
  const cta = opts.ctaHref && opts.ctaLabel
    ? `<div style="text-align:center;margin:24px 0 12px"><a href="${opts.ctaHref}" style="display:inline-block;padding:13px 28px;background:linear-gradient(180deg,${accent} 0%,${accent} 100%);color:#0a0a0a;font-weight:800;font-size:14px;text-decoration:none;border-radius:999px;box-shadow:0 4px 14px rgba(0,200,83,0.35)">${opts.ctaLabel}</a></div>`
    : "";
  return `<!doctype html><html><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;background:#0a0a0a;color:#e6e6e6;margin:0;padding:32px 16px"><div style="max-width:600px;margin:0 auto;background:#0f0f0f;border:1px solid rgba(255,255,255,0.08);border-radius:18px;overflow:hidden"><div style="background:linear-gradient(135deg,${accent} 0%,#00a039 100%);padding:24px 28px;color:#0a0a0a"><div style="font-size:11px;font-weight:800;letter-spacing:0.18em;text-transform:uppercase;opacity:0.7;margin-bottom:4px">Top Cash Cellular</div><div style="font-size:22px;font-weight:800;line-height:1.1">${opts.title}</div></div><div style="padding:28px">${opts.bodyHtml}${cta}<p style="font-size:12px;color:#888;line-height:1.6;margin:24px 0 0;text-align:center;border-top:1px solid rgba(255,255,255,0.08);padding-top:18px">Questions? Reply or write to <a href="mailto:CustomerService@topcashcells.com" style="color:${accent};text-decoration:none">CustomerService@topcashcells.com</a></p></div></div></body></html>`;
}

type LeadShape = {
  id: string;
  body: string;
  timestamp: string;
  name?: string;
  phone?: string;
  email?: string;
  device?: string;
  model?: string;
  quote?: string;
  handoffMethod?: "ship" | "local" | undefined;
};

function templateQuoteReminder(lead: LeadShape, handoffKind: "ship" | "local" | "none") {
  const first = (lead.name || "there").split(" ")[0];
  const device = lead.model || lead.device || "your device";
  const quoteStr = lead.quote ? `${lead.quote}` : "your locked-in price";
  if (handoffKind === "ship") {
    return {
      smsBody: `Top Cash: Hi ${first}, just checking in — your quote for ${device} (${quoteStr}) is still good. Your prepaid FedEx label is in your inbox; print + tape + drop at any FedEx location whenever you're ready. Reply STOP to opt out.`,
      emailSubject: `Reminder: your FedEx label is ready when you are`,
      emailHtml: wrapEmail({
        title: "Your label is ready when you are",
        bodyHtml: `<p style="font-size:16px;color:#fff;font-weight:700;margin:0 0 14px">Hi ${first},</p><p style="font-size:15px;line-height:1.65;color:#e6e6e6;margin:0 0 14px">Quick reminder — your quote for <span style="color:#00c853;font-weight:600">${device}</span> at <span style="color:#00c853;font-weight:700">${quoteStr}</span> is still locked in. Your prepaid FedEx label is waiting in your inbox from yesterday's confirmation email.</p><p style="font-size:15px;line-height:1.65;color:#e6e6e6;margin:0">Print it, tape it to a padded box, drop at any FedEx location. We'll text you the moment it lands.</p>`,
      }),
    };
  }
  if (handoffKind === "local") {
    return {
      smsBody: `Top Cash: Hi ${first}, your quote for ${device} (${quoteStr}) is still locked in. Ready to meet? Just reply with a time + part of Austin and we'll come to you. Reply STOP to opt out.`,
      emailSubject: `Reminder: ready to meet for your ${device} trade?`,
      emailHtml: wrapEmail({
        title: "Ready to meet up?",
        bodyHtml: `<p style="font-size:16px;color:#fff;font-weight:700;margin:0 0 14px">Hi ${first},</p><p style="font-size:15px;line-height:1.65;color:#e6e6e6;margin:0 0 14px">Just checking in — your quote for <span style="color:#00c853;font-weight:600">${device}</span> at <span style="color:#00c853;font-weight:700">${quoteStr}</span> is still locked in.</p><p style="font-size:15px;line-height:1.65;color:#e6e6e6;margin:0">Reply with a time + neighborhood and we'll meet you anywhere in Austin that works — coffee shop, parking lot, your office, even a curbside curb-pull. Usually 15 min total.</p>`,
      }),
    };
  }
  // No handoff picked yet — gentle nudge back to the funnel.
  return {
    smsBody: `Top Cash: Hi ${first}, your quote for ${device} (${quoteStr}) is still locked in. Pick local meetup or free FedEx pickup whenever you're ready: https://topcashcellular.com. Reply STOP to opt out.`,
    emailSubject: `Reminder: your ${device} quote is still good`,
    emailHtml: wrapEmail({
      title: "Your quote is still locked in",
      bodyHtml: `<p style="font-size:16px;color:#fff;font-weight:700;margin:0 0 14px">Hi ${first},</p><p style="font-size:15px;line-height:1.65;color:#e6e6e6;margin:0 0 14px">Your quote for <span style="color:#00c853;font-weight:600">${device}</span> at <span style="color:#00c853;font-weight:700">${quoteStr}</span> is still good.</p><p style="font-size:15px;line-height:1.65;color:#e6e6e6;margin:0">Local meetup (same-day cash) or free FedEx pickup — pick whichever works.</p>`,
      ctaHref: "https://topcashcellular.com",
      ctaLabel: "Finish your trade →",
    }),
  };
}

function templateReviewReminder(lead: LeadShape, reviewUrl: string) {
  const first = (lead.name || "there").split(" ")[0];
  const device = lead.model || lead.device || "your device";
  return {
    smsBody: `Top Cash: Hi ${first}, hope you enjoyed selling ${device}. Quick favor — mind leaving a 30-sec review? ${reviewUrl}`,
    emailSubject: `One quick favor — review your trade?`,
    emailHtml: wrapEmail({
      title: "★ Leave a quick review?",
      accent: "#ffb400",
      bodyHtml: `<p style="font-size:16px;color:#fff;font-weight:700;margin:0 0 14px">Hi ${first},</p><p style="font-size:15px;line-height:1.65;color:#e6e6e6;margin:0 0 14px">Yesterday we paid out your ${device} trade — hope it was a good experience.</p><p style="font-size:15px;line-height:1.65;color:#e6e6e6;margin:0 0 14px">If it was, it would mean a ton if you could drop a 30-second review. It helps the next person find us instead of getting lowballed by a faceless website.</p><p style="font-size:13px;color:#888;line-height:1.5;margin:0">Single-use link — only works once.</p>`,
      ctaHref: reviewUrl,
      ctaLabel: "★ Leave a review",
    }),
  };
}

export async function GET(req: NextRequest) {
  // Auth — Vercel cron sends `Authorization: Bearer ${CRON_SECRET}`.
  const auth = req.headers.get("authorization") || "";
  const secret = process.env.CRON_SECRET;
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // Pull a generous slice of MC comms — needs to cover both the lead
  // submission timestamps AND any [REMINDER-SENT]/[REVIEW-USED] markers
  // that would suppress a re-send.
  let messages: { id?: string; body?: string; timestamp: string }[] = [];
  try {
    const r = await fetch(`${MC_API}/api/comms?limit=1000`, {
      headers: { "x-api-key": MC_KEY },
      cache: "no-store",
    });
    if (!r.ok) {
      return NextResponse.json({ error: "MC unavailable", status: r.status }, { status: 502 });
    }
    const data = await r.json();
    messages = Array.isArray(data.messages) ? data.messages : [];
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "fetch failed" }, { status: 502 });
  }

  // Index status updates, reminders, review-used markers.
  const statusByLead = new Map<string, { status: string; ts: string }>();
  const quoteRemindedSet = new Set<string>();
  const reviewRemindedSet = new Set<string>();
  const reviewUsedLeads = new Set<string>();
  const reviewTokenByLead = new Map<string, { token: string; expires?: string }>();
  for (const m of messages) {
    if (!m.body) continue;
    const sm = m.body.match(/\[STATUS:\s*(\w+)\]/i);
    const lm = m.body.match(/\[LEAD:\s*([\w-]+)\]/i);
    if (sm && lm) {
      const lid = lm[1];
      const existing = statusByLead.get(lid);
      if (!existing || m.timestamp > existing.ts) {
        statusByLead.set(lid, { status: sm[1].toLowerCase(), ts: m.timestamp });
      }
    }
    const rm = m.body.match(/\[REMINDER-SENT:\s*([\w-]+)\]/i);
    if (rm) {
      const lid = rm[1];
      const kind = m.body.match(/kind=(quote|review)/i)?.[1]?.toLowerCase();
      if (kind === "quote") quoteRemindedSet.add(lid);
      else if (kind === "review") reviewRemindedSet.add(lid);
    }
    const rtm = m.body.match(/\[REVIEW-TOKEN:\s*([\w-]+)\]/i);
    if (rtm) {
      const lid = rtm[1];
      const tok = m.body.match(/token=([\w]+)/i)?.[1];
      const exp = m.body.match(/expires=([^\s]+)/i)?.[1];
      if (tok) reviewTokenByLead.set(lid, { token: tok, expires: exp });
    }
    const rum = m.body.match(/\[REVIEW-USED:\s*[\w]+\]\s+leadId=([\w-]+)/i);
    if (rum) reviewUsedLeads.add(rum[1]);
  }

  const now = Date.now();
  const quoteCandidates: LeadShape[] = [];
  const reviewCandidates: { lead: LeadShape; statusTs: string }[] = [];

  for (const m of messages) {
    if (!m.body) continue;
    if (!/\[NEW BUYBACK LEAD(\b| — \d+ DEVICES\])/i.test(m.body)) continue;
    if (!m.id) continue;
    // Deleted leads (soft-trashed) → skip. They re-surface only on restore.
    if (messages.some((mm) => mm.body && new RegExp(`\\[DELETED-LEAD:\\s*${m.id}\\]`, "i").test(mm.body))) {
      // Check if restored after; only skip if delete is the latest action.
      const lastDel = messages.filter((mm) => mm.body && new RegExp(`\\[DELETED-LEAD:\\s*${m.id}\\]`, "i").test(mm.body)).map((mm) => mm.timestamp).sort().pop();
      const lastRes = messages.filter((mm) => mm.body && new RegExp(`\\[RESTORED-LEAD:\\s*${m.id}\\]`, "i").test(mm.body)).map((mm) => mm.timestamp).sort().pop();
      if (lastDel && (!lastRes || lastRes < lastDel)) continue;
    }
    const name = parseField(m.body, "Name");
    const phone = parseField(m.body, "Phone");
    const email = parseField(m.body, "Email");
    if (!phone && !email) continue;
    const deviceLine = parseField(m.body, "Device") || "";
    const handoffMethod: "ship" | "local" | undefined = /--- Handoff:\s*SHIPPING/i.test(m.body)
      ? "ship"
      : /--- Handoff:\s*LOCAL MEETUP/i.test(m.body)
        ? "local"
        : undefined;
    const lead: LeadShape = {
      id: m.id,
      body: m.body,
      timestamp: m.timestamp,
      name,
      phone,
      email,
      device: deviceLine.split(" — ")[0],
      model: deviceLine.split(" — ")[1],
      quote: parseField(m.body, "Quote"),
      handoffMethod,
    };

    const status = statusByLead.get(m.id);
    const statusName = status?.status || "quote_requested";
    const statusTs = status?.ts || m.timestamp;
    const ageMs = now - new Date(statusTs).getTime();

    // Quote reminder — still in quote_requested, aged 24-48h, not yet
    // reminded. We use submission timestamp (m.timestamp) for age
    // since the lead may never have had a [STATUS:] update.
    if (statusName === "quote_requested") {
      const subAge = now - new Date(m.timestamp).getTime();
      if (subAge >= REMIND_AFTER_MS && subAge < REMIND_UNTIL_MS && !quoteRemindedSet.has(m.id)) {
        quoteCandidates.push(lead);
      }
    }

    // Review reminder — paid or met, status flipped 24-48h ago, no
    // review submitted yet, no review-reminder sent yet.
    if (statusName === "paid" || statusName === "met") {
      if (ageMs >= REMIND_AFTER_MS && ageMs < REMIND_UNTIL_MS && !reviewRemindedSet.has(m.id) && !reviewUsedLeads.has(m.id)) {
        reviewCandidates.push({ lead, statusTs });
      }
    }
  }

  let quoteSent = 0;
  let reviewSent = 0;
  const errors: string[] = [];

  // Fire quote reminders.
  for (const lead of quoteCandidates) {
    try {
      const handoffKind: "ship" | "local" | "none" = lead.handoffMethod || "none";
      const tmpl = templateQuoteReminder(lead, handoffKind);
      const tasks: Promise<unknown>[] = [];
      if (lead.phone) tasks.push(sendSms(lead.phone, tmpl.smsBody));
      if (lead.email) tasks.push(sendEmail(lead.email, tmpl.emailSubject, tmpl.emailHtml, tmpl.smsBody));
      await Promise.all(tasks);
      await logReminderSent(lead.id, "quote");
      quoteSent++;
    } catch (e) {
      errors.push(`quote ${lead.id}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  // Fire review reminders.
  for (const { lead } of reviewCandidates) {
    try {
      // Need an active review token to embed in the URL. If MC marker
      // has one and it's not expired/used, use it. Otherwise mint a
      // fresh one inline (defensive — should always exist post-paid/met
      // since the status route mints on every paid/met flip).
      let token = reviewTokenByLead.get(lead.id)?.token;
      const expiry = reviewTokenByLead.get(lead.id)?.expires;
      const expired = expiry ? new Date(expiry).getTime() < now : false;
      if (!token || expired || reviewUsedLeads.has(lead.id)) {
        token = randomBytes(32).toString("hex");
        const expiresAt = new Date(now + 60 * 24 * 60 * 60 * 1000).toISOString();
        await fetch(`${MC_API}/api/comms`, {
          method: "POST",
          headers: { "x-api-key": MC_KEY, "Content-Type": "application/json" },
          body: JSON.stringify({
            from: "tcc-admin",
            fromName: "TCC Admin",
            role: "system",
            // Strip `[` and `]` from lead.name / lead.device too. Pre-
            // /api/lead-fix legacy leads in MC could still have those
            // brackets in their parsed fields; without scrubbing here,
            // the REVIEW-TOKEN marker would carry them forward and the
            // global admin parser would scan them as injectable.
            body: `[REVIEW-TOKEN: ${lead.id}] token=${token} expires=${expiresAt}${lead.name ? ` name=${lead.name.replace(/[\[\]\s·]+/g, "_").slice(0, 60)}` : ""}${lead.device ? ` device=${lead.device.replace(/[\[\]\s·]+/g, "_").slice(0, 60)}` : ""}`,
            tags: ["review-token", "minted", "from-reminder"],
            priority: "low",
          }),
        });
      }
      const params = new URLSearchParams();
      params.set("token", token);
      if (lead.name) params.set("name", lead.name);
      const dev = lead.model || lead.device;
      if (dev) params.set("device", dev);
      const reviewUrl = `https://topcashcellular.com/reviews/new?${params.toString()}`;
      const tmpl = templateReviewReminder(lead, reviewUrl);
      const tasks: Promise<unknown>[] = [];
      if (lead.phone) tasks.push(sendSms(lead.phone, tmpl.smsBody));
      if (lead.email) tasks.push(sendEmail(lead.email, tmpl.emailSubject, tmpl.emailHtml, tmpl.smsBody));
      await Promise.all(tasks);
      await logReminderSent(lead.id, "review");
      reviewSent++;
    } catch (e) {
      errors.push(`review ${lead.id}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  return NextResponse.json({
    ok: true,
    quoteCandidates: quoteCandidates.length,
    quoteSent,
    reviewCandidates: reviewCandidates.length,
    reviewSent,
    errors: errors.length > 0 ? errors : undefined,
  });
}
