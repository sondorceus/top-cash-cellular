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

// Shared dark email shell — matches TCC's transactional emails (dark navy +
// crisp green accent, no white theme, no green glow). `cta` is the button.
function shell(opts: { heading: string; bodyHtml: string; ctaUrl: string; ctaLabel: string }): string {
  return `<!doctype html><html><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;background:#13142b;color:#e6e6e6;margin:0;padding:32px 16px"><div style="max-width:600px;margin:0 auto;background:#1b1d39;border:1px solid rgba(255,255,255,0.08);border-radius:18px;overflow:hidden"><div style="padding:24px 28px"><img src="https://topcashcellular.com/logo-wordmark-glass.png" alt="Top Cash Cellular" width="150" style="display:block;width:150px;height:auto;border:0;outline:none;margin:0 0 16px" /><div style="font-size:22px;font-weight:800;line-height:1.15;color:#fff">${opts.heading}</div></div><div style="padding:4px 28px 28px">${opts.bodyHtml}<div style="text-align:center;margin:24px 0 6px"><a href="${opts.ctaUrl}" style="display:inline-block;padding:14px 30px;background:#00c853;color:#0a0a0a;font-weight:800;font-size:14px;text-decoration:none;border-radius:999px">${opts.ctaLabel}</a></div><p style="font-size:12px;color:#7d8099;line-height:1.6;text-align:center;margin:18px 0 0;padding-top:14px;border-top:1px solid rgba(255,255,255,0.08)">Not looking to sell anymore? Just ignore this — we won't keep nudging. Questions? Reply to this email or write support@topcashcellular.com.</p></div></div></body></html>`;
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
            heading: `Your offer's still locked in, ${v.firstName}`,
            bodyHtml:
              p(`Hi ${v.firstName}, just a friendly note that your ${v.device} offer${v.quote ? ` of <strong style="color:#fff">${v.quote}</strong>` : ""} is still good.`) +
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
            heading: `Still want to sell your ${v.device}?`,
            bodyHtml:
              p(`Hi ${v.firstName} — checking in one last time on your ${v.device}${v.quote ? ` (${v.quote})` : ""}.`) +
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
