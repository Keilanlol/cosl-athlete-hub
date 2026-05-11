import express from "express";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.resolve(__dirname, "..", "dist", "client");

// TanStack Start may emit either index.html or _shell.html
const candidateShells = ["index.html", "_shell.html"];
const shellFile = candidateShells
  .map((f) => path.join(distDir, f))
  .find((p) => fs.existsSync(p));

if (!shellFile) {
  console.error(
    `[server] Aucun shell SPA trouvé dans ${distDir} (cherché: ${candidateShells.join(", ")}).`,
  );
  console.error("[server] Lance d'abord: npm run build:prod");
  process.exit(1);
}

const app = express();

// Static assets (cache long for /assets/, no-cache pour le shell)
app.use(
  express.static(distDir, {
    index: false,
    setHeaders: (res, filePath) => {
      if (filePath.includes(`${path.sep}assets${path.sep}`)) {
        res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
      }
    },
  }),
);

// SPA fallback — Express 5 syntax
app.get("/{*path}", (_req, res) => {
  res.setHeader("Cache-Control", "no-cache");
  res.sendFile(shellFile);
});

const port = Number(process.env.PORT) || 3000;
const host = process.env.HOST || "0.0.0.0";

app.listen(port, host, () => {
  console.log(`[server] COSLxBloobiz prêt sur http://${host}:${port}`);
  console.log(`[server] Shell: ${path.basename(shellFile)}`);
});
