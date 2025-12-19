// src/components/AppShell.jsx
import React from "react";
import { Link, NavLink } from "react-router-dom";

function Item({ to, icon, children }) {
  return (
    <li>
      <NavLink
        to={to}
        className={({ isActive }) =>
          `nav-link ${isActive ? "active" : ""}`
        }
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "10px 12px",
          borderRadius: 10,
          textDecoration: "none",
          border: "1px solid transparent",
          ...(window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches
            ? { color: "#E6E7EB" } : {}),
        }}
      >
        <span style={{ width: 20, textAlign: "center" }}>{icon}</span>
        <span>{children}</span>
      </NavLink>
    </li>
  );
}

export default function AppShell({ children }) {
  const role = localStorage.getItem("role");
  const isAdmin = role === "admin";

  return (
    <div className="container">
      <div
        className="grid"
        style={{
          gridTemplateColumns: "220px 1fr",
          gap: 16,
          marginTop: 16,
          alignItems: "start",
        }}
      >
        {/* Sidebar */}
        <nav
          className="card p-3"
          style={{
            position: "sticky",
            top: 8,
            padding: 16,
            borderRadius: 16,
          }}
        >
          <div
            style={{
              fontWeight: 800,
              marginBottom: 12,
              color: "var(--brand-primary, #0b3654)",
              letterSpacing: ".2px",
            }}
          >
            Dashboard
          </div>

          <ul style={{ display: "grid", gap: 8, paddingLeft: 0, margin: 0, listStyle: "none" }}>
            <Item to="/app" icon="🏠">Overzicht</Item>
            <Item to="/app/vehicles" icon="🚗">Voertuigen</Item>
            <Item to="/app/wallet" icon="💳">Wallet / Passen</Item>
            <Item to="/app/transactions" icon="🧾">Transacties</Item>
            <Item to="/app/rewards" icon="🎁">Punten & Rewards</Item>
            <Item to="/app/insights" icon="📊">Inzichten</Item>
            <Item to="/app/invoices" icon="📄">Facturen</Item>
            {isAdmin && <Item to="/app/admin" icon="🛠️">Admin</Item>}

            <li style={{ marginTop: 16, fontWeight: 700, color: "var(--brand-primary, #0b3654)" }}>
              Info
            </li>
            <Item to="//about" icon="ℹ️">Over ons</Item>
            <Item to="/app/contact" icon="📞">Contact</Item>
          </ul>

          {/* Quick links onderin */}
          <div style={{ marginTop: 16, display: "grid", gap: 8 }}>
            <Link className="btn btn-outline" to="/app/vehicles">+ Voertuig</Link>
            <Link className="btn btn-outline" to="/app/wallet">Add to Apple/Google Wallet</Link>
          </div>
        </nav>

        {/* Content */}
        <main>{children}</main>
      </div>
    </div>
  );
}
