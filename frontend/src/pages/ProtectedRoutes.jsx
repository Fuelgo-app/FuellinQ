// src/components/ProtectedRoute.jsx
import React from "react";
import { Navigate, useLocation } from "react-router-dom";

/** Veilige JWT parse zonder exceptions */
function parseJwt(token) {
  try {
    const base64Url = token.split(".")[1];
    if (!base64Url) return null;
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    );
    return JSON.parse(jsonPayload);
  } catch {
    return null;
  }
}

function isExpired(payload) {
  // exp is in seconden sinds epoch
  if (!payload || typeof payload.exp !== "number") return true;
  const nowSec = Math.floor(Date.now() / 1000);
  return payload.exp <= nowSec;
}

function hasRequiredRole(payload, roles) {
  if (!roles) return true;
  const required = Array.isArray(roles) ? roles : [roles];
  const claim = payload?.role || payload?.roles || payload?.scope;
  if (!claim) return false;
  if (Array.isArray(claim)) return claim.some((r) => required.includes(String(r)));
  const claimList = String(claim).split(/[,\s]+/).filter(Boolean);
  return claimList.some((r) => required.includes(r));
}

/**
 * ProtectedRoute
 *
 * Props:
 * - roles?: string | string[]        // vereiste rol(len), bv. "admin" of ["admin","partner"]
 * - requireStationId?: boolean       // eist dat JWT een stationId-claim heeft
 * - redirectTo?: string              // default: "/auth"
 */
export default function ProtectedRoute({
  children,
  roles,
  requireStationId = false,
  redirectTo = "/auth",
}) {
  const loc = useLocation();
  const token = (typeof localStorage !== "undefined" && localStorage.getItem("token")) || "";

  if (!token) {
    return <Navigate to={redirectTo} replace state={{ from: loc.pathname + loc.search }} />;
  }

  const payload = parseJwt(token);

  // Ongeldige of verlopen token → uitloggen + naar auth
  if (!payload || isExpired(payload)) {
    try { localStorage.removeItem("token"); } catch {}
    return <Navigate to={redirectTo} replace state={{ from: loc.pathname + loc.search }} />;
  }

  // Rol-check (403 → terug naar home of auth met foutje)
  if (!hasRequiredRole(payload, roles)) {
    return <Navigate to={`${redirectTo}?error=forbidden`} replace state={{ from: loc.pathname + loc.search }} />;
  }

  // StationId-claim vereist?
  if (requireStationId && (payload.stationId === undefined || payload.stationId === null)) {
    return <Navigate to={`${redirectTo}?error=nostation`} replace state={{ from: loc.pathname + loc.search }} />;
  }

  return children;
}
