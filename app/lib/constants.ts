// Single source of truth for the customer-facing brand identifiers.
// Added 2026-05-24 after audit found `info@topcashcellular.com` had
// silently drifted into /privacy while every other page used
// `CustomerService@topcashcells.com`. Customers emailing the privacy
// address got no response.
//
// Migration: existing files keep their local `const BRAND = …` / etc.
// declarations to avoid touching 55 callers in one commit; new code and
// any file being edited for other reasons should import from here. As
// callers migrate, the local copies can be deleted.

export const BRAND = "Top Cash Cellular";

// Domain note: branding is "Top Cash Cellular" / topcashcellular.com,
// but customer email lives on the shorter `topcashcells.com` mailbox
// (separate from the marketing domain). Don't "fix" this to match the
// marketing domain — the mailbox is intentionally on the short domain.
export const EMAIL = "CustomerService@topcashcells.com";
export const EMAIL_HREF = `mailto:${EMAIL}`;
export const SUPPORT_DOMAIN = "topcashcells.com";
export const MARKETING_DOMAIN = "topcashcellular.com";

// Twilio toll-free that publishes the brand in caller-ID. Display form
// is what we show; href form is the tel: dial string. Owner cell is
// the on-call routing target — NOT shown to customers.
export const PHONE_E164 = "+18775492056";
export const PHONE_DISPLAY = "(877) 549-2056";
export const PHONE_HREF = `tel:${PHONE_E164}`;

export const CITY = "Austin";
export const STATE = "TX";
export const LOCATION_DISPLAY = `${CITY}, ${STATE}`;
