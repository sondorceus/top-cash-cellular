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
import { useEffect, useRef, useState } from "react";
import type { BoardRow, GoStep } from "./board";
import { pixelTrack, fbCookies } from "../components/MetaPixel";

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
  { key: "broken", label: "cracked / broken" },
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

type Msg =
  | { from: "user" | "bot" | "owner"; text: string }
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
  // until: ISO lock deadline from /api/go/lock — rendered as "holds until <date>"
  // confirmed: sms/email = delivered before the response; pending = still sending; failed = channel refused
  | { from: "bot"; kind: "locked"; offer: number | null; until?: string; confirmed?: "sms" | "email" | "pending" | "failed" }
  | { from: "bot"; kind: "msgr" };

// FB Page handle for the "keep this chat on Messenger" affordance (m.me deep
// link). Meta policy: we can never MESSAGE someone cold — they must open the
// thread — so the play is getting warm sellers to start one; the thread then
// lands in the Page inbox with their real name, reachable for follow-up.
// Env-gated (set NEXT_PUBLIC_FB_PAGE to the page's handle, the bit after
// facebook.com/); unset = the affordance never renders.
const MSGR_HANDLE = process.env.NEXT_PUBLIC_FB_PAGE || "";

function newSessionId(src: string) {
  const rand = Math.random().toString(36).slice(2, 10);
  return `go${src ? `-${src}` : ""}-${rand}`.slice(0, 24);
}

// Messenger-style continuity: the session id survives tab closes (7 days),
// so a returning seller resumes the SAME thread — including replies Sonny
// sent from /admin/chats while they were gone — instead of starting over.
const SESSION_KEY = "tcc-go-session";
// The owner's SMS deep-link (?sid=&k=) is adopted in the restore effect —
// AFTER the server verifies k — never here: an unverified ?sid= would let
// anyone who shares a crafted /go link plant their own (readable) session in
// a victim's browser.
const GO_SID_SHAPE = /^go(-[a-z0-9]{1,10})?-[a-z0-9]{2,12}$/i;
function persistentSessionId(src: string): string {
  if (typeof window === "undefined") return newSessionId(src);
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (raw) {
      const { sid, ts } = JSON.parse(raw) as { sid?: string; ts?: number };
      if (typeof sid === "string" && /^go[a-z0-9-]{2,30}$/i.test(sid) && typeof ts === "number" && Date.now() - ts < 7 * 24 * 3600_000) {
        return sid;
      }
    }
  } catch { /* fall through to a fresh id */ }
  const sid = newSessionId(src);
  try { localStorage.setItem(SESSION_KEY, JSON.stringify({ sid, ts: Date.now() })); } catch { /* private mode */ }
  return sid;
}

// A real photo of the owner for the proof row + his chat messages. Gated on
// NEXT_PUBLIC_OWNER_PHOTO (e.g. "/owner.jpg" once public/owner.jpg exists):
// nothing renders until a real photo is in — no stock face, no fake human.
const OWNER_PHOTO = process.env.NEXT_PUBLIC_OWNER_PHOTO || "";

export default function GoClient({ rows, src, reviews, variant = "std" }: { rows: BoardRow[]; src: string; reviews: GoReviews; variant?: "std" | "lot" }) {
  const lot = variant === "lot";
  // ---- chat state ----
  const [showReviews, setShowReviews] = useState(false);
  // Full-screen chat takeover — opens on engagement (never on load: the
  // board stays the first paint). X returns to the page with the thread
  // intact.
  const [chatOpen, setChatOpen] = useState(false);
  const overlayInputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    document.body.style.overflow = chatOpen ? "hidden" : "";
    if (chatOpen) setTimeout(() => overlayInputRef.current?.focus(), 60);
    return () => { document.body.style.overflow = ""; };
  }, [chatOpen]);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  // Guided in-chat funnel (Messenger-style quick selects) — deterministic,
  // engine-priced, zero AI calls. gRow/gSpec track the device being walked.
  const [gRow, setGRow] = useState<BoardRow | null>(null);
  const [gSpec, setGSpec] = useState<{ storage?: string; condition?: string; carrier?: string; connectivity?: string; disc?: string; processor?: string; memory?: string; extras?: string }>({});
  const [gBusy, setGBusy] = useState(false);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  // Photo attach — the flaw a phone-buyback chat can't have: sellers WANT to
  // show the crack. File input is hidden; the camera button triggers it.
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  // Settable: the restore effect swaps in a server-verified ?sid= session
  // from the owner's SMS deep-link.
  const [sessionId, setSessionId] = useState(() => persistentSessionId(src));
  // Effects with [] deps (the comeback nudge) read this, not the state, so a
  // breadcrumb written after an SMS deep-link adoption lands in the adopted
  // thread instead of the abandoned local one.
  const sessionIdRef = useRef(sessionId);
  useEffect(() => { sessionIdRef.current = sessionId; }, [sessionId]);
  const threadRef = useRef<HTMLDivElement>(null);
  // What the seller just locked — the handoff chips POST it to /api/delivery
  // after the lock form (and its contact) is gone.
  const lastLockRef = useRef<{ model: string; contact: string; offer: number | null } | null>(null);
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
  useEffect(() => {
    if (chatOpen) nearBottomRef.current = true;
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
  const hasActivity = msgs.length > 0;
  useEffect(() => {
    if (!chatOpen || !hasActivity) return; // nothing stored server-side until the seller does something
    const iv = setInterval(async () => {
      try {
        const r = await fetch(`/api/go/chat-sync?session=${sessionId}&after=${lastSyncRef.current}`, { cache: "no-store" });
        if (!r.ok) return; // a rate-limited tick must never flip UI state
        const d = await r.json();
        if (Array.isArray(d?.msgs) && d.msgs.length) {
          const fresh = d.msgs.filter((m: { ts?: number }) => typeof m?.ts === "number" && m.ts > lastSyncRef.current);
          if (fresh.length) {
            setMsgs((cur) => [...cur, ...fresh.map((m: { text: string }) => ({ from: "owner" as const, text: String(m.text) }))]);
          }
        }
        // Cursor rides the session's newest record (not just owner msgs), so
        // idle polls stay zero-fetch server-side.
        if (typeof d?.lastTs === "number" && d.lastTs > lastSyncRef.current) lastSyncRef.current = d.lastTs;
        if (typeof d?.takeover === "boolean") setTakeover(d.takeover);
      } catch { /* next tick */ }
    }, 4000);
    return () => clearInterval(iv);
  }, [chatOpen, hasActivity, sessionId]);

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
    restoredRef.current = true;
    void (async () => {
      // Owner SMS deep-link adoption: ?sid=&k= — the server checks k (an
      // HMAC only the authed console can mint) and vouches with adopt:true;
      // anything else is ignored and we restore the local session as usual.
      let sid = sessionId;
      let adoptParam = "";
      try {
        const qs = new URLSearchParams(window.location.search);
        const urlSid = qs.get("sid") || "";
        const urlK = qs.get("k") || "";
        if (GO_SID_SHAPE.test(urlSid) && urlSid.length <= 32 && /^[a-f0-9]{20}$/i.test(urlK)) {
          sid = urlSid;
          adoptParam = `&k=${urlK}`;
        }
      } catch { /* local session */ }
      try {
        const r = await fetch(`/api/go/chat-sync?session=${sid}&after=0&full=1${adoptParam}`, { cache: "no-store" });
        if (!r.ok) return;
        const d = await r.json();
        if (adoptParam) {
          if (!d?.adopt) return; // server refused the deep-link — keep the local session untouched
          setSessionId(sid);
          try { localStorage.setItem(SESSION_KEY, JSON.stringify({ sid, ts: Date.now() })); } catch { /* private mode */ }
          setChatOpen(true); // the SMS said "reply in your chat" — the board would be a dead end
        }
        if (Array.isArray(d?.msgs) && d.msgs.length) {
          const restored: Msg[] = d.msgs.map((m: { role: string; text: string }) => ({
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
        if (typeof d?.lastTs === "number" && d.lastTs > lastSyncRef.current) lastSyncRef.current = d.lastTs;
        if (typeof d?.takeover === "boolean") setTakeover(d.takeover);
      } catch { /* fresh thread */ }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  // Guided-funnel breadcrumbs for the owner console — the chip flow never
  // touches /api/chat, so quote/lock milestones are logged here instead.
  function logNote(text: string) {
    void fetch("/api/go/chat-sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session: sessionIdRef.current, text }),
    }).catch(() => {});
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
      setMsgs((cur) => {
        if (awayNudgedRef.current) return cur;
        const hasQuote = aiQuotedRef.current || cur.some((m) => "kind" in m && (m.kind === "quote" || m.kind === "lockform"));
        const isLocked = cur.some((m) => "kind" in m && m.kind === "locked");
        // AI-path threads (MacBook / iPad / console / "something else") never
        // get a quote card, so the old quote-only gate left the largest
        // uncovered segment with no catch at all. Any thread the seller
        // actually typed in counts.
        const hasThread = cur.some((m) => !("kind" in m) && m.from === "user");
        if (isLocked || (!hasQuote && !hasThread)) return cur;
        awayNudgedRef.current = true;
        logNote(`seller left and came back${hasQuote ? "" : " (no quote yet)"} — nudged for number` + (MSGR_HANDLE && hasQuote ? " + messenger" : ""));
        return [
          ...cur,
          {
            from: "bot",
            text: hasQuote
              ? "welcome back — your number’s still good. drop your phone number and we’ll text it to you so it’s saved even if you head out."
              : "still here — drop your phone number and we’ll text you the offer so it’s saved even if you head out.",
          },
          ...(MSGR_HANDLE && hasQuote ? [{ from: "bot" as const, kind: "msgr" as const }] : []),
        ];
      });
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // One-shot idle nudge: a lock form that sits untouched for 25s gets a
  // single "just your number works" bubble. Appended straight into state —
  // pushMsgs would retire the live form. The timer re-arms on any thread
  // activity, so it fires 25s after the seller last did anything.
  const nudgedRef = useRef(false);
  useEffect(() => {
    if (nudgedRef.current || takeover) return;
    if (!msgs.some((m) => "kind" in m && m.kind === "lockform" && !m.done)) return;
    const t = setTimeout(() => {
      setMsgs((cur) => {
        if (nudgedRef.current || takeoverRef.current) return cur;
        if (!cur.some((m) => "kind" in m && m.kind === "lockform" && !m.done)) return cur;
        nudgedRef.current = true;
        logNote("idle lockform — nudged: just your number works");
        return [...cur, { from: "bot", text: "just your number works — we’ll text you the quote so you don’t lose it." }];
      });
    }, 25000);
    return () => clearTimeout(t);
  }, [msgs, takeover]);

  // AI-path twin of the idle nudge: Theot named an engine number in plain
  // text (no lock form exists on that path), the seller went quiet, and no
  // contact is on file — one bubble, 45s after the last activity. This was
  // the dominant observed loss: quote-then-silence with the last message
  // never asking for a number.
  const aiNudgedRef = useRef(false);
  useEffect(() => {
    if (aiNudgedRef.current || !aiQuoted || contactCaptured || takeover) return;
    const t = setTimeout(() => {
      setMsgs((cur) => {
        if (aiNudgedRef.current || takeoverRef.current || contactCapturedRef.current) return cur;
        aiNudgedRef.current = true;
        logNote("idle after AI quote — nudged for number");
        return [...cur, { from: "bot", text: "that number holds for 14 days — drop your phone number and we’ll text it to you so it’s saved." }];
      });
    }, 45000);
    return () => clearTimeout(t);
  }, [msgs, aiQuoted, contactCaptured, takeover]);

  // Retire interactivity on every previous rich message; append new ones.
  function pushMsgs(...add: Msg[]) {
    setMsgs((m) => [...m.map((x) => ("kind" in x ? { ...x, done: true } : x)), ...add]);
  }

  // "got another one?" — asked after the handoff choice. Every affordance
  // (category grid, "i got a few phones" chip) is gated on an empty thread,
  // so without this the locked card is a dead end and a 3-device seller
  // silently becomes a 1-device seller.
  function anotherChips(): Msg {
    return {
      from: "bot",
      kind: "chips",
      q: "got another one?",
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
        { from: "user", text: cat.label },
        { from: "bot", text: "solid — which one is it? older models work too, just type the model." },
        { from: "bot", kind: "models", group: cat.deterministic },
      );
    } else {
      // AI runs the intake for everything off the quick path
      void send(cat.key === "other" ? "i got something else to sell" : `i got a ${cat.label.toLowerCase()} to sell`);
    }
  }

  function deviceTap(r: BoardRow) {
    if (gBusy) return;
    interactedRef.current = true;
    setChatOpen(true);
    logNote(`picked model ${r.label}`);
    if (takeoverRef.current) {
      void send(r.label);
      return;
    }
    setGRow(r);
    setGSpec({});
    pixelTrack("ViewContent", { content_name: r.label, content_category: "chat" });
    pushMsgs(
      { from: "user", text: r.label },
      { from: "bot", text: `good one — up to $${r.upTo.toLocaleString("en-US")} depending on specs.` },
      stepChips(r, r.steps[0]),
    );
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
        pushMsgs(
          { from: "user", text: label },
          { from: "bot", text: isDay ? "sounds good — we’ll reach out shortly to set it up." : "sounds good — we’ll reach out first thing in the morning to set it up." },
        );
        return;
      }
      setGRow(null);
      setGSpec({});
      if (key === "ip" || key === "gs" || key === "ipad" || key === "console" || key === "macbook") {
        pushMsgs(
          { from: "user", text: label },
          { from: "bot", text: "nice — which one is it?" },
          { from: "bot", kind: "models", group: key },
        );
      } else {
        pushMsgs({ from: "user", text: label });
        void send("i got something else to sell too");
      }
      return;
    }
    // Handoff, asked right after the lock: local vs ship was never captured
    // on this page (every /go lead read "Handoff: TBD"), so Sonny had to text
    // just to learn which. Posts the same [DELIVERY OPTION] comm the homepage
    // funnel writes; the seller's own MEET/SHIP text reply does the same.
    if (dim === "handoff") {
      const lk = lastLockRef.current;
      pushMsgs({ from: "user", text: label });
      if (key === "later" || !lk) {
        pushMsgs({ from: "bot", text: "no problem — we’ll text you and sort it out." }, anotherChips());
        return;
      }
      const method = key === "meet" ? "local" : "shipping";
      void fetch("/api/delivery", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          method,
          name: "",
          ...(lk.contact.includes("@") ? { email: lk.contact } : { phone: lk.contact }),
          model: lk.model,
          quote: lk.offer != null ? String(lk.offer) : "",
          area: method === "local" ? "Austin area (chosen on /go)" : "",
          session: sessionId,
        }),
      }).catch(() => {});
      pushMsgs(
        {
          from: "bot",
          text: method === "local"
            ? "perfect — we’ll text you to set up a time and a public spot in the austin area."
            : "perfect — we’ll text you for the address and send your free FedEx label.",
        },
        anotherChips(),
      );
      return;
    }
    if (!gRow) return;
    const spec = { ...gSpec, [dim]: key };
    setGSpec(spec);
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
      pushMsgs({ from: "user", text: label }, stepChips(gRow, next));
      return;
    }
    // last step answered → quote once with the full spec
    setGBusy(true);
    pushMsgs({ from: "user", text: label });
    const storageKey = spec.storage ?? gRow.storages[0] ?? gRow.bestStorage;
    try {
      const res = await fetch("/api/go/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // sessionId → the quote route writes the "quote shown"/QSPEC
        // breadcrumbs SERVER-SIDE with the engine result in hand (they feed
        // the chat brain's funnel context + restore-time rehydration, so
        // they must not be client-authored).
        body: JSON.stringify({
          model: gRow.id,
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
      if (d?.ok && typeof d.offer === "number") {
        // Quote + capture in ONE beat — the form rides with the number, no
        // extra tap. InitiateCheckout marks quote-viewers on the pixel so
        // non-lockers become a retargeting audience (Lead still fires only
        // on lock).
        pixelTrack("InitiateCheckout", { content_name: gRow.label, value: d.offer, currency: "USD" });
        pushMsgs(
          {
            from: "bot",
            kind: "quote",
            label: quoteLabel(gRow, storageKey),
            offer: d.offer,
            ...(dim === "carrier" && key === "unknown"
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
      } else {
        // A 429 / 5xx / engine hiccup is NOT "we price this one by hand" —
        // re-ask the last step so the instant close stays reachable.
        pushMsgs({ from: "bot", text: "hit a snag pulling the number — tap that again for me." }, stepChips(gRow, dim as GoStep));
      }
    } catch {
      pushMsgs({ from: "bot", text: "hit a snag pulling the number — tap that again for me." }, stepChips(gRow, dim as GoStep));
    }
    setGBusy(false);
  }

  // One field, one tap. The attestation rides in the button label ("I'm 18+
  // and it's mine to sell") — tapping IS the affirmation, recorded server-side
  // as [ATTEST: yes] exactly as before; the checkbox and the optional name
  // field were two extra taps at the one moment we have their attention.
  async function guidedLock(gContact: string, manualFlavor: boolean): Promise<string | null> {
    if (!gRow) return "something went sideways — tap your phone again";
    const c = gContact.trim();
    if (!c) return "we need a number or email to reach you";
    setGBusy(true);
    // Per-lock dedup id, shared with the server: the pixel Lead and the
    // Conversions API Lead carry the SAME event id, so Meta keeps one copy.
    // Per-lock (not per-session) because "got another one?" means a session
    // can lock several devices, each its own conversion.
    const lockEventId = `lock-${sessionId}-${Date.now().toString(36)}`;
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
          condition: gSpec.condition ?? "good",
          carrier: gSpec.carrier ?? (gRow.cat === "phone" ? "unlocked" : undefined),
          // `opt` only for the categories that have one — a phone body with
          // opt:"na" was rejected as "bad spec" (review 2026-09-11).
          opt: gRow.cat === "ipad" ? (gSpec.connectivity ?? "wifi") : gRow.cat === "console" ? (gSpec.disc ?? "na") : undefined,
          processor: gSpec.processor,
          memory: gSpec.memory,
          extras: gSpec.extras ?? "ok",
          name: "",
          contact: c,
          attest: true,
          src,
          sessionId,
          eventId: lockEventId,
          quotedOffer,
          fbp,
          fbc,
        }),
      });
      const d = await res.json();
      setGBusy(false);
      if (d?.ok) {
        const offer: number | null = typeof d.offer === "number" ? d.offer : null;
        lastLockRef.current = { model: quoteLabel(gRow, gSpec.storage ?? gRow.storages[0]), contact: c, offer };
        pixelTrack("Lead", { content_name: gRow.label, value: offer ?? 0, currency: "USD" }, lockEventId);
        // (the LOCKED breadcrumb + the confirmation text are server-side)
        // Peak trust: they just saw a real number and handed over a way to
        // reach them. Ask how they want to get paid HERE, then the second
        // device (anotherChips, after the handoff choice).
        pushMsgs(
          {
            from: "bot",
            kind: "locked",
            offer: offer != null && !manualFlavor ? offer : null,
            until: typeof d.lockUntil === "string" ? d.lockUntil : undefined,
            confirmed: d.confirmed === "sms" || d.confirmed === "email" || d.confirmed === "failed" ? d.confirmed : "pending",
          },
          {
            from: "bot",
            kind: "chips",
            q: "how do you want to get paid?",
            dim: "handoff",
            options: [
              { key: "meet", label: "meet in austin — cash on the spot" },
              { key: "ship", label: "ship it — free label" },
              { key: "later", label: "not sure yet" },
            ],
          },
        );
        return null;
      }
      if (d?.moved && typeof d.offer === "number") {
        const live: number = d.offer;
        logNote(`price moved at lock: $${quotedOffer ?? "?"} → $${live}`);
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
    setDraft("");
    const history = msgs.filter((m): m is { from: "user" | "bot"; text: string } => !("kind" in m)).map((m) => ({ from: m.from === "user" ? "user" : "bot", text: m.text }));
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
          body: JSON.stringify({ message: t, history, sessionId, src, ...fbCookies() }),
        });
      } catch {
        await new Promise((r) => setTimeout(r, 900));
        res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: t, history, sessionId, src, ...fbCookies() }),
        });
      }
      const d = await res.json();
      // Close-signal tracking for the nudges: an engine number was named /
      // a contact landed.
      if (Array.isArray(d?.quoted) && d.quoted.length) setAiQuoted(true);
      if (d?.leadCaptured) setContactCaptured(true);
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
        setMsgs((m) => [...m, { from: "bot", text: d?.reply || "hang on — try that again in a sec" }]);
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
    if (uploading || files.length === 0) return;
    interactedRef.current = true;
    const MAX_BATCH = 6;
    const batch = files.slice(0, MAX_BATCH); // per-pick cap; they can attach again
    const history = msgs.filter((m): m is { from: "user" | "bot"; text: string } => !("kind" in m)).map((m) => ({ from: m.from === "user" ? "user" : "bot", text: m.text }));
    // A number is ACTIVELY on screen (un-retired guided quote/lock card) — a
    // photo must NOT trigger an AI reply that could name a DIFFERENT number
    // under it (the two-numbers bait-and-switch this page exists to avoid).
    // The photo still uploads, pings Sonny, and is stored; we just don't run
    // the model turn. Done/locked cards don't count: after a lock, the next
    // device's photos need the AI turn again — the suppression used to be
    // forever-sticky and muted every photo after any lock.
    const quoteOnScreen = msgs.some((m) => "kind" in m && (m.kind === "quote" || m.kind === "lockform") && !m.done);
    const locals = batch.map((f) => URL.createObjectURL(f));
    setMsgs((m) => [...m, ...locals.map((u) => ({ from: "user" as const, text: `IMG::${u}` }))]);
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
          setMsgs((cur) => cur.map((m) => (!("kind" in m) && m.text === `IMG::${localUrl}` ? { ...m, text: `IMG::${url}` } : m)));
        } else {
          // Drop the failed preview and add a bot-styled error (NOT a fake
          // user bubble — that read as the seller's own text and rode history).
          setMsgs((cur) => [
            ...cur.filter((m) => !(!("kind" in m) && m.text === `IMG::${localUrl}`)),
            { from: "bot", text: photoError(d?.error, r.status) },
          ]);
        }
      } catch {
        setMsgs((cur) => [
          ...cur.filter((m) => !(!("kind" in m) && m.text === `IMG::${localUrl}`)),
          { from: "bot", text: "that photo didn’t go through — try again." },
        ]);
      }
      URL.revokeObjectURL(localUrl); // the bubble now holds the CDN url (or is gone) — free the original File
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
          body: JSON.stringify({ message: `IMG::${last}`, history: batchHistory, sessionId, src, ...fbCookies() }),
        });
        const dd = await res.json();
        if (Array.isArray(dd?.quoted) && dd.quoted.length) setAiQuoted(true);
        if (dd?.leadCaptured) {
          setContactCaptured(true);
          // Same browser-side Lead the typed path fires — a photo-sender
          // whose contact landed on this turn was previously CAPI-only.
          pixelTrack("Lead", { content_name: "chat", content_category: "chat", ...(typeof dd.leadValue === "number" ? { value: dd.leadValue, currency: "USD" } : {}) }, `chatlead-${sessionId}`);
        }
        if (dd?.takeover && !dd?.reply) setTakeover(true);
        else if (dd?.reply) {
          if (takeoverRef.current) setTakeover(false);
          setMsgs((m) => [...m, { from: "bot", text: dd.reply }]);
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

  return (
    <main className="min-h-screen bg-[#0a0a0a] text-white px-4 pb-16 pt-3" style={{ maxWidth: 560, margin: "0 auto" }}>
      {/* header */}
      <header className="flex items-center justify-between py-2" aria-label="Top Cash Cellular">
        <div className="text-[16px] font-semibold tracking-tight">
          top cash <span className="text-[#00c853]">cellular</span>
        </div>
        <div className="text-[12px] text-white/50">{status}</div>
      </header>

      {/* headline — the whole first screen is this line + the tiles.
          Sonny 2026-09-11: "focus on sell today, large text, not the small
          extra text" — the ceilings, how-it-works and long-tail lines went. */}
      <h1 className="text-[38px] leading-[1.05] font-extrabold mt-4 tracking-tight">
        {lot ? "we buy phones — singles or the whole lot" : "sell your phone — cash in hand today"}
      </h1>
      <p className="text-[18px] text-white/75 mt-3">
        {lot ? "cash the same day. no email, no signup." : "real number in 30 seconds. no email, no signup."}
      </p>

      {lot && (
        <button
          type="button"
          onClick={() => {
            document.getElementById("go-composer")?.scrollIntoView({ behavior: "smooth", block: "center" });
            document.getElementById("go-composer-input")?.focus();
          }}
          className="mt-4 w-full rounded-2xl border border-[#00c853] px-4 py-3 text-left text-[15px] font-semibold text-[#00c853]"
        >
          selling more than a couple? start here →
        </button>
      )}

      {/* chat entry — tapping anything opens the full-screen takeover.
          The board stays the first paint; immersion starts at engagement. */}
      <section className="mt-7" id="go-composer" aria-label="chat with us">
        <style>{`
          @keyframes goMsgIn { from { opacity: 0; transform: translateY(5px); } }
          .go-msg { animation: goMsgIn 0.18s ease; }
          @keyframes goDot { 0%, 60%, 100% { transform: translateY(0); opacity: .45; } 30% { transform: translateY(-3px); opacity: 1; } }
          .go-dot { width: 6px; height: 6px; border-radius: 50%; background: #00c853; display: inline-block; animation: goDot 1.1s ease infinite; }
          @keyframes goOverlayIn { from { opacity: 0; transform: translateY(14px); } }
          .go-overlay { animation: goOverlayIn 0.22s cubic-bezier(0.22, 1, 0.36, 1); }
        `}</style>
        <h2 className="text-[22px] font-bold">{lot ? "tell us what you got" : "what are you selling?"}</h2>

        <p className="text-[16px] text-white/70 mt-1">
          {msgs.length > 0
            ? "your chat is saved — pick up where you left off."
            : lot
              ? "trays, shelves, mixed lots, cracked ones too."
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
            onClick={() => setChatOpen(true)}
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



      {/* full-screen immersive chat */}
      {chatOpen && (
        <div style={{ background: "#0a0a0b" }} className="go-overlay fixed inset-0 z-50 flex flex-col" role="dialog" aria-modal="true" aria-label="chat with top cash cellular">
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
            <button type="button" onClick={() => setChatOpen(false)} aria-label="close chat" className="w-[38px] h-[38px] rounded-full border border-white/15 text-white/70 text-[19px] flex items-center justify-center active:scale-95">
              ✕
            </button>
          </header>

          <div
            ref={threadRef}
            role="log"
            aria-live="polite"
            className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3"
            onScroll={(e) => {
              const el = e.currentTarget;
              nearBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
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
            {msgs.length === 0 && (
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
                const img = raw && (raw.startsWith("blob:") || /^https:\/\/[a-z0-9]+\.public\.blob\.vercel-storage\.com\/gochat-img\//i.test(raw)) ? raw : null;
                const body = img ? (
                  <span className="relative block">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={img} alt="device photo" className="block max-w-full rounded-xl" style={{ maxHeight: 260 }} />
                    {img.startsWith("blob:") && (
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
                    <div key={i} className="go-msg flex items-end gap-2">
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
                  <div key={i} className="go-msg flex items-end gap-2 justify-end">
                    <div className={`max-w-[80%] rounded-2xl rounded-br-md ${pad} text-[15px] bg-[#132018] border border-[#00c853]/30`}>
                      {body}
                    </div>
                    <SellerAvatar />
                  </div>
                ) : (
                  <div key={i} className="go-msg flex items-end gap-2">
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
                  <div key={i} className="go-msg flex items-end gap-2">
                    <img src="/icon-192.png" alt="" width={30} height={30} style={{ borderRadius: "50%" }} className="w-[30px] h-[30px] object-cover border border-[#00c853]/40 shrink-0" />
                    <div className="max-w-[85%] rounded-2xl rounded-bl-md px-4 py-3 text-[15px] bg-white/[0.06] border border-white/10">
                      {m.text}
                    </div>
                  </div>
                );
              }
              if (m.kind === "models") {
                return (
                  <div key={i} className={"go-msg ml-10 " + (m.done ? "opacity-40 pointer-events-none" : "")}>
                    <ModelPicker
                      rows={rowsFor(rows, m.group)}
                      line={m.line}
                      onLine={(key, label) => {
                        if (gBusy) return;
                        interactedRef.current = true;
                        logNote(`picked line ${label}`);
                        pushMsgs(
                          { from: "user", text: label },
                          { from: "bot", kind: "models", group: m.group, line: key },
                        );
                      }}
                      onPick={deviceTap}
                      onOther={() => {
                        pushMsgs(
                          { from: "user", text: "i don’t see mine" },
                          { from: "bot", text: "all good — type what you got (model + anything you know) and we’ll get you a number." },
                        );
                        setTimeout(() => overlayInputRef.current?.focus(), 60);
                      }}
                      busy={gBusy || !!m.done}
                    />
                  </div>
                );
              }
              if (m.kind === "chips") {
                return (
                  <div key={i} className={"go-msg ml-10 " + (m.done ? "opacity-40 pointer-events-none" : "")}>
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
                  <div key={i} className="go-msg flex items-end gap-2">
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
                  <div key={i} className={"go-msg ml-10 max-w-[85%] " + (m.done ? "opacity-40 pointer-events-none" : "")}>
                    <LockForm manual={m.manual} disabled={!!m.done} onLock={(c) => guidedLock(c, m.manual)} />
                  </div>
                );
              }
              if (m.kind === "msgr") {
                return (
                  <div key={i} className="go-msg ml-10 max-w-[85%]">
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
                  <div key={i} className="go-msg flex items-end gap-2">
                    <img src="/icon-192.png" alt="" width={30} height={30} style={{ borderRadius: "50%" }} className="w-[30px] h-[30px] object-cover border border-[#00c853]/40 shrink-0" />
                    <div className="max-w-[85%] rounded-2xl rounded-bl-md px-4 py-3 bg-white/[0.06] border border-[#00c853]/40">
                      <div className="text-[16px] font-semibold text-[#00c853]">
                        locked in{m.offer != null ? ` — $${m.offer.toLocaleString("en-US")}` : ""}.
                        {m.until && (
                          <span className="text-white/60 font-normal"> holds until {new Date(m.until).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "America/Chicago" })}.</span>
                        )}
                      </div>
                      <div className="text-[14px] text-white/70 mt-1">{m.confirmed === "sms" ? "we just texted you the details. " : m.confirmed === "email" ? "we just emailed you the details. " : m.confirmed === "pending" ? "we\u2019ll text you the details shortly. " : ""}{isDay ? "we\u2019ll reach out shortly to get you paid" : "we\u2019ll reach out first thing in the morning to get you paid"} — meet up in the austin area or we send a free shipping label, your pick.</div>
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

            {msgs.length === 0 && (
              <div className="flex flex-wrap gap-2 ml-10">
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
              </div>
            )}
          </div>

          {/* Photo affordance — stays until they've sent one, so the option is
              discoverable even after the greeting scrolls away. Tapping it opens
              the picker too. */}
          {!msgs.some((m) => !("kind" in m) && m.text.startsWith("IMG::")) && (
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="mx-4 mb-1 flex items-center justify-center gap-1.5 text-[12px] text-white/50 py-1 active:scale-[0.98] disabled:opacity-40"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M14.5 4h-5L7.8 6H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-3.8L14.5 4z" />
                <circle cx="12" cy="13" r="3.6" />
              </svg>
              tap to add a photo of your device — helps us price it
            </button>
          )}

          <form
            className="flex gap-2 items-center px-4 py-3 border-t border-white/10"
            style={{ background: "#0e0e0f", paddingBottom: "max(12px, env(safe-area-inset-bottom))" }}
            onSubmit={(e) => { e.preventDefault(); void send(draft); }}
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
                if (fs.length) void sendPhotos(fs);
              }}
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              aria-label="send a photo of your device"
              className={`w-[46px] h-[46px] shrink-0 rounded-full bg-white/[0.06] border flex items-center justify-center disabled:opacity-40 active:scale-95 transition-transform ${msgs.some((m) => !("kind" in m) && m.text.startsWith("IMG::")) ? "border-white/15 text-white/75" : "border-[#00c853]/45 text-[#00c853]"}`}
              style={{ borderRadius: "50%" }}
            >
              {uploading ? (
                <span className="go-dot" />
              ) : (
                <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M14.5 4h-5L7.8 6H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-3.8L14.5 4z" />
                  <circle cx="12" cy="13" r="3.6" />
                </svg>
              )}
            </button>
            <input
              id="go-composer-input"
              ref={overlayInputRef}
              className="flex-1 px-4 py-3 rounded-full bg-white/[0.06] border border-white/15 text-[17px] text-white placeholder-white/40 focus:outline-none focus:border-[#00c853]"
              placeholder={lot ? "i got 15 phones, need cash today…" : "i got 4 phones for sale…"}
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
        </div>
      )}

      {/* footer — real business, real pages */}
      <footer className="mt-10 pt-4 border-t border-white/10 text-[13px] text-white/50">
        <p>TOP CASH CELLULAR LLC · austin tx</p>
        <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
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
    </main>
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

// One field + one tap. The 18+/ownership attestation is the button label
// itself (tapping affirms it — the server still records [ATTEST: yes]), and
// the line under it is the express consent for the texts about this quote.
function LockForm({ manual, disabled, onLock }: { manual: boolean; disabled: boolean; onLock: (c: string) => Promise<string | null> }) {
  const [c, setC] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    if (busy || disabled) return;
    setBusy(true);
    setErr("");
    const e = await onLock(c);
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

