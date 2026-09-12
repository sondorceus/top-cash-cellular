// Where a lead came from, in words Sonny reads at a glance (2026-09-12:
// "tell me where the lead came from — fb, google, site visit"). The src tag
// is minted by the page that started the session: /go?src=fb1 (Meta ads),
// the site-wide chat mints "gads" when a gclid/gbraid/wbraid is on the URL,
// "fb" for an fbclid, "ig" for Instagram, otherwise "site".
export function leadSourceLabel(src: string | undefined | null, landed?: string | null): string {
  const s = (src || "").toLowerCase();
  const where = landed && landed !== "/" ? ` · ${landed}` : landed === "/" ? " · homepage" : "";
  if (/^fb(rt|lot)?\d*$/.test(s) || s === "facebook") return `Facebook ad (${s})${where}`;
  if (s === "ig" || s === "instagram") return `Instagram ad${where}`;
  if (s === "gads" || s === "google" || s === "adwords") return `Google Ads${where}`;
  if (s === "site" || s === "org" || !s) return `Site visit${where || " (direct)"}`;
  return `${s}${where}`;
}
/** "Source: …" line every lead body carries — machine part + the words. */
export function leadSourceLine(kind: "go" | "chat" | "site", src: string | undefined | null, landed?: string | null): string {
  const s = (src || "").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 10);
  const l = (landed || "").replace(/[^a-zA-Z0-9_\-/?=&.]/g, "").slice(0, 80);
  return `Source: source=${kind}${s ? ` · content=${s}` : ""}${l ? ` · landed=${l}` : ""} · from=${leadSourceLabel(s, l)}`;
}
