// routes/parking.js  (CommonJS)
// Per-stad parkeerzones (Amsterdam + Almere), geocoding en simpele parkeersessies (in-memory)

const express = require("express");
const router = express.Router();
const { randomUUID } = require("crypto");
const fs = require("fs");
const path = require("path");

// ---- fetch fallback: Node 18+ heeft global fetch; op oudere Node gebruiken we node-fetch v2
let fetchFn = globalThis.fetch;
if (!fetchFn) {
  try { fetchFn = require("node-fetch"); } catch {}
}
const fetch = (...args) => fetchFn(...args);

// ---- compacte imports
const proj4 = require("proj4");
const turf = require("@turf/turf");
let uniqBy;
try { uniqBy = require("lodash.uniqby"); } catch { uniqBy = (arr, k) => Array.from(new Map(arr.map(o => [o[k], o])).values()); }

/* ───────────────────── CRS helpers ───────────────────── */
// RD New (EPSG:28992) → WGS84
const EPSG28992 =
  "+proj=sterea +lat_0=52.15616055555555 +lon_0=5.38763888888889 " +
  "+k=0.9999079 +x_0=155000 +y_0=463000 +ellps=bessel " +
  "+towgs84=565.2369,50.0087,465.658,-0.406857,0.350733,-1.87035,4.0812 +units=m +no_defs";

const toWgs = ([x, y]) => proj4(EPSG28992, proj4.WGS84, [x, y]); // [lng, lat]
const isRD = (x, y) => x > 10000 && x < 300000 && y > 300000 && y < 650000;

const asLatLngRingFromAny = (coords) => {
  if (!coords?.length) return null;
  const [x0, y0] = coords[0] || [];
  const ringLngLat = isRD(x0, y0) ? coords.map(([x, y]) => toWgs([x, y])) : coords;
  return ringLngLat.map(([lng, lat]) => [lat, lng]); // Leaflet shape
};

/* ───────────────────── Cache / state ───────────────────── */
const CITY_ZONES = { amsterdam: [], almere: [] }; // per-stad datasets
let ZONES = [];                          // legacy/global fallback (mock)
const SESSIONS = new Map();              // in-memory parkeersessies

/* ───────────────────── Local bestanden ───────────────────── */
const LOCAL_AMS_FILE = path.join(__dirname, "..", "data", "amsterdam_parking.geojson");
const LOCAL_ALM_FILE = path.join(__dirname, "..", "data", "almere_parking.geojson");

// eenvoudige bboxen om snel de stad te kiezen
const BBOX = {
  amsterdam: { minLat: 52.25, maxLat: 52.45, minLng: 4.70, maxLng: 5.10 },
  almere:    { minLat: 52.25, maxLat: 52.50, minLng: 5.00, maxLng: 5.40 },
};
function inBox(lat, lng, b) {
  return lat >= b.minLat && lat <= b.maxLat && lng >= b.minLng && lng <= b.maxLng;
}
function pickCity(lat, lng) {
  if (inBox(lat, lng, BBOX.almere)) return "almere";
  if (inBox(lat, lng, BBOX.amsterdam)) return "amsterdam";
  return "amsterdam"; // default
}

/* ───────────────────── (optioneel) Remote bronnen (nu uit) ─────────────────────
   Je kunt deze later weer aanzetten als je een betrouwbare URL hebt.  */
// const AMSTERDAM_SOURCES = [
//   { type: "arcgis", base: "https://maps.amsterdam.nl/arcgis/rest/services/Publiek/Betaald_Parkeren/MapServer" },
//   { type: "arcgis", base: "https://maps.amsterdam.nl/arcgis/rest/services/Publiek/Parkeersectoren/MapServer" },
//   { type: "geojson", url: "https://maps.amsterdam.nl/open_geodata/geojson_lnglat.php?KAARTLAAG=GEBIEDEN_BETAALD_PARKEREN&THEMA=parkeer" },
//   { type: "geojson", url: "https://maps.amsterdam.nl/open_geodata/geojson_lnglat.php?KAARTLAAG=PARKEERSECTOREN&THEMA=parkeer" },
// ];
async function discoverArcGisGeoJSON(baseUrl) {
  const infoUrl = `${baseUrl}?f=pjson`;
  const infoRes = await fetch(infoUrl);
  if (!infoRes.ok) throw new Error(`ArcGIS info ${infoRes.status} @ ${infoUrl}`);
  const info = await infoRes.json();
  const allLayers = [...(info.layers || []), ...(info.subLayers || [])];
  if (!allLayers.length) throw new Error(`ArcGIS: geen layers in ${baseUrl}`);
  let layer = allLayers.find(l => /polygon/i.test(l?.geometryType || "")) || allLayers[0];
  const layerId = layer.id;
  const q = new URL(`${baseUrl}/${layerId}/query`);
  q.searchParams.set("where", "1=1");
  q.searchParams.set("outFields", "*");
  q.searchParams.set("outSR", "4326");
  q.searchParams.set("f", "geojson");
  const dataRes = await fetch(q.toString());
  if (!dataRes.ok) throw new Error(`ArcGIS query ${dataRes.status} @ ${q}`);
  const gj = await dataRes.json();
  if (!gj?.features?.length) throw new Error(`ArcGIS: geen features in ${q}`);
  return gj;
}

/* ───────────────────── Normalisatie ───────────────────── */
function normalizeAmsterdamFeatures(gj) {
  const zones = [];
  for (const f of gj.features || []) {
    const props = f.properties || {};
    const g = f.geometry;
    let ringLatLng = null;

    if (g?.type === "Polygon") {
      const ring = g.coordinates?.[0];
      ringLatLng = asLatLngRingFromAny(ring);
    } else if (g?.type === "MultiPolygon") {
      const polys = g.coordinates || [];
      const largest = polys.sort((a, b) => (b?.[0]?.length ?? 0) - (a?.[0]?.length ?? 0))[0]?.[0] || [];
      ringLatLng = asLatLngRingFromAny(largest);
    } else continue;

    if (!ringLatLng) continue;

    const turfPoly = turf.polygon([ringLatLng.map(([la, lo]) => [lo, la])]);
    const centroid = turf.centroid(turfPoly).geometry.coordinates; // [lng, lat]

    zones.push({
      id: String(props.id || props.ID || props.code || props.sector || props.CODE || Math.random()),
      provider: "Gemeente",
      name: props.naam || props.Naam || props.gebied || props.sector || "Parkeergebied",
      code: props.sector || props.SECTOR || props.CODE || null,
      price_per_hour: null,
      max_hours: null,
      currency: "EUR",
      coords: { lat: centroid[1], lng: centroid[0] },
      polygon: ringLatLng,
    });
  }
  return uniqBy(zones, "id");
}

/* ───────────────────── Mock (fallback) ───────────────────── */
function makeMockZones(center) {
  const base = center || { lat: 52.3702, lng: 4.8952 };
  const mk = (i, dx, dy, price) => {
    const c = { lat: base.lat + dx, lng: base.lng + dy };
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
  return [mk(1, 0.002, 0.003, 1.89), mk(2, -0.001, 0.002, 2.10), mk(3, 0.003, -0.002, 2.49), mk(4, -0.004, -0.001, 1.99)];
}

/* ───────────────────── Loaders per stad ───────────────────── */
async function loadFromLocal(filePath) {
  if (!fs.existsSync(filePath)) return null;
  const j = JSON.parse(fs.readFileSync(filePath, "utf8"));
  if (!j?.features?.length) return null;
  return normalizeAmsterdamFeatures(j); // werkt ook voor Almere zolang props id/naam/sector heten
}

async function loadCity(name) {
  try {
    if (name === "amsterdam") {
      const local = await loadFromLocal(LOCAL_AMS_FILE);
      if (local?.length) { CITY_ZONES.amsterdam = local; console.log("[parking] AMS local:", local.length); return; }
      // hier kun je desgewenst remote AMS bronnen proberen (ArcGIS/GeoJSON)
    }
    if (name === "almere") {
      const local = await loadFromLocal(LOCAL_ALM_FILE);
      if (local?.length) { CITY_ZONES.almere = local; console.log("[parking] ALM local:", local.length); return; }
    }
  } catch (e) {
    console.warn(`[parking] loadCity(${name}) failed:`, e.message);
  }
}

/* ───────────────────── Boot ───────────────────── */
(async function boot() {
  // laad beide steden; ZONES fallback op mock voor dev
  await Promise.all([loadCity("amsterdam"), loadCity("almere")]);
  if (!CITY_ZONES.amsterdam.length && !CITY_ZONES.almere.length) {
    ZONES = makeMockZones();
    console.warn("[parking] geen lokale city-geojsons gevonden → mock actief");
  }
  setInterval(() => { loadCity("amsterdam"); loadCity("almere"); }, 6 * 60 * 60 * 1000);
})();

/* ───────────────────── Helpers ───────────────────── */
function zonesAroundFrom(zones, lat, lng, km = 3) {
  const here = turf.point([lng, lat]);
  const within = [];
  for (const z of zones || []) {
    const poly = turf.polygon([z.polygon.map(([la, lo]) => [lo, la])]);
    const dist = turf.distance(here, turf.point([z.coords.lng, z.coords.lat])); // km
    if (dist > km) continue;
    // stricte hit: alleen als de gebruiker in de polygon valt
    if (turf.booleanPointInPolygon(here, poly)) within.push(z);
  }
  return within;
}

function estimatePriceEUR(zone, startedAtISO, stoppedAtISO = new Date().toISOString()) {
  const start = new Date(startedAtISO).getTime();
  const stop = new Date(stoppedAtISO).getTime();
  const seconds = Math.max(0, Math.floor((stop - start) / 1000));
  const hours = seconds / 3600;
  const p = Number(zone?.price_per_hour ?? 2.0);
  return { seconds, price: Math.round(p * hours * 100) / 100 };
}

/* ───────────────────── API ───────────────────── */
// Zones rond een punt (kiest dataset op basis van bbox)
router.get("/zones", (req, res) => {
  const lat = parseFloat(req.query.lat);
  const lng = parseFloat(req.query.lng);
  if (!isFinite(lat) || !isFinite(lng)) return res.status(400).json({ error: "lat/lng required" });

  const city = pickCity(lat, lng);
  const base = CITY_ZONES[city]?.length ? CITY_ZONES[city] : ZONES;
  return res.json({ zones: zonesAroundFrom(base, lat, lng, 3), city });
});

// Tekst-zoek → geocode → kies stad → zones rondom
router.get("/search", async (req, res) => {
  const q = String(req.query.q || "").trim();
  if (!q) return res.json({ zones: [] });

  let lat, lng;

  // 1) Mapbox (als backend .env MAPBOX_TOKEN heeft)
  const token = process.env.MAPBOX_TOKEN;
  if (token) {
    try {
      const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(q)}.json?access_token=${token}&limit=1&language=nl`;
      const g = await (await fetch(url)).json();
      [lng, lat] = g?.features?.[0]?.center || [];
    } catch (e) {
      console.warn("[parking] mapbox geocode error:", e.message);
    }
  }

  // 2) OSM/Nominatim fallback
  if (!isFinite(lat) || !isFinite(lng)) {
    try {
      const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1&accept-language=nl`;
      const r = await fetch(url, { headers: { "User-Agent": "fuellinq/1.0 (contact@fuellinq.app)" } });
      const jj = await r.json();
      lat = parseFloat(jj?.[0]?.lat);
      lng = parseFloat(jj?.[0]?.lon);
    } catch (e) {
      console.warn("[parking] nominatim geocode error:", e.message);
    }
  }

  if (!isFinite(lat) || !isFinite(lng)) return res.json({ zones: [] });

  const city = pickCity(lat, lng);
  const base = CITY_ZONES[city]?.length ? CITY_ZONES[city] : ZONES;
  return res.json({ zones: zonesAroundFrom(base, lat, lng, 3), center: { lat, lng }, city });
});

// Start parkeersessie (in-memory)
router.post("/sessions", express.json(), (req, res) => {
  const { zone_id, plate } = req.body || {};
  if (!zone_id || !plate) return res.status(400).json({ error: "missing_fields" });

  const zone =
    CITY_ZONES.amsterdam.find(z => z.id === zone_id) ||
    CITY_ZONES.almere.find(z => z.id === zone_id) ||
    ZONES.find(z => z.id === zone_id) ||
    ZONES[0] || makeMockZones()[0];

  const sess = {
    id: randomUUID(),
    zone,
    plate,
    started_at: new Date().toISOString(),
    status: "active",
  };
  SESSIONS.set(sess.id, sess);
  res.json(sess);
});

// Stop parkeersessie
router.post("/sessions/:id/stop", (req, res) => {
  const id = String(req.params.id);
  const sess = SESSIONS.get(id);
  if (!sess) return res.status(404).json({ error: "not_found" });

  const stopped_at = new Date().toISOString();
  const { seconds, price } = estimatePriceEUR(sess.zone, sess.started_at, stopped_at);

  sess.status = "stopped";
  sess.stopped_at = stopped_at;
  sess.total_seconds = seconds;
  sess.total_eur = price;

  res.json({
    id: sess.id,
    status: sess.status,
    started_at: sess.started_at,
    stopped_at,
    total_seconds: seconds,
    total_eur: price,
    currency: "EUR",
  });
});

module.exports = router;
