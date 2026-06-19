import type { Metadata } from "next";
import SiteFooter from "../components/SiteFooter";
import { BRAND, EMAIL } from "../lib/constants";

export const metadata: Metadata = {
  title: `Best Price Guarantee | ${BRAND}`,
  description: `${BRAND} matches or beats any verified cash buyback offer on the same device. The simple rules that qualify — and what doesn't (carrier credits, private-buyer offers, trade-in installments).`,
  alternates: { canonical: "/best-price-guarantee" },
};

const QUALIFIES: string[] = [
  "A current written quote from another buyback company (a quote page, email, or screenshot with a date).",
  "The exact same device — same model, storage, carrier / lock status, and condition tier.",
  "A cash or equivalent payout (Cash App, Zelle, PayPal, check, Bitcoin).",
];

const DOESNT: string[] = [
  "Carrier or manufacturer trade-in credits, bill credits, or gift cards.",
  "Private-buyer offers (Facebook Marketplace, OfferUp, Craigslist, etc.).",
  "Installment or “trade-in toward a new phone” deals.",
  "Expired offers, or quotes for a different storage, carrier, lock status, or condition.",
];

export default function BestPriceGuaranteePage() {
  return (
    <main className="min-h-screen bg-black text-white flex flex-col">
      <div className="px-6 py-16 max-w-3xl mx-auto w-full">
        <h1 className="text-3xl font-bold mb-2">Best Price Guarantee</h1>
        <p className="text-[#b8b8b8] text-sm mb-8">Found a higher cash offer? We&apos;ll match or beat it.</p>

        <div className="bg-[#00c853]/10 border border-[#00c853]/20 rounded-2xl p-5 mb-8 text-sm text-[#e6e6e6] leading-relaxed">
          <p>Show us a current, verifiable cash buyback offer for the same device and we&apos;ll match it — and beat it by <strong className="text-white">$25</strong> when we can. We&apos;d rather earn your sale than send you elsewhere.</p>
        </div>

        <h2 className="text-xl font-bold mb-3">What qualifies</h2>
        <ul className="space-y-2 mb-8 text-sm text-[#e6e6e6]">
          {QUALIFIES.map((q) => (
            <li key={q} className="flex gap-2"><span className="text-[#00c853] shrink-0">✓</span><span>{q}</span></li>
          ))}
        </ul>

        <h2 className="text-xl font-bold mb-3">What doesn&apos;t qualify</h2>
        <ul className="space-y-2 mb-8 text-sm text-[#e6e6e6]">
          {DOESNT.map((d) => (
            <li key={d} className="flex gap-2"><span className="text-[#ff6b6b] shrink-0">✕</span><span>{d}</span></li>
          ))}
        </ul>

        <div className="bg-white/5 border border-white/10 rounded-2xl p-5 mb-10 text-sm text-[#e6e6e6] leading-relaxed">
          <p>To claim it, email your competing quote to <a href={`mailto:${EMAIL}`} className="text-[#00c853] hover:underline">{EMAIL}</a> (or use the “We&apos;ll beat it” link on your offer page). We confirm the device and offer match, then send you the beating price. The match is honored at inspection like any other quote.</p>
        </div>

        <div className="bg-[#00c853]/10 border border-[#00c853]/20 rounded-2xl p-6 text-center">
          <p className="text-lg font-bold mb-2">Get your number first</p>
          <p className="text-[#e6e6e6] text-sm mb-4">Quote in 30 seconds — then bring us anything better.</p>
          <a href="/" className="inline-block bg-[#00c853] text-[#0a0a0a] px-8 py-3 rounded-2xl font-semibold hover:bg-[#00e676] transition">Get My Quote</a>
        </div>

        <div className="mt-10">
          <a href="/" className="text-sm text-[#00c853] hover:underline">← Back to Home</a>
        </div>
      </div>
      <SiteFooter />
    </main>
  );
}
