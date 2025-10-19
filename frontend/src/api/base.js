// src/api/base.js
// Reusable API helpers voor de hele frontend

/* ─────────────────────────────────────────────────────────────
   API_BASE
   - 1) VITE_API_URL als die gezet is
   - 2) Slim raden: prod -> https://api.fuellinq.app, dev -> http://localhost:3000
───────────────────────────────────────────────────────────── */
const RAW_API = (import.meta.env.VITE_API_URL ?? "").trim();

function guessApiBase() {
  if (typeof window === "undefined") return "http://localhost:3000";
  const host = window.location.hostname.toLowerCase();
  // elke *fuellinq.app omgeving gebruikt de publieke API
  if (host.endsWith("fuellinq.app")) return "https://api.fuellinq.app";
  // anders lokale dev
  return "http://localhost:3000";
}

export const API_BASE = (RAW_API && RAW_API !== "/" ? RAW_API : guessApiBase()).replace(/\/+$/, "");

/* ─────────────────────────────────────────────────────────────
   Token helpers
   (server gebruikt primair HttpOnly cookie; token is optioneel)
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

export const authHeader = () => {
  const t = getToken();
  return t ? { Authorization: `Bearer ${t}` } : {};
};

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

// Bepaal of we een Authorization header moeten meesturen
function shouldAttachAuth(fullUrlOrPath) {
  // niets meesturen naar /auth/* (login/register/whoami/logout)
  const p = typeof fullUrlOrPath === "string" ? fullUrlOrPath : "";
  const re = /(^|\/)(api\/)?auth(\/|$)/i; // match ook absolute/relative varianten
  return !re.test(p);
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
   - Plakt Bearer token (niet voor /auth/*)
   - 401 ⇒ token wissen + redirect naar /auth (indien nodig)
   - Heldere foutmelding bij netwerk/mixed-content/CORS issues
───────────────────────────────────────────────────────────── */
export async function apiFetch(path, opts = {}) {
  const norm = normalizePath(path);
  const url = /^https?:\/\//i.test(norm) ? norm : `${API_BASE}${norm}`;

  const headers = { ...(opts.headers || {}) };
  if (shouldAttachAuth(norm)) Object.assign(headers, authHeader());

  let body = opts.body;
  // Content-Type alleen bij non-FormData JSON
  if (body && !isFormData(body) && typeof body === "object") {
    headers["Content-Type"] = headers["Content-Type"] || "application/json";
    body = JSON.stringify(body);
  }

  let res;
  try {
    res = await fetch(url, {
      method: opts.method || "GET",
      headers,
      credentials: "include",   // ← cookies meesturen
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
    err.cause = e;
    err.url = url;
    throw err;
  }

  const data = await parseResponse(res);

  if (!res.ok) {
    if (res.status === 401) {
      try {
        clearToken();
        if (typeof window !== "undefined" && !window.location.pathname.startsWith("/auth")) {
          window.location.assign("/auth?reason=unauthorized");
        }
      } catch {}
    }
    const message =
      (typeof data === "object" && data && (data.error || data.message)) ||
      res.statusText || `HTTP ${res.status}`;
    const err = new Error(message);
    err.status = res.status;
    err.data = data;
    err.url = url;
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
   Auth helpers (cookie-first)
   - Server zet HttpOnly cookie; token in body is optioneel (fallback)
───────────────────────────────────────────────────────────── */
export async function login(email, password) {
  const res = await apiFetch("/api/auth/login", {
    method: "POST",
    body: { email, password },
  });
  if (res?.token) setToken(res.token);      // optioneel token bijhouden
  return res?.user || null;
}

export async function register({ email, password, first_name = null, last_name = null }) {
  return apiFetch("/api/auth/register", {
    method: "POST",
    body: { email, password, first_name, last_name },
  });
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
   Default export
───────────────────────────────────────────────────────────── */
export default {
  API_BASE,
  getToken,
  setToken,
  clearToken,
  authHeader,
  buildQS,
  apiFetch,
  apiGet,
  apiPost,
  apiPut,
  apiDel,
  upload,
  // ook beschikbaar via default:
  login,
  register,
};
