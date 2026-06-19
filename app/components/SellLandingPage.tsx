import Link from "next/link";
import { SlideOnScrollNav } from "./SlideOnScrollNav";
import { HeaderSearch } from "./HeaderSearch";
import SiteFooter from "./SiteFooter";
import { BRAND, EMAIL, MARKETING_DOMAIN } from "../lib/constants";
import {
  topDevicesByCategory,
  maxPrice,
  getDevice,
  type Device,
} from "../data/sell-catalog";
import type { LandingConfig } from "../data/landing-pages";

const CheckIcon = () => (
  <svg className="w-5 h-5 text-[#00c853] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

function resolveDevices(config: LandingConfig): Device[] {
  if (config.pickSlugs && config.pickSlugs.length > 0) {
    return config.pickSlugs
      .map((s) => getDevice(s))
      .filter((d): d is Device => Boolean(d))
      .slice(0, config.gridLimit);
  }
  if (config.pickCategory) {
    return topDevicesByCategory(config.pickCategory, config.gridLimit);
  }
  return [];
}

export default function SellLandingPage({ config }: { config: LandingConfig }) {
  const devices = resolveDevices(config);
  const topPrice = maxPrice(devices);
  const canonical = `https://${MARKETING_DOMAIN}/${config.slug}`;

  // JSON-LD: LocalBusiness + the FAQ + the page itself, in one graph so a
  // single script tag carries both the local-SEO entity and the FAQ rich
  // result. The FAQ answers are the same plain text shown on the page.
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "LocalBusiness",
        "@id": `https://${MARKETING_DOMAIN}/#business`,
        name: BRAND,
        description:
          "Austin, TX phone, tablet, and laptop buyback — instant cash quotes, same-day payout, local meetup or free shipping.",
        url: `https://${MARKETING_DOMAIN}/`,
        email: EMAIL,
        priceRange: "$$",
        areaServed: { "@type": "City", name: "Austin", "@id": "https://www.wikidata.org/wiki/Q16559" },
        address: { "@type": "PostalAddress", addressLocality: "Austin", addressRegion: "TX", addressCountry: "US" },
        openingHours: "Mo-Sa 08:00-20:00",
      },
      {
        "@type": "WebPage",
        "@id": `${canonical}#webpage`,
        url: canonical,
        name: config.metaTitle,
        description: config.metaDescription,
        about: { "@id": `https://${MARKETING_DOMAIN}/#business` },
      },
      {
        "@type": "FAQPage",
        "@id": `${canonical}#faq`,
        mainEntity: config.faqs.map((f) => ({
          "@type": "Question",
          name: f.q,
          acceptedAnswer: { "@type": "Answer", text: f.a },
        })),
      },
    ],
  };

  const noticeStyles =
    config.notice?.tone === "warn"
      ? "bg-[#ffcf4d]/[0.07] border-[#ffcf4d]/25"
      : "bg-[#00c853]/10 border-[#00c853]/20";

  return (
    <main className="min-h-screen bg-[#0a0a0a] text-white flex flex-col">
      <SlideOnScrollNav className="sticky top-0 z-40 bg-[#0a0a0a]/95 backdrop-blur-xl border-b border-white/10">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex flex-col leading-none">
              <span className="text-[13px] font-extrabold tracking-tight text-white">TOP CASH</span>
              <span className="text-[9px] font-semibold tracking-[0.15em] text-[#00c853] uppercase">Cellular</span>
            </div>
          </Link>
          <div className="flex items-center gap-3">
            <HeaderSearch className="flex w-40 sm:w-56 md:w-64" />
            <Link href="/?ask=handoff" className="bg-[#00c853] text-[#0a0a0a] px-4 py-2 rounded-full text-xs font-semibold hover:bg-[#00e676] transition whitespace-nowrap">
              Get Quote
            </Link>
          </div>
        </div>
      </SlideOnScrollNav>

      {/* Hero */}
      <section className="max-w-lg mx-auto px-4 pt-10 pb-6 w-full">
        <p className="inline-flex items-center gap-2 text-[#00c853] text-xs font-semibold mb-4 px-3 py-1.5 rounded-full bg-[#00c853]/10 border border-[#00c853]/20">
          <span className="w-1.5 h-1.5 rounded-full bg-[#00c853]" />
          Austin, TX · Local cash buyer
        </p>
        <h1 className="text-3xl font-bold tracking-tight mb-2">{config.h1}</h1>
        <p className="text-[#dcdcdc] text-lg mb-2">{config.heroLine}</p>
        {config.showHeroPrice && topPrice > 0 && (
          <p className="text-[#dcdcdc] text-base mb-2">
            Get up to <span className="text-[#00c853] font-bold">${topPrice}</span>
            {config.heroPriceNote ? ` ${config.heroPriceNote}` : ""}
          </p>
        )}

        <Link href="/?ask=handoff" className="block w-full bg-[#00c853] text-[#0a0a0a] py-5 rounded-2xl text-xl font-bold text-center hover:bg-[#00e676] transition mt-5 mb-4">
          Get My Quote Now
        </Link>
        <p className="text-[#9a9a9a] text-sm leading-relaxed">{config.intro}</p>
      </section>

      {/* Eligibility / honesty notice */}
      {config.notice && (
        <section className="max-w-lg mx-auto px-4 pb-2 w-full">
          <div className={`rounded-2xl border p-5 ${noticeStyles}`}>
            <p className="text-white font-bold text-sm mb-1.5">{config.notice.title}</p>
            <p className="text-[#d6d6d6] text-xs leading-relaxed">{config.notice.body}</p>
          </div>
        </section>
      )}

      {/* Device price grid */}
      <section className="max-w-lg mx-auto px-4 pt-6 pb-2 w-full">
        <h2 className="text-lg font-bold mb-1">{config.gridHeading}</h2>
        <p className="text-[#9a9a9a] text-xs mb-4">{config.gridSub}</p>
        <div className="grid grid-cols-2 gap-2">
          {devices.map((d) => (
            <Link key={d.slug} href={`/sell/${d.slug}`} className="flex items-center justify-between bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 hover:bg-white/10 transition">
              <span className="text-white text-xs font-medium pr-2">{d.name}</span>
              <span className="text-[#00c853] text-xs font-bold whitespace-nowrap">
                {config.showHeroPrice ? `$${d.price}` : "Quote"}
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="max-w-lg mx-auto px-4 pt-8 pb-2 w-full">
        <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
          <h2 className="text-lg font-bold mb-4">How it works</h2>
          <div className="space-y-4">
            {[
              { num: "1", title: "Get your quote", desc: config.quotePickLine || "Pick your model, storage, carrier, and condition for an instant cash number." },
              { num: "2", title: "Meet up or ship", desc: "Local Austin meetup or a free prepaid shipping label — your choice." },
              { num: "3", title: "Get paid", desc: "Cash, Cash App, Zelle, or Bitcoin. Same-day payout on local meetups." },
            ].map((s) => (
              <div key={s.num} className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-[#00c853]/15 flex items-center justify-center shrink-0">
                  <span className="text-[#00c853] text-sm font-bold">{s.num}</span>
                </div>
                <div>
                  <p className="text-white text-sm font-semibold">{s.title}</p>
                  <p className="text-[#dcdcdc] text-xs">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Why us */}
      <section className="max-w-lg mx-auto px-4 pt-6 pb-2 w-full">
        <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
          <h2 className="text-lg font-bold mb-3">{config.whyHeading}</h2>
          <ul className="space-y-2 text-sm text-[#e5e5e5]">
            {config.whyBullets.map((b) => (
              <li key={b} className="flex items-start gap-2"><CheckIcon /> <span>{b}</span></li>
            ))}
          </ul>
        </div>
      </section>

      {/* FAQ */}
      <section className="max-w-lg mx-auto px-4 pt-6 pb-2 w-full">
        <h2 className="text-lg font-bold mb-3">{config.faqHeading}</h2>
        <div className="space-y-2">
          {config.faqs.map((f) => (
            <details key={f.q} className="group bg-white/5 border border-white/10 rounded-xl px-4 py-3">
              <summary className="flex items-center justify-between cursor-pointer list-none text-sm font-semibold text-white">
                {f.q}
                <span className="text-[#00c853] ml-3 transition-transform group-open:rotate-45">+</span>
              </summary>
              <p className="text-[#cfcfcf] text-xs leading-relaxed mt-2">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* Closing CTA */}
      <section className="max-w-lg mx-auto px-4 pt-8 pb-12 w-full">
        <div className="bg-[#00c853]/10 border border-[#00c853]/20 rounded-2xl p-6 text-center">
          <p className="text-lg font-bold mb-1">Get your number first</p>
          <p className="text-[#e6e6e6] text-sm mb-4">30-second quote. No account, no obligation.</p>
          <Link href="/?ask=handoff" className="inline-block bg-[#00c853] text-[#0a0a0a] px-8 py-3 rounded-2xl font-semibold hover:bg-[#00e676] transition">
            Get My Quote
          </Link>
          <p className="text-[#9a9a9a] text-xs mt-4">
            Or email us: <a href={`mailto:${EMAIL}`} className="text-[#00c853] hover:underline">{EMAIL}</a>
          </p>
        </div>
      </section>

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <SiteFooter />
    </main>
  );
}
