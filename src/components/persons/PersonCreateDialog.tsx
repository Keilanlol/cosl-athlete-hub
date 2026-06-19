import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { friendlyError } from "@/lib/error-messages";
import {
  PERSON_ROLE_TYPES,
  ROLE_LABELS,
  type PersonRoleType,
} from "@/lib/persons";
import { COACH_ROLES, ATHLETE_STATUSES } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AddressSearch } from "@/components/AddressSearch";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (personId: string) => void;
  initialRoles?: PersonRoleType[];
};

type Step = "general" | "roles" | "details";
const STEPS: Step[] = ["general", "roles", "details"];
const STEP_LABELS: Record<Step, string> = {
  general: "Informations générales",
  roles: "Rôles",
  details: "Profils spécifiques",
};

const ROLE_DESCRIPTIONS: Record<PersonRoleType, string> = {
  athlete: "Compétitions, sélections, accréditations",
  coach: "Encadrement technique, médical, logistique",
  federation_member: "Bureau fédéral, gouvernance",
  club_member: "Dirigeant de club",
  official: "Officiel fédéral / international",
  volunteer: "Bénévole sur événements",
  staff: "Personnel COSL",
};

const FED_ROLES = [
  { value: "president", label: "Président" },
  { value: "vice_president", label: "Vice-président" },
  { value: "secretary_general", label: "Secrétaire général" },
  { value: "treasurer", label: "Trésorier" },
  { value: "board_member", label: "Membre du bureau" },
  { value: "delegate", label: "Délégué" },
  { value: "other", label: "Autre" },
];

const CLUB_ROLES = [
  { value: "president", label: "Président" },
  { value: "vice_president", label: "Vice-président" },
  { value: "secretary", label: "Secrétaire" },
  { value: "treasurer", label: "Trésorier" },
  { value: "board_member", label: "Membre du bureau" },
  { value: "head_coach", label: "Entraîneur principal" },
  { value: "other", label: "Autre" },
];

const defaultForm = {
  first_name: "",
  last_name: "",
  birth_date: "",
  gender: "",
  nationality: "LUX",
  email: "",
  phone: "",
  street: "",
  postcode: "",
  city: "",
  country: "LU",
  selectedRoles: [] as PersonRoleType[],
  athlete: {
    primary_sport_id: "",
    primary_federation_id: "",
    current_club_id: "",
    status: "active",
    level: "",
    license_number: "",
    passport_number: "",
    passport_expiry: "",
  },
  coach: { role: "coach", federation_id: "", club_id: "" },
  fedMember: { federation_id: "", role: "president", start_date: "" },
  clubMember: { club_id: "", role: "president", start_date: "" },
};

async function nextCoslId(): Promise<string> {
  const year = new Date().getFullYear();
  const { data } = await supabase
    .from("athletes")
    .select("cosl_id")
    .ilike("cosl_id", `COSL-${year}-%`)
    .order("cosl_id", { ascending: false })
    .limit(1);
  const last = data?.[0]?.cosl_id as string | undefined;
  const seq = last ? parseInt(last.split("-")[2] ?? "0", 10) + 1 : 1;
  return `COSL-${year}-${String(seq).padStart(4, "0")}`;
}

export function PersonCreateDialog({ open, onOpenChange, onCreated, initialRoles }: Props) {
  const [step, setStep] = useState<Step>("general");
  const [form, setForm] = useState({ ...defaultForm, selectedRoles: initialRoles ?? [] });
  const [sports, setSports] = useState<{ id: string; name: string }[]>([]);
  const [federations, setFederations] = useState<{ id: string; name: string; acronym: string | null }[]>([]);
  const [clubs, setClubs] = useState<{ id: string; name: string; federation_id: string | null }[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) {
      setStep("general");
      setForm({ ...defaultForm, selectedRoles: initialRoles ?? [] });
      return;
    }
    supabase.from("sports").select("id, name").order("name")
      .then(({ data }) => setSports((data ?? []) as typeof sports));
    supabase.from("federations").select("id, name, acronym").order("acronym")
      .then(({ data }) => setFederations((data ?? []) as typeof federations));
    supabase.from("clubs").select("id, name, federation_id").order("name")
      .then(({ data }) => setClubs((data ?? []) as typeof clubs));
  }, [open]);

  const setProfile = (profile: "athlete" | "coach" | "fedMember" | "clubMember", key: string, value: string) =>
    setForm((f) => ({ ...f, [profile]: { ...f[profile], [key]: value } }));

  const toggleRole = (r: PersonRoleType) =>
    setForm((f) => ({
      ...f,
      selectedRoles: f.selectedRoles.includes(r)
        ? f.selectedRoles.filter((x) => x !== r)
        : [...f.selectedRoles, r],
    }));

  const stepIndex = STEPS.indexOf(step);
  const isAthleteSelected = form.selectedRoles.includes("athlete");

  const canNext = (): boolean => {
    if (step === "general") {
      if (!form.first_name.trim() || !form.last_name.trim()) return false;
      if (isAthleteSelected) return !!(form.birth_date && form.gender);
      return true;
    }
    return true;
  };

  const goNext = () => setStep(STEPS[stepIndex + 1]!);

  const handleSubmit = async () => {
    if (saving) return;
    setSaving(true);
    try {
      // 1. Create person
      const { data: p, error: pe } = await supabase
        .from("persons")
        .insert({
          first_name: form.first_name.trim(),
          last_name: form.last_name.trim(),
          birth_date: form.birth_date || null,
          gender: form.gender || null,
          nationality: form.nationality.trim() || null,
          email: form.email.trim() || null,
          phone: form.phone.trim() || null,
          street: form.street.trim() || null,
          postcode: form.postcode.trim() || null,
          city: form.city.trim() || null,
          country: form.country.trim() || null,
          is_active: true,
        })
        .select("id")
        .single();
      if (pe || !p) throw pe ?? new Error("Création échouée");
      const personId = p.id as string;

      // 2. person_roles
      if (form.selectedRoles.length > 0) {
        const { error: re } = await supabase
          .from("person_roles")
          .insert(form.selectedRoles.map((role_type) => ({ person_id: personId, role_type })));
        if (re) throw re;
      }

      // 3. Athlete dual-write
      if (form.selectedRoles.includes("athlete")) {
        const cosl_id = await nextCoslId();
        const { data: legAth, error: lae } = await supabase
          .from("athletes")
          .insert({
            cosl_id,
            first_name: form.first_name.trim(),
            last_name: form.last_name.trim(),
            birth_date: form.birth_date,
            gender: form.gender,
            nationality: form.nationality.trim() || "LUX",
            email: form.email.trim() || null,
            phone: form.phone.trim() || null,
            is_active: true,
            status: form.athlete.status,
            level: form.athlete.level || null,
            primary_sport_id: form.athlete.primary_sport_id || null,
            primary_federation_id: form.athlete.primary_federation_id || null,
            current_club_id: form.athlete.current_club_id || null,
            license_number: form.athlete.license_number || null,
            passport_number: form.athlete.passport_number || null,
            passport_expiry: form.athlete.passport_expiry || null,
            person_id: personId,
          })
          .select("id")
          .single();
        if (lae || !legAth) throw lae ?? new Error("Athlète legacy KO");

        await supabase.from("athlete_profiles").insert({
          person_id: personId,
          legacy_athlete_id: legAth.id,
          cosl_id,
          primary_sport_id: form.athlete.primary_sport_id || null,
          primary_federation_id: form.athlete.primary_federation_id || null,
          current_club_id: form.athlete.current_club_id || null,
          status: form.athlete.status,
          level: form.athlete.level || null,
          license_number: form.athlete.license_number || null,
          passport_number: form.athlete.passport_number || null,
          passport_expiry: form.athlete.passport_expiry || null,
        });

        await supabase.from("athlete_kyc").insert({ athlete_id: legAth.id, global_status: "red" });
      }

      // 4. Coach dual-write — creates person + coach + coach_profile
      if (form.selectedRoles.includes("coach")) {
        const { data: legCoach, error: lce } = await supabase
          .from("coaches")
          .insert({
            first_name: form.first_name.trim(),
            last_name: form.last_name.trim(),
            email: form.email.trim() || null,
            phone: form.phone.trim() || null,
            role: form.coach.role,
            federation_id: form.coach.federation_id || null,
            club_id: form.coach.club_id || null,
            is_active: true,
            person_id: personId,
          })
          .select("id")
          .single();
        if (lce || !legCoach) throw lce ?? new Error("Coach legacy KO");

        await supabase.from("coach_profiles").insert({
          person_id: personId,
          legacy_coach_id: legCoach.id,
          role: form.coach.role,
          federation_id: form.coach.federation_id || null,
          club_id: form.coach.club_id || null,
          is_active: true,
        });
      }

      // 5. Federation member dual-write
      if (form.selectedRoles.includes("federation_member") && form.fedMember.federation_id) {
        const { data: legFm, error: lfme } = await supabase
          .from("federation_members")
          .insert({
            federation_id: form.fedMember.federation_id,
            first_name: form.first_name.trim(),
            last_name: form.last_name.trim(),
            email: form.email.trim() || null,
            phone: form.phone.trim() || null,
            role: form.fedMember.role,
            start_date: form.fedMember.start_date || null,
            is_active: true,
            person_id: personId,
          })
          .select("id")
          .single();
        if (lfme || !legFm) throw lfme ?? new Error("Membre fédération legacy KO");

        await supabase.from("federation_member_profiles").insert({
          person_id: personId,
          legacy_federation_member_id: legFm.id,
          federation_id: form.fedMember.federation_id,
          role: form.fedMember.role,
          start_date: form.fedMember.start_date || null,
          is_active: true,
        });
      }

      // 6. Club member dual-write
      if (form.selectedRoles.includes("club_member") && form.clubMember.club_id) {
        const { data: legCm, error: lcme } = await supabase
          .from("club_members")
          .insert({
            club_id: form.clubMember.club_id,
            first_name: form.first_name.trim(),
            last_name: form.last_name.trim(),
            email: form.email.trim() || null,
            phone: form.phone.trim() || null,
            role: form.clubMember.role,
            start_date: form.clubMember.start_date || null,
            is_active: true,
            person_id: personId,
          })
          .select("id")
          .single();
        if (lcme || !legCm) throw lcme ?? new Error("Membre club legacy KO");

        await supabase.from("club_member_profiles").insert({
          person_id: personId,
          legacy_club_member_id: legCm.id,
          club_id: form.clubMember.club_id,
          role: form.clubMember.role,
          start_date: form.clubMember.start_date || null,
          is_active: true,
        });
      }

      toast.success("Personne créée avec succès");
      onOpenChange(false);
      setForm({ ...defaultForm, selectedRoles: initialRoles ?? [] });
      setStep("general");
      onCreated?.(personId);
    } catch (err) {
      toast.error("Échec de la création", { description: friendlyError(err as never) });
    } finally {
      setSaving(false);
    }
  };

  const filteredClubsAthlete = form.athlete.primary_federation_id
    ? clubs.filter((c) => c.federation_id === form.athlete.primary_federation_id)
    : clubs;
  const filteredClubsCoach = form.coach.federation_id
    ? clubs.filter((c) => c.federation_id === form.coach.federation_id)
    : clubs;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" /> Nouvelle personne
          </DialogTitle>
        </DialogHeader>

        <div className="my-4 flex items-center gap-2">
          {STEPS.map((s, i) => (
            <div key={s} className="flex flex-1 items-center gap-2">
              <div className={`flex h-7 w-7 items-center justify-center rounded-full border text-xs font-semibold ${
                i === stepIndex ? "border-primary bg-primary text-white"
                : i < stepIndex ? "border-primary bg-primary/10 text-primary"
                : "border-muted text-muted-foreground"}`}>
                {i + 1}
              </div>
              <span className={`text-xs ${i === stepIndex ? "font-medium text-foreground" : "text-muted-foreground"}`}>
                {STEP_LABELS[s]}
              </span>
              {i < STEPS.length - 1 && <div className="h-px flex-1 bg-border" />}
            </div>
          ))}
        </div>

        {step === "general" && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="fn">Prénom *</Label>
                <Input id="fn" value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ln">Nom *</Label>
                <Input id="ln" value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="bd">Date de naissance {isAthleteSelected && "*"}</Label>
                <Input id="bd" type="date" value={form.birth_date} onChange={(e) => setForm({ ...form, birth_date: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Genre {isAthleteSelected && "*"}</Label>
                <Select value={form.gender} onValueChange={(v) => setForm({ ...form, gender: v })}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="male">Homme</SelectItem>
                    <SelectItem value="female">Femme</SelectItem>
                    <SelectItem value="mixed">Mixte</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="em">Email</Label>
                <Input id="em" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ph">Téléphone</Label>
                <Input id="ph" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="nat">Nationalité</Label>
              <Input id="nat" value={form.nationality} onChange={(e) => setForm({ ...form, nationality: e.target.value })} placeholder="LUX" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="street">Adresse</Label>
              <AddressSearch
                id="street"
                value={form.street}
                onChange={(v) => setForm({ ...form, street: v })}
                onSelect={(r) => setForm({
                  ...form,
                  street: r.street || r.display_name,
                  postcode: r.postcode,
                  city: r.city,
                  country: r.country_code || r.country,
                })}
                placeholder="Rechercher une adresse…"
              />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="postcode">Code postal</Label>
                <Input id="postcode" value={form.postcode} onChange={(e) => setForm({ ...form, postcode: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="city">Ville</Label>
                <Input id="city" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="country">Pays</Label>
                <Input id="country" value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} placeholder="LU" />
              </div>
            </div>
          </div>
        )}

        {step === "roles" && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Sélectionnez un ou plusieurs rôles. Les profils spécifiques seront demandés à l'étape suivante.
            </p>
            {PERSON_ROLE_TYPES.map((role) => (
              <label key={role} className="flex cursor-pointer items-start gap-3 rounded-md border border-border p-3 hover:bg-muted/50">
                <Checkbox checked={form.selectedRoles.includes(role)} onCheckedChange={() => toggleRole(role)} className="mt-0.5" />
                <div className="flex-1">
                  <div className="text-sm font-medium">{ROLE_LABELS[role]}</div>
                  <div className="text-xs text-muted-foreground">{ROLE_DESCRIPTIONS[role]}</div>
                </div>
              </label>
            ))}
          </div>
        )}

        {step === "details" && (
          <div className="space-y-5">
            {form.selectedRoles.length === 0 && (
              <p className="text-sm text-muted-foreground">Aucun rôle sélectionné — la personne sera créée sans profil spécifique.</p>
            )}

            {form.selectedRoles.includes("athlete") && (
              <section className="space-y-3 rounded-md border border-border p-3">
                <h3 className="text-sm font-semibold">🏃 Profil Athlète</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Sport principal</Label>
                    <Select value={form.athlete.primary_sport_id} onValueChange={(v) => setProfile("athlete", "primary_sport_id", v)}>
                      <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                      <SelectContent>{sports.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Fédération</Label>
                    <Select value={form.athlete.primary_federation_id} onValueChange={(v) => { setProfile("athlete", "primary_federation_id", v); setProfile("athlete", "current_club_id", ""); }}>
                      <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                      <SelectContent>{federations.map((f) => <SelectItem key={f.id} value={f.id}>{f.acronym ?? ""} — {f.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Club actuel</Label>
                  <Select value={form.athlete.current_club_id} onValueChange={(v) => setProfile("athlete", "current_club_id", v)}>
                    <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                    <SelectContent>{filteredClubsAthlete.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Statut</Label>
                    <Select value={form.athlete.status} onValueChange={(v) => setProfile("athlete", "status", v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{ATHLETE_STATUSES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Niveau</Label>
                    <Input value={form.athlete.level} onChange={(e) => setProfile("athlete", "level", e.target.value)} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5"><Label>N° licence</Label><Input value={form.athlete.license_number} onChange={(e) => setProfile("athlete", "license_number", e.target.value)} /></div>
                  <div className="space-y-1.5"><Label>Passeport n°</Label><Input value={form.athlete.passport_number} onChange={(e) => setProfile("athlete", "passport_number", e.target.value)} /></div>
                </div>
                <div className="space-y-1.5"><Label>Expiration passeport</Label><Input type="date" value={form.athlete.passport_expiry} onChange={(e) => setProfile("athlete", "passport_expiry", e.target.value)} /></div>
              </section>
            )}

            {form.selectedRoles.includes("coach") && (
              <section className="space-y-3 rounded-md border border-border p-3">
                <h3 className="text-sm font-semibold">🎯 Profil Encadrant</h3>
                <div className="space-y-1.5">
                  <Label>Fonction</Label>
                  <Select value={form.coach.role} onValueChange={(v) => setProfile("coach", "role", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{COACH_ROLES.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Fédération</Label>
                    <Select value={form.coach.federation_id} onValueChange={(v) => { setProfile("coach", "federation_id", v); setProfile("coach", "club_id", ""); }}>
                      <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                      <SelectContent>{federations.map((f) => <SelectItem key={f.id} value={f.id}>{f.acronym ?? ""}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Club</Label>
                    <Select value={form.coach.club_id} onValueChange={(v) => setProfile("coach", "club_id", v)}>
                      <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                      <SelectContent>{filteredClubsCoach.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
              </section>
            )}

            {form.selectedRoles.includes("federation_member") && (
              <section className="space-y-3 rounded-md border border-border p-3">
                <h3 className="text-sm font-semibold">🏛️ Membre de fédération</h3>
                <div className="space-y-1.5">
                  <Label>Fédération *</Label>
                  <Select value={form.fedMember.federation_id} onValueChange={(v) => setProfile("fedMember", "federation_id", v)}>
                    <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                    <SelectContent>{federations.map((f) => <SelectItem key={f.id} value={f.id}>{f.acronym ?? ""} — {f.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Rôle</Label>
                    <Select value={form.fedMember.role} onValueChange={(v) => setProfile("fedMember", "role", v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{FED_ROLES.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5"><Label>Depuis</Label><Input type="date" value={form.fedMember.start_date} onChange={(e) => setProfile("fedMember", "start_date", e.target.value)} /></div>
                </div>
              </section>
            )}

            {form.selectedRoles.includes("club_member") && (
              <section className="space-y-3 rounded-md border border-border p-3">
                <h3 className="text-sm font-semibold">🏟️ Membre de club</h3>
                <div className="space-y-1.5">
                  <Label>Club *</Label>
                  <Select value={form.clubMember.club_id} onValueChange={(v) => setProfile("clubMember", "club_id", v)}>
                    <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                    <SelectContent>{clubs.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Rôle</Label>
                    <Select value={form.clubMember.role} onValueChange={(v) => setProfile("clubMember", "role", v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{CLUB_ROLES.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5"><Label>Depuis</Label><Input type="date" value={form.clubMember.start_date} onChange={(e) => setProfile("clubMember", "start_date", e.target.value)} /></div>
                </div>
              </section>
            )}
          </div>
        )}

        <DialogFooter className="mt-2 flex justify-between sm:justify-between">
          <div>
            {stepIndex > 0 && (
              <Button type="button" variant="outline" onClick={() => setStep(STEPS[stepIndex - 1]!)} disabled={saving}>
                <ChevronLeft className="mr-1 h-4 w-4" /> Précédent
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>Annuler</Button>
            {step !== "details" ? (
              <Button type="button" onClick={goNext} disabled={!canNext()}>
                Suivant <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            ) : (
              <Button type="button" onClick={handleSubmit} disabled={saving}>
                {saving ? "Création…" : "Créer la personne"}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}