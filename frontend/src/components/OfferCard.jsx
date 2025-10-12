// frontend/src/components/OfferCard.jsx
import React from "react";

/* ---------------- Icons (inline) ---------------- */
const PlayIcon = (p) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" {...p}>
    <path d="M8 5v14l11-7-11-7z" />
  </svg>
);
const PauseIcon = (p) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" {...p}>
    <path d="M6 5h4v14H6zM14 5h4v14h-4z" />
  </svg>
);
const EditIcon = (p) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" {...p}>
    <path d="M4 21h4l11-11-4-4L4 17v4z" />
  </svg>
);
const CalendarIcon = (p) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" {...p}>
    <path d="M7 2v3M17 2v3M3 8h18M5 22h14a2 2 0 0 0 2-2V8H3v12a2 2 0 0 0 2 2z" stroke="currentColor" strokeWidth="2"/>
  </svg>
);
const TagIcon = (p) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" {...p}>
    <path d="M20 10l-8-8H4v8l8 8 8-8z" stroke="currentColor" strokeWidth="2"/>
    <circle cx="7.5" cy="7.5" r="1.5" fill="currentColor"/>
  </svg>
);

/* ---------------- Helpers ---------------- */
const WEEK_LABELS = ["Ma","Di","Wo","Do","Vr","Za","Zo"]; // toon Ma–Zo

function statusPill(status) {
  const s = (status || "draft").toLowerCase();
  if (s === "active" || s === "published") return { cls: "badge secondary", text: "Gepubliceerd" };
  if (s === "scheduled") return { cls: "badge secondary", text: "Gepland" };
  if (s === "paused") return { cls: "badge secondary", text: "Gepauzeerd" };
  if (s === "archived") return { cls: "badge secondary", text: "Gearchiveerd" };
  return { cls: "badge secondary", text: "Concept" };
}

/** Maakt een bool-array (Ma–Zo) uit verschillende vormen:
 * - offer.weekdays = [0..6] (JS zondag=0)  -> we remappen naar Ma–Zo
 * - offer.days = {ma:true,...} / ["ma","wo",..."]
 * - string "ma,di,wo"
 */
function normalizeDays(offer) {
  // 1) weekdays als indices (vaak Zo=0)
  if (Array.isArray(offer?.weekdays)) {
    const zoFirst = offer.weekdays; // indices 0..6
    const on = new Array(7).fill(false);
    zoFirst.forEach(i => { if (i >= 0 && i < 7) on[i] = true; });
    // remap naar Ma–Zo
    return [on[1], on[2], on[3], on[4], on[5], on[6], on[0]];
  }
  // 2) object {ma:true,...}
  const obj = offer?.days;
  if (obj && typeof obj === "object" && !Array.isArray(obj)) {
    const g = (k) => !!(obj[k] ?? obj[k?.toUpperCase?.()]);
    return ["ma","di","wo","do","vr","za","zo"].map(g);
  }
  // 3) array ["ma","wo"]
  if (Array.isArray(offer?.days)) {
    const set = new Set(offer.days.map(s => String(s).slice(0,2).toLowerCase()));
    return ["ma","di","wo","do","vr","za","zo"].map(k => set.has(k));
  }
  // 4) string "ma,di,wo"
  if (typeof offer?.days === "string") {
    const s = offer.days.toLowerCase();
    return ["ma","di","wo","do","vr","za","zo"].map(k => s.includes(k));
  }
  // fallback: alle dagen
  return [true,true,true,true,true,true,true];
}

/* ---------------- Component ---------------- */
export default function OfferCard({ offer, onEdit, onToggle }) {
  const d = offer || {};
  const pill = statusPill(d.status);
  const days = normalizeDays(d);

  const starts = d.starts_at ? new Date(d.starts_at) : null;
  const ends   = d.ends_at ? new Date(d.ends_at) : null;

  const topLabel = d.badge || d.label || d.headline;

  const isLive = (d.status === "active" || d.status === "published");

  return (
    <div className="offer-card">
      {/* Media met overlay badges */}
      <div className="offer-media">
        {d.image_url ? (
          <img src={d.image_url} alt={d.title || "Actie"} />
        ) : (
          <div style={{display:"grid",placeItems:"center",height:"100%",color:"#94a3b8"}}>Geen afbeelding</div>
        )}
        <div className="offer-badges">
          {topLabel && (
            <span className="badge"><TagIcon /> {topLabel}</span>
          )}
          <span className={pill.cls}>{pill.text}</span>
        </div>
        {/* soft gradient bottom voor leesbaarheid */}
        <div style={{
          position:"absolute", left:0, right:0, bottom:0, height:"38%",
          background:"linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,.45) 100%)",
          pointerEvents:"none"
        }}/>
      </div>

      {/* Body */}
      <div className="offer-content">
        <h4 className="offer-title">{d.title || "Zonder titel"}</h4>
        {d.body && <div className="offer-sub">{d.body}</div>}

        {/* Weekdagen horizontaal (Ma–Zo) */}
        <div className="weekline" aria-label="Dagen actief">
          {WEEK_LABELS.map((lab, i) => (
            <span key={lab} className={`day ${days[i] ? "on" : ""}`}>{lab}</span>
          ))}
        </div>
      </div>

      {/* Meta + Actions */}
      <div className="offer-actions">
        <button className="btn-outline" onClick={onEdit}><EditIcon /> Bewerken</button>
        <button className="btn" onClick={onToggle}>
          {isLive ? (<><PauseIcon /> Pauzeer</>) : (<><PlayIcon /> Publiceer</>)}
        </button>
      </div>

      {(starts || ends) && (
        <div style={{display:"flex",alignItems:"center",gap:6, padding:"0 14px 14px", color:"var(--muted)", fontSize:12}}>
          <CalendarIcon /> {starts ? starts.toLocaleString() : "nu"} — {ends ? ends.toLocaleString() : "onbekend"}
        </div>
      )}
    </div>
  );
}
