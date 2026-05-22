import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Plus, Pencil, Search, AlertTriangle } from "lucide-react";
import { KycStatusBadge } from "@/components/KycStatusBadge";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import {
  ATHLETE_STATUSES,
  GENDERS,
  athleteSchema,
  generateCoslId,
  type Athlete,
  type AthleteForm,
  type Club,
  type Discipline,
  type Federation,
} from "@/lib/types";
import { EditableSelect } from "@/components/EditableSelect";
import { AthletePhotoUpload } from "@/components/AthletePhotoUpload";
import { useAthleteLevels, useSports } from "@/hooks/useReferenceData";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AddressSearch } from "@/components/AddressSearch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  EmptyState,
  PAGE_SIZE,
  PagerBar,
  TableSkeleton,
} from "@/components/DataTableShell";

export const Route = createFileRoute("/_authenticated/athletes/")({
  component: AthletesPage,
});

type KycEmbed = { global_status: string | null } | { global_status: string | null }[] | null;
type AthleteRow = Athlete & {
  primary_sport: { name: string } | null;
  primary_federation: { acronym: string; name: string } | null;
  current_club: { name: string } | null;
  athlete_kyc: KycEmbed;
};

function readKyc(k: KycEmbed): string {
  if (!k) return "red";
  if (Array.isArray(k)) return k[0]?.global_status ?? "red";
  return k.global_status ?? "red";
}

const ALL = "__all";

const emptyForm: AthleteForm = {
  cosl_id: "",
  first_name: "",
  last_name: "",
  birth_date: "",
  birth_place: "",
  gender: "male",
  nationality: "LUX",
  sport_nationality: "",
  email: "",
  phone: "",
  address: "",
  street: "",
  postcode: "",
  city: "",
  country: "",
  emergency_contact_name: "",
  emergency_contact_phone: "",
  photo_url: "",
  primary_sport_id: "",
  primary_federation_id: "",
  current_club_id: "",
  status: "active",
  level: "",
  size_clothing: "",
  size_shoes: "",
  size_gloves: "",
  license_number: "",
  ada_number: "",
  passport_number: "",
  passport_expiry: "",
};

function statusBadge(s: string) {
  const m = ATHLETE_STATUSES.find((x) => x.value === s);
  return (
    <Badge className={`${m?.cls ?? ""} hover:${m?.cls ?? ""}`} variant="secondary">
      {m?.label ?? s}
    </Badge>
  );
}

function kycBadge(s: string | null | undefined) {
  return (
    <KycStatusBadge
      status={(s as "green" | "orange" | "red" | null) ?? null}
      size="sm"
      showIcon
    />
  );
}

function AthletesPage() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<AthleteRow[] | null>(null);
  const { items: sports, add: addSport, remove: removeSport } = useSports();
  const { items: levels, add: addLevel, remove: removeLevel } = useAthleteLevels();
  const [federations, setFederations] = useState<Federation[]>([]);
  const [clubs, setClubs] = useState<Club[]>([]);
  const [disciplines, setDisciplines] = useState<Discipline[]>([]);
  const [athleteDisciplines, setAthleteDisciplines] = useState<Record<string, string[]>>({});

  const [search, setSearch] = useState("");
  const [fSport, setFSport] = useState(ALL);
  const [fDiscipline, setFDiscipline] = useState(ALL);
  const [fFed, setFFed] = useState(ALL);
  const [fStatus, setFStatus] = useState(ALL);
  const [fLevel, setFLevel] = useState(ALL);
  const [fKyc, setFKyc] = useState(ALL);
  const [activeOnly, setActiveOnly] = useState(true);

  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Athlete | null>(null);
  const [form, setForm] = useState<AthleteForm>(emptyForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [pendingPhotoFile, setPendingPhotoFile] = useState<File | null>(null);
  const [pendingPhotoPreview, setPendingPhotoPreview] = useState<string | null>(null);

  const load = async () => {
    setRows(null);
    const { data, error } = await supabase
      .from("athletes")
      .select(
        "*, primary_sport:sports!athletes_primary_sport_id_fkey(name), primary_federation:federations!athletes_primary_federation_id_fkey(acronym,name), current_club:clubs!athletes_current_club_id_fkey(name), athlete_kyc(global_status)",
      )
      .order("last_name");
    if (error) {
      toast.error("Erreur de chargement", { description: friendlyError(error.message ? { message: error.message } : null) });
      setRows([]);
      return;
    }
    setRows((data ?? []) as AthleteRow[]);
  };

  const loadRefs = async () => {
    const [fd, cl, di, ad] = await Promise.all([
      supabase.from("federations").select("*").order("acronym"),
      supabase.from("clubs").select("*").order("name"),
      supabase.from("disciplines").select("*").order("name"),
      supabase.from("athlete_disciplines").select("athlete_id, discipline_id"),
    ]);
    setFederations((fd.data ?? []) as Federation[]);
    setClubs((cl.data ?? []) as Club[]);
    setDisciplines((di.data ?? []) as Discipline[]);
    const map: Record<string, string[]> = {};
    ((ad.data ?? []) as { athlete_id: string; discipline_id: string }[]).forEach((r) => {
      (map[r.athlete_id] ||= []).push(r.discipline_id);
    });
    setAthleteDisciplines(map);
  };

  useEffect(() => {
    load();
    loadRefs();
  }, []);

  const filtered = useMemo(() => {
    if (!rows) return [];
    const q = search.trim().toLowerCase();
    return rows.filter((a) => {
      if (activeOnly && a.is_active === false) return false;
      if (fSport !== ALL && a.primary_sport_id !== fSport) return false;
      if (fDiscipline !== ALL) {
        const ads = athleteDisciplines[a.id] ?? [];
        if (!ads.includes(fDiscipline)) return false;
      }
      if (fFed !== ALL && a.primary_federation_id !== fFed) return false;
      if (fStatus !== ALL && a.status !== fStatus) return false;
      if (fLevel !== ALL && a.level !== fLevel) return false;
      const kyc = readKyc(a.athlete_kyc);
      if (fKyc !== ALL && kyc !== fKyc) return false;
      if (q) {
        const hay = `${a.first_name} ${a.last_name} ${a.cosl_id} ${a.email ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [rows, search, fSport, fDiscipline, fFed, fStatus, fLevel, fKyc, activeOnly, athleteDisciplines]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const visible = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  useEffect(() => {
    if (page > pageCount) setPage(1);
  }, [pageCount, page]);

  const clubsForFed = useMemo(
    () =>
      form.primary_federation_id
        ? clubs.filter((c) => c.federation_id === form.primary_federation_id)
        : clubs,
    [clubs, form.primary_federation_id],
  );

  const openCreate = () => {
    setEditing(null);
    setErrors({});
    setPendingPhotoFile(null);
    setPendingPhotoPreview(null);
    setForm({
      ...emptyForm,
      cosl_id: generateCoslId(rows?.map((r) => r.cosl_id) ?? []),
    });
    setOpen(true);
  };

  const openEdit = (a: Athlete) => {
    setEditing(a);
    setErrors({});
    setPendingPhotoFile(null);
    setPendingPhotoPreview(null);
    setForm({
      cosl_id: a.cosl_id,
      first_name: a.first_name,
      last_name: a.last_name,
      birth_date: a.birth_date,
      birth_place: a.birth_place ?? "",
      gender: a.gender,
      nationality: a.nationality,
      sport_nationality: a.sport_nationality ?? "",
      email: a.email ?? "",
      phone: a.phone ?? "",
      address: a.address ?? "",
      street: a.street ?? "",
      postcode: a.postcode ?? "",
      city: a.city ?? "",
      country: a.country ?? "",
      emergency_contact_name: a.emergency_contact_name ?? "",
      emergency_contact_phone: a.emergency_contact_phone ?? "",
      photo_url: a.photo_url ?? "",
      primary_sport_id: a.primary_sport_id ?? "",
      primary_federation_id: a.primary_federation_id ?? "",
      current_club_id: a.current_club_id ?? "",
      status: a.status,
      level: a.level ?? "",
      size_clothing: a.size_clothing ?? "",
      size_shoes: a.size_shoes ?? "",
      size_gloves: a.size_gloves ?? "",
      license_number: a.license_number ?? "",
      ada_number: a.ada_number ?? "",
      passport_number: a.passport_number ?? "",
      passport_expiry: a.passport_expiry ?? "",
    });
    setOpen(true);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = athleteSchema.safeParse(form);
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      parsed.error.issues.forEach((i) => {
        if (i.path[0]) errs[i.path[0] as string] = i.message;
      });
      setErrors(errs);
      toast.error("Vérifiez les champs en rouge");
      return;
    }
    setErrors({});
    setSaving(true);
    const v = parsed.data;
    const cosl_id =
      v.cosl_id || generateCoslId(rows?.map((r) => r.cosl_id) ?? []);
    const payload: Record<string, unknown> = {
      cosl_id,
      first_name: v.first_name,
      last_name: v.last_name,
      birth_date: v.birth_date,
      birth_place: v.birth_place || null,
      gender: v.gender,
      nationality: v.nationality.toUpperCase(),
      sport_nationality: v.sport_nationality
        ? v.sport_nationality.toUpperCase()
        : null,
      email: v.email || null,
      phone: v.phone || null,
      address: v.address || null,
      street: v.street || null,
      postcode: v.postcode || null,
      city: v.city || null,
      country: v.country || null,
      emergency_contact_name: v.emergency_contact_name || null,
      emergency_contact_phone: v.emergency_contact_phone || null,
      photo_url: v.photo_url || null,
      primary_sport_id: v.primary_sport_id || null,
      primary_federation_id: v.primary_federation_id || null,
      current_club_id: v.current_club_id || null,
      status: v.status,
      level: v.level || null,
      size_clothing: v.size_clothing || null,
      size_shoes: v.size_shoes || null,
      size_gloves: v.size_gloves || null,
      license_number: v.license_number || null,
      ada_number: v.ada_number || null,
      passport_number: v.passport_number || null,
      passport_expiry: v.passport_expiry || null,
    };
    let createdId: string | null = editing?.id ?? null;
    if (editing) {
      const { error } = await supabase
        .from("athletes")
        .update(payload)
        .eq("id", editing.id);
      if (error) {
        setSaving(false);
        toast.error("Échec de l'enregistrement", { description: friendlyError(error.message ? { message: error.message } : null) });
        return;
      }
    } else {
      const { data: inserted, error } = await supabase
        .from("athletes")
        .insert(payload)
        .select("id")
        .single();
      if (error || !inserted) {
        setSaving(false);
        toast.error("Échec de l'enregistrement", { description: friendlyError(error?.message ? { message: error?.message } : null) });
        return;
      }
      createdId = inserted.id;
    }

    // Upload de la photo en attente (mode création) une fois l'ID disponible
    if (!editing && createdId && pendingPhotoFile) {
      try {
        const ext = pendingPhotoFile.name.split(".").pop()?.toLowerCase() ?? "jpg";
        const path = `athletes/${createdId}/photo/photo_identite.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("documents")
          .upload(path, pendingPhotoFile, { upsert: true, contentType: pendingPhotoFile.type });
        if (!upErr) {
          const { data: signed } = await supabase.storage
            .from("documents")
            .createSignedUrl(path, 60 * 60 * 24 * 365);
          if (signed?.signedUrl) {
            await Promise.all([
              supabase.from("athlete_documents").insert({
                athlete_id: createdId,
                category: "admin",
                doc_type: "photo_identite",
                file_name: pendingPhotoFile.name,
                file_url: signed.signedUrl,
                status: "valid",
              }),
              supabase
                .from("athletes")
                .update({ photo_url: signed.signedUrl })
                .eq("id", createdId),
            ]);
          }
        } else {
          toast.error("Photo non uploadée", { description: friendlyError(upErr.message ? { message: upErr.message } : null) });
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Échec upload photo";
        toast.error(msg);
      }
    }

    setSaving(false);
    toast.success(editing ? "Athlète modifié" : "Athlète ajouté");
    setOpen(false);
    setPendingPhotoFile(null);
    setPendingPhotoPreview(null);
    load();
  };

  const fieldErr = (k: string) =>
    errors[k] ? <p className="text-xs text-red-600">{errors[k]}</p> : null;

  const kycRedCount = (rows ?? []).filter(
    (a) => a.is_active !== false && readKyc(a.athlete_kyc) === "red",
  ).length;
  const kycOrangeCount = (rows ?? []).filter(
    (a) => a.is_active !== false && readKyc(a.athlete_kyc) === "orange",
  ).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Athlètes</h1>
          <p className="mt-1 text-sm text-slate-600">
            Référentiel central des athlètes COSL.
          </p>
        </div>
        <Button onClick={openCreate} className="bg-indigo-500 hover:bg-indigo-600">
          <Plus className="mr-2 h-4 w-4" /> Ajouter un athlète
        </Button>
      </div>

      {(kycRedCount > 0 || kycOrangeCount > 0) && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
          <div className="flex-1 text-sm">
            {kycRedCount > 0 && (
              <span className="text-red-700 font-medium">
                {kycRedCount} athlète(s) non conforme(s) (KYC rouge)
              </span>
            )}
            {kycRedCount > 0 && kycOrangeCount > 0 && " · "}
            {kycOrangeCount > 0 && (
              <span className="text-amber-700">
                {kycOrangeCount} athlète(s) partiellement conforme(s) (KYC orange)
              </span>
            )}
          </div>
          {kycRedCount > 0 && (
            <Button size="sm" variant="outline" onClick={() => setFKyc("red")}>
              Voir les non conformes
            </Button>
          )}
        </div>
      )}

      <div className="grid gap-3 rounded-lg border border-slate-200 bg-white p-4 lg:grid-cols-6">
        <div className="relative lg:col-span-2">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            placeholder="Nom, prénom, ID COSL, email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={fSport} onValueChange={(v) => { setFSport(v); setFDiscipline(ALL); }}>
          <SelectTrigger><SelectValue placeholder="Sport" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Tous les sports</SelectItem>
            {sports.map((s) => (
              <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={fDiscipline} onValueChange={setFDiscipline}>
          <SelectTrigger><SelectValue placeholder="Discipline" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Toutes les disciplines</SelectItem>
            {disciplines
              .filter((d) => fSport === ALL || d.sport_id === fSport)
              .map((d) => (
                <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
              ))}
          </SelectContent>
        </Select>
        <Select value={fFed} onValueChange={setFFed}>
          <SelectTrigger><SelectValue placeholder="Fédération" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Toutes les fédérations</SelectItem>
            {federations.map((f) => (
              <SelectItem key={f.id} value={f.id}>{f.acronym}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={fStatus} onValueChange={setFStatus}>
          <SelectTrigger><SelectValue placeholder="Statut" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Tous les statuts</SelectItem>
            {ATHLETE_STATUSES.map((s) => (
              <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={fLevel} onValueChange={setFLevel}>
          <SelectTrigger><SelectValue placeholder="Niveau" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Tous les niveaux</SelectItem>
            {levels.map((s) => (
              <SelectItem key={s.code} value={s.code}>{s.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={fKyc} onValueChange={setFKyc}>
          <SelectTrigger><SelectValue placeholder="KYC" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Tous KYC</SelectItem>
            <SelectItem value="green">Vert</SelectItem>
            <SelectItem value="orange">Orange</SelectItem>
            <SelectItem value="red">Rouge</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex items-center justify-between gap-3 rounded-md border border-slate-200 px-3 py-1.5 lg:col-span-2">
          <Label htmlFor="active-only" className="cursor-pointer text-sm">
            Athlètes actifs uniquement
          </Label>
          <Switch id="active-only" checked={activeOnly} onCheckedChange={setActiveOnly} />
        </div>
        <div className="flex items-center text-sm text-slate-500">
          {filtered.length} résultat(s)
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white">
        {rows === null ? (
          <TableSkeleton cols={11} />
        ) : filtered.length === 0 ? (
          <div className="p-6">
            <EmptyState message="Aucun athlète enregistré." />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID COSL</TableHead>
                <TableHead>Photo</TableHead>
                <TableHead>Prénom</TableHead>
                <TableHead>Nom</TableHead>
                <TableHead>Sport</TableHead>
                <TableHead>Fédération</TableHead>
                <TableHead>Club</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>Niveau</TableHead>
                <TableHead>KYC</TableHead>
                <TableHead className="w-24 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((a) => {
                const lvl = levels.find((l) => l.code === a.level);
                const kyc = readKyc(a.athlete_kyc);
                return (
                  <TableRow
                    key={a.id}
                    onClick={() => navigate({ to: "/athletes/$id", params: { id: a.id } })}
                    className={`cursor-pointer hover:bg-slate-50 ${a.is_active === false ? "opacity-60" : ""}`}
                  >
                    <TableCell className="font-mono text-xs">{a.cosl_id}</TableCell>
                    <TableCell>
                      <div className="h-8 w-8 overflow-hidden rounded-full bg-slate-200">
                        {a.photo_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={a.photo_url}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-xs font-semibold text-slate-500">
                            {a.first_name[0]}
                            {a.last_name[0]}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{a.first_name}</TableCell>
                    <TableCell className="font-medium">{a.last_name}</TableCell>
                    <TableCell className="text-slate-600">
                      {a.primary_sport?.name ?? "—"}
                    </TableCell>
                    <TableCell className="text-slate-600">
                      {a.primary_federation?.acronym ?? "—"}
                    </TableCell>
                    <TableCell className="text-slate-600">
                      {a.current_club?.name ?? "—"}
                    </TableCell>
                    <TableCell>
                      {statusBadge(a.status)}
                      {a.is_active === false && (
                        <Badge variant="outline" className="ml-2 border-slate-300 text-slate-500">Inactif</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-slate-600">{lvl?.label ?? a.level ?? "—"}</TableCell>
                    <TableCell>{kycBadge(kyc)}</TableCell>
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEdit(a)}
                        aria-label="Modifier"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>

      <PagerBar page={page} pageCount={pageCount} onChange={setPage} />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          <form onSubmit={submit}>
            <DialogHeader>
              <DialogTitle>
                {editing ? "Modifier l'athlète" : "Ajouter un athlète"}
              </DialogTitle>
              <DialogDescription>
                Renseignez les informations principales. L'ID COSL est généré
                automatiquement si laissé vide.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <section className="space-y-3">
                <h3 className="text-sm font-semibold text-slate-700">État civil</h3>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                  <div className="space-y-1.5">
                    <Label>ID COSL</Label>
                    <Input
                      value={form.cosl_id}
                      onChange={(e) => setForm({ ...form, cosl_id: e.target.value })}
                      placeholder="COSL-2026-0001"
                    />
                    {fieldErr("cosl_id")}
                  </div>
                  <div className="space-y-1.5">
                    <Label>Prénom *</Label>
                    <Input
                      value={form.first_name}
                      onChange={(e) => setForm({ ...form, first_name: e.target.value })}
                    />
                    {fieldErr("first_name")}
                  </div>
                  <div className="space-y-1.5">
                    <Label>Nom *</Label>
                    <Input
                      value={form.last_name}
                      onChange={(e) => setForm({ ...form, last_name: e.target.value })}
                    />
                    {fieldErr("last_name")}
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                  <div className="space-y-1.5">
                    <Label>Date de naissance *</Label>
                    <Input
                      type="date"
                      value={form.birth_date}
                      onChange={(e) => setForm({ ...form, birth_date: e.target.value })}
                    />
                    {fieldErr("birth_date")}
                  </div>
                  <div className="space-y-1.5">
                    <Label>Lieu de naissance</Label>
                    <Input
                      value={form.birth_place ?? ""}
                      onChange={(e) => setForm({ ...form, birth_place: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Genre</Label>
                    <Select
                      value={form.gender}
                      onValueChange={(v) => setForm({ ...form, gender: v as AthleteForm["gender"] })}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {GENDERS.map((g) => (
                          <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                  <div className="space-y-1.5">
                    <Label>Nationalité (ISO) *</Label>
                    <Input
                      value={form.nationality}
                      onChange={(e) => setForm({ ...form, nationality: e.target.value })}
                      placeholder="LUX"
                    />
                    {fieldErr("nationality")}
                  </div>
                  <div className="space-y-1.5">
                    <Label>Nationalité sportive</Label>
                    <Input
                      value={form.sport_nationality ?? ""}
                      onChange={(e) =>
                        setForm({ ...form, sport_nationality: e.target.value })
                      }
                      placeholder="LUX"
                    />
                    {fieldErr("sport_nationality")}
                  </div>
                  {!editing && (
                    <div className="space-y-1.5">
                      <Label>Photo officielle</Label>
                      <div className="flex items-center gap-3">
                        <AthletePhotoUpload
                          athleteId={null}
                          currentPhotoUrl={pendingPhotoPreview}
                          initials={`${form.first_name?.[0] ?? ""}${form.last_name?.[0] ?? ""}`}
                          size="sm"
                          pendingPreviewOnly
                          onUploaded={(url, _docId, file) => {
                            if (file) {
                              setPendingPhotoFile(file);
                              setPendingPhotoPreview(url);
                            }
                          }}
                          onDeleted={() => {
                            setPendingPhotoFile(null);
                            setPendingPhotoPreview(null);
                          }}
                        />
                        <p className="text-xs text-slate-400">
                          Glisser une image ou cliquer
                          <br />
                          JPG, PNG, WebP · max 5 MB
                        </p>
                      </div>
                      {fieldErr("photo_url")}
                    </div>
                  )}
                </div>
              </section>

              <section className="space-y-3">
                <h3 className="text-sm font-semibold text-slate-700">Sport</h3>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                  <div className="space-y-1.5">
                    <Label>Sport principal</Label>
                    <EditableSelect
                      value={form.primary_sport_id ?? ""}
                      onValueChange={(v) => setForm({ ...form, primary_sport_id: v })}
                      options={sports.map((s) => ({ value: s.id, label: s.name }))}
                      emptyLabel="—"
                      onAdd={addSport}
                      onDelete={removeSport}
                      addLabel="+ Ajouter un sport…"
                      manageTitle="Gérer les sports"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Fédération</Label>
                    <Select
                      value={form.primary_federation_id || ALL}
                      onValueChange={(v) =>
                        setForm({
                          ...form,
                          primary_federation_id: v === ALL ? "" : v,
                          current_club_id: "",
                        })
                      }
                    >
                      <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value={ALL}>—</SelectItem>
                        {federations.map((f) => (
                          <SelectItem key={f.id} value={f.id}>
                            {f.acronym} — {f.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Club</Label>
                    <Select
                      value={form.current_club_id || ALL}
                      onValueChange={(v) =>
                        setForm({ ...form, current_club_id: v === ALL ? "" : v })
                      }
                    >
                      <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value={ALL}>—</SelectItem>
                        {clubsForFed.map((c) => (
                          <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label>Statut</Label>
                    <Select
                      value={form.status}
                      onValueChange={(v) =>
                        setForm({ ...form, status: v as AthleteForm["status"] })
                      }
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {ATHLETE_STATUSES.map((s) => (
                          <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Niveau</Label>
                    <EditableSelect
                      value={form.level ?? ""}
                      onValueChange={(v) =>
                        setForm({ ...form, level: v as AthleteForm["level"] })
                      }
                      options={levels.map((l) => ({ value: l.code, label: l.label }))}
                      emptyLabel="—"
                      onAdd={addLevel}
                      onDelete={removeLevel}
                      addLabel="+ Ajouter un niveau…"
                      manageTitle="Gérer les niveaux"
                    />
                  </div>
                </div>
              </section>

              <section className="space-y-3">
                <h3 className="text-sm font-semibold text-slate-700">Contacts</h3>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label>Email</Label>
                    <Input
                      type="email"
                      value={form.email ?? ""}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                    />
                    {fieldErr("email")}
                  </div>
                  <div className="space-y-1.5">
                    <Label>Téléphone</Label>
                    <Input
                      value={form.phone ?? ""}
                      onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Adresse (numéro + rue)</Label>
                  <AddressSearch
                    value={form.street ?? ""}
                    onChange={(v) => setForm({ ...form, street: v })}
                    onSelect={(r) =>
                      setForm((f) => ({
                        ...f,
                        street: r.street || f.street,
                        postcode: r.postcode || f.postcode,
                        city: r.city || f.city,
                        country: r.country || f.country,
                      }))
                    }
                    placeholder="Rue, ville, pays…"
                  />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <Label>Code postal</Label>
                    <Input value={form.postcode ?? ""} onChange={(e) => setForm({ ...form, postcode: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Ville</Label>
                    <Input value={form.city ?? ""} onChange={(e) => setForm({ ...form, city: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Pays</Label>
                    <Input value={form.country ?? ""} onChange={(e) => setForm({ ...form, country: e.target.value })} />
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label>Contact d'urgence — nom</Label>
                    <Input
                      value={form.emergency_contact_name ?? ""}
                      onChange={(e) =>
                        setForm({ ...form, emergency_contact_name: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Contact d'urgence — téléphone</Label>
                    <Input
                      value={form.emergency_contact_phone ?? ""}
                      onChange={(e) =>
                        setForm({ ...form, emergency_contact_phone: e.target.value })
                      }
                    />
                  </div>
                </div>
              </section>

              <section className="space-y-3">
                <h3 className="text-sm font-semibold text-slate-700">Tailles équipement</h3>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <Label>Vêtement</Label>
                    <Input
                      value={form.size_clothing ?? ""}
                      onChange={(e) =>
                        setForm({ ...form, size_clothing: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Chaussures</Label>
                    <Input
                      value={form.size_shoes ?? ""}
                      onChange={(e) => setForm({ ...form, size_shoes: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Gants</Label>
                    <Input
                      value={form.size_gloves ?? ""}
                      onChange={(e) => setForm({ ...form, size_gloves: e.target.value })}
                    />
                  </div>
                </div>
              </section>

              <section className="space-y-3">
                <h3 className="text-sm font-semibold text-slate-700">Identifiants externes</h3>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label>N° de licence</Label>
                    <Input
                      value={form.license_number ?? ""}
                      onChange={(e) =>
                        setForm({ ...form, license_number: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>N° ADAMS / antidopage</Label>
                    <Input
                      value={form.ada_number ?? ""}
                      onChange={(e) => setForm({ ...form, ada_number: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>N° de passeport</Label>
                    <Input
                      value={form.passport_number ?? ""}
                      onChange={(e) =>
                        setForm({ ...form, passport_number: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Expiration passeport</Label>
                    <Input
                      type="date"
                      value={form.passport_expiry ?? ""}
                      onChange={(e) =>
                        setForm({ ...form, passport_expiry: e.target.value })
                      }
                    />
                  </div>
                </div>
              </section>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={saving}
              >
                Annuler
              </Button>
              <Button
                type="submit"
                disabled={saving}
                className="bg-indigo-500 hover:bg-indigo-600"
              >
                {saving ? "Enregistrement…" : editing ? "Enregistrer" : "Ajouter"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
