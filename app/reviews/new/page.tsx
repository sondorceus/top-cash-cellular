"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function NewReviewPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [device, setDevice] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!name.trim()) return setError("Please enter your name.");
    if (!rating) return setError("Please pick a star rating.");
    if (body.trim().length < 10) return setError("Please share a bit more about your experience.");
    setSubmitting(true);
    try {
      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, city, rating, title, body, device }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Something went wrong. Try again?");
        setSubmitting(false);
        return;
      }
      router.push("/reviews/thank-you");
    } catch {
      setError("Network error. Try again?");
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#0a0a0a] text-white">
      <header className="px-4 sm:px-6 py-4 flex items-center justify-between border-b border-white/10 sticky top-0 bg-[#0a0a0a]/95 backdrop-blur z-10">
        <Link href="/" className="text-xl font-bold tracking-tight">
          Top Cash <span className="text-[#00c853]">Cellular</span>
        </Link>
        <Link href="/reviews" className="text-sm text-[#888] hover:text-white transition">
          ← Reviews
        </Link>
      </header>

      <section className="px-4 sm:px-6 py-8 sm:py-12 max-w-xl mx-auto">
        <h1 className="text-3xl sm:text-4xl font-bold mb-2">Leave a review</h1>
        <p className="text-[#888] mb-8">Help other Austin sellers know what to expect.</p>

        <form onSubmit={onSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-semibold mb-2">Your rating *</label>
            <div className="flex gap-1.5" onMouseLeave={() => setHover(0)}>
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setRating(n)}
                  onMouseEnter={() => setHover(n)}
                  aria-label={`${n} star${n > 1 ? "s" : ""}`}
                  className="text-4xl leading-none transition-transform hover:scale-110 focus:outline-none"
                >
                  <span className={(hover || rating) >= n ? "text-[#ffb400]" : "text-[#333]"}>★</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold mb-2">Your name *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={60}
              placeholder="First name + last initial is fine"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-[#00c853] transition"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold mb-2">City <span className="text-[#666] font-normal">(optional)</span></label>
            <input
              type="text"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              maxLength={60}
              placeholder="Austin, TX"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-[#00c853] transition"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold mb-2">Device you sold <span className="text-[#666] font-normal">(optional)</span></label>
            <input
              type="text"
              value={device}
              onChange={(e) => setDevice(e.target.value)}
              maxLength={80}
              placeholder="iPhone 15 Pro Max, MacBook Pro 16, etc."
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-[#00c853] transition"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold mb-2">Title <span className="text-[#666] font-normal">(optional)</span></label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={100}
              placeholder="Fast, fair, easy"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-[#00c853] transition"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold mb-2">Your review *</label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              maxLength={1000}
              rows={5}
              placeholder="How was the process? Did you get a fair price? Would you sell again?"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-[#00c853] transition resize-none"
            />
            <div className="text-right text-xs text-[#666] mt-1">{body.length}/1000</div>
          </div>

          {error ? (
            <div className="bg-[#ff3b30]/10 border border-[#ff3b30]/30 text-[#ff6b60] rounded-xl px-4 py-3 text-sm">{error}</div>
          ) : null}

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-[#00c853] text-black py-4 rounded-full font-bold text-lg hover:bg-[#00e676] transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? "Submitting…" : "Submit review"}
          </button>
        </form>
      </section>
    </main>
  );
}
