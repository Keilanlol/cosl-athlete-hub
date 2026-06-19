import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { friendlyError } from "@/lib/error-messages";
import { useEffect, useMemo, useState } from "react";
import { Search, UserRound, Building2, Shield } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
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
import { EmptyState } from "@/components/DataTableShell";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { AddPersonButton } from "@/components/persons/AddPersonButton";
import { MemberFormDialog } from "@/components/forms/MemberFormDialog";

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
  const [orgType, setOrgType] = useState<"fed" | "club">("fed");
  const [selectedOrgId, setSelectedOrgId] = useState("");
  const [editingMember, setEditingMember] = useState<
    | (FederationMember & { _kind: "fed" })
    | (ClubMember & { _kind: "club" })
    | null
  >(null);
  const [persons, setPersons] = useState<PersonLite[]>([]);

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

  const openCreate = () => {
    setEditingMember(null);
    setSelectedOrgId("");
    setOrgType("fed");
    setCreateOpen(true);
  };

  const openEdit = (row: Row) => {
    setOrgType(row.kind);
    setSelectedOrgId(row.orgId);
    setEditingMember({ ...row.data, _kind: row.kind } as never);
    setCreateOpen(true);
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
        <div className="flex gap-2">
          <Button
            onClick={openCreate}
            className="bg-primary hover:bg-[var(--cosl-red-dark)]"
          >
            Ajouter un membre
          </Button>
          <AddPersonButton
            role="club_member"
            label="Ajouter via personne"
            onChanged={() => load()}
          />
        </div>
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
                <TableHead className="w-20 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => {
                const m = r.data;
                const to =
                  r.kind === "fed"
                    ? "/federations/members/$memberId"
                    : "/clubs/members/$memberId";
                return (
                  <TableRow
                    key={`${r.kind}:${m.id}`}
                    onClick={() => navigate({ to, params: { memberId: m.id } })}
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
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEdit(r)}
                      >
                        Modifier
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>

      {createOpen && selectedOrgId && (
        <MemberFormDialog
          kind={orgType}
          open={createOpen}
          onOpenChange={setCreateOpen}
          orgId={selectedOrgId}
          orgName={
            orgType === "fed"
              ? feds.find((f) => f.id === selectedOrgId)?.acronym ?? "Fédération"
              : clubs.find((c) => c.id === selectedOrgId)?.name ?? "Club"
          }
          editing={
            editingMember
              ? {
                  id: editingMember.id,
                  first_name: editingMember.first_name,
                  last_name: editingMember.last_name,
                  role: editingMember.role,
                  email: editingMember.email,
                  phone: editingMember.phone,
                  street: editingMember.street,
                  postcode: editingMember.postcode,
                  city: editingMember.city,
                  country: editingMember.country,
                  start_date: editingMember.start_date,
                  end_date: editingMember.end_date,
                  notes: editingMember.notes,
                  is_active: editingMember.is_active,
                }
              : null
          }
          persons={persons}
          onSaved={() => {
            setCreateOpen(false);
            setEditingMember(null);
            load();
          }}
        />
      )}

      {/* Org selector when no orgId selected yet */}
      {createOpen && !selectedOrgId && (
        <OrgPickerDialog
          open={createOpen}
          onOpenChange={setCreateOpen}
          orgType={orgType}
          setOrgType={setOrgType}
          feds={feds}
          clubs={clubs}
          onPick={(id) => setSelectedOrgId(id)}
        />
      )}
    </div>
  );
}

function OrgPickerDialog({
  open,
  onOpenChange,
  orgType,
  setOrgType,
  feds,
  clubs,
  onPick,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  orgType: "fed" | "club";
  setOrgType: (v: "fed" | "club") => void;
  feds: Federation[];
  clubs: Club[];
  onPick: (id: string) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Choisir une organisation</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 py-4">
          <div className="flex gap-3">
            <Button
              type="button"
              variant={orgType === "fed" ? "default" : "outline"}
              className={orgType === "fed" ? "bg-primary hover:bg-[var(--cosl-red-dark)]" : ""}
              onClick={() => setOrgType("fed")}
            >
              Fédération
            </Button>
            <Button
              type="button"
              variant={orgType === "club" ? "default" : "outline"}
              className={orgType === "club" ? "bg-primary hover:bg-[var(--cosl-red-dark)]" : ""}
              onClick={() => setOrgType("club")}
            >
              Club
            </Button>
          </div>
          <div className="max-h-[300px] overflow-y-auto rounded-md border border-border">
            {orgType === "fed"
              ? feds.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-muted border-b border-border last:border-0"
                    onClick={() => onPick(f.id)}
                  >
                    <span className="font-mono text-sm font-medium">{f.acronym}</span>
                    <span className="text-sm text-muted-foreground">{f.name}</span>
                  </button>
                ))
              : clubs.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-muted border-b border-border last:border-0"
                    onClick={() => onPick(c.id)}
                  >
                    <span className="text-sm font-medium">{c.name}</span>
                  </button>
                ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}