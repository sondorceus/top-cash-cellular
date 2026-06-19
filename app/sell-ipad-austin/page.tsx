import type { Metadata } from "next";
import SellLandingPage from "../components/SellLandingPage";
import { getLandingConfig } from "../data/landing-pages";

// Austin SEO landing page — copy + device selection live in the shared
// config (app/data/landing-pages.ts); layout in SellLandingPage.
const config = getLandingConfig("sell-ipad-austin")!;

export const metadata: Metadata = {
  title: config.metaTitle,
  description: config.metaDescription,
  alternates: { canonical: `/${config.slug}` },
  openGraph: {
    title: config.metaTitle,
    description: config.metaDescription,
    type: "website",
    url: `https://topcashcellular.com/${config.slug}`,
  },
};

export default function Page() {
  return <SellLandingPage config={config} />;
}
