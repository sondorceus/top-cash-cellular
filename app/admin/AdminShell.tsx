"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

// Persistent admin chrome — topbar + tab nav — shared by every /admin
// page (Mission-Control-style shell). Pages keep their own bodies; the
// shell only adds navigation. `primary` tabs stay visible in the mobile
// bottom bar; the rest live behind the ⋯ More sheet.
const NAV: { href: string; ico: string; label: string; primary?: boolean }[] = [
  { href: "/admin/home", ico: "◈", label: "Home", primary: true },
  { href: "/admin", ico: "◉", label: "Leads", primary: true },
  { href: "/admin/customers", ico: "⬡", label: "Customers", primary: true },
  { href: "/admin/analytics", ico: "≡", label: "Analytics", primary: true },
  { href: "/admin/prices", ico: "◇", label: "Prices" },
  { href: "/admin/shop", ico: "⬢", label: "Shop" },
  { href: "/admin/profit", ico: "⊙", label: "Profit" },
  { href: "/admin/referrals", ico: "✳", label: "Referrals" },
  { href: "/admin/sequences", ico: "✉", label: "Sequences" },
  { href: "/admin/newsletter", ico: "◨", label: "Newsletter" },
  { href: "/admin/saved-quotes", ico: "◫", label: "Saved" },
  { href: "/admin/slots", ico: "◷", label: "Slots" },
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/admin") return pathname === "/admin";
  return pathname === href || pathname.startsWith(href + "/");
}

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || "";
  const [clock, setClock] = useState("");
  const [moreOpen, setMoreOpen] = useState(false);

  useEffect(() => {
    const tick = () =>
      setClock(new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }));
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => setMoreOpen(false), [pathname]);

  // The forbidden page is for users who failed the allowlist — no chrome.
  if (pathname.startsWith("/admin/forbidden")) return <>{children}</>;

  return (
    <div className="tadm-root">
      <div className="tadm-chrome">
      <header className="tadm-topbar">
        <Link href="/admin/home" className="tadm-brand">
          <span className="mark">▲</span>
          <span>TOP CASH</span>
          <span className="chip">ADMIN</span>
        </Link>
        <div className="tadm-spacer" />
        <span className="tadm-clock" suppressHydrationWarning>{clock}</span>
        <a className="tadm-sitelink" href="/" target="_blank" rel="noreferrer">
          View site ↗
        </a>
      </header>

      <nav className="tadm-nav">
        {NAV.map((n) => (
          <Link
            key={n.href}
            href={n.href}
            className={`${isActive(pathname, n.href) ? "active" : ""} ${n.primary ? "" : "tadm-sec"}`}
          >
            <span className="ico">{n.ico}</span>
            <span>{n.label}</span>
          </Link>
        ))}
        <button type="button" className="tadm-morebtn" onClick={() => setMoreOpen(true)}>
          <span className="ico">⋯</span>
          <span>More</span>
        </button>
      </nav>
      </div>

      {moreOpen && (
        <div className="tadm-sheet-wrap" onClick={() => setMoreOpen(false)}>
          <div className="tadm-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="grab" />
            {NAV.filter((n) => !n.primary).map((n) => (
              <Link key={n.href} href={n.href}>
                <span className="ico">{n.ico}</span>
                <span>{n.label}</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      <main className="tadm-main">{children}</main>
    </div>
  );
}
