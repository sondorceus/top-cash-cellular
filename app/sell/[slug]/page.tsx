import type { Metadata } from "next";
import Link from "next/link";
import { SlideOnScrollNav } from "../../components/SlideOnScrollNav";
import { HeaderSearch } from "../../components/HeaderSearch";

const DEVICES = [
  // ── iPhone (synced from main catalog 2026-05-11) ──
  { slug: "iphone-17-pro-max", name: "iPhone 17 Pro Max", category: "iPhone", price: 767, year: 2025 },
  { slug: "iphone-17-pro", name: "iPhone 17 Pro", category: "iPhone", price: 726, year: 2025 },
  { slug: "iphone-17-air", name: "iPhone 17 Air", category: "iPhone", price: 620, year: 2025 },
  { slug: "iphone-17", name: "iPhone 17", category: "iPhone", price: 581, year: 2025 },
  { slug: "iphone-17e", name: "iPhone 17E", category: "iPhone", price: 352, year: 2025 },
  { slug: "iphone-16-pro-max", name: "iPhone 16 Pro Max", category: "iPhone", price: 543, year: 2024 },
  { slug: "iphone-16-pro", name: "iPhone 16 Pro", category: "iPhone", price: 514, year: 2024 },
  { slug: "iphone-16-plus", name: "iPhone 16 Plus", category: "iPhone", price: 413, year: 2024 },
  { slug: "iphone-16", name: "iPhone 16", category: "iPhone", price: 393, year: 2024 },
  { slug: "iphone-16e", name: "iPhone 16E", category: "iPhone", price: 233, year: 2024 },
  { slug: "iphone-15-pro-max", name: "iPhone 15 Pro Max", category: "iPhone", price: 382, year: 2023 },
  { slug: "iphone-15-pro", name: "iPhone 15 Pro", category: "iPhone", price: 386, year: 2023 },
  { slug: "iphone-15-plus", name: "iPhone 15 Plus", category: "iPhone", price: 319, year: 2023 },
  { slug: "iphone-15", name: "iPhone 15", category: "iPhone", price: 284, year: 2023 },
  { slug: "iphone-14-pro-max", name: "iPhone 14 Pro Max", category: "iPhone", price: 358, year: 2022 },
  { slug: "iphone-14-pro", name: "iPhone 14 Pro", category: "iPhone", price: 296, year: 2022 },
  { slug: "iphone-14-plus", name: "iPhone 14 Plus", category: "iPhone", price: 126, year: 2022 },
  { slug: "iphone-14", name: "iPhone 14", category: "iPhone", price: 230, year: 2022 },
  { slug: "iphone-13-pro-max", name: "iPhone 13 Pro Max", category: "iPhone", price: 284, year: 2021 },
  { slug: "iphone-13-pro", name: "iPhone 13 Pro", category: "iPhone", price: 245, year: 2021 },
  { slug: "iphone-13", name: "iPhone 13", category: "iPhone", price: 167, year: 2021 },
  { slug: "iphone-12-pro-max", name: "iPhone 12 Pro Max", category: "iPhone", price: 198, year: 2020 },
  { slug: "iphone-12-pro", name: "iPhone 12 Pro", category: "iPhone", price: 126, year: 2020 },
  { slug: "iphone-12", name: "iPhone 12", category: "iPhone", price: 147, year: 2020 },
  { slug: "iphone-12-mini", name: "iPhone 12 Mini", category: "iPhone", price: 72, year: 2020 },
  { slug: "iphone-11-pro-max", name: "iPhone 11 Pro Max", category: "iPhone", price: 192, year: 2019 },
  { slug: "iphone-11-pro", name: "iPhone 11 Pro", category: "iPhone", price: 114, year: 2019 },
  { slug: "iphone-11", name: "iPhone 11", category: "iPhone", price: 120, year: 2019 },

  // ── Samsung Galaxy S Series ──
  { slug: "galaxy-s26-ultra", name: "Galaxy S26 Ultra", category: "Samsung", price: 469, year: 2026 },
  { slug: "galaxy-s25-ultra", name: "Galaxy S25 Ultra", category: "Samsung", price: 414, year: 2025 },
  { slug: "galaxy-s24-ultra", name: "Galaxy S24 Ultra", category: "Samsung", price: 334, year: 2024 },
  { slug: "galaxy-s23-ultra", name: "Galaxy S23 Ultra", category: "Samsung", price: 209, year: 2023 },
  { slug: "galaxy-s22-ultra", name: "Galaxy S22 Ultra", category: "Samsung", price: 106, year: 2022 },
  { slug: "galaxy-s21-ultra", name: "Galaxy S21 Ultra", category: "Samsung", price: 118, year: 2021 },
  { slug: "galaxy-s20-ultra", name: "Galaxy S20 Ultra", category: "Samsung", price: 111, year: 2020 },
  { slug: "galaxy-s25-edge", name: "Galaxy S25 Edge", category: "Samsung", price: 270, year: 2025 },
  { slug: "galaxy-s26-plus", name: "Galaxy S26+", category: "Samsung", price: 389, year: 2026 },
  { slug: "galaxy-s25-plus", name: "Galaxy S25+", category: "Samsung", price: 330, year: 2025 },
  { slug: "galaxy-s24-plus", name: "Galaxy S24+", category: "Samsung", price: 212, year: 2024 },
  { slug: "galaxy-s23-plus", name: "Galaxy S23+", category: "Samsung", price: 150, year: 2023 },
  { slug: "galaxy-s22-plus", name: "Galaxy S22+", category: "Samsung", price: 96, year: 2022 },
  { slug: "galaxy-s21-plus", name: "Galaxy S21+", category: "Samsung", price: 64, year: 2021 },
  { slug: "galaxy-s20-plus", name: "Galaxy S20+", category: "Samsung", price: 78, year: 2020 },
  { slug: "galaxy-s26", name: "Galaxy S26", category: "Samsung", price: 342, year: 2026 },
  { slug: "galaxy-s25", name: "Galaxy S25", category: "Samsung", price: 237, year: 2025 },
  { slug: "galaxy-s24", name: "Galaxy S24", category: "Samsung", price: 193, year: 2024 },
  { slug: "galaxy-s23", name: "Galaxy S23", category: "Samsung", price: 111, year: 2023 },
  { slug: "galaxy-s22", name: "Galaxy S22", category: "Samsung", price: 72, year: 2022 },
  { slug: "galaxy-s21", name: "Galaxy S21", category: "Samsung", price: 52, year: 2021 },
  { slug: "galaxy-s20", name: "Galaxy S20", category: "Samsung", price: 67, year: 2020 },
  { slug: "galaxy-s25-fe", name: "Galaxy S25 FE", category: "Samsung", price: 213, year: 2025 },
  { slug: "galaxy-s24-fe", name: "Galaxy S24 FE", category: "Samsung", price: 137, year: 2024 },
  { slug: "galaxy-s23-fe", name: "Galaxy S23 FE", category: "Samsung", price: 79, year: 2023 },
  { slug: "galaxy-s21-fe", name: "Galaxy S21 FE", category: "Samsung", price: 39, year: 2021 },
  { slug: "galaxy-s20-fe", name: "Galaxy S20 FE", category: "Samsung", price: 48, year: 2020 },

  // ── Samsung Galaxy Z Series ──
  { slug: "galaxy-z-trifold", name: "Galaxy Z TriFold", category: "Samsung", price: 1317, year: 2025 },
  { slug: "galaxy-z-fold-7", name: "Galaxy Z Fold 7", category: "Samsung", price: 526, year: 2025 },
  { slug: "galaxy-z-fold-6", name: "Galaxy Z Fold 6", category: "Samsung", price: 334, year: 2024 },
  { slug: "galaxy-z-fold-5", name: "Galaxy Z Fold 5", category: "Samsung", price: 228, year: 2023 },
  { slug: "galaxy-z-fold-4", name: "Galaxy Z Fold 4", category: "Samsung", price: 157, year: 2022 },
  { slug: "galaxy-z-fold-3", name: "Galaxy Z Fold 3", category: "Samsung", price: 111, year: 2021 },
  { slug: "galaxy-z-flip-7", name: "Galaxy Z Flip 7", category: "Samsung", price: 320, year: 2025 },
  { slug: "galaxy-z-flip-6", name: "Galaxy Z Flip 6", category: "Samsung", price: 201, year: 2024 },
  { slug: "galaxy-z-flip-5", name: "Galaxy Z Flip 5", category: "Samsung", price: 150, year: 2023 },
  { slug: "galaxy-z-flip-4", name: "Galaxy Z Flip 4", category: "Samsung", price: 32, year: 2022 },
  { slug: "galaxy-z-flip-3", name: "Galaxy Z Flip 3", category: "Samsung", price: 39, year: 2021 },

  // ── Samsung Galaxy Note Series ──
  { slug: "galaxy-note-20-ultra-5g", name: "Galaxy Note 20 Ultra 5G", category: "Samsung", price: 126, year: 2020 },
  { slug: "galaxy-note-20-5g", name: "Galaxy Note 20 5G", category: "Samsung", price: 98, year: 2020 },
  { slug: "galaxy-note-10-plus-5g", name: "Galaxy Note 10+ 5G", category: "Samsung", price: 104, year: 2019 },
  { slug: "galaxy-note-10-plus", name: "Galaxy Note 10+", category: "Samsung", price: 101, year: 2019 },
  { slug: "galaxy-note-10", name: "Galaxy Note 10", category: "Samsung", price: 72, year: 2019 },
  { slug: "galaxy-note-9", name: "Galaxy Note 9", category: "Samsung", price: 60, year: 2018 },

  // ── Google Pixel Pro Series ──
  { slug: "pixel-10-pro-xl", name: "Pixel 10 Pro XL", category: "Pixel", price: 561, year: 2025 },
  { slug: "pixel-10-pro", name: "Pixel 10 Pro", category: "Pixel", price: 466, year: 2025 },
  { slug: "pixel-9-pro-xl", name: "Pixel 9 Pro XL", category: "Pixel", price: 397, year: 2024 },
  { slug: "pixel-9-pro", name: "Pixel 9 Pro", category: "Pixel", price: 323, year: 2024 },
  { slug: "pixel-8-pro", name: "Pixel 8 Pro", category: "Pixel", price: 254, year: 2023 },
  { slug: "pixel-7-pro", name: "Pixel 7 Pro", category: "Pixel", price: 90, year: 2022 },
  { slug: "pixel-6-pro", name: "Pixel 6 Pro", category: "Pixel", price: 53, year: 2021 },

  // ── Google Pixel Standard / a-series ──
  { slug: "pixel-10", name: "Pixel 10", category: "Pixel", price: 344, year: 2025 },
  { slug: "pixel-10a", name: "Pixel 10a", category: "Pixel", price: 154, year: 2025 },
  { slug: "pixel-9", name: "Pixel 9", category: "Pixel", price: 196, year: 2024 },
  { slug: "pixel-9a", name: "Pixel 9a", category: "Pixel", price: 143, year: 2024 },
  { slug: "pixel-8", name: "Pixel 8", category: "Pixel", price: 127, year: 2023 },
  { slug: "pixel-8a", name: "Pixel 8a", category: "Pixel", price: 95, year: 2023 },
  { slug: "pixel-7", name: "Pixel 7", category: "Pixel", price: 48, year: 2022 },
  { slug: "pixel-7a", name: "Pixel 7a", category: "Pixel", price: 11, year: 2022 },
  { slug: "pixel-6", name: "Pixel 6", category: "Pixel", price: 42, year: 2021 },
  { slug: "pixel-5", name: "Pixel 5", category: "Pixel", price: 53, year: 2020 },
  { slug: "pixel-5a-5g", name: "Pixel 5a (5G)", category: "Pixel", price: 32, year: 2021 },

  // ── Google Pixel Fold Series ──
  { slug: "pixel-10-pro-fold", name: "Pixel 10 Pro Fold", category: "Pixel", price: 800, year: 2025 },
  { slug: "pixel-9-pro-fold", name: "Pixel 9 Pro Fold", category: "Pixel", price: 609, year: 2024 },
  { slug: "pixel-fold", name: "Pixel Fold", category: "Pixel", price: 297, year: 2023 },

  // ── MacBook Pro ──
  { slug: "macbook-pro-16-m5-pro-max-2026", name: "MacBook Pro 16\" M5 Pro/Max (2026)", category: "MacBook", price: 1737, year: 2026 },
  { slug: "macbook-pro-14-m5-pro-max-2026", name: "MacBook Pro 14\" M5 Pro/Max (2026)", category: "MacBook", price: 1334, year: 2026 },
  { slug: "macbook-pro-14-m5-2025", name: "MacBook Pro 14\" M5 (2025)", category: "MacBook", price: 1043, year: 2025 },
  { slug: "macbook-pro-16-m4-2024", name: "MacBook Pro 16\" M4 (2024)", category: "MacBook", price: 1456, year: 2024 },
  { slug: "macbook-pro-14-m4-2024", name: "MacBook Pro 14\" M4 (2024)", category: "MacBook", price: 768, year: 2024 },
  { slug: "macbook-pro-16-m3-2023", name: "MacBook Pro 16\" M3 (2023)", category: "MacBook", price: 847, year: 2023 },
  { slug: "macbook-pro-14-m3-2023", name: "MacBook Pro 14\" M3 (2023)", category: "MacBook", price: 635, year: 2023 },
  { slug: "macbook-pro-16-m2-2023", name: "MacBook Pro 16\" M2 (2023)", category: "MacBook", price: 604, year: 2023 },
  { slug: "macbook-pro-14-m2-2023", name: "MacBook Pro 14\" M2 (2023)", category: "MacBook", price: 445, year: 2023 },
  { slug: "macbook-pro-13-m1-2020", name: "MacBook Pro 13\" M1 (2020)", category: "MacBook", price: 180, year: 2020 },

  // ── MacBook Air ──
  { slug: "macbook-air-m5-2026", name: "MacBook Air M5 (13\" & 15\", 2026)", category: "MacBook", price: 662, year: 2026 },
  { slug: "macbook-air-m4-2025", name: "MacBook Air M4 (13\" & 15\", 2025)", category: "MacBook", price: 498, year: 2025 },
  { slug: "macbook-air-15-m3-2024", name: "MacBook Air 15\" M3 (2024)", category: "MacBook", price: 540, year: 2024 },
  { slug: "macbook-air-13-m3-2024", name: "MacBook Air 13\" M3 (2024)", category: "MacBook", price: 365, year: 2024 },
  { slug: "macbook-air-15-m2-2023", name: "MacBook Air 15\" M2 (2023)", category: "MacBook", price: 328, year: 2023 },
  { slug: "macbook-air-13-m2-2022", name: "MacBook Air 13\" M2 (2022)", category: "MacBook", price: 297, year: 2022 },
  { slug: "macbook-air-13-m1-2020", name: "MacBook Air 13\" M1 (2020)", category: "MacBook", price: 212, year: 2020 },

  // ── Dell Laptops ──
  { slug: "dell-xps-17-2024", name: "Dell XPS 17 (2024)", category: "Dell", price: 750, year: 2024 },
  { slug: "dell-xps-15-2024", name: "Dell XPS 15 (2024)", category: "Dell", price: 620, year: 2024 },
  { slug: "dell-xps-13-2024", name: "Dell XPS 13 (2024)", category: "Dell", price: 480, year: 2024 },
  { slug: "dell-xps-15-2023", name: "Dell XPS 15 (2023)", category: "Dell", price: 500, year: 2023 },
  { slug: "dell-xps-13-2023", name: "Dell XPS 13 (2023)", category: "Dell", price: 380, year: 2023 },
  { slug: "dell-latitude-7440", name: "Dell Latitude 7440", category: "Dell", price: 420, year: 2023 },
  { slug: "dell-latitude-5540", name: "Dell Latitude 5540", category: "Dell", price: 300, year: 2023 },
  { slug: "dell-inspiron-16-plus", name: "Dell Inspiron 16 Plus", category: "Dell", price: 350, year: 2023 },
  { slug: "dell-inspiron-15", name: "Dell Inspiron 15", category: "Dell", price: 220, year: 2023 },
  { slug: "dell-inspiron-14", name: "Dell Inspiron 14", category: "Dell", price: 200, year: 2023 },

  // ── iPad ──
  { slug: "ipad-pro-13-m5", name: "iPad Pro 13\" M5", category: "iPad", price: 610, year: 2025 },
  { slug: "ipad-pro-11-m5", name: "iPad Pro 11\" M5", category: "iPad", price: 475, year: 2025 },
  { slug: "ipad-pro-13-m4", name: "iPad Pro 13\" M4", category: "iPad", price: 500, year: 2024 },
  { slug: "ipad-pro-11-m4", name: "iPad Pro 11\" M4", category: "iPad", price: 350, year: 2024 },
  { slug: "ipad-pro-12-9-6th-gen", name: "iPad Pro 12.9\" 6th Gen", category: "iPad", price: 270, year: 2022 },
  { slug: "ipad-pro-11-4th-gen", name: "iPad Pro 11\" 4th Gen", category: "iPad", price: 225, year: 2022 },
  { slug: "ipad-air-13-m3", name: "iPad Air 13\" M3", category: "iPad", price: 360, year: 2025 },
  { slug: "ipad-air-11-m3", name: "iPad Air 11\" M3", category: "iPad", price: 275, year: 2025 },
  { slug: "ipad-air-13-m2", name: "iPad Air 13\" M2", category: "iPad", price: 275, year: 2024 },
  { slug: "ipad-air-11-m2", name: "iPad Air 11\" M2", category: "iPad", price: 200, year: 2024 },
  { slug: "ipad-mini-7th-gen", name: "iPad Mini 7th Gen", category: "iPad", price: 225, year: 2024 },
  { slug: "ipad-mini-6th-gen", name: "iPad Mini 6th Gen", category: "iPad", price: 150, year: 2021 },
  { slug: "ipad-10th-gen", name: "iPad 10th Gen", category: "iPad", price: 150, year: 2022 },
  { slug: "ipad-9th-gen", name: "iPad 9th Gen", category: "iPad", price: 100, year: 2021 },

  // ── Consoles ──
  { slug: "playstation-5-pro", name: "PlayStation 5 Pro", category: "Console", price: 450, year: 2024 },
  { slug: "playstation-5-slim", name: "PlayStation 5 Slim", category: "Console", price: 225, year: 2023 },
  { slug: "playstation-5", name: "PlayStation 5", category: "Console", price: 238, year: 2020 },
  { slug: "playstation-4-pro", name: "PlayStation 4 Pro", category: "Console", price: 150, year: 2016 },
  { slug: "playstation-4", name: "PlayStation 4", category: "Console", price: 100, year: 2013 },
  { slug: "xbox-series-x", name: "Xbox Series X", category: "Console", price: 180, year: 2020 },
  { slug: "xbox-series-s", name: "Xbox Series S", category: "Console", price: 80, year: 2020 },
  { slug: "xbox-one", name: "Xbox One", category: "Console", price: 80, year: 2013 },
  { slug: "nintendo-switch-oled", name: "Nintendo Switch OLED", category: "Console", price: 180, year: 2021 },
  { slug: "nintendo-switch-v2", name: "Nintendo Switch V2", category: "Console", price: 130, year: 2019 },
  { slug: "nintendo-switch-lite", name: "Nintendo Switch Lite", category: "Console", price: 90, year: 2019 },

  // ── Apple Watch ──
  { slug: "apple-watch-ultra-3", name: "Apple Watch Ultra 3", category: "Watch", price: 302, year: 2025 },
  { slug: "apple-watch-ultra-2", name: "Apple Watch Ultra 2", category: "Watch", price: 450, year: 2023 },
  { slug: "apple-watch-ultra", name: "Apple Watch Ultra", category: "Watch", price: 350, year: 2022 },
  { slug: "apple-watch-series-10", name: "Apple Watch Series 10", category: "Watch", price: 280, year: 2024 },
  { slug: "apple-watch-series-9", name: "Apple Watch Series 9", category: "Watch", price: 220, year: 2023 },
  { slug: "apple-watch-series-8", name: "Apple Watch Series 8", category: "Watch", price: 170, year: 2022 },
  { slug: "apple-watch-series-7", name: "Apple Watch Series 7", category: "Watch", price: 120, year: 2021 },
  { slug: "apple-watch-se-2nd-gen", name: "Apple Watch SE (2nd Gen)", category: "Watch", price: 130, year: 2022 },
  { slug: "apple-watch-se-1st-gen", name: "Apple Watch SE (1st Gen)", category: "Watch", price: 80, year: 2020 },

  // ── Samsung Watch ──
  { slug: "galaxy-watch-ultra", name: "Galaxy Watch Ultra", category: "Watch", price: 350, year: 2024 },
  { slug: "galaxy-watch-7", name: "Galaxy Watch 7", category: "Watch", price: 150, year: 2024 },

  // ── Pixel Watch ──
  { slug: "pixel-watch-3", name: "Pixel Watch 3", category: "Watch", price: 200, year: 2024 },
  { slug: "pixel-watch-2", name: "Pixel Watch 2", category: "Watch", price: 130, year: 2023 },
  { slug: "pixel-watch", name: "Pixel Watch", category: "Watch", price: 80, year: 2022 },

  // ── Alienware Desktops ──
  { slug: "alienware-aurora-r16", name: "Alienware Aurora R16", category: "Desktop", price: 800, year: 2023 },
  { slug: "alienware-aurora-r15", name: "Alienware Aurora R15", category: "Desktop", price: 600, year: 2022 },
  { slug: "alienware-aurora-r13", name: "Alienware Aurora R13", category: "Desktop", price: 450, year: 2022 },

  // ── MSI Desktops ──
  { slug: "msi-meg-trident-x2", name: "MSI MEG Trident X2", category: "Desktop", price: 900, year: 2023 },
  { slug: "msi-mag-trident-s5", name: "MSI MAG Trident S5", category: "Desktop", price: 550, year: 2023 },
  { slug: "msi-mag-codex-6", name: "MSI MAG Codex 6", category: "Desktop", price: 650, year: 2023 },
  { slug: "msi-mag-codex-5", name: "MSI MAG Codex 5", category: "Desktop", price: 450, year: 2022 },
  { slug: "msi-pro-dp180", name: "MSI PRO DP180", category: "Desktop", price: 300, year: 2023 },
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
    description: `Sell your ${device.name} for up to $${device.price} in Austin TX. Instant quote, same-day payout. Cash, Cash App, Zelle, or BTC. We pay more than Apple trade-in.`,
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
            <Link href="/" className="bg-[#00c853] text-[#0a0a0a] px-4 py-2 rounded-full text-xs font-semibold hover:bg-[#00e676] transition whitespace-nowrap">
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

        <Link href="/" className="block w-full bg-[#00c853] text-[#0a0a0a] py-5 rounded-2xl text-xl font-bold text-center hover:bg-[#00e676] transition shadow-lg shadow-[#00c853]/20 mb-8">
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
            <p className="text-white text-lg font-bold">4.9★</p>
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
            <li className="flex items-start gap-2"><span className="text-[#00c853]">✓</span> We pay more than Apple/Samsung trade-in</li>
            <li className="flex items-start gap-2"><span className="text-[#00c853]">✓</span> Same-day payout — no waiting</li>
            <li className="flex items-start gap-2"><span className="text-[#00c853]">✓</span> We buy any condition — even cracked</li>
            <li className="flex items-start gap-2"><span className="text-[#00c853]">✓</span> Local Austin meetup or free shipping</li>
            <li className="flex items-start gap-2"><span className="text-[#00c853]">✓</span> Cash, Cash App, Zelle, or BTC</li>
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

        <Link href="/" className="block w-full bg-[#00c853] text-[#0a0a0a] py-4 rounded-2xl text-base font-bold text-center hover:bg-[#00e676] transition mb-4">
          Sell My {device.name}
        </Link>

        <p className="text-center text-[#555] text-xs">
          Or email us: <a href="mailto:topcashcellular@gmail.com" className="text-[#00c853] hover:underline">topcashcellular@gmail.com</a>
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
