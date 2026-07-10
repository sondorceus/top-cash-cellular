"use client";

import { useRef, useState } from "react";

// Swipeable photo carousel for one listing. Native scroll-snap does the
// heavy lifting: swipe on touch, trackpad-scroll on desktop, arrows and
// thumbnails drive scrollTo. Plain <img>: photos are remote Blob URLs and
// next/image has no remotePatterns configured.
export default function Gallery({ images, alt, sold }: { images: string[]; alt: string; sold: boolean }) {
  const scroller = useRef<HTMLDivElement>(null);
  const [idx, setIdx] = useState(0);

  if (images.length === 0) {
    return (
      <div className="aspect-square bg-white/[0.03] border border-white/10 rounded-2xl flex items-center justify-center text-[#555] font-semibold">
        {alt}
      </div>
    );
  }

  const onScroll = () => {
    const el = scroller.current;
    if (!el || el.clientWidth === 0) return;
    const i = Math.round(el.scrollLeft / el.clientWidth);
    if (i !== idx) setIdx(Math.max(0, Math.min(images.length - 1, i)));
  };

  const go = (i: number) => {
    const el = scroller.current;
    if (!el) return;
    el.scrollTo({ left: i * el.clientWidth, behavior: "smooth" });
  };

  const many = images.length > 1;

  return (
    <div>
      <div className="relative aspect-square bg-white/[0.03] border border-white/10 rounded-2xl overflow-hidden">
        <div
          ref={scroller}
          onScroll={onScroll}
          className="h-full w-full flex overflow-x-auto snap-x snap-mandatory [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          style={{ overscrollBehaviorX: "contain" }}
        >
          {images.map((src, i) => (
            <div key={src} className="h-full w-full flex-shrink-0 snap-center flex items-center justify-center p-8">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={src}
                alt={many ? `${alt} — photo ${i + 1} of ${images.length}` : alt}
                loading={i === 0 ? "eager" : "lazy"}
                draggable={false}
                className={`max-h-full max-w-full object-contain ${sold ? "grayscale" : ""}`}
                style={{ filter: "drop-shadow(0 18px 22px rgba(0,0,0,0.55))" }}
              />
            </div>
          ))}
        </div>

        {many && (
          <>
            <button
              type="button"
              onClick={() => go(Math.max(0, idx - 1))}
              aria-label="Previous photo"
              disabled={idx === 0}
              className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/50 backdrop-blur border border-white/15 flex items-center justify-center text-white hover:border-[#00c853]/60 transition disabled:opacity-0"
            >
              <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M15 19l-7-7 7-7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <button
              type="button"
              onClick={() => go(Math.min(images.length - 1, idx + 1))}
              aria-label="Next photo"
              disabled={idx === images.length - 1}
              className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/50 backdrop-blur border border-white/15 flex items-center justify-center text-white hover:border-[#00c853]/60 transition disabled:opacity-0"
            >
              <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M9 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>

            <span className="absolute top-3 right-3 px-2.5 py-1 rounded-full text-[11px] font-bold bg-black/60 backdrop-blur border border-white/15 text-[#dcdcdc] tabular-nums">
              {idx + 1} / {images.length}
            </span>

            <div className="absolute bottom-3 inset-x-0 flex justify-center gap-1.5">
              {images.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => go(i)}
                  aria-label={`Go to photo ${i + 1}`}
                  className={`h-1.5 rounded-full transition-all duration-200 ${
                    i === idx ? "w-5 bg-[#00c853]" : "w-1.5 bg-white/30 hover:bg-white/60"
                  }`}
                />
              ))}
            </div>
          </>
        )}

        {sold && (
          <span className="absolute inset-x-0 bottom-0 bg-black/70 backdrop-blur text-center py-2.5 text-sm font-extrabold tracking-[0.3em] text-[#ff6b6b]">
            SOLD
          </span>
        )}
      </div>

      {many && (
        <div className="hidden sm:flex gap-2 mt-3">
          {images.map((src, i) => (
            <button
              key={src}
              onClick={() => go(i)}
              aria-label={`Photo ${i + 1}`}
              className={`w-16 h-16 rounded-xl bg-white/[0.03] border p-1.5 transition ${
                i === idx ? "border-[#00c853]" : "border-white/10 hover:border-white/30"
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt="" className="w-full h-full object-contain" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
