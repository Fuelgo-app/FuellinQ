// src/pages/Vehicles.jsx
// FuelLinq • Voertuigenpagina (kentekencheck + RDW-gegevens + lijst & koppelen)
import React, { useEffect, useMemo, useRef, useState } from "react";

/* ---------------- Config ---------------- */
const API_BASE =
  (typeof window !== "undefined" && (window.API_BASE || "")) ||
  (import.meta?.env?.VITE_API_URL || "http://localhost:3000");

/* ---------------- Helpers ---------------- */
const normalizePlate = (s) =>
  String(s || "").toUpperCase().replace(/[^A-Z0-9]/g, "");

const formatPlatePretty = (s) => {
  const p = normalizePlate(s);
  if (p.length <= 2) return p;
  if (p.length <= 5) return `${p.slice(0, 2)}-${p.slice(2)}`;
  return `${p.slice(0, 2)}-${p.slice(2, 5)}-${p.slice(5, 8)}`;
};

function joinTruthy(...xs) {
  return xs.filter(Boolean).join(" ");
}

/* ---------------- HTTP helpers (status op errors) ---------------- */
async function apiGet(path) {
  const url = `${API_BASE.replace(/\/+$/, "")}${path}`;
  const res = await fetch(url, {
    method: "GET",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
  });
  const isJson = (res.headers.get("content-type") || "").includes("application/json");
  const data = isJson ? await res.json().catch(() => ({})) : {};
  if (!res.ok) {
    const err = new Error(data?.error || `GET ${path} failed`);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

async function apiPost(path, body) {
  const url = `${API_BASE.replace(/\/+$/, "")}${path}`;
  const res = await fetch(url, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body || {}),
  });
  const isJson = (res.headers.get("content-type") || "").includes("application/json");
  const data = isJson ? await res.json().catch(() => ({})) : {};
  if (!res.ok) {
    const err = new Error(data?.error || `POST ${path} failed`);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

async function apiPatch(path, body) {
  const url = `${API_BASE.replace(/\/+$/, "")}${path}`;
  const res = await fetch(url, {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body || {}),
  });
  const isJson = (res.headers.get("content-type") || "").includes("application/json");
  const data = isJson ? await res.json().catch(() => ({})) : {};
  if (!res.ok) {
    const err = new Error(data?.error || `PATCH ${path} failed`);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

async function apiDelete(path) {
  const url = `${API_BASE.replace(/\/+$/, "")}${path}`;
  const res = await fetch(url, {
    method: "DELETE",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
  });
  const isJson = (res.headers.get("content-type") || "").includes("application/json");
  const data = isJson ? await res.json().catch(() => ({})) : {};
  if (!res.ok) {
    const err = new Error(data?.error || `DELETE ${path} failed`);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

/* ------- RDW lookup met brede fallback (met én zonder /api) ------- */
async function rdwLookup(plateInput) {
  const plate = normalizePlate(plateInput);
  if (!plate || plate.length < 5) {
    throw new Error("Vul een geldig NL-kenteken in (bijv. Z915PR).");
  }

  const attempts = [
    () => apiGet(`/api/rdw/lookup?plate=${encodeURIComponent(plate)}`),
    () => apiGet(`/api/rdw/combined?kenteken=${encodeURIComponent(plate)}`),
    () => apiPost(`/api/rdw/lookup`, { plate }),
    () => apiGet(`/rdw/lookup?plate=${encodeURIComponent(plate)}`),
    () => apiGet(`/rdw/combined?kenteken=${encodeURIComponent(plate)}`),
    () => apiPost(`/rdw/lookup`, { plate }),
  ];

  let lastErr = null;
  for (const attempt of attempts) {
    try {
      return await attempt();
    } catch (e) {
      lastErr = e;
    }
  }
  if (lastErr?.status === 404) {
    throw new Error("RDW-endpoints niet gevonden (404). Controleer server routes (/api/rdw of /rdw).");
  }
  throw lastErr || new Error("RDW-lookup mislukt.");
}

/* ---------------- Kleine UI helpers ---------------- */
function InfoRow({ label, value }) {
  if (!value && value !== 0) return null;
  return (
    <div className="row" style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 8 }}>
      <div className="muted">{label}</div>
      <div style={{ fontWeight: 600 }}>{value}</div>
    </div>
  );
}

/* ================================================================== */
/* Page */
/* ================================================================== */
export default function VehiclesPage() {
  const [plate, setPlate] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [result, setResult] = useState(null);

  // lijst-beheer
  const [list, setList] = useState([]);
  const [listLoading, setListLoading] = useState(true);
  const [listErr, setListErr] = useState("");

  const inputRef = useRef(null);

  // laad mijn voertuigen
  async function loadList() {
    try {
      setListErr("");
      setListLoading(true);
      const data = await apiGet("/api/vehicles");
      setList(Array.isArray(data?.items) ? data.items : Array.isArray(data) ? data : []);
    } catch (e) {
      setListErr(e?.message || "Kon voertuigenlijst niet laden.");
    } finally {
      setListLoading(false);
    }
  }

  useEffect(() => {
    loadList();
  }, []);

  // RDW submit
  const onSubmit = async (e) => {
    e?.preventDefault?.();
    setErr("");
    const p = normalizePlate(plate);
    if (p.length < 5) {
      setErr("Vul een geldig NL-kenteken in (bijv. Z915PR).");
      return;
    }
    try {
      setLoading(true);
      const data = await rdwLookup(p);
      setResult(mapResult(data));
    } catch (e2) {
      setResult(null);
      setErr(e2?.message || "Ophalen van RDW-gegevens is mislukt.");
    } finally {
      setLoading(false);
    }
  };

  // Opslaan van huidige RDW-resultaat in "mijn voertuigen"
  async function saveCurrentVehicle() {
    if (!result?.plate) return;
    try {
      await apiPost("/api/vehicles", {
        plate: result.plate,
        merk: result.merk,
        model: result.handelsbenaming,
        uitvoering: result.uitvoering,
        kleur: result.kleur,
        brandstof: result.brandstof,
        bouwjaar: result.bouwjaar,
        transmissie: result.transmissie,
        carrosserie: result.carrosserie,
        vermogen_kw: result.vermogen_kw,
        vermogen_pk: result.vermogen_pk,
        gewicht: result.gewicht,
        zitplaatsen: result.zitplaatsen,
      });
      await loadList();
    } catch (e) {
      alert(e?.message || "Opslaan mislukt.");
    }
  }

  // Inline bestuurder koppelen (server triggert Klaviyo-mail)
  async function assignDriver(item, fields) {
    try {
      const id = item.id ?? item.vehicle_id ?? item._id;
      // accepteer PATCH /api/vehicles/:id of aparte endpoint
      await apiPatch(`/api/vehicles/${id}`, {
        driver_name: fields.driver_name ?? item.driver_name ?? "",
        driver_email: fields.driver_email ?? item.driver_email ?? "",
      });
      await loadList();
    } catch (e) {
      alert(e?.message || "Bestuurder koppelen mislukt.");
    }
  }

  // Verwijderen
  async function removeVehicle(item) {
    if (!confirm(`Verwijderen ${formatPlatePretty(item.plate)}?`)) return;
    try {
      const id = item.id ?? item.vehicle_id ?? item._id;
      await apiDelete(`/api/vehicles/${id}`);
      await loadList();
    } catch (e) {
      alert(e?.message || "Verwijderen mislukt.");
    }
  }

  return (
    <div id="vehicles-page" className="container" style={{ paddingTop: 12, paddingBottom: 24 }}>
      {/* ===== HERO ===== */}
      <section
        className="veh-hero rounded-2xl overflow-hidden"
        style={{
          position: "relative",
          minHeight: 260,
          backgroundImage:
            "linear-gradient(180deg, rgba(2,6,23,.20), rgba(2,6,23,.55)), url('/assets/road-hero.jpg')",
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
        }}
      >
        <div style={{ padding: 20, paddingBottom: 16 }}>
          <div style={{ maxWidth: 920, margin: "0 auto" }}>
            <h1 className="veh-hero-title" style={{ margin: 0, fontSize: 36, fontWeight: 800 }}>
              Voeg een voertuig toe
            </h1>
            <p className="veh-hero-sub" style={{ marginTop: 8, fontSize: 16 }}>
              Controleer direct de RDW-gegevens, APK-status en specificaties.
            </p>

            {/* Formulier */}
            <form onSubmit={onSubmit} style={{ marginTop: 14 }}>
              {/* Gele kentekenbalk */}
              <div
                className="veh-plate-wrap w-full rounded-2xl overflow-hidden"
                style={{ background: "#f6c628", borderRadius: 16 }}
              >
                <div className="flex items-center">
                  <div
                    className="veh-plate-left"
                    style={{
                      background: "#0A5AC2",
                      height: 48,
                      minWidth: 48,
                      display: "grid",
                      placeItems: "center",
                      color: "#fff",
                      fontWeight: 800,
                      fontSize: 14,
                    }}
                  >
                    NL
                  </div>
                  <input
                    ref={inputRef}
                    className="veh-plate-right"
                    type="text"
                    value={plate.toUpperCase()}
                    onChange={(e) => setPlate(normalizePlate(e.target.value))}
                    placeholder="Vul hier je kenteken in"
                    inputMode="text"
                    autoCapitalize="characters"
                    autoComplete="off"
                    spellCheck="false"
                    style={{
                      height: 48,
                      border: "none",
                      background: "transparent",
                      width: "100%",
                      padding: "0 14px",
                      fontSize: 18,
                      fontWeight: 700,
                      letterSpacing: ".5px",
                    }}
                  />
                </div>
              </div>

              {/* CTA */}
              <button
                type="submit"
                className="veh-cta-wrap"
                disabled={loading}
                style={{
                  marginTop: 10,
                  width: "100%",
                  height: 48,
                  borderRadius: 16,
                  background: "var(--accent-2)",
                  color: "#fff",
                  fontWeight: 800,
                  fontSize: 16,
                  letterSpacing: ".02em",
                  cursor: loading ? "default" : "pointer",
                  opacity: loading ? 0.8 : 1,
                }}
              >
                {loading ? "GEGEVENS OPHALEN…" : "GEGEVENS OPHALEN ►"}
              </button>

              {/* Hint */}
              <div className="veh-hero-sub" style={{ marginTop: 8, fontSize: 14, color: "#E6F0FF" }}>
                Geen streepjes nodig • Binnen 2 minuten klaar
              </div>
            </form>
          </div>
        </div>
      </section>

      {/* ===== ERROR ===== */}
      {err && (
        <div className="card mt-4 p-4" style={{ borderColor: "#fecaca", background: "#fff7f7" }}>
          <div style={{ color: "#991b1b", fontWeight: 700, marginBottom: 6 }}>Er ging iets mis</div>
          <div style={{ color: "#7f1d1d" }}>{err}</div>
        </div>
      )}

      {/* ===== RESULT ===== */}
      <section className="card panel-card mt-4 p-4">
        {!result ? (
          <div>
            <div style={{ fontSize: 26, fontWeight: 800, marginBottom: 8 }}>Nog geen voertuig</div>
            <div className="muted">
              Vul hierboven je kenteken in. Na het zoeken tonen we je basisgegevens, snelle checks
              (APK, waardering) en technische specificaties.
            </div>
          </div>
        ) : (
          <VehicleResultCard data={result} onSave={saveCurrentVehicle} />
        )}
      </section>

      {/* ===== LIJST: mijn voertuigen ===== */}
      <section className="card mt-4 p-4">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h3 style={{ margin: 0, fontSize: 18 }}>Mijn voertuigen</h3>
          {listLoading ? <span className="muted">Laden…</span> : null}
        </div>

        {listErr && (
          <div className="mt-2" style={{ color: "#991b1b" }}>
            {listErr}
          </div>
        )}

        {!listLoading && list.length === 0 ? (
          <div className="muted mt-2">Nog geen voertuigen opgeslagen.</div>
        ) : (
          <div className="mt-3" style={{ display: "grid", gap: 10 }}>
            {list.map((item) => (
              <VehicleListRow
                key={item.id ?? item._id ?? item.plate}
                item={item}
                onAssign={assignDriver}
                onRemove={removeVehicle}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

/* ---------------- Result mapping ---------------- */
function mapResult(data) {
  const base = data?.vehicle || data || {};
  const fuels = data?.fuels || data?.brandstof || [];
  return {
    plate: base.kenteken || base.plate || "",
    merk: base.merk || base.brand || "",
    handelsbenaming: base.handelsbenaming || base.model || "",
    uitvoering: base.uitvoering || "",
    kleur: base.eerste_kleur || base.kleur || "",
    bouwjaar: base.datum_eerste_toelating?.slice(0, 4) || base.bouwjaar || base.jaar || "",
    brandstof: (Array.isArray(fuels) && fuels[0]?.brandstof_omschrijving) || base.brandstof || "",
    apk: data?.inspection?.vervaldatum_apk || base.vervaldatum_apk || "",
    vermogen_kw: base.max_nettovermogen || base.vermogen_kw || "",
    vermogen_pk: base.vermogen_pk || "",
    transmissie: base.transmissie || base.soort_transmissie || "",
    carrosserie: base.inrichting || base.type_voertuig || "",
    gewicht: base.massa_ledig_voertuig || base.gewicht || "",
    zitplaatsen: base.aantal_zitplaatsen || base.zitplaatsen || "",
    waarde_nieuw: data?.valuation?.nieuwprijs || "",
    waarde_range: data?.valuation?.indicatie || "",
  };
}

/* ---------------- Result card ---------------- */
function VehicleResultCard({ data, onSave }) {
  const title = [data.merk, data.handelsbenaming].filter(Boolean).join(" ");
  const sub = [data.uitvoering, data.carrosserie].filter(Boolean).join(" • ");

  return (
    <div>
      <div style={{ display: "grid", gap: 12 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <span
              className="badge"
              style={{
                background: "#f6c628",
                color: "#111827",
                borderColor: "#f4d35e",
                fontWeight: 800,
              }}
            >
              {formatPlatePretty(data.plate)}
            </span>
            <h2 style={{ margin: 0, fontWeight: 800, fontSize: 22 }}>{title || "Voertuig"}</h2>
          </div>
          {sub ? <div className="muted" style={{ marginTop: 4 }}>{sub}</div> : null}
        </div>

        <div className="grid" style={{ gridTemplateColumns: "repeat(2, minmax(0,1fr))", gap: 16 }}>
          <div className="card p-4">
            <h3 style={{ marginTop: 0, marginBottom: 10, fontSize: 16 }}>Basisgegevens</h3>
            <InfoRow label="Merk" value={data.merk} />
            <InfoRow label="Model" value={data.handelsbenaming} />
            <InfoRow label="Uitvoering" value={data.uitvoering} />
            <InfoRow label="Kleur" value={data.kleur} />
            <InfoRow label="Brandstof" value={data.brandstof} />
            <InfoRow label="Bouwjaar" value={data.bouwjaar} />
            <InfoRow label="APK tot" value={data.apk} />
          </div>

          <div className="card p-4">
            <h3 style={{ marginTop: 0, marginBottom: 10, fontSize: 16 }}>Technische gegevens</h3>
            <InfoRow
              label="Vermogen"
              value={
                data.vermogen_pk
                  ? `${data.vermogen_pk} pk`
                  : data.vermogen_kw
                  ? `${data.vermogen_kw} kW`
                  : ""
              }
            />
            <InfoRow label="Transmissie" value={data.transmissie} />
            <InfoRow label="Carrosserie" value={data.carrosserie} />
            <InfoRow label="Gewicht" value={data.gewicht && `${data.gewicht} kg`} />
            <InfoRow label="Zitplaatsen" value={data.zitplaatsen} />
          </div>
        </div>

        {(data.waarde_nieuw || data.waarde_range) && (
          <div className="card p-4">
            <h3 style={{ marginTop: 0, marginBottom: 10, fontSize: 16 }}>Waarde</h3>
            <InfoRow label="Nieuwprijs" value={data.waarde_nieuw && formatCurrency(data.waarde_nieuw)} />
            <InfoRow label="Waarde-indicatie" value={data.waarde_range} />
          </div>
        )}

        <button
          onClick={onSave}
          style={{
            height: 44,
            borderRadius: 12,
            background: "var(--accent-1, #0b3654)",
            color: "#fff",
            fontWeight: 700,
          }}
        >
          + Opslaan in mijn voertuigen
        </button>
      </div>
    </div>
  );
}

/* ---------------- Lijst item ---------------- */
function VehicleListRow({ item, onAssign, onRemove }) {
  const [name, setName] = useState(item.driver_name || "");
  const [email, setEmail] = useState(item.driver_email || "");
  const [busy, setBusy] = useState(false);

  const title = [item.merk || item.brand, item.model || item.handelsbenaming]
    .filter(Boolean)
    .join(" ");

  async function handleAssign() {
    setBusy(true);
    try {
      await onAssign(item, { driver_name: name, driver_email: email });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card p-3" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto", gap: 10 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span
          className="badge"
          style={{
            background: "#f6c628",
            color: "#111827",
            borderColor: "#f4d35e",
            fontWeight: 800,
          }}
        >
          {formatPlatePretty(item.plate)}
        </span>
        <div>
          <div style={{ fontWeight: 700 }}>{title || "Voertuig"}</div>
          <div className="muted">{[item.kleur, item.brandstof].filter(Boolean).join(" • ")}</div>
        </div>
      </div>

      <div>
        <div className="muted" style={{ fontSize: 12 }}>Bestuurder naam</div>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Bijv. Jan Jansen"
          style={{ width: "100%", height: 36, borderRadius: 8, padding: "0 10px" }}
        />
      </div>

      <div>
        <div className="muted" style={{ fontSize: 12 }}>Bestuurder e-mail</div>
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="bestuurder@bedrijf.nl"
          style={{ width: "100%", height: 36, borderRadius: 8, padding: "0 10px" }}
        />
      </div>

      <div style={{ display: "flex", gap: 8, alignItems: "end" }}>
        <button
          onClick={handleAssign}
          disabled={busy}
          title="Koppelen (verstuurt e-mail)"
          style={{
            height: 36,
            borderRadius: 8,
            background: "var(--accent-2, #f58220)",
            color: "#fff",
            fontWeight: 700,
            padding: "0 12px",
          }}
        >
          Koppelen
        </button>
        <button
          onClick={() => onRemove(item)}
          title="Verwijderen"
          style={{
            height: 36,
            borderRadius: 8,
            background: "#e11d48",
            color: "#fff",
            fontWeight: 700,
            padding: "0 12px",
          }}
        >
          Verwijderen
        </button>
      </div>
    </div>
  );
}

/* ---------------- Utils ---------------- */
function formatCurrency(v) {
  const n = Number(String(v).replace(/[^\d,.-]/g, "").replace(",", "."));
  if (Number.isNaN(n)) return v;
  return n.toLocaleString("nl-NL", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  });
}
