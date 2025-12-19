// src/api/base.js
// Reusable API helpers — COOKIE-FIRST (geen automatische Bearer header).
// Server gebruikt primair een HttpOnly cookie. Alle fetches sturen credentials mee.

/* ─────────────────────────────────────────────────────────────
   API_BASE
   - 1) VITE_API_URL als die gezet is
   - 2) Slim raden: prod -> https://api.fuellinq.app, dev -> http://localhost:3000
───────────────────────────────────────────────────────────── */
const RAW_API = (import.meta.env.VITE_API_URL ?? "").trim();

function guessApiBase() {
  if (typeof window === "undefined") return "http://localhost:3000";
  const host = window.location.hostname.toLowerCase();
  if (host.endsWith("fuellinq.app")) return "https://api.fuellinq.app";
  return "http://localhost:3000";
}

export const API_BASE = (RAW_API && RAW_API !== "/" ? RAW_API : guessApiBase()).replace(/\/+$/, "");

// Optioneel: zichtbaar in console voor debug
if (typeof window !== "undefined") {
  try { window.API_BASE = API_BASE; } catch {}
}

/* ─────────────────────────────────────────────────────────────
   Token helpers  (compat — niet meer automatisch gebruikt)
   - COOKIE-FIRST: token in localStorage is optioneel
───────────────────────────────────────────────────────────── */
const TOKEN_KEY = "token";

export const getToken = () => {
  try { return localStorage.getItem(TOKEN_KEY) || ""; } catch { return ""; }
};

export const setToken = (jwt) => {
  try {
    if (jwt) localStorage.setItem(TOKEN_KEY, jwt);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {}
  return jwt || "";
};

export const clearToken = () => setToken("");

// COOKIE-FIRST: standaard géén Authorization header meesturen.
export const authHeader = () => {
  const t = ""; // bewust niet automatisch lezen
  return t ? { Authorization: `Bearer ${t}` } : {};
};

// Voor incidentele calls met Bearer (optioneel te gebruiken)
export const withBearer = (token, headers = {}) =>
  token ? { ...headers, Authorization: `Bearer ${token}` } : headers;

/* ─────────────────────────────────────────────────────────────
   Utils
───────────────────────────────────────────────────────────── */
const isFormData = (v) => typeof FormData !== "undefined" && v instanceof FormData;

export const buildQS = (obj = {}) => {
  const u = new URLSearchParams();
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null || v === "") continue;
    Array.isArray(v) ? v.forEach((it) => u.append(k, it)) : u.set(k, String(v));
  }
  const s = u.toString();
  return s ? `?${s}` : "";
};

const parseResponse = async (res) => {
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("application/json")) {
    try { return await res.json(); } catch { return {}; }
  }
  try { return await res.text(); } catch { return ""; }
};

// Cookie-first: stuur NOOIT automatisch Bearer mee
function shouldAttachAuth(_fullUrlOrPath) {
  return false;
}

// Zorg dat relative paths een leading slash hebben
function normalizePath(path) {
  if (!path) return "/";
  if (/^https?:\/\//i.test(path)) return path;
  return path.startsWith("/") ? path : `/${path}`;
}

/* ─────────────────────────────────────────────────────────────
   apiFetch
   - Voegt API_BASE toe
   - Zet JSON headers/body automatisch (behalve bij FormData)
   - Standaard GEEN Bearer header (cookie-first)
   - 401 ⇒ token wissen (geen globale redirect)
   - Heldere foutmelding bij netwerk/mixed-content/CORS issues
───────────────────────────────────────────────────────────── */
export async function apiFetch(path, opts = {}) {
  const norm = normalizePath(path);
  const url = /^https?:\/\//i.test(norm) ? norm : `${API_BASE}${norm}`;

  const headers = { ...(opts.headers || {}) };
  if (shouldAttachAuth(norm)) Object.assign(headers, authHeader());

  let body = opts.body;
  if (body && !isFormData(body) && typeof body === "object") {
    headers["Content-Type"] = headers["Content-Type"] || "application/json";
    body = JSON.stringify(body);
  }

  let res;
  try {
    res = await fetch(url, {
      method: opts.method || "GET",
      headers,
      credentials: "include", // ← cookies meesturen
      body,
      signal: opts.signal,
      cache: opts.cache,
      mode: opts.mode,
      keepalive: opts.keepalive,
    });
  } catch (e) {
    const hint =
      typeof window !== "undefined" &&
      window.location.protocol === "https:" &&
      url.startsWith("http://")
        ? "Browser blokkeert onveilige HTTP call vanaf HTTPS (mixed content)."
        : "Netwerk/CORS-preflight fout (geen response ontvangen).";
    const err = new Error(`network_error: ${hint}`);
    err.cause = e; err.url = url;
    throw err;
  }

  const data = await parseResponse(res);

  if (!res.ok) {
    if (res.status === 401) {
      try {
        clearToken(); // opruimen van oude tokens (voor het geval die nog bestonden)
        if (import.meta.env.DEV) {
          // eslint-disable-next-line no-console
          console.warn("[apiFetch] 401 op", url, "— cookie-first, geen auto-redirect.");
        }
      } catch {}
    }
    const message =
      (typeof data === "object" && data && (data.error || data.message)) ||
      res.statusText || `HTTP ${res.status}`;
    const err = new Error(message);
    err.status = res.status; err.data = data; err.url = url;
    throw err;
  }

  return data;
}

/* ─────────────────────────────────────────────────────────────
   Korte helpers
───────────────────────────────────────────────────────────── */
export const apiGet  = (path, opts = {})       => apiFetch(path, { ...opts, method: "GET" });
export const apiPost = (path, body, opts = {}) => apiFetch(path, { ...opts, method: "POST", body });
export const apiPut  = (path, body, opts = {}) => apiFetch(path, { ...opts, method: "PUT", body });
export const apiDel  = (path, opts = {})       => apiFetch(path, { ...opts, method: "DELETE" });

/* ─────────────────────────────────────────────────────────────
   Auth helpers — COOKIE-FIRST
   - Server zet HttpOnly cookie; token in body is optioneel (fallback).
   - We bewaren GEEN token meer in localStorage bij login.
───────────────────────────────────────────────────────────── */
export async function login(email, password) {
  const res = await apiFetch("/api/auth/login", {
    method: "POST",
    body: { email, password },
  });
  // Cookie-first: niet vertrouwen op res.token; opruimen voor de zekerheid
  clearToken();
  return res?.user || null;
}

export async function register({ email, password, first_name = null, last_name = null }) {
  const res = await apiFetch("/api/auth/register", {
    method: "POST",
    body: { email, password, first_name, last_name },
  });
  clearToken();
  return res;
}

/* ======= WHOAMI: inflight-dedupe + korte cache ======= */
let _whoamiInflight = null;
let _whoamiCache = null;
let _whoamiTs = 0;

/**
 * Haal ingelogde user op uit cookie-sessie.
 * - Dedupe: parallelle calls delen 1 netwerkrequest
 * - Cache: default 30s (instelbaar via cacheMs)
 * - force: cache negeren
 * - Geeft bij 401 gewoon `null` terug i.p.v. throw
 */
export const whoAmI = async (opts = {}) => {
  const { force = false, cacheMs = 30_000, ...rest } = opts;
  const now = Date.now();

  // korte cache
  if (!force && _whoamiCache && now - _whoamiTs < cacheMs) {
    return _whoamiCache;
  }

  // inflight dedupe
  if (_whoamiInflight) return _whoamiInflight;

  _whoamiInflight = apiGet("/api/auth/whoami", { suppress401Redirect: true, ...rest })
    .then((res) => {
      const user = res?.user ?? (res && res.id ? res : null);
      _whoamiCache = user || null;
      _whoamiTs = Date.now();
      return _whoamiCache;
    })
    .catch((e) => {
      if (e?.status === 401) {
        _whoamiCache = null;
        _whoamiTs = 0;
        return null; // geen sessie
      }
      throw e;
    })
    .finally(() => {
      _whoamiInflight = null;
    });

  return _whoamiInflight;
};

// Uitloggen (servercookie wissen + eventuele lokale token weg)
export async function logout() {
  try { await apiPost("/api/auth/logout"); } catch {}
  clearToken();
  // whoami-cache ongeldig maken
  _whoamiCache = null;
  _whoamiTs = 0;
  return true;
}

/* ─────────────────────────────────────────────────────────────
   Upload (multipart)
───────────────────────────────────────────────────────────── */
export async function upload(endpoint, file, extraFields = {}) {
  const fd = new FormData();
  fd.append("file", file);
  Object.entries(extraFields).forEach(([k, v]) => {
    if (v !== undefined && v !== null) fd.append(k, String(v));
  });
  return apiFetch(endpoint, { method: "POST", body: fd });
}

/* ─────────────────────────────────────────────────────────────
   Default export (+ compat aliases)
───────────────────────────────────────────────────────────── */
export default {
  API_BASE,
  getToken, setToken, clearToken, authHeader, withBearer, buildQS,
  apiFetch, apiGet, apiPost, apiPut, apiDel,
  upload, login, register, whoAmI, logout,
  // Compat: laat oud gebruik api.post/get/put/delete ook werken
  post: (...a) => apiPost(...a),
  get:  (...a) => apiGet(...a),
  put:  (...a) => apiPut(...a),
  delete: (...a) => apiDel(...a),
};
