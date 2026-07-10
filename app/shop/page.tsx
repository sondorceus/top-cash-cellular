import type { Metadata } from "next";
import Link from "next/link";
import { SlideOnScrollNav } from "../components/SlideOnScrollNav";
import { HeaderSearch } from "../components/HeaderSearch";
import SiteFooter from "../components/SiteFooter";
import { readPublicListings } from "../lib/shop-listings";
import ShopBrowser from "./ShopBrowser";
import { BRAND, LOCATION_DISPLAY } from "../lib/constants";

// The storefront: TCC selling the devices it bought. Every listing is one
// physical device — grade, battery, and photos belong to THAT unit, which is
// the trust edge no stock-photo refurb store can match. Feed is live from
// Blob; a sale must vanish on the next load.
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

export default async function ShopPage() {
  const listings = await readPublicListings();
  listings.sort((a, b) => (a.postedAt < b.postedAt ? 1 : -1));

  return (
    <main className="min-h-screen flex flex-col bg-[#0a0a0a] text-white">
      <SlideOnScrollNav className="sticky top-0 z-40 bg-[#0a0a0a]/95 backdrop-blur-xl border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
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
            <HeaderSearch className="hidden sm:flex w-40 sm:w-56 md:w-64" />
            <Link href="/" className="text-xs text-[#dcdcdc] hover:text-white whitespace-nowrap">
              Sell your device →
            </Link>
          </div>
        </div>
      </SlideOnScrollNav>

      <div className="max-w-7xl mx-auto px-4 pt-10 pb-16 w-full flex-1">
        <div className="max-w-2xl">
          <p className="text-xs font-bold text-[#00c853] tracking-widest uppercase mb-3">The Shop</p>
          <h1 className="text-4xl sm:text-5xl font-bold mb-4 leading-[1.05]">
            Tested by us.
            <br />
            One of one.
          </h1>
          <p className="text-[#dcdcdc] text-lg mb-8">
            Every device here passed through our hands in {LOCATION_DISPLAY} — the photos, the battery
            health, the condition are <em className="not-italic font-semibold text-white">that exact unit</em>.
            When it&apos;s gone, it&apos;s gone.
          </p>
        </div>

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

        <ShopBrowser listings={listings} />
      </div>

      <SiteFooter />
    </main>
  );
}
