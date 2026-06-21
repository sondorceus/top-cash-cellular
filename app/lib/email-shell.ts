// =========================================================================
// UNIFIED EMAIL SHELL — one polished, Outlook-safe wrapper for every TCC
// email. Modeled on the Notary project's mailShell (the visual-quality
// bar Skywalker set 2026-06-19): table-based layout, inline styles,
// role="presentation", a hidden preheader, a VML button fallback so CTAs
// render as real rounded buttons in Outlook, and one consistent header +
// footer. Replaces the assortment of fragile <div>-based one-offs.
//
// Brand tokens are TCC's dark/green identity (NOT the notary gold).
// =========================================================================

import { imageForModel } from "./device-images";

export const MAIL = {
  bg: "#13142b", // outer body — dark navy
  card: "#1b1d39", // content card
  ink: "#ffffff", // headings
  body: "#cfd2e0", // body copy
  muted: "#8a8fa3", // labels / secondary
  faint: "#7d8099", // legal / tertiary
  green: "#00c853", // primary accent + button
  greenInk: "#0a0a0a", // text on green button
  yellow: "#ffb400", // secondary accent (reviews/offers)
  yellowInk: "#1a1100",
  border: "rgba(255,255,255,0.08)",
  panel: "rgba(255,255,255,0.03)",
  font: "-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif",
} as const;

// Brand wordmark for email headers — a styled-text lockup that mirrors
// the site nav (white "TOP CASH" over bright-green "CELLULAR"). Single
// source of truth: every email header uses this instead of a logo image,
// so they all render crisp, on-brand (exact MAIL.green), correctly sized,
// and with nothing to load. inline-block so it sits left or centered
// depending on the parent's text-align. Skywalker — replaced the oversized
// forest-green glass PNG that didn't match the site.
export function mailLogo(): string {
  return (
    `<div style="display:inline-block;font-family:${MAIL.font};line-height:1;text-align:left;">` +
    `<div style="font-size:25px;font-weight:800;letter-spacing:-0.5px;color:${MAIL.ink};">TOP CASH</div>` +
    `<div style="font-size:13px;font-weight:700;letter-spacing:4px;color:${MAIL.green};text-transform:uppercase;padding-top:4px;">CELLULAR</div>` +
    `</div>`
  );
}

// Absolute-URL device photo for emails, resolved from the catalog
// (imageForModel). Returns "" when there's no image for the model so the
// caller renders without a thumbnail. Emails need absolute URLs (relative
// paths don't resolve in an inbox). Note: many catalog images are
// .webp/.svg — these render in Apple Mail / Gmail / iOS but NOT Outlook
// desktop; the alt text is the graceful fallback there.
const MAIL_SITE = "https://topcashcellular.com";
export function mailDeviceImg(model: string | null | undefined, px = 64): string {
  const path = imageForModel(model || "");
  if (!path) return "";
  const src = path.startsWith("http") ? path : `${MAIL_SITE}${path}`;
  return (
    `<img src="${src}" alt="${esc(model || "Device")}" width="${px}" height="${px}" ` +
    `style="width:${px}px;height:${px}px;object-fit:contain;border:0;outline:none;display:block;border-radius:10px;background:rgba(255,255,255,0.05)" />`
  );
}

export function esc(s: unknown): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// CTA button with a VML fallback so Outlook (mso) renders a real rounded
// button instead of a bare blue link. Every other client gets the modern
// border-radius anchor. This is the single source of truth for buttons.
export function mailButton(href: string, label: string, color: "green" | "yellow" = "green"): string {
  const fill = color === "yellow" ? MAIL.yellow : MAIL.green;
  const ink = color === "yellow" ? MAIL.yellowInk : MAIL.greenInk;
  return (
    `<!--[if mso]><v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${href}" style="height:46px;v-text-anchor:middle;width:300px;" arcsize="50%" fillcolor="${fill}" stroke="f">` +
    `<center style="color:${ink};font-family:sans-serif;font-size:14px;font-weight:bold;">${esc(label)}</center></v:roundrect><![endif]-->` +
    `<!--[if !mso]><!-- --><a href="${href}" style="display:inline-block;background:${fill};color:${ink};font-weight:800;font-size:14px;text-decoration:none;padding:14px 32px;border-radius:999px;">${esc(label)}</a><!--<![endif]-->`
  );
}

// Two-column label/value table for order/trade detail blocks. Keys are
// escaped; values are treated as trusted HTML (caller escapes any
// customer-supplied text with esc()).
export function mailDetails(rows: Array<[string, string]>): string {
  return (
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${MAIL.panel};border:1px solid ${MAIL.border};border-radius:12px;margin-top:6px;">` +
    `<tr><td style="padding:14px 16px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">` +
    rows
      .map(
        ([k, v]) =>
          `<tr><td style="padding:5px 0;color:${MAIL.muted};font-size:13px;width:120px;vertical-align:top;">${esc(k)}</td>` +
          `<td style="padding:5px 0;color:${MAIL.ink};font-size:14px;font-weight:600;">${v}</td></tr>`
      )
      .join("") +
    `</table></td></tr></table>`
  );
}

export type MailShellArgs = {
  preheader?: string;
  eyebrow?: string;
  eyebrowColor?: string;
  title: string;
  titleSize?: number;
  introHtml?: string;
  contentHtml?: string;
  buttonHref?: string | null;
  buttonLabel?: string;
  buttonColor?: "green" | "yellow";
  afterButtonHtml?: string;
  footerHtml?: string; // optional fine print below the card
};

export function mailShell(a: MailShellArgs): string {
  const eyebrowColor = a.eyebrowColor || MAIL.green;
  return (
    `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="dark"></head>` +
    `<body style="margin:0;padding:0;background:${MAIL.bg};">` +
    (a.preheader ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all;">${esc(a.preheader)}</div>` : "") +
    `<div style="background:${MAIL.bg};padding:24px 12px;font-family:${MAIL.font};">` +
    `<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" align="center" style="max-width:600px;width:100%;margin:0 auto;">` +
    // Brand header — a text lockup that mirrors the site nav wordmark
    // exactly (white "TOP CASH" over bright-green "CELLULAR"). The old
    // glass PNG rendered oversized, used a duller forest-green, and didn't
    // match the site; a styled-text lockup is crisp, on-brand (exact
    // MAIL.green), correctly sized, and renders reliably everywhere with
    // no image to load. Skywalker.
    `<tr><td style="padding:4px 0 20px;text-align:center;">${mailLogo()}</td></tr>` +
    // content card
    `<tr><td><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${MAIL.card};border:1px solid ${MAIL.border};border-radius:18px;overflow:hidden;">` +
    `<tr><td style="height:4px;background:${MAIL.green};line-height:4px;font-size:0;">&nbsp;</td></tr>` +
    `<tr><td style="padding:26px 30px 4px;">` +
    (a.eyebrow ? `<div style="font-size:11px;letter-spacing:2px;text-transform:uppercase;color:${eyebrowColor};font-weight:800;">${esc(a.eyebrow)}</div>` : "") +
    `<div style="font-size:${a.titleSize || 22}px;color:${MAIL.ink};font-weight:800;margin-top:8px;line-height:1.25;">${a.title}</div>` +
    (a.introHtml ? `<div style="color:${MAIL.body};font-size:15px;margin-top:12px;line-height:1.65;">${a.introHtml}</div>` : "") +
    `</td></tr>` +
    (a.contentHtml ? `<tr><td style="padding:10px 30px 2px;">${a.contentHtml}</td></tr>` : "") +
    (a.buttonHref && a.buttonLabel ? `<tr><td style="padding:20px 30px 6px;text-align:center;">${mailButton(a.buttonHref, a.buttonLabel, a.buttonColor)}</td></tr>` : "") +
    (a.afterButtonHtml ? `<tr><td style="padding:6px 30px 10px;">${a.afterButtonHtml}</td></tr>` : "") +
    // footer
    `<tr><td style="padding:18px 30px 24px;border-top:1px solid ${MAIL.border};">` +
    `<div style="color:${MAIL.muted};font-size:12px;line-height:1.7;">Top Cash Cellular · Austin, TX · <a href="mailto:support@topcashcellular.com" style="color:${MAIL.green};text-decoration:none;">support@topcashcellular.com</a><br>Questions? Just reply to this email — a real person reads it.</div>` +
    `</td></tr></table></td></tr>` +
    (a.footerHtml ? `<tr><td style="padding:14px 10px 0;"><div style="color:${MAIL.faint};font-size:11px;line-height:1.6;">${a.footerHtml}</div></td></tr>` : "") +
    `</table></div></body></html>`
  );
}
