"use client";

import { useState } from "react";
import Link from "next/link";
import { SlideOnScrollNav } from "../components/SlideOnScrollNav";
import { HeaderSearch } from "../components/HeaderSearch";
import SiteFooter from "../components/SiteFooter";

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
  // TCPA consent — /api/lead rejects any non-ship lead that carries a
  // 10-digit phone without smsOptIn:true, so this form (which asks for a
  // phone) lost every bulk lead that included one. Same unchecked box +
  // wording as the main funnel.
  const [smsOptIn, setSmsOptIn] = useState(false);
  const phoneDigits = phone.replace(/\D/g, "");

  const submit = async () => {
    setError("");
    if (!name || !email || !details) { setError("Name, email, and device details are required."); return; }
    if (phoneDigits.length >= 10 && !smsOptIn) { setError("Please tick the SMS consent box under your phone number, or leave the phone blank."); return; }
    setSubmitting(true);
    let serverMsg = "";
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
          // Consent only counts with a number to text (box may stay
          // ticked after the phone is cleared).
          smsOptIn: phoneDigits.length > 0 && smsOptIn,
        }),
      });
      // Show the server's reason (bad email domain, rate limit…) — a
      // generic message left the customer retrying the same failure.
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        if (typeof d?.error === "string") serverMsg = d.error;
        throw new Error("submit failed");
      }
      setSubmitted(true);
    } catch {
      setError(serverMsg || "Something went wrong. Try again or email us.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen flex flex-col bg-[#0a0a0a] text-white">
      <SlideOnScrollNav className="sticky top-0 z-40 bg-[#0a0a0a]/95 backdrop-blur-xl border-b border-white/10">
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
          <div className="flex items-center gap-3">
            <HeaderSearch className="flex w-40 sm:w-56 md:w-64" />
            <Link href="/" className="text-xs text-[#dcdcdc] hover:text-white whitespace-nowrap">← Single device?</Link>
          </div>
        </div>
      </SlideOnScrollNav>

      <div className="max-w-2xl mx-auto px-4 pt-10 pb-16">
        <h1 className="text-4xl font-bold mb-3">Bulk Trade-In</h1>
        <p className="text-[#dcdcdc] mb-6">For offices, schools, repair shops, and resellers. 5+ devices? Get a custom quote, free pickup in Austin, and same-business-day payment after we inspect (typically within 24 hours of pickup).</p>

        <div className="bg-white/5 border border-white/10 rounded-2xl p-5 mb-8 text-sm text-[#dcdcdc] leading-relaxed">
          <p className="text-white font-bold mb-2">Send your list, get a real number back</p>
          <p className="mb-2"><span className="text-white font-semibold">You send:</span> model, storage, carrier/lock status, condition, and IMEI/serial if you have it — paste it in the form below or email us a spreadsheet.</p>
          <p><span className="text-white font-semibold">You get back:</span> an itemized quote with per-device pricing, your total payout, and pickup or free-shipping options — one payment for the whole batch. A NIST 800-88–aligned wipe report is included free on orders of 25+.</p>
        </div>

        <div className="grid grid-cols-3 gap-2 mb-8">
          <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-center">
            <svg className="w-6 h-6 text-[#00c853] mx-auto mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-14L4 7m8 4v10M4 7v10l8 4" /></svg>
            <p className="text-[10px] font-bold text-[#dcdcdc] uppercase">Free pickup</p>
            <p className="text-xs text-white mt-1">Austin metro area</p>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-center">
            <svg className="w-6 h-6 text-[#00c853] mx-auto mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
            <p className="text-[10px] font-bold text-[#dcdcdc] uppercase">24-hr payout</p>
            <p className="text-xs text-white mt-1">After verification</p>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-center">
            <svg className="w-6 h-6 text-[#00c853] mx-auto mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
            <p className="text-[10px] font-bold text-[#dcdcdc] uppercase">Data wipe</p>
            <p className="text-xs text-white mt-1">NIST 800-88</p>
          </div>
        </div>

        {/* BULK PRICING TIERS */}
        <div className="bg-gradient-to-br from-[#00c853]/8 via-transparent to-[#00c853]/8 border border-[#00c853]/25 rounded-2xl p-5 mb-8">
          <div className="flex items-center gap-2 mb-3">
            <svg className="w-5 h-5 text-[#00c853]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
            <h2 className="text-sm font-bold uppercase tracking-wider text-[#00c853]">Volume bonus pricing</h2>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-white/5 border border-white/10 rounded-xl px-3 py-3 text-center">
              <p className="text-2xl font-extrabold text-white">+5%</p>
              <p className="text-[11px] text-[#dcdcdc] mt-0.5 leading-tight">10+ devices</p>
            </div>
            <div className="bg-[#00c853]/10 border border-[#00c853]/30 rounded-xl px-3 py-3 text-center">
              <p className="text-2xl font-extrabold text-[#00c853]">+10%</p>
              <p className="text-[11px] text-[#d4d4d4] mt-0.5 leading-tight">50+ devices</p>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-xl px-3 py-3 text-center">
              <p className="text-lg font-extrabold text-white leading-none mt-1">Custom</p>
              <p className="text-[11px] text-[#dcdcdc] mt-1 leading-tight">100+ devices · we&apos;ll call you</p>
            </div>
          </div>
          <p className="text-[11px] text-[#dcdcdc] text-center mt-3 leading-relaxed">Bonus stacks on top of your base per-device quote. Mixed device types qualify together.</p>
        </div>

        {submitted ? (
          <div className="bg-[#00c853]/10 border border-[#00c853]/30 rounded-2xl p-8 text-center">
            <svg className="w-14 h-14 text-[#00c853] mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            <h2 className="text-2xl font-bold mb-2">Got it!</h2>
            <p className="text-[#e5e5e5] text-sm">A team member will reach out within 1 business hour with a custom quote and pickup options.</p>
            <Link href="/" className="inline-block mt-6 text-[#00c853] hover:underline text-sm">← Back to home</Link>
          </div>
        ) : (
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-4">
            <h2 className="text-lg font-bold mb-2">Tell us about your devices</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name *" aria-label="Full name" className="px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder:text-[#d4d4d4] focus:outline-none focus:border-[#00c853]" />
              <input value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Company (optional)" aria-label="Company (optional)" className="px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder:text-[#d4d4d4] focus:outline-none focus:border-[#00c853]" />
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email *" aria-label="Email" className="px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder:text-[#d4d4d4] focus:outline-none focus:border-[#00c853]" />
              <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone (recommended)" aria-label="Phone" className="px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder:text-[#d4d4d4] focus:outline-none focus:border-[#00c853]" />
            </div>
            {phone.trim() && (
              <label className="flex items-start gap-2.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={smsOptIn}
                  onChange={(e) => setSmsOptIn(e.target.checked)}
                  className="mt-0.5 w-4 h-4 shrink-0 rounded border-white/25 bg-white/5 accent-[#00c853] cursor-pointer"
                />
                <span className="text-[#dcdcdc] text-[11px] leading-relaxed">
                  I agree to receive SMS updates about my trade-in from Top Cash Cellular at the number above. Msg &amp; data rates may apply, msg frequency varies, reply STOP to opt out, HELP for help. See our <a href="/privacy" className="underline hover:text-[#00c853]">privacy policy</a>.
                </span>
              </label>
            )}
            <input value={count} onChange={(e) => setCount(e.target.value)} placeholder="Approx number of devices (e.g. 25)" aria-label="Approximate number of devices" className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder:text-[#d4d4d4] focus:outline-none focus:border-[#00c853]" />
            <textarea value={details} onChange={(e) => setDetails(e.target.value)} required rows={5} placeholder="Mix of devices? Brands, models, conditions — anything you can describe. e.g. '20 iPhone 13 Pro 256GB, 10 MacBook Air M2, all flawless.'" aria-label="Device details" className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder:text-[#d4d4d4] focus:outline-none focus:border-[#00c853] resize-none" />
            {error && <p className="text-sm text-red-400">{error}</p>}
            <button onClick={submit} disabled={submitting} className="w-full bg-[#00c853] text-[#0a0a0a] py-4 rounded-2xl text-base font-semibold hover:bg-[#00e676] transition disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer">{submitting ? "Sending…" : "Get a custom quote →"}</button>
            <p className="text-xs text-[#dcdcdc] text-center">Or email us a list at <a href="mailto:support@topcashcellular.com" className="text-white hover:text-[#00c853] transition">support@topcashcellular.com</a> for the fastest response.</p>
          </div>
        )}
      </div>

      <SiteFooter />
    </main>
  );
}
