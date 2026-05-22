import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2, X, Pencil, Check, Search } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { confirmAction } from "@/components/ConfirmDialog";
import {
  type LocalTransport,
  type LocalTransportPassenger,
  type Athlete,
  type Coach,
} from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AddressSearch } from "@/components/AddressSearch";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { LogisticsTabs } from "@/components/LogisticsTabs";
import { TableSkeleton, EmptyState } from "@/components/DataTableShell";
import { PersonCombobox } from "@/components/PersonCombobox";

export const Route = createFileRoute("/_authenticated/games/$id/logistics/transport")({
  component: TransportPage,
});

type Form = {
  transport_type: string;
  pickup_location: string;
  dropoff_location: string;
  pickup_time: string;
  capacity: string;
  notes: string;
};

const empty: Form = {
  transport_type: "",
  pickup_location: "",
  dropoff_location: "",
  pickup_time: "",
  capacity: "",
  notes: "",
};

function TransportPage() {
  const { id } = Route.useParams();
  const [items, setItems] = useState<LocalTransport[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [athletes, setAthletes] = useState<Athlete[]>([]);
  const [coaches, setCoaches] = useState<Coach[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Form>(empty);
  const [confirmDel, setConfirmDel] = useState<LocalTransport | null>(null);

  const [drawer, setDrawer] = useState<LocalTransport | null>(null);
  const [passengers, setPassengers] = useState<LocalTransportPassenger[]>([]);
  const [paxOpen, setPaxOpen] = useState(false);
  const [paxForm, setPaxForm] = useState({
    kind: "athlete" as "athlete" | "coach",
    person_id: "",
    seat: "",
  });
  
  const [editPaxId, setEditPaxId] = useState<string | null>(null);
  const [editSeat, setEditSeat] = useState("");

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("local_transports")
      .select("*")
      .eq("game_id", id)
      .order("pickup_time");
    if (error) {
      setLoading(false);
      return toast.error("Erreur de chargement", { description: friendlyError(error) });
    }
    const list = (data ?? []) as LocalTransport[];
    setItems(list);

    if (list.length) {
      const { data: pax } = await supabase
        .from("local_transport_passengers")
        .select("local_transport_id")
        .in("local_transport_id", list.map((t) => t.id));
      const c: Record<string, number> = {};
      (pax ?? []).forEach((r: { local_transport_id: string }) => {
        c[r.local_transport_id] = (c[r.local_transport_id] ?? 0) + 1;
      });
      setCounts(c);
    } else {
      setCounts({});
    }

    const { data: gs } = await supabase
      .from("game_sports")
      .select("sport_id")
      .eq("game_id", id)
      .eq("is_active", true);
    const sportIds = ((gs ?? []) as { sport_id: string }[]).map((r) => r.sport_id);
    let selIds: string[] = [];
    if (sportIds.length) {
      const { data: sel } = await supabase
        .from("selections")
        .select("athlete_id")
        .eq("game_id", id)
        .eq("status", "selected")
        .in("sport_id", sportIds);
      selIds = Array.from(
        new Set(((sel ?? []) as { athlete_id: string }[]).map((s) => s.athlete_id)),
      );
    }
    const [{ data: a }, { data: co }] = await Promise.all([
      selIds.length
        ? supabase
            .from("athletes")
            .select("*")
            .in("id", selIds)
            .order("last_name")
        : Promise.resolve({ data: [] as Athlete[] }),
      supabase.from("coaches").select("*").eq("is_active", true).order("last_name"),
    ]);
    setAthletes((a ?? []) as Athlete[]);
    setCoaches((co ?? []) as Coach[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, [id]);

  const submit = async () => {
    if (!form.transport_type.trim()) return toast.error("Type requis");
    if (!form.pickup_location.trim() || !form.dropoff_location.trim())
      return toast.error("Pickup et dropoff requis");
    if (!form.pickup_time) return toast.error("Heure requise");

    const payload = {
      game_id: id,
      transport_type: form.transport_type.trim(),
      pickup_location: form.pickup_location.trim(),
      dropoff_location: form.dropoff_location.trim(),
      pickup_time: form.pickup_time,
      capacity: form.capacity ? parseInt(form.capacity, 10) : null,
      notes: form.notes.trim() || null,
    };
    const { error } = await supabase.from("local_transports").insert(payload);
    if (error) return toast.error("Échec", { description: friendlyError(error) });
    toast.success("Transport ajouté");
    setOpen(false);
    setForm(empty);
    load();
  };

  const remove = async () => {
    if (!confirmDel) return;
    const { error } = await supabase.from("local_transports").delete().eq("id", confirmDel.id);
    if (error) toast.error("Échec", { description: friendlyError(error) });
    else { toast.success("Transport supprimé"); load(); }
    setConfirmDel(null);
  };

  const openDrawer = async (t: LocalTransport) => {
    setDrawer(t);
    const { data, error } = await supabase
      .from("local_transport_passengers")
      .select("*")
      .eq("local_transport_id", t.id)
      .order("created_at");
    if (error) toast.error("Erreur passagers", { description: friendlyError(error) });
    setPassengers((data ?? []) as LocalTransportPassenger[]);
  };

  const addPax = async () => {
    if (!drawer) return;
    if (!paxForm.person_id) return toast.error("Sélection requise");
    if (drawer.capacity != null && passengers.length >= drawer.capacity) {
      return toast.error("Capacité atteinte", {
        description: `Le transport est limité à ${drawer.capacity} passagers.`,
      });
    }
    const payload = {
      local_transport_id: drawer.id,
      athlete_id: paxForm.kind === "athlete" ? paxForm.person_id : null,
      coach_id: paxForm.kind === "coach" ? paxForm.person_id : null,
      seat: paxForm.seat.trim() || null,
    };
    const { error } = await supabase.from("local_transport_passengers").insert(payload);
    if (error) return toast.error("Échec", { description: friendlyError(error) });
    toast.success("Passager ajouté");
    setPaxOpen(false);
    setPaxForm({ kind: "athlete", person_id: "", seat: "" });
    openDrawer(drawer);
    load();
  };

  const removePax = async (pid: string) => {
    if (!(await confirmAction({ title: "Retirer ce passager ?", confirmLabel: "Retirer" }))) return;
    const { error } = await supabase.from("local_transport_passengers").delete().eq("id", pid);
    if (error) return toast.error("Échec", { description: friendlyError(error) });
    toast.success("Passager retiré");
    if (drawer) openDrawer(drawer);
    load();
  };

  const startEditPax = (p: LocalTransportPassenger) => {
    setEditPaxId(p.id);
    setEditSeat(p.seat ?? "");
  };

  const saveEditPax = async () => {
    if (!editPaxId) return;
    const { error } = await supabase
      .from("local_transport_passengers")
      .update({ seat: editSeat.trim() || null })
      .eq("id", editPaxId);
    if (error) return toast.error("Échec", { description: friendlyError(error) });
    toast.success("Passager mis à jour");
    setEditPaxId(null);
    if (drawer) openDrawer(drawer);
  };

  const paxLabel = (p: LocalTransportPassenger) => {
    if (p.athlete_id) {
      const a = athletes.find((x) => x.id === p.athlete_id);
      return a ? `${a.first_name} ${a.last_name} (athlète)` : "Athlète";
    }
    const c = coaches.find((x) => x.id === p.coach_id);
    return c ? `${c.first_name} ${c.last_name} (encadrant)` : "Encadrant";
  };

  // Exclude people already on this transport
  const takenIds = useMemo(() => {
    const s = { athlete: new Set<string>(), coach: new Set<string>() };
    passengers.forEach((p) => {
      if (p.athlete_id) s.athlete.add(p.athlete_id);
      if (p.coach_id) s.coach.add(p.coach_id);
    });
    return s;
  }, [passengers]);

  const personOptions = useMemo(() => {
    return paxForm.kind === "athlete"
      ? athletes
          .filter((a) => !takenIds.athlete.has(a.id))
          .map((a) => ({ id: a.id, label: `${a.last_name} ${a.first_name}` }))
      : coaches
          .filter((c) => !takenIds.coach.has(c.id))
          .map((c) => ({ id: c.id, label: `${c.last_name} ${c.first_name}` }));
  }, [paxForm.kind, athletes, coaches, takenIds]);

  const fmtDt = (s: string) =>
    new Date(s).toLocaleString("fr-FR", {
      day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
    });

  const capacityFull = drawer?.capacity != null && passengers.length >= drawer.capacity;

  return (
    <div className="space-y-6">
      <LogisticsTabs id={id} />

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Transports locaux</h2>
          <p className="text-sm text-slate-500">Navettes, bus, transferts.</p>
        </div>
        <Button onClick={() => setOpen(true)} className="bg-indigo-500 hover:bg-indigo-600">
          <Plus className="mr-2 h-4 w-4" /> Ajouter un transport
        </Button>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white">
        {loading ? (
          <TableSkeleton cols={8} />
        ) : items.length === 0 ? (
          <div className="p-6"><EmptyState message="Aucun transport enregistré." /></div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead>Pickup</TableHead>
                <TableHead>Dropoff</TableHead>
                <TableHead>Heure</TableHead>
                <TableHead>Capacité</TableHead>
                <TableHead>Passagers</TableHead>
                <TableHead>Notes</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((t) => {
                const used = counts[t.id] ?? 0;
                const full = t.capacity != null && used >= t.capacity;
                return (
                  <TableRow
                    key={t.id}
                    className="cursor-pointer hover:bg-slate-50"
                    onClick={() => openDrawer(t)}
                  >
                    <TableCell className="font-medium">{t.transport_type}</TableCell>
                    <TableCell>{t.pickup_location}</TableCell>
                    <TableCell>{t.dropoff_location}</TableCell>
                    <TableCell>{fmtDt(t.pickup_time)}</TableCell>
                    <TableCell>{t.capacity ?? "—"}</TableCell>
                    <TableCell>
                      <Badge variant={full ? "destructive" : "outline"}>
                        {used}{t.capacity != null ? ` / ${t.capacity}` : ""}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-xs truncate">{t.notes ?? "—"}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-red-600 hover:text-red-700"
                        onClick={(e) => { e.stopPropagation(); setConfirmDel(t); }}
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

      {/* Create transport dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Ajouter un transport</DialogTitle></DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label>Type</Label>
              <Input value={form.transport_type} onChange={(e) => setForm({ ...form, transport_type: e.target.value })} placeholder="navette, bus…" />
            </div>
            <div className="space-y-1">
              <Label>Capacité</Label>
              <Input type="number" min={0} value={form.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>Pickup</Label>
              <AddressSearch
                value={form.pickup_location}
                onChange={(v) => setForm({ ...form, pickup_location: v })}
                onSelect={(r) => setForm({ ...form, pickup_location: [r.street, r.city, r.country].filter(Boolean).join(", ") || r.display_name })}
                placeholder="Point de pickup"
              />
            </div>
            <div className="space-y-1">
              <Label>Dropoff</Label>
              <AddressSearch
                value={form.dropoff_location}
                onChange={(v) => setForm({ ...form, dropoff_location: v })}
                onSelect={(r) => setForm({ ...form, dropoff_location: [r.street, r.city, r.country].filter(Boolean).join(", ") || r.display_name })}
                placeholder="Point de dropoff"
              />
            </div>
            <div className="sm:col-span-2 space-y-1">
              <Label>Heure de pickup</Label>
              <Input type="datetime-local" value={form.pickup_time} onChange={(e) => setForm({ ...form, pickup_time: e.target.value })} />
            </div>
            <div className="sm:col-span-2 space-y-1">
              <Label>Notes</Label>
              <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
            <Button onClick={submit} className="bg-indigo-500 hover:bg-indigo-600">Créer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Passenger drawer */}
      <Sheet open={!!drawer} onOpenChange={(o) => !o && setDrawer(null)}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>
              {drawer ? `${drawer.transport_type} · ${fmtDt(drawer.pickup_time)}` : ""}
            </SheetTitle>
          </SheetHeader>
          {drawer && (
            <div className="mt-4 space-y-4">
              <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm">
                <div>{drawer.pickup_location} → {drawer.dropoff_location}</div>
                <div className="text-slate-500">
                  Capacité {drawer.capacity ?? "—"} · {passengers.length} passager(s)
                </div>
              </div>
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-700">
                  Passagers ({passengers.length}{drawer.capacity != null ? ` / ${drawer.capacity}` : ""})
                </h3>
                <Button
                  size="sm"
                  onClick={() => setPaxOpen(true)}
                  disabled={capacityFull}
                  title={capacityFull ? "Capacité atteinte" : ""}
                >
                  <Plus className="mr-1 h-4 w-4" /> Ajouter
                </Button>
              </div>
              {capacityFull && (
                <p className="text-xs text-red-600">Capacité maximale atteinte.</p>
              )}
              {passengers.length === 0 ? (
                <p className="text-sm text-slate-500">Aucun passager.</p>
              ) : (
                <ul className="space-y-2">
                  {passengers.map((p) => {
                    const isEdit = editPaxId === p.id;
                    return (
                      <li key={p.id} className="rounded border border-slate-200 p-2 text-sm">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1">
                            <div className="font-medium">{paxLabel(p)}</div>
                            {!isEdit ? (
                              <div className="text-xs text-slate-500">
                                {p.seat ? `Siège ${p.seat}` : "Siège —"}
                              </div>
                            ) : (
                              <Input
                                className="mt-2"
                                placeholder="Siège"
                                value={editSeat}
                                onChange={(e) => setEditSeat(e.target.value)}
                              />
                            )}
                          </div>
                          <div className="flex gap-1">
                            {!isEdit ? (
                              <>
                                <Button variant="ghost" size="icon" onClick={() => startEditPax(p)} aria-label="Modifier">
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="icon" onClick={() => removePax(p.id)} aria-label="Retirer">
                                  <X className="h-4 w-4" />
                                </Button>
                              </>
                            ) : (
                              <>
                                <Button size="sm" onClick={saveEditPax} className="bg-indigo-500 hover:bg-indigo-600">
                                  <Check className="mr-1 h-4 w-4" /> OK
                                </Button>
                                <Button variant="ghost" size="sm" onClick={() => setEditPaxId(null)}>
                                  Annuler
                                </Button>
                              </>
                            )}
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Add passenger dialog */}
      <Dialog
        open={paxOpen}
        onOpenChange={(o) => {
          setPaxOpen(o);
          if (!o) { setPaxForm({ kind: "athlete", person_id: "", seat: "" }); }
        }}
      >
        <DialogContent>
          <DialogHeader><DialogTitle>Ajouter un passager</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <Label>Type</Label>
              <Select
                value={paxForm.kind}
                onValueChange={(v) => setPaxForm({ ...paxForm, kind: v as "athlete" | "coach", person_id: "" })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="athlete">Athlète</SelectItem>
                  <SelectItem value="coach">Encadrant</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Personne</Label>
              <PersonCombobox
                value={paxForm.person_id}
                onChange={(id) => setPaxForm({ ...paxForm, person_id: id })}
                options={personOptions}
                searchPlaceholder={`Rechercher ${paxForm.kind === "athlete" ? "un athlète" : "un encadrant"}…`}
              />
            </div>
            <div className="space-y-1">
              <Label>Siège (optionnel)</Label>
              <Input value={paxForm.seat} onChange={(e) => setPaxForm({ ...paxForm, seat: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPaxOpen(false)}>Annuler</Button>
            <Button onClick={addPax} className="bg-indigo-500 hover:bg-indigo-600">Ajouter</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!confirmDel} onOpenChange={(o) => !o && setConfirmDel(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce transport ?</AlertDialogTitle>
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
