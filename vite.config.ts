/// <reference types="vitest/config" />
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

/**
 * Dev playground + test config for @levich/univer-sheets.
 * `npm run start` serves the demo app (demo/main.tsx) that renders the package
 * straight from source. `resolve.dedupe` keeps a single React instance — the
 * same requirement hosts must satisfy (constitution Principle VI).
 */
export default defineConfig({
  plugins: [react()],
  resolve: {
    dedupe: ["react", "react-dom"],
  },
  server: {
    port: 9100,
  },
  test: {
    globals: true,
    environment: "jsdom",
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
  },
});
