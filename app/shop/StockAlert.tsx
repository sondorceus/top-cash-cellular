"use client";

import { useState } from "react";
import { track } from "@vercel/analytics";

// Email capture for the coming-soon states. Rides the existing newsletter
// list (/api/newsletter) rather than inventing a second list — Skywalker
// already emails that list when something worth saying happens, and "first
// devices just dropped" is exactly that email.
export default function StockAlert({ context }: { context: string }) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "done" | "error">("idle");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || state === "busy") return;
    setState("busy");
    try {
      const r = await fetch("/api/newsletter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      const d = await r.json().catch(() => ({}));
      if (r.ok && d.ok) {
        setState("done");
        track("shop_stock_alert_signup", { context });
      } else {
        setState("error");
      }
    } catch {
      setState("error");
    }
  };

  if (state === "done") {
    return (
      <p className="text-sm font-semibold text-[#00c853] mt-5">
        You&apos;re on the list — first to know when stock lands.
      </p>
    );
  }

  return (
    <form onSubmit={submit} className="mt-5 flex gap-2 max-w-sm mx-auto">
      <input
        type="email"
        required
        placeholder="you@email.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        maxLength={120}
        className="flex-1 min-w-0 bg-white/5 border border-white/15 rounded-full px-4 py-2.5 text-sm text-white placeholder-[#666] focus:outline-none focus:border-[#00c853]/60"
      />
      <button
        type="submit"
        disabled={state === "busy"}
        className="bg-white/10 border border-white/15 text-white px-5 py-2.5 rounded-full text-sm font-semibold hover:border-[#00c853]/60 hover:text-[#00c853] transition disabled:opacity-60 whitespace-nowrap"
      >
        {state === "busy" ? "…" : "Notify me"}
      </button>
      {state === "error" && <span className="sr-only">Signup failed</span>}
    </form>
  );
}
