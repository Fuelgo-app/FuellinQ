// src/pages/partner/PartnerAnalytics.jsx
import React, { useEffect, useState } from "react";
import PartnerLayout from "../../components/PartnerLayout.jsx";

/* Mock data (later vervangen door API-calls) */
const MOCK_STATS = {
  totalRevenue: 18452.75,
  totalTransactions: 1294,
  avgTicket: 14.27,
  topFuel: "euro95",
  trend: [
    { day: "Ma", value: 2150 },
    { day: "Di", value: 1940 },
    { day: "Wo", value: 2210 },
    { day: "Do", value: 2450 },
    { day: "Vr", value: 3100 },
    { day: "Za", value: 4020 },
    { day: "Zo", value: 3582 },
  ],
};

export default function PartnerAnalytics() {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    // In toekomst vervangen door fetch(`${API_BASE}/api/partner/analytics`)
    setTimeout(() => setStats(MOCK_STATS), 400);
  }, []);

  if (!stats) {
    return (
      <PartnerLayout title="Analytics">
        <p style={{ textAlign: "center", marginTop: 40 }}>📊 Data wordt geladen...</p>
      </PartnerLayout>
    );
  }

  return (
    <PartnerLayout title="Analytics">
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: 16,
          marginTop: 16,
        }}
      >
        <StatCard label="Totale omzet" value={`€${stats.totalRevenue.toLocaleString("nl-NL", { minimumFractionDigits: 2 })}`} />
        <StatCard label="Transacties" value={stats.totalTransactions} />
        <StatCard label="Gem. bedrag" value={`€${stats.avgTicket}`} />
        <StatCard label="Populairste brandstof" value={stats.topFuel.toUpperCase()} />
      </div>

      <div style={{ marginTop: 40 }}>
        <h3 style={{ marginBottom: 12 }}>Omzet per dag</h3>
        <BarChart data={stats.trend} />
      </div>
    </PartnerLayout>
  );
}

/* Kleine kaartcomponent */
function StatCard({ label, value }) {
  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid #e5e7eb",
        borderRadius: 16,
        padding: 20,
        boxShadow: "0 4px 10px rgba(0,0,0,0.05)",
      }}
    >
      <div style={{ color: "#6b7280", fontSize: 14 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color: "#111827" }}>{value}</div>
    </div>
  );
}

/* Simpele bar chart zonder lib */
function BarChart({ data }) {
  const max = Math.max(...data.map((d) => d.value));
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-end",
        gap: 8,
        height: 180,
        borderBottom: "1px solid #e5e7eb",
        paddingBottom: 8,
      }}
    >
      {data.map((d) => (
        <div key={d.day} style={{ textAlign: "center", flex: 1 }}>
          <div
            style={{
              background: "#3b82f6",
              height: `${(d.value / max) * 100}%`,
              borderRadius: 4,
              transition: "height 0.4s",
            }}
          />
          <div style={{ marginTop: 6, fontSize: 13, color: "#374151" }}>{d.day}</div>
        </div>
      ))}
    </div>
  );
}
