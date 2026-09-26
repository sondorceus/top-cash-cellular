// The one formatter for a listing price, wherever it shows: the grid card
// (ShopBrowser), the product page, and the share card (the OG/Twitter title
// in the product page's generateMetadata). Whole dollars drop the cents
// ("$250"); anything else keeps two ("$249.99").
//
// It lives here and not in ShopBrowser.tsx because that file is "use client":
// a server component may render a component imported from it, but calling a
// plain function exported from behind that boundary is a runtime error. The
// share card kept its own toFixed(0) copy for that reason, and unfurled as
// "$250" for a unit the page sold at $249.99 (2026-09-25).
export function price(cents: number): string {
  const d = cents / 100;
  return Number.isInteger(d) ? `$${d}` : `$${d.toFixed(2)}`;
}
