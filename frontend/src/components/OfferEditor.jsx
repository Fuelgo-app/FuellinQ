// src/components/OfferEditor.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { API_BASE, apiFetch } from "@/api/base.js";

/**
 * OfferEditor.jsx — Partner aanbiedingen maken/bewerken
 * Gebruik: <OfferEditor stationId={optionalStationId} />
 *
 * Vereiste backend:
 *  - GET    /api/partner/offers?station_id=123
 *  - POST   /api/partner/offers
 *  - PUT    /api/partner/offers/:id
 *  - DELETE /api/partner/offers/:id
 *  - POST   /api/partner/upload   (multipart, returns { url })
 */

// ---- Auth helper ----
function authHeaders(extra = {}) {
  const token = localStorage.getItem("token") || "";
  return {
    ...(extra || {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

// ---- Utils ----
function clsx(...arr) {
  return arr.filter(Boolean).join(" ");
}
function toDateTimeLocal(value) {
  if (!value) return "";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n) => String(n).padStart(2, "0");
  const yyyy = d.getFullYear();
  const mm = pad(d.getMonth() + 1);
  const dd = pad(d.getDate());
  const hh = pad(d.getHours());
  const mi = pad(d.getMinutes());
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
}
function calcDiscountPercent(priceOriginal, priceNow) {
  const orig = Number(priceOriginal || 0);
  const now = Number(priceNow || 0);
  if (!orig || !now || now >= orig) return 0;
  return Math.round(((orig - now) / orig) * 100);
}
function parseServerError(e, fallback = "Er ging iets mis.") {
  if (typeof e?.message === "string") return e.message;
  return fallback;
}

// ---- Component ----
export default function OfferEditor({ stationId = null }) {
  const [offers, setOffers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [query, setQuery] = useState("");
  const [sortBy, setSortBy] = useState("updated_at_desc");

  // Form state
  const emptyForm = {
    id: null,
    title: "",
    subtitle: "",
    description: "",
    terms: "",
    priceOriginal: "",
    priceNow: "",
    startAt: "",
    endAt: "",
    isActive: true,
    imageUrl: "",
    stationId: stationId || "",
  };
  const [form, setForm] = useState(emptyForm);
  const [imageFile, setImageFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [showEditor, setShowEditor] = useState(false);

  const [dateError, setDateError] = useState("");
  const fileInputRef = useRef(null);

  useEffect(() => {
    fetchOffers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stationId]);

  // Cmd/Ctrl+S voor opslaan
  useEffect(() => {
    function onKey(e) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        if (showEditor) {
          e.preventDefault();
          saveOffer();
        }
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showEditor, form]);

  async function fetchOffers() {
    try {
      setLoading(true);
      setError("");
      const u = new URL(`${API_BASE}/api/partner/offers`);
      if (stationId) u.searchParams.set("station_id", stationId);
      const data = await apiFetch(u.toString(), {
        headers: authHeaders(),
      });
      const items = Array.isArray(data) ? data : data.offers || [];
      setOffers(items);
    } catch (e) {
      console.error(e);
      setError("Kon aanbiedingen niet laden.");
    } finally {
      setLoading(false);
    }
  }

  function resetForm() {
    setForm({ ...emptyForm, stationId: stationId || "" });
    setImageFile(null);
    setPreviewUrl("");
    setDateError("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function openCreate() {
    resetForm();
    setShowEditor(true);
  }

  function openEdit(offer) {
    setForm({
      id: offer.id,
      title: offer.title || "",
      subtitle: offer.subtitle || "",
      description: offer.description || "",
      terms: offer.terms || "",
      priceOriginal:
        offer.price_original ?? offer.priceOriginal ?? "",
      priceNow:
        offer.price_now ?? offer.priceNow ?? "",
      startAt: toDateTimeLocal(offer.start_at || offer.startAt) || "",
      endAt: toDateTimeLocal(offer.end_at || offer.endAt) || "",
      isActive: Boolean(offer.is_active ?? offer.isActive ?? true),
      imageUrl: offer.image_url || offer.imageUrl || "",
      stationId: offer.station_id ?? offer.stationId ?? stationId ?? "",
    });
    setPreviewUrl(offer.image_url || offer.imageUrl || "");
    setImageFile(null);
    setShowEditor(true);
    setDateError("");
  }

  async function handleUploadImage() {
    if (!imageFile) return form.imageUrl || ""; // niks te uploaden
    const fd = new FormData();
    fd.append("file", imageFile);
    try {
      const res = await fetch(`${API_BASE}/api/partner/upload`, {
        method: "POST",
        headers: authHeaders(), // geen Content-Type zetten bij FormData!
        body: fd,
      });
      if (!res.ok) {
        const msg = await res.text().catch(() => "");
        throw new Error(`Upload HTTP ${res.status}: ${msg.slice(0, 180)}`);
      }
      const data = await res.json().catch(() => ({}));
      return data.url || data.path || "";
    } catch (e) {
      console.error(e);
      setError("Afbeelding uploaden mislukt.");
      return "";
    }
  }

  function validateDates() {
    if (!form.startAt || !form.endAt) {
      setDateError("");
      return true;
    }
    const s = new Date(form.startAt).getTime();
    const e = new Date(form.endAt).getTime();
    if (Number.isNaN(s) || Number.isNaN(e)) {
      setDateError("Ongeldige datum/tijd.");
      return false;
    }
    if (e < s) {
      setDateError("Einddatum mag niet vóór startdatum liggen.");
      return false;
    }
    setDateError("");
    return true;
  }

  async function saveOffer(e) {
    e?.preventDefault?.();
    if (!validateDates()) return;

    setSaving(true);
    setError("");
    try {
      let imageUrl = form.imageUrl;
      if (imageFile) {
        const uploadedUrl = await handleUploadImage();
        if (uploadedUrl) imageUrl = uploadedUrl;
      }

      const payload = {
        title: form.title?.trim(),
        subtitle: form.subtitle?.trim(),
        description: form.description?.trim(),
        terms: form.terms?.trim(),
        price_original: form.priceOriginal ? Number(form.priceOriginal) : null,
        price_now: form.priceNow ? Number(form.priceNow) : null,
        discount_percent: calcDiscountPercent(form.priceOriginal, form.priceNow),
        start_at: form.startAt ? new Date(form.startAt).toISOString() : null,
        end_at: form.endAt ? new Date(form.endAt).toISOString() : null,
        is_active: Boolean(form.isActive),
        image_url: imageUrl || null,
        station_id: form.stationId || stationId || null,
      };

      const isEdit = Boolean(form.id);
      const path = isEdit
        ? `/api/partner/offers/${form.id}`
        : `/api/partner/offers`;

      const data = await apiFetch(`${API_BASE}${path}`, {
        method: isEdit ? "PUT" : "POST",
        headers: authHeaders(),
        body: JSON.stringify(payload),
      });

      // Optimistic/soft refresh
      if (isEdit) {
        setOffers((prev) =>
          prev.map((o) => (o.id === form.id ? { ...o, ...payload, image_url: imageUrl } : o))
        );
      } else {
        // Als API nieuwe record terugstuurt, voeg die toe, anders refetch
        if (data && (data.id || (data.offer && data.offer.id))) {
          const created = data.offer || data;
          setOffers((prev) => [created, ...prev]);
        } else {
          await fetchOffers();
        }
      }

      setShowEditor(false);
      resetForm();
    } catch (e) {
      console.error(e);
      setError(parseServerError(e, "Aanbieding opslaan mislukt."));
    } finally {
      setSaving(false);
    }
  }

  async function deleteOffer(offer) {
    if (!offer?.id) return;
    if (!confirm(`Verwijder aanbieding “${offer.title}”?`)) return;
    try {
      await apiFetch(`${API_BASE}/api/partner/offers/${offer.id}`, {
        method: "DELETE",
        headers: authHeaders(),
      });
      setOffers((prev) => prev.filter((o) => o.id !== offer.id));
    } catch (e) {
      console.error(e);
      setError(parseServerError(e, "Verwijderen mislukt."));
    }
  }

  async function toggleActive(offer) {
    try {
      const next = !offer.is_active;
      await apiFetch(`${API_BASE}/api/partner/offers/${offer.id}`, {
        method: "PUT",
        headers: authHeaders(),
        body: JSON.stringify({ is_active: next }),
      });
      setOffers((prev) =>
        prev.map((o) => (o.id === offer.id ? { ...o, is_active: next } : o))
      );
    } catch (e) {
      console.error(e);
      setError(parseServerError(e, "Status bijwerken mislukt."));
    }
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = offers.filter((o) => {
      if (!q) return true;
      return (
        (o.title || "").toLowerCase().includes(q) ||
        (o.subtitle || "").toLowerCase().includes(q) ||
        (o.description || "").toLowerCase().includes(q)
      );
    });
    switch (sortBy) {
      case "active_desc":
        list = [...list].sort((a, b) => Number(b.is_active) - Number(a.is_active));
        break;
      case "discount_desc":
        list = [...list].sort(
          (a, b) => (b.discount_percent || 0) - (a.discount_percent || 0)
        );
        break;
      case "updated_at_desc":
      default: {
        // fallback op created_at
        list = [...list].sort((a, b) => {
          const aa = new Date(a.updated_at || a.created_at || 0).getTime();
          const bb = new Date(b.updated_at || b.created_at || 0).getTime();
          return bb - aa;
        });
      }
    }
    return list;
  }, [offers, query, sortBy]);

  /* ---------------- UI ---------------- */
  return (
    <div className="w-full max-w-6xl mx-auto p-4">
      <div className="flex items-center justify-between gap-3 mb-4">
        <h2 className="text-xl font-semibold">Aanbiedingen</h2>
        <div className="flex items-center gap-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Zoeken…"
            className="px-3 py-2 border rounded-lg text-sm"
          />
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="px-3 py-2 border rounded-lg text-sm"
          >
            <option value="updated_at_desc">Laatst bijgewerkt</option>
            <option value="active_desc">Actief eerst</option>
            <option value="discount_desc">Hoogste korting</option>
          </select>
          <button
            onClick={openCreate}
            className="px-3 py-2 rounded-lg bg-[var(--accent,#0b3654)] text-white hover:opacity-90"
          >
            + Nieuwe aanbieding
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-3 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <div className="p-6 text-sm text-gray-500">Laden…</div>
      ) : filtered.length === 0 ? (
        <div className="p-6 text-sm text-gray-500">Nog geen aanbiedingen.</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((o) => (
            <article
              key={o.id}
              className="border rounded-2xl overflow-hidden bg-white shadow-sm"
            >
              {o.image_url && (
                <img
                  src={o.image_url}
                  alt={o.title}
                  className="w-full h-40 object-cover"
                />
              )}
              <div className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold leading-tight">{o.title}</h3>
                    {o.subtitle && (
                      <p className="text-sm text-gray-500">{o.subtitle}</p>
                    )}
                  </div>
                  {o.discount_percent > 0 && (
                    <span className="text-xs px-2 py-1 rounded-full bg-green-100 text-green-700">
                      -{o.discount_percent}%
                    </span>
                  )}
                </div>

                {o.description && (
                  <p className="mt-2 text-sm text-gray-700 line-clamp-3">{o.description}</p>
                )}

                <div className="mt-3 flex items-center gap-3 text-sm">
                  {o.price_now != null && (
                    <span className="font-semibold">
                      €{Number(o.price_now).toFixed(2)}
                    </span>
                  )}
                  {o.price_original != null && o.price_now < o.price_original && (
                    <span className="line-through text-gray-400">
                      €{Number(o.price_original).toFixed(2)}
                    </span>
                  )}
                </div>

                <div className="mt-3 flex items-center justify-between">
                  <span
                    className={clsx(
                      "text-xs px-2 py-1 rounded-full",
                      o.is_active ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-600"
                    )}
                  >
                    {o.is_active ? "Actief" : "Inactief"}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      className="text-xs px-2 py-1 border rounded-lg hover:bg-gray-50"
                      onClick={() => toggleActive(o)}
                    >
                      {o.is_active ? "Deactiveren" : "Activeren"}
                    </button>
                    <button
                      className="text-xs px-2 py-1 border rounded-lg hover:bg-gray-50"
                      onClick={() => openEdit(o)}
                    >
                      Bewerken
                    </button>
                    <button
                      className="text-xs px-2 py-1 border rounded-lg hover:bg-red-50 text-red-600"
                      onClick={() => deleteOffer(o)}
                    >
                      Verwijderen
                    </button>
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {/* Drawer / Modal Editor */}
      {showEditor && (
        <div className="fixed inset-0 bg-black/30 z-40 flex">
          <div className="ml-auto w-full max-w-xl h-full bg-white shadow-xl p-4 overflow-y-auto">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold">
                {form.id ? "Aanbieding bewerken" : "Nieuwe aanbieding"}
              </h3>
              <button
                onClick={() => {
                  setShowEditor(false);
                  resetForm();
                }}
                className="px-3 py-1 border rounded-lg hover:bg-gray-50"
              >
                Sluiten
              </button>
            </div>

            <form onSubmit={saveOffer} className="space-y-3">
              <div>
                <label className="block text-sm font-medium">Titel</label>
                <input
                  required
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  className="mt-1 w-full px-3 py-2 border rounded-lg"
                  placeholder="Bijv. 10% korting op premium benzine"
                />
              </div>

              <div>
                <label className="block text-sm font-medium">Subtitel</label>
                <input
                  value={form.subtitle}
                  onChange={(e) => setForm((f) => ({ ...f, subtitle: e.target.value }))}
                  className="mt-1 w-full px-3 py-2 border rounded-lg"
                  placeholder="Bijv. Alleen dit weekend"
                />
              </div>

              <div>
                <label className="block text-sm font-medium">Beschrijving</label>
                <textarea
                  rows={4}
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  className="mt-1 w-full px-3 py-2 border rounded-lg"
                  placeholder="Korte uitleg van de aanbieding"
                />
              </div>

              <div>
                <label className="block text-sm font-medium">Voorwaarden</label>
                <textarea
                  rows={3}
                  value={form.terms}
                  onChange={(e) => setForm((f) => ({ ...f, terms: e.target.value }))}
                  className="mt-1 w-full px-3 py-2 border rounded-lg"
                  placeholder="Bijv. Niet combineerbaar met andere acties"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium">Originele prijs (€)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={form.priceOriginal}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        priceOriginal: e.target.value,
                      }))
                    }
                    className="mt-1 w-full px-3 py-2 border rounded-lg"
                    placeholder="Bijv. 19.99"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium">Actieprijs (€)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={form.priceNow}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        priceNow: e.target.value,
                      }))
                    }
                    className="mt-1 w-full px-3 py-2 border rounded-lg"
                    placeholder="Bijv. 14.99"
                  />
                </div>
              </div>

              <div className="flex items-center gap-3 text-sm">
                <span className="px-2 py-1 rounded-full bg-blue-50 text-blue-700">
                  Korting: {calcDiscountPercent(form.priceOriginal, form.priceNow)}%
                </span>
                {form.priceOriginal && form.priceNow && Number(form.priceNow) >= Number(form.priceOriginal) && (
                  <span className="text-red-600">Actieprijs is niet lager dan origineel.</span>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium">Start</label>
                  <input
                    type="datetime-local"
                    value={form.startAt}
                    onChange={(e) => setForm((f) => ({ ...f, startAt: e.target.value }))}
                    className={clsx(
                      "mt-1 w-full px-3 py-2 border rounded-lg",
                      dateError && "border-red-300"
                    )}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium">Einde</label>
                  <input
                    type="datetime-local"
                    value={form.endAt}
                    onChange={(e) => setForm((f) => ({ ...f, endAt: e.target.value }))}
                    className={clsx(
                      "mt-1 w-full px-3 py-2 border rounded-lg",
                      dateError && "border-red-300"
                    )}
                  />
                </div>
              </div>
              {dateError && <p className="text-sm text-red-600">{dateError}</p>}

              <div>
                <label className="block text-sm font-medium">Station ID (optioneel)</label>
                <input
                  value={form.stationId}
                  onChange={(e) => setForm((f) => ({ ...f, stationId: e.target.value }))}
                  className="mt-1 w-full px-3 py-2 border rounded-lg"
                  placeholder={stationId ? String(stationId) : "Bijv. 123"}
                />
                {stationId && (
                  <p className="mt-1 text-xs text-gray-500">
                    Deze editor is gefilterd op stationId={stationId}. Je kunt dit leeg laten.
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium">Afbeelding</label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0] || null;
                    setImageFile(file);
                    setPreviewUrl(file ? URL.createObjectURL(file) : "");
                  }}
                  className="mt-1 block w-full text-sm"
                />
                {(previewUrl || form.imageUrl) && (
                  <div className="mt-2">
                    <img
                      src={previewUrl || form.imageUrl}
                      alt="Preview"
                      className="w-full h-40 object-cover rounded-lg border"
                    />
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2">
                <input
                  id="isActive"
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
                />
                <label htmlFor="isActive" className="text-sm">Actief</label>
              </div>

              <div className="pt-2 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditor(false);
                    resetForm();
                  }}
                  className="px-3 py-2 border rounded-lg hover:bg-gray-50"
                >
                  Annuleren
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className={clsx(
                    "px-4 py-2 rounded-lg text-white",
                    saving ? "opacity-70 cursor-not-allowed bg-gray-500" : "bg-[var(--accent,#0b3654)] hover:opacity-90"
                  )}
                >
                  {saving ? "Opslaan…" : form.id ? "Wijzigingen opslaan" : "Aanmaken"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
