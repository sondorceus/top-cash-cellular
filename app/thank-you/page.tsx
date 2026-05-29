import type { Metadata } from "next";
import SiteFooter from "../components/SiteFooter";

export const metadata: Metadata = {
  title: "Quote Received — Top Cash Cellular",
  robots: { index: false, follow: false },
};

export default function ThankYou() {
  return (
    <main className="min-h-screen bg-[#0a0a0a] text-white flex flex-col">
      <script dangerouslySetInnerHTML={{ __html: `gtag('event','ads_conversion_Request_quote_1',{});` }} />
      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="max-w-lg mx-auto text-center">
        <div className="w-20 h-20 rounded-full bg-[#00c853]/10 flex items-center justify-center mx-auto mb-6">
          <svg className="w-9 h-9 text-[#00c853]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
        </div>
        <h1 className="text-3xl font-bold mb-3">Quote received!</h1>
        <p className="text-[#dcdcdc] text-lg mb-6">
          We&apos;ll contact you within the hour to arrange pickup and payment.
        </p>
        <div className="bg-white/5 border border-white/10 rounded-2xl p-5 mb-6">
          <p className="text-sm text-[#dcdcdc]">Your price is locked for 14 days. Same-day payout available.</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <a
            href="/"
            className="inline-block bg-[#00c853] text-[#0a0a0a] px-6 py-3 rounded-2xl font-semibold hover:bg-[#00e676] transition"
          >
            Back to Home
          </a>
        </div>
        <p className="text-[#555] text-xs mt-6">Questions? Email <a href="mailto:support@topcashcellular.com" className="text-[#00c853] hover:underline">support@topcashcellular.com</a></p>
        </div>
      </div>

      <SiteFooter />
    </main>
  );
}
