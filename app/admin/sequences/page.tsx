"use client";

import { useCallback, useEffect, useState } from "react";

type Step = { position: number; delayDays: number; cumulativeDays: number; subject: string; text: string; html: string };
type Audience = { windowDays: number; leads: number; eligible: number; dueNow: number; drops: Record<string, number> };
type LastRun = { at: string; kind: "run" | "send"; checked?: number; eligible?: number; dueNow?: number; sent?: number; failed?: number } | null;
type Seq = { slug: string; name: string; isActive: boolean; enabled: boolean; steps: Step[]; audience: Audience | null; lastRun: LastRun };
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

// Plain words for the drop reasons lib/sequence-eligibility reports (2026-09-27).
const REASON_LABEL: Record<string, string> = {
  chat_lead: "chat contact — the reminders cron covers it",
  trashed: "in the trash",
  unsubscribed: "unsubscribed",
  labeled: "holds a FedEx label",
  duplicate: "re-submission of an open trade",
  no_email: "no e-mail on the lead",
  internal: "our own test address",
  no_dollar_quote: "no $ figure (TBD / recycle)",
  finished: "both steps already sent",
  contacted: "staff already reached out",
  countered: "counter-offer in play",
  delivery_chosen: "seller picked meet / ship",
  slot_booked: "meetup booked",
  item_edited: "order edited after the quote",
  recent_reminder: "a reminder went out in the last 24 h",
  window_passed: "missed its 3-day send window",
};
function reasonLabel(r: string): string {
  if (r.startsWith("progressed:")) return `status: ${r.slice("progressed:".length)}`;
  return REASON_LABEL[r] || r;
}

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
          <code>/api/cron/sequences</code>. Enrollment is implicit (no subscriber list). Read-only here — the cron&apos;s{" "}
          <code>?dry=1</code> lists exactly what a run would send.
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
            <div key={s.slug}>
              <div className="tadm-card" style={{ marginTop: 10 }}>
                <h3>
                  {s.name}
                  <span className={`tadm-pill ${s.isActive && s.enabled ? "on" : s.isActive ? "info" : "warn"}`}>
                    {s.isActive && s.enabled ? "Live" : s.isActive ? "Ready (cron off)" : "Paused"}
                  </span>
                  <span className="right">{s.slug}</span>
                </h3>
                {/* Audience (2026-09-27): what the cron would find today, from the same rules it runs. */}
                {s.audience ? (
                  <p style={{ margin: "0 0 10px", fontSize: 13, color: "var(--tadm-text)" }}>
                    <strong>{s.audience.eligible}</strong> eligible · <strong>{s.audience.dueNow}</strong> due today
                    <span style={{ color: "var(--tadm-dim)" }}>
                      {" "}· {s.audience.leads} lead post{s.audience.leads === 1 ? "" : "s"} in the cron&apos;s {s.audience.windowDays}-day window
                    </span>
                    {s.lastRun && (
                      <span style={{ color: "var(--tadm-dim)" }}>
                        {" "}· last run {new Date(s.lastRun.at).toLocaleString()}
                        {s.lastRun.kind === "run"
                          ? ` — ${s.lastRun.sent ?? 0} sent, ${s.lastRun.eligible ?? 0} eligible of ${s.lastRun.checked ?? 0}`
                          : " (a send; no run record yet)"}
                      </span>
                    )}
                  </p>
                ) : (
                  <p style={{ margin: "0 0 10px", fontSize: 12.5, color: "var(--tadm-dim)" }}>
                    Audience unavailable — Mission Control not readable right now.
                  </p>
                )}
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
                {/* Body preview (2026-09-27): the same template functions the cron mails, on sample data. */}
                {s.steps.map((st) => (
                  <details key={`preview-${st.position}`} style={{ marginTop: 8 }}>
                    <summary style={{ cursor: "pointer", font: "600 11px var(--tadm-mono)", color: "var(--tadm-dim)" }}>
                      Preview step {st.position} — sample data (Alex · iPhone 15 Pro · $420 · lock ends in 7 days)
                    </summary>
                    <pre style={{ whiteSpace: "pre-wrap", wordBreak: "break-word", fontSize: 12, lineHeight: 1.5, color: "var(--tadm-text)", background: "var(--tadm-panel2)", border: "1px solid var(--tadm-border)", borderRadius: 10, padding: 10, margin: "8px 0" }}>
                      {`Subject: ${st.subject}\n\n${st.text}`}
                    </pre>
                    {st.html && (
                      <iframe
                        srcDoc={st.html}
                        title={`Step ${st.position} preview`}
                        sandbox=""
                        style={{ width: "100%", height: 560, background: "#13142b", border: "1px solid var(--tadm-border)", borderRadius: 10 }}
                      />
                    )}
                  </details>
                ))}
              </div>

              {/* Why the rest are out (2026-09-27): the eligibility module's one reason per lead. */}
              {s.audience && Object.keys(s.audience.drops).length > 0 && (
                <div className="tadm-card" style={{ marginTop: 10 }}>
                  <h3>
                    Not in the audience — by reason
                    <span className="right">last {s.audience.windowDays} days</span>
                  </h3>
                  <div className="tadm-rows">
                    {Object.entries(s.audience.drops).sort((a, b) => b[1] - a[1]).map(([reason, n]) => (
                      <div key={reason} className="tadm-row">
                        <span className="meta" style={{ minWidth: 32, textAlign: "right" }}>{n}</span>
                        <span className="main">
                          {reasonLabel(reason)} <span className="dim">· {reason}</span>
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
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
