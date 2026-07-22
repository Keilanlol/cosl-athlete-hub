import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { friendlyError } from "@/lib/error-messages";
import { toast } from "sonner";

// ─────────────────────────────────────────────────────────────────────────────
// Type
// ─────────────────────────────────────────────────────────────────────────────

export type AppTypeItem = {
  id: string;
  group_key: string;
  code: string;
  label: string;
  sort_order: number;
  is_system: boolean;
  created_at: string;
};

export type AppTypeGroupMeta = {
  key: string;
  label: string;
  description: string;
};

export type AppTypeGroup = AppTypeGroupMeta & {
  items: AppTypeItem[];
};

// ─────────────────────────────────────────────────────────────────────────────
// Métadonnées d'affichage des groupes (ordre et traduction FR)
// ─────────────────────────────────────────────────────────────────────────────

export const APP_TYPE_GROUPS: AppTypeGroupMeta[] = [
  { key: "user_roles",                label: "Rôles des comptes COSL",    description: "Rôles attribuables aux utilisateurs de la plateforme" },
  { key: "athlete_statuses",           label: "Statuts des athlètes",       description: "Cycle de vie d'un athlète" },
  { key: "athlete_levels",             label: "Niveaux d'athlètes",         description: "Niveaux de performance des athlètes" },
  { key: "game_types",                 label: "Types de jeux",              description: "JO, JOJ, JPEE, EYOF, European Games, etc." },
  { key: "game_statuses",              label: "Statuts des jeux",            description: "État d'avancement d'une édition" },
  { key: "accreditation_categories",   label: "Catégories d'accréditation", description: "Catégories de personnes accréditées" },
  { key: "accreditation_statuses",     label: "Statuts d'accréditation",     description: "Cycle de validation des accréditations" },
  { key: "document_types",             label: "Types de documents",         description: "Types de documents pour accréditations (passeport, convention, etc.)" },
  { key: "document_categories",        label: "Catégories de documents",    description: "Classification des documents athlètes" },
  { key: "document_statuses",          label: "Statuts de documents",       description: "État d'un document (valide, expiré, etc.)" },
  { key: "travel_statuses",            label: "Statuts de voyage",           description: "État d'un plan de voyage" },
  { key: "selection_statuses",         label: "Statuts de sélection",       description: "État d'une sélection d'athlète" },
  { key: "kyc_statuses",               label: "Statuts KYC",                description: "Code couleur des axes KYC" },
  { key: "coach_roles",                label: "Rôles des encadrants",       description: "Rôles des coachs et encadrants" },
  { key: "federation_member_roles",    label: "Rôles des membres de fédération", description: "Rôles des membres d'une fédération" },
  { key: "club_member_roles",          label: "Rôles des membres de club",  description: "Rôles des membres d'un club" },
  { key: "person_role_types",          label: "Types de rôle personne",     description: "Types de rôles pour la super-classe Personne" },
  { key: "competition_rounds",         label: "Rounds de compétition",      description: "Finale, demi-finale, quart, séries, etc." },
  { key: "transport_types",            label: "Types de transport",         description: "Navette, bus, train, etc. (logistique locale)" },
  { key: "accommodation_types",        label: "Types d'hébergement",         description: "Hôtel, résidence, village, etc." },
];

export const APP_TYPE_GROUP_KEYS = APP_TYPE_GROUPS.map((g) => g.key);

// ─────────────────────────────────────────────────────────────────────────────
// Hook : useAppTypes
// ─────────────────────────────────────────────────────────────────────────────

export function useAppTypes() {
  const [groups, setGroups] = useState<AppTypeGroup[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("app_type_items")
      .select("*")
      .order("group_key", { ascending: true })
      .order("sort_order", { ascending: true });

    if (error) {
      toast.error("Erreur de chargement", { description: friendlyError(error) });
      setLoading(false);
      return;
    }

    const rows = (data ?? []) as AppTypeItem[];
    const built = APP_TYPE_GROUPS.map((meta) => ({
      ...meta,
      items: rows.filter((r) => r.group_key === meta.key),
    }));
    setGroups(built);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const addItem = useCallback(
    async (groupKey: string, code: string, label: string) => {
      const codeSlug = code.trim().toLowerCase().replace(/[^a-z0-9_]+/g, "_");
      if (!codeSlug) {
        toast.error("Le code est requis");
        return false;
      }
      if (!label.trim()) {
        toast.error("Le libellé est requis");
        return false;
      }

      // Détermine le sort_order max du groupe
      const group = groups.find((g) => g.key === groupKey);
      const maxSort = group?.items.reduce((m, i) => Math.max(m, i.sort_order), 0) ?? 0;

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
      await load();
      return true;
    },
    [groups, load],
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
      await load();
      return true;
    },
    [load],
  );

  const deleteItem = useCallback(
    async (item: AppTypeItem) => {
      const { error } = await supabase.from("app_type_items").delete().eq("id", item.id);

      if (error) {
        toast.error("Erreur lors de la suppression", { description: friendlyError(error) });
        return false;
      }

      toast.success("Type supprimé");
      await load();
      return true;
    },
    [load],
  );

  return { groups, loading, load, addItem, updateItem, deleteItem };
}