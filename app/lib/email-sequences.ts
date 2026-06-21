// Config-in-code email sequences (ported from its-official-notary's
// email-sequences-config). Sequences live here so the copy can be edited and
// shipped without touching the cron engine. Steps fire in `position` order;
// `delayDays` is measured from the PREVIOUS step (or from enrollment for the
// first step), so the cumulative offset of step N is the sum of delays 1..N.
//
// TCC has no subscribers table — enrollment is implicit (every abandoned-quote
// lead) and "which steps already went out" is tracked with
// [SEQUENCE-SENT: leadId] markers in MC. See app/api/cron/sequences.

export type SeqVars = {
  firstName: string;
  device: string;   // clean model, e.g. "iPhone 15 Pro"
  quote: string;    // formatted, e.g. "$420" (already $-prefixed) or ""
  offerUrl: string; // https://topcashcellular.com/offer/<leadId>
};

export type SeqStep = {
  position: number;
  delayDays: number;
  subject: (v: SeqVars) => string;
  html: (v: SeqVars) => string;
  text: (v: SeqVars) => string;
};

export type Sequence = {
  slug: string;
  name: string;
  isActive: boolean;
  steps: SeqStep[];
};

// Shared dark email shell — now routes through the unified mailShell so the
// recovery sequence renders identically (and Outlook-safe, with the VML
// button) to every other TCC email.
import { mailShell, esc } from "./email-shell";

function shell(opts: { heading: string; bodyHtml: string; ctaUrl: string; ctaLabel: string }): string {
  return mailShell({
    preheader: opts.heading,
    title: opts.heading,
    contentHtml: opts.bodyHtml,
    buttonHref: opts.ctaUrl,
    buttonLabel: opts.ctaLabel,
    footerHtml: "Not looking to sell anymore? Just ignore this — we won't keep nudging.",
  });
}

const p = (s: string) => `<p style="font-size:15px;line-height:1.6;color:#cfd2e0;margin:0 0 14px">${s}</p>`;

export const SEQUENCES: Sequence[] = [
  {
    slug: "abandoned_quote",
    name: "Abandoned-quote recovery",
    isActive: true,
    // Touch 0 is the existing 24h reminder cron; these pick up after it so the
    // two never fire on the same day.
    steps: [
      {
        position: 1,
        delayDays: 3, // ~day 3 after the quote
        subject: (v) => `Your ${v.device} offer is still good${v.quote ? ` — ${v.quote}` : ""}`,
        html: (v) =>
          shell({
            heading: `Your offer's still locked in, ${esc(v.firstName)}`,
            bodyHtml:
              p(`Hi ${esc(v.firstName)}, just a friendly note that your ${esc(v.device)} offer${v.quote ? ` of <strong style="color:#fff">${esc(v.quote)}</strong>` : ""} is still good.`) +
              p(`Cashing out is quick: we send a prepaid shipping label (or meet you locally in Austin), and you're paid the day your device checks out — Zelle, Cash App, Venmo, PayPal, BTC, or cash.`) +
              p(`Your offer page has everything in one place:`),
            ctaUrl: v.offerUrl,
            ctaLabel: "View my offer",
          }),
        text: (v) =>
          `Hi ${v.firstName}, your ${v.device} offer${v.quote ? ` of ${v.quote}` : ""} is still good.\n\n` +
          `Cashing out is quick — prepaid label or local Austin meetup, and you're paid the day your device checks out (Zelle/Cash App/Venmo/PayPal/BTC/cash).\n\n` +
          `View your offer: ${v.offerUrl}\n\nNot selling anymore? Just ignore this.\n\n— Top Cash Cellular`,
      },
      {
        position: 2,
        delayDays: 4, // ~day 7
        subject: (v) => `Anything holding up your ${v.device} sale?`,
        html: (v) =>
          shell({
            heading: `Still want to sell your ${esc(v.device)}?`,
            bodyHtml:
              p(`Hi ${esc(v.firstName)} — checking in one last time on your ${esc(v.device)}${v.quote ? ` (${esc(v.quote)})` : ""}.`) +
              p(`Prices move with the market, so locking in now is usually the safe bet. If something's holding you up — a question on the price, how shipping works, or how you get paid — just reply and a real person will help.`) +
              p(`Otherwise your offer's right here whenever you're ready:`),
            ctaUrl: v.offerUrl,
            ctaLabel: "Finish my sale",
          }),
        text: (v) =>
          `Hi ${v.firstName} — last check-in on your ${v.device}${v.quote ? ` (${v.quote})` : ""}.\n\n` +
          `Prices move with the market, so locking in now is usually the safe bet. Anything holding you up — price, shipping, payout? Just reply and a real person will help.\n\n` +
          `Your offer: ${v.offerUrl}\n\nNot selling anymore? Just ignore this.\n\n— Top Cash Cellular`,
      },
    ],
  },
];

export function getSequence(slug: string): Sequence | undefined {
  return SEQUENCES.find((s) => s.slug === slug);
}

// Cumulative day-offset of a step from enrollment (sum of delays up to it).
export function cumulativeDelayDays(seq: Sequence, position: number): number {
  return seq.steps.filter((s) => s.position <= position).reduce((sum, s) => sum + s.delayDays, 0);
}
