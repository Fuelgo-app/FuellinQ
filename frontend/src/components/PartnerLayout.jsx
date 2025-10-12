// frontend/src/components/PartnerLayout.jsx
export default function PartnerLayout({ title, children }) {
  return (
    <div className="container" style={{ marginTop: 16 }}>
      <div className="grid" style={{ gridTemplateColumns: "240px 1fr", gap: 16 }}>
        {/* Sidebar */}
        <aside className="card p-3" style={{ borderRadius: 16, position: "sticky", top: 8 }}>
          <div style={{ fontWeight: 800, marginBottom: 10 }}>Partner Portal</div>
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 8 }}>
            <li><a href="/partner" className="btn btn-outline">⛽ Prijzen</a></li>
            <li><a href="/partner/offers" className="btn btn-outline">🏷️ Acties & deals</a></li>
            <li><a href="/partner/settings" className="btn btn-outline">⚙️ Instellingen</a></li>
          </ul>
        </aside>

        {/* Content */}
        <main>
          {title && <h1 style={{ marginTop: 0 }}>{title}</h1>}
          {children}
        </main>
      </div>
    </div>
  );
}
