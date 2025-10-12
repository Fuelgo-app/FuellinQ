// frontend/src/components/OverviewCards.jsx
import React from "react";
import { Link } from "react-router-dom";

/* -------------------- brand logo’s (fallback) -------------------- */
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
const brandKey = (v = "") => String(v).toLowerCase().replace(/[^a-z0-9]+/g, "");

/* -------------------- helpers -------------------- */
const nf = new Intl.NumberFormat("nl-NL", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const isIOS = () =>
  typeof navigator !== "undefined" && /iPad|iPhone|iPod/.test(navigator.userAgent);

function initials(name = "") {
  const parts = String(name).trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => (p[0] || "").toUpperCase()).join("");
}

function displayTitle(st) {
  const brand = (st.brand || "").trim();
  const title = (st.title || "").trim();
  if (brand && title && brand.toLowerCase() !== title.toLowerCase()) {
    return `${brand} — ${title}`;
  }
  return title || brand || "Onbekend station";
}

function minPriceEuro(st) {
  // ondersteunt:
  // - st.prices = [{ fuel_type, price_cents|price_eur_l }]
  // - st.prices = { euro95: 2.03, diesel: 1.99, ... }
  const p = st?.prices;

  if (Array.isArray(p)) {
    const euros = p
      .map((row) =>
        row?.price_eur_l != null
          ? Number(row.price_eur_l)
          : row?.price_cents != null
          ? Number(row.price_cents) / 100
          : null
      )
      .filter((v) => Number.isFinite(v));
    return euros.length ? Math.min(...euros) : null;
  }

  if (p && typeof p === "object") {
    const euros = Object.values(p)
      .map((v) => Number(v))
      .filter((v) => Number.isFinite(v));
    return euros.length ? Math.min(...euros) : null;
  }

  return null;
}

function mapsLink(st) {
  const title = displayTitle(st);
  if (Number.isFinite(+st?.lat) && Number.isFinite(+st?.lng)) {
    const q = encodeURIComponent(title);
    return isIOS()
      ? `http://maps.apple.com/?ll=${st.lat},${st.lng}&q=${q}`
      : `https://www.google.com/maps/dir/?api=1&destination=${st.lat},${st.lng}`;
  }
  const addr = [st.street, st.house_number, st.postcode, st.city]
    .filter(Boolean)
    .join(" ");
  const q = encodeURIComponent(addr || title);
  return isIOS()
    ? `http://maps.apple.com/?q=${q}`
    : `https://www.google.com/maps/dir/?api=1&destination=${q}`;
}

/* -------------------- kleine subcomponenten -------------------- */
function Badge({ children }) {
  return (
    <span
      style={{
        fontSize: 12,
        padding: "2px 8px",
        borderRadius: 999,
        background: "var(--chip-bg,#fff)",
        color: "var(--chip-text,#0f172a)",
        border: "1px solid var(--chip-border,#e5e7eb)",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </span>
  );
}

/* -------------------- kaartje per station -------------------- */
function StationItem({ st, onFuel, loggedIn }) {
  const key = brandKey(st.brand);
  const brandLogo =
    st.logo_url || st.brand_logo_url || BRAND_LOGOS[key] || null;

  const price = minPriceEuro(st);
  const priceLabel = price != null ? `${nf.format(price)} / L` : null;

  return (
    <div
      style={{
        border: "1px solid var(--border,#e5e7eb)",
        borderRadius: "var(--card-radius,12px)",
        padding: 14,
        background: "var(--card-bg,#fff)",
        color: "var(--card-text,var(--text,#0f172a))",
        boxShadow: "var(--shadow,0 1px 2px rgba(2,6,23,.04))",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 12,
          alignItems: "center",
          minWidth: 0,
        }}
      >
        <div style={{ display: "flex", gap: 10, alignItems: "center", minWidth: 0 }}>
          {/* Logo / Fallback */}
          {brandLogo ? (
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                background: "#fff",
                display: "grid",
                placeItems: "center",
                overflow: "hidden",
                border: "1px solid var(--border,#e5e7eb)",
              }}
            >
              <img
                src={brandLogo}
                alt={st.brand || st.title || "Station"}
                style={{ width: "100%", height: "100%", objectFit: "contain" }}
                loading="lazy"
                onError={(e) => (e.currentTarget.style.display = "none")}
              />
            </div>
          ) : (
            <div
              aria-label="Station"
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                background: "#f3f4f6",
                display: "grid",
                placeItems: "center",
                fontSize: 10,
                fontWeight: 700,
                color: "#64748b",
                border: "1px solid var(--border,#e5e7eb)",
              }}
            >
              {initials(st.title || st.brand)}
            </div>
          )}

          <div style={{ minWidth: 0 }}>
            <div
              title={displayTitle(st)}
              style={{
                fontWeight: 700,
                color: "var(--text,#0f172a)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                maxWidth: "40ch",
              }}
            >
              {displayTitle(st)}
            </div>
            <div
              style={{
                fontSize: 13,
                color: "var(--muted,#64748b)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                maxWidth: "44ch",
              }}
            >
              {(st.city || "").trim() || (st.postcode || "").trim()}
              {st.distance_km ? ` · ${Number(st.distance_km).toFixed(1)} km` : ""}
            </div>
          </div>
        </div>

        {priceLabel && (
          <div style={{ textAlign: "right", minWidth: 120 }}>
            <div style={{ fontWeight: 800, fontSize: 18, color: "var(--text,#0f172a)" }}>
              {priceLabel}
            </div>
          </div>
        )}
      </div>

      {/* Offers */}
      {Array.isArray(st.offers) && st.offers.length > 0 ? (
        <div
          style={{
            marginTop: 10,
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 8,
          }}
        >
          {st.offers.slice(0, 2).map((o, idx) => (
            <div
              key={o.id || idx}
              style={{
                display: "grid",
                gridTemplateColumns: o.image_url || o.imageUrl ? "64px 1fr auto" : "1fr auto",
                alignItems: "center",
                gap: 10,
                border: "1px solid var(--border,#e5e7eb)",
                borderRadius: 12,
                padding: 8,
                background: "var(--surface,#fff)",
              }}
            >
              {(o.image_url || o.imageUrl) && (
                <div
                  style={{
                    width: 64,
                    height: 48,
                    borderRadius: 10,
                    overflow: "hidden",
                    background: "#f1f5f9",
                  }}
                >
                  <img
                    src={o.image_url || o.imageUrl}
                    alt={o.title || "actie"}
                    style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                    loading="lazy"
                  />
                </div>
              )}
              <div style={{ minWidth: 0 }}>
                <div
                  title={o.title}
                  style={{
                    fontWeight: 600,
                    color: "var(--text,#0f172a)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {o.title || "Actie"}
                </div>
                {o.price_cents != null && (
                  <div style={{ fontSize: 12, color: "var(--muted,#64748b)" }}>
                    € {nf.format(Number(o.price_cents) / 100)}
                  </div>
                )}
              </div>
              {o.badge && <Badge>{o.badge}</Badge>}
            </div>
          ))}
        </div>
      ) : (
        <div style={{ marginTop: 10, fontSize: 13, color: "var(--muted,#64748b)" }}>
          Geen acties op dit moment.
        </div>
      )}

      {/* Knoppen */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 10 }}>
        <a
          href={mapsLink(st)}
          target="_blank"
          rel="noreferrer"
          style={{
            border: "1px solid var(--border,#e5e7eb)",
            background: "var(--chip-bg,#fff)",
            color: "var(--text,#0f172a)",
            borderRadius: "var(--btn-radius,12px)",
            padding: "10px 12px",
            textAlign: "center",
            fontWeight: 700,
            textDecoration: "none",
          }}
        >
          Route
        </a>

        {typeof onFuel === "function" ? (
          <button
            type="button"
            onClick={() => onFuel(st)}
            style={{
              background: "var(--btn-bg,var(--brand-primary,#2563eb))",
              color: "var(--btn-text,#fff)",
              border: 0,
              borderRadius: "var(--btn-radius,12px)",
              padding: "10px 12px",
              fontWeight: 800,
              cursor: "pointer",
            }}
          >
            Nu tanken
          </button>
        ) : (
          <Link
            to={loggedIn ? "/app/wallet" : "/login"}
            style={{
              background: "var(--btn-bg,var(--brand-primary,#2563eb))",
              color: "var(--btn-text,#fff)",
              borderRadius: "var(--btn-radius,12px)",
              padding: "10px 12px",
              textAlign: "center",
              fontWeight: 800,
              textDecoration: "none",
            }}
          >
            Nu tanken
          </Link>
        )}
      </div>
    </div>
  );
}

/* -------------------- lijst van stations -------------------- */
export default function OverviewCards({ stations = [], onFuel, loggedIn = false }) {
  if (!stations?.length) {
    return <div style={{ fontSize: 14, color: "var(--muted,#64748b)" }}>Geen stations gevonden.</div>;
  }
  return (
    <div style={{ display: "grid", gap: 12 }}>
      {stations.map((st) => (
        <StationItem key={st.id || `${st.brand}-${st.title}`} st={st} onFuel={onFuel} loggedIn={loggedIn} />
      ))}
    </div>
  );
}
