import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { friendlyError } from "@/lib/error-messages";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  // Shield removed: replaced by EntityImageUpload in header
  Users,
  UserCog,
  UserRound,
  Mail,
  Phone,
  MapPin,
  Building2,
  Plus,
  Pencil,
  Trash2,
  UserMinus,
  Search,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import type {
  Athlete,
  Club,
  ClubMember,
  Coach,
  Federation,
  Sport,
} from "@/lib/types";
import {
  ATHLETE_STATUSES,
  CLUB_MEMBER_ROLES,
  COACH_ROLES,
} from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/DataTableShell";
import { AddressSearch } from "@/components/AddressSearch";
import { PersonCombobox } from "@/components/PersonCombobox";
import { PersonCreateDialog } from "@/components/persons/PersonCreateDialog";
import type { PersonRoleType } from "@/lib/persons";
import { confirmAction } from "@/components/ConfirmDialog";
import { EntityImageUpload } from "@/components/EntityImageUpload";

export const Route = createFileRoute("/_authenticated/clubs/$id")({
  component: ClubDetailPage,
});

type AthleteRow = Athlete & {
  primary_sport?: { name: string } | null;
};

type PersonLite = {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  photo_url: string | null;
};

function statusBadge(s: string) {
  const m = ATHLETE_STATUSES.find((x) => x.value === s);
  return <Badge className={`${m?.cls ?? ""} hover:${m?.cls ?? ""}`}>{m?.label ?? s}</Badge>;
}

function memberRoleLabel(role: string) {
  return CLUB_MEMBER_ROLES.find((r) => r.value === role)?.label ?? role;
}

function StatPill({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number | string;
  sub?: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg bg-muted px-4 py-3">
      <div className="text-primary">
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <p className="text-xl font-bold text-foreground">{value}</p>
        <p className="text-xs text-muted-foreground">
          {label}
          {sub ? ` · ${sub}` : ""}
        </p>
      </div>
    </div>
  );
}

function ageOf(birth: string | null) {
  if (!birth) return null;
  const d = new Date(birth);
  if (isNaN(+d)) return null;
  const ms = Date.now() - d.getTime();
  return Math.floor(ms / (365.25 * 24 * 3600 * 1000));
}

const emptyMember = {
  first_name: "",
  last_name: "",
  role: "president",
  email: "",
  phone: "",
  address: "",
  street: "",
  postcode: "",
  city: "",
  country: "",
  start_date: "",
  end_date: "",
  notes: "",
  is_active: true,
};

const emptyCoach = {
  first_name: "",
  last_name: "",
  email: "",
  phone: "",
  role: "coach",
  is_active: true,
};

function ClubDetailPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const [club, setClub] = useState<Club | null>(null);
  const [fed, setFed] = useState<Federation | null>(null);
  const [coaches, setCoaches] = useState<Coach[]>([]);
  const [athletes, setAthletes] = useState<AthleteRow[]>([]);
  const [members, setMembers] = useState<ClubMember[]>([]);
  const [sports, setSports] = useState<Sport[]>([]);
  const [loading, setLoading] = useState(true);

  // Persons referential (shared by all 3 add dialogs)
  const [personsPool, setPersonsPool] = useState<PersonLite[]>([]);

  // Add athlete dialog
  const [athleteOpen, setAthleteOpen] = useState(false);
  const [athletesActive, setAthletesActive] = useState<"active" | "inactive" | "all">("active");
  const [athleteSearch, setAthleteSearch] = useState("");
  const [memberSearch, setMemberSearch] = useState("");
  const [coachSearch, setCoachSearch] = useState("");
  const [selectedAthleteId, setSelectedAthleteId] = useState("");
  const [athleteSaving, setAthleteSaving] = useState(false);

  // PersonCreateDialog (new person flow)
  const [personCreateOpen, setPersonCreateOpen] = useState(false);
  const [personCreateRoles, setPersonCreateRoles] = useState<PersonRoleType[]>([]);

  // Member dialog
  const [memberOpen, setMemberOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<ClubMember | null>(null);
  const [memberForm, setMemberForm] = useState(emptyMember);
  const [memberSaving, setMemberSaving] = useState(false);
  const [selectedMemberPersonId, setSelectedMemberPersonId] = useState("");

  // Coach dialog
  const [coachOpen, setCoachOpen] = useState(false);
  const [coachForm, setCoachForm] = useState(emptyCoach);
  const [coachSaving, setCoachSaving] = useState(false);
  const [pickedCoachId, setPickedCoachId] = useState("");
  const [freeCoaches, setFreeCoaches] = useState<Coach[]>([]);
  const [selectedCoachPersonId, setSelectedCoachPersonId] = useState("");


  const load = async () => {
    setLoading(true);
    const cl = await supabase.from("clubs").select("*").eq("id", id).maybeSingle();
    if (cl.error) toast.error("Erreur de chargement", { description: cl.error.message });
    const c = (cl.data ?? null) as Club | null;
    setClub(c);
    const [f, co, a, sp, m] = await Promise.all([
      c
        ? supabase.from("federations").select("*").eq("id", c.federation_id).maybeSingle()
        : Promise.resolve({ data: null }),
      supabase.from("coaches").select("*").eq("club_id", id).order("last_name"),
      supabase
        .from("athletes")
        .select("*, primary_sport:sports!athletes_primary_sport_id_fkey(name)")
        .eq("current_club_id", id)
        .order("last_name"),
      supabase.from("sports").select("*").order("name"),
      supabase
        .from("club_members")
        .select("*")
        .eq("club_id", id)
        .order("created_at", { ascending: false }),
    ]);
    setFed(((f as { data: Federation | null }).data ?? null) as Federation | null);
    setCoaches((co.data ?? []) as Coach[]);
    setAthletes((a.data ?? []) as AthleteRow[]);
    setSports((sp.data ?? []) as Sport[]);
    setMembers((m.data ?? []) as ClubMember[]);

    const { data: freeC } = await supabase
      .from("coaches")
      .select("*")
      .is("club_id", null)
      .order("last_name");
    setFreeCoaches((freeC ?? []) as Coach[]);

    const { data: personsData } = await supabase
      .from("persons")
      .select("id, first_name, last_name, email, photo_url")
      .eq("is_active", true)
      .order("last_name");
    setPersonsPool((personsData ?? []) as PersonLite[]);

    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const stats = useMemo(() => {
    const active = athletes.filter((a) => a.status === "active").length;
    const male = athletes.filter((a) => a.gender === "male").length;
    const female = athletes.filter((a) => a.gender === "female").length;
    const ages = athletes.map((a) => ageOf(a.birth_date)).filter((n): n is number => n != null);
    const avgAge = ages.length ? Math.round(ages.reduce((s, n) => s + n, 0) / ages.length) : null;
    const sportCounts = new Map<string, number>();
    athletes.forEach((a) => {
      const n = a.primary_sport?.name ?? "—";
      sportCounts.set(n, (sportCounts.get(n) ?? 0) + 1);
    });
    return {
      athletes: athletes.length,
      coaches: coaches.length,
      members: members.length,
      active,
      male,
      female,
      avgAge,
      sportCounts: Array.from(sportCounts.entries()).sort((a, b) => b[1] - a[1]),
    };
  }, [athletes, coaches, members]);

  // ---------- Athlete CRUD ----------
  const openAddAthlete = () => {
    setSelectedAthleteId("");
    setAthleteOpen(true);
  };

  const submitAddAthlete = async () => {
    if (!selectedAthleteId) {
      toast.error("Sélectionnez une personne");
      return;
    }
    if (selectedAthleteId === "__new__") {
      setAthleteOpen(false);
      setPersonCreateRoles(["athlete"]);
      setPersonCreateOpen(true);
      return;
    }
    setAthleteSaving(true);
    const { data: ap, error: ape } = await supabase
      .from("athlete_profiles")
      .select("legacy_athlete_id")
      .eq("person_id", selectedAthleteId)
      .maybeSingle();
    if (ape) {
      setAthleteSaving(false);
      toast.error("Erreur", { description: friendlyError(ape) });
      return;
    }
    if (ap?.legacy_athlete_id) {
      const { error } = await supabase
        .from("athletes")
        .update({ current_club_id: id })
        .eq("id", ap.legacy_athlete_id);
      setAthleteSaving(false);
      if (error) {
        toast.error("Échec", { description: friendlyError(error) });
        return;
      }
      toast.success("Athlète rattaché à ce club");
      setAthleteOpen(false);
      load();
      return;
    }
    setAthleteSaving(false);
    setAthleteOpen(false);
    toast.info("Ajoute le rôle Athlète depuis la fiche de la personne");
    navigate({ to: "/persons/$personId", params: { personId: selectedAthleteId } });
  };



  const removeAthlete = async (a: AthleteRow) => {
    const ok = await confirmAction({
      title: `Retirer ${a.first_name} ${a.last_name} ?`,
      description: "L'adhérent ne sera plus rattaché à ce club.",
      confirmLabel: "Retirer",
      destructive: true,
    });
    if (!ok) return;
    const { error } = await supabase
      .from("athletes")
      .update({ current_club_id: null })
      .eq("id", a.id);
    if (error) {
      toast.error("Suppression impossible", { description: friendlyError(error) });
    } else {
      toast.success("Adhérent retiré");
      load();
    }
  };

  // ---------- Member CRUD ----------
  const openCreateMember = () => {
    setEditingMember(null);
    setMemberForm(emptyMember);
    setMemberOpen(true);
  };
  const openEditMember = (m: ClubMember) => {
    setEditingMember(m);
    setMemberForm({
      first_name: m.first_name,
      last_name: m.last_name,
      role: m.role,
      email: m.email ?? "",
      phone: m.phone ?? "",
      address: m.address ?? "",
      street: m.street ?? "",
      postcode: m.postcode ?? "",
      city: m.city ?? "",
      country: m.country ?? "",
      start_date: m.start_date ?? "",
      end_date: m.end_date ?? "",
      notes: m.notes ?? "",
      is_active: m.is_active ?? true,
    });
    setMemberOpen(true);
  };
  const submitMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!memberForm.first_name.trim() || !memberForm.last_name.trim()) {
      toast.error("Prénom et nom requis");
      return;
    }
    setMemberSaving(true);
    const payload = {
      club_id: id,
      first_name: memberForm.first_name.trim(),
      last_name: memberForm.last_name.trim(),
      role: memberForm.role,
      email: memberForm.email.trim() || null,
      phone: memberForm.phone.trim() || null,
      address: memberForm.address.trim() || null,
      street: memberForm.street.trim() || null,
      postcode: memberForm.postcode.trim() || null,
      city: memberForm.city.trim() || null,
      country: memberForm.country.trim() || null,
      start_date: memberForm.start_date || null,
      end_date: memberForm.end_date || null,
      notes: memberForm.notes.trim() || null,
      is_active: memberForm.is_active,
    };

    if (editingMember) {
      const { error } = await supabase
        .from("club_members")
        .update(payload)
        .eq("id", editingMember.id);
      setMemberSaving(false);
      if (error) {
        toast.error("Échec de l'enregistrement", { description: friendlyError(error) });
        return;
      }
      toast.success("Membre modifié");
      setMemberOpen(false);
      load();
      return;
    }

    // Create branch: optional person dual-write
    const payloadWithPerson = selectedMemberPersonId
      ? { ...payload, person_id: selectedMemberPersonId }
      : payload;
    const { data: legCm, error } = await supabase
      .from("club_members")
      .insert(payloadWithPerson)
      .select("id")
      .single();
    if (error || !legCm) {
      setMemberSaving(false);
      toast.error("Échec de l'enregistrement", { description: friendlyError(error) });
      return;
    }

    if (selectedMemberPersonId) {
      await supabase.from("club_member_profiles").insert({
        person_id: selectedMemberPersonId,
        club_id: id,
        role: memberForm.role,
        start_date: memberForm.start_date || null,
        is_active: memberForm.is_active,
        legacy_club_member_id: legCm.id,
      });
      await supabase
        .from("person_roles")
        .upsert(
          { person_id: selectedMemberPersonId, role_type: "club_member" },
          { onConflict: "person_id,role_type", ignoreDuplicates: true },
        );
    }

    setMemberSaving(false);
    toast.success("Membre ajouté");
    setMemberOpen(false);
    setSelectedMemberPersonId("");
    load();
  };


  const removeMember = async (m: ClubMember) => {
    const ok = await confirmAction({
      title: `Supprimer ${m.first_name} ${m.last_name} ?`,
      description: "Ce membre sera retiré du club.",
      confirmLabel: "Supprimer",
      destructive: true,
    });
    if (!ok) return;
    const { error } = await supabase.from("club_members").delete().eq("id", m.id);
    if (error) toast.error("Suppression impossible", { description: friendlyError(error) });
    else {
      toast.success("Membre supprimé");
      load();
    }
  };

  // ---------- Coach CRUD ----------
  const openCreateCoach = () => {
    setPickedCoachId("");
    setCoachForm(emptyCoach);
    setCoachOpen(true);
  };
  const submitCoach = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!coachForm.first_name.trim() || !coachForm.last_name.trim()) {
      toast.error("Prénom et nom requis");
      return;
    }
    setCoachSaving(true);
    const payload = {
      club_id: id,
      federation_id: club?.federation_id ?? null,
      first_name: coachForm.first_name.trim(),
      last_name: coachForm.last_name.trim(),
      email: coachForm.email.trim() || null,
      phone: coachForm.phone.trim() || null,
      role: coachForm.role,
      is_active: coachForm.is_active,
    };

    if (pickedCoachId) {
      const { error } = await supabase
        .from("coaches")
        .update(payload)
        .eq("id", pickedCoachId);
      setCoachSaving(false);
      if (error) {
        toast.error("Échec de l'enregistrement", { description: friendlyError(error) });
        return;
      }
      toast.success("Encadrant rattaché");
      setCoachOpen(false);
      setPickedCoachId("");
      load();
      return;
    }

    // New coach (optionally linked to a person)
    const payloadWithPerson = selectedCoachPersonId
      ? { ...payload, person_id: selectedCoachPersonId }
      : payload;
    const { data: legCoach, error } = await supabase
      .from("coaches")
      .insert(payloadWithPerson)
      .select("id")
      .single();
    if (error || !legCoach) {
      setCoachSaving(false);
      toast.error("Échec de l'enregistrement", { description: friendlyError(error) });
      return;
    }

    if (selectedCoachPersonId) {
      await supabase.from("coach_profiles").insert({
        person_id: selectedCoachPersonId,
        legacy_coach_id: legCoach.id,
        role: coachForm.role,
        federation_id: club?.federation_id ?? null,
        club_id: id,
        is_active: coachForm.is_active,
      });
      await supabase
        .from("person_roles")
        .upsert(
          { person_id: selectedCoachPersonId, role_type: "coach" },
          { onConflict: "person_id,role_type", ignoreDuplicates: true },
        );
    }

    setCoachSaving(false);
    toast.success("Encadrant ajouté");
    setCoachOpen(false);
    setPickedCoachId("");
    setSelectedCoachPersonId("");
    load();
  };



  if (loading) return <div className="p-6 text-muted-foreground">Chargement…</div>;
  if (!club) {
    return (
      <div className="space-y-4">
        <Button asChild variant="ghost" size="sm">
          <Link to="/clubs">
            <ArrowLeft className="mr-2 h-4 w-4" /> Retour
          </Link>
        </Button>
        <EmptyState message="Club introuvable." />
      </div>
    );
  }

  const president =
    members.find((m) => m.role === "president" && (m.is_active ?? true)) ?? null;

  const athletePoolOptions = [
    { id: "__new__", label: "+ Créer une nouvelle personne" },
    ...personsPool.map((p) => ({
      id: p.id,
      label: `${p.first_name} ${p.last_name}${p.email ? ` — ${p.email}` : ""}`,
    })),
  ];

  const personPickOptions = [
    { id: "__none__", label: "Aucune (créer sans personne liée)" },
    { id: "__new__", label: "+ Créer une nouvelle personne" },
    ...personsPool.map((p) => ({
      id: p.id,
      label: `${p.first_name} ${p.last_name}${p.email ? ` — ${p.email}` : ""}`,
    })),
  ];

  return (
    <div className="space-y-6">
      <div>
        <Button asChild variant="ghost" size="sm" className="-ml-2 mb-2">
          <Link to="/clubs">
            <ArrowLeft className="mr-2 h-4 w-4" /> Clubs
          </Link>
        </Button>
      </div>

      <div className="rounded-xl border border-border bg-card p-6">
        <div className="flex flex-wrap items-start gap-5">
          <EntityImageUpload
            entityId={club.id}
            entityType="club"
            currentImageUrl={club.logo_url}
            currentStoragePath={club.logo_storage_path}
            shape="square"
            size="lg"
            placeholder={club.name?.slice(0, 2).toUpperCase()}
            onUploaded={async (url, path) => {
              await supabase
                .from("clubs")
                .update({ logo_url: url, logo_storage_path: path })
                .eq("id", id);
              setClub((c) => (c ? { ...c, logo_url: url, logo_storage_path: path } : c));
            }}
            onDeleted={async () => {
              await supabase
                .from("clubs")
                .update({ logo_url: null, logo_storage_path: null })
                .eq("id", id);
              setClub((c) => (c ? { ...c, logo_url: null, logo_storage_path: null } : c));
            }}
          />

          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              {fed && (
                <Link to="/federations/$id" params={{ id: fed.id }}>
                  <Badge variant="outline" className="font-mono hover:bg-muted">
                    <Building2 className="mr-1 h-3 w-3" />
                    {fed.acronym}
                  </Badge>
                </Link>
              )}
              {club.city && (
                <Badge variant="outline" className="font-normal">
                  <MapPin className="mr-1 h-3 w-3" />
                  {club.city}
                </Badge>
              )}
            </div>
            <h1 className="text-2xl font-bold text-foreground">{club.name}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
              {president && (
                <span className="flex items-center gap-1">
                  <UserRound className="h-3.5 w-3.5" />
                  Président :{" "}
                  <span className="text-foreground font-medium ml-1">
                    {president.first_name} {president.last_name}
                  </span>
                </span>
              )}
              {club.email && (
                <a
                  href={`mailto:${club.email}`}
                  className="flex items-center gap-1 text-[var(--lux-blue)] hover:underline"
                >
                  <Mail className="h-3.5 w-3.5" /> {club.email}
                </a>
              )}
              {club.phone && (
                <span className="flex items-center gap-1">
                  <Phone className="h-3.5 w-3.5" /> {club.phone}
                </span>
              )}
              {club.address && (
                <span className="flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" /> {club.city ?? club.address}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="mt-5 pt-5 border-t border-slate-100 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatPill
            icon={Users}
            label="Adhérents"
            value={stats.athletes}
            sub={`${stats.active} actifs`}
          />
          <StatPill icon={UserCog} label="Encadrement" value={stats.coaches} />
          <StatPill icon={UserRound} label="Membres bureau" value={stats.members} />
          <StatPill
            icon={Users}
            label="Mixité"
            value={`${stats.male}H / ${stats.female}F`}
            sub={stats.avgAge ? `Moy. ${stats.avgAge} ans` : undefined}
          />
        </div>

        {stats.sportCounts.length > 0 && (
          <div className="mt-4 pt-4 border-t border-slate-100">
            <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2">
              Sports pratiqués
            </p>
            <div className="flex flex-wrap gap-2">
              {stats.sportCounts.slice(0, 8).map(([name, n]) => (
                <span
                  key={name}
                  className="inline-flex items-center gap-1 rounded-full bg-muted px-3 py-1 text-xs text-foreground"
                >
                  {name}{" "}
                  <span className="font-semibold text-foreground">{n}</span>
                </span>
              ))}
            </div>
          </div>
        )}
      </div>


      <Tabs defaultValue="athletes">
        <TabsList>
          <TabsTrigger value="athletes">Adhérents ({athletes.length})</TabsTrigger>
          <TabsTrigger value="members">Membres ({members.length})</TabsTrigger>
          <TabsTrigger value="coaches">Encadrement ({coaches.length})</TabsTrigger>
        </TabsList>

        {/* ============ ATHLETES ============ */}
        <TabsContent value="athletes" className="mt-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-1 flex-wrap items-center gap-2">
              <div className="relative min-w-[220px] flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Nom, prénom, COSL ID, sport…"
                  value={athleteSearch}
                  onChange={(e) => setAthleteSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select
                value={athletesActive}
                onValueChange={(v) => setAthletesActive(v as "active" | "inactive" | "all")}
              >
                <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Actifs</SelectItem>
                  <SelectItem value="inactive">Inactifs</SelectItem>
                  <SelectItem value="all">Tous</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={openAddAthlete} className="bg-primary hover:bg-[var(--cosl-red-dark)]">
              <Plus className="mr-2 h-4 w-4" /> Ajouter un adhérent
            </Button>
          </div>
          {(() => {
            const q = athleteSearch.trim().toLowerCase();
            const visibleAthletes = athletes.filter((a) => {
              if (athletesActive === "active" && a.is_active === false) return false;
              if (athletesActive === "inactive" && a.is_active !== false) return false;
              if (q) {
                const hay = `${a.first_name} ${a.last_name} ${a.cosl_id ?? ""} ${a.primary_sport?.name ?? ""}`.toLowerCase();
                if (!hay.includes(q)) return false;
              }
              return true;
            });
            return (
          <div className="rounded-lg border border-border bg-card">
            {visibleAthletes.length === 0 ? (
              <div className="p-6">
                <EmptyState message="Aucun adhérent." />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nom</TableHead>
                    <TableHead>Sport</TableHead>
                    <TableHead>Âge</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead>COSL ID</TableHead>
                    <TableHead className="w-16 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visibleAthletes.map((a) => (
                    <TableRow
                      key={a.id}
                      onClick={() => navigate({ to: "/athletes/$id", params: { id: a.id } })}
                      className={`cursor-pointer hover:bg-muted ${a.is_active === false ? "opacity-60" : ""}`}
                    >
                      <TableCell className="font-medium">
                        {a.first_name} {a.last_name}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {a.primary_sport?.name ?? "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {ageOf(a.birth_date) ?? "—"}
                      </TableCell>
                      <TableCell>
                        {statusBadge(a.status)}
                        {a.is_active === false && (
                          <Badge variant="outline" className="ml-2 border-border text-muted-foreground">
                            Inactif
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {a.cosl_id || "—"}
                      </TableCell>
                      <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeAthlete(a)}
                          aria-label="Retirer du club"
                        >
                          <UserMinus className="h-4 w-4 text-red-600" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
            );
          })()}
        </TabsContent>

        {/* ============ MEMBERS ============ */}
        <TabsContent value="members" className="mt-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="relative min-w-[220px] flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Nom, prénom, email, fonction…"
                value={memberSearch}
                onChange={(e) => setMemberSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Button onClick={openCreateMember} className="bg-primary hover:bg-[var(--cosl-red-dark)]">
              <Plus className="mr-2 h-4 w-4" /> Ajouter un membre
            </Button>
          </div>
          {(() => {
            const q = memberSearch.trim().toLowerCase();
            const visibleMembers = members.filter((m) => {
              if (!q) return true;
              const hay = `${m.first_name} ${m.last_name} ${m.email ?? ""} ${memberRoleLabel(m.role)}`.toLowerCase();
              return hay.includes(q);
            });
            return (
          <div className="rounded-lg border border-border bg-card">
            {visibleMembers.length === 0 ? (
              <div className="p-6">
                <EmptyState message="Aucun membre enregistré (président, trésorier…)." />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-14"></TableHead>
                    <TableHead>Nom</TableHead>
                    <TableHead>Fonction</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Téléphone</TableHead>
                    <TableHead>Mandat</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead className="w-24 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visibleMembers.map((m) => (
                    <TableRow
                      key={m.id}
                      onClick={() => navigate({ to: "/clubs/members/$memberId", params: { memberId: m.id } })}
                      className="cursor-pointer hover:bg-muted"
                    >
                      <TableCell>
                        <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border border-border bg-muted">
                          {m.photo_url ? (
                            <img src={m.photo_url} alt={`${m.first_name} ${m.last_name}`} className="h-full w-full object-cover" />
                          ) : (
                            <span className="text-xs font-semibold text-muted-foreground">
                              {(m.first_name[0] ?? "") + (m.last_name[0] ?? "")}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">
                        {m.first_name} {m.last_name}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{memberRoleLabel(m.role)}</Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground" onClick={(e) => e.stopPropagation()}>
                        {m.email ? (
                          <a
                            href={`mailto:${m.email}`}
                            className="text-[var(--lux-blue)] hover:underline"
                          >
                            {m.email}
                          </a>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{m.phone ?? "—"}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {m.start_date ?? "—"}
                        {m.end_date ? ` → ${m.end_date}` : ""}
                      </TableCell>
                      <TableCell>
                        {(m.is_active ?? true) ? (
                          <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
                            Actif
                          </Badge>
                        ) : (
                          <Badge variant="outline">Inactif</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEditMember(m)}
                          aria-label="Modifier"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeMember(m)}
                          aria-label="Supprimer"
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
            );
          })()}
        </TabsContent>

        {/* ============ COACHES ============ */}
        <TabsContent value="coaches" className="mt-4 space-y-3">
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Nom, prénom, email, rôle…"
                value={coachSearch}
                onChange={(e) => setCoachSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Button onClick={openCreateCoach} className="bg-primary hover:bg-[var(--cosl-red-dark)]">
              <Plus className="mr-2 h-4 w-4" /> Ajouter un encadrant
            </Button>
          </div>
          {(() => {
            const q = coachSearch.trim().toLowerCase();
            const visibleCoaches = coaches.filter((c) => {
              if (!q) return true;
              const role = COACH_ROLES.find((r) => r.value === c.role)?.label ?? c.role;
              const hay = `${c.first_name} ${c.last_name} ${c.email ?? ""} ${role}`.toLowerCase();
              return hay.includes(q);
            });
            return (
          <div className="rounded-lg border border-border bg-card">
            {visibleCoaches.length === 0 ? (
              <div className="p-6">
                <EmptyState message="Aucun encadrant rattaché." />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-14"></TableHead>
                    <TableHead>Nom</TableHead>
                    <TableHead>Rôle</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Téléphone</TableHead>
                    <TableHead>Statut</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visibleCoaches.map((c) => {
                    const role = COACH_ROLES.find((r) => r.value === c.role)?.label ?? c.role;
                    return (
                      <TableRow
                        key={c.id}
                        onClick={() => navigate({ to: "/coaches/$id", params: { id: c.id } })}
                        className={`cursor-pointer hover:bg-muted ${c.is_active ? "" : "opacity-60"}`}
                      >
                        <TableCell>
                          <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border border-border bg-muted">
                            {c.photo_url ? (
                              <img src={c.photo_url} alt="" className="h-full w-full object-cover" />
                            ) : (
                              <span className="text-xs font-semibold text-muted-foreground">
                                {(c.first_name[0] ?? "") + (c.last_name[0] ?? "")}
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="font-medium">
                          {c.first_name} {c.last_name}
                        </TableCell>
                        <TableCell className="text-muted-foreground">{role}</TableCell>
                        <TableCell className="text-muted-foreground">{c.email ?? "—"}</TableCell>
                        <TableCell className="text-muted-foreground">{c.phone ?? "—"}</TableCell>
                        <TableCell>
                          {c.is_active ? (
                            <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
                              Actif
                            </Badge>
                          ) : (
                            <Badge variant="outline">Inactif</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </div>
            );
          })()}
        </TabsContent>
      </Tabs>

      {/* ============ Add athlete dialog ============ */}
      <Dialog open={athleteOpen} onOpenChange={setAthleteOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Ajouter un adhérent</DialogTitle>
            <DialogDescription>
              Rattacher un athlète existant ou en créer un nouveau pour le club {club.name}.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-1.5">
              <Label>Athlète</Label>
              <PersonCombobox
                value={selectedAthleteId}
                onChange={setSelectedAthleteId}
                options={athletePoolOptions}
                placeholder="Choisir un athlète ou en créer un…"
                searchPlaceholder="Rechercher par nom ou COSL ID…"
                emptyMessage="Aucun athlète disponible."
              />
              <p className="text-xs text-muted-foreground">
                Sélectionnez un athlète existant ou « + Créer un nouvel adhérent ».
              </p>
            </div>

            {selectedAthleteId === "__new__" && (
              <p className="rounded-md border border-dashed border-border bg-muted p-3 text-xs text-muted-foreground">
                Vous allez ouvrir le formulaire complet de création de personne avec le rôle <strong>Athlète</strong> pré-coché.
              </p>
            )}

          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setAthleteOpen(false)}
              disabled={athleteSaving}
            >
              Annuler
            </Button>
            <Button
              type="button"
              onClick={submitAddAthlete}
              disabled={athleteSaving || !selectedAthleteId}
              className="bg-primary hover:bg-[var(--cosl-red-dark)]"
            >
              {athleteSaving ? "Ajout…" : selectedAthleteId === "__new__" ? "Créer et ajouter" : "Ajouter"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>


      {/* ============ Member dialog ============ */}
      <Dialog
        open={memberOpen}
        onOpenChange={(v) => {
          setMemberOpen(v);
          if (!v) setSelectedMemberPersonId("");
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <form onSubmit={submitMember}>
            <DialogHeader>
              <DialogTitle>
                {editingMember ? "Modifier le membre" : "Ajouter un membre"}
              </DialogTitle>
              <DialogDescription>
                Membre du bureau du club {club.name}.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              {!editingMember && (
                <div className="space-y-1.5 rounded-md border border-dashed border-border bg-muted p-3">
                  <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                    Lier à une personne existante (optionnel)
                  </Label>
                  <PersonCombobox
                    value={selectedMemberPersonId || "__none__"}
                    onChange={(v) => {
                      if (v === "__none__") {
                        setSelectedMemberPersonId("");
                        return;
                      }
                      if (v === "__new__") {
                        setMemberOpen(false);
                        setSelectedMemberPersonId("");
                        setPersonCreateRoles(["club_member"]);
                        setPersonCreateOpen(true);
                        return;
                      }
                      setSelectedMemberPersonId(v);
                      const p = personsPool.find((x) => x.id === v);
                      if (!p) return;
                      setMemberForm((f) => ({
                        ...f,
                        first_name: p.first_name,
                        last_name: p.last_name,
                        email: p.email ?? f.email,
                      }));
                    }}
                    options={personPickOptions}
                    placeholder="Aucune (créer sans personne liée)"
                    searchPlaceholder="Rechercher une personne…"
                  />
                </div>
              )}

              {editingMember && (
                <div className="flex justify-center pb-2">
                  <EntityImageUpload
                    entityId={editingMember.id}
                    entityType="club_member"
                    currentImageUrl={editingMember.photo_url}
                    currentStoragePath={editingMember.photo_storage_path}
                    shape="circle"
                    size="lg"
                    label="Photo"
                    placeholder={(editingMember.first_name[0] ?? "") + (editingMember.last_name[0] ?? "")}
                    onUploaded={async (url, path) => {
                      await supabase
                        .from("club_members")
                        .update({ photo_url: url, photo_storage_path: path })
                        .eq("id", editingMember.id);
                      setEditingMember((m) => (m ? { ...m, photo_url: url, photo_storage_path: path } : m));
                      load();
                    }}
                    onDeleted={async () => {
                      await supabase
                        .from("club_members")
                        .update({ photo_url: null, photo_storage_path: null })
                        .eq("id", editingMember.id);
                      setEditingMember((m) => (m ? { ...m, photo_url: null, photo_storage_path: null } : m));
                      load();
                    }}
                  />
                </div>
              )}


              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="cmfname">Prénom *</Label>
                  <Input
                    id="cmfname"
                    value={memberForm.first_name}
                    onChange={(e) =>
                      setMemberForm({ ...memberForm, first_name: e.target.value })
                    }
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="cmlname">Nom *</Label>
                  <Input
                    id="cmlname"
                    value={memberForm.last_name}
                    onChange={(e) =>
                      setMemberForm({ ...memberForm, last_name: e.target.value })
                    }
                    required
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cmrole">Fonction *</Label>
                <Select
                  value={memberForm.role}
                  onValueChange={(v) => setMemberForm({ ...memberForm, role: v })}
                >
                  <SelectTrigger id="cmrole">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CLUB_MEMBER_ROLES.map((r) => (
                      <SelectItem key={r.value} value={r.value}>
                        {r.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="cmemail">Email</Label>
                  <Input
                    id="cmemail"
                    type="email"
                    value={memberForm.email}
                    onChange={(e) =>
                      setMemberForm({ ...memberForm, email: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="cmphone">Téléphone</Label>
                  <Input
                    id="cmphone"
                    value={memberForm.phone}
                    onChange={(e) =>
                      setMemberForm({ ...memberForm, phone: e.target.value })
                    }
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cmaddr">Adresse (numéro + rue)</Label>
                <AddressSearch
                  id="cmaddr"
                  value={memberForm.street}
                  onChange={(v) => setMemberForm({ ...memberForm, street: v })}
                  onSelect={(r) =>
                    setMemberForm((f) => ({
                      ...f,
                      street: r.street || f.street,
                      postcode: r.postcode || f.postcode,
                      city: r.city || f.city,
                      country: r.country || f.country,
                    }))
                  }
                  placeholder="Rue, ville, pays…"
                />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="cmpostcode">Code postal</Label>
                  <Input id="cmpostcode" value={memberForm.postcode} onChange={(e) => setMemberForm({ ...memberForm, postcode: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="cmcity">Ville</Label>
                  <Input id="cmcity" value={memberForm.city} onChange={(e) => setMemberForm({ ...memberForm, city: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="cmcountry">Pays</Label>
                  <Input id="cmcountry" value={memberForm.country} onChange={(e) => setMemberForm({ ...memberForm, country: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="cmstart">Début de mandat</Label>
                  <Input
                    id="cmstart"
                    type="date"
                    value={memberForm.start_date}
                    onChange={(e) =>
                      setMemberForm({ ...memberForm, start_date: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="cmend">Fin de mandat</Label>
                  <Input
                    id="cmend"
                    type="date"
                    value={memberForm.end_date}
                    onChange={(e) =>
                      setMemberForm({ ...memberForm, end_date: e.target.value })
                    }
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cmnotes">Notes</Label>
                <Textarea
                  id="cmnotes"
                  rows={3}
                  value={memberForm.notes}
                  onChange={(e) =>
                    setMemberForm({ ...memberForm, notes: e.target.value })
                  }
                />
              </div>
              <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
                <Label htmlFor="cmactive" className="cursor-pointer">
                  Membre actif
                </Label>
                <Switch
                  id="cmactive"
                  checked={memberForm.is_active}
                  onCheckedChange={(v) =>
                    setMemberForm({ ...memberForm, is_active: v })
                  }
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setMemberOpen(false)}
                disabled={memberSaving}
              >
                Annuler
              </Button>
              <Button
                type="submit"
                disabled={memberSaving}
                className="bg-primary hover:bg-[var(--cosl-red-dark)]"
              >
                {memberSaving
                  ? "Enregistrement…"
                  : editingMember
                  ? "Enregistrer"
                  : "Ajouter"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ============ Coach dialog ============ */}
      <Dialog
        open={coachOpen}
        onOpenChange={(v) => {
          setCoachOpen(v);
          if (!v) setSelectedCoachPersonId("");
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <form onSubmit={submitCoach}>
            <DialogHeader>
              <DialogTitle>Ajouter un encadrant</DialogTitle>
              <DialogDescription>
                Rattacher un encadrant existant ou en créer un nouveau pour le club {club.name}.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              {!pickedCoachId && (
                <div className="space-y-1.5 rounded-md border border-dashed border-border bg-muted p-3">
                  <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                    Lier à une personne existante (optionnel)
                  </Label>
                  <PersonCombobox
                    value={selectedCoachPersonId || "__none__"}
                    onChange={(v) => {
                      if (v === "__none__") {
                        setSelectedCoachPersonId("");
                        return;
                      }
                      if (v === "__new__") {
                        setCoachOpen(false);
                        setSelectedCoachPersonId("");
                        setPersonCreateRoles(["coach"]);
                        setPersonCreateOpen(true);
                        return;
                      }
                      setSelectedCoachPersonId(v);
                      setPickedCoachId("");
                      const p = personsPool.find((x) => x.id === v);
                      if (!p) return;
                      setCoachForm((f) => ({
                        ...f,
                        first_name: p.first_name,
                        last_name: p.last_name,
                        email: p.email ?? f.email,
                      }));
                    }}
                    options={personPickOptions}
                    placeholder="Aucune (créer sans personne liée)"
                    searchPlaceholder="Rechercher une personne…"
                  />
                  {selectedCoachPersonId && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedCoachPersonId("");
                        setCoachForm(emptyCoach);
                      }}
                      className="text-xs text-muted-foreground hover:text-foreground underline"
                    >
                      Détacher
                    </button>
                  )}
                </div>
              )}

              {!selectedCoachPersonId && (
                <div className="space-y-1.5 rounded-md border border-dashed border-border bg-muted p-3">
                  <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                    Choisir un encadrant existant ou créer un nouveau
                  </Label>
                  <Select
                    value={pickedCoachId || "__new__"}
                    onValueChange={(v) => {
                      if (v === "__new__") {
                        setPickedCoachId("");
                        setCoachForm(emptyCoach);
                        return;
                      }
                      setPickedCoachId(v);
                      const c = freeCoaches.find((x) => x.id === v);
                      if (!c) return;
                      setCoachForm({
                        first_name: c.first_name,
                        last_name: c.last_name,
                        email: c.email ?? "",
                        phone: c.phone ?? "",
                        role: c.role ?? "coach",
                        is_active: c.is_active ?? true,
                      });
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Nouvel encadrant" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__new__" className="text-primary font-medium">
                        + Créer une nouvelle personne
                      </SelectItem>
                      {freeCoaches.length > 0 && (
                        <>
                          <SelectSeparator />
                          {freeCoaches.map((c) => (
                            <SelectItem key={c.id} value={c.id}>
                              {c.first_name} {c.last_name}
                              {c.email ? ` — ${c.email}` : ""}
                            </SelectItem>
                          ))}
                        </>
                      )}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Seuls les encadrants sans club sont listés.
                  </p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="ccfn">Prénom *</Label>
                  <Input
                    id="ccfn"
                    value={coachForm.first_name}
                    onChange={(e) => setCoachForm({ ...coachForm, first_name: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ccln">Nom *</Label>
                  <Input
                    id="ccln"
                    value={coachForm.last_name}
                    onChange={(e) => setCoachForm({ ...coachForm, last_name: e.target.value })}
                    required
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="ccem">Email</Label>
                  <Input
                    id="ccem"
                    type="email"
                    value={coachForm.email}
                    onChange={(e) => setCoachForm({ ...coachForm, email: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ccph">Téléphone</Label>
                  <Input
                    id="ccph"
                    value={coachForm.phone}
                    onChange={(e) => setCoachForm({ ...coachForm, phone: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ccrl">Rôle *</Label>
                <Select
                  value={coachForm.role}
                  onValueChange={(v) => setCoachForm({ ...coachForm, role: v })}
                >
                  <SelectTrigger id="ccrl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {COACH_ROLES.map((r) => (
                      <SelectItem key={r.value} value={r.value}>
                        {r.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
                <Label htmlFor="ccact" className="cursor-pointer">
                  Encadrant actif
                </Label>
                <Switch
                  id="ccact"
                  checked={coachForm.is_active}
                  onCheckedChange={(v) => setCoachForm({ ...coachForm, is_active: v })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setCoachOpen(false)}
                disabled={coachSaving}
              >
                Annuler
              </Button>
              <Button
                type="submit"
                disabled={coachSaving}
                className="bg-primary hover:bg-[var(--cosl-red-dark)]"
              >
                {coachSaving ? "Enregistrement…" : pickedCoachId ? "Rattacher" : "Ajouter"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <PersonCreateDialog
        open={personCreateOpen}
        onOpenChange={setPersonCreateOpen}
        initialRoles={personCreateRoles}
        onCreated={() => {
          load();
        }}
      />
    </div>
  );
}

