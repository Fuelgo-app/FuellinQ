// src/api/public.js — FuellinQ / FuelGo publieke API helpers

export const API_BASE =
  (import.meta?.env?.VITE_API_URL) || "http://localhost:3000";

/**
 * Interne helper om veilig fetch uit te voeren en JSON te parsen
 */
async function safeFetch(url, options = {}) {
  const res = await fetch(url, {
    method: options.method || "GET",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    credentials: "include",
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Public API ${res.status} ${res.statusText}: ${text.slice(0, 200)}`);
  }

  const ct = res.headers.get("content-type") || "";
  return ct.includes("application/json") ? res.json() : res.text();
}

/**
 * Haal alle publieke tankstations op
 * @param {Object} params - optionele zoekparameters (bijv. lat, lon, radius)
 */
export async function fetchPublicStations(params = {}) {
  const url = new URL(`${API_BASE}/api/partner/public/stations`);
  Object.entries(params).forEach(([k, v]) => v != null && url.searchParams.set(k, v));
  return safeFetch(url);
}

/**
 * Haal alle publieke aanbiedingen op
 * @param {Object} params - optionele zoekparameters (bijv. stationId, type, active)
 */
export async function fetchPublicOffers(params = {}) {
  const url = new URL(`${API_BASE}/api/partner/public/offers`);
  Object.entries(params).forEach(([k, v]) => v != null && url.searchParams.set(k, v));
  return safeFetch(url);
}
