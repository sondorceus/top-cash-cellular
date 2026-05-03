import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "FAQ — Top Cash Cellular | Trade-In Questions Answered",
  description: "Common questions about trading in your phone, tablet, laptop, or console with Top Cash Cellular. Payment timing, condition checks, shipping, and more.",
  alternates: { canonical: "https://topcashcellular.com/faq" },
};

const FAQ = [
  {
    q: "How fast do I get paid?",
    a: "Most payouts go out the same business day we receive and verify your device. PayPal, Venmo, Cash App, and Zelle land within minutes. Mailed checks take 2–3 business days.",
  },
  {
    q: "What if my device arrives in worse condition than I quoted?",
    a: "We send you a revised offer with photos and a written explanation. You can accept the new offer, or have the device shipped back to you free of charge. No surprise deductions.",
  },
  {
    q: "Is the price you quote on the website actually what I'll get?",
    a: "Yes — provided your device matches the condition tier you selected (Flawless, Very Good, etc.) and isn't carrier-locked, KG-locked, or financially encumbered. Read the condition tier descriptions on the quote page carefully.",
  },
  {
    q: "Do you cover shipping?",
    a: "Yes. We email a pre-paid FedEx or UPS label as soon as you accept the offer. You drop the box off at any FedEx/UPS location.",
  },
  {
    q: "What about insurance during shipping?",
    a: "All trade-ins are insured up to $1,500 by default through our shipping carriers. Higher-value devices (e.g., MacBook Pro 16, Z TriFold) are insured for their full quoted value.",
  },
  {
    q: "Can I change my mind after shipping?",
    a: "Yes. If you reject the final offer for any reason, we ship the device back to you at our cost — no questions asked.",
  },
  {
    q: "How do I know your prices are higher than Apple Trade-In or my carrier?",
    a: "On the quote page we show a side-by-side comparison with Apple Trade-In and major carriers, plus the dollar difference. If you find a higher legitimate offer elsewhere, click the price-match pill on your quote and we'll beat it by $25.",
  },
  {
    q: "What happens to my data?",
    a: "Every device gets a full factory wipe before resale or recycling. We're certified to handle data sanitization to NIST 800-88 standards. You can also wipe the device yourself before shipping — recommended.",
  },
  {
    q: "Do you buy broken or cracked devices?",
    a: "Yes — most of them. Pick the 'Broken' tier when getting your quote. Some catastrophic damage (severe water, motherboard failure with no power) may be priced as parts.",
  },
  {
    q: "How do coupon codes work?",
    a: "Enter the code on the quote page before adding to cart. Active codes apply a percentage bonus on top of your quote. Codes can be combined with promotions.",
  },
  {
    q: "Is there a minimum age to trade in?",
    a: "You must be 18 or older. Anyone under 18 needs a parent or guardian to complete the trade.",
  },
  {
    q: "I have 5+ devices to trade — is there a faster path?",
    a: <>Yes — visit our <Link href="/bulk" className="text-[#00c853] hover:underline">bulk trade-in page</Link> for a dedicated quote and pickup option.</>,
  },
];

export default function FAQPage() {
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
          <Link href="/" className="text-xs text-[#888] hover:text-white">← Sell now</Link>
        </div>
      </nav>

      <div className="max-w-3xl mx-auto px-4 pt-10 pb-16">
        <h1 className="text-4xl font-bold mb-3">Frequently Asked Questions</h1>
        <p className="text-[#888] mb-10">Everything you need to know before trading in.</p>

        <div className="space-y-3">
          {FAQ.map((item, i) => (
            <details key={i} className="group bg-white/5 border border-white/10 rounded-2xl p-5 hover:bg-white/[0.07] transition open:bg-white/[0.07]">
              <summary className="flex items-center justify-between cursor-pointer list-none">
                <span className="font-semibold text-white pr-4">{item.q}</span>
                <span className="text-[#00c853] text-xl flex-shrink-0 group-open:rotate-45 transition-transform">+</span>
              </summary>
              <p className="text-[#ccc] text-sm mt-3 leading-relaxed">{item.a}</p>
            </details>
          ))}
        </div>

        <div className="mt-12 bg-[#00c853]/10 border border-[#00c853]/30 rounded-2xl p-6 text-center">
          <p className="text-white font-semibold mb-2">Didn&apos;t see your question?</p>
          <p className="text-[#ccc] text-sm mb-4">Text or call us — we usually reply in under 5 minutes during business hours.</p>
          <Link href="/" className="inline-block bg-[#00c853] text-white px-6 py-3 rounded-full font-semibold hover:bg-[#00e676] transition">Get a quote →</Link>
        </div>
      </div>
    </main>
  );
}
