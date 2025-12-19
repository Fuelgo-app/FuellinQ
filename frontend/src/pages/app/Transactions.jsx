// src/pages/Transactions.jsx
import React, { useEffect, useMemo, useState } from "react";
import { API_BASE, apiFetch } from "@/api/base.js";

/* -------------------- Auth header -------------------- */
const getToken = () => localStorage.getItem("token") || "";
const authHeader = () => ({ Authorization: `Bearer ${getToken()}` });

/* -------------------- Helpers -------------------- */
const euro = (n) =>
  (typeof n === "number" ? n : Number(n || 0)).toLocaleString("nl-NL", {
    style: "currency",
    currency: "EUR",
  });

const startOfMonth = (d = new Date()) =>
  new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
const endOfMonth = (d = new Date()) =>
  new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().slice(0, 10);
const withinRange = (iso, from, to) =>
  !iso ? false : (!from || iso >= from) && (!to || iso <= to);

function computeTotals(rows) {
  const acc = {
    all: { incl: 0, btw: 0, excl: 0 },
    fuel: { incl: 0, btw: 0, excl: 0 },
    shop: { incl: 0, btw: 0, excl: 0 },
  };
  const add = (k, r) => {
    acc[k].incl += Number(r.amount_incl ?? r.bedrag_incl ?? 0);
    acc[k].btw += Number(r.vat ?? r.btw ?? 0);
    acc[k].excl += Number(r.amount_excl ?? r.bedrag_excl ?? 0);
  };
  for (const r of rows) {
    const bucket = r.category === "fuel" ? "fuel" : r.category === "shop" ? "shop" : null;
    if (bucket) add(bucket, r);
    add("all", r);
  }
  const r2 = (n) => Math.round(n * 100) / 100;
  for (const k of ["all", "fuel", "shop"]) {
    acc[k].incl = r2(acc[k].incl);
    acc[k].btw = r2(acc[k].btw);
    acc[k].excl = r2(acc[k].excl);
  }
  return acc;
}

/* ===================================================== */

export default function TransactionsPage() {
  const [list, setList] = useState([]);
  const [from, setFrom] = useState(startOfMonth());
  const [to, setTo] = useState(endOfMonth());
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("all"); // all | fuel | shop

  /* -------------------- Load transactions -------------------- */
  async function load() {
    setLoading(true);
    try {
      const data = await apiFetch("/api/transactions/list", {
        headers: { ...authHeader() },
      });
      setList(Array.isArray(data?.items) ? data.items : []);
    } catch (e) {
      console.error(e);
      alert("Transacties ophalen mislukt.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load().catch(console.error);
  }, []);

  /* -------------------- Filters & zoekfunctie -------------------- */
  const filtered = useMemo(() => {
    const term = (q || "").trim().toLowerCase();
    return (list || [])
      .filter((r) => withinRange(r.date || r.datum, from, to))
      .filter((r) => (cat === "all" ? true : r.category === cat))
      .filter((r) =>
        !term
          ? true
          : [
              r.station,
              r.description,
              r.omschrijving,
              r.category,
              r.date,
              r.datum,
            ]
              .filter(Boolean)
              .some((v) => String(v).toLowerCase().includes(term))
      )
      .sort((a, b) => {
        const da = (a.date || a.datum) ?? "";
        const db = (b.date || b.datum) ?? "";
        return db.localeCompare(da); // nieuw → oud
      });
  }, [list, from, to, q, cat]);

  const totals = useMemo(() => computeTotals(filtered), [filtered]);
  const { fuel, shop, all } = totals;

  /* -------------------- Export / Download -------------------- */
  async function download(kind) {
    try {
      setDownloading(true);
      const qs = new URLSearchParams();
      if (from) qs.set("from", from);
      if (to) qs.set("to", to);
      if (cat !== "all") qs.set("category", cat);
      if (q) qs.set("q", q);

      const path =
        kind === "csv"
          ? "/api/transactions/export.csv"
          : "/api/transactions/export.xlsx";

      const r = await fetch(`${API_BASE}${path}?${qs.toString()}`, {
        headers: { ...authHeader() },
      });
      if (!r.ok) throw new Error(`Download failed (${r.status})`);

      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const range =
        (from || to) ? `_${from || "start"}-${to || "einde"}` : "";
      a.href = url;
      a.download =
        kind === "csv"
          ? `fuellinq-transacties${range}.csv`
          : `fuellinq-transacties${range}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
      alert("Download mislukt.");
    } finally {
      setDownloading(false);
    }
  }

  /* -------------------- Mail export -------------------- */
  async function mailExport() {
    try {
      setSending(true);
      await apiFetch("/api/transactions/email", {
        method: "POST",
        headers: { ...authHeader() },
        body: JSON.stringify({
          email_to: email || undefined,
          date_from: from,
          date_to: to,
          category: cat !== "all" ? cat : undefined,
          q: q || undefined,
        }),
      });
      alert("Export is gemaild ✅");
    } catch (e) {
      console.error(e);
      alert("Mailen mislukt. Check SMTP.");
    } finally {
      setSending(false);
    }
  }

  const subtitleCount =
    loading
      ? "Bezig met laden…"
      : `${filtered.length} resultaat${filtered.length === 1 ? "" : "en"}`;

  /* -------------------- UI -------------------- */
  return (
    <div className="trans-page">
      <style>{`
        .trans-page { max-width: 1080px; margin: 0 auto; }
        .trans-card { background:#fff; border:1px solid #e5e7eb; border-radius:16px; box-shadow:0 8px 24px rgba(2,6,23,.06); padding:16px; }
        .trans-title { font-size:22px; font-weight:800; margin:0 0 4px; color:var(--brand-primary, #0b3654); }
        .trans-sub { color:#6b7280; font-size:13px; margin-bottom:14px; }
        .toolbar { display:flex; flex-wrap:wrap; gap:8px; align-items:end; margin-bottom:12px; }
        .field { display:flex; flex-direction:column; gap:6px; }
        .label { font-size:12px; color:#475569; }
        .input, .btn { height:36px; border-radius:10px; border:1px solid #e5e7eb; background:#fff; padding:0 12px; }
        .input { min-width: 160px; }
        .btn { font-weight:700; cursor:pointer; }
        .btn:disabled { opacity:.6; cursor:not-allowed; }
        .btn-primary { background: var(--brand-primary, #0b3654); color:#fff; border-color: transparent; }
        .btn-outline { background:#fff; color:#111827; }
        .btn-ghost { background:#f8fafc; }
        .pill { font-size:12px; padding:2px 8px; border-radius:999px; background:#eef2ff; color:#3730a3; }
        .tabs { display:flex; gap:6px; background:#f8fafc; padding:6px; border-radius:10px; border:1px solid #e5e7eb; }
        .tab { height:30px; padding:0 10px; border-radius:8px; display:flex; align-items:center; font-size:13px; cursor:pointer; border:1px solid transparent; }
        .tab.active { background:#fff; border-color:#e5e7eb; }
        .table-wrap { overflow:auto; border:1px solid #e5e7eb; border-radius:12px; }
        table { width:100%; border-collapse:separate; border-spacing:0; font-size:14px; }
        thead th { position:sticky; top:0; background:#f8fafc; color:#475569; text-align:left; padding:10px 12px; border-bottom:1px solid #e5e7eb; }
        tbody td { padding:10px 12px; border-bottom:1px solid #f1f5f9; }
        tbody tr:nth-child(even) { background:#fcfcfd; }
        td.num, th.num { text-align:right; white-space:nowrap; }
        .kpi-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:12px; margin-top:14px; }
        .kpi { border:1px solid #e5e7eb; border-radius:14px; padding:14px; background:#fff; }
        .kpi h4 { margin:0 0 6px; font-size:14px; color:var(--brand-primary, #0b3654); }
        .kpi .row { display:flex; justify-content:space-between; margin-top:4px; }
        .kpi.total { background:#f8fafc; }
        .mailbar { display:flex; flex-wrap:wrap; gap:8px; align-items:center; margin-top:14px; }
        .mailbar .input { width:280px; }
        .search { min-width: 220px; }
        @media (max-width: 900px) {
          .kpi-grid { grid-template-columns:1fr; }
          thead th:nth-child(2), tbody td:nth-child(2) { min-width:160px; }
          thead th:nth-child(3), tbody td:nth-child(3) { min-width:220px; }
        }
      `}</style>

      <div className="trans-card">
        <h2 className="trans-title">Transacties</h2>
        <div className="trans-sub">
          Filter op periode en exporteer naar CSV/Excel of mail naar jezelf/boekhouder.
          <span style={{ marginLeft: 8, color: "#334155" }}>• {subtitleCount}</span>
        </div>

        {/* Toolbar */}
        <div className="toolbar">
          <div className="field">
            <label className="label">Van</label>
            <input className="input" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="field">
            <label className="label">Tot</label>
            <input className="input" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>

          <div className="field" style={{ minWidth: 220 }}>
            <label className="label">Zoeken</label>
            <input
              className="input search"
              type="search"
              placeholder="Station, omschrijving…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>

          <div className="field">
            <label className="label">Categorie</label>
            <div className="tabs">
              {[
                { k: "all", label: "Alle" },
                { k: "fuel", label: "Brandstof" },
                { k: "shop", label: "Shop" },
              ].map((t) => (
                <button
                  key={t.k}
                  className={`tab ${cat === t.k ? "active" : ""}`}
                  onClick={() => setCat(t.k)}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <button className="btn btn-ghost" onClick={load} disabled={loading}>
            {loading ? "Laden…" : "Vernieuwen"}
          </button>

          <div style={{ flex: 1 }} />

          <button className="btn btn-outline" onClick={() => download("csv")} disabled={downloading}>
            {downloading ? "Export…" : "Exporteer CSV"}
          </button>
          <button className="btn btn-primary" onClick={() => download("xlsx")} disabled={downloading}>
            {downloading ? "Export…" : "Exporteer Excel"}
          </button>
        </div>

        {/* Table */}
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Datum</th>
                <th>Station</th>
                <th>Omschrijving</th>
                <th>Categorie</th>
                <th className="num">BTW%</th>
                <th className="num">Incl.</th>
                <th className="num">BTW</th>
                <th className="num">Excl.</th>
              </tr>
            </thead>
            <tbody>
              {(!loading && filtered.length === 0) ? (
                <tr>
                  <td colSpan={8} style={{ padding: 16, color: "#6b7280" }}>
                    Geen transacties in deze selectie.
                  </td>
                </tr>
              ) : (
                filtered.map((r, i) => (
                  <tr key={r.id ?? `${(r.date || r.datum) ?? "d"}-${i}`}>
                    <td>{r.date || r.datum}</td>
                    <td>{r.station}</td>
                    <td>{r.description || r.omschrijving}</td>
                    <td>
                      <span className="pill">
                        {r.category === "fuel"
                          ? "Brandstof"
                          : r.category === "shop"
                          ? "Shop"
                          : r.category || "-"}
                      </span>
                    </td>
                    <td className="num">
                      {r.vat_rate != null && r.vat_rate !== "" ? `${r.vat_rate}%` : ""}
                    </td>
                    <td className="num">{euro(r.amount_incl ?? r.bedrag_incl)}</td>
                    <td className="num">{euro(r.vat ?? r.btw)}</td>
                    <td className="num">{euro(r.amount_excl ?? r.bedrag_excl)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* KPI cards */}
        <div className="kpi-grid">
          <div className="kpi">
            <h4>Brandstof</h4>
            <div className="row"><span>Incl.</span><strong>{euro(fuel.incl)}</strong></div>
            <div className="row"><span>BTW</span><strong>{euro(fuel.btw)}</strong></div>
            <div className="row"><span>Excl.</span><strong>{euro(fuel.excl || fuel.incl - fuel.btw)}</strong></div>
          </div>
          <div className="kpi">
            <h4>Shop</h4>
            <div className="row"><span>Incl.</span><strong>{euro(shop.incl)}</strong></div>
            <div className="row"><span>BTW</span><strong>{euro(shop.btw)}</strong></div>
            <div className="row"><span>Excl.</span><strong>{euro(shop.excl || shop.incl - shop.btw)}</strong></div>
          </div>
          <div className="kpi total">
            <h4>Totaal</h4>
            <div className="row"><span>Incl.</span><strong>{euro(all.incl)}</strong></div>
            <div className="row"><span>BTW</span><strong>{euro(all.btw)}</strong></div>
            <div className="row"><span>Excl.</span><strong>{euro(all.excl || all.incl - all.btw)}</strong></div>
          </div>
        </div>

        {/* Mail export */}
        <div className="mailbar">
          <input
            type="email"
            className="input"
            placeholder="Stuur naar e-mail (leeg = jouw eigen e-mail)"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <button className="btn btn-outline" onClick={mailExport} disabled={sending}>
            {sending ? "Versturen…" : "Mail export"}
          </button>
        </div>
      </div>
    </div>
  );
}
