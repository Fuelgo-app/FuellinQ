// src/pages/dashboard.jsx
import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { apiGet, apiPost } from "../lib/api"; // centrale API helpers
import VehicleCo2Card from "../components/VehicleCo2Card.jsx"; // ⬅️ NIEUW: CO₂-kaart
import { addFuelTx, listFuelTx, deleteFuelTx, getCo2Summary, getCo2ByMonth } from "@/lib/apiCo2.js";

/* ---------------- Brand logo mapping ---------------- */
const BRAND_LOGOS = {
  shell: "/assets/brands/shell.png",
  esso: "/assets/brands/esso.png",
  bp: "/assets/brands/bp.png",
  totalenergies: "/assets/brands/totalenergies.png",
  total: "/assets/brands/total.png",
  tango: "/assets/brands/tango.png",
  q8: "/assets/brands/q8.png",
  ok: "/assets/brands/ok.png",
  avia: "/assets/brands/avia.png",
  argos: "/assets/brands/argos.png",
  tinq: "/assets/brands/tinq.png",
  texaco: "/assets/brands/texaco.png",
  gulf: "/assets/brands/gulf.png",
};
function brandKey(name = "") {
  return String(name).toLowerCase().replace(/[^a-z0-9]+/g, "");
}
function brandLogoUrl(brand) {
  const key = brandKey(brand);
  return BRAND_LOGOS[key] || null;
}

/* ---------- Auth (me + logout) ---------- */
function logout() {
  localStorage.removeItem("token");
  window.location.href = "/login";
}
function UserBar({ me }) {
  return (
    <div
      className="card p-3"
      style={{
        borderRadius: 16,
        marginBottom: 12,
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
      }}
    >
      <div>
        <div style={{ fontWeight: 700, color: "var(--brand-primary,#0b3654)" }}>
          Welkom
        </div>
        <div className="muted" style={{ fontSize: 13 }}>
          {me?.email || me?.name || "—"}
        </div>
      </div>
      <button className="btn btn-outline" onClick={logout}>
        Log uit
      </button>
    </div>
  );
}

/* ---------- Kleine helpers ---------- */
function last12MonthLabels() {
  const out = [];
  const d = new Date();
  d.setDate(1);
  for (let i = 11; i >= 0; i--) {
    const dt = new Date(d.getFullYear(), d.getMonth() - i, 1);
    const key = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`;
    const short = dt.toLocaleString(undefined, { month: "short" });
    out.push({ key, label: `${short} ${String(dt.getFullYear()).slice(-2)}` });
  }
  return out;
}
function Tile({ title, value, sub }) {
  return (
    <div
      className="dashboard-card overview-tile"
      style={{ minHeight: 94, display: "flex", alignItems: "center", borderRadius: 14 }}
    >
      <div style={{ padding: 12 }}>
        <div style={{ fontWeight: 700, color: "var(--brand-primary,#0b3654)" }}>
          {title}
        </div>
        <div className="overview-number" style={{ lineHeight: 1, marginTop: 6 }}>
          {value}
        </div>
        {sub ? <div className="overview-sub">{sub}</div> : null}
      </div>
    </div>
  );
}
function LineChart({ seriesA = [], seriesB = [], labels = [], height = 180 }) {
  const padding = { left: 36, right: 8, top: 8, bottom: 22 };
  const width = 620;
  const w = width - padding.left - padding.right;
  const h = height - padding.top - padding.bottom;
  const maxVal = Math.max(1, ...seriesA, ...seriesB);
  const mkPts = (arr) =>
    arr
      .map(
        (v, i) =>
          `${(i / (arr.length - 1 || 1)) * w + padding.left},${(1 - v / maxVal) * h + padding.top}`
      )
      .join(" ");
  const yTicks = 4;
  const yVals = Array.from({ length: yTicks + 1 }, (_, i) =>
    Math.round((maxVal * i) / yTicks)
  );
  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width: "100%", height }}>
      {yVals.map((v, i) => {
        const y = (1 - v / maxVal) * h + padding.top;
        return (
          <line
            key={i}
            x1={padding.left}
            y1={y}
            x2={width - padding.right}
            y2={y}
            stroke="#E5E7EB"
          />
        );
      })}
      {yVals.map((v, i) => {
        const y = (1 - v / maxVal) * h + padding.top;
        return (
          <text key={i} x={8} y={y + 4} fontSize="11" fill="#6B7280">
            €{v.toLocaleString()}
          </text>
        );
      })}
      {labels.map((lab, i) => {
        const x = (i / (labels.length - 1 || 1)) * w + padding.left;
        return (
          <text key={i} x={x} y={height - 4} fontSize="11" fill="#6B7280" textAnchor="middle">
            {lab}
          </text>
        );
      })}
      <polyline
        fill="none"
        stroke="var(--brand-secondary,#f58220)"
        strokeWidth="2.5"
        points={mkPts(seriesA)}
      />
      <polyline
        fill="none"
        stroke="var(--brand-primary,#0b3654)"
        strokeWidth="2.5"
        points={mkPts(seriesB)}
      />
    </svg>
  );
}
function last4From(card) {
  if (!card) return "";
  if (card.last4) return String(card.last4);
  if (card.masked_pan) return String(card.masked_pan).slice(-4);
  return "";
}
function displayLabel(card, idx) {
  return card?.label || card?.alias || `Pas #${(idx ?? 0) + 1}`;
}

/* ---------- UI styles (in-file) ---------- */
const btnGhost = {
  background: "#fff",
  color: "var(--text,#0f172a)",
  WebkitTextFillColor: "var(--text,#0f172a)",
  border: "1px solid var(--border,#e5e7eb)",
  borderRadius: 10,
  padding: "10px 14px",
  fontWeight: 700,
  textDecoration: "none",
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  cursor: "pointer",
};

/* ---------- Kleine UI: OffersRow ---------- */
function OffersRow({ offers = [] }) {
  if (!offers || offers.length === 0) return null;
  return (
    <div
      style={{
        marginTop: 8,
        display: "grid",
        gap: 8,
        gridTemplateColumns: offers.length === 1 ? "1fr" : "1fr 1fr",
      }}
    >
      {offers.map((o, i) => (
        <div
          key={i}
          className="card"
          style={{
            display: "grid",
            gridTemplateColumns: o.imageUrl ? "84px 1fr auto" : "1fr auto",
            alignItems: "center",
            gap: 10,
            borderRadius: 12,
            background: "#f8fafc",
            border: "1px solid #e5e7eb",
            overflow: "hidden",
            padding: 8,
          }}
        >
          {o.imageUrl && (
            <div
              style={{
                width: 84,
                height: 60,
                borderRadius: 10,
                overflow: "hidden",
                background: "#eef2f7",
              }}
            >
              <img
                src={o.imageUrl}
                alt={o.title || "actie"}
                style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                loading="lazy"
              />
            </div>
          )}
          <div>
            <div style={{ fontWeight: 700, fontSize: 14, lineHeight: 1.2 }}>
              {o.title || "Actie"}
            </div>
            {o.subtitle && (
              <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>{o.subtitle}</div>
            )}
          </div>
          {o.badge && (
            <span
              style={{
                fontSize: 12,
                padding: "2px 10px",
                borderRadius: 999,
                background: "#e0f2fe",
                color: "#075985",
                fontWeight: 800,
                whiteSpace: "nowrap",
                justifySelf: "end",
                marginRight: 6,
              }}
            >
              {o.badge}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

/* ---------- Vergelijker ---------- */
function ComparatorPanel({ activeCard }) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState(null); // geen chip actief bij start
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState([]);
  const [err, setErr] = useState("");
  const [coords, setCoords] = useState(null);

  function useLocation() {
    if (!navigator.geolocation) {
      setErr("Locatie niet beschikbaar — toon demo.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (p) => {
        const c = { lat: p.coords.latitude, lng: p.coords.longitude };
        setCoords(c);
        search(c);
      },
      () => setErr("Locatie geweigerd — toon demo."),
      { enableHighAccuracy: true, timeout: 6000 }
    );
  }

  async function search(pos = coords) {
    setLoading(true);
    setErr("");
    try {
      let data;
      try {
        const qs = new URLSearchParams();
        if (query) qs.set("q", query);
        if (sort) qs.set("sort", sort);
        if (pos?.lat && pos?.lng) {
          qs.set("lat", pos.lat);
          qs.set("lng", pos.lng);
        }
        const r = await apiGet(`/api/stations/search?${qs.toString()}`);
        data = r;
      } catch {
        // Demo fallback
        data = {
          items: [
            {
              id: "1",
              brand: "Shell",
              city: "Amsterdam Zuidoost",
              price: 2.03,
              distance_km: 1.2,
              perks: ["+2 FuelinQ-punten"],
              offers: [{ title: "2ct/l korting", subtitle: "Alleen vandaag", badge: "Deal" }],
            },
            {
              id: "2",
              brand: "Tango",
              city: "Diemen",
              price: 1.98,
              distance_km: 3.1,
              perks: ["Actie: -2ct p/L vandaag"],
              offers: [
                { title: "1% cashback", subtitle: "Via app", badge: "Cashback" },
                { title: "+3 punten", subtitle: "Bij €20+", badge: "+3" },
              ],
            },
            {
              id: "3",
              brand: "TotalEnergies",
              city: "Centrum",
              price: 2.05,
              distance_km: 5.4,
              perks: ["1% cashback via app"],
              offers: [],
            },
          ],
        };
      }
      setItems(Array.isArray(data.items) ? data.items : []);
    } catch {
      setErr("Zoeken mislukt. Probeer later opnieuw.");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    search(); // init
  }, []); // eslint-disable-line

  async function quickFuel(station) {
    if (!activeCard?.id) {
      alert("Kies eerst een actieve pas op de Wallet-pagina.");
      return;
    }
    try {
      let url = "";
      try {
        const res = await apiPost("/api/transactions/start", {
          cardId: activeCard.id,
          stationId: station?.id || null,
        });
        url = res?.url || "";
      } catch {
        const res = await apiPost("/api/checkout/fuel", {
          cardId: activeCard.id,
          stationId: station?.id || null,
        });
        url = res?.url || "";
      }
      if (url) window.location.href = url;
      else alert("Transactie gestart (demo).");
    } catch (e) {
      alert(e.message || "Transactie starten mislukt");
    }
  }

  return (
    <section className="card p-4 stations-panel" style={{ borderRadius: 16 }}>
      <h3 style={{ marginTop: 0, marginBottom: 10, color: "var(--brand-primary,#0b3654)" }}>
        Tankstations vergelijken
      </h3>

      <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Zoek plaats, adres of station…"
          style={{ flex: 1, borderRadius: 10, border: "1px solid #e5e7eb", padding: "10px 12px" }}
        />
        <button className="btn" onClick={() => search()}>
          Zoeken
        </button>
      </div>

      {/* Filter chips */}
      <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
        <button
          type="button"
          className={`chip ${sort === "cheapest" ? "active" : ""}`}
          onClick={() => { setSort("cheapest"); search(); }}
        >
          Goedkoopst
        </button>
        <button
          type="button"
          className={`chip ${sort === "deals" ? "active" : ""}`}
          onClick={() => { setSort("deals"); search(); }}
        >
          Acties
        </button>
        <button
          type="button"
          className={`chip ${sort === "closest" ? "active" : ""}`}
          onClick={() => { setSort("closest"); search(); }}
        >
          Dichtstbijzijnde
        </button>
        <button type="button" className="chip" onClick={useLocation}>
          📍 Locatie
        </button>
      </div>

      {loading && <div style={{ padding: 12 }}>Laden…</div>}
      {err && <div style={{ padding: 12, color: "#b00020" }}>{err}</div>}

      <div style={{ display: "grid", gap: 10 }}>
        {items.map((s) => {
          const logo = s.logo || brandLogoUrl(s.brand);
          return (
            <div key={s.id}>
              {/* Stationkaart */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 12,
                  border: "1px solid #e5e7eb",
                  background: "#fff",
                  borderRadius: 14,
                  padding: 12,
                }}
              >
                <div style={{ display: "flex", gap: 10 }}>
                  {/* Logo of fallback */}
                  {logo ? (
                    <div
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 8,
                        overflow: "hidden",
                        background: "#F3F4F6",
                        display: "grid",
                        placeItems: "center",
                      }}
                    >
                      <img
                        src={logo}
                        alt={s.brand}
                        loading="lazy"
                        style={{ width: "100%", height: "100%", objectFit: "contain" }}
                        onError={(e) => { e.currentTarget.style.display = "none"; }}
                      />
                    </div>
                  ) : (
                    <div
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 8,
                        background: "#F3F4F6",
                        display: "grid",
                        placeItems: "center",
                        fontWeight: 700,
                        color: "#334155",
                      }}
                      aria-label={s.brand}
                      title={s.brand}
                    >
                      {s.brand?.[0] || "⛽"}
                    </div>
                  )}

                  <div>
                    <div style={{ fontWeight: 700 }}>
                      {s.brand} — {s.city}
                    </div>
                    <div style={{ fontSize: 12, color: "#6b7280" }}>
                      {s.perks?.[0] || "\u00A0"}
                    </div>
                  </div>
                </div>

                <div style={{ textAlign: "right", minWidth: 160 }}>
                  <div style={{ fontWeight: 800 }}>
                    {Number(s.price ?? 0).toFixed(2)}
                    <span style={{ fontWeight: 500 }}>/L</span>
                  </div>
                  <div style={{ fontSize: 12, color: "#6b7280" }}>
                    {s.distance_km ? `${s.distance_km} km` : ""}
                  </div>
                  <div style={{ display: "flex", gap: 8, marginTop: 6, justifyContent: "flex-end" }}>
                    {/* Route-knop in ghost style */}
                    <a
                      href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
                        `${s.brand} ${s.city}`
                      )}`}
                      target="_blank"
                      rel="noreferrer"
                      style={btnGhost}
                    >
                      Route
                    </a>
                    <button className="btn" onClick={() => quickFuel(s)} disabled={!activeCard?.id}>
                      Nu tanken
                    </button>
                  </div>
                  {!activeCard?.id && (
                    <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 4 }}>
                      Selecteer eerst een actieve pas
                    </div>
                  )}
                </div>
              </div>

              {/* Offers direct onder de kaart */}
              <OffersRow offers={s.offers || []} />
            </div>
          );
        })}
        {!loading && items.length === 0 && (
          <div className="muted" style={{ padding: 12 }}>
            Geen resultaten. Probeer een andere locatie.
          </div>
        )}
      </div>
    </section>
  );
}

/* ---------- Map & Recent ---------- */
function MapNearby() {
  const [pos, setPos] = useState({ lat: 52.3702, lng: 4.8952 });
  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (p) => setPos({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => {},
      { enableHighAccuracy: true, timeout: 5000 }
    );
  }, []);
  const src = `https://www.google.com/maps?q=tankstation%20near%20${pos.lat},${pos.lng}&z=13&output=embed`;
  return (
    <div className="card p-0" style={{ overflow: "hidden", borderRadius: 16 }}>
      <div style={{ padding: 12, display: "flex", justifyContent: "space-between" }}>
        <div style={{ fontWeight: 700, color: "var(--brand-primary,#0b3654)" }}>
          Tankstations in de buurt
        </div>
        <a
          className="muted"
          href={`https://maps.google.com/?q=tankstation near ${pos.lat},${pos.lng}`}
          target="_blank"
          rel="noreferrer"
        >
          Open in Maps ↗
        </a>
      </div>
      <iframe
        title="map"
        src={src}
        style={{ width: "100%", height: 260, border: 0 }}
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
      />
    </div>
  );
}
function RecentTransactions({ items }) {
  return (
    <div className="card p-4" style={{ borderRadius: 16 }}>
      <div style={{ fontWeight: 700, color: "var(--brand-primary,#0b3654)", marginBottom: 8 }}>
        Recente transacties
      </div>
      {!items || items.length === 0 ? (
        <div className="muted">Nog geen transacties. Doe je eerste tankbeurt via “Nu tanken”.</div>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>Datum</th>
              <th>Station</th>
              <th>Liter</th>
              <th>€/L</th>
              <th>Totaal</th>
              <th>Punten</th>
            </tr>
          </thead>
          <tbody>
            {items.map((t, i) => (
              <tr key={i}>
                <td>{t.date}</td>
                <td>
                  {t.brand} — {t.city}
                </td>
                <td>{t.liters.toFixed(1)}</td>
                <td>€{t.pricePerL.toFixed(2)}</td>
                <td>€{(t.liters * t.pricePerL).toFixed(2)}</td>
                <td>{t.points}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

/* ---------- Page ---------- */
export default function Dashboard() {
  const [me, setMe] = useState(null);

  const [vehicles, setVehicles] = useState(0);
  const [passes, setPasses] = useState(0);
  const [openInvoices, setOpenInvoices] = useState(0);

  const [savingMonth, setSavingMonth] = useState(0);
  const [savingYtd, setSavingYtd] = useState(0);
  const [points, setPoints] = useState(0);

  // actieve pas op dashboard
  const [activeCard, setActiveCard] = useState(null);

  const months = useMemo(() => last12MonthLabels(), []);
  const [seriesPaid, setSeriesPaid] = useState([]);
  const [seriesSaved, setSeriesSaved] = useState([]);
  const [recent, setRecent] = useState([]);

  async function loadActiveCard() {
    try {
      const data = await apiGet("/api/cards/active");
      const id = data?.id ?? data?.card_id ?? null;
      setActiveCard(id ? data : null);
    } catch {
      setActiveCard(null);
    }
  }

  useEffect(() => {
    (async () => {
      try {
        const m = await apiGet("/me");
        setMe(m?.user || m);
      } catch {
        logout();
        return;
      }

      await loadActiveCard();

      try {
        const v = await apiGet("/api/vehicles").catch(() => []);
        setVehicles(Array.isArray(v) ? v.length : v?.length || 0);
      } catch {}
      try {
        const c = await apiGet("/api/cards").catch(() => ({ cards: [] }));
        const list = Array.isArray(c) ? c : c?.cards || [];
        setPasses(list.length);
      } catch {}
      try {
        const inv = await apiGet("/api/invoices").catch(() => ({ invoices: [] }));
        const arr = Array.isArray(inv) ? inv : inv?.invoices || [];
        setOpenInvoices(arr.filter((i) => (i.status || "").toLowerCase() !== "paid").length);

        const mapPaid = Object.fromEntries(months.map((m) => [m.key, 0]));
        arr.forEach((f) => {
          const key = (f.date || "").slice(0, 7);
          if (mapPaid[key] != null) mapPaid[key] += Number(f.amount || 0);
        });
        const paidEuros = months.map((m) => Math.round(mapPaid[m.key] / 100));
        const savedEuros = paidEuros.map((v) => Math.round(v * 0.06));
        setSeriesPaid(paidEuros);
        setSeriesSaved(savedEuros);
        setSavingMonth(savedEuros.at(-1) || 0);
        setSavingYtd(savedEuros.reduce((a, b) => a + b, 0));
      } catch {
        const paidEuros = months.map((_, i) => 200 + Math.round(Math.sin(i / 2) * 60) + i * 8);
        const savedEuros = paidEuros.map((v) => Math.round(v * 0.07));
        setSeriesPaid(paidEuros);
        setSeriesSaved(savedEuros);
        setSavingMonth(savedEuros.at(-1) || 0);
        setSavingYtd(savedEuros.reduce((a, b) => a + b, 0));
      }

      try {
        const pts = await apiGet("/api/loyalty").catch(() => ({ points: 0 }));
        setPoints(Number(pts?.points || 0));
      } catch {
        setPoints(420);
      }

      setRecent([
        { date: "26-09-2025", brand: "Shell", city: "Amsterdam", liters: 32.4, pricePerL: 2.03, points: 65 },
        { date: "24-09-2025", brand: "Tango", city: "Diemen", liters: 41.2, pricePerL: 1.98, points: 82 },
        { date: "20-09-2025", brand: "Total", city: "Centrum", liters: 27.8, pricePerL: 2.05, points: 55 },
      ]);
    })();
  }, [months]);

  async function startCheckout() {
    try {
      const { url } = await apiPost("/api/billing/checkout", {});
      if (url) window.location.href = url;
    } catch (e) {
      alert(e.message || "Checkout mislukt");
    }
  }
  async function openPortal() {
    try {
      const { url } = await apiPost("/api/billing/portal", {});
      if (url) window.location.href = url;
    } catch (e) {
      alert(e.message || "Portal mislukt");
    }
  }

  return (
    <div className="dash-wrap">
      <style>{`
        .dash-wrap { max-width: 1200px; margin: 0 auto; }
        .dash-grid {
          display: grid;
          grid-template-columns: repeat(12, minmax(0, 1fr));
          gap: 16px;
        }
        .quick-actions { grid-column: span 5; }
        .intro-note   { grid-column: span 7; }
        .stations-panel { grid-column: 1 / -1; }
        .half { grid-column: span 6; }
        .full { grid-column: 1 / -1; }

        .card { background:#fff; border:1px solid #e5e7eb; border-radius:16px; box-shadow:0 8px 24px rgba(69, 100, 238, 0.06); }
        .p-0{padding:0}.p-3{padding:12px}.p-4{padding:16px}
        .btn{background:#2563eb;color:#fff;border:0;border-radius:10px;padding:10px 14px;font-weight:800;cursor:pointer}
        .btn:hover{filter:brightness(.95)}
        .btn-outline{background:#fff;color:#111827;border:1px solid #e5e7eb;border-radius:10px;padding:10px 14px;font-weight:700}
        .muted{color:#6b7280}
        h3{margin:0 0 8px 0;color:var(--brand-primary,#0b3654)}

        /* Filter chips */
        .chip{
          border:1px solid var(--border,#e5e7eb);
          background:#fff; color:#0f172a;
          border-radius:9999px; padding:8px 12px;
          font-weight:700; cursor:pointer;
          transition:background .15s ease,color .15s ease,border-color .15s ease;
        }
        .chip:hover{ background:#f8fafc; }
        .chip.active{
          background:var(--brand-primary,#2563eb);
          color:#fff; border-color:transparent;
        }

        @media (max-width:1100px){
          .quick-actions{grid-column:1 / -1}
          .intro-note{grid-column:1 / -1}
        }
        @media (max-width:860px){
          .half{grid-column:1 / -1}
        }
      `}</style>

      {me && <UserBar me={me} />}

      {/* Actieve pas */}
      <div
        className="card p-4"
        style={{ borderRadius: 16, marginBottom: 12, border: "2px solid #2563eb", background: "#eff6ff" }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 18, color: "#1e40af" }}>Actieve pas</div>
            {activeCard ? (
              <>
                <div style={{ fontWeight: 700 }}>
                  {displayLabel(activeCard)}{" "}
                  <span
                    style={{
                      fontSize: 12,
                      padding: "2px 8px",
                      background: "#1e40af",
                      color: "#fff",
                      borderRadius: 999,
                      marginLeft: 8,
                    }}
                  >
                    actief
                  </span>
                </div>
                <div className="muted" style={{ fontSize: 13 }}>
                  {last4From(activeCard)
                    ? `**** **** **** ${last4From(activeCard)}`
                    : activeCard.plate
                    ? `Kenteken: ${activeCard.plate}`
                    : "—"}
                </div>
              </>
            ) : (
              <div className="muted">Nog geen actieve pas gekozen.</div>
            )}
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Link className="btn btn-outline" to="/app/wallet">
              Wissel pas
            </Link>
          </div>
        </div>
      </div>

      {/* KPI’s */}
      <div className="grid" style={{ gridTemplateColumns: "repeat(5, minmax(0,1fr))", gap: 12, marginBottom: 12 }}>
        <Tile title="Voertuigen" value={vehicles} sub="Actief geregistreerd" />
        <Tile title="Passen" value={passes} sub="In wallet / beheer" />
        <Tile title="Openstaande facturen" value={openInvoices} sub="Nog te betalen" />
        <Tile title="Besparing (maand)" value={`€${savingMonth.toLocaleString()}`} sub="Indicatief" />
        <Tile title="Punten saldo" value={points.toLocaleString()} sub="FuelinQ punten" />
      </div>

      {/* Bovenste rij + Vergelijker full width */}
      <div className="dash-grid" style={{ marginBottom: 16 }}>
        <section className="card p-4 quick-actions">
          <h3>Snel starten</h3>
          <p className="muted" style={{marginBottom:10}}>
            Gebruik de vergelijker om direct de beste tankbeurt te kiezen.
          </p>
          <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
            <Link className="btn btn-outline" to="/app/vehicles">+ Voertuig toevoegen</Link>
            <Link className="btn btn-outline" to="/app/wallet">Add to Apple Wallet</Link>
            <Link className="btn btn-outline" to="/app/wallet">Add to Google Wallet</Link>
            {!activeCard && <Link className="btn" to="/app/wallet">Selecteer actieve pas</Link>}
          </div>
        </section>

        <section className="card p-4 intro-note">
          <h3>Vergelijk & bespaar</h3>
          <p className="muted" style={{margin:0}}>
            Kies <b>Goedkoopst</b>, <b>Acties</b> of <b>Dichtstbijzijnde</b>, bekijk de route of start direct met <b>Nu tanken</b>.
            Je actieve pas wordt automatisch gebruikt en je spaart punten.
          </p>
        </section>

        {/* Vergelijker — FULL WIDTH */}
        <ComparatorPanel activeCard={activeCard} />
      </div>

      {/* Grafiek + Map */}
      <div className="dash-grid" style={{ marginBottom: 16 }}>
        <section className="card p-4 half">
          <div style={{ fontWeight: 700, marginBottom: 8, color: "var(--brand-primary,#0b3654)" }}>
            Kosten & besparing (laatste 12 maanden)
          </div>
          {seriesPaid.length ? (
            <LineChart seriesA={seriesPaid} seriesB={seriesSaved} labels={months.map((m) => m.label)} />
          ) : (
            <div className="muted">Geen data om te tonen.</div>
          )}
        </section>
        <section className="half">
          <MapNearby />
        </section>
      </div>

      {/* ⬇️ NIEUWE RIJ — CO₂ & RDW demo (FULL WIDTH) */}
      <div className="dash-grid" style={{ marginBottom: 16 }}>
        <section className="card p-4 full">
          <h3>CO₂ & RDW</h3>
          <p className="muted" style={{ marginTop: 0 }}>
            Zoek op kenteken (RDW), log demo-kilometerstanden en tankbeurten en bekijk het rapport (JWT) en de publieke preview.
          </p>
          <VehicleCo2Card />
        </section>
      </div>

      {/* Transacties + side kolom */}
      <div className="dash-grid">
        <section className="half">
          <RecentTransactions items={recent} />
        </section>
        <section className="half">
          <div className="grid" style={{ gap: 16 }}>
            <div className="card p-4" style={{ borderRadius: 16 }}>
              <div style={{ fontWeight: 700, color: "var(--brand-primary,#0b3654)", marginBottom: 8 }}>
                Punten & Rewards
              </div>
              <div className="muted" style={{ fontSize: 13 }}>Totaal: <b>{points.toLocaleString()} pts</b></div>
            </div>
            <div className="card p-4" style={{ borderRadius: 16 }}>
              <div style={{ fontWeight: 700, color: "var(--brand-primary,#0b3654)", marginBottom: 8 }}>
                Abonnement & facturering
              </div>
              <p className="muted" style={{ marginTop: 0 }}>
                Start je FuellinQ abonnement: <b>1 maand gratis*</b>. Daarna <b>€2,50 / maand</b>, maandelijks opzegbaar.
              </p>
              <div style={{ display: "flex", gap: 8 }}>
                <button className="btn" onClick={startCheckout}>
                  Start abonnement
                </button>
                <button className="btn btn-outline" onClick={openPortal}>
                  Beheer facturering
                </button>
              </div>
              <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>
                * Proefperiode van 1 maand. Daarna automatisch verlengd. Opzeggen kan altijd via het Billing Portal.
              </div>
            </div>
          </div>
        </section>
      </div>

      <div style={{ height: 16 }} />
    </div>
  );
}
