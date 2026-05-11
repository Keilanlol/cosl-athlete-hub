import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2, Download, Building2 } from "lucide-react";
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
import { Label } from "@/components/ui/label";
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
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { LogisticsTabs } from "@/components/LogisticsTabs";
import { TableSkeleton, EmptyState } from "@/components/DataTableShell";

export const Route = createFileRoute("/_authenticated/games/$id/logistics/lodging")({
  component: LodgingPage,
});

type AccForm = { name: string; type: string; city: string; total_rooms: string };
type RoomForm = {
  accommodation_id: string;
  room_number: string;
  room_type: string;
  kind: "athlete" | "coach";
  occupant1: string;
  occupant2: string;
  check_in: string;
  check_out: string;
};

const emptyAcc: AccForm = { name: "", type: "", city: "", total_rooms: "" };
const emptyRoom: RoomForm = {
  accommodation_id: "",
  room_number: "",
  room_type: "",
  kind: "athlete",
  occupant1: "",
  occupant2: "",
  check_in: "",
  check_out: "",
};

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
  const [confirmDel, setConfirmDel] = useState<RoomingAssignment | null>(null);

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

  // Group rooms by (accommodation_id, room_number) to display two occupants
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
      return true;
    });
  }, [groupedRooms, filterAcc, filterType, filterSport, athletes]);

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
    if (!roomForm.occupant1) return toast.error("Occupant requis");
    if (!roomForm.check_in || !roomForm.check_out) return toast.error("Dates requises");
    if (roomForm.check_in > roomForm.check_out)
      return toast.error("Check-in après check-out");

    const base = {
      accommodation_id: roomForm.accommodation_id,
      room_number: roomForm.room_number.trim(),
      room_type: roomForm.room_type.trim() || null,
      check_in: roomForm.check_in,
      check_out: roomForm.check_out,
    };
    const inserts: Array<typeof base & { athlete_id: string | null; coach_id: string | null }> = [];
    const occA = roomForm.occupant1;
    inserts.push({
      ...base,
      athlete_id: roomForm.kind === "athlete" ? occA : null,
      coach_id: roomForm.kind === "coach" ? occA : null,
    });
    if (roomForm.occupant2) {
      inserts.push({
        ...base,
        athlete_id: roomForm.kind === "athlete" ? roomForm.occupant2 : null,
        coach_id: roomForm.kind === "coach" ? roomForm.occupant2 : null,
      });
    }
    const { error } = await supabase.from("rooming_assignments").insert(inserts);
    if (error) return toast.error("Échec", { description: error.message });
    toast.success("Chambre attribuée");
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
    else { toast.success("Attribution supprimée"); load(); }
    setConfirmDel(null);
  };

  const exportCsv = () => {
    const header = ["Hébergement", "Chambre", "Type", "Occupant 1", "Occupant 2", "Check-in", "Check-out"];
    const rows = filteredGroups.map((g) => [
      accName(g.accId),
      g.roomNo,
      g.items[0]?.room_type ?? "",
      g.items[0] ? occupantLabel(g.items[0]) : "",
      g.items[1] ? occupantLabel(g.items[1]) : "",
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
              <Plus className="mr-2 h-4 w-4" /> Attribuer une chambre
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
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
            <TableSkeleton cols={7} />
          ) : filteredGroups.length === 0 ? (
            <div className="p-6"><EmptyState message="Aucune attribution." /></div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Hébergement</TableHead>
                  <TableHead>Chambre</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Occupant 1</TableHead>
                  <TableHead>Occupant 2</TableHead>
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
                    <TableCell>{g.items[0] ? occupantLabel(g.items[0]) : "—"}</TableCell>
                    <TableCell>{g.items[1] ? occupantLabel(g.items[1]) : "—"}</TableCell>
                    <TableCell>{g.items[0]?.check_in ?? "—"}</TableCell>
                    <TableCell>{g.items[0]?.check_out ?? "—"}</TableCell>
                    <TableCell className="text-right">
                      {g.items.map((it) => (
                        <Button
                          key={it.id}
                          variant="ghost"
                          size="icon"
                          className="text-red-600 hover:text-red-700"
                          onClick={() => setConfirmDel(it)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      ))}
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
              <Input value={accForm.city} onChange={(e) => setAccForm({ ...accForm, city: e.target.value })} />
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
          <DialogHeader><DialogTitle>Attribuer une chambre</DialogTitle></DialogHeader>
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
              <Input value={roomForm.room_type} onChange={(e) => setRoomForm({ ...roomForm, room_type: e.target.value })} placeholder="single, double…" />
            </div>
            <div className="space-y-1">
              <Label>Profil occupants</Label>
              <Select value={roomForm.kind} onValueChange={(v) => setRoomForm({ ...roomForm, kind: v as "athlete" | "coach", occupant1: "", occupant2: "" })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="athlete">Athlètes</SelectItem>
                  <SelectItem value="coach">Encadrants</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Occupant 1</Label>
              <Select value={roomForm.occupant1} onValueChange={(v) => setRoomForm({ ...roomForm, occupant1: v })}>
                <SelectTrigger><SelectValue placeholder="Choisir" /></SelectTrigger>
                <SelectContent>
                  {personOptions.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Occupant 2 (optionnel)</Label>
              <Select value={roomForm.occupant2} onValueChange={(v) => setRoomForm({ ...roomForm, occupant2: v })}>
                <SelectTrigger><SelectValue placeholder="Aucun" /></SelectTrigger>
                <SelectContent>
                  {personOptions.filter((p) => p.id !== roomForm.occupant1).map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>
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
            <Button onClick={submitRoom} className="bg-indigo-500 hover:bg-indigo-600">Attribuer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
