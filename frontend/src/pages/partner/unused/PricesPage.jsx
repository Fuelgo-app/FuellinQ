// src/pages/partner/PricesPage.jsx
import { useEffect, useMemo, useState } from "react";
import PartnerLayout from "../../components/PartnerLayout.jsx";

// Let op: deze namen bestaan in src/api/partner.js
import {
  listStations,
  getFuelPrices,   // -> GET /api/partner/fuel-prices
  createFuelPrice, // -> POST /api/partner/fuel-prices
} from "../../api/partner.js";

const FUEL_TYPES = [
  ["euro95", "euro95"],
  ["e5_98", "e5_98"],
  ["e10", "e10"],
  ["diesel", "diesel"],
  ["diesel_plus", "diesel_plus"],
  ["lpg", "lpg"],
  ["ac_kwh", "ac_kwh"],
  ["dc_kwh", "dc_kwh"],
];

export default function PricesPage() {
  // Stations
  const [stations, setStations] = useState([]);
  const [stationId, setStationId] = useState(null);

  // Form
  const [fuelType, setFuelType] = useState("euro95");
  const [price, setPrice] = useState("1.999");

  // Tabel
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  // Stations laden
  useEffect(() => {
    (async () => {
      try {
        const s = await listStations();
        setStations(s || []);
        if (!stationId && s?.[0]?.id) setStationId(s[0].id);
      } catch {
        setStations([]);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedStation = useMemo(
    () => stations.find((s) => s.id === Number(stationId)) || null,
    [stations, stationId]
  );

  // Laatste prijzen per type voor gekozen station
  async function load() {
    if (!stationId) return;
    setLoading(true);
    setMsg("");
    try {
      // latest=true → één record per fuel_type (backend groepeert op max(created_at))
      const r = await getFuelPrices({ station_id: Number(stationId), latest: true });
      setRows(Array.isArray(r) ? r : []);
    } catch (e) {
      setMsg(e.message || "Ophalen mislukt");
    } finally {
      setLoading(false);
    }
  }

  // prijzen laden bij station-wijziging
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stationId]);

  function normalizePriceInput(v) {
    // Komma -> punt, max 3 decimalen, alleen cijfers/punt
    let x = String(v ?? "").replace(",", ".");
    x = x.replace(/[^0-9.]/g, "");
    const parts = x.split(".");
    if (parts.length > 2) x = `${parts[0]}.${parts.slice(1).join("")}`;
    const [a, b] = x.split(".");
    if (b && b.length > 3) return `${a}.${b.slice(0, 3)}`;
    return x;
  }

  async function submit(e) {
    e.preventDefault();
    setMsg("");
    if (!stationId) return setMsg("Kies eerst een station.");

    const p = Number(normalizePriceInput(price));
    if (!Number.isFinite(p) || p <= 0 || p > 10) {
      return setMsg("Voer een geldige prijs in, bijv. 1.999");
    }

    try {
      await createFuelPrice({
        station_id: Number(stationId),
        fuel_type: String(fuelType || "").toLowerCase(),
        price_eur_l: p,
      });
      setMsg("Prijs opgeslagen ✅");
      await load();
    } catch (e2) {
      setMsg(e2.message || "Opslaan mislukt");
    }
  }

  return (
    <PartnerLayout title="Brandstofprijzen">
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Kaart: prijs instellen */}
        <div className="lg:col-span-1">
          <div className="p-4 border rounded-lg bg-white">
            <h3 className="font-semibold mb-3">Prijs instellen</h3>
            <form onSubmit={submit} className="space-y-3">
              <label className="block text-sm font-medium">Station</label>
              <select
                className="w-full border rounded px-3 py-2"
                value={stationId || ""}
                onChange={(e) => setStationId(Number(e.target.value))}
              >
                {stations.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.title || s.address_line1 || `Station ${s.id}`}
                  </option>
                ))}
                {stations.length === 0 && <option value="">—</option>}
              </select>

              <label className="block text-sm font-medium">Type</label>
              <select
                className="w-full border rounded px-3 py-2"
                value={fuelType}
                onChange={(e) => setFuelType(e.target.value)}
              >
                {FUEL_TYPES.map(([val, label]) => (
                  <option key={val} value={val}>
                    {label}
                  </option>
                ))}
              </select>

              <label className="block text-sm font-medium">€ per liter</label>
              <input
                className="w-full border rounded px-3 py-2"
                inputMode="decimal"
                type="text"
                value={price}
                onChange={(e) => setPrice(normalizePriceInput(e.target.value))}
                placeholder="1.999"
              />

              <button className="w-full rounded-lg px-4 py-2 bg-blue-600 text-white">
                Opslaan
              </button>
            </form>

            {!!msg && <div className="mt-3 text-sm text-gray-700">{msg}</div>}

            {selectedStation && (
              <div className="mt-4 text-xs text-gray-500">
                Werkend voor:{" "}
                <b>{selectedStation.title || selectedStation.address_line1 || `Station ${selectedStation.id}`}</b>
                {selectedStation.address_line2 && <> • {selectedStation.address_line2}</>}
              </div>
            )}
          </div>
        </div>

        {/* Kaart: laatste prijzen */}
        <div className="lg:col-span-2">
          <div className="p-4 border rounded-lg bg-white">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold">Laatste prijzen (per type)</h3>
              <button
                className="rounded border px-3 py-1.5 text-sm"
                onClick={load}
                disabled={loading || !stationId}
              >
                Vernieuwen
              </button>
            </div>

            {loading ? (
              <div className="text-gray-600">Laden…</div>
            ) : (
              <ul className="divide-y">
                {rows.map((r) => (
                  <li
                    key={`${r.station_id}-${r.fuel_type}`}
                    className="py-3 flex items-center justify-between"
                  >
                    <div>
                      <div className="font-medium">{r.fuel_type}</div>
                      <div className="text-xs text-gray-500">
                        {stations.find((s) => s.id === r.station_id)?.title ||
                          `Station ${r.station_id}`}{" "}
                        • {new Date(r.created_at).toLocaleString()}
                      </div>
                    </div>
                    <div className="font-semibold">
                      € {Number(r.price_eur_l).toFixed(3)}
                    </div>
                  </li>
                ))}
                {rows.length === 0 && (
                  <li className="py-3 text-gray-500">Nog niets gevonden.</li>
                )}
              </ul>
            )}
          </div>
        </div>
      </div>
    </PartnerLayout>
  );
}
