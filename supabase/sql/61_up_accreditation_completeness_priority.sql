-- ============================================================================
-- 61 UP. Vue v_accreditation_completeness : priorité étapes + suppression branche legacy
-- ============================================================================
-- Corrige :
-- 1. Le tri arbitraire ORDER BY s.status DESC (enum trié par ordre de déclaration,
--    pas par priorité métier). Remplacé par un CASE explicite :
--    selected (1) > pre_selected (2) > reserve (3).
-- 2. Supprime la branche (s.athlete_id = a.athlete_id) qui est morte :
--    sync_accreditations_for_game n'insère que person_id.
-- 3. Utilise person_id uniquement pour la résolution de l'étape.
-- ============================================================================
-- Prérequis : backfill de selections.person_id (cause 2) doit avoir été fait
-- avant d'appliquer cette migration. Voir requête de contrôle ci-dessous.
-- ============================================================================

BEGIN;

-- ── Snapshot de la vue avant modification ───────────────────────────────────
-- Une vue n'a pas de données, on snapshot la définition dans une table temporaire
DROP TABLE IF EXISTS migration_61_snapshot_view_def;
CREATE TABLE migration_61_snapshot_view_def AS
  SELECT pg_get_viewdef('public.v_accreditation_completeness'::regclass, true) AS view_def;

-- ── Recréer la vue avec la correction ───────────────────────────────────────
CREATE OR REPLACE VIEW public.v_accreditation_completeness AS
SELECT
  a.id AS accreditation_id,
  a.game_id,
  a.person_id,
  a.role_code,
  -- Nombre total de documents requis pour ce rôle et l'étape la plus avancée
  (
    SELECT count(DISTINCT ar.doc_type_code)
    FROM public.accreditation_requirements ar
    WHERE ar.game_id = a.game_id
      AND ar.role_code = a.role_code
      AND ar.required = true
      AND (
        ar.selection_stage IS NULL
        OR ar.selection_stage = (
          SELECT s.status::text
          FROM public.selections s
          WHERE s.game_id = a.game_id
            AND s.person_id = a.person_id
            AND s.status IN ('pre_selected', 'selected', 'reserve')
          ORDER BY
            CASE s.status
              WHEN 'selected'     THEN 1
              WHEN 'pre_selected' THEN 2
              WHEN 'reserve'      THEN 3
              ELSE 99
            END
          LIMIT 1
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
VALUES ('0061', 'accreditation_completeness_priority')
ON CONFLICT (version) DO NOTHING;

COMMIT;