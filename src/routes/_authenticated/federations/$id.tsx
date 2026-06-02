import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { friendlyError } from "@/lib/error-messages";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  // Building2 removed: replaced by EntityImageUpload in header
  Users,
  Shield,
  UserCog,
  Mail,
  Phone,
  Globe,
  Trophy,
  Plus,
  Pencil,
  Trash2,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import type {
  Athlete,
  Club,
  Coach,
  Federation,
  FederationMember,
  Sport,
} from "@/lib/types";
import {
  ATHLETE_STATUSES,
  COACH_ROLES,
  FEDERATION_MEMBER_ROLES,
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

export const Route = createFileRoute("/_authenticated/federations/$id")({
  component: FederationDetailPage,
});

type AthleteRow = Athlete & {
  primary_sport?: { name: string } | null;
  current_club?: { id: string; name: string } | null;
};

function statusBadge(s: string) {
  const m = ATHLETE_STATUSES.find((x) => x.value === s);
  return <Badge className={`${m?.cls ?? ""} hover:${m?.cls ?? ""}`}>{m?.label ?? s}</Badge>;
}

function memberRoleLabel(role: string) {
  return FEDERATION_MEMBER_ROLES.find((r) => r.value === role)?.label ?? role;
}

function StatCard({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number | string;
  hint?: string;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-5">
        <div className="rounded-lg bg-indigo-50 p-3 text-indigo-600">
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <div className="text-2xl font-semibold text-slate-900">{value}</div>
          <div className="text-sm text-slate-600">{label}</div>
          {hint && <div className="mt-0.5 text-xs text-slate-400">{hint}</div>}
        </div>
      </CardContent>
    </Card>
  );
}

// ---------- Club form ----------
const emptyClub = {
  name: "",
  city: "",
  address: "",
  street: "",
  postcode: "",
  country: "",
  email: "",
  phone: "",
};


// ---------- Member form ----------
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

function FederationDetailPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const [fed, setFed] = useState<Federation | null>(null);
  const [clubs, setClubs] = useState<Club[]>([]);
  const [coaches, setCoaches] = useState<Coach[]>([]);
  const [athletes, setAthletes] = useState<AthleteRow[]>([]);
  const [members, setMembers] = useState<FederationMember[]>([]);
  const [allPersons, setAllPersons] = useState<
    Array<{ id: string; first_name: string; last_name: string; email: string | null; phone: string | null; address: string | null }>
  >([]);
  const [pickedPersonId, setPickedPersonId] = useState("");
  const [, setSports] = useState<Sport[]>([]);
  const [loading, setLoading] = useState(true);

  // Club dialog
  const [clubOpen, setClubOpen] = useState(false);
  const [editingClub, setEditingClub] = useState<Club | null>(null);
  const [clubForm, setClubForm] = useState(emptyClub);
  const [clubSaving, setClubSaving] = useState(false);

  // Member dialog
  const [memberOpen, setMemberOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<FederationMember | null>(null);
  const [memberForm, setMemberForm] = useState(emptyMember);
  const [memberSaving, setMemberSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    // First load federation + clubs to know which clubs belong
    const [f, c, sp, m, fm, cm] = await Promise.all([
      supabase.from("federations").select("*").eq("id", id).maybeSingle(),
      supabase.from("clubs").select("*").eq("federation_id", id).order("name"),
      supabase.from("sports").select("*"),
      supabase
        .from("federation_members")
        .select("*")
        .eq("federation_id", id)
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
    if (f.error) toast.error("Erreur de chargement", { description: f.error.message });
    setFed((f.data ?? null) as Federation | null);
    const clubsData = (c.data ?? []) as Club[];
    setClubs(clubsData);
    setSports((sp.data ?? []) as Sport[]);
    setMembers((m.data ?? []) as FederationMember[]);
    // Merge & dedupe by name+email
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

    const clubIds = clubsData.map((cl) => cl.id);
    // Athletes: those rattached to fed OR member of one of its clubs
    const athletesQuery = supabase
      .from("athletes")
      .select(
        "*, primary_sport:sports!athletes_primary_sport_id_fkey(name), current_club:clubs!athletes_current_club_id_fkey(id,name)",
      )
      .eq("is_active", true)
      .order("last_name");
    if (clubIds.length > 0) {
      athletesQuery.or(
        `primary_federation_id.eq.${id},current_club_id.in.(${clubIds.join(",")})`,
      );
    } else {
      athletesQuery.eq("primary_federation_id", id);
    }

    // Coaches: those of the fed OR of one of its clubs
    const coachesQuery = supabase.from("coaches").select("*").order("last_name");
    if (clubIds.length > 0) {
      coachesQuery.or(
        `federation_id.eq.${id},club_id.in.(${clubIds.join(",")})`,
      );
    } else {
      coachesQuery.eq("federation_id", id);
    }

    const [a, co] = await Promise.all([athletesQuery, coachesQuery]);
    setAthletes((a.data ?? []) as AthleteRow[]);
    setCoaches((co.data ?? []) as Coach[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const clubMap = useMemo(() => {
    const m = new Map<string, Club>();
    clubs.forEach((c) => m.set(c.id, c));
    return m;
  }, [clubs]);

  const stats = useMemo(() => {
    const active = athletes.filter((a) => a.status === "active").length;
    const sportCounts = new Map<string, number>();
    athletes.forEach((a) => {
      const n = a.primary_sport?.name ?? "—";
      sportCounts.set(n, (sportCounts.get(n) ?? 0) + 1);
    });
    return {
      clubs: clubs.length,
      coaches: coaches.length,
      athletes: athletes.length,
      members: members.length,
      active,
      sportCounts: Array.from(sportCounts.entries()).sort((a, b) => b[1] - a[1]),
    };
  }, [clubs, coaches, athletes, members]);

  // ---------- Club CRUD ----------
  const openCreateClub = () => {
    setEditingClub(null);
    setClubForm(emptyClub);
    setClubOpen(true);
  };
  const openEditClub = (c: Club) => {
    setEditingClub(c);
    setClubForm({
      name: c.name,
      city: c.city ?? "",
      address: c.address ?? "",
      street: c.street ?? c.address ?? "",
      postcode: c.postcode ?? "",
      country: c.country ?? "",
      email: c.email ?? "",
      phone: c.phone ?? "",
    });
    setClubOpen(true);
  };
  const submitClub = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clubForm.name.trim()) {
      toast.error("Nom requis");
      return;
    }
    setClubSaving(true);
    const street = clubForm.street.trim();
    const city = clubForm.city.trim();
    const postcode = clubForm.postcode.trim();
    const country = clubForm.country.trim();
    const fullAddress =
      [street, [postcode, city].filter(Boolean).join(" "), country]
        .filter(Boolean)
        .join(", ") || clubForm.address.trim();
    const payload = {
      name: clubForm.name.trim(),
      federation_id: id,
      city: city || null,
      address: fullAddress || null,
      street: street || null,
      postcode: postcode || null,
      country: country || null,
      email: clubForm.email.trim() || null,
      phone: clubForm.phone.trim() || null,
    };
    const { error } = editingClub
      ? await supabase.from("clubs").update(payload).eq("id", editingClub.id)
      : await supabase.from("clubs").insert(payload);

    setClubSaving(false);
    if (error) {
      toast.error("Échec de l'enregistrement", { description: friendlyError(error) });
      return;
    }
    toast.success(editingClub ? "Club modifié" : "Club ajouté");
    setClubOpen(false);
    load();
  };
  const removeClub = async (c: Club) => {
    const ok = await confirmAction({
      title: `Retirer ${c.name} ?`,
      description:
        "Le club sera supprimé de la fédération. Cette action est irréversible.",
      confirmLabel: "Retirer",
      destructive: true,
    });
    if (!ok) return;
    const { error } = await supabase.from("clubs").delete().eq("id", c.id);
    if (error) {
      toast.error("Suppression impossible", { description: friendlyError(error) });
    } else {
      toast.success("Club retiré");
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
  const openEditMember = (m: FederationMember) => {
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
      federation_id: id,
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
      ? await supabase
          .from("federation_members")
          .update(payload)
          .eq("id", editingMember.id)
      : await supabase.from("federation_members").insert(payload);
    setMemberSaving(false);
    if (error) {
      toast.error("Échec de l'enregistrement", { description: friendlyError(error) });
      return;
    }
    toast.success(editingMember ? "Membre modifié" : "Membre ajouté");
    setMemberOpen(false);
    load();
  };
  const removeMember = async (m: FederationMember) => {
    const ok = await confirmAction({
      title: `Supprimer ${m.first_name} ${m.last_name} ?`,
      description: "Ce membre sera retiré de la fédération.",
      confirmLabel: "Supprimer",
      destructive: true,
    });
    if (!ok) return;
    const { error } = await supabase
      .from("federation_members")
      .delete()
      .eq("id", m.id);
    if (error) toast.error("Suppression impossible", { description: friendlyError(error) });
    else {
      toast.success("Membre supprimé");
      load();
    }
  };

  if (loading) {
    return <div className="p-6 text-slate-500">Chargement…</div>;
  }
  if (!fed) {
    return (
      <div className="space-y-4">
        <Button asChild variant="ghost" size="sm">
          <Link to="/federations">
            <ArrowLeft className="mr-2 h-4 w-4" /> Retour
          </Link>
        </Button>
        <EmptyState message="Fédération introuvable." />
      </div>
    );
  }

  // President from members table, fallback to fed.president_name
  const president =
    members.find((m) => m.role === "president" && (m.is_active ?? true)) ?? null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <Button asChild variant="ghost" size="sm" className="-ml-2">
            <Link to="/federations">
              <ArrowLeft className="mr-2 h-4 w-4" /> Fédérations
            </Link>
          </Button>
          <div className="flex items-center gap-3">
            <EntityImageUpload
              entityId={fed.id}
              entityType="federation"
              currentImageUrl={fed.logo_url}
              currentStoragePath={fed.logo_storage_path}
              shape="square"
              size="lg"
              placeholder={fed.acronym?.slice(0, 3)}
              onUploaded={async (url, path) => {
                await supabase
                  .from("federations")
                  .update({ logo_url: url, logo_storage_path: path })
                  .eq("id", id);
                setFed((f) => (f ? { ...f, logo_url: url, logo_storage_path: path } : f));
              }}
              onDeleted={async () => {
                await supabase
                  .from("federations")
                  .update({ logo_url: null, logo_storage_path: null })
                  .eq("id", id);
                setFed((f) => (f ? { ...f, logo_url: null, logo_storage_path: null } : f));
              }}
            />
            <div>
              <h1 className="text-2xl font-semibold text-slate-900">
                <span className="font-mono text-indigo-600">{fed.acronym}</span>{" "}
                <span className="text-slate-900">— {fed.name}</span>
              </h1>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-600">
                {fed.is_olympic && (
                  <Badge className="bg-indigo-100 text-indigo-700 hover:bg-indigo-100">
                    Olympique
                  </Badge>
                )}
                {fed.international_federation && (
                  <span className="inline-flex items-center gap-1">
                    <Globe className="h-3.5 w-3.5" /> {fed.international_federation}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
        <StatCard icon={Shield} label="Clubs" value={stats.clubs} />
        <StatCard
          icon={Users}
          label="Adhérents"
          value={stats.athletes}
          hint={`${stats.active} actif(s)`}
        />
        <StatCard icon={UserCog} label="Encadrants" value={stats.coaches} />
        <StatCard icon={UserRound} label="Membres" value={stats.members} />
        <StatCard
          icon={Trophy}
          label="Sports"
          value={stats.sportCounts.length}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Coordonnées</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm md:grid-cols-2">
            <div>
              <div className="text-xs uppercase tracking-wide text-slate-500">Président</div>
              <div className="text-slate-900">
                {president
                  ? `${president.first_name} ${president.last_name}`
                  : fed.president_name ?? "—"}
              </div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-slate-500">
                Fédération internationale
              </div>
              <div className="text-slate-900">{fed.international_federation ?? "—"}</div>
            </div>
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-slate-400" />
              {fed.contact_email ? (
                <a href={`mailto:${fed.contact_email}`} className="text-indigo-600 hover:underline">
                  {fed.contact_email}
                </a>
              ) : (
                <span className="text-slate-400">—</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Phone className="h-4 w-4 text-slate-400" />
              <span className="text-slate-700">{fed.contact_phone ?? "—"}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top sports</CardTitle>
          </CardHeader>
          <CardContent>
            {stats.sportCounts.length === 0 ? (
              <p className="text-sm text-slate-500">Aucun athlète enregistré.</p>
            ) : (
              <ul className="space-y-1.5 text-sm">
                {stats.sportCounts.slice(0, 6).map(([name, n]) => (
                  <li key={name} className="flex items-center justify-between">
                    <span className="text-slate-700">{name}</span>
                    <Badge variant="outline">{n}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="clubs">
        <TabsList>
          <TabsTrigger value="clubs">Clubs ({clubs.length})</TabsTrigger>
          <TabsTrigger value="athletes">Adhérents ({athletes.length})</TabsTrigger>
          <TabsTrigger value="members">Membres ({members.length})</TabsTrigger>
          <TabsTrigger value="coaches">Encadrants ({coaches.length})</TabsTrigger>
        </TabsList>

        {/* ============ CLUBS ============ */}
        <TabsContent value="clubs" className="mt-4 space-y-3">
          <div className="flex justify-end">
            <Button onClick={openCreateClub} className="bg-indigo-500 hover:bg-indigo-600">
              <Plus className="mr-2 h-4 w-4" /> Ajouter un club
            </Button>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white">
            {clubs.length === 0 ? (
              <div className="p-6">
                <EmptyState message="Aucun club affilié." />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nom</TableHead>
                    <TableHead>Ville</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Téléphone</TableHead>
                    <TableHead className="text-right">Adhérents</TableHead>
                    <TableHead className="w-24 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {clubs.map((c) => {
                    const n = athletes.filter((a) => a.current_club?.id === c.id).length;
                    return (
                      <TableRow
                        key={c.id}
                        onClick={() => navigate({ to: "/clubs/$id", params: { id: c.id } })}
                        className="cursor-pointer hover:bg-slate-50"
                      >
                        <TableCell className="font-medium text-indigo-600">
                          {c.name}
                        </TableCell>
                        <TableCell className="text-slate-600">{c.city ?? "—"}</TableCell>
                        <TableCell className="text-slate-600">{c.email ?? "—"}</TableCell>
                        <TableCell className="text-slate-600">{c.phone ?? "—"}</TableCell>
                        <TableCell className="text-right">
                          <Badge variant="outline">{n}</Badge>
                        </TableCell>
                        <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEditClub(c)}
                            aria-label="Modifier"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeClub(c)}
                            aria-label="Retirer"
                          >
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

        {/* ============ ATHLETES (Adhérents) ============ */}
        <TabsContent value="athletes" className="mt-4">
          <div className="rounded-lg border border-slate-200 bg-white">
            {athletes.length === 0 ? (
              <div className="p-6">
                <EmptyState message="Aucun adhérent dans les clubs de cette fédération." />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nom</TableHead>
                    <TableHead>Sport</TableHead>
                    <TableHead>Club</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead>COSL ID</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {athletes.map((a) => (
                    <TableRow
                      key={a.id}
                      onClick={() => navigate({ to: "/athletes/$id", params: { id: a.id } })}
                      className="cursor-pointer hover:bg-slate-50"
                    >
                      <TableCell className="font-medium">
                        {a.first_name} {a.last_name}
                      </TableCell>
                      <TableCell className="text-slate-600">
                        {a.primary_sport?.name ?? "—"}
                      </TableCell>
                      <TableCell className="text-slate-600">
                        {a.current_club?.name ?? "—"}
                      </TableCell>
                      <TableCell>{statusBadge(a.status)}</TableCell>
                      <TableCell className="font-mono text-xs text-slate-500">
                        {a.cosl_id || "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </TabsContent>

        {/* ============ MEMBERS ============ */}
        <TabsContent value="members" className="mt-4 space-y-3">
          <div className="flex justify-end">
            <Button onClick={openCreateMember} className="bg-indigo-500 hover:bg-indigo-600">
              <Plus className="mr-2 h-4 w-4" /> Ajouter un membre
            </Button>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white">
            {members.length === 0 ? (
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
                  {members.map((m) => (
                  <TableRow
                    key={m.id}
                    onClick={() => navigate({ to: "/federations/members/$memberId", params: { memberId: m.id } })}
                    className="cursor-pointer hover:bg-slate-50"
                  >
                    <TableCell>
                      <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border border-slate-200 bg-slate-100">
                        {m.photo_url ? (
                          <img src={m.photo_url} alt="" className="h-full w-full object-cover" />
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
        </TabsContent>

        {/* ============ COACHES ============ */}
        <TabsContent value="coaches" className="mt-4">
          <div className="rounded-lg border border-slate-200 bg-white">
            {coaches.length === 0 ? (
              <div className="p-6">
                <EmptyState message="Aucun encadrant rattaché." />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nom</TableHead>
                    <TableHead>Rôle</TableHead>
                    <TableHead>Club</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Téléphone</TableHead>
                    <TableHead>Statut</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {coaches.map((c) => {
                    const role = COACH_ROLES.find((r) => r.value === c.role)?.label ?? c.role;
                    const club = c.club_id ? clubMap.get(c.club_id) : null;
                    return (
                      <TableRow
                        key={c.id}
                        onClick={() => navigate({ to: "/coaches/$id", params: { id: c.id } })}
                        className="cursor-pointer hover:bg-slate-50"
                      >
                        <TableCell className="font-medium">
                          {c.first_name} {c.last_name}
                        </TableCell>
                        <TableCell className="text-slate-600">{role}</TableCell>
                        <TableCell className="text-slate-600" onClick={(e) => e.stopPropagation()}>
                          {club ? (
                            <Link
                              to="/clubs/$id"
                              params={{ id: club.id }}
                              className="hover:underline"
                            >
                              {club.name}
                            </Link>
                          ) : (
                            "—"
                          )}
                        </TableCell>
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
        </TabsContent>
      </Tabs>

      {/* ============ Club dialog ============ */}
      <Dialog open={clubOpen} onOpenChange={setClubOpen}>
        <DialogContent className="sm:max-w-lg">
          <form onSubmit={submitClub}>
            <DialogHeader>
              <DialogTitle>
                {editingClub ? "Modifier le club" : "Ajouter un club"}
              </DialogTitle>
              <DialogDescription>
                Le club sera rattaché à la fédération {fed.acronym}.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-1.5">
                <Label htmlFor="fcname">Nom *</Label>
                <Input
                  id="fcname"
                  value={clubForm.name}
                  onChange={(e) => setClubForm({ ...clubForm, name: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="fcstreet">Adresse (numéro + rue)</Label>
                <AddressSearch
                  id="fcstreet"
                  value={clubForm.street}
                  onChange={(v) => setClubForm({ ...clubForm, street: v })}
                  onSelect={(r) =>
                    setClubForm((f) => ({
                      ...f,
                      street: r.street || f.street,
                      city: r.city || f.city,
                      postcode: r.postcode || f.postcode,
                      country: r.country || f.country,
                    }))
                  }
                  placeholder="Rue, ville, pays…"
                />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="fcpostcode">Code postal</Label>
                  <Input
                    id="fcpostcode"
                    value={clubForm.postcode}
                    onChange={(e) => setClubForm({ ...clubForm, postcode: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="fccity2">Ville</Label>
                  <Input
                    id="fccity2"
                    value={clubForm.city}
                    onChange={(e) => setClubForm({ ...clubForm, city: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="fccountry">Pays</Label>
                  <Input
                    id="fccountry"
                    value={clubForm.country}
                    onChange={(e) => setClubForm({ ...clubForm, country: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="fcphone">Téléphone</Label>
                  <Input
                    id="fcphone"
                    value={clubForm.phone}
                    onChange={(e) => setClubForm({ ...clubForm, phone: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="fcemail">Email</Label>
                  <Input
                    id="fcemail"
                    type="email"
                    value={clubForm.email}
                    onChange={(e) => setClubForm({ ...clubForm, email: e.target.value })}
                  />
                </div>
              </div>

            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setClubOpen(false)}
                disabled={clubSaving}
              >
                Annuler
              </Button>
              <Button
                type="submit"
                disabled={clubSaving}
                className="bg-indigo-500 hover:bg-indigo-600"
              >
                {clubSaving ? "Enregistrement…" : editingClub ? "Enregistrer" : "Ajouter"}
              </Button>
            </DialogFooter>
          </form>
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
                Membre du bureau de la fédération {fed.acronym}.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              {editingMember && (
                <div className="flex justify-center pb-2">
                  <EntityImageUpload
                    entityId={editingMember.id}
                    entityType="federation_member"
                    currentImageUrl={editingMember.photo_url}
                    currentStoragePath={editingMember.photo_storage_path}
                    shape="circle"
                    size="lg"
                    label="Photo"
                    placeholder={(editingMember.first_name[0] ?? "") + (editingMember.last_name[0] ?? "")}
                    onUploaded={async (url, path) => {
                      await supabase
                        .from("federation_members")
                        .update({ photo_url: url, photo_storage_path: path })
                        .eq("id", editingMember.id);
                      setEditingMember((m) => (m ? { ...m, photo_url: url, photo_storage_path: path } : m));
                      load();
                    }}
                    onDeleted={async () => {
                      await supabase
                        .from("federation_members")
                        .update({ photo_url: null, photo_storage_path: null })
                        .eq("id", editingMember.id);
                      setEditingMember((m) => (m ? { ...m, photo_url: null, photo_storage_path: null } : m));
                      load();
                    }}
                  />
                </div>
              )}
              {!editingMember && allPersons.length > 0 && (
                <div className="space-y-1.5 rounded-md border border-dashed border-slate-300 bg-slate-50 p-3">
                  <Label className="text-xs uppercase tracking-wide text-slate-500">
                    Choisir un membre déjà enregistré (optionnel)
                  </Label>
                  <PersonCombobox
                    value={pickedPersonId}
                    onChange={onPickPerson}
                    options={allPersons.map((p) => ({
                      id: p.id,
                      label: `${p.first_name} ${p.last_name}${p.email ? ` — ${p.email}` : ""}`,
                    }))}
                    placeholder="Sélectionner pour pré-remplir…"
                    searchPlaceholder="Rechercher un membre existant…"
                    emptyMessage="Aucun membre trouvé."
                  />
                  <p className="text-xs text-slate-500">
                    Ou laissez vide et remplissez les champs ci-dessous pour créer un nouveau membre.
                  </p>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="mfname">Prénom *</Label>
                  <Input
                    id="mfname"
                    value={memberForm.first_name}
                    onChange={(e) =>
                      setMemberForm({ ...memberForm, first_name: e.target.value })
                    }
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="mlname">Nom *</Label>
                  <Input
                    id="mlname"
                    value={memberForm.last_name}
                    onChange={(e) =>
                      setMemberForm({ ...memberForm, last_name: e.target.value })
                    }
                    required
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="mrole">Fonction *</Label>
                <Select
                  value={memberForm.role}
                  onValueChange={(v) => setMemberForm({ ...memberForm, role: v })}
                >
                  <SelectTrigger id="mrole">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FEDERATION_MEMBER_ROLES.map((r) => (
                      <SelectItem key={r.value} value={r.value}>
                        {r.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="memail">Email</Label>
                  <Input
                    id="memail"
                    type="email"
                    value={memberForm.email}
                    onChange={(e) =>
                      setMemberForm({ ...memberForm, email: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="mphone">Téléphone</Label>
                  <Input
                    id="mphone"
                    value={memberForm.phone}
                    onChange={(e) =>
                      setMemberForm({ ...memberForm, phone: e.target.value })
                    }
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="maddr">Adresse (numéro + rue)</Label>
                <AddressSearch
                  id="maddr"
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
                  <Label htmlFor="mpostcode">Code postal</Label>
                  <Input id="mpostcode" value={memberForm.postcode} onChange={(e) => setMemberForm({ ...memberForm, postcode: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="mcity">Ville</Label>
                  <Input id="mcity" value={memberForm.city} onChange={(e) => setMemberForm({ ...memberForm, city: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="mcountry">Pays</Label>
                  <Input id="mcountry" value={memberForm.country} onChange={(e) => setMemberForm({ ...memberForm, country: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="mstart">Début de mandat</Label>
                  <Input
                    id="mstart"
                    type="date"
                    value={memberForm.start_date}
                    onChange={(e) =>
                      setMemberForm({ ...memberForm, start_date: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="mend">Fin de mandat</Label>
                  <Input
                    id="mend"
                    type="date"
                    value={memberForm.end_date}
                    onChange={(e) =>
                      setMemberForm({ ...memberForm, end_date: e.target.value })
                    }
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="mnotes">Notes</Label>
                <Textarea
                  id="mnotes"
                  rows={3}
                  value={memberForm.notes}
                  onChange={(e) =>
                    setMemberForm({ ...memberForm, notes: e.target.value })
                  }
                />
              </div>
              <div className="flex items-center justify-between rounded-md border border-slate-200 px-3 py-2">
                <Label htmlFor="mactive" className="cursor-pointer">
                  Membre actif
                </Label>
                <Switch
                  id="mactive"
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

