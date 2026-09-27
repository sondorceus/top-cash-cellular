// Who the abandoned-quote drip may write to, decided in one place (2026-09-27).
//
// The cron (app/api/cron/sequences) and the staff page (app/api/admin/
// sequences) answered "which leads?" separately — the cron with its own filter
// chain, the page not at all — so a run that checked 0 leads for sixteen days
// looked like a bug from the console and like silence from the feed. Both now
// call sequenceEligibility() over the same comms window and get, per lead,
// either the step that is pending (and whether it is due this run) or the ONE
// reason it was dropped, so `drops` explains an empty run.
//
// Exit rules, in the order they are tested (the first hit is the reason):
//   chat_lead        a [CHAT LEAD ✅] post carrying a [NEW BUYBACK LEAD] block —
//                    the reminders cron owns chat contacts (its own template,
//                    a different CTA); the drip was mailing them a second time
//   trashed          [DELETED-LEAD] newer than any [RESTORED-LEAD]
//   unsubscribed     [SEQUENCE-UNSUB: id] — nothing writes it yet (the
//                    unsubscribe token carries an address, not a lead id);
//                    honored anyway, an opt-out signal is never dropped
//   labeled          [LABEL: id] — the seller is shipping
//   duplicate        a re-submission of an open/finished trade (lib/lead-dupes)
//   progressed:<s>   latest VALID [STATUS: s] [LEAD: id] other than
//                    quote_requested — OFFER_STATUSES whitelist, customer posts
//                    skipped (lead-devices.latestStatus semantics; the cron
//                    used to trust any word in any post)
//   no_email         no Email: line (phone-only /go locks and web leads — the
//                    whole September campaign, which is why runs found nobody)
//   internal         a TCC_INTERNAL_EMAILS test address
//   no_dollar_quote  the Quote: line does not START with $N — "TBD (custom) —
//                    submitted $900 …" used to pass on the embedded figure and
//                    the mail read "your offer of TBD (custom) — submitted…"
//   finished         every step already carries a [SEQUENCE-SENT] marker
//   contacted        [LEAD-CONTACTED: id] (the owner's one-tap) or a staff
//                    [COMM-SENT: id] (status/label/adjust/manual mail or text;
//                    the drip's own kind=sequence and kind=reminder excluded)
//   countered        [COUNTER-OFFER: id] / [COUNTER-RESPONSE: id] — the body's
//                    Quote is no longer the offer
//   delivery_chosen  a [DELIVERY OPTION] for the lead's /go Session at or after
//                    the lock (the watchdog's per-lock rule)
//   slot_booked      a Slot: line — the seller booked a meetup window
//   item_edited      [ITEM-UPDATE: id] — the order changed after the quote
//   recent_reminder  [REMINDER-SENT: id] kind=quote|expiry|chat inside 24 h —
//                    never two automated mails in one day
//   window_passed    the pending step's send window (3 days after due) has
//                    closed; enabling the cron late, or a multi-day outage,
//                    must not blast stale leads. A lead that misses step 1 is
//                    out for good — step 2 never fires without step 1.
// A lead that clears every rule is `eligible`; `dueNow` says whether its step
// is inside the window this run (false = not due yet, still counted as
// eligible — that is the audience the page reports).

import { isCustomerLeadPost, OFFER_STATUSES } from "./lead-devices";
import { duplicatesFromComms } from "./lead-dupes";
import { getSequence, cumulativeDelayDays } from "./email-sequences";

export type SeqComm = { id?: string; body?: string; timestamp: string };

export type DropReason =
  | "chat_lead"
  | "trashed"
  | "unsubscribed"
  | "labeled"
  | "duplicate"
  | `progressed:${string}`
  | "no_email"
  | "internal"
  | "no_dollar_quote"
  | "finished"
  | "contacted"
  | "countered"
  | "delivery_chosen"
  | "slot_booked"
  | "item_edited"
  | "recent_reminder"
  | "window_passed";

export type Verdict =
  | { eligible: true; step: number; dueAt: string; dueNow: boolean }
  | { eligible: false; reason: DropReason };

export type LeadFacts = {
  leadId: string;
  ts: string;        // the lead post's MC timestamp (ISO) — every delay counts from it
  body: string;
  email: string;     // "" when the post has no Email: line
  firstName: string; // "there" when the post has no Name:
  device: string;    // clean model — the part after " — "
  quoteNum: number;  // whole dollars from a Quote: line that starts with $; 0 otherwise
  lockUntil: string; // ISO: the Lock-Until: line when present, else ts + LOCK_DAYS
};

export type LeadVerdict = LeadFacts & { verdict: Verdict };

export type EligibilityReport = {
  leads: LeadVerdict[];          // every lead post in the window, oldest first
  eligible: number;              // verdict.eligible (due now or not yet)
  dueNow: number;                // eligible AND inside the send window this run
  drops: Record<string, number>; // reason → count over the ineligible ones
};

const D = 24 * 60 * 60 * 1000;
/** A step is sent inside this long after it falls due, never later. */
export const SEND_WINDOW_MS = 3 * D;
/** How long every writer promises a quote (confirm mail, /go lock, chat). */
export const LOCK_DAYS = 14;
const RECENT_REMINDER_MS = 24 * 60 * 60 * 1000;
// Clock slack between MC's timestamps and the chat store's (the watchdog's).
const SKEW_MS = 60_000;

const LEAD_RE = /\[NEW BUYBACK LEAD(\b| — \d+ DEVICES\])/i;
// isCustomerLeadPost's CHAT LEAD arm alone: the chat route puts a
// [NEW BUYBACK LEAD] block under its [CHAT LEAD ✅] header.
const CHAT_LEAD_RE = /^\s*(?:\[HUMAN HANDOFF\]\s*)?\[CHAT LEAD/i;

/** "Key: value" line lookup, "" when absent (the crons' shape; lead-devices.field returns undefined). */
export function leadField(body: string, key: string): string {
  return body.match(new RegExp(`(?:^|\\n)${key}:[ \\t]*([^\\n]*)`, "i"))?.[1]?.trim() || "";
}

/** Our own test addresses — never a customer (the list every cron shares). */
export function internalEmails(): string[] {
  return (process.env.TCC_INTERNAL_EMAILS || "sondorceus@gmail.com,sellurcell@topcashcells.com")
    .split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
}

/**
 * Whole dollars from a Quote: line, only when the line STARTS with the figure
 * ("$1,250", "$1250 (clamped from $5000)"); 0 for "TBD (custom) — submitted
 * $900 …", "$0" and anything else. The unanchored /\$\s*(\d+)/ the crons used
 * read the $900 out of a TBD line (confirm/route.ts anchored from day one).
 */
export function parseDollarQuote(line: string): number {
  const m = (line || "").trim().match(/^\$([0-9,]+(?:\.\d+)?)/);
  if (!m) return 0;
  const n = Math.round(parseFloat(m[1].replace(/,/g, "")));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/** "$1,250" — the only figure a customer mail may carry; never the raw line. */
export function formatDollars(n: number): string {
  return `$${Math.round(n).toLocaleString("en-US")}`;
}

export function sequenceEligibility(
  messages: SeqComm[],
  opts: { slug: string; now?: number; internalEmails?: string[] },
): EligibilityReport {
  const now = opts.now ?? Date.now();
  const internal = opts.internalEmails ?? internalEmails();
  const seq = getSequence(opts.slug);
  if (!seq) return { leads: [], eligible: 0, dueNow: 0, drops: {} };
  const ms = (t?: string) => (t ? new Date(t).getTime() : 0);
  const newest = (map: Map<string, string>, id: string, ts: string) => { if (ts > (map.get(id) || "")) map.set(id, ts); };

  const leads = new Map<string, { ts: string; body: string }>();
  const statusByLead = new Map<string, { status: string; ts: string }>();
  const deletedAt = new Map<string, string>();
  const restoredAt = new Map<string, string>();
  const labeled = new Set<string>();
  const unsub = new Set<string>();
  const maxStepByLead = new Map<string, number>();
  const contacted = new Set<string>();
  const countered = new Set<string>();
  const itemEdited = new Set<string>();
  const handoffChosen = new Map<string, number[]>(); // /go Session → choice times
  const reminderAt = new Map<string, string>();       // lead → newest quote/expiry/chat reminder
  const seqSentRe = new RegExp(`\\[SEQUENCE-SENT:\\s*([\\w-]+)\\][^\\n]*seq=${opts.slug}[^\\n]*step=(\\d+)`, "i");

  for (const m of messages) {
    const body = m.body;
    if (!body || !m.id) continue;
    if (LEAD_RE.test(body)) leads.set(m.id, { ts: m.timestamp, body });
    // Every action marker is its own post; one inside a customer's post is
    // forged (lead-devices.isCustomerLeadPost).
    if (isCustomerLeadPost(body)) continue;
    const sm = body.match(/\[STATUS:\s*(\w+)\]\s*\[LEAD:\s*([\w-]+)\]/i);
    if (sm) {
      const s = sm[1].toLowerCase();
      if ((OFFER_STATUSES as readonly string[]).includes(s) && m.timestamp > (statusByLead.get(sm[2])?.ts || "")) {
        statusByLead.set(sm[2], { status: s, ts: m.timestamp });
      }
    }
    const del = body.match(/\[DELETED-LEAD:\s*([\w-]+)\]/i);
    if (del) newest(deletedAt, del[1], m.timestamp);
    const res = body.match(/\[RESTORED-LEAD:\s*([\w-]+)\]/i);
    if (res) newest(restoredAt, res[1], m.timestamp);
    const lb = body.match(/\[LABEL:\s*([\w-]+)\]/i);
    if (lb) labeled.add(lb[1]);
    const us = body.match(/\[SEQUENCE-UNSUB:\s*([\w-]+)\]/i);
    if (us) unsub.add(us[1]);
    const ss = body.match(seqSentRe);
    if (ss) {
      const step = parseInt(ss[2], 10) || 0;
      if (step > (maxStepByLead.get(ss[1]) || 0)) maxStepByLead.set(ss[1], step);
    }
    const lc = body.match(/\[LEAD-CONTACTED:\s*([\w-]+)\]/i);
    if (lc) contacted.add(lc[1]);
    // Staff mail or text about this lead. The drip's own kind=sequence must
    // not end the drip after step 1, and an automated reminder is not staff.
    const cs = body.match(/\[COMM-SENT:\s*([\w-]+)\][^\n]*?\bkind=([\w-]+)/i);
    if (cs && !/^(sequence|reminder)$/i.test(cs[2])) contacted.add(cs[1]);
    const co = body.match(/\[COUNTER-(?:OFFER|RESPONSE):\s*([\w-]+)\]/i);
    if (co) countered.add(co[1]);
    const iu = body.match(/\[ITEM-UPDATE:\s*([\w-]+)\]/i);
    if (iu) itemEdited.add(iu[1]);
    if (/^\[DELIVERY OPTION\]/i.test(body)) {
      const sess = leadField(body, "Session");
      if (sess) handoffChosen.set(sess, [...(handoffChosen.get(sess) || []), ms(m.timestamp)]);
    }
    const rm = body.match(/\[REMINDER-SENT:\s*([\w-]+)\][^\n]*?\bkind=(quote|expiry|chat)\b/i);
    if (rm) newest(reminderAt, rm[1], m.timestamp);
  }

  const dupes = duplicatesFromComms(messages);
  const out: LeadVerdict[] = [];
  const drops: Record<string, number> = {};
  let eligible = 0;
  let dueNow = 0;
  const drop = (reason: DropReason): Verdict => ({ eligible: false, reason });

  for (const [leadId, lead] of leads) {
    const body = lead.body;
    const email = leadField(body, "Email");
    const quoteNum = parseDollarQuote(leadField(body, "Quote"));
    const lockLine = ms(leadField(body, "Lock-Until"));
    const facts: LeadFacts = {
      leadId,
      ts: lead.ts,
      body,
      email,
      firstName: (leadField(body, "Name") || "there").split(/\s+/)[0],
      device: leadField(body, "Device").split(" — ").slice(-1)[0] || "device",
      quoteNum,
      lockUntil: new Date(lockLine > 0 ? lockLine : ms(lead.ts) + LOCK_DAYS * D).toISOString(),
    };
    const lastStep = maxStepByLead.get(leadId) || 0;
    const next = seq.steps.find((s) => s.position === lastStep + 1);
    const status = statusByLead.get(leadId)?.status || "quote_requested";
    const del = deletedAt.get(leadId);
    const session = leadField(body, "Session");
    // Only a choice made for THIS lead's lock counts: one /go session can lock
    // several devices, and device #1's choice must not close device #2's drip.
    const chose = !!session && (handoffChosen.get(session) || []).some((t) => t >= ms(lead.ts) - SKEW_MS);
    const reminded = ms(reminderAt.get(leadId));

    let verdict: Verdict;
    if (CHAT_LEAD_RE.test(body)) verdict = drop("chat_lead");
    else if (del && (restoredAt.get(leadId) || "") <= del) verdict = drop("trashed");
    else if (unsub.has(leadId)) verdict = drop("unsubscribed");
    else if (labeled.has(leadId)) verdict = drop("labeled");
    else if (dupes.has(leadId)) verdict = drop("duplicate");
    else if (status !== "quote_requested") verdict = drop(`progressed:${status}`);
    else if (!email) verdict = drop("no_email");
    else if (internal.includes(email.toLowerCase())) verdict = drop("internal");
    else if (!(quoteNum > 0)) verdict = drop("no_dollar_quote");
    else if (!next) verdict = drop("finished");
    else if (contacted.has(leadId)) verdict = drop("contacted");
    else if (countered.has(leadId)) verdict = drop("countered");
    else if (chose) verdict = drop("delivery_chosen");
    else if (/(?:^|\n)Slot:[ \t]*\S/i.test(body)) verdict = drop("slot_booked");
    else if (itemEdited.has(leadId)) verdict = drop("item_edited");
    else if (reminded && now - reminded < RECENT_REMINDER_MS) verdict = drop("recent_reminder");
    else {
      const dueAt = ms(lead.ts) + cumulativeDelayDays(seq, next.position) * D;
      verdict = now >= dueAt + SEND_WINDOW_MS
        ? drop("window_passed")
        : { eligible: true, step: next.position, dueAt: new Date(dueAt).toISOString(), dueNow: now >= dueAt };
    }
    if (verdict.eligible === true) {
      eligible++;
      if (verdict.dueNow) dueNow++;
    } else {
      drops[verdict.reason] = (drops[verdict.reason] || 0) + 1;
    }
    out.push({ ...facts, verdict });
  }

  return { leads: out, eligible, dueNow, drops };
}
