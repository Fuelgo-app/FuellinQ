// src/components/PartnerLayout.jsx
import React, { useEffect, useMemo } from "react";
import { Outlet } from "react-router-dom"; // ⬅️ nieuw

export default function PartnerLayout({
  title,
  subtitle,
  right,
  sidebar,
  className = "",
  children,
}) {
  const branding = useMemo(() => {
    try {
      const raw = localStorage.getItem("partner_settings");
      if (!raw) return {};
      const s = JSON.parse(raw);
      return {
        brandPrimary: s.brand_primary || "#2563eb",
        brandAccent: s.brand_accent || "#f59e0b",
        company: s.company_name || "",
        logo: s.logo_url || "",
      };
    } catch {
      return {};
    }
  }, []);

  useEffect(() => {
    const prev = document.title;
    if (title) document.title = `${title} · Partner Portal`;
    return () => (document.title = prev);
  }, [title]);

  return (
    <div
      className={`partner-layout ${className}`}
      style={{
        "--brand-primary": branding.brandPrimary || "#2563eb",
        "--brand-accent": branding.brandAccent || "#f59e0b",
      }}
    >
      <div
        className="partner-shell"
        style={{
          display: "grid",
          gridTemplateColumns: sidebar ? "260px 1fr" : "1fr",
          minHeight: "calc(100vh - 0px)",
          background: "#f8fafc",
        }}
      >
        {sidebar ? (
          <aside style={{ background: "#fff", borderRight: "1px solid #e5e7eb" }}>
            {sidebar}
          </aside>
        ) : null}

        <main style={{ padding: 16 }}>
          {(title || right) && (
            <div
              className="partner-header"
              style={{
                display: "flex",
                alignItems: subtitle ? "flex-start" : "center",
                justifyContent: "space-between",
                gap: 12,
                marginBottom: 12,
              }}
            >
              <div>
                {title ? (
                  <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, letterSpacing: -0.3 }}>
                    {title}
                  </h1>
                ) : null}
                {subtitle ? (
                  <div style={{ marginTop: 4, color: "#64748b", fontSize: 14 }}>{subtitle}</div>
                ) : null}
              </div>
              {right ? <div>{right}</div> : null}
            </div>
          )}

          <div className="partner-content" style={{ display: "block", maxWidth: 1400, margin: "0 auto" }}>
            {/* 🔑 Als er geen children zijn (nested routes), render de Outlet */}
            {children ?? <Outlet />}
          </div>
        </main>
      </div>

      <style>{`
        .btn { background: var(--brand-primary); color:#fff; border:0; border-radius:10px; padding:8px 12px; font-weight:800; cursor:pointer; }
        .btn:hover { filter: brightness(0.97); }
        .btn:disabled { opacity:.6; cursor:default; }
        .btn-outline { background:#fff; color:#111827; border:1px solid #e5e7eb; }
        .input { width:100%; border:1px solid #e5e7eb; border-radius:10px; padding:8px 10px; outline:none; }
        .input:focus { border-color: var(--brand-primary); box-shadow: 0 0 0 3px rgba(37,99,235,.15); }
        .muted { color:#64748b; }
        .card { background:#fff; border:1px solid #e5e7eb; border-radius:16px; padding:16px; box-shadow:0 6px 16px rgba(2,6,23,.06); }
        @media (max-width:1024px){ .partner-shell{ grid-template-columns:1fr; } }
      `}</style>
    </div>
  );
}
