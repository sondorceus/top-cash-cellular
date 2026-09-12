"use client";
// SITE-WIDE CHAT — the /go overlay behind a floating button on every page
// except /go itself and the admin/shop surfaces. Sonny 2026-09-12: "an icon
// where they can jump in the chat anytime to get the AI and team to message
// them" for Google Ads / organic visitors who never see the ad page.
//
// Each session is tagged with where it started (Google Ads click → "gads",
// Facebook/Instagram click → "fb"/"ig", anything else → "site") and the
// landing path, so the lead reads "Google Ads · /sell-macbook-austin". The
// page's device family pre-opens the matching tiles.
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import GoClient, { type GoReviews } from "../go/go-client";
import type { BoardRow } from "../go/board";

const OFF = /^\/(go|admin|shop|account|offer|thank-you|track|api)(\/|$)/;
type Group = "ip" | "gs" | "ipad" | "console" | "macbook";
function groupFor(path: string): Group | null {
  if (/sell-macbook/.test(path)) return "macbook";
  if (/sell-ipad/.test(path)) return "ipad";
  if (/sell-samsung/.test(path)) return "gs";
  if (/sell-(iphone|locked-iphone|financed-phone)/.test(path)) return "ip";
  return null;
}
function detectSrc(): string {
  try {
    const saved = localStorage.getItem("tcc_src");
    if (saved && /^[a-z0-9]{1,10}$/.test(saved)) return saved;
  } catch { /* private mode */ }
  let src = "site";
  try {
    const q = new URLSearchParams(window.location.search);
    const utm = (q.get("utm_source") || "").toLowerCase();
    if (q.get("gclid") || q.get("gbraid") || q.get("wbraid") || /google|adwords/.test(utm)) src = "gads";
    else if (q.get("fbclid") || /facebook|fb/.test(utm)) src = "fb";
    else if (/instagram|ig/.test(utm)) src = "ig";
    else if (/google\./.test(document.referrer)) src = "gorg"; // organic Google
    localStorage.setItem("tcc_src", src);
  } catch { /* no window */ }
  return src;
}

export default function SiteChat() {
  const pathname = usePathname() || "/";
  const [rows, setRows] = useState<BoardRow[]>([]);
  const [reviews, setReviews] = useState<GoReviews>({ avg: 0, count: 0, top: [] });
  const [src, setSrc] = useState("site");
  const [ready, setReady] = useState(false);
  useEffect(() => {
    setSrc(detectSrc());
    // The board is ~100 engine cells server-side; load it once the page is
    // idle so the button is instant and the tiles are priced when opened.
    const load = () => {
      fetch("/api/go/board", { cache: "force-cache" })
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => { if (d?.rows) { setRows(d.rows); setReviews(d.reviews || { avg: 0, count: 0, top: [] }); } })
        .catch(() => {})
        .finally(() => setReady(true));
    };
    const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number };
    if (w.requestIdleCallback) w.requestIdleCallback(load, { timeout: 2500 }); else setTimeout(load, 800);
  }, []);
  if (OFF.test(pathname)) return null;
  if (!ready) return null;
  return <GoClient rows={rows} src={src} reviews={reviews} mode="widget" initialGroup={groupFor(pathname)} landed={pathname} />;
}
