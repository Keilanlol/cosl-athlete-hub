import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { friendlyError } from "@/lib/error-messages";
import { useEffect, useMemo, useState } from "react";
import { Search, GraduationCap } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { COACH_ROLES, type Club, type Coach, type Federation } from "@/lib/types";
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
import {
  EmptyState,
  PAGE_SIZE,
  PagerBar,
  SortBtn,
  TableSkeleton,
} from "@/components/DataTableShell";
import { AddPersonButton } from "@/components/persons/AddPersonButton";

export const Route = createFileRoute("/_authenticated/coaches/")({
  component: CoachesPage,
});

type SortKey = "first_name" | "last_name" | "role";

function roleLabel(v: string) {
  return COACH_ROLES.find((r) => r.value === v)?.label ?? v;
}

function CoachesPage() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<Coach[] | null>(null);
  const [feds, setFeds] = useState<Federation[]>([]);
  const [clubs, setClubs] = useState<Club[]>([]);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [fedFilter, setFedFilter] = useState<string>("all");
  const [activeFilter, setActiveFilter] = useState<string>("all");
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({
    key: "last_name",
    dir: "asc",
  });
  const [page, setPage] = useState(1);

  const fedMap = useMemo(() => {
    const m = new Map<string, Federation>();
    feds.forEach((f) => m.set(f.id, f));
    return m;
  }, [feds]);
  const clubMap = useMemo(() => {
    const m = new Map<string, Club>();
    clubs.forEach((c) => m.set(c.id, c));
    return m;
  }, [clubs]);

  const load = async () => {
    setRows(null);
    const [c, f, cl] = await Promise.all([
      supabase.from("coaches").select("*").order("last_name"),
      supabase.from("federations").select("*").order("acronym"),
      supabase.from("clubs").select("*").order("name"),
    ]);
    if (c.error || f.error || cl.error) {
      toast.error("Erreur de chargement", {
        description: (c.error ?? f.error ?? cl.error)?.message,
      });
      setRows([]);
      return;
    }
    setRows((c.data ?? []) as Coach[]);
    setFeds((f.data ?? []) as Federation[]);
    setClubs((cl.data ?? []) as Club[]);
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    if (!rows) return [];
    const q = search.trim().toLowerCase();
    let r = rows.slice();
    if (roleFilter !== "all") r = r.filter((c) => c.role === roleFilter);
    if (fedFilter !== "all") r = r.filter((c) => c.federation_id === fedFilter);
    if (activeFilter === "active") r = r.filter((c) => c.is_active);
    if (activeFilter === "inactive") r = r.filter((c) => !c.is_active);
    if (q)
      r = r.filter((c) =>
        `${c.first_name} ${c.last_name}`.toLowerCase().includes(q),
      );
    r.sort((a, b) => {
      const av = (a[sort.key] ?? "").toString().toLowerCase();
      const bv = (b[sort.key] ?? "").toString().toLowerCase();
      const cmp = av.localeCompare(bv);
      return sort.dir === "asc" ? cmp : -cmp;
    });
    return r;
  }, [rows, search, roleFilter, fedFilter, activeFilter, sort]);

  useEffect(() => {
    setPage(1);
  }, [search, roleFilter, fedFilter, activeFilter]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const visible = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  useEffect(() => {
    if (page > pageCount) setPage(1);
  }, [pageCount, page]);

  const toggleSort = (key: SortKey) =>
    setSort((s) =>
      s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" },
    );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-white">
            <GraduationCap className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Encadrants</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Coachs, managers, personnel médical et officiels.
            </p>
          </div>
        </div>
        <AddPersonButton
          role="coach"
          label="Ajouter un encadrant"
          onChanged={(personId) => {
            load();
            navigate({ to: "/persons/$personId", params: { personId } });
          }}
        />
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
        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Tous les rôles" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les rôles</SelectItem>
            {COACH_ROLES.map((r) => (
              <SelectItem key={r.value} value={r.value}>
                {r.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={fedFilter} onValueChange={setFedFilter}>
          <SelectTrigger className="w-[220px]">
            <SelectValue placeholder="Toutes les fédérations" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes les fédérations</SelectItem>
            {feds.map((f) => (
              <SelectItem key={f.id} value={f.id}>
                {f.acronym} — {f.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={activeFilter} onValueChange={setActiveFilter}>
          <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous</SelectItem>
            <SelectItem value="active">Actifs</SelectItem>
            <SelectItem value="inactive">Inactifs</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-sm text-muted-foreground">{filtered.length} résultat(s)</span>
      </div>

      <div className="rounded-lg border border-border bg-card">
        {rows === null ? (
          <TableSkeleton cols={9} />
        ) : filtered.length === 0 ? (
          <div className="p-6">
            <EmptyState message="Aucun encadrant enregistré." />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-14"></TableHead>
                <TableHead>
                  <SortBtn
                    active={sort.key === "first_name"}
                    dir={sort.dir}
                    onClick={() => toggleSort("first_name")}
                  >
                    Prénom
                  </SortBtn>
                </TableHead>
                <TableHead>
                  <SortBtn
                    active={sort.key === "last_name"}
                    dir={sort.dir}
                    onClick={() => toggleSort("last_name")}
                  >
                    Nom
                  </SortBtn>
                </TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Téléphone</TableHead>
                <TableHead>
                  <SortBtn
                    active={sort.key === "role"}
                    dir={sort.dir}
                    onClick={() => toggleSort("role")}
                  >
                    Rôle
                  </SortBtn>
                </TableHead>
                <TableHead>Fédération</TableHead>
                <TableHead>Club</TableHead>
                <TableHead>Actif</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((c) => {
                const f = c.federation_id ? fedMap.get(c.federation_id) : null;
                const cl = c.club_id ? clubMap.get(c.club_id) : null;
                return (
                  <TableRow
                    key={c.id}
                    onClick={() => navigate({ to: "/coaches/$id", params: { id: c.id } })}
                    className="cursor-pointer hover:bg-muted"
                  >
                    <TableCell>
                      <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border border-border bg-muted">
                        {c.photo_url ? (
                          <img src={c.photo_url} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <span className="text-xs font-semibold text-muted-foreground">
                            {(c.first_name[0] ?? "") + (c.last_name[0] ?? "")}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{c.first_name}</TableCell>
                    <TableCell className="font-medium">{c.last_name}</TableCell>
                    <TableCell className="text-muted-foreground">{c.email ?? "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{c.phone ?? "—"}</TableCell>
                    <TableCell>{roleLabel(c.role)}</TableCell>
                    <TableCell>
                      {f ? (
                        <span className="font-mono text-sm">{f.acronym}</span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{cl?.name ?? "—"}</TableCell>
                    <TableCell>
                      {c.is_active ? (
                        <span className="text-xs font-medium text-emerald-700">Actif</span>
                      ) : (
                        <span className="text-xs text-muted-foreground">Inactif</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>

      <PagerBar page={page} pageCount={pageCount} onChange={setPage} />
    </div>
  );
}
