## Approche hybride retenue

- **Dev / preview Lovable** : on garde `@lovable.dev/vite-tanstack-config` et le SSR par défaut → la preview reste fonctionnelle.
- **Déploiement self-hosted COSL** : on ajoute en parallèle un `vite.config.prod.ts` (SPA pur, `ssr: false`, pas de Cloudflare) + un serveur Express `server/node-server.mjs`.
- Aucune logique métier dans ce scaffold : juste pages stub avec titre + placeholder « À implémenter ».

## Étape 1 — Dépendances

- `bun add @supabase/supabase-js`
- `bun add -d express` (pour `server/node-server.mjs`)

## Étape 2 — Configuration & environnement

- `.env.example` à la racine :
  ```
  VITE_SUPABASE_URL=http://IP_SERVEUR:8100
  VITE_SUPABASE_ANON_KEY=
  ```
- `vite.config.prod.ts` : config Vite minimale (plugin React + TanStack Router + Tailwind + tsconfig-paths), `build.ssr: false`, sortie `dist/client/`. Utilisée uniquement en prod self-hosted via `vite build --config vite.config.prod.ts`.
- `vite.config.ts` actuel **inchangé** (preset Lovable).
- `server/node-server.mjs` : Express, sert `dist/client/`, fallback SPA `app.get('/{*path}', ...)` qui teste `index.html` puis `_shell.html`, port via `process.env.PORT` (default 3000).
- Ajout `scripts` dans `package.json` :
  - `"build:prod": "vite build --config vite.config.prod.ts"`
  - `"start:prod": "node server/node-server.mjs"`

## Étape 3 — Client Supabase & Auth

- `src/lib/supabase.ts`
  - Lit `import.meta.env.VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY`.
  - Si absent → `console.error` explicite, **aucun fallback placeholder**.
  - Exporte `supabase` (createClient avec `persistSession: true, autoRefreshToken: true`).
- `src/hooks/useAuth.ts`
  - State : `{ session, user, username, full_name, role, loading }`.
  - `useEffect` : `supabase.auth.onAuthStateChange(...)` **AVANT** `supabase.auth.getSession()`.
  - Sur changement de session, charger profil depuis `user_profiles` (par `user.id`) dans `setTimeout(() => { ... }, 0)` pour éviter deadlocks.
  - Méthodes : `signIn(username, password)` → email synthétique `${username}@coslbloobiz.local`, `signOut()`.
  - Pas de `/register` côté UI.

## Étape 4 — Layouts & garde

- `src/components/layouts/AuthLayout.tsx` : fond `bg-slate-50`, card centrée max-w-md, logo COSLxBloobiz, slot enfants.
- `src/components/layouts/AppLayout.tsx` : `SidebarProvider` shadcn + `AppSidebar` collapsible (`collapsible="icon"`) + topbar avec `SidebarTrigger`, breadcrumb, menu utilisateur (avatar, nom, déconnexion). Outlet pour le contenu.
- `src/components/AppSidebar.tsx` : sidebar shadcn fond `bg-slate-800 text-slate-100`, accent `indigo-500` sur item actif, groupes par module (Dashboard / Athletes / Games / Accreditations / Logistics / Communication / Admin) avec icônes lucide. Liens via `<Link>` TanStack + `useRouterState` pour `isActive`.
- `src/components/ProtectedRoute.tsx` : composant qui consomme `useAuth`, affiche spinner si `loading`, redirige vers `/login` si pas de session.
  - Utilisé dans `src/routes/_authenticated.tsx` (pathless layout) qui wrap tous les modules.

## Étape 5 — Arborescence des routes

```
src/routes/
  __root.tsx                              (déjà existant — wrap QueryClientProvider, head)
  index.tsx                               (redirect → /dashboard si connecté, sinon → /login)
  login.tsx                               (AuthLayout + form username/password stub)

  _authenticated.tsx                      (pathless, ProtectedRoute + AppLayout + Outlet)
  _authenticated/dashboard.tsx            (KPI placeholders)

  _authenticated/athletes/index.tsx
  _authenticated/athletes/$id.tsx
  _authenticated/federations/index.tsx
  _authenticated/clubs/index.tsx
  _authenticated/coaches/index.tsx

  _authenticated/games/index.tsx
  _authenticated/games/$id/index.tsx
  _authenticated/games/$id/selections.tsx
  _authenticated/games/$id/delegation.tsx
  _authenticated/games/$id/accreditations.tsx
  _authenticated/games/$id/logistics/index.tsx
  _authenticated/games/$id/logistics/flights.tsx
  _authenticated/games/$id/logistics/lodging.tsx
  _authenticated/games/$id/logistics/transport.tsx

  _authenticated/accreditations/index.tsx
  _authenticated/logistics/index.tsx

  _authenticated/communication/index.tsx
  _authenticated/communication/messages.tsx
  _authenticated/communication/notifications.tsx

  _authenticated/admin/users.tsx
```

Chaque page = composant stub : titre H1 + paragraphe muted « Module à implémenter ». Pas d'appels Supabase pour l'instant.

## Étape 6 — Design tokens

- `src/styles.css` : ajout variables Team Lëtzebuerg (`--cosl-red: #ED2939`, `--cosl-navy: #003F87`) + accent indigo en token `--accent-indigo`. Font Inter chargée via `<link>` dans `__root.tsx` head.
- Composants utilisent **uniquement** tokens Tailwind sémantiques + classes slate/indigo conformes à la knowledge base.

## Note technique

Le preset Lovable active SSR par défaut. Comme `useAuth` touche `localStorage` via Supabase, le hook sera consommé uniquement dans des composants protégés rendus après hydratation (`useEffect` côté client). Aucune lecture de session en SSR/loader pour éviter les erreurs `window is not defined`.

## Hors scope (étapes futures)

- Schéma SQL Supabase, RLS, triggers `user_profiles`.
- Données de seed.
- Logique CRUD de chaque module.
- Imports/exports Excel, génération PDF accréditations.
