// SHOP KILL SWITCH. Sonny 2026-09-12: "hide the shop feature it's not ready
// yet." Off by default, so the storefront ships dark: no nav or footer entry,
// no /shop route (404, not a redirect — nothing for Google to index), no
// public feed, no reservations. /admin/shop stays open so listings can be
// loaded and previewed behind the admin login.
//
// To turn it on: set NEXT_PUBLIC_SHOP_ENABLED=1 in Vercel prod and redeploy
// (NEXT_PUBLIC_ values are inlined at build time, so a redeploy is required),
// then re-add the /shop URLs to public/sitemap.xml.
export const SHOP_ENABLED = process.env.NEXT_PUBLIC_SHOP_ENABLED === "1";
