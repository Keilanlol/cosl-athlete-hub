import { useEffect, useState, useMemo } from "react";
import { ChevronLeft, ChevronRight, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { friendlyError } from "@/lib/error-messages";
import {
  useForm,
  FormProvider,
  Controller,
} from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  PERSON_ROLE_TYPES,
  ROLE_LABELS,
  type PersonRoleType,
} from "@/lib/persons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
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
import {
  createPerson,
  createAthleteFromPerson,
  createCoachFromPerson,
  createFederationMemberFromPerson,
  createClubMemberFromPerson,
} from "@/lib/dual-write";
import { personBaseSchema } from "@/lib/form-schemas";
import { COACH_ROLES } from "@/lib/types";
import { PersonBaseFields } from "@/components/forms/PersonBaseFields";
import { AthleteRoleFields } from "@/components/forms/AthleteRoleFields";
import { CoachRoleFields } from "@/components/forms/CoachRoleFields";
import { MemberRoleFields } from "@/components/forms/MemberRoleFields";
import { DialogFooterButtons } from "@/components/forms/DialogFooterButtons";

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

const ROLE_DESCRIPTIONS: Record<PersonRoleType, string> = {
  athlete: "Compétitions, sélections, accréditations",
  coach: "Encadrement technique, médical, logistique",
  federation_member: "Bureau fédéral, gouvernance",
  club_member: "Dirigeant de club",
  official: "Officiel fédéral / international",
  volunteer: "Bénévole sur événements",
  staff: "Personnel COSL",
};

const athleteSchemaPartial = z.object({
  primary_sport_id: z.string().optional().or(z.literal("")),
  primary_federation_id: z.string().optional().or(z.literal("")),
  current_club_id: z.string().optional().or(z.literal("")),
  status: z.string(),
  level: z.string().optional().or(z.literal("")),
  license_number: z.string().optional().or(z.literal("")),
  passport_number: z.string().optional().or(z.literal("")),
  passport_expiry: z.string().optional().or(z.literal("")),
});

const coachSchemaPartial = z.object({
  role: z.string(),
  federation_id: z.string().optional().or(z.literal("")),
  club_id: z.string().optional().or(z.literal("")),
});

const fedMemberSchemaPartial = z.object({
  federation_id: z.string().optional().or(z.literal("")),
  role: z.string(),
  start_date: z.string().optional().or(z.literal("")),
});

const clubMemberSchemaPartial = z.object({
  club_id: z.string().optional().or(z.literal("")),
  role: z.string(),
  start_date: z.string().optional().or(z.literal("")),
});

const detailsSchema = z.object({
  selectedRoles: z.array(z.string()).default([]),
  athlete: athleteSchemaPartial,
  coach: coachSchemaPartial,
  fedMember: fedMemberSchemaPartial,
  clubMember: clubMemberSchemaPartial,
});

const schema = personBaseSchema.merge(detailsSchema);

type FormValues = z.infer<typeof schema>;

export function PersonCreateDialog({
  open,
  onOpenChange,
  onCreated,
  initialRoles,
}: Props) {
  const [step, setStep] = useState<Step>("general");
  const [saving, setSaving] = useState(false);
  const [sports, setSports] = useState<{ id: string; name: string }[]>([]);
  const [federations, setFederations] = useState<
    { id: string; name: string; acronym: string | null }[]
  >([]);
  const [clubs, setClubs] = useState<
    { id: string; name: string; federation_id: string | null }[]
  >([]);

  const methods = useForm<FormValues>({
    resolver: zodResolver(schema) as never,
    defaultValues: {
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
      selectedRoles: initialRoles ?? [],
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
    } as FormValues,
  });

  const {
    watch,
    setValue,
    handleSubmit,
    reset,
    control,
  } = methods;

  const selectedRoles = watch("selectedRoles") ?? [];

  useEffect(() => {
    if (!open) {
      setStep("general");
      reset({
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
        selectedRoles: initialRoles ?? [],
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
      });
      return;
    }
    supabase
      .from("sports")
      .select("id, name")
      .order("name")
      .then(({ data }) => setSports((data ?? []) as typeof sports));
    supabase
      .from("federations")
      .select("id, name, acronym")
      .order("acronym")
      .then(({ data }) => setFederations((data ?? []) as typeof federations));
    supabase
      .from("clubs")
      .select("id, name, federation_id")
      .order("name")
      .then(({ data }) => setClubs((data ?? []) as typeof clubs));
  }, [open, reset, initialRoles]);

  useEffect(() => {
    if (open && initialRoles && initialRoles.length > 0) {
      const current = watch("selectedRoles");
      if (current.length === 0) {
        setValue("selectedRoles", initialRoles, { shouldValidate: true });
      }
    }
  }, [open, initialRoles, setValue, watch]);

  const toggleRole = (r: PersonRoleType) =>
    setValue(
      "selectedRoles",
      selectedRoles.includes(r)
        ? selectedRoles.filter((x) => x !== r)
        : [...selectedRoles, r],
      { shouldValidate: true },
    );

  const stepIndex = STEPS.indexOf(step);
  const isAthleteSelected = selectedRoles.includes("athlete");

  const canNext = () => {
    if (step === "general") {
      const first = watch("first_name").trim();
      const last = watch("last_name").trim();
      if (!first || !last) return false;
      if (isAthleteSelected) {
        const bd = watch("birth_date");
        const gender = watch("gender");
        return !!bd && !!gender;
      }
      return true;
    }
    return true;
  };

  const goNext = () => setStep(STEPS[stepIndex + 1]!);

  const onSubmit = async (values: FormValues) => {
    setSaving(true);
    try {
      const personId = await createPerson({
        first_name: values.first_name,
        last_name: values.last_name,
        birth_date: values.birth_date || null,
        gender: values.gender || null,
        nationality: values.nationality?.trim(),
        email: values.email?.trim(),
        phone: values.phone?.trim(),
        street: values.street?.trim(),
        postcode: values.postcode?.trim(),
        city: values.city?.trim(),
        country: values.country?.trim(),
      });

      if (selectedRoles.includes("athlete")) {
        await createAthleteFromPerson(
          personId,
          {
            first_name: values.first_name,
            last_name: values.last_name,
            birth_date: values.birth_date || null,
            gender: values.gender || null,
            nationality: values.nationality?.trim(),
            email: values.email?.trim(),
            phone: values.phone?.trim(),
          },
          {
            primary_sport_id: values.athlete?.primary_sport_id,
            primary_federation_id: values.athlete?.primary_federation_id,
            current_club_id: values.athlete?.current_club_id,
            status: values.athlete?.status,
            level: values.athlete?.level,
            license_number: values.athlete?.license_number,
            passport_number: values.athlete?.passport_number,
            passport_expiry: values.athlete?.passport_expiry,
          },
        );
      }

      if (selectedRoles.includes("coach")) {
        await createCoachFromPerson(
          personId,
          {
            first_name: values.first_name,
            last_name: values.last_name,
            email: values.email?.trim(),
            phone: values.phone?.trim(),
          },
          {
            role: values.coach?.role ?? "coach",
            federation_id: values.coach?.federation_id,
            club_id: values.coach?.club_id,
          },
        );
      }

      if (
        selectedRoles.includes("federation_member") &&
        values.fedMember?.federation_id
      ) {
        await createFederationMemberFromPerson(
          personId,
          {
            first_name: values.first_name,
            last_name: values.last_name,
            email: values.email?.trim() || null,
            phone: values.phone?.trim() || null,
          },
          {
            federation_id: values.fedMember.federation_id,
            role: values.fedMember.role,
            start_date: values.fedMember.start_date || null,
          },
        );
      }

      if (
        selectedRoles.includes("club_member") &&
        values.clubMember?.club_id
      ) {
        await createClubMemberFromPerson(
          personId,
          {
            first_name: values.first_name,
            last_name: values.last_name,
            email: values.email?.trim() || null,
            phone: values.phone?.trim() || null,
          },
          {
            club_id: values.clubMember.club_id,
            role: values.clubMember.role,
            start_date: values.clubMember.start_date || null,
          },
        );
      }

      toast.success("Personne créée avec succès");
      onOpenChange(false);
      onCreated?.(personId);
    } catch (err) {
      toast.error("Échec de la création", {
        description: friendlyError(err as never),
      });
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
              <div
                className={`flex h-7 w-7 items-center justify-center rounded-full border text-xs font-semibold ${
                  i === stepIndex
                    ? "border-primary bg-primary text-white"
                    : i < stepIndex
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-muted text-muted-foreground"
                }`}
              >
                {i + 1}
              </div>
              <span
                className={`text-xs ${i === stepIndex ? "font-medium text-foreground" : "text-muted-foreground"}`}
              >
                {STEP_LABELS[s]}
              </span>
              {i < STEPS.length - 1 && <div className="h-px flex-1 bg-border" />}
            </div>
          ))}
        </div>

        <FormProvider {...methods}>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {step === "general" && (
              <PersonBaseFields
                requireBirthDate={isAthleteSelected}
                requireGender={isAthleteSelected}
              />
            )}

            {step === "roles" && (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Sélectionnez un ou plusieurs rôles. Les profils spécifiques seront
                  demandés à l’étape suivante.
                </p>
                {PERSON_ROLE_TYPES.map((role: PersonRoleType) => (
                  <label
                    key={role}
                    className="flex cursor-pointer items-start gap-3 rounded-md border border-border p-3 hover:bg-muted/50"
                  >
                    <Checkbox
                      checked={selectedRoles.includes(role)}
                      onCheckedChange={() => toggleRole(role)}
                      className="mt-0.5"
                    />
                    <div className="flex-1">
                      <div className="text-sm font-medium">{ROLE_LABELS[role]}</div>
                      <div className="text-xs text-muted-foreground">
                        {ROLE_DESCRIPTIONS[role]}
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            )}

            {step === "details" && (
              <div className="space-y-5">
                {selectedRoles.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    Aucun rôle sélectionné — la personne sera créée sans profil
                    spécifique.
                  </p>
                )}

                {selectedRoles.includes("athlete") && (
                  <section className="space-y-3 rounded-md border border-border p-3">
                    <h3 className="text-sm font-semibold">🏃 Profil Athlète</h3>
                    <AthleteRoleFields
                      sports={sports}
                      federations={federations}
                      clubs={clubs}
                    />
                  </section>
                )}

                {selectedRoles.includes("coach") && (
                  <section className="space-y-3 rounded-md border border-border p-3">
                    <h3 className="text-sm font-semibold">🎯 Profil Encadrant</h3>
                    <CoachRoleFields
                      federations={federations}
                      clubs={clubs}
                    />
                  </section>
                )}

                {selectedRoles.includes("federation_member") && (
                  <section className="space-y-3 rounded-md border border-border p-3">
                    <h3 className="text-sm font-semibold">🏛️ Membre de fédération</h3>
                    <Controller
                      name="fedMember.federation_id"
                      control={control}
                      render={({ field: f }) => (
                        <div className="space-y-1.5">
                          <Label htmlFor={f.name}>Fédération *</Label>
                          <Select
                            value={f.value ?? ""}
                            onValueChange={f.onChange}
                          >
                            <SelectTrigger id={f.name}>
                              <SelectValue placeholder="—" />
                            </SelectTrigger>
                            <SelectContent>
                              {federations.map((fed) => (
                                <SelectItem key={fed.id} value={fed.id}>
                                  {fed.acronym ?? ""} — {fed.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                    />
                    <MemberRoleFields kind="fed" />
                  </section>
                )}

                {selectedRoles.includes("club_member") && (
                  <section className="space-y-3 rounded-md border border-border p-3">
                    <h3 className="text-sm font-semibold">🏟️ Membre de club</h3>
                    <Controller
                      name="clubMember.club_id"
                      control={control}
                      render={({ field: f }) => (
                        <div className="space-y-1.5">
                          <Label htmlFor={f.name}>Club *</Label>
                          <Select
                            value={f.value ?? ""}
                            onValueChange={f.onChange}
                          >
                            <SelectTrigger id={f.name}>
                              <SelectValue placeholder="—" />
                            </SelectTrigger>
                            <SelectContent>
                              {clubs.map((c) => (
                                <SelectItem key={c.id} value={c.id}>
                                  {c.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                    />
                    <MemberRoleFields kind="club" />
                  </section>
                )}
              </div>
            )}

            <DialogFooter className="mt-2 flex justify-between sm:justify-between">
              <div>
                {stepIndex > 0 && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setStep(STEPS[stepIndex - 1]!)}
                    disabled={saving}
                  >
                    <ChevronLeft className="mr-1 h-4 w-4" /> Précédent
                  </Button>
                )}
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => onOpenChange(false)}
                  disabled={saving}
                >
                  Annuler
                </Button>
                {step !== "details" ? (
                  <Button
                    type="button"
                    onClick={goNext}
                    disabled={!canNext()}
                  >
                    Suivant <ChevronRight className="ml-1 h-4 w-4" />
                  </Button>
                ) : (
                  <DialogFooterButtons
                    onCancel={() => onOpenChange(false)}
                    submitLabel="Créer la personne"
                    loading={saving}
                    loadingLabel="Création…"
                  />
                )}
              </div>
            </DialogFooter>
          </form>
        </FormProvider>
      </DialogContent>
    </Dialog>
  );
}
