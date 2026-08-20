import type { Metadata } from "next";

// /bulk is a client component, so it cannot export metadata itself — without
// this layout it inherited the root metadata and (before 2026-08-20) a
// canonical pointing at the homepage, which told Google to fold the page
// into "/" while the sitemap was still submitting it for indexing.
// Copy here restates claims the page already makes; nothing new is promised.
export const metadata: Metadata = {
  title: "Bulk Device Buyback — Sell 5+ Phones or Laptops for Cash | Austin TX",
  description:
    "Selling 5 or more devices? Send your list and get a real number back — one payment for the whole batch, with volume bonus pricing. Offices, schools, repair shops and resellers, Austin TX and nationwide by mail.",
  alternates: { canonical: "/bulk" },
  openGraph: {
    title: "Bulk Device Buyback — Sell 5+ Devices for Cash",
    description: "Send your list, get a real number back. One payment for the whole batch, volume bonus pricing.",
    type: "website",
    url: "https://topcashcellular.com/bulk",
  },
};

export default function BulkLayout({ children }: { children: React.ReactNode }) {
  return children;
}
