"use client";
import { useEffect, useMemo, useState } from "react";

// Price editor — every entry in the PRICE_TABLE and CARRIER_DEDUCTIONS
// constants becomes an editable cell. Saves go to /api/admin/prices which
// persists overrides to Vercel Blob; the customer funnel merges those
// overrides at request time on top of the bundled defaults.
//
// Grouping: device families (iPhone / Galaxy / Pixel / MacBook / iPad / etc.)
// are derived from the model-ID prefix so we don't have to maintain a
// hand-curated taxonomy alongside the data.

// 2026-05-19: VG removed from the live funnel — see CONDITIONS in
// app/page.tsx. We keep the slug `mint` (relabeled "Excellent" in UI)
// to avoid a data migration on existing leads + admin overrides.
const CONDITION_ORDER = ["sealed", "mint", "good", "fair", "broken"] as const;
const CARRIER_KEYS = ["att", "tmobile", "other"] as const;
// Pretty labels for each condition column header.
const CONDITION_LABELS: Record<string, string> = {
  sealed: "Sealed", mint: "Excellent", good: "Good", fair: "Fair", broken: "Broken",
};

// Map a model ID prefix → display group label. First match wins, so order
// most-specific → most-generic.
const GROUPS: Array<{ prefix: string; label: string }> = [
  { prefix: "ip", label: "iPhone" },
  { prefix: "gs", label: "Samsung Galaxy S" },
  { prefix: "gn", label: "Samsung Galaxy Note" },
  { prefix: "gz", label: "Samsung Galaxy Z (Fold/Flip)" },
  { prefix: "ga", label: "Samsung Galaxy A" },
  { prefix: "px", label: "Google Pixel" },
  { prefix: "mbp", label: "MacBook Pro" },
  { prefix: "mba", label: "MacBook Air" },
  { prefix: "mac", label: "Mac Desktop" },
  { prefix: "ipad", label: "iPad" },
  { prefix: "tab", label: "Samsung Tab" },
  { prefix: "applewatch", label: "Apple Watch" },
  { prefix: "pixelwatch", label: "Pixel Watch" },
  { prefix: "samsungwatch", label: "Samsung Watch" },
  { prefix: "garmin", label: "Garmin" },
  { prefix: "ln_", label: "Lenovo Laptop" },
  { prefix: "hp_", label: "HP Laptop" },
  { prefix: "dell_", label: "Dell Laptop" },
  { prefix: "alien", label: "Alienware" },
  { prefix: "as_", label: "ASUS" },
  { prefix: "ac_", label: "Acer" },
  { prefix: "sgbk_", label: "Samsung Galaxy Book" },
  { prefix: "lg_", label: "LG Laptop" },
];

function groupForModel(id: string): string {
  for (const g of GROUPS) {
    if (id.startsWith(g.prefix)) return g.label;
  }
  return "Other";
}

type PriceTable = Record<string, Record<string, Record<string, number>>>;
type CarrierTable = Record<string, Record<string, number>>;
type BasePricedModel = { category: string; label: string; base: number; inquiryOnly?: boolean; image?: string };
type AdditiveSpec = { source: "macbook" | "pc"; label: string; condition_adj: Record<string, number> };
type AtlasReference = {
  scraped_at?: string;
  sources?: Record<string, string>;
  categories?: Record<string, Record<string, Record<string, number | null>>>;
  counts?: Record<string, number>;
};
type IwmReference = {
  scraped_at?: string;
  source?: string;
  note?: string;
  models?: Record<string, Record<string, Record<string, number>>>;
};
type EbayCell = { count: number; average: number; median: number; net_average?: number; net_median?: number; min: number; max: number; rejected_outliers?: number };
type EbayReference = {
  scraped_at?: string;
  source?: string;
  note?: string;
  models?: Record<string, {
    label?: string;
    family?: string;
    by_cell?: Record<string, Record<string, EbayCell>>;
    samples?: Array<{ price: number; title: string; cond: string }>;
    unmatched?: number;
    outliers_rejected?: number;
  }>;
};
type Payload = {
  baseline: {
    priceTable: PriceTable;
    carrierDeductions: CarrierTable;
    basePricedModels?: Record<string, BasePricedModel>;
    additiveSpecs?: Record<string, AdditiveSpec>;
  };
  overrides: {
    priceTable: PriceTable;
    carrierDeductions: CarrierTable;
    baseOverrides?: Record<string, number>;
    conditionAdj?: Record<string, Record<string, number>>;
    updatedAt?: string;
  };
  effective: { priceTable: PriceTable; carrierDeductions: CarrierTable };
  history?: Array<{ url: string; pathname: string; uploadedAt: string }>;
  atlasReference?: AtlasReference;
  iwmReference?: IwmReference;
  ebayReference?: EbayReference;
  marginByModel?: Record<string, MarginRow>;
  // perCellMargin[sku][storage][condition][carrierKey] — carrierKey is
  // "unlocked" / "att" / "tmobile" / "other". Only populated cells with
  // Atlas comp data are present.
  perCellMargin?: Record<string, Record<string, Record<string, Record<string, CellMarginRow>>>>;
  skuLabels?: Record<string, string>;
};
type MarginRow = { label: string; payout: number; resell: number | null; margin: number | null; marginPct: number | null };
type CellMarginRow = { payout: number; resell: number; margin: number; marginPct: number };

// Tiny per-cell margin chip — rendered under each PRICE_TABLE input. Show
// the unlocked margin %, with locked variants summarized in the tooltip.
function CellMarginChip({ cell }: { cell?: Record<string, CellMarginRow> }) {
  if (!cell) return <span className="text-[9px] text-[#333]">·</span>;
  const unl = cell.unlocked;
  const primary = unl ?? cell.att ?? cell.tmobile ?? cell.other;
  if (!primary) return <span className="text-[9px] text-[#333]">·</span>;
  const pct = primary.marginPct;
  const tone =
    pct >= 25 ? "text-[#00c853]" :
    pct >= 10 ? "text-yellow-300" :
    "text-red-300";
  // Build a multi-line tooltip with every variant we have data for.
  const lines: string[] = [];
  for (const [k, v] of Object.entries(cell)) {
    const label = k === "unlocked" ? "Unlocked" : k.toUpperCase();
    const sign = v.margin >= 0 ? "+" : "";
    lines.push(`${label}: pay $${v.payout} · resell $${v.resell} · margin ${sign}$${v.margin} (${sign}${v.marginPct}%)`);
  }
  return (
    <span className={`text-[9px] font-mono tabular-nums ${tone}`} title={lines.join("\n")}>
      {pct >= 0 ? "+" : ""}{pct}%
    </span>
  );
}

// Margin chip — green ≥25%, yellow 10–24%, red <10%, gray when unknown.
// Click target is small but visually scannable so Skywalker can spot
// loss-makers in a long list. Tooltip shows the raw payout vs resell math.
function MarginChip({ row }: { row?: MarginRow }) {
  if (!row) return null;
  if (row.resell == null || row.marginPct == null) {
    return (
      <span
        className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white/[0.03] text-[#666] border border-white/5"
        title="No resell comp in RESELL_ESTIMATES — margin can't be computed. Add an Atlas/Swappa value to app/lib/resell-estimates.ts to track this device."
      >
        no comp
      </span>
    );
  }
  const pct = row.marginPct;
  const tone =
    pct >= 25 ? "text-[#00c853] bg-[#00c853]/10 border-[#00c853]/30" :
    pct >= 10 ? "text-yellow-300 bg-yellow-500/10 border-yellow-500/30" :
    "text-red-300 bg-red-500/10 border-red-500/40";
  const sign = pct >= 0 ? "+" : "";
  // Tooltip flags the Atlas-variant assumption: the resell value is the
  // grade_a unlocked 256GB (smallest standard tier) Atlas buy price.
  // Real exit value varies — carrier-locked is ~25-30% less, 1TB/2TB pay
  // more, broken/cracked drop to grade_c/d/DOA. The chip is a single-point
  // representative estimate, not per-cell exact.
  return (
    <span
      className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${tone}`}
      title={`Max payout $${row.payout} · resell est $${row.resell} (Atlas grade_a unlocked) · margin ${row.margin && row.margin >= 0 ? "+" : ""}$${row.margin}\n\nNote: Atlas pays less for carrier-locked (~−25%) and broken/cracked (grade_c/d/DOA tiers). Higher storage tiers (1TB/2TB) pay more. This chip is a representative single-point estimate.`}
    >
      {sign}{pct}%
    </span>
  );
}

// Display labels for Atlas categories
const ATLAS_CATEGORY_LABELS: Record<string, string> = {
  iphones_used: "Used iPhones (Grade A/B/C/D/DOA)",
  iphones_nib: "NIB iPhones (Sealed/Open)",
  ipads_used: "Used iPads (Grade A/B/C/D/DOA)",
  ipads_nib: "NIB iPads (Sealed/Open/Sealed-Activated)",
  pixel: "Google Pixel",
  apple_watches: "Apple Watch",
  macbooks: "MacBooks (by SKU)",
  samsung: "Samsung phones",
  mdm_locked_iphones: "MDM-Locked iPhones",
  icloud_locked_iphones: "iCloud-Locked iPhones",
  airpods: "AirPods",
};

export default function PricesAdminPage() {
  const [data, setData] = useState<Payload | null>(null);
  const [token, setToken] = useState<string>("");
  const [edits, setEdits] = useState<{
    price: PriceTable;
    carrier: CarrierTable;
    base: Record<string, number>;
    condAdj: Record<string, Record<string, number>>;
  }>({ price: {}, carrier: {}, base: {}, condAdj: {} });
  const [saving, setSaving] = useState(false);
  const [lastSaveMsg, setLastSaveMsg] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>("");
  const [marginFilter, setMarginFilter] = useState<"all" | "green" | "yellow" | "red" | "nocomp">("all");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  // Predicate: does this SKU pass the active margin filter? Used alongside
  // the text filter in every device section.
  const passesMarginFilter = (id: string): boolean => {
    if (marginFilter === "all") return true;
    const r = data?.marginByModel?.[id];
    if (marginFilter === "nocomp") return !r || r.marginPct == null;
    if (!r || r.marginPct == null) return false;
    if (marginFilter === "green") return r.marginPct >= 25;
    if (marginFilter === "yellow") return r.marginPct >= 10 && r.marginPct < 25;
    if (marginFilter === "red") return r.marginPct < 10;
    return true;
  };

  // Restore the admin token from localStorage so the user doesn't have to
  // type it on every reload. NEVER persisted server-side; we just stash it
  // in browser localStorage like a session cookie alternative.
  useEffect(() => {
    const t = typeof window !== "undefined" ? localStorage.getItem("tcc-admin-token") : null;
    if (t) setToken(t);
  }, []);

  useEffect(() => {
    fetch("/api/admin/prices")
      .then((r) => r.json())
      .then(setData)
      .catch(() => {});
  }, []);

  const grouped = useMemo(() => {
    if (!data) return new Map<string, string[]>();
    const m = new Map<string, string[]>();
    for (const id of Object.keys(data.effective.priceTable)) {
      const g = groupForModel(id);
      if (!m.has(g)) m.set(g, []);
      m.get(g)!.push(id);
    }
    for (const arr of m.values()) arr.sort();
    return m;
  }, [data]);

  const editCount = useMemo(() => {
    let n = 0;
    for (const m of Object.values(edits.price)) {
      for (const s of Object.values(m)) n += Object.keys(s).length;
    }
    for (const m of Object.values(edits.carrier)) n += Object.keys(m).length;
    n += Object.keys(edits.base).length;
    for (const m of Object.values(edits.condAdj)) n += Object.keys(m).length;
    return n;
  }, [edits]);

  if (!data) {
    return (
      <main className="min-h-screen bg-[#0a0a0a] text-white flex items-center justify-center">
        <p className="text-sm text-[#888]">Loading price grid…</p>
      </main>
    );
  }

  const setPriceCell = (model: string, storage: string, cond: string, val: number) => {
    setEdits((prev) => ({
      ...prev,
      price: {
        ...prev.price,
        [model]: {
          ...(prev.price[model] || {}),
          [storage]: { ...(prev.price[model]?.[storage] || {}), [cond]: val },
        },
      },
    }));
  };

  const setCarrierCell = (model: string, carrier: string, val: number) => {
    setEdits((prev) => ({
      ...prev,
      carrier: { ...prev.carrier, [model]: { ...(prev.carrier[model] || {}), [carrier]: val } },
    }));
  };

  const setBaseCell = (model: string, val: number) => {
    setEdits((prev) => ({ ...prev, base: { ...prev.base, [model]: val } }));
  };

  const setCondAdjCell = (model: string, condId: string, val: number) => {
    setEdits((prev) => ({
      ...prev,
      condAdj: {
        ...prev.condAdj,
        [model]: { ...(prev.condAdj[model] || {}), [condId]: val },
      },
    }));
  };

  const effectiveCondAdj = (modelId: string, condId: string, defaultVal: number): number => {
    return edits.condAdj[modelId]?.[condId] ?? data?.overrides.conditionAdj?.[modelId]?.[condId] ?? defaultVal;
  };
  const isCondAdjOverridden = (modelId: string, condId: string): boolean => {
    return (
      data?.overrides.conditionAdj?.[modelId]?.[condId] !== undefined ||
      edits.condAdj[modelId]?.[condId] !== undefined
    );
  };

  const effectiveBase = (modelId: string, defaultBase: number): number => {
    return edits.base[modelId] ?? data?.overrides.baseOverrides?.[modelId] ?? defaultBase;
  };
  const isBaseOverridden = (modelId: string): boolean => {
    return data?.overrides.baseOverrides?.[modelId] !== undefined || edits.base[modelId] !== undefined;
  };

  const effectivePrice = (model: string, storage: string, cond: string): number | undefined => {
    return edits.price[model]?.[storage]?.[cond] ?? data.effective.priceTable[model]?.[storage]?.[cond];
  };
  const effectiveCarrier = (model: string, carrier: string): number | undefined => {
    return edits.carrier[model]?.[carrier] ?? data.effective.carrierDeductions[model]?.[carrier];
  };
  const isOverridden = (model: string, storage?: string, cond?: string, carrier?: string): boolean => {
    if (carrier) return data.overrides.carrierDeductions[model]?.[carrier] !== undefined || edits.carrier[model]?.[carrier] !== undefined;
    if (storage && cond) return data.overrides.priceTable[model]?.[storage]?.[cond] !== undefined || edits.price[model]?.[storage]?.[cond] !== undefined;
    return false;
  };

  const getToken = (): string | null => {
    let t = token || localStorage.getItem("tcc-admin-token") || "";
    if (!t) {
      const prompted = window.prompt("Admin token? (will remember in this browser)");
      if (!prompted) return null;
      t = prompted;
      setToken(t);
      localStorage.setItem("tcc-admin-token", t);
    }
    return t;
  };

  const save = async () => {
    const t = getToken();
    if (!t) return;
    setSaving(true);
    setLastSaveMsg(null);
    try {
      const r = await fetch(`/api/admin/prices?token=${encodeURIComponent(t)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          priceTable: edits.price,
          carrierDeductions: edits.carrier,
          baseOverrides: edits.base,
          conditionAdj: edits.condAdj,
        }),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        setLastSaveMsg(`Save failed: ${r.status} ${j.error || ""}`);
        return;
      }
      const j = await r.json();
      setLastSaveMsg(`✓ Saved at ${new Date(j.updatedAt).toLocaleTimeString()} — ${j.overrideModels} model override(s) live`);
      setEdits({ price: {}, carrier: {}, base: {}, condAdj: {} });
      const refresh = await fetch("/api/admin/prices");
      setData(await refresh.json());
    } finally {
      setSaving(false);
    }
  };

  const undoAll = () => {
    if (editCount === 0) return;
    if (!window.confirm(`Discard ${editCount} unsaved edit${editCount === 1 ? "" : "s"}?`)) return;
    setEdits({ price: {}, carrier: {}, base: {}, condAdj: {} });
    setData((d) => (d ? { ...d } : d));
  };

  const resetCondAdj = async (modelId: string) => {
    if (!window.confirm(`Revert ${modelId} condition adjustments back to baseline?`)) return;
    const t = getToken();
    if (!t) return;
    // The DELETE ?model= scope clears price + carrier + base + condAdj for that
    // model, but we only want condAdj here. Backend doesn't yet have a
    // dedicated condAdj-only delete, so we POST an "empty overrides for this
    // model's condition_adj" — effectively reverting it. The merge in POST
    // would normally ADD keys; to delete we need to send the full new state.
    // Cheap workaround: POST with conditionAdj override removing the model
    // by sending undefined… but our merge can't unset. So use DELETE ?model=
    // which is the documented scope and accept that price/carrier/base for
    // that model are also cleared (rare to have multiple override types on
    // one model anyway).
    const r = await fetch(`/api/admin/prices?model=${encodeURIComponent(modelId)}&token=${encodeURIComponent(t)}`, { method: "DELETE" });
    if (!r.ok) return;
    setLastSaveMsg(`✓ Reverted ${modelId} condition adjustments`);
    const refresh = await fetch("/api/admin/prices");
    setData(await refresh.json());
  };

  const resetBase = async (modelId: string) => {
    if (!window.confirm(`Revert ${modelId} base price back to the bundled default?`)) return;
    const t = getToken();
    if (!t) return;
    const r = await fetch(`/api/admin/prices?base=${encodeURIComponent(modelId)}&token=${encodeURIComponent(t)}`, { method: "DELETE" });
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      setLastSaveMsg(`Reset failed: ${r.status} ${j.error || ""}`);
      return;
    }
    setLastSaveMsg(`✓ Reverted ${modelId} base price to baseline`);
    const refresh = await fetch("/api/admin/prices");
    setData(await refresh.json());
  };

  const resetCell = async (model: string, storage: string, cond: string) => {
    if (!window.confirm(`Revert ${model} / ${storage} / ${cond} back to the baseline?`)) return;
    const t = getToken();
    if (!t) return;
    const cell = `${model}/${storage}/${cond}`;
    const r = await fetch(`/api/admin/prices?cell=${encodeURIComponent(cell)}&token=${encodeURIComponent(t)}`, { method: "DELETE" });
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      setLastSaveMsg(`Reset failed: ${r.status} ${j.error || ""}`);
      return;
    }
    setLastSaveMsg(`✓ Reverted ${cell} to baseline`);
    const refresh = await fetch("/api/admin/prices");
    setData(await refresh.json());
  };

  const resetCarrier = async (model: string) => {
    if (!window.confirm(`Revert carrier deductions for ${model} back to baseline?`)) return;
    const t = getToken();
    if (!t) return;
    const r = await fetch(`/api/admin/prices?carrier=${encodeURIComponent(model)}&token=${encodeURIComponent(t)}`, { method: "DELETE" });
    if (!r.ok) return;
    setLastSaveMsg(`✓ Reverted ${model} carrier deductions to baseline`);
    const refresh = await fetch("/api/admin/prices");
    setData(await refresh.json());
  };

  const resetModel = async (model: string) => {
    if (!window.confirm(`Revert EVERY ${model} cell back to baseline?`)) return;
    const t = getToken();
    if (!t) return;
    const r = await fetch(`/api/admin/prices?model=${encodeURIComponent(model)}&token=${encodeURIComponent(t)}`, { method: "DELETE" });
    if (!r.ok) return;
    setLastSaveMsg(`✓ Reverted all ${model} overrides`);
    const refresh = await fetch("/api/admin/prices");
    setData(await refresh.json());
  };

  const resetAll = async () => {
    if (!window.confirm(`⚠️ This wipes EVERY price override on the site and reverts everything to the bundled defaults. Continue?`)) return;
    const t = getToken();
    if (!t) return;
    const r = await fetch(`/api/admin/prices?token=${encodeURIComponent(t)}`, { method: "DELETE" });
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      setLastSaveMsg(`Reset all failed: ${r.status} ${j.error || ""}`);
      return;
    }
    setLastSaveMsg(`✓ All overrides cleared`);
    setEdits({ price: {}, carrier: {}, base: {}, condAdj: {} });
    const refresh = await fetch("/api/admin/prices");
    setData(await refresh.json());
  };

  const groupNames = Array.from(grouped.keys()).sort();
  const filterLower = filter.trim().toLowerCase();

  return (
    <main className="min-h-screen bg-[#0a0a0a] text-white">
      <div className="sticky top-0 z-20 bg-[#0a0a0a]/95 backdrop-blur border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-4 flex-wrap">
          <a
            href="/admin"
            className="text-[#888] hover:text-[#00c853] text-xs font-semibold transition"
            title="Back to leads dashboard"
          >
            ← Leads
          </a>
          <h1 className="text-lg font-extrabold tracking-tight">TCC · Price Editor</h1>
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter by model ID (ip17pm, sgbk_3…)"
            className="flex-1 min-w-[200px] px-3 py-1.5 text-sm bg-black/40 border border-white/15 rounded-lg"
          />
          <span className="text-xs text-[#888]">
            {editCount} edit{editCount === 1 ? "" : "s"} pending
          </span>
          {editCount > 0 && (
            <button
              onClick={undoAll}
              className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/15 text-xs font-bold cursor-pointer transition"
              title="Throw away all unsaved edits"
            >
              ↶ Undo
            </button>
          )}
          <button
            onClick={save}
            disabled={editCount === 0 || saving}
            className="px-4 py-1.5 rounded-lg bg-[#00c853] text-black text-sm font-bold disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer hover:bg-[#00e676] transition"
          >
            {saving ? "Saving…" : `Save ${editCount}`}
          </button>
          <button
            onClick={resetAll}
            className="px-3 py-1.5 rounded-lg bg-red-500/15 hover:bg-red-500/25 border border-red-500/40 text-red-300 text-xs font-bold cursor-pointer transition"
            title="Wipe ALL price overrides and revert to bundled defaults"
          >
            ⚠ Reset All
          </button>
        </div>
        {lastSaveMsg && (
          <div className="max-w-7xl mx-auto px-4 pb-2 text-xs text-[#00c853]">{lastSaveMsg}</div>
        )}
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        <p className="text-[12px] text-[#bdbdbd] leading-snug max-w-3xl">
          Click a group to expand. Edit any cell — changes stay local until you hit{" "}
          <span className="font-bold text-white">Save</span>. Saved overrides go live on the
          customer funnel within seconds (the funnel fetches{" "}
          <code className="text-[#00c853]">/api/admin/prices</code> on each visit and merges
          overrides into the bundled defaults).
        </p>

        {/* HOW THIS WORKS — comprehensive cheat sheet. Collapsible so it
            stays out of the way once you know the system. */}
        <section className="bg-[#00c853]/[0.04] border border-[#00c853]/30 rounded-2xl overflow-hidden">
          <button
            type="button"
            onClick={() => setExpanded((p) => ({ ...p, __howto: !p.__howto }))}
            className="w-full px-5 py-3 flex items-center justify-between text-left hover:bg-[#00c853]/[0.07] transition cursor-pointer"
          >
            <span className="font-bold text-[14px] text-[#00c853]">
              📖 How to read this panel · click to {expanded.__howto ? "hide" : "show"}
            </span>
            <span className="text-[#888] text-xs">{expanded.__howto ? "▾" : "▸"}</span>
          </button>
          {expanded.__howto && (
            <div className="border-t border-[#00c853]/20 px-5 py-4 space-y-4 text-[12px] text-[#dcdcdc] leading-relaxed">
              <div>
                <p className="font-bold text-white mb-1.5">Two pricing modes — depends on the device</p>
                <ul className="space-y-1.5 list-disc pl-5">
                  <li>
                    <span className="text-[#00c853] font-bold">Phones, tablets, consoles, watches:</span>{" "}
                    <span className="text-[#bdbdbd]">direct cell lookup.</span> Each (storage × condition) cell holds the actual dollar
                    amount we pay. e.g. <code className="text-[#cfcfcf]">ip17pm 256 mint = $880</code> means we pay
                    a customer $880 (before the $25 popular-device bonus, before carrier deductions).
                  </li>
                  <li>
                    <span className="text-[#00c853] font-bold">MacBooks, PC laptops:</span>{" "}
                    <span className="text-[#bdbdbd]">additive deltas.</span> The quote is built by summing several
                    dollar adjustments:
                    <code className="text-[#cfcfcf] block mt-1 ml-1 text-[11px]">
                      base + chip_adj + ram_adj + storage_adj + condition_adj + gpu_adj + battery_adj + charger_adj
                    </code>
                    <span className="text-[#bdbdbd]">The condition_adj row in the &quot;MacBooks · condition adjustments&quot; section is just one piece of this — it&apos;s a +/− dollar amount that gets added to the running total based on which condition the customer picks.</span>
                  </li>
                </ul>
              </div>

              <div>
                <p className="font-bold text-white mb-1.5">Reading a condition_adj row (MacBook / PC)</p>
                <p className="text-[#bdbdbd]">
                  Six numbers: sealed / mint / VG / good / fair / broken. <span className="text-[#cfcfcf]">Mint is the &quot;anchor&quot; (usually 0)</span>; the
                  other tiers add or subtract from there.
                </p>
                <p className="text-[#bdbdbd] mt-1">
                  Example for <code className="text-[#cfcfcf]">mbp14m4</code>:{" "}
                  <code className="text-[#cfcfcf]">+50 / 0 / −50 / −110 / −220 / −450</code>.
                </p>
                <p className="text-[#bdbdbd] mt-1">
                  A $1500-base MacBook in <span className="text-[#cfcfcf]">good</span> condition →
                  $1500 + (−$110) = <span className="text-white font-bold">$1390</span> quoted.
                </p>
              </div>

              <div>
                <p className="font-bold text-white mb-1.5">The three reference panels at the bottom</p>
                <ul className="space-y-1.5 list-disc pl-5">
                  <li>
                    <span className="text-amber-300 font-bold">📊 Atlas</span> —{" "}
                    <span className="text-[#bdbdbd]">wholesale prices Atlas Mobile pays us when we resell devices to them. This is the canonical truth — what we&apos;d actually get if we sold off inventory. Our customer-paid quote should sit ~10-20% under Atlas to keep margin.</span>
                  </li>
                  <li>
                    <span className="text-sky-300 font-bold">🔵 IWM</span> —{" "}
                    <span className="text-[#bdbdbd]">what the main competitor (itsworthmore.com) quotes customers for the same device. Reference for staying competitive, NOT a margin floor.</span>
                  </li>
                  <li>
                    <span className="text-purple-300 font-bold">🟣 eBay sold</span> —{" "}
                    <span className="text-[#bdbdbd]">actual completed-sale prices from eBay. Shown as <span className="text-[#cfcfcf]">gross →net</span> per cell: gross is what the buyer paid, net is what the seller actually pocketed after 12-15% Final Value Fee + $0.40 fixed + $7-25 shipping. Net is the apples-to-apples vs Atlas for margin math.</span>
                  </li>
                </ul>
              </div>

              <div>
                <p className="font-bold text-white mb-1.5">Editing &amp; overrides</p>
                <ul className="space-y-1.5 list-disc pl-5">
                  <li>Type a new value in any cell — it turns <span className="text-[#00c853] font-bold">green</span> to mark it as an override.</li>
                  <li><span className="font-bold text-white">Save</span> pushes overrides to Vercel Blob; customer funnel picks up the change on the next page load (no deploy needed).</li>
                  <li>The <span className="text-red-300">↺ revert</span> link on a cell or row removes that override and falls back to the bundled code defaults.</li>
                  <li>Customer-visible price on phones = <code className="text-[#cfcfcf]">PRICE_TABLE cell + $25 popular bonus − carrier deduction</code>. The +$25 is hard-coded in the funnel; you don&apos;t edit it here.</li>
                </ul>
              </div>

              <div>
                <p className="font-bold text-white mb-1.5">Margin chips</p>
                <p className="text-[#bdbdbd]">
                  Each model header has a small percent chip:{" "}
                  <span className="text-[#00c853] font-mono text-[10px] bg-[#00c853]/10 px-1 rounded">+25%</span>{" "}
                  green = ≥25% margin vs Atlas grade_a unlocked 256GB,{" "}
                  <span className="text-yellow-300 font-mono text-[10px] bg-yellow-500/10 px-1 rounded">+12%</span>{" "}
                  yellow = 10-24%,{" "}
                  <span className="text-red-300 font-mono text-[10px] bg-red-500/10 px-1 rounded">−5%</span>{" "}
                  red = under 10% or negative.{" "}
                  <span className="text-[#cfcfcf]">Hover for the raw payout vs resell math.</span>
                </p>
              </div>
            </div>
          )}
        </section>

        {/* MARGIN SUMMARY — at-a-glance counts of green / yellow / red /
            no-comp models. Click a tone to filter the editor below to
            just those devices. */}
        {data.marginByModel && (() => {
          const rows = Object.entries(data.marginByModel);
          const buckets = { green: 0, yellow: 0, red: 0, nocomp: 0 };
          let totalMargin = 0; let counted = 0;
          for (const [, r] of rows) {
            if (r.marginPct == null) { buckets.nocomp++; continue; }
            if (r.marginPct >= 25) buckets.green++;
            else if (r.marginPct >= 10) buckets.yellow++;
            else buckets.red++;
            if (r.margin != null) { totalMargin += r.margin; counted++; }
          }
          const avg = counted > 0 ? Math.round(totalMargin / counted) : 0;
          return (
            <div className="flex items-center gap-2 flex-wrap text-[12px]">
              <span className="text-[#888]">Margin overview:</span>
              <button
                onClick={() => setMarginFilter(marginFilter === "green" ? "all" : "green")}
                className={`px-2 py-0.5 rounded border transition cursor-pointer ${marginFilter === "green" ? "border-[#00c853] bg-[#00c853]/25 text-[#00c853]" : "border-[#00c853]/40 bg-[#00c853]/10 text-[#00c853] hover:bg-[#00c853]/20"}`}
                title="Show only devices with ≥25% margin"
              >
                ● {buckets.green} green
              </button>
              <button
                onClick={() => setMarginFilter(marginFilter === "yellow" ? "all" : "yellow")}
                className={`px-2 py-0.5 rounded border transition cursor-pointer ${marginFilter === "yellow" ? "border-yellow-400 bg-yellow-500/25 text-yellow-300" : "border-yellow-500/30 bg-yellow-500/10 text-yellow-300 hover:bg-yellow-500/20"}`}
                title="10–24% margin — thin"
              >
                ● {buckets.yellow} thin
              </button>
              <button
                onClick={() => setMarginFilter(marginFilter === "red" ? "all" : "red")}
                className={`px-2 py-0.5 rounded border transition cursor-pointer ${marginFilter === "red" ? "border-red-400 bg-red-500/25 text-red-300" : "border-red-500/40 bg-red-500/10 text-red-300 hover:bg-red-500/20"}`}
                title="<10% margin or loss"
              >
                ● {buckets.red} loss-risk
              </button>
              <button
                onClick={() => setMarginFilter(marginFilter === "nocomp" ? "all" : "nocomp")}
                className={`px-2 py-0.5 rounded border transition cursor-pointer ${marginFilter === "nocomp" ? "border-white/30 bg-white/15 text-white" : "border-white/15 bg-white/[0.03] text-[#888] hover:bg-white/10"}`}
                title="No resell estimate — add one to track margin"
              >
                ● {buckets.nocomp} no comp
              </button>
              {marginFilter !== "all" && (
                <button
                  onClick={() => setMarginFilter("all")}
                  className="text-[11px] text-[#888] hover:text-white underline cursor-pointer"
                >
                  clear
                </button>
              )}
              <span className="ml-auto text-[#888]">
                Avg margin: <span className={`font-bold ${avg >= 0 ? "text-[#00c853]" : "text-red-300"}`}>${avg}</span>
              </span>
            </div>
          );
        })()}
        <p className="text-[10px] text-[#666] -mt-3 leading-snug max-w-3xl">
          Resell estimate = Atlas grade_a unlocked 256GB. Carrier-locked / broken /
          higher-storage variants exit Atlas at materially different prices —
          chip is a representative point, not exact for every cell.
        </p>

        {/* SIMPLE BASE-PRICE DEVICES — VR, drones, Garmin. These models
            have a single `base` field (no storage × condition grid),
            grouped by category for the editor. */}
        {data.baseline.basePricedModels && Object.keys(data.baseline.basePricedModels).length > 0 && (() => {
          const all = data.baseline.basePricedModels!;
          const groups = new Map<string, Array<[string, BasePricedModel]>>();
          for (const [id, m] of Object.entries(all)) {
            if (filterLower && !id.toLowerCase().includes(filterLower) && !m.label.toLowerCase().includes(filterLower)) continue;
            if (!passesMarginFilter(id)) continue;
            if (!groups.has(m.category)) groups.set(m.category, []);
            groups.get(m.category)!.push([id, m]);
          }
          const cats = Array.from(groups.keys()).sort();
          if (cats.length === 0) return null;
          return (
            <section className="bg-white/[0.03] border border-white/10 rounded-2xl overflow-hidden">
              <div className="px-5 py-3 border-b border-white/10 bg-[#00c853]/[0.04]">
                <span className="font-bold text-[15px]">Simple base-price devices</span>
                <span className="text-[#888] text-xs ml-2">VR / drones / Garmin — single price per variant</span>
              </div>
              <div className="px-5 py-3 space-y-2">
                {cats.map((cat) => {
                  const items = groups.get(cat)!;
                  const catKey = `bp:${cat}`;
                  const open = expanded[catKey] ?? !!filterLower;
                  return (
                    <div key={cat} className="bg-black/20 border border-white/5 rounded-xl overflow-hidden">
                      <button
                        type="button"
                        onClick={() => setExpanded((p) => ({ ...p, [catKey]: !open }))}
                        className="w-full px-3 py-2 flex items-center justify-between text-left hover:bg-white/[0.04] transition cursor-pointer"
                      >
                        <span className="text-[12px] uppercase tracking-wider font-bold text-[#00c853]">
                          {cat} <span className="text-[#888] font-normal normal-case">· {items.length} model{items.length === 1 ? "" : "s"}</span>
                        </span>
                        <span className="text-[#888] text-xs">{open ? "▾" : "▸"}</span>
                      </button>
                      {open && (
                      <div className="border-t border-white/5 px-3 py-2 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                        {items.map(([id, m]) => {
                          const v = effectiveBase(id, m.base);
                          const ov = isBaseOverridden(id);
                          const savedOverride = data.overrides.baseOverrides?.[id] !== undefined;
                          return (
                            <div key={id} className="flex items-center gap-2 bg-black/30 border border-white/10 rounded-lg px-2 py-1.5">
                              <div className="min-w-0 flex-1">
                                <p className="text-[12px] text-white font-semibold truncate" title={m.label}>{m.label}</p>
                                <div className="flex items-center gap-1.5">
                                  <code className="text-[10px] text-[#666]">{id}</code>
                                  <MarginChip row={data.marginByModel?.[id]} />
                                </div>
                              </div>
                              <span className="text-[10px] text-[#888]">$</span>
                              <input
                                key={`${id}-${v}`}
                                type="number"
                                defaultValue={v}
                                onChange={(e) => setBaseCell(id, parseInt(e.target.value) || 0)}
                                className={`w-20 px-1.5 py-0.5 text-right bg-black/60 rounded border ${
                                  ov ? "border-[#00c853]/50 text-[#00c853]" : "border-white/15"
                                }`}
                              />
                              {savedOverride && (
                                <button
                                  type="button"
                                  onClick={() => resetBase(id)}
                                  className="text-[10px] text-[#888] hover:text-[#00c853] cursor-pointer"
                                  title="Revert this device to bundled base price"
                                >
                                  ↺
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })()}

        {/* ADDITIVE-SPEC DEVICES — MacBooks + PC laptops. Each model has
            a per-condition adjustment table that materially affects the
            customer's quote (the chip + RAM + storage adjustments are
            also editable in future iterations; for now we surface
            condition_adj which is the most-changed lever). */}
        {data.baseline.additiveSpecs && Object.keys(data.baseline.additiveSpecs).length > 0 && (() => {
          const all = data.baseline.additiveSpecs!;
          const grouped: { macbook: string[]; pc: string[] } = { macbook: [], pc: [] };
          for (const [id, m] of Object.entries(all)) {
            if (filterLower && !id.toLowerCase().includes(filterLower) && !m.label.toLowerCase().includes(filterLower)) continue;
            if (!passesMarginFilter(id)) continue;
            grouped[m.source].push(id);
          }
          grouped.macbook.sort();
          grouped.pc.sort();
          if (grouped.macbook.length === 0 && grouped.pc.length === 0) return null;

          const renderRow = (id: string, spec: AdditiveSpec) => {
            const isModelOverridden = data.overrides.conditionAdj?.[id] !== undefined;
            return (
              <div key={id} className="bg-black/30 border border-white/10 rounded-xl p-3">
                <div className="flex items-center gap-3 mb-2 flex-wrap">
                  <code className="text-[12px] font-bold text-white">{id}</code>
                  {isModelOverridden && (
                    <button
                      type="button"
                      onClick={() => resetCondAdj(id)}
                      className="ml-auto px-2 py-0.5 text-[10px] rounded bg-white/5 hover:bg-red-500/20 hover:text-red-300 border border-white/10 text-[#888] cursor-pointer transition"
                      title="Revert this model's condition adjustments to baseline"
                    >
                      ↺ revert
                    </button>
                  )}
                </div>
                <div className="overflow-x-auto -mx-3 px-3">
                <table className="w-full min-w-[420px] text-[11px]">
                  <thead>
                    <tr className="text-[#888]">
                      {CONDITION_ORDER.map((c) => (
                        <th key={c} className="text-center font-semibold pb-1 px-0.5">
                          {CONDITION_LABELS[c] ?? c}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      {CONDITION_ORDER.map((c) => {
                        const defaultVal = spec.condition_adj[c] ?? 0;
                        const v = effectiveCondAdj(id, c, defaultVal);
                        const ov = isCondAdjOverridden(id, c);
                        return (
                          <td key={c} className="px-0.5 py-1">
                            <input
                              key={`${id}-cond-${c}-${v}`}
                              type="number"
                              defaultValue={v}
                              onChange={(e) => setCondAdjCell(id, c, parseInt(e.target.value) || 0)}
                              className={`w-full px-1 py-0.5 text-center bg-black/60 rounded border ${
                                ov ? "border-[#00c853]/50 text-[#00c853]" : "border-white/15"
                              }`}
                            />
                          </td>
                        );
                      })}
                    </tr>
                  </tbody>
                </table>
                </div>
              </div>
            );
          };

          return (
            <>
              {grouped.macbook.length > 0 && (
                <section className="bg-white/[0.03] border border-white/10 rounded-2xl overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setExpanded((p) => ({ ...p, __macbooks: !p.__macbooks }))}
                    className="w-full px-5 py-3 flex items-center justify-between text-left hover:bg-white/[0.04] transition cursor-pointer"
                  >
                    <span className="font-bold text-[15px]">
                      MacBooks · condition adjustments <span className="text-[#888] font-normal">({grouped.macbook.length} models)</span>
                    </span>
                    <span className="text-[#888] text-xs">{expanded.__macbooks ?? !!filterLower ? "▾" : "▸"}</span>
                  </button>
                  {(expanded.__macbooks ?? !!filterLower) && (
                    <div className="border-t border-white/10 px-5 py-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                      {grouped.macbook.map((id) => renderRow(id, all[id]))}
                    </div>
                  )}
                </section>
              )}
              {grouped.pc.length > 0 && (
                <section className="bg-white/[0.03] border border-white/10 rounded-2xl overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setExpanded((p) => ({ ...p, __pcs: !p.__pcs }))}
                    className="w-full px-5 py-3 flex items-center justify-between text-left hover:bg-white/[0.04] transition cursor-pointer"
                  >
                    <span className="font-bold text-[15px]">
                      PC laptops · condition adjustments <span className="text-[#888] font-normal">({grouped.pc.length} models)</span>
                    </span>
                    <span className="text-[#888] text-xs">
                      {expanded.__pcs ?? !!filterLower ? "▾" : "▸"} {!filterLower && "use filter to narrow"}
                    </span>
                  </button>
                  {(expanded.__pcs ?? !!filterLower) && (
                    <div className="border-t border-white/10 px-5 py-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                      {grouped.pc.map((id) => renderRow(id, all[id]))}
                    </div>
                  )}
                </section>
              )}
            </>
          );
        })()}

        {groupNames.map((gname) => {
          const ids = grouped.get(gname)!.filter((id) => (!filterLower || id.toLowerCase().includes(filterLower)) && passesMarginFilter(id));
          if (ids.length === 0) return null;
          const exp = expanded[gname] ?? (!!filterLower);
          return (
            <section key={gname} className="bg-white/[0.03] border border-white/10 rounded-2xl overflow-hidden">
              <button
                type="button"
                onClick={() => setExpanded((p) => ({ ...p, [gname]: !exp }))}
                className="w-full px-5 py-3 flex items-center justify-between text-left hover:bg-white/[0.04] transition cursor-pointer"
              >
                <span className="font-bold text-[15px]">
                  {gname} <span className="text-[#888] font-normal">· {ids.length} model{ids.length === 1 ? "" : "s"}</span>
                </span>
                <span className="text-[#888] text-xs">{exp ? "▾ collapse" : "▸ expand"}</span>
              </button>
              {exp && (
                <div className="border-t border-white/10 px-5 py-3 space-y-5">
                  {ids.map((modelId) => {
                    const storages = data.effective.priceTable[modelId];
                    const storageKeys = Object.keys(storages).sort((a, b) => {
                      const order = ["64","128","256","512","1tb","2tb"];
                      return order.indexOf(a) - order.indexOf(b);
                    });
                    const carrier = data.effective.carrierDeductions[modelId];
                    return (
                      <div key={modelId} className="bg-black/30 border border-white/10 rounded-xl p-3">
                        <div className="flex items-center gap-3 mb-2 flex-wrap">
                          <code className="text-[13px] font-bold text-white">{modelId}</code>
                          {data.skuLabels?.[modelId] && (
                            <span className="text-[12px] text-[#aaa]">{data.skuLabels[modelId]}</span>
                          )}
                          <MarginChip row={data.marginByModel?.[modelId]} />
                          {carrier && (
                            <span className="flex items-center gap-1 text-[11px] text-[#888]">
                              <span>Carrier:</span>
                              {CARRIER_KEYS.map((c) => {
                                const ov = isOverridden(modelId, undefined, undefined, c);
                                return (
                                  <label key={c} className="inline-flex items-center gap-1">
                                    <span className="uppercase text-[10px]">{c}</span>
                                    <input
                                      key={`${modelId}-car-${c}-${data.overrides?.priceTable && JSON.stringify(data.overrides.carrierDeductions[modelId])}`}
                                      type="number"
                                      defaultValue={effectiveCarrier(modelId, c) ?? 0}
                                      onChange={(e) => setCarrierCell(modelId, c, parseInt(e.target.value) || 0)}
                                      className={`w-16 px-1.5 py-0.5 text-[11px] text-right bg-black/60 rounded border ${
                                        ov ? "border-[#00c853]/50" : "border-white/15"
                                      }`}
                                    />
                                  </label>
                                );
                              })}
                              {data.overrides.carrierDeductions[modelId] && (
                                <button
                                  type="button"
                                  onClick={() => resetCarrier(modelId)}
                                  className="ml-1 text-[10px] text-[#888] hover:text-[#00c853] cursor-pointer"
                                  title="Revert this model's carrier deductions to baseline"
                                >
                                  ↺
                                </button>
                              )}
                            </span>
                          )}
                          {data.overrides.priceTable[modelId] && (
                            <button
                              type="button"
                              onClick={() => resetModel(modelId)}
                              className="ml-auto px-2 py-0.5 text-[10px] rounded bg-white/5 hover:bg-red-500/20 hover:text-red-300 border border-white/10 text-[#888] cursor-pointer transition"
                              title="Revert every cell on this model back to baseline"
                            >
                              ↺ revert model
                            </button>
                          )}
                        </div>
                        <div className="overflow-x-auto -mx-3 px-3">
                        <table className="w-full min-w-[520px] text-[12px]">
                          <thead>
                            <tr className="text-[#888]">
                              <th className="text-left font-semibold pb-1.5 pr-2">Storage</th>
                              {CONDITION_ORDER.map((c) => (
                                <th key={c} className="text-right font-semibold pb-1.5 px-1">
                                  {CONDITION_LABELS[c] ?? c}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {storageKeys.map((stor) => (
                              <tr key={stor} className="border-t border-white/5">
                                <td className="py-1 pr-2 font-mono text-[#dcdcdc] uppercase">{stor}</td>
                                {CONDITION_ORDER.map((cond) => {
                                  const v = effectivePrice(modelId, stor, cond);
                                  const overridden = isOverridden(modelId, stor, cond);
                                  const savedOverride = data.overrides.priceTable[modelId]?.[stor]?.[cond] !== undefined;
                                  return (
                                    <td key={cond} className="px-0.5 py-1 align-top">
                                      {v === undefined ? (
                                        <span className="block text-[10px] text-[#444] text-right">—</span>
                                      ) : (
                                        <div className="flex flex-col items-end gap-0">
                                          <div className="flex items-center justify-end gap-0.5">
                                            <input
                                              key={`${modelId}-${stor}-${cond}-${v}`}
                                              type="number"
                                              defaultValue={v}
                                              onChange={(e) => setPriceCell(modelId, stor, cond, parseInt(e.target.value) || 0)}
                                              className={`w-16 px-1.5 py-0.5 text-right bg-black/60 rounded border ${
                                                overridden ? "border-[#00c853]/50 text-[#00c853]" : "border-white/15"
                                              }`}
                                            />
                                            {savedOverride && (
                                              <button
                                                type="button"
                                                onClick={() => resetCell(modelId, stor, cond)}
                                                className="text-[10px] text-[#888] hover:text-[#00c853] cursor-pointer w-4"
                                                title="Revert this cell to baseline"
                                              >
                                                ↺
                                              </button>
                                            )}
                                          </div>
                                          <CellMarginChip cell={data.perCellMargin?.[modelId]?.[stor]?.[cond]} />
                                        </div>
                                      )}
                                    </td>
                                  );
                                })}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          );
        })}

        {/* ATLAS REFERENCE — read-only "what Atlas pays us" data, scraped
            via scripts/scrape-atlas-full.py from Atlas Mobile's two
            wholesale buy sheets. 714 entries across 11 categories. Use
            this as your sold-price baseline: TCC quotes should sit
            comfortably below these numbers. Refresh by re-running the
            scraper. */}
        {data.atlasReference && data.atlasReference.categories && (() => {
          const ref = data.atlasReference!;
          const cats = Object.entries(ref.categories || {});
          if (cats.length === 0) return null;
          const totalCount = Object.values(ref.counts || {}).reduce((s, n) => s + n, 0);
          const scrapedDate = ref.scraped_at ? new Date(ref.scraped_at).toLocaleString() : "unknown";
          return (
            <section className="bg-amber-500/[0.03] border border-amber-500/20 rounded-2xl overflow-hidden">
              <button
                type="button"
                onClick={() => setExpanded((p) => ({ ...p, __atlas: !p.__atlas }))}
                className="w-full px-5 py-3 flex items-center justify-between text-left hover:bg-amber-500/[0.05] transition cursor-pointer"
              >
                <span className="font-bold text-[15px] text-amber-200">
                  📊 Atlas Reference <span className="text-[#888] font-normal">· {totalCount} entries · read-only · {scrapedDate}</span>
                </span>
                <span className="text-[#888] text-xs">{(expanded.__atlas ?? !!filterLower) ? "▾" : "▸"}</span>
              </button>
              {(expanded.__atlas ?? !!filterLower) && (
                <div className="border-t border-amber-500/20 px-5 py-3 space-y-3">
                  <p className="text-[11px] text-[#bdbdbd]">
                    These are the prices Atlas Mobile pays you when you sell devices to them. Use them as a ceiling for what TCC quotes customers. To refresh, run <code className="text-[#00c853]">python scripts/scrape-atlas-full.py</code>.
                  </p>
                  {cats.map(([cat, entries]) => {
                    const filteredEntries = filterLower
                      ? Object.entries(entries).filter(([k]) => k.toLowerCase().includes(filterLower))
                      : Object.entries(entries);
                    if (filteredEntries.length === 0) return null;
                    const catKey = `atlas:${cat}`;
                    const open = expanded[catKey] ?? !!filterLower;
                    const label = ATLAS_CATEGORY_LABELS[cat] || cat;
                    return (
                      <div key={cat} className="bg-black/30 border border-white/5 rounded-xl overflow-hidden">
                        <button
                          type="button"
                          onClick={() => setExpanded((p) => ({ ...p, [catKey]: !open }))}
                          className="w-full px-3 py-2 flex items-center justify-between text-left hover:bg-white/[0.04] transition cursor-pointer"
                        >
                          <span className="text-[12px] uppercase tracking-wider font-bold text-amber-300">
                            {label} <span className="text-[#888] font-normal normal-case">· {filteredEntries.length} entr{filteredEntries.length === 1 ? "y" : "ies"}</span>
                          </span>
                          <span className="text-[#888] text-xs">{open ? "▾" : "▸"}</span>
                        </button>
                        {open && (
                          <div className="overflow-x-auto -mx-3 px-3 border-t border-white/5">
                            <table className="w-full min-w-[420px] text-[11px]">
                              <tbody>
                                {filteredEntries.map(([name, prices]) => (
                                  <tr key={name} className="border-t border-white/[0.04] first:border-t-0">
                                    <td className="py-1 pr-3 text-[#dcdcdc] truncate max-w-[300px]" title={name}>{name}</td>
                                    <td className="py-1 text-right">
                                      <span className="font-mono text-[#cfcfcf]">
                                        {Object.entries(prices as Record<string, number | null | number[]>).map(([col, v]) => {
                                          if (v == null) return null;
                                          if (Array.isArray(v)) return v.length ? <span key={col} className="mr-2"><span className="text-[#888]">{col}:</span> [{v.join(", ")}]</span> : null;
                                          return <span key={col} className="mr-2"><span className="text-[#888]">{col}:</span> ${v}</span>;
                                        })}
                                      </span>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          );
        })()}

        {/* IWM REFERENCE — what the main competitor (itsworthmore.com)
            quotes customers. NOT a margin floor like Atlas — IWM is what
            customers compare us against, so use this to gauge whether
            our quote sits competitively. Generated by
            scripts/audit-prices-vs-iwm.py. */}
        {data.iwmReference && data.iwmReference.models && Object.keys(data.iwmReference.models).length > 0 && (() => {
          const ref = data.iwmReference!;
          const entries = Object.entries(ref.models || {});
          if (entries.length === 0) return null;
          const scrapedDate = ref.scraped_at ? new Date(ref.scraped_at).toLocaleString() : "unknown";
          const filtered = filterLower
            ? entries.filter(([mid]) => mid.toLowerCase().includes(filterLower))
            : entries;
          return (
            <section className="bg-sky-500/[0.03] border border-sky-500/20 rounded-2xl overflow-hidden">
              <button
                type="button"
                onClick={() => setExpanded((p) => ({ ...p, __iwm: !p.__iwm }))}
                className="w-full px-5 py-3 flex items-center justify-between text-left hover:bg-sky-500/[0.05] transition cursor-pointer"
              >
                <span className="font-bold text-[15px] text-sky-200">
                  🔵 IWM Reference <span className="text-[#888] font-normal">· {entries.length} models · competitor quotes · {scrapedDate}</span>
                </span>
                <span className="text-[#888] text-xs">{(expanded.__iwm ?? !!filterLower) ? "▾" : "▸"}</span>
              </button>
              {(expanded.__iwm ?? !!filterLower) && (
                <div className="border-t border-sky-500/20 px-5 py-3 space-y-3">
                  <p className="text-[11px] text-[#bdbdbd]">
                    What <a href="https://www.itsworthmore.com/" target="_blank" rel="noreferrer" className="text-sky-300 hover:underline">itsworthmore.com</a> quotes customers for the same devices — competitor reference, NOT a margin floor. Use Atlas (above) for wholesale truth. Refresh: <code className="text-[#00c853]">python scripts/audit-prices-vs-iwm.py</code>.
                  </p>
                  <div className="bg-black/30 border border-white/5 rounded-xl overflow-hidden">
                    <div className="overflow-x-auto px-3 py-2">
                      <table className="w-full min-w-[420px] text-[11px]">
                        <tbody>
                          {filtered.map(([mid, grid]) => {
                            const rows: Array<{ s: string; c: string; v: number }> = [];
                            for (const [s, conds] of Object.entries(grid)) {
                              for (const [c, v] of Object.entries(conds)) {
                                rows.push({ s, c, v });
                              }
                            }
                            return (
                              <tr key={mid} className="border-t border-white/[0.04] first:border-t-0 align-top">
                                <td className="py-1 pr-3 text-sky-300 font-mono text-[10px]">{mid}</td>
                                <td className="py-1">
                                  <span className="font-mono text-[#cfcfcf]">
                                    {rows.map((r, i) => (
                                      <span key={i} className="mr-2 whitespace-nowrap">
                                        <span className="text-[#888]">{r.s}/{r.c}:</span> ${r.v}
                                      </span>
                                    ))}
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </section>
          );
        })()}

        {/* eBay sold-listings reference — actual final sale prices,
            bucketed by (storage, condition). Sealed = "Brand New" on
            eBay, used = "Pre-Owned", broken = "For parts or not working".
            Outliers rejected via IQR + half-median rule. Generated by
            scripts/scrape-ebay-sold.py. Purple-tinted to differentiate
            from Atlas (amber, truth) and IWM (sky, competitor). */}
        {data.ebayReference && data.ebayReference.models && Object.keys(data.ebayReference.models).length > 0 && (() => {
          const ref = data.ebayReference!;
          const entries = Object.entries(ref.models || {});
          if (entries.length === 0) return null;
          const scrapedDate = ref.scraped_at ? new Date(ref.scraped_at).toLocaleString() : "unknown";
          const filtered = filterLower
            ? entries.filter(([mid]) => mid.toLowerCase().includes(filterLower))
            : entries;
          const totalCells = entries.reduce((s, [, m]) =>
            s + Object.values(m.by_cell || {}).reduce((ss, c) => ss + Object.keys(c).length, 0), 0);
          return (
            <section className="bg-purple-500/[0.03] border border-purple-500/20 rounded-2xl overflow-hidden">
              <button
                type="button"
                onClick={() => setExpanded((p) => ({ ...p, __ebay: !p.__ebay }))}
                className="w-full px-5 py-3 flex items-center justify-between text-left hover:bg-purple-500/[0.05] transition cursor-pointer"
              >
                <span className="font-bold text-[15px] text-purple-200">
                  🟣 eBay Sold-Price Reference <span className="text-[#888] font-normal">· {entries.length} models · {totalCells} (storage × condition) cells · {scrapedDate}</span>
                </span>
                <span className="text-[#888] text-xs">{(expanded.__ebay ?? !!filterLower) ? "▾" : "▸"}</span>
              </button>
              {(expanded.__ebay ?? !!filterLower) && (
                <div className="border-t border-purple-500/20 px-5 py-3 space-y-3">
                  <p className="text-[11px] text-[#bdbdbd]">
                    Actual final sale prices from <a href="https://www.ebay.com/" target="_blank" rel="noreferrer" className="text-purple-300 hover:underline">eBay</a> completed listings, bucketed by storage + condition. Sealed/used/broken map to eBay&apos;s &quot;Brand New&quot;/&quot;Pre-Owned&quot;/&quot;For parts&quot;. Two numbers per cell: <span className="text-purple-200 font-bold">gross</span> = what the buyer paid, <span className="text-purple-200 font-bold">net</span> = what the seller pocketed after 13.25% Final Value Fee + $0.40 fixed + ~$10 shipping. Net is the apples-to-apples vs Atlas wholesale. Outliers rejected via IQR + half-median + Atlas-floor. Refresh: <code className="text-[#00c853]">python scripts/scrape-ebay-sold.py --atlas-only</code>.
                  </p>
                  <div className="bg-black/30 border border-white/5 rounded-xl overflow-hidden">
                    <div className="overflow-x-auto px-3 py-2">
                      <table className="w-full min-w-[420px] text-[11px]">
                        <tbody>
                          {filtered.map(([mid, m]) => {
                            const cells = m.by_cell || {};
                            type CellRow = { storage: string; cond: string; gross: number; net: number; n: number };
                            const rows: CellRow[] = [];
                            for (const storage of Object.keys(cells).sort()) {
                              for (const cond of Object.keys(cells[storage]).sort()) {
                                const c = cells[storage][cond];
                                rows.push({
                                  storage, cond,
                                  gross: Math.round(c.average),
                                  net: c.net_average != null ? Math.round(c.net_average) : Math.round(c.average * 0.8675 - 10.4),
                                  n: c.count,
                                });
                              }
                            }
                            return (
                              <tr key={mid} className="border-t border-white/[0.04] first:border-t-0 align-top">
                                <td className="py-1 pr-3 text-purple-300 font-mono text-[10px] align-top">{mid}</td>
                                <td className="py-1">
                                  <span className="font-mono text-[10px]">
                                    {rows.map((r, i) => (
                                      <span key={i} className="mr-3 whitespace-nowrap inline-block">
                                        <span className="text-[#888]">{r.storage}/{r.cond}:</span>{" "}
                                        <span className="text-[#cfcfcf]">${r.gross}</span>
                                        <span className="text-purple-300/70"> →${r.net}</span>
                                        <span className="text-[#666]"> n{r.n}</span>
                                      </span>
                                    ))}
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </section>
          );
        })()}
      </div>
    </main>
  );
}
