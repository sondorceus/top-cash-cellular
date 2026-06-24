import type { Metadata } from "next";
import SiteFooter from "../components/SiteFooter";
import { BRAND } from "../lib/constants";

export const metadata: Metadata = {
  title: `Inspection & Grading Guide | ${BRAND}`,
  description: `Exactly how ${BRAND} grades your device — Sealed, Like New, Good, Fair, Damaged — plus the IMEI, activation-lock, battery, water, and function checks. No surprise deductions.`,
  alternates: { canonical: "/grading-guide" },
};

const TIERS: { tier: string; color: string; desc: string }[] = [
  { tier: "Sealed", color: "#00c853", desc: "Sealed in the box, never activated. Receipt strongly preferred. We verify the seal and confirm the IMEI is clean. Sealed applies to computers/laptops/desktops, not phones." },
  { tier: "Like New", color: "#00c853", desc: "Indistinguishable from new — zero scratches on screen or body under bright light, original accessories present, battery health ≥ 95% on phones. Powers on cleanly; all sensors, buttons, and Face ID / Touch ID work." },
  { tier: "Good", color: "#88dd66", desc: "Light micro-scratches visible only at certain angles. No cracks, dents, or chips. Battery health ≥ 85% on phones. All functions work normally." },
  { tier: "Fair", color: "#ffb400", desc: "Visible scratches or scuffs but no cracks in the glass. Frame may have small dings. Screen shows full color, no dead pixels, no burn-in. All buttons and ports work." },
  { tier: "Damaged", color: "#ff6b6b", desc: "Cracked glass, chipped corners, dented frame, dead pixels, or non-working components. We still buy damaged devices — the price just reflects the repair cost." },
];

const CHECKS: { h: string; p: string }[] = [
  { h: "IMEI / serial number", p: "Run against carrier blacklist and Apple/Samsung activation-lock databases. Carrier-locked (SIM-locked) devices are accepted at a lower price. Blacklisted, lost/stolen, fraud-reported, activation-locked, or account-locked devices are refused." },
  { h: "Activation lock", p: "Find My iPhone, Google FRP, and Samsung Reactivation Lock must be off. We’ll guide you through removing them at handoff if needed." },
  { h: "Battery health", p: "On iPhones we read Settings › Battery › Battery Health; on Samsung/Android we run a diagnostic." },
  { h: "Water-damage indicators", p: "Apple LCI in the SIM tray and Samsung indicators are checked. Tripped indicators move a device to the Damaged tier." },
  { h: "Function test", p: "Screen, speakers, mics, cameras, charging port, Wi-Fi, Bluetooth, and biometric sensor. Any failing component is noted." },
];

export default function GradingGuidePage() {
  return (
    <main className="min-h-screen bg-black text-white flex flex-col">
      <div className="px-6 py-16 max-w-3xl mx-auto w-full">
        <h1 className="text-3xl font-bold mb-2">Inspection &amp; Grading Guide</h1>
        <p className="text-[#b8b8b8] text-sm mb-6">Exactly what we look for so there are no surprises at handoff.</p>

        <div className="bg-[#00c853]/10 border border-[#00c853]/20 rounded-2xl p-5 mb-8">
          <p className="text-white font-bold text-sm mb-1">Honored-quote guarantee</p>
          <p className="text-[#e6e6e6] text-sm leading-relaxed">If your device matches the tier you select below, we pay the quoted price — no surprise deductions. If the condition is materially worse, we&apos;ll show you the issue and offer a revised price; you can accept it or have the device returned free.</p>
        </div>

        <div className="space-y-3 mb-10">
          {TIERS.map((g) => (
            <div key={g.tier} className="bg-white/5 border border-white/10 rounded-2xl p-5">
              <p className="font-extrabold text-lg mb-1" style={{ color: g.color }}>{g.tier}</p>
              <p className="text-[#e6e6e6] text-sm leading-relaxed">{g.desc}</p>
            </div>
          ))}
        </div>

        <h2 className="text-xl font-bold mb-4">What else we check</h2>
        <ul className="space-y-2 mb-10 text-sm text-[#e6e6e6]">
          {CHECKS.map((c) => (
            <li key={c.h} className="flex gap-2"><span className="text-[#00c853] shrink-0">•</span><span><strong className="text-white">{c.h}</strong> — {c.p}</span></li>
          ))}
        </ul>

        <div className="bg-[#00c853]/10 border border-[#00c853]/20 rounded-2xl p-6 text-center">
          <p className="text-lg font-bold mb-2">Ready when you are</p>
          <p className="text-[#e6e6e6] text-sm mb-4">Get a quote in 30 seconds — no inspection needed up front.</p>
          <a href="/" className="inline-block bg-[#00c853] text-[#0a0a0a] px-8 py-3 rounded-2xl font-semibold hover:bg-[#00e676] transition">Get My Quote</a>
        </div>

        <div className="mt-10">
          <a href="/" className="text-sm text-[#00c853] hover:underline">← Back to Home</a>
        </div>
      </div>
      <SiteFooter />
    </main>
  );
}
