import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { friendlyError } from "@/lib/error-messages";
import { useEffect, useMemo, useState } from "react";
import { Plus, Pencil, Trash2, Search, Archive, Trophy, Upload } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import {
  type Game,
  type GameStatus,
  type GameType,
} from "@/lib/types";
import { useTypeGroup, clsForCode } from "@/hooks/useTypeItems";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AddressSearch } from "@/components/AddressSearch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
  EmptyState,
  PAGE_SIZE,
  PagerBar,
  SortBtn,
  TableSkeleton,
} from "@/components/DataTableShell";
import { CsvImportDialog } from "@/components/CsvImportDialog";
import { gamesImportConfig } from "@/lib/csv-import-configs";

export const Route = createFileRoute("/_authenticated/games/")({
  component: GamesListPage,
});

const empty = {
  name: "",
  short_name: "",
  game_type: "jo_summer" as GameType,
  edition_year: new Date().getFullYear(),
  host_country: "",
  host_city: "",
  organizer: "",
  preparation_start: "",
  competition_start: "",
  competition_end: "",
  closing_date: "",
  description: "",
  status: "preparation" as GameStatus,
};

type SortKey = "name" | "game_type" | "edition_year" | "host_country" | "host_city" | "competition_start" | "competition_end" | "status";

function GamesListPage() {
  const navigate = useNavigate();
  const gameTypesHook = useTypeGroup("game_types");
  const gameStatusesHook = useTypeGroup("game_statuses");
  const [rows, setRows] = useState<Game[] | null>(null);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({
    key: "name",
    dir: "asc",
  });
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [yearFilter, setYearFilter] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Game | null>(null);
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);

  const load = async () => {
    setRows(null);
    const { data, error } = await supabase
      .from("games")
      .select("*")
      .order("competition_start", { ascending: false });
    if (error) {
      toast.error("Erreur de chargement", { description: friendlyError(error) });
      setRows([]);
      return;
    }
    setRows((data ?? []) as Game[]);
  };

  useEffect(() => {
    load();
  }, []);

  const years = useMemo(() => {
    const set = new Set<number>();
    (rows ?? []).forEach((g) => set.add(g.edition_year));
    return Array.from(set).sort((a, b) => b - a);
  }, [rows]);

  const filtered = useMemo(() => {
    if (!rows) return [];
    const q = search.trim().toLowerCase();
    let r = rows.filter((g) => {
      if (typeFilter !== "all" && g.game_type !== typeFilter) return false;
      if (statusFilter !== "all" && g.status !== statusFilter) return false;
      if (yearFilter !== "all" && String(g.edition_year) !== yearFilter) return false;
      if (q && !g.name.toLowerCase().includes(q)) return false;
      return true;
    });
    r.sort((a, b) => {
      const av = (a[sort.key] ?? "").toString().toLowerCase();
      const bv = (b[sort.key] ?? "").toString().toLowerCase();
      const cmp = av.localeCompare(bv);
      return sort.dir === "asc" ? cmp : -cmp;
    });
    return r;
  }, [rows, search, typeFilter, statusFilter, yearFilter, sort]);

  const toggleSort = (key: SortKey) =>
    setSort((s) =>
      s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" },
    );

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const visible = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  useEffect(() => {
    if (page > pageCount) setPage(1);
  }, [pageCount, page]);

  const openCreate = () => {
    setEditing(null);
    setForm(empty);
    setOpen(true);
  };

  const openEdit = (g: Game) => {
    setEditing(g);
    setForm({
      name: g.name,
      short_name: g.short_name ?? "",
      game_type: g.game_type,
      edition_year: g.edition_year,
      host_country: g.host_country ?? "",
      host_city: g.host_city ?? "",
      organizer: g.organizer ?? "",
      preparation_start: g.preparation_start ?? "",
      competition_start: g.competition_start,
      competition_end: g.competition_end,
      closing_date: g.closing_date ?? "",
      description: g.description ?? "",
      status: g.status,
    });
    setOpen(true);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.competition_start || !form.competition_end) {
      toast.error("Nom et dates de compétition requis");
      return;
    }
    if (form.competition_start > form.competition_end) {
      toast.error("Date de début après date de fin");
      return;
    }
    setSaving(true);
    const payload = {
      name: form.name.trim(),
      short_name: form.short_name.trim() || null,
      game_type: form.game_type,
      edition_year: Number(form.edition_year),
      host_country: form.host_country.trim() || null,
      host_city: form.host_city.trim() || null,
      organizer: form.organizer.trim() || null,
      preparation_start: form.preparation_start || null,
      competition_start: form.competition_start,
      competition_end: form.competition_end,
      closing_date: form.closing_date || null,
      description: form.description.trim() || null,
      status: form.status,
    };
    const { error } = editing
      ? await supabase.from("games").update(payload).eq("id", editing.id)
      : await supabase.from("games").insert(payload);
    setSaving(false);
    if (error) {
      toast.error("Échec de l'enregistrement", { description: friendlyError(error) });
      return;
    }
    toast.success(editing ? "Games modifié" : "Games créé");
    setOpen(false);
    load();
  };

  const archive = async (g: Game) => {
    const { error } = await supabase
      .from("games")
      .update({ status: "archived" })
      .eq("id", g.id);
    if (error) toast.error("Échec", { description: friendlyError(error) });
    else {
      toast.success("Games archivé");
      load();
    }
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    const { error } = await supabase.from("games").delete().eq("id", deleteId);
    if (error) toast.error("Suppression impossible", { description: friendlyError(error) });
    else {
      toast.success("Games supprimé");
      load();
    }
    setDeleteId(null);
  };

  const fmtDate = (d: string | null) =>
    d ? new Date(d).toLocaleDateString("fr-FR") : "—";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-white">
            <Trophy className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Games</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Événements multi-sports : JO, JPEE, EYOF, JOJ…
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setImportOpen(true)}>
            <Upload className="mr-2 h-4 w-4" /> Importer
          </Button>
          <Button onClick={openCreate} className="bg-primary hover:bg-[var(--cosl-red-dark)]">
            <Plus className="mr-2 h-4 w-4" />
            Créer un Games
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative max-w-sm flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Rechercher par nom…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Type" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous types</SelectItem>
            {gameTypesHook.items.map((t) => (
              <SelectItem key={t.code} value={t.code}>{t.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Statut" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous statuts</SelectItem>
            {gameStatusesHook.items.map((s) => (
              <SelectItem key={s.code} value={s.code}>{s.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={yearFilter} onValueChange={setYearFilter}>
          <SelectTrigger className="w-32"><SelectValue placeholder="Année" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes années</SelectItem>
            {years.map((y) => (
              <SelectItem key={y} value={String(y)}>{y}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="ml-auto text-sm text-muted-foreground whitespace-nowrap">
          {filtered.length} résultat(s){rows && rows.length > filtered.length ? ` sur ${rows.length}` : ""}
        </span>
      </div>

      <div className="rounded-lg border border-border bg-card">
        {rows === null ? (
          <TableSkeleton cols={9} />
        ) : filtered.length === 0 ? (
          <div className="p-6">
            <EmptyState message="Aucun Games enregistré." />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead><SortBtn active={sort.key === "name"} dir={sort.dir} onClick={() => toggleSort("name")}>Nom</SortBtn></TableHead>
                <TableHead><SortBtn active={sort.key === "game_type"} dir={sort.dir} onClick={() => toggleSort("game_type")}>Type</SortBtn></TableHead>
                <TableHead><SortBtn active={sort.key === "edition_year"} dir={sort.dir} onClick={() => toggleSort("edition_year")}>Édition</SortBtn></TableHead>
                <TableHead><SortBtn active={sort.key === "host_country"} dir={sort.dir} onClick={() => toggleSort("host_country")}>Pays</SortBtn></TableHead>
                <TableHead><SortBtn active={sort.key === "host_city"} dir={sort.dir} onClick={() => toggleSort("host_city")}>Ville</SortBtn></TableHead>
                <TableHead><SortBtn active={sort.key === "competition_start"} dir={sort.dir} onClick={() => toggleSort("competition_start")}>Début</SortBtn></TableHead>
                <TableHead><SortBtn active={sort.key === "competition_end"} dir={sort.dir} onClick={() => toggleSort("competition_end")}>Fin</SortBtn></TableHead>
                <TableHead><SortBtn active={sort.key === "status"} dir={sort.dir} onClick={() => toggleSort("status")}>Statut</SortBtn></TableHead>
                <TableHead className="w-32 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((g) => {
                const t = gameTypesHook.findItem(g.game_type);
                const s = gameStatusesHook.findItem(g.status);
                return (
                  <TableRow
                    key={g.id}
                    onClick={() => navigate({ to: "/games/$id", params: { id: g.id } })}
                    className="cursor-pointer hover:bg-muted"
                  >
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-3">
                        {g.logo_url ? (
                          <img src={g.logo_url} alt="" className="h-9 w-9 rounded-lg object-cover border border-border bg-white" />
                        ) : (
                          <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center">
                            <Trophy className="h-4 w-4 text-muted-foreground" />
                          </div>
                        )}
                        <div>
                          <div>{g.name}</div>
                          {g.short_name && (
                            <span className="text-xs text-muted-foreground">{g.short_name}</span>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {t && <Badge className={`${clsForCode(g.game_type)} hover:${clsForCode(g.game_type)}`}>{t.label}</Badge>}
                    </TableCell>
                    <TableCell>{g.edition_year}</TableCell>
                    <TableCell className="text-muted-foreground">{g.host_country ?? "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{g.host_city ?? "—"}</TableCell>
                    <TableCell>{fmtDate(g.competition_start)}</TableCell>
                    <TableCell>{fmtDate(g.competition_end)}</TableCell>
                    <TableCell>
                      {s && <Badge className={`${clsForCode(g.status)} hover:${clsForCode(g.status)}`}>{s.label}</Badge>}
                    </TableCell>
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      <Button variant="ghost" size="icon" onClick={() => openEdit(g)} aria-label="Modifier">
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => archive(g)} aria-label="Archiver">
                        <Archive className="h-4 w-4 text-amber-600" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => setDeleteId(g.id)} aria-label="Supprimer">
                        <Trash2 className="h-4 w-4 text-red-600" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>

      <PagerBar page={page} pageCount={pageCount} onChange={setPage} />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-2xl">
          <form onSubmit={submit}>
            <DialogHeader>
              <DialogTitle>{editing ? "Modifier le Games" : "Créer un Games"}</DialogTitle>
              <DialogDescription>Champs marqués * obligatoires.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5 col-span-2">
                  <Label htmlFor="name">Nom *</Label>
                  <Input id="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="short_name">Acronyme</Label>
                  <Input id="short_name" value={form.short_name} onChange={(e) => setForm({ ...form, short_name: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label>Type *</Label>
                  <Select value={form.game_type} onValueChange={(v) => setForm({ ...form, game_type: v as GameType })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {gameTypesHook.items.map((t) => (
                        <SelectItem key={t.code} value={t.code}>{t.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="edition_year">Édition (année) *</Label>
                  <Input id="edition_year" type="number" value={form.edition_year} onChange={(e) => setForm({ ...form, edition_year: Number(e.target.value) })} required />
                </div>
                <div className="space-y-1.5">
                  <Label>Statut</Label>
                  <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as GameStatus })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {gameStatusesHook.items.map((s) => (
                        <SelectItem key={s.code} value={s.code}>{s.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="host_country">Pays hôte</Label>
                  <Input id="host_country" value={form.host_country} onChange={(e) => setForm({ ...form, host_country: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="host_city">Ville hôte</Label>
                  <AddressSearch
                    id="host_city"
                    value={form.host_city}
                    onChange={(v) => setForm({ ...form, host_city: v })}
                    onSelect={(r) =>
                      setForm({
                        ...form,
                        host_city: r.city || r.display_name,
                        host_country: r.country || form.host_country,

                      })
                    }
                    placeholder="Luxembourg, Paris…"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="organizer">Organisateur</Label>
                  <Input id="organizer" value={form.organizer} onChange={(e) => setForm({ ...form, organizer: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="competition_start">Début compét. *</Label>
                  <Input id="competition_start" type="date" value={form.competition_start} onChange={(e) => setForm({ ...form, competition_start: e.target.value })} required />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="competition_end">Fin compét. *</Label>
                  <Input id="competition_end" type="date" value={form.competition_end} onChange={(e) => setForm({ ...form, competition_end: e.target.value })} required />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="closing_date">Clôture</Label>
                  <Input id="closing_date" type="date" value={form.closing_date} onChange={(e) => setForm({ ...form, closing_date: e.target.value })} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="description">Description</Label>
                <Textarea id="description" rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={saving}>Annuler</Button>
              <Button type="submit" disabled={saving} className="bg-primary hover:bg-[var(--cosl-red-dark)]">
                {saving ? "Enregistrement…" : editing ? "Enregistrer" : "Créer"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce Games ?</AlertDialogTitle>
            <AlertDialogDescription>
              Action irréversible. Toutes les sélections, accréditations et plans liés seront supprimés.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-red-600 hover:bg-red-700">Supprimer</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <CsvImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        config={gamesImportConfig}
        onImported={() => load()}
      />
    </div>
  );
}
