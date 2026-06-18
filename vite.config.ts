import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";
import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";

const PHOTON_TOKEN = process.env.PHOTON_TOKEN ?? "";

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
  server: {
    proxy: {
      "/api/photon": {
        target: "https://photon.internet.lu",
        changeOrigin: true,
        secure: true,
        rewrite: (p) => p.replace(/^\/api\/photon/, "/api"),
        headers: {
          Authorization: `Bearer ${PHOTON_TOKEN}`,
        },
      },
    },
  },
});
