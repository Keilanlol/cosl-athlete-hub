import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2, Download } from "lucide-react";
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
  if (!m) return <span className="text-slate-400">—</span>;
  const meta = MEDAL_LABELS.find((x) => x.value === m);
  return <Badge className={`${meta?.cls} hover:${meta?.cls}`}>{meta?.label}</Badge>;
}

function CompetitionsPage() {
  const { id } = Route.useParams();
  const [comps, setComps] = useState<GameCompetition[] | null>(null);
  const [results, setResults] = useState<ResultRow[] | null>(null);
  const [sports, setSports] = useState<Sport[]>([]);
  const [disciplines, setDisciplines] = useState<Discipline[]>([]);

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
    notes: "",
  });
  const [delComp, setDelComp] = useState<GameCompetition | null>(null);
  const [viewComp, setViewComp] = useState<GameCompetition | null>(null);
  const [selRows, setSelRows] = useState<Array<{ athlete_id: string; athlete: { first_name: string; last_name: string; cosl_id: string; gender: string } | null }>>([]);
  const [resultDlgOpen, setResultDlgOpen] = useState(false);
  const [resultForm, setResultForm] = useState({ athlete_id: "", rank: "", medal: "", score: "", unit: "", is_national_record: false, is_personal_best: false });

  const [fSport, setFSport] = useState(ALL);
  const [fMedal, setFMedal] = useState(ALL);

  const load = async () => {
    setComps(null);
    setResults(null);
    const [{ data: c }, { data: r }, { data: sp }, { data: di }] = await Promise.all([
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
    ]);
    setComps((c ?? []) as GameCompetition[]);
    setResults((r ?? []) as ResultRow[]);
    setSports((sp ?? []) as Sport[]);
    setDisciplines((di ?? []) as Discipline[]);
  };

  useEffect(() => { load(); }, [id]);

  const submitComp = async () => {
    if (!compForm.sport_id) return toast.error("Sport requis");
    if (!compForm.name.trim()) return toast.error("Nom de l'épreuve requis");
    const { error } = await supabase.from("game_competitions").insert({
      game_id: id,
      sport_id: compForm.sport_id,
      discipline_id: compForm.discipline_id || null,
      name: compForm.name.trim(),
      round: compForm.round || null,
      gender: compForm.gender || null,
      category: compForm.category.trim() || null,
      competition_date: compForm.competition_date || null,
      venue: compForm.venue.trim() || null,
      notes: compForm.notes.trim() || null,
    });
    if (error) return toast.error("Échec", { description: error.message });
    toast.success("Épreuve ajoutée");
    setCompOpen(false);
    setCompForm({ sport_id: "", discipline_id: "", name: "", round: "", gender: "mixed", category: "", competition_date: "", venue: "", notes: "" });
    load();
  };

  const removeComp = async () => {
    if (!delComp) return;
    const { error } = await supabase.from("game_competitions").delete().eq("id", delComp.id);
    if (error) toast.error("Échec", { description: error.message });
    else { toast.success("Épreuve supprimée"); load(); }
    setDelComp(null);
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

  const compDisciplines = disciplines.filter((d) => !compForm.sport_id || d.sport_id === compForm.sport_id);

  return (
    <div className="space-y-8">
      {/* Section A — Épreuves */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Épreuves du Games</h2>
            <p className="text-sm text-slate-500">Définissez les épreuves spécifiques (rounds, catégories…).</p>
          </div>
          <Button onClick={() => setCompOpen(true)} className="bg-indigo-500 hover:bg-indigo-600">
            <Plus className="mr-2 h-4 w-4" /> Ajouter une épreuve
          </Button>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white">
          {comps === null ? (
            <TableSkeleton cols={7} />
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
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {comps.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell>{sports.find((s) => s.id === c.sport_id)?.name ?? "—"}</TableCell>
                    <TableCell>{disciplines.find((d) => d.id === c.discipline_id)?.name ?? "—"}</TableCell>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell>{c.round ?? "—"}</TableCell>
                    <TableCell>{GENDERS.find((g) => g.value === c.gender)?.label ?? "—"}</TableCell>
                    <TableCell>{c.competition_date ?? "—"}</TableCell>
                    <TableCell>{c.venue ?? "—"}</TableCell>
                    <TableCell className="text-right">
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
            <h2 className="text-lg font-semibold text-slate-900">Résultats du Games</h2>
            <div className="mt-1 flex items-center gap-3 text-sm text-slate-700">
              <span>🥇 {medalCounts.gold}</span>
              <span>🥈 {medalCounts.silver}</span>
              <span>🥉 {medalCounts.bronze}</span>
              <span className="text-slate-500">· Total podiums : {medalCounts.gold + medalCounts.silver + medalCounts.bronze}</span>
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
        <div className="rounded-lg border border-slate-200 bg-white">
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

      {/* Dialog ajout épreuve */}
      <Dialog open={compOpen} onOpenChange={setCompOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader><DialogTitle>Ajouter une épreuve</DialogTitle></DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label>Sport *</Label>
              <Select value={compForm.sport_id} onValueChange={(v) => setCompForm({ ...compForm, sport_id: v, discipline_id: "" })}>
                <SelectTrigger><SelectValue placeholder="Choisir" /></SelectTrigger>
                <SelectContent>
                  {sports.map((s) => (<SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>))}
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
              <Label>Lieu</Label>
              <Input value={compForm.venue} onChange={(e) => setCompForm({ ...compForm, venue: e.target.value })} />
            </div>
            <div className="sm:col-span-2 space-y-1">
              <Label>Notes</Label>
              <Textarea value={compForm.notes} onChange={(e) => setCompForm({ ...compForm, notes: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCompOpen(false)}>Annuler</Button>
            <Button onClick={submitComp} className="bg-indigo-500 hover:bg-indigo-600">Créer</Button>
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
