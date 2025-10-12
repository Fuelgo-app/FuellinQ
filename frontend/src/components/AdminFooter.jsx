// src/components/AdminFooter.jsx
import React, { useEffect, useState } from "react";
import { DEFAULT_FOOTER_LINKS, saveFooterLinks } from "../lib/footer";

export default function AdminFooter() {
  const [items, setItems] = useState(DEFAULT_FOOTER_LINKS);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("footer_links");
      if (raw) setItems(JSON.parse(raw));
    } catch {}
  }, []);

  const toggle = (i) =>
    setItems(prev => {
      const arr = prev.slice();
      arr[i] = { ...arr[i], inFooter: !(arr[i].inFooter !== false) ? false : true };
      return arr;
    });

  const move = (i, dir) =>
    setItems(prev => {
      const arr = prev.slice();
      const j = i + dir;
      if (j < 0 || j >= arr.length) return prev;
      [arr[i], arr[j]] = [arr[j], arr[i]];
      return arr;
    });

  const onTitle = (i, v) =>
    setItems(prev => {
      const arr = prev.slice();
      arr[i] = { ...arr[i], title: v };
      return arr;
    });

  const onSave = () => {
    const seen = new Set();
    const cleaned = items.filter(it => {
      const key = (it.slug || "").toLowerCase().trim();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    saveFooterLinks(cleaned);
    alert("Footer-menu opgeslagen.");
  };

  const onReset = () => {
    saveFooterLinks(DEFAULT_FOOTER_LINKS);
    setItems(DEFAULT_FOOTER_LINKS);
    alert("Footer-menu teruggezet naar standaard.");
  };

  return (
    <div className="card p-4" style={{ borderRadius: 16 }}>
      <h3 style={{ marginTop: 0 }}>Footer-menu</h3>
      <p style={{ marginTop: 0, opacity: .8 }}>
        Schakel links aan/uit, wijzig titels of verander de volgorde. Dubbels worden automatisch verwijderd.
      </p>

      <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
        {items.map((it, i) => (
          <li key={it.slug}
              style={{ display: "grid", gridTemplateColumns: "28px 180px 1fr auto auto",
                       gap: 8, alignItems: "center", padding: "8px 0", borderBottom: "1px solid #eee" }}>
            <input type="checkbox"
                   checked={it.inFooter !== false}
                   onChange={() => toggle(i)} />
            <code style={{ opacity: .7 }}>{it.slug}</code>
            <input value={it.title} onChange={e => onTitle(i, e.target.value)} />
            <button onClick={() => move(i, -1)}>↑</button>
            <button onClick={() => move(i, 1)}>↓</button>
          </li>
        ))}
      </ul>

      <div style={{ display: "flex", gap: 12, marginTop: 12 }}>
        <button className="btn-primary" style={{ padding: "10px 16px", borderRadius: 12 }} onClick={onSave}>
          Opslaan
        </button>
        <button className="btn" style={{ padding: "10px 16px", borderRadius: 12, border: "1px solid #ddd" }} onClick={onReset}>
          Reset
        </button>
      </div>
    </div>
  );
}
