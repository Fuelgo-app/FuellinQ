// src/components/AdminTheme.jsx
import React, { useState, useEffect } from "react";
import { getBrand, setBrand, clearBrand } from "../lib/brand";

export default function AdminTheme() {
  const [b, setB] = useState(getBrand());
  useEffect(() => setB(getBrand()), []);

  const set = (k, v) => setB((x) => ({ ...x, [k]: v }));
  const save = () => { setBrand(b); alert("Branding opgeslagen ✅"); };
  const reset = () => { clearBrand(); setB(getBrand()); alert("Branding gereset ✅"); };

  const Field = ({ label, children }) => (
    <label style={{display:"grid", gap:6}}>
      <span style={{fontSize:14, opacity:.9}}>{label}</span>
      {children}
    </label>
  );

  const Color = (prop) => (
    <div style={{display:"flex", gap:8}}>
      <input type="color" value={b[prop]} onChange={(e)=>set(prop,e.target.value)}
             style={{width:42,height:34,border:"1px solid #e5e7eb",borderRadius:8}} />
      <input value={b[prop]} onChange={(e)=>set(prop,e.target.value)}
             className="input" placeholder="#000000" />
    </div>
  );

  return (
    <div className="card p-4" style={{borderRadius:16}}>
      <h3 style={{marginTop:0}}>Branding</h3>
      <p className="muted">Pas kleuren & logo aan. Opslaan past het thema direct toe.</p>

      <div className="grid" style={{gridTemplateColumns:"repeat(2,minmax(0,1fr))",gap:16,marginTop:12}}>
        <Field label="Primair (knoppen/links)"><Color prop="primary" /></Field>
        <Field label="Accent (cijfers/labels)"><Color prop="secondary" /></Field>
        <Field label="Achtergrond (pagina)"><Color prop="bg" /></Field>
        <Field label="Surface (kaarten)"><Color prop="surface" /></Field>
        <Field label="Tekst"><Color prop="text" /></Field>
        <Field label="Muted"><Color prop="muted" /></Field>
        <Field label="Randkleur"><Color prop="border" /></Field>
        <Field label="Sidebar achtergrond"><Color prop="sidebarBg" /></Field>
        <Field label="Sidebar tekst"><Color prop="sidebarText" /></Field>
        <Field label="Logo URL">
          <input className="input" value={b.logo_url||""}
                 onChange={(e)=>set("logo_url", e.target.value)}
                 placeholder="/assets/logo-mijnmerk.png" />
        </Field>
        <Field label="Font family">
          <input className="input" value={b.font_family||""}
                 onChange={(e)=>set("font_family", e.target.value)}
                 placeholder="Inter, system-ui, sans-serif" />
        </Field>
      </div>

      <div style={{display:"flex",gap:10,marginTop:16}}>
        <button className="btn" onClick={save}>Opslaan</button>
        <button className="btn btn-outline" onClick={reset}>Reset naar standaard</button>
      </div>
    </div>
  );
}
