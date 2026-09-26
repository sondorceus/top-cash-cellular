import type { Metadata } from "next";

// /reviews/new is reached only through a single-use token link in the
// customer's e-mail; the page is a client component and inherited the root
// metadata (homepage title, `robots: index, follow`). Tokenized pages are
// not for search results. 2026-09-25.
export const metadata: Metadata = {
  title: "Write a Review | Top Cash Cellular",
  robots: { index: false, follow: false },
};

export default function NewReviewLayout({ children }: { children: React.ReactNode }) {
  return children;
}
