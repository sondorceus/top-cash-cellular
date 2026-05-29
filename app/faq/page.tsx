import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { SlideOnScrollNav } from "../components/SlideOnScrollNav";
import { HeaderSearch } from "../components/HeaderSearch";
import SiteFooter from "../components/SiteFooter";

export const metadata: Metadata = {
  title: "FAQ — Top Cash Cellular | Trade-In Questions Answered",
  description: "Common questions about trading in your phone, tablet, laptop, or console with Top Cash Cellular. Payment timing, condition checks, shipping, and more.",
  alternates: { canonical: "https://topcashcellular.com/faq" },
};

// `aText` is a plain-text mirror of `a` for entries whose answer is JSX
// (links can't go into JSON-LD). String answers feed the schema directly.
const FAQ: { q: string; a: ReactNode; aText?: string }[] = [
  {
    q: "What devices do you accept?",
    a: "Phones (iPhone, Samsung Galaxy, Google Pixel), tablets (iPad, Galaxy Tab), MacBooks + PC laptops (HP, Lenovo, Dell, ASUS, Acer, Alienware), game consoles (PS5, Xbox, Nintendo Switch), smartwatches (Apple Watch, Galaxy Watch, Pixel Watch, Garmin), drones (DJI), VR headsets (Meta Quest, Valve Index, Apple Vision Pro), and Mac desktops (iMac, Mac mini, Mac Studio). If you have something unusual and don't see it on the picker, hit \"Other\" — we'll give you a manual quote within an hour.",
  },
  {
    q: "How fast do I get paid?",
    a: "Most payouts go out the same business day we receive and verify your device (typically within 24 hours of arrival; weekends and after-hours arrivals process on the next business day). Cash App and Zelle land within minutes of being sent. Bitcoin (BTC) sends on-chain within ~30 minutes. Local Austin pickups get cash on the spot after a quick ~15-minute inspection.",
  },
  {
    q: "What if my device arrives in worse condition than I quoted?",
    a: "We send you a revised offer with photos and a written explanation. You can accept the new offer, or have the device shipped back to you free of charge. No surprise deductions.",
  },
  {
    q: "Is the price you quote on the website actually what I'll get?",
    a: "Yes — provided your device matches the condition tier you selected (Sealed, Excellent, Good, Fair, Broken) and isn't carrier-locked, KG-locked, or financially encumbered. Read the condition tier descriptions on the quote page carefully.",
  },
  {
    q: "Do you cover shipping?",
    a: "Yes. We email a pre-paid FedEx label as soon as you submit. You drop the box off at any FedEx location.",
  },
  {
    q: "Step-by-step — how does shipping actually work?",
    a: "1. Submit your trade-in on our site and pick \"Ship It.\" 2. Within seconds we email you a prepaid FedEx label (PDF) along with packing instructions. 3. Pack your device in any plain box or padded mailer — no special supplies needed. Wrap in bubble wrap, balled paper, or even a t-shirt so it doesn't rattle. 4. Tape the label flat on top, barcode visible. 5. Drop at any FedEx location or self-service drop box — no appointment, no waiting. 6. FedEx scans it, we get a tracking ping, and you can watch it on our /track page or in FedEx's app.",
  },
  {
    q: "How do I track my package?",
    a: <>Two ways. (1) Use the FedEx tracking number we email you at fedex.com/track. (2) Visit our <Link href="/track" className="text-[#00c853] hover:underline">/track page</Link>, enter your phone or email, and see the live status of every device you've sent us — from \"label minted\" to \"received\" to \"paid.\" No password, identity is the contact info itself.</>,
    aText: "Two ways. (1) Use the FedEx tracking number we email you at fedex.com/track. (2) Visit our /track page, enter your phone or email, and see the live status of every device you've sent us — from \"label minted\" to \"received\" to \"paid.\" No password, identity is the contact info itself.",
  },
  {
    q: "What if I don't have a printer?",
    a: "Two options. (1) FedEx Office: forward the label email to your phone, show the QR code at any FedEx Office counter, and they'll print + ship it free. (2) Reply to the label email asking for a paper label — we'll USPS one to you within a day. Most customers use FedEx Office because it's faster.",
  },
  {
    q: "What about insurance during shipping?",
    a: "Our prepaid FedEx label includes $100 of base shipping coverage — that's what we cover if a package is lost or damaged in transit. We do not cover the full device value. If your device is worth more and you want it fully protected, you're responsible for declaring and paying for the additional insurance at the FedEx counter when you drop it off. By choosing to ship, you agree to the $100 coverage limit. Want full protection with zero shipping risk? Pick a local Austin meetup instead — paid on the spot.",
  },
  {
    q: "Can I change my mind after shipping?",
    a: "Yes. If you reject the final offer for any reason, we ship the device back to you at our cost — no questions asked.",
  },
  {
    q: "How does your price compare to Apple Trade-In or my carrier?",
    a: "The quote page shows a side-by-side with Apple Trade-In and major carriers — pulled from each company's own published values — so you can sanity-check before you sell. On current-generation flagships that Apple/Samsung don't accept yet, we say so directly. And if you find a higher legitimate offer elsewhere, click the \"Got a higher offer?\" pill on your quote and we'll beat it by $25.",
  },
  {
    q: "What if my package weighs more than the prepaid label says?",
    a: "The prepaid label runs on our shipping account, so if your box comes in heavier than the label estimated, FedEx bills us — never you. Just make sure the package contains the device you quoted.",
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
    q: "What if my device still has a balance on it?",
    a: "We can still buy devices that aren't fully paid off — but the offer may be lower. Carriers can blacklist a device for unpaid balance, which makes it unsellable on the secondary market. We adjust the offer to account for that risk. Stolen or fraud-reported devices are different — those we do not buy.",
  },
  {
    q: "What about my SIM card?",
    a: "Pull it before you ship. We discard SIMs at the wipe stage regardless, so leaving yours in just means you're losing a piece of plastic that's still tied to your number. Same goes for SD cards on Androids.",
  },
  {
    q: "Do I need to include the charger, cable, or original box?",
    a: "Only if you picked Sealed condition — that requires the original box + all unopened accessories. For Excellent / Good / Fair / Broken, just send the device. Power cable is optional but appreciated for laptops + consoles (we'll knock the offer down a little if missing on those specifically).",
  },
  {
    q: "How do I find my exact model?",
    a: "iPhone: Settings → General → About → look for \"Model Name\" (e.g. \"iPhone 16 Pro Max\"). Android: Settings → About phone → Model number. MacBook: Apple menu → About This Mac. Most laptops have a sticker on the bottom. Game consoles: model is printed on the back near the serial. If you're not sure, pick the closest match in our picker and our intake team will adjust the offer if it turns out to be a different SKU.",
  },
  {
    q: "What does \"unlocked\" mean and why does it matter?",
    a: "An unlocked phone works on any carrier (AT&T, T-Mobile, Verizon, prepaid). A carrier-locked phone only works with the carrier that originally sold it. Unlocked phones resell at a premium — we pay $50-300 more for unlocked depending on model. Most phones bought outright (paid in full) are unlocked. Phones bought on carrier installment plans are usually locked until paid off. Check by inserting a different carrier's SIM — if it works, you're unlocked.",
  },
  {
    q: "How long is my quote locked in?",
    a: "14 days from submission. If FedEx delivers your device within that window, you're guaranteed the quoted price (subject to condition matching). If something slips past 14 days, we re-quote based on current market — sometimes higher, sometimes lower.",
  },
  {
    q: "I didn't get my confirmation email — what now?",
    a: <>Check spam / promotions first (Gmail loves to filter us). If still missing, email <a href="mailto:support@topcashcellular.com" className="text-[#00c853] hover:underline">support@topcashcellular.com</a> with the name + device you submitted and we'll resend within an hour. You can also use our <Link href="/track" className="text-[#00c853] hover:underline">/track page</Link> to confirm the lead landed — it shows every submission tied to your phone or email.</>,
    aText: "Check spam / promotions first (Gmail loves to filter us). If still missing, email support@topcashcellular.com with the name + device you submitted and we'll resend within an hour. You can also use our /track page to confirm the lead landed — it shows every submission tied to your phone or email.",
  },
  {
    q: "I picked the wrong payout method — can I change it?",
    a: "Yes — as long as we haven't sent payment yet. Reply to your confirmation email (or email support@topcashcellular.com) with your offer number + the new method. Once Cash App / Zelle / BTC has fired, it's irreversible from our end, but we'll work with you on next steps if you catch it after.",
  },
  {
    q: "I disagree with your inspection — what now?",
    a: "We'll send you photos + the specific issue we found. You have three options: (1) Accept the revised offer. (2) Submit a counter-offer — tell us what you think it's worth and we'll either agree or explain why we can't. (3) Request a free return — we ship the device back at our cost. No hard feelings, no restocking fee.",
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
    aText: "Yes — visit our bulk trade-in page for a dedicated quote and pickup option.",
  },
];

// Groups the flat FAQ list above into sections for display. Each entry
// lists the exact `q` strings that belong to the section; the render
// filters FAQ by these. Keeps answer copy untouched in one place.
const FAQ_CATEGORIES: { name: string; questions: string[] }[] = [
  {
    name: "Payments & pricing",
    questions: [
      "How fast do I get paid?",
      "What if my device arrives in worse condition than I quoted?",
      "Is the price you quote on the website actually what I'll get?",
      "How do I know your prices are higher than Apple Trade-In or my carrier?",
      "How long is my quote locked in?",
      "I picked the wrong payout method — can I change it?",
      "How do coupon codes work?",
    ],
  },
  {
    name: "Shipping & tracking",
    questions: [
      "Do you cover shipping?",
      "Step-by-step — how does shipping actually work?",
      "How do I track my package?",
      "What if I don't have a printer?",
      "What about insurance during shipping?",
      "Can I change my mind after shipping?",
      "What if my package weighs more than the prepaid label says?",
    ],
  },
  {
    name: "Your device",
    questions: [
      "What devices do you accept?",
      "Do you buy broken or cracked devices?",
      "What if my device still has a balance on it?",
      "What about my SIM card?",
      "Do I need to include the charger, cable, or original box?",
      "How do I find my exact model?",
      "What does \"unlocked\" mean and why does it matter?",
    ],
  },
  {
    name: "Trust & support",
    questions: [
      "What happens to my data?",
      "I didn't get my confirmation email — what now?",
      "I disagree with your inspection — what now?",
      "Is there a minimum age to trade in?",
      "I have 5+ devices to trade — is there a faster path?",
    ],
  },
];

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQ.map((item) => ({
    "@type": "Question",
    name: item.q,
    acceptedAnswer: {
      "@type": "Answer",
      text: typeof item.a === "string" ? item.a : (item.aText ?? ""),
    },
  })),
};

export default function FAQPage() {
  return (
    <main className="min-h-screen flex flex-col bg-[#0a0a0a] text-white">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
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
            <Link href="/?ask=handoff" className="text-xs text-[#dcdcdc] hover:text-white whitespace-nowrap">← Sell now</Link>
          </div>
        </div>
      </SlideOnScrollNav>

      <div className="max-w-3xl mx-auto px-4 pt-10 pb-16">
        <h1 className="text-4xl font-bold mb-3">Frequently Asked Questions</h1>
        <p className="text-[#dcdcdc] mb-10">Everything you need to know before trading in.</p>

        <div className="space-y-10">
          {FAQ_CATEGORIES.map((cat) => (
            <div key={cat.name}>
              <h2 className="text-[#00c853] text-xs font-bold uppercase tracking-[0.18em] mb-3">{cat.name}</h2>
              <div className="space-y-3">
                {FAQ.filter((item) => cat.questions.includes(item.q)).map((item, i) => (
                  <details key={i} className="group bg-white/5 border border-white/10 rounded-2xl p-5 hover:bg-white/[0.07] transition open:bg-white/[0.07]">
                    <summary className="flex items-center justify-between cursor-pointer list-none">
                      <span className="font-semibold text-white pr-4">{item.q}</span>
                      <span className="text-[#00c853] text-xl flex-shrink-0 group-open:rotate-45 transition-transform">+</span>
                    </summary>
                    <p className="text-[#e5e5e5] text-sm mt-3 leading-relaxed">{item.a}</p>
                  </details>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-12 bg-[#00c853]/10 border border-[#00c853]/30 rounded-2xl p-6 text-center">
          <p className="text-white font-semibold mb-2">Didn&apos;t see your question?</p>
          <p className="text-[#e5e5e5] text-sm mb-4">Email us — we usually reply within an hour during business hours.</p>
          <Link href="/?ask=handoff" className="inline-block bg-[#00c853] text-[#0a0a0a] px-6 py-3 rounded-full font-semibold hover:bg-[#00e676] transition">Get a quote →</Link>
        </div>
      </div>

      <SiteFooter />
    </main>
  );
}
