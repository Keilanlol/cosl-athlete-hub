import { useEffect, useMemo } from "react";
import { useForm, FormProvider, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { friendlyError } from "@/lib/error-messages";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PersonCombobox } from "@/components/PersonCombobox";
import { AddressFields } from "./AddressFields";
import { MemberRoleFields } from "./MemberRoleFields";
import { DialogFooterButtons } from "./DialogFooterButtons";
import { memberSchema } from "@/lib/form-schemas";
import { upsertPersonRole } from "@/lib/role-utils";
import { FEDERATION_MEMBER_ROLES, CLUB_MEMBER_ROLES } from "@/lib/types";

type PersonLite = {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  kind: "fed" | "club";
  orgId: string;
  orgName: string;
  editing?: {
    id: string;
    first_name: string;
    last_name: string;
    role: string;
    email: string | null;
    phone: string | null;
    street: string | null;
    postcode: string | null;
    city: string | null;
    country: string | null;
    start_date: string | null;
    end_date: string | null;
    notes: string | null;
    is_active: boolean | null;
  } | null;
  persons: PersonLite[];
  onSaved: () => void;
};

const schema = memberSchema.merge(
  z.object({
    personId: z.string().optional().or(z.literal("")),
  }),
);

type FormValues = z.infer<typeof schema>;

export function MemberFormDialog({
  open,
  onOpenChange,
  kind,
  orgId,
  orgName,
  editing,
  persons,
  onSaved,
}: Props) {
  const methods = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      first_name: "",
      last_name: "",
      email: "",
      phone: "",
      role: "president",
      street: "",
      postcode: "",
      city: "",
      country: "",
      start_date: "",
      end_date: "",
      notes: "",
      is_active: true,
    } as FormValues,
  });

  const {
    reset,
    handleSubmit,
    setValue,
    watch,
    formState: { isSubmitting },
  } = methods;

  const selectedPersonId = watch("personId") ?? "";

  useEffect(() => {
    if (!open) {
      reset();
      return;
    }
    if (editing) {
      reset({
        first_name: editing.first_name,
        last_name: editing.last_name,
        email: editing.email ?? "",
        phone: editing.phone ?? "",
        role: editing.role,
        street: editing.street ?? "",
        postcode: editing.postcode ?? "",
        city: editing.city ?? "",
        country: editing.country ?? "",
        start_date: editing.start_date ?? "",
        end_date: editing.end_date ?? "",
        notes: editing.notes ?? "",
        is_active: editing.is_active ?? true,
      });
    } else {
      reset({
        first_name: "",
        last_name: "",
        email: "",
        phone: "",
        role: "president",
        street: "",
        postcode: "",
        city: "",
        country: "",
        start_date: "",
        end_date: "",
        notes: "",
        is_active: true,
      });
    }
  }, [open, editing, reset]);

  const personOptions = useMemo(
    () =>
      persons.map((p) => ({
        id: p.id,
        label: `${p.first_name} ${p.last_name}${p.email ? ` — ${p.email}` : ""}`,
      })),
    [persons],
  );

  const applyPerson = (personId: string) => {
    const p = persons.find((x) => x.id === personId);
    if (!p) return;
    setValue("first_name", p.first_name, { shouldValidate: true });
    setValue("last_name", p.last_name, { shouldValidate: true });
    setValue("email", p.email ?? "", { shouldValidate: true });
    setValue("phone", p.phone ?? "", { shouldValidate: true });
  };

  const roleOptions =
    kind === "fed" ? FEDERATION_MEMBER_ROLES : CLUB_MEMBER_ROLES;

  const onSubmit = async (values: FormValues) => {
    const payload = {
      first_name: values.first_name.trim(),
      last_name: values.last_name.trim(),
      role: values.role,
      email: (values.email ?? "").trim() || null,
      phone: (values.phone ?? "").trim() || null,
      street: (values.street ?? "").trim() || null,
      postcode: (values.postcode ?? "").trim() || null,
      city: (values.city ?? "").trim() || null,
      country: (values.country ?? "").trim() || null,
      address:
        [values.street, values.postcode, values.city, values.country]
          .filter(Boolean)
          .join(", ") || null,
      start_date: values.start_date || null,
      end_date: values.end_date || null,
      notes: (values.notes ?? "").trim() || null,
      is_active: values.is_active,
    };

    try {
      let memberId: string | undefined;
      if (editing) {
        const { error } =
          kind === "fed"
            ? await supabase
                .from("federation_members")
                .update(payload)
                .eq("id", editing.id)
            : await supabase
                .from("club_members")
                .update(payload)
                .eq("id", editing.id);
        if (error) throw error;
        memberId = editing.id;
      } else {
        const insertPayload = selectedPersonId
          ? { ...payload, person_id: selectedPersonId }
          : payload;
        const { data, error } =
          kind === "fed"
            ? await supabase
                .from("federation_members")
                .insert({ ...insertPayload, federation_id: orgId })
                .select("id")
                .single()
            : await supabase
                .from("club_members")
                .insert({ ...insertPayload, club_id: orgId })
                .select("id")
                .single();
        if (error) throw error;
        memberId = data?.id as string | undefined;
      }

      if (!editing && selectedPersonId && memberId) {
        if (kind === "fed") {
          await supabase.from("federation_member_profiles").insert({
            person_id: selectedPersonId,
            legacy_federation_member_id: memberId,
            federation_id: orgId,
            role: values.role,
            start_date: values.start_date || null,
            is_active: values.is_active,
          });
          await upsertPersonRole(selectedPersonId, "federation_member");
        } else {
          await supabase.from("club_member_profiles").insert({
            person_id: selectedPersonId,
            legacy_club_member_id: memberId,
            club_id: orgId,
            role: values.role,
            start_date: values.start_date || null,
            is_active: values.is_active,
          });
          await upsertPersonRole(selectedPersonId, "club_member");
        }
      }

      toast.success(editing ? "Membre modifié" : "Membre ajouté");
      onOpenChange(false);
      onSaved();
    } catch (err) {
      toast.error("Échec", { description: friendlyError(err as never) });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {editing ? "Modifier le membre" : "Ajouter un membre"} — {orgName}
          </DialogTitle>
        </DialogHeader>

        <FormProvider {...methods}>
          <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4 py-4">
            {!editing && (
              <div className="space-y-1.5 rounded-md border border-dashed border-border bg-muted/40 p-3">
                <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                  Lier à une personne existante (optionnel)
                </Label>
                <PersonCombobox
                  value={selectedPersonId ?? ""}
                  onChange={(v) => {
                    setValue("personId", v, { shouldValidate: true });
                    applyPerson(v);
                  }}
                  options={personOptions}
                  placeholder="Aucune (créer sans personne liée)"
                  searchPlaceholder="Rechercher une personne…"
                />
                {selectedPersonId && (
                  <button
                    type="button"
                    onClick={() => {
                      setValue("personId", "", { shouldValidate: true });
                    }}
                    className="text-xs text-muted-foreground hover:text-foreground underline"
                  >
                    Détacher
                  </button>
                )}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <Controller
                name="first_name"
                control={methods.control}
                render={({ field: f }) => (
                  <div className="space-y-1.5">
                    <Label htmlFor={f.name}>Prénom *</Label>
                    <Input id={f.name} {...f} value={f.value ?? ""} />
                  </div>
                )}
              />
              <Controller
                name="last_name"
                control={methods.control}
                render={({ field: f }) => (
                  <div className="space-y-1.5">
                    <Label htmlFor={f.name}>Nom *</Label>
                    <Input id={f.name} {...f} value={f.value ?? ""} />
                  </div>
                )}
              />
            </div>

            <MemberRoleFields kind={kind} />

            <div className="grid grid-cols-2 gap-3">
              <Controller
                name="email"
                control={methods.control}
                render={({ field: f }) => (
                  <div className="space-y-1.5">
                    <Label htmlFor={f.name}>Email</Label>
                    <Input id={f.name} type="email" {...f} value={f.value ?? ""} />
                  </div>
                )}
              />
              <Controller
                name="phone"
                control={methods.control}
                render={({ field: f }) => (
                  <div className="space-y-1.5">
                    <Label htmlFor={f.name}>Téléphone</Label>
                    <Input id={f.name} {...f} value={f.value ?? ""} />
                  </div>
                )}
              />
            </div>

            <AddressFields />

            <div className="grid grid-cols-2 gap-3">
              <Controller
                name="start_date"
                control={methods.control}
                render={({ field: f }) => (
                  <div className="space-y-1.5">
                    <Label htmlFor={f.name}>Début de mandat</Label>
                    <Input id={f.name} type="date" {...f} value={f.value ?? ""} />
                  </div>
                )}
              />
              <Controller
                name="end_date"
                control={methods.control}
                render={({ field: f }) => (
                  <div className="space-y-1.5">
                    <Label htmlFor={f.name}>Fin de mandat</Label>
                    <Input id={f.name} type="date" {...f} value={f.value ?? ""} />
                  </div>
                )}
              />
            </div>

            <Controller
              name="notes"
              control={methods.control}
              render={({ field: f }) => (
                <div className="space-y-1.5">
                  <Label htmlFor={f.name}>Notes</Label>
                  <Textarea id={f.name} rows={2} {...f} value={f.value ?? ""} />
                </div>
              )}
            />

            <Controller
              name="is_active"
              control={methods.control}
              render={({ field: f }) => (
                <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
                  <Label htmlFor={f.name} className="cursor-pointer">
                    Membre actif
                  </Label>
                  <Switch
                    id={f.name}
                    checked={f.value}
                    onCheckedChange={f.onChange}
                  />
                </div>
              )}
            />

            <DialogFooterButtons
              onCancel={() => onOpenChange(false)}
              submitLabel={editing ? "Enregistrer" : "Ajouter"}
              loading={isSubmitting}
            />
          </form>
        </FormProvider>
      </DialogContent>
    </Dialog>
  );
}
