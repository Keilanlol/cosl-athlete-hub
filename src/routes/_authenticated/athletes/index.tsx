import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { friendlyError } from "@/lib/error-messages";
import { useEffect, useMemo, useState } from "react";
import { Pencil, Search, AlertTriangle, Users, Upload } from "lucide-react";
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
  type Discipline,
  type Federation,
} from "@/lib/types";
import { EditableSelect } from "@/components/EditableSelect";
import { AthletePhotoUpload } from "@/components/AthletePhotoUpload";
import { AddPersonButton } from "@/components/persons/AddPersonButton";
import { CsvImportDialog } from "@/components/CsvImportDialog";
import { athletesImportConfig } from "@/lib/csv-import-configs";
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
  SortBtn,
  TableSkeleton,
} from "@/components/DataTableShell";

export const Route = createFileRoute("/_authenticated/athletes/")({
  component: AthletesPage,
});

type KycEmbed = { global_status: string | null } | { global_status: string | null }[] | null;
type AthleteRow = Athlete & {
  primary_sport: { name: string } | null;
  primary_federation: { acronym: string; name: string } | null;
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
  status: "active",
  level: "",
  size_clothing: "",
  size_shoes: "",
  size_gloves: "",
  passport_number: "",
  passport_expiry: "",
  last_medical_check: "",
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

type SortKey = "cosl_id" | "first_name" | "last_name" | "primary_sport" | "primary_federation" | "status" | "level" | "athlete_kyc";

function AthletesPage() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<AthleteRow[] | null>(null);
  const { items: sports, add: addSport, remove: removeSport } = useSports();
  const { items: levels, add: addLevel, remove: removeLevel } = useAthleteLevels();
  const [federations, setFederations] = useState<Federation[]>([]);
  const [games, setGames] = useState<{ id: string; name: string; short_name: string | null }[]>([]);
  const [disciplines, setDisciplines] = useState<Discipline[]>([]);
  const [athleteDisciplines, setAthleteDisciplines] = useState<Record<string, string[]>>({});

  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({
    key: "last_name",
    dir: "asc",
  });
  const [fSport, setFSport] = useState(ALL);
  const [fDiscipline, setFDiscipline] = useState(ALL);
  const [fFed, setFFed] = useState(ALL);
  const [fGame, setFGame] = useState(ALL);
  const [fStatus, setFStatus] = useState(ALL);
  const [fLevel, setFLevel] = useState(ALL);
  const [fKyc, setFKyc] = useState(ALL);
  const [fActive, setFActive] = useState<"active" | "inactive" | "all">("active");

  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  
  const [editing, setEditing] = useState<Athlete | null>(null);
  const [form, setForm] = useState<AthleteForm>(emptyForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [pendingPhotoFile, setPendingPhotoFile] = useState<File | null>(null);
  const [pendingPhotoPreview, setPendingPhotoPreview] = useState<string | null>(null);

  const load = async () => {
    setRows(null);
    let gameAthleteIds: string[] | null = null;
    if (fGame !== ALL) {
      // Get person_ids for this game, then resolve to athlete_ids via athlete_profiles
      const { data: links } = await supabase
        .from("v_persons_in_games")
        .select("person_id")
        .eq("game_id", fGame);
      const personIds = (links ?? []).map((r) => r.person_id as string);
      if (personIds.length === 0) {
        setRows([]);
        return;
      }
      const { data: aps } = await supabase
        .from("athlete_profiles")
        .select("legacy_athlete_id")
        .in("person_id", personIds);
      gameAthleteIds = (aps ?? []).map((a) => a.legacy_athlete_id as string).filter(Boolean);
      if (gameAthleteIds.length === 0) {
        setRows([]);
        return;
      }
    }
    let query = supabase
      .from("athletes")
      .select(
        "*, primary_sport:sports!athletes_primary_sport_id_fkey(name), primary_federation:federations!athletes_primary_federation_id_fkey(acronym,name), athlete_kyc(global_status)",
      )
      .order("last_name");
    if (gameAthleteIds) {
      query = query.in("id", gameAthleteIds);
    }
    const { data, error } = await query;
    if (error) {
      toast.error("Erreur de chargement", { description: friendlyError(error) });
      setRows([]);
      return;
    }
    setRows((data ?? []) as AthleteRow[]);
  };

  const loadRefs = async () => {
    const [fd, di, ad, gm] = await Promise.all([
      supabase.from("federations").select("*").order("acronym"),
      supabase.from("disciplines").select("*").order("name"),
      supabase.from("athlete_disciplines").select("athlete_id, discipline_id"),
      supabase.from("games").select("id, name, short_name").order("name"),
    ]);
    setFederations((fd.data ?? []) as Federation[]);
    setDisciplines((di.data ?? []) as Discipline[]);
    setGames((gm.data ?? []) as { id: string; name: string; short_name: string | null }[]);
    const map: Record<string, string[]> = {};
    ((ad.data ?? []) as { athlete_id: string; discipline_id: string }[]).forEach((r) => {
      (map[r.athlete_id] ||= []).push(r.discipline_id);
    });
    setAthleteDisciplines(map);
  };

  useEffect(() => {
    load();
    loadRefs();
  }, [fGame]);

  const filtered = useMemo(() => {
    if (!rows) return [];
    const q = search.trim().toLowerCase();
    let r = rows.filter((a) => {
      if (fActive === "active" && a.is_active === false) return false;
      if (fActive === "inactive" && a.is_active !== false) return false;
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
    r.sort((a, b) => {
      let av: string;
      let bv: string;
      if (sort.key === "primary_sport") {
        av = a.primary_sport?.name ?? "";
        bv = b.primary_sport?.name ?? "";
      } else if (sort.key === "primary_federation") {
        av = a.primary_federation?.acronym ?? "";
        bv = b.primary_federation?.acronym ?? "";
      } else if (sort.key === "athlete_kyc") {
        av = readKyc(a.athlete_kyc);
        bv = readKyc(b.athlete_kyc);
      } else {
        av = (a[sort.key] ?? "").toString().toLowerCase();
        bv = (b[sort.key] ?? "").toString().toLowerCase();
      }
      const cmp = av.localeCompare(bv);
      return sort.dir === "asc" ? cmp : -cmp;
    });
    return r;
  }, [rows, search, fSport, fDiscipline, fFed, fStatus, fLevel, fKyc, fActive, athleteDisciplines, sort]);

  const toggleSort = (key: SortKey) =>
    setSort((s) =>
      s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" },
    );

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const visible = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  useEffect(() => {
    if (page > pageCount) setPage(1);
  }, [pageCount, page]);

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
      status: a.status,
      level: a.level ?? "",
      size_clothing: a.size_clothing ?? "",
      size_shoes: a.size_shoes ?? "",
      size_gloves: a.size_gloves ?? "",
      passport_number: a.passport_number ?? "",
      passport_expiry: a.passport_expiry ?? "",
      last_medical_check: a.last_medical_check ?? "",
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
      status: v.status,
      level: v.level || null,
      size_clothing: v.size_clothing || null,
      size_shoes: v.size_shoes || null,
      size_gloves: v.size_gloves || null,
      passport_number: v.passport_number || null,
      passport_expiry: v.passport_expiry || null,
      last_medical_check: v.last_medical_check || null,
    };
    let createdId: string | null = editing?.id ?? null;
    if (editing) {
      const { error } = await supabase
        .from("athletes")
        .update(payload)
        .eq("id", editing.id);
      if (error) {
        setSaving(false);
        toast.error("Échec de l'enregistrement", { description: friendlyError(error) });
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
        toast.error("Échec de l'enregistrement", { description: friendlyError(error) });
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
          toast.error("Photo non uploadée", { description: friendlyError(upErr) });
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
        <div className="flex items-center gap-3">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-white">
            <Users className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Athlètes</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Référentiel central des athlètes COSL.
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setImportOpen(true)}>
            <Upload className="mr-2 h-4 w-4" /> Importer
          </Button>
          <AddPersonButton
            role="athlete"
            label="Ajouter un athlète"
            onChanged={(personId) => {
              load();
              navigate({ to: "/persons/$personId", params: { personId } });
            }}
          />
        </div>
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

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative max-w-sm flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Nom, prénom, ID COSL, email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={fSport} onValueChange={(v) => { setFSport(v); setFDiscipline(ALL); }}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Sport" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Tous les sports</SelectItem>
            {sports.map((s) => (
              <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={fFed} onValueChange={setFFed}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Fédération" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Toutes les fédérations</SelectItem>
            {federations.map((f) => (
              <SelectItem key={f.id} value={f.id}>{f.acronym}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={fGame} onValueChange={(v) => { setFGame(v); }}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="Games" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Tous les Games</SelectItem>
            {games.map((g) => (
              <SelectItem key={g.id} value={g.id}>{g.short_name ?? g.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={fStatus} onValueChange={setFStatus}>
          <SelectTrigger className="w-[150px]"><SelectValue placeholder="Statut" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Tous les statuts</SelectItem>
            {ATHLETE_STATUSES.map((s) => (
              <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={fLevel} onValueChange={setFLevel}>
          <SelectTrigger className="w-[150px]"><SelectValue placeholder="Niveau" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Tous les niveaux</SelectItem>
            {levels.map((s) => (
              <SelectItem key={s.code} value={s.code}>{s.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={fKyc} onValueChange={setFKyc}>
          <SelectTrigger className="w-[130px]"><SelectValue placeholder="KYC" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Tous KYC</SelectItem>
            <SelectItem value="green">Vert</SelectItem>
            <SelectItem value="orange">Orange</SelectItem>
            <SelectItem value="red">Rouge</SelectItem>
          </SelectContent>
        </Select>
        <Select value={fActive} onValueChange={(v) => setFActive(v as "active" | "inactive" | "all")}>
          <SelectTrigger className="w-[140px]"><SelectValue placeholder="Activité" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous</SelectItem>
            <SelectItem value="active">Activés</SelectItem>
            <SelectItem value="inactive">Désactivés</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-sm text-muted-foreground ml-auto whitespace-nowrap">
          {filtered.length} résultat(s)
        </span>
      </div>

      <div className="rounded-lg border border-border bg-card">
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
                <TableHead className="w-14"></TableHead>
                <TableHead><SortBtn active={sort.key === "cosl_id"} dir={sort.dir} onClick={() => toggleSort("cosl_id")}>ID COSL</SortBtn></TableHead>
                <TableHead><SortBtn active={sort.key === "first_name"} dir={sort.dir} onClick={() => toggleSort("first_name")}>Prénom</SortBtn></TableHead>
                <TableHead><SortBtn active={sort.key === "last_name"} dir={sort.dir} onClick={() => toggleSort("last_name")}>Nom</SortBtn></TableHead>
                <TableHead><SortBtn active={sort.key === "primary_sport"} dir={sort.dir} onClick={() => toggleSort("primary_sport")}>Sport</SortBtn></TableHead>
                <TableHead><SortBtn active={sort.key === "primary_federation"} dir={sort.dir} onClick={() => toggleSort("primary_federation")}>Fédération</SortBtn></TableHead>
                <TableHead><SortBtn active={sort.key === "status"} dir={sort.dir} onClick={() => toggleSort("status")}>Statut</SortBtn></TableHead>
                <TableHead><SortBtn active={sort.key === "level"} dir={sort.dir} onClick={() => toggleSort("level")}>Niveau</SortBtn></TableHead>
                <TableHead><SortBtn active={sort.key === "athlete_kyc"} dir={sort.dir} onClick={() => toggleSort("athlete_kyc")}>KYC</SortBtn></TableHead>
                <TableHead className="w-12 text-right">Actions</TableHead>
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
                    className="cursor-pointer hover:bg-muted"
                  >
                    <TableCell>
                      <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border border-border bg-muted">
                        {a.photo_url ? (
                          <img
                            src={a.photo_url}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <span className="text-xs font-semibold text-muted-foreground">
                            {(a.first_name[0] ?? "") + (a.last_name[0] ?? "")}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="font-mono">{a.cosl_id}</TableCell>
                    <TableCell>{a.first_name}</TableCell>
                    <TableCell className="font-medium">{a.last_name}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {a.primary_sport?.name ?? "—"}
                    </TableCell>
                    <TableCell>
                      {a.primary_federation ? (
                        <Link to="/federations/$id" params={{ id: a.primary_federation_id! }}>
                          <Badge variant="outline" className="font-mono hover:bg-muted">
                            {a.primary_federation.acronym}
                          </Badge>
                        </Link>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {statusBadge(a.status)}
                      {a.is_active === false && (
                        <Badge variant="outline" className="ml-2 border-border text-muted-foreground">Inactif</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{lvl?.label ?? a.level ?? "—"}</TableCell>
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
                <h3 className="text-sm font-semibold text-foreground">État civil</h3>
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
                        <p className="text-xs text-muted-foreground">
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
                <h3 className="text-sm font-semibold text-foreground">Sport</h3>
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
                <h3 className="text-sm font-semibold text-foreground">Contacts</h3>
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
                <h3 className="text-sm font-semibold text-foreground">Tailles équipement</h3>
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
                <h3 className="text-sm font-semibold text-foreground">Identifiants externes</h3>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
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
                className="bg-primary hover:bg-[var(--cosl-red-dark)]"
              >
                {saving ? "Enregistrement…" : editing ? "Enregistrer" : "Ajouter"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <CsvImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        config={athletesImportConfig}
        onImported={() => load()}
      />
    </div>
  );
}
