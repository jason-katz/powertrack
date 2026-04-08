import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  base: "/powertrack/", // Must match your GitHub repository name exactly
});
