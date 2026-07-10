import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Search, UserRound, Building2, Upload, Filter } from "lucide-react";
import { supabase } from "@/lib/supabase";
import {
  FEDERATION_MEMBER_ROLES,
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
import { EmptyState, SortBtn } from "@/components/DataTableShell";
import { AddPersonButton } from "@/components/persons/AddPersonButton";
import { CsvImportDialog } from "@/components/CsvImportDialog";
import { federationMembersImportConfig } from "@/lib/csv-import-configs";

export const Route = createFileRoute("/_authenticated/members/")({
  component: MembersPage,
});

type Row = { kind: "fed"; data: FederationMember; orgId: string; orgLabel: string };

function MembersPage() {
  const navigate = useNavigate();
  const [feds, setFeds] = useState<Federation[]>([]);
  const [fedMembers, setFedMembers] = useState<FederationMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [fedFilter, setFedFilter] = useState("all");
  const [sort, setSort] = useState<{ key: "last_name" | "first_name" | "role" | "email" | "phone" | "is_active"; dir: "asc" | "desc" }>({
    key: "last_name",
    dir: "asc",
  });
  const [importOpen, setImportOpen] = useState(false);

  const load = async () => {
    const [f, fm] = await Promise.all([
      supabase.from("federations").select("*"),
      supabase.from("federation_members").select("*").order("last_name"),
    ]);
    setFeds((f.data ?? []) as Federation[]);
    setFedMembers((fm.data ?? []) as FederationMember[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const rows: Row[] = useMemo(() => {
    const fedMap = new Map(feds.map((f) => [f.id, f]));
    const out: Row[] = [];
    for (const m of fedMembers) {
      const f = fedMap.get(m.federation_id);
      out.push({
        kind: "fed",
        data: m,
        orgId: m.federation_id,
        orgLabel: f ? `${f.acronym} — ${f.name}` : "—",
      });
    }
    const needle = q.trim().toLowerCase();
    let filtered = needle
      ? out.filter((r) => {
          const m = r.data;
          return (
            `${m.first_name} ${m.last_name}`.toLowerCase().includes(needle) ||
            (m.email ?? "").toLowerCase().includes(needle) ||
            r.orgLabel.toLowerCase().includes(needle)
          );
        })
      : out;
    if (roleFilter !== "all") filtered = filtered.filter((r) => r.data.role === roleFilter);
    if (fedFilter !== "all") filtered = filtered.filter((r) => r.orgId === fedFilter);
    return filtered.sort((a, b) => {
      const av = ((a.data as Record<string, unknown>)[sort.key] ?? "").toString().toLowerCase();
      const bv = ((b.data as Record<string, unknown>)[sort.key] ?? "").toString().toLowerCase();
      const cmp = av.localeCompare(bv);
      return sort.dir === "asc" ? cmp : -cmp;
    });
  }, [feds, fedMembers, q, sort, roleFilter, fedFilter]);

  const toggleSort = (key: "last_name" | "first_name" | "role" | "email" | "phone" | "is_active") =>
    setSort((s) =>
      s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" },
    );

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
              Membres des bureaux des fédérations.
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setImportOpen(true)}>
            <Upload className="mr-2 h-4 w-4" /> Importer
          </Button>
          <AddPersonButton
            role="federation_member"
            label="Ajouter un membre"
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
            placeholder="Rechercher un membre, email, fédération…"
            className="pl-9"
          />
        </div>
        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className="w-[200px]"><SelectValue placeholder="Toutes les fonctions" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes les fonctions</SelectItem>
            {FEDERATION_MEMBER_ROLES.map((r) => (
              <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={fedFilter} onValueChange={setFedFilter}>
          <SelectTrigger className="w-[220px]"><SelectValue placeholder="Toutes les fédérations" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes les fédérations</SelectItem>
            {feds.map((f) => (
              <SelectItem key={f.id} value={f.id}>{f.acronym} — {f.name}</SelectItem>
            ))}
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
                <TableHead><SortBtn active={sort.key === "last_name"} dir={sort.dir} onClick={() => toggleSort("last_name")}>Nom</SortBtn></TableHead>
                <TableHead><SortBtn active={sort.key === "role"} dir={sort.dir} onClick={() => toggleSort("role")}>Fonction</SortBtn></TableHead>
                <TableHead>Fédération</TableHead>
                <TableHead><SortBtn active={sort.key === "email"} dir={sort.dir} onClick={() => toggleSort("email")}>Email</SortBtn></TableHead>
                <TableHead><SortBtn active={sort.key === "phone"} dir={sort.dir} onClick={() => toggleSort("phone")}>Téléphone</SortBtn></TableHead>
                <TableHead><SortBtn active={sort.key === "is_active"} dir={sort.dir} onClick={() => toggleSort("is_active")}>Statut</SortBtn></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => {
                const m = r.data;
                return (
                  <TableRow
                    key={`fed:${m.id}`}
                    onClick={() => navigate({ to: "/federations/members/$memberId", params: { memberId: m.id } })}
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
                      <Badge variant="outline">
                        {FEDERATION_MEMBER_ROLES.find((rl) => rl.value === m.role)?.label ?? m.role}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      <Link
                        to="/federations/$id"
                        params={{ id: r.orgId }}
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex items-center gap-1.5 hover:underline"
                      >
                        <Building2 className="h-3.5 w-3.5" />
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
      <CsvImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        config={federationMembersImportConfig}
        onImported={() => load()}
      />
    </div>
  );
}