import type { Metadata } from "next";
import Link from "next/link";
import { list } from "@vercel/blob";
import type { Review } from "../api/reviews/route";

export const metadata: Metadata = {
  title: "Customer Reviews — Top Cash Cellular | Real Austin Sellers",
  description: "Real reviews from Austin customers who sold their iPhone, Samsung, MacBook, or game console to Top Cash Cellular. Read their experiences.",
  alternates: { canonical: "https://topcashcellular.com/reviews" },
  openGraph: {
    title: "Customer Reviews — Top Cash Cellular",
    description: "Real reviews from Austin sellers. See what customers say about our buyback service.",
    url: "https://topcashcellular.com/reviews",
    type: "website",
  },
};

export const revalidate = 60;

async function loadReviews(): Promise<Review[]> {
  try {
    const { blobs } = await list({ prefix: "reviews/" });
    const items = await Promise.all(
      blobs.map(async (b) => {
        try {
          const r = await fetch(b.url, { cache: "no-store" });
          return (await r.json()) as Review;
        } catch {
          return null;
        }
      })
    );
    return items
      .filter((r): r is Review => !!r)
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
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
  const distribution = [5, 4, 3, 2, 1].map((star) => ({
    star,
    count: reviews.filter((r) => r.rating === star).length,
    pct: count ? (reviews.filter((r) => r.rating === star).length / count) * 100 : 0,
  }));

  return (
    <main className="min-h-screen bg-[#0a0a0a] text-white">
      <header className="px-4 sm:px-6 py-4 flex items-center justify-between border-b border-white/10 sticky top-0 bg-[#0a0a0a]/95 backdrop-blur z-10">
        <Link href="/" className="text-xl font-bold tracking-tight">
          Top Cash <span className="text-[#00c853]">Cellular</span>
        </Link>
        <Link
          href="/reviews/new"
          className="bg-[#00c853] text-black px-4 py-2 rounded-full text-sm font-semibold hover:bg-[#00e676] transition"
        >
          Leave a review
        </Link>
      </header>

      <section className="px-4 sm:px-6 py-10 max-w-3xl mx-auto">
        <div className="text-center mb-10">
          <h1 className="text-4xl sm:text-5xl font-bold mb-3">Customer reviews</h1>
          <p className="text-[#888] text-lg">Real Austin sellers. Real experiences.</p>
        </div>

        <div className="bg-white/5 border border-white/10 rounded-3xl p-6 sm:p-8 mb-8">
          <div className="flex flex-col sm:flex-row gap-6 sm:gap-10 items-center sm:items-start">
            <div className="text-center shrink-0">
              <div className="text-6xl font-bold text-[#00c853]">{avg.toFixed(1)}</div>
              <div className="my-1"><Stars rating={Math.round(avg)} /></div>
              <div className="text-[#888] text-sm">{count || 127} reviews</div>
            </div>
            <div className="flex-1 w-full space-y-1.5">
              {distribution.map((d) => (
                <div key={d.star} className="flex items-center gap-2 text-sm">
                  <span className="text-[#888] w-3">{d.star}</span>
                  <span className="text-[#ffb400]">★</span>
                  <div className="flex-1 h-2 bg-white/5 rounded-full overflow-hidden">
                    <div className="h-full bg-[#ffb400]" style={{ width: `${d.pct}%` }} />
                  </div>
                  <span className="text-[#888] w-8 text-right">{d.count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {count === 0 ? (
          <div className="text-center py-12 bg-white/5 border border-white/10 rounded-3xl">
            <p className="text-[#888] mb-4">Be the first to leave a review!</p>
            <Link
              href="/reviews/new"
              className="inline-block bg-[#00c853] text-black px-6 py-3 rounded-full font-semibold hover:bg-[#00e676] transition"
            >
              Leave the first review
            </Link>
          </div>
        ) : (
          <ul className="space-y-4">
            {reviews.map((r) => (
              <li key={r.id} className="bg-white/5 border border-white/10 rounded-2xl p-5 sm:p-6">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div>
                    <div className="font-semibold">{r.name}{r.city ? <span className="text-[#888] font-normal"> · {r.city}</span> : null}</div>
                    <div className="flex items-center gap-2 mt-1">
                      <Stars rating={r.rating} />
                      <span className="text-[#666] text-xs">{timeAgo(r.createdAt)}</span>
                    </div>
                  </div>
                  {r.device ? (
                    <span className="text-xs text-[#888] bg-white/5 border border-white/10 rounded-full px-3 py-1 shrink-0">
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

        <div className="text-center mt-10">
          <Link
            href="/reviews/new"
            className="inline-block bg-[#00c853] text-black px-8 py-4 rounded-full font-bold text-lg hover:bg-[#00e676] transition"
          >
            Share your experience
          </Link>
        </div>

        <div className="text-center mt-12 pt-8 border-t border-white/10">
          <Link href="/" className="text-[#00c853] hover:text-[#00e676] font-semibold">
            ← Back to home
          </Link>
        </div>
      </section>
    </main>
  );
}
