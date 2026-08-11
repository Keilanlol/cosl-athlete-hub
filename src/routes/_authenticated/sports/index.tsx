import { createFileRoute } from "@tanstack/react-router";
import { friendlyError } from "@/lib/error-messages";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  Volleyball,
  ChevronRight,
  ChevronDown,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { useTypeGroup } from "@/hooks/useTypeItems";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  ListPageHeader,
  SearchInput,
  ResultCount,
  SortableHeader,
  ActionsCell,
} from "@/components/list-table";
import { SortBtn } from "@/components/DataTableShell";
import { EmptyState, TableSkeleton } from "@/components/DataTableShell";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const Route = createFileRoute("/_authenticated/sports/")({
  component: SportsPage,
});

type Sport = {
  id: string;
  name: string;
  is_olympic: boolean | null;
  is_summer: boolean | null;
};

type Discipline = {
  id: string;
  sport_id: string;
  name: string;
  gender: string;
  age_category: string | null;
};

type SortKey = "name" | "is_olympic" | "is_summer";

// Fallback si le groupe "genders" n'est pas encore en base (migration 58 non appliquée)
const GENDERS_FALLBACK: { code: string; label: string }[] = [
  { code: "male", label: "Hommes" },
  { code: "female", label: "Femmes" },
  { code: "mixed", label: "Mixte" },
];

function SportsPage() {
  const gendersHook = useTypeGroup("genders");
  const genderItems = gendersHook.items.length > 0 ? gendersHook.items : GENDERS_FALLBACK;
  const [sports, setSports] = useState<Sport[] | null>(null);
  const [disciplines, setDisciplines] = useState<Discipline[]>([]);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({
    key: "name",
    dir: "asc",
  });
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [sportDialog, setSportDialog] = useState<{
    mode: "create" | "edit";
    sport: Sport | null;
  } | null>(null);
  const [discDialog, setDiscDialog] = useState<{
    sportId: string;
    discipline: Discipline | null;
  } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<
    { type: "sport" | "discipline"; id: string; name: string } | null
  >(null);

  const load = useCallback(async () => {
    const [{ data: sp }, { data: di }] = await Promise.all([
      supabase.from("sports").select("*").order("name", { ascending: true }),
      supabase.from("disciplines").select("*").order("name", { ascending: true }),
    ]);
    setSports((sp ?? []) as Sport[]);
    setDisciplines((di ?? []) as Discipline[]);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    if (!sports) return [];
    const q = search.trim().toLowerCase();
    let r = sports.slice();
    if (q) {
      r = r.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          disciplines.some(
            (d) => d.sport_id === s.id && d.name.toLowerCase().includes(q),
          ),
      );
    }
    r.sort((a, b) => {
      const av = ((a as Record<string, unknown>)[sort.key] ?? "").toString().toLowerCase();
      const bv = ((b as Record<string, unknown>)[sort.key] ?? "").toString().toLowerCase();
      const cmp = av.localeCompare(bv);
      return sort.dir === "asc" ? cmp : -cmp;
    });
    return r;
  }, [sports, search, disciplines, sort]);

  const toggleSort = (key: SortKey) =>
    setSort((s) =>
      s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" },
    );

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const disciplinesFor = (sportId: string) =>
    disciplines.filter((d) => d.sport_id === sportId);

  // ── Sport CRUD ────────────────────────────────────────────────────────────
  const saveSport = async (
    name: string,
    isOlympic: boolean,
    isSummer: boolean,
    existing?: Sport,
  ) => {
    if (!name.trim()) {
      toast.error("Le nom est requis");
      return false;
    }
    const payload = { name: name.trim(), is_olympic: isOlympic, is_summer: isSummer };
    if (existing) {
      const { error } = await supabase.from("sports").update(payload).eq("id", existing.id);
      if (error) {
        toast.error("Erreur", { description: friendlyError(error) });
        return false;
      }
      toast.success("Sport modifié");
    } else {
      const { error } = await supabase.from("sports").insert(payload);
      if (error) {
        toast.error("Erreur", { description: friendlyError(error) });
        return false;
      }
      toast.success("Sport ajouté");
    }
    await load();
    return true;
  };

  // ── Discipline CRUD ────────────────────────────────────────────────────────
  const saveDiscipline = async (
    sportId: string,
    name: string,
    gender: string,
    ageCategory: string,
    existing?: Discipline,
  ) => {
    if (!name.trim()) {
      toast.error("Le nom est requis");
      return false;
    }
    const payload = {
      sport_id: sportId,
      name: name.trim(),
      gender,
      age_category: ageCategory.trim() || null,
    };
    if (existing) {
      const { error } = await supabase
        .from("disciplines")
        .update(payload)
        .eq("id", existing.id);
      if (error) {
        toast.error("Erreur", { description: friendlyError(error) });
        return false;
      }
      toast.success("Discipline modifiée");
    } else {
      const { error } = await supabase.from("disciplines").insert(payload);
      if (error) {
        toast.error("Erreur", { description: friendlyError(error) });
        return false;
      }
      toast.success("Discipline ajoutée");
    }
    await load();
    return true;
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    if (deleteTarget.type === "sport") {
      const { error } = await supabase.from("sports").delete().eq("id", deleteTarget.id);
      if (error) {
        toast.error("Suppression impossible", { description: friendlyError(error) });
      } else {
        toast.success("Sport supprimé");
        await load();
      }
    } else {
      const { error } = await supabase
        .from("disciplines")
        .delete()
        .eq("id", deleteTarget.id);
      if (error) {
        toast.error("Suppression impossible", { description: friendlyError(error) });
      } else {
        toast.success("Discipline supprimée");
        await load();
      }
    }
    setDeleteTarget(null);
  };

  const genderLabel = (g: string) =>
    genderItems.find((x) => x.code === g)?.label ?? g;

  return (
    <div className="space-y-6">
      <ListPageHeader
        icon={Volleyball}
        title="Sports & Disciplines"
        description="Gestion des sports reconnus par le COSL et de leurs disciplines."
      >
        <Button
          onClick={() => setSportDialog({ mode: "create", sport: null })}
          className="bg-primary hover:bg-[var(--cosl-red-dark)]"
        >
          <Plus className="mr-2 h-4 w-4" /> Ajouter un sport
        </Button>
      </ListPageHeader>

      <div className="flex flex-wrap items-center gap-3">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Rechercher un sport ou une discipline…"
        />
        <ResultCount count={filtered.length} total={disciplines.length > 0 ? sports?.length ?? 0 : undefined} />
      </div>

      <div className="rounded-lg border border-border bg-card">
        {sports === null ? (
          <TableSkeleton cols={6} />
        ) : filtered.length === 0 ? (
          <div className="p-6">
            <EmptyState message="Aucun sport enregistré." />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10"></TableHead>
                <TableHead className="w-10"></TableHead>
                <SortableHeader sortKey="name" sort={sort} onToggle={toggleSort}>
                  Nom
                </SortableHeader>
                <TableHead>Disciplines</TableHead>
                <TableHead><SortBtn active={sort.key === "is_olympic"} dir={sort.dir} onClick={() => toggleSort("is_olympic")}>Olympique</SortBtn></TableHead>
                <TableHead><SortBtn active={sort.key === "is_summer"} dir={sort.dir} onClick={() => toggleSort("is_summer")}>Saison</SortBtn></TableHead>
                <TableHead className="w-24 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((sport) => {
                const isExpanded = expanded.has(sport.id);
                const discList = disciplinesFor(sport.id);
                return (
                  <SportRow
                    key={sport.id}
                    sport={sport}
                    isExpanded={isExpanded}
                    discList={discList}
                    onToggle={() => toggleExpand(sport.id)}
                    onEditSport={() => setSportDialog({ mode: "edit", sport })}
                    onDeleteSport={() =>
                      setDeleteTarget({ type: "sport", id: sport.id, name: sport.name })
                    }
                    onAddDiscipline={() =>
                      setDiscDialog({ sportId: sport.id, discipline: null })
                    }
                    onEditDiscipline={(d) =>
                      setDiscDialog({ sportId: sport.id, discipline: d })
                    }
                    onDeleteDiscipline={(d) =>
                      setDeleteTarget({ type: "discipline", id: d.id, name: d.name })
                    }
                    genderLabel={genderLabel}
                  />
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Sport dialog */}
      {sportDialog && (
        <SportDialog
          mode={sportDialog.mode}
          sport={sportDialog.sport}
          onOpenChange={(o) => !o && setSportDialog(null)}
          onSave={saveSport}
        />
      )}

      {/* Discipline dialog */}
      {discDialog && (
        <DisciplineDialog
          sportId={discDialog.sportId}
          discipline={discDialog.discipline}
          genderItems={genderItems}
          onOpenChange={(o) => !o && setDiscDialog(null)}
          onSave={saveDiscipline}
        />
      )}

      {/* Delete confirmation */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Supprimer {deleteTarget?.type === "sport" ? "ce sport" : "cette discipline"} ?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Vous êtes sur le point de supprimer{" "}
              <span className="font-medium text-foreground">{deleteTarget?.name}</span>.
              {deleteTarget?.type === "sport" &&
                " Toutes les disciplines liées seront également supprimées."}
              {" Cette action est irréversible."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-red-600 hover:bg-red-700"
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SportRow — ligne de sport avec accordéon des disciplines
// ─────────────────────────────────────────────────────────────────────────────

function SportRow({
  sport,
  isExpanded,
  discList,
  onToggle,
  onEditSport,
  onDeleteSport,
  onAddDiscipline,
  onEditDiscipline,
  onDeleteDiscipline,
  genderLabel,
}: {
  sport: Sport;
  isExpanded: boolean;
  discList: Discipline[];
  onToggle: () => void;
  onEditSport: () => void;
  onDeleteSport: () => void;
  onAddDiscipline: () => void;
  onEditDiscipline: (d: Discipline) => void;
  onDeleteDiscipline: (d: Discipline) => void;
  genderLabel: (g: string) => string;
}) {
  return (
    <>
      <TableRow
        className="cursor-pointer hover:bg-muted"
        onClick={onToggle}
      >
        <TableCell className="p-2">
          <span className="inline-flex h-6 w-6 items-center justify-center text-muted-foreground">
            {isExpanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </span>
        </TableCell>
        <TableCell>
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[var(--cosl-red-light)] text-primary">
            <Volleyball className="h-4 w-4" />
          </span>
        </TableCell>
        <TableCell className="font-medium">{sport.name}</TableCell>
        <TableCell className="text-muted-foreground">
          {discList.length} discipline(s)
        </TableCell>
        <TableCell>
          {sport.is_olympic ? (
            <Badge className="bg-[var(--cosl-red-light)] text-primary hover:bg-[var(--cosl-red-light)]">
              Olympique
            </Badge>
          ) : (
            <Badge variant="outline">Non</Badge>
          )}
        </TableCell>
        <TableCell className="text-muted-foreground">
          {sport.is_summer === false ? "Hiver" : "Été"}
        </TableCell>
        <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onEditSport}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-red-600 hover:text-red-700"
            onClick={onDeleteSport}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </TableCell>
      </TableRow>
      {isExpanded && (
        <TableRow className="bg-muted/30">
          <TableCell colSpan={7} className="p-0">
            <div className="px-12 py-3">
              {discList.length === 0 ? (
                <p className="text-sm text-muted-foreground py-2">
                  Aucune discipline.{" "}
                  <button className="text-primary underline" onClick={onAddDiscipline}>
                    Ajouter une discipline
                  </button>
                </p>
              ) : (
                <div className="space-y-1">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Disciplines de {sport.name}
                    </p>
                    <Button variant="outline" size="sm" className="h-7" onClick={onAddDiscipline}>
                      <Plus className="mr-1 h-3.5 w-3.5" /> Ajouter
                    </Button>
                  </div>
                  {discList.map((d) => (
                    <div
                      key={d.id}
                      className="flex items-center justify-between rounded-md border border-border bg-card px-3 py-2"
                    >
                      <div className="flex items-center gap-3">
                        <span className="font-medium text-sm">{d.name}</span>
                        <Badge variant="outline" className="text-xs">
                          {genderLabel(d.gender)}
                        </Badge>
                        {d.age_category && (
                          <span className="text-xs text-muted-foreground">
                            {d.age_category}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => onEditDiscipline(d)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-red-600 hover:text-red-700"
                          onClick={() => onDeleteDiscipline(d)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Sport dialog
// ─────────────────────────────────────────────────────────────────────────────

function SportDialog({
  mode,
  sport,
  onOpenChange,
  onSave,
}: {
  mode: "create" | "edit";
  sport: Sport | null;
  onOpenChange: (v: boolean) => void;
  onSave: (name: string, isOlympic: boolean, isSummer: boolean, existing?: Sport) => Promise<boolean>;
}) {
  const [name, setName] = useState("");
  const [isOlympic, setIsOlympic] = useState(true);
  const [isSummer, setIsSummer] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (sport) {
      setName(sport.name);
      setIsOlympic(sport.is_olympic ?? true);
      setIsSummer(sport.is_summer ?? true);
    } else {
      setName("");
      setIsOlympic(true);
      setIsSummer(true);
    }
  }, [sport]);

  const submit = async () => {
    setSaving(true);
    const ok = await onSave(
      name,
      isOlympic,
      isSummer,
      mode === "edit" ? sport ?? undefined : undefined,
    );
    setSaving(false);
    if (ok) onOpenChange(false);
  };

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{mode === "edit" ? "Modifier le sport" : "Ajouter un sport"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Nom *</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="ex. Athlétisme"
              autoFocus
            />
          </div>
          <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
            <Label className="cursor-pointer">Sport olympique</Label>
            <Switch checked={isOlympic} onCheckedChange={setIsOlympic} />
          </div>
          <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
            <Label className="cursor-pointer">Sport d'été</Label>
            <div className="flex items-center gap-2">
              <Switch checked={isSummer} onCheckedChange={setIsSummer} />
              <span className="text-xs text-muted-foreground">
                {isSummer ? "Été" : "Hiver"}
              </span>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button
            onClick={submit}
            disabled={saving || !name.trim()}
            className="bg-primary hover:bg-[var(--cosl-red-dark)]"
          >
            {saving ? "Enregistrement…" : mode === "edit" ? "Enregistrer" : "Ajouter"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Discipline dialog
// ─────────────────────────────────────────────────────────────────────────────

function DisciplineDialog({
  sportId,
  discipline,
  genderItems,
  onOpenChange,
  onSave,
}: {
  sportId: string;
  discipline: Discipline | null;
  genderItems: { code: string; label: string }[];
  onOpenChange: (v: boolean) => void;
  onSave: (
    sportId: string,
    name: string,
    gender: string,
    ageCategory: string,
    existing?: Discipline,
  ) => Promise<boolean>;
}) {
  const [name, setName] = useState("");
  const [gender, setGender] = useState("mixed");
  const [ageCategory, setAgeCategory] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (discipline) {
      setName(discipline.name);
      setGender(discipline.gender);
      setAgeCategory(discipline.age_category ?? "");
    } else {
      setName("");
      setGender("mixed");
      setAgeCategory("");
    }
  }, [discipline]);

  const submit = async () => {
    setSaving(true);
    const ok = await onSave(sportId, name, gender, ageCategory, discipline ?? undefined);
    setSaving(false);
    if (ok) onOpenChange(false);
  };

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {discipline ? "Modifier la discipline" : "Ajouter une discipline"}
          </DialogTitle>
          <DialogDescription>
            {discipline ? `Modification de « ${discipline.name} »` : "Nouvelle discipline"}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Nom *</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="ex. 100m"
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <Label>Genre</Label>
            <Select value={gender} onValueChange={setGender}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {genderItems.map((g) => (
                  <SelectItem key={g.code} value={g.code}>
                    {g.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Catégorie d'âge</Label>
            <Input
              value={ageCategory}
              onChange={(e) => setAgeCategory(e.target.value)}
              placeholder="ex. U18, Senior, (optionnel)"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button
            onClick={submit}
            disabled={saving || !name.trim()}
            className="bg-primary hover:bg-[var(--cosl-red-dark)]"
          >
            {saving ? "Enregistrement…" : discipline ? "Enregistrer" : "Ajouter"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}