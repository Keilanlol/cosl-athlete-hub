import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Plus, Search, Lock, Pencil } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { computeAge, checkAgeEligibility } from "@/lib/kyc-utils";
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
  birth_date: string | null;
};
type Sport = { id: string; name: string };
type Discipline = { id: string; sport_id: string; name: string; gender: string };
type Competition = {
  id: string; game_id: string; sport_id: string; discipline_id: string | null;
  name: string; competition_date: string | null;
  min_age: number | null; max_age: number | null;
};
type Selection = {
  id: string; game_id: string; athlete_id: string; sport_id: string;
  discipline_id: string | null; game_competition_id: string | null;
  status: string; is_locked: boolean | null;
  athlete: Athlete | null; sport: Sport | null; discipline: Discipline | null;
  game_competition: Competition | null;
};

function SelectionsPage() {
  const { id: gameId } = Route.useParams();
  const [rows, setRows] = useState<Selection[] | null>(null);
  const [athletes, setAthletes] = useState<Athlete[]>([]);
  const [sports, setSports] = useState<Sport[]>([]);
  const [gameSportIds, setGameSportIds] = useState<string[]>([]);
  const [disciplines, setDisciplines] = useState<Discipline[]>([]);
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [kycMap, setKycMap] = useState<Record<string, string>>({});
  const [quotaSum, setQuotaSum] = useState(0);

  const [search, setSearch] = useState("");
  const [sportFilter, setSportFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [kycFilter, setKycFilter] = useState("all");

  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [form, setForm] = useState({ athlete_id: "", sport_id: "", discipline_id: "", game_competition_id: "" });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setRows(null);
    const [selRes, athRes, sportsRes, gsRes, discRes, kycRes, qRes, compRes] = await Promise.all([
      supabase.from("selections")
        .select("*, athlete:athletes(id,first_name,last_name,gender,photo_url,primary_sport_id,birth_date), sport:sports(id,name), discipline:disciplines(id,sport_id,name,gender), game_competition:game_competitions(id,game_id,sport_id,discipline_id,name,competition_date,min_age,max_age)")
        .eq("game_id", gameId)
        .order("created_at", { ascending: false }),
      supabase.from("athletes").select("id,first_name,last_name,gender,photo_url,primary_sport_id,birth_date").eq("is_active", true).order("last_name"),
      supabase.from("sports").select("id,name").order("name"),
      supabase.from("game_sports").select("sport_id").eq("game_id", gameId).eq("is_active", true),
      supabase.from("disciplines").select("id,sport_id,name,gender").order("name"),
      supabase.from("athlete_kyc").select("athlete_id, global_status"),
      supabase.from("game_quotas").select("quota_max").eq("game_id", gameId),
      supabase.from("game_competitions")
        .select("id,game_id,sport_id,discipline_id,name,competition_date,min_age,max_age")
        .eq("game_id", gameId)
        .order("competition_date", { nullsFirst: false }),
    ]);
    if (selRes.error) toast.error("Erreur sélections", { description: selRes.error.message });
    setRows(((selRes.data ?? []) as unknown) as Selection[]);
    setAthletes((athRes.data ?? []) as Athlete[]);
    setSports((sportsRes.data ?? []) as Sport[]);
    setGameSportIds(((gsRes.data ?? []) as { sport_id: string }[]).map((g) => g.sport_id));
    setDisciplines((discRes.data ?? []) as Discipline[]);
    setCompetitions((compRes.data ?? []) as Competition[]);
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
      game_competition_id: "",
    });
    setPickerOpen(false);
  };

  const selectedAthleteForCheck = useMemo(
    () => athletes.find((a) => a.id === form.athlete_id) ?? null,
    [athletes, form.athlete_id],
  );

  const formCompetitions = useMemo(
    () => competitions.filter((c) => !form.sport_id || c.sport_id === form.sport_id),
    [competitions, form.sport_id],
  );

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.athlete_id || !form.sport_id) {
      toast.error("Athlète et sport requis"); return;
    }
    // Vérification d'âge si une épreuve est choisie
    if (form.game_competition_id) {
      const comp = competitions.find((c) => c.id === form.game_competition_id);
      const ageCheck = checkAgeEligibility(
        selectedAthleteForCheck?.birth_date,
        comp?.min_age,
        comp?.max_age,
        comp?.competition_date,
      );
      if (!ageCheck.eligible) {
        toast.error("Sélection impossible — âge non éligible", { description: ageCheck.reason });
        return;
      }
    }
    setSaving(true);
    const { error } = editingId
      ? await supabase.from("selections").update({
          athlete_id: form.athlete_id,
          sport_id: form.sport_id,
          discipline_id: form.discipline_id || null,
          game_competition_id: form.game_competition_id || null,
        }).eq("id", editingId)
      : await supabase.from("selections").insert({
          game_id: gameId,
          athlete_id: form.athlete_id,
          sport_id: form.sport_id,
          discipline_id: form.discipline_id || null,
          game_competition_id: form.game_competition_id || null,
          status: "pre_selected",
        });
    setSaving(false);
    if (error) {
      toast.error("Échec", { description: friendlyError(error) });
      return;
    }
    toast.success(editingId ? "Sélection mise à jour" : "Athlète pré-sélectionné");
    setOpen(false);
    setEditingId(null);
    setForm({ athlete_id: "", sport_id: "", discipline_id: "", game_competition_id: "" });
    load();
  };

  const openEdit = (sel: Selection) => {
    if (sel.is_locked) { toast.error("Sélection verrouillée"); return; }
    setEditingId(sel.id);
    setForm({
      athlete_id: sel.athlete_id,
      sport_id: sel.sport_id,
      discipline_id: sel.discipline_id ?? "",
      game_competition_id: sel.game_competition_id ?? "",
    });
    setOpen(true);
  };

  const changeStatus = async (sel: Selection, newStatus: string) => {
    if (sel.is_locked) {
      toast.error("Sélection verrouillée"); return;
    }
    if (newStatus === "selected") {
      // Vérification d'âge si épreuve liée
      if (sel.game_competition) {
        const ageCheck = checkAgeEligibility(
          sel.athlete?.birth_date,
          sel.game_competition.min_age,
          sel.game_competition.max_age,
          sel.game_competition.competition_date,
        );
        if (!ageCheck.eligible) {
          toast.error("Sélection impossible — âge non éligible", { description: ageCheck.reason });
          return;
        }
      }
      const { data: kycData } = await supabase
        .from("athlete_kyc")
        .select("global_status, identity_verified, nationality_verified, antidoping_status")
        .eq("athlete_id", sel.athlete_id)
        .maybeSingle();

      if (!kycData || kycData.global_status === "red") {
        toast.error("KYC invalide — Sélection impossible", {
          description: !kycData
            ? "Aucun dossier KYC trouvé pour cet athlète."
            : !kycData.identity_verified
            ? "Identité non vérifiée (axe bloquant)."
            : !kycData.nationality_verified
            ? "Nationalité sportive non vérifiée (axe bloquant)."
            : kycData.antidoping_status === "red"
            ? "Statut antidopage rouge (axe bloquant)."
            : "KYC global non conforme.",
        });
        return;
      }
      if (kycData.global_status === "orange") {
        toast.warning("KYC partiel — Certains axes ne sont pas validés", {
          description:
            "La sélection est possible mais le dossier KYC doit être complété avant l'accréditation.",
        });
      }
    }
    const patch: { status: string; decided_at?: string } = { status: newStatus };
    if (["selected", "reserve", "rejected"].includes(newStatus)) patch.decided_at = new Date().toISOString();
    const { error } = await supabase.from("selections").update(patch).eq("id", sel.id);
    if (error) toast.error("Échec", { description: friendlyError(error) });
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
            {gameSports.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
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
        <Button onClick={() => { setEditingId(null); setForm({ athlete_id: "", sport_id: "", discipline_id: "", game_competition_id: "" }); setOpen(true); }} className="ml-auto bg-indigo-500 hover:bg-indigo-600">
          <Plus className="mr-2 h-4 w-4" /> Ajouter une sélection
        </Button>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white">
        {rows === null ? (
          <TableSkeleton cols={8} />
        ) : filtered.length === 0 ? (
          <div className="p-6"><EmptyState message="Aucune sélection." /></div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Athlète</TableHead>
                <TableHead>Sport</TableHead>
                <TableHead>Discipline</TableHead>
                <TableHead>Épreuve</TableHead>
                <TableHead>Âge</TableHead>
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
                    <TableCell className="text-sm">
                      {r.game_competition ? (
                        <span className="font-medium text-slate-700">{r.game_competition.name}</span>
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs">
                      {(() => {
                        const age = computeAge(r.athlete?.birth_date);
                        if (age == null) return <span className="text-slate-400">—</span>;
                        const comp = r.game_competition;
                        if (!comp || (comp.min_age == null && comp.max_age == null)) {
                          return <span>{age} ans</span>;
                        }
                        const chk = checkAgeEligibility(r.athlete?.birth_date, comp.min_age, comp.max_age, comp.competition_date);
                        return (
                          <span className={chk.eligible ? "text-emerald-700" : "text-red-700 font-medium"}>
                            {age} ans {chk.eligible ? "✓" : "⚠️"}
                          </span>
                        );
                      })()}
                    </TableCell>
                    <TableCell><Badge variant="outline">{r.athlete?.gender ?? "—"}</Badge></TableCell>
                    <TableCell>{sb && <Badge className={`${sb.cls} hover:${sb.cls}`}>{sb.label}</Badge>}</TableCell>
                    <TableCell><Badge className={`${kb.cls} hover:${kb.cls}`}>{kb.label}</Badge></TableCell>
                    <TableCell className="text-right">
                      {r.is_locked ? (
                        <span className="inline-flex items-center text-xs text-slate-500">
                          <Lock className="mr-1 h-3 w-3" /> Verrouillé
                        </span>
                      ) : (
                        <div className="flex items-center justify-end gap-2">
                          <Select value={r.status} onValueChange={(v) => changeStatus(r, v)}>
                            <SelectTrigger className="h-8 w-40"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {SELECTION_STATUSES.map((s) => (
                                <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(r)} title="Modifier">
                            <Pencil className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>

      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setEditingId(null); setForm({ athlete_id: "", sport_id: "", discipline_id: "", game_competition_id: "" }); } }}>
        <DialogContent>
          <form onSubmit={submit}>
            <DialogHeader>
              <DialogTitle>{editingId ? "Modifier la sélection" : "Ajouter une sélection"}</DialogTitle>
              <DialogDescription>{editingId ? "Modifiez l'athlète, le sport ou la discipline." : "L'athlète sera créé en statut Pré-sélectionné."}</DialogDescription>
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
                      {gameSports.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
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
              <div className="space-y-1.5">
                <Label>Épreuve</Label>
                <Select
                  value={form.game_competition_id || "none"}
                  onValueChange={(v) => setForm({ ...form, game_competition_id: v === "none" ? "" : v })}
                >
                  <SelectTrigger><SelectValue placeholder="Aucune épreuve…" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— Aucune (Games en général)</SelectItem>
                    {formCompetitions.map((c) => {
                      const chk = checkAgeEligibility(
                        selectedAthleteForCheck?.birth_date,
                        c.min_age,
                        c.max_age,
                        c.competition_date,
                      );
                      const label = `${c.name}${
                        c.min_age != null || c.max_age != null
                          ? ` · âge ${c.min_age ?? "?"}–${c.max_age ?? "?"}`
                          : ""
                      }`;
                      return (
                        <SelectItem key={c.id} value={c.id}>
                          {selectedAthleteForCheck && !chk.eligible ? "❌ " : ""}
                          {label}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
                {form.game_competition_id && selectedAthleteForCheck && (() => {
                  const c = competitions.find((x) => x.id === form.game_competition_id);
                  const chk = checkAgeEligibility(
                    selectedAthleteForCheck.birth_date,
                    c?.min_age,
                    c?.max_age,
                    c?.competition_date,
                  );
                  return (
                    <p className={`text-xs mt-1 ${chk.eligible ? "text-emerald-700" : "text-red-700 font-medium"}`}>
                      {chk.eligible ? "✓" : "⚠️"} {chk.reason}
                    </p>
                  );
                })()}
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
              <Button type="submit" disabled={saving} className="bg-indigo-500 hover:bg-indigo-600">
                {saving ? "Enregistrement…" : editingId ? "Enregistrer" : "Ajouter"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
