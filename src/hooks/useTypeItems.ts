import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { friendlyError } from "@/lib/error-messages";
import { toast } from "sonner";
import type { AppTypeItem } from "@/lib/app-types";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type TypeItem = {
  code: string;
  label: string;
  sort_order: number;
  is_system: boolean;
};

export type TypeItemWithCls = TypeItem & {
  cls: string;
};

// ─────────────────────────────────────────────────────────────────────────────
// CSS badge classes — mapping centralisé par code
// On garde les classes CSS côté frontend car elles sont liées au design system
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_CLS = "bg-slate-200 text-foreground";

const CLS_MAP: Record<string, string> = {
  // Athlete statuses
  active: "bg-emerald-100 text-emerald-700",
  injured: "bg-amber-100 text-amber-700",
  suspended: "bg-red-100 text-red-700",
  retired: "bg-slate-200 text-slate-700",
  ambassador: "bg-indigo-100 text-indigo-700",
  // Game statuses
  preparation: "bg-amber-100 text-amber-700",
  in_progress: "bg-emerald-100 text-emerald-700",
  finished: "bg-slate-200 text-slate-700",
  archived: "bg-slate-100 text-slate-500",
  // Accreditation statuses
  draft: "bg-slate-200 text-foreground",
  submitted: "bg-amber-100 text-amber-700",
  validated: "bg-emerald-100 text-emerald-700",
  rejected: "bg-red-100 text-red-700",
  produced: "bg-sky-100 text-sky-700",
  delivered: "bg-emerald-100 text-emerald-700",
  // Document statuses
  missing: "bg-slate-200 text-foreground",
  pending: "bg-amber-100 text-amber-700",
  valid: "bg-emerald-100 text-emerald-700",
  expired: "bg-red-100 text-red-700",
  rejected_doc: "bg-red-100 text-red-700",
  // Selection statuses
  pre_selected: "bg-amber-100 text-amber-700",
  selected: "bg-emerald-100 text-emerald-700",
  reserve: "bg-sky-100 text-sky-700",
  rejected_sel: "bg-red-100 text-red-700",
  // Travel statuses
  planned: "bg-amber-100 text-amber-700",
  confirmed: "bg-emerald-100 text-emerald-700",
  modified: "bg-sky-100 text-sky-700",
  cancelled: "bg-red-100 text-red-700",
  // KYC statuses
  green: "bg-emerald-500 text-white",
  orange: "bg-amber-500 text-white",
  red: "bg-red-600 text-white",
  // User roles
  admin: "bg-red-100 text-red-700",
  games_manager: "bg-indigo-100 text-indigo-700",
  fed_manager: "bg-blue-100 text-blue-700",
  logistics: "bg-amber-100 text-amber-700",
  communication: "bg-emerald-100 text-emerald-700",
  reader: "bg-slate-200 text-slate-700",
  // Game types
  jo_summer: "bg-amber-100 text-amber-800",
  jo_winter: "bg-sky-100 text-sky-800",
  joj_summer: "bg-amber-50 text-amber-700",
  joj_winter: "bg-sky-50 text-sky-700",
  jpee: "bg-indigo-100 text-indigo-700",
  european_games: "bg-blue-100 text-blue-800",
  eyof_summer: "bg-emerald-100 text-emerald-700",
  eyof_winter: "bg-cyan-100 text-cyan-800",
  world_games: "bg-violet-100 text-violet-800",
  other: "bg-slate-200 text-slate-700",
  // Person role types
  athlete: "bg-red-100 text-red-700 border-red-200",
  coach: "bg-blue-100 text-blue-700 border-blue-200",
  federation_member: "bg-indigo-100 text-indigo-700 border-indigo-200",
  official: "bg-amber-100 text-amber-800 border-amber-200",
  volunteer: "bg-purple-100 text-purple-700 border-purple-200",
  staff: "bg-slate-200 text-slate-700 border-slate-300",
};

export function clsForCode(code: string): string {
  return CLS_MAP[code] ?? DEFAULT_CLS;
}

// ─────────────────────────────────────────────────────────────────────────────
// Cache global — on charge app_type_items une seule fois
// ─────────────────────────────────────────────────────────────────────────────

let globalCache: Record<string, TypeItem[]> | null = null;
let globalPromise: Promise<Record<string, TypeItem[]>> | null = null;

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
    const item = row as AppTypeItem;
    if (!map[item.group_key]) map[item.group_key] = [];
    map[item.group_key].push({
      code: item.code,
      label: item.label,
      sort_order: item.sort_order,
      is_system: item.is_system,
    });
  });

  globalCache = map;
  return map;
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook principal
// ─────────────────────────────────────────────────────────────────────────────

export function useTypeItems() {
  const [types, setTypes] = useState<Record<string, TypeItem[]>>(globalCache ?? {});
  const [loading, setLoading] = useState(!globalCache);

  useEffect(() => {
    if (globalCache) {
      setTypes(globalCache);
      setLoading(false);
      return;
    }

    if (!globalPromise) {
      globalPromise = fetchAllTypes();
    }

    let mounted = true;
    globalPromise.then((result) => {
      if (mounted) {
        setTypes(result);
        setLoading(false);
      }
    });

    return () => { mounted = false; };
  }, []);

  const refresh = useCallback(async () => {
    globalCache = null;
    globalPromise = fetchAllTypes();
    const result = await globalPromise;
    setTypes(result);
  }, []);

  // Helpers
  const getItems = useCallback(
    (groupKey: string): TypeItem[] => types[groupKey] ?? [],
    [types],
  );

  const getItemsWithCls = useCallback(
    (groupKey: string): TypeItemWithCls[] =>
      (types[groupKey] ?? []).map((item) => ({ ...item, cls: clsForCode(item.code) })),
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

  return {
    types,
    loading,
    refresh,
    getItems,
    getItemsWithCls,
    getLabel,
    findItem,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook spécifique pour un seul groupe (plus léger)
// ─────────────────────────────────────────────────────────────────────────────

export function useTypeGroup(groupKey: string) {
  const { getItems, getItemsWithCls, getLabel, findItem, loading } = useTypeItems();
  return {
    items: getItems(groupKey),
    itemsWithCls: getItemsWithCls(groupKey),
    getLabel: (code: string | null | undefined) => getLabel(groupKey, code),
    findItem: (code: string | null | undefined) => findItem(groupKey, code),
    loading,
  };
}