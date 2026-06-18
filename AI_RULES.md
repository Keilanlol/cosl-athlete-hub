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
- Keep components responsive with Tailwind breakpoints (`sm:`, `md:`, `lg:`, `xl:`).
- Use `cn()` utility from `src/lib/utils.ts` for conditional class merging.

---

## Code Quality Rules

- Write TypeScript with strict typing. Avoid `any`. Define interfaces/types in `src/lib/types.ts` or co-located.
- Use functional components + hooks. No class components.
- Keep components small and focused. Extract logic into custom hooks.
- Handle loading and error states for all data-fetching components.
- The app UI is in **French** — use French labels, placeholders, and error messages in user-facing content.
- Do NOT add new npm packages without confirming they are necessary. Prefer built-in/shadcn solutions.
