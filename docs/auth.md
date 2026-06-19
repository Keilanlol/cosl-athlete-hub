# Authentification et permissions

## Architecture

L'authentification utilise **Supabase Auth** (email/password) mais le login se fait via **username** (pas email).

### Flux d'authentification

```
Login page (username + password)
  → usernameToEmail(username)     // src/lib/supabase.ts
    → SELECT email FROM user_profiles WHERE username = ?
  → supabase.auth.signInWithPassword({ email, password })
  → onAuthStateChange → verifySession()
    → supabase.auth.getUser()      // validation du token
    → commitVerifiedSession()
    → loadProfile()                 // SELECT username, full_name, role FROM user_profiles
  → Redirect vers /dashboard
```

### Détails importants

- **`autoRefreshToken: false`** — désactivé volontairement dans le client Supabase. Les refresh tokens GoTrue self-hosted causaient une boucle SIGNED_OUT → verifySession → getUser. Le refresh se fait manuellement après un `signIn` réussi.
- **`detectSessionInUrl: false`** — pas de détection OAuth URL.
- **Timeout de 8 secondes** (`AUTH_TIMEOUT_MS`) sur `getUser()` et le chargement du profil pour éviter de bloquer indéfiniment.
- **Vérification double** : `onAuthStateChange` + `getSession()` au démarrage, puis `verifySession()` qui valide le token via `getUser()`.

## AuthContext (`src/contexts/AuthContext.tsx`)

Expose via `useAuth()` :

| Champ | Type | Description |
|-------|------|-------------|
| `session` | `Session \| null` | Session Supabase |
| `user` | `User \| null` | User Supabase |
| `username` | `string \| null` | Username depuis `user_profiles` |
| `full_name` | `string \| null` | Nom complet |
| `role` | `UserRole \| null` | Rôle utilisateur |
| `loading` | `boolean` | Auth en cours de vérification |
| `signIn(username, password)` | → result | Connexion via username |
| `signOut()` | → result | Déconnexion |

## Protection des routes

### ProtectedRoute (`src/components/ProtectedRoute.tsx`)

```tsx
function ProtectedRoute({ children }) {
  const { session, user, loading } = useAuth();
  const isAuthValid = !!session?.access_token && !!user?.id;

  if (loading) return <Loader2 spinner />;
  if (!isAuthValid) return <Navigate to="/login" replace />;
  return <>{children}</>;
}
```

Wrappé par `_authenticated.tsx` → toutes les routes sous `/_authenticated/*` sont protégées.

### Page de login (`src/routes/login.tsx`)

- Si déjà authentifié → `<Navigate to="/dashboard" />`.
- Affiche un warning si Supabase n'est pas configuré (`supabaseConfigured`).
- Formulaire simple (username + password), pas de lien d'inscription (comptes créés par admin).

## Rôles utilisateurs

Définis dans `src/lib/types.ts` → `USER_ROLES` :

| Rôle | Label | Badge |
|------|-------|-------|
| `admin` | Administrateur | `bg-red-100 text-red-700` |
| `games_manager` | Games Manager | `bg-indigo-100 text-indigo-700` |
| `fed_manager` | Fed. Manager | `bg-blue-100 text-blue-700` |
| `logistics` | Logistique | `bg-amber-100 text-amber-700` |
| `communication` | Communication | `bg-emerald-100 text-emerald-700` |
| `reader` | Lecteur | `bg-slate-200 text-slate-700` |

### Permissions par rôle

L'application ne fait pas de garde de route par rôle de manière systématique. Le contrôle d'accès est partiellement implémenté au niveau UI :

- **Admin uniquement** : modification du statut des documents athlète (`isAdmin = role === "admin"` dans `$id.tsx`), page `/admin/users`.
- **Supabase RLS** : la sécurité au niveau des données est gérée par Row Level Security côté PostgreSQL (non documentée ici — voir la config Supabase).

### Pattern d'usage du rôle

```tsx
import { useAuth } from "@/hooks/useAuth";

const { role, user } = useAuth();
const isAdmin = role === "admin";
```

## Layout authentifié

`AppLayout` (`src/components/layouts/AppLayout.tsx`) fournit :
- **Sidebar** (gauche, noire, collapsible) — `AppSidebar.tsx` avec groupes de navigation.
- **Header** — nom utilisateur, rôle, bouton déconnexion.
- **Main** — `<main className="flex-1 p-6">{children}</main>`.

## Affichage utilisateur

Dans le header :
- Nom complet (ou username, ou "Utilisateur COSL" en fallback)
- Rôle en minuscules avec `_` remplacé par espace
- Bouton déconnexion (icône LogOut, appelle `signOut()`)

## Déconnexion

`signOut()` appelle `supabase.auth.signOut()` → `onAuthStateChange` event `SIGNED_OUT` → `clearAuth()` → `setLoading(false)` → redirect vers `/login`.