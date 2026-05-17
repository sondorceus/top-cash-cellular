"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

// Compact device-search input for the sticky header on every page
// EXCEPT the funnel home (which has its own inline search inside the
// device picker). Submitting (Enter) or tapping the green button pushes
// the user to /?q=<query> — the home page reads the q param on mount,
// prefills the funnel's full-featured search, and opens the results
// dropdown. Keeps the search code in one place while making the entry
// point available from /faq, /bulk, /reviews, etc.
export function HeaderSearch({ className = "" }: { className?: string }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const submit = () => {
    const trimmed = q.trim();
    if (!trimmed) {
      router.push("/");
      return;
    }
    router.push(`/?q=${encodeURIComponent(trimmed)}`);
  };
  return (
    <form
      onSubmit={(e) => { e.preventDefault(); submit(); }}
      className={`relative flex items-center ${className}`}
      role="search"
    >
      <svg
        className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#a0a0a0] pointer-events-none"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <circle cx="11" cy="11" r="8" />
        <path d="M21 21l-4.35-4.35" />
      </svg>
      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search device"
        aria-label="Search devices"
        className="w-full pl-9 pr-3 py-2 bg-white/[0.07] border border-white/15 rounded-full text-[13px] text-white placeholder:text-[#a0a0a0] focus:outline-none focus:bg-white/[0.10] focus:border-[#00c853] focus:ring-2 focus:ring-[#00c853]/20 transition"
      />
    </form>
  );
}
