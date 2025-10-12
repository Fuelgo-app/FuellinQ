// src/pages/Invoices.jsx
import React, { useEffect, useMemo, useState } from "react";
import { API_BASE, apiFetch } from "@/api/base.js";

/* --- auth header helper (werkt samen met apiFetch) --- */
const getToken = () => localStorage.getItem("token") || "";
const authHeaders = () => (getToken() ? { Authorization: `Bearer ${getToken()}` } : {});

/* --- utils --- */
const euro = (n) =>
  (typeof n === "number" ? n : Number(n || 0)).toLocaleString("nl-NL", {
    style: "currency",
    currency: "EUR",
  });

const startOfMonth = (d = new Date()) =>
  new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
const endOfMonth = (d = new Date()) =>
  new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().slice(0, 10);
const withinRange = (iso, from, to) => (!iso ? false : (!from || iso >= from) && (!to || iso <= to));

/* --- sort helper --- */
const sortRows = (rows, sort) => {
  const { key, dir } = sort;
  const factor = dir === "desc" ? -1 : 1;
  const safe = (v) => (v == null ? "" : v);
  return [...rows].sort((a, b) => {
    let va = a[key];
    let vb = b[key];
    if (key === "amount") {
      va = Number(va || 0);
      vb = Number(vb || 0);
    } else if (key === "date") {
      // ISO yyyy-mm-dd sorteert als string ook goed, maar dit is expliciet
      va = safe(va);
      vb = safe(vb);
    } else {
      va = String(safe(va)).toLowerCase();
      vb = String(safe(vb)).toLowerCase();
    }
    if (va < vb) return -1 * factor;
    if (va > vb) return 1 * factor;
    return 0;
  });
};

export default function InvoicesPage() {
  /* --- data state --- */
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  /* --- filters --- */
  const [from, setFrom] = useState(startOfMonth(new Date(new Date().getFullYear(), new Date().getMonth() - 5, 1)));
  const [to, setTo] = useState(endOfMonth());
  const [status, setStatus] = useState("all");
  const [q, setQ] = useState("");

  /* --- sort --- */
  const [sort, setSort] = useState({ key: "date", dir: "desc" }); // default: nieuwste eerst

  /* --- selectie/paginatie --- */
  const [checked, setChecked] = useState({});
  const [page, setPage] = useState(1);
  const pageSize = 12;

  /* --- initial load --- */
  useEffect(() => {
    (async () => {
      setLoading(true);
      setError("");
      try {
        const data = await apiFetch("/api/invoices", { headers: { ...authHeaders() } });
        // server geeft: { invoices: [ {id, number, amount_cents, status, date} ] }
        const normalized = (data.invoices || []).map((r) => ({
          id: r.id,
          number: r.number || `INV-${String(r.id).padStart(5, "0")}`,
          date: r.date, // 'YYYY-MM-DD'
          status: (r.status || "open").toLowerCase(),
          amount: Number(r.amount_cents || 0) / 100,
        }));
        setRows(normalized);
      } catch (e) {
        console.error(e);
        setError(e?.message || "Kon facturen niet laden.");
        setRows([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  /* --- filter + search --- */
  const filtered = useMemo(() => {
    let list = rows.filter((r) => {
      if (!withinRange(r.date, from, to)) return false;
      if (status !== "all" && r.status !== status) return false;
      if (q) {
        const qq = q.toLowerCase();
        if (!(`${r.number}`.toLowerCase().includes(qq))) return false;
      }
      return true;
    });
    list = sortRows(list, sort);
    return list;
  }, [rows, from, to, status, q, sort]);

  /* --- KPI's --- */
  const kpis = useMemo(() => {
    const paid = filtered.filter((r) => r.status === "paid").reduce((s, r) => s + r.amount, 0);
    const open = filtered.filter((r) => r.status !== "paid").reduce((s, r) => s + r.amount, 0);
    return { count: filtered.length, paid, open, total: paid + open };
  }, [filtered]);

  /* --- paginatie --- */
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageRows = filtered.slice((page - 1) * pageSize, page * pageSize);

  /* --- selectie helpers --- */
  const allOnPageChecked = pageRows.length > 0 && pageRows.every((r) => !!checked[r.id]);
  const toggleAllOnPage = (v) => {
    const copy = { ...checked };
    pageRows.forEach((r) => (copy[r.id] = v));
    setChecked(copy);
  };
  const toggleAllFiltered = (v) => {
    const copy = { ...checked };
    filtered.forEach((r) => (copy[r.id] = v));
    setChecked(copy);
  };

  /* --- actions --- */
  function exportCSV(selectionOnly = false) {
    const src = selectionOnly ? rows.filter((r) => checked[r.id]) : filtered;
    if (src.length === 0) return alert("Geen facturen om te exporteren.");
    const header = ["nummer", "datum", "status", "bedrag_eur"];
    const lines = src.map((r) =>
      [r.number, r.date, r.status, r.amount.toFixed(2).replace(".", ",")].join(";")
    );
    const blob = new Blob(["\uFEFF" + header.join(";") + "\n" + lines.join("\n")], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = selectionOnly ? "facturen-selectie.csv" : "facturen.csv";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  async function downloadPDF(id, number) {
    try {
      const res = await fetch(`${API_BASE}/api/invoices/${id}/pdf`, {
        headers: { ...authHeaders() },
      });
      if (!res.ok) {
        const t = await res.text().catch(() => "");
        throw new Error(`PDF download mislukt (${res.status}): ${t?.slice(0, 140)}`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${number || `invoice-${id}`}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      alert(e?.message || "Kon PDF niet downloaden. Controleer of de backend route bestaat.");
    }
  }

  // Optioneel: status updaten (werkt alleen als backend route bestaat)
  async function markPaid(id) {
    try {
      await apiFetch(`/api/invoices/${id}/status`, {
        method: "POST",
        headers: { ...authHeaders() },
        body: JSON.stringify({ status: "paid" }),
      });
      setRows((prev) => prev.map((r) => (r.id === id ? { ...r, status: "paid" } : r)));
    } catch (e) {
      alert("Kon status niet updaten (heeft backend route nodig: POST /api/invoices/:id/status).");
    }
  }

  /* --- UI helpers --- */
  const thSort = (label, key, alignRight = false) => {
    const is = sort.key === key;
    const dir = is ? sort.dir : undefined;
    return (
      <th
        onClick={() =>
          setSort((s) =>
            s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }
          )
        }
        style={{
          cursor: "pointer",
          userSelect: "none",
          textAlign: alignRight ? "right" : "left",
        }}
        title="Klik om te sorteren"
      >
        <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
          {label}
          {is ? <span style={{ fontSize: 12, opacity: 0.75 }}>{dir === "asc" ? "▲" : "▼"}</span> : <span style={{ opacity: 0.25 }}>↕</span>}
        </span>
      </th>
    );
  };

  /* --- reset pagina wanneer filters veranderen --- */
  useEffect(() => { setPage(1); }, [from, to, status, q]);

  return (
    <div className="inv">
      <style>{`
        .inv { max-width: 1100px; margin: 0 auto; }
        .card { background:#fff; border:1px solid #e5e7eb; border-radius:16px; box-shadow:0 8px 24px rgba(2,6,23,.06); }
        .h { padding:20px; }
        .title { margin:0; font-size:24px; font-weight:800; color:#0b3654; }
        .sub { color:#6b7280; font-size:13px; margin-top:2px; }

        .toolbar { display:flex; flex-wrap:wrap; gap:10px; align-items:end; margin-top:14px; }
        .field { display:flex; flex-direction:column; gap:6px; }
        .label { font-size:12px; color:#475569; }
        .input, .select, .btn { height:40px; border-radius:12px; border:1px solid #e5e7eb; background:#fff; padding:0 12px; }
        .btn { font-weight:700; cursor:pointer; }
        .btn-ghost { background:#f8fafc; }
        .btn-primary { background: var(--brand-primary,#0b3654); color:#fff; }

        .presets { display:flex; gap:8px; flex-wrap:wrap; }
        .chip { padding:6px 10px; border:1px solid #e5e7eb; border-radius:999px; font-size:12px; background:#fff; cursor:pointer; }
        .chip.active { border-color:#0b3654; color:#0b3654; font-weight:700; }

        .kpis { display:grid; grid-template-columns:repeat(4,1fr); gap:12px; margin-top:14px; }
        .kpi { border:1px solid #e5e7eb; border-radius:14px; padding:16px; background:#fff; }
        .kpi .label { font-size:12px; color:#64748b; }
        .kpi .value { font-size:22px; font-weight:800; margin-top:4px; color:#0b3654; }

        .tablewrap { overflow:auto; border:1px solid #e5e7eb; border-radius:12px; }
        table { width:100%; border-collapse:separate; border-spacing:0; }
        thead th { position:sticky; top:0; background:#f8fafc; color:#475569; text-align:left; padding:12px 14px; border-bottom:1px solid #e5e7eb; font-size:13px; }
        tbody td { padding:12px 14px; border-bottom:1px solid #f1f5f9; font-size:14px; }
        tbody tr:nth-child(even) { background:#fcfcfd; }
        .num { text-align:right; white-space:nowrap; }
        .badge { display:inline-flex; align-items:center; gap:6px; padding:4px 10px; border-radius:999px; font-size:12px; font-weight:700; }
        .b-open { background:#fffbeb; color:#b45309; border:1px solid #fbbf24; }
        .b-paid { background:#ecfdf5; color:#059669; border:1px solid #34d399; }
        .b-overdue { background:#fef2f2; color:#b91c1c; border:1px solid #fca5a5; }

        .foot { display:flex; justify-content:space-between; align-items:center; gap:10px; margin-top:12px; }
        .pager { display:flex; gap:8px; }
        .pager button { min-width:38px; }

        .alert { margin-top:12px; padding:12px; border-radius:12px; background:#fef2f2; color:#991b1b; border:1px solid #fecaca; }

        @media (max-width: 900px) {
          .kpis { grid-template-columns:1fr 1fr; }
          .inv { max-width: 100%; padding: 0 8px; }
          .hide-sm { display:none; }
        }
      `}</style>

      {/* header + filters */}
      <div className="card h">
        <h2 className="title">Facturen</h2>
        <div className="sub">Factuuroverzicht en downloads.</div>

        {error && <div className="alert">Fout bij laden: {error}</div>}

        <div className="toolbar">
          <div className="field">
            <label className="label">Van</label>
            <input className="input" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="field">
            <label className="label">Tot</label>
            <input className="input" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <div className="field">
            <label className="label">Status</label>
            <select className="select" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="all">Alle</option>
              <option value="open">Open</option>
              <option value="paid">Betaald</option>
              <option value="overdue">Achterstallig</option>
            </select>
          </div>
          <div className="field" style={{ minWidth: 220 }}>
            <label className="label">Zoeken op nummer</label>
            <input className="input" placeholder="Bijv. INV-00123" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>

          <div className="field">
            <label className="label">Snelle periode</label>
            <div className="presets">
              <button
                className={`chip ${from === startOfMonth() && to === endOfMonth() ? "active" : ""}`}
                onClick={() => { setFrom(startOfMonth()); setTo(endOfMonth()); }}
              >
                Deze maand
              </button>
              <button
                className="chip"
                onClick={() => {
                  const d = new Date();
                  const from3 = startOfMonth(new Date(d.getFullYear(), d.getMonth() - 2, 1));
                  setFrom(from3);
                  setTo(endOfMonth());
                }}
              >
                Laatste 3 mnd
              </button>
              <button
                className="chip"
                onClick={() => {
                  const d = new Date();
                  setFrom(`${d.getFullYear()}-01-01`);
                  setTo(endOfMonth(d));
                }}
              >
                YTD
              </button>
              <button
                className="chip"
                onClick={() => { setFrom(""); setTo(""); }}
                title="Geen datumfilter"
              >
                Alles
              </button>
            </div>
          </div>

          <button className="btn btn-primary" onClick={() => exportCSV(false)}>Exporteer CSV</button>
          <button className="btn btn-ghost" onClick={() => exportCSV(true)}>Exporteer selectie</button>
        </div>

        {/* KPI's */}
        <div className="kpis">
          <div className="kpi"><div className="label">Aantal</div><div className="value">{kpis.count}</div></div>
          <div className="kpi"><div className="label">Totaal</div><div className="value">{euro(kpis.total)}</div></div>
          <div className="kpi"><div className="label">Openstaand</div><div className="value">{euro(kpis.open)}</div></div>
          <div className="kpi"><div className="label">Betaald</div><div className="value">{euro(kpis.paid)}</div></div>
        </div>
      </div>

      {/* tabel */}
      <div className="card h" style={{ marginTop: 14 }}>
        <div className="tablewrap">
          <table>
            <thead>
              <tr>
                <th style={{ width: 44 }}>
                  <input
                    type="checkbox"
                    checked={pageRows.length > 0 && allOnPageChecked}
                    onChange={(e) => toggleAllOnPage(e.target.checked)}
                    title="Selecteer alles op deze pagina"
                  />
                </th>
                {thSort("Nummer", "number")}
                {thSort("Datum", "date")}
                {thSort("Status", "status")}
                {thSort("Bedrag", "amount", true)}
                <th className="num">Acties</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} style={{ padding: 18, color: "#6b7280" }}>Laden…</td></tr>
              ) : pageRows.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: 18, color: "#6b7280" }}>
                    Geen facturen in deze periode.
                  </td>
                </tr>
              ) : (
                pageRows.map((r) => {
                  const badgeClass =
                    r.status === "paid" ? "badge b-paid" :
                    r.status === "overdue" ? "badge b-overdue" : "badge b-open";
                  const isChecked = !!checked[r.id];
                  return (
                    <tr key={r.id}>
                      <td>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => setChecked({ ...checked, [r.id]: e.target.checked })}
                          title={`Selecteer ${r.number}`}
                        />
                      </td>
                      <td>{r.number}</td>
                      <td className="hide-sm">{r.date}</td>
                      <td><span className={badgeClass}>
                        {r.status === "paid" ? "Betaald" : r.status === "overdue" ? "Achterstallig" : "Open"}
                      </span></td>
                      <td className="num">{euro(r.amount)}</td>
                      <td className="num" style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                        <button className="btn btn-ghost" onClick={() => downloadPDF(r.id, r.number)}>
                          Download PDF
                        </button>
                        {r.status !== "paid" && (
                          <button className="btn btn-ghost" onClick={() => markPaid(r.id)}>
                            Markeer als betaald
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* paginate + selectie-info */}
        <div className="foot">
          <div style={{ color: "#64748b", fontSize: 13, display: "flex", alignItems: "center", gap: 8 }}>
            Geselecteerd: {Object.values(checked).filter(Boolean).length}
            <button className="btn btn-ghost" onClick={() => toggleAllFiltered(true)}>Alles selecteren</button>
            <button className="btn btn-ghost" onClick={() => toggleAllFiltered(false)}>Alles deselecteren</button>
          </div>
          <div className="pager">
            <button className="btn" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>‹</button>
            <div style={{ display: "grid", placeItems: "center", minWidth: 90 }}>
              Pagina {page} / {pages}
            </div>
            <button className="btn" disabled={page >= pages} onClick={() => setPage((p) => Math.min(pages, p + 1))}>›</button>
          </div>
        </div>
      </div>
    </div>
  );
}
