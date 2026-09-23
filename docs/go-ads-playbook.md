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
- The MacBook, iPad and Console tiles produced zero contacts because they dropped into a
  chat that asked for a phone number before showing a number. All three now quote
  instantly like phones (the ad copy can say "phones, iPads, MacBooks, consoles" honestly).

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

## 3. Retargeting ad set (~$5/day) — BUILT 2026-09-23, one action from launch

Everything below exists in the repo; the only missing piece is a way to act on the ad
account (the CAPI token on Vercel carries `read_ads_dataset_quality` only, and Claude
in Chrome has to be signed in on Sonny's Chrome).

- **Audience:** Website → pixel "TCC Web" `InitiateCheckout` OR `ViewContent`, last 30
  days, EXCLUDE `Lead` last 30 days = tapped a model or saw a quote, never left contact
  (the only people this set exists for; ~50–100 at today's volume).
- **Campaign:** its own — `TCC GO — Retarget (quoted, no contact)`, Awareness/Reach. A
  second ad set inside the Lead campaign would have to optimize for Lead, which never
  exits learning on a ~100-person pool. Reach + a frequency cap (3 per 7 days) shows the
  card to everyone a few times a week and then stops spending — the cap is the budget.
- **Ad set:** $5/day, US, the audience only, Advantage+ audience OFF (expansion would
  turn it back into a cold set), Facebook + Instagram feed and story, Audience Network
  off.
- **Creative:** `scripts/ad-assets/out/retarget-square.png` (+ `retarget-story.png`),
  rendered by `npx tsx scripts/ad-assets/gen-retarget.mjs` with the live 17 Pro Max
  ceiling. Copies land in `~/Downloads/tcc-ads/`. Primary text:

  > still got that phone? your number's saved on our page — tap back in and it's right
  > where you left it. cash in hand in austin, or a free fedex label anywhere in the US.
  > even cracked.

  Headline `your quote's saved — pick it back up` · description `cash in austin · free
  label anywhere in the US` · CTA "Get quote" · URL
  `https://topcashcellular.com/go?src=fbrt` (the page shows "your chat is saved — pick
  up where you left off" to a returning browser).

**Launch, path A (API, one command):** in Business Settings → Users → System users →
generate a token with `ads_management` for ad account 692790242391713 + the TCC Page +
the pixel, then:

```bash
META_ADS_TOKEN=<token> node scripts/meta-retarget.mjs --live --active
```

(`--dry` prints every payload and creates nothing; `--live` without `--active` creates
it all PAUSED.) The created ids are written to `scripts/ad-assets/out/retarget-launch.json`.

**Launch, path B (Ads Manager, Claude in Chrome):** sign in to the Claude side panel in
Chrome and say "launch the retarget"; the agent builds the audience (Audiences → Create
→ Website, rules as above), the campaign/ad set/ad with the settings above, and uploads
the PNG with the media-picker patch from `.claude/skills/make-ads/SKILL.md`.

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
