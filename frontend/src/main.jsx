// src/main.jsx
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, useLocation } from "react-router-dom";
import App from "./App.jsx";
import "./index.css";
import "./ui.css";
import { applyBrandFromStorage } from "./lib/brand";

// ⬇️ Gebruik je aparte component (zorg dat het zo heet: src/components/ErrorBoundary.jsx)
import ErrorBoundary from "@/components/ErrorBoundary.jsx";

/* ------------------ Brand: thema uit localStorage ------------------ */
try {
  applyBrandFromStorage?.();
} catch (e) {
  console.warn("Brand load failed:", e);
}

/* ------------------ ScrollToTop helper ------------------ */
function ScrollToTop() {
  const { pathname } = useLocation();
  React.useEffect(() => {
    try {
      window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    } catch {
      window.scrollTo(0, 0);
    }
  }, [pathname]);
  return null;
}

/* ------------------ Global hard-fail overlay (PROD only) ------------------ */
if (import.meta.env.PROD) {
  (function attachGlobalErrorOverlay() {
    const show = (title, err) => {
      const el = document.createElement("div");
      el.style.cssText =
        "position:fixed;inset:0;background:#0b1220;color:#fff;padding:24px;z-index:999999;overflow:auto;font-family:monospace";
      const txt =
        (err && (err.stack || err.message || String(err))) ||
        String(title || "Unknown error");
      el.innerHTML = `<h2 style="margin-top:0">💥 App crash</h2><pre>${txt}</pre>`;
      document.body.innerHTML = "";
      document.body.appendChild(el);
    };
    window.addEventListener("error", (e) => show("error", e.error || e.message));
    window.addEventListener("unhandledrejection", (e) =>
      show("unhandledrejection", e.reason)
    );
  })();
}

/* ------------------ Router + mount ------------------ */
const BASENAME = (import.meta.env.VITE_BASENAME ?? "/").trim() || "/";

function Root() {
  return (
    <React.StrictMode>
      <ErrorBoundary>
        <BrowserRouter basename={BASENAME}>
          <ScrollToTop />
          <App />
        </BrowserRouter>
      </ErrorBoundary>
    </React.StrictMode>
  );
}

/* ------------------ Veilig mounten ------------------ */
const rootEl = document.getElementById("root");
if (!rootEl) {
  document.body.innerHTML =
    '<div style="padding:16px;font-family:system-ui">❌ Geen <div id="root"></div> gevonden in index.html</div>';
} else {
  ReactDOM.createRoot(rootEl).render(<Root />);
  console.log("✅ [main] frontend mounted OK");
}
