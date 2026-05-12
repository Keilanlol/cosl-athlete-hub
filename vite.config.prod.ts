// Production self-hosted SPA build (no SSR, no Cloudflare, no prerender).
// Usage: npm run build:prod  →  vite build --config vite.config.prod.ts
// Entrée : index.html (racine) + src/main.tsx
// Sortie : dist/client/index.html + dist/client/assets/*  (servi par server/node-server.mjs)
import { defineConfig } from "vite";
import path from "node:path";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";
import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";

export default defineConfig({
  plugins: [
    tsconfigPaths(),
    tanstackRouter({
      target: "react",
      autoCodeSplitting: true,
      routesDirectory: "src/routes",
      generatedRouteTree: "src/routeTree.gen.ts",
    }),
    react(),
    tailwindcss(),
  ],
  build: {
    ssr: false,
    outDir: "dist/client",
    emptyOutDir: true,
    rollupOptions: {
      input: path.resolve(__dirname, "index.html"),
    },
  },
});
