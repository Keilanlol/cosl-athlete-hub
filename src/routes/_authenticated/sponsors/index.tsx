import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Plus, Pencil, Trash2, Search, Star, Settings2, Upload } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { friendlyError } from "@/lib/error-messages";
import { confirmAction } from "@/components/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { LogoFilePicker, persistLogo } from "@/components/LogoFilePicker";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { EmptyState, TableSkeleton } from "@/components/DataTableShell";
import { CsvImportDialog } from "@/components/CsvImportDialog";
import { sponsorsImportConfig } from "@/lib/csv-import-configs";

export const Route = createFileRoute("/_authenticated/sponsors/")({
  component: SponsorsPage,
});

type Rank = { id: string; name: string; sort_order: number };
type Sponsor = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  logo_url: string | null;
  logo_storage_path: string | null;
  rank_id: string | null;
  contact_first_name: string | null;
  contact_last_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  notes: string | null;
  is_active: boolean;
};

const empty = {
  name: "", email: "", phone: "",
  rank_id: "__none__",
  contact_first_name: "", contact_last_name: "", contact_email: "", contact_phone: "",
  notes: "",
};

function SponsorsPage() {
  const [rows, setRows] = useState<Sponsor[] | null>(null);
  const [ranks, setRanks] = useState<Rank[]>([]);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Sponsor | null>(null);
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoCleared, setLogoCleared] = useState(false);

  const [ranksOpen, setRanksOpen] = useState(false);
  const [newRank, setNewRank] = useState("");
  const [importOpen, setImportOpen] = useState(false);


  const load = async () => {
    setRows(null);
    const [s, r] = await Promise.all([
      supabase.from("sponsors").select("*").order("name"),
      supabase.from("sponsor_ranks").select("*").order("sort_order"),
    ]);
    if (s.error) { toast.error("Erreur", { description: friendlyError(s.error) }); setRows([]); return; }
    setRows((s.data ?? []) as Sponsor[]);
    setRanks((r.data ?? []) as Rank[]);
  };
  useEffect(() => { load(); }, []);

  const rankName = (id: string | null) => ranks.find((r) => r.id === id)?.name ?? "—";

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!rows) return [];
    if (!q) return rows;
    return rows.filter((s) =>
      `${s.name} ${s.email ?? ""} ${s.contact_first_name ?? ""} ${s.contact_last_name ?? ""} ${rankName(s.rank_id)}`
        .toLowerCase().includes(q),
    );
  }, [rows, search, ranks]);

  const openCreate = () => { setEditing(null); setForm(empty); setLogoFile(null); setLogoCleared(false); setOpen(true); };
  const openEdit = (s: Sponsor) => {
    setEditing(s);
    setForm({
      name: s.name, email: s.email ?? "", phone: s.phone ?? "",
      rank_id: s.rank_id ?? "__none__",
      contact_first_name: s.contact_first_name ?? "",
      contact_last_name: s.contact_last_name ?? "",
      contact_email: s.contact_email ?? "",
      contact_phone: s.contact_phone ?? "",
      notes: s.notes ?? "",
    });
    setLogoFile(null); setLogoCleared(false);
    setOpen(true);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { toast.error("Le nom est requis"); return; }
    setSaving(true);
    const payload = {
      name: form.name.trim(),
      email: form.email.trim() || null,
      phone: form.phone.trim() || null,
      rank_id: form.rank_id === "__none__" ? null : form.rank_id,
      contact_first_name: form.contact_first_name.trim() || null,
      contact_last_name: form.contact_last_name.trim() || null,
      contact_email: form.contact_email.trim() || null,
      contact_phone: form.contact_phone.trim() || null,
      notes: form.notes.trim() || null,
    };
    try {
      let id: string;
      let previousPath: string | null = null;
      if (editing) {
        const { error } = await supabase.from("sponsors").update(payload).eq("id", editing.id);
        if (error) throw error;
        id = editing.id;
        previousPath = editing.logo_storage_path;
      } else {
        const { data, error } = await supabase.from("sponsors").insert(payload).select("id").single();
        if (error) throw error;
        id = data.id as string;
      }
      await persistLogo("sponsor", id, { file: logoFile, clearedExisting: logoCleared, previousPath });
      toast.success(editing ? "Sponsor modifié" : "Sponsor créé");
      setOpen(false); load();
    } catch (err) {
      const e = err as { message?: string };
      toast.error("Échec", { description: friendlyError(e) });
    } finally {
      setSaving(false);
    }
  };


  const remove = async (s: Sponsor) => {
    if (!(await confirmAction({ title: "Supprimer ce sponsor ?", confirmLabel: "Supprimer", destructive: true }))) return;
    const { error } = await supabase.from("sponsors").delete().eq("id", s.id);
    if (error) toast.error("Échec", { description: friendlyError(error) });
    else { toast.success("Sponsor supprimé"); load(); }
  };

  const addRank = async () => {
    if (!newRank.trim()) return;
    const { error } = await supabase.from("sponsor_ranks").insert({
      name: newRank.trim(), sort_order: (ranks.at(-1)?.sort_order ?? 0) + 10,
    });
    if (error) toast.error("Échec", { description: friendlyError(error) });
    else { setNewRank(""); load(); }
  };
  const removeRank = async (r: Rank) => {
    if (!(await confirmAction({ title: `Supprimer le rang « ${r.name} » ?`, destructive: true, confirmLabel: "Supprimer" }))) return;
    const { error } = await supabase.from("sponsor_ranks").delete().eq("id", r.id);
    if (error) toast.error("Échec", { description: friendlyError(error) });
    else load();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2"><Star className="h-6 w-6 text-amber-500" /> Sponsors</h1>
          <p className="text-sm text-muted-foreground">Gestion des sponsors et de leurs rangs.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setRanksOpen(true)}>
            <Settings2 className="mr-2 h-4 w-4" /> Gérer les rangs
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setImportOpen(true)}>
              <Upload className="mr-2 h-4 w-4" /> Importer
            </Button>
            <Button onClick={openCreate} className="bg-primary hover:bg-[var(--cosl-red-dark)]">
              <Plus className="mr-2 h-4 w-4" /> Ajouter un sponsor
            </Button>
          </div>
        </div>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input className="pl-9" placeholder="Rechercher…" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <div className="rounded-lg border border-border bg-card">
        {rows === null ? (
          <TableSkeleton cols={6} />
        ) : filtered.length === 0 ? (
          <div className="p-6"><EmptyState message="Aucun sponsor." /></div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Logo</TableHead>
                <TableHead>Nom</TableHead>
                <TableHead>Rang</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Personne référente</TableHead>
                <TableHead className="w-28 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((s) => (
                <TableRow key={s.id}>
                  <TableCell>
                    {s.logo_url ? (
                      <img src={s.logo_url} alt={s.name} className="h-10 w-10 rounded object-contain border" />
                    ) : (
                      <div className="h-10 w-10 rounded border bg-muted" />
                    )}
                  </TableCell>
                  <TableCell className="font-medium">{s.name}</TableCell>
                  <TableCell>
                    {s.rank_id ? <Badge className="bg-amber-100 text-amber-800 border-amber-200">{rankName(s.rank_id)}</Badge> : "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    <div>{s.email ?? "—"}</div>
                    <div>{s.phone ?? ""}</div>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    <div>{[s.contact_first_name, s.contact_last_name].filter(Boolean).join(" ") || "—"}</div>
                    <div>{s.contact_email ?? ""} {s.contact_phone ? `· ${s.contact_phone}` : ""}</div>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(s)}><Pencil className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => remove(s)}><Trash2 className="h-4 w-4 text-red-600" /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <form onSubmit={submit}>
            <DialogHeader>
              <DialogTitle>{editing ? "Modifier le sponsor" : "Nouveau sponsor"}</DialogTitle>
              <DialogDescription>Renseignez les informations du sponsor.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="flex justify-center">
                <LogoFilePicker
                  currentUrl={editing?.logo_url}
                  file={logoFile}
                  onFileChange={setLogoFile}
                  clearedExisting={logoCleared}
                  onClearedExistingChange={setLogoCleared}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5 col-span-2">
                  <Label>Nom *</Label>
                  <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
                </div>
                <div className="space-y-1.5">
                  <Label>Email</Label>
                  <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Téléphone</Label>
                  <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                </div>
                <div className="space-y-1.5 col-span-2">
                  <Label>Rang</Label>
                  <Select value={form.rank_id} onValueChange={(v) => setForm({ ...form, rank_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Aucun rang" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Aucun rang</SelectItem>
                      {ranks.map((r) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="border-t pt-4">
                <p className="text-sm font-semibold mb-2">Personne référente</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Prénom</Label>
                    <Input value={form.contact_first_name} onChange={(e) => setForm({ ...form, contact_first_name: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Nom</Label>
                    <Input value={form.contact_last_name} onChange={(e) => setForm({ ...form, contact_last_name: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Email</Label>
                    <Input type="email" value={form.contact_email} onChange={(e) => setForm({ ...form, contact_email: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Téléphone</Label>
                    <Input value={form.contact_phone} onChange={(e) => setForm({ ...form, contact_phone: e.target.value })} />
                  </div>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Notes</Label>
                <Textarea rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
              <Button type="submit" disabled={saving} className="bg-primary hover:bg-[var(--cosl-red-dark)]">
                {saving ? "Enregistrement…" : editing ? "Enregistrer" : "Créer"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={ranksOpen} onOpenChange={setRanksOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Rangs de sponsors</DialogTitle>
            <DialogDescription>Ajouter ou supprimer les rangs disponibles.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            {ranks.map((r) => (
              <div key={r.id} className="flex items-center justify-between rounded border px-3 py-2">
                <span>{r.name}</span>
                <Button variant="ghost" size="icon" onClick={() => removeRank(r)}>
                  <Trash2 className="h-4 w-4 text-red-600" />
                </Button>
              </div>
            ))}
            {ranks.length === 0 && <p className="text-sm text-muted-foreground">Aucun rang.</p>}
          </div>
          <div className="flex gap-2">
            <Input placeholder="Nom du rang…" value={newRank} onChange={(e) => setNewRank(e.target.value)} />
            <Button onClick={addRank}>Ajouter</Button>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRanksOpen(false)}>Fermer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <CsvImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        config={sponsorsImportConfig}
        onImported={() => load()}
      />
    </div>
  );
}
