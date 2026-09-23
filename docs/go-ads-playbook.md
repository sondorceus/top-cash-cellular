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

## 0. The Austin leak — found and FIXED 2026-09-23

The live ad set `Austin broad — /go — Lead` (120252918721740577) targets Austin, TX +25 mi,
but its location control has **"Reach more people likely to respond to your ads — also
show ads to people who are interested in or near this location"** switched ON (Meta's
default). That is why Dallas / Houston / San Antonio / out-of-state sellers keep
messaging: Meta is allowed to serve the Austin ad to anyone "interested in" Austin.
FIXED 2026-09-23 (Sonny: "fix the leak"): the box is unchecked and published; the
estimated audience went from 9.7–11.4M to 3.0–3.5M. Learning restarted. Meta's Review
tab does not show this box; open the Locations editor to see it. Same day: budget
$20 → $35/day (Sonny), "Conversions API with Meta" connected (Meta-hosted server copy
of pixel events, dedups on event_id with our own CAPI), and the card hold that had
stopped delivery was funded. Placement breakdown (30d, before the fix): Facebook Feed
in-app 12 leads / $74.89, FB Reels 3 / $16.32, Marketplace 1 / $2.94, Instagram ≈9 leads
/ ≈$39, everything else under $3 — no placement worth cutting.

Gotcha seen while building the retarget set: unchecking the box right after picking a
new location silently reverted the location to "United States" (twice). Pick the
location, wait for "All edits saved", reload and confirm it in the Review tab, THEN
uncheck the box, and reload/confirm again.

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

- **Audience (exists, 2026-09-23):** `GO visitors or quoted - no lead (30d)` = pixel
  "TCC Web", URL contains `topcashcellular.com/go` OR `InitiateCheckout`, last 30 days,
  EXCLUDE `Lead` last 30 days. The quote-viewer-only version (the Aug 20
  `GO engaged - no lead (30d)`, ViewContent only) is ~30 people and Meta flags it too
  small to deliver; this one is everyone who opened /go from the ad (~150 in 30 days).
  Only about a fifth of located sellers are in the Austin metro, so an Austin-only
  location on this set shrinks it below what Meta delivers to — Sonny's call.
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

  > still got that phone? tap back in and pick up right where you left off — your
  > number's one tap away. cash in hand in austin, or a free fedex label anywhere in
  > the US. even cracked.

  Headline `still selling it? pick up where you left off` · description `cash in austin ·
  free label anywhere in the US` · CTA "Get quote" · URL
  `https://topcashcellular.com/go?src=fbrt` (the page shows "your chat is saved — pick
  up where you left off" to a returning browser).

**Draft state (2026-09-23, built in Sonny's Chrome):** campaign
`TCC GO - Retarget (visited or quoted, no contact)` (120253453374960577, Awareness, ad
set budget) → ad set `Retarget - /go visited or quoted, no contact - reach`
(120253453374980577: Maximize reach, cap 3 per 7 days, $5/day from Sep 23, no end,
Austin, TX +25 mi 18+ with the "interested in or near" expansion OFF (Sonny 2026-09-23:
"austin only"), the audience above with Advantage+ audience OFF, placements Facebook +
Instagram feeds/profile feeds + FB/IG Stories only). Campaign score 42: the missing
points are Meta's own widen-the-audience suggestions (Advantage+ placements +46,
reach outside the location +12), both deliberately declined) → ad `New Awareness Ad` (120253453374970577) —
still EMPTY (no media/text). Finishing it: open the draft, name it, Identity = Top Cash
Cellular (+ Instagram), Set up creative → upload `retarget-square.png` (feeds) and
`retarget-story.png` (stories), the copy above, Website URL, turn OFF translations /
Advantage+ creative enhancements / text variations, then publish ONLY this campaign
(the account also holds 2 older drafts in "Review and publish" — never bulk-publish).

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

## 3b. Reels video ad — LIVE 2026-09-23 (in Meta review)

Built by hand in Ads Manager (Sonny: "we have to make video, you take full control").
Ad `payout board — reels video` (120253455870570577) sits in the main Austin ad set
(120252918721740577, $35/day) next to the two image ads, so it competes for the same
budget and Meta will shift spend toward whichever creative wins.

- **Creative:** `scripts/ad-assets/out/reel-9x16.mp4` from `gen-reel.mjs` +
  `encode-frames.swift` (12 s, 1080×1920, silent; live prices $1,425 / $600 / $371,
  final card "get paid today"). No Meta music was added — add it later if the Reels
  placement wants audio (Opportunity-score item "Reels video with audio").
- **Text:** same primary text and headline as the image ads (`Tap What You Got — Cash
  Today`), description empty, CTA **Get quote**.
- **Destination:** `https://topcashcellular.com/go?src=fb1`, display link
  `topcashcellular.com/go`, browser add-on **None** (default was Messenger),
  multi-advertiser ads **off**, pixel TCC Web.
- **Every Meta AI extra is off:** video touch-ups, text improvements, add details to ad
  layout, website summaries, website highlights, site links, enhance CTA, show
  spotlights, add video effects, "reveal details over time". Only "relevant comments"
  stays on. Entering the website URL silently turns several of these back on — recheck
  Creative setup (should read 0/3) and Essential enhancements (1/4) after any URL edit.
- Expected warning: "won't deliver to Facebook right column" (desktop-only, image-only).
- Published alone ("1 ad was published"); the retarget campaign's 3 drafts and
  "July run - Copy" are still unpublished.

**What to watch (first 7 days):** in the Ads tab with Breakdown → Placement, compare
cost per Website Lead of the video vs the two image ads. Before this ad, FB Reels
was 3 leads / $16.32 in 30 days on image creative; the video should take more of
the Reels/Stories delivery. If the video's cost per lead is >2× the image ads after
~$100 of spend, pause it rather than let Meta keep testing it.

## 4. Budget guardrails

- Keep one main ad set at $35/day (raised from $20 on 2026-09-23); do not add a second cold ad set until the first has 7
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
