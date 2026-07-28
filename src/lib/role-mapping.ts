// ─────────────────────────────────────────────────────────────────────────────
// Résolution des rôles vers les catégories d'accréditation
// ─────────────────────────────────────────────────────────────────────────────
// La table role_accreditation_mapping fait le pont entre les trois vocabulaires
// de rôles (person_role_types, coach_roles, federation_member_roles) et les
// catégories d'accréditation (accreditation_categories).
// Ce module expose un résolveur async avec cache, et un hook synchrone.

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export type RoleMapping = {
  source_group: string;
  source_code: string;
  accreditation_category: string;
};

// ── Cache module-level (pour usage hors React) ──────────────────────────────
let mappingCache: RoleMapping[] | null = null;
let mappingPromise: Promise<RoleMapping[]> | null = null;

async function fetchMappings(): Promise<RoleMapping[]> {
  const { data, error } = await supabase
    .from("role_accreditation_mapping")
    .select("source_group, source_code, accreditation_category");

  if (error) return [];
  mappingCache = (data ?? []) as RoleMapping[];
  return mappingCache;
}

/**
 * Résout un code de rôle source vers une catégorie d'accréditation.
 * Async, avec cache module-level.
 */
export async function resolveAccreditationCategory(
  sourceGroup: string,
  sourceCode: string,
): Promise<string | null> {
  if (!mappingCache) {
    if (!mappingPromise) {
      mappingPromise = fetchMappings();
    }
    const mappings = await mappingPromise;
    const found = mappings.find(
      (m) => m.source_group === sourceGroup && m.source_code === sourceCode,
    );
    return found?.accreditation_category ?? null;
  }

  const found = mappingCache.find(
    (m) => m.source_group === sourceGroup && m.source_code === sourceCode,
  );
  return found?.accreditation_category ?? null;
}

/**
 * Invalide le cache (à appeler après modification de la table de mapping).
 */
export function invalidateRoleMappingCache() {
  mappingCache = null;
  mappingPromise = null;
}

// ── Hook synchrone pour usage dans les composants React ─────────────────────

export function useRoleMappings() {
  const [mappings, setMappings] = useState<RoleMapping[]>(mappingCache ?? []);
  const [loading, setLoading] = useState(!mappingCache);

  const load = useCallback(async () => {
    if (!mappingPromise) {
      mappingPromise = fetchMappings();
    }
    const result = await mappingPromise;
    setMappings(result);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (mappingCache) {
      setMappings(mappingCache);
      setLoading(false);
      return;
    }
    load();
  }, [load]);

  const resolve = useCallback(
    (sourceGroup: string, sourceCode: string): string | null => {
      const found = mappings.find(
        (m) => m.source_group === sourceGroup && m.source_code === sourceCode,
      );
      return found?.accreditation_category ?? null;
    },
    [mappings],
  );

  return { mappings, loading, resolve, reload: load };
}