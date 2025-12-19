// frontend/vite.config.js
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig(({ mode }) => {
  // Alle env vars laden (ook zonder 'VITE_' prefix, we filteren zelf)
  const env = loadEnv(mode, process.cwd(), "");

  // === Aanpak 1: Frontend op :5173, Backend op :3000 ===
  // In .env.local kun je (optioneel) zetten:
  //   VITE_API_URL=http://localhost:3000
  //
  // Als je in je code absolute URLs gebruikt via VITE_API_URL, gaat het direct naar de backend.
  // Gebruik je RELATIVE paths (/api/...), dan pakt de proxy hieronder het over.
  const API_URL =
    env.VITE_API_URL && env.VITE_API_URL !== "/" ? env.VITE_API_URL : "";
  const BACKEND_FALLBACK = env.BACKEND_URL || "http://localhost:3000";
  const PROXY_TARGET = API_URL || BACKEND_FALLBACK;

  // Proxy alleen gebruiken wanneer target lokaal is (voorkomt dubbele hops naar prod)
  const isLocalTarget = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(
    PROXY_TARGET || ""
  );

  // Dev proxy-config (alleen actief als de backend lokaal draait)
  const devProxy = isLocalTarget
    ? {
        "/api": {
          target: PROXY_TARGET,
          changeOrigin: true,
          secure: false,
          ws: true,
        },
        "/uploads": {
          target: PROXY_TARGET,
          changeOrigin: true,
          secure: false,
        },
      }
    : undefined;

  // Let op: Vite preview ondersteunt geen proxy; dit is puur voor 'vite dev'
  return {
    plugins: [react()],

    resolve: {
      alias: {
        "@": path.resolve(__dirname, "src"),
        "@components": path.resolve(__dirname, "src/components"),
        "@api": path.resolve(__dirname, "src/api"),
        "@pages": path.resolve(__dirname, "src/pages"),
      },
    },

    server: {
      host: true,          // bereikbaar vanaf LAN
      port: 5173,          // frontend poort
      strictPort: true,    // niet automatisch wisselen
      hmr: { overlay: true },
      proxy: devProxy,     // relative /api → backend :3000
    },

    preview: {
      port: 4173,
      // geen proxy in preview-modus
    },

    build: {
      target: "es2022",
      sourcemap: true,
      chunkSizeWarningLimit: 1200,
      rollupOptions: {
        output: {
          manualChunks: {
            react: ["react", "react-dom"],
            router: ["react-router-dom"],
          },
        },
      },
    },

    esbuild: {
      target: "es2022",
      supported: { "top-level-await": true },
    },
  };
});
