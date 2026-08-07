import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

// Same configuration as Admin-web's, deliberately — two apps in one product
// shouldn't need two different mental models for running their tests.
export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    globals: true,
  },
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
});
