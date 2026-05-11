import { z } from "zod";

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

export type Sport = {
  id: string;
  name: string;
  is_olympic: boolean | null;
  is_summer: boolean | null;
};

export type AthleteStatus =
  | "active"
  | "injured"
  | "suspended"
  | "retired"
  | "ambassador";

export type AthleteLevel = "elite" | "promotion" | "espoir" | "olympic_contract";

export type Gender = "male" | "female" | "mixed";

export type KycStatusValue = "green" | "orange" | "red";

export const ATHLETE_STATUSES: { value: AthleteStatus; label: string; cls: string }[] = [
  { value: "active", label: "Actif", cls: "bg-emerald-100 text-emerald-700" },
  { value: "injured", label: "Blessé", cls: "bg-amber-100 text-amber-700" },
  { value: "suspended", label: "Suspendu", cls: "bg-red-100 text-red-700" },
  { value: "retired", label: "Retraité", cls: "bg-slate-200 text-slate-700" },
  { value: "ambassador", label: "Ambassadeur", cls: "bg-indigo-100 text-indigo-700" },
];

export const ATHLETE_LEVELS: { value: AthleteLevel; label: string }[] = [
  { value: "elite", label: "Élite" },
  { value: "promotion", label: "Promotion" },
  { value: "espoir", label: "Espoir" },
  { value: "olympic_contract", label: "Contrat olympique" },
];

export const GENDERS: { value: Gender; label: string }[] = [
  { value: "male", label: "Masculin" },
  { value: "female", label: "Féminin" },
  { value: "mixed", label: "Mixte" },
];

export const DOCUMENT_CATEGORIES = [
  { value: "admin", label: "Administratif" },
  { value: "medical", label: "Médical" },
  { value: "sportive", label: "Sportif" },
  { value: "contractual", label: "Contractuel" },
] as const;

export const DOCUMENT_STATUSES: { value: string; label: string; cls: string }[] = [
  { value: "missing", label: "Manquant", cls: "bg-slate-200 text-slate-700" },
  { value: "pending", label: "En attente", cls: "bg-amber-100 text-amber-700" },
  { value: "valid", label: "Valide", cls: "bg-emerald-100 text-emerald-700" },
  { value: "expired", label: "Expiré", cls: "bg-red-100 text-red-700" },
  { value: "rejected", label: "Rejeté", cls: "bg-red-100 text-red-700" },
];

export type Athlete = {
  id: string;
  cosl_id: string;
  first_name: string;
  last_name: string;
  birth_date: string;
  birth_place: string | null;
  gender: Gender;
  nationality: string;
  sport_nationality: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  photo_url: string | null;
  primary_sport_id: string | null;
  primary_federation_id: string | null;
  current_club_id: string | null;
  status: AthleteStatus;
  level: AthleteLevel | null;
  size_clothing: string | null;
  size_shoes: string | null;
  size_gloves: string | null;
  license_number: string | null;
  ada_number: string | null;
  passport_number: string | null;
  passport_expiry: string | null;
  is_active: boolean | null;
  created_at: string;
  updated_at: string;
};

export type AthleteDocument = {
  id: string;
  athlete_id: string;
  category: string;
  doc_type: string;
  file_name: string;
  file_url: string | null;
  issued_date: string | null;
  expiry_date: string | null;
  status: string;
  created_at: string;
};

export type AthleteKyc = {
  id: string;
  athlete_id: string;
  identity_verified: boolean | null;
  nationality_verified: boolean | null;
  age_eligibility_ok: boolean | null;
  antidoping_status: KycStatusValue | null;
  ethics_charter_signed_at: string | null;
  rule40_signed_at: string | null;
  global_status: KycStatusValue | null;
  last_check_at: string | null;
  notes: string | null;
};

export type AthleteRelation = {
  id: string;
  athlete_id: string;
  coach_id: string;
  relation_role: string;
  start_date: string;
  end_date: string | null;
  coach?: Coach | null;
};

export type Selection = {
  id: string;
  game_id: string;
  athlete_id: string;
  sport_id: string;
  discipline_id: string | null;
  status: string;
  decided_at: string | null;
  comment: string | null;
  created_at: string;
  game?: { id: string; name: string; edition_year: number } | null;
};

// Zod
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date invalide");

export const athleteSchema = z.object({
  cosl_id: z
    .string()
    .trim()
    .regex(/^COSL-\d{4}-\d{4}$/, "Format attendu : COSL-YYYY-NNNN")
    .or(z.literal("")),
  first_name: z.string().trim().min(1, "Prénom requis").max(80),
  last_name: z.string().trim().min(1, "Nom requis").max(80),
  birth_date: isoDate.refine(
    (d) => new Date(d) < new Date(),
    "La date de naissance doit être dans le passé",
  ),
  birth_place: z.string().trim().max(120).optional().or(z.literal("")),
  gender: z.enum(["male", "female", "mixed"]),
  nationality: z
    .string()
    .trim()
    .regex(/^[A-Za-z]{2,3}$/, "Code ISO 2 ou 3 lettres"),
  sport_nationality: z
    .string()
    .trim()
    .regex(/^[A-Za-z]{2,3}$/, "Code ISO 2 ou 3 lettres")
    .optional()
    .or(z.literal("")),
  email: z.string().trim().email("Email invalide").optional().or(z.literal("")),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  address: z.string().trim().max(255).optional().or(z.literal("")),
  emergency_contact_name: z.string().trim().max(120).optional().or(z.literal("")),
  emergency_contact_phone: z.string().trim().max(40).optional().or(z.literal("")),
  photo_url: z.string().trim().url("URL invalide").optional().or(z.literal("")),
  primary_sport_id: z.string().uuid().optional().or(z.literal("")),
  primary_federation_id: z.string().uuid().optional().or(z.literal("")),
  current_club_id: z.string().uuid().optional().or(z.literal("")),
  status: z.enum(["active", "injured", "suspended", "retired", "ambassador"]),
  level: z
    .enum(["elite", "promotion", "espoir", "olympic_contract"])
    .optional()
    .or(z.literal("")),
  size_clothing: z.string().trim().max(20).optional().or(z.literal("")),
  size_shoes: z.string().trim().max(20).optional().or(z.literal("")),
  size_gloves: z.string().trim().max(20).optional().or(z.literal("")),
  license_number: z.string().trim().max(60).optional().or(z.literal("")),
  ada_number: z.string().trim().max(60).optional().or(z.literal("")),
  passport_number: z.string().trim().max(60).optional().or(z.literal("")),
  passport_expiry: z.string().optional().or(z.literal("")),
});

export type AthleteForm = z.infer<typeof athleteSchema>;

export const generateCoslId = (existing: string[]): string => {
  const year = new Date().getFullYear();
  const prefix = `COSL-${year}-`;
  const max = existing
    .filter((id) => id?.startsWith(prefix))
    .map((id) => parseInt(id.slice(prefix.length), 10))
    .filter((n) => !isNaN(n))
    .reduce((m, n) => Math.max(m, n), 0);
  return `${prefix}${String(max + 1).padStart(4, "0")}`;
};

// Games
export type GameType =
  | "jo_summer" | "jo_winter" | "joj_summer" | "joj_winter"
  | "jpee" | "european_games" | "eyof_summer" | "eyof_winter" | "other";

export type GameStatus = "preparation" | "in_progress" | "finished" | "archived";

export const GAME_TYPES: { value: GameType; label: string; cls: string }[] = [
  { value: "jo_summer", label: "JO été", cls: "bg-amber-100 text-amber-800" },
  { value: "jo_winter", label: "JO hiver", cls: "bg-sky-100 text-sky-800" },
  { value: "joj_summer", label: "JOJ été", cls: "bg-amber-50 text-amber-700" },
  { value: "joj_winter", label: "JOJ hiver", cls: "bg-sky-50 text-sky-700" },
  { value: "jpee", label: "JPEE", cls: "bg-indigo-100 text-indigo-700" },
  { value: "european_games", label: "European Games", cls: "bg-blue-100 text-blue-800" },
  { value: "eyof_summer", label: "EYOF été", cls: "bg-emerald-100 text-emerald-700" },
  { value: "eyof_winter", label: "EYOF hiver", cls: "bg-cyan-100 text-cyan-800" },
  { value: "other", label: "Autre", cls: "bg-slate-200 text-slate-700" },
];

export const GAME_STATUSES: { value: GameStatus; label: string; cls: string }[] = [
  { value: "preparation", label: "Préparation", cls: "bg-amber-100 text-amber-700" },
  { value: "in_progress", label: "En cours", cls: "bg-emerald-100 text-emerald-700" },
  { value: "finished", label: "Terminé", cls: "bg-slate-200 text-slate-700" },
  { value: "archived", label: "Archivé", cls: "bg-slate-100 text-slate-500" },
];

export type Game = {
  id: string;
  name: string;
  short_name: string | null;
  game_type: GameType;
  edition_year: number;
  host_country: string | null;
  host_city: string | null;
  organizer: string | null;
  preparation_start: string | null;
  competition_start: string;
  competition_end: string;
  closing_date: string | null;
  timezone: string | null;
  status: GameStatus;
  description: string | null;
  created_at: string;
};

export type GameSport = {
  id: string;
  game_id: string;
  sport_id: string;
  is_active: boolean | null;
  sport?: Sport | null;
};

export type GameQuota = {
  id: string;
  game_id: string;
  sport_id: string;
  discipline_id: string | null;
  gender: Gender;
  quota_max: number;
  qualification_deadline: string | null;
  qualification_criteria: string | null;
  notes: string | null;
};
