import { NavLink } from "react-router-dom";

export default function PartnerSidebar() {
  const link = "flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-100";
  const active = ({ isActive }) => (isActive ? `${link} bg-gray-100 font-medium` : link);

  return (
    <aside className="w-64 shrink-0">
      <div className="p-4 text-xl font-semibold">Partner Portal</div>
      <nav className="p-2 space-y-1">
        <NavLink to="/partner/offers" className={active}>📣 Acties & Deals</NavLink>
        <NavLink to="/partner/settings" className={active}>⚙️ Instellingen</NavLink>
      </nav>
    </aside>
  );
}
