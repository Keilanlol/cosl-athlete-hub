-- ============================================================================
-- 62 DOWN. Rollback de la migration 62
-- ============================================================================

BEGIN;

DROP INDEX IF EXISTS public.idx_selections_game_person_no_sport_unique;
DROP INDEX IF EXISTS public.idx_selections_game_person_sport_unique;

DELETE FROM supabase_migrations.schema_migrations WHERE version = '0062';

COMMIT;