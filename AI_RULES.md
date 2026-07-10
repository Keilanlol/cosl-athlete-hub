# AI Rules — Cosl Sports Management App

## Tech Stack Overview

- **Framework:** React 19 + TypeScript (strict)
- **Router:** TanStack Router (`@tanstack/react-router`) — file-based routing via `src/routes/`
- **State & Data Fetching:** TanStack Query (`@tanstack/react-query`) for server state
- **Styling:** Tailwind CSS v4 + shadcn/ui components (`src/components/ui/`)
- **Backend/Auth:** Supabase (`@supabase/supabase-js`) — auth, database, storage
- **Forms:** React Hook Form + Zod (`@hookform/resolvers`) for validation
- **Build Tool:** Vite 7 with `@tanstack/react-start`

---

## Project Structure Rules

### File Organization
- Always put source code in `src/`.
- **Pages/Routes:** `src/routes/` — uses TanStack Router file-based routing. Do NOT create a `src/pages/` folder.
- **Components:** `src/components/` — reusable UI components.
- **UI Primitives:** `src/components/ui/` — shadcn/ui components. Do NOT edit these directly; wrap/extend them instead.
- **Hooks:** `src/hooks/` — custom React hooks.
- **Lib/Utils:** `src/lib/` — utility functions, types, Supabase client, constants.
- **Contexts:** `src/contexts/` — React context providers.

### Routing Conventions
- Routes live in `src/routes/`. The route tree is auto-generated in `src/routeTree.gen.ts`.
- Use `_authenticated.tsx` as the protected layout wrapper.
- Route parameters use `$param` syntax (e.g., `src/routes/_authenticated/athletes/$id.tsx`).
- Use `Link` from `@tanstack/react-router` for navigation, never raw `<a>` tags for internal routes.
- Use `useParams`, `useSearch`, and `useNavigate` from `@tanstack/react-router`.

---

## Charte Graphique COSL / Team Lëtzebuerg

### Palette Couleurs (CSS Custom Properties)
```
--cosl-red:          #C8102E   (principal, liens, CTAs, focus)
--cosl-red-dark:     #A00D24   (hover states)
--cosl-red-light:    #F5E6E9   (surfaces secondaires, accent doux)
--cosl-black:        #1A1A1A   (texte, sidebar, header)
--cosl-gold:         #C9A84C   (médailles, distinctions spéciales)
--cosl-gold-light:   #F9F3E3   (surfaces gold)
--lux-blue:          #009ACD   (éléments informatifs, bleu luxembourgeois)
--lux-blue-light:    #E6F4FB   (surfaces bleu)
```

### Tokens Sémantiques shadcn/ui
```
--background:        #FAFAFA
--foreground:        #1A1A1A
--primary:           #C8102E
--primary-foreground:#FFFFFF
--destructive:       #A00D24
--accent:            #F5E6E9
--accent-foreground: #C8102E
--muted-foreground:  #717171
--border:            #E8E8E8
--sidebar:           #1A1A1A
--sidebar-foreground:#F5F5F5
--sidebar-primary:   #C8102E
--sidebar-accent:    #2A2A2A
```

### Typography
- Police : `"Inter"`, system-ui, sans-serif
- Titre page : `text-2xl font-bold text-[#1A1A1A]`
- Sous-titre : `text-lg font-semibold`
- Texte standard : `text-sm`
- Labels de formulaire : `font-medium`

### Comportements Visuels Obligatoires
- Focus visible : `outline: 2px solid var(--cosl-red)` avec `outline-offset: 2px`
- Sélection texte : fond `--cosl-red-light`, texte `--cosl-red`
- Scrollbar : thumb rouge COSL, track gris clair
- **Pas de dark mode** (seulement light mode)

---

## Domaine Métier & Entités BDD

### Personnes (persons) — Super-classe
Personne physique unifiée servant de base aux athlètes et encadrants.
Attributs clés : `id, first_name, last_name, email, phone, birth_date, gender, nationality, photo_url, photo_storage_path`
Relations : → athlete (1:1 optionnel), → coach (1:1 optionnel)

### Athlètes (athletes)
- ID unique : `COSL-AAAA-NNNN` (année + numéro séquentiel)
- Statuts possibles : `active`, `injured`, `suspended`, `retired`, `ambassador`
- Niveaux : `elite`, `promotion`, `espoir`, `olympic_contract`
- Profil complet : tailles (vêtements, chaussures, gants), numéros (license, ADAMS, passeport)
- Sport principal, fédération principale, club actuel (FK optionnels)
- Relations : → person (1:1), → sport (N:1), → federation (N:1), → club (N:1), → athlete_documents (1:N), → athlete_kyc (1:1), → selections (1:N), → athlete_results (1:N), → athlete_relations/coach (N:M via table liaison)

### Encadrants (coaches)
- Rôles : `coach`, `manager`, `medical`, `official`, `chief_of_mission`, `press`, `physio`, `logistics`
- FK vers fédération et/ou club (optionnels)
- Relation avec athlètes via `athlete_relations` (rôle de la relation stocké dans la table de liaison)

### Fédérations (federations)
- Attributs : acronyme, nom, président, emails/tél, fédération internationale, `is_olympic`, logos
- Membres : via `federation_members` avec rôles (président, SG, trésorier, délégué, etc.)
- Relation : → clubs (1:N)

### Clubs (clubs)
- Adresse complète : rue, CP, ville, pays
- Membres : via `club_members` avec rôles (président, entraîneur principal, etc.)
- Relation : → federation (N:1 optionnel), → athletes (1:N)

### Jeux (games)
- Types : `jo_summer`, `jo_winter`, `joj_summer`, `joj_winter`, `jpeee`, `european_games`, `eyof_summer`, `eyof_winter`, `other`
- Statuts : `preparation`, `in_progress`, `finished`, `archived`
- Contient : sports participants, compétitions, quotas, sélections, logistique, sponsors, partenaires, bénévoles
- Sections par jeu : Délégation, Compétitions, Sélections, Accréditations, Logistique (vols, hébergement, transport), Sponsors, Partenaires, Bénévoles

### Logistique
- **Travel plans** : plan de voyage global/sport/individuel, statuts `planned|confirmed|modified|cancelled`
- **Flights** : vols associés à un travel plan, avec passengers (athlète/coach)
- **Accommodations** : hébergements par jeu, rooming assignments
- **Local transport** : navettes, avec passengers

### KYC Athlète (7 axes)
1. Identité (passport/CI vérifiés)
2. Nationalité sportive (fédération d'éligibilité)
3. Éligibilité d'âge
4. Antidopage (statut ADAMS, whereabouts)
5. E-learning antidopage
6. Charte éthique COSL
7. Règle 40 CIO

Chaque axe peut être `green/orange/red`. Statut global calculé.
Historique des changements dans `kyc_history`.

### Communication
- **Message templates** : modèles de messages par canal
- **Messages sent** : envois avec comptage de destinataires
- **Notifications** : alertes système ciblées par utilisateur

### Utilisateurs (user_profiles)
- Authentification via Supabase Auth (email/password, mais login via username)
- Rôles : `admin`, `games_manager`, `fed_manager`, `logistics`, `communication`, `reader`
- Champs sensibles : `plain_password` visible uniquement aux admin

---

## Library Usage Rules

### UI Components — shadcn/ui First
- **Always prefer shadcn/ui primitives** over custom components.
- Available primitives: `button`, `dialog`, `dropdown-menu`, `form`, `input`, `select`, `table`, `tabs`, `toast` (`sonner`), `calendar`, `card`, `badge`, `avatar`, `sheet`, `sidebar`, `command`, `popover`, `checkbox`, `radio-group`, `switch`, `slider`, `textarea`, `scroll-area`, `separator`, `skeleton`, `tooltip`, `toggle`, `toggle-group`, `accordion`, `collapsible`, `context-menu`, `hover-card`, `menubar`, `navigation-menu`, `pagination`, `progress`, `resizable`, `carousel`, `drawer`, `input-otp`, `aspect-ratio`, `alert`, `alert-dialog`, `breadcrumb`, `chart`, `label`.
- Do NOT edit files in `src/components/ui/`. Create wrapper components in `src/components/` if customization is needed.

### Icons
- **Use `lucide-react`** for all icons. Never add another icon library.
- Import icons individually: `import { User, Settings } from "lucide-react"`.

### Forms & Validation
- **Use `react-hook-form`** with **Zod** schemas for all forms.
- Use `@hookform/resolvers/zod` as the resolver.
- Wrap forms with `<Form>` from `src/components/ui/form.tsx`.
- Example pattern:
  ```tsx
  import { useForm } from "react-hook-form";
  import { zodResolver } from "@hookform/resolvers/zod";
  import { z } from "zod";
  import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
  ```

### Data Fetching & Server State
- **Use TanStack Query** (`useQuery`, `useMutation`, `useQueryClient`) for all server data.
- Define query keys consistently: `["resource", id]`, `["resource", "list", filters]`.
- Use mutations for POST/PUT/DELETE operations with optimistic updates where appropriate.
- Access the query client via router context: `const { queryClient } = Route.useRouteContext()`.

### Backend & Auth
- **Use the Supabase client** from `src/lib/supabase.ts` for all backend operations.
- Do NOT create a new Supabase client; import the singleton: `import { supabase } from "@/lib/supabase"`.
- Auth state is managed via `AuthContext` (`src/contexts/AuthContext.tsx`). Use `useAuth()` hook for user/session info.
- Use Supabase Storage for file uploads; use `.from("bucket")` for queries.

### Dates
- **Use `date-fns`** for date manipulation and formatting.
- Use `react-day-picker` (wrapped by `src/components/ui/calendar.tsx`) for date pickers.

### Charts
- **Use `recharts`** for data visualization. Wrap in `src/components/ui/chart.tsx` patterns where applicable.

### Notifications
- **Use `sonner`** for toast notifications. Import `Toaster` in root and call `toast()` / `sonner.toast()`.

---

## Styling Rules

- **Use Tailwind CSS exclusively**. No inline styles, no CSS modules, no styled-components.
- Use Tailwind utility classes for layout, spacing, colors, typography, borders, shadows, and responsiveness.
- Leverage shadcn/ui design tokens: `bg-background`, `text-foreground`, `text-muted-foreground`, `border-border`, `rounded-lg`, `px-4 py-2`, etc.
- **Couleurs métier** : utiliser les tokens CSS custom properties (`var(--cosl-red)`, `var(--cosl-gold)`, etc.) quand nécessaire, jamais de couleurs hardcodées en dehors de ces tokens.
- Keep components responsive with Tailwind breakpoints (`sm:`, `md:`, `lg:`, `xl:`).
- Use `cn()` utility from `src/lib/utils.ts` for conditional class merging.

---

## Database Migrations

### Système de migrations
- Les migrations SQL vivent dans `supabase/sql/`.
- Depuis la migration 39, un **système de tracking** est en place via la table `supabase_migrations.schema_migrations` (voir `00b_schema_migrations_init.sql`).
- Les migrations 00 à 38 sont marquées comme déjà appliquées dans cette table.
- Chaque nouvelle migration doit s'enregistrer à la fin du script `up` :
  ```sql
  INSERT INTO supabase_migrations.schema_migrations (version, name)
  VALUES ('00XX', 'nom_migration')
  ON CONFLICT (version) DO NOTHING;
  ```
- Le script `down` correspondant doit retirer l'enregistrement :
  ```sql
  DELETE FROM supabase_migrations.schema_migrations WHERE version = '00XX';
  ```

### Paire Up/Down avec snapshot
- Chaque migration qui modifie des données existantes (UPDATE/DELETE) doit avoir :
  1. Un fichier `NNb_snapshot_before_XX.sql` — sauvegarde les tables impactées dans des tables `migration_XX_snapshot_*`
  2. Un fichier `XX_up_*.sql` — applique la migration
  3. Un fichier `XX_down_*.sql` — restaure depuis le snapshot
- Le snapshot est conservé après rollback (par sécurité) — suppression manuelle optionnelle.

### Ordre d'exécution
1. `00b_schema_migrations_init.sql` (une seule fois, pour initialiser le tracking)
2. `NNb_snapshot_before_XX.sql` (avant chaque migration destructrice)
3. `XX_up_*.sql` (appliquer)
4. `XX_down_*.sql` (annuler si besoin)

### Attention
- Pas de `supabase db rollback` natif — le rollback est manuel via le script `down`.
- `supabase db reset` remet TOUT à zéro (perte de données) — ne pas utiliser pour un rollback ciblé.
- Toujours faire un snapshot avant une migration qui modifie des données existantes.

---

## Code Quality Rules

- Write TypeScript with strict typing. Avoid `any`. Define interfaces/types in `src/lib/types.ts` or co-located.
- Use functional components + hooks. No class components.
- Keep components small and focused. Extract logic into custom hooks.
- Handle loading and error states for all data-fetching components.
- The app UI is in **French** — use French labels, placeholders, and error messages in user-facing content.
- Do NOT add new npm packages without confirming they are necessary. Prefer built-in/shadcn solutions.
