import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Plus, Pencil, Trash2, Search, Archive, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import {
  type Game,
  type GameStatus,
  type GameType,
  GAME_STATUSES,
  GAME_TYPES,
} from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  TableSkeleton,
} from "@/components/DataTableShell";

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

function GamesListPage() {
  const [rows, setRows] = useState<Game[] | null>(null);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [yearFilter, setYearFilter] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Game | null>(null);
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const load = async () => {
    setRows(null);
    const { data, error } = await supabase
      .from("games")
      .select("*")
      .order("competition_start", { ascending: false });
    if (error) {
      toast.error("Erreur de chargement", { description: error.message });
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
    return rows.filter((g) => {
      if (typeFilter !== "all" && g.game_type !== typeFilter) return false;
      if (statusFilter !== "all" && g.status !== statusFilter) return false;
      if (yearFilter !== "all" && String(g.edition_year) !== yearFilter) return false;
      if (q && !g.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [rows, search, typeFilter, statusFilter, yearFilter]);

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
      toast.error("Échec de l'enregistrement", { description: error.message });
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
    if (error) toast.error("Échec", { description: error.message });
    else {
      toast.success("Games archivé");
      load();
    }
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    const { error } = await supabase.from("games").delete().eq("id", deleteId);
    if (error) toast.error("Suppression impossible", { description: error.message });
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
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Games</h1>
          <p className="mt-1 text-sm text-slate-600">
            Événements multi-sports : JO, JPEE, EYOF, JOJ…
          </p>
        </div>
        <Button onClick={openCreate} className="bg-indigo-500 hover:bg-indigo-600">
          <Plus className="mr-2 h-4 w-4" />
          Créer un Games
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative max-w-sm flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
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
            {GAME_TYPES.map((t) => (
              <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Statut" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous statuts</SelectItem>
            {GAME_STATUSES.map((s) => (
              <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
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
        <span className="ml-auto text-sm text-slate-500">{filtered.length} résultat(s)</span>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white">
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
                <TableHead>Nom</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Édition</TableHead>
                <TableHead>Pays</TableHead>
                <TableHead>Ville</TableHead>
                <TableHead>Début</TableHead>
                <TableHead>Fin</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead className="w-32 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((g) => {
                const t = GAME_TYPES.find((x) => x.value === g.game_type);
                const s = GAME_STATUSES.find((x) => x.value === g.status);
                return (
                  <TableRow key={g.id}>
                    <TableCell className="font-medium">
                      <Link
                        to="/games/$id"
                        params={{ id: g.id }}
                        className="text-indigo-600 hover:underline inline-flex items-center gap-1"
                      >
                        {g.name}
                        <ExternalLink className="h-3 w-3" />
                      </Link>
                      {g.short_name && (
                        <span className="ml-2 text-xs text-slate-500">{g.short_name}</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {t && <Badge className={`${t.cls} hover:${t.cls}`}>{t.label}</Badge>}
                    </TableCell>
                    <TableCell>{g.edition_year}</TableCell>
                    <TableCell className="text-slate-600">{g.host_country ?? "—"}</TableCell>
                    <TableCell className="text-slate-600">{g.host_city ?? "—"}</TableCell>
                    <TableCell>{fmtDate(g.competition_start)}</TableCell>
                    <TableCell>{fmtDate(g.competition_end)}</TableCell>
                    <TableCell>
                      {s && <Badge className={`${s.cls} hover:${s.cls}`}>{s.label}</Badge>}
                    </TableCell>
                    <TableCell className="text-right">
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
                      {GAME_TYPES.map((t) => (
                        <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
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
                      {GAME_STATUSES.map((s) => (
                        <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
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
                  <Input id="host_city" value={form.host_city} onChange={(e) => setForm({ ...form, host_city: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="organizer">Organisateur</Label>
                  <Input id="organizer" value={form.organizer} onChange={(e) => setForm({ ...form, organizer: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-4 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="preparation_start">Préparation</Label>
                  <Input id="preparation_start" type="date" value={form.preparation_start} onChange={(e) => setForm({ ...form, preparation_start: e.target.value })} />
                </div>
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
              <Button type="submit" disabled={saving} className="bg-indigo-500 hover:bg-indigo-600">
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
    </div>
  );
}
