import type { Metadata } from "next";
import SiteFooter from "../components/SiteFooter";
import { BRAND } from "../lib/constants";

export const metadata: Metadata = {
  title: `Shipping & Returns | ${BRAND}`,
  description: `How shipping works at ${BRAND}: free prepaid FedEx label with $100 base coverage, optional declared value, same-business-day payout after inspection, and free no-fee returns. Local Austin meetups too.`,
  alternates: { canonical: "/shipping-returns" },
};

const STEPS: { step: string; title: string; body: string }[] = [
  { step: "1", title: "Get your quote", body: "Accept the price on our site. We email a confirmation with a prepaid FedEx label — free to you. The label includes $100 of base shipping coverage; for a higher-value device you can declare additional value at the FedEx counter, or choose a local Austin meetup for zero shipping risk." },
  { step: "2", title: "Pack & drop off", body: "Use any padded box you have at home. Wrap the device, drop it at any FedEx location, and keep your receipt. Your tracking number flows into our system automatically." },
  { step: "3", title: "We inspect within 1 business day", body: "Once the device arrives we test it against the tier you selected and email you the result the same day." },
  { step: "4", title: "Same-business-day payout", body: "If the inspection matches your quote, we pay you that same business day — Cash App or Zelle in minutes, Bitcoin on-chain in ~30 min, or a mailed check. Weekend or after-hours arrivals process the next business day." },
];

export default function ShippingReturnsPage() {
  return (
    <main className="min-h-screen bg-black text-white flex flex-col">
      <div className="px-6 py-16 max-w-3xl mx-auto w-full">
        <h1 className="text-3xl font-bold mb-2">Shipping &amp; Returns</h1>
        <p className="text-[#b8b8b8] text-sm mb-8">Local Austin? We meet you. Out of town? Ship free.</p>

        <div className="space-y-4 mb-10">
          {STEPS.map((s) => (
            <div key={s.step} className="flex items-start gap-4 bg-white/5 rounded-2xl p-5 border border-white/10">
              <div className="w-9 h-9 rounded-full bg-[#00c853] text-[#0a0a0a] font-extrabold flex items-center justify-center shrink-0">{s.step}</div>
              <div>
                <p className="font-bold text-white mb-1">{s.title}</p>
                <p className="text-[#e6e6e6] text-sm leading-relaxed">{s.body}</p>
              </div>
            </div>
          ))}
        </div>

        <h2 className="text-xl font-bold mb-3">Shipping coverage</h2>
        <div className="bg-white/5 border border-white/10 rounded-2xl p-5 mb-8 text-sm text-[#e6e6e6] leading-relaxed">
          <p>The free prepaid FedEx label includes <strong className="text-white">$100 of base coverage</strong> if the package is lost or damaged in transit — it does not cover the full device value. For a high-value device, you can declare and pay for additional coverage at the FedEx counter when you drop off, or pick a <strong className="text-white">local Austin meetup</strong> for zero shipping risk — paid on the spot.</p>
        </div>

        <h2 className="text-xl font-bold mb-3">If we change the offer</h2>
        <div className="bg-white/5 border border-white/10 rounded-2xl p-5 mb-8 space-y-3 text-sm text-[#e6e6e6] leading-relaxed">
          <p>If the device&apos;s actual condition differs from the tier you selected, we&apos;ll show you what we found (with photos), explain the adjustment, and email a revised offer. You have 14 days to decide.</p>
          <p><strong className="text-white">Accept it</strong> — we pay you that same business day.</p>
          <p><strong className="text-white">Reject it</strong> — we ship the device back free of charge via the same carrier. No restocking fee, no questions.</p>
          <p>If you don&apos;t respond within 14 days of the revised-offer email, we assume acceptance.</p>
        </div>

        <h2 className="text-xl font-bold mb-3">Local Austin meetups</h2>
        <div className="bg-white/5 border border-white/10 rounded-2xl p-5 mb-10 space-y-2 text-sm text-[#e6e6e6] leading-relaxed">
          <p>Inside the Austin metro? Skip shipping. We meet at a <strong className="text-white">public location</strong> — a bank lobby, coffee shop, FedEx Office, or another agreed public spot — inspect on the spot, and pay cash or your preferred digital method. No private-home meetups required. Most local meetups take 10–15 minutes.</p>
          <p>Pickup hours: Mon–Sat, 8 AM – 8 PM CT.</p>
        </div>

        <div className="bg-[#00c853]/10 border border-[#00c853]/20 rounded-2xl p-6 text-center">
          <p className="text-lg font-bold mb-2">Ready to ship or meet?</p>
          <p className="text-[#e6e6e6] text-sm mb-4">Lock in your quote — you pick local or shipping at checkout.</p>
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
