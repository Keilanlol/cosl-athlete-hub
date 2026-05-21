import type { AthleteKyc } from "./types";

export type KycGlobalStatus = "green" | "orange" | "red";

export function computeKycGlobalStatus(kyc: Partial<AthleteKyc> | null | undefined): KycGlobalStatus {
  if (!kyc) return "red";

  const redAxes = [
    !kyc.identity_verified,
    !kyc.nationality_verified,
    kyc.antidoping_status === "red",
  ];
  if (redAxes.some(Boolean)) return "red";

  const axes = [
    kyc.identity_verified,
    kyc.nationality_verified,
    kyc.age_eligibility_ok ?? true,
    kyc.antidoping_status === "green",
    kyc.elearning_antidoping_completed ?? false,
    kyc.ethics_charter_signed ?? false,
    kyc.rule40_signed ?? false,
  ];

  const validated = axes.filter(Boolean).length;
  if (validated === axes.length) return "green";
  return "orange";
}

export function countValidAxes(kyc: Partial<AthleteKyc> | null | undefined): number {
  if (!kyc) return 0;
  const axes = [
    !!kyc.identity_verified,
    !!kyc.nationality_verified,
    kyc.age_eligibility_ok === true,
    kyc.antidoping_status === "green",
    !!kyc.elearning_antidoping_completed,
    !!kyc.ethics_charter_signed,
    !!kyc.rule40_signed,
  ];
  return axes.filter(Boolean).length;
}
