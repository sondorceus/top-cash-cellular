"use client";
import { useState } from "react";

const BRAND = "Top Cash Cellular";
const PHONE = "(512) 960-9256";

const IPHONE_MODELS = [
  { id: "ip16pm", label: "iPhone 16 Pro Max", base: 580 },
  { id: "ip16p", label: "iPhone 16 Pro", base: 520 },
  { id: "ip16plus", label: "iPhone 16 Plus", base: 440 },
  { id: "ip16", label: "iPhone 16", base: 400 },
  { id: "ip15pm", label: "iPhone 15 Pro Max", base: 480 },
  { id: "ip15p", label: "iPhone 15 Pro", base: 420 },
  { id: "ip15plus", label: "iPhone 15 Plus", base: 360 },
  { id: "ip15", label: "iPhone 15", base: 320 },
  { id: "ip14pm", label: "iPhone 14 Pro Max", base: 380 },
  { id: "ip14p", label: "iPhone 14 Pro", base: 320 },
  { id: "ip14plus", label: "iPhone 14 Plus", base: 260 },
  { id: "ip14", label: "iPhone 14", base: 220 },
  { id: "ip13pm", label: "iPhone 13 Pro Max", base: 280 },
  { id: "ip13p", label: "iPhone 13 Pro", base: 240 },
  { id: "ip13", label: "iPhone 13", base: 180 },
  { id: "ip12pm", label: "iPhone 12 Pro Max", base: 200 },
  { id: "ip12p", label: "iPhone 12 Pro", base: 170 },
  { id: "ip12", label: "iPhone 12", base: 130 },
  { id: "ip11pm", label: "iPhone 11 Pro Max", base: 160 },
  { id: "ip11p", label: "iPhone 11 Pro", base: 140 },
  { id: "ip11", label: "iPhone 11", base: 100 },
];

const SAMSUNG_MODELS = [
  { id: "gs24u", label: "Galaxy S24 Ultra", base: 500 },
  { id: "gs24p", label: "Galaxy S24+", base: 380 },
  { id: "gs24", label: "Galaxy S24", base: 320 },
  { id: "gs23u", label: "Galaxy S23 Ultra", base: 400 },
  { id: "gs23p", label: "Galaxy S23+", base: 300 },
  { id: "gs23", label: "Galaxy S23", base: 240 },
  { id: "gzfold5", label: "Galaxy Z Fold 5", base: 520 },
  { id: "gzflip5", label: "Galaxy Z Flip 5", base: 280 },
  { id: "gs22u", label: "Galaxy S22 Ultra", base: 280 },
  { id: "gs22", label: "Galaxy S22/S22+", base: 180 },
  { id: "gs21u", label: "Galaxy S21 Ultra", base: 200 },
  { id: "gs21", label: "Galaxy S21/S21+", base: 120 },
];

const CONDITIONS = [
  { id: "flawless", label: "Flawless", desc: "Like new, no scratches or damage", multiplier: 1.0, icon: "✨" },
  { id: "good", label: "Good", desc: "Minor scratches, fully functional", multiplier: 0.85, icon: "👍" },
  { id: "fair", label: "Fair", desc: "Visible wear, cracks, or dents", multiplier: 0.65, icon: "👌" },
  { id: "poor", label: "Poor", desc: "Heavy damage, broken screen, etc.", multiplier: 0.4, icon: "⚠️" },
];

const PAYOUTS = [
  { id: "cash", label: "Cash", icon: "💵" },
  { id: "venmo", label: "Venmo", icon: "📱" },
  { id: "zelle", label: "Zelle", icon: "⚡" },
  { id: "paypal", label: "PayPal", icon: "💳" },
];

type Step = "device" | "model" | "condition" | "quote" | "payout" | "contact" | "done";

export default function Home() {
  const [step, setStep] = useState<Step>("device");
  const [deviceType, setDeviceType] = useState<"iphone" | "android" | null>(null);
  const [model, setModel] = useState<{ id: string; label: string; base: number } | null>(null);
  const [condition, setCondition] = useState<typeof CONDITIONS[0] | null>(null);
  const [payout, setPayout] = useState<typeof PAYOUTS[0] | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");

  const quote = model && condition ? Math.round(model.base * condition.multiplier) : 0;

  const handleBack = () => {
    if (step === "model") { setStep("device"); setDeviceType(null); }
    else if (step === "condition") { setStep("model"); setModel(null); }
    else if (step === "quote") { setStep("condition"); setCondition(null); }
    else if (step === "payout") setStep("quote");
    else if (step === "contact") setStep("payout");
  };

  const reset = () => {
    setStep("device");
    setDeviceType(null);
    setModel(null);
    setCondition(null);
    setPayout(null);
    setName("");
    setPhone("");
    setEmail("");
  };

  const models = deviceType === "iphone" ? IPHONE_MODELS : deviceType === "android" ? SAMSUNG_MODELS : [];

  return (
    <main className="min-h-screen bg-[#0a0a0a] text-white">
      {/* NAV */}
      <nav className="sticky top-0 z-40 bg-[#0a0a0a]/95 backdrop-blur-xl border-b border-white/10">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <button onClick={reset} className="cursor-pointer">
            <span className="text-lg font-bold tracking-tight">💰 {BRAND}</span>
          </button>
          <a href={`tel:${PHONE}`} className="bg-[#00c853] text-white px-4 py-2 rounded-full text-xs font-semibold hover:bg-[#00e676] transition">
            Call Us
          </a>
        </div>
      </nav>

      {/* STEP: DEVICE TYPE */}
      {step === "device" && (
        <section className="animate-[fadeIn_0.3s_ease-out]">
          <div className="max-w-lg mx-auto px-4 pt-12 pb-8">
            <h1 className="text-4xl font-bold tracking-tight leading-[1.08] mb-3">
              Sell your phone<br />for top dollar.
            </h1>
            <p className="text-[#888] text-lg mb-10 font-medium">
              Instant quote. Fast payout. Cash, Venmo, Zelle, or PayPal.
            </p>

            <div className="space-y-3">
              {[
                { id: "iphone" as const, label: "iPhone", sub: "iPhone 11 and newer", icon: "📱" },
                { id: "android" as const, label: "Samsung Galaxy", sub: "Galaxy S21 and newer", icon: "📲" },
              ].map((d) => (
                <button
                  key={d.id}
                  onClick={() => { setDeviceType(d.id); setStep("model"); }}
                  className="w-full flex items-center gap-4 p-5 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all duration-200 cursor-pointer text-left active:scale-[0.98]"
                >
                  <span className="text-3xl">{d.icon}</span>
                  <div className="flex-1">
                    <p className="font-semibold text-white text-lg">{d.label}</p>
                    <p className="text-[#888] text-sm">{d.sub}</p>
                  </div>
                  <svg className="w-5 h-5 text-[#888]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              ))}
            </div>

            {/* How it works */}
            <div className="mt-10 grid grid-cols-3 gap-4 text-center">
              {[
                { num: "1", label: "Get a quote", sub: "Select your device" },
                { num: "2", label: "Ship or meet", sub: "Austin local pickup" },
                { num: "3", label: "Get paid", sub: "Cash, Venmo, Zelle" },
              ].map((s, i) => (
                <div key={i} className="flex flex-col items-center">
                  <div className="w-8 h-8 rounded-full bg-[#00c853] flex items-center justify-center text-white text-sm font-bold mb-2">{s.num}</div>
                  <p className="text-white text-xs font-semibold">{s.label}</p>
                  <p className="text-[#888] text-[10px] font-medium mt-0.5">{s.sub}</p>
                </div>
              ))}
            </div>
            <p className="text-center text-[#888] text-[11px] mt-4 font-medium">Takes 30 seconds · Austin, TX</p>
          </div>
        </section>
      )}

      {/* STEP: MODEL SELECTION */}
      {step === "model" && (
        <section className="animate-[fadeIn_0.3s_ease-out]">
          <div className="max-w-lg mx-auto px-4 pt-6 pb-8">
            <button onClick={handleBack} className="inline-flex items-center gap-2 text-[#00c853] text-sm font-semibold mb-6 px-4 py-2 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 cursor-pointer transition active:scale-95">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
              Back
            </button>
            <h2 className="text-2xl font-bold mb-1">Select your model</h2>
            <p className="text-[#888] text-sm mb-6">Choose your exact device</p>
            <div className="space-y-2">
              {models.map((m) => (
                <button
                  key={m.id}
                  onClick={() => { setModel(m); setStep("condition"); }}
                  className="w-full flex items-center justify-between px-5 py-4 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 cursor-pointer transition text-left active:scale-[0.98]"
                >
                  <p className="font-semibold text-[15px]">{m.label}</p>
                  <div className="flex items-center gap-2">
                    <span className="text-[#00c853] font-bold text-sm">up to ${m.base}</span>
                    <svg className="w-4 h-4 text-[#888]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* STEP: CONDITION */}
      {step === "condition" && model && (
        <section className="animate-[fadeIn_0.3s_ease-out]">
          <div className="max-w-lg mx-auto px-4 pt-6 pb-8">
            <button onClick={handleBack} className="inline-flex items-center gap-2 text-[#00c853] text-sm font-semibold mb-6 px-4 py-2 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 cursor-pointer transition active:scale-95">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
              Back
            </button>
            <h2 className="text-2xl font-bold mb-1">What condition?</h2>
            <p className="text-[#888] text-sm mb-6">{model.label}</p>
            <div className="space-y-3">
              {CONDITIONS.map((c) => (
                <button
                  key={c.id}
                  onClick={() => { setCondition(c); setStep("quote"); }}
                  className="w-full flex items-center gap-4 p-5 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 cursor-pointer transition text-left active:scale-[0.98]"
                >
                  <span className="text-2xl">{c.icon}</span>
                  <div className="flex-1">
                    <p className="font-semibold text-lg">{c.label}</p>
                    <p className="text-[#888] text-sm">{c.desc}</p>
                  </div>
                  <span className="text-[#00c853] font-bold">${Math.round(model.base * c.multiplier)}</span>
                </button>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* STEP: QUOTE */}
      {step === "quote" && model && condition && (
        <section className="animate-[fadeIn_0.3s_ease-out]">
          <div className="max-w-lg mx-auto px-4 pt-12 pb-8 text-center">
            <p className="text-[#888] text-sm font-medium mb-2">{model.label} · {condition.label}</p>
            <h2 className="text-lg font-semibold text-[#888] mb-2">Your instant quote</h2>
            <p className="text-6xl font-bold text-[#00c853] mb-6">${quote}</p>
            <button
              onClick={() => setStep("payout")}
              className="w-full bg-[#00c853] text-white py-4 rounded-2xl text-lg font-semibold cursor-pointer hover:bg-[#00e676] transition active:scale-[0.98]"
            >
              Accept Offer
            </button>
            <button onClick={handleBack} className="mt-4 text-[#888] text-sm cursor-pointer hover:text-white transition">
              Change condition
            </button>
          </div>
        </section>
      )}

      {/* STEP: PAYOUT METHOD */}
      {step === "payout" && (
        <section className="animate-[fadeIn_0.3s_ease-out]">
          <div className="max-w-lg mx-auto px-4 pt-6 pb-8">
            <button onClick={handleBack} className="inline-flex items-center gap-2 text-[#00c853] text-sm font-semibold mb-6 px-4 py-2 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 cursor-pointer transition active:scale-95">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
              Back
            </button>
            <h2 className="text-2xl font-bold mb-1">How would you like to get paid?</h2>
            <p className="text-[#888] text-sm mb-6">Select your preferred payout method</p>
            <div className="grid grid-cols-2 gap-3">
              {PAYOUTS.map((p) => (
                <button
                  key={p.id}
                  onClick={() => { setPayout(p); setStep("contact"); }}
                  className="flex flex-col items-center justify-center p-5 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-[#00c853]/40 cursor-pointer transition h-[100px] active:scale-[0.96]"
                >
                  <span className="text-3xl mb-2">{p.icon}</span>
                  <p className="font-semibold text-sm">{p.label}</p>
                </button>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* STEP: CONTACT INFO */}
      {step === "contact" && model && condition && payout && (
        <section className="animate-[fadeIn_0.3s_ease-out]">
          <div className="max-w-lg mx-auto px-4 pt-6 pb-8">
            <button onClick={handleBack} className="inline-flex items-center gap-2 text-[#00c853] text-sm font-semibold mb-6 px-4 py-2 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 cursor-pointer transition active:scale-95">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
              Back
            </button>

            <div className="bg-white/5 border border-white/10 rounded-2xl p-5 mb-6">
              <div className="flex items-center justify-between mb-2">
                <p className="font-semibold">{model.label}</p>
                <p className="text-[#00c853] font-bold text-xl">${quote}</p>
              </div>
              <p className="text-[#888] text-sm">{condition.label} condition · {payout.label} payout</p>
            </div>

            <h2 className="text-xl font-bold mb-1">Almost done</h2>
            <p className="text-[#888] text-sm mb-6">We&apos;ll contact you to arrange pickup &amp; payment</p>

            <form onSubmit={(e) => { e.preventDefault(); setStep("done"); }} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-[#888] mb-1.5 uppercase tracking-wider">Name</label>
                <input type="text" value={name} onChange={(e) => setName(e.target.value)} required placeholder="Your name" className="w-full px-4 py-3.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder:text-[#555] focus:outline-none focus:border-[#00c853] focus:ring-4 focus:ring-[#00c853]/10 transition" />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#888] mb-1.5 uppercase tracking-wider">Phone</label>
                <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} required placeholder="(512) 555-0000" className="w-full px-4 py-3.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder:text-[#555] focus:outline-none focus:border-[#00c853] focus:ring-4 focus:ring-[#00c853]/10 transition" />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#888] mb-1.5 uppercase tracking-wider">Email <span className="normal-case text-[12px]">(optional)</span></label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@email.com" className="w-full px-4 py-3.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder:text-[#555] focus:outline-none focus:border-[#00c853] focus:ring-4 focus:ring-[#00c853]/10 transition" />
              </div>
              <button type="submit" className="w-full bg-[#00c853] text-white py-4 rounded-2xl text-base font-semibold cursor-pointer hover:bg-[#00e676] transition active:scale-[0.98]">
                Submit &amp; Get Paid
              </button>
            </form>
          </div>
        </section>
      )}

      {/* STEP: DONE */}
      {step === "done" && model && condition && payout && (
        <section className="animate-[fadeIn_0.3s_ease-out]">
          <div className="max-w-lg mx-auto px-4 pt-16 pb-8 text-center">
            <div className="w-20 h-20 rounded-full bg-[#00c853]/10 flex items-center justify-center mx-auto mb-6">
              <span className="text-4xl">✅</span>
            </div>
            <h2 className="text-2xl font-bold mb-2">You&apos;re all set!</h2>
            <p className="text-[#888] text-sm mb-6">We&apos;ll contact you within the hour to arrange pickup and payment.</p>
            <div className="bg-white/5 border border-white/10 rounded-2xl p-5 mb-6 text-left">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="font-semibold">{model.label}</p>
                  <p className="text-[#888] text-xs">{condition.label} · {payout.label}</p>
                </div>
                <p className="text-[#00c853] font-bold text-2xl">${quote}</p>
              </div>
              <div className="border-t border-white/10 pt-3 text-sm text-[#888]">
                <p>{name} · {phone}</p>
              </div>
            </div>
            <button onClick={reset} className="text-[#00c853] font-semibold text-sm cursor-pointer hover:underline">
              Sell another device
            </button>
          </div>
        </section>
      )}

      {/* FOOTER */}
      <footer className="mt-auto bg-[#0a0a0a] text-[#888] py-8 border-t border-white/10">
        <div className="max-w-lg mx-auto px-4 text-center">
          <p className="text-xs font-medium">{PHONE} · Austin, TX</p>
          <p className="text-[11px] mt-3 text-[#888]/60">© 2026 {BRAND}. All rights reserved.</p>
        </div>
      </footer>

      <style jsx>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </main>
  );
}
