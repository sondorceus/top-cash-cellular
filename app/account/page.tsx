"use client";

import { useEffect, useState } from "react";

// Customer account dashboard. Shows the signed-in customer their
// open + past trades, with live status pulled from the same MC
// markers the admin lead feed uses. Reachable from the header
// when authenticated; falls back to an inline login form when not.
//
// Auth: any of
//   1. tcc_session cookie (Google sign-in, granted via /api/auth/google)
//   2. tcc_customer cookie (email-only, granted via /api/account/login)
// The /api/account/me endpoint accepts either. Logout clears whichever
// one is set.

type Trade = {
  id: string;
  timestamp: string;
  device?: string;
  model?: string;
  storage?: string;
  condition?: string;
  quote?: string;
  payout?: string;
  status: string;
  statusAt?: string;
  handoffMethod?: "ship" | "local";
  fedexTracking?: string;
};

type AccountData = {
  authenticated: boolean;
  email?: string;
  name?: string;
  via?: "email" | "google";
  trades?: Trade[];
  summary?: { total: number; paid: number; openCount: number };
};

const STATUS_DISPLAY: Record<string, { label: string; tone: string; emoji: string }> = {
  quote_requested: { label: "Quote requested", tone: "text-[#bdbdbd] bg-white/[0.06] border-white/15", emoji: "📥" },
  shipped:         { label: "Shipped",         tone: "text-sky-200 bg-sky-500/15 border-sky-500/40", emoji: "📦" },
  received:        { label: "Received by TCC", tone: "text-violet-200 bg-violet-500/15 border-violet-500/40", emoji: "📬" },
  tested:          { label: "In inspection",   tone: "text-amber-200 bg-amber-500/15 border-amber-500/40", emoji: "🔍" },
  met:             { label: "Picked up — paid", tone: "text-emerald-200 bg-emerald-500/15 border-emerald-500/40", emoji: "🤝" },
  paid:            { label: "Paid",            tone: "text-emerald-200 bg-emerald-500/15 border-emerald-500/40", emoji: "💵" },
  rejected:        { label: "Returned",        tone: "text-red-200 bg-red-500/15 border-red-500/40", emoji: "↩️" },
};

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.floor(ms / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const d = Math.floor(hr / 24);
  if (d < 30) return `${d}d ago`;
  const mo = Math.floor(d / 30);
  return `${mo}mo ago`;
}

export default function AccountPage() {
  const [data, setData] = useState<AccountData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState("");

  const refresh = async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/account/me", { cache: "no-store" });
      const d = await r.json();
      setData(d);
    } catch {
      setData({ authenticated: false });
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { refresh(); }, []);

  const doLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginEmail.trim()) return;
    setLoginLoading(true);
    setLoginError("");
    try {
      const r = await fetch("/api/account/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: loginEmail.trim() }),
      });
      const d = await r.json();
      if (!r.ok || !d.ok) {
        setLoginError(d.error || "Couldn't sign you in.");
        return;
      }
      await refresh();
    } catch {
      setLoginError("Couldn't sign you in — try again.");
    } finally {
      setLoginLoading(false);
    }
  };

  const logout = async () => {
    await fetch("/api/account/logout", { method: "POST" }).catch(() => {});
    await fetch("/api/auth/signout", { method: "POST" }).catch(() => {});
    window.location.href = "/";
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-[#0a0a0a] text-white flex items-center justify-center">
        <p className="text-[#888] text-sm">Loading your account…</p>
      </main>
    );
  }

  // Logged-out state — show login form
  if (!data?.authenticated) {
    return (
      <main className="min-h-screen bg-[#0a0a0a] text-white">
        <div className="max-w-md mx-auto px-4 py-12">
          <a href="/" className="text-[#00c853] text-sm font-semibold mb-6 inline-block">← Back to Top Cash</a>
          <h1 className="text-2xl font-bold mb-2">Sign in to your account</h1>
          <p className="text-[#bdbdbd] text-sm mb-6">Enter the email you used on a past trade — we&apos;ll pull up your history.</p>
          <form onSubmit={doLogin} className="space-y-3">
            <input
              type="email"
              value={loginEmail}
              onChange={(e) => setLoginEmail(e.target.value)}
              required
              placeholder="you@email.com"
              className="w-full px-4 py-3.5 rounded-2xl bg-white/5 border border-white/15 text-white placeholder:text-[#888] focus:outline-none focus:border-[#00c853]"
              autoFocus
            />
            {loginError && <p className="text-[#ff5566] text-xs font-semibold">{loginError}</p>}
            <button
              type="submit"
              disabled={loginLoading}
              className="w-full bg-[#00c853] text-[#0a0a0a] py-4 rounded-2xl text-base font-extrabold hover:bg-[#00e676] disabled:opacity-50 transition cursor-pointer"
            >
              {loginLoading ? "Looking up…" : "Sign in"}
            </button>
          </form>
          <p className="text-[11px] text-[#888] text-center mt-4">
            New customer? <a href="/" className="text-[#00c853] hover:underline">Get a quote</a> to start your first trade.
          </p>
        </div>
      </main>
    );
  }

  const trades = data.trades || [];
  const summary = data.summary || { total: 0, paid: 0, openCount: 0 };
  const FINISHED = new Set(["paid", "met", "rejected"]);
  const open = trades.filter(t => !FINISHED.has(t.status));
  const past = trades.filter(t => FINISHED.has(t.status));
  const displayName = data.name?.split(" ")[0] || data.email?.split("@")[0] || "there";

  return (
    <main className="min-h-screen bg-[#0a0a0a] text-white">
      <div className="max-w-3xl mx-auto px-4 py-8 lg:py-12">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <a href="/" className="text-[#00c853] text-sm font-semibold">← Top Cash</a>
          <button onClick={logout} className="text-[#888] text-xs hover:text-white transition cursor-pointer">Sign out</button>
        </div>

        {/* Welcome + summary */}
        <h1 className="text-2xl md:text-3xl font-bold mb-1">Welcome back, {displayName}</h1>
        <p className="text-[#bdbdbd] text-sm mb-6">{data.email}</p>

        <div className="grid grid-cols-3 gap-3 mb-8">
          <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
            <p className="text-[10px] text-[#888] uppercase tracking-wider font-bold mb-1">Trades</p>
            <p className="text-2xl font-extrabold">{summary.total}</p>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
            <p className="text-[10px] text-[#888] uppercase tracking-wider font-bold mb-1">Paid out</p>
            <p className="text-2xl font-extrabold text-[#00c853]">${summary.paid.toLocaleString()}</p>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
            <p className="text-[10px] text-[#888] uppercase tracking-wider font-bold mb-1">Open</p>
            <p className="text-2xl font-extrabold">{summary.openCount}</p>
          </div>
        </div>

        {/* Sell another CTA */}
        <a href="/" className="block w-full text-center bg-[#00c853] hover:bg-[#00e676] text-[#0a0a0a] py-4 rounded-2xl font-extrabold mb-8 transition">
          + Sell another device
        </a>

        {/* Open trades */}
        {open.length > 0 && (
          <section className="mb-8">
            <h2 className="text-sm font-bold uppercase tracking-wider text-[#00c853] mb-3">In progress ({open.length})</h2>
            <div className="space-y-3">
              {open.map(t => {
                const meta = STATUS_DISPLAY[t.status] || STATUS_DISPLAY.quote_requested;
                return (
                  <div key={t.id} className="bg-white/5 border border-white/10 rounded-2xl p-4">
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div className="min-w-0 flex-1">
                        <p className="text-base font-bold">{t.model || t.device || "Device"}</p>
                        <p className="text-xs text-[#bdbdbd]">
                          {[t.storage, t.condition].filter(Boolean).join(" · ") || ""}
                        </p>
                        <p className="text-[11px] text-[#888] mt-1">Submitted {timeAgo(t.timestamp)}</p>
                      </div>
                      <div className="text-right">
                        {t.quote && <p className="text-lg font-extrabold text-[#00c853]">{t.quote}</p>}
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border ${meta.tone} mt-1`}>
                          {meta.emoji} {meta.label}
                        </span>
                      </div>
                    </div>
                    {t.fedexTracking && (
                      <a
                        href={`/track?lead=${encodeURIComponent(t.id)}`}
                        className="mt-3 inline-flex items-center gap-1.5 text-xs text-[#00c853] hover:underline font-semibold"
                      >
                        📦 Track FedEx ({t.fedexTracking}) →
                      </a>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Past trades */}
        {past.length > 0 && (
          <section>
            <h2 className="text-sm font-bold uppercase tracking-wider text-[#00c853] mb-3">Past trades ({past.length})</h2>
            <div className="space-y-2">
              {past.map(t => {
                const meta = STATUS_DISPLAY[t.status] || STATUS_DISPLAY.quote_requested;
                return (
                  <div key={t.id} className="bg-white/5 border border-white/10 rounded-xl p-3 flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold truncate">{t.model || t.device || "Device"}</p>
                      <p className="text-[11px] text-[#888]">{[t.storage, t.condition].filter(Boolean).join(" · ")} · {timeAgo(t.timestamp)}</p>
                    </div>
                    <div className="text-right shrink-0">
                      {t.quote && <p className="text-sm font-bold">{t.quote}</p>}
                      <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider border ${meta.tone} mt-0.5`}>
                        {meta.emoji} {meta.label}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {trades.length === 0 && (
          <div className="bg-white/5 border border-white/10 rounded-2xl p-8 text-center">
            <p className="text-[#bdbdbd] text-sm mb-4">No trades yet on this email.</p>
            <a href="/" className="inline-block bg-[#00c853] hover:bg-[#00e676] text-[#0a0a0a] px-6 py-3 rounded-2xl font-bold transition">
              Get your first quote
            </a>
          </div>
        )}
      </div>
    </main>
  );
}
