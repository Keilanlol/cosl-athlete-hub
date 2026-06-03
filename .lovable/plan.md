# Plan — Intégrer PersonCreateDialog dans Athlètes & Encadrants

## Constat préalable

- **Sidebar** : "Personnes" est déjà ajouté avant "Athlètes" (`src/components/AppSidebar.tsx` ligne 38). **Rien à faire**.
- **Athlètes (`athletes/index.tsx`)** : le Dialog existant (lignes 631-1013) sert à la fois pour création ET édition (via `openEdit` ligne 615). On garde ce dialog pour l'édition, on remplace uniquement le **bouton "Ajouter un athlète"** (ligne 432).
- **Coaches (`coaches/index.tsx`)** : même pattern (Dialog ligne 424-595 utilisé pour create+edit). Idem.
- **Fiche athlète (`athletes/$id.tsx`)** : header lignes 706-772. `person_id` n'est pas dans le type `Athlete` ni dans le `select` actuel — requête séparée nécessaire.

## 1. `src/components/persons/PersonCreateDialog.tsx` — ajouter `initialRoles`

Nouvelle prop optionnelle pour pré-cocher des rôles à l'étape 2 :

```ts
initialRoles?: PersonRoleType[]
```

Initialiser `selectedRoles` avec `initialRoles ?? []` lors du reset (montage + `open=true`). Le wizard commence toujours à l'étape 1 "Général" pour que l'utilisateur saisisse nom/prénom (+ birth_date/gender requis si athlète).

## 2. `src/routes/_authenticated/athletes/index.tsx`

- Imports : ajouter `PersonCreateDialog` et un state `personDialogOpen`.
- Bouton ligne 432 : `onClick={() => setPersonDialogOpen(true)}`, conserver le label "Ajouter un athlète" et l'icône `Plus`.
- Ajouter en bas du JSX (à côté du Dialog existant) :
  ```tsx
  <PersonCreateDialog
    open={personDialogOpen}
    onOpenChange={setPersonDialogOpen}
    initialRoles={["athlete"]}
    onCreated={(personId) => {
      load(); // recharger la liste athlètes
      navigate({ to: "/persons/$personId", params: { personId } });
    }}
  />
  ```
- Conserver `openCreate`/le Dialog existant pour ne pas casser l'édition (`openEdit` line 615 l'utilise toujours). `openCreate` devient code mort côté UI mais on ne le supprime pas (hors scope).

## 3. `src/routes/_authenticated/coaches/index.tsx`

Pattern identique :
- State `personDialogOpen` + import `PersonCreateDialog`.
- Remplacer l'`onClick` du bouton "Ajouter un encadrant" pour ouvrir `PersonCreateDialog` avec `initialRoles={["coach"]}`.
- `onCreated` → `load()` + navigation vers `/persons/$personId`.
- Conserver le Dialog existant pour l'édition.

## 4. `src/routes/_authenticated/athletes/$id.tsx` — lien "Fiche personne"

- Ajouter `Users` aux imports `lucide-react` (ligne 4).
- Charger `person_id` via une requête séparée au montage (évite de toucher au type `Athlete` global) :
  ```ts
  const [personId, setPersonId] = useState<string | null>(null);
  useEffect(() => {
    supabase.from("athletes").select("person_id").eq("id", id).maybeSingle()
      .then(({ data }) => setPersonId((data?.person_id as string | null) ?? null));
  }, [id]);
  ```
- Dans le header (lignes 767-771), ajouter avant le bouton "Modifier" :
  ```tsx
  {personId && (
    <Button asChild variant="outline">
      <Link to="/persons/$personId" params={{ personId }}>
        <Users className="mr-2 h-4 w-4" /> Fiche personne
      </Link>
    </Button>
  )}
  ```

## Hors périmètre

- Page `members/index.tsx` : déjà existante mais hors scope (le user dit "si elles existent" pour les encadrants/membres, on traite uniquement coaches qui suit le même pattern de dialog create/edit).
- Refactor du Dialog create/edit des pages athletes/coaches (le code de création reste mais n'est plus accessible via UI).
- Synchronisation rétroactive : les anciens athlètes/coaches sans `person_id` n'auront pas de lien "Fiche personne" — comportement attendu.
- Modification du type `Athlete` dans `src/lib/types.ts`.
