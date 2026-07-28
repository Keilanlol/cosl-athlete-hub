import { createFileRoute } from "@tanstack/react-router";
import { friendlyError } from "@/lib/error-messages";
import { useEffect, useMemo, useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import {
  type TravelPlan,
  type TravelScope,
  type TravelStatus,
  type Sport,
  TRAVEL_SCOPES,
} from "@/lib/types";
import { useTypeGroup, clsForCode } from "@/hooks/useTypeItems";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AddressSearch } from "@/components/AddressSearch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { LogisticsTabs } from "@/components/LogisticsTabs";
import { TableSkeleton, EmptyState, PagerBar, PAGE_SIZE } from "@/components/DataTableShell";

export const Route = createFileRoute("/_authenticated/games/$id/logistics/")({
  component: TravelPlansPage,
});

type Form = {
  name: string;
  scope: TravelScope;
  sport_id: string;
  departure_date: string;
  return_date: string;
  departure_point: string;
  arrival_point: string;
  status: TravelStatus;
  notes: string;
};

const empty: Form = {
  name: "",
  scope: "global",
  sport_id: "",
  departure_date: "",
  return_date: "",
  departure_point: "",
  arrival_point: "",
  status: "planned" as TravelStatus,
  notes: "",
};

function TravelPlansPage() {
  const { id } = Route.useParams();
  const travelStatusesHook = useTypeGroup("travel_statuses");
  const [plans, setPlans] = useState<TravelPlan[]>([]);
  const [sports, setSports] = useState<Sport[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<TravelPlan | null>(null);
  const [form, setForm] = useState<Form>(empty);
  const [confirmDel, setConfirmDel] = useState<TravelPlan | null>(null);

  const load = async () => {
    setLoading(true);
    const [{ data: p, error }, { data: sp }] = await Promise.all([
      supabase
        .from("travel_plans")
        .select("*")
        .eq("game_id", id)
        .order("departure_date", { ascending: true }),
      supabase.from("sports").select("*").order("name"),
    ]);
    setLoading(false);
    if (error) {
      toast.error("Erreur de chargement", { description: friendlyError(error) });
      return;
    }
    setPlans((p ?? []) as TravelPlan[]);
    setSports((sp ?? []) as Sport[]);
  };

  useEffect(() => { load(); }, [id]);

  const sportName = (sid: string | null) => sports.find((s) => s.id === sid)?.name ?? "—";

  const totalPages = Math.max(1, Math.ceil(plans.length / PAGE_SIZE));
  const paged = useMemo(
    () => plans.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [plans, page],
  );

  const openCreate = () => {
    setEditing(null);
    setForm(empty);
    setOpen(true);
  };

  const openEdit = (p: TravelPlan) => {
    setEditing(p);
    setForm({
      name: p.name,
      scope: p.scope,
      sport_id: p.sport_id ?? "",
      departure_date: p.departure_date,
      return_date: p.return_date,
      departure_point: p.departure_point ?? "",
      arrival_point: p.arrival_point ?? "",
      status: p.status,
      notes: p.notes ?? "",
    });
    setOpen(true);
  };

  const submit = async () => {
    if (!form.name.trim()) return toast.error("Nom requis");
    if (!form.departure_date || !form.return_date)
      return toast.error("Dates requises");
    if (form.departure_date > form.return_date)
      return toast.error("Date de départ après date de retour");
    if (form.scope === "sport" && !form.sport_id)
      return toast.error("Sport requis pour ce périmètre");

    const payload = {
      game_id: id,
      name: form.name.trim(),
      scope: form.scope,
      sport_id: form.scope === "sport" ? form.sport_id : null,
      departure_date: form.departure_date,
      return_date: form.return_date,
      departure_point: form.departure_point.trim() || null,
      arrival_point: form.arrival_point.trim() || null,
      status: form.status,
      notes: form.notes.trim() || null,
    };

    const { error } = editing
      ? await supabase.from("travel_plans").update(payload).eq("id", editing.id)
      : await supabase.from("travel_plans").insert(payload);
    if (error) return toast.error("Échec", { description: friendlyError(error) });

    toast.success(editing ? "Plan mis à jour" : "Plan créé");
    setOpen(false);
    load();
  };

  const remove = async () => {
    if (!confirmDel) return;
    const { error } = await supabase.from("travel_plans").delete().eq("id", confirmDel.id);
    if (error) toast.error("Échec", { description: friendlyError(error) });
    else { toast.success("Plan supprimé"); load(); }
    setConfirmDel(null);
  };

  const fmt = (d: string) => new Date(d).toLocaleDateString("fr-FR");

  return (
    <div className="space-y-6">
      <LogisticsTabs id={id} />

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Plans de voyage</h2>
          <p className="text-sm text-muted-foreground">Pilotage global, par sport ou individuel.</p>
        </div>
        <Button onClick={openCreate} className="bg-primary hover:bg-[var(--cosl-red-dark)]">
          <Plus className="mr-2 h-4 w-4" /> Créer un plan
        </Button>
      </div>

      <div className="rounded-lg border border-border bg-card">
        {loading ? (
          <TableSkeleton cols={6} />
        ) : plans.length === 0 ? (
          <div className="p-6"><EmptyState message="Aucun plan de voyage." /></div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Plan</TableHead>
                <TableHead>Périmètre</TableHead>
                <TableHead>Sport</TableHead>
                <TableHead>Départ</TableHead>
                <TableHead>Retour</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paged.map((p) => {
                const st = travelStatusesHook.findItem(p.status);
                const sc = TRAVEL_SCOPES.find((x) => x.value === p.scope);
                return (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell>{sc?.label ?? p.scope}</TableCell>
                    <TableCell>{p.scope === "sport" ? sportName(p.sport_id) : "—"}</TableCell>
                    <TableCell>{fmt(p.departure_date)}</TableCell>
                    <TableCell>{fmt(p.return_date)}</TableCell>
                    <TableCell>
                      {st && <Badge className={`${clsForCode("travel_statuses", p.status)} hover:${clsForCode("travel_statuses", p.status)}`}>{st.label}</Badge>}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(p)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setConfirmDel(p)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>

      <PagerBar page={page} pageCount={totalPages} onChange={setPage} />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Modifier le plan" : "Créer un plan de voyage"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2 space-y-1">
              <Label>Nom</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>Périmètre</Label>
              <Select
                value={form.scope}
                onValueChange={(v) => setForm({ ...form, scope: v as TravelScope })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TRAVEL_SCOPES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Sport</Label>
              <Select
                value={form.sport_id}
                onValueChange={(v) => setForm({ ...form, sport_id: v })}
                disabled={form.scope !== "sport"}
              >
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  {sports.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Date départ</Label>
              <Input
                type="date"
                value={form.departure_date}
                onChange={(e) => setForm({ ...form, departure_date: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label>Date retour</Label>
              <Input
                type="date"
                value={form.return_date}
                onChange={(e) => setForm({ ...form, return_date: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label>Lieu de départ</Label>
              <AddressSearch
                value={form.departure_point}
                onChange={(v) => setForm({ ...form, departure_point: v })}
                onSelect={(r) => setForm({ ...form, departure_point: [r.street, r.city, r.country].filter(Boolean).join(", ") || r.display_name })}
                placeholder="Aéroport, gare, adresse…"
              />
            </div>
            <div className="space-y-1">
              <Label>Lieu d'arrivée</Label>
              <AddressSearch
                value={form.arrival_point}
                onChange={(v) => setForm({ ...form, arrival_point: v })}
                onSelect={(r) => setForm({ ...form, arrival_point: [r.street, r.city, r.country].filter(Boolean).join(", ") || r.display_name })}
                placeholder="Aéroport, gare, adresse…"
              />
            </div>
            <div className="space-y-1">
              <Label>Statut</Label>
              <Select
                value={form.status}
                onValueChange={(v) => setForm({ ...form, status: v as TravelStatus })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {travelStatusesHook.items.map((s) => (
                    <SelectItem key={s.code} value={s.code}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="sm:col-span-2 space-y-1">
              <Label>Notes</Label>
              <Textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
            <Button onClick={submit} className="bg-primary hover:bg-[var(--cosl-red-dark)]">
              {editing ? "Enregistrer" : "Créer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!confirmDel} onOpenChange={(o) => !o && setConfirmDel(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce plan ?</AlertDialogTitle>
            <AlertDialogDescription>
              Les vols rattachés seront également supprimés. Action irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={remove} className="bg-red-600 hover:bg-red-700">
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
