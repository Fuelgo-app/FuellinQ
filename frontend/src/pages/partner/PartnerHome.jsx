// src/pages/partner/PartnerHome.jsx
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import PartnerLayout from "../../components/PartnerLayout.jsx";

// ⬇️ Gebruik een namespace import: er is geen crash als functies ontbreken
import * as partnerApi from "../../api/partner.js";

/** Kleine card helper (zonder extra libs) */
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

function Pill({ children, tone = "default" }) {
  const tones = {
    default: { bg: "#f3f4f6", fg: "#111827", bd: "#e5e7eb" },
    good: { bg: "#ecfdf5", fg: "#065f46", bd: "#a7f3d0" },
    warn: { bg: "#fffbeb", fg: "#92400e", bd: "#fde68a" },
    bad: { bg: "#fef2f2", fg: "#991b1b", bd: "#fecaca" },
  }[tone];
  return (
    <span
      style={{
        display: "inline-block",
        padding: "4px 10px",
        borderRadius: 999,
        background: tones.bg,
        color: tones.fg,
        border: `1px solid ${tones.bd}`,
        fontSize: 12,
        fontWeight: 600,
      }}
    >
      {children}
    </span>
  );
}

function Stat({ label, value, hint }) {
  return (
    <div style={{ padding: 12 }}>
      <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 800, lineHeight: "28px" }}>{value}</div>
      {hint && <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 4 }}>{hint}</div>}
    </div>
  );
}

/* ---------- Kleine helpers ---------- */
const fmtDateTime = (v) => {
  if (!v) return "—";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "—";
  try {
    return d.toLocaleString("nl-NL");
  } catch {
    return d.toLocaleString();
  }
};
const fmtEuro = (n) => (typeof n === "number" && Number.isFinite(n) ? `€ ${n.toFixed(3)}` : "—");

/* Brandstoftypes voor grid (match met jouw PricesPage) */
const FUEL_TYPES = [
  ["euro95", "Euro 95"],
  ["e5_98", "E5 98"],
  ["e10", "E10"],
  ["diesel", "Diesel"],
  ["diesel_plus", "Diesel Plus"],
  ["lpg", "LPG"],
  ["ac_kwh", "AC kWh"],
  ["dc_kwh", "DC kWh"],
];

export default function PartnerHome() {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const [health, setHealth] = useState(null);
  const [stations, setStations] = useState([]);
  const [offers, setOffers] = useState([]);
  const [latestPrices, setLatestPrices] = useState(null);

  useEffect(() => {
    let mounted = true;

    async function run() {
      setLoading(true);
      setErr("");
      try {
        // ⬇️ Veilig aanroepen met optional chaining; bestaat de functie niet, dan gebeurt er niks
        const [h, st, ofr, price] = await Promise.allSettled([
          partnerApi.partnerHealth?.(),
          partnerApi.listStations?.(),
          partnerApi.listOffers?.({ limit: 5, status: "active_or_scheduled" }),
          partnerApi.getLatestPrices?.(),
        ]);

        if (!mounted) return;

        if (h.status === "fulfilled") setHealth(h.value ?? null);
        if (st.status === "fulfilled") {
          const arr = Array.isArray(st.value) ? st.value : (st.value?.rows || []);
          setStations(arr || []);
        }
        if (ofr.status === "fulfilled") {
          const arr = Array.isArray(ofr.value) ? ofr.value : (ofr.value?.rows || []);
          setOffers(arr || []);
        }
        if (price.status === "fulfilled") setLatestPrices(price.value ?? null);
      } catch (e) {
        if (mounted) setErr(e?.message || "Kon home-data niet laden");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    run();
    return () => {
      mounted = false;
    };
  }, []);

  /* Afgeleide statistieken */
  const stationCount = stations?.length || 0;
  const activeOffers = (offers || []).length;

  const lastPriceUpdatedAt = useMemo(() => {
    if (!latestPrices) return null;

    const ts =
      latestPrices.updatedAt ||
      latestPrices.updated_at ||
      latestPrices.last_update ||
      null;
    if (ts) return ts;

    const flat = Array.isArray(latestPrices) ? latestPrices : latestPrices?.rows;
    if (!flat || !flat.length) return null;

    const maxTs = flat
      .map((r) => new Date(r.updated_at || r.updatedAt || r.created_at || 0).getTime())
      .filter((n) => Number.isFinite(n))
      .reduce((a, b) => Math.max(a, b), 0);

    return maxTs ? new Date(maxTs).toISOString() : null;
  }, [latestPrices]);

  const healthTone =
    health?.status === "ok" || health?.ok ? "good" : health?.status === "warn" ? "warn" : "bad";

  return (
    <PartnerLayout title="Partner Home">
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          marginBottom: 16,
          flexWrap: "wrap",
        }}
      >
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800 }}>Welkom terug 👋</h1>
        <div style={{ flex: 1 }} />
        <Pill tone={healthTone}>
          {health?.message || (health?.ok ? "Systeem OK" : "Status onbekend")}
        </Pill>
      </div>

      {err && (
        <div
          style={{
            marginBottom: 16,
            padding: 12,
            borderRadius: 12,
            background: "#fef2f2",
            color: "#991b1b",
            border: "1px solid #fecaca",
          }}
        >
          {String(err)}
        </div>
      )}

      {/* Grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(12, 1fr)",
          gap: 16,
        }}
      >
        {/* Stats */}
        <div style={{ gridColumn: "span 12" }}>
          <Card>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(12, 1fr)",
                gap: 8,
              }}
            >
              <div style={{ gridColumn: "span 12", display: "flex", gap: 8, flexWrap: "wrap" }}>
                <Stat label="Stations" value={loading ? "…" : stationCount} />
                <Stat label="Actieve/Scheduled aanbiedingen" value={loading ? "…" : activeOffers} />
                <Stat
                  label="Laatste prijsupdate"
                  value={loading ? "…" : fmtDateTime(lastPriceUpdatedAt)}
                  hint="Geef actuele prijzen door voor betere zichtbaarheid"
                />
              </div>
            </div>
          </Card>
        </div>

        {/* Prijsstatus */}
        <div style={{ gridColumn: "span 7" }}>
          <Card title="Prijsstatus" right={<Link to="/partner/prices">Beheer prijzen →</Link>}>
            {loading ? (
              <div style={{ color: "#6b7280" }}>Laden…</div>
            ) : (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                  gap: 8,
                }}
              >
                {FUEL_TYPES.map(([key, label]) => {
                  const entry =
                    latestPrices?.[key] ||
                    latestPrices?.prices?.[key] ||
                    (Array.isArray(latestPrices)
                      ? latestPrices.find((r) => r.fuel_type === key || r.type === key)
                      : null);

                  const price =
                    typeof entry === "number"
                      ? entry
                      : entry?.price || entry?.amount || entry?.value;

                  const ts = entry?.updated_at || entry?.updatedAt || latestPrices?.updatedAt;
                  const n = typeof price === "string" ? Number(price) : price;

                  return (
                    <div
                      key={key}
                      style={{
                        border: "1px solid #e5e7eb",
                        borderRadius: 12,
                        padding: 10,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                      }}
                    >
                      <div style={{ fontWeight: 600 }}>{label}</div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontWeight: 800 }}>{fmtEuro(n)}</div>
                        <div style={{ fontSize: 11, color: "#9ca3af" }}>{fmtDateTime(ts)}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </div>

        {/* Recente aanbiedingen */}
        <div style={{ gridColumn: "span 5" }}>
          <Card title="Recente aanbiedingen" right={<Link to="/partner/offers">Alle aanbiedingen →</Link>}>
            {loading ? (
              <div style={{ color: "#6b7280" }}>Laden…</div>
            ) : offers?.length ? (
              <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                {offers.slice(0, 5).map((o) => (
                  <li
                    key={o.id || o.slug || o.title}
                    style={{
                      border: "1px solid #e5e7eb",
                      borderRadius: 12,
                      padding: 10,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      marginBottom: 8,
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <div
                        style={{
                          fontWeight: 700,
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {o.title || "Aanbieding"}
                      </div>
                      <div style={{ fontSize: 12, color: "#6b7280" }}>
                        {(o.status || "draft")} · {fmtDateTime(o.starts_at || o.created_at)}
                      </div>
                    </div>
                    <Link to={`/partner/offers/${o.id || ""}`}>Open</Link>
                  </li>
                ))}
              </ul>
            ) : (
              <div style={{ color: "#6b7280" }}>Nog geen aanbiedingen.</div>
            )}
          </Card>
        </div>

        {/* Stations overzicht */}
        <div style={{ gridColumn: "span 7" }}>
          <Card title="Stations" right={<Link to="/partner/stations">Beheer stations →</Link>}>
            {loading ? (
              <div style={{ color: "#6b7280" }}>Laden…</div>
            ) : stations?.length ? (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8 }}>
                {stations.slice(0, 6).map((s) => (
                  <div
                    key={s.id}
                    style={{
                      border: "1px solid #e5e7eb",
                      borderRadius: 12,
                      padding: 10,
                    }}
                  >
                    <div style={{ fontWeight: 700, marginBottom: 4 }}>
                      {s.title || s.name || "Station"}
                    </div>
                    <div style={{ fontSize: 12, color: "#6b7280" }}>
                      {(s.address || s.street || "")} {s.house_number || ""}{" "}
                      {s.city ? `· ${s.city}` : ""}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ color: "#6b7280" }}>Nog geen stations.</div>
            )}
          </Card>
        </div>

        {/* Snelle acties */}
        <div style={{ gridColumn: "span 5" }}>
          <Card title="Snelle acties">
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8 }}>
              <QuickLink to="/partner/stations/new" label="Nieuw station" hint="Voeg locatie toe" />
              <QuickLink to="/partner/prices" label="Prijs insturen" hint="Update brandstof-/kWh-prijs" />
              <QuickLink to="/partner/offers/new" label="Nieuwe aanbieding" hint="Maak een promotie" />
              <QuickLink to="/partner/settings" label="Instellingen" hint="Merk, openingstijden, etc." />
            </div>
          </Card>
        </div>
      </div>
    </PartnerLayout>
  );
}

function QuickLink({ to, label, hint }) {
  return (
    <Link
      to={to}
      style={{
        display: "block",
        border: "1px solid #e5e7eb",
        borderRadius: 12,
        padding: 12,
        textDecoration: "none",
        color: "#111827",
        boxShadow: "0 3px 10px rgba(2,6,23,.04)",
      }}
    >
      <div style={{ fontWeight: 800 }}>{label}</div>
      <div style={{ fontSize: 12, color: "#6b7280" }}>{hint}</div>
    </Link>
  );
}
