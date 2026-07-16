import { createFileRoute, Link } from "@tanstack/react-router";
import { friendlyError } from "@/lib/error-messages";
import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2, Pencil, Download, UserCircle, Search, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { confirmAction } from "@/components/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { TableSkeleton, EmptyState } from "@/components/DataTableShell";
import { COACH_ROLES } from "@/lib/types";
import { coachRoleLabel, federationMemberRoleLabel } from "@/lib/role-labels";
import { PersonCombobox } from "@/components/PersonCombobox";

export const Route = createFileRoute("/_authenticated/games/$id/delegation")({
  component: DelegationPage,
});

type Athlete = {
  id: string; first_name: string; last_name: string; gender: string;
  cosl_id: string; birth_date: string;
  primary_sport_id: string | null;
};
type UserProfile = { id: string; full_name: string; username: string };
type Sport = { id: string; name: string };
type Delegation = {
  id: string; game_id: string;
  chief_of_mission_id: string | null;
  games_manager_id: string | null;
  notes: string | null;
};
type Member = {
  id: string; delegation_id: string;
  athlete_id: string | null; coach_id: string | null; person_id: string | null;
  member_role: string | null; member_function: string | null;
  athlete: Athlete | null;
  person: { id: string; first_name: string; last_name: string; email: string | null } | null;
};

type PersonLite = {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
};

type CoachProfileLite = {
  id: string;
  person_id: string;
  role: string;
  is_active: boolean;
};

function DelegationPage() {
  const { id: gameId } = Route.useParams();
  const [delegation, setDelegation] = useState<Delegation | null>(null);
  const [members, setMembers] = useState<Member[] | null>(null);
  const [athletes, setAthletes] = useState<Athlete[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [sports, setSports] = useState<Sport[]>([]);
  const [persons, setPersons] = useState<PersonLite[]>([]);
  const [coachProfiles, setCoachProfiles] = useState<CoachProfileLite[]>([]);
  const [fedMemberProfiles, setFedMemberProfiles] = useState<{ person_id: string; role: string }[]>([]);
  const [game, setGame] = useState<{ name: string; short_name: string | null; edition_year: number } | null>(null);

  const [typeFilter, setTypeFilter] = useState("all");
  const [sportFilter, setSportFilter] = useState("all");
  const [search, setSearch] = useState("");

  // Chief / Manager dialogs
  const [chiefOpen, setChiefOpen] = useState(false);
  const [chiefId, setChiefId] = useState<string>("");
  const [mgrOpen, setMgrOpen] = useState(false);
  const [mgrId, setMgrId] = useState<string>("");

  // Member dialog
  const [memberOpen, setMemberOpen] = useState(false);
  const [memberPersonId, setMemberPersonId] = useState("");
  const [selectedRoleCode, setSelectedRoleCode] = useState("");
  const [saving, setSaving] = useState(false);

  const ensureDelegation = async (): Promise<Delegation | null> => {
    const { data: existing } = await supabase.from("delegations").select("*").eq("game_id", gameId).maybeSingle();
    if (existing) return existing as Delegation;
    const { data: created, error } = await supabase.from("delegations").insert({ game_id: gameId }).select().single();
    if (error) {
      toast.error("Erreur création délégation", { description: friendlyError(error) });
      return null;
    }
    return created as Delegation;
  };

  const load = async () => {
    setMembers(null);
    const del = await ensureDelegation();
    if (!del) return;
    setDelegation(del);
    const [mRes, uRes, aRes, sRes, gRes, pRes, cpRes, fmRes] = await Promise.all([
      supabase.from("delegation_members")
        .select("*, athlete:athletes(id,first_name,last_name,gender,cosl_id,birth_date,primary_sport_id), person:persons(id,first_name,last_name,email)")
        .eq("delegation_id", del.id),
      supabase.from("user_profiles").select("id,full_name,username").order("full_name"),
      supabase.from("athletes").select("id,first_name,last_name,gender,cosl_id,birth_date,primary_sport_id").eq("is_active", true).order("last_name"),
      supabase.from("sports").select("id,name").order("name"),
      supabase.from("games").select("name,short_name,edition_year").eq("id", gameId).maybeSingle(),
      supabase.from("persons").select("id,first_name,last_name,email").eq("is_active", true).order("last_name"),
      supabase.from("coach_profiles").select("id,person_id,role,is_active").eq("is_active", true),
      supabase.from("federation_member_profiles").select("person_id,role").eq("is_active", true),
    ]);
    setMembers(((mRes.data ?? []) as unknown) as Member[]);
    setUsers((uRes.data ?? []) as UserProfile[]);
    setAthletes((aRes.data ?? []) as Athlete[]);
    setSports((sRes.data ?? []) as Sport[]);
    setGame((gRes.data ?? null) as { name: string; short_name: string | null; edition_year: number } | null);
    setPersons((pRes.data ?? []) as PersonLite[]);
    setCoachProfiles((cpRes.data ?? []) as CoachProfileLite[]);
    setFedMemberProfiles((fmRes.data ?? []) as { person_id: string; role: string }[]);
    setChiefId(del.chief_of_mission_id ?? "");
    setMgrId(del.games_manager_id ?? "");
  };

  useEffect(() => { load(); }, [gameId]);

  const sportName = (sid: string | null) => sid ? sports.find((s) => s.id === sid)?.name ?? "—" : "—";
  const chief = persons.find((p) => p.id === delegation?.chief_of_mission_id);
  const manager = users.find((u) => u.id === delegation?.games_manager_id);

  const personOptions = useMemo(
    () => persons.map((p) => ({
      id: p.id,
      label: `${p.first_name} ${p.last_name}${p.email ? ` — ${p.email}` : ""}`,
    })),
    [persons],
  );

  // Get all roles for the selected person (from coach_profiles + fed_member_profiles)
  const selectedPersonRoles = useMemo(() => {
    if (!memberPersonId) return [];
    const coachRoles = coachProfiles
      .filter((c) => c.person_id === memberPersonId)
      .map((c) => ({ code: c.role, label: coachRoleLabel(c.role), source: "coach" as const }));
    const fedRoles = fedMemberProfiles
      .filter((f) => f.person_id === memberPersonId)
      .map((f) => ({ code: f.role, label: federationMemberRoleLabel(f.role), source: "federation_member" as const }));
    return [...coachRoles, ...fedRoles];
  }, [memberPersonId, coachProfiles, fedMemberProfiles]);

  // Get role label for a member in the table
  const getMemberRoleLabel = (m: Member): string => {
    if (m.athlete_id && m.athlete) {
      return "Athlète";
    }
    if (m.person_id) {
      const coach = coachProfiles.find((c) => c.person_id === m.person_id);
      if (coach) return coachRoleLabel(coach.role);
      const fm = fedMemberProfiles.find((f) => f.person_id === m.person_id);
      if (fm) return federationMemberRoleLabel(fm.role);
      return m.member_role ?? "Membre";
    }
    return m.member_role ?? "—";
  };

  const filtered = useMemo(() => {
    if (!members) return [];
    const q = search.trim().toLowerCase();
    return members.filter((m) => {
      const t = m.athlete_id ? "athlete" : "person";
      if (typeFilter !== "all" && t !== typeFilter) return false;
      if (sportFilter !== "all") {
        const sid = m.athlete?.primary_sport_id ?? null;
        if (sid !== sportFilter) return false;
      }
      if (q) {
        const name = m.athlete
          ? `${m.athlete.first_name} ${m.athlete.last_name}`
          : m.person
          ? `${m.person.first_name} ${m.person.last_name}`
          : "";
        if (!name.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [members, typeFilter, sportFilter, search]);

  const saveChief = async () => {
    if (!delegation) return;
    const { error } = await supabase.from("delegations")
      .update({ chief_of_mission_id: chiefId || null }).eq("id", delegation.id);
    if (error) toast.error("Échec", { description: friendlyError(error) });
    else { toast.success("Chef de Mission défini"); setChiefOpen(false); load(); }
  };

  const saveManager = async () => {
    if (!delegation) return;
    const { error } = await supabase.from("delegations")
      .update({ games_manager_id: mgrId || null }).eq("id", delegation.id);
    if (error) toast.error("Échec", { description: friendlyError(error) });
    else { toast.success("Games Manager défini"); setMgrOpen(false); load(); }
  };

  const submitMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!delegation || !memberPersonId) {
      toast.error("Veuillez sélectionner une personne");
      return;
    }
    // For athletes, use athlete_id; for others, use person_id
    const person = persons.find((p) => p.id === memberPersonId);
    if (!person) return;

    // Check if this person is an athlete (has athlete_profile)
    const { data: ap } = await supabase
      .from("athlete_profiles")
      .select("legacy_athlete_id")
      .eq("person_id", memberPersonId)
      .maybeSingle();
    const legacyAthleteId = (ap as { legacy_athlete_id?: string } | null)?.legacy_athlete_id ?? null;

    setSaving(true);
    const payload = {
      delegation_id: delegation.id,
      athlete_id: legacyAthleteId ?? null,
      coach_id: null,
      person_id: !legacyAthleteId ? memberPersonId : null,
      member_role: selectedRoleCode || null,
      member_function: null,
    };
    const { error } = await supabase.from("delegation_members").insert(payload);
    setSaving(false);
    if (error) {
      toast.error("Échec", { description: friendlyError(error) });
      return;
    }
    toast.success("Membre ajouté à la délégation");
    setMemberOpen(false);
    setMemberPersonId("");
    setSelectedRoleCode("");
    load();
  };

  const removeMember = async (m: Member) => {
    if (!(await confirmAction({ title: "Retirer ce membre ?", description: "Le membre sera retiré de la délégation.", confirmLabel: "Retirer" }))) return;
    const { error } = await supabase.from("delegation_members").delete().eq("id", m.id);
    if (error) toast.error("Échec", { description: friendlyError(error) });
    else { toast.success("Membre retiré"); load(); }
  };

  const exportCsv = () => {
    if (!members || !game) return;
    const header = [
      "Type", "COSL ID", "Nom", "Prénom", "Genre",
      "Date de naissance", "Sport", "Rôle",
    ];
    const lines = members.map((m) => {
      if (m.athlete) {
        return [
          "Athlète", m.athlete.cosl_id, m.athlete.last_name, m.athlete.first_name,
          m.athlete.gender, m.athlete.birth_date, sportName(m.athlete.primary_sport_id),
          "Athlète",
        ];
      }
      return [
        "Personne", "", m.person?.last_name ?? "", m.person?.first_name ?? "",
        "", "", "", getMemberRoleLabel(m),
      ];
    });
    if (chief) {
      lines.unshift([
        "Chef de Mission", "", chief.last_name, chief.first_name, "", "", "", "Chef de Mission",
      ]);
    }
    const csv = [header, ...lines]
      .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `delegation_officielle_${(game.short_name ?? game.name).replace(/\W+/g, "_")}_${game.edition_year}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Export CSV généré");
  };

  const initials = (a: { first_name: string; last_name: string } | null | undefined) =>
    `${a?.first_name?.[0] ?? ""}${a?.last_name?.[0] ?? ""}`;

  // Get the name of a member
  const getMemberName = (m: Member): string => {
    if (m.athlete) return `${m.athlete.first_name} ${m.athlete.last_name}`;
    if (m.person) return `${m.person.first_name} ${m.person.last_name}`;
    return "—";
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-lg border border-border bg-card p-5">
          <div className="flex items-start gap-4">
            <Avatar className="h-14 w-14"><AvatarFallback>{chief ? initials(chief) : <UserCircle className="h-6 w-6" />}</AvatarFallback></Avatar>
            <div className="flex-1">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Chef de Mission</p>
              <p className="text-lg font-semibold text-foreground">
                {chief ? `${chief.first_name} ${chief.last_name}` : "Non désigné"}
              </p>
              {chief?.email && <p className="text-sm text-muted-foreground truncate">{chief.email}</p>}
            </div>
            <Button size="sm" variant="outline" onClick={() => setChiefOpen(true)}>
              <Pencil className="mr-2 h-3.5 w-3.5" /> {chief ? "Modifier" : "Désigner"}
            </Button>
          </div>
        </div>
        <div className="rounded-lg border border-border bg-card p-5">
          <div className="flex items-start gap-4">
            <Avatar className="h-14 w-14"><AvatarFallback>{manager ? manager.full_name.split(" ").map((s) => s[0]).slice(0, 2).join("") : <UserCircle className="h-6 w-6" />}</AvatarFallback></Avatar>
            <div className="flex-1">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Games Manager COSL</p>
              <p className="text-lg font-semibold text-foreground">
                {manager ? manager.full_name : "Non désigné"}
              </p>
              {manager && <p className="text-sm text-muted-foreground">@{manager.username}</p>}
            </div>
            <Button size="sm" variant="outline" onClick={() => setMgrOpen(true)}>
              <Pencil className="mr-2 h-3.5 w-3.5" /> {manager ? "Modifier" : "Désigner"}
            </Button>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Rechercher par nom…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
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
            {sports.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <span className="text-sm text-muted-foreground">{filtered.length} membre(s)</span>
        <div className="ml-auto flex gap-2">
          <Button variant="outline" onClick={exportCsv}>
            <Download className="mr-2 h-4 w-4" /> Exporter liste officielle CSV
          </Button>
          <Button onClick={() => { setMemberPersonId(""); setSelectedRoleCode(""); setMemberOpen(true); }} className="bg-primary hover:bg-[var(--cosl-red-dark)]">
            <Plus className="mr-2 h-4 w-4" /> Ajouter un membre
          </Button>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card">
        {members === null ? (
          <TableSkeleton cols={5} />
        ) : filtered.length === 0 ? (
          <div className="p-6"><EmptyState message="Aucun membre dans la délégation." /></div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead>Nom</TableHead>
                <TableHead>Rôle</TableHead>
                <TableHead>Sport</TableHead>
                <TableHead className="w-28 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((m) => {
                const isAth = !!m.athlete_id;
                return (
                  <TableRow key={m.id}>
                    <TableCell>
                      <Badge className={isAth ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-100" : "bg-[var(--cosl-red-light)] text-primary hover:bg-[var(--cosl-red-light)]"}>
                        {isAth ? "Athlète" : "Encadrant / Membre"}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-medium">{getMemberName(m)}</TableCell>
                    <TableCell>{getMemberRoleLabel(m)}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {isAth ? sportName(m.athlete?.primary_sport_id ?? null) : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      {isAth && m.athlete && (
                        <Button asChild variant="ghost" size="icon" aria-label="Voir la fiche athlète">
                          <Link to="/athletes/$id" params={{ id: m.athlete.id }}>
                            <ExternalLink className="h-4 w-4" />
                          </Link>
                        </Button>
                      )}
                      {!isAth && m.person_id && (
                        <Button asChild variant="ghost" size="icon" aria-label="Voir la fiche personne">
                          <Link to="/persons/$personId" params={{ personId: m.person_id }}>
                            <ExternalLink className="h-4 w-4" />
                          </Link>
                        </Button>
                      )}
                      <Button variant="ghost" size="icon" onClick={() => removeMember(m)} aria-label="Retirer">
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

      {/* Chief dialog */}
      <Dialog open={chiefOpen} onOpenChange={setChiefOpen}>
        <DialogContent className="sm:max-w-lg overflow-hidden">
          <DialogHeader>
            <DialogTitle>Chef de Mission</DialogTitle>
            <DialogDescription>Sélectionner n'importe quelle personne comme Chef de Mission.</DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <PersonCombobox
              value={chiefId}
              onChange={setChiefId}
              options={personOptions}
              placeholder="— Aucun —"
              searchPlaceholder="Rechercher une personne…"
              emptyMessage="Aucune personne."
            />
            {chiefId && (
              <button
                type="button"
                onClick={() => setChiefId("")}
                className="mt-2 text-xs text-muted-foreground hover:underline"
              >
                Retirer la sélection
              </button>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setChiefOpen(false)}>Annuler</Button>
            <Button onClick={saveChief} className="bg-primary hover:bg-[var(--cosl-red-dark)]">Enregistrer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manager dialog */}
      <Dialog open={mgrOpen} onOpenChange={setMgrOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Games Manager COSL</DialogTitle>
            <DialogDescription>Sélectionner un utilisateur COSL.</DialogDescription>
          </DialogHeader>
          <Select value={mgrId || "none"} onValueChange={(v) => setMgrId(v === "none" ? "" : v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">— Aucun —</SelectItem>
              {users.map((u) => (
                <SelectItem key={u.id} value={u.id}>{u.full_name} (@{u.username})</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMgrOpen(false)}>Annuler</Button>
            <Button onClick={saveManager} className="bg-primary hover:bg-[var(--cosl-red-dark)]">Enregistrer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Member dialog — simplified: choose a person, role is auto-detected */}
      <Dialog open={memberOpen} onOpenChange={setMemberOpen}>
        <DialogContent>
          <form onSubmit={submitMember}>
            <DialogHeader>
              <DialogTitle>Ajouter un membre</DialogTitle>
              <DialogDescription>
                Choisissez une personne. Son rôle sera automatiquement détecté depuis son profil d'encadrant ou de membre de fédération.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-1.5">
                <Label>Personne *</Label>
                <PersonCombobox
                  value={memberPersonId}
                  onChange={(id) => { setMemberPersonId(id); setSelectedRoleCode(""); }}
                  options={personOptions}
                  placeholder="Choisir une personne…"
                  searchPlaceholder="Rechercher une personne…"
                  emptyMessage="Aucune personne trouvée."
                />
              </div>
              {memberPersonId && selectedPersonRoles.length > 0 && (
                <div className="space-y-1.5">
                  <Label>Rôle détecté {selectedPersonRoles.length > 1 ? "— choisir parmi les rôles" : ""}</Label>
                  {selectedPersonRoles.length === 1 ? (
                    <div className="rounded-md border border-border p-3 text-sm">
                      {selectedPersonRoles[0].label}
                    </div>
                  ) : (
                    <Select value={selectedRoleCode} onValueChange={setSelectedRoleCode}>
                      <SelectTrigger><SelectValue placeholder="Choisir un rôle…" /></SelectTrigger>
                      <SelectContent>
                        {selectedPersonRoles.map((r) => (
                          <SelectItem key={`${r.source}-${r.code}`} value={r.code}>{r.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              )}
              {memberPersonId && selectedPersonRoles.length === 0 && (
                <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                  ⚠️ Cette personne n'a aucun rôle d'encadrant ou de membre de fédération. Si c'est un athlète, il sera ajouté avec son rôle d'athlète.
                </div>
              )}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setMemberOpen(false)}>Annuler</Button>
              <Button type="submit" disabled={saving || !memberPersonId} className="bg-primary hover:bg-[var(--cosl-red-dark)]">
                {saving ? "Enregistrement…" : "Ajouter"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}