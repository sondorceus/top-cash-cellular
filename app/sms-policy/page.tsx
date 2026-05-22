// Public page documenting the SMS consent flow + message types for
// Twilio Toll-Free Verification (and CTIA / carrier compliance). This
// URL goes into the toll-free verification application as the
// `opt_in_image_urls` reference. Linked from the privacy policy.

import Link from "next/link";

export const metadata = {
  title: "SMS Policy — Top Cash Cellular",
  description:
    "How customers opt in to SMS updates from Top Cash Cellular, what messages we send, and how to stop them.",
};

const BRAND = "Top Cash Cellular";
const EMAIL = "CustomerService@topcashcells.com";
const PHONE_DISPLAY = "(877) 549-2056";

export default function SmsPolicyPage() {
  return (
    <main className="min-h-screen bg-[#0a0a0a] text-white">
      <div className="max-w-3xl mx-auto px-4 py-10">
        <Link href="/" className="text-[#00c853] text-sm font-semibold hover:underline">
          ← Top Cash Cellular home
        </Link>

        <h1 className="text-3xl md:text-4xl font-extrabold mt-4 mb-2">SMS / Text Message Policy</h1>
        <p className="text-[#9a9a9a] text-sm mb-8">
          How {BRAND} sends SMS, what kinds of messages, and how to opt out.
        </p>

        <section className="bg-white/[0.04] border border-white/10 rounded-2xl p-5 mb-6">
          <h2 className="text-lg font-bold mb-3 text-[#00c853]">How you opt in</h2>
          <p className="text-[#e6e6e6] text-sm leading-relaxed mb-3">
            We collect SMS consent on our quote-submission form at <a href="https://topcashcellular.com" className="text-[#00c853] hover:underline">topcashcellular.com</a>.
            Directly below the phone-number input on the checkout step, customers see this exact disclosure with a required checkbox:
          </p>
          <div className="bg-black/40 border-l-4 border-[#00c853] rounded-r-lg p-4 text-[13px] text-[#dcdcdc] leading-relaxed">
            <p className="mb-2 flex items-center gap-1.5"><svg className="w-4 h-4 text-[#00c853]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg><strong className="text-white">Required checkbox:</strong></p>
            <p>
              &ldquo;I agree to receive SMS updates about my trade-in from {BRAND} at the number above. Msg &amp; data rates may apply, msg frequency varies, reply STOP to opt out, HELP for help. See our <Link href="/privacy" className="text-[#00c853] underline">privacy policy</Link>.&rdquo;
            </p>
          </div>
          <p className="text-[#bdbdbd] text-xs mt-3">
            The form does not submit unless this checkbox is checked. No phone number is ever used for SMS without this explicit opt-in. Customers may also submit using email only and skip the phone field entirely.
          </p>
        </section>

        <section className="bg-white/[0.04] border border-white/10 rounded-2xl p-5 mb-6">
          <h2 className="text-lg font-bold mb-3 text-[#00c853]">What we send (transactional only)</h2>
          <ul className="space-y-3 text-sm text-[#e6e6e6] leading-relaxed">
            <li>
              <strong className="text-white">Quote confirmation.</strong>{" "}
              <em className="text-[#9a9a9a]">&ldquo;Top Cash: Hi Maria, your $420 quote for iPhone 14 is locked for 7 days. Track: topcashcellular.com/track. Reply STOP to opt out.&rdquo;</em>
            </li>
            <li>
              <strong className="text-white">Shipping label sent.</strong>{" "}
              <em className="text-[#9a9a9a]">&ldquo;Top Cash: Your prepaid FedEx label is in your inbox. Drop your device at any FedEx location.&rdquo;</em>
            </li>
            <li>
              <strong className="text-white">Device received.</strong>{" "}
              <em className="text-[#9a9a9a]">&ldquo;Top Cash: We got your iPhone! Testing now — payout within 24 hrs.&rdquo;</em>
            </li>
            <li>
              <strong className="text-white">Payout sent.</strong>{" "}
              <em className="text-[#9a9a9a]">&ldquo;Top Cash: $420 sent via Cash App. Thanks for selling with us!&rdquo;</em>
            </li>
            <li>
              <strong className="text-white">Counter-offer (rare).</strong>{" "}
              <em className="text-[#9a9a9a]">&ldquo;Top Cash: We inspected your device — revised offer $X (reason). Accept or decline: link.&rdquo;</em>
            </li>
          </ul>
          <p className="text-[#bdbdbd] text-xs mt-4">
            All messages are <strong className="text-white">transactional</strong> — directly related to a specific trade-in the recipient initiated. We do not send marketing SMS, promotional offers, or messages to numbers that have not opted in.
          </p>
        </section>

        <section className="bg-white/[0.04] border border-white/10 rounded-2xl p-5 mb-6">
          <h2 className="text-lg font-bold mb-3 text-[#00c853]">Frequency</h2>
          <p className="text-[#e6e6e6] text-sm leading-relaxed">
            Typically 3–6 messages per trade-in transaction over a 1–7 day window (one at each status: quote, shipped, received, tested, paid). No message frequency outside an active transaction.
          </p>
        </section>

        <section className="bg-white/[0.04] border border-white/10 rounded-2xl p-5 mb-6">
          <h2 className="text-lg font-bold mb-3 text-[#00c853]">How to stop messages</h2>
          <ul className="space-y-2 text-sm text-[#e6e6e6] leading-relaxed">
            <li>Reply <strong className="text-white">STOP</strong> to any message — opt-out is immediate.</li>
            <li>Reply <strong className="text-white">HELP</strong> to receive support contact info.</li>
            <li>Email <a href={`mailto:${EMAIL}`} className="text-[#00c853] hover:underline">{EMAIL}</a> to be removed manually.</li>
          </ul>
        </section>

        <section className="bg-white/[0.04] border border-white/10 rounded-2xl p-5 mb-6">
          <h2 className="text-lg font-bold mb-3 text-[#00c853]">Costs &amp; data</h2>
          <p className="text-[#e6e6e6] text-sm leading-relaxed">
            Message &amp; data rates may apply, depending on your mobile carrier and plan. {BRAND} does not charge for SMS — your carrier may, especially on prepaid plans or international roaming.
          </p>
        </section>

        <section className="bg-white/[0.04] border border-white/10 rounded-2xl p-5">
          <h2 className="text-lg font-bold mb-3 text-[#00c853]">Contact</h2>
          <p className="text-[#e6e6e6] text-sm leading-relaxed">
            Questions about SMS, opt-in, or your data:<br />
            Email: <a href={`mailto:${EMAIL}`} className="text-[#00c853] hover:underline font-semibold">{EMAIL}</a><br />
            Phone: <span className="text-white font-semibold">{PHONE_DISPLAY}</span><br />
            See also our <Link href="/privacy" className="text-[#00c853] hover:underline">Privacy Policy</Link> and <Link href="/terms" className="text-[#00c853] hover:underline">Terms of Service</Link>.
          </p>
        </section>
      </div>
    </main>
  );
}
