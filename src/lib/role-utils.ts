import { supabase } from "@/lib/supabase";
import { friendlyError } from "@/lib/error-messages";
import { toast } from "sonner";
import type { PersonRoleType } from "@/lib/persons";

export async function assignPersonRole(
  personId: string,
  role: PersonRoleType,
): Promise<void> {
  const { error } = await supabase
    .from("person_roles")
    .insert({ person_id: personId, role_type: role });
  if (error) {
    toast.error("Échec assignation rôle", { description: friendlyError(error) });
    throw error;
  }
}

export async function upsertPersonRole(
  personId: string,
  role: PersonRoleType,
): Promise<void> {
  const { error } = await supabase
    .from("person_roles")
    .upsert(
      { person_id: personId, role_type: role },
      { onConflict: "person_id,role_type", ignoreDuplicates: true },
    );
  if (error) {
    toast.error("Échec assignation rôle", { description: friendlyError(error) });
    throw error;
  }
}

export async function revokePersonRole(
  personId: string,
  role: PersonRoleType,
): Promise<void> {
  const { error } = await supabase
    .from("person_roles")
    .delete()
    .eq("person_id", personId)
    .eq("role_type", role);
  if (error) {
    toast.error("Échec révocation rôle", { description: friendlyError(error) });
    throw error;
  }
}