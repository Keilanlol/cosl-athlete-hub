import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { friendlyError } from "@/lib/error-messages";
import { useEffect, useMemo, useState } from "react";
import { Pencil, Trash2, Search, GraduationCap, Upload } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { COACH_ROLES, type Coach, type Federation } from "@/lib/types";
import { EntityImageUpload } from "@/components/EntityImageUpload";
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
import { AddPersonButton } from "@/components/persons/AddPersonButton";
import { CsvImportDialog } from "@/components/CsvImportDialog";
import { coachesImportConfig } from "@/lib/csv-import-configs";

export const Route = createFileRoute("/_authenticated/coaches/")({
  component: CoachesPage,
});

type SortKey = "first_name" | "last_name" | "email" | "phone" | "role" | "is_active";

const NONE = "__none__";
const empty = {
  first_name: "",
  last_name: "",
  email: "",
  phone: "",
  role: "coach",
  federation_id: NONE,
  is_active: true,
};

function roleLabel(v: string) {
  return COACH_ROLES.find((r) => r.value === v)?.label ?? v;
}

function CoachesPage() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<Coach[] | null>(null);
  const [feds, setFeds] = useState<Federation[]>([]);
  const [games, setGames] = useState<{ id: string; name: string; short_name: string | null }[]>([]);
  const [gameCoachIds, setGameCoachIds] = useState<string[] | null>(null);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [fedFilter, setFedFilter] = useState<string>("all");
  const [gameFilter, setGameFilter] = useState<string>("all");
  const [activeFilter, setActiveFilter] = useState<string>("all");
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({
    key: "last_name",
    dir: "asc",
  });
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(false);
  
  const [editing, setEditing] = useState<Coach | null>(null);
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);

  const fedMap = useMemo(() => {
    const m = new Map<string, Federation>();
    feds.forEach((f) => m.set(f.id, f));
    return m;
  }, [feds]);
  const load = async () => {
    setRows(null);
    const [c, f, gm] = await Promise.all([
      supabase.from("coaches").select("*").order("last_name"),
      supabase.from("federations").select("*").order("acronym"),
      supabase.from("games").select("id, name, short_name").order("name"),
    ]);
    if (c.error || f.error) {
      toast.error("Erreur de chargement", {
        description: (c.error ?? f.error)?.message,
      });
      setRows([]);
      return;
    }
    setRows((c.data ?? []) as Coach[]);
    setFeds((f.data ?? []) as Federation[]);
    setGames((gm.data ?? []) as { id: string; name: string; short_name: string | null }[]);
  };

  useEffect(() => {
    load();
  }, []);

  // Load coach IDs for the selected game
  useEffect(() => {
    if (gameFilter === "all") {
      setGameCoachIds(null);
      return;
    }
    (async () => {
      const { data: links } = await supabase
        .from("v_persons_in_games")
        .select("person_id")
        .eq("game_id", gameFilter);
      const personIds = (links ?? []).map((r) => r.person_id as string);
      if (personIds.length === 0) {
        setGameCoachIds([]);
        return;
      }
      const { data: cps } = await supabase
        .from("coach_profiles")
        .select("legacy_coach_id")
        .in("person_id", personIds);
      setGameCoachIds((cps ?? []).map((c) => c.legacy_coach_id as string).filter(Boolean));
    })();
  }, [gameFilter]);

  const filtered = useMemo(() => {
    if (!rows) return [];
    const q = search.trim().toLowerCase();
    let r = rows.slice();
    if (gameCoachIds !== null) r = r.filter((c) => gameCoachIds.includes(c.id));
    if (roleFilter !== "all") r = r.filter((c) => c.role === roleFilter);
    if (fedFilter !== "all") r = r.filter((c) => c.federation_id === fedFilter);
    if (activeFilter === "active") r = r.filter((c) => c.is_active);
    if (activeFilter === "inactive") r = r.filter((c) => !c.is_active);
    if (q)
      r = r.filter((c) =>
        `${c.first_name} ${c.last_name}`.toLowerCase().includes(q),
      );
    r.sort((a, b) => {
      const av = (a[sort.key] ?? "").toString().toLowerCase();
      const bv = (b[sort.key] ?? "").toString().toLowerCase();
      const cmp = av.localeCompare(bv);
      return sort.dir === "asc" ? cmp : -cmp;
    });
    return r;
  }, [rows, search, roleFilter, fedFilter, activeFilter, sort, gameCoachIds]);

  useEffect(() => { setPage(1); }, [search, roleFilter, fedFilter, activeFilter]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const visible = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  useEffect(() => {
    if (page > pageCount) setPage(1);
  }, [pageCount, page]);

  const toggleSort = (key: SortKey) =>
    setSort((s) =>
      s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" },
    );

  const openCreate = () => {
    setEditing(null);
    setForm(empty);
    setOpen(true);
  };

  const openEdit = (c: Coach) => {
    setEditing(c);
    setForm({
      first_name: c.first_name,
      last_name: c.last_name,
      email: c.email ?? "",
      phone: c.phone ?? "",
      role: c.role,
      federation_id: c.federation_id ?? NONE,
      is_active: c.is_active ?? true,
    });
    setOpen(true);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.first_name.trim() || !form.last_name.trim() || !form.role) {
      toast.error("Prénom, nom et rôle requis");
      return;
    }
    setSaving(true);
    const payload = {
      first_name: form.first_name.trim(),
      last_name: form.last_name.trim(),
      email: form.email.trim() || null,
      phone: form.phone.trim() || null,
      role: form.role,
      federation_id: form.federation_id === NONE ? null : form.federation_id,
      is_active: form.is_active,
    };
    const { error } = editing
      ? await supabase.from("coaches").update(payload).eq("id", editing.id)
      : await supabase.from("coaches").insert(payload);
    setSaving(false);
    if (error) {
      toast.error("Échec de l'enregistrement", { description: friendlyError(error) });
      return;
    }
    toast.success(editing ? "Encadrant modifié" : "Encadrant ajouté");
    setOpen(false);
    load();
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    const { error } = await supabase.from("coaches").delete().eq("id", deleteId);
    if (error) toast.error("Suppression impossible", { description: friendlyError(error) });
    else {
      toast.success("Encadrant supprimé");
      load();
    }
    setDeleteId(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-white">
            <GraduationCap className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Encadrants</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Coachs, managers, personnel médical et officiels.
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setImportOpen(true)}>
            <Upload className="mr-2 h-4 w-4" /> Importer
          </Button>
          <AddPersonButton
            role="coach"
            label="Ajouter un encadrant"
            onChanged={(personId) => {
              load();
              navigate({ to: "/persons/$personId", params: { personId } });
            }}
          />
        </div>
      </div>


      <div className="flex flex-wrap items-center gap-3">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Rechercher par nom…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Tous les rôles" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les rôles</SelectItem>
            {COACH_ROLES.map((r) => (
              <SelectItem key={r.value} value={r.value}>
                {r.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={fedFilter} onValueChange={setFedFilter}>
          <SelectTrigger className="w-[220px]">
            <SelectValue placeholder="Toutes les fédérations" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes les fédérations</SelectItem>
            {feds.map((f) => (
              <SelectItem key={f.id} value={f.id}>
                {f.acronym} — {f.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={gameFilter} onValueChange={setGameFilter}>
          <SelectTrigger className="w-[200px]"><SelectValue placeholder="Games" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les Games</SelectItem>
            {games.map((g) => (
              <SelectItem key={g.id} value={g.id}>{g.short_name ?? g.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={activeFilter} onValueChange={setActiveFilter}>
          <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous</SelectItem>
            <SelectItem value="active">Actifs</SelectItem>
            <SelectItem value="inactive">Inactifs</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-sm text-muted-foreground whitespace-nowrap">
          {filtered.length} résultat(s){rows && rows.length > filtered.length ? ` sur ${rows.length}` : ""}
        </span>
      </div>

      <div className="rounded-lg border border-border bg-card">
        {rows === null ? (
          <TableSkeleton cols={9} />
        ) : filtered.length === 0 ? (
          <div className="p-6">
            <EmptyState message="Aucun encadrant enregistré." />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-14"></TableHead>
                <TableHead>
                  <SortBtn active={sort.key === "first_name"} dir={sort.dir} onClick={() => toggleSort("first_name")}>
                    Prénom
                  </SortBtn>
                </TableHead>
                <TableHead>
                  <SortBtn active={sort.key === "last_name"} dir={sort.dir} onClick={() => toggleSort("last_name")}>
                    Nom
                  </SortBtn>
                </TableHead>
                <TableHead><SortBtn active={sort.key === "email"} dir={sort.dir} onClick={() => toggleSort("email")}>Email</SortBtn></TableHead>
                <TableHead><SortBtn active={sort.key === "phone"} dir={sort.dir} onClick={() => toggleSort("phone")}>Téléphone</SortBtn></TableHead>
                <TableHead>
                  <SortBtn active={sort.key === "role"} dir={sort.dir} onClick={() => toggleSort("role")}>
                    Rôle
                  </SortBtn>
                </TableHead>
                <TableHead>Fédération</TableHead>
                <TableHead><SortBtn active={sort.key === "is_active"} dir={sort.dir} onClick={() => toggleSort("is_active")}>Actif</SortBtn></TableHead>
                <TableHead className="w-24 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((c) => {
                const f = c.federation_id ? fedMap.get(c.federation_id) : null;
                return (
                  <TableRow
                    key={c.id}
                    onClick={() => navigate({ to: "/coaches/$id", params: { id: c.id } })}
                    className="cursor-pointer hover:bg-muted"
                  >
                    <TableCell>
                      <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border border-border bg-muted">
                        {c.photo_url ? (
                          <img src={c.photo_url} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <span className="text-xs font-semibold text-muted-foreground">
                            {(c.first_name[0] ?? "") + (c.last_name[0] ?? "")}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{c.first_name}</TableCell>
                    <TableCell className="font-medium">{c.last_name}</TableCell>
                    <TableCell className="text-muted-foreground">{c.email ?? "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{c.phone ?? "—"}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{roleLabel(c.role)}</Badge>
                    </TableCell>
                    <TableCell>
                      {f ? (
                        <Badge variant="outline" className="font-mono">
                          {f.acronym}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {c.is_active ? (
                        <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
                          Actif
                        </Badge>
                      ) : (
                        <Badge variant="outline">Inactif</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEdit(c)}
                        aria-label="Modifier"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setDeleteId(c.id)}
                        aria-label="Supprimer"
                      >
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
        <DialogContent className="sm:max-w-lg">
          <form onSubmit={submit}>
            <DialogHeader>
              <DialogTitle>
                {editing ? "Modifier l'encadrant" : "Ajouter un encadrant"}
              </DialogTitle>
              <DialogDescription>
                Prénom, nom et rôle sont obligatoires.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              {editing && (
                <div className="flex justify-center pb-2">
                  <EntityImageUpload
                    entityId={editing.id}
                    entityType="coach"
                    currentImageUrl={editing.photo_url}
                    currentStoragePath={editing.photo_storage_path}
                    shape="circle"
                    size="lg"
                    label="Photo"
                    placeholder={(editing.first_name[0] ?? "") + (editing.last_name[0] ?? "")}
                    onUploaded={async (url, path) => {
                      await supabase
                        .from("coaches")
                        .update({ photo_url: url, photo_storage_path: path })
                        .eq("id", editing.id);
                      setEditing((e) => (e ? { ...e, photo_url: url, photo_storage_path: path } : e));
                      load();
                    }}
                    onDeleted={async () => {
                      await supabase
                        .from("coaches")
                        .update({ photo_url: null, photo_storage_path: null })
                        .eq("id", editing.id);
                      setEditing((e) => (e ? { ...e, photo_url: null, photo_storage_path: null } : e));
                      load();
                    }}
                  />
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="fn">Prénom *</Label>
                  <Input
                    id="fn"
                    value={form.first_name}
                    onChange={(e) => setForm({ ...form, first_name: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ln">Nom *</Label>
                  <Input
                    id="ln"
                    value={form.last_name}
                    onChange={(e) => setForm({ ...form, last_name: e.target.value })}
                    required
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="em">Email</Label>
                  <Input
                    id="em"
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ph">Téléphone</Label>
                  <Input
                    id="ph"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="rl">Rôle *</Label>
                <Select
                  value={form.role}
                  onValueChange={(v) => setForm({ ...form, role: v })}
                >
                  <SelectTrigger id="rl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {COACH_ROLES.map((r) => (
                      <SelectItem key={r.value} value={r.value}>
                        {r.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="fd">Fédération</Label>
                  <Select
                    value={form.federation_id}
                    onValueChange={(v) =>
                      setForm({ ...form, federation_id: v })
                    }
                  >
                    <SelectTrigger id="fd">
                      <SelectValue placeholder="—" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>Aucune</SelectItem>
                      {feds.map((f) => (
                        <SelectItem key={f.id} value={f.id}>
                          {f.acronym}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
                <Label htmlFor="act" className="cursor-pointer">
                  Encadrant actif
                </Label>
                <Switch
                  id="act"
                  checked={form.is_active}
                  onCheckedChange={(v) => setForm({ ...form, is_active: v })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={saving}
              >
                Annuler
              </Button>
              <Button
                type="submit"
                disabled={saving}
                className="bg-primary hover:bg-[var(--cosl-red-dark)]"
              >
                {saving ? "Enregistrement…" : editing ? "Enregistrer" : "Ajouter"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cet encadrant ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible.
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

      <CsvImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        config={coachesImportConfig}
        onImported={() => load()}
      />
    </div>
  );
}
