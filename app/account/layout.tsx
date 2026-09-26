import type { Metadata } from "next";

// /account is a client component: without this layout it inherited the
// root metadata (homepage title, `robots: index, follow`). It is a signed-in
// customer's own trades — never something to index. 2026-09-25.
export const metadata: Metadata = {
  title: "My Account | Top Cash Cellular",
  robots: { index: false, follow: false },
};

export default function AccountLayout({ children }: { children: React.ReactNode }) {
  return children;
}
