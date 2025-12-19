// src/pages/partner/StationsNew.jsx
import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { API_BASE } from "../../api/partner.js";

// Lokale kopie van authHeaders om geen afhankelijkheid te breken
function authHeaders() {
  const token = localStorage.getItem("token") || "";
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

/* ========= Helper: huisnummer normaliseren (10/01 -> number=10, add=01) ========= */
function splitHouse(hn = "", addition = "") {
  const m = String(hn).trim().match(/^(\d+)[\s\/\-]*([A-Za-z0-9]*)$/);
  if (!m) return { number: String(hn).trim(), add: String(addition || "").trim() };
  return { number: m[1], add: (addition || m[2] || "").trim() };
}

export default function StationsNew() {
  const navigate = useNavigate();

  const [title, setTitle] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [houseNumber, setHouseNumber] = useState("");
  const [addition, setAddition] = useState("");

  const [street, setStreet] = useState("");
  const [city, setCity] = useState("");
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");

  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [okMsg, setOkMsg] = useState("");

  // Nettere weergave van address_line1
  const addressLine1 = useMemo(() => {
    const { number: hnNum, add: hnAdd } = splitHouse(houseNumber, addition);
    const hn = [hnNum, hnAdd].filter(Boolean).join("-");
    return [street, hn].filter(Boolean).join(" ");
  }, [street, houseNumber, addition]);

  function normalizePostcode(pc) {
    return String(pc || "").replace(/\s+/g, "").toUpperCase();
  }

  async function lookupAddress() {
    setErr("");
    setOkMsg("");

    const pc = normalizePostcode(postalCode);
    if (!pc || !houseNumber) {
      setErr("Vul eerst postcode en huisnummer in.");
      return;
    }

    try {
      const { number, add } = splitHouse(houseNumber, addition);
      const url = new URL(`${API_BASE}/api/partner/address-lookup`);
      url.searchParams.set("zip", pc);
      url.searchParams.set("number", String(number));
      if (add) url.searchParams.set("addition", add);

      const res = await fetch(url.toString(), { headers: authHeaders() });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        if (res.status === 404) {
          setErr("Geen adres gevonden. Vul handmatig in.");
          return;
        }
        throw new Error(data?.error || `Request failed (${res.status})`);
      }

      // Verwachte velden van onze backend: street, number, addition, postcode, city, lat, lng, source
      if (data.street) setStreet(data.street);
      if (data.city) setCity(data.city);
      if (data.lat != null) setLat(String(data.lat));
      if (data.lng != null) setLng(String(data.lng));
      if (data.addition && !addition) setAddition(String(data.addition));

      setOkMsg(`Adres gevonden via ${data.source === "pdok" ? "PDOK" : "Nominatim"}.`);
    } catch (e) {
      setErr(e.message || "Kon adres niet vinden. Vul handmatig in.");
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setErr("");
    setOkMsg("");

    if (!title.trim()) {
      setErr("Naam/label van het station is verplicht.");
      return;
    }
    if (!postalCode || !houseNumber || !street || !city) {
      setErr("Vul een volledig adres in (postcode, huisnr, straat en plaats).");
      return;
    }

    // Optionele numeric check
    const latNum = lat === "" ? null : Number(lat);
    const lngNum = lng === "" ? null : Number(lng);
    if ((lat !== "" && Number.isNaN(latNum)) || (lng !== "" && Number.isNaN(lngNum))) {
      setErr("Latitude/Longitude moeten getallen zijn (of leeg laten).");
      return;
    }

    setSaving(true);
    try {
      // Payload keys afgestemd op backend /stations (postcode, lat, lng, country)
      const payload = {
        title: title.trim(),
        address_line1: addressLine1 || null,
        address_line2: null,
        postcode: normalizePostcode(postalCode),
        city: city || null,
        country: "NL",
        lat: latNum,
        lng: lngNum,
      };

      const res = await fetch(`${API_BASE}/api/partner/stations`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Opslaan mislukt.");

      setOkMsg("Station opgeslagen.");
      navigate("/partner/stations");
    } catch (e) {
      setErr(e.message || "Onbekende fout bij opslaan.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between gap-3 mb-4">
        <h1 className="text-2xl font-semibold">Nieuw tankstation</h1>
        <button
          onClick={() => navigate(-1)}
          className="px-3 py-2 rounded-xl border hover:bg-gray-50"
          type="button"
        >
          Terug
        </button>
      </div>

      {err && (
        <div className="mb-4 rounded-xl border border-red-300 bg-red-50 text-red-800 px-4 py-3">
          {err}
        </div>
      )}
      {okMsg && (
        <div className="mb-4 rounded-xl border border-emerald-300 bg-emerald-50 text-emerald-800 px-4 py-3">
          {okMsg}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basis */}
        <section className="rounded-2xl border border-gray-200 p-4">
          <h2 className="font-semibold mb-3">Basis</h2>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-600 mb-1">Naam *</label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Bijv. Tankstation De Hoek"
                className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </section>

        {/* Adres */}
        <section className="rounded-2xl border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold mb-3">Adres</h2>
            <button
              type="button"
              onClick={lookupAddress}
              className="px-3 py-2 rounded-xl bg-blue-600 text-white hover:bg-blue-700"
            >
              Zoek adres
            </button>
          </div>

          <div className="grid md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm text-gray-600 mb-1">Postcode *</label>
              <input
                value={postalCode}
                onChange={(e) => setPostalCode(e.target.value)}
                placeholder="1234 AB"
                className="w-full border rounded-lg px-3 py-2 uppercase tracking-wider focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Huisnummer *</label>
              <input
                value={houseNumber}
                onChange={(e) => setHouseNumber(e.target.value)}
                placeholder="10 / 10A / 10-01"
                className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Toevoeging</label>
              <input
                value={addition}
                onChange={(e) => setAddition(e.target.value)}
                placeholder="A / hs / bis"
                className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4 mt-4">
            <div>
              <label className="block text-sm text-gray-600 mb-1">Straat</label>
              <input
                value={street}
                onChange={(e) => setStreet(e.target.value)}
                placeholder="Wordt automatisch ingevuld"
                className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Plaats</label>
              <input
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="Wordt automatisch ingevuld of invullen"
                className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4 mt-4">
            <div>
              <label className="block text-sm text-gray-600 mb-1">Latitude</label>
              <input
                value={lat}
                onChange={(e) => setLat(e.target.value)}
                placeholder="52.30…"
                className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Longitude</label>
              <input
                value={lng}
                onChange={(e) => setLng(e.target.value)}
                placeholder="5.10…"
                className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="mt-4">
            <label className="block text-sm text-gray-600 mb-1">Adresregel</label>
            <input
              value={addressLine1}
              readOnly
              className="w-full border rounded-lg px-3 py-2 bg-gray-50 text-gray-700"
            />
          </div>
        </section>

        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => navigate("/partner/stations")}
            className="px-4 py-2 rounded-xl border hover:bg-gray-50"
          >
            Annuleren
          </button>
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 rounded-xl bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {saving ? "Opslaan…" : "Opslaan"}
          </button>
        </div>
      </form>
    </div>
  );
}
