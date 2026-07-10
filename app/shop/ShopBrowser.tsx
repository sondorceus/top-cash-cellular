"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { ShopListingPublic } from "../lib/shop-listings";
import { GRADE_LABEL, LISTING_GRADES, type ListingGrade } from "../lib/shop-grades";

// Client half of the shop grids: sort + grade filter + the listing cards.
// Category navigation happens ABOVE this component (tiles + header bar), so
// the browser itself never filters by category — it renders what the server
// page hands it. Keeps one grid implementation for /shop and /shop/c/[slug].

const GRADE_STYLE: Record<string, { text: string; border: string; bg: string }> = {
  excellent: { text: "text-[#00c853]", border: "border-[#00c853]/40", bg: "bg-[#00c853]/10" },
  good: { text: "text-[#88dd66]", border: "border-[#88dd66]/40", bg: "bg-[#88dd66]/10" },
  fair: { text: "text-[#ffb400]", border: "border-[#ffb400]/40", bg: "bg-[#ffb400]/10" },
};

type Sort = "new" | "price-asc" | "price-desc";

export function price(cents: number): string {
  const d = cents / 100;
  return Number.isInteger(d) ? `$${d}` : `$${d.toFixed(2)}`;
}

function GradeChip({ grade }: { grade: string }) {
  const s = GRADE_STYLE[grade] ?? GRADE_STYLE.good;
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold border ${s.text} ${s.border} ${s.bg}`}>
      {GRADE_LABEL[grade as keyof typeof GRADE_LABEL] ?? grade}
    </span>
  );
}

export function ListingCard({ l }: { l: ShopListingPublic }) {
  const img = l.photos[0] || l.stockImage || null;
  const subline = [l.storage, l.color, l.carrier].filter(Boolean).join(" · ");
  const inactive = l.status !== "listed";

  return (
    <Link
      href={`/shop/${l.id}`}
      className={`group relative bg-white/5 border border-white/10 rounded-2xl overflow-hidden transition duration-200 hover:-translate-y-1 hover:border-[#00c853]/45 hover:bg-white/[0.07] ${
        inactive ? "opacity-70" : ""
      }`}
    >
      <div className="relative aspect-square bg-white/[0.03] flex items-center justify-center p-6">
        {img ? (
          // Plain <img>: listing photos are remote Blob URLs and next/image
          // has no remotePatterns configured. Stock images ride along fine.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={img}
            alt={l.modelLabel}
            loading="lazy"
            className={`max-h-full max-w-full object-contain transition duration-300 group-hover:scale-[1.04] ${
              l.status === "sold" ? "grayscale" : ""
            }`}
            style={{ filter: "drop-shadow(0 14px 18px rgba(0,0,0,0.5))" }}
          />
        ) : (
          <div className="text-[#555] text-sm font-semibold text-center px-3">{l.modelLabel}</div>
        )}
        <div className="absolute top-3 left-3">
          <GradeChip grade={l.grade} />
        </div>
        {l.batteryPct ? (
          <span className="absolute top-3 right-3 inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-bold bg-black/60 border border-white/15 text-[#dcdcdc]">
            <svg viewBox="0 0 24 24" className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="2" y="7" width="17" height="10" rx="2" />
              <line x1="22" y1="10.5" x2="22" y2="13.5" strokeLinecap="round" />
            </svg>
            {l.batteryPct}%
          </span>
        ) : null}
        {l.status === "sold" && (
          <span className="absolute inset-x-0 bottom-0 bg-black/70 backdrop-blur text-center py-2 text-xs font-extrabold tracking-[0.25em] text-[#ff6b6b]">
            SOLD
          </span>
        )}
        {l.status === "on_hold" && (
          <span className="absolute inset-x-0 bottom-0 bg-black/70 backdrop-blur text-center py-2 text-xs font-extrabold tracking-[0.25em] text-[#ffb400]">
            ON HOLD
          </span>
        )}
      </div>
      <div className="p-4">
        <div className="font-bold leading-tight">{l.modelLabel}</div>
        {subline && <div className="text-xs text-[#9a9a9a] mt-1">{subline}</div>}
        <div className="mt-3 flex items-end justify-between">
          <div className="text-xl font-extrabold text-white">{price(l.priceCents)}</div>
          {!inactive && (
            <span className="text-[11px] font-bold text-[#00c853] opacity-0 group-hover:opacity-100 transition">
              View →
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

export default function ShopBrowser({
  listings,
  emptyState,
}: {
  listings: ShopListingPublic[];
  /** Rendered when no ACTIVE listings survive the filters (sold wall still shows). */
  emptyState?: React.ReactNode;
}) {
  const [sort, setSort] = useState<Sort>("new");
  const [grades, setGrades] = useState<Set<ListingGrade>>(new Set());

  const toggleGrade = (g: ListingGrade) => {
    setGrades((prev) => {
      const next = new Set(prev);
      if (next.has(g)) next.delete(g);
      else next.add(g);
      return next;
    });
  };

  const active = useMemo(() => {
    let xs = listings.filter((l) => l.status !== "sold");
    if (grades.size) xs = xs.filter((l) => grades.has(l.grade));
    if (sort === "price-asc") xs = [...xs].sort((a, b) => a.priceCents - b.priceCents);
    else if (sort === "price-desc") xs = [...xs].sort((a, b) => b.priceCents - a.priceCents);
    // "new" keeps the server's newest-first order
    return xs;
  }, [listings, grades, sort]);

  const sold = listings.filter((l) => l.status === "sold").slice(0, 8);
  const anyActive = listings.some((l) => l.status !== "sold");

  return (
    <>
      {anyActive && (
        <div className="flex flex-wrap items-center gap-2 mb-6">
          {LISTING_GRADES.map((g) => (
            <button
              key={g}
              onClick={() => toggleGrade(g)}
              className={`px-3.5 py-1.5 rounded-full text-[13px] font-semibold border transition ${
                grades.has(g)
                  ? "bg-[#00c853] text-[#0a0a0a] border-[#00c853]"
                  : "bg-white/5 text-[#dcdcdc] border-white/10 hover:border-white/25"
              }`}
            >
              {GRADE_LABEL[g]}
            </button>
          ))}
          <div className="ml-auto">
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as Sort)}
              aria-label="Sort listings"
              className="bg-white/5 border border-white/15 rounded-full px-4 py-1.5 text-[13px] font-semibold text-[#dcdcdc] focus:outline-none focus:border-[#00c853]/60 [&>option]:bg-[#0a0a0a]"
            >
              <option value="new">Newest first</option>
              <option value="price-asc">Price: low to high</option>
              <option value="price-desc">Price: high to low</option>
            </select>
          </div>
        </div>
      )}

      {active.length === 0 ? (
        anyActive ? (
          <p className="text-[#9a9a9a] py-8">Nothing matches those filters — clear a grade and look again.</p>
        ) : (
          emptyState ?? null
        )
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {active.map((l) => (
            <ListingCard key={l.id} l={l} />
          ))}
        </div>
      )}

      {sold.length > 0 && (
        <div className="mt-14">
          <h2 className="text-lg font-bold text-[#9a9a9a] mb-4">Recently sold</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {sold.map((l) => (
              <ListingCard key={l.id} l={l} />
            ))}
          </div>
        </div>
      )}
    </>
  );
}
