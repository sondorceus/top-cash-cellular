# /go ads playbook (Meta) — what to set in Ads Manager

Written 2026-09-11 from the first campaign's data (Aug 19 – Sep 11). The code side
of the audit shipped the same day; everything below is done in Ads Manager by hand.
Never paste a price into ad copy without pulling it live first (`/api/go/quote`
or the /go page itself) — the table moves.

## What the first run taught us

| Stage (src=fb1) | Count |
|---|---|
| /go visitors | ~90 over 6 delivering days |
| Engaged (any server activity) | 35 |
| Saw a real engine number | 19 |
| Left a contact | 9 sellers |
| Locked | 4 (21% of quoted) |

- Delivery stopped Aug 24 – Sep 10 because the account ran out of money. The watchdog
  now texts on the transition (`go_silent`), so a stalled campaign is noticed in a day.
- 5 of 9 contacts were junk-tier devices (iPhone 6/7/8, Moto G Play, Galaxy A16) that the
  engine can't price — each one costs a manual quote. The copy invited them.
- 14 quote-viewers left with no contact, including 17 Pro Max sellers at $755 and $585.
  They are now reachable two ways: the page's own follow-ups if they left a number, and
  the retargeting set below if they didn't.

## 1. Primary text (replace the current one)

Current: "got a phone you're done with? tap what you got — real number in 30 seconds. no
email, no signup…" — it reads as "any phone", which is exactly who showed up.

Variant A (model floor + anchor):

> iPhone 11 or newer, Galaxy S20 or newer — tap it, real number in 30 seconds.
> up to $1,425 for a 17 Pro Max right now. cash the same day in Austin, or a free
> label from anywhere. no email, no signup.

Variant B (upgrade season, launches through September):

> upgrading this month? your old iPhone or Galaxy is worth real money today — tap it,
> see the number, lock it 14 days. cash in hand in Austin or a free label.

Headline: `Tap What You Got — Cash Today` (keep). Description: `iPhone 11+ · Galaxy S20+ ·
real number in 30 seconds`.

Pull the anchor number from the live page before each edit (the value-anchor line under
the H1 shows the same three ceilings the copy should quote).

## 2. Optimization event

At ~1 Lead per day the ad set never leaves learning. Two options:

- **Stay on Lead** (current): correct signal, starved. Works once volume is 25+/week.
- **Switch to InitiateCheckout for 2–3 weeks**: fires when a seller sees a real number
  (~4/day at $20/day). Meta gets 5x the signal and finds "people who price their phone".
  Then move back to Lead. Do this if the ad set still shows "Learning limited" after a
  week of continuous delivery.

Both events come from the same pixel ("TCC Web", 1111162571586544) and now carry
`fbp`/`fbc`, so Events Manager should show match quality climbing within a day of the
deploy. Verify in Test Events by setting `META_TEST_EVENT_CODE` on Vercel for one session.

## 3. Retargeting ad set (~$5/day)

- Audience: Website → pixel `InitiateCheckout`, last 14 days, EXCLUDE `Lead` last 14 days.
- Creative: the same board image; primary text:

  > your number's still good — every quote on our page holds 14 days. tap back in and
  > it's right where you left it.

- URL: `https://topcashcellular.com/go?src=fbrt` (an 8-char-max tag; the page rehydrates
  the seller's un-locked quote card on return).
- Placement: Facebook + Instagram feeds and stories only, Audience Network off (same as
  the main set).

This is the only way to reach the quote-viewers who left no contact.

## 4. Budget guardrails

- Keep one main ad set at $20/day; do not add a second cold ad set until the first has 7
  continuous delivering days.
- If the account balance is what stops delivery, set a balance alert in Meta Billing
  and keep a card with headroom on file. The `go_silent` watchdog text is the backstop,
  not the plan.
- Lot sellers (`/go?v=lot&src=fblot`) wait until the main set is stable.

## 5. Where the numbers now live

- `/admin/analytics` → "/go ad funnel" card: sessions → quoted → contact → locked, per
  `src` tag, per day, plus the quoted-no-contact count (the retargeting audience size).
- Daily digest email: a "/go ads" line (locks + chat leads, 24h and 7d).
- Mission Control: every lock is a `[NEW BUYBACK LEAD]` with `Source: source=go ·
  content=<src>`, `Session:` and `Lock-Until:` lines.
