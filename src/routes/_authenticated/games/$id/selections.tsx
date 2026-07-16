import { createFileRoute, Link } from "@tanstack/react-router";
import { friendlyError } from "@/lib/error-messages";
import { useEffect, useMemo, useState } from "react";
import { Plus, Search, Lock, Pencil, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { computeAge, checkAgeEligibility } from "@/lib/kyc-utils";
import { createConformityNotification, getPersonIdForAthlete } from "@/lib/conformity-utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { TableSkeleton, EmptyState } from "@/components/DataTableShell";
import { COACH_ROLES, FEDERATION_MEMBER_ROLES } from "@/lib/types";
import { coachRoleLabel, federationMemberRoleLabel } from "@/lib/role-labels";

export const Route = createFileRoute("/_authenticated/games/$id/selections")({
  component: SelectionsPage,
});

const SELECTION_STATUSES: { value: string; label: string; cls: string }[] = [
  { value: "pre_selected", label: "Long List", cls: "bg-amber-100 text-amber-700" },
  { value: "selected", label: "Short List", cls: "bg-emerald-100 text-emerald-700" },
  { value: "reserve", label: "Réserve", cls: "bg-sky-100 text-sky-700" },
  { value: "rejected", label: "Refusé", cls: "bg-red-100 text-red-700" },
];

type Athlete = {
  id: string; first_name: string; last_name: string; gender: string;
  photo_url: string | null; primary_sport_id: string | null;
  birth_date: string | null;
};
type Person = {
  id: string; first_name: string; last_name: string;
  photo_url: string | null; email: string | null;
};
type CoachProfileRow = {
  id: string; person_id: string; legacy_coach_id: string | null; role: string;
  is_active: boolean;
};
type FedMemberProfileRow = {
  id: string; person_id: string; legacy_federation_member_id: string | null; role: string;
  federation_id: string; is_active: boolean;
};
type Sport = { id: string; name: string };
type Discipline = { id: string; sport_id: string; name: string; gender: string };
type Competition = {
  id: string; game_id: string; sport_id: string; discipline_id: string | null;
  name: string; competition_date: string | null;
  min_age: number | null; max_age: number | null;
};
type SelectionRow = {
  id: string; game_id: string;
  athlete_id: string | null; person_id: string | null;
  sport_id: string | null; discipline_id: string | null; game_competition_id: string | null;
  status: string; is_locked: boolean | null;
  athlete: Athlete | null;
  person: Person | null;
  sport: Sport | null;
  discipline: Discipline | null;
  game_competition: Competition | null;
};

const ENTITY_TYPES = [
  { value: "athlete", label: "Athlète" },
  { value: "coach", label: "Encadrant" },
  { value: "fed_member", label: "Membre de fédération" },
] as const;
type EntityType = (typeof ENTITY_TYPES)[number]["value"];

function SelectionsPage() {
  const { id: gameId } = Route.useParams();
  const [rows, setRows] = useState<SelectionRow[] | null>(null);
  const [athletes, setAthletes] = useState<Athlete[]>([]);
  const [persons, setPersons] = useState<Person[]>([]);
  const [coachProfiles, setCoachProfiles] = useState<CoachProfileRow[]>([]);
  const [fedMemberProfiles, setFedMemberProfiles] = useState<FedMemberProfileRow[]>([]);
  const [sports, setSports] = useState<Sport[]>([]);
  const [gameSportIds, setGameSportIds] = useState<string[]>([]);
  const [disciplines, setDisciplines] = useState<Discipline[]>([]);
  const [competitions, setCompetitions] = useState<Competition[]>([]);

  const [search, setSearch] = useState("");
  const [sportFilter, setSportFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");

  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [entityType, setEntityType] = useState<EntityType>("athlete");
  const [form, setForm] = useState({ entity_id: "", person_id: "", sport_id: "", discipline_id: "", game_competition_id: "" });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setRows(null);
    const [selRes, athRes, pRes, cpRes, fmRes, sportsRes, gsRes, discRes, compRes] = await Promise.all([
      supabase.from("selections")
        .select("*, athlete:athletes(id,first_name,last_name,gender,photo_url,primary_sport_id,birth_date), person:persons(id,first_name,last_name,photo_url,email), sport:sports(id,name), discipline:disciplines(id,sport_id,name,gender), game_competition:game_competitions(id,game_id,sport_id,discipline_id,name,competition_date,min_age,max_age)")
        .eq("game_id", gameId)
        .order("created_at", { ascending: false }),
      supabase.from("athletes").select("id,first_name,last_name,gender,photo_url,primary_sport_id,birth_date").eq("is_active", true).order("last_name"),
      supabase.from("persons").select("id,first_name,last_name,photo_url,email").eq("is_active", true).order("last_name"),
      supabase.from("coach_profiles").select("id,person_id,legacy_coach_id,role,is_active").eq("is_active", true),
      supabase.from("federation_member_profiles").select("id,person_id,legacy_federation_member_id,role,federation_id,is_active").eq("is_active", true),
      supabase.from("sports").select("id,name").order("name"),
      supabase.from("game_sports").select("sport_id").eq("game_id", gameId).eq("is_active", true),
      supabase.from("disciplines").select("id,sport_id,name,gender").order("name"),
      supabase.from("game_competitions")
        .select("id,game_id,sport_id,discipline_id,name,competition_date,min_age,max_age")
        .eq("game_id", gameId)
        .order("competition_date", { nullsFirst: false }),
    ]);
    if (selRes.error) toast.error("Erreur sélections", { description: selRes.error.message });
    setRows(((selRes.data ?? []) as unknown) as SelectionRow[]);
    setAthletes((athRes.data ?? []) as Athlete[]);
    setPersons((pRes.data ?? []) as Person[]);
    setCoachProfiles((cpRes.data ?? []) as CoachProfileRow[]);
    setFedMemberProfiles((fmRes.data ?? []) as FedMemberProfileRow[]);
    setSports((sportsRes.data ?? []) as Sport[]);
    setGameSportIds(((gsRes.data ?? []) as { sport_id: string }[]).map((g) => g.sport_id));
    setDisciplines((discRes.data ?? []) as Discipline[]);
    setCompetitions((compRes.data ?? []) as Competition[]);
  };

  useEffect(() => { load(); }, [gameId]);

  // Get role label for a person based on their profiles
  const getPersonRoleLabel = (personId: string): string => {
    const coach = coachProfiles.find((c) => c.person_id === personId);
    if (coach) return coachRoleLabel(coach.role);
    const fm = fedMemberProfiles.find((f) => f.person_id === personId);
    if (fm) return federationMemberRoleLabel(fm.role);
    return "—";
  };

  const getPersonRoleCode = (personId: string): string => {
    const coach = coachProfiles.find((c) => c.person_id === personId);
    if (coach) return coach.role;
    const fm = fedMemberProfiles.find((f) => f.person_id === personId);
    if (fm) return fm.role;
    return "—";
  };

  // Determine if a row is an athlete selection or a person selection
  const getRowType = (r: SelectionRow): "athlete" | "person" => {
    if (r.athlete_id && r.athlete) return "athlete";
    return "person";
  };

  const getRowName = (r: SelectionRow): string => {
    if (r.athlete) return `${r.athlete.first_name} ${r.athlete.last_name}`;
    if (r.person) return `${r.person.first_name} ${r.person.last_name}`;
    return "—";
  };

  const getRowAvatar = (r: SelectionRow): string | null => {
    if (r.athlete?.photo_url) return r.athlete.photo_url;
    if (r.person?.photo_url) return r.person.photo_url;
    return null;
  };

  const getRowInitials = (r: SelectionRow): string => {
    const fn = r.athlete?.first_name ?? r.person?.first_name ?? "";
    const ln = r.athlete?.last_name ?? r.person?.last_name ?? "";
    return `${fn[0] ?? ""}${ln[0] ?? ""}`.toUpperCase();
  };

  const filtered = useMemo(() => {
    if (!rows) return [];
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      const type = getRowType(r);
      if (typeFilter !== "all") {
        if (typeFilter === "athlete" && type !== "athlete") return false;
        if (typeFilter === "person" && type !== "person") return false;
      }
      if (sportFilter !== "all" && r.sport_id !== sportFilter) return false;
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (q) {
        const name = getRowName(r).toLowerCase();
        if (!name.includes(q)) return false;
      }
      return true;
    });
  }, [rows, search, sportFilter, statusFilter, typeFilter]);

  const gameSports = useMemo(
    () => sports.filter((s) => gameSportIds.includes(s.id)),
    [sports, gameSportIds],
  );

  // Available athletes for picker (filtered by game sports)
  const availableAthletes = useMemo(() => {
    const used = new Set((rows ?? []).filter((r) => r.athlete_id).map((r) => r.athlete_id!));
    const sportSet = new Set(gameSportIds);
    return athletes
      .filter((a) => !used.has(a.id) || form.entity_id === a.id)
      .filter((a) => a.primary_sport_id && sportSet.has(a.primary_sport_id))
      .slice(0, 200);
  }, [athletes, rows, form.entity_id, gameSportIds]);

  // Available persons (coaches + fed members) for picker
  const availablePersons = useMemo(() => {
    const used = new Set((rows ?? []).filter((r) => r.person_id).map((r) => r.person_id!));
    const coachPersonIds = new Set(coachProfiles.map((c) => c.person_id));
    const fedMemberPersonIds = new Set(fedMemberProfiles.map((f) => f.person_id));
    let pool = persons;
    if (entityType === "coach") {
      pool = persons.filter((p) => coachPersonIds.has(p.id));
    } else if (entityType === "fed_member") {
      pool = persons.filter((p) => fedMemberPersonIds.has(p.id));
    } else {
      pool = persons.filter((p) => coachPersonIds.has(p.id) || fedMemberPersonIds.has(p.id));
    }
    return pool
      .filter((p) => !used.has(p.id) || form.entity_id === p.id)
      .slice(0, 200);
  }, [persons, coachProfiles, fedMemberProfiles, rows, form.entity_id, entityType]);

  const formDisciplines = useMemo(
    () => disciplines.filter((d) => d.sport_id === form.sport_id),
    [disciplines, form.sport_id],
  );

  const formCompetitions = useMemo(
    () => competitions.filter((c) => !form.sport_id || c.sport_id === form.sport_id),
    [competitions, form.sport_id],
  );

  const selectedAthleteForCheck = useMemo(
    () => athletes.find((a) => a.id === form.entity_id) ?? null,
    [athletes, form.entity_id],
  );

  // Create accreditation automatically when a person is selected
  const createAutoAccreditation = async (
    personId: string,
    roleCode: string,
    fullName: string,
  ) => {
    const { error } = await supabase.from("accreditations").insert({
      game_id: gameId,
      person_id: personId,
      full_name: fullName,
      status: "draft",
      role_code: roleCode,
    });
    if (error && !error.message.includes("duplicate")) {
      toast.warning("Accréditation automatique non créée", { description: friendlyError(error) });
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.entity_id && !form.person_id) {
      toast.error("Veuillez sélectionner une personne");
      return;
    }
    // Vérification d'âge si une épreuve est choisie (athletes only)
    if (entityType === "athlete" && form.game_competition_id) {
      const comp = competitions.find((c) => c.id === form.game_competition_id);
      const ageCheck = checkAgeEligibility(
        selectedAthleteForCheck?.birth_date,
        comp?.min_age,
        comp?.max_age,
        comp?.competition_date,
      );
      if (!ageCheck.eligible) {
        toast.error("Sélection impossible — âge non éligible", { description: ageCheck.reason });
        return;
      }
    }
    setSaving(true);

    let payload: Record<string, unknown>;
    if (entityType === "athlete") {
      payload = {
        game_id: gameId,
        athlete_id: form.entity_id,
        sport_id: form.sport_id || null,
        discipline_id: form.discipline_id || null,
        game_competition_id: form.game_competition_id || null,
        status: "pre_selected",
      };
    } else {
      // Coach or fed member → person-based selection
      payload = {
        game_id: gameId,
        person_id: form.person_id,
        sport_id: null,
        discipline_id: null,
        game_competition_id: null,
        status: "pre_selected",
      };
    }

    const { error } = editingId
      ? await supabase.from("selections").update(
          entityType === "athlete"
            ? { athlete_id: form.entity_id, sport_id: form.sport_id || null, discipline_id: form.discipline_id || null, game_competition_id: form.game_competition_id || null }
            : { person_id: form.person_id }
        ).eq("id", editingId)
      : await supabase.from("selections").insert(payload);
    setSaving(false);
    if (error) {
      toast.error("Échec", { description: friendlyError(error) });
      return;
    }
    toast.success(editingId ? "Sélection mise à jour" : "Personne ajoutée en sélection");

    // Create auto-accreditation + conformity notification for new selections
    if (!editingId) {
      if (entityType === "athlete") {
        const personId = await getPersonIdForAthlete(form.entity_id);
        if (personId) {
          await createConformityNotification(personId, gameId, "athlete", "pre_selected");
          const athlete = athletes.find((a) => a.id === form.entity_id);
          if (athlete) {
            await createAutoAccreditation(personId, "athlete", `${athlete.first_name} ${athlete.last_name}`);
          }
        }
      } else {
        // Coach or fed member
        const person = persons.find((p) => p.id === form.person_id);
        if (person) {
          const roleCode = getPersonRoleCode(form.person_id);
          await createConformityNotification(form.person_id, gameId, roleCode, "pre_selected");
          await createAutoAccreditation(form.person_id, roleCode, `${person.first_name} ${person.last_name}`);
        }
      }
    }

    setOpen(false);
    setEditingId(null);
    setForm({ entity_id: "", person_id: "", sport_id: "", discipline_id: "", game_competition_id: "" });
    load();
  };

  const openEdit = (sel: SelectionRow) => {
    if (sel.is_locked) { toast.error("Sélection verrouillée"); return; }
    setEditingId(sel.id);
    const type = getRowType(sel);
    setEntityType(type === "athlete" ? "athlete" : "coach");
    setForm({
      entity_id: sel.athlete_id ?? "",
      person_id: sel.person_id ?? "",
      sport_id: sel.sport_id ?? "",
      discipline_id: sel.discipline_id ?? "",
      game_competition_id: sel.game_competition_id ?? "",
    });
    setOpen(true);
  };

  const changeStatus = async (sel: SelectionRow, newStatus: string) => {
    if (sel.is_locked) {
      toast.error("Sélection verrouillée");
      return;
    }
    if (newStatus === "selected") {
      // Vérification d'âge si épreuve liée (athletes only)
      if (sel.athlete_id && sel.game_competition) {
        const ageCheck = checkAgeEligibility(
          sel.athlete?.birth_date,
          sel.game_competition.min_age,
          sel.game_competition.max_age,
          sel.game_competition.competition_date,
        );
        if (!ageCheck.eligible) {
          toast.error("Sélection impossible — âge non éligible", { description: ageCheck.reason });
          return;
        }
      }
    }
    const patch: { status: string; decided_at?: string } = { status: newStatus };
    if (["selected", "reserve", "rejected"].includes(newStatus)) patch.decided_at = new Date().toISOString();
    const { error } = await supabase.from("selections").update(patch).eq("id", sel.id);
    if (error) toast.error("Échec", { description: friendlyError(error) });
    else {
      toast.success("Statut mis à jour");
      // Trigger conformity notification when selection stage changes
      if (["pre_selected", "selected", "reserve"].includes(newStatus)) {
        const type = getRowType(sel);
        if (type === "athlete" && sel.athlete_id) {
          const personId = await getPersonIdForAthlete(sel.athlete_id);
          if (personId) {
            await createConformityNotification(personId, gameId, "athlete", newStatus);
          }
        } else if (type === "person" && sel.person_id) {
          const roleCode = getPersonRoleCode(sel.person_id);
          await createConformityNotification(sel.person_id, gameId, roleCode, newStatus);
        }
      }
      load();
    }
  };

  const selectedAthlete = athletes.find((a) => a.id === form.entity_id);
  const selectedPerson = persons.find((p) => p.id === form.person_id);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative max-w-sm flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Rechercher une personne…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Type" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous types</SelectItem>
            <SelectItem value="athlete">Athlètes</SelectItem>
            <SelectItem value="person">Encadrants / Membres</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sportFilter} onValueChange={setSportFilter}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Sport" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous sports</SelectItem>
            {gameSports.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Statut" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous statuts</SelectItem>
            {SELECTION_STATUSES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button onClick={() => { setEditingId(null); setEntityType("athlete"); setForm({ entity_id: "", person_id: "", sport_id: "", discipline_id: "", game_competition_id: "" }); setOpen(true); }} className="ml-auto bg-primary hover:bg-[var(--cosl-red-dark)]">
          <Plus className="mr-2 h-4 w-4" /> Ajouter une sélection
        </Button>
      </div>

      <div className="rounded-lg border border-border bg-card">
        {rows === null ? (
          <TableSkeleton cols={7} />
        ) : filtered.length === 0 ? (
          <div className="p-6"><EmptyState message="Aucune sélection." /></div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Personne</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Sport</TableHead>
                <TableHead>Discipline</TableHead>
                <TableHead>Épreuve</TableHead>
                <TableHead>Âge</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((r) => {
                const type = getRowType(r);
                const sb = SELECTION_STATUSES.find((s) => s.value === r.status);
                return (
                  <TableRow key={r.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Avatar className="h-8 w-8">
                          {getRowAvatar(r) && <AvatarImage src={getRowAvatar(r)!} />}
                          <AvatarFallback className="text-xs">{getRowInitials(r)}</AvatarFallback>
                        </Avatar>
                        <span className="font-medium">{getRowName(r)}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {type === "athlete" ? (
                        <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">Athlète</Badge>
                      ) : (
                        <Badge className="bg-[var(--cosl-red-light)] text-primary hover:bg-[var(--cosl-red-light)]">
                          {r.person_id ? getPersonRoleLabel(r.person_id) : "Encadrant"}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>{r.sport?.name ?? "—"}</TableCell>
                    <TableCell>{r.discipline?.name ?? "—"}</TableCell>
                    <TableCell className="text-sm">
                      {r.game_competition ? (
                        <span className="font-medium text-foreground">{r.game_competition.name}</span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs">
                      {(() => {
                        if (type !== "athlete") return <span className="text-muted-foreground">—</span>;
                        const age = computeAge(r.athlete?.birth_date);
                        if (age == null) return <span className="text-muted-foreground">—</span>;
                        const comp = r.game_competition;
                        if (!comp || (comp.min_age == null && comp.max_age == null)) {
                          return <span>{age} ans</span>;
                        }
                        const chk = checkAgeEligibility(r.athlete?.birth_date, comp.min_age, comp.max_age, comp.competition_date);
                        return (
                          <span className={chk.eligible ? "text-emerald-700" : "text-red-700 font-medium"}>
                            {age} ans {chk.eligible ? "✓" : "⚠️"}
                          </span>
                        );
                      })()}
                    </TableCell>
                    <TableCell>{sb && <Badge className={`${sb.cls} hover:${sb.cls}`}>{sb.label}</Badge>}</TableCell>
                    <TableCell className="text-right">
                      {r.is_locked ? (
                        <span className="inline-flex items-center text-xs text-muted-foreground">
                          <Lock className="mr-1 h-3 w-3" /> Verrouillé
                        </span>
                      ) : (
                        <div className="flex items-center justify-end gap-2">
                          <Select value={r.status} onValueChange={(v) => changeStatus(r, v)}>
                            <SelectTrigger className="h-8 w-40"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {SELECTION_STATUSES.map((s) => (
                                <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(r)} title="Modifier">
                            <Pencil className="h-4 w-4" />
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

      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setEditingId(null); setForm({ entity_id: "", person_id: "", sport_id: "", discipline_id: "", game_competition_id: "" }); } }}>
        <DialogContent>
          <form onSubmit={submit}>
            <DialogHeader>
              <DialogTitle>{editingId ? "Modifier la sélection" : "Ajouter une sélection"}</DialogTitle>
              <DialogDescription>{editingId ? "Modifiez la personne, le sport ou la discipline." : "La personne sera créée en statut Pré-sélectionné. Une accréditation sera automatiquement créée."}</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              {/* Entity type selector */}
              <div className="space-y-1.5">
                <Label>Type de personne</Label>
                <Select value={entityType} onValueChange={(v) => { setEntityType(v as EntityType); setForm({ entity_id: "", person_id: "", sport_id: "", discipline_id: "", game_competition_id: "" }); }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ENTITY_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              {entityType === "athlete" ? (
                <>
                  <div className="space-y-1.5">
                    <Label>Athlète *</Label>
                    <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
                      <PopoverTrigger asChild>
                        <Button type="button" variant="outline" className="w-full justify-between">
                          {selectedAthlete
                            ? `${selectedAthlete.first_name} ${selectedAthlete.last_name}`
                            : "Choisir un athlète…"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="p-0 w-[400px]" align="start">
                        <Command>
                          <CommandInput placeholder="Rechercher par nom…" />
                          <CommandList>
                            <CommandEmpty>Aucun athlète trouvé.</CommandEmpty>
                            <CommandGroup>
                              {availableAthletes.map((a) => (
                                <CommandItem
                                  key={a.id}
                                  value={`${a.first_name} ${a.last_name}`}
                                  onSelect={() => {
                                    setForm({ ...form, entity_id: a.id, sport_id: a.primary_sport_id ?? "" });
                                    setPickerOpen(false);
                                  }}
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
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label>Sport</Label>
                      <Select value={form.sport_id} onValueChange={(v) => setForm({ ...form, sport_id: v, discipline_id: "" })}>
                        <SelectTrigger><SelectValue placeholder="Sport…" /></SelectTrigger>
                        <SelectContent>
                          {gameSports.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Discipline</Label>
                      <Select value={form.discipline_id || "none"} onValueChange={(v) => setForm({ ...form, discipline_id: v === "none" ? "" : v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">—</SelectItem>
                          {formDisciplines.map((d) => (
                            <SelectItem key={d.id} value={d.id}>{d.name} ({d.gender})</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Épreuve</Label>
                    <Select
                      value={form.game_competition_id || "none"}
                      onValueChange={(v) => setForm({ ...form, game_competition_id: v === "none" ? "" : v })}
                    >
                      <SelectTrigger><SelectValue placeholder="Aucune épreuve…" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">— Aucune (Games en général)</SelectItem>
                        {formCompetitions.map((c) => {
                          const chk = checkAgeEligibility(
                            selectedAthleteForCheck?.birth_date,
                            c.min_age,
                            c.max_age,
                            c.competition_date,
                          );
                          const label = `${c.name}${c.min_age != null || c.max_age != null ? ` · âge ${c.min_age ?? "?"}–${c.max_age ?? "?"}` : ""}`;
                          return (
                            <SelectItem key={c.id} value={c.id}>
                              {selectedAthleteForCheck && !chk.eligible ? "❌ " : ""}
                              {label}
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  </div>
                </>
              ) : (
                <div className="space-y-1.5">
                  <Label>Personne *</Label>
                  <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
                    <PopoverTrigger asChild>
                      <Button type="button" variant="outline" className="w-full justify-between">
                        {selectedPerson
                          ? `${selectedPerson.first_name} ${selectedPerson.last_name} (${getPersonRoleLabel(selectedPerson.id)})`
                          : "Choisir une personne…"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="p-0 w-[400px]" align="start">
                      <Command>
                        <CommandInput placeholder="Rechercher par nom…" />
                        <CommandList>
                          <CommandEmpty>Aucune personne trouvée.</CommandEmpty>
                          <CommandGroup>
                            {availablePersons.map((p) => (
                              <CommandItem
                                key={p.id}
                                value={`${p.first_name} ${p.last_name}`}
                                onSelect={() => {
                                  setForm({ ...form, person_id: p.id, entity_id: "" });
                                  setPickerOpen(false);
                                }}
                              >
                                {p.first_name} {p.last_name}
                                <span className="ml-auto text-xs text-muted-foreground">{getPersonRoleLabel(p.id)}</span>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
              <Button type="submit" disabled={saving} className="bg-primary hover:bg-[var(--cosl-red-dark)]">
                {saving ? "Enregistrement…" : editingId ? "Enregistrer" : "Ajouter"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}