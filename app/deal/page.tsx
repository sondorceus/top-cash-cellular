"use client";

// Shareable lead-capture entry for outbound deals (Facebook Marketplace,
// OfferUp, Craigslist, in-person, etc.). Skywalker works a listing, then
// sends this ONE clean link — the seller lands in the real quote funnel
// (describe device + photos + instant offer + contact) and the lead is
// tagged with its source so we know it came from outreach, not paid ads.
//
//   topcashcellular.com/deal            → source=marketplace
//   topcashcellular.com/deal?src=offerup→ source=offerup   (any channel)
//
// We write the attribution ourselves (not just a UTM param) so the tag is
// reliable even for a repeat visitor whose first-touch was already captured
// — if we sent them /deal, it IS an outreach lead. Then we hand off to the
// funnel at "/". The homepage reads the stored attribution back and keeps it.

import { useEffect } from "react";

export default function DealEntry() {
  useEffect(() => {
    try {
      const p = new URLSearchParams(window.location.search);
      const source = (p.get("src") || "marketplace").replace(/[^\w-]/g, "").slice(0, 40) || "marketplace";
      localStorage.setItem(
        "tcc-attribution",
        JSON.stringify({ ts: Date.now(), source, medium: "dm", campaign: "outreach", landed: "/deal" }),
      );
    } catch {}
    // Straight into the proven quote funnel.
    window.location.replace("/");
  }, []);

  return (
    <main className="min-h-screen bg-[#0a0a0a] text-white flex items-center justify-center px-4">
      <div className="text-center">
        <div className="text-[#00c853] text-2xl font-extrabold mb-2">Top Cash Cellular</div>
        <p className="text-[#bdbdbd] text-sm">Getting your instant offer ready…</p>
      </div>
    </main>
  );
}
