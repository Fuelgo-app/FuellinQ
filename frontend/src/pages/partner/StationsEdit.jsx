// src/pages/partner/StationsEdit.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { API_BASE } from "../../api/partner.js";

/* ---------------- Helpers ---------------- */
function authHeaders() {
  const token = localStorage.getItem("token") || "";
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

function normalizePostcode(pc) {
  return String(pc || "").replace(/\s+/g, "").toUpperCase();
}

/* 10/01 -> { number: "10", add: "01" }  */
function splitHouse(hn = "", addition = "") {
  const m = String(hn).trim().match(/^(\d+)[\s\/\-]*([A-Za-z0-9]*)$/);
  if (!m) return { number: String(hn).trim(), add: String(addition || "").trim() };
  return { number: m[1], add: (addition || m[2] || "").trim() };
}

/* Probeer “Ambachtsweg 12A” te parsen naar street + houseNumber(+addition) */
function parseAddressLine1(line = "") {
  const s = String(line || "").trim();
  if (!s) return { street: "", houseNumber: "", addition: "" };
  const m = s.match(/^(.*\S)\s+(\d+[A-Za-z0-9\-\/]*)$/);
  if (!m) return { street: s, houseNumber: "", addition: "" };
  // probeer toevoeging nog uit nummer te halen (12-01 of 12A)
  const numRaw = m[2];
  const m2 = numRaw.match(/^(\d+)[\s\/\-]*([A-Za-z0-9]*)$/);
  return {
    street: m[1],
    houseNumber: m2 ? m2[1] : numRaw,
    addition: m2 ? (m2[2] || "") : "",
  };
}

/* UI <-> API mapping helpers */
function uiFromApi(row) {
  // Backend kan verschillende vormen teruggeven; probeer varianten
  const title = row.title || "";
  const postcode = row.postcode || row.zip || "";
  const city = row.city || "";
  const country = row.country || "NL";

  // Lat/lng varianten
  const lat = row.lat ?? row.latitude ?? "";
  const lng = row.lng ?? row.longitude ?? "";

  // Adres: address_line1 óf (street + house_number)
  let street = row.street || "";
  let houseNumber = row.house_number || "";
  let addition = row.house_addition || "";
  let addressLine1 = row.address_line1 || "";

  if (!street && addressLine1) {
    const parsed = parseAddressLine1(addressLine1);
    street = parsed.street;
    houseNumber = parsed.houseNumber;
    addition = parsed.addition;
  }
  if (!addressLine1) {
    const hn = [houseNumber, addition].filter(Boolean).join("-");
    addressLine1 = [street, hn].filter(Boolean).join(" ");
  }

  return {
    id: row.id,
    title,
    postcode,
    city,
    country,
    street,
    houseNumber,
    addition,
    lat: lat === "" || lat == null ? "" : String(lat),
    lng: lng === "" || lng == null ? "" : String(lng),
    addressLine1,
  };
}

function apiFromUi(ui) {
  const latNum = ui.lat === "" ? null : Number(ui.lat);
  const lngNum = ui.lng === "" ? null : Number(ui.lng);
  return {
    title: (ui.title || "").trim(),
    address_line1: ui.addressLine1 || null,
    address_line2: null,
    postcode: normalizePostcode(ui.postcode),
    city: ui.city || null,
    country: ui.country || "NL",
    lat: Number.isNaN(latNum) ? null : latNum,
    lng: Number.isNaN(lngNum) ? null : lngNum,
  };
}

/* ---------------- Component ---------------- */
export default function StationsEdit() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [okMsg, setOkMsg] = useState("");

  const [title, setTitle] = useState("");
  const [postcode, setPostcode] = useState("");
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("NL");

  const [street, setStreet] = useState("");
  const [houseNumber, setHouseNumber] = useState("");
  const [addition, setAddition] = useState("");

  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");

  const addressLine1 = useMemo(() => {
    const { number: hnNum, add: hnAdd } = splitHouse(houseNumber, addition);
    const hn = [hnNum, hnAdd].filter(Boolean).join("-");
    return [street, hn].filter(Boolean).join(" ");
  }, [street, houseNumber, addition]);

  async function load() {
    setLoading(true);
    setErr("");
    setOkMsg("");
    try {
      const res = await fetch(`${API_BASE}/api/partner/stations/${id}`, { headers: authHeaders() });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || `Kon station niet laden (${res.status})`);
      const ui = uiFromApi(data);
      setTitle(ui.title);
      setPostcode(ui.postcode);
      setCity(ui.city);
      setCountry(ui.country || "NL");
      setStreet(ui.street);
      setHouseNumber(ui.houseNumber);
      setAddition(ui.addition);
      setLat(ui.lat);
      setLng(ui.lng);
    } catch (e) {
      setErr(e.message || "Kon station niet laden.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function lookupAddress() {
    setErr("");
    setOkMsg("");

    const pc = normalizePostcode(postcode);
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

  async function handleSave(e) {
    e.preventDefault();
    setErr("");
    setOkMsg("");

    if (!title.trim()) {
      setErr("Naam/label van het station is verplicht.");
      return;
    }
    if (!postcode || !street || !city) {
      setErr("Vul een volledig adres in (postcode, straat en plaats).");
      return;
    }

    const latNum = lat === "" ? null : Number(lat);
    const lngNum = lng === "" ? null : Number(lng);
    if ((lat !== "" && Number.isNaN(latNum)) || (lng !== "" && Number.isNaN(lngNum))) {
      setErr("Latitude/Longitude moeten getallen zijn (of leeg laten).");
      return;
    }

    setSaving(true);
    try {
      const payload = apiFromUi({
        title,
        addressLine1,
        postcode,
        city,
        country,
        lat,
        lng,
      });

      const res = await fetch(`${API_BASE}/api/partner/stations/${id}`, {
        method: "PUT",
        headers: authHeaders(),
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Bijwerken mislukt.");

      setOkMsg("Wijzigingen opgeslagen.");
      // eventueel: navigate("/partner/stations");
    } catch (e) {
      setErr(e.message || "Onbekende fout bij opslaan.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirm("Weet je zeker dat je dit station wilt verwijderen?")) return;
    setErr("");
    setOkMsg("");
    try {
      const res = await fetch(`${API_BASE}/api/partner/stations/${id}`, {
        method: "DELETE",
        headers: authHeaders(),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Verwijderen mislukt.");
      navigate("/partner/stations");
    } catch (e) {
      setErr(e.message || "Kon station niet verwijderen.");
    }
  }

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between gap-3 mb-4">
        <h1 className="text-2xl font-semibold">Station bewerken</h1>
        <div className="flex gap-2">
          <button
            onClick={() => navigate(-1)}
            className="px-3 py-2 rounded-xl border hover:bg-gray-50"
            type="button"
          >
            Terug
          </button>
          <button
            onClick={handleDelete}
            className="px-3 py-2 rounded-xl border border-red-300 text-red-700 hover:bg-red-50"
            type="button"
          >
            Verwijderen
          </button>
        </div>
      </div>

      {loading ? (
        <div className="rounded-xl border p-4">Gegevens laden…</div>
      ) : (
        <>
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

          <form onSubmit={handleSave} className="space-y-6">
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
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Land</label>
                  <input
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                    placeholder="NL"
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
                    value={postcode}
                    onChange={(e) => setPostcode(e.target.value)}
                    placeholder="1234 AB"
                    className="w-full border rounded-lg px-3 py-2 uppercase tracking-wider focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Huisnummer</label>
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
                    placeholder="Straatnaam"
                    className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Plaats</label>
                  <input
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="Plaatsnaam"
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
        </>
      )}
    </div>
  );
}
