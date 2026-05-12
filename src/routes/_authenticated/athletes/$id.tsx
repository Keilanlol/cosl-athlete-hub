import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Plus, Trash2, Upload, Pencil } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import {
  ATHLETE_LEVELS,
  ATHLETE_STATUSES,
  COACH_ROLES,
  DOCUMENT_CATEGORIES,
  DOCUMENT_STATUSES,
  GENDERS,
  MEDAL_LABELS,
  athleteSchema,
  type Athlete,
  type AthleteDocument,
  type AthleteForm,
  type AthleteKyc,
  type AthleteRelation,
  type AthleteResult,
  type Club,
  type Coach,
  type Federation,
  type Game,
  type GameCompetition,
  type Selection,
  type Sport,
} from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { EmptyState, TableSkeleton } from "@/components/DataTableShell";

export const Route = createFileRoute("/_authenticated/athletes/$id")({
  component: AthleteDetailPage,
});

const ALL = "__all";

function statusBadge(s: string) {
  const m = ATHLETE_STATUSES.find((x) => x.value === s);
  return <Badge className={`${m?.cls ?? ""} hover:${m?.cls ?? ""}`}>{m?.label ?? s}</Badge>;
}

function docStatusBadge(s: string) {
  const m = DOCUMENT_STATUSES.find((x) => x.value === s);
  return <Badge className={`${m?.cls ?? ""} hover:${m?.cls ?? ""}`}>{m?.label ?? s}</Badge>;
}

function kycPill(s: string | null | undefined) {
  if (s === "green")
    return <Badge className="bg-emerald-500 text-white hover:bg-emerald-500">Vert</Badge>;
  if (s === "orange")
    return <Badge className="bg-amber-500 text-white hover:bg-amber-500">Orange</Badge>;
  return <Badge className="bg-red-600 text-white hover:bg-red-600">Rouge</Badge>;
}

function AthleteDetailPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const [athlete, setAthlete] = useState<Athlete | null>(null);
  const [loading, setLoading] = useState(true);
  const [sport, setSport] = useState<Sport | null>(null);
  const [federation, setFederation] = useState<Federation | null>(null);
  const [club, setClub] = useState<Club | null>(null);
  const [docs, setDocs] = useState<AthleteDocument[] | null>(null);
  const [kyc, setKyc] = useState<AthleteKyc | null>(null);
  const [relations, setRelations] = useState<AthleteRelation[] | null>(null);
  const [selections, setSelections] = useState<Selection[] | null>(null);
  const [coaches, setCoaches] = useState<Coach[]>([]);

  const [editOpen, setEditOpen] = useState(false);
  const [form, setForm] = useState<AthleteForm | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [deactivating, setDeactivating] = useState(false);
  const [confirmDeactivate, setConfirmDeactivate] = useState(false);

  // Palmarès
  type ResultRow = AthleteResult & {
    game: { name: string; edition_year: number } | null;
    game_competition: { name: string } | null;
    sport: { name: string } | null;
    discipline: { name: string } | null;
  };
  const [results, setResults] = useState<ResultRow[] | null>(null);
  const [games, setGames] = useState<Game[]>([]);
  const [competitions, setCompetitions] = useState<GameCompetition[]>([]);
  const [resultOpen, setResultOpen] = useState(false);
  const [resultForm, setResultForm] = useState({
    game_id: "",
    game_competition_id: "",
    sport_id: "",
    discipline_id: "",
    result_date: "",
    rank: "",
    medal: "",
    score: "",
    unit: "",
    is_national_record: false,
    is_personal_best: false,
    notes: "",
  });

  const [docOpen, setDocOpen] = useState(false);
  const [docForm, setDocForm] = useState({
    category: "admin",
    doc_type: "",
    file_name: "",
    file_url: "",
    issued_date: "",
    expiry_date: "",
    status: "pending",
  });
  const [docDeleteId, setDocDeleteId] = useState<string | null>(null);

  const [relOpen, setRelOpen] = useState(false);
  const [relForm, setRelForm] = useState({
    coach_id: "",
    relation_role: "coach",
    start_date: new Date().toISOString().slice(0, 10),
    end_date: "",
  });

  const [refs, setRefs] = useState<{ sports: Sport[]; feds: Federation[]; clubs: Club[] }>({
    sports: [],
    feds: [],
    clubs: [],
  });

  const loadAll = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("athletes")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error || !data) {
      toast.error("Athlète introuvable");
      setLoading(false);
      return;
    }
    setAthlete(data as Athlete);
    setLoading(false);

    const a = data as Athlete;
    if (a.primary_sport_id) {
      const { data: d } = await supabase
        .from("sports")
        .select("*")
        .eq("id", a.primary_sport_id)
        .maybeSingle();
      setSport((d ?? null) as Sport | null);
    } else setSport(null);
    if (a.primary_federation_id) {
      const { data: d } = await supabase
        .from("federations")
        .select("*")
        .eq("id", a.primary_federation_id)
        .maybeSingle();
      setFederation((d ?? null) as Federation | null);
    } else setFederation(null);
    if (a.current_club_id) {
      const { data: d } = await supabase
        .from("clubs")
        .select("*")
        .eq("id", a.current_club_id)
        .maybeSingle();
      setClub((d ?? null) as Club | null);
    } else setClub(null);

    const [{ data: dd }, { data: kk }, { data: rr }, { data: ss }, { data: rs }] = await Promise.all([
      supabase
        .from("athlete_documents")
        .select("*")
        .eq("athlete_id", id)
        .order("created_at", { ascending: false }),
      supabase.from("athlete_kyc").select("*").eq("athlete_id", id).maybeSingle(),
      supabase
        .from("athlete_relations")
        .select("*, coach:coaches(*)")
        .eq("athlete_id", id)
        .order("start_date", { ascending: false }),
      supabase
        .from("selections")
        .select("*, game:games(id,name,edition_year)")
        .eq("athlete_id", id)
        .order("created_at", { ascending: false }),
      supabase
        .from("athlete_results")
        .select("*, game:games(name,edition_year), game_competition:game_competitions(name), sport:sports(name), discipline:disciplines(name)")
        .eq("athlete_id", id)
        .order("result_date", { ascending: false, nullsFirst: false }),
    ]);
    setDocs((dd ?? []) as AthleteDocument[]);
    setKyc((kk ?? null) as AthleteKyc | null);
    setRelations((rr ?? []) as AthleteRelation[]);
    setSelections((ss ?? []) as Selection[]);
    setResults((rs ?? []) as ResultRow[]);
  };

  useEffect(() => {
    loadAll();
    (async () => {
      const [sp, fd, cl, co, gm, gc] = await Promise.all([
        supabase.from("sports").select("*").order("name"),
        supabase.from("federations").select("*").order("acronym"),
        supabase.from("clubs").select("*").order("name"),
        supabase.from("coaches").select("*").eq("is_active", true).order("last_name"),
        supabase.from("games").select("*").order("competition_start", { ascending: false }),
        supabase.from("game_competitions").select("*"),
      ]);
      setRefs({
        sports: (sp.data ?? []) as Sport[],
        feds: (fd.data ?? []) as Federation[],
        clubs: (cl.data ?? []) as Club[],
      });
      setCoaches((co.data ?? []) as Coach[]);
      setGames((gm.data ?? []) as Game[]);
      setCompetitions((gc.data ?? []) as GameCompetition[]);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const openEdit = () => {
    if (!athlete) return;
    setForm({
      cosl_id: athlete.cosl_id,
      first_name: athlete.first_name,
      last_name: athlete.last_name,
      birth_date: athlete.birth_date,
      birth_place: athlete.birth_place ?? "",
      gender: athlete.gender,
      nationality: athlete.nationality,
      sport_nationality: athlete.sport_nationality ?? "",
      email: athlete.email ?? "",
      phone: athlete.phone ?? "",
      address: athlete.address ?? "",
      emergency_contact_name: athlete.emergency_contact_name ?? "",
      emergency_contact_phone: athlete.emergency_contact_phone ?? "",
      photo_url: athlete.photo_url ?? "",
      primary_sport_id: athlete.primary_sport_id ?? "",
      primary_federation_id: athlete.primary_federation_id ?? "",
      current_club_id: athlete.current_club_id ?? "",
      status: athlete.status,
      level: athlete.level ?? "",
      size_clothing: athlete.size_clothing ?? "",
      size_shoes: athlete.size_shoes ?? "",
      size_gloves: athlete.size_gloves ?? "",
      license_number: athlete.license_number ?? "",
      ada_number: athlete.ada_number ?? "",
      passport_number: athlete.passport_number ?? "",
      passport_expiry: athlete.passport_expiry ?? "",
    });
    setErrors({});
    setEditOpen(true);
  };

  const submitEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form || !athlete) return;
    const parsed = athleteSchema.safeParse(form);
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      parsed.error.issues.forEach((i) => {
        if (i.path[0]) errs[i.path[0] as string] = i.message;
      });
      setErrors(errs);
      toast.error("Vérifiez les champs");
      return;
    }
    setSaving(true);
    const v = parsed.data;
    const payload: Record<string, unknown> = {
      ...v,
      cosl_id: v.cosl_id || athlete.cosl_id,
      birth_place: v.birth_place || null,
      sport_nationality: v.sport_nationality?.toUpperCase() || null,
      nationality: v.nationality.toUpperCase(),
      email: v.email || null,
      phone: v.phone || null,
      address: v.address || null,
      emergency_contact_name: v.emergency_contact_name || null,
      emergency_contact_phone: v.emergency_contact_phone || null,
      photo_url: v.photo_url || null,
      primary_sport_id: v.primary_sport_id || null,
      primary_federation_id: v.primary_federation_id || null,
      current_club_id: v.current_club_id || null,
      level: v.level || null,
      size_clothing: v.size_clothing || null,
      size_shoes: v.size_shoes || null,
      size_gloves: v.size_gloves || null,
      license_number: v.license_number || null,
      ada_number: v.ada_number || null,
      passport_number: v.passport_number || null,
      passport_expiry: v.passport_expiry || null,
      updated_at: new Date().toISOString(),
    };
    const { error } = await supabase.from("athletes").update(payload).eq("id", athlete.id);
    setSaving(false);
    if (error) {
      toast.error("Échec", { description: error.message });
      return;
    }
    toast.success("Athlète mis à jour");
    setEditOpen(false);
    loadAll();
  };

  const deactivate = async () => {
    if (!athlete) return;
    setDeactivating(true);
    const { error } = await supabase
      .from("athletes")
      .update({ is_active: false })
      .eq("id", athlete.id);
    setDeactivating(false);
    setConfirmDeactivate(false);
    if (error) {
      toast.error("Désactivation impossible", { description: error.message });
      return;
    }
    toast.success("Athlète désactivé");
    navigate({ to: "/athletes" });
  };

  const submitDoc = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!docForm.doc_type.trim() || !docForm.file_name.trim()) {
      toast.error("Type et nom de fichier requis");
      return;
    }
    const { error } = await supabase.from("athlete_documents").insert({
      athlete_id: id,
      category: docForm.category,
      doc_type: docForm.doc_type.trim(),
      file_name: docForm.file_name.trim(),
      file_url: docForm.file_url.trim() || null,
      issued_date: docForm.issued_date || null,
      expiry_date: docForm.expiry_date || null,
      status: docForm.status,
    });
    if (error) {
      toast.error("Échec", { description: error.message });
      return;
    }
    toast.success("Document ajouté");
    setDocOpen(false);
    setDocForm({
      category: "admin",
      doc_type: "",
      file_name: "",
      file_url: "",
      issued_date: "",
      expiry_date: "",
      status: "pending",
    });
    loadAll();
  };

  const deleteDoc = async () => {
    if (!docDeleteId) return;
    const { error } = await supabase
      .from("athlete_documents")
      .delete()
      .eq("id", docDeleteId);
    setDocDeleteId(null);
    if (error) {
      toast.error("Suppression impossible", { description: error.message });
      return;
    }
    toast.success("Document supprimé");
    loadAll();
  };

  const updateKyc = async (patch: Partial<AthleteKyc>) => {
    if (!kyc) {
      const { error } = await supabase
        .from("athlete_kyc")
        .insert({ athlete_id: id, ...patch });
      if (error) return toast.error("Échec", { description: error.message });
    } else {
      const { error } = await supabase
        .from("athlete_kyc")
        .update({ ...patch, last_check_at: new Date().toISOString() })
        .eq("athlete_id", id);
      if (error) return toast.error("Échec", { description: error.message });
    }
    toast.success("KYC mis à jour");
    loadAll();
  };

  const submitRel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!relForm.coach_id) {
      toast.error("Sélectionnez un encadrant");
      return;
    }
    const { error } = await supabase.from("athlete_relations").insert({
      athlete_id: id,
      coach_id: relForm.coach_id,
      relation_role: relForm.relation_role,
      start_date: relForm.start_date,
      end_date: relForm.end_date || null,
    });
    if (error) {
      toast.error("Échec", { description: error.message });
      return;
    }
    toast.success("Relation ajoutée");
    setRelOpen(false);
    setRelForm({
      coach_id: "",
      relation_role: "coach",
      start_date: new Date().toISOString().slice(0, 10),
      end_date: "",
    });
    loadAll();
  };

  const deleteRel = async (relId: string) => {
    const { error } = await supabase.from("athlete_relations").delete().eq("id", relId);
    if (error) return toast.error("Échec", { description: error.message });
    toast.success("Relation supprimée");
    loadAll();
  };

  const submitResult = async () => {
    if (!resultForm.game_id) return toast.error("Games requis");
    const payload = {
      athlete_id: id,
      game_id: resultForm.game_id,
      game_competition_id: resultForm.game_competition_id || null,
      sport_id: resultForm.sport_id || null,
      discipline_id: resultForm.discipline_id || null,
      result_date: resultForm.result_date || null,
      rank: resultForm.rank ? Number(resultForm.rank) : null,
      medal: resultForm.medal || null,
      score: resultForm.score.trim() || null,
      unit: resultForm.unit.trim() || null,
      is_national_record: resultForm.is_national_record,
      is_personal_best: resultForm.is_personal_best,
      notes: resultForm.notes.trim() || null,
    };
    const { error } = await supabase.from("athlete_results").insert(payload);
    if (error) return toast.error("Échec", { description: error.message });
    toast.success("Résultat ajouté");
    setResultOpen(false);
    setResultForm({
      game_id: "", game_competition_id: "", sport_id: "", discipline_id: "",
      result_date: "", rank: "", medal: "", score: "", unit: "",
      is_national_record: false, is_personal_best: false, notes: "",
    });
    loadAll();
  };

  const fieldErr = (k: string) =>
    errors[k] ? <p className="text-xs text-red-600">{errors[k]}</p> : null;

  const clubsForFed = useMemo(
    () =>
      form?.primary_federation_id
        ? refs.clubs.filter((c) => c.federation_id === form.primary_federation_id)
        : refs.clubs,
    [refs.clubs, form?.primary_federation_id],
  );

  if (loading) {
    return <div className="rounded-lg border border-slate-200 bg-white"><TableSkeleton cols={4} /></div>;
  }
  if (!athlete) {
    return (
      <EmptyState
        message="Athlète introuvable."
        action={
          <Button asChild variant="outline">
            <Link to="/athletes">Retour</Link>
          </Button>
        }
      />
    );
  }

  const lvl = ATHLETE_LEVELS.find((l) => l.value === athlete.level);
  const globalKyc = kyc?.global_status ?? "red";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button asChild variant="ghost" size="icon">
            <Link to="/athletes"><ArrowLeft className="h-4 w-4" /></Link>
          </Button>
          <div className="h-14 w-14 overflow-hidden rounded-full bg-slate-200">
            {athlete.photo_url ? (
              <img src={athlete.photo_url} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center font-semibold text-slate-500">
                {athlete.first_name[0]}
                {athlete.last_name[0]}
              </div>
            )}
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">
              {athlete.first_name} {athlete.last_name}
            </h1>
            <div className="mt-1 flex items-center gap-2 text-sm text-slate-600">
              <span className="font-mono">{athlete.cosl_id}</span>
              {statusBadge(athlete.status)}
              {kycPill(globalKyc)}
              {athlete.is_active === false && (
                <Badge variant="outline" className="border-slate-300 text-slate-500">
                  Inactif
                </Badge>
              )}
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Button onClick={openEdit} className="bg-indigo-500 hover:bg-indigo-600">
            <Pencil className="mr-2 h-4 w-4" /> Modifier
          </Button>
        </div>
      </div>

      <Tabs defaultValue="profil" className="space-y-4">
        <TabsList>
          <TabsTrigger value="profil">Profil</TabsTrigger>
          <TabsTrigger value="sportif">Sportif</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="kyc">KYC</TabsTrigger>
          <TabsTrigger value="relations">Relations</TabsTrigger>
          <TabsTrigger value="selections">Sélections</TabsTrigger>
          <TabsTrigger value="palmares">Palmarès</TabsTrigger>
        </TabsList>

        <TabsContent value="profil">
          <div className="grid gap-4 rounded-lg border border-slate-200 bg-white p-6 md:grid-cols-2">
            <Field label="Date de naissance" value={athlete.birth_date} />
            <Field label="Lieu de naissance" value={athlete.birth_place} />
            <Field
              label="Genre"
              value={GENDERS.find((g) => g.value === athlete.gender)?.label ?? athlete.gender}
            />
            <Field label="Nationalité" value={athlete.nationality} />
            <Field label="Nationalité sportive" value={athlete.sport_nationality} />
            <Field label="Email" value={athlete.email} />
            <Field label="Téléphone" value={athlete.phone} />
            <Field label="Adresse" value={athlete.address} />
            <Field label="Contact urgence" value={athlete.emergency_contact_name} />
            <Field label="Téléphone urgence" value={athlete.emergency_contact_phone} />
            <Field label="Taille vêtement" value={athlete.size_clothing} />
            <Field label="Pointure" value={athlete.size_shoes} />
            <Field label="Taille gants" value={athlete.size_gloves} />
            <Field label="Passeport" value={athlete.passport_number} />
            <Field label="Expiration passeport" value={athlete.passport_expiry} />
          </div>
        </TabsContent>

        <TabsContent value="sportif">
          <div className="grid gap-4 rounded-lg border border-slate-200 bg-white p-6 md:grid-cols-2">
            <Field label="Sport principal" value={sport?.name} />
            <Field label="Fédération" value={federation ? `${federation.acronym} — ${federation.name}` : null} />
            <Field label="Club" value={club?.name} />
            <Field
              label="Statut"
              value={ATHLETE_STATUSES.find((s) => s.value === athlete.status)?.label}
            />
            <Field label="Niveau" value={lvl?.label} />
            <Field label="N° de licence" value={athlete.license_number} />
            <Field label="N° antidopage" value={athlete.ada_number} />
            <div className="md:col-span-2 text-sm text-slate-500">
              Historique des statuts — à enrichir lors d'évolutions du statut.
            </div>
          </div>
        </TabsContent>

        <TabsContent value="documents">
          <div className="space-y-3">
            <div className="flex justify-end">
              <Button onClick={() => setDocOpen(true)} className="bg-indigo-500 hover:bg-indigo-600">
                <Upload className="mr-2 h-4 w-4" /> Ajouter un document
              </Button>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white">
              {docs === null ? (
                <TableSkeleton cols={6} />
              ) : docs.length === 0 ? (
                <div className="p-6"><EmptyState message="Aucun document." /></div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Catégorie</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Nom du fichier</TableHead>
                      <TableHead>Émission</TableHead>
                      <TableHead>Expiration</TableHead>
                      <TableHead>Statut</TableHead>
                      <TableHead className="w-12 text-right"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {docs.map((d) => (
                      <TableRow key={d.id}>
                        <TableCell>
                          {DOCUMENT_CATEGORIES.find((c) => c.value === d.category)?.label ?? d.category}
                        </TableCell>
                        <TableCell>{d.doc_type}</TableCell>
                        <TableCell>
                          {d.file_url ? (
                            <a
                              href={d.file_url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-indigo-600 hover:underline"
                            >
                              {d.file_name}
                            </a>
                          ) : (
                            d.file_name
                          )}
                        </TableCell>
                        <TableCell>{d.issued_date ?? "—"}</TableCell>
                        <TableCell>{d.expiry_date ?? "—"}</TableCell>
                        <TableCell>{docStatusBadge(d.status)}</TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDocDeleteId(d.id)}
                          >
                            <Trash2 className="h-4 w-4 text-red-600" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="kyc">
          <div className="space-y-4 rounded-lg border border-slate-200 bg-white p-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Conformité globale</h3>
              <div className="flex items-center gap-2">
                Statut: {kycPill(globalKyc)}
                <Select
                  value={globalKyc}
                  onValueChange={(v) => updateKyc({ global_status: v as AthleteKyc["global_status"] })}
                >
                  <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="green">Vert</SelectItem>
                    <SelectItem value="orange">Orange</SelectItem>
                    <SelectItem value="red">Rouge</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <KycToggle
                label="Identité vérifiée"
                value={!!kyc?.identity_verified}
                onChange={(v) => updateKyc({ identity_verified: v })}
              />
              <KycToggle
                label="Nationalité vérifiée"
                value={!!kyc?.nationality_verified}
                onChange={(v) => updateKyc({ nationality_verified: v })}
              />
              <KycToggle
                label="Éligibilité d'âge"
                value={!!kyc?.age_eligibility_ok}
                onChange={(v) => updateKyc({ age_eligibility_ok: v })}
              />
              <div className="flex items-center justify-between rounded-md border border-slate-200 px-3 py-2">
                <Label>Antidopage</Label>
                <Select
                  value={kyc?.antidoping_status ?? "orange"}
                  onValueChange={(v) =>
                    updateKyc({ antidoping_status: v as AthleteKyc["antidoping_status"] })
                  }
                >
                  <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="green">Vert</SelectItem>
                    <SelectItem value="orange">Orange</SelectItem>
                    <SelectItem value="red">Rouge</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-between rounded-md border border-slate-200 px-3 py-2">
                <Label>Charte éthique signée</Label>
                <Input
                  type="date"
                  className="w-44"
                  value={kyc?.ethics_charter_signed_at?.slice(0, 10) ?? ""}
                  onChange={(e) =>
                    updateKyc({
                      ethics_charter_signed_at: e.target.value
                        ? new Date(e.target.value).toISOString()
                        : null,
                    })
                  }
                />
              </div>
              <div className="flex items-center justify-between rounded-md border border-slate-200 px-3 py-2">
                <Label>Règle 40 signée</Label>
                <Input
                  type="date"
                  className="w-44"
                  value={kyc?.rule40_signed_at?.slice(0, 10) ?? ""}
                  onChange={(e) =>
                    updateKyc({
                      rule40_signed_at: e.target.value
                        ? new Date(e.target.value).toISOString()
                        : null,
                    })
                  }
                />
              </div>
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea
                defaultValue={kyc?.notes ?? ""}
                onBlur={(e) => {
                  if ((kyc?.notes ?? "") !== e.target.value) updateKyc({ notes: e.target.value });
                }}
              />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="relations">
          <div className="space-y-3">
            <div className="flex justify-end">
              <Button onClick={() => setRelOpen(true)} className="bg-indigo-500 hover:bg-indigo-600">
                <Plus className="mr-2 h-4 w-4" /> Ajouter une relation
              </Button>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white">
              {relations === null ? (
                <TableSkeleton cols={5} />
              ) : relations.length === 0 ? (
                <div className="p-6"><EmptyState message="Aucune relation." /></div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Encadrant</TableHead>
                      <TableHead>Rôle</TableHead>
                      <TableHead>Début</TableHead>
                      <TableHead>Fin</TableHead>
                      <TableHead className="w-12 text-right"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {relations.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell>
                          {r.coach
                            ? `${r.coach.first_name} ${r.coach.last_name}`
                            : "—"}
                        </TableCell>
                        <TableCell>
                          {COACH_ROLES.find((c) => c.value === r.relation_role)?.label ??
                            r.relation_role}
                        </TableCell>
                        <TableCell>{r.start_date}</TableCell>
                        <TableCell>{r.end_date ?? "—"}</TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="icon" onClick={() => deleteRel(r.id)}>
                            <Trash2 className="h-4 w-4 text-red-600" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="selections">
          <div className="rounded-lg border border-slate-200 bg-white">
            {selections === null ? (
              <TableSkeleton cols={4} />
            ) : selections.length === 0 ? (
              <div className="p-6"><EmptyState message="Aucune sélection." /></div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Games</TableHead>
                    <TableHead>Édition</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead>Décidée le</TableHead>
                    <TableHead>Commentaire</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {selections.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell>{s.game?.name ?? "—"}</TableCell>
                      <TableCell>{s.game?.edition_year ?? "—"}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{s.status}</Badge>
                      </TableCell>
                      <TableCell>
                        {s.decided_at ? new Date(s.decided_at).toLocaleDateString() : "—"}
                      </TableCell>
                      <TableCell className="text-slate-600">{s.comment ?? "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </TabsContent>
      </Tabs>

      <div className="flex justify-end border-t border-slate-200 pt-4">
        <Button
          variant="outline"
          className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
          onClick={() => setConfirmDeactivate(true)}
          disabled={athlete.is_active === false}
        >
          {athlete.is_active === false ? "Déjà désactivé" : "Désactiver l'athlète"}
        </Button>
      </div>

      {/* Edit dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          {form && (
            <form onSubmit={submitEdit}>
              <DialogHeader>
                <DialogTitle>Modifier l'athlète</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                  <div className="space-y-1.5">
                    <Label>ID COSL</Label>
                    <Input
                      value={form.cosl_id}
                      onChange={(e) => setForm({ ...form, cosl_id: e.target.value })}
                    />
                    {fieldErr("cosl_id")}
                  </div>
                  <div className="space-y-1.5">
                    <Label>Prénom *</Label>
                    <Input
                      value={form.first_name}
                      onChange={(e) => setForm({ ...form, first_name: e.target.value })}
                    />
                    {fieldErr("first_name")}
                  </div>
                  <div className="space-y-1.5">
                    <Label>Nom *</Label>
                    <Input
                      value={form.last_name}
                      onChange={(e) => setForm({ ...form, last_name: e.target.value })}
                    />
                    {fieldErr("last_name")}
                  </div>
                  <div className="space-y-1.5">
                    <Label>Date de naissance *</Label>
                    <Input
                      type="date"
                      value={form.birth_date}
                      onChange={(e) => setForm({ ...form, birth_date: e.target.value })}
                    />
                    {fieldErr("birth_date")}
                  </div>
                  <div className="space-y-1.5">
                    <Label>Genre</Label>
                    <Select
                      value={form.gender}
                      onValueChange={(v) => setForm({ ...form, gender: v as AthleteForm["gender"] })}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {GENDERS.map((g) => (
                          <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Nationalité *</Label>
                    <Input
                      value={form.nationality}
                      onChange={(e) => setForm({ ...form, nationality: e.target.value })}
                    />
                    {fieldErr("nationality")}
                  </div>
                  <div className="space-y-1.5">
                    <Label>Email</Label>
                    <Input
                      type="email"
                      value={form.email ?? ""}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                    />
                    {fieldErr("email")}
                  </div>
                  <div className="space-y-1.5">
                    <Label>Téléphone</Label>
                    <Input
                      value={form.phone ?? ""}
                      onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Photo (URL)</Label>
                    <Input
                      value={form.photo_url ?? ""}
                      onChange={(e) => setForm({ ...form, photo_url: e.target.value })}
                    />
                    {fieldErr("photo_url")}
                  </div>
                  <div className="space-y-1.5">
                    <Label>Sport</Label>
                    <Select
                      value={form.primary_sport_id || ALL}
                      onValueChange={(v) =>
                        setForm({ ...form, primary_sport_id: v === ALL ? "" : v })
                      }
                    >
                      <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value={ALL}>—</SelectItem>
                        {refs.sports.map((s) => (
                          <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Fédération</Label>
                    <Select
                      value={form.primary_federation_id || ALL}
                      onValueChange={(v) =>
                        setForm({
                          ...form,
                          primary_federation_id: v === ALL ? "" : v,
                          current_club_id: "",
                        })
                      }
                    >
                      <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value={ALL}>—</SelectItem>
                        {refs.feds.map((f) => (
                          <SelectItem key={f.id} value={f.id}>{f.acronym}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Club</Label>
                    <Select
                      value={form.current_club_id || ALL}
                      onValueChange={(v) =>
                        setForm({ ...form, current_club_id: v === ALL ? "" : v })
                      }
                    >
                      <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value={ALL}>—</SelectItem>
                        {clubsForFed.map((c) => (
                          <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Statut</Label>
                    <Select
                      value={form.status}
                      onValueChange={(v) =>
                        setForm({ ...form, status: v as AthleteForm["status"] })
                      }
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {ATHLETE_STATUSES.map((s) => (
                          <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Niveau</Label>
                    <Select
                      value={form.level || ALL}
                      onValueChange={(v) =>
                        setForm({
                          ...form,
                          level: (v === ALL ? "" : v) as AthleteForm["level"],
                        })
                      }
                    >
                      <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value={ALL}>—</SelectItem>
                        {ATHLETE_LEVELS.map((s) => (
                          <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setEditOpen(false)} disabled={saving}>
                  Annuler
                </Button>
                <Button type="submit" className="bg-indigo-500 hover:bg-indigo-600" disabled={saving}>
                  {saving ? "Enregistrement…" : "Enregistrer"}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Document dialog */}
      <Dialog open={docOpen} onOpenChange={setDocOpen}>
        <DialogContent className="sm:max-w-lg">
          <form onSubmit={submitDoc}>
            <DialogHeader>
              <DialogTitle>Ajouter un document</DialogTitle>
            </DialogHeader>
            <div className="grid gap-3 py-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Catégorie</Label>
                  <Select
                    value={docForm.category}
                    onValueChange={(v) => setDocForm({ ...docForm, category: v })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {DOCUMENT_CATEGORIES.map((c) => (
                        <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Statut</Label>
                  <Select
                    value={docForm.status}
                    onValueChange={(v) => setDocForm({ ...docForm, status: v })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {DOCUMENT_STATUSES.map((s) => (
                        <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Type *</Label>
                <Input
                  value={docForm.doc_type}
                  onChange={(e) => setDocForm({ ...docForm, doc_type: e.target.value })}
                  placeholder="ex: passeport"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Nom du fichier *</Label>
                <Input
                  value={docForm.file_name}
                  onChange={(e) => setDocForm({ ...docForm, file_name: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>URL du fichier</Label>
                <Input
                  value={docForm.file_url}
                  onChange={(e) => setDocForm({ ...docForm, file_url: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Date d'émission</Label>
                  <Input
                    type="date"
                    value={docForm.issued_date}
                    onChange={(e) => setDocForm({ ...docForm, issued_date: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Date d'expiration</Label>
                  <Input
                    type="date"
                    value={docForm.expiry_date}
                    onChange={(e) => setDocForm({ ...docForm, expiry_date: e.target.value })}
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDocOpen(false)}>
                Annuler
              </Button>
              <Button type="submit" className="bg-indigo-500 hover:bg-indigo-600">
                Ajouter
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Relation dialog */}
      <Dialog open={relOpen} onOpenChange={setRelOpen}>
        <DialogContent className="sm:max-w-lg">
          <form onSubmit={submitRel}>
            <DialogHeader>
              <DialogTitle>Ajouter une relation</DialogTitle>
            </DialogHeader>
            <div className="grid gap-3 py-4">
              <div className="space-y-1.5">
                <Label>Encadrant</Label>
                <Select
                  value={relForm.coach_id}
                  onValueChange={(v) => setRelForm({ ...relForm, coach_id: v })}
                >
                  <SelectTrigger><SelectValue placeholder="Sélectionner…" /></SelectTrigger>
                  <SelectContent>
                    {coaches.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.first_name} {c.last_name} — {c.role}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Rôle</Label>
                <Select
                  value={relForm.relation_role}
                  onValueChange={(v) => setRelForm({ ...relForm, relation_role: v })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {COACH_ROLES.map((c) => (
                      <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Début</Label>
                  <Input
                    type="date"
                    value={relForm.start_date}
                    onChange={(e) => setRelForm({ ...relForm, start_date: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Fin (optionnel)</Label>
                  <Input
                    type="date"
                    value={relForm.end_date}
                    onChange={(e) => setRelForm({ ...relForm, end_date: e.target.value })}
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setRelOpen(false)}>
                Annuler
              </Button>
              <Button type="submit" className="bg-indigo-500 hover:bg-indigo-600">
                Ajouter
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!docDeleteId} onOpenChange={(o) => !o && setDocDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce document ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={deleteDoc} className="bg-red-600 hover:bg-red-700">
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmDeactivate} onOpenChange={setConfirmDeactivate}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Désactiver cet athlète ?</AlertDialogTitle>
            <AlertDialogDescription>
              L'athlète sera marqué comme inactif (soft delete) et n'apparaîtra
              plus par défaut dans les listes.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deactivating}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={deactivate}
              disabled={deactivating}
              className="bg-red-600 hover:bg-red-700"
            >
              {deactivating ? "Désactivation…" : "Désactiver"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="space-y-1">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="text-sm font-medium text-slate-900">{value || "—"}</p>
    </div>
  );
}

function KycToggle({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between rounded-md border border-slate-200 px-3 py-2">
      <Label className="cursor-pointer">{label}</Label>
      <Switch checked={value} onCheckedChange={onChange} />
    </div>
  );
}
