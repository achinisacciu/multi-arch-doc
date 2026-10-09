import { defineConfig } from "vite";
import { backendPlugin } from "./vite-plugin-backend.js";

// Dev:  `npm run dev` -> http://127.0.0.1:5173 + backend auto-avviato :8091.
// Prod: `npm run build` -> frontend/dist, servito da `python server.py` :8091.
// Porte :3001/:3002/:8000 mai usate (occupate altrove).
export default defineConfig({
  plugins: [backendPlugin()],
  server: {
    host: "0.0.0.0",
    port: 3000,
    allowedHosts: true,
    proxy: {
      "/api": "http://127.0.0.1:8091",
    },
  },
  preview: {
    host: "0.0.0.0",
    port: 3000,
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
});
