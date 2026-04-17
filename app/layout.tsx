import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Top Cash Cellular — Sell Your Phone for Top Dollar | Austin TX",
  description: "Get an instant quote and sell your iPhone, Samsung, MacBook, or game console for top dollar. Cash, Venmo, Zelle, PayPal. Same-day payout in Austin, TX.",
  keywords: "sell iPhone Austin, sell phone for cash, phone buyback, sell Samsung, sell MacBook, Top Cash Cellular",
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
              "sameAs": []
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
