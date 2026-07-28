import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { friendlyError } from "@/lib/error-messages";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Plus, Trash2, Upload, Pencil, UserCheck, FileText, Users } from "lucide-react";
import { computeAge } from "@/lib/kyc-utils";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { confirmAction } from "@/components/ConfirmDialog";
import {
  GENDERS,
  MEDAL_LABELS,
  athleteSchema,
  type Athlete,
  type AthleteDocument,
  type AthleteForm,
  type AthleteRelation,
  type AthleteResult,
  type Coach,
  type Federation,
  type Game,
  type GameCompetition,
  type Selection,
  type Sport,
} from "@/lib/types";
import { useTypeGroup, clsForCode } from "@/hooks/useTypeItems";
import { EditableSelect } from "@/components/EditableSelect";
import { AthletePhotoUpload } from "@/components/AthletePhotoUpload";
import { findPersonIdForLegacy, syncPhotoFromLegacy } from "@/lib/person-photo-sync";
import { syncLegacyToPerson } from "@/lib/person-sync";

import {
  useAthleteLevels,
  useSports,
} from "@/hooks/useReferenceData";
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
import { useHashTab } from "@/hooks/useHashTab";
import { WeekAgenda } from "@/components/WeekAgenda";
import { MessageDetailDialog } from "@/components/MessageDetailDialog";

type Appointment = {
  id: string;
  athlete_id: string;
  title: string;
  description: string | null;
  location: string | null;
  starts_at: string;
  ends_at: string | null;
};

export const Route = createFileRoute("/_authenticated/athletes/$id")({
  component: AthleteDetailPage,
});

const ALL = "__all";

function statusBadge(s: string, label: string) {
  const cls = clsForCode("athlete_statuses", s);
  return <Badge className={`${cls} hover:${cls}`}>{label}</Badge>;
}

function AthleteDetailPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { role, user } = useAuth();
  const isAdmin = role === "admin";
  const [tab, setTab] = useHashTab("profil");
  const { items: levels, add: addLevel, remove: removeLevel } = useAthleteLevels();
  const { items: sportsRef, add: addSport, remove: removeSport } = useSports();
  const athleteStatusesHook = useTypeGroup("athlete_statuses");
  const athleteLevelsHook = useTypeGroup("athlete_levels");
  const coachRolesHook = useTypeGroup("coach_roles");
  const [athlete, setAthlete] = useState<Athlete | null>(null);
  const [personId, setPersonId] = useState<string | null>(null);
  const [personData, setPersonData] = useState<{
    street: string | null; postcode: string | null; city: string | null; country: string | null;
    emergency_contact_name: string | null; emergency_contact_phone: string | null;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [sport, setSport] = useState<Sport | null>(null);
  const [federation, setFederation] = useState<Federation | null>(null);
  const [docs, setDocs] = useState<AthleteDocument[] | null>(null);
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

  const [relOpen, setRelOpen] = useState(false);
  const [relForm, setRelForm] = useState({
    coach_id: "",
    relation_role: "coach",
    start_date: new Date().toISOString().slice(0, 10),
    end_date: "",
  });

  // Agenda
  const [appointments, setAppointments] = useState<Appointment[] | null>(null);
  const [apptOpen, setApptOpen] = useState(false);
  const [apptEditing, setApptEditing] = useState<Appointment | null>(null);
  const [apptForm, setApptForm] = useState({
    title: "",
    description: "",
    location: "",
    starts_at: "",
    ends_at: "",
  });
  const [apptDeleteId, setApptDeleteId] = useState<string | null>(null);

  // Messages received
  type AthleteMsg = {
    id: string;
    subject: string;
    channel: string;
    sent_at: string;
    audience_segment: string;
  };
  const [athleteMessages, setAthleteMessages] = useState<AthleteMsg[] | null>(null);
  const [openMsgId, setOpenMsgId] = useState<string | null>(null);

  const [refs, setRefs] = useState<{ sports: Sport[]; feds: Federation[] }>({
    sports: [],
    feds: [],
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

    // Load person data (address, emergency contact) — persons is the source of truth
    const { data: pidRow } = await supabase
      .from("athletes").select("person_id").eq("id", id).maybeSingle();
    const pid = (pidRow as { person_id?: string | null } | null)?.person_id ?? null;
    setPersonId(pid);
    if (pid) {
      const { data: pd } = await supabase
        .from("persons")
        .select("street,postcode,city,country,emergency_contact_name,emergency_contact_phone")
        .eq("id", pid).maybeSingle();
      setPersonData((pd ?? null) as typeof personData | null);
    }

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

    const [{ data: dd }, { data: rr }, { data: ss }, { data: ap }, { data: mr }] = await Promise.all([
      supabase
        .from("athlete_documents")
        .select("*")
        .eq("athlete_id", id)
        .order("created_at", { ascending: false }),
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
        .from("athlete_appointments")
        .select("*")
        .eq("athlete_id", id)
        .order("starts_at", { ascending: true }),
      supabase
        .from("message_recipients")
        .select("message:messages_sent(id,subject,channel,sent_at,audience_segment)")
        .eq("athlete_id", id),
    ]);
    setDocs((dd ?? []) as AthleteDocument[]);
    setRelations((rr ?? []) as AthleteRelation[]);
    setSelections((ss ?? []) as Selection[]);
    setAppointments((ap ?? []) as Appointment[]);
    const msgs = ((mr ?? []) as unknown as Array<{ message: AthleteMsg | AthleteMsg[] | null }>)
      .map((r) => (Array.isArray(r.message) ? r.message[0] : r.message))
      .filter((x): x is AthleteMsg => !!x)
      .sort((a, b) => b.sent_at.localeCompare(a.sent_at));
    setAthleteMessages(msgs);

    // Load results separately
    const { data: rsData } = await supabase
      .from("athlete_results")
      .select("*, game:games(name,edition_year), game_competition:game_competitions(name), sport:sports(name), discipline:disciplines(name)")
      .eq("athlete_id", id)
      .order("result_date", { ascending: false, nullsFirst: false });
    setResults((rsData ?? []) as ResultRow[]);
  };

  useEffect(() => {
    loadAll();
    (async () => {
      const [sp, fd, co, gm, gc] = await Promise.all([
        supabase.from("sports").select("*").order("name"),
        supabase.from("federations").select("*").order("acronym"),
        supabase.from("coaches").select("*").eq("is_active", true).order("last_name"),
        supabase.from("games").select("*").order("competition_start", { ascending: false }),
        supabase.from("game_competitions").select("*"),
      ]);
      setRefs({
        sports: (sp.data ?? []) as Sport[],
        feds: (fd.data ?? []) as Federation[],
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
      email: athlete.email ?? "",
      phone: athlete.phone ?? "",
      address: [personData?.street, personData?.postcode, personData?.city, personData?.country].filter(Boolean).join(", ") || "",
      street: personData?.street ?? "",
      postcode: personData?.postcode ?? "",
      city: personData?.city ?? "",
      country: personData?.country ?? "",
      emergency_contact_name: personData?.emergency_contact_name ?? "",
      emergency_contact_phone: personData?.emergency_contact_phone ?? "",
      photo_url: athlete.photo_url ?? "",
      primary_sport_id: athlete.primary_sport_id ?? "",
      primary_federation_id: athlete.primary_federation_id ?? "",
      status: athlete.status,
      level: athlete.level ?? "",
      size_clothing: athlete.size_clothing ?? "",
      size_shoes: athlete.size_shoes ?? "",
      size_gloves: athlete.size_gloves ?? "",
      passport_number: athlete.passport_number ?? "",
      passport_expiry: athlete.passport_expiry ?? "",
      last_medical_check: athlete.last_medical_check ?? "",
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
      nationality: v.nationality.toUpperCase(),
      email: v.email || null,
      phone: v.phone || null,
      address: v.address || null,
      emergency_contact_name: v.emergency_contact_name || null,
      emergency_contact_phone: v.emergency_contact_phone || null,
      primary_sport_id: v.primary_sport_id || null,
      primary_federation_id: v.primary_federation_id || null,
      level: v.level || null,
      size_clothing: v.size_clothing || null,
      size_shoes: v.size_shoes || null,
      size_gloves: v.size_gloves || null,
      passport_number: v.passport_number || null,
      passport_expiry: v.passport_expiry || null,
      last_medical_check: v.last_medical_check || null,
      updated_at: new Date().toISOString(),
    };
    const { error } = await supabase.from("athletes").update(payload).eq("id", athlete.id);
    setSaving(false);
    if (error) {
      toast.error("Échec", { description: friendlyError(error) });
      return;
    }
    // Sync contact/address to persons table
    if (personId) {
      await syncLegacyToPerson(personId, {
        email: v.email || null,
        phone: v.phone || null,
        street: v.street || null,
        postcode: v.postcode || null,
        city: v.city || null,
        country: v.country || null,
        emergency_contact_name: v.emergency_contact_name || null,
        emergency_contact_phone: v.emergency_contact_phone || null,
      });
    }
    toast.success("Athlète mis à jour");
    setEditOpen(false);
    loadAll();
  };

  const toggleActive = async (nextActive: boolean) => {
    if (!athlete) return;
    setDeactivating(true);
    const { error } = await supabase
      .from("athletes")
      .update({ is_active: nextActive })
      .eq("id", athlete.id);
    setDeactivating(false);
    setConfirmDeactivate(false);
    if (error) {
      toast.error(nextActive ? "Réactivation impossible" : "Désactivation impossible", {
        description: friendlyError(error),
      });
      return;
    }
    toast.success(nextActive ? "Athlète réactivé" : "Athlète désactivé");
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
      toast.error("Échec", { description: friendlyError(error) });
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
    if (!(await confirmAction({ title: "Supprimer cette relation ?", confirmLabel: "Supprimer" }))) return;
    const { error } = await supabase.from("athlete_relations").delete().eq("id", relId);
    if (error) return toast.error("Échec", { description: friendlyError(error) });
    toast.success("Relation supprimée");
    loadAll();
  };

  const submitAppt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!apptForm.title.trim() || !apptForm.starts_at) {
      toast.error("Titre et date de début requis");
      return;
    }
    const payload = {
      athlete_id: id,
      title: apptForm.title.trim(),
      description: apptForm.description.trim() || null,
      location: apptForm.location.trim() || null,
      starts_at: new Date(apptForm.starts_at).toISOString(),
      ends_at: apptForm.ends_at ? new Date(apptForm.ends_at).toISOString() : null,
    };
    const { error } = apptEditing
      ? await supabase.from("athlete_appointments").update(payload).eq("id", apptEditing.id)
      : await supabase.from("athlete_appointments").insert(payload);
    if (error) return toast.error("Échec", { description: friendlyError(error) });
    toast.success(apptEditing ? "Rendez-vous mis à jour" : "Rendez-vous ajouté");
    setApptOpen(false);
    setApptEditing(null);
    loadAll();
  };

  const deleteAppt = async () => {
    if (!apptDeleteId) return;
    const { error } = await supabase.from("athlete_appointments").delete().eq("id", apptDeleteId);
    setApptDeleteId(null);
    if (error) return toast.error("Échec", { description: friendlyError(error) });
    toast.success("Rendez-vous supprimé");
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
    if (error) return toast.error("Échec", { description: friendlyError(error) });
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

  if (loading) {
    return <div className="rounded-lg border border-border bg-card"><TableSkeleton cols={4} /></div>;
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

  const lvl = athleteLevelsHook.findItem(athlete.level);
  const isElite = athlete.level === "elite" || athlete.level === "promotion";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button asChild variant="ghost" size="icon">
            <Link to="/athletes"><ArrowLeft className="h-4 w-4" /></Link>
          </Button>
          <AthletePhotoUpload
            athleteId={id}
            currentPhotoUrl={
              (docs ?? []).find((d) => d.doc_type === "photo_identite")?.file_url ??
              athlete.photo_url
            }
            initials={`${athlete.first_name[0] ?? ""}${athlete.last_name[0] ?? ""}`}
            size="lg"
            onDeleted={() => {
              setAthlete((a) => (a ? { ...a, photo_url: null } : a));
              setDocs((prev) => (prev ?? []).filter((d) => d.doc_type !== "photo_identite"));
              (async () => {
                const personId = await findPersonIdForLegacy(
                  "athlete_profiles",
                  "legacy_athlete_id",
                  id,
                );
                await syncPhotoFromLegacy(personId, { photo_url: null, photo_storage_path: null });
              })();
            }}
            onUploaded={(url, docId) => {
              setAthlete((a) => (a ? { ...a, photo_url: url } : a));
              (async () => {
                const personId = await findPersonIdForLegacy(
                  "athlete_profiles",
                  "legacy_athlete_id",
                  id,
                );
                await syncPhotoFromLegacy(personId, { photo_url: url, photo_storage_path: null });
              })();

              setDocs((prev) => {
                const list = prev ?? [];
                const existing = list.find((d) => d.doc_type === "photo_identite");
                if (existing) {
                  return list.map((d) =>
                    d.doc_type === "photo_identite" ? { ...d, file_url: url } : d,
                  );
                }
                return [
                  ...list,
                  {
                    id: docId ?? `tmp-${Date.now()}`,
                    athlete_id: id,
                    category: "admin",
                    doc_type: "photo_identite",
                    file_name: "photo_identite",
                    file_url: url,
                    issued_date: null,
                    expiry_date: null,
                    status: "valid",
                    created_at: new Date().toISOString(),
                  } as AthleteDocument,
                ];
              });
            }}
          />
          <div>
            <h1 className="text-2xl font-semibold text-foreground">
              {athlete.first_name} {athlete.last_name}
            </h1>
            <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
              <span className="font-mono">{athlete.cosl_id}</span>
              {statusBadge(athlete.status, athleteStatusesHook.getLabel(athlete.status))}
              {athlete.is_active === false && (
                <Badge variant="outline" className="border-border text-muted-foreground">
                  Inactif
                </Badge>
              )}
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          {personId && (
            <Button asChild variant="outline">
              <Link to="/persons/$personId" params={{ personId }}>
                <Users className="mr-2 h-4 w-4" /> Fiche personne
              </Link>
            </Button>
          )}
          <Button onClick={openEdit} className="bg-primary hover:bg-[var(--cosl-red-dark)]">
            <Pencil className="mr-2 h-4 w-4" /> Modifier
          </Button>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="profil">Profil</TabsTrigger>
          <TabsTrigger value="sportif">Sport</TabsTrigger>
          <TabsTrigger value="relations">Relations</TabsTrigger>
          <TabsTrigger value="selections">Sélections</TabsTrigger>
          <TabsTrigger value="agenda">Agenda</TabsTrigger>
          <TabsTrigger value="palmares">Palmarès</TabsTrigger>
          <TabsTrigger value="messages">Messages</TabsTrigger>
        </TabsList>

        <TabsContent value="profil">
          <div className="grid gap-4 rounded-lg border border-border bg-card p-6 md:grid-cols-2">
            <Field
              label="Date de naissance"
              value={
                athlete.birth_date
                  ? `${new Date(athlete.birth_date).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" })}${
                      computeAge(athlete.birth_date) !== null
                        ? ` · ${computeAge(athlete.birth_date)} ans`
                        : ""
                    }`
                  : null
              }
            />
            <Field label="Lieu de naissance" value={athlete.birth_place} />
            <Field
              label="Genre"
              value={GENDERS.find((g) => g.value === athlete.gender)?.label ?? athlete.gender}
            />
            <Field label="Nationalité" value={athlete.nationality} />
            <Field label="Email" value={athlete.email} />
            <Field label="Téléphone" value={athlete.phone} />
            <Field label="Adresse" value={[personData?.street, personData?.postcode, personData?.city, personData?.country].filter(Boolean).join(", ") || null} />
            <Field label="Contact urgence" value={personData?.emergency_contact_name} />
            <Field label="Téléphone urgence" value={personData?.emergency_contact_phone} />
            <Field label="Taille vêtement" value={athlete.size_clothing} />
            <Field label="Pointure" value={athlete.size_shoes} />
            <Field label="Taille gants" value={athlete.size_gloves} />
            <Field label="Passeport" value={athlete.passport_number} />
            <Field label="Expiration passeport" value={athlete.passport_expiry} />
          </div>
          {personId && (
            <div className="mt-4 flex items-center justify-between rounded-lg border border-[var(--lux-blue-light)] bg-[var(--lux-blue-light)] p-4">
              <div className="text-sm text-foreground">
                <FileText className="mr-2 inline h-4 w-4 text-[var(--lux-blue)]" />
                Les documents sont gérés sur la fiche personne.
              </div>
              <Button asChild size="sm" variant="outline">
                <Link to="/persons/$personId" params={{ personId: personId }}>
                  Voir les documents
                </Link>
              </Button>
            </div>
          )}
        </TabsContent>

        <TabsContent value="sportif">
          <div className="grid gap-4 rounded-lg border border-border bg-card p-6 md:grid-cols-2">
            <Field label="Sport principal" value={sport?.name} />
            <Field label="Fédération" value={federation ? `${federation.acronym} — ${federation.name}` : null} />
            <Field
              label="Statut"
              value={athleteStatusesHook.getLabel(athlete.status)}
            />
            <Field label="Niveau" value={lvl?.label} />
            {(athlete.level === "elite" || athlete.level === "promotion") && (
              <Field label="Dernier médico sportif" value={athlete.last_medical_check} />
            )}
            <div className="md:col-span-2 text-sm text-muted-foreground">
              Historique des statuts — à enrichir lors d'évolutions du statut.
            </div>
          </div>
        </TabsContent>

        <TabsContent value="relations">
          <div className="space-y-3">
            <div className="flex justify-end">
              <Button onClick={() => setRelOpen(true)} className="bg-primary hover:bg-[var(--cosl-red-dark)]">
                <Plus className="mr-2 h-4 w-4" /> Ajouter une relation
              </Button>
            </div>
            <div className="rounded-lg border border-border bg-card">
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
                          {coachRolesHook.getLabel(r.relation_role)}
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
          <div className="rounded-lg border border-border bg-card">
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
                      <TableCell className="text-muted-foreground">{s.comment ?? "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </TabsContent>


        <TabsContent value="agenda">
          <div className="space-y-3">
            <div className="flex justify-end">
              <Button
                onClick={() => {
                  setApptEditing(null);
                  setApptForm({ title: "", description: "", location: "", starts_at: "", ends_at: "" });
                  setApptOpen(true);
                }}
                className="bg-primary hover:bg-[var(--cosl-red-dark)]"
              >
                <Plus className="mr-2 h-4 w-4" /> Ajouter un rendez-vous
              </Button>
            </div>
            {appointments === null ? (
              <TableSkeleton cols={5} />
            ) : (
              <WeekAgenda
                events={appointments}
                onCreate={(startsAt) => {
                  setApptEditing(null);
                  // Default to 1h slot
                  const end = new Date(startsAt);
                  end.setHours(end.getHours() + 1);
                  const pad = (n: number) => n.toString().padStart(2, "0");
                  const endStr = `${end.getFullYear()}-${pad(end.getMonth() + 1)}-${pad(end.getDate())}T${pad(end.getHours())}:${pad(end.getMinutes())}`;
                  setApptForm({ title: "", description: "", location: "", starts_at: startsAt, ends_at: endStr });
                  setApptOpen(true);
                }}
                onEdit={(a) => {
                  setApptEditing(a as Appointment);
                  const pad = (n: number) => n.toString().padStart(2, "0");
                  const toLocal = (iso: string) => {
                    const d = new Date(iso);
                    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
                  };
                  setApptForm({
                    title: a.title,
                    description: a.description ?? "",
                    location: a.location ?? "",
                    starts_at: toLocal(a.starts_at),
                    ends_at: a.ends_at ? toLocal(a.ends_at) : "",
                  });
                  setApptOpen(true);
                }}
              />
            )}
          </div>
        </TabsContent>

        <TabsContent value="palmares">
          <div className="space-y-4">
            {(() => {
              const r = results ?? [];
              const gold = r.filter((x) => x.medal === "gold").length;
              const silver = r.filter((x) => x.medal === "silver").length;
              const bronze = r.filter((x) => x.medal === "bronze").length;
              const rn = r.filter((x) => x.is_national_record).length;
              const pb = r.filter((x) => x.is_personal_best).length;
              return (
                <div className="grid gap-3 md:grid-cols-5">
                  <SummaryCard label="Or" value={gold} cls="bg-amber-100 text-amber-800" />
                  <SummaryCard label="Argent" value={silver} cls="bg-slate-200 text-foreground" />
                  <SummaryCard label="Bronze" value={bronze} cls="bg-orange-100 text-orange-700" />
                  <SummaryCard label="Records nationaux" value={rn} cls="bg-[var(--cosl-red-light)] text-primary" />
                  <SummaryCard label="Personal bests" value={pb} cls="bg-emerald-100 text-emerald-700" />
                </div>
              );
            })()}
            <div className="flex justify-end">
              <Button onClick={() => setResultOpen(true)} className="bg-primary hover:bg-[var(--cosl-red-dark)]">
                <Plus className="mr-2 h-4 w-4" /> Ajouter un résultat
              </Button>
            </div>
            <div className="rounded-lg border border-border bg-card">
              {results === null ? (
                <TableSkeleton cols={9} />
              ) : results.length === 0 ? (
                <div className="p-6"><EmptyState message="Aucun résultat enregistré." /></div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Games</TableHead>
                      <TableHead>Épreuve</TableHead>
                      <TableHead>Sport</TableHead>
                      <TableHead>Discipline</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Classement</TableHead>
                      <TableHead>Médaille</TableHead>
                      <TableHead>Score</TableHead>
                      <TableHead>RN</TableHead>
                      <TableHead>PB</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {results.map((r) => {
                      const med = r.medal ? MEDAL_LABELS.find((m) => m.value === r.medal) : null;
                      return (
                        <TableRow key={r.id}>
                          <TableCell>{r.game ? `${r.game.name} ${r.game.edition_year}` : "—"}</TableCell>
                          <TableCell>{r.game_competition?.name ?? "—"}</TableCell>
                          <TableCell>{r.sport?.name ?? "—"}</TableCell>
                          <TableCell>{r.discipline?.name ?? "—"}</TableCell>
                          <TableCell>{r.result_date ?? "—"}</TableCell>
                          <TableCell>{r.rank ?? "—"}</TableCell>
                          <TableCell>{med ? <Badge className={`${med.cls} hover:${med.cls}`}>{med.label}</Badge> : "—"}</TableCell>
                          <TableCell>{r.score ? `${r.score}${r.unit ? " " + r.unit : ""}` : "—"}</TableCell>
                          <TableCell>{r.is_national_record ? <Badge className="bg-[var(--cosl-red-light)] text-primary hover:bg-[var(--cosl-red-light)]">RN</Badge> : "—"}</TableCell>
                          <TableCell>{r.is_personal_best ? <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">PB</Badge> : "—"}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="messages">
          <div className="rounded-lg border border-border bg-card">
            {athleteMessages === null ? (
              <TableSkeleton cols={4} />
            ) : athleteMessages.length === 0 ? (
              <div className="p-6">
                <EmptyState message="Aucun message reçu." />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Sujet</TableHead>
                    <TableHead>Canal</TableHead>
                    <TableHead>Audience</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {athleteMessages.map((m) => (
                    <TableRow
                      key={m.id}
                      className="cursor-pointer hover:bg-muted"
                      onClick={() => setOpenMsgId(m.id)}
                    >
                      <TableCell>
                        {new Date(m.sent_at).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}
                      </TableCell>
                      <TableCell className="font-medium">{m.subject}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{m.channel}</Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{m.audience_segment}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </TabsContent>
      </Tabs>

      <MessageDetailDialog messageId={openMsgId} onClose={() => setOpenMsgId(null)} />

      <div className="flex justify-end border-t border-border pt-4">
        {athlete.is_active === false && isAdmin ? (
          <Button
            className="bg-emerald-500 hover:bg-emerald-600 text-white"
            onClick={() => setConfirmDeactivate(true)}
          >
            <UserCheck className="mr-2 h-4 w-4" /> Réactiver l'athlète
          </Button>
        ) : (
          <Button
            variant="outline"
            className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
            onClick={() => setConfirmDeactivate(true)}
            disabled={athlete.is_active === false}
          >
            Désactiver l'athlète
          </Button>
        )}
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
                    <Label>Adresse</Label>
                    <Input
                      value={form.address ?? ""}
                      onChange={(e) => setForm({ ...form, address: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Contact urgence — nom</Label>
                    <Input
                      value={form.emergency_contact_name ?? ""}
                      onChange={(e) => setForm({ ...form, emergency_contact_name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Contact urgence — téléphone</Label>
                    <Input
                      value={form.emergency_contact_phone ?? ""}
                      onChange={(e) => setForm({ ...form, emergency_contact_phone: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Sport</Label>
                    <EditableSelect
                      value={form.primary_sport_id ?? ""}
                      onValueChange={(v) => setForm({ ...form, primary_sport_id: v })}
                      options={sportsRef.map((s) => ({ value: s.id, label: s.name }))}
                      emptyLabel="—"
                      onAdd={addSport}
                      onDelete={removeSport}
                      addLabel="+ Ajouter un sport…"
                      manageTitle="Gérer les sports"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Fédération</Label>
                    <Select
                      value={form.primary_federation_id || ALL}
                      onValueChange={(v) =>
                        setForm({
                          ...form,
                          primary_federation_id: v === ALL ? "" : v,
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
                    <Label>Statut</Label>
                    <Select
                      value={form.status}
                      onValueChange={(v) =>
                        setForm({ ...form, status: v as AthleteForm["status"] })
                      }
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {athleteStatusesHook.items.map((s) => (
                          <SelectItem key={s.code} value={s.code}>{s.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Niveau</Label>
                    <EditableSelect
                      value={form.level ?? ""}
                      onValueChange={(v) =>
                        setForm({ ...form, level: v as AthleteForm["level"] })
                      }
                      options={athleteLevelsHook.items.map((l) => ({ value: l.code, label: l.label }))}
                      emptyLabel="—"
                      onAdd={addLevel}
                      onDelete={removeLevel}
                      addLabel="+ Ajouter un niveau…"
                      manageTitle="Gérer les niveaux"
                    />
                  </div>
                </div>
                {(form.level === "elite" || form.level === "promotion") && (
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                    <div className="space-y-1.5">
                      <Label>Dernier médico sportif</Label>
                      <Input
                        type="date"
                        value={form.last_medical_check ?? ""}
                        onChange={(e) => setForm({ ...form, last_medical_check: e.target.value })}
                      />
                    </div>
                  </div>
                )}
                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                  <div className="space-y-1.5">
                    <Label>Taille vêtement</Label>
                    <Input
                      value={form.size_clothing ?? ""}
                      onChange={(e) => setForm({ ...form, size_clothing: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Pointure</Label>
                    <Input
                      value={form.size_shoes ?? ""}
                      onChange={(e) => setForm({ ...form, size_shoes: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Taille gants</Label>
                    <Input
                      value={form.size_gloves ?? ""}
                      onChange={(e) => setForm({ ...form, size_gloves: e.target.value })}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label>N° passeport</Label>
                    <Input
                      value={form.passport_number ?? ""}
                      onChange={(e) => setForm({ ...form, passport_number: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Expiration passeport</Label>
                    <Input
                      type="date"
                      value={form.passport_expiry ?? ""}
                      onChange={(e) => setForm({ ...form, passport_expiry: e.target.value })}
                    />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setEditOpen(false)} disabled={saving}>
                  Annuler
                </Button>
                <Button type="submit" className="bg-primary hover:bg-[var(--cosl-red-dark)]" disabled={saving}>
                  {saving ? "Enregistrement…" : "Enregistrer"}
                </Button>
              </DialogFooter>
            </form>
          )}
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
                        {c.first_name} {c.last_name} — {coachRolesHook.getLabel(c.role)}
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
                    {coachRolesHook.items.map((c) => (
                      <SelectItem key={c.code} value={c.code}>{c.label}</SelectItem>
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
              <Button type="submit" className="bg-primary hover:bg-[var(--cosl-red-dark)]">
                Ajouter
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Appointment dialog */}
      <Dialog open={apptOpen} onOpenChange={(o) => { setApptOpen(o); if (!o) setApptEditing(null); }}>
        <DialogContent className="max-w-lg">
          <form onSubmit={submitAppt}>
            <DialogHeader>
              <DialogTitle>{apptEditing ? "Modifier le rendez-vous" : "Ajouter un rendez-vous"}</DialogTitle>
            </DialogHeader>
            <div className="grid gap-3 py-4">
              <div className="space-y-1">
                <Label>Titre *</Label>
                <Input value={apptForm.title} onChange={(e) => setApptForm({ ...apptForm, title: e.target.value })} />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label>Début *</Label>
                  <Input
                    type="datetime-local"
                    value={apptForm.starts_at}
                    onChange={(e) => setApptForm({ ...apptForm, starts_at: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <Label>Fin</Label>
                  <Input
                    type="datetime-local"
                    value={apptForm.ends_at}
                    onChange={(e) => setApptForm({ ...apptForm, ends_at: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label>Lieu</Label>
                <Input value={apptForm.location} onChange={(e) => setApptForm({ ...apptForm, location: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>Description</Label>
                <Textarea
                  value={apptForm.description}
                  onChange={(e) => setApptForm({ ...apptForm, description: e.target.value })}
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter className="gap-2 sm:justify-between">
              <div>
                {apptEditing && (
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={() => {
                      const idToDelete = apptEditing.id;
                      setApptOpen(false);
                      setApptDeleteId(idToDelete);
                    }}
                  >
                    Supprimer
                  </Button>
                )}
              </div>
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={() => setApptOpen(false)}>Annuler</Button>
                <Button type="submit" className="bg-primary hover:bg-[var(--cosl-red-dark)]">
                  {apptEditing ? "Enregistrer" : "Ajouter"}
                </Button>
              </div>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!apptDeleteId} onOpenChange={(o) => !o && setApptDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce rendez-vous ?</AlertDialogTitle>
            <AlertDialogDescription>Cette action est irréversible.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={deleteAppt} className="bg-red-600 hover:bg-red-700">
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={resultOpen} onOpenChange={setResultOpen}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Ajouter un résultat</DialogTitle></DialogHeader>
          <div className="grid gap-3 py-4 sm:grid-cols-2">
            <div className="space-y-1">
              <Label>Games *</Label>
              <Select value={resultForm.game_id} onValueChange={(v) => setResultForm({ ...resultForm, game_id: v, game_competition_id: "" })}>
                <SelectTrigger><SelectValue placeholder="Choisir" /></SelectTrigger>
                <SelectContent>
                  {games.map((g) => (<SelectItem key={g.id} value={g.id}>{g.name} {g.edition_year}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Épreuve</Label>
              <Select value={resultForm.game_competition_id || ALL} onValueChange={(v) => setResultForm({ ...resultForm, game_competition_id: v === ALL ? "" : v })}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>—</SelectItem>
                  {competitions.filter((c) => !resultForm.game_id || c.game_id === resultForm.game_id).map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Sport</Label>
              <Select value={resultForm.sport_id || ALL} onValueChange={(v) => setResultForm({ ...resultForm, sport_id: v === ALL ? "" : v, discipline_id: "" })}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>—</SelectItem>
                  {refs.sports.map((s) => (<SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Date</Label>
              <Input type="date" value={resultForm.result_date} onChange={(e) => setResultForm({ ...resultForm, result_date: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>Classement</Label>
              <Input type="number" value={resultForm.rank} onChange={(e) => setResultForm({ ...resultForm, rank: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>Médaille</Label>
              <Select value={resultForm.medal || ALL} onValueChange={(v) => setResultForm({ ...resultForm, medal: v === ALL ? "" : v })}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>Aucune</SelectItem>
                  {MEDAL_LABELS.map((m) => (<SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Score</Label>
              <Input value={resultForm.score} onChange={(e) => setResultForm({ ...resultForm, score: e.target.value })} placeholder="10.93" />
            </div>
            <div className="space-y-1">
              <Label>Unité</Label>
              <Input value={resultForm.unit} onChange={(e) => setResultForm({ ...resultForm, unit: e.target.value })} placeholder="s, m, pts" />
            </div>
            <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
              <Label>Record national</Label>
              <Switch checked={resultForm.is_national_record} onCheckedChange={(v) => setResultForm({ ...resultForm, is_national_record: v })} />
            </div>
            <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
              <Label>Personal best</Label>
              <Switch checked={resultForm.is_personal_best} onCheckedChange={(v) => setResultForm({ ...resultForm, is_personal_best: v })} />
            </div>
            <div className="sm:col-span-2 space-y-1">
              <Label>Notes</Label>
              <Textarea value={resultForm.notes} onChange={(e) => setResultForm({ ...resultForm, notes: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResultOpen(false)}>Annuler</Button>
            <Button onClick={submitResult} className="bg-primary hover:bg-[var(--cosl-red-dark)]">Ajouter</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmDeactivate} onOpenChange={setConfirmDeactivate}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {athlete.is_active === false ? "Réactiver cet athlète ?" : "Désactiver cet athlète ?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {athlete.is_active === false
                ? "L'athlète sera à nouveau actif et visible dans les listes."
                : "L'athlète sera marqué comme inactif (soft delete) et n'apparaîtra plus par défaut dans les listes."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deactivating}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => toggleActive(athlete.is_active === false)}
              disabled={deactivating}
              className={athlete.is_active === false ? "bg-emerald-500 hover:bg-emerald-600" : "bg-red-600 hover:bg-red-700"}
            >
              {deactivating
                ? (athlete.is_active === false ? "Réactivation…" : "Désactivation…")
                : (athlete.is_active === false ? "Réactiver" : "Désactiver")}
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
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-sm font-medium text-foreground">{value || "—"}</p>
    </div>
  );
}

function SummaryCard({ label, value, cls }: { label: string; value: number; cls: string }) {
  return (
    <div className={`rounded-lg border border-border p-4 ${cls}`}>
      <p className="text-xs uppercase tracking-wide opacity-80">{label}</p>
      <p className="text-2xl font-semibold">{value}</p>
    </div>
  );
}
