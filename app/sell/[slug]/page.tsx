import type { Metadata } from "next";
import Link from "next/link";

const DEVICES = [
  { slug: "iphone-17-pro-max", name: "iPhone 17 Pro Max", category: "iPhone", price: 580, year: 2025 },
  { slug: "iphone-17-pro", name: "iPhone 17 Pro", category: "iPhone", price: 500, year: 2025 },
  { slug: "iphone-17", name: "iPhone 17", category: "iPhone", price: 400, year: 2025 },
  { slug: "iphone-16-pro-max", name: "iPhone 16 Pro Max", category: "iPhone", price: 500, year: 2024 },
  { slug: "iphone-16-pro", name: "iPhone 16 Pro", category: "iPhone", price: 420, year: 2024 },
  { slug: "iphone-16", name: "iPhone 16", category: "iPhone", price: 350, year: 2024 },
  { slug: "iphone-15-pro-max", name: "iPhone 15 Pro Max", category: "iPhone", price: 310, year: 2023 },
  { slug: "iphone-15-pro", name: "iPhone 15 Pro", category: "iPhone", price: 260, year: 2023 },
  { slug: "iphone-15", name: "iPhone 15", category: "iPhone", price: 210, year: 2023 },
  { slug: "iphone-14-pro-max", name: "iPhone 14 Pro Max", category: "iPhone", price: 250, year: 2022 },
  { slug: "iphone-14-pro", name: "iPhone 14 Pro", category: "iPhone", price: 210, year: 2022 },
  { slug: "iphone-14", name: "iPhone 14", category: "iPhone", price: 160, year: 2022 },
  { slug: "iphone-13-pro-max", name: "iPhone 13 Pro Max", category: "iPhone", price: 200, year: 2021 },
  { slug: "iphone-13", name: "iPhone 13", category: "iPhone", price: 140, year: 2021 },
  { slug: "iphone-12", name: "iPhone 12", category: "iPhone", price: 100, year: 2020 },
  { slug: "iphone-11", name: "iPhone 11", category: "iPhone", price: 80, year: 2019 },
  { slug: "samsung-galaxy-s24-ultra", name: "Samsung Galaxy S24 Ultra", category: "Samsung", price: 500, year: 2024 },
  { slug: "samsung-galaxy-s24", name: "Samsung Galaxy S24", category: "Samsung", price: 320, year: 2024 },
  { slug: "samsung-galaxy-s23-ultra", name: "Samsung Galaxy S23 Ultra", category: "Samsung", price: 350, year: 2023 },
  { slug: "samsung-galaxy-s23", name: "Samsung Galaxy S23", category: "Samsung", price: 200, year: 2023 },
  { slug: "samsung-galaxy-z-fold-5", name: "Samsung Galaxy Z Fold 5", category: "Samsung", price: 500, year: 2023 },
  { slug: "samsung-galaxy-z-flip-5", name: "Samsung Galaxy Z Flip 5", category: "Samsung", price: 280, year: 2023 },
  { slug: "macbook-pro-16-m4", name: "MacBook Pro 16\" M4", category: "MacBook", price: 1200, year: 2024 },
  { slug: "macbook-pro-14-m4", name: "MacBook Pro 14\" M4", category: "MacBook", price: 900, year: 2024 },
  { slug: "macbook-air-m3", name: "MacBook Air M3", category: "MacBook", price: 600, year: 2024 },
  { slug: "macbook-pro-16-m3", name: "MacBook Pro 16\" M3", category: "MacBook", price: 900, year: 2023 },
  { slug: "macbook-air-m2", name: "MacBook Air M2", category: "MacBook", price: 400, year: 2022 },
  { slug: "playstation-5", name: "PlayStation 5", category: "Console", price: 300, year: 2020 },
  { slug: "xbox-series-x", name: "Xbox Series X", category: "Console", price: 250, year: 2020 },
  { slug: "nintendo-switch-oled", name: "Nintendo Switch OLED", category: "Console", price: 180, year: 2021 },
];

export function generateStaticParams() {
  return DEVICES.map((d) => ({ slug: d.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const device = DEVICES.find((d) => d.slug === slug);
  if (!device) return { title: "Sell Your Device | Top Cash Cellular" };
  return {
    title: `Sell ${device.name} for Cash in Austin TX | Up to $${device.price} | Top Cash Cellular`,
    description: `Sell your ${device.name} for up to $${device.price} in Austin TX. Instant quote, same-day payout. Cash, Venmo, Zelle, or PayPal. We pay more than Apple trade-in.`,
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
  const device = DEVICES.find((d) => d.slug === slug);
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

  return (
    <main className="min-h-screen bg-[#0a0a0a] text-white">
      <nav className="sticky top-0 z-40 bg-[#0a0a0a]/95 backdrop-blur-xl border-b border-white/10">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex flex-col leading-none">
              <span className="text-[13px] font-extrabold tracking-tight text-white">TOP CASH</span>
              <span className="text-[9px] font-semibold tracking-[0.15em] text-[#00c853] uppercase">Cellular</span>
            </div>
          </Link>
          <Link href="/" className="bg-[#00c853] text-white px-4 py-2 rounded-full text-xs font-semibold hover:bg-[#00e676] transition">
            Get Quote
          </Link>
        </div>
      </nav>

      <section className="max-w-lg mx-auto px-4 pt-10 pb-8">
        <Link href="/" className="inline-flex items-center gap-2 text-[#00c853] text-sm font-semibold mb-6 px-4 py-2 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 transition">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          All Devices
        </Link>

        <h1 className="text-3xl font-bold tracking-tight mb-2">
          Sell Your {device.name}
        </h1>
        <p className="text-[#888] text-lg mb-6">
          Get up to <span className="text-[#00c853] font-bold">${device.price}</span> — Austin TX
        </p>

        <Link href="/" className="block w-full bg-[#00c853] text-white py-5 rounded-2xl text-xl font-bold text-center hover:bg-[#00e676] transition shadow-lg shadow-[#00c853]/20 mb-8">
          Get My Quote Now
        </Link>

        <div className="grid grid-cols-3 gap-3 mb-8">
          <div className="bg-white/5 border border-white/10 rounded-xl p-3 text-center">
            <p className="text-[#00c853] text-lg font-bold">${device.price}</p>
            <p className="text-[#888] text-[10px]">Up to</p>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-xl p-3 text-center">
            <p className="text-white text-lg font-bold">Same Day</p>
            <p className="text-[#888] text-[10px]">Payout</p>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-xl p-3 text-center">
            <p className="text-white text-lg font-bold">4.9★</p>
            <p className="text-[#888] text-[10px]">Rating</p>
          </div>
        </div>

        <div className="bg-white/5 border border-white/10 rounded-2xl p-5 mb-8">
          <h2 className="text-lg font-bold mb-4">How It Works</h2>
          <div className="space-y-4">
            {[
              { num: "1", title: "Get Your Quote", desc: `Select ${device.name}, choose your storage and condition to get an instant price.` },
              { num: "2", title: "Meet Up or Ship", desc: "Austin local meetup or free prepaid shipping label — your choice." },
              { num: "3", title: "Get Paid", desc: "Cash, Venmo, Zelle, or PayPal. Same-day payout on local meetups." },
            ].map((s) => (
              <div key={s.num} className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-[#00c853]/15 flex items-center justify-center shrink-0">
                  <span className="text-[#00c853] text-sm font-bold">{s.num}</span>
                </div>
                <div>
                  <p className="text-white text-sm font-semibold">{s.title}</p>
                  <p className="text-[#888] text-xs">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white/5 border border-white/10 rounded-2xl p-5 mb-8">
          <h2 className="text-lg font-bold mb-3">Why Sell to Top Cash Cellular?</h2>
          <ul className="space-y-2 text-sm text-[#ccc]">
            <li className="flex items-start gap-2"><span className="text-[#00c853]">✓</span> We pay more than Apple/Samsung trade-in</li>
            <li className="flex items-start gap-2"><span className="text-[#00c853]">✓</span> Same-day payout — no waiting</li>
            <li className="flex items-start gap-2"><span className="text-[#00c853]">✓</span> We buy any condition — even cracked</li>
            <li className="flex items-start gap-2"><span className="text-[#00c853]">✓</span> Local Austin meetup or free shipping</li>
            <li className="flex items-start gap-2"><span className="text-[#00c853]">✓</span> Cash, Venmo, Zelle, or PayPal</li>
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

        <Link href="/" className="block w-full bg-[#00c853] text-white py-4 rounded-2xl text-base font-bold text-center hover:bg-[#00e676] transition mb-4">
          Sell My {device.name}
        </Link>

        <p className="text-center text-[#555] text-xs">
          Or call us: <a href="tel:+18775492056" className="text-[#00c853] hover:underline">(877) 549-2056</a>
        </p>
      </section>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Offer",
            "name": `Sell ${device.name}`,
            "description": `Sell your ${device.name} for up to $${device.price} in Austin TX. Same-day payout.`,
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
