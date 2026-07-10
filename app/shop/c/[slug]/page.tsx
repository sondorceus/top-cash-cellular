import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import SiteFooter from "../../../components/SiteFooter";
import { readPublicListings } from "../../../lib/shop-listings";
import ShopHeader from "../../ShopHeader";
import ShopBrowser from "../../ShopBrowser";
import { SHOP_CATEGORIES, findCategory, listingInCategory } from "../../categories";
import { BRAND } from "../../../lib/constants";

// Category landing page: /shop/c/iphone, /shop/c/macbook, … Each carries its
// own SEO title/blurb (these are the pages a "used iphone austin" search
// should land on) and an empty state that cross-links the categories that DO
// have stock, so a thin category never dead-ends a visitor.
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const cat = findCategory(slug);
  if (!cat) return { title: `Not found | ${BRAND}` };
  return {
    title: `${cat.title} | ${BRAND}`,
    description: `${cat.blurb} 30-day returns, local Austin pickup or fast shipping.`,
    alternates: { canonical: `https://topcashcellular.com/shop/c/${cat.slug}` },
    openGraph: {
      title: `${cat.title} | ${BRAND}`,
      description: cat.blurb,
      url: `https://topcashcellular.com/shop/c/${cat.slug}`,
    },
  };
}

export default async function CategoryPage({ params }: Props) {
  const { slug } = await params;
  const cat = findCategory(slug);
  if (!cat) notFound();

  const all = await readPublicListings();
  all.sort((a, b) => (a.postedAt < b.postedAt ? 1 : -1));
  const listings = all.filter((l) => listingInCategory(l.category, cat));

  // Which other categories have live stock — for the empty state.
  const othersWithStock = SHOP_CATEGORIES.filter(
    (c) => c.slug !== cat.slug && all.some((l) => l.status !== "sold" && listingInCategory(l.category, c)),
  );

  const emptyState = (
    <div className="bg-white/5 border border-white/10 rounded-2xl p-10 sm:p-14 text-center max-w-xl">
      <p className="text-xs font-bold text-[#00c853] tracking-widest uppercase mb-3">Coming soon</p>
      <div className="text-3xl font-bold mb-3">No {cat.label} in stock right now</div>
      <p className="text-[#dcdcdc] text-sm mb-7">
        Devices land here the moment they clear our bench — check back shortly.
        {othersWithStock.length > 0 && " Or see what's available today:"}
      </p>
      {othersWithStock.length > 0 ? (
        <div className="flex flex-wrap justify-center gap-2 mb-2">
          {othersWithStock.map((c) => (
            <Link
              key={c.slug}
              href={`/shop/c/${c.slug}`}
              className="px-4 py-2 rounded-full text-sm font-semibold bg-white/5 border border-white/15 text-[#dcdcdc] hover:border-[#00c853]/60 hover:text-white transition"
            >
              {c.label}
            </Link>
          ))}
        </div>
      ) : (
        <Link
          href="/"
          className="inline-block bg-[#00c853] text-[#0a0a0a] px-6 py-3 rounded-full font-semibold hover:bg-[#00e676] transition"
        >
          Sell us yours instead
        </Link>
      )}
    </div>
  );

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Shop", item: "https://topcashcellular.com/shop" },
      { "@type": "ListItem", position: 2, name: cat.label, item: `https://topcashcellular.com/shop/c/${cat.slug}` },
    ],
  };

  return (
    <main className="min-h-screen flex flex-col bg-[#0a0a0a] text-white">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <ShopHeader activeSlug={cat.slug} />

      <div className="max-w-7xl mx-auto px-4 pt-10 pb-16 w-full flex-1">
        <nav className="text-xs text-[#63636e] mb-4" aria-label="Breadcrumb">
          <Link href="/shop" className="hover:text-white transition">
            Shop
          </Link>
          <span className="mx-1.5">/</span>
          <span className="text-[#9a9a9a]">{cat.label}</span>
        </nav>

        <div className="flex items-end justify-between gap-6 mb-8 flex-wrap">
          <div className="max-w-2xl">
            <h1 className="text-3xl sm:text-4xl font-bold mb-2 leading-tight">{cat.title}</h1>
            <p className="text-[#dcdcdc]">{cat.blurb}</p>
          </div>
          <div className="hidden md:block h-28 flex-shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={cat.image}
              alt=""
              className="h-full object-contain"
              style={{ filter: "drop-shadow(0 14px 18px rgba(0,0,0,0.5))" }}
            />
          </div>
        </div>

        <ShopBrowser listings={listings} emptyState={emptyState} />

        <div className="mt-14 bg-[#00c853]/10 border border-[#00c853]/30 rounded-2xl p-6 sm:p-8 text-center">
          <div className="font-bold text-lg mb-1">Selling a {cat.label === "More devices" ? "device" : cat.label}?</div>
          <p className="text-sm text-[#dcdcdc] mb-4">Instant quote, top dollar, cash or Zelle same day.</p>
          <Link
            href="/"
            className="inline-block bg-[#00c853] text-[#0a0a0a] px-6 py-2.5 rounded-full font-semibold hover:bg-[#00e676] transition text-sm"
          >
            Get my quote
          </Link>
        </div>
      </div>

      <SiteFooter />
    </main>
  );
}
