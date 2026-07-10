import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { friendlyError } from "@/lib/error-messages";
import {
  PERSON_ROLE_TYPES,
  ROLE_LABELS,
  fetchNextCoslId,
  defaultPersonGeneral,
  defaultAthleteProfile,
  defaultCoachProfile,
  defaultFedMemberProfile,
  type PersonRoleType,
  type PersonGeneralFields,
  type AthleteProfileFields,
  type CoachProfileFields,
  type FedMemberProfileFields,
} from "@/lib/persons";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { PersonGeneralForm } from "@/components/persons/PersonGeneralForm";
import { RoleProfileForm } from "@/components/persons/RoleProfileForm";

type EventOption = { id: string; name: string };

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
  official: "Officiel fédéral / international",
  volunteer: "Bénévole sur événements",
  staff: "Personnel COSL",
};

export function PersonCreateDialog({ open, onOpenChange, onCreated, initialRoles }: Props) {
  const [step, setStep] = useState<Step>("general");
  const [general, setGeneral] = useState<PersonGeneralFields>({ ...defaultPersonGeneral });
  const [selectedRoles, setSelectedRoles] = useState<PersonRoleType[]>(initialRoles ?? []);
  const [athlete, setAthlete] = useState<AthleteProfileFields>({ ...defaultAthleteProfile });
  const [coach, setCoach] = useState<CoachProfileFields>({ ...defaultCoachProfile });
  const [fedMember, setFedMember] = useState<FedMemberProfileFields>({ ...defaultFedMemberProfile });
  const [sports, setSports] = useState<{ id: string; name: string }[]>([]);
  const [federations, setFederations] = useState<{ id: string; name: string; acronym: string | null }[]>([]);
  const [events, setEvents] = useState<EventOption[]>([]);
  const [linkEvent, setLinkEvent] = useState(false);
  const [selectedEventId, setSelectedEventId] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) {
      setStep("general");
      setGeneral({ ...defaultPersonGeneral });
      setSelectedRoles(initialRoles ?? []);
      setAthlete({ ...defaultAthleteProfile });
      setCoach({ ...defaultCoachProfile });
      setFedMember({ ...defaultFedMemberProfile });
      setLinkEvent(false);
      setSelectedEventId("");
      return;
    }
    supabase.from("sports").select("id, name").order("name")
      .then(({ data }) => setSports((data ?? []) as typeof sports));
    supabase.from("federations").select("id, name, acronym").order("acronym")
      .then(({ data }) => setFederations((data ?? []) as typeof federations));
    supabase.from("events").select("id, name").order("name")
      .then(({ data }) => setEvents((data ?? []) as EventOption[]));
  }, [open]);

  const patchGeneral = (patch: Partial<PersonGeneralFields>) =>
    setGeneral((g) => ({ ...g, ...patch }));
  const patchAthlete = (patch: Partial<AthleteProfileFields>) =>
    setAthlete((a) => ({ ...a, ...patch }));
  const patchCoach = (patch: Partial<CoachProfileFields>) =>
    setCoach((c) => ({ ...c, ...patch }));
  const patchFedMember = (patch: Partial<FedMemberProfileFields>) =>
    setFedMember((f) => ({ ...f, ...patch }));

  const toggleRole = (r: PersonRoleType) =>
    setSelectedRoles((prev) =>
      prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r],
    );

  const stepIndex = STEPS.indexOf(step);
  const isAthleteSelected = selectedRoles.includes("athlete");

  const canNext = (): boolean => {
    if (step === "general") {
      if (!general.first_name.trim() || !general.last_name.trim()) return false;
      if (isAthleteSelected) return !!(general.birth_date && general.gender);
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
          first_name: general.first_name.trim(),
          last_name: general.last_name.trim(),
          birth_date: general.birth_date || null,
          gender: general.gender || null,
          nationality: general.nationality.trim() || null,
          email: general.email.trim() || null,
          phone: general.phone.trim() || null,
          street: general.street.trim() || null,
          postcode: general.postcode.trim() || null,
          city: general.city.trim() || null,
          country: general.country.trim() || null,
          is_active: true,
        })
        .select("id")
        .single();
      if (pe || !p) throw pe ?? new Error("Création échouée");
      const personId = p.id as string;

      // 2. person_roles
      if (selectedRoles.length > 0) {
        const { error: re } = await supabase
          .from("person_roles")
          .insert(selectedRoles.map((role_type) => ({ person_id: personId, role_type })));
        if (re) throw re;
      }

      // 3. Athlete dual-write
      if (selectedRoles.includes("athlete")) {
        const cosl_id = await fetchNextCoslId();
        const { data: legAth, error: lae } = await supabase
          .from("athletes")
          .insert({
            cosl_id,
            first_name: general.first_name.trim(),
            last_name: general.last_name.trim(),
            birth_date: general.birth_date,
            gender: general.gender,
            nationality: general.nationality.trim() || "LUX",
            email: general.email.trim() || null,
            phone: general.phone.trim() || null,
            is_active: true,
            status: athlete.status,
            level: athlete.level || null,
            primary_sport_id: athlete.primary_sport_id || null,
            primary_federation_id: athlete.primary_federation_id || null,
            passport_number: athlete.passport_number || null,
            passport_expiry: athlete.passport_expiry || null,
            person_id: personId,
          })
          .select("id")
          .single();
        if (lae || !legAth) throw lae ?? new Error("Athlète legacy KO");

        await supabase.from("athlete_profiles").insert({
          person_id: personId,
          legacy_athlete_id: legAth.id,
          cosl_id,
          primary_sport_id: athlete.primary_sport_id || null,
          primary_federation_id: athlete.primary_federation_id || null,
          status: athlete.status,
          level: athlete.level || null,
          passport_number: athlete.passport_number || null,
          passport_expiry: athlete.passport_expiry || null,
        });

        await supabase.from("athlete_kyc").insert({ athlete_id: legAth.id, global_status: "red" });
      }

      // 4. Coach dual-write
      if (selectedRoles.includes("coach")) {
        const { data: legCoach, error: lce } = await supabase
          .from("coaches")
          .insert({
            first_name: general.first_name.trim(),
            last_name: general.last_name.trim(),
            email: general.email.trim() || null,
            phone: general.phone.trim() || null,
            role: coach.role,
            federation_id: coach.federation_id || null,
            is_active: true,
            person_id: personId,
          })
          .select("id")
          .single();
        if (lce || !legCoach) throw lce ?? new Error("Coach legacy KO");

        await supabase.from("coach_profiles").insert({
          person_id: personId,
          legacy_coach_id: legCoach.id,
          role: coach.role,
          federation_id: coach.federation_id || null,
          is_active: true,
        });
      }

      // 5. Federation member dual-write
      if (selectedRoles.includes("federation_member") && fedMember.federation_id) {
        const { data: legFm, error: lfme } = await supabase
          .from("federation_members")
          .insert({
            federation_id: fedMember.federation_id,
            first_name: general.first_name.trim(),
            last_name: general.last_name.trim(),
            email: general.email.trim() || null,
            phone: general.phone.trim() || null,
            role: fedMember.role,
            start_date: fedMember.start_date || null,
            notes: fedMember.notes || null,
            is_active: true,
            person_id: personId,
          })
          .select("id")
          .single();
        if (lfme || !legFm) throw lfme ?? new Error("Membre fédération legacy KO");

        await supabase.from("federation_member_profiles").insert({
          person_id: personId,
          legacy_federation_member_id: legFm.id,
          federation_id: fedMember.federation_id,
          role: fedMember.role,
          start_date: fedMember.start_date || null,
          notes: fedMember.notes || null,
          is_active: true,
        });
      }

      // 6. Event link (if toggle is on)
      if (linkEvent && selectedEventId) {
        const { error: ee } = await supabase
          .from("person_events")
          .insert({ person_id: personId, event_id: selectedEventId });
        if (ee) {
          // Non-blocking — just warn
          toast.warning("Lien événement non créé", { description: friendlyError(ee) });
        }
      }

      toast.success("Personne créée avec succès");
      onOpenChange(false);
      onCreated?.(personId);
    } catch (err) {
      toast.error("Échec de la création", { description: friendlyError(err as never) });
    } finally {
      setSaving(false);
    }
  };

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
          <>
            <PersonGeneralForm
              values={general}
              onChange={patchGeneral}
              athleteRequiresBirthGender={isAthleteSelected}
            />
            <div className="space-y-3 rounded-md border border-border p-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">Rattacher à un événement</Label>
                <Switch
                  checked={linkEvent}
                  onCheckedChange={(v) => { setLinkEvent(v); if (!v) setSelectedEventId(""); }}
                />
              </div>
              {linkEvent && (
                <div className="space-y-1.5">
                  <Label>Événement</Label>
                  <Select value={selectedEventId} onValueChange={setSelectedEventId}>
                    <SelectTrigger><SelectValue placeholder="Choisir un événement…" /></SelectTrigger>
                    <SelectContent>
                      {events.length === 0 ? (
                        <SelectItem value="__none" disabled>Aucun événement disponible</SelectItem>
                      ) : (
                        events.map((e) => (
                          <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          </>
        )}

        {step === "roles" && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Sélectionnez un ou plusieurs rôles. Les profils spécifiques seront demandés à l'étape suivante.
            </p>
            {PERSON_ROLE_TYPES.map((role) => (
              <label key={role} className="flex cursor-pointer items-start gap-3 rounded-md border border-border p-3 hover:bg-muted/50">
                <Checkbox checked={selectedRoles.includes(role)} onCheckedChange={() => toggleRole(role)} className="mt-0.5" />
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
            {selectedRoles.length === 0 && (
              <p className="text-sm text-muted-foreground">Aucun rôle sélectionné — la personne sera créée sans profil spécifique.</p>
            )}
            {selectedRoles.map((role) => (
              <RoleProfileForm
                key={role}
                role={role}
                sports={sports}
                federations={federations}
                athlete={athlete}
                coach={coach}
                fedMember={fedMember}
                onAthlete={patchAthlete}
                onCoach={patchCoach}
                onFedMember={patchFedMember}
              />
            ))}
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
              <Button type="button" onClick={handleSubmit} disabled={saving} className="bg-primary hover:bg-[var(--cosl-red-dark)]">
                {saving ? "Création…" : "Créer la personne"}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}