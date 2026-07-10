"use client";

import { useState } from "react";
import Link from "next/link";
import { track } from "@vercel/analytics";

// The claim form. Success = the unit is on hold and Skywalker has the
// buyer's contact — closing happens human-to-human (cash at pickup, Zelle /
// Cash App for shipping). No card is ever collected here in v1.
export default function BuyBox({
  listingId,
  status,
  deviceName,
}: {
  listingId: string;
  status: string;
  deviceName: string;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [fulfilment, setFulfilment] = useState<"pickup" | "ship">("pickup");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  if (status === "sold") {
    return (
      <div className="bg-white/5 border border-white/10 rounded-2xl p-5 text-center">
        <div className="font-bold text-[#ff6b6b] mb-1">This one&apos;s gone</div>
        <p className="text-sm text-[#9a9a9a] mb-4">One-of-one means exactly that. More stock lands regularly.</p>
        <Link
          href="/shop"
          className="inline-block bg-[#00c853] text-[#0a0a0a] px-6 py-2.5 rounded-full font-semibold hover:bg-[#00e676] transition text-sm"
        >
          See what&apos;s available
        </Link>
      </div>
    );
  }

  if (status === "on_hold") {
    return (
      <div className="bg-[#ffb400]/10 border border-[#ffb400]/30 rounded-2xl p-5 text-center">
        <div className="font-bold text-[#ffb400] mb-1">On hold for another buyer</div>
        <p className="text-sm text-[#dcdcdc]">
          Someone claimed this first. If their deal falls through it comes right back —{" "}
          <Link href="/shop" className="underline hover:text-white">
            browse the rest
          </Link>{" "}
          in the meantime.
        </p>
      </div>
    );
  }

  if (done) {
    return (
      <div className="bg-[#00c853]/10 border border-[#00c853]/30 rounded-2xl p-6 text-center">
        <svg viewBox="0 0 24 24" className="w-10 h-10 mx-auto mb-3" fill="none" stroke="#00c853" strokeWidth="2.5">
          <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <div className="font-bold text-lg mb-1">It&apos;s on hold for you</div>
        <p className="text-sm text-[#dcdcdc]">
          Nobody else can claim the {deviceName} now. We&apos;ll text or email you shortly to arrange{" "}
          {fulfilment === "pickup" ? "pickup and payment" : "payment and shipping"}.
        </p>
      </div>
    );
  }

  if (!open) {
    return (
      <button
        onClick={() => {
          setOpen(true);
          track("shop_claim_opened", { listingId });
        }}
        className="block w-full bg-[#00c853] text-[#0a0a0a] py-4 rounded-2xl text-lg font-bold text-center hover:bg-[#00e676] transition shadow-lg"
      >
        Claim this device
      </button>
    );
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!name.trim()) return setError("Your name, so we know who's claiming it.");
    if (!email.trim() && !phone.trim()) return setError("Email or phone — we need one way to reach you.");
    setBusy(true);
    try {
      const r = await fetch("/api/shop/buy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listingId, name, email, phone, fulfilment, message }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok || !d.ok) {
        setError(d.error || "Something went wrong — try again or email us.");
        setBusy(false);
        return;
      }
      track("shop_claim_submitted", { listingId, fulfilment });
      setDone(true);
    } catch {
      setError("Network hiccup — try again.");
      setBusy(false);
    }
  };

  const inputCls =
    "w-full bg-white/5 border border-white/15 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-[#666] focus:outline-none focus:border-[#00c853]/60";

  return (
    <form onSubmit={submit} className="bg-white/5 border border-white/10 rounded-2xl p-5">
      <div className="text-sm font-bold mb-3">Claim it — takes 20 seconds</div>
      <div className="space-y-2.5">
        <input className={inputCls} placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
        <div className="grid grid-cols-2 gap-2.5">
          <input className={inputCls} placeholder="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={120} />
          <input className={inputCls} placeholder="Phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={30} />
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          {(
            [
              ["pickup", "Pickup in Austin", "Pay cash in hand"],
              ["ship", "Ship it to me", "Zelle / Cash App first"],
            ] as const
          ).map(([val, t, d]) => (
            <button
              key={val}
              type="button"
              onClick={() => setFulfilment(val)}
              className={`text-left rounded-xl border px-3.5 py-2.5 transition ${
                fulfilment === val
                  ? "border-[#00c853] bg-[#00c853]/10"
                  : "border-white/15 bg-white/5 hover:border-white/30"
              }`}
            >
              <div className="text-sm font-bold">{t}</div>
              <div className="text-[11px] text-[#9a9a9a]">{d}</div>
            </button>
          ))}
        </div>
        <textarea
          className={`${inputCls} resize-none`}
          placeholder="Anything we should know? (optional)"
          rows={2}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          maxLength={400}
        />
      </div>
      {error && <p className="text-sm text-[#ff6b6b] mt-3">{error}</p>}
      <button
        type="submit"
        disabled={busy}
        className="mt-4 block w-full bg-[#00c853] text-[#0a0a0a] py-3.5 rounded-2xl font-bold text-center hover:bg-[#00e676] transition disabled:opacity-60"
      >
        {busy ? "Holding it for you…" : "Put it on hold"}
      </button>
      <p className="text-[11px] text-[#666] mt-2.5 text-center">
        No payment now. We confirm with you before anything moves.
      </p>
    </form>
  );
}
