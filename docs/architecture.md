# Architecture technique

## Stack technique

| Couche | Technologie | Version |
|--------|-------------|---------|
| Framework UI | React + TypeScript (strict) | React 19 |
| Routing | TanStack Router (file-based) | `@tanstack/react-router` |
| Server state | TanStack Query | `@tanstack/react-query` |
| Styling | Tailwind CSS v4 + shadcn/ui | — |
| Backend / Auth | Supabase (PostgreSQL, Auth, Storage) | `@supabase/supabase-js` |
| Forms | React Hook Form + Zod | `@hookform/resolvers` |
| Build tool | Vite 7 + `@tanstack/react-start` | — |
| Déploiement | Cloudflare Workers | `wrangler.jsonc` |
| Notifications | sonner (toasts) | — |
| Icons | lucide-react | — |
| Dates | date-fns + react-day-picker | — |
| Charts | recharts | — |

## Structure des dossiers

```
├── index.html                  # Point d'entrée HTML (lang="fr", police Inter via Google Fonts)
├── package.json
├── tsconfig.json
├── vite.config.ts              # Config Vite (dev + build) — proxy Photon
├── wrangler.jsonc              # Config déploiement Cloudflare Workers
├── AI_RULES.md                 # Règles du projet (lues automatiquement par les agents IA)
├── docs/                       # Cette documentation
├── public/
│   └── logo-cosl.png           # Logo COSL utilisé dans sidebar et login
└── src/
    ├── main.tsx                # Bootstrap React — <RouterProvider router={router} />
    ├── router.tsx              # Création du router TanStack avec QueryClient en contexte
    ├── routeTree.gen.ts        # Arbre des routes AUTO-GÉNÉRÉ (ne pas éditer manuellement)
    ├── server.ts               # Entry point Cloudflare Worker (SSR TanStack Start)
    ├── start.ts                # Middleware TanStack Start (gestion d'erreurs)
    ├── styles.css              # Tailwind v4 + tokens COSL (palette, focus, scrollbar)
    ├── routes/                 # Pages (file-based routing)
    ├── components/             # Composants réutilisables
    ├── components/ui/           # Primitives shadcn/ui (NE PAS éditer directement)
    ├── contexts/                # Contexts React (AuthContext)
    ├── hooks/                   # Hooks custom (useAuth, useReferenceData, useHashTab…)
    └── lib/                     # Utilitaires, types, client Supabase
```

## Bootstrap de l'application

L'application démarre dans `src/main.tsx` qui monte le `RouterProvider` dans le DOM.

L'arbre de providers est défini dans `src/routes/__root.tsx` :

```
<QueryClientProvider client={queryClient}>
  <AuthProvider>
    <Outlet />              ← Toutes les routes s'affichent ici
    <ConfirmHost />         ← Dialogue de confirmation global (confirmAction())
    <Toaster richColors />  ← Notifications sonner
  </AuthProvider>
</QueryClientProvider>
```

Le `QueryClient` est créé dans `src/router.tsx` et passé dans le contexte du router (`createRouter({ context: { queryClient } })`). Dans les routes, on y accède via `Route.useRouteContext()`.

## Routing

Le routing utilise TanStack Router en mode **file-based**. Le plugin Vite `@tanstack/router-plugin` scanne `src/routes/` et génère automatiquement `src/routeTree.gen.ts`.

### Hiérarchie des routes

```
/ (index.tsx)                 → redirect vers /dashboard ou /login selon session
/login (login.tsx)            → page de connexion (hors auth)
/_authenticated                → layout protégé (ProtectedRoute + AppLayout + Sidebar)
  /dashboard                   → tableau de bord (KPIs, alertes KYC, prochains Games)
  /persons
    / (index)                  → liste des personnes
    /$personId                 → fiche détaillée d'une personne
  /athletes
    / (index)                  → liste des athlètes (filtres, recherche, CRUD)
    /$id                       → fiche athlète (9 onglets : profil, sportif, documents, KYC, relations, sélections, agenda, palmarès, messages)
  /coaches
    / (index)                  → liste des encadrants
    /$id                       → fiche encadrant
  /federations
    / (index)                  → liste des fédérations
    /$id                       → fiche fédération
    /members.$memberId         → fiche membre de fédération
  /clubs
    / (index)                  → liste des clubs
    /$id                       → fiche club
    /members.$memberId         → fiche membre de club
  /members                     → page de recherche globale des membres
  /games
    / (index)                  → liste des Games
    /$id                       → layout d'un Games avec onglets (tabs navigables)
      / (index)                → vue d'ensemble du Games
      /selections              → sélections athlètes pour ce Games
      /competitions            → compétitions/épreuves
      /delegation              → délégation
      /accreditations          → accréditations
      /logistics               → logistique (sous-onglets : overview, flights, lodging, transport)
        / (index)
        /flights
        /lodging
        /transport
      /sponsors               → sponsors du Games
      /partners               → partenaires du Games
      /volunteers             → bénévoles
  /sponsors                    → liste globale des sponsors
  /partners                    → liste globale des partenaires
  /accreditations              → liste globale des accréditations
  /logistics                   → vue logistique globale
  /communication
    / (index)
    /messages                  → messages envoyés
    /notifications             → notifications système
  /admin/users                 → gestion des comptes utilisateurs (admin seulement)
```

### Pattern de protection

- `_authenticated.tsx` est un **layout route** qui enveloppe toutes les routes authentifiées.
- Il utilise `ProtectedRoute` qui vérifie `session.access_token && user.id` via `useAuth()`.
- Si non authentifié → `<Navigate to="/login" />`.
- `AppLayout` fournit la sidebar + header (avec nom utilisateur, rôle, bouton déconnexion).

## Système de données

### Client Supabase

Singleton dans `src/lib/supabase.ts` :
- Lit `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY` depuis les variables d'environnement.
- `autoRefreshToken: false` (désactivé volontairement — voir commentaire dans le fichier).
- Fournit `usernameToEmail()` qui convertit un username en email pour l'auth Supabase (login via username, pas email).

### Pattern de data fetching

Bien que TanStack Query soit configuré et disponible, la plupart des pages utilisent un pattern de **fetch manuel via `useEffect` + `useState`** :

```tsx
const [rows, setRows] = useState<DataType[] | null>(null);

const load = async () => {
  setRows(null);
  const { data, error } = await supabase.from("table").select("*").order("...");
  if (error) {
    toast.error("Erreur", { description: friendlyError(error) });
    setRows([]);
    return;
  }
  setRows(data ?? []);
};

useEffect(() => { load(); }, []);
```

- `null` = en cours de chargement (→ `<TableSkeleton />`)
- Tableau vide = pas de données (→ `<EmptyState />`)
- Erreurs affichées via `toast.error()` + `friendlyError()` de `src/lib/error-messages.ts`

### Données de référence

`src/hooks/useReferenceData.ts` fournit 3 hooks :
- `useAthleteLevels()` — niveaux d'athlète depuis `athlete_levels_ref`
- `useDocumentTypes()` — types de documents depuis `document_types`
- `useSports()` — liste des sports depuis `sports`

Chacun permet `items`, `loading`, `add(label)`, `remove(id)` avec toasts de confirmation.

## Types et validation

- Tous les types métier sont dans `src/lib/types.ts` (Athlete, Coach, Federation, Club, Game, Selection, AthleteKyc, etc.).
- Les énumérations (statuts, rôles, types) sont exportées avec labels français + classes Tailwind pour les badges.
- `athleteSchema` (Zod) valide les formulaires d'athlète.
- `src/lib/persons.ts` définit le modèle unifié `Person` + rôles + profils liés (athlete_profiles, coach_profiles, etc.).
- `src/lib/kyc-utils.ts` calcule le statut KYC global et l'éligibilité d'âge.

## Gestion d'erreurs

- `src/lib/error-messages.ts` — `friendlyError()` traduit les erreurs PostgreSQL/Supabase en messages FR lisibles (FK violations, unique constraints, RLS, auth…).
- `src/lib/error-capture.ts` + `src/lib/error-page.ts` — capture et affichage des erreurs SSR catastrophiques.
- `src/routes/__root.tsx` — composants `NotFoundComponent` et `ErrorComponent` globaux.

## Proxy Vite (développement)

`vite.config.ts` configure un proxy pour l'API Photon (géocoding Luxembourg) :
- `/api/photon` → `https://photon.internet.lu/api` avec token Bearer (`PHOTON_TOKEN` env var).
- Utilisé par `src/components/AddressSearch.tsx` pour l'autocomplétion d'adresses.