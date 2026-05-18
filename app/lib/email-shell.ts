// Shared email header used across every Resend template — Skywalker
// 2026-05-18 "put our logo on the resend email … customers get a quote
// they see the company info". One source of truth for the logo URL,
// brand color, location footnote, and layout so every email lands with
// the same identity.
//
// Inbox-avatar caveat: the round Gmail sender avatar (next to the
// sender name in the inbox list) is set via BIMI or Google's Sender
// Profile, NOT via email HTML. Both require DNS + DMARC work. This
// helper only controls what shows up INSIDE the email after the
// customer opens it. The avatar is a separate infra step (see
// MEMORY.md if you need to set it up later).

const LOGO_URL = "https://topcashcellular.com/logo.png";

export type HeaderOpts = {
  /** Big white-on-color heading line. e.g. "Payment sent" */
  title: string;
  /** Small uppercase eyebrow above the title. Defaults to "Top Cash Cellular". */
  eyebrow?: string;
  /** Gradient start color (hex). Defaults to brand green. */
  accentFrom?: string;
  /** Gradient end color (hex). Defaults to deeper brand green. */
  accentTo?: string;
  /** Text color for the heading + eyebrow. Defaults to near-black for legibility on light gradients. Pass "#fff" on dark gradients. */
  textColor?: string;
};

/** Renders the top of every TCC email — logo + brand identity + colored title strip. Returns inner-table HTML; caller wraps it in the rest of the email body. */
export function emailHeader(opts: HeaderOpts): string {
  const eyebrow = opts.eyebrow || "Top Cash Cellular";
  const from = opts.accentFrom || "#00e676";
  const to = opts.accentTo || "#00a039";
  const text = opts.textColor || "#0a0a0a";
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:linear-gradient(135deg,${from} 0%,${to} 100%);border-bottom:1px solid rgba(255,255,255,0.12)">
  <tr>
    <td style="padding:18px 28px 8px 28px;text-align:center">
      <img src="${LOGO_URL}" alt="Top Cash Cellular" width="120" height="auto" style="display:inline-block;max-width:120px;height:auto;border:0;outline:0;text-decoration:none;-ms-interpolation-mode:bicubic" />
    </td>
  </tr>
  <tr>
    <td style="padding:0 28px 22px 28px;text-align:center">
      <div style="font-size:10px;font-weight:800;letter-spacing:0.22em;text-transform:uppercase;color:${text};opacity:0.7;margin-bottom:4px">${eyebrow}</div>
      <div style="font-size:22px;font-weight:800;color:${text};line-height:1.2">${opts.title}</div>
    </td>
  </tr>
</table>`;
}

/** Standard footer with location + support email. Used at the bottom of every TCC email. */
export function emailFooter(): string {
  return `<div style="padding:0 28px 28px 28px">
  <div style="height:1px;background:rgba(255,255,255,0.08);margin-bottom:18px"></div>
  <div style="font-size:12px;color:#888;line-height:1.6;text-align:center">
    Questions? Reply directly or write to <a href="mailto:CustomerService@topcashcells.com" style="color:#00c853;text-decoration:none;font-weight:600">CustomerService@topcashcells.com</a><br>
    <span style="color:#666">Top Cash Cellular · Austin, TX · <a href="https://topcashcellular.com" style="color:#666;text-decoration:none">topcashcellular.com</a></span>
  </div>
</div>`;
}
