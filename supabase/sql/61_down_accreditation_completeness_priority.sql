-- ============================================================================
-- 61 DOWN. Rollback de la migration 61
-- ============================================================================
-- Restaure l'ancienne définition de la vue v_accreditation_completeness
-- depuis le snapshot, puis supprime le snapshot.
-- ============================================================================

BEGIN;

-- ── Restaurer l'ancienne définition de la vue ───────────────────────────────
DO $$
DECLARE
  v_def text;
BEGIN
  SELECT view_def INTO v_def FROM migration_61_snapshot_view_def LIMIT 1;
  IF v_def IS NOT NULL THEN
    EXECUTE 'CREATE OR REPLACE VIEW public.v_accreditation_completeness AS ' || v_def;
  END IF;
END $$;

GRANT SELECT ON public.v_accreditation_completeness TO authenticated;

-- ── Supprimer le snapshot ───────────────────────────────────────────────────
DROP TABLE IF EXISTS migration_61_snapshot_view_def;

-- ── Retirer la migration du tracking ────────────────────────────────────────
DELETE FROM supabase_migrations.schema_migrations WHERE version = '0061';

COMMIT;