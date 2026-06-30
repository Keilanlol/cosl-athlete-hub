import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Plus, Search, Users, Upload } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import {
  PERSON_ROLE_TYPES,
  ROLE_LABELS,
  personFullName,
  type PersonListItem,
  type PersonRoleType,
} from "@/lib/persons";
import { PersonRoleBadge } from "@/components/persons/PersonRoleBadge";
import { PersonCreateDialog } from "@/components/persons/PersonCreateDialog";
import { CsvImportDialog } from "@/components/CsvImportDialog";
import { personsImportConfig } from "@/lib/csv-import-configs";
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
  TableSkeleton,
} from "@/components/DataTableShell";

export const Route = createFileRoute("/_authenticated/persons/")({
  component: PersonsPage,
});

function PersonsPage() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<PersonListItem[] | null>(null);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [activeFilter, setActiveFilter] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  const load = async () => {
    setRows(null);
    const { data, error } = await supabase
      .from("v_persons_with_roles")
      .select("*")
      .order("last_name", { ascending: true });
    if (error) {
      toast.error("Erreur de chargement", { description: error.message });
      setRows([]);
      return;
    }
    setRows((data ?? []) as PersonListItem[]);
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    if (!rows) return [];
    const q = search.trim().toLowerCase();
    let r = rows.slice();
    if (roleFilter !== "all")
      r = r.filter((p) => (p.roles ?? []).includes(roleFilter as PersonRoleType));
    if (activeFilter === "active") r = r.filter((p) => p.is_active);
    if (activeFilter === "inactive") r = r.filter((p) => !p.is_active);
    if (q)
      r = r.filter((p) =>
        `${p.first_name} ${p.last_name} ${p.email ?? ""}`.toLowerCase().includes(q),
      );
    return r;
  }, [rows, search, roleFilter, activeFilter]);

  useEffect(() => {
    setPage(1);
  }, [search, roleFilter, activeFilter]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const visible = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-white">
            <Users className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Personnes</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Vue unifiée — athlètes, encadrants, membres, bénévoles…
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setImportOpen(true)}>
            <Upload className="mr-2 h-4 w-4" /> Importer
          </Button>
          <Button
            onClick={() => setCreateOpen(true)}
            className="bg-primary hover:bg-[var(--cosl-red-dark)]"
          >
            <Plus className="mr-2 h-4 w-4" />
            Nouvelle personne
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Rechercher par nom, email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Tous les rôles" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les rôles</SelectItem>
            {PERSON_ROLE_TYPES.map((r) => (
              <SelectItem key={r} value={r}>
                {ROLE_LABELS[r]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={activeFilter} onValueChange={setActiveFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous</SelectItem>
            <SelectItem value="active">Actifs</SelectItem>
            <SelectItem value="inactive">Inactifs</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-sm text-muted-foreground">
          {filtered.length} résultat(s)
        </span>
      </div>

      <div className="rounded-lg border border-border bg-card">
        {rows === null ? (
          <TableSkeleton cols={6} />
        ) : filtered.length === 0 ? (
          <div className="p-6">
            <EmptyState message="Aucune personne enregistrée." />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-14"></TableHead>
                <TableHead>Nom</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Téléphone</TableHead>
                <TableHead>Rôles</TableHead>
                <TableHead>Statut</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((p) => (
                <TableRow
                  key={p.id}
                  onClick={() =>
                    navigate({
                      to: "/persons/$personId",
                      params: { personId: p.id },
                    })
                  }
                  className="cursor-pointer hover:bg-muted"
                >
                  <TableCell>
                    <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border border-border bg-muted">
                      {p.photo_url ? (
                        <img
                          src={p.photo_url}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <span className="text-xs font-semibold text-muted-foreground">
                          {(p.first_name[0] ?? "") + (p.last_name[0] ?? "")}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="font-medium">{personFullName(p)}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {p.email ?? "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {p.phone ?? "—"}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {(p.roles ?? []).length === 0 ? (
                        <span className="text-muted-foreground text-xs">—</span>
                      ) : (
                        (p.roles ?? []).map((r) => (
                          <PersonRoleBadge key={r} role={r} />
                        ))
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {p.is_active ? (
                      <span className="text-xs font-medium text-emerald-700">
                        Actif
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">Inactif</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <PagerBar page={page} pageCount={pageCount} onChange={setPage} />

      <PersonCreateDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={(id) => {
          load();
          navigate({ to: "/persons/$personId", params: { personId: id } });
        }}
      />

      <CsvImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        config={personsImportConfig}
        onImported={() => load()}
      />
    </div>
  );
}
