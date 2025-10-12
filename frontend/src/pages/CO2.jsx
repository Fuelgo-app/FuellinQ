// src/pages/CO2.jsx
import React, { useEffect, useMemo, useState } from "react";
import { API_BASE, apiFetch } from "@/api/base.js";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, Legend,
} from "recharts";

/* -------------------- helpers -------------------- */
const getToken = () => localStorage.getItem("token") || "";
const authHeaders = () => ({ Authorization: `Bearer ${getToken()}` });
const isISO = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ""));

const euro = (n) =>
  (typeof n === "number" ? n : Number(n || 0)).toLocaleString("nl-NL", {
    style: "currency",
    currency: "EUR",
  });
const num = (n, dec = 0) => {
  const x = Number(n ?? 0);
  return Number.isFinite(x) ? x.toLocaleString("nl-NL", { maximumFractionDigits: dec, minimumFractionDigits: dec }) : "–";
};

function qs(obj) {
  const u = new URLSearchParams();
  Object.entries(obj || {}).forEach(([k, v]) => (v !== undefined && v !== null && v !== "") && u.set(k, v));
  const s = u.toString();
  return s ? `?${s}` : "";
}

async function getJSON(path) {
  const r = await fetch(`${API_BASE}${path}`, { headers: { ...authHeaders() } });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data?.error || `GET ${path} failed (${r.status})`);
  return data;
}

async function postJSON(path, body, useAuth = false) {
  const r = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(useAuth ? authHeaders() : {}) },
    body: JSON.stringify(body ?? {}),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data?.error || `POST ${path} failed (${r.status})`);
  return data;
}

async function downloadCsv(path, filename) {
  const r = await fetch(`${API_BASE}${path}`, { headers: { ...authHeaders() } });
  if (!r.ok) throw new Error(`CSV download failed (${r.status})`);
  const blob = await r.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/* -------------------- UI atoms -------------------- */
function Card({ title, value, sub }) {
  return (
    <div className="rounded-2xl shadow p-4 bg-white/5 border border-white/10">
      <div className="text-sm opacity-70">{title}</div>
      <div className="text-2xl font-semibold">{value}</div>
      {sub ? <div className="text-xs opacity-60 mt-1">{sub}</div> : null}
    </div>
  );
}

function Row({ children, gap = 12, wrap = true, style = {} }) {
  return (
    <div style={{ display: "flex", gap, flexWrap: wrap ? "wrap" : "nowrap", alignItems: "center", ...style }}>
      {children}
    </div>
  );
}
function Input({ label, ...props }) {
  return (
    <label style={{ display: "grid", gap: 6 }}>
      <span style={{ fontSize: 12, opacity: 0.8 }}>{label}</span>
      <input
        {...props}
        className="rounded-xl px-3 py-2 border border-white/20 bg-white/5"
        style={{ minWidth: 140 }}
      />
    </label>
  );
}
function Button({ children, ...props }) {
  return (
    <button
      {...props}
      className="rounded-xl px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50"
    >
      {children}
    </button>
  );
}

/* -------------------- pickers -------------------- */
function VehiclePicker({ onPicked }) {
  const [plate, setPlate] = useState("");
  const [loading, setLoading] = useState(false);
  const [rdw, setRdw] = useState(null);
  const [vehicleId, setVehicleId] = useState(null);
  const norm = (p) => String(p || "").toUpperCase().replace(/[^A-Z0-9]/g, "");

  async function lookup() {
    const p = norm(plate);
    if (!p) return;
    setLoading(true);
    setRdw(null);
    setVehicleId(null);
    try {
      // Public endpoint (geen auth nodig)
      const resp = await postJSON(`/api/co2/vehicle/lookup`, { license_plate: p }, false);
      setRdw(resp?.rdw || null);
      setVehicleId(resp?.vehicle_id || null);
      if (resp?.vehicle_id && onPicked) onPicked(resp.vehicle_id, resp.rdw);
    } catch (e) {
      console.error(e);
      alert(e.message || e);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-2xl border border-white/10 p-3 bg-white/5">
      <Row gap={12} wrap>
        <Input
          label="Kenteken"
          placeholder="bijv. K-123-XY"
          value={plate}
          onChange={(e) => setPlate(e.target.value)}
        />
        <Button onClick={lookup} disabled={!plate || loading}>
          {loading ? "Zoeken..." : "Zoek kenteken"}
        </Button>
        {vehicleId ? (
          <div className="text-sm opacity-80">Gevonden Vehicle ID: <b>{vehicleId}</b></div>
        ) : null}
      </Row>

      {rdw ? (
        <div className="mt-3 text-sm grid gap-1">
          <div>Merk/Model: <b>{[rdw.make, rdw.model].filter(Boolean).join(" ") || "—"}</b></div>
          <div>Brandstof: <b>{rdw.fuel_primary || "—"}</b></div>
          <div>WLTP g/km: <b>{rdw.wltp_g_per_km ?? "—"}</b></div>
          <div>Kenteken (genormeerd): <b>{rdw.license_plate}</b></div>
        </div>
      ) : null}
    </div>
  );
}

function CompanyPicker({ value, onChange }) {
  // Simpel: direct ID invullen. Later kun je hier een zoekfunctie aan koppelen.
  return (
    <div className="rounded-2xl border border-white/10 p-3 bg-white/5">
      <Row gap={12} wrap>
        <Input
          label="Company ID"
          placeholder="bijv. 7"
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
        />
        <div className="text-sm opacity-70">
          Tip: plak hier je companyId. Zoekfunctie kan later worden gekoppeld.
        </div>
      </Row>
    </div>
  );
}

/* -------------------- charts -------------------- */
function MonthCharts({ data }) {
  const hasData = (data?.rows || []).length > 0;
  if (!hasData) return <div className="opacity-60">Nog geen maanddata gevonden.</div>;

  return (
    <div className="grid gap-16" style={{ marginTop: 16 }}>
      <div style={{ width: "100%", height: 280 }}>
        <ResponsiveContainer>
          <LineChart data={data.rows}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="month" />
            <YAxis yAxisId="left" />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey="kg_co2" yAxisId="left" name="kg CO₂" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div style={{ width: "100%", height: 280 }}>
        <ResponsiveContainer>
          <BarChart data={data.rows}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="month" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar dataKey="km" name="Kilometers" />
            <Bar dataKey="liters" name="Liters" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/* -------------------- Vehicle tab -------------------- */
function VehicleTab() {
  const [vehicleId, setVehicleId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [months, setMonths] = useState(12);

  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState(null);
  const [monthly, setMonthly] = useState(null);
  const validRange = !from || isISO(from);
  const validRange2 = !to || isISO(to);

  async function loadAll() {
    if (!vehicleId) return;
    setLoading(true);
    try {
      const q = { from: isISO(from) ? from : undefined, to: isISO(to) ? to : undefined };
      const r = await getJSON(`/api/co2/vehicle/${vehicleId}/report${qs({ ...q, price_per_ton: 20 })}`);
      const m = await getJSON(`/api/co2/vehicle/${vehicleId}/monthly${qs(q.from || q.to ? q : { months })}`);
      setReport(r);
      setMonthly(m);
    } catch (e) {
      console.error(e);
      alert(e.message || e);
    } finally {
      setLoading(false);
    }
  }

  async function downloadVehicleCsv() {
    if (!vehicleId) return;
    const q = { from: isISO(from) ? from : undefined, to: isISO(to) ? to : undefined, price_per_ton: 20 };
    await downloadCsv(`/api/co2/vehicle/${vehicleId}/report.csv${qs(q)}`, `vehicle_${vehicleId}_co2_report.csv`);
  }

  // Auto-reload als ID wijzigt en velden leeg zijn (sneller testen)
  useEffect(() => {
    if (vehicleId && !from && !to) loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vehicleId]);

  return (
    <div className="grid gap-4">
      <VehiclePicker onPicked={(id) => setVehicleId(String(id))} />

      <Row gap={16} style={{ marginTop: 8 }}>
        <Input label="Vehicle ID" placeholder="bijv. 42" value={vehicleId} onChange={(e) => setVehicleId(e.target.value)} />
        <Input label="From (YYYY-MM-DD)" placeholder="optioneel" value={from} onChange={(e) => setFrom(e.target.value)} />
        <Input label="To (YYYY-MM-DD)" placeholder="optioneel" value={to} onChange={(e) => setTo(e.target.value)} />
        <Input label="Months (fallback)" type="number" min={1} max={60} value={months} onChange={(e) => setMonths(e.target.value)} />
        <Button onClick={loadAll} disabled={!vehicleId || !validRange || !validRange2 || loading}>
          {loading ? "Laden..." : "Laad data"}
        </Button>
        <Button onClick={downloadVehicleCsv} disabled={!vehicleId || loading}>
          Download CSV
        </Button>
      </Row>

      {report && (
        <>
          <Row gap={12} wrap>
            <Card title="Totaal km" value={num(report.km_total)} />
            <Card title="Totaal liters" value={num(report.liters_total, 2)} />
            <Card title="Totaal CO₂ (kg)" value={num(report.kg_co2_total, 0)} sub={`Methode: ${report.method}`} />
            <Card title="Gemiddeld g/km" value={report.avg_g_per_km != null ? num(report.avg_g_per_km) : "–"} />
            {report.offset && (
              <>
                <Card title="CO₂ (ton)" value={num(report.offset.tons, 3)} />
                <Card title="Offset €" value={euro(report.offset.estimated_cost_eur)} sub={`€/${num(report.offset.price_per_ton)} per ton`} />
              </>
            )}
          </Row>

          <div className="mt-2 text-sm opacity-70">
            Periode: {report.from || "–"} t/m {report.to || "–"}
          </div>
        </>
      )}

      <hr className="opacity-20" />

      <h3 className="text-lg font-semibold">Maandoverzicht</h3>
      <MonthCharts data={monthly} />
    </div>
  );
}

/* -------------------- Company tab -------------------- */
function CompanyTab() {
  const [companyId, setCompanyId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [months, setMonths] = useState(12);

  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState(null);
  const [monthly, setMonthly] = useState(null);

  async function loadAll() {
    if (!companyId) return;
    setLoading(true);
    try {
      const q = { from: isISO(from) ? from : undefined, to: isISO(to) ? to : undefined };
      const r = await getJSON(`/api/co2/company/${companyId}/report${qs({ ...q, price_per_ton: 20 })}`);
      const m = await getJSON(`/api/co2/company/${companyId}/monthly${qs(q.from || q.to ? q : { months })}`);
      setReport(r);
      setMonthly(m);
    } catch (e) {
      console.error(e);
      alert(e.message || e);
    } finally {
      setLoading(false);
    }
  }

  async function downloadCompanyCsv() {
    if (!companyId) return;
    const q = { from: isISO(from) ? from : undefined, to: isISO(to) ? to : undefined, price_per_ton: 20 };
    await downloadCsv(`/api/co2/company/${companyId}/report.csv${qs(q)}`, `company_${companyId}_co2_report.csv`);
  }

  useEffect(() => {
    if (companyId && !from && !to) loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId]);

  return (
    <div className="grid gap-4">
      <CompanyPicker value={companyId} onChange={setCompanyId} />

      <Row gap={16} style={{ marginTop: 8 }}>
        <Input label="From (YYYY-MM-DD)" placeholder="optioneel" value={from} onChange={(e) => setFrom(e.target.value)} />
        <Input label="To (YYYY-MM-DD)" placeholder="optioneel" value={to} onChange={(e) => setTo(e.target.value)} />
        <Input label="Months (fallback)" type="number" min={1} max={60} value={months} onChange={(e) => setMonths(e.target.value)} />
        <Button onClick={loadAll} disabled={!companyId || loading}>
          {loading ? "Laden..." : "Laad data"}
        </Button>
        <Button onClick={downloadCompanyCsv} disabled={!companyId || loading}>
          Download CSV
        </Button>
      </Row>

      {report && (
        <>
          <Row gap={12} wrap>
            <Card title="Voertuigen" value={num(report.vehicles)} />
            <Card title="Totaal km" value={num(report.km_total)} />
            <Card title="Totaal liters" value={num(report.liters_total, 2)} />
            <Card title="Totaal CO₂ (kg)" value={num(report.kg_co2_total, 0)} />
            <Card title="Gemiddeld g/km" value={report.avg_g_per_km != null ? num(report.avg_g_per_km) : "–"} />
            {report.offset && (
              <>
                <Card title="CO₂ (ton)" value={num(report.offset.tons, 3)} />
                <Card title="Offset €" value={euro(report.offset.estimated_cost_eur)} sub={`€/${num(report.offset.price_per_ton)} per ton`} />
              </>
            )}
          </Row>

          <div className="mt-2 text-sm opacity-70">
            Periode: {report.from || "–"} t/m {report.to || "–"}
          </div>
        </>
      )}

      <hr className="opacity-20" />

      <h3 className="text-lg font-semibold">Maandoverzicht (alle voertuigen)</h3>
      <MonthCharts data={monthly} />
    </div>
  );
}

/* -------------------- main page -------------------- */
export default function CO2Page() {
  const [tab, setTab] = useState("vehicle"); // 'vehicle' | 'company'

  return (
    <div className="container mx-auto max-w-6xl px-4 py-6">
      <h1 className="text-2xl font-bold mb-4">CO₂ Dashboard</h1>

      <Row gap={8} style={{ marginBottom: 16 }}>
        <button
          className={`px-4 py-2 rounded-xl border ${tab === "vehicle" ? "bg-blue-600 text-white border-transparent" : "bg-white/5 border-white/20"}`}
          onClick={() => setTab("vehicle")}
        >
          Voertuig
        </button>
        <button
          className={`px-4 py-2 rounded-xl border ${tab === "company" ? "bg-blue-600 text-white border-transparent" : "bg-white/5 border-white/20"}`}
          onClick={() => setTab("company")}
        >
          Bedrijf
        </button>
      </Row>

      {tab === "vehicle" ? <VehicleTab /> : <CompanyTab />}
    </div>
  );
}
