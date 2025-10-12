// src/pages/OffersPage.jsx
import React, { useEffect, useMemo, useState } from "react";
import {
  listOffers,
  createOffer,
  updateOffer,
  toggleOffer,
  uploadImage,
  listStations,
} from "@/api/partner";

const STATUS = ["draft", "active", "inactive"];

// Kleine, lokale “templates” (vervang/uitbreid naar smaak)
const TEMPLATES = [
  { key: "coffee", title: "Gratis koffie", description: "Eén gratis koffie bij elke tankbeurt." },
  { key: "wash", title: "Autowas €5,-", description: "Carwash voor slechts €5 dit weekend." },
  { key: "sandwich", title: "Broodje + drank €6,99", description: "Kies je favoriete broodje + drankje." },
];

function useAsync(fn, deps = []) {
  const [state, set] = useState({ loading: false, data: null, error: null });
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        set({ loading: true, data: null, error: null });
        const data = await fn();
        if (alive) set({ loading: false, data, error: null });
      } catch (e) {
        if (alive) set({ loading: false, data: null, error: e });
      }
    })();
    return () => {
      alive = false;
    };
  }, deps); // eslint-disable-line react-hooks/exhaustive-deps
  return state;
}

function OfferForm({ initial, stations, onCancel, onSave }) {
  const [form, setForm] = useState(() => ({
    station_id: initial?.station_id || stations[0]?.id || "",
    title: initial?.title || "",
    description: initial?.description || "",
    status: initial?.status || "draft",
    start_at: initial?.start_at || "",
    end_at: initial?.end_at || "",
    image_url: initial?.image_url || "",
  }));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!form.station_id && stations[0]) {
      setForm((f) => ({ ...f, station_id: stations[0].id }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stations.length]);

  function applyTemplate(key) {
    const t = TEMPLATES.find((x) => x.key === key);
    if (!t) return;
    setForm((f) => ({ ...f, title: t.title, description: t.description }));
  }

  async function onFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setErr("");
    try {
      const up = await uploadImage(file);
      setForm((f) => ({ ...f, image_url: up.url }));
    } catch (e) {
      setErr(e.message || "Upload mislukt");
    } finally {
      setBusy(false);
    }
  }

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    try {
      const payload = {
        station_id: Number(form.station_id),
        title: form.title.trim(),
        description: form.description,
        image_url: form.image_url || null,
        status: form.status,
        start_at: form.start_at || null,
        end_at: form.end_at || null,
      };
      if (!payload.title) throw new Error("Titel is verplicht");
      await onSave(payload);
    } catch (e) {
      setErr(e.message || "Opslaan mislukt");
      setBusy(false);
      return;
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {err && (
        <div className="rounded-md bg-red-50 text-red-700 px-3 py-2 text-sm">
          {err}
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <label className="flex flex-col text-sm">
          <span className="mb-1 text-gray-600">Tankstation</span>
          <select
            className="rounded-lg border px-3 py-2"
            value={form.station_id}
            onChange={(e) => setForm((f) => ({ ...f, station_id: e.target.value }))}
          >
            {stations.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title || s.address_line1 || `#${s.id}`}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col text-sm">
          <span className="mb-1 text-gray-600">Status</span>
          <select
            className="rounded-lg border px-3 py-2"
            value={form.status}
            onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
          >
            {STATUS.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </label>

        <label className="flex flex-col text-sm">
          <span className="mb-1 text-gray-600">Sneltemplate</span>
          <select
            className="rounded-lg border px-3 py-2"
            onChange={(e) => applyTemplate(e.target.value)}
            defaultValue=""
          >
            <option value="" disabled>Kies template…</option>
            {TEMPLATES.map((t) => (
              <option key={t.key} value={t.key}>{t.title}</option>
            ))}
          </select>
        </label>
      </div>

      <label className="block text-sm">
        <span className="mb-1 block text-gray-600">Titel</span>
        <input
          className="w-full rounded-lg border px-3 py-2"
          value={form.title}
          onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
          placeholder="Bijv. Gratis koffie"
        />
      </label>

      <label className="block text-sm">
        <span className="mb-1 block text-gray-600">Beschrijving</span>
        <textarea
          rows={4}
          className="w-full rounded-lg border px-3 py-2"
          value={form.description}
          onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          placeholder="Alle details, voorwaarden, tijden…"
        />
      </label>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <label className="flex flex-col text-sm">
          <span className="mb-1 text-gray-600">Start</span>
          <input
            type="datetime-local"
            className="rounded-lg border px-3 py-2"
            value={form.start_at || ""}
            onChange={(e) => setForm((f) => ({ ...f, start_at: e.target.value }))}
          />
        </label>
        <label className="flex flex-col text-sm">
          <span className="mb-1 text-gray-600">Einde</span>
          <input
            type="datetime-local"
            className="rounded-lg border px-3 py-2"
            value={form.end_at || ""}
            onChange={(e) => setForm((f) => ({ ...f, end_at: e.target.value }))}
          />
        </label>
      </div>

      <div className="flex items-start gap-4">
        <div className="flex-1">
          <label className="block text-sm">
            <span className="mb-1 block text-gray-600">Afbeelding (optioneel)</span>
            <input type="file" accept="image/*" onChange={onFile} />
          </label>
          {form.image_url && (
            <p className="text-xs text-gray-500 mt-1 break-all">{form.image_url}</p>
          )}
        </div>
        {form.image_url && (
          <img
            src={form.image_url}
            alt="preview"
            className="w-40 h-24 object-cover rounded-lg border"
          />
        )}
      </div>

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={busy}
          className="rounded-lg bg-black text-white px-4 py-2 disabled:opacity-50"
        >
          {initial ? "Opslaan" : "Aanmaken"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border px-4 py-2"
        >
          Annuleren
        </button>
      </div>
    </form>
  );
}

export default function OffersPage() {
  const [reloadKey, setReloadKey] = useState(0);
  const stationsQ = useAsync(() => listStations(), []);
  const offersQ = useAsync(() => listOffers({}), [reloadKey]);

  const stations = stationsQ.data || [];
  const offers = offersQ.data || [];

  const [showForm, setShowForm] = useState(false);
  const [edit, setEdit] = useState(null);

  const stationMap = useMemo(() => {
    const m = new Map();
    stations.forEach((s) => m.set(s.id, s));
    return m;
  }, [stations]);

  function refresh() {
    setReloadKey((k) => k + 1);
    setShowForm(false);
    setEdit(null);
  }

  async function saveNew(payload) {
    await createOffer(payload);
    refresh();
  }
  async function saveEdit(payload) {
    await updateOffer(edit.id, payload);
    refresh();
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">Aanbiedingen</h1>
        {!showForm && (
          <button
            onClick={() => { setEdit(null); setShowForm(true); }}
            className="rounded-lg bg-black text-white px-4 py-2"
          >
            Nieuwe aanbieding
          </button>
        )}
      </div>

      {showForm ? (
        <div className="rounded-2xl border p-5 mb-8">
          <OfferForm
            initial={edit || undefined}
            stations={stations}
            onCancel={() => { setShowForm(false); setEdit(null); }}
            onSave={edit ? saveEdit : saveNew}
          />
        </div>
      ) : null}

      {/* Lijst */}
      <div className="grid gap-4">
        {(offersQ.loading || stationsQ.loading) && (
          <div className="text-sm text-gray-500">Laden…</div>
        )}
        {offersQ.error && (
          <div className="rounded-md bg-red-50 text-red-700 px-3 py-2 text-sm">
            {offersQ.error.message || "Kon offers niet laden"}
          </div>
        )}
        {offers.map((o) => {
          const st = stationMap.get(o.station_id);
          return (
            <div key={o.id} className="rounded-2xl border p-4 flex gap-4 items-start">
              {o.image_url ? (
                <img src={o.image_url} alt="" className="w-32 h-20 object-cover rounded-lg border" />
              ) : (
                <div className="w-32 h-20 rounded-lg bg-gray-100 border flex items-center justify-center text-gray-400 text-xs">
                  geen foto
                </div>
              )}
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold">{o.title}</h3>
                  <span className="text-xs rounded-full px-2 py-0.5 border">
                    {o.status}
                  </span>
                </div>
                <p className="text-sm text-gray-600 mt-1">{o.description}</p>
                <p className="text-xs text-gray-500 mt-1">
                  Station: {st?.title || st?.address_line1 || `#${o.station_id}`} •{" "}
                  {o.start_at ? new Date(o.start_at).toLocaleString() : "geen start"} →{" "}
                  {o.end_at ? new Date(o.end_at).toLocaleString() : "geen eind"}
                </p>
              </div>
              <div className="flex flex-col gap-2">
                <button
                  onClick={() => { setEdit(o); setShowForm(true); }}
                  className="rounded-lg border px-3 py-1.5 text-sm"
                >
                  Bewerken
                </button>
                <button
                  onClick={async () => { await toggleOffer(o.id); refresh(); }}
                  className="rounded-lg bg-black text-white px-3 py-1.5 text-sm"
                >
                  {o.status === "active" ? "Pauzeren" : "Activeren"}
                </button>
              </div>
            </div>
          );
        })}
        {!offers.length && !offersQ.loading && (
          <div className="text-sm text-gray-500">Nog geen aanbiedingen.</div>
        )}
      </div>
    </div>
  );
}
