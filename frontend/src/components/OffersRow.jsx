// src/components/OffersRow.jsx
import React, { useEffect, useMemo, useState } from "react";

/**
 * OffersRow
 * Subtiele rij met 0–2 (configureerbaar) offers onder een stationkaart.
 * Filtert op brand & city (en optioneel stationId).
 *
 * Props:
 * - brand?: string
 * - city?: string
 * - stationId?: string|number
 * - max?: number = 2
 * - className?: string
 * - onOfferClick?: (offer) => void
 */

/* ---------- API base (Vite) ---------- */
const RAW_API = (import.meta.env.VITE_API_URL ?? "").trim();
const API_BASE = (RAW_API && RAW_API !== "/" ? RAW_API : "http://localhost:3001").replace(/\/+$/, "");

/* ---------- Kleine helpers ---------- */
const euro = (n) =>
  (typeof n === "number" ? n : Number(n || 0)).toLocaleString("nl-NL", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
  });

const PLACEHOLDER_IMG = "/assets/placeholder-product.png";

/* Eenvoudige in-memory cache om snelle her-renders te sparen */
const _cache = new Map();

/* Veilige fetch met abort + cache */
async function fetchOffers({ brand, city, stationId }) {
  const qs = new URLSearchParams();
  if (brand) qs.set("brand", brand);
  if (city) qs.set("city", city);
  if (stationId != null) qs.set("station", String(stationId));

  const url = `${API_BASE}/api/partner/public/offers?${qs.toString()}`;
  if (_cache.has(url)) return _cache.get(url);

  const controller = new AbortController();
  const p = (async () => {
    const r = await fetch(url, { signal: controller.signal });
    const data = await r.json().catch(() => ({}));
    // Backend kan {items:[...]} of direct [...] teruggeven
    const items = Array.isArray(data) ? data : (data.items || []);
    return items;
  })();

  // Bewaar promise in cache (deels om dubbele requests te bundelen)
  _cache.set(url, p);
  try {
    const items = await p;
    return items;
  } catch (e) {
    // bij error cache opschonen zodat volgende poging opnieuw kan
    _cache.delete(url);
    throw e;
  } finally {
    controller.abort(); // defensief
  }
}

/* Skeleton tile */
function OfferSkeleton() {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "56px 1fr",
        gap: 10,
        alignItems: "center",
        border: "1px solid #e5e7eb",
        background: "#fff",
        borderRadius: 12,
        padding: 8,
      }}
      aria-hidden
    >
      <div
        style={{
          width: 56,
          height: 56,
          borderRadius: 10,
          background: "#eef2f7",
        }}
      />
      <div style={{ minWidth: 0 }}>
        <div
          style={{
            height: 14,
            width: "70%",
            borderRadius: 6,
            background: "#eef2f7",
            marginBottom: 8,
          }}
        />
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <div
            style={{
              height: 18,
              width: 60,
              borderRadius: 999,
              background: "#eef2f7",
            }}
          />
          <div
            style={{
              height: 14,
              width: 48,
              borderRadius: 6,
              background: "#eef2f7",
            }}
          />
        </div>
      </div>
    </div>
  );
}

/** Subtiele rij met 0–2 offers onder elk station */
function OffersRowInner({ brand, city, stationId, max = 2, className, onOfferClick }) {
  const [offers, setOffers] = useState([]);
  const [loading, setLoading] = useState(true);

  const key = useMemo(() => {
    const b = (brand || "").toLowerCase();
    const c = (city || "").toLowerCase();
    const s = stationId != null ? String(stationId) : "";
    return `${b}|${c}|${s}|${max}`;
  }, [brand, city, stationId, max]);

  useEffect(() => {
    let alive = true;
    setLoading(true);

    (async () => {
      try {
        const items = await fetchOffers({ brand, city, stationId });
        if (!alive) return;
        setOffers((items || []).slice(0, max));
      } catch {
        if (!alive) return;
        setOffers([]);
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [key]);

  if (!loading && !offers.length) return null;

  return (
    <div
      className={className}
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: 10,
        marginTop: 10,
      }}
    >
      {loading
        ? Array.from({ length: Math.max(1, Math.min(2, max)) }).map((_, i) => <OfferSkeleton key={`sk-${i}`} />)
        : offers.map((o) => {
            const priceOk = Number.isFinite(o?.price_cents);
            const img = o?.image_url || PLACEHOLDER_IMG;

            return (
              <button
                key={o.id || `${o.title}-${o.badge}-${o.price_cents}`}
                type="button"
                onClick={() => onOfferClick?.(o)}
                style={{
                  display: "grid",
                  gridTemplateColumns: "56px 1fr",
                  gap: 10,
                  alignItems: "center",
                  border: "1px solid #e5e7eb",
                  background: "#fff",
                  borderRadius: 12,
                  padding: 8,
                  textAlign: "left",
                  cursor: onOfferClick ? "pointer" : "default",
                }}
                aria-label={o?.title || "Aanbieding"}
              >
                <img
                  src={img}
                  alt={o?.title || "Aanbieding"}
                  style={{ width: 56, height: 56, objectFit: "cover", borderRadius: 10 }}
                  loading="lazy"
                  onError={(e) => {
                    if (e.currentTarget.src !== PLACEHOLDER_IMG) {
                      e.currentTarget.src = PLACEHOLDER_IMG;
                    }
                  }}
                />
                <div style={{ minWidth: 0 }}>
                  <div
                    style={{
                      fontWeight: 800,
                      lineHeight: 1.15,
                      fontSize: 14,
                      color: "#111827",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                    title={o?.title}
                  >
                    {o?.title || "Onbekende aanbieding"}
                  </div>
                  <div style={{ display: "flex", gap: 6, marginTop: 4, alignItems: "center", minHeight: 20 }}>
                    {o?.badge ? (
                      <span
                        style={{
                          fontSize: 11,
                          padding: "2px 8px",
                          borderRadius: 999,
                          background: "#eef2ff",
                          color: "#1d4ed8",
                          fontWeight: 700,
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          maxWidth: 120,
                        }}
                        title={o.badge}
                      >
                        {o.badge}
                      </span>
                    ) : null}
                    {priceOk ? (
                      <span style={{ fontSize: 12, fontWeight: 800 }}>{euro(o.price_cents / 100)}</span>
                    ) : null}
                  </div>
                </div>
              </button>
            );
          })}
    </div>
  );
}

export default React.memo(OffersRowInner);
