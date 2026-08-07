import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { slugifyCode } from "@/lib/utils";

export type LevelRef = { id: string; code: string; label: string; sort_order: number };
export type SportRef = { id: string; name: string; is_olympic: boolean | null; is_summer: boolean | null };

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
    const code = slugifyCode(label);
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
