import type { Metadata } from "next";
import Link from "next/link";
import { SlideOnScrollNav } from "../../components/SlideOnScrollNav";
import { HeaderSearch } from "../../components/HeaderSearch";
import { DEVICES, getOemComparison, getDevice } from "../../data/sell-catalog";

export function generateStaticParams() {
  return DEVICES.map((d) => ({ slug: d.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const device = getDevice(slug);
  if (!device) return { title: "Sell Your Device | Top Cash Cellular" };
  // Only make the comparison claim in the meta description when it's
  // actually true at this device's headline price. iPhone 17 Pro Max
  // sat at ~$767 with Apple Trade-In showing $700 in the JSON — but
  // when Apple removed it from their site, our old static text still
  // promised "more than Apple". Now it's checked per-slug.
  const cmp = getOemComparison(slug, device.price);
  const tail =
    cmp.kind === "we-beat" ? ` Beat ${cmp.oem} Trade-In by $${cmp.diff}+.` :
    cmp.kind === "wont-trade" ? ` ${cmp.oem} won't take this on trade-in — we will.` :
    "";
  return {
    title: `Sell ${device.name} for Cash in Austin TX | Up to $${device.price} | Top Cash Cellular`,
    description: `Sell your ${device.name} for up to $${device.price} in Austin TX. Instant quote, same-day payout. Cash, Cash App, Zelle, or BTC.${tail}`,
    openGraph: {
      title: `Sell ${device.name} — Up to $${device.price}`,
      description: `Get up to $${device.price} for your ${device.name}. Instant quote, same-day cash payout in Austin TX.`,
      type: "website",
      url: `https://topcashcellular.com/sell/${device.slug}`,
    },
  };
}

export default async function SellDevicePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const device = getDevice(slug);
  if (!device) {
    return (
      <main className="min-h-screen bg-[#0a0a0a] text-white flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Device not found</h1>
          <Link href="/" className="text-[#00c853] hover:underline">Back to Home</Link>
        </div>
      </main>
    );
  }

  const related = DEVICES.filter((d) => d.category === device.category && d.slug !== device.slug).slice(0, 4);
  const cmp = getOemComparison(slug, device.price);
  const oemBullet =
    cmp.kind === "we-beat" ? `We pay $${cmp.diff}+ more than ${cmp.oem} Trade-In` :
    cmp.kind === "wont-trade" ? `${cmp.oem} won't take this on trade-in — we will` :
    "Same-day cash for any condition";

  return (
    <main className="min-h-screen bg-[#0a0a0a] text-white">
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

      <section className="max-w-lg mx-auto px-4 pt-10 pb-8">
        <Link href="/" className="inline-flex items-center gap-2 text-[#00c853] text-sm font-semibold mb-6 px-4 py-2 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 transition">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          All Devices
        </Link>

        <h1 className="text-3xl font-bold tracking-tight mb-2">
          Sell Your {device.name}
        </h1>
        <p className="text-[#dcdcdc] text-lg mb-6">
          Get up to <span className="text-[#00c853] font-bold">${device.price}</span> — Austin TX
        </p>

        <Link href="/?ask=handoff" className="block w-full bg-[#00c853] text-[#0a0a0a] py-5 rounded-2xl text-xl font-bold text-center hover:bg-[#00e676] transition shadow-lg mb-8">
          Get My Quote Now
        </Link>

        <div className="grid grid-cols-3 gap-3 mb-8">
          <div className="bg-white/5 border border-white/10 rounded-xl p-3 text-center">
            <p className="text-[#00c853] text-lg font-bold">${device.price}</p>
            <p className="text-[#dcdcdc] text-[10px]">Up to</p>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-xl p-3 text-center">
            <p className="text-white text-lg font-bold">Same Day</p>
            <p className="text-[#dcdcdc] text-[10px]">Payout</p>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-xl p-3 text-center">
            <p className="text-white text-lg font-bold flex items-center justify-center gap-1">
              4.8
              <svg className="w-4 h-4 text-[#00c853]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.196-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" /></svg>
            </p>
            <p className="text-[#dcdcdc] text-[10px]">Rating</p>
          </div>
        </div>

        <div className="bg-white/5 border border-white/10 rounded-2xl p-5 mb-8">
          <h2 className="text-lg font-bold mb-4">How It Works</h2>
          <div className="space-y-4">
            {[
              { num: "1", title: "Get Your Quote", desc: `Select ${device.name}, choose your storage and condition to get an instant price.` },
              { num: "2", title: "Meet Up or Ship", desc: "Austin local meetup or free prepaid shipping label — your choice." },
              { num: "3", title: "Get Paid", desc: "Cash, Cash App, Zelle, or BTC. Same-day payout on local meetups." },
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

        <div className="bg-white/5 border border-white/10 rounded-2xl p-5 mb-8">
          <h2 className="text-lg font-bold mb-3">Why Sell to Top Cash Cellular?</h2>
          <ul className="space-y-2 text-sm text-[#e5e5e5]">
            <li className="flex items-start gap-2"><svg className="w-5 h-5 text-[#00c853] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> {oemBullet}</li>
            <li className="flex items-start gap-2"><svg className="w-5 h-5 text-[#00c853] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> Same-day payout local · same-day after inspect shipped</li>
            <li className="flex items-start gap-2"><svg className="w-5 h-5 text-[#00c853] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> We buy any condition — even cracked</li>
            <li className="flex items-start gap-2"><svg className="w-5 h-5 text-[#00c853] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> Local Austin meetup or free shipping</li>
            <li className="flex items-start gap-2"><svg className="w-5 h-5 text-[#00c853] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> Cash, Cash App, Zelle, or BTC</li>
          </ul>
        </div>

        {related.length > 0 && (
          <div className="mb-8">
            <h2 className="text-lg font-bold mb-3">Also Buying</h2>
            <div className="grid grid-cols-2 gap-2">
              {related.map((d) => (
                <Link key={d.slug} href={`/sell/${d.slug}`} className="flex items-center justify-between bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 hover:bg-white/10 transition">
                  <span className="text-white text-xs font-medium">{d.name}</span>
                  <span className="text-[#00c853] text-xs font-bold">${d.price}</span>
                </Link>
              ))}
            </div>
          </div>
        )}

        <Link href="/?ask=handoff" className="block w-full bg-[#00c853] text-[#0a0a0a] py-4 rounded-2xl text-base font-bold text-center hover:bg-[#00e676] transition mb-4">
          Sell My {device.name}
        </Link>

        <p className="text-center text-[#555] text-xs">
          Or email us: <a href="mailto:support@topcashcellular.com" className="text-[#00c853] hover:underline">support@topcashcellular.com</a>
        </p>
      </section>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Offer",
            "name": `Sell ${device.name}`,
            "description": `Sell your ${device.name} for up to $${device.price} in Austin TX. Same-day payout on local meetups; same-day after inspection on shipped trades.`,
            "price": device.price,
            "priceCurrency": "USD",
            "url": `https://topcashcellular.com/sell/${device.slug}`,
            "seller": {
              "@type": "LocalBusiness",
              "name": "Top Cash Cellular",
              "address": { "@type": "PostalAddress", "addressLocality": "Austin", "addressRegion": "TX" },
            },
          }),
        }}
      />
    </main>
  );
}
