import Image from "next/image";
import type { CSSProperties } from "react";

// Drop-in replacement for <img> on local catalog images. Renders next/image
// so the optimizer resizes to the displayed size and serves AVIF/WebP instead
// of the raw 200-800KB device PNGs. Device photos are square, so a square
// intrinsic size is correct; actual render size stays controlled by className.
export default function Pic({
  src,
  alt,
  className,
  loading = "lazy",
  style,
  size = 256,
  sizes,
  priority,
}: {
  src?: string | null;
  alt: string;
  className?: string;
  loading?: "lazy" | "eager";
  style?: CSSProperties;
  size?: number;
  // When set, next/image picks the srcset variant from `sizes` (CSS px the
  // image actually occupies) instead of the `size` prop. Two <Pic>s sharing
  // the SAME `sizes` resolve to the SAME optimized URL on a given device —
  // that's what lets the hidden catalog warmer pre-fetch the exact variant
  // the device hero later renders, so the hero pops from cache, no lag.
  sizes?: string;
  // priority sets loading=eager + fetchpriority=high + a <link rel=preload>.
  priority?: boolean;
}) {
  if (!src) return null;
  return (
    <Image
      src={src}
      alt={alt}
      width={size}
      height={size}
      loading={priority ? undefined : loading}
      priority={priority}
      sizes={sizes}
      className={className}
      style={style}
    />
  );
}
