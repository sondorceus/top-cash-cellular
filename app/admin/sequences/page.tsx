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

// Session path (2026-09-26): proxy.ts swaps this placeholder header for the
// real token on a Google admin session. The token-paste unlock is gone.
const AUTH_HEADERS = { "x-admin-token": "session" } as const;

export default function SequencesAdminPage() {
  const [data, setData] = useState<Resp | null>(null);
  const [loading, setLoading] = useState(false);
  const [authError, setAuthError] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setAuthError("");
    try {
      const r = await fetch(`/api/admin/sequences`, { cache: "no-store", headers: AUTH_HEADERS });
      if (r.status === 401) { setAuthError("Not signed in — sign in with Google on /admin (your session may have expired), then reload."); setData(null); return; }
      const j = (await r.json()) as Resp;
      setData(j);
    } catch { setAuthError("Couldn't load sequences."); } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

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
