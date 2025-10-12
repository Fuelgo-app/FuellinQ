// src/hooks/useRdwCombined.js
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

/** ───────────────────────────────
 *  Env helpers
 *  - Frontend spreekt bij voorkeur je backend aan (met JWT).
 *  - RDW fallback is optioneel (publiek); je kunt lokaal een app-token meegeven via VITE_RDW_APP_TOKEN.
 *  ─────────────────────────────── */
const RAW_API = (import.meta.env.VITE_API_URL ?? "").trim();
const API_BASE = (RAW_API && RAW_API !== "/" ? RAW_API : "http://localhost:3001").replace(/\/+$/, "");
const RDW_BASE = "https://opendata.rdw.nl/resource";
const RDW_APP_TOKEN = (import.meta.env.VITE_RDW_APP_TOKEN ?? "").trim();

/** ───────────────────────────────
 *  Kleine utils
 *  ─────────────────────────────── */
export function normalizePlate(input = "") {
  // Maak "12-AB-3" → "12AB3", uppercase, enkel letters/cijfers
  return String(input).toUpperCase().replace(/[^A-Z0-9]/g, "");
}
function parseNum(x) {
  if (x == null || x === "") return null;
  const n = Number(String(x).replace(",", "."));
  return Number.isFinite(n) ? n : null;
}
function parseDate(yyyymmdd) {
  // RDW levert vaak "20240131"; maak er "2024-01-31" Date van
  if (!yyyymmdd || String(yyyymmdd).length !== 8) return null;
  const s = String(yyyymmdd);
  const iso = `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
  const d = new Date(iso + "T00:00:00Z");
  return Number.isNaN(d.getTime()) ? null : d;
}
function toISODate(d) {
  return d instanceof Date && !isNaN(d) ? d.toISOString().slice(0, 10) : null;
}

/** Merge helper voor voertuig + brandstofrij(en) */
function buildCombined(vehicleRow = {}, fuelRows = []) {
  const v = vehicleRow || {};
  const fuels = Array.isArray(fuelRows) ? fuelRows : [];

  // CO2 uit brandstof dataset (pak gecombineerde indien beschikbaar; zo niet, neem min/max van partials)
  const pickCO2 = (r) => {
    const g = parseNum(r.co2_uitstoot_gecombineerd);
    if (g != null) return g;
    const s = parseNum(r.co2_uitstoot_stad);
    const w = parseNum(r.co2_uitstoot_snelweg);
    if (s != null && w != null) return Math.round((s + w) / 2);
    return s ?? w ?? null;
  };
  const co2Values = fuels.map(pickCO2).filter((x) => x != null);
  const co2_combined = co2Values.length ? Math.round(co2Values.reduce((a, b) => a + b, 0) / co2Values.length) : null;

  // Brandstoflijst als nette array
  const fuelList = fuels.map((r) => ({
    omschrijving: r.brandstof_omschrijving || r.brandstof || null,
    energie_label: r.energiebron_verbruik_label || null,
    verbruik_gecombineerd_l_100km: parseNum(r.brandstofverbruik_gecombineerd),
    verbruik_gecombineerd_km_l: r.brandstofverbruik_gecombineerd
      ? (100 / parseNum(r.brandstofverbruik_gecombineerd))
      : null,
    co2_gecombineerd_g_km: pickCO2(r),
    uitstootklasse: r.emissieklasse || r.uitstootklasse || null,
  }));

  // Datumvelden netjes
  const dET = parseDate(v.datum_eerste_toelating); // eerste toelating
  const dTT = parseDate(v.datum_tenaamstelling);   // tenaamstelling
  const dAPK = parseDate(v.vervaldatum_apk || v.apk_vervaldatum);

  return {
    kenteken: v.kenteken || null,
    merk: v.merk || null,
    handelsbenaming: v.handelsbenaming || null,
    uitvoering: v.uitvoering || null,
    voertuigsoort: v.voertuigsoort || null,
    eerste_kleur: v.eerste_kleur || null,
    tweede_kleur: v.tweede_kleur || null,

    // motor/massa
    aantal_cilinders: v.aantal_cilinders ? Number(v.aantal_cilinders) : null,
    cilinderinhoud_cc: v.cilinderinhoud ? Number(v.cilinderinhoud) : null,
    massa_ledig_kg: v.massa_ledig_voertuig ? Number(v.massa_ledig_voertuig) : null,
    massa_rijklaar_kg: v.massa_rijklaar ? Number(v.massa_rijklaar) : null,
    max_massa_kg: v.toegestane_maximum_massa_voertuig ? Number(v.toegestane_maximum_massa_voertuig) : null,

    // datumvelden
    datum_eerste_toelating: toISODate(dET),
    datum_tenaamstelling: toISODate(dTT),
    apk_vervaldatum: toISODate(dAPK),

    // brandstof + emissies
    brandstoffen: fuelList,
    co2_gecombineerd_g_km: co2_combined,

    // ruwe bron
    _raw: { vehicle: v, fuels },
  };
}

/** In-memory cache per kenteken (basic) */
const CACHE = new Map();

/** ───────────────────────────────
 *  Fallback fetchers (publieke RDW)
 *  ─────────────────────────────── */
async function rdwFetchJSON(path) {
  const headers = { Accept: "application/json" };
  if (RDW_APP_TOKEN) headers["X-App-Token"] = RDW_APP_TOKEN;
  const r = await fetch(`${RDW_BASE}${path}`, { headers });
  if (!r.ok) throw new Error(`RDW ${path} failed (${r.status})`);
  return r.json();
}
async function fetchVehiclePublic(kenteken) {
  const qs = new URLSearchParams({ kenteken, $limit: "1" });
  const arr = await rdwFetchJSON(`/m9d7-ebf2.json?${qs.toString()}`);
  return Array.isArray(arr) && arr[0] ? arr[0] : null;
}
async function fetchFuelPublic(kenteken) {
  const qs = new URLSearchParams({ kenteken, $limit: "5" }); // sommige auto's hebben meerdere regels (multi-fuel)
  const arr = await rdwFetchJSON(`/8ys7-d773.json?${qs.toString()}`);
  return Array.isArray(arr) ? arr : [];
}

/** ───────────────────────────────
 *  Backend fetcher (aanbevolen)
 *  Verwacht endpoint: GET /api/rdw/combined?kenteken=XX
 *  ─────────────────────────────── */
async function fetchCombinedBackend(kenteken, signal) {
  const url = `${API_BASE}/api/rdw/combined?kenteken=${encodeURIComponent(kenteken)}`;
  const r = await fetch(url, {
    headers: {
      Authorization: `Bearer ${localStorage.getItem("token") || ""}`,
      Accept: "application/json",
    },
    signal,
  });
  // Als backend (nog) niet bestaat of 404 geeft → laat caller fallback doen
  if (r.status === 404) return null;
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data?.error || `Backend RDW failed (${r.status})`);
  // Backend mag al merged object teruggeven. Indien niet, maak ‘m hier gelijkvormig.
  if (data && (data._raw || data.brandstoffen || data.merk || data.kenteken)) return data;
  // Of backend geeft raw rows => proberen te mergen
  return buildCombined(data.vehicle, data.fuels || data.brandstof || []);
}

/** ───────────────────────────────
 *  useRdwCombined hook
 *  ─────────────────────────────── */
export default function useRdwCombined(initialKenteken = "", options = {}) {
  const { auto = true, cache = true } = options;
  const [kenteken, setKenteken] = useState(() => normalizePlate(initialKenteken));
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(Boolean(auto && kenteken));
  const [error, setError] = useState(null);
  const abortRef = useRef(null);

  const hasCache = useMemo(() => cache && CACHE.has(kenteken), [cache, kenteken]);

  const run = useCallback(
    async (rawPlate) => {
      const k = normalizePlate(rawPlate || kenteken);
      if (!k) {
        setError(null);
        setData(null);
        setLoading(false);
        return null;
      }
      if (cache && CACHE.has(k)) {
        const cached = CACHE.get(k);
        setData(cached);
        setError(null);
        setLoading(false);
        return cached;
      }

      // Cancel vorige request
      if (abortRef.current) abortRef.current.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;

      setLoading(true);
      setError(null);

      try {
        // 1) Probeer backend
        let combined = await fetchCombinedBackend(k, ctrl.signal);
        // 2) Fallback naar publieke RDW als backend niets teruggeeft
        if (!combined) {
          const [veh, fuels] = await Promise.all([
            fetchVehiclePublic(k),
            fetchFuelPublic(k),
          ]);
          if (!veh && (!fuels || fuels.length === 0)) {
            throw new Error("Kenteken niet gevonden bij RDW.");
          }
          combined = buildCombined(veh || {}, fuels || []);
        }

        if (cache) CACHE.set(k, combined);
        setData(combined);
        setLoading(false);
        return combined;
      } catch (e) {
        if (e?.name === "AbortError") return null; // genegeerd
        setError(e);
        setLoading(false);
        return null;
      }
    },
    [kenteken, cache]
  );

  // Auto-run bij mount / kenteken wijziging
  useEffect(() => {
    if (auto && kenteken) {
      run(kenteken);
    } else {
      setLoading(false);
    }
    // cleanup
    return () => {
      if (abortRef.current) abortRef.current.abort();
    };
  }, [auto, kenteken, run]);

  const refetch = useCallback(
    async (plateOverride) => {
      const k = normalizePlate(plateOverride || kenteken);
      if (!k) return null;
      // force no-cache
      if (CACHE.has(k)) CACHE.delete(k);
      return run(k);
    },
    [kenteken, run]
  );

  return {
    kenteken,
    setKenteken,       // setter (bijv. vanuit input)
    data,              // merged object (zie buildCombined)
    loading,
    error,
    refetch,           // handmatige refresh (bypass cache)
    hasCache,
  };
}
