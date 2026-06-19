import { z } from "zod";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date invalide");
const uuidOrEmpty = z.string().uuid().or(z.literal(""));

export const personBaseSchema = z.object({
  first_name: z.string().trim().min(1, "Prénom requis").max(80),
  last_name: z.string().trim().min(1, "Nom requis").max(80),
  birth_date: isoDate.optional().or(z.literal("")),
  gender: z.enum(["male", "female", "mixed"]).optional().or(z.literal("")),
  nationality: z.string().trim().max(8).optional().or(z.literal("")),
  email: z.string().trim().email("Email invalide").optional().or(z.literal("")),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  street: z.string().trim().max(255).optional().or(z.literal("")),
  postcode: z.string().trim().max(20).optional().or(z.literal("")),
  city: z.string().trim().max(120).optional().or(z.literal("")),
  country: z.string().trim().max(80).optional().or(z.literal("")),
});

export type PersonBaseForm = z.infer<typeof personBaseSchema>;

export const addressSchema = z.object({
  street: z.string().trim().max(255).optional().or(z.literal("")),
  postcode: z.string().trim().max(20).optional().or(z.literal("")),
  city: z.string().trim().max(120).optional().or(z.literal("")),
  country: z.string().trim().max(80).optional().or(z.literal("")),
});

export type AddressForm = z.infer<typeof addressSchema>;

export const coachRoleSchema = z.object({
  role: z.string().min(1, "Rôle requis"),
  federation_id: uuidOrEmpty,
  club_id: uuidOrEmpty,
});

export type CoachRoleForm = z.infer<typeof coachRoleSchema>;

export const memberRoleSchema = z.object({
  role: z.string().min(1, "Fonction requise"),
  start_date: isoDate.optional().or(z.literal("")),
  end_date: isoDate.optional().or(z.literal("")),
});

export type MemberRoleForm = z.infer<typeof memberRoleSchema>;

export const memberSchema = z.object({
  first_name: z.string().trim().min(1, "Prénom requis").max(80),
  last_name: z.string().trim().min(1, "Nom requis").max(80),
  email: z.string().trim().email("Email invalide").optional().or(z.literal("")),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  role: z.string().min(1, "Fonction requise"),
  street: z.string().trim().max(255).optional().or(z.literal("")),
  postcode: z.string().trim().max(20).optional().or(z.literal("")),
  city: z.string().trim().max(120).optional().or(z.literal("")),
  country: z.string().trim().max(80).optional().or(z.literal("")),
  start_date: isoDate.optional().or(z.literal("")),
  end_date: isoDate.optional().or(z.literal("")),
  notes: z.string().trim().max(2000).optional().or(z.literal("")),
  is_active: z.boolean(),
});

export type MemberForm = z.infer<typeof memberSchema>;

export const organizationSchema = z.object({
  name: z.string().trim().min(1, "Nom requis").max(120),
  acronym: z.string().trim().max(20).optional().or(z.literal("")),
  contact_email: z.string().trim().email("Email invalide").optional().or(z.literal("")),
  contact_phone: z.string().trim().max(40).optional().or(z.literal("")),
  street: z.string().trim().max(255).optional().or(z.literal("")),
  postcode: z.string().trim().max(20).optional().or(z.literal("")),
  city: z.string().trim().max(120).optional().or(z.literal("")),
  country: z.string().trim().max(80).optional().or(z.literal("")),
});

export type OrganizationForm = z.infer<typeof organizationSchema>;

export const clubSchema = z
  .object({
    name: z.string().trim().min(1, "Nom requis").max(120),
    federation_id: z.string().uuid("Fédération requise"),
    email: z.string().trim().email("Email invalide").optional().or(z.literal("")),
    phone: z.string().trim().max(40).optional().or(z.literal("")),
  })
  .merge(addressSchema);

export type ClubForm = z.infer<typeof clubSchema>;

export const federationSchema = z.object({
  acronym: z.string().trim().min(1, "Acronyme requis").max(20),
  name: z.string().trim().min(1, "Nom requis").max(120),
  president_name: z.string().trim().max(120).optional().or(z.literal("")),
  contact_email: z.string().trim().email("Email invalide").optional().or(z.literal("")),
  contact_phone: z.string().trim().max(40).optional().or(z.literal("")),
  international_federation: z.string().trim().max(120).optional().or(z.literal("")),
  is_olympic: z.boolean().default(true),
});

export type FederationForm = z.infer<typeof federationSchema>;
