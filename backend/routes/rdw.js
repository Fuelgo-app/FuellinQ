// backend/routes/rdw.js — RDW (Socrata) combined endpoint
// CommonJS (sluit aan op jouw server.js)

const express = require("express");
const axios = require("axios");
const router = express.Router();

/* ────────────────────────────────────────────────────────────
   RDW / Socrata
────────────────────────────────────────────────────────────── */
// ⚠️ Laat RDW_BASE GEEN '/resource' bevatten; dat voegen we in de path toe.
const RDW_BASE = "https://opendata.rdw.nl";
const DS_VEHICLES = process.env.RDW_DATASET_VOERTUIGEN || "m9d7-ebf2";
const DS_FUELS    = process.env.RDW_DATASET_BRANDSTOF   || "8ys7-d773";

const RDW_TIMEOUT_MS   = Number(process.env.RDW_TIMEOUT_MS || 12000);
const RDW_APP_TOKEN    = (process.env.RDW_APP_TOKEN || "").trim();
const RDW_CACHE_TTL_MS = Number(process.env.RDW_CACHE_TTL_MS || 5 * 60 * 1000); // 5 min
const RDW_DEBUG        = String(process.env.RDW_DEBUG || "false") === "true";
const LOG_PREFIX = "[rdw]";

/* ────────────────────────────────────────────────────────────
   Helpers
────────────────────────────────────────────────────────────── */
function dlog(...args) { if (RDW_DEBUG) console.log(LOG_PREFIX, ...args); }

function maskToken(tok) {
  if (!tok) return "(none)";
  const t = String(tok).trim();
  if (t.length <= 6) return "***";
  return `${t.slice(0, 3)}…${t.slice(-3)} (len:${t.length})`;
}

// Normaliseer kenteken zoals RDW het verwacht: uppercase, alleen A-Z/0-9
function normalizePlate(input = "") {
  return String(input).toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function parseNum(x) {
  if (x == null || x === "") return null;
  const n = Number(String(x).replace(",", "."));
  return Number.isFinite(n) ? n : null;
}
function parseDate(yyyymmdd) {
  if (!yyyymmdd || String(yyyymmdd).length !== 8) return null;
  const s = String(yyyymmdd);
  const d = new Date(`${s.slice(0,4)}-${s.slice(4,6)}-${s.slice(6,8)}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}
function toISODate(d) { return d instanceof Date && !isNaN(d) ? d.toISOString().slice(0,10) : null; }

/** Combineer voertuig & brandstofrijen naar een net object */
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

  const dET  = parseDate(v.datum_eerste_toelating);
  const dTT  = parseDate(v.datum_tenaamstelling);
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

/* ────────────────────────────────────────────────────────────
   Axios helpers (met User-Agent + 403 retry zonder token)
────────────────────────────────────────────────────────────── */
function ax(withToken = true) {
  const headers = {
    Accept: "application/json",
    "User-Agent": "FuellinQ/1.0 (+support@fuellinq.app)",
  };
  if (withToken && RDW_APP_TOKEN) headers["X-App-Token"] = RDW_APP_TOKEN;
  return axios.create({ baseURL: RDW_BASE, timeout: RDW_TIMEOUT_MS, headers });
}

async function rdwGet(path, params) {
  try {
    return await ax(true).get(path, { params });
  } catch (e) {
    const status = e?.response?.status;
    if (status === 403 && RDW_APP_TOKEN) {
      return await ax(false).get(path, { params });
    }
    throw e;
  }
}

/* ────────────────────────────────────────────────────────────
   Cache (simpel in-memory, TTL)
────────────────────────────────────────────────────────────── */
const CACHE = new Map(); // key: kenteken, value: { data, expiresAt }
function cacheGet(k) {
  const hit = CACHE.get(k);
  if (!hit) return null;
  if (hit.expiresAt > Date.now()) return hit.data;
  CACHE.delete(k);
  return null;
}
function cacheSet(k, data) {
  CACHE.set(k, { data, expiresAt: Date.now() + RDW_CACHE_TTL_MS });
}

/* ────────────────────────────────────────────────────────────
   Low-level fetchers (met fallback WHERE)
────────────────────────────────────────────────────────── */
async function fetchVehicle(kenteken) {
  // 1) Standaard query (?kenteken=)
  const params1 = { kenteken, $limit: "1" };
  try {
    const { data } = await rdwGet(`/resource/${DS_VEHICLES}.json`, params1);
    dlog("vehicles primary", { ds: DS_VEHICLES, count: Array.isArray(data) ? data.length : 0, kenteken });
    if (Array.isArray(data) && data[0]) return data[0];
  } catch (e) {
    dlog("vehicles primary error", e?.response?.status || e?.code || e?.message);
    throw e;
  }

  // 2) Fallback met SoQL WHERE
  const params2 = { $where: `upper(kenteken)='${kenteken}'`, $limit: "1" };
  const { data: data2 } = await rdwGet(`/resource/${DS_VEHICLES}.json`, params2);
  dlog("vehicles fallback", { ds: DS_VEHICLES, count: Array.isArray(data2) ? data2.length : 0, where: params2.$where });
  return Array.isArray(data2) && data2[0] ? data2[0] : null;
}

async function fetchFuels(kenteken) {
  // 1) Standaard query
  const params1 = { kenteken, $limit: "5" };
  try {
    const { data } = await rdwGet(`/resource/${DS_FUELS}.json`, params1);
    dlog("fuels primary", { ds: DS_FUELS, count: Array.isArray(data) ? data.length : 0, kenteken });
    if (Array.isArray(data) && data.length) return data;
  } catch (e) {
    dlog("fuels primary error", e?.response?.status || e?.code || e?.message);
    throw e;
  }

  // 2) Fallback WHERE
  const params2 = { $where: `upper(kenteken)='${kenteken}'`, $limit: "5" };
  const { data: data2 } = await rdwGet(`/resource/${DS_FUELS}.json`, params2);
  dlog("fuels fallback", { ds: DS_FUELS, count: Array.isArray(data2) ? data2.length : 0, where: params2.$where });
  return Array.isArray(data2) ? data2 : [];
}

/* ────────────────────────────────────────────────────────────
   Shared service
────────────────────────────────────────────────────────────── */
async function getCombinedByPlate(plate) {
  const kenteken = normalizePlate(plate);
  if (!kenteken) {
    const e = new Error("missing_plate"); e.status = 400; throw e;
  }

  const cached = cacheGet(kenteken);
  if (cached) return cached;

  const [vehicle, fuels] = await Promise.all([fetchVehicle(kenteken), fetchFuels(kenteken)]);
  if (!vehicle && (!fuels || fuels.length === 0)) {
    const e = new Error("Kenteken niet gevonden."); e.status = 404; throw e;
  }
  const combined = buildCombined(vehicle || {}, fuels || []);
  cacheSet(kenteken, combined);
  return combined;
}

/* ────────────────────────────────────────────────────────────
   Error mapping helpers
────────────────────────────────────────────────────────────── */
function mapAxiosError(err) {
  const status = err?.response?.status || 0;
  if (err?.code === "ECONNABORTED") return { status: 504, msg: "RDW timeout" };
  if (status === 403)              return { status: 403, msg: "RDW toegang geweigerd (ongeldige token of geblokkeerd)" };
  if (status === 429)              return { status: 429, msg: "RDW rate-limit (te veel verzoeken)" };
  if (status >= 500)               return { status: 502, msg: "RDW service onbereikbaar" };
  return { status: status || 502, msg: "RDW request mislukt" };
}

/* ────────────────────────────────────────────────────────────
   Routes
────────────────────────────────────────────────────────────── */

// Health / info (handig voor debugging & monitoring)
router.get("/_info", (_req, res) => {
  res.json({
    ok: true,
    datasets: { vehicles: DS_VEHICLES, fuels: DS_FUELS },
    rdw_timeout_ms: RDW_TIMEOUT_MS,
    cache_ttl_ms: RDW_CACHE_TTL_MS,
    token_present: Boolean(RDW_APP_TOKEN),
    token_masked: maskToken(RDW_APP_TOKEN),
  });
});

// Simpele health endpoint (200 OK)
router.get("/health", (_req, res) => {
  res.json({ ok: true, up: true, ts: Date.now() });
});

// DEBUG: ruwe RDW-output direct bekijken
router.get("/_raw", async (req, res) => {
  try {
    const raw = req.query.plate || req.query.kenteken || "";
    const kenteken = normalizePlate(raw);
    if (!kenteken) return res.status(400).json({ error: "missing_plate" });

    let vehicleRow, fuelRows;
    try { vehicleRow = await fetchVehicle(kenteken); }
    catch (e) { vehicleRow = { __error: mapAxiosError(e) }; }
    try { fuelRows = await fetchFuels(kenteken); }
    catch (e) { fuelRows = { __error: mapAxiosError(e) }; }

    res.json({
      plate_tried: kenteken,
      ds: { vehicles: DS_VEHICLES, fuels: DS_FUELS },
      vehicle_row: vehicleRow,
      fuel_rows_count: Array.isArray(fuelRows) ? fuelRows.length : null,
      fuel_rows: fuelRows,
      token_present: Boolean(RDW_APP_TOKEN),
      timeout_ms: RDW_TIMEOUT_MS
    });
  } catch (e) {
    const mapped = mapAxiosError(e);
    res.status(mapped.status).json({ error: mapped.msg, detail: e.message || "unknown" });
  }
});

async function handleLookup(req, res) {
  try {
    const raw = req.method === "POST"
      ? (req.body?.plate || req.body?.kenteken || "")
      : (req.query.plate || req.query.kenteken || "");
    dlog("lookup", { method: req.method, raw });

    const out = await getCombinedByPlate(raw);
    return res.json(out);
  } catch (err) {
    const status = err.status || err?.response?.status;
    if (status === 404) {
      return res.status(404).json({
        error: "Kenteken niet gevonden.",
        note: "RDW gaf 0 rijen terug voor voertuigen en brandstof.",
        plate_tried: normalizePlate(req.method === "POST"
          ? (req.body?.plate || req.body?.kenteken || "")
          : (req.query.plate || req.query.kenteken || "")),
        datasets: { vehicles: DS_VEHICLES, fuels: DS_FUELS }
      });
    }
    if (status === 400) return res.status(400).json({ error: "Parameter 'kenteken' ontbreekt of is ongeldig." });

    const mapped = mapAxiosError(err);
    console.error(LOG_PREFIX, "lookup error:", mapped.status, err.message || err);
    return res.status(mapped.status).json({ error: mapped.msg, detail: err.message || "unknown" });
  }
}

// GET /api/rdw/combined?kenteken=XX of ?plate=XX
router.get("/combined", handleLookup);

// GET /api/rdw/lookup?plate=XX of ?kenteken=XX
router.get("/lookup", handleLookup);

// POST /api/rdw/lookup  { plate } of { kenteken }
router.post("/lookup", handleLookup);

module.exports = router;
// Optioneel voor hergebruik elders:
module.exports.getCombinedByPlate = getCombinedByPlate;
