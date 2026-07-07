"use client";

import { useCallback, useEffect, useState } from "react";

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
      <div className="tadm-wrap">
        <div className="tadm-page-head">
          <h1>Sequences</h1>
          <p>Enter the admin token to view email drips.</p>
        </div>
        <div className="tadm-card" style={{ maxWidth: 420 }}>
          <h3>Unlock</h3>
          <input value={tokenInput} onChange={(e) => setTokenInput(e.target.value)} placeholder="Admin token" type="password"
            className="tadm-input" style={{ width: "100%", marginBottom: 10 }} />
          <button onClick={saveToken} className="tadm-btn primary" style={{ width: "100%" }}>Unlock</button>
          {authError && <p style={{ color: "var(--tadm-bad)", fontSize: 12.5, margin: "10px 0 0" }}>{authError}</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="tadm-wrap">
      <div className="tadm-page-head">
        <h1>Sequences</h1>
        <p>
          Automated multi-touch drips. Edited in <code>app/lib/email-sequences.ts</code> and run by the daily{" "}
          <code>/api/cron/sequences</code>. Enrollment is implicit (no subscriber list).
        </p>
      </div>

      {authError && <p style={{ color: "var(--tadm-bad)", fontSize: 12.5 }}>{authError}</p>}
      {loading && !data && <div className="tadm-empty pulse">Loading…</div>}

      {data?.ok && (
        <>
          <div className="tadm-tiles">
            <div className="tadm-tile">
              <div className="num">{data.sequences.length}</div>
              <div className="lbl">sequences</div>
              <div className="sub">configured drips</div>
            </div>
            <div className="tadm-tile">
              <div className="num">{data.leadsReached}</div>
              <div className="lbl">people reached</div>
              <div className="sub">last 90 days</div>
            </div>
            <div className="tadm-tile">
              <div className="num">{data.totalSends}</div>
              <div className="lbl">sends</div>
              <div className="sub">last 90 days</div>
            </div>
            <div className="tadm-tile">
              <div className={`num ${data.mcConfigured ? "green" : ""}`}>{data.mcConfigured ? "live" : "off"}</div>
              <div className="lbl">send history</div>
              <div className="sub">{data.mcConfigured ? "MC feed connected" : "MC_API_KEY not set — config only"}</div>
            </div>
          </div>

          {data.sequences.map((s) => (
            <div key={s.slug} className="tadm-card" style={{ marginTop: 10 }}>
              <h3>
                {s.name}
                <span className={`tadm-pill ${s.isActive && s.enabled ? "on" : s.isActive ? "info" : "warn"}`}>
                  {s.isActive && s.enabled ? "Live" : s.isActive ? "Ready (cron off)" : "Paused"}
                </span>
                <span className="right">{s.slug}</span>
              </h3>
              <div className="tadm-rows">
                {s.steps.map((st) => (
                  <div key={st.position} className="tadm-row">
                    <span className="meta" style={{ minWidth: 20 }}>{String(st.position).padStart(2, "0")}</span>
                    <span className="meta" style={{ minWidth: 86 }}>day {st.cumulativeDays} (+{st.delayDays}d)</span>
                    <span className="main">{st.subject}</span>
                    <span className="meta">{data.stepCounts[`${s.slug}:${st.position}`] || 0} sent</span>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {data.recent.length > 0 && (
            <div className="tadm-card" style={{ marginTop: 10 }}>
              <h3>Recent sends</h3>
              <div className="tadm-rows">
                {data.recent.map((r, i) => (
                  <div key={i} className="tadm-row">
                    <span className="meta" style={{ minWidth: 130 }}>{r.at ? new Date(r.at).toLocaleString() : "—"}</span>
                    <span className="main">
                      {r.seq} <span className="dim">· step {r.step}</span>
                    </span>
                    <span className="meta">{r.leadId}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
