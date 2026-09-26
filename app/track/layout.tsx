import type { Metadata } from "next";

// /track is a client component: without this layout it inherited the root
// metadata (homepage title, `robots: index, follow`). A tracking view is
// one customer's shipment — never something to index. 2026-09-25.
export const metadata: Metadata = {
  title: "Track Your Trade-In | Top Cash Cellular",
  robots: { index: false, follow: false },
};

export default function TrackLayout({ children }: { children: React.ReactNode }) {
  return children;
}
