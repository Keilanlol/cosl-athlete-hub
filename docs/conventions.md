# Conventions de code et charte graphique

## Charte graphique COSL

### Palette de couleurs

Tokens CSS définis dans `src/styles.css` (`:root`) :

| Token | Valeur | Usage |
|-------|--------|-------|
| `--cosl-red` | `#C8102E` | Principal : CTAs, liens, focus, sidebar active |
| `--cosl-red-dark` | `#A00D24` | Hover states |
| `--cosl-red-light` | `#F5E6E9` | Surfaces secondaires, accent doux |
| `--cosl-black` | `#1A1A1A` | Texte, sidebar, header |
| `--cosl-gold` | `#C9A84C` | Médailles, distinctions |
| `--cosl-gold-light` | `#F9F3E3` | Surfaces gold |
| `--lux-blue` | `#009ACD` | Éléments informatifs |
| `--lux-blue-light` | `#E6F4FB` | Surfaces bleu |

### Tokens sémantiques shadcn/ui

| Token | Valeur |
|-------|--------|
| `--background` | `#FAFAFA` |
| `--foreground` | `#1A1A1A` |
| `--primary` | `#C8102E` (cosl-red) |
| `--primary-foreground` | `#FFFFFF` |
| `--accent` | `#F5E6E9` (cosl-red-light) |
| `--accent-foreground` | `#C8102E` |
| `--muted-foreground` | `#717171` |
| `--border` | `#E8E8E8` |
| `--sidebar` | `#1A1A1A` (cosl-black) |
| `--sidebar-foreground` | `#F5F5F5` |

### Règles d'usage des couleurs

- **Boutons primaires** : `className="bg-primary hover:bg-[var(--cosl-red-dark)]"`
- **Couleurs métier** : utiliser les CSS custom properties (`var(--cosl-red)`, etc.), jamais de couleurs hardcodées en dehors de ces tokens.
- **Pas de dark mode** — uniquement light mode.
- **Focus** : `outline: 2px solid var(--cosl-red)` avec `outline-offset: 2px` (défini globalement dans `styles.css`).
- **Sélection texte** : fond `--cosl-red-light`, texte `--cosl-red`.
- **Scrollbar** : thumb rouge COSL, track gris clair.

### Typographie

- Police : `"Inter"`, system-ui, sans-serif (chargée via Google Fonts dans `index.html`).
- Titre de page : `text-2xl font-semibold text-foreground`
- Sous-titre : `text-lg font-semibold`
- Texte standard : `text-sm`
- Labels de formulaire : `font-medium`

## Règles de code

### TypeScript

- **Strict mode** activé.
- Pas de `any` — définir des interfaces/types dans `src/lib/types.ts` ou co-localisés.
- Composants fonctionnels + hooks uniquement. Pas de class components.
- Components petits et focalisés. Extraire la logique dans des hooks.

### Fichiers

| Dossier | Contenu | Règle |
|---------|---------|-------|
| `src/routes/` | Pages/routes | File-based routing TanStack Router. Ne pas créer `src/pages/`. |
| `src/components/` | Composants réutilisables | — |
| `src/components/ui/` | Primitives shadcn/ui | **NE PAS éditer directement**. Créer des wrappers dans `src/components/`. |
| `src/hooks/` | Hooks custom | — |
| `src/lib/` | Utilitaires, types, Supabase | — |
| `src/contexts/` | Contexts React | — |

### Imports

- Alias `@/` configuré dans `tsconfig.json` et `vite.config.ts` (via `vite-tsconfig-paths`).
- Importer le client Supabase : `import { supabase } from "@/lib/supabase"`.
- Importer les hooks : `import { useAuth } from "@/hooks/useAuth"`.
- Importer les types : `import { type Athlete } from "@/lib/types"`.

### UI en français

Tout le texte visible par l'utilisateur doit être en **français** :
- Labels, placeholders, messages d'erreur, toasts, en-têtes de tableau, boutons.
- Les messages d'erreur Supabase sont traduits via `friendlyError()` (`src/lib/error-messages.ts`).

### Formulaires

Pattern standard (React Hook Form + Zod) :

```tsx
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

const schema = z.object({ ... });
type FormValues = z.infer<typeof schema>;

const form = useForm<FormValues>({ resolver: zodResolver(schema) });
```

Cependant, plusieurs pages utilisent un pattern plus léger avec `useState` + validation Zod manuelle (`safeParse`), notamment les pages athlètes et games.

### Notifications (toasts)

Utiliser `sonner` :

```tsx
import { toast } from "sonner";
toast.success("Athlète ajouté");
toast.error("Échec", { description: friendlyError(error) });
```

### Composants shadcn/ui disponibles

`button`, `dialog`, `dropdown-menu`, `form`, `input`, `select`, `table`, `tabs`, `calendar`, `card`, `badge`, `avatar`, `sheet`, `sidebar`, `command`, `popover`, `checkbox`, `radio-group`, `switch`, `slider`, `textarea`, `scroll-area`, `separator`, `skeleton`, `tooltip`, `toggle`, `toggle-group`, `accordion`, `collapsible`, `context-menu`, `hover-card`, `menubar`, `navigation-menu`, `pagination`, `progress`, `resizable`, `carousel`, `drawer`, `input-otp`, `aspect-ratio`, `alert`, `alert-dialog`, `breadcrumb`, `chart`, `label`.

### Icons

- Utiliser `lucide-react` exclusivement.
- Import individuel : `import { Users, Settings } from "lucide-react"`.

### Styling

- **Tailwind CSS uniquement**. Pas d'inline styles, pas de CSS modules, pas de styled-components.
- Utiliser `cn()` de `src/lib/utils.ts` pour le merge conditionnel de classes.
- Classes sémantiques : `bg-background`, `text-foreground`, `text-muted-foreground`, `border-border`, `rounded-lg`, `px-4 py-2`.
- Responsive : `sm:`, `md:`, `lg:`, `xl:`.

### Data fetching

- **TanStack Query** disponible et configuré pour le server state.
- En pratique, beaucoup de pages utilisent le pattern `useEffect` + `useState` + `supabase.from()`.
- Toujours gérer les états de **loading** (`null` → skeleton) et **error** (`toast.error`).
- Les query keys TanStack Query doivent être cohérentes : `["resource", id]`, `["resource", "list", filters]`.

### Dates

- Utiliser `date-fns` pour la manipulation et le formatage.
- `react-day-picker` (wrappé par `src/components/ui/calendar.tsx`) pour les date pickers.
- Format d'affichage standard : `toLocaleDateString("fr-FR")`.

### Erreurs

- `friendlyError()` de `src/lib/error-messages.ts` traduit les erreurs PostgreSQL/Supabase.
- Codes gérés : 23503 (FK violation), 23505 (unique), 23502 (not null), 23514 (check), 22P02 (invalid text), 42501 (RLS), auth errors, network errors.