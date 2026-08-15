# top-cash-cellular (TCC) — read this first

Device buyback funnel, `/shop` storefront, and a Facebook Messenger sales AI.
Next.js on Vercel. **This one takes real customer traffic and real money.**

**Live:** topcashcellular.com
**Last updated:** 2026-08-15 by Powerhouse.

---

## ⚠️ Two rules before you touch anything

**1. This repo is SHARED with ClaudMX, and the local `master` usually runs
behind origin.** A Vercel deploy ships your *local tree*, not origin. So:

```
git fetch
git merge --ff-only origin/master     # NEVER skip this
npx vercel deploy --prod
```

Skipping it overwrites whatever he shipped. Coordinate before deploying if
he has unpushed work in flight.

**2. Never change a price without Skywalker's explicit approval.** Not a
guideline. Prices are his decision, every time, and "it looked wrong" is not
authorization.

## How pricing actually works (the part that bites)

- `PRICE_TABLE` is the source of truth for what a device pays. Watches and
  several other categories quote from the table, **not** from a base price.
- **Chip adjustments in `pc-laptop-specs` are ABSOLUTE, not deltas.**
  `processors[].adj` already includes the base. Never re-add `base_price` in
  funnel math — if a quote looks wrong, suspect the DATA first.
- ⚠️ **`RESELL_ESTIMATES` silently caps a quote.** Adding a device there caps
  its funnel quote at resell × 0.87 × 0.75 (eBay fee buffer × margin). This
  has caused two separate regressions. Devices TCC deliberately overpays for
  (Apple Watch Ultra 2/3, Series 10/11) must stay OUT of that file.
- Phone "broken" pricing is `target − 25` by convention. That is not a bug.
- After ANY iPhone price edit, run `node scripts/check-buyer-sheet.mjs`.
- Owner rules encoded in the sheet: unlocked may go slightly over, locked
  stays under, 17PM is sheet − 80, T-Mobile +25 / AT&T −35 on 14 and newer.
- A server-side quote cap (`server-quote-cap.ts`) is authoritative — the
  client cannot talk the server into a higher number.

Read the `tcc-pricing` skill before touching any of this.

## The pieces

| Area | Notes |
|---|---|
| Funnel | Device → condition → quote → checkout. Calm `popThenRun` animation on selection steps; the 3D phone flip is ONLY for the hero and the local/ship CTAs. |
| `/shop` storefront | Live since 2026-07-10. Blob-backed reservations, admin at `/admin/shop`, inquiries land in Mission Control tagged `[SHOP-INQUIRY]`. Read `db/README.md` first. |
| Messenger AI | `app/api/msgr-ai`, `msgr-brain`, `msgr-signals` + a follow-up cron. Both transports live with PSID dedupe. Read the `tcc-msgr-ai` skill before editing. |
| Admin | Google OAuth web-flow with a proxy email allowlist. Customer side stays on GSI. |
| Theot's access | She manages slots/prices/customers/P&L via `x-admin-token`; the token is in the MC vault at key `tcc_admin_token`. |

## Standing constraints

- **No PII storage.** Do not ask for or store government IDs, SSNs or full
  dates of birth. Vercel Blob is public-URL-only; any PII feature stays gated
  off until signed-URL or encrypted storage exists.
- Rate limits and a quote-tamper guard are in place. Don't loosen them to fix
  a UX complaint.

## Open threads

- 45 flagged underbids awaiting Skywalker's decision.
- Samsung deduction rules are not built.
- REQUOTE ratios are approximate.
- eBay comps are stale (the `scrape-ebay-sold.py` matcher can't find the
  newest models), so the cap uses an interim buffer instead of real net.
