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

type Props = {
  kind: "fed" | "club";
};

export function MemberRoleFields({ kind }: Props) {
  const { control } = useFormContext();
  const roles = kind === "fed" ? FED_ROLES : CLUB_ROLES;

  return (
    <div className="space-y-3">
      <Controller
        name="member.role"
        control={control}
        render={({ field: f }) => (
          <FormFieldLayout label="Fonction" htmlFor={f.name} required>
            <Select value={f.value ?? ""} onValueChange={f.onChange}>
              <SelectTrigger id={f.name}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {roles.map((r) => (
                  <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormFieldLayout>
        )}
        rules={{ required: "Fonction requise" }}
      />

      <div className="grid grid-cols-2 gap-3">
        <Controller
          name="member.start_date"
          control={control}
          render={({ field: f }) => (
            <FormFieldLayout label="Début de mandat" htmlFor={f.name}>
              <Input id={f.name} type="date" {...f} value={f.value ?? ""} />
            </FormFieldLayout>
          )}
        />
        <Controller
          name="member.end_date"
          control={control}
          render={({ field: f }) => (
            <FormFieldLayout label="Fin de mandat" htmlFor={f.name}>
              <Input id={f.name} type="date" {...f} value={f.value ?? ""} />
            </FormFieldLayout>
          )}
        />
      </div>
    </div>
  );
}
