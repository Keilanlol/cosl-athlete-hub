import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { friendlyError } from "@/lib/error-messages";
import {
  PERSON_ROLE_TYPES,
  ROLE_LABELS,
  type PersonRoleType,
} from "@/lib/persons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (personId: string) => void;
};

const empty = {
  first_name: "",
  last_name: "",
  email: "",
  phone: "",
  birth_date: "",
};

export function PersonCreateDialog({ open, onOpenChange, onCreated }: Props) {
  const [form, setForm] = useState(empty);
  const [roles, setRoles] = useState<PersonRoleType[]>([]);
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setForm(empty);
    setRoles([]);
  };

  const toggleRole = (r: PersonRoleType) =>
    setRoles((cur) => (cur.includes(r) ? cur.filter((x) => x !== r) : [...cur, r]));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.first_name.trim() || !form.last_name.trim()) {
      toast.error("Prénom et nom requis");
      return;
    }
    setSaving(true);

    const { data: person, error } = await supabase
      .from("persons")
      .insert({
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        birth_date: form.birth_date || null,
        is_active: true,
      })
      .select("id")
      .single();

    if (error || !person) {
      setSaving(false);
      toast.error("Échec de la création", { description: friendlyError(error) });
      return;
    }

    if (roles.length > 0) {
      const { error: rErr } = await supabase
        .from("person_roles")
        .insert(roles.map((r) => ({ person_id: person.id, role_type: r })));
      if (rErr) {
        toast.error("Personne créée mais erreur sur les rôles", {
          description: friendlyError(rErr),
        });
      }
    }

    setSaving(false);
    toast.success("Personne créée");
    onOpenChange(false);
    reset();
    onCreated?.(person.id);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) reset();
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>Nouvelle personne</DialogTitle>
            <DialogDescription>
              Crée une personne physique puis assigne-lui un ou plusieurs rôles.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="fn">Prénom *</Label>
                <Input
                  id="fn"
                  value={form.first_name}
                  onChange={(e) => setForm({ ...form, first_name: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ln">Nom *</Label>
                <Input
                  id="ln"
                  value={form.last_name}
                  onChange={(e) => setForm({ ...form, last_name: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="em">Email</Label>
                <Input
                  id="em"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ph">Téléphone</Label>
                <Input
                  id="ph"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="bd">Date de naissance</Label>
              <Input
                id="bd"
                type="date"
                value={form.birth_date}
                onChange={(e) => setForm({ ...form, birth_date: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label>Rôles</Label>
              <div className="grid grid-cols-2 gap-2 rounded-md border border-border p-3">
                {PERSON_ROLE_TYPES.map((r) => (
                  <label key={r} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={roles.includes(r)}
                      onCheckedChange={() => toggleRole(r)}
                    />
                    {ROLE_LABELS[r]}
                  </label>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Annuler
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Création…" : "Créer"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
