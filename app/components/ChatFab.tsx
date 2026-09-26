"use client";
// The site-wide chat's floating button — on every page the widget is allowed
// on. Split out of app/go/go-client.tsx (2026-09-25) so the 2,300-line chat
// client loads only on the first tap: every page used to download and
// hydrate all of it for this one button.
//
// DRAGGABLE and remembers where it was put (the legacy homepage bubble did
// this and Sonny asked for it back, 2026-09-12): a fixed corner can sit on
// top of a page's bottom bar on a phone. A press that moves < 6px is a tap
// and opens the chat; anything more is a drag. While a page's own fixed
// bottom bar (the homepage's quote / checkout CTA rows, the cookie bar) is on
// screen the pill rides above it — taps on the right half of "Lock In My
// Offer" used to open the chat instead; a pill the seller dragged somewhere
// keeps its spot.
import { useEffect, useRef, useState } from "react";

export default function ChatFab({ onOpen, onPrefetch, busy = false }: {
  onOpen: () => void;
  // Pointer down = the tap is coming: start loading the chat client and the
  // board so the open is that much sooner.
  onPrefetch?: () => void;
  busy?: boolean;
}) {
  const [fabPos, setFabPos] = useState<{ x: number; y: number } | null>(null);
  const fabDrag = useRef<{ startX: number; startY: number; origX: number; origY: number; moved: boolean } | null>(null);
  const fabRef = useRef<HTMLButtonElement>(null);
  const clampFab = (x: number, y: number) => {
    const w = fabRef.current?.offsetWidth ?? 160, h = fabRef.current?.offsetHeight ?? 48;
    return { x: Math.max(6, Math.min(window.innerWidth - w - 6, x)), y: Math.max(6, Math.min(window.innerHeight - h - 6, y)) };
  };
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("tcc_chat_fab_pos") || "null");
      if (saved && typeof saved.x === "number" && typeof saved.y === "number") setFabPos(clampFab(saved.x, saved.y));
    } catch { /* default corner */ }
    const onResize = () => setFabPos((p) => (p ? clampFab(p.x, p.y) : p));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [fabLift, setFabLift] = useState(0);
  useEffect(() => {
    if (fabPos) return;
    let raf = 0;
    const measure = () => {
      raf = 0;
      const vh = window.innerHeight;
      let lift = 0;
      document.querySelectorAll<HTMLElement>(".fixed.bottom-0, [data-bottom-bar]").forEach((el) => {
        if (fabRef.current && (el === fabRef.current || el.contains(fabRef.current))) return;
        const r = el.getBoundingClientRect();
        // hidden (lg:hidden), not a bar (a tall sheet), or not at the bottom
        if (r.height <= 0 || r.height > 220 || r.bottom < vh - 4 || r.top >= vh) return;
        if (getComputedStyle(el).position !== "fixed") return; // lg:static on desktop
        lift = Math.max(lift, Math.ceil(vh - r.top));
      });
      setFabLift(lift);
    };
    // Throttled: the host page's own DOM churn (funnel steps, carousels)
    // used to force a layout measure every frame while the pill just sat there.
    let timer = 0;
    const schedule = () => {
      if (timer || document.hidden) return;
      timer = window.setTimeout(() => { timer = 0; if (!raf) raf = requestAnimationFrame(measure); }, 150);
    };
    measure();
    // Bars come and go with the funnel step (React state, no resize event).
    const mo = new MutationObserver(schedule);
    mo.observe(document.body, { childList: true, subtree: true });
    window.addEventListener("resize", schedule);
    return () => {
      mo.disconnect();
      window.removeEventListener("resize", schedule);
      clearTimeout(timer);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [fabPos]);
  return (
    <button
      ref={fabRef}
      type="button"
      aria-label="Chat with us — get a real number and a text from our team. Drag to move."
      aria-busy={busy || undefined}
      className="fixed z-40 flex items-center gap-2 rounded-full bg-[#00c853] text-[#0a0a0a] font-bold text-[15px] pl-4 pr-5 py-3 shadow-[0_6px_24px_rgba(0,0,0,0.45)] select-none"
      style={fabPos
        ? { left: fabPos.x, top: fabPos.y, touchAction: "none", cursor: fabDrag.current?.moved ? "grabbing" : "grab" }
        : { right: 16, bottom: fabLift ? `${fabLift + 12}px` : "max(16px, env(safe-area-inset-bottom))", touchAction: "none", cursor: "grab" }}
      // Keyboard / screen-reader activation (Enter, Space) arrives as a
      // click with detail 0 — the pointer handlers below never see it.
      // A real tap opens on pointerup and its click (detail ≥ 1) is ignored.
      onClick={(e) => { if (e.detail === 0) onOpen(); }}
      onPointerDown={(e) => {
        onPrefetch?.();
        const r = e.currentTarget.getBoundingClientRect();
        fabDrag.current = { startX: e.clientX, startY: e.clientY, origX: r.left, origY: r.top, moved: false };
        try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* older webviews */ }
      }}
      onPointerMove={(e) => {
        const d = fabDrag.current;
        if (!d) return;
        const dx = e.clientX - d.startX, dy = e.clientY - d.startY;
        if (!d.moved && Math.abs(dx) + Math.abs(dy) < 6) return;
        d.moved = true;
        setFabPos(clampFab(d.origX + dx, d.origY + dy));
      }}
      onPointerUp={(e) => {
        const d = fabDrag.current;
        fabDrag.current = null;
        try { e.currentTarget.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
        if (d?.moved) {
          const r = e.currentTarget.getBoundingClientRect();
          try { localStorage.setItem("tcc_chat_fab_pos", JSON.stringify({ x: r.left, y: r.top })); } catch { /* private mode */ }
          return;
        }
        onOpen();
      }}
      onPointerCancel={() => { fabDrag.current = null; }}
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden><path strokeLinecap="round" strokeLinejoin="round" d="M4 5h16v11H8l-4 4V5z" /></svg>
      {busy ? "opening…" : "get my number"}
    </button>
  );
}
