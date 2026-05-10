import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Review submitted — Top Cash Cellular",
  robots: { index: false, follow: false },
};

export default function ReviewThankYou() {
  return (
    <main className="min-h-screen bg-[#0a0a0a] text-white flex items-center justify-center">
      <div className="max-w-lg mx-auto px-4 text-center">
        <div className="w-20 h-20 rounded-full bg-[#00c853]/10 flex items-center justify-center mx-auto mb-6">
          <span className="text-4xl">★</span>
        </div>
        <h1 className="text-3xl font-bold mb-3">Thanks for the review!</h1>
        <p className="text-[#888] text-lg mb-6">
          You just helped the next Austin seller make a confident decision. We appreciate you.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/reviews"
            className="inline-block bg-[#00c853] text-black px-6 py-3 rounded-full font-semibold hover:bg-[#00e676] transition"
          >
            Read all reviews
          </Link>
          <Link
            href="/"
            className="inline-block bg-white/5 border border-white/10 text-white px-6 py-3 rounded-full font-semibold hover:bg-white/10 transition"
          >
            Back to home
          </Link>
        </div>
      </div>
    </main>
  );
}
