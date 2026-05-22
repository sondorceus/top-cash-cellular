"use client";
import { useEffect, useState, useCallback } from "react";

// Referral bookkeeping for staff. Lists everyone who's earned a referral
// reward, what they're owed vs already paid, and lets staff record a
// payout — which writes a [REFERRAL-PAID:] marker the GET re-aggregates.
// Skywalker 2026-05-22.

type Referrer = {
  email: string;
  code: string;
  earned: number;
  paid: number;
  outstanding: number;
  referralCount: number;
  refereeLeads: string[];
  lastEarnedAt?: string;
};
type Payload = {
  referrers: Referrer[];
  totals: { earned: number; paid: number; outstanding: number };
  generatedAt: string;
};

export default function ReferralsPage() {
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  // Per-row payout form.
  const [payingEmail, setPayingEmail] = useState<string | null>(null);
  const [payAmount, setPayAmount] = useState("");
  const [payMethod, setPayMethod] = useState("");
  const [paySaving, setPaySaving] = useState(false);
  const [payError, setPayError] = useState("");

  const token = typeof window !== "undefined" ? localStorage.getItem("tcc-admin-token") : null;

  const load = useCallback(() => {
    fetch("/api/admin/referrals", { headers: token ? { "x-admin-token": token } : {}, cache: "no-store" })
      .then((r) => {
        if (!r.ok) throw new Error(r.status === 401 ? "Unauthorized — open /admin first to set your token." : `HTTP ${r.status}`);
        return r.json();
      })
      .then((d) => { setData(d); setError(null); })
      .catch((e) => setError(e.message));
  }, [token]);

  useEffect(() => { load(); }, [load, tick]);

  const openPay = (r: Referrer) => {
    setPayingEmail(r.email);
    setPayAmount(r.outstanding > 0 ? String(r.outstanding) : "");
    setPayMethod("");
    setPayError("");
  };

  const submitPay = async (email: string) => {
    const amount = parseInt(payAmount.replace(/[^0-9]/g, ""), 10);
    if (!amount || amount <= 0) { setPayError("Enter a positive amount."); return; }
    setPaySaving(true);
    setPayError("");
    try {
      const r = await fetch("/api/admin/referrals", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { "x-admin-token": token } : {}) },
        body: JSON.stringify({ email, amount, method: payMethod.trim() || undefined }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setPayError(d.error || `HTTP ${r.status}`); return; }
      setPayingEmail(null);
      setTick((t) => t + 1); // reload the aggregates
    } catch {
      setPayError("Network error — try again.");
    } finally {
      setPaySaving(false);
    }
  };

  if (error) return <main className="min-h-screen bg-[#0a0a0a] text-white p-8"><p className="text-red-400">{error}</p></main>;
  if (!data) return <main className="min-h-screen bg-[#0a0a0a] text-white p-8"><p className="text-[#888]">Loading…</p></main>;

  return (
    <main className="min-h-screen bg-[#0a0a0a] text-white">
      <div className="sticky top-0 z-20 bg-[#0a0a0a]/95 backdrop-blur border-b border-white/10">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-4 flex-wrap">
          <a href="/admin" className="text-[#888] hover:text-[#00c853] text-xs font-semibold transition">← Leads</a>
          <a href="/admin/analytics" className="text-[#888] hover:text-[#00c853] text-xs font-semibold transition">📊 Analytics</a>
          <a href="/admin/customers" className="text-[#888] hover:text-[#00c853] text-xs font-semibold transition">👥 Customers</a>
          <h1 className="text-lg font-extrabold tracking-tight">TCC · Referrals</h1>
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
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white/[0.04] border border-white/10 rounded-xl p-3">
            <p className="text-[11px] text-[#888] uppercase tracking-wider">Total earned</p>
            <p className="text-2xl font-extrabold">${data.totals.earned.toLocaleString()}</p>
          </div>
          <div className="bg-white/[0.04] border border-white/10 rounded-xl p-3">
            <p className="text-[11px] text-[#888] uppercase tracking-wider">Paid out</p>
            <p className="text-2xl font-extrabold text-[#00c853]">${data.totals.paid.toLocaleString()}</p>
          </div>
          <div className="bg-white/[0.04] border border-white/10 rounded-xl p-3">
            <p className="text-[11px] text-[#888] uppercase tracking-wider">Outstanding</p>
            <p className={`text-2xl font-extrabold ${data.totals.outstanding > 0 ? "text-amber-300" : ""}`}>${data.totals.outstanding.toLocaleString()}</p>
          </div>
        </div>

        {/* REFERRER LIST */}
        {data.referrers.length === 0 ? (
          <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-8 text-center">
            <p className="text-[#888] text-sm">No referral earnings yet. When a referred customer completes a trade, the referrer shows up here.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {data.referrers.map((r) => (
              <div key={r.email} className="bg-white/[0.03] border border-white/10 rounded-2xl p-4">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <p className="font-bold text-sm break-all">{r.email}</p>
                    <p className="text-[11px] text-[#888] mt-0.5">
                      <span className="font-mono text-[#00c853]">{r.code || "—"}</span>
                      {" · "}{r.referralCount} referral{r.referralCount === 1 ? "" : "s"}
                      {r.lastEarnedAt ? ` · last ${new Date(r.lastEarnedAt).toLocaleDateString()}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-4 text-right shrink-0">
                    <div>
                      <p className="text-[10px] text-[#888] uppercase tracking-wider">Earned</p>
                      <p className="font-extrabold">${r.earned.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-[#888] uppercase tracking-wider">Paid</p>
                      <p className="font-extrabold text-[#00c853]">${r.paid.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-[#888] uppercase tracking-wider">Owed</p>
                      <p className={`font-extrabold ${r.outstanding > 0 ? "text-amber-300" : "text-[#888]"}`}>${r.outstanding.toLocaleString()}</p>
                    </div>
                  </div>
                </div>

                {payingEmail === r.email ? (
                  <div className="mt-3 pt-3 border-t border-white/10 flex flex-wrap items-center gap-2">
                    <input
                      value={payAmount}
                      onChange={(e) => setPayAmount(e.target.value)}
                      placeholder="Amount $"
                      inputMode="numeric"
                      className="w-24 px-2.5 py-1.5 bg-black/40 border border-white/15 rounded-lg text-sm text-white placeholder:text-[#666] focus:outline-none focus:border-[#00c853]"
                    />
                    <input
                      value={payMethod}
                      onChange={(e) => setPayMethod(e.target.value)}
                      placeholder="Method (Zelle, Cash…)"
                      className="flex-1 min-w-[140px] px-2.5 py-1.5 bg-black/40 border border-white/15 rounded-lg text-sm text-white placeholder:text-[#666] focus:outline-none focus:border-[#00c853]"
                    />
                    <button
                      onClick={() => submitPay(r.email)}
                      disabled={paySaving}
                      className="px-3 py-1.5 bg-[#00c853] hover:bg-[#00e676] text-[#0a0a0a] rounded-lg text-xs font-extrabold cursor-pointer disabled:opacity-50 transition"
                    >
                      {paySaving ? "Saving…" : "Record payout"}
                    </button>
                    <button
                      onClick={() => setPayingEmail(null)}
                      disabled={paySaving}
                      className="px-3 py-1.5 bg-white/5 border border-white/15 rounded-lg text-xs font-semibold cursor-pointer disabled:opacity-50 transition"
                    >
                      Cancel
                    </button>
                    {payError && <p className="w-full text-red-300 text-[11px] font-semibold">{payError}</p>}
                  </div>
                ) : (
                  r.outstanding > 0 && (
                    <div className="mt-3 pt-3 border-t border-white/10">
                      <button
                        onClick={() => openPay(r)}
                        className="px-3 py-1.5 bg-[#00c853]/15 border border-[#00c853]/40 text-[#00c853] rounded-lg text-xs font-bold cursor-pointer hover:bg-[#00c853]/25 transition"
                      >
                        Record a payout
                      </button>
                    </div>
                  )
                )}
              </div>
            ))}
          </div>
        )}

        <p className="text-[10px] text-[#555] text-center">
          Aggregated from the last 1,000 MC messages. Recording a payout logs a marker for the books — it does not move money.
        </p>
      </div>
    </main>
  );
}
