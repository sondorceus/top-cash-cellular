import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Sell Your Phone for Cash in Austin TX | Top Cash Cellular — iPhone, Samsung, MacBook Buyback",
  description: "Sell your iPhone, Samsung Galaxy, MacBook, or game console for top dollar in Austin TX. Instant quote, same-day cash payout. We pay more than Apple trade-in. Cash, Venmo, Zelle, PayPal. Free shipping available.",
  keywords: "sell iPhone Austin, sell phone for cash Austin TX, phone buyback near me, sell Samsung Galaxy, sell MacBook, trade in iPhone, sell used phone, Top Cash Cellular, sell PS5, sell Xbox, device buyback Austin, cash for phones",
  openGraph: {
    title: "Top Cash Cellular — Sell Your Phone for Top Dollar",
    description: "Instant quotes. Same-day payout. Cash, Venmo, Zelle, or PayPal. Austin, TX.",
    type: "website",
    locale: "en_US",
    siteName: "Top Cash Cellular",
    url: "https://topcashcellular.com",
  },
  twitter: {
    card: "summary_large_image",
    title: "Top Cash Cellular — Sell Your Phone for Top Dollar",
    description: "Instant quotes. Same-day payout. Cash, Venmo, Zelle, or PayPal. Austin, TX.",
  },
  robots: { index: true, follow: true },
  alternates: { canonical: "https://topcashcellular.com" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full antialiased">
      <head>
        <meta name="google-site-verification" content="BZt20XeVKiVl8Pb0tnXR0LwGJnweRfDtDUdInz1O2tU" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "LocalBusiness",
              "name": "Top Cash Cellular",
              "description": "Austin's #1 phone and device buyback service. Sell your iPhone, Samsung, MacBook, or game console for top dollar.",
              "url": "https://topcashcellular.com",
              "telephone": "(512) 960-9256",
              "address": { "@type": "PostalAddress", "addressLocality": "Austin", "addressRegion": "TX", "addressCountry": "US" },
              "areaServed": { "@type": "City", "name": "Austin" },
              "priceRange": "$$",
              "aggregateRating": { "@type": "AggregateRating", "ratingValue": "4.9", "reviewCount": "127" },
              "sameAs": [],
              "hasOfferCatalog": {
                "@type": "OfferCatalog",
                "name": "Device Buyback Prices",
                "itemListElement": [
                  { "@type": "Offer", "itemOffered": { "@type": "Product", "name": "iPhone 16 Pro Max" }, "price": "500", "priceCurrency": "USD", "description": "Sell your iPhone 16 Pro Max for up to $500" },
                  { "@type": "Offer", "itemOffered": { "@type": "Product", "name": "iPhone 15 Pro Max" }, "price": "310", "priceCurrency": "USD", "description": "Sell your iPhone 15 Pro Max for up to $310" },
                  { "@type": "Offer", "itemOffered": { "@type": "Product", "name": "Samsung Galaxy S24 Ultra" }, "price": "500", "priceCurrency": "USD", "description": "Sell your Samsung S24 Ultra for up to $500" },
                  { "@type": "Offer", "itemOffered": { "@type": "Product", "name": "MacBook Pro 16 M4" }, "price": "1200", "priceCurrency": "USD", "description": "Sell your MacBook Pro M4 for up to $1200" }
                ]
              }
            }),
          }}
        />
      </head>
      <body className="min-h-full flex flex-col font-[-apple-system,BlinkMacSystemFont,'SF_Pro_Display','Helvetica_Neue',Helvetica,Arial,sans-serif]">
        {children}
      </body>
    </html>
  );
}
