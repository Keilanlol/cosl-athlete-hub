import { createFileRoute, Link } from "@tanstack/react-router";
import { friendlyError } from "@/lib/error-messages";
import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2, Pencil, Download, UserCircle, Search, ExternalLink, Check, ChevronsUpDown } from "lucide-react";
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
import { useTypeGroup } from "@/hooks/useTypeItems";
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export const Route = createFileRoute("/_authenticated/games/$id/delegation")({
  component: DelegationPage,
});

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
  person_id: string | null;
  athlete_id: string | null; coach_id: string | null;
  member_role: string | null;
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
  const coachRolesHook = useTypeGroup("coach_roles");
  const fedMemberRolesHook = useTypeGroup("federation_member_roles");
  const [delegation, setDelegation] = useState<Delegation | null>(null);
  const [members, setMembers] = useState<Member[] | null>(null);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [persons, setPersons] = useState<PersonLite[]>([]);
  const [coachProfiles, setCoachProfiles] = useState<CoachProfileLite[]>([]);
  const [fedMemberProfiles, setFedMemberProfiles] = useState<{ person_id: string; role: string }[]>([]);
  const [athletePersonIds, setAthletePersonIds] = useState<Set<string>>(new Set());
  const [game, setGame] = useState<{ name: string; short_name: string | null; edition_year: number } | null>(null);

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
    const [mRes, uRes, gRes, pRes, cpRes, fmRes, apRes] = await Promise.all([
      supabase.from("delegation_members")
        .select("*, person:persons(id,first_name,last_name,email)")
        .eq("delegation_id", del.id),
      supabase.from("user_profiles").select("id,full_name,username").order("full_name"),
      supabase.from("games").select("name,short_name,edition_year").eq("id", gameId).maybeSingle(),
      supabase.from("persons").select("id,first_name,last_name,email").eq("is_active", true).order("last_name"),
      supabase.from("coach_profiles").select("id,person_id,role,is_active").eq("is_active", true),
      supabase.from("federation_member_profiles").select("person_id,role").eq("is_active", true),
      supabase.from("athlete_profiles").select("person_id").eq("is_active", true),
    ]);
    setMembers(((mRes.data ?? []) as unknown) as Member[]);
    setUsers((uRes.data ?? []) as UserProfile[]);
    setGame((gRes.data ?? null) as { name: string; short_name: string | null; edition_year: number } | null);
    setPersons((pRes.data ?? []) as PersonLite[]);
    setCoachProfiles((cpRes.data ?? []) as CoachProfileLite[]);
    setFedMemberProfiles((fmRes.data ?? []) as { person_id: string; role: string }[]);
    setAthletePersonIds(new Set(((apRes.data ?? []) as { person_id: string }[]).map((a) => a.person_id)));
    setChiefId(del.chief_of_mission_id ?? "");
    setMgrId(del.games_manager_id ?? "");
  };

  useEffect(() => { load(); }, [gameId]);

  const chief = persons.find((p) => p.id === delegation?.chief_of_mission_id);
  const manager = users.find((u) => u.id === delegation?.games_manager_id);

  // Build person options: ALL active persons with their role(s) shown next to name
  const personOptions = useMemo(() => {
    return persons
      .map((p) => {
        const roles: string[] = [];
        if (athletePersonIds.has(p.id)) roles.push("Athlète");
        const coachRoles = coachProfiles
          .filter((c) => c.person_id === p.id)
          .map((c) => coachRolesHook.getLabel(c.role));
        const fedRoles = fedMemberProfiles
          .filter((f) => f.person_id === p.id)
          .map((f) => fedMemberRolesHook.getLabel(f.role));
        roles.push(...coachRoles, ...fedRoles);
        return {
          id: p.id,
          label: `${p.first_name} ${p.last_name}${roles.length > 0 ? ` (${roles.join(", ")})` : ""}`,
        };
      });
  }, [persons, coachProfiles, fedMemberProfiles, athletePersonIds]);

  // Get all roles for the selected person (athlete + coach + fed_member)
  const selectedPersonRoles = useMemo(() => {
    if (!memberPersonId) return [];
    const roles: { code: string; label: string }[] = [];
    if (athletePersonIds.has(memberPersonId)) roles.push({ code: "athlete", label: "Athlète" });
    coachProfiles
      .filter((c) => c.person_id === memberPersonId)
      .forEach((c) => roles.push({ code: c.role, label: coachRolesHook.getLabel(c.role) }));
    fedMemberProfiles
      .filter((f) => f.person_id === memberPersonId)
      .forEach((f) => roles.push({ code: f.role, label: fedMemberRolesHook.getLabel(f.role) }));
    return roles;
  }, [memberPersonId, coachProfiles, fedMemberProfiles, athletePersonIds]);

  // Get role label for a member in the table
  const getMemberRoleLabel = (m: Member): string => {
    if (m.member_role) return m.member_role;
    if (m.person_id) {
      const roles: string[] = [];
      if (athletePersonIds.has(m.person_id)) roles.push("Athlète");
      const coach = coachProfiles.find((c) => c.person_id === m.person_id);
      if (coach) roles.push(coachRolesHook.getLabel(coach.role));
      const fm = fedMemberProfiles.find((f) => f.person_id === m.person_id);
      if (fm) roles.push(fedMemberRolesHook.getLabel(fm.role));
      return roles.length > 0 ? roles.join(", ") : "—";
    }
    return "—";
  };

  const filtered = useMemo(() => {
    if (!members) return [];
    const q = search.trim().toLowerCase();
    return members.filter((m) => {
      if (q) {
        const name = m.person
          ? `${m.person.first_name} ${m.person.last_name}`
          : "";
        if (!name.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [members, search]);

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
    const person = persons.find((p) => p.id === memberPersonId);
    if (!person) return;

    setSaving(true);
    const payload = {
      delegation_id: delegation.id,
      person_id: memberPersonId,
      athlete_id: null,
      coach_id: null,
      member_role: selectedRoleCode || (selectedPersonRoles.length === 1 ? selectedPersonRoles[0].code : null),
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
    const header = ["Nom", "Prénom", "Rôle", "Email"];
    const lines = members.map((m) => {
      return [
        m.person?.last_name ?? "",
        m.person?.first_name ?? "",
        getMemberRoleLabel(m),
        m.person?.email ?? "",
      ];
    });
    if (chief) {
      lines.unshift([chief.last_name, chief.first_name, "Chef de Mission", chief.email ?? ""]);
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

  const getMemberName = (m: Member): string => {
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
        <span className="text-sm text-muted-foreground">{filtered.length} membre(s)</span>
        <div className="ml-auto flex gap-2">
          <Button variant="outline" onClick={exportCsv}>
            <Download className="mr-2 h-4 w-4" /> Exporter liste officielle CSV
          </Button>
          <Button
            onClick={() => { setMemberPersonId(""); setSelectedRoleCode(""); setMemberOpen(true); }}
            className="bg-primary hover:bg-[var(--cosl-red-dark)]"
          >
            <Plus className="mr-2 h-4 w-4" /> Ajouter un membre
          </Button>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card">
        {members === null ? (
          <TableSkeleton cols={4} />
        ) : filtered.length === 0 ? (
          <div className="p-6"><EmptyState message="Aucun membre dans la délégation." /></div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nom</TableHead>
                <TableHead>Rôle</TableHead>
                <TableHead>Email</TableHead>
                <TableHead className="w-28 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((m) => (
                <TableRow key={m.id}>
                  <TableCell className="font-medium">{getMemberName(m)}</TableCell>
                  <TableCell>{getMemberRoleLabel(m)}</TableCell>
                  <TableCell className="text-muted-foreground">{m.person?.email ?? "—"}</TableCell>
                  <TableCell className="text-right">
                    {m.person_id && (
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
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Chief dialog */}
      <Dialog open={chiefOpen} onOpenChange={setChiefOpen}>
        <DialogContent className="sm:max-w-lg overflow-hidden">
          <DialogHeader>
            <DialogTitle>Chef de Mission</DialogTitle>
            <DialogDescription>Sélectionner une personne comme Chef de Mission.</DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <PersonRoleCombobox
              value={chiefId}
              onChange={setChiefId}
              options={personOptions}
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

      {/* Member dialog — encadrants only, role shown in dropdown */}
      <Dialog open={memberOpen} onOpenChange={setMemberOpen}>
        <DialogContent>
          <form onSubmit={submitMember}>
            <DialogHeader>
              <DialogTitle>Ajouter un membre à la délégation</DialogTitle>
              <DialogDescription>
                La délégation est la liste officielle des personnes validées et présentes au Games. Le rôle est détecté automatiquement depuis le profil.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-1.5">
                <Label>Personne *</Label>
                <PersonRoleCombobox
                  value={memberPersonId}
                  onChange={(id) => { setMemberPersonId(id); setSelectedRoleCode(""); }}
                  options={personOptions}
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
                          <SelectItem key={r.code} value={r.code}>{r.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
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

// Inline combobox that shows role labels next to person names
function PersonRoleCombobox({
  value,
  onChange,
  options,
  placeholder = "Choisir…",
}: {
  value: string;
  onChange: (id: string) => void;
  options: { id: string; label: string }[];
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.id === value);

  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
    >
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal overflow-hidden"
        >
          <span className={`truncate text-left min-w-0 flex-1 block ${!selected && "text-muted-foreground"}`}>
            {selected ? selected.label : placeholder}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[--radix-popover-trigger-width] min-w-[min(400px,calc(100vw-2rem))] max-w-[min(640px,calc(100vw-2rem))] overflow-x-hidden p-0"
        align="start"
        sideOffset={4}
      >
        <Command>
          <CommandInput placeholder="Rechercher…" />
          <CommandList className="max-h-[300px] overflow-y-auto overscroll-contain">
            <CommandEmpty>Aucun encadrant trouvé.</CommandEmpty>
            <CommandGroup>
              {options.slice(0, 300).map((o) => (
                <CommandItem
                  key={o.id}
                  value={`${o.label} ${o.id}`}
                  onSelect={() => {
                    onChange(o.id);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={`mr-2 h-4 w-4 shrink-0 ${value === o.id ? "opacity-100" : "opacity-0"}`}
                  />
                  <span className="min-w-0 truncate">{o.label}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}