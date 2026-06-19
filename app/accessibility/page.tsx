import type { Metadata } from "next";
import SiteFooter from "../components/SiteFooter";
import { BRAND, EMAIL } from "../lib/constants";

export const metadata: Metadata = {
  title: `Accessibility Statement | ${BRAND}`,
  description: `${BRAND} is committed to WCAG 2.1 AA. How we test with screen readers and keyboard navigation, and how to reach us if something is hard to use.`,
  alternates: { canonical: "/accessibility" },
};

export default function AccessibilityPage() {
  return (
    <main className="min-h-screen bg-black text-white flex flex-col">
      <div className="px-6 py-16 max-w-3xl mx-auto w-full">
        <h1 className="text-3xl font-bold mb-2">Accessibility Statement</h1>
        <p className="text-[#b8b8b8] text-sm mb-6">We want this site to work for everyone.</p>
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-3 text-sm text-[#e6e6e6] leading-relaxed">
          <p>{BRAND} is committed to WCAG 2.1 AA conformance. We test with VoiceOver, NVDA, and keyboard-only navigation when shipping changes.</p>
          <p><strong className="text-white">What we already do:</strong> semantic HTML, focus states on every interactive control, alt text on device images, sufficient color contrast on text, no auto-playing media, and a quote flow that works without a mouse.</p>
          <p><strong className="text-white">If something is hard to use:</strong> email <a href={`mailto:${EMAIL}`} className="text-[#00c853] hover:underline">{EMAIL}</a> and we&apos;ll fix it. Mention the page and which screen reader / assistive tool you were using if you can.</p>
        </div>
        <div className="mt-10">
          <a href="/" className="text-sm text-[#00c853] hover:underline">← Back to Home</a>
        </div>
      </div>
      <SiteFooter />
    </main>
  );
}
