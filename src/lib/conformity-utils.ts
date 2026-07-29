import { supabase } from "@/lib/supabase";
import type { PersonDocument } from "@/lib/types";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type RequiredDoc = {
  doc_type_code: string;
  selection_stage: string | null;
};

export type MissingDoc = {
  doc_type_code: string;
  selection_stage: string | null;
  label: string;
};

export type ConformityResult = {
  required: RequiredDoc[];
  provided: PersonDocument[];
  missing: MissingDoc[];
};

// ─────────────────────────────────────────────────────────────────────────────
// computeRequiredDocs
// Récupère les documents requis depuis accreditation_requirements
// ─────────────────────────────────────────────────────────────────────────────

export async function computeRequiredDocs(
  gameId: string,
  accreditationCategory: string,
  selectionStage?: string | null,
): Promise<RequiredDoc[]> {
  let query = supabase
    .from("accreditation_requirements")
    .select("doc_type_code, selection_stage, required")
    .eq("game_id", gameId)
    .eq("role_code", accreditationCategory)
    .eq("required", true);

  if (selectionStage !== undefined) {
    if (selectionStage === null) {
      query = query.is("selection_stage", null);
    } else {
      query = query.eq("selection_stage", selectionStage);
    }
  }

  const { data, error } = await query;
  if (error) return [];
  return ((data ?? []) as RequiredDoc[]).map((d) => ({
    doc_type_code: d.doc_type_code,
    selection_stage: d.selection_stage,
  }));
}

// ─────────────────────────────────────────────────────────────────────────────
// computeMissingDocs
// Croise requirements avec person_documents
// ─────────────────────────────────────────────────────────────────────────────

export async function computeMissingDocs(
  personId: string,
  gameId: string,
  accreditationCategory: string,
  selectionStage?: string | null,
): Promise<ConformityResult> {
  const [required, docsRes, gameRes] = await Promise.all([
    computeRequiredDocs(gameId, accreditationCategory, selectionStage),
    supabase
      .from("person_documents")
      .select("*")
      .eq("person_id", personId)
      .order("created_at", { ascending: false }),
    supabase
      .from("games")
      .select("competition_start")
      .eq("id", gameId)
      .maybeSingle(),
  ]);

  const allDocs = (docsRes.data ?? []) as PersonDocument[];
  const gameStart = (gameRes.data as { competition_start?: string } | null)?.competition_start;

  // Un document n'est considéré fourni que s'il est valide ET non expiré
  // à la date de compétition du Games
  const isDocValid = (d: PersonDocument): boolean => {
    if (d.status !== "valid") return false;
    if (d.expiry_date && gameStart) {
      return d.expiry_date >= gameStart;
    }
    if (d.expiry_date) {
      return d.expiry_date >= new Date().toISOString().slice(0, 10);
    }
    return true;
  };

  const provided = allDocs.filter(isDocValid);

  // Fetch labels for doc types
  const docTypeCodes = required.map((r) => r.doc_type_code);
  const labelMap = await fetchDocTypeLabels(docTypeCodes);

  const providedTypes = new Set(provided.map((d) => d.doc_type));
  const missing: MissingDoc[] = required
    .filter((r) => !providedTypes.has(r.doc_type_code))
    .map((r) => ({
      doc_type_code: r.doc_type_code,
      selection_stage: r.selection_stage,
      label: labelMap[r.doc_type_code] ?? r.doc_type_code,
    }));

  return { required, provided, missing };
}

// ─────────────────────────────────────────────────────────────────────────────
// createConformityNotification
// Crée une notification listant les documents manquants pour une personne
// ─────────────────────────────────────────────────────────────────────────────

export async function createConformityNotification(
  personId: string,
  gameId: string,
  accreditationCategory: string,
  selectionStage: string,
): Promise<void> {
  const result = await computeMissingDocs(
    personId,
    gameId,
    accreditationCategory,
    selectionStage,
  );

  // Récupère le nom du Games
  const { data: game } = await supabase
    .from("games")
    .select("name")
    .eq("id", gameId)
    .maybeSingle();
  const gameName = (game as { name?: string } | null)?.name ?? "Games";

  // Récupère le nom de la personne
  const { data: person } = await supabase
    .from("persons")
    .select("first_name, last_name")
    .eq("id", personId)
    .maybeSingle();
  const personName = person
    ? `${(person as { first_name: string }).first_name} ${(person as { last_name: string }).last_name}`
    : "Personne";

  // Libellé de l'étape de sélection depuis le référentiel app_type_items
  const stageLabel = await resolveSelectionStageLabel(selectionStage);

  if (result.missing.length === 0) {
    // Tous les documents requis sont déjà fournis — pas de notification
    return;
  }

  const missingList = result.missing.map((m) => m.label).join(", ");
  const message = `Documents requis pour ${gameName} — ${accreditationCategory} — ${stageLabel} (${personName}) : ${missingList}`;

  await supabase.from("notifications").insert({
    notification_type: "selection_documents_required",
    message,
    related_game_id: gameId,
    related_person_id: personId,
    is_read: false,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

async function fetchDocTypeLabels(
  codes: string[],
): Promise<Record<string, string>> {
  if (codes.length === 0) return {};
  // Source unique : app_type_items (groupe document_types)
  const { data: ati } = await supabase
    .from("app_type_items")
    .select("code, label")
    .eq("group_key", "document_types")
    .in("code", codes);
  const map: Record<string, string> = {};
  (ati ?? []).forEach((r) => {
    const row = r as { code: string; label: string };
    map[row.code] = row.label;
  });

  return map;
}

// ─────────────────────────────────────────────────────────────────────────────
// resolveSelectionStageLabel
// Récupère le libellé d'une étape de sélection depuis app_type_items
// (groupe selection_statuses). Remplace le mapping hardcodé.
// ─────────────────────────────────────────────────────────────────────────────

export async function resolveSelectionStageLabel(stage: string | null): Promise<string> {
  if (!stage) return "—";
  const { data } = await supabase
    .from("app_type_items")
    .select("label")
    .eq("group_key", "selection_statuses")
    .eq("code", stage)
    .maybeSingle();
  return (data as { label?: string } | null)?.label ?? stage;
}

// ─────────────────────────────────────────────────────────────────────────────
// getSelectionStageForAthlete
// Récupère le statut de sélection d'un athlete pour un Games donné
// ─────────────────────────────────────────────────────────────────────────────

export async function getSelectionStageForAthlete(
  athleteId: string,
  gameId: string,
): Promise<string | null> {
  const { data } = await supabase
    .from("selections")
    .select("status")
    .eq("athlete_id", athleteId)
    .eq("game_id", gameId)
    .maybeSingle();
  return (data as { status?: string } | null)?.status ?? null;
}

// ─────────────────────────────────────────────────────────────────────────────
// getPersonIdForAthlete
// Récupère le person_id d'un athlete via athlete_profiles
// ─────────────────────────────────────────────────────────────────────────────

export async function getPersonIdForAthlete(
  athleteId: string,
): Promise<string | null> {
  // First try athlete_profiles (which has legacy_athlete_id → person_id)
  const { data: ap } = await supabase
    .from("athlete_profiles")
    .select("person_id")
    .eq("legacy_athlete_id", athleteId)
    .maybeSingle();
  const pid = (ap as { person_id?: string | null } | null)?.person_id;
  if (pid) return pid;

  // Fallback: try the athletes table directly (legacy)
  const { data } = await supabase
    .from("athletes")
    .select("person_id")
    .eq("id", athleteId)
    .maybeSingle();
  return (data as { person_id?: string | null } | null)?.person_id ?? null;
}