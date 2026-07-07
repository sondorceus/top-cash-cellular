"use client";

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";

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
};

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
  failures: { email: string; error: string }[];
};

const STORAGE_KEY = "tcc_admin_token";

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
  const [token, setToken] = useState("");
  const [tokenInput, setTokenInput] = useState("");
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

  useEffect(() => {
    const saved = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
    if (saved) setToken(saved);
  }, []);

  const recipientCount = useMemo(() => {
    return includeLeads ? counts.total : counts.explicit;
  }, [includeLeads, counts]);

  const loadSubs = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setAuthError("");
    try {
      const r = await fetch(`/api/admin/newsletter?token=${encodeURIComponent(token)}`, { cache: "no-store" });
      if (r.status === 401) {
        setAuthError("Invalid admin token");
        setToken("");
        if (typeof window !== "undefined") localStorage.removeItem(STORAGE_KEY);
        return;
      }
      if (!r.ok) {
        setAuthError(`HTTP ${r.status}`);
        return;
      }
      const data = (await r.json()) as SubsResp;
      setSubs(data.subscribers || []);
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
  }, [token]);

  useEffect(() => {
    if (token) loadSubs();
  }, [token, loadSubs]);

  const submitToken = () => {
    const t = tokenInput.trim();
    if (!t) return;
    setToken(t);
    if (typeof window !== "undefined") localStorage.setItem(STORAGE_KEY, t);
  };

  const doPreview = async () => {
    if (!subject.trim() || !body.trim()) {
      setError("Subject and body required for preview");
      return;
    }
    setPreviewing(true);
    setError("");
    try {
      const r = await fetch(`/api/admin/newsletter/send?token=${encodeURIComponent(token)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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

  const doSend = async () => {
    if (!confirmSend) {
      setConfirmSend(true);
      return;
    }
    setSending(true);
    setError("");
    setSendResult(null);
    try {
      const r = await fetch(`/api/admin/newsletter/send?token=${encodeURIComponent(token)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, body, preheader, includeLeads, dryRun: false }),
      });
      const d = await r.json();
      if (!r.ok || !d.ok) {
        setError(d.error || `HTTP ${r.status}`);
        setConfirmSend(false);
        return;
      }
      setSendResult(d as SendResp);
      setConfirmSend(false);
      setSubject("");
      setBody("");
      setPreheader("");
      setPreviewHtml("");
      // Reload subs in case any unsubs happened mid-send.
      loadSubs();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Send failed");
      setConfirmSend(false);
    } finally {
      setSending(false);
    }
  };

  if (!token) {
    return (
      <div className="tadm-wrap">
        <div className="tadm-card" style={{ maxWidth: 420, margin: "48px auto 0" }}>
          <h3>Newsletter admin</h3>
          <p style={{ margin: "0 0 12px", fontSize: 12.5, fontWeight: 500, color: "var(--tadm-dim)" }}>
            Enter your admin token to manage subscribers.
          </p>
          <form onSubmit={(e) => { e.preventDefault(); submitToken(); }}>
            <input
              type="password"
              value={tokenInput}
              onChange={(e) => setTokenInput(e.target.value)}
              placeholder="admin token"
              className="tadm-input"
              style={{ width: "100%" }}
              autoFocus
            />
            <button type="submit" className="tadm-btn primary" style={{ width: "100%", marginTop: 10 }}>
              Continue
            </button>
            {authError && <p style={{ margin: "10px 0 0", fontSize: 12, color: "var(--tadm-bad)" }}>{authError}</p>}
          </form>
        </div>
      </div>
    );
  }

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
          Include past buyback customers (CAN-SPAM existing-business-relationship — adds {counts.fromLeads} recipients)
        </label>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button
            onClick={doPreview}
            disabled={previewing || !subject.trim() || body.trim().length < 30}
            className="tadm-btn"
          >
            {previewing ? "Rendering…" : "Preview (dry run)"}
          </button>
          <button
            onClick={doSend}
            disabled={sending || !subject.trim() || body.trim().length < 30 || recipientCount === 0}
            className={`tadm-btn ${confirmSend ? "danger" : "primary"}`}
          >
            {sending
              ? "Sending…"
              : confirmSend
                ? `CONFIRM: Send to ${recipientCount}`
                : `Send to ${recipientCount} →`}
          </button>
          {confirmSend && !sending && (
            <button onClick={() => setConfirmSend(false)} className="tadm-btn">
              Cancel
            </button>
          )}
        </div>
        {error && <p style={{ margin: "10px 0 0", fontSize: 12, fontWeight: 600, color: "var(--tadm-bad)" }}>{error}</p>}
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
            <span className="right"><span className="tadm-pill on">SENT</span></span>
          </h3>
          <p style={{ margin: "0 0 6px", fontSize: 13, color: "var(--tadm-text)" }}>
            <strong>{sendResult.sent}</strong> delivered · <strong>{sendResult.failed}</strong> failed (out of {sendResult.count} total)
          </p>
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
