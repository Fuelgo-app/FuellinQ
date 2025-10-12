// src/pages/OnboardingDone.jsx
import React from "react";
import { Link, useNavigate } from "react-router-dom";

export default function OnboardingDone() {
  const navigate = useNavigate();
  const bank = (localStorage.getItem("fuellinq_bank") || "").toUpperCase();

  return (
    <div className="container" style={{ maxWidth: 860, marginTop: 24, paddingBottom: 24 }}>
      {/* mini-progress (voltooid) */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 13, color: "#64748b", marginBottom: 6 }}>Klaar 🎉</div>
        <div style={{ height: 6, background: "#e5e7eb", borderRadius: 999 }}>
          <div style={{ width: "100%", height: "100%", background: "#16a34a", borderRadius: 999 }} />
        </div>
      </div>

      <h1 style={{ fontSize: 40, lineHeight: 1.1, fontWeight: 900, margin: "6px 0 8px" }}>
        Je tankpas is geactiveerd!
      </h1>
      <p style={{ color: "#475569", fontSize: 18, marginBottom: 18 }}>
        Top, je kunt direct tanken en betalen met je digitale pas. 
        {bank && <> Bank gekoppeld: <b>{bank}</b>. </>}
        Nog één ding: voeg je voertuig toe voor slim overzicht en limieten.
      </p>

      <div
        className="card"
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 18,
          padding: 18,
          borderRadius: 18,
          border: "1px solid #e5e7eb",
          boxShadow: "0 8px 24px rgba(2,6,23,0.06)",
          background: "#fff",
        }}
      >
        {/* Checklist */}
        <div>
          <div style={{ fontWeight: 800, marginBottom: 8 }}>Checklist</div>
          <ul style={{ margin: 0, paddingInlineStart: 18, color: "#334155", lineHeight: 1.8 }}>
            <li>✅ Account aangemaakt</li>
            <li>✅ Bankrekening gekoppeld</li>
            <li>✅ Digitale tankpas in Wallet</li>
            <li>⬜ Voertuig toevoegen (kenteken & label)</li>
            <li>⬜ Notificaties / factuurinstellingen (optioneel)</li>
          </ul>
        </div>

        {/* Acties */}
        <div style={{ display: "grid", alignContent: "center", gap: 10 }}>
          <button
            onClick={() => navigate("/app/vehicles")}
            className="btn"
            style={{
              background: "#2563eb",
              color: "#fff",
              fontWeight: 800,
              borderRadius: 10,
              padding: "12px 16px",
              border: 0,
              cursor: "pointer",
            }}
          >
            ➕ Voertuig toevoegen
          </button>

          <Link
            to="/app"
            className="btn btn-outline"
            style={{
              textDecoration: "none",
              border: "1px solid #e5e7eb",
              borderRadius: 10,
              padding: "12px 16px",
              fontWeight: 700,
              color: "#111827",
              background: "#fff",
              textAlign: "center",
            }}
          >
            Naar dashboard
          </Link>

          <div style={{ fontSize: 12, color: "#6b7280" }}>
            Tip: stel daglimieten en locaties in bij <b>Voertuigen</b> voor extra controle.
          </div>
        </div>
      </div>
    </div>
  );
}
