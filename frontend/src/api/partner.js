// src/api/partner.js  — frontend/Vite (sluit aan op src/api/base.js)

import { API_BASE, apiFetch } from "./base";

// ───────────────── helpers ─────────────────
function authHeaders() {
  const token = localStorage.getItem("token") || "";
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// apiFetch wrapper die Auth meestuurt (en verder base.js laat afhandelen)
function request(path, opts = {}) {
  const { headers = {}, ...rest } = opts;
  return apiFetch(path, {
    ...rest,
    headers: { ...headers, ...authHeaders() },
  });
}

/* ───────────── Partner utils ───────────── */
export function addressLookup({ zip, number, addition } = {}) {
  const q = new URLSearchParams();
  if (zip) q.set("zip", String(zip).trim());
  if (number) q.set("number", String(number).trim());
  if (addition) q.set("addition", String(addition).trim());
  return request(`/api/partner/address-lookup?${q.toString()}`);
}
export const geocodeZip = addressLookup;

/* ───────────── Stations ───────────── */
export const listStations = () => request("/api/partner/stations");

export const createStationSmart = ({ postcode, number, addition, title }) =>
  request("/api/partner/stations/smart-create", {
    method: "POST",
    body: { postcode, number, addition, title },
  });

export const createStation = (payload) =>
  request("/api/partner/stations", { method: "POST", body: payload });

export const updateStation = (id, patch) =>
  request(`/api/partner/stations/${id}`, { method: "PATCH", body: patch });

export const enrichStationFromZip = (id, { postcode, number, addition }) =>
  request(`/api/partner/stations/${id}/address-from-zip`, {
    method: "PATCH",
    body: { postcode, number, addition },
  });

export function stationsNearby({ lat, lng, radius_km = 10, limit = 50 }) {
  const q = new URLSearchParams({
    lat: String(lat),
    lng: String(lng),
    radius_km: String(radius_km),
    limit: String(limit),
  });
  return request(`/api/partner/stations/nearby?${q.toString()}`);
}

/* ───────────── Fuel prices ───────────── */
export function getFuelPrices(params = {}) {
  const q = new URLSearchParams();
  if (params.station_id) q.set("station_id", String(params.station_id));
  if (params.fuel_type) q.set("fuel_type", String(params.fuel_type));
  if (params.latest) q.set("latest", "true");
  const s = q.toString();
  return request(`/api/partner/fuel-prices${s ? `?${s}` : ""}`);
}

export const createFuelPrice = ({ station_id, fuel_type, price_eur_l }) =>
  request("/api/partner/fuel-prices", {
    method: "POST",
    body: { station_id, fuel_type, price_eur_l },
  });

// Compat
export const getLatestPrices = (station_id) =>
  getFuelPrices({ station_id, latest: true });

export const getStationPrices = (station_id) =>
  getFuelPrices({ station_id });

/* ───────────── Offers ───────────── */
export function listOffers(params = {}) {
  const q = new URLSearchParams();
  if (params.station_id) q.set("station_id", String(params.station_id));
  if (params.status) q.set("status", String(params.status));
  if (params.only_current) q.set("only_current", "true");
  const s = q.toString();
  return request(`/api/partner/offers${s ? `?${s}` : ""}`);
}

export const createOffer = (payload) =>
  request("/api/partner/offers", { method: "POST", body: payload });

export const updateOffer = (id, patch) =>
  request(`/api/partner/offers/${id}`, { method: "PATCH", body: patch });

export const toggleOffer = (id) =>
  request(`/api/partner/offers/${id}/toggle`, { method: "POST" });

/* ───────────── Upload (multipart) ─────────────
   Let op: niet via apiFetch i.v.m. Content-Type/FormData */
export async function uploadImage(file) {
  const fd = new FormData();
  fd.append("image", file);
  const res = await fetch(`${API_BASE}/api/partner/upload`, {
    method: "POST",
    headers: { ...authHeaders() }, // géén Content-Type hier zetten
    body: fd,
    credentials: "include",
  });

  // base.js parse-logica is hier niet beschikbaar; handmatig afhandelen:
  const ct = res.headers.get("content-type") || "";
  const data = ct.includes("application/json") ? await res.json() : { ok: res.ok };
  if (!res.ok) {
    const msg = data?.error || data?.message || `Upload failed (${res.status})`;
    const err = new Error(msg);
    err.status = res.status;
    err.payload = data;
    throw err;
  }
  return data; // verwacht: { url, filename, size, mime, ok }
}

/* ───────────── Public feed ───────────── */
export const publicStations = (q = "") =>
  request(`/api/partner/public/stations${q ? `?q=${encodeURIComponent(q)}` : ""}`);

/* ───────────── Compat stub (templates) ───────────── */
export function listOfferTemplates() {
  return Promise.resolve([
    { key: "coffee",   title: "Gratis koffie",         description: "Eén gratis koffie bij elke tankbeurt." },
    { key: "wash",     title: "Autowas €5,-",          description: "Carwash voor slechts €5 dit weekend." },
    { key: "sandwich", title: "Broodje + drank €6,99", description: "Kies je favoriete broodje + drankje." },
  ]);
}

export { API_BASE };
