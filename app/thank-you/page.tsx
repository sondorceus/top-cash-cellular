import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Quote Received — Top Cash Cellular",
  robots: { index: false, follow: false },
};

export default function ThankYou() {
  return (
    <main className="min-h-screen bg-[#0a0a0a] text-white flex items-center justify-center">
      <script dangerouslySetInnerHTML={{ __html: `gtag('event','ads_conversion_Request_quote_1',{});` }} />
      <div className="max-w-lg mx-auto px-4 text-center">
        <div className="w-20 h-20 rounded-full bg-[#00c853]/10 flex items-center justify-center mx-auto mb-6">
          <span className="text-4xl">✅</span>
        </div>
        <h1 className="text-3xl font-bold mb-3">Quote received!</h1>
        <p className="text-[#888] text-lg mb-6">
          We&apos;ll contact you within the hour to arrange pickup and payment.
        </p>
        <div className="bg-white/5 border border-white/10 rounded-2xl p-5 mb-6">
          <p className="text-sm text-[#888]">Your price is locked for 7 days. Same-day payout available.</p>
        </div>
        <a
          href="/"
          className="inline-block bg-[#00c853] text-white px-8 py-3 rounded-2xl font-semibold hover:bg-[#00e676] transition"
        >
          Back to Home
        </a>
        <p className="text-[#555] text-xs mt-6">Questions? Call (877) 549-2056</p>
      </div>
    </main>
  );
}
