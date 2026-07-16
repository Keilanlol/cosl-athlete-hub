import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { friendlyError } from "@/lib/error-messages";
import type { AccreditationRequirement } from "@/lib/types";

export type AccreditationRequirementInput = {
  game_id: string;
  role_code: string;
  doc_type_code: string;
  selection_stage: string | null;
  required: boolean;
};

export function useAccreditationRequirements(gameId: string | undefined) {
  const [rows, setRows] = useState<AccreditationRequirement[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!gameId) {
      setRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from("accreditation_requirements")
      .select("*")
      .eq("game_id", gameId)
      .order("role_code", { ascending: true })
      .order("doc_type_code", { ascending: true });
    if (error) {
      toast.error("Erreur", { description: friendlyError(error) });
      setRows([]);
      setLoading(false);
      return;
    }
    setRows((data ?? []) as AccreditationRequirement[]);
    setLoading(false);
  }, [gameId]);

  useEffect(() => {
    load();
  }, [load]);

  const upsert = useCallback(
    async (input: AccreditationRequirementInput) => {
      // Find existing row matching (game_id, role_code, doc_type_code, selection_stage)
      // Use .is() for null selection_stage, .eq() for non-null
      let findQuery = supabase
        .from("accreditation_requirements")
        .select("id")
        .eq("game_id", input.game_id)
        .eq("role_code", input.role_code)
        .eq("doc_type_code", input.doc_type_code);

      if (input.selection_stage === null) {
        findQuery = findQuery.is("selection_stage", null);
      } else {
        findQuery = findQuery.eq("selection_stage", input.selection_stage);
      }

      const { data: existing } = await findQuery.maybeSingle();
      const existingRow = existing as { id?: string } | null;

      if (existingRow?.id) {
        // Update the required flag
        const { error } = await supabase
          .from("accreditation_requirements")
          .update({ required: input.required })
          .eq("id", existingRow.id);
        if (error) {
          toast.error("Erreur", { description: friendlyError(error) });
          return false;
        }
      } else {
        // Insert a new row
        const { error } = await supabase
          .from("accreditation_requirements")
          .insert(input);
        if (error) {
          toast.error("Erreur", { description: friendlyError(error) });
          return false;
        }
      }

      await load();
      return true;
    },
    [load],
  );

  const remove = useCallback(
    async (id: string) => {
      const { error } = await supabase
        .from("accreditation_requirements")
        .delete()
        .eq("id", id);
      if (error) {
        toast.error("Erreur", { description: friendlyError(error) });
        return false;
      }
      await load();
      return true;
    },
    [load],
  );

  return { rows, loading, load, upsert, remove };
}