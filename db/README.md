# TCC storefront

**Status: v1 BUILT (2026-07-10, same day as the scaffolding).** Skywalker asked
for the full sell side so he can start posting. The live surface is:

- `/shop` + `/shop/[id]` — public storefront (dark theme, brand green, native chrome)
- `/admin/shop` — posting cockpit (model datalist, live price suggestion, photo upload)
- `/api/shop`, `/api/shop/buy`, `/api/admin/shop` — feed / claim / CRUD
- Persistence: **Vercel Blob** (`app/lib/shop-listings.ts`), NOT the Postgres
  schema below. Random-suffixed pathname so costCents never sits at a guessable
  public URL; the public API strips cost. v1 sells by **reservation** (claim →
  on_hold → owner closes by cash/Zelle/Cash App), so there is no checkout race
  for Blob to lose. Buyer PII goes to MC comms + owner email only, never the blob.
- Marking sold auto-writes the `[SALE: …]` profit-ledger message (Platform
  "TCC Shop"), format-verified against the parser — cost pre-filled from the
  listing. `saleLogged:false` in the PATCH response means the MC write did NOT
  land (e.g. rotated key) and the sale needs manual entry on /admin/profit.

The Postgres schema in this directory is still the **destination** for when
Stripe checkout lands; `db/schema.sql` remains unexecuted until then.

The storefront sells refurbished devices TCC bought through the buyback funnel.
It is the reverse money flow from everything else in this repo: `/sell` is us
buying from a customer, `/shop` would be us selling to one. Do not conflate the
two — opposite fraud profile, opposite tax treatment, opposite direction.

## What exists

| File | Purpose |
|---|---|
| `db/schema.sql` | Inventory, orders, and `claim_unit()` — the reservation primitive |
| `app/lib/shop-grades.ts` | Intake condition → listing grade. Refuses to guess. |
| `app/lib/shop-pricing.ts` | Listing price, margin diagnostics, direct-vs-eBay net |

## Decisions already locked in (don't re-litigate)

- **Build at `/shop` in this app**, not Shopify on a subdomain. ItsWorthMore
  runs Shopify at `buy.itsworthmore.com`; we don't, because `/shop` inherits a
  domain that already ranks, reuses the 869 device images, the design system,
  Resend, Twilio, and the FedEx pipeline — and because Shopify can't see the
  buyback customer list, which is the warmest possible source of buyers.
- **Stripe hosted Checkout**, not a hand-rolled one. It carries PCI, Stripe Tax
  (Austin = TX nexus, 8.25%), and Radar. Used electronics sold card-not-present
  are a fraud magnet.
- **One listing per physical device.** Skywalker 2026-07-10: "the condition and
  stuff should go out as I post, not like the customers get to pick when buying.
  I only sell what I have." Grade, battery, and price are set once at post time
  and displayed. There is no grade picker and no variant pool. IWM sells a
  configuration and lets you choose a grade from interchangeable stock; we sell
  *that phone*. A listing disappears when it sells — no backorders, no qty > 1.
- **Three sellable grades**: Excellent, Good, Fair. `broken` never lists — it's
  parts. We do not copy IWM's seven tiers; a grade is a promise, and intake only
  inspects four buckets.
- **30-day returns. No 12-month warranty.** (Skywalker, 2026-07-10.) IWM's
  12-month warranty is a balance-sheet commitment backed by a repair bench and a
  reserve account, not a line of copy.

## Open questions

- **Undercut %.** `suggestListing()` currently lists *at* comp. A stranger
  comparing our $286 iPhone against the same phone on eBay — with eBay's buyer
  protection behind it — has no reason to pick us at the same price. Either
  undercut 5–10% or make the 30-day return the reason. Add `TCC_SHOP_UNDERCUT`
  when decided.
- **Photos.** `app/lib/device-images.ts` has one photo per *model*, no colour or
  storage dimension. IWM lists on stock photos + an honest grade, which is the
  only tractable option at our volume. High-value units may warrant real photos
  via the existing `/api/upload` + `/api/ai/photo-check` intake pipeline.

## Deliberately NOT done

`DIRECT_FEE_MULT` (≈0.971) in `shop-pricing.ts` is the sell-side twin of
`EBAY_FEE_MULT` (0.87) in `resell-estimates.ts`. Swapping the buyback cap to it
raises every cap-bound offer ~11% (on a $400-resell phone: $261 → $291) at
identical margin, because we'd no longer be paying eBay's 13%. **This is the
strongest strategic reason to own the storefront** — the store feeds the funnel.

It is a one-line diff in `app/lib/quote.ts` and it is **not wired**, because it
changes what customers get paid, and trade-in prices never move without
Skywalker's explicit go-ahead.

## Bringing it up, when the time comes

1. Provision Postgres (Neon is in the Vercel marketplace; TCC is already on
   Vercel): `vercel integration add neon`, then `vercel env pull .env.local`.
2. Apply the schema: `psql "$DATABASE_URL" -f db/schema.sql`.
   Requires `pgcrypto` or PG13+ for `gen_random_uuid()`.
3. Add a Postgres client — `@neondatabase/serverless` for the edge-friendly
   driver. Nothing in this repo talks to a database yet; this is the first.
4. Stripe: account, then `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET`. Wire
   `checkout.session.completed` → mark `shop_order.status='paid'`, flip the
   reserved units to `sold`.
5. Cron `release_expired_reservations()` every minute, alongside the existing
   crons in `app/api/cron/`.

**Money is integer cents in the database and dollars in `shop-pricing.ts`** (to
match `comp-economics.ts`). Cross the boundary only through `toCents`/
`fromCents`. Mixing them silently is how you ship a 100× pricing bug.
