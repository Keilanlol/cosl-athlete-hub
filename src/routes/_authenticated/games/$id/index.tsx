import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2, Settings2, Eye, CheckCircle2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { confirmAction } from "@/components/ConfirmDialog";
import {
  type Game,
  type GameQuota,
  type GameSport,
  type Gender,
  type Sport,
  GENDERS,
} from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useHashTab } from "@/hooks/useHashTab";
import { EditableSelect } from "@/components/EditableSelect";
import { useSports } from "@/hooks/useReferenceData";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";

type AthItem = {
  id: string; first_name: string; last_name: string; gender: Gender;
  photo_url: string | null; kyc: string; selection_status?: string | null;
};

function AthleteList({ items, emptyLabel, showStatus }: { items: AthItem[]; emptyLabel: string; showStatus?: boolean }) {
  if (items.length === 0) return <p className="p-6 text-sm text-slate-500 text-center">{emptyLabel}</p>;
  return (
    <div className="max-h-96 overflow-y-auto divide-y divide-slate-100 rounded-md border border-slate-200">
      {items.map((a) => {
        const initials = `${a.first_name?.[0] ?? ""}${a.last_name?.[0] ?? ""}`;
        const kycCls =
          a.kyc === "green" ? "bg-emerald-100 text-emerald-700" :
          a.kyc === "orange" ? "bg-amber-100 text-amber-700" :
          "bg-red-100 text-red-700";
        const kycLabel = a.kyc === "green" ? "KYC valide" : a.kyc === "orange" ? "KYC en attente" : "KYC invalide";
        return (
          <div key={a.id} className="flex items-center gap-3 px-3 py-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-200 text-xs font-medium text-slate-700 overflow-hidden">
              {a.photo_url ? <img src={a.photo_url} alt="" className="h-full w-full object-cover" /> : initials}
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-slate-900">{a.first_name} {a.last_name}</p>
              <p className="text-xs text-slate-500">{a.gender}</p>
            </div>
            {showStatus && a.selection_status && (
              <Badge variant="outline" className="capitalize">{a.selection_status === "selected" ? "Sélectionné" : "Réserviste"}</Badge>
            )}
            <Badge className={`${kycCls} hover:${kycCls}`}>
              {a.kyc === "green" ? <CheckCircle2 className="mr-1 h-3 w-3" /> : <AlertCircle className="mr-1 h-3 w-3" />}
              {kycLabel}
            </Badge>
          </div>
        );
      })}
    </div>
  );
}

export const Route = createFileRoute("/_authenticated/games/$id/")({
  component: GameOverviewPage,
});

type Discipline = { id: string; sport_id: string; name: string; gender: Gender };

function GameOverviewPage() {
  const { id } = Route.useParams();
  const [tab, setTab] = useHashTab("overview");
  const [game, setGame] = useState<Game | null>(null);
  const [sports, setSports] = useState<Sport[]>([]);
  const [disciplines, setDisciplines] = useState<Discipline[]>([]);
  const [gameSports, setGameSports] = useState<GameSport[]>([]);
  const [quotas, setQuotas] = useState<GameQuota[]>([]);
  const [kpi, setKpi] = useState({ selected: 0, accred: 0, plans: 0 });
  const [loading, setLoading] = useState(true);
  const [gsDiscMap, setGsDiscMap] = useState<Record<string, string[]>>({});
  const [discDlg, setDiscDlg] = useState<GameSport | null>(null);
  const [discPicked, setDiscPicked] = useState<string[]>([]);

  // Add sport dialog
  const [sportDlgOpen, setSportDlgOpen] = useState(false);
  const [newSportId, setNewSportId] = useState<string>("");
  const [newSportDiscIds, setNewSportDiscIds] = useState<string[]>([]);
  const [newDiscName, setNewDiscName] = useState("");
  const [newDiscGender, setNewDiscGender] = useState<Gender>("mixed");
  const { add: addSportRef, remove: removeSportRef } = useSports();

  // Add quota dialog
  const [quotaDlgOpen, setQuotaDlgOpen] = useState(false);
  const [quotaForm, setQuotaForm] = useState({
    sport_id: "",
    discipline_id: "",
    gender: "mixed" as Gender,
    quota_max: 1,
    qualification_deadline: "",
    qualification_criteria: "",
  });

  // Quota details dialog
  type QuotaAthlete = {
    id: string; first_name: string; last_name: string; gender: Gender;
    photo_url: string | null; primary_sport_id: string | null;
    kyc: string; selection_status?: string | null;
  };
  const [detailsQuota, setDetailsQuota] = useState<GameQuota | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsIn, setDetailsIn] = useState<QuotaAthlete[]>([]);
  const [detailsEligible, setDetailsEligible] = useState<QuotaAthlete[]>([]);

  const openDetails = async (q: GameQuota) => {
    setDetailsQuota(q);
    setDetailsLoading(true);
    setDetailsIn([]);
    setDetailsEligible([]);

    const [selRes, athRes, kycRes] = await Promise.all([
      supabase.from("selections")
        .select("status, athlete:athletes(id,first_name,last_name,gender,photo_url,primary_sport_id)")
        .eq("game_id", id)
        .eq("sport_id", q.sport_id),
      supabase.from("athletes")
        .select("id,first_name,last_name,gender,photo_url,primary_sport_id")
        .eq("primary_sport_id", q.sport_id)
        .eq("is_active", true),
      supabase.from("athlete_kyc").select("athlete_id, global_status"),
    ]);

    const kycMap: Record<string, string> = {};
    ((kycRes.data ?? []) as { athlete_id: string; global_status: string }[]).forEach((k) => {
      kycMap[k.athlete_id] = k.global_status;
    });

    const sels = ((selRes.data ?? []) as unknown as Array<{
      status: string;
      athlete: { id: string; first_name: string; last_name: string; gender: Gender; photo_url: string | null; primary_sport_id: string | null } | null;
    }>);

    const matchesGender = (g: Gender | undefined) => q.gender === "mixed" ? true : g === q.gender;

    const inQuota: QuotaAthlete[] = [];
    const usedIds = new Set<string>();
    for (const s of sels) {
      if (!s.athlete) continue;
      if (!["selected", "reserve"].includes(s.status)) continue;
      if (!matchesGender(s.athlete.gender)) continue;
      usedIds.add(s.athlete.id);
      inQuota.push({ ...s.athlete, kyc: kycMap[s.athlete.id] ?? "red", selection_status: s.status });
    }

    const eligible: QuotaAthlete[] = [];
    for (const a of (athRes.data ?? []) as QuotaAthlete[]) {
      if (usedIds.has(a.id)) continue;
      if (!matchesGender(a.gender)) continue;
      eligible.push({ ...a, kyc: kycMap[a.id] ?? "red" });
    }

    setDetailsIn(inQuota);
    setDetailsEligible(eligible);
    setDetailsLoading(false);
  };

  const load = async () => {
    setLoading(true);
    const [gameRes, sportsRes, discRes, gsRes, qRes, selRes, accRes, tpRes, gsdRes] = await Promise.all([
      supabase.from("games").select("*").eq("id", id).maybeSingle(),
      supabase.from("sports").select("*").order("name"),
      supabase.from("disciplines").select("id,sport_id,name,gender").order("name"),
      supabase.from("game_sports").select("*, sport:sports(*)").eq("game_id", id),
      supabase.from("game_quotas").select("*").eq("game_id", id),
      supabase.from("selections").select("id", { count: "exact", head: true }).eq("game_id", id).in("status", ["selected", "reserve"]),
      supabase.from("accreditations").select("id", { count: "exact", head: true }).eq("game_id", id).eq("status", "validated"),
      supabase.from("travel_plans").select("id", { count: "exact", head: true }).eq("game_id", id),
      supabase.from("game_sport_disciplines").select("game_sport_id,discipline_id"),
    ]);
    setLoading(false);
    if (gameRes.error) { toast.error("Erreur", { description: gameRes.error.message }); return; }
    setGame((gameRes.data ?? null) as Game | null);
    setSports((sportsRes.data ?? []) as Sport[]);
    setDisciplines((discRes.data ?? []) as Discipline[]);
    setGameSports((gsRes.data ?? []) as unknown as GameSport[]);
    setQuotas((qRes.data ?? []) as GameQuota[]);
    const map: Record<string, string[]> = {};
    ((gsdRes.data ?? []) as { game_sport_id: string; discipline_id: string }[]).forEach((r) => {
      (map[r.game_sport_id] ||= []).push(r.discipline_id);
    });
    setGsDiscMap(map);
    setKpi({
      selected: selRes.count ?? 0,
      accred: accRes.count ?? 0,
      plans: tpRes.count ?? 0,
    });
  };

  useEffect(() => { load(); }, [id]);

  const activeSportsCount = gameSports.filter((g) => g.is_active).length;

  // Quota fill counts
  const [fills, setFills] = useState<Record<string, number>>({});
  useEffect(() => {
    if (!quotas.length) { setFills({}); return; }
    (async () => {
      const result: Record<string, number> = {};
      // Aggregate selections per sport+discipline+gender
      const { data } = await supabase
        .from("selections")
        .select("sport_id, discipline_id, athlete:athletes(gender)")
        .eq("game_id", id)
        .in("status", ["selected", "reserve"]);
      const sels = (data ?? []) as unknown as Array<{
        sport_id: string;
        discipline_id: string | null;
        athlete: { gender: Gender } | null;
      }>;
      for (const q of quotas) {
        result[q.id] = sels.filter((s) =>
          s.sport_id === q.sport_id &&
          (q.discipline_id ? s.discipline_id === q.discipline_id : true) &&
          (q.gender === "mixed" ? true : s.athlete?.gender === q.gender),
        ).length;
      }
      setFills(result);
    })();
  }, [quotas, id]);

  const sportName = (sid: string) => sports.find((s) => s.id === sid)?.name ?? "—";
  const discName = (did: string | null) => (did ? disciplines.find((d) => d.id === did)?.name ?? "—" : "—");

  const availableSportsToAdd = useMemo(() => {
    const used = new Set(gameSports.map((g) => g.sport_id));
    return sports.filter((s) => !used.has(s.id));
  }, [sports, gameSports]);

  const availableDisciplines = useMemo(() => {
    const sportDiscs = disciplines.filter((d) => d.sport_id === quotaForm.sport_id);
    const gs = gameSports.find((g) => g.sport_id === quotaForm.sport_id);
    const allowed = gs ? gsDiscMap[gs.id] ?? [] : [];
    return allowed.length === 0 ? sportDiscs : sportDiscs.filter((d) => allowed.includes(d.id));
  }, [disciplines, quotaForm.sport_id, gameSports, gsDiscMap]);

  const addSport = async () => {
    if (!newSportId) return;
    const { data: gs, error } = await supabase
      .from("game_sports")
      .insert({ game_id: id, sport_id: newSportId, is_active: true })
      .select()
      .single();
    if (error) {
      toast.error("Échec", { description: error.message });
      return;
    }
    if (gs && newSportDiscIds.length) {
      const { error: e2 } = await supabase.from("game_sport_disciplines").insert(
        newSportDiscIds.map((d) => ({ game_sport_id: gs.id, discipline_id: d })),
      );
      if (e2) toast.error("Disciplines partiellement enregistrées", { description: e2.message });
    }
    toast.success("Sport ajouté");
    setSportDlgOpen(false);
    setNewSportId("");
    setNewSportDiscIds([]);
    load();
  };

  const createDiscipline = async (sportId: string, name: string, gender: Gender) => {
    const trimmed = name.trim();
    if (!sportId || !trimmed) return null;
    const { data, error } = await supabase
      .from("disciplines")
      .insert({ sport_id: sportId, name: trimmed, gender })
      .select()
      .single();
    if (error) {
      toast.error("Échec", { description: error.message });
      return null;
    }
    toast.success("Discipline ajoutée");
    await load();
    return data as Discipline;
  };

  const deleteDiscipline = async (discId: string) => {
    if (!(await confirmAction({ title: "Supprimer cette discipline ?", confirmLabel: "Supprimer" }))) return;
    const { error } = await supabase.from("disciplines").delete().eq("id", discId);
    if (error) return toast.error("Échec", { description: error.message });
    toast.success("Discipline supprimée");
    await load();
  };

  const toggleSport = async (gs: GameSport) => {
    if (gs.is_active) {
      const ok = await confirmAction({ title: "Désactiver ce sport ?", description: "Le sport ne sera plus actif pour ces Games.", confirmLabel: "Désactiver" });
      if (!ok) return;
    }
    const { error } = await supabase.from("game_sports").update({ is_active: !gs.is_active }).eq("id", gs.id);
    if (error) toast.error("Échec", { description: error.message });
    else load();
  };

  const removeSport = async (gs: GameSport) => {
    if (!(await confirmAction({ title: "Retirer ce sport ?", confirmLabel: "Retirer" }))) return;
    const { error } = await supabase.from("game_sports").delete().eq("id", gs.id);
    if (error) toast.error("Échec", { description: error.message });
    else { toast.success("Sport retiré"); load(); }
  };

  const addQuota = async () => {
    if (!quotaForm.sport_id || quotaForm.quota_max < 0) {
      toast.error("Sport et quota requis"); return;
    }
    const { error } = await supabase.from("game_quotas").insert({
      game_id: id,
      sport_id: quotaForm.sport_id,
      discipline_id: quotaForm.discipline_id || null,
      gender: quotaForm.gender,
      quota_max: quotaForm.quota_max,
      qualification_deadline: quotaForm.qualification_deadline || null,
      qualification_criteria: quotaForm.qualification_criteria.trim() || null,
    });
    if (error) toast.error("Échec", { description: error.message });
    else {
      toast.success("Quota ajouté");
      setQuotaDlgOpen(false);
      setQuotaForm({ sport_id: "", discipline_id: "", gender: "mixed", quota_max: 1, qualification_deadline: "", qualification_criteria: "" });
      load();
    }
  };

  const removeQuota = async (q: GameQuota) => {
    if (!(await confirmAction({ title: "Supprimer ce quota ?", confirmLabel: "Supprimer" }))) return;
    const { error } = await supabase.from("game_quotas").delete().eq("id", q.id);
    if (error) toast.error("Échec", { description: error.message });
    else { toast.success("Quota supprimé"); load(); }
  };

  const openDiscDlg = (gs: GameSport) => {
    setDiscDlg(gs);
    setDiscPicked(gsDiscMap[gs.id] ?? []);
  };

  const saveDiscDlg = async () => {
    if (!discDlg) return;
    const current = new Set(gsDiscMap[discDlg.id] ?? []);
    const next = new Set(discPicked);
    const toAdd = [...next].filter((d) => !current.has(d));
    const toRemove = [...current].filter((d) => !next.has(d));
    if (toRemove.length) {
      const { error } = await supabase
        .from("game_sport_disciplines")
        .delete()
        .eq("game_sport_id", discDlg.id)
        .in("discipline_id", toRemove);
      if (error) return toast.error("Échec", { description: error.message });
    }
    if (toAdd.length) {
      const { error } = await supabase.from("game_sport_disciplines").insert(
        toAdd.map((d) => ({ game_sport_id: discDlg.id, discipline_id: d })),
      );
      if (error) return toast.error("Échec", { description: error.message });
    }
    toast.success("Disciplines admises mises à jour");
    setDiscDlg(null);
    load();
  };

  if (loading) return <Skeleton className="h-64 w-full" />;
  if (!game) return null;

  return (
    <Tabs value={tab} onValueChange={setTab} className="space-y-4">
      <TabsList>
        <TabsTrigger value="overview">Vue d'ensemble</TabsTrigger>
        <TabsTrigger value="sports">Sports & Disciplines</TabsTrigger>
        <TabsTrigger value="quotas">Quotas</TabsTrigger>
      </TabsList>

      {/* Overview */}
      <TabsContent value="overview" className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Kpi label="Athlètes sélectionnés" value={kpi.selected} />
          <Kpi label="Sports activés" value={activeSportsCount} />
          <Kpi label="Accréditations validées" value={kpi.accred} />
          <Kpi label="Plans de voyage" value={kpi.plans} />
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-6">
          <h3 className="mb-4 text-base font-semibold">Informations générales</h3>
          <dl className="grid gap-3 sm:grid-cols-2 text-sm">
            <Info label="Acronyme" value={game.short_name} />
            <Info label="Organisateur" value={game.organizer} />
            <Info label="Pays hôte" value={game.host_country} />
            <Info label="Ville hôte" value={game.host_city} />
            <Info label="Préparation depuis" value={game.preparation_start} />
            <Info label="Clôture" value={game.closing_date} />
            <Info label="Fuseau" value={game.timezone} />
            <Info label="Édition" value={String(game.edition_year)} />
          </dl>
          {game.description && (
            <p className="mt-4 text-sm text-slate-600 whitespace-pre-wrap">{game.description}</p>
          )}
        </div>
      </TabsContent>

      {/* Sports */}
      <TabsContent value="sports" className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-600">{gameSports.length} sport(s) liés à ces Games</p>
          <Button size="sm" onClick={() => setSportDlgOpen(true)} className="bg-indigo-500 hover:bg-indigo-600">
            <Plus className="mr-2 h-4 w-4" /> Ajouter un sport
          </Button>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white">
          {gameSports.length === 0 ? (
            <p className="p-6 text-sm text-slate-500">Aucun sport activé.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Sport</TableHead>
                  <TableHead>Disciplines</TableHead>
                  <TableHead>Actif</TableHead>
                  <TableHead className="w-20 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {gameSports.map((gs) => {
                  const sportDiscs = disciplines.filter((d) => d.sport_id === gs.sport_id);
                  const allowed = gsDiscMap[gs.id] ?? [];
                  const shown = allowed.length === 0
                    ? sportDiscs
                    : sportDiscs.filter((d) => allowed.includes(d.id));
                  return (
                    <TableRow key={gs.id}>
                      <TableCell className="font-medium">{gs.sport?.name ?? sportName(gs.sport_id)}</TableCell>
                      <TableCell className="text-slate-600">
                        {shown.length === 0
                          ? <span className="text-slate-400">Aucune discipline admise</span>
                          : <div className="flex flex-wrap gap-1">
                              {shown.map((d) => (
                                <Badge key={d.id} variant="outline" className="font-normal">
                                  {d.name} <span className="ml-1 text-xs text-slate-400">{d.gender}</span>
                                </Badge>
                              ))}
                              {allowed.length === 0 && (
                                <span className="text-xs text-slate-400 ml-1">(toutes par défaut)</span>
                              )}
                            </div>
                        }
                      </TableCell>
                      <TableCell>
                        <Switch checked={!!gs.is_active} onCheckedChange={() => toggleSport(gs)} />
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" onClick={() => openDiscDlg(gs)} aria-label="Disciplines">
                          <Settings2 className="h-4 w-4 text-indigo-600" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => removeSport(gs)} aria-label="Retirer">
                          <Trash2 className="h-4 w-4 text-red-600" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </div>
      </TabsContent>

      {/* Quotas */}
      <TabsContent value="quotas" className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-600">{quotas.length} quota(s) définis</p>
          <Button size="sm" onClick={() => setQuotaDlgOpen(true)} className="bg-indigo-500 hover:bg-indigo-600">
            <Plus className="mr-2 h-4 w-4" /> Ajouter un quota
          </Button>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white">
          {quotas.length === 0 ? (
            <p className="p-6 text-sm text-slate-500">Aucun quota défini.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Sport</TableHead>
                  <TableHead>Discipline</TableHead>
                  <TableHead>Genre</TableHead>
                  <TableHead>Quota</TableHead>
                  <TableHead>Remplissage</TableHead>
                  <TableHead>Échéance qual.</TableHead>
                  <TableHead className="w-20 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {quotas.map((q) => {
                  const filled = fills[q.id] ?? 0;
                  const pct = q.quota_max ? Math.min(100, (filled / q.quota_max) * 100) : 0;
                  const remaining = Math.max(0, q.quota_max - filled);
                  const tone = filled >= q.quota_max ? "text-red-600" : remaining <= 1 ? "text-amber-600" : "text-emerald-600";
                  return (
                    <TableRow key={q.id}>
                      <TableCell className="font-medium">{sportName(q.sport_id)}</TableCell>
                      <TableCell>{discName(q.discipline_id)}</TableCell>
                      <TableCell><Badge variant="outline">{q.gender}</Badge></TableCell>
                      <TableCell>{q.quota_max}</TableCell>
                      <TableCell className="min-w-[180px]">
                        <div className="flex items-center gap-2">
                          <Progress value={pct} className="h-2 flex-1" />
                          <span className={`text-xs font-medium ${tone}`}>{filled}/{q.quota_max}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-slate-600">
                        {q.qualification_deadline ? new Date(q.qualification_deadline).toLocaleDateString("fr-FR") : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" onClick={() => openDetails(q)} aria-label="Détails">
                          <Eye className="h-4 w-4 text-indigo-600" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => removeQuota(q)} aria-label="Supprimer">
                          <Trash2 className="h-4 w-4 text-red-600" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </div>
      </TabsContent>

      {/* Add Sport Dialog */}
      <Dialog open={sportDlgOpen} onOpenChange={(o) => { setSportDlgOpen(o); if (!o) { setNewSportId(""); setNewSportDiscIds([]); } }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Ajouter un sport</DialogTitle>
            <DialogDescription>
              Activer un sport pour ces Games et choisir directement les disciplines admises.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Sport *</Label>
              <EditableSelect
                value={newSportId}
                onValueChange={(v) => { setNewSportId(v); setNewSportDiscIds([]); }}
                placeholder="Choisir…"
                emptyLabel="—"
                addLabel="+ Ajouter un sport…"
                manageTitle="Gérer les sports"
                options={availableSportsToAdd.map((s) => ({ value: s.id, label: s.name }))}
                onAdd={async (label) => {
                  await addSportRef(label);
                  await load();
                }}
                onDelete={async (sid) => {
                  await removeSportRef(sid);
                  await load();
                }}
              />
            </div>

            {newSportId && (
              <div className="space-y-2">
                <Label>Disciplines admises</Label>
                <p className="text-xs text-slate-500">
                  Cochez les disciplines admises (laisser vide = toutes admises par défaut).
                </p>
                <div className="max-h-56 overflow-y-auto space-y-1.5 rounded-md border border-slate-200 p-2">
                  {disciplines.filter((d) => d.sport_id === newSportId).length === 0 && (
                    <p className="text-xs text-slate-400 px-1 py-1">Aucune discipline pour ce sport.</p>
                  )}
                  {disciplines.filter((d) => d.sport_id === newSportId).map((d) => {
                    const checked = newSportDiscIds.includes(d.id);
                    return (
                      <div key={d.id} className="flex items-center gap-2 rounded px-2 py-1 hover:bg-slate-50">
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(v) =>
                            setNewSportDiscIds((p) => v ? [...p, d.id] : p.filter((x) => x !== d.id))
                          }
                        />
                        <span className="flex-1 text-sm">{d.name}</span>
                        <Badge variant="outline" className="text-xs">
                          {d.gender === "male" ? "M" : d.gender === "female" ? "F" : "Mixte"}
                        </Badge>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-slate-400 hover:text-red-600"
                          onClick={() => deleteDiscipline(d.id)}
                          aria-label="Supprimer la discipline"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    );
                  })}
                </div>

                {/* Inline create */}
                <div className="flex gap-2 pt-1">
                  <Input
                    placeholder="Nouvelle discipline"
                    value={newDiscName}
                    onChange={(e) => setNewDiscName(e.target.value)}
                  />
                  <Select value={newDiscGender} onValueChange={(v) => setNewDiscGender(v as Gender)}>
                    <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {GENDERS.map((g) => (
                        <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={async () => {
                      const created = await createDiscipline(newSportId, newDiscName, newDiscGender);
                      if (created) {
                        setNewSportDiscIds((p) => [...p, created.id]);
                        setNewDiscName("");
                      }
                    }}
                    disabled={!newDiscName.trim()}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSportDlgOpen(false)}>Annuler</Button>
            <Button onClick={addSport} disabled={!newSportId} className="bg-indigo-500 hover:bg-indigo-600">Ajouter</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Quota Dialog */}
      <Dialog open={quotaDlgOpen} onOpenChange={setQuotaDlgOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Ajouter un quota</DialogTitle>
            <DialogDescription>Définir un nombre maximum d'athlètes par catégorie.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="space-y-1.5">
              <Label>Sport *</Label>
              <Select value={quotaForm.sport_id} onValueChange={(v) => setQuotaForm({ ...quotaForm, sport_id: v, discipline_id: "" })}>
                <SelectTrigger><SelectValue placeholder="Choisir…" /></SelectTrigger>
                <SelectContent>
                  {gameSports.filter((g) => g.is_active).map((gs) => (
                    <SelectItem key={gs.sport_id} value={gs.sport_id}>{gs.sport?.name ?? sportName(gs.sport_id)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Discipline</Label>
                <Select value={quotaForm.discipline_id || "none"} onValueChange={(v) => setQuotaForm({ ...quotaForm, discipline_id: v === "none" ? "" : v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Toutes</SelectItem>
                    {availableDisciplines.map((d) => (
                      <SelectItem key={d.id} value={d.id}>{d.name} ({d.gender})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Genre *</Label>
                <Select value={quotaForm.gender} onValueChange={(v) => setQuotaForm({ ...quotaForm, gender: v as Gender })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {GENDERS.map((g) => (
                      <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Quota max *</Label>
                <Input type="number" min={0} value={quotaForm.quota_max} onChange={(e) => setQuotaForm({ ...quotaForm, quota_max: Number(e.target.value) })} />
              </div>
              <div className="space-y-1.5">
                <Label>Échéance qualification</Label>
                <Input type="date" value={quotaForm.qualification_deadline} onChange={(e) => setQuotaForm({ ...quotaForm, qualification_deadline: e.target.value })} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Critères de qualification</Label>
              <Input value={quotaForm.qualification_criteria} onChange={(e) => setQuotaForm({ ...quotaForm, qualification_criteria: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setQuotaDlgOpen(false)}>Annuler</Button>
            <Button onClick={addQuota} className="bg-indigo-500 hover:bg-indigo-600">Ajouter</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Disciplines admises dialog */}
      <Dialog open={!!discDlg} onOpenChange={(o) => !o && setDiscDlg(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Disciplines admises — {discDlg?.sport?.name}</DialogTitle>
            <DialogDescription>
              Sélectionnez les disciplines (et genre) admises pour ce sport à ces Games. Si aucune n'est cochée, toutes les disciplines du sport sont admises.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-80 overflow-y-auto space-y-2 py-2">
            {discDlg && disciplines.filter((d) => d.sport_id === discDlg.sport_id).map((d) => {
              const checked = discPicked.includes(d.id);
              return (
                <div key={d.id} className="flex items-center gap-3 rounded-md border border-slate-200 px-3 py-2 hover:bg-slate-50">
                  <Checkbox
                    checked={checked}
                    onCheckedChange={(v) => {
                      setDiscPicked((prev) => v ? [...prev, d.id] : prev.filter((x) => x !== d.id));
                    }}
                  />
                  <span className="flex-1 text-sm font-medium">{d.name}</span>
                  <Badge variant="outline" className="text-xs">
                    {d.gender === "male" ? "Masculin" : d.gender === "female" ? "Féminin" : "Mixte"}
                  </Badge>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-slate-400 hover:text-red-600"
                    onClick={() => deleteDiscipline(d.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              );
            })}
            {discDlg && disciplines.filter((d) => d.sport_id === discDlg.sport_id).length === 0 && (
              <p className="text-sm text-slate-500">Ce sport n'a aucune discipline référencée.</p>
            )}
          </div>
          {discDlg && (
            <div className="flex gap-2 pt-1">
              <Input
                placeholder="Nouvelle discipline"
                value={newDiscName}
                onChange={(e) => setNewDiscName(e.target.value)}
              />
              <Select value={newDiscGender} onValueChange={(v) => setNewDiscGender(v as Gender)}>
                <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {GENDERS.map((g) => (
                    <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                type="button"
                variant="outline"
                onClick={async () => {
                  if (!discDlg) return;
                  const created = await createDiscipline(discDlg.sport_id, newDiscName, newDiscGender);
                  if (created) {
                    setDiscPicked((p) => [...p, created.id]);
                    setNewDiscName("");
                  }
                }}
                disabled={!newDiscName.trim()}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDiscDlg(null)}>Annuler</Button>
            <Button onClick={saveDiscDlg} className="bg-indigo-500 hover:bg-indigo-600">Enregistrer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Quota details dialog */}
      <Dialog open={!!detailsQuota} onOpenChange={(o) => !o && setDetailsQuota(null)}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              Quota — {detailsQuota && sportName(detailsQuota.sport_id)}
              {detailsQuota?.discipline_id ? ` · ${discName(detailsQuota.discipline_id)}` : ""}
              {detailsQuota && <Badge variant="outline" className="ml-2">{detailsQuota.gender}</Badge>}
            </DialogTitle>
            <DialogDescription>
              {detailsQuota && (
                <>
                  {detailsIn.length}/{detailsQuota.quota_max} placés ·{" "}
                  {detailsEligible.length} athlète(s) éligible(s) supplémentaire(s)
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          {detailsLoading ? (
            <Skeleton className="h-48 w-full" />
          ) : (
            <Tabs defaultValue="in" className="space-y-3">
              <TabsList>
                <TabsTrigger value="in">Dans le quota ({detailsIn.length})</TabsTrigger>
                <TabsTrigger value="eligible">Éligibles ({detailsEligible.length})</TabsTrigger>
              </TabsList>
              <TabsContent value="in">
                <AthleteList items={detailsIn} emptyLabel="Aucun athlète sélectionné dans ce quota." showStatus />
              </TabsContent>
              <TabsContent value="eligible">
                <AthleteList items={detailsEligible} emptyLabel="Aucun athlète éligible." />
              </TabsContent>
            </Tabs>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDetailsQuota(null)}>Fermer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Tabs>
  );
}

function Kpi({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-1 text-3xl font-semibold text-slate-900">{value}</p>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="text-slate-900">{value || "—"}</dd>
    </div>
  );
}

