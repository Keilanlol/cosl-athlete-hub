import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Plus, Pencil, Trash2, Search } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import type { Club, Federation } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AddressSearch } from "@/components/AddressSearch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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

export const Route = createFileRoute("/_authenticated/clubs/")({
  component: ClubsPage,
});

type SortKey = "name" | "city";

const empty = {
  name: "",
  federation_id: "",
  city: "",
  address: "",
  email: "",
  phone: "",
};

function ClubsPage() {
  const [rows, setRows] = useState<Club[] | null>(null);
  const [feds, setFeds] = useState<Federation[]>([]);
  const [search, setSearch] = useState("");
  const [fedFilter, setFedFilter] = useState<string>("all");
  const [cityFilter, setCityFilter] = useState<string>("all");
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({
    key: "name",
    dir: "asc",
  });
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Club | null>(null);
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const fedMap = useMemo(() => {
    const m = new Map<string, Federation>();
    feds.forEach((f) => m.set(f.id, f));
    return m;
  }, [feds]);

  const load = async () => {
    setRows(null);
    const [{ data: cd, error: ce }, { data: fd, error: fe }] = await Promise.all([
      supabase.from("clubs").select("*").order("name"),
      supabase.from("federations").select("*").order("acronym"),
    ]);
    if (ce || fe) {
      toast.error("Erreur de chargement", {
        description: (ce ?? fe)?.message,
      });
      setRows([]);
      return;
    }
    setRows((cd ?? []) as Club[]);
    setFeds((fd ?? []) as Federation[]);
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    if (!rows) return [];
    const q = search.trim().toLowerCase();
    let r = rows.slice();
    if (fedFilter !== "all") r = r.filter((c) => c.federation_id === fedFilter);
    if (q) r = r.filter((c) => c.name.toLowerCase().includes(q));
    r.sort((a, b) => {
      const av = (a[sort.key] ?? "").toString().toLowerCase();
      const bv = (b[sort.key] ?? "").toString().toLowerCase();
      const cmp = av.localeCompare(bv);
      return sort.dir === "asc" ? cmp : -cmp;
    });
    return r;
  }, [rows, search, fedFilter, sort]);

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

  const openEdit = (c: Club) => {
    setEditing(c);
    setForm({
      name: c.name,
      federation_id: c.federation_id,
      city: c.city ?? "",
      address: c.address ?? "",
      email: c.email ?? "",
      phone: c.phone ?? "",
    });
    setOpen(true);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.federation_id) {
      toast.error("Nom et fédération requis");
      return;
    }
    setSaving(true);
    const payload = {
      name: form.name.trim(),
      federation_id: form.federation_id,
      city: form.city.trim() || null,
      address: form.address.trim() || null,
      email: form.email.trim() || null,
      phone: form.phone.trim() || null,
    };
    const { error } = editing
      ? await supabase.from("clubs").update(payload).eq("id", editing.id)
      : await supabase.from("clubs").insert(payload);
    setSaving(false);
    if (error) {
      toast.error("Échec de l'enregistrement", { description: error.message });
      return;
    }
    toast.success(editing ? "Club modifié" : "Club ajouté");
    setOpen(false);
    load();
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    const { error } = await supabase.from("clubs").delete().eq("id", deleteId);
    if (error) toast.error("Suppression impossible", { description: error.message });
    else {
      toast.success("Club supprimé");
      load();
    }
    setDeleteId(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Clubs</h1>
          <p className="mt-1 text-sm text-slate-600">
            Clubs affiliés aux fédérations nationales.
          </p>
        </div>
        <Button onClick={openCreate} className="bg-indigo-500 hover:bg-indigo-600">
          <Plus className="mr-2 h-4 w-4" />
          Ajouter un club
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            placeholder="Rechercher par nom…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={fedFilter} onValueChange={setFedFilter}>
          <SelectTrigger className="w-[240px]">
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
        <span className="text-sm text-slate-500">{filtered.length} résultat(s)</span>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white">
        {rows === null ? (
          <TableSkeleton cols={6} />
        ) : filtered.length === 0 ? (
          <div className="p-6">
            <EmptyState message="Aucun club enregistré." />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>
                  <SortBtn
                    active={sort.key === "name"}
                    dir={sort.dir}
                    onClick={() => toggleSort("name")}
                  >
                    Nom
                  </SortBtn>
                </TableHead>
                <TableHead>Fédération</TableHead>
                <TableHead>
                  <SortBtn
                    active={sort.key === "city"}
                    dir={sort.dir}
                    onClick={() => toggleSort("city")}
                  >
                    Ville
                  </SortBtn>
                </TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Téléphone</TableHead>
                <TableHead className="w-24 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((c) => {
                const f = fedMap.get(c.federation_id);
                return (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">
                      <Link
                        to="/clubs/$id"
                        params={{ id: c.id }}
                        className="text-indigo-600 hover:underline"
                      >
                        {c.name}
                      </Link>
                    </TableCell>
                    <TableCell>
                      {f ? (
                        <Link to="/federations/$id" params={{ id: f.id }}>
                          <Badge variant="outline" className="font-mono hover:bg-slate-100">
                            {f.acronym}
                          </Badge>
                        </Link>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-slate-600">{c.city ?? "—"}</TableCell>
                    <TableCell className="text-slate-600">{c.email ?? "—"}</TableCell>
                    <TableCell className="text-slate-600">{c.phone ?? "—"}</TableCell>
                    <TableCell className="text-right">
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
                {editing ? "Modifier le club" : "Ajouter un club"}
              </DialogTitle>
              <DialogDescription>
                Nom et fédération sont obligatoires.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-1.5">
                <Label htmlFor="cname">Nom *</Label>
                <Input
                  id="cname"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cfed">Fédération *</Label>
                <Select
                  value={form.federation_id}
                  onValueChange={(v) => setForm({ ...form, federation_id: v })}
                >
                  <SelectTrigger id="cfed">
                    <SelectValue placeholder="Sélectionner…" />
                  </SelectTrigger>
                  <SelectContent>
                    {feds.map((f) => (
                      <SelectItem key={f.id} value={f.id}>
                        {f.acronym} — {f.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="ccity">Ville</Label>
                  <Input
                    id="ccity"
                    value={form.city}
                    onChange={(e) => setForm({ ...form, city: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="cphone">Téléphone</Label>
                  <Input
                    id="cphone"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="caddr">Adresse</Label>
                <AddressSearch
                  id="caddr"
                  value={form.address}
                  onChange={(v) => setForm({ ...form, address: v })}
                  onSelect={(r) => setForm({ ...form, address: r.display_name })}
                  placeholder="Rue, ville, pays…"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cemail">Email</Label>
                <Input
                  id="cemail"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
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
                className="bg-indigo-500 hover:bg-indigo-600"
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
            <AlertDialogTitle>Supprimer ce club ?</AlertDialogTitle>
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
    </div>
  );
}
