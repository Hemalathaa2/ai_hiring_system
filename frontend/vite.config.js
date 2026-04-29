import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  preview: {
    allowedHosts: ["ai-hiring-system-1-4fpj.onrender.com"]
  }
});
