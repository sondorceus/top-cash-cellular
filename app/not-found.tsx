import Link from "next/link";
import SiteFooter from "./components/SiteFooter";

// Catches every unmatched URL app-wide (Next.js root not-found convention).
// Before this, customers hitting a dead link got the unstyled default 404.
export default function NotFound() {
  return (
    <main className="min-h-screen flex flex-col bg-[#0a0a0a] text-white">
      <div className="flex-1 flex items-center justify-center px-4 py-24">
        <div className="text-center max-w-md">
          <p className="text-xs font-bold text-[#00c853] tracking-widest uppercase mb-3">404</p>
          <h1 className="text-4xl sm:text-5xl font-bold mb-3">Page not found</h1>
          <p className="text-[#dcdcdc] text-sm mb-8">
            That link doesn&apos;t go anywhere — the page may have moved or never existed.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/"
              className="inline-block bg-[#00c853] text-[#0a0a0a] px-6 py-3 rounded-full font-semibold hover:bg-[#00e676] transition"
            >
              Get an instant quote
            </Link>
            <Link
              href="/shop"
              className="inline-block border border-white/15 px-6 py-3 rounded-full font-semibold text-white hover:border-[#00c853]/45 transition"
            >
              Browse the shop
            </Link>
          </div>
          <p className="text-xs text-[#555] mt-8">
            Looking for something specific?{" "}
            <Link href="/faq" className="text-[#00c853] hover:underline">
              Check the FAQ
            </Link>
          </p>
        </div>
      </div>
      <SiteFooter />
    </main>
  );
}
