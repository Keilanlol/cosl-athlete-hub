import type { AthleteKyc } from "./types";

export type KycGlobalStatus = "green" | "orange" | "red";

export function computeKycGlobalStatus(kyc: Partial<AthleteKyc> | null | undefined): KycGlobalStatus {
  if (!kyc) return "red";

  // Axes bloquants absolus (rouge immédiat)
  if (!kyc.identity_verified) return "red";
  if (!kyc.nationality_verified) return "red";
  if (kyc.antidoping_status === "red") return "red";

  // 6 axes (l'éligibilité d'âge est désormais calculée par épreuve)
  const allGreen =
    kyc.identity_verified === true &&
    kyc.nationality_verified === true &&
    kyc.antidoping_status === "green" &&
    kyc.elearning_antidoping_completed === true &&
    kyc.ethics_charter_signed === true &&
    kyc.rule40_signed === true;

  return allGreen ? "green" : "orange";
}

export function countValidAxes(kyc: Partial<AthleteKyc> | null | undefined): number {
  if (!kyc) return 0;
  const axes = [
    !!kyc.identity_verified,
    !!kyc.nationality_verified,
    kyc.antidoping_status === "green",
    !!kyc.elearning_antidoping_completed,
    !!kyc.ethics_charter_signed,
    !!kyc.rule40_signed,
  ];
  return axes.filter(Boolean).length;
}

/**
 * Calcule l'âge exact en années complètes à partir d'une date de naissance.
 */
export function computeAge(birthDate: string | null | undefined, refDate?: string | Date | null): number | null {
  if (!birthDate) return null;
  const birth = new Date(birthDate);
  if (isNaN(birth.getTime())) return null;
  const ref = refDate ? new Date(refDate) : new Date();
  if (isNaN(ref.getTime())) return null;
  let age = ref.getFullYear() - birth.getFullYear();
  const m = ref.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && ref.getDate() < birth.getDate())) age--;
  return age;
}

export type AgeEligibilityResult = {
  eligible: boolean;
  reason: string;
  age: number | null;
};

export function checkAgeEligibility(
  birthDate: string | null | undefined,
  minAge: number | null | undefined,
  maxAge: number | null | undefined,
  competitionDate?: string | null,
): AgeEligibilityResult {
  const age = computeAge(birthDate, competitionDate ?? null);
  if (age === null) {
    return { eligible: false, reason: "Date de naissance manquante", age: null };
  }
  if (minAge != null && age < minAge) {
    return { eligible: false, reason: `Trop jeune : ${age} ans (minimum ${minAge} ans)`, age };
  }
  if (maxAge != null && age > maxAge) {
    return { eligible: false, reason: `Trop âgé : ${age} ans (maximum ${maxAge} ans)`, age };
  }
  if (minAge == null && maxAge == null) {
    return { eligible: true, reason: "Aucune restriction d'âge", age };
  }
  return {
    eligible: true,
    reason: `Éligible : ${age} ans${minAge != null ? ` (min ${minAge})` : ""}${maxAge != null ? ` (max ${maxAge})` : ""}`,
    age,
  };
}
