import path from "path";
import { fileURLToPath } from "url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), viteSingleFile()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  preview: {
    host: "0.0.0.0",
    allowedHosts: true as unknown as string[],
    proxy: {
      // Same-origin proxy so the browser can query the NASA Exoplanet Archive
      // TAP service, which sends no Access-Control-Allow-Origin header.
      "/api/nasa": {
        target: "https://exoplanetarchive.ipac.caltech.edu",
        changeOrigin: true,
        secure: true,
        rewrite: (p) => p.replace(/^\/api\/nasa/, ""),
      },
      // Same-origin proxy for MAST's Kepler bulk tree (quarter directory
      // listings + _llc.fits downloads), also without CORS headers. Powers
      // the KIC resolver's "Analyse real light curve" button.
      "/api/mast": {
        target: "https://archive.stsci.edu",
        changeOrigin: true,
        secure: true,
        rewrite: (p) => p.replace(/^\/api\/mast/, ""),
      },
    },
  },
  server: {
    host: "0.0.0.0",
    allowedHosts: true as unknown as string[],
    proxy: {
      // Same-origin proxy so the browser can query the NASA Exoplanet Archive
      // TAP service, which sends no Access-Control-Allow-Origin header.
      "/api/nasa": {
        target: "https://exoplanetarchive.ipac.caltech.edu",
        changeOrigin: true,
        secure: true,
        rewrite: (p) => p.replace(/^\/api\/nasa/, ""),
      },
      // Same-origin proxy for MAST's Kepler bulk tree (quarter directory
      // listings + _llc.fits downloads), also without CORS headers. Powers
      // the KIC resolver's "Analyse real light curve" button.
      "/api/mast": {
        target: "https://archive.stsci.edu",
        changeOrigin: true,
        secure: true,
        rewrite: (p) => p.replace(/^\/api\/mast/, ""),
      },
    },
  },
});
