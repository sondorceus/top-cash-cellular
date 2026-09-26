import type { Metadata } from "next";

// /reviews/thank-you carries the customer's $25 coupon code in its URL; the
// page is a client component and inherited the root metadata (homepage
// title, `robots: index, follow`). Not for search results. 2026-09-25.
export const metadata: Metadata = {
  title: "Thanks for Your Review | Top Cash Cellular",
  robots: { index: false, follow: false },
};

export default function ReviewThankYouLayout({ children }: { children: React.ReactNode }) {
  return children;
}
