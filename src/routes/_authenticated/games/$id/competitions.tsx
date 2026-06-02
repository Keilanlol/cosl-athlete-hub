import { createFileRoute } from "@tanstack/react-router";
import { friendlyError } from "@/lib/error-messages";
import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2, Download, Pencil } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import {
  GENDERS,
  MEDAL_LABELS,
  ROUND_OPTIONS,
  type AthleteResult,
  type Discipline,
  type GameCompetition,
  type Sport,
} from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AddressSearch } from "@/components/AddressSearch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
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
import { EmptyState, TableSkeleton } from "@/components/DataTableShell";

export const Route = createFileRoute("/_authenticated/games/$id/competitions")({
  component: CompetitionsPage,
});

const ALL = "__all";

type ResultRow = AthleteResult & {
  athlete: { first_name: string; last_name: string; cosl_id: string } | null;
  game_competition: { name: string } | null;
  sport: { name: string } | null;
  discipline: { name: string } | null;
};

function medalBadge(m: AthleteResult["medal"]) {
  if (!m) return <span className="text-muted-foreground">—</span>;
  const meta = MEDAL_LABELS.find((x) => x.value === m);
  return <Badge className={`${meta?.cls} hover:${meta?.cls}`}>{meta?.label}</Badge>;
}

function CompetitionsPage() {
  const { id } = Route.useParams();
  const [comps, setComps] = useState<GameCompetition[] | null>(null);
  const [results, setResults] = useState<ResultRow[] | null>(null);
  const [sports, setSports] = useState<Sport[]>([]);
  const [disciplines, setDisciplines] = useState<Discipline[]>([]);
  const [allowedSportIds, setAllowedSportIds] = useState<Set<string>>(new Set());
  const [allowedDisciplineIdsBySport, setAllowedDisciplineIdsBySport] = useState<Record<string, Set<string>>>({});

  const [compOpen, setCompOpen] = useState(false);
  const [compForm, setCompForm] = useState({
    sport_id: "",
    discipline_id: "",
    name: "",
    round: "",
    gender: "mixed",
    category: "",
    competition_date: "",
    venue: "",
    postcode: "",
    city: "",
    country: "",
    min_age: "",
    max_age: "",
    notes: "",
  });
  const [delComp, setDelComp] = useState<GameCompetition | null>(null);
  const [editingComp, setEditingComp] = useState<GameCompetition | null>(null);
  const [viewComp, setViewComp] = useState<GameCompetition | null>(null);
  const [selRows, setSelRows] = useState<Array<{ athlete_id: string; athlete: { first_name: string; last_name: string; cosl_id: string; gender: string } | null }>>([]);
  const [resultDlgOpen, setResultDlgOpen] = useState(false);
  const [resultForm, setResultForm] = useState({ athlete_id: "", rank: "", medal: "", score: "", unit: "", is_national_record: false, is_personal_best: false });

  const [fSport, setFSport] = useState(ALL);
  const [fMedal, setFMedal] = useState(ALL);

  const load = async () => {
    setComps(null);
    setResults(null);
    const [{ data: c }, { data: r }, { data: sp }, { data: di }, { data: gs }] = await Promise.all([
      supabase
        .from("game_competitions")
        .select("*")
        .eq("game_id", id)
        .order("competition_date", { ascending: true, nullsFirst: false }),
      supabase
        .from("athlete_results")
        .select(
          "*, athlete:athletes(first_name,last_name,cosl_id), game_competition:game_competitions(name), sport:sports(name), discipline:disciplines(name)",
        )
        .eq("game_id", id)
        .order("rank", { ascending: true, nullsFirst: false }),
      supabase.from("sports").select("*").order("name"),
      supabase.from("disciplines").select("*").order("name"),
      supabase
        .from("game_sports")
        .select("id, sport_id, is_active, game_sport_disciplines(discipline_id)")
        .eq("game_id", id),
    ]);
    setComps((c ?? []) as GameCompetition[]);
    setResults((r ?? []) as ResultRow[]);
    setSports((sp ?? []) as Sport[]);
    setDisciplines((di ?? []) as Discipline[]);
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

  const openComp = async (c: GameCompetition) => {
    setViewComp(c);
    setSelRows([]);
    let query = supabase
      .from("selections")
      .select("athlete_id, athlete:athletes(first_name,last_name,cosl_id,gender)")
      .eq("game_id", id)
      .eq("sport_id", c.sport_id)
      .in("status", ["selected", "reserve"]);
    if (c.discipline_id) query = query.eq("discipline_id", c.discipline_id);
    const { data } = await query;
    setSelRows(((data ?? []) as unknown) as typeof selRows);
  };

  const compResults = useMemo(
    () => (results ?? []).filter((r) => r.game_competition_id === viewComp?.id)
      .sort((a, b) => (a.rank ?? 999) - (b.rank ?? 999)),
    [results, viewComp],
  );

  const submitResult = async () => {
    if (!viewComp || !resultForm.athlete_id) return toast.error("Athlète requis");
    const { error } = await supabase.from("athlete_results").insert({
      athlete_id: resultForm.athlete_id,
      game_id: id,
      game_competition_id: viewComp.id,
      sport_id: viewComp.sport_id,
      discipline_id: viewComp.discipline_id,
      result_date: viewComp.competition_date,
      rank: resultForm.rank ? Number(resultForm.rank) : null,
      medal: resultForm.medal || null,
      score: resultForm.score || null,
      unit: resultForm.unit || null,
      is_national_record: resultForm.is_national_record,
      is_personal_best: resultForm.is_personal_best,
    });
    if (error) return toast.error("Échec", { description: friendlyError(error) });
    toast.success("Résultat enregistré");
    setResultDlgOpen(false);
    setResultForm({ athlete_id: "", rank: "", medal: "", score: "", unit: "", is_national_record: false, is_personal_best: false });
    await load();
  };

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

  return (
    <div className="space-y-8">
      {/* Section A — Épreuves */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Épreuves du Games</h2>
            <p className="text-sm text-muted-foreground">Définissez les épreuves spécifiques (rounds, catégories…).</p>
          </div>
          <Button onClick={() => setCompOpen(true)} className="bg-indigo-500 hover:bg-indigo-600">
            <Plus className="mr-2 h-4 w-4" /> Ajouter une épreuve
          </Button>
        </div>
        <div className="rounded-lg border border-border bg-card">
          {comps === null ? (
            <TableSkeleton cols={8} />
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
                  <TableHead>Lieu</TableHead>
                  <TableHead>Âge</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {comps.map((c) => (
                  <TableRow key={c.id} className="cursor-pointer hover:bg-muted" onClick={() => openComp(c)}>
                    <TableCell>{sports.find((s) => s.id === c.sport_id)?.name ?? "—"}</TableCell>
                    <TableCell>{disciplines.find((d) => d.id === c.discipline_id)?.name ?? "—"}</TableCell>
                    <TableCell className="font-medium text-indigo-700">{c.name}</TableCell>
                    <TableCell>{c.round ?? "—"}</TableCell>
                    <TableCell>{GENDERS.find((g) => g.value === c.gender)?.label ?? "—"}</TableCell>
                    <TableCell>{c.competition_date ?? "—"}</TableCell>
                    <TableCell>{c.venue ?? "—"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {c.min_age != null && c.max_age != null
                        ? `${c.min_age}–${c.max_age} ans`
                        : c.min_age != null
                        ? `≥ ${c.min_age} ans`
                        : c.max_age != null
                        ? `≤ ${c.max_age} ans`
                        : "—"}
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

      {/* Section B — Résultats */}
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
                {MEDAL_LABELS.map((m) => (<SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>))}
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
                    <TableCell>{medalBadge(r.medal)}</TableCell>
                    <TableCell>{r.score ? `${r.score}${r.unit ? " " + r.unit : ""}` : "—"}</TableCell>
                    <TableCell>{r.is_national_record ? <Badge className="bg-indigo-100 text-indigo-700 hover:bg-indigo-100">RN</Badge> : "—"}</TableCell>
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
                  {ROUND_OPTIONS.map((r) => (<SelectItem key={r} value={r}>{r}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Genre</Label>
              <Select value={compForm.gender} onValueChange={(v) => setCompForm({ ...compForm, gender: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {GENDERS.map((g) => (<SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>))}
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
              <Input
                type="number"
                min={0}
                max={120}
                value={compForm.min_age}
                onChange={(e) => setCompForm({ ...compForm, min_age: e.target.value })}
                placeholder="ex: 16"
              />
            </div>
            <div className="space-y-1">
              <Label>Âge maximum</Label>
              <Input
                type="number"
                min={0}
                max={120}
                value={compForm.max_age}
                onChange={(e) => setCompForm({ ...compForm, max_age: e.target.value })}
                placeholder="ex: 23"
              />
            </div>
            <div className="sm:col-span-2 space-y-1">
              <Label>Notes</Label>
              <Textarea value={compForm.notes} onChange={(e) => setCompForm({ ...compForm, notes: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCompOpen(false)}>Annuler</Button>
            <Button onClick={submitComp} className="bg-indigo-500 hover:bg-indigo-600">{editingComp ? "Enregistrer" : "Créer"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Détail d'une épreuve */}
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
                <div><div className="text-xs text-muted-foreground">Round</div><div>{viewComp.round ?? "—"}</div></div>
                <div><div className="text-xs text-muted-foreground">Genre</div><div>{GENDERS.find((g) => g.value === viewComp.gender)?.label ?? "—"}</div></div>
                <div><div className="text-xs text-muted-foreground">Date</div><div>{viewComp.competition_date ?? "—"}</div></div>
                <div><div className="text-xs text-muted-foreground">Lieu</div><div>{viewComp.venue ?? "—"}</div></div>
                <div><div className="text-xs text-muted-foreground">Catégorie</div><div>{viewComp.category ?? "—"}</div></div>
              </div>

              <section>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-semibold">Classement & médailles</h4>
                  <Button size="sm" onClick={() => setResultDlgOpen(true)} className="bg-indigo-500 hover:bg-indigo-600">
                    <Plus className="mr-1 h-3 w-3" /> Ajouter résultat
                  </Button>
                </div>
                <div className="rounded-md border border-border">
                  {compResults.length === 0 ? (
                    <p className="p-4 text-sm text-muted-foreground">Aucun résultat enregistré pour cette épreuve.</p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-16">Rang</TableHead>
                          <TableHead>Athlète</TableHead>
                          <TableHead>Médaille</TableHead>
                          <TableHead>Score</TableHead>
                          <TableHead>RN/PB</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {compResults.map((r) => (
                          <TableRow key={r.id} className={r.medal === "gold" ? "bg-amber-50" : ""}>
                            <TableCell className="font-semibold">{r.rank ?? "—"}</TableCell>
                            <TableCell>{r.athlete ? `${r.athlete.last_name} ${r.athlete.first_name}` : "—"} <span className="text-xs text-muted-foreground ml-1">{r.athlete?.cosl_id}</span></TableCell>
                            <TableCell>{medalBadge(r.medal)}</TableCell>
                            <TableCell>{r.score ? `${r.score}${r.unit ? " " + r.unit : ""}` : "—"}</TableCell>
                            <TableCell className="space-x-1">
                              {r.is_national_record && <Badge className="bg-indigo-100 text-indigo-700 hover:bg-indigo-100">RN</Badge>}
                              {r.is_personal_best && <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">PB</Badge>}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </div>
              </section>

              <section>
                <h4 className="text-sm font-semibold mb-2">Participants sélectionnés ({selRows.length})</h4>
                <div className="rounded-md border border-border max-h-56 overflow-auto">
                  {selRows.length === 0 ? (
                    <p className="p-4 text-sm text-muted-foreground">Aucune sélection liée à ce sport/discipline.</p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Athlète</TableHead>
                          <TableHead>COSL ID</TableHead>
                          <TableHead>Genre</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {selRows.map((s) => (
                          <TableRow key={s.athlete_id}>
                            <TableCell>{s.athlete ? `${s.athlete.last_name} ${s.athlete.first_name}` : "—"}</TableCell>
                            <TableCell className="font-mono text-xs">{s.athlete?.cosl_id ?? "—"}</TableCell>
                            <TableCell><Badge variant="outline">{s.athlete?.gender}</Badge></TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </div>
              </section>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Ajout résultat dans le détail d'une épreuve */}
      <Dialog open={resultDlgOpen} onOpenChange={setResultDlgOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Ajouter un résultat</DialogTitle></DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2 space-y-1">
              <Label>Athlète *</Label>
              <Select value={resultForm.athlete_id} onValueChange={(v) => setResultForm({ ...resultForm, athlete_id: v })}>
                <SelectTrigger><SelectValue placeholder="Choisir parmi les sélectionnés" /></SelectTrigger>
                <SelectContent>
                  {selRows.map((s) => (
                    <SelectItem key={s.athlete_id} value={s.athlete_id}>
                      {s.athlete ? `${s.athlete.last_name} ${s.athlete.first_name}` : s.athlete_id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Rang</Label>
              <Input type="number" min={1} value={resultForm.rank} onChange={(e) => setResultForm({ ...resultForm, rank: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>Médaille</Label>
              <Select value={resultForm.medal || "none"} onValueChange={(v) => setResultForm({ ...resultForm, medal: v === "none" ? "" : v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">—</SelectItem>
                  {MEDAL_LABELS.map((m) => (<SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Score</Label>
              <Input value={resultForm.score} onChange={(e) => setResultForm({ ...resultForm, score: e.target.value })} placeholder="10.18" />
            </div>
            <div className="space-y-1">
              <Label>Unité</Label>
              <Input value={resultForm.unit} onChange={(e) => setResultForm({ ...resultForm, unit: e.target.value })} placeholder="s, m, pts…" />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={resultForm.is_national_record} onCheckedChange={(v) => setResultForm({ ...resultForm, is_national_record: !!v })} />
              Record national
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={resultForm.is_personal_best} onCheckedChange={(v) => setResultForm({ ...resultForm, is_personal_best: !!v })} />
              Record personnel
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResultDlgOpen(false)}>Annuler</Button>
            <Button onClick={submitResult} className="bg-indigo-500 hover:bg-indigo-600">Enregistrer</Button>
          </DialogFooter>
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
