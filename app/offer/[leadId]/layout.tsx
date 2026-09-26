import type { Metadata } from "next";

// /offer/[leadId] is a client component, so it cannot export metadata
// itself — it inherited the root metadata: the homepage <title> in the tab
// and, worse, `robots: index, follow`. An offer page shows the customer's
// name, e-mail and payout method, and its link gets shared (the page has a
// Share button) and texted, so a crawler that ever reaches one could index
// a customer's trade. noindex here keeps every offer out of search results
// while leaving the URL itself working. 2026-09-25.
export const metadata: Metadata = {
  title: "Your Offer | Top Cash Cellular",
  robots: { index: false, follow: false },
};

export default function OfferLayout({ children }: { children: React.ReactNode }) {
  return children;
}
