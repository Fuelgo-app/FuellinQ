// src/pages/PartnerPortal.jsx
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import PartnerLayout from "../components/PartnerLayout.jsx";
import {
  partnerHealth,
  getLatestPrices,
  listOffers,
} from "../api/partner.js";

/** Kleine card helper (ziet er oké uit zonder extra CSS libs) */
function Card({ title, right, children, style }) {
  return (
    <div
      className="partner-card"
      style={{
        background: "#fff",
        border: "1px solid #e5e7eb",
        borderRadius: 16,
        padding: 16,
        boxShadow: "0 6px 16px rgba(2,6,23,.06)",
        ...style,
      }}
    >
      {(title || right) && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 12,
          }}
        >
          {title ? (
            <h3 style={{ margin: 0, fontWeight: 700, fontSize: 16 }}>{title}</h3>
          ) : (
            <div />
          )}
          {right ?? null}
        </div>
      )}
      {children}
    </div>
  );
}

export default function PartnerPortal() {
  const [health, setHealth] = useState(null);
  const [prices, setPrices] = useState([]);
  const [offers, setOffers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stationId, setStationId] = useState(1);

  async function load() {
    setLoading(true);
    try {
      const [h, p, o] = await Promise.all([
        partnerHealth(),
        getLatestPrices({ station_id: stationId }),
        listOffers({ station_id: stationId }),
      ]);
      setHealth(h || {});
      setPrices(Array.isArray(p) ? p : []);
      setOffers(Array.isArray(o) ? o : []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stationId]);

  return (
    <PartnerLayout title="Partner Portal">
      {/* Actieknoppen bovenaan */}
      <div
        style={{
          display: "flex",
          gap: 8,
          flexWrap: "wrap",
          marginBottom: 12,
        }}
      >
        <Link className="btn btn-outline" to="/partner/prices">
          Prijzen
        </Link>
        <Link className="btn btn-outline" to="/partner/offers">
          Acties & Deals
        </Link>
        <Link className="btn btn-outline" to="/partner/settings">
          Instellingen
        </Link>

        <div style={{ marginLeft: "auto" }}>
          <select
            value={stationId}
            onChange={(e) => setStationId(Number(e.target.value))}
            style={{
              border: "1px solid #e5e7eb",
              borderRadius: 10,
              padding: "8px 12px",
            }}
          >
            <option value={1}>Station 1</option>
            {/* later dynamisch */}
          </select>
        </div>
      </div>

      {/* Grid met cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr",
          gap: 16,
        }}
        className="partner-grid"
      >
        {/* STATUS */}
        <Card
          title="Status"
          right={
            <button
              className="btn btn-outline"
              onClick={load}
              disabled={loading}
            >
              Vernieuwen
            </button>
          }
        >
          <pre
            style={{
              margin: 0,
              whiteSpace: "pre-wrap",
              background: "#f8fafc",
              border: "1px solid #eef2f7",
              borderRadius: 12,
              padding: 12,
            }}
          >
            {loading ? "Laden…" : JSON.stringify(health ?? {}, null, 2)}
          </pre>
        </Card>

        {/* TWEE KOLOMMEN ONDERAAN OP BREED SCHERM */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr",
            gap: 16,
          }}
          className="partner-subgrid"
        >
          <Card
            title="Laatste prijzen"
            right={<Link className="btn btn-outline" to="/partner/prices">Beheren</Link>}
            style={{}}
          >
            {loading ? (
              <div style={{ color: "#6b7280" }}>Laden…</div>
            ) : prices.length ? (
              <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                {prices.slice(0, 8).map((r) => (
                  <li
                    key={`${r.station_id}-${r.fuel_type}`}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "8px 0",
                      borderBottom: "1px solid #f1f5f9",
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 600 }}>{r.fuel_type}</div>
                      <div style={{ fontSize: 12, color: "#6b7280" }}>
                        Station {r.station_id} •{" "}
                        {new Date(r.created_at).toLocaleString()}
                      </div>
                    </div>
                    <div style={{ fontWeight: 700 }}>
                      € {Number(r.price_eur_l).toFixed(3)}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <div style={{ color: "#6b7280" }}>Nog geen prijzen.</div>
            )}
          </Card>

          <Card
            title="Laatste aanbiedingen"
            right={<Link className="btn btn-outline" to="/partner/offers">Beheren</Link>}
          >
            {loading ? (
              <div style={{ color: "#6b7280" }}>Laden…</div>
            ) : offers.length ? (
              <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                {offers.slice(0, 8).map((o) => (
                  <li
                    key={o.id}
                    style={{
                      padding: "10px 0",
                      borderBottom: "1px solid #f1f5f9",
                    }}
                  >
                    <div style={{ fontWeight: 600 }}>{o.title}</div>
                    {o.body ? (
                      <div style={{ fontSize: 13, color: "#475569" }}>
                        {o.body}
                      </div>
                    ) : null}
                    <div style={{ fontSize: 12, color: "#6b7280" }}>
                      Station {o.station_id} •{" "}
                      {new Date(o.created_at).toLocaleString()}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <div style={{ color: "#6b7280" }}>Nog geen aanbiedingen.</div>
            )}
          </Card>
        </div>
      </div>

      {/* simpele responsive tweaks zonder externe CSS */}
      <style>{`
        @media (min-width: 1024px) {
          .partner-grid { grid-template-columns: 1fr; }
          .partner-subgrid { grid-template-columns: 1fr 1fr; }
        }
        .btn { background:#2563eb; color:#fff; border:0; border-radius:10px; padding:8px 12px; font-weight:800; cursor:pointer; }
        .btn:hover { filter:brightness(0.97); }
        .btn:disabled { opacity: .6; cursor: default; }
        .btn-outline { background:#fff; color:#111827; border:1px solid #e5e7eb; }
      `}</style>
    </PartnerLayout>
  );
}
