"use client";

import type { ReactNode } from "react";
import { useNavHideOnScroll } from "../lib/use-nav-hide-on-scroll";

// Wrapper around the site-wide sticky <nav>. Renders a <nav> that slides
// up out of view when the user scrolls DOWN past ~80px, and slides back
// in when they scroll UP or return to the top. Lets users read the page
// without the nav covering content, while keeping it one upward flick
// away. All sticky/z-index/styling classes pass through via `className`.
export function SlideOnScrollNav({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  const hidden = useNavHideOnScroll();
  return (
    <nav
      className={`${className} transition-transform duration-300 will-change-transform ${
        hidden ? "-translate-y-full" : "translate-y-0"
      }`}
    >
      {children}
    </nav>
  );
}
