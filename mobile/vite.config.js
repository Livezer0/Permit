import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Relative base so the built app works behind any path / forwarded host.
export default defineConfig({
  base: "./",
  plugins: [react()],
  server: { host: true, port: 5174 }
});
