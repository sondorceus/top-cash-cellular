"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { SlideOnScrollNav } from "../../components/SlideOnScrollNav";
import { HeaderSearch } from "../../components/HeaderSearch";

type GateState =
  | { kind: "loading" }
  | { kind: "invalid"; reason: string }
  | { kind: "valid"; token: string; leadName: string; leadDevice: string };

function NewReviewInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [gate, setGate] = useState<GateState>({ kind: "loading" });
  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [device, setDevice] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Strict gate — Skywalker 2026-05-18 "BE STRICT. Random people can't
  // see the review page. Even if customer checkout, if not marked paid,
  // can't review." Page refuses to render the form unless ?token=… is
  // present AND verifies server-side (token exists in MC + not expired
  // + not previously used + bound lead is in paid/met status).
  useEffect(() => {
    const token = searchParams.get("token");
    if (!token) {
      setGate({ kind: "invalid", reason: "This page is for verified customers." });
      return;
    }
    let alive = true;
    fetch(`/api/reviews/verify-token?token=${encodeURIComponent(token)}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (!alive) return;
        if (d.valid) {
          setGate({
            kind: "valid",
            token,
            leadName: d.name || searchParams.get("name") || "",
            leadDevice: d.device || searchParams.get("device") || "",
          });
          // Lock the prefilled values from the trade record so the
          // submitted review attributes match the actual seller.
          if (d.name) setName(d.name);
          else if (searchParams.get("name")) setName(searchParams.get("name")!);
          if (d.device) setDevice(d.device);
          else if (searchParams.get("device")) setDevice(searchParams.get("device")!);
        } else {
          setGate({ kind: "invalid", reason: d.error || "This review link isn't valid." });
        }
      })
      .catch(() => setGate({ kind: "invalid", reason: "Couldn't verify your review link. Try the email link again." }));
    return () => { alive = false; };
  }, [searchParams]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (gate.kind !== "valid") return;
    setError(null);
    if (!name.trim()) return setError("Please enter your name.");
    if (!rating) return setError("Please pick a star rating.");
    if (body.trim().length < 10) return setError("Please share a bit more about your experience.");
    setSubmitting(true);
    try {
      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: gate.token, name, city, rating, title, body, device }),
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
      <SlideOnScrollNav className="px-4 sm:px-6 py-4 flex items-center justify-between border-b border-white/10 sticky top-0 bg-[#0a0a0a]/95 backdrop-blur z-10">
        <Link href="/" className="text-xl font-bold tracking-tight">
          Top Cash <span className="text-[#00c853]">Cellular</span>
        </Link>
        <div className="flex items-center gap-3">
          <HeaderSearch className="flex w-40 sm:w-56 md:w-64" />
          <Link href="/reviews" className="text-sm text-[#dcdcdc] hover:text-white transition whitespace-nowrap">
            ← Reviews
          </Link>
        </div>
      </SlideOnScrollNav>

      {gate.kind === "loading" && (
        <section className="px-4 sm:px-6 py-16 max-w-xl mx-auto text-center">
          <p className="text-[#dcdcdc] text-sm">Verifying your review link…</p>
        </section>
      )}

      {gate.kind === "invalid" && (
        <section className="px-4 sm:px-6 py-12 max-w-xl mx-auto">
          <div className="bg-white/5 border border-white/10 rounded-3xl p-8 text-center">
            <p className="text-5xl mb-3">🔒</p>
            <h1 className="text-2xl sm:text-3xl font-bold mb-2">Reviews are for verified customers</h1>
            <p className="text-[#dcdcdc] mb-6 leading-relaxed">
              {gate.reason} We only accept reviews from customers we&apos;ve completed a trade with — it keeps the reviews real for the people coming after you.
            </p>
            <div className="bg-white/[0.04] border border-white/10 rounded-xl p-5 text-left text-sm leading-relaxed text-[#dcdcdc] mb-6">
              <p className="text-white font-semibold mb-2">If you&apos;ve sold a device to us:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Check the confirmation email we sent when your payout went out</li>
                <li>Tap the <span className="text-[#ffb400] font-semibold">★ Leave a review</span> button in that email</li>
                <li>The link includes your one-use review code</li>
              </ul>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link href="/reviews" className="bg-white/[0.06] border border-white/10 text-white px-6 py-3 rounded-full text-sm font-semibold hover:bg-white/[0.1] transition">
                Read existing reviews →
              </Link>
              <a href="mailto:CustomerService@topcashcells.com?subject=Need%20my%20review%20link" className="bg-[#00c853] text-black px-6 py-3 rounded-full text-sm font-bold hover:bg-[#00e676] transition">
                ✉️ Email us — we&apos;ll send your link
              </a>
            </div>
          </div>
        </section>
      )}

      {gate.kind === "valid" && (
        <section className="px-4 sm:px-6 py-8 sm:py-12 max-w-xl mx-auto">
          <div className="inline-flex items-center gap-2 bg-[#00c853]/15 border border-[#00c853]/40 text-[#7be8a8] rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wider mb-3">
            ✓ Verified seller link
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold mb-2">Leave a review</h1>
          <p className="text-[#dcdcdc] mb-8">
            Thanks for trading {gate.leadDevice ? <span className="text-white font-semibold">{gate.leadDevice}</span> : "with us"} — tell us how it went. Your review goes live the moment you submit.
          </p>

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
              <label className="block text-sm font-semibold mb-2">City <span className="text-[#c5c5c5] font-normal">(optional)</span></label>
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
              <label className="block text-sm font-semibold mb-2">Device you sold <span className="text-[#c5c5c5] font-normal">(optional)</span></label>
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
              <label className="block text-sm font-semibold mb-2">Title <span className="text-[#c5c5c5] font-normal">(optional)</span></label>
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
              <div className="text-right text-xs text-[#c5c5c5] mt-1">{body.length}/1000</div>
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

            <p className="text-[11px] text-[#888] text-center leading-relaxed">
              Single-use review link — once you submit, this link won&apos;t work again. We&apos;ll send a fresh one if you trade with us again.
            </p>
          </form>
        </section>
      )}
    </main>
  );
}

export default function NewReviewPage() {
  // Suspense boundary required by Next 15 around useSearchParams so the
  // page can still pre-render statically; the params hydrate on the client.
  return (
    <Suspense fallback={<main className="min-h-screen bg-[#0a0a0a]" />}>
      <NewReviewInner />
    </Suspense>
  );
}
