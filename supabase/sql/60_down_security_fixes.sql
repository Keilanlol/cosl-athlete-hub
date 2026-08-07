-- ============================================================================
-- 60 DOWN. Rollback de la migration 60
-- ============================================================================

-- ── 1. Restaurer les snapshots dans public ──────────────────────────────────
ALTER TABLE IF EXISTS migration_backups.migration_47_snapshot_fk_constraints SET SCHEMA public;
ALTER TABLE IF EXISTS migration_backups.migration_51_snapshot_accreditation_documents SET SCHEMA public;
ALTER TABLE IF EXISTS migration_backups.migration_54_snapshot_accreditations SET SCHEMA public;
ALTER TABLE IF EXISTS migration_backups.migration_48_snapshot_app_type_items SET SCHEMA public;
ALTER TABLE IF EXISTS migration_backups.migration_48_snapshot_person_documents SET SCHEMA public;
ALTER TABLE IF EXISTS migration_backups.migration_48_snapshot_accreditation_documents SET SCHEMA public;
ALTER TABLE IF EXISTS migration_backups.migration_48_snapshot_accreditation_requirements SET SCHEMA public;
ALTER TABLE IF EXISTS migration_backups.migration_48_snapshot_document_types SET SCHEMA public;
ALTER TABLE IF EXISTS migration_backups.migration_49_snapshot_app_type_items_coach_roles SET SCHEMA public;
ALTER TABLE IF EXISTS migration_backups.migration_49_snapshot_accreditations SET SCHEMA public;
ALTER TABLE IF EXISTS migration_backups.migration_49_snapshot_coach_profiles SET SCHEMA public;

-- ── 2. Supprimer les policies techniques et désactiver RLS ──────────────────
DROP POLICY IF EXISTS document_type_codes_select ON public.document_type_codes;
DROP POLICY IF EXISTS document_type_codes_write ON public.document_type_codes;
DROP POLICY IF EXISTS accreditation_category_codes_select ON public.accreditation_category_codes;
DROP POLICY IF EXISTS accreditation_category_codes_write ON public.accreditation_category_codes;
DROP POLICY IF EXISTS role_accreditation_mapping_select ON public.role_accreditation_mapping;
DROP POLICY IF EXISTS role_accreditation_mapping_write ON public.role_accreditation_mapping;

-- ── 3. Restaurer la vue sans security_invoker ──────────────────────────────
-- (recréer la version d'origine de la migration 55)
DROP VIEW IF EXISTS public.v_accreditation_completeness;
CREATE VIEW public.v_accreditation_completeness AS
SELECT
  a.id AS accreditation_id, a.game_id, a.person_id, a.role_code,
  (SELECT count(DISTINCT ar.doc_type_code)
   FROM public.accreditation_requirements ar
   WHERE ar.game_id = a.game_id AND ar.role_code = a.role_code AND ar.required = true
     AND (ar.selection_stage IS NULL OR ar.selection_stage = (
       SELECT s.status::text FROM public.selections s
       WHERE s.game_id = a.game_id AND (s.person_id = a.person_id OR s.athlete_id = a.athlete_id)
         AND s.status IN ('pre_selected','selected','reserve')
       ORDER BY s.status DESC LIMIT 1))) AS required_count,
  (SELECT count(DISTINCT ad.person_document_id)
   FROM public.accreditation_documents ad
   JOIN public.person_documents pd ON pd.id = ad.person_document_id
   WHERE ad.accreditation_id = a.id AND ad.status = 'valid' AND pd.status = 'valid'
     AND (pd.expiry_date IS NULL OR pd.expiry_date >= COALESCE(
       (SELECT g.competition_start FROM public.games g WHERE g.id = a.game_id), CURRENT_DATE))) AS provided_count
FROM public.accreditations a;
GRANT SELECT ON public.v_accreditation_completeness TO authenticated;

-- ── 4-6. Restaurer les fonctions d'origine (sans garde, avec bug) ──────────
-- sync_acreditations_for_game : recréer sans le garde de rôle
-- (voir migration 54 pour la version d'origine)
-- can_access : recréer avec la logique d'origine (buggée)

-- ── 7. Restaurer la policy person_documents_select d'origine (57) ───────────
-- (filtre sur category uniquement, sans filtre par doc_type)

-- ── Retirer la migration du tracking ─────────────────────────────────────────
DELETE FROM supabase_migrations.schema_migrations WHERE version = '0060';