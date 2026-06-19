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
import { AddressFields } from "./AddressFields";

const GENDERS = [
  { value: "male", label: "Homme" },
  { value: "female", label: "Femme" },
  { value: "mixed", label: "Mixte" },
];

type Props = {
  requireBirthDate?: boolean;
  requireGender?: boolean;
  disabled?: boolean;
};

export function PersonBaseFields({ requireBirthDate, requireGender, disabled }: Props) {
  const { control } = useFormContext();

  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-2 gap-3">
        <Controller
          name="first_name"
          control={control}
          render={({ field: f }) => (
            <FormFieldLayout label="Prénom" htmlFor={f.name} required>
              <Input id={f.name} {...f} value={f.value ?? ""} disabled={disabled} />
            </FormFieldLayout>
          )}
        />
        <Controller
          name="last_name"
          control={control}
          render={({ field: f }) => (
            <FormFieldLayout label="Nom" htmlFor={f.name} required>
              <Input id={f.name} {...f} value={f.value ?? ""} disabled={disabled} />
            </FormFieldLayout>
          )}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Controller
          name="birth_date"
          control={control}
          render={({ field: f }) => (
            <FormFieldLayout
              label="Date de naissance"
              htmlFor={f.name}
              required={requireBirthDate}
            >
              <Input
                id={f.name}
                type="date"
                {...f}
                value={f.value ?? ""}
                disabled={disabled}
              />
            </FormFieldLayout>
          )}
        />
        <Controller
          name="gender"
          control={control}
          render={({ field: f }) => (
            <FormFieldLayout label="Genre" htmlFor={f.name} required={requireGender}>
              <Select value={f.value ?? ""} onValueChange={f.onChange} disabled={disabled}>
                <SelectTrigger id={f.name}>
                  <SelectValue placeholder="—" />
                </SelectTrigger>
                <SelectContent>
                  {GENDERS.map((g) => (
                    <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormFieldLayout>
          )}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Controller
          name="email"
          control={control}
          render={({ field: f }) => (
            <FormFieldLayout label="Email" htmlFor={f.name}>
              <Input id={f.name} type="email" {...f} value={f.value ?? ""} disabled={disabled} />
            </FormFieldLayout>
          )}
        />
        <Controller
          name="phone"
          control={control}
          render={({ field: f }) => (
            <FormFieldLayout label="Téléphone" htmlFor={f.name}>
              <Input id={f.name} {...f} value={f.value ?? ""} disabled={disabled} />
            </FormFieldLayout>
          )}
        />
      </div>

      <Controller
        name="nationality"
        control={control}
        render={({ field: f }) => (
          <FormFieldLayout label="Nationalité" htmlFor={f.name}>
            <Input id={f.name} {...f} value={f.value ?? ""} placeholder="LUX" disabled={disabled} />
          </FormFieldLayout>
        )}
      />

      <AddressFields disabled={disabled} />
    </div>
  );
}