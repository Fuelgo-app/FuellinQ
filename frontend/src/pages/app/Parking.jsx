// src/pages/Parking.jsx
// Parkeren — Map-first UI met prijs-badges, pill-zoekbalk, zone-overlay, toolbar & clustering

import React from "react";
import { Link } from "react-router-dom";
import {
  MapContainer, TileLayer, Marker, Popup, Circle, Polygon, useMap
} from "react-leaflet";
import MarkerClusterGroup from "react-leaflet-cluster";
import "leaflet/dist/leaflet.css";
import "leaflet-defaulticon-compatibility";
import "leaflet-defaulticon-compatibility/dist/leaflet-defaulticon-compatibility.webpack.css";
import L from "leaflet";

/* ----------------- API helper (fallback naar mock) ----------------- */
const API_BASE = (typeof window !== "undefined" && window.API_BASE) || "";
async function api(path, { method = "GET", body } = {}) {
  const opts = { method, credentials: "include", headers: { "Content-Type": "application/json" } };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${API_BASE}${path}`, opts);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

/* ----------------- Utils ----------------- */
const safeUUID = () => {
  try { return window?.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2); }
  catch { return Math.random().toString(36).slice(2); }
};
const fmtMoney = (n, c = "EUR") => {
  try { return new Intl.NumberFormat("nl-NL", { style: "currency", currency: c }).format(n); }
  catch { return `${(n ?? 0).toFixed?.(2) ?? n} ${c}`; }
};
const secondsToHMS = (s) => {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), ss = s % 60;
  const pad = (x) => String(x).padStart(2, "0");
  return `${pad(h)}:${pad(m)}:${pad(ss)}`;
};

/* ----------------- Mock zones (met polygon) ----------------- */
function mockZones(center) {
  const base = center || { lat: 52.3702, lng: 4.8952 }; // Amsterdam
  const mk = (i, dx, dy, price) => {
    const c = { lat: base.lat + dx, lng: base.lng + dy };
    // simpele ruit-polygon om het idee te tonen
    const poly = [
      [c.lat + 0.004, c.lng],
      [c.lat, c.lng + 0.004],
      [c.lat - 0.004, c.lng],
      [c.lat, c.lng - 0.004],
    ];
    return {
      id: `NL-AMS-${100 + i}`,
      provider: "Gemeente Amsterdam",
      name: `Zone ${i}`,
      code: `AMS-${i}`,
      price_per_hour: price,
      max_hours: 5,
      coords: c,
      currency: "EUR",
      polygon: poly,
    };
  };
  return [
    mk(1,  0.002,  0.003, 1.89),
    mk(2, -0.001,  0.002, 2.10),
    mk(3,  0.003, -0.002, 2.49),
    mk(4, -0.004, -0.001, 1.99),
  ];
}

/* ----------------- Leaflet helpers ----------------- */
function FitToBounds({ points }) {
  const map = useMap();
  React.useEffect(() => {
    if (!map || !points?.length) return;
    const b = L.latLngBounds(points);
    try { map.fitBounds(b, { padding: [28, 28] }); } catch {}
  }, [map, points]);
  return null;
}

/* Custom DivIcon voor prijs-badges (groen/geel/rood) */
function priceBadgeIcon(amount) {
  const val = typeof amount === "number" ? amount : parseFloat(amount || "0");
  let color = "#22c55e"; // groen
  if (val >= 2.0 && val < 2.3) color = "#f59e0b";   // geel
  if (val >= 2.3) color = "#ef4444";                // rood

  const html = `
    <div style="
      display:inline-flex;align-items:center;gap:6px;
      padding:6px 10px;border-radius:18px;
      background:#fff;border:1px solid rgba(0,0,0,.1);
      box-shadow:0 6px 16px rgba(0,0,0,.15);
      font-weight:700;font-size:13px;color:#111;
    ">
      <span style="
        display:inline-block;width:10px;height:10px;border-radius:10px;background:${color};
        box-shadow:0 0 0 2px #fff inset;
      "></span>
      <span>€${val.toFixed(2)}</span>
    </div>
  `;
  return L.divIcon({
    className: "price-badge",
    html,
    iconSize: [1, 1],
    iconAnchor: [0, 0],
    popupAnchor: [0, -12],
  });
}

/* ----------------- Kaart ----------------- */
function LeafletMap({ zones, position, onStart, onMarkerClick, selectedZone, layers }) {
  const center = position ? [position.lat, position.lng] : [52.3702, 4.8952];

  // Injecteer de CSS voor de pulserende user-dot (eenmalig)
  React.useEffect(() => {
    const id = "user-pulse-style";
    if (!document.getElementById(id)) {
      const s = document.createElement("style");
      s.id = id;
      s.textContent = `
        .user-pulse-icon { position: relative; }
        .user-pulse-dot {
          width: 12px; height: 12px; border-radius: 9999px;
          background: #2563eb; box-shadow: 0 0 0 3px #fff;
          display: inline-block; position: relative;
        }
        .user-pulse-dot::after {
          content: ""; position: absolute; left: 50%; top: 50%;
          width: 12px; height: 12px; border-radius: 9999px;
          transform: translate(-50%,-50%);
          background: rgba(37,99,235,.35);
          animation: pulse-dot 2s ease-out infinite;
        }
        @keyframes pulse-dot {
          0% { transform: translate(-50%,-50%) scale(1); opacity: .8; }
          100% { transform: translate(-50%,-50%) scale(2.6); opacity: 0; }
        }
      `;
      document.head.appendChild(s);
    }
  }, []);

  // Pulserende “you are here” DivIcon
  const userPulseIcon = React.useMemo(() =>
    L.divIcon({
      className: "user-pulse-icon",
      html: `<span class="user-pulse-dot"></span>`,
      iconSize: [16, 16],
      iconAnchor: [8, 8],
    }), []
  );

  const points = React.useMemo(() => {
    const pts = [];
    if (position) pts.push([position.lat, position.lng]);
    (zones || []).forEach((z) => z?.coords && pts.push([z.coords.lat, z.coords.lng]));
    return pts;
  }, [zones, position]);

  // OSM tiles (eenvoudig en zonder token)
  const tileUrl = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
  const tileAttr = "© OpenStreetMap-bijdragers";

  return (
    <MapContainer center={center} zoom={13} style={{ height: "100%", width: "100%" }} scrollWheelZoom>
      <TileLayer attribution={tileAttr} url={tileUrl} />

      {position && (
        <>
          {/* Pulserende locatie-dot */}
          <Marker position={[position.lat, position.lng]} icon={userPulseIcon} />
          {/* Precisie-cirkel */}
          <Circle center={[position.lat, position.lng]} radius={120} pathOptions={{ color: "#2563eb" }} />
        </>
      )}

      {/* Parkeerlaag (polygons + prijs-badges) */}
      {layers?.parking && (zones || []).map((z) =>
        z.polygon ? (
          <Polygon
            key={`${z.id}-poly`}
            positions={z.polygon}
            pathOptions={{
              color: z.id === selectedZone?.id ? "#6d28d9" : "#7c3aed",
              fillColor: "#a78bfa",
              weight: z.id === selectedZone?.id ? 3 : 2,
              fillOpacity: z.id === selectedZone?.id ? 0.35 : 0.22,
              dashArray: z.id === selectedZone?.id ? null : "4 4",
            }}
            eventHandlers={{ click: () => onMarkerClick?.(z) }}
          />
        ) : null
      )}

      {layers?.parking && (
        <MarkerClusterGroup chunkedLoading maxClusterRadius={48} spiderfyOnMaxZoom>
          {(zones || []).map((z) => (
            <Marker
              key={z.id}
              position={[z.coords.lat, z.coords.lng]}
              icon={priceBadgeIcon(z.price_per_hour)}
              eventHandlers={{ click: () => onMarkerClick?.(z) }}
            >
              <Popup>
                <div className="space-y-1">
                  <div className="font-semibold">
                    {z.name} <span className="opacity-60">· {z.code}</span>
                  </div>
                  <div className="text-sm opacity-70">{fmtMoney(z.price_per_hour, z.currency || "EUR")} / uur</div>
                  <button className="mt-2 rounded-lg border px-3 py-1" onClick={() => onStart?.(z)}>
                    Start hier
                  </button>
                </div>
              </Popup>
            </Marker>
          ))}
        </MarkerClusterGroup>
      )}

      <FitToBounds points={points} />
    </MapContainer>
  );
}

/* ----------------- Hoofdcomponent ----------------- */
export default function Parking() {
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");

  const [position, setPosition] = React.useState(null);
  const [query, setQuery] = React.useState("");
  const [zones, setZones] = React.useState([]);
  const [selectedZone, setSelectedZone] = React.useState(null);

  const [vehicles, setVehicles] = React.useState([]);
  const [selectedPlate, setSelectedPlate] = React.useState("");

  const [active, setActive] = React.useState(null);
  const [seconds, setSeconds] = React.useState(0);

  // 🔀 Layers voor toolbar (rechts)
  const [layers, setLayers] = React.useState({ parking: true, charge: false, fuel: false });
  const toggle = (k) => setLayers((s) => ({ ...s, [k]: !s[k] }));

  /* Timer actieve sessie */
  React.useEffect(() => {
    if (!active) return;
    const startTs = active.started_at ? new Date(active.started_at).getTime() : Date.now();
    const t = setInterval(() => setSeconds(Math.max(0, Math.floor((Date.now() - startTs) / 1000))), 1000);
    return () => clearInterval(t);
  }, [active]);

  /* Init: voertuigen + auto-locate */
  React.useEffect(() => {
    (async () => {
      try {
        const data = await api("/api/vehicles");
        const vs = (data?.vehicles || []).map((v) => ({ id: v.id, plate: v.license_plate || v.plate }));
        setVehicles(vs);
        if (vs[0]) setSelectedPlate(vs[0].plate);
      } catch {
        const vs = [{ id: "v1", plate: "R-123-AB" }, { id: "v2", plate: "K-456-CD" }];
        setVehicles(vs); setSelectedPlate(vs[0].plate);
      }
    })();

    geolocateAndSearch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function geolocateAndSearch() {
    setError(""); setLoading(true);
    try {
      const pos = await new Promise((resolve, reject) => {
        if (!navigator.geolocation) return reject(new Error("Geolocatie niet beschikbaar"));
        navigator.geolocation.getCurrentPosition(
          (r) => resolve({ lat: r.coords.latitude, lng: r.coords.longitude }),
          (e) => reject(e),
          { enableHighAccuracy: true, timeout: 8000 }
        );
      });
      setPosition(pos);
      try {
        const data = await api(`/api/parking/zones?lat=${pos.lat}&lng=${pos.lng}`);
        const list = data?.zones || [];
        if (list.length) {
          setZones(list);
          setSelectedZone(list[0] || null);
          return;
        }
        throw new Error("Lege backend response");
      } catch {
        const mz = mockZones(pos); setZones(mz); setSelectedZone(mz[0] || null);
      }
    } catch (e) {
      setError(e?.message || "Kon locatie niet ophalen");
    } finally { setLoading(false); }
  }

  async function searchByText() {
    setError(""); setLoading(true);
    try {
      try {
        const data = await api(`/api/parking/search?q=${encodeURIComponent(query)}`);
        const list = data?.zones || [];
        if (list.length) {
          setZones(list); setSelectedZone(list[0] || null);
          return;
        }
        throw new Error("Lege backend response");
      } catch {
        const mz = mockZones(); setZones(mz); setSelectedZone(mz[0] || null);
      }
    } catch (e) {
      setError(e?.message || "Zoeken mislukt");
    } finally { setLoading(false); }
  }

  function estimatePrice(zone, s = seconds) {
    if (!zone) return 0;
    const hours = s / 3600;
    return Math.max(0, hours * (zone.price_per_hour || 0));
  }

  async function startParking(zone = selectedZone) {
    if (!zone) return;
    setError(""); setLoading(true);
    try {
      let sess;
      try {
        sess = await api("/api/parking/sessions", { method: "POST", body: { zone_id: zone.id, plate: selectedPlate } });
      } catch {
        sess = { id: `mock-${safeUUID()}`, zone, plate: selectedPlate, started_at: new Date().toISOString(), status: "active" };
      }
      setActive({ ...sess, zone }); setSeconds(0);
    } catch (e) {
      setError(e?.message || "Starten mislukt");
    } finally { setLoading(false); }
  }

  async function stopParking() {
    if (!active) return; setLoading(true);
    try {
      try { await api(`/api/parking/sessions/${active.id}/stop`, { method: "POST" }); } catch {}
      const total = estimatePrice(active.zone, seconds);
      alert(`Parkeren gestopt. Totaal: ${fmtMoney(total, active.zone?.currency || "EUR")}`);
      setActive(null);
    } catch (e) {
      setError(e?.message || "Stoppen mislukt");
    } finally { setLoading(false); }
  }

  const showSheet = !!selectedZone;

  return (
    // vaste hoogte voor de map, ~ header 80-96px (pas aan als jouw header hoger is)
    <div className="relative" style={{ height: "calc(100vh - 96px)" }}>
      {/* Map vult de hele container */}
      <div style={{ position: "absolute", inset: 0 }}>
        <LeafletMap
          zones={zones}
          position={position}
          onStart={(z) => startParking(z)}
          onMarkerClick={setSelectedZone}
          selectedZone={selectedZone}
          layers={layers}
        />
      </div>

      {/* Pill-zoekbalk + loc-knop */}
      <div className="pointer-events-none absolute left-1/2 top-4 z-[500] w-full max-w-3xl -translate-x-1/2 px-4">
        <div className="pointer-events-auto flex items-center gap-3">
          <div className="flex-1 h-12 rounded-full border border-slate-200 bg-white/90 backdrop-blur px-4 flex items-center shadow-md">
            <svg width="18" height="18" viewBox="0 0 24 24" className="opacity-60"><path fill="currentColor" d="m21.71 20.29l-3.4-3.39A8.94 8.94 0 0 0 19 11a9 9 0 1 0-9 9a8.94 8.94 0 0 0 5.9-2.69l3.39 3.4a1 1 0 0 0 1.42-1.42ZM4 11a7 7 0 1 1 7 7a7 7 0 0 1-7-7Z"/></svg>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Zoek op zone of plaats"
              className="ml-2 flex-1 bg-transparent outline-none text-[15px]"
            />
            <button onClick={searchByText} className="ml-2 rounded-full px-4 py-1.5 text-sm border bg-white hover:bg-slate-50">
              Zoeken
            </button>
          </div>
          <button
            title="Rondom mijn locatie"
            className="h-12 w-12 rounded-full border border-slate-200 bg-white/90 backdrop-blur shadow-md flex items-center justify-center"
            onClick={geolocateAndSearch}
          >
            📍
          </button>
        </div>
      </div>

      {/* Right-side toolbar */}
      <div className="absolute right-3 top-24 z-[600] flex flex-col gap-2">
        {[
          { key: "parking", label: "P",  title: "Parkeerzones" },
          { key: "charge",  label: "⚡", title: "Laadpalen (coming soon)" },
          { key: "fuel",    label: "⛽", title: "Tankstations (coming soon)" },
        ].map((b) => {
          const on = layers[b.key];
          return (
            <button
              key={b.key}
              title={b.title}
              onClick={() => toggle(b.key)}
              className={`h-12 w-12 rounded-full border bg-white/90 shadow-md hover:bg-slate-50
                          ${on ? "ring-2 ring-slate-300" : ""}`}
            >
              {b.label}
            </button>
          );
        })}
      </div>

      {/* Actieve sessie badge */}
      {active && (
        <div className="absolute right-4 top-4 z-[600]">
          <div className="rounded-xl bg-black text-white/90 px-4 py-2 shadow-lg">
            Actief · {secondsToHMS(seconds)} · {fmtMoney(estimatePrice(active.zone), active.zone?.currency || "EUR")}
            <button onClick={stopParking} className="ml-3 underline">Stop</button>
          </div>
        </div>
      )}

      {/* Bottom sheet: zone details + grote CTA */}
      <div className={`fixed inset-x-0 bottom-0 z-[600] transition-transform duration-300 ${showSheet ? "translate-y-0" : "translate-y-full"}`}>
        <div className="mx-auto w-full max-w-2xl rounded-t-3xl border border-slate-200 bg-white shadow-2xl">
          <div className="mx-auto mt-2 h-1.5 w-12 rounded-full bg-slate-200" />
          {selectedZone ? (
            <div className="p-5 md:p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-xs uppercase tracking-wide text-slate-500">Zone</div>
                  <div className="text-2xl font-bold">{selectedZone.name} · {selectedZone.code}</div>
                  <div className="text-sm text-slate-600">
                    Tarief: {fmtMoney(selectedZone.price_per_hour, selectedZone.currency || "EUR")} / uur · Max {selectedZone.max_hours} uur
                  </div>
                </div>
                <button className="text-sm text-slate-500 hover:text-slate-700" onClick={() => setSelectedZone(null)}>Sluiten ✕</button>
              </div>

              <div className="mt-5 grid gap-3 md:grid-cols-3">
                <div className="md:col-span-2 rounded-xl border border-slate-200 p-3">
                  <div className="text-sm font-semibold mb-1 text-slate-700">Kenteken</div>
                  <select
                    value={selectedPlate}
                    onChange={(e) => setSelectedPlate(e.target.value)}
                    className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-[15px] outline-none focus:ring-2 focus:ring-slate-400/40"
                  >
                    {vehicles.map((v) => <option key={v.id} value={v.plate}>{v.plate}</option>)}
                  </select>
                  {!vehicles.length && (
                    <div className="text-[11px] mt-1 text-slate-500">
                      Geen voertuig? Voeg toe via <Link className="underline" to="/app/vehicles">Vehicles</Link>.
                    </div>
                  )}
                </div>
                <div className="rounded-xl border border-slate-200 p-3">
                  <div className="text-sm font-semibold mb-1 text-slate-700">Schatting (nu)</div>
                  <div className="text-xl">{fmtMoney(estimatePrice(selectedZone), selectedZone.currency || "EUR")}</div>
                </div>
              </div>

              <div className="mt-5 flex gap-3">
                <button onClick={() => startParking(selectedZone)} className="h-12 rounded-2xl px-6 bg-[#0b3654] text-white hover:opacity-90 active:scale-[.99]">
                  🚗 Parkeren · {selectedZone.code}
                </button>
                <button onClick={() => setSelectedZone(null)} className="h-12 rounded-2xl px-6 border border-slate-300 bg-white hover:bg-slate-50 active:scale-[.99]">
                  Later
                </button>
              </div>
            </div>
          ) : (
            <div className="p-6 text-sm text-slate-500">Geen zone geselecteerd.</div>
          )}
        </div>
      </div>
    </div>
  );
}
