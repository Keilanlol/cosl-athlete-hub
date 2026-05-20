import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Plus, Search, Lock } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { TableSkeleton, EmptyState } from "@/components/DataTableShell";

export const Route = createFileRoute("/_authenticated/games/$id/selections")({
  component: SelectionsPage,
});

const SELECTION_STATUSES: { value: string; label: string; cls: string }[] = [
  { value: "pre_selected", label: "Pré-sélectionné", cls: "bg-amber-100 text-amber-700" },
  { value: "selected", label: "Sélectionné", cls: "bg-emerald-100 text-emerald-700" },
  { value: "reserve", label: "Réserviste", cls: "bg-sky-100 text-sky-700" },
  { value: "rejected", label: "Refusé", cls: "bg-red-100 text-red-700" },
];

const KYC_BADGE: Record<string, { label: string; cls: string }> = {
  green: { label: "Valide", cls: "bg-emerald-100 text-emerald-700" },
  orange: { label: "En attente", cls: "bg-amber-100 text-amber-700" },
  red: { label: "Invalide", cls: "bg-red-100 text-red-700" },
};

type Athlete = {
  id: string; first_name: string; last_name: string; gender: string;
  photo_url: string | null; primary_sport_id: string | null;
};
type Sport = { id: string; name: string };
type Discipline = { id: string; sport_id: string; name: string; gender: string };
type Selection = {
  id: string; game_id: string; athlete_id: string; sport_id: string;
  discipline_id: string | null; status: string; is_locked: boolean | null;
  athlete: Athlete | null; sport: Sport | null; discipline: Discipline | null;
};

function SelectionsPage() {
  const { id: gameId } = Route.useParams();
  const [rows, setRows] = useState<Selection[] | null>(null);
  const [athletes, setAthletes] = useState<Athlete[]>([]);
  const [sports, setSports] = useState<Sport[]>([]);
  const [gameSportIds, setGameSportIds] = useState<string[]>([]);
  const [disciplines, setDisciplines] = useState<Discipline[]>([]);
  const [kycMap, setKycMap] = useState<Record<string, string>>({});
  const [quotaSum, setQuotaSum] = useState(0);

  const [search, setSearch] = useState("");
  const [sportFilter, setSportFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [kycFilter, setKycFilter] = useState("all");

  const [open, setOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [form, setForm] = useState({ athlete_id: "", sport_id: "", discipline_id: "" });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setRows(null);
    const [selRes, athRes, sportsRes, gsRes, discRes, kycRes, qRes] = await Promise.all([
      supabase.from("selections")
        .select("*, athlete:athletes(id,first_name,last_name,gender,photo_url,primary_sport_id), sport:sports(id,name), discipline:disciplines(id,sport_id,name,gender)")
        .eq("game_id", gameId)
        .order("created_at", { ascending: false }),
      supabase.from("athletes").select("id,first_name,last_name,gender,photo_url,primary_sport_id").eq("is_active", true).order("last_name"),
      supabase.from("sports").select("id,name").order("name"),
      supabase.from("game_sports").select("sport_id").eq("game_id", gameId).eq("is_active", true),
      supabase.from("disciplines").select("id,sport_id,name,gender").order("name"),
      supabase.from("athlete_kyc").select("athlete_id, global_status"),
      supabase.from("game_quotas").select("quota_max").eq("game_id", gameId),
    ]);
    if (selRes.error) toast.error("Erreur sélections", { description: selRes.error.message });
    setRows(((selRes.data ?? []) as unknown) as Selection[]);
    setAthletes((athRes.data ?? []) as Athlete[]);
    setSports((sportsRes.data ?? []) as Sport[]);
    setGameSportIds(((gsRes.data ?? []) as { sport_id: string }[]).map((g) => g.sport_id));
    setDisciplines((discRes.data ?? []) as Discipline[]);
    const map: Record<string, string> = {};
    ((kycRes.data ?? []) as { athlete_id: string; global_status: string }[]).forEach((k) => {
      map[k.athlete_id] = k.global_status;
    });
    setKycMap(map);
    setQuotaSum(((qRes.data ?? []) as { quota_max: number }[]).reduce((a, b) => a + (b.quota_max ?? 0), 0));
  };

  useEffect(() => { load(); }, [gameId]);

  const filtered = useMemo(() => {
    if (!rows) return [];
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (sportFilter !== "all" && r.sport_id !== sportFilter) return false;
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (kycFilter !== "all") {
        const k = kycMap[r.athlete_id] ?? "red";
        if (k !== kycFilter) return false;
      }
      if (q) {
        const name = `${r.athlete?.first_name ?? ""} ${r.athlete?.last_name ?? ""}`.toLowerCase();
        if (!name.includes(q)) return false;
      }
      return true;
    });
  }, [rows, search, sportFilter, statusFilter, kycFilter, kycMap]);

  const selectedCount = (rows ?? []).filter((r) => r.status === "selected").length;
  const pct = quotaSum > 0 ? Math.min(100, (selectedCount / quotaSum) * 100) : 0;

  const gameSports = useMemo(
    () => sports.filter((s) => gameSportIds.includes(s.id)),
    [sports, gameSportIds],
  );

  const availableAthletes = useMemo(() => {
    const used = new Set((rows ?? []).map((r) => r.athlete_id));
    const sportSet = new Set(gameSportIds);
    return athletes
      .filter((a) => !used.has(a.id) || form.athlete_id === a.id)
      .filter((a) => a.primary_sport_id && sportSet.has(a.primary_sport_id))
      .slice(0, 200);
  }, [athletes, rows, form.athlete_id, gameSportIds]);

  const formDisciplines = useMemo(
    () => disciplines.filter((d) => d.sport_id === form.sport_id),
    [disciplines, form.sport_id],
  );

  const onPickAthlete = (a: Athlete) => {
    setForm({
      athlete_id: a.id,
      sport_id: a.primary_sport_id ?? "",
      discipline_id: "",
    });
    setPickerOpen(false);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.athlete_id || !form.sport_id) {
      toast.error("Athlète et sport requis"); return;
    }
    setSaving(true);
    const { error } = await supabase.from("selections").insert({
      game_id: gameId,
      athlete_id: form.athlete_id,
      sport_id: form.sport_id,
      discipline_id: form.discipline_id || null,
      status: "pre_selected",
    });
    setSaving(false);
    if (error) {
      toast.error("Échec", { description: error.message });
      return;
    }
    toast.success("Athlète pré-sélectionné");
    setOpen(false);
    setForm({ athlete_id: "", sport_id: "", discipline_id: "" });
    load();
  };

  const changeStatus = async (sel: Selection, newStatus: string) => {
    if (sel.is_locked) {
      toast.error("Sélection verrouillée"); return;
    }
    if (newStatus === "selected") {
      const { data, error } = await supabase.rpc("athlete_kyc_valid", { _athlete_id: sel.athlete_id });
      if (error) {
        toast.error("Vérification KYC impossible", { description: error.message });
        return;
      }
      if (!data) {
        toast.error("KYC invalide", {
          description: "Cet athlète n'a pas un KYC valide. Vérifiez son dossier avant de le sélectionner.",
        });
        return;
      }
    }
    const patch: { status: string; decided_at?: string } = { status: newStatus };
    if (["selected", "reserve", "rejected"].includes(newStatus)) patch.decided_at = new Date().toISOString();
    const { error } = await supabase.from("selections").update(patch).eq("id", sel.id);
    if (error) toast.error("Échec", { description: error.message });
    else { toast.success("Statut mis à jour"); load(); }
  };

  const selectedAthlete = athletes.find((a) => a.id === form.athlete_id);

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-medium text-slate-700">
            {selectedCount} athlète(s) sélectionné(s) / {quotaSum} quota total
          </p>
          <span className="text-xs text-slate-500">{pct.toFixed(0)}%</span>
        </div>
        <Progress value={pct} className="h-2" />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative max-w-sm flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input placeholder="Rechercher un athlète…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={sportFilter} onValueChange={setSportFilter}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Sport" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous sports</SelectItem>
            {sports.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Statut" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous statuts</SelectItem>
            {SELECTION_STATUSES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={kycFilter} onValueChange={setKycFilter}>
          <SelectTrigger className="w-36"><SelectValue placeholder="KYC" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous KYC</SelectItem>
            <SelectItem value="green">Valide</SelectItem>
            <SelectItem value="orange">En attente</SelectItem>
            <SelectItem value="red">Invalide</SelectItem>
          </SelectContent>
        </Select>
        <Button onClick={() => setOpen(true)} className="ml-auto bg-indigo-500 hover:bg-indigo-600">
          <Plus className="mr-2 h-4 w-4" /> Ajouter une sélection
        </Button>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white">
        {rows === null ? (
          <TableSkeleton cols={7} />
        ) : filtered.length === 0 ? (
          <div className="p-6"><EmptyState message="Aucune sélection." /></div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Athlète</TableHead>
                <TableHead>Sport</TableHead>
                <TableHead>Discipline</TableHead>
                <TableHead>Genre</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>KYC</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((r) => {
                const k = kycMap[r.athlete_id] ?? "red";
                const kb = KYC_BADGE[k];
                const sb = SELECTION_STATUSES.find((s) => s.value === r.status);
                const initials = `${r.athlete?.first_name?.[0] ?? ""}${r.athlete?.last_name?.[0] ?? ""}`;
                return (
                  <TableRow key={r.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Avatar className="h-8 w-8">
                          {r.athlete?.photo_url && <AvatarImage src={r.athlete.photo_url} />}
                          <AvatarFallback className="text-xs">{initials}</AvatarFallback>
                        </Avatar>
                        <span className="font-medium">{r.athlete?.first_name} {r.athlete?.last_name}</span>
                      </div>
                    </TableCell>
                    <TableCell>{r.sport?.name ?? "—"}</TableCell>
                    <TableCell>{r.discipline?.name ?? "—"}</TableCell>
                    <TableCell><Badge variant="outline">{r.athlete?.gender ?? "—"}</Badge></TableCell>
                    <TableCell>{sb && <Badge className={`${sb.cls} hover:${sb.cls}`}>{sb.label}</Badge>}</TableCell>
                    <TableCell><Badge className={`${kb.cls} hover:${kb.cls}`}>{kb.label}</Badge></TableCell>
                    <TableCell className="text-right">
                      {r.is_locked ? (
                        <span className="inline-flex items-center text-xs text-slate-500">
                          <Lock className="mr-1 h-3 w-3" /> Verrouillé
                        </span>
                      ) : (
                        <Select value={r.status} onValueChange={(v) => changeStatus(r, v)}>
                          <SelectTrigger className="ml-auto h-8 w-40"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {SELECTION_STATUSES.map((s) => (
                              <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <form onSubmit={submit}>
            <DialogHeader>
              <DialogTitle>Ajouter une sélection</DialogTitle>
              <DialogDescription>L'athlète sera créé en statut Pré-sélectionné.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-1.5">
                <Label>Athlète *</Label>
                <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
                  <PopoverTrigger asChild>
                    <Button type="button" variant="outline" className="w-full justify-between">
                      {selectedAthlete
                        ? `${selectedAthlete.first_name} ${selectedAthlete.last_name}`
                        : "Choisir un athlète…"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="p-0 w-[400px]" align="start">
                    <Command>
                      <CommandInput placeholder="Rechercher par nom…" />
                      <CommandList>
                        <CommandEmpty>Aucun athlète trouvé.</CommandEmpty>
                        <CommandGroup>
                          {availableAthletes.map((a) => (
                            <CommandItem
                              key={a.id}
                              value={`${a.first_name} ${a.last_name}`}
                              onSelect={() => onPickAthlete(a)}
                            >
                              {a.first_name} {a.last_name}
                              <span className="ml-auto text-xs text-slate-500">{a.gender}</span>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Sport *</Label>
                  <Select value={form.sport_id} onValueChange={(v) => setForm({ ...form, sport_id: v, discipline_id: "" })}>
                    <SelectTrigger><SelectValue placeholder="Sport…" /></SelectTrigger>
                    <SelectContent>
                      {sports.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Discipline</Label>
                  <Select value={form.discipline_id || "none"} onValueChange={(v) => setForm({ ...form, discipline_id: v === "none" ? "" : v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">—</SelectItem>
                      {formDisciplines.map((d) => (
                        <SelectItem key={d.id} value={d.id}>{d.name} ({d.gender})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
              <Button type="submit" disabled={saving} className="bg-indigo-500 hover:bg-indigo-600">
                {saving ? "Enregistrement…" : "Ajouter"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
