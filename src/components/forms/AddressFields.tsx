import { useFormContext, Controller } from "react-hook-form";
import { AddressSearch } from "@/components/AddressSearch";
import { Input } from "@/components/ui/input";
import { FormFieldLayout } from "./FormFieldLayout";

type Props = {
  prefix?: string;
  disabled?: boolean;
};

export function AddressFields({ prefix = "", disabled }: Props) {
  const { control, setValue, watch } = useFormContext();
  const field = (name: string) => (prefix ? `${prefix}.${name}` : name);
  const streetPath = field("street");

  return (
    <div className="space-y-3">
      <Controller
        name={streetPath}
        control={control}
        render={({ field: f }) => (
          <FormFieldLayout label="Adresse (numéro + rue)" htmlFor={f.name}>
            <AddressSearch
              id={f.name}
              value={f.value ?? ""}
              onChange={f.onChange}
              onSelect={(r) => {
                setValue(streetPath, r.street || r.display_name, { shouldValidate: true });
                setValue(field("postcode"), r.postcode ?? "", { shouldValidate: true });
                setValue(field("city"), r.city ?? "", { shouldValidate: true });
                setValue(field("country"), r.country_code || r.country || "", { shouldValidate: true });
              }}
              placeholder="Rue, ville, pays…"
              disabled={disabled}
            />
          </FormFieldLayout>
        )}
      />

      <div className="grid grid-cols-3 gap-3">
        <Controller
          name={field("postcode")}
          control={control}
          render={({ field: f }) => (
            <FormFieldLayout label="Code postal" htmlFor={f.name}>
              <Input id={f.name} {...f} value={f.value ?? ""} disabled={disabled} />
            </FormFieldLayout>
          )}
        />
        <Controller
          name={field("city")}
          control={control}
          render={({ field: f }) => (
            <FormFieldLayout label="Ville" htmlFor={f.name}>
              <Input id={f.name} {...f} value={f.value ?? ""} disabled={disabled} />
            </FormFieldLayout>
          )}
        />
        <Controller
          name={field("country")}
          control={control}
          render={({ field: f }) => (
            <FormFieldLayout label="Pays" htmlFor={f.name}>
              <Input id={f.name} {...f} value={f.value ?? ""} placeholder="LU" disabled={disabled} />
            </FormFieldLayout>
          )}
        />
      </div>
    </div>
  );
}
