import React, { useEffect, useMemo, useRef, useState } from "react";
import PartnerLayout from "../../components/PartnerLayout.jsx";
import { API_BASE } from "../../api/partner.js";

/* ===================== Kleine API helper ===================== */
function authHeaders(extra = {}) {
  const token = localStorage.getItem("token") || "";
  return {
    Authorization: `Bearer ${token}`,
    ...extra,
  };
}

async function apiJson(path, { method = "GET", body, headers } = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: authHeaders({ "Content-Type": "application/json", ...(headers || {}) }),
    credentials: "include",
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || `${method} ${path} failed`);
  return data;
}

async function apiMultipart(path, formData) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: authHeaders(), // GEEN content-type hier — browser zet boundary
    credentials: "include",
    body: formData,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || `POST ${path} failed`);
  return data;
}

/* ===================== Hoofdcomponent ===================== */
export default function PartnerSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");

  // Profiel velden
  const [profile, setProfile] = useState({
    company_name: "",
    kvk: "",
    vat: "",
    contact_name: "",
    email: "",
    phone: "",
    street: "",
    house_number: "",
    postcode: "",
    city: "",
    country: "Netherlands",
    iban: "",
    bank_name: "",
    logo_url: "",
  });

  // Wachtwoord
  const [pw, setPw] = useState({ current: "", next: "", confirm: "" });
  const [pwSaving, setPwSaving] = useState(false);

  // Logo upload
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState("");
  const fileInputRef = useRef(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      setError("");
      try {
        // ⚠️ Backend route-aanname: /api/partner/profile (GET)
        const data = await apiJson("/api/partner/profile");
        if (alive) setProfile((p) => ({ ...p, ...(data || {}) }));
      } catch (e) {
        setError(e.message || "Laden mislukt");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
      if (logoPreview) URL.revokeObjectURL(logoPreview);
    };
  }, []); // eslint-disable-line

  function setField(key, val) {
    setProfile((p) => ({ ...p, [key]: val }));
  }

  async function handleSaveProfile(e) {
    e?.preventDefault?.();
    setSaving(true);
    setError("");
    setNote("");
    try {
      // 1) Profiel bewaren — ⚠️ Backend route-aanname: PUT /api/partner/profile
      const saved = await apiJson("/api/partner/profile", {
        method: "PUT",
        body: profile,
      });

      // 2) Eventueel logo uploaden — ⚠️ Backend route-aanname: POST /api/partner/profile/logo
      if (logoFile) {
        const fd = new FormData();
        fd.append("logo", logoFile);
        const up = await apiMultipart("/api/partner/profile/logo", fd);
        saved.logo_url = up?.logo_url || saved.logo_url;
      }

      setProfile((p) => ({ ...p, ...(saved || {}) }));
      setNote("Instellingen opgeslagen ✅");
    } catch (e) {
      setError(e.message || "Opslaan mislukt");
    } finally {
      setSaving(false);
    }
  }

  async function handleChangePassword(e) {
    e?.preventDefault?.();
    setPwSaving(true);
    setError("");
    setNote("");

    if (!pw.next || pw.next.length < 8) {
      setPwSaving(false);
      return setError("Nieuw wachtwoord moet minimaal 8 tekens zijn.");
    }
    if (pw.next !== pw.confirm) {
      setPwSaving(false);
      return setError("Nieuw wachtwoord en bevestiging komen niet overeen.");
    }
    try {
      // ⚠️ Backend route-aanname: PUT /api/partner/change-password
      await apiJson("/api/partner/change-password", {
        method: "PUT",
        body: { current_password: pw.current, new_password: pw.next },
      });
      setNote("Wachtwoord gewijzigd ✅");
      setPw({ current: "", next: "", confirm: "" });
    } catch (e) {
      setError(e.message || "Wachtwoord wijzigen mislukt");
    } finally {
      setPwSaving(false);
    }
  }

  function onPickLogo(file) {
    if (!file) return;
    setLogoFile(file);
    if (logoPreview) URL.revokeObjectURL(logoPreview);
    const url = URL.createObjectURL(file);
    setLogoPreview(url);
  }

  return (
    <PartnerLayout>
      <div className="mx-auto max-w-5xl px-4 py-6">
        <header className="mb-6 border-b pb-4">
          <h1 className="text-2xl font-semibold">Partner-instellingen</h1>
          <p className="text-sm text-gray-500">Beheer je bedrijfsgegevens, logo en accountbeveiliging.</p>
        </header>

        {loading ? (
          <div className="animate-pulse text-gray-500">Laden…</div>
        ) : (
          <>
            {(error || note) && (
              <div className="mb-4 space-y-2">
                {error && (
                  <div className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-red-700">{error}</div>
                )}
                {note && (
                  <div className="rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-3 text-emerald-700">{note}</div>
                )}
              </div>
            )}

            {/* ================== Bedrijfsgegevens ================== */}
            <section className="mb-8 rounded-2xl border bg-white/60 p-5 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-medium">Bedrijfsgegevens</h2>
                <button
                  onClick={handleSaveProfile}
                  disabled={saving}
                  className="rounded-xl bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving ? "Opslaan…" : "Opslaan"}
                </button>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <LabeledInput label="Bedrijfsnaam" value={profile.company_name} onChange={(v) => setField("company_name", v)} />
                <LabeledInput label="Contactpersoon" value={profile.contact_name} onChange={(v) => setField("contact_name", v)} />
                <LabeledInput label="E‑mail" type="email" value={profile.email} onChange={(v) => setField("email", v)} />
                <LabeledInput label="Telefoon" value={profile.phone} onChange={(v) => setField("phone", v)} />
                <LabeledInput label="KvK" value={profile.kvk} onChange={(v) => setField("kvk", v)} />
                <LabeledInput label="BTW‑nummer" value={profile.vat} onChange={(v) => setField("vat", v)} />

                <LabeledInput label="Straat" value={profile.street} onChange={(v) => setField("street", v)} />
                <LabeledInput label="Huisnummer" value={profile.house_number} onChange={(v) => setField("house_number", v)} />
                <LabeledInput label="Postcode" value={profile.postcode} onChange={(v) => setField("postcode", v)} />
                <LabeledInput label="Plaats" value={profile.city} onChange={(v) => setField("city", v)} />
                <LabeledInput label="Land" value={profile.country} onChange={(v) => setField("country", v)} />

                <LabeledInput label="IBAN" value={profile.iban} onChange={(v) => setField("iban", v)} />
                <LabeledInput label="Banknaam" value={profile.bank_name} onChange={(v) => setField("bank_name", v)} />
              </div>

              {/* Logo */}
              <div className="mt-6">
                <label className="mb-2 block text-sm font-medium">Bedrijfslogo</label>
                <div className="flex items-center gap-4">
                  <div className="h-16 w-16 overflow-hidden rounded-xl border bg-white">
                    {logoPreview || profile.logo_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={logoPreview || profile.logo_url}
                        alt="Logo preview"
                        className="h-full w-full object-contain"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-xs text-gray-400">geen logo</div>
                    )}
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => onPickLogo(e.target.files?.[0])}
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="rounded-xl border px-3 py-2 hover:bg-gray-50"
                  >
                    Kies bestand
                  </button>
                  {logoFile && (
                    <span className="text-sm text-gray-500">{logoFile.name}</span>
                  )}
                </div>
                <p className="mt-2 text-xs text-gray-500">PNG of JPG, bij voorkeur vierkant. Upload gebeurt bij het opslaan.</p>
              </div>
            </section>

            {/* ================== Beveiliging ================== */}
            <section className="mb-8 rounded-2xl border bg-white/60 p-5 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-medium">Accountbeveiliging</h2>
                <button
                  onClick={handleChangePassword}
                  disabled={pwSaving}
                  className="rounded-xl bg-slate-700 px-4 py-2 text-white hover:bg-slate-800 disabled:opacity-50"
                >
                  {pwSaving ? "Wijzigen…" : "Wijzig wachtwoord"}
                </button>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <LabeledInput label="Huidig wachtwoord" type="password" value={pw.current} onChange={(v) => setPw((x) => ({ ...x, current: v }))} />
                <LabeledInput label="Nieuw wachtwoord" type="password" value={pw.next} onChange={(v) => setPw((x) => ({ ...x, next: v }))} />
                <LabeledInput label="Bevestig nieuw wachtwoord" type="password" value={pw.confirm} onChange={(v) => setPw((x) => ({ ...x, confirm: v }))} />
              </div>
              <p className="mt-2 text-xs text-gray-500">Minimaal 8 tekens. Gebruik bij voorkeur een wachtwoordmanager.</p>
            </section>

            {/* ================== API Keys (optioneel / placeholder) ================== */}
            <section className="mb-8 rounded-2xl border bg-white/60 p-5 shadow-sm">
              <h2 className="mb-4 text-lg font-medium">API‑integraties (optioneel)</h2>
              <p className="text-sm text-gray-600">
                Hier kunnen later API‑sleutels of koppelingen komen (bijv. Wallester Merchant ID, Stripe account ID).
              </p>
              <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2">
                <LabeledInput disabled label="Stripe Account ID" placeholder="(later)" />
                <LabeledInput disabled label="Wallester Merchant/Project" placeholder="(later)" />
              </div>
            </section>
          </>
        )}
      </div>
    </PartnerLayout>
  );
}

/* ===================== UI helpers ===================== */
function LabeledInput({ label, value, onChange, type = "text", placeholder = "", disabled = false }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-gray-700">{label}</span>
      <input
        type={type}
        value={value ?? ""}
        disabled={disabled}
        placeholder={placeholder}
        onChange={(e) => onChange?.(e.target.value)}
        className="w-full rounded-xl border bg-white px-3 py-2 outline-none ring-blue-200 hover:border-gray-300 focus:border-blue-400 focus:ring"
      />
    </label>
  );
}
