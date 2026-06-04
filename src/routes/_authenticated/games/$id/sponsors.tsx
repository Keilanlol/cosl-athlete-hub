import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2, Search } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { friendlyError } from "@/lib/error-messages";
import { confirmAction } from "@/components/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { EmptyState, TableSkeleton } from "@/components/DataTableShell";

export const Route = createFileRoute("/_authenticated/games/$id/sponsors")({
  component: GameSponsorsPage,
});

type Sponsor = {
  id: string; name: string; email: string | null; phone: string | null;
  logo_url: string | null; rank_id: string | null;
  contact_first_name: string | null; contact_last_name: string | null;
  contact_email: string | null; contact_phone: string | null;
};
type Rank = { id: string; name: string };
type Row = { id: string; sponsor_id: string; notes: string | null; sponsor: Sponsor | null };

function GameSponsorsPage() {
  const { id: gameId } = Route.useParams();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [pool, setPool] = useState<Sponsor[]>([]);
  const [ranks, setRanks] = useState<Rank[]>([]);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [sponsorId, setSponsorId] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setRows(null);
    const [g, s, r] = await Promise.all([
      supabase.from("game_sponsors").select("*, sponsor:sponsors(*)").eq("game_id", gameId).order("created_at"),
      supabase.from("sponsors").select("*").order("name"),
      supabase.from("sponsor_ranks").select("id,name"),
    ]);
    if (g.error) { toast.error("Erreur", { description: friendlyError(g.error) }); setRows([]); return; }
    setRows((g.data ?? []) as unknown as Row[]);
    setPool((s.data ?? []) as Sponsor[]);
    setRanks((r.data ?? []) as Rank[]);
  };
  useEffect(() => { load(); }, [gameId]);

  const rankName = (id: string | null) => ranks.find((r) => r.id === id)?.name ?? null;
  const linked = useMemo(() => new Set((rows ?? []).map((r) => r.sponsor_id)), [rows]);
  const available = useMemo(() => pool.filter((p) => !linked.has(p.id)), [pool, linked]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!rows) return [];
    if (!q) return rows;
    return rows.filter((r) =>
      `${r.sponsor?.name ?? ""} ${r.sponsor?.email ?? ""} ${rankName(r.sponsor?.rank_id ?? null) ?? ""}`
        .toLowerCase().includes(q),
    );
  }, [rows, search, ranks]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sponsorId) { toast.error("Sélectionnez un sponsor."); return; }
    setSaving(true);
    const { error } = await supabase.from("game_sponsors").insert({
      game_id: gameId, sponsor_id: sponsorId, notes: notes.trim() || null,
    });
    setSaving(false);
    if (error) { toast.error("Échec", { description: friendlyError(error) }); return; }
    toast.success("Sponsor ajouté");
    setOpen(false); setSponsorId(""); setNotes(""); load();
  };

  const remove = async (r: Row) => {
    if (!(await confirmAction({ title: "Retirer ce sponsor ?", confirmLabel: "Retirer" }))) return;
    const { error } = await supabase.from("game_sponsors").delete().eq("id", r.id);
    if (error) toast.error("Échec", { description: friendlyError(error) });
    else { toast.success("Sponsor retiré"); load(); }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Rechercher…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <span className="text-sm text-muted-foreground">{filtered.length} sponsor(s)</span>
        <div className="ml-auto">
          <Button onClick={() => setOpen(true)} className="bg-primary hover:bg-[var(--cosl-red-dark)]">
            <Plus className="mr-2 h-4 w-4" /> Ajouter un sponsor
          </Button>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card">
        {rows === null ? <TableSkeleton cols={5} /> : filtered.length === 0 ? (
          <div className="p-6"><EmptyState message="Aucun sponsor lié à ce Games." /></div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Logo</TableHead>
                <TableHead>Nom</TableHead>
                <TableHead>Rang</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Référent</TableHead>
                <TableHead className="w-20 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>
                    {r.sponsor?.logo_url
                      ? <img src={r.sponsor.logo_url} alt="" className="h-10 w-10 rounded object-contain border" />
                      : <div className="h-10 w-10 rounded border bg-muted" />}
                  </TableCell>
                  <TableCell className="font-medium">{r.sponsor?.name ?? "—"}</TableCell>
                  <TableCell>
                    {r.sponsor?.rank_id
                      ? <Badge className="bg-amber-100 text-amber-800 border-amber-200">{rankName(r.sponsor.rank_id)}</Badge>
                      : "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    <div>{r.sponsor?.email ?? "—"}</div>
                    <div>{r.sponsor?.phone ?? ""}</div>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {[r.sponsor?.contact_first_name, r.sponsor?.contact_last_name].filter(Boolean).join(" ") || "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => remove(r)}><Trash2 className="h-4 w-4 text-red-600" /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <form onSubmit={submit}>
            <DialogHeader>
              <DialogTitle>Lier un sponsor</DialogTitle>
              <DialogDescription>Choisissez un sponsor existant à associer à ce Games.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-1.5">
                <Label>Sponsor *</Label>
                <Select value={sponsorId} onValueChange={setSponsorId}>
                  <SelectTrigger><SelectValue placeholder="Choisir un sponsor…" /></SelectTrigger>
                  <SelectContent>
                    {available.length === 0 && <div className="p-2 text-sm text-muted-foreground">Aucun sponsor disponible.</div>}
                    {available.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}{rankName(s.rank_id) ? ` — ${rankName(s.rank_id)}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">Les sponsors se créent depuis la page Sponsors.</p>
              </div>
              <div className="space-y-1.5">
                <Label>Notes</Label>
                <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
              <Button type="submit" disabled={saving} className="bg-primary hover:bg-[var(--cosl-red-dark)]">
                {saving ? "Ajout…" : "Ajouter"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
