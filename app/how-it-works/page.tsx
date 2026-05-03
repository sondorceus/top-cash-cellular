import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "How It Works — Top Cash Cellular | 3 Steps to Cash",
  description: "Selling your phone, tablet, laptop, or console takes 3 steps with Top Cash Cellular: get your quote, ship for free, get paid.",
  alternates: { canonical: "https://topcashcellular.com/how-it-works" },
};

const STEPS = [
  {
    n: 1,
    icon: "💬",
    title: "Get your instant quote",
    body: "Pick your device, storage, and condition. We show you the dollar amount up-front — no waiting, no hidden deductions. Lock in the price for 7 days.",
  },
  {
    n: 2,
    icon: "📦",
    title: "Ship it free",
    body: "We email a pre-paid FedEx or UPS label. Drop the box at any carrier location. Insured up to your full quoted value, tracked end-to-end.",
  },
  {
    n: 3,
    icon: "💵",
    title: "Get paid your way",
    body: "Same business day we receive and verify the device. Cash App · Zelle land in minutes. Bitcoin (BTC) sends on-chain within ~30 min. Local Austin? Cash on the spot.",
  },
];

const PROMISES = [
  { icon: "🎯", title: "Locked-in prices", body: "What you see at quote is what you get — provided your device matches the condition tier you picked." },
  { icon: "🛡️", title: "Free return shipping", body: "Don't like the final offer? We mail it back free. No restocking fee, no questions." },
  { icon: "🔒", title: "Certified data wipe", body: "Every device gets a NIST 800-88 compliant factory wipe before resale or recycling." },
  { icon: "⚡", title: "Same-day payouts", body: "Most payments go out the same business day. Cash App/Zelle in minutes, BTC on-chain in ~30." },
];

export default function HowItWorksPage() {
  return (
    <main className="min-h-screen bg-[#0a0a0a] text-white">
      <nav className="sticky top-0 z-40 bg-[#0a0a0a]/95 backdrop-blur-xl border-b border-white/10">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <span className="w-9 h-9 rounded-xl bg-black border border-white/15 flex items-center justify-center">
              <span className="w-6 h-6 rounded-lg bg-[#00c853] flex items-center justify-center">
                <svg viewBox="0 0 24 24" className="w-3.5 h-5" fill="none" stroke="#fff" strokeWidth="2">
                  <rect x="6" y="2" width="12" height="20" rx="2.5" />
                  <line x1="10" y1="19" x2="14" y2="19" strokeLinecap="round" />
                </svg>
              </span>
            </span>
            <div className="flex flex-col leading-none">
              <span className="text-[14px] font-extrabold tracking-tight text-white">TOP CASH</span>
              <span className="text-[10px] font-bold tracking-[0.2em] text-[#00c853] uppercase">Cellular</span>
            </div>
          </Link>
          <Link href="/" className="text-xs text-[#888] hover:text-white">← Sell now</Link>
        </div>
      </nav>

      <div className="max-w-3xl mx-auto px-4 pt-10 pb-16">
        <h1 className="text-4xl font-bold mb-3">How It Works</h1>
        <p className="text-[#888] mb-10">From quote to cash in 3 simple steps.</p>

        <div className="space-y-4 mb-12">
          {STEPS.map(s => (
            <div key={s.n} className="flex gap-5 bg-white/5 border border-white/10 rounded-2xl p-6">
              <div className="flex-shrink-0 w-14 h-14 rounded-2xl bg-[#00c853]/15 border border-[#00c853]/30 flex items-center justify-center text-3xl">{s.icon}</div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-bold text-[#00c853] tracking-widest uppercase">Step {s.n}</span>
                </div>
                <h2 className="text-lg font-bold mb-1">{s.title}</h2>
                <p className="text-sm text-[#ccc] leading-relaxed">{s.body}</p>
              </div>
            </div>
          ))}
        </div>

        <h2 className="text-2xl font-bold mb-6">What we promise</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-12">
          {PROMISES.map(p => (
            <div key={p.title} className="bg-white/5 border border-white/10 rounded-2xl p-5">
              <div className="text-2xl mb-2">{p.icon}</div>
              <p className="font-semibold text-white text-sm mb-1">{p.title}</p>
              <p className="text-xs text-[#888] leading-relaxed">{p.body}</p>
            </div>
          ))}
        </div>

        <div className="bg-[#00c853]/10 border border-[#00c853]/30 rounded-2xl p-6 text-center">
          <p className="text-white text-lg font-bold mb-1">Ready when you are.</p>
          <p className="text-[#ccc] text-sm mb-4">Get an instant quote in under 60 seconds.</p>
          <Link href="/" className="inline-block bg-[#00c853] text-white px-6 py-3 rounded-full font-semibold hover:bg-[#00e676] transition">Sell my device →</Link>
        </div>
      </div>
    </main>
  );
}
