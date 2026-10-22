import { resolve } from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  // Relative asset paths, so the build works from a GitHub Pages subpath.
  base: "./",
  build: {
    emptyOutDir: true,
    outDir: "../dist-demo",
    rollupOptions: {
      input: {
        faq: resolve(__dirname, "demo/faq/index.html"),
        index: resolve(__dirname, "demo/index.html"),
        session: resolve(__dirname, "demo/session/index.html"),
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
