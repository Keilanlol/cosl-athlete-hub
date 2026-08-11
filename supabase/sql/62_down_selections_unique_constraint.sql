-- ============================================================================
-- 62 DOWN. Rollback de la migration 62
-- ============================================================================

BEGIN;

DROP INDEX IF EXISTS public.idx_selections_unique_nosport;
DROP INDEX IF EXISTS public.idx_selections_unique_sport_nodisc;
DROP INDEX IF EXISTS public.idx_selections_unique_sport_disc;

DELETE FROM supabase_migrations.schema_migrations WHERE version = '0062';

COMMIT;