// src/pages/partner/OffersPage.jsx
import React from "react";
import { useLocation, useNavigate } from "react-router-dom";
import PartnerLayout from "../../../components/PartnerLayout.jsx";
import OfferEditor from "@/components/OfferEditor.jsx";
import { apiFetch, API_BASE } from "@/api/base.js";

/* ---------------- Helpers ---------------- */
function useQuery() {
  const { search } = useLocation();
  return React.useMemo(() => new URLSearchParams(search), [search]);
}

// Auth header via localStorage token (partner routes zijn beschermd)
function authHeaders(extra = {}) {
  const token = localStorage.getItem("token") || "";
  return {
    ...(extra || {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

// Kleine debounce helper
function useDebouncedValue(value, delay = 300) {
  const [v, setV] = React.useState(value);
  React.useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
}

/* --------------- Gallery thumb --------------- */
function GalleryTile({ offer, onClick }) {
  const pct = Number(offer.discount_percent || 0);
  return (
    <button
      type="button"
      onClick={onClick}
      className="relative group rounded-xl overflow-hidden border hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-300 bg-white"
      title={offer.title || "Aanbieding"}
      aria-label={offer.title || "Aanbieding"}
    >
      {/* square crop */}
      <div className="w-full aspect-square bg-gray-100">
        {/* eslint-disable-next-line jsx-a11y/img-redundant-alt */}
        <img
          src={offer.image_url || offer.image || "/assets/placeholder-4x3.jpg"}
          alt={offer.title ? `Afbeelding van ${offer.title}` : "Aanbieding afbeelding"}
          loading="lazy"
          className="w-full h-full object-cover"
          onError={(e) => {
            e.currentTarget.src = "/assets/placeholder-4x3.jpg";
          }}
        />
      </div>

      {/* overlay + title on hover */}
      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
      {offer.title && (
        <div className="absolute bottom-0 left-0 right-0 p-2 text-[11px] text-white/95 bg-gradient-to-t from-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="line-clamp-2 leading-tight">{offer.title}</div>
        </div>
      )}

      {/* discount badge */}
      {pct > 0 && (
        <span className="absolute top-1.5 right-1.5 text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
          -{pct}%
        </span>
      )}
    </button>
  );
}

/* -------------------- Page -------------------- */
export default function OffersPage() {
  const q = useQuery();
  const navigate = useNavigate();

  // Init uit URL
  const stationParam = q.get("station");
  const [activeTab, setActiveTab] = React.useState("gallery"); // "gallery" | "editor"
  const [stationId, setStationId] = React.useState(stationParam ? String(Number(stationParam)) : "");
  const debouncedStation = useDebouncedValue(stationId, 350);

  // Selection -> opent Editor met vooraf gekozen offer
  const [selectedOfferId, setSelectedOfferId] = React.useState(null);

  // Data
  const [offers, setOffers] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [reloadTick, setReloadTick] = React.useState(0); // bump om te verversen

  // Sync URL (alleen wanneer station verandert t.o.v. huidige query)
  React.useEffect(() => {
    const current = new URLSearchParams(window.location.search);
    const currStation = current.get("station") || "";
    const nextStation = debouncedStation ? String(Number(debouncedStation)) : "";
    if (currStation !== nextStation) {
      if (nextStation) current.set("station", nextStation);
      else current.delete("station");
      navigate({ search: `?${current.toString()}` }, { replace: true });
    }
  }, [debouncedStation, navigate]);

  // Fetch offers wanneer filter of reload wijzigt
  React.useEffect(() => {
    let isCancelled = false;
    async function run() {
      try {
        setLoading(true);
        setError("");

        // Bouw URL met optionele station_id
        const url = new URL(`${API_BASE}/api/partner/offers`);
        if (debouncedStation) url.searchParams.set("station_id", String(Number(debouncedStation)));

        const data = await apiFetch(url.pathname + url.search, {
          method: "GET",
          headers: authHeaders(),
        });

        const items = Array.isArray(data) ? data : data.offers || data.items || [];
        const norm = items.map((o) => ({
          id: o.id ?? o._id,
          title: o.title ?? o.name ?? "",
          image_url: o.image_url ?? o.image ?? "",
          discount_percent: o.discount_percent ?? 0,
        }));

        if (!isCancelled) setOffers(norm);
      } catch (e) {
        console.error(e);
        if (!isCancelled) {
          setError("Kon aanbiedingen niet laden.");
          setOffers([]);
        }
      } finally {
        if (!isCancelled) setLoading(false);
      }
    }
    run();
    return () => {
      isCancelled = true;
    };
  }, [debouncedStation, reloadTick]);

  function resetFilter() {
    setStationId("");
    const sp = new URLSearchParams(window.location.search);
    sp.delete("station");
    navigate({ search: `?${sp.toString()}` }, { replace: true });
  }

  function refreshNow() {
    setReloadTick((t) => t + 1);
  }

  return (
    <PartnerLayout>
      <div id="partner-offers" className="w-full max-w-7xl mx-auto p-4">
        {/* Header */}
        <header className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-2xl font-semibold">Acties &amp; Deals</h2>
            {debouncedStation ? (
              <p className="text-sm text-gray-500">Gefilterd op station ID {debouncedStation}</p>
            ) : (
              <p className="text-sm text-gray-500">Beheer aanbiedingen — switch tussen galerij en editor.</p>
            )}
          </div>

          {/* Tabs */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab("gallery")}
              className={`px-3 py-1.5 rounded-lg border ${
                activeTab === "gallery" ? "bg-[var(--brand-primary,#0b3654)] text-white" : "bg-white"
              }`}
              aria-pressed={activeTab === "gallery"}
            >
              Gallery
            </button>
            <button
              onClick={() => setActiveTab("editor")}
              className={`px-3 py-1.5 rounded-lg border ${
                activeTab === "editor" ? "bg-[var(--brand-primary,#0b3654)] text-white" : "bg-white"
              }`}
              aria-pressed={activeTab === "editor"}
            >
              Editor
            </button>
          </div>
        </header>

        {/* Toolbar */}
        <div className="mb-4 flex items-center gap-2 flex-wrap">
          <label className="text-sm text-gray-600">Station ID</label>
          <input
            inputMode="numeric"
            value={stationId}
            onChange={(e) => setStationId(e.target.value.replace(/\D/g, ""))}
            onBlur={() => setStationId((v) => (v ? String(Number(v)) : ""))}
            placeholder="bijv. 123"
            className="px-3 py-2 border rounded-lg text-sm w-32"
            aria-label="Station ID filter"
          />
          <button onClick={resetFilter} className="px-3 py-2 border rounded-lg text-sm">
            Reset filter
          </button>
          <button onClick={refreshNow} className="px-3 py-2 border rounded-lg text-sm">
            Opnieuw laden
          </button>
          <div className="grow" />
          <button
            onClick={() => {
              setSelectedOfferId(null);
              setActiveTab("editor");
            }}
            className="px-3 py-2 rounded-lg text-sm text-white"
            style={{ background: "var(--brand-primary, #0b3654)" }}
          >
            + Nieuw aanbod
          </button>
        </div>

        {/* Content */}
        {activeTab === "gallery" ? (
          <section>
            {error && (
              <div className="mb-3 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
                {error}{" "}
                <button className="underline ml-2" onClick={refreshNow}>
                  Opnieuw proberen
                </button>
              </div>
            )}

            {loading ? (
              <div className="grid gap-2" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))" }}>
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="aspect-square rounded-xl border bg-gray-100 animate-pulse" />
                ))}
              </div>
            ) : offers.length === 0 ? (
              <div className="p-6 border rounded-xl bg-white">
                <p className="text-sm text-gray-600">Nog geen aanbiedingen.</p>
                <div className="mt-3">
                  <button
                    onClick={() => {
                      setSelectedOfferId(null);
                      setActiveTab("editor");
                    }}
                    className="px-3 py-2 rounded-lg text-sm text-white"
                    style={{ background: "var(--brand-primary, #0b3654)" }}
                  >
                    + Maak je eerste aanbieding
                  </button>
                </div>
              </div>
            ) : (
              <div
                className="grid gap-2"
                style={{ gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))" }}
              >
                {offers.map((offer) => (
                  <GalleryTile
                    key={offer.id}
                    offer={offer}
                    onClick={() => {
                      setSelectedOfferId(offer.id || null);
                      setActiveTab("editor");
                    }}
                  />
                ))}
              </div>
            )}
          </section>
        ) : (
          <section>
            {/* De volledige CRUD + lijst + uploader zit in OfferEditor */}
            <OfferEditor
              stationId={debouncedStation ? Number(debouncedStation) : null}
              initialOfferId={selectedOfferId}
              onClose={() => {
                setActiveTab("gallery");
                refreshNow();
              }}
              onSaved={() => {
                setActiveTab("gallery");
                refreshNow();
              }}
            />
          </section>
        )}
      </div>
    </PartnerLayout>
  );
}
