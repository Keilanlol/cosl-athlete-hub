// Central helpers: translate raw role DB values into French labels.
// These functions use the hardcoded constants as fallback when app_type_items
// is not yet loaded (e.g. during initial render).
import {
  COACH_ROLES,
  FEDERATION_MEMBER_ROLES,
} from "./types";

const coachMap = new Map<string, string>(COACH_ROLES.map((r) => [r.value, r.label]));
const fedMap = new Map<string, string>(FEDERATION_MEMBER_ROLES.map((r) => [r.value, r.label]));

// These will be populated by useTypeItems at runtime
let dynamicCoachMap: Map<string, string> | null = null;
let dynamicFedMap: Map<string, string> | null = null;

/** Called by the app to inject dynamic labels from app_type_items */
export function setDynamicRoleLabels(coach: Record<string, string>, fed: Record<string, string>) {
  dynamicCoachMap = new Map(Object.entries(coach));
  dynamicFedMap = new Map(Object.entries(fed));
}

export function coachRoleLabel(value: string | null | undefined): string {
  if (!value) return "—";
  return dynamicCoachMap?.get(value) ?? coachMap.get(value) ?? value;
}

export function federationMemberRoleLabel(value: string | null | undefined): string {
  if (!value) return "—";
  return dynamicFedMap?.get(value) ?? fedMap.get(value) ?? value;
}

/** Generic best-effort label: tries coach and federation vocabularies. */
export function anyRoleLabel(value: string | null | undefined): string {
  if (!value) return "—";
  return (
    dynamicCoachMap?.get(value) ??
    coachMap.get(value) ??
    dynamicFedMap?.get(value) ??
    fedMap.get(value) ??
    value
  );
}