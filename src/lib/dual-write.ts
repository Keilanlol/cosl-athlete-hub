import { supabase } from "@/lib/supabase";
import { assignPersonRole } from "@/lib/role-utils";

export type CreatePersonBase = {
  first_name: string;
  last_name: string;
  birth_date?: string | null;
  gender?: string | null;
  nationality?: string | null;
  email?: string | null;
  phone?: string | null;
  street?: string | null;
  postcode?: string | null;
  city?: string | null;
  country?: string | null;
};

export type AthleteProfileInput = {
  primary_sport_id?: string | null;
  primary_federation_id?: string | null;
  current_club_id?: string | null;
  status?: string;
  level?: string | null;
  license_number?: string | null;
  passport_number?: string | null;
  passport_expiry?: string | null;
};

export type CoachProfileInput = {
  role: string;
  federation_id?: string | null;
  club_id?: string | null;
};

export type FederationMemberInput = {
  federation_id: string;
  role: string;
  start_date?: string | null;
};

export type ClubMemberInput = {
  club_id: string;
  role: string;
  start_date?: string | null;
};

async function nextCoslId(): Promise<string> {
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

export async function createPerson(payload: CreatePersonBase & { is_active?: boolean }) {
  const { data, error } = await supabase
    .from("persons")
    .insert({
      first_name: payload.first_name.trim(),
      last_name: payload.last_name.trim(),
      birth_date: payload.birth_date || null,
      gender: payload.gender || null,
      nationality: payload.nationality?.trim() || null,
      email: payload.email?.trim() || null,
      phone: payload.phone?.trim() || null,
      street: payload.street?.trim() || null,
      postcode: payload.postcode?.trim() || null,
      city: payload.city?.trim() || null,
      country: payload.country?.trim() || null,
      is_active: payload.is_active ?? true,
    })
    .select("id")
    .single();
  if (error || !data) throw error ?? new Error("Création personne échouée");
  return data.id as string;
}

export async function createAthleteFromPerson(
  personId: string,
  base: CreatePersonBase,
  input: AthleteProfileInput,
) {
  if (!base.birth_date || !base.gender) {
    throw new Error("Date de naissance et genre requis");
  }
  const cosl_id = await nextCoslId();
  const { data: legAth, error: lae } = await supabase
    .from("athletes")
    .insert({
      cosl_id,
      first_name: base.first_name.trim(),
      last_name: base.last_name.trim(),
      birth_date: base.birth_date,
      gender: base.gender,
      nationality: base.nationality?.trim() || "LUX",
      email: base.email?.trim() || null,
      phone: base.phone?.trim() || null,
      street: base.street?.trim() || null,
      postcode: base.postcode?.trim() || null,
      city: base.city?.trim() || null,
      country: base.country?.trim() || null,
      is_active: true,
      status: input.status ?? "active",
      level: input.level || null,
      primary_sport_id: input.primary_sport_id || null,
      primary_federation_id: input.primary_federation_id || null,
      current_club_id: input.current_club_id || null,
      license_number: input.license_number || null,
      passport_number: input.passport_number || null,
      passport_expiry: input.passport_expiry || null,
      person_id: personId,
    })
    .select("id")
    .single();
  if (lae || !legAth) throw lae ?? new Error("Athlète legacy KO");

  const { error: ape } = await supabase.from("athlete_profiles").insert({
    person_id: personId,
    legacy_athlete_id: legAth.id,
    cosl_id,
    primary_sport_id: input.primary_sport_id || null,
    primary_federation_id: input.primary_federation_id || null,
    current_club_id: input.current_club_id || null,
    status: input.status ?? "active",
    level: input.level || null,
    license_number: input.license_number || null,
    passport_number: input.passport_number || null,
    passport_expiry: input.passport_expiry || null,
  });
  if (ape) throw ape;

  await supabase
    .from("athlete_kyc")
    .insert({ athlete_id: legAth.id, global_status: "red" });

  await assignPersonRole(personId, "athlete");
}

export async function createCoachFromPerson(
  personId: string,
  base: CreatePersonBase,
  input: CoachProfileInput,
) {
  const { data: legCoach, error: lce } = await supabase
    .from("coaches")
    .insert({
      first_name: base.first_name.trim(),
      last_name: base.last_name.trim(),
      email: base.email?.trim() || null,
      phone: base.phone?.trim() || null,
      role: input.role,
      federation_id: input.federation_id || null,
      club_id: input.club_id || null,
      is_active: true,
      person_id: personId,
    })
    .select("id")
    .single();
  if (lce || !legCoach) throw lce ?? new Error("Coach legacy KO");

  const { error: cpe } = await supabase.from("coach_profiles").insert({
    person_id: personId,
    legacy_coach_id: legCoach.id,
    role: input.role,
    federation_id: input.federation_id || null,
    club_id: input.club_id || null,
    is_active: true,
  });
  if (cpe) throw cpe;

  await assignPersonRole(personId, "coach");
}

export async function createFederationMemberFromPerson(
  personId: string,
  base: CreatePersonBase,
  input: FederationMemberInput,
) {
  const { data: legFm, error: lfme } = await supabase
    .from("federation_members")
    .insert({
      federation_id: input.federation_id,
      first_name: base.first_name.trim(),
      last_name: base.last_name.trim(),
      email: base.email?.trim() || null,
      phone: base.phone?.trim() || null,
      role: input.role,
      start_date: input.start_date || null,
      is_active: true,
      person_id: personId,
    })
    .select("id")
    .single();
  if (lfme || !legFm) throw lfme ?? new Error("Membre fédération legacy KO");

  await supabase.from("federation_member_profiles").insert({
    person_id: personId,
    legacy_federation_member_id: legFm.id,
    federation_id: input.federation_id,
    role: input.role,
    start_date: input.start_date || null,
    is_active: true,
  });

  await assignPersonRole(personId, "federation_member");
}

export async function createClubMemberFromPerson(
  personId: string,
  base: CreatePersonBase,
  input: ClubMemberInput,
) {
  const { data: legCm, error: lcme } = await supabase
    .from("club_members")
    .insert({
      club_id: input.club_id,
      first_name: base.first_name.trim(),
      last_name: base.last_name.trim(),
      email: base.email?.trim() || null,
      phone: base.phone?.trim() || null,
      role: input.role,
      start_date: input.start_date || null,
      is_active: true,
      person_id: personId,
    })
    .select("id")
    .single();
  if (lcme || !legCm) throw lcme ?? new Error("Membre club legacy KO");

  await supabase.from("club_member_profiles").insert({
    person_id: personId,
    legacy_club_member_id: legCm.id,
    club_id: input.club_id,
    role: input.role,
    start_date: input.start_date || null,
    is_active: true,
  });

  await assignPersonRole(personId, "club_member");
}