import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SlideOnScrollNav } from "../../components/SlideOnScrollNav";
import { HeaderSearch } from "../../components/HeaderSearch";
import SiteFooter from "../../components/SiteFooter";
import { readPublicListings } from "../../lib/shop-listings";
import { GRADE_LABEL, GRADE_BLURB } from "../../lib/shop-grades";
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
  return {
    title: `${name} (${GRADE_LABEL[l.grade]}) — ${priceStr} | ${BRAND}`,
    description: `Buy this tested ${name} in ${GRADE_LABEL[l.grade]} condition for ${priceStr}. ${
      l.batteryPct ? `Battery ${l.batteryPct}%. ` : ""
    }Personally tested in ${LOCATION_DISPLAY}. 30-day returns, local pickup or shipping.`,
    alternates: { canonical: `https://topcashcellular.com/shop/${l.id}` },
  };
}

export default async function ListingPage({ params }: Props) {
  const { id } = await params;
  const l = await getListing(id);
  if (!l) notFound();

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
      <SlideOnScrollNav className="sticky top-0 z-40 bg-[#0a0a0a]/95 backdrop-blur-xl border-b border-white/10">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
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
            <Link href="/shop" className="text-xs text-[#dcdcdc] hover:text-white whitespace-nowrap">
              ← All devices
            </Link>
          </div>
        </div>
      </SlideOnScrollNav>

      <div className="max-w-5xl mx-auto px-4 pt-8 pb-16 w-full flex-1">
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

        <p className="text-xs text-[#555] mt-10">
          Questions about this device? Email {EMAIL} and mention listing {l.id}.
        </p>
      </div>

      <SiteFooter />
    </main>
  );
}
