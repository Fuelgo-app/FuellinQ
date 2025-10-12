// src/pages/HomePage.jsx
import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { API_BASE } from "../api/partner";

/* ---------- Public API helpers ---------- */
async function fetchJson(url, opts) {
  const res = await fetch(url, opts);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

/** Haalt stations op met laatste prijzen + top-3 actieve offers */
async function fetchPublicStations({ q = "", limit = 50 } = {}) {
  const p = new URLSearchParams();
  if (q) p.set("q", q);
  p.set("limit", String(limit));
  return fetchJson(`${API_BASE}/api/partner/public/stations?${p.toString()}`);
}

/* ---------- Banner ---------- */
const bannerUrl = new URL("../assets/fuellinq-banner.png", import.meta.url).href;

/* ---------- Helpers ---------- */
const getToken = () => localStorage.getItem("token");
function isIOS() {
  if (typeof navigator === "undefined") return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
}
function fullAddress(st) {
  const line1 = [st.street, st.house_number].filter(Boolean).join(" ").trim();
  const line2 = [st.postcode, st.city].filter(Boolean).join(" ").trim();
  return [line1, line2].filter(Boolean).join(", ");
}
function mapsLink(st) {
  if (Number.isFinite(Number(st.lat)) && Number.isFinite(Number(st.lng))) {
    const q = encodeURIComponent(st.title || `${st.lat},${st.lng}`);
    if (isIOS()) return `http://maps.apple.com/?ll=${st.lat},${st.lng}&q=${q}`;
    return `https://www.google.com/maps/dir/?api=1&destination=${st.lat},${st.lng}`;
  }
  const addr = fullAddress(st);
  if (addr) {
    const enc = encodeURIComponent(addr);
    if (isIOS()) return `http://maps.apple.com/?q=${enc}`;
    return `https://www.google.com/maps/dir/?api=1&destination=${enc}`;
  }
  const guess = `${st.title || ""} ${st.city || ""}`.trim();
  const enc = encodeURIComponent(guess || "tankstation");
  if (isIOS()) return `http://maps.apple.com/?q=${enc}`;
  return `https://www.google.com/maps/dir/?api=1&destination=${enc}`;
}

/* ---------- Kleine UI ---------- */
const btnPrimary = {
  background: "#2563eb",
  color: "#fff",
  border: "none",
  borderRadius: 10,
  padding: "10px 14px",
  fontWeight: 700,
  cursor: "pointer",
  flex: 1,
  textDecoration: "none",           // 🔹 underline weghalen
  display: "inline-flex",           // 🔹 zorgt voor nette centrering
  alignItems: "center",
  justifyContent: "center",
  transition: "all .2s ease",
};
const btnSecondary = {
  background: "#f3f4f6",
  color: "#111827",
  textDecoration: "none",
  borderRadius: 10,
  padding: "10px 14px",
  fontWeight: 700,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  flex: 1,
  cursor: "pointer",
  transition: "all .2s ease",
};
const btnGhost = {
  background: "#fff",
  color: "var(--text,#0f172a)",
  WebkitTextFillColor: "var(--text,#0f172a)",
  border: "1px solid var(--border,#e5e7eb)",
  borderRadius: 10,
  padding: "10px 16px",
  fontWeight: 700,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
  textDecoration: "none",
  cursor: "pointer",
  transition: "all .2s ease",
};

/* ---------- Brand logos ---------- */

const BRAND_LOGOS = {
  shell: "/assets/brands/shell.png",
  tango: "/assets/brands/tango.png",
  totalenergies: "/assets/brands/totalenergies.png",
  bp: "/assets/brands/bp.png",
  esso: "/assets/brands/esso.png",
  tinq: "/assets/brands/tinq.png",
  q8: "/assets/brands/q8.png",
  texaco: "/assets/brands/texaco.png",
  avia: "/assets/brands/avia.png",
  argos: "/assets/brands/argos.png",
  ok: "/assets/brands/ok.png",
};
function BrandLogo({ brand, size = 28 }) {
  const key = String(brand || "").toLowerCase().trim();
  const [src, setSrc] = useState(BRAND_LOGOS[key] || "/assets/brands/generic.png");
  useEffect(() => { setSrc(BRAND_LOGOS[key] || "/assets/brands/generic.png"); }, [key]);
  return (
    <div
      aria-label={`${brand || "station"} logo`}
      title={brand || "Station"}
      style={{
        width: size + 8, height: size + 8, borderRadius: 8,
        background: "#F3F4F6", display: "grid", placeItems: "center", overflow: "hidden",
      }}
    >
      <img
        src={src} alt={brand || "brand"} width={size} height={size}
        style={{ width: size, height: size, objectFit: "contain", display: "block" }}
        onError={() => setSrc("/assets/brands/generic.png")} loading="lazy"
      />
    </div>
  );
}

/* ---------- OffersRow ---------- */
function OffersRow({ offers = [] }) {
  if (!offers || offers.length === 0) return null;
  return (
    <div style={{ marginTop: 8, display: "grid", gap: 8, gridTemplateColumns: offers.length === 1 ? "1fr" : "1fr 1fr" }}>
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
            <div style={{ width: 84, height: 60, borderRadius: 10, overflow: "hidden", background: "#eef2f7" }}>
              <img src={o.imageUrl} alt={o.title || "actie"} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} loading="lazy" />
            </div>
          )}
          <div>
            <div style={{ fontWeight: 700, fontSize: 14, lineHeight: 1.2 }}>{o.title || "Actie"}</div>
            {o.subtitle && <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>{o.subtitle}</div>}
          </div>
          {o.badge && (
            <span
              style={{
                fontSize: 12, padding: "2px 10px", borderRadius: 999,
                background: "#e0f2fe", color: "#075985", fontWeight: 800, whiteSpace: "nowrap",
                justifySelf: "end", marginRight: 6,
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

/* ---------- Titel helper ---------- */
function displayTitle({ brand, title }) {
  const b = (brand || "").trim();
  const t = (title || "").trim();
  if (b && t && b.toLowerCase() !== t.toLowerCase()) return `${b} — ${t}`;
  return t || b || "Onbekend station";
}

/* ---------- Station Card ---------- */
function StationCard({ station, loggedIn }) {
  const navigate = useNavigate();
  const { brand, city, distance_km, prices, offers } = station;
  const priceText = prices?.euro95 != null ? `${prices.euro95.toFixed(2)} / L` : "—";

  return (
    <div
      style={{
        borderRadius: 12, border: "1px solid #eceff3", padding: 16,
        display: "flex", flexDirection: "column", gap: 8, background: "#fff",
        boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <BrandLogo brand={brand} size={28} />
          <div>
            <div style={{ fontWeight: 700 }}>{displayTitle(station)}</div>
            <div style={{ fontSize: 13, color: "#6b7280" }}>
              {city || ""}{city ? " · " : ""}{distance_km?.toFixed?.(1)}{distance_km ? " km" : ""}
            </div>
          </div>
        </div>
        <div style={{ fontWeight: 800, fontSize: 18 }}>{priceText}</div>
      </div>

      <OffersRow offers={offers || []} />

      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
        <a href={mapsLink(station)} target="_blank" rel="noreferrer" style={btnGhost}>Route</a>
        <button
          style={btnPrimary}
          onClick={() => (loggedIn ? navigate("/app/wallet") : navigate("/login"))}
          title={loggedIn ? "Open Wallet om te tanken" : "Log in om te tanken"}
        >
          Nu tanken
        </button>
      </div>
    </div>
  );
}

/* ---------- Page ---------- */
export default function HomePage() {
  const [stations, setStations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [coords, setCoords] = useState(null);
  const [query, setQuery] = useState("");

  const loggedIn = !!getToken();

  const demo = useMemo(
    () => [
      {
        id: "1",
        brand: "Shell",
        title: "Shell Amsterdam Zuidoost",
        city: "Amsterdam",
        street: "PRAKTIJKSTRAAT",
        house_number: "1",
        postcode: "1000 AA",
        lat: 52.3077,
        lng: 4.9455,
        distance_km: 1.2,
        prices: { euro95: 2.03, diesel: 1.89 },
        offers: [
          { title: "Red Bull 2 voor €3", subtitle: "Alleen vandaag", badge: "Deal", imageUrl: "/offers/redbull.png" },
          { title: "Koffie + broodje", subtitle: "€3,95 (07–11u)", badge: "Combo", imageUrl: "/offers/broodje-coffee.png" },
        ],
      },
    ],
    []
  );

  const allDeals = useMemo(() => {
    const items = [];
    for (const s of stations) (s.offers || []).forEach((o) => items.push({ ...o, stationTitle: s.title }));
    return items.slice(0, 12);
  }, [stations]);

  function mapStationRow(r) {
    const priceObj = {};
    if (Array.isArray(r.prices)) {
      for (const p of r.prices) {
        const k = String(p.fuel_type || "").toLowerCase();
        priceObj[k] = Number(p.price_eur_l ?? p.price);
      }
    }
    const offersMapped = Array.isArray(r.offers)
      ? r.offers.map((o) => ({
          id: o.id, title: o.title, badge: o.badge || null, imageUrl: o.image_url || null, subtitle: o.subtitle || null,
        }))
      : [];
    const brandGuess = (r.title || "").split(/\s+/)[0] || "Station";
    return {
      id: r.id,
      brand: r.brand || brandGuess,
      title: r.title,
      city: r.city,
      street: r.street || r.address_line || null,
      house_number: r.house_number || r.housenumber || null,
      postcode: r.postcode || r.zip || null,
      lat: r.lat ?? r.latitude ?? null,
      lng: r.lng ?? r.longitude ?? null,
      distance_km: r.distance_km ?? undefined,
      prices: {
        euro95: priceObj["euro95"] ?? priceObj["e5"] ?? null,
        diesel: priceObj["diesel"] ?? priceObj["b7"] ?? null,
      },
      offers: offersMapped.slice(0, 3),
    };
  }

  async function loadPublicStations() {
    setLoading(true);
    setErr("");
    try {
      const resp = await fetchPublicStations({ q: query, limit: 50 });
      const rows = Array.isArray(resp) ? resp : (resp?.stations || resp?.rows || []);
      setStations(Array.isArray(rows) ? rows.map(mapStationRow) : []);
    } catch {
      setStations(demo);
      setErr("(Demo-data getoond tot de publieke feed live is)");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadPublicStations(); /* eslint-disable-next-line */ }, []);

  function getLocationAndLoad() {
    if (!navigator.geolocation) {
      setErr("Locatie niet beschikbaar — demo-stations getoond.");
      setStations(demo);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        setCoords({ lat: latitude, lng: longitude });
        loadPublicStations();
      },
      () => {
        setErr("Locatie geweigerd — demo-stations getoond.");
        setStations(demo);
      },
      { enableHighAccuracy: true, timeout: 7000 }
    );
  }

  function handleSearch(e) { e?.preventDefault?.(); loadPublicStations(); }

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(180deg,#ffffff, #f8fafc)" }}>
      <main
        style={{
          maxWidth: 1160, margin: "0 auto", padding: 20,
          display: "grid", gridTemplateColumns: "1.1fr 0.9fr", gap: 28, alignItems: "center",
        }}
      >
        {/* Left: HERO */}
        <section>
          <img
            src={bannerUrl}
            alt="Betalen met FuellinQ bij de pomp"
            style={{
              width: "100%", maxWidth: 620, height: 300, objectFit: "cover", objectPosition: "right center",
              borderRadius: 12, display: "block", margin: "0 0 16px 0", boxShadow: "0 6px 24px rgba(0,0,0,.10)",
            }}
          />

          <h1 style={{ fontSize: 56, lineHeight: 1.05, margin: "8px 0 12px", fontWeight: 800, letterSpacing: "-0.02em" }}>
            Welkom bij <span style={{ color: "#2563eb" }}>FuellinQ</span>
          </h1>

          <p style={{ fontSize: 18, color: "#4b5563", maxWidth: 620 }}>
            Maak een account aan, koppel jouw betaalpas aan FuellinQ en ontvang
            een <b>digitale FuellinQ tankpas</b> in je Apple/Google Wallet voor meer
            overzicht, meer korting en gratis <Link to="/about">FuellinQ spaarpunten</Link>!
          </p>

          {/* 🔵 Consumenten-demo (primair) + ⚪ Zakelijke demo (secundair) */}
          <div style={{ display: "flex", gap: 10, marginTop: 14, flexWrap: "wrap" }}>
            <Link to="/demo?audience=consumer" style={btnPrimary}>
              Bekijk consumenten-demo
            </Link>
            <Link to="/demo?audience=business" style={btnSecondary}>
              Zakelijke demo
            </Link>
          </div>

          {/* Wallet CTA’s */}
          <div style={{ display: "flex", gap: 12, marginTop: 16, flexWrap: "wrap" }}>
            <Link
              to="/app/wallet"
              style={{
                ...btnSecondary, background: "#000", color: "#fff",
                display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 16px",
              }}
            >
              <span role="img" aria-label="Apple"></span>
              Wallet toevoegen
            </Link>

            <Link to="/app/wallet" style={btnGhost}>
              <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden focusable="false">
                <path fill="#EA4335" d="M24 9.5c3.15 0 5.98 1.09 8.2 2.88l6.15-6.15C34.68 2.62 29.64 1 24 1 14.64 1 6.67 6.31 3 14.02l7.64 5.93C12.17 13.92 17.62 9.5 24 9.5z"/>
                <path fill="#4285F4" d="M46.5 24c0-1.69-.15-3.31-.45-4.86H24v9.2h12.7c-.55 2.96-2.18 5.47-4.63 7.16l7.1 5.5C43.83 36.9 46.5 30.92 46.5 24z"/>
                <path fill="#FBBC05" d="M10.64 19.95l-7.64-5.93C1.7 16.67 1 20.23 1 24c0 3.77.7 7.33 2 10.98l7.64 5.93C9.8 27.02 9.5 25.55 9.5 24c0-1.55.3-3.02 1.14-4.05z"/>
                <path fill="#34A853" d="M24 47c6.48 0 11.91-2.14 15.87-5.81l-7.1-5.5c-2.03 1.37-4.64 2.2-8.77 2.2-6.38 0-11.83-4.42-13.36-10.43l-7.64 5.93C6.67 41.69 14.64 47 24 47z"/>
              </svg>
              Google Wallet toevoegen
            </Link>
          </div>

          {/* Locatie CTA */}
          <div style={{ marginTop: 18 }}>
            <button style={btnPrimary} onClick={getLocationAndLoad}>
              Stations in de buurt
            </button>
            {coords ? (
              <span style={{ fontSize: 13, color: "#6b7280", marginLeft: 10 }}>
                📍 {coords.lat.toFixed(3)}, {coords.lng.toFixed(3)}
              </span>
            ) : null}
          </div>

          {err && <div style={{ marginTop: 10, fontSize: 13, color: "#6b7280" }}>{err}</div>}
        </section>

        {/* Right: STATIONS PANEL */}
        <aside>
          {!loggedIn && (
            <div style={{ display: "flex", gap: 12, justifyContent: "flex-end", marginBottom: 8 }}>
              <Link to="/login" style={{ fontWeight: 700, color: "#2563eb" }}>Log in</Link>
              <Link to="/signup" style={{ fontWeight: 700, color: "#2563eb" }}>Account aanmaken</Link>
            </div>
          )}

          <div
            style={{
              background: "#fff", borderRadius: 16, padding: 14,
              border: "1px solid #e5e7eb", boxShadow: "0 8px 24px rgba(2,6,23,0.06)",
            }}
          >
            {/* Search */}
            <form onSubmit={handleSearch} style={{ display: "flex", gap: 8, marginBottom: 12 }}>
              <input
                type="text" value={query} onChange={(e)=>setQuery(e.target.value)}
                placeholder="Zoek plaats, adres of station…"
                style={{ flex: 1, borderRadius: 10, border: "1px solid #e5e7eb", padding: "10px 12px", outline: "none" }}
              />
              <button type="submit" title="Zoeken"
                style={{ background: "#2563eb", color: "#fff", border: 0, borderRadius: 10, padding: "10px 16px", cursor: "pointer", fontWeight: 700 }}>
                Zoeken
              </button>
            </form>

            {/* Chips */}
            <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
              {["Goedkoopst", "Acties", "Dichtstbijzijnde"].map((f, i) => (
                <button
                  type="button" key={f}
                  style={{
                    border: i === 0 ? "1px solid transparent" : "1px solid #e5e7eb",
                    background: i === 0 ? "#2563eb" : "#f9fafb",
                    color: i === 0 ? "#fff" : "#111",
                    borderRadius: 999, padding: "8px 12px", fontWeight: 700, cursor: "pointer",
                  }}
                  onClick={handleSearch}
                >
                  {f}
                </button>
              ))}
              <button
                type="button" onClick={getLocationAndLoad}
                style={{
                  border: "1px solid #e5e7eb", background: "#fff", borderRadius: 999,
                  padding: "8px 12px", fontWeight: 700, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6,
                }}
              >
                <span>📍</span> Locatie
              </button>
            </div>

            {loading ? (
              <div style={{ padding: 16 }}>Stations laden…</div>
            ) : (
              <div style={{ display: "grid", gap: 12 }}>
                {stations.map((s) => (<StationCard key={s.id} station={s} loggedIn={loggedIn} />))}
                {!stations.length && (
                  <div style={{ padding: 16, fontSize: 14, color: "#6b7280", textAlign: "center" }}>
                    Geen resultaten. Probeer een andere zoekopdracht.
                  </div>
                )}
              </div>
            )}
          </div>
        </aside>
      </main>

      {/* “Alle deals” rail */}
      <section style={{ maxWidth: 1160, margin: "8px auto 0", padding: "0 20px 40px" }}>
        <h2 style={{ fontSize: 22, margin: "8px 0 12px", fontWeight: 800 }}>Alle deals</h2>
        {allDeals.length ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(240px,1fr))", gap: 12 }}>
            {allDeals.map((o, i) => (
              <div key={i} style={{ border: "1px solid #e5e7eb", borderRadius: 12, background: "#fff", overflow: "hidden" }}>
                {o.imageUrl ? (
                  <img src={o.imageUrl} alt={o.title || "deal"} style={{ width: "100%", height: 120, objectFit: "cover", display: "block" }} loading="lazy" />
                ) : (<div style={{ height: 120, background: "#f3f4f6" }} />)}
                <div style={{ padding: 10 }}>
                  <div style={{ fontWeight: 800, fontSize: 14 }}>{o.title || "Actie"}</div>
                  <div style={{ fontSize: 12, color: "#6b7280" }}>{o.stationTitle || ""}</div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ fontSize: 14, color: "#6b7280" }}>Nog geen deals zichtbaar.</div>
        )}
      </section>

      <footer
        style={{
          maxWidth: 1160, margin: "28px auto", padding: "0 20px 40px",
          color: "#6b7280", fontSize: 13, display: "flex", justifyContent: "space-between",
        }}
      >
        <div>© {new Date().getFullYear()} FuellinQ</div>
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
          <Link to="/terms">Algemene Voorwaarden</Link>
          <Link to="/privacy">Privacybeleid</Link>
          <Link to="/faq">Meest gestelde vragen</Link>
          <Link to="/contact">Contact</Link>
        </div>
      </footer>
    </div>
  );
}
