import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Mail, Phone, MapPin, Pencil, Trash2, Plus, X, ArrowRight, Building2, Trophy, Users, Shield } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { friendlyError } from "@/lib/error-messages";
import { confirmAction } from "@/components/ConfirmDialog";
import {
  PERSON_ROLE_TYPES,
  ROLE_LABELS,
  personFullName,
  type AthleteProfile,
  type ClubMemberProfile,
  type CoachProfile,
  type FederationMemberProfile,
  type Person,
  type PersonRole,
  type PersonRoleType,
} from "@/lib/persons";
import { PersonRoleBadge } from "@/components/persons/PersonRoleBadge";
import { AddRoleDialog } from "@/components/persons/AddRoleDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EntityImageUpload } from "@/components/EntityImageUpload";
import { syncPhotoFromPerson } from "@/lib/person-photo-sync";


export const Route = createFileRoute("/_authenticated/persons/$personId")({
  component: PersonDetailPage,
});

type PersonBundle = {
  person: Person;
  roles: PersonRole[];
  athlete_profile: AthleteProfile | null;
  coach_profiles: CoachProfile[];
  federation_member_profiles: FederationMemberProfile[];
  club_member_profiles: ClubMemberProfile[];
};

function initials(p: Pick<Person, "first_name" | "last_name">) {
  return `${p.first_name?.[0] ?? ""}${p.last_name?.[0] ?? ""}`.toUpperCase();
}

function PersonDetailPage() {
  const { personId } = Route.useParams();
  const navigate = useNavigate();
  const [bundle, setBundle] = useState<PersonBundle | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [rolesOpen, setRolesOpen] = useState(false);
  const [addRoleTarget, setAddRoleTarget] = useState<PersonRoleType | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    birth_date: "",
    nationality: "",
    street: "",
    postcode: "",
    city: "",
    country: "",
    is_active: true,
  });

  const load = async () => {
    const [pRes, rRes, apRes, cpRes, fmRes, cmRes] = await Promise.all([
      supabase.from("persons").select("*").eq("id", personId).maybeSingle(),
      supabase
        .from("person_roles")
        .select("*")
        .eq("person_id", personId)
        .order("created_at"),
      supabase
        .from("athlete_profiles")
        .select("*")
        .eq("person_id", personId)
        .maybeSingle(),
      supabase.from("coach_profiles").select("*").eq("person_id", personId),
      supabase
        .from("federation_member_profiles")
        .select("*")
        .eq("person_id", personId),
      supabase.from("club_member_profiles").select("*").eq("person_id", personId),
    ]);

    if (pRes.error || !pRes.data) {
      toast.error("Personne introuvable");
      navigate({ to: "/persons" });
      return;
    }
    setBundle({
      person: pRes.data as Person,
      roles: (rRes.data ?? []) as PersonRole[],
      athlete_profile: (apRes.data as AthleteProfile | null) ?? null,
      coach_profiles: (cpRes.data ?? []) as CoachProfile[],
      federation_member_profiles: (fmRes.data ?? []) as FederationMemberProfile[],
      club_member_profiles: (cmRes.data ?? []) as ClubMemberProfile[],
    });
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [personId]);

  const activeRoles: PersonRoleType[] = useMemo(
    () =>
      bundle?.roles
        .filter((r) => r.is_active)
        .map((r) => r.role_type as PersonRoleType) ?? [],
    [bundle],
  );

  const openEdit = () => {
    if (!bundle) return;
    const p = bundle.person;
    setForm({
      first_name: p.first_name,
      last_name: p.last_name,
      email: p.email ?? "",
      phone: p.phone ?? "",
      birth_date: p.birth_date ?? "",
      nationality: p.nationality ?? "",
      street: p.street ?? "",
      postcode: p.postcode ?? "",
      city: p.city ?? "",
      country: p.country ?? "",
      is_active: p.is_active,
    });
    setEditOpen(true);
  };

  const saveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.first_name.trim() || !form.last_name.trim()) {
      toast.error("Prénom et nom requis");
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from("persons")
      .update({
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        birth_date: form.birth_date || null,
        nationality: form.nationality.trim() || null,
        street: form.street.trim() || null,
        postcode: form.postcode.trim() || null,
        city: form.city.trim() || null,
        country: form.country.trim() || null,
        is_active: form.is_active,
      })
      .eq("id", personId);
    setSaving(false);
    if (error) {
      toast.error("Échec", { description: friendlyError(error) });
      return;
    }
    toast.success("Personne mise à jour");
    setEditOpen(false);
    load();
  };

  const addRole = (r: PersonRoleType) => {
    setRolesOpen(false);
    setAddRoleTarget(r);
  };

  const removeRole = async (r: PersonRoleType) => {
    const ok = await confirmAction({
      destructive: true,
      title: `Supprimer le rôle « ${ROLE_LABELS[r]} » ?`,
      description:
        "Les données de profil liées seront supprimées définitivement.",
      confirmLabel: "Supprimer",
    });
    if (!ok) return;

    try {
      if (r === "athlete") {
        const { data: ap } = await supabase
          .from("athlete_profiles")
          .select("legacy_athlete_id")
          .eq("person_id", personId)
          .maybeSingle();
        const legacyId = (ap as { legacy_athlete_id?: string } | null)
          ?.legacy_athlete_id;
        if (legacyId) {
          const { error: ue } = await supabase
            .from("athletes")
            .update({ is_active: false })
            .eq("id", legacyId);
          if (ue) throw ue;
        }
        const { error: de } = await supabase
          .from("athlete_profiles")
          .delete()
          .eq("person_id", personId);
        if (de) throw de;
      } else if (r === "coach") {
        const { data: cps } = await supabase
          .from("coach_profiles")
          .select("legacy_coach_id")
          .eq("person_id", personId);
        const ids = ((cps ?? []) as { legacy_coach_id?: string }[])
          .map((x) => x.legacy_coach_id)
          .filter((x): x is string => !!x);
        if (ids.length > 0) {
          const { error: de } = await supabase
            .from("coaches")
            .delete()
            .in("id", ids);
          if (de) throw de;
        }
        const { error: cpe } = await supabase
          .from("coach_profiles")
          .delete()
          .eq("person_id", personId);
        if (cpe) throw cpe;
      } else if (r === "federation_member") {
        const { data: fms } = await supabase
          .from("federation_member_profiles")
          .select("legacy_federation_member_id")
          .eq("person_id", personId);
        const ids = ((fms ?? []) as { legacy_federation_member_id?: string }[])
          .map((x) => x.legacy_federation_member_id)
          .filter((x): x is string => !!x);
        if (ids.length > 0) {
          const { error: de } = await supabase
            .from("federation_members")
            .delete()
            .in("id", ids);
          if (de) throw de;
        }
        const { error: fpe } = await supabase
          .from("federation_member_profiles")
          .delete()
          .eq("person_id", personId);
        if (fpe) throw fpe;
      } else if (r === "club_member") {
        const { data: cms } = await supabase
          .from("club_member_profiles")
          .select("legacy_club_member_id")
          .eq("person_id", personId);
        const ids = ((cms ?? []) as { legacy_club_member_id?: string }[])
          .map((x) => x.legacy_club_member_id)
          .filter((x): x is string => !!x);
        if (ids.length > 0) {
          const { error: de } = await supabase
            .from("club_members")
            .delete()
            .in("id", ids);
          if (de) throw de;
        }
        const { error: cpe } = await supabase
          .from("club_member_profiles")
          .delete()
          .eq("person_id", personId);
        if (cpe) throw cpe;
      }

      const { error: pre } = await supabase
        .from("person_roles")
        .delete()
        .eq("person_id", personId)
        .eq("role_type", r);
      if (pre) throw pre;

      toast.success("Rôle supprimé");
      load();
    } catch (err) {
      toast.error("Suppression impossible", {
        description: friendlyError(err as never),
      });
    }
  };

  const remove = async () => {
    const ok = await confirmAction({
      title: "Supprimer cette personne ?",
      description:
        "Cette action supprime la personne et ses profils liés (les enregistrements legacy ne sont pas supprimés).",
      confirmLabel: "Supprimer",
      destructive: true,
    });
    if (!ok) return;
    const { error } = await supabase.from("persons").delete().eq("id", personId);
    if (error) {
      toast.error("Suppression impossible", { description: friendlyError(error) });
      return;
    }
    toast.success("Personne supprimée");
    navigate({ to: "/persons" });
  };

  if (!bundle) {
    return <div className="p-6 text-muted-foreground">Chargement…</div>;
  }

  const { person } = bundle;
  const tabRoles = activeRoles.length > 0 ? activeRoles : ([] as PersonRoleType[]);
  const defaultTab = tabRoles[0] ?? "overview";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Link
          to="/persons"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Retour aux personnes
        </Link>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setRolesOpen(true)}>
            Gérer les rôles
          </Button>
          <Button variant="outline" size="sm" onClick={openEdit}>
            <Pencil className="mr-2 h-4 w-4" />
            Modifier
          </Button>
          <Button variant="ghost" size="sm" onClick={remove}>
            <Trash2 className="mr-2 h-4 w-4 text-red-600" />
            Supprimer
          </Button>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card p-6">
        <div className="flex flex-wrap items-start gap-6">
          <EntityImageUpload
            entityId={person.id}
            entityType="person"
            currentImageUrl={person.photo_url}
            currentStoragePath={person.photo_storage_path}
            shape="circle"
            size="lg"
            label="Photo"
            placeholder={initials(person)}
            onUploaded={async (url, path) => {
              await supabase
                .from("persons")
                .update({ photo_url: url, photo_storage_path: path })
                .eq("id", person.id);
              await syncPhotoFromPerson(person.id, {
                photo_url: url,
                photo_storage_path: path,
              });
              load();
            }}
            onDeleted={async () => {
              await supabase
                .from("persons")
                .update({ photo_url: null, photo_storage_path: null })
                .eq("id", person.id);
              await syncPhotoFromPerson(person.id, {
                photo_url: null,
                photo_storage_path: null,
              });
              load();
            }}

          />
          <div className="flex-1 min-w-[240px] space-y-3">
            <div>
              <h1 className="text-2xl font-semibold text-foreground">
                {personFullName(person)}
              </h1>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {activeRoles.length === 0 ? (
                  <Badge variant="outline">Aucun rôle</Badge>
                ) : (
                  activeRoles.map((r) => <PersonRoleBadge key={r} role={r} />)
                )}
                {!person.is_active && (
                  <Badge variant="outline" className="border-orange-200 text-orange-700">
                    Inactif
                  </Badge>
                )}
              </div>
            </div>
            <div className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm md:grid-cols-2">
              {person.email && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Mail className="h-4 w-4" />
                  <span>{person.email}</span>
                </div>
              )}
              {person.phone && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Phone className="h-4 w-4" />
                  <span>{person.phone}</span>
                </div>
              )}
              {(person.street || person.city) && (
                <div className="flex items-center gap-2 text-muted-foreground md:col-span-2">
                  <MapPin className="h-4 w-4" />
                  <span>
                    {[person.street, person.postcode, person.city, person.country]
                      .filter(Boolean)
                      .join(", ")}
                  </span>
                </div>
              )}
              {person.birth_date && (
                <div className="text-muted-foreground">
                  Né(e) le {new Date(person.birth_date).toLocaleDateString("fr-FR")}
                </div>
              )}
              {person.nationality && (
                <div className="text-muted-foreground">Nationalité : {person.nationality}</div>
              )}
            </div>
          </div>
        </div>
      </div>

      <Tabs defaultValue={defaultTab} className="space-y-4">
        <TabsList className="flex-wrap h-auto">
          {tabRoles.map((r) => (
            <TabsTrigger key={r} value={r}>
              {ROLE_LABELS[r]}
            </TabsTrigger>
          ))}
          {tabRoles.length === 0 && (
            <TabsTrigger value="overview">Vue d'ensemble</TabsTrigger>
          )}
        </TabsList>

        {tabRoles.includes("athlete") && (
          <TabsContent value="athlete">
            <AthleteTab profile={bundle.athlete_profile} />
          </TabsContent>
        )}
        {tabRoles.includes("coach") && (
          <TabsContent value="coach">
            <CoachTab profiles={bundle.coach_profiles} />
          </TabsContent>
        )}
        {tabRoles.includes("federation_member") && (
          <TabsContent value="federation_member">
            <FederationMemberTab profiles={bundle.federation_member_profiles} />
          </TabsContent>
        )}
        {tabRoles.includes("club_member") && (
          <TabsContent value="club_member">
            <ClubMemberTab profiles={bundle.club_member_profiles} />
          </TabsContent>
        )}
        {(["official", "volunteer", "staff"] as PersonRoleType[]).map(
          (r) =>
            tabRoles.includes(r) && (
              <TabsContent key={r} value={r}>
                <div className="rounded-lg border border-dashed border-border bg-card p-6 text-sm text-muted-foreground">
                  Pas encore de profil détaillé pour le rôle « {ROLE_LABELS[r]} ».
                </div>
              </TabsContent>
            ),
        )}

        {tabRoles.length === 0 && (
          <TabsContent value="overview">
            <div className="rounded-lg border border-dashed border-border bg-card p-6 text-sm text-muted-foreground">
              Aucun rôle assigné. Clique sur « Gérer les rôles » pour en ajouter.
            </div>
          </TabsContent>
        )}
      </Tabs>

      {/* Edit dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-lg">
          <form onSubmit={saveEdit}>
            <DialogHeader>
              <DialogTitle>Modifier la personne</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="efn">Prénom *</Label>
                  <Input
                    id="efn"
                    value={form.first_name}
                    onChange={(e) => setForm({ ...form, first_name: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="eln">Nom *</Label>
                  <Input
                    id="eln"
                    value={form.last_name}
                    onChange={(e) => setForm({ ...form, last_name: e.target.value })}
                    required
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="eem">Email</Label>
                  <Input
                    id="eem"
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="eph">Téléphone</Label>
                  <Input
                    id="eph"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="ebd">Date de naissance</Label>
                  <Input
                    id="ebd"
                    type="date"
                    value={form.birth_date}
                    onChange={(e) => setForm({ ...form, birth_date: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="enat">Nationalité</Label>
                  <Input
                    id="enat"
                    value={form.nationality}
                    onChange={(e) => setForm({ ...form, nationality: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="estreet">Rue</Label>
                <Input
                  id="estreet"
                  value={form.street}
                  onChange={(e) => setForm({ ...form, street: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="epc">Code postal</Label>
                  <Input
                    id="epc"
                    value={form.postcode}
                    onChange={(e) => setForm({ ...form, postcode: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ecity">Ville</Label>
                  <Input
                    id="ecity"
                    value={form.city}
                    onChange={(e) => setForm({ ...form, city: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ectry">Pays</Label>
                  <Input
                    id="ectry"
                    value={form.country}
                    onChange={(e) => setForm({ ...form, country: e.target.value })}
                  />
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={form.is_active}
                  onCheckedChange={(v) => setForm({ ...form, is_active: !!v })}
                />
                Actif
              </label>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>
                Annuler
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Enregistrement…" : "Enregistrer"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Roles management dialog */}
      <Dialog open={rolesOpen} onOpenChange={setRolesOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Gérer les rôles</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-2 py-2">
            {PERSON_ROLE_TYPES.map((r) => {
              const has = activeRoles.includes(r);
              return (
                <div
                  key={r}
                  className="flex items-center justify-between rounded-md border border-border p-3 text-sm"
                >
                  {has ? (
                    <PersonRoleBadge role={r} />
                  ) : (
                    <span className="text-muted-foreground">{ROLE_LABELS[r]}</span>
                  )}
                  {has ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-red-600 hover:bg-red-50 hover:text-red-700"
                      onClick={() => removeRole(r)}
                      aria-label={`Retirer ${ROLE_LABELS[r]}`}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => addRole(r)}
                      aria-label={`Ajouter ${ROLE_LABELS[r]}`}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
          <DialogFooter>
            <Button onClick={() => setRolesOpen(false)}>Fermer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {addRoleTarget && bundle && (
        <AddRoleDialog
          open={!!addRoleTarget}
          onOpenChange={(o) => !o && setAddRoleTarget(null)}
          personId={personId}
          person={bundle.person}
          role={addRoleTarget}
          onAdded={() => {
            setAddRoleTarget(null);
            load();
          }}
        />
      )}
    </div>
  );
}

// ============================================================
// Role-specific tabs
// ============================================================

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="text-sm text-foreground">{value || "—"}</div>
    </div>
  );
}

function AthleteTab({ profile }: { profile: AthleteProfile | null }) {
  if (!profile) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-card p-6 text-sm text-muted-foreground">
        Aucun profil athlète détaillé.
      </div>
    );
  }
  return (
    <div className="space-y-4 rounded-lg border border-border bg-card p-6">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Field label="COSL ID" value={profile.cosl_id} />
        <Field label="Statut" value={profile.status} />
        <Field label="Niveau" value={profile.level} />
        <Field label="Licence" value={profile.license_number} />
        <Field label="ADA" value={profile.ada_number} />
        <Field label="Passeport" value={profile.passport_number} />
        <Field
          label="Expiration passeport"
          value={
            profile.passport_expiry
              ? new Date(profile.passport_expiry).toLocaleDateString("fr-FR")
              : null
          }
        />
        <Field label="Lieu de naissance" value={profile.birth_place} />
        <Field label="Vêtements" value={profile.size_clothing} />
        <Field label="Chaussures" value={profile.size_shoes} />
        <Field label="Gants" value={profile.size_gloves} />
      </div>
      {profile.legacy_athlete_id && (
        <div className="border-t border-border pt-3">
          <Link
            to="/athletes/$id"
            params={{ id: profile.legacy_athlete_id }}
            className="text-sm text-primary hover:underline"
          >
            Voir la fiche athlète complète →
          </Link>
        </div>
      )}
    </div>
  );
}

function CoachTab({ profiles }: { profiles: CoachProfile[] }) {
  if (profiles.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-card p-6 text-sm text-muted-foreground">
        Aucune mission d'encadrement enregistrée.
      </div>
    );
  }
  return (
    <div className="space-y-3">
      {profiles.map((p) => (
        <div
          key={p.id}
          className="flex items-center justify-between rounded-lg border border-border bg-card p-4"
        >
          <div className="space-y-1">
            <div className="text-sm font-medium">{p.role}</div>
            <div className="text-xs text-muted-foreground">
              {p.is_active ? "Actif" : "Inactif"}
            </div>
          </div>
          {p.legacy_coach_id && (
            <Link
              to="/coaches/$id"
              params={{ id: p.legacy_coach_id }}
              className="text-sm text-primary hover:underline"
            >
              Fiche encadrant →
            </Link>
          )}
        </div>
      ))}
    </div>
  );
}

function FederationMemberTab({ profiles }: { profiles: FederationMemberProfile[] }) {
  if (profiles.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-card p-6 text-sm text-muted-foreground">
        Aucune affiliation fédération.
      </div>
    );
  }
  return (
    <div className="space-y-3">
      {profiles.map((p) => (
        <div key={p.id} className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium">{p.role}</div>
            <Badge variant={p.is_active ? "default" : "outline"}>
              {p.is_active ? "Actif" : "Inactif"}
            </Badge>
          </div>
          {p.notes && (
            <p className="mt-2 text-sm text-muted-foreground">{p.notes}</p>
          )}
        </div>
      ))}
    </div>
  );
}

function ClubMemberTab({ profiles }: { profiles: ClubMemberProfile[] }) {
  if (profiles.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-card p-6 text-sm text-muted-foreground">
        Aucune affiliation club.
      </div>
    );
  }
  return (
    <div className="space-y-3">
      {profiles.map((p) => (
        <div key={p.id} className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium">{p.role}</div>
            <Badge variant={p.is_active ? "default" : "outline"}>
              {p.is_active ? "Actif" : "Inactif"}
            </Badge>
          </div>
          {p.notes && (
            <p className="mt-2 text-sm text-muted-foreground">{p.notes}</p>
          )}
        </div>
      ))}
    </div>
  );
}
