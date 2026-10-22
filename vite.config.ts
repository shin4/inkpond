import { resolve } from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";
import pkg from "./package.json" with { type: "json" };

export default defineConfig({
  // Relative asset paths, so the build works from a GitHub Pages subpath.
  base: "./",
  define: {
    // The project site shows these and puts them in its structured data.
    __SITE_UPDATED__: JSON.stringify(new Date().toISOString().slice(0, 10)),
    __SITE_VERSION__: JSON.stringify(pkg.version),
  },
  build: {
    emptyOutDir: true,
    outDir: "../dist-demo",
    rollupOptions: {
      input: {
        en: resolve(import.meta.dirname, "demo/en/index.html"),
        enFaq: resolve(import.meta.dirname, "demo/en/faq/index.html"),
        faq: resolve(import.meta.dirname, "demo/faq/index.html"),
        index: resolve(import.meta.dirname, "demo/index.html"),
        session: resolve(import.meta.dirname, "demo/session/index.html"),
      },
    },
  },
  plugins: [react()],
  root: "demo",
  test: {
    environment: "node",
    include: ["tests/**/*.test.{ts,tsx}"],
    root: ".",
    setupFiles: ["tests/setup.ts"],
  },
});
