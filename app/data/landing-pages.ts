// =========================================================================
// AUSTIN SEO LANDING PAGES — intent/city config.
// =========================================================================
// Each entry renders through app/components/SellLandingPage.tsx at a real
// top-level route (e.g. /sell-iphone-austin). These target local Austin
// buy-intent and the locked/financed niche that carrier trade-in and the
// big buyback sites reject. Headline numbers come from the shared catalog
// (app/data/sell-catalog.ts) — never hardcode a price here.
// =========================================================================

export type LandingNotice = {
  tone: "info" | "warn";
  title: string;
  body: string;
};

export type LandingFaq = { q: string; a: string };

export type LandingConfig = {
  // Route segment AND canonical path (no leading slash).
  slug: string;
  metaTitle: string;
  metaDescription: string;

  // Hero
  h1: string;
  heroLine: string; // subhead under the H1
  intro: string; // one honest paragraph below the hero CTA
  // Whether to print the catalog "up to $X" hero number. Off for pages
  // (locked) where the headline max would overstate what that page's
  // devices actually fetch.
  showHeroPrice: boolean;
  heroPriceNote?: string;

  // Device price grid selection — resolved against the catalog.
  pickCategory?: string; // a category name, e.g. "iPhone"
  pickSlugs?: string[]; // explicit slugs (overrides category)
  gridLimit: number;
  gridHeading: string;
  gridSub: string;
  // Overrides the "How it works" step-1 line. Default assumes a phone
  // (model/storage/carrier/condition); set this for device classes that
  // don't have a carrier (MacBook, iPad).
  quotePickLine?: string;

  // Honest eligibility / how-it-works callout (locked, financed).
  notice?: LandingNotice;

  whyHeading: string;
  whyBullets: string[];

  faqHeading: string;
  faqs: LandingFaq[];
};

export const LANDING_PAGES: LandingConfig[] = [
  // ── Category × city pages ──────────────────────────────────────────────
  {
    slug: "sell-iphone-austin",
    metaTitle: "Sell Your iPhone for Cash in Austin TX | Top Cash Cellular",
    metaDescription:
      "Sell your iPhone for cash in Austin, TX. Instant online quote, same-day payout, local meetup or free shipping. Any model, any condition — even cracked or carrier-locked.",
    h1: "Sell Your iPhone for Cash in Austin",
    heroLine: "Instant quote. Same-day cash. Local meetup or free shipping.",
    intro:
      "Skip the Marketplace flakes and lowball trade-in credits. Get a real cash number for your iPhone in 30 seconds, then meet up locally in Austin or ship it free — your choice. We buy every model, any condition, including cracked and carrier-locked.",
    showHeroPrice: true,
    pickCategory: "iPhone",
    gridLimit: 9,
    gridHeading: "iPhone payouts",
    gridSub: "Tap your model for an exact quote. Storage, carrier, and condition set the final number.",
    whyHeading: "Why sell your iPhone to Top Cash Cellular?",
    whyBullets: [
      "Real cash — not store credit, gift cards, or carrier bill credits.",
      "Same-day payout on Austin local meetups; same-day after inspection on shipped trades.",
      "We buy any condition — cracked screens, bad batteries, carrier-locked.",
      "Cash, Cash App, Zelle, or Bitcoin.",
      "Local and accountable — a real Austin business, not a faceless mail-in site.",
    ],
    faqHeading: "Selling an iPhone in Austin — common questions",
    faqs: [
      {
        q: "How do I sell my iPhone for cash in Austin?",
        a: "Get an instant quote on our site, lock your price, then choose a local Austin meetup or a free prepaid shipping label. We inspect the device, confirm the quote, and pay you on the spot (meetup) or same-day after inspection (shipped).",
      },
      {
        q: "Do you buy cracked or broken iPhones?",
        a: "Yes. Select the matching condition when you quote and we'll give you a fair price for a cracked screen, bad battery, or other damage. We buy devices other shops turn away.",
      },
      {
        q: "How fast do I get paid?",
        a: "Local meetups are paid the same day, in person. Shipped devices are paid the same day we inspect them. Cash, Cash App, Zelle, or Bitcoin.",
      },
      {
        q: "What do I need to bring or do before selling?",
        a: "Back up your data, sign out of iCloud and turn off Find My iPhone, and factory-reset if you can. You must be 18+ and the legal owner of the device — you'll confirm that when you submit.",
      },
    ],
  },
  {
    slug: "sell-samsung-austin",
    metaTitle: "Sell Your Samsung Galaxy for Cash in Austin TX | Top Cash Cellular",
    metaDescription:
      "Sell your Samsung Galaxy phone for cash in Austin, TX. Instant quote, same-day payout, local meetup or free shipping. Galaxy S, Z Fold/Flip, and Note — any condition.",
    h1: "Sell Your Samsung Galaxy for Cash in Austin",
    heroLine: "Instant quote. Same-day cash. Local meetup or free shipping.",
    intro:
      "Galaxy S, Z Fold, Z Flip, or Note — get a real cash offer in 30 seconds and sell it locally in Austin or ship it free. We pay cash for any condition, including cracked and carrier-locked Samsungs.",
    showHeroPrice: true,
    pickCategory: "Samsung",
    gridLimit: 9,
    gridHeading: "Samsung Galaxy payouts",
    gridSub: "Tap your model for an exact quote. Storage, carrier, and condition set the final number.",
    whyHeading: "Why sell your Galaxy to Top Cash Cellular?",
    whyBullets: [
      "Real cash — not store credit or carrier bill credits.",
      "We buy folding phones (Z Fold / Z Flip) that many buyers won't touch.",
      "Same-day payout on Austin local meetups; same-day after inspection on shipped trades.",
      "Any condition — cracked, hinge wear, carrier-locked.",
      "Cash, Cash App, Zelle, or Bitcoin.",
    ],
    faqHeading: "Selling a Samsung in Austin — common questions",
    faqs: [
      {
        q: "Do you buy Galaxy Z Fold and Z Flip phones?",
        a: "Yes — we actively buy foldables, including older Z Fold and Z Flip models. Quote yours to see the current cash price.",
      },
      {
        q: "Do you buy cracked or carrier-locked Samsungs?",
        a: "Yes. Pick the matching condition and your carrier/lock status when you quote, and we'll price it honestly. Carrier-locked phones are quoted a bit below unlocked.",
      },
      {
        q: "How fast do I get paid?",
        a: "Same day at a local Austin meetup, or same day after we inspect a shipped device. Cash, Cash App, Zelle, or Bitcoin.",
      },
      {
        q: "What should I do before selling my Galaxy?",
        a: "Back up your data, remove your Google and Samsung accounts, and factory-reset if you can. You must be 18+ and the legal owner — you'll confirm that when you submit.",
      },
    ],
  },
  {
    slug: "sell-macbook-austin",
    metaTitle: "Sell Your MacBook for Cash in Austin TX | Top Cash Cellular",
    metaDescription:
      "Sell your MacBook Pro or MacBook Air for cash in Austin, TX. Instant quote, same-day payout, local meetup or free prepaid shipping. Any year, any condition.",
    h1: "Sell Your MacBook for Cash in Austin",
    heroLine: "Instant quote. Same-day cash. Local meetup or free prepaid shipping.",
    intro:
      "MacBook Pro or MacBook Air, M-series or Intel — get a real cash offer based on your exact chip, RAM, and storage, then meet up in Austin or ship it free. Our prepaid FedEx label includes $100 base coverage; for a high-value Mac, add declared value at FedEx or choose a local Austin meetup. No lowballs, no trade-in credit games.",
    showHeroPrice: true,
    pickCategory: "MacBook",
    gridLimit: 8,
    gridHeading: "MacBook payouts",
    gridSub: "Tap your model for an exact quote. Chip, RAM, storage, and condition set the final number.",
    quotePickLine: "Pick your model, chip, RAM, storage, and condition for an instant cash number.",
    whyHeading: "Why sell your MacBook to Top Cash Cellular?",
    whyBullets: [
      "Priced on your real specs — chip, RAM, and storage — not a flat guess.",
      "Real cash, not Apple Store credit toward your next purchase.",
      "Free prepaid shipping ($100 base coverage; add declared value for a high-value Mac), or a same-day local Austin meetup.",
      "We securely wipe every machine; ask for a data-destruction note if you need one.",
      "Cash, Cash App, Zelle, or Bitcoin.",
    ],
    faqHeading: "Selling a MacBook in Austin — common questions",
    faqs: [
      {
        q: "How is my MacBook's price decided?",
        a: "By the exact model, year, chip (M1/M2/M3/M4/M5 or Intel), RAM, storage, and condition. Quote yours and you'll pick those so the number is accurate.",
      },
      {
        q: "Is my data safe?",
        a: "Yes. Sign out of iCloud and erase the Mac before handoff if you can. We also securely wipe every machine we buy and can provide a data-destruction confirmation on request.",
      },
      {
        q: "Do you buy older or Intel MacBooks?",
        a: "Yes. Newer M-series Macs fetch the most, but we buy older and Intel MacBooks too. Some legacy models are quoted manually — we'll confirm the number with you.",
      },
      {
        q: "How does shipping work for a laptop?",
        a: "We send a free prepaid FedEx label that includes $100 of base coverage. For a high-value Mac, add declared value at FedEx for full protection, or choose an Austin local meetup instead. Pack it well, drop it off, and we pay the same day we inspect it.",
      },
    ],
  },
  {
    slug: "sell-ipad-austin",
    metaTitle: "Sell Your iPad for Cash in Austin TX | Top Cash Cellular",
    metaDescription:
      "Sell your iPad Pro, Air, or mini for cash in Austin, TX. Instant quote, same-day payout, local meetup or free shipping. Any model, any condition.",
    h1: "Sell Your iPad for Cash in Austin",
    heroLine: "Instant quote. Same-day cash. Local meetup or free shipping.",
    intro:
      "iPad Pro, Air, mini, or standard — get a real cash number in 30 seconds and sell it locally in Austin or ship it free. We buy any condition and any generation.",
    showHeroPrice: true,
    pickCategory: "iPad",
    gridLimit: 8,
    gridHeading: "iPad payouts",
    gridSub: "Tap your model for an exact quote. Storage, connectivity, and condition set the final number.",
    quotePickLine: "Pick your model, storage, connectivity, and condition for an instant cash number.",
    whyHeading: "Why sell your iPad to Top Cash Cellular?",
    whyBullets: [
      "Real cash — not store credit or trade-in vouchers.",
      "Same-day payout on Austin local meetups; same-day after inspection on shipped trades.",
      "We buy any condition, including cracked glass.",
      "Free prepaid shipping or a local Austin meetup.",
      "Cash, Cash App, Zelle, or Bitcoin.",
    ],
    faqHeading: "Selling an iPad in Austin — common questions",
    faqs: [
      {
        q: "Do you buy cellular iPads still tied to a plan?",
        a: "Yes, but remove it from your carrier account and sign out of iCloud / turn off Find My first. We can't buy an iPad that's account-locked or reported lost.",
      },
      {
        q: "Do you buy cracked iPads?",
        a: "Yes. Select the matching condition when you quote and we'll price the damage fairly.",
      },
      {
        q: "How fast do I get paid?",
        a: "Same day at a local Austin meetup, or same day after we inspect a shipped iPad. Cash, Cash App, Zelle, or Bitcoin.",
      },
      {
        q: "What should I do before selling?",
        a: "Back up your data, sign out of iCloud and turn off Find My, and factory-reset if you can. You must be 18+ and the legal owner — you'll confirm that when you submit.",
      },
    ],
  },

  // ── Niche intent pages (the locked/financed devices competitors reject) ─
  {
    slug: "sell-locked-iphone",
    metaTitle: "Sell a Carrier-Locked iPhone for Cash in Austin | Top Cash Cellular",
    metaDescription:
      "Sell a carrier-locked iPhone (AT&T, T-Mobile, Verizon) for cash in Austin, TX. We buy carrier-locked phones other sites reject. Instant quote, same-day payout.",
    h1: "Sell Your Carrier-Locked iPhone",
    heroLine: "AT&T, T-Mobile, or Verizon locked? We still pay cash for it.",
    intro:
      "Lots of buyback sites flat-out reject carrier-locked phones. We don't — we buy AT&T, T-Mobile, and Verizon-locked iPhones every day. You'll pick your carrier and lock status when you quote, and we'll give you an honest number for exactly what you have.",
    showHeroPrice: false,
    pickCategory: "iPhone",
    gridLimit: 9,
    gridHeading: "Carrier-locked iPhone payouts",
    gridSub: "Tap your model to quote it. Choose your carrier and lock status — locked phones price a bit below unlocked.",
    notice: {
      tone: "warn",
      title: "Carrier-locked is fine — iCloud / activation-locked is not",
      body: "“Carrier-locked” means the phone is tied to a network (AT&T, T-Mobile, Verizon) but is fully paid off and active — we buy those. We cannot buy a phone that is iCloud/Find-My locked, account-locked, financed-but-unpaid, or reported lost or stolen. Sign out of iCloud and turn off Find My before you sell.",
    },
    whyHeading: "Why sell your locked iPhone to us?",
    whyBullets: [
      "We actually buy carrier-locked phones — no “sorry, unlocked only.”",
      "Honest pricing: you choose your carrier and lock status, and the quote reflects it.",
      "Same-day cash on Austin local meetups; same-day after inspection on shipped trades.",
      "Any condition — cracked and locked is still cash.",
      "Cash, Cash App, Zelle, or Bitcoin.",
    ],
    faqHeading: "Selling a locked iPhone — common questions",
    faqs: [
      {
        q: "Do you really buy carrier-locked iPhones?",
        a: "Yes. We buy AT&T, T-Mobile, and Verizon-locked iPhones. Carrier-locked phones are quoted a bit below the unlocked price, but you still get real cash — when most sites would decline the device entirely.",
      },
      {
        q: "What's the difference between carrier-locked and iCloud-locked?",
        a: "Carrier-locked means the phone is restricted to one network but is paid off and usable — we buy those. iCloud / activation-locked (Find My still on, or someone else's Apple ID) means the phone can't be set up by a new owner — we can't buy those. Sign out of iCloud and turn off Find My before selling.",
      },
      {
        q: "Can I unlock it first to get more?",
        a: "If your carrier will unlock it (usually once it's paid off and the account is in good standing), an unlocked phone is worth more. But you don't have to — we'll buy it locked today.",
      },
      {
        q: "What if I still owe money on the phone?",
        a: "If there's an unpaid balance the carrier can blacklist the IMEI, which makes the phone unsellable. See our page on selling a financed phone — the account needs to be current and the balance settled.",
      },
    ],
  },
  {
    slug: "sell-financed-phone",
    metaTitle: "Sell a Financed Phone You're Still Paying Off | Austin | Top Cash Cellular",
    metaDescription:
      "Still making payments on your phone? You can sell it for cash in Austin, TX — if the account is current and the IMEI is clean. Honest quotes, same-day payout.",
    h1: "Sell a Phone You're Still Financing",
    heroLine: "Still on a payment plan? You may be able to cash out today.",
    intro:
      "Upgrading early or just want out of the contract? You can sell a financed phone for cash and put it toward your remaining balance — as long as the account is in good standing and the IMEI is clean. We'll be straight with you about what's eligible before you ship or meet up.",
    showHeroPrice: false,
    pickCategory: "iPhone",
    gridLimit: 9,
    gridHeading: "Get your cash number",
    gridSub: "Quote your model to see today's price, then read the eligibility note below before you sell.",
    notice: {
      tone: "warn",
      title: "Read this before you sell a financed phone",
      body: "We can buy a financed phone only if the carrier account is current and the device's IMEI is clean (not blacklisted, not reported lost or stolen). If you stop paying after selling, the carrier can blacklist the IMEI and the buyer is left with a brick — so we verify the IMEI at inspection. Use your payout to settle the remaining balance, and sign out of iCloud / turn off Find My first. We cannot buy a phone with an unpaid, past-due, or blacklisted balance.",
    },
    whyHeading: "How selling a financed phone works here",
    whyBullets: [
      "Get a real cash quote now and use it to pay down what you owe.",
      "We check the IMEI is clean at inspection — no surprises after the sale.",
      "Straight answers on what's eligible before you commit.",
      "Same-day cash on Austin local meetups; same-day after inspection on shipped trades.",
      "Cash, Cash App, Zelle, or Bitcoin.",
    ],
    faqHeading: "Selling a financed phone — common questions",
    faqs: [
      {
        q: "Can I sell a phone I'm still making payments on?",
        a: "Often yes. If the carrier account is current and the IMEI is clean, you can sell it and use the cash toward your remaining balance. We verify the IMEI at inspection.",
      },
      {
        q: "What if the phone is past due or the balance is unpaid?",
        a: "We can't buy a phone with a past-due or unpaid balance, because the carrier can blacklist the IMEI and brick it for the next owner. Bring the account current first.",
      },
      {
        q: "Will the phone get blacklisted after I sell it?",
        a: "Only if the balance goes unpaid. That's why we tell you to settle the remaining balance with your payout and keep the account in good standing.",
      },
      {
        q: "How do you check the phone is clean?",
        a: "We run the IMEI at inspection to confirm it isn't blacklisted, financed-but-unpaid, or reported lost or stolen. If it's clean, we pay; if not, we return it at no cost.",
      },
    ],
  },
];

export function getLandingConfig(slug: string): LandingConfig | undefined {
  return LANDING_PAGES.find((p) => p.slug === slug);
}
