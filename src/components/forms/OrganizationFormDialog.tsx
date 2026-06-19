import { useEffect } from "react";
import { useForm, FormProvider, Controller, useFormContext } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AddressFields } from "./AddressFields";
import { DialogFooterButtons } from "./DialogFooterButtons";
import { federationSchema, clubSchema, type FederationForm, type ClubForm } from "@/lib/form-schemas";

type FederationProps = {
  type: "federation";
  editing?: {
    id?: string;
    acronym: string;
    name: string;
    president_name: string | null;
    contact_email: string | null;
    contact_phone: string | null;
    international_federation: string | null;
    is_olympic: boolean | null;
  } | null;
};

type ClubProps = {
  type: "club";
  editing?: {
    id?: string;
    name: string;
    federation_id: string;
    email: string | null;
    phone: string | null;
    street: string | null;
    postcode: string | null;
    city: string | null;
    country: string | null;
  } | null;
  federations: { id: string; name: string; acronym: string | null }[];
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: Record<string, unknown>) => Promise<void>;
  loading?: boolean;
} & (FederationProps | ClubProps);

export function OrganizationFormDialog({
  open,
  onOpenChange,
  onSubmit,
  loading,
  ...rest
}: Props) {
  const isFed = rest.type === "federation";
  const schema = isFed ? federationSchema : clubSchema;
  type FormValues = z.infer<typeof schema>;

  const methods = useForm<FormValues>({
    resolver: zodResolver(schema as never),
    defaultValues: isFed
      ? {
          acronym: "",
          name: "",
          president_name: "",
          contact_email: "",
          contact_phone: "",
          international_federation: "",
          is_olympic: true,
        }
      : {
          name: "",
          federation_id: "",
          email: "",
          phone: "",
          street: "",
          postcode: "",
          city: "",
          country: "",
        },
  });

  const { reset, handleSubmit, setValue, watch } = methods;

  useEffect(() => {
    if (!open) {
      reset();
      return;
    }
    if (rest.editing) {
      reset(rest.editing as FormValues);
    } else {
      reset(
        isFed
          ? {
              acronym: "",
              name: "",
              president_name: "",
              contact_email: "",
              contact_phone: "",
              international_federation: "",
              is_olympic: true,
            }
          : {
              name: "",
              federation_id: "",
              email: "",
              phone: "",
              street: "",
              postcode: "",
              city: "",
              country: "",
            },
      );
    }
  }, [open, rest.editing, reset, isFed]);

  const submit = async (values: FormValues) => {
    await onSubmit(values as unknown as Record<string, unknown>);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {rest.editing
              ? isFed
                ? "Modifier la fédération"
                : "Modifier le club"
              : isFed
                ? "Ajouter une fédération"
                : "Ajouter un club"}
          </DialogTitle>
        </DialogHeader>

        <FormProvider {...methods}>
          <form onSubmit={handleSubmit(submit)} className="grid gap-4 py-4">
            {isFed ? (
              <FederationFields />
            ) : (
              <ClubFields federations={(rest as ClubProps).federations} />
            )}
            <DialogFooterButtons
              onCancel={() => onOpenChange(false)}
              submitLabel={rest.editing ? "Enregistrer" : "Ajouter"}
              loading={loading}
            />
          </form>
        </FormProvider>
      </DialogContent>
    </Dialog>
  );
}

function FederationFields() {
  const { control } = useFormContext<FederationForm>();
  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <Controller
          name="acronym"
          control={control}
          render={({ field: f }) => (
            <div className="space-y-1.5">
              <Label htmlFor={f.name}>Acronyme *</Label>
              <Input id={f.name} {...f} value={f.value ?? ""} />
            </div>
          )}
        />
        <Controller
          name="name"
          control={control}
          render={({ field: f }) => (
            <div className="space-y-1.5">
              <Label htmlFor={f.name}>Nom *</Label>
              <Input id={f.name} {...f} value={f.value ?? ""} />
            </div>
          )}
        />
      </div>

      <Controller
        name="president_name"
        control={control}
        render={({ field: f }) => (
          <div className="space-y-1.5">
            <Label htmlFor={f.name}>Président</Label>
            <Input id={f.name} {...f} value={f.value ?? ""} />
          </div>
        )}
      />

      <div className="grid grid-cols-2 gap-3">
        <Controller
          name="contact_email"
          control={control}
          render={({ field: f }) => (
            <div className="space-y-1.5">
              <Label htmlFor={f.name}>Email</Label>
              <Input id={f.name} type="email" {...f} value={f.value ?? ""} />
            </div>
          )}
        />
        <Controller
          name="contact_phone"
          control={control}
          render={({ field: f }) => (
            <div className="space-y-1.5">
              <Label htmlFor={f.name}>Téléphone</Label>
              <Input id={f.name} {...f} value={f.value ?? ""} />
            </div>
          )}
        />
      </div>

      <Controller
        name="international_federation"
        control={control}
        render={({ field: f }) => (
          <div className="space-y-1.5">
            <Label htmlFor={f.name}>Fédération internationale</Label>
            <Input id={f.name} {...f} value={f.value ?? ""} />
          </div>
        )}
      />

      <Controller
        name="is_olympic"
        control={control}
        render={({ field: f }) => (
          <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
            <Label htmlFor={f.name} className="cursor-pointer">
              Fédération olympique
            </Label>
            <Switch id={f.name} checked={f.value} onCheckedChange={f.onChange} />
          </div>
        )}
      />
    </>
  );
}

function ClubFields({
  federations,
}: {
  federations: { id: string; name: string; acronym: string | null }[];
}) {
  const { control } = useFormContext<ClubForm>();
  return (
    <>
      <Controller
        name="name"
        control={control}
        render={({ field: f }) => (
          <div className="space-y-1.5">
            <Label htmlFor={f.name}>Nom *</Label>
            <Input id={f.name} {...f} value={f.value ?? ""} />
          </div>
        )}
      />

      <Controller
        name="federation_id"
        control={control}
        render={({ field: f }) => (
          <div className="space-y-1.5">
            <Label htmlFor={f.name}>Fédération *</Label>
            <Select value={f.value ?? ""} onValueChange={f.onChange}>
              <SelectTrigger id={f.name}>
                <SelectValue placeholder="Sélectionner…" />
              </SelectTrigger>
              <SelectContent>
                {federations.map((fed) => (
                  <SelectItem key={fed.id} value={fed.id}>
                    {fed.acronym ? `${fed.acronym} — ${fed.name}` : fed.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      />

      <AddressFields />

      <div className="grid grid-cols-2 gap-3">
        <Controller
          name="phone"
          control={control}
          render={({ field: f }) => (
            <div className="space-y-1.5">
              <Label htmlFor={f.name}>Téléphone</Label>
              <Input id={f.name} {...f} value={f.value ?? ""} />
            </div>
          )}
        />
        <Controller
          name="email"
          control={control}
          render={({ field: f }) => (
            <div className="space-y-1.5">
              <Label htmlFor={f.name}>Email</Label>
              <Input id={f.name} type="email" {...f} value={f.value ?? ""} />
            </div>
          )}
        />
      </div>
    </>
  );
}
