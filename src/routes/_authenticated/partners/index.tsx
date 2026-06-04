import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Plus, Pencil, Trash2, Search, Handshake } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { friendlyError } from "@/lib/error-messages";
import { confirmAction } from "@/components/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { EntityImageUpload } from "@/components/EntityImageUpload";
import { AddressSearch } from "@/components/AddressSearch";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { EmptyState, TableSkeleton } from "@/components/DataTableShell";

export const Route = createFileRoute("/_authenticated/partners/")({
  component: PartnersPage,
});

type Partner = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  logo_url: string | null;
  logo_storage_path: string | null;
  street: string | null;
  postcode: string | null;
  city: string | null;
  country: string | null;
  contact_first_name: string | null;
  contact_last_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  notes: string | null;
  is_active: boolean;
};

const empty = {
  name: "", email: "", phone: "",
  street: "", postcode: "", city: "", country: "",
  contact_first_name: "", contact_last_name: "", contact_email: "", contact_phone: "",
  notes: "",
};

function PartnersPage() {
  const [rows, setRows] = useState<Partner[] | null>(null);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Partner | null>(null);
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setRows(null);
    const { data, error } = await supabase.from("partners").select("*").order("name");
    if (error) { toast.error("Erreur", { description: friendlyError(error) }); setRows([]); return; }
    setRows((data ?? []) as Partner[]);
  };
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!rows) return [];
    if (!q) return rows;
    return rows.filter((p) =>
      `${p.name} ${p.email ?? ""} ${p.city ?? ""} ${p.contact_first_name ?? ""} ${p.contact_last_name ?? ""}`
        .toLowerCase().includes(q),
    );
  }, [rows, search]);

  const openCreate = () => { setEditing(null); setForm(empty); setOpen(true); };
  const openEdit = (p: Partner) => {
    setEditing(p);
    setForm({
      name: p.name, email: p.email ?? "", phone: p.phone ?? "",
      street: p.street ?? "", postcode: p.postcode ?? "", city: p.city ?? "", country: p.country ?? "",
      contact_first_name: p.contact_first_name ?? "",
      contact_last_name: p.contact_last_name ?? "",
      contact_email: p.contact_email ?? "",
      contact_phone: p.contact_phone ?? "",
      notes: p.notes ?? "",
    });
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
      street: form.street.trim() || null,
      postcode: form.postcode.trim() || null,
      city: form.city.trim() || null,
      country: form.country.trim() || null,
      contact_first_name: form.contact_first_name.trim() || null,
      contact_last_name: form.contact_last_name.trim() || null,
      contact_email: form.contact_email.trim() || null,
      contact_phone: form.contact_phone.trim() || null,
      notes: form.notes.trim() || null,
    };
    const { error } = editing
      ? await supabase.from("partners").update(payload).eq("id", editing.id)
      : await supabase.from("partners").insert(payload);
    setSaving(false);
    if (error) { toast.error("Échec", { description: friendlyError(error) }); return; }
    toast.success(editing ? "Partenaire modifié" : "Partenaire créé");
    setOpen(false); load();
  };

  const remove = async (p: Partner) => {
    if (!(await confirmAction({ title: "Supprimer ce partenaire ?", confirmLabel: "Supprimer", destructive: true }))) return;
    const { error } = await supabase.from("partners").delete().eq("id", p.id);
    if (error) toast.error("Échec", { description: friendlyError(error) });
    else { toast.success("Partenaire supprimé"); load(); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2"><Handshake className="h-6 w-6 text-indigo-500" /> Partenaires</h1>
          <p className="text-sm text-muted-foreground">Gestion des partenaires.</p>
        </div>
        <Button onClick={openCreate} className="bg-primary hover:bg-[var(--cosl-red-dark)]">
          <Plus className="mr-2 h-4 w-4" /> Ajouter un partenaire
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input className="pl-9" placeholder="Rechercher…" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <div className="rounded-lg border border-border bg-card">
        {rows === null ? (
          <TableSkeleton cols={6} />
        ) : filtered.length === 0 ? (
          <div className="p-6"><EmptyState message="Aucun partenaire." /></div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Logo</TableHead>
                <TableHead>Nom</TableHead>
                <TableHead>Adresse</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Personne référente</TableHead>
                <TableHead className="w-28 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>
                    {p.logo_url ? (
                      <img src={p.logo_url} alt={p.name} className="h-10 w-10 rounded object-contain border" />
                    ) : (
                      <div className="h-10 w-10 rounded border bg-muted" />
                    )}
                  </TableCell>
                  <TableCell className="font-medium">{p.name}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {[p.street, [p.postcode, p.city].filter(Boolean).join(" "), p.country].filter(Boolean).join(", ") || "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    <div>{p.email ?? "—"}</div>
                    <div>{p.phone ?? ""}</div>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    <div>{[p.contact_first_name, p.contact_last_name].filter(Boolean).join(" ") || "—"}</div>
                    <div>{p.contact_email ?? ""} {p.contact_phone ? `· ${p.contact_phone}` : ""}</div>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(p)}><Pencil className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => remove(p)}><Trash2 className="h-4 w-4 text-red-600" /></Button>
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
              <DialogTitle>{editing ? "Modifier le partenaire" : "Nouveau partenaire"}</DialogTitle>
              <DialogDescription>Renseignez les informations du partenaire.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              {editing && (
                <div className="flex justify-center">
                  <EntityImageUpload
                    entityId={editing.id}
                    entityType="partner"
                    currentImageUrl={editing.logo_url}
                    currentStoragePath={editing.logo_storage_path}
                    shape="square"
                    placeholder={editing.name.slice(0, 2).toUpperCase()}
                    label="Logo"
                    onUploaded={async (url, path) => {
                      await supabase.from("partners").update({ logo_url: url, logo_storage_path: path }).eq("id", editing.id);
                      setEditing({ ...editing, logo_url: url, logo_storage_path: path });
                      load();
                    }}
                    onDeleted={async () => {
                      await supabase.from("partners").update({ logo_url: null, logo_storage_path: null }).eq("id", editing.id);
                      setEditing({ ...editing, logo_url: null, logo_storage_path: null });
                      load();
                    }}
                  />
                </div>
              )}
              {!editing && (
                <p className="text-xs text-muted-foreground text-center">Le logo pourra être ajouté après la création.</p>
              )}
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
              </div>
              <div className="border-t pt-4">
                <p className="text-sm font-semibold mb-2">Adresse</p>
                <AddressSearch
                  value={form.street}
                  onChange={(v) => setForm((f) => ({ ...f, street: v }))}
                  onSelect={(a) => setForm((f) => ({
                    ...f,
                    street: a.street ?? f.street,
                    postcode: a.postcode ?? f.postcode,
                    city: a.city ?? f.city,
                    country: a.country ?? f.country,
                  }))}
                />

                <div className="grid grid-cols-2 gap-3 mt-2">
                  <div className="space-y-1.5 col-span-2">
                    <Label>Rue</Label>
                    <Input value={form.street} onChange={(e) => setForm({ ...form, street: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Code postal</Label>
                    <Input value={form.postcode} onChange={(e) => setForm({ ...form, postcode: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Ville</Label>
                    <Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
                  </div>
                  <div className="space-y-1.5 col-span-2">
                    <Label>Pays</Label>
                    <Input value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} />
                  </div>
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
    </div>
  );
}
