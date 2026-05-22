import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  EmptyState, PAGE_SIZE, PagerBar, TableSkeleton,
} from "@/components/DataTableShell";

export const Route = createFileRoute("/_authenticated/accreditations/")({
  component: GlobalAccreditationsPage,
});

const ACCRED_STATUSES: { value: string; label: string; cls: string }[] = [
  { value: "draft", label: "Brouillon", cls: "bg-slate-200 text-slate-700" },
  { value: "submitted", label: "Soumise", cls: "bg-amber-100 text-amber-700" },
  { value: "validated", label: "Validée", cls: "bg-emerald-100 text-emerald-700" },
  { value: "rejected", label: "Rejetée", cls: "bg-red-100 text-red-700" },
  { value: "produced", label: "Produite", cls: "bg-indigo-100 text-indigo-700" },
  { value: "delivered", label: "Délivrée", cls: "bg-blue-100 text-blue-800" },
];

const CATEGORIES: { value: string; label: string }[] = [
  { value: "athlete", label: "Athlète" },
  { value: "coach", label: "Coach" },
  { value: "official", label: "Officiel" },
  { value: "medical", label: "Médical" },
  { value: "press", label: "Presse" },
  { value: "vip", label: "VIP" },
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

function GlobalAccreditationsPage() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [search, setSearch] = useState("");
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
      toast.error("Erreur de chargement", { description: friendlyError(error.message ? { message: error.message } : null) });
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
    return rows.filter((r) => {
      if (gameFilter !== "all" && r.game_id !== gameFilter) return false;
      if (catFilter !== "all" && r.type?.category !== catFilter) return false;
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (q && !r.full_name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [rows, search, gameFilter, catFilter, statusFilter]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const visible = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  useEffect(() => { if (page > pageCount) setPage(1); }, [pageCount, page]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Accréditations</h1>
        <p className="mt-1 text-sm text-slate-600">Vue globale toutes éditions confondues.</p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative max-w-sm flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input placeholder="Rechercher une personne…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
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
        <span className="ml-auto text-sm text-slate-500">{filtered.length} résultat(s)</span>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white">
        {rows === null ? (
          <TableSkeleton cols={7} />
        ) : filtered.length === 0 ? (
          <div className="p-6"><EmptyState message="Aucune accréditation." /></div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Games</TableHead>
                <TableHead>Personne</TableHead>
                <TableHead>Catégorie</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Statut</TableHead>
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
                    className={r.game ? "cursor-pointer hover:bg-slate-50" : ""}
                  >
                    <TableCell className="text-slate-600">{r.game?.short_name ?? r.game?.name ?? "—"}</TableCell>
                    <TableCell className="font-medium">{r.full_name}</TableCell>
                    <TableCell>{cat ? <Badge variant="outline">{cat.label}</Badge> : "—"}</TableCell>
                    <TableCell className="font-mono text-xs">{r.type?.type_code ?? "—"}</TableCell>
                    <TableCell>{sb && <Badge className={`${sb.cls} hover:${sb.cls}`}>{sb.label}</Badge>}</TableCell>
                    <TableCell className="min-w-[160px]">
                      <div className="flex items-center gap-2">
                        <Progress value={pct} className="h-2 flex-1" />
                        <span className="text-xs text-slate-600">{pct}%</span>
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
