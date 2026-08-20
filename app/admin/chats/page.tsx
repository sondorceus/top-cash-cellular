"use client";
import { useCallback, useEffect, useRef, useState } from "react";

// Live site-chat console — ManyChat-style owner takeover for /go.
//
// Inbox of active chat sessions (newest first) → open a thread → "Take over"
// pauses the AI for that session → messages typed here land in the seller's
// chat within a poll tick, badged "Sonny · owner" so they know it's a human.
// "Hand back" returns the session to the bot. Deep-linkable as
// /admin/chats?session=<sid> — the [CHAT LIVE] MC alert links straight in.
//
// Sonny 2026-08-19: "like we had on manychat where i can literally jump in".

type StoredMsg = { role: "user" | "bot" | "owner" | "note"; text: string; ts: number };
type SessionRow = { sid: string; lastTs: number; count: number };

function ago(ts: number): string {
  const s = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export default function LiveChatsPage() {
  const [sessions, setSessions] = useState<SessionRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [msgs, setMsgs] = useState<StoredMsg[]>([]);
  const [takeover, setTakeoverState] = useState(false);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [alsoText, setAlsoText] = useState(false);
  const threadRef = useRef<HTMLDivElement>(null);

  const token = typeof window !== "undefined" ? localStorage.getItem("tcc-admin-token") : null;
  const hdrs: Record<string, string> = token ? { "x-admin-token": token } : {};

  const loadInbox = useCallback(() => {
    fetch("/api/admin/chats", { headers: hdrs, cache: "no-store" })
      .then((r) => {
        if (!r.ok) throw new Error(r.status === 401 ? "Unauthorized — open /admin first to set your token." : `HTTP ${r.status}`);
        return r.json();
      })
      .then((d) => { setSessions(d.sessions || []); setError(null); })
      .catch((e) => setError(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // Incremental thread poll: after the first full load, each tick asks only
  // for records newer than the newest we've rendered — idle ticks cost the
  // server a list() and zero blob fetches.
  const cursorRef = useRef<{ sid: string; ts: number }>({ sid: "", ts: 0 });
  const loadThread = useCallback((sid: string) => {
    const after = cursorRef.current.sid === sid ? cursorRef.current.ts : 0;
    fetch(`/api/admin/chats?session=${sid}&after=${after}`, { headers: hdrs, cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d) return;
        const fresh: StoredMsg[] = Array.isArray(d.msgs) ? d.msgs : [];
        setMsgs((cur) => (after === 0 ? fresh : [...cur, ...fresh.filter((m) => m.ts > after)]));
        const maxTs = fresh.length ? Math.max(...fresh.map((m) => m.ts)) : after;
        cursorRef.current = { sid, ts: Math.max(after, maxTs, typeof d.lastTs === "number" ? d.lastTs : 0) };
        setTakeoverState(!!d.takeover);
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // Deep link: /admin/chats?session=<sid> opens that thread directly.
  useEffect(() => {
    const sid = new URLSearchParams(window.location.search).get("session");
    if (sid && /^[a-z0-9-]{4,32}$/i.test(sid)) setOpen(sid);
    loadInbox();
  }, [loadInbox]);

  // Poll: the open thread every 4s, the inbox every 15s.
  useEffect(() => {
    if (!open) return;
    loadThread(open);
    const iv = setInterval(() => loadThread(open), 4000);
    return () => clearInterval(iv);
  }, [open, loadThread]);
  useEffect(() => {
    const iv = setInterval(loadInbox, 15000);
    return () => clearInterval(iv);
  }, [loadInbox]);
  useEffect(() => {
    threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight });
  }, [msgs]);

  async function post(body: { session: string; text?: string; takeover?: boolean; sms?: boolean }) {
    setBusy(true);
    try {
      await fetch("/api/admin/chats", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...hdrs },
        body: JSON.stringify(body),
      });
      loadThread(body.session);
    } finally {
      setBusy(false);
    }
  }

  if (error) return <main className="min-h-screen bg-[#0a0a0a] text-white p-8"><p className="text-red-400">{error}</p></main>;

  return (
    <main className="min-h-screen bg-[#0a0a0a] text-white">
      <div className="sticky top-0 z-20 bg-[#0a0a0a]/95 backdrop-blur border-b border-white/10 px-6 py-4 flex items-center gap-4">
        <h1 className="text-[18px] font-bold">Live Chats</h1>
        <span className="text-[12px] text-white/40">/go site chat — take over any session, the bot steps aside</span>
      </div>

      <div className="flex" style={{ height: "calc(100vh - 61px)" }}>
        {/* inbox — on phones it's the whole screen until a thread opens
            (the takeover flow starts from an SMS deep link on Sonny's phone) */}
        <div className={`${open ? "hidden md:block" : "block"} w-full md:w-[280px] shrink-0 border-r border-white/10 overflow-y-auto`}>
          {sessions === null && <p className="p-4 text-[#888] text-[13px]">Loading…</p>}
          {sessions?.length === 0 && <p className="p-4 text-[#888] text-[13px]">No chats yet — sessions appear here the moment someone talks to the bot on /go.</p>}
          {sessions?.map((s) => (
            <button
              key={s.sid}
              type="button"
              onClick={() => setOpen(s.sid)}
              className={`w-full text-left px-4 py-3 border-b border-white/5 hover:bg-white/[0.04] ${open === s.sid ? "bg-white/[0.07]" : ""}`}
            >
              <div className="text-[13px] font-semibold truncate">{s.sid}</div>
              <div className="text-[11px] text-white/45">{ago(s.lastTs)} · {s.count} msgs</div>
            </button>
          ))}
        </div>

        {/* thread */}
        <div className={`${open ? "flex" : "hidden md:flex"} flex-1 flex-col min-w-0`}>
          {!open ? (
            <p className="p-8 text-[#888] text-[14px]">Pick a chat on the left, or land here from a [CHAT LIVE] alert link.</p>
          ) : (
            <>
              <div className="px-5 py-3 border-b border-white/10 flex items-center gap-3">
                <button type="button" onClick={() => setOpen(null)} aria-label="back to inbox" className="md:hidden text-white/70 text-[18px] pr-1">←</button>
                <span className="text-[13px] font-semibold truncate">{open}</span>
                <span className={`text-[11px] px-2 py-[2px] rounded-full border ${takeover ? "border-[#00c853]/60 text-[#00c853]" : "border-white/20 text-white/50"}`}>
                  {takeover ? "YOU have this chat" : "bot is answering"}
                </span>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void post({ session: open, takeover: !takeover })}
                  className={`ml-auto text-[13px] font-bold px-4 py-2 rounded-xl border ${takeover ? "border-white/25 text-white/70" : "border-[#00c853] text-[#00c853]"} disabled:opacity-40`}
                >
                  {takeover ? "Hand back to bot" : "Take over"}
                </button>
              </div>

              <div ref={threadRef} className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-2">
                {msgs.map((m, i) => {
                  if (m.role === "note") {
                    return <div key={i} className="text-[11px] text-[#00c853]/80 text-center py-1">— {m.text} —</div>;
                  }
                  const mine = m.role === "owner";
                  const seller = m.role === "user";
                  // IMG::<url> = a photo the seller attached — render the
                  // picture, click opens full size in a new tab. Host-validated
                  // to our blob store (defense in depth: /api/chat already
                  // refuses to store client IMG::, but never render an
                  // unvalidated URL as <img>/<a> in the authed console — a
                  // forged one would be an external beacon or a javascript: href).
                  const img = /^IMG::https:\/\/[a-z0-9]+\.public\.blob\.vercel-storage\.com\/gochat-img\//i.test(m.text) ? m.text.slice(5) : null;
                  return (
                    <div key={i} className={`max-w-[75%] rounded-2xl ${img ? "p-1.5" : "px-4 py-2.5"} text-[13px] ${
                      mine ? "self-end bg-[#0f2417] border border-[#00c853]/50"
                        : seller ? "self-start bg-white/[0.08] border border-white/15"
                          : "self-start bg-white/[0.03] border border-white/10 text-white/70"
                    }`}>
                      {!seller && <div className={`text-[10px] mb-0.5 ${mine ? "text-[#00c853]" : "text-white/35"}`}>{mine ? "you" : "bot"}</div>}
                      {img ? (
                        <a href={img} target="_blank" rel="noopener noreferrer">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={img} alt="seller photo" className="block max-w-full rounded-xl" style={{ maxHeight: 220 }} />
                        </a>
                      ) : (
                        m.text
                      )}
                      <div className="text-[10px] text-white/30 mt-1">{ago(m.ts)}</div>
                    </div>
                  );
                })}
                {msgs.length === 0 && <p className="text-[#888] text-[13px]">No messages stored yet for this session.</p>}
              </div>

              {/* "also text" — seller SMS rides the notary Telnyx number via
                  its relay; owner-initiated per message, never automatic.
                  Works only when the session has a CONTACT note (lock or
                  typed contact) — otherwise the thread shows "SMS skipped". */}
              {(() => {
                const hasPhone = msgs.some((m) => m.role === "note" && m.text.startsWith("CONTACT: ") && !m.text.includes("@"));
                return (
                  <label className={`flex items-center gap-2 px-5 pt-2 text-[12px] ${hasPhone ? "text-white/70" : "text-white/35"}`}>
                    <input type="checkbox" checked={alsoText} onChange={(e) => setAlsoText(e.target.checked)} className="accent-[#00c853]" />
                    also text the seller{hasPhone ? "" : " (no number on file yet)"}
                  </label>
                );
              })()}
              <form
                className="flex gap-2 px-5 py-3 border-t border-white/10"
                onSubmit={(e) => {
                  e.preventDefault();
                  const t = draft.trim();
                  if (!t) return;
                  setDraft("");
                  // Sending a message implies takeover — flip it on in the same post.
                  void post({ session: open, text: t, ...(takeover ? {} : { takeover: true }), ...(alsoText ? { sms: true } : {}) });
                }}
              >
                <input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder={takeover ? "message the seller as yourself…" : "type to take over and reply as yourself…"}
                  className="flex-1 px-4 py-3 rounded-full bg-white/[0.06] border border-white/15 text-[16px] text-white placeholder-white/40 focus:outline-none focus:border-[#00c853]"
                />
                <button type="submit" disabled={busy || !draft.trim()} className="px-5 rounded-full bg-[#00c853] text-black text-[14px] font-bold disabled:opacity-40">
                  send
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
