// src/lib/brand.js

/* -------------------------------- Defaults -------------------------------- */

export const DEFAULT_BRAND = {
  // Basis
  bg: "#f8fafc",
  surface: "#ffffff",     // “kaart op bg”
  text: "#0f172a",
  muted: "#64748b",
  border: "#e5e7eb",      // randkleur voor kaarten/inputs/chips

  // Merkkleuren
  primary: "#60a5fa",     // links/knoppen
  secondary: "#f58220",   // accenten/cijfers

  // Tegels / kaarten
  cardBg: "#444A52",
  cardText: "#FFFFFF",

  // Buttons
  buttonBg: "#4E5560",
  buttonText: "#ffffff",

  // Sidebar
  sidebarBg: "#ffffff",
  sidebarText: "#0f172a",

  // Typo & logo
  font_family: "",        // bv. 'Inter, system-ui, sans-serif'
  logo_url: "",           // absolute/relative URL

  // UI tokens
  radius: 12,
  cardRadius: 12,
  btnRadius: 12,
  shadow: "0 2px 8px rgba(0,0,0,0.12)",
  sidebarWidth: "220px",
};

/* ------------------------------ Role helpers ------------------------------ */
export function isAdmin() {
  try {
    return (localStorage.getItem("role") || "").toLowerCase() === "admin";
  } catch {
    return false;
  }
}
export function shouldShowBrandingLink() {
  return isAdmin();
}

/* ------------------------------ Small utils ------------------------------- */
const isBrowser = typeof window !== "undefined" && typeof document !== "undefined";
const px = (v) => (typeof v === "number" ? `${v}px` : v);

function setMetaThemeColor(color) {
  if (!isBrowser) return;
  let m = document.querySelector('meta[name="theme-color"]');
  if (!m) {
    m = document.createElement("meta");
    m.setAttribute("name", "theme-color");
    document.head.appendChild(m);
  }
  m.setAttribute("content", color);
}

/* ------------------------------ Apply helpers ----------------------------- */

export function applyBrand(brand = {}) {
  if (!isBrowser) return;

  const b = { ...DEFAULT_BRAND, ...brand };
  const root = document.documentElement;
  const set = (k, v) => (v != null ? root.style.setProperty(k, String(v)) : null);

  // Core colors
  set("--bg", b.bg);
  set("--surface", b.surface || b.cardBg || "#fff");
  set("--text", b.text);
  set("--muted", b.muted);
  set("--border", b.border || "#e5e7eb");

  // Cards
  set("--card-bg", b.cardBg);
  set("--card-text", b.cardText);

  // Brand / aliases (zodat zowel --accent als --brand-primary werken)
  set("--accent", b.primary);
  set("--accent-2", b.secondary);
  set("--brand-primary", b.primary);
  set("--brand-secondary", b.secondary);

  // Buttons
  set("--btn-bg", b.buttonBg ?? b.primary);
  set("--btn-text", b.buttonText ?? "#ffffff");

  // Sidebar
  set("--sidebar-bg", b.sidebarBg);
  set("--sidebar-text", b.sidebarText);

  // UI tokens
  set("--radius", px(b.radius ?? 12));
  set("--card-radius", px(b.cardRadius ?? b.radius ?? 12));
  set("--btn-radius", px(b.btnRadius ?? b.radius ?? 12));
  set("--shadow", b.shadow ?? DEFAULT_BRAND.shadow);
  set("--sidebar-width", b.sidebarWidth ?? DEFAULT_BRAND.sidebarWidth);

  // Extra tokens (chips/links)
  set("--chip-bg", "#fff");
  set("--chip-text", b.text);
  set("--chip-border", b.border || "#e5e7eb");
  set("--link", b.primary);
  set("--link-hover", b.secondary);

  // Body font en logo opslag (voor Header)
  try {
    if (b.font_family) document.body.style.fontFamily = b.font_family;
    if (b.logo_url) localStorage.setItem("brand_logo", b.logo_url);
  } catch {}

  // Browser theme color
  try {
    const theme = b.surface || "#ffffff";
    setMetaThemeColor(theme);
  } catch {}
}

export function applyBrandFromStorage() {
  try {
    const saved = JSON.parse(localStorage.getItem("brand") || "{}");
    const merged = { ...DEFAULT_BRAND, ...saved };
    if (!localStorage.getItem("brand")) {
      localStorage.setItem("brand", JSON.stringify(merged));
    }
    applyBrand(merged);
  } catch {
    applyBrand(DEFAULT_BRAND);
  }
}

export function setBrand(partial) {
  if (!isBrowser) return;
  const saved = JSON.parse(localStorage.getItem("brand") || "{}");
  const merged = { ...DEFAULT_BRAND, ...saved, ...partial };
  localStorage.setItem("brand", JSON.stringify(merged));
  if (merged.logo_url) {
    try { localStorage.setItem("brand_logo", merged.logo_url); } catch {}
  }
  applyBrand(merged);
}

export function getBrand() {
  try {
    const saved = JSON.parse(localStorage.getItem("brand") || "{}");
    return { ...DEFAULT_BRAND, ...saved };
  } catch {
    return { ...DEFAULT_BRAND };
  }
}

export function getLogoUrl() {
  try {
    return (
      localStorage.getItem("brand_logo") ||
      JSON.parse(localStorage.getItem("brand") || "{}").logo_url ||
      ""
    );
  } catch {
    return "";
  }
}

export function clearBrand() {
  try {
    localStorage.removeItem("brand");
    localStorage.removeItem("brand_logo");
  } catch {}
  applyBrand(DEFAULT_BRAND);
}

/* --------------------------------- Presets -------------------------------- */

export const THEME_PRESETS = [
  { key: "fuellinq", name: "FuellinQ (donkere tegels)", values: {} }, // defaults
  {
    key: "light",
    name: "Licht & fris",
    values: {
      bg: "#f8fafc",
      surface: "#ffffff",
      text: "#0f172a",
      muted: "#64748b",
      border: "#e5e7eb",
      cardBg: "#ffffff",
      cardText: "#0f172a",
      primary: "#0b3654",
      secondary: "#f58220",
      radius: 12,
      shadow: "0 1px 4px rgba(0,0,0,.08)",
    },
  },
  {
    key: "dark",
    name: "Dark mode",
    values: {
      bg: "#0b1220",
      surface: "#0b1220",
      text: "#e5e7eb",
      muted: "#94a3b8",
      border: "#1f2937",
      cardBg: "#111827",
      cardText: "#e5e7eb",
      primary: "#60a5fa",
      secondary: "#fbbf24",
      sidebarBg: "#0b1220",
      sidebarText: "#e5e7eb",
      shadow: "none",
    },
  },
  {
    key: "contrast",
    name: "Hoog contrast",
    values: {
      bg: "#ffffff",
      surface: "#ffffff",
      text: "#0b0f19",
      muted: "#334155",
      border: "#0f172a",
      primary: "#111827",
      secondary: "#ef4444",
      cardBg: "#ffffff",
      cardText: "#111827",
      radius: 4,
      shadow: "0 0 0 2px rgba(0,0,0,.08)",
    },
  },
];

export function applyPreset(key) {
  const preset = THEME_PRESETS.find((p) => p.key === key);
  if (!preset) return;
  setBrand(preset.values);
}
