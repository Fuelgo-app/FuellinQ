// src/pages/partner/PartnerPrices.jsx
import React, { useEffect, useMemo, useState } from "react";
import PartnerLayout from "../../components/PartnerLayout.jsx";
import {
  listStations,
  getFuelPrices,   // -> GET    /api/partner/fuel-prices?station_id=...
  createFuelPrice, // -> POST   /api/partner/fuel-prices
} from "../../api/partner.js";

/** Zelfde mapping als elders gebruikt */
const FUEL_TYPES = [
  ["euro95", "Euro 95 (E10)"],
  ["e5_98", "E5 98 (Premium)"],
  ["e10", "E10"],
  ["diesel", "Diesel"],
  ["diesel_plus", "Diesel+ / Premium"],
  ["lpg", "LPG"],
  ["ac_kwh", "AC laden (€/kWh)"],
  ["dc_kwh", "DC snelladen (€/kWh)"],
];

function prettyMoney(v) {
  if (v === null || v === undefined || v === "") return "—";
  const num = Number(v);
  if (Number.isNaN(num)) return String(v);
  return `€ ${num.toFixed(3)}`; // 3 decimals is gebruikelijk voor €/L en €/kWh
}

function byNewestFirst(a, b) {
  return new Date(b.valid_from || b.created_at || 0) - new Date(a.valid_from || a.created_at || 0);
}

export default function PartnerPrices() {
  // ---------- Data ----------
  const [stations, setStations] = useState([]);
  const [stationId, setStationId] = useState("");
  const [prices, setPrices] = useState([]);
  const [loadingList, setLoadingList] = useState(false);

  // ---------- Form ----------
  const [fuelType, setFuelType] = useState(FUEL_TYPES[0][0]);
  const [price, setPrice] = useState("");
  const [validFrom, setValidFrom] = useState(""); // ISO datetime-local (optioneel)
  const [note, setNote] = useState("");

  // ---------- UI/Errors ----------
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState("");
  const [okMsg, setOkMsg] = useState("");

  // Init: stations laden
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const s = await listStations();
        if (!alive) return;
        setStations(s || []);
        // Als er nog geen station gekozen is, kies de eerste
        if ((s || []).length && !stationId) setStationId(String(s[0].id));
      } catch (e) {
        console.error(e);
        if (!alive) return;
        setErr(e?.message || "Stations laden mislukt.");
      }
    })();
    return () => { alive = false; };
  }, []);

  // Prijzen laden bij station-wijziging
  useEffect(() => {
    if (!stationId) return;
    let alive = true;
    (async () => {
      setLoadingList(true);
      setErr("");
      try {
        const res = await getFuelPrices({ station_id: stationId });
        if (!alive) return;
        setPrices((res?.rows || res || []).sort(byNewestFirst));
      } catch (e) {
        console.error(e);
        if (!alive) return;
        setErr(e?.message || "Prijzen laden mislukt.");
      } finally {
        if (alive) setLoadingList(false);
      }
    })();
    return () => { alive = false; };
  }, [stationId]);

  const stationOptions = useMemo(
    () => (stations || []).map(s => ({ value: String(s.id), label: s.title || `Station #${s.id}` })),
    [stations]
  );

  async function handleSubmit(e) {
    e?.preventDefault?.();
    setErr("");
    setOkMsg("");

    // Validatie
    const p = Number(String(price).replace(",", "."));
    if (!stationId) return setErr("Kies eerst een station.");
    if (!fuelType) return setErr("Kies een brandstoftype.");
    if (Number.isNaN(p) || p <= 0) return setErr("Vul een geldige prijs in (bijv. 2.089).");

    setSubmitting(true);
    try {
      const payload = {
        station_id: Number(stationId),
        fuel_type: fuelType,
        price: p,
        // Alleen meesturen als ingevuld; backend mag ze optioneel accepteren
        ...(validFrom ? { valid_from: new Date(validFrom).toISOString() } : {}),
        ...(note ? { note } : {}),
      };

      await createFuelPrice(payload);

      setOkMsg("Prijs opgeslagen.");
      setPrice("");
      setValidFrom("");
      setNote("");

      // lijst herladen
      const res = await getFuelPrices({ station_id: stationId });
      setPrices((res?.rows || res || []).sort(byNewestFirst));
    } catch (e) {
      console.error(e);
      setErr(e?.message || "Opslaan mislukt.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <PartnerLayout title="Brandstofprijzen">
      <div className="max-w-5xl mx-auto px-4 py-6">
        {/* ✅ Intro / uitlegkaart */}
        <div className="card" style={{ margin: "0 16px 16px" }}>
          <p style={{ margin: "0 0 6px 0" }}>
            Vul hier je actuele <b>brandstof- en kWh-prijzen</b> in per station.
            Actuele prijzen verbeteren je zichtbaarheid in de zoekresultaten.
          </p>
          <ol style={{ margin: 0, paddingLeft: 18 }}>
            <li>Kies rechtsboven het station.</li>
            <li>Kies het brandstoftype en vul de prijs (bijv. <code>2.089</code>).</li>
            <li>(Optioneel) Ingangsdatum en notitie.</li>
            <li>Klik <b>Prijs opslaan</b>. De lijst werkt automatisch bij.</li>
          </ol>
        </div>

        {/* Header */}
        <div className="flex items-center justify-between gap-4 mb-6">
          <h1 className="text-2xl font-semibold">Beheer prijzen</h1>
          <div className="flex items-center gap-2">
            <label htmlFor="station" className="text-sm opacity-80">Station</label>
            <select
              id="station"
              className="border rounded-lg px-3 py-2 bg-transparent"
              value={stationId}
              onChange={(e) => setStationId(e.target.value)}
              disabled={!stationOptions.length}
            >
              {stationOptions.length
                ? stationOptions.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))
                : <option value="">Geen stations gevonden</option>}
            </select>
          </div>
        </div>

        {/* Alerts */}
        {err ? (
          <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-red-400">
            {err}
          </div>
        ) : null}
        {okMsg ? (
          <div className="mb-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-emerald-400">
            {okMsg}
          </div>
        ) : null}

        {/* Form */}
        <form onSubmit={handleSubmit} className="grid md:grid-cols-4 gap-3 mb-8">
          <div className="col-span-2">
            <label className="block text-sm mb-1">Brandstoftype</label>
            <select
              className="w-full border rounded-lg px-3 py-2 bg-transparent"
              value={fuelType}
              onChange={(e) => setFuelType(e.target.value)}
            >
              {FUEL_TYPES.map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm mb-1">Prijs (€/L of €/kWh)</label>
            <input
              type="text"
              inputMode="decimal"
              placeholder="bijv. 2.089"
              className="w-full border rounded-lg px-3 py-2 bg-transparent"
              value={price}
              onChange={(e) => setPrice(e.target.value.replace(",", "."))}
            />
          </div>

          <div>
            <label className="block text-sm mb-1">Ingangsdatum (optioneel)</label>
            <input
              type="datetime-local"
              className="w-full border rounded-lg px-3 py-2 bg-transparent"
              value={validFrom}
              onChange={(e) => setValidFrom(e.target.value)}
            />
          </div>

          <div className="md:col-span-3">
            <label className="block text-sm mb-1">Notitie (optioneel)</label>
            <input
              type="text"
              placeholder="Bijv. tijdelijke actie, prijscheck, bron, etc."
              className="w-full border rounded-lg px-3 py-2 bg-transparent"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>

          <div className="flex items-end">
            <button
              type="submit"
              disabled={submitting || !stationId}
              className={`w-full rounded-lg px-4 py-2 font-medium
                ${submitting || !stationId
                  ? "opacity-60 cursor-not-allowed"
                  : "bg-blue-600 hover:bg-blue-500 text-white"}`}
            >
              {submitting ? "Opslaan..." : "Prijs opslaan"}
            </button>
          </div>
        </form>

        {/* Lijst */}
        <div className="rounded-2xl border border-white/10 overflow-hidden">
          <div className="px-4 py-3 text-sm opacity-70 border-b border-white/10 flex items-center justify-between">
            <span>Actuele prijzen</span>
            {loadingList ? <span className="italic opacity-70">Laden…</span> : null}
          </div>
          <div className="divide-y divide-white/5">
            {prices.length === 0 ? (
              <div className="px-4 py-6 text-sm opacity-70">Nog geen prijzen voor dit station.</div>
            ) : prices.map((row) => (
              <div key={row.id} className="px-4 py-3 grid grid-cols-6 gap-2 items-center">
                <div className="col-span-2">
                  <div className="text-sm font-medium">{labelForFuel(row.fuel_type)}</div>
                  <div className="text-xs opacity-60">ID: {row.id}</div>
                </div>
                <div className="col-span-1">
                  <div className="text-sm">{prettyMoney(row.price)}</div>
                  {row.currency && <div className="text-xs opacity-60">{row.currency}</div>}
                </div>
                <div className="col-span-2">
                  <div className="text-sm">
                    {row.valid_from
                      ? new Date(row.valid_from).toLocaleString()
                      : (row.created_at
                          ? new Date(row.created_at).toLocaleString()
                          : "—")}
                  </div>
                  <div className="text-xs opacity-60">Ingangsdatum</div>
                </div>
                <div className="col-span-1 text-right">
                  {row.note
                    ? <div className="text-xs opacity-70">{row.note}</div>
                    : <div className="text-xs opacity-40">—</div>}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Hint */}
        <p className="mt-4 text-xs opacity-60">
          Tip: Heb je meerdere stations? Kies rechtsboven het station om hun prijzen te bekijken en te beheren.
        </p>
      </div>
    </PartnerLayout>
  );
}

function labelForFuel(value) {
  const f = FUEL_TYPES.find(([v]) => v === value);
  return f ? f[1] : value || "Onbekend";
}
