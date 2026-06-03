// Types and helpers for the PERSONNE_PHYSIQUE superclass.

export const PERSON_ROLE_TYPES = [
  "athlete",
  "coach",
  "federation_member",
  "club_member",
  "official",
  "volunteer",
  "staff",
] as const;

export type PersonRoleType = (typeof PERSON_ROLE_TYPES)[number];

export const ROLE_LABELS: Record<PersonRoleType, string> = {
  athlete: "Athlète",
  coach: "Encadrant",
  federation_member: "Membre fédération",
  club_member: "Membre club",
  official: "Officiel",
  volunteer: "Bénévole",
  staff: "Staff",
};

// Tailwind classes for badges per role.
export const ROLE_BADGE_CLASSES: Record<PersonRoleType, string> = {
  athlete: "bg-red-100 text-red-700 border-red-200",
  coach: "bg-blue-100 text-blue-700 border-blue-200",
  federation_member: "bg-indigo-100 text-indigo-700 border-indigo-200",
  club_member: "bg-emerald-100 text-emerald-700 border-emerald-200",
  official: "bg-amber-100 text-amber-800 border-amber-200",
  volunteer: "bg-purple-100 text-purple-700 border-purple-200",
  staff: "bg-slate-200 text-slate-700 border-slate-300",
};

export type Person = {
  id: string;
  first_name: string;
  last_name: string;
  birth_date: string | null;
  gender: string | null;
  nationality: string | null;
  sport_nationality: string | null;
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
  current_club_id: string | null;
  status: string;
  level: string | null;
  size_clothing: string | null;
  size_shoes: string | null;
  size_gloves: string | null;
  license_number: string | null;
  ada_number: string | null;
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
  club_id: string | null;
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

export type ClubMemberProfile = {
  id: string;
  person_id: string;
  legacy_club_member_id: string | null;
  club_id: string;
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
