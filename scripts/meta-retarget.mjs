// Launch (or dry-run) the /go RETARGETING set through the Marketing API —
// docs/go-ads-playbook.md §3, never launched by hand (0 `fbrt` sessions in
// the 2026-09-23 review). Everything is created in ONE run: the website
// custom audience, a reach campaign, the ad set ($5/day, frequency-capped,
// no Advantage+ expansion), the image, the creative and the ad.
//
//   node scripts/meta-retarget.mjs --dry            # print every payload, create nothing
//   node scripts/meta-retarget.mjs --live           # create everything PAUSED
//   node scripts/meta-retarget.mjs --live --active  # create it delivering
//
// Needs META_ADS_TOKEN: a System User token with ads_management on the ad
// account (Business Settings → Users → System users → Generate token → assets:
// ad account 692790242391713 + the TCC Facebook Page + pixel 1111162571586544).
// The CAPI token on Vercel can't do this — it only carries
// read_ads_dataset_quality (checked 2026-09-23).
//
// Env (all optional but the token): META_PAGE_ID (discovered via /me/accounts
// when exactly one page is visible), META_AD_ACCOUNT (act_692790242391713),
// META_PIXEL_ID (1111162571586544), RETARGET_DAILY_USD (5), RETARGET_DAYS (30).
//
// 2026-09-23: the UI build (Sonny's Chrome) created the same shape by hand —
// audience "GO visitors or quoted - no lead (30d)", campaign
// 120253453374960577, ad set 120253453374980577 (drafts). The quote-viewer-
// only pool (ViewContent/InitiateCheckout) was ~30 people and Meta flagged it
// too small to deliver, so the pool is everyone who OPENED /go (URL rule) or
// saw a quote anywhere (InitiateCheckout), minus Lead.
// Created ids are written to scripts/ad-assets/out/retarget-launch.json.
import { readFileSync, writeFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const here = path.dirname(fileURLToPath(import.meta.url));
const args = new Set(process.argv.slice(2));
const DRY = !args.has("--live");
const ACTIVE = args.has("--active");
const V = "v21.0";
const TOKEN = process.env.META_ADS_TOKEN || "";
const ACT = process.env.META_AD_ACCOUNT || "act_692790242391713";
const PIXEL = process.env.META_PIXEL_ID || "1111162571586544";
const DAILY = Math.round(Number(process.env.RETARGET_DAILY_USD || 5) * 100); // cents
const DAYS = Number(process.env.RETARGET_DAYS || 30);
const LINK = "https://topcashcellular.com/go?src=fbrt";
const IMAGE = path.join(here, "ad-assets/out/retarget-square.png");
const STATUS = ACTIVE ? "ACTIVE" : "PAUSED";

// Copy — seller language, Sonny's voice (i/we, cash, no hype).
// Truthful for EVERY visitor in the pool (most never saw a number).
const PRIMARY =
  "still got that phone? tap back in and pick up right where you left off — your number's one tap away. " +
  "cash in hand in austin, or a free fedex label anywhere in the US. even cracked.";
const HEADLINE = "still selling it? pick up where you left off";
const DESCRIPTION = "cash in austin · free label anywhere in the US";

if (!DRY && !TOKEN) {
  console.error("META_ADS_TOKEN is not set — see the header of this file.");
  process.exit(1);
}

async function graph(method, p, body, { multipart = false } = {}) {
  const url = `https://graph.facebook.com/${V}/${p}`;
  if (DRY) {
    console.log(`\n[dry] ${method} ${url}\n` + (multipart ? "(multipart: image file + access_token)" : JSON.stringify(body, null, 2)));
    return { id: `dry-${p.replace(/\W+/g, "-")}`, images: { "retarget-square.png": { hash: "dry-hash" } }, data: [{ id: "dry-page", name: "dry page" }] };
  }
  let res;
  if (multipart) {
    const fd = new FormData();
    for (const [k, v] of Object.entries(body)) {
      if (v instanceof Blob) fd.append(k, v, "retarget-square.png");
      else fd.append(k, typeof v === "string" ? v : JSON.stringify(v));
    }
    fd.append("access_token", TOKEN);
    res = await fetch(url, { method, body: fd });
  } else if (method === "GET") {
    const q = new URLSearchParams({ ...body, access_token: TOKEN });
    res = await fetch(`${url}?${q}`);
  } else {
    const form = new URLSearchParams({ access_token: TOKEN });
    for (const [k, v] of Object.entries(body)) form.set(k, typeof v === "string" ? v : JSON.stringify(v));
    res = await fetch(url, { method, body: form });
  }
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.error) {
    throw new Error(`${method} ${p} → ${res.status}: ${JSON.stringify(json.error || json).slice(0, 600)}`);
  }
  return json;
}

const created = {};
try {
  // 0. The Page that fronts the ad (creatives must post as a Page).
  let pageId = process.env.META_PAGE_ID || "";
  if (!pageId) {
    const pages = await graph("GET", "me/accounts", { fields: "id,name" });
    const list = pages.data || [];
    if (list.length !== 1) throw new Error(`set META_PAGE_ID — visible pages: ${JSON.stringify(list)}`);
    pageId = list[0].id;
    console.log(`page: ${list[0].name} (${pageId})`);
  }

  // 1. Website custom audience: tapped a model (ViewContent) or saw a quote
  //    (InitiateCheckout) in the last N days, minus anyone who left contact
  //    (Lead) in the same window. The un-contacted quote viewers are the only
  //    people this set exists for.
  const pixelRule = (event) => ({
    event_sources: [{ id: PIXEL, type: "pixel" }],
    retention_seconds: DAYS * 86400,
    filter: { operator: "and", filters: [{ field: "event", operator: "eq", value: event }] },
  });
  const goVisit = {
    event_sources: [{ id: PIXEL, type: "pixel" }],
    retention_seconds: DAYS * 86400,
    filter: { operator: "and", filters: [{ field: "url", operator: "i_contains", value: "topcashcellular.com/go" }] },
  };
  const audience = await graph("POST", `${ACT}/customaudiences`, {
    name: `GO visitors or quoted - no lead (${DAYS}d)`,
    subtype: "WEBSITE",
    description: "opened /go or saw a quote, never left contact - retarget pool for /go?src=fbrt",
    prefill: true,
    rule: {
      inclusions: { operator: "or", rules: [goVisit, pixelRule("InitiateCheckout")] },
      exclusions: { operator: "or", rules: [pixelRule("Lead")] },
    },
  });
  created.audienceId = audience.id;
  console.log("audience:", audience.id);

  // 2. A reach campaign of its own — the Lead campaign's ad sets must optimize
  //    for Lead, which never exits learning on a ~100-person pool. Reach +
  //    a frequency cap shows the card to everyone in the pool a few times a
  //    week and stops there; the money is the cap, not the audience.
  const campaign = await graph("POST", `${ACT}/campaigns`, {
    name: "TCC GO — Retarget (quoted, no contact)",
    objective: "OUTCOME_AWARENESS",
    status: STATUS,
    special_ad_categories: [],
    buying_type: "AUCTION",
  });
  created.campaignId = campaign.id;
  console.log("campaign:", campaign.id);

  // 3. Ad set: $5/day, US, the audience only (no Advantage+ expansion — that
  //    would turn a retargeting set back into a cold one), FB + IG feed and
  //    story, Audience Network off, 3 impressions per person per week.
  const adset = await graph("POST", `${ACT}/adsets`, {
    name: "Retarget — /go tapped or quoted, no contact — reach",
    campaign_id: campaign.id,
    status: STATUS,
    daily_budget: DAILY,
    billing_event: "IMPRESSIONS",
    optimization_goal: "REACH",
    bid_strategy: "LOWEST_COST_WITHOUT_CAP",
    frequency_control_specs: [{ event: "IMPRESSIONS", interval_days: 7, max_frequency: 3 }],
    targeting: {
      geo_locations: { countries: ["US"] },
      age_min: 18,
      custom_audiences: [{ id: audience.id }],
      publisher_platforms: ["facebook", "instagram"],
      facebook_positions: ["feed", "profile_feed", "story"],
      instagram_positions: ["stream", "profile_feed", "story"],
      targeting_automation: { advantage_audience: 0 },
    },
  });
  created.adsetId = adset.id;
  console.log("ad set:", adset.id);

  // 4. The creative image (scripts/ad-assets/gen-retarget.mjs output).
  const png = readFileSync(IMAGE);
  const img = await graph("POST", `${ACT}/adimages`, { filename: new Blob([png], { type: "image/png" }) }, { multipart: true });
  const hash = Object.values(img.images || {})[0]?.hash;
  if (!hash) throw new Error(`no image hash in ${JSON.stringify(img).slice(0, 300)}`);
  created.imageHash = hash;
  console.log("image hash:", hash);

  // 5. Creative — standard enhancements OFF (Meta's AI rewrites the copy and
  //    crops the card otherwise; the skill notes say uncheck it every time).
  const creative = await graph("POST", `${ACT}/adcreatives`, {
    name: "retarget — your quote's saved",
    object_story_spec: {
      page_id: pageId,
      link_data: {
        image_hash: hash,
        link: LINK,
        message: PRIMARY,
        name: HEADLINE,
        description: DESCRIPTION,
        call_to_action: { type: "GET_QUOTE", value: { link: LINK } },
      },
    },
    degrees_of_freedom_spec: { creative_features_spec: { standard_enhancements: { enroll_status: "OPT_OUT" } } },
  });
  created.creativeId = creative.id;
  console.log("creative:", creative.id);

  // 6. The ad.
  const ad = await graph("POST", `${ACT}/ads`, {
    name: "retarget — your quote's saved → /go?src=fbrt",
    adset_id: adset.id,
    creative: { creative_id: creative.id },
    status: STATUS,
  });
  created.adId = ad.id;
  console.log("ad:", ad.id);

  created.status = STATUS;
  created.dailyBudgetUsd = DAILY / 100;
  created.link = LINK;
  created.at = new Date().toISOString();
  if (!DRY) {
    writeFileSync(path.join(here, "ad-assets/out/retarget-launch.json"), JSON.stringify(created, null, 2));
    console.log(`\nDONE — ${STATUS}. ids saved to scripts/ad-assets/out/retarget-launch.json`);
    if (!ACTIVE) console.log("Flip the campaign, ad set and ad to ACTIVE in Ads Manager (or rerun with --active before creating).");
  } else {
    console.log("\n[dry] nothing created.");
  }
} catch (e) {
  console.error("\nFAILED:", e.message);
  if (Object.keys(created).length) console.error("created so far (clean these up in Ads Manager or reuse them):", created);
  process.exit(1);
}
