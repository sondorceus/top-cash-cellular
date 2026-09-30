// One box, one label, several devices — for a /go seller who locks another
// device after the first one already has a FedEx label.
//
// INCIDENT 2026-09-28 (go-fb1-a91elato): one label already covered a 16 Pro
// Max + 17 Pro Max, yet the bot promised "the new label first thing in the
// morning" and staff were told to issue a second one. And a device locked
// AFTER a label existed always minted a second label on every path (chip,
// typed "ship", SMS SHIP). The owner's default now: the new phone goes in the
// SAME box on the SAME label. FedEx tracking is blind to us (Track API 403),
// so the page asks the seller whether the first box already shipped.
//
// Notes (server-written only; chat-sync refuses a client-forged one):
//   BOX: tracking=<T> url=<U> count=<N> leads=<id1>,<id2> lbs=<L> devices=<d1> + <d2>
//     — written by /api/go/label after every mint and after every join, with
//       the full current device list for that tracking. lbs (2026-09-30) is
//       the weight FedEx rated the label at; a join never takes the box past
//       what that weight carries.
//   BOX-CLOSED: tracking=<T> — <reason>
//     — a new label was minted while the box was open ("my box already
//       shipped"): that box is never offered for joining again.
//   BOX-ASK: SHIP replied by text — box <T>
//     — sms-inbound (2026-09-30, review): an SMS SHIP for a box older than a
//       day got the box question — once per lock. The label route and a join
//       then look for an /admin label the owner may have made for that lock.
//   A join writes, per added lock, LABEL: tracking=T url=U lead=<id> joined=1
//   box=<N> — added to existing box (so every "newest lock is labeled" check
//   treats it as labeled) plus HANDOFF-CHOICE: ship (added to existing box T).
import { put, head } from "@vercel/blob";
import { appendChatMsg, readChat } from "./gochat-store";
import { aggregateWeight, deviceKindFromString } from "./fedex";
import { sidToken } from "./go-sid-token";
import { sendSellerSms, looksLikePhone, notesHaveOptOut } from "./seller-sms";
import { notifyOwnerSms } from "./owner-sms";
import { mailShell, MAIL, esc } from "./email-shell";
import { findFreshLabel } from "./fedex-retry";
import { fetchCommsRead } from "./mc-comms";
import { isDeleted, latestStatus } from "./lead-devices";
import { rateLimit } from "./rate-limit";

type Note = { ts: number; text: string };

export type BoxInfo = { tracking: string; url: string; devices: string[]; count: number; heaviest: string; leadIds: string[]; ts: number; lbs: number };

// Same ranking the label route sizes a multi-device package by.
const KIND_RANK: Record<string, number> = { desktop: 5, console: 4, laptop: 3, tablet: 2, phone: 1 };
const rank = (device: string) => KIND_RANK[deviceKindFromString(device) || ""] || 0;

// The weight createReturnLabel rates a label at when none is passed — every
// single-device /go label. A copy of fedex.ts defaultWeight (not exported).
const UNIT_LBS: Record<string, number> = { phone: 2, tablet: 2, laptop: 6, console: 12, desktop: 35 };
const unitLbs = (device: string) => UNIT_LBS[deviceKindFromString(device) || ""] ?? 3;

/** The weight a /go label is rated at for these devices: one → the per-kind
 *  default; several → aggregateWeight, which the label route passes. */
export function labelLbs(devices: string[]): number {
  if (devices.length <= 1) return unitLbs(devices[0] || "");
  return aggregateWeight(devices.map((d) => ({ deviceKind: deviceKindFromString(d) })));
}

// Only phones join, and only a phone box (2026-09-30, review): FedEx rated
// the label at its weight (2 lb for one phone) and bills the scanned weight
// ($5-15 corrections), and a laptop or console box was sized for what's in
// it — two PS5s on a one-PS5 label don't fit. A packed phone is ~0.5 lb and
// the box ~0.5 lb, so a label rated L lb carries (L - 0.5) / 0.5 phones (3 on
// the single-phone 2 lb label), never more than the owner's "roughly 15
// phones fit a medium box".
export const PHONE_BOX_MAX = 15;
const PHONE_PACKED_LBS = 0.5;
const BOX_PACK_LBS = 0.5;

/** How many more phones the box's label carries — 0 for a tablet, laptop or
 *  console box. The page's "more phones?" line and the join both read it. */
export function boxRoom(box: { count: number; heaviest: string; lbs: number }): number {
  if (rank(box.heaviest) > 1) return 0;
  const fits = Math.min(PHONE_BOX_MAX, Math.floor((box.lbs - BOX_PACK_LBS) / PHONE_PACKED_LBS));
  return Math.max(0, fits - box.count);
}

// What settles a lock's handoff and closes the window of locks waiting for a
// box: a label, a MEET pick, or a pick that sent the label to the team — an
// SMS SHIP reply ("generate the label from /admin") or a FedEx outage (the
// owner is alerted to mint it). Only the page's own "address entered on /go"
// pick and a bad-address failure stay open: those are the page retrying the
// same box (2026-09-30, review: a lock sent to staff stayed "pending" and
// rode in every later box, and its [LABEL:] marker was overwritten). One of
// those finished elsewhere (2026-09-30, review): an /admin label now writes
// a LABEL note here (admin/leads/label), and settledOffThread drops one sold
// at a meetup by text, cancelled, or labeled before that.
export const WINDOW_CLOSE_RE = /^(LABEL: |LABEL-FAILED: SERVICE_UNAVAILABLE|HANDOFF-CHOICE: (local meetup|ship \(free label\) — replied by text))/;

/** Where the locks waiting with the lock stamped `lockTs` begin: the newest
 *  window-closing note strictly BEFORE it. One stamped after it is that
 *  lock's own handoff (a retry after an outage, the link an SMS SHIP sent)
 *  and keeps its box whole. */
export function windowStart(notes: Note[], lockTs: number): number {
  return notes.reduce((t, n) => (n.ts < lockTs && WINDOW_CLOSE_RE.test(n.text) && n.ts > t ? n.ts : t), 0);
}

// A box nothing has touched in this long is not offered again: we never
// learn that a box was dropped off or checked in, so the price lock's own 14
// days bound "is it still on your table?" (2026-09-30, review).
const BOX_STALE_MS = 14 * 24 * 3600_000;

// The newest lock's handoff was already settled another way (2026-09-30,
// review): an SMS SHIP whose label went to the team. Not a meetup
// (2026-09-30, review): refusing it blocked only a seller who explicitly
// asked to ship it in their box after all — the chat opened the address
// form, bought a second label and closed a box with room. Unprompted asks
// are kept off a meetup elsewhere (chat-sync `!chose`, sms-inbound
// already-chosen, the chat's meetChosen).
const CHOSEN_RE = /^HANDOFF-CHOICE: ship \(free label\) — replied by text/;

const sorted = (notes: Note[]) => [...notes].sort((a, b) => a.ts - b.ts);

/** Device part of a LOCKED note: "LOCKED: iPhone 17 Pro 256 good unlocked $560 — 512…" → "iPhone 17 Pro 256 good unlocked". */
export function lockDevice(lockedText: string): string {
  const b = lockedText.slice("LOCKED:".length).split(" — ")[0].trim();
  return b.replace(/\s*\$\d+.*$/, "").replace(/\s*\(manual\)\s*$/, "").trim() || "device";
}

/** Model-only name for seller copy: "iPhone 16 Pro Max 1tb good unlocked" →
 *  "iPhone 16 Pro Max" (cut at the storage or condition word). */
export function shortDevice(device: string): string {
  const words = device.trim().split(/\s+/);
  const i = words.findIndex((w, k) => k > 0 && /^(\d+(gb|tb)|64|128|256|512|sealed|mint|good|fair|broken|won['’]t)$/i.test(w));
  return (i > 0 ? words.slice(0, i) : words).join(" ") || device;
}

/** The seller's own chat link (the same signed link the SMS acks carry). */
export function sellerChatLink(sid: string): string {
  return `https://topcashcellular.com/go?sid=${sid}&k=${sidToken(sid)}`;
}

function heaviestOf(devices: string[]): string {
  return devices.reduce((h, d) => (rank(d) > rank(h) ? d : h), devices[0] || "");
}

function labelParts(text: string): { tracking: string; url: string } | null {
  const m = text.match(/^LABEL: tracking=(\S+) url=(\S+)/);
  return m ? { tracking: m[1], url: m[2] } : null;
}

function parseBoxNote(n: Note): BoxInfo | null {
  const m = n.text.match(/^BOX: tracking=(\S+) url=(\S+) count=(\d+) leads=(\S*)(?: lbs=(\d+(?:\.\d+)?))? devices=(.*)$/);
  if (!m) return null;
  const devices = m[6].split(" + ").map((d) => d.trim()).filter(Boolean);
  const heaviest = heaviestOf(devices);
  return {
    tracking: m[1], url: m[2], devices, count: Number(m[3]) || devices.length,
    // No lbs= → the lightest rating a label for these could have had.
    heaviest, leadIds: m[4].split(",").map((x) => x.trim()).filter(Boolean), ts: n.ts, lbs: Number(m[5]) || unitLbs(heaviest),
  };
}

// Sessions labeled before BOX notes existed: the label covered the newest
// `box=N` locks of its window (no box= → the one newest lock — the old route
// wrote box= whenever it boxed several), the window being the locks after
// the handoff settled before the label's lock and at/before this label. The
// old route rated every label at its heaviest kind's default weight.
function legacyBox(notes: Note[], label: Note): BoxInfo | null {
  const lp = labelParts(label.text);
  if (!lp) return null;
  const lock = [...notes].reverse().find((n) => n.text.startsWith("LOCKED:") && n.ts <= label.ts);
  const start = lock ? windowStart(notes, lock.ts) : 0;
  const locks = notes.filter((n) => n.text.startsWith("LOCKED:") && n.ts > start && n.ts <= label.ts);
  const boxN = Number(label.text.match(/ box=(\d+)/)?.[1]) || 0;
  const inBox = locks.slice(-(boxN || 1));
  const devices = inBox.map((l) => lockDevice(l.text));
  const primary = label.text.match(/ lead=([\w-]+)/)?.[1];
  const firstTs = inBox[0]?.ts ?? label.ts;
  const others = notes.filter((n) => n.text.startsWith("LEAD-ID: ") && n.ts >= firstTs && n.ts <= label.ts).map((n) => n.text.slice("LEAD-ID: ".length).trim());
  const leadIds = [...new Set([primary, ...others].filter((x): x is string => !!x))];
  const heaviest = heaviestOf(devices);
  return { tracking: lp.tracking, url: lp.url, devices, count: boxN || Math.max(1, devices.length), heaviest, leadIds, ts: label.ts, lbs: unitLbs(heaviest) };
}

/** A BOX-CLOSED note names this tracking. */
export function isBoxClosed(notes: Note[], tracking: string): boolean {
  return !!tracking && notes.some((n) => n.text.startsWith("BOX-CLOSED: ") && n.text.match(/^BOX-CLOSED: tracking=(\S+)/)?.[1] === tracking);
}
const closed = isBoxClosed;

/** The box a tracking number covers, open or closed (newest BOX note for it,
 *  else the legacy reading of its minting LABEL note). */
export function boxFor(notes: Note[], tracking: string): BoxInfo | null {
  const s = sorted(notes);
  const boxNote = [...s].reverse().find((n) => n.text.startsWith("BOX: ") && parseBoxNote(n)?.tracking === tracking);
  if (boxNote) return parseBoxNote(boxNote);
  const mint = [...s].reverse().find((n) => n.text.startsWith("LABEL: ") && !/ joined=1\b/.test(n.text) && labelParts(n.text)?.tracking === tracking);
  return mint ? legacyBox(s, mint) : null;
}

/** The box a new lock may still join: the newest BOX note's (legacy: the
 *  newest minted LABEL's), unless a BOX-CLOSED note names its tracking or it
 *  has sat untouched past BOX_STALE_MS. */
export function openBox(notes: Note[]): BoxInfo | null {
  const s = sorted(notes);
  const boxNote = [...s].reverse().find((n) => n.text.startsWith("BOX: "));
  const mint = [...s].reverse().find((n) => n.text.startsWith("LABEL: ") && !/ joined=1\b/.test(n.text));
  const mintTracking = mint ? labelParts(mint.text)?.tracking : undefined;
  let box: BoxInfo | null = boxNote ? parseBoxNote(boxNote) : null;
  // A mint newer than the newest BOX note whose own BOX note never landed
  // (the store swallows a failed put) — read that label the legacy way.
  if (mint && mintTracking && (!box || (mint.ts > box.ts && mintTracking !== box.tracking))) box = legacyBox(s, mint);
  if (!box || closed(s, box.tracking) || Date.now() - box.ts > BOX_STALE_MS) return null;
  return box;
}

/** The room a label card may advertise: boxRoom, but 0 for a box that is
 *  closed or stale (openBox's rules). 2026-09-30 (review): cards and the
 *  bot read room off the raw boxFor, so a box the seller said already
 *  shipped — or one past BOX_STALE_MS that no join will take — still said
 *  "more phones? they can go in this same box". */
export function openRoom(notes: Note[], box: BoxInfo): number {
  if (closed(notes, box.tracking) || Date.now() - box.ts > BOX_STALE_MS) return 0;
  return boxRoom(box);
}

function newestLock(notes: Note[]): Note | null {
  return [...sorted(notes)].reverse().find((n) => n.text.startsWith("LOCKED:")) || null;
}

/** Newest LOCKED has a LABEL note at/after it (the label route's rule). */
export function newestLockLabeled(notes: Note[]): boolean {
  const lock = newestLock(notes);
  return !!lock && notes.some((n) => n.ts >= lock.ts && n.text.startsWith("LABEL: "));
}

// A ship attempt on the page that didn't print: a failed print, or a pick
// that never got past "address entered" (see settledOffThread).
const ATTEMPT_RE = /^(LABEL-FAILED: |HANDOFF-CHOICE: ship \(free label\) — address entered on \/go)/;

type PendingLock = { device: string; leadId: string | null; ts: number; attempted: boolean };

// The unlabeled locks waiting for a box: every lock in the newest lock's
// window, and always the newest lock (same assembly as the label route's
// mint, so "16 Pro Max, then + another, then ship" joins both, not just the
// last one). `skip`: lock stamps settledOffThread found finished elsewhere
// (never the newest). `attempted`: an earlier lock whose own span holds a
// ship attempt and no LABEL note.
function pendingLocks(notes: Note[], skip?: Set<number>): PendingLock[] {
  const s = sorted(notes);
  const newest = newestLock(s);
  if (!newest) return [];
  const start = windowStart(s, newest.ts);
  const locks = s.filter((n) => n.text.startsWith("LOCKED:") && (n.ts > start || n === newest) && (n === newest || !skip?.has(n.ts)));
  return locks.map((l, i) => {
    const until = i + 1 < locks.length ? locks[i + 1].ts : Infinity;
    const span = s.filter((n) => n.ts >= l.ts && n.ts < until);
    const lead = [...span].reverse().find((n) => n.text.startsWith("LEAD-ID: "));
    const attempted = l !== newest && span.some((n) => ATTEMPT_RE.test(n.text)) && !span.some((n) => n.text.startsWith("LABEL: "));
    return { device: lockDevice(l.text), leadId: lead ? lead.text.slice("LEAD-ID: ".length).trim() || null : null, ts: l.ts, attempted };
  });
}

export type JoinRefusal = "no_lock" | "labeled" | "chosen" | "no_box" | "heavier" | "full";
export type JoinCheck =
  | { ok: true; box: BoxInfo; device: string; leadId: string | null; adds: { device: string; leadId: string | null }[] }
  // room / waiting (2026-09-30, review): "full" copy counts what's waiting
  // against what the label still carries.
  | { ok: false; reason: JoinRefusal; device?: string; room?: number; waiting?: number };

/** Can the newest lock go in the open box? `device` / `leadId` are the newest
 *  lock's (`device` joins every pending lock with " + " when several are
 *  waiting); `adds` lists each pending lock. A refusal names the device it is
 *  about when that isn't simply the newest lock. `skip`: waiting locks
 *  settled off this thread (settledOffThread) — they don't ride along. */
export function joinable(notes: Note[], skip?: Set<number>): JoinCheck {
  const lock = newestLock(notes);
  if (!lock) return { ok: false, reason: "no_lock" };
  if (newestLockLabeled(notes)) return { ok: false, reason: "labeled" };
  if (notes.some((n) => n.ts >= lock.ts && CHOSEN_RE.test(n.text))) return { ok: false, reason: "chosen", device: lockDevice(lock.text) };
  const box = openBox(notes);
  if (!box) return { ok: false, reason: "no_box" };
  const adds = pendingLocks(notes, skip).map(({ device, leadId }) => ({ device, leadId }));
  // The device that can't ride along, by name: a laptop left on "not sure
  // yet" blocked the newest phone, and the hint called the phone too big.
  const big = adds.find((a) => rank(a.device) > 1);
  if (big) return { ok: false, reason: "heavier", device: big.device, waiting: adds.length };
  const room = boxRoom(box);
  if (adds.length > room) return { ok: false, reason: "full", room, waiting: adds.length };
  return { ok: true, box, device: adds.map((a) => a.device).join(" + "), leadId: adds[adds.length - 1]?.leadId ?? null, adds };
}

const say = (list: string[]) => {
  const s = list.map(shortDevice);
  return s.length <= 1 ? s.join("") : `${s.slice(0, -1).join(", ")} and ${s[s.length - 1]}`;
};

/** The seller's "added" text. `device` is joinOpenBox's (several pending
 *  locks are joined with " + "); `devices` the box's full list after the join.
 *  `chatLink` (2026-09-30, review): a join can't know whether that box
 *  already went out — the seller's way to a new label if it did. */
export function joinSellerText(device: string, devices: string[], url: string, chatLink?: string): string {
  const added = device.split(" + ");
  const others = devices.slice(0, Math.max(0, devices.length - added.length));
  const out = chatLink ? ` Box already dropped off? Open your chat for a new label: ${chatLink}` : "";
  const tail = " Drop it at any FedEx location; we'll text you when it's checked in.";
  const stop = " Reply STOP to opt out.";
  const full = `Top Cash Cellular: added — put the ${say(added)} in the same box with your ${others.length ? say(others) : "first device"}, same label: ${url}.${tail}`;
  const n = others.length || 1;
  const brief = `Top Cash Cellular: added — ${added.length > 1 ? `these ${added.length} go` : "it goes"} in the same box as your other ${n} device${n === 1 ? "" : "s"}, same label: ${url}.${tail}`;
  // The relay cuts at 480 chars — never at the STOP line.
  for (const t of [full + out, brief + out, brief]) if ((t + stop).length <= 480) return t + stop;
  return brief + stop;
}

const HINT: Record<JoinRefusal, (d: string, x?: { room?: number; waiting?: number }) => string> = {
  no_lock: () => "lock in your quote first, then we add it to your box",
  labeled: () => "this device already has its label",
  chosen: (d) => `the ${shortDevice(d)} already has its next step set — we'll text you about it`,
  no_box: () => "there's no open box to add it to — tap ship for a new label",
  heavier: (d) => `the ${shortDevice(d)} needs its own label — only phones can be added to a box that already has one`,
  // Count-aware (2026-09-30, review): a label with room for some of the
  // waiting phones read as "no room for another device", and every waiting
  // lock goes on the new label, not just "this one".
  full: (_d, x) => {
    const n = x?.waiting ?? 1, room = x?.room ?? 0;
    if (room > 0) return `that label only has room for ${room} more and ${n} are waiting — all ${n} go in one new box on one new label`;
    return n > 1 ? `that label has no room for another device — all ${n} go in one new box on one new label` : "that label has no room for another device — this one needs its own label";
  },
};

const MC_API = "https://missioncontrolsdjg-production.up.railway.app";
const MC_KEY = process.env.MC_API_KEY || "";
const RESEND_KEY = process.env.RESEND_API_KEY;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Same MC post the label route makes, bounded the same way.
async function mcPost(body: string, tags: string[], priority: "low" | "normal" | "urgent"): Promise<boolean> {
  if (!MC_KEY) return false;
  try {
    const r = await fetch(`${MC_API}/api/comms`, {
      method: "POST",
      headers: { "x-api-key": MC_KEY, "Content-Type": "application/json" },
      signal: AbortSignal.timeout(10_000),
      body: JSON.stringify({ from: "topcash-web", fromName: "Top Cash Cellular", role: "system", body, tags, priority }),
    });
    return r.ok;
  } catch {
    return false;
  }
}

// Mission Control looks below are bounded like the label route's /admin-
// label look: 20 s, then the thread's own reading stands, as before.
const SCAN_MS = 20_000;
const scanAllowed = (sid: string) => rateLimit(`goboxscan:${sid}`, 10, 60 * 60_000).ok;

/** Waiting locks (never the newest) that were finished OFF this thread.
 *  2026-09-30 (review): a lock whose page print failed on the address stays
 *  in the window (the page retries the same box), but staff may have fixed
 *  the address and minted in /admin (before /admin wrote a LABEL note here),
 *  or it was sold at a meetup arranged by text, or cancelled. The next
 *  label then "covered" it: its [LABEL:] marker was overwritten and
 *  fedex-poll tracked the wrong box. Only a lock with a ship attempt in its
 *  own span and no LABEL note is looked up — a fresh [LABEL:] marker, a
 *  status past quote_requested or a deleted lead drops it. */
export async function settledOffThread(sid: string, notes: Note[]): Promise<{ lockTs: Set<number>; leadIds: Set<string> }> {
  const none = { lockTs: new Set<number>(), leadIds: new Set<string>() };
  const suspects = pendingLocks(notes).filter((l): l is PendingLock & { leadId: string } => l.attempted && !!l.leadId);
  if (!suspects.length || !MC_KEY || !scanAllowed(sid)) return none;
  const scan = (async () => {
    const [read, fresh] = await Promise.all([
      fetchCommsRead({ apiKey: MC_KEY, pageSize: 5000, maxPages: 6, includeArchive: true, memoMs: 3_000 }).catch(() => null),
      Promise.all(suspects.map((l) => findFreshLabel(l.leadId).catch(() => null))),
    ]);
    const msgs = read?.messages || [];
    const out = { lockTs: new Set<number>(), leadIds: new Set<string>() };
    suspects.forEach((l, i) => {
      const past = msgs.length > 0 && (isDeleted(msgs, l.leadId) || latestStatus(msgs, l.leadId) !== "quote_requested");
      if (fresh[i] || past) { out.lockTs.add(l.ts); out.leadIds.add(l.leadId); }
    });
    return out;
  })();
  return Promise.race([scan, new Promise<typeof none>((r) => setTimeout(() => r(none), SCAN_MS))]);
}

export type JoinResult =
  | { ok: true; tracking: string; url: string; devices: string[]; count: number; room: number; device: string; already: boolean }
  | { ok: false; reason: string; hint: string };

// A double tap on one instance shares one join instead of writing the notes
// and texting the seller twice. Keyed per channel (2026-09-30, review): a
// page tap that shared an SMS join's promise texted the seller again; across
// channels and instances the claim blob below decides.
const inflight = new Map<string, Promise<JoinResult>>();

/** Put the newest lock (and any other lock waiting for a box) in the open
 *  box: no new label, no FedEx charge. Idempotent per lock. `via` "sms" means
 *  the caller (sms-inbound) texts the seller its own reply in-thread, so no
 *  seller SMS goes out from here (e-mail still does). */
export async function joinOpenBox(sid: string, via: "page" | "sms"): Promise<JoinResult> {
  const key = `${sid}:${via}`;
  const running = inflight.get(key);
  if (running) return running;
  const p = doJoin(sid, via).finally(() => inflight.delete(key));
  inflight.set(key, p);
  return p;
}

// Cross-instance claim (2026-09-30, review): the map above only dedupes on
// one instance — a SHIP text and a tap landing on two instances both joined,
// doubling every note, marker, comm, alert and text. One blob per lock, never
// overwritten: Blob refuses an existing pathname, and that refusal is the
// lock. A claim older than a minute whose join never wrote its notes (the
// instance died) doesn't block the retry; a store we can't read doesn't
// either — a double join costs a duplicate text, a lost one a seller told
// "added" with nothing recorded.
const CLAIM_STALE_MS = 60_000;
async function claimJoin(sid: string, lockTs: number): Promise<boolean> {
  const pathname = `gochat-join/${sid}/${lockTs}.json`;
  const writeId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  try {
    await put(pathname, JSON.stringify({ writeId, at: Date.now() }), {
      access: "public", contentType: "application/json", addRandomSuffix: false, abortSignal: AbortSignal.timeout(8_000),
    });
    return true;
  } catch {
    // Refused (a rival's claim, or our own put the SDK retried) or failed.
    try {
      const h = await head(pathname, { abortSignal: AbortSignal.timeout(8_000) });
      const doc = await fetch(h.url, { cache: "no-store", signal: AbortSignal.timeout(6_000) }).then((r) => r.json()).catch(() => null);
      if (!doc) return true;
      return doc.writeId === writeId || (typeof doc.at === "number" && Date.now() - doc.at > CLAIM_STALE_MS);
    } catch {
      return true; // not there (the put failed outright) or unreadable: go ahead
    }
  }
}

async function doJoin(sid: string, via: "page" | "sms"): Promise<JoinResult> {
  const state = await readChat(sid, 0);
  const notes: Note[] = state.msgs.filter((m) => m.role === "note").map((m) => ({ ts: m.ts, text: m.text }));
  const lock = newestLock(notes);
  // Already in a box by a join → hand that box back, post nothing. The
  // lock's NEWEST label decides (2026-09-30, review): after "my box already
  // shipped" printed its own label, a stale "put it in my box" tap got the
  // shipped box back as "already in your box". A mint → "labeled" (the page
  // fetches the real label); a join whose box the seller said already
  // shipped (BOX-CLOSED, its new print failed) → "no_box" (the page opens
  // the form, and the label route prints the new label).
  const last = lock ? [...sorted(notes)].reverse().find((n) => n.ts >= lock.ts && n.text.startsWith("LABEL: ")) : undefined;
  if (lock && last) {
    const lp = labelParts(last.text);
    if (!/ joined=1\b/.test(last.text)) return { ok: false, reason: "labeled", hint: HINT.labeled("") };
    if (lp && closed(notes, lp.tracking)) return { ok: false, reason: "no_box", hint: HINT.no_box("") };
    const doneBox = lp ? boxFor(notes, lp.tracking) : null;
    if (doneBox) {
      return { ok: true, tracking: doneBox.tracking, url: doneBox.url, devices: doneBox.devices, count: doneBox.count, room: openRoom(notes, doneBox), device: lockDevice(lock.text), already: true };
    }
  }
  let check = joinable(notes);
  // Waiting locks finished off this thread don't ride along (2026-09-30,
  // review) — and may be what made the box too heavy or too full.
  if (check.ok || check.reason === "heavier" || check.reason === "full") {
    const settled = await settledOffThread(sid, notes);
    if (settled.lockTs.size) check = joinable(notes, settled.lockTs);
  }
  if (!check.ok) return { ok: false, reason: check.reason, hint: HINT[check.reason](check.device || (lock ? lockDevice(lock.text) : "device"), check) };
  const j = check;
  // An SMS SHIP for this lock went to the owner as the box question
  // (BOX-ASK, 2026-09-30, review): he may have answered it with an /admin
  // label, which is only an MC [LABEL:] marker when that lead's body had no
  // Session: line. A join would post a newer marker over it and orphan it:
  // refuse "labeled" — the page's no-address POST then has the label route
  // adopt it. Bounded; a slow read joins, as before.
  if (lock && j.leadId && notes.some((n) => n.ts >= lock.ts && n.text.startsWith("BOX-ASK: ")) && MC_KEY && scanAllowed(sid)) {
    const staff = await Promise.race([findFreshLabel(j.leadId).catch(() => null), new Promise<null>((r) => setTimeout(() => r(null), SCAN_MS))]);
    if (staff && !notes.some((n) => n.text.includes(`tracking=${staff.tracking} `))) return { ok: false, reason: "labeled", hint: HINT.labeled("") };
  }

  const { box } = j;
  const T = box.tracking, U = box.url;
  const devices = [...box.devices, ...j.adds.map((a) => a.device)];
  const count = box.count + j.adds.length;
  const room = boxRoom({ count, heaviest: box.heaviest, lbs: box.lbs });
  // Another channel or instance is joining this lock right now: its notes
  // are this result — hand it back without posting anything.
  if (lock && !(await claimJoin(sid, lock.ts))) {
    return { ok: true, tracking: T, url: U, devices, count, room, device: j.device, already: true };
  }
  const leadIds = [...new Set([...box.leadIds, ...j.adds.map((a) => a.leadId).filter((x): x is string => !!x)])];
  const viaWords = via === "sms" ? "replied by text" : "chosen on /go";
  // Awaited, BOX last (ts + 1) so it is the newest BOX note for this tracking.
  const ts = Date.now();
  await Promise.all([
    ...j.adds.map((a) => appendChatMsg(sid, "note", `LABEL: tracking=${T} url=${U}${a.leadId ? ` lead=${a.leadId}` : ""} joined=1 box=${count} — added to existing box`, ts)),
    appendChatMsg(sid, "note", `HANDOFF-CHOICE: ship (added to existing box ${T}) — ${viaWords}`, ts),
    appendChatMsg(sid, "note", `BOX: tracking=${T} url=${U} count=${count} leads=${leadIds.join(",")} lbs=${box.lbs} devices=${devices.join(" + ")}`, ts + 1),
  ]);

  // Everything below is best-effort: the notes above are the join.
  const allNotes = notes.map((n) => n.text);
  const contact = [...allNotes].reverse().find((t) => t.startsWith("CONTACT: "))?.slice("CONTACT: ".length).trim() || "";
  const phone = looksLikePhone(contact) ? contact.replace(/\D/g, "").replace(/^1(\d{10})$/, "$1") : "";
  const isEmail = EMAIL_RE.test(contact);
  // The name FedEx printed on this box's label ("LABEL: … — Name, City ST
  // zip") — only from a note in that mint shape (2026-09-30, review): a
  // label the team made in /admin reads "— minted by the team in /admin",
  // which the urgent comm showed as "Name: minted by the team in /admin".
  // Else the name on any page print or failed print in this thread.
  const tailName = (t: string) => t.match(/ — (.+), [^,]+ [A-Z]{2} \d{5}(?:-\d{4})?$/)?.[1].trim() || "";
  const mintNote = [...allNotes].reverse().find((t) => t.startsWith("LABEL: ") && !/ joined=1\b/.test(t) && labelParts(t)?.tracking === T);
  const name = (mintNote && tailName(mintNote))
    || [...allNotes].reverse().map((t) => (/^LABEL(-FAILED)?: /.test(t) ? tailName(t) : "")).find(Boolean)
    || "/go seller";
  const firstLead = box.leadIds[0] || "go";
  const link = `https://topcashcellular.com/admin/chats?session=${sid}`;

  const mc = (async () => {
    // tracking= right after the marker (account/me parses it there); no
    // cost= — the label was paid once, on the box's first lead.
    for (const a of j.adds) {
      if (!a.leadId) continue;
      if (!(await mcPost(`[LABEL: ${a.leadId}] tracking=${T} url=${U} service=FedEx source=go box=${firstLead} joined=1`, ["fedex-label", "auto-generated"], "low"))) {
        console.error(`[go/box] [LABEL:] marker failed for ${a.leadId} (${sid})`);
      }
    }
    const ok = await mcPost([
      "[DELIVERY OPTION] SHIPPING", `Name: ${name}`, phone.length === 10 ? `Phone: ${phone}` : null, isEmail ? `Email: ${contact}` : null,
      `Device: ${devices.join(" + ")}`,
      `Box: ${j.device} ADDED to existing label ${T} — now ${count} devices on one label (no new label minted)`,
      `Shipping Address: same as label ${T}`,
      `Session: ${sid}`, `Chat: ${link}`,
    ].filter(Boolean).join("\n"), ["lead", "delivery", "shipping", `sess-${sid}`], "urgent");
    if (!ok) console.error(`[go/box] delivery comm failed (${sid})`);
  })();

  const alert = notifyOwnerSms(`📦 GO seller adding ${j.device} to their existing box ${T} (now ${count} devices, one label) — no new label\n${link}`, { leadId: j.leadId || undefined })
    .then((ok) => { if (!ok) console.error(`[go/box] owner alert failed (${sid})`); })
    .catch((e) => console.error(`[go/box] owner alert threw (${sid})`, e));

  // Same delivery rules as the label route: no text to an opted-out thread;
  // e-mail to an e-mail contact or the EMAIL-FALLBACK a phone seller left.
  const seller = (async () => {
    let texted = false, emailed = false;
    if (via === "page" && !notesHaveOptOut(allNotes) && phone.length === 10) {
      texted = await sendSellerSms(phone, joinSellerText(j.device, devices, U, sellerChatLink(sid))).catch(() => false);
    }
    const fallbackEmail = [...allNotes].reverse().find((t) => t.startsWith("EMAIL-FALLBACK: "))?.slice("EMAIL-FALLBACK: ".length).trim() || "";
    const emailTo = isEmail ? contact : EMAIL_RE.test(fallbackEmail) ? fallbackEmail : "";
    if (emailTo && RESEND_KEY) {
      try {
        const added = j.adds.map((a) => a.device);
        const others = box.devices;
        const chat = sellerChatLink(sid);
        const { Resend } = await import("resend");
        const r = await new Resend(RESEND_KEY).emails.send({
          from: "Top Cash Cellular <noreply@topcashcellular.com>", replyTo: "support@topcashcellular.com", to: emailTo,
          subject: `Added to your box: the ${say(added)}`,
          html: mailShell({
            preheader: `Same label — tracking ${T}`, eyebrow: "Same box, same label", title: "Added to your box",
            introHtml: `<span style="color:${MAIL.body}">Put the ${esc(say(added))} in the same box with your ${esc(others.length ? say(others) : "first device")} — wrap each one — and use the same label. No new label needed. Drop it at any FedEx location; we'll text you when it's checked in at our warehouse. Tracking <strong style="color:${MAIL.ink}">${esc(T)}</strong>. Box already dropped off? <a href="${esc(chat)}" style="color:${MAIL.ink}">Open your chat</a> for a new label.</span>`,
            buttonHref: U, buttonLabel: "Open my label",
          }),
          text: `Put the ${say(added)} in the same box with your ${others.length ? say(others) : "first device"}, same label: ${U}\nTracking ${T}. Drop it at any FedEx location; we'll text you when it's checked in at our warehouse.\nBox already dropped off? Open your chat for a new label: ${chat}`,
        });
        emailed = !r.error;
      } catch (e) { console.error(`[go/box] seller e-mail failed (${sid})`, e); }
    }
    if (via === "page") await appendChatMsg(sid, "note", texted || emailed ? "SMS/email sent (box join)" : "box join delivery FAILED (page card only)");
    else if (emailed) await appendChatMsg(sid, "note", "SMS/email sent (box join e-mail)");
  })().catch((e) => console.error(`[go/box] seller message failed (${sid})`, e));

  await Promise.allSettled([mc, alert, seller]);
  return { ok: true, tracking: T, url: U, devices, count, room, device: j.device, already: false };
}
