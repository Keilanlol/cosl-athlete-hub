import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { friendlyError } from "@/lib/error-messages";
import { useEffect, useMemo, useState } from "react";
import { Plus, Pencil, Trash2, Search } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import type { Federation } from "@/lib/types";
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

export const Route = createFileRoute("/_authenticated/federations/")({
  component: FederationsPage,
});

type SortKey = "acronym" | "name" | "president_name";

const empty = {
  acronym: "",
  name: "",
  president_name: "",
  contact_email: "",
  contact_phone: "",
  international_federation: "",
  is_olympic: true,
};

function FederationsPage() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<Federation[] | null>(null);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({
    key: "acronym",
    dir: "asc",
  });
  const [page, setPage] = useState(1);
  const [olympicFilter, setOlympicFilter] = useState<string>("all");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Federation | null>(null);
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const load = async () => {
    setRows(null);
    const { data, error } = await supabase
      .from("federations")
      .select("*")
      .order("acronym");
    if (error) {
      toast.error("Erreur de chargement", { description: friendlyError(error) });
      setRows([]);
      return;
    }
    setRows((data ?? []) as Federation[]);
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    if (!rows) return [];
    const q = search.trim().toLowerCase();
    let r = q
      ? rows.filter(
          (f) =>
            f.name.toLowerCase().includes(q) ||
            f.acronym.toLowerCase().includes(q) ||
            (f.president_name ?? "").toLowerCase().includes(q),
        )
      : rows.slice();
    if (olympicFilter === "olympic") r = r.filter((f) => f.is_olympic);
    if (olympicFilter === "non") r = r.filter((f) => !f.is_olympic);
    r.sort((a, b) => {
      const av = (a[sort.key] ?? "").toString().toLowerCase();
      const bv = (b[sort.key] ?? "").toString().toLowerCase();
      const cmp = av.localeCompare(bv);
      return sort.dir === "asc" ? cmp : -cmp;
    });
    return r;
  }, [rows, search, olympicFilter, sort]);

  useEffect(() => { setPage(1); }, [search, olympicFilter]);

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

  const openEdit = (f: Federation) => {
    setEditing(f);
    setForm({
      acronym: f.acronym,
      name: f.name,
      president_name: f.president_name ?? "",
      contact_email: f.contact_email ?? "",
      contact_phone: f.contact_phone ?? "",
      international_federation: f.international_federation ?? "",
      is_olympic: f.is_olympic ?? true,
    });
    setOpen(true);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.acronym.trim() || !form.name.trim()) {
      toast.error("Acronyme et nom requis");
      return;
    }
    setSaving(true);
    const payload = {
      acronym: form.acronym.trim(),
      name: form.name.trim(),
      president_name: form.president_name.trim() || null,
      contact_email: form.contact_email.trim() || null,
      contact_phone: form.contact_phone.trim() || null,
      international_federation: form.international_federation.trim() || null,
      is_olympic: form.is_olympic,
    };
    const { error } = editing
      ? await supabase.from("federations").update(payload).eq("id", editing.id)
      : await supabase.from("federations").insert(payload);
    setSaving(false);
    if (error) {
      toast.error("Échec de l'enregistrement", { description: friendlyError(error) });
      return;
    }
    toast.success(editing ? "Fédération modifiée" : "Fédération ajoutée");
    setOpen(false);
    load();
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    const { count, error: ce } = await supabase
      .from("clubs")
      .select("id", { count: "exact", head: true })
      .eq("federation_id", deleteId);
    if (ce) {
      toast.error("Suppression impossible", { description: friendlyError(ce) });
      setDeleteId(null);
      return;
    }
    if ((count ?? 0) > 0) {
      toast.error("Suppression impossible", {
        description: `Cette fédération a encore ${count} club(s) rattaché(s). Supprimez-les d'abord.`,
      });
      setDeleteId(null);
      return;
    }
    const { error } = await supabase.from("federations").delete().eq("id", deleteId);
    if (error) {
      toast.error("Suppression impossible", { description: friendlyError(error) });
    } else {
      toast.success("Fédération supprimée");
      load();
    }
    setDeleteId(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Fédérations</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Fédérations sportives nationales du COSL.
          </p>
        </div>
        <Button onClick={openCreate} className="bg-primary hover:bg-[var(--cosl-red-dark)]">
          <Plus className="mr-2 h-4 w-4" />
          Ajouter une fédération
        </Button>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Rechercher par nom ou acronyme…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={olympicFilter} onValueChange={setOlympicFilter}>
          <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes les fédérations</SelectItem>
            <SelectItem value="olympic">Olympiques</SelectItem>
            <SelectItem value="non">Non olympiques</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-sm text-muted-foreground">{filtered.length} résultat(s)</span>
      </div>

      <div className="rounded-lg border border-border bg-card">
        {rows === null ? (
          <TableSkeleton cols={7} />
        ) : filtered.length === 0 ? (
          <div className="p-6">
            <EmptyState message="Aucune fédération enregistrée." />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-14"></TableHead>
                <TableHead>
                  <SortBtn
                    active={sort.key === "acronym"}
                    dir={sort.dir}
                    onClick={() => toggleSort("acronym")}
                  >
                    Acronyme
                  </SortBtn>
                </TableHead>
                <TableHead>
                  <SortBtn
                    active={sort.key === "name"}
                    dir={sort.dir}
                    onClick={() => toggleSort("name")}
                  >
                    Nom
                  </SortBtn>
                </TableHead>
                <TableHead>
                  <SortBtn
                    active={sort.key === "president_name"}
                    dir={sort.dir}
                    onClick={() => toggleSort("president_name")}
                  >
                    Président
                  </SortBtn>
                </TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Téléphone</TableHead>
                <TableHead>Olympique</TableHead>
                <TableHead className="w-24 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((f) => (
                <TableRow
                  key={f.id}
                  onClick={() => navigate({ to: "/federations/$id", params: { id: f.id } })}
                  className="cursor-pointer hover:bg-muted"
                >
                  <TableCell>
                    <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-md border border-border bg-muted">
                      {f.logo_url ? (
                        <img src={f.logo_url} alt={f.acronym} className="h-full w-full object-contain p-0.5" />
                      ) : (
                        <span className="text-[10px] font-semibold text-muted-foreground">{f.acronym?.slice(0, 3)}</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-sm font-medium">{f.acronym}</TableCell>
                  <TableCell>{f.name}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {f.president_name ?? "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {f.contact_email ?? "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {f.contact_phone ?? "—"}
                  </TableCell>
                  <TableCell>
                    {f.is_olympic ? (
                      <Badge className="bg-[var(--cosl-red-light)] text-primary hover:bg-[var(--cosl-red-light)]">
                        Olympique
                      </Badge>
                    ) : (
                      <Badge variant="outline">Non</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openEdit(f)}
                      aria-label="Modifier"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setDeleteId(f.id)}
                      aria-label="Supprimer"
                    >
                      <Trash2 className="h-4 w-4 text-red-600" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
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
                {editing ? "Modifier la fédération" : "Ajouter une fédération"}
              </DialogTitle>
              <DialogDescription>
                Les champs acronyme et nom sont obligatoires.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              {editing && (
                <div className="flex justify-center pb-2">
                  <EntityImageUpload
                    entityId={editing.id}
                    entityType="federation"
                    currentImageUrl={editing.logo_url}
                    currentStoragePath={editing.logo_storage_path}
                    shape="square"
                    size="lg"
                    label="Logo de la fédération"
                    placeholder={editing.acronym?.slice(0, 3)}
                    onUploaded={async (url, path) => {
                      await supabase
                        .from("federations")
                        .update({ logo_url: url, logo_storage_path: path })
                        .eq("id", editing.id);
                      setEditing((e) => (e ? { ...e, logo_url: url, logo_storage_path: path } : e));
                      load();
                    }}
                    onDeleted={async () => {
                      await supabase
                        .from("federations")
                        .update({ logo_url: null, logo_storage_path: null })
                        .eq("id", editing.id);
                      setEditing((e) => (e ? { ...e, logo_url: null, logo_storage_path: null } : e));
                      load();
                    }}
                  />
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="acronym">Acronyme *</Label>
                  <Input
                    id="acronym"
                    value={form.acronym}
                    onChange={(e) => setForm({ ...form, acronym: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="name">Nom *</Label>
                  <Input
                    id="name"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    required
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="president_name">Président</Label>
                <Input
                  id="president_name"
                  value={form.president_name}
                  onChange={(e) =>
                    setForm({ ...form, president_name: e.target.value })
                  }
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="contact_email">Email</Label>
                  <Input
                    id="contact_email"
                    type="email"
                    value={form.contact_email}
                    onChange={(e) =>
                      setForm({ ...form, contact_email: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="contact_phone">Téléphone</Label>
                  <Input
                    id="contact_phone"
                    value={form.contact_phone}
                    onChange={(e) =>
                      setForm({ ...form, contact_phone: e.target.value })
                    }
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="if">Fédération internationale</Label>
                <Input
                  id="if"
                  value={form.international_federation}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      international_federation: e.target.value,
                    })
                  }
                />
              </div>
              <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
                <Label htmlFor="is_olympic" className="cursor-pointer">
                  Fédération olympique
                </Label>
                <Switch
                  id="is_olympic"
                  checked={form.is_olympic}
                  onCheckedChange={(v) => setForm({ ...form, is_olympic: v })}
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
            <AlertDialogTitle>Supprimer cette fédération ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible. Les clubs liés empêcheront la
              suppression.
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
