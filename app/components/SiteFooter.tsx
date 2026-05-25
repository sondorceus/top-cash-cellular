"use client";

import { useState } from "react";
import { BRAND, EMAIL, EMAIL_HREF, LOCATION_DISPLAY } from "../lib/constants";

// Site-wide footer for the standalone route pages (/faq, /how-it-works,
// /track, etc.). The homepage has its own copy wired to in-page state;
// this one uses real links. In-app sections (Terms, Grading, About...)
// are reached via /?page=<id>, which page.tsx honors on mount.

export default function SiteFooter() {
  const [sent, setSent] = useState(false);

  return (
    <footer className="mt-auto bg-gradient-to-b from-[#0d1f15] via-[#0a1812] to-[#070d0a] text-[#cfcfcf] py-10 relative">
      <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-transparent via-[#00c853]/60 to-transparent" />
      <div className="max-w-lg md:max-w-3xl lg:max-w-7xl mx-auto px-4">
        <div className="mb-8 text-center">
          <p className="text-white font-semibold text-sm mb-1">Smart tech. Smarter savings.</p>
          <p className="text-xs text-[#9a9a9a] mb-3">Sign up for deals & sustainability tips.</p>
          {sent ? (
            <div className="bg-[#00c853]/10 border border-[#00c853]/30 rounded-xl px-4 py-3 max-w-sm mx-auto">
              <p className="text-[#00c853] text-sm font-bold">You&apos;re on the list. Check your inbox.</p>
              <p className="text-[#9a9a9a] text-[11px] mt-1">If it isn&apos;t there in a minute, peek in spam — first emails from new senders sometimes land there.</p>
            </div>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const form = e.currentTarget;
                const name = (form.elements.namedItem("footerNlName") as HTMLInputElement | null)?.value.trim();
                const email = (form.elements.namedItem("footerNlEmail") as HTMLInputElement | null)?.value.trim();
                if (!email) return;
                fetch("/api/newsletter", {
                  method: "POST",
                  headers: { "content-type": "application/json" },
                  body: JSON.stringify({ email, name: name || undefined }),
                }).catch(() => {});
                setSent(true);
              }}
              className="flex flex-col items-stretch gap-2 max-w-sm mx-auto"
            >
              <input
                type="text"
                name="footerNlName"
                placeholder="First name (optional)"
                maxLength={60}
                aria-label="First name (optional)"
                className="px-3 py-2 rounded-full bg-white/5 border border-white/10 text-white text-xs placeholder:text-[#888] focus:outline-none focus:border-[#00c853]/50"
              />
              <div className="flex items-center gap-2">
                <input
                  type="email"
                  name="footerNlEmail"
                  required
                  placeholder="Email address"
                  aria-label="Email address"
                  className="flex-1 px-3 py-2 rounded-full bg-white/5 border border-white/10 text-white text-xs placeholder:text-[#888] focus:outline-none focus:border-[#00c853]/50"
                />
                <button type="submit" className="px-4 py-2 rounded-full bg-[#00c853] text-[#0a0a0a] text-xs font-extrabold hover:bg-[#00e676] transition">Sign up</button>
              </div>
            </form>
          )}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-6 mb-6">
          <div>
            <p className="text-white font-semibold text-xs uppercase tracking-wider mb-3">Quick Navigation</p>
            <div className="space-y-2">
              <a href="/" className="block text-xs hover:text-[#00c853] transition">Get Custom Quote</a>
              <a href="/how-it-works" className="block text-xs hover:text-[#00c853] transition">How It Works</a>
              <a href="/?page=grading" className="block text-xs hover:text-[#00c853] transition">Grading Guide</a>
              <a href="/?page=shipping" className="block text-xs hover:text-[#00c853] transition">Shipping &amp; Returns</a>
              <a href="/faq" className="block text-xs hover:text-[#00c853] transition">FAQ</a>
            </div>
          </div>
          <div>
            <p className="text-white font-semibold text-xs uppercase tracking-wider mb-3">About Us</p>
            <div className="space-y-2">
              <a href="/?page=about" className="block text-xs hover:text-[#00c853] transition">About Us</a>
              <a href="/?page=affiliate" className="block text-xs hover:text-[#00c853] transition">Become an Affiliate</a>
              <a href="/?page=itad" className="block text-xs hover:text-[#00c853] transition">IT Asset Disposition</a>
              <a href="/?page=blog" className="block text-xs hover:text-[#00c853] transition">Blog</a>
              <a href="/reviews" className="block text-xs hover:text-[#00c853] transition">Reviews</a>
              <a href={EMAIL_HREF} className="block text-xs hover:text-[#00c853] transition">Contact Us</a>
            </div>
          </div>
          <div className="col-span-2 md:col-span-1">
            <p className="text-white font-semibold text-xs uppercase tracking-wider mb-3">Legal</p>
            <div className="space-y-2">
              <a href="/privacy" className="block text-xs hover:text-[#00c853] transition">Privacy Policy</a>
              <a href="/?page=terms" className="block text-xs hover:text-[#00c853] transition">Terms &amp; Conditions</a>
              <a href="/?page=cookies" className="block text-xs hover:text-[#00c853] transition">Cookie Policy</a>
              <button
                onClick={() => {
                  try { localStorage.removeItem("cookie-consent"); } catch {}
                  window.location.href = "/";
                }}
                className="block text-xs hover:text-[#00c853] transition cursor-pointer text-left"
              >
                Cookie Settings
              </button>
              <a href="/?page=accessibility" className="block text-xs hover:text-[#00c853] transition">Accessibility Statement</a>
              <p className="text-xs text-[#9a9a9a] pt-2">{LOCATION_DISPLAY} · Mon–Sat 8 AM–8 PM</p>
            </div>
          </div>
        </div>

        <div className="border-t border-[#00c853]/15 pt-6 mb-6 text-center">
          <p className="text-[10px] uppercase tracking-[0.18em] text-[#00c853] font-bold mb-2">Customer Service</p>
          <a href={EMAIL_HREF} className="inline-flex items-center gap-2 text-sm text-white hover:text-[#00c853] transition font-semibold bg-white/[0.12] border border-white/10 rounded-full px-4 py-2">
            <svg className="w-4 h-4 shrink-0 text-[#00c853]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
            {EMAIL}
          </a>
          <p className="text-[11px] text-[#9a9a9a] mt-2">We reply within one business day · Mon–Sat 8 AM–8 PM CT</p>
        </div>

        <div className="border-t border-[#00c853]/15 pt-6 text-center">
          <p className="text-[11px] text-[#cfcfcf]/70 mb-3">© 2026 {BRAND}</p>
          <div className="flex items-center justify-center gap-4 flex-wrap">
            <a href="https://atxgadgetfix.com" target="_blank" rel="noopener noreferrer" className="text-[11px] text-[#cfcfcf] hover:text-[#00c853] transition">
              Need a repair? ATX Gadget Fix →
            </a>
            <span className="text-[#cfcfcf]/30 text-[10px]">·</span>
            <a href="/admin" className="text-[11px] text-[#cfcfcf]/50 hover:text-[#00c853] transition">Staff</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
