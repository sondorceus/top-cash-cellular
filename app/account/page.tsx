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
  address?: { street?: string; unit?: string; city?: string; state?: string; zip?: string };
};

type Section = "account" | "trades" | "addresses";

type AccountData = {
  authenticated: boolean;
  email?: string;
  name?: string;
  phone?: string;
  via?: "email" | "google";
  trades?: Trade[];
  summary?: { total: number; paid: number; openCount: number };
};

// `emoji` holds an SVG path `d` string (Heroicons-style outline),
// wrapped in <svg> at the render site. Renamed from literal emoji
// glyphs as part of the emoji-free pass.
const STATUS_DISPLAY: Record<string, { label: string; tone: string; emoji: string }> = {
  quote_requested: { label: "Quote requested", tone: "text-[#bdbdbd] bg-white/[0.06] border-white/15", emoji: "M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" },
  shipped:         { label: "Shipped",         tone: "text-sky-200 bg-sky-500/15 border-sky-500/40", emoji: "M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-14L4 7m8 4v10M4 7v10l8 4" },
  received:        { label: "Received by TCC", tone: "text-violet-200 bg-violet-500/15 border-violet-500/40", emoji: "M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" },
  tested:          { label: "In inspection",   tone: "text-amber-200 bg-amber-500/15 border-amber-500/40", emoji: "M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" },
  met:             { label: "Picked up — paid", tone: "text-emerald-200 bg-emerald-500/15 border-emerald-500/40", emoji: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" },
  paid:            { label: "Paid",            tone: "text-emerald-200 bg-emerald-500/15 border-emerald-500/40", emoji: "M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" },
  rejected:        { label: "Returned",        tone: "text-red-200 bg-red-500/15 border-red-500/40", emoji: "M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" },
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
  // Side-nav section — starts on Trade-Ins since that's what most
  // returning customers come here for. Account Info is the
  // "I want to manage my settings" path, Addresses is read-only
  // recall of past shipping addresses.
  const [section, setSection] = useState<Section>("trades");
  // Account-info edit state.
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileError, setProfileError] = useState("");
  const [profileSaved, setProfileSaved] = useState(false);

  const startEdit = () => {
    setEditName(data?.name || "");
    setEditPhone(data?.phone || "");
    setProfileError("");
    setProfileSaved(false);
    setEditing(true);
  };
  const saveProfile = async () => {
    setSavingProfile(true);
    setProfileError("");
    try {
      const r = await fetch("/api/account/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editName.trim(), phone: editPhone.trim() }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok || !d.ok) {
        setProfileError(d.error || "Couldn't save — try again.");
        return;
      }
      setData((prev) => prev ? { ...prev, name: d.name, phone: d.phone || undefined } : prev);
      setEditing(false);
      setProfileSaved(true);
      setTimeout(() => setProfileSaved(false), 2500);
    } catch {
      setProfileError("Network error — try again.");
    } finally {
      setSavingProfile(false);
    }
  };

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

  // Google sign-in via the OAuth redirect — bounces to Google, comes
  // back with a verified tcc_session cookie set, lands on /account.
  // The JS GSI button only decodes the JWT client-side without
  // persisting the cookie, which is why we use the server flow here.
  const signInWithGoogle = () => {
    window.location.href = "/api/auth/google?returnTo=/account";
  };

  // "Sell another like this" — drops the customer back onto the
  // homepage with the device label pre-filled in the search box,
  // which surfaces their exact model in the dropdown (one tap to
  // pick). The funnel still asks for fresh condition + storage so
  // the new quote reflects the device's current shape. Skywalker
  // 2026-05-19: two-tap repeat sale.
  const sellAnotherLikeThis = (t: Trade) => {
    if (!t.model) return;
    const params = new URLSearchParams();
    params.set("q", t.model);
    window.location.href = `/?${params.toString()}#search`;
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
              {loginLoading ? "Looking up…" : "Sign in with email"}
            </button>
          </form>

          {/* Divider + Google sign-in. Uses the OAuth redirect so the
              cookie is actually persisted — the JS GSI button only
              decodes the JWT client-side and doesn't survive a refresh. */}
          <div className="flex items-center gap-3 my-4">
            <div className="flex-1 h-px bg-white/10" />
            <span className="text-[#888] text-xs">or</span>
            <div className="flex-1 h-px bg-white/10" />
          </div>
          <button
            type="button"
            onClick={signInWithGoogle}
            className="w-full bg-white text-[#0a0a0a] py-3.5 rounded-2xl text-base font-bold hover:bg-white/90 transition cursor-pointer flex items-center justify-center gap-2.5"
          >
            <svg className="w-5 h-5" viewBox="0 0 48 48"><path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8c-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4C12.955 4 4 12.955 4 24s8.955 20 20 20s20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"/><path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4C16.318 4 9.656 8.337 6.306 14.691z"/><path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0 1 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"/><path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 0 1-4.087 5.571l.003-.002l6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"/></svg>
            Continue with Google
          </button>

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

  // Dedup addresses across trades — same street+zip wins one entry.
  // Kept in chronological order so the most-recent unique address ranks
  // at the top (good default for "ship from").
  const addresses = (() => {
    const seen = new Set<string>();
    const out: Array<{ street: string; unit?: string; city: string; state: string; zip: string; lastUsed: string; tradeCount: number }> = [];
    for (const t of trades) {
      const a = t.address;
      if (!a || !a.street || !a.city || !a.state || !a.zip) continue;
      const key = `${a.street.toLowerCase()}|${a.zip}`;
      if (seen.has(key)) {
        const existing = out.find(x => `${x.street.toLowerCase()}|${x.zip}` === key);
        if (existing) existing.tradeCount += 1;
        continue;
      }
      seen.add(key);
      out.push({ street: a.street, unit: a.unit, city: a.city, state: a.state, zip: a.zip, lastUsed: t.timestamp, tradeCount: 1 });
    }
    return out;
  })();

  // `icon` holds an SVG path `d` string, wrapped in <svg> at the
  // render site — part of the emoji-free pass.
  const sectionTabs: Array<{ id: Section; label: string; icon: string; count?: number }> = [
    { id: "account", label: "Account Info", icon: "M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" },
    { id: "trades", label: "Trade-Ins", icon: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z", count: summary.total },
    { id: "addresses", label: "Addresses", icon: "M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0zM15 11a3 3 0 11-6 0 3 3 0 016 0z", count: addresses.length },
  ];

  return (
    <main className="min-h-screen bg-[#0a0a0a] text-white">
      <div className="max-w-5xl mx-auto px-4 py-8 lg:py-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <a href="/" className="text-[#00c853] text-sm font-semibold">← Top Cash</a>
          <p className="text-[#888] text-xs">{data.email}</p>
        </div>

        <h1 className="text-2xl md:text-3xl font-bold mb-6">My Account</h1>

        <div>
          {/* Section menu — centered horizontal tab bar. Larger text +
              padding than the old left sidebar so it reads cleanly. */}
          <nav className="flex flex-wrap justify-center gap-2 mb-7">
            {sectionTabs.map((t) => {
              const active = section === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setSection(t.id)}
                  className={`flex items-center gap-2.5 px-5 py-3 rounded-full text-base font-bold whitespace-nowrap transition cursor-pointer ${
                    active
                      ? "bg-[#00c853]/15 text-[#00c853] border border-[#00c853]/40"
                      : "text-[#dcdcdc] bg-white/[0.12] hover:bg-white/[0.16] border border-white/10"
                  }`}
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d={t.icon} /></svg>
                  <span>{t.label}</span>
                  {t.count !== undefined && t.count > 0 && (
                    <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded ${active ? "bg-[#00c853]/20 text-[#00c853]" : "bg-white/[0.08] text-[#888]"}`}>{t.count}</span>
                  )}
                </button>
              );
            })}
            <button
              type="button"
              onClick={logout}
              className="flex items-center gap-2.5 px-5 py-3 rounded-full text-base font-bold text-[#ff8088] bg-white/[0.12] hover:bg-red-500/10 border border-white/10 transition cursor-pointer"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" /></svg><span>Sign out</span>
            </button>
          </nav>

          {/* Main content area */}
          <div className="max-w-3xl mx-auto">

        {section === "account" && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold mb-1">Welcome back, {displayName}</h2>
            <p className="text-[#bdbdbd] text-sm mb-2">{data.email}</p>

            <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
              <div className="flex items-center justify-between mb-3">
                <p className="text-[10px] uppercase tracking-[0.18em] text-[#00c853] font-bold">Account info</p>
                {!editing && (
                  <button
                    type="button"
                    onClick={startEdit}
                    className="text-[11px] font-semibold text-[#00c853] hover:text-[#00e676] px-2.5 py-1 rounded-lg bg-[#00c853]/10 border border-[#00c853]/30 transition cursor-pointer inline-flex items-center gap-1"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg> Edit
                  </button>
                )}
              </div>
              {profileSaved && (
                <div className="mb-3 px-3 py-2 rounded-lg bg-[#00c853]/15 border border-[#00c853]/40 text-[#00c853] text-xs font-semibold flex items-center gap-1.5">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> Account details saved
                </div>
              )}
              {editing ? (
                <div className="space-y-3">
                  <div>
                    <label className="text-[10px] uppercase tracking-wider text-[#888] font-bold mb-1 block">Name</label>
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      placeholder="First and last name"
                      className="w-full px-3 py-2.5 bg-black/40 border border-white/15 rounded-lg text-sm text-white placeholder:text-[#888] focus:outline-none focus:border-[#00c853]"
                      autoFocus
                    />
                  </div>
                  <div>
                    <label className="text-[10px] uppercase tracking-wider text-[#888] font-bold mb-1 block">Phone</label>
                    <input
                      type="tel"
                      value={editPhone}
                      onChange={(e) => {
                        const digits = e.target.value.replace(/\D/g, "").slice(0, 10);
                        if (digits.length > 6) setEditPhone(`(${digits.slice(0,3)}) ${digits.slice(3,6)}-${digits.slice(6)}`);
                        else if (digits.length > 3) setEditPhone(`(${digits.slice(0,3)}) ${digits.slice(3)}`);
                        else setEditPhone(digits);
                      }}
                      placeholder="(512) 555-0000"
                      className="w-full px-3 py-2.5 bg-black/40 border border-white/15 rounded-lg text-sm text-white placeholder:text-[#888] focus:outline-none focus:border-[#00c853]"
                    />
                    <p className="text-[10px] text-[#888] mt-1">Pre-fills your next trade so you don&apos;t re-type it.</p>
                  </div>
                  <div>
                    <label className="text-[10px] uppercase tracking-wider text-[#888] font-bold mb-1 block">Email</label>
                    <input
                      type="email"
                      value={data.email || ""}
                      disabled
                      className="w-full px-3 py-2.5 bg-white/[0.03] border border-white/10 rounded-lg text-sm text-[#888] cursor-not-allowed"
                    />
                    <p className="text-[10px] text-[#888] mt-1">Email is your account ID — to change it, email support.</p>
                  </div>
                  {profileError && <p className="text-[#ff5566] text-xs font-semibold">{profileError}</p>}
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={saveProfile}
                      disabled={savingProfile}
                      className="flex-1 bg-[#00c853] hover:bg-[#00e676] text-[#0a0a0a] py-2.5 rounded-lg text-sm font-extrabold cursor-pointer disabled:opacity-50 transition"
                    >
                      {savingProfile ? "Saving…" : "Save account details"}
                    </button>
                    <button
                      type="button"
                      onClick={() => { setEditing(false); setProfileError(""); }}
                      disabled={savingProfile}
                      className="px-4 py-2.5 bg-white/5 border border-white/15 rounded-lg text-sm font-semibold cursor-pointer disabled:opacity-50 transition"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="space-y-3 text-sm">
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-[#888] font-bold mb-0.5">Name</p>
                      <p className="text-white">{data.name || <span className="text-[#888] italic">Not set — tap Edit to add</span>}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-[#888] font-bold mb-0.5">Phone</p>
                      <p className="text-white">{data.phone || <span className="text-[#888] italic">Not set — tap Edit to add</span>}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-[#888] font-bold mb-0.5">Email</p>
                      <p className="text-white">{data.email}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-[#888] font-bold mb-0.5">Sign-in method</p>
                      {data.via === "google" ? (
                        <p className="text-white flex items-center gap-2">
                          <svg className="w-4 h-4" viewBox="0 0 48 48"><path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8c-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4C12.955 4 4 12.955 4 24s8.955 20 20 20s20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"/><path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4C16.318 4 9.656 8.337 6.306 14.691z"/><path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0 1 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"/><path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 0 1-4.087 5.571l.003-.002l6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"/></svg>
                          Linked to your Google account
                        </p>
                      ) : (
                        <p className="text-white">Email-only (no password required)</p>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="grid grid-cols-3 gap-3">
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

            <a href="/" className="block w-full text-center bg-[#00c853] hover:bg-[#00e676] text-[#0a0a0a] py-4 rounded-2xl font-extrabold transition">
              + Sell another device
            </a>
          </div>
        )}

        {section === "addresses" && (
          <div>
            <h2 className="text-lg font-bold mb-1">Saved addresses</h2>
            <p className="text-[#bdbdbd] text-sm mb-4">Used on past shipping trades. We&apos;ll pre-fill the address you pick when you submit a new offer.</p>
            {addresses.length === 0 ? (
              <div className="bg-white/5 border border-white/10 rounded-2xl p-8 text-center">
                <p className="text-[#bdbdbd] text-sm mb-3">No saved addresses yet — they show up after your first shipping trade.</p>
                <a href="/" className="inline-block bg-[#00c853] hover:bg-[#00e676] text-[#0a0a0a] px-5 py-2.5 rounded-xl font-bold transition">
                  Start a trade
                </a>
              </div>
            ) : (
              <div className="space-y-2">
                {addresses.map((a, i) => (
                  <div key={i} className="bg-white/5 border border-white/10 rounded-xl p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold">{a.street}{a.unit ? `, ${a.unit}` : ""}</p>
                        <p className="text-[12px] text-[#bdbdbd] mt-0.5">{a.city}, {a.state} {a.zip}</p>
                        <p className="text-[10px] text-[#888] mt-1.5">Last used {timeAgo(a.lastUsed)} · {a.tradeCount} {a.tradeCount === 1 ? "trade" : "trades"}</p>
                      </div>
                      {i === 0 && (
                        <span className="px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-[#00c853]/15 text-[#00c853] border border-[#00c853]/40 shrink-0">Most recent</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {section === "trades" && (
        <div>

        {/* Open trades */}
        {open.length > 0 && (
          <section className="mb-8">
            <h2 className="text-sm font-bold uppercase tracking-wider text-[#00c853] mb-3">In progress ({open.length})</h2>
            <div className="space-y-3">
              {open.map(t => {
                const meta = STATUS_DISPLAY[t.status] || STATUS_DISPLAY.quote_requested;
                return (
                  <a key={t.id} href={`/offer/${encodeURIComponent(t.id)}`} className="block bg-white/5 border border-white/10 rounded-2xl p-4 hover:border-[#00c853]/40 hover:bg-white/[0.07] transition">
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
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d={meta.emoji} /></svg> {meta.label}
                        </span>
                      </div>
                    </div>
                    {t.fedexTracking && (
                      <span className="mt-3 inline-flex items-center gap-1.5 text-xs text-[#00c853] font-semibold">
                        <svg className="w-4 h-4 text-[#00c853]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-14L4 7m8 4v10M4 7v10l8 4" /></svg> FedEx label ready — open offer to print →
                      </span>
                    )}
                  </a>
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
                  <div key={t.id} className="bg-white/5 border border-white/10 rounded-xl p-3">
                    <a href={`/offer/${encodeURIComponent(t.id)}`} className="flex items-center justify-between gap-3 hover:opacity-80 transition">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold truncate">{t.model || t.device || "Device"}</p>
                        <p className="text-[11px] text-[#888]">{[t.storage, t.condition].filter(Boolean).join(" · ")} · {timeAgo(t.timestamp)}</p>
                      </div>
                      <div className="text-right shrink-0">
                        {t.quote && <p className="text-sm font-bold">{t.quote}</p>}
                        <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider border ${meta.tone} mt-0.5`}>
                          <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d={meta.emoji} /></svg> {meta.label}
                        </span>
                      </div>
                    </a>
                    {/* Two-tap repeat sale — prefills the funnel with the
                        same device/storage/condition and drops the customer
                        at the quote step. Only shown on finished trades
                        (re-quoting an in-flight one doesn't make sense). */}
                    {t.model && (
                      <button
                        type="button"
                        onClick={() => sellAnotherLikeThis(t)}
                        className="mt-2 text-[11px] text-[#00c853] hover:underline font-semibold cursor-pointer"
                      >
                        + Sell another like this →
                      </button>
                    )}
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
        )}

          </div>
        </div>
      </div>
    </main>
  );
}
