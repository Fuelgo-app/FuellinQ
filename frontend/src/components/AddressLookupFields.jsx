// src/components/AddressLookupFields.jsx
import React, { useRef, useState } from "react";
import { addressLookup } from "@api/partner.js";

// Helpers voor NL-postcode
const zipOk = (z) => /^[0-9]{4}\s?[A-Z]{2}$/.test(String(z).trim().toUpperCase());
const normZip = (z) => String(z || "").replace(/\s+/g, "").toUpperCase();
const fmtZip = (z) => {
  const s = normZip(z);
  return s.length === 6 ? `${s.slice(0, 4)} ${s.slice(4)}` : z;
};

function AddressLookupFieldsBase({ value = {}, onChange = () => {}, compact = false }) {
  const [form, setForm] = useState({
    postcode: value.postcode || "",
    number: value.number || "",
    addition: value.addition || "",
    street: value.street || value.address_line1 || "",
    city: value.city || "",
    lat: value.lat ?? "",
    lng: value.lng ?? "",
  });
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  // Refs voor caret/focus-fix
  const pcRef = useRef(null);
  const nrRef = useRef(null);
  const adRef = useRef(null);
  const stRef = useRef(null);
  const ctRef = useRef(null);

  // State helpers
  const setLocal = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const bubbleAll = (next) => onChange({ ...next });

  // Lokaal typen + caret behouden
  function bindTyping(key, ref) {
    return (e) => {
      const val = e.target.value;
      const pos = e.target.selectionStart ?? val.length;
      setLocal(key, val);
      // focus & caret terugzetten in volgende frame
      requestAnimationFrame(() => {
        if (ref?.current) {
          ref.current.focus({ preventScroll: true });
          try { ref.current.setSelectionRange(pos, pos); } catch {}
        }
      });
    };
  }

  // Blur-handlers: bubbelen + evt. auto-lookup
  const onBlurBubble = (key) => () => {
    // Normaliseer postcode op blur
    const next = { ...form, ...(key === "postcode" ? { postcode: fmtZip(form.postcode) } : {}) };
    setForm(next);
    bubbleAll(next);

    if (key === "postcode" || key === "number" || key === "addition") {
      if (zipOk(next.postcode) && String(next.number).trim()) {
        handleLookup(next);
      }
    }
  };

  async function handleLookup(current = form) {
    const f = current; // gebruik meest recente snapshot
    if (!zipOk(f.postcode)) {
      setMsg("Vul een volledige postcode in (1234 AB).");
      return;
    }
    if (!f.number) return;

    setLoading(true);
    setMsg("");
    try {
      const data = await addressLookup(f.postcode, f.number, { addition: f.addition });

      if (!data) {
        setMsg("Adres niet gevonden. Check postcode/huisnr.");
        return;
      }

      // Bouw "Straat + nr [toevoeging]"
      const addr1 = data.street
        ? `${data.street} ${data.house_number || f.number}${data.house_letter || ""}${
            data.house_addition ? ` ${data.house_addition}` : ""
          }`.replace(/\s+/g, " ").trim()
        : f.street;

      // Overschrijf postcode alleen als hij exact matcht
      const sameZip = normZip(data.postcode) === normZip(f.postcode);

      const next = {
        ...f,
        street: data.street ? addr1 : f.street,
        city: data.city || f.city,
        postcode: sameZip ? (data.postcode || f.postcode) : f.postcode,
        lat: data.lat ?? f.lat,
        lng: data.lng ?? f.lng,
      };

      setForm(next);
      bubbleAll(next);

      if (!sameZip && data.source === "nominatim") {
        setMsg("Adres gevonden, maar lijkt buiten de ingevoerde postcode te vallen. Controleer.");
      } else {
        setMsg(`Gevonden via ${data.source} ✓`);
      }
    } catch {
      setMsg("Lookup mislukt. Probeer opnieuw.");
    } finally {
      setLoading(false);
    }
  }

  const Row = ({ children }) => (
    <div className={compact ? "grid grid-cols-3 gap-2" : "grid grid-cols-6 gap-3"}>
      {children}
    </div>
  );

  const canLookup = zipOk(form.postcode) && String(form.number || "").trim();

  return (
    <div className="space-y-3">
      <Row>
        <div className="col-span-2">
          <label className="block text-sm font-medium mb-1">Postcode</label>
          <input
            ref={pcRef}
            type="text"
            inputMode="text"
            autoCapitalize="characters"
            autoComplete="off"
            spellCheck={false}
            className="w-full rounded-xl border p-2"
            placeholder="1234 AB"
            value={form.postcode}
            onChange={bindTyping("postcode", pcRef)}
            onBlur={onBlurBubble("postcode")}
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Nr</label>
          <input
            ref={nrRef}
            type="text"
            inputMode="numeric"
            autoComplete="off"
            className="w-full rounded-xl border p-2"
            placeholder="12"
            value={form.number}
            onChange={bindTyping("number", nrRef)}
            onKeyDown={(e) => { if (e.key === "Enter" && canLookup) handleLookup(); }}
            onBlur={onBlurBubble("number")}
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Toev. (optioneel)</label>
          <input
            ref={adRef}
            type="text"
            autoComplete="off"
            className="w-full rounded-xl border p-2"
            placeholder="Toevoeging (optioneel)"
            value={form.addition}
            onChange={bindTyping("addition", adRef)}
            onBlur={onBlurBubble("addition")}
          />
        </div>
        <div className="col-span-2 flex items-end">
          <button
            type="button"
            onClick={() => handleLookup()}
            disabled={loading || !canLookup}
            className="w-full rounded-xl border px-3 py-2 hover:bg-gray-50 disabled:opacity-50"
          >
            {loading ? "Zoeken…" : "Adres ophalen"}
          </button>
        </div>
      </Row>

      <Row>
        <div className="col-span-4">
          <label className="block text-sm font-medium mb-1">Straat + nr</label>
          <input
            ref={stRef}
            type="text"
            className="w-full rounded-xl border p-2"
            placeholder="Straatnaam 12"
            value={form.street}
            onChange={bindTyping("street", stRef)}   // lokaal typen, caret blijft goed
            onBlur={() => bubbleAll({ ...form })}    // pas bij blur naar parent
          />
        </div>
        <div className="col-span-2">
          <label className="block text-sm font-medium mb-1">Plaats</label>
          <input
            ref={ctRef}
            type="text"
            className="w-full rounded-xl border p-2"
            placeholder="Plaats"
            value={form.city}
            onChange={bindTyping("city", ctRef)}     // lokaal typen
            onBlur={() => bubbleAll({ ...form })}    // bij blur naar parent
          />
        </div>
      </Row>

      <Row>
        <div>
          <label className="block text-sm font-medium mb-1">Lat</label>
          <input
            type="text"
            inputMode="decimal"
            className="w-full rounded-xl border p-2"
            placeholder="52.123456"
            value={form.lat}
            onChange={(e) => setLocal("lat", e.target.value)}
            onBlur={() => bubbleAll({ ...form })}
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Lng</label>
          <input
            type="text"
            inputMode="decimal"
            className="w-full rounded-xl border p-2"
            placeholder="5.123456"
            value={form.lng}
            onChange={(e) => setLocal("lng", e.target.value)}
            onBlur={() => bubbleAll({ ...form })}
          />
        </div>
        <div className="col-span-4 flex items-end">
          <p className="text-sm text-gray-500">
            {msg || (!zipOk(form.postcode) && (form.postcode?.length ? "Postcode moet 1234 AB zijn." : ""))}
          </p>
        </div>
      </Row>
    </div>
  );
}

export default React.memo(AddressLookupFieldsBase);
