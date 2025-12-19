import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import HomePage from "@/pages/HomePage";
import AboutPage from "@/pages/AboutPage";
import AuthPage from "@/pages/AuthPage";

// Eenvoudige guard: alleen /app/** vereist sessie
function AppGuard({ element }) {
  // je kunt dit nog optimaler maken met context, maar zo werkt het direct:
  const [ok, setOk] = React.useState(null);
  React.useEffect(() => {
    import("@/api/base").then(({ whoAmI }) =>
      whoAmI().then(u => setOk(!!u)).catch(() => setOk(false))
    );
  }, []);
  if (ok === null) return <div style={{padding:24}}>Sessie controleren…</div>;
  return ok ? element : <Navigate to="/auth?mode=login&next=/app" replace />;
}

function AppArea() {
  return <div style={{padding:24}}>App dashboard placeholder</div>;
}

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/about" element={<AboutPage />} />

      {/* Auth pages (NIET achter guard) */}
      <Route path="/auth" element={<AuthPage mode="login" />} />
      <Route path="/signup" element={<AuthPage mode="signup" />} />

      {/* Alles onder /app/** WEL achter guard */}
      <Route path="/app" element={<AppGuard element={<AppArea />} />} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
