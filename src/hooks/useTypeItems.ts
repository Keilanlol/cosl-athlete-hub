import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { friendlyError } from "@/lib/error-messages";
import { toast } from "sonner";
import type { AppTypeItem, AppTypeGroupMeta, AppTypeGroup } from "@/lib/app-types";
import { APP_TYPE_GROUPS } from "@/lib/app-types";
import { slugifyCode } from "@/lib/utils";

// Re-export des types pour les consommateurs
export type { AppTypeItem, AppTypeGroup, AppTypeGroupMeta };

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type TypeItem = {
  code: string;
  label: string;
  sort_order: number;
  is_system: boolean;
  category?: string | null;
  description?: string | null;
  is_active?: boolean;
};

export type TypeItemWithCls = TypeItem & {
  cls: string;
};

// ─────────────────────────────────────────────────────────────────────────────
// CSS badge classes — mapping centralisé par clé composite group_key:code
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_CLS = "bg-slate-200 text-foreground";

const CLS_MAP: Record<string, string> = {
  // ── athlete_statuses ──
  "athlete_statuses:active": "bg-emerald-100 text-emerald-700",
  "athlete_statuses:injured": "bg-amber-100 text-amber-700",
  "athlete_statuses:suspended": "bg-red-100 text-red-700",
  "athlete_statuses:retired": "bg-slate-200 text-slate-700",
  "athlete_statuses:ambassador": "bg-indigo-100 text-indigo-700",

  // ── game_statuses ──
  "game_statuses:preparation": "bg-amber-100 text-amber-700",
  "game_statuses:in_progress": "bg-emerald-100 text-emerald-700",
  "game_statuses:finished": "bg-slate-200 text-slate-700",
  "game_statuses:archived": "bg-slate-100 text-slate-500",

  // ── accreditation_statuses ──
  "accreditation_statuses:draft": "bg-slate-200 text-foreground",
  "accreditation_statuses:submitted": "bg-amber-100 text-amber-700",
  "accreditation_statuses:validated": "bg-emerald-100 text-emerald-700",
  "accreditation_statuses:rejected": "bg-red-100 text-red-700",

  // ── document_statuses ──
  "document_statuses:missing": "bg-slate-200 text-foreground",
  "document_statuses:pending": "bg-amber-100 text-amber-700",
  "document_statuses:valid": "bg-emerald-100 text-emerald-700",
  "document_statuses:expired": "bg-red-100 text-red-700",
  "document_statuses:rejected": "bg-red-100 text-red-700",

  // ── selection_statuses ──
  "selection_statuses:pre_selected": "bg-amber-100 text-amber-700",
  "selection_statuses:selected": "bg-emerald-100 text-emerald-700",
  "selection_statuses:reserve": "bg-sky-100 text-sky-700",
  "selection_statuses:rejected": "bg-red-100 text-red-700",

  // ── travel_statuses ──
  "travel_statuses:planned": "bg-amber-100 text-amber-700",
  "travel_statuses:confirmed": "bg-emerald-100 text-emerald-700",
  "travel_statuses:modified": "bg-sky-100 text-sky-700",
  "travel_statuses:cancelled": "bg-red-100 text-red-700",

  // ── kyc_statuses ──
  "kyc_statuses:green": "bg-emerald-500 text-white",
  "kyc_statuses:orange": "bg-amber-500 text-white",
  "kyc_statuses:red": "bg-red-600 text-white",

  // ── user_roles ──
  "user_roles:admin": "bg-red-100 text-red-700",
  "user_roles:games_manager": "bg-indigo-100 text-indigo-700",
  "user_roles:fed_manager": "bg-blue-100 text-blue-700",
  "user_roles:logistics": "bg-amber-100 text-amber-700",
  "user_roles:communication": "bg-emerald-100 text-emerald-700",
  "user_roles:reader": "bg-slate-200 text-slate-700",

  // ── game_types ──
  "game_types:jo_summer": "bg-amber-100 text-amber-800",
  "game_types:jo_winter": "bg-sky-100 text-sky-800",
  "game_types:joj_summer": "bg-amber-50 text-amber-700",
  "game_types:joj_winter": "bg-sky-50 text-sky-700",
  "game_types:jpee": "bg-indigo-100 text-indigo-700",
  "game_types:european_games": "bg-blue-100 text-blue-800",
  "game_types:eyof_summer": "bg-emerald-100 text-emerald-700",
  "game_types:eyof_winter": "bg-cyan-100 text-cyan-800",
  "game_types:world_games": "bg-violet-100 text-violet-800",
  "game_types:other": "bg-slate-200 text-slate-700",

  // ── person_role_types ──
  "person_role_types:athlete": "bg-red-100 text-red-700 border-red-200",
  "person_role_types:coach": "bg-blue-100 text-blue-700 border-blue-200",
  "person_role_types:federation_member": "bg-indigo-100 text-indigo-700 border-indigo-200",
  "person_role_types:official": "bg-amber-100 text-amber-800 border-amber-200",
  "person_role_types:volunteer": "bg-purple-100 text-purple-700 border-purple-200",
  "person_role_types:staff": "bg-slate-200 text-slate-700 border-slate-300",

  // ── accreditation_categories ──
  "accreditation_categories:athlete": "bg-red-100 text-red-700",
  "accreditation_categories:coach": "bg-blue-100 text-blue-700",
  "accreditation_categories:official": "bg-amber-100 text-amber-800",
  "accreditation_categories:medical": "bg-slate-200 text-slate-700",
  "accreditation_categories:press": "bg-emerald-100 text-emerald-700",
  "accreditation_categories:vip": "bg-violet-100 text-violet-800",
  "accreditation_categories:president": "bg-indigo-100 text-indigo-700",
  "accreditation_categories:secretary_general": "bg-blue-100 text-blue-800",
};

export function clsForCode(groupKey: string, code: string): string {
  return CLS_MAP[`${groupKey}:${code}`] ?? DEFAULT_CLS;
}

// ─────────────────────────────────────────────────────────────────────────────
// React Query — cache partagé avec invalidation propagée
// ─────────────────────────────────────────────────────────────────────────────

const QUERY_KEY = ["app_type_items"] as const;

async function fetchAllTypes(): Promise<Record<string, TypeItem[]>> {
  const { data, error } = await supabase
    .from("app_type_items")
    .select("*")
    .order("group_key", { ascending: true })
    .order("sort_order", { ascending: true });

  if (error) {
    toast.error("Erreur de chargement des types", { description: friendlyError(error) });
    return {};
  }

  const map: Record<string, TypeItem[]> = {};
  (data ?? []).forEach((row) => {
    const item = row as AppTypeItem & { category?: string; description?: string; is_active?: boolean };
    const groupKey = item.group_key;
    if (!map[groupKey]) map[groupKey] = [];
    map[groupKey].push({
      code: item.code,
      label: item.label,
      sort_order: item.sort_order,
      is_system: item.is_system,
      category: item.category,
      description: item.description,
      is_active: item.is_active,
    });
  });

  return map;
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook principal — useTypeItems
// ─────────────────────────────────────────────────────────────────────────────

export function useTypeItems() {
  const queryClient = useQueryClient();

  const { data: types = {}, isLoading: loading } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: fetchAllTypes,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const refresh = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: QUERY_KEY });
  }, [queryClient]);

  const getItems = useCallback(
    (groupKey: string): TypeItem[] => types[groupKey] ?? [],
    [types],
  );

  const getItemsWithCls = useCallback(
    (groupKey: string): TypeItemWithCls[] =>
      (types[groupKey] ?? []).map((item) => ({
        ...item,
        cls: clsForCode(groupKey, item.code),
      })),
    [types],
  );

  const getLabel = useCallback(
    (groupKey: string, code: string | null | undefined): string => {
      if (!code) return "—";
      const items = types[groupKey];
      if (!items) return code;
      return items.find((i) => i.code === code)?.label ?? code;
    },
    [types],
  );

  const findItem = useCallback(
    (groupKey: string, code: string | null | undefined): TypeItem | null => {
      if (!code) return null;
      const items = types[groupKey];
      if (!items) return null;
      return items.find((i) => i.code === code) ?? null;
    },
    [types],
  );

  // ── Mutations (write) ──
  const addItem = useCallback(
    async (groupKey: string, code: string, label: string) => {
      const codeSlug = slugifyCode(code);
      if (!codeSlug) {
        toast.error("Le code est requis");
        return false;
      }
      if (!label.trim()) {
        toast.error("Le libellé est requis");
        return false;
      }

      const group = types[groupKey] ?? [];
      const maxSort = group.reduce((m, i) => Math.max(m, i.sort_order), 0);

      const { error } = await supabase.from("app_type_items").insert({
        group_key: groupKey,
        code: codeSlug,
        label: label.trim(),
        sort_order: maxSort + 1,
        is_system: false,
      });

      if (error) {
        toast.error("Erreur lors de l'ajout", { description: friendlyError(error) });
        return false;
      }

      toast.success("Type ajouté");
      await queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      return true;
    },
    [types, queryClient],
  );

  const updateItem = useCallback(
    async (item: AppTypeItem, label: string) => {
      if (!label.trim()) {
        toast.error("Le libellé est requis");
        return false;
      }
      const { error } = await supabase
        .from("app_type_items")
        .update({ label: label.trim() })
        .eq("id", item.id);

      if (error) {
        toast.error("Erreur lors de la modification", { description: friendlyError(error) });
        return false;
      }

      toast.success("Type modifié");
      await queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      return true;
    },
    [queryClient],
  );

  const deleteItem = useCallback(
    async (item: AppTypeItem) => {
      const { error } = await supabase.from("app_type_items").delete().eq("id", item.id);

      if (error) {
        toast.error("Erreur lors de la suppression", { description: friendlyError(error) });
        return false;
      }

      toast.success("Type supprimé");
      await queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      return true;
    },
    [queryClient],
  );

  return {
    types,
    loading,
    refresh,
    getItems,
    getItemsWithCls,
    getLabel,
    findItem,
    addItem,
    updateItem,
    deleteItem,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook spécifique pour un seul groupe
// ─────────────────────────────────────────────────────────────────────────────

export function useTypeGroup(groupKey: string) {
  const { getItems, getItemsWithCls, getLabel, findItem, loading, refresh } = useTypeItems();
  return {
    items: getItems(groupKey),
    itemsWithCls: getItemsWithCls(groupKey),
    getLabel: (code: string | null | undefined) => getLabel(groupKey, code),
    findItem: (code: string | null | undefined) => findItem(groupKey, code),
    loading,
    refresh,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook fusionné — useAppTypes (remplace l'ancien de app-types.ts)
// ─────────────────────────────────────────────────────────────────────────────

export function useAppTypes() {
  const { types, loading, refresh, addItem, updateItem, deleteItem } = useTypeItems();

  const groups: AppTypeGroup[] = (APP_TYPE_GROUPS as AppTypeGroupMeta[]).map((meta) => ({
    ...meta,
    items: (types[meta.key] ?? []).map((item) => ({
      id: "",
      group_key: meta.key,
      code: item.code,
      label: item.label,
      sort_order: item.sort_order,
      is_system: item.is_system,
      created_at: "",
    })),
  }));

  return { groups, loading, load: refresh, addItem, updateItem, deleteItem };
}