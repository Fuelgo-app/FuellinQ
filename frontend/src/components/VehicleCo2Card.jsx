// frontend/src/components/VehicleCo2Card.jsx
import React, { useEffect, useMemo, useState } from "react";
import {
  setToken as setCo2Token,
  lookupVehicle,
  addOdometer,
  addFuelTx,
  getReport,
  getPreview,
} from "@/lib/apiCo2";

/* ---------- helpers ---------- */
const fmt = (n, d = 0) =>
  typeof n === "number" && Number.isFinite(n) ? n.toLocaleString("nl-NL", { maximumFractionDigits: d, minimumFractionDigits: d }) : "–";

function prevMonthRange() {
  const now = new Date();
  const y = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
  const m = now.getMonth() === 0 ? 11 : now.getMonth() - 1;
  const from = new Date(y, m, 1);
  const to = new Date(y, m + 1, 0);
  const iso = (d) => d.toISOString().slice(0, 10);
  return { from: iso(from), to: iso(to) };
}

function methodLabel(m) {
  if (m === "wltp") return "WLTP (g/km)";
  if (m === "fuel_factor") return "Brandstoffactor (kg/l)";
  if (m === "electric") return "Elektrisch (0)";
  return "—";
}

/* ---------- component ---------- */
export default function VehicleCo2Card({ initialPlate = "" }) {
  // auth token uit localStorage voor private endpoints
  useEffect(() => {
    try {
      const t = localStorage.getItem("token");
      if (t) setCo2Token(t);
    } catch {}
  }, []);

  const defaultRange = useMemo(() => prevMonthRange(), []);
  const [plate, setPlate] = useState(initialPlate);
  const [vehicle, setVehicle] = useState(null);

  const [from, setFrom] = useState(defaultRange.from);
  const [to, setTo] = useState(defaultRange.to);

  const [report, setReport] = useState(null);
  const [preview, setPreview] = useState(null);

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  /* ----- actions ----- */
  async function onLookup() {
    setErr(""); setBusy(true);
    try {
      const p = (plate || "").trim();
      const r = await lookupVehicle(p);
      setVehicle(r.vehicle);
      setReport(null); setPreview(null);
    } catch (e) {
      setErr(e.message || "Zoeken mislukt");
    } finally {
      setBusy(false);
    }
  }

  async function onAddOdo() {
    if (!vehicle) return;
    setErr(""); setBusy(true);
    try {
      // demo: 2 metingen in dezelfde maand
      await addOdometer(vehicle.id, 120000, `${from}T10:00:00Z`);
      await addOdometer(vehicle.id, 120850, `${to}T17:00:00Z`);
      alert("Kilometerstanden gelogd");
    } catch (e) {
      setErr(e.message || "Odometer loggen mislukt");
    } finally {
      setBusy(false);
    }
  }

  async function onAddFuel() {
    if (!vehicle) return;
    setErr(""); setBusy(true);
    try {
      const fuel = vehicle.fuel_primary || "Benzine";
      // demo: 2 tankbeurten
      await addFuelTx(vehicle.id, fuel, 30.0, 63.0, `${from}T18:00:00Z`);
      await addFuelTx(vehicle.id, fuel, 45.2, 95.1, `${to}T12:30:00Z`);
      alert("Tankbeurten gelogd");
    } catch (e) {
      setErr(e.message || "Tankbeurt loggen mislukt");
    } finally {
      setBusy(false);
    }
  }

  async function onReport() {
    if (!vehicle) return;
    setErr(""); setBusy(true);
    try {
      // Rapport (JWT) + publieke preview (zonder JWT)
      const [rep, prv] = await Promise.all([
        getReport(vehicle.id, from, to).catch((e) => {
          // als geen token: toon nette melding maar laat preview wel zien
          setErr(e.message || "Rapport vereist login (JWT)");
          return null;
        }),
        getPreview(vehicle.id, from, to),
      ]);
      setReport(rep);
      setPreview(prv);
    } catch (e) {
      setErr(e.message || "Ophalen mislukt");
    } finally {
      setBusy(false);
    }
  }

  /* ----- derived ----- */
  const hasToken = useMemo(() => {
    try { return !!localStorage.getItem("token"); } catch { return false; }
  }, []);

  return (
    <div className="card p-4" style={{ borderRadius: 16 }}>
      <h3 style={{ marginTop: 0, color: "var(--brand-primary,#0b3654)" }}>CO₂-rapport</h3>

      {/* zoekbalk */}
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <input
          className="input"
          style={{ minWidth: 260 }}
          placeholder="Kenteken (bijv. K-123-XY)"
          value={plate}
          onChange={(e) => setPlate(e.target.value)}
        />
        <button className="btn" onClick={onLookup} disabled={busy || !plate.trim()}>
          {busy ? "Bezig…" : "Voertuig ophalen"}
        </button>
        {!hasToken && (
          <span className="muted" style={{ fontSize: 13 }}>
            (Tip: log in om het volledige rapport te zien)
          </span>
        )}
      </div>

      {!!err && (
        <div className="alert" style={{ marginTop: 10, color: "#991b1b", background: "#fee2e2", padding: "8px 10px", borderRadius: 10 }}>
          {err}
        </div>
      )}

      {/* voertuigkaart */}
      {vehicle && (
        <div className="card" style={{ marginTop: 12, padding: 12, borderRadius: 14 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <div>
              <div style={{ fontWeight: 800, marginBottom: 4 }}>{vehicle.license_plate}</div>
              <div className="muted">
                {vehicle.make ?? "–"} {vehicle.model ?? ""}
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <span className="badge" style={{ marginRight: 6 }}>
                {vehicle.fuel_primary ?? "—"}
              </span>
              <span className="badge">
                WLTP: {vehicle.wltp_g_per_km != null ? `${vehicle.wltp_g_per_km} g/km` : "—"}
              </span>
            </div>
          </div>

          <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
            <button className="btn btn-outline" onClick={onAddOdo} disabled={busy}>Kilometerstanden (demo)</button>
            <button className="btn btn-outline" onClick={onAddFuel} disabled={busy}>Tankbeurten (demo)</button>
          </div>

          {/* periode */}
          <div style={{ marginTop: 12, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <input className="input" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            <span>→</span>
            <input className="input" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            <button className="btn" onClick={onReport} disabled={busy}>
              {busy ? "Berekenen…" : "Rapport + Preview"}
            </button>
          </div>
        </div>
      )}

      {/* resultaten */}
      {(report || preview) && (
        <div style={{ marginTop: 16, display: "grid", gap: 16 }}>
          {/* samenvatting */}
          {report && (
            <div className="card p-3" style={{ borderRadius: 14 }}>
              <div style={{ fontWeight: 800, marginBottom: 8 }}>Rapport (JWT)</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0,1fr))", gap: 12 }}>
                <Stat label="Methode" value={methodLabel(report.method)} />
                <Stat label="Kilometers" value={`${fmt(report.km_total)}`} />
                <Stat label="Liters" value={`${fmt(report.liters_total, 2)}`} />
                <Stat label="Totaal CO₂ (kg)" value={`${fmt(report.kg_co2_total, 3)}`} />
              </div>
              <div className="muted" style={{ marginTop: 6 }}>
                Gemiddeld: {report.avg_g_per_km != null ? `${fmt(report.avg_g_per_km)} g/km` : "—"}
              </div>
            </div>
          )}

          {/* preview (publiek) */}
          {preview && (
            <div className="card p-3" style={{ borderRadius: 14 }}>
              <div style={{ fontWeight: 800, marginBottom: 8 }}>Preview (publiek)</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: 12 }}>
                {/* Electric */}
                <PreviewMethod
                  title="Elektrisch"
                  details={preview.methods?.electric ? { kg: 0 } : null}
                />
                {/* WLTP */}
                <PreviewMethod
                  title="WLTP"
                  details={
                    preview.methods?.wltp
                      ? { kg: preview.methods.wltp.kg_co2_total, extra: `WLTP: ${preview.methods.wltp.g_per_km} g/km` }
                      : null
                  }
                />
                {/* Fuel factor */}
                <PreviewMethod
                  title="Brandstoffactor"
                  details={
                    preview.methods?.fuel_factor
                      ? {
                          kg: preview.methods.fuel_factor.kg_co2_total,
                          extra: `${preview.methods.fuel_factor.fuel_type_used} – ${fmt(preview.methods.fuel_factor.kg_per_liter, 3)} kg/l`,
                        }
                      : null
                  }
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: 12, marginTop: 12 }}>
                <Stat label="Kilometers (periode)" value={`${fmt(preview.km_total)}`} />
                <Stat label="Liters (periode)" value={`${fmt(preview.liters_total, 2)}`} />
                <Stat label="Voertuig" value={`${vehicle?.make ?? "–"} ${vehicle?.model ?? ""}`} />
              </div>
            </div>
          )}

          {/* ruwe series (optioneel tonen als JSON) */}
          {(report?.series || preview?.series) && (
            <div className="card p-3" style={{ borderRadius: 14 }}>
              <details>
                <summary style={{ cursor: "pointer", fontWeight: 700 }}>Ruwe data (series)</summary>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 10 }}>
                  <div>
                    <div style={{ fontWeight: 700, marginBottom: 6 }}>Odometer</div>
                    <pre style={{ whiteSpace: "pre-wrap", background: "#0b0b0b", color: "#fafafa", padding: 8, borderRadius: 8 }}>
                      {JSON.stringify((report?.series ?? preview?.series)?.odometer ?? [], null, 2)}
                    </pre>
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, marginBottom: 6 }}>Fuel</div>
                    <pre style={{ whiteSpace: "pre-wrap", background: "#0b0b0b", color: "#fafafa", padding: 8, borderRadius: 8 }}>
                      {JSON.stringify((report?.series ?? preview?.series)?.fuel ?? [], null, 2)}
                    </pre>
                  </div>
                </div>
              </details>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ---------- kleine subcomponenten ---------- */
function Stat({ label, value }) {
  return (
    <div className="card" style={{ padding: 12, borderRadius: 12 }}>
      <div className="muted" style={{ fontSize: 12 }}>{label}</div>
      <div style={{ fontWeight: 900, fontSize: 18 }}>{value}</div>
    </div>
  );
}

function PreviewMethod({ title, details }) {
  return (
    <div className="card" style={{ padding: 12, borderRadius: 12 }}>
      <div className="muted" style={{ fontSize: 12 }}>{title}</div>
      {details ? (
        <>
          <div style={{ fontWeight: 900, fontSize: 18 }}>{fmt(details.kg, 3)} kg CO₂</div>
          {details.extra && <div className="muted" style={{ marginTop: 4 }}>{details.extra}</div>}
        </>
      ) : (
        <div style={{ fontWeight: 900, fontSize: 18 }}>—</div>
      )}
    </div>
  );
}
