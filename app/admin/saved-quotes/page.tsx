"use client";
import { useEffect, useState, useCallback } from "react";

// Saved-quotes / abandoned-cart list. Customers who entered their email at
// the "save quote for later" box or the account step but never finished
// checkout. A re-marketing follow-up list — emails that later completed a
// real trade are flagged "converted" so staff don't chase them.
// Skywalker 2026-05-28.

type SavedQuote = {
  id?: string;
  name?: string;
  email: string;
  device?: string;
  quote: number;
  condition?: string;
  savedAt: string;
  count: number;
  converted: boolean;
};
type Payload = {
  quotes: SavedQuote[];
  totals: { total: number; open: number; converted: number; openValue: number };
  generatedAt: string;
};

export default function SavedQuotesPage() {
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const [hideConverted, setHideConverted] = useState(true);
  const [dismissing, setDismissing] = useState<string | null>(null);

  const token = typeof window !== "undefined" ? localStorage.getItem("tcc-admin-token") : null;

  const load = useCallback(() => {
    fetch("/api/admin/saved-quotes", { headers: token ? { "x-admin-token": token } : {}, cache: "no-store" })
      .then((r) => {
        if (!r.ok) throw new Error(r.status === 401 ? "Unauthorized — open /admin first to set your token." : `HTTP ${r.status}`);
        return r.json();
      })
      .then((d) => { setData(d); setError(null); })
      .catch((e) => setError(e.message));
  }, [token]);

  useEffect(() => { load(); }, [load, tick]);

  // Dismiss reuses the lead soft-delete endpoint — it just posts a
  // [DELETED-LEAD: id] marker, which the saved-quotes GET now filters out.
  const dismiss = async (q: SavedQuote) => {
    if (!q.id) return;
    setDismissing(q.id);
    try {
      await fetch("/api/admin/leads/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { "x-admin-token": token } : {}) },
        body: JSON.stringify({ leadId: q.id, reason: "saved-quote dismissed" }),
      });
      setTick((t) => t + 1);
    } finally {
      setDismissing(null);
    }
  };

  if (error) return <main className="min-h-screen bg-[#0a0a0a] text-white p-8"><p className="text-red-400">{error}</p></main>;
  if (!data) return <main className="min-h-screen bg-[#0a0a0a] text-white p-8"><p className="text-[#888]">Loading…</p></main>;

  const rows = hideConverted ? data.quotes.filter((q) => !q.converted) : data.quotes;

  const followUpHref = (q: SavedQuote) => {
    const subject = encodeURIComponent("Still want to sell your device? Your Top Cash quote is saved");
    const body = encodeURIComponent(
      `Hi${q.name ? ` ${q.name}` : ""},\n\nYou saved a quote with Top Cash Cellular${q.device ? ` for your ${q.device}` : ""}${q.quote > 0 ? ` — $${q.quote}` : ""}. It's still good! Reply here or finish up at https://topcashcellular.com and we'll get you paid fast.\n\n— Top Cash Cellular`
    );
    return `mailto:${q.email}?subject=${subject}&body=${body}`;
  };

  return (
    <main className="min-h-screen bg-[#0a0a0a] text-white">
      <div className="sticky top-0 z-20 bg-[#0a0a0a]/95 backdrop-blur border-b border-white/10">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-4 flex-wrap">
          <a href="/admin" className="text-[#888] hover:text-[#00c853] text-xs font-semibold transition">← Leads</a>
          <a href="/admin/analytics" className="text-[#888] hover:text-[#00c853] text-xs font-semibold transition">📊 Analytics</a>
          <a href="/admin/customers" className="text-[#888] hover:text-[#00c853] text-xs font-semibold transition">👥 Customers</a>
          <a href="/admin/referrals" className="text-[#888] hover:text-[#00c853] text-xs font-semibold transition">🎁 Referrals</a>
          <h1 className="text-lg font-extrabold tracking-tight">TCC · Saved Quotes</h1>
          <button
            onClick={() => setTick((t) => t + 1)}
            className="ml-auto px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/15 text-xs font-semibold cursor-pointer"
          >
            ↻ Refresh
          </button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        {/* TOTALS */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-white/[0.04] border border-white/10 rounded-xl p-3">
            <p className="text-[11px] text-[#888] uppercase tracking-wider">Saved quotes</p>
            <p className="text-2xl font-extrabold">{data.totals.total.toLocaleString()}</p>
          </div>
          <div className="bg-white/[0.04] border border-white/10 rounded-xl p-3">
            <p className="text-[11px] text-[#888] uppercase tracking-wider">Open (to chase)</p>
            <p className="text-2xl font-extrabold text-amber-300">{data.totals.open.toLocaleString()}</p>
          </div>
          <div className="bg-white/[0.04] border border-white/10 rounded-xl p-3">
            <p className="text-[11px] text-[#888] uppercase tracking-wider">Converted</p>
            <p className="text-2xl font-extrabold text-[#00c853]">{data.totals.converted.toLocaleString()}</p>
          </div>
          <div className="bg-white/[0.04] border border-white/10 rounded-xl p-3">
            <p className="text-[11px] text-[#888] uppercase tracking-wider">Open quote $</p>
            <p className="text-2xl font-extrabold">${data.totals.openValue.toLocaleString()}</p>
          </div>
        </div>

        <label className="flex items-center gap-2 text-xs text-[#aaa] cursor-pointer select-none">
          <input type="checkbox" checked={hideConverted} onChange={(e) => setHideConverted(e.target.checked)} className="accent-[#00c853]" />
          Hide quotes that already converted
        </label>

        {/* LIST */}
        {rows.length === 0 ? (
          <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-8 text-center">
            <p className="text-[#888] text-sm">No saved quotes{hideConverted ? " to chase" : ""} yet. When a customer enters their email but doesn&apos;t finish checkout, they show up here.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {rows.map((q) => (
              <div key={q.id || q.email} className={`bg-white/[0.03] border rounded-2xl p-4 ${q.converted ? "border-[#00c853]/30" : "border-white/10"}`}>
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <p className="font-bold text-sm break-all">
                      {q.email}
                      {q.converted && <span className="ml-2 align-middle text-[10px] font-bold text-[#00c853] bg-[#00c853]/15 border border-[#00c853]/40 rounded-full px-2 py-0.5">✓ converted</span>}
                    </p>
                    <p className="text-[11px] text-[#888] mt-0.5">
                      {q.name ? `${q.name} · ` : ""}{q.device || "—"}{q.condition ? ` · ${q.condition}` : ""}
                      {q.count > 1 ? ` · saved ${q.count}×` : ""}
                      {` · ${new Date(q.savedAt).toLocaleDateString()} ${new Date(q.savedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-4 text-right shrink-0">
                    <div>
                      <p className="text-[10px] text-[#888] uppercase tracking-wider">Quote</p>
                      <p className="font-extrabold">{q.quote > 0 ? `$${q.quote.toLocaleString()}` : "—"}</p>
                    </div>
                    {!q.converted && (
                      <a
                        href={followUpHref(q)}
                        className="px-3 py-1.5 bg-[#00c853]/15 border border-[#00c853]/40 text-[#00c853] rounded-lg text-xs font-bold cursor-pointer hover:bg-[#00c853]/25 transition"
                      >
                        ✉ Follow up
                      </a>
                    )}
                    <button
                      onClick={() => dismiss(q)}
                      disabled={dismissing === q.id}
                      title="Dismiss this saved quote"
                      className="px-2.5 py-1.5 bg-white/5 hover:bg-white/10 border border-white/15 text-[#888] hover:text-white rounded-lg text-xs font-semibold cursor-pointer disabled:opacity-50 transition"
                    >
                      {dismissing === q.id ? "…" : "Dismiss"}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <p className="text-[10px] text-[#555] text-center">
          From the last 1,000 MC messages. &quot;Converted&quot; means the same email later completed a real trade.
        </p>
      </div>
    </main>
  );
}
