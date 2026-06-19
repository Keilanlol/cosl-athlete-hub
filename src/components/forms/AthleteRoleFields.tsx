import { useFormContext, Controller } from "react-hook-form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FormFieldLayout } from "./FormFieldLayout";
import { EditableSelect } from "@/components/EditableSelect";
import { useSports, useAthleteLevels } from "@/hooks/useReferenceData";
import { ATHLETE_STATUSES, type Gender } from "@/lib/types";

const STATUS_LABELS: Record<string, string> = {
  active: "Actif",
  injured: "Blessé",
  suspended: "Suspendu",
  retired: "Retraité",
  ambassador: "Ambassadeur",
};

const GENDER_LABELS: Record<Gender | string, string> = {
  male: "Masculin",
  female: "Féminin",
  mixed: "Mixte",
};

type Props = {
  sports: { id: string; name: string }[];
  federations: { id: string; name: string; acronym: string | null }[];
  clubs: { id: string; name: string; federation_id: string | null }[];
};

export function AthleteRoleFields({ sports, federations, clubs }: Props) {
  const { control, watch, setValue } = useFormContext();
  const fedId = watch("athlete.primary_federation_id");
  const filteredClubs = fedId
    ? clubs.filter((c) => c.federation_id === fedId)
    : clubs;

  const { items: levels, add: addLevel, remove: removeLevel } = useAthleteLevels();

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Controller
          name="athlete.primary_sport_id"
          control={control}
          render={({ field: f }) => (
            <FormFieldLayout label="Sport principal" htmlFor={f.name}>
              <Select value={f.value ?? ""} onValueChange={f.onChange}>
                <SelectTrigger id={f.name}>
                  <SelectValue placeholder="—" />
                </SelectTrigger>
                <SelectContent>
                  {sports.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormFieldLayout>
          )}
        />
        <Controller
          name="athlete.primary_federation_id"
          control={control}
          render={({ field: f }) => (
            <FormFieldLayout label="Fédération" htmlFor={f.name}>
              <Select
                value={f.value ?? ""}
                onValueChange={(v) => {
                  f.onChange(v);
                  setValue("athlete.current_club_id", "", { shouldValidate: true });
                }}
              >
                <SelectTrigger id={f.name}>
                  <SelectValue placeholder="—" />
                </SelectTrigger>
                <SelectContent>
                  {federations.map((f) => (
                    <SelectItem key={f.id} value={f.id}>
                      {f.acronym ? `${f.acronym} — ${f.name}` : f.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormFieldLayout>
          )}
        />
      </div>

      <Controller
        name="athlete.current_club_id"
        control={control}
        render={({ field: f }) => (
          <FormFieldLayout label="Club actuel" htmlFor={f.name}>
            <Select value={f.value ?? ""} onValueChange={f.onChange}>
              <SelectTrigger id={f.name}>
                <SelectValue placeholder="—" />
              </SelectTrigger>
              <SelectContent>
                {filteredClubs.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormFieldLayout>
        )}
      />

      <div className="grid grid-cols-2 gap-3">
        <Controller
          name="athlete.status"
          control={control}
          render={({ field: f }) => (
            <FormFieldLayout label="Statut" htmlFor={f.name}>
              <Select value={f.value ?? "active"} onValueChange={f.onChange}>
                <SelectTrigger id={f.name}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ATHLETE_STATUSES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormFieldLayout>
          )}
        />
        <Controller
          name="athlete.level"
          control={control}
          render={({ field: f }) => (
            <FormFieldLayout label="Niveau" htmlFor={f.name}>
              <EditableSelect
                value={f.value ?? ""}
                onValueChange={f.onChange}
                options={levels.map((l) => ({ value: l.code, label: l.label }))}
                emptyLabel="—"
                onAdd={addLevel}
                onDelete={removeLevel}
                addLabel="+ Ajouter un niveau…"
                manageTitle="Gérer les niveaux"
              />
            </FormFieldLayout>
          )}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Controller
          name="athlete.license_number"
          control={control}
          render={({ field: f }) => (
            <FormFieldLayout label="N° licence" htmlFor={f.name}>
              <Input id={f.name} {...f} value={f.value ?? ""} />
            </FormFieldLayout>
          )}
        />
        <Controller
          name="athlete.passport_number"
          control={control}
          render={({ field: f }) => (
            <FormFieldLayout label="Passeport n°" htmlFor={f.name}>
              <Input id={f.name} {...f} value={f.value ?? ""} />
            </FormFieldLayout>
          )}
        />
      </div>

      <Controller
        name="athlete.passport_expiry"
        control={control}
        render={({ field: f }) => (
          <FormFieldLayout label="Expiration passeport" htmlFor={f.name}>
            <Input id={f.name} type="date" {...f} value={f.value ?? ""} />
          </FormFieldLayout>
        )}
      />
    </div>
  );
}
