// Lead-money parsing helpers — single source of truth for extracting a
// dollar value from a raw lead message body.
//
// Background: a stale `/\d+/` regex caused $1,250 quotes to collapse to
// $1 across analytics + customers + leads + admin UI + AI-summary, and
// multi-device leads (which have NO Quote: field, only a "Total payout:
// $X" footer) contributed $0 to every dollar rollup. Skywalker fixed it
// in the customers route on 2026-05-24 (commit a58cc17); this file is
// the extraction so every site uses the same logic.

// Comma-aware money parser. Handles "1,250", "$1,250.50", "  $1250  ".
// Returns 0 for missing / unparseable input — matches the old contract
// so call sites can keep treating 0 as "no value".
export function parseDollarAmount(raw: string | undefined | null): number {
  if (!raw) return 0;
  const m = String(raw).match(/[\d,]+(?:\.\d+)?/);
  if (!m) return 0;
  const n = parseFloat(m[0].replace(/,/g, ""));
  return Number.isFinite(n) ? Math.round(n) : 0;
}

// Multi-device leads don't carry a `Quote:` field — their grand total
// lives in a `Total payout: $1,234` line near the bottom of the body.
// Returns 0 when absent so callers can `|| 0` it.
export function parseTotalPayoutLine(body: string | undefined | null): number {
  if (!body) return 0;
  const m = body.match(/Total payout:\s*\$([0-9,]+(?:\.\d+)?)/i);
  if (!m) return 0;
  const n = parseFloat(m[1].replace(/,/g, ""));
  return Number.isFinite(n) ? Math.round(n) : 0;
}

// "What dollar value should this lead body contribute to a $$$ rollup?"
// Cascade: Total payout footer (multi-device wins) → Quote field → Offer
// field. The body MUST be passed; quoteFieldValue/offerFieldValue should
// already be the *parsed* `parseField(body, 'Quote')` / 'Offer' strings.
//
// Pass `null` for the field args when the caller hasn't parsed them yet —
// rare, but supported so quick scripts don't have to import parseField.
export function extractLeadValueFromBody(
  body: string | undefined | null,
  quoteFieldValue?: string | null,
  offerFieldValue?: string | null,
): number {
  const total = parseTotalPayoutLine(body);
  if (total > 0) return total;
  return parseDollarAmount(quoteFieldValue || offerFieldValue);
}
