// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, cloudflare (build-only),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... } }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

const PHOTON_TOKEN =
  "ZCbEtPZfZGRxEhKziCi5u7yPJ3RBKAA8nnMEFQVqixFW4uL2wMoywEA7YyyKaPQkfk6ow";

export default defineConfig({
  tanstackStart: {
    server: { entry: "server" },
  },
  vite: {
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
  },
});
