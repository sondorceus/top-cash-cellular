import Link from "next/link";
import { SlideOnScrollNav } from "../components/SlideOnScrollNav";
import { HeaderSearch } from "../components/HeaderSearch";
import { SHOP_CATEGORIES } from "./categories";

// Shared chrome for every /shop page: the site's standard slide-away header
// plus a shop-only category bar. One component so the brand block, the
// category order and the active-state styling can never drift between the
// index, category and product pages.
export default function ShopHeader({ activeSlug }: { activeSlug?: string }) {
  return (
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
      {/* category bar — horizontal scroll on mobile, no scrollbar chrome */}
      <div className="border-t border-white/[0.06]">
        <nav
          className="max-w-7xl mx-auto px-4 flex items-center gap-1 overflow-x-auto py-2"
          style={{ scrollbarWidth: "none" }}
          aria-label="Shop categories"
        >
          <Link
            href="/shop"
            className={`px-3.5 py-1.5 rounded-full text-[13px] font-semibold whitespace-nowrap transition ${
              !activeSlug
                ? "bg-[#00c853] text-[#0a0a0a]"
                : "text-[#dcdcdc] hover:text-white hover:bg-white/5"
            }`}
          >
            All
          </Link>
          {SHOP_CATEGORIES.map((c) => (
            <Link
              key={c.slug}
              href={`/shop/c/${c.slug}`}
              className={`px-3.5 py-1.5 rounded-full text-[13px] font-semibold whitespace-nowrap transition ${
                activeSlug === c.slug
                  ? "bg-[#00c853] text-[#0a0a0a]"
                  : "text-[#dcdcdc] hover:text-white hover:bg-white/5"
              }`}
            >
              {c.label}
            </Link>
          ))}
        </nav>
      </div>
    </SlideOnScrollNav>
  );
}
