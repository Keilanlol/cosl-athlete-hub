import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";

export type LevelRef = { id: string; code: string; label: string; sort_order: number };
export type DocTypeRef = {
  id: string;
  code: string;
  label: string;
  category: string;
  sort_order: number;
};
export type SportRef = { id: string; name: string; is_olympic: boolean | null; is_summer: boolean | null };

const slugify = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40) || `item_${Date.now()}`;

/** Athlete levels reference (athlete_levels_ref). */
export function useAthleteLevels() {
  const [items, setItems] = useState<LevelRef[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from("athlete_levels_ref")
      .select("*")
      .order("sort_order", { ascending: true });
    if (error) {
      // fallback: silently empty (table may not exist yet)
      console.warn("athlete_levels_ref:", error.message);
      setItems([]);
    } else {
      setItems((data ?? []) as LevelRef[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const add = async (label: string) => {
    const code = slugify(label);
    const next = (items[items.length - 1]?.sort_order ?? 0) + 1;
    const { error } = await supabase
      .from("athlete_levels_ref")
      .insert({ code, label, sort_order: next });
    if (error) return toast.error(error.message);
    toast.success("Niveau ajouté");
    await load();
  };

  const remove = async (code: string) => {
    const { error } = await supabase.from("athlete_levels_ref").delete().eq("code", code);
    if (error) return toast.error(error.message);
    toast.success("Niveau supprimé");
    await load();
  };

  return { items, loading, add, remove, reload: load };
}

/** Document types reference (document_types). */
export function useDocumentTypes() {
  const [items, setItems] = useState<DocTypeRef[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from("document_types")
      .select("*")
      .order("category", { ascending: true })
      .order("sort_order", { ascending: true });
    if (error) {
      console.warn("document_types:", error.message);
      setItems([]);
    } else {
      setItems((data ?? []) as DocTypeRef[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const add = async (label: string, category: string) => {
    const code = slugify(`${category}_${label}`);
    const { error } = await supabase
      .from("document_types")
      .insert({ code, label, category, sort_order: 99 });
    if (error) return toast.error(error.message);
    toast.success("Type de document ajouté");
    await load();
  };

  const remove = async (code: string) => {
    const { error } = await supabase.from("document_types").delete().eq("code", code);
    if (error) return toast.error(error.message);
    toast.success("Type supprimé");
    await load();
  };

  return { items, loading, add, remove, reload: load };
}

/** Sports list (sports table). */
export function useSports() {
  const [items, setItems] = useState<SportRef[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from("sports")
      .select("id,name,is_olympic,is_summer")
      .order("name");
    if (error) {
      console.warn("sports:", error.message);
      setItems([]);
    } else {
      setItems((data ?? []) as SportRef[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const add = async (name: string) => {
    const { error } = await supabase
      .from("sports")
      .insert({ name, is_olympic: true, is_summer: true });
    if (error) return toast.error(error.message);
    toast.success("Sport ajouté");
    await load();
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("sports").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Sport supprimé");
    await load();
  };

  return { items, loading, add, remove, reload: load };
}
