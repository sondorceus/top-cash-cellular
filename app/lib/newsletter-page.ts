// One small dark status page for the newsletter's link endpoints — the
// unsubscribe confirmation and the re-subscribe confirmation (2026-09-27;
// moved out of the unsubscribe route, its only home until then, so the two
// render identically and share the "tampered or expired" body).
import { mailLogo, mailPostal, esc } from "./email-shell";

export const SUPPORT_LINK_HTML =
  `<a href="mailto:support@topcashcellular.com" style="color:#00c853;text-decoration:none;font-weight:600">support@topcashcellular.com</a>`;

export function newsletterPage(title: string, bodyHtml: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="dark"><meta name="supported-color-schemes" content="dark"><title>${esc(title)}</title></head>
<body style="margin:0;padding:0;background:#13142b;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#e6e6e6">
<div style="min-height:100vh;display:flex;align-items:center;justify-content:center;padding:32px 16px">
<div style="max-width:520px;width:100%;background:#1b1d39;border:1px solid rgba(255,255,255,0.08);border-radius:18px;overflow:hidden;text-align:center">
<div style="padding:26px 28px;border-bottom:1px solid rgba(255,255,255,0.08);color:#ffffff">
<div style="margin:0 0 16px">${mailLogo()}</div>
<div style="font-size:22px;font-weight:700;line-height:1.3;color:#ffffff">${esc(title)}</div>
</div>
<div style="padding:28px;font-size:15px;line-height:1.6;color:#dcdcdc">
${bodyHtml}
</div>
<div style="padding:18px 28px 24px;border-top:1px solid rgba(255,255,255,0.06);font-size:12px;color:#888">
Top Cash Cellular · ${mailPostal()}
</div>
</div>
</div></body></html>`;
}

/** The shared "this link is no good" body; `what` names the link ("The unsubscribe link"). */
export function tamperedBodyHtml(what: string): string {
  return `<p>${esc(what)} looks tampered or expired. Email ${SUPPORT_LINK_HTML} and we'll handle it manually.</p>`;
}
