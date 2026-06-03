import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Plus, Search, UserRound, Building2, Shield } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { friendlyError } from "@/lib/error-messages";
import {
  CLUB_MEMBER_ROLES,
  FEDERATION_MEMBER_ROLES,
  type Club,
  type ClubMember,
  type Federation,
  type FederationMember,
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
import { AddressSearch } from "@/components/AddressSearch";
import { EmptyState } from "@/components/DataTableShell";
import { PersonCombobox } from "@/components/PersonCombobox";

type PersonLite = {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
};

export const Route = createFileRoute("/_authenticated/members/")({
  component: MembersPage,
});

type Row =
  | { kind: "fed"; data: FederationMember; orgId: string; orgLabel: string }
  | { kind: "club"; data: ClubMember; orgId: string; orgLabel: string };

const emptyForm = {
  org_id: "",
  role: "president",
  first_name: "",
  last_name: "",
  email: "",
  phone: "",
  street: "",
  postcode: "",
  city: "",
  country: "",
  start_date: "",
  end_date: "",
  notes: "",
  is_active: true,
};

function MembersPage() {
  const navigate = useNavigate();
  const [feds, setFeds] = useState<Federation[]>([]);
  const [clubs, setClubs] = useState<Club[]>([]);
  const [fedMembers, setFedMembers] = useState<FederationMember[]>([]);
  const [clubMembers, setClubMembers] = useState<ClubMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [scope, setScope] = useState<"all" | "fed" | "club">("all");

  const [createOpen, setCreateOpen] = useState(false);
  const [createSaving, setCreateSaving] = useState(false);
  const [orgType, setOrgType] = useState<"fed" | "club">("fed");
  const [createForm, setCreateForm] = useState(emptyForm);
  const [persons, setPersons] = useState<PersonLite[]>([]);
  const [selectedPersonId, setSelectedPersonId] = useState("");

  const load = async () => {
    const [f, c, fm, cm, pe] = await Promise.all([
      supabase.from("federations").select("*"),
      supabase.from("clubs").select("*"),
      supabase.from("federation_members").select("*").order("last_name"),
      supabase.from("club_members").select("*").order("last_name"),
      supabase
        .from("persons")
        .select("id, first_name, last_name, email, phone")
        .order("last_name"),
    ]);
    setFeds((f.data ?? []) as Federation[]);
    setClubs((c.data ?? []) as Club[]);
    setFedMembers((fm.data ?? []) as FederationMember[]);
    setClubMembers((cm.data ?? []) as ClubMember[]);
    setPersons((pe.data ?? []) as PersonLite[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const rows: Row[] = useMemo(() => {
    const fedMap = new Map(feds.map((f) => [f.id, f]));
    const clubMap = new Map(clubs.map((c) => [c.id, c]));
    const out: Row[] = [];
    if (scope !== "club") {
      for (const m of fedMembers) {
        const f = fedMap.get(m.federation_id);
        out.push({
          kind: "fed",
          data: m,
          orgId: m.federation_id,
          orgLabel: f ? `${f.acronym} — ${f.name}` : "—",
        });
      }
    }
    if (scope !== "fed") {
      for (const m of clubMembers) {
        const c = clubMap.get(m.club_id);
        out.push({
          kind: "club",
          data: m,
          orgId: m.club_id,
          orgLabel: c?.name ?? "—",
        });
      }
    }
    const needle = q.trim().toLowerCase();
    const filtered = needle
      ? out.filter((r) => {
          const m = r.data;
          return (
            `${m.first_name} ${m.last_name}`.toLowerCase().includes(needle) ||
            (m.email ?? "").toLowerCase().includes(needle) ||
            r.orgLabel.toLowerCase().includes(needle)
          );
        })
      : out;
    return filtered.sort((a, b) =>
      `${a.data.last_name}${a.data.first_name}`.localeCompare(
        `${b.data.last_name}${b.data.first_name}`,
      ),
    );
  }, [feds, clubs, fedMembers, clubMembers, q, scope]);

  const roleLabel = (kind: "fed" | "club", v: string) =>
    (kind === "fed" ? FEDERATION_MEMBER_ROLES : CLUB_MEMBER_ROLES).find(
      (r) => r.value === v,
    )?.label ?? v;

  const submitCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createForm.first_name.trim() || !createForm.last_name.trim()) {
      toast.error("Prénom et nom requis");
      return;
    }
    if (!createForm.org_id) {
      toast.error(orgType === "fed" ? "Fédération requise" : "Club requis");
      return;
    }
    setCreateSaving(true);
    const base = {
      first_name: createForm.first_name.trim(),
      last_name: createForm.last_name.trim(),
      role: createForm.role,
      email: createForm.email.trim() || null,
      phone: createForm.phone.trim() || null,
      street: createForm.street.trim() || null,
      postcode: createForm.postcode.trim() || null,
      city: createForm.city.trim() || null,
      country: createForm.country.trim() || null,
      address:
        [createForm.street, createForm.postcode, createForm.city, createForm.country]
          .filter(Boolean)
          .join(", ") || null,
      start_date: createForm.start_date || null,
      end_date: createForm.end_date || null,
      notes: createForm.notes.trim() || null,
      is_active: createForm.is_active,
    };
    const { error } =
      orgType === "fed"
        ? await supabase
            .from("federation_members")
            .insert({ ...base, federation_id: createForm.org_id })
        : await supabase
            .from("club_members")
            .insert({ ...base, club_id: createForm.org_id });
    setCreateSaving(false);
    if (error) {
      toast.error("Échec", { description: friendlyError(error) });
      return;
    }
    toast.success("Membre ajouté");
    setCreateOpen(false);
    setCreateForm(emptyForm);
    setOrgType("fed");
    load();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-white">
            <UserRound className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Membres</h1>
            <p className="text-sm text-muted-foreground">
              Membres des bureaux des fédérations et clubs.
            </p>
          </div>
        </div>
        <Button
          onClick={() => setCreateOpen(true)}
          className="bg-primary hover:bg-[var(--cosl-red-dark)]"
        >
          <Plus className="mr-2 h-4 w-4" /> Ajouter un membre
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-64">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Rechercher un membre, email, organisation…"
            className="pl-9"
          />
        </div>
        <Select value={scope} onValueChange={(v) => setScope(v as typeof scope)}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes organisations</SelectItem>
            <SelectItem value="fed">Fédérations</SelectItem>
            <SelectItem value="club">Clubs</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-lg border border-border bg-card">
        {loading ? (
          <div className="p-6 text-sm text-muted-foreground">Chargement…</div>
        ) : rows.length === 0 ? (
          <div className="p-6">
            <EmptyState message="Aucun membre." />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nom</TableHead>
                <TableHead>Fonction</TableHead>
                <TableHead>Organisation</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Téléphone</TableHead>
                <TableHead>Statut</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => {
                const m = r.data;
                const to =
                  r.kind === "fed"
                    ? "/federations/members/$memberId"
                    : "/clubs/members/$memberId";
                const onRowClick = () =>
                  navigate({ to, params: { memberId: m.id } });
                return (
                  <TableRow
                    key={`${r.kind}:${m.id}`}
                    onClick={onRowClick}
                    className="cursor-pointer hover:bg-muted"
                  >
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-full overflow-hidden bg-muted border border-border shrink-0 flex items-center justify-center">
                          {m.photo_url ? (
                            <img
                              src={m.photo_url}
                              alt=""
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <span className="text-xs font-semibold text-muted-foreground">
                              {m.first_name[0]}
                              {m.last_name[0]}
                            </span>
                          )}
                        </div>
                        <span>
                          {m.first_name} {m.last_name}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{roleLabel(r.kind, m.role)}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      <Link
                        to={r.kind === "fed" ? "/federations/$id" : "/clubs/$id"}
                        params={{ id: r.orgId }}
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex items-center gap-1.5 hover:underline"
                      >
                        {r.kind === "fed" ? (
                          <Building2 className="h-3.5 w-3.5" />
                        ) : (
                          <Shield className="h-3.5 w-3.5" />
                        )}
                        {r.orgLabel}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {m.email ?? "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {m.phone ?? "—"}
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
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <form onSubmit={submitCreate}>
            <DialogHeader>
              <DialogTitle>Ajouter un membre</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-1.5">
                <Label>Organisation *</Label>
                <div className="flex gap-3">
                  <Button
                    type="button"
                    variant={orgType === "fed" ? "default" : "outline"}
                    className={
                      orgType === "fed"
                        ? "bg-primary hover:bg-[var(--cosl-red-dark)]"
                        : ""
                    }
                    onClick={() => {
                      setOrgType("fed");
                      setCreateForm((f) => ({
                        ...f,
                        org_id: "",
                        role: "president",
                      }));
                    }}
                  >
                    Fédération
                  </Button>
                  <Button
                    type="button"
                    variant={orgType === "club" ? "default" : "outline"}
                    className={
                      orgType === "club"
                        ? "bg-primary hover:bg-[var(--cosl-red-dark)]"
                        : ""
                    }
                    onClick={() => {
                      setOrgType("club");
                      setCreateForm((f) => ({
                        ...f,
                        org_id: "",
                        role: "president",
                      }));
                    }}
                  >
                    Club
                  </Button>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>{orgType === "fed" ? "Fédération *" : "Club *"}</Label>
                <Select
                  value={createForm.org_id}
                  onValueChange={(v) =>
                    setCreateForm((f) => ({ ...f, org_id: v }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Choisir..." />
                  </SelectTrigger>
                  <SelectContent>
                    {orgType === "fed"
                      ? feds.map((f) => (
                          <SelectItem key={f.id} value={f.id}>
                            {f.acronym} — {f.name}
                          </SelectItem>
                        ))
                      : clubs.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.name}
                          </SelectItem>
                        ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Fonction *</Label>
                <Select
                  value={createForm.role}
                  onValueChange={(v) =>
                    setCreateForm((f) => ({ ...f, role: v }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(orgType === "fed"
                      ? FEDERATION_MEMBER_ROLES
                      : CLUB_MEMBER_ROLES
                    ).map((r) => (
                      <SelectItem key={r.value} value={r.value}>
                        {r.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Prénom *</Label>
                  <Input
                    value={createForm.first_name}
                    onChange={(e) =>
                      setCreateForm((f) => ({
                        ...f,
                        first_name: e.target.value,
                      }))
                    }
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Nom *</Label>
                  <Input
                    value={createForm.last_name}
                    onChange={(e) =>
                      setCreateForm((f) => ({
                        ...f,
                        last_name: e.target.value,
                      }))
                    }
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Email</Label>
                  <Input
                    type="email"
                    value={createForm.email}
                    onChange={(e) =>
                      setCreateForm((f) => ({ ...f, email: e.target.value }))
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Téléphone</Label>
                  <Input
                    value={createForm.phone}
                    onChange={(e) =>
                      setCreateForm((f) => ({ ...f, phone: e.target.value }))
                    }
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Adresse (numéro + rue)</Label>
                <AddressSearch
                  value={createForm.street}
                  onChange={(v) =>
                    setCreateForm((f) => ({ ...f, street: v }))
                  }
                  onSelect={(r) =>
                    setCreateForm((f) => ({
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
                  <Label>Code postal</Label>
                  <Input
                    value={createForm.postcode}
                    onChange={(e) =>
                      setCreateForm((f) => ({
                        ...f,
                        postcode: e.target.value,
                      }))
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Ville</Label>
                  <Input
                    value={createForm.city}
                    onChange={(e) =>
                      setCreateForm((f) => ({ ...f, city: e.target.value }))
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Pays</Label>
                  <Input
                    value={createForm.country}
                    onChange={(e) =>
                      setCreateForm((f) => ({
                        ...f,
                        country: e.target.value,
                      }))
                    }
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Début de mandat</Label>
                  <Input
                    type="date"
                    value={createForm.start_date}
                    onChange={(e) =>
                      setCreateForm((f) => ({
                        ...f,
                        start_date: e.target.value,
                      }))
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Fin de mandat</Label>
                  <Input
                    type="date"
                    value={createForm.end_date}
                    onChange={(e) =>
                      setCreateForm((f) => ({
                        ...f,
                        end_date: e.target.value,
                      }))
                    }
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Notes</Label>
                <Textarea
                  rows={2}
                  value={createForm.notes}
                  onChange={(e) =>
                    setCreateForm((f) => ({ ...f, notes: e.target.value }))
                  }
                />
              </div>

              <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
                <Label className="cursor-pointer">Membre actif</Label>
                <Switch
                  checked={createForm.is_active}
                  onCheckedChange={(v) =>
                    setCreateForm((f) => ({ ...f, is_active: v }))
                  }
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setCreateOpen(false)}
              >
                Annuler
              </Button>
              <Button
                type="submit"
                disabled={createSaving}
                className="bg-primary hover:bg-[var(--cosl-red-dark)]"
              >
                {createSaving ? "Enregistrement…" : "Ajouter"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
