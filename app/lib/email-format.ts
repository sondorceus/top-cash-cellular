// Client-safe email checks — format, typo suggestion, disposable detection.
// NO Node imports (no DNS), so this is safe to import into client components
// (the funnel) for instant inline feedback. The server-side MX/deliverability
// check lives in email-validate.ts, which re-uses these.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function normalizeEmail(e: string): string {
  return (e || "").trim().toLowerCase();
}

export function looksLikeEmail(e: string): boolean {
  const v = normalizeEmail(e);
  return EMAIL_RE.test(v) && !v.includes("..") && !v.startsWith(".") && v.length <= 254;
}

// Misspelled popular domains -> the correct one.
const DOMAIN_TYPOS: Record<string, string> = {
  "gmial.com": "gmail.com", "gmai.com": "gmail.com", "gmal.com": "gmail.com",
  "gmaill.com": "gmail.com", "gnail.com": "gmail.com", "gmail.con": "gmail.com",
  "gmail.cm": "gmail.com", "gmail.co": "gmail.com", "gmailo.com": "gmail.com",
  "yahooo.com": "yahoo.com", "yaho.com": "yahoo.com", "yahoo.con": "yahoo.com",
  "yahoo.co": "yahoo.com", "ymail.con": "ymail.com",
  "hotmial.com": "hotmail.com", "hotmai.com": "hotmail.com", "hotmal.com": "hotmail.com",
  "hotmail.con": "hotmail.com", "hotmail.co": "hotmail.com", "hotnail.com": "hotmail.com",
  "outlok.com": "outlook.com", "outloo.com": "outlook.com", "outlook.con": "outlook.com",
  "iclould.com": "icloud.com", "iclod.com": "icloud.com", "icould.com": "icloud.com",
  "icloud.con": "icloud.com", "icloud.co": "icloud.com",
  "live.con": "live.com", "aol.con": "aol.com", "comcast.com": "comcast.net",
};

// TLD typos on otherwise-fine domains.
function fixTld(domain: string): string | null {
  if (domain.endsWith(".con")) return domain.slice(0, -4) + ".com";
  if (domain.endsWith(".cmo")) return domain.slice(0, -4) + ".com";
  if (domain.endsWith(".vom")) return domain.slice(0, -4) + ".com";
  if (domain.endsWith(".cm")) return domain.slice(0, -3) + ".com";
  if (/(gmail|yahoo|hotmail|outlook|icloud|live|aol)\.co$/.test(domain)) return domain.slice(0, -3) + ".com";
  return null;
}

// If the address has an obvious typo, return the corrected version.
export function suggestEmail(email: string): string | null {
  const e = normalizeEmail(email);
  const at = e.lastIndexOf("@");
  if (at < 1) return null;
  const local = e.slice(0, at);
  const domain = e.slice(at + 1);
  if (DOMAIN_TYPOS[domain]) return `${local}@${DOMAIN_TYPOS[domain]}`;
  const tld = fixTld(domain);
  if (tld && tld !== domain) return `${local}@${tld}`;
  return null;
}

const DISPOSABLE = new Set([
  "mailinator.com", "guerrillamail.com", "guerrillamail.info", "10minutemail.com",
  "tempmail.com", "temp-mail.org", "throwawaymail.com", "yopmail.com", "trashmail.com",
  "getnada.com", "sharklasers.com", "dispostable.com", "maildrop.cc", "fakeinbox.com",
  "mailnesia.com", "tempmailo.com", "emailondeck.com", "mintemail.com", "spam4.me",
  "grr.la", "guerrillamail.biz", "mohmal.com", "tmail.com", "tmpmail.org", "33mail.com",
]);

export function isDisposableEmail(email: string): boolean {
  const d = normalizeEmail(email).split("@")[1] || "";
  return DISPOSABLE.has(d);
}

// One-shot client-side check returning a user-facing message + optional fix.
// Empty string = valid (or empty input — caller decides if required).
export function emailFieldError(emailRaw: string): { message: string; suggestion?: string } | null {
  const e = normalizeEmail(emailRaw);
  if (!e) return null;
  if (!looksLikeEmail(e)) {
    const s = suggestEmail(e);
    return { message: s ? `Did you mean ${s}?` : "That doesn't look like a valid email.", suggestion: s || undefined };
  }
  const s = suggestEmail(e);
  if (s) return { message: `Did you mean ${s}?`, suggestion: s };
  if (isDisposableEmail(e)) return { message: "Please use a real email (temporary inboxes aren't accepted)." };
  return null;
}
