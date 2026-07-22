"use client";

// Native Credit Disputes dashboard inside the TCC admin. Reads the credit-intake
// operator API through /api/admin/credit-disputes/* (server-side proxy that holds
// the operator key). Auth = the same Google-staff gate as the rest of /admin.
import { useEffect, useState, useCallback } from "react";
import type { CSSProperties } from "react";

const BUREAUS = ["Equifax", "Experian", "TransUnion"];
const OUTCOMES = ["deleted", "verified", "updated", "no_response", "pending"];
const EVENT_LABEL: Record<string, string> = {
  created: "Link created", info_saved: "Client submitted details",
  letters_sent: "Letters mailed", result: "Result recorded", completed: "Marked complete",
};
const API = "/api/admin/credit-disputes";

function hdrs(extra?: Record<string, string>): Record<string, string> {
  const h: Record<string, string> = { ...(extra || {}) };
  if (typeof window !== "undefined") {
    const t = localStorage.getItem("tcc-admin-token-v1") || localStorage.getItem("tcc-admin-token");
    if (t) h["x-admin-token"] = t;
  }
  return h;
}
function fmt(s?: string) { return s ? String(s).slice(0, 16).replace("T", " ") : "—"; }

type Row = {
  token: string; clientName: string; clientEmail?: string; createdAt: string;
  status: string; docCount: number; categories: string[];
  lettersSentAt?: string; resultCount: number;
};

export default function CreditDisputes() {
  const [rows, setRows] = useState<Row[]>([]);
  const [sel, setSel] = useState<any>(null);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  const loadList = useCallback(async () => {
    setLoading(true); setErr("");
    try {
      const r = await fetch(`${API}/intakes`, { headers: hdrs() });
      if (!r.ok) { setErr(r.status === 401 ? "Not authorized." : "Couldn't load."); return; }
      setRows((await r.json()).intakes || []);
    } catch { setErr("Network error."); } finally { setLoading(false); }
  }, []);
  useEffect(() => { loadList(); }, [loadList]);

  const openDetail = async (token: string) => {
    const r = await fetch(`${API}/intake/${token}`, { headers: hdrs() });
    if (r.ok) setSel(await r.json());
  };
  const post = async (path: string, body: any) => {
    await fetch(`${API}/${path}`, { method: "POST", headers: hdrs({ "content-type": "application/json" }), body: JSON.stringify(body) });
  };
  const markSent = async () => {
    await post(`intake/${sel.token}/sent`, { bureaus: sel.sentBureaus?.length ? sel.sentBureaus : BUREAUS });
    await openDetail(sel.token); loadList();
  };
  const addResult = async (bureau: string, outcome: string, note: string) => {
    await post(`intake/${sel.token}/result`, { bureau, outcome, note });
    await openDetail(sel.token); loadList();
  };
  const markComplete = async () => { await post(`intake/${sel.token}`, {}); await openDetail(sel.token); loadList(); };
  const download = async (name: string) => {
    const r = await fetch(`${API}/intake/${sel.token}/file?name=${encodeURIComponent(name)}`, { headers: hdrs() });
    if (!r.ok) return;
    const blob = await r.blob(); const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = name; a.click(); URL.revokeObjectURL(url);
  };
  const del = async (token: string) => {
    if (!confirm("Delete this client's intake and all their files?")) return;
    await fetch(`${API}/intake/${token}`, { method: "DELETE", headers: hdrs() });
    setSel(null); loadList();
  };

  return (
    <div style={{ maxWidth: 1040 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
        <h1 style={{ fontSize: 22, margin: 0 }}>Credit Disputes</h1>
        <button style={ghost} onClick={loadList}>↻ Refresh</button>
        <span style={{ color: "#6b7280", fontSize: 13 }}>{rows.length} client(s)</span>
      </div>
      {err && <p style={{ color: "#c0392b" }}>{err}</p>}
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
          <thead><tr style={{ background: "#eef1f6", textAlign: "left" }}>
            {["Client", "Email", "Status", "Docs", "Letters sent", "Results", ""].map((h) => <th key={h} style={th}>{h}</th>)}
          </tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.token} style={{ borderBottom: "1px solid #eef1f6" }}>
                <td style={td}><b>{r.clientName}</b></td>
                <td style={td}>{r.clientEmail || "—"}</td>
                <td style={td}>{r.status === "closed" ? "✓ complete" : r.docCount ? "received" : "waiting"}</td>
                <td style={td}>{r.docCount || 0}</td>
                <td style={td}>{r.lettersSentAt ? fmt(r.lettersSentAt) : "—"}</td>
                <td style={td}>{r.resultCount || 0}</td>
                <td style={td}><button style={ghost} onClick={() => openDetail(r.token)}>Open</button></td>
              </tr>
            ))}
            {!rows.length && <tr><td style={td} colSpan={7}>{loading ? "Loading…" : "No clients yet."}</td></tr>}
          </tbody>
        </table>
      </div>

      {sel && (
        <div style={overlay} onClick={() => setSel(null)}>
          <div style={panel} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", alignItems: "center" }}>
              <h2 style={{ margin: 0 }}>{sel.clientName}</h2>
              <button style={{ ...ghost, marginLeft: "auto" }} onClick={() => setSel(null)}>Close</button>
            </div>
            <Detail sel={sel} onSent={markSent} onResult={addResult} onComplete={markComplete} onDownload={download} onDelete={() => del(sel.token)} />
          </div>
        </div>
      )}
    </div>
  );
}

function Detail({ sel, onSent, onResult, onComplete, onDownload, onDelete }: any) {
  const [bureau, setBureau] = useState(BUREAUS[0]);
  const [outcome, setOutcome] = useState(OUTCOMES[0]);
  const [note, setNote] = useState("");
  const info = sel.info || {};
  const timeline = [
    ...(sel.events || []).map((e: any) => ({ at: e.at, text: EVENT_LABEL[e.type] || e.type, detail: e.detail })),
    ...(sel.documents || []).map((d: any) => ({ at: d.uploadedAt, text: "Uploaded " + String(d.category).replace(/_/g, " ") })),
  ].filter((x) => x.at).sort((a, b) => (a.at < b.at ? 1 : -1));

  return (
    <>
      <Section title="Client details">
        {[["Email", info.email || sel.clientEmail], ["Phone", info.phone], ["Address", [info.address1, info.cityStateZip].filter(Boolean).join(", ")], ["SSN", info.ssn]]
          .map(([k, v]) => <div key={k as string} style={kv}><b>{k}</b><span>{(v as string) || "—"}</span></div>)}
      </Section>
      <Section title="Accounts to dispute">
        {(sel.items || []).length
          ? <ul style={{ margin: "4px 0 0 18px" }}>{sel.items.map((it: any, i: number) => <li key={i}>{it.creditor}{it.number ? ` — #${it.number}` : ""}</li>)}</ul>
          : <span style={{ color: "#6b7280" }}>none listed</span>}
      </Section>
      <Section title="Documents">
        {(sel.documents || []).length
          ? sel.documents.map((d: any) => (
            <div key={d.name} style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0" }}>
              <span style={{ flex: 1 }}>{String(d.category).replace(/_/g, " ")} · <span style={{ color: "#6b7280" }}>{fmt(d.uploadedAt)}</span></span>
              <button style={ghost} onClick={() => onDownload(d.name)}>Download</button>
            </div>))
          : <span style={{ color: "#6b7280" }}>none uploaded yet</span>}
      </Section>
      <Section title="Dispute status">
        <div style={kv}><b>Letters mailed</b><span>{sel.lettersSentAt ? `${fmt(sel.lettersSentAt)} (${(sel.sentBureaus || []).join(", ") || "—"})` : "not yet"}</span></div>
        <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
          <button style={btn} onClick={onSent}>{sel.lettersSentAt ? "Update mailed date" : "Mark letters mailed today"}</button>
          {sel.status !== "closed" && <button style={ghost} onClick={onComplete}>Mark complete</button>}
        </div>
      </Section>
      <Section title="Results">
        {(sel.results || []).length
          ? sel.results.map((r: any, i: number) => (
            <div key={i} style={kv}><b>{r.bureau}</b><span>{r.outcome}{r.note ? ` — ${r.note}` : ""} · <span style={{ color: "#6b7280" }}>{fmt(r.at)}</span></span></div>))
          : <span style={{ color: "#6b7280" }}>none recorded</span>}
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
          <select value={bureau} onChange={(e) => setBureau(e.target.value)} style={input}>{BUREAUS.map((b) => <option key={b}>{b}</option>)}</select>
          <select value={outcome} onChange={(e) => setOutcome(e.target.value)} style={input}>{OUTCOMES.map((o) => <option key={o}>{o}</option>)}</select>
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="note (optional)" style={{ ...input, flex: 1, minWidth: 120 }} />
          <button style={btn} onClick={() => { onResult(bureau, outcome, note); setNote(""); }}>Add result</button>
        </div>
      </Section>
      <Section title="History">
        {timeline.map((t, i) => <div key={i} style={{ margin: "3px 0" }}><b>{fmt(t.at)}</b> — {t.text}{t.detail ? ` (${t.detail})` : ""}</div>)}
      </Section>
      <button style={{ ...ghost, color: "#c0392b", marginTop: 10 }} onClick={onDelete}>Delete this intake</button>
    </>
  );
}

function Section({ title, children }: any) {
  return <div style={{ marginTop: 14 }}><div style={{ fontWeight: 700, color: "#3a3f4b", marginBottom: 4 }}>{title}</div>{children}</div>;
}

const th: CSSProperties = { padding: "8px 10px", fontWeight: 700, fontSize: 13, whiteSpace: "nowrap" };
const td: CSSProperties = { padding: "8px 10px" };
const kv: CSSProperties = { display: "flex", justifyContent: "space-between", gap: 12, padding: "3px 0", borderBottom: "1px solid #f2f3f6" };
const input: CSSProperties = { border: "1px solid #cdd1d8", borderRadius: 8, padding: "8px 10px", fontSize: 14 };
const btn: CSSProperties = { background: "#2f6df0", color: "#fff", border: 0, borderRadius: 8, padding: "8px 13px", fontWeight: 600, cursor: "pointer" };
const ghost: CSSProperties = { background: "#fff", border: "1px solid #cdd1d8", borderRadius: 8, padding: "6px 11px", cursor: "pointer", fontSize: 13 };
const overlay: CSSProperties = { position: "fixed", inset: 0, background: "rgba(0,0,0,.4)", display: "flex", justifyContent: "center", alignItems: "flex-start", padding: 20, overflowY: "auto", zIndex: 50 };
const panel: CSSProperties = { background: "#fff", borderRadius: 14, padding: 20, maxWidth: 620, width: "100%", boxShadow: "0 12px 40px rgba(0,0,0,.2)" };
