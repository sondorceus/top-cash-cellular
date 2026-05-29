// Single source of truth for the customer-facing brand identifiers.
// Added 2026-05-24 after audit found `info@topcashcellular.com` had
// silently drifted into /privacy while every other page used
// `support@topcashcellular.com`. Customers emailing the privacy
// address got no response.
//
// Migration: existing files keep their local `const BRAND = …` / etc.
// declarations to avoid touching 55 callers in one commit; new code and
// any file being edited for other reasons should import from here. As
// callers migrate, the local copies can be deleted.

export const BRAND = "Top Cash Cellular";

// Domain note: support email now lives on the marketing domain,
// support@topcashcellular.com (Skywalker 2026-05-29 — consolidated off the
// old topcashcells.com mailbox). topcashcellular.com is the domain verified
// for sending (Resend DKIM + SES SPF), so replies/mailto are all one domain.
export const EMAIL = "support@topcashcellular.com";
export const EMAIL_HREF = `mailto:${EMAIL}`;
export const SUPPORT_DOMAIN = "topcashcellular.com";
export const MARKETING_DOMAIN = "topcashcellular.com";

// No public phone number: the old Twilio toll-free was retired and never
// replaced with a working line. Customers reach us by email (EMAIL above);
// local-meetup sellers get a text from Skywalker's own phone. Do not
// reintroduce a PHONE_* constant until a real, working number is in service.

export const CITY = "Austin";
export const STATE = "TX";
export const LOCATION_DISPLAY = `${CITY}, ${STATE}`;
