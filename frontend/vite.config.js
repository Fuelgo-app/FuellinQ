// vite.config.js
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig(({ mode }) => {
  // Lees .env (VITE_ vars) + optionele BACKEND_URL voor proxy
  const env = loadEnv(mode, process.cwd(), "");
  const PROXY_TARGET =
    (env.VITE_API_URL && env.VITE_API_URL !== "/"
      ? env.VITE_API_URL
      : env.BACKEND_URL) || "http://localhost:3000";

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
      host: true,
      port: 5173,
      // HMR overlay aan voor snelle foutdiagnose
      hmr: { overlay: true },

      // Proxy alleen voor relative calls ("/api/...") — absolute URLs gaan direct
      proxy: {
        "/api": {
          target: PROXY_TARGET,
          changeOrigin: true,
          // handiger met cookies/JWT
          secure: false,
        },
        // voorbeeld: '/uploads' laten doorgeven aan backend:
        "/uploads": {
          target: PROXY_TARGET,
          changeOrigin: true,
          secure: false,
        },
      },
    },

    // Handig wanneer je lokaal absolute paden wil serveren
    preview: {
      port: 4173,
      proxy: {
        "/api": { target: PROXY_TARGET, changeOrigin: true, secure: false },
        "/uploads": { target: PROXY_TARGET, changeOrigin: true, secure: false },
      },
    },

    // Bouw-opties (rustige warnings)
    build: {
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

    // Optioneel: sneller transpilen
    esbuild: {
      target: "esnext",
    },
  };
});
