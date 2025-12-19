// src/hooks/useRdwCombined.js
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { API_BASE, apiGet } from "@/api/base.js";

/** ──────────────────────────────────────────
 * RDW & env helpers
 * - Backend preferred: /api/rdw/lookup?plate=XX
 * - Public RDW fallback (optioneel)
 * ────────────────────────────────────────── */
const RDW_BASE = "https://opendata.rdw.nl/resource";
const RDW_APP_TOKEN = (import.meta.env.VITE_RDW_APP_TOKEN ?? "").trim();

/** Normaliseer kenteken exact zoals backend:
 *  uppercase, strip niet-alnum, NIET afkappen */
export function normalizePlate(input = "") {
  return String(input).toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/** Kleine utils */
function parseNum(x) {
  if (x == null || x === "") return null;
  const n = Number(String(x).replace(",", "."));
  return Number.isFinite(n) ? n : null;
}
function parseDate(yyyymmdd) {
  if (!yyyymmdd || String(yyyymmdd).length !== 8) return null;
  const s = String(yyyymmdd);
  const d = new Date(`${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}
function toISODate(d) {
  return d instanceof Date && !isNaN(d) ? d.toISOString().slice(0, 10) : null;
}

/** Merge helper (in lijn met backend) */
function buildCombined(vehicleRow = {}, fuelRows = []) {
  const v = vehicleRow || {};
  const fuels = Array.isArray(fuelRows) ? fuelRows : [];

  const pickCO2 = (r) => {
    const g = parseNum(r.co2_uitstoot_gecombineerd);
    if (g != null) return g;
    const s = parseNum(r.co2_uitstoot_stad);
    const w = parseNum(r.co2_uitstoot_snelweg);
    if (s != null && w != null) return Math.round((s + w) / 2);
    return s ?? w ?? null;
  };

  const co2Values = fuels.map(pickCO2).filter((x) => x != null);
  const co2_combined = co2Values.length
    ? Math.round(co2Values.reduce((a, b) => a + b, 0) / co2Values.length)
    : null;

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

  const dET = parseDate(v.datum_eerste_toelating);
  const dTT = parseDate(v.datum_tenaamstelling);
  const dAPK = parseDate(v.vervaldatum_apk || v.apk_vervaldatum);

  return {
    kenteken: v.kenteken || null,
    merk: v.merk || null,
    handelsbenaming: v.handelsbenaming || null,
    uitvoering: v.uitvoering || null,
    voertuigsoort: v.voertuigsoort || null,
    eerste_kleur: v.eerste_kleur || null,
    tweede_kleur: v.tweede_kleur || null,

    aantal_cilinders: v.aantal_cilinders ? Number(v.aantal_cilinders) : null,
    cilinderinhoud_cc: v.cilinderinhoud ? Number(v.cilinderinhoud) : null,
    massa_ledig_kg: v.massa_ledig_voertuig ? Number(v.massa_ledig_voertuig) : null,
    massa_rijklaar_kg: v.massa_rijklaar ? Number(v.massa_rijklaar) : null,
    max_massa_kg: v.toegestane_maximum_massa_voertuig ? Number(v.toegestane_maximum_massa_voertuig) : null,

    datum_eerste_toelating: toISODate(dET),
    datum_tenaamstelling: toISODate(dTT),
    apk_vervaldatum: toISODate(dAPK),

    brandstoffen: fuelList,
    co2_gecombineerd_g_km: co2_combined,

    _raw: { vehicle: v, fuels },
  };
}

/** Public RDW fetchers (fallback) */
async function rdwFetchJSON(path, { signal } = {}) {
  const headers = { Accept: "application/json" };
  if (RDW_APP_TOKEN) headers["X-App-Token"] = RDW_APP_TOKEN;
  const r = await fetch(`${RDW_BASE}${path}`, { headers, signal });
  if (!r.ok) throw new Error(`RDW ${path} failed (${r.status})`);
  return r.json();
}
async function fetchVehiclePublic(kenteken, signal) {
  const qs = new URLSearchParams({ kenteken, $limit: "1" }).toString();
  const arr = await rdwFetchJSON(`/m9d7-ebf2.json?${qs}`, { signal });
  return Array.isArray(arr) && arr[0] ? arr[0] : null;
}
async function fetchFuelPublic(kenteken, signal) {
  const qs = new URLSearchParams({ kenteken, $limit: "5" }).toString();
  const arr = await rdwFetchJSON(`/8ys7-d773.json?${qs}`, { signal });
  return Array.isArray(arr) ? arr : [];
}

// Backend fetcher (cookie-first) — probeert /lookup, valt terug op /combined
async function fetchCombinedBackend(kenteken, signal) {
  try {
    // 1) nieuwste route
    const url1 = `/api/rdw/lookup?plate=${encodeURIComponent(kenteken)}`;
    const data1 = await apiGet(url1, { signal });
    if (data1 && (data1._raw || data1.brandstoffen || data1.merk || data1.kenteken)) return data1;
    return buildCombined(data1.vehicle, data1.fuels || data1.brandstof || []);
  } catch (e1) {
    // 404? probeer legacy /combined
    if (e1?.status !== 404) throw e1;
    const url2 = `/api/rdw/combined?kenteken=${encodeURIComponent(kenteken)}`;
    const data2 = await apiGet(url2, { signal });
    if (data2 && (data2._raw || data2.brandstoffen || data2.merk || data2.kenteken)) return data2;
    return buildCombined(data2.vehicle, data2.fuels || data2.brandstof || []);
  }
}

/** Basic in-memory cache */
const CACHE = new Map();

/** Hook */
export default function useRdwCombined(initialKenteken = "", options = {}) {
  const { auto = true, cache = true } = options;
  const [kenteken, setKenteken] = useState(() => normalizePlate(initialKenteken));
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(Boolean(auto && initialKenteken));
  const [error, setError] = useState(null);
  const abortRef = useRef(null);

  const hasCache = useMemo(() => cache && CACHE.has(kenteken), [cache, kenteken]);

  const run = useCallback(
    async (rawPlate) => {
      const k = normalizePlate(rawPlate || kenteken);
      if (!k) {
        setError(null); setData(null); setLoading(false);
        return null;
      }
      if (cache && CACHE.has(k)) {
        const cached = CACHE.get(k);
        setData(cached); setError(null); setLoading(false);
        return cached;
      }

      // cancel eventueel vorige request
      if (abortRef.current) abortRef.current.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;

      setLoading(true);
      setError(null);

      try {
        // 1) backend
        let combined = await fetchCombinedBackend(k, ctrl.signal);
        // 2) fallback publiek RDW
        if (!combined) {
          const [veh, fuels] = await Promise.all([
            fetchVehiclePublic(k, ctrl.signal),
            fetchFuelPublic(k, ctrl.signal),
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
        if (e?.name === "AbortError") return null;
        setError(e);
        setLoading(false);
        return null;
      }
    },
    [kenteken, cache]
  );

  useEffect(() => {
    if (auto && kenteken) run(kenteken);
    else setLoading(false);
    return () => { if (abortRef.current) abortRef.current.abort(); };
  }, [auto, kenteken, run]);

  const refetch = useCallback(async (plateOverride) => {
    const k = normalizePlate(plateOverride || kenteken);
    if (!k) return null;
    if (CACHE.has(k)) CACHE.delete(k);
    return run(k);
  }, [kenteken, run]);

  return {
    kenteken,
    setKenteken,
    data,
    loading,
    error,
    refetch,
    hasCache,
  };
}
