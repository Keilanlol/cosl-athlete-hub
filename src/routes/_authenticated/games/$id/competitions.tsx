import { createFileRoute } from "@tanstack/react-router";
import { friendlyError } from "@/lib/error-messages";
import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2, Download, Pencil, Check, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import {
  type AthleteResult,
  type Discipline,
  type GameCompetition,
  type Sport,
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
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { EmptyState, TableSkeleton } from "@/components/DataTableShell";

export const Route = createFileRoute("/_authenticated/games/$id/competitions")({
  component: CompetitionsPage,
});

const ALL = "__all";

type ParticipantRow = AthleteResult & {
  athlete: { id: string; first_name: string; last_name: string; cosl_id: string; gender: string } | null;
  game_competition: { name: string } | null;
  sport: { name: string } | null;
  discipline: { name: string } | null;
};

type AthleteLite = {
  id: string; first_name: string; last_name: string; cosl_id: string; gender: string;
};

function medalBadge(m: AthleteResult["medal"], medalTypesHook: ReturnType<typeof useTypeGroup>) {
  if (!m) return <span className="text-muted-foreground">—</span>;
  const meta = medalTypesHook.findItem(m);
  const cls = meta ? clsForCode("medal_types", m) : "";
  return <Badge className={`${cls} hover:${cls}`}>{meta?.label}</Badge>;
}

function CompetitionsPage() {
  const { id } = Route.useParams();
  const roundsHook = useTypeGroup("competition_rounds");
  const gendersHook = useTypeGroup("genders");
  const medalTypesHook = useTypeGroup("medal_types");
  const [comps, setComps] = useState<GameCompetition[] | null>(null);
  const [results, setResults] = useState<ParticipantRow[] | null>(null);
  const [sports, setSports] = useState<Sport[]>([]);
  const [disciplines, setDisciplines] = useState<Discipline[]>([]);
  const [athletes, setAthletes] = useState<AthleteLite[]>([]);
  const [allowedSportIds, setAllowedSportIds] = useState<Set<string>>(new Set());
  const [allowedDisciplineIdsBySport, setAllowedDisciplineIdsBySport] = useState<Record<string, Set<string>>>({});

  const [compOpen, setCompOpen] = useState(false);
  const [compForm, setCompForm] = useState({
    sport_id: "", discipline_id: "", name: "", round: "", gender: "mixed",
    category: "", competition_date: "", venue: "", postcode: "", city: "",
    country: "", min_age: "", max_age: "", notes: "",
  });
  const [delComp, setDelComp] = useState<GameCompetition | null>(null);
  const [editingComp, setEditingComp] = useState<GameCompetition | null>(null);

  // Detail dialog
  const [viewComp, setViewComp] = useState<GameCompetition | null>(null);
  const [compParticipants, setCompParticipants] = useState<ParticipantRow[]>([]);
  const [addAthleteOpen, setAddAthleteOpen] = useState(false);
  const [athletePickerOpen, setAthletePickerOpen] = useState(false);

  // Inline editing state: resultId → { field: value }
  const [editingResult, setEditingResult] = useState<Record<string, Record<string, string>>>({});

  const [fSport, setFSport] = useState(ALL);
  const [fMedal, setFMedal] = useState(ALL);

  const load = async () => {
    setComps(null);
    setResults(null);
    const [{ data: c }, { data: r }, { data: sp }, { data: di }, { data: gs }, { data: ath }] = await Promise.all([
      supabase
        .from("game_competitions")
        .select("*")
        .eq("game_id", id)
        .order("competition_date", { ascending: true, nullsFirst: false }),
      supabase
        .from("athlete_results")
        .select(
          "*, athlete:athletes(id,first_name,last_name,cosl_id,gender), game_competition:game_competitions(name), sport:sports(name), discipline:disciplines(name)",
        )
        .eq("game_id", id)
        .order("rank", { ascending: true, nullsFirst: false }),
      supabase.from("sports").select("*").order("name"),
      supabase.from("disciplines").select("*").order("name"),
      supabase
        .from("game_sports")
        .select("id, sport_id, is_active, game_sport_disciplines(discipline_id)")
        .eq("game_id", id),
      supabase.from("athletes").select("id,first_name,last_name,cosl_id,gender").eq("is_active", true).order("last_name"),
    ]);
    setComps((c ?? []) as GameCompetition[]);
    setResults((r ?? []) as ParticipantRow[]);
    setSports((sp ?? []) as Sport[]);
    setDisciplines((di ?? []) as Discipline[]);
    setAthletes((ath ?? []) as AthleteLite[]);
    const allowed = new Set<string>();
    const byS: Record<string, Set<string>> = {};
    ((gs ?? []) as Array<{ sport_id: string; is_active: boolean | null; game_sport_disciplines: Array<{ discipline_id: string }> }>).forEach((row) => {
      if (row.is_active === false) return;
      allowed.add(row.sport_id);
      byS[row.sport_id] = new Set((row.game_sport_disciplines ?? []).map((d) => d.discipline_id));
    });
    setAllowedSportIds(allowed);
    setAllowedDisciplineIdsBySport(byS);
  };

  useEffect(() => { load(); }, [id]);

  const submitComp = async () => {
    if (!compForm.sport_id) return toast.error("Sport requis");
    if (!compForm.name.trim()) return toast.error("Nom de l'épreuve requis");
    const payload = {
      game_id: id,
      sport_id: compForm.sport_id,
      discipline_id: compForm.discipline_id || null,
      name: compForm.name.trim(),
      round: compForm.round || null,
      gender: compForm.gender || null,
      category: compForm.category.trim() || null,
      competition_date: compForm.competition_date || null,
      venue: compForm.venue.trim() || null,
      postcode: compForm.postcode.trim() || null,
      city: compForm.city.trim() || null,
      country: compForm.country.trim() || null,
      min_age: compForm.min_age ? parseInt(compForm.min_age, 10) : null,
      max_age: compForm.max_age ? parseInt(compForm.max_age, 10) : null,
      notes: compForm.notes.trim() || null,
    };
    const { error } = editingComp
      ? await supabase.from("game_competitions").update(payload).eq("id", editingComp.id)
      : await supabase.from("game_competitions").insert(payload);
    if (error) return toast.error("Échec", { description: friendlyError(error) });
    toast.success(editingComp ? "Épreuve modifiée" : "Épreuve ajoutée");
    setCompOpen(false);
    setEditingComp(null);
    setCompForm({ sport_id: "", discipline_id: "", name: "", round: "", gender: "mixed", category: "", competition_date: "", venue: "", postcode: "", city: "", country: "", min_age: "", max_age: "", notes: "" });
    load();
  };

  const openEditComp = (c: GameCompetition) => {
    setEditingComp(c);
    setCompForm({
      sport_id: c.sport_id,
      discipline_id: c.discipline_id ?? "",
      name: c.name,
      round: c.round ?? "",
      gender: c.gender ?? "mixed",
      category: c.category ?? "",
      competition_date: c.competition_date ?? "",
      venue: c.venue ?? "",
      postcode: c.postcode ?? "",
      city: c.city ?? "",
      country: c.country ?? "",
      min_age: c.min_age != null ? String(c.min_age) : "",
      max_age: c.max_age != null ? String(c.max_age) : "",
      notes: c.notes ?? "",
    });
    setCompOpen(true);
  };

  const removeComp = async () => {
    if (!delComp) return;
    const { error } = await supabase.from("game_competitions").delete().eq("id", delComp.id);
    if (error) toast.error("Échec", { description: friendlyError(error) });
    else { toast.success("Épreuve supprimée"); load(); }
    setDelComp(null);
  };

  // Open detail dialog — load participants for this competition
  const openComp = async (c: GameCompetition) => {
    setViewComp(c);
    const { data } = await supabase
      .from("athlete_results")
      .select("*, athlete:athletes(id,first_name,last_name,cosl_id,gender)")
      .eq("game_competition_id", c.id)
      .order("rank", { ascending: true, nullsFirst: true });
    setCompParticipants((data ?? []) as ParticipantRow[]);
    setEditingResult({});
  };

  // Add an athlete to a competition (creates an athlete_result with rank=null)
  const addAthleteToComp = async (athleteId: string) => {
    if (!viewComp) return;
    // Check if already exists
    const existing = compParticipants.find((p) => p.athlete_id === athleteId);
    if (existing) {
      toast.info("Cet athlète est déjà dans l'épreuve");
      return;
    }
    // Validation du genre : refuser si l'athlète ne correspond pas à l'épreuve
    const athlete = athletes.find((a) => a.id === athleteId);
    if (athlete && viewComp.gender && viewComp.gender !== "mixed" && athlete.gender !== viewComp.gender) {
      const genderLabel = gendersHook.getLabel(viewComp.gender);
      toast.error("Genre incompatible", {
        description: `Cette épreuve est ${genderLabel.toLowerCase()}. L'athlète ne peut pas y participer.`,
      });
      return;
    }
    // Validation du sport : refuser si l'athlète n'est pas sélectionné dans ce sport
    const sportKey = viewComp.sport_id ?? "__no_sport__";
    const sportAthletes = selectedAthletes.get(sportKey) ?? new Set<string>();
    if (!sportAthletes.has(athleteId)) {
      const sportName = sports.find((s) => s.id === viewComp.sport_id)?.name ?? "ce sport";
      toast.error("Sport incompatible", {
        description: `L'athlète n'est pas sélectionné(e) en ${sportName} pour ce Games.`,
      });
      return;
    }
    const { error } = await supabase.from("athlete_results").insert({
      athlete_id: athleteId,
      game_id: id,
      game_competition_id: viewComp.id,
      sport_id: viewComp.sport_id,
      discipline_id: viewComp.discipline_id,
      result_date: viewComp.competition_date,
      rank: null,
      medal: null,
      score: null,
      unit: null,
      is_national_record: false,
      is_personal_best: false,
    });
    if (error) {
      toast.error("Échec", { description: friendlyError(error) });
      return;
    }
    toast.success("Athlète ajouté à l'épreuve");
    setAddAthleteOpen(false);
    // Refresh participants
    const { data } = await supabase
      .from("athlete_results")
      .select("*, athlete:athletes(id,first_name,last_name,cosl_id,gender)")
      .eq("game_competition_id", viewComp.id)
      .order("rank", { ascending: true, nullsFirst: true });
    setCompParticipants((data ?? []) as ParticipantRow[]);
    load();
  };

  // Remove an athlete from a competition
  const removeParticipant = async (resultId: string) => {
    const { error } = await supabase.from("athlete_results").delete().eq("id", resultId);
    if (error) toast.error("Échec", { description: friendlyError(error) });
    else {
      toast.success("Athlète retiré de l'épreuve");
      if (viewComp) {
        const { data } = await supabase
          .from("athlete_results")
          .select("*, athlete:athletes(id,first_name,last_name,cosl_id,gender)")
          .eq("game_competition_id", viewComp.id)
          .order("rank", { ascending: true, nullsFirst: true });
        setCompParticipants((data ?? []) as ParticipantRow[]);
      }
      load();
    }
  };

  // Save inline result edit
  const saveResult = async (resultId: string) => {
    const edits = editingResult[resultId];
    if (!edits) return;
    const patch: Record<string, unknown> = {};
    if (edits.rank !== undefined) patch.rank = edits.rank ? Number(edits.rank) : null;
    if (edits.medal !== undefined) patch.medal = edits.medal || null;
    if (edits.score !== undefined) patch.score = edits.score || null;
    if (edits.unit !== undefined) patch.unit = edits.unit || null;
    if (edits.is_national_record !== undefined) patch.is_national_record = edits.is_national_record === "true";
    if (edits.is_personal_best !== undefined) patch.is_personal_best = edits.is_personal_best === "true";

    const { error } = await supabase.from("athlete_results").update(patch).eq("id", resultId);
    if (error) {
      toast.error("Échec", { description: friendlyError(error) });
      return;
    }
    toast.success("Résultat enregistré");
    setEditingResult((prev) => {
      const next = { ...prev };
      delete next[resultId];
      return next;
    });
    // Refresh
    if (viewComp) {
      const { data } = await supabase
        .from("athlete_results")
        .select("*, athlete:athletes(id,first_name,last_name,cosl_id,gender)")
        .eq("game_competition_id", viewComp.id)
        .order("rank", { ascending: true, nullsFirst: true });
      setCompParticipants((data ?? []) as ParticipantRow[]);
    }
    load();
  };

  // Available athletes for the picker: only those selected for this Games
  // (active selections), filtered by gender and sport of the competition,
  // and not already in the competition.
  const [selectedAthletes, setSelectedAthletes] = useState<Map<string, Set<string>>>(new Map());

  useEffect(() => {
    // Load selected athletes for this game, indexed by sport_id
    const loadSelected = async () => {
      const { data: sels } = await supabase
        .from("selections")
        .select("athlete_id, sport_id, status")
        .eq("game_id", id)
        .in("status", ["pre_selected", "selected", "reserve"]);
      const bySport = new Map<string, Set<string>>();
      (sels ?? []).forEach((s) => {
        const sel = s as { athlete_id: string | null; sport_id: string | null; status: string };
        if (!sel.athlete_id) return;
        const sportKey = sel.sport_id ?? "__no_sport__";
        const set = bySport.get(sportKey) ?? new Set<string>();
        set.add(sel.athlete_id);
        bySport.set(sportKey, set);
      });
      setSelectedAthletes(bySport);
    };
    loadSelected();
  }, [id]);

  const availableAthletes = useMemo(() => {
    if (!viewComp) return [];
    const inComp = new Set(compParticipants.map((p) => p.athlete_id));

    // Filtre par sport : athlètes sélectionnés dans le sport de l'épreuve
    const sportKey = viewComp.sport_id ?? "__no_sport__";
    const sportAthletes = selectedAthletes.get(sportKey) ?? new Set<string>();

    let pool = athletes.filter((a) =>
      sportAthletes.has(a.id) && !inComp.has(a.id)
    );

    // Filtre par genre : l'épreuve a un gender, l'athlète doit correspondre.
    // 'mixed' = tous les genres admis.
    if (viewComp.gender && viewComp.gender !== "mixed") {
      pool = pool.filter((a) => a.gender === viewComp.gender);
    }

    return pool;
  }, [athletes, compParticipants, viewComp, selectedAthletes]);

  const filteredResults = useMemo(() => {
    if (!results) return [];
    return results.filter((r) => {
      if (fSport !== ALL && r.sport_id !== fSport) return false;
      if (fMedal !== ALL && r.medal !== fMedal) return false;
      return true;
    });
  }, [results, fSport, fMedal]);

  const medalCounts = useMemo(() => {
    const c = { gold: 0, silver: 0, bronze: 0 };
    (results ?? []).forEach((r) => { if (r.medal) c[r.medal] += 1; });
    return c;
  }, [results]);

  const exportCsv = () => {
    const header = ["Épreuve", "Athlète", "COSL ID", "Sport", "Discipline", "Classement", "Médaille", "Score", "Unité", "RN", "PB"];
    const csv = [header.join(",")]
      .concat(
        filteredResults.map((r) => [
          r.game_competition?.name ?? "",
          r.athlete ? `${r.athlete.last_name} ${r.athlete.first_name}` : "",
          r.athlete?.cosl_id ?? "",
          r.sport?.name ?? "",
          r.discipline?.name ?? "",
          r.rank ?? "",
          r.medal ?? "",
          r.score ?? "",
          r.unit ?? "",
          r.is_national_record ? "oui" : "",
          r.is_personal_best ? "oui" : "",
        ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")),
      )
      .join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `palmares_games_${id}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const allowedSports = sports.filter((s) => allowedSportIds.has(s.id));
  const allowedDisciplinesForSport = compForm.sport_id ? (allowedDisciplineIdsBySport[compForm.sport_id] ?? new Set<string>()) : new Set<string>();
  const compDisciplines = disciplines.filter((d) =>
    compForm.sport_id
      ? d.sport_id === compForm.sport_id && (allowedDisciplinesForSport.size === 0 || allowedDisciplinesForSport.has(d.id))
      : false,
  );

  // Get the participant count for a competition
  const getParticipantCount = (compId: string): number => {
    return (results ?? []).filter((r) => r.game_competition_id === compId).length;
  };

  return (
    <div className="space-y-8">
      {/* Section A — Épreuves */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Épreuves du Games</h2>
            <p className="text-sm text-muted-foreground">Définissez les épreuves puis ajoutez-y les athlètes et leurs résultats.</p>
          </div>
          <Button onClick={() => setCompOpen(true)} className="bg-primary hover:bg-[var(--cosl-red-dark)]">
            <Plus className="mr-2 h-4 w-4" /> Ajouter une épreuve
          </Button>
        </div>
        <div className="rounded-lg border border-border bg-card">
          {comps === null ? (
            <TableSkeleton cols={9} />
          ) : comps.length === 0 ? (
            <div className="p-6"><EmptyState message="Aucune épreuve définie." /></div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Sport</TableHead>
                  <TableHead>Discipline</TableHead>
                  <TableHead>Épreuve</TableHead>
                  <TableHead>Round</TableHead>
                  <TableHead>Genre</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Athlètes</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {comps.map((c) => (
                  <TableRow key={c.id} className="cursor-pointer hover:bg-muted" onClick={() => openComp(c)}>
                    <TableCell>{sports.find((s) => s.id === c.sport_id)?.name ?? "—"}</TableCell>
                    <TableCell>{disciplines.find((d) => d.id === c.discipline_id)?.name ?? "—"}</TableCell>
                    <TableCell className="font-medium text-primary">{c.name}</TableCell>
                    <TableCell>{roundsHook.getLabel(c.round)}</TableCell>
                    <TableCell>{gendersHook.getLabel(c.gender)}</TableCell>
                    <TableCell>{c.competition_date ?? "—"}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{getParticipantCount(c.id)}</Badge>
                    </TableCell>
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      <Button variant="ghost" size="icon" onClick={() => openEditComp(c)} aria-label="Modifier">
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => setDelComp(c)}>
                        <Trash2 className="h-4 w-4 text-red-600" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </section>

      {/* Section B — Résultats (palmarès global) */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Résultats du Games</h2>
            <div className="mt-1 flex items-center gap-3 text-sm text-foreground">
              <span>🥇 {medalCounts.gold}</span>
              <span>🥈 {medalCounts.silver}</span>
              <span>🥉 {medalCounts.bronze}</span>
              <span className="text-muted-foreground">· Total podiums : {medalCounts.gold + medalCounts.silver + medalCounts.bronze}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Select value={fSport} onValueChange={setFSport}>
              <SelectTrigger className="w-44"><SelectValue placeholder="Sport" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Tous les sports</SelectItem>
                {sports.map((s) => (<SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>))}
              </SelectContent>
            </Select>
            <Select value={fMedal} onValueChange={setFMedal}>
              <SelectTrigger className="w-44"><SelectValue placeholder="Médaille" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Toutes médailles</SelectItem>
                {medalTypesHook.items.map((m) => (<SelectItem key={m.code} value={m.code}>{m.label}</SelectItem>))}
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={exportCsv}>
              <Download className="mr-2 h-4 w-4" /> Export CSV
            </Button>
          </div>
        </div>
        <div className="rounded-lg border border-border bg-card">
          {results === null ? (
            <TableSkeleton cols={7} />
          ) : filteredResults.length === 0 ? (
            <div className="p-6"><EmptyState message="Aucun résultat enregistré." /></div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Épreuve</TableHead>
                  <TableHead>Athlète</TableHead>
                  <TableHead>Classement</TableHead>
                  <TableHead>Médaille</TableHead>
                  <TableHead>Score</TableHead>
                  <TableHead>RN</TableHead>
                  <TableHead>PB</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredResults.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>{r.game_competition?.name ?? "—"}</TableCell>
                    <TableCell>
                      {r.athlete ? `${r.athlete.last_name} ${r.athlete.first_name}` : "—"}
                    </TableCell>
                    <TableCell>{r.rank ?? "—"}</TableCell>
                    <TableCell>{medalBadge(r.medal, medalTypesHook)}</TableCell>
                    <TableCell>{r.score ? `${r.score}${r.unit ? " " + r.unit : ""}` : "—"}</TableCell>
                    <TableCell>{r.is_national_record ? <Badge className="bg-[var(--cosl-red-light)] text-primary hover:bg-[var(--cosl-red-light)]">RN</Badge> : "—"}</TableCell>
                    <TableCell>{r.is_personal_best ? <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">PB</Badge> : "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </section>

      {/* Dialog ajout/édition épreuve */}
      <Dialog open={compOpen} onOpenChange={(o) => { setCompOpen(o); if (!o) setEditingComp(null); }}>
        <DialogContent className="max-w-xl">
          <DialogHeader><DialogTitle>{editingComp ? "Modifier l'épreuve" : "Ajouter une épreuve"}</DialogTitle></DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label>Sport *</Label>
              <Select value={compForm.sport_id} onValueChange={(v) => setCompForm({ ...compForm, sport_id: v, discipline_id: "" })}>
                <SelectTrigger><SelectValue placeholder="Choisir" /></SelectTrigger>
                <SelectContent>
                  {allowedSports.length === 0 ? (
                    <div className="px-3 py-2 text-xs text-muted-foreground">Aucun sport admis. Configurez-les dans l'onglet Sports.</div>
                  ) : (
                    allowedSports.map((s) => (<SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>))
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Discipline</Label>
              <Select value={compForm.discipline_id || ALL} onValueChange={(v) => setCompForm({ ...compForm, discipline_id: v === ALL ? "" : v })}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>—</SelectItem>
                  {compDisciplines.map((d) => (<SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div className="sm:col-span-2 space-y-1">
              <Label>Nom de l'épreuve *</Label>
              <Input value={compForm.name} onChange={(e) => setCompForm({ ...compForm, name: e.target.value })} placeholder="Finale individuelle hommes" />
            </div>
            <div className="space-y-1">
              <Label>Round</Label>
              <Select value={compForm.round || ALL} onValueChange={(v) => setCompForm({ ...compForm, round: v === ALL ? "" : v })}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>—</SelectItem>
                  {roundsHook.items.map((r) => (<SelectItem key={r.code} value={r.code}>{r.label}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Genre</Label>
              <Select value={compForm.gender} onValueChange={(v) => setCompForm({ ...compForm, gender: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {gendersHook.items.map((g) => (<SelectItem key={g.code} value={g.code}>{g.label}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Catégorie</Label>
              <Input value={compForm.category} onChange={(e) => setCompForm({ ...compForm, category: e.target.value })} placeholder="-73kg, U23…" />
            </div>
            <div className="space-y-1">
              <Label>Date</Label>
              <Input type="date" value={compForm.competition_date} onChange={(e) => setCompForm({ ...compForm, competition_date: e.target.value })} />
            </div>
            <div className="sm:col-span-2 space-y-1">
              <Label>Lieu (adresse)</Label>
              <AddressSearch
                value={compForm.venue}
                onChange={(v) => setCompForm({ ...compForm, venue: v })}
                onSelect={(r) => setCompForm({
                  ...compForm,
                  venue: r.street || compForm.venue,
                  postcode: r.postcode || compForm.postcode,
                  city: r.city || compForm.city,
                  country: r.country || compForm.country,
                })}
                placeholder="Stade, salle, adresse…"
              />
            </div>
            <div className="space-y-1">
              <Label>Code postal</Label>
              <Input value={compForm.postcode} onChange={(e) => setCompForm({ ...compForm, postcode: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>Ville</Label>
              <Input value={compForm.city} onChange={(e) => setCompForm({ ...compForm, city: e.target.value })} />
            </div>
            <div className="sm:col-span-2 space-y-1">
              <Label>Pays</Label>
              <Input value={compForm.country} onChange={(e) => setCompForm({ ...compForm, country: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>Âge minimum</Label>
              <Input type="number" min={0} max={120} value={compForm.min_age} onChange={(e) => setCompForm({ ...compForm, min_age: e.target.value })} placeholder="ex: 16" />
            </div>
            <div className="space-y-1">
              <Label>Âge maximum</Label>
              <Input type="number" min={0} max={120} value={compForm.max_age} onChange={(e) => setCompForm({ ...compForm, max_age: e.target.value })} placeholder="ex: 23" />
            </div>
            <div className="sm:col-span-2 space-y-1">
              <Label>Notes</Label>
              <Textarea value={compForm.notes} onChange={(e) => setCompForm({ ...compForm, notes: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCompOpen(false)}>Annuler</Button>
            <Button onClick={submitComp} className="bg-primary hover:bg-[var(--cosl-red-dark)]">{editingComp ? "Enregistrer" : "Créer"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Détail d'une épreuve — athlètes + résultats inline */}
      <Dialog open={!!viewComp} onOpenChange={(o) => !o && setViewComp(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{viewComp?.name}</DialogTitle>
          </DialogHeader>
          {viewComp && (
            <div className="space-y-5">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                <div><div className="text-xs text-muted-foreground">Sport</div><div>{sports.find((s) => s.id === viewComp.sport_id)?.name ?? "—"}</div></div>
                <div><div className="text-xs text-muted-foreground">Discipline</div><div>{disciplines.find((d) => d.id === viewComp.discipline_id)?.name ?? "—"}</div></div>
                <div><div className="text-xs text-muted-foreground">Round</div><div>{roundsHook.getLabel(viewComp.round)}</div></div>
                <div><div className="text-xs text-muted-foreground">Date</div><div>{viewComp.competition_date ?? "—"}</div></div>
              </div>

              {/* Athlètes & résultats */}
              <section>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-semibold">
                    Athlètes & résultats ({compParticipants.length})
                  </h4>
                  <Button size="sm" onClick={() => setAddAthleteOpen(true)} className="bg-primary hover:bg-[var(--cosl-red-dark)]">
                    <Plus className="mr-1 h-3 w-3" /> Ajouter un athlète
                  </Button>
                </div>
                <div className="rounded-md border border-border">
                  {compParticipants.length === 0 ? (
                    <p className="p-4 text-sm text-muted-foreground">
                      Aucun athlète dans cette épreuve. Cliquez sur « Ajouter un athlète » pour commencer.
                    </p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-16">Rang</TableHead>
                          <TableHead>Athlète</TableHead>
                          <TableHead className="w-28">Médaille</TableHead>
                          <TableHead className="w-24">Score</TableHead>
                          <TableHead className="w-20 text-right"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {compParticipants.map((r) => {
                          const isEditing = !!editingResult[r.id];
                          const edits = editingResult[r.id] ?? {};
                          return (
                            <TableRow key={r.id}>
                              <TableCell>
                                {isEditing ? (
                                  <Input
                                    type="number"
                                    className="h-8 w-16"
                                    value={edits.rank ?? r.rank ?? ""}
                                    onChange={(e) => setEditingResult((prev) => ({ ...prev, [r.id]: { ...prev[r.id], rank: e.target.value } }))}
                                  />
                                ) : (
                                  <span className="font-semibold">{r.rank ?? "—"}</span>
                                )}
                              </TableCell>
                              <TableCell>
                                {r.athlete ? `${r.athlete.last_name} ${r.athlete.first_name}` : "—"}
                                <span className="text-xs text-muted-foreground ml-1">{r.athlete?.cosl_id}</span>
                              </TableCell>
                              <TableCell>
                                {isEditing ? (
                                  <Select
                                    value={edits.medal ?? r.medal ?? "none"}
                                    onValueChange={(v) => setEditingResult((prev) => ({ ...prev, [r.id]: { ...prev[r.id], medal: v === "none" ? "" : v } }))}
                                  >
                                    <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="none">—</SelectItem>
                                      {medalTypesHook.items.map((m) => (<SelectItem key={m.code} value={m.code}>{m.label}</SelectItem>))}
                                    </SelectContent>
                                  </Select>
                                ) : (
                                  medalBadge(r.medal, medalTypesHook)
                                )}
                              </TableCell>
                              <TableCell>
                                {isEditing ? (
                                  <div className="flex gap-1">
                                    <Input
                                      className="h-8 w-16"
                                      value={edits.score ?? r.score ?? ""}
                                      onChange={(e) => setEditingResult((prev) => ({ ...prev, [r.id]: { ...prev[r.id], score: e.target.value } }))}
                                      placeholder="10.18"
                                    />
                                    <Input
                                      className="h-8 w-12"
                                      value={edits.unit ?? r.unit ?? ""}
                                      onChange={(e) => setEditingResult((prev) => ({ ...prev, [r.id]: { ...prev[r.id], unit: e.target.value } }))}
                                      placeholder="s"
                                    />
                                  </div>
                                ) : (
                                  <span>{r.score ? `${r.score}${r.unit ? " " + r.unit : ""}` : "—"}</span>
                                )}
                              </TableCell>
                              <TableCell className="text-right">
                                {isEditing ? (
                                  <div className="flex items-center justify-end gap-1">
                                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => saveResult(r.id)} aria-label="Enregistrer">
                                      <Check className="h-4 w-4 text-emerald-600" />
                                    </Button>
                                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditingResult((prev) => { const next = { ...prev }; delete next[r.id]; return next; })} aria-label="Annuler">
                                      <X className="h-4 w-4" />
                                    </Button>
                                  </div>
                                ) : (
                                  <div className="flex items-center justify-end gap-1">
                                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditingResult((prev) => ({ ...prev, [r.id]: {} }))} aria-label="Modifier">
                                      <Pencil className="h-4 w-4" />
                                    </Button>
                                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => removeParticipant(r.id)} aria-label="Retirer">
                                      <Trash2 className="h-4 w-4 text-red-600" />
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
              </section>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Add athlete to competition dialog */}
      <Dialog open={addAthleteOpen} onOpenChange={setAddAthleteOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Ajouter un athlète à l'épreuve</DialogTitle>
          </DialogHeader>
          <div className="py-2">
            <Popover open={athletePickerOpen} onOpenChange={setAthletePickerOpen}>
              <PopoverTrigger asChild>
                <Button type="button" variant="outline" className="w-full justify-between">
                  Choisir un athlète…
                </Button>
              </PopoverTrigger>
              <PopoverContent className="p-0 w-[400px]" align="start">
                <Command>
                  <CommandInput placeholder="Rechercher par nom…" />
                  <CommandList className="max-h-[300px] overflow-y-auto">
                    <CommandEmpty>Aucun athlète trouvé.</CommandEmpty>
                    <CommandGroup>
                      {availableAthletes.map((a) => (
                        <CommandItem
                          key={a.id}
                          value={`${a.first_name} ${a.last_name}`}
                          onSelect={() => addAthleteToComp(a.id)}
                        >
                          {a.first_name} {a.last_name}
                          <span className="ml-auto text-xs text-muted-foreground">{a.gender}</span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!delComp} onOpenChange={(o) => !o && setDelComp(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cette épreuve ?</AlertDialogTitle>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={removeComp} className="bg-red-600 hover:bg-red-700">Supprimer</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}