/// <reference types="vitest/config" />
import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"
import { resolve } from "node:path"

// StructFlow builds as a Chrome MV3 extension.
// The side panel (index.html) is the main UI; background.ts is the service worker.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
    },
  },
  test: {
    // Unit tests target pure logic (formatter, highlighter), so the default
    // Node environment is enough. Switch to "jsdom" when adding component tests.
    environment: "node",
    include: ["test/**/*.{test,spec}.{ts,tsx}"],
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        index: resolve(__dirname, "index.html"),
        background: resolve(__dirname, "src/background.ts"),
        content: resolve(__dirname, "src/content.ts"),
      },
      output: {
        entryFileNames: (chunk) => {
          if (chunk.name === "background") return "background.js"
          if (chunk.name === "content") return "content.js"
          return "assets/[name]-[hash].js"
        },
      },
    },
  },
})
