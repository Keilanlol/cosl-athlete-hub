import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { friendlyError } from "@/lib/error-messages";
import { LogoFilePicker, persistLogo } from "@/components/LogoFilePicker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

export type Rank = { id: string; name: string };

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  ranks: Rank[];
  /** Called with the new sponsor id once created (and logo uploaded). */
  onCreated: (id: string) => void;
}

export function SponsorQuickCreateDialog({ open, onOpenChange, ranks, onCreated }: Props) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [rankId, setRankId] = useState<string>("__none__");
  const [cFirst, setCFirst] = useState("");
  const [cLast, setCLast] = useState("");
  const [cEmail, setCEmail] = useState("");
  const [cPhone, setCPhone] = useState("");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoCleared, setLogoCleared] = useState(false);
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setName(""); setEmail(""); setPhone(""); setRankId("__none__");
    setCFirst(""); setCLast(""); setCEmail(""); setCPhone("");
    setLogoFile(null); setLogoCleared(false);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { toast.error("Le nom est requis"); return; }
    setSaving(true);
    try {
      const { data, error } = await supabase.from("sponsors").insert({
        name: name.trim(),
        email: email.trim() || null,
        phone: phone.trim() || null,
        rank_id: rankId === "__none__" ? null : rankId,
        contact_first_name: cFirst.trim() || null,
        contact_last_name: cLast.trim() || null,
        contact_email: cEmail.trim() || null,
        contact_phone: cPhone.trim() || null,
      }).select("id").single();
      if (error) throw error;
      const id = data.id as string;
      await persistLogo("sponsor", id, { file: logoFile, clearedExisting: logoCleared, previousPath: null });
      toast.success("Sponsor créé");
      reset();
      onOpenChange(false);
      onCreated(id);
    } catch (err) {
      toast.error("Échec", { description: friendlyError(err as { message?: string }) });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) reset(); }}>
      <DialogContent>
        <form onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>Nouveau sponsor</DialogTitle>
            <DialogDescription>Il sera automatiquement lié à ce Games.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="flex justify-center">
              <LogoFilePicker
                file={logoFile}
                onFileChange={setLogoFile}
                clearedExisting={logoCleared}
                onClearedExistingChange={setLogoCleared}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5 col-span-2">
                <Label>Nom *</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} required />
              </div>
              <div className="space-y-1.5">
                <Label>Email</Label>
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Téléphone</Label>
                <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
              </div>
              <div className="space-y-1.5 col-span-2">
                <Label>Rang</Label>
                <Select value={rankId} onValueChange={setRankId}>
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
                  <Input value={cFirst} onChange={(e) => setCFirst(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Nom</Label>
                  <Input value={cLast} onChange={(e) => setCLast(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Email</Label>
                  <Input type="email" value={cEmail} onChange={(e) => setCEmail(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Téléphone</Label>
                  <Input value={cPhone} onChange={(e) => setCPhone(e.target.value)} />
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
            <Button type="submit" disabled={saving} className="bg-primary hover:bg-[var(--cosl-red-dark)]">
              {saving ? "Création…" : "Créer et lier"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
