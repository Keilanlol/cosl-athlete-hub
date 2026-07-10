import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { friendlyError } from "@/lib/error-messages";
import { useEffect, useMemo, useState } from "react";
import { BadgeCheck } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  ListPageHeader,
  SearchInput,
  ResultCount,
  SortableHeader,
} from "@/components/list-table";
import { EmptyState, PAGE_SIZE, PagerBar, SortBtn, TableSkeleton } from "@/components/DataTableShell";

export const Route = createFileRoute("/_authenticated/accreditations/")({
  component: GlobalAccreditationsPage,
});

const ACCRED_STATUSES: { value: string; label: string; cls: string }[] = [
  { value: "draft", label: "Brouillon", cls: "bg-slate-200 text-foreground" },
  { value: "submitted", label: "Soumise", cls: "bg-amber-100 text-amber-700" },
  { value: "validated", label: "Validée", cls: "bg-emerald-100 text-emerald-700" },
  { value: "rejected", label: "Rejetée", cls: "bg-red-100 text-red-700" },
];

const CATEGORIES: { value: string; label: string }[] = [
  { value: "athlete", label: "Athlete" },
  { value: "coach", label: "Encadrant" },
  { value: "official", label: "NOC Guest" },
  { value: "medical", label: "Dignitaires" },
  { value: "press", label: "Press" },
  { value: "vip", label: "Juge" },
  { value: "president", label: "President" },
  { value: "secretary_general", label: "Secretary General" },
];

type Row = {
  id: string;
  game_id: string;
  full_name: string;
  status: string;
  game: { id: string; name: string; short_name: string | null } | null;
  type: { category: string; type_code: string; required_documents: string[] | null } | null;
  docs: { status: string }[];
};

type SortKey = "full_name" | "status" | "game_id" | "category" | "type_code";

function GlobalAccreditationsPage() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({
    key: "full_name",
    dir: "asc",
  });
  const [gameFilter, setGameFilter] = useState("all");
  const [catFilter, setCatFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);

  const load = async () => {
    setRows(null);
    const { data, error } = await supabase
      .from("accreditations")
      .select("id, game_id, full_name, status, game:games(id,name,short_name), type:accreditation_types(category,type_code,required_documents), docs:accreditation_documents(status)")
      .order("created_at", { ascending: false });
    if (error) {
      toast.error("Erreur de chargement", { description: friendlyError(error) });
      setRows([]); return;
    }
    setRows(((data ?? []) as unknown) as Row[]);
  };

  useEffect(() => { load(); }, []);

  const games = useMemo(() => {
    const map = new Map<string, { id: string; name: string }>();
    (rows ?? []).forEach((r) => r.game && map.set(r.game.id, { id: r.game.id, name: r.game.short_name ?? r.game.name }));
    return Array.from(map.values());
  }, [rows]);

  const filtered = useMemo(() => {
    if (!rows) return [];
    const q = search.trim().toLowerCase();
    let r = rows.filter((r) => {
      if (gameFilter !== "all" && r.game_id !== gameFilter) return false;
      if (catFilter !== "all" && r.type?.category !== catFilter) return false;
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (q && !r.full_name.toLowerCase().includes(q)) return false;
      return true;
    });
    r.sort((a, b) => {
      let av: string;
      let bv: string;
      if (sort.key === "game_id") {
        av = a.game?.short_name ?? a.game?.name ?? "";
        bv = b.game?.short_name ?? b.game?.name ?? "";
      } else if (sort.key === "category") {
        av = a.type?.category ?? "";
        bv = b.type?.category ?? "";
      } else if (sort.key === "type_code") {
        av = a.type?.type_code ?? "";
        bv = b.type?.type_code ?? "";
      } else {
        av = (a[sort.key] ?? "").toString().toLowerCase();
        bv = (b[sort.key] ?? "").toString().toLowerCase();
      }
      const cmp = av.localeCompare(bv);
      return sort.dir === "asc" ? cmp : -cmp;
    });
    return r;
  }, [rows, search, gameFilter, catFilter, statusFilter, sort]);

  useEffect(() => { setPage(1); }, [search, gameFilter, catFilter, statusFilter, sort.key]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const visible = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  useEffect(() => { if (page > pageCount) setPage(1); }, [pageCount, page]);

  const toggleSort = (key: SortKey) =>
    setSort((s) =>
      s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" },
    );

  return (
    <div className="space-y-6">
      <ListPageHeader
        icon={BadgeCheck}
        title="Accréditations"
        description="Vue globale toutes éditions confondues."
      />

      <div className="flex flex-wrap items-center gap-3">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Rechercher une personne…"
        />
        <Select value={gameFilter} onValueChange={setGameFilter}>
          <SelectTrigger className="w-48"><SelectValue placeholder="Games" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous Games</SelectItem>
            {games.map((g) => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={catFilter} onValueChange={setCatFilter}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Catégorie" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes catégories</SelectItem>
            {CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Statut" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous statuts</SelectItem>
            {ACCRED_STATUSES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <ResultCount count={filtered.length} />
      </div>

      <div className="rounded-lg border border-border bg-card">
        {rows === null ? (
          <TableSkeleton cols={6} />
        ) : filtered.length === 0 ? (
          <div className="p-6"><EmptyState message="Aucune accréditation." /></div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead><SortBtn active={sort.key === "game_id"} dir={sort.dir} onClick={() => toggleSort("game_id")}>Games</SortBtn></TableHead>
                <SortableHeader sortKey="full_name" sort={sort} onToggle={toggleSort}>
                  Personne
                </SortableHeader>
                <TableHead><SortBtn active={sort.key === "category"} dir={sort.dir} onClick={() => toggleSort("category")}>Catégorie</SortBtn></TableHead>
                <TableHead><SortBtn active={sort.key === "type_code"} dir={sort.dir} onClick={() => toggleSort("type_code")}>Type</SortBtn></TableHead>
                <SortableHeader sortKey="status" sort={sort} onToggle={toggleSort}>
                  Statut
                </SortableHeader>
                <TableHead>Complétude</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((r) => {
                const sb = ACCRED_STATUSES.find((s) => s.value === r.status);
                const cat = CATEGORIES.find((c) => c.value === r.type?.category);
                const total = r.type?.required_documents?.length ?? r.docs.length ?? 0;
                const valid = r.docs.filter((d) => d.status === "valid").length;
                const pct = total > 0 ? Math.round((valid / total) * 100) : 0;
                return (
                  <TableRow
                    key={r.id}
                    onClick={() => r.game && navigate({ to: "/games/$id/accreditations", params: { id: r.game.id } })}
                    className={r.game ? "cursor-pointer hover:bg-muted" : ""}
                  >
                    <TableCell className="text-muted-foreground">{r.game?.short_name ?? r.game?.name ?? "—"}</TableCell>
                    <TableCell className="font-medium">{r.full_name}</TableCell>
                    <TableCell>{cat ? <Badge variant="outline">{cat.label}</Badge> : "—"}</TableCell>
                    <TableCell className="font-mono">{r.type?.type_code ?? "—"}</TableCell>
                    <TableCell>{sb && <Badge className={`${sb.cls} hover:${sb.cls}`}>{sb.label}</Badge>}</TableCell>
                    <TableCell className="min-w-[160px]">
                      <div className="flex items-center gap-2">
                        <Progress value={pct} className="h-2 flex-1" />
                        <span className="text-xs text-muted-foreground">{pct}%</span>
                      </div>
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