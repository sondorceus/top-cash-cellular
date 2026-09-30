"use client";

// /go interactive surface: category tiles → full-screen chat. iPhone, Samsung,
// iPad, Console and MacBook all run the deterministic flow (two-stage model
// picker → the model's own chip steps → engine number → one-field lock →
// MEET/SHIP chips); "Something else" and anything typed goes to /api/chat,
// the site-chat brain (quotes singles, lots go to the team). The old in-page
// price board was removed 2026-09-11 — it had been dead code since the
// funnel-first rewrite (72e157a).
//
// Brand rules honored here: dark only, green is a crisp accent (no glow),
// seller language (lock in / get paid, never cart-speak), company voice
// ("we"), and every dollar figure on screen came from the engine — the
// client never invents or caches a price.
import { useEffect, useMemo, useRef, useState } from "react";
import type { BoardRow, GoStep } from "./board";
import { pixelTrack, pixelTrackCustom, fbCookies } from "../components/MetaPixel";

export type GoReviews = {
  avg: number;
  count: number;
  top: { name: string; body: string; device: string; city: string }[];
};

const STORAGE_LABELS: Record<string, string> = {
  "64": "64 gb", "128": "128 gb", "256": "256 gb", "512": "512 gb", "1tb": "1 tb", "2tb": "2 tb", "4tb": "4 tb", "8tb": "8 tb",
};
const CONDITIONS: { key: string; label: string }[] = [
  { key: "sealed", label: "sealed in box" },
  { key: "mint", label: "like new" },
  { key: "good", label: "good" },
  { key: "fair", label: "some wear" },
  { key: "broken", label: "cracked / damaged \u2014 still turns on" },
  // Not an engine tier: the engine's broken tier assumes the device powers
  // on (homepage Broken card: "Device still powers on"). This goes straight
  // to the hand-quote form.
  { key: "parts", label: "won\u2019t turn on / parts" },
];
const CARRIERS: { key: string; label: string }[] = [
  { key: "unlocked", label: "unlocked" },
  { key: "att", label: "at&t" },
  { key: "tmobile", label: "t-mobile" },
  { key: "verizon", label: "verizon" },
  // "other" used to read as the catch-all — a seller who meant "unlocked"
  // tapped it and got $204 on a $433 phone. Name what it actually is, and
  // give the unsure a chip that prices at the AT&T tier (server:
  // app/go/spec.ts) with a note that says exactly which way it can move.
  { key: "other", label: "other carrier (cricket, metro, boost…)" },
  { key: "unknown", label: "not sure" },
];
// Consoles use the homepage's 4-tier ladder (no "like new" chip).
const CONDITIONS4: { key: string; label: string }[] = [
  { key: "sealed", label: "sealed in box" },
  { key: "good", label: "good — works, normal wear" },
  { key: "fair", label: "some wear" },
  { key: "broken", label: "broken / won’t power on" },
];
const CONNECTIVITY: { key: string; label: string }[] = [
  { key: "wifi", label: "wi-fi only" },
  { key: "cellular", label: "wi-fi + cellular" },
];
const DISC_OPTIONS: { key: string; label: string }[] = [
  { key: "disc", label: "has a disc drive" },
  { key: "digital", label: "digital edition" },
];
// MacBook "anything off with it?" — the two flat deductions the homepage
// asks about (battery −$80, missing charger −$50), as one chip.
const MAC_EXTRAS: { key: string; label: string }[] = [
  { key: "ok", label: "battery fine, charger included" },
  { key: "batt", label: "battery warning (below 80%)" },
  { key: "chrg", label: "no charger" },
  { key: "both", label: "battery warning + no charger" },
];
// Picker groups: phones split by brand; iPads, consoles and MacBooks by category.
type Group = "ip" | "gs" | "ipad" | "console" | "macbook";
// The thread as the seller saw it, as turns the chat brain can read: typed
// text as-is, chip/tile taps tagged "(tapped on the page)", and the widgets
// (chip questions, quote card, lock form, locked card) as bot lines — before
// this the model saw taps as unexplained one-word user turns with no
// question in between. Consecutive same-role lines fold into one turn;
// IMG:: photo turns stay separate (the server reads them per turn).
function historyFor(list: Msg[]): { from: "user" | "bot"; text: string }[] {
  const out: { from: "user" | "bot"; text: string }[] = [];
  const push = (from: "user" | "bot", text: string) => {
    if (!text) return;
    const last = out[out.length - 1];
    const img = text.startsWith("IMG::") || (last?.text.startsWith("IMG::") ?? false);
    if (last && last.from === from && !img) last.text = `${last.text}\n${text}`;
    else out.push({ from, text });
  };
  for (const m of list) {
    if (!("kind" in m)) {
      push(m.from === "user" ? "user" : "bot", m.tap ? `(tapped on the page) ${m.text}` : m.text);
      continue;
    }
    switch (m.kind) {
      case "chips": push("bot", m.q); break;
      case "quote": push("bot", `(quote card on the page) your ${m.label} comes out to $${m.offer.toLocaleString("en-US")}${m.note ? ` \u2014 ${m.note}` : ""}`); break;
      case "lockform": push("bot", m.manual ? "(number form on the page \u2014 this one is priced by hand)" : "(lock-it-in number form on the page)"); break;
      case "locked": push("bot", m.offer != null ? `(locked in on the page at $${m.offer.toLocaleString("en-US")})` : "(locked in on the page \u2014 hand quote, no number yet)"); break;
      case "shipform": push("bot", "(shipping address form on the page \u2014 the FedEx label prints when they submit it)"); break;
      // What the label covers (2026-09-30): the brain promised a second
      // label for a phone that was already on the first one.
      case "label": {
        const covers = m.devices?.length ? `, covers ${m.devices.join(" + ")}` : "";
        push("bot", m.joined
          ? `(added to the existing box on the page \u2014 same FedEx label, tracking ${m.tracking}${covers}; no new label)`
          : `(FedEx label issued on the page \u2014 tracking ${m.tracking}${covers}; they were texted the link)`);
        break;
      }
      default: break; // models grid, err, numberform, msgr: local-only
    }
  }
  return out;
}

function rowsFor(rows: BoardRow[], group: Group): BoardRow[] {
  if (group === "ip" || group === "gs") return rows.filter((r) => r.cat === "phone" && r.id.startsWith(group));
  return rows.filter((r) => r.cat === group);
}
// Chip label for a storage/edition key ("" for a console's implicit "base").
function storageLabel(r: BoardRow, key: string): string {
  return r.storageLabels?.[key] ?? STORAGE_LABELS[key] ?? (key === "base" ? "" : key);
}
function quoteLabel(r: BoardRow, key?: string): string {
  const s = key ? storageLabel(r, key) : "";
  return s ? `${r.label} ${s}` : r.label;
}
const CHIPS = ["i got a few phones", "how do i get paid", "how does this work"];
// A device locked after a label exists: same box by default (2026-09-30).
const BOX_CHIPS: { key: string; label: string }[] = [
  { key: "joinbox", label: "put it in my box — same label" },
  { key: "ship", label: "my box already shipped — new label" },
];

// The seller's own avatar — a neutral person glyph on a dark circle, so their
// bubbles read as "you" and the thread looks like a real two-sided chat
// (bot/owner carry the green-ringed logo; this stays neutral, no green glow).
function SellerAvatar() {
  return (
    <span
      aria-hidden
      className="w-[30px] h-[30px] rounded-full bg-white/[0.09] border border-white/15 flex items-center justify-center shrink-0"
    >
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.55)" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="8" r="3.4" />
        <path d="M5.5 19.5c0-3.4 2.9-5.5 6.5-5.5s6.5 2.1 6.5 5.5" />
      </svg>
    </span>
  );
}

// Typeahead for the composer: when the seller types a model ("iphone 17",
// "s24 ultra", "ps5"), the matching board rows show as tap-to-price chips
// above the message box — tapping one runs the deterministic chip flow
// (storage → condition → carrier → engine number) instead of the AI. Storage,
// condition and carrier words are ignored so "iphone 17 pro 256gb cracked"
// still matches; a lot ("an iphone and a macbook") matches nothing and the
// bot handles it. Sonny 2026-09-11: "give customers a dropdown when they
// type iPhone 17… if they keep typing it goes away".
const TYPE_NOISE = new Set(["i", "have", "a", "an", "got", "my", "the", "to", "sell", "selling", "and", "with", "for", "it", "is", "in", "on", "of", "this", "that", "want", "wanna", "phone", "phones", "one", "cash", "gb", "tb", "apple"]);
const TYPE_SPEC = /^(\d+(gb|tb)|\d+gig|unlocked|locked|att|at&t|tmobile|t-mobile|verizon|sprint|cricket|metro|metropcs|boost|visible|sealed|unopened|brand|box|mint|new|good|fair|cracked|crack|broken|parts|part|damaged|water|dead|shattered|scratched|scuffed|worn|rough|excellent|flawless|perfect|used|like|condition|digital|disc|cellular|lte|5g|wifi|wi-fi|only|edition|storage)$/i;
function normalizeTyped(draft: string): string {
  return draft.toLowerCase().replace(/(\d+)\s*(gb|tb)\b/g, "$1$2");
}
// Spec words in the typed text pre-fill the chip flow, so "iphone 17 pro
// cracked 256gb unlocked" + one tap = the number, no questions asked.
type TypedSpec = { storage?: string; condition?: string; carrier?: string; connectivity?: string; disc?: string };
function parseTypedSpec(draft: string): TypedSpec {
  const d = normalizeTyped(draft);
  const out: TypedSpec = {};
  const st = d.match(/\b(64|128|256|512|1024)gb\b|\b([12])tb\b/);
  if (st) out.storage = st[0] === "1024gb" ? "1tb" : st[0].endsWith("tb") ? st[0] : st[0].replace("gb", "");
  if (/\b(sealed|unopened|new in box|brand new)\b/.test(d)) out.condition = "sealed";
  else if (/\b(parts|part|dead|water|won'?t (turn|power) on|no power|doesn'?t (turn|power) on)\b/.test(d)) out.condition = "parts";
  else if (/\b(cracked|crack|broken|damaged|shattered)\b/.test(d)) out.condition = "broken";
  else if (/\b(mint|like new|excellent|flawless|perfect)\b/.test(d)) out.condition = "mint";
  else if (/\b(fair|worn|scratched|scuffed|rough|beat up)\b/.test(d)) out.condition = "fair";
  else if (/\bgood\b/.test(d)) out.condition = "good";
  if (/\bunlocked\b/.test(d)) out.carrier = "unlocked";
  else if (/\b(at&t|att)\b/.test(d)) out.carrier = "att";
  else if (/\b(t-mobile|tmobile|sprint)\b/.test(d)) out.carrier = "tmobile";
  else if (/\bverizon\b/.test(d)) out.carrier = "verizon";
  else if (/\b(cricket|metro|metropcs|boost|straight talk|visible)\b/.test(d)) out.carrier = "other";
  else if (/\blocked\b/.test(d)) out.carrier = "unknown";
  if (/\b(cellular|lte|5g)\b/.test(d)) out.connectivity = "cellular";
  else if (/\bwi-?fi\b/.test(d)) out.connectivity = "wifi";
  if (/\bdigital\b/.test(d)) out.disc = "digital";
  else if (/\bdisc\b/.test(d)) out.disc = "disc";
  return out;
}
function rowSearchKey(r: BoardRow): string[] {
  const base = r.label.toLowerCase().replace(/["()]/g, " ").split(/\s+/).filter(Boolean);
  const extra: string[] = [];
  if (r.label.startsWith("Galaxy")) { extra.push("samsung"); const n = r.label.match(/\bS(\d+)/); if (n) extra.push(n[1]); }
  if (r.label.startsWith("PlayStation 5")) extra.push("ps5");
  if (r.label.startsWith("PlayStation 4")) extra.push("ps4");
  if (r.label.startsWith("Nintendo")) extra.push("switch");
  if (r.label.startsWith("MacBook")) extra.push("mac");
  return [...base, ...extra];
}
// `keyed` = rows with their search keys precomputed (once per board, not per
// keystroke — the keys never change).
function matchTyped(keyed: { r: BoardRow; key: string[] }[], draft: string): BoardRow[] {
  const toks = normalizeTyped(draft).replace(/[^a-z0-9+&.\- ]/g, " ").split(/\s+/).filter((t) => t && !TYPE_NOISE.has(t) && !TYPE_SPEC.test(t));
  if (!toks.length) return [];
  const out = keyed.filter(({ key }) => toks.every((t) => key.some((k) => k.startsWith(t)))).map(({ r }) => r);
  // One bare word ("iphone", "macbook") is too broad to be a pick; a specific
  // family word ("ps5", "xbox", "switch") that lands on a handful is fine.
  if (toks.length === 1 && (toks[0].length < 3 || out.length > 6)) return [];
  // Two words name a family — "macbook air" is 7 rows, "macbook pro" 9 — and
  // the chip row scrolls sideways, so up to 10 is still a pick, not a list
  // (2026-09-27: "macbook air" typed on /go showed no chips at all).
  return out.length && out.length <= 10 ? out : [];
}

// Category quick-selects — the FB-funnel pattern: pick what you got, we walk
// you. iPhone/Samsung run the deterministic model→chips→quote flow; the rest
// hand the category to the AI brain as a typed opener (it runs the intake).
const CATEGORIES: { key: string; label: string; img: string; deterministic?: Group }[] = [
  { key: "iphone", label: "iPhone", img: "/devices/iphone-16-pro-max.webp", deterministic: "ip" },
  { key: "samsung", label: "Samsung", img: "/devices/gs25u.webp", deterministic: "gs" },
  // MacBooks (M-series) price through the homepage's additive math, ported
  // server-side 2026-09-11 (app/lib/macbook-quote.ts). Intel/legacy models
  // stay on the chat path via "older or don't see it".
  { key: "macbook", label: "MacBook", img: "/devices/macbook-pro-m4.webp", deterministic: "macbook" },
  // iPads and consoles are price-table devices — same engine as phones, so
  // they get the chip flow too (2026-09-11; they used to drop into a chat
  // that asked for a number before showing one — zero contacts that way).
  { key: "ipad", label: "iPad", img: "/ipadbase.webp", deterministic: "ipad" },
  { key: "console", label: "Console", img: "/ps5-series.webp", deterministic: "console" },
  { key: "other", label: "Something else", img: "/fold-series.webp" },
];
// The instant-quote bar above the composer (2026-09-30, Sonny: "customer
// should always have the box for instant quotes while chatting with the
// bot"). The tiles above leave the thread once the seller starts talking;
// the bar carries the one-tap engine-priced categories for the rest of it.
const QUICK_CATS = CATEGORIES.filter((c) => c.deterministic);
const NO_CATS: typeof CATEGORIES = [];

type Msg =
  // tap: the bubble is a chip/tile choice, not typed text (history tags it
  // "(tapped on the page)" so the chat brain reads it as a selection).
  // preview/pending: a photo bubble keeps its local preview after the upload
  // (the CDN copy is never re-downloaded) and reads "sending…" until then.
  | { from: "user" | "bot" | "owner"; text: string; tap?: true; preview?: string; pending?: true }
  // Local-only error bubble: rendered like a bot message but NEVER included
  // in the history sent to /api/chat (the kind filter drops it) — a client
  // hiccup line must not ride into the model as a real bot turn.
  | { from: "bot"; kind: "err"; text: string }
  // line: once the seller picks a line ("14", "S24") the same message kind
  // renders that line's variants instead of the line chips.
  | { from: "bot"; kind: "models"; group: Group; line?: string; done?: boolean }
  | { from: "bot"; kind: "chips"; q: string; dim: GoStep | "another" | "handoff"; options: { key: string; label: string }[]; done?: boolean }
  // note: an extra line under the number (e.g. the "not sure" carrier caveat)
  | { from: "bot"; kind: "quote"; label: string; offer: number; note?: string; done?: boolean }
  | { from: "bot"; kind: "lockform"; manual: boolean; done?: boolean }
  // tiny opt-in phone field, opened by the "leave my number" chip at the start
  | { from: "bot"; kind: "numberform"; done?: boolean }
  // until: ISO lock deadline from /api/go/lock — rendered as "holds until <date>"
  // confirmed: sms/email = delivered before the response; pending = still sending; failed = channel refused
  // contact: what they locked with — a phone whose text failed gets the email fallback form under the card
  | { from: "bot"; kind: "locked"; offer: number | null; until?: string; confirmed?: "sms" | "email" | "pending" | "failed"; contact?: string }
  // Shipping handoff: address form → FedEx label minted on the spot.
  // newLabel (2026-09-30): "my box already shipped" after a join — the label
  // route sets the joined label aside and prints this lock its own.
  | { from: "bot"; kind: "shipform"; done?: boolean; newLabel?: boolean }
  // devices: what the label covers (the box's list, 2026-09-30 — the card
  // said "box the device" over a label that covered two phones); count can
  // exceed devices.length on a legacy box. joined: a device ADDED to an
  // existing box — no new label. room: how many more phones the label
  // carries (go-box boxRoom) — the "more phones?" line shows only with room.
  | { from: "bot"; kind: "label"; tracking: string; url: string; texted?: boolean; emailed?: boolean; devices?: string[]; count?: number; joined?: boolean; room?: number }
  | { from: "bot"; kind: "msgr" };

// ShipForm → shipDone. devices is the box's list since 2026-09-30 (it was a
// number); count is the number; status the failed response's HTTP status.
// withheld: the route will never print this one (a desktop); newLabel: the
// failed form was a "my box already shipped" print (2026-09-30, review).
type ShipResult = { ok: boolean; tracking?: string; url?: string; kind?: string; hint?: string; texted?: boolean; emailed?: boolean; devices?: string[]; count?: number; room?: number; status?: number; withheld?: boolean; newLabel?: boolean };
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : undefined);

// Device lists from the label route / chat-sync / chat widgets — strings
// only, whatever shape a half-deployed server sends.
function strList(v: unknown): string[] | undefined {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && x.trim() !== "").map((x) => x.trim().slice(0, 120)) : undefined;
}
// Model-only name for chat copy: "iPhone 16 Pro Max 1tb good unlocked" →
// "iPhone 16 Pro Max". Same cut as app/lib/go-box shortDevice — copied, not
// imported: go-box pulls the store, SMS and Resend into the client bundle.
function shortDevice(device: string): string {
  const words = device.trim().split(/\s+/);
  const i = words.findIndex((w, k) => k > 0 && /^(\d+(gb|tb)|64|128|256|512|sealed|mint|good|fair|broken|won['’]t)$/i.test(w));
  return (i > 0 ? words.slice(0, i) : words).join(" ") || device;
}
function sayDevices(list: string[]): string {
  const s = list.map(shortDevice);
  return s.length <= 1 ? s.join("") : `${s.slice(0, -1).join(", ")} and ${s[s.length - 1]}`;
}
// Can this device be ADDED to a box that already has a label? go-box joins
// phones only (fedex.ts deviceKindFromString "phone", or nothing it knows) —
// mirrored here so the pay row offers the box only when the join will pass
// (2026-09-30, review: a MacBook got "this one can go in the same box", then
// a 409). The server still decides.
function phoneSized(device: string): boolean {
  const k = device.toLowerCase();
  if (k.includes("laptop") || k.includes("book")) return false;
  if (/phone|galaxy|pixel/.test(k)) return true;
  return !/tablet|ipad|desktop|imac|mac mini|mac studio|\bmac pro\b|all-in-one|\btower\b|alienware|thinkpad|\bxps\b|ideapad|latitude|inspiron|console|playstation\s*\d|ps5|\bps4\b|xbox|switch/.test(k);
}

// FB Page handle for the "keep this chat on Messenger" affordance (m.me deep
// link). Meta policy: we can never MESSAGE someone cold — they must open the
// thread — so the play is getting warm sellers to start one; the thread then
// lands in the Page inbox with their real name, reachable for follow-up.
// Env-gated (set NEXT_PUBLIC_FB_PAGE to the page's handle, the bit after
// facebook.com/); unset = the affordance never renders.
const MSGR_HANDLE = process.env.NEXT_PUBLIC_FB_PAGE || "";

// Client-side ceiling for one chat turn. The server stops its model loop at
// ~45s; past this the seller gets the "try again" bubble instead of typing
// dots until the platform timeout. undefined where AbortSignal.timeout is
// missing (older iOS webviews) — the fetch then simply has no ceiling.
function chatTimeout(): AbortSignal | undefined {
  try {
    return typeof AbortSignal !== "undefined" && typeof AbortSignal.timeout === "function" ? AbortSignal.timeout(75_000) : undefined;
  } catch {
    return undefined;
  }
}

// 8 base36 chars from the CSPRNG (2026-09-26): the id is the thread's bearer
// token (chat-sync, upload, label all take it alone), and Math.random is not
// a secret. Same alphabet and length as before; rejection sampling keeps the
// draw uniform. Math.random only where crypto is missing (old webviews).
function randomTag(n = 8): string {
  const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
  try {
    const out: string[] = [];
    while (out.length < n) {
      const bytes = new Uint8Array(n);
      crypto.getRandomValues(bytes);
      for (const b of bytes) if (b < 252 && out.length < n) out.push(alphabet[b % 36]);
    }
    return out.join("");
  } catch {
    return Math.random().toString(36).slice(2, 2 + n).padEnd(n, "0");
  }
}

function newSessionId(src: string) {
  const rand = randomTag();
  // The tag slot must match validGoSession (letters/digits, ≤10) or every
  // /go endpoint refuses the id.
  const tag = src.replace(/[^a-zA-Z0-9]/g, "").slice(0, 10);
  return `go${tag ? `-${tag}` : ""}-${rand}`.slice(0, 24);
}

// Messenger-style continuity: the session id survives tab closes (7 days
// from the last activity — touchSession below), so a returning seller
// resumes the SAME thread — including replies Sonny sent from /admin/chats
// while they were gone — instead of starting over.
const SESSION_KEY = "tcc-go-session";
// The owner's SMS deep-link (?sid=&k=) is adopted in the restore effect —
// AFTER the server verifies k — never here: an unverified ?sid= would let
// anyone who shares a crafted /go link plant their own (readable) session in
// a victim's browser.
const GO_SID_SHAPE = /^go(-[a-z0-9]{1,10})?-[a-z0-9]{2,12}$/i;
// fresh: minted on this page load — nothing is stored for it, so there is
// nothing to restore.
function persistentSessionId(src: string): { sid: string; fresh: boolean } {
  if (typeof window === "undefined") return { sid: newSessionId(src), fresh: true };
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (raw) {
      const { sid, ts } = JSON.parse(raw) as { sid?: string; ts?: number };
      // GO_SID_SHAPE, not a looser pattern: an id the /go endpoints refuse
      // (an older "go-fb-rt-…" tag) is replaced instead of kept for a week.
      if (typeof sid === "string" && sid.length <= 32 && GO_SID_SHAPE.test(sid) && typeof ts === "number" && Date.now() - ts < 7 * 24 * 3600_000) {
        return { sid, fresh: false };
      }
    }
  } catch { /* fall through to a fresh id */ }
  const sid = newSessionId(src);
  try { localStorage.setItem(SESSION_KEY, JSON.stringify({ sid, ts: Date.now() })); } catch { /* private mode */ }
  return { sid, fresh: true };
}
// Activity keeps the id alive (2026-09-26): the 7-day rule above used to run
// from the MINT, so a seller mid-negotiation on day 8 got a fresh, empty
// thread while their lock, contact and label stayed on the old id. Every
// send, tap note and poll that brought something in refreshes the stamp.
function touchSession(sid: string) {
  try { localStorage.setItem(SESSION_KEY, JSON.stringify({ sid, ts: Date.now() })); } catch { /* private mode */ }
}

// A real photo of the owner for the proof row + his chat messages. Gated on
// NEXT_PUBLIC_OWNER_PHOTO (e.g. "/owner.jpg" once public/owner.jpg exists):
// nothing renders until a real photo is in — no stock face, no fake human.
const OWNER_PHOTO = process.env.NEXT_PUBLIC_OWNER_PHOTO || "";

// Overlay + bubble animations. Rendered by BOTH modes — the widget has no
// <main> wrapper, so without this the bubbles had no styles at all.
const GO_CSS = `
          @keyframes goMsgIn { from { opacity: 0; transform: translateY(5px); } }
          .go-msg { animation: goMsgIn 0.18s ease; }
          @keyframes goDot { 0%, 60%, 100% { transform: translateY(0); opacity: .45; } 30% { transform: translateY(-3px); opacity: 1; } }
          .go-dot { width: 6px; height: 6px; border-radius: 50%; background: #00c853; display: inline-block; animation: goDot 1.1s ease infinite; }
          @keyframes goOverlayIn { from { opacity: 0; transform: translateY(14px); } }
          .go-overlay { animation: goOverlayIn 0.22s cubic-bezier(0.22, 1, 0.36, 1); }
        `;

// Real page scroll lock while the chat is open (2026-09-30, Sonny: "when the
// keyboard is up customers scroll up or down on the page it glitched big
// time"). body overflow:hidden alone is ignored by iOS Safari and the
// Facebook in-app webview (WKWebView): the page behind the overlay kept
// scrolling, and a drag with the keyboard up panned it under the overlay,
// which then chased the visual viewport a frame late. Pinning <body> at
// -scrollY leaves the page nothing to scroll; unlocking puts every style
// back exactly as it was and returns the seller to the same spot. Counted,
// so a second opener can neither unlock the page early nor strand it locked.
let pageLockCount = 0;
let pageUnlock: (() => void) | null = null;
function lockPageScroll(): () => void {
  if (typeof document === "undefined") return () => {};
  if (pageLockCount++ === 0) {
    const html = document.documentElement;
    const body = document.body;
    const y = window.scrollY || html.scrollTop || 0;
    const path = window.location.pathname;
    const rules: [CSSStyleDeclaration, string, string][] = [
      [html.style, "overflow", "hidden"],
      [html.style, "overscroll-behavior", "none"], // no pull-to-refresh / rubber band on the root
      [body.style, "position", "fixed"],
      [body.style, "top", `-${y}px`],
      [body.style, "left", "0px"],
      [body.style, "right", "0px"],
      [body.style, "width", "100%"],
      [body.style, "overflow", "hidden"],
    ];
    const saved = rules.map(([s, prop]) => [s, prop, s.getPropertyValue(prop), s.getPropertyPriority(prop)] as const);
    // The site nav's hide-on-scroll hook skips scrolls while this is up
    // (2026-09-30): the pin's jump to 0 and the restore to y aren't the
    // seller scrolling — it read the restore as a big scroll down and slid
    // the nav away on every close.
    html.dataset.chatLock = "1";
    for (const [s, prop, val] of rules) {
      try { s.setProperty(prop, val); } catch { /* best effort — an old engine skips one property */ }
    }
    pageUnlock = () => {
      for (const [s, prop, val, prio] of saved) {
        try { if (val) s.setProperty(prop, val, prio); else s.removeProperty(prop); } catch { /* best effort */ }
      }
      // A client-side route change while open: the new page keeps its own top.
      try { if (window.location.pathname === path) window.scrollTo(0, y); } catch { /* sandboxed webview */ }
      // Marker off two frames later — the hook reads scrollY in its own rAF
      // after the restore's scroll event — unless the chat reopened meanwhile.
      const clear = () => { if (pageLockCount === 0) delete html.dataset.chatLock; };
      try { requestAnimationFrame(() => requestAnimationFrame(clear)); } catch { clear(); }
    };
  }
  let released = false;
  return () => {
    if (released) return;
    released = true;
    pageLockCount = Math.max(0, pageLockCount - 1);
    if (pageLockCount > 0) return;
    const unlock = pageUnlock;
    pageUnlock = null;
    unlock?.();
  };
}

// Touch guard for the open chat (2026-09-30). The lock leaves the page with
// nothing to scroll, but on iOS a drag with the keyboard up still pans the
// VISUAL viewport, and iOS before 16 ignores overscroll-behavior — so a drag
// that nothing under the finger can follow (the header, the composer, a
// thread already at its top) is cancelled instead of moving the page. The
// scrollers under the finger are collected once at touchstart; each move
// then only asks "can one of them still go this way?".
type ChatGesture = { x: number; y: number; t: number; ys: HTMLElement[]; xs: HTMLElement[]; field: Element | null; multi: boolean };
const SCROLLS = /(auto|scroll)/;
function chatGesture(target: EventTarget | null, x: number, y: number): ChatGesture {
  const g: ChatGesture = { x, y, t: Date.now(), ys: [], xs: [], field: null, multi: false };
  if (!(target instanceof Element)) return g;
  g.field = target.closest("input, textarea, [contenteditable]:not([contenteditable='false'])");
  for (let el: Element | null = target; el && el !== document.body && el !== document.documentElement; el = el.parentElement) {
    if (!(el instanceof HTMLElement)) continue; // an svg icon inside a button
    const cs = window.getComputedStyle(el);
    if (SCROLLS.test(cs.overflowY) && el.scrollHeight > el.clientHeight + 1) g.ys.push(el);
    if (SCROLLS.test(cs.overflowX) && el.scrollWidth > el.clientWidth + 1) g.xs.push(el);
  }
  return g;
}
// d > 0: the finger moved down / right, so the content has to move toward its start.
function canScrollToward(el: HTMLElement, vertical: boolean, d: number): boolean {
  const pos = vertical ? el.scrollTop : el.scrollLeft;
  const max = vertical ? el.scrollHeight - el.clientHeight : el.scrollWidth - el.clientWidth;
  return d > 0 ? pos > 1 : pos < max - 1;
}
function fieldHasSelection(f: Element): boolean {
  try {
    if (f instanceof HTMLInputElement || f instanceof HTMLTextAreaElement) return f.selectionStart != null && f.selectionStart !== f.selectionEnd;
    const s = window.getSelection();
    return !!s && !s.isCollapsed;
  } catch { return false; } // selectionStart throws on some input types in older engines
}

export default function GoClient({ rows, src, reviews, variant = "std", mode = "page", initialGroup = null, landed = "", visitorArea = "unknown", initialOpen = false }: {
  rows: BoardRow[]; src: string; reviews: GoReviews; variant?: "std" | "lot";
  // "widget": the overlay only — the floating button that opens it lives in
  // components/ChatFab, and components/SiteChat mounts this client on the
  // first tap (Sonny 2026-09-12: "an icon where they can jump in the chat
  // anytime"). initialGroup = the page's device family, so the MacBook page
  // opens on MacBooks. landed = the path the session started on.
  mode?: "page" | "widget"; initialGroup?: Group | null; landed?: string;
  // From Vercel's edge geo on the /go page: "metro" | "tx" | "us" | "intl" | "unknown".
  visitorArea?: "metro" | "tx" | "us" | "intl" | "unknown";
  // Widget: mounted by the tap that wants it open — open at once.
  initialOpen?: boolean;
}) {
  const lot = variant === "lot";
  // ---- chat state ----
  const [showReviews, setShowReviews] = useState(false);
  // Full-screen chat takeover — opens on engagement (never on load: the
  // board stays the first paint). X returns to the page with the thread
  // intact.
  const [chatOpen, setChatOpen] = useState(initialOpen);
  useEffect(() => {
    // The page scroll lock moved to its own effect below the history one
    // (2026-09-30) — the old body overflow:hidden here did nothing on iOS.
    // The site-wide button (SiteChat) hides while the overlay is up.
    if (mode === "widget") window.dispatchEvent(new CustomEvent("tcc:chat-state", { detail: { open: chatOpen } }));
    return () => {
      if (mode === "widget") window.dispatchEvent(new CustomEvent("tcc:chat-state", { detail: { open: false } }));
    };
  }, [chatOpen, mode]);
  // iOS / the Facebook webview do NOT shrink the layout viewport when the
  // keyboard opens — a `fixed inset-0` overlay keeps its full height and its
  // bottom (the composer) ends up hidden under the keyboard (Sonny's
  // screenshot, 2026-09-11). Pin the overlay to the VISUAL viewport instead:
  // height + top follow the keyboard, so the message box stays in view.
  const overlayRef = useRef<HTMLDivElement>(null);
  // Widget mode: the homepage's legacy "open chat" buttons and any page can
  // open this overlay with `window.dispatchEvent(new CustomEvent("tcc:open-chat"))`.
  const startedOnPageRef = useRef(false);
  // (The draggable floating button that used to live here is
  // components/ChatFab — it is what every page ships; this client loads
  // behind it on the first tap.)
  useEffect(() => {
    if (mode !== "widget") return;
    const onOpen = () => setChatOpen(true);
    window.addEventListener("tcc:open-chat", onOpen);
    return () => window.removeEventListener("tcc:open-chat", onOpen);
  }, [mode]);
  useEffect(() => {
    if (mode !== "widget" || !chatOpen || startedOnPageRef.current || !initialGroup || interactedRef.current) return;
    if (msgs.some((m) => !("kind" in m) && m.from === "user")) return; // a restored thread wins
    const cat = CATEGORIES.find((c) => c.deterministic === initialGroup);
    if (!cat || !rows.length) return;
    startedOnPageRef.current = true;
    categoryTap(cat);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, chatOpen, initialGroup, rows.length]);
  useEffect(() => {
    if (!chatOpen) return;
    const vv = typeof window !== "undefined" ? window.visualViewport : null;
    const el = overlayRef.current;
    if (!vv || !el) return;
    // One style write per frame: iOS fires a burst of these during the
    // keyboard animation and on every pan or zoom. With the page lock and
    // touch guard (2026-09-30) a seller's drag no longer pans the page, so
    // offsetTop moves only when iOS itself reveals the focused box — this
    // pin is what keeps the composer above the keyboard, and it stays.
    let raf = 0;
    const apply = () => {
      raf = 0;
      el.style.height = `${Math.round(vv.height)}px`;
      el.style.top = `${Math.round(vv.offsetTop)}px`;
      // the thread shrank — keep the newest message in view
      if (nearBottomRef.current) threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight });
    };
    const schedule = () => { if (!raf) raf = requestAnimationFrame(apply); };
    apply();
    vv.addEventListener("resize", schedule);
    vv.addEventListener("scroll", schedule);
    return () => {
      vv.removeEventListener("resize", schedule);
      vv.removeEventListener("scroll", schedule);
      if (raf) cancelAnimationFrame(raf);
      el.style.height = "";
      el.style.top = "";
    };
  }, [chatOpen]);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  // The current thread for handlers that must not read it through a state
  // updater (the comeback nudge decides AND posts a note — a side effect
  // inside setMsgs runs twice in dev and is undefined-order by contract).
  const msgsRef = useRef<Msg[]>([]);
  useEffect(() => { msgsRef.current = msgs; }, [msgs]);
  // Stable keys: every bubble was keyed by its index, and the restore PREPENDS
  // the stored thread — so a lock/ship/number form the seller was typing into
  // was handed another message's slot (or remounted) when a slow restore
  // landed. Keys follow the message object instead; pushMsgs keeps identity
  // for anything it doesn't retire.
  const msgKeys = useRef(new WeakMap<object, number>());
  const msgSeq = useRef(0);
  // Per page load — keeps the per-form lock eventId unique across reloads
  // (message keys restart at 1 on every load).
  const loadNonce = useRef(Date.now().toString(36));
  const keyOf = (m: Msg): number => {
    let k = msgKeys.current.get(m);
    if (!k) { k = ++msgSeq.current; msgKeys.current.set(m, k); }
    return k;
  };
  // Guided in-chat funnel (Messenger-style quick selects) — deterministic,
  // engine-priced, zero AI calls. gRow/gSpec track the device being walked.
  const [gRow, setGRow] = useState<BoardRow | null>(null);
  const [gSpec, setGSpec] = useState<{ storage?: string; condition?: string; carrier?: string; connectivity?: string; disc?: string; processor?: string; memory?: string; extras?: string }>({});
  const [gBusy, setGBusy] = useState(false);
  const [sending, setSending] = useState(false);
  // Photo attach — the flaw a phone-buyback chat can't have: sellers WANT to
  // show the crack. The picker lives in the Composer; this is the upload state.
  const [uploading, setUploading] = useState(false);
  // Settable: the restore effect swaps in a server-verified ?sid= session
  // from the owner's SMS deep-link. Read once per mount: a second call on a
  // fresh visit would mint a second id.
  const initialSession = useRef<{ sid: string; fresh: boolean } | null>(null);
  if (initialSession.current === null) initialSession.current = persistentSessionId(src);
  const initial = initialSession.current;
  const [sessionId, setSessionId] = useState(initial.sid);
  // Effects with [] deps (the comeback nudge) read this, not the state, so a
  // breadcrumb written after an SMS deep-link adoption lands in the adopted
  // thread instead of the abandoned local one.
  const sessionIdRef = useRef(sessionId);
  useEffect(() => { sessionIdRef.current = sessionId; }, [sessionId]);
  // The texted link's adoption proof (?k=), kept once the server vouched
  // for it (2026-09-26): it rides on every chat-sync poll and on the label
  // and confirm-email posts, so a browser that can't keep the owner cookie
  // (blocked cookies, a webview that drops them) still reaches its thread.
  const [adoptK, setAdoptK] = useState("");
  const adoptKRef = useRef("");
  useEffect(() => { adoptKRef.current = adoptK; }, [adoptK]);
  // chat-sync answered `unbound`: this browser holds neither the owner
  // cookie nor a link for the session. Polling stops (nothing would come
  // back), one line under the composer says so, and the bot's replies still
  // arrive with each POST. A later bound answer clears it; bindTick re-arms
  // the poll after a request that could have bound the browser.
  const [unbound, setUnbound] = useState(false);
  const unboundRef = useRef(false);
  useEffect(() => { unboundRef.current = unbound; }, [unbound]);
  // Consecutive `unbound` answers this visit: the first only earns a quick
  // retry (the binding reply may still be in flight), the second shows the
  // line; any bound answer resets it (2026-09-26).
  const unboundStreakRef = useRef(0);
  const [bindTick, setBindTick] = useState(0);
  const rearmSync = () => { if (unboundRef.current) setBindTick((t) => t + 1); };
  const threadRef = useRef<HTMLDivElement>(null);
  // What the seller just locked — the handoff chips POST it to /api/delivery
  // after the lock form (and its contact) is gone.
  const lastLockRef = useRef<{ model: string; contact: string; offer: number | null; name: string } | null>(null);
  // Every device locked since the seller last chose meet-or-ship. "+ i have
  // another one" lets them lock #2 before choosing, and that one choice then
  // covers all of them: one meetup, one box, one label (Sonny 2026-09-24:
  // "make it easy for people in the chat to sell multiple phones").
  const pendingLocksRef = useRef<{ model: string; contact: string; offer: number | null; name: string }[]>([]);
  // "not sure yet" answered the pay question for what's locked so far: don't
  // ask it again on "that's it for now", but keep those devices pending so a
  // later meetup / box still covers them. Reset by the next lock.
  const payDeferredRef = useRef(false);
  // The seller's open box (2026-09-30): the label a device locked later can
  // ride on instead of a second label. Set by a minted label, a join, the
  // restore's `box` and the chat's label/joinbox widgets. coversNewest: the
  // newest lock is already in it (a new lock flips it off) — while it is off,
  // the pay question leads with "put it in my box — same label" when the new
  // lock can join (phones, and room on the label).
  // ask (2026-09-30, review): the server's own "can the newest lock join"
  // verdict (restore box.ask; a chat joinbox widget) — the only one there is
  // after a reload, when this page load knows no lock.
  const openBoxRef = useRef<{ tracking: string; url: string; devices: string[]; room: number; coversNewest: boolean; ask?: boolean } | null>(null);
  // Business-hours status. Client-only (Date at render would mismatch the
  // server HTML), and both strings are TRUE at all hours — quotes run 24/7.
  const [status, setStatus] = useState("");
  const [isDay, setIsDay] = useState(true);
  useEffect(() => {
    const h = Number(new Intl.DateTimeFormat("en-US", { hour: "numeric", hour12: false, timeZone: "America/Chicago" }).format(new Date()));
    const day = h >= 8 && h < 21;
    setIsDay(day);
    setStatus(day ? "online now · same-day cash" : "quotes live 24/7");
  }, []);
  // Auto-scroll ONLY when the seller is already at (or near) the bottom.
  // Unconditional scrolling yanked them back down every time state changed
  // while they were scrolled up reading their photos/the quote — the
  // "it jumps me back to the bottom" bug. nearBottom tracks their real scroll
  // position; opening the chat resets it so a fresh open still lands at the
  // latest message.
  const nearBottomRef = useRef(true);
  // Only a scroll UP (the seller reading back) turns the follow off; reaching
  // the bottom turns it back on. The old test was the position alone ("within
  // 120px of the bottom", with our own smooth scroll's events ignored for
  // 700ms): a smooth scroll that never finished — the next chip tapped while
  // the thread was still animating, the keyboard opening, the webview
  // pausing frames — left the thread 150-300px short, that read as "scrolled
  // up", and the next question landed below the fold under a dimmed widget
  // (2026-09-27, reproduced on the line → variant → storage taps).
  const lastScrollTopRef = useRef(0);
  useEffect(() => {
    if (chatOpen) {
      nearBottomRef.current = true;
      lastScrollTopRef.current = 0;
    }
  }, [chatOpen]);
  useEffect(() => {
    if (!nearBottomRef.current) return;   // they scrolled up on purpose — never yank
    threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight, behavior: "smooth" });
  }, [msgs, sending, chatOpen]);

  // Live owner takeover (ManyChat-parity): while the chat is open we poll
  // chat-sync for messages Sonny sends from /admin/chats and for the
  // takeover flag. Owner messages render with their own badge so the seller
  // always knows when a human is typing vs the bot; when takeover is on,
  // /api/chat stores the seller's messages and stays silent.
  const [takeover, setTakeover] = useState(false);
  const takeoverRef = useRef(false);
  useEffect(() => { takeoverRef.current = takeover; }, [takeover]);
  // AI-path close signals: the server returns `quoted` when Theot named an
  // engine number and `leadCaptured` when a contact landed. The nudges key on
  // these too — an AI quote is just as much "a real number on screen" as a
  // guided quote card, and a captured contact means stop asking for one.
  const [aiQuoted, setAiQuoted] = useState(false);
  const [contactCaptured, setContactCaptured] = useState(false);
  const lastSyncRef = useRef(0);
  // Owner and bot records already on screen ("ts|text") — the cursor below
  // trails the newest record, so a poll can return the same reply twice, and
  // a bot reply arrives twice by design: with the POST response (which
  // carries its stored ts) and again through the poll (2026-09-26).
  const seenSyncRef = useRef<Set<string>>(new Set());
  // A record's ts is taken BEFORE its blob upload finishes, so Sonny's reply
  // can become listable after a NEWER record (the seller's own message, a tap
  // note). Jumping the cursor straight to the newest ts skipped that reply
  // for good. The cursor only passes records at least SYNC_SETTLE_MS old (by
  // the server's clock, from the Date header); once the thread goes quiet it
  // catches up to lastTs, so idle polls stay zero-fetch server-side.
  const SYNC_SETTLE_MS = 15_000;
  const advanceSyncCursor = (lastTs: unknown, r: Response) => {
    if (typeof lastTs !== "number") return;
    const serverNow = Date.parse(r.headers.get("date") || "") || Date.now();
    const next = Math.min(lastTs, serverNow - SYNC_SETTLE_MS);
    if (next > lastSyncRef.current) lastSyncRef.current = next;
  };
  const hasActivity = msgs.length > 0;
  // When the thread last changed (either side) — polling slows down after a
  // quiet minute and speeds back up on the next message.
  const lastActivityRef = useRef(Date.now());
  useEffect(() => { lastActivityRef.current = Date.now(); }, [msgs]);
  useEffect(() => {
    if (!chatOpen || !hasActivity) return; // nothing stored server-side until the seller does something
    // One poll at a time, scheduled after the previous one RETURNS: a fixed
    // 4 s interval fired regardless, so on a slow connection polls stacked up
    // and tripped the per-IP budget — and the client ignores non-ok bodies,
    // so Sonny's replies simply stopped arriving. Hidden tab = no polls; the
    // next visible moment polls at once. Aborted on close so a late response
    // can't touch state.
    const ac = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let stopped = false;
    const poll = async () => {
      if (stopped) return;
      if (document.visibilityState === "hidden") return; // resumed by onVis
      // The next tick: the normal cadence, or the unbound schedule below.
      let delay: number | null = null;
      try {
        const r = await fetch(`/api/go/chat-sync?session=${sessionId}&after=${lastSyncRef.current}${adoptKRef.current ? `&k=${adoptKRef.current}` : ""}`, { cache: "no-store", signal: ac.signal });
        if (r.ok) { // a rate-limited tick must never flip UI state
          const d = await r.json();
          if (d?.unbound) {
            // Not this browser's thread (no owner cookie, no link) — or the
            // binding reply is still in flight: the first such answer in a
            // visit only earns a retry ~3 s later; the second in a row shows
            // the line. Polling then slows to 30 s instead of stopping, so a
            // later binding (the legacy grace, a texted link opened in this
            // browser, a cookie that landed late) clears it by itself
            // (2026-09-26).
            unboundStreakRef.current += 1;
            if (unboundStreakRef.current >= 2) setUnbound(true);
            delay = unboundStreakRef.current === 1 ? 3_000 : 30_000;
          } else {
            unboundStreakRef.current = 0;
            if (unboundRef.current) setUnbound(false);
            if (Array.isArray(d?.msgs) && d.msgs.length) {
              const fresh = (d.msgs as { role?: unknown; ts?: unknown; text?: unknown }[]).filter((m) => {
                if (typeof m?.ts !== "number") return false;
                const key = `${m.ts}|${String(m.text)}`;
                if (seenSyncRef.current.has(key)) return false;
                seenSyncRef.current.add(key);
                return true;
              });
              if (fresh.length) {
                // A bot record here is a reply whose POST response never made
                // it back (a dropped webview fetch) — shown instead of leaving
                // the seller to re-send the turn (2026-09-26).
                setMsgs((cur) => [...cur, ...fresh.map((m) => ({ from: m.role === "bot" ? ("bot" as const) : ("owner" as const), text: String(m.text) }))]);
                touchSession(sessionId);
              }
            }
            advanceSyncCursor(d?.lastTs, r);
            if (typeof d?.takeover === "boolean") setTakeover(d.takeover);
          }
        }
      } catch { /* next tick */ }
      if (stopped) return;
      const quiet = Date.now() - lastActivityRef.current > 60_000;
      timer = setTimeout(poll, delay ?? (quiet ? 10_000 : 4_000));
    };
    const onVis = () => {
      if (document.visibilityState !== "visible") return;
      clearTimeout(timer);
      void poll();
    };
    document.addEventListener("visibilitychange", onVis);
    timer = setTimeout(poll, 4_000);
    return () => {
      stopped = true;
      clearTimeout(timer);
      ac.abort();
      document.removeEventListener("visibilitychange", onVis);
    };
    // bindTick: re-armed after a request that may have bound this browser.
  }, [chatOpen, hasActivity, sessionId, bindTick]);

  // Android's Back gesture (and the Facebook in-app browser's) is how a
  // phone closes a full-screen view — without a history entry it left the ad
  // page mid-quote. Opening the chat pushes one; Back pops it and closes the
  // chat; the ✕ goes through history so the two stay in step.
  useEffect(() => {
    if (!chatOpen) return;
    try { window.history.pushState({ tccChat: 1 }, ""); } catch { /* sandboxed webview */ }
    const onPop = () => setChatOpen(false);
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [chatOpen]);
  function closeChat() {
    const st = typeof window !== "undefined" ? (window.history.state as { tccChat?: number } | null) : null;
    if (st?.tccChat) window.history.back(); // popstate → setChatOpen(false)
    else setChatOpen(false);
  }
  // Page scroll lock while the chat is open (2026-09-30) — see
  // lockPageScroll. Declared AFTER the history effect on purpose: its
  // pushState records the page's real scroll position before the body is
  // pinned (scrollY reads 0 once it is), so Back's own scroll restoration
  // lands where ours does. The cleanup also runs when the widget unmounts.
  useEffect(() => {
    if (!chatOpen) return;
    return lockPageScroll();
  }, [chatOpen]);
  // Touch guard (2026-09-30) — see chatGesture. Non-passive, so a drag
  // nothing can follow is cancelled before the browser pans the page with
  // it. A move the browser already scrolls with isn't cancelable (nothing to
  // fix then). Taps, pinch zoom, sideways chip rows and caret / selection
  // drags in the text fields are never cancelled.
  useEffect(() => {
    if (!chatOpen || typeof document === "undefined") return;
    let g: ChatGesture | null = null;
    const onStart = (e: TouchEvent) => {
      if (e.touches.length > 1) { if (g) g.multi = true; return; }
      const t = e.touches[0];
      g = chatGesture(e.target, t.clientX, t.clientY);
    };
    const onMove = (e: TouchEvent) => {
      if (!g || g.multi || !e.cancelable) return;
      if (e.touches.length > 1) { g.multi = true; return; } // a pinch stays a pinch — zoom is accessibility
      // Nothing under the finger scrolls and it isn't a text field: there's
      // no direction to wait for — hold the page still from the first move.
      if (!g.ys.length && !g.xs.length && !g.field) { e.preventDefault(); return; }
      const t = e.touches[0];
      const dx = t.clientX - g.x;
      const dy = t.clientY - g.y;
      // No verdict until the drag has a clear direction (2026-09-30): 6px of
      // travel — still under iOS's ~10pt pan threshold — with one axis 1.5x
      // the other. WebKit lets one cancelled move before the pan kill
      // scrolling for the whole touch, so a noisy first 2px (an arcing thumb)
      // used to leave the thread or a chip strip dead until the finger lifted.
      const ax = Math.abs(dx);
      const ay = Math.abs(dy);
      if (Math.max(ax, ay) < 6) return;
      if (ax < ay * 1.5 && ay < ax * 1.5) return; // still diagonal: ask again on the next move
      const vertical = ay > ax;
      const own = vertical ? g.ys : g.xs;
      if (own.some((el) => canScrollToward(el, vertical, vertical ? dy : dx))) return;
      // Never cancel on an axis none of this touch's scrollers own: sideways
      // there's nothing to pan unless the seller zoomed in (then that's the
      // point), and the chip strips are touch-action pan-x, so a vertical
      // start on one moves nothing. The next move asks again.
      if (!own.length && !g.field) return;
      // text fields: sideways drags move the caret or scroll a long line; a
      // press-and-hold is iOS's caret loupe or a selection — never fight those
      if (g.field && (!vertical || Date.now() - g.t >= 300 || fieldHasSelection(g.field))) return;
      e.preventDefault();
    };
    const onEnd = (e: TouchEvent) => { if (!e.touches.length) g = null; };
    // The same options object on add and remove: an engine without options
    // support reads it as capture=true both times, so removal still matches.
    const passive: AddEventListenerOptions = { passive: true };
    const active: AddEventListenerOptions = { passive: false };
    document.addEventListener("touchstart", onStart, passive);
    document.addEventListener("touchmove", onMove, active);
    document.addEventListener("touchend", onEnd, passive);
    document.addEventListener("touchcancel", onEnd, passive);
    return () => {
      document.removeEventListener("touchstart", onStart, passive);
      document.removeEventListener("touchmove", onMove, active);
      document.removeEventListener("touchend", onEnd, passive);
      document.removeEventListener("touchcancel", onEnd, passive);
    };
  }, [chatOpen]);
  // Keyboard / screen-reader basics (2026-09-26): focus moves INTO the
  // dialog when it opens — onto the overlay itself, never the composer (see
  // the no-programmatic-focus rule below: a focused input pops the keyboard
  // and iOS hides the box) — and Escape closes it like the ✕.
  useEffect(() => {
    if (!chatOpen) return;
    try { overlayRef.current?.focus({ preventScroll: true }); } catch { /* older webviews */ }
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") closeChat(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatOpen]);

  // Thread restore, once per page load: a returning seller (persisted
  // session id) gets their conversation back — bot replies and anything
  // Sonny sent while they were gone. A fresh session returns nothing and
  // costs one cheap empty read.
  const restoredRef = useRef(false);
  // Any seller interaction this page load (tile tap, chip, typed message,
  // photo) — rehydration must never clobber a flow they already started.
  const interactedRef = useRef(false);
  useEffect(() => {
    if (restoredRef.current) return;
    // A session minted on this page load has nothing stored — skip the read.
    // It was one store list per visitor on EVERY page carrying the site-wide
    // widget, and on every first /go click. A deep link (?sid= / ?ship=)
    // names a session and always restores.
    if (initial.fresh && !/[?&](sid|ship)=/.test(window.location.search)) { restoredRef.current = true; return; }
    restoredRef.current = true;
    void (async () => {
      // Owner SMS deep-link adoption: ?sid=&k= — the server checks k (an
      // HMAC only the authed console can mint) and vouches with adopt:true;
      // anything else is ignored and we restore the local session as usual.
      let sid = sessionId;
      let adoptParam = "";
      let adoptKey = "";
      let wantShip = false;
      try {
        const qs = new URLSearchParams(window.location.search);
        wantShip = qs.get("ship") === "1";
        const urlSid = qs.get("sid") || "";
        const urlK = qs.get("k") || "";
        if (GO_SID_SHAPE.test(urlSid) && urlSid.length <= 32 && /^[a-f0-9]{20}$/i.test(urlK)) {
          sid = urlSid;
          adoptParam = `&k=${urlK}`;
          adoptKey = urlK;
        }
      } catch { /* local session */ }
      try {
        const r = await fetch(`/api/go/chat-sync?session=${sid}&after=0&full=1${adoptParam}`, { cache: "no-store" });
        if (!r.ok) return;
        const d = await r.json();
        if (adoptParam) {
          if (!d?.adopt) return; // server refused the deep-link — keep the local session untouched
          setAdoptK(adoptKey); // the link keeps proving ownership for the rest of the visit
          setSessionId(sid);
          try { localStorage.setItem(SESSION_KEY, JSON.stringify({ sid, ts: Date.now() })); } catch { /* private mode */ }
          setChatOpen(true); // the SMS said "reply in your chat" — the board would be a dead end
        }
        // A local session this browser can't prove it owns (cookie gone):
        // nothing to restore. Counts as the visit's first unbound answer —
        // the line waits for a second one from the poll (2026-09-26).
        if (d?.unbound) unboundStreakRef.current += 1;
        if (Array.isArray(d?.msgs) && d.msgs.length) {
          // Owner and bot replies are keyed like the poll's, so a tick that
          // already rendered one (seller tapped before this resolved) isn't
          // doubled — and a later poll won't re-add a restored bot line.
          const restored: Msg[] = (d.msgs as { role: string; text: string; ts?: unknown }[])
            .filter((m) => {
              if ((m.role !== "owner" && m.role !== "bot") || typeof m.ts !== "number") return true;
              const key = `${m.ts}|${String(m.text)}`;
              if (seenSyncRef.current.has(key)) return false;
              seenSyncRef.current.add(key);
              return true;
            })
            .map((m) => ({
              from: m.role === "user" ? ("user" as const) : m.role === "owner" ? ("owner" as const) : ("bot" as const),
              text: String(m.text),
            }));
          // MERGE, never discard: if the seller tapped a tile before this
          // fetch resolved, dropping the restored thread also skipped the
          // cursor past Sonny's while-away replies — they'd never render.
          // Restored records are strictly older than anything from this
          // page load, so they belong in front.
          setMsgs((cur) => (cur.length ? [...restored, ...cur] : restored));
        }
        // Re-hydrate an un-locked guided quote — the highest-intent restore
        // moment. The server returns it only when no lock followed and the
        // quote is inside its 14-day window; we skip it when Sonny is live
        // or the seller already started a new flow this page load (their
        // taps must never get clobbered with last week's device).
        const pq = d?.pendingQuote;
        if (pq && typeof pq.model === "string" && !d?.takeover && !interactedRef.current) {
          const row = rows.find((x) => x.id === pq.model);
          if (row && typeof pq.offer === "number") {
            setGRow(row);
            // QSPEC's 4th field is the category's secondary answer: carrier
            // for phones, connectivity for iPads, disc for consoles.
            const sec = String(pq.carrier || "");
            const [mp, mm, me] = sec.split("+");
            setGSpec({
              storage: String(pq.storage || ""),
              condition: String(pq.condition || ""),
              ...(row.cat === "phone" ? { carrier: sec }
                : row.cat === "ipad" ? { connectivity: sec }
                : row.cat === "macbook" ? { processor: mp || "", memory: mm || "", extras: me || "ok" }
                : { disc: sec }),
            });
            setMsgs((cur) => [
              ...cur,
              { from: "bot", text: `welcome back — your number on the ${row.label} is still good. lock it in below and we’ll text it to you.` },
              { from: "bot", kind: "quote", label: quoteLabel(row, String(pq.storage || "")), offer: pq.offer },
              { from: "bot", kind: "lockform", manual: false },
            ]);
          }
        }
        advanceSyncCursor(d?.lastTs, r);
        if (typeof d?.takeover === "boolean") setTakeover(d.takeover);
        if (d?.contactOnFile) setContactCaptured(true);
        // A label already issued → show it again ("where's my label?").
        // The SMS SHIP reply deep-links with &ship=1 → open the address form.
        const lb = d?.label;
        // The open box (2026-09-30): a device locked after the label gets
        // "same box, same label" or "that box already shipped". Before, a
        // reload showed nothing and the next ship minted a second label.
        // ask (review 2026-09-30): only when the newest lock can join AND its
        // handoff is still open \u2014 a meetup pick, or an SMS SHIP that took the
        // address path, reloaded to the box question and a join that posted
        // a shipping record for a device booked for a meetup.
        const bx = d?.box && typeof d.box.tracking === "string" && typeof d.box.url === "string"
          ? { tracking: String(d.box.tracking), url: String(d.box.url), devices: strList(d.box.devices) ?? [], count: num(d.box.count), room: num(d.box.room) ?? 0, coversNewest: d.box.coversNewest === true, ask: d.box.ask === true }
          : null;
        if (bx) openBoxRef.current = { tracking: bx.tracking, url: bx.url, devices: bx.devices, room: bx.room, coversNewest: bx.coversNewest, ask: bx.ask };
        if (bx && bx.ask) {
          setChatOpen(true);
          setMsgs((cur) => [
            ...cur,
            { from: "bot", text: bx.devices.length ? `welcome back \u2014 your FedEx label covers the ${sayDevices(bx.devices)}.` : "welcome back \u2014 you already have a FedEx label." },
            { from: "bot", kind: "label", tracking: bx.tracking, url: bx.url, devices: bx.devices, count: bx.count, room: bx.room },
            boxChips(),
          ]);
        } else if (lb && typeof lb.tracking === "string" && typeof lb.url === "string") {
          // One card, with what the label covers. A lock that was ADDED to an
          // earlier box also gets the way out if that box already went out
          // (2026-09-30, review: the join text points here for it).
          const same = bx && bx.tracking === lb.tracking ? bx : null;
          const devices = strList(lb.devices) ?? same?.devices;
          const joined = lb.joined === true;
          setChatOpen(true);
          setMsgs((cur) => [
            ...cur,
            { from: "bot", text: "welcome back \u2014 here\u2019s your FedEx label again." },
            { from: "bot", kind: "label", tracking: lb.tracking, url: lb.url, devices, count: num(lb.count) ?? same?.count, room: num(lb.room) ?? same?.room, joined },
            ...(joined ? [newLabelChips()] : []),
          ]);
        } else if (d?.relabel === true) {
          // Added to a box they then said already shipped, and that new
          // label didn't print (2026-09-30, review): the way to print it —
          // not the joined card, which said to use the shipped box.
          setChatOpen(true);
          setMsgs((cur) => [
            ...cur,
            { from: "bot", text: "welcome back — the new label for your newest device hasn’t printed yet." },
            newLabelChips(true),
          ]);
        } else if (wantShip && d?.contactOnFile) {
          setChatOpen(true);
          setMsgs((cur) => [...cur, { from: "bot", text: "drop your shipping address and your free FedEx label prints right here." }, { from: "bot", kind: "shipform" }]);
        }
      } catch { /* fresh thread */ }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  // Guided-funnel breadcrumbs for the owner console — the chip flow never
  // touches /api/chat, so quote/lock milestones are logged here instead.
  function logNote(text: string) {
    touchSession(sessionIdRef.current); // a tap is activity — the id stays alive
    void fetch("/api/go/chat-sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session: sessionIdRef.current, text }),
    }).then((r) => { if (r.ok) rearmSync(); }).catch(() => {});
  }

  // COMEBACK NUDGE: a seller who had a real number on screen, left the tab for
  // 30s+, and came back is the highest-risk/highest-intent moment on the page —
  // one bubble asking for their phone (so the reminder can reach them even if
  // they leave for good) plus, when configured, a "keep this chat on Messenger"
  // card. One-shot per page load; never fires once they've locked.
  const awayNudgedRef = useRef(false);
  const hiddenAtRef = useRef(0);
  const aiQuotedRef = useRef(false);
  useEffect(() => { aiQuotedRef.current = aiQuoted; }, [aiQuoted]);
  const contactCapturedRef = useRef(false);
  useEffect(() => { contactCapturedRef.current = contactCaptured; }, [contactCaptured]);
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === "hidden") {
        hiddenAtRef.current = Date.now();
        return;
      }
      if (awayNudgedRef.current) return;
      // Never talk over a live takeover, and never ask for a number we have.
      if (takeoverRef.current || contactCapturedRef.current) return;
      if (!hiddenAtRef.current || Date.now() - hiddenAtRef.current < 30_000) return;
      // Decided from the current thread OUTSIDE the state updater (an updater
      // must be pure — this one also posted a note).
      const cur = msgsRef.current;
      const hasQuote = aiQuotedRef.current || cur.some((m) => "kind" in m && (m.kind === "quote" || m.kind === "lockform"));
      const isLocked = cur.some((m) => "kind" in m && m.kind === "locked");
      // AI-path threads (MacBook / iPad / console / "something else") never
      // get a quote card, so the old quote-only gate left the largest
      // uncovered segment with no catch at all. Any thread the seller
      // actually typed in counts.
      const hasThread = cur.some((m) => !("kind" in m) && m.from === "user");
      if (isLocked || (!hasQuote && !hasThread)) return;
      awayNudgedRef.current = true;
      logNote(`seller left and came back${hasQuote ? "" : " (no quote yet)"} — nudged for number` + (MSGR_HANDLE && hasQuote ? " + messenger" : ""));
      setMsgs((list) => [
        ...list,
        {
          from: "bot",
          text: hasQuote
            ? "welcome back — your number’s still good. drop your phone number and we’ll text it to you so it’s saved even if you head out."
            : "still here — drop your phone number and we’ll text you the offer so it’s saved even if you head out.",
        },
        ...(MSGR_HANDLE && hasQuote ? [{ from: "bot" as const, kind: "msgr" as const }] : []),
      ]);
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Timed nudge bubbles (25s lock-form, 45s idle) are GONE — Sonny 2026-09-11:
  // "it nudged me 3 times, that's insane". The bot asks once with the first
  // real quote; the only client-side ask left is the comeback bubble when a
  // seller with a number on screen leaves the tab and returns, plus the
  // standing note at the top of the chat and the save-this-chat bar.
  // A photo is in the thread (sent or restored) — the composer's camera
  // affordance and button styling key on it. Scanned once per render, not
  // twice inside the JSX.
  const hasPhoto = msgs.some((m) => !("kind" in m) && m.text.startsWith("IMG::"));
  // The tiles + starter chips stay until the seller actually starts: a
  // "leave my number" card, a bare number and the bot's ack to it don't count
  // (tapping the chip used to make the tiles vanish). Once it has started,
  // the instant-quote bar above the composer carries the quick categories
  // (2026-09-30) — the two never show together.
  const looksLikeContact = (t: string) => /^\S+@\S+$/.test(t.trim()) || (t.replace(/\D/g, "").length >= 10 && t.trim().length <= 24);
  const threadStarted = msgs.some((m) => ("kind" in m ? m.kind !== "numberform" : m.from === "user" && !looksLikeContact(m.text)));
  // The seller is TYPING into an in-thread form (lock / ship / number) —
  // 2026-09-30: the bar sits right above the keyboard then, and a stray tap
  // on it retires the half-typed form (categoryTap → pushMsgs marks it done)
  // — a lost lead. The bar steps aside only while a thread field has focus;
  // with the quote card just sitting there it stays, so the seller can
  // still price something else.
  const [threadFieldFocus, setThreadFieldFocus] = useState(false);
  // A sent form's field is disabled or unmounted, and Chrome fires no blur
  // for either — re-check on every thread change so the bar can't stay away.
  useEffect(() => {
    if (!threadFieldFocus) return;
    const a = typeof document !== "undefined" ? document.activeElement : null;
    const inThread = !!a && !!threadRef.current?.contains(a) && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) && !(a as HTMLInputElement).disabled;
    if (!inThread) setThreadFieldFocus(false);
  }, [msgs, threadFieldFocus]);

  // Retire interactivity on every previous rich message; append new ones.
  // Only the kinds that carry `done` are rewritten (and only while live), so
  // every other message keeps its object — and its key — across pushes.
  const DONE_KINDS = new Set(["models", "chips", "quote", "lockform", "numberform", "shipform"]);
  function pushMsgs(...add: Msg[]) {
    setMsgs((m) => [...m.map((x) => ("kind" in x && DONE_KINDS.has(x.kind) && !("done" in x && x.done) ? { ...x, done: true } : x)), ...add]);
  }

  // The message button just opens the chat. NO programmatic focus anywhere in
  // the overlay: auto-focusing the composer popped the keyboard but iOS then
  // shifted the fixed overlay so the message box itself was hidden while the
  // seller typed (Sonny 2026-09-11: "it just types and doesn't reveal the
  // message box — fix or remove"). The seller taps the box, like any
  // messaging app.
  function openChat() {
    interactedRef.current = true;
    setChatOpen(true);
  }

  // "got another one?" — asked after the handoff choice. Every affordance
  // (category grid, "i got a few phones" chip) is gated on an empty thread,
  // so without this the locked card is a dead end and a 3-device seller
  // silently becomes a 1-device seller.
  function anotherChips(q = "got another one?"): Msg {
    return {
      from: "bot",
      kind: "chips",
      q,
      dim: "another",
      options: [
        { key: "ip", label: "another iPhone" },
        { key: "gs", label: "a Samsung" },
        { key: "ipad", label: "an iPad" },
        { key: "macbook", label: "a MacBook" },
        { key: "console", label: "a console" },
        { key: "other", label: "something else" },
        { key: "no", label: "that’s it for now" },
      ],
    };
  }

  // "how do you want to get paid?" — asked right after each lock. The last
  // chip is the "anything else?" ask at the moment of the lock: half the
  // sellers who locked never tapped a pay method, so the "got another one?"
  // row that follows it never reached them (review 2026-09-24, 7 of 14).
  function payChips(): Msg {
    const ship = { key: "ship", label: "ship it — free label, paid the day it lands" };
    const later = { key: "later", label: "not sure yet" };
    const another = { key: "another", label: "+ i have another one" };
    // A label already exists and this lock isn't on it (2026-09-30): the
    // default is the SAME box on the SAME label. We can't see whether that
    // box was dropped off (FedEx tracking is blind to us), so the seller
    // says. The meet chip keeps today's area rules.
    const ob = openBoxRef.current;
    // Only when the join will pass (2026-09-30, review): phones, and room on
    // that label for everything waiting — same rules as go-box joinable.
    const waiting = pendingLocksRef.current.length ? pendingLocksRef.current.map((p) => p.model) : lastLockRef.current ? [lastLockRef.current.model] : [];
    // No lock known on this page load (a reload): the server's verdict
    // decides (ob.ask), never "can't take this one" (2026-09-30, review — a
    // failed join after a restore said the phone didn't fit, and "ship it"
    // minted a second label for one that did).
    const fits = !!ob && (waiting.length > 0 ? waiting.length <= ob.room && waiting.every(phoneSized) : ob.ask === true);
    // The meet chip needs a lock from this page load — without one the
    // handler reads it as "not sure yet" and the pick is lost (2026-09-30,
    // review).
    const noMeet = !lastLockRef.current || visitorArea === "us" || visitorArea === "intl";
    if (ob && !ob.coversNewest && fits) {
      const meet = noMeet
        ? []
        : [{ key: "meet", label: visitorArea === "tx" ? "I can drive to austin — cash on the spot" : "meet in austin — cash on the spot" }];
      return {
        from: "bot",
        kind: "chips",
        q: ob.devices.length
          ? `how do you want to get paid? your label already covers the ${sayDevices(ob.devices)} — this one can go in the same box.`
          : "how do you want to get paid? you already have a FedEx label — this one can go in the same box.",
        dim: "handoff",
        options: [...BOX_CHIPS, ...meet, later, another],
      };
    }
    return {
      from: "bot",
      kind: "chips",
      // An open box that can't take this one: say so, then the normal row —
      // "ship it" prints its own label. Only for locks this page load knows
      // (2026-09-30, review). Several waiting share that one new label
      // (2026-09-30, review: "this one" had a seller split them).
      q: ob && !ob.coversNewest && waiting.length > 0
        ? waiting.length > 1
          ? `how do you want to get paid? your earlier box can’t take these ${waiting.length} — they get one new label together.`
          : "how do you want to get paid? your earlier box can’t take this one — it gets its own label."
        : "how do you want to get paid?",
      dim: "handoff",
      // Out-of-area sellers (most of the ad traffic, review 2026-09-23:
      // Dallas / Houston / San Antonio / Phoenix / CA) get the label
      // first; outside Texas the meetup isn't offered at all.
      options:
        noMeet
          ? [ship, later, another]
          : visitorArea === "tx"
            ? [ship, { key: "meet", label: "I can drive to austin — cash on the spot" }, later, another]
            : [{ key: "meet", label: "meet in austin — cash on the spot" }, { key: "ship", label: "ship it — free label" }, later, another],
    };
  }

  // Just the box question (restore, the chat's joinbox widget): "joinbox"
  // POSTs {join:true} to /api/go/label; "ship" opens the address form, and
  // that new label closes the old box server-side.
  function boxChips(device?: string): Msg {
    // Several waiting locks arrive as "A + B" — name them all (2026-09-30,
    // review: shortDevice cut the question to the first one).
    const list = device ? device.split(" + ").filter(Boolean) : [];
    return {
      from: "bot",
      kind: "chips",
      q: `put ${list.length ? `the ${sayDevices(list)}` : "your new one"} in the same box? if that box already shipped, we’ll print a new label.`,
      dim: "handoff",
      options: BOX_CHIPS,
    };
  }

  // A lock that was ADDED to an earlier box, on a return visit: if that box
  // already went out, the label route prints it a label of its own
  // (newLabel, 2026-09-30). retry: that new label already failed to print
  // once (chat-sync relabel, 2026-09-30 review).
  function newLabelChips(retry = false): Msg {
    return {
      from: "bot",
      kind: "chips",
      q: retry ? "tap below and it prints right here." : "box already dropped off? tap below and your newest device gets its own free label.",
      dim: "handoff",
      options: [{ key: "newlabel", label: retry ? "print my new label" : "my box already shipped — new label" }],
    };
  }

  function categoryTap(cat: (typeof CATEGORIES)[number]) {
    if (gBusy) return;
    interactedRef.current = true;
    setChatOpen(true);
    // Funnel breadcrumb: tile taps never touched the server, so the funnel
    // card couldn't see where sellers stalled between "tapped" and "quoted".
    logNote(`tapped ${cat.label}`);
    // Sonny is live: the deterministic flow must not quote a second number
    // over his negotiation. Route the tap's intent through send() — it's
    // stored for the console and the bot stays silent.
    if (takeoverRef.current) {
      void send(`i got a ${cat.label.toLowerCase()} to sell`);
      return;
    }
    if (cat.deterministic) {
      pushMsgs(
        { from: "user", text: cat.label, tap: true },
        { from: "bot", text: "solid — which one is it? older models work too, just type the model." },
        { from: "bot", kind: "models", group: cat.deterministic },
      );
    } else {
      // AI runs the intake for everything off the quick path
      void send(cat.key === "other" ? "i got something else to sell" : `i got a ${cat.label.toLowerCase()} to sell`);
    }
  }

  function deviceTap(r: BoardRow, prefill?: TypedSpec) {
    if (gBusy) return;
    interactedRef.current = true;
    setChatOpen(true);
    if (takeoverRef.current) {
      void send(r.label);
      return;
    }
    // Pre-filled answers (from the typed text) — only steps this row asks
    // for, only valid keys; consoles have no "like new" tier.
    const spec: typeof gSpec = {};
    if (prefill) {
      if (prefill.storage && r.steps.includes("storage") && r.storages.includes(prefill.storage)) spec.storage = prefill.storage;
      if (prefill.condition && r.steps.includes("condition")) spec.condition = r.conditions === 4 ? (prefill.condition === "mint" ? "good" : prefill.condition === "parts" ? "broken" : prefill.condition) : prefill.condition;
      if (prefill.carrier && r.steps.includes("carrier")) spec.carrier = prefill.carrier;
      if (prefill.connectivity && r.steps.includes("connectivity")) spec.connectivity = prefill.connectivity;
      if (prefill.disc && r.steps.includes("disc")) spec.disc = prefill.disc;
    }
    setGRow(r);
    setGSpec(spec);
    pixelTrack("ViewContent", { content_name: r.label, content_category: "chat" });
    const conds = r.conditions === 4 ? CONDITIONS4 : CONDITIONS;
    const bits = [
      spec.storage ? storageLabel(r, spec.storage) : "",
      spec.condition ? conds.find((c) => c.key === spec.condition)?.label ?? "" : "",
      spec.carrier ? CARRIERS.find((c) => c.key === spec.carrier)?.label ?? "" : "",
      spec.connectivity ? CONNECTIVITY.find((c) => c.key === spec.connectivity)?.label ?? "" : "",
      spec.disc ? DISC_OPTIONS.find((c) => c.key === spec.disc)?.label ?? "" : "",
    ].filter(Boolean);
    logNote(`picked model ${r.label}${bits.length ? ` (typed: ${bits.join(", ")})` : ""}`);
    if (spec.condition === "parts") {
      partsPath([r.label, ...bits].join(" · "));
      return;
    }
    const next = r.steps.find((st) => !spec[st]);
    pushMsgs(
      { from: "user", text: [r.label, ...bits].join(" · "), tap: true },
      { from: "bot", text: `good one — up to $${r.upTo.toLocaleString("en-US")} depending on specs.` },
      ...(next ? [stepChips(r, next)] : []),
    );
    // Everything answered in the typed text → straight to the number.
    if (!next) void quoteNow(r, spec, r.steps[r.steps.length - 1]);
  }

  // "won't turn on / parts": the engine prices only devices that power on,
  // so this never gets an engine number — straight to the hand-quote form.
  // The lead carries the flag; Sonny prices it from the lead.
  function partsPath(userLine: string) {
    logNote("chose condition won\u2019t turn on / parts (hand quote)");
    pushMsgs(
      { from: "user", text: userLine, tap: true },
      { from: "bot", text: `we still buy those \u2014 one that won\u2019t turn on gets priced by hand. drop your number and ${isDay ? "we\u2019ll text you a real offer shortly." : "we\u2019ll text you a real offer first thing in the morning."}` },
      { from: "bot", kind: "lockform", manual: true },
    );
  }

  // The engine call + card, shared by the last chip and a fully pre-filled
  // tap. A 429 / 5xx / engine hiccup re-asks the last step; only an explicit
  // manualReview is "we price this one by hand".
  async function quoteNow(row: BoardRow, spec: typeof gSpec, lastDim: GoStep) {
    setGBusy(true);
    const storageKey = spec.storage ?? row.storages[0] ?? row.bestStorage;
    try {
      const res = await fetch("/api/go/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // sessionId → the quote route writes the "quote shown"/QSPEC
        // breadcrumbs SERVER-SIDE with the engine result in hand (they feed
        // the chat brain's funnel context + restore-time rehydration, so
        // they must not be client-authored).
        body: JSON.stringify({
          model: row.id,
          storage: storageKey,
          condition: spec.condition,
          carrier: spec.carrier,
          opt: spec.connectivity ?? spec.disc,
          processor: spec.processor,
          memory: spec.memory,
          extras: spec.extras,
          sessionId,
        }),
      });
      const d = await res.json();
      rearmSync();
      if (d?.ok && typeof d.offer === "number") {
        // Quote + capture in ONE beat — the form rides with the number, no
        // extra tap. InitiateCheckout marks quote-viewers on the pixel so
        // non-lockers become a retargeting audience (Lead still fires only
        // on lock).
        pixelTrack("InitiateCheckout", { content_name: row.label, value: d.offer, currency: "USD" });
        pushMsgs(
          {
            from: "bot",
            kind: "quote",
            label: quoteLabel(row, storageKey),
            offer: d.offer,
            ...(spec.carrier === "unknown"
              ? { note: "priced as carrier-locked. unlocked, at&t or t-mobile: this holds or goes up at inspection. prepaid carriers (cricket, metro, boost) come in lower. tip: settings → general → about → carrier lock." }
              : {}),
          },
          { from: "bot", kind: "lockform", manual: false },
        );
      } else if (d?.manualReview) {
        pushMsgs(
          { from: "bot", text: "this one we price by hand — drop your number and we\u2019ll text you a real offer." },
          { from: "bot", kind: "lockform", manual: true },
        );
      } else if (d?.takeover) {
        // Sonny took the thread while the chips were being answered (the
        // poll hadn't said so yet — 2026-09-26): the engine stays quiet and
        // the spec they tapped goes to him as a message, exactly like a tap
        // during a takeover the client already knew about.
        setTakeover(true);
        void send([quoteLabel(row, storageKey), spec.condition, spec.carrier ?? spec.connectivity ?? spec.disc].filter(Boolean).join(" · "));
      } else {
        pushMsgs({ from: "bot", text: "hit a snag pulling the number — tap that again for me." }, stepChips(row, lastDim));
      }
    } catch {
      pushMsgs({ from: "bot", text: "hit a snag pulling the number — tap that again for me." }, stepChips(row, lastDim));
    }
    setGBusy(false);
  }

  // The chip question for one step of a model's flow. Every category walks
  // the same loop: answer → next step → … → engine quote.
  function stepChips(r: BoardRow, step: GoStep): Msg {
    switch (step) {
      case "storage":
        return {
          from: "bot", kind: "chips", dim: "storage",
          q: r.cat === "console" ? "which edition?" : "what storage is it?",
          options: r.options?.storage ?? r.storages.map((x) => ({ key: x, label: storageLabel(r, x) || x })),
        };
      case "processor":
        return { from: "bot", kind: "chips", q: "which chip is in it? (apple menu → about this mac)", dim: "processor", options: r.options?.processor ?? [] };
      case "memory":
        return { from: "bot", kind: "chips", q: "how much memory?", dim: "memory", options: r.options?.memory ?? [] };
      case "extras":
        return { from: "bot", kind: "chips", q: "anything off with it?", dim: "extras", options: MAC_EXTRAS };
      case "condition":
        return { from: "bot", kind: "chips", q: "what kind of shape is it in?", dim: "condition", options: r.conditions === 4 ? CONDITIONS4 : CONDITIONS };
      case "carrier":
        // Financed/carrier-locked sellers arrive believing they can't sell
        // (Swappa refuses them) — say the opposite here, at the exact chip
        // that raises the doubt. Same fact the chat brain already states.
        return { from: "bot", kind: "chips", q: "locked to a carrier? still making payments is fine too — we buy those.", dim: "carrier", options: CARRIERS };
      case "connectivity":
        return { from: "bot", kind: "chips", q: "wi-fi only, or cellular too?", dim: "connectivity", options: CONNECTIVITY };
      case "disc":
        return { from: "bot", kind: "chips", q: "disc drive, or digital edition?", dim: "disc", options: DISC_OPTIONS };
    }
  }

  async function chipTap(dim: GoStep | "another" | "handoff", key: string, label: string) {
    if (gBusy) return;
    interactedRef.current = true;
    if (takeoverRef.current) {
      void send(label);
      return;
    }
    // Second device: restart the guided flow in place, keeping the thread.
    // Each device locks as its own lead, threaded to the same session id.
    if (dim === "another") {
      if (key === "no") {
        // Tapped "+ i have another one", then changed their mind: the locked
        // devices still need a meet-or-ship answer (unless they already said
        // "not sure yet" for them).
        if (pendingLocksRef.current.length && !payDeferredRef.current) {
          pushMsgs({ from: "user", text: label, tap: true }, payChips());
          return;
        }
        pushMsgs(
          { from: "user", text: label, tap: true },
          { from: "bot", text: isDay ? "sounds good — we’ll reach out shortly to set it up." : "sounds good — we’ll reach out first thing in the morning to set it up." },
        );
        return;
      }
      setGRow(null);
      setGSpec({});
      if (key === "ip" || key === "gs" || key === "ipad" || key === "console" || key === "macbook") {
        pushMsgs(
          { from: "user", text: label, tap: true },
          { from: "bot", text: "nice — which one is it?" },
          { from: "bot", kind: "models", group: key },
        );
      } else {
        pushMsgs({ from: "user", text: label, tap: true });
        void send("i got something else to sell too");
      }
      return;
    }
    // Handoff, asked right after the lock: local vs ship was never captured
    // on this page (every /go lead read "Handoff: TBD"), so Sonny had to text
    // just to learn which. Posts the same [DELIVERY OPTION] comm the homepage
    // funnel writes; the seller's own MEET/SHIP text reply does the same.
    if (dim === "handoff") {
      if (key === "another") {
        pushMsgs({ from: "user", text: label, tap: true }, anotherChips("nice — what else you got?"));
        return;
      }
      const lk = lastLockRef.current;
      pushMsgs({ from: "user", text: label, tap: true });
      // "put it in my box — same label" (2026-09-30). Ahead of the !lk
      // check, like ship: after a reload the restore offers both with no
      // lock from this page load — the server knows the lock anyway.
      if (key === "joinbox") {
        await joinBox();
        return;
      }
      // "my box already shipped" for a lock already ADDED to that box
      // (2026-09-30): its own label, from the same address form.
      if (key === "newlabel") {
        pushMsgs(
          { from: "bot", text: "got it — new box, new label. drop your shipping address and it prints right here." },
          { from: "bot", kind: "shipform", newLabel: true },
        );
        return;
      }
      // Ship: the label prints right here — the address form posts to
      // /api/go/label, which mints the FedEx label with the same code the
      // homepage funnel uses and texts/emails it. No "we'll text you for the
      // address" round trip (Sonny 2026-09-12). With a box open this is "my
      // box already shipped": the new label replaces it (shipDone).
      if (key === "ship") {
        const ob = openBoxRef.current;
        pushMsgs(
          { from: "bot", text: ob && !ob.coversNewest ? "got it — new box, new label. drop your shipping address and it prints right here." : "perfect — drop your shipping address and your free FedEx label prints right here." },
          { from: "bot", kind: "shipform" },
        );
        return;
      }
      if (key === "later" || !lk) {
        // "not sure yet" IS their answer for now (the team sorts it out by
        // text): "that's it for now" won't ask again, and a meetup or box
        // picked after the next lock still covers these devices.
        payDeferredRef.current = true;
        pushMsgs({ from: "bot", text: "no problem — we’ll text you and sort it out." }, anotherChips());
        return;
      }
      // One meetup for everything locked since the last choice.
      const batch = pendingLocksRef.current.length ? pendingLocksRef.current : [lk];
      const batchTotal = batch.every((b) => b.offer != null) ? batch.reduce((sum, b) => sum + (b.offer ?? 0), 0) : null;
      pendingLocksRef.current = [];
      void fetch("/api/delivery", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          method: "local",
          name: lk.name,
          ...(lk.contact.includes("@") ? { email: lk.contact } : { phone: lk.contact }),
          model: batch.map((b) => b.model).join(" + "),
          quote: batchTotal != null ? String(batchTotal) : "",
          area: "Austin area (chosen on /go)",
          session: sessionId,
        }),
      }).catch(() => {});
      pushMsgs(
        { from: "bot", text: "perfect \u2014 we\u2019ll text you to set up a time and a public spot in the austin area." },
        anotherChips(),
      );
      return;
    }
    if (!gRow) return;
    const spec = { ...gSpec, [dim]: key };
    setGSpec(spec);
    if (dim === "condition" && key === "parts") {
      partsPath(label);
      return;
    }
    // Breadcrumb per choice: the console shows what they picked, and the
    // chat brain gets the tap flow if they switch to typing.
    logNote(`chose ${dim} ${label}`);
    // Walk the model's own step list; the last answer triggers the quote.
    const idx = gRow.steps.indexOf(dim as GoStep);
    let next = idx >= 0 ? gRow.steps[idx + 1] : undefined;
    // A sealed MacBook has no battery/charger question (the homepage skips
    // it too) — answer it "ok" and move on.
    if (next === "extras" && spec.condition === "sealed") {
      spec.extras = "ok";
      setGSpec(spec);
      next = gRow.steps[idx + 2];
    }
    if (next) {
      pushMsgs({ from: "user", text: label, tap: true }, stepChips(gRow, next));
      return;
    }
    // last step answered → quote once with the full spec
    pushMsgs({ from: "user", text: label, tap: true });
    await quoteNow(gRow, spec, dim as GoStep);
  }

  // Address form result → label card (or an honest fallback). The route
  // already posted the delivery comm, the notes and the seller's text.
  function shipDone(r: ShipResult) {
    setMsgs((cur) => cur.map((m) => ("kind" in m && m.kind === "shipform" && !m.done ? { ...m, done: true } : m)));
    if (r.ok && r.tracking && r.url) {
      // A printed label is a strong intent milestone, NOT a purchase: the $0
      // "Purchase" this used to fire was the only Purchase Meta saw and it
      // flagged the dataset for it (2026-09-23). Completed trades now reach
      // Meta server-side as the real Purchase (admin status → paid / met).
      pixelTrackCustom("ShipLabel", { content_name: "fedex-label" });
      // The label covers every device locked since the last choice.
      pendingLocksRef.current = [];
      // This label is the seller's box now — a device locked next can ride
      // in it (2026-09-30). A new label while another box was open closed
      // that one server-side, so it simply replaces it here.
      openBoxRef.current = { tracking: r.tracking, url: r.url, devices: r.devices ?? [], room: r.room ?? 0, coversNewest: true };
      pushMsgs({ from: "bot", kind: "label", tracking: r.tracking, url: r.url, texted: r.texted, emailed: r.emailed, devices: r.devices, count: r.count, room: r.room }, anotherChips());
    } else {
      // The route closes an open box just before it calls FedEx, so only a
      // 502 (FedEx failed) leaves no box to join \u2014 a 429 "too many tries"
      // never got that far and the box is still open (2026-09-30, review).
      if (r.status === 502) openBoxRef.current = null;
      // Same words as the route's hint \u2014 nothing texts a label later.
      const text = r.hint || "couldn\u2019t print the label right now \u2014 your quote is saved and our team will get your label to you. You can also tap ship again in a few minutes.";
      // A withheld label (a desktop) fails the same way every time: no retry
      // (2026-09-30, review \u2014 each tap re-sent the owner alert).
      if (r.withheld) {
        pushMsgs({ from: "bot", text }, anotherChips());
        return;
      }
      // Just the retry the hint mentions, not the pay row (2026-09-30,
      // review): its meet chip read as "not sure yet" with no lock on this
      // page load. A "my box already shipped" print retries as one.
      pushMsgs(
        { from: "bot", text },
        {
          from: "bot",
          kind: "chips",
          q: "try it again in a few minutes?",
          dim: "handoff",
          options: [{ key: r.newLabel ? "newlabel" : "ship", label: "try the label again" }, { key: "another", label: "+ i have another one" }],
        },
      );
    }
  }

  // "put it in my box, same label" (2026-09-30): the newest lock (and any
  // other lock still waiting for a box) rides on the open box's label. No
  // address, no new label, no FedEx charge. The route writes the notes, the
  // Mission Control markers and the seller's text; this shows the result.
  async function joinBox() {
    setGBusy(true);
    const prev = openBoxRef.current;
    const body = { session: sessionId, ...(adoptK ? { k: adoptK } : {}) };
    // The box question again, not the pay row (2026-09-30, review): after a
    // reload that row said "your earlier box can't take this one" with no
    // join chip, and its "ship it" minted a second label.
    const retry = () => pushMsgs({ from: "bot", text: "couldn\u2019t reach us just now \u2014 tap that again for me." }, boxChips());
    try {
      const res = await fetch("/api/go/label", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...body, join: true }) });
      const d = await res.json().catch(() => null);
      const hint = typeof d?.hint === "string" && d.hint ? String(d.hint) : "";
      if (d?.ok && typeof d.tracking === "string" && typeof d.url === "string") {
        rearmSync();
        const devices = strList(d.devices);
        // What went in: the tail past the box's old list, else what this
        // page load locked, else the newest lock.
        const added = devices && prev && prev.tracking === d.tracking && devices.length > prev.devices.length
          ? devices.slice(prev.devices.length)
          : pendingLocksRef.current.length ? pendingLocksRef.current.map((p) => p.model)
          : lastLockRef.current ? [lastLockRef.current.model] : [];
        pendingLocksRef.current = [];
        payDeferredRef.current = false;
        openBoxRef.current = { tracking: d.tracking, url: d.url, devices: devices ?? prev?.devices ?? [], room: num(d.room) ?? 0, coversNewest: true };
        pushMsgs(
          { from: "bot", kind: "label", tracking: d.tracking, url: d.url, devices, count: typeof d.count === "number" ? d.count : devices?.length, joined: true, room: num(d.room) },
          { from: "bot", text: d.already ? "that one\u2019s already in your box \u2014 same label, nothing new to print." : `done \u2014 put the ${added.length ? sayDevices(added) : "new one"} in the same box, same label. nothing new to print.` },
          anotherChips(),
        );
      } else if (d?.kind === "NOT_JOINABLE" && d.reason === "labeled") {
        // This lock already has a label (another tab got there first): a
        // POST with no address hands it back (the label route's
        // existing-label shortcut runs before any address check).
        const r2 = await fetch("/api/go/label", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
        const e = await r2.json().catch(() => null);
        if (e?.ok && typeof e.tracking === "string" && typeof e.url === "string") {
          const devices = strList(e.devices);
          pendingLocksRef.current = [];
          openBoxRef.current = { tracking: e.tracking, url: e.url, devices: devices ?? [], room: num(e.room) ?? 0, coversNewest: true };
          pushMsgs(
            { from: "bot", text: "that one already has its label \u2014 here it is." },
            { from: "bot", kind: "label", tracking: e.tracking, url: e.url, devices, count: typeof e.count === "number" ? e.count : devices?.length, room: num(e.room) },
            anotherChips(),
          );
        } else if (e?.kind === "ADDRESS_INVALID") {
          // No label came back (2026-09-30, review): an /admin label for this
          // lock that can't carry the waiting box isn't handed out — this
          // box prints its own from the form.
          pushMsgs({ from: "bot", text: "drop your shipping address and your free FedEx label prints right here." }, { from: "bot", kind: "shipform" });
        } else pushMsgs({ from: "bot", text: hint || "that one already has its label." }, anotherChips());
      } else if (d?.kind === "NOT_JOINABLE" && d.reason === "no_lock") {
        pushMsgs({ from: "bot", text: hint || "lock in your quote first, then we add it to your box." });
      } else if (d?.kind === "NOT_JOINABLE" && d.reason === "chosen") {
        // Its handoff is already set (a label the team is printing — a
        // meetup no longer refuses an explicit join, 2026-09-30 review) — no
        // address form for it (2026-09-30).
        pushMsgs({ from: "bot", text: hint || "that one already has its next step set — we’ll text you about it." }, anotherChips());
      } else if (d?.kind === "NOT_JOINABLE") {
        // Not a phone, no room on that label, or the box is gone: this one
        // gets its own label, so straight to the address form.
        if (d.reason === "no_box") openBoxRef.current = null;
        pushMsgs(
          {
            from: "bot",
            text: d.reason === "no_box"
              ? "that box is closed out \u2014 this one gets its own free label. drop your shipping address below."
              : `${hint || "this one needs its own label"}. drop your shipping address and it prints right here.`,
          },
          { from: "bot", kind: "shipform" },
        );
      } else if (d?.kind === "UNBOUND") {
        // Not this browser's thread: the hint says to open the texted link.
        pushMsgs({ from: "bot", text: hint || "open the link from your text to add it to your box." }, boxChips());
      } else retry();
    } catch {
      retry();
    }
    setGBusy(false);
  }

  // One field, one tap. The attestation rides in the button label ("I'm 18+
  // and it's mine to sell") — tapping IS the affirmation, recorded server-side
  // as [ATTEST: yes] exactly as before; the checkbox and the optional name
  // field were two extra taps at the one moment we have their attention.
  async function guidedLock(gContact: string, manualFlavor: boolean, gName = ""): Promise<string | null> {
    if (!gRow) return "something went sideways — tap your phone again";
    const c = gContact.trim();
    if (!c) return "we need a number or email to reach you";
    // Same rule as the lock route (2026-09-27): a seller with a quote on
    // screen was refused four times in two minutes and left — the server's
    // "real phone or email" line gave them nothing to fix. Say what's short.
    const digits = c.replace(/\D/g, "");
    const looksEmail = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(c);
    const looksPhone = digits.length === 10 || (digits.length === 11 && digits.startsWith("1")) || (c.startsWith("+") && digits.length >= 11 && digits.length <= 15);
    if (!looksEmail && !looksPhone) {
      if (c.includes("@")) return "that email looks incomplete — name@example.com";
      if (digits.length > 0 && digits.length < 10) return `that's ${digits.length} digits — we need all 10, area code first`;
      return "we need a phone number (10 digits, area code first) or an email";
    }
    setGBusy(true);
    // Per-lock dedup id, shared with the server: the pixel Lead and the
    // Conversions API Lead carry the SAME event id, so Meta keeps one copy.
    // Per-lock (not per-session) because "got another one?" means a session
    // can lock several devices, each its own conversion.
    // Stable per LOCK FORM (2026-09-26), not per tap: a retap after a lost
    // response carries the same id, so the server answers with the lock it
    // already wrote instead of writing another. The per-load nonce keeps it
    // unique across reloads.
    const formMsg = [...msgs].reverse().find((m) => "kind" in m && m.kind === "lockform" && !m.done);
    const lockEventId = `lock-${sessionId}-${loadNonce.current}${formMsg ? keyOf(formMsg) : Date.now().toString(36)}`;
    // The number on the seller's screen. The server refuses to write a lead
    // when the engine disagrees (moved:true) — a mid-session price edit can
    // never lock a figure they haven't seen, and never double-posts a lead.
    const shown = [...msgs].reverse().find((m): m is Extract<Msg, { kind: "quote" }> => "kind" in m && m.kind === "quote" && !m.done);
    const quotedOffer = !manualFlavor && shown ? shown.offer : null;
    const { fbp, fbc } = fbCookies();
    try {
      const res = await fetch("/api/go/lock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: gRow.id,
          storage: gSpec.storage ?? gRow.storages[0] ?? gRow.bestStorage,
          // "parts" isn't an engine tier — send the broken tier for the
          // resolver plus the flag; the server writes the lead with no
          // number and the hand-quote condition.
          condition: gSpec.condition === "parts" ? "broken" : (gSpec.condition ?? "good"),
          parts: gSpec.condition === "parts",
          carrier: gSpec.carrier ?? (gRow.cat === "phone" ? "unlocked" : undefined),
          // `opt` only for the categories that have one — a phone body with
          // opt:"na" was rejected as "bad spec" (review 2026-09-11).
          opt: gRow.cat === "ipad" ? (gSpec.connectivity ?? "wifi") : gRow.cat === "console" ? (gSpec.disc ?? "na") : undefined,
          processor: gSpec.processor,
          memory: gSpec.memory,
          extras: gSpec.extras ?? "ok",
          // Optional, Sonny 2026-09-12 ("capture name or make optional with
          // the phone number at the end — a nice touch"); FedEx needs it
          // for a label, so the ship form pre-fills from here.
          name: gName.trim().slice(0, 80),
          contact: c,
          attest: true,
          src,
          landed,
          sessionId,
          // The texted link's proof rides along like it does on the label
          // and e-mail posts: a webview that dropped the owner cookie still
          // locks INTO its thread instead of a detached lead (2026-09-27).
          ...(adoptK ? { k: adoptK } : {}),
          eventId: lockEventId,
          quotedOffer,
          fbp,
          fbc,
        }),
      });
      const d = await res.json();
      setGBusy(false);
      rearmSync();
      if (d?.ok) {
        const offer: number | null = typeof d.offer === "number" ? d.offer : null;
        lastLockRef.current = { model: quoteLabel(gRow, gSpec.storage ?? gRow.storages[0]), contact: c, offer, name: gName.trim() };
        pendingLocksRef.current = [...pendingLocksRef.current, lastLockRef.current];
        payDeferredRef.current = false;
        // A new lock is never on the existing label yet — payChips below
        // offers the box (2026-09-30).
        if (openBoxRef.current) openBoxRef.current = { ...openBoxRef.current, coversNewest: false };
        pixelTrack("Lead", { content_name: gRow.label, value: offer ?? 0, currency: "USD" }, lockEventId);
        // (the LOCKED breadcrumb + the confirmation text are server-side)
        // Peak trust: they just saw a real number and handed over a way to
        // reach them. Ask how they want to get paid HERE — the same row
        // carries "+ i have another one", and "got another one?" follows
        // whichever pay method they pick.
        pushMsgs(
          {
            from: "bot",
            kind: "locked",
            offer: offer != null && !manualFlavor ? offer : null,
            until: typeof d.lockUntil === "string" ? d.lockUntil : undefined,
            confirmed: d.confirmed === "sms" || d.confirmed === "email" || d.confirmed === "failed" ? d.confirmed : "pending",
            contact: c,
          },
          payChips(),
        );
        return null;
      }
      if (d?.moved && typeof d.offer === "number") {
        const live: number = d.offer;
        // (the "price moved at lock" note + the live quote note are written
        // server-side by the lock route)
        setMsgs((cur) => cur.map((m) => ("kind" in m && m.kind === "quote" && !m.done ? { ...m, offer: live } : m)));
        return `the live number is $${live.toLocaleString("en-US")} — tap again to lock that`;
      }
      return d?.error || "that didn\u2019t go through — try again";
    } catch {
      setGBusy(false);
      return "that didn\u2019t go through — try again";
    }
  }

  async function send(text: string) {
    const t = text.trim();
    // Block while a photo batch uploads: the in-flight bubbles still hold
    // IMG::blob: local URLs, and a text send would snapshot those into history
    // as junk the model can't read.
    if (!t || sending || uploading) return;
    interactedRef.current = true;
    touchSession(sessionId);
    // The server keeps the newest 40 turns; sending the whole thread was
    // several KB of mobile uplink per message on a long chat, for nothing.
    const history = historyFor(msgs).slice(-40);
    // Stamped on both attempts below: the server answers a repeat of the same
    // id with the first run's reply instead of running the turn twice.
    const turnId = `${sessionId}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
    setMsgs((m) => [...m, { from: "user", text: t }]);
    setSending(true);
    try {
      // One silent retry: a dropped webview fetch used to swallow the turn
      // entirely — the seller saw an error bubble, the store never got their
      // message, and Sonny priced from a thread with a hole in it.
      let res: Response;
      try {
        res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: t, history, sessionId, src, landed, turnId, ...fbCookies() }),
          signal: chatTimeout(),
        });
      } catch (e) {
        // A timed-out turn may still be running server-side — resending it
        // would store the message twice. Only a dropped connection retries.
        const errName = (e as { name?: unknown } | null)?.name;
        if (errName === "TimeoutError" || errName === "AbortError") throw e;
        await new Promise((r) => setTimeout(r, 900));
        res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: t, history, sessionId, src, landed, turnId, ...fbCookies() }),
          signal: chatTimeout(),
        });
      }
      const d = await res.json();
      rearmSync();
      // Close-signal tracking for the nudges: an engine number was named /
      // a contact landed.
      if (Array.isArray(d?.quoted) && d.quoted.length) setAiQuoted(true);
      // contactOnFile covers a number given earlier in the session (or via the
      // lock): leadCaptured only fires the FIRST time, so a returning or
      // already-captured seller kept seeing the number asks.
      if (d?.leadCaptured || d?.contactOnFile) setContactCaptured(true);
      // A typed contact IS a lead — the server already routed it to MC and
      // Sonny's phone. Report it to Meta too, or the campaign only ever
      // learns from iPhone/Samsung carousel lockers and stops showing the ad
      // to MacBook / iPad / console / lot sellers. Server fires this once per
      // session (the turn a contact first appears).
      if (d?.leadCaptured) {
        // chatlead-<sessionId> matches the server's CAPI event id — the chat
        // lead fires once per session, so the session id alone is the key.
        pixelTrack("Lead", {
          content_name: "chat",
          content_category: "chat",
          ...(typeof d.leadValue === "number" ? { value: d.leadValue, currency: "USD" } : {}),
        }, `chatlead-${sessionId}`);
      }
      // Owner takeover: the AI stood down and Sonny answers via chat-sync —
      // no bot bubble, his reply arrives on the next poll. Also suppress a
      // bot reply that was already in flight when the takeover flipped.
      // The server is authoritative: a real reply means the bot answered
      // (including after it expired a stale takeover) — render it and clear
      // the live banner. The bot-reply-raced-by-takeover case is already
      // handled server-side (the post-generation recheck discards it).
      if (d?.takeover && !d?.reply) setTakeover(true);
      else {
        if (takeoverRef.current) setTakeover(false);
        // The server decides when a typed "i wanna ship" opens the address
        // form (locked quote, no label yet) or re-shows an issued label —
        // it is the only side that can read the session's own notes.
        // A chat-path engine quote on a phone the board knows gets the same
        // quote card + lock form the chip flow shows (review 2026-09-23: chat-
        // quoted sellers — $955 17 Pro Max, $440 15 Pro Max — had no way to
        // lock, so no confirmation and no label).
        const qs = d?.quoteSpec as { model?: string; storage?: string; condition?: string; carrier?: string; offer?: number } | undefined;
        // The server only sends quoteSpec for a device not already locked in
        // this session, so device #2 priced in chat after a lock gets its own
        // card + lock form while re-asking about #1 doesn't re-offer it.
        const qRow = qs && typeof qs.offer === "number" ? rows.find((x) => x.id === qs.model && x.cat === "phone") : undefined;
        if (qRow && qs) {
          setGRow(qRow);
          setGSpec({ storage: qs.storage, condition: qs.condition, carrier: qs.carrier });
        }
        const lockExtra: Msg[] = qRow && qs
          ? [{ from: "bot", kind: "quote", label: quoteLabel(qRow, String(qs.storage || qRow.storages[0] || "")), offer: qs.offer as number }, { from: "bot", kind: "lockform", manual: false }]
          : [];
        // "xbox series x" / "ipad" / "macbook" typed on this page: the server
        // says which tile picker to open under the reply.
        const catGroup = d?.widget === "category" ? CATEGORIES.find((c) => c.deterministic === d?.group) : undefined;
        if (catGroup) setTimeout(() => categoryTap(catGroup), 0);
        // The label card carries what the label covers, and "joinbox" (a
        // lock not on the existing label yet) shows that label plus the box
        // question (2026-09-30). devices/count under label.* / box.* or
        // top-level — whichever the chat route sends.
        const cnt = (v: unknown) => (typeof v === "number" && v > 0 ? v : undefined);
        const wl = d?.widget === "label" && d?.label?.tracking && d?.label?.url
          ? { tracking: String(d.label.tracking), url: String(d.label.url), devices: strList(d.label.devices) ?? strList(d.devices), count: cnt(d.label.count) ?? cnt(d.count), room: num(d.label.room), joined: d.label.joined === true }
          : null;
        const jb = d?.widget === "joinbox" && d?.box?.tracking && d?.box?.url
          ? { tracking: String(d.box.tracking), url: String(d.box.url), devices: strList(d.box.devices) ?? strList(d.devices), count: cnt(d.box.count) ?? cnt(d.count), room: num(d.box.room) }
          : null;
        const known = openBoxRef.current;
        if (wl) openBoxRef.current = { tracking: wl.tracking, url: wl.url, devices: wl.devices ?? (known?.tracking === wl.tracking ? known.devices : []), room: wl.room ?? 0, coversNewest: true };
        // ask: the server just found the newest lock joinable (2026-09-30).
        if (jb) openBoxRef.current = { tracking: jb.tracking, url: jb.url, devices: jb.devices ?? (known?.tracking === jb.tracking ? known.devices : []), room: jb.room ?? 0, coversNewest: false, ask: true };
        const extra: Msg[] =
          // newLabel: an older server's "that box already shipped" form
          // (2026-09-30); the chat now sends the joined label card instead.
          d?.widget === "shipform" ? [{ from: "bot", kind: "shipform", ...(d?.newLabel === true ? { newLabel: true } : {}) }]
          // A joined lock's card gets its "my box already shipped — new
          // label" button, as the restore does (2026-09-30, review: the card
          // said "same box" under a reply about a shipped box).
          : wl ? [{ from: "bot", kind: "label", ...wl }, ...(wl.joined ? [newLabelChips()] : [])]
          : jb ? [{ from: "bot", kind: "label", ...jb }, boxChips(typeof d?.device === "string" ? d.device : undefined)]
          : [];
        // The reply's stored ts (server, 2026-09-26) keys it like a poll
        // record: a poll that already showed this reply doesn't get a twin,
        // and the next poll won't re-add it.
        const replyKey = typeof d?.replyTs === "number" && typeof d?.reply === "string" ? `${d.replyTs}|${d.reply}` : "";
        const shown = !!replyKey && seenSyncRef.current.has(replyKey);
        if (replyKey) seenSyncRef.current.add(replyKey);
        // The box question supersedes a pay row still up — its plain "ship
        // it" chip would open the form for a second label.
        const retire = (x: Msg): Msg => (jb && "kind" in x && x.kind === "chips" && x.dim === "handoff" && !x.done ? { ...x, done: true } : x);
        setMsgs((m) => [...m.map(retire), ...(shown ? [] : [{ from: "bot" as const, text: d?.reply || "hang on — try that again in a sec" }]), ...lockExtra, ...extra]);
      }
    } catch {
      // kind:"err" keeps this local-only bubble OUT of the history sent to
      // the model, and the breadcrumb lets the console see the gap.
      logNote(`client send failed: ${t.slice(0, 80)}`);
      setMsgs((m) => [...m, { from: "bot", kind: "err", text: "we're having a moment — try that again, or tap your phone above and we'll price it." }]);
    }
    setSending(false);
  }

  // Downscale on-device before upload: phone camera shots run 3-12MB and
  // Vercel cuts request bodies at ~4.5MB — 1600px JPEG q0.82 lands ~200-500KB
  // and uploads fast on cell data. Falls back to the original file when the
  // browser can't decode (rare formats); the server still enforces its cap.
  async function downscalePhoto(file: File): Promise<Blob> {
    try {
      // imageOrientation:"from-image" bakes EXIF rotation into the pixels so a
      // portrait phone shot doesn't upload sideways (canvas re-encode drops the
      // EXIF tag, which would otherwise leave it rotated for Theot + Sonny).
      const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
      const scale = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
      const w = Math.max(1, Math.round(bmp.width * scale));
      const h = Math.max(1, Math.round(bmp.height * scale));
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) return file;
      ctx.drawImage(bmp, 0, 0, w, h);
      bmp.close();
      const out = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/jpeg", 0.82));
      return out && out.size > 0 ? out : file;
    } catch {
      return file;
    }
  }

  // Photo message flow, MULTI-photo native (sellers send several angles, or
  // one shot per phone in a lot): every picked file gets its own optimistic
  // local-preview bubble, uploads run one at a time (order preserved, no
  // burst against the rate limit), each swaps in its real URL — then ONE
  // /api/chat turn covers the whole batch, so Theot reacts once to all the
  // photos instead of narrating each. During owner takeover the bot stays
  // silent and Sonny sees the photos in the console instead.
  async function sendPhotos(files: File[]) {
    // `sending` too: a photo turn and a text turn share the typing dots and
    // the composer lock — two in flight cleared the dots early and appended
    // the two replies in completion order.
    if (uploading || sending || files.length === 0) return;
    interactedRef.current = true;
    touchSession(sessionId);
    const MAX_BATCH = 6;
    const batch = files.slice(0, MAX_BATCH); // per-pick cap; they can attach again
    const history = historyFor(msgs).slice(-40);
    // A number is ACTIVELY on screen (un-retired guided quote/lock card) — a
    // photo must NOT trigger an AI reply that could name a DIFFERENT number
    // under it (the two-numbers bait-and-switch this page exists to avoid).
    // The photo still uploads, pings Sonny, and is stored; we just don't run
    // the model turn. Done/locked cards don't count: after a lock, the next
    // device's photos need the AI turn again — the suppression used to be
    // forever-sticky and muted every photo after any lock.
    const quoteOnScreen = msgs.some((m) => "kind" in m && (m.kind === "quote" || m.kind === "lockform") && !m.done);
    const locals = batch.map((f) => URL.createObjectURL(f));
    // The local preview STAYS on the bubble after the upload: swapping the
    // <img> to the CDN URL re-downloaded the 200-500 KB photo the seller had
    // just sent (on cell data) and the bubble flashed blank, shifting the
    // thread, while it loaded.
    setMsgs((m) => [...m, ...locals.map((u) => ({ from: "user" as const, text: `IMG::${u}`, preview: u, pending: true as const }))]);
    setUploading(true);
    const uploaded: string[] = [];
    for (let i = 0; i < batch.length; i++) {
      const localUrl = locals[i];
      try {
        const jpg = await downscalePhoto(batch[i]);
        const fd = new FormData();
        fd.append("session", sessionId);
        fd.append("file", jpg, "photo.jpg");
        const r = await fetch("/api/go/upload", { method: "POST", body: fd });
        const d = await r.json().catch(() => null);
        if (r.ok && d?.ok && typeof d.url === "string") {
          const url: string = d.url;
          uploaded.push(url);
          setMsgs((cur) => cur.map((m) => {
            if ("kind" in m || m.text !== `IMG::${localUrl}`) return m;
            const { pending: _done, ...rest } = m;
            void _done;
            return { ...rest, text: `IMG::${url}` }; // preview kept; the CDN url is what history and the store carry
          }));
        } else {
          URL.revokeObjectURL(localUrl); // bubble removed below — free the original File
          // Drop the failed preview and add a bot-styled error (NOT a fake
          // user bubble — that read as the seller's own text and rode history).
          setMsgs((cur) => [
            ...cur.filter((m) => !(!("kind" in m) && m.text === `IMG::${localUrl}`)),
            { from: "bot", text: photoError(d?.error, r.status) },
          ]);
        }
      } catch {
        URL.revokeObjectURL(localUrl);
        setMsgs((cur) => [
          ...cur.filter((m) => !(!("kind" in m) && m.text === `IMG::${localUrl}`)),
          { from: "bot", text: "that photo didn’t go through — try again." },
        ]);
      }
    }
    if (batch.length < files.length) {
      setMsgs((m) => [...m, { from: "bot", text: `got the first ${MAX_BATCH} — tap the camera again to send the rest.` }]);
    }
    // Re-enable the composer as soon as uploads finish — before the (possibly
    // slow) model turn — so the next batch isn't blocked by generation.
    setUploading(false);
    if (uploaded.length && !takeoverRef.current) {
      if (quoteOnScreen) {
        setMsgs((m) => [...m, { from: "bot", text: uploaded.length > 1 ? "got the pics — we’ll factor them into your offer." : "got the pic — we’ll factor it into your offer." }]);
        return;
      }
      // One bot turn for the batch: earlier photos ride in as history (the
      // server turns recent IMG:: entries into vision blocks), the last one
      // is the message itself.
      const last = uploaded[uploaded.length - 1];
      const batchHistory = [...history, ...uploaded.slice(0, -1).map((u) => ({ from: "user", text: `IMG::${u}` }))];
      setSending(true);
      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: `IMG::${last}`, history: batchHistory, sessionId, src, landed, ...fbCookies() }),
          signal: chatTimeout(),
        });
        const dd = await res.json();
        rearmSync();
        if (Array.isArray(dd?.quoted) && dd.quoted.length) setAiQuoted(true);
        if (dd?.contactOnFile) setContactCaptured(true);
        if (dd?.leadCaptured) {
          setContactCaptured(true);
          // Same browser-side Lead the typed path fires — a photo-sender
          // whose contact landed on this turn was previously CAPI-only.
          pixelTrack("Lead", { content_name: "chat", content_category: "chat", ...(typeof dd.leadValue === "number" ? { value: dd.leadValue, currency: "USD" } : {}) }, `chatlead-${sessionId}`);
        }
        if (dd?.takeover && !dd?.reply) setTakeover(true);
        else if (dd?.reply) {
          if (takeoverRef.current) setTakeover(false);
          // Same echo/poll dedupe as the typed path (2026-09-26).
          const replyKey = typeof dd?.replyTs === "number" ? `${dd.replyTs}|${dd.reply}` : "";
          const shown = !!replyKey && seenSyncRef.current.has(replyKey);
          if (replyKey) seenSyncRef.current.add(replyKey);
          if (!shown) setMsgs((m) => [...m, { from: "bot", text: dd.reply }]);
        }
      } catch { /* photos are stored + surfaced either way */ }
      setSending(false);
    }
  }

  // Turn an upload error into seller-friendly copy. The killer case is HEIF
  // (Samsung "high efficiency" in Chrome/webview isn't auto-transcoded) — a
  // screenshot is always JPEG/PNG, so that's the universal rescue.
  function photoError(serverErr: unknown, status: number): string {
    const e = String(serverErr || "");
    if (status === 429) return "one sec — sending those a little fast. try that photo again in a moment.";
    if (/photos only|isn't a photo/i.test(e)) return "that photo format didn’t go through — screenshot it and send the screenshot instead.";
    if (/too large/i.test(e)) return "that photo was too big — try again and it’ll compress it.";
    return "that photo didn’t go through — try again.";
  }

  // The chat overlay is shared by both modes; only the first paint differs.
  const overlayEl = (
    <>
  {/* full-screen immersive chat */}
  {chatOpen && (
    // overscroll none (2026-09-30): nothing inside may hand a drag on to the page
    <div ref={overlayRef} tabIndex={-1} style={{ background: "#0a0a0b", overscrollBehavior: "none" }} className="go-overlay fixed inset-0 z-50 flex flex-col text-white focus:outline-none" role="dialog" aria-modal="true" aria-label="chat with top cash cellular">
      <header className="flex items-center gap-3 px-4 py-3 border-b border-white/10" style={{ background: "#0e0e0f", paddingTop: "max(12px, env(safe-area-inset-top))" }}>
        <img src="/icon-192.png" alt="" width={36} height={36} style={{ borderRadius: "50%" }} className="w-[36px] h-[36px] object-cover border border-[#00c853]/40 shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="text-[16px] font-semibold leading-tight">top cash <span className="text-[#00c853]">cellular</span></div>
          <div className="text-[12px] leading-tight">
            {takeover
              ? <span className="text-[#00c853] font-semibold">Sonny is with you — live</span>
              : <span className="text-white/45">{status || "quotes live 24/7"}</span>}
          </div>
        </div>
        <button type="button" onClick={closeChat} aria-label="close chat" className="w-[38px] h-[38px] rounded-full border border-white/15 text-white/70 text-[19px] flex items-center justify-center active:scale-95">
          ✕
        </button>
      </header>

      <div
        ref={threadRef}
        role="log"
        aria-live="polite"
        className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3"
        // contain (2026-09-30): a fling that hits the top or bottom stops
        // here instead of chaining into the page behind (the keyboard-up jump)
        style={{ overscrollBehavior: "contain" }}
        // A form field inside the thread has focus → the quote bar steps
        // aside (see threadFieldFocus). focus/blur bubble in React.
        onFocus={(e) => { if (/^(INPUT|TEXTAREA|SELECT)$/.test((e.target as HTMLElement).tagName)) setThreadFieldFocus(true); }}
        onBlur={(e) => {
          const next = e.relatedTarget as HTMLElement | null;
          if (!next || !e.currentTarget.contains(next) || !/^(INPUT|TEXTAREA|SELECT)$/.test(next.tagName)) setThreadFieldFocus(false);
        }}
        onScroll={(e) => {
          const el = e.currentTarget;
          const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
          const up = el.scrollTop < lastScrollTopRef.current - 1;
          lastScrollTopRef.current = el.scrollTop;
          if (up) nearBottomRef.current = distance < 120;      // reading back: follow only while still at the bottom
          else if (distance < 120) nearBottomRef.current = true; // reached the bottom — by hand or by our own scroll
        }}
      >
        <div className="go-msg flex items-end gap-2">
          <img src="/icon-192.png" alt="" width={30} height={30} style={{ borderRadius: "50%" }} className="w-[30px] h-[30px] object-cover border border-[#00c853]/40 shrink-0" />
          <div className="max-w-[85%] rounded-2xl rounded-bl-md px-4 py-3 text-[15px] bg-white/[0.06] border border-white/10 leading-snug">
            {lot
              ? "welcome — tell us what you got. trays, shelves, mixed lots, cracked ones too. snap a pic of the pile if it\u2019s easier. we\u2019ll get you real numbers and cash the same day."
              : "tap what you got — or just type it. one phone or a whole drawer. cracked or still on payments, we still buy it. you can also tap 📷 to send a photo."}
          </div>
        </div>

        {/* category quick-select — the funnel front door, in-thread */}
        {!threadStarted && (
          <div className="go-msg ml-10 grid grid-cols-3 gap-2">
            {CATEGORIES.map((c) => (
              <button key={c.key} type="button" disabled={gBusy} onClick={() => categoryTap(c)}
                className="rounded-2xl border border-white/10 bg-white/[0.06] p-2 text-center active:scale-95 transition-transform">
                <span className="rounded-xl bg-white flex items-center justify-center mx-auto" style={{ height: 62 }}>
                  <img src={c.img} alt="" className="max-h-[54px] max-w-[80%] object-contain" />
                </span>
                <span className="block text-[13px] font-semibold mt-1.5 text-white">{c.label}</span>
              </button>
            ))}
          </div>
        )}

        {msgs.map((m, i) => {
          if (!("kind" in m)) {
            // IMG::<url> = a photo message. Only render our own optimistic
            // blob: preview or a validated blob-store URL as an <img> — a
            // restored/forged IMG:: pointing elsewhere renders as text, not
            // an external beacon.
            const raw = m.text.startsWith("IMG::") ? m.text.slice(5) : null;
            // The local preview wins while we have it (no re-download of the
            // photo just uploaded); a restored bubble shows the store copy.
            const img = m.preview || (raw && (raw.startsWith("blob:") || /^https:\/\/[a-z0-9]+\.public\.blob\.vercel-storage\.com\/gochat-img\//i.test(raw)) ? raw : null);
            const body = img ? (
              <span className="relative block">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={img} alt="device photo" className="block max-w-full rounded-xl" style={{ maxHeight: 260 }} />
                {m.pending && (
                  <span className="absolute bottom-1.5 right-2 rounded-full bg-black/55 px-2 py-[2px] text-[11px] text-white/85">sending…</span>
                )}
              </span>
            ) : (
              m.text
            );
            const pad = img ? "p-1.5" : "px-4 py-3";
            if (m.from === "owner") {
              // Sonny live — visually distinct from the bot on purpose:
              // the seller must always know when a human took over.
              return (
                <div key={keyOf(m)} className="go-msg flex items-end gap-2">
                  <img src={OWNER_PHOTO || "/icon-192.png"} alt="" width={30} height={30} style={{ borderRadius: "50%" }} className="w-[30px] h-[30px] object-cover border-2 border-[#00c853] shrink-0" />
                  <div className="max-w-[85%]">
                    <div className="text-[12px] text-[#00c853] font-semibold mb-1 ml-1">Sonny · owner</div>
                    <div className={`rounded-2xl rounded-bl-md ${pad} text-[15px] bg-[#0f2417] border border-[#00c853]/50`}>
                      {body}
                    </div>
                  </div>
                </div>
              );
            }
            return m.from === "user" ? (
              <div key={keyOf(m)} className="go-msg flex items-end gap-2 justify-end">
                <div className={`max-w-[80%] rounded-2xl rounded-br-md ${pad} text-[15px] bg-[#132018] border border-[#00c853]/30`}>
                  {body}
                </div>
                <SellerAvatar />
              </div>
            ) : (
              <div key={keyOf(m)} className="go-msg flex items-end gap-2">
                <img src="/icon-192.png" alt="" width={30} height={30} style={{ borderRadius: "50%" }} className="w-[30px] h-[30px] object-cover border border-[#00c853]/40 shrink-0" />
                <div className={`max-w-[85%] rounded-2xl rounded-bl-md ${pad} text-[15px] bg-white/[0.06] border border-white/10`}>
                  {body}
                </div>
              </div>
            );
          }
          if (m.kind === "err") {
            // Local-only error bubble — bot-styled, never sent as history.
            return (
              <div key={keyOf(m)} className="go-msg flex items-end gap-2">
                <img src="/icon-192.png" alt="" width={30} height={30} style={{ borderRadius: "50%" }} className="w-[30px] h-[30px] object-cover border border-[#00c853]/40 shrink-0" />
                <div className="max-w-[85%] rounded-2xl rounded-bl-md px-4 py-3 text-[15px] bg-white/[0.06] border border-white/10">
                  {m.text}
                </div>
              </div>
            );
          }
          if (m.kind === "models") {
            return (
              <div key={keyOf(m)} className={"go-msg ml-10 " + (m.done ? "opacity-40 pointer-events-none" : "")}>
                <ModelPicker
                  rows={rowsFor(rows, m.group)}
                  line={m.line}
                  onLine={(key, label) => {
                    if (gBusy) return;
                    interactedRef.current = true;
                    logNote(`picked line ${label}`);
                    pushMsgs(
                      { from: "user", text: label, tap: true },
                      { from: "bot", kind: "models", group: m.group, line: key },
                    );
                  }}
                  onPick={deviceTap}
                  onOther={() => {
                    pushMsgs(
                      { from: "user", text: "i don’t see mine" },
                      { from: "bot", text: "all good — type what you got (model + anything you know) and we’ll get you a number." },
                    );
                  }}
                  busy={gBusy || !!m.done}
                />
              </div>
            );
          }
          if (m.kind === "numberform") {
            return (
              <div key={keyOf(m)} className={"go-msg ml-10 " + (m.done ? "opacity-40 pointer-events-none" : "")}>
                <NumberForm
                  disabled={!!m.done}
                  onSave={(v) => {
                    setMsgs((cur) => cur.map((x) => ("kind" in x && x.kind === "numberform" ? { ...x, done: true } : x)));
                    void send(v);
                  }}
                />
              </div>
            );
          }
          if (m.kind === "chips") {
            return (
              <div key={keyOf(m)} className={"go-msg ml-10 " + (m.done ? "opacity-40 pointer-events-none" : "")}>
                {m.q && <div className="text-[14px] text-white/60 mb-2">{m.q}</div>}
                <div className="flex flex-wrap gap-2">
                  {m.options.map((o) => (
                    <button key={o.key} type="button" disabled={!!m.done || gBusy}
                      onClick={() => void chipTap(m.dim, o.key, o.label)}
                      className="text-[14px] text-white/85 border border-[#00c853]/35 rounded-full px-4 py-[10px] active:scale-95 transition-transform">
                      {o.label}
                    </button>
                  ))}
                </div>
              </div>
            );
          }
          if (m.kind === "quote") {
            return (
              <div key={keyOf(m)} className="go-msg flex items-end gap-2">
                <img src="/icon-192.png" alt="" width={30} height={30} style={{ borderRadius: "50%" }} className="w-[30px] h-[30px] object-cover border border-[#00c853]/40 shrink-0" />
                <div className="max-w-[85%] rounded-2xl rounded-bl-md px-4 py-3 bg-white/[0.06] border border-[#00c853]/30">
                  <div className="text-[14px] text-white/60">{m.label}</div>
                  <div className="text-[32px] font-extrabold text-[#00c853]" style={{ fontVariantNumeric: "tabular-nums" }}>${m.offer.toLocaleString("en-US")}</div>
                  {m.note && <div className="text-[13px] text-[#00c853]/90 mt-1">{m.note}</div>}
                  <div className="text-[13px] text-white/60 mt-1">that&rsquo;s your number if it matches what you told us — locked for 14 days. drop your number below and we&rsquo;ll text it to you.</div>
                </div>
              </div>
            );
          }
          if (m.kind === "lockform") {
            return (
              <div key={keyOf(m)} className={"go-msg ml-10 max-w-[85%] " + (m.done ? "opacity-40 pointer-events-none" : "")}>
                <LockForm manual={m.manual} disabled={!!m.done} onLock={(c, n) => guidedLock(c, m.manual, n)} defaultContact={lastLockRef.current?.contact || ""} defaultName={lastLockRef.current?.name || ""} />
              </div>
            );
          }
          if (m.kind === "shipform") {
            const lk = lastLockRef.current;
            return (
              <div key={keyOf(m)} className={"go-msg ml-10 max-w-[92%] " + (m.done ? "opacity-40 pointer-events-none" : "")}>
                <ShipForm
                  sessionId={sessionId}
                  adoptK={adoptK}
                  defaultName={lk?.name || ""}
                  defaultPhone={lk && !lk.contact.includes("@") ? lk.contact : ""}
                  disabled={!!m.done}
                  newLabel={m.newLabel === true}
                  onDone={shipDone}
                />
              </div>
            );
          }
          if (m.kind === "label") {
            // What the label covers and how to pack it (2026-09-30): the card
            // said "box the device" over a label that covered two phones, and
            // nothing told the seller a third one could ride along.
            const n = m.count ?? m.devices?.length ?? 0;
            const packing = n > 1
              ? `put all ${n} in one box (wrap each one so the screens don’t touch)`
              : m.joined ? "put it in the same box" : "box the device";
            return (
              <div key={keyOf(m)} className="go-msg ml-10 max-w-[85%]">
                <div className="rounded-2xl border border-[#00c853]/40 bg-[#00c853]/[0.08] px-4 py-3">
                  <div className="text-[15px] font-bold text-white">{m.joined ? "added to your box — same label" : "your FedEx label is ready"}</div>
                  <div className="text-[13px] text-white/70 mt-1" style={{ fontVariantNumeric: "tabular-nums" }}>tracking {m.tracking}</div>
                  {m.devices && m.devices.length > 0 && (
                    <div className="text-[13px] text-white/80 mt-2">
                      <div className="text-white/55">{m.devices.length > 1 ? `covers all ${m.devices.length}:` : "covers:"}</div>
                      <ul className="mt-0.5 leading-snug">
                        {m.devices.map((dv, j) => <li key={j}>{"· "}{dv}</li>)}
                      </ul>
                    </div>
                  )}
                  <a href={m.url} target="_blank" rel="noopener noreferrer" className="tcc-button-primary mt-3 inline-block py-2.5 px-5 text-[15px] font-bold rounded-2xl">open my label</a>
                  <div className="text-[13px] text-white/60 mt-3 leading-snug">{m.joined ? "nothing new to print — " : "print it, "}{packing}, drop it at any FedEx location. we&rsquo;ll text you when it&rsquo;s checked in at our warehouse and pay within 24 hours of inspection. {m.texted ? "we texted you this link too." : m.emailed ? "we emailed you this link too." : "this link stays right here in the chat."}</div>
                  {/* Only while the label has room for another phone
                      (the route's go-box boxRoom — none on a laptop or
                      console label, none on a full box). */}
                  {(m.room ?? 0) > 0 && (
                    <div className="text-[12px] text-white/45 mt-2 leading-snug">more phones? they can go in this same box &mdash; lock them in here first so we price them.</div>
                  )}
                </div>
              </div>
            );
          }
          if (m.kind === "msgr") {
            return (
              <div key={keyOf(m)} className="go-msg ml-10 max-w-[85%]">
                <a
                  href={`https://m.me/${MSGR_HANDLE}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2.5 rounded-2xl border border-white/15 bg-white/[0.06] px-4 py-3 active:scale-[0.98] transition-transform"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" className="text-[#00c853] shrink-0" aria-hidden>
                    <path d="M12 2C6.5 2 2 6.14 2 11.25c0 2.9 1.45 5.49 3.72 7.18V22l3.4-1.87c.91.25 1.87.39 2.88.39 5.5 0 10-4.14 10-9.27S17.5 2 12 2zm1.06 12.47-2.55-2.72-4.98 2.72 5.48-5.82 2.61 2.72 4.92-2.72-5.48 5.82z" />
                  </svg>
                  <span className="text-[14px] text-white/85 leading-snug">
                    <span className="font-semibold text-white">keep this chat on Messenger</span>
                    <span className="block text-white/55 text-[13px]">message us there and your quote follows you</span>
                  </span>
                </a>
              </div>
            );
          }
          if (m.kind === "locked") {
            return (
              <div key={keyOf(m)} className="go-msg flex items-end gap-2">
                <img src="/icon-192.png" alt="" width={30} height={30} style={{ borderRadius: "50%" }} className="w-[30px] h-[30px] object-cover border border-[#00c853]/40 shrink-0" />
                <div className="max-w-[85%] rounded-2xl rounded-bl-md px-4 py-3 bg-white/[0.06] border border-[#00c853]/40">
                  <div className="text-[16px] font-semibold text-[#00c853]">
                    locked in{m.offer != null ? ` — $${m.offer.toLocaleString("en-US")}` : ""}.
                    {m.until && (
                      <span className="text-white/60 font-normal"> holds until {new Date(m.until).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "America/Chicago" })}.</span>
                    )}
                  </div>
                  <div className="text-[14px] text-white/70 mt-1">{m.confirmed === "sms" ? "we just texted you the details. " : m.confirmed === "email" ? "we just emailed you the details. " : m.confirmed === "pending" ? "we\u2019ll text you the details shortly. " : m.confirmed === "failed" && m.contact && !m.contact.includes("@") ? "our texts aren\u2019t going through right now \u2014 drop an email below and we\u2019ll send the details there. " : ""}{isDay ? "we\u2019ll reach out shortly to get you paid" : "we\u2019ll reach out first thing in the morning to get you paid"} — meet up in the austin area or we send a free shipping label, your pick.</div>
                  {/* The text failed (relay down / opted out): one email field,
                      newest lock only, and the card flips to "emailed" on success. */}
                  {m.confirmed === "failed" && m.contact && !m.contact.includes("@") && i === lastLockedIdx(msgs) && (
                    <EmailFallbackForm
                      sessionId={sessionId}
                      adoptK={adoptK}
                      onDone={() => setMsgs((cur) => cur.map((x, j) => (j === i && "kind" in x && x.kind === "locked" ? { ...x, confirmed: "email" as const } : x)))}
                    />
                  )}
                </div>
              </div>
            );
          }
          return null;
        })}

        {sending && (
          <div className="go-msg flex items-end gap-2" role="status" aria-label="replying">
            <img src="/icon-192.png" alt="" width={30} height={30} style={{ borderRadius: "50%" }} className="w-[30px] h-[30px] object-cover border border-[#00c853]/40 shrink-0" />
            <div className="rounded-2xl rounded-bl-md px-4 py-3 bg-white/[0.06] border border-white/10 flex gap-[5px] items-center">
              <span className="go-dot" /><span className="go-dot" style={{ animationDelay: "0.15s" }} /><span className="go-dot" style={{ animationDelay: "0.3s" }} />
            </div>
          </div>
        )}

        {!threadStarted && (
          <div className="flex flex-wrap gap-2 ml-10 items-center">
            {(lot ? ["i got a lot of phones", "some are financed", "i need cash today"] : CHIPS).map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => void send(c)}
                className="text-[14px] text-white/85 border border-[#00c853]/35 rounded-full px-4 py-[10px] active:scale-95 transition-transform"
              >
                {c}
              </button>
            ))}
            {/* the ONE opt-in way to leave a number early — a tiny chip,
                nothing standing, nothing timed (Sonny 2026-09-11) */}
            {!contactCaptured && (
              <button
                type="button"
                onClick={() => { logNote("tapped leave my number"); interactedRef.current = true; pushMsgs({ from: "bot", kind: "numberform" }); }}
                className="text-[13px] text-white/55 border border-white/15 rounded-full px-3 py-[8px] active:scale-95 transition-transform"
              >
                leave my number
              </button>
            )}
          </div>
        )}
      </div>

      <Composer
        rows={rows}
        lot={lot}
        sending={sending}
        uploading={uploading}
        takeover={takeover}
        gBusy={gBusy}
        hasPhoto={hasPhoto}
        // A send or chip tap from down here is a return to the bottom
        // (2026-09-30): the bar and chips stay pinned under the thread, so
        // they get tapped while scrolled up re-reading — the result landed
        // below the fold (auto-follow off) and the tap looked dead.
        onSend={(t) => { nearBottomRef.current = true; void send(t); }}
        onPhotos={(fs) => void sendPhotos(fs)}
        onPickModel={(r, pre) => { nearBottomRef.current = true; deviceTap(r, pre); }}
        // The instant-quote bar: once the in-thread tiles are gone, never
        // during a takeover (a tap would only become a message to Sonny).
        quickCats={threadStarted && !takeover && !threadFieldFocus ? QUICK_CATS : NO_CATS}
        onQuickCat={(c) => { nearBottomRef.current = true; categoryTap(c); }}
      />
      {unbound && (
        <p role="status" className="px-4 pb-2 text-[12px] text-white/50 leading-snug" style={{ background: "#0e0e0f", paddingBottom: "max(8px, env(safe-area-inset-bottom))" }}>
          To see replies here, open the link from your text &mdash; or keep chatting; the bot&rsquo;s replies still show.
        </p>
      )}
    </div>
  )}

  {/* footer — real business, real pages. /go only: the site-wide widget
      sits on pages with their own footer, and this one stacked a second
      /go-styled strip under it. */}
  {mode === "page" && (<>
  <footer className="mt-10 pt-4 border-t border-white/10 text-[13px] text-white/50">
    <p>TOP CASH CELLULAR LLC · austin tx</p>
    <p className="mt-1 text-white/70">
      <a href="tel:+15129609256" className="underline">call</a> or <a href="sms:+15129609256" className="underline">text</a> us: <a href="sms:+15129609256" className="underline text-white/85">(512) 960-9256</a>
    </p>
    <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
      <a href="/" className="underline text-white/80">main site — every device we buy</a>
      <a href="/reviews" className="underline">reviews</a>
      <a href="/how-it-works" className="underline">how it works</a>
      <a href="/faq" className="underline">faq</a>
      <a href="/grading-guide" className="underline">grading guide</a>
      <a href="/terms" className="underline">terms</a>
      <a href="/privacy" className="underline">privacy</a>
    </p>
  </footer>

  <noscript>
    <p className="mt-4 text-[14px] text-white/70">
      this page needs javascript — <a href="/sell-iphone-austin" className="underline">see prices and how it works here</a>.
    </p>
  </noscript>
  </>)}
    </>
  );
  if (mode === "widget") {
    return (
      <>
        <style>{GO_CSS}</style>
        {overlayEl}
      </>
    );
  }
  return (
    <main className="min-h-screen bg-[#0a0a0a] text-white px-4 pb-16 pt-3" style={{ maxWidth: 560, margin: "0 auto" }}>
      {/* header */}
      <header className="flex items-center justify-between py-2" aria-label="Top Cash Cellular">
        {/* Sonny 2026-09-11: "customers don't have a way to go to the main
            site — the logo doesn't take them back, nothing does." */}
        <a href="/" className="text-[16px] font-semibold tracking-tight" aria-label="Top Cash Cellular home">
          top cash <span className="text-[#00c853]">cellular</span>
        </a>
        <div className="text-[12px] text-white/50">{status}</div>
      </header>

      {/* headline — the whole first screen is this line + the tiles.
          Sonny 2026-09-11: "focus on sell today, large text, not the small
          extra text" — the ceilings, how-it-works and long-tail lines went. */}
      <h1 className="text-[38px] leading-[1.05] font-extrabold mt-4 tracking-tight">
        {lot ? "we buy phones — singles or the whole lot" : "sell your phone — cash in hand today"}
      </h1>

      {lot && (
        <button
          type="button"
          onClick={() => {
            document.getElementById("go-composer")?.scrollIntoView({ behavior: "smooth", block: "center" });
          }}
          className="mt-4 w-full rounded-2xl border border-[#00c853] px-4 py-3 text-left text-[15px] font-semibold text-[#00c853]"
        >
          selling more than a couple? start here →
        </button>
      )}

      {/* chat entry — tapping anything opens the full-screen takeover.
          The board stays the first paint; immersion starts at engagement. */}
      <section className="mt-7" id="go-composer" aria-label="chat with us">
        <style>{GO_CSS}</style>
        <h2 className="text-[22px] font-bold">{lot ? "tell us what you got" : "what are you selling?"}</h2>

        <p className="text-[16px] text-white/70 mt-1">
          {msgs.length > 0
            ? "your chat is saved — pick up where you left off."
            : lot
              ? "trays, shelves, mixed lots, cracked ones too."
              : visitorArea === "us" || visitorArea === "tx"
                ? "not in austin? free FedEx label \u2014 paid the day it lands."
                : "cracked or still on payments? we still buy it."}
        </p>

        {/* the panel — brighter than the page so it reads as THE thing to do
            (Sonny 2026-09-11: "the body seems hidden — think marketing").
            Tiles = one tap into the picker; the green button = type instead. */}
        <div className="mt-4 rounded-3xl border border-white/15 bg-white/[0.06] p-4">
          <div className="grid grid-cols-3 gap-2">
            {CATEGORIES.map((c) => (
              <button key={c.key} type="button" disabled={gBusy}
                onClick={() => categoryTap(c)}
                className="rounded-2xl border border-white/15 bg-white/[0.08] p-2 text-center active:scale-95 transition-transform">
                <span className="rounded-xl bg-white flex items-center justify-center mx-auto" style={{ height: 64 }}>
                  <img src={c.img} alt="" className="max-h-[54px] max-w-[80%] object-contain" />
                </span>
                <span className="block text-[14px] font-semibold mt-2 text-white">{c.label}</span>
              </button>
            ))}
          </div>
          {/* the message button — big, green, the thing a thumb lands on.
              Opens the full-screen chat with the composer focused. */}
          <button
            type="button"
            onClick={openChat}
            className="tcc-button-primary mt-4 w-full py-4 rounded-2xl text-[19px] font-bold flex items-center justify-center gap-2 active:scale-[0.99] transition-transform"
            aria-haspopup="dialog"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1.1-4.2A8 8 0 1 1 21 12z" />
            </svg>
            {msgs.length > 0 ? "continue your chat" : lot ? "message us — tell us what you got" : "message us — get your number"}
          </button>
          <p className="text-center text-[14px] text-white/55 mt-2">
            {lot ? "type it out or snap a pic of the pile — we answer right away." : "or just type it — we answer right away."}
          </p>
        </div>
      </section>

      {/* one proof line — the cold click's "is this legit?": a real rating
          from paid sellers (tap to read a few) and how you get paid. */}
      <div className="mt-4 text-[16px] text-white/85">
        {reviews.count >= 5 && reviews.top.length > 0 ? (
          <button
            type="button"
            onClick={() => setShowReviews((v) => !v)}
            aria-expanded={showReviews}
            className="text-left"
          >
            <span className="text-[#00c853] font-bold">{reviews.avg}★</span> from {reviews.count} sellers paid in cash, Zelle or Cash App{showReviews ? "" : " →"}
          </button>
        ) : (
          <p>paid in cash, Zelle or Cash App — same day.</p>
        )}
        {OWNER_PHOTO && (
          <p className="flex items-center gap-2 mt-2">
            <img src={OWNER_PHOTO} alt="Sonny, Top Cash Cellular" width={32} height={32} className="w-[32px] h-[32px] rounded-full object-cover border border-[#00c853]/60 shrink-0" />
            <span>sonny · austin, tx</span>
          </p>
        )}
      </div>

      {/* real verified reviews — collapsed to one line above; the cards only
          render if the visitor asks for them (Sonny 2026-08-19: "don't force
          the review on people, just have it there if they want") */}
      {showReviews && reviews.count >= 5 && reviews.top.length > 0 && (
        <section className="mt-3" aria-label="reviews from verified sellers">
          <div className="flex flex-col gap-2">
            {reviews.top.map((r, i) => (
              <figure key={i} className="rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3">
                <blockquote className="text-[14px] text-white/85">&ldquo;{r.body}&rdquo;</blockquote>
                <figcaption className="text-[13px] text-white/55 mt-1">
                  {r.name}
                  {r.device ? ` · sold a ${r.device}` : ""}
                  {r.city ? ` · ${r.city}` : ""}
                  <span className="text-[#00c853]"> · ✓ verified seller</span>
                </figcaption>
              </figure>
            ))}
          </div>
          <p className="text-[13px] mt-2">
            <a href="/reviews" className="text-white/60 underline">all {reviews.count} reviews →</a>
          </p>
        </section>
      )}

      {/* how-it-works section removed 2026-09-11 (Sonny: no small extra
          text) — the /how-it-works page in the footer and the chat cover it. */}



      {overlayEl}
    </main>
  );
}

// The message box, its typeahead chips and the photo picker. The draft is
// LOCAL state: typing used to re-render the whole overlay — every bubble,
// form and picker — on each keystroke, which lagged on cheap phones once a
// thread had twenty messages. Mounted only while the chat is open, so the
// placeholder ticker runs only then (it used to tick on every site page for
// the whole visit, chat closed).
function Composer({ rows, lot, sending, uploading, takeover, gBusy, hasPhoto, onSend, onPhotos, onPickModel, quickCats, onQuickCat }: {
  rows: BoardRow[]; lot: boolean; sending: boolean; uploading: boolean; takeover: boolean; gBusy: boolean; hasPhoto: boolean;
  onSend: (text: string) => void; onPhotos: (files: File[]) => void; onPickModel: (r: BoardRow, prefill: TypedSpec) => void;
  // instant-quote bar categories — empty while it shouldn't show
  quickCats: typeof CATEGORIES; onQuickCat: (c: (typeof CATEGORIES)[number]) => void;
}) {
  const [draft, setDraft] = useState("");
  // Composer placeholder — rotates through things a seller can actually type
  // (Sonny 2026-09-12: "remove the 'i got 4 phones' and do something
  // better"). A model name lights up the tap-to-price chips; the others
  // show that lots, cracked units and locked phones are welcome.
  const PLACEHOLDERS = lot
    ? ["i got 15 phones, need cash today…", "2 iphone 14s and a galaxy s23…", "type the models — we price each one"]
    : ["type your model — iphone 15 pro…", "galaxy s24 ultra, 256gb, unlocked…", "iphone 13 cracked screen, still works…", "2 phones and an ipad…", "still making payments on it? we buy those…", "macbook air m2, 8gb…"];
  const [phIdx, setPhIdx] = useState(0);
  useEffect(() => {
    if (draft) return; // a typed draft hides the placeholder anyway — don't tick
    const t = setInterval(() => setPhIdx((i) => (i + 1) % PLACEHOLDERS.length), 3200);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft, lot]);
  const placeholder = PLACEHOLDERS[phIdx % PLACEHOLDERS.length];
  // Search keys once per board, not once per keystroke.
  const keyed = useMemo(() => rows.map((r) => ({ r, key: rowSearchKey(r) })), [rows]);
  const typedMatches = useMemo(() => matchTyped(keyed, draft), [keyed, draft]);
  // File input is hidden; the camera button triggers it.
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraSvg = (size: number) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M14.5 4h-5L7.8 6H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-3.8L14.5 4z" />
      <circle cx="12" cy="13" r="3.6" />
    </svg>
  );
  return (
    <>
      {/* tap-to-price suggestions for a typed model */}
      {typedMatches.length > 0 && !takeover && !gBusy && (
        // pan-x (2026-09-30): the strip only ever slides sideways — a
        // vertical start on it pans nothing (see the touch guard)
        <div className="mx-4 mb-2 flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: "none", overscrollBehavior: "contain", touchAction: "pan-x" }} aria-label="tap your model to price it">
          {typedMatches.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => { const pre = parseTypedSpec(draft); setDraft(""); onPickModel(r, pre); }}
              className="shrink-0 rounded-full border border-[#00c853]/45 bg-white/[0.06] px-3 py-[8px] text-[14px] text-white/90 active:scale-95 transition-transform"
            >
              {r.label} <span className="text-[#00c853] font-semibold">up to ${r.upTo.toLocaleString("en-US")}</span>
            </button>
          ))}
        </div>
      )}

      {/* instant-quote bar (2026-09-30) — pinned between the thread and the
          box, so a seller chatting with the bot is always one tap from an
          engine number. It gives its slot to the typeahead chips while a
          typed model matches: one chip row above the input, never two. */}
      {quickCats.length > 0 && typedMatches.length === 0 && (
        <div role="group" aria-label="instant quote — tap what you're selling" className="mx-4 mb-2 flex items-center gap-2">
          <span aria-hidden className="shrink-0 whitespace-nowrap text-[12px] font-semibold text-[#00c853]">instant quote:</span>
          <div className="flex-1 min-w-0 flex gap-2 overflow-x-auto" style={{ scrollbarWidth: "none", overscrollBehavior: "contain", touchAction: "pan-x" }}>
            {quickCats.map((c) => (
              <button
                key={c.key}
                type="button"
                // Not while a bot reply or a photo is in flight (2026-09-30):
                // a category started under a pending turn got its picker
                // overwritten by the reply's quote (shared gRow) and the
                // tap folded into that turn's history.
                disabled={gBusy || sending || uploading}
                onClick={() => { if (!gBusy && !sending && !uploading) onQuickCat(c); }}
                className="shrink-0 h-[44px] flex items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.06] pl-1.5 pr-3.5 text-[14px] text-white/90 disabled:opacity-40 active:scale-95 transition-transform"
              >
                <span className="w-[32px] h-[32px] rounded-full bg-white flex items-center justify-center shrink-0">
                  <img src={c.img} alt="" width={24} height={24} className="max-h-[24px] max-w-[24px] object-contain" />
                </span>
                {c.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Photo affordance — stays until they've sent one, so the option is
          discoverable even after the greeting scrolls away. Tapping it opens
          the picker too. */}
      {!hasPhoto && (
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading || sending}
          className="mx-4 mb-1 flex items-center justify-center gap-1.5 text-[12px] text-white/50 py-1 active:scale-[0.98] disabled:opacity-40"
        >
          {cameraSvg(14)}
          tap to add a photo of your device — helps us price it
        </button>
      )}

      <form
        className="flex gap-2 items-center px-4 py-3 border-t border-white/10"
        style={{ background: "#0e0e0f", paddingBottom: "max(12px, env(safe-area-inset-bottom))" }}
        onSubmit={(e) => {
          e.preventDefault();
          const t = draft.trim();
          if (!t || sending || uploading) return;
          setDraft("");
          onSend(t);
        }}
      >
        {/* photo attach — sellers WANT to show the crack; on phones this
            opens camera-or-gallery. Hidden input, camera button triggers. */}
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            const fs = Array.from(e.target.files || []);
            e.target.value = "";
            if (fs.length) onPhotos(fs);
          }}
        />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading || sending}
          aria-label="send a photo of your device"
          className={`w-[46px] h-[46px] shrink-0 rounded-full bg-white/[0.06] border flex items-center justify-center disabled:opacity-40 active:scale-95 transition-transform ${hasPhoto ? "border-white/15 text-white/75" : "border-[#00c853]/45 text-[#00c853]"}`}
          style={{ borderRadius: "50%" }}
        >
          {uploading ? <span className="go-dot" /> : cameraSvg(21)}
        </button>
        <input
          id="go-composer-input"
          className="flex-1 px-4 py-3 rounded-full bg-white/[0.06] border border-white/15 text-[17px] text-white placeholder-white/40 focus:outline-none focus:border-[#00c853]"
          placeholder={placeholder}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          aria-label="tell us what you're selling"
        />
        <button
          type="submit"
          disabled={sending || uploading || !draft.trim()}
          style={{ borderRadius: "50%" }}
          className="tcc-button-primary w-[46px] h-[46px] shrink-0 text-[21px] font-bold disabled:opacity-40 flex items-center justify-center"
          aria-label="send"
        >
          ↑
        </button>
      </form>
    </>
  );
}

// Which line a board row belongs to — the server names it ("iPhone 14",
// "Galaxy S24", "iPad Pro", "PlayStation"), so the picker needs no parsing.
function lineOf(r: BoardRow): { key: string; label: string } {
  return { key: r.line, label: r.line };
}

// Two-stage model picker: line chips ("iPhone 14"), then that line's variants
// as a grid with pictures and ceilings. Replaces the 28-card horizontal
// carousel — a 13 seller swiped past ten cards, and the lazy images showed
// as grey boxes on LTE. Any model is now two taps, no swiping, and the few
// variant images load eagerly because there are only ever 2-6 of them.
function ModelPicker({ rows, line, onLine, onPick, onOther, busy }: {
  rows: BoardRow[];
  line?: string;
  onLine: (key: string, label: string) => void;
  onPick: (r: BoardRow) => void;
  onOther: () => void;
  busy: boolean;
}) {
  const lines: { key: string; label: string }[] = [];
  for (const r of rows) {
    const l = lineOf(r);
    if (!lines.some((x) => x.key === l.key)) lines.push(l);
  }
  const variants = line ? rows.filter((r) => lineOf(r).key === line) : [];
  const chip = "text-[14px] text-white/85 border border-[#00c853]/35 rounded-full px-4 py-[10px] active:scale-95 transition-transform disabled:opacity-50";
  if (!line) {
    return (
      <div>
        <div className="text-[14px] text-white/60 mb-2">which one?</div>
        <div className="flex flex-wrap gap-2">
          {lines.map((l) => (
            <button key={l.key} type="button" disabled={busy} onClick={() => onLine(l.key, l.label)} className={chip}>
              {l.label}
            </button>
          ))}
          <button type="button" disabled={busy} onClick={onOther} className={chip + " text-white/60"}>
            older or don&rsquo;t see it
          </button>
        </div>
      </div>
    );
  }
  return (
    <div className="grid grid-cols-2 gap-2">
      {variants.map((r) => (
        <button
          key={r.id}
          type="button"
          disabled={busy}
          onClick={() => onPick(r)}
          className="rounded-2xl border border-white/10 bg-white/[0.06] p-2 text-left active:scale-95 transition-transform disabled:opacity-50"
        >
          <div className="rounded-xl bg-white p-1.5 flex items-center justify-center" style={{ height: 86 }}>
            <img src={r.img} alt="" decoding="async" width={96} height={96} className="max-h-full max-w-full object-contain" style={{ borderRadius: 8 }} />
          </div>
          <div className="text-[13px] font-semibold mt-1.5 leading-tight text-white">{r.label}</div>
          <div className="text-[12px] text-[#00c853] mt-0.5" style={{ fontVariantNumeric: "tabular-nums" }}>up to ${r.upTo.toLocaleString("en-US")}</div>
        </button>
      ))}
      <button
        type="button"
        disabled={busy}
        onClick={onOther}
        className="rounded-2xl border border-[#00c853]/35 bg-white/[0.06] p-2 text-left active:scale-95 transition-transform disabled:opacity-50"
      >
        <div className="rounded-xl border border-dashed border-white/25 flex items-center justify-center" style={{ height: 86 }}>
          <span className="text-[27px] font-bold text-[#00c853]">?</span>
        </div>
        <div className="text-[13px] font-semibold mt-1.5 leading-tight text-white">don&rsquo;t see yours? tell us</div>
      </button>
    </div>
  );
}

// The opt-in phone field behind the "leave my number" chip. Goes through
// send() as a plain message, so the server's contact detection, lead post,
// owner alert and pixel all fire exactly as for a typed number.
function lastLockedIdx(list: Msg[]): number {
  for (let j = list.length - 1; j >= 0; j--) {
    const x = list[j];
    if ("kind" in x && x.kind === "locked") return j;
  }
  return -1;
}

// Under a locked card whose confirmation TEXT failed (2026-09-23: the relay
// was down for a week and the card had promised a text): one email field →
// /api/go/confirm-email sends the same confirmation by email and parks the
// address for the team. Phone contacts only — an email contact already got it.
function EmailFallbackForm({ sessionId, adoptK, onDone }: { sessionId: string; adoptK: string; onDone: () => void }) {
  const [v, setV] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const ok = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim());
  return (
    <form
      className="mt-2 flex flex-col gap-2"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!ok || busy) return;
        setBusy(true);
        setErr("");
        try {
          const r = await fetch("/api/go/confirm-email", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sessionId, email: v.trim(), ...(adoptK ? { k: adoptK } : {}) }),
          });
          const d = await r.json().catch(() => ({}));
          if (r.ok && d?.ok) onDone();
          // UNBOUND (403) carries its own line: open the texted link.
          else setErr(typeof d?.hint === "string" ? d.hint : typeof d?.error === "string" ? d.error : "couldn\u2019t send that \u2014 try once more");
        } catch {
          setErr("couldn\u2019t send that \u2014 try once more");
        }
        setBusy(false);
      }}
    >
      <div className="flex gap-2">
        <input
          value={v}
          onChange={(e) => setV(e.target.value)}
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="your email"
          aria-label="your email"
          disabled={busy}
          className="flex-1 min-w-0 px-4 py-[10px] rounded-full bg-white/[0.06] border border-white/15 text-[16px] text-white placeholder-white/40 focus:outline-none focus:border-[#00c853]"
        />
        <button type="submit" disabled={busy || !ok} className="tcc-button-primary px-4 py-[10px] rounded-full text-[15px] font-bold shrink-0 disabled:opacity-40">
          {busy ? "\u2026" : "send"}
        </button>
      </div>
      {err && <div className="text-[13px] text-[#ff8a80]">{err}</div>}
    </form>
  );
}

function NumberForm({ disabled, onSave }: { disabled: boolean; onSave: (v: string) => void }) {
  const [v, setV] = useState("");
  const ok = v.replace(/\D/g, "").length >= 10 || v.includes("@");
  return (
    <form
      className="rounded-2xl border border-white/10 bg-white/[0.06] p-3 flex flex-col gap-2 max-w-[92%]"
      onSubmit={(e) => { e.preventDefault(); if (ok && !disabled) onSave(v.trim()); }}
    >
      <div className="text-[13px] text-white/60">so we can reach you about your offer — even if this chat gets cut off.</div>
      <div className="flex gap-2">
        <input
          value={v}
          onChange={(e) => setV(e.target.value)}
          placeholder="your number"
          autoComplete="tel"
          aria-label="your phone number"
          disabled={disabled}
          className="flex-1 min-w-0 px-4 py-[10px] rounded-full bg-white/[0.06] border border-white/15 text-[16px] text-white placeholder-white/40 focus:outline-none focus:border-[#00c853]"
        />
        <button type="submit" disabled={disabled || !ok} className="tcc-button-primary px-4 py-[10px] rounded-full text-[15px] font-bold shrink-0 disabled:opacity-40">
          save
        </button>
      </div>
    </form>
  );
}

// One field + one tap. The 18+/ownership attestation is the button label
// itself (tapping affirms it — the server still records [ATTEST: yes]), and
// the line under it is the express consent for the texts about this quote.
// Shipping address → /api/go/label mints the FedEx label on the spot. FedEx
// prints a name and phone on every label, so both are required here (the
// name pre-fills from the lock when they gave one).
// newLabel (2026-09-30): "my box already shipped" for a lock ADDED to that
// box — the route prints it its own label instead of handing the joined one
// back.
function ShipForm({ sessionId, adoptK, defaultName, defaultPhone, disabled, newLabel, onDone }: {
  sessionId: string; adoptK: string; defaultName: string; defaultPhone: string; disabled: boolean; newLabel?: boolean;
  onDone: (r: ShipResult) => void;
}) {
  const [f, setF] = useState({ name: defaultName, phone: defaultPhone, street: "", unit: "", city: "", state: "", zip: "" });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF((cur) => ({ ...cur, [k]: e.target.value }));
  const submit = async () => {
    if (busy || disabled) return;
    if (f.name.trim().length < 2) return setErr("FedEx prints a name on the label \u2014 add yours");
    if (f.phone.replace(/\D/g, "").replace(/^1(\d{10})$/, "$1").length !== 10) return setErr("a 10-digit phone number \u2014 FedEx prints it on the label");
    if (!f.street.trim() || !f.city.trim() || f.state.trim().length !== 2 || !/^\d{5}(-\d{4})?$/.test(f.zip.trim())) return setErr("street, city, 2-letter state and 5-digit ZIP");
    setBusy(true); setErr("");
    try {
      const res = await fetch("/api/go/label", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ session: sessionId, ...(adoptK ? { k: adoptK } : {}), ...(newLabel ? { newLabel: true } : {}), ...f, state: f.state.trim().toUpperCase() }) });
      const d = await res.json().catch(() => ({}));
      // devices is the box's list, count the number (2026-09-30; a numeric
      // devices is the old route's count, mid-deploy); room how many more
      // phones the label carries.
      if (d?.ok) onDone({ ok: true, tracking: String(d.tracking), url: String(d.url), texted: d.texted === true, emailed: d.emailed === true, devices: strList(d.devices), count: typeof d.count === "number" ? d.count : typeof d.devices === "number" ? d.devices : undefined, room: num(d.room) });
      // UNBOUND (403, 2026-09-26): not this browser's thread — the hint says
      // to open the texted link; the form stays up.
      else if (d?.kind === "ADDRESS_INVALID" || d?.kind === "UNBOUND") setErr(String(d.hint || "check the address and try again"));
      // status: shipDone forgets the open box only when FedEx was reached (502).
      else onDone({ ok: false, kind: String(d?.kind || "SERVICE_UNAVAILABLE"), hint: typeof d?.hint === "string" ? d.hint : undefined, status: res.status, withheld: d?.withheld === true, newLabel });
    } catch {
      setErr("that didn\u2019t go through \u2014 try again");
    }
    setBusy(false);
  };
  const cls = "px-4 py-2.5 rounded-xl bg-white/[0.06] border border-white/15 text-[16px] text-white placeholder-white/40 focus:outline-none focus:border-[#00c853] min-w-0";
  return (
    <form className="flex flex-col gap-2" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
      <div className="grid grid-cols-2 gap-2">
        <input className={cls} placeholder="full name" value={f.name} onChange={set("name")} autoComplete="name" disabled={disabled} aria-label="full name" />
        <input className={cls} placeholder="phone" value={f.phone} onChange={set("phone")} autoComplete="tel" inputMode="tel" disabled={disabled} aria-label="phone number" />
      </div>
      <input className={cls} placeholder="street address" value={f.street} onChange={set("street")} autoComplete="street-address" disabled={disabled} aria-label="street address" />
      <div className="grid grid-cols-[1fr_2fr] gap-2">
        <input className={cls} placeholder="apt / unit" value={f.unit} onChange={set("unit")} autoComplete="address-line2" disabled={disabled} aria-label="apartment or unit" />
        <input className={cls} placeholder="city" value={f.city} onChange={set("city")} autoComplete="address-level2" disabled={disabled} aria-label="city" />
      </div>
      <div className="grid grid-cols-[1fr_2fr] gap-2">
        <input className={cls} placeholder="state" maxLength={2} value={f.state} onChange={set("state")} autoComplete="address-level1" disabled={disabled} aria-label="state" />
        <input className={cls} placeholder="ZIP" value={f.zip} onChange={set("zip")} autoComplete="postal-code" inputMode="numeric" disabled={disabled} aria-label="ZIP code" />
      </div>
      {err && <p className="text-[13px] text-red-400" role="alert">{err}</p>}
      <button type="submit" disabled={disabled || busy} className="tcc-button-primary py-3 text-[16px] font-bold rounded-2xl disabled:opacity-40">
        {busy ? "printing your label\u2026" : "get my free FedEx label"}
      </button>
      <p className="text-[12px] text-white/45 leading-snug">prepaid, drop it at any FedEx location. we text you the label link too.</p>
    </form>
  );
}

function LockForm({ manual, disabled, onLock, defaultContact = "", defaultName = "" }: { manual: boolean; disabled: boolean; onLock: (c: string, name: string) => Promise<string | null>; defaultContact?: string; defaultName?: string }) {
  // A second device in the same visit starts with the contact + name they
  // already gave for the first — one tap, not a retype (test run 2026-09-24).
  const [c, setC] = useState(defaultContact);
  const [name, setName] = useState(defaultName);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    if (busy || disabled) return;
    setBusy(true);
    setErr("");
    const e = await onLock(c, name);
    if (e) setErr(e);
    setBusy(false);
  };
  return (
    <form className="flex flex-col gap-2" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
      <input
        className="px-4 py-3 rounded-full bg-white/[0.06] border border-white/15 text-[17px] text-white placeholder-white/40 focus:outline-none focus:border-[#00c853]"
        placeholder="your number — we text you the quote"
        value={c}
        onChange={(e) => setC(e.target.value)}
        autoComplete="tel"
        enterKeyHint="done"
        disabled={disabled}
        aria-label="your phone number or email"
      />
      <input
        className="px-4 py-2.5 rounded-full bg-white/[0.04] border border-white/10 text-[15px] text-white placeholder-white/35 focus:outline-none focus:border-[#00c853]"
        placeholder="your name (optional)"
        value={name}
        onChange={(e) => setName(e.target.value)}
        autoComplete="name"
        enterKeyHint="done"
        disabled={disabled}
        aria-label="your name (optional)"
      />
      {err && <p className="text-[13px] text-red-400" role="alert">{err}</p>}
      <button
        type="submit"
        disabled={disabled || busy}
        className="tcc-button-primary py-3 text-[16px] font-bold rounded-2xl disabled:opacity-40"
      >
        {busy ? "locking…" : manual ? "send me a real offer — I’m 18+ and it’s mine to sell" : "Lock it in — I’m 18+ and it’s mine to sell"}
      </button>
      <p className="text-[12px] text-white/45 leading-snug">by tapping you confirm you&rsquo;re 18+ and this device is yours to sell, and you&rsquo;re ok with a few texts about this quote. reply STOP any time.</p>
    </form>
  );
}

