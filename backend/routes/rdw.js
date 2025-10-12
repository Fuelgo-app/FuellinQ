// backend/routes/rdw.js — RDW (Socrata) combined endpoint
// CommonJS (sluit aan op jouw server.js)

const express = require("express");
const axios = require("axios");
const router = express.Router();

/* ────────────────────────────────────────────────────────────
   RDW / Socrata
   Datasets:
   - m9d7-ebf2 : Basisregistratie voertuigen
   - 8ys7-d773 : Brandstofgegevens
────────────────────────────────────────────────────────────── */
const RDW_BASE = "https://opendata.rdw.nl/resource";
const DS_VEHICLES = "m9d7-ebf2";
const DS_FUELS = "8ys7-d773";

const RDW_TIMEOUT_MS = Number(process.env.RDW_TIMEOUT_MS || 3500);
const RDW_APP_TOKEN = (process.env.RDW_APP_TOKEN || "").trim();
const RDW_CACHE_TTL_MS = Number(process.env.RDW_CACHE_TTL_MS || 5 * 60 * 1000); // 5 min
const LOG_PREFIX = "[rdw]";

/* ────────────────────────────────────────────────────────────
   Helpers
────────────────────────────────────────────────────────────── */
function maskToken(tok) {
  if (!tok) return "(none)";
  const t = String(tok).trim();
  if (t.length <= 6) return "***";
  return `${t.slice(0, 3)}…${t.slice(-3)} (len:${t.length})`;
}

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
  const iso = `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
  const d = new Date(iso + "T00:00:00Z");
  return Number.isNaN(d.getTime()) ? null : d;
}
function toISODate(d) {
  return d instanceof Date && !isNaN(d) ? d.toISOString().slice(0, 10) : null;
}

/** Combineer voertuig & brandstofrijen naar een net object (zelfde vorm als de hook) */
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

/* ────────────────────────────────────────────────────────────
   Axios client
────────────────────────────────────────────────────────────── */
const RDW = axios.create({
  baseURL: `${RDW_BASE}`,
  timeout: RDW_TIMEOUT_MS,
  headers: {
    Accept: "application/json",
    ...(RDW_APP_TOKEN ? { "X-App-Token": RDW_APP_TOKEN } : {}),
  },
});

/* ────────────────────────────────────────────────────────────
   Cache (simpel in-memory, TTL)
────────────────────────────────────────────────────────────── */
const CACHE = new Map(); // key: kenteken, value: { data, expiresAt }

function cacheGet(kenteken) {
  const hit = CACHE.get(kenteken);
  if (!hit) return null;
  if (hit.expiresAt && hit.expiresAt > Date.now()) return hit.data;
  CACHE.delete(kenteken);
  return null;
}
function cacheSet(kenteken, data) {
  CACHE.set(kenteken, { data, expiresAt: Date.now() + RDW_CACHE_TTL_MS });
}

/* ────────────────────────────────────────────────────────────
   Low-level fetchers
────────────────────────────────────────────────────────────── */
async function fetchVehicle(kenteken) {
  const qs = new URLSearchParams({ kenteken, $limit: "1" }).toString();
  const { data } = await RDW.get(`/resource/${DS_VEHICLES}.json?${qs}`);
  return Array.isArray(data) && data[0] ? data[0] : null;
}
async function fetchFuels(kenteken) {
  const qs = new URLSearchParams({ kenteken, $limit: "5" }).toString();
  const { data } = await RDW.get(`/resource/${DS_FUELS}.json?${qs}`);
  return Array.isArray(data) ? data : [];
}

/* ────────────────────────────────────────────────────────────
   Routes
────────────────────────────────────────────────────────────── */

/** GET /api/rdw/combined?kenteken=XX
 *  - 200: combined object
 *  - 404: niet gevonden (frontend mag fallback doen)
 */
router.get("/combined", async (req, res) => {
  try {
    const raw = req.query.kenteken || "";
    const kenteken = normalizePlate(raw);
    if (!kenteken) return res.status(400).json({ error: "Parameter 'kenteken' ontbreekt of is ongeldig." });

    // cache
    const cached = cacheGet(kenteken);
    if (cached) {
      return res.json(cached);
    }

    // fetch beide datasets
    const [vehicle, fuels] = await Promise.all([fetchVehicle(kenteken), fetchFuels(kenteken)]);

    if (!vehicle && (!fuels || fuels.length === 0)) {
      return res.status(404).json({ error: "Kenteken niet gevonden." });
    }

    const combined = buildCombined(vehicle || {}, fuels || []);
    cacheSet(kenteken, combined);

    return res.json(combined);
  } catch (err) {
    const status = err?.response?.status || 500;
    const msg = err?.response?.data?.error || err?.message || "RDW fout";
    console.error(LOG_PREFIX, "combined error:", status, msg);
    // Bij 404 uit RDW → geef 404 door
    if (status === 404) return res.status(404).json({ error: "Kenteken niet gevonden." });
    return res.status(502).json({ error: "RDW service onbereikbaar", detail: msg });
  }
});

/** GET /api/rdw/raw?kenteken=XX
 *  Handig voor debuggen in development.
 */
router.get("/raw", async (req, res) => {
  try {
    const raw = req.query.kenteken || "";
    const kenteken = normalizePlate(raw);
    if (!kenteken) return res.status(400).json({ error: "Parameter 'kenteken' ontbreekt of is ongeldig." });

    const [vehicle, fuels] = await Promise.all([fetchVehicle(kenteken), fetchFuels(kenteken)]);
    if (!vehicle && (!fuels || fuels.length === 0)) {
      return res.status(404).json({ error: "Kenteken niet gevonden." });
    }
    return res.json({ vehicle, fuels });
  } catch (err) {
    const status = err?.response?.status || 500;
    const msg = err?.response?.data?.error || err?.message || "RDW fout";
    console.error(LOG_PREFIX, "raw error:", status, msg);
    if (status === 404) return res.status(404).json({ error: "Kenteken niet gevonden." });
    return res.status(502).json({ error: "RDW service onbereikbaar", detail: msg });
  }
});

/** Optioneel healthcheck */
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

module.exports = router;
