import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Search, UserRound, Building2, Shield } from "lucide-react";
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

export const Route = createFileRoute("/_authenticated/members/")({
  component: MembersPage,
});

type Row =
  | {
      kind: "fed";
      data: FederationMember;
      orgId: string;
      orgLabel: string;
    }
  | {
      kind: "club";
      data: ClubMember;
      orgId: string;
      orgLabel: string;
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

  useEffect(() => {
    (async () => {
      const [f, c, fm, cm] = await Promise.all([
        supabase.from("federations").select("*"),
        supabase.from("clubs").select("*"),
        supabase
          .from("federation_members")
          .select("*")
          .order("last_name"),
        supabase.from("club_members").select("*").order("last_name"),
      ]);
      setFeds((f.data ?? []) as Federation[]);
      setClubs((c.data ?? []) as Club[]);
      setFedMembers((fm.data ?? []) as FederationMember[]);
      setClubMembers((cm.data ?? []) as ClubMember[]);
      setLoading(false);
    })();
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

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-500 text-white">
          <UserRound className="h-5 w-5" />
        </span>
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Membres</h1>
          <p className="text-sm text-slate-600">
            Membres des bureaux des fédérations et clubs.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-64">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
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

      <div className="rounded-lg border border-slate-200 bg-white">
        {loading ? (
          <div className="p-6 text-sm text-slate-500">Chargement…</div>
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
                    className="cursor-pointer hover:bg-slate-50"
                  >
                    <TableCell className="font-medium text-indigo-600">
                      {m.first_name} {m.last_name}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {roleLabel(r.kind, m.role)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-slate-600">
                      <Link
                        to={
                          r.kind === "fed" ? "/federations/$id" : "/clubs/$id"
                        }
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
                    <TableCell className="text-slate-600">
                      {m.email ?? "—"}
                    </TableCell>
                    <TableCell className="text-slate-600">
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
    </div>
  );
}
