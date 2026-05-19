import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

// Cabinet Grotesk Variable — single brand font for the entire site.
// Self-hosted woff2 (41 KB), ITF Free Font License (commercial use OK).
const cabinet = localFont({
  src: "../public/fonts/CabinetGrotesk-Variable.woff2",
  variable: "--font-cabinet",
  weight: "100 900",
  display: "swap",
});

export const viewport: Viewport = {
  themeColor: "#00c853",
  // Without these, Next.js drops the default viewport meta when you
  // declare any viewport export — which makes mobile Safari render the
  // page at desktop width and zoom in, cropping the content. Lock the
  // page to device width at 1.0 scale so the funnel actually fits.
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export const metadata: Metadata = {
  title: "Sell Your Phone for Cash in Austin TX | Top Cash Cellular — iPhone, Samsung, MacBook Buyback",
  description: "Sell your iPhone, Samsung Galaxy, MacBook, or game console for top dollar in Austin TX. Instant quote, same-day cash payout. We pay more than Apple trade-in. Cash, Cash App, Zelle, BTC. Free shipping available.",
  keywords: "sell iPhone Austin, sell phone for cash Austin TX, phone buyback near me, sell Samsung Galaxy, sell MacBook, trade in iPhone, sell used phone, Top Cash Cellular, sell PS5, sell Xbox, device buyback Austin, cash for phones",
  openGraph: {
    title: "Top Cash Cellular — Sell Your Phone for Top Dollar",
    description: "Instant quotes. Same-day payout. Cash, Cash App, Zelle, or BTC. Austin, TX.",
    type: "website",
    locale: "en_US",
    siteName: "Top Cash Cellular",
    url: "https://topcashcellular.com",
  },
  twitter: {
    card: "summary_large_image",
    title: "Top Cash Cellular — Sell Your Phone for Top Dollar",
    description: "Instant quotes. Same-day payout. Cash, Cash App, Zelle, or BTC. Austin, TX.",
  },
  robots: { index: true, follow: true },
  alternates: { canonical: "https://topcashcellular.com" },
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    title: "Top Cash",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icon-192.png" }],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`h-full antialiased ${cabinet.variable}`}>
      <head>
        <link rel="preload" as="image" href="/iphone17.png" fetchPriority="high" />
        <script
          dangerouslySetInnerHTML={{
            __html: `(()=>{if(typeof IntersectionObserver==='undefined')return;const o=new IntersectionObserver((es,ob)=>{es.forEach(e=>{if(e.isIntersecting){e.target.classList.add('is-visible');ob.unobserve(e.target);}});},{threshold:0.12,rootMargin:'0px 0px -8% 0px'});let p=false;const arm=()=>{p=false;document.querySelectorAll('.reveal:not(.is-visible)').forEach(el=>o.observe(el));};const sched=()=>{if(p)return;p=true;requestAnimationFrame(arm);};if(document.readyState==='complete')arm();else window.addEventListener('load',arm);try{new MutationObserver(sched).observe(document.documentElement,{childList:true,subtree:true});}catch(e){}})();`
          }}
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `(()=>{const u=()=>{document.body.classList.toggle('at-top',window.scrollY<8);};u();window.addEventListener('scroll',u,{passive:true});})();`
          }}
        />
        <script async src="https://www.googletagmanager.com/gtag/js?id=G-8H5VGFLJ71" />
        <script src="https://accounts.google.com/gsi/client" async defer />
        <script dangerouslySetInnerHTML={{ __html: `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());gtag('config','G-8H5VGFLJ71');gtag('config','AW-18099653912');` }} />
        {/* Microsoft Clarity — heatmaps + session recordings. Activates
            only when NEXT_PUBLIC_CLARITY_ID is set in Vercel env (free
            account at clarity.microsoft.com). No data collected until
            then. Skywalker 2026-05-19 Tier-1 data-driven push. */}
        {process.env.NEXT_PUBLIC_CLARITY_ID && (
          <script
            dangerouslySetInnerHTML={{
              __html: `(function(c,l,a,r,i,t,y){c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y)})(window,document,"clarity","script","${process.env.NEXT_PUBLIC_CLARITY_ID}");`,
            }}
          />
        )}
        {/* First-party visitor ID — generates on first visit, persists in
            cookie + localStorage across sessions. Attached to every GA4
            event via dataLayer + sent to /api/lead so we can correlate
            multi-visit funnels for the same person. Skywalker 2026-05-19. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var c=document.cookie.split('; ').find(function(r){return r.indexOf('tcc_visitor_id=')===0});var v=c?c.substring(15):null;if(!v){try{v=localStorage.getItem('tcc_visitor_id')||null}catch(e){}}if(!v){v='v'+Date.now().toString(36)+Math.random().toString(36).slice(2,10);}document.cookie='tcc_visitor_id='+v+'; path=/; max-age=63072000; samesite=lax';try{localStorage.setItem('tcc_visitor_id',v)}catch(e){}window.__tccVid=v;window.dataLayer=window.dataLayer||[];window.dataLayer.push({visitor_id:v});}catch(e){}})();`,
          }}
        />
        <meta name="google-site-verification" content="BZt20XeVKiVl8Pb0tnXR0LwGJnweRfDtDUdInz1O2tU" />
        <meta name="trustpilot-one-time-domain-verification-id" content="bb9ae689-f93e-4f7a-b089-a9ca8f8c4bd5" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "LocalBusiness",
              "name": "Top Cash Cellular",
              "description": "Austin's #1 phone and device buyback service. Sell your iPhone, Samsung, MacBook, or game console for top dollar.",
              "url": "https://topcashcellular.com",
              "telephone": "(877) 549-2056",
              "address": { "@type": "PostalAddress", "addressLocality": "Austin", "addressRegion": "TX", "addressCountry": "US" },
              "areaServed": { "@type": "City", "name": "Austin" },
              "priceRange": "$$",
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
        {/* Vercel Analytics — Skywalker 2026-05-19 "ready to go live"
            visitor dashboard. Auto-enables in the Vercel project's
            Analytics tab; pageviews + path metrics for free, no config. */}
        <Analytics />
      </body>
    </html>
  );
}
