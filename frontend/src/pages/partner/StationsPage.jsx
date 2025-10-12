// src/pages/partner/StationsPage.jsx
import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

// Pas dit pad aan als jouw API helper elders staat:
import { API_BASE } from "../../api/partner.js";

// Lokale kopie van authHeaders om geen afhankelijkheid te breken
function authHeaders() {
  const token = localStorage.getItem("token") || "";
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

export default function StationsPage() {
  const navigate = useNavigate();
  const [stations, setStations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [q, setQ] = useState("");

  async function fetchStations() {
    setLoading(true);
    setErr("");
    try {
      const res = await fetch(`${API_BASE}/api/partner/stations`, {
        headers: authHeaders(),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Kon stations niet laden.");
      setStations(Array.isArray(data?.rows) ? data.rows : data);
    } catch (e) {
      setErr(e.message || "Onbekende fout bij laden.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchStations();
  }, []);

  const filtered = useMemo(() => {
    if (!q.trim()) return stations;
    const s = q.toLowerCase();
    return stations.filter((st) => {
      const hay =
        `${st?.title ?? ""} ${st?.address_line1 ?? ""} ${st?.postal_code ?? ""} ${st?.city ?? ""}`.toLowerCase();
      return hay.includes(s);
    });
  }, [q, stations]);

  async function handleDelete(id) {
    const station = stations.find((s) => s.id === id);
    const name = station?.title ? `‘${station.title}’` : `#${id}`;
    if (!window.confirm(`Weet je zeker dat je station ${name} wilt verwijderen? Dit kan niet ongedaan worden gemaakt.`)) {
      return;
    }
    setErr("");
    try {
      const res = await fetch(`${API_BASE}/api/partner/stations/${id}`, {
        method: "DELETE",
        headers: authHeaders(),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Verwijderen mislukt.");
      // Optimistisch updaten
      setStations((prev) => prev.filter((s) => s.id !== id));
    } catch (e) {
      setErr(e.message || "Onbekende fout bij verwijderen.");
    }
  }

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between gap-3 mb-4">
        <h1 className="text-2xl font-semibold">Tankstations</h1>
        <div className="flex items-center gap-2">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Zoeken op naam, adres of plaats…"
            className="border rounded-lg px-3 py-2 w-56 md:w-72 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <Link
            to="/partner/stations/new"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 text-white hover:bg-blue-700"
          >
            + Nieuw station
          </Link>
        </div>
      </div>

      {err && (
        <div className="mb-4 rounded-xl border border-red-300 bg-red-50 text-red-800 px-4 py-3">
          {err}
        </div>
      )}

      {loading ? (
        <div className="animate-pulse text-gray-500">Laden…</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-gray-200 p-6 text-gray-600">
          Geen stations gevonden.{" "}
          <button
            onClick={fetchStations}
            className="underline text-blue-600 hover:text-blue-800"
          >
            Opnieuw proberen
          </button>
          .
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Naam</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Adres</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Plaats</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Postcode</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Acties</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((st) => (
                <tr key={st.id} className="border-t">
                  <td className="px-4 py-3">
                    <div className="font-semibold">{st.title || "-"}</div>
                    <div className="text-xs text-gray-500">#{st.id}</div>
                  </td>
                  <td className="px-4 py-3">{st.address_line1 || "-"}</td>
                  <td className="px-4 py-3">{st.city || "-"}</td>
                  <td className="px-4 py-3">{st.postal_code || "-"}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      {/* Eventueel later een Edit-pagina */}
                      {/* <button
                        onClick={() => navigate(`/partner/stations/${st.id}/edit`)}
                        className="px-3 py-1.5 rounded-lg border hover:bg-gray-50"
                      >
                        Bewerken
                      </button> */}
                      <button
                        onClick={() => handleDelete(st.id)}
                        className="px-3 py-1.5 rounded-lg border border-red-300 text-red-700 hover:bg-red-50"
                      >
                        Verwijderen
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
