import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { friendlyError } from "@/lib/error-messages";
import { useForm, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ROLE_LABELS, type PersonRoleType } from "@/lib/persons";
import {
  Button,
} from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  createAthleteFromPerson,
  createCoachFromPerson,
  createFederationMemberFromPerson,
  createClubMemberFromPerson,
} from "@/lib/dual-write";
import { AthleteRoleFields } from "@/components/forms/AthleteRoleFields";
import { CoachRoleFields } from "@/components/forms/CoachRoleFields";
import { MemberRoleFields } from "@/components/forms/MemberRoleFields";
import { DialogFooterButtons } from "@/components/forms/DialogFooterButtons";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type PersonLite = {
  first_name: string;
  last_name: string;
  birth_date: string | null;
  gender: string | null;
  nationality: string | null;
  email: string | null;
  phone: string | null;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  personId: string;
  person: PersonLite;
  role: PersonRoleType;
  onAdded: () => void;
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

const schema = z.object({
  athlete: athleteSchemaPartial,
  coach: coachSchemaPartial,
  fedMember: fedMemberSchemaPartial,
  clubMember: clubMemberSchemaPartial,
});

type FormValues = z.infer<typeof schema>;

export function AddRoleDialog({
  open,
  onOpenChange,
  personId,
  person,
  role,
  onAdded,
}: Props) {
  const [sports, setSports] = useState<{ id: string; name: string }[]>([]);
  const [federations, setFederations] = useState<
    { id: string; name: string; acronym: string | null }[]
  >([]);
  const [clubs, setClubs] = useState<
    { id: string; name: string; federation_id: string | null }[]
  >([]);
  const [saving, setSaving] = useState(false);

  const methods = useForm<FormValues>({
    resolver: zodResolver(schema) as never,
    defaultValues: {
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

  const { handleSubmit, reset } = methods;

  useEffect(() => {
    if (!open) {
      reset();
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
  }, [open, reset]);

  const athleteBlocked = role === "athlete" && (!person.birth_date || !person.gender);

  const onSubmit = async (values: FormValues) => {
    if (saving) return;
    setSaving(true);
    try {
      if (role === "athlete") {
        if (!person.birth_date || !person.gender) {
          throw new Error(
            "Renseigner d'abord la date de naissance et le genre sur la fiche personne",
          );
        }
        await createAthleteFromPerson(
          personId,
          {
            first_name: person.first_name,
            last_name: person.last_name,
            birth_date: person.birth_date,
            gender: person.gender,
            nationality: person.nationality ?? "LUX",
            email: person.email ?? null,
            phone: person.phone ?? null,
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
      } else if (role === "coach") {
        await createCoachFromPerson(
          personId,
          {
            first_name: person.first_name,
            last_name: person.last_name,
            email: person.email ?? null,
            phone: person.phone ?? null,
          },
          {
            role: values.coach?.role ?? "coach",
            federation_id: values.coach?.federation_id,
            club_id: values.coach?.club_id,
          },
        );
      } else if (role === "federation_member") {
        if (!values.fedMember?.federation_id) throw new Error("Fédération requise");
        await createFederationMemberFromPerson(
          personId,
          {
            first_name: person.first_name,
            last_name: person.last_name,
            email: person.email ?? null,
            phone: person.phone ?? null,
          },
          {
            federation_id: values.fedMember.federation_id,
            role: values.fedMember.role,
            start_date: values.fedMember.start_date || null,
          },
        );
      } else if (role === "club_member") {
        if (!values.clubMember?.club_id) throw new Error("Club requis");
        await createClubMemberFromPerson(
          personId,
          {
            first_name: person.first_name,
            last_name: person.last_name,
            email: person.email ?? null,
            phone: person.phone ?? null,
          },
          {
            club_id: values.clubMember.club_id,
            role: values.clubMember.role,
            start_date: values.clubMember.start_date || null,
          },
        );
      } else {
        await supabase
          .from("person_roles")
          .insert({ person_id: personId, role_type: role });
      }

      toast.success("Rôle ajouté");
      onAdded();
      onOpenChange(false);
    } catch (err) {
      toast.error("Échec de l'ajout", { description: friendlyError(err as never) });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>
            Ajouter le rôle « {ROLE_LABELS[role]} » — {person.first_name}{" "}
            {person.last_name}
          </DialogTitle>
        </DialogHeader>

        <FormProvider {...methods}>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-2">
            {role === "athlete" && athleteBlocked && (
              <p className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                Renseignez d'abord la date de naissance et le genre sur la fiche
                personne (champs requis pour créer un athlète).
              </p>
            )}

            {role === "athlete" && !athleteBlocked && (
              <section className="space-y-3">
                <AthleteRoleFields
                  sports={sports}
                  federations={federations}
                  clubs={clubs}
                />
              </section>
            )}

            {role === "coach" && (
              <section className="space-y-3">
                <CoachRoleFields federations={federations} clubs={clubs} />
              </section>
            )}

            {role === "federation_member" && (
              <section className="space-y-3">
                <div className="space-y-1.5">
                  <Label>Fédération *</Label>
                  <Select
                    value={methods.watch("fedMember.federation_id") ?? ""}
                    onValueChange={(v) =>
                      methods.setValue("fedMember.federation_id", v, { shouldValidate: true })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="—" />
                    </SelectTrigger>
                    <SelectContent>
                      {federations.map((f) => (
                        <SelectItem key={f.id} value={f.id}>
                          {f.acronym ?? ""} — {f.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <MemberRoleFields kind="fed" />
              </section>
            )}

            {role === "club_member" && (
              <section className="space-y-3">
                <div className="space-y-1.5">
                  <Label>Club *</Label>
                  <Select
                    value={methods.watch("clubMember.club_id") ?? ""}
                    onValueChange={(v) =>
                      methods.setValue("clubMember.club_id", v, { shouldValidate: true })
                    }
                  >
                    <SelectTrigger>
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
                <MemberRoleFields kind="club" />
              </section>
            )}

            {(role === "official" || role === "volunteer" || role === "staff") && (
              <p className="text-sm text-muted-foreground">
                Aucune information supplémentaire requise pour ce rôle.
              </p>
            )}

            <DialogFooterButtons
              onCancel={() => onOpenChange(false)}
              submitLabel="Ajouter le rôle"
              loading={saving}
              loadingLabel="Ajout…"
            />
          </form>
        </FormProvider>
      </DialogContent>
    </Dialog>
  );
}
