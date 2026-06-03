// Helpers to keep person.photo_url in sync with linked legacy role records
// (athletes, coaches, federation_members, club_members).
import { supabase } from "@/lib/supabase";

type PhotoFields = {
  photo_url: string | null;
  photo_storage_path: string | null;
};

async function getLegacyIds(personId: string) {
  const [apRes, cpRes, fmRes, cmRes] = await Promise.all([
    supabase
      .from("athlete_profiles")
      .select("legacy_athlete_id")
      .eq("person_id", personId)
      .maybeSingle(),
    supabase
      .from("coach_profiles")
      .select("legacy_coach_id")
      .eq("person_id", personId),
    supabase
      .from("federation_member_profiles")
      .select("legacy_federation_member_id")
      .eq("person_id", personId),
    supabase
      .from("club_member_profiles")
      .select("legacy_club_member_id")
      .eq("person_id", personId),
  ]);

  const athleteId =
    (apRes.data as { legacy_athlete_id?: string | null } | null)
      ?.legacy_athlete_id ?? null;
  const coachIds = ((cpRes.data ?? []) as { legacy_coach_id?: string | null }[])
    .map((x) => x.legacy_coach_id)
    .filter((x): x is string => !!x);
  const fmIds = (
    (fmRes.data ?? []) as { legacy_federation_member_id?: string | null }[]
  )
    .map((x) => x.legacy_federation_member_id)
    .filter((x): x is string => !!x);
  const cmIds = ((cmRes.data ?? []) as { legacy_club_member_id?: string | null }[])
    .map((x) => x.legacy_club_member_id)
    .filter((x): x is string => !!x);

  return { athleteId, coachIds, fmIds, cmIds };
}

/** Propagate the person's photo to every linked legacy record. */
export async function syncPhotoFromPerson(
  personId: string,
  fields: PhotoFields,
) {
  const { athleteId, coachIds, fmIds, cmIds } = await getLegacyIds(personId);
  const tasks: Promise<unknown>[] = [];
  if (athleteId) {
    // athletes table doesn't have photo_storage_path
    tasks.push(
      supabase
        .from("athletes")
        .update({ photo_url: fields.photo_url })
        .eq("id", athleteId),
    );
  }
  if (coachIds.length) {
    tasks.push(supabase.from("coaches").update(fields).in("id", coachIds));
  }
  if (fmIds.length) {
    tasks.push(
      supabase.from("federation_members").update(fields).in("id", fmIds),
    );
  }
  if (cmIds.length) {
    tasks.push(supabase.from("club_members").update(fields).in("id", cmIds));
  }
  await Promise.all(tasks);
}

/** Update the person's photo from a legacy record edit, then fan out to the others. */
export async function syncPhotoFromLegacy(
  personId: string | null,
  fields: PhotoFields,
) {
  if (!personId) return;
  await supabase.from("persons").update(fields).eq("id", personId);
  await syncPhotoFromPerson(personId, fields);
}

/** Resolve the linked person_id for a legacy record. */
export async function findPersonIdForLegacy(
  table:
    | "athlete_profiles"
    | "coach_profiles"
    | "federation_member_profiles"
    | "club_member_profiles",
  legacyColumn:
    | "legacy_athlete_id"
    | "legacy_coach_id"
    | "legacy_federation_member_id"
    | "legacy_club_member_id",
  legacyId: string,
): Promise<string | null> {
  const { data } = await supabase
    .from(table)
    .select("person_id")
    .eq(legacyColumn, legacyId)
    .maybeSingle();
  return (data as { person_id?: string } | null)?.person_id ?? null;
}
