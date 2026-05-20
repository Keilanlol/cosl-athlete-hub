import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2, Download, Building2, Search, Users } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import {
  type Accommodation,
  type RoomingAssignment,
  type Athlete,
  type Coach,
} from "@/lib/types";
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

type AccForm = { name: string; type: string; city: string; total_rooms: string };
type RoomForm = {
  accommodation_id: string;
  room_number: string;
  room_type: string;
  check_in: string;
  check_out: string;
};

const emptyAcc: AccForm = { name: "", type: "", city: "", total_rooms: "" };
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
  const [accs, setAccs] = useState<Accommodation[]>([]);
  const [rooms, setRooms] = useState<RoomingAssignment[]>([]);
  const [athletes, setAthletes] = useState<Athlete[]>([]);
  const [coaches, setCoaches] = useState<Coach[]>([]);
  const [loading, setLoading] = useState(true);

  const [accOpen, setAccOpen] = useState(false);
  const [accForm, setAccForm] = useState<AccForm>(emptyAcc);

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
    const [{ data: a }, { data: at }, { data: co }] = await Promise.all([
      supabase.from("accommodations").select("*").eq("game_id", id).order("name"),
      supabase.from("athletes").select("*").order("last_name"),
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
      city: accForm.city.trim() || null,
      total_rooms: accForm.total_rooms ? parseInt(accForm.total_rooms, 10) : null,
    };
    const { error } = await supabase.from("accommodations").insert(payload);
    if (error) return toast.error("Échec", { description: error.message });
    toast.success("Hébergement ajouté");
    setAccOpen(false);
    setAccForm(emptyAcc);
    load();
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
    if (error) return toast.error("Échec", { description: error.message });
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
    if (error) toast.error("Échec", { description: error.message });
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
    if (error) return toast.error("Échec", { description: error.message });
    toast.success("Occupant ajouté");
    setPaxId("");
    load();
  };


  const removeOccupant = async (occ: RoomingAssignment) => {
    const { error } = await supabase
      .from("rooming_assignments")
      .delete()
      .eq("id", occ.id);
    if (error) return toast.error("Échec", { description: error.message });
    toast.success("Occupant retiré");
    load();
  };

  const exportCsv = () => {
    const header = ["Hébergement", "Chambre", "Type", "Occupants", "Check-in", "Check-out"];
    const rows = filteredGroups.map((g) => [
      accName(g.accId),
      g.roomNo,
      g.items[0]?.room_type ?? "",
      g.items.map((i) => `${occupantLabel(i)}${i.coach_id ? " (encadrant)" : ""}`).join(" | "),
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

  const newRoomPersonOptions = useMemo(() => {
    if (roomForm.kind === "athlete")
      return athletes.map((a) => ({ id: a.id, label: `${a.last_name} ${a.first_name}` }));
    return coaches.map((c) => ({ id: c.id, label: `${c.last_name} ${c.first_name}` }));
  }, [roomForm.kind, athletes, coaches]);

  const roomTypes = useMemo(() => {
    const set = new Set<string>();
    rooms.forEach((r) => r.room_type && set.add(r.room_type));
    return Array.from(set);
  }, [rooms]);

  return (
    <div className="space-y-6">
      <LogisticsTabs id={id} />

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Hébergements</h2>
          <Button onClick={() => setAccOpen(true)} className="bg-indigo-500 hover:bg-indigo-600">
            <Plus className="mr-2 h-4 w-4" /> Ajouter un hébergement
          </Button>
        </div>
        {accs.length === 0 ? (
          <EmptyState message="Aucun hébergement enregistré." />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {accs.map((a) => (
              <div key={a.id} className="rounded-lg border border-slate-200 bg-white p-4">
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-indigo-500" />
                  <h3 className="font-semibold text-slate-900">{a.name}</h3>
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  {[a.type, a.city].filter(Boolean).join(" · ") || "—"}
                </p>
                <p className="mt-2 text-xs text-slate-500">
                  Capacité : {a.total_rooms ?? "—"} chambres
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-slate-900">Rooming list</h2>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={exportCsv}>
              <Download className="mr-2 h-4 w-4" /> Exporter CSV
            </Button>
            <Button onClick={() => setRoomOpen(true)} className="bg-indigo-500 hover:bg-indigo-600" size="sm">
              <Plus className="mr-2 h-4 w-4" /> Créer une chambre
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative max-w-sm flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
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
                <SelectItem key={t} value={t}>{t}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterSport} onValueChange={setFilterSport}>
            <SelectTrigger className="w-48"><SelectValue placeholder="Sport" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous sports</SelectItem>
              {sports.map((s) => (
                <SelectItem key={s} value={s}>{s.slice(0, 8)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white">
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
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredGroups.map((g) => (
                  <TableRow key={`${g.accId}-${g.roomNo}`}>
                    <TableCell>{accName(g.accId)}</TableCell>
                    <TableCell className="font-medium">{g.roomNo}</TableCell>
                    <TableCell>{g.items[0]?.room_type ?? "—"}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {g.items.map((it) => (
                          <Badge
                            key={it.id}
                            variant="secondary"
                            className={
                              it.coach_id
                                ? "bg-amber-100 text-amber-800"
                                : "bg-indigo-100 text-indigo-800"
                            }
                          >
                            {occupantLabel(it)} · {it.coach_id ? "encadrant" : "athlète"}
                          </Badge>
                        ))}
                        <Badge variant="outline">{g.items.length}</Badge>
                      </div>
                    </TableCell>
                    <TableCell>{g.items[0]?.check_in ?? "—"}</TableCell>
                    <TableCell>{g.items[0]?.check_out ?? "—"}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="outline"
                        size="sm"
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
                      >
                        <Users className="mr-2 h-4 w-4" /> Occupants
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </div>

      <Dialog open={accOpen} onOpenChange={setAccOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Ajouter un hébergement</DialogTitle></DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2 space-y-1">
              <Label>Nom</Label>
              <Input value={accForm.name} onChange={(e) => setAccForm({ ...accForm, name: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>Type</Label>
              <Input value={accForm.type} onChange={(e) => setAccForm({ ...accForm, type: e.target.value })} placeholder="hôtel, village…" />
            </div>
            <div className="space-y-1">
              <Label>Ville</Label>
              <AddressSearch
                value={accForm.city}
                onChange={(v) => setAccForm({ ...accForm, city: v })}
                onSelect={(r) => setAccForm({ ...accForm, city: r.city ?? r.display_name })}
                placeholder="Ville ou adresse de l'hébergement"
              />
            </div>
            <div className="space-y-1">
              <Label>Capacité (nb chambres)</Label>
              <Input type="number" min={0} value={accForm.total_rooms} onChange={(e) => setAccForm({ ...accForm, total_rooms: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAccOpen(false)}>Annuler</Button>
            <Button onClick={submitAcc} className="bg-indigo-500 hover:bg-indigo-600">Créer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={roomOpen} onOpenChange={setRoomOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader><DialogTitle>Créer une chambre</DialogTitle></DialogHeader>
          <p className="text-xs text-slate-500">
            Crée la chambre avec un premier occupant. Vous pourrez ensuite ajouter
            d'autres occupants (athlètes et/ou encadrants) via le bouton "Occupants".
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
              <Input value={roomForm.room_type} onChange={(e) => setRoomForm({ ...roomForm, room_type: e.target.value })} placeholder="single, double, suite…" />
            </div>
            <div className="space-y-1">
              <Label>Profil 1er occupant</Label>
              <Select value={roomForm.kind} onValueChange={(v) => setRoomForm({ ...roomForm, kind: v as "athlete" | "coach", occupant: "" })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="athlete">Athlète</SelectItem>
                  <SelectItem value="coach">Encadrant</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>1er occupant</Label>
              <PersonCombobox
                value={roomForm.occupant}
                onChange={(id) => setRoomForm({ ...roomForm, occupant: id })}
                options={newRoomPersonOptions}
                searchPlaceholder={`Rechercher ${roomForm.kind === "athlete" ? "un athlète" : "un encadrant"}…`}
              />
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
            <Button onClick={submitRoom} className="bg-indigo-500 hover:bg-indigo-600">Créer</Button>
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
              <div className="text-xs text-slate-500">
                {drawer.checkIn} → {drawer.checkOut}
                {drawer.roomType ? ` · ${drawer.roomType}` : ""}
              </div>

              <div className="space-y-2">
                <div className="text-sm font-medium text-slate-700">
                  Occupants ({drawer.items.length})
                </div>
                {drawer.items.length === 0 ? (
                  <p className="text-xs text-slate-500">Aucun occupant.</p>
                ) : (
                  <ul className="divide-y rounded-md border">
                    {drawer.items.map((it) => (
                      <li key={it.id} className="flex items-center justify-between p-2">
                        <div className="flex items-center gap-2">
                          <Badge
                            variant="secondary"
                            className={
                              it.coach_id
                                ? "bg-amber-100 text-amber-800"
                                : "bg-indigo-100 text-indigo-800"
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

              <div className="space-y-2 rounded-md border p-3">
                <div className="text-sm font-medium text-slate-700">Ajouter un occupant</div>
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
                <Button onClick={addOccupantToRoom} className="w-full bg-indigo-500 hover:bg-indigo-600">
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
