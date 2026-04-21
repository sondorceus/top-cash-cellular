"use client";
import { useState, useEffect, useCallback } from "react";

const BRAND = "Top Cash Cellular";
const PHONE = "(877) 549-2056";
const PHONE_TEL = "+18775492056";

const IPHONE_SERIES = [
  { id: "17", label: "iPhone 17", image: "/iphone17.png", year: "2025", topPrice: 825, variants: [
    { id: "ip17pm", label: "iPhone 17 Pro Max", base: 825 },
    { id: "ip17p", label: "iPhone 17 Pro", base: 715 },
    { id: "ip17air", label: "iPhone 17 Air", base: 475 },
    { id: "ip17plus", label: "iPhone 17 Plus", base: 500 },
    { id: "ip17", label: "iPhone 17", base: 455 },
    { id: "ip17e", label: "iPhone 17E", base: 190 },
  ]},
  { id: "16", label: "iPhone 16", image: "/iphone16.png", year: "2024", topPrice: 490, variants: [
    { id: "ip16pm", label: "iPhone 16 Pro Max", base: 490 },
    { id: "ip16p", label: "iPhone 16 Pro", base: 390 },
    { id: "ip16plus", label: "iPhone 16 Plus", base: 320 },
    { id: "ip16", label: "iPhone 16", base: 300 },
    { id: "ip16e", label: "iPhone 16E", base: 145 },
  ]},
  { id: "15", label: "iPhone 15", image: "/iphone15.png", year: "2023", topPrice: 290, variants: [
    { id: "ip15pm", label: "iPhone 15 Pro Max", base: 290 },
    { id: "ip15p", label: "iPhone 15 Pro", base: 235 },
    { id: "ip15plus", label: "iPhone 15 Plus", base: 180 },
    { id: "ip15", label: "iPhone 15", base: 160 },
  ]},
  { id: "14", label: "iPhone 14", image: "/iphone14.png", year: "2022", topPrice: 170, variants: [
    { id: "ip14pm", label: "iPhone 14 Pro Max", base: 170 },
    { id: "ip14p", label: "iPhone 14 Pro", base: 140 },
    { id: "ip14plus", label: "iPhone 14 Plus", base: 110 },
    { id: "ip14", label: "iPhone 14", base: 100 },
  ]},
  { id: "13", label: "iPhone 13", image: "/iphone13.png", year: "2021", topPrice: 130, variants: [
    { id: "ip13pm", label: "iPhone 13 Pro Max", base: 130 },
    { id: "ip13p", label: "iPhone 13 Pro", base: 100 },
    { id: "ip13", label: "iPhone 13", base: 75 },
  ]},
  { id: "12", label: "iPhone 12", image: "/iphone12.png", year: "2020", topPrice: 130, variants: [
    { id: "ip12pm", label: "iPhone 12 Pro Max", base: 130 },
    { id: "ip12p", label: "iPhone 12 Pro", base: 110 },
    { id: "ip12", label: "iPhone 12", base: 80 },
    { id: "ip12mini", label: "iPhone 12 Mini", base: 60 },
  ]},
  { id: "11", label: "iPhone 11", image: "/iphone11.png", year: "2019", topPrice: 100, variants: [
    { id: "ip11pm", label: "iPhone 11 Pro Max", base: 100 },
    { id: "ip11p", label: "iPhone 11 Pro", base: 85 },
    { id: "ip11", label: "iPhone 11", base: 60 },
  ]},
];

const SAMSUNG_MODELS = [
  { id: "gs25u", label: "Galaxy S25 Ultra", base: 620 },
  { id: "gs25p", label: "Galaxy S25+", base: 470 },
  { id: "gs25", label: "Galaxy S25", base: 380 },
  { id: "gs24u", label: "Galaxy S24 Ultra", base: 500 },
  { id: "gs24p", label: "Galaxy S24+", base: 380 },
  { id: "gs24", label: "Galaxy S24", base: 300 },
  { id: "gs23u", label: "Galaxy S23 Ultra", base: 380 },
  { id: "gs23p", label: "Galaxy S23+", base: 270 },
  { id: "gs23", label: "Galaxy S23", base: 210 },
  { id: "gzfold6", label: "Galaxy Z Fold 6", base: 650 },
  { id: "gzfold5", label: "Galaxy Z Fold 5", base: 480 },
  { id: "gzflip6", label: "Galaxy Z Flip 6", base: 320 },
  { id: "gzflip5", label: "Galaxy Z Flip 5", base: 240 },
  { id: "gs22u", label: "Galaxy S22 Ultra", base: 280 },
  { id: "gs22", label: "Galaxy S22/S22+", base: 180 },
  { id: "gs21u", label: "Galaxy S21 Ultra", base: 480 },
  { id: "gs21", label: "Galaxy S21/S21+", base: 300 },
];

const MACBOOK_MODELS = [
  { id: "mbp16m4", label: "MacBook Pro 16\" M4", base: 1200 },
  { id: "mbp14m4", label: "MacBook Pro 14\" M4", base: 1000 },
  { id: "mbp16m3", label: "MacBook Pro 16\" M3", base: 950 },
  { id: "mbp14m3", label: "MacBook Pro 14\" M3", base: 800 },
  { id: "mba15m3", label: "MacBook Air 15\" M3", base: 700 },
  { id: "mba13m3", label: "MacBook Air 13\" M3", base: 600 },
  { id: "mbp16m2", label: "MacBook Pro 16\" M2", base: 750 },
  { id: "mbp14m2", label: "MacBook Pro 14\" M2", base: 650 },
  { id: "mba15m2", label: "MacBook Air 15\" M2", base: 550 },
  { id: "mba13m2", label: "MacBook Air 13\" M2", base: 480 },
  { id: "mba13m1", label: "MacBook Air 13\" M1", base: 350 },
  { id: "mbp13m1", label: "MacBook Pro 13\" M1", base: 400 },
];

const IPAD_MODELS = [
  { id: "ipadpro13m5", label: "iPad Pro 13\" M5", base: 610 },
  { id: "ipadpro11m5", label: "iPad Pro 11\" M5", base: 475 },
  { id: "ipadpro13m4", label: "iPad Pro 13\" M4", base: 500 },
  { id: "ipadpro11m4", label: "iPad Pro 11\" M4", base: 350 },
  { id: "ipadpro129g6", label: "iPad Pro 12.9\" 6th Gen", base: 270 },
  { id: "ipadpro11g4", label: "iPad Pro 11\" 4th Gen", base: 225 },
  { id: "ipadair13m3", label: "iPad Air 13\" M3", base: 360 },
  { id: "ipadair11m3", label: "iPad Air 11\" M3", base: 275 },
  { id: "ipadair13m2", label: "iPad Air 13\" M2", base: 275 },
  { id: "ipadair11m2", label: "iPad Air 11\" M2", base: 200 },
  { id: "ipad10", label: "iPad 10th Gen", base: 150 },
  { id: "ipad9", label: "iPad 9th Gen", base: 100 },
  { id: "ipadmini7", label: "iPad Mini 7th Gen", base: 225 },
  { id: "ipadmini6", label: "iPad Mini 6th Gen", base: 150 },
];

const CONSOLE_MODELS = [
  { id: "ps5", label: "PlayStation 5", base: 300 },
  { id: "ps5d", label: "PlayStation 5 Digital", base: 250 },
  { id: "ps4pro", label: "PlayStation 4 Pro", base: 150 },
  { id: "ps4", label: "PlayStation 4", base: 100 },
  { id: "xsx", label: "Xbox Series X", base: 280 },
  { id: "xss", label: "Xbox Series S", base: 150 },
  { id: "xone", label: "Xbox One", base: 80 },
  { id: "switch", label: "Nintendo Switch OLED", base: 180 },
  { id: "switchv2", label: "Nintendo Switch V2", base: 130 },
  { id: "switchlite", label: "Nintendo Switch Lite", base: 90 },
];

const CONDITIONS = [
  { id: "brandnew", label: "Brand New", desc: "Factory sealed, never activated", multiplier: 1.15, icon: "🆕", details: ["Still in factory original packaging", "Plastic film still on the device and has not been reapplied", "Device is not activated", "Must come with the original box with matching serial number", "Contains all original accessories"] },
  { id: "flawless", label: "Flawless", desc: "Like new, zero signs of use", multiplier: 1.0, icon: "✨", details: ["Zero scratches, scuffs, or other marks — looks like new", "Display is free of defects such as cracks, dead pixels, white spots, or burn-in", "Original battery above 80% capacity", "Powers on and functions 100% as intended", "Must be paid off and free of any financial obligations"] },
  { id: "verygood", label: "Very Good", desc: "Minimal use, no visible scratches at arm's length", multiplier: 0.95, icon: "💎", details: ["Light scratches or scuffs not visible at arm's length — no dents, dings, or deep scratches", "Display is free of defects such as cracks, dead pixels, white spots, or burn-in", "Original battery above 80% capacity", "Powers on and functions 100% as intended", "Must be paid off and free of any financial obligations"] },
  { id: "good", label: "Good", desc: "Light wear, fully functional", multiplier: 0.88, icon: "👍", details: ["Light to moderate signs of wear — few light scratches and/or dents", "Display is free of defects such as cracks, dead pixels, white spots, or burn-in", "Original battery above 80% capacity", "Powers on and functions 100% as intended", "Must be paid off and free of any financial obligations"] },
  { id: "fair", label: "Fair", desc: "Moderate to heavy wear, functional", multiplier: 0.72, icon: "👌", details: ["Moderate to excessive signs of wear — contains heavy scratches and/or dents", "Display is free of defects such as cracks, dead pixels, white spots, or burn-in", "Original battery above 80% capacity", "Powers on and functions 100% as intended", "Must be paid off and free of any financial obligations"] },
  { id: "broken", label: "Broken", desc: "Cracked, defective, or damaged", multiplier: 0.50, icon: "⚠️", details: ["Functionally defective or broken parts on either screen or body", "Cracked display or damaged housing", "Display defects such as dead pixels, white spots, or burn-in", "Shows no signs of liquid intrusion or water damage"] },
];

const ALL_STORAGES = [
  { id: "64", label: "64 GB", multiplier: 0.85 },
  { id: "128", label: "128 GB", multiplier: 1.0 },
  { id: "256", label: "256 GB", multiplier: 1.12 },
  { id: "512", label: "512 GB", multiplier: 1.25 },
  { id: "1tb", label: "1 TB", multiplier: 1.4 },
  { id: "2tb", label: "2 TB", multiplier: 1.55 },
];

const STORAGE_MAP: Record<string, string[]> = {
  // iPhone 17 series — confirmed by Skywalker
  ip17pm: ["256", "512", "1tb", "2tb"],
  ip17p: ["256", "512", "1tb"],
  ip17air: ["256", "512", "1tb"],
  ip17plus: ["256", "512"],
  ip17: ["256", "512"],
  ip17e: ["256"],
  // iPhone 16 series
  ip16pm: ["256", "512", "1tb"],
  ip16p: ["128", "256", "512", "1tb"],
  ip16plus: ["128", "256", "512"],
  ip16: ["128", "256", "512"],
  ip16e: ["128", "256"],
  // iPhone 15 series
  ip15pm: ["256", "512", "1tb"],
  ip15p: ["128", "256", "512", "1tb"],
  ip15plus: ["128", "256", "512"],
  ip15: ["128", "256", "512"],
  // iPhone 14 series
  ip14pm: ["128", "256", "512", "1tb"],
  ip14p: ["128", "256", "512", "1tb"],
  ip14plus: ["128", "256", "512"],
  ip14: ["128", "256", "512"],
  // iPhone 13 series — 13 Pro/PM have 128/256/512/1TB, base 13 has 128/256/512
  ip13pm: ["128", "256", "512", "1tb"],
  ip13p: ["128", "256", "512", "1tb"],
  ip13: ["128", "256", "512"],
  // iPhone 12 series — 12 Pro/PM start 128, base has 64/128/256
  ip12pm: ["128", "256", "512"],
  ip12p: ["128", "256", "512"],
  ip12: ["64", "128", "256"],
  ip12mini: ["64", "128", "256"],
  // iPhone 11 series — Pro/PM skip 128GB
  ip11pm: ["64", "256", "512"],
  ip11p: ["64", "256", "512"],
  ip11: ["64", "128", "256"],
  // Samsung Galaxy — all come in 128/256/512 (Ultra has 1TB option on some)
  gs25u: ["256", "512", "1tb"],
  gs25p: ["256", "512"],
  gs25: ["128", "256", "512"],
  gs24u: ["256", "512", "1tb"],
  gs24p: ["256", "512"],
  gs24: ["128", "256"],
  gs23u: ["256", "512", "1tb"],
  gs23p: ["256", "512"],
  gs23: ["128", "256"],
  gzfold6: ["256", "512", "1tb"],
  gzfold5: ["256", "512"],
  gzflip6: ["256", "512"],
  gzflip5: ["256", "512"],
  gs22u: ["128", "256", "512", "1tb"],
  gs22: ["128", "256"],
  gs21u: ["128", "256", "512"],
  gs21: ["128", "256"],
  // MacBooks — unified memory, storage options
  mbp16m4: ["512", "1tb"],
  mbp14m4: ["512", "1tb"],
  mbp16m3: ["512", "1tb"],
  mbp14m3: ["512", "1tb"],
  mba15m3: ["256", "512", "1tb"],
  mba13m3: ["256", "512", "1tb"],
  mbp16m2: ["512", "1tb"],
  mbp14m2: ["512", "1tb"],
  mba15m2: ["256", "512"],
  mba13m2: ["256", "512"],
  mba13m1: ["256", "512"],
  mbp13m1: ["256", "512"],
  // iPads
  ipadpro13m5: ["256", "512", "1tb"],
  ipadpro11m5: ["256", "512", "1tb"],
  ipadpro13m4: ["256", "512", "1tb"],
  ipadpro11m4: ["256", "512", "1tb"],
  ipadpro129g6: ["128", "256", "512", "1tb"],
  ipadpro11g4: ["128", "256", "512", "1tb"],
  ipadair13m3: ["128", "256", "512", "1tb"],
  ipadair11m3: ["128", "256", "512", "1tb"],
  ipadair13m2: ["128", "256", "512", "1tb"],
  ipadair11m2: ["128", "256", "512", "1tb"],
  ipad10: ["64", "256"],
  ipad9: ["64", "256"],
  ipadmini7: ["128", "256", "512"],
  ipadmini6: ["64", "256"],
};

function getStoragesForModel(modelId: string) {
  const valid = STORAGE_MAP[modelId];
  if (!valid) return ALL_STORAGES;
  return ALL_STORAGES.filter(s => valid.includes(s.id));
}

const CARRIERS = [
  { id: "unlocked", label: "Unlocked", multiplier: 1.0, icon: "🔓" },
  { id: "att", label: "AT&T", multiplier: 0.95, icon: "📶" },
  { id: "tmobile", label: "T-Mobile", multiplier: 0.95, icon: "📶" },
  { id: "verizon", label: "Verizon", multiplier: 0.95, icon: "📶" },
  { id: "other", label: "Other / Locked", multiplier: 0.85, icon: "🔒" },
];

const PAYOUTS = [
  { id: "cash", label: "Cash", icon: "💵" },
  { id: "venmo", label: "Venmo", icon: "📱" },
  { id: "zelle", label: "Zelle", icon: "⚡" },
  { id: "paypal", label: "PayPal", icon: "💳" },
];

const FAQS = [
  { q: "How does the process work?", a: "Select your device, choose its condition, and get an instant quote. Accept the offer, pick your payout method, and we'll arrange a local pickup in Austin." },
  { q: "How fast will I get paid?", a: "Same day for local Austin pickups. We pay on the spot via your preferred method — Cash, Venmo, Zelle, or PayPal." },
  { q: "What if my device is cracked or damaged?", a: "We buy devices in any condition. Damaged phones get a lower offer, but you'll still get cash. Select 'Fair' or 'Poor' condition for an accurate quote." },
  { q: "Are the quotes guaranteed?", a: "Quotes are based on the condition you select. Final price is confirmed during inspection at pickup — if the device matches your description, you get the quoted price." },
  { q: "What devices do you buy?", a: "We buy iPhones (11 and newer) and Samsung Galaxy phones (S21 and newer), including Z Fold and Z Flip models." },
  { q: "Do I need to factory reset my phone?", a: "Yes, please back up your data and factory reset before selling. We'll walk you through it if you need help." },
];

type Step = "device" | "category" | "brand" | "model" | "storage" | "condition" | "carrier" | "quote" | "checkout" | "payout" | "contact" | "done" | "inquiry";
type DeviceType = "iphone" | "android" | "macbook" | "console" | "ipad" | null;

function FairPromise() {
  return (
    <div className="mt-6 bg-white/5 border border-white/10 rounded-2xl p-5">
      <h3 className="text-sm font-bold text-[#00c853] uppercase tracking-wider mb-1">Our Promise</h3>
      <p className="text-base font-bold text-white mb-1">Fair Evaluation Promise</p>
      <p className="text-[#888] text-xs mb-3">Concerned about quote adjustments? Here&apos;s how we handle inspections.</p>
      <div className="space-y-3">
        <div className="flex gap-3"><span className="text-lg">🎯</span><div><p className="text-sm font-semibold text-[#ccc]">Consistent grading</p><p className="text-xs text-[#888]">Every device is evaluated using a standardized process based on the condition you select.</p></div></div>
        <div className="flex gap-3"><span className="text-lg">🤝</span><div><p className="text-sm font-semibold text-[#ccc]">Clear explanations</p><p className="text-xs text-[#888]">If your device differs from what was described, we&apos;ll explain what we found before adjusting your offer.</p></div></div>
        <div className="flex gap-3"><span className="text-lg">🔄</span><div><p className="text-sm font-semibold text-[#ccc]">Your choice</p><p className="text-xs text-[#888]">Don&apos;t agree with the updated offer? We&apos;ll return your device — no questions asked.</p></div></div>
      </div>
    </div>
  );
}

function TrustBadge() {
  return (
    <div className="mt-6 flex flex-wrap items-center justify-center gap-3 text-[#888] text-xs">
      <span>⭐ Thousands of happy sellers</span>
      <span>·</span>
      <span>🔒 7-day price lock</span>
      <span>·</span>
      <span>⚡ Same-day payout</span>
      <span>·</span>
      <span>🏠 Austin local</span>
    </div>
  );
}

export default function Home() {
  const [step, setStep] = useState<Step>("device");
  const [category, setCategory] = useState<"phones" | "computers" | "consoles" | null>(null);
  const [deviceType, setDeviceType] = useState<DeviceType>(null);
  const [selectedSeries, setSelectedSeries] = useState<string | null>(null);
  const [carrier, setCarrier] = useState<typeof CARRIERS[0] | null>(null);
  const [page, setPage] = useState<"home" | "about" | "privacy" | "terms">("home");
  const [model, setModel] = useState<{ id: string; label: string; base: number } | null>(null);
  const [storage, setStorage] = useState<typeof ALL_STORAGES[0] | null>(null);
  const [condition, setCondition] = useState<typeof CONDITIONS[0] | null>(null);
  const [payout, setPayout] = useState<typeof PAYOUTS[0] | null>(null);
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMode, setChatMode] = useState<"choose" | "chat" | "call">("choose");
  const [chatMsg, setChatMsg] = useState("");
  const [chatSent, setChatSent] = useState(false);
  const [chatMessages, setChatMessages] = useState<{ from: "user" | "bot"; text: string }[]>([
    { from: "bot", text: "Hey! I'm here to help you sell your device. Ask me anything about pricing, how it works, or what we buy!" }
  ]);
  const [chatLoading, setChatLoading] = useState(false);

  const sendChat = async () => {
    if (!chatMsg.trim()) return;
    const msg = chatMsg;
    setChatMsg("");
    setChatMessages(prev => [...prev, { from: "user", text: msg }]);
    setChatLoading(true);
    try {
      const res = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: msg, history: chatMessages }) });
      const data = await res.json();
      setChatMessages(prev => [...prev, { from: "bot", text: data.reply }]);
    } catch {
      setChatMessages(prev => [...prev, { from: "bot", text: "Sorry, something went wrong. Try again or call us!" }]);
    }
    setChatLoading(false);
  };
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [quoteEmail, setQuoteEmail] = useState("");
  const [quoteSaved, setQuoteSaved] = useState(false);
  const [devicePhoto, setDevicePhoto] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [showConfetti, setShowConfetti] = useState(false);
  const [cartItems, setCartItems] = useState<Array<{ model: string; modelId: string; storage: string; condition: string; price: number; quantity: number }>>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [inquiryCategory, setInquiryCategory] = useState("");
  const [inquirySent, setInquirySent] = useState(false);
  const [inquiryDesc, setInquiryDesc] = useState("");
  const [cookieConsent, setCookieConsent] = useState<string | null>(null);
  const [newsletterEmail, setNewsletterEmail] = useState("");
  const [newsletterSubmitted, setNewsletterSubmitted] = useState(false);
  const [statsVisible, setStatsVisible] = useState(false);
  const [animatedStats, setAnimatedStats] = useState({ devices: 0, payout: 0, time: 0 });

  useEffect(() => {
    const saved = localStorage.getItem("cookie-consent");
    setCookieConsent(saved);
  }, []);

  useEffect(() => {
    if (!statsVisible) return;
    const targets = { devices: 500, payout: 150, time: 24 };
    const duration = 1500;
    const steps = 40;
    const interval = duration / steps;
    let current = 0;
    const timer = setInterval(() => {
      current++;
      const progress = current / steps;
      const ease = 1 - Math.pow(1 - progress, 3);
      setAnimatedStats({
        devices: Math.round(targets.devices * ease),
        payout: Math.round(targets.payout * ease),
        time: Math.round(targets.time * ease),
      });
      if (current >= steps) clearInterval(timer);
    }, interval);
    return () => clearInterval(timer);
  }, [statsVisible]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("tcc-session");
      if (saved) {
        const s = JSON.parse(saved);
        if (s.step && s.step !== "done" && Date.now() - (s.ts || 0) < 7 * 24 * 60 * 60 * 1000) {
          if (s.deviceType) setDeviceType(s.deviceType);
          if (s.selectedSeries) setSelectedSeries(s.selectedSeries);
          if (s.model) setModel(s.model);
          if (s.storage) setStorage(s.storage);
          if (s.condition) setCondition(s.condition);
          if (s.carrier) setCarrier(s.carrier);
          if (s.quantity) setQuantity(s.quantity);
          if (s.email) setEmail(s.email);
          setStep(s.step);
        }
      }
    } catch {}
  }, []);

  useEffect(() => {
    if (step === "device") { localStorage.removeItem("tcc-session"); return; }
    try {
      localStorage.setItem("tcc-session", JSON.stringify({
        step, deviceType, selectedSeries, model, storage, condition, carrier, quantity, email, ts: Date.now(),
      }));
    } catch {}
  }, [step, deviceType, selectedSeries, model, storage, condition, carrier, quantity, email]);

  const storageMultiplier = storage?.multiplier ?? 1;
  const carrierMultiplier = carrier?.multiplier ?? 1;
  const quote = model && condition ? Math.round(model.base * storageMultiplier * condition.multiplier * carrierMultiplier) : 0;

  const pushHistory = useCallback((s: string) => {
    window.history.pushState({ step: s }, "", `#${s}`);
  }, []);

  useEffect(() => {
    const onPop = () => { handleBack(); };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  });

  const handleBack = () => {
    if (step === "model" && selectedSeries) { setSelectedSeries(null); return; }
    if (step === "model") { if (category) { setStep("brand"); } else { setStep("category"); } setDeviceType(null); }
    else if (step === "brand") { setStep("category"); setCategory(null); }
    else if (step === "category") { setStep("device"); }
    else if (step === "storage") { setStep("model"); setModel(null); }
    else if (step === "condition") { if (deviceType === "console") { setStep("model"); setModel(null); } else { setStep("storage"); setStorage(null); } }
    else if (step === "carrier") { setStep("condition"); setCondition(null); }
    else if (step === "quote") { if (carrier) { setStep("carrier"); setCarrier(null); } else { setStep("condition"); setCondition(null); } }
    else if (step === "checkout") setStep("quote");
    else if (step === "payout") setStep("checkout");
    else if (step === "contact") setStep("payout"); pushHistory("payout");
  };

  const reset = () => {
    setStep("device");
    setCategory(null);
    setDeviceType(null);
    setSelectedSeries(null);
    setModel(null);
    setStorage(null);
    setCondition(null);
    setCarrier(null);
    setPayout(null);
    setQuantity(1);
    setExpandedFaq(null);
    setPage("home");
    setName("");
    setPhone("");
    setEmail("");
  };

  const iphoneVariants = selectedSeries ? IPHONE_SERIES.find(s => s.id === selectedSeries)?.variants || [] : [];
  const models = deviceType === "iphone" ? iphoneVariants : deviceType === "android" ? SAMSUNG_MODELS : deviceType === "macbook" ? MACBOOK_MODELS : deviceType === "console" ? CONSOLE_MODELS : deviceType === "ipad" ? IPAD_MODELS : [];

  return (
    <main className="min-h-screen bg-[#0a0a0a] text-white">
      {/* NAV */}
      <nav className="sticky top-0 z-40 bg-[#0a0a0a]/95 backdrop-blur-xl border-b border-white/10">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <button onClick={reset} aria-label="Go to homepage" className="cursor-pointer">
            <span className="flex items-center gap-2">
              <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                <rect width="32" height="32" rx="8" fill="url(#logoGrad)"/>
                <defs><linearGradient id="logoGrad" x1="0" y1="0" x2="32" y2="32"><stop offset="0%" stopColor="#00e676"/><stop offset="100%" stopColor="#00c853"/></linearGradient></defs>
                <rect x="10" y="5" width="12" height="22" rx="3" stroke="#fff" strokeWidth="1.8" fill="none"/>
                <line x1="13" y1="24" x2="19" y2="24" stroke="#fff" strokeWidth="1.2" strokeLinecap="round"/>
                <path d="M16 10l-3.5 4h2.5v4h2v-4h2.5L16 10z" fill="#fff"/>
              </svg>
              <div className="flex flex-col leading-none">
                <span className="text-[13px] font-extrabold tracking-tight text-white">TOP CASH</span>
                <span className="text-[9px] font-semibold tracking-[0.15em] text-[#00c853] uppercase">Cellular</span>
              </div>
            </span>
          </button>
          <a href={`tel:${PHONE_TEL}`} aria-label="Call us" className="bg-[#00c853] text-white px-4 py-2 rounded-full text-xs font-semibold hover:bg-[#00e676] transition">
            Call Us
          </a>
        </div>
      </nav>

      {/* STEP: DEVICE TYPE */}
      {step === "device" && page === "home" && (
        <section className="animate-[fadeIn_0.3s_ease-out]">
          {/* PROMO BANNER */}
          <div className="bg-[#00c853] text-center py-2 px-4">
            <p className="text-white text-xs font-semibold">🔥 Limited time: Extra 10% on all iPhones this week</p>
          </div>
          {/* HERO: Phone → Cash Visual */}
          <div className="max-w-lg mx-auto px-4 pt-8 pb-4">
            <div className="flex items-center justify-center gap-4 mb-4">
              <img src="/iphone17.png" alt="Phone" className="w-16 h-16 object-contain" />
              <div className="flex items-center gap-0.5 animate-pulse">
                <svg className="w-6 h-6 text-[#00c853]" fill="currentColor" viewBox="0 0 24 24"><path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6z"/></svg>
                <svg className="w-6 h-6 text-[#00c853]/60" fill="currentColor" viewBox="0 0 24 24"><path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6z"/></svg>
                <svg className="w-6 h-6 text-[#00c853]/30" fill="currentColor" viewBox="0 0 24 24"><path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6z"/></svg>
              </div>
              <span className="text-4xl">💰</span>
            </div>
          </div>

          <div className="max-w-lg mx-auto px-4 pb-8">
            <h1 className="text-4xl font-bold tracking-tight leading-[1.08] mb-3">
              Get top dollar<br />for your device.
            </h1>
            <p className="text-[#888] text-lg mb-1 font-medium">
              Instant quote. Same-day payout available.
            </p>
            <p className="text-[#888] text-lg mb-6 font-medium">
              Cash, Venmo, Zelle, or PayPal.
            </p>

            <div className="glow-border mb-6 p-[3px]">
              <button
                onClick={() => { setStep("category"); pushHistory("category"); }}
                className="w-full bg-[#00c853] text-white py-5 rounded-[14px] text-xl font-bold cursor-pointer hover:bg-[#00e676] transition active:scale-[0.98] shadow-lg shadow-[#00c853]/20 relative z-10"
              >
                Sell Your Device
              </button>
            </div>

            <div className="mt-5 bg-white/5 border border-white/10 rounded-2xl p-4 text-center">
              <p className="text-[#888] text-sm">Don&apos;t see your device? <a href={`tel:${PHONE_TEL}`} className="text-[#00c853] font-semibold hover:underline">Contact us</a> and we&apos;ll make you an offer!</p>
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 bg-[#00c853]/15 text-[#00c853] text-xs font-semibold px-3 py-1.5 rounded-full border border-[#00c853]/20">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
                Best Price Guarantee
              </span>
              <span className="inline-flex items-center gap-1.5 bg-white/5 text-[#888] text-xs font-medium px-3 py-1.5 rounded-full border border-white/10">
                Same-Day Payout
              </span>
              <span className="inline-flex items-center gap-1.5 bg-white/5 text-[#888] text-xs font-medium px-3 py-1.5 rounded-full border border-white/10">
                Austin Local + Shipping
              </span>
            </div>

            <div className="mt-8">
              <p className="text-[#888] text-xs font-semibold uppercase tracking-wider mb-3">Popular devices — sell yours today</p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { name: "iPhone 16 Pro Max", price: "$500" },
                  { name: "iPhone 15 Pro Max", price: "$310" },
                  { name: "Samsung S24 Ultra", price: "$500" },
                  { name: "MacBook Pro 16\" M4", price: "$1,200" },
                  { name: "PlayStation 5", price: "$300" },
                  { name: "iPhone 14 Pro", price: "$210" },
                ].map((d) => (
                  <button key={d.name} onClick={() => { setDeviceType("iphone"); setStep("model"); pushHistory("model"); }} className="flex items-center justify-between bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 hover:bg-white/10 transition cursor-pointer text-left active:scale-[0.98]">
                    <span className="text-white text-xs font-medium">{d.name}</span>
                    <span className="text-[#00c853] text-xs font-bold">up to {d.price}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* STEP: CATEGORY */}
      {step === "category" && page === "home" && (
        <section className="animate-[fadeIn_0.3s_ease-out]">
          <div className="max-w-lg mx-auto px-4 pt-6 pb-8">
            <button onClick={handleBack} aria-label="Go back" className="inline-flex items-center gap-2 text-[#00c853] text-sm font-semibold mb-6 px-4 py-2 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 cursor-pointer transition active:scale-95">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
              Back
            </button>
            <h2 className="text-2xl font-bold mb-1">What are you selling?</h2>
            <p className="text-[#888] text-sm mb-6">Select a category</p>
            <div className="grid grid-cols-4 gap-2">
              {[
                { id: "phones" as const, label: "Sell Phone", icon: "📱" },
                { id: "phones" as const, label: "Sell Tablet", icon: "⬜", direct: false, deviceType: "ipad" as const, customIcon: true },
                { id: "computers" as const, label: "Sell Laptop", icon: "💻" },
                { id: "computers" as const, label: "Sell Desktop", icon: "🖥️", direct: true },
                { id: "phones" as const, label: "Sell Smartwatch", icon: "⌚", direct: true, subcats: ["Apple Watch", "Google Pixel Watch", "Garmin"] },
                { id: "consoles" as const, label: "Sell Game Console", icon: "🎮", direct: false, deviceType: "console" as const },
                { id: "computers" as const, label: "Sell Graphics Card", icon: "⚡", direct: true },
                { id: "computers" as const, label: "Sell Drone", icon: "🛸", direct: true },
                { id: "computers" as const, label: "Sell VR", icon: "🥽", direct: true },
                { id: "computers" as const, label: "Sell Monitor", icon: "🖥️", direct: true },
              ].map((cat, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    if ((cat as { direct?: boolean }).direct) {
                      const subs = (cat as { subcats?: string[] }).subcats;
                      setInquiryCategory(subs ? cat.label.replace('Sell ', '') : cat.label.replace('Sell ', ''));
                      setInquirySent(false);
                      setInquiryDesc(subs ? '' : '');
                      setStep("inquiry");
                      pushHistory("inquiry");
                      return;
                    }
                    const dt = (cat as { deviceType?: string }).deviceType;
                    if (dt) { setDeviceType(dt as DeviceType); setStep("model"); pushHistory("model"); return; }
                    setCategory(cat.id); setStep("brand"); pushHistory("brand");
                  }}
                  className="flex flex-col items-center justify-center p-4 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-[#00c853]/40 transition cursor-pointer active:scale-[0.96]"
                >
                  {(cat as { customIcon?: boolean }).customIcon ? (
                    <svg className="w-8 h-6 mb-1.5 text-white" viewBox="0 0 32 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="2" width="28" height="20" rx="3" /><circle cx="16" cy="22" r="1" fill="currentColor" /></svg>
                  ) : (
                    <span className="text-2xl mb-1.5">{cat.icon}</span>
                  )}
                  <p className="font-semibold text-white text-xs text-center">{cat.label}</p>
                </button>
              ))}
            </div>
            <p className="text-[#777] text-[11px] text-center mt-3">Some categories will connect you to our team for a custom quote</p>

            <FairPromise />
            <TrustBadge />
          </div>
        </section>
      )}

      {/* STEP: INQUIRY (unknown categories) — full quote flow */}
      {step === "inquiry" && page === "home" && (
        <section className="animate-[fadeIn_0.3s_ease-out]">
          <div className="max-w-lg mx-auto px-4 pt-6 pb-8">
            <button onClick={() => { setStep("category"); pushHistory("category"); }} aria-label="Go back" className="inline-flex items-center gap-2 text-[#00c853] text-sm font-semibold mb-6 px-4 py-2 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 cursor-pointer transition active:scale-95">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
              Back
            </button>
            <h2 className="text-2xl font-bold mb-1">Sell Your {inquiryCategory}</h2>

            {/* Step 1: Device details */}
            {!condition && !inquirySent && (
              <>
                <p className="text-[#888] text-sm mb-6">Tell us about your device, then we&apos;ll walk you through the same quick process.</p>

                {inquiryCategory === "Smartwatch" && (
                  <div className="mb-4">
                    <p className="text-xs font-medium text-[#888] mb-2 uppercase tracking-wider">Select Brand</p>
                    <div className="grid grid-cols-3 gap-2">
                      {["Apple Watch", "Google Pixel Watch", "Garmin"].map((brand) => (
                        <button key={brand} onClick={() => setInquiryDesc(prev => prev.includes(brand) ? prev : brand + (prev ? ' - ' + prev : ''))} className={`p-3 rounded-xl text-xs font-semibold text-center cursor-pointer transition ${inquiryDesc.includes(brand) ? 'bg-[#00c853] text-black' : 'bg-white/5 border border-white/10 text-white hover:bg-white/10'}`}>
                          {brand}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-[#888] mb-1.5 uppercase tracking-wider">Device Details</label>
                    <textarea value={inquiryDesc} onChange={(e) => setInquiryDesc(e.target.value)} required placeholder={`Brand, model, storage size, any issues (e.g. "Samsung Galaxy S24, 256GB, small crack on back")`} rows={3} className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder:text-[#777] focus:outline-none focus:border-[#00c853] focus:ring-4 focus:ring-[#00c853]/10 transition resize-none" />
                  </div>
                  <button
                    onClick={() => { if (inquiryDesc.trim()) { setModel({ id: "custom", label: inquiryDesc.trim(), base: 0 }); } }}
                    disabled={!inquiryDesc.trim()}
                    className="w-full bg-[#00c853] text-white py-4 rounded-2xl text-lg font-semibold cursor-pointer hover:bg-[#00e676] transition active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Next: Select Condition
                  </button>
                </div>
              </>
            )}

            {/* Step 2: Condition selection */}
            {model && !condition && !inquirySent && (
              <>
                <p className="text-[#888] text-sm mb-6">What condition is your device in?</p>
                <div className="space-y-2">
                  {CONDITIONS.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => setCondition(c)}
                      className="w-full flex items-center gap-4 px-4 py-3.5 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-[#00c853]/30 cursor-pointer transition text-left active:scale-[0.98]"
                    >
                      <span className="text-2xl">{c.icon}</span>
                      <div className="flex-1">
                        <p className="font-semibold text-sm">{c.label}</p>
                        <p className="text-[#888] text-xs">{c.desc}</p>
                      </div>
                    </button>
                  ))}
                </div>
                <button onClick={() => setModel(null)} className="mt-4 text-[#888] text-sm cursor-pointer hover:text-white transition">← Change device details</button>
              </>
            )}

            {/* Step 3: Contact + Submit (replaces checkout for custom devices) */}
            {model && condition && !inquirySent && (
              <>
                <p className="text-[#888] text-sm mb-2">Almost done! We&apos;ll review your device and send you a quote.</p>
                <div className="bg-white/5 border border-white/10 rounded-2xl p-4 mb-6">
                  <p className="text-xs text-[#888] uppercase tracking-wider font-medium mb-2">Your device</p>
                  <p className="text-white font-semibold text-sm">{model.label}</p>
                  <p className="text-[#888] text-xs mt-1">Condition: {condition.label} ({condition.desc})</p>
                </div>
                <form onSubmit={async (e) => {
                  e.preventDefault();
                  try {
                    await fetch("/api/lead", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ name, phone, email, device: inquiryCategory, model: model.label, storage: "N/A", condition: condition.label, quote: 0, payout: "TBD", notes: "Custom device - full flow submission" }),
                    });
                  } catch {}
                  setInquirySent(true);
                }} className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-[#888] mb-1.5 uppercase tracking-wider">Name</label>
                    <input type="text" value={name} onChange={(e) => setName(e.target.value)} required placeholder="Your name" className="w-full px-4 py-3.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder:text-[#777] focus:outline-none focus:border-[#00c853] focus:ring-4 focus:ring-[#00c853]/10 transition" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#888] mb-1.5 uppercase tracking-wider">Phone</label>
                    <input type="tel" value={phone} onChange={(e) => {
                      const digits = e.target.value.replace(/\D/g, "").slice(0, 10);
                      if (!digits) { setPhone(""); return; }
                      const isDeleting = e.target.value.length < phone.length;
                      if (isDeleting) { setPhone(digits); return; }
                      if (digits.length >= 6) setPhone(`(${digits.slice(0,3)}) ${digits.slice(3,6)}-${digits.slice(6)}`);
                      else if (digits.length >= 3) setPhone(`(${digits.slice(0,3)}) ${digits.slice(3)}`);
                      else setPhone(digits);
                    }} required placeholder="(512) 555-0000" className="w-full px-4 py-3.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder:text-[#777] focus:outline-none focus:border-[#00c853] focus:ring-4 focus:ring-[#00c853]/10 transition" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#888] mb-1.5 uppercase tracking-wider">Email</label>
                    <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="you@email.com" className="w-full px-4 py-3.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder:text-[#777] focus:outline-none focus:border-[#00c853] focus:ring-4 focus:ring-[#00c853]/10 transition" />
                  </div>
                  <button type="submit" className="w-full bg-[#00c853] text-white py-4 rounded-2xl text-lg font-semibold cursor-pointer hover:bg-[#00e676] transition active:scale-[0.98]">
                    Get My Custom Quote
                  </button>
                </form>
                <button onClick={() => setCondition(null)} className="mt-4 text-[#888] text-sm cursor-pointer hover:text-white transition">← Change condition</button>
              </>
            )}

            {/* Step 4: Confirmation */}
            {inquirySent && (
              <div className="text-center py-8">
                <div className="w-16 h-16 rounded-full bg-[#00c853]/10 flex items-center justify-center mx-auto mb-4">
                  <span className="text-3xl">✅</span>
                </div>
                <h3 className="text-xl font-bold mb-2">Submitted!</h3>
                <p className="text-[#888] text-sm mb-2">We&apos;re reviewing your {inquiryCategory.toLowerCase()} and will send you a personalized quote shortly.</p>
                <p className="text-[#888] text-xs mb-6">Most quotes are sent within a few hours.</p>
                <button onClick={reset} className="text-[#00c853] font-semibold text-sm cursor-pointer hover:underline">
                  Sell another device
                </button>
              </div>
            )}

            <FairPromise />
            <TrustBadge />
          </div>
        </section>
      )}

      {/* STEP: BRAND */}
      {step === "brand" && page === "home" && category && (
        <section className="animate-[fadeIn_0.3s_ease-out]">
          <div className="max-w-lg mx-auto px-4 pt-6 pb-8">
            <button onClick={handleBack} aria-label="Go back" className="inline-flex items-center gap-2 text-[#00c853] text-sm font-semibold mb-6 px-4 py-2 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 cursor-pointer transition active:scale-95">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
              Back
            </button>
            <h2 className="text-2xl font-bold mb-1">Select your brand</h2>
            <p className="text-[#888] text-sm mb-6">{category === "phones" ? "Phone brands" : category === "computers" ? "Computer brands" : "Console brands"}</p>
            <div className="space-y-3">
              {category === "phones" && [
                { id: "iphone" as const, label: "Apple iPhone", sub: "iPhone 11 and newer", icon: "📱" },
                { id: "android" as const, label: "Samsung Galaxy", sub: "Galaxy S21 and newer", icon: "📲" },
              ].map((b) => (
                <button key={b.id} onClick={() => { setDeviceType(b.id); setStep("model"); pushHistory("model"); }} className="w-full flex items-center gap-4 p-5 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-[#00c853]/40 transition cursor-pointer text-left active:scale-[0.98]">
                  <span className="text-3xl">{b.icon}</span>
                  <div className="flex-1"><p className="font-semibold text-white text-lg">{b.label}</p><p className="text-[#888] text-sm">{b.sub}</p></div>
                  <svg className="w-5 h-5 text-[#888]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                </button>
              ))}
              {category === "computers" && [
                { id: "macbook" as const, label: "Apple MacBook", sub: "MacBook Air & Pro, M1+", icon: "💻" },
              ].map((b) => (
                <button key={b.id} onClick={() => { setDeviceType(b.id); setStep("model"); pushHistory("model"); }} className="w-full flex items-center gap-4 p-5 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-[#00c853]/40 transition cursor-pointer text-left active:scale-[0.98]">
                  <span className="text-3xl">{b.icon}</span>
                  <div className="flex-1"><p className="font-semibold text-white text-lg">{b.label}</p><p className="text-[#888] text-sm">{b.sub}</p></div>
                  <svg className="w-5 h-5 text-[#888]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                </button>
              ))}
              {category === "consoles" && (
                <button onClick={() => { setDeviceType("console"); setStep("model"); pushHistory("model"); }} className="w-full flex items-center gap-4 p-5 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-[#00c853]/40 transition cursor-pointer text-left active:scale-[0.98]">
                  <span className="text-3xl">🎮</span>
                  <div className="flex-1"><p className="font-semibold text-white text-lg">Game Consoles</p><p className="text-[#888] text-sm">PlayStation, Xbox, Nintendo</p></div>
                  <svg className="w-5 h-5 text-[#888]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                </button>
              )}
            </div>
          </div>
        </section>
      )}

      {/* STEP: MODEL SELECTION */}
      {step === "model" && page === "home" && (
        <section className="animate-[fadeIn_0.3s_ease-out]">
          <div className="max-w-lg mx-auto px-4 pt-6 pb-8">
            <button onClick={handleBack} aria-label="Go back" className="inline-flex items-center gap-2 text-[#00c853] text-sm font-semibold mb-6 px-4 py-2 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 cursor-pointer transition active:scale-95">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
              Back
            </button>

            {/* iPhone: Series grid → Variant list */}
            {deviceType === "iphone" && !selectedSeries && (
              <>
                <h2 className="text-2xl font-bold mb-1">Select your iPhone</h2>
                <p className="text-[#888] text-sm mb-6">Choose your series</p>
                <div className="grid grid-cols-2 gap-3">
                  {IPHONE_SERIES.map((s) => (
                    <button key={s.id} onClick={() => setSelectedSeries(s.id)} className="flex flex-col items-center justify-center p-4 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-[#00c853]/40 cursor-pointer transition h-[130px] active:scale-[0.97]">
                      {(s as { image?: string }).image && <img src={(s as { image?: string }).image} alt={s.label} loading="lazy" className="w-14 h-14 object-contain mb-1" />}
                      <p className="font-bold text-sm">{s.label}</p>
                      <p className="text-[#00c853] font-bold text-xs mt-0.5">up to ${s.topPrice}</p>
                    </button>
                  ))}
                </div>
              </>
            )}

            {/* iPhone: Variant list (after series selected) */}
            {deviceType === "iphone" && selectedSeries && (
              <>
                <h2 className="text-2xl font-bold mb-1">{IPHONE_SERIES.find(s => s.id === selectedSeries)?.label} Series</h2>
                <p className="text-[#888] text-sm mb-6">Pick your exact model</p>
                <div className="space-y-2">
                  {models.map((m) => (
                    <button key={m.id} onClick={() => { setModel(m); setStep("storage"); pushHistory("storage"); }} className="w-full flex items-center justify-between px-5 py-4 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 cursor-pointer transition text-left active:scale-[0.98]">
                      <p className="font-semibold text-[15px]">{m.label}</p>
                      <div className="flex items-center gap-2">
                        <span className="text-[#00c853] font-bold text-sm">up to ${m.base}</span>
                        <svg className="w-4 h-4 text-[#888]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                      </div>
                    </button>
                  ))}
                </div>
              </>
            )}

            {/* Non-iPhone: Flat model list */}
            {deviceType !== "iphone" && (
              <>
                <h2 className="text-2xl font-bold mb-1">Select your model</h2>
                <p className="text-[#888] text-sm mb-6">Choose your exact device</p>
                <div className="space-y-2">
                  {models.map((m) => (
                    <button key={m.id} onClick={() => { setModel(m); const ns = deviceType === "console" ? "condition" : "storage"; setStep(ns); pushHistory(ns); }} className="w-full flex items-center justify-between px-5 py-4 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 cursor-pointer transition text-left active:scale-[0.98]">
                      <p className="font-semibold text-[15px]">{m.label}</p>
                      <div className="flex items-center gap-2">
                        <span className="text-[#00c853] font-bold text-sm">up to ${m.base}</span>
                        <svg className="w-4 h-4 text-[#888]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                      </div>
                    </button>
                  ))}
                </div>
              </>
            )}
            <FairPromise />
            <TrustBadge />
          </div>
        </section>
      )}

      {/* STEP: STORAGE */}
      {step === "storage" && page === "home" && model && (
        <section className="animate-[fadeIn_0.3s_ease-out]">
          <div className="max-w-lg mx-auto px-4 pt-6 pb-8">
            <button onClick={handleBack} aria-label="Go back" className="inline-flex items-center gap-2 text-[#00c853] text-sm font-semibold mb-6 px-4 py-2 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 cursor-pointer transition active:scale-95">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
              Back
            </button>
            <h2 className="text-2xl font-bold mb-1">Storage capacity?</h2>
            <p className="text-[#888] text-sm mb-6">{model.label}</p>
            <div className="space-y-2">
              {getStoragesForModel(model.id).map((s) => (
                <button
                  key={s.id}
                  onClick={() => { setStorage(s); setStep("condition"); pushHistory("condition"); }}
                  className="w-full flex items-center justify-between px-5 py-4 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 cursor-pointer transition text-left active:scale-[0.98]"
                >
                  <p className="font-semibold text-[15px]">{s.label}</p>
                  <span className="text-[#00c853] font-bold text-sm">up to ${Math.round(model.base * s.multiplier)}</span>
                </button>
              ))}
            </div>
            <FairPromise />
            <TrustBadge />
          </div>
        </section>
      )}

      {/* STEP: CONDITION */}
      {step === "condition" && page === "home" && model && (
        <section className="animate-[fadeIn_0.3s_ease-out]">
          <div className="max-w-lg mx-auto px-4 pt-6 pb-8">
            <button onClick={handleBack} aria-label="Go back" className="inline-flex items-center gap-2 text-[#00c853] text-sm font-semibold mb-6 px-4 py-2 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 cursor-pointer transition active:scale-95">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
              Back
            </button>
            <h2 className="text-2xl font-bold mb-1">Select Condition</h2>
            <p className="text-[#888] text-sm mb-2">{model.label}</p>
            <button className="text-[#00c853] text-xs font-medium mb-4 cursor-pointer hover:underline" onClick={() => { const el = document.getElementById('condition-guide'); if (el) el.style.display = el.style.display === 'none' ? 'block' : 'none'; }}>How to assess condition</button>
            <div id="condition-guide" style={{ display: 'none' }} className="bg-white/5 border border-white/10 rounded-2xl p-4 mb-4 text-xs text-[#aaa] space-y-2">
              <p><strong className="text-white">Brand New:</strong> Sealed in original packaging, never opened</p>
              <p><strong className="text-white">Flawless:</strong> Opened but looks brand new — zero scratches, scuffs, or marks</p>
              <p><strong className="text-white">Very Good:</strong> Minimal signs of use, no scratches visible at arm&apos;s length</p>
              <p><strong className="text-white">Good:</strong> Light scratches on screen or body, fully functional</p>
              <p><strong className="text-white">Fair:</strong> Noticeable wear — scuffs, dents, or cosmetic damage</p>
              <p><strong className="text-white">Broken:</strong> Cracked screen, water damage, or not fully functional</p>
            </div>
            <div className="space-y-3">
              {CONDITIONS.map((c) => (
                <button
                  key={c.id}
                  onClick={(e) => {
                    if ((e.target as HTMLElement).closest('details') || (e.target as HTMLElement).closest('summary')) return;
                    setCondition(c); const cs = (deviceType === "iphone" || deviceType === "android") ? "carrier" : "quote"; if (cs === "quote") { setShowConfetti(true); setTimeout(() => setShowConfetti(false), 3000); } setStep(cs); pushHistory(cs);
                  }}
                  className="group w-full flex items-center gap-4 p-5 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 cursor-pointer transition text-left active:scale-[0.98]"
                >
                  <span className="text-2xl">{c.icon}</span>
                  <div className="flex-1">
                    <p className="font-semibold text-lg">{c.label}</p>
                    <p className="text-[#888] text-sm">{c.desc}</p>
                    {(c as { details?: string[] }).details && (
                      <details className="mt-2">
                        <summary className="text-[#00c853] text-xs cursor-pointer hover:underline">ℹ️ What qualifies?</summary>
                        <ul className="mt-1.5 space-y-1 text-[#999] text-xs list-disc list-inside">
                          {(c as { details?: string[] }).details!.map((d, i) => <li key={i}>{d}</li>)}
                        </ul>
                      </details>
                    )}
                  </div>
                  <span className="text-[#00c853] font-bold text-sm">${Math.round(model.base * storageMultiplier * c.multiplier)}</span>
                </button>
              ))}
            </div>

            <div className="mt-6 bg-white/5 border border-white/10 rounded-2xl p-5">
              <h3 className="text-sm font-bold text-[#00c853] uppercase tracking-wider mb-1">Our Promise</h3>
              <p className="text-base font-bold text-white mb-1">The Top Cash Guarantee</p>
              <p className="text-[#888] text-xs mb-4">Concerned about quote adjustments? Here&apos;s how we handle inspections.</p>
              <div className="space-y-3">
                <div className="flex gap-3">
                  <span className="text-lg">🎯</span>
                  <div><p className="text-sm font-semibold text-[#ccc]">Transparent Pricing</p><p className="text-xs text-[#888]">What you see is what you get. Your quote is based on the condition you select — no surprise deductions.</p></div>
                </div>
                <div className="flex gap-3">
                  <span className="text-lg">🤝</span>
                  <div><p className="text-sm font-semibold text-[#ccc]">Honest Inspections</p><p className="text-xs text-[#888]">If anything differs from your description, we&apos;ll walk you through our findings before adjusting.</p></div>
                </div>
                <div className="flex gap-3">
                  <span className="text-lg">🔄</span>
                  <div><p className="text-sm font-semibold text-[#ccc]">No Pressure, No Strings</p><p className="text-xs text-[#888]">Not happy with the final offer? We&apos;ll return your device — no questions asked.</p></div>
                </div>
              </div>
            </div>

            <div className="mt-4 bg-white/5 border border-white/10 rounded-2xl p-5">
              <h3 className="text-base font-bold text-white mb-3">Why Sellers Choose Top Cash</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="text-center p-3 bg-white/5 rounded-xl">
                  <p className="text-xl font-bold text-[#00c853]">⭐</p>
                  <p className="text-xs text-[#888] mt-1">Thousands of happy sellers</p>
                </div>
                <div className="text-center p-3 bg-white/5 rounded-xl">
                  <p className="text-xl font-bold text-[#00c853]">⚡</p>
                  <p className="text-xs text-[#888] mt-1">Get paid the same day</p>
                </div>
                <div className="text-center p-3 bg-white/5 rounded-xl">
                  <p className="text-xl font-bold text-[#00c853]">🔒</p>
                  <p className="text-xs text-[#888] mt-1">Your price is locked 7 days</p>
                </div>
                <div className="text-center p-3 bg-white/5 rounded-xl">
                  <p className="text-xl font-bold text-[#00c853]">🏠</p>
                  <p className="text-xs text-[#888] mt-1">We meet locally in Austin</p>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* STEP: CARRIER */}
      {step === "carrier" && page === "home" && model && condition && (
        <section className="animate-[fadeIn_0.3s_ease-out]">
          <div className="max-w-lg mx-auto px-4 pt-6 pb-8">
            <button onClick={handleBack} aria-label="Go back" className="inline-flex items-center gap-2 text-[#00c853] text-sm font-semibold mb-6 px-4 py-2 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 cursor-pointer transition active:scale-95">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
              Back
            </button>
            <h2 className="text-2xl font-bold mb-1">Carrier status?</h2>
            <p className="text-[#888] text-sm mb-6">Is your phone unlocked or locked to a carrier?</p>
            <div className="space-y-2">
              {CARRIERS.map((c) => (
                <button
                  key={c.id}
                  onClick={() => { setCarrier(c); setShowConfetti(true); setTimeout(() => setShowConfetti(false), 3000); setStep("quote"); pushHistory("quote"); }}
                  className="w-full flex items-center gap-4 px-5 py-4 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 cursor-pointer transition text-left active:scale-[0.98]"
                >
                  <span className="text-xl">{c.icon}</span>
                  <p className="font-semibold text-[15px] flex-1">{c.label}</p>
                  {c.id === "unlocked" && <span className="text-[#00c853] text-xs font-medium">Best value</span>}
                </button>
              ))}
            </div>
            <TrustBadge />
          </div>
        </section>
      )}

      {/* STEP: QUOTE */}
      {step === "quote" && page === "home" && model && condition && (
        <section className="animate-[fadeIn_0.3s_ease-out] relative">
          {showConfetti && (
            <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
              {Array.from({ length: 60 }).map((_, i) => (
                <div key={i} className="absolute animate-[confettiFall_2.5s_ease-out_forwards]" style={{
                  left: `${Math.random() * 100}%`,
                  top: `-5%`,
                  animationDelay: `${Math.random() * 0.8}s`,
                  width: `${8 + Math.random() * 8}px`,
                  height: `${8 + Math.random() * 8}px`,
                  background: ['#00c853','#00e676','#fff','#76ff03','#ffd600','#ff6d00'][Math.floor(Math.random() * 6)],
                  borderRadius: Math.random() > 0.5 ? '50%' : '2px',
                  transform: `rotate(${Math.random() * 360}deg)`,
                }} />
              ))}
            </div>
          )}
          <div className="max-w-lg mx-auto px-4 pt-12 pb-8 text-center">
            <div className="flex items-center justify-center gap-5 mb-2">
              {(() => {
                const imgMap: Record<string, string> = { ip17e: "/iphone17e.png", ip17pm: "/iphone17.png", ip17p: "/iphone17.png", ip17air: "/iphone17air.png", ip17plus: "/iphone17plus.png", ip17: "/iphone17base.png", ip16pm: "/iphone16.png", ip16p: "/iphone16.png", ip16plus: "/iphone16plus.png", ip16: "/iphone16base.png", ip16e: "/iphone16e.png", ip15pm: "/iphone15.png", ip15p: "/iphone15.png", ip15plus: "/iphone15.png", ip15: "/iphone15base.png", ip14pm: "/iphone14.png", ip14p: "/iphone14.png", ip14plus: "/iphone14plus.png", ip14: "/iphone14base.png", ip13pm: "/iphone13.png", ip13p: "/iphone13.png", ip13: "/iphone13base.png", ip12pm: "/iphone12.png", ip12: "/iphone12base.png", ip12mini: "/iphone12mini.png", ip11pm: "/iphone11.png", ip11: "/iphone11base.png" };
                const isTablet = deviceType === "ipad";
                const fallbackImg = isTablet ? "/ipad.png" : null;
                const src = imgMap[model.id] || fallbackImg;
                const sizeClass = isTablet ? "w-28 h-28" : "w-20 h-20";
                return src ? <img src={src} alt={model.label} className={`${sizeClass} object-contain`} /> : null;
              })()}
              <div>
                <p className="text-[#888] text-sm font-medium">{model.label} · {storage?.label} · {condition.label}</p>
                <p className="text-5xl font-bold text-[#00c853] mt-1">${quote * quantity}</p>
              </div>
            </div>
            {quantity > 1 && <p className="text-[#888] text-sm mb-2">${quote} each × {quantity}</p>}
            {quantity === 1 && <div className="mb-3" />}

            <div className="flex items-center justify-center gap-3 mb-4">
              <span className="text-[#888] text-sm">Quantity:</span>
              <div className="flex items-center bg-white/5 border border-white/10 rounded-xl overflow-hidden">
                <button onClick={() => setQuantity(Math.max(1, quantity - 1))} className="px-3 py-2 text-white hover:bg-white/10 transition cursor-pointer text-lg font-bold">−</button>
                <span className="px-4 py-2 text-white font-semibold text-sm min-w-[2rem] text-center">{quantity}</span>
                <button onClick={() => setQuantity(Math.min(10, quantity + 1))} className="px-3 py-2 text-white hover:bg-white/10 transition cursor-pointer text-lg font-bold">+</button>
              </div>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-2xl p-4 mb-6 text-left">
              <p className="text-xs font-semibold text-[#888] uppercase tracking-wider mb-3">How we compare</p>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-[#00c853]">Top Cash Cellular</span>
                  <span className="text-lg font-bold text-[#00c853]">${quote * quantity}</span>
                </div>
                <div className="flex items-center justify-between text-[#888]">
                  <span className="text-sm">Apple Trade-In</span>
                  <span className="text-sm">${Math.round(quote * 0.62 * quantity)}</span>
                </div>
                <div className="flex items-center justify-between text-[#888]">
                  <span className="text-sm">Carrier Trade-In</span>
                  <span className="text-sm">${Math.round(quote * 0.7 * quantity)}</span>
                </div>
              </div>
              <p className="text-[#00c853] text-xs font-semibold mt-3">You make up to ${(quote - Math.round(quote * 0.62)) * quantity} more with us</p>
            </div>

            <div className="flex items-center justify-center gap-2 mb-4">
              <svg className="w-4 h-4 text-[#00c853]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
              <p className="text-[#00c853] text-sm font-semibold">Price locked for 7 days</p>
            </div>

            <div className="flex gap-3">
              <button onClick={handleBack} className="flex-1 bg-white/10 text-white py-4 rounded-2xl text-lg font-semibold cursor-pointer hover:bg-white/15 transition active:scale-[0.98]">
                Back
              </button>
              <button
                onClick={() => {
                  if (model && condition) {
                    setCartItems(prev => {
                      const key = `${model.id}-${storage?.label || ''}-${condition.label}`;
                      const existing = prev.find(i => `${i.modelId}-${i.storage}-${i.condition}` === key);
                      if (existing) return prev.map(i => `${i.modelId}-${i.storage}-${i.condition}` === key ? { ...i, quantity: i.quantity + quantity } : i);
                      return [...prev, { model: model.label, modelId: model.id, storage: storage?.label || 'N/A', condition: condition.label, price: quote, quantity }];
                    });
                  }
                  setStep("checkout"); pushHistory("checkout");
                }}
                className="flex-[2] bg-[#00c853] text-white py-4 rounded-2xl text-lg font-semibold cursor-pointer hover:bg-[#00e676] transition active:scale-[0.98]"
              >
                Add to Cart
              </button>
            </div>

            <div className="mt-6 space-y-3 text-left">
              <div className="flex items-center gap-3"><span className="text-lg">💰</span><span className="text-sm text-[#ccc]">No selling fees</span></div>
              <div className="flex items-center gap-3"><span className="text-lg">🛡️</span><span className="text-sm text-[#ccc]">Zero fraud risk</span></div>
              <div className="flex items-center gap-3"><span className="text-lg">📦</span><span className="text-sm text-[#ccc]">Free shipping via FedEx or UPS</span></div>
              <div className="flex items-center gap-3"><span className="text-lg">⚡</span><span className="text-sm text-[#ccc]">Same-day pickup &amp; 24-hour processing</span></div>
              <div className="flex items-center gap-3"><span className="text-lg">💳</span><span className="text-sm text-[#ccc]">Cash, Venmo, Zelle, or PayPal</span></div>
            </div>

            <div className="mt-6 bg-white/5 border border-white/10 rounded-2xl p-5 text-left">
              <h3 className="text-base font-bold text-white mb-1">The Top Cash Guarantee</h3>
              <p className="text-[#888] text-xs mb-4">Your device, your terms. Here&apos;s what we stand behind.</p>
              <div className="space-y-4">
                <div>
                  <p className="text-sm font-semibold text-[#ccc]">🎯 Transparent Pricing</p>
                  <p className="text-xs text-[#888] mt-1">What you see is what you get. No surprise deductions, no bait-and-switch. Your quote is based on the condition you select.</p>
                </div>
                <div>
                  <p className="text-sm font-semibold text-[#ccc]">🤝 Honest Inspections</p>
                  <p className="text-xs text-[#888] mt-1">If anything differs from your description, we&apos;ll walk you through our findings before adjusting — no silent changes.</p>
                </div>
                <div>
                  <p className="text-sm font-semibold text-[#ccc]">🔄 No Pressure, No Strings</p>
                  <p className="text-xs text-[#888] mt-1">Changed your mind? Not happy with the final offer? We&apos;ll return your device — no questions asked.</p>
                </div>
                <div>
                  <p className="text-sm font-semibold text-[#ccc]">⚡ Same-Day Payout</p>
                  <p className="text-xs text-[#888] mt-1">Austin local? Get paid on the spot. Cash, Venmo, Zelle, or PayPal — your call.</p>
                </div>
              </div>
            </div>

            <div className="mt-6 bg-white/5 border border-white/10 rounded-2xl p-5 text-left">
              <h3 className="text-base font-bold text-white mb-4">Why Sellers Choose Top Cash</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center p-3 bg-white/5 rounded-xl">
                  <p className="text-2xl">⭐</p>
                  <p className="text-xs text-[#888] mt-1">Thousands of happy sellers</p>
                </div>
                <div className="text-center p-3 bg-white/5 rounded-xl">
                  <p className="text-2xl">⚡</p>
                  <p className="text-xs text-[#888] mt-1">Get paid the same day</p>
                </div>
                <div className="text-center p-3 bg-white/5 rounded-xl">
                  <p className="text-2xl">🔒</p>
                  <p className="text-xs text-[#888] mt-1">Your price is locked 7 days</p>
                </div>
                <div className="text-center p-3 bg-white/5 rounded-xl">
                  <p className="text-2xl">🏠</p>
                  <p className="text-xs text-[#888] mt-1">We meet locally in Austin</p>
                </div>
              </div>
              <div className="mt-4 text-center">
                <p className="text-xs text-[#888]">Trusted by Austin sellers</p>
              </div>
            </div>

            {!quoteSaved ? (
              <div className="mt-5 bg-white/5 border border-white/10 rounded-2xl p-4">
                <p className="text-[#888] text-xs font-medium mb-3">Not ready yet? Save this quote for later.</p>
                <div className="flex gap-2">
                  <input type="email" value={quoteEmail} onChange={(e) => setQuoteEmail(e.target.value)} placeholder="your@email.com" aria-label="Email for quote" className="flex-1 px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder:text-[#777] focus:outline-none focus:border-[#00c853] transition" />
                  <button onClick={async () => {
                    if (!quoteEmail) return;
                    try { await fetch("/api/lead", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "", phone: "", email: quoteEmail, device: deviceType, model: model?.label, storage: storage?.label, condition: condition?.label, quote, payout: "TBD" }) }); } catch {}
                    setQuoteSaved(true);
                  }} className="bg-white/10 text-white px-4 py-2.5 rounded-xl text-sm font-semibold cursor-pointer hover:bg-white/15 transition active:scale-95">
                    Save
                  </button>
                </div>
              </div>
            ) : (
              <p className="mt-5 text-[#00c853] text-sm font-medium">Quote saved! Check your inbox.</p>
            )}

            <button onClick={reset} className="mt-4 text-[#888] text-sm cursor-pointer hover:text-white transition">
              Start new quote
            </button>
          </div>
        </section>
      )}

      {/* STEP: CHECKOUT (email capture) */}
      {step === "checkout" && page === "home" && model && condition && (
        <section className="animate-[fadeIn_0.3s_ease-out]">
          <div className="max-w-lg mx-auto px-4 pt-6 pb-8">
            <button onClick={handleBack} aria-label="Go back" className="inline-flex items-center gap-2 text-[#00c853] text-sm font-semibold mb-6 px-4 py-2 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 cursor-pointer transition active:scale-95">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
              Back
            </button>

            <div className="bg-white/5 border border-white/10 rounded-2xl p-4 mb-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-sm">{model.label}</p>
                  <p className="text-[#888] text-xs">{storage?.label} · {condition.label}{quantity > 1 ? ` · ×${quantity}` : ''}</p>
                </div>
                <p className="text-[#00c853] font-bold text-xl">${quote * quantity}</p>
              </div>
            </div>

            <h2 className="text-2xl font-bold mb-1">Checkout</h2>

            {/* SECTION 1: ACCOUNT */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-5 mb-4">
              <h3 className="text-sm font-bold text-[#00c853] uppercase tracking-wider mb-1">Account</h3>
              <p className="text-[#888] text-sm mb-4">You&apos;re one step away from getting paid.</p>

              {/* Guest Checkout */}
              <p className="text-xs font-semibold text-[#888] uppercase tracking-wider mb-2">Guest Checkout</p>
              <form onSubmit={(e) => {
                e.preventDefault();
                if (!email) return;
                fetch("/api/lead", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "Guest", phone: "", email, device: deviceType, model: model?.label, storage: storage?.label, condition: condition?.label, quote: quote * quantity, payout: "TBD", quantity }) }).catch(() => {});
                setStep("payout"); pushHistory("payout");
              }} className="space-y-3 mb-4">
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="Email" className="w-full px-4 py-3.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder:text-[#777] focus:outline-none focus:border-[#00c853] focus:ring-4 focus:ring-[#00c853]/10 transition" />
                <button type="submit" className="w-full bg-[#00c853] text-white py-4 rounded-2xl text-base font-semibold cursor-pointer hover:bg-[#00e676] transition active:scale-[0.98]">Continue As Guest</button>
              </form>

              <div className="flex items-center gap-3 my-3"><div className="flex-1 h-px bg-white/10" /><span className="text-[#777] text-xs">or</span><div className="flex-1 h-px bg-white/10" /></div>

              {/* Customer Login */}
              <p className="text-xs font-semibold text-[#888] uppercase tracking-wider mb-2">Customer Login</p>
              <form onSubmit={(e) => {
                e.preventDefault();
                if (!email) return;
                fetch("/api/lead", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "Returning User", phone: "", email, device: deviceType, model: model?.label, storage: storage?.label, condition: condition?.label, quote: quote * quantity, payout: "TBD", quantity }) }).catch(() => {});
                setStep("payout"); pushHistory("payout");
              }} className="space-y-3 mb-2">
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="Email" className="w-full px-4 py-3.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder:text-[#777] focus:outline-none focus:border-[#00c853] focus:ring-4 focus:ring-[#00c853]/10 transition" />
                <input type="password" placeholder="Password" className="w-full px-4 py-3.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder:text-[#777] focus:outline-none focus:border-[#00c853] focus:ring-4 focus:ring-[#00c853]/10 transition" />
                <button type="button" className="text-[#00c853] text-xs cursor-pointer hover:underline">Forgot Your Password?</button>
                <button type="submit" className="w-full bg-white/10 text-white py-4 rounded-2xl text-base font-semibold cursor-pointer hover:bg-white/15 transition active:scale-[0.98]">Login</button>
              </form>

              <p className="text-center text-[#777] text-xs my-2">Create An Account</p>

              <div className="flex items-center gap-3 my-3"><div className="flex-1 h-px bg-white/10" /><span className="text-[#777] text-xs">or</span><div className="flex-1 h-px bg-white/10" /></div>

              {/* Continue with Google */}
              <button
                onClick={() => {
                  if (!email) return;
                  fetch("/api/lead", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "Google User", phone: "", email, device: deviceType, model: model?.label, storage: storage?.label, condition: condition?.label, quote: quote * quantity, payout: "TBD", quantity }) }).catch(() => {});
                  setStep("payout"); pushHistory("payout");
                }}
                className="w-full flex items-center justify-center gap-3 bg-white/5 border border-white/10 text-white py-4 rounded-2xl text-base font-semibold cursor-pointer hover:bg-white/10 transition active:scale-[0.98]"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
                Continue With Google
              </button>
            </div>

            {/* SECTION 2: PAYMENT */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-5 mb-4">
              <h3 className="text-sm font-bold text-[#00c853] uppercase tracking-wider mb-2">Payment</h3>
              <p className="text-[#888] text-xs">Select your payout method after completing account setup.</p>
            </div>

            {/* SECTION 3: SHIPPING */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-5 mb-4">
              <h3 className="text-sm font-bold text-[#00c853] uppercase tracking-wider mb-2">Shipping</h3>
              <p className="text-[#888] text-xs">Austin local? We meet locally! Or reply for a free prepaid shipping label.</p>
            </div>

            {/* SECTION 4: OPTIONS & TERMS */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-5 mb-4">
              <h3 className="text-sm font-bold text-[#00c853] uppercase tracking-wider mb-2">Options &amp; Terms</h3>
              <p className="text-[#888] text-xs">By proceeding, you agree that the quoted price is an estimate. Final offer confirmed at inspection based on device condition.</p>
            </div>
          </div>
        </section>
      )}

      {/* STEP: PAYOUT METHOD */}
      {step === "payout" && page === "home" && (
        <section className="animate-[fadeIn_0.3s_ease-out]">
          <div className="max-w-lg mx-auto px-4 pt-6 pb-8">
            <button onClick={handleBack} aria-label="Go back" className="inline-flex items-center gap-2 text-[#00c853] text-sm font-semibold mb-6 px-4 py-2 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 cursor-pointer transition active:scale-95">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
              Back
            </button>
            <div className="bg-white/5 border border-white/10 rounded-2xl p-4 mb-6">
              <p className="text-xs font-semibold text-[#888] uppercase tracking-wider mb-2">Your Cart</p>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-sm">{model?.label}</p>
                  <p className="text-[#888] text-xs">{storage?.label} · {condition?.label}{quantity > 1 ? ` · ×${quantity}` : ''}</p>
                </div>
                <p className="text-[#00c853] font-bold text-xl">${quote * quantity}</p>
              </div>
            </div>
            <h2 className="text-2xl font-bold mb-1">How would you like to get paid?</h2>
            <p className="text-[#888] text-sm mb-6">Select your preferred payout method</p>
            <div className="grid grid-cols-2 gap-3">
              {PAYOUTS.map((p) => (
                <button
                  key={p.id}
                  onClick={() => { setPayout(p); setStep("contact"); pushHistory("contact"); }}
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
      {step === "contact" && page === "home" && model && condition && payout && (
        <section className="animate-[fadeIn_0.3s_ease-out]">
          <div className="max-w-lg mx-auto px-4 pt-6 pb-8">
            <button onClick={handleBack} aria-label="Go back" className="inline-flex items-center gap-2 text-[#00c853] text-sm font-semibold mb-6 px-4 py-2 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 cursor-pointer transition active:scale-95">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
              Back
            </button>

            <div className="bg-white/5 border border-white/10 rounded-2xl p-5 mb-6">
              <div className="flex items-center justify-between mb-2">
                <p className="font-semibold">{model.label}</p>
                <p className="text-[#00c853] font-bold text-xl">${quote * quantity}</p>
              </div>
              <p className="text-[#888] text-sm">{storage?.label} · {condition.label} · {payout.label}{quantity > 1 ? ` · ×${quantity}` : ''}</p>
            </div>

            <h2 className="text-xl font-bold mb-1">Almost done</h2>
            <p className="text-[#888] text-sm mb-6">We&apos;ll contact you to arrange pickup &amp; payment</p>

            <form onSubmit={async (e) => {
              e.preventDefault();
              try {
                const res = await fetch("/api/lead", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ name, phone, email, device: deviceType, model: model?.label, storage: storage?.label, condition: condition?.label, quote: quote * quantity, payout: payout?.label, quantity }),
                });
                if (!res.ok) throw new Error('Failed');
                if (email || phone) {
                  fetch("/api/confirm", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ name, phone, email, model: model?.label, storage: storage?.label, condition: condition?.label, quote: quote * quantity, payout: payout?.label, quantity }),
                  }).catch(() => {});
                }
                localStorage.removeItem("tcc-session"); setStep("done"); pushHistory("done");
              } catch { alert("Something went wrong. Please try again or call us directly."); }
            }} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-[#888] mb-1.5 uppercase tracking-wider">Name</label>
                <input type="text" value={name} onChange={(e) => setName(e.target.value)} required minLength={2} maxLength={50} placeholder="Your name" className="w-full px-4 py-3.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder:text-[#777] focus:outline-none focus:border-[#00c853] focus:ring-4 focus:ring-[#00c853]/10 transition" />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#888] mb-1.5 uppercase tracking-wider">Phone</label>
                <input type="tel" value={phone} onChange={(e) => {
                  const digits = e.target.value.replace(/\D/g, "").slice(0, 10);
                  if (digits.length >= 6) setPhone(`(${digits.slice(0,3)}) ${digits.slice(3,6)}-${digits.slice(6)}`);
                  else if (digits.length >= 3) setPhone(`(${digits.slice(0,3)}) ${digits.slice(3)}`);
                  else setPhone(digits);
                }} required pattern="\(\d{3}\) \d{3}-\d{4}" placeholder="(512) 555-0000" className="w-full px-4 py-3.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder:text-[#777] focus:outline-none focus:border-[#00c853] focus:ring-4 focus:ring-[#00c853]/10 transition" />
              </div>
              {email && <p className="text-[#888] text-xs">Email: {email}</p>}
              <div>
                <label className="block text-xs font-medium text-[#888] mb-1.5 uppercase tracking-wider">Device Photo <span className="normal-case text-[12px]">(optional — speeds up payout)</span></label>
                {!devicePhoto ? (
                  <label className="flex flex-col items-center justify-center w-full h-28 bg-white/5 border-2 border-dashed border-white/15 rounded-xl cursor-pointer hover:bg-white/10 hover:border-[#00c853]/30 transition">
                    <svg className="w-8 h-8 text-[#777] mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                    <span className="text-[#777] text-xs">Tap to add a photo</span>
                    <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        if (file.size > 10 * 1024 * 1024) { alert("Photo must be under 10MB"); e.target.value = ""; return; }
                        const reader = new FileReader();
                        reader.onload = () => setDevicePhoto(reader.result as string);
                        reader.readAsDataURL(file);
                      }
                    }} />
                  </label>
                ) : (
                  <div className="relative">
                    <img src={devicePhoto} alt="Device" className="w-full h-28 object-cover rounded-xl" />
                    <button type="button" onClick={() => setDevicePhoto(null)} aria-label="Remove photo" className="absolute top-2 right-2 w-6 h-6 rounded-full bg-black/60 text-white text-xs flex items-center justify-center cursor-pointer hover:bg-black/80">x</button>
                  </div>
                )}
              </div>
              <p className="text-[#666] text-[11px] text-center leading-relaxed">By submitting, you agree that the quoted price is an estimate. Final offer confirmed at inspection based on device condition.</p>
              <button type="submit" className="w-full bg-[#00c853] text-white py-4 rounded-2xl text-base font-semibold cursor-pointer hover:bg-[#00e676] transition active:scale-[0.98]">
                Submit &amp; Get Paid
              </button>
            </form>
          </div>
        </section>
      )}

      {/* STEP: DONE */}
      {step === "done" && page === "home" && model && condition && payout && (
        <section className="animate-[fadeIn_0.3s_ease-out]">
          <div className="max-w-lg mx-auto px-4 pt-10 pb-8">
            <div className="text-center mb-6">
              <div className="w-20 h-20 rounded-full bg-[#00c853]/10 flex items-center justify-center mx-auto mb-4">
                <span className="text-4xl">✅</span>
              </div>
              <h2 className="text-2xl font-bold mb-1">Okay, I sold! Now what?</h2>
              <p className="text-[#888] text-sm">We&apos;ll contact you within the hour. Here&apos;s your summary:</p>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-2xl p-5 mb-6 text-left">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="font-semibold">{model.label}</p>
                  <p className="text-[#888] text-xs">{storage?.label} · {condition.label} · {payout.label}{quantity > 1 ? ` · ×${quantity}` : ''}</p>
                </div>
                <p className="text-[#00c853] font-bold text-2xl">${quote * quantity}</p>
              </div>
              <div className="border-t border-white/10 pt-3 text-sm text-[#888]">
                <p>{name} · {phone}{email ? ` · ${email}` : ''}</p>
              </div>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-2xl p-4 mb-6 text-center">
              <p className="text-[#888] text-sm">📦 Need to ship? You&apos;ll receive an email with shipping instructions shortly.</p>
            </div>

            <div className="bg-[#00c853]/10 border border-[#00c853]/20 rounded-2xl p-4 mb-6 text-center">
              <p className="text-[#00c853] font-semibold text-sm">🏠 Austin local? We meet locally — no shipping needed!</p>
            </div>

            <div className="text-center">
              <button onClick={reset} className="text-[#00c853] font-semibold text-sm cursor-pointer hover:underline">
                Sell another device
              </button>
            </div>
          </div>
        </section>
      )}

      {/* TRUST + TESTIMONIALS + FAQ (only on home) */}
      {step === "device" && page === "home" && (
        <>
          {/* HOW IT WORKS — Visual persona example */}
          <section className="py-12 bg-[#0d0d0d]">
            <div className="max-w-lg mx-auto px-4">
              <h2 className="text-xl font-bold text-center mb-2">Get your instant quote</h2>
              <p className="text-[#888] text-sm text-center mb-8">Select your device and condition, and get your offer before you say &ldquo;goodbye, clutter&rdquo;</p>

              <div className="bg-white/5 border border-white/10 rounded-2xl p-6 mb-8">
                <p className="text-[#888] text-xs font-medium mb-4 uppercase tracking-wider">Jenny wants to sell her iPhone</p>
                <div className="grid grid-cols-3 gap-4 mb-5">
                  <div className="text-center">
                    <div className="w-12 h-12 rounded-full bg-[#00c853]/15 flex items-center justify-center mx-auto mb-2">
                      <span className="text-xl">📱</span>
                    </div>
                    <p className="text-[#888] text-[11px] uppercase tracking-wider font-medium">Device</p>
                    <p className="text-white text-sm font-bold">iPhone 13</p>
                  </div>
                  <div className="text-center">
                    <div className="w-12 h-12 rounded-full bg-[#00c853]/15 flex items-center justify-center mx-auto mb-2">
                      <span className="text-xl">✨</span>
                    </div>
                    <p className="text-[#888] text-[11px] uppercase tracking-wider font-medium">Condition</p>
                    <p className="text-white text-sm font-bold">Good</p>
                  </div>
                  <div className="text-center">
                    <div className="w-12 h-12 rounded-full bg-[#00c853]/15 flex items-center justify-center mx-auto mb-2">
                      <span className="text-xl">💰</span>
                    </div>
                    <p className="text-[#888] text-[11px] uppercase tracking-wider font-medium">Offer</p>
                    <p className="text-[#00c853] text-sm font-bold">$190.00</p>
                  </div>
                </div>
                <div className="flex items-center justify-between bg-[#00c853]/10 border border-[#00c853]/20 rounded-xl px-4 py-3">
                  <span className="text-white text-sm font-semibold">Jenny&apos;s payout</span>
                  <span className="text-[#00c853] text-lg font-bold">$190.00</span>
                </div>
              </div>

              <div className="flex items-center justify-center gap-3 mb-2">
                {["Device", "Condition", "Offer"].map((label, i) => (
                  <div key={label} className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-[#00c853] flex items-center justify-center text-white text-xs font-bold">{i + 1}</div>
                      <span className="text-white text-xs font-semibold">{label}</span>
                    </div>
                    {i < 2 && <svg className="w-4 h-4 text-[#777]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>}
                  </div>
                ))}
              </div>
              <p className="text-[#777] text-xs text-center">3 steps. 30 seconds. Done.</p>
            </div>
          </section>

          {/* SHIP TO US */}
          <section className="py-12 bg-[#0a0a0a]">
            <div className="max-w-lg mx-auto px-4">
              <h2 className="text-xl font-bold text-center mb-2">Not in Austin? Ship to us</h2>
              <p className="text-[#888] text-sm text-center mb-8">Mail your device from anywhere in the US. We pay shipping.</p>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { num: "1", icon: "📦", title: "Pack", desc: "We send you a free prepaid shipping label" },
                  { num: "2", icon: "✈️", title: "Ship", desc: "Drop it off at any USPS or UPS location" },
                  { num: "3", icon: "💸", title: "Get Paid", desc: "Payment sent same day we receive it" },
                ].map((s) => (
                  <div key={s.num} className="bg-white/5 border border-white/10 rounded-2xl p-4 text-center">
                    <div className="w-10 h-10 rounded-full bg-[#00c853]/15 flex items-center justify-center mx-auto mb-2">
                      <span className="text-lg">{s.icon}</span>
                    </div>
                    <p className="text-white text-sm font-bold mb-1">{s.title}</p>
                    <p className="text-[#888] text-[11px] leading-relaxed">{s.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* BOLD STATS COUNTER */}
          <section className="py-14 bg-[#111]" ref={(el) => { if (el && !statsVisible) { const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setStatsVisible(true); obs.disconnect(); } }, { threshold: 0.3 }); obs.observe(el); } }}>
            <div className="max-w-lg mx-auto px-4">
              <p className="text-[#888] text-xs font-semibold uppercase tracking-wider text-center mb-8">Top Cash Cellular by the numbers</p>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-white/5 border border-white/10 rounded-2xl p-3 overflow-hidden">
                  <p className="text-2xl font-extrabold text-[#00c853] tabular-nums">{animatedStats.devices}+</p>
                  <p className="text-white text-xs font-semibold mt-1">Devices Bought</p>
                  <p className="text-[#888] text-[10px] mt-0.5">and counting</p>
                </div>
                <div className="bg-white/5 border border-white/10 rounded-2xl p-3 overflow-hidden">
                  <p className="text-2xl font-extrabold text-[#00c853] tabular-nums">${animatedStats.payout}K+</p>
                  <p className="text-white text-xs font-semibold mt-1">Paid Out</p>
                  <p className="text-[#888] text-[10px] mt-0.5">to Austin sellers</p>
                </div>
                <div className="bg-white/5 border border-white/10 rounded-2xl p-3 overflow-hidden">
                  <p className="text-2xl font-extrabold text-[#00c853] tabular-nums">&lt;{animatedStats.time}h</p>
                  <p className="text-white text-xs font-semibold mt-1">Avg Payout</p>
                  <p className="text-[#888] text-[10px] mt-0.5">from quote to cash</p>
                </div>
              </div>
            </div>
          </section>

          {/* TESTIMONIALS */}
          <section className="py-10 overflow-hidden bg-[#0a0a0a]">
            <p className="text-white font-semibold text-lg text-center mb-6">What sellers say</p>
            <div className="relative">
              <div className="flex animate-[marquee_25s_linear_infinite] gap-4 w-max">
                {[
                  { text: "Got $420 for my iPhone 14 Pro. Way more than the Apple trade-in.", name: "Mike R." },
                  { text: "Venmo payment hit my account same day. Super smooth.", name: "Ashley T." },
                  { text: "They came to me and paid cash on the spot. Can't beat that.", name: "David L." },
                  { text: "Sold my old Galaxy S23 in 5 minutes. Easy money.", name: "Sarah K." },
                  { text: "Best price I found anywhere in Austin. Highly recommend.", name: "Chris M." },
                  { text: "Got $420 for my iPhone 14 Pro. Way more than the Apple trade-in.", name: "Mike R." },
                  { text: "Venmo payment hit my account same day. Super smooth.", name: "Ashley T." },
                  { text: "They came to me and paid cash on the spot. Can't beat that.", name: "David L." },
                  { text: "Sold my old Galaxy S23 in 5 minutes. Easy money.", name: "Sarah K." },
                  { text: "Best price I found anywhere in Austin. Highly recommend.", name: "Chris M." },
                ].map((r, i) => (
                  <div key={i} className="flex-shrink-0 w-[260px] bg-white/5 rounded-2xl p-4 border border-white/10">
                    <p className="text-sm text-white/85 font-medium mb-2">&ldquo;{r.text}&rdquo;</p>
                    <p className="text-xs text-[#888]">— {r.name}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* PAYMENT TIMELINE */}
          <section className="py-12 bg-[#0d0d0d]">
            <div className="max-w-lg mx-auto px-4">
              <h2 className="text-xl font-bold text-center mb-2">When do I get paid?</h2>
              <p className="text-[#888] text-sm text-center mb-8">Transparent timelines. No surprises.</p>
              <div className="space-y-3">
                {[
                  { method: "Local Pickup", icon: "🏠", timeline: "Same day", desc: "We meet in Austin. Inspect device. Pay on the spot.", highlight: true },
                  { method: "Cash", icon: "💵", timeline: "Instant", desc: "Handed to you at pickup. Immediate.", highlight: false },
                  { method: "Venmo / Zelle", icon: "⚡", timeline: "Under 5 min", desc: "Sent while you watch. Hits your account instantly.", highlight: false },
                  { method: "PayPal", icon: "💳", timeline: "Under 1 hour", desc: "Sent immediately. May take a few minutes to clear.", highlight: false },
                  { method: "Ship To Us", icon: "📦", timeline: "Same day received", desc: "We inspect and pay within hours of receiving your device.", highlight: false },
                ].map((p) => (
                  <div key={p.method} className={`flex items-center gap-4 rounded-2xl p-4 border ${p.highlight ? "bg-[#00c853]/10 border-[#00c853]/20" : "bg-white/5 border-white/10"}`}>
                    <span className="text-2xl">{p.icon}</span>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-0.5">
                        <p className="text-white text-sm font-bold">{p.method}</p>
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${p.highlight ? "bg-[#00c853]/20 text-[#00c853]" : "bg-white/10 text-[#aaa]"}`}>{p.timeline}</span>
                      </div>
                      <p className="text-[#888] text-xs">{p.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* CTA SECTION */}
          <section className="py-16 bg-[#0a0a0a] text-center">
            <div className="max-w-lg mx-auto px-4">
              <div className="bg-gradient-to-br from-[#00c853]/10 to-transparent border border-[#00c853]/20 rounded-3xl p-8">
                <p className="text-4xl mb-3">💸</p>
                <h2 className="text-3xl font-bold mb-2">Still sitting on old tech?</h2>
                <p className="text-[#888] text-base mb-2">That phone in your drawer is losing value every day.</p>
                <p className="text-white/70 text-sm mb-6">Get your instant quote — it takes 30 seconds.</p>
                <button onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} className="bg-[#00c853] text-white px-10 py-4 rounded-2xl text-lg font-bold cursor-pointer hover:bg-[#00e676] transition active:scale-[0.98] shadow-lg shadow-[#00c853]/20">
                  Get Your Quote Now
                </button>
                <p className="text-[#777] text-xs mt-4">No account required · Free instant quote · No obligation</p>
              </div>
            </div>
          </section>

          {/* NEWSLETTER CAPTURE */}
          <section className="py-12 bg-[#0d0d0d]">
            <div className="max-w-lg mx-auto px-4">
              <div className="bg-white/5 border border-white/10 rounded-2xl p-6 text-center">
                <p className="text-xl mb-2">📬</p>
                <h3 className="text-lg font-bold mb-1">Get price alerts &amp; deals</h3>
                <p className="text-[#888] text-sm mb-4">We&apos;ll let you know when buyback prices go up or we run a promo. No spam — just money.</p>
                {newsletterSubmitted ? (
                  <div className="bg-[#00c853]/10 border border-[#00c853]/20 rounded-xl p-4">
                    <p className="text-[#00c853] font-semibold text-sm">You&apos;re in! We&apos;ll keep you posted.</p>
                  </div>
                ) : (
                  <form onSubmit={async (e) => {
                    e.preventDefault();
                    if (!newsletterEmail.trim()) return;
                    try {
                      await fetch("/api/lead", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "Newsletter Signup", email: newsletterEmail, phone: "", device: "Newsletter", notes: "Homepage newsletter signup" }) });
                    } catch {}
                    setNewsletterSubmitted(true);
                  }} className="flex gap-2">
                    <input type="email" value={newsletterEmail} onChange={(e) => setNewsletterEmail(e.target.value)} placeholder="your@email.com" required aria-label="Email for newsletter" className="flex-1 px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder:text-[#777] focus:outline-none focus:border-[#00c853] transition" />
                    <button type="submit" className="bg-[#00c853] text-white px-6 py-3 rounded-xl text-sm font-bold cursor-pointer hover:bg-[#00e676] transition active:scale-[0.98] whitespace-nowrap">
                      Sign Up
                    </button>
                  </form>
                )}
                <p className="text-[#777] text-[11px] mt-3">Unsubscribe anytime. We respect your inbox.</p>
              </div>
            </div>
          </section>

          {/* FAQ */}
          <section className="py-12 bg-[#111]">
            <div className="max-w-lg mx-auto px-4">
              <h2 className="text-2xl font-bold text-center mb-8">Frequently Asked Questions</h2>
              <div className="space-y-2">
                {FAQS.map((faq, i) => (
                  <div key={i} className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
                    <button onClick={() => setExpandedFaq(expandedFaq === i ? null : i)} className="w-full flex items-center justify-between p-4 cursor-pointer text-left">
                      <p className="font-semibold text-sm pr-4">{faq.q}</p>
                      <svg className={`w-4 h-4 text-[#888] shrink-0 transition-transform ${expandedFaq === i ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                    </button>
                    {expandedFaq === i && (
                      <div className="px-4 pb-4 animate-[fadeIn_0.2s_ease-out]">
                        <p className="text-[#888] text-sm">{faq.a}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </section>
        </>
      )}

      {/* INNER PAGES */}
      {(page === "about" || page === "privacy" || page === "terms") && (
        <section className="min-h-[60vh] animate-[fadeIn_0.3s_ease-out]">
          <div className="max-w-lg mx-auto px-4 pt-6 pb-16">
            <button onClick={() => { setPage("home"); window.scrollTo({ top: 0 }); }} aria-label="Go back" className="inline-flex items-center gap-2 text-[#00c853] text-sm font-semibold mb-6 px-4 py-2 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 cursor-pointer transition active:scale-95">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
              Home
            </button>
            {page === "about" && <div className="animate-[fadeIn_0.3s_ease-out]">
              <h1 className="text-3xl font-bold mb-2">About Top Cash Cellular</h1>
              <p className="text-[#00c853] text-sm font-semibold mb-6">Austin&apos;s #1 Device Buyback Service</p>

              <div className="bg-gradient-to-br from-[#00c853]/10 to-transparent border border-[#00c853]/20 rounded-2xl p-6 mb-8">
                <p className="text-white text-lg font-medium leading-relaxed mb-3">We started Top Cash Cellular with a simple idea: selling your phone shouldn&apos;t be a hassle.</p>
                <p className="text-[#888] text-sm leading-relaxed">No lowball carrier trade-ins. No mailing your device and waiting weeks for a check. No haggling with strangers on marketplace apps. Just a fair price, paid fast, from a team you can trust.</p>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-8">
                <div className="bg-white/5 rounded-2xl p-5 border border-white/10 text-center">
                  <p className="text-3xl font-bold text-[#00c853]">500+</p>
                  <p className="text-[#888] text-xs mt-1">Devices Purchased</p>
                </div>
                <div className="bg-white/5 rounded-2xl p-5 border border-white/10 text-center">
                  <p className="text-3xl font-bold text-[#00c853]">4.9★</p>
                  <p className="text-[#888] text-xs mt-1">Customer Rating</p>
                </div>
                <div className="bg-white/5 rounded-2xl p-5 border border-white/10 text-center">
                  <p className="text-3xl font-bold text-[#00c853]">Same Day</p>
                  <p className="text-[#888] text-xs mt-1">Payment</p>
                </div>
                <div className="bg-white/5 rounded-2xl p-5 border border-white/10 text-center">
                  <p className="text-3xl font-bold text-[#00c853]">38%</p>
                  <p className="text-[#888] text-xs mt-1">More Than Trade-In</p>
                </div>
              </div>

              <h2 className="text-xl font-bold mb-4">Why sell to us?</h2>
              <div className="space-y-3 mb-8">
                {[
                  { icon: "💰", title: "Highest payouts in Austin", desc: "We consistently beat Apple, carrier, and marketplace prices by 20-40%. Get a quote and compare." },
                  { icon: "⚡", title: "Paid on the spot", desc: "Cash, Venmo, Zelle, or PayPal — your choice. No waiting for checks or bank transfers." },
                  { icon: "🤝", title: "Local & personal", desc: "We meet you at a convenient Austin location. Face-to-face, safe, and quick. 5 minutes and you're done." },
                  { icon: "📦", title: "Nationwide shipping", desc: "Not in Austin? No problem. We send a free prepaid label. Ship your device, get paid same day we receive it." },
                  { icon: "📱", title: "We buy everything", desc: "iPhones, Samsung Galaxy, MacBooks, PS5, Xbox, Nintendo Switch. Working, cracked, or water damaged." },
                  { icon: "🔒", title: "7-day price lock", desc: "Your quote is locked for 7 days. Take your time deciding — the price won't change." },
                ].map((item) => (
                  <div key={item.title} className="flex items-start gap-4 bg-white/5 rounded-2xl p-4 border border-white/10">
                    <span className="text-2xl shrink-0">{item.icon}</span>
                    <div>
                      <p className="font-semibold text-sm mb-0.5">{item.title}</p>
                      <p className="text-[#888] text-sm leading-relaxed">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              <h2 className="text-xl font-bold mb-4">How it works</h2>
              <div className="space-y-3 mb-8">
                {[
                  { num: "1", title: "Get an instant quote", desc: "Select your device, model, storage, and condition. See your price in 30 seconds." },
                  { num: "2", title: "Choose how to sell", desc: "Meet us locally in Austin or ship your device for free from anywhere in the US." },
                  { num: "3", title: "Get paid instantly", desc: "We verify your device and pay you on the spot. Cash, Venmo, Zelle, or PayPal." },
                ].map((step) => (
                  <div key={step.num} className="flex items-start gap-4 bg-white/5 rounded-2xl p-4 border border-white/10">
                    <div className="w-8 h-8 rounded-full bg-[#00c853] flex items-center justify-center text-white text-sm font-bold shrink-0">{step.num}</div>
                    <div>
                      <p className="font-semibold text-sm mb-0.5">{step.title}</p>
                      <p className="text-[#888] text-sm leading-relaxed">{step.desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="bg-[#00c853]/10 border border-[#00c853]/20 rounded-2xl p-6 text-center">
                <p className="text-lg font-bold mb-2">Ready to sell?</p>
                <p className="text-[#888] text-sm mb-4">Get your instant quote in 30 seconds.</p>
                <button onClick={() => { setPage("home"); setStep("device"); window.scrollTo({ top: 0 }); }} className="bg-[#00c853] text-white px-8 py-3 rounded-2xl font-semibold cursor-pointer hover:bg-[#00e676] transition active:scale-[0.98]">
                  Get My Quote
                </button>
              </div>

              <div className="mt-8 text-center">
                <p className="text-[#888] text-sm mb-1">Questions? Call us anytime.</p>
                <a href={`tel:${PHONE_TEL}`} className="text-[#00c853] font-bold text-lg">{PHONE}</a>
              </div>
            </div>}

            {page === "privacy" && (
              <div className="animate-[fadeIn_0.3s_ease-out]">
                <h1 className="text-3xl font-bold mb-4">Privacy Policy</h1>
                <div className="text-[#888] text-sm space-y-4 leading-relaxed">
                  <p>Top Cash Cellular respects your privacy. We collect only the information needed to process your device sale: name, phone number, email, device details, and payout preference.</p>
                  <p>We do not sell, share, or distribute your personal information to third parties. Your data is used solely to complete your transaction and communicate with you about your sale.</p>
                  <p>Device data (photos, files) is your responsibility to remove before selling. We recommend a factory reset before handoff. We are not responsible for any data left on sold devices.</p>
                  <p>For questions about your data, contact us at {PHONE}.</p>
                </div>
              </div>
            )}

            {page === "terms" && (
              <div className="animate-[fadeIn_0.3s_ease-out]">
                <h1 className="text-3xl font-bold mb-4">Terms of Service</h1>
                <div className="text-[#888] text-sm space-y-4 leading-relaxed">
                  <p>By using Top Cash Cellular, you agree to these terms. Quotes provided on our site are estimates based on the condition and model you select. Final pricing is confirmed during in-person inspection.</p>
                  <p>All devices sold to us must be legally owned by the seller. Stolen devices will be reported to law enforcement. Sellers must provide valid identification at the time of sale.</p>
                  <p>Payouts are processed via your selected method (Cash, Venmo, Zelle, PayPal) at the time of device inspection and acceptance. We reserve the right to adjust offers if the device condition differs from the online assessment.</p>
                  <p>All sales are final once payment is issued. Top Cash Cellular is not responsible for data left on sold devices. Please factory reset your device before selling.</p>
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {/* FOOTER */}
      <footer className="mt-auto bg-[#060606] text-[#888] py-10 border-t border-white/10">
        <div className="max-w-lg mx-auto px-4">
          <div className="grid grid-cols-2 gap-6 mb-6">
            <div>
              <p className="text-white font-semibold text-xs uppercase tracking-wider mb-3">Company</p>
              <div className="space-y-2">
                <button onClick={() => { setPage("about"); window.scrollTo({ top: 0 }); }} className="block text-xs hover:text-white transition cursor-pointer">About Us</button>
                <a href={`tel:${PHONE_TEL}`} className="block text-xs hover:text-white transition">Contact</a>
                <a href="/privacy" className="block text-xs hover:text-white transition">Privacy Policy</a>
                <button onClick={() => { setPage("terms"); window.scrollTo({ top: 0 }); }} className="block text-xs hover:text-white transition cursor-pointer">Terms of Service</button>
              </div>
            </div>
            <div>
              <p className="text-white font-semibold text-xs uppercase tracking-wider mb-3">Service</p>
              <div className="space-y-2">
                <p className="text-xs">Austin, TX</p>
                <p className="text-xs">Mon-Sat 8AM-8PM</p>
              </div>
            </div>
          </div>
          <div className="border-t border-white/10 pt-6 text-center">
            <p className="text-[11px] text-[#888]/60 mb-3">© 2026 {BRAND}</p>
            <div className="flex items-center justify-center gap-4">
              <a href="/privacy" className="text-[11px] text-[#777] hover:text-[#888] transition">Privacy Policy</a>
              <span className="text-[11px] text-[#333]">·</span>
              <a href="https://atxgadgetfix.com" target="_blank" rel="noopener noreferrer" className="text-[11px] text-[#777] hover:text-[#888] transition">
                Need a repair? ATX Gadget Fix →
              </a>
            </div>
          </div>
        </div>
      </footer>

      {/* CHAT WIDGET */}
      <div className="fixed bottom-6 left-6 z-50">
        {chatOpen && (
          <div className="mb-3 w-[300px] bg-[#111] border border-white/15 rounded-2xl shadow-2xl overflow-hidden animate-[fadeIn_0.2s_ease-out]">
            <div className="bg-[#00c853] px-4 py-3 flex items-center justify-between">
              <p className="text-white font-semibold text-sm">Top Cash Cellular</p>
              <button onClick={() => setChatOpen(false)} aria-label="Close chat" className="text-white/80 hover:text-white cursor-pointer text-lg">×</button>
            </div>
            <div className="p-4">
              {chatMode === "choose" && (
                <>
                  <p className="text-white text-sm mb-4">Hey! Got a device to sell? How can we help?</p>
                  <div className="space-y-2">
                    <button onClick={() => setChatMode("chat")} className="w-full flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 cursor-pointer transition text-left active:scale-[0.98]">
                      <span className="text-xl">💬</span>
                      <div><p className="font-semibold text-sm">Live Chat</p><p className="text-[#888] text-xs">Send us a message</p></div>
                    </button>
                    <button onClick={() => setChatMode("call")} className="w-full flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 cursor-pointer transition text-left active:scale-[0.98]">
                      <span className="text-xl">📞</span>
                      <div><p className="font-semibold text-sm">Talk to a Human</p><p className="text-[#888] text-xs">Call or get a callback</p></div>
                    </button>
                  </div>
                </>
              )}
              {chatMode === "chat" && (
                <>
                  <button onClick={() => setChatMode("choose")} className="text-[#888] text-xs mb-2 cursor-pointer hover:text-white">← Back</button>
                  <div className="h-[200px] overflow-y-auto space-y-2 mb-2 pr-1">
                    {chatMessages.map((m, i) => (
                      <div key={i} className={`flex ${m.from === "user" ? "justify-end" : "justify-start"}`}>
                        <div className={`max-w-[85%] px-3 py-2 rounded-xl text-xs ${m.from === "user" ? "bg-[#00c853] text-white" : "bg-white/10 text-white/90"}`}>{m.text}</div>
                      </div>
                    ))}
                    {chatLoading && <div className="flex justify-start"><div className="bg-white/10 text-white/60 px-3 py-2 rounded-xl text-xs">Typing...</div></div>}
                  </div>
                  <div className="flex gap-2">
                    <input value={chatMsg} onChange={(e) => setChatMsg(e.target.value)} onKeyDown={(e) => e.key === "Enter" && sendChat()} placeholder="Ask me anything..." aria-label="Chat message" className="flex-1 px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-xs text-white placeholder:text-[#777] focus:outline-none focus:border-[#00c853]" />
                    <button onClick={sendChat} disabled={chatLoading} aria-label="Send message" className="bg-[#00c853] text-white px-3 py-2 rounded-xl text-xs font-semibold cursor-pointer hover:bg-[#00e676] transition disabled:opacity-50">Send</button>
                  </div>
                </>
              )}
              {chatMode === "call" && (
                <div className="text-center py-2">
                  <button onClick={() => setChatMode("choose")} className="text-[#888] text-xs mb-3 cursor-pointer hover:text-white block mx-auto">← Back</button>
                  <a href={`tel:${PHONE_TEL}`} className="block w-full bg-[#00c853] text-white py-3 rounded-xl text-sm font-semibold hover:bg-[#00e676] transition text-center mb-2">📞 Call {PHONE}</a>
                  <p className="text-[#888] text-xs">Mon-Sat 8AM-8PM</p>
                </div>
              )}
            </div>
          </div>
        )}
        <button onClick={() => setChatOpen(!chatOpen)} className="w-14 h-14 rounded-full bg-[#00c853] text-white flex items-center justify-center shadow-lg hover:bg-[#00e676] transition cursor-pointer active:scale-90">
          {chatOpen ? (
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          ) : (
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
          )}
        </button>
      </div>

      {/* CART WIDGET — only visible when items in cart */}
      {cartItems.length > 0 && <div className="fixed bottom-6 right-6 z-50">
        {cartOpen && (
          <div className="mb-3 w-[320px] bg-[#111] border border-white/15 rounded-2xl shadow-2xl overflow-hidden animate-[fadeIn_0.2s_ease-out]">
            <div className="bg-[#00c853] px-4 py-3 flex items-center justify-between">
              <p className="text-black font-semibold text-sm">Your Cart ({cartItems.reduce((sum, i) => sum + i.quantity, 0)} items)</p>
              <button onClick={() => setCartOpen(false)} aria-label="Close cart" className="text-black/60 hover:text-black cursor-pointer text-lg font-bold">×</button>
            </div>
            <div className="p-4 max-h-[300px] overflow-y-auto">
              {cartItems.length === 0 ? (
                <div className="text-center py-6">
                  <p className="text-[#888] text-sm">Your cart is empty</p>
                  <p className="text-[#777] text-xs mt-2">Get a quote and add a device!</p>
                </div>
              ) : (
                <>
                  <div className="space-y-3">
                    {cartItems.map((item, i) => (
                      <div key={i} className="bg-white/5 rounded-xl p-3 border border-white/10">
                        <div className="flex items-center justify-between mb-1">
                          <p className="font-semibold text-sm text-white">{item.model}</p>
                          <button onClick={() => setCartItems(prev => prev.filter((_, idx) => idx !== i))} className="text-[#888] hover:text-red-400 text-xs cursor-pointer">Remove</button>
                        </div>
                        <p className="text-[#888] text-xs">{item.storage} · {item.condition}</p>
                        <div className="flex items-center justify-between mt-2">
                          <div className="flex items-center gap-2">
                            <button onClick={() => setCartItems(prev => prev.map((it, idx) => idx === i ? { ...it, quantity: Math.max(1, it.quantity - 1) } : it))} className="w-6 h-6 rounded bg-white/10 text-white text-xs flex items-center justify-center cursor-pointer hover:bg-white/20">−</button>
                            <span className="text-white text-sm font-semibold">{item.quantity}</span>
                            <button onClick={() => setCartItems(prev => prev.map((it, idx) => idx === i ? { ...it, quantity: Math.min(10, it.quantity + 1) } : it))} className="w-6 h-6 rounded bg-white/10 text-white text-xs flex items-center justify-center cursor-pointer hover:bg-white/20">+</button>
                          </div>
                          <p className="text-[#00c853] font-bold text-sm">${item.price * item.quantity}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="border-t border-white/10 mt-3 pt-3 flex items-center justify-between">
                    <p className="text-[#888] text-sm">Total</p>
                    <p className="text-[#00c853] font-bold text-lg">${cartItems.reduce((sum, i) => sum + i.price * i.quantity, 0)}</p>
                  </div>
                  <button
                    onClick={() => { setCartOpen(false); setStep("checkout"); pushHistory("checkout"); }}
                    className="w-full mt-3 bg-[#00c853] text-black py-3 rounded-xl text-sm font-bold cursor-pointer hover:bg-[#00e676] transition active:scale-[0.98]"
                  >
                    Checkout
                  </button>
                </>
              )}
            </div>
          </div>
        )}
        <button onClick={() => setCartOpen(!cartOpen)} className="w-14 h-14 rounded-full bg-[#00c853] text-black flex items-center justify-center shadow-lg hover:bg-[#00e676] transition cursor-pointer active:scale-90 relative">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z" /></svg>
          {cartItems.length > 0 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 text-white text-[11px] font-bold flex items-center justify-center">{cartItems.reduce((sum, i) => sum + i.quantity, 0)}</span>
          )}
        </button>
      </div>}

      {/* PROGRESS BAR — shows during flow */}
      {step !== "device" && step !== "done" && page === "home" && (
        <div className="fixed top-[52px] left-0 right-0 z-30 h-1 bg-white/10">
          <div className="h-full bg-[#00c853] transition-all duration-500" style={{ width: `${({category: 8, brand: 15, model: 22, storage: 32, condition: 42, carrier: 52, quote: 62, checkout: 72, payout: 82, contact: 92} as Record<string,number>)[step] ?? 0}%` }} />
        </div>
      )}

      {cookieConsent === null && (
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-[#111]/95 backdrop-blur-sm border-t border-white/10 px-3 py-2 animate-[fadeIn_0.3s_ease-out]">
          <div className="max-w-lg mx-auto flex items-center gap-3">
            <p className="text-white/80 text-[11px] flex-1">We use cookies to improve your experience.</p>
            <button onClick={() => { localStorage.setItem("cookie-consent", "essential"); setCookieConsent("essential"); }} className="text-white/60 text-[11px] font-medium cursor-pointer hover:text-white transition whitespace-nowrap">Essential</button>
            <button onClick={() => { localStorage.setItem("cookie-consent", "full"); setCookieConsent("full"); }} className="bg-[#00c853] text-white px-3 py-1.5 rounded-lg text-[11px] font-semibold cursor-pointer hover:bg-[#00e676] transition whitespace-nowrap">Accept All</button>
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes marquee { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }
      `}</style>
    </main>
  );
}
