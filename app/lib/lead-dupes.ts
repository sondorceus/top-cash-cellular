// One trade, several lead posts. A seller re-submits — or re-locks on /go —
// the same device while the first trade is still open, or the first trade
// finishes after the re-submission. The extra post isn't a second trade, but
// left alone it listed as its own row, fired the urgent "GO lock, nobody
// reached out" alert every day, and would get its own lock-expiry text.
// (2026-09: a Sep 12 /go lock shipped and got paid; its Sep 20 re-lock kept
// alerting.)
//
// One rule, three readers: the admin leads route folds the post into the real
// trade's row, the watchdog doesn't chase it, the reminders cron doesn't text
// about it. Nothing is deleted — a duplicate stays reachable from its row.

import { isCustomerLeadPost } from "./lead-devices";

export type DupeLead = {
  id: string;
  ts: string;          // the lead post's timestamp (ISO)
  phone?: string;
  email?: string;
  device?: string;     // "iphone — iPhone 17 Pro Max", or just the model
  status?: string;     // latest status; none = quote_requested
  statusTs?: string;   // when that status was set
  hasLabel?: boolean;
  multi?: boolean;     // bundle lead — its device line is a summary, never deduped
};

export const DUPE_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

// How far along the trade is. The further-along post is the real one.
const RANK: Record<string, number> = { quote_requested: 0, shipped: 1, received: 2, tested: 3 };
const DONE = new Set(["paid", "met"]);

const at = (s?: string) => (s ? new Date(s).getTime() || 0 : 0);
const statusOf = (l: DupeLead) => (l.status || "quote_requested").toLowerCase();

// Same seller (phone, else email) + same model. "" = don't dedupe this post.
export function dupeKey(l: DupeLead): string {
  if (l.multi) return "";
  const phone = (l.phone || "").replace(/\D/g, "").slice(-10);
  const contact = phone.length === 10 ? phone : (l.email || "").trim().toLowerCase();
  const model = ((l.device || "").split(" — ").slice(-1)[0] || "").trim().toLowerCase().replace(/\s+/g, " ");
  if (!contact || !model || /^\d+ devices?$/.test(model)) return "";
  return `${contact}|${model}`;
}

/** duplicate lead id → id of the lead it belongs to (the real trade). */
export function findDuplicates(leads: DupeLead[], windowMs = DUPE_WINDOW_MS): Map<string, string> {
  const groups = new Map<string, DupeLead[]>();
  for (const l of leads) {
    const k = dupeKey(l);
    if (!k) continue;
    const g = groups.get(k);
    if (g) g.push(l);
    else groups.set(k, [l]);
  }
  // > 0 when `a` is more clearly the real trade than `b`: further along, then
  // holds a FedEx label, then newer (a re-lock carries the freshest quote).
  const ahead = (a: DupeLead, b: DupeLead) =>
    (RANK[statusOf(a)] ?? 0) - (RANK[statusOf(b)] ?? 0) ||
    Number(!!a.hasLabel) - Number(!!b.hasLabel) ||
    at(a.ts) - at(b.ts);
  const out = new Map<string, string>();
  for (const group of groups.values()) {
    if (group.length < 2) continue;
    for (const l of group) {
      // Only an untouched post folds: no status flip, no FedEx label. One
      // anybody acted on (its own label, received, tested…) is its own trade
      // — the seller may really be selling two of the same phone.
      if (statusOf(l) !== "quote_requested" || l.hasLabel) continue;
      let done: DupeLead | undefined; // a trade that finished after this post came in
      let best: DupeLead | undefined; // the most-advanced open post
      for (const o of group) {
        if (o === l || Math.abs(at(o.ts) - at(l.ts)) > windowMs) continue;
        const os = statusOf(o);
        if (os === "rejected") continue;
        if (DONE.has(os)) {
          // Finished BEFORE this post came in → the seller is selling another unit.
          if (at(o.statusTs) >= at(l.ts) && (!done || at(o.statusTs) > at(done.statusTs))) done = o;
        } else if (ahead(o, l) > 0 && (!best || ahead(o, best) > 0)) {
          best = o;
        }
      }
      const into = done || best;
      if (into) out.set(l.id, into.id);
    }
  }
  return out;
}

type CommsMsg = { id?: string; body?: string; timestamp: string };

const lineField = (body: string, key: string) =>
  body.match(new RegExp(`(?:^|\\n)${key}:[ \\t]*([^\\n]*)`, "i"))?.[1]?.trim() || "";

/** findDuplicates over raw MC comms — for the crons that read the marker
 *  stream directly instead of going through the admin leads route. */
export function duplicatesFromComms(messages: CommsMsg[], windowMs = DUPE_WINDOW_MS): Map<string, string> {
  const posts = new Map<string, { ts: string; body: string }>();
  const status = new Map<string, { s: string; ts: string }>();
  const labeled = new Set<string>();
  const deletedAt = new Map<string, string>();
  const restoredAt = new Map<string, string>();
  const keepLatest = (map: Map<string, string>, id: string, ts: string) => {
    if (ts > (map.get(id) || "")) map.set(id, ts);
  };
  for (const m of messages) {
    const body = m.body;
    if (!body || !m.id) continue;
    if (/\[NEW BUYBACK LEAD(\b| — \d+ DEVICES\])/i.test(body)) posts.set(m.id, { ts: m.timestamp, body });
    // Staff/system markers are their own posts; one inside a customer's post
    // is forged (see isCustomerLeadPost).
    if (isCustomerLeadPost(body)) continue;
    const sm = body.match(/\[STATUS:\s*(\w+)\]\s*\[LEAD:\s*([\w-]+)\]/i);
    if (sm && m.timestamp > (status.get(sm[2])?.ts || "")) status.set(sm[2], { s: sm[1].toLowerCase(), ts: m.timestamp });
    const lb = body.match(/\[LABEL:\s*([\w-]+)\]/i);
    if (lb) labeled.add(lb[1]);
    const del = body.match(/\[DELETED-LEAD:\s*([\w-]+)\]/i);
    if (del) keepLatest(deletedAt, del[1], m.timestamp);
    const res = body.match(/\[RESTORED-LEAD:\s*([\w-]+)\]/i);
    if (res) keepLatest(restoredAt, res[1], m.timestamp);
  }
  const leads: DupeLead[] = [];
  for (const [id, p] of posts) {
    const del = deletedAt.get(id);
    if (del && (restoredAt.get(id) || "") <= del) continue; // in the trash
    leads.push({
      id,
      ts: p.ts,
      phone: lineField(p.body, "Phone"),
      email: lineField(p.body, "Email"),
      device: lineField(p.body, "Device"),
      status: status.get(id)?.s,
      statusTs: status.get(id)?.ts,
      hasLabel: labeled.has(id),
      multi: /\[NEW BUYBACK LEAD — \d+ DEVICES\]/i.test(p.body),
    });
  }
  return findDuplicates(leads, windowMs);
}
