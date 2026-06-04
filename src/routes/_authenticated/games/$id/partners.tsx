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
import { PartnerQuickCreateDialog } from "@/components/partners/PartnerQuickCreateDialog";


export const Route = createFileRoute("/_authenticated/games/$id/partners")({
  component: GamePartnersPage,
});

type Partner = {
  id: string; name: string; email: string | null; phone: string | null;
  logo_url: string | null;
  street: string | null; postcode: string | null; city: string | null; country: string | null;
  contact_first_name: string | null; contact_last_name: string | null;
  contact_email: string | null; contact_phone: string | null;
};
type Row = { id: string; partner_id: string; notes: string | null; partner: Partner | null };

function GamePartnersPage() {
  const { id: gameId } = Route.useParams();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [pool, setPool] = useState<Partner[]>([]);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [partnerId, setPartnerId] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [quickOpen, setQuickOpen] = useState(false);


  const load = async () => {
    setRows(null);
    const [g, p] = await Promise.all([
      supabase.from("game_partners").select("*, partner:partners(*)").eq("game_id", gameId).order("created_at"),
      supabase.from("partners").select("*").order("name"),
    ]);
    if (g.error) { toast.error("Erreur", { description: friendlyError(g.error) }); setRows([]); return; }
    setRows((g.data ?? []) as unknown as Row[]);
    setPool((p.data ?? []) as Partner[]);
  };
  useEffect(() => { load(); }, [gameId]);

  const linked = useMemo(() => new Set((rows ?? []).map((r) => r.partner_id)), [rows]);
  const available = useMemo(() => pool.filter((p) => !linked.has(p.id)), [pool, linked]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!rows) return [];
    if (!q) return rows;
    return rows.filter((r) =>
      `${r.partner?.name ?? ""} ${r.partner?.email ?? ""} ${r.partner?.city ?? ""}`
        .toLowerCase().includes(q),
    );
  }, [rows, search]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!partnerId) { toast.error("Sélectionnez un partenaire."); return; }
    setSaving(true);
    const { error } = await supabase.from("game_partners").insert({
      game_id: gameId, partner_id: partnerId, notes: notes.trim() || null,
    });
    setSaving(false);
    if (error) { toast.error("Échec", { description: friendlyError(error) }); return; }
    toast.success("Partenaire ajouté");
    setOpen(false); setPartnerId(""); setNotes(""); load();
  };

  const remove = async (r: Row) => {
    if (!(await confirmAction({ title: "Retirer ce partenaire ?", confirmLabel: "Retirer" }))) return;
    const { error } = await supabase.from("game_partners").delete().eq("id", r.id);
    if (error) toast.error("Échec", { description: friendlyError(error) });
    else { toast.success("Partenaire retiré"); load(); }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Rechercher…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <span className="text-sm text-muted-foreground">{filtered.length} partenaire(s)</span>
        <div className="ml-auto">
          <Button onClick={() => setOpen(true)} className="bg-primary hover:bg-[var(--cosl-red-dark)]">
            <Plus className="mr-2 h-4 w-4" /> Ajouter un partenaire
          </Button>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card">
        {rows === null ? <TableSkeleton cols={5} /> : filtered.length === 0 ? (
          <div className="p-6"><EmptyState message="Aucun partenaire lié à ce Games." /></div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Logo</TableHead>
                <TableHead>Nom</TableHead>
                <TableHead>Adresse</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Référent</TableHead>
                <TableHead className="w-20 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>
                    {r.partner?.logo_url
                      ? <img src={r.partner.logo_url} alt="" className="h-10 w-10 rounded object-contain border" />
                      : <div className="h-10 w-10 rounded border bg-muted" />}
                  </TableCell>
                  <TableCell className="font-medium">{r.partner?.name ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {[r.partner?.street, [r.partner?.postcode, r.partner?.city].filter(Boolean).join(" "), r.partner?.country].filter(Boolean).join(", ") || "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    <div>{r.partner?.email ?? "—"}</div>
                    <div>{r.partner?.phone ?? ""}</div>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {[r.partner?.contact_first_name, r.partner?.contact_last_name].filter(Boolean).join(" ") || "—"}
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
              <DialogTitle>Lier un partenaire</DialogTitle>
              <DialogDescription>Choisissez un partenaire existant à associer à ce Games.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-1.5">
                <Label>Partenaire *</Label>
                <Select
                  value={partnerId}
                  onValueChange={(v) => {
                    if (v === "__new__") {
                      setOpen(false);
                      setQuickOpen(true);
                      return;
                    }
                    setPartnerId(v);
                  }}
                >
                  <SelectTrigger><SelectValue placeholder="Choisir un partenaire…" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__new__" className="font-medium text-primary">+ Créer un nouveau partenaire</SelectItem>
                    {available.length === 0 && <div className="p-2 text-sm text-muted-foreground">Aucun partenaire disponible.</div>}
                    {available.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">Ou créez-en un nouveau directement ici.</p>
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

      <PartnerQuickCreateDialog
        open={quickOpen}
        onOpenChange={setQuickOpen}
        onCreated={async (id) => {
          const { error } = await supabase.from("game_partners").insert({ game_id: gameId, partner_id: id });
          if (error) toast.error("Échec du lien", { description: friendlyError(error) });
          load();
        }}
      />
    </div>
  );
}

