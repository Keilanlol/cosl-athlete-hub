-- ============================================================================
-- 66 DOWN. Rollback de la migration 66
-- ============================================================================

BEGIN;

DROP TRIGGER IF EXISTS trg_validate_athlete_comp_gender ON public.athlete_results;
DROP FUNCTION IF EXISTS public.validate_athlete_competition_gender();

DELETE FROM supabase_migrations.schema_migrations WHERE version = '0066';

COMMIT;