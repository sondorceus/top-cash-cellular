"use client";

import { useEffect, useRef, useState, type ImgHTMLAttributes } from "react";

// Plain <img> (listing photos are remote Blob URLs and next/image has no
// remotePatterns configured) that swaps to `fallback` when `src` won't load.
// A listing photo URL can die — before 2026-09-16 the 24h customer-photo
// purge deleted every shop photo — and a dead one should show the model's
// stock image, not a broken-image icon. The effect catches an error that
// fired before hydration attached onError.
type Props = Omit<ImgHTMLAttributes<HTMLImageElement>, "src"> & { src: string; fallback?: string | null };

export default function ShopImg({ src, fallback, alt = "", ...rest }: Props) {
  const ref = useRef<HTMLImageElement>(null);
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const useFallback = failedSrc === src && !!fallback && fallback !== src;

  useEffect(() => {
    const el = ref.current;
    if (!fallback || !el || !el.complete || el.naturalWidth > 0) return;
    // complete + no pixels is either "already failed" or, in some browsers,
    // a lazy image that hasn't been fetched yet. Only a real load error may
    // swap a real photo for the stock one, so confirm with a probe.
    let live = true;
    const probe = new Image();
    probe.onerror = () => {
      if (live) setFailedSrc(src);
    };
    probe.src = src;
    return () => {
      live = false;
    };
  }, [src, fallback]);

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      ref={ref}
      {...rest}
      alt={alt}
      src={useFallback && fallback ? fallback : src}
      onError={() => {
        if (!useFallback) setFailedSrc(src);
      }}
    />
  );
}
