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
// Crée une notification listant les documents manquants pour une personne,
// en tenant compte de l'UNION des stages actifs (comme le drawer).
// ─────────────────────────────────────────────────────────────────────────────

export async function createConformityNotification(
  personId: string,
  gameId: string,
  accreditationCategory: string,
): Promise<void> {
  // Récupérer toutes les sélections actives de la personne
  const activeSelections = await getActiveSelectionsForPerson(personId, gameId);

  // Calculer l'union des requirements
  const requiredDocs = await computeRequiredDocsUnion(gameId, accreditationCategory, activeSelections);
  const requiredCodes = requiredDocs.map((d) => d.doc_type_code);

  // Récupérer les documents de la personne
  const [docsRes, gameRes] = await Promise.all([
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

  const providedTypes = new Set(allDocs.filter(isDocValid).map((d) => d.doc_type));
  const missingCodes = requiredCodes.filter((code) => !providedTypes.has(code));

  if (missingCodes.length === 0) return;

  // Récupérer les libellés des types de documents manquants
  const labelMap = await fetchDocTypeLabels(missingCodes);
  const missingList = missingCodes.map((code) => labelMap[code] ?? code).join(", ");

  // Récupérer le nom du Games
  const { data: game } = await supabase
    .from("games")
    .select("name")
    .eq("id", gameId)
    .maybeSingle();
  const gameName = (game as { name?: string } | null)?.name ?? "Games";

  // Récupérer le nom de la personne
  const { data: person } = await supabase
    .from("persons")
    .select("first_name, last_name")
    .eq("id", personId)
    .maybeSingle();
  const personName = person
    ? `${(person as { first_name: string }).first_name} ${(person as { last_name: string }).last_name}`
    : "Personne";

  const message = `Documents requis pour ${gameName} — ${accreditationCategory} (${personName}) : ${missingList}`;

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
// getPersonAccreditationCategories
// Dérive les catégories d'accréditation d'une personne depuis person_roles
// et les tables de profil, résolues via role_accreditation_mapping.
// Retourne un tableau de { category, role_label } dédoublonné.
// ─────────────────────────────────────────────────────────────────────────────

export type PersonAccreditationCategory = {
  category: string;
  role_label: string;
};

export async function getPersonAccreditationCategories(
  personId: string,
): Promise<PersonAccreditationCategory[]> {
  // 1. Récupérer les rôles actifs depuis person_roles
  const { data: rolesData } = await supabase
    .from("person_roles")
    .select("role_type")
    .eq("person_id", personId)
    .eq("is_active", true);

  const roleTypes = ((rolesData ?? []) as { role_type: string }[]).map((r) => r.role_type);

  // 2. Pour chaque rôle, récupérer le rôle détaillé depuis les profils
  // et résoudre la catégorie via role_accreditation_mapping
  const categories: PersonAccreditationCategory[] = [];

  // Récupérer les mappings d'avance (une seule requête)
  const { data: mappingData } = await supabase
    .from("role_accreditation_mapping")
    .select("source_group, source_code, accreditation_category");

  const mappings = new Map<string, string>();
  (mappingData ?? []).forEach((m) => {
    const row = m as { source_group: string; source_code: string; accreditation_category: string };
    mappings.set(`${row.source_group}:${row.source_code}`, row.accreditation_category);
  });

  // Récupérer les libellés des catégories d'accréditation
  const { data: catData } = await supabase
    .from("app_type_items")
    .select("code, label")
    .eq("group_key", "accreditation_categories");

  const catLabels = new Map<string, string>();
  (catData ?? []).forEach((c) => {
    const row = c as { code: string; label: string };
    catLabels.set(row.code, row.label);
  });

  for (const roleType of roleTypes) {
    if (roleType === "athlete") {
      categories.push({ category: "athlete", role_label: catLabels.get("athlete") ?? "Athlète" });
      continue;
    }

    if (roleType === "coach") {
      // Récupérer le rôle détaillé depuis coach_profiles
      const { data: cp } = await supabase
        .from("coach_profiles")
        .select("role")
        .eq("person_id", personId)
        .eq("is_active", true)
        .limit(1)
        .maybeSingle();

      const coachRole = (cp as { role?: string } | null)?.role;
      if (coachRole) {
        const cat = mappings.get(`coach_roles:${coachRole}`) ?? "coach";
        categories.push({ category: cat, role_label: catLabels.get(cat) ?? cat });
      } else {
        categories.push({ category: "coach", role_label: catLabels.get("coach") ?? "Coach" });
      }
      continue;
    }

    if (roleType === "federation_member") {
      // Récupérer le rôle détaillé depuis federation_member_profiles
      const { data: fmp } = await supabase
        .from("federation_member_profiles")
        .select("role")
        .eq("person_id", personId)
        .eq("is_active", true)
        .limit(1)
        .maybeSingle();

      const fedRole = (fmp as { role?: string } | null)?.role;
      if (fedRole) {
        const cat = mappings.get(`federation_member_roles:${fedRole}`) ?? "official";
        categories.push({ category: cat, role_label: catLabels.get(cat) ?? cat });
      } else {
        categories.push({ category: "official", role_label: catLabels.get("official") ?? "Officiel" });
      }
      continue;
    }

    // Rôles sans profil détaillé : official, volunteer, staff
    const cat = mappings.get(`person_role_types:${roleType}`) ?? "official";
    categories.push({ category: cat, role_label: catLabels.get(cat) ?? cat });
  }

  // Dédoublonner par catégorie (une personne peut avoir plusieurs profils coach
  // mappés sur la même catégorie)
  const seen = new Set<string>();
  return categories.filter((c) => {
    if (seen.has(c.category)) return false;
    seen.add(c.category);
    return true;
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// computeRequiredDocsMultiRole
// Calcule l'union des requirements pour TOUS les rôles d'une personne.
// Fusionne les résultats de computeRequiredDocsUnion par catégorie,
// dédoublonne sur doc_type_code, concatène les sources.
// ─────────────────────────────────────────────────────────────────────────────

export async function computeRequiredDocsMultiRole(
  gameId: string,
  categories: PersonAccreditationCategory[],
  activeSelections: SelectionWithStage[],
): Promise<RequiredDocWithSource[]> {
  // Appeler computeRequiredDocsUnion pour chaque catégorie
  const perRole = await Promise.all(
    categories.map((cat) =>
      computeRequiredDocsUnion(gameId, cat.category, activeSelections).then((docs) =>
        docs.map((d) => ({
          doc_type_code: d.doc_type_code,
          sources: d.sources.map((s) => ({
            ...s,
            role_label: cat.role_label,
          })),
        })),
      ),
    ),
  );

  // Fusionner : dédoublonner sur doc_type_code, concaténer les sources
  const docMap = new Map<string, { role_label: string; discipline_name: string | null; stage_label: string }[]>();

  for (const docs of perRole) {
    for (const doc of docs) {
      const existing = docMap.get(doc.doc_type_code) ?? [];
      // Concaténer les sources (en évitant les doublons exacts)
      for (const src of doc.sources) {
        const isDuplicate = existing.some(
          (e) =>
            e.role_label === src.role_label &&
            e.discipline_name === src.discipline_name &&
            e.stage_label === src.stage_label,
        );
        if (!isDuplicate) {
          existing.push(src);
        }
      }
      docMap.set(doc.doc_type_code, existing);
    }
  }

  return Array.from(docMap.entries()).map(([doc_type_code, sources]) => ({
    doc_type_code,
    sources,
  }));
}

// ─────────────────────────────────────────────────────────────────────────────
// getRequiredDocTypesRPC
// Appelle la fonction SQL get_required_doc_types (source unique de vérité).
// Remplace getPersonAccreditationCategories + computeRequiredDocsMultiRole +
// getActiveSelectionsForPerson côté frontend.
// Retourne les RequiredDocWithSource prêts à l'emploi.
// ─────────────────────────────────────────────────────────────────────────────

export async function getRequiredDocTypesRPC(
  personId: string,
  gameId: string,
): Promise<RequiredDocWithSource[]> {
  const { data, error } = await supabase.rpc("get_required_doc_types", {
    p_person_id: personId,
    p_game_id: gameId,
  });

  if (error || !data) return [];

  // La RPC retourne des lignes (doc_type_code, role_label, discipline_name, stage_label)
  // On les groupe par doc_type_code en concaténant les sources
  const rows = data as { doc_type_code: string; role_label: string; discipline_name: string | null; stage_label: string }[];
  const docMap = new Map<string, { role_label: string; discipline_name: string | null; stage_label: string }[]>();

  for (const row of rows) {
    const existing = docMap.get(row.doc_type_code) ?? [];
    // Éviter les doublons exacts
    const isDuplicate = existing.some(
      (e) =>
        e.role_label === row.role_label &&
        e.discipline_name === row.discipline_name &&
        e.stage_label === row.stage_label,
    );
    if (!isDuplicate) {
      existing.push({
        role_label: row.role_label,
        discipline_name: row.discipline_name,
        stage_label: row.stage_label,
      });
    }
    docMap.set(row.doc_type_code, existing);
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