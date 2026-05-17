"use client";

import { useEffect, useState } from "react";

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
// rAF-batched so we don't fire setState on every scroll event.
export function useNavHideOnScroll(threshold = 80, delta = 6): boolean {
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    let lastY = typeof window !== "undefined" ? window.scrollY : 0;
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const y = window.scrollY;
        if (y < threshold) {
          setHidden(false);
        } else if (y > lastY + delta) {
          setHidden(true);
        } else if (y < lastY - delta) {
          setHidden(false);
        }
        lastY = y;
        ticking = false;
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [threshold, delta]);
  return hidden;
}
