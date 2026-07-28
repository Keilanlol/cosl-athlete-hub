import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Mail, Phone, MapPin, Pencil, Trash2, Plus, X, ArrowRight, Building2, Trophy, Users, Shield, Upload, FileText, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { friendlyError } from "@/lib/error-messages";
import { confirmAction } from "@/components/ConfirmDialog";
import {
  PERSON_ROLE_TYPES,
  ROLE_LABELS,
  personFullName,
  defaultPersonGeneral,
  type AthleteProfile,
  type CoachProfile,
  type FederationMemberProfile,
  type Person,
  type PersonRole,
  type PersonRoleType,
  type PersonGeneralFields,
} from "@/lib/persons";
import { PersonRoleBadge } from "@/components/persons/PersonRoleBadge";
import { AddRoleDialog } from "@/components/persons/AddRoleDialog";
import { PersonGeneralForm } from "@/components/persons/PersonGeneralForm";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { EntityImageUpload } from "@/components/EntityImageUpload";
import { FileUpload, pathFromSignedUrl } from "@/components/FileUpload";
import { EditableSelect } from "@/components/EditableSelect";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { syncPhotoFromPerson } from "@/lib/person-photo-sync";
import { syncPersonToLegacy } from "@/lib/person-sync";
import { useTypeItems, useTypeGroup } from "@/hooks/useTypeItems";
import { useAuth } from "@/hooks/useAuth";
import { useHashTab } from "@/hooks/useHashTab";
import { DOCUMENT_STATUSES, type PersonDocument } from "@/lib/types";
import { computeMissingDocs, type MissingDoc } from "@/lib/conformity-utils";
import { EmptyState, TableSkeleton } from "@/components/DataTableShell";

export const Route = createFileRoute("/_authenticated/persons/$personId")({
  component: PersonDetailPage,
});

type PersonBundle = {
  person: Person;
  roles: PersonRole[];
  athlete_profile: AthleteProfile | null;
  coach_profiles: CoachProfile[];
  federation_member_profiles: FederationMemberProfile[];
  clubs: Record<string, string>;
  federations: Record<string, string>;
};

type RequiredDocsByGame = {
  game: { id: string; name: string; edition_year: number };
  roleCode: string;
  selectionStage: string | null;
  missing: MissingDoc[];
};

function initials(p: Pick<Person, "first_name" | "last_name">) {
  return `${p.first_name?.[0] ?? ""}${p.last_name?.[0] ?? ""}`.toUpperCase();
}

function PersonDetailPage() {
  const { personId } = Route.useParams();
  const navigate = useNavigate();
  const { role } = useAuth();
  const isAdmin = role === "admin";
  const [tab, setTab] = useHashTab("informations");
  const docTypesHook = useTypeGroup("document_types");
  const { refresh: refreshTypes } = useTypeItems();
  const [bundle, setBundle] = useState<PersonBundle | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [rolesOpen, setRolesOpen] = useState(false);
  const [addRoleTarget, setAddRoleTarget] = useState<PersonRoleType | null>(null);
  const [saving, setSaving] = useState(false);
  const [editForm, setEditForm] = useState<PersonGeneralFields>({ ...defaultPersonGeneral });
  const [editIsActive, setEditIsActive] = useState(true);

  // Documents state
  const [docs, setDocs] = useState<PersonDocument[]>([]);
  const [docsLoading, setDocsLoading] = useState(true);
  const [docOpen, setDocOpen] = useState(false);
  const [docForm, setDocForm] = useState({
    doc_type: "",
    status: "pending",
    file_name: "",
    file_url: "",
    issued_date: "",
    expiry_date: "",
  });
  const [docDeleteId, setDocDeleteId] = useState<string | null>(null);
  const [requiredByGames, setRequiredByGames] = useState<RequiredDocsByGame[]>([]);

  // ── Document type helpers (écriture dans app_type_items) ─────────────────
  // Même slugify que l'admin (app-types.ts), sans préfixe de catégorie
  const slugifyCode = (s: string) =>
    s.trim().toLowerCase().replace(/[^a-z0-9_]+/g, "_").replace(/^_+|_+$/g, "") || `item_${Date.now()}`;

  const addDocType = async (label: string, category: string) => {
    const code = slugifyCode(label);
    if (!code) { toast.error("Le code est requis"); return; }
    const maxSort = docTypesHook.items.reduce((m, i) => Math.max(m, i.sort_order), 0);
    const { error } = await supabase.from("app_type_items").insert({
      group_key: "document_types",
      code,
      label: label.trim(),
      sort_order: maxSort + 1,
      is_system: false,
      category,
    });
    if (error) { toast.error("Erreur lors de l'ajout", { description: friendlyError(error) }); return; }
    toast.success("Type de document ajouté");
    await refreshTypes();
  };

  const removeDocType = async (code: string) => {
    const { error } = await supabase
      .from("app_type_items")
      .delete()
      .eq("group_key", "document_types")
      .eq("code", code);
    if (error) { toast.error("Erreur lors de la suppression", { description: friendlyError(error) }); return; }
    toast.success("Type supprimé");
    await refreshTypes();
  };

  const load = async () => {
    const [pRes, rRes, apRes, cpRes, fmRes] = await Promise.all([
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
    ]);

    if (pRes.error || !pRes.data) {
      toast.error("Personne introuvable");
      navigate({ to: "/persons" });
      return;
    }
    const athleteProfile = (apRes.data as AthleteProfile | null) ?? null;
    const coachProfiles = (cpRes.data ?? []) as CoachProfile[];
    const fmProfiles = (fmRes.data ?? []) as FederationMemberProfile[];

    const fedIds = Array.from(
      new Set(
        [
          athleteProfile?.primary_federation_id,
          ...coachProfiles.map((c) => c.federation_id),
          ...fmProfiles.map((f) => f.federation_id),
        ].filter((x): x is string => !!x),
      ),
    );

    const [fedsRes] = await Promise.all([
      fedIds.length
        ? supabase.from("federations").select("id,name").in("id", fedIds)
        : Promise.resolve({ data: [] as { id: string; name: string }[] }),
    ]);
    const fedsMap = Object.fromEntries(
      ((fedsRes.data ?? []) as { id: string; name: string }[]).map((f) => [f.id, f.name]),
    );

    setBundle({
      person: pRes.data as Person,
      roles: (rRes.data ?? []) as PersonRole[],
      athlete_profile: athleteProfile,
      coach_profiles: coachProfiles,
      federation_member_profiles: fmProfiles,
      clubs: {},
      federations: fedsMap,
    });
  };

  // Load documents for this person
  const loadDocs = async () => {
    setDocsLoading(true);
    const { data, error } = await supabase
      .from("person_documents")
      .select("*")
      .eq("person_id", personId)
      .order("created_at", { ascending: false });
    if (error) {
      toast.error("Erreur documents", { description: friendlyError(error) });
      setDocs([]);
      setDocsLoading(false);
      return;
    }
    setDocs((data ?? []) as PersonDocument[]);
    setDocsLoading(false);
  };

  // Load required docs by Games (if person is selected for any Games)
  const loadRequiredByGames = async () => {
    if (!bundle?.athlete_profile?.legacy_athlete_id) {
      setRequiredByGames([]);
      return;
    }
    const athleteId = bundle.athlete_profile.legacy_athlete_id;
    // Get selections for this athlete
    const { data: sels } = await supabase
      .from("selections")
      .select("game_id, status, game:games(id, name, edition_year)")
      .eq("athlete_id", athleteId)
      .in("status", ["pre_selected", "selected", "reserve"]);
    const selections = (sels ?? []) as unknown as Array<{
      game_id: string;
      status: string;
      game: { id: string; name: string; edition_year: number } | null;
    }>;
    if (selections.length === 0) {
      setRequiredByGames([]);
      return;
    }
    const results: RequiredDocsByGame[] = [];
    for (const sel of selections) {
      if (!sel.game) continue;
      const { missing } = await computeMissingDocs(
        personId,
        sel.game.id,
        "athlete",
        sel.status,
      );
      results.push({
        game: sel.game,
        roleCode: "athlete",
        selectionStage: sel.status,
        missing,
      });
    }
    setRequiredByGames(results);
  };

  useEffect(() => {
    load();
    loadDocs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [personId]);

  useEffect(() => {
    if (bundle) loadRequiredByGames();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bundle, docs]);

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
    setEditForm({
      first_name: p.first_name,
      last_name: p.last_name,
      email: p.email ?? "",
      phone: p.phone ?? "",
      birth_date: p.birth_date ?? "",
      gender: p.gender ?? "",
      nationality: p.nationality ?? "",
      street: p.street ?? "",
      postcode: p.postcode ?? "",
      city: p.city ?? "",
      country: p.country ?? "",
    });
    setEditIsActive(p.is_active);
    setEditOpen(true);
  };

  const patchEdit = (patch: Partial<PersonGeneralFields>) =>
    setEditForm((f) => ({ ...f, ...patch }));

  const saveEdit = async () => {
    if (saving) return;
    setSaving(true);
    const { error } = await supabase
      .from("persons")
      .update({
        first_name: editForm.first_name.trim(),
        last_name: editForm.last_name.trim(),
        email: editForm.email?.trim() || null,
        phone: editForm.phone?.trim() || null,
        birth_date: editForm.birth_date || null,
        gender: editForm.gender || null,
        nationality: editForm.nationality?.trim() || null,
        street: editForm.street?.trim() || null,
        postcode: editForm.postcode?.trim() || null,
        city: editForm.city?.trim() || null,
        country: editForm.country?.trim() || null,
        is_active: editIsActive,
      })
      .eq("id", personId);
    setSaving(false);
    if (error) {
      toast.error("Échec", { description: friendlyError(error) });
      return;
    }
    await syncPersonToLegacy(personId, {
      email: editForm.email?.trim() || null,
      phone: editForm.phone?.trim() || null,
    });
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

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteDeps, setDeleteDeps] = useState<{
    documents: number;
    selections: number;
    accreditations: number;
    delegation_members: number;
  } | null>(null);
  const [deleteConfirmName, setDeleteConfirmName] = useState("");
  const [deleting, setDeleting] = useState(false);

  const openDeleteDialog = async () => {
    setDeleteConfirmName("");
    setDeleteDeps(null);
    setDeleteOpen(true);

    // Compter les dépendances qui bloquent la suppression (RESTRICT)
    const [docsRes, selsRes, accredsRes, delRes] = await Promise.all([
      supabase.from("person_documents").select("id", { count: "exact", head: true }).eq("person_id", personId),
      supabase.from("selections").select("id", { count: "exact", head: true }).eq("person_id", personId),
      supabase.from("accreditations").select("id", { count: "exact", head: true }).eq("person_id", personId),
      supabase.from("delegation_members").select("id", { count: "exact", head: true }).eq("person_id", personId),
    ]);

    setDeleteDeps({
      documents: docsRes.count ?? 0,
      selections: selsRes.count ?? 0,
      accreditations: accredsRes.count ?? 0,
      delegation_members: delRes.count ?? 0,
    });
  };

  const softDelete = async () => {
    setDeleting(true);
    const { error } = await supabase
      .from("persons")
      .update({ is_active: false })
      .eq("id", personId);
    setDeleting(false);
    if (error) {
      toast.error("Échec", { description: friendlyError(error) });
      return;
    }
    toast.success("Personne désactivée");
    setDeleteOpen(false);
    load();
  };

  const hardDelete = async () => {
    if (!bundle) return;
    const fullName = `${bundle.person.first_name} ${bundle.person.last_name}`;
    if (deleteConfirmName.trim() !== fullName) {
      toast.error("Le nom saisi ne correspond pas");
      return;
    }
    setDeleting(true);
    const { error } = await supabase.from("persons").delete().eq("id", personId);
    setDeleting(false);
    if (error) {
      // RESTRICT : la FK bloque — afficher un message clair
      toast.error("Suppression impossible", {
        description:
          "Des enregistrements liés (documents, sélections, accréditations ou délégations) empêchent la suppression. " +
          "Désactivez la personne ou supprimez d'abord ces dépendances.",
        duration: 8000,
      });
      return;
    }
    toast.success("Personne supprimée définitivement");
    setDeleteOpen(false);
    navigate({ to: "/persons" });
  };

  const remove = openDeleteDialog;

  // ── Document CRUD ──────────────────────────────────────────────────────

  const submitDoc = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!docForm.doc_type.trim() || !docForm.file_name.trim()) {
      toast.error("Type et nom de fichier requis");
      return;
    }
    const isCOSLDoc = ["convention", "olympic_contract", "code_of_conduct", "medical_form"].includes(docForm.doc_type);
    const dt = docTypesHook.items.find((t) => t.code === docForm.doc_type);
    // Lire la catégorie depuis app_type_items (ajoutée par la migration 0048)
    let category = "admin";
    if (dt) {
      const { data: atiRow } = await supabase
        .from("app_type_items")
        .select("category")
        .eq("group_key", "document_types")
        .eq("code", dt.code)
        .maybeSingle();
      category = (atiRow as { category?: string } | null)?.category ?? "admin";
    }
    const { data: insertedDoc, error } = await supabase
      .from("person_documents")
      .insert({
        person_id: personId,
        category,
        doc_type: docForm.doc_type.trim(),
        file_name: docForm.file_name.trim(),
        file_url: docForm.file_url.trim() || null,
        issued_date: docForm.issued_date || null,
        expiry_date: docForm.expiry_date || null,
        status: docForm.status,
        uploaded_by: null,
        requires_action: isCOSLDoc,
      })
      .select("id")
      .single();

    if (error) {
      toast.error("Échec", { description: friendlyError(error) });
      return;
    }

    // Notify for COSL docs requiring action
    if (insertedDoc && isCOSLDoc) {
      const typeLabel = dt?.label ?? docForm.doc_type;
      await supabase.from("notifications").insert({
        notification_type: "document_action_required",
        message: `Nouveau document à examiner : ${typeLabel}`,
        related_person_id: personId,
        related_doc_id: insertedDoc.id,
        is_read: false,
      });
    }

    toast.success("Document ajouté");
    setDocOpen(false);
    setDocForm({
      doc_type: "",
      status: "pending",
      file_name: "",
      file_url: "",
      issued_date: "",
      expiry_date: "",
    });
    loadDocs();
  };

  const deleteDoc = async () => {
    if (!docDeleteId) return;
    const target = docs.find((d) => d.id === docDeleteId);
    if (target?.file_url) {
      const storagePath = pathFromSignedUrl(target.file_url, "documents");
      if (storagePath) {
        await supabase.storage.from("documents").remove([storagePath]);
      }
    }
    const { error } = await supabase
      .from("person_documents")
      .delete()
      .eq("id", docDeleteId);
    setDocDeleteId(null);
    if (error) {
      toast.error("Suppression impossible", { description: friendlyError(error) });
      return;
    }
    toast.success("Document supprimé");
    loadDocs();
  };

  const updateDocStatus = async (docId: string, nextStatus: string) => {
    const { error } = await supabase
      .from("person_documents")
      .update({ status: nextStatus })
      .eq("id", docId);
    if (error) {
      toast.error("Mise à jour impossible", { description: friendlyError(error) });
      return;
    }
    toast.success("Statut mis à jour");
    setDocs((prev) =>
      prev.map((d) => (d.id === docId ? { ...d, status: nextStatus } : d)),
    );
  };

  if (!bundle) {
    return <div className="p-6 text-muted-foreground">Chargement…</div>;
  }

  const { person } = bundle;

  const docStatusBadge = (s: string) => {
    const m = DOCUMENT_STATUSES.find((x) => x.value === s);
    return <Badge className={`${m?.cls ?? ""} hover:${m?.cls ?? ""}`}>{m?.label ?? s}</Badge>;
  };

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

      <Tabs value={tab} onValueChange={setTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="informations">Informations</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
        </TabsList>

        {/* ══════════════════════════════════════════════════════════════ */}
        {/* Onglet INFORMATIONS                                          */}
        {/* ══════════════════════════════════════════════════════════════ */}
        <TabsContent value="informations" className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-foreground">Rôles</h2>
            <Button size="sm" variant="outline" onClick={() => setRolesOpen(true)}>
              <Plus className="mr-1 h-4 w-4" /> Ajouter un rôle
            </Button>
          </div>

          {activeRoles.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border bg-card p-6 text-sm text-muted-foreground">
              Aucun rôle assigné. Clique sur « Ajouter un rôle » pour en attribuer un.
            </div>
          ) : (
            <ul className="space-y-2">
              {activeRoles.includes("athlete") && bundle.athlete_profile && (
                <RoleListItem
                  icon={<Trophy className="h-4 w-4" />}
                  role="athlete"
                  title={
                    bundle.athlete_profile.primary_federation_id
                      ? bundle.federations[bundle.athlete_profile.primary_federation_id] ?? "Athlète"
                      : "Athlète indépendant"
                  }
                  subtitle={[
                    bundle.athlete_profile.status,
                    bundle.athlete_profile.level && `Niveau ${bundle.athlete_profile.level}`,
                    bundle.athlete_profile.primary_federation_id &&
                      bundle.federations[bundle.athlete_profile.primary_federation_id],
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                  to={
                    bundle.athlete_profile.legacy_athlete_id
                      ? { to: "/athletes/$id", params: { id: bundle.athlete_profile.legacy_athlete_id } }
                      : null
                  }
                />
              )}

              {bundle.coach_profiles.map((p) => (
                <RoleListItem
                  key={p.id}
                  icon={<Shield className="h-4 w-4" />}
                  role="coach"
                  title={
                    (p.federation_id && bundle.federations[p.federation_id]) ||
                    "Encadrant"
                  }
                  subtitle={[
                    p.role,
                    p.federation_id && bundle.federations[p.federation_id]
                      ? `Fédération : ${bundle.federations[p.federation_id]}`
                      : null,
                    p.is_active ? "Actif" : "Inactif",
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                  to={
                    p.legacy_coach_id
                      ? { to: "/coaches/$id", params: { id: p.legacy_coach_id } }
                      : null
                  }
                />
              ))}

              {bundle.federation_member_profiles.map((p) => (
                <RoleListItem
                  key={p.id}
                  icon={<Building2 className="h-4 w-4" />}
                  role="federation_member"
                  title={bundle.federations[p.federation_id] ?? "Fédération"}
                  subtitle={[
                    p.role,
                    p.start_date &&
                      `Depuis ${new Date(p.start_date).toLocaleDateString("fr-FR")}`,
                    p.end_date &&
                      `Jusqu'au ${new Date(p.end_date).toLocaleDateString("fr-FR")}`,
                    p.is_active ? "Actif" : "Inactif",
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                  to={
                    p.legacy_federation_member_id
                      ? {
                          to: "/federations/members/$memberId",
                          params: { memberId: p.legacy_federation_member_id },
                        }
                      : null
                  }
                />
              ))}

              {(["official", "volunteer", "staff"] as PersonRoleType[])
                .filter((r) => activeRoles.includes(r))
                .map((r) => (
                  <RoleListItem
                    key={r}
                    icon={<Users className="h-4 w-4" />}
                    role={r}
                    title={ROLE_LABELS[r]}
                    subtitle="Pas de profil détaillé"
                    to={null}
                  />
                ))}
            </ul>
          )}
        </TabsContent>

        {/* ══════════════════════════════════════════════════════════════ */}
        {/* Onglet DOCUMENTS                                             */}
        {/* ══════════════════════════════════════════════════════════════ */}
        <TabsContent value="documents" className="space-y-4">
          {/* Encart Photo officielle */}
          <div className="rounded-lg border border-border bg-card p-4">
            <h3 className="text-sm font-semibold text-foreground mb-3">Photo officielle</h3>
            <div className="flex items-center gap-4">
              <EntityImageUpload
                entityId={person.id}
                entityType="person"
                currentImageUrl={person.photo_url}
                currentStoragePath={person.photo_storage_path}
                shape="circle"
                size="sm"
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
              <div className="text-sm text-muted-foreground">
                {person.photo_url ? (
                  <p className="text-emerald-600">✓ Photo uploadée</p>
                ) : (
                  <p>Aucune photo — cliquez pour ajouter</p>
                )}
                <p className="text-xs mt-1">JPG, PNG ou WebP · max 5 MB</p>
              </div>
            </div>
          </div>

          {/* Section "Documents requis" (si sélectionné pour un Games) */}
          {requiredByGames.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-lg font-semibold text-foreground">Documents requis</h3>
              {requiredByGames.map((rg) => {
                const stageLabel =
                  rg.selectionStage === "pre_selected"
                    ? "Long List"
                    : rg.selectionStage === "selected"
                    ? "Short List"
                    : rg.selectionStage === "reserve"
                    ? "Réserve"
                    : rg.selectionStage;
                const allGood = rg.missing.length === 0;
                return (
                  <div key={rg.game.id} className="rounded-lg border border-border bg-card p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <p className="text-sm font-semibold text-foreground">
                          {rg.game.name} {rg.game.edition_year}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Rôle : Athlète · Étape : {stageLabel}
                        </p>
                      </div>
                      <Badge
                        className={
                          allGood
                            ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-100"
                            : rg.missing.length > 2
                            ? "bg-red-100 text-red-700 hover:bg-red-100"
                            : "bg-amber-100 text-amber-700 hover:bg-amber-100"
                        }
                      >
                        {allGood
                          ? "Conforme"
                          : `${rg.missing.length} manquant(s)`}
                      </Badge>
                    </div>
                    {allGood ? (
                      <p className="text-sm text-emerald-600">✓ Tous les documents requis sont fournis</p>
                    ) : (
                      <ul className="space-y-1">
                        {rg.missing.map((m) => (
                          <li key={m.doc_type_code} className="flex items-center gap-2 text-sm">
                            <AlertTriangle className="h-4 w-4 text-amber-500" />
                            <span className="text-muted-foreground">{m.label}</span>
                            <Button
                              size="sm"
                              variant="outline"
                              className="ml-auto"
                              onClick={() => {
                                setDocForm({
                                  doc_type: m.doc_type_code,
                                  status: "pending",
                                  file_name: "",
                                  file_url: "",
                                  issued_date: "",
                                  expiry_date: "",
                                });
                                setDocOpen(true);
                              }}
                            >
                              <Upload className="mr-1 h-3 w-3" /> Fournir
                            </Button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Section "Tous les documents" */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-foreground">Tous les documents</h3>
              <Button
                onClick={() => {
                  setDocForm({
                    doc_type: "",
                    status: "pending",
                    file_name: "",
                    file_url: "",
                    issued_date: "",
                    expiry_date: "",
                  });
                  setDocOpen(true);
                }}
                className="bg-primary hover:bg-[var(--cosl-red-dark)]"
              >
                <Upload className="mr-2 h-4 w-4" /> Ajouter un document
              </Button>
            </div>
            <div className="rounded-lg border border-border bg-card">
              {docsLoading ? (
                <TableSkeleton cols={6} />
              ) : docs.length === 0 ? (
                <div className="p-6"><EmptyState message="Aucun document." /></div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Type</TableHead>
                      <TableHead>Nom du fichier</TableHead>
                      <TableHead>Émission</TableHead>
                      <TableHead>Expiration</TableHead>
                      <TableHead>Statut</TableHead>
                      <TableHead>Requis pour</TableHead>
                      <TableHead className="w-12 text-right"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {docs.map((d) => {
                      const reqGame = requiredByGames.find((rg) =>
                        rg.missing.some((m) => m.doc_type_code === d.doc_type) ||
                        rg.missing.length === 0 &&
                        // Check if this doc_type is required for this game
                        true,
                      );
                      return (
                        <TableRow key={d.id}>
                          <TableCell>
                            {docTypesHook.items.find((t) => t.code === d.doc_type)?.label ?? d.doc_type}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {d.file_url && /\.(png|jpe?g|webp|gif)(\?|$)/i.test(d.file_url) && (
                                <img
                                  src={d.file_url}
                                  alt=""
                                  className="h-10 w-10 rounded object-cover border border-border"
                                />
                              )}
                              {d.file_url ? (
                                <a
                                  href={d.file_url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-[var(--lux-blue)] hover:underline"
                                >
                                  {d.file_name}
                                </a>
                              ) : (
                                d.file_name
                              )}
                            </div>
                          </TableCell>
                          <TableCell>{d.issued_date ?? "—"}</TableCell>
                          <TableCell>{d.expiry_date ?? "—"}</TableCell>
                          <TableCell>
                            {isAdmin ? (
                              <Select
                                value={d.status}
                                onValueChange={(v) => updateDocStatus(d.id, v)}
                              >
                                <SelectTrigger className="h-8 w-40">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {DOCUMENT_STATUSES.map((s) => (
                                    <SelectItem key={s.value} value={s.value}>
                                      {s.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            ) : (
                              docStatusBadge(d.status)
                            )}
                          </TableCell>
                          <TableCell>
                            {requiredByGames
                              .filter((rg) =>
                                rg.missing.some((m) => m.doc_type_code === d.doc_type) === false &&
                                rg.missing.length === 0,
                              )
                              .map((rg) => (
                                <Badge key={rg.game.id} variant="outline" className="text-xs">
                                  {rg.game.name}
                                </Badge>
                              ))}
                            {requiredByGames.some((rg) =>
                              rg.missing.some((m) => m.doc_type_code === d.doc_type),
                            ) && (
                              <Badge variant="outline" className="text-xs text-amber-700 border-amber-200">
                                Requis (fourni)
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setDocDeleteId(d.id)}
                            >
                              <Trash2 className="h-4 w-4 text-red-600" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Edit dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Modifier la personne</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <PersonGeneralForm
              values={editForm}
              onChange={patchEdit}
            />
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={editIsActive}
                onCheckedChange={(v) => setEditIsActive(!!v)}
              />
              Actif
            </label>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setEditOpen(false)} disabled={saving}>
              Annuler
            </Button>
            <Button type="button" onClick={saveEdit} disabled={saving} className="bg-primary hover:bg-[var(--cosl-red-dark)]">
              {saving ? "Enregistrement…" : "Enregistrer"}
            </Button>
          </div>
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

      {/* Document add dialog */}
      <Dialog open={docOpen} onOpenChange={setDocOpen}>
        <DialogContent className="sm:max-w-lg">
          <form onSubmit={submitDoc}>
            <DialogHeader>
              <DialogTitle>Ajouter un document</DialogTitle>
            </DialogHeader>
            <div className="grid gap-3 py-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Type *</Label>
                  <EditableSelect
                    value={docForm.doc_type}
                    onValueChange={(v) => {
                      setDocForm({ ...docForm, doc_type: v });
                    }}
                    options={docTypesHook.items.map((t) => ({ value: t.code, label: t.label }))}
                    emptyLabel="—"
                    onAdd={(label) => addDocType(label, "admin")}
                    onDelete={removeDocType}
                    addLabel="+ Ajouter un type…"
                    manageTitle="Types de documents"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Statut</Label>
                  <Select
                    value={docForm.status}
                    onValueChange={(v) => setDocForm({ ...docForm, status: v })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {DOCUMENT_STATUSES.map((s) => (
                        <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Nom du fichier</Label>
                <Input
                  value={docForm.file_name}
                  onChange={(e) => setDocForm({ ...docForm, file_name: e.target.value })}
                  placeholder="Auto-généré : Type_Prénom_Nom"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Fichier</Label>
                <FileUpload
                  bucket="documents"
                  path={`persons/${personId}/${docForm.doc_type || "doc"}/${Date.now()}_`}
                  accept="image/jpeg,image/png,image/webp,application/pdf"
                  currentUrl={docForm.file_url || null}
                  currentName={docForm.file_name || null}
                  overrideFileName={
                    docForm.doc_type
                      ? `${docForm.doc_type}_${person.first_name}_${person.last_name}`
                      : undefined
                  }
                  onUploaded={(url, fileName) => {
                    setDocForm((prev) => ({
                      ...prev,
                      file_url: url,
                      file_name: prev.file_name || fileName,
                    }));
                  }}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Date d'émission</Label>
                  <Input
                    type="date"
                    value={docForm.issued_date}
                    onChange={(e) => setDocForm({ ...docForm, issued_date: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Date d'expiration</Label>
                  <Input
                    type="date"
                    value={docForm.expiry_date}
                    onChange={(e) => setDocForm({ ...docForm, expiry_date: e.target.value })}
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDocOpen(false)}>
                Annuler
              </Button>
              <Button type="submit" className="bg-primary hover:bg-[var(--cosl-red-dark)]">
                Ajouter
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Document delete confirmation */}
      <AlertDialog open={!!docDeleteId} onOpenChange={(o) => !o && setDocDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce document ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={deleteDoc} className="bg-red-600 hover:bg-red-700">
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Person delete dialog — soft-delete + hard delete with name confirmation */}
      <Dialog open={deleteOpen} onOpenChange={(o) => !o && setDeleteOpen(false)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Supprimer cette personne ?</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              <strong className="text-foreground">Désactiver</strong> la personne est recommandé :
              elle devient invisible des listes actives mais conserve tout son historique
              (sélections, accréditations, documents). Aucune donnée n'est perdue.
            </p>

            {deleteDeps && (
              <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm">
                <p className="font-medium text-amber-900">Dépendances liées à cette personne :</p>
                <ul className="mt-1 space-y-0.5 text-amber-800">
                  <li>{deleteDeps.documents} document(s)</li>
                  <li>{deleteDeps.selections} sélection(s)</li>
                  <li>{deleteDeps.accreditations} accréditation(s)</li>
                  <li>{deleteDeps.delegation_members} appartenance(s) à délégation</li>
                </ul>
                <p className="mt-2 text-xs text-amber-700">
                  La suppression définitive est bloquée tant que ces dépendances existent.
                </p>
              </div>
            )}

            {!deleteDeps && (
              <p className="text-sm text-muted-foreground">Comptage des dépendances…</p>
            )}

            <div className="space-y-2 border-t pt-3">
              <p className="text-sm font-medium text-foreground">
                Suppression définitive (admin uniquement)
              </p>
              <p className="text-xs text-muted-foreground">
                Saisissez le nom complet « {bundle?.person.first_name} {bundle?.person.last_name} » pour confirmer.
                Les fichiers du storage ne sont pas supprimés automatiquement.
              </p>
              <Input
                value={deleteConfirmName}
                onChange={(e) => setDeleteConfirmName(e.target.value)}
                placeholder="Nom complet"
                className="text-sm"
              />
            </div>
          </div>
          <DialogFooter className="flex-col gap-2 sm:flex-col">
            <Button
              onClick={softDelete}
              disabled={deleting}
              className="w-full bg-primary hover:bg-[var(--cosl-red-dark)]"
            >
              {deleting ? "Désactivation…" : "Désactiver la personne"}
            </Button>
            {isAdmin && (
              <Button
                onClick={hardDelete}
                disabled={
                  deleting ||
                  deleteConfirmName.trim() !==
                    `${bundle?.person.first_name ?? ""} ${bundle?.person.last_name ?? ""}`
                }
                variant="outline"
                className="w-full border-red-300 text-red-700 hover:bg-red-50"
              >
                {deleting ? "Suppression…" : "Supprimer définitivement"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ============================================================
// Role list item
// ============================================================

function RoleListItem({
  icon,
  role,
  title,
  subtitle,
  to,
}: {
  icon: React.ReactNode;
  role: PersonRoleType;
  title: string;
  subtitle?: string;
  to: { to: string; params?: Record<string, string> } | null;
}) {
  return (
    <li className="flex items-center justify-between gap-4 rounded-lg border border-border bg-card p-4">
      <div className="flex min-w-0 items-start gap-3">
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
          {icon}
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <PersonRoleBadge role={role} />
            <span className="truncate text-sm font-medium text-foreground">
              {title}
            </span>
          </div>
          {subtitle && (
            <p className="mt-1 truncate text-xs text-muted-foreground">
              {subtitle}
            </p>
          )}
        </div>
      </div>
      {to ? (
        <Button asChild size="sm" variant="outline" className="shrink-0">
          {/* TanStack Link typing requires literal paths — cast is fine here. */}
          <Link
            to={to.to as never}
            params={(to.params ?? {}) as never}
          >
            Voir la fiche
            <ArrowRight className="ml-1 h-3 w-3" />
          </Link>
        </Button>
      ) : null}
    </li>
  );
}