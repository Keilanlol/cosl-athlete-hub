# Composants et patterns UI

## Composants réutilisables (src/components/)

### Composants métier

| Composant | Fichier | Description |
|-----------|---------|-------------|
| `AppSidebar` | `AppSidebar.tsx` | Sidebar de navigation (groupes: Vue d'ensemble, Athlete Management, Games & Competitions, Accreditation, Logistics & Travel, Communication, Administration) |
| `ProtectedRoute` | `ProtectedRoute.tsx` | Vérifie l'auth, redirige vers /login si non authentifié |
| `ConfirmDialog` | `ConfirmDialog.tsx` | Dialogue de confirmation global. Utiliser `confirmAction({ title, description, confirmLabel })` qui retourne une Promise<boolean> |
| `DataTableShell` | `DataTableShell.tsx` | Exporte `EmptyState`, `TableSkeleton`, `PagerBar`, `PAGE_SIZE` (25). Pattern standard pour les listes. |
| `EditableSelect` | `EditableSelect.tsx` | Select shadcn avec gestion CRUD des options (ajout/suppression). Utilisé pour sports, niveaux, types de documents. |
| `AthletePhotoUpload` | `AthletePhotoUpload.tsx` | Upload photo d'identité athlète vers Supabase Storage. Modes preview (création) et upload (édition). |
| `EntityImageUpload` | `EntityImageUpload.tsx` | Upload générique d'image pour entités (games, fédérations, clubs) avec storage path management. |
| `FileUpload` | `FileUpload.tsx` | Upload de fichier générique vers bucket Supabase. Exporte `pathFromSignedUrl()` pour extraire le path de stockage. |
| `AddressSearch` | `AddressSearch.tsx` | Autocomplétion d'adresse via API Photon (proxy Vite). Remplit rue, CP, ville, pays. |
| `KycAxis` | `KycAxis.tsx` | Composant d'un axe KYC (titre, description, statut green/orange/red, contenu enfant). |
| `KycStatusBadge` | `KycStatusBadge.tsx` | Badge visuel du statut KYC (green/orange/red) avec icône optionnelle. |
| `PersonCombobox` | `PersonCombobox.tsx` | Combobox de recherche de personne (persons). |
| `WeekAgenda` | `WeekAgenda.tsx` | Agenda hebdomadaire avec créneaux. Utilisé dans l'onglet agenda de l'athlète. |
| `MessageDetailDialog` | `MessageDetailDialog.tsx` | Dialogue d'affichage du détail d'un message reçu. |
| `LogisticsTabs` | `LogisticsTabs.tsx` | Onglets logistique (travel plans, flights, accommodations, transport). |
| `LogoFilePicker` | `LogoFilePicker.tsx` | Sélecteur de fichier pour logos d'entités. |
| `PageStub` | `PageStub.tsx` | Page placeholder pour routes en cours de développement. |

### Composants persons/

| Composant | Fichier | Description |
|-----------|---------|-------------|
| `AddPersonButton` | `persons/AddPersonButton.tsx` | Bouton d'ajout de personne avec dialogue de création. Prop `role` pour pré-sélectionner le rôle. |
| `PersonCreateDialog` | `persons/PersonCreateDialog.tsx` | Dialogue de création d'une personne (super-classe). |
| `AddRoleDialog` | `persons/AddRoleDialog.tsx` | Dialogue d'ajout d'un rôle à une personne existante. |
| `PersonRoleBadge` | `persons/PersonRoleBadge.tsx` | Badge affichant le(s) rôle(s) d'une personne. |

### Composants sponsors/partners

| Composant | Fichier | Description |
|-----------|---------|-------------|
| `SponsorQuickCreateDialog` | `sponsors/SponsorQuickCreateDialog.tsx` | Dialogue rapide de création de sponsor. |
| `PartnerQuickCreateDialog` | `partners/PartnerQuickCreateDialog.tsx` | Dialogue rapide de création de partenaire. |

### Layouts

| Composant | Fichier | Description |
|-----------|---------|-------------|
| `AppLayout` | `layouts/AppLayout.tsx` | Layout principal authentifié : Sidebar + Header + Main. |
| `AuthLayout` | `layouts/AuthLayout.tsx` | Layout de la page de connexion (centré, logo COSL). |

## Patterns UI récurrents

### Page de liste standard

```tsx
function ListPage() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const load = async () => {
    setRows(null);
    const { data, error } = await supabase.from("table").select("*").order("...");
    if (error) { toast.error("Erreur", { description: friendlyError(error) }); setRows([]); return; }
    setRows(data ?? []);
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => { /* filtrage local */ }, [rows, search]);
  const pageCount = Math.ceil(filtered.length / PAGE_SIZE);
  const visible = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="space-y-6">
      {/* Header avec titre + bouton ajout */}
      {/* Filtres (search, selects) */}
      {/* Table ou EmptyState ou TableSkeleton */}
      <PagerBar page={page} pageCount={pageCount} onChange={setPage} />
      {/* Dialog de création/édition */}
    </div>
  );
}
```

### Header de page standard

```tsx
<div className="flex flex-wrap items-end justify-between gap-4">
  <div className="flex items-center gap-3">
    <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-white">
      <Icon className="h-5 w-5" />
    </span>
    <div>
      <h1 className="text-2xl font-semibold text-foreground">Titre</h1>
      <p className="mt-1 text-sm text-muted-foreground">Description</p>
    </div>
  </div>
  <Button onClick={openCreate} className="bg-primary hover:bg-[var(--cosl-red-dark)]">
    <Plus className="mr-2 h-4 w-4" /> Ajouter
  </Button>
</div>
```

### Table avec actions

```tsx
<div className="rounded-lg border border-border bg-card">
  {rows === null ? (
    <TableSkeleton cols={N} />
  ) : filtered.length === 0 ? (
    <div className="p-6"><EmptyState message="Aucun résultat." /></div>
  ) : (
    <Table>
      <TableHeader>...</TableHeader>
      <TableBody>
        {visible.map((row) => (
          <TableRow key={row.id} onClick={() => navigate(...)} className="cursor-pointer hover:bg-muted">
            <TableCell>...</TableCell>
            <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
              <Button variant="ghost" size="icon" onClick={() => openEdit(row)}>
                <Pencil className="h-4 w-4" />
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )}
</div>
```

### Dialogue de création/édition

```tsx
<Dialog open={open} onOpenChange={setOpen}>
  <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
    <form onSubmit={submit}>
      <DialogHeader>
        <DialogTitle>{editing ? "Modifier" : "Ajouter"}</DialogTitle>
        <DialogDescription>...</DialogDescription>
      </DialogHeader>
      <div className="grid gap-4 py-4">
        {/* Champs du formulaire */}
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
        <Button type="submit" className="bg-primary hover:bg-[var(--cosl-red-dark)]">
          {saving ? "Enregistrement…" : "Enregistrer"}
        </Button>
      </DialogFooter>
    </form>
  </DialogContent>
</Dialog>
```

### Confirmation de suppression

Pattern avec `confirmAction()` (global, asynchrone) :

```tsx
import { confirmAction } from "@/components/ConfirmDialog";

const deleteItem = async (id: string) => {
  if (!(await confirmAction({ title: "Supprimer ?", confirmLabel: "Supprimer" }))) return;
  const { error } = await supabase.from("table").delete().eq("id", id);
  if (error) return toast.error("Échec", { description: friendlyError(error) });
  toast.success("Supprimé");
  load();
};
```

Ou avec `AlertDialog` contrôlé :

```tsx
const [deleteId, setDeleteId] = useState<string | null>(null);

<AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>Supprimer ?</AlertDialogTitle>
      <AlertDialogDescription>Action irréversible.</AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogCancel>Annuler</AlertDialogCancel>
      <AlertDialogAction onClick={confirmDelete} className="bg-red-600 hover:bg-red-700">Supprimer</AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
```

### Onglets avec hash URL

```tsx
import { useHashTab } from "@/hooks/useHashTab";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const [tab, setTab] = useHashTab("profil");

<Tabs value={tab} onValueChange={setTab}>
  <TabsList>
    <TabsTrigger value="profil">Profil</TabsTrigger>
    <TabsTrigger value="kyc">KYC</TabsTrigger>
  </TabsList>
  <TabsContent value="profil">...</TabsContent>
  <TabsContent value="kyc">...</TabsContent>
</Tabs>
```