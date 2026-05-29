import type { Metadata } from "next";
import Link from "next/link";
import type { Review } from "../api/reviews/route";
import { SlideOnScrollNav } from "../components/SlideOnScrollNav";
import { HeaderSearch } from "../components/HeaderSearch";
import SiteFooter from "../components/SiteFooter";

const MC_API = "https://missioncontrolsdjg-production.up.railway.app";
const MC_KEY = process.env.MC_API_KEY || "";

export const metadata: Metadata = {
  title: "Customer Reviews — Top Cash Cellular | Real Austin Sellers",
  description: "Real reviews from Austin customers who sold their iPhone, Samsung, MacBook, or game console to Top Cash Cellular. Read their experiences.",
  alternates: { canonical: "https://topcashcellular.com/reviews" },
  openGraph: {
    title: "Customer Reviews — Top Cash Cellular",
    description: "Real reviews from real sellers. See what customers say about our buyback service.",
    url: "https://topcashcellular.com/reviews",
    type: "website",
  },
};

export const revalidate = 60;

async function loadReviews(): Promise<Review[]> {
  try {
    const r = await fetch(`${MC_API}/api/reviews?limit=200`, {
      headers: { "x-api-key": MC_KEY },
      next: { revalidate: 60 },
    });
    if (!r.ok) return [];
    const data = await r.json();
    return (data.reviews || []) as Review[];
  } catch {
    return [];
  }
}

function Stars({ rating }: { rating: number }) {
  return (
    <span className="text-[#ffb400] text-lg leading-none" aria-label={`${rating} out of 5 stars`}>
      {"★".repeat(rating)}<span className="text-[#333]">{"★".repeat(5 - rating)}</span>
    </span>
  );
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins || 1}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

export default async function ReviewsPage() {
  const reviews = await loadReviews();
  const count = reviews.length;
  const avg = count ? reviews.reduce((s, r) => s + r.rating, 0) / count : 4.9;

  return (
    <main className="min-h-screen flex flex-col bg-[#0a0a0a] text-white">
      <SlideOnScrollNav className="px-4 sm:px-6 py-4 flex items-center justify-between border-b border-white/10 sticky top-0 bg-[#0a0a0a]/95 backdrop-blur z-10">
        <Link href="/" className="text-xl font-bold tracking-tight">
          Top Cash <span className="text-[#00c853]">Cellular</span>
        </Link>
        <div className="flex items-center gap-3">
          <HeaderSearch className="flex w-40 sm:w-56 md:w-64" />
        </div>
      </SlideOnScrollNav>

      <section className="px-4 sm:px-6 py-10 max-w-3xl mx-auto">
        <div className="text-center mb-10">
          <h1 className="text-4xl sm:text-5xl font-bold mb-3">Customer reviews</h1>
          <p className="text-[#dcdcdc] text-lg">Real sellers. Real experiences.</p>
        </div>

        <div className="bg-white/5 border border-white/10 rounded-3xl p-6 sm:p-8 mb-8 text-center">
          {count > 0 ? (
            <>
              <div className="text-6xl font-bold text-[#00c853]">{avg.toFixed(1)}</div>
              <div className="my-1 flex justify-center"><Stars rating={Math.round(avg)} /></div>
              <div className="text-[#dcdcdc] text-sm">{count} review{count === 1 ? "" : "s"}</div>
            </>
          ) : (
            <>
              <svg className="w-10 h-10 text-[#00c853] mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.196-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" /></svg>
              <p className="text-white font-bold text-base mb-1">No reviews yet — be our first</p>
              <p className="text-[#bdbdbd] text-sm">Sold to us recently? Drop a 30-second note to help the next person trust us.</p>
            </>
          )}
        </div>

        {count === 0 ? null : (
          <ul className="space-y-4">
            {reviews.map((r) => (
              <li key={r.id} className="bg-white/5 border border-white/10 rounded-2xl p-5 sm:p-6">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold">{r.name}{r.city ? <span className="text-[#dcdcdc] font-normal"> · {r.city}</span> : null}</span>
                      {r.verified ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-wider text-[#7be8a8] bg-[#00c853]/12 border border-[#00c853]/40 rounded-full px-2 py-0.5" title="Verified seller — review submitted via a one-use link after their trade closed">
                          <svg className="w-3 h-3 text-[#00c853]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> Verified
                        </span>
                      ) : null}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <Stars rating={r.rating} />
                      <span className="text-[#c5c5c5] text-xs">{timeAgo(r.createdAt)}</span>
                    </div>
                  </div>
                  {r.device ? (
                    <span className="text-xs text-[#dcdcdc] bg-white/5 border border-white/10 rounded-full px-3 py-1 shrink-0">
                      Sold: {r.device}
                    </span>
                  ) : null}
                </div>
                {r.title ? <h3 className="font-semibold text-lg mb-1">{r.title}</h3> : null}
                <p className="text-[#ddd] leading-relaxed whitespace-pre-wrap">{r.body}</p>
              </li>
            ))}
          </ul>
        )}

        <div className="text-center mt-10 px-6 py-6 bg-white/[0.04] border border-white/10 rounded-2xl max-w-lg mx-auto">
          <p className="text-[#7be8a8] text-[10px] font-bold uppercase tracking-[0.18em] mb-2 flex items-center justify-center gap-1.5"><svg className="w-4 h-4 text-[#00c853]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> Verified customers only</p>
          <p className="text-white font-semibold text-base mb-2">Reviews here are real</p>
          <p className="text-[#bdbdbd] text-sm leading-relaxed mb-3">We don&apos;t accept reviews from strangers off the internet. Every review on this page comes from a one-use link we email to the customer after we&apos;ve paid out their trade. It keeps reviews honest — for you, and for the next person reading.</p>
          <a href="mailto:support@topcashcellular.com?subject=Need%20my%20review%20link" className="inline-block text-[#dcdcdc] hover:text-[#00c853] text-xs underline">Sold to us and didn&apos;t get a link? Email us</a>
        </div>

        <div className="text-center mt-12 pt-8 border-t border-white/10">
          <Link href="/" className="text-[#00c853] hover:text-[#00e676] font-semibold">
            ← Back to home
          </Link>
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}
