// Sync contact/address data between persons and legacy tables (athletes, coaches)
import { supabase } from "@/lib/supabase";

export type SyncFields = {
  email?: string | null;
  phone?: string | null;
  street?: string | null;
  postcode?: string | null;
  city?: string | null;
  country?: string | null;
  emergency_contact_name?: string | null;
  emergency_contact_phone?: string | null;
};

/**
 * Find the person_id linked to a legacy athlete via athlete_profiles.
 */
export async function findPersonIdForAthlete(athleteId: string): Promise<string | null> {
  const { data } = await supabase
    .from("athlete_profiles")
    .select("person_id")
    .eq("legacy_athlete_id", athleteId)
    .maybeSingle();
  return (data as { person_id?: string | null } | null)?.person_id ?? null;
}

/**
 * Find the person_id linked to a legacy coach via coach_profiles.
 */
export async function findPersonIdForCoach(coachId: string): Promise<string | null> {
  const { data } = await supabase
    .from("coach_profiles")
    .select("person_id")
    .eq("legacy_coach_id", coachId)
    .maybeSingle();
  return (data as { person_id?: string | null } | null)?.person_id ?? null;
}

/**
 * Sync fields from persons → legacy table (athletes or coaches).
 * When a person's email/phone/address changes, update the corresponding
 * legacy row so both sides stay in sync.
 */
export async function syncPersonToLegacy(
  personId: string,
  fields: SyncFields,
): Promise<void> {
  // Update athletes linked to this person
  await supabase
    .from("athletes")
    .update({
      email: fields.email ?? undefined,
      phone: fields.phone ?? undefined,
    })
    .eq("person_id", personId);

  // Update coaches linked to this person
  await supabase
    .from("coaches")
    .update({
      email: fields.email ?? undefined,
      phone: fields.phone ?? undefined,
    })
    .eq("person_id", personId);
}

/**
 * Sync fields from legacy table → persons.
 * When an athlete's or coach's email/phone changes, update the person row.
 */
export async function syncLegacyToPerson(
  personId: string,
  fields: SyncFields,
): Promise<void> {
  if (!personId) return;
  const update: Record<string, string | null> = {};
  if (fields.email !== undefined) update.email = fields.email;
  if (fields.phone !== undefined) update.phone = fields.phone;
  if (fields.street !== undefined) update.street = fields.street;
  if (fields.postcode !== undefined) update.postcode = fields.postcode;
  if (fields.city !== undefined) update.city = fields.city;
  if (fields.country !== undefined) update.country = fields.country;
  if (fields.emergency_contact_name !== undefined) update.emergency_contact_name = fields.emergency_contact_name;
  if (fields.emergency_contact_phone !== undefined) update.emergency_contact_phone = fields.emergency_contact_phone;

  if (Object.keys(update).length > 0) {
    await supabase.from("persons").update(update).eq("id", personId);
  }
}