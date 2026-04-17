import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Top Cash Cellular — Sell Your Phone for Top Dollar",
  description: "Get an instant quote and sell your iPhone or Android for cash. Fast payouts via Venmo, Zelle, PayPal, or cash. Austin, TX.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col font-[-apple-system,BlinkMacSystemFont,'SF_Pro_Display','Helvetica_Neue',Helvetica,Arial,sans-serif]">
        {children}
      </body>
    </html>
  );
}
