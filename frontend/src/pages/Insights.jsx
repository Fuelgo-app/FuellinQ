// src/pages/Insights.jsx
import React, { useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/api/base.js";

/* -------------------- helpers -------------------- */
const euro = (n) =>
  (typeof n === "number" ? n : Number(n || 0)).toLocaleString("nl-NL", {
    style: "currency",
    currency: "EUR",
  });

// Gebruik 12:00 om TZ-drift te voorkomen
const toDateSafe = (iso) => new Date(`${iso}T12:00:00`);

const fmtMonth = (iso) => {
  if (!iso) return "";
  const d = toDateSafe(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};
const startOfMonth = (d = new Date()) =>
  new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
const endOfMonth = (d = new Date()) =>
  new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().slice(0, 10);
const withinRange = (iso, from, to) =>
  !!iso && (!from || iso >= from) && (!to || iso <= to);
const weekdayIdx = (iso) => {
  const d = toDateSafe(iso);
  return (d.getDay() + 6) % 7; // ma=0..zo=6
};

const authHeaders = () => {
  const token = localStorage.getItem("token") || "";
  return token ? { Authorization: `Bearer ${token}` } : {};
};

/* -------------------- tiny SVG charts (grotere hoogtes) -------------------- */
function LineChart({ data, height = 220, stroke = "#0b3654" }) {
  const safe = Array.isArray(data) ? data : [];
  const width = Math.max(520, 36 * Math.max(1, safe.length));
  const pad = 28;

  const xs = safe.map((_, i) => pad + (i * (width - pad * 2)) / Math.max(1, safe.length - 1));
  const ysMax = Math.max(1, ...safe.map((d) => Number(d.y) || 0));
  const ys = safe.map((d) => pad + (height - pad * 2) * (1 - (Number(d.y) || 0) / ysMax));

  const dAttr = safe.length ? `M ${xs.map((x, i) => `${x},${ys[i]}`).join(" L ")}` : "";
  const areaAttr = safe.length
    ? `M ${xs[0]},${height - pad} ` + xs.map((x, i) => `L ${x},${ys[i]}`).join(" ") + ` L ${xs[xs.length - 1]},${height - pad} Z`
    : "";

  return (
    <div style={{ overflow: "auto" }}>
      <svg width={width} height={height}>
        <rect x="0" y="0" width={width} height={height} fill="#fff" />
        {[0.25, 0.5, 0.75].map((g, i) => (
          <line
            key={i}
            x1={pad}
            x2={width - pad}
            y1={pad + (height - pad * 2) * g}
            y2={pad + (height - pad * 2) * g}
            stroke="#e5e7eb"
            strokeDasharray="4 4"
          />
        ))}
        {safe.length > 0 && <path d={areaAttr} fill="#e6eef6" opacity="0.9" />}
        {safe.length > 0 && (
          <path
            d={dAttr}
            stroke={stroke}
            fill="none"
            strokeWidth="2.5"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        )}
      </svg>
    </div>
  );
}

function StackedBars({ months, series, height = 240 }) {
  const ms = Array.isArray(months) ? months : [];
  const s = series || { fuel: [], shop: [] };

  const width = Math.max(560, ms.length * 80);
  const pad = 32;
  const barW = 40;
  const gap = 40;
  const maxY = Math.max(
    1,
    ...ms.map((_, i) => (Number(s.fuel?.[i] || 0) + Number(s.shop?.[i] || 0)))
  );

  return (
    <div style={{ overflow: "auto" }}>
      <svg width={width} height={height}>
        <rect x="0" y="0" width={width} height={height} fill="#fff" />
        {[0.25, 0.5, 0.75].map((g, i) => (
          <line
            key={i}
            x1={pad}
            x2={width - pad}
            y1={pad + (height - pad * 2) * g}
            y2={pad + (height - pad * 2) * g}
            stroke="#e5e7eb"
            strokeDasharray="4 4"
          />
        ))}
        {ms.map((m, i) => {
          const x = pad + i * (barW + gap);
          const fuel = Number(s.fuel?.[i] || 0),
            shop = Number(s.shop?.[i] || 0);
          const total = fuel + shop;
          const hFuel = (height - pad * 2) * (fuel / maxY);
          const hShop = (height - pad * 2) * (shop / maxY);
          const yFuel = height - pad - hFuel;
          const yShop = yFuel - hShop;
          return (
            <g key={m || i}>
              <rect x={x} y={yFuel} width={barW} height={hFuel} fill="#0b3654" rx="8" />
              <rect x={x} y={yShop} width={barW} height={hShop} fill="#94a3b8" rx="8" />
              <text x={x + barW / 2} y={height - 8} textAnchor="middle" fontSize="12" fill="#475569">
                {(m || "").slice(5)}
              </text>
              <title>{`${m}\nFuel: ${euro(fuel)}\nShop: ${euro(shop)}\nTotaal: ${euro(total)}`}</title>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/* ---------- Donut (geen dotje bij 0%, schaalt mee) ---------- */
function Donut({ value = 0, label = "Brandstof", color = "var(--brand-primary,#0b3654)" }) {
  const size = 220;
  const r = size / 2 - 12;
  const c = size / 2;
  const circ = 2 * Math.PI * r;

  const v = Math.max(0, Math.min(1, Number(value) || 0));
  const dash = circ * v;
  const showArc = dash > 0.5;

  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      style={{ width: "100%", height: "auto", maxWidth: 220, display: "block" }}
      aria-label={`${label} ${Math.round(v * 100)}%`}
    >
      <circle cx={c} cy={c} r={r} stroke="#e5e7eb" strokeWidth="14" fill="none" />
      {showArc && (
        <circle
          cx={c}
          cy={c}
          r={r}
          stroke={color}
          strokeWidth="14"
          fill="none"
          strokeDasharray={`${dash} ${circ - dash}`}
          transform={`rotate(-90 ${c} ${c})`}
          strokeLinecap="round"
        />
      )}
      <text x={c} y={c - 2} textAnchor="middle" fontSize="20" fontWeight="800" fill="#0b3654">
        {(v * 100).toFixed(0)}%
      </text>
      <text x={c} y={c + 22} textAnchor="middle" fontSize="12" fill="#64748b">
        {label}
      </text>
    </svg>
  );
}

function Progress({ value }) {
  const pct = Math.max(0, Math.min(100, Number(value) || 0));
  return (
    <div style={{ height: 14, borderRadius: 999, background: "#e5e7eb", overflow: "hidden" }}>
      <div
        style={{
          width: `${pct}%`,
          height: "100%",
          background: "var(--brand-primary,#0b3654)",
        }}
      />
    </div>
  );
}

/* -------------------- page -------------------- */
export default function InsightsPage() {
  const [list, setList] = useState([]);
  const [from, setFrom] = useState(startOfMonth(new Date(new Date().getFullYear(), new Date().getMonth() - 5, 1))); // laatste 6 mnd
  const [to, setTo] = useState(endOfMonth());
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  // Budget (instelbaar)
  const [fuelBudget, setFuelBudget] = useState(500); // €/maand
  const [shopBudget, setShopBudget] = useState(120); // €/maand

  useEffect(() => {
    (async () => {
      setLoading(true);
      setErr("");
      try {
        const data = await apiFetch("/api/transactions/list", { headers: authHeaders() });
        setList(Array.isArray(data?.items) ? data.items : []);
      } catch (e) {
        console.error(e);
        setErr(e?.message || "Kon transacties niet laden.");
        setList([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const rows = useMemo(
    () => (Array.isArray(list) ? list : []).filter((r) => withinRange(r?.date || r?.datum, from, to)),
    [list, from, to]
  );

  // KPI’s
  const totals = useMemo(() => {
    const acc = { all: { incl: 0, btw: 0, excl: 0 }, fuel: { incl: 0 }, shop: { incl: 0 }, count: 0 };
    for (const r of rows) {
      const incl = Number(r?.amount_incl ?? r?.bedrag_incl ?? 0);
      const vat = Number(r?.vat ?? r?.btw ?? 0);
      const excl = Number(r?.amount_excl ?? r?.bedrag_excl ?? incl - vat);
      acc.all.incl += incl;
      acc.all.btw += vat;
      acc.all.excl += excl;
      acc.count++;
      if (r?.category === "fuel") acc.fuel.incl += incl;
      if (r?.category === "shop") acc.shop.incl += incl;
    }
    const r2 = (n) => Math.round(n * 100) / 100;
    return {
      ...acc,
      all: { incl: r2(acc.all.incl), btw: r2(acc.all.btw), excl: r2(acc.all.excl) },
      fuel: { incl: r2(acc.fuel.incl) },
      shop: { incl: r2(acc.shop.incl) },
    };
  }, [rows]);

  const avgPerTx = totals.count ? totals.all.incl / totals.count : 0;
  const fuelShare = totals.all.incl ? totals.fuel.incl / totals.all.incl : 0;
  const shopShare = totals.all.incl ? totals.shop.incl / totals.all.incl : 0;

  // Lijn: uitgaven per dag
  const daily = useMemo(() => {
    const map = new Map();
    for (const r of rows) {
      const d = r?.date || r?.datum;
      if (!d) continue;
      map.set(d, (map.get(d) || 0) + Number(r?.amount_incl ?? r?.bedrag_incl ?? 0));
    }
    return [...map.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1)).map(([x, y]) => ({ x, y }));
  }, [rows]);

  // Bars: per maand fuel/shop
  const monthKeys = useMemo(() => {
    const set = new Set();
    for (const r of rows) {
      const m = fmtMonth(r?.date || r?.datum);
      if (m) set.add(m);
    }
    return [...set].sort();
  }, [rows]);

  const byMonth = useMemo(() => {
    const fuel = monthKeys.map(() => 0),
      shop = monthKeys.map(() => 0);
    const idx = (m) => monthKeys.indexOf(m);
    for (const r of rows) {
      const m = fmtMonth(r?.date || r?.datum);
      if (!m) continue;
      const i = idx(m);
      if (i < 0) continue;
      const val = Number(r?.amount_incl ?? r?.bedrag_incl ?? 0);
      if (r?.category === "fuel") fuel[i] += val;
      else if (r?.category === "shop") shop[i] += val;
    }
    return { fuel, shop };
  }, [rows, monthKeys]);

  // Top stations
  const topStations = useMemo(() => {
    const map = new Map();
    for (const r of rows) {
      const k = r?.station || "—";
      map.set(k, (map.get(k) || 0) + Number(r?.amount_incl ?? r?.bedrag_incl ?? 0));
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [rows]);

  // BTW per tarief
  const vatByRate = useMemo(() => {
    const buckets = { "21": 0, "9": 0, "0": 0, other: 0 };
    const inclByRate = { "21": 0, "9": 0, "0": 0, other: 0 };
    for (const r of rows) {
      const rate = Number(r?.vat_rate ?? r?.vatRate ?? 0);
      const vat = Number(r?.vat ?? r?.btw ?? 0);
      const incl = Number(r?.amount_incl ?? r?.bedrag_incl ?? 0);
      const key = rate === 21 ? "21" : rate === 9 ? "9" : rate === 0 ? "0" : "other";
      buckets[key] += vat;
      inclByRate[key] += incl;
    }
    const r2 = (n) => Math.round(n * 100) / 100;
    for (const k of Object.keys(buckets)) {
      buckets[k] = r2(buckets[k]);
      inclByRate[k] = r2(inclByRate[k]);
    }
    const totalVat = Object.values(buckets).reduce((a, b) => a + b, 0) || 1;
    return { buckets, inclByRate, totalVat };
  }, [rows]);

  // Heatmap per weekdag (7 vakjes)
  const heatWeek = useMemo(() => {
    const arr = Array(7).fill(0);
    for (const r of rows) {
      const d = r?.date || r?.datum;
      if (!d) continue;
      const i = weekdayIdx(d);
      arr[i] += Number(r?.amount_incl ?? r?.bedrag_incl ?? 0);
    }
    const max = Math.max(1, ...arr);
    return { arr, max };
  }, [rows]);

  // Budget: alleen huidige maand
  const thisMonthFrom = startOfMonth();
  const thisMonthTo = endOfMonth();
  const monthFuel = useMemo(
    () =>
      rows
        .filter((r) => r?.category === "fuel" && withinRange(r?.date || r?.datum, thisMonthFrom, thisMonthTo))
        .reduce((s, r) => s + Number(r?.amount_incl ?? r?.bedrag_incl ?? 0), 0),
    [rows]
  );
  const monthShop = useMemo(
    () =>
      rows
        .filter((r) => r?.category === "shop" && withinRange(r?.date || r?.datum, thisMonthFrom, thisMonthTo))
        .reduce((s, r) => s + Number(r?.amount_incl ?? r?.bedrag_incl ?? 0), 0),
    [rows]
  );

  const fuelPct = fuelBudget ? Math.min(100, Math.round((monthFuel / fuelBudget) * 100)) : 0;
  const shopPct = shopBudget ? Math.min(100, Math.round((monthShop / shopBudget) * 100)) : 0;

  return (
    <div className="ins">
      <style>{`
        .ins { max-width:1400px; margin:0 auto; }
        .card { background:#fff; border:1px solid #e5e7eb; border-radius:16px; box-shadow:0 8px 24px rgba(2,6,23,.06); }
        .h { padding:20px; }
        .title { margin:0; font-size:24px; font-weight:800; color:#0b3654; }
        .sub { color:#6b7280; font-size:13px; margin-top:2px; }

        .toolbar { display:flex; flex-wrap:wrap; gap:10px; align-items:end; margin-top:14px; }
        .field { display:flex; flex-direction:column; gap:6px; }
        .label { font-size:12px; color:#475569; }
        .input, .btn { height:40px; border-radius:12px; border:1px solid #e5e7eb; background:#fff; padding:0 12px; }
        .btn { font-weight:700; cursor:pointer; }
        .btn-ghost { background:#f8fafc; }
        .grid { display:grid; grid-template-columns:3fr 2fr; gap:18px; margin-top:18px; }
        .kpis { display:grid; grid-template-columns:repeat(5,1fr); gap:12px; margin-top:14px; }
        .kpi { border:1px solid #e5e7eb; border-radius:14px; padding:16px; background:#fff; }
        .kpi .label { font-size:12px; color:#64748b; }
        .kpi .value { font-size:22px; font-weight:800; margin-top:4px; color:#0b3654; }
        .panel { display:grid; grid-template-columns:1fr; gap:18px; }
        .tablewrap { overflow:auto; border:1px solid #e5e7eb; border-radius:12px; }
        table { width:100%; border-collapse:separate; border-spacing:0; }
        thead th { position:sticky; top:0; background:#f8fafc; color:#475569; text-align:left; padding:12px 14px; border-bottom:1px solid #e5e7eb; font-size:13px; }
        tbody td { padding:12px 14px; border-bottom:1px solid #f1f5f9; font-size:14px; }
        tbody tr:nth-child(even) { background:#fcfcfd; }
        .num { text-align:right; white-space:nowrap; }

        .two { display:grid; grid-template-columns:1.2fr 1fr; gap:18px; }
        .vat-table td, .vat-table th { padding:8px 10px; }
        .heat { display:grid; grid-template-columns:repeat(7, 1fr); gap:10px; margin-top:12px; }
        .dot { height:56px; border-radius:12px; background:#e5e7eb; display:grid; place-items:center; font-size:12px; color:#0f172a; }
        .warn { color:#b45309; background:#fffbeb; border:1px solid #fbbf24; border-radius:12px; padding:10px 12px; }

        /* responsive donut rij */
        .donut-row {
          display:grid;
          grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
          gap:24px;
          align-items:center;
          justify-items:center;
          width:100%;
        }

        @media (max-width: 1200px) {
          .kpis { grid-template-columns:repeat(4,1fr); }
          .grid { grid-template-columns:1fr; }
          .two { grid-template-columns:1fr; }
        }
        @media (max-width: 700px) {
          .kpis { grid-template-columns:1fr 1fr; }
          .dot { height:48px; }
        }
      `}</style>

      {/* Header + filters */}
      <div className="card h">
        <h2 className="title">Inzichten</h2>
        <div className="sub">Grafieken en analyses over je transacties.</div>

        <div className="toolbar">
          <div className="field">
            <label className="label">Van</label>
            <input className="input" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="field">
            <label className="label">Tot</label>
            <input className="input" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <button className="btn btn-ghost" onClick={() => { /* client-side filters */ }}>
            Toepassen
          </button>
        </div>

        {/* KPI's */}
        <div className="kpis">
          <div className="kpi">
            <div className="label">Totaal incl.</div>
            <div className="value">{euro(totals.all.incl)}</div>
          </div>
          <div className="kpi">
            <div className="label">Totaal BTW</div>
            <div className="value">{euro(totals.all.btw)}</div>
          </div>
          <div className="kpi">
            <div className="label">Totaal excl.</div>
            <div className="value">{euro(totals.all.excl)}</div>
          </div>
          <div className="kpi">
            <div className="label">Gem. per transactie</div>
            <div className="value">{euro(avgPerTx)}</div>
          </div>
          <div className="kpi">
            <div className="label">% Brandstof</div>
            <div className="value">{((fuelShare * 100) || 0).toFixed(0)}%</div>
          </div>
        </div>
      </div>

      {/* Charts + panels */}
      <div className="grid">
        <div className="panel">
          <div className="card h">
            <h3 style={{ marginTop: 0, color: "#0b3654" }}>Uitgaven door de tijd</h3>
            {daily.length === 0 ? (
              <div className="sub">Geen transacties in deze periode.</div>
            ) : (
              <LineChart data={daily.map((d) => ({ x: d.x, y: d.y }))} />
            )}
          </div>
          <div className="card h">
            <h3 style={{ marginTop: 0, color: "#0b3654" }}>Brandstof vs Shop per maand</h3>
            {monthKeys.length === 0 ? (
              <div className="sub">Geen data per maand in deze periode.</div>
            ) : (
              <StackedBars months={monthKeys} series={byMonth} />
            )}
          </div>
        </div>

        <div className="panel">
          <div className="card h" style={{ display: "grid", placeItems: "center" }}>
            <h3 style={{ margin: 0, color: "#0b3654" }}>Verdeling categorie</h3>
            <div className="donut-row">
              <Donut value={fuelShare || 0} label="Brandstof" />
              <Donut value={shopShare || 0} label="Shop" color="#94a3b8" />
            </div>
          </div>

          <div className="card h">
            <h3 style={{ marginTop: 0, color: "#0b3654" }}>Top 5 stations</h3>
            <div className="tablewrap" style={{ marginTop: 10 }}>
              <table>
                <thead>
                  <tr>
                    <th>Station</th>
                    <th className="num">Totaal</th>
                  </tr>
                </thead>
                <tbody>
                  {topStations.length === 0 ? (
                    <tr>
                      <td colSpan={2} style={{ padding: 16, color: "#6b7280" }}>
                        Nog geen data in deze periode.
                      </td>
                    </tr>
                  ) : (
                    topStations.map(([name, amt]) => (
                      <tr key={name}>
                        <td>{name}</td>
                        <td className="num">{euro(amt)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* BTW per tarief + Weekdag heatmap */}
      <div className="two" style={{ marginTop: 18 }}>
        {/* VAT by rate */}
        <div className="card h">
          <h3 style={{ marginTop: 0, color: "#0b3654" }}>BTW per tarief</h3>
          <div className="two" style={{ alignItems: "center", marginTop: 12 }}>
            <div>
              <table className="vat-table">
                <thead>
                  <tr>
                    <th>Tarief</th>
                    <th className="num">Incl.</th>
                    <th className="num">BTW</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>21%</td>
                    <td className="num">{euro(vatByRate.inclByRate["21"])}</td>
                    <td className="num">{euro(vatByRate.buckets["21"])}</td>
                  </tr>
                  <tr>
                    <td>9%</td>
                    <td className="num">{euro(vatByRate.inclByRate["9"])}</td>
                    <td className="num">{euro(vatByRate.buckets["9"])}</td>
                  </tr>
                  <tr>
                    <td>0%</td>
                    <td className="num">{euro(vatByRate.inclByRate["0"])}</td>
                    <td className="num">{euro(vatByRate.buckets["0"])}</td>
                  </tr>
                  <tr>
                    <td>Overig</td>
                    <td className="num">{euro(vatByRate.inclByRate["other"])}</td>
                    <td className="num">{euro(vatByRate.buckets["other"])}</td>
                  </tr>
                  <tr>
                    <td>
                      <strong>Totaal BTW</strong>
                    </td>
                    <td></td>
                    <td className="num">
                      <strong>{euro(vatByRate.totalVat || 0)}</strong>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div style={{ display: "grid", placeItems: "center" }}>
              <Donut value={(vatByRate.buckets["21"] || 0) / (vatByRate.totalVat || 1)} label="Aandeel 21% BTW" />
            </div>
          </div>
        </div>

        {/* Weekday heatmap */}
        <div className="card h">
          <h3 style={{ marginTop: 0, color: "#0b3654" }}>Heatmap per weekdag</h3>
          <div className="sub">Donkerder = meer uitgegeven (incl.)</div>
          <div className="heat">
            {["Ma", "Di", "Wo", "Do", "Vr", "Za", "Zo"].map((d, i) => {
              const val = heatWeek.arr[i] || 0;
              const t = heatWeek.max ? val / heatWeek.max : 0;
              const bg = `rgba(11,54,84, ${0.12 + 0.65 * t})`;
              return (
                <div key={d} className="dot" style={{ background: bg }} title={`${d}: ${euro(val)}`}>
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontWeight: 800 }}>{d}</div>
                    <div style={{ fontSize: 11, opacity: 0.85 }}>{euro(val)}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Budget alerts */}
      <div className="two" style={{ marginTop: 18 }}>
        <div className="card h">
          <h3 style={{ marginTop: 0, color: "#0b3654" }}>Budget brandstof (per maand)</h3>
          <div className="sub">
            Huidige maand: {euro(monthFuel)} van {euro(fuelBudget)}
          </div>
          <div style={{ marginTop: 10 }}>
            <Progress value={fuelPct} />
          </div>
          {fuelPct >= 90 && (
            <div className="warn" style={{ marginTop: 12 }}>
              Bijna over budget: {fuelPct}% gebruikt. Overweeg limieten of waarschuwingen op passen.
            </div>
          )}
          <div style={{ marginTop: 12, display: "flex", gap: 10, alignItems: "center" }}>
            <label className="label">Budget (€)</label>
            <input
              className="input"
              type="number"
              value={fuelBudget}
              onChange={(e) => setFuelBudget(Number(e.target.value) || 0)}
            />
          </div>
        </div>

        <div className="card h">
          <h3 style={{ marginTop: 0, color: "#0b3654" }}>Budget shop (per maand)</h3>
          <div className="sub">
            Huidige maand: {euro(monthShop)} van {euro(shopBudget)}
          </div>
          <div style={{ marginTop: 10 }}>
            <Progress value={shopPct} />
          </div>
          {shopPct >= 90 && (
            <div className="warn" style={{ marginTop: 12 }}>
              Bijna over budget: {shopPct}% gebruikt voor shopaankopen.
            </div>
          )}
          <div style={{ marginTop: 12, display: "flex", gap: 10, alignItems: "center" }}>
            <label className="label">Budget (€)</label>
            <input
              className="input"
              type="number"
              value={shopBudget}
              onChange={(e) => setShopBudget(Number(e.target.value) || 0)}
            />
          </div>
        </div>
      </div>

      {loading && <div style={{ marginTop: 14, color: "#64748b" }}>Laden…</div>}
      {!loading && err && (
        <div className="warn" style={{ marginTop: 14 }}>
          {err}
        </div>
      )}
    </div>
  );
}
