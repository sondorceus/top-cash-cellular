"use client";

import { useState } from "react";

// Photo gallery for one listing. Plain <img>: photos are remote Blob URLs and
// next/image has no remotePatterns configured (stock /devices/* paths ride
// along the same way). First image eager — it's the LCP element.
export default function Gallery({ images, alt, sold }: { images: string[]; alt: string; sold: boolean }) {
  const [idx, setIdx] = useState(0);

  if (images.length === 0) {
    return (
      <div className="aspect-square bg-white/[0.03] border border-white/10 rounded-2xl flex items-center justify-center text-[#555] font-semibold">
        {alt}
      </div>
    );
  }

  return (
    <div>
      <div className="relative aspect-square bg-white/[0.03] border border-white/10 rounded-2xl flex items-center justify-center p-8 overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          key={images[idx]}
          src={images[idx]}
          alt={alt}
          className={`max-h-full max-w-full object-contain ${sold ? "grayscale" : ""}`}
          style={{ filter: "drop-shadow(0 18px 22px rgba(0,0,0,0.55))" }}
        />
        {sold && (
          <span className="absolute inset-x-0 bottom-0 bg-black/70 backdrop-blur text-center py-2.5 text-sm font-extrabold tracking-[0.3em] text-[#ff6b6b]">
            SOLD
          </span>
        )}
      </div>
      {images.length > 1 && (
        <div className="flex gap-2 mt-3">
          {images.map((src, i) => (
            <button
              key={src}
              onClick={() => setIdx(i)}
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
