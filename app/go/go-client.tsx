"use client";

// /go interactive surface: the board (tap → HOLD → three chips → real
// number → lock), and the composer (type → /api/chat, the same brain as
// Messenger but with site-chat policy: it quotes singles, lots go to the
// team).
//
// Brand rules honored here: dark only, green is a crisp accent (no glow),
// seller language (lock in / get paid, never cart-speak), company voice
// ("we"), and every dollar figure on screen came from the engine — the
// client never invents or caches a price.
import { useEffect, useRef, useState } from "react";
import type { BoardRow } from "./board";
import { pixelTrack } from "../components/MetaPixel";

export type GoReviews = {
  avg: number;
  count: number;
  top: { name: string; body: string; device: string; city: string }[];
};

const STORAGE_LABELS: Record<string, string> = {
  "64": "64 gb", "128": "128 gb", "256": "256 gb", "512": "512 gb", "1tb": "1 tb", "2tb": "2 tb",
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
  { key: "other", label: "other" },
];
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
const CATEGORIES: { key: string; label: string; img: string; deterministic?: "ip" | "gs" }[] = [
  { key: "iphone", label: "iPhone", img: "/devices/iphone-16-pro-max.webp", deterministic: "ip" },
  { key: "samsung", label: "Samsung", img: "/devices/gs25u.webp", deterministic: "gs" },
  { key: "macbook", label: "MacBook", img: "/devices/macbook-pro-m4.webp" },
  { key: "ipad", label: "iPad", img: "/ipadbase.webp" },
  { key: "console", label: "Console", img: "/ps5-series.webp" },
  { key: "other", label: "Something else", img: "/fold-series.webp" },
];

type Msg =
  | { from: "user" | "bot" | "owner"; text: string }
  | { from: "bot"; kind: "models"; prefix: "ip" | "gs"; done?: boolean }
  | { from: "bot"; kind: "chips"; q: string; dim: "storage" | "condition" | "carrier" | "another"; options: { key: string; label: string }[]; done?: boolean }
  | { from: "bot"; kind: "quote"; label: string; offer: number; done?: boolean }
  | { from: "bot"; kind: "lockform"; manual: boolean; done?: boolean }
  | { from: "bot"; kind: "locked"; offer: number | null }
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

export default function GoClient({ rows, src, reviews, variant = "std" }: { rows: BoardRow[]; src: string; reviews: GoReviews; variant?: "std" | "lot" }) {
  const lot = variant === "lot";
  // ---- board / HOLD state ----
  const [openId, setOpenId] = useState<string | null>(null);
  const [step, setStep] = useState(0); // 0 storage · 1 condition · 2 carrier · 3 done
  const [spec, setSpec] = useState<{ storage?: string; condition?: string; carrier?: string }>({});
  const [held, setHeld] = useState(0); // current on-screen number (engine-sourced)
  const [cause, setCause] = useState(""); // why the number last moved
  const [manual, setManual] = useState(false);
  const [quoting, setQuoting] = useState(false);
  // ---- lock state ----
  const [locking, setLocking] = useState(false);
  const [locked, setLocked] = useState(false);
  const [lockErr, setLockErr] = useState("");
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [attest, setAttest] = useState(false);
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
  const [gSpec, setGSpec] = useState<{ storage?: string; condition?: string; carrier?: string }>({});
  const [gBusy, setGBusy] = useState(false);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  // Photo attach — the flaw a phone-buyback chat can't have: sellers WANT to
  // show the crack. File input is hidden; the camera button triggers it.
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [sessionId] = useState(() => persistentSessionId(src));
  const threadRef = useRef<HTMLDivElement>(null);
  // Guards the async chip flow against row-switching: a response for a row
  // that is no longer open must be discarded, never applied to the new row.
  const openIdRef = useRef<string | null>(null);
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
  useEffect(() => {
    if (restoredRef.current) return;
    restoredRef.current = true;
    void (async () => {
      try {
        const r = await fetch(`/api/go/chat-sync?session=${sessionId}&after=0&full=1`, { cache: "no-store" });
        if (!r.ok) return;
        const d = await r.json();
        if (Array.isArray(d?.msgs) && d.msgs.length) {
          setMsgs((cur) => (cur.length ? cur : d.msgs.map((m: { role: string; text: string }) => ({
            from: m.role === "user" ? ("user" as const) : m.role === "owner" ? ("owner" as const) : ("bot" as const),
            text: String(m.text),
          }))));
        }
        if (typeof d?.lastTs === "number" && d.lastTs > lastSyncRef.current) lastSyncRef.current = d.lastTs;
        if (typeof d?.takeover === "boolean") setTakeover(d.takeover);
      } catch { /* fresh thread */ }
    })();
  }, [sessionId]);

  // Guided-funnel breadcrumbs for the owner console — the chip flow never
  // touches /api/chat, so quote/lock milestones are logged here instead.
  function logNote(text: string) {
    void fetch("/api/go/chat-sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session: sessionId, text }),
    }).catch(() => {});
  }

  // COMEBACK NUDGE: a seller who had a real number on screen, left the tab for
  // 30s+, and came back is the highest-risk/highest-intent moment on the page —
  // one bubble asking for their phone (so the reminder can reach them even if
  // they leave for good) plus, when configured, a "keep this chat on Messenger"
  // card. One-shot per page load; never fires once they've locked.
  const awayNudgedRef = useRef(false);
  const hiddenAtRef = useRef(0);
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === "hidden") {
        hiddenAtRef.current = Date.now();
        return;
      }
      if (awayNudgedRef.current) return;
      if (!hiddenAtRef.current || Date.now() - hiddenAtRef.current < 30_000) return;
      setMsgs((cur) => {
        if (awayNudgedRef.current) return cur;
        const hasQuote = cur.some((m) => "kind" in m && (m.kind === "quote" || m.kind === "lockform"));
        const isLocked = cur.some((m) => "kind" in m && m.kind === "locked");
        if (!hasQuote || isLocked) return cur;
        awayNudgedRef.current = true;
        logNote("seller left and came back — nudged for number" + (MSGR_HANDLE ? " + messenger" : ""));
        return [
          ...cur,
          { from: "bot", text: "welcome back — your number’s still good. drop your phone number and we’ll text it to you so it’s saved even if you head out." },
          ...(MSGR_HANDLE ? [{ from: "bot" as const, kind: "msgr" as const }] : []),
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
    if (nudgedRef.current) return;
    if (!msgs.some((m) => "kind" in m && m.kind === "lockform" && !m.done)) return;
    const t = setTimeout(() => {
      setMsgs((cur) => {
        if (nudgedRef.current) return cur;
        if (!cur.some((m) => "kind" in m && m.kind === "lockform" && !m.done)) return cur;
        nudgedRef.current = true;
        return [...cur, { from: "bot", text: "just your number works — we’ll text you the quote so you don’t lose it." }];
      });
    }, 25000);
    return () => clearTimeout(t);
  }, [msgs]);

  const row = rows.find((r) => r.id === openId) || null;

  function openRow(r: BoardRow) {
    if (openId === r.id) { setOpenId(null); openIdRef.current = null; return; }
    setOpenId(r.id);
    openIdRef.current = r.id;
    pixelTrack("ViewContent", { content_name: r.label, content_category: "board" });
    setStep(0);
    setSpec({});
    setHeld(r.upTo);
    setCause("");
    setManual(false);
    setLocked(false);
    setLockErr("");
    setQuoteErr(false);
  }

  // One chip answered → re-quote with ceiling defaults on the unanswered
  // dims, so the number only ever moves because of a fact the seller gave.
  // The step only advances on a real engine answer: {ok} moves the number
  // with the tapped chip as the cause; {manualReview} exits to the honest
  // hand-quote path. A transient network/429 failure does NEITHER — it
  // re-enables the chips with a retry line, because telling a seller "we
  // price this one by hand" over a dropped packet is a lie that costs the
  // instant close.
  const [quoteErr, setQuoteErr] = useState(false);
  async function answer(dim: "storage" | "condition" | "carrier", key: string, label: string) {
    if (!row || quoting) return;
    const rid = row.id;
    const next = { ...spec, [dim]: key };
    setQuoting(true);
    setQuoteErr(false);
    try {
      const res = await fetch("/api/go/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: row.id,
          storage: next.storage ?? row.bestStorage,
          condition: next.condition ?? "sealed",
          carrier: next.carrier ?? "unlocked",
        }),
      });
      const d = await res.json();
      if (openIdRef.current !== rid) { setQuoting(false); return; } // row switched mid-flight
      if (d?.ok && typeof d.offer === "number") {
        setSpec(next);
        setHeld(d.offer);
        setCause(label);
        setManual(false);
        setStep((s) => s + 1);
      } else if (d?.manualReview) {
        setSpec(next);
        setManual(true);
        setStep((s) => s + 1);
      } else {
        setQuoteErr(true);
      }
    } catch {
      setQuoteErr(true);
    }
    setQuoting(false);
  }

  async function lockIn() {
    if (!row || locking) return;
    if (!contact.trim()) { setLockErr("we need a number or email to reach you"); return; }
    if (!attest) { setLockErr("check the box so we know it's yours to sell"); return; }
    setLockErr("");
    setLocking(true);
    try {
      const res = await fetch("/api/go/lock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: row.id,
          storage: spec.storage ?? row.bestStorage,
          condition: spec.condition ?? "sealed",
          carrier: spec.carrier ?? "unlocked",
          name: name.trim(),
          contact: contact.trim(),
          attest: true,
          src,
          sessionId,
        }),
      });
      const d = await res.json();
      if (d?.ok) {
        if (typeof d.offer === "number" && d.offer !== held && !manual) {
          // The engine moved since they tapped (a live price edit mid-
          // session). Locking a number they never saw is the bait-and-switch
          // this page exists to kill — show the live number and make the
          // lock an explicit second tap.
          setHeld(d.offer);
          setCause("prices just updated — this is the live number");
          setLockErr("the live number is $" + d.offer + " — tap again to lock that");
        } else {
          // Engine returned no number at lock time (device flipped to
          // manual-review mid-session): don't leave a stale figure on
          // screen under a "locked" banner — the locked card's copy holds
          // for both cases, but the number must not.
          if (!manual && typeof d.offer !== "number") setManual(true);
          pixelTrack("Lead", {
            content_name: row.label,
            value: typeof d.offer === "number" ? d.offer : 0,
            currency: "USD",
          });
          setLocked(true);
        }
      } else {
        setLockErr(d?.error || "that didn't go through — try again");
      }
    } catch {
      setLockErr("that didn't go through — try again");
    }
    setLocking(false);
  }

  // Retire interactivity on every previous rich message; append new ones.
  function pushMsgs(...add: Msg[]) {
    setMsgs((m) => [...m.map((x) => ("kind" in x ? { ...x, done: true } : x)), ...add]);
  }

  function categoryTap(cat: (typeof CATEGORIES)[number]) {
    if (gBusy) return;
    setChatOpen(true);
    if (cat.deterministic) {
      pushMsgs(
        { from: "user", text: cat.label },
        { from: "bot", text: "solid — which one is it? older models work too, just type the model." },
        { from: "bot", kind: "models", prefix: cat.deterministic },
      );
    } else {
      // AI runs the intake for everything off the quick path
      void send(cat.key === "other" ? "i got something else to sell" : `i got a ${cat.label.toLowerCase()} to sell`);
    }
  }

  function deviceTap(r: BoardRow) {
    if (gBusy) return;
    setChatOpen(true);
    setGRow(r);
    setGSpec({});
    pixelTrack("ViewContent", { content_name: r.label, content_category: "chat" });
    pushMsgs(
      { from: "user", text: r.label },
      { from: "bot", text: `good one — up to $${r.upTo} depending on specs. what storage is it?` },
      { from: "bot", kind: "chips", q: "", dim: "storage", options: r.storages.map((x) => ({ key: x, label: STORAGE_LABELS[x] || x })) },
    );
  }

  async function chipTap(dim: "storage" | "condition" | "carrier" | "another", key: string, label: string) {
    if (gBusy) return;
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
      if (key === "ip" || key === "gs") {
        pushMsgs(
          { from: "user", text: label },
          { from: "bot", text: "nice — which one is it?" },
          { from: "bot", kind: "models", prefix: key },
        );
      } else {
        pushMsgs({ from: "user", text: label });
        void send("i got something else to sell too");
      }
      return;
    }
    if (!gRow) return;
    const spec = { ...gSpec, [dim]: key };
    setGSpec(spec);
    if (dim === "storage") {
      pushMsgs(
        { from: "user", text: label },
        { from: "bot", kind: "chips", q: "what kind of shape is it in?", dim: "condition", options: CONDITIONS },
      );
      return;
    }
    if (dim === "condition") {
      pushMsgs(
        { from: "user", text: label },
        // Financed/carrier-locked sellers arrive believing they can't sell
        // (Swappa refuses them) — say the opposite here, at the exact chip
        // that raises the doubt. Same fact the chat brain already states.
        { from: "bot", kind: "chips", q: "locked to a carrier? still making payments is fine too — we buy those.", dim: "carrier", options: CARRIERS },
      );
      return;
    }
    // carrier answered → quote once with the full spec
    setGBusy(true);
    pushMsgs({ from: "user", text: label });
    try {
      const res = await fetch("/api/go/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: gRow.id, storage: spec.storage, condition: spec.condition, carrier: key }),
      });
      const d = await res.json();
      if (d?.ok && typeof d.offer === "number") {
        // Quote + capture in ONE beat — the form rides with the number, no
        // extra tap. InitiateCheckout marks quote-viewers on the pixel so
        // non-lockers become a retargeting audience (Lead still fires only
        // on lock).
        pixelTrack("InitiateCheckout", { content_name: gRow.label, value: d.offer, currency: "USD" });
        logNote(`quote shown: ${gRow.label} ${spec.storage || ""} ${spec.condition || ""} ${key} → $${d.offer}`);
        pushMsgs(
          { from: "bot", kind: "quote", label: `${gRow.label} ${STORAGE_LABELS[spec.storage || ""] || ""}`, offer: d.offer },
          { from: "bot", kind: "lockform", manual: false },
        );
      } else {
        pushMsgs(
          { from: "bot", text: "this one we price by hand — drop your number and we\u2019ll text you a real offer." },
          { from: "bot", kind: "lockform", manual: true },
        );
      }
    } catch {
      pushMsgs({ from: "bot", text: "hit a snag pulling the number — tap the carrier again for me." });
    }
    setGBusy(false);
  }

  async function guidedLock(gName: string, gContact: string, gAttest: boolean, manualFlavor: boolean): Promise<string | null> {
    if (!gRow) return "something went sideways — tap your phone again";
    if (!gContact.trim()) return "we need a number or email to reach you";
    if (!gAttest) return "check the box so we know it\u2019s yours to sell";
    setGBusy(true);
    // Per-lock dedup id, shared with the server: the pixel Lead and the
    // Conversions API Lead carry the SAME event id, so Meta keeps one copy.
    // Per-lock (not per-session) because "got another one?" means a session
    // can lock several devices, each its own conversion.
    const lockEventId = `lock-${sessionId}-${Date.now().toString(36)}`;
    try {
      const res = await fetch("/api/go/lock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: gRow.id,
          storage: gSpec.storage ?? gRow.bestStorage,
          condition: gSpec.condition ?? "good",
          carrier: gSpec.carrier ?? "unlocked",
          name: gName.trim(),
          contact: gContact.trim(),
          attest: true,
          src,
          sessionId,
          eventId: lockEventId,
        }),
      });
      const d = await res.json();
      setGBusy(false);
      if (d?.ok) {
        pixelTrack("Lead", { content_name: gRow.label, value: typeof d.offer === "number" ? d.offer : 0, currency: "USD" }, lockEventId);
        logNote(`LOCKED: ${gRow.label}${typeof d.offer === "number" ? ` $${d.offer}` : " (manual)"} — ${gContact.trim().slice(0, 60)}`);
        // Peak trust: they just saw a real number and handed over a way to
        // reach them. Ask for the second device HERE — every affordance
        // (category grid, "i got a few phones" chip) is gated on an empty
        // thread, so without this the locked card is a dead end and a
        // 3-device seller silently becomes a 1-device seller.
        pushMsgs(
          { from: "bot", kind: "locked", offer: typeof d.offer === "number" && !manualFlavor ? d.offer : null },
          {
            from: "bot",
            kind: "chips",
            q: "got another one?",
            dim: "another",
            options: [
              { key: "ip", label: "another iPhone" },
              { key: "gs", label: "a Samsung" },
              { key: "other", label: "something else" },
              { key: "no", label: "that’s it for now" },
            ],
          },
        );
        return null;
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
    setDraft("");
    const history = msgs.filter((m): m is { from: "user" | "bot"; text: string } => !("kind" in m)).map((m) => ({ from: m.from === "user" ? "user" : "bot", text: m.text }));
    setMsgs((m) => [...m, { from: "user", text: t }]);
    setSending(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: t, history, sessionId }),
      });
      const d = await res.json();
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
      if ((d?.takeover && !d?.reply) || takeoverRef.current) setTakeover(true);
      else setMsgs((m) => [...m, { from: "bot", text: d?.reply || "hang on — try that again in a sec" }]);
    } catch {
      setMsgs((m) => [...m, { from: "bot", text: "we're having a moment — try that again, or tap your phone above and we'll price it." }]);
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
    const MAX_BATCH = 6;
    const batch = files.slice(0, MAX_BATCH); // per-pick cap; they can attach again
    const history = msgs.filter((m): m is { from: "user" | "bot"; text: string } => !("kind" in m)).map((m) => ({ from: m.from === "user" ? "user" : "bot", text: m.text }));
    // A number is already on screen (guided quote/lock card) — a photo must NOT
    // trigger an AI reply that could name a DIFFERENT number under it (the
    // two-numbers bait-and-switch this page exists to avoid). The photo still
    // uploads, pings Sonny, and is stored; we just don't run the model turn.
    const quoteOnScreen = msgs.some((m) => "kind" in m && (m.kind === "quote" || m.kind === "lockform" || m.kind === "locked"));
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
          body: JSON.stringify({ message: `IMG::${last}`, history: batchHistory, sessionId }),
        });
        const dd = await res.json();
        if ((dd?.takeover && !dd?.reply) || takeoverRef.current) setTakeover(true);
        else if (dd?.reply) setMsgs((m) => [...m, { from: "bot", text: dd.reply }]);
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

  const stepUi =
    row && !locked && !manual && step < 3 ? (
      step === 0 ? (
        <ChipRow
          q="what storage is it"
          chips={row.storages.map((s) => ({ key: s, label: STORAGE_LABELS[s] || s }))}
          onPick={(k, l) => answer("storage", k, l)}
          disabled={quoting}
        />
      ) : step === 1 ? (
        <ChipRow q="what kind of shape is it in" chips={CONDITIONS} onPick={(k, l) => answer("condition", k, l)} disabled={quoting} />
      ) : (
        <ChipRow q="locked to a carrier" chips={CARRIERS} onPick={(k, l) => answer("carrier", k, l)} disabled={quoting} />
      )
    ) : null;

  return (
    <main className="min-h-screen bg-[#0a0a0a] text-white px-4 pb-16 pt-3" style={{ maxWidth: 560, margin: "0 auto" }}>
      {/* header */}
      <header className="flex items-center justify-between py-2" aria-label="Top Cash Cellular">
        <div className="text-[16px] font-semibold tracking-tight">
          top cash <span className="text-[#00c853]">cellular</span>
        </div>
        <div className="text-[12px] text-white/50">{status}</div>
      </header>

      {/* headline */}
      <h1 className="text-[30px] leading-[1.1] font-extrabold mt-4">
        {lot ? "we buy phones — singles or the whole lot" : "sell your phone — cash in hand today"}
      </h1>
      <p className="text-[15px] text-white/60 mt-2">
        {lot ? "tell us what you got. cash the same day, no email, no signup." : "tap what you got — real number in 30 seconds. no email, no signup."}
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
        <h2 className="text-[17px] font-bold">{lot ? "tell us what you got" : "what are you selling?"}</h2>

        <div
          role="button"
          tabIndex={0}
          onClick={() => setChatOpen(true)}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setChatOpen(true); } }}
          className="mt-3 w-full text-left rounded-3xl border border-white/10 bg-white/[0.03] p-3 active:scale-[0.99] transition-transform cursor-pointer"
          aria-haspopup="dialog"
        >
          <div className="flex items-end gap-2">
            <img src="/icon-192.png" alt="" width={30} height={30} style={{ borderRadius: "50%" }} className="w-[30px] h-[30px] object-cover border border-[#00c853]/40 shrink-0" />
            <div className="max-w-[85%]">
              <div className="text-[12px] text-white/40 mb-1 ml-1">top cash <span className="text-[#00c853]">cellular</span></div>
              <div className="rounded-2xl rounded-bl-md px-4 py-3 text-[15px] bg-white/[0.06] border border-white/10 leading-snug">
                {msgs.length > 0
                  ? "tap to keep the conversation going"
                  : lot
                    ? "welcome — tell us what you got. trays, shelves, mixed lots, cracked ones too."
                    : "tap what you got — real number in 30 seconds. cracked or still on payments, we still buy it."}
              </div>
            </div>
          </div>
          {/* one tap = straight into the full-screen picker for that category */}
          <div className="mt-3 ml-10 grid grid-cols-3 gap-2">
            {CATEGORIES.map((c) => (
              <button key={c.key} type="button" disabled={gBusy}
                onClick={(e) => { e.stopPropagation(); categoryTap(c); }}
                className="rounded-2xl border border-white/10 bg-white/[0.06] p-2 text-center active:scale-95 transition-transform">
                <span className="rounded-xl bg-white flex items-center justify-center mx-auto" style={{ height: 56 }}>
                  <img src={c.img} alt="" className="max-h-[48px] max-w-[80%] object-contain" />
                </span>
                <span className="block text-[13px] font-semibold mt-1.5 text-white">{c.label}</span>
              </button>
            ))}
          </div>
          <div className="mt-3 ml-10 flex items-center gap-2 rounded-full bg-white/[0.06] border border-white/15 px-4 py-3">
            <span className="flex-1 text-[16px] text-white/40">{lot ? "i got 15 phones, need cash today…" : "or just type it — i got 4 phones…"}</span>
            <span className="tcc-button-primary w-[38px] h-[38px] shrink-0 text-[18px] font-bold flex items-center justify-center" style={{ borderRadius: "50%" }}>↑</span>
          </div>
        </div>
      </section>

      {/* trust line */}
      <p className="text-[13px] text-white/60 mt-3">
        the number we quote is the number we pay if it matches what you told us · same-day cash in the austin area · free shipping label anywhere ·{" "}
        <a href="/reviews" className="underline text-white/60">reviews from paid sellers</a>
      </p>

      {/* how it works — offer → meetup → cash, three beats
          (Sonny 2026-08-19: "way too much text — it should be offer meetup cash") */}
      <section className="mt-7" aria-label="how it works">
        <h2 className="text-[17px] font-bold">how this works</h2>
        <ol className="mt-3 flex flex-col gap-2 text-[14px] text-white/75">
          <li className="flex gap-3">
            <span className="text-[#00c853] font-bold shrink-0">1</span>
            <span><b className="text-white font-semibold">offer</b> — tap what you got, get your number. locked 14 days.</span>
          </li>
          <li className="flex gap-3">
            <span className="text-[#00c853] font-bold shrink-0">2</span>
            <span><b className="text-white font-semibold">meetup</b> — public spot in austin, or free shipping label.</span>
          </li>
          <li className="flex gap-3">
            <span className="text-[#00c853] font-bold shrink-0">3</span>
            {/* answers the "…if it matches what you told us" caveat the page
                raises twice and otherwise never resolves */}
            <span><b className="text-white font-semibold">cash</b> — we check it while you watch, you get paid on the spot. if something&rsquo;s different than you described, we show you what we found and give you the updated number — your call from there.</span>
          </li>
        </ol>
      </section>

      {/* real verified reviews — collapsed to one line; the cards only
          render if the visitor asks for them (Sonny 2026-08-19: "don't
          force the review on people, just have it there if they want") */}
      {reviews.count >= 5 && reviews.top.length > 0 && (
        <section className="mt-6" aria-label="reviews from verified sellers">
          {!showReviews ? (
            <button
              type="button"
              onClick={() => setShowReviews(true)}
              aria-expanded={false}
              className="text-[14px] text-white/65 py-2"
            >
              <span className="text-[#00c853] font-semibold">{reviews.avg}★</span> from {reviews.count} people we&rsquo;ve paid — see what they say →
            </button>
          ) : (
            <div>
              <h2 className="text-[17px] font-bold">{reviews.avg}★ from people we&rsquo;ve paid</h2>
              <div className="mt-3 flex flex-col gap-2">
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
            </div>
          )}
        </section>
      )}



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
                      <img src="/icon-192.png" alt="" width={30} height={30} style={{ borderRadius: "50%" }} className="w-[30px] h-[30px] object-cover border-2 border-[#00c853] shrink-0" />
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
              if (m.kind === "models") {
                return (
                  <div key={i} className={"go-msg ml-10 " + (m.done ? "opacity-40 pointer-events-none" : "")}>
                    <DeviceCarousel
                      rows={rows.filter((r) => r.id.startsWith(m.prefix))}
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
                      <div className="text-[32px] font-extrabold text-[#00c853]" style={{ fontVariantNumeric: "tabular-nums" }}>${m.offer}</div>
                      <div className="text-[13px] text-white/60 mt-1">that&rsquo;s your number if it matches what you told us — locked for 14 days. drop your number below and we&rsquo;ll text it to you.</div>
                    </div>
                  </div>
                );
              }
              if (m.kind === "lockform") {
                return (
                  <div key={i} className={"go-msg ml-10 max-w-[85%] " + (m.done ? "opacity-40 pointer-events-none" : "")}>
                    <LockForm manual={m.manual} disabled={!!m.done} onLock={(n, c, a2) => guidedLock(n, c, a2, m.manual)} />
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
                      <div className="text-[16px] font-semibold text-[#00c853]">locked in{m.offer != null ? ` — $${m.offer}` : ""}.</div>
                      <div className="text-[14px] text-white/70 mt-1">{isDay ? "we\u2019ll reach out shortly to get you paid" : "we\u2019ll reach out first thing in the morning to get you paid"} — meet up in the austin area or we send a free shipping label, your pick.</div>
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

      {/* long tail */}
      <p className="mt-8 text-[14px]">
        <a href="/" className="text-white/60 underline">everything else — laptops, consoles, watches →</a>
      </p>

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

function DeviceCarousel({ rows, onPick, onOther, busy }: { rows: BoardRow[]; onPick: (r: BoardRow) => void; onOther?: () => void; busy: boolean }) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1" style={{ scrollbarWidth: "none" }}>
      {rows.map((r) => (
        <button
          key={r.id}
          type="button"
          disabled={busy}
          onClick={() => onPick(r)}
          className="shrink-0 w-[118px] rounded-2xl border border-white/10 bg-white/[0.06] p-2 text-left active:scale-95 transition-transform"
        >
          <div className="rounded-xl bg-white p-1.5 flex items-center justify-center" style={{ height: 86 }}>
            {/* lazy + async: the carousel renders ~28 cards for a line but
                shows 3 — eager loading fired ~1.5MB the instant a seller
                tapped iPhone, stalling the cards they can actually see on
                LTE inside the Facebook in-app browser. */}
            <img src={r.img} alt="" loading="lazy" decoding="async" width={96} height={96} className="max-h-full max-w-full object-contain" style={{ borderRadius: 8 }} />
          </div>
          <div className="text-[13px] font-semibold mt-1.5 leading-tight text-white">{r.label}</div>
        </button>
      ))}
      {onOther && (
        <button
          type="button"
          disabled={busy}
          onClick={onOther}
          className="shrink-0 w-[118px] rounded-2xl border border-[#00c853]/35 bg-white/[0.06] p-2 text-left active:scale-95 transition-transform"
        >
          <div className="rounded-xl border border-dashed border-white/25 flex items-center justify-center" style={{ height: 86 }}>
            <span className="text-[27px] font-bold text-[#00c853]">?</span>
          </div>
          <div className="text-[13px] font-semibold mt-1.5 leading-tight text-white">don&rsquo;t see yours? tell us</div>
        </button>
      )}
    </div>
  );
}

function LockForm({ manual, disabled, onLock }: { manual: boolean; disabled: boolean; onLock: (n: string, c: string, a: boolean) => Promise<string | null> }) {
  const [n, setN] = useState("");
  const [c, setC] = useState("");
  const [a, setA] = useState(false);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <div className="flex flex-col gap-2">
      <input className="px-4 py-3 rounded-full bg-white/[0.06] border border-white/15 text-[17px] text-white placeholder-white/40 focus:outline-none focus:border-[#00c853]" placeholder="name (optional)" value={n} onChange={(e) => setN(e.target.value)} autoComplete="name" disabled={disabled} />
      <input className="px-4 py-3 rounded-full bg-white/[0.06] border border-white/15 text-[17px] text-white placeholder-white/40 focus:outline-none focus:border-[#00c853]" placeholder="your number — we text you the quote" value={c} onChange={(e) => setC(e.target.value)} autoComplete="tel" disabled={disabled} />
      <label className="flex items-start gap-2 text-[13px] text-white/60">
        <input type="checkbox" checked={a} onChange={(e) => setA(e.target.checked)} className="mt-[2px] accent-[#00c853]" disabled={disabled} />
        <span>i&rsquo;m 18+ and this device is mine to sell</span>
      </label>
      {err && <p className="text-[13px] text-red-400" role="alert">{err}</p>}
      <button
        type="button"
        disabled={disabled || busy}
        onClick={async () => { setBusy(true); setErr(""); const e = await onLock(n, c, a); if (e) setErr(e); setBusy(false); }}
        className="tcc-button-primary py-3 text-[16px] font-bold rounded-2xl disabled:opacity-40"
      >
        {busy ? "locking…" : manual ? "send me a real offer" : "Lock In My Offer"}
      </button>
    </div>
  );
}

function ChipRow({
  q, chips, onPick, disabled,
}: {
  q: string;
  chips: { key: string; label: string }[];
  onPick: (key: string, label: string) => void;
  disabled: boolean;
}) {
  return (
    <div className="mt-3">
      <p className="text-[14px] text-white/70 mb-2">{q}</p>
      <div className="flex flex-wrap gap-2">
        {chips.map((c) => (
          <button
            key={c.key}
            type="button"
            disabled={disabled}
            onClick={() => onPick(c.key, c.label)}
            className="text-[14px] text-white/85 border border-white/20 rounded-full px-4 py-[11px] disabled:opacity-50"
          >
            {c.label}
          </button>
        ))}
      </div>
    </div>
  );
}
