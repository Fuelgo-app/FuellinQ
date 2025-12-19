// src/components/RequireAuth.jsx
import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { whoAmI } from "@/api/base";

/**
 * Eenvoudige cookie-first guard:
 * - Vraagt éénmalig de sessie op bij routewissel
 * - Geen globale redirects; gebruik dit ALLEEN rond /app en /partner
 * - whoAmI() geeft bij 401 gewoon null terug (zie base.js)
 */
export default function RequireAuth({ children }) {
  const loc = useLocation();
  const [state, setState] = React.useState({ loading: true, authed: false });

  React.useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const user = await whoAmI(); // 200 -> user, 401 -> null
        if (!alive) return;
        setState({ loading: false, authed: !!user });
      } catch {
        if (!alive) return;
        setState({ loading: false, authed: false });
      }
    })();
    return () => { alive = false; };
    // Route-evaluatie bij echte navigatie:
    // pathname + search is stabiel genoeg en voorkomt extra renders.
  }, [loc.pathname, loc.search]);

  if (state.loading) {
    return (
      <div className="container" style={{ maxWidth: 640, margin: "24px auto" }}>
        <div className="card p-3">Beveiligde pagina laden…</div>
      </div>
    );
  }

  if (!state.authed) {
    const next = encodeURIComponent(loc.pathname + (loc.search || ""));
    return <Navigate to={`/auth?mode=login&next=${next}`} replace />;
  }

  return <>{children}</>;
}
