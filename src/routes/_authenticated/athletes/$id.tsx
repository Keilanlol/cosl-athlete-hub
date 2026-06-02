import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { friendlyError } from "@/lib/error-messages";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Plus, Trash2, Upload, Pencil, UserCheck, FileText, AlertTriangle, CheckCircle2 } from "lucide-react";
import { KycStatusBadge } from "@/components/KycStatusBadge";
import { KycAxis } from "@/components/KycAxis";
import { computeKycGlobalStatus, countValidAxes, computeAge } from "@/lib/kyc-utils";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { confirmAction } from "@/components/ConfirmDialog";
import {
  ATHLETE_STATUSES,
  COACH_ROLES,
  DOCUMENT_CATEGORIES,
  DOCUMENT_STATUSES,
  GENDERS,
  MEDAL_LABELS,
  KYC_AXE_LABELS,
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
  type KycAxisKey,
  type KycHistoryEntry,
  type Selection,
  type Sport,
} from "@/lib/types";
import { EditableSelect } from "@/components/EditableSelect";
import { AthletePhotoUpload } from "@/components/AthletePhotoUpload";
import {
  useAthleteLevels,
  useDocumentTypes,
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
import { FileUpload, pathFromSignedUrl } from "@/components/FileUpload";

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
  const { role, user } = useAuth();
  const isAdmin = role === "admin";
  const [tab, setTab] = useHashTab("profil");
  const { items: levels, add: addLevel, remove: removeLevel } = useAthleteLevels();
  const { items: sportsRef, add: addSport, remove: removeSport } = useSports();
  const { items: docTypes, add: addDocType, remove: removeDocType } = useDocumentTypes();
  const [athlete, setAthlete] = useState<Athlete | null>(null);
  const [loading, setLoading] = useState(true);
  const [sport, setSport] = useState<Sport | null>(null);
  const [federation, setFederation] = useState<Federation | null>(null);
  const [club, setClub] = useState<Club | null>(null);
  const [docs, setDocs] = useState<AthleteDocument[] | null>(null);
  const [kyc, setKyc] = useState<AthleteKyc | null>(null);
  const [kycHistory, setKycHistory] = useState<(KycHistoryEntry & { changed_by_profile?: { username?: string | null; full_name?: string | null } | null })[]>([]);
  const [kycReviewer, setKycReviewer] = useState<{ username?: string | null; full_name?: string | null } | null>(null);
  const [kycCommentDraft, setKycCommentDraft] = useState<string>("");
  useEffect(() => { setKycCommentDraft(kyc?.kyc_comment ?? ""); }, [kyc?.kyc_comment]);
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

    const [{ data: dd }, { data: kk }, { data: rr }, { data: ss }, { data: rs }, { data: ap }, { data: mr }] = await Promise.all([
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
    const kycRow = (kk ?? null) as AthleteKyc | null;
    setKyc(kycRow);
    // Load KYC history + reviewer profile in parallel
    const [{ data: hist }, reviewerRes] = await Promise.all([
      supabase
        .from("kyc_history")
        .select("*, changed_by_profile:user_profiles!kyc_history_changed_by_fkey(username, full_name)")
        .eq("athlete_id", id)
        .order("changed_at", { ascending: false })
        .limit(30),
      kycRow?.kyc_reviewed_by
        ? supabase.from("user_profiles").select("username, full_name").eq("id", kycRow.kyc_reviewed_by).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);
    setKycHistory(((hist ?? []) as unknown) as typeof kycHistory);
    setKycReviewer((reviewerRes.data ?? null) as { username?: string | null; full_name?: string | null } | null);
    setRelations((rr ?? []) as AthleteRelation[]);
    setSelections((ss ?? []) as Selection[]);
    setResults((rs ?? []) as ResultRow[]);
    setAppointments((ap ?? []) as Appointment[]);
    const msgs = ((mr ?? []) as unknown as Array<{ message: AthleteMsg | AthleteMsg[] | null }>)
      .map((r) => (Array.isArray(r.message) ? r.message[0] : r.message))
      .filter((x): x is AthleteMsg => !!x)
      .sort((a, b) => b.sent_at.localeCompare(a.sent_at));
    setAthleteMessages(msgs);
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
      toast.error("Échec", { description: friendlyError(error) });
      return;
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
      toast.error("Échec", { description: friendlyError(error) });
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
    const target = (docs ?? []).find((d) => d.id === docDeleteId);
    if (target?.file_url) {
      const storagePath = pathFromSignedUrl(target.file_url, "documents");
      if (storagePath) {
        await supabase.storage.from("documents").remove([storagePath]);
      }
    }
    const { error } = await supabase
      .from("athlete_documents")
      .delete()
      .eq("id", docDeleteId);
    setDocDeleteId(null);
    if (error) {
      toast.error("Suppression impossible", { description: friendlyError(error) });
      return;
    }
    toast.success("Document supprimé");
    loadAll();
  };

  const updateDocStatus = async (docId: string, nextStatus: string) => {
    const { error } = await supabase
      .from("athlete_documents")
      .update({ status: nextStatus })
      .eq("id", docId);
    if (error) {
      toast.error("Mise à jour impossible", { description: friendlyError(error) });
      return;
    }
    toast.success("Statut mis à jour");
    setDocs((prev) =>
      prev ? prev.map((d) => (d.id === docId ? { ...d, status: nextStatus } : d)) : prev
    );
  };

  const updateKyc = async (patch: Partial<AthleteKyc>, axis: KycAxisKey = "manual") => {
    const oldStatus = kyc?.global_status ?? null;
    const merged = { ...(kyc ?? {}), ...patch } as Partial<AthleteKyc>;
    const newStatus = computeKycGlobalStatus(merged);
    const fullPatch = {
      ...patch,
      global_status: newStatus,
      last_check_at: new Date().toISOString(),
    };
    if (!kyc) {
      const { error } = await supabase
        .from("athlete_kyc")
        .insert({ athlete_id: id, ...fullPatch });
      if (error) return toast.error("Échec", { description: friendlyError(error) });
    } else {
      const { error } = await supabase
        .from("athlete_kyc")
        .update(fullPatch)
        .eq("athlete_id", id);
      if (error) return toast.error("Échec", { description: friendlyError(error) });
    }
    if (oldStatus !== newStatus || axis !== "manual") {
      await supabase.from("kyc_history").insert({
        athlete_id: id,
        changed_by: user?.id ?? null,
        previous_status: oldStatus,
        new_status: newStatus,
        axis,
      });
    }
    toast.success("KYC mis à jour");
    loadAll();
  };

  const markKycReviewed = async () => {
    if (!user?.id) { toast.error("Utilisateur non identifié"); return; }
    const payload = {
      kyc_reviewed_by: user.id,
      kyc_reviewed_at: new Date().toISOString(),
    };
    const { error } = kyc
      ? await supabase.from("athlete_kyc").update(payload).eq("athlete_id", id)
      : await supabase.from("athlete_kyc").insert({ athlete_id: id, ...payload });
    if (error) return toast.error("Échec", { description: friendlyError(error) });
    toast.success("KYC marqué comme vérifié");
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

  const clubsForFed = useMemo(
    () =>
      form?.primary_federation_id
        ? refs.clubs.filter((c) => c.federation_id === form.primary_federation_id)
        : refs.clubs,
    [refs.clubs, form?.primary_federation_id],
  );

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

  const lvl = levels.find((l) => l.code === athlete.level);
  const globalKyc = kyc?.global_status ?? "red";

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
            }}
            onUploaded={(url, docId) => {
              setAthlete((a) => (a ? { ...a, photo_url: url } : a));
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
              {statusBadge(athlete.status)}
              {kycPill(globalKyc)}
              {athlete.is_active === false && (
                <Badge variant="outline" className="border-border text-muted-foreground">
                  Inactif
                </Badge>
              )}
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Button onClick={openEdit} className="bg-primary hover:bg-[var(--cosl-red-dark)]">
            <Pencil className="mr-2 h-4 w-4" /> Modifier
          </Button>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="profil">Profil</TabsTrigger>
          <TabsTrigger value="sportif">Sportif</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="kyc">KYC</TabsTrigger>
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
          <div className="grid gap-4 rounded-lg border border-border bg-card p-6 md:grid-cols-2">
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
            <div className="md:col-span-2 text-sm text-muted-foreground">
              Historique des statuts — à enrichir lors d'évolutions du statut.
            </div>
          </div>
        </TabsContent>

        <TabsContent value="documents">
          <div className="space-y-3">
            {/* Encart photo officielle — un seul document de type photo_identite par athlète */}
            <div className="rounded-lg border border-border bg-card p-4">
              <h3 className="text-sm font-semibold text-foreground mb-3">Photo officielle</h3>
              <div className="flex items-center gap-4">
                <AthletePhotoUpload
                  athleteId={id}
                  currentPhotoUrl={
                    (docs ?? []).find((d) => d.doc_type === "photo_identite")?.file_url ??
                    athlete.photo_url
                  }
                  initials={`${athlete.first_name[0] ?? ""}${athlete.last_name[0] ?? ""}`}
                  size="sm"
                  onDeleted={() => {
                    setAthlete((a) => (a ? { ...a, photo_url: null } : a));
                    setDocs((prev) => (prev ?? []).filter((d) => d.doc_type !== "photo_identite"));
                  }}
                  onUploaded={(url, docId) => {
                    setAthlete((a) => (a ? { ...a, photo_url: url } : a));
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
                <div className="text-sm text-muted-foreground">
                  {(docs ?? []).find((d) => d.doc_type === "photo_identite") ? (
                    <p className="text-emerald-600">✓ Photo uploadée</p>
                  ) : (
                    <p>Aucune photo — cliquez pour ajouter</p>
                  )}
                  <p className="text-xs mt-1">JPG, PNG ou WebP · max 5 MB</p>
                  <p className="text-xs text-muted-foreground">Une seule photo d'identité par athlète</p>
                </div>
              </div>
            </div>

            <div className="flex justify-end">
              <Button onClick={() => setDocOpen(true)} className="bg-primary hover:bg-[var(--cosl-red-dark)]">
                <Upload className="mr-2 h-4 w-4" /> Ajouter un document
              </Button>
            </div>
            <div className="rounded-lg border border-border bg-card">
              {docs === null ? (
                <TableSkeleton cols={6} />
              ) : docs.filter((d) => d.doc_type !== "photo_identite").length === 0 ? (
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
                    {docs.filter((d) => d.doc_type !== "photo_identite").map((d) => (
                      <TableRow key={d.id}>
                        <TableCell>
                          {DOCUMENT_CATEGORIES.find((c) => c.value === d.category)?.label ?? d.category}
                        </TableCell>
                        <TableCell>{docTypes.find((t) => t.code === d.doc_type)?.label ?? d.doc_type}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {d.file_url && /\.(png|jpe?g|webp|gif)(\?|$)/i.test(d.file_url) && (
                              <img
                                src={d.file_url}
                                alt=""
                                className="h-10 w-10 rounded object-cover border border-border"
                              />
                            )}
                            {d.file_url ? (
                              <a
                                href={d.file_url}
                                target="_blank"
                                rel="noreferrer"
                                className="text-[var(--lux-blue)] hover:underline"
                              >
                                {d.file_name}
                              </a>
                            ) : (
                              d.file_name
                            )}
                          </div>
                        </TableCell>
                        <TableCell>{d.issued_date ?? "—"}</TableCell>
                        <TableCell>{d.expiry_date ?? "—"}</TableCell>
                        <TableCell>
                          {isAdmin ? (
                            <Select
                              value={d.status}
                              onValueChange={(v) => updateDocStatus(d.id, v)}
                            >
                              <SelectTrigger className="h-8 w-40">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {DOCUMENT_STATUSES.map((s) => (
                                  <SelectItem key={s.value} value={s.value}>
                                    {s.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            docStatusBadge(d.status)
                          )}
                        </TableCell>
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
          <KycTabContent
            athlete={athlete}
            kyc={kyc}
            docs={docs ?? []}
            history={kycHistory}
            reviewer={kycReviewer}
            currentUserId={user?.id ?? null}
            updateKyc={updateKyc}
            markReviewed={markKycReviewed}
            commentDraft={kycCommentDraft}
            setCommentDraft={setKycCommentDraft}
          />
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
                    <EditableSelect
                      value={form.level ?? ""}
                      onValueChange={(v) =>
                        setForm({ ...form, level: v as AthleteForm["level"] })
                      }
                      options={levels.map((l) => ({ value: l.code, label: l.label }))}
                      emptyLabel="—"
                      onAdd={addLevel}
                      onDelete={removeLevel}
                      addLabel="+ Ajouter un niveau…"
                      manageTitle="Gérer les niveaux"
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
                <EditableSelect
                  value={docForm.doc_type}
                  onValueChange={(v) => setDocForm({ ...docForm, doc_type: v })}
                  options={docTypes
                    .filter((t) => t.category === docForm.category)
                    .map((t) => ({ value: t.code, label: t.label }))}
                  emptyLabel="—"
                  onAdd={(label) => addDocType(label, docForm.category)}
                  onDelete={removeDocType}
                  addLabel={`+ Ajouter un type (${docForm.category})…`}
                  manageTitle={`Types — ${docForm.category}`}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Nom du fichier *</Label>
                <Input
                  value={docForm.file_name}
                  onChange={(e) => setDocForm({ ...docForm, file_name: e.target.value })}
                  placeholder="Renseigné automatiquement après upload"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Fichier</Label>
                <FileUpload
                  bucket="documents"
                  path={`athletes/${id}/${docForm.category}/${Date.now()}_`}
                  accept="image/jpeg,image/png,image/webp,application/pdf"
                  currentUrl={docForm.file_url || null}
                  currentName={docForm.file_name || null}
                  onUploaded={(url, fileName) => {
                    setDocForm((prev) => ({
                      ...prev,
                      file_url: url,
                      file_name: prev.file_name || fileName,
                    }));
                  }}
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
              <Button type="submit" className="bg-primary hover:bg-[var(--cosl-red-dark)]">
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
              <Button type="submit" className="bg-primary hover:bg-[var(--cosl-red-dark)]">
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

type ReviewerProfile = { username?: string | null; full_name?: string | null } | null;
type KycHistoryRow = KycHistoryEntry & {
  changed_by_profile?: { username?: string | null; full_name?: string | null } | null;
};

function KycTabContent({
  athlete,
  kyc,
  docs,
  history,
  reviewer,
  currentUserId,
  updateKyc,
  markReviewed,
  commentDraft,
  setCommentDraft,
}: {
  athlete: Athlete;
  kyc: AthleteKyc | null;
  docs: AthleteDocument[];
  history: KycHistoryRow[];
  reviewer: ReviewerProfile;
  currentUserId: string | null;
  updateKyc: (patch: Partial<AthleteKyc>, axis?: KycAxisKey) => unknown;
  markReviewed: () => unknown;
  commentDraft: string;
  setCommentDraft: (v: string) => void;
}) {
  const globalStatus = kyc?.global_status ?? null;
  const nbValid = countValidAxes(kyc);

  const passportDoc = useMemo(
    () =>
      docs.find((d) => d.id === kyc?.passport_doc_id) ??
      docs.find(
        (d) =>
          d.doc_type?.toLowerCase().includes("passeport") ||
          d.doc_type?.toLowerCase().includes("identit"),
      ),
    [docs, kyc?.passport_doc_id],
  );

  const ethicsDoc = useMemo(
    () => docs.find((d) => d.id === kyc?.ethics_charter_doc_id),
    [docs, kyc?.ethics_charter_doc_id],
  );
  const rule40Doc = useMemo(
    () => docs.find((d) => d.id === kyc?.rule40_doc_id),
    [docs, kyc?.rule40_doc_id],
  );

  const age = useMemo(() => {
    if (!athlete.birth_date) return null;
    return Math.floor(
      (Date.now() - new Date(athlete.birth_date).getTime()) /
        (365.25 * 24 * 3600 * 1000),
    );
  }, [athlete.birth_date]);

  const reviewerName = reviewer?.full_name || reviewer?.username || null;

  const bannerCls =
    globalStatus === "green"
      ? "bg-emerald-50 border-emerald-200"
      : globalStatus === "orange"
      ? "bg-amber-50 border-amber-200"
      : "bg-red-50 border-red-200";

  return (
    <div className="space-y-4">
      {/* SECTION A — Bandeau statut global */}
      <div className={`rounded-lg border p-4 flex items-center justify-between gap-3 ${bannerCls}`}>
        <div className="flex items-center gap-3">
          <KycStatusBadge status={globalStatus} size="md" showIcon />
          <div>
            <p className="font-semibold text-foreground">
              Conformité KYC globale — {athlete.first_name} {athlete.last_name}
            </p>
            <p className="text-sm text-muted-foreground">
              {nbValid}/6 axes validés
              {kyc?.kyc_reviewed_at &&
                ` · Vérifié le ${new Date(kyc.kyc_reviewed_at).toLocaleDateString("fr-FR")}`}
              {reviewerName && ` par ${reviewerName}`}
            </p>
          </div>
        </div>
        <Button size="sm" variant="outline" onClick={() => markReviewed()} disabled={!currentUserId}>
          <CheckCircle2 className="mr-2 h-4 w-4" /> Marquer comme vérifié
        </Button>
      </div>

      {/* AXE 1 — Identité */}
      <KycAxis
        title="Identité officielle"
        description="Passeport ou carte d'identité valide, non expiré"
        status={kyc?.identity_verified ? "green" : "red"}
        required
      >
        <p className="text-xs font-medium text-foreground">Document lié</p>
        {passportDoc ? (
          <div className="flex items-center gap-3 rounded-md border border-border p-3">
            <FileText className="h-4 w-4 text-muted-foreground" />
            <div className="flex-1">
              <p className="text-sm font-medium">{passportDoc.doc_type}</p>
              <p className="text-xs text-muted-foreground">
                Expire le : {passportDoc.expiry_date ?? "—"}
                {passportDoc.expiry_date &&
                  new Date(passportDoc.expiry_date) < new Date() && (
                    <span className="ml-2 text-red-600 font-medium">EXPIRÉ</span>
                  )}
              </p>
            </div>
            {passportDoc.file_url && (
              <a href={passportDoc.file_url} target="_blank" rel="noreferrer">
                <Button variant="ghost" size="sm">Voir</Button>
              </a>
            )}
          </div>
        ) : (
          <p className="text-sm text-red-600">
            ⚠️ Aucun passeport ou CI trouvé dans les documents de l'athlète.
          </p>
        )}

        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">
            Lier un document existant comme pièce d'identité :
          </Label>
          <Select
            value={kyc?.passport_doc_id ?? "__none"}
            onValueChange={(v) =>
              updateKyc(
                {
                  passport_doc_id: v === "__none" ? null : v,
                  identity_verified: v !== "__none",
                },
                "identity",
              )
            }
          >
            <SelectTrigger className="h-8 text-sm">
              <SelectValue placeholder="Choisir parmi les documents uploadés…" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none">— Aucun —</SelectItem>
              {docs
                .filter(
                  (d) =>
                    d.category === "admin" ||
                    d.doc_type?.toLowerCase().includes("passeport") ||
                    d.doc_type?.toLowerCase().includes("identit"),
                )
                .map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.doc_type} — {d.file_name}
                    {d.expiry_date ? ` (exp. ${d.expiry_date})` : ""}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
          <Label className="text-sm">Identité vérifiée manuellement</Label>
          <Switch
            checked={!!kyc?.identity_verified}
            onCheckedChange={(v) => updateKyc({ identity_verified: v }, "identity")}
          />
        </div>
      </KycAxis>

      {/* AXE 2 — Nationalité */}
      <KycAxis
        title="Nationalité sportive & éligibilité internationale"
        description="Vérification de l'éligibilité à représenter le Luxembourg"
        status={kyc?.nationality_verified ? "green" : "red"}
        required
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label>Nationalité sportive déclarée</Label>
            <Input
              defaultValue={kyc?.sport_nationality ?? athlete.sport_nationality ?? ""}
              onBlur={(e) => {
                const v = e.target.value.toUpperCase();
                if (v !== (kyc?.sport_nationality ?? "")) updateKyc({ sport_nationality: v || null }, "nationality");
              }}
              placeholder="ex: LUX"
            />
          </div>
          <div className="space-y-1">
            <Label>Fédération internationale de référence</Label>
            <Input
              defaultValue={kyc?.eligibility_federation ?? ""}
              onBlur={(e) => {
                if (e.target.value !== (kyc?.eligibility_federation ?? ""))
                  updateKyc({ eligibility_federation: e.target.value || null }, "nationality");
              }}
              placeholder="ex: World Athletics, FIFA, FIS…"
            />
          </div>
        </div>
        <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
          <div>
            <Label className="text-sm">Nationalité sportive vérifiée</Label>
            {kyc?.eligibility_verified_at && (
              <p className="text-xs text-muted-foreground">
                Vérifié le {new Date(kyc.eligibility_verified_at).toLocaleDateString("fr-FR")}
              </p>
            )}
          </div>
          <Switch
            checked={!!kyc?.nationality_verified}
            onCheckedChange={(v) =>
              updateKyc(
                {
                  nationality_verified: v,
                  eligibility_verified_at: v ? new Date().toISOString() : null,
                  eligibility_verified_by: v ? currentUserId : null,
                },
                "nationality",
              )
            }
          />
        </div>
      </KycAxis>


      {/* AXE 4 — Antidopage */}
      <KycAxis
        title="Statut antidopage"
        description="Statut AMA/ADAMS — whereabouts, contrôles, suspensions"
        status={
          kyc?.antidoping_status === "green"
            ? "green"
            : kyc?.antidoping_status === "orange"
            ? "orange"
            : "red"
        }
        required
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label>Numéro ADAMS</Label>
            <Input
              defaultValue={kyc?.adams_number ?? athlete.ada_number ?? ""}
              onBlur={(e) => {
                if (e.target.value !== (kyc?.adams_number ?? ""))
                  updateKyc({ adams_number: e.target.value || null }, "antidoping");
              }}
              placeholder="ex: LUX-2024-XXXXX"
            />
          </div>
          <div className="space-y-1">
            <Label>Dernier contrôle antidopage</Label>
            <Input
              type="date"
              value={kyc?.antidoping_last_check ?? ""}
              onChange={(e) =>
                updateKyc({ antidoping_last_check: e.target.value || null }, "antidoping")
              }
            />
          </div>
        </div>
        <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
          <Label>Whereabouts à jour</Label>
          <Switch
            checked={!!kyc?.antidoping_whereabouts_ok}
            onCheckedChange={(v) => updateKyc({ antidoping_whereabouts_ok: v }, "antidoping")}
          />
        </div>
        <div className="space-y-1">
          <Label>Statut antidopage global</Label>
          <Select
            value={kyc?.antidoping_status ?? "orange"}
            onValueChange={(v) =>
              updateKyc(
                { antidoping_status: v as AthleteKyc["antidoping_status"] },
                "antidoping",
              )
            }
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="green">✅ Vert — Aucun problème</SelectItem>
              <SelectItem value="orange">⚠️ Orange — En attente / contrôle manquant</SelectItem>
              <SelectItem value="red">❌ Rouge — Suspendu / violation</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </KycAxis>

      {/* AXE 5 — E-learning */}
      <KycAxis
        title="E-learning antidopage"
        description="Formation en ligne AMA obligatoire"
        status={kyc?.elearning_antidoping_completed ? "green" : "orange"}
      >
        <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
          <div>
            <Label>Formation e-learning complétée</Label>
            {kyc?.elearning_completed_at && (
              <p className="text-xs text-muted-foreground">
                Complétée le {new Date(kyc.elearning_completed_at).toLocaleDateString("fr-FR")}
              </p>
            )}
          </div>
          <Switch
            checked={!!kyc?.elearning_antidoping_completed}
            onCheckedChange={(v) =>
              updateKyc(
                {
                  elearning_antidoping_completed: v,
                  elearning_completed_at: v ? new Date().toISOString().slice(0, 10) : null,
                },
                "elearning",
              )
            }
          />
        </div>
        {kyc?.elearning_antidoping_completed && (
          <div className="space-y-1">
            <Label>Date de complétion</Label>
            <Input
              type="date"
              value={kyc?.elearning_completed_at ?? ""}
              onChange={(e) =>
                updateKyc({ elearning_completed_at: e.target.value || null }, "elearning")
              }
            />
          </div>
        )}
        <div className="space-y-1">
          <Label>Certificat (URL externe ou document)</Label>
          <Input
            placeholder="URL du certificat (plateforme AMA, WADA…)"
            defaultValue={kyc?.elearning_certificate_url ?? ""}
            onBlur={(e) => {
              if (e.target.value !== (kyc?.elearning_certificate_url ?? ""))
                updateKyc({ elearning_certificate_url: e.target.value || null }, "elearning");
            }}
          />
        </div>
      </KycAxis>

      {/* AXE 6 — Charte éthique */}
      <KycAxis
        title="Charte éthique COSL"
        description="Signature obligatoire de la charte éthique du COSL"
        status={kyc?.ethics_charter_signed ? "green" : "orange"}
      >
        <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
          <div>
            <Label>Charte éthique signée</Label>
            {kyc?.ethics_charter_signed_at && (
              <p className="text-xs text-muted-foreground">
                Signée le {new Date(kyc.ethics_charter_signed_at).toLocaleDateString("fr-FR")}
              </p>
            )}
          </div>
          <Switch
            checked={!!kyc?.ethics_charter_signed}
            onCheckedChange={(v) =>
              updateKyc(
                {
                  ethics_charter_signed: v,
                  ethics_charter_signed_at: v ? new Date().toISOString() : null,
                },
                "ethics",
              )
            }
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Document signé (scan / PDF)</Label>
          <Select
            value={kyc?.ethics_charter_doc_id ?? "__none"}
            onValueChange={(v) =>
              updateKyc({ ethics_charter_doc_id: v === "__none" ? null : v }, "ethics")
            }
          >
            <SelectTrigger className="text-sm h-8">
              <SelectValue placeholder="Lier un document uploadé…" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none">— Aucun —</SelectItem>
              {docs
                .filter(
                  (d) =>
                    d.category === "contractual" ||
                    d.doc_type?.toLowerCase().includes("charte"),
                )
                .map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.doc_type} — {d.file_name}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
          {ethicsDoc?.file_url && (
            <a
              href={ethicsDoc.file_url}
              target="_blank"
              rel="noreferrer"
              className="text-xs text-muted-foreground hover:underline"
            >
              📄 Voir le document signé
            </a>
          )}
        </div>
      </KycAxis>

      {/* AXE 7 — Règle 40 */}
      <KycAxis
        title="Engagement Règle 40 CIO"
        description="Restrictions de communication commerciale pendant les Jeux"
        status={kyc?.rule40_signed ? "green" : "orange"}
      >
        <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
          <div>
            <Label>Règle 40 signée</Label>
            {kyc?.rule40_signed_at && (
              <p className="text-xs text-muted-foreground">
                Signée le {new Date(kyc.rule40_signed_at).toLocaleDateString("fr-FR")}
              </p>
            )}
          </div>
          <Switch
            checked={!!kyc?.rule40_signed}
            onCheckedChange={(v) =>
              updateKyc(
                {
                  rule40_signed: v,
                  rule40_signed_at: v ? new Date().toISOString() : null,
                },
                "rule40",
              )
            }
          />
        </div>
        <Select
          value={kyc?.rule40_doc_id ?? "__none"}
          onValueChange={(v) =>
            updateKyc({ rule40_doc_id: v === "__none" ? null : v }, "rule40")
          }
        >
          <SelectTrigger className="text-sm h-8">
            <SelectValue placeholder="Lier le document Règle 40 signé…" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none">— Aucun —</SelectItem>
            {docs
              .filter((d) => d.category === "contractual")
              .map((d) => (
                <SelectItem key={d.id} value={d.id}>
                  {d.doc_type} — {d.file_name}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
        {rule40Doc?.file_url && (
          <a
            href={rule40Doc.file_url}
            target="_blank"
            rel="noreferrer"
            className="text-xs text-muted-foreground hover:underline"
          >
            📄 Voir le document signé
          </a>
        )}
      </KycAxis>

      {/* SECTION I — Historique */}
      <div className="rounded-lg border border-border bg-card p-4 space-y-2">
        <h4 className="text-sm font-semibold text-foreground">Historique des modifications KYC</h4>
        {history.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucun historique.</p>
        ) : (
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {history.map((h) => (
              <div
                key={h.id}
                className="flex items-start gap-3 text-sm border-l-2 border-border pl-3 py-1"
              >
                <div className="flex-1">
                  <span className="font-medium">
                    {h.axis ? KYC_AXE_LABELS[h.axis] ?? h.axis : "—"}
                  </span>{" "}
                  <KycStatusBadge
                    status={h.previous_status as "green" | "orange" | "red" | null}
                    size="sm"
                  />
                  {" → "}
                  <KycStatusBadge
                    status={h.new_status as "green" | "orange" | "red" | null}
                    size="sm"
                  />
                  {h.comment && (
                    <p className="text-xs text-muted-foreground mt-0.5">{h.comment}</p>
                  )}
                </div>
                <div className="text-right text-xs text-muted-foreground shrink-0">
                  <p>{new Date(h.changed_at).toLocaleDateString("fr-FR")}</p>
                  <p>
                    {h.changed_by_profile?.full_name ??
                      h.changed_by_profile?.username ??
                      "—"}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* SECTION J — Commentaire */}
      <div className="rounded-lg border border-border bg-card p-4 space-y-3">
        <h4 className="text-sm font-semibold text-foreground">Notes & validation</h4>
        <div className="space-y-1">
          <Label>Commentaire interne</Label>
          <Textarea
            value={commentDraft}
            onChange={(e) => setCommentDraft(e.target.value)}
            placeholder="Observations, points en suspens, actions à mener…"
            rows={3}
          />
          {commentDraft !== (kyc?.kyc_comment ?? "") && (
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setCommentDraft(kyc?.kyc_comment ?? "")}
              >
                Annuler
              </Button>
              <Button
                type="button"
                size="sm"
                className="bg-primary hover:bg-[var(--cosl-red-dark)]"
                onClick={() =>
                  updateKyc({ kyc_comment: commentDraft.trim() ? commentDraft : null })
                }
              >
                Enregistrer
              </Button>
            </div>
          )}
        </div>
        {kyc?.kyc_reviewed_at && reviewerName && (
          <p className="text-xs text-muted-foreground">
            Dernière révision :{" "}
            {new Date(kyc.kyc_reviewed_at).toLocaleDateString("fr-FR")} par {reviewerName}
          </p>
        )}
      </div>
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
