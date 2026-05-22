"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

function ThankYouInner() {
  const searchParams = useSearchParams();
  const code = searchParams.get("code");
  const value = searchParams.get("value") || "25";
  const expires = searchParams.get("expires");
  const expDate = expires ? new Date(expires).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }) : null;
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2400);
    } catch {
      window.prompt("Copy your code:", code);
    }
  };

  return (
    <main className="min-h-screen bg-[#0a0a0a] text-white flex items-center justify-center px-4 py-12">
      <div className="max-w-lg w-full mx-auto text-center">
        <div className="w-20 h-20 rounded-full bg-[#00c853]/10 flex items-center justify-center mx-auto mb-6">
          <svg className="w-9 h-9 text-[#00c853]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.196-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" /></svg>
        </div>
        <h1 className="text-3xl font-bold mb-3">Thanks for the review!</h1>
        <p className="text-[#dcdcdc] text-lg mb-8">
          You just helped the next seller make a confident decision. We appreciate you.
        </p>

        {/* $25 reward coupon — minted server-side at submit time,
            also emailed to the customer's inbox. We show the code
            here too in case they want to screenshot it right now.
            Skywalker 2026-05-18 "$25 added to whatever device they
            sell in the future". */}
        {code ? (
          <div className="bg-white/[0.04] border border-[#ffb400]/40 rounded-2xl p-6 mb-6 text-left">
            <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-[#ffd54f] mb-2 text-center">Plus — your thank-you bonus</p>
            <h2 className="text-2xl font-bold text-white text-center mb-2">${value} off your next trade</h2>
            <p className="text-[#dcdcdc] text-sm text-center leading-relaxed mb-4">
              No minimum, no fine print. Just paste this code on your next trade and we&apos;ll add ${value} to whatever your offer is.
            </p>
            <button
              onClick={copy}
              className="w-full bg-black/40 border-2 border-dashed border-[#ffb400]/50 hover:border-[#ffb400]/80 rounded-xl py-4 px-5 mb-3 transition cursor-pointer group"
            >
              <p className="text-[10px] text-[#ffd54f] uppercase tracking-[0.18em] font-bold mb-1">Your code · tap to copy</p>
              <p className="font-mono font-extrabold text-2xl text-white tracking-[0.1em] break-all">{code}</p>
              <p className="text-[11px] text-[#bdbdbd] mt-2 flex items-center justify-center gap-1">{copied ? <><svg className="w-3.5 h-3.5 text-[#00c853]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> Copied to clipboard</> : "Tap to copy"}</p>
            </button>
            {expDate ? (
              <p className="text-[11px] text-[#888] text-center leading-relaxed">
                Expires {expDate} · single-use · sent to your email so you don&apos;t have to keep this tab open
              </p>
            ) : (
              <p className="text-[11px] text-[#888] text-center">Single-use · sent to your email so you don&apos;t have to keep this tab open</p>
            )}
          </div>
        ) : null}

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/reviews"
            className="inline-block bg-[#00c853] text-black px-6 py-3 rounded-full font-semibold hover:bg-[#00e676] transition"
          >
            Read all reviews
          </Link>
          <Link
            href="/"
            className="inline-block bg-white/5 border border-white/10 text-white px-6 py-3 rounded-full font-semibold hover:bg-white/10 transition"
          >
            Back to home
          </Link>
        </div>
      </div>
    </main>
  );
}

export default function ReviewThankYou() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-[#0a0a0a]" />}>
      <ThankYouInner />
    </Suspense>
  );
}
