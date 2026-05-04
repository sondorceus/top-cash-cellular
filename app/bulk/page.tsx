"use client";

import { useState } from "react";
import Link from "next/link";

export default function BulkPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [company, setCompany] = useState("");
  const [count, setCount] = useState("");
  const [details, setDetails] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    setError("");
    if (!name || !email || !details) { setError("Name, email, and device details are required."); return; }
    setSubmitting(true);
    try {
      const res = await fetch("/api/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name, phone, email,
          device: "BULK TRADE-IN",
          model: company ? `${company} (~${count || '?'} devices)` : `Bulk (~${count || '?'} devices)`,
          storage: "—",
          condition: "—",
          quote: 0,
          payout: "TBD",
          notes: details,
        }),
      });
      if (!res.ok) throw new Error("submit failed");
      setSubmitted(true);
    } catch {
      setError("Something went wrong. Try again or text us.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#0a0a0a] text-white">
      <nav className="sticky top-0 z-40 bg-[#0a0a0a]/95 backdrop-blur-xl border-b border-white/10">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <span className="w-9 h-9 rounded-xl bg-black border border-white/15 flex items-center justify-center">
              <span className="w-6 h-6 rounded-lg bg-[#00c853] flex items-center justify-center">
                <svg viewBox="0 0 24 24" className="w-3.5 h-5" fill="none" stroke="#fff" strokeWidth="2">
                  <rect x="6" y="2" width="12" height="20" rx="2.5" />
                  <line x1="10" y1="19" x2="14" y2="19" strokeLinecap="round" />
                </svg>
              </span>
            </span>
            <div className="flex flex-col leading-none">
              <span className="text-[14px] font-extrabold tracking-tight text-white">TOP CASH</span>
              <span className="text-[10px] font-bold tracking-[0.2em] text-[#00c853] uppercase">Cellular</span>
            </div>
          </Link>
          <Link href="/" className="text-xs text-[#888] hover:text-white">← Single device?</Link>
        </div>
      </nav>

      <div className="max-w-2xl mx-auto px-4 pt-10 pb-16">
        <h1 className="text-4xl font-bold mb-3">Bulk Trade-In</h1>
        <p className="text-[#888] mb-8">5+ devices? Get a custom quote, free pickup in Austin, and 24-hour payment.</p>

        <div className="grid grid-cols-3 gap-2 mb-8">
          <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-center">
            <div className="text-2xl mb-1">📦</div>
            <p className="text-[10px] font-bold text-[#888] uppercase">Free pickup</p>
            <p className="text-xs text-white mt-1">Austin metro area</p>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-center">
            <div className="text-2xl mb-1">⚡</div>
            <p className="text-[10px] font-bold text-[#888] uppercase">24-hr payout</p>
            <p className="text-xs text-white mt-1">After verification</p>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-center">
            <div className="text-2xl mb-1">🔒</div>
            <p className="text-[10px] font-bold text-[#888] uppercase">Data wipe</p>
            <p className="text-xs text-white mt-1">NIST 800-88</p>
          </div>
        </div>

        {/* BULK PRICING TIERS */}
        <div className="bg-gradient-to-br from-[#00c853]/8 via-transparent to-[#00c853]/8 border border-[#00c853]/25 rounded-2xl p-5 mb-8">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-lg">📈</span>
            <h2 className="text-sm font-bold uppercase tracking-wider text-[#00c853]">Volume bonus pricing</h2>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-white/5 border border-white/10 rounded-xl px-3 py-3 text-center">
              <p className="text-2xl font-extrabold text-white">+5%</p>
              <p className="text-[11px] text-[#888] mt-0.5 leading-tight">10+ devices</p>
            </div>
            <div className="bg-[#00c853]/10 border border-[#00c853]/30 rounded-xl px-3 py-3 text-center">
              <p className="text-2xl font-extrabold text-[#00c853]">+10%</p>
              <p className="text-[11px] text-[#aaa] mt-0.5 leading-tight">50+ devices</p>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-xl px-3 py-3 text-center">
              <p className="text-lg font-extrabold text-white leading-none mt-1">Custom</p>
              <p className="text-[11px] text-[#888] mt-1 leading-tight">100+ devices · we&apos;ll call you</p>
            </div>
          </div>
          <p className="text-[11px] text-[#888] text-center mt-3 leading-relaxed">Bonus stacks on top of your base per-device quote. Mixed device types qualify together.</p>
        </div>

        {submitted ? (
          <div className="bg-[#00c853]/10 border border-[#00c853]/30 rounded-2xl p-8 text-center">
            <div className="text-5xl mb-3">✅</div>
            <h2 className="text-2xl font-bold mb-2">Got it!</h2>
            <p className="text-[#ccc] text-sm">A team member will reach out within 1 business hour with a custom quote and pickup options.</p>
            <Link href="/" className="inline-block mt-6 text-[#00c853] hover:underline text-sm">← Back to home</Link>
          </div>
        ) : (
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-4">
            <h2 className="text-lg font-bold mb-2">Tell us about your devices</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name *" className="px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder:text-[#777] focus:outline-none focus:border-[#00c853]" />
              <input value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Company (optional)" className="px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder:text-[#777] focus:outline-none focus:border-[#00c853]" />
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email *" className="px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder:text-[#777] focus:outline-none focus:border-[#00c853]" />
              <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone (recommended)" className="px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder:text-[#777] focus:outline-none focus:border-[#00c853]" />
            </div>
            <input value={count} onChange={(e) => setCount(e.target.value)} placeholder="Approx number of devices (e.g. 25)" className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder:text-[#777] focus:outline-none focus:border-[#00c853]" />
            <textarea value={details} onChange={(e) => setDetails(e.target.value)} required rows={5} placeholder="Mix of devices? Brands, models, conditions — anything you can describe. e.g. '20 iPhone 13 Pro 256GB, 10 MacBook Air M2, all flawless.'" className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder:text-[#777] focus:outline-none focus:border-[#00c853] resize-none" />
            {error && <p className="text-sm text-red-400">{error}</p>}
            <button onClick={submit} disabled={submitting} className="w-full bg-[#00c853] text-white py-4 rounded-2xl text-base font-semibold hover:bg-[#00e676] transition disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer">{submitting ? "Sending…" : "Get a custom quote →"}</button>
            <p className="text-xs text-[#888] text-center">Or text us a list at <a href="tel:+18775492056" className="text-white hover:text-[#00c853] transition">(877) 549-2056</a> for the fastest response.</p>
          </div>
        )}
      </div>
    </main>
  );
}
