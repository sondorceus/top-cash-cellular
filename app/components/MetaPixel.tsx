"use client";

// Meta Pixel — gated on NEXT_PUBLIC_META_PIXEL_ID (dataset "TCC Web",
// created 2026-08-19). Base PageView here; conversion events fire from the
// surfaces that own them (/go fires Lead at the lock moment with the real
// engine offer as value, ViewContent on a model pick, InitiateCheckout on a
// quote). US-only local business; the pixel is the signal source Meta's
// delivery optimizes on — without it every ad click is just "a click".
//
// Click-id capture (2026-09-11): every ad click lands with ?fbclid=…. Meta's
// own snippet only cookies it as _fbc when its script loads and runs first;
// in the FB in-app browser that often never happens before the seller taps
// away. We stamp _fbc ourselves on mount (Meta's documented format) and
// expose both browser ids (fbCookies) so the lock/chat POSTs can forward
// them to the Conversions API — that's what turns "a lead from IP+UA" into
// "a lead from THIS ad click".
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
export function pixelTrack(event: string, params?: Record<string, unknown>, eventId?: string) {
  if (typeof window !== "undefined" && window.fbq) {
    // eventID lets the Conversions API send a server-side twin of the same
    // event; Meta dedupes the pair and keeps whichever arrived intact.
    if (eventId) window.fbq("track", event, params || {}, { eventID: eventId });
    else window.fbq("track", event, params || {});
  }
}

function readCookie(name: string): string {
  if (typeof document === "undefined") return "";
  const m = document.cookie.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
  return m ? decodeURIComponent(m[1]) : "";
}

/** The pixel's browser ids, for the Conversions API twin. Either may be "". */
export function fbCookies(): { fbp: string; fbc: string } {
  return { fbp: readCookie("_fbp"), fbc: readCookie("_fbc") };
}

// Stamp _fbc from ?fbclid= the way Meta's snippet would (fb.1.<ms>.<fbclid>),
// 90 days, whole site. A fresh click overwrites an older cookie.
function stampFbc() {
  try {
    const fbclid = new URLSearchParams(window.location.search).get("fbclid") || "";
    if (!fbclid || !/^[A-Za-z0-9_-]{4,200}$/.test(fbclid)) return;
    const value = `fb.1.${Date.now()}.${fbclid}`;
    document.cookie = `_fbc=${encodeURIComponent(value)}; path=/; max-age=${90 * 24 * 3600}; SameSite=Lax; Secure`;
  } catch { /* cookies blocked — CAPI falls back to IP + UA + contact */ }
}

export default function MetaPixel() {
  useEffect(() => {
    stampFbc();
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
