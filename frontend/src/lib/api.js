// frontend/src/api.js
const RAW_API = (import.meta.env.VITE_API_URL ?? "").trim();
export const API_BASE =
  (RAW_API && RAW_API !== "/" ? RAW_API : "http://localhost:3000").replace(/\/+$/, "");

// ───────── Token helpers ─────────
export const getToken   = () => localStorage.getItem("token") || "";
export const setToken   = (t) => localStorage.setItem("token", t);
export const clearToken = () => localStorage.removeItem("token");

function authHeaders() {
  const t = getToken();
  return t ? { Authorization: `Bearer ${t}` } : {};
}

// ───────── Fetch utils ─────────
async function parseResponse(res, verb, path) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || `${verb} ${path} failed (${res.status})`);
  return data;
}

function withTimeout(ms = 20000) {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort("timeout"), ms);
  return { signal: ctrl.signal, cancel: () => clearTimeout(id) };
}

// ───────── HTTP helpers (single definitions!) ─────────
export async function apiGet(path) {
  const t = withTimeout();
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      method: "GET",
      headers: { ...authHeaders() },
      signal: t.signal,
    });
    return await parseResponse(res, "GET", path);
  } finally {
    t.cancel();
  }
}

export async function apiPost(path, body) {
  const t = withTimeout();
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify(body ?? {}),
      signal: t.signal,
    });
    return await parseResponse(res, "POST", path);
  } finally {
    t.cancel();
  }
}

export async function apiPut(path, body) {
  const t = withTimeout();
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify(body ?? {}),
      signal: t.signal,
    });
    return await parseResponse(res, "PUT", path);
  } finally {
    t.cancel();
  }
}

export async function apiPatch(path, body) {
  const t = withTimeout();
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify(body ?? {}),
      signal: t.signal,
    });
    return await parseResponse(res, "PATCH", path);
  } finally {
    t.cancel();
  }
}

export async function apiDelete(path) {
  const t = withTimeout();
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      method: "DELETE",
      headers: { ...authHeaders() },
      signal: t.signal,
    });
    return await parseResponse(res, "DELETE", path);
  } finally {
    t.cancel();
  }
}
