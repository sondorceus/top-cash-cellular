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
//
// LAZY (2026-09-25): only the button (components/ChatFab) is in every page's
// bundle. The 2,300-line chat client and the priced board load on the first
// tap — pointer-down starts both, so by the tap's release they are on their
// way — or when a page dispatches `tcc:open-chat`, or when the URL carries a
// chat deep link (?sid= / ?ship=). Every page used to download and hydrate
// the whole client, poll the store and price the board for a button almost
// nobody tapped. Once loaded the client stays mounted (the thread lives in
// its state); later taps re-open it through the same event.
import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import dynamic from "next/dynamic";
import type { GoReviews } from "../go/go-client";
import type { BoardRow } from "../go/board";
import ChatFab from "./ChatFab";

const GoClient = dynamic(() => import("../go/go-client"), { ssr: false });

const OFF = /^\/(go|admin|shop|account|offer|thank-you|track|api)(\/|$)/;
type Group = "ip" | "gs" | "ipad" | "console" | "macbook";
type Area = "metro" | "tx" | "us" | "intl" | "unknown";
const AREAS = new Set<string>(["metro", "tx", "us", "intl", "unknown"]);
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
  const [area, setArea] = useState<Area>("unknown");
  // wanted: the seller (or a page, or a deep link) asked for the chat.
  // ready: the board answered (even empty) — the client mounts only then, as
  // before, so its tiles are priced on first paint. open: the overlay is up
  // (reported by the client), so the button hides.
  const [wanted, setWanted] = useState(false);
  const [ready, setReady] = useState(false);
  const [open, setOpen] = useState(false);
  const boardP = useRef<Promise<void> | null>(null);
  const loadBoard = useCallback(() => {
    boardP.current ??= fetch("/api/go/board", { cache: "force-cache" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.rows) { setRows(d.rows); setReviews(d.reviews || { avg: 0, count: 0, top: [] }); }
        if (typeof d?.area === "string" && AREAS.has(d.area)) setArea(d.area as Area);
      })
      .catch(() => {})
      .finally(() => setReady(true));
    return boardP.current;
  }, []);
  const prefetch = useCallback(() => {
    void loadBoard();
    void import("../go/go-client"); // warms the chunk; next/dynamic reuses it
  }, [loadBoard]);
  useEffect(() => {
    setSrc(detectSrc());
    // A chat deep link (the owner's SMS, the SHIP reply) needs the client
    // even though nobody tapped the button.
    if (/[?&](sid|ship)=/.test(window.location.search)) setWanted(true);
    // The homepage's own "open chat" buttons. Once the client is mounted it
    // listens for this itself; here it also triggers the first load.
    const onOpen = () => setWanted(true);
    const onState = (e: Event) => setOpen(!!(e as CustomEvent<{ open?: boolean }>).detail?.open);
    window.addEventListener("tcc:open-chat", onOpen);
    window.addEventListener("tcc:chat-state", onState);
    return () => {
      window.removeEventListener("tcc:open-chat", onOpen);
      window.removeEventListener("tcc:chat-state", onState);
    };
  }, []);
  useEffect(() => {
    if (wanted) void loadBoard();
  }, [wanted, loadBoard]);
  if (OFF.test(pathname)) return null;
  return (
    <>
      {!open && (
        <ChatFab
          busy={wanted && !ready}
          onPrefetch={prefetch}
          onOpen={() => {
            setWanted(true);
            // Already mounted → the client re-opens on this; not yet → the
            // mount below opens it (initialOpen) and this is a no-op.
            window.dispatchEvent(new CustomEvent("tcc:open-chat"));
          }}
        />
      )}
      {wanted && ready && (
        <GoClient rows={rows} src={src} reviews={reviews} mode="widget" initialGroup={groupFor(pathname)} landed={pathname} visitorArea={area} initialOpen />
      )}
    </>
  );
}
