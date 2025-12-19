// src/pages/partner/PartnerNav.jsx
import React, { useMemo, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";

/**
 * Kleine, dependency-vrije sidebar voor het Partner-portal.
 * - Actieve link highlighting met NavLink
 * - Compact toggle (voor small screens of smalle layouts)
 * - Logo/naam fallback
 *
 * Styling:
 * - Werkt met je basis .btn/.input classes
 * - Verder inline styles zodat je niets hoeft toe te voegen
 */

function Icon({ name }) {
  // Minimal inline SVG icons (lichtgewicht)
  const common = { width: 18, height: 18, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" };
  switch (name) {
    case "dashboard":
      return (
        <svg {...common}><path d="M3 13h8V3H3v10zM13 21h8v-8h-8v8zM13 3h8M3 21h8" /></svg>
      );
    case "stations":
      return (
        <svg {...common}><path d="M4 21v-8a4 4 0 0 1 8 0v8M12 12l6-6 4 4-6 6M7 21h10" /></svg>
      );
    case "add":
      return (
        <svg {...common}><path d="M12 5v14M5 12h14" /></svg>
      );
    case "prices":
      return (
        <svg {...common}><path d="M12 1v22M5 6h14M5 12h14M5 18h14" /></svg>
      );
    case "offers":
      return (
        <svg {...common}><path d="M21 8V7a2 2 0 0 0-2-2h-5l-2-2H5a2 2 0 0 0-2 2v1" /><path d="M3 8h18v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8z" /></svg>
      );
    case "analytics":
      return (
        <svg {...common}><path d="M3 3v18h18" /><path d="M7 13l3 3 7-7" /></svg>
      );
    case "settings":
      return (
        <svg {...common}><path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06A1.65 1.65 0 0 0 15 19.4a1.65 1.65 0 0 0-1 .6 1.65 1.65 0 0 0-.33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06A1.65 1.65 0 0 0 8.6 21a1.65 1.65 0 0 0-1.82-.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1-.6 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 3 8.6c.14-.63.14-1.3 0-1.93A1.65 1.65 0 0 0 2.4 5l-.06-.06a2 2 0 1 1 2.83-2.83L5.23 2.2A1.65 1.65 0 0 0 7 2.6c.63-.14 1.3-.14 1.93 0A1.65 1.65 0 0 0 10 2.4l.06-.06a2 2 0 1 1 2.83 2.83L12.8 5.23A1.65 1.65 0 0 0 13.4 7c.14.63.14 1.3 0 1.93A1.65 1.65 0 0 0 15 10l.17.17" /></svg>
      );
    default:
      return null;
  }
}

export default function PartnerNav({ initialCollapsed = false }) {
  const { pathname } = useLocation();
  const [collapsed, setCollapsed] = useState(initialCollapsed);

  // Merknaam / logo fallback. Als je settings lokaal cached (bijv. in localStorage),
  // kun je dat hier oppakken:
  const { logoUrl, brandName } = useMemo(() => {
    try {
      const raw = localStorage.getItem("partner_settings");
      if (raw) {
        const s = JSON.parse(raw);
        return {
          logoUrl: s.logo_url || "",
          brandName: s.company_name || "Partner",
        };
      }
    } catch {}
    return { logoUrl: "", brandName: "Partner" };
  }, []);

  const LinkItem = ({ to, icon, children, end }) => (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        "partner-nav-link" + (isActive ? " active" : "")
      }
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "10px 12px",
        borderRadius: 12,
        textDecoration: "none",
        color: "inherit",
        fontWeight: 500,
      }}
    >
      <span style={{ display: "inline-flex", width: 20, justifyContent: "center", opacity: 0.9 }}>
        <Icon name={icon} />
      </span>
      {!collapsed && <span>{children}</span>}
    </NavLink>
  );

  return (
    <aside
      className="partner-nav"
      style={{
        width: collapsed ? 64 : 220,
        transition: "width .2s ease",
        background: "#fff",
        borderRight: "1px solid #e5e7eb",
        padding: 12,
        display: "flex",
        flexDirection: "column",
        gap: 8,
        minHeight: "100%",
      }}
    >
      {/* Header / Brand */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "6px 8px",
          marginBottom: 6,
        }}
      >
        {logoUrl ? (
          <img
            src={logoUrl}
            alt="logo"
            style={{
              width: 28,
              height: 28,
              objectFit: "contain",
              borderRadius: 6,
              border: "1px solid #e5e7eb",
            }}
          />
        ) : (
          <div
            aria-label="logo"
            style={{
              width: 28,
              height: 28,
              borderRadius: 6,
              background: "#eef2ff",
              display: "grid",
              placeItems: "center",
              fontSize: 14,
              fontWeight: 700,
              color: "#3b82f6",
              border: "1px solid #e5e7eb",
            }}
          >
            P
          </div>
        )}
        {!collapsed && (
          <div style={{ lineHeight: 1.1 }}>
            <div style={{ fontWeight: 700 }}>{brandName}</div>
            <div style={{ fontSize: 12, opacity: 0.6 }}>Partner Portal</div>
          </div>
        )}
        <button
          onClick={() => setCollapsed((v) => !v)}
          title={collapsed ? "Uitklappen" : "Inklappen"}
          style={{
            marginLeft: "auto",
            border: "1px solid #e5e7eb",
            background: "#fff",
            borderRadius: 10,
            padding: 6,
            cursor: "pointer",
          }}
        >
          {collapsed ? "›" : "‹"}
        </button>
      </div>

      {/* Nav groups */}
      <div style={{ display: "grid", gap: 6 }}>
        <div style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: 0.5, opacity: 0.6, padding: "4px 8px" }}>
          {!collapsed ? "Overzicht" : ""}
        </div>
        <LinkItem to="/partner" icon="dashboard" end>Dashboard</LinkItem>
      </div>

      <div style={{ display: "grid", gap: 6, marginTop: 8 }}>
        <div style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: 0.5, opacity: 0.6, padding: "4px 8px" }}>
          {!collapsed ? "Stations" : ""}
        </div>
        <LinkItem to="/partner/stations" icon="stations">Stations</LinkItem>
        <LinkItem to="/partner/stations/new" icon="add">Nieuw station</LinkItem>
        <LinkItem to="/partner/prices" icon="prices">Brandstofprijzen</LinkItem>
      </div>

      <div style={{ display: "grid", gap: 6, marginTop: 8 }}>
        <div style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: 0.5, opacity: 0.6, padding: "4px 8px" }}>
          {!collapsed ? "Marketing" : ""}
        </div>
        <LinkItem to="/partner/offers" icon="offers">Aanbiedingen</LinkItem>
        <LinkItem to="/partner/analytics" icon="analytics">Analytics</LinkItem>
      </div>

      <div style={{ display: "grid", gap: 6, marginTop: 8 }}>
        <div style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: 0.5, opacity: 0.6, padding: "4px 8px" }}>
          {!collapsed ? "Beheer" : ""}
        </div>
        <LinkItem to="/partner/settings" icon="settings">Instellingen</LinkItem>
      </div>

      {/* Subtle current-path at bottom (debug/helpful) */}
      {!collapsed && (
        <div
          style={{
            marginTop: "auto",
            padding: "8px 10px",
            fontSize: 12,
            color: "#64748b",
            background: "#f8fafc",
            border: "1px dashed #e5e7eb",
            borderRadius: 12,
            wordBreak: "break-all",
          }}
          title={pathname}
        >
          <div style={{ opacity: 0.7, marginBottom: 4 }}>Pad</div>
          <div style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>{pathname}</div>
        </div>
      )}
    </aside>
  );
}
