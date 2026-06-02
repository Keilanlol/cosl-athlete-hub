import { createFileRoute } from "@tanstack/react-router";
import { friendlyError } from "@/lib/error-messages";
import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2, X, Pencil, Check, Search } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { confirmAction } from "@/components/ConfirmDialog";
import {
  type Flight,
  type FlightPassenger,
  type TravelPlan,
  type Athlete,
  type Coach,
} from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

export const Route = createFileRoute("/_authenticated/games/$id/logistics/flights")({
  component: FlightsPage,
});

type FlightForm = {
  travel_plan_id: string;
  flight_number: string;
  airline: string;
  departure_airport: string;
  arrival_airport: string;
  departure_time: string;
  arrival_time: string;
  is_outbound: string;
  notes: string;
};

const emptyFlight: FlightForm = {
  travel_plan_id: "",
  flight_number: "",
  airline: "",
  departure_airport: "",
  arrival_airport: "",
  departure_time: "",
  arrival_time: "",
  is_outbound: "true",
  notes: "",
};

function FlightsPage() {
  const { id } = Route.useParams();
  const [plans, setPlans] = useState<TravelPlan[]>([]);
  const [flights, setFlights] = useState<Flight[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [athletes, setAthletes] = useState<Athlete[]>([]);
  const [coaches, setCoaches] = useState<Coach[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const [dlgOpen, setDlgOpen] = useState(false);
  const [form, setForm] = useState<FlightForm>(emptyFlight);

  const [drawerFlight, setDrawerFlight] = useState<Flight | null>(null);
  const [passengers, setPassengers] = useState<FlightPassenger[]>([]);
  const [paxOpen, setPaxOpen] = useState(false);
  const [paxForm, setPaxForm] = useState({
    kind: "athlete" as "athlete" | "coach",
    person_id: "",
    seat: "",
    special_baggage: "",
  });
  const [confirmDel, setConfirmDel] = useState<Flight | null>(null);
  const [editPaxId, setEditPaxId] = useState<string | null>(null);
  const [editSeat, setEditSeat] = useState("");
  const [editBag, setEditBag] = useState("");
  

  const startEditPax = (p: FlightPassenger) => {
    setEditPaxId(p.id);
    setEditSeat(p.seat ?? "");
    setEditBag(p.special_baggage ?? "");
  };

  const saveEditPax = async () => {
    if (!editPaxId) return;
    const { error } = await supabase
      .from("flight_passengers")
      .update({
        seat: editSeat.trim() || null,
        special_baggage: editBag.trim() || null,
      })
      .eq("id", editPaxId);
    if (error) return toast.error("Échec", { description: friendlyError(error) });
    toast.success("Passager mis à jour");
    setEditPaxId(null);
    if (drawerFlight) openDrawer(drawerFlight);
  };

  const load = async () => {
    setLoading(true);
    const { data: p } = await supabase
      .from("travel_plans")
      .select("*")
      .eq("game_id", id)
      .order("departure_date");
    const planList = (p ?? []) as TravelPlan[];
    setPlans(planList);

    const planIds = planList.map((x) => x.id);
    let fl: Flight[] = [];
    if (planIds.length) {
      const { data } = await supabase
        .from("flights")
        .select("*")
        .in("travel_plan_id", planIds)
        .order("departure_time");
      fl = (data ?? []) as Flight[];
    }
    setFlights(fl);

    if (fl.length) {
      const { data: pax } = await supabase
        .from("flight_passengers")
        .select("flight_id")
        .in("flight_id", fl.map((f) => f.id));
      const c: Record<string, number> = {};
      (pax ?? []).forEach((r: { flight_id: string }) => {
        c[r.flight_id] = (c[r.flight_id] ?? 0) + 1;
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

  const planName = (pid: string) => plans.find((p) => p.id === pid)?.name ?? "—";

  const submitFlight = async () => {
    if (!form.travel_plan_id) return toast.error("Plan de voyage requis");
    if (!form.flight_number.trim()) return toast.error("N° de vol requis");
    if (!form.departure_airport || !form.arrival_airport)
      return toast.error("Aéroports requis");
    if (!form.departure_time || !form.arrival_time)
      return toast.error("Horaires requis");
    if (new Date(form.departure_time) > new Date(form.arrival_time))
      return toast.error("Heure de départ après heure d'arrivée");

    const payload = {
      travel_plan_id: form.travel_plan_id,
      flight_number: form.flight_number.trim(),
      airline: form.airline.trim() || null,
      departure_airport: form.departure_airport.trim().toUpperCase(),
      arrival_airport: form.arrival_airport.trim().toUpperCase(),
      departure_time: form.departure_time,
      arrival_time: form.arrival_time,
      is_outbound: form.is_outbound === "true",
      notes: form.notes.trim() || null,
    };
    const { error } = await supabase.from("flights").insert(payload);
    if (error) return toast.error("Échec", { description: friendlyError(error) });
    toast.success("Vol ajouté");
    setDlgOpen(false);
    setForm(emptyFlight);
    load();
  };

  const openDrawer = async (f: Flight) => {
    setDrawerFlight(f);
    const { data, error } = await supabase
      .from("flight_passengers")
      .select("*")
      .eq("flight_id", f.id);
    if (error) toast.error("Erreur passagers", { description: friendlyError(error) });
    setPassengers((data ?? []) as FlightPassenger[]);
  };

  const addPax = async () => {
    if (!drawerFlight) return;
    if (!paxForm.person_id) return toast.error("Sélection requise");
    const payload = {
      flight_id: drawerFlight.id,
      athlete_id: paxForm.kind === "athlete" ? paxForm.person_id : null,
      coach_id: paxForm.kind === "coach" ? paxForm.person_id : null,
      seat: paxForm.seat.trim() || null,
      special_baggage: paxForm.special_baggage.trim() || null,
    };
    const { error } = await supabase.from("flight_passengers").insert(payload);
    if (error) return toast.error("Échec", { description: friendlyError(error) });
    toast.success("Passager ajouté");
    setPaxOpen(false);
    setPaxForm({ kind: "athlete", person_id: "", seat: "", special_baggage: "" });
    openDrawer(drawerFlight);
    load();
  };

  const removePax = async (pid: string) => {
    if (!(await confirmAction({ title: "Retirer ce passager ?", confirmLabel: "Retirer" }))) return;
    const { error } = await supabase.from("flight_passengers").delete().eq("id", pid);
    if (error) return toast.error("Échec", { description: friendlyError(error) });
    toast.success("Passager retiré");
    if (drawerFlight) openDrawer(drawerFlight);
    load();
  };

  const removeFlight = async () => {
    if (!confirmDel) return;
    const { error } = await supabase.from("flights").delete().eq("id", confirmDel.id);
    if (error) toast.error("Échec", { description: friendlyError(error) });
    else { toast.success("Vol supprimé"); load(); }
    setConfirmDel(null);
  };

  const fmtDt = (s: string) =>
    new Date(s).toLocaleString("fr-FR", {
      day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
    });

  const paxLabel = (p: FlightPassenger) => {
    if (p.athlete_id) {
      const a = athletes.find((x) => x.id === p.athlete_id);
      return a ? `${a.first_name} ${a.last_name} (athlète)` : "Athlète";
    }
    const c = coaches.find((x) => x.id === p.coach_id);
    return c ? `${c.first_name} ${c.last_name} (encadrant)` : "Encadrant";
  };

  const personOptions = useMemo(() => {
    return paxForm.kind === "athlete"
      ? athletes.map((a) => ({ id: a.id, label: `${a.last_name} ${a.first_name}` }))
      : coaches.map((c) => ({ id: c.id, label: `${c.last_name} ${c.first_name}` }));
  }, [paxForm.kind, athletes, coaches]);

  const filteredFlights = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return flights;
    return flights.filter(
      (f) =>
        f.flight_number.toLowerCase().includes(q) ||
        (f.airline ?? "").toLowerCase().includes(q) ||
        f.departure_airport.toLowerCase().includes(q) ||
        f.arrival_airport.toLowerCase().includes(q),
    );
  }, [flights, search]);

  return (
    <div className="space-y-6">
      <LogisticsTabs id={id} />

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Vols</h2>
          <p className="text-sm text-muted-foreground">Vols internationaux et passagers.</p>
        </div>
        <Button onClick={() => setDlgOpen(true)} className="bg-primary hover:bg-[var(--cosl-red-dark)]">
          <Plus className="mr-2 h-4 w-4" /> Ajouter un vol
        </Button>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Rechercher vol, compagnie, aéroport…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <span className="text-sm text-muted-foreground">{filteredFlights.length} résultat(s)</span>
      </div>

      <div className="rounded-lg border border-border bg-card">
        {loading ? (
          <TableSkeleton cols={8} />
        ) : filteredFlights.length === 0 ? (
          <div className="p-6"><EmptyState message="Aucun vol enregistré." /></div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>N° vol</TableHead>
                <TableHead>Compagnie</TableHead>
                <TableHead>Départ</TableHead>
                <TableHead>Arrivée</TableHead>
                <TableHead>Heure départ</TableHead>
                <TableHead>Heure arrivée</TableHead>
                <TableHead>Sens</TableHead>
                <TableHead>Passagers</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredFlights.map((f) => (
                <TableRow
                  key={f.id}
                  className="cursor-pointer hover:bg-muted"
                  onClick={() => openDrawer(f)}
                >
                  <TableCell className="font-medium">{f.flight_number}</TableCell>
                  <TableCell>{f.airline ?? "—"}</TableCell>
                  <TableCell>{f.departure_airport}</TableCell>
                  <TableCell>{f.arrival_airport}</TableCell>
                  <TableCell>{fmtDt(f.departure_time)}</TableCell>
                  <TableCell>{fmtDt(f.arrival_time)}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{f.is_outbound ? "Aller" : "Retour"}</Badge>
                  </TableCell>
                  <TableCell>{counts[f.id] ?? 0}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-red-600 hover:text-red-700"
                      onClick={(e) => { e.stopPropagation(); setConfirmDel(f); }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Add flight dialog */}
      <Dialog open={dlgOpen} onOpenChange={setDlgOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader><DialogTitle>Ajouter un vol</DialogTitle></DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2 space-y-1">
              <Label>Plan de voyage</Label>
              <Select
                value={form.travel_plan_id}
                onValueChange={(v) => setForm({ ...form, travel_plan_id: v })}
              >
                <SelectTrigger><SelectValue placeholder="Choisir un plan" /></SelectTrigger>
                <SelectContent>
                  {plans.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>N° de vol</Label>
              <Input value={form.flight_number} onChange={(e) => setForm({ ...form, flight_number: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>Compagnie</Label>
              <Input value={form.airline} onChange={(e) => setForm({ ...form, airline: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>Aéroport départ</Label>
              <Input value={form.departure_airport} onChange={(e) => setForm({ ...form, departure_airport: e.target.value })} placeholder="LUX" />
            </div>
            <div className="space-y-1">
              <Label>Aéroport arrivée</Label>
              <Input value={form.arrival_airport} onChange={(e) => setForm({ ...form, arrival_airport: e.target.value })} placeholder="CDG" />
            </div>
            <div className="space-y-1">
              <Label>Heure départ</Label>
              <Input type="datetime-local" value={form.departure_time} onChange={(e) => setForm({ ...form, departure_time: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>Heure arrivée</Label>
              <Input type="datetime-local" value={form.arrival_time} onChange={(e) => setForm({ ...form, arrival_time: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>Sens</Label>
              <Select value={form.is_outbound} onValueChange={(v) => setForm({ ...form, is_outbound: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="true">Aller</SelectItem>
                  <SelectItem value="false">Retour</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="sm:col-span-2 space-y-1">
              <Label>Notes</Label>
              <Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDlgOpen(false)}>Annuler</Button>
            <Button onClick={submitFlight} className="bg-primary hover:bg-[var(--cosl-red-dark)]">Créer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Passenger drawer */}
      <Sheet open={!!drawerFlight} onOpenChange={(o) => !o && setDrawerFlight(null)}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>
              {drawerFlight ? `Vol ${drawerFlight.flight_number}` : ""}
            </SheetTitle>
          </SheetHeader>
          {drawerFlight && (
            <div className="mt-4 space-y-4">
              <div className="rounded-md border border-border bg-muted p-3 text-sm">
                <div>{planName(drawerFlight.travel_plan_id)}</div>
                <div className="text-muted-foreground">
                  {drawerFlight.departure_airport} → {drawerFlight.arrival_airport}
                </div>
              </div>
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-foreground">
                  Passagers ({passengers.length})
                </h3>
                <Button size="sm" onClick={() => setPaxOpen(true)}>
                  <Plus className="mr-1 h-4 w-4" /> Ajouter
                </Button>
              </div>
              {passengers.length === 0 ? (
                <p className="text-sm text-muted-foreground">Aucun passager.</p>
              ) : (
                <ul className="space-y-2">
                  {passengers.map((p) => {
                    const isEdit = editPaxId === p.id;
                    return (
                      <li key={p.id} className="rounded border border-border p-2 text-sm">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1">
                            <div className="font-medium">{paxLabel(p)}</div>
                            {!isEdit ? (
                              <div className="text-xs text-muted-foreground">
                                {p.seat ? `Siège ${p.seat}` : "Siège —"}
                                {p.special_baggage ? ` · ${p.special_baggage}` : ""}
                              </div>
                            ) : (
                              <div className="mt-2 grid grid-cols-2 gap-2">
                                <Input
                                  placeholder="Siège (ex: 12A)"
                                  value={editSeat}
                                  onChange={(e) => setEditSeat(e.target.value)}
                                />
                                <Input
                                  placeholder="Bagage spécial"
                                  value={editBag}
                                  onChange={(e) => setEditBag(e.target.value)}
                                />
                              </div>
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
                                <Button size="sm" onClick={saveEditPax} className="bg-primary hover:bg-[var(--cosl-red-dark)]">
                                  <Check className="mr-1 h-4 w-4" /> Enregistrer
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
      <Dialog open={paxOpen} onOpenChange={setPaxOpen}>
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
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label>Siège</Label>
                <Input value={paxForm.seat} onChange={(e) => setPaxForm({ ...paxForm, seat: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>Bagage spécial</Label>
                <Input value={paxForm.special_baggage} onChange={(e) => setPaxForm({ ...paxForm, special_baggage: e.target.value })} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPaxOpen(false)}>Annuler</Button>
            <Button onClick={addPax} className="bg-primary hover:bg-[var(--cosl-red-dark)]">Ajouter</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!confirmDel} onOpenChange={(o) => !o && setConfirmDel(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce vol ?</AlertDialogTitle>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={removeFlight} className="bg-red-600 hover:bg-red-700">
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
