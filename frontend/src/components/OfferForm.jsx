import React, { useEffect, useState } from "react";
import { uploadImage, listOfferTemplates } from "../api/partner.js";

export default function OfferForm({ open, initial, onClose, onSave }) {
  const [title, setTitle] = useState(initial?.title || "");
  const [body, setBody] = useState(initial?.body || "");
  const [badge, setBadge] = useState(initial?.badge || "Deal");
  const [imageUrl, setImageUrl] = useState(initial?.image_url || "");
  const [templateKey, setTemplateKey] = useState(initial?.template_key || "");
  const [recurrence, setRecurrence] = useState(initial?.recurrence || "none");
  const [weekdays, setWeekdays] = useState(initial?.weekdays || ""); // bv "FR,SA,SU"
  const [status, setStatus] = useState(initial?.status || "draft");
  const [templates, setTemplates] = useState([]);

  useEffect(() => {
    setTitle(initial?.title || "");
    setBody(initial?.body || "");
    setBadge(initial?.badge || "Deal");
    setImageUrl(initial?.image_url || "");
    setTemplateKey(initial?.template_key || "");
    setRecurrence(initial?.recurrence || "none");
    setWeekdays(initial?.weekdays || "");
    setStatus(initial?.status || "draft");
  }, [initial]);

  useEffect(() => {
    (async () => {
      try { setTemplates(await listOfferTemplates()); } catch {}
    })();
  }, []);

  async function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const { url } = await uploadImage(file);
      setImageUrl(url);
    } catch {
      alert("Upload mislukt");
    }
  }

  function pickTemplate(t) {
    setTemplateKey(t.template_key || "");
    if (t.title) setTitle(t.title);
    if (t.body) setBody(t.body);
    if (t.image_url) setImageUrl(t.image_url);
    if (t.badge) setBadge(t.badge);
  }

  function submit(e) {
    e.preventDefault();
    onSave({
      title: title.trim(),
      body: body.trim() || null,
      badge,
      image_url: imageUrl || null,
      template_key: templateKey || null,
      recurrence,
      weekdays: weekdays || null,
      status,
    });
  }

  return (
    <div
      style={{
        position:"fixed", inset:0, pointerEvents: open ? "auto":"none",
        background: open ? "rgba(15,23,42,0.35)" : "transparent",
        transition:"background .2s ease"
      }}
      onClick={onClose}
    >
      <aside
        onClick={(e)=>e.stopPropagation()}
        style={{
          position:"absolute", top:0, right:0, height:"100%", width:420, maxWidth:"100%",
          background:"#fff", borderLeft:"1px solid #e5e7eb", padding:16,
          transform: open ? "translateX(0)" : "translateX(100%)",
          transition:"transform .25s ease"
        }}
      >
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
          <h3 style={{ margin:0 }}>{initial?.id ? "Actie bewerken" : "Nieuwe actie"}</h3>
          <button className="btn btn-outline" onClick={onClose}>Sluiten</button>
        </div>

        {/* Templates */}
        {templates?.length > 0 && (
          <div className="card p-3" style={{ marginBottom:12 }}>
            <div style={{ fontWeight:700, marginBottom:6 }}>Snel starten met sjabloon</div>
            <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
              {templates.map(t => (
                <button key={t.template_key} className="btn btn-outline" onClick={()=>pickTemplate(t)}>
                  {t.title}
                </button>
              ))}
            </div>
          </div>
        )}

        <form onSubmit={submit} className="space-y-3">
          <label className="block">
            <div className="text-sm text-gray-600 mb-1">Titel</div>
            <input className="w-full border rounded px-3 py-2" value={title} onChange={e=>setTitle(e.target.value)} />
          </label>

          <label className="block">
            <div className="text-sm text-gray-600 mb-1">Omschrijving (optioneel)</div>
            <input className="w-full border rounded px-3 py-2" value={body} onChange={e=>setBody(e.target.value)} />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <div className="text-sm text-gray-600 mb-1">Badge</div>
              <select className="w-full border rounded px-3 py-2" value={badge} onChange={e=>setBadge(e.target.value)}>
                <option>Deal</option><option>Nieuw</option><option>Hot</option><option>Tip</option>
              </select>
            </label>
            <label className="block">
              <div className="text-sm text-gray-600 mb-1">Status</div>
              <select className="w-full border rounded px-3 py-2" value={status} onChange={e=>setStatus(e.target.value)}>
                <option value="draft">Concept</option>
                <option value="published">Gepubliceerd</option>
              </select>
            </label>
          </div>

          <label className="block">
            <div className="text-sm text-gray-600 mb-1">Afbeelding (URL)</div>
            <input className="w-full border rounded px-3 py-2" value={imageUrl} onChange={e=>setImageUrl(e.target.value)} placeholder="https://..." />
          </label>
          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
            <input type="file" accept="image/*" onChange={handleFile} />
            {imageUrl && <img src={imageUrl} alt="" style={{ width:56, height:56, objectFit:"cover", borderRadius:8, border:"1px solid #e5e7eb" }} />}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <div className="text-sm text-gray-600 mb-1">Herhaling</div>
              <select className="w-full border rounded px-3 py-2" value={recurrence} onChange={e=>setRecurrence(e.target.value)}>
                <option value="none">Geen</option>
                <option value="weekly">Wekelijks</option>
                <option value="monthly">Maandelijks</option>
              </select>
            </label>
            <label className="block">
              <div className="text-sm text-gray-600 mb-1">Weekdagen (CSV)</div>
              <input className="w-full border rounded px-3 py-2" value={weekdays} onChange={e=>setWeekdays(e.target.value)} placeholder="FR,SA,SU" />
            </label>
          </div>

          <label className="block">
            <div className="text-sm text-gray-600 mb-1">Als sjabloon opslaan (optioneel key)</div>
            <input className="w-full border rounded px-3 py-2" value={templateKey} onChange={e=>setTemplateKey(e.target.value)} placeholder="redbull_2voor3" />
          </label>

          <div style={{ display:"flex", gap:8 }}>
            <button className="btn" type="submit">Opslaan</button>
            <button className="btn btn-outline" type="button" onClick={onClose}>Annuleren</button>
          </div>
        </form>
      </aside>
    </div>
  );
}
