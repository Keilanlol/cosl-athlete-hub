import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2, Search } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { friendlyError } from "@/lib/error-messages";
import { confirmAction } from "@/components/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { TableSkeleton, EmptyState } from "@/components/DataTableShell";
import { PersonCombobox } from "@/components/PersonCombobox";
import { PersonCreateDialog } from "@/components/persons/PersonCreateDialog";
import type { PersonListItem } from "@/lib/persons";

export const Route = createFileRoute("/_authenticated/games/$id/volunteers")({
  component: VolunteersPage,
});

type Volunteer = {
  id: string;
  game_id: string;
  person_id: string;
  function: string | null;
  notes: string | null;
  person: {
    id: string;
    first_name: string;
    last_name: string;
    email: string | null;
    phone: string | null;
  } | null;
};

function VolunteersPage() {
  const { id: gameId } = Route.useParams();
  const [rows, setRows] = useState<Volunteer[] | null>(null);
  const [pool, setPool] = useState<PersonListItem[]>([]);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ person_id: "", function: "", notes: "" });
  const [saving, setSaving] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  const load = async () => {
    setRows(null);
    const [vRes, pRes] = await Promise.all([
      supabase
        .from("game_volunteers")
        .select("*, person:persons(id,first_name,last_name,email,phone)")
        .eq("game_id", gameId)
        .order("created_at", { ascending: false }),
      supabase
        .from("v_persons_with_roles")
        .select("*")
        .order("last_name"),
    ]);
    if (vRes.error) {
      toast.error("Erreur de chargement", { description: friendlyError(vRes.error) });
      setRows([]);
      return;
    }
    setRows((vRes.data ?? []) as unknown as Volunteer[]);
    setPool(((pRes.data ?? []) as PersonListItem[]).filter((p) =>
      (p.roles ?? []).includes("volunteer"),
    ));
  };

  useEffect(() => { load(); }, [gameId]);

  const alreadyLinked = useMemo(
    () => new Set((rows ?? []).map((r) => r.person_id)),
    [rows],
  );

  const options = useMemo(
    () => [
      { id: "__new__", label: "+ Créer une nouvelle personne" },
      ...pool
        .filter((p) => !alreadyLinked.has(p.id))
        .map((p) => ({
          id: p.id,
          label: `${p.first_name} ${p.last_name}${p.email ? ` — ${p.email}` : ""}`,
        })),
    ],
    [pool, alreadyLinked],
  );

  const filtered = useMemo(() => {
    if (!rows) return [];
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => {
      const p = r.person;
      const hay = `${p?.first_name ?? ""} ${p?.last_name ?? ""} ${p?.email ?? ""} ${r.function ?? ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [rows, search]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.person_id || form.person_id === "__new__") {
      toast.error("Sélectionnez un bénévole.");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("game_volunteers").insert({
      game_id: gameId,
      person_id: form.person_id,
      function: form.function.trim() || null,
      notes: form.notes.trim() || null,
    });
    setSaving(false);
    if (error) {
      toast.error("Échec", { description: friendlyError(error) });
      return;
    }
    toast.success("Bénévole ajouté");
    setOpen(false);
    setForm({ person_id: "", function: "", notes: "" });
    load();
  };

  const remove = async (v: Volunteer) => {
    if (!(await confirmAction({
      title: "Retirer ce bénévole ?",
      description: "Le bénévole sera retiré du Games.",
      confirmLabel: "Retirer",
    }))) return;
    const { error } = await supabase.from("game_volunteers").delete().eq("id", v.id);
    if (error) toast.error("Échec", { description: friendlyError(error) });
    else { toast.success("Bénévole retiré"); load(); }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Rechercher…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <span className="text-sm text-muted-foreground">{filtered.length} bénévole(s)</span>
        <div className="ml-auto">
          <Button onClick={() => setOpen(true)} className="bg-primary hover:bg-[var(--cosl-red-dark)]">
            <Plus className="mr-2 h-4 w-4" /> Ajouter un bénévole
          </Button>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card">
        {rows === null ? (
          <TableSkeleton cols={5} />
        ) : filtered.length === 0 ? (
          <div className="p-6"><EmptyState message="Aucun bénévole pour ce Games." /></div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nom</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Téléphone</TableHead>
                <TableHead>Fonction</TableHead>
                <TableHead className="w-20 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((v) => (
                <TableRow key={v.id}>
                  <TableCell className="font-medium">
                    {v.person ? `${v.person.first_name} ${v.person.last_name}` : "—"}
                    <Badge variant="outline" className="ml-2 border-purple-200 bg-purple-100 text-purple-700">
                      Bénévole
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{v.person?.email ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{v.person?.phone ?? "—"}</TableCell>
                  <TableCell>{v.function ?? "—"}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => remove(v)} aria-label="Retirer">
                      <Trash2 className="h-4 w-4 text-red-600" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg overflow-hidden">
          <form onSubmit={submit}>
            <DialogHeader>
              <DialogTitle>Ajouter un bénévole</DialogTitle>
              <DialogDescription>
                Seules les personnes ayant le rôle <strong>Bénévole</strong> sont proposées.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-1.5">
                <Label>Bénévole *</Label>
                <PersonCombobox
                  value={form.person_id}
                  onChange={(v) => {
                    if (v === "__new__") {
                      setOpen(false);
                      setCreateOpen(true);
                      return;
                    }
                    setForm((f) => ({ ...f, person_id: v }));
                  }}
                  options={options}
                  placeholder="Choisir un bénévole…"
                  searchPlaceholder="Rechercher par nom ou email…"
                  emptyMessage="Aucun bénévole disponible."
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="vfn">Fonction</Label>
                <Input
                  id="vfn"
                  value={form.function}
                  onChange={(e) => setForm({ ...form, function: e.target.value })}
                  placeholder="ex : Accueil, Transport, Vestiaire…"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="vno">Notes</Label>
                <Input
                  id="vno"
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
              <Button type="submit" disabled={saving} className="bg-primary hover:bg-[var(--cosl-red-dark)]">
                {saving ? "Ajout…" : "Ajouter"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <PersonCreateDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        initialRoles={["volunteer"]}
        onCreated={() => { setCreateOpen(false); load(); }}
      />
    </div>
  );
}
