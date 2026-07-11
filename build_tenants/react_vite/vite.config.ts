import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const apiTarget = process.env.OMAN_API_TARGET ?? "http://127.0.0.1:4173";

export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    exclude: ["@odd-manager/developer-control-contracts"],
  },
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: apiTarget,
        ws: true,
      },
      "/ws": {
        target: apiTarget,
        ws: true,
      },
    },
  },
});
