// Canonical customer-facing offer / reference number.
//
// ONE number everywhere — the done screen, the offer page, the
// confirmation email, and admin search all derive it from the real MC
// lead id so the number a customer quotes is the exact key staff paste
// into admin to pull up their lead. Before this:
//   - the done screen + offer page showed `id.slice(0,10)` (truncated —
//     dropped the unique suffix, so two leads could collide), and
//   - the confirmation email showed an unrelated `Date.now()` value that
//     mapped to NOTHING in the backend.
// It is simply the lead id, uppercased — unique and 1:1 with the lead.
export function formatOfferNumber(leadId: string | null | undefined): string {
  return (leadId || "").trim().toUpperCase();
}

// Does `query` (something a customer pasted, maybe "#MPP…-…" or
// "Offer MPP…") refer to this lead's offer number? Punctuation/“#”/“TCC”
// and case are ignored on both sides so a loosely-copied reference still
// resolves to the lead.
export function offerNumberMatches(leadId: string | null | undefined, query: string): boolean {
  const norm = (s: string) => (s || "").replace(/[^a-z0-9]/gi, "").toLowerCase();
  const q = norm(query);
  if (!q || q.length < 4) return false;
  return norm(leadId || "").includes(q);
}
