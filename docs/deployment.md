# Déploiement et configuration

## Variables d'environnement

Créer un fichier `.env` à la racine (voir `.env.example`) :

```env
VITE_SUPABASE_URL=https://votre-projet.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOi...
PHOTON_TOKEN=votre_token_photon  # Optionnel, pour l'API de géocoding
```

### Variables requises

| Variable | Description | Obligatoire |
|----------|-------------|-------------|
| `VITE_SUPABASE_URL` | URL du projet Supabase | ✅ |
| `VITE_SUPABASE_ANON_KEY` | Clé anonyme Supabase | ✅ |
| `PHOTON_TOKEN` | Token Bearer pour l'API Photon (géocoding) | ❌ |

### Comportement sans configuration

Si `VITE_SUPABASE_URL` ou `VITE_SUPABASE_ANON_KEY` sont manquants, `src/lib/supabase.ts` crée un client "désactivé" qui :
- Retourne des sessions nulles
- Affiche un warning dans la console
- Les requêtes retournent des données vides
- La page de login affiche un warning de configuration

## Scripts npm

| Script | Commande | Description |
|--------|----------|-------------|
| `dev` | `vite dev` | Serveur de développement |
| `build` | `vite build` | Build de production |
| `build:dev` | `vite build --mode development` | Build en mode développement |
| `preview` | `vite preview` | Prévisualisation du build |
| `lint` | `eslint .` | Linting |
| `format` | `prettier --write .` | Formatage Prettier |

## Configuration Vite

`vite.config.ts` :

- **Plugins** : `vite-tsconfig-paths` (alias `@/`), `@tanstack/router-plugin/vite` (génération auto des routes), `@vitejs/plugin-react`, `@tailwindcss/vite`.
- **Proxy dev** : `/api/photon` → `https://photon.internet.lu/api` avec header Authorization Bearer.

## Déploiement Cloudflare Workers

`wrangler.jsonc` :

```jsonc
{
  "name": "tanstack-start-app",
  "compatibility_date": "2025-09-24",
  "compatibility_flags": ["nodejs_compat"],
  "main": "src/server.ts"
}
```

- **Entry point** : `src/server.ts` — importe `@tanstack/react-start/server-entry` et gère les erreurs SSR.
- **Middleware** : `src/start.ts` — `createStart()` avec middleware de gestion d'erreurs (affiche une page d'erreur 500 branded COSL).
- **SSR** : TanStack Start rend le HTML côté serveur sur Cloudflare Workers.

## Build et prévisualisation

```bash
# Développement
npm run dev          # → http://localhost:5173 (ou port Vite)

# Build de production
npm run build        # → dist/

# Prévisualiser le build
npm run preview      # → serveur local sur le build
```

## Architecture SSR

L'application utilise TanStack Start pour le SSR (Server-Side Rendering) :

1. **`src/server.ts`** — Entry point Cloudflare Worker. Importe dynamiquement `@tanstack/react-start/server-entry`.
2. **`src/start.ts`** — Configure le middleware TanStack Start avec gestion d'erreurs.
3. **`src/lib/error-capture.ts`** — Capture les erreurs non gérées pendant le SSR.
4. **`src/lib/error-page.ts`** — Génère une page d'erreur HTML 500 branded COSL.

### Gestion d'erreurs SSR

- `server.ts` détecte les erreurs "catastrophiques" (h3 swallows) et les convertit en page d'erreur branded.
- `normalizeCatastrophicSsrResponse()` inspecte les réponses 500 JSON avec `{ unhandled: true, message: "HTTPError" }` et les remplace par la page d'erreur COSL.
- `consumeLastCapturedError()` récupère l'erreur originale capturée par `error-capture.ts`.

## Supabase Storage

Bucket **`documents`** pour les fichiers uploadés (photos, documents athlètes, logos).

### Patterns de chemin

| Type | Pattern |
|------|---------|
| Photo athlète | `athletes/{athleteId}/photo/photo_identite.{ext}` |
| Document athlète | `athletes/{athleteId}/{category}/{timestamp}_{filename}` |
| Logo entité | `{entityType}/{entityId}/logo.{ext}` |

### URLs signées

- Upload avec `upsert: true`.
- Signed URL avec expiration (1 an pour les photos, durée par défaut pour les autres).
- `pathFromSignedUrl(url, bucket)` extrait le path de stockage depuis une signed URL (pour suppression).

## Structure des fichiers de configuration

```
├── package.json          # Dépendances et scripts
├── tsconfig.json         # Configuration TypeScript strict
├── vite.config.ts        # Configuration Vite (proxy, plugins)
├── wrangler.jsonc        # Configuration Cloudflare Workers
├── eslint.config.js      # Configuration ESLint
├── components.json       # Configuration shadcn/ui
├── .env                  # Variables d'environnement (non versionné)
└── AI_RULES.md           # Règles du projet pour les agents IA
```