// Production self-hosted SPA build (no SSR, no Cloudflare).
// Usage: vite build --config vite.config.prod.ts
// Sortie : dist/client/  (servi par server/node-server.mjs)
import { defineConfig } from "vite";
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
  },
});
