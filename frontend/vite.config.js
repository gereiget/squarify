import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const buildVersion = process.env.VITE_APP_VERSION || new Date().toISOString();

export default defineConfig({
  base: process.env.VITE_APP_BASE_PATH || "/squarify/",
  define: {
    __APP_VERSION__: JSON.stringify(buildVersion)
  },
  plugins: [react()]
});
