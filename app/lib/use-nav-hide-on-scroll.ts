"use client";

import { useEffect, useRef, useState } from "react";

// Hide-on-scroll for the sticky <nav>. Returns `true` when the nav should
// be translated off-screen.
//
// Behavior:
//   • Top of page (y < threshold) → always visible
//   • Scrolling down by > delta → hide
//   • Scrolling up by > delta → show
//   • Small jitter (≤ delta) is ignored so the nav doesn't flicker when
//     the page jumps a few pixels (browser anchor scrolls, layout shifts).
//
// Skywalker 2026-05-19 — the previous delta=6 was way too sensitive for
// iOS momentum scrolling. iPad rubber-band bounce easily generates 10-30
// px overshoots that flipped the state mid-transition, oscillating the
// nav up/down ("the green scroll menus going back and forth"). Fixes:
//   1. Bumped delta to 30 — needs a real intent-to-scroll before flipping.
//   2. Hysteresis lockout — once we flip, ignore scroll events for 250ms
//      so iOS bounce-back can't undo the flip immediately.
//   3. Clamp negative scrollY — rubber-band overscroll at the top of the
//      page sometimes reports y < 0; we treat that as 0.
//   4. Ref-mirror the `hidden` state so the rAF callback always sees the
//      current value without re-binding the listener on every flip.
export function useNavHideOnScroll(threshold = 80, delta = 30): boolean {
  const [hidden, setHidden] = useState(false);
  const hiddenRef = useRef(false);
  useEffect(() => { hiddenRef.current = hidden; }, [hidden]);

  useEffect(() => {
    let lastY = typeof window !== "undefined" ? Math.max(0, window.scrollY) : 0;
    let ticking = false;
    let lastFlipAt = 0;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        ticking = false;
        const y = Math.max(0, window.scrollY);
        const now = performance.now();
        // Lockout — block flip-flop during iOS momentum bounce. The
        // transition itself takes 300ms so anything quicker than that
        // looks broken anyway.
        if (now - lastFlipAt < 250) { lastY = y; return; }
        if (y < threshold) {
          if (hiddenRef.current) { setHidden(false); lastFlipAt = now; }
        } else if (y > lastY + delta) {
          if (!hiddenRef.current) { setHidden(true); lastFlipAt = now; }
        } else if (y < lastY - delta) {
          if (hiddenRef.current) { setHidden(false); lastFlipAt = now; }
        }
        lastY = y;
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [threshold, delta]);
  return hidden;
}
