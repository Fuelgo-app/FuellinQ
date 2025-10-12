// src/lib/apiCo2.js
// Reusable API helpers for CO₂ + brandstof + RDW lookup + auth utils

const RAW_API = (import.meta.env.VITE_API_URL ?? "").trim();
export const API_BASE = (RAW_API && RAW_API !== "/" ? RAW_API : "http://localhost:3000").replace(/\/+$/, "");

/* ---------------- auth helpers ---------------- */
export function getToken() {
  try { return localStorage.getItem("token") || ""; } catch { return ""; }
}
export function setToken(token) {
  try {
    if (token) localStorage.setItem("token", token);
    else localStorage.removeItem("token");
  } catch {}
  return getToken();
}
export function clearToken() { return setToken(""); }
export function authHeader() {
  const t = getToken();
  return t ? { Authorization: `Bearer ${t}` } : {};
}

/* ---------------- generic fetch wrappers ---------------- */
async function apiGet(path) {
  const r = await fetch(`${API_BASE}${path}`, {
    headers: { ...authHeader() },
    credentials: "include",
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data?.error || `GET ${path} failed (${r.status})`);
  return data;
}
async function apiPost(path, body) {
  const r = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeader() },
    credentials: "include",
    body: JSON.stringify(body ?? {}),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data?.error || `POST ${path} failed (${r.status})`);
  return data;
}
async function apiPut(path, body) {
  const r = await fetch(`${API_BASE}${path}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", ...authHeader() },
    credentials: "include",
    body: JSON.stringify(body ?? {}),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data?.error || `PUT ${path} failed (${r.status})`);
  return data;
}
async function apiDelete(path) {
  const r = await fetch(`${API_BASE}${path}`, {
    method: "DELETE",
    headers: { ...authHeader() },
    credentials: "include",
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data?.error || `DELETE ${path} failed (${r.status})`);
  return data;
}

/* ---------------- CO2: vehicles / odometer / summary ---------------- */
export async function getVehicles() {
  return apiGet(`/api/co2/vehicles`);
}

export async function addOdometer({ vehicleId, km, date }) {
  const payload = {
    vehicle_id: vehicleId,
    odometer_km: Number(km),
    date: date || new Date().toISOString().slice(0, 10),
  };
  return apiPost(`/api/co2/odometer`, payload);
}
export async function listOdometers(vehicleId) {
  const qs = new URLSearchParams({ vehicle_id: vehicleId });
  return apiGet(`/api/co2/odometer?${qs.toString()}`);
}

export async function getCO2Summary(params = {}) {
  const qs = new URLSearchParams(params);
  const suf = qs.toString() ? `?${qs.toString()}` : "";
  return apiGet(`/api/co2/summary${suf}`);
}
// Alias: sommige UI-files importeren getCo2Summary (kleine 'o')
export function getCo2Summary(params = {}) {
  return getCO2Summary(params);
}

/* ---------- Preview (met fallback naar summary) ---------- */
export async function getPreview(params = {}) {
  const qs = new URLSearchParams(params);
  const suf = qs.toString() ? `?${qs.toString()}` : "";
  try {
    return await apiGet(`/api/co2/preview${suf}`);
  } catch (_) {
    return getCO2Summary({ ...params, preview: 1 });
  }
}

/* ---------- Grouped aggregations (day / month / year) ---------- */
async function tryGroup(path, params, group) {
  const qs = new URLSearchParams(params || {});
  const suf = qs.toString() ? `?${qs.toString()}` : "";
  try {
    return await apiGet(`${path}${suf}`); // e.g. /api/co2/monthly
  } catch (_) {
    // Fallback naar summary met group=...
    const p2 = new URLSearchParams({ ...(params || {}), group });
    const s2 = p2.toString() ? `?${p2.toString()}` : "";
    return apiGet(`/api/co2/summary${s2}`);
  }
}

export function getCo2ByDay(params = {}) {
  return tryGroup(`/api/co2/daily`, params, "day");
}
export function getCo2ByMonth(params = {}) {
  return tryGroup(`/api/co2/monthly`, params, "month");
}
export function getCo2ByYear(params = {}) {
  return tryGroup(`/api/co2/yearly`, params, "year");
}

/* ---------- Report (JSON) + downloadbare variant (PDF/CSV) ---------- */
export async function getReport(params = {}) {
  const qs = new URLSearchParams(params);
  const suf = qs.toString() ? `?${qs.toString()}` : "";
  return apiGet(`/api/co2/report${suf}`);
}

export async function getReportFile(format = "pdf", params = {}) {
  const qs = new URLSearchParams(params);
  const suf = qs.toString() ? `?${qs.toString()}` : "";
  const r = await fetch(`${API_BASE}/api/co2/report.${format}${suf}`, {
    headers: { ...authHeader() },
    credentials: "include",
  });
  if (!r.ok) throw new Error(`GET /api/co2/report.${format} failed (${r.status})`);
  return await r.blob();
}

/* ---------------- Fuel transactions ---------------- */
export async function addFuelTx({
  vehicleId,
  liters,
  totalEur,
  pricePerL,
  date,
  stationId,
  odometerKm,
}) {
  const payload = {
    vehicle_id: vehicleId,
    liters: Number(liters),
    total_eur: Number(totalEur),
    price_per_l: pricePerL != null ? Number(pricePerL) : undefined,
    date: date || new Date().toISOString().slice(0, 10),
    station_id: stationId ?? undefined,
    odometer_km: odometerKm != null ? Number(odometerKm) : undefined,
  };
  return apiPost(`/api/co2/fuel`, payload);
}

export async function listFuelTx({ vehicleId, from, to, limit, offset } = {}) {
  const qs = new URLSearchParams();
  if (vehicleId) qs.set("vehicle_id", vehicleId);
  if (from) qs.set("from", from);
  if (to) qs.set("to", to);
  if (limit != null) qs.set("limit", String(limit));
  if (offset != null) qs.set("offset", String(offset));
  const suf = qs.toString() ? `?${qs.toString()}` : "";
  return apiGet(`/api/co2/fuel${suf}`);
}

export async function updateFuelTx(id, patch) {
  return apiPut(`/api/co2/fuel/${id}`, patch || {});
}
export async function deleteFuelTx(id) {
  return apiDelete(`/api/co2/fuel/${id}`);
}

/* ---------------- RDW lookup ---------------- */
function normalizePlate(input) {
  return String(input || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

export async function lookupVehicle({ plate }) {
  const p = normalizePlate(plate);
  if (!p) throw new Error("Kenteken ontbreekt");

  try {
    return await apiGet(`/api/rdw/lookup?plate=${encodeURIComponent(p)}`);
  } catch (_) {}

  try {
    return await apiGet(`/api/rdw/vehicle?plate=${encodeURIComponent(p)}`);
  } catch (_) {}

  return apiGet(`/api/co2/rdw/lookup?plate=${encodeURIComponent(p)}`);
}

/* --------------- default export (convenience) --------------- */
export default {
  API_BASE,
  // auth
  getToken,
  setToken,
  clearToken,
  authHeader,
  // vehicles & summary/preview
  getVehicles,
  getCO2Summary,
  getCo2Summary,
  getPreview,
  // grouped aggregations
  getCo2ByDay,
  getCo2ByMonth,
  getCo2ByYear,
  // reports
  getReport,
  getReportFile,
  // odometer
  addOdometer,
  listOdometers,
  // fuel tx
  addFuelTx,
  listFuelTx,
  updateFuelTx,
  deleteFuelTx,
  // rdw
  lookupVehicle,
};
