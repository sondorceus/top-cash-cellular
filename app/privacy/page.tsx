import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy | Top Cash Cellular",
  description: "Privacy Policy for Top Cash Cellular — how we collect, use, and protect your data.",
};

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-black text-white px-6 py-16 max-w-3xl mx-auto">
      <h1 className="text-3xl font-bold mb-8">Privacy Policy</h1>
      <p className="text-sm text-gray-400 mb-8">Last updated: April 18, 2026</p>

      <div className="space-y-8 text-sm text-gray-300 leading-relaxed">
        <section>
          <h2 className="text-lg font-semibold text-white mb-3">1. Information We Collect</h2>
          <p>When you use Top Cash Cellular, we may collect the following information:</p>
          <ul className="list-disc ml-6 mt-2 space-y-1">
            <li><strong>Device details</strong> — model, condition, and storage capacity of the device you want to sell</li>
            <li><strong>Contact information</strong> — name, email address, and phone number you provide through our quote form</li>
            <li><strong>Usage data</strong> — pages visited, time spent on site, and interactions, collected via Google Analytics (GA4)</li>
            <li><strong>Chat messages</strong> — messages you send through our on-site chat widget</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white mb-3">2. How We Use Your Information</h2>
          <ul className="list-disc ml-6 space-y-1">
            <li>To provide you with a quote for your device</li>
            <li>To contact you about your buyback transaction</li>
            <li>To improve our website and services</li>
            <li>To analyze site traffic and usage patterns</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white mb-3">3. Data Sharing</h2>
          <p>We do not sell your personal information. We may share data with:</p>
          <ul className="list-disc ml-6 mt-2 space-y-1">
            <li><strong>Google Analytics</strong> — for anonymous website usage analysis</li>
            <li><strong>Payment processors</strong> — to complete your payout (Cash App, Zelle, BTC, or cash)</li>
            <li><strong>Service providers</strong> — that help us operate our website and business</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white mb-3">4. Cookies</h2>
          <p>We use cookies and similar technologies to analyze traffic and improve your experience. Google Analytics uses cookies to collect anonymous usage data. You can control cookies through your browser settings.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white mb-3">5. Data Retention</h2>
          <p>We retain your contact information and transaction details for up to 12 months after your last interaction. Analytics data is retained according to Google Analytics default settings (14 months).</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white mb-3">6. Your Rights</h2>
          <p>You have the right to:</p>
          <ul className="list-disc ml-6 mt-2 space-y-1">
            <li>Request access to your personal data</li>
            <li>Request deletion of your personal data</li>
            <li>Opt out of analytics tracking</li>
            <li>Withdraw consent at any time</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white mb-3">7. Security</h2>
          <p>We use industry-standard security measures to protect your data, including HTTPS encryption and secure data storage.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white mb-3">8. Contact</h2>
          <p>For privacy-related questions or requests, contact us at:</p>
          <p className="mt-2">Top Cash Cellular<br />Austin, TX<br />Email: info@topcashcellular.com</p>
        </section>
      </div>

      <div className="mt-12 pt-6 border-t border-white/10">
        <a href="/" className="text-sm text-[#00c853] hover:underline">← Back to Home</a>
      </div>
    </main>
  );
}
