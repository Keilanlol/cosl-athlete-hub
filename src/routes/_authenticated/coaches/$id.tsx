import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Mail, Phone, Pencil, Trash2, UserCog } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { confirmAction } from "@/components/ConfirmDialog";
import {
  COACH_ROLES,
  type Athlete,
  type Club,
  type Coach,
  type Federation,
} from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/DataTableShell";

export const Route = createFileRoute("/_authenticated/coaches/$id")({
  component: CoachDetailPage,
});

const NONE = "__none__";

function initials(c: { first_name: string; last_name: string }) {
  return `${c.first_name?.[0] ?? ""}${c.last_name?.[0] ?? ""}`.toUpperCase();
}

function roleLabel(v: string) {
  return COACH_ROLES.find((r) => r.value === v)?.label ?? v;
}

function CoachDetailPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const [coach, setCoach] = useState<Coach | null>(null);
  const [fed, setFed] = useState<Federation | null>(null);
  const [club, setClub] = useState<Club | null>(null);
  const [athletes, setAthletes] = useState<(Athlete & { relation_role: string; start_date: string; end_date: string | null })[]>([]);
  const [feds, setFeds] = useState<Federation[]>([]);
  const [clubs, setClubs] = useState<Club[]>([]);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    role: "coach",
    federation_id: NONE,
    club_id: NONE,
    is_active: true,
  });

  const load = async () => {
    const { data, error } = await supabase.from("coaches").select("*").eq("id", id).maybeSingle();
    if (error || !data) {
      toast.error("Encadrant introuvable");
      navigate({ to: "/coaches" });
      return;
    }
    const c = data as Coach;
    setCoach(c);
    const [f, cl, rel, fedsAll, clubsAll] = await Promise.all([
      c.federation_id
        ? supabase.from("federations").select("*").eq("id", c.federation_id).maybeSingle()
        : Promise.resolve({ data: null }),
      c.club_id
        ? supabase.from("clubs").select("*").eq("id", c.club_id).maybeSingle()
        : Promise.resolve({ data: null }),
      supabase
        .from("athlete_relations")
        .select("relation_role,start_date,end_date,athlete:athletes(*)")
        .eq("coach_id", id),
      supabase.from("federations").select("*").order("acronym"),
      supabase.from("clubs").select("*").order("name"),
    ]);
    setFed((f.data ?? null) as Federation | null);
    setClub((cl.data ?? null) as Club | null);
    setAthletes(
      (rel.data ?? [])
        .flatMap((r: { relation_role: string; start_date: string; end_date: string | null; athlete: Athlete | Athlete[] | null }) => {
          const a = Array.isArray(r.athlete) ? r.athlete[0] : r.athlete;
          if (!a) return [];
          return [{ ...a, relation_role: r.relation_role, start_date: r.start_date, end_date: r.end_date }];
        }),
    );
    setFeds((fedsAll.data ?? []) as Federation[]);
    setClubs((clubsAll.data ?? []) as Club[]);
  };

  useEffect(() => {
    load();
     
  }, [id]);

  const openEdit = () => {
    if (!coach) return;
    setForm({
      first_name: coach.first_name,
      last_name: coach.last_name,
      email: coach.email ?? "",
      phone: coach.phone ?? "",
      role: coach.role,
      federation_id: coach.federation_id ?? NONE,
      club_id: coach.club_id ?? NONE,
      is_active: coach.is_active ?? true,
    });
    setOpen(true);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!coach) return;
    setSaving(true);
    const payload = {
      first_name: form.first_name.trim(),
      last_name: form.last_name.trim(),
      email: form.email.trim() || null,
      phone: form.phone.trim() || null,
      role: form.role,
      federation_id: form.federation_id === NONE ? null : form.federation_id,
      club_id: form.club_id === NONE ? null : form.club_id,
      is_active: form.is_active,
    };
    const { error } = await supabase.from("coaches").update(payload).eq("id", coach.id);
    setSaving(false);
    if (error) {
      toast.error("Échec", { description: error.message });
      return;
    }
    toast.success("Encadrant modifié");
    setOpen(false);
    load();
  };

  const remove = async () => {
    if (!coach) return;
    const ok = await confirmAction({
      title: "Supprimer cet encadrant ?",
      description: "Cette action est irréversible.",
      confirmLabel: "Supprimer",
      destructive: true,
    });
    if (!ok) return;
    const { error } = await supabase.from("coaches").delete().eq("id", coach.id);
    if (error) {
      toast.error("Suppression impossible", { description: error.message });
      return;
    }
    toast.success("Encadrant supprimé");
    navigate({ to: "/coaches" });
  };

  if (!coach) {
    return <div className="p-6 text-sm text-slate-500">Chargement…</div>;
  }

  const clubsForForm =
    form.federation_id && form.federation_id !== NONE
      ? clubs.filter((c) => c.federation_id === form.federation_id)
      : clubs;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Link
          to="/coaches"
          className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" /> Retour aux encadrants
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

      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <div className="flex flex-wrap items-center gap-5">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-indigo-100 text-2xl font-semibold text-indigo-700">
            {initials(coach)}
          </div>
          <div className="flex-1">
            <h1 className="text-2xl font-semibold text-slate-900">
              {coach.first_name} {coach.last_name}
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Badge variant="secondary" className="gap-1">
                <UserCog className="h-3 w-3" /> {roleLabel(coach.role)}
              </Badge>
              {coach.is_active ? (
                <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
                  Actif
                </Badge>
              ) : (
                <Badge variant="outline">Inactif</Badge>
              )}
              {fed && (
                <Link to="/federations/$id" params={{ id: fed.id }}>
                  <Badge variant="outline" className="font-mono hover:bg-slate-100">
                    {fed.acronym}
                  </Badge>
                </Link>
              )}
              {club && (
                <Link
                  to="/clubs/$id"
                  params={{ id: club.id }}
                  className="text-sm text-indigo-600 hover:underline"
                >
                  {club.name}
                </Link>
              )}
            </div>
          </div>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <InfoLine icon={<Mail className="h-4 w-4" />} label="Email">
            {coach.email ? (
              <a href={`mailto:${coach.email}`} className="text-indigo-600 hover:underline">
                {coach.email}
              </a>
            ) : (
              "—"
            )}
          </InfoLine>
          <InfoLine icon={<Phone className="h-4 w-4" />} label="Téléphone">
            {coach.phone ?? "—"}
          </InfoLine>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white">
        <div className="border-b border-slate-200 p-4">
          <h2 className="text-sm font-semibold text-slate-900">
            Athlètes encadrés ({athletes.length})
          </h2>
        </div>
        {athletes.length === 0 ? (
          <div className="p-6">
            <EmptyState message="Aucun athlète lié à cet encadrant." />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nom</TableHead>
                <TableHead>COSL ID</TableHead>
                <TableHead>Rôle relation</TableHead>
                <TableHead>Depuis</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {athletes.map((a) => (
                <TableRow key={a.id}>
                  <TableCell className="font-medium">
                    <Link
                      to="/athletes/$id"
                      params={{ id: a.id }}
                      className="text-indigo-600 hover:underline"
                    >
                      {a.first_name} {a.last_name}
                    </Link>
                  </TableCell>
                  <TableCell className="font-mono text-xs text-slate-600">
                    {a.cosl_id}
                  </TableCell>
                  <TableCell className="text-slate-600">{a.relation_role}</TableCell>
                  <TableCell className="text-xs text-slate-500">
                    {a.start_date}
                    {a.end_date ? ` → ${a.end_date}` : ""}
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
              <DialogTitle>Modifier l'encadrant</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Prénom *</Label>
                  <Input
                    value={form.first_name}
                    onChange={(e) => setForm({ ...form, first_name: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Nom *</Label>
                  <Input
                    value={form.last_name}
                    onChange={(e) => setForm({ ...form, last_name: e.target.value })}
                    required
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Email</Label>
                  <Input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Téléphone</Label>
                  <Input
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Rôle *</Label>
                <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {COACH_ROLES.map((r) => (
                      <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Fédération</Label>
                  <Select
                    value={form.federation_id}
                    onValueChange={(v) => setForm({ ...form, federation_id: v, club_id: NONE })}
                  >
                    <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>Aucune</SelectItem>
                      {feds.map((f) => (
                        <SelectItem key={f.id} value={f.id}>{f.acronym}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Club</Label>
                  <Select
                    value={form.club_id}
                    onValueChange={(v) => setForm({ ...form, club_id: v })}
                  >
                    <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>Aucun</SelectItem>
                      {clubsForForm.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Switch
                  checked={form.is_active}
                  onCheckedChange={(v) => setForm({ ...form, is_active: v })}
                />
                <Label>Actif</Label>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Annuler
              </Button>
              <Button type="submit" disabled={saving} className="bg-indigo-500 hover:bg-indigo-600">
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
      <div className="mt-0.5 text-slate-400">{icon}</div>
      <div>
        <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
        <div className="text-sm text-slate-800">{children}</div>
      </div>
    </div>
  );
}
