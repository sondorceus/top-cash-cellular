import type { Metadata } from "next";
import SiteFooter from "../components/SiteFooter";
import { BRAND, EMAIL } from "../lib/constants";

export const metadata: Metadata = {
  title: `Terms of Service | ${BRAND}`,
  description: `${BRAND} terms — quote locks, eligibility (18+ and legal ownership), inspection adjustments, free returns, payouts, and data wipe. Austin, TX device buyback.`,
  alternates: { canonical: "/terms" },
};

const SECTIONS: { h: string; p: string }[] = [
  { h: "1. Quotes & final pricing", p: "Quotes on our site are estimates based on the device model and condition tier you select. The price you see is locked for 14 days from the time of quote. Final pricing is confirmed at inspection — if your device matches the condition you selected, we honor the quoted price." },
  { h: "2. Eligibility & ownership", p: "You must be 18 or older to sell to us. Devices must be legally owned by you — stolen, fraud-reported, activation-locked, or account-locked devices will be refused and may be reported to law enforcement. Devices with a past-due or defaulted financing balance are also refused; phones on a current installment plan are eligible. When you submit, you confirm that you are 18 or older and the legal owner of the device with the right to sell it. We verify each device's IMEI/serial against blacklist and lost/stolen databases before payment. If we refuse a device, we tell you why; eligible refused devices are returned to you free. Devices flagged as lost, stolen, fraud-reported, or subject to a law-enforcement hold may not be returnable until cleared." },
  { h: "3. Inspection & condition adjustments", p: "Every device is inspected before payment. If the actual condition is materially worse than what you selected — broken glass on a “Like New” quote, tripped water-damage indicators, a blacklisted IMEI, etc. — we will show you the issue, explain the adjustment, and offer a revised price. You can accept it or have the device returned at no cost." },
  { h: "4. Return / rejection policy", p: "If you ship a device and don’t like the final offer, we will mail it back to you free of charge via the same carrier we used for the inbound label. No restocking fee. You have 14 days from our revised-offer email to request a return; after that we assume acceptance." },
  { h: "5. Payouts", p: "Payouts are issued the same business day we receive and verify the device. Cash App and Zelle typically land within minutes; Bitcoin sends on-chain within ~30 minutes; local Austin pickups are cash on the spot. Weekend or after-hours arrivals are processed the next business day. Payments are made only to the legal owner of the device." },
  { h: "6. Data on your device", p: "You are responsible for backing up and removing your personal data before selling. We recommend a factory reset and sign-out from Find My iPhone / Google Account / Samsung Account. We perform a NIST 800-88–aligned wipe before resale or recycling, but we’re not liable for any data left on your device prior to handoff." },
  { h: "7. Records", p: "As a Texas secondhand dealer we retain transaction records — including device description, serial/IMEI, payout amount, and the seller’s ownership attestation — for the period required by Austin and Texas law." },
  { h: "8. Finality", p: "Once payment has been issued and accepted, the sale is final. We cannot reverse a completed transaction." },
];

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-black text-white flex flex-col">
      <div className="px-6 py-16 max-w-3xl mx-auto w-full">
        <h1 className="text-3xl font-bold mb-2">Terms of Service</h1>
        <p className="text-sm text-gray-400 mb-8">Last updated June 19, 2026</p>
        <div className="space-y-7 text-sm text-gray-300 leading-relaxed">
          {SECTIONS.map((s) => (
            <section key={s.h}>
              <h2 className="text-base font-semibold text-white mb-1.5">{s.h}</h2>
              <p>{s.p}</p>
            </section>
          ))}
          <section>
            <h2 className="text-base font-semibold text-white mb-1.5">9. Contact</h2>
            <p>Questions about these terms? Email <a href={`mailto:${EMAIL}`} className="text-[#00c853] hover:underline">{EMAIL}</a> and we&apos;ll respond within one business day.</p>
          </section>
        </div>
        <div className="mt-10">
          <a href="/" className="text-sm text-[#00c853] hover:underline">← Back to Home</a>
        </div>
      </div>
      <SiteFooter />
    </main>
  );
}
