import { NextRequest, NextResponse } from "next/server";
import { mailLogo, mailButton } from "../../../lib/email-shell";
import { randomBytes } from "crypto";
import { fetchCommsPaged } from "../../../lib/mc-comms";
import { sendSellerSms, optedOutIn, looksLikePhone } from "../../../lib/seller-sms";
import { sidToken } from "../../../lib/go-sid-token";
import { readChat, validGoSession, phoneKey } from "../../../lib/gochat-store";

// Hourly reminder cron — Skywalker 2026-05-18 "remind 24hr after they
// get quote to meet/respond/ship, make custom depending on shipping
// or meeting, and another for review 24hr if marked paid".
//
// Reminder kinds, all idempotent via [REMINDER-SENT: id] kind=… markers
// persisted to MC. The cron is safe to run every hour — it only fires
// inside each kind's aging window AND never double-fires for the same id.
//
// QUOTE REMINDER (once, 24h–7d after submission, still quote_requested):
//   • ship handoff → "Your label is in your inbox, drop at FedEx"
//   • local handoff → "Ready to meet? Reply with time + spot"
//   • no handoff set → "Quote still locked" — for /go leads the CTA is the
//     seller's own chat thread (deep link) + MEET/SHIP keywords
//
// EXPIRY REMINDER (once, inside the last 36h of a /go lead's 14-day lock,
//   still quote_requested): "your lock ends <date> — MEET or SHIP".
//
// CHAT REMINDER (once, 24h–7d after a [CHAT LEAD ✅] with a contact and no
//   lock, no owner engagement in the thread): "still want to sell the X?"
//   These were 6 of the first 10 ad contacts and sat outside every cron.
//
// REVIEW REMINDER (once, 24h–7d after paid/met flip, no review yet).
//
// SMS rides the Telnyx relay (app/lib/seller-sms.ts) — the Twilio account is
// dead ("i dont have twilo", 2026-07-05), which is why phone-only /go locks
// silently received nothing for three weeks. STOP is honored via the
// [SMS-OPT-OUT: <number>] marker the inbound route writes.
//
// ?dry=1 → compute every candidate, send nothing, list what WOULD go.
//
// Auth: CRON_SECRET on the Authorization header. Vercel auto-sends
// this on cron-fired requests. Manual hits get 401.

export const runtime = "nodejs";

const MC_API = "https://missioncontrolsdjg-production.up.railway.app";
const MC_KEY = process.env.MC_API_KEY || "";
const RESEND_KEY = process.env.RESEND_API_KEY || "";
const SITE = "https://topcashcellular.com";

// 24-48 hour aging window. Reminders only fire once per lead per kind.
const REMIND_AFTER_MS = 24 * 60 * 60 * 1000;
// Catch-up window widened 48h → 7d. The hourly cron used to only fire inside a
// 24-48h slice, so a single MC outage overlapping that slice meant a lead aged
// past 48h and NEVER got its quote/review reminder (no retry). The not-already-
// reminded flag keeps it idempotent — each lead still gets exactly one. 7d
// bounds it so genuinely stale leads aren't re-engaged forever. (bug fix)
const REMIND_UNTIL_MS = 7 * 24 * 60 * 60 * 1000;
// Expiry note goes out inside the last 36h of the lock.
const EXPIRY_LEAD_MS = 36 * 60 * 60 * 1000;
// Per-run cap on chat-thread reads (each is a blob list + a few fetches).
const MAX_CHAT_CHECKS = 20;

type Kind = "quote" | "review" | "expiry" | "chat";

async function sendSms(to: string, body: string): Promise<boolean> {
  if (!looksLikePhone(to)) return false;
  return sendSellerSms(to, body);
}

async function sendEmail(to: string, subject: string, html: string, text: string): Promise<boolean> {
  if (!RESEND_KEY) return false;
  try {
    const { Resend } = await import("resend");
    const resend = new Resend(RESEND_KEY);
    const r = await resend.emails.send({
      from: "Top Cash Cellular <noreply@topcashcellular.com>",
      replyTo: "support@topcashcellular.com",
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

async function logReminderSent(leadId: string, kind: Kind) {
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

// Email template wrapper. Sonny's 2026-05-29 design (PNG logo,
// indigo card #1b1d39) is preserved — Skywalker's "logo messed up"
// screenshot was actually Gmail iOS auto-inverting the dark card to a
// light pinkish bg, which left the dark PNG sitting in a near-white
// frame with the body-text contrast inverted. Fix: declare the email
// as `color-scheme: light dark` + matching <meta> so Gmail honors the
// authored palette instead of re-tinting it. The dark header/card now
// renders dark on every client.
function wrapEmail(opts: { title: string; bodyHtml: string; ctaHref?: string; ctaLabel?: string; accent?: string }): string {
  const accent = opts.accent || "#00c853";
  const cta = opts.ctaHref && opts.ctaLabel
    ? `<div style="text-align:center;margin:24px 0 12px">${mailButton(opts.ctaHref, opts.ctaLabel, accent.toLowerCase() === "#00c853" ? "green" : "yellow")}</div>`
    : "";
  // Logo: transparent glass wordmark (`/logo-wordmark-glass.png`) at 150px.
  // The old `email-logo.png` carried a grungy distressed black texture and
  // `logo-email.png` baked in a dark-navy badge plate that didn't match the
  // #1b1d39 card — both read as "not clean / not seamless". The transparent
  // wordmark has no plate and no grunge, so it sits seamlessly on the card
  // in every client. Unified across all email routes.
  return `<!doctype html><html><head><meta name="color-scheme" content="light dark"><meta name="supported-color-schemes" content="light dark"></head><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;background:#13142b;color:#e6e6e6;margin:0;padding:32px 16px;color-scheme:light dark;supported-color-schemes:light dark"><div style="max-width:600px;margin:0 auto;background:#1b1d39;border:1px solid rgba(255,255,255,0.08);border-radius:18px;overflow:hidden"><div style="padding:24px 28px;color:#ffffff;background:#1b1d39"><div style="margin:0 0 16px">${mailLogo()}</div><div style="font-size:22px;font-weight:800;line-height:1.2;color:#ffffff">${opts.title}</div></div><div style="padding:28px;background:#1b1d39">${opts.bodyHtml}${cta}<p style="font-size:12px;color:#9a9bb0;line-height:1.6;margin:24px 0 0;text-align:center;border-top:1px solid rgba(255,255,255,0.08);padding-top:18px">Questions? Reply or write to <a href="mailto:support@topcashcellular.com" style="color:${accent};text-decoration:none">support@topcashcellular.com</a></p></div></div></body></html>`;
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
  // /go leads only: the chat session (deep-linkable) and the lock deadline.
  session?: string;
  lockUntil?: string;
  isGo?: boolean;
  manual?: boolean; // Quote: TBD (custom) — hand quote, no number to remind about
};

// The seller's own thread when we know it (HMAC-signed so the /go client
// adopts it in whatever browser the text opens), else the bare page.
function goLink(session?: string): string {
  if (!session || !validGoSession(session)) return `${SITE}/go`;
  const k = sidToken(session);
  return k ? `${SITE}/go?sid=${session}&k=${k}` : `${SITE}/go`;
}

function dateLabel(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "America/Chicago" });
}

function templateQuoteReminder(lead: LeadShape, handoffKind: "ship" | "local" | "none") {
  const first = (lead.name || "there").split(" ")[0];
  const device = lead.model || lead.device || "your device";
  const quoteStr = lead.quote ? `${lead.quote}` : "your locked-in price";
  if (handoffKind === "ship") {
    return {
      // Skywalker 2026-06-04: the ship reminder shouldn't re-front the
      // label — the label was already emailed at handoff time and a
      // second "your label is ready" subject reads as a redundant
      // duplicate in the inbox. Reframe around the quote still being
      // locked in + a calm "drop whenever you're ready" CTA.
      smsBody: `Top Cash: Hi ${first}, just checking in — your quote for ${device} (${quoteStr}) is still locked in. Drop your device at any FedEx location whenever you're ready and we'll text you the moment it lands. Reply STOP to opt out.`,
      emailSubject: `Your quote for ${device} is still locked in`,
      emailHtml: wrapEmail({
        title: "Your quote is still locked in",
        bodyHtml: `<p style="font-size:16px;color:#fff;font-weight:700;margin:0 0 14px">Hi ${first},</p><p style="font-size:15px;line-height:1.65;color:#e6e6e6;margin:0 0 14px">Quick reminder — your quote for <span style="color:#00c853;font-weight:600">${device}</span> at <span style="color:#00c853;font-weight:700">${quoteStr}</span> is still locked in.</p><p style="font-size:15px;line-height:1.65;color:#e6e6e6;margin:0">Drop your device at any FedEx location whenever you're ready. We'll text you the moment it lands — same business day inspection and payout.</p>`,
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
  if (lead.isGo) {
    // /go seller who hasn't picked meet/ship yet (the chips after the lock
    // and the MEET/SHIP text reply both land in handoffBySession above, and
    // take the local/ship branches). The reminder IS the handoff ask.
    const link = goLink(lead.session);
    const until = lead.lockUntil ? ` until ${dateLabel(lead.lockUntil)}` : "";
    return {
      smsBody: `Top Cash: Hi ${first}, your ${device} offer (${quoteStr}) is still locked${until}. Reply MEET for a cash meetup in the Austin area or SHIP for a free FedEx label — or pick it back up here: ${link} Reply STOP to opt out.`,
      emailSubject: `Reminder: your ${device} offer is still locked`,
      emailHtml: wrapEmail({
        title: "Your offer is still locked in",
        bodyHtml: `<p style="font-size:16px;color:#fff;font-weight:700;margin:0 0 14px">Hi ${first},</p><p style="font-size:15px;line-height:1.65;color:#e6e6e6;margin:0 0 14px">Your offer for <span style="color:#00c853;font-weight:600">${device}</span> at <span style="color:#00c853;font-weight:700">${quoteStr}</span> is still locked${until}.</p><p style="font-size:15px;line-height:1.65;color:#e6e6e6;margin:0">Reply <strong style="color:#fff">MEET</strong> for a cash meetup in the Austin area or <strong style="color:#fff">SHIP</strong> for a free FedEx label — or pick it back up in your chat.</p>`,
        ctaHref: link,
        ctaLabel: "Open my chat →",
      }),
    };
  }
  // No handoff picked yet — gentle nudge back to the funnel.
  return {
    smsBody: `Top Cash: Hi ${first}, your quote for ${device} (${quoteStr}) is still locked in. Pick local meetup or free FedEx pickup whenever you're ready: ${SITE}. Reply STOP to opt out.`,
    emailSubject: `Reminder: your ${device} quote is still good`,
    emailHtml: wrapEmail({
      title: "Your quote is still locked in",
      bodyHtml: `<p style="font-size:16px;color:#fff;font-weight:700;margin:0 0 14px">Hi ${first},</p><p style="font-size:15px;line-height:1.65;color:#e6e6e6;margin:0 0 14px">Your quote for <span style="color:#00c853;font-weight:600">${device}</span> at <span style="color:#00c853;font-weight:700">${quoteStr}</span> is still good.</p><p style="font-size:15px;line-height:1.65;color:#e6e6e6;margin:0">Local meetup (same-day cash) or free FedEx pickup — pick whichever works.</p>`,
      ctaHref: SITE,
      ctaLabel: "Finish your trade →",
    }),
  };
}

function templateExpiry(lead: LeadShape) {
  const first = (lead.name || "there").split(" ")[0];
  const device = lead.model || lead.device || "your device";
  const quoteStr = lead.quote ? `${lead.quote}` : "your locked-in price";
  const until = lead.lockUntil ? dateLabel(lead.lockUntil) : "soon";
  const link = goLink(lead.session);
  return {
    smsBody: `Top Cash: Hi ${first}, heads up — your ${quoteStr} lock on the ${device} ends ${until}. Reply MEET or SHIP to get paid before it does, or pick it back up here: ${link} Reply STOP to opt out.`,
    emailSubject: `Your ${device} lock ends ${until}`,
    emailHtml: wrapEmail({
      title: `Your lock ends ${until}`,
      accent: "#ffb400",
      bodyHtml: `<p style="font-size:16px;color:#fff;font-weight:700;margin:0 0 14px">Hi ${first},</p><p style="font-size:15px;line-height:1.65;color:#e6e6e6;margin:0 0 14px">Your <span style="color:#00c853;font-weight:700">${quoteStr}</span> offer on the <span style="color:#00c853;font-weight:600">${device}</span> holds until <strong style="color:#fff">${until}</strong>. After that we re-quote at the current market.</p><p style="font-size:15px;line-height:1.65;color:#e6e6e6;margin:0">Reply <strong style="color:#fff">MEET</strong> for a cash meetup in the Austin area or <strong style="color:#fff">SHIP</strong> for a free FedEx label.</p>`,
      ctaHref: link,
      ctaLabel: "Open my chat →",
    }),
  };
}

function templateChat(device: string, session: string) {
  const link = goLink(session);
  const dev = device || "your device";
  return {
    smsBody: `Top Cash: still want to sell the ${dev}? any number we gave you holds 14 days — pick it back up here and we'll get you paid: ${link} Reply STOP to opt out.`,
    emailSubject: `Still want to sell your ${dev}?`,
    emailHtml: wrapEmail({
      title: `Still want to sell your ${dev}?`,
      bodyHtml: `<p style="font-size:15px;line-height:1.65;color:#e6e6e6;margin:0 0 14px">Your chat with us is saved and any number we gave you holds 14 days.</p><p style="font-size:15px;line-height:1.65;color:#e6e6e6;margin:0">Pick it back up whenever you're ready — cash meetup in the Austin area or a free FedEx label, your pick.</p>`,
      ctaHref: link,
      ctaLabel: "Open my chat →",
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

// A [CHAT LEAD ✅] with a contact — the site chat's lead record.
type ChatLead = { id: string; timestamp: string; session: string; device: string; contact: string };
function parseChatLead(id: string, timestamp: string, body: string): ChatLead | null {
  const m = body.match(/^\[CHAT LEAD ✅\]\s+sess:(go-[a-z0-9-]{2,30})\s+·\s+(?:(.+?)\s+·\s+)?reply to:\s*([^\n]+)/i);
  if (!m) return null;
  return { id, timestamp, session: m[1], device: (m[2] || "").trim().slice(0, 80), contact: m[3].trim().slice(0, 120) };
}

export async function GET(req: NextRequest) {
  // Auth — Vercel cron sends `Authorization: Bearer ${CRON_SECRET}`.
  const auth = req.headers.get("authorization") || "";
  const secret = process.env.CRON_SECRET;
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const dryRun = req.nextUrl.searchParams.get("dry") === "1";

  // Pull a generous slice of MC comms — needs to cover both the lead
  // submission timestamps AND any [REMINDER-SENT]/[REVIEW-USED] markers
  // that would suppress a re-send.
  // Page a recent window rather than a single limit=1000 slice. Reminders
  // only act on leads aged 1–7 days (REMIND_UNTIL_MS), and the dedup markers
  // ([REMINDER-SENT]/[REVIEW-USED]/[STATUS]) that suppress a re-send are
  // equally recent — but on a busy feed the newest 1000 messages can span
  // less than 7 days, so a still-eligible lead (or its dedup marker) could
  // fall outside the slice → a duplicate or missed reminder. 21 days of
  // history covers the 14-day lock expiry window with margin.
  let messages: { id?: string; body?: string; timestamp: string }[] = [];
  try {
    messages = await fetchCommsPaged({
      apiKey: MC_KEY,
      includeArchive: false,
      sinceMs: 21 * 24 * 60 * 60 * 1000,
      maxPages: 10,
    });
    if (messages.length === 0) {
      return NextResponse.json({ error: "MC unavailable" }, { status: 502 });
    }
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "fetch failed" }, { status: 502 });
  }

  // Index status updates, reminders, review-used markers.
  const statusByLead = new Map<string, { status: string; ts: string }>();
  const remindedByKind: Record<Kind, Set<string>> = { quote: new Set(), review: new Set(), expiry: new Set(), chat: new Set() };
  const reviewUsedLeads = new Set<string>();
  const reviewTokenByLead = new Map<string, { token: string; expires?: string }>();
  // Contacts that DID lock (any [NEW BUYBACK LEAD] in the window) — a chat
  // lead whose number later locked needs no "still want to sell" nudge.
  const lockedContacts = new Set<string>();
  // /go sellers who already picked meet/ship (chips or a MEET/SHIP text) —
  // the [DELIVERY OPTION] comm carries their Session: line. Their reminder
  // uses the local/ship template, never "reply MEET or SHIP" again.
  const handoffBySession = new Map<string, "ship" | "local">();
  for (const m of messages) {
    if (!m.body) continue;
    const dm = m.body.match(/^\[DELIVERY OPTION\]\s*(LOCAL|SHIPPING)/i);
    if (dm) {
      const sess = parseField(m.body, "Session");
      if (sess) handoffBySession.set(sess, /^local$/i.test(dm[1]) ? "local" : "ship");
    }
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
      const kind = m.body.match(/kind=(quote|review|expiry|chat)/i)?.[1]?.toLowerCase() as Kind | undefined;
      if (kind) remindedByKind[kind].add(lid);
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
    if (/\[NEW BUYBACK LEAD/i.test(m.body)) {
      const p = phoneKey(parseField(m.body, "Phone") || "");
      const e = (parseField(m.body, "Email") || "").toLowerCase();
      if (p) lockedContacts.add(p);
      if (e) lockedContacts.add(e);
    }
  }

  const now = Date.now();
  const quoteCandidates: LeadShape[] = [];
  const expiryCandidates: LeadShape[] = [];
  const reviewCandidates: { lead: LeadShape; statusTs: string }[] = [];
  const chatCandidates: ChatLead[] = [];

  const isDeleted = (id: string) => {
    const lastDel = messages.filter((mm) => mm.body && new RegExp(`\\[DELETED-LEAD:\\s*${id}\\]`, "i").test(mm.body)).map((mm) => mm.timestamp).sort().pop();
    if (!lastDel) return false;
    const lastRes = messages.filter((mm) => mm.body && new RegExp(`\\[RESTORED-LEAD:\\s*${id}\\]`, "i").test(mm.body)).map((mm) => mm.timestamp).sort().pop();
    return !lastRes || lastRes < lastDel;
  };

  for (const m of messages) {
    if (!m.body || !m.id) continue;
    // Chat-contact leads (site chat) — their own candidate list.
    if (/^\[CHAT LEAD ✅\]/.test(m.body)) {
      const cl = parseChatLead(m.id, m.timestamp, m.body);
      if (!cl) continue;
      const age = now - new Date(m.timestamp).getTime();
      if (age < REMIND_AFTER_MS || age >= REMIND_UNTIL_MS) continue;
      if (remindedByKind.chat.has(m.id)) continue;
      const pk = phoneKey(cl.contact);
      const ek = cl.contact.includes("@") ? cl.contact.toLowerCase() : "";
      if ((pk && lockedContacts.has(pk)) || (ek && lockedContacts.has(ek))) continue; // they locked — the lead cron covers them
      if (pk && optedOutIn(messages, cl.contact)) continue;
      chatCandidates.push(cl);
      continue;
    }
    if (!/\[NEW BUYBACK LEAD(\b| — \d+ DEVICES\])/i.test(m.body)) continue;
    // Deleted leads (soft-trashed) → skip. They re-surface only on restore.
    if (isDeleted(m.id)) continue;
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
    const source = parseField(m.body, "Source") || "";
    const session = parseField(m.body, "Session");
    const quoteRaw = parseField(m.body, "Quote") || "";
    const lead: LeadShape = {
      id: m.id,
      body: m.body,
      timestamp: m.timestamp,
      name,
      phone: phone && optedOutIn(messages, phone) ? undefined : phone,
      email,
      device: deviceLine.split(" — ")[0],
      model: deviceLine.split(" — ")[1],
      // "TBD (custom)" = hand quote (won't-turn-on/parts locks, manual-
      // review MacBooks): no number, so no "still locked" reminder and no
      // lock to expire — the seller is waiting on the OWNER's number (the
      // go_unworked watchdog nudges him). Before this the texts read
      // "your iPhone 17 Pro offer (TBD (custom)) is still locked".
      quote: /\d/.test(quoteRaw) ? quoteRaw : undefined,
      manual: !/\d/.test(quoteRaw),
      handoffMethod: handoffMethod ?? (session ? handoffBySession.get(session) : undefined),
      session,
      lockUntil: parseField(m.body, "Lock-Until"),
      isGo: /source=go\b/i.test(source),
    };
    if (!lead.phone && !lead.email) continue; // opted out and no email

    const status = statusByLead.get(m.id);
    const statusName = status?.status || "quote_requested";
    const statusTs = status?.ts || m.timestamp;
    const ageMs = now - new Date(statusTs).getTime();

    // Quote reminder — still in quote_requested, aged 24-48h, not yet
    // reminded. We use submission timestamp (m.timestamp) for age
    // since the lead may never have had a [STATUS:] update.
    if (statusName === "quote_requested" && !lead.manual) {
      const subAge = now - new Date(m.timestamp).getTime();
      if (subAge >= REMIND_AFTER_MS && subAge < REMIND_UNTIL_MS && !remindedByKind.quote.has(m.id)) {
        quoteCandidates.push(lead);
      }
      // Expiry — /go leads only (they carry Lock-Until), inside the last 36h.
      if (lead.lockUntil && !remindedByKind.expiry.has(m.id)) {
        const untilMs = new Date(lead.lockUntil).getTime();
        if (Number.isFinite(untilMs) && now >= untilMs - EXPIRY_LEAD_MS && now < untilMs) {
          expiryCandidates.push(lead);
        }
      }
    }

    // Review reminder — paid or met, status flipped 24-48h ago, no
    // review submitted yet, no review-reminder sent yet.
    if (statusName === "paid" || statusName === "met") {
      if (ageMs >= REMIND_AFTER_MS && ageMs < REMIND_UNTIL_MS && !remindedByKind.review.has(m.id) && !reviewUsedLeads.has(m.id)) {
        reviewCandidates.push({ lead, statusTs });
      }
    }
  }

  // /go leads Sonny is already texting with (an owner message in the thread)
  // get no automated nudge from the same number. Bounded blob reads.
  const ownerWorked = new Set<string>();
  {
    const goSessions = [...new Set([...quoteCandidates, ...expiryCandidates].filter((l) => l.isGo && l.session).map((l) => l.session as string))].slice(0, MAX_CHAT_CHECKS);
    for (const sid of goSessions) {
      if (!validGoSession(sid)) continue;
      const state = await readChat(sid, 0);
      if (state.lastOwnerTs > 0) ownerWorked.add(sid);
    }
  }
  const quoteReady = quoteCandidates.filter((l) => !(l.session && ownerWorked.has(l.session)));
  const expiryReady = expiryCandidates.filter((l) => !(l.session && ownerWorked.has(l.session)));

  // Chat candidates: skip threads Sonny already worked (an owner message),
  // threads that locked after the chat lead posted, and threads where the
  // seller already picked a handoff by text. Bounded per run.
  const chatReady: ChatLead[] = [];
  for (const cl of chatCandidates.slice(0, MAX_CHAT_CHECKS)) {
    const state = await readChat(cl.session, 0);
    const notes = state.msgs.filter((x) => x.role === "note").map((x) => x.text);
    if (state.lastOwnerTs > 0) continue;
    if (notes.some((t) => t.startsWith("LOCKED:") || t.startsWith("HANDOFF-CHOICE:") || t.startsWith("SMS-STOP"))) continue;
    chatReady.push(cl);
  }

  if (dryRun) {
    return NextResponse.json({
      ok: true,
      dryRun: true,
      quote: quoteReady.map((l) => ({ id: l.id, go: !!l.isGo, channel: l.phone ? "sms" : "email", session: l.session || null, handoff: l.handoffMethod || null })),
      expiry: expiryReady.map((l) => ({ id: l.id, lockUntil: l.lockUntil, channel: l.phone ? "sms" : "email" })),
      skippedOwnerWorked: ownerWorked.size,
      chat: chatReady.map((c) => ({ id: c.id, session: c.session, device: c.device, channel: c.contact.includes("@") ? "email" : "sms" })),
      review: reviewCandidates.map((r) => ({ id: r.lead.id })),
      skippedChatChecks: Math.max(0, chatCandidates.length - MAX_CHAT_CHECKS),
    });
  }

  let quoteSent = 0;
  let expirySent = 0;
  let chatSent = 0;
  let reviewSent = 0;
  const errors: string[] = [];

  // Fire quote reminders.
  for (const lead of quoteReady) {
    try {
      const handoffKind: "ship" | "local" | "none" = lead.handoffMethod || "none";
      const tmpl = templateQuoteReminder(lead, handoffKind);
      const tasks: Promise<boolean>[] = [];
      if (lead.phone) tasks.push(sendSms(lead.phone, tmpl.smsBody));
      if (lead.email) tasks.push(sendEmail(lead.email, tmpl.emailSubject, tmpl.emailHtml, tmpl.smsBody));
      const results = await Promise.all(tasks);
      // Only mark reminded if a channel actually delivered. sendSms/sendEmail
      // return false (they don't throw) on a relay/Resend failure, so the old
      // unconditional log would permanently suppress the retry after an outage.
      if (results.some(Boolean)) {
        await logReminderSent(lead.id, "quote");
        quoteSent++;
      } else {
        errors.push(`quote ${lead.id}: all channels failed`);
      }
    } catch (e) {
      errors.push(`quote ${lead.id}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  // Fire expiry notes.
  for (const lead of expiryReady) {
    try {
      const tmpl = templateExpiry(lead);
      const tasks: Promise<boolean>[] = [];
      if (lead.phone) tasks.push(sendSms(lead.phone, tmpl.smsBody));
      if (lead.email) tasks.push(sendEmail(lead.email, tmpl.emailSubject, tmpl.emailHtml, tmpl.smsBody));
      const results = await Promise.all(tasks);
      if (results.some(Boolean)) {
        await logReminderSent(lead.id, "expiry");
        expirySent++;
      } else {
        errors.push(`expiry ${lead.id}: all channels failed`);
      }
    } catch (e) {
      errors.push(`expiry ${lead.id}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  // Fire chat-contact reminders.
  for (const cl of chatReady) {
    try {
      const tmpl = templateChat(cl.device, cl.session);
      const ok = cl.contact.includes("@")
        ? await sendEmail(cl.contact, tmpl.emailSubject, tmpl.emailHtml, tmpl.smsBody)
        : await sendSms(cl.contact, tmpl.smsBody);
      if (ok) {
        await logReminderSent(cl.id, "chat");
        chatSent++;
      } else {
        errors.push(`chat ${cl.id}: send failed`);
      }
    } catch (e) {
      errors.push(`chat ${cl.id}: ${e instanceof Error ? e.message : String(e)}`);
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
      const reviewUrl = `${SITE}/reviews/new?${params.toString()}`;
      const tmpl = templateReviewReminder(lead, reviewUrl);
      const tasks: Promise<boolean>[] = [];
      if (lead.phone) tasks.push(sendSms(lead.phone, tmpl.smsBody));
      if (lead.email) tasks.push(sendEmail(lead.email, tmpl.emailSubject, tmpl.emailHtml, tmpl.smsBody));
      const results = await Promise.all(tasks);
      // Only mark reminded if a channel actually delivered (see quote loop).
      if (results.some(Boolean)) {
        await logReminderSent(lead.id, "review");
        reviewSent++;
      } else {
        errors.push(`review ${lead.id}: all channels failed`);
      }
    } catch (e) {
      errors.push(`review ${lead.id}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  return NextResponse.json({
    ok: true,
    quoteCandidates: quoteReady.length,
    quoteSent,
    expiryCandidates: expiryReady.length,
    expirySent,
    skippedOwnerWorked: ownerWorked.size,
    chatCandidates: chatReady.length,
    chatSent,
    reviewCandidates: reviewCandidates.length,
    reviewSent,
    errors: errors.length > 0 ? errors : undefined,
  });
}
