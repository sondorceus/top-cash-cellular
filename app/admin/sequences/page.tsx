"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

type Step = { position: number; delayDays: number; cumulativeDays: number; subject: string };
type Seq = { slug: string; name: string; isActive: boolean; enabled: boolean; steps: Step[] };
type Send = { leadId: string; seq: string; step: number; at: string };
type Resp = {
  ok: boolean;
  mcConfigured: boolean;
  sequences: Seq[];
  stepCounts: Record<string, number>;
  leadsReached: number;
  totalSends: number;
  recent: Send[];
};

const STORAGE_KEY = "tcc_admin_token";

export default function SequencesAdminPage() {
  const [token, setToken] = useState("");
  const [tokenInput, setTokenInput] = useState("");
  const [data, setData] = useState<Resp | null>(null);
  const [loading, setLoading] = useState(false);
  const [authError, setAuthError] = useState("");

  useEffect(() => {
    try { const t = localStorage.getItem(STORAGE_KEY); if (t) setToken(t); } catch {}
  }, []);

  const load = useCallback(async (t: string) => {
    setLoading(true); setAuthError("");
    try {
      const r = await fetch(`/api/admin/sequences?token=${encodeURIComponent(t)}`, { cache: "no-store" });
      if (r.status === 401) { setAuthError("Invalid admin token."); setData(null); return; }
      const j = (await r.json()) as Resp;
      setData(j);
    } catch { setAuthError("Couldn't load sequences."); } finally { setLoading(false); }
  }, []);

  useEffect(() => { if (token) load(token); }, [token, load]);

  const saveToken = () => {
    const t = tokenInput.trim();
    if (!t) return;
    try { localStorage.setItem(STORAGE_KEY, t); } catch {}
    setToken(t);
  };

  if (!token) {
    return (
      <main style={{ minHeight: "100vh", background: "#0b0d13", color: "#e8eaf0", padding: "2rem 1rem" }}>
        <div style={{ maxWidth: 420, margin: "4rem auto" }}>
          <h1 style={{ fontSize: 20, fontWeight: 800, marginBottom: 12 }}>Sequences · Admin</h1>
          <input value={tokenInput} onChange={(e) => setTokenInput(e.target.value)} placeholder="Admin token" type="password"
            style={{ width: "100%", padding: "0.6rem 0.8rem", borderRadius: 10, background: "rgba(0,0,0,0.4)", border: "1px solid rgba(255,255,255,0.12)", color: "#fff", marginBottom: 10 }} />
          <button onClick={saveToken} style={{ width: "100%", padding: "0.6rem", borderRadius: 10, background: "rgba(212,175,55,0.22)", border: "1px solid rgba(212,175,55,0.45)", color: "#ecd07a", fontWeight: 700 }}>Unlock</button>
          {authError && <p style={{ color: "#fda4af", fontSize: 13, marginTop: 10 }}>{authError}</p>}
        </div>
      </main>
    );
  }

  return (
    <main style={{ minHeight: "100vh", background: "#0b0d13", color: "#e8eaf0", padding: "1.5rem 1rem 4rem" }}>
      <div style={{ maxWidth: 860, margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 6 }}>
          <h1 style={{ fontSize: 22, fontWeight: 800 }}>Email sequences</h1>
          <Link href="/admin" style={{ fontSize: 13, color: "#9aa3b2" }}>← Back to admin</Link>
        </div>
        <p style={{ fontSize: 13, color: "#9aa3b2", marginBottom: 18 }}>
          Automated multi-touch drips. Edited in <code>app/lib/email-sequences.ts</code> and run by the daily{" "}
          <code>/api/cron/sequences</code>. Enrollment is implicit (no subscriber list).
        </p>

        {authError && <p style={{ color: "#fda4af", fontSize: 13 }}>{authError}</p>}
        {loading && !data && <p style={{ color: "#9aa3b2" }}>Loading…</p>}

        {data?.ok && (
          <>
            <div style={{ display: "flex", gap: 18, flexWrap: "wrap", marginBottom: 20, fontSize: 13, color: "#9aa3b2" }}>
              <span><strong style={{ color: "#fff" }}>{data.sequences.length}</strong> sequences</span>
              <span><strong style={{ color: "#fff" }}>{data.leadsReached}</strong> people reached (90d)</span>
              <span><strong style={{ color: "#fff" }}>{data.totalSends}</strong> sends (90d)</span>
            </div>

            {data.sequences.map((s) => (
              <div key={s.slug} style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.10)", borderRadius: 14, padding: 18, marginBottom: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  <span style={{ fontWeight: 800, fontSize: 16 }}>{s.name}</span>
                  <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: 1, textTransform: "uppercase", padding: "2px 8px", borderRadius: 6, background: s.isActive && s.enabled ? "rgba(34,197,94,0.14)" : "rgba(245,158,11,0.14)", color: s.isActive && s.enabled ? "#86efac" : "#fcd34d", border: `1px solid ${s.isActive && s.enabled ? "rgba(34,197,94,0.35)" : "rgba(245,158,11,0.35)"}` }}>
                    {s.isActive && s.enabled ? "Live" : s.isActive ? "Ready (cron off)" : "Paused"}
                  </span>
                  <span style={{ fontFamily: "monospace", fontSize: 11, color: "#6b7280", marginLeft: "auto" }}>{s.slug}</span>
                </div>
                <ol style={{ listStyle: "none", padding: 0, margin: "14px 0 0" }}>
                  {s.steps.map((st) => (
                    <li key={st.position} style={{ display: "flex", gap: 12, alignItems: "baseline", padding: "8px 0", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                      <span style={{ fontFamily: "monospace", fontSize: 12, color: "#ecd07a", minWidth: 24 }}>{String(st.position).padStart(2, "0")}</span>
                      <span style={{ fontSize: 11, color: "#9aa3b2", minWidth: 64 }}>day {st.cumulativeDays} <span style={{ color: "#6b7280" }}>(+{st.delayDays}d)</span></span>
                      <span style={{ fontSize: 14, color: "#e8eaf0", flex: 1 }}>{st.subject}</span>
                      <span style={{ fontSize: 12, color: "#9aa3b2" }}>{data.stepCounts[`${s.slug}:${st.position}`] || 0} sent</span>
                    </li>
                  ))}
                </ol>
              </div>
            ))}

            {!data.mcConfigured && (
              <p style={{ fontSize: 12, color: "#fcd34d" }}>Send history unavailable (MC_API_KEY not set) — showing config only.</p>
            )}

            {data.recent.length > 0 && (
              <div style={{ marginTop: 8 }}>
                <h2 style={{ fontSize: 13, fontWeight: 800, textTransform: "uppercase", letterSpacing: 1, color: "#9aa3b2", marginBottom: 8 }}>Recent sends</h2>
                <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                  {data.recent.map((r, i) => (
                    <li key={i} style={{ display: "flex", gap: 12, fontSize: 12, color: "#9aa3b2", padding: "5px 0", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                      <span style={{ color: "#6b7280", minWidth: 130 }}>{r.at ? new Date(r.at).toLocaleString() : "—"}</span>
                      <span style={{ color: "#e8eaf0" }}>{r.seq}</span>
                      <span>step {r.step}</span>
                      <span style={{ fontFamily: "monospace", color: "#6b7280", marginLeft: "auto" }}>{r.leadId}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}
