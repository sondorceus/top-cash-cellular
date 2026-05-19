"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";

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
      <main className="min-h-screen bg-[#0a0a0a] text-white flex items-center justify-center p-6">
        <div className="max-w-sm w-full bg-white/5 border border-white/10 rounded-2xl p-6">
          <h1 className="text-xl font-bold mb-2">📬 Newsletter admin</h1>
          <p className="text-sm text-[#bdbdbd] mb-4">Enter your admin token to manage subscribers.</p>
          <form onSubmit={(e) => { e.preventDefault(); submitToken(); }}>
            <input
              type="password"
              value={tokenInput}
              onChange={(e) => setTokenInput(e.target.value)}
              placeholder="admin token"
              className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-[#00c853]"
              autoFocus
            />
            <button type="submit" className="w-full mt-3 bg-[#00c853] hover:bg-[#00e676] text-[#0a0a0a] font-extrabold text-sm py-2.5 rounded-full transition cursor-pointer">
              Continue
            </button>
            {authError && <p className="text-red-400 text-xs mt-3">{authError}</p>}
          </form>
          <Link href="/admin" className="block mt-4 text-[10px] text-[#888] hover:text-white">← back to /admin</Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#0a0a0a] text-white">
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <Link href="/admin" className="text-[11px] text-[#888] hover:text-white">← admin home</Link>
            <h1 className="text-2xl font-bold mt-1">📬 Newsletter</h1>
          </div>
          <button onClick={loadSubs} disabled={loading} className="text-xs bg-white/5 border border-white/10 hover:bg-white/10 px-3 py-1.5 rounded cursor-pointer disabled:opacity-50">
            {loading ? "Loading…" : "Refresh"}
          </button>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-3 gap-3 mb-8">
          <div className="bg-white/5 border border-white/10 rounded-xl p-4">
            <p className="text-[10px] uppercase tracking-wider text-[#888] font-bold mb-1">Explicit signups</p>
            <p className="text-3xl font-bold text-[#00c853]">{counts.explicit}</p>
            <p className="text-[10px] text-[#666] mt-1">opted in via newsletter form</p>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-xl p-4">
            <p className="text-[10px] uppercase tracking-wider text-[#888] font-bold mb-1">From buyback leads</p>
            <p className="text-3xl font-bold text-[#ffb400]">{counts.fromLeads}</p>
            <p className="text-[10px] text-[#666] mt-1">customers — implicit (CAN-SPAM existing biz relationship)</p>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-xl p-4">
            <p className="text-[10px] uppercase tracking-wider text-[#888] font-bold mb-1">Recipient if you send now</p>
            <p className="text-3xl font-bold text-white">{recipientCount}</p>
            <p className="text-[10px] text-[#666] mt-1">{includeLeads ? "explicit + leads" : "explicit only"}</p>
          </div>
        </div>

        {/* Compose */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-5 mb-6">
          <h2 className="text-sm font-bold uppercase tracking-wider text-[#dcdcdc] mb-4">Compose</h2>

          <label className="block text-[10px] uppercase tracking-wider text-[#dcdcdc] font-bold mb-1">Subject <span className="text-[#888] normal-case">(shows in inbox)</span></label>
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="iPhone trade-in prices just went up"
            maxLength={200}
            className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-[#00c853] mb-3"
          />

          <label className="block text-[10px] uppercase tracking-wider text-[#dcdcdc] font-bold mb-1">Preheader <span className="text-[#888] normal-case">(inbox preview line, optional)</span></label>
          <input
            value={preheader}
            onChange={(e) => setPreheader(e.target.value)}
            placeholder="iPhone 17 Pro Max now $20 more — locked through this weekend"
            maxLength={120}
            className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-[#00c853] mb-3"
          />

          <label className="block text-[10px] uppercase tracking-wider text-[#dcdcdc] font-bold mb-1">
            Body
            <span className="text-[#888] normal-case ml-1">— use {"{firstName}"} as a placeholder; falls back to &quot;there&quot;</span>
          </label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={12}
            maxLength={20000}
            placeholder={"Quick heads up — we just bumped buyback prices on iPhone 17 Pro Max, MacBook Pro M4, and a handful of others.\n\nIf you've been thinking about trading anything in, this is the week.\n\nGet a quote: https://topcashcellular.com"}
            className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white leading-relaxed focus:outline-none focus:border-[#00c853] resize-none mb-2 font-mono"
          />
          <p className="text-[10px] text-[#888] mb-3">{body.length}/20000 · {"{firstName}"} interpolates per recipient. Blank lines split paragraphs.</p>

          <label className="flex items-center gap-2 text-[11px] text-[#dcdcdc] mb-4 cursor-pointer">
            <input
              type="checkbox"
              checked={includeLeads}
              onChange={(e) => setIncludeLeads(e.target.checked)}
              className="w-4 h-4 cursor-pointer"
            />
            Include past buyback customers (CAN-SPAM existing-business-relationship — adds {counts.fromLeads} recipients)
          </label>

          <div className="flex gap-2">
            <button
              onClick={doPreview}
              disabled={previewing || !subject.trim() || body.trim().length < 30}
              className="px-4 py-2 bg-white/5 border border-white/15 hover:bg-white/10 rounded-full text-sm font-bold cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {previewing ? "Rendering…" : "👁 Preview"}
            </button>
            <button
              onClick={doSend}
              disabled={sending || !subject.trim() || body.trim().length < 30 || recipientCount === 0}
              className={`px-4 py-2 rounded-full text-sm font-extrabold cursor-pointer transition disabled:opacity-40 disabled:cursor-not-allowed ${
                confirmSend
                  ? "bg-red-500 hover:bg-red-400 text-white"
                  : "bg-[#00c853] hover:bg-[#00e676] text-[#0a0a0a]"
              }`}
            >
              {sending
                ? "Sending…"
                : confirmSend
                  ? `🚀 CONFIRM: Send to ${recipientCount}`
                  : `Send to ${recipientCount} →`}
            </button>
            {confirmSend && !sending && (
              <button
                onClick={() => setConfirmSend(false)}
                className="px-4 py-2 bg-white/5 border border-white/15 hover:bg-white/10 rounded-full text-sm cursor-pointer"
              >
                Cancel
              </button>
            )}
          </div>
          {error && <p className="text-red-400 text-xs mt-3">⚠️ {error}</p>}
        </div>

        {/* Preview */}
        {previewHtml && (
          <div className="bg-white/5 border border-white/10 rounded-2xl p-5 mb-6">
            <h2 className="text-sm font-bold uppercase tracking-wider text-[#dcdcdc] mb-2">
              Preview <span className="text-[#888] normal-case ml-2">— rendered for {previewRecipient}</span>
            </h2>
            <iframe
              srcDoc={previewHtml}
              className="w-full h-[600px] bg-white rounded-lg border border-white/10"
              title="Newsletter preview"
              sandbox="allow-same-origin"
            />
          </div>
        )}

        {/* Send result */}
        {sendResult && (
          <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-5 mb-6">
            <h2 className="text-sm font-bold uppercase tracking-wider text-emerald-300 mb-3">✓ Sent</h2>
            <p className="text-white text-sm mb-2">
              <strong>{sendResult.sent}</strong> delivered to recipients · <strong>{sendResult.failed}</strong> failed (out of {sendResult.count} total)
            </p>
            <p className="text-[#888] text-xs mb-3">Send ID: <code className="text-[#dcdcdc]">{sendResult.sendId}</code></p>
            {sendResult.failures.length > 0 && (
              <details className="text-xs">
                <summary className="text-yellow-300 cursor-pointer mb-2">Failed addresses ({sendResult.failures.length})</summary>
                <ul className="text-[#bdbdbd] space-y-1 ml-2">
                  {sendResult.failures.map((f, i) => (
                    <li key={i}>{f.email}: {f.error}</li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        )}

        {/* Subscriber list */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
          <h2 className="text-sm font-bold uppercase tracking-wider text-[#dcdcdc] mb-3">Subscribers ({subs.length})</h2>
          {subs.length === 0 ? (
            <p className="text-[#888] text-sm">No subscribers yet. The signup form on the homepage feeds this list.</p>
          ) : (
            <div className="max-h-[400px] overflow-y-auto -mx-2">
              <table className="w-full text-sm">
                <thead className="text-[10px] uppercase tracking-wider text-[#888] font-bold border-b border-white/10">
                  <tr>
                    <th className="text-left px-2 py-2">Email</th>
                    <th className="text-left px-2 py-2">Name</th>
                    <th className="text-left px-2 py-2">Signed up</th>
                    <th className="text-left px-2 py-2">Source</th>
                  </tr>
                </thead>
                <tbody>
                  {subs.map((s) => (
                    <tr key={s.email} className="border-b border-white/5 hover:bg-white/[0.02]">
                      <td className="px-2 py-2 text-[#dcdcdc]">{s.email}</td>
                      <td className="px-2 py-2 text-[#bdbdbd]">{s.name || "—"}</td>
                      <td className="px-2 py-2 text-[#888] text-[11px]">{new Date(s.signedUpAt).toLocaleDateString()}</td>
                      <td className="px-2 py-2 text-[10px]">
                        <span className={`px-1.5 py-0.5 rounded ${s.source === "signup" ? "bg-emerald-500/15 text-emerald-300" : s.source === "lead" ? "bg-amber-500/15 text-amber-300" : "bg-white/10 text-[#bdbdbd]"}`}>
                          {s.source || "?"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
