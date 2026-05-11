export type Federation = {
  id: string;
  acronym: string;
  name: string;
  president_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  international_federation: string | null;
  is_olympic: boolean | null;
  created_at: string;
};

export type Club = {
  id: string;
  name: string;
  federation_id: string;
  city: string | null;
  address: string | null;
  email: string | null;
  phone: string | null;
  created_at: string;
};

export type Coach = {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  role: string;
  federation_id: string | null;
  club_id: string | null;
  is_active: boolean | null;
  created_at: string;
};

export const COACH_ROLES = [
  { value: "coach", label: "Coach" },
  { value: "manager", label: "Manager" },
  { value: "medical", label: "Médical" },
  { value: "official", label: "Officiel" },
] as const;
