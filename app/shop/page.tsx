import type { Metadata } from "next";
import Link from "next/link";
import SiteFooter from "../components/SiteFooter";
import { readPublicListings } from "../lib/shop-listings";
import ShopHeader from "./ShopHeader";
import ShopBrowser from "./ShopBrowser";
import { SHOP_CATEGORIES, listingInCategory } from "./categories";
import { BRAND, LOCATION_DISPLAY, EMAIL } from "../lib/constants";

// The storefront index: hero → category tiles (live counts) → grid with
// sort/grade controls → why-us band → sell-us-yours cross-link → mini FAQ.
// Every listing is one physical device; the layout leans into that instead
// of pretending to be a warehouse.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: `Shop Tested Used Phones & Devices in Austin | ${BRAND}`,
  description:
    "One-of-one used iPhones, Samsung, MacBooks and more — every device personally tested in Austin, TX. Real photos, real battery health, 30-day returns. Local pickup or shipping.",
  alternates: { canonical: "https://topcashcellular.com/shop" },
  openGraph: {
    title: `Shop Tested Used Devices | ${BRAND}`,
    description: "Every device tested by us in Austin. Real photos, real battery health, 30-day returns.",
    url: "https://topcashcellular.com/shop",
  },
};

const FAQ = [
  {
    q: "Is there a warranty?",
    a: "Every device comes with 30-day returns — if it's not what you expected, send it back for a refund. Each one is tested, charged and wiped by us before it's listed.",
  },
  {
    q: "How do I pay?",
    a: "Cash in hand at pickup here in Austin, or Zelle / Cash App if we're shipping it. No card forms — we confirm everything with you personally before any money moves.",
  },
  {
    q: "Why is there only one of each?",
    a: "Because we're not a warehouse. Each listing is a single, real device we bought, tested and photographed ourselves — the battery number and photos belong to that exact unit.",
  },
];

export default async function ShopPage() {
  const listings = await readPublicListings();
  listings.sort((a, b) => (a.postedAt < b.postedAt ? 1 : -1));
  const activeListings = listings.filter((l) => l.status !== "sold");

  const tileCounts = new Map(
    SHOP_CATEGORIES.map((c) => [c.slug, activeListings.filter((l) => listingInCategory(l.category, c)).length]),
  );

  const comingSoon = (
    <div className="bg-white/5 border border-white/10 rounded-2xl p-10 sm:p-14 text-center max-w-xl">
      <p className="text-xs font-bold text-[#00c853] tracking-widest uppercase mb-3">Coming soon</p>
      <div className="text-3xl font-bold mb-3">First devices are in testing</div>
      <p className="text-[#dcdcdc] text-sm mb-7">
        Photos, battery reports and prices land here the moment each device clears our bench. Check back
        shortly — or turn your old one into cash while you wait.
      </p>
      <Link
        href="/"
        className="inline-block bg-[#00c853] text-[#0a0a0a] px-6 py-3 rounded-full font-semibold hover:bg-[#00e676] transition"
      >
        Sell your device
      </Link>
    </div>
  );

  return (
    <main className="min-h-screen flex flex-col bg-[#0a0a0a] text-white">
      <ShopHeader />

      <div className="max-w-7xl mx-auto px-4 pt-10 pb-16 w-full flex-1">
        {/* hero */}
        <div className="max-w-2xl mb-10">
          <p className="text-xs font-bold text-[#00c853] tracking-widest uppercase mb-3">The Shop</p>
          <h1 className="text-4xl sm:text-5xl font-bold mb-4 leading-[1.05]">
            Tested by us.
            <br />
            One of one.
          </h1>
          <p className="text-[#dcdcdc] text-lg">
            Every device here passed through our hands in {LOCATION_DISPLAY} — the photos, the battery
            health, the condition are <em className="not-italic font-semibold text-white">that exact unit</em>.
            When it&apos;s gone, it&apos;s gone.
          </p>
        </div>

        {/* category tiles */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-12">
          {SHOP_CATEGORIES.map((c) => {
            const n = tileCounts.get(c.slug) ?? 0;
            return (
              <Link
                key={c.slug}
                href={`/shop/c/${c.slug}`}
                className="group relative bg-white/5 border border-white/10 rounded-2xl p-4 overflow-hidden transition duration-200 hover:-translate-y-1 hover:border-[#00c853]/45 hover:bg-white/[0.07]"
              >
                <div className="h-24 sm:h-28 flex items-center justify-center mb-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={c.image}
                    alt={c.label}
                    loading="lazy"
                    className="max-h-full max-w-full object-contain transition duration-300 group-hover:scale-[1.06]"
                    style={{ filter: "drop-shadow(0 10px 14px rgba(0,0,0,0.5))" }}
                  />
                </div>
                <div className="font-bold text-sm">{c.label}</div>
                <div className={`text-[11px] mt-0.5 font-semibold ${n > 0 ? "text-[#00c853]" : "text-[#63636e]"}`}>
                  {n > 0 ? `${n} available` : "Coming soon"}
                </div>
              </Link>
            );
          })}
        </div>

        {/* trust strip */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-10 max-w-3xl">
          {[
            ["Tested in person", "Charged, wiped, checked by the people selling it"],
            ["30-day returns", "Not what you expected? Send it back."],
            ["Austin pickup or shipping", "Meet local and pay in hand, or we ship"],
          ].map(([t, d]) => (
            <div key={t} className="bg-white/5 border border-white/10 rounded-xl p-3.5 flex items-start gap-2.5">
              <svg viewBox="0 0 24 24" className="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" stroke="#00c853" strokeWidth="2.5">
                <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <div>
                <div className="text-sm font-bold">{t}</div>
                <div className="text-xs text-[#9a9a9a] mt-0.5">{d}</div>
              </div>
            </div>
          ))}
        </div>

        {/* grid */}
        {activeListings.length > 0 && (
          <h2 className="text-2xl font-bold mb-5">Available now</h2>
        )}
        <ShopBrowser listings={listings} emptyState={comingSoon} />

        {/* why buy here */}
        <div className="mt-16 grid sm:grid-cols-3 gap-4">
          {[
            [
              "No mystery units",
              "Big refurb stores show a stock photo and hope. Every photo, scratch and battery number here belongs to the exact device you receive.",
            ],
            [
              "Graded by the buyer",
              "The same people who paid cash for this device graded it. We only list three honest grades — Excellent, Good, Fair — and broken never makes the shop.",
            ],
            [
              "A real place, real people",
              `We buy and sell in ${LOCATION_DISPLAY} every day. Meet us for pickup, check the device in your hand, and pay when you're happy.`,
            ],
          ].map(([t, d]) => (
            <div key={t} className="bg-white/5 border border-white/10 rounded-2xl p-6">
              <div className="w-10 h-10 rounded-2xl bg-[#00c853]/15 border border-[#00c853]/30 flex items-center justify-center mb-4">
                <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="#00c853" strokeWidth="2">
                  <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <div className="font-bold mb-1.5">{t}</div>
              <div className="text-sm text-[#9a9a9a]">{d}</div>
            </div>
          ))}
        </div>

        {/* sell cross-link */}
        <div className="mt-12 bg-[#00c853]/10 border border-[#00c853]/30 rounded-2xl p-8 sm:p-10 text-center">
          <h2 className="text-2xl font-bold mb-2">Got one like these collecting dust?</h2>
          <p className="text-[#dcdcdc] text-sm mb-6 max-w-lg mx-auto">
            Everything in this shop started as someone&apos;s trade-in. Get an instant quote for yours —
            top dollar, paid in cash, Zelle or Cash App.
          </p>
          <Link
            href="/"
            className="inline-block bg-[#00c853] text-[#0a0a0a] px-8 py-3 rounded-full font-semibold hover:bg-[#00e676] transition"
          >
            Get my quote
          </Link>
        </div>

        {/* mini FAQ */}
        <div className="mt-16 max-w-3xl">
          <h2 className="text-2xl font-bold mb-6">Good to know</h2>
          <div className="space-y-3">
            {FAQ.map((f) => (
              <div key={f.q} className="bg-white/5 border border-white/10 rounded-2xl p-5">
                <div className="font-bold mb-1.5">{f.q}</div>
                <p className="text-sm text-[#9a9a9a]">{f.a}</p>
              </div>
            ))}
          </div>
          <p className="text-xs text-[#555] mt-6">
            Anything else? Email {EMAIL} — a human answers.
          </p>
        </div>
      </div>

      <SiteFooter />
    </main>
  );
}
