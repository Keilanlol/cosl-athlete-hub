import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { type LocalTransport } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AddressSearch } from "@/components/AddressSearch";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { LogisticsTabs } from "@/components/LogisticsTabs";
import { TableSkeleton, EmptyState } from "@/components/DataTableShell";

export const Route = createFileRoute("/_authenticated/games/$id/logistics/transport")({
  component: TransportPage,
});

type Form = {
  transport_type: string;
  pickup_location: string;
  dropoff_location: string;
  pickup_time: string;
  capacity: string;
  notes: string;
};

const empty: Form = {
  transport_type: "",
  pickup_location: "",
  dropoff_location: "",
  pickup_time: "",
  capacity: "",
  notes: "",
};

function TransportPage() {
  const { id } = Route.useParams();
  const [items, setItems] = useState<LocalTransport[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Form>(empty);
  const [confirmDel, setConfirmDel] = useState<LocalTransport | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("local_transports")
      .select("*")
      .eq("game_id", id)
      .order("pickup_time");
    setLoading(false);
    if (error) return toast.error("Erreur de chargement", { description: error.message });
    setItems((data ?? []) as LocalTransport[]);
  };

  useEffect(() => { load(); }, [id]);

  const submit = async () => {
    if (!form.transport_type.trim()) return toast.error("Type requis");
    if (!form.pickup_location.trim() || !form.dropoff_location.trim())
      return toast.error("Pickup et dropoff requis");
    if (!form.pickup_time) return toast.error("Heure requise");

    const payload = {
      game_id: id,
      transport_type: form.transport_type.trim(),
      pickup_location: form.pickup_location.trim(),
      dropoff_location: form.dropoff_location.trim(),
      pickup_time: form.pickup_time,
      capacity: form.capacity ? parseInt(form.capacity, 10) : null,
      notes: form.notes.trim() || null,
    };
    const { error } = await supabase.from("local_transports").insert(payload);
    if (error) return toast.error("Échec", { description: error.message });
    toast.success("Transport ajouté");
    setOpen(false);
    setForm(empty);
    load();
  };

  const remove = async () => {
    if (!confirmDel) return;
    const { error } = await supabase.from("local_transports").delete().eq("id", confirmDel.id);
    if (error) toast.error("Échec", { description: error.message });
    else { toast.success("Transport supprimé"); load(); }
    setConfirmDel(null);
  };

  const fmtDt = (s: string) =>
    new Date(s).toLocaleString("fr-FR", {
      day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
    });

  return (
    <div className="space-y-6">
      <LogisticsTabs id={id} />

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Transports locaux</h2>
          <p className="text-sm text-slate-500">Navettes, bus, transferts.</p>
        </div>
        <Button onClick={() => setOpen(true)} className="bg-indigo-500 hover:bg-indigo-600">
          <Plus className="mr-2 h-4 w-4" /> Ajouter un transport
        </Button>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white">
        {loading ? (
          <TableSkeleton cols={7} />
        ) : items.length === 0 ? (
          <div className="p-6"><EmptyState message="Aucun transport enregistré." /></div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead>Pickup</TableHead>
                <TableHead>Dropoff</TableHead>
                <TableHead>Heure</TableHead>
                <TableHead>Capacité</TableHead>
                <TableHead>Notes</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="font-medium">{t.transport_type}</TableCell>
                  <TableCell>{t.pickup_location}</TableCell>
                  <TableCell>{t.dropoff_location}</TableCell>
                  <TableCell>{fmtDt(t.pickup_time)}</TableCell>
                  <TableCell>{t.capacity ?? "—"}</TableCell>
                  <TableCell className="max-w-xs truncate">{t.notes ?? "—"}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-red-600 hover:text-red-700"
                      onClick={() => setConfirmDel(t)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Ajouter un transport</DialogTitle></DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label>Type</Label>
              <Input value={form.transport_type} onChange={(e) => setForm({ ...form, transport_type: e.target.value })} placeholder="navette, bus…" />
            </div>
            <div className="space-y-1">
              <Label>Capacité</Label>
              <Input type="number" min={0} value={form.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>Pickup</Label>
              <Input value={form.pickup_location} onChange={(e) => setForm({ ...form, pickup_location: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>Dropoff</Label>
              <Input value={form.dropoff_location} onChange={(e) => setForm({ ...form, dropoff_location: e.target.value })} />
            </div>
            <div className="sm:col-span-2 space-y-1">
              <Label>Heure de pickup</Label>
              <Input type="datetime-local" value={form.pickup_time} onChange={(e) => setForm({ ...form, pickup_time: e.target.value })} />
            </div>
            <div className="sm:col-span-2 space-y-1">
              <Label>Notes</Label>
              <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
            <Button onClick={submit} className="bg-indigo-500 hover:bg-indigo-600">Créer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!confirmDel} onOpenChange={(o) => !o && setConfirmDel(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce transport ?</AlertDialogTitle>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={remove} className="bg-red-600 hover:bg-red-700">
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
