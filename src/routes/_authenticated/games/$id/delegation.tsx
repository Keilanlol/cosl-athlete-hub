import { createFileRoute } from "@tanstack/react-router";
import { friendlyError } from "@/lib/error-messages";
import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2, Pencil, Download, UserCircle, Search } from "lucide-react";
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { TableSkeleton, EmptyState } from "@/components/DataTableShell";
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { COACH_ROLES } from "@/lib/types";

export const Route = createFileRoute("/_authenticated/games/$id/delegation")({
  component: DelegationPage,
});

type Athlete = {
  id: string; first_name: string; last_name: string; gender: string;
  cosl_id: string; birth_date: string;
  primary_sport_id: string | null;
};
type Coach = {
  id: string; first_name: string; last_name: string; role: string;
  federation_id: string | null;
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
  athlete_id: string | null; coach_id: string | null;
  member_role: string; member_function: string | null;
  athlete: Athlete | null; coach: Coach | null;
};

function DelegationPage() {
  const { id: gameId } = Route.useParams();
  const [delegation, setDelegation] = useState<Delegation | null>(null);
  const [members, setMembers] = useState<Member[] | null>(null);
  const [coaches, setCoaches] = useState<Coach[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [athletes, setAthletes] = useState<Athlete[]>([]);
  const [sports, setSports] = useState<Sport[]>([]);
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
  const [memberType, setMemberType] = useState<"athlete" | "coach">("athlete");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [memberForm, setMemberForm] = useState({ entity_id: "", member_role: "", member_function: "" });
  const [saving, setSaving] = useState(false);

  // Sub-dialog: create new encadrant
  const [coachOpen, setCoachOpen] = useState(false);
  const [coachForm, setCoachForm] = useState({ first_name: "", last_name: "", email: "", phone: "", role: "coach" });
  const [coachSaving, setCoachSaving] = useState(false);

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
    const [mRes, cRes, uRes, aRes, sRes, gRes] = await Promise.all([
      supabase.from("delegation_members")
        .select("*, athlete:athletes(id,first_name,last_name,gender,cosl_id,birth_date,primary_sport_id), coach:coaches(id,first_name,last_name,role,federation_id)")
        .eq("delegation_id", del.id),
      supabase.from("coaches").select("id,first_name,last_name,role,federation_id").eq("is_active", true).order("last_name"),
      supabase.from("user_profiles").select("id,full_name,username").order("full_name"),
      supabase.from("athletes").select("id,first_name,last_name,gender,cosl_id,birth_date,primary_sport_id").eq("is_active", true).order("last_name"),
      supabase.from("sports").select("id,name").order("name"),
      supabase.from("games").select("name,short_name,edition_year").eq("id", gameId).maybeSingle(),
    ]);
    setMembers(((mRes.data ?? []) as unknown) as Member[]);
    setCoaches((cRes.data ?? []) as Coach[]);
    setUsers((uRes.data ?? []) as UserProfile[]);
    setAthletes((aRes.data ?? []) as Athlete[]);
    setSports((sRes.data ?? []) as Sport[]);
    setGame((gRes.data ?? null) as { name: string; short_name: string | null; edition_year: number } | null);
    setChiefId(del.chief_of_mission_id ?? "");
    setMgrId(del.games_manager_id ?? "");
  };

  useEffect(() => { load(); }, [gameId]);

  const sportName = (sid: string | null) => sid ? sports.find((s) => s.id === sid)?.name ?? "—" : "—";
  const chief = coaches.find((c) => c.id === delegation?.chief_of_mission_id);
  const manager = users.find((u) => u.id === delegation?.games_manager_id);

  const filtered = useMemo(() => {
    if (!members) return [];
    const q = search.trim().toLowerCase();
    return members.filter((m) => {
      const t = m.athlete_id ? "athlete" : "coach";
      if (typeFilter !== "all" && t !== typeFilter) return false;
      if (sportFilter !== "all") {
        const sid = m.athlete?.primary_sport_id ?? null;
        if (sid !== sportFilter) return false;
      }
      if (q) {
        const name = m.athlete
          ? `${m.athlete.first_name} ${m.athlete.last_name}`
          : `${m.coach?.first_name ?? ""} ${m.coach?.last_name ?? ""}`;
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
    if (!delegation || !memberForm.entity_id || !memberForm.member_role.trim()) {
      toast.error("Membre et rôle requis"); return;
    }
    setSaving(true);
    const payload = {
      delegation_id: delegation.id,
      athlete_id: memberType === "athlete" ? memberForm.entity_id : null,
      coach_id: memberType === "coach" ? memberForm.entity_id : null,
      member_role: memberForm.member_role.trim(),
      member_function: memberForm.member_function.trim() || null,
    };
    const { error } = await supabase.from("delegation_members").insert(payload);
    setSaving(false);
    if (error) {
      toast.error("Échec", { description: friendlyError(error) }); return;
    }
    toast.success("Membre ajouté");
    setMemberOpen(false);
    setMemberForm({ entity_id: "", member_role: "", member_function: "" });
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
      "Date de naissance", "Sport", "Rôle", "Fonction",
    ];
    const lines = members.map((m) => {
      if (m.athlete) {
        return [
          "Athlète", m.athlete.cosl_id, m.athlete.last_name, m.athlete.first_name,
          m.athlete.gender, m.athlete.birth_date, sportName(m.athlete.primary_sport_id),
          m.member_role, m.member_function ?? "",
        ];
      }
      return [
        "Encadrant", "", m.coach?.last_name ?? "", m.coach?.first_name ?? "",
        "", "", "", m.member_role, m.member_function ?? m.coach?.role ?? "",
      ];
    });
    if (chief) {
      lines.unshift([
        "Chef de Mission", "", chief.last_name, chief.first_name, "", "", "", "Chief of Mission", chief.role,
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

  const selectedEntity = memberType === "athlete"
    ? athletes.find((a) => a.id === memberForm.entity_id)
    : coaches.find((c) => c.id === memberForm.entity_id);

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
              {chief && <p className="text-sm text-muted-foreground">{chief.role}</p>}
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
            <SelectItem value="coach">Encadrants</SelectItem>
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
          <Button onClick={() => setMemberOpen(true)} className="bg-primary hover:bg-[var(--cosl-red-dark)]">
            <Plus className="mr-2 h-4 w-4" /> Ajouter un membre
          </Button>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card">
        {members === null ? (
          <TableSkeleton cols={6} />
        ) : filtered.length === 0 ? (
          <div className="p-6"><EmptyState message="Aucun membre dans la délégation." /></div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead>Nom</TableHead>
                <TableHead>Rôle</TableHead>
                <TableHead>Fonction</TableHead>
                <TableHead>Sport</TableHead>
                <TableHead className="w-20 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((m) => {
                const isAth = !!m.athlete_id;
                const person = m.athlete ?? m.coach;
                return (
                  <TableRow key={m.id}>
                    <TableCell>
                      <Badge className={isAth ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-100" : "bg-[var(--cosl-red-light)] text-primary hover:bg-[var(--cosl-red-light)]"}>
                        {isAth ? "Athlète" : "Encadrant"}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-medium">
                      {person ? `${person.first_name} ${person.last_name}` : "—"}
                    </TableCell>
                    <TableCell>{m.member_role}</TableCell>
                    <TableCell className="text-muted-foreground">{m.member_function ?? (m.coach?.role ?? "—")}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {isAth ? sportName(m.athlete?.primary_sport_id ?? null) : "—"}
                    </TableCell>
                    <TableCell className="text-right">
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Chef de Mission</DialogTitle>
            <DialogDescription>Sélectionner un encadrant comme Chef de Mission.</DialogDescription>
          </DialogHeader>
          <Select value={chiefId || "none"} onValueChange={(v) => setChiefId(v === "none" ? "" : v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">— Aucun —</SelectItem>
              {coaches.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.first_name} {c.last_name} ({c.role})</SelectItem>
              ))}
            </SelectContent>
          </Select>
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

      {/* Member dialog */}
      <Dialog open={memberOpen} onOpenChange={setMemberOpen}>
        <DialogContent>
          <form onSubmit={submitMember}>
            <DialogHeader>
              <DialogTitle>Ajouter un membre</DialogTitle>
              <DialogDescription>Athlète ou encadrant à ajouter à la délégation.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <RadioGroup value={memberType} onValueChange={(v) => { setMemberType(v as "athlete" | "coach"); setMemberForm({ ...memberForm, entity_id: "" }); }} className="flex gap-6">
                <div className="flex items-center gap-2">
                  <RadioGroupItem id="t-ath" value="athlete" />
                  <Label htmlFor="t-ath">Athlète</Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem id="t-co" value="coach" />
                  <Label htmlFor="t-co">Encadrant</Label>
                </div>
              </RadioGroup>
              <div className="space-y-1.5">
                <Label>Personne *</Label>
                <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
                  <PopoverTrigger asChild>
                    <Button type="button" variant="outline" className="w-full justify-between">
                      {selectedEntity
                        ? `${selectedEntity.first_name} ${selectedEntity.last_name}`
                        : "Choisir…"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="p-0 w-[400px]" align="start">
                    <Command>
                      <CommandInput placeholder="Rechercher…" />
                      <CommandList>
                        <CommandEmpty>Aucun résultat.</CommandEmpty>
                        <CommandGroup>
                          {(memberType === "athlete" ? athletes : coaches).slice(0, 200).map((p) => (
                            <CommandItem
                              key={p.id}
                              value={`${p.first_name} ${p.last_name}`}
                              onSelect={() => { setMemberForm({ ...memberForm, entity_id: p.id }); setPickerOpen(false); }}
                            >
                              {p.first_name} {p.last_name}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="m-role">Rôle * (ex : Athlète, Coach principal, Médecin…)</Label>
                <Input id="m-role" value={memberForm.member_role} onChange={(e) => setMemberForm({ ...memberForm, member_role: e.target.value })} required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="m-fn">Fonction</Label>
                <Input id="m-fn" value={memberForm.member_function} onChange={(e) => setMemberForm({ ...memberForm, member_function: e.target.value })} />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setMemberOpen(false)}>Annuler</Button>
              <Button type="submit" disabled={saving} className="bg-primary hover:bg-[var(--cosl-red-dark)]">
                {saving ? "Enregistrement…" : "Ajouter"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
