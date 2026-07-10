-- TCC storefront schema (Postgres / Neon).
--
-- Why a real database, when the rest of TCC stores everything as text in the
-- Mission Control comms feed: inventory is one-of-one. There is exactly ONE
-- physical iPhone 14 Pro 256GB Space Black in Excellent condition. Two buyers
-- can load its page at the same moment. An append-only message log has no way
-- to express "claim this unit only if nobody else has" — so it oversells, and
-- overselling a refurb store means refunds, chargebacks, and reviews.
--
-- Everything below exists to make that impossible. See claim_unit() at the
-- bottom; it is the most important query in the storefront.
--
-- MONEY IS INTEGER CENTS everywhere in this file. app/lib/shop-pricing.ts works
-- in dollars because comp-economics.ts does. Cross the boundary only through
-- toCents()/fromCents().

-- ---------------------------------------------------------------------------
-- sku — a browse/grouping key, NOT a thing you can buy.
--
-- Its only job is to let a category page say "iPhone 14 Pro — 3 available,
-- from $231". Clicking through lists the three actual phones. A buyer always
-- purchases a specific `unit` row, never a configuration.
--
-- ItsWorthMore does the opposite: they sell (model, storage, colour, carrier)
-- and let the buyer pick a grade as a variant, drawing from a pool of
-- interchangeable units. That works at their volume. TCC sells one-of-one —
-- Skywalker 2026-07-10: "the condition and stuff should go out as I post, not
-- like the customers get to pick when buying. I only sell what I have."
--
-- The upside of our model is real: because a listing IS a physical device, it
-- can show that device's actual battery health and its actual photos. IWM
-- cannot.
-- ---------------------------------------------------------------------------
create table if not exists sku (
  id            text primary key,              -- e.g. 'ip14pro-256-spaceblack-unlocked'
  model_label   text not null,                 -- 'iPhone 14 Pro' — must match RESELL_ESTIMATES keys
  price_sku     text not null,                 -- prefix drives familyForSku() in comp-economics.ts
  storage       text,                          -- '256GB'; null for devices without storage tiers
  color         text,
  carrier       text not null default 'unlocked',
  image_path    text,                          -- from app/lib/device-images.ts
  created_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- unit — one physical device we own. Quantity is always exactly 1.
--
-- cost_cents is carried over from the buyback lead that produced this unit,
-- which is what finally kills the hand-typed sales ledger in
-- app/admin/profit/page.tsx: profit computes itself the moment a unit sells.
-- ---------------------------------------------------------------------------
create table if not exists unit (
  id             uuid primary key default gen_random_uuid(),
  sku_id         text not null references sku(id),
  grade          text not null check (grade in ('excellent','good','fair')),
  imei           text unique,                  -- null for non-cellular (MacBook, console)
  battery_pct    int check (battery_pct between 0 and 100),
  cost_cents     int not null check (cost_cents >= 0),
  list_cents     int check (list_cents >= 0),
  lead_id        text,                         -- provenance back into the MC comms feed
  status         text not null default 'intake'
                 check (status in ('intake','listed','reserved','sold','returned','scrapped')),
  reserved_until timestamptz,
  order_id       uuid,
  acquired_at    timestamptz not null default now(),
  sold_at        timestamptz,

  -- A reserved unit must carry both an expiry and an order; a listed one must
  -- carry neither. Enforcing it here means a bug in the reservation code
  -- surfaces as a constraint violation, not as a double-sold phone.
  constraint reserved_has_expiry check (
    (status = 'reserved' and reserved_until is not null and order_id is not null)
    or (status <> 'reserved' and reserved_until is null)
  ),
  constraint listed_needs_price check (status <> 'listed' or list_cents is not null)
);

-- Browse: "what do we have listed under this model, cheapest first". The claim
-- itself needs no index — it targets a single row by primary key.
create index if not exists unit_browse_idx
  on unit (sku_id, status, list_cents);

-- Sweeper index — small, but this runs on a cron every minute.
create index if not exists unit_reserved_expiry_idx
  on unit (reserved_until) where status = 'reserved';

-- ---------------------------------------------------------------------------
-- shop_order — a customer buying FROM us. Distinct from a buyback lead, which
-- is us buying from them. Do not conflate the two; they have opposite money
-- flow, opposite fraud profiles, and opposite tax treatment.
-- ---------------------------------------------------------------------------
create table if not exists shop_order (
  id                 uuid primary key default gen_random_uuid(),
  email              text not null,
  phone              text,
  stripe_session_id  text unique,              -- set once Stripe Checkout opens
  status             text not null default 'pending'
                     check (status in ('pending','paid','shipped','delivered','refunded','cancelled')),
  subtotal_cents     int not null default 0 check (subtotal_cents >= 0),
  tax_cents          int not null default 0 check (tax_cents >= 0),
  total_cents        int not null default 0 check (total_cents >= 0),
  fulfilment         text not null default 'ship' check (fulfilment in ('ship','pickup')),
  tracking           text,
  created_at         timestamptz not null default now(),
  paid_at            timestamptz,

  -- 30-day return window opens at delivery, per Skywalker 2026-07-10.
  return_deadline    timestamptz
);

create index if not exists shop_order_status_idx on shop_order (status, created_at desc);

alter table unit
  add constraint unit_order_fk foreign key (order_id) references shop_order(id);

-- ---------------------------------------------------------------------------
-- order_item — the unit(s) on an order, with price frozen at purchase time.
-- Never join through to unit.list_cents for historical reporting: list price
-- moves, and a refund six weeks later must refund what was actually charged.
-- ---------------------------------------------------------------------------
create table if not exists order_item (
  id            uuid primary key default gen_random_uuid(),
  order_id      uuid not null references shop_order(id) on delete cascade,
  unit_id       uuid not null unique references unit(id),   -- one-of-one: a unit sells once
  price_cents   int not null check (price_cents >= 0),
  cost_cents    int not null check (cost_cents >= 0)        -- snapshot, for margin reporting
);

-- ===========================================================================
-- claim_unit — reserve THIS specific unit, or return nothing.
--
-- The buyer already chose a physical phone, so there is no pool to pick from.
-- What remains is the race: two people click Buy on the same listing in the
-- same second. Exactly one may win.
--
-- `and status = 'listed'` in the WHERE is what makes this a real
-- compare-and-swap, and the reason is subtle enough to write down. Under
-- Postgres's default READ COMMITTED isolation, the second UPDATE blocks on the
-- first one's row lock; when the first commits, the second re-evaluates its
-- WHERE clause against the NEW row version (EvalPlanQual). It sees
-- status='reserved', the predicate no longer holds, and it updates 0 rows and
-- returns nothing. Correct, with no explicit locking.
--
-- This depends on READ COMMITTED. Run it under REPEATABLE READ and the second
-- transaction aborts with a serialization failure instead of returning empty —
-- still safe, but the caller must retry rather than show "sold out". Do not
-- change the isolation level without fixing the caller.
-- ===========================================================================
create or replace function claim_unit(
  p_unit_id  uuid,
  p_order_id uuid,
  p_hold     interval default interval '15 minutes'
) returns uuid
language sql
as $$
  update unit set
    status         = 'reserved',
    reserved_until = now() + p_hold,
    order_id       = p_order_id
  where id = p_unit_id
    and status = 'listed'
  returning id;
$$;

-- Release reservations that never got paid. Run on a cron every minute; a
-- unit held by an abandoned checkout must go back on sale on its own.
create or replace function release_expired_reservations() returns int
language sql
as $$
  with released as (
    update unit set status = 'listed', reserved_until = null, order_id = null
    where status = 'reserved' and reserved_until < now()
    returning 1
  )
  select count(*)::int from released;
$$;

-- Category-page roll-up: "iPhone 14 Pro — 3 available, from $231". The product
-- page itself reads `unit` directly and shows the three phones, each with its
-- own grade, battery, and price.
--
-- Reserved units are excluded everywhere. A held unit is not for sale, and
-- showing it produces a checkout that dies at claim time — the one failure a
-- one-of-one store cannot afford, because there is no second copy to fall back
-- on.
create or replace view sku_availability as
  select
    u.sku_id,
    count(*)          as available,
    min(u.list_cents) as from_price_cents
  from unit u
  where u.status = 'listed'
  group by u.sku_id;
