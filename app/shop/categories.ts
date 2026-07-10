// Shop category system. Customer-facing buckets over the sell-catalog
// category strings that listings carry (listing.category comes from the
// admin cockpit's DEVICES match — "iPhone", "Samsung", "Dell", …).
//
// Deliberately fewer buckets than the catalog has: a one-of-one store with
// dozens (not thousands) of units needs categories broad enough that none
// looks embarrassingly empty. Dell and anything unrecognized fold into
// "More devices" rather than earning a bare tile of their own.
//
// Images are stock renders that already ship in /public/devices — same art
// the buyback funnel uses, so the two sides of the site stay one family.

export type ShopCategory = {
  slug: string; // /shop/c/[slug]
  label: string; // tile + nav text
  title: string; // SEO h1/title on the category page
  blurb: string; // category page subhead
  image: string; // representative stock render
  cats: string[]; // listing.category values that belong here
};

export const SHOP_CATEGORIES: ShopCategory[] = [
  {
    slug: "iphone",
    label: "iPhone",
    title: "Used iPhones — tested in Austin",
    blurb: "Unlocked and carrier iPhones, each one tested, photographed and battery-checked by us.",
    image: "/devices/bm/iphone-16-pro.png",
    cats: ["iPhone"],
  },
  {
    slug: "samsung",
    label: "Samsung",
    title: "Used Samsung Galaxy phones — tested in Austin",
    blurb: "Galaxy S and Z series, tested and graded in person. What you see is the exact phone you get.",
    image: "/devices/gs25u.webp",
    cats: ["Samsung"],
  },
  {
    slug: "pixel",
    label: "Pixel",
    title: "Used Google Pixel phones — tested in Austin",
    blurb: "Clean Pixels with honest grades and real battery numbers, straight from our bench.",
    image: "/devices/pixel-9-pro.webp",
    cats: ["Pixel"],
  },
  {
    slug: "ipad",
    label: "iPad",
    title: "Used iPads — tested in Austin",
    blurb: "iPad, Air and Pro — tested, wiped and ready. Every listing is the exact tablet photographed.",
    image: "/devices/ipad-pro-13-m4.webp",
    cats: ["iPad"],
  },
  {
    slug: "macbook",
    label: "MacBook",
    title: "Used MacBooks — tested in Austin",
    blurb: "MacBook Air and Pro, checked keyboard to battery. One of each — when it's gone, it's gone.",
    image: "/devices/macbook-pro-m4.webp",
    cats: ["MacBook"],
  },
  {
    slug: "watch",
    label: "Watches",
    title: "Used smartwatches — tested in Austin",
    blurb: "Apple Watch and more, tested on-wrist and graded honestly.",
    image: "/devices/apple-watch-series-10.webp",
    cats: ["Watch"],
  },
  {
    slug: "console",
    label: "Consoles",
    title: "Used game consoles — tested in Austin",
    blurb: "PlayStation, Xbox and Switch — tested with a controller in hand, not just powered on.",
    image: "/devices/ps5.webp",
    cats: ["Console"],
  },
  {
    slug: "more",
    label: "More devices",
    title: "More tested devices — Austin",
    blurb: "Desktops, PC laptops and everything else that cleared our bench.",
    image: "/devices/imac-24-m4.webp",
    cats: [], // catch-all — resolved by exclusion in categoryForListing()
  },
];

const NAMED = new Set(SHOP_CATEGORIES.flatMap((c) => c.cats));

export function findCategory(slug: string): ShopCategory | null {
  return SHOP_CATEGORIES.find((c) => c.slug === slug) ?? null;
}

/** Which bucket a listing's raw category string lands in. */
export function categoryForListing(rawCategory: string): ShopCategory {
  const named = SHOP_CATEGORIES.find((c) => c.cats.includes(rawCategory));
  if (named) return named;
  return SHOP_CATEGORIES[SHOP_CATEGORIES.length - 1]; // "more"
}

/** True when a listing belongs on this category's page. */
export function listingInCategory(rawCategory: string, cat: ShopCategory): boolean {
  if (cat.cats.length > 0) return cat.cats.includes(rawCategory);
  return !NAMED.has(rawCategory); // "more" = everything unnamed
}
