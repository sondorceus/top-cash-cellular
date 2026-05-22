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
}: {
  src?: string | null;
  alt: string;
  className?: string;
  loading?: "lazy" | "eager";
  style?: CSSProperties;
  size?: number;
}) {
  if (!src) return null;
  return (
    <Image
      src={src}
      alt={alt}
      width={size}
      height={size}
      loading={loading}
      className={className}
      style={style}
    />
  );
}
