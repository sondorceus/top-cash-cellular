"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";

type Subscriber = {
  email: string;
  name?: string;
  signedUpAt: string;
  source?: "signup" | "lead" | "imported";
};

type SubsResp = {
  ok: boolean;
  count: number;
  explicitCount: number;
  fromLeadsCount: number;
  subscribers: Subscriber[];
  recentSends?: RecentSend[];
};

// One past blast, from its [NEWSLETTER-SENT] summary marker (2026-09-27).
type RecentSend = {
  sendId: string;
  subject: string;
  sent: number;
  failed: number;
  total: number;
  includeLeads: boolean;
  partial: boolean;
  at: string;
};

// What a blast was composed of. "Continue" is offered only for the exact
// composition that stopped early (2026-09-27).
type Composition = { subject: string; body: string; preheader: string; includeLeads: boolean };

type DryRunResp = {
  ok: true;
  dryRun: true;
  sendId: string;
  count: number;
  previewRecipient: string;
  previewHtml: string;
};

type SendResp = {
  ok: true;
  sendId: string;
  count: number;
  sent: number;
  failed: number;
  skippedAlreadySent?: number;
  skippedUnsub?: number;
  skippedBlobError?: number;
  batches?: number;
  partial?: boolean;
  remaining?: number;
  failures: { email: string; error: string }[];
  composition?: Composition;
};

// Session path (2026-09-26): proxy.ts swaps this placeholder header for the
// real token on a Google admin session. The page no longer asks staff to
// paste TCC_ADMIN_TOKEN or keeps it in localStorage.
const AUTH_HEADERS = { "x-admin-token": "session" } as const;

// One id per composed blast (2026-09-26): the route marks each mailed
// recipient under it, so a retry — or "Continue" after a run that stopped
// at the time budget — skips everyone already sent. Editing the text is a
// new blast and gets a new id.
const mintSendId = () => `n${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

// Draft + send id survive a reload (2026-09-27): a mid-send reload used to
// lose the composition while the server finished the blast — and a partial
// run's "Continue" with it. Cleared by a complete run.
const DRAFT_KEY = "tcc-newsletter-draft";
type Draft = Composition & { sendId: string; partial: SendResp | null };

const sameComposition = (a: Composition | undefined, b: Composition): boolean =>
  !!a && a.subject === b.subject && a.body === b.body && a.preheader === b.preheader && a.includeLeads === b.includeLeads;

// The summary marker strips [ ] = and newlines from the subject; compare the
// current subject the same way so the repeat warning matches like with like.
const normSubject = (s: string) => s.replace(/[\[\]\r\n=]+/g, " ").slice(0, 200).replace(/\s+/g, " ").trim().toLowerCase();

const ago = (iso: string): string => {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000));
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  return hrs < 48 ? `${hrs} h ago` : `${Math.round(hrs / 24)} d ago`;
};

/* one-off form label styles (colors via --tadm-* vars only) */
const lbl: CSSProperties = {
  display: "block",
  font: "700 10.5px var(--tadm-mono)",
  textTransform: "uppercase",
  letterSpacing: "1.2px",
  color: "var(--tadm-faint)",
  margin: "0 0 5px",
};
const hint: CSSProperties = {
  textTransform: "none",
  letterSpacing: 0,
  fontWeight: 500,
};

export default function NewsletterAdminPage() {
  const [subs, setSubs] = useState<Subscriber[]>([]);
  const [counts, setCounts] = useState({ total: 0, explicit: 0, fromLeads: 0 });
  const [loading, setLoading] = useState(false);
  const [authError, setAuthError] = useState("");

  const [subject, setSubject] = useState("");
  const [preheader, setPreheader] = useState("");
  const [body, setBody] = useState("");
  const [includeLeads, setIncludeLeads] = useState(false);
  const [previewHtml, setPreviewHtml] = useState("");
  const [previewRecipient, setPreviewRecipient] = useState("");
  const [previewing, setPreviewing] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<SendResp | null>(null);
  const [error, setError] = useState("");
  const [confirmSend, setConfirmSend] = useState(false);
  const [sendId, setSendId] = useState("");
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState("");
  const [recentSends, setRecentSends] = useState<RecentSend[]>([]);
  // localStorage is read once after mount (no SSR mismatch) and nothing is
  // written back until then (2026-09-27).
  const [hydrated, setHydrated] = useState(false);
  const skipMintRef = useRef(false);

  // A run that stopped early keeps its id so "Continue" resumes — but only
  // for the exact composition it stopped on (2026-09-27): before this, editing
  // the body or ticking "include leads" after a partial run rode the old id
  // (and its skipped confirm) to everyone. Any edit is a new blast: new id,
  // partial state dropped. Declared before the restore effect so the
  // restore's skip flag is consumed on the right commit.
  useEffect(() => {
    if (skipMintRef.current) { skipMintRef.current = false; return; }
    const now: Composition = { subject, body, preheader, includeLeads };
    if (sendResult?.partial && sameComposition(sendResult.composition, now)) return;
    if (sendResult?.partial) setSendResult(null);
    setSendId(mintSendId());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subject, body, preheader, includeLeads]);

  // Restore the saved draft once (2026-09-27). A saved partial run comes back
  // only with its own send id, so "Continue" can never pair with a fresh id.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw) {
        const d = JSON.parse(raw) as Partial<Draft>;
        if (d && (d.subject || d.body || d.preheader)) {
          setSubject(d.subject || "");
          setBody(d.body || "");
          setPreheader(d.preheader || "");
          setIncludeLeads(!!d.includeLeads);
          if (typeof d.sendId === "string" && /^[\w-]{6,64}$/.test(d.sendId)) {
            // The composition change just queued would mint a fresh id; keep the saved one.
            skipMintRef.current = true;
            setSendId(d.sendId);
            if (d.partial && d.partial.partial && d.partial.sendId === d.sendId) setSendResult(d.partial);
          }
        }
      }
    } catch {}
    setHydrated(true);
  }, []);

  // Persist the draft; an empty composition clears it (2026-09-27).
  useEffect(() => {
    if (!hydrated) return;
    try {
      if (!subject && !body && !preheader) {
        localStorage.removeItem(DRAFT_KEY);
      } else {
        const draft: Draft = { subject, body, preheader, includeLeads, sendId, partial: sendResult?.partial ? sendResult : null };
        localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
      }
    } catch {}
  }, [hydrated, subject, body, preheader, includeLeads, sendId, sendResult]);

  const composition: Composition = { subject, body, preheader, includeLeads };
  const continuing = !!(sendResult?.partial && sendResult.sendId === sendId && sameComposition(sendResult.composition, composition));

  // A blast with this subject already went out in the last 48 h (2026-09-27):
  // the dedupe only covers the same send id, so a re-typed composition would
  // mail everyone twice. The partial run's own summary is not a repeat.
  const repeatOf = useMemo(() => {
    const n = normSubject(subject);
    if (!n) return null;
    const cutoff = Date.now() - 48 * 60 * 60 * 1000;
    return recentSends.find((s) => s.sendId !== sendId && normSubject(s.subject) === n && new Date(s.at).getTime() > cutoff) || null;
  }, [subject, recentSends, sendId]);

  const recipientCount = useMemo(() => {
    return includeLeads ? counts.total : counts.explicit;
  }, [includeLeads, counts]);

  const loadSubs = useCallback(async () => {
    setLoading(true);
    setAuthError("");
    try {
      const r = await fetch(`/api/admin/newsletter`, { cache: "no-store", headers: AUTH_HEADERS });
      if (r.status === 401) {
        setAuthError("Not signed in — sign in with Google on /admin (your session may have expired), then reload.");
        return;
      }
      if (!r.ok) {
        // The route explains its 502s (incomplete or truncated history);
        // show that rather than the bare status (2026-09-27).
        const d = (await r.json().catch(() => ({}))) as { error?: string };
        setAuthError(d.error || `HTTP ${r.status}`);
        return;
      }
      const data = (await r.json()) as SubsResp;
      setSubs(data.subscribers || []);
      setRecentSends(data.recentSends || []);
      setCounts({
        total: data.count || 0,
        explicit: data.explicitCount || 0,
        fromLeads: data.fromLeadsCount || 0,
      });
    } catch (e) {
      setAuthError(e instanceof Error ? e.message : "Network error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSubs();
  }, [loadSubs]);

  const doPreview = async () => {
    if (!subject.trim() || !body.trim()) {
      setError("Subject and body required for preview");
      return;
    }
    setPreviewing(true);
    setError("");
    try {
      const r = await fetch(`/api/admin/newsletter/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...AUTH_HEADERS },
        body: JSON.stringify({ subject, body, preheader, includeLeads, dryRun: true }),
      });
      const d = (await r.json()) as DryRunResp | { error?: string };
      if (!r.ok || !("ok" in d) || !d.ok) {
        setError(("error" in d ? d.error : null) || `HTTP ${r.status}`);
        return;
      }
      setPreviewHtml(d.previewHtml);
      setPreviewRecipient(d.previewRecipient);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Preview failed");
    } finally {
      setPreviewing(false);
    }
  };

  // Mail this exact composition to OWNER_EMAIL only (2026-09-26).
  const doTest = async () => {
    if (!subject.trim() || body.trim().length < 30) {
      setError("Subject and body (30+ characters) required for a test send");
      return;
    }
    setTesting(true);
    setError("");
    setTestResult("");
    try {
      const r = await fetch(`/api/admin/newsletter/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...AUTH_HEADERS },
        body: JSON.stringify({ subject, body, preheader, testOnly: true }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok || !d.ok) {
        setError(d.error || `HTTP ${r.status}`);
        return;
      }
      setTestResult(`Test sent to ${d.to} — check that inbox before sending to everyone.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Test send failed");
    } finally {
      setTesting(false);
    }
  };

  const doSend = async () => {
    // A continuation was already confirmed when the blast started.
    if (!confirmSend && !continuing) {
      setConfirmSend(true);
      return;
    }
    setSending(true);
    setError("");
    // A partial result stays on screen while its continuation runs: if the
    // request fails, "Continue" is still there (2026-09-27).
    if (!continuing) setSendResult(null);
    try {
      const r = await fetch(`/api/admin/newsletter/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...AUTH_HEADERS },
        body: JSON.stringify({ subject, body, preheader, includeLeads, dryRun: false, sendId }),
      });
      const d = await r.json();
      if (!r.ok || !d.ok) {
        setError(d.error || `HTTP ${r.status}`);
        setConfirmSend(false);
        return;
      }
      // The composition rides with the result so "Continue" can insist on it.
      setSendResult({ ...(d as SendResp), composition });
      setConfirmSend(false);
      // A run that stopped at the time budget keeps the composition and the
      // sendId so "Continue" resumes where it stopped; a complete run clears
      // (and, through the persist effect, the saved draft).
      if (!(d as SendResp).partial) {
        setSubject("");
        setBody("");
        setPreheader("");
        setPreviewHtml("");
      }
      // Reload subs in case any unsubs happened mid-send.
      loadSubs();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Send failed");
      setConfirmSend(false);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="tadm-wrap">
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
        <div className="tadm-page-head" style={{ flex: 1 }}>
          <h1>Newsletter</h1>
          <p>Subscribers, compose &amp; send — dry-run preview before anything goes out.</p>
        </div>
        <button onClick={loadSubs} disabled={loading} className="tadm-btn sm">
          {loading ? "Loading…" : "Refresh"}
        </button>
      </div>

      {authError && (
        <div className="tadm-card" style={{ borderColor: "var(--tadm-bad)" }}>
          <p style={{ margin: 0, fontSize: 12.5, fontWeight: 600, color: "var(--tadm-bad)" }}>
            {authError}{" "}
            <a href="/api/auth/google?returnTo=%2Fadmin%2Fnewsletter" style={{ color: "var(--tadm-info)" }}>Sign in</a>
          </p>
        </div>
      )}

      {/* Stat tiles */}
      <div className="tadm-tiles" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))" }}>
        <div className="tadm-tile" style={{ cursor: "default" }}>
          <div className="num green">{counts.explicit}</div>
          <div className="lbl">EXPLICIT SIGNUPS</div>
          <div className="sub">opted in via newsletter form</div>
        </div>
        <div className="tadm-tile" style={{ cursor: "default" }}>
          <div className="num" style={{ color: "var(--tadm-warn)" }}>{counts.fromLeads}</div>
          <div className="lbl">FROM BUYBACK LEADS</div>
          <div className="sub">customers — implicit (CAN-SPAM existing biz relationship)</div>
        </div>
        <div className="tadm-tile" style={{ cursor: "default" }}>
          <div className="num">{recipientCount}</div>
          <div className="lbl">RECIPIENTS IF SENT NOW</div>
          <div className="sub">{includeLeads ? "explicit + leads" : "explicit only"}</div>
        </div>
      </div>

      {/* Compose */}
      <div className="tadm-card" style={{ marginTop: 10 }}>
        <h3>Compose</h3>

        <label style={lbl}>Subject <span style={hint}>(shows in inbox)</span></label>
        <input
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="iPhone trade-in prices just went up"
          maxLength={200}
          className="tadm-input"
          style={{ width: "100%", marginBottom: 12 }}
        />

        <label style={lbl}>Preheader <span style={hint}>(inbox preview line, optional)</span></label>
        <input
          value={preheader}
          onChange={(e) => setPreheader(e.target.value)}
          placeholder="iPhone 17 Pro Max now $20 more — locked through this weekend"
          maxLength={120}
          className="tadm-input"
          style={{ width: "100%", marginBottom: 12 }}
        />

        <label style={lbl}>
          Body
          <span style={hint}> — use {"{firstName}"} as a placeholder; falls back to &quot;there&quot;</span>
        </label>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={12}
          maxLength={20000}
          placeholder={"Quick heads up — we just bumped buyback prices on iPhone 17 Pro Max, MacBook Pro M4, and a handful of others.\n\nIf you've been thinking about trading anything in, this is the week.\n\nGet a quote: https://topcashcellular.com"}
          className="tadm-textarea"
          style={{ width: "100%", resize: "none", fontFamily: "var(--tadm-mono)", lineHeight: 1.6 }}
        />
        <p style={{ margin: "6px 0 12px", font: "600 10.5px var(--tadm-mono)", color: "var(--tadm-faint)" }}>
          {body.length}/20000 · {"{firstName}"} interpolates per recipient. Blank lines split paragraphs.
        </p>

        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11.5, fontWeight: 500, color: "var(--tadm-dim)", marginBottom: 14, cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={includeLeads}
            onChange={(e) => setIncludeLeads(e.target.checked)}
            style={{ width: 15, height: 15, cursor: "pointer", accentColor: "var(--tadm-green)" }}
          />
          Include past buyback customers (marketing to past quote/trade customers — every mail is marked promotional and carries unsubscribe — adds {counts.fromLeads} recipients)
        </label>

        {repeatOf && !continuing && (
          <p style={{ margin: "0 0 10px", fontSize: 12, fontWeight: 600, color: "var(--tadm-warn)" }}>
            A newsletter with this subject already went out {ago(repeatOf.at)} ({repeatOf.sent} sent, id {repeatOf.sendId}). Sending again mails everyone a second copy — the dedupe only covers the same send id.
          </p>
        )}

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button
            onClick={doPreview}
            disabled={previewing || !subject.trim() || body.trim().length < 30}
            className="tadm-btn"
          >
            {previewing ? "Rendering…" : "Preview (dry run)"}
          </button>
          <button
            onClick={doTest}
            disabled={testing || sending || !subject.trim() || body.trim().length < 30}
            className="tadm-btn"
            title="Mail this exact newsletter to OWNER_EMAIL only — nothing else goes out"
          >
            {testing ? "Sending test…" : "Send a test to me"}
          </button>
          <button
            onClick={doSend}
            disabled={sending || !subject.trim() || body.trim().length < 30 || recipientCount === 0}
            className={`tadm-btn ${confirmSend || continuing ? "danger" : "primary"}`}
          >
            {sending
              ? "Sending…"
              : continuing
                ? `Continue sending (${sendResult?.remaining ?? "?"} remaining)`
                : confirmSend
                  ? `CONFIRM: Send to ${recipientCount} recipient${recipientCount === 1 ? "" : "s"}`
                  : `Send to ${recipientCount} →`}
          </button>
          {confirmSend && !sending && (
            <button onClick={() => setConfirmSend(false)} className="tadm-btn">
              Cancel
            </button>
          )}
        </div>
        {error && <p style={{ margin: "10px 0 0", fontSize: 12, fontWeight: 600, color: "var(--tadm-bad)" }}>{error}</p>}
        {testResult && <p style={{ margin: "10px 0 0", fontSize: 12, fontWeight: 600, color: "var(--tadm-green)" }}>{testResult}</p>}
      </div>

      {/* Preview */}
      {previewHtml && (
        <div className="tadm-card" style={{ marginTop: 10 }}>
          <h3>
            Preview
            <span className="right" style={{ fontWeight: 500 }}>rendered for {previewRecipient}</span>
          </h3>
          <iframe
            srcDoc={previewHtml}
            style={{ width: "100%", height: 600, background: "#fff", border: "1px solid var(--tadm-border)", borderRadius: 10 }}
            title="Newsletter preview"
            sandbox="allow-same-origin"
          />
        </div>
      )}

      {/* Send result */}
      {sendResult && (
        <div className="tadm-card" style={{ marginTop: 10 }}>
          <h3>
            Send result
            <span className="right">{sendResult.partial ? <span className="tadm-pill warn">PARTIAL</span> : <span className="tadm-pill on">SENT</span>}</span>
          </h3>
          <p style={{ margin: "0 0 6px", fontSize: 13, color: "var(--tadm-text)" }}>
            <strong>{sendResult.sent}</strong> accepted by Resend · <strong>{sendResult.failed}</strong> failed (out of {sendResult.count} total)
            {(sendResult.skippedUnsub || 0) > 0 && <> · {sendResult.skippedUnsub} unsubscribed (skipped)</>}
            {(sendResult.skippedAlreadySent || 0) > 0 && <> · {sendResult.skippedAlreadySent} already mailed under this send (skipped)</>}
            {(sendResult.skippedBlobError || 0) > 0 && <> · {sendResult.skippedBlobError} skipped — opt-out store unreadable, not mailed to be safe</>}
            {typeof sendResult.batches === "number" && <> · {sendResult.batches} batch{sendResult.batches === 1 ? "" : "es"}</>}
          </p>
          {sendResult.partial && (
            <p style={{ margin: "0 0 6px", fontSize: 12.5, fontWeight: 600, color: "var(--tadm-warn)" }}>
              Stopped early to stay inside the server&apos;s time budget — {sendResult.remaining} recipient{sendResult.remaining === 1 ? "" : "s"} not yet mailed. Click &quot;Continue sending&quot; above; everyone already mailed is skipped.
            </p>
          )}
          <p style={{ margin: "0 0 10px", font: "600 11px var(--tadm-mono)", color: "var(--tadm-faint)" }}>
            Send ID: <span style={{ color: "var(--tadm-dim)" }}>{sendResult.sendId}</span>
          </p>
          {sendResult.failures.length > 0 && (
            <details style={{ fontSize: 12 }}>
              <summary style={{ color: "var(--tadm-warn)", cursor: "pointer", marginBottom: 6 }}>
                Failed addresses ({sendResult.failures.length})
              </summary>
              <ul style={{ margin: 0, paddingLeft: 18, color: "var(--tadm-dim)", display: "grid", gap: 4 }}>
                {sendResult.failures.map((f, i) => (
                  <li key={i}>{f.email}: {f.error}</li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}

      {/* Recent sends (2026-09-27) — the [NEWSLETTER-SENT] summary markers */}
      <div className="tadm-card" style={{ marginTop: 10 }}>
        <h3>
          Recent sends
          <span className="right">{recentSends.length}</span>
        </h3>
        {recentSends.length === 0 ? (
          <div className="tadm-empty">No blasts recorded yet.</div>
        ) : (
          <div className="tadm-rows" style={{ maxHeight: 260, overflowY: "auto" }}>
            {recentSends.map((s) => (
              <div key={`${s.sendId}-${s.at}`} className="tadm-row">
                <span className="main">
                  {s.subject || "(no subject)"}
                  <span className="dim"> · {s.sent} sent · {s.failed} failed · {s.total} on list{s.includeLeads ? " · incl. leads" : ""}</span>
                </span>
                <span className="meta">{new Date(s.at).toLocaleString()}</span>
                <span className={`tadm-pill ${s.partial ? "warn" : "on"}`}>{s.partial ? "partial" : "sent"}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Subscriber list */}
      <div className="tadm-card" style={{ marginTop: 10 }}>
        <h3>
          Subscribers
          <span className="right">{subs.length}</span>
        </h3>
        {subs.length === 0 ? (
          <div className="tadm-empty">No subscribers yet. The signup form on the homepage feeds this list.</div>
        ) : (
          <div className="tadm-rows" style={{ maxHeight: 400, overflowY: "auto" }}>
            {subs.map((s) => (
              <div key={s.email} className="tadm-row">
                <span className="main">
                  {s.email}
                  {s.name ? <span className="dim"> · {s.name}</span> : null}
                </span>
                <span className="meta">{new Date(s.signedUpAt).toLocaleDateString()}</span>
                <span className={`tadm-pill ${s.source === "signup" ? "on" : s.source === "lead" ? "warn" : "off"}`}>
                  {s.source || "?"}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
