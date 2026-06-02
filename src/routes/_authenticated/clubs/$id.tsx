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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { confirmAction } from "@/components/ConfirmDialog";
import { EntityImageUpload } from "@/components/EntityImageUpload";

export const Route = createFileRoute("/_authenticated/clubs/$id")({
  component: ClubDetailPage,
});

type AthleteRow = Athlete & {
  primary_sport?: { name: string } | null;
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
    <div className="flex items-center gap-3 rounded-lg bg-slate-50 px-4 py-3">
      <div className="text-[#C8102E]">
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <p className="text-xl font-bold text-slate-900">{value}</p>
        <p className="text-xs text-slate-500">
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

function ClubDetailPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const [club, setClub] = useState<Club | null>(null);
  const [fed, setFed] = useState<Federation | null>(null);
  const [coaches, setCoaches] = useState<Coach[]>([]);
  const [athletes, setAthletes] = useState<AthleteRow[]>([]);
  const [members, setMembers] = useState<ClubMember[]>([]);
  const [allPersons, setAllPersons] = useState<
    Array<{ id: string; first_name: string; last_name: string; email: string | null; phone: string | null; address: string | null }>
  >([]);
  const [unlinkedMembers, setUnlinkedMembers] = useState<ClubMember[]>([]);
  const [pickedPersonId, setPickedPersonId] = useState("");
  const [, setSports] = useState<Sport[]>([]);
  const [loading, setLoading] = useState(true);

  // Add athlete dialog
  const [athleteOpen, setAthleteOpen] = useState(false);
  const [athletesActive, setAthletesActive] = useState<"active" | "inactive" | "all">("active");
  const [athleteSearch, setAthleteSearch] = useState("");
  const [memberSearch, setMemberSearch] = useState("");
  const [coachSearch, setCoachSearch] = useState("");
  const [athletePool, setAthletePool] = useState<AthleteRow[]>([]);
  const [selectedAthleteId, setSelectedAthleteId] = useState("");
  const [athleteSaving, setAthleteSaving] = useState(false);

  // Member dialog
  const [memberOpen, setMemberOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<ClubMember | null>(null);
  const [memberForm, setMemberForm] = useState(emptyMember);
  const [memberSaving, setMemberSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const cl = await supabase.from("clubs").select("*").eq("id", id).maybeSingle();
    if (cl.error) toast.error("Erreur de chargement", { description: cl.error.message });
    const c = (cl.data ?? null) as Club | null;
    setClub(c);
    const [f, co, a, sp, m, fm, cm] = await Promise.all([
      c
        ? supabase.from("federations").select("*").eq("id", c.federation_id).maybeSingle()
        : Promise.resolve({ data: null }),
      supabase.from("coaches").select("*").eq("club_id", id).order("last_name"),
      supabase
        .from("athletes")
        .select("*, primary_sport:sports!athletes_primary_sport_id_fkey(name)")
        .eq("current_club_id", id)
        .order("last_name"),
      supabase.from("sports").select("*"),
      supabase
        .from("club_members")
        .select("*")
        .eq("club_id", id)
        .order("created_at", { ascending: false }),
      supabase
        .from("federation_members")
        .select("id,first_name,last_name,email,phone,address")
        .order("last_name"),
      supabase
        .from("club_members")
        .select("id,first_name,last_name,email,phone,address")
        .order("last_name"),
    ]);
    setFed(((f as { data: Federation | null }).data ?? null) as Federation | null);
    setCoaches((co.data ?? []) as Coach[]);
    setAthletes((a.data ?? []) as AthleteRow[]);
    setSports((sp.data ?? []) as Sport[]);
    setMembers((m.data ?? []) as ClubMember[]);
    const merged = [
      ...((fm.data ?? []) as Array<typeof allPersons[number]>),
      ...((cm.data ?? []) as Array<typeof allPersons[number]>),
    ];
    const seen = new Set<string>();
    const dedup: typeof allPersons = [];
    for (const p of merged) {
      const key = `${p.first_name.trim().toLowerCase()}|${p.last_name.trim().toLowerCase()}|${(p.email ?? "").trim().toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      dedup.push(p);
    }
    setAllPersons(dedup);

    const { data: unlinked } = await supabase
      .from("club_members")
      .select("*")
      .is("club_id", null)
      .order("last_name");
    setUnlinkedMembers((unlinked ?? []) as ClubMember[]);

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
  const openAddAthlete = async () => {
    setSelectedAthleteId("");
    setAthleteOpen(true);
    // Load athletes not yet in this club
    const { data, error } = await supabase
      .from("athletes")
      .select("id, first_name, last_name, current_club_id, cosl_id, gender, birth_date, status, primary_sport:sports!athletes_primary_sport_id_fkey(name)")
      .or(`current_club_id.is.null,current_club_id.neq.${id}`)
      .eq("is_active", true)
      .order("last_name");
    if (error) toast.error("Erreur", { description: friendlyError(error) });
    setAthletePool((data ?? []) as unknown as AthleteRow[]);
  };

  const submitAddAthlete = async () => {
    if (!selectedAthleteId) {
      toast.error("Sélectionnez un adhérent");
      return;
    }
    setAthleteSaving(true);
    const { error } = await supabase
      .from("athletes")
      .update({ current_club_id: id })
      .eq("id", selectedAthleteId);
    setAthleteSaving(false);
    if (error) {
      toast.error("Échec", { description: friendlyError(error) });
      return;
    }
    toast.success("Adhérent ajouté au club");
    setAthleteOpen(false);
    load();
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
    setPickedPersonId("");
    setMemberOpen(true);
  };
  const onPickPerson = (pid: string) => {
    setPickedPersonId(pid);
    const p = allPersons.find((x) => x.id === pid);
    if (!p) return;
    setMemberForm((f) => ({
      ...f,
      first_name: p.first_name,
      last_name: p.last_name,
      email: p.email ?? "",
      phone: p.phone ?? "",
      address: p.address ?? "",
    }));
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
    const { error } = editingMember
      ? await supabase.from("club_members").update(payload).eq("id", editingMember.id)
      : pickedPersonId
        ? await supabase.from("club_members").update(payload).eq("id", pickedPersonId)
        : await supabase.from("club_members").insert(payload);
    setMemberSaving(false);
    if (error) {
      toast.error("Échec de l'enregistrement", { description: friendlyError(error) });
      return;
    }
    toast.success(
      editingMember ? "Membre modifié" : pickedPersonId ? "Membre rattaché" : "Membre ajouté",
    );
    setMemberOpen(false);
    setPickedPersonId("");
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

  if (loading) return <div className="p-6 text-slate-500">Chargement…</div>;
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

  const athletePoolOptions = athletePool.map((a) => ({
    id: a.id,
    label: `${a.first_name} ${a.last_name}${a.cosl_id ? ` (${a.cosl_id})` : ""}`,
  }));

  return (
    <div className="space-y-6">
      <div>
        <Button asChild variant="ghost" size="sm" className="-ml-2 mb-2">
          <Link to="/clubs">
            <ArrowLeft className="mr-2 h-4 w-4" /> Clubs
          </Link>
        </Button>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6">
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
                  <Badge variant="outline" className="font-mono hover:bg-slate-100">
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
            <h1 className="text-2xl font-bold text-slate-900">{club.name}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-4 text-sm text-slate-500">
              {president && (
                <span className="flex items-center gap-1">
                  <UserRound className="h-3.5 w-3.5" />
                  Président :{" "}
                  <span className="text-slate-700 font-medium ml-1">
                    {president.first_name} {president.last_name}
                  </span>
                </span>
              )}
              {club.email && (
                <a
                  href={`mailto:${club.email}`}
                  className="flex items-center gap-1 text-indigo-600 hover:underline"
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
            <p className="text-xs uppercase tracking-wide text-slate-400 mb-2">
              Sports pratiqués
            </p>
            <div className="flex flex-wrap gap-2">
              {stats.sportCounts.slice(0, 8).map(([name, n]) => (
                <span
                  key={name}
                  className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-700"
                >
                  {name}{" "}
                  <span className="font-semibold text-slate-900">{n}</span>
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
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
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
            <Button onClick={openAddAthlete} className="bg-indigo-500 hover:bg-indigo-600">
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
          <div className="rounded-lg border border-slate-200 bg-white">
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
                      className={`cursor-pointer hover:bg-slate-50 ${a.is_active === false ? "opacity-60" : ""}`}
                    >
                      <TableCell className="font-medium">
                        {a.first_name} {a.last_name}
                      </TableCell>
                      <TableCell className="text-slate-600">
                        {a.primary_sport?.name ?? "—"}
                      </TableCell>
                      <TableCell className="text-slate-600">
                        {ageOf(a.birth_date) ?? "—"}
                      </TableCell>
                      <TableCell>
                        {statusBadge(a.status)}
                        {a.is_active === false && (
                          <Badge variant="outline" className="ml-2 border-slate-300 text-slate-500">
                            Inactif
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-slate-500">
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
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                placeholder="Nom, prénom, email, fonction…"
                value={memberSearch}
                onChange={(e) => setMemberSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Button onClick={openCreateMember} className="bg-indigo-500 hover:bg-indigo-600">
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
          <div className="rounded-lg border border-slate-200 bg-white">
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
                      className="cursor-pointer hover:bg-slate-50"
                    >
                      <TableCell>
                        <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border border-slate-200 bg-slate-100">
                          {m.photo_url ? (
                            <img src={m.photo_url} alt={`${m.first_name} ${m.last_name}`} className="h-full w-full object-cover" />
                          ) : (
                            <span className="text-xs font-semibold text-slate-500">
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
                      <TableCell className="text-slate-600" onClick={(e) => e.stopPropagation()}>
                        {m.email ? (
                          <a
                            href={`mailto:${m.email}`}
                            className="text-indigo-600 hover:underline"
                          >
                            {m.email}
                          </a>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell className="text-slate-600">{m.phone ?? "—"}</TableCell>
                      <TableCell className="text-xs text-slate-500">
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
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              placeholder="Nom, prénom, email, rôle…"
              value={coachSearch}
              onChange={(e) => setCoachSearch(e.target.value)}
              className="pl-9"
            />
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
          <div className="rounded-lg border border-slate-200 bg-white">
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
                        className={`cursor-pointer hover:bg-slate-50 ${c.is_active ? "" : "opacity-60"}`}
                      >
                        <TableCell>
                          <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border border-slate-200 bg-slate-100">
                            {c.photo_url ? (
                              <img src={c.photo_url} alt="" className="h-full w-full object-cover" />
                            ) : (
                              <span className="text-xs font-semibold text-slate-500">
                                {(c.first_name[0] ?? "") + (c.last_name[0] ?? "")}
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="font-medium">
                          {c.first_name} {c.last_name}
                        </TableCell>
                        <TableCell className="text-slate-600">{role}</TableCell>
                        <TableCell className="text-slate-600">{c.email ?? "—"}</TableCell>
                        <TableCell className="text-slate-600">{c.phone ?? "—"}</TableCell>
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
              Rattacher un athlète existant au club {club.name}.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-1.5">
              <Label>Athlète</Label>
              <PersonCombobox
                value={selectedAthleteId}
                onChange={setSelectedAthleteId}
                options={athletePoolOptions}
                placeholder="Choisir un athlète…"
                searchPlaceholder="Rechercher par nom ou COSL ID…"
                emptyMessage="Aucun athlète disponible."
              />
              <p className="text-xs text-slate-500">
                Seuls les athlètes sans club ou rattachés à un autre club sont listés.
              </p>
            </div>
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
              className="bg-indigo-500 hover:bg-indigo-600"
            >
              {athleteSaving ? "Ajout…" : "Ajouter"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ============ Member dialog ============ */}
      <Dialog open={memberOpen} onOpenChange={setMemberOpen}>
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
              {!editingMember && (
                <div className="space-y-1.5 rounded-md border border-dashed border-slate-300 bg-slate-50 p-3">
                  <Label className="text-xs uppercase tracking-wide text-slate-500">
                    Choisir un membre existant ou créer un nouveau
                  </Label>
                  <Select
                    value={pickedPersonId || "__new__"}
                    onValueChange={(v) => {
                      if (v === "__new__") {
                        setPickedPersonId("");
                        setMemberForm(emptyMember);
                        return;
                      }
                      setPickedPersonId(v);
                      const p = unlinkedMembers.find((x) => x.id === v);
                      if (!p) return;
                      setMemberForm({
                        first_name: p.first_name,
                        last_name: p.last_name,
                        role: p.role ?? "president",
                        email: p.email ?? "",
                        phone: p.phone ?? "",
                        address: p.address ?? "",
                        street: p.street ?? "",
                        postcode: p.postcode ?? "",
                        city: p.city ?? "",
                        country: p.country ?? "",
                        start_date: "",
                        end_date: "",
                        notes: "",
                        is_active: true,
                      });
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Nouveau membre (champs vides ci-dessous)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__new__" className="text-[#C8102E] font-medium">
                        + Ajouter un nouveau membre
                      </SelectItem>
                      {unlinkedMembers.length > 0 && (
                        <>
                          <SelectSeparator />
                          {unlinkedMembers.map((m) => (
                            <SelectItem key={m.id} value={m.id}>
                              {m.first_name} {m.last_name}
                              {m.email ? ` — ${m.email}` : ""}
                            </SelectItem>
                          ))}
                        </>
                      )}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-slate-500">
                    Ou laissez sur "Nouveau membre" et remplissez les champs ci-dessous.
                  </p>
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
              <div className="flex items-center justify-between rounded-md border border-slate-200 px-3 py-2">
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
                className="bg-indigo-500 hover:bg-indigo-600"
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
    </div>
  );
}
