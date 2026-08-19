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

type Msg = { from: "user" | "bot"; text: string };

function newSessionId(src: string) {
  const rand = Math.random().toString(36).slice(2, 10);
  return `go${src ? `-${src}` : ""}-${rand}`.slice(0, 24);
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
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [sessionId] = useState(() => newSessionId(src));
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
  useEffect(() => {
    threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight, behavior: "smooth" });
  }, [msgs, sending]);

  const row = rows.find((r) => r.id === openId) || null;

  function openRow(r: BoardRow) {
    if (openId === r.id) { setOpenId(null); openIdRef.current = null; return; }
    setOpenId(r.id);
    openIdRef.current = r.id;
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

  async function send(text: string) {
    const t = text.trim();
    if (!t || sending) return;
    setDraft("");
    const history = msgs.map((m) => ({ from: m.from === "user" ? "user" : "bot", text: m.text }));
    setMsgs((m) => [...m, { from: "user", text: t }]);
    setSending(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: t, history, sessionId }),
      });
      const d = await res.json();
      setMsgs((m) => [...m, { from: "bot", text: d?.reply || "hang on — try that again in a sec" }]);
    } catch {
      setMsgs((m) => [...m, { from: "bot", text: "we're having a moment — try again, or tap your phone on the board above" }]);
    }
    setSending(false);
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
        <div className="text-[15px] font-semibold tracking-tight">
          top cash <span className="text-[#00c853]">cellular</span>
        </div>
        <div className="text-[11px] text-white/50">{status}</div>
      </header>

      {/* headline */}
      <h1 className="text-[28px] leading-[1.1] font-extrabold mt-4">
        {lot ? "we buy phones — singles or the whole lot" : "here\u2019s what we\u2019re paying right now"}
      </h1>
      <p className="text-[14px] text-white/60 mt-2">
        {lot ? "tell us what you got. cash the same day, no email, no signup." : "tap yours. no email, no signup."}
      </p>

      {lot && (
        <button
          type="button"
          onClick={() => {
            document.getElementById("go-composer")?.scrollIntoView({ behavior: "smooth", block: "center" });
            document.getElementById("go-composer-input")?.focus();
          }}
          className="mt-4 w-full rounded-2xl border border-[#00c853] px-4 py-3 text-left text-[14px] font-semibold text-[#00c853]"
        >
          selling more than a couple? start here →
        </button>
      )}

      {/* the board */}
      {rows.length === 0 ? (
        <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.06] p-5">
          <p className="text-[14px] text-white/80">
            prices are updating right now — <a href="/" className="underline">get your instant quote here</a> or ask us below.
          </p>
        </div>
      ) : (
      <div className="tcc-selection-frame mt-5">
        {rows.map((r, i) => (
          <div key={r.id}>
            {i > 0 && <div className="h-px mx-1" style={{ background: "rgba(255,255,255,0.14)" }} />}
            <button
              type="button"
              onClick={() => openRow(r)}
              aria-expanded={openId === r.id}
              className="w-full flex items-center justify-between px-3 py-[14px] text-left"
            >
              <span className="text-[15px] font-semibold">{r.label}</span>
              <span className="text-[15px] font-semibold text-[#00c853]" style={{ fontVariantNumeric: "tabular-nums" }}>
                up to ${r.upTo}
              </span>
            </button>

            {openId === r.id && (
              <div className="px-3 pb-4 tcc-fade-in">
                {/* the HOLD */}
                <div className="flex items-baseline gap-3">
                  <span className="text-[34px] font-extrabold text-[#00c853]" style={{ fontVariantNumeric: "tabular-nums" }} aria-live="polite">
                    {manual ? "—" : `$${held}`}
                  </span>
                  <span className="text-[12px] text-white/50">
                    {manual
                      ? "this one we price by hand"
                      : cause
                        ? `${cause} — that puts it here`
                        : step === 0
                          ? "that's the top number. three quick ones and we lock yours."
                          : ""}
                  </span>
                </div>

                {stepUi}

                {quoteErr && (
                  <p className="text-[12px] text-amber-400 mt-2" role="alert">
                    hit a snag — tap that again
                  </p>
                )}

                {/* manual-review path: honest, no guessed number */}
                {manual && !locked && (
                  <p className="text-[13px] text-white/70 mt-2">
                    drop your number below and we&rsquo;ll send you a real offer {isDay ? "today" : "in the morning"}.
                  </p>
                )}

                {/* lock step */}
                {(step >= 3 || manual) && !locked && (
                  <div className="mt-3 flex flex-col gap-2">
                    {!manual && (
                      <p className="text-[13px] text-white/70">
                        that&rsquo;s your number if the phone matches what you told us — we confirm it in person, and it&rsquo;s locked for 14 days.
                      </p>
                    )}
                    <input
                      className="tcc-input w-full px-4 py-3"
                      placeholder="name (optional)"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      autoComplete="name"
                    />
                    <input
                      className="tcc-input w-full px-4 py-3"
                      placeholder="phone or email"
                      value={contact}
                      onChange={(e) => setContact(e.target.value)}
                      autoComplete="tel"
                      inputMode="text"
                    />
                    <label className="flex items-start gap-2 text-[12px] text-white/60">
                      <input type="checkbox" checked={attest} onChange={(e) => setAttest(e.target.checked)} className="mt-[2px] accent-[#00c853]" />
                      <span>i&rsquo;m 18+ and this device is mine to sell</span>
                    </label>
                    {lockErr && <p className="text-[12px] text-red-400" role="alert">{lockErr}</p>}
                    <button type="button" onClick={lockIn} disabled={locking} className="tcc-button-primary w-full py-3 text-[15px] font-bold">
                      {locking ? "locking…" : manual ? "send me a real offer" : "Lock In My Offer"}
                    </button>
                    <p className="text-[11px] text-white/55">we&rsquo;ll only use this to reach you about this offer.</p>
                  </div>
                )}

                {locked && (
                  <div className="mt-3 rounded-2xl p-4 border border-white/10 bg-white/[0.06]" role="status">
                    <p className="text-[15px] font-semibold text-[#00c853]">locked in.</p>
                    <p className="text-[13px] text-white/70 mt-1">
                      {isDay ? "we'll reach out shortly to get you paid" : "we'll reach out first thing in the morning to get you paid"} — meet up in the austin area or we send a free shipping label, your pick.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
      )}

      {/* trust line */}
      <p className="text-[12px] text-white/60 mt-3">
        the number doesn&rsquo;t move if the phone matches what you told us · same-day cash in the austin area · free shipping label anywhere ·{" "}
        <a href="/reviews" className="underline text-white/60">reviews from paid sellers</a>
      </p>

      {/* how it works — the meetup fear, answered in three lines */}
      <section className="mt-7" aria-label="how it works">
        <h2 className="text-[16px] font-bold">how this works</h2>
        <ol className="mt-3 flex flex-col gap-2 text-[13px] text-white/75">
          <li className="flex gap-3">
            <span className="text-[#00c853] font-bold shrink-0">1</span>
            <span>tap your phone above — the number you see is the number, locked for 14 days.</span>
          </li>
          <li className="flex gap-3">
            <span className="text-[#00c853] font-bold shrink-0">2</span>
            <span>meet us at a public spot in the austin area (about 15 minutes), or we email you a free prepaid FedEx label.</span>
          </li>
          <li className="flex gap-3">
            <span className="text-[#00c853] font-bold shrink-0">3</span>
            <span>we check the phone while you watch, then you get paid on the spot — cash, Cash App, Zelle, or BTC. shipped devices are paid same day after inspection.</span>
          </li>
        </ol>
        <p className="text-[12px] text-white/60 mt-2">
          if the phone matches what you told us, the number doesn&rsquo;t move. that&rsquo;s the whole deal.
        </p>
      </section>

      {/* real verified reviews — server-fetched, renders nothing if unavailable */}
      {reviews.count >= 5 && reviews.top.length > 0 && (
        <section className="mt-7" aria-label="reviews from verified sellers">
          <h2 className="text-[16px] font-bold">
            {reviews.avg}★ from people we&rsquo;ve paid
          </h2>
          <div className="mt-3 flex flex-col gap-2">
            {reviews.top.map((r, i) => (
              <figure key={i} className="rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3">
                <blockquote className="text-[13px] text-white/85">&ldquo;{r.body}&rdquo;</blockquote>
                <figcaption className="text-[12px] text-white/55 mt-1">
                  {r.name}
                  {r.device ? ` · sold a ${r.device}` : ""}
                  {r.city ? ` · ${r.city}` : ""}
                  <span className="text-[#00c853]"> · ✓ verified seller</span>
                </figcaption>
              </figure>
            ))}
          </div>
          <p className="text-[12px] mt-2">
            <a href="/reviews" className="text-white/60 underline">all {reviews.count} reviews →</a>
          </p>
        </section>
      )}

      {/* composer + thread */}
      <section className="mt-7" id="go-composer" aria-label="chat with us">
        <h2 className="text-[16px] font-bold">{lot ? "tell us what you got" : "got something else, or a few of them?"}</h2>

        {msgs.length > 0 && (
          <div ref={threadRef} role="log" aria-live="polite" className="mt-3 max-h-[340px] overflow-y-auto flex flex-col gap-2 pr-1">
            {msgs.map((m, i) => (
              <div
                key={i}
                className={
                  m.from === "user"
                    ? "self-end max-w-[85%] rounded-2xl px-3 py-2 text-[14px] bg-white/[0.10] border border-white/20"
                    : "self-start max-w-[85%] rounded-2xl px-3 py-2 text-[14px] bg-white/[0.06] border border-white/10"
                }
              >
                {m.text}
              </div>
            ))}
            {sending && (
              <div className="self-start text-[12px] text-white/40 px-1" role="status">
                typing…
              </div>
            )}
          </div>
        )}

        <form
          className="mt-3 flex gap-2"
          onSubmit={(e) => { e.preventDefault(); void send(draft); }}
        >
          <input
            id="go-composer-input"
            className="tcc-input flex-1 px-4 py-3"
            placeholder={lot ? "i got 15 phones, need cash today…" : "i got 4 phones for sale…"}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            aria-label="tell us what you're selling"
          />
          <button type="submit" disabled={sending || !draft.trim()} className="tcc-button-primary px-4 py-2.5 text-[14px] font-bold" aria-label="send">
            send
          </button>
        </form>

        {msgs.length === 0 && (
          <div className="flex flex-wrap gap-2 mt-3">
            {(lot ? ["i got a lot of phones", "some are financed", "i need cash today"] : CHIPS).map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => void send(c)}
                className="text-[13px] text-white/80 border border-white/20 rounded-full px-4 py-[11px]"
              >
                {c}
              </button>
            ))}
          </div>
        )}
      </section>

      {/* long tail */}
      <p className="mt-8 text-[13px]">
        <a href="/" className="text-white/60 underline">everything else — laptops, consoles, watches →</a>
      </p>

      {/* footer — real business, real pages */}
      <footer className="mt-10 pt-4 border-t border-white/10 text-[12px] text-white/50">
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
        <p className="mt-4 text-[13px] text-white/70">
          this page needs javascript — <a href="/sell-iphone-austin" className="underline">see prices and how it works here</a>.
        </p>
      </noscript>
    </main>
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
      <p className="text-[13px] text-white/70 mb-2">{q}</p>
      <div className="flex flex-wrap gap-2">
        {chips.map((c) => (
          <button
            key={c.key}
            type="button"
            disabled={disabled}
            onClick={() => onPick(c.key, c.label)}
            className="text-[13px] text-white/85 border border-white/20 rounded-full px-4 py-[11px] disabled:opacity-50"
          >
            {c.label}
          </button>
        ))}
      </div>
    </div>
  );
}
