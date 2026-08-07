import { createFileRoute } from "@tanstack/react-router";
import { friendlyError } from "@/lib/error-messages";
import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2, Download, Building2, Search, Pencil } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { confirmAction } from "@/components/ConfirmDialog";
import {
  type Accommodation,
  type RoomingAssignment,
  type Athlete,
  type Coach,
} from "@/lib/types";
import { useTypeGroup } from "@/hooks/useTypeItems";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AddressSearch } from "@/components/AddressSearch";
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

export const Route = createFileRoute("/_authenticated/games/$id/logistics/lodging")({
  component: LodgingPage,
});

type AccForm = {
  name: string;
  type: string;
  street: string;
  postcode: string;
  city: string;
  country: string;
  total_rooms: string;
};
type RoomForm = {
  accommodation_id: string;
  room_number: string;
  room_type: string;
  check_in: string;
  check_out: string;
};

const emptyAcc: AccForm = { name: "", type: "", street: "", postcode: "", city: "", country: "", total_rooms: "" };
const emptyRoom: RoomForm = {
  accommodation_id: "",
  room_number: "",
  room_type: "",
  check_in: "",
  check_out: "",
};


type DrawerState = {
  accId: string;
  roomNo: string;
  roomType: string | null;
  checkIn: string;
  checkOut: string;
  items: RoomingAssignment[];
} | null;

function LodgingPage() {
  const { id } = Route.useParams();
  const accommodationTypesHook = useTypeGroup("accommodation_types");
  const roomTypesHook = useTypeGroup("room_types");
  const [accs, setAccs] = useState<Accommodation[]>([]);
  const [rooms, setRooms] = useState<RoomingAssignment[]>([]);
  const [athletes, setAthletes] = useState<Athlete[]>([]);
  const [coaches, setCoaches] = useState<Coach[]>([]);
  const [loading, setLoading] = useState(true);

  const [accOpen, setAccOpen] = useState(false);
  const [accForm, setAccForm] = useState<AccForm>(emptyAcc);
  const [editingAcc, setEditingAcc] = useState<Accommodation | null>(null);

  const [roomOpen, setRoomOpen] = useState(false);
  const [roomForm, setRoomForm] = useState<RoomForm>(emptyRoom);

  const [filterAcc, setFilterAcc] = useState<string>("all");
  const [filterType, setFilterType] = useState<string>("all");
  const [filterSport, setFilterSport] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [confirmDel, setConfirmDel] = useState<RoomingAssignment | null>(null);

  const [drawer, setDrawer] = useState<DrawerState>(null);
  const [paxKind, setPaxKind] = useState<"athlete" | "coach">("athlete");
  const [paxId, setPaxId] = useState<string>("");
  

  const load = async () => {
    setLoading(true);
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
    const [{ data: a }, { data: at }, { data: co }] = await Promise.all([
      supabase.from("accommodations").select("*").eq("game_id", id).order("name"),
      selIds.length
        ? supabase.from("athletes").select("*").in("id", selIds).order("last_name")
        : Promise.resolve({ data: [] as Athlete[] }),
      supabase.from("coaches").select("*").order("last_name"),
    ]);
    const accList = (a ?? []) as Accommodation[];
    setAccs(accList);
    setAthletes((at ?? []) as Athlete[]);
    setCoaches((co ?? []) as Coach[]);

    const accIds = accList.map((x) => x.id);
    if (accIds.length) {
      const { data: r } = await supabase
        .from("rooming_assignments")
        .select("*")
        .in("accommodation_id", accIds)
        .order("room_number");
      setRooms((r ?? []) as RoomingAssignment[]);
    } else setRooms([]);
    setLoading(false);
  };

  useEffect(() => { load(); }, [id]);

  // Keep drawer in sync with reloaded rooms
  useEffect(() => {
    if (!drawer) return;
    const items = rooms.filter(
      (r) => r.accommodation_id === drawer.accId && r.room_number === drawer.roomNo,
    );
    setDrawer((d) => (d ? { ...d, items } : d));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rooms]);

  const sports = useMemo(() => {
    const ids = new Set<string>();
    athletes.forEach((a) => a.primary_sport_id && ids.add(a.primary_sport_id));
    return Array.from(ids);
  }, [athletes]);

  // Charger les noms des sports pour le filtre
  const [sportsMap, setSportsMap] = useState<Record<string, string>>({});
  useEffect(() => {
    if (sports.length === 0) return;
    supabase.from("sports").select("id,name").in("id", sports).then(({ data }) => {
      const map: Record<string, string> = {};
      (data ?? []).forEach((s) => { map[(s as { id: string }).id] = (s as { name: string }).name; });
      setSportsMap(map);
    });
  }, [sports]);

  const occupantLabel = (room: RoomingAssignment) => {
    if (room.athlete_id) {
      const a = athletes.find((x) => x.id === room.athlete_id);
      return a ? `${a.first_name} ${a.last_name}` : "—";
    }
    if (room.coach_id) {
      const c = coaches.find((x) => x.id === room.coach_id);
      return c ? `${c.first_name} ${c.last_name}` : "—";
    }
    return "—";
  };

  const groupedRooms = useMemo(() => {
    const map = new Map<string, RoomingAssignment[]>();
    rooms.forEach((r) => {
      const k = `${r.accommodation_id}::${r.room_number}`;
      const arr = map.get(k) ?? [];
      arr.push(r);
      map.set(k, arr);
    });
    return Array.from(map.entries()).map(([k, items]) => {
      const [accId, roomNo] = k.split("::");
      return { accId, roomNo, items };
    });
  }, [rooms]);

  const filteredGroups = useMemo(() => {
    const q = search.trim().toLowerCase();
    return groupedRooms.filter((g) => {
      if (filterAcc !== "all" && g.accId !== filterAcc) return false;
      if (filterType !== "all" && !g.items.some((i) => (i.room_type ?? "") === filterType))
        return false;
      if (filterSport !== "all") {
        const hasSport = g.items.some((i) => {
          if (!i.athlete_id) return false;
          const a = athletes.find((x) => x.id === i.athlete_id);
          return a?.primary_sport_id === filterSport;
        });
        if (!hasSport) return false;
      }
      if (q) {
        const inRoom = g.roomNo.toLowerCase().includes(q);
        const inOccupant = g.items.some((i) => occupantLabel(i).toLowerCase().includes(q));
        if (!inRoom && !inOccupant) return false;
      }
      return true;
    });
  }, [groupedRooms, filterAcc, filterType, filterSport, athletes, search, occupantLabel]);

  const accName = (aid: string) => accs.find((x) => x.id === aid)?.name ?? "—";

  const submitAcc = async () => {
    if (!accForm.name.trim()) return toast.error("Nom requis");
    const payload = {
      game_id: id,
      name: accForm.name.trim(),
      type: accForm.type.trim() || null,
      street: accForm.street.trim() || null,
      postcode: accForm.postcode.trim() || null,
      city: accForm.city.trim() || null,
      country: accForm.country.trim() || null,
      address: [accForm.street, accForm.postcode, accForm.city, accForm.country].filter(Boolean).join(", ") || null,
      total_rooms: accForm.total_rooms ? parseInt(accForm.total_rooms, 10) : null,
    };
    const { error } = editingAcc
      ? await supabase.from("accommodations").update(payload).eq("id", editingAcc.id)
      : await supabase.from("accommodations").insert(payload);
    if (error) return toast.error("Échec", { description: friendlyError(error) });
    toast.success(editingAcc ? "Hébergement modifié" : "Hébergement ajouté");
    setAccOpen(false);
    setEditingAcc(null);
    setAccForm(emptyAcc);
    load();
  };

  const openEditAcc = (a: Accommodation) => {
    setEditingAcc(a);
    setAccForm({
      name: a.name,
      type: a.type ?? "",
      street: a.street ?? "",
      postcode: a.postcode ?? "",
      city: a.city ?? "",
      country: a.country ?? "",
      total_rooms: a.total_rooms != null ? String(a.total_rooms) : "",
    });
    setAccOpen(true);
  };

  const submitRoom = async () => {
    if (!roomForm.accommodation_id) return toast.error("Hébergement requis");
    if (!roomForm.room_number.trim()) return toast.error("N° de chambre requis");
    if (!roomForm.check_in || !roomForm.check_out) return toast.error("Dates requises");
    if (roomForm.check_in > roomForm.check_out)
      return toast.error("Check-in après check-out");

    const payload = {
      accommodation_id: roomForm.accommodation_id,
      room_number: roomForm.room_number.trim(),
      room_type: roomForm.room_type.trim() || null,
      check_in: roomForm.check_in,
      check_out: roomForm.check_out,
      athlete_id: null,
      coach_id: null,
    };
    const { error } = await supabase.from("rooming_assignments").insert(payload);
    if (error) return toast.error("Échec", { description: friendlyError(error) });
    toast.success("Chambre créée");
    setRoomOpen(false);
    setRoomForm(emptyRoom);
    load();
  };


  const removeRoom = async () => {
    if (!confirmDel) return;
    const { error } = await supabase
      .from("rooming_assignments")
      .delete()
      .eq("id", confirmDel.id);
    if (error) toast.error("Échec", { description: friendlyError(error) });
    else { toast.success("Occupant retiré"); load(); }
    setConfirmDel(null);
  };

  const addOccupantToRoom = async () => {
    if (!drawer) return;
    if (!paxId) return toast.error("Choisir une personne");
    const dup = drawer.items.some(
      (i) =>
        (paxKind === "athlete" && i.athlete_id === paxId) ||
        (paxKind === "coach" && i.coach_id === paxId),
    );
    if (dup) return toast.error("Déjà présent dans la chambre");

    // Réutiliser une éventuelle ligne placeholder (sans occupant)
    const placeholder = drawer.items.find((i) => !i.athlete_id && !i.coach_id);
    const patch = {
      athlete_id: paxKind === "athlete" ? paxId : null,
      coach_id: paxKind === "coach" ? paxId : null,
    };
    const { error } = placeholder
      ? await supabase.from("rooming_assignments").update(patch).eq("id", placeholder.id)
      : await supabase.from("rooming_assignments").insert({
          accommodation_id: drawer.accId,
          room_number: drawer.roomNo,
          room_type: drawer.roomType,
          check_in: drawer.checkIn,
          check_out: drawer.checkOut,
          ...patch,
        });
    if (error) return toast.error("Échec", { description: friendlyError(error) });
    toast.success("Occupant ajouté");
    setPaxId("");
    load();
  };


  const removeOccupant = async (occ: RoomingAssignment) => {
    if (!(await confirmAction({ title: "Retirer cet occupant ?", confirmLabel: "Retirer" }))) return;
    // Si c'est le dernier occupant réel, conserver la chambre en transformant
    // la ligne en placeholder (sans occupant) plutôt que de la supprimer.
    const roomItems = rooms.filter(
      (r) => r.accommodation_id === occ.accommodation_id && r.room_number === occ.room_number,
    );
    const realCount = roomItems.filter((r) => r.athlete_id || r.coach_id).length;
    const { error } =
      realCount <= 1
        ? await supabase
            .from("rooming_assignments")
            .update({ athlete_id: null, coach_id: null })
            .eq("id", occ.id)
        : await supabase.from("rooming_assignments").delete().eq("id", occ.id);
    if (error) return toast.error("Échec", { description: friendlyError(error) });
    toast.success("Occupant retiré");
    load();
  };


  const exportCsv = () => {
    const header = ["Hébergement", "Chambre", "Type", "Occupants", "Check-in", "Check-out"];
    const rows = filteredGroups.map((g) => [
      accName(g.accId),
      g.roomNo,
      roomTypesHook.getLabel(g.items[0]?.room_type),
      g.items.filter((i) => i.athlete_id || i.coach_id).map((i) => `${occupantLabel(i)}${i.coach_id ? " (encadrant)" : ""}`).join(" | "),
      g.items[0]?.check_in ?? "",
      g.items[0]?.check_out ?? "",
    ]);
    const csv = [header, ...rows]
      .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `rooming_list.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Export généré");
  };

  const personOptions = useMemo(() => {
    const taken = new Set<string>();
    drawer?.items.forEach((i) => {
      if (paxKind === "athlete" && i.athlete_id) taken.add(i.athlete_id);
      if (paxKind === "coach" && i.coach_id) taken.add(i.coach_id);
    });
    const list =
      paxKind === "athlete"
        ? athletes.map((a) => ({ id: a.id, label: `${a.last_name} ${a.first_name}` }))
        : coaches.map((c) => ({ id: c.id, label: `${c.last_name} ${c.first_name}` }));
    return list.filter((p) => !taken.has(p.id));
  }, [paxKind, athletes, coaches, drawer]);


  // Filtre des types de chambre : depuis le référentiel (plus depuis les données)
  const roomTypes = roomTypesHook.items;

  return (
    <div className="space-y-6">
      <LogisticsTabs id={id} />

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">Hébergements</h2>
          <Button onClick={() => setAccOpen(true)} className="bg-primary hover:bg-[var(--cosl-red-dark)]">
            <Plus className="mr-2 h-4 w-4" /> Ajouter un hébergement
          </Button>
        </div>
        {accs.length === 0 ? (
          <EmptyState message="Aucun hébergement enregistré." />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {accs.map((a) => (
              <div key={a.id} className="rounded-lg border border-border bg-card p-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <Building2 className="h-4 w-4 text-primary shrink-0" />
                    <h3 className="font-semibold text-foreground truncate">{a.name}</h3>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => openEditAcc(a)} aria-label="Modifier">
                    <Pencil className="h-4 w-4" />
                  </Button>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {[accommodationTypesHook.getLabel(a.type), [a.postcode, a.city].filter(Boolean).join(" "), a.country].filter(Boolean).join(" · ") || "—"}
                </p>
                {a.street && <p className="mt-1 text-xs text-muted-foreground">{a.street}</p>}
                <p className="mt-2 text-xs text-muted-foreground">
                  Capacité : {a.total_rooms ?? "—"} chambres
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-foreground">Rooming list</h2>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={exportCsv}>
              <Download className="mr-2 h-4 w-4" /> Exporter CSV
            </Button>
            <Button onClick={() => setRoomOpen(true)} className="bg-primary hover:bg-[var(--cosl-red-dark)]" size="sm">
              <Plus className="mr-2 h-4 w-4" /> Créer une chambre
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative max-w-sm flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Rechercher chambre, occupant…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={filterAcc} onValueChange={setFilterAcc}>
            <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous hébergements</SelectItem>
              {accs.map((a) => (
                <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous types</SelectItem>
              {roomTypes.map((t) => (
                <SelectItem key={t.code} value={t.code}>{t.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterSport} onValueChange={setFilterSport}>
            <SelectTrigger className="w-48"><SelectValue placeholder="Sport" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous sports</SelectItem>
              {sports.map((s) => (
                <SelectItem key={s} value={s}>{sportsMap[s] ?? s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="rounded-lg border border-border bg-card">
          {loading ? (
            <TableSkeleton cols={6} />
          ) : filteredGroups.length === 0 ? (
            <div className="p-6"><EmptyState message="Aucune attribution." /></div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Hébergement</TableHead>
                  <TableHead>Chambre</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Occupants</TableHead>
                  <TableHead>Check-in</TableHead>
                  <TableHead>Check-out</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredGroups.map((g) => (
                  <TableRow
                    key={`${g.accId}-${g.roomNo}`}
                    onClick={() => {
                      setDrawer({
                        accId: g.accId,
                        roomNo: g.roomNo,
                        roomType: g.items[0]?.room_type ?? null,
                        checkIn: g.items[0]?.check_in ?? "",
                        checkOut: g.items[0]?.check_out ?? "",
                        items: g.items,
                      });
                      setPaxKind("athlete");
                      setPaxId("");
                    }}
                    className="cursor-pointer hover:bg-muted"
                  >
                    <TableCell>{accName(g.accId)}</TableCell>
                    <TableCell className="font-medium">{g.roomNo}</TableCell>
                    <TableCell>{roomTypesHook.getLabel(g.items[0]?.room_type)}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {g.items.filter((it) => it.athlete_id || it.coach_id).map((it) => (
                          <Badge
                            key={it.id}
                            variant="secondary"
                            className={
                              it.coach_id
                                ? "bg-amber-100 text-amber-800"
                                : "bg-[var(--cosl-red-light)] text-primary"
                            }
                          >
                            {occupantLabel(it)} · {it.coach_id ? "encadrant" : "athlète"}
                          </Badge>
                        ))}
                        <Badge variant="outline">
                          {g.items.filter((it) => it.athlete_id || it.coach_id).length}
                        </Badge>
                      </div>
                    </TableCell>

                    <TableCell>{g.items[0]?.check_in ?? "—"}</TableCell>
                    <TableCell>{g.items[0]?.check_out ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </div>

      <Dialog open={accOpen} onOpenChange={(o) => { setAccOpen(o); if (!o) { setEditingAcc(null); setAccForm(emptyAcc); } }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingAcc ? "Modifier l'hébergement" : "Ajouter un hébergement"}</DialogTitle></DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2 space-y-1">
              <Label>Nom</Label>
              <Input value={accForm.name} onChange={(e) => setAccForm({ ...accForm, name: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>Type</Label>
              <Select value={accForm.type || "__none"} onValueChange={(v) => setAccForm({ ...accForm, type: v === "__none" ? "" : v })}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">—</SelectItem>
                  {accommodationTypesHook.items.map((t) => (
                    <SelectItem key={t.code} value={t.code}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Capacité (nb chambres)</Label>
              <Input type="number" min={0} value={accForm.total_rooms} onChange={(e) => setAccForm({ ...accForm, total_rooms: e.target.value })} />
            </div>
            <div className="sm:col-span-2 space-y-1">
              <Label>Adresse (rue + numéro)</Label>
              <AddressSearch
                value={accForm.street}
                onChange={(v) => setAccForm({ ...accForm, street: v })}
                onSelect={(r) => setAccForm({
                  ...accForm,
                  street: r.street || accForm.street,
                  postcode: r.postcode || accForm.postcode,
                  city: r.city || accForm.city,
                  country: r.country || accForm.country,
                })}
                placeholder="Tapez pour rechercher l'adresse…"
              />
            </div>
            <div className="space-y-1">
              <Label>Code postal</Label>
              <Input value={accForm.postcode} onChange={(e) => setAccForm({ ...accForm, postcode: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>Ville</Label>
              <Input value={accForm.city} onChange={(e) => setAccForm({ ...accForm, city: e.target.value })} />
            </div>
            <div className="sm:col-span-2 space-y-1">
              <Label>Pays</Label>
              <Input value={accForm.country} onChange={(e) => setAccForm({ ...accForm, country: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setAccOpen(false); setEditingAcc(null); setAccForm(emptyAcc); }}>Annuler</Button>
            <Button onClick={submitAcc} className="bg-primary hover:bg-[var(--cosl-red-dark)]">{editingAcc ? "Enregistrer" : "Créer"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={roomOpen} onOpenChange={setRoomOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader><DialogTitle>Créer une chambre</DialogTitle></DialogHeader>
          <p className="text-xs text-muted-foreground">
            Définissez la chambre et ses dates. Ajoutez ensuite les occupants
            (athlètes et/ou encadrants) en cliquant sur la ligne de la chambre.
          </p>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2 space-y-1">
              <Label>Hébergement</Label>
              <Select value={roomForm.accommodation_id} onValueChange={(v) => setRoomForm({ ...roomForm, accommodation_id: v })}>
                <SelectTrigger><SelectValue placeholder="Choisir" /></SelectTrigger>
                <SelectContent>
                  {accs.map((a) => (
                    <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>N° chambre</Label>
              <Input value={roomForm.room_number} onChange={(e) => setRoomForm({ ...roomForm, room_number: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>Type</Label>
              <Select value={roomForm.room_type || "__none"} onValueChange={(v) => setRoomForm({ ...roomForm, room_type: v === "__none" ? "" : v })}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">—</SelectItem>
                  {roomTypesHook.items.map((t) => (
                    <SelectItem key={t.code} value={t.code}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Check-in</Label>
              <Input type="date" value={roomForm.check_in} onChange={(e) => setRoomForm({ ...roomForm, check_in: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>Check-out</Label>
              <Input type="date" value={roomForm.check_out} onChange={(e) => setRoomForm({ ...roomForm, check_out: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRoomOpen(false)}>Annuler</Button>
            <Button onClick={submitRoom} className="bg-primary hover:bg-[var(--cosl-red-dark)]">Créer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Sheet open={!!drawer} onOpenChange={(o) => !o && setDrawer(null)}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle>
              {drawer ? `Chambre ${drawer.roomNo} · ${accName(drawer.accId)}` : ""}
            </SheetTitle>
          </SheetHeader>
          {drawer && (
            <div className="mt-4 space-y-4">
              <div className="text-xs text-muted-foreground">
                {drawer.checkIn} → {drawer.checkOut}
                {drawer.roomType ? ` · ${drawer.roomType}` : ""}
              </div>

              {(() => {
                const real = drawer.items.filter((i) => i.athlete_id || i.coach_id);
                return (
                  <div className="space-y-2">
                    <div className="text-sm font-medium text-foreground">
                      Occupants ({real.length})
                    </div>
                    {real.length === 0 ? (
                      <p className="text-xs text-muted-foreground">Aucun occupant.</p>
                    ) : (
                      <ul className="divide-y rounded-md border">
                        {real.map((it) => (
                          <li key={it.id} className="flex items-center justify-between p-2">
                            <div className="flex items-center gap-2">
                              <Badge
                                variant="secondary"
                                className={
                                  it.coach_id
                                    ? "bg-amber-100 text-amber-800"
                                    : "bg-[var(--cosl-red-light)] text-primary"
                                }
                              >
                                {it.coach_id ? "Encadrant" : "Athlète"}
                              </Badge>
                              <span className="text-sm">{occupantLabel(it)}</span>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-red-600 hover:text-red-700"
                              onClick={() => removeOccupant(it)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                );
              })()}


              <div className="space-y-2 rounded-md border p-3">
                <div className="text-sm font-medium text-foreground">Ajouter un occupant</div>
                <Select value={paxKind} onValueChange={(v) => { setPaxKind(v as "athlete" | "coach"); setPaxId(""); }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="athlete">Athlète</SelectItem>
                    <SelectItem value="coach">Encadrant</SelectItem>
                  </SelectContent>
                </Select>
                <PersonCombobox
                  value={paxId}
                  onChange={setPaxId}
                  options={personOptions}
                  searchPlaceholder={`Rechercher ${paxKind === "athlete" ? "un athlète" : "un encadrant"}…`}
                />
                <Button onClick={addOccupantToRoom} className="w-full bg-primary hover:bg-[var(--cosl-red-dark)]">
                  <Plus className="mr-2 h-4 w-4" /> Ajouter
                </Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      <AlertDialog open={!!confirmDel} onOpenChange={(o) => !o && setConfirmDel(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cette attribution ?</AlertDialogTitle>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={removeRoom} className="bg-red-600 hover:bg-red-700">
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
