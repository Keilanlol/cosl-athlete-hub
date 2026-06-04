import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { friendlyError } from "@/lib/error-messages";
import { LogoFilePicker, persistLogo } from "@/components/LogoFilePicker";
import { AddressSearch } from "@/components/AddressSearch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated: (id: string) => void;
}

export function PartnerQuickCreateDialog({ open, onOpenChange, onCreated }: Props) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [street, setStreet] = useState("");
  const [postcode, setPostcode] = useState("");
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("");
  const [cFirst, setCFirst] = useState("");
  const [cLast, setCLast] = useState("");
  const [cEmail, setCEmail] = useState("");
  const [cPhone, setCPhone] = useState("");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoCleared, setLogoCleared] = useState(false);
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setName(""); setEmail(""); setPhone("");
    setStreet(""); setPostcode(""); setCity(""); setCountry("");
    setCFirst(""); setCLast(""); setCEmail(""); setCPhone("");
    setLogoFile(null); setLogoCleared(false);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { toast.error("Le nom est requis"); return; }
    setSaving(true);
    try {
      const { data, error } = await supabase.from("partners").insert({
        name: name.trim(),
        email: email.trim() || null,
        phone: phone.trim() || null,
        street: street.trim() || null,
        postcode: postcode.trim() || null,
        city: city.trim() || null,
        country: country.trim() || null,
        contact_first_name: cFirst.trim() || null,
        contact_last_name: cLast.trim() || null,
        contact_email: cEmail.trim() || null,
        contact_phone: cPhone.trim() || null,
      }).select("id").single();
      if (error) throw error;
      const id = data.id as string;
      await persistLogo("partner", id, { file: logoFile, clearedExisting: logoCleared, previousPath: null });
      toast.success("Partenaire créé");
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
            <DialogTitle>Nouveau partenaire</DialogTitle>
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
            </div>
            <div className="border-t pt-4">
              <p className="text-sm font-semibold mb-2">Adresse</p>
              <AddressSearch
                value={street}
                onChange={setStreet}
                onSelect={(a) => {
                  if (a.street) setStreet(a.street);
                  if (a.postcode) setPostcode(a.postcode);
                  if (a.city) setCity(a.city);
                  if (a.country) setCountry(a.country);
                }}
              />
              <div className="grid grid-cols-2 gap-3 mt-2">
                <div className="space-y-1.5">
                  <Label>Code postal</Label>
                  <Input value={postcode} onChange={(e) => setPostcode(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Ville</Label>
                  <Input value={city} onChange={(e) => setCity(e.target.value)} />
                </div>
                <div className="space-y-1.5 col-span-2">
                  <Label>Pays</Label>
                  <Input value={country} onChange={(e) => setCountry(e.target.value)} />
                </div>
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
