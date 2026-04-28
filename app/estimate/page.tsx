"use client";

import { useEffect, useMemo, useState } from "react";

type CatalogResponse = {
  devices: { slug: string; name: string; category: string; basePrice: number }[];
  conditions: { id: string; label: string; desc: string; multiplier: number }[];
  storage: { id: string; label: string; multiplier: number }[];
  carriers: { id: string; label: string; multiplier: number }[];
};

type EstimateResponse = {
  ok: true;
  quote: number;
  device: { slug?: string; name?: string; category?: string; basePrice: number };
  inputs: { condition: string; storage: string; carrier: string };
  multipliers: { condition: number; storage: number; carrier: number };
};

export default function EstimatePage() {
  const [catalog, setCatalog] = useState<CatalogResponse | null>(null);
  const [deviceSlug, setDeviceSlug] = useState("");
  const [storage, setStorage] = useState("");
  const [condition, setCondition] = useState("");
  const [carrier, setCarrier] = useState("unlocked");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<EstimateResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/tcc/estimate")
      .then((r) => r.json())
      .then(setCatalog)
      .catch((e) => setError(String(e)));
  }, []);

  const selectedDevice = useMemo(
    () => catalog?.devices.find((d) => d.slug === deviceSlug) ?? null,
    [catalog, deviceSlug]
  );

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setResult(null);
    setLoading(true);
    try {
      const r = await fetch("/api/tcc/estimate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deviceSlug, condition, storage, carrier }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Request failed");
      setResult(j);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setDeviceSlug("");
    setStorage("");
    setCondition("");
    setCarrier("unlocked");
    setResult(null);
    setError(null);
  }

  if (!catalog) {
    return (
      <main className="min-h-screen bg-[#0a0a0a] text-white flex items-center justify-center">
        <p className="text-[#888]">Loading catalog…</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#0a0a0a] text-white px-4 py-8">
      <div className="max-w-md mx-auto">
        <h1 className="text-2xl font-bold mb-2">Instant Trade-In Quote</h1>
        <p className="text-[#888] text-sm mb-6">Pick your device and 3 details — get a quote in seconds.</p>

        <form onSubmit={submit} className="space-y-5">
          <Field label="1. Device">
            <select
              required
              value={deviceSlug}
              onChange={(e) => setDeviceSlug(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white"
              disabled={!!result}
            >
              <option value="">Choose a device…</option>
              {catalog.devices.map((d) => (
                <option key={d.slug} value={d.slug}>
                  {d.name} (up to ${d.basePrice})
                </option>
              ))}
            </select>
          </Field>

          <Field label="2. Storage">
            <select
              required
              value={storage}
              onChange={(e) => setStorage(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white"
              disabled={!!result}
            >
              <option value="">Choose storage…</option>
              {catalog.storage.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </Field>

          <Field label="3. Condition">
            <select
              required
              value={condition}
              onChange={(e) => setCondition(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white"
              disabled={!!result}
            >
              <option value="">Choose condition…</option>
              {catalog.conditions.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label} — {c.desc}
                </option>
              ))}
            </select>
          </Field>

          <Field label="4. Carrier">
            <select
              required
              value={carrier}
              onChange={(e) => setCarrier(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white"
              disabled={!!result}
            >
              {catalog.carriers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </Field>

          {!result && (
            <button
              type="submit"
              disabled={loading || !deviceSlug || !storage || !condition}
              className="w-full bg-[#00c853] disabled:bg-[#00c853]/40 text-white py-4 rounded-2xl text-base font-bold hover:bg-[#00e676] transition"
            >
              {loading ? "Calculating…" : "Get My Quote"}
            </button>
          )}
        </form>

        {error && (
          <div className="mt-6 bg-red-500/10 border border-red-500/30 text-red-300 rounded-xl px-4 py-3 text-sm">
            {error}
          </div>
        )}

        {result && (
          <div className="mt-8 bg-[#00c853]/10 border border-[#00c853]/40 rounded-2xl p-6">
            <p className="text-[#00c853] text-sm font-semibold uppercase tracking-wide mb-2">Your Quote</p>
            <p className="text-5xl font-bold text-white mb-1">${result.quote}</p>
            <p className="text-[#888] text-sm">
              {selectedDevice?.name} — {catalog.storage.find((s) => s.id === result.inputs.storage)?.label} —{" "}
              {catalog.conditions.find((c) => c.id === result.inputs.condition)?.label}
            </p>
            <button
              onClick={reset}
              className="mt-5 w-full bg-white/10 border border-white/20 text-white py-3 rounded-xl text-sm font-semibold hover:bg-white/20 transition"
            >
              Reset & Try Another
            </button>
          </div>
        )}
      </div>
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-sm font-semibold text-white mb-2">{label}</span>
      {children}
    </label>
  );
}
