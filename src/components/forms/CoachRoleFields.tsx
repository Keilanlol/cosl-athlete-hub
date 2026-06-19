import { useFormContext, Controller } from "react-hook-form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FormFieldLayout } from "./FormFieldLayout";
import { COACH_ROLES } from "@/lib/types";

type Props = {
  federations: { id: string; name: string; acronym: string | null }[];
  clubs: { id: string; name: string; federation_id: string | null }[];
};

export function CoachRoleFields({ federations, clubs }: Props) {
  const { control, watch, setValue } = useFormContext();
  const fedId = watch("coach.federation_id");
  const filteredClubs = fedId
    ? clubs.filter((c) => c.federation_id === fedId)
    : clubs;

  return (
    <div className="space-y-3">
      <Controller
        name="coach.role"
        control={control}
        render={({ field: f }) => (
          <FormFieldLayout label="Fonction" htmlFor={f.name}>
            <Select value={f.value ?? ""} onValueChange={f.onChange}>
              <SelectTrigger id={f.name}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {COACH_ROLES.map((r) => (
                  <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormFieldLayout>
        )}
      />

      <div className="grid grid-cols-2 gap-3">
        <Controller
          name="coach.federation_id"
          control={control}
          render={({ field: f }) => (
            <FormFieldLayout label="Fédération" htmlFor={f.name}>
              <Select
                value={f.value ?? ""}
                onValueChange={(v) => {
                  f.onChange(v);
                  setValue("coach.club_id", "", { shouldValidate: true });
                }}
              >
                <SelectTrigger id={f.name}>
                  <SelectValue placeholder="—" />
                </SelectTrigger>
                <SelectContent>
                  {federations.map((f) => (
                    <SelectItem key={f.id} value={f.id}>
                      {f.acronym ?? f.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormFieldLayout>
          )}
        />
        <Controller
          name="coach.club_id"
          control={control}
          render={({ field: f }) => (
            <FormFieldLayout label="Club" htmlFor={f.name}>
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
      </div>
    </div>
  );
}