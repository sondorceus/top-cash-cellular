"use client";

import { useEffect, useState } from "react";

// Light/dark toggle. Dark is the default + untouched theme; light is an
// additive CSS override layer keyed off `data-theme="light"` on <html>
// (see globals.css). The actual attribute is set pre-paint by the inline
// script in layout.tsx (no flash); this just flips + persists it.
export function ThemeToggle() {
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  useEffect(() => {
    const current = (document.documentElement.getAttribute("data-theme") as "dark" | "light") || "dark";
    setTheme(current);
  }, []);

  const toggle = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    try { localStorage.setItem("tcc-theme", next); } catch {}
  };

  return (
    <button
      onClick={toggle}
      aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      title="Toggle light / dark mode"
      className="w-9 h-9 rounded-full hover:bg-white/10 hover:text-[#00c853] flex items-center justify-center cursor-pointer tap-press transition text-white"
    >
      {theme === "dark" ? (
        // Sun — click to go light
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <circle cx="12" cy="12" r="4" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 2v2m0 16v2m10-10h-2M4 12H2m15.07-7.07l-1.41 1.41M6.34 17.66l-1.41 1.41m12.73 0l-1.41-1.41M6.34 6.34L4.93 4.93" />
        </svg>
      ) : (
        // Moon — click to go dark
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
        </svg>
      )}
    </button>
  );
}
