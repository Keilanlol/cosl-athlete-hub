// ─────────────────────────────────────────────────────────────────────────────
// Hook usePermissions — permissions dynamiques par rôle
// ─────────────────────────────────────────────────────────────────────────────
// Charge les permissions de l'utilisateur courant depuis get_user_permissions()
// et expose des helpers synchrones (canRead, canWrite, canDelete, canAccessDoc).

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";

export type ModulePermissions = {
  can_read: boolean;
  can_write: boolean;
  can_delete: boolean;
};

export type DocumentCategoryPermissions = {
  can_read: boolean;
  can_write: boolean;
};

export type UserPermissions = {
  role: string;
  modules: Record<string, ModulePermissions>;
  document_access: Record<string, DocumentCategoryPermissions>;
};

const DEFAULT_PERMISSIONS: UserPermissions = {
  role: "reader",
  modules: {},
  document_access: {},
};

let globalPermissions: UserPermissions | null = null;

async function fetchMyPermissions(): Promise<UserPermissions> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return DEFAULT_PERMISSIONS;

  const { data, error } = await supabase.rpc("get_user_permissions", {
    p_user_id: user.id,
  });
  if (error) return DEFAULT_PERMISSIONS;
  globalPermissions = (data as UserPermissions) ?? DEFAULT_PERMISSIONS;
  return globalPermissions;
}

export function usePermissions() {
  const [permissions, setPermissions] = useState<UserPermissions>(
    globalPermissions ?? DEFAULT_PERMISSIONS,
  );
  const [loading, setLoading] = useState(!globalPermissions);

  const load = useCallback(async () => {
    const result = await fetchMyPermissions();
    setPermissions(result);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (globalPermissions) {
      setPermissions(globalPermissions);
      setLoading(false);
      return;
    }
    load();
  }, [load]);

  const canRead = useCallback(
    (module: string): boolean => permissions.modules[module]?.can_read ?? false,
    [permissions],
  );

  const canWrite = useCallback(
    (module: string): boolean => permissions.modules[module]?.can_write ?? false,
    [permissions],
  );

  const canDelete = useCallback(
    (module: string): boolean => permissions.modules[module]?.can_delete ?? false,
    [permissions],
  );

  const canReadDoc = useCallback(
    (category: string): boolean => permissions.document_access[category]?.can_read ?? false,
    [permissions],
  );

  const canWriteDoc = useCallback(
    (category: string): boolean => permissions.document_access[category]?.can_write ?? false,
    [permissions],
  );

  const isAdmin = useCallback(
    (): boolean => permissions.role === "admin",
    [permissions],
  );

  return {
    permissions,
    loading,
    canRead,
    canWrite,
    canDelete,
    canReadDoc,
    canWriteDoc,
    isAdmin,
    reload: load,
  };
}

// ── Types pour l'admin ──────────────────────────────────────────────────────

export const MODULES = [
  { key: "persons", label: "Personnes" },
  { key: "athletes", label: "Athlètes" },
  { key: "documents", label: "Documents" },
  { key: "accreditations", label: "Accréditations" },
  { key: "games", label: "Games" },
  { key: "logistics", label: "Logistique" },
  { key: "communication", label: "Communication" },
  { key: "federations", label: "Fédérations" },
  { key: "clubs", label: "Clubs" },
  { key: "selections", label: "Sélections" },
  { key: "events", label: "Événements" },
  { key: "admin", label: "Administration" },
] as const;

export const DOC_CATEGORIES = [
  { key: "admin", label: "Administratif (identité)" },
  { key: "medical", label: "Médical" },
  { key: "sportive", label: "Sportif" },
  { key: "contractual", label: "Contractuel" },
] as const;