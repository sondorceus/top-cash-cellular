"use client";

import { useMemo, useState, type ReactNode } from "react";

type FaqItem = { q: string; a: ReactNode; aText?: string };
type Category = { name: string; questions: string[] };

// Popular keyword chips — clicking one populates the search. Each maps to
// real wording in the FAQ so it always returns matches.
const KEYWORDS = ["Shipping", "Payment", "Insurance", "Broken", "Data", "Unlocked", "Tracking", "Coupon"];

function FaqEntry({ item }: { item: FaqItem }) {
  return (
    <details className="group bg-white/5 border border-white/10 rounded-2xl p-5 hover:bg-white/[0.07] transition open:bg-white/[0.07]">
      <summary className="flex items-center justify-between cursor-pointer list-none">
        <span className="font-semibold text-white pr-4">{item.q}</span>
        <span className="text-[#00c853] text-xl flex-shrink-0 group-open:rotate-45 transition-transform">+</span>
      </summary>
      <p className="text-[#e5e5e5] text-sm mt-3 leading-relaxed">{item.a}</p>
    </details>
  );
}

export default function FaqList({ faq, categories }: { faq: FaqItem[]; categories: Category[] }) {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();

  const results = useMemo(() => {
    if (!q) return null;
    return faq.filter((item) => {
      // aText is only set on rich (JSX) answers; string answers search their
      // own text. Fall back gracefully so search covers every entry.
      const answerText = item.aText ?? (typeof item.a === "string" ? item.a : "");
      return item.q.toLowerCase().includes(q) || answerText.toLowerCase().includes(q);
    });
  }, [q, faq]);

  return (
    <div>
      {/* Search */}
      <div className="relative mb-3">
        <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#888] pointer-events-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="7" /><path strokeLinecap="round" d="m20 20-3.5-3.5" />
        </svg>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search FAQs — shipping, payment, insurance…"
          aria-label="Search frequently asked questions"
          className="w-full pl-12 pr-10 py-3.5 bg-white/[0.06] border border-white/12 rounded-2xl text-white placeholder:text-[#888] focus:outline-none focus:border-[#00c853]/60 focus:bg-white/[0.08] transition"
        />
        {query && (
          <button onClick={() => setQuery("")} aria-label="Clear search" className="absolute right-3 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full flex items-center justify-center text-[#888] hover:text-white hover:bg-white/10 transition cursor-pointer">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        )}
      </div>

      {/* Keyword suggestion chips */}
      <div className="flex flex-wrap gap-2 mb-10">
        <span className="text-[11px] text-[#888] uppercase tracking-wider font-bold self-center mr-1">Popular</span>
        {KEYWORDS.map((k) => {
          const active = q === k.toLowerCase();
          return (
            <button
              key={k}
              onClick={() => setQuery(active ? "" : k)}
              className={`text-xs font-semibold px-3 py-1.5 rounded-full border transition cursor-pointer ${
                active
                  ? "bg-[#00c853]/15 text-[#00c853] border-[#00c853]/40"
                  : "bg-white/5 text-[#dcdcdc] border-white/10 hover:bg-white/10 hover:border-white/20"
              }`}
            >
              {k}
            </button>
          );
        })}
      </div>

      {/* Results */}
      {results !== null ? (
        results.length > 0 ? (
          <div>
            <p className="text-[#888] text-sm mb-3">{results.length} {results.length === 1 ? "result" : "results"} for &ldquo;{query.trim()}&rdquo;</p>
            <div className="space-y-3">
              {results.map((item, i) => <FaqEntry key={i} item={item} />)}
            </div>
          </div>
        ) : (
          <div className="bg-white/[0.04] border border-white/10 rounded-2xl p-6 text-center">
            <p className="text-white font-semibold mb-1">No FAQs matched &ldquo;{query.trim()}&rdquo;</p>
            <p className="text-[#e5e5e5] text-sm mb-4">Try a different keyword, or reach out and we&apos;ll answer it directly.</p>
            <a href="mailto:support@topcashcellular.com" className="inline-block bg-[#00c853] text-[#0a0a0a] px-5 py-2.5 rounded-full font-semibold text-sm hover:bg-[#00e676] transition">Get help →</a>
          </div>
        )
      ) : (
        <div className="space-y-10">
          {categories.map((cat) => (
            <div key={cat.name}>
              <h2 className="text-[#00c853] text-xs font-bold uppercase tracking-[0.18em] mb-3">{cat.name}</h2>
              <div className="space-y-3">
                {faq.filter((item) => cat.questions.includes(item.q)).map((item, i) => <FaqEntry key={i} item={item} />)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
