// Customer-facing accept-or-decline page for a counter-offer. The
// token is HMAC-signed (app/lib/counter-token.ts) and decoded server-
// side here — no DB lookup. Renders the original quote vs the revised
// offer + the staff's reason, and lets the customer click Accept or
// Decline.
//
// After responding, the page re-renders into a confirmation state.
// Re-clicks just see the confirmation; the actual outcome lives in MC
// as [COUNTER-RESPONSE:] markers.

"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";

type Decoded = {
  leadId: string;
  originalQuote: number;
  offer: number;
  reason: string;
  iat: number;
  exp: number;
};

export default function CounterOfferPage({ params }: { params: Promise<{ token: string }> }) {
  const [token, setToken] = useState<string>("");
  const [decoded, setDecoded] = useState<Decoded | null>(null);
  const [verifyState, setVerifyState] = useState<"loading" | "valid" | "invalid">("loading");
  const [responseState, setResponseState] = useState<"idle" | "submitting" | "accepted" | "declined" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [note, setNote] = useState<string>("");

  useEffect(() => {
    let active = true;
    (async () => {
      const p = await params;
      if (!active) return;
      setToken(p.token);
      try {
        const r = await fetch("/api/counter-offer/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: p.token }),
        });
        const d = await r.json();
        if (r.ok && d.payload) {
          setDecoded(d.payload);
          setVerifyState("valid");
        } else {
          setVerifyState("invalid");
          setErrorMsg(d.error || "Offer link is invalid or expired.");
        }
      } catch {
        setVerifyState("invalid");
        setErrorMsg("Couldn't verify your offer link — please try again.");
      }
    })();
    return () => { active = false; };
  }, [params]);

  const respond = useCallback(async (response: "accept" | "decline") => {
    if (!token || responseState !== "idle") return;
    setResponseState("submitting");
    try {
      const r = await fetch("/api/counter-offer/respond", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, response, note: note.trim() || undefined }),
      });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        setErrorMsg(d.error || "Couldn't submit your response. Try again.");
        setResponseState("error");
        return;
      }
      setResponseState(response === "accept" ? "accepted" : "declined");
    } catch {
      setErrorMsg("Network error. Try again in a moment.");
      setResponseState("error");
    }
  }, [token, note, responseState]);

  if (verifyState === "loading") {
    return (
      <main className="min-h-screen bg-[#0a0a0a] text-white flex items-center justify-center">
        <p className="text-sm text-[#888]">Loading your offer…</p>
      </main>
    );
  }

  if (verifyState === "invalid") {
    return (
      <main className="min-h-screen bg-[#0a0a0a] text-white flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white/5 border border-white/10 rounded-2xl p-8 text-center">
          <p className="text-3xl mb-3">🔒</p>
          <h1 className="text-xl font-bold mb-2">Offer link can&apos;t be opened</h1>
          <p className="text-[#bdbdbd] text-sm mb-5">{errorMsg}</p>
          <p className="text-[11px] text-[#888] mb-4">Tokens expire after 14 days. If you need help, reach out below.</p>
          <a
            href="mailto:CustomerService@topcashcells.com"
            className="inline-flex items-center justify-center w-full bg-[#00c853] hover:bg-[#00e676] text-[#0a0a0a] font-extrabold text-sm px-4 py-3 rounded-full transition"
          >
            Email CustomerService
          </a>
          <Link href="/" className="block mt-3 text-[#00c853] text-xs hover:underline">← Top Cash Cellular home</Link>
        </div>
      </main>
    );
  }

  // Decoded + valid. Render the offer or the confirmation state.
  if (responseState === "accepted" && decoded) {
    return (
      <main className="min-h-screen bg-[#0a0a0a] text-white flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-[#00c853]/5 border border-[#00c853]/30 rounded-2xl p-8 text-center">
          <p className="text-4xl mb-3">✅</p>
          <h1 className="text-2xl font-bold mb-2">Offer accepted</h1>
          <p className="text-[#dcdcdc] text-sm mb-4 leading-relaxed">
            Got it. We&apos;re moving <strong className="text-white">${decoded.offer}</strong> to payout — you&apos;ll receive payment via your chosen method within 24 hours.
          </p>
          <p className="text-[11px] text-[#888]">Confirmation also sent via SMS / email. Questions: CustomerService@topcashcells.com</p>
          <Link href="/" className="block mt-5 text-[#00c853] text-xs hover:underline">← Top Cash Cellular home</Link>
        </div>
      </main>
    );
  }

  if (responseState === "declined" && decoded) {
    return (
      <main className="min-h-screen bg-[#0a0a0a] text-white flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white/5 border border-white/10 rounded-2xl p-8 text-center">
          <p className="text-4xl mb-3">↩️</p>
          <h1 className="text-2xl font-bold mb-2">Offer declined</h1>
          <p className="text-[#dcdcdc] text-sm mb-4 leading-relaxed">
            No problem. We&apos;ll ship your device back to you within 2 business days at no cost. Expect an email with the return tracking number.
          </p>
          <p className="text-[11px] text-[#888]">Questions: CustomerService@topcashcells.com</p>
          <Link href="/" className="block mt-5 text-[#00c853] text-xs hover:underline">← Top Cash Cellular home</Link>
        </div>
      </main>
    );
  }

  if (!decoded) return null;
  const diff = decoded.originalQuote - decoded.offer;
  const diffPct = decoded.originalQuote > 0 ? Math.round((diff / decoded.originalQuote) * 100) : 0;
  const submitting = responseState === "submitting";

  return (
    <main className="min-h-screen bg-[#0a0a0a] text-white">
      <div className="max-w-2xl mx-auto px-4 py-10">
        <Link href="/" className="inline-flex items-center gap-2 text-[#00c853] text-sm font-semibold mb-6 hover:underline">
          <span>Top Cash Cellular</span>
        </Link>

        <h1 className="text-3xl font-bold mb-2">Your revised offer</h1>
        <p className="text-[#bdbdbd] text-sm mb-6">After we inspected your device, the condition didn&apos;t quite match the original description. Here&apos;s our honest revised number.</p>

        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 mb-6">
          <p className="text-[10px] uppercase tracking-[0.18em] text-[#888] font-bold mb-1">Original quote</p>
          <p className="text-2xl text-[#bdbdbd] line-through mb-4">${decoded.originalQuote.toLocaleString()}</p>

          <p className="text-[10px] uppercase tracking-[0.18em] text-[#00c853] font-bold mb-1">Revised offer</p>
          <p className="text-5xl text-[#00c853] font-extrabold mb-1">${decoded.offer.toLocaleString()}</p>
          <p className="text-xs text-[#a8a8a8]">{diff > 0 ? `Reduced by $${diff.toLocaleString()} (${diffPct}%)` : "Same as original"}</p>
        </div>

        <div className="bg-amber-500/10 border border-amber-500/30 border-l-4 border-l-amber-500 rounded-xl p-5 mb-6">
          <p className="text-[10px] uppercase tracking-[0.18em] text-amber-300 font-bold mb-2">Why the revision</p>
          <p className="text-[#e6e6e6] text-sm leading-relaxed whitespace-pre-wrap">{decoded.reason}</p>
        </div>

        <div className="bg-white/[0.04] border border-white/10 rounded-xl p-5 mb-6">
          <label className="block text-xs font-semibold text-[#dcdcdc] uppercase tracking-wider mb-2">Optional note for staff</label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            maxLength={500}
            placeholder="Anything you'd like to add about your decision — totally optional."
            className="w-full px-3 py-2.5 bg-black/40 border border-white/10 rounded-lg text-sm text-white placeholder:text-[#666] focus:outline-none focus:border-[#00c853] transition"
          />
          <p className="text-[10px] text-[#666] mt-1">Goes to the team directly — not stored publicly.</p>
        </div>

        <div className="flex flex-col gap-3">
          <button
            onClick={() => respond("accept")}
            disabled={submitting}
            className="w-full bg-[#00c853] hover:bg-[#00e676] text-[#0a0a0a] font-extrabold text-base px-4 py-4 rounded-full transition disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {submitting ? "Submitting…" : `Accept $${decoded.offer.toLocaleString()} →`}
          </button>
          <button
            onClick={() => respond("decline")}
            disabled={submitting}
            className="w-full bg-white/5 hover:bg-white/10 border border-white/15 text-white font-semibold text-sm px-4 py-3 rounded-full transition disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            Decline — return my device free
          </button>
        </div>

        {responseState === "error" && (
          <p className="text-red-400 text-sm mt-4 text-center">{errorMsg}</p>
        )}

        <p className="text-[11px] text-[#666] text-center mt-6 leading-relaxed">
          Accept and we pay you via your chosen method within 24 hours. Decline and we ship your device back at no cost (2 business days). Either way, no fee, no surprise.<br/>
          Need to talk first? <a href="mailto:CustomerService@topcashcells.com" className="text-[#00c853] hover:underline">CustomerService@topcashcells.com</a>
        </p>
      </div>
    </main>
  );
}
