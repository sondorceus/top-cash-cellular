import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import SiteFooter from "../../components/SiteFooter";
import { readPublicListings } from "../../lib/shop-listings";
import { GRADE_LABEL, GRADE_BLURB } from "../../lib/shop-grades";
import ShopHeader from "../ShopHeader";
import { ListingCard } from "../ShopBrowser";
import { categoryForListing } from "../categories";
import Gallery from "./Gallery";
import BuyBox from "./BuyBox";
import { BRAND, LOCATION_DISPLAY, EMAIL } from "../../lib/constants";

// One physical device, one page. Everything shown — grade, battery, photos —
// belongs to this exact unit, which is the entire pitch.
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

async function getListing(id: string) {
  const listings = await readPublicListings();
  return listings.find((l) => l.id === id) ?? null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const l = await getListing(id);
  if (!l) return { title: `Listing not found | ${BRAND}` };
  const priceStr = `$${(l.priceCents / 100).toFixed(0)}`;
  const name = [l.modelLabel, l.storage, l.color].filter(Boolean).join(" ");
  // Absolute image URL for the share card: listing photos are already
  // absolute Blob URLs; stock renders are /public-relative and need the
  // domain. Texting a listing link to a buyer should unfurl with the phone.
  const rawImg = l.photos[0] || l.stockImage || null;
  const ogImg = rawImg ? (rawImg.startsWith("http") ? rawImg : `https://topcashcellular.com${rawImg}`) : undefined;
  const desc = `Buy this tested ${name} in ${GRADE_LABEL[l.grade]} condition for ${priceStr}. ${
    l.batteryPct ? `Battery ${l.batteryPct}%. ` : ""
  }Personally tested in ${LOCATION_DISPLAY}. 30-day returns, local pickup or shipping.`;
  return {
    title: `${name} (${GRADE_LABEL[l.grade]}) — ${priceStr} | ${BRAND}`,
    description: desc,
    alternates: { canonical: `https://topcashcellular.com/shop/${l.id}` },
    openGraph: {
      title: `${name} — ${priceStr} · ${GRADE_LABEL[l.grade]}`,
      description: desc,
      url: `https://topcashcellular.com/shop/${l.id}`,
      ...(ogImg ? { images: [{ url: ogImg }] } : {}),
    },
    twitter: {
      card: "summary_large_image",
      title: `${name} — ${priceStr} · ${GRADE_LABEL[l.grade]}`,
      description: desc,
      ...(ogImg ? { images: [ogImg] } : {}),
    },
  };
}

export default async function ListingPage({ params }: Props) {
  const { id } = await params;
  const all = await readPublicListings();
  const l = all.find((x) => x.id === id) ?? null;
  if (!l) notFound();

  const cat = categoryForListing(l.category);
  const related = all
    .filter((x) => x.id !== l.id && x.status === "listed" && categoryForListing(x.category).slug === cat.slug)
    .sort((a, b) => (a.postedAt < b.postedAt ? 1 : -1))
    .slice(0, 4);

  const name = [l.modelLabel, l.storage, l.color].filter(Boolean).join(" ");
  const priceStr = `$${(l.priceCents / 100).toFixed(2).replace(/\.00$/, "")}`;
  const images = l.photos.length ? l.photos : l.stockImage ? [l.stockImage] : [];

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name,
    image: images,
    description: `${GRADE_LABEL[l.grade]} condition. ${GRADE_BLURB[l.grade]}`,
    offers: {
      "@type": "Offer",
      price: (l.priceCents / 100).toFixed(2),
      priceCurrency: "USD",
      availability:
        l.status === "listed" ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      itemCondition: "https://schema.org/RefurbishedCondition",
      seller: { "@type": "LocalBusiness", name: BRAND },
    },
  };

  return (
    <main className="min-h-screen flex flex-col bg-[#0a0a0a] text-white">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <ShopHeader activeSlug={cat.slug} />

      <div className="max-w-5xl mx-auto px-4 pt-8 pb-16 w-full flex-1">
        <nav className="text-xs text-[#63636e] mb-5" aria-label="Breadcrumb">
          <Link href="/shop" className="hover:text-white transition">
            Shop
          </Link>
          <span className="mx-1.5">/</span>
          <Link href={`/shop/c/${cat.slug}`} className="hover:text-white transition">
            {cat.label}
          </Link>
          <span className="mx-1.5">/</span>
          <span className="text-[#9a9a9a]">{l.modelLabel}</span>
        </nav>

        <div className="grid md:grid-cols-2 gap-8 lg:gap-12">
          <Gallery images={images} alt={name} sold={l.status === "sold"} />

          <div>
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold border text-[#00c853] border-[#00c853]/40 bg-[#00c853]/10">
                {GRADE_LABEL[l.grade]}
              </span>
              {l.carrier && (
                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold border text-[#dcdcdc] border-white/15 bg-white/5">
                  {l.carrier}
                </span>
              )}
              {l.photos.length > 0 && (
                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold border text-[#dcdcdc] border-white/15 bg-white/5">
                  Actual photos
                </span>
              )}
            </div>

            <h1 className="text-3xl sm:text-4xl font-bold leading-tight mb-2">{name}</h1>
            <div className="text-3xl font-extrabold text-[#00c853] mb-5">{priceStr}</div>

            <div className="bg-white/5 border border-white/10 rounded-2xl p-5 mb-4">
              <div className="text-xs font-bold text-[#00c853] tracking-widest uppercase mb-1.5">
                {GRADE_LABEL[l.grade]} condition
              </div>
              <p className="text-sm text-[#dcdcdc]">{GRADE_BLURB[l.grade]}</p>
              {l.notes && <p className="text-sm text-[#dcdcdc] mt-2 border-t border-white/10 pt-2">{l.notes}</p>}
            </div>

            {l.batteryPct ? (
              <div className="bg-white/5 border border-white/10 rounded-2xl p-5 mb-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-bold">Battery health</span>
                  <span className="text-sm font-extrabold text-[#00c853]">{l.batteryPct}%</span>
                </div>
                <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-[#00a039] to-[#00e676]"
                    style={{ width: `${l.batteryPct}%` }}
                  />
                </div>
                <p className="text-xs text-[#9a9a9a] mt-2">Measured on this exact device, not an estimate.</p>
              </div>
            ) : null}

            <BuyBox listingId={l.id} status={l.status} deviceName={name} />

            <div className="mt-6 space-y-2.5">
              {[
                "Tested, charged and wiped by us in person",
                "30-day returns — not what you expected, send it back",
                `Pickup in ${LOCATION_DISPLAY} (pay in hand) or we ship it`,
              ].map((t) => (
                <div key={t} className="flex items-start gap-2.5 text-sm text-[#dcdcdc]">
                  <svg viewBox="0 0 24 24" className="w-5 h-5 flex-shrink-0" fill="none" stroke="#00c853" strokeWidth="2.5">
                    <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  {t}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-16 grid sm:grid-cols-3 gap-4 max-w-4xl">
          {[
            ["1", "Claim it", "Leave your name and number — the device goes on hold for you, nobody else can take it."],
            ["2", "We confirm", "We text you fast to set up pickup in Austin or shipping, whichever you chose."],
            ["3", "Pay when it's real", "Cash, Zelle or Cash App — in person at pickup, or before we ship. No card forms."],
          ].map(([n, t, d]) => (
            <div key={n} className="bg-white/5 border border-white/10 rounded-2xl p-5">
              <div className="w-8 h-8 rounded-full bg-[#00c853]/15 border border-[#00c853]/30 flex items-center justify-center text-[#00c853] font-extrabold text-sm mb-3">
                {n}
              </div>
              <div className="font-bold mb-1">{t}</div>
              <div className="text-sm text-[#9a9a9a]">{d}</div>
            </div>
          ))}
        </div>

        {related.length > 0 && (
          <div className="mt-16">
            <div className="flex items-end justify-between mb-5">
              <h2 className="text-xl font-bold">More {cat.label === "More devices" ? "devices" : cat.label} in stock</h2>
              <Link href={`/shop/c/${cat.slug}`} className="text-xs font-bold text-[#00c853] hover:text-[#00e676] transition">
                See all →
              </Link>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {related.map((r) => (
                <ListingCard key={r.id} l={r} />
              ))}
            </div>
          </div>
        )}

        <p className="text-xs text-[#555] mt-10">
          Questions about this device? Email {EMAIL} and mention listing {l.id}.
        </p>
      </div>

      <SiteFooter />
    </main>
  );
}
