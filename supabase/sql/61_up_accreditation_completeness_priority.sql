-- ============================================================================
-- 61 UP. Vue v_accreditation_completeness : union des stages + suppression branche legacy
-- ============================================================================
-- Corrige :
-- 1. Remplace la sélection d'une SEULE étape (LIMIT 1) par l'UNION des
--    requirements de TOUS les stages actifs de la personne. Un athlète
--    selected en 100m et reserve en 200m doit fournir l'union des documents
--    exigés par les deux stages.
-- 2. Supprime la branche (s.athlete_id = a.athlete_id) qui est morte :
--    sync_accreditations_for_game n'insère que person_id.
-- 3. Utilise person_id uniquement pour la résolution des stages.
-- 4. La règle de priorité (CASE selected=1, pre_selected=2, reserve=3) n'est
--    plus utilisée pour le calcul des documents. Elle reste disponible pour
--    afficher un statut synthétique dans le tableau des accréditations.
-- ============================================================================
-- Prérequis : backfill de selections.person_id (migration 63) doit avoir été
-- fait avant d'appliquer cette migration, si la requête de contrôle > 0.
-- ============================================================================

BEGIN;

-- ── Snapshot de la vue avant modification ───────────────────────────────────
-- Une vue n'a pas de données, on snapshot la définition dans une table temporaire
DROP TABLE IF EXISTS migration_61_snapshot_view_def;
CREATE TABLE migration_61_snapshot_view_def AS
  SELECT pg_get_viewdef('public.v_accreditation_completeness'::regclass, true) AS view_def;

-- ── Recréer la vue avec l'union des stages ──────────────────────────────────
CREATE OR REPLACE VIEW public.v_accreditation_completeness AS
SELECT
  a.id AS accreditation_id,
  a.game_id,
  a.person_id,
  a.role_code,
  -- Nombre total de documents requis : union des requirements de tous les
  -- stages actifs (pre_selected, selected, reserve) de la personne pour ce
  -- Games, PLUS les requirements sans stage (toujours exigés).
  (
    SELECT count(DISTINCT ar.doc_type_code)
    FROM public.accreditation_requirements ar
    WHERE ar.game_id = a.game_id
      AND ar.role_code = a.role_code
      AND ar.required = true
      AND (
        ar.selection_stage IS NULL
        OR EXISTS (
          SELECT 1
          FROM public.selections s
          WHERE s.game_id = a.game_id
            AND s.person_id = a.person_id
            AND s.status::text = ar.selection_stage
            AND s.status IN ('pre_selected', 'selected', 'reserve')
        )
      )
  ) AS required_count,
  -- Nombre de documents fournis : accreditation_documents liées avec statut valide
  -- et dont le person_documents lié a un statut valide et n'est pas expiré
  (
    SELECT count(DISTINCT ad.person_document_id)
    FROM public.accreditation_documents ad
    JOIN public.person_documents pd ON pd.id = ad.person_document_id
    WHERE ad.accreditation_id = a.id
      AND ad.status = 'valid'
      AND pd.status = 'valid'
      AND (pd.expiry_date IS NULL OR pd.expiry_date >= COALESCE(
        (SELECT g.competition_start FROM public.games g WHERE g.id = a.game_id),
        CURRENT_DATE
      ))
  ) AS provided_count
FROM public.accreditations a;

GRANT SELECT ON public.v_accreditation_completeness TO authenticated;

-- ── Enregistrer la migration ────────────────────────────────────────────────
INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('0061', 'accreditation_completeness_union_stages')
ON CONFLICT (version) DO NOTHING;

COMMIT;