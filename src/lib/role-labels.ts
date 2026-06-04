// Central helpers: translate raw role DB values into the French label
// declared in src/lib/types.ts. Falls back to the raw value if unknown.
import {
  COACH_ROLES,
  FEDERATION_MEMBER_ROLES,
  CLUB_MEMBER_ROLES,
} from "./types";

const coachMap = new Map(COACH_ROLES.map((r) => [r.value, r.label]));
const fedMap = new Map(FEDERATION_MEMBER_ROLES.map((r) => [r.value, r.label]));
const clubMap = new Map(CLUB_MEMBER_ROLES.map((r) => [r.value, r.label]));

export function coachRoleLabel(value: string | null | undefined): string {
  if (!value) return "—";
  return coachMap.get(value) ?? value;
}
export function federationMemberRoleLabel(value: string | null | undefined): string {
  if (!value) return "—";
  return fedMap.get(value) ?? value;
}
export function clubMemberRoleLabel(value: string | null | undefined): string {
  if (!value) return "—";
  return clubMap.get(value) ?? value;
}

/** Generic best-effort label: tries all three vocabularies. */
export function anyRoleLabel(value: string | null | undefined): string {
  if (!value) return "—";
  return (
    coachMap.get(value) ??
    fedMap.get(value) ??
    clubMap.get(value) ??
    value
  );
}
