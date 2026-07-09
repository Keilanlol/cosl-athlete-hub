// Types and helpers for the PERSONNE_PHYSIQUE superclass.

import { supabase } from "@/lib/supabase";

export const PERSON_ROLE_TYPES = [
  "athlete",
  "coach",
  "federation_member",
  "official",
  "volunteer",
  "staff",
] as const;

export type PersonRoleType = (typeof PERSON_ROLE_TYPES)[number];

export const ROLE_LABELS: Record<PersonRoleType, string> = {
  athlete: "Athlète",
  coach: "Encadrant",
  federation_member: "Membre fédération",
  official: "Officiel",
  volunteer: "Bénévole",
  staff: "Staff",
};

// Tailwind classes for badges per role.
export const ROLE_BADGE_CLASSES: Record<PersonRoleType, string> = {
  athlete: "bg-red-100 text-red-700 border-red-200",
  coach: "bg-blue-100 text-blue-700 border-blue-200",
  federation_member: "bg-indigo-100 text-indigo-700 border-indigo-200",
  official: "bg-amber-100 text-amber-800 border-amber-200",
  volunteer: "bg-purple-100 text-purple-700 border-purple-200",
  staff: "bg-slate-200 text-slate-700 border-slate-300",
};

// Alias sémantique
export const ROLE_COLORS = ROLE_BADGE_CLASSES;

export type Person = {
  id: string;
  first_name: string;
  last_name: string;
  birth_date: string | null;
  gender: string | null;
  nationality: string | null;
  email: string | null;
  phone: string | null;
  street: string | null;
  postcode: string | null;
  city: string | null;
  country: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  photo_url: string | null;
  photo_storage_path: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type PersonRole = {
  id: string;
  person_id: string;
  role_type: PersonRoleType;
  is_active: boolean;
  created_at: string;
};

export type AthleteProfile = {
  person_id: string;
  legacy_athlete_id: string | null;
  cosl_id: string | null;
  primary_sport_id: string | null;
  primary_federation_id: string | null;
  status: string;
  level: string | null;
  size_clothing: string | null;
  size_shoes: string | null;
  size_gloves: string | null;
  license_number: string | null;
  passport_number: string | null;
  passport_expiry: string | null;
  birth_place: string | null;
};

export type CoachProfile = {
  id: string;
  person_id: string;
  legacy_coach_id: string | null;
  role: string;
  federation_id: string | null;
  is_active: boolean;
};

export type FederationMemberProfile = {
  id: string;
  person_id: string;
  legacy_federation_member_id: string | null;
  federation_id: string;
  role: string;
  start_date: string | null;
  end_date: string | null;
  is_active: boolean;
  notes: string | null;
};

// Row of v_persons_with_roles view.
export type PersonListItem = Person & {
  roles: PersonRoleType[] | null;
  legacy_athlete_id: string | null;
  cosl_id: string | null;
};

export const personFullName = (p: Pick<Person, "first_name" | "last_name">) =>
  `${p.first_name} ${p.last_name}`.trim();

// ============================================================
// Shared form types & defaults (used by Create, Edit, AddRole)
// ============================================================

export type PersonGeneralFields = {
  first_name: string;
  last_name: string;
  birth_date: string;
  gender: string;
  nationality: string;
  email: string;
  phone: string;
  street: string;
  postcode: string;
  city: string;
  country: string;
};

export type AthleteProfileFields = {
  primary_sport_id: string;
  primary_federation_id: string;
  status: string;
  level: string;
  license_number: string;
  passport_number: string;
  passport_expiry: string;
};

export type CoachProfileFields = {
  role: string;
  federation_id: string;
};

export type FedMemberProfileFields = {
  federation_id: string;
  role: string;
  start_date: string;
  notes: string;
};

export const defaultPersonGeneral: PersonGeneralFields = {
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
};

export const defaultAthleteProfile: AthleteProfileFields = {
  primary_sport_id: "",
  primary_federation_id: "",
  status: "active",
  level: "",
  license_number: "",
  passport_number: "",
  passport_expiry: "",
};

export const defaultCoachProfile: CoachProfileFields = {
  role: "coach",
  federation_id: "",
};

export const defaultFedMemberProfile: FedMemberProfileFields = {
  federation_id: "",
  role: "president",
  start_date: "",
  notes: "",
};

/**
 * Fetches the next sequential COSL ID from the database.
 * Shared by PersonCreateDialog and AddRoleDialog.
 */
export async function fetchNextCoslId(): Promise<string> {
  const year = new Date().getFullYear();
  const { data } = await supabase
    .from("athletes")
    .select("cosl_id")
    .ilike("cosl_id", `COSL-${year}-%`)
    .order("cosl_id", { ascending: false })
    .limit(1);
  const last = data?.[0]?.cosl_id as string | undefined;
  const seq = last ? parseInt(last.split("-")[2] ?? "0", 10) + 1 : 1;
  return `COSL-${year}-${String(seq).padStart(4, "0")}`;
}
