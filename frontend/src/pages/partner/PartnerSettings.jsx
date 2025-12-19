// src/pages/partner/PartnerSettings.jsx
import React, { useEffect, useMemo, useState } from "react";
import { API_BASE } from "../../api/partner.js";

/* ---------------- Helpers ---------------- */
function authHeaders(extra = {}) {
  const token = localStorage.getItem("token") || "";
  return {
    Authorization: `Bearer ${token}`,
    ...(extra || {}),
  };
}

async function apiGet(path) {
  const res = await fetch(`${API_BASE}${path}`, { headers: authHeaders() });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || `GET ${path} failed`);
  return data;
}

async function apiPut(path, body) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
    },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || `PUT ${path} failed`);
  return data;
}

async function uploadLogo(file) {
  const fd = new FormData();
  fd.append("file", file);
  const res = await fetch(`${API_BASE}/api/partner/uploads`, {
    method: "POST",
    headers: authHeaders(),
    body: fd,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || "Upload mislukt");
  // verwacht: { url: "https://.../uploads/xyz.png" }
  return data;
}

/* ---------------- Component ---------------- */
export default function PartnerSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  const [settings, setSettings] = useState({
    company_name: "",
    kvk_number: "",
    vat_number: "",
    payout_iban: "",

    contact_name: "",
    contact_email: "",
    contact_phone: "",

    support_email: "",
    support_phone: "",
    website_url: "",

    logo_url: "",
    brand_primary: "#0ea5e9", // blauw
    brand_accent: "#f59e0b",  // oranje

    webhook_url: "",
    notify_email_reports: true,

    address_line1: "",
    postcode: "",
    city: "",
    country: "NL",
  });

  const colorPreviewStyle = useMemo(
    () => ({
      display: "inline-block",
      width: 16, height: 16, borderRadius: 4,
      marginLeft: 8, border: "1px solid #e5e7eb",
    }),
    []
  );

  function setField(k, v) {
    setSettings((s) => ({ ...s, [k]: v }));
  }

  /* ------- Load ------- */
  async function load() {
    setLoading(true);
    setErr(""); setMsg("");
    try {
      const data = await apiGet("/api/partner/settings");
      // merge met defaults zodat velden nooit undefined zijn
      setSettings((prev) => ({ ...prev, ...(data || {}) }));
    } catch (e) {
      setErr(e.message || "Kon instellingen niet laden");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  /* ------- Save ------- */
  async function handleSave(e) {
    e?.preventDefault?.();
    setSaving(true);
    setErr(""); setMsg("");
    try {
      const payload = { ...settings };
      // simpele normalisaties
      if (payload.postcode) payload.postcode = String(payload.postcode).replace(/\s+/g, "").toUpperCase();
      await apiPut("/api/partner/settings", payload);
      setMsg("Instellingen opgeslagen ✅");
    } catch (e) {
      setErr(e.message || "Opslaan mislukt");
    } finally {
      setSaving(false);
    }
  }

  /* ------- Upload logo ------- */
  async function onLogoChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setErr(""); setMsg("");
    try {
      const { url } = await uploadLogo(file);
      if (url) {
        setField("logo_url", url);
        setMsg("Logo geüpload ✅");
      }
    } catch (e) {
      setErr(e.message || "Logo uploaden mislukt");
    } finally {
      // reset file input
      e.target.value = "";
    }
  }

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between gap-3 mb-4">
        <h1 className="text-2xl font-semibold">Partner instellingen</h1>
        <div className="flex gap-2">
          <button className="btn" onClick={load} disabled={loading}>
            Verversen
          </button>
          <button
            className="btn btn-primary"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? "Opslaan…" : "Opslaan"}
          </button>
        </div>
      </div>

      {err && (
        <div className="mb-4 rounded-xl border border-red-300 bg-red-50 text-red-800 px-4 py-3">
          {err}
        </div>
      )}
      {msg && (
        <div className="mb-4 rounded-xl border border-emerald-300 bg-emerald-50 text-emerald-800 px-4 py-3">
          {msg}
        </div>
      )}

      {loading ? (
        <div className="rounded-xl border p-4">Laden…</div>
      ) : (
        <form onSubmit={handleSave} className="space-y-8">
          {/* Bedrijfsgegevens */}
          <section className="rounded-2xl border border-gray-200 p-4">
            <h2 className="font-semibold mb-3">Bedrijfsgegevens</h2>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-gray-600 mb-1">Bedrijfsnaam *</label>
                <input
                  className="input"
                  value={settings.company_name}
                  onChange={(e) => setField("company_name", e.target.value)}
                  placeholder="BV Naam"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">IBAN (uitbetalingen)</label>
                <input
                  className="input"
                  value={settings.payout_iban}
                  onChange={(e) => setField("payout_iban", e.target.value)}
                  placeholder="NL.."
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">KvK</label>
                <input
                  className="input"
                  value={settings.kvk_number}
                  onChange={(e) => setField("kvk_number", e.target.value)}
                  placeholder="12345678"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">BTW-nummer</label>
                <input
                  className="input"
                  value={settings.vat_number}
                  onChange={(e) => setField("vat_number", e.target.value)}
                  placeholder="NL..."
                />
              </div>
            </div>
          </section>

          {/* Contact */}
          <section className="rounded-2xl border border-gray-200 p-4">
            <h2 className="font-semibold mb-3">Contact</h2>
            <div className="grid md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm text-gray-600 mb-1">Naam contactpersoon</label>
                <input
                  className="input"
                  value={settings.contact_name}
                  onChange={(e) => setField("contact_name", e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">E-mail</label>
                <input
                  className="input"
                  type="email"
                  value={settings.contact_email}
                  onChange={(e) => setField("contact_email", e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Telefoon</label>
                <input
                  className="input"
                  value={settings.contact_phone}
                  onChange={(e) => setField("contact_phone", e.target.value)}
                />
              </div>
            </div>

            <div className="grid md:grid-cols-3 gap-4 mt-4">
              <div>
                <label className="block text-sm text-gray-600 mb-1">Support e-mail</label>
                <input
                  className="input"
                  type="email"
                  value={settings.support_email}
                  onChange={(e) => setField("support_email", e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Support telefoon</label>
                <input
                  className="input"
                  value={settings.support_phone}
                  onChange={(e) => setField("support_phone", e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Website</label>
                <input
                  className="input"
                  value={settings.website_url}
                  onChange={(e) => setField("website_url", e.target.value)}
                  placeholder="https://..."
                />
              </div>
            </div>
          </section>

          {/* Adres */}
          <section className="rounded-2xl border border-gray-200 p-4">
            <h2 className="font-semibold mb-3">Adres</h2>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-gray-600 mb-1">Adresregel</label>
                <input
                  className="input"
                  value={settings.address_line1}
                  onChange={(e) => setField("address_line1", e.target.value)}
                  placeholder="Straat + nr"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Plaats</label>
                <input
                  className="input"
                  value={settings.city}
                  onChange={(e) => setField("city", e.target.value)}
                  placeholder="Plaats"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Postcode</label>
                <input
                  className="input"
                  value={settings.postcode}
                  onChange={(e) => setField("postcode", e.target.value)}
                  placeholder="1234 AB"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Land</label>
                <input
                  className="input"
                  value={settings.country}
                  onChange={(e) => setField("country", e.target.value)}
                  placeholder="NL"
                />
              </div>
            </div>
          </section>

          {/* Branding */}
          <section className="rounded-2xl border border-gray-200 p-4">
            <h2 className="font-semibold mb-3">Branding</h2>
            <div className="grid md:grid-cols-3 gap-4 items-end">
              <div>
                <label className="block text-sm text-gray-600 mb-1">Logo</label>
                <div className="flex items-center gap-3">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={onLogoChange}
                  />
                  {settings.logo_url ? (
                    <img
                      src={settings.logo_url}
                      alt="logo"
                      style={{ width: 48, height: 48, objectFit: "contain", borderRadius: 8, border: "1px solid #e5e7eb" }}
                    />
                  ) : (
                    <span className="muted">Nog geen logo</span>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm text-gray-600 mb-1">Primaire kleur</label>
                <div className="flex items-center">
                  <input
                    type="color"
                    value={settings.brand_primary || "#0ea5e9"}
                    onChange={(e) => setField("brand_primary", e.target.value)}
                    className="w-12 h-10 p-0 border rounded"
                    title="Kies primaire kleur"
                  />
                  <span style={{ ...colorPreviewStyle, background: settings.brand_primary }} />
                </div>
              </div>

              <div>
                <label className="block text-sm text-gray-600 mb-1">Accentkleur</label>
                <div className="flex items-center">
                  <input
                    type="color"
                    value={settings.brand_accent || "#f59e0b"}
                    onChange={(e) => setField("brand_accent", e.target.value)}
                    className="w-12 h-10 p-0 border rounded"
                    title="Kies accentkleur"
                  />
                  <span style={{ ...colorPreviewStyle, background: settings.brand_accent }} />
                </div>
              </div>
            </div>
          </section>

          {/* Integraties */}
          <section className="rounded-2xl border border-gray-200 p-4">
            <h2 className="font-semibold mb-3">Integraties</h2>
            <div className="grid md:grid-cols-3 gap-4 items-center">
              <div className="md:col-span-2">
                <label className="block text-sm text-gray-600 mb-1">Webhook URL (events)</label>
                <input
                  className="input"
                  value={settings.webhook_url}
                  onChange={(e) => setField("webhook_url", e.target.value)}
                  placeholder="https://example.com/webhooks/fuellinq"
                />
              </div>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={!!settings.notify_email_reports}
                  onChange={(e) => setField("notify_email_reports", e.target.checked)}
                />
                <span className="text-sm text-gray-700">Stuur maandrapport per e-mail</span>
              </label>
            </div>
          </section>

          <div className="flex items-center justify-end gap-2">
            <button type="button" className="btn" onClick={load} disabled={loading}>
              Wijzigingen verwerpen
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? "Opslaan…" : "Opslaan"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
