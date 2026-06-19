// Shared paginated reader for the Mission Control comms feed.
//
// MC's live feed is capped (COMMS_CAP, currently 5000) and trims-on-write,
// archiving the overflow. A single `GET /api/comms?limit=N` therefore can
// only ever see the newest min(N, CAP) messages — so any route that
// reconstructs state from the firehose (admin lead views, reminders,
// analytics, …) silently loses everything older than that window once the
// feed is full (it is). See the cliff comments in app/api/admin/leads.
//
// MC now exposes two additive params (shipped 2026-06-19):
//   - before=<ISO ts> : only messages strictly OLDER than the cursor
//   - includeArchive=true : also read the trimmed-overflow archive
// This helper pages backward with `before` (deduping by id) so callers can
// read a full, bounded history instead of a single capped slice.

const MC_API = "https://missioncontrolsdjg-production.up.railway.app";

export type McMessage = {
  id: string;
  body?: string;
  timestamp: string;
  from?: string;
  fromName?: string;
  role?: string;
  to?: string | null;
  tags?: string[];
  priority?: string;
  source?: string | null;
};

export type FetchCommsOpts = {
  apiKey: string;
  // Per-request page size (MC caps at COMMS_CAP). 1000 is a good balance of
  // round-trips vs payload.
  pageSize?: number;
  // Hard safety cap on round-trips so a runaway never loops forever.
  maxPages?: number;
  // Stop paging once we've reached messages older than (now - sinceMs).
  // Omit to page until exhausted (full history) up to maxPages.
  sinceMs?: number;
  // Descend into the trimmed-overflow archive (needed for full history; not
  // needed when sinceMs keeps you inside the recent live window).
  includeArchive?: boolean;
};

/**
 * Page backward through MC comms and return the combined messages in
 * ascending timestamp order (same order a single GET returns), deduped by id.
 *
 * Bounded by `maxPages` and, optionally, a `sinceMs` recency floor. On any
 * page fetch error we stop and return what we have so far (best-effort — the
 * caller's previous behaviour was a single best-effort fetch too).
 */
export async function fetchCommsPaged(opts: FetchCommsOpts): Promise<McMessage[]> {
  const {
    apiKey,
    pageSize = 1000,
    maxPages = 12,
    sinceMs,
    includeArchive = true,
  } = opts;

  const floorTs = sinceMs ? Date.now() - sinceMs : 0;
  const byId = new Map<string, McMessage>();
  let before: string | undefined;

  for (let page = 0; page < maxPages; page++) {
    const qs = new URLSearchParams({ limit: String(pageSize) });
    if (includeArchive) qs.set("includeArchive", "true");
    if (before) qs.set("before", before);

    let msgs: McMessage[] = [];
    try {
      const r = await fetch(`${MC_API}/api/comms?${qs.toString()}`, {
        headers: { "x-api-key": apiKey },
        cache: "no-store",
      });
      if (!r.ok) break;
      const data = await r.json();
      msgs = Array.isArray(data.messages) ? data.messages : [];
    } catch {
      break;
    }
    if (msgs.length === 0) break;

    for (const m of msgs) if (m?.id) byId.set(m.id, m);

    // Messages come back ascending, so the first is the oldest in the page.
    const oldestTs = msgs[0]?.timestamp;
    // Exhausted (got a short page) → nothing older remains.
    if (msgs.length < pageSize) break;
    // Reached the recency floor → no need to page further back.
    if (floorTs && oldestTs && new Date(oldestTs).getTime() < floorTs) break;
    // Advance the cursor. `before` is strictly older-than; dedup-by-id above
    // absorbs any boundary overlap on the next page.
    if (!oldestTs || oldestTs === before) break; // no progress guard
    before = oldestTs;
  }

  return [...byId.values()].sort((a, b) =>
    String(a.timestamp).localeCompare(String(b.timestamp)));
}
