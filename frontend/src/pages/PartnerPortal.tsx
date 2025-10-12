import React, { useEffect, useMemo, useState } from "react";

/** Utilities */
const api = async (path: string, opts: RequestInit = {}) => {
  const token = localStorage.getItem("token") || "";
  const res = await fetch(path, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(opts.headers || {}),
    },
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
};

type FuelRow = {
  id: number;
  station_id: number;
  fuel_type: string;
  price_eur_l: number;
  created_at: string;
};

type Offer = {
  id: number;
  station_id: number;
  title: string;
  body: string;
  starts_at: string | null;
  ends_at: string | null;
  created_at: string;
};

const fuelTypes = [
  { value: "euro95", label: "Euro95" },
  { value: "e10", label: "E10" },
  { value: "diesel", label: "Diesel" },
  { value: "diesel_plus", label: "Diesel Plus" },
  { value: "lpg", label: "LPG" },
  { value: "ac_kwh", label: "AC kWh" },
  { value: "dc_kwh", label: "DC kWh" },
];

export default function PartnerPortal() {
  /** ───────── Layout state */
  const [active, setActive] = useState<"deals" | "settings">("deals");

  /** ───────── Filters / form state */
  const [stationId, setStationId] = useState<number>(1);
  const [priceType, setPriceType] = useState<string>("euro95");
  const [price, setPrice] = useState<string>("1.999");

  /** ───────── Data */
  const [latestPrices, setLatestPrices] = useState<FuelRow[]>([]);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(false);
  const [showOfferModal, setShowOfferModal] = useState(false);

  /** Offer form */
  const [offerTitle, setOfferTitle] = useState("");
  const [offerBody, setOfferBody] = useState("");
  const [offerStart, setOfferStart] = useState<string>("");
  const [offerEnd, setOfferEnd] = useState<string>("");

  const niceDate = (iso?: string | null) =>
    iso ? new Date(iso).toLocaleString() : "-";

  const priceByType = useMemo(() => {
    const map: Record<string, FuelRow> = {};
    latestPrices.forEach((r) => {
      map[r.fuel_type] = r;
    });
    return map;
  }, [latestPrices]);

  /** ───────── Loaders */
  const loadLatest = async () => {
    setLoading(true);
    try {
      const items: FuelRow[] = await api(
        `/api/partner/fuel-prices?latest=true&station_id=${stationId}`
      );
      setLatestPrices(items);
    } finally {
      setLoading(false);
    }
  };

  const loadOffers = async () => {
    const items: Offer[] = await api(
      `/api/partner/offers?station_id=${stationId}`
    );
    setOffers(items);
  };

  useEffect(() => {
    loadLatest();
    loadOffers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stationId]);

  /** ───────── Actions */
  const savePrice = async () => {
    const n = Number(price);
    if (!Number.isFinite(n) || n <= 0) return alert("Voer een geldige prijs in");
    await api("/api/partner/fuel-prices", {
      method: "POST",
      body: JSON.stringify({
        station_id: stationId,
        fuel_type: priceType,
        price_eur_l: n,
      }),
    });
    await loadLatest();
  };

  const createOffer = async () => {
    if (!offerTitle.trim()) return alert("Titel is verplicht");
    await api("/api/partner/offers", {
      method: "POST",
      body: JSON.stringify({
        station_id: stationId,
        title: offerTitle.trim(),
        body: offerBody.trim(),
        starts_at: offerStart || null,
        ends_at: offerEnd || null,
      }),
    });
    setShowOfferModal(false);
    setOfferTitle("");
    setOfferBody("");
    setOfferStart("");
    setOfferEnd("");
    await loadOffers();
  };

  /** ───────── UI helpers */
  const NavItem = ({
    id,
    label,
    icon,
  }: {
    id: "deals" | "settings";
    label: string;
    icon?: React.ReactNode;
  }) => (
    <button
      onClick={() => setActive(id)}
      className={`w-full flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition ${
        active === id
          ? "bg-white text-slate-900 shadow"
          : "text-slate-300 hover:text-white hover:bg-white/10"
      }`}
    >
      {icon}
      <span>{label}</span>
    </button>
  );

  /** ───────── Render */
  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      {/* Top bar */}
      <header className="sticky top-0 z-10 bg-white/80 backdrop-blur border-b border-slate-200">
        <div className="mx-auto max-w-7xl px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img
              src="/logo192.png"
              alt="FuellinQ"
              className="h-7 w-7 rounded"
            />
            <h1 className="font-semibold">Partner Portal</h1>
          </div>
          <div className="hidden md:flex gap-2">
            <a className="btn-secondary" href="/">
              Home
            </a>
            <a className="btn-secondary" href="/about">
              Over ons
            </a>
            <a className="btn-secondary" href="/contact">
              Contact
            </a>
            <a className="btn-secondary" href="/app">
              Dashboard
            </a>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-[260px,1fr] gap-6">
          {/* Sidebar */}
          <aside className="bg-slate-900 text-white rounded-2xl p-4 shadow-sm">
            <div className="mb-4">
              <div className="text-xs uppercase tracking-wider text-slate-400">
                Navigatie
              </div>
            </div>
            <nav className="space-y-2">
              <NavItem id="deals" label="Acties & Deals" />
              <NavItem id="settings" label="Instellingen" />
            </nav>

            <div className="mt-8">
              <div className="text-xs uppercase tracking-wider text-slate-400 mb-2">
                Station
              </div>
              <select
                value={stationId}
                onChange={(e) => setStationId(Number(e.target.value))}
                className="w-full rounded-lg bg-white/10 text-white border border-white/10 px-3 py-2 text-sm"
              >
                <option value={1}>Station 1</option>
                <option value={2}>Station 2</option>
              </select>
            </div>
          </aside>

          {/* Content */}
          <section className="space-y-6">
            {/* Fuel Prices Card */}
            <div className="rounded-2xl bg-white shadow-sm border border-slate-200">
              <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                <h2 className="font-semibold">Brandstofprijzen</h2>
              </div>

              <div className="p-4 grid gap-4">
                <div className="flex flex-col md:flex-row items-stretch md:items-end gap-3">
                  <div className="flex-1">
                    <label className="text-xs font-medium text-slate-500">
                      Type
                    </label>
                    <select
                      className="mt-1 w-full rounded-lg border-slate-300"
                      value={priceType}
                      onChange={(e) => setPriceType(e.target.value)}
                    >
                      {fuelTypes.map((t) => (
                        <option key={t.value} value={t.value}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="w-full md:w-40">
                    <label className="text-xs font-medium text-slate-500">
                      € per liter
                    </label>
                    <input
                      value={price}
                      onChange={(e) => setPrice(e.target.value)}
                      className="mt-1 w-full rounded-lg border-slate-300"
                      placeholder="1.999"
                      inputMode="decimal"
                    />
                  </div>
                  <div>
                    <button
                      onClick={savePrice}
                      className="mt-6 inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
                    >
                      Opslaan
                    </button>
                  </div>
                </div>

                <div className="overflow-hidden rounded-xl border border-slate-200">
                  <table className="min-w-full divide-y divide-slate-200 text-sm">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="px-3 py-2 text-left font-medium text-slate-600">
                          Brandstof
                        </th>
                        <th className="px-3 py-2 text-right font-medium text-slate-600">
                          € / L
                        </th>
                        <th className="px-3 py-2 text-left font-medium text-slate-600">
                          Station
                        </th>
                        <th className="px-3 py-2 text-left font-medium text-slate-600">
                          Laatst gewijzigd
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {fuelTypes.map((t) => {
                        const row = priceByType[t.value];
                        return (
                          <tr key={t.value} className="hover:bg-slate-50/70">
                            <td className="px-3 py-2">{t.label}</td>
                            <td className="px-3 py-2 text-right tabular-nums">
                              {row?.price_eur_l?.toFixed(3) ?? "—"}
                            </td>
                            <td className="px-3 py-2">{row?.station_id ?? "—"}</td>
                            <td className="px-3 py-2">
                              {niceDate(row?.created_at)}
                            </td>
                          </tr>
                        );
                      })}
                      {loading && (
                        <tr>
                          <td className="px-3 py-2 text-slate-500" colSpan={4}>
                            Laden…
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Offers Card */}
            <div className="rounded-2xl bg-white shadow-sm border border-slate-200">
              <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                <h2 className="font-semibold">Acties & Deals</h2>
                <button
                  onClick={() => setShowOfferModal(true)}
                  className="inline-flex items-center rounded-lg bg-slate-900 px-3 py-2 text-white hover:bg-black"
                >
                  + Nieuwe actie
                </button>
              </div>

              <div className="p-4">
                {offers.length === 0 ? (
                  <p className="text-slate-500 text-sm">
                    Nog geen aanbiedingen voor dit station.
                  </p>
                ) : (
                  <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {offers.map((o) => (
                      <li
                        key={o.id}
                        className="rounded-xl border border-slate-200 p-4 hover:shadow-sm transition"
                      >
                        <div className="text-sm font-medium">{o.title}</div>
                        {o.body && (
                          <div className="text-sm text-slate-600 mt-1 line-clamp-2">
                            {o.body}
                          </div>
                        )}
                        <div className="mt-3 text-xs text-slate-500">
                          {o.starts_at ? (
                            <>
                              {new Date(o.starts_at).toLocaleDateString()} –{" "}
                              {o.ends_at
                                ? new Date(o.ends_at).toLocaleDateString()
                                : "open einde"}
                            </>
                          ) : (
                            "Geen periode"
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </section>
        </div>
      </main>

      {/* Offer modal */}
      {showOfferModal && (
        <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl border border-slate-200">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <div className="font-semibold">Nieuwe actie</div>
              <button
                className="text-slate-500 hover:text-slate-700"
                onClick={() => setShowOfferModal(false)}
                aria-label="Sluiten"
              >
                ✕
              </button>
            </div>
            <div className="p-4 space-y-3">
              <div>
                <label className="text-xs font-medium text-slate-600">
                  Titel
                </label>
                <input
                  className="mt-1 w-full rounded-lg border-slate-300"
                  value={offerTitle}
                  onChange={(e) => setOfferTitle(e.target.value)}
                  placeholder="Red Bull 2 voor €3"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600">
                  Subtitel / omschrijving (optioneel)
                </label>
                <textarea
                  className="mt-1 w-full rounded-lg border-slate-300"
                  rows={3}
                  value={offerBody}
                  onChange={(e) => setOfferBody(e.target.value)}
                  placeholder="Alleen dit weekend"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-slate-600">
                    Startdatum
                  </label>
                  <input
                    type="date"
                    className="mt-1 w-full rounded-lg border-slate-300"
                    value={offerStart}
                    onChange={(e) => setOfferStart(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600">
                    Einddatum
                  </label>
                  <input
                    type="date"
                    className="mt-1 w-full rounded-lg border-slate-300"
                    value={offerEnd}
                    onChange={(e) => setOfferEnd(e.target.value)}
                  />
                </div>
              </div>
            </div>
            <div className="p-4 border-t border-slate-100 flex items-center justify-end gap-2">
              <button
                onClick={() => setShowOfferModal(false)}
                className="rounded-lg border border-slate-300 px-4 py-2 text-slate-700 hover:bg-slate-50"
              >
                Annuleren
              </button>
              <button
                onClick={createOffer}
                className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
              >
                Publiceren
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** Small CSS utilities (optional Tailwind component classes)
 * Put these in your global.css if you like, or leave as-is.
 * .btn-secondary { @apply rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50; }
 */
