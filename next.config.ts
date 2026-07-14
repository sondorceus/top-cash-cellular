import type { NextConfig } from "next";
import { PRICE_TABLE, CARRIER_DEDUCTIONS, carrierGapForCondition } from "./app/data/prices";
import { validatePriceInvariants } from "./app/lib/price-invariants";

// PRICE-LOGIC BUILD GATE (owner 2026-07-14: logic mismatches "shouldn't
// even be allowed to happen — it should give error code every time").
// Runs on every `next build` / `next dev` start: if the bundled tables
// would ever quote a better condition below a worse one (or bigger storage
// below smaller), the build THROWS and the deploy fails — a broken
// prices.ts physically cannot reach production. Admin blob overrides are
// gated the same way at save time in /api/admin/prices.
{
  const violations = validatePriceInvariants(PRICE_TABLE, CARRIER_DEDUCTIONS, carrierGapForCondition);
  if (violations.length > 0) {
    const list = violations.slice(0, 10).map((v) => `  - ${v.message}`).join("\n");
    throw new Error(
      `PRICE INVARIANT VIOLATIONS (${violations.length}) — refusing to build.\n${list}\n` +
      (violations.length > 10 ? `  …and ${violations.length - 10} more.\n` : "") +
      `Fix app/data/prices.ts (run: node scripts/check-monotonic.mjs)`,
    );
  }
}

const nextConfig: NextConfig = {
  images: {
    formats: ["image/avif", "image/webp"],
    dangerouslyAllowSVG: true,
    contentDispositionType: "attachment",
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
      {
        source: "/api/:path*",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "https://topcashcellular.com" },
          { key: "Access-Control-Allow-Methods", value: "GET, POST, OPTIONS" },
          { key: "Access-Control-Allow-Headers", value: "Content-Type" },
        ],
      },
    ];
  },
};

export default nextConfig;
