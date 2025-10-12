// frontend/src/components/StationFinder.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";

/* -------------------- API helper (met nette fallback) -------------------- */
let API_BASE = "";
let apiFetch = null;
try {
  // Gebruik je eigen helper als die bestaat (Vite: alias @ -> /src)
  // Top-level await werkt in Vite. Als jouw setup dat niet ondersteunt,
  // zie opmerking onderaan voor een alternatieve variant.
  // eslint-disable-next-line import/no-unresolved
  const baseMod = await import("@/api/base.js");
  API_BASE = String(baseMod.API_BASE || "").replace(/\/+$/, "");
  apiFetch = baseMod.apiFetch;
} catch {
  API_BASE = (import.meta?.env?.VITE_API_URL || "http://localhost:3000").replace(/\/+$/, "");
  apiFetch = async (path, opts = {}) => {
    const res = await fetch(`${API_BASE}${path}`, {
      headers: { "Content-Type": "application/json", ...(opts.headers || {}) },
      credentials: "include",
      ...opts,
    });
    const ct = res.headers.get("content-type") || "";
    const body = ct.includes("application/json") ? await res.json().catch(() => ({})) : await res.text();
    if (!res.ok) throw new Error(`API ${res.status}: ${typeof body === "string" ? body : body?.error || "Unknown error"}`);
    return body;
  };
}

/* -------------------- kleine helpers -------------------- */
function initials(name = "") {
  const parts = String(name).trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => (p[0] || "").toUpperCase()).join("");
}
function displayTitle(st) {
  const brand = (st.brand || "").trim();
  const title = (st.title || "").trim();
  if (brand && title && brand.toLowerCase() !== title.toLowerCase()) return `${brand} — ${title}`;
  return title || brand || "Onbekend station";
}
function minPrice(st) {
  const arr = Array.isArray(st?.prices) ? st.prices : [];
  if (!arr.length) return null;
  const cents = Math.min(...arr.map((p) => Number(p.price_cents)).filter(Number.isFinite));
  return Number.isFinite(cents) ? (cents / 100).toFixed(2).replace(".", ",") : null;
}

/* Haversine afstand (km) fallback als API geen distance_km terugstuurt */
function distanceKm(a, b) {
  if (!a || !b) return null;
  const toRad = (d) => (d * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad((b.lat ?? 0) - (a.lat ?? 0));
  const dLon = toRad((b.lng ?? 0) - (a.lng ?? 0));
  const lat1 = toRad(a.lat ?? 0);
  const lat2 = toRad(b.lat ?? 0);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/* -------------------- UI subcomponent -------------------- */
function StationCard({ st }) {
  const logo = st.logo_url || st.brand_logo_url || "";
  const price = minPrice(st);
  const canNavigate = st.lat != null && st.lng != null;
  const hasId = st.id != null;

  return (
    <div className="border rounded-2xl p-4 bg-white">
      {/* header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          {logo ? (
            <img
              src={logo}
              alt={st.brand || st.title || "Station"}
              className="w-7 h-7 rounded-md object-cover bg-white"
              onError={(e) => { e.currentTarget.style.display = "none"; }}
            />
          ) : (
            <div className="w-7 h-7 rounded-md bg-gray-100 grid place-items-center text-[10px] font-semibold text-gray-600">
              {initials(st.title || st.brand)}
            </div>
          )}
          <div className="min-w-0">
            <div className="font-semibold truncate">{displayTitle(st)}</div>
            <div className="text-sm text-gray-500 truncate">
              {(st.city || "").trim() || (st.postcode || "").trim()}
              {st.distance_km != null ? ` · ${Number(st.distance_km).toFixed(1)} km` : ""}
            </div>
          </div>
        </div>

        {price ? (
          <div className="text-right">
            <div className="text-xl font-semibold">
              {price} <span className="text-sm font-normal">/ L</span>
            </div>
          </div>
        ) : null}
      </div>

      {/* Offers (top-2) */}
      {Array.isArray(st.offers) && st.offers.length ? (
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
          {st.offers.slice(0, 2).map((o) => (
            <div key={o.id ?? `${o.title}-${o.image_url ?? "x"}`} className="flex items-center gap-3 border rounded-xl p-3">
              {o.image_url ? (
                <img src={o.image_url} alt={o.title} className="w-16 h-16 rounded-lg object-cover" />
              ) : (
                <div className="w-16 h-16 rounded-lg bg-gray-100 grid place-items-center text-xs text-gray-500">Deal</div>
              )}
              <div className="min-w-0">
                <div className="font-medium truncate">{o.title}</div>
                {Number.isFinite(Number(o.price_cents)) && (
                  <div className="text-sm text-gray-600">€ {(Number(o.price_cents) / 100).toFixed(2).replace(".", ",")}</div>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-3 text-sm text-gray-500">Geen acties op dit moment.</div>
      )}

      {/* knoppen */}
      <div className="mt-3 grid grid-cols-2 gap-3">
        {canNavigate ? (
          <a
            className="px-4 py-2 rounded-xl bg-gray-100 text-center font-medium"
            href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${st.lat},${st.lng}`)}`}
            target="_blank" rel="noreferrer"
          >
            Route
          </a>
        ) : (
          <div className="px-4 py-2 rounded-xl bg-gray-100 text-center font-medium opacity-60 cursor-not-allowed">Route</div>
        )}

        {hasId ? (
          <Link to={`/station/${st.id}`} className="px-4 py-2 rounded-xl bg-blue-600 text-white text-center font-semibold">
            Nu tanken
          </Link>
        ) : (
          <div className="px-4 py-2 rounded-xl bg-blue-600/60 text-white text-center font-semibold cursor-not-allowed">Nu tanken</div>
        )}
      </div>
    </div>
  );
}

/* -------------------- hoofdcomponent -------------------- */
/**
 * StationFinder props:
 * - stations?: vooraf geladen stations (anders haalt component zelf op)
 * - autoLocate?: boolean (default true) → vraag geolocatie om op afstand te sorteren/filteren
 * - limit?: number (default 100)
 * - fuelDefault?: string (bijv. "euro95", "diesel")
 * - qDefault?: string  (initiële zoekterm)
 */
export default function StationFinder({
  stations: givenStations,
  autoLocate = true,
  limit = 100,
  fuelDefault = "",
  qDefault = "",
}) {
  const [stations, setStations] = useState(givenStations || []);
  const [loading, setLoading] = useState(!givenStations);
  const [error, setError] = useState("");

  // UI state
  const [q, setQ] = useState(qDefault);
  const [fuel, setFuel] = useState(fuelDefault);
  const [radiusKm, setRadiusKm] = useState(25);

  // locatie
  const [pos, setPos] = useState(null); // {lat, lng} of null
  const [locErr, setLocErr] = useState("");

  // debounce refs
  const qRef = useRef(q);
  const fuelRef = useRef(fuel);
  const radiusRef = useRef(radiusKm);
  const posRef = useRef(pos);

  useEffect(() => { qRef.current = q; }, [q]);
  useEffect(() => { fuelRef.current = fuel; }, [fuel]);
  useEffect(() => { radiusRef.current = radiusKm; }, [radiusKm]);
  useEffect(() => { posRef.current = pos; }, [pos]);

  // Geolocatie ophalen (optioneel)
  useEffect(() => {
    if (!autoLocate || givenStations) return;
    if (!("geolocation" in navigator)) return;
    navigator.geolocation.getCurrentPosition(
      (res) => {
        setPos({ lat: res.coords.latitude, lng: res.coords.longitude });
        setLocErr("");
      },
      (err) => setLocErr(err?.message || "Locatie niet beschikbaar"),
      { enableHighAccuracy: false, maximumAge: 60_000, timeout: 8_000 }
    );
  }, [autoLocate, givenStations]);

  // Data fetchen (als geen props-stations)
  useEffect(() => {
    if (givenStations && givenStations.length) return; // props winnen
    let cancelled = false;
    const t = setTimeout(async () => {
      try {
        setLoading(true);
        setError("");
        const u = new URL(`${API_BASE}/api/partner/public/stations`);
        u.searchParams.set("limit", String(limit || 100));
        if (qRef.current) u.searchParams.set("q", qRef.current);
        if (fuelRef.current) u.searchParams.set("fuel", fuelRef.current);
        if (posRef.current?.lat && posRef.current?.lng) {
          u.searchParams.set("lat", String(posRef.current.lat));
          u.searchParams.set("lng", String(posRef.current.lng));
          if (radiusRef.current) u.searchParams.set("radius_km", String(radiusRef.current));
        }
        // apiFetch voegt API_BASE al toe → we geven alleen pad + query mee
        const pathWithQuery = `${u.pathname}?${u.searchParams.toString()}`;
        const j = await apiFetch(pathWithQuery);
        if (!cancelled) {
          let list = Array.isArray(j?.stations) ? j.stations : [];
          if (posRef.current && !list.some((s) => s.distance_km != null)) {
            list = list.map((s) => ({
              ...s,
              distance_km: s.lat != null && s.lng != null ? distanceKm(posRef.current, { lat: s.lat, lng: s.lng }) : null,
            }));
          }
          list.sort((a, b) => (a.distance_km ?? Infinity) - (b.distance_km ?? Infinity));
          setStations(list);
        }
      } catch {
        if (!cancelled) setError("Kon stations niet laden");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 300); // debounce

    return () => { cancelled = true; clearTimeout(t); };
  }, [givenStations, limit, q, fuel, radiusKm, pos]);

  // Als stations via props komen, pas optioneel afstand toe voor UI-consistentie
  const decorated = useMemo(() => {
    let list = Array.isArray(stations) ? stations.slice() : [];
    if (pos && !list.some((s) => s.distance_km != null)) {
      list = list.map((s) => ({
        ...s,
        distance_km: s.lat != null && s.lng != null ? distanceKm(pos, { lat: s.lat, lng: s.lng }) : null,
      }));
    }
    // Client-side filters wanneer givenStations gebruikt wordt
    if (givenStations && q) {
      const term = q.toLowerCase();
      list = list.filter((s) =>
        [s.title, s.brand, s.city, s.postcode].filter(Boolean).some((v) => String(v).toLowerCase().includes(term))
      );
    }
    if (givenStations && fuel) {
      list = list.filter((s) => (Array.isArray(s.fuels) ? s.fuels.map(String).includes(fuel) : true));
    }
    if (givenStations && pos && radiusKm) {
      list = list.filter((s) => (s.distance_km ?? Infinity) <= radiusKm + 1e-9);
    }
    list.sort((a, b) => (a.distance_km ?? Infinity) - (b.distance_km ?? Infinity));
    return list;
  }, [stations, pos, q, fuel, radiusKm, givenStations]);

  /* -------------------- UI -------------------- */
  return (
    <div className="grid gap-4">
      {/* Filters */}
      <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
        <input
          type="search"
          className="border rounded-xl px-3 py-2 sm:col-span-2"
          placeholder="Zoek op naam, plaats of postcode…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />

        <select
          className="border rounded-xl px-3 py-2"
          value={fuel}
          onChange={(e) => setFuel(e.target.value)}
        >
          <option value="">Alle brandstoffen</option>
          <option value="euro95">Benzine (E5/E10)</option>
          <option value="diesel">Diesel</option>
          <option value="lpg">LPG</option>
          <option value="adblue">AdBlue</option>
          <option value="hvo">HVO</option>
          <option value="elektrisch">Elektrisch</option>
        </select>

        <div className="flex items-center gap-2">
          <input
            type="number"
            min={1}
            max={200}
            className="border rounded-xl px-3 py-2 w-full"
            value={radiusKm}
            onChange={(e) => setRadiusKm(Math.max(1, Math.min(200, Number(e.target.value) || 1)))}
          />
          <span className="text-sm text-gray-600">km</span>
        </div>

        <button
          type="button"
          className="rounded-xl px-3 py-2 border bg-gray-50"
          onClick={() => { setQ(""); setFuel(""); setRadiusKm(25); }}
          title="Reset filters"
        >
          Reset
        </button>
      </div>

      {/* Locatie status */}
      {autoLocate && !givenStations ? (
        <div className="text-xs text-gray-500">
          {pos
            ? `Locatie actief (± ${pos.lat.toFixed(3)}, ${pos.lng.toFixed(3)})`
            : locErr
            ? `Locatie: ${locErr}`
            : "Locatie opvragen…"}
        </div>
      ) : null}

      {/* Lijst */}
      {loading ? (
        <div className="text-sm text-gray-500">Laden…</div>
      ) : error ? (
        <div className="text-sm text-red-600">{error}</div>
      ) : decorated.length === 0 ? (
        <div className="text-sm text-gray-500">Geen stations gevonden.</div>
      ) : (
        <div className="grid gap-4">
          {decorated.map((st) => (
            <StationCard key={st.id ?? `${st.title}-${st.lat}-${st.lng}`} st={st} />
          ))}
        </div>
      )}
    </div>
  );
}
