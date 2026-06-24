import type { Metadata } from "next";
import Link from "next/link";
import { SlideOnScrollNav } from "../components/SlideOnScrollNav";
import { HeaderSearch } from "../components/HeaderSearch";
import SiteFooter from "../components/SiteFooter";

const EMAIL = "support@topcashcellular.com";
const EMAIL_HREF = `mailto:${EMAIL}?subject=ITAD%20%2F%20bulk%20device%20quote`;

export const metadata: Metadata = {
  title: "IT Asset Disposition (ITAD) in Austin TX | Top Cash Cellular",
  description:
    "Decommission a fleet of phones, laptops, and tablets in Austin TX. Secure NIST 800-88–aligned wipe, serial-by-serial chain-of-custody reporting, certificate of data destruction, and a single bulk payout.",
  alternates: { canonical: "https://topcashcellular.com/it-asset-disposition" },
};

const STEPS: { n: string; title: string; body: string }[] = [
  { n: "1", title: "Send your asset list", body: "Email a rough inventory — make/model, rough condition, and serial/IMEI if you have it. No formatting required; a spreadsheet or even a photo of the pile works." },
  { n: "2", title: "Get a fixed offer", body: "We come back within 24 hours with a per-asset-type offer and pickup options. You approve before anything moves." },
  { n: "3", title: "Pickup + chain of custody", body: "We pick up in the Austin metro, log every serial onto a chain-of-custody receipt, and securely wipe each device (NIST 800-88–aligned)." },
  { n: "4", title: "Reporting + one payout", body: "You get a serial-by-serial report and a signed certificate of data destruction, then a single payment within 5 business days of inspection." },
];

export default function ItadPage() {
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
            <Link href="/bulk" className="text-xs text-[#dcdcdc] hover:text-white whitespace-nowrap">Bulk trade-in →</Link>
          </div>
        </div>
      </SlideOnScrollNav>

      <div className="max-w-2xl mx-auto px-4 pt-10 pb-16">
        <p className="text-[#00c853] text-xs font-bold uppercase tracking-[0.18em] mb-2">For offices, schools, repair shops & resellers</p>
        <h1 className="text-4xl font-bold mb-3">IT Asset Disposition</h1>
        <p className="text-[#dcdcdc] mb-8">Decommissioning end-of-lease laptops, refreshing your team&apos;s iPhones, or shutting down a remote office? We handle the whole chain — pickup, secure wipe, serial-level reporting, and a single bulk payout.</p>

        {/* Trust tiles */}
        <div className="grid grid-cols-3 gap-2 mb-8">
          <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-center">
            <svg className="w-6 h-6 text-[#00c853] mx-auto mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
            <p className="text-[10px] font-bold text-[#dcdcdc] uppercase">Secure wipe</p>
            <p className="text-xs text-white mt-1">NIST 800-88–aligned</p>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-center">
            <svg className="w-6 h-6 text-[#00c853] mx-auto mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
            <p className="text-[10px] font-bold text-[#dcdcdc] uppercase">Chain of custody</p>
            <p className="text-xs text-white mt-1">Every serial logged</p>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-center">
            <svg className="w-6 h-6 text-[#00c853] mx-auto mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            <p className="text-[10px] font-bold text-[#dcdcdc] uppercase">Certificate</p>
            <p className="text-xs text-white mt-1">Of data destruction</p>
          </div>
        </div>

        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 mb-8 space-y-3 text-sm text-[#e6e6e6] leading-relaxed">
          <p><strong className="text-white">What we take in bulk:</strong> iPhones, iPads, MacBooks, Android phones, Galaxy tablets, Windows laptops, Pixel phones, smartwatches — working, broken, anywhere in the lifecycle.</p>
          <p><strong className="text-white">What you get back:</strong> a fixed offer per asset type before pickup, a chain-of-custody receipt with every serial, a signed certificate of data destruction, and one payment within 5 business days of inspection.</p>
        </div>

        {/* How it works */}
        <h2 className="text-lg font-bold mb-3">How it works</h2>
        <div className="space-y-2 mb-8">
          {STEPS.map((s) => (
            <div key={s.n} className="flex items-start gap-3 bg-white/5 border border-white/10 rounded-xl p-4">
              <span className="w-6 h-6 shrink-0 rounded-full bg-[#00c853] text-[#0a0a0a] text-xs font-extrabold flex items-center justify-center">{s.n}</span>
              <div>
                <p className="text-white text-sm font-bold">{s.title}</p>
                <p className="text-[#dcdcdc] text-xs leading-relaxed mt-0.5">{s.body}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="bg-[#00c853]/10 border border-[#00c853]/20 rounded-2xl p-6 text-center">
          <p className="text-lg font-bold mb-2">Got 25+ devices?</p>
          <p className="text-[#e6e6e6] text-sm mb-4">Email a rough device list and we&apos;ll come back with a bulk quote within 24 hours — or start with the bulk trade-in form.</p>
          <div className="flex flex-col sm:flex-row gap-2 justify-center">
            <a href={EMAIL_HREF} className="inline-block bg-[#00c853] text-[#0a0a0a] px-8 py-3 rounded-2xl font-semibold hover:bg-[#00e676] transition">Request a bulk quote</a>
            <Link href="/bulk" className="inline-block bg-white/5 border border-white/15 text-white px-8 py-3 rounded-2xl font-semibold hover:bg-white/10 transition">Bulk trade-in form →</Link>
          </div>
        </div>
      </div>

      <SiteFooter />
    </main>
  );
}
