import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { friendlyError } from "@/lib/error-messages";
import { useEffect, useState } from "react";
import { ArrowLeft, Mail, MapPin, Pencil, Phone, Trash2, UserRound, CalendarDays, FileText } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { confirmAction } from "@/components/ConfirmDialog";
import {
  FEDERATION_MEMBER_ROLES,
  type Federation,
  type FederationMember,
} from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EntityImageUpload } from "@/components/EntityImageUpload";

export const Route = createFileRoute("/_authenticated/federations/members/$memberId")({
  component: FedMemberDetailPage,
});

function initials(m: { first_name: string; last_name: string }) {
  return `${m.first_name?.[0] ?? ""}${m.last_name?.[0] ?? ""}`.toUpperCase();
}

function roleLabel(v: string) {
  return FEDERATION_MEMBER_ROLES.find((r) => r.value === v)?.label ?? v;
}

function FedMemberDetailPage() {
  const { memberId } = Route.useParams();
  const navigate = useNavigate();
  const [member, setMember] = useState<FederationMember | null>(null);
  const [fed, setFed] = useState<Federation | null>(null);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    role: "president",
    email: "",
    phone: "",
    address: "",
    start_date: "",
    end_date: "",
    notes: "",
    is_active: true,
  });

  const load = async () => {
    const { data, error } = await supabase
      .from("federation_members")
      .select("*")
      .eq("id", memberId)
      .maybeSingle();
    if (error || !data) {
      toast.error("Membre introuvable");
      navigate({ to: "/federations" });
      return;
    }
    const m = data as FederationMember;
    setMember(m);
    const { data: f } = await supabase
      .from("federations")
      .select("*")
      .eq("id", m.federation_id)
      .maybeSingle();
    setFed((f ?? null) as Federation | null);
  };

  useEffect(() => {
    load();
     
  }, [memberId]);

  const openEdit = () => {
    if (!member) return;
    setForm({
      first_name: member.first_name,
      last_name: member.last_name,
      role: member.role,
      email: member.email ?? "",
      phone: member.phone ?? "",
      address: member.address ?? "",
      start_date: member.start_date ?? "",
      end_date: member.end_date ?? "",
      notes: member.notes ?? "",
      is_active: member.is_active ?? true,
    });
    setOpen(true);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!member) return;
    setSaving(true);
    const payload = {
      first_name: form.first_name.trim(),
      last_name: form.last_name.trim(),
      role: form.role,
      email: form.email.trim() || null,
      phone: form.phone.trim() || null,
      address: form.address.trim() || null,
      start_date: form.start_date || null,
      end_date: form.end_date || null,
      notes: form.notes.trim() || null,
      is_active: form.is_active,
    };
    const { error } = await supabase
      .from("federation_members")
      .update(payload)
      .eq("id", member.id);
    setSaving(false);
    if (error) {
      toast.error("Échec", { description: friendlyError(error) });
      return;
    }
    toast.success("Membre modifié");
    setOpen(false);
    load();
  };

  const remove = async () => {
    if (!member) return;
    const ok = await confirmAction({
      title: "Supprimer ce membre ?",
      description: "Cette action est irréversible.",
      confirmLabel: "Supprimer",
      destructive: true,
    });
    if (!ok) return;
    const { error } = await supabase.from("federation_members").delete().eq("id", member.id);
    if (error) {
      toast.error("Suppression impossible", { description: friendlyError(error) });
      return;
    }
    toast.success("Membre supprimé");
    navigate({ to: "/federations/$id", params: { id: member.federation_id } });
  };

  if (!member) return <div className="p-6 text-sm text-muted-foreground">Chargement…</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Link
          to="/federations/$id"
          params={{ id: member.federation_id }}
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Retour à la fédération
        </Link>
        <div className="flex gap-2">
          <Button variant="outline" onClick={openEdit}>
            <Pencil className="mr-2 h-4 w-4" /> Modifier
          </Button>
          <Button variant="outline" onClick={remove} className="text-red-600">
            <Trash2 className="mr-2 h-4 w-4" /> Supprimer
          </Button>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-6">
        <div className="flex flex-wrap items-center gap-5">
          <EntityImageUpload
            entityId={member.id}
            entityType="federation_member"
            currentImageUrl={member.photo_url}
            currentStoragePath={member.photo_storage_path}
            shape="circle"
            size="lg"
            placeholder={initials(member)}
            onUploaded={async (url, path) => {
              await supabase
                .from("federation_members")
                .update({ photo_url: url, photo_storage_path: path })
                .eq("id", member.id);
              setMember((m) =>
                m ? { ...m, photo_url: url, photo_storage_path: path } : m,
              );
            }}
            onDeleted={async () => {
              await supabase
                .from("federation_members")
                .update({ photo_url: null, photo_storage_path: null })
                .eq("id", member.id);
              setMember((m) =>
                m ? { ...m, photo_url: null, photo_storage_path: null } : m,
              );
            }}
          />
          <div className="flex-1">
            <h1 className="text-2xl font-semibold text-foreground">
              {member.first_name} {member.last_name}
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Badge variant="secondary" className="gap-1">
                <UserRound className="h-3 w-3" /> {roleLabel(member.role)}
              </Badge>
              {(member.is_active ?? true) ? (
                <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">Actif</Badge>
              ) : (
                <Badge variant="outline">Inactif</Badge>
              )}
              {fed && (
                <Link to="/federations/$id" params={{ id: fed.id }}>
                  <Badge variant="outline" className="font-mono hover:bg-muted">
                    {fed.acronym}
                  </Badge>
                </Link>
              )}
            </div>
          </div>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <InfoLine icon={<Mail className="h-4 w-4" />} label="Email">
            {member.email ? (
              <a href={`mailto:${member.email}`} className="text-[var(--lux-blue)] hover:underline">
                {member.email}
              </a>
            ) : "—"}
          </InfoLine>
          <InfoLine icon={<Phone className="h-4 w-4" />} label="Téléphone">
            {member.phone ?? "—"}
          </InfoLine>
          <InfoLine icon={<MapPin className="h-4 w-4" />} label="Adresse">
            {member.address ?? "—"}
          </InfoLine>
          <InfoLine icon={<CalendarDays className="h-4 w-4" />} label="Mandat">
            {member.start_date ?? "—"}{member.end_date ? ` → ${member.end_date}` : ""}
          </InfoLine>
          {member.notes && (
            <div className="sm:col-span-2">
              <InfoLine icon={<FileText className="h-4 w-4" />} label="Notes">
                <div className="whitespace-pre-wrap">{member.notes}</div>
              </InfoLine>
            </div>
          )}
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <form onSubmit={submit}>
            <DialogHeader>
              <DialogTitle>Modifier le membre</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Prénom *</Label>
                  <Input value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} required />
                </div>
                <div className="space-y-1.5">
                  <Label>Nom *</Label>
                  <Input value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} required />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Fonction *</Label>
                <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {FEDERATION_MEMBER_ROLES.map((r) => (
                      <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Email</Label>
                  <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Téléphone</Label>
                  <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Adresse</Label>
                <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Début mandat</Label>
                  <Input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Fin mandat</Label>
                  <Input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Notes</Label>
                <Textarea rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
              </div>
              <div className="flex items-center gap-3">
                <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
                <Label>Actif</Label>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
              <Button type="submit" disabled={saving} className="bg-primary hover:bg-[var(--cosl-red-dark)]">
                {saving ? "Enregistrement…" : "Enregistrer"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function InfoLine({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5 text-muted-foreground">{icon}</div>
      <div>
        <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className="text-sm text-foreground">{children}</div>
      </div>
    </div>
  );
}
