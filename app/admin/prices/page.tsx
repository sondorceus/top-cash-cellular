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

const CONDITION_ORDER = ["sealed", "mint", "verygood", "good", "fair", "broken"] as const;
const CARRIER_KEYS = ["att", "tmobile", "other"] as const;

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
type Payload = {
  baseline: { priceTable: PriceTable; carrierDeductions: CarrierTable };
  overrides: { priceTable: PriceTable; carrierDeductions: CarrierTable };
  effective: { priceTable: PriceTable; carrierDeductions: CarrierTable };
};

export default function PricesAdminPage() {
  const [data, setData] = useState<Payload | null>(null);
  const [token, setToken] = useState<string>("");
  const [edits, setEdits] = useState<{ price: PriceTable; carrier: CarrierTable }>({ price: {}, carrier: {} });
  const [saving, setSaving] = useState(false);
  const [lastSaveMsg, setLastSaveMsg] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>("");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

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
    setEdits((prev) => {
      const next = { price: { ...prev.price }, carrier: { ...prev.carrier } };
      next.price[model] = { ...(next.price[model] || {}) };
      next.price[model][storage] = { ...(next.price[model][storage] || {}) };
      next.price[model][storage][cond] = val;
      return next;
    });
  };

  const setCarrierCell = (model: string, carrier: string, val: number) => {
    setEdits((prev) => {
      const next = { price: { ...prev.price }, carrier: { ...prev.carrier } };
      next.carrier[model] = { ...(next.carrier[model] || {}), [carrier]: val };
      return next;
    });
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

  const save = async () => {
    if (!token) {
      const t = window.prompt("Admin token? (will remember in this browser)");
      if (!t) return;
      setToken(t);
      localStorage.setItem("tcc-admin-token", t);
    }
    setSaving(true);
    setLastSaveMsg(null);
    try {
      const r = await fetch(`/api/admin/prices?token=${encodeURIComponent(token || localStorage.getItem("tcc-admin-token") || "")}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priceTable: edits.price, carrierDeductions: edits.carrier }),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        setLastSaveMsg(`Save failed: ${r.status} ${j.error || ""}`);
        return;
      }
      const j = await r.json();
      setLastSaveMsg(`✓ Saved at ${new Date(j.updatedAt).toLocaleTimeString()} — ${j.overrideModels} model override(s) live`);
      setEdits({ price: {}, carrier: {} });
      // Reload baseline + overrides
      const refresh = await fetch("/api/admin/prices");
      setData(await refresh.json());
    } finally {
      setSaving(false);
    }
  };

  const groupNames = Array.from(grouped.keys()).sort();
  const filterLower = filter.trim().toLowerCase();

  return (
    <main className="min-h-screen bg-[#0a0a0a] text-white">
      <div className="sticky top-0 z-20 bg-[#0a0a0a]/95 backdrop-blur border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-4 flex-wrap">
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
          <button
            onClick={save}
            disabled={editCount === 0 || saving}
            className="px-4 py-1.5 rounded-lg bg-[#00c853] text-black text-sm font-bold disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer hover:bg-[#00e676] transition"
          >
            {saving ? "Saving…" : `Save ${editCount}`}
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

        {groupNames.map((gname) => {
          const ids = grouped.get(gname)!.filter((id) => !filterLower || id.toLowerCase().includes(filterLower));
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
                          {carrier && (
                            <span className="flex items-center gap-1 text-[11px] text-[#888]">
                              <span>Carrier deduction:</span>
                              {CARRIER_KEYS.map((c) => (
                                <label key={c} className="inline-flex items-center gap-1">
                                  <span className="uppercase text-[10px]">{c}</span>
                                  <input
                                    type="number"
                                    defaultValue={effectiveCarrier(modelId, c) ?? 0}
                                    onChange={(e) => setCarrierCell(modelId, c, parseInt(e.target.value) || 0)}
                                    className={`w-16 px-1.5 py-0.5 text-[11px] text-right bg-black/60 rounded border ${
                                      isOverridden(modelId, undefined, undefined, c) ? "border-[#00c853]/50" : "border-white/15"
                                    }`}
                                  />
                                </label>
                              ))}
                            </span>
                          )}
                        </div>
                        <table className="w-full text-[12px]">
                          <thead>
                            <tr className="text-[#888]">
                              <th className="text-left font-semibold pb-1.5 pr-2">Storage</th>
                              {CONDITION_ORDER.map((c) => (
                                <th key={c} className="text-right font-semibold pb-1.5 px-1 capitalize">
                                  {c === "verygood" ? "Very Good" : c}
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
                                  return (
                                    <td key={cond} className="px-0.5 py-1">
                                      {v === undefined ? (
                                        <span className="block text-[10px] text-[#444] text-right">—</span>
                                      ) : (
                                        <input
                                          type="number"
                                          defaultValue={v}
                                          onChange={(e) => setPriceCell(modelId, stor, cond, parseInt(e.target.value) || 0)}
                                          className={`w-16 px-1.5 py-0.5 text-right bg-black/60 rounded border ${
                                            overridden ? "border-[#00c853]/50 text-[#00c853]" : "border-white/15"
                                          }`}
                                        />
                                      )}
                                    </td>
                                  );
                                })}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          );
        })}
      </div>
    </main>
  );
}
