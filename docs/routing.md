# Routing — TanStack Router (file-based)

## Principe

Le routing repose sur TanStack Router en mode **file-based**. Les fichiers dans `src/routes/` définissent automatiquement les routes. Le plugin Vite `@tanstack/router-plugin` génère `src/routeTree.gen.ts` (à ne jamais éditer manuellement).

## Conventions de fichiers

| Pattern | Exemple | Résultat |
|---------|---------|----------|
| `index.tsx` | `src/routes/_authenticated/athletes/index.tsx` | Route `/athletes` |
| `$id.tsx` | `src/routes/_authenticated/athletes/$id.tsx` | Route `/athletes/:id` avec param |
| `_authenticated.tsx` | `src/routes/_authenticated.tsx` | Layout route (préfixe `_` = pas dans l'URL) |
| `members.$memberId.tsx` | `src/routes/_authenticated/federations/members.$memberId.tsx` | Route `/federations/members/:memberId` |

## Structure des routes

```
src/routes/
├── __root.tsx                          # Root : QueryClientProvider + AuthProvider + Toaster + ConfirmHost
├── index.tsx                            # / → redirect vers /dashboard ou /login
├── login.tsx                           # /login (page de connexion, hors auth)
├── _authenticated.tsx                  # Layout authentifié (ProtectedRoute + AppLayout)
└── _authenticated/
    ├── dashboard.tsx                   # /dashboard
    ├── persons/
    │   ├── index.tsx                    # /persons
    │   └── $personId.tsx                # /persons/:personId
    ├── athletes/
    │   ├── index.tsx                    # /athletes
    │   └── $id.tsx                      # /athletes/:id
    ├── coaches/
    │   ├── index.tsx                    # /coaches
    │   └── $id.tsx                      # /coaches/:id
    ├── federations/
    │   ├── index.tsx                    # /federations
    │   ├── $id.tsx                      # /federations/:id
    │   └── members.$memberId.tsx        # /federations/members/:memberId
    ├── clubs/
    │   ├── index.tsx                    # /clubs
    │   ├── $id.tsx                      # /clubs/:id
    │   └── members.$memberId.tsx        # /clubs/members/:memberId
    ├── members/index.tsx                # /members (recherche globale)
    ├── games/
    │   ├── index.tsx                    # /games
    │   └── $id.tsx                      # /games/:id (layout avec tabs)
    │       ├── index.tsx                #   /games/:id (vue d'ensemble)
    │       ├── selections.tsx           #   /games/:id/selections
    │       ├── competitions.tsx         #   /games/:id/competitions
    │       ├── delegation.tsx           #   /games/:id/delegation
    │       ├── accreditations.tsx       #   /games/:id/accreditations
    │       ├── sponsors.tsx             #   /games/:id/sponsors
    │       ├── partners.tsx             #   /games/:id/partners
    │       ├── volunteers.tsx           #   /games/:id/volunteers
    │       └── logistics/
    │           ├── index.tsx            #   /games/:id/logistics
    │           ├── flights.tsx          #   /games/:id/logistics/flights
    │           ├── lodging.tsx           #   /games/:id/logistics/lodging
    │           └── transport.tsx         #   /games/:id/logistics/transport
    ├── sponsors/index.tsx               # /sponsors
    ├── partners/index.tsx               # /partners
    ├── accreditations/index.tsx         # /accreditations
    ├── logistics/index.tsx              # /logistics
    ├── communication/
    │   ├── index.tsx                    # /communication
    │   ├── messages.tsx                 # /communication/messages
    │   └── notifications.tsx            # /communication/notifications
    └── admin/users.tsx                  # /admin/users
```

## Patterns de navigation

### Lien interne

Toujours utiliser `<Link>` de `@tanstack/react-router` (jamais de `<a>` pour les routes internes) :

```tsx
import { Link } from "@tanstack/react-router";

<Link to="/athletes/$id" params={{ id: athlete.id }}>Voir athlète</Link>
```

### Navigation programmatique

```tsx
import { useNavigate } from "@tanstack/react-router";
const navigate = useNavigate();
navigate({ to: "/athletes/$id", params: { id: athlete.id } });
```

### Lecture des paramètres

```tsx
const { id } = Route.useParams();
```

### Redirection

```tsx
import { Navigate } from "@tanstack/react-router";
<Navigate to="/dashboard" replace />
```

## Layout et Outlet

### Layout authentifié (`_authenticated.tsx`)

```tsx
function AuthenticatedShell() {
  return (
    <ProtectedRoute>
      <AppLayout>
        <Outlet />  {/* Toutes les routes enfants s'affichent ici */}
      </AppLayout>
    </ProtectedRoute>
  );
}
```

### Layout Games (`games/$id.tsx`)

Le layout de Games utilise un système de **tabs navigables** ( liens `<Link>` avec active state basé sur `useLocation()`). Un `<Outlet />` affiche la sous-route active.

## Hook useHashTab

Pour les pages avec onglets internes (ex: fiche athlète), `src/hooks/useHashTab.ts` synchronise l'onglet actif avec `window.location.hash`. Cela permet de partager une URL avec un onglet spécifique et de survivre aux re-renders.

```tsx
const [tab, setTab] = useHashTab("profil");
// URL: /athletes/123#kyc → tab = "kyc"
```

## Définition d'une route

Chaque fichier de route exporte un objet `Route` créé avec `createFileRoute` :

```tsx
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/athletes/")({
  component: AthletesPage,
});
```

Pour les routes avec paramètres :

```tsx
export const Route = createFileRoute("/_authenticated/athletes/$id")({
  component: AthleteDetailPage,
});
// Accès au param : const { id } = Route.useParams();
```

## Routes à venir / potentielles

Les routes suivantes sont référencées dans la sidebar mais peuvent être des stubs :
- `/logistics` — vue logistique globale
- `/members` — recherche globale des membres (fédérations + clubs)