"use client";

// Meta Pixel — gated on NEXT_PUBLIC_META_PIXEL_ID (dataset "TCC Web",
// created 2026-08-19). Base PageView here; conversion events fire from the
// surfaces that own them (/go fires Lead at the lock moment with the real
// engine offer as value, ViewContent on a board-row open). US-only local
// business; the pixel is the signal source Meta's delivery optimizes on —
// without it every ad click is just "a click".
import { useEffect } from "react";

const PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID || "";

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
    _fbq?: unknown;
  }
}

/** Fire a pixel event from anywhere client-side; silent no-op when the
 *  pixel is disabled or not yet loaded. */
export function pixelTrack(event: string, params?: Record<string, unknown>) {
  if (typeof window !== "undefined" && window.fbq) {
    window.fbq("track", event, params || {});
  }
}

export default function MetaPixel() {
  useEffect(() => {
    if (!PIXEL_ID || window.fbq) return;
    // Standard Meta base snippet, minus the document.write path.
    const n = function (...args: unknown[]) {
      // @ts-expect-error — fbq bootstrap queue shape
      if (n.callMethod) { n.callMethod(...args); } else { n.queue.push(args); }
    } as unknown as { (...args: unknown[]): void; push: unknown; loaded: boolean; version: string; queue: unknown[]; callMethod?: unknown };
    n.push = n;
    n.loaded = true;
    n.version = "2.0";
    n.queue = [];
    window.fbq = n as unknown as Window["fbq"];
    window._fbq = n;
    const s = document.createElement("script");
    s.async = true;
    s.src = "https://connect.facebook.net/en_US/fbevents.js";
    document.head.appendChild(s);
    window.fbq!("init", PIXEL_ID);
    window.fbq!("track", "PageView");
  }, []);
  return null;
}
