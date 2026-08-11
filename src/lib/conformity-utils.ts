import { supabase } from "@/lib/supabase";
import type { PersonDocument } from "@/lib/types";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type RequiredDoc = {
  doc_type_code: string;
  selection_stage: string | null;
};

// ─────────────────────────────────────────────────────────────────────────────
// SELECTION_STAGE_PRIORITY
// Ordre explicite des étapes de sélection, du plus avancé au moins avancé.
// NE PAS utiliser l'ordre de l'enum selection_status (Postgres trie par
// ordre de déclaration : pre_selected < selected < reserve < rejected).
//
// CHANGEMENT D'USAGE : cette priorité ne pilote PLUS le choix des documents.
// Les documents sont now l'UNION de tous les stages actifs (Decision Y).
// Elle reste utilisée uniquement pour afficher un STATUT SYNTHÉTIQUE dans le
// tableau des accréditations (ex: "Tom — Short List" plutôt que "Short List + Réserve").
// ─────────────────────────────────────────────────────────────────────────────
export const SELECTION_STAGE_PRIORITY: Record<string, number> = {
  selected: 1,
  pre_selected: 2,
  reserve: 3,
};

export function compareStagePriority(a: string, b: string): number {
  const pa = SELECTION_STAGE_PRIORITY[a] ?? 99;
  const pb = SELECTION_STAGE_PRIORITY[b] ?? 99;
  return pa - pb; // plus petit = plus avancé
}

// ─────────────────────────────────────────────────────────────────────────────
// SelectionWithStage — une sélection avec son stage et sa discipline
// ─────────────────────────────────────────────────────────────────────────────
export type SelectionWithStage = {
  id: string;
  status: string;
  sport_id: string | null;
  sport_name: string | null;
  discipline_id: string | null;
  discipline_name: string | null;
};

// ─────────────────────────────────────────────────────────────────────────────
// RequiredDocWithSource — document requis avec ses provenances (rôle + discipline + stage)
// ─────────────────────────────────────────────────────────────────────────────
export type RequiredDocWithSource = {
  doc_type_code: string;
  sources: { role_label: string; discipline_name: string | null; stage_label: string }[];
};

// ─────────────────────────────────────────────────────────────────────────────
// MissingDoc
// ─────────────────────────────────────────────────────────────────────────────
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
// getSelectionStageForPerson — STATUT SYNTHÉTIQUE
// Retourne l'étape la plus avancée d'une personne pour un Games.
// Utilise la priorité métier : selected > pre_selected > reserve.
// Sert uniquement pour l'affichage synthétique dans le tableau des accréditations.
// NE PILOTE PAS le choix des documents (qui est l'union de tous les stages).
// ─────────────────────────────────────────────────────────────────────────────

export async function getSelectionStageForPerson(
  personId: string,
  gameId: string,
): Promise<string | undefined> {
  const { data } = await supabase
    .from("selections")
    .select("status")
    .eq("game_id", gameId)
    .eq("person_id", personId)
    .in("status", ["pre_selected", "selected", "reserve"]);

  const statuses = ((data ?? []) as { status?: string }[]).map((r) => r.status);
  if (statuses.length === 0) return undefined;

  // Trier par priorité métier (selected = 1, pre_selected = 2, reserve = 3)
  statuses.sort((a, b) => {
    const pa = SELECTION_STAGE_PRIORITY[a ?? ""] ?? 99;
    const pb = SELECTION_STAGE_PRIORITY[b ?? ""] ?? 99;
    return pa - pb;
  });

  return statuses[0];
}

// ─────────────────────────────────────────────────────────────────────────────
// getActiveSelectionsForPerson
// Retourne TOUTES les sélections actives (pre_selected, selected, reserve)
// d'une personne pour un Games, avec le nom du sport et de la discipline.
// Sert à calculer l'union des requirements et le marquage par discipline.
// ─────────────────────────────────────────────────────────────────────────────

export async function getActiveSelectionsForPerson(
  personId: string,
  gameId: string,
): Promise<SelectionWithStage[]> {
  const { data, error } = await supabase
    .from("selections")
    .select(`
      id,
      status,
      sport_id,
      sport:sports(name),
      discipline_id,
      discipline:disciplines(name)
    `)
    .eq("game_id", gameId)
    .eq("person_id", personId)
    .in("status", ["pre_selected", "selected", "reserve"]);

  if (error || !data) return [];

  return (data as unknown[]).map((row) => {
    const r = row as {
      id: string;
      status: string;
      sport_id: string | null;
      sport: { name: string } | null;
      discipline_id: string | null;
      discipline: { name: string } | null;
    };
    return {
      id: r.id,
      status: r.status,
      sport_id: r.sport_id,
      sport_name: r.sport?.name ?? null,
      discipline_id: r.discipline_id,
      discipline_name: r.discipline?.name ?? null,
    };
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// computeRequiredDocsUnion
// Récupère les documents requis en UNION sur tous les stages actifs.
// Pour chaque document, liste ses provenances (discipline + stage).
// Les requirements sans stage (selection_stage IS NULL) sont toujours inclus.
// ─────────────────────────────────────────────────────────────────────────────

export async function computeRequiredDocsUnion(
  gameId: string,
  accreditationCategory: string,
  activeSelections: SelectionWithStage[],
): Promise<RequiredDocWithSource[]> {
  // Récupérer tous les requirements pour ce rôle et ce game
  const { data, error } = await supabase
    .from("accreditation_requirements")
    .select("doc_type_code, selection_stage, required")
    .eq("game_id", gameId)
    .eq("role_code", accreditationCategory)
    .eq("required", true);

  if (error || !data) return [];

  const requirements = data as { doc_type_code: string; selection_stage: string | null }[];

  // Les stages actifs de cette personne
  const activeStages = new Set(activeSelections.map((s) => s.status));

  // Indexer les sélections par stage pour retrouver la discipline
  const selectionsByStage = new Map<string, SelectionWithStage[]>();
  for (const sel of activeSelections) {
    const list = selectionsByStage.get(sel.status) ?? [];
    list.push(sel);
    selectionsByStage.set(sel.status, list);
  }

  // Filtrer les requirements : sans stage (toujours) OU avec un stage actif
  const applicableReqs = requirements.filter(
    (r) => r.selection_stage === null || activeStages.has(r.selection_stage),
  );

  // Grouper par doc_type_code et construire les provenances
  const docMap = new Map<string, { role_label: string; discipline_name: string | null; stage_label: string }[]>();

  for (const req of applicableReqs) {
    const existing = docMap.get(req.doc_type_code) ?? [];

    if (req.selection_stage === null) {
      // Requirement sans stage : toujours exigé, pas de provenance discipline
      existing.push({
        role_label: accreditationCategory,
        discipline_name: null,
        stage_label: "Toutes étapes",
      });
    } else {
      // Requirement avec stage : provenance = chaque sélection à ce stage
      const sels = selectionsByStage.get(req.selection_stage) ?? [];
      for (const sel of sels) {
        existing.push({
          role_label: accreditationCategory,
          discipline_name: sel.discipline_name ?? sel.sport_name,
          stage_label: sel.status,
        });
      }
    }

    docMap.set(req.doc_type_code, existing);
  }

  return Array.from(docMap.entries()).map(([doc_type_code, sources]) => ({
    doc_type_code,
    sources,
  }));
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