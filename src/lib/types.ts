import { z } from "zod";

// ─────────────────────────────────────────────────────────────────────────────
// Type nominal pour les codes de référentiels (app_type_items)
// ─────────────────────────────────────────────────────────────────────────────
// Les colonnes sont en text et l'admin peut créer des codes custom :
// les unions littérales d'origine mentaient. Ce branded type marque
// clairement qu'une valeur provient d'un groupe de référentiel.
export type TypeCode<Group extends string> = string & {
  readonly __typeGroup: Group;
};

export type Federation = {
  id: string;
  acronym: string;
  name: string;
  president_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  international_federation: string | null;
  is_olympic: boolean | null;
  logo_url: string | null;
  logo_storage_path: string | null;
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
  is_active: boolean | null;
  photo_url: string | null;
  photo_storage_path: string | null;
  person_id: string | null;
  created_at: string;
};

export type FederationMember = {
  id: string;
  federation_id: string;
  first_name: string;
  last_name: string;
  role: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  street: string | null;
  postcode: string | null;
  city: string | null;
  country: string | null;
  start_date: string | null;
  end_date: string | null;
  notes: string | null;
  is_active: boolean | null;
  photo_url: string | null;
  photo_storage_path: string | null;
  person_id: string | null;
  created_at: string;
};

export type Sport = {
  id: string;
  name: string;
  is_olympic: boolean | null;
  is_summer: boolean | null;
};

export type AthleteStatus = TypeCode<"athlete_statuses">;
export type AthleteLevel = TypeCode<"athlete_levels">;

export type Gender = "male" | "female" | "mixed";

export const GENDERS: { value: Gender; label: string }[] = [
  { value: "male", label: "Masculin" },
  { value: "female", label: "Féminin" },
  { value: "mixed", label: "Mixte" },
];

export type KycStatusValue = "green" | "orange" | "red";

export type Athlete = {
  id: string;
  cosl_id: string;
  first_name: string;
  last_name: string;
  birth_date: string;
  birth_place: string | null;
  gender: Gender;
  nationality: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  street: string | null;
  postcode: string | null;
  city: string | null;
  country: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  photo_url: string | null;
  primary_sport_id: string | null;
  primary_federation_id: string | null;
  status: AthleteStatus;
  level: string | null;
  size_clothing: string | null;
  size_shoes: string | null;
  size_gloves: string | null;
  license_number: string | null;
  passport_number: string | null;
  passport_expiry: string | null;
  last_medical_check: string | null;
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

export type PersonDocument = {
  id: string;
  person_id: string;
  category: string | null;
  doc_type: string;
  file_name: string;
  file_url: string | null;
  issued_date: string | null;
  expiry_date: string | null;
  status: string;
  uploaded_by: string | null;
  requires_action: boolean | null;
  created_at: string;
};

export type AccreditationRequirement = {
  id: string;
  game_id: string;
  role_code: string;
  doc_type_code: string;
  selection_stage: string | null;
  required: boolean;
  created_at: string;
};

export type AthleteKyc = {
  id: string;
  athlete_id: string;
  // Axe 1 — Identité
  identity_verified: boolean | null;
  passport_doc_id: string | null;
  ci_doc_id: string | null;
  // Axe 2 — Nationalité
  nationality_verified: boolean | null;
  sport_nationality: string | null;
  eligibility_federation: string | null;
  eligibility_verified_at: string | null;
  eligibility_verified_by: string | null;
  // Axe 3 — Âge
  age_eligibility_ok: boolean | null;
  min_age_ok: boolean | null;
  max_age_ok: boolean | null;
  // Axe 4 — Antidopage
  antidoping_status: KycStatusValue | null;
  adams_number: string | null;
  antidoping_last_check: string | null;
  antidoping_whereabouts_ok: boolean | null;
  // Axe 5 — E-learning
  elearning_antidoping_completed: boolean | null;
  elearning_completed_at: string | null;
  elearning_certificate_url: string | null;
  // Axe 6 — Charte éthique
  ethics_charter_signed: boolean | null;
  ethics_charter_signed_at: string | null;
  ethics_charter_doc_id: string | null;
  // Axe 7 — Règle 40
  rule40_signed: boolean | null;
  rule40_signed_at: string | null;
  rule40_doc_id: string | null;
  // Méta
  global_status: KycStatusValue | null;
  last_check_at: string | null;
  kyc_reviewed_by: string | null;
  kyc_reviewed_at: string | null;
  kyc_comment: string | null;
  notes: string | null;
};

export type KycAxisKey =
  | "identity" | "nationality" | "age"
  | "antidoping" | "elearning" | "ethics" | "rule40" | "manual";

export const KYC_AXE_LABELS: Record<KycAxisKey, string> = {
  identity: "Identité officielle",
  nationality: "Nationalité sportive",
  age: "Éligibilité d'âge",
  antidoping: "Antidopage",
  elearning: "E-learning antidopage",
  ethics: "Charte éthique COSL",
  rule40: "Règle 40 CIO",
  manual: "Modification manuelle",
};

export type KycHistoryEntry = {
  id: string;
  athlete_id: string;
  changed_by: string | null;
  previous_status: string | null;
  new_status: string;
  axis: KycAxisKey | null;
  comment: string | null;
  changed_at: string;
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
  game_competition_id: string | null;
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
  email: z.string().trim().email("Email invalide").optional().or(z.literal("")),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  address: z.string().trim().max(255).optional().or(z.literal("")),
  street: z.string().trim().max(255).optional().or(z.literal("")),
  postcode: z.string().trim().max(20).optional().or(z.literal("")),
  city: z.string().trim().max(120).optional().or(z.literal("")),
  country: z.string().trim().max(80).optional().or(z.literal("")),
  emergency_contact_name: z.string().trim().max(120).optional().or(z.literal("")),
  emergency_contact_phone: z.string().trim().max(40).optional().or(z.literal("")),
  photo_url: z.string().trim().url("URL invalide").optional().or(z.literal("")),
  primary_sport_id: z.string().uuid().optional().or(z.literal("")),
  primary_federation_id: z.string().uuid().optional().or(z.literal("")),
  status: z.string().min(1, "Statut requis"),
  level: z
    .string()
    .trim()
    .max(60)
    .optional()
    .or(z.literal("")),
  size_clothing: z.string().trim().max(20).optional().or(z.literal("")),
  size_shoes: z.string().trim().max(20).optional().or(z.literal("")),
  size_gloves: z.string().trim().max(20).optional().or(z.literal("")),
  license_number: z.string().trim().max(60).optional().or(z.literal("")),
  passport_number: z.string().trim().max(60).optional().or(z.literal("")),
  passport_expiry: z.string().optional().or(z.literal("")),
  last_medical_check: z.string().optional().or(z.literal("")),
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

export type Discipline = {
  id: string;
  sport_id: string;
  name: string;
  gender: Gender;
  age_category: string | null;
};

export type GameCompetition = {
  id: string;
  game_id: string;
  sport_id: string;
  discipline_id: string | null;
  name: string;
  competition_date: string | null;
  round: string | null;
  gender: Gender | null;
  category: string | null;
  venue: string | null;
  street: string | null;
  postcode: string | null;
  city: string | null;
  country: string | null;
  min_age: number | null;
  max_age: number | null;
  notes: string | null;
  created_at: string;
};

export type AthleteResult = {
  id: string;
  athlete_id: string;
  game_id: string | null;
  game_competition_id: string | null;
  sport_id: string | null;
  discipline_id: string | null;
  result_date: string | null;
  rank: number | null;
  medal: "gold" | "silver" | "bronze" | null;
  score: string | null;
  unit: string | null;
  is_national_record: boolean;
  is_personal_best: boolean;
  notes: string | null;
  created_at: string;
};

export const MEDAL_LABELS: { value: "gold" | "silver" | "bronze"; label: string; cls: string }[] = [
  { value: "gold", label: "🥇 Or", cls: "bg-amber-100 text-amber-800" },
  { value: "silver", label: "🥈 Argent", cls: "bg-slate-200 text-slate-700" },
  { value: "bronze", label: "🥉 Bronze", cls: "bg-orange-100 text-orange-700" },
];

// Games
export type GameType = TypeCode<"game_types">;
export type GameStatus = TypeCode<"game_statuses">;

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
  logo_url: string | null;
  logo_storage_path: string | null;
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

// Logistics
export type TravelStatus = TypeCode<"travel_statuses">;
export type TravelScope = "global" | "sport" | "individual";

export const TRAVEL_SCOPES: { value: TravelScope; label: string }[] = [
  { value: "global", label: "Global" },
  { value: "sport", label: "Sport" },
  { value: "individual", label: "Individuel" },
];

export type TravelPlan = {
  id: string;
  game_id: string;
  delegation_id: string | null;
  name: string;
  scope: TravelScope;
  sport_id: string | null;
  departure_date: string;
  return_date: string;
  departure_point: string | null;
  arrival_point: string | null;
  status: TravelStatus;
  notes: string | null;
  created_at: string;
};

export type Flight = {
  id: string;
  travel_plan_id: string;
  flight_number: string;
  airline: string | null;
  departure_airport: string;
  arrival_airport: string;
  departure_time: string;
  arrival_time: string;
  is_outbound: boolean;
  notes: string | null;
};

export type FlightPassenger = {
  id: string;
  flight_id: string;
  athlete_id: string | null;
  coach_id: string | null;
  seat: string | null;
  special_baggage: string | null;
  notes: string | null;
};

export type Accommodation = {
  id: string;
  game_id: string;
  name: string;
  address: string | null;
  street: string | null;
  postcode: string | null;
  city: string | null;
  country: string | null;
  type: string | null;
  total_rooms: number | null;
  notes: string | null;
  created_at: string;
};

export type RoomingAssignment = {
  id: string;
  accommodation_id: string;
  room_number: string;
  room_type: string | null;
  athlete_id: string | null;
  coach_id: string | null;
  check_in: string;
  check_out: string;
  notes: string | null;
};

export type LocalTransport = {
  id: string;
  game_id: string;
  transport_type: string;
  pickup_location: string;
  dropoff_location: string;
  pickup_time: string;
  capacity: number | null;
  notes: string | null;
};

export type LocalTransportPassenger = {
  id: string;
  local_transport_id: string;
  athlete_id: string | null;
  coach_id: string | null;
  seat: string | null;
  notes: string | null;
  created_at: string;
};


// Communication
export type MessageTemplate = {
  id: string;
  name: string;
  subject: string;
  body: string;
  channel: string;
  is_active: boolean | null;
  created_at: string;
};

export type MessageSent = {
  id: string;
  template_id: string | null;
  game_id: string | null;
  channel: string;
  subject: string;
  body: string;
  audience_segment: string;
  recipients_count: number;
  sent_by: string | null;
  sent_at: string;
};

export type Notification = {
  id: string;
  notification_type: string;
  message: string;
  target_user_id: string | null;
  related_athlete_id: string | null;
  related_game_id: string | null;
  related_doc_id: string | null;
  related_person_id: string | null;
  related_doc_type: string | null;
  is_read: boolean | null;
  created_at: string;
};

// Admin
export type UserProfile = {
  id: string;
  username: string;
  full_name: string;
  email: string;
  role: string;
  plain_password: string | null;
  created_at: string;
};
